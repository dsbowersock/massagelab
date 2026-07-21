import type { BackgroundOwnershipStatus, Prisma, PrismaClient } from "@prisma/client"
import { backgroundRegistry } from "../../components/backgrounds/backgroundRegistry.ts"
import { FEATURE_KEYS, buildEntitlements, hasFeature } from "../membership.js"
import { resolveCommerceProduct } from "./catalog.ts"
import type { PrismaClientOrTransaction } from "./credit-service.ts"
import { COMMERCE_ERROR_CODES, CommerceError, asPublicCommerceError } from "./errors.ts"
import { runCommerceTransaction } from "./transactions.ts"

export type BackgroundAccessDecision = {
  canUse: boolean
  canCustomizeColors: boolean
  accessSource: "free" | "subscription" | "ownership" | "locked"
  isPermanentlyOwned: boolean
  ownershipStatus: BackgroundOwnershipStatus | null
  creditEligibility: { eligible: boolean; disabledReason: string | null }
  purchaseEligibility: { eligible: boolean; disabledReason: string | null }
  reservation: { active: boolean; orderId: string | null; expiresAt: string | null }
  disabledReason: string | null
}

type Eligibility = BackgroundAccessDecision["creditEligibility"]

const UNAVAILABLE_REASON = "This background is unavailable."
const RESERVED_REASON = "This background is reserved for checkout."
const EXISTING_OWNERSHIP_REASON = "This background has an existing ownership record."

function unavailableDecision(): BackgroundAccessDecision {
  return {
    canUse: false,
    canCustomizeColors: false,
    accessSource: "locked",
    isPermanentlyOwned: false,
    ownershipStatus: null,
    creditEligibility: { eligible: false, disabledReason: UNAVAILABLE_REASON },
    purchaseEligibility: { eligible: false, disabledReason: UNAVAILABLE_REASON },
    reservation: { active: false, orderId: null, expiresAt: null },
    disabledReason: UNAVAILABLE_REASON,
  }
}

function resolveCreditEligibility(input: {
  isFree: boolean
  verified: boolean
  ownershipStatus: BackgroundOwnershipStatus | null
  reserved: boolean
  balance: number
}): Eligibility {
  if (input.isFree) {
    return { eligible: false, disabledReason: "This background does not need a credit." }
  }
  if (!input.verified) {
    return { eligible: false, disabledReason: "Verify your email to use a credit." }
  }
  if (input.ownershipStatus) {
    return { eligible: false, disabledReason: EXISTING_OWNERSHIP_REASON }
  }
  if (input.reserved) {
    return { eligible: false, disabledReason: RESERVED_REASON }
  }
  if (input.balance < 1) {
    return { eligible: false, disabledReason: "No purchase credits remain." }
  }
  return { eligible: true, disabledReason: null }
}

function resolvePurchaseEligibility(input: {
  isFree: boolean
  verified: boolean
  ownershipStatus: BackgroundOwnershipStatus | null
  reserved: boolean
}): Eligibility {
  if (input.isFree) {
    return { eligible: false, disabledReason: "This background is already free." }
  }
  if (!input.verified) {
    return { eligible: false, disabledReason: "Verify your email to purchase this background." }
  }
  if (input.ownershipStatus) {
    return { eligible: false, disabledReason: EXISTING_OWNERSHIP_REASON }
  }
  if (input.reserved) {
    return { eligible: false, disabledReason: RESERVED_REASON }
  }
  return { eligible: true, disabledReason: null }
}

/**
 * Resolves access and acquisition state from one fresh database snapshot.
 *
 * The callback intentionally reloads verification, entitlements, ownership,
 * wallet balance, and checkout reservation together so callers cannot combine
 * stale client badges or session claims into an authorization decision.
 */
