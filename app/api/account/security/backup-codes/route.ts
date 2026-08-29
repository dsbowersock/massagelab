import { NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import {
  noStoreJsonHeaders,
  parseTrustedAccountSecurityJson,
} from "@/lib/account-security-request"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { regenerateBackupCodes } from "@/lib/account-two-factor-management"
import { getAuthSecret, getSiteUrl } from "@/lib/auth-env"
import { AUTH_METHOD_INTENT_COOKIE, resolveBoundAuthMethodIntent } from "@/lib/auth-method-intents"
import { prisma } from "@/lib/prisma"

type RegenerateSession = { user?: { id?: string | null } | null } | null
type ManageBody =
  | { proofMethod: "PASSWORD"; password: string; twoFactorCode: string; confirmed: true }
  | { proofMethod: "GOOGLE"; twoFactorCode: string; confirmed: true }

/**
 * Requires exact browser provenance plus independent primary and current-factor
 * proof before rotating backup codes and revoking prior sessions atomically.
 */
export function createBackupCodeRegenerationHandler({
  prismaClient,
  getSession,
  expectedSiteUrl,
  parseRequest,
  secret,
  resolveIntent,
  mutate,
  clock = () => new Date(),
  clearCache,
  secureCookies = process.env.NODE_ENV === "production",
}: {
  prismaClient: typeof prisma
  getSession: () => Promise<RegenerateSession>
  expectedSiteUrl: string
  parseRequest: typeof parseTrustedAccountSecurityJson
  secret: string
  resolveIntent: typeof resolveBoundAuthMethodIntent
  mutate: typeof regenerateBackupCodes
  clock?: () => Date
  clearCache: (userId: string, surface: "security") => void
  secureCookies?: boolean
}) {
  return async function backupCodeRegenerationHandler(request: Request) {
    const parsed = await parseManageRequest(request, expectedSiteUrl, parseRequest)
    if (!parsed.ok) return requestFailure(parsed.code)

    let session: RegenerateSession
    try {
      session = await getSession()
    } catch {
      return serviceFailure("CONFLICT")
    }
    const userId = typeof session?.user?.id === "string" ? session.user.id : ""
    if (!userId) return serviceFailure("AUTHENTICATION_REQUIRED")

    const now = clock()
    let primaryProof: { kind: "PASSWORD"; password: string } | { kind: "GOOGLE"; intentId: string }
    if (parsed.body.proofMethod === "PASSWORD") {
      primaryProof = { kind: "PASSWORD", password: parsed.body.password }
    } else {
      let intent
      try {
        intent = await resolveIntent({
          prismaClient,
          cookieValue: readCookie(request, AUTH_METHOD_INTENT_COOKIE),
          purpose: "LINK_GOOGLE",
          status: "CONSUMED",
          secret,
          now,
        })
      } catch {
        return serviceFailure("CONFLICT")
      }
      if (!intent || intent.targetUserId !== userId) return serviceFailure("GOOGLE_PROOF_EXPIRED")
      primaryProof = { kind: "GOOGLE", intentId: intent.id }
    }

    let result: Awaited<ReturnType<typeof regenerateBackupCodes>>
    try {
      result = await mutate({
        prismaClient,
        userId,
        primaryProof,
        twoFactorCode: parsed.body.twoFactorCode,
        networkIdentifier: requestIp(request),
        confirmed: true,
        now,
      })
    } catch {
      return serviceFailure("CONFLICT")
    }
    if (result.status !== "BACKUP_CODES_REGENERATED") {
      return serviceFailure(result.code, result.retryAfterSeconds)
    }

    clearCache(userId, "security")
    const response = NextResponse.json({
      code: "BACKUP_CODES_REGENERATED",
      backupCodes: result.backupCodes,
    }, { headers: noStoreJsonHeaders() })
    if (parsed.body.proofMethod === "GOOGLE") clearGoogleBindingCookie(response, secureCookies)
    return response
  }
}

async function parseManageRequest(
  request: Request,
  expectedSiteUrl: string,
  parseRequest: typeof parseTrustedAccountSecurityJson,
): Promise<{ ok: true; body: ManageBody } | { ok: false; code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST" }> {
  const google = await parseRequest({
    request: request.clone(),
    expectedSiteUrl,
    allowedKeys: ["proofMethod", "twoFactorCode", "confirmed"],
  })
  if (!google.ok && google.code === "UNTRUSTED_REQUEST") return google
  if (
    google.ok
    && google.body.proofMethod === "GOOGLE"
    && typeof google.body.twoFactorCode === "string"
    && google.body.confirmed === true
  ) {
    return {
      ok: true,
      body: { proofMethod: "GOOGLE", twoFactorCode: google.body.twoFactorCode, confirmed: true },
    }
  }

  const password = await parseRequest({
    request,
    expectedSiteUrl,
    allowedKeys: ["proofMethod", "password", "twoFactorCode", "confirmed"],
  })
  if (!password.ok) return password
  if (
    password.body.proofMethod !== "PASSWORD"
    || typeof password.body.password !== "string"
    || typeof password.body.twoFactorCode !== "string"
    || password.body.confirmed !== true
  ) {
    return { ok: false, code: "INVALID_REQUEST" }
  }
  return {
    ok: true,
    body: {
      proofMethod: "PASSWORD",
      password: password.body.password,
      twoFactorCode: password.body.twoFactorCode,
      confirmed: true,
    },
  }
}

function requestFailure(code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST") {
  return jsonCode(code, code === "UNTRUSTED_REQUEST" ? 403 : 400)
}

function serviceFailure(code: string, retryAfterSeconds?: number) {
  if (code === "RATE_LIMITED") {
    if (!Number.isSafeInteger(retryAfterSeconds) || (retryAfterSeconds ?? 0) < 1) return jsonCode("CONFLICT", 409)
    return jsonCode("RATE_LIMITED", 429, { "Retry-After": String(retryAfterSeconds) })
  }
  const status = failureStatus(code)
  return status === null ? jsonCode("CONFLICT", 409) : jsonCode(code, status)
}

function failureStatus(code: string): number | null {
  if (code === "AUTHENTICATION_REQUIRED") return 401
  if (code === "INVALID_REQUEST" || code === "TWO_FACTOR_REQUIRED") return 400
  if (
    code === "PRIMARY_PROOF_INVALID"
    || code === "GOOGLE_PROOF_EXPIRED"
    || code === "TWO_FACTOR_INVALID"
    || code === "ENROLLMENT_EXPIRED"
  ) return 403
  if (code === "PASSWORD_REQUIRED" || code === "ALREADY_ENABLED" || code === "NOT_ENABLED" || code === "CONFLICT") return 409
  return null
}

function jsonCode(code: string, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json({ code }, {
    status,
    headers: { ...noStoreJsonHeaders(), ...extraHeaders },
  })
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
}

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? ""
}

function clearGoogleBindingCookie(response: ReturnType<typeof NextResponse.json>, secure: boolean) {
  response.cookies.set(AUTH_METHOD_INTENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    secure,
    path: "/",
  })
}

export const POST = createBackupCodeRegenerationHandler({
  prismaClient: prisma,
  getSession: getCurrentSession,
  expectedSiteUrl: getSiteUrl(),
  parseRequest: parseTrustedAccountSecurityJson,
  secret: getAuthSecret(),
  resolveIntent: resolveBoundAuthMethodIntent,
  mutate: regenerateBackupCodes,
  clearCache: clearAccountSurfaceDataCache,
})
