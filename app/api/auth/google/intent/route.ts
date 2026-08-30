import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getAuthSecret } from "@/lib/auth-env"
import { consumeGoogleIntentStartRateLimit } from "@/lib/auth-rate-limit"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import {
  AUTH_METHOD_INTENT_COOKIE,
  serializeAuthMethodIntentBinding,
  startAuthMethodIntent,
  type GoogleIntentPurpose,
} from "@/lib/auth-method-intents"
import { buildRegistrationLegalProviderRedirectPath } from "@/lib/legal-acceptance-gate"
import { prisma } from "@/lib/prisma"

type IntentSession = { user?: { id?: string | null } | null } | null
type IntentHandlerDependencies = {
  prismaClient: typeof prisma
  secret: string
  getSession: () => Promise<IntentSession>
  consumeLimit?: typeof consumeGoogleIntentStartRateLimit
  startIntent?: typeof startAuthMethodIntent
  clock?: () => Date
}

/** Keeps rate-limit consumption ahead of every intent lookup, prune, or create. */
export function createGoogleIntentHandler({
  prismaClient,
  secret,
  getSession,
  consumeLimit = consumeGoogleIntentStartRateLimit,
  startIntent = startAuthMethodIntent,
  clock = () => new Date(),
}: IntentHandlerDependencies) {
  return async function googleIntentHandler(request: Request) {
    const body = await request.json().catch(() => ({})) as { purpose?: unknown; callbackUrl?: unknown }
    const purpose = googleIntentPurpose(body.purpose)
    if (!purpose) return NextResponse.json({ ok: false }, { status: 400 })

    const now = clock()
    const decision = await consumeLimit({
      prismaClient,
      networkIdentifier: authRequestNetworkIdentifier(request),
      secret,
      now,
    })
    if (!decision.allowed) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      )
    }

    let targetUserId: string | undefined
    let callbackUrl: string
    if (purpose === "SIGN_IN_OR_LINK") {
      callbackUrl = buildRegistrationLegalProviderRedirectPath(body.callbackUrl)
    } else {
      const session = await getSession()
      targetUserId = typeof session?.user?.id === "string" ? session.user.id : undefined
      if (!targetUserId) return NextResponse.json({ ok: false }, { status: 401 })
      // Security proofs always return to their owning surface, irrespective of
      // caller input, so the OAuth state cannot become an open redirect seam.
      callbackUrl = "/account?tab=security"
    }

    const intent = await startIntent({ prismaClient, purpose, targetUserId, secret, now })
    const response = NextResponse.json({ ok: true, callbackUrl })
    response.cookies.set(
      AUTH_METHOD_INTENT_COOKIE,
      serializeAuthMethodIntentBinding(intent.intentId, intent.browserBindingToken),
      {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 600,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    )
    return response
  }
}

function googleIntentPurpose(value: unknown): GoogleIntentPurpose | null {
  return value === "SIGN_IN_OR_LINK" || value === "LINK_GOOGLE" || value === "ADD_PASSWORD" || value === "REMOVE_PASSWORD"
    ? value
    : null
}

export const POST = createGoogleIntentHandler({
  prismaClient: prisma,
  secret: getAuthSecret(),
  getSession: getCurrentSession,
})
