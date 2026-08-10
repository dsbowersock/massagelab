import type { Prisma, PrismaClient } from "@prisma/client"
import { requireFullAdminUser } from "../admin/access.ts"
import { validateAdminReason, type AdminReasonCode } from "../admin/operation-contract.ts"
import {
  acquireAdminActionIdempotencyLock,
  recordAdminActionBundle,
  type RecordAdminActionInput,
} from "../admin/operation-service.ts"
import { normalizeEmail } from "../auth-security.js"
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

class BackgroundCreditGrantConflictError extends Error {
  readonly code = "P2034"

  constructor() {
    super("Background credit grant conflicted with another transaction.")
    this.name = "BackgroundCreditGrantConflictError"
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

/**
 * Adds a bounded positive Admin grant to the canonical wallet and immutable
 * commerce ledger. Mutation, audit/activity evidence, and the durable email
 * intent share one retried serializable transaction; delivery stays post-commit.
 * A missing prepared wallet compares as zero, while `previousBalance` reports
 * the canonical initial-grant balance immediately before the Admin delta.
 */
export async function grantAdminBackgroundCredits(input: {
  prismaClient: PrismaClient
  actorUserId: string
  targetUserId: string
  amount: number
  expectedBalance: number
  reasonCode: AdminReasonCode
  internalNote: string | null
  idempotencyKey: string
}): Promise<{
  previousBalance: number
  amount: number
  balanceAfter: number
  replayed: boolean
  emailIntentId: string
}> {
  validateAdminGrantContract(input)

  return runCommerceTransaction(input.prismaClient, async (tx) => {
    // Keep the operation key as the first query so concurrent duplicates share
    // the winning transaction's committed snapshot before any replay decision.
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireFullAdminUser({ prismaClient: tx, sessionUserId: input.actorUserId })

    const target = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true, email: true, emailVerified: true },
    })
    const targetEmail = normalizeEmail(target?.email)
    if (!target?.emailVerified || !targetEmail) {
      throw new Error("Background credits require a verified target account with an email.")
    }

    const existing = await tx.adminAction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { activity: true, emailIntent: true },
    })
    if (existing) return replayExistingAdminGrant(tx, input, existing)

    const preparedWallet = await tx.backgroundCreditWallet.findUnique({ where: { userId: input.targetUserId } })
    const preparedBalance = preparedWallet?.balance ?? 0
    if (preparedBalance !== input.expectedBalance) {
      throw new Error("The background credit balance changed since this grant was prepared. Refresh the account and try again.")
    }

    await ensureVerifiedUserBackgroundCredits(tx, input.targetUserId)
    const wallet = preparedWallet
      ?? await tx.backgroundCreditWallet.findUnique({ where: { userId: input.targetUserId } })
    if (!wallet) throw new BackgroundCreditReconciliationError()

    const balanceAfter = wallet.balance + input.amount
    if (!Number.isSafeInteger(balanceAfter)) {
      throw new Error("The resulting background credit balance is outside the supported range.")
    }
    const updated = await tx.backgroundCreditWallet.updateMany({
      where: {
        id: wallet.id,
        userId: input.targetUserId,
        balance: wallet.balance,
        version: wallet.version,
      },
      data: {
        balance: { increment: input.amount },
        version: { increment: 1 },
      },
    })
    if (updated.count !== 1) {
      // P2034 makes the shared helper restart the entire serializable unit.
      throw new BackgroundCreditGrantConflictError()
    }

    await tx.backgroundCreditEntry.create({
      data: {
        walletId: wallet.id,
        userId: input.targetUserId,
        type: "ADMIN_CORRECTION",
        delta: input.amount,
        balanceAfter,
        idempotencyKey: input.idempotencyKey,
        reasonCode: input.reasonCode,
      },
    })
    await tx.commerceEvent.create({
      data: {
        userId: input.targetUserId,
        eventType: "BACKGROUND_CREDITS_ADMIN_GRANTED",
        source: "admin",
        actorType: "ADMIN",
        actorId: input.actorUserId,
        reasonCode: input.reasonCode,
        aggregateType: "BackgroundCreditWallet",
        aggregateId: wallet.id,
        fromState: String(wallet.balance),
        toState: String(balanceAfter),
        payload: { amount: input.amount },
      },
    })

    const bundle = await recordAdminActionBundle(tx, buildAdminGrantBundle(input, {
      previousBalance: wallet.balance,
      balanceAfter,
      recipientEmail: targetEmail,
    }))
    return {
      previousBalance: wallet.balance,
      amount: input.amount,
      balanceAfter,
      replayed: bundle.replayed,
      emailIntentId: bundle.emailIntentId,
    }
  })
}

type AdminGrantInput = Omit<Parameters<typeof grantAdminBackgroundCredits>[0], "prismaClient">
type ExistingAdminGrantAction = Prisma.AdminActionGetPayload<{
  include: { activity: true; emailIntent: true }
}>

