import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  noStoreJsonHeaders,
  parseBoundedAccountSecurityJson,
  validateTrustedAccountSecurityJson,
} from "@/lib/account-security-request"
import { getAuthSecret, getSiteUrl } from "@/lib/auth-env"
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
  expectedSiteUrl?: string
  parseRequest?: typeof parseGoogleIntentRequest
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
  parseRequest = parseGoogleIntentRequest,
}: IntentHandlerDependencies) {
  return async function googleIntentHandler(request: Request) {
    const parsed = await parseRequest({ request, expectedSiteUrl })
    if (!parsed.ok) {
      return NextResponse.json({ ok: false }, {
        status: parsed.code === "UNTRUSTED_REQUEST" ? 403 : 400,
        headers: noStoreJsonHeaders(),
      })
    }
    const { body, purpose } = parsed

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

async function parseGoogleIntentRequest({
  request,
  expectedSiteUrl,
}: {
  request: Request
  expectedSiteUrl: string
}): Promise<
  | { ok: true; body: Record<string, unknown>; purpose: GoogleIntentPurpose }
  | { ok: false; code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST" }
> {
  const bounded = await parseBoundedAccountSecurityJson({ request })
  if (!bounded.ok) return bounded

  const purpose = googleIntentPurpose(bounded.body.purpose)
  if (!purpose) return { ok: false, code: "INVALID_REQUEST" }
  if (purpose !== "LINK_GOOGLE") return { ok: true, body: bounded.body, purpose }

  const trusted = validateTrustedAccountSecurityJson({
    request,
    expectedSiteUrl,
    body: bounded.body,
    allowedKeys: ["purpose"],
  })
  if (!trusted.ok) return trusted
  if (trusted.body.purpose !== "LINK_GOOGLE") return { ok: false, code: "INVALID_REQUEST" }
  return { ok: true, body: trusted.body, purpose }
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
  expectedSiteUrl: getSiteUrl(),
  parseRequest: parseGoogleIntentRequest,
})
