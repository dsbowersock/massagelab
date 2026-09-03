import { createHash, randomBytes } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { sendAccountChangeEmail } from "../auth-mail.ts"
import { requireFullAdminUser } from "./access.ts"
import { validateAdminSafePayload } from "./operation-contract.ts"
import { acquireAdminActionIdempotencyLock } from "./operation-service.ts"

type SendEmail = typeof sendAccountChangeEmail
type LockedClient = Prisma.TransactionClient
type RandomBytes = (size: number) => Buffer

export type AdminEmailIntentDeliveryResult =
  | { status: "DELIVERED" | "FAILED"; attemptCount: number; attempted: boolean }
  | { status: "BUSY"; attemptCount: number; attempted: false }
  | { status: "AMBIGUOUS"; attemptCount: number; attempted: true }

export type AdminEmailIntentDeliveryOutcome = Pick<AdminEmailIntentDeliveryResult, "status" | "attempted">

export type AdminEmailIntentRetryResult =
  | { status: "DELIVERED" | "FAILED"; attemptCount: number; replayed: boolean }
  | { status: "BUSY"; attemptCount: number; replayed: false; attempted: false }
  | { status: "AMBIGUOUS"; attemptCount: number; replayed: false; attempted: true }

type DeliveryIntent = {
  id: string
  userId?: string
  kind: string
  status: string
  recipientEmail: string | null
  subject: string
  message: string
  attemptCount: number
  failureCode: string | null
  deliveryClaimTokenHash: string | null
  deliveryClaimExpiresAt: Date | null
  deliveryClaimOperationKeyHash: string | null
}

type DeliveryClaim<TIntent extends DeliveryIntent = DeliveryIntent> = {
  intent: TIntent & { recipientEmail: string }
  claimTokenHash: string
  attemptCount: number
  beforeStatus: "PENDING" | "FAILED"
  beforeAttemptCount: number
  now: Date
}

type RetryDeliveryClaim = Omit<DeliveryClaim<DeliveryIntent & { userId: string }>, "beforeStatus"> & {
  beforeStatus: "FAILED"
}

const EMAIL_INTENT_LOCK_PREFIX = "massagelab:admin-email-intent:"
const CLAIM_LEASE_MS = 5 * 60 * 1000
const CLAIM_HASH_DOMAIN = "massagelab:admin-email-delivery-claim:v1\0"

/** Every database phase is short; SMTP and its limiter run after claim commit. */
export const ADMIN_EMAIL_TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 5_000,
} as const

/**
 * Claims one PENDING intent, sends after the claim commits, and finalizes only
 * the exact token hash. Status remains PENDING during its five-minute lease so
 * existing Activity projections do not need a new persisted state.
 */
export async function deliverAdminEmailIntent(input: {
  prismaClient: PrismaClient
  intentId: string
  sendEmail?: SendEmail
  now?: Date
  randomBytesFn?: RandomBytes
}): Promise<AdminEmailIntentDeliveryResult> {
  validateIdentifier(input.intentId, "notification intent")
  const now = validDate(input.now ?? new Date())
  const claimTokenHash = createClaimTokenHash(input.randomBytesFn ?? randomBytes)

  const claimed = await input.prismaClient.$transaction(async (tx) => {
    await acquireAdvisoryLocks(tx, [`${EMAIL_INTENT_LOCK_PREFIX}${input.intentId}`])
    const intent = await loadDeliveryIntent(tx, input.intentId)
    if (!intent) throw new Error("Email notification intent was not found.")
    if (intent.kind === "PASSWORD_RESET") throw new Error("Password-reset notifications cannot be delivered here.")

    const existingResult = initialResultWithoutClaim(intent, now)
    if (existingResult) return { kind: "RESULT" as const, result: existingResult }
    if (!claimIsRecoverable(intent, now) || !intent.recipientEmail) {
      return {
        kind: "RESULT" as const,
        result: { status: "BUSY" as const, attemptCount: intent.attemptCount, attempted: false as const },
      }
    }

    const updated = await tx.adminEmailIntent.updateMany({
      where: exactClaimCandidate(intent, "PENDING"),
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        deliveryClaimTokenHash: claimTokenHash,
        deliveryClaimExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
      },
    })
    const current = await loadDeliveryIntent(tx, intent.id)
    if (updated.count !== 1 || !current || current.deliveryClaimTokenHash !== claimTokenHash || !current.recipientEmail) {
      return {
        kind: "RESULT" as const,
        result: { status: "BUSY" as const, attemptCount: current?.attemptCount ?? intent.attemptCount, attempted: false as const },
      }
    }
    return {
      kind: "CLAIMED" as const,
      claim: {
        intent: { ...current, recipientEmail: current.recipientEmail },
        claimTokenHash,
        attemptCount: current.attemptCount,
        beforeStatus: "PENDING" as const,
        beforeAttemptCount: intent.attemptCount,
        now,
      } satisfies DeliveryClaim,
    }
  }, ADMIN_EMAIL_TRANSACTION_OPTIONS)

  if (claimed.kind === "RESULT") return claimed.result
  const delivered = await attemptDelivery(claimed.claim, input.sendEmail)

  try {
    const finished = await input.prismaClient.adminEmailIntent.updateMany({
      where: {
        id: claimed.claim.intent.id,
        status: "PENDING",
        deliveryClaimTokenHash: claimed.claim.claimTokenHash,
      },
      data: completionData(delivered, claimed.claim.now),
    })
    if (finished.count !== 1) {
      return { status: "AMBIGUOUS", attemptCount: claimed.claim.attemptCount, attempted: true }
    }
  } catch {
    return { status: "AMBIGUOUS", attemptCount: claimed.claim.attemptCount, attempted: true }
  }

  return {
    status: delivered ? "DELIVERED" : "FAILED",
    attemptCount: claimed.claim.attemptCount,
    attempted: true,
  }
}

