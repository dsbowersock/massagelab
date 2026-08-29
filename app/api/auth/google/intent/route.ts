import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { noStoreJsonHeaders, parseTrustedAccountSecurityJson } from "@/lib/account-security-request"
import { getAuthSecret, getSiteUrl } from "@/lib/auth-env"
import { consumeGoogleIntentStartRateLimit } from "@/lib/auth-rate-limit"
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
  expectedSiteUrl?: string
  parseRequest?: typeof parseTrustedAccountSecurityJson
}

/**
 * Keeps rate limiting ahead of intent persistence while requiring the reserved
 * LINK_GOOGLE security proof to cross the same-origin JSON boundary first.
 */
export function createGoogleIntentHandler({
  prismaClient,
  secret,
  getSession,
  consumeLimit = consumeGoogleIntentStartRateLimit,
  startIntent = startAuthMethodIntent,
  clock = () => new Date(),
  expectedSiteUrl = getSiteUrl(),
  parseRequest = parseTrustedAccountSecurityJson,
}: IntentHandlerDependencies) {
  return async function googleIntentHandler(request: Request) {
    let body = await request.clone().json().catch(() => ({})) as { purpose?: unknown; callbackUrl?: unknown }
    const purpose = googleIntentPurpose(body.purpose)
    if (!purpose) return NextResponse.json({ ok: false }, { status: 400 })

    if (purpose === "LINK_GOOGLE") {
      const parsed = await parseRequest({
        request,
        expectedSiteUrl,
        allowedKeys: ["purpose"],
      })
      if (!parsed.ok) {
        return NextResponse.json({ ok: false }, {
          status: parsed.code === "UNTRUSTED_REQUEST" ? 403 : 400,
          headers: noStoreJsonHeaders(),
        })
      }
      if (parsed.body.purpose !== "LINK_GOOGLE") {
        return NextResponse.json({ ok: false }, { status: 400, headers: noStoreJsonHeaders() })
      }
      body = parsed.body
    }

    const now = clock()
    const decision = await consumeLimit({
      prismaClient,
      networkIdentifier: requestIp(request),
      secret,
      now,
    })
    if (!decision.allowed) {
      return NextResponse.json(
        { ok: false },
        {
          status: 429,
          headers: {
            ...(purpose === "LINK_GOOGLE" ? noStoreJsonHeaders() : {}),
            "Retry-After": String(decision.retryAfterSeconds),
          },
        },
      )
    }

    let targetUserId: string | undefined
    let callbackUrl: string
    if (purpose === "SIGN_IN_OR_LINK") {
      callbackUrl = buildRegistrationLegalProviderRedirectPath(body.callbackUrl)
    } else {
      const session = await getSession()
      targetUserId = typeof session?.user?.id === "string" ? session.user.id : undefined
      if (!targetUserId) {
        return NextResponse.json({ ok: false }, {
          status: 401,
          headers: purpose === "LINK_GOOGLE" ? noStoreJsonHeaders() : undefined,
        })
      }
      // Security proofs always return to their owning surface, irrespective of
      // caller input, so the OAuth state cannot become an open redirect seam.
      callbackUrl = "/account?tab=security"
    }

    const intent = await startIntent({ prismaClient, purpose, targetUserId, secret, now })
    const response = NextResponse.json(
      { ok: true, callbackUrl },
      purpose === "LINK_GOOGLE" ? { headers: noStoreJsonHeaders() } : undefined,
    )
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

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
}

export const POST = createGoogleIntentHandler({
  prismaClient: prisma,
  secret: getAuthSecret(),
  getSession: getCurrentSession,
  expectedSiteUrl: getSiteUrl(),
  parseRequest: parseTrustedAccountSecurityJson,
})
