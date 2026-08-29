import type { PrismaClient } from "@prisma/client"
import type { consumeEmailWorkRateLimit } from "./auth-rate-limit.ts"
import type { PublicAuthWorkResult } from "./auth-registration-service.ts"

type ResetClient = Pick<PrismaClient, "$transaction" | "authRateLimitBucket" | "user">

export type RequestPasswordResetInput = {
  prismaClient: ResetClient
  email: string
  networkIdentifier: string
  secret: string
  now?: Date
  shouldPrune?: () => boolean
  consumeRateLimit: typeof consumeEmailWorkRateLimit
  generateToken(): string
  hashToken(token: string): string
  tokenExpiresAt(minutes: number): Date
  sendPasswordReset(email: string, token: string): Promise<unknown>
}

/**
 * Requests password recovery without revealing whether the normalized account
 * exists. Both privacy-safe buckets are consumed before any account or token
 * access, and provider failure leaves the committed token recoverable.
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput,
): Promise<PublicAuthWorkResult> {
  const email = normalizeEmail(input.email)
  const now = captureNow(input.now)
  const rateLimit = await input.consumeRateLimit({
    prismaClient: input.prismaClient,
    purpose: "PASSWORD_RESET",
    email,
    networkIdentifier: input.networkIdentifier,
    secret: input.secret,
    now,
    shouldPrune: input.shouldPrune,
  })
  if (!rateLimit.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: rateLimit.retryAfterSeconds }
  }

  const user = await input.prismaClient.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true },
  })
  if (!user?.emailVerified || !user.email) return { status: "ACCEPTED" }

  const token = input.generateToken()
  await input.prismaClient.$transaction(async (tx) => {
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: input.hashToken(token),
        expiresAt: input.tokenExpiresAt(60),
      },
    })
    await tx.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: now },
      },
    })
  }, { isolationLevel: "Serializable" })

  try {
    await input.sendPasswordReset(normalizeEmail(user.email), token)
  } catch {
    // The token remains usable; provider details and existence never escape.
  }
  return { status: "ACCEPTED" }
}

function normalizeEmail(value: string): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function captureNow(value?: Date): Date {
  const now = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid password-reset time.")
  return now
}