/**
 * Authorizes and claims one FAILED intent before transport. The retry audit is
 * committed atomically with exact-token finalization after the provider call.
 */
export async function retryAdminEmailIntent(input: {
  prismaClient: PrismaClient
  actorUserId: string
  expectedTargetUserId: string
  intentId: string
  idempotencyKey: string
  sendEmail?: SendEmail
  now?: Date
  randomBytesFn?: RandomBytes
}): Promise<AdminEmailIntentRetryResult> {
  validateIdentifier(input.actorUserId, "administrator")
  validateIdentifier(input.expectedTargetUserId, "target account")
  validateIdentifier(input.intentId, "notification intent")
  validateIdentifier(input.idempotencyKey, "operation key")
  const now = validDate(input.now ?? new Date())
  const claimTokenHash = createClaimTokenHash(input.randomBytesFn ?? randomBytes)
  const operationKeyHash = hashRetryOperationKey(input.idempotencyKey)

  const claimed = await input.prismaClient.$transaction(async (tx) => {
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await acquireAdvisoryLocks(tx, [`${EMAIL_INTENT_LOCK_PREFIX}${input.intentId}`])
    await requireFullAdminUser({ prismaClient: tx, sessionUserId: input.actorUserId })

    const intent = await loadRetryIntent(tx, input.intentId)
    if (!intent) throw new Error("This notification cannot be retried.")
    if (intent.userId !== input.expectedTargetUserId) {
      throw new Error("This notification does not belong to the target account.")
    }
    if (!intent.recipientEmail) throw new Error("This notification cannot be retried.")
    if (intent.kind === "PASSWORD_RESET") throw new Error("Password-reset notifications cannot be retried here.")

    const existing = await loadRetryAction(tx, input.idempotencyKey)
    if (existing) return { kind: "RESULT" as const, result: retryReplayOrFail(existing, input, intent) }

    const operationKeyOwner = await loadRetryOperationKeyOwner(tx, operationKeyHash)
    if (operationKeyOwner && operationKeyOwner.emailIntentId !== intent.id) {
      throw new Error("This administrative operation key is already in use.")
    }
    if (claimIsLive(intent, now) || !claimIsRecoverable(intent, now)) {
      return {
        kind: "RESULT" as const,
        result: {
          status: "BUSY" as const,
          attemptCount: intent.attemptCount,
          replayed: false as const,
          attempted: false as const,
        },
      }
    }
    if (!isRetryableIntent(intent)) throw new Error("This notification cannot be retried.")

    if (!operationKeyOwner) {
      await tx.adminEmailRetryOperationKey.create({
        data: {
          emailIntentId: intent.id,
          operationKeyHash,
        },
        select: { id: true },
      })
    }

    const updated = await tx.adminEmailIntent.updateMany({
      where: exactClaimCandidate(intent, "FAILED"),
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        deliveryClaimTokenHash: claimTokenHash,
        deliveryClaimExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
        deliveryClaimOperationKeyHash: operationKeyHash,
      },
    })
    const current = await loadRetryIntent(tx, intent.id)
    if (updated.count !== 1 || !current || current.deliveryClaimTokenHash !== claimTokenHash || !current.recipientEmail) {
      return {
        kind: "RESULT" as const,
        result: {
          status: "BUSY" as const,
          attemptCount: current?.attemptCount ?? intent.attemptCount,
          replayed: false as const,
          attempted: false as const,
        },
      }
    }
    if (await loadRetryAction(tx, input.idempotencyKey)) {
      throw new Error("This administrative operation key is already in use.")
    }
    return {
      kind: "CLAIMED" as const,
      claim: {
        intent: { ...current, recipientEmail: current.recipientEmail },
        claimTokenHash,
        attemptCount: current.attemptCount,
        beforeStatus: "FAILED" as const,
        beforeAttemptCount: intent.attemptCount,
        now,
      } satisfies RetryDeliveryClaim,
    }
  }, ADMIN_EMAIL_TRANSACTION_OPTIONS)

  if (claimed.kind === "RESULT") return claimed.result
  const delivered = await attemptDelivery(claimed.claim, input.sendEmail)

  try {
    const finalized = await input.prismaClient.$transaction(async (tx) => {
      await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
      await acquireAdvisoryLocks(tx, [`${EMAIL_INTENT_LOCK_PREFIX}${input.intentId}`])
      const updated = await tx.adminEmailIntent.updateMany({
        where: {
          id: claimed.claim.intent.id,
          status: "FAILED",
          deliveryClaimTokenHash: claimed.claim.claimTokenHash,
        },
        data: completionData(delivered, claimed.claim.now),
      })
      if (updated.count !== 1) return false

      await tx.adminAction.create({
        data: retryAuditData(input, claimed.claim, delivered),
      })
      return true
    }, ADMIN_EMAIL_TRANSACTION_OPTIONS)

    if (!finalized) {
      return {
        status: "AMBIGUOUS",
        attemptCount: claimed.claim.attemptCount,
        replayed: false,
        attempted: true,
      }
    }
  } catch {
    return {
      status: "AMBIGUOUS",
      attemptCount: claimed.claim.attemptCount,
      replayed: false,
      attempted: true,
    }
  }

  return {
    status: delivered ? "DELIVERED" : "FAILED",
    attemptCount: claimed.claim.attemptCount,
    replayed: false,
  }
}

