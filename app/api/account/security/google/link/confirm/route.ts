import { after, NextResponse } from "next/server"

import { getCurrentSession } from "@/auth"
import { deliverAccountSecurityEmailIntent } from "@/lib/account-security-email-intents"
import { confirmGoogleLink } from "@/lib/account-security-methods"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { getAuthSecret } from "@/lib/auth-env"
import { AUTH_METHOD_INTENT_COOKIE, resolveBoundAuthMethodIntent } from "@/lib/auth-method-intents"
import { prisma } from "@/lib/prisma"

const FRESH_PASSWORD_MS = 5 * 60 * 1000

type LinkSession = { user?: { id?: string | null } | null; lastPasswordAuthenticatedAt?: number } | null

/** Adapts a fresh browser-bound Credentials session to the transactional link owner. */
export function createGoogleLinkConfirmHandler({
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
  getSession: () => Promise<LinkSession>
  secret: string
  resolveIntent: typeof resolveBoundAuthMethodIntent
  mutate: typeof confirmGoogleLink
  scheduleAfter: typeof after
  deliver: typeof deliverAccountSecurityEmailIntent
  clock?: () => Date
  clearCache: (userId: string, surface: "security") => void
}) {
  return async function googleLinkConfirmHandler(request: Request) {
    const session = await getSession()
    const userId = typeof session?.user?.id === "string" ? session.user.id : ""
    if (!userId) return safeResponse("AUTHENTICATION_REQUIRED", "Sign in and try again.", 401)

    const body = await request.json().catch(() => null)
    if (!exactBody(body, ["confirmed"]) || body.confirmed !== true) {
      return safeResponse("INVALID_REQUEST", "Confirm this account change and try again.", 400)
    }
    const now = clock()
    if (!freshPasswordClaim(session?.lastPasswordAuthenticatedAt, now)) {
      return safeResponse("PROOF_EXPIRED", proofRecoveryMessage(), 403)
    }
    const intent = await resolveIntent({
      prismaClient,
      cookieValue: readCookie(request, AUTH_METHOD_INTENT_COOKIE),
      purpose: "SIGN_IN_OR_LINK",
      status: "PROVIDER_PROVEN",
      secret,
      now,
    })
    if (!intent || intent.targetUserId !== userId) {
      return safeResponse("PROOF_EXPIRED", proofRecoveryMessage(), 403)
    }

    const result = await mutate({
      prismaClient,
      intentId: intent.id,
      sessionUserId: userId,
      lastPasswordAuthenticatedAt: session?.lastPasswordAuthenticatedAt,
      confirmed: true,
      secret,
      now,
    })
    if (result.status === "REJECTED") return rejectedResponse(result.code)

    scheduleDelivery(scheduleAfter, deliver, prismaClient, result.emailIntentId)
    clearCache(userId, "security")
    const response = NextResponse.json({
      code: "GOOGLE_LINKED",
      message: "Google sign-in is now linked to this MassageLab account.",
      googleLinked: result.googleLinked,
      hasPasswordCredential: result.passwordEnabled,
    })
    clearBindingCookie(response)
    return response
  }
}

function freshPasswordClaim(value: unknown, now: Date) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isFinite(now.getTime())) return false
  const age = now.getTime() - value
  return age >= 0 && age <= FRESH_PASSWORD_MS
}

function exactBody(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const actual = Object.keys(value as Record<string, unknown>).sort()
  return actual.length === keys.length && keys.slice().sort().every((key, index) => actual[index] === key)
}

function readCookie(request: Request, name: string) {
  const prefix = `${name}=`
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? ""
}

function scheduleDelivery(scheduleAfter: typeof after, deliver: typeof deliverAccountSecurityEmailIntent, prismaClient: typeof prisma, intentId: string) {
  scheduleAfter(() => deliver({ prismaClient, intentId }).then(() => undefined).catch(() => undefined))
}

function proofRecoveryMessage() {
  return "This confirmation expired or belongs to another session. Start again with Google sign-in."
}

function rejectedResponse(code: string) {
  if (code === "CONFLICT" || code === "ALREADY_LINKED" || code === "LAST_METHOD") {
    return safeResponse(code, code === "ALREADY_LINKED" ? "Google sign-in is already linked." : "This sign-in method changed. Refresh and try again.", 409)
  }
  return safeResponse(code === "INTENT_EXPIRED" ? "PROOF_EXPIRED" : code, proofRecoveryMessage(), 403)
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

export const POST = createGoogleLinkConfirmHandler({
  prismaClient: prisma,
  getSession: getCurrentSession,
  secret: getAuthSecret(),
  resolveIntent: resolveBoundAuthMethodIntent,
  mutate: confirmGoogleLink,
  scheduleAfter: after,
  deliver: deliverAccountSecurityEmailIntent,
  clearCache: clearAccountSurfaceDataCache,
})
