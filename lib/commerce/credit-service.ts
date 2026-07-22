import type { Prisma, PrismaClient } from "@prisma/client"
import { runCommerceTransaction } from "./transactions.ts"

export const INITIAL_BACKGROUND_CREDIT_COUNT = 2

export type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient

const INITIAL_GRANT_REASON = "VERIFIED_ACCOUNT_INITIAL_GRANT"
const INITIAL_PROVISIONING_ATTEMPTS = 2

class BackgroundCreditReconciliationError extends Error {
  constructor() {
    super("Background credit wallet requires reconciliation.")
    this.name = "BackgroundCreditReconciliationError"
  }
}

class BackgroundCreditProvisioningConflictError extends Error {
  readonly code = "P2034"

  constructor() {
    super("Background credit provisioning conflicted with another transaction.")
    this.name = "BackgroundCreditProvisioningConflictError"
  }
}

function collectConstraintTokens(value: unknown, depth = 0): string[] {
  if (depth > 4) return []
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap((entry) => collectConstraintTokens(entry, depth + 1))
  if (!value || typeof value !== "object") return []

  return Object.values(value).flatMap((entry) => collectConstraintTokens(entry, depth + 1))
}

/** Limits P2002 recovery to the two uniqueness constraints that identify the same per-user grant. */
function isInitialProvisioningUniqueConflict(
  error: unknown,
  expectedModel: "BackgroundCreditWallet" | "BackgroundCreditEntry",
  expectedField: "userId" | "idempotencyKey",
  expectedConstraint: string,
) {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "P2002") {
    return false
  }

  const meta = (error as { meta?: unknown }).meta
  if (!meta || typeof meta !== "object") return false

  const modelName = (meta as { modelName?: unknown }).modelName
  if (typeof modelName === "string" && modelName !== expectedModel) return false

  const tokens = collectConstraintTokens(meta)
  return tokens.includes(expectedField) || tokens.includes(expectedConstraint)
}

function retryInitialProvisioningConflict(
  error: unknown,
  model: "BackgroundCreditWallet" | "BackgroundCreditEntry",
  field: "userId" | "idempotencyKey",
  constraint: string,
): never {
  if (isInitialProvisioningUniqueConflict(error, model, field, constraint)) {
    // P2034 is the transaction helper's bounded whole-transaction retry signal.
    throw new BackgroundCreditProvisioningConflictError()
  }

  throw error
}

function initialGrantIdempotencyKey(userId: string) {
  return `background-credit:initial-grant:${userId}`
}

function assertMatchingInitialGrant(
  wallet: { id: string; userId: string },
  entry: {
    walletId: string
    userId: string
    type: string
    delta: number
    balanceAfter: number
    idempotencyKey: string
  } | null,
  userId: string,
) {
  if (
    !entry
    || wallet.userId !== userId
    || entry.walletId !== wallet.id
    || entry.userId !== userId
    || entry.type !== "INITIAL_GRANT"
    || entry.delta !== INITIAL_BACKGROUND_CREDIT_COUNT
    || entry.balanceAfter !== INITIAL_BACKGROUND_CREDIT_COUNT
    || entry.idempotencyKey !== initialGrantIdempotencyKey(userId)
  ) {
    throw new BackgroundCreditReconciliationError()
  }
}

/**
 * Provisions the verified-account grant using only database work.
 * Existing wallets must retain a matching immutable initial ledger entry; an
 * inconsistent wallet fails closed so later commerce writes cannot hide drift.
 */
async function provisionVerifiedUserBackgroundCredits(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  })

  if (!user?.emailVerified) {
    return { balance: 0, granted: false }
  }

  const idempotencyKey = initialGrantIdempotencyKey(userId)
  const [wallet, initialEntry] = await Promise.all([
    tx.backgroundCreditWallet.findUnique({ where: { userId } }),
    tx.backgroundCreditEntry.findUnique({ where: { idempotencyKey } }),
  ])

  if (wallet) {
    assertMatchingInitialGrant(wallet, initialEntry, userId)
    return { balance: wallet.balance, granted: false }
  }

  if (initialEntry) {
    throw new BackgroundCreditReconciliationError()
  }

  const createdWallet = await tx.backgroundCreditWallet.create({
    data: {
      userId,
      balance: INITIAL_BACKGROUND_CREDIT_COUNT,
    },
  }).catch((error) => retryInitialProvisioningConflict(
    error,
    "BackgroundCreditWallet",
    "userId",
    "BackgroundCreditWallet_userId_key",
  ))

  await tx.backgroundCreditEntry.create({
    data: {
      walletId: createdWallet.id,
      userId,
      type: "INITIAL_GRANT",
      delta: INITIAL_BACKGROUND_CREDIT_COUNT,
      balanceAfter: INITIAL_BACKGROUND_CREDIT_COUNT,
      idempotencyKey,
      reasonCode: INITIAL_GRANT_REASON,
    },
  }).catch((error) => retryInitialProvisioningConflict(
    error,
    "BackgroundCreditEntry",
    "idempotencyKey",
    "BackgroundCreditEntry_idempotencyKey_key",
  ))

  await tx.commerceEvent.create({
    data: {
      userId,
      eventType: "BACKGROUND_CREDITS_INITIAL_GRANTED",
      source: "account_verification",
      actorType: "SYSTEM",
      reasonCode: INITIAL_GRANT_REASON,
      aggregateType: "BackgroundCreditWallet",
      aggregateId: createdWallet.id,
      fromState: "0",
      toState: String(INITIAL_BACKGROUND_CREDIT_COUNT),
      payload: {},
    },
  })

  return { balance: createdWallet.balance, granted: true }
}

/**
 * Ensures a verified user has the one-time background-credit grant. Root Prisma
 * clients receive the shared retried serializable boundary; transaction clients
 * reuse the caller's boundary so verification and provisioning can stay atomic.
 */
export async function ensureVerifiedUserBackgroundCredits(
  prismaClient: PrismaClientOrTransaction,
  userId: string,
): Promise<{ balance: number; granted: boolean }> {
  if ("$transaction" in prismaClient) {
    return runCommerceTransaction(
      prismaClient as PrismaClient,
      (tx) => provisionVerifiedUserBackgroundCredits(tx as Prisma.TransactionClient, userId),
      { maxRetries: INITIAL_PROVISIONING_ATTEMPTS },
    )
  }

  return provisionVerifiedUserBackgroundCredits(prismaClient, userId)
}
