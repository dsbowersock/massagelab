import { after, NextResponse } from "next/server"
import { getAuthSecret } from "@/lib/auth-env"
import { sendVerificationEmail } from "@/lib/auth-mail"
import { consumeEmailWorkRateLimit } from "@/lib/auth-rate-limit"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import { sendRegistrationVerification } from "@/lib/auth-registration"
import { PUBLIC_ACCOUNT_ENTRY_MESSAGE } from "@/lib/auth-entry-messages"
import { generateRandomToken, hashToken, normalizeEmail, tokenExpiresIn } from "@/lib/auth-security"
import { requestEmailVerification } from "@/lib/email-verification-request"
import { safePostLegalAcceptanceCallback } from "@/lib/legal-acceptance-gate"
import { prisma } from "@/lib/prisma"

const RATE_LIMIT_MESSAGE = "Too many requests. Please try again later."

type EmailVerificationRequestDependencies = {
  prismaClient: typeof prisma
  secret: string
  clock?: () => Date
  shouldPrune?: () => boolean
  verificationWork?: typeof requestEmailVerification
}

/** Builds the thin HTTP adapter while preserving response-before-account-work ordering. */
export function createEmailVerificationRequestHandler({
  prismaClient,
  secret,
  clock = () => new Date(),
  shouldPrune,
  verificationWork = requestEmailVerification,
}: EmailVerificationRequestDependencies) {
  return async function emailVerificationRequestHandler(request: Request) {
    const body = await request.json().catch(() => null)
    if (!isRequestBody(body)) {
      return NextResponse.json({ message: PUBLIC_ACCOUNT_ENTRY_MESSAGE }, { status: 202 })
    }
    const email = normalizeEmail(body.email)
    if (!validPublicEmail(email)) {
      return NextResponse.json({ message: PUBLIC_ACCOUNT_ENTRY_MESSAGE }, { status: 202 })
    }

    const result = await verificationWork({
      prismaClient,
      email,
      callbackUrl: safePostLegalAcceptanceCallback(body.callbackUrl),
      // Keep trusted-edge precedence in the shared request boundary; routes must not parse proxy headers independently.
      networkIdentifier: authRequestNetworkIdentifier(request),
      secret,
      now: clock(),
      shouldPrune,
      consumeRateLimit: consumeEmailWorkRateLimit,
      generateToken: generateRandomToken,
      hashToken,
      tokenExpiresAt: tokenExpiresIn,
      sendVerification: (recipient, token, callbackUrl) => (
        sendRegistrationVerification(sendVerificationEmail, recipient, token, callbackUrl)
      ),
      scheduleAccountWork: (work) => after(work),
    })
    if (result.status === "RATE_LIMITED") {
      return NextResponse.json(
        { message: RATE_LIMIT_MESSAGE },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
      )
    }
    return NextResponse.json({ message: PUBLIC_ACCOUNT_ENTRY_MESSAGE }, { status: 202 })
  }
}

/** Rejects JSON primitives and arrays before reading public request fields. */
function isRequestBody(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validPublicEmail(email: string): boolean {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const POST = createEmailVerificationRequestHandler({
  prismaClient: prisma,
  secret: getAuthSecret(),
})