async function resolveBackgroundAccessInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  backgroundId: string,
): Promise<BackgroundAccessDecision> {
  const background = backgroundRegistry.find((entry) => entry.id === backgroundId)
  if (!background?.enabled) {
    return unavailableDecision()
  }

  const now = new Date()
  const [user, subscriptions, studentAccess, ownership, wallet, reservedOrder] = await Promise.all([
    tx.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    }),
    tx.membershipSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
    tx.studentAccess.findUnique({ where: { userId } }),
    tx.backgroundOwnership.findUnique({
      where: { userId_backgroundKey: { userId, backgroundKey: background.id } },
      select: { status: true, source: true },
    }),
    tx.backgroundCreditWallet.findUnique({
      where: { userId },
      select: { balance: true },
    }),
    tx.commerceOrder.findFirst({
      where: {
        userId,
        status: { in: ["PREPARING", "AWAITING_PAYMENT"] },
        reservationExpiresAt: { gt: now },
        items: {
          some: {
            productType: "background",
            productKey: background.id,
          },
        },
      },
      select: { id: true, reservationExpiresAt: true },
    }),
  ])

  const entitlements = buildEntitlements({ subscriptions, studentAccess, now })
  const ownershipStatus = ownership?.status ?? null
  const isPermanentlyOwned = ownershipStatus === "ACTIVE"
  const hasSubscriptionAccess = hasFeature(entitlements.features, FEATURE_KEYS.premiumBackgrounds)
  const hasColorAccess = hasFeature(entitlements.features, FEATURE_KEYS.chimerCustomColors)
  const isFree = !background.requiresSubscription
  const reservation = reservedOrder?.reservationExpiresAt
    ? {
        active: true,
        orderId: reservedOrder.id,
        expiresAt: reservedOrder.reservationExpiresAt.toISOString(),
      }
    : { active: false, orderId: null, expiresAt: null }
  const canUse = isFree || isPermanentlyOwned || hasSubscriptionAccess
  const canCustomizeColors = isPermanentlyOwned || hasColorAccess
  const accessSource = isFree
    ? "free"
    : isPermanentlyOwned
      ? "ownership"
      : hasSubscriptionAccess
        ? "subscription"
        : "locked"

  return {
    canUse,
    canCustomizeColors,
    accessSource,
    isPermanentlyOwned,
    ownershipStatus,
    creditEligibility: resolveCreditEligibility({
      isFree,
      verified: Boolean(user?.emailVerified),
      ownershipStatus,
      reserved: reservation.active,
      balance: wallet?.balance ?? 0,
    }),
    purchaseEligibility: resolvePurchaseEligibility({
      isFree,
      verified: Boolean(user?.emailVerified),
      ownershipStatus,
      reserved: reservation.active,
    }),
    reservation,
    disabledReason: canUse
      ? null
      : ownershipStatus
        ? "Permanent access is not active."
        : "Unlock this background with a credit, purchase, or membership.",
  }
}

export async function resolveBackgroundAccessForUser(input: {
  prismaClient: PrismaClientOrTransaction
  userId: string
  backgroundId: string
}): Promise<BackgroundAccessDecision> {
  if ("$transaction" in input.prismaClient) {
    return runCommerceTransaction(
      input.prismaClient as PrismaClient,
      (tx) => resolveBackgroundAccessInTransaction(
        tx as Prisma.TransactionClient,
        input.userId,
        input.backgroundId,
      ),
    )
  }

  return resolveBackgroundAccessInTransaction(
    input.prismaClient,
    input.userId,
    input.backgroundId,
  )
}

type RedemptionResult = { backgroundId: string; remainingCredits: number }

const REDEMPTION_REASON = "BACKGROUND_CREDIT_REDEEMED"

function collectConstraintTokens(value: unknown, depth = 0): string[] {
  if (depth > 4) return []
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap((entry) => collectConstraintTokens(entry, depth + 1))
  if (!value || typeof value !== "object") return []
  return Object.values(value).flatMap((entry) => collectConstraintTokens(entry, depth + 1))
}

