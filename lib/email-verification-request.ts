import type { PrismaClient } from "@prisma/client"
import type { consumeEmailWorkRateLimit } from "./auth-rate-limit.ts"
import type { PublicAuthWorkResult } from "./auth-registration-service.ts"
import { resolveNormalizedUserId } from "./normalized-user-email.ts"

type VerificationClient = Pick<PrismaClient, "$queryRaw" | "$transaction" | "authRateLimitBucket" | "user">

export type RequestEmailVerificationInput = {
  prismaClient: VerificationClient
  email: string
  callbackUrl: string
  networkIdentifier: string
  secret: string
  now?: Date
  shouldPrune?: () => boolean
  consumeRateLimit: typeof consumeEmailWorkRateLimit
  generateToken(): string
  hashToken(token: string): string
  tokenExpiresAt(minutes: number): Date
  sendVerification(email: string, token: string, callbackUrl: string): Promise<unknown>
  scheduleAccountWork(work: () => Promise<void>): void
}

/**
 * Requests a replacement verification message without exposing account state.
 * The existing registration ACCOUNT and NETWORK buckets are charged before
 * one post-response task owns lookup, token persistence, and mail delivery.
 */
export async function requestEmailVerification(
  input: RequestEmailVerificationInput,
): Promise<PublicAuthWorkResult> {
  const email = normalizeEmail(input.email)
  const now = captureNow(input.now)
  const rateLimit = await input.consumeRateLimit({
    prismaClient: input.prismaClient,
    purpose: "REGISTER",
    email,
    networkIdentifier: input.networkIdentifier,
    secret: input.secret,
    now,
    shouldPrune: input.shouldPrune,
  })
  if (!rateLimit.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: rateLimit.retryAfterSeconds }
  }

  scheduleAccountWork(input, () => runEmailVerificationAccountWork(input, email, now))
  return { status: "ACCEPTED" }
}

async function runEmailVerificationAccountWork(
  input: RequestEmailVerificationInput,
  email: string,
  now: Date,
): Promise<void> {
  const userId = await resolveNormalizedUserId({ prismaClient: input.prismaClient, email })
  const user = userId ? await input.prismaClient.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true },
  }) : null
  if (!user || user.emailVerified || !user.email) return

  const recipientEmail = normalizeEmail(user.email)
  const token = input.generateToken()
  await input.prismaClient.$transaction(async (tx) => {
    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        email: recipientEmail,
        tokenHash: input.hashToken(token),
        expiresAt: input.tokenExpiresAt(24 * 60),
      },
    })
    await tx.emailVerificationToken.deleteMany({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { lt: now },
      },
    })
  }, { isolationLevel: "Serializable" })

  try {
    await input.sendVerification(recipientEmail, token, input.callbackUrl)
  } catch {
    // The committed token remains usable; account and provider details stay private.
  }
}

function scheduleAccountWork(input: RequestEmailVerificationInput, work: () => Promise<void>): void {
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
    throw new Error("Scheduled email-verification account work failed.")
  }
}

function normalizeEmail(value: string): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function captureNow(value?: Date): Date {
  const now = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid email-verification request time.")
  return now
}