/** Calls the injected/default SMTP owner only after the claim transaction ends. */
async function attemptDelivery(claim: DeliveryClaim, sendEmail?: SendEmail): Promise<boolean> {
  try {
    const result = await (sendEmail ?? sendAccountChangeEmail)(
      claim.intent.recipientEmail,
      claim.intent.subject,
      claim.intent.message,
    )
    return result.delivered === true
  } catch {
    // Injected senders can throw arbitrary provider details; keep logs generic.
    console.error("Account-change email delivery failed")
    return false
  }
}

function initialResultWithoutClaim(intent: DeliveryIntent, now: Date): AdminEmailIntentDeliveryResult | null {
  if (claimIsLive(intent, now)) {
    return { status: "BUSY", attemptCount: intent.attemptCount, attempted: false }
  }
  if (intent.status === "DELIVERED") {
    return { status: "DELIVERED", attemptCount: intent.attemptCount, attempted: false }
  }
  if (intent.status === "FAILED") {
    return { status: "FAILED", attemptCount: intent.attemptCount, attempted: false }
  }
  if (intent.status !== "PENDING" || !intent.recipientEmail) {
    return { status: "FAILED", attemptCount: intent.attemptCount, attempted: false }
  }
  return null
}

function exactClaimCandidate(intent: DeliveryIntent, status: "PENDING" | "FAILED") {
  return {
    id: intent.id,
    status,
    deliveryClaimTokenHash: intent.deliveryClaimTokenHash,
    deliveryClaimExpiresAt: intent.deliveryClaimExpiresAt,
    deliveryClaimOperationKeyHash: intent.deliveryClaimOperationKeyHash,
  }
}