/** Limits recovery to the two unique constraints that can race for this redemption. */
function redemptionConflictKind(error: unknown): "idempotency" | "ownership" | null {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "P2002") {
    return null
  }

  const meta = (error as { meta?: unknown }).meta
  if (!meta || typeof meta !== "object") return null
  const modelName = (meta as { modelName?: unknown }).modelName
  const tokens = collectConstraintTokens(meta)

  if (
    (modelName === undefined || modelName === "BackgroundCreditEntry")
    && (
      tokens.includes("idempotencyKey")
      || tokens.includes("BackgroundCreditEntry_idempotencyKey_key")
    )
  ) {
    return "idempotency"
  }

  if (
    (modelName === undefined || modelName === "BackgroundOwnership")
    && (
      tokens.includes("backgroundKey")
      || tokens.includes("BackgroundOwnership_userId_backgroundKey_key")
    )
  ) {
    return "ownership"
  }

  return null
}

function staleRedemptionConflict(): CommerceError {
  return new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
}

function committedRedemptionResult(
  entry: {
    id: string
    walletId: string
    userId: string
    type: string
    delta: number
    balanceAfter: number
    idempotencyKey: string
    redemptionBackgroundKey: string
  },
  ownership: {
    userId: string
    backgroundKey: string
    source: string
    status: BackgroundOwnershipStatus
    sourceCreditEntryId: string | null
  } | null,
  input: { userId: string; backgroundId: string; idempotencyKey: string },
): RedemptionResult {
  if (
    entry.userId !== input.userId
    || entry.type !== "REDEMPTION"
    || entry.delta !== -1
    || entry.idempotencyKey !== input.idempotencyKey
    || entry.redemptionBackgroundKey !== input.backgroundId
    || !ownership
    || ownership.userId !== input.userId
    || ownership.backgroundKey !== input.backgroundId
    || ownership.source !== "CREDIT_REDEMPTION"
    || ownership.status !== "ACTIVE"
    || ownership.sourceCreditEntryId !== entry.id
  ) {
    throw staleRedemptionConflict()
  }

  return {
    backgroundId: input.backgroundId,
    remainingCredits: entry.balanceAfter,
  }
}

async function loadCommittedRedemption(
  tx: Prisma.TransactionClient,
  input: { userId: string; backgroundId: string; idempotencyKey: string },
): Promise<RedemptionResult | null> {
  const entry = await tx.backgroundCreditEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (!entry) return null

  const ownership = await tx.backgroundOwnership.findUnique({
    where: {
      userId_backgroundKey: {
        userId: input.userId,
        backgroundKey: input.backgroundId,
      },
    },
  })

  return committedRedemptionResult(entry, ownership, input)
}

/**
 * Redeems exactly one credit inside a short serializable transaction.
 *
 * The wallet predicate is the final balance guard: concurrent callers cannot
 * both spend the last credit even when they loaded the same initial snapshot.
 * Ownership is sourced only from the immutable redemption ledger entry.
 */
