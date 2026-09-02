import { after, NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import { deliverAccountSecurityEmailIntent } from "@/lib/account-security-email-intents"
import { removeGoogleMethod } from "@/lib/account-security-methods"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { prisma } from "@/lib/prisma"

type MethodSession = { user?: { id?: string | null } | null } | null

/** Proves a destructive Google removal before delegating its single mutation. */
export function createGoogleUnlinkHandler({
  prismaClient,
  getSession,
  mutate,
  scheduleAfter,
  deliver,
  clock = () => new Date(),
  clearCache,
}: {
  prismaClient: typeof prisma
  getSession: () => Promise<MethodSession>
  mutate: typeof removeGoogleMethod
  scheduleAfter: typeof after
  deliver: typeof deliverAccountSecurityEmailIntent
  clock?: () => Date
  clearCache: (userId: string, surface: "security") => void
}) {
  return async function googleUnlinkHandler(request: Request) {
    const session = await getSession()
    const userId = typeof session?.user?.id === "string" ? session.user.id : ""
    if (!userId) return safeResponse("AUTHENTICATION_REQUIRED", "Sign in and try again.", 401)

    const body = await request.json().catch(() => null)
    if (!validUnlinkBody(body)) {
      return safeResponse("INVALID_REQUEST", "Enter your password, confirm the change, and try again.", 400)
    }
    const result = await mutate({
      prismaClient,
      userId,
      password: body.password,
      twoFactorCode: body.twoFactorCode,
      networkIdentifier: authRequestNetworkIdentifier(request),
      confirmed: true,
      now: clock(),
    })
    if (result.status === "REJECTED") {
      return rejectedResponse(result.code, result.code === "RATE_LIMITED" ? result.retryAfterSeconds : undefined)
    }

    scheduleAfter(() => deliver({ prismaClient, intentId: result.emailIntentId }).then(() => undefined).catch(() => undefined))
    clearCache(userId, "security")
    return NextResponse.json({
      code: "GOOGLE_UNLINKED",
      message: "Google sign-in was removed. Your password sign-in remains available.",
      googleLinked: result.googleLinked,
      hasPasswordCredential: result.passwordEnabled,
    })
  }
}

function validUnlinkBody(value: unknown): value is { password: string; twoFactorCode?: string; confirmed: true } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const body = value as Record<string, unknown>
  const keys = Object.keys(body)
  if (!keys.every((key) => key === "password" || key === "twoFactorCode" || key === "confirmed")) return false
  return keys.includes("password")
    && keys.includes("confirmed")
    && typeof body.password === "string"
    && body.password.length > 0
    && body.password.length <= 1024
    && (body.twoFactorCode === undefined || (typeof body.twoFactorCode === "string" && body.twoFactorCode.length <= 128))
    && body.confirmed === true
}

function rejectedResponse(code: string, retryAfterSeconds?: number) {
  if (code === "RATE_LIMITED") {
    return safeResponse(code, "Too many attempts. Wait a little, then try again.", 429, {
      "Retry-After": retryAfterHeader(retryAfterSeconds),
    })
  }
  if (code === "LAST_METHOD") {
    return safeResponse("LAST_METHOD", "Add a password before removing Google so you keep a way to sign in.", 409)
  }
  if (code === "CONFLICT" || code === "ALREADY_LINKED") {
    return safeResponse(code, "Your sign-in methods changed. Refresh and try again.", 409)
  }
  const message = code === "TWO_FACTOR_REQUIRED"
    ? "Enter your authenticator or backup code."
    : code === "TWO_FACTOR_INVALID"
      ? "The authenticator or backup code was not accepted."
      : "Your password proof was not accepted. Try again."
  return safeResponse(code, message, 403)
}

function safeResponse(code: string, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ code, message }, { status, headers })
}

function retryAfterHeader(value?: number) {
  return String(Number.isSafeInteger(value) && (value ?? 0) > 0 ? Math.min(value ?? 1, 900) : 1)
}

export const POST = createGoogleUnlinkHandler({
  prismaClient: prisma,
  getSession: getCurrentSession,
  mutate: removeGoogleMethod,
  scheduleAfter: after,
  deliver: deliverAccountSecurityEmailIntent,
  clearCache: clearAccountSurfaceDataCache,
})
