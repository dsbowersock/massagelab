import type { PrismaClient } from "@prisma/client"
import type { consumeEmailWorkRateLimit } from "./auth-rate-limit.ts"
import type { PublicAuthWorkResult } from "./auth-registration-service.ts"
import { resolveNormalizedUserId } from "./normalized-user-email.ts"

type ResetClient = Pick<PrismaClient, "$queryRaw" | "$transaction" | "authRateLimitBucket" | "user">

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
  scheduleAccountWork(work: () => Promise<void>): void
}

/**
 * Requests password recovery without revealing whether the normalized account
 * exists. Both privacy-safe buckets are consumed before any account or token
 * access. Accepted requests schedule one post-response task that owns lookup,
 * token persistence, cleanup, and provider delivery.
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

  scheduleAccountWork(input, () => runPasswordResetAccountWork(input, email, now))
  return { status: "ACCEPTED" }
}

async function runPasswordResetAccountWork(
  input: RequestPasswordResetInput,
  email: string,
  now: Date,
): Promise<void> {
  const userId = await resolveNormalizedUserId({ prismaClient: input.prismaClient, email })
  const user = userId ? await input.prismaClient.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true },
  }) : null
  if (!user?.emailVerified || !user.email) return
  const recipientEmail = normalizeEmail(user.email)

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
    await input.sendPasswordReset(recipientEmail, token)
  } catch {
    // The committed token remains usable; provider details never escape.
  }
}

function scheduleAccountWork(input: RequestPasswordResetInput, work: () => Promise<void>): void {
  try {
    input.scheduleAccountWork(() => sanitizeAccountWorkFailure(work))
  } catch {
    // Scheduling failure remains response-neutral and reveals no account state.
  }
}

async function sanitizeAccountWorkFailure(work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch {
    throw new Error("Scheduled password-reset account work failed.")
  }
}

function normalizeEmail(value: string): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function captureNow(value?: Date): Date {
  const now = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid password-reset time.")
  return now
}