async function redeemBackgroundCreditInTransaction(
  tx: Prisma.TransactionClient,
  input: { userId: string; backgroundId: string; idempotencyKey: string },
): Promise<RedemptionResult> {
  const product = resolveCommerceProduct("background", input.backgroundId)
  const now = new Date()
  const [user, existingEntry, ownership, wallet, reservedOrder] = await Promise.all([
    tx.user.findUnique({
      where: { id: input.userId },
      select: { emailVerified: true },
    }),
    tx.backgroundCreditEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    }),
    tx.backgroundOwnership.findUnique({
      where: {
        userId_backgroundKey: {
          userId: input.userId,
          backgroundKey: product.productKey,
        },
      },
    }),
    tx.backgroundCreditWallet.findUnique({
      where: { userId: input.userId },
    }),
    tx.commerceOrder.findFirst({
      where: {
        userId: input.userId,
        status: { in: ["PREPARING", "AWAITING_PAYMENT"] },
        reservationExpiresAt: { gt: now },
        items: {
          some: {
            productType: product.productType,
            productKey: product.productKey,
          },
        },
      },
      select: { id: true },
    }),
  ])

  if (!user?.emailVerified) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED })
  }

  if (existingEntry) {
    return committedRedemptionResult(existingEntry, ownership, input)
  }
  if (ownership) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.ALREADY_OWNED })
  }
  if (reservedOrder) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.RESERVED_CART })
  }
  if (!wallet) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.NO_CREDITS_REMAINING })
  }

  const walletUpdate = await tx.backgroundCreditWallet.updateMany({
    where: {
      id: wallet.id,
      userId: input.userId,
      balance: { gte: 1 },
    },
    data: {
      balance: { decrement: 1 },
      version: { increment: 1 },
    },
  })
  if (walletUpdate.count !== 1) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.NO_CREDITS_REMAINING })
  }

  const remainingCredits = wallet.balance - 1
  const entry = await tx.backgroundCreditEntry.create({
    data: {
      walletId: wallet.id,
      userId: input.userId,
      type: "REDEMPTION",
      delta: -1,
      balanceAfter: remainingCredits,
      idempotencyKey: input.idempotencyKey,
      redemptionBackgroundKey: product.productKey,
      reasonCode: REDEMPTION_REASON,
    },
  })
  const createdOwnership = await tx.backgroundOwnership.create({
    data: {
      userId: input.userId,
      backgroundKey: product.productKey,
      source: "CREDIT_REDEMPTION",
      sourceProductType: product.productType,
      status: "ACTIVE",
      sourceCreditEntryId: entry.id,
    },
  })

  await tx.commerceEvent.create({
    data: {
      userId: input.userId,
      eventType: "BACKGROUND_CREDIT_REDEEMED",
      source: "background_credit",
      actorType: "USER",
      actorId: input.userId,
      reasonCode: REDEMPTION_REASON,
      aggregateType: "BackgroundOwnership",
      aggregateId: createdOwnership.id,
      fromState: null,
      toState: "ACTIVE",
      payload: { backgroundKey: product.productKey, creditEntryId: entry.id },
    },
  })

  return { backgroundId: product.productKey, remainingCredits }
}

export async function redeemBackgroundCredit(input: {
  prismaClient: PrismaClient
  userId: string
  backgroundId: string
  confirmationAccepted: true
  idempotencyKey: string
}): Promise<RedemptionResult> {
  if (input.confirmationAccepted !== true) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED })
  }

  const idempotencyKey = typeof input.idempotencyKey === "string"
    ? input.idempotencyKey.trim()
    : ""
  if (!idempotencyKey) {
    throw staleRedemptionConflict()
  }
  const redemptionInput = {
    userId: input.userId,
    backgroundId: input.backgroundId,
    idempotencyKey,
  }

  try {
    return await runCommerceTransaction(
      input.prismaClient,
      (tx) => redeemBackgroundCreditInTransaction(
        tx as Prisma.TransactionClient,
        redemptionInput,
      ),
    )
  } catch (error) {
    if (error instanceof CommerceError && error.code === COMMERCE_ERROR_CODES.NO_CREDITS_REMAINING) {
      const committed = await runCommerceTransaction(
        input.prismaClient,
        (tx) => loadCommittedRedemption(tx, redemptionInput),
      )
      if (committed) return committed
      throw asPublicCommerceError(error)
    }

    const conflictKind = redemptionConflictKind(error)
    if (!conflictKind) {
      throw asPublicCommerceError(error)
    }

    const recovered = await runCommerceTransaction(
      input.prismaClient,
      async (tx) => {
        const committed = await loadCommittedRedemption(
          tx as Prisma.TransactionClient,
          redemptionInput,
        )
        if (committed) return committed

        if (conflictKind === "ownership") {
          const ownership = await (tx as Prisma.TransactionClient).backgroundOwnership.findUnique({
            where: {
              userId_backgroundKey: {
                userId: redemptionInput.userId,
                backgroundKey: redemptionInput.backgroundId,
              },
            },
          })
          if (ownership) {
            throw new CommerceError({ code: COMMERCE_ERROR_CODES.ALREADY_OWNED })
          }
        }

        throw staleRedemptionConflict()
      },
    )
    return recovered
  }
}
