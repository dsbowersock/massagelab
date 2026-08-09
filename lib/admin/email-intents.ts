import { Prisma, type PrismaClient } from "@prisma/client"
import { ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS, sendAccountChangeEmail } from "../auth-mail.ts"
import { requireFullAdminUser } from "./access.ts"
import { validateAdminSafePayload } from "./operation-contract.ts"
import { acquireAdminActionIdempotencyLock } from "./operation-service.ts"

type SendEmail = typeof sendAccountChangeEmail
type LockedClient = Prisma.TransactionClient

const EMAIL_INTENT_LOCK_PREFIX = "massagelab:admin-email-intent:"

/** Shared bound for lock acquisition plus one SMTP attempt and its durable update. */
export const ADMIN_EMAIL_TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS + 5_000,
} as const

/**
 * Serializes a single intent's transport attempt with a transaction-scoped
 * PostgreSQL advisory lock. Delivery remains at-least-once: a timeout or crash
 * after the provider accepts mail but before confirmation and transaction
 * commit can be retried, because no provider-independent exactly-once claim
 * exists.
 */
export async function deliverAdminEmailIntent(input: {
  prismaClient: PrismaClient
  intentId: string
  sendEmail?: SendEmail
  now?: Date
}): Promise<{ status: "DELIVERED" | "FAILED"; attemptCount: number; attempted: boolean }> {
  validateIdentifier(input.intentId, "notification intent")

  return input.prismaClient.$transaction(async (tx) => {
    await acquireAdvisoryLocks(tx, [`${EMAIL_INTENT_LOCK_PREFIX}${input.intentId}`])
    return deliverLockedAdminEmailIntent(tx, {
      intentId: input.intentId,
      sendEmail: input.sendEmail,
      now: input.now,
    })
  }, ADMIN_EMAIL_TRANSACTION_OPTIONS)
}

/**
 * Retries one persisted non-password-reset notification for a freshly verified
 * full Admin. The shared action key lock is acquired before the intent lock, so
 * same-key and direct-delivery races observe one serialized current state.
 * The SMTP caveat remains at-least-once as documented on direct delivery.
 */
export async function retryAdminEmailIntent(input: {
  prismaClient: PrismaClient
  actorUserId: string
  expectedTargetUserId: string
  intentId: string
  idempotencyKey: string
  sendEmail?: SendEmail
}): Promise<{ status: "DELIVERED" | "FAILED"; attemptCount: number; replayed: boolean }> {
  validateIdentifier(input.actorUserId, "administrator")
  validateIdentifier(input.expectedTargetUserId, "target account")
  validateIdentifier(input.intentId, "notification intent")
  validateIdentifier(input.idempotencyKey, "operation key")

  return input.prismaClient.$transaction(async (tx) => {
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

    const existing = await tx.adminAction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
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
    if (existing) return retryReplayOrFail(existing, input, intent)

    if (!isAttemptableIntent(intent)) throw new Error("This notification cannot be retried.")
    const delivery = await deliverLockedAdminEmailIntent(tx, {
      intentId: intent.id,
      sendEmail: input.sendEmail,
    })
    if (!delivery.attempted) throw new Error("This notification cannot be retried.")

    const beforeState = validateAdminSafePayload({
      emailIntentId: intent.id,
      status: intent.status,
      attemptCount: intent.attemptCount,
    })
    const afterState = validateAdminSafePayload({
      emailIntentId: intent.id,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
    })

    try {
      await tx.adminAction.create({
        data: {
          actorUserId: input.actorUserId,
          targetUserId: intent.userId,
          actionKind: "EMAIL_NOTIFICATION_RETRIED",
          reasonCode: "ADMIN_CORRECTION",
          internalNote: null,
          idempotencyKey: input.idempotencyKey,
          beforeState,
          afterState,
          outcome: delivery.status === "DELIVERED" ? "SUCCEEDED" : "FAILED",
          failureCode: delivery.status === "DELIVERED" ? null : "DELIVERY_FAILED",
        },
      })
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error
      // Locks normally make this unreachable. This code has already attempted
      // transport, so returning a replay here could disguise a second send.
      throw new Error("This administrative operation key is already in use.")
    }

    return { status: delivery.status, attemptCount: delivery.attemptCount, replayed: false }
  }, ADMIN_EMAIL_TRANSACTION_OPTIONS)
}

/** Performs one transport attempt only after the caller has locked the intent. */
async function deliverLockedAdminEmailIntent(inputTx: LockedClient, input: {
  intentId: string
  sendEmail?: SendEmail
  now?: Date
}): Promise<{ status: "DELIVERED" | "FAILED"; attemptCount: number; attempted: boolean }> {
  const intent = await loadDeliveryIntent(inputTx, input.intentId)
  if (!intent) throw new Error("Email notification intent was not found.")
  if (intent.kind === "PASSWORD_RESET") throw new Error("Password-reset notifications cannot be delivered here.")
  if (intent.status === "DELIVERED") return { status: "DELIVERED", attemptCount: intent.attemptCount, attempted: false }
  if (!isAttemptableIntent(intent)) return { status: "FAILED", attemptCount: intent.attemptCount, attempted: false }

  const now = input.now ?? new Date()
  let delivered = false
  try {
    const result = await (input.sendEmail ?? sendAccountChangeEmail)(intent.recipientEmail, intent.subject, intent.message)
    delivered = result.delivered === true
  } catch {
    // Injected senders can throw arbitrary provider details; keep logs generic.
    console.error("Account-change email delivery failed")
    delivered = false
  }

  const updated = await inputTx.adminEmailIntent.update({
    where: { id: intent.id },
    data: {
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      status: delivered ? "DELIVERED" : "FAILED",
      deliveredAt: delivered ? now : null,
      failureCode: delivered ? null : "DELIVERY_FAILED",
    },
    select: { attemptCount: true, status: true },
  })

  return {
    status: updated.status === "DELIVERED" ? "DELIVERED" : "FAILED",
    attemptCount: updated.attemptCount,
    attempted: true,
  }
}

async function loadDeliveryIntent(tx: LockedClient, intentId: string) {
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
    },
  })
}

async function loadRetryIntent(tx: LockedClient, intentId: string) {
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
    || !isRetryStartStatus(beforeState.status)
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

function isRetryStartStatus(status: string): boolean {
  return status === "PENDING" || status === "FAILED"
}

function isRetryResultStatus(status: string): boolean {
  return status === "DELIVERED" || status === "FAILED"
}

function isAttemptableIntent(intent: {
  status: string
  recipientEmail: string | null
  failureCode: string | null
}): intent is { status: "PENDING" | "FAILED"; recipientEmail: string; failureCode: string | null } {
  return (intent.status === "PENDING" || intent.status === "FAILED")
    && intent.failureCode !== "RECIPIENT_UNAVAILABLE"
    && Boolean(intent.recipientEmail)
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

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002"
}
