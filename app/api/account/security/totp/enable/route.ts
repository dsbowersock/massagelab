import { NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import {
  noStoreJsonHeaders,
  parseTrustedAccountSecurityJson,
} from "@/lib/account-security-request"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { enableTwoFactor } from "@/lib/account-two-factor-management"
import { getAuthSecret, getSiteUrl } from "@/lib/auth-env"
import { prisma } from "@/lib/prisma"
import { TWO_FACTOR_ENROLLMENT_COOKIE } from "@/lib/two-factor-enrollment-binding"

type EnableSession = { user?: { id?: string | null } | null } | null
type EnableBody = { code: string; confirmed: true }
const RETRYABLE_BINDING_CODES = new Set(["TWO_FACTOR_INVALID", "RATE_LIMITED"])

/**
 * Converts an exact same-origin request and browser-bound enrollment cookie
 * into one enable service call; terminal outcomes retire the binding.
 */
export function createTwoFactorEnableHandler({
  prismaClient,
  getSession,
  expectedSiteUrl,
  parseRequest,
  secret,
  mutate,
  clock = () => new Date(),
  clearCache,
  secureCookies = process.env.NODE_ENV === "production",
}: {
  prismaClient: typeof prisma
  getSession: () => Promise<EnableSession>
  expectedSiteUrl: string
  parseRequest: typeof parseTrustedAccountSecurityJson
  secret: string
  mutate: typeof enableTwoFactor
  clock?: () => Date
  clearCache: (userId: string, surface: "security") => void
  secureCookies?: boolean
}) {
  return async function twoFactorEnableHandler(request: Request) {
    const parsed = await parseRequest({
      request,
      expectedSiteUrl,
      allowedKeys: ["code", "confirmed"],
    })
    if (!parsed.ok) return requestFailure(parsed.code)
    if (typeof parsed.body.code !== "string" || parsed.body.confirmed !== true) {
      return serviceFailure("INVALID_REQUEST")
    }
    const body: EnableBody = { code: parsed.body.code, confirmed: true }

    let session: EnableSession
    try {
      session = await getSession()
    } catch {
      return serviceFailure("CONFLICT")
    }
    const userId = typeof session?.user?.id === "string" ? session.user.id : ""
    if (!userId) return serviceFailure("AUTHENTICATION_REQUIRED")

    let result: Awaited<ReturnType<typeof enableTwoFactor>>
    try {
      result = await mutate({
        prismaClient,
        userId,
        enrollmentBinding: readCookie(request, TWO_FACTOR_ENROLLMENT_COOKIE),
        code: body.code,
        confirmed: true,
        networkIdentifier: requestIp(request),
        authSecret: secret,
        now: clock(),
      })
    } catch {
      const response = serviceFailure("CONFLICT")
      clearEnrollmentCookie(response, secureCookies)
      return response
    }

    if (result.status !== "ENABLED") {
      const code = allowedFailureCode(result.code) ? result.code : "CONFLICT"
      const response = serviceFailure(code, result.retryAfterSeconds)
      if (!RETRYABLE_BINDING_CODES.has(code)) clearEnrollmentCookie(response, secureCookies)
      return response
    }

    clearCache(userId, "security")
    const response = NextResponse.json({
      code: "TWO_FACTOR_ENABLED",
      backupCodes: result.backupCodes,
    }, { headers: noStoreJsonHeaders() })
    clearEnrollmentCookie(response, secureCookies)
    return response
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

function allowedFailureCode(code: string) {
  return code === "INVALID_REQUEST"
    || code === "RATE_LIMITED"
    || code === "PASSWORD_REQUIRED"
    || code === "PRIMARY_PROOF_INVALID"
    || code === "GOOGLE_PROOF_EXPIRED"
    || code === "TWO_FACTOR_REQUIRED"
    || code === "TWO_FACTOR_INVALID"
    || code === "ALREADY_ENABLED"
    || code === "NOT_ENABLED"
    || code === "ENROLLMENT_EXPIRED"
    || code === "CONFLICT"
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

function clearEnrollmentCookie(response: ReturnType<typeof NextResponse.json>, secure: boolean) {
  response.cookies.set(TWO_FACTOR_ENROLLMENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 0,
    secure,
    path: "/api/account/security/totp",
  })
}

export const POST = createTwoFactorEnableHandler({
  prismaClient: prisma,
  getSession: getCurrentSession,
  expectedSiteUrl: getSiteUrl(),
  parseRequest: parseTrustedAccountSecurityJson,
  secret: getAuthSecret(),
  mutate: enableTwoFactor,
  clearCache: clearAccountSurfaceDataCache,
})