function completionData(delivered: boolean, now: Date) {
  return {
    status: delivered ? "DELIVERED" as const : "FAILED" as const,
    deliveredAt: delivered ? now : null,
    failureCode: delivered ? null : "DELIVERY_FAILED",
    deliveryClaimTokenHash: null,
    deliveryClaimExpiresAt: null,
    deliveryClaimOperationKeyHash: null,
  }
}

function retryAuditData(
  input: { actorUserId: string; idempotencyKey: string },
  claim: RetryDeliveryClaim,
  delivered: boolean,
) {
  const afterStatus = delivered ? "DELIVERED" : "FAILED"
  return {
    actorUserId: input.actorUserId,
    targetUserId: claim.intent.userId,
    actionKind: "EMAIL_NOTIFICATION_RETRIED",
    reasonCode: "ADMIN_CORRECTION",
    internalNote: null,
    idempotencyKey: input.idempotencyKey,
    beforeState: validateAdminSafePayload({
      emailIntentId: claim.intent.id,
      status: claim.beforeStatus,
      attemptCount: claim.beforeAttemptCount,
    }),
    afterState: validateAdminSafePayload({
      emailIntentId: claim.intent.id,
      status: afterStatus,
      attemptCount: claim.attemptCount,
    }),
    outcome: delivered ? "SUCCEEDED" as const : "FAILED" as const,
    failureCode: delivered ? null : "DELIVERY_FAILED",
  }
}

async function loadRetryAction(tx: LockedClient, idempotencyKey: string) {
  return tx.adminAction.findUnique({
    where: { idempotencyKey },
    select: {
      actorUserId: true,
      targetUserId: true,
      actionKind: true,
      reasonCode: true,
      internalNote: true,
      outcome: true,
      failureCode: true,
      beforeState: true,
      afterState: true,
      activity: { select: { id: true } },
      emailIntent: { select: { id: true } },
    },
  })
}

/** Reads the append-only hashed retry-key owner without exposing the raw key. */
async function loadRetryOperationKeyOwner(tx: LockedClient, operationKeyHash: string) {
  return tx.adminEmailRetryOperationKey.findUnique({
    where: { operationKeyHash },
    select: { emailIntentId: true },
  })
}

async function loadDeliveryIntent(tx: LockedClient, intentId: string): Promise<DeliveryIntent | null> {
  return tx.adminEmailIntent.findUnique({
    where: { id: intentId },
    select: {
      id: true,
      kind: true,
      status: true,
      recipientEmail: true,
      subject: true,
      message: true,
      attemptCount: true,
      failureCode: true,
      deliveryClaimTokenHash: true,
      deliveryClaimExpiresAt: true,
      deliveryClaimOperationKeyHash: true,
    },
  })
}

async function loadRetryIntent(tx: LockedClient, intentId: string): Promise<(DeliveryIntent & { userId: string }) | null> {
  return tx.adminEmailIntent.findUnique({
    where: { id: intentId },
    select: {
      id: true,
      userId: true,
      kind: true,
      status: true,
      recipientEmail: true,
      subject: true,
      message: true,
      attemptCount: true,
      failureCode: true,
      deliveryClaimTokenHash: true,
      deliveryClaimExpiresAt: true,
      deliveryClaimOperationKeyHash: true,
    },
  })
}

function retryReplayOrFail(existing: {
  actorUserId: string
  targetUserId: string
  actionKind: string
  reasonCode: string
  internalNote: string | null
  outcome: string
  failureCode: string | null
  beforeState: Prisma.JsonValue
  afterState: Prisma.JsonValue
  activity: { id: string } | null
  emailIntent: { id: string } | null
}, input: { actorUserId: string }, intent: { id: string; userId: string }): {
  status: "DELIVERED" | "FAILED"
  attemptCount: number
  replayed: true
} {
  if (existing.actorUserId !== input.actorUserId
    || existing.targetUserId !== intent.userId
    || existing.actionKind !== "EMAIL_NOTIFICATION_RETRIED"
    || existing.reasonCode !== "ADMIN_CORRECTION"
    || existing.internalNote !== null
    || existing.activity !== null
    || existing.emailIntent !== null) {
    throw new Error("This administrative operation key is already in use.")
  }

  const beforeState = retryStateForIntent(existing.beforeState, intent.id)
  const afterState = retryStateForIntent(existing.afterState, intent.id)
  if (!beforeState || !afterState
    || beforeState.status !== "FAILED"
    || !isRetryResultStatus(afterState.status)
    || afterState.attemptCount !== beforeState.attemptCount + 1
    || (existing.outcome === "SUCCEEDED" && (afterState.status !== "DELIVERED" || existing.failureCode !== null))
    || (existing.outcome === "FAILED" && (afterState.status !== "FAILED" || existing.failureCode !== "DELIVERY_FAILED"))
    || (existing.outcome !== "SUCCEEDED" && existing.outcome !== "FAILED")) {
    throw new Error("The existing retry record is incomplete.")
  }

  return {
    status: existing.outcome === "SUCCEEDED" ? "DELIVERED" : "FAILED",
    attemptCount: afterState.attemptCount,
    replayed: true,
  }
}

