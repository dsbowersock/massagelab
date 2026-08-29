import { after, NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import { deliverAccountSecurityEmailIntent } from "@/lib/account-security-email-intents"
import { setPasswordMethod } from "@/lib/account-security-methods"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { getAuthSecret } from "@/lib/auth-env"
import { AUTH_METHOD_INTENT_COOKIE, resolveBoundAuthMethodIntent } from "@/lib/auth-method-intents"
import { hashPassword } from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"

type MethodSession = { user?: { id?: string | null } | null } | null
type PasswordBody = {
  mode: "ADD" | "CHANGE"
  newPassword: string
  currentPassword?: string
  twoFactorCode?: string
  confirmed: true
}

/** Validates password-method input and delegates one ADD or CHANGE mutation. */
export function createPasswordMethodHandler({
  prismaClient,
  getSession,
  secret,
  resolveIntent,
  mutate,
  scheduleAfter,
  deliver,
  hashPassword: hash,
  clock = () => new Date(),
  clearCache,
}: {
  prismaClient: typeof prisma
  getSession: () => Promise<MethodSession>
  secret: string
  resolveIntent: typeof resolveBoundAuthMethodIntent
  mutate: typeof setPasswordMethod
  scheduleAfter: typeof after
  deliver: typeof deliverAccountSecurityEmailIntent
  hashPassword: typeof hashPassword
  clock?: () => Date
  clearCache: (userId: string, surface: "security") => void
}) {
  return async function passwordMethodHandler(request: Request) {
    const session = await getSession()
    const userId = typeof session?.user?.id === "string" ? session.user.id : ""
    if (!userId) return safeResponse("AUTHENTICATION_REQUIRED", "Sign in and try again.", 401)

    const body = await request.json().catch(() => null)
    if (!validPasswordBody(body)) {
      return safeResponse("INVALID_REQUEST", "Check the password fields, confirm the change, and try again.", 400)
    }
    const now = clock()
    let intentId: string | undefined
    if (body.mode === "ADD") {
      const intent = await resolveIntent({
        prismaClient,
        cookieValue: readCookie(request, AUTH_METHOD_INTENT_COOKIE),
        purpose: "ADD_PASSWORD",
        status: "CONSUMED",
        secret,
        now,
      })
      if (!intent || intent.targetUserId !== userId) {
        return safeResponse("PROOF_EXPIRED", proofRecoveryMessage(), 403)
      }
      intentId = intent.id
    }

    const result = await mutate({
      prismaClient,
      userId,
      mode: body.mode,
      googleReauthPreflight: intentId ? { intentId, targetUserId: userId } : undefined,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      twoFactorCode: body.twoFactorCode,
      networkIdentifier: requestIp(request),
      confirmed: true,
      now,
      hashPasswordFn: hash,
    })
    if (result.status === "REJECTED") return rejectedResponse(result.code)

    scheduleAfter(() => deliver({ prismaClient, intentId: result.emailIntentId }).then(() => undefined).catch(() => undefined))
    clearCache(userId, "security")
    const response = NextResponse.json({
      code: body.mode === "ADD" ? "PASSWORD_ENABLED" : "PASSWORD_CHANGED",
      message: body.mode === "ADD" ? "Password sign-in is now enabled." : "Your password was changed.",
      googleLinked: result.googleLinked,
      hasPasswordCredential: result.passwordEnabled,
    })
    if (body.mode === "ADD") clearBindingCookie(response)
    return response
  }
}

function validPasswordBody(value: unknown): value is PasswordBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const body = value as Record<string, unknown>
  if (body.mode !== "ADD" && body.mode !== "CHANGE") return false
  const allowed = body.mode === "ADD"
    ? new Set(["mode", "newPassword", "confirmed"])
    : new Set(["mode", "newPassword", "currentPassword", "twoFactorCode", "confirmed"])
  const keys = Object.keys(body)
  if (!keys.every((key) => allowed.has(key))) return false
  if (typeof body.newPassword !== "string" || body.newPassword.length < 12 || body.newPassword.length > 1024 || body.confirmed !== true) return false
  if (body.mode === "CHANGE" && (typeof body.currentPassword !== "string" || body.currentPassword.length === 0 || body.currentPassword.length > 1024)) return false
  return body.twoFactorCode === undefined || (typeof body.twoFactorCode === "string" && body.twoFactorCode.length <= 128)
}

function rejectedResponse(code: string) {
  if (code === "CONFLICT" || code === "ALREADY_LINKED" || code === "LAST_METHOD") {
    return safeResponse(code, "Your sign-in methods changed. Refresh and try again.", 409)
  }
  if (code === "INTENT_EXPIRED") return safeResponse("PROOF_EXPIRED", proofRecoveryMessage(), 403)
  const message = code === "TWO_FACTOR_REQUIRED"
    ? "Enter your authenticator or backup code."
    : code === "TWO_FACTOR_INVALID"
      ? "The authenticator or backup code was not accepted."
      : "Your current password proof was not accepted."
  return safeResponse(code, message, 403)
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

export const POST = createPasswordMethodHandler({
  prismaClient: prisma,
  getSession: getCurrentSession,
  secret: getAuthSecret(),
  resolveIntent: resolveBoundAuthMethodIntent,
  mutate: setPasswordMethod,
  scheduleAfter: after,
  deliver: deliverAccountSecurityEmailIntent,
  hashPassword,
  clearCache: clearAccountSurfaceDataCache,
})
