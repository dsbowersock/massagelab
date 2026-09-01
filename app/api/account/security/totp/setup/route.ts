import { NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import {
  noStoreJsonHeaders,
  parseTrustedAccountSecurityJson,
} from "@/lib/account-security-request"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { startTwoFactorEnrollment } from "@/lib/account-two-factor-management"
import {
  clearGoogleBindingCookie,
  readCookie,
  requestFailure,
  serviceFailure,
} from "@/lib/account-two-factor-route-boundary"
import { getAuthSecret, getSiteUrl } from "@/lib/auth-env"
import { AUTH_METHOD_INTENT_COOKIE, resolveBoundAuthMethodIntent } from "@/lib/auth-method-intents"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import { prisma } from "@/lib/prisma"
import { TWO_FACTOR_ENROLLMENT_COOKIE } from "@/lib/two-factor-enrollment-binding"

type SetupSession = { user?: { id?: string | null } | null } | null
type SetupBody =
  | { proofMethod: "PASSWORD"; password: string; confirmed: true }
  | { proofMethod: "GOOGLE"; confirmed: true }

/**
 * Enforces the browser request boundary before session or persistence work,
 * then delegates one proved enrollment mutation and exposes only setup data.
 */
export function createTwoFactorSetupHandler({
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
  getSession: () => Promise<SetupSession>
  expectedSiteUrl: string
  parseRequest: typeof parseTrustedAccountSecurityJson
  secret: string
  resolveIntent: typeof resolveBoundAuthMethodIntent
  mutate: typeof startTwoFactorEnrollment
  clock?: () => Date
  clearCache: (userId: string, surface: "security") => void
  secureCookies?: boolean
}) {
  return async function twoFactorSetupHandler(request: Request) {
    const parsed = await parseSetupRequest(request, expectedSiteUrl, parseRequest)
    if (!parsed.ok) return requestFailure(parsed.code)

    let session: SetupSession
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
          purpose: "ENROLL_TWO_FACTOR",
          status: "CONSUMED",
          secret,
          now,
        })
      } catch {
        return serviceFailure("CONFLICT")
      }
      if (!intent || intent.targetUserId !== userId) {
        return serviceFailure("GOOGLE_PROOF_EXPIRED")
      }
      primaryProof = { kind: "GOOGLE", intentId: intent.id }
    }

    let result: Awaited<ReturnType<typeof startTwoFactorEnrollment>>
    try {
      result = await mutate({
        prismaClient,
        userId,
        primaryProof,
        networkIdentifier: authRequestNetworkIdentifier(request),
        confirmed: true,
        authSecret: secret,
        now,
      })
    } catch {
      return serviceFailure("CONFLICT")
    }
    if (result.status !== "SETUP_READY") {
      return serviceFailure(result.code, result.retryAfterSeconds)
    }

    clearCache(userId, "security")
    const response = NextResponse.json({
      code: "TWO_FACTOR_SETUP_READY",
      qrCode: result.qrCode,
      manualCode: result.manualCode,
    }, { headers: noStoreJsonHeaders() })
    response.cookies.set(TWO_FACTOR_ENROLLMENT_COOKIE, result.enrollmentBinding, enrollmentCookieOptions(300, secureCookies))
    if (parsed.body.proofMethod === "GOOGLE") clearGoogleBindingCookie(response, secureCookies)
    return response
  }
}

async function parseSetupRequest(
  request: Request,
  expectedSiteUrl: string,
  parseRequest: typeof parseTrustedAccountSecurityJson,
): Promise<{ ok: true; body: SetupBody } | { ok: false; code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST" }> {
  const parsed = await parseRequest({
    request,
    expectedSiteUrl,
    allowedKeySets: [
      ["proofMethod", "confirmed"],
      ["proofMethod", "password", "confirmed"],
    ],
  })
  if (!parsed.ok) return parsed
  if (
    parsed.body.proofMethod === "GOOGLE"
    && !Object.hasOwn(parsed.body, "password")
    && parsed.body.confirmed === true
  ) {
    return { ok: true, body: { proofMethod: "GOOGLE", confirmed: true } }
  }
  if (
    parsed.body.proofMethod !== "PASSWORD"
    || typeof parsed.body.password !== "string"
    || parsed.body.confirmed !== true
  ) {
    return { ok: false, code: "INVALID_REQUEST" }
  }
  return {
    ok: true,
    body: { proofMethod: "PASSWORD", password: parsed.body.password, confirmed: true },
  }
}

function enrollmentCookieOptions(maxAge: number, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    maxAge,
    secure,
    path: "/api/account/security/totp",
  }
}

export const POST = createTwoFactorSetupHandler({
  prismaClient: prisma,
  getSession: getCurrentSession,
  expectedSiteUrl: getSiteUrl(),
  parseRequest: parseTrustedAccountSecurityJson,
  secret: getAuthSecret(),
  resolveIntent: resolveBoundAuthMethodIntent,
  mutate: startTwoFactorEnrollment,
  clearCache: clearAccountSurfaceDataCache,
})