function retryStateForIntent(value: Prisma.JsonValue, intentId: string): { status: string; attemptCount: number } | null {
  try {
    const state = validateAdminSafePayload(value)
    const keys = Object.keys(state).sort()
    return keys.length === 3
      && keys[0] === "attemptCount"
      && keys[1] === "emailIntentId"
      && keys[2] === "status"
      && state.emailIntentId === intentId
      && typeof state.status === "string"
      && typeof state.attemptCount === "number"
      && Number.isSafeInteger(state.attemptCount)
      && state.attemptCount >= 0
      ? { status: state.status, attemptCount: state.attemptCount }
      : null
  } catch {
    return null
  }
}

function isRetryResultStatus(status: string): boolean {
  return status === "DELIVERED" || status === "FAILED"
}

function isRetryableIntent(intent: DeliveryIntent): intent is DeliveryIntent & { status: "FAILED"; recipientEmail: string } {
  return intent.status === "FAILED"
    && intent.failureCode === "DELIVERY_FAILED"
    && Boolean(intent.recipientEmail)
}

function claimIsLive(intent: DeliveryIntent, now: Date): boolean {
  return typeof intent.deliveryClaimTokenHash === "string"
    && intent.deliveryClaimTokenHash.length > 0
    && intent.deliveryClaimExpiresAt instanceof Date
    && intent.deliveryClaimExpiresAt.getTime() >= now.getTime()
}

/** Only an exact hash with a valid expired lease is safe to recover; malformed claims stay BUSY. */
function claimIsRecoverable(intent: DeliveryIntent, now: Date): boolean {
  if (intent.deliveryClaimTokenHash === null
    && intent.deliveryClaimExpiresAt === null
    && intent.deliveryClaimOperationKeyHash === null) return true
  return typeof intent.deliveryClaimTokenHash === "string"
    && /^[0-9a-f]{64}$/.test(intent.deliveryClaimTokenHash)
    && intent.deliveryClaimExpiresAt instanceof Date
    && intent.deliveryClaimExpiresAt.getTime() < now.getTime()
    && (intent.deliveryClaimOperationKeyHash === null
      || (typeof intent.deliveryClaimOperationKeyHash === "string" && /^[0-9a-f]{64}$/.test(intent.deliveryClaimOperationKeyHash)))
}

function createClaimTokenHash(randomBytesFn: RandomBytes): string {
  const token = randomBytesFn(32)
  if (!Buffer.isBuffer(token) || token.length !== 32) {
    throw new Error("Email notification claim could not be created.")
  }
  return createHash("sha256").update(CLAIM_HASH_DOMAIN).update(token).digest("hex")
}

function hashRetryOperationKey(idempotencyKey: string): string {
  const value = Buffer.from(idempotencyKey, "utf8")
  const length = Buffer.allocUnsafe(4)
  length.writeUInt32BE(value.length)
  return createHash("sha256")
    .update("massagelab:admin-email-retry-operation:v1\0")
    .update(length)
    .update(value)
    .digest("hex")
}

function validDate(value: Date): Date {
  const date = value instanceof Date ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) throw new Error("Provide a valid delivery time.")
  return date
}

/** Uses namespaced text hashes so unrelated advisory-lock users cannot collide by convention. */
async function acquireAdvisoryLocks(tx: LockedClient, lockKeys: string[]): Promise<void> {
  for (const lockKey of [...new Set(lockKeys)].sort()) {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`)
  }
}

function validateIdentifier(value: string, label: string): void {
  if (typeof value !== "string" || !value.trim() || value.length > 191) {
    throw new Error(`Provide a valid ${label}.`)
  }
}
