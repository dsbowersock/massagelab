import type { Prisma, PrismaClient } from "@prisma/client"
import type { consumeEmailWorkRateLimit } from "./auth-rate-limit.ts"
import { resolveNormalizedUserId } from "./normalized-user-email.ts"
import { isUserEmailUniqueConstraint } from "./prisma-identity-unique-constraint.ts"

export type PublicAuthWorkResult =
  | { status: "ACCEPTED" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }

type RequiredLegalDocument = {
  key: string
  version: string
  shortLabel: string
}

type LegalMetadata = {
  ipAddress?: string | null
  userAgent?: string | null
}

type ExistingUser = Prisma.UserGetPayload<{
  include: { passwordCredential: true; accounts: { select: { provider: true } } }
}>
type RegistrationClient = Pick<PrismaClient, "$queryRaw" | "$transaction" | "authRateLimitBucket" | "user">

export type RegisterPasswordAccountInput = {
  prismaClient: RegistrationClient
  email: string
  password: string
  name: string
  callbackUrl: string
  networkIdentifier: string
  secret: string
  requiredDocuments: RequiredLegalDocument[]
  legalMetadata?: LegalMetadata
  now?: Date
  shouldPrune?: () => boolean
  consumeRateLimit: typeof consumeEmailWorkRateLimit
  hashPassword(password: string): Promise<string>
  verifyPassword(passwordHash: string, password: string): Promise<boolean>
  generateToken(): string
  hashToken(token: string): string
  tokenExpiresAt(minutes: number): Date
  ensureUserRole(userId: string, email: string | null, tx: Prisma.TransactionClient): Promise<unknown>
  recordLegalAcceptances(input: {
    prismaClient: Prisma.TransactionClient
    userId: string
    documents: RequiredLegalDocument[]
    metadata?: LegalMetadata
  }): Promise<unknown>
  sendVerification(email: string, token: string, callbackUrl: string): Promise<unknown>
  sendPasswordSetup(email: string, token: string, googleLinked: boolean): Promise<unknown>
  sendExistingAccountNotice(email: string): Promise<unknown>
  scheduleAccountWork(work: () => Promise<void>): void
}

/**
 * Performs bounded password registration without exposing account state.
 * Quota is consumed before every expensive or persistent operation, and all
 * accepted requests schedule exactly one post-response account-work task.
 */
export async function registerPasswordAccount(
  input: RegisterPasswordAccountInput,
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

  scheduleAccountWork(input, () => runRegistrationAccountWork(input, email, now))
  return { status: "ACCEPTED" }
}

async function runRegistrationAccountWork(
  input: RegisterPasswordAccountInput,
  email: string,
  now: Date,
): Promise<void> {
  const existing = await findAccount(input.prismaClient, email)
  if (existing) {
    await handleExistingAccount(input, existing, email, now)
    return
  }

  const passwordHash = await input.hashPassword(input.password)
  const verificationToken = input.generateToken()
  const verificationTokenHash = input.hashToken(verificationToken)

  try {
    await input.prismaClient.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: input.name,
          passwordCredential: { create: { passwordHash } },
          profile: { create: { displayName: input.name } },
          emailVerificationTokens: {
            create: {
              email,
              tokenHash: verificationTokenHash,
              expiresAt: input.tokenExpiresAt(24 * 60),
            },
          },
        },
      })
      await input.recordLegalAcceptances({
        prismaClient: tx,
        userId: user.id,
        documents: input.requiredDocuments,
        metadata: input.legalMetadata,
      })
      await input.ensureUserRole(user.id, user.email, tx)
    }, { isolationLevel: "Serializable" })
  } catch (error) {
    if (!isUserEmailUniqueConstraint(error)) throw error
    const racedAccount = await findAccount(input.prismaClient, email)
    if (!racedAccount) throw error
    await handleExistingAccount(input, racedAccount, email, now)
    return
  }

  await ignoreDeliveryFailure(() => input.sendVerification(email, verificationToken, input.callbackUrl))
}

async function handleExistingAccount(
  input: RegisterPasswordAccountInput,
  user: ExistingUser,
  normalizedEmail: string,
  now: Date,
): Promise<void> {
  const recipient = user.email ? normalizeEmail(user.email) : normalizedEmail

  if (!user.emailVerified && user.passwordCredential) {
    const passwordMatches = await input.verifyPassword(user.passwordCredential.passwordHash, input.password)
    if (!passwordMatches) return

    const token = input.generateToken()
    await input.prismaClient.$transaction(async (tx) => {
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          email: recipient,
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
      await input.recordLegalAcceptances({
        prismaClient: tx,
        userId: user.id,
        documents: input.requiredDocuments,
        metadata: input.legalMetadata,
      })
    }, { isolationLevel: "Serializable" })
    await ignoreDeliveryFailure(() => input.sendVerification(recipient, token, input.callbackUrl))
    return
  }

  if (user.emailVerified && user.passwordCredential) {
    await ignoreDeliveryFailure(() => input.sendExistingAccountNotice(recipient))
    return
  }

  if (user.emailVerified && !user.passwordCredential) {
    const token = input.generateToken()
    // Linked provider records select account-preserving setup copy for verified passwordless accounts.
    const googleLinked = user.accounts.some((account) => account.provider === "google")
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
    await ignoreDeliveryFailure(() => input.sendPasswordSetup(recipient, token, googleLinked))
  }
}

async function findAccount(prismaClient: RegistrationClient, email: string) {
  const userId = await resolveNormalizedUserId({ prismaClient, email })
  if (!userId) return null
  return prismaClient.user.findUnique({
    where: { id: userId },
    include: {
      passwordCredential: true,
      accounts: { select: { provider: true } },
    },
  })
}

function scheduleAccountWork(input: RegisterPasswordAccountInput, work: () => Promise<void>): void {
  try {
    input.scheduleAccountWork(() => sanitizeAccountWorkFailure(work, "Scheduled registration account work failed."))
  } catch {
    // Scheduling failure remains response-neutral and reveals no account state.
  }
}

async function sanitizeAccountWorkFailure(work: () => Promise<void>, safeMessage: string): Promise<void> {
  try {
    await work()
  } catch {
    throw new Error(safeMessage)
  }
}

async function ignoreDeliveryFailure(deliver: () => Promise<unknown>): Promise<void> {
  try {
    await deliver()
  } catch {
    // Recoverable account/token state is already committed. Provider details
    // and account identifiers must not influence the public response.
  }
}

function normalizeEmail(value: string): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function captureNow(value?: Date): Date {
  const now = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid registration time.")
  return now
}