function validateAdminGrantContract(input: Parameters<typeof grantAdminBackgroundCredits>[0]): void {
  for (const [value, label] of [[input.actorUserId, "actor"], [input.targetUserId, "target"], [input.idempotencyKey, "operation key"]] as const) {
    if (typeof value !== "string" || !value.trim() || value.length > 191 || /[\r\n]/.test(value)) {
      throw new Error(`Provide a valid ${label}.`)
    }
  }
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 25) {
    throw new Error("Background credit grants must be a whole number from 1 through 25.")
  }
  if (!Number.isSafeInteger(input.expectedBalance) || input.expectedBalance < 0) {
    throw new Error("Provide a valid prepared balance.")
  }
  if (input.internalNote !== null && typeof input.internalNote !== "string") {
    throw new Error("Internal notes must be text.")
  }
  validateAdminReason(input.reasonCode, input.internalNote)
}

function buildAdminGrantBundle(
  input: AdminGrantInput,
  facts: { previousBalance: number; balanceAfter: number; recipientEmail: string | null },
): RecordAdminActionInput {
  const amountLabel = `${input.amount} background credit${input.amount === 1 ? "" : "s"}`
  const addedVerb = input.amount === 1 ? "was" : "were"
  return {
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    actionKind: "BACKGROUND_CREDITS_ADMIN_GRANTED",
    reasonCode: input.reasonCode,
    internalNote: input.internalNote,
    idempotencyKey: input.idempotencyKey,
    beforeState: { preparedBalance: input.expectedBalance, balance: facts.previousBalance, amount: input.amount },
    afterState: { preparedBalance: input.expectedBalance, balance: facts.balanceAfter, amount: input.amount },
    activity: {
      title: "Background credits added",
      explanation: `${amountLabel} ${addedVerb} added to your Massage Lab account by support. Your balance is now ${facts.balanceAfter}.`,
      effectiveValue: `+${input.amount} credits`,
    },
    email: {
      kind: "BACKGROUND_CREDITS_ADMIN_GRANTED",
      recipientEmail: facts.recipientEmail,
      subject: "Background credits were added to your Massage Lab account",
      message: `Massage Lab support added ${amountLabel} to your account. Your balance changed from ${facts.previousBalance} to ${facts.balanceAfter}. If you did not expect this change, contact Massage Lab support.`,
    },
  }
}

/** Revalidates both immutable owners before returning the original grant result. */
async function replayExistingAdminGrant(
  tx: Prisma.TransactionClient,
  input: AdminGrantInput,
  existing: ExistingAdminGrantAction,
) {
  const before = readAdminGrantSnapshot(existing.beforeState)
  const after = readAdminGrantSnapshot(existing.afterState)
  const entry = await tx.backgroundCreditEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (
    existing.actorUserId !== input.actorUserId
    || existing.targetUserId !== input.targetUserId
    || existing.actionKind !== "BACKGROUND_CREDITS_ADMIN_GRANTED"
    || existing.reasonCode !== input.reasonCode
    || existing.internalNote !== input.internalNote
    || !before
    || !after
    || before.preparedBalance !== input.expectedBalance
    || before.amount !== input.amount
    || after.preparedBalance !== input.expectedBalance
    || after.amount !== input.amount
    || after.balance !== before.balance + input.amount
    || !existing.emailIntent
    || !entry
    || entry.userId !== input.targetUserId
    || entry.type !== "ADMIN_CORRECTION"
    || entry.delta !== input.amount
    || entry.balanceAfter !== after.balance
    || entry.idempotencyKey !== input.idempotencyKey
    || entry.reasonCode !== input.reasonCode
  ) {
    throw new Error("This administrative operation key is already in use.")
  }

  const bundle = await recordAdminActionBundle(tx, buildAdminGrantBundle(input, {
    previousBalance: before.balance,
    balanceAfter: after.balance,
    recipientEmail: existing.emailIntent.recipientEmail,
  }))
  return {
    previousBalance: before.balance,
    amount: input.amount,
    balanceAfter: after.balance,
    replayed: bundle.replayed,
    emailIntentId: bundle.emailIntentId,
  }
}

function readAdminGrantSnapshot(value: Prisma.JsonValue): { preparedBalance: number; balance: number; amount: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const snapshot = value as Record<string, Prisma.JsonValue>
  if (
    !Number.isSafeInteger(snapshot.preparedBalance)
    || (snapshot.preparedBalance as number) < 0
    || !Number.isSafeInteger(snapshot.balance)
    || (snapshot.balance as number) < 0
    || !Number.isInteger(snapshot.amount)
    || (snapshot.amount as number) < 1
    || (snapshot.amount as number) > 25
  ) return null
  return {
    preparedBalance: snapshot.preparedBalance as number,
    balance: snapshot.balance as number,
    amount: snapshot.amount as number,
  }
}
