import { NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import {
  noStoreJsonHeaders,
  parseTrustedAccountSecurityJson,
} from "@/lib/account-security-request"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { regenerateBackupCodes } from "@/lib/account-two-factor-management"
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

type RegenerateSession = { user?: { id?: string | null } | null } | null
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
          purpose: "REGENERATE_TWO_FACTOR_BACKUP_CODES",
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
        networkIdentifier: authRequestNetworkIdentifier(request),
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
