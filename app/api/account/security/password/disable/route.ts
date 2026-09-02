import { after, NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import { deliverAccountSecurityEmailIntent } from "@/lib/account-security-email-intents"
import { removePasswordMethod } from "@/lib/account-security-methods"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { getAuthSecret } from "@/lib/auth-env"
import { AUTH_METHOD_INTENT_COOKIE, resolveBoundAuthMethodIntent } from "@/lib/auth-method-intents"
import { prisma } from "@/lib/prisma"

type MethodSession = { user?: { id?: string | null } | null } | null

/** Consumes one recent cookie-bound Google proof before password removal. */
export function createPasswordDisableHandler({
  prismaClient,
  getSession,
  secret,
  resolveIntent,
  mutate,
  scheduleAfter,
  deliver,
  clock = () => new Date(),
  clearCache,
}: {
  prismaClient: typeof prisma
  getSession: () => Promise<MethodSession>
  secret: string
  resolveIntent: typeof resolveBoundAuthMethodIntent
  mutate: typeof removePasswordMethod
  scheduleAfter: typeof after
  deliver: typeof deliverAccountSecurityEmailIntent
  clock?: () => Date
  clearCache: (userId: string, surface: "security") => void
}) {
  return async function passwordDisableHandler(request: Request) {
    const session = await getSession()
    const userId = typeof session?.user?.id === "string" ? session.user.id : ""
    if (!userId) return safeResponse("AUTHENTICATION_REQUIRED", "Sign in and try again.", 401)

    const body = await request.json().catch(() => null)
    if (!exactConfirmation(body)) {
      return safeResponse("INVALID_REQUEST", "Confirm this account change and try again.", 400)
    }
    const now = clock()
    const intent = await resolveIntent({
      prismaClient,
      cookieValue: readCookie(request, AUTH_METHOD_INTENT_COOKIE),
      purpose: "REMOVE_PASSWORD",
      status: "CONSUMED",
      secret,
      now,
    })
    if (!intent || intent.targetUserId !== userId) {
      return safeResponse("PROOF_EXPIRED", proofRecoveryMessage(), 403)
    }
    const result = await mutate({ prismaClient, userId, intentId: intent.id, confirmed: true, now })
    if (result.status === "REJECTED") return rejectedResponse(result.code)

    scheduleAfter(() => deliver({ prismaClient, intentId: result.emailIntentId }).then(() => undefined).catch(() => undefined))
    clearCache(userId, "security")
    const response = NextResponse.json({
      code: "PASSWORD_DISABLED",
      message: "Password sign-in was disabled. Google sign-in remains available.",
      googleLinked: result.googleLinked,
      hasPasswordCredential: result.passwordEnabled,
    })
    clearBindingCookie(response)
    return response
  }
}

function exactConfirmation(value: unknown): value is { confirmed: true } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).length === 1
    && (value as Record<string, unknown>).confirmed === true)
}

function rejectedResponse(code: string) {
  if (code === "LAST_METHOD" || code === "CONFLICT" || code === "ALREADY_LINKED") {
    return safeResponse(code, code === "LAST_METHOD" ? "Keep at least one sign-in method on your account." : "Your sign-in methods changed. Refresh and try again.", 409)
  }
  return safeResponse(code === "INTENT_EXPIRED" ? "PROOF_EXPIRED" : code, proofRecoveryMessage(), 403)
}

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? ""
}

function proofRecoveryMessage() {
  return "This Google confirmation expired or belongs to another session. Start again."
}

function safeResponse(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status })
}

function clearBindingCookie(response: ReturnType<typeof NextResponse.json>) {
  response.cookies.set(AUTH_METHOD_INTENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
}

export const POST = createPasswordDisableHandler({
  prismaClient: prisma,
  getSession: getCurrentSession,
  secret: getAuthSecret(),
  resolveIntent: resolveBoundAuthMethodIntent,
  mutate: removePasswordMethod,
  scheduleAfter: after,
  deliver: deliverAccountSecurityEmailIntent,
  clearCache: clearAccountSurfaceDataCache,
})
