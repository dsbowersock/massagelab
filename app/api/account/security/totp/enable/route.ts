import { NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import {
  noStoreJsonHeaders,
  parseTrustedAccountSecurityJson,
} from "@/lib/account-security-request"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { enableTwoFactor } from "@/lib/account-two-factor-management"
import {
  readCookie,
  requestFailure,
  serviceFailure,
} from "@/lib/account-two-factor-route-boundary"
import { getAuthSecret, getSiteUrl } from "@/lib/auth-env"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
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
      const response = serviceFailure("CONFLICT")
      clearEnrollmentCookie(response, secureCookies)
      return response
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
        networkIdentifier: authRequestNetworkIdentifier(request),
        authSecret: secret,
        now: clock(),
      })
    } catch {
      const response = serviceFailure("CONFLICT")
      clearEnrollmentCookie(response, secureCookies)
      return response
    }

    if (result.status !== "ENABLED") {
      const response = serviceFailure(result.code, result.retryAfterSeconds)
      if (!RETRYABLE_BINDING_CODES.has(result.code)) clearEnrollmentCookie(response, secureCookies)
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
