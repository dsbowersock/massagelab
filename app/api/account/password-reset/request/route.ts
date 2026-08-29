import { NextResponse } from "next/server"
import { getAuthSecret } from "@/lib/auth-env"
import { sendPasswordResetEmail } from "@/lib/auth-mail"
import { consumeEmailWorkRateLimit } from "@/lib/auth-rate-limit"
import { generateRandomToken, hashToken, normalizeEmail, tokenExpiresIn } from "@/lib/auth-security"
import { PUBLIC_ACCOUNT_ENTRY_MESSAGE } from "@/lib/auth-registration-service"
import { requestPasswordReset } from "@/lib/password-reset-request"
import { prisma } from "@/lib/prisma"

const RATE_LIMIT_MESSAGE = "Too many requests. Please try again later."

type PasswordResetRequestDependencies = {
  prismaClient: typeof prisma
  secret: string
  clock?: () => Date
  shouldPrune?: () => boolean
  resetWork?: typeof requestPasswordReset
}

/** Builds the thin HTTP adapter while keeping service ordering testable. */
export function createPasswordResetRequestHandler({
  prismaClient,
  secret,
  clock = () => new Date(),
  shouldPrune,
  resetWork = requestPasswordReset,
}: PasswordResetRequestDependencies) {
  return async function passwordResetRequestHandler(request: Request) {
    const body = await request.json().catch(() => ({}))
    const email = normalizeEmail(body.email)
    if (!validPublicEmail(email)) {
      return NextResponse.json({ message: PUBLIC_ACCOUNT_ENTRY_MESSAGE }, { status: 202 })
    }

    const result = await resetWork({
      prismaClient,
      email,
      networkIdentifier: requestIp(request),
      secret,
      now: clock(),
      shouldPrune,
      consumeRateLimit: consumeEmailWorkRateLimit,
      generateToken: generateRandomToken,
      hashToken,
      tokenExpiresAt: tokenExpiresIn,
      sendPasswordReset: sendPasswordResetEmail,
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

function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
}

function validPublicEmail(email: string): boolean {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const POST = createPasswordResetRequestHandler({
  prismaClient: prisma,
  secret: getAuthSecret(),
})
