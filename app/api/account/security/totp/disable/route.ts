import { NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import {
  noStoreJsonHeaders,
  parseTrustedAccountSecurityJson,
} from "@/lib/account-security-request"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { disableTwoFactor } from "@/lib/account-two-factor-management"
import {
  clearGoogleBindingCookie,
  parseManageRequest,
  readCookie,
  requestFailure,
  serviceFailure,
} from "@/lib/account-two-factor-route-boundary"
import { getAuthSecret, getSiteUrl } from "@/lib/auth-env"
import { AUTH_METHOD_INTENT_COOKIE, resolveBoundAuthMethodIntent } from "@/lib/auth-method-intents"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import { prisma } from "@/lib/prisma"

type DisableSession = { user?: { id?: string | null } | null } | null
/**
 * Requires an exact same-origin request plus independent primary and current
 * factor proof before delegating the atomic disable-and-revoke transaction.
 */
export function createTwoFactorDisableHandler({
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
  getSession: () => Promise<DisableSession>
  expectedSiteUrl: string
  parseRequest: typeof parseTrustedAccountSecurityJson
  secret: string
  resolveIntent: typeof resolveBoundAuthMethodIntent
  mutate: typeof disableTwoFactor
  clock?: () => Date
  clearCache: (userId: string, surface: "security") => void
  secureCookies?: boolean
}) {
  return async function twoFactorDisableHandler(request: Request) {
    const parsed = await parseManageRequest(request, expectedSiteUrl, parseRequest)
    if (!parsed.ok) return requestFailure(parsed.code)

    let session: DisableSession
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
          purpose: "DISABLE_TWO_FACTOR",
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

    let result: Awaited<ReturnType<typeof disableTwoFactor>>
    try {
      result = await mutate({
        prismaClient,
        userId,
        primaryProof,
        twoFactorCode: parsed.body.twoFactorCode,
        networkIdentifier: authRequestNetworkIdentifier(request),
        confirmed: true,
        now,
      })
    } catch {
      return serviceFailure("CONFLICT")
    }
    if (result.status !== "DISABLED") return serviceFailure(result.code, result.retryAfterSeconds)

    clearCache(userId, "security")
    const response = NextResponse.json({ code: "TWO_FACTOR_DISABLED" }, { headers: noStoreJsonHeaders() })
    if (parsed.body.proofMethod === "GOOGLE") clearGoogleBindingCookie(response, secureCookies)
    return response
  }
}

export const POST = createTwoFactorDisableHandler({
  prismaClient: prisma,
  getSession: getCurrentSession,
  expectedSiteUrl: getSiteUrl(),
  parseRequest: parseTrustedAccountSecurityJson,
  secret: getAuthSecret(),
  resolveIntent: resolveBoundAuthMethodIntent,
  mutate: disableTwoFactor,
  clearCache: clearAccountSurfaceDataCache,
})
