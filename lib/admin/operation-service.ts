import { Prisma } from "@prisma/client"
import { normalizeEmail } from "../auth-security.js"
import { validateAdminReason, validateAdminSafePayload, type AdminReasonCode, type AdminSafePayload } from "./operation-contract.ts"

export type RecordAdminActionInput = {
  actorUserId: string
  targetUserId: string
  actionKind: string
  reasonCode: AdminReasonCode
  internalNote: string | null
  idempotencyKey: string
  beforeState: Record<string, unknown>
  afterState: Record<string, unknown>
  activity: {
    title: string
    explanation: string
    effectiveValue: string | null
  }
  email: {
    kind: string
    recipientEmail: string | null
    subject: string
    message: string
  }
}

const ADMIN_IDENTIFIER_MAX_LENGTH = 191
const ADMIN_ACTION_KIND_MAX_LENGTH = 120
const ADMIN_ACTIVITY_TITLE_MAX_LENGTH = 200
const ADMIN_ACTIVITY_EXPLANATION_MAX_LENGTH = 1_000
const ADMIN_ACTIVITY_VALUE_MAX_LENGTH = 500
const ADMIN_EMAIL_SUBJECT_MAX_LENGTH = 200
const ADMIN_EMAIL_MESSAGE_MAX_LENGTH = 5_000
export const ADMIN_ACTION_IDEMPOTENCY_LOCK_PREFIX = "admin-action-idempotency:"

/**
 * Creates the immutable audit record, target-visible activity, and durable
 * email intent through a caller-owned transaction. It deliberately performs no
 * email delivery and never opens a nested transaction, so callers can make the
 * account mutation and this bundle succeed or roll back together.
 */
export async function recordAdminActionBundle(
  tx: Prisma.TransactionClient,
  input: RecordAdminActionInput,
): Promise<{ adminActionId: string; emailIntentId: string; replayed: boolean }> {
  const normalized = normalizeRecordInput(input)
  await acquireAdminActionIdempotencyLock(tx, normalized.idempotencyKey)
  const existing = await tx.adminAction.findUnique({
    where: { idempotencyKey: normalized.idempotencyKey },
    include: { activity: true, emailIntent: true },
  })

  if (existing) {
    if (!isExactBundleReplay(existing, normalized) || !existing.emailIntent) {
      throw new Error("This administrative operation key is already in use.")
    }

    return { adminActionId: existing.id, emailIntentId: existing.emailIntent.id, replayed: true }
  }

  const action = await tx.adminAction.create({
    data: {
      actorUserId: normalized.actorUserId,
      targetUserId: normalized.targetUserId,
      actionKind: normalized.actionKind,
      reasonCode: normalized.reasonCode,
      internalNote: normalized.internalNote,
      idempotencyKey: normalized.idempotencyKey,
      beforeState: normalized.beforeState,
      afterState: normalized.afterState,
      outcome: "SUCCEEDED",
      failureCode: null,
    },
    select: { id: true },
  })

  await tx.userAccountActivity.create({
    data: {
      userId: normalized.targetUserId,
      adminActionId: action.id,
      title: normalized.activity.title,
      explanation: normalized.activity.explanation,
      effectiveValue: normalized.activity.effectiveValue,
    },
  })

  const intent = await tx.adminEmailIntent.create({
    data: {
      userId: normalized.targetUserId,
      adminActionId: action.id,
      kind: normalized.email.kind,
      recipientEmail: normalized.email.recipientEmail,
      subject: normalized.email.subject,
      message: normalized.email.message,
      status: normalized.email.recipientEmail ? "PENDING" : "FAILED",
      failureCode: normalized.email.recipientEmail ? null : "RECIPIENT_UNAVAILABLE",
    },
    select: { id: true },
  })

  return { adminActionId: action.id, emailIntentId: intent.id, replayed: false }
}

type NormalizedRecordInput = Omit<RecordAdminActionInput, "beforeState" | "afterState" | "email"> & {
  beforeState: AdminSafePayload
  afterState: AdminSafePayload
  email: RecordAdminActionInput["email"] & { recipientEmail: string | null }
}

function normalizeRecordInput(input: RecordAdminActionInput): NormalizedRecordInput {
  validateIdentifier(input.actorUserId, "actor")
  validateIdentifier(input.targetUserId, "target")
  validateText(input.actionKind, ADMIN_ACTION_KIND_MAX_LENGTH, "action kind")
  validateIdentifier(input.idempotencyKey, "operation key")

  if (input.internalNote !== null && typeof input.internalNote !== "string") {
    throw new Error("Internal notes must be text.")
  }
  validateAdminReason(input.reasonCode, input.internalNote)

  validateText(input.activity.title, ADMIN_ACTIVITY_TITLE_MAX_LENGTH, "activity title")
  validateText(input.activity.explanation, ADMIN_ACTIVITY_EXPLANATION_MAX_LENGTH, "activity explanation")
  validateNullableText(input.activity.effectiveValue, ADMIN_ACTIVITY_VALUE_MAX_LENGTH, "activity value")
  validateText(input.email.kind, ADMIN_ACTION_KIND_MAX_LENGTH, "email kind")
  validateText(input.email.subject, ADMIN_EMAIL_SUBJECT_MAX_LENGTH, "email subject")
  validateText(input.email.message, ADMIN_EMAIL_MESSAGE_MAX_LENGTH, "email message", true)

  const recipientEmail = normalizeRecipientEmail(input.email.recipientEmail)
  return {
    ...input,
    beforeState: validateAdminSafePayload(input.beforeState),
    afterState: validateAdminSafePayload(input.afterState),
    email: { ...input.email, recipientEmail },
  }
}

function validateIdentifier(value: string, label: string): void {
  validateText(value, ADMIN_IDENTIFIER_MAX_LENGTH, label)
}

function validateNullableText(value: string | null, maxLength: number, label: string): void {
  if (value !== null) validateText(value, maxLength, label)
}

function validateText(value: string, maxLength: number, label: string, allowLineBreaks = false): void {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength || (!allowLineBreaks && /[\r\n]/.test(value))) {
    throw new Error(`Provide a valid ${label}.`)
  }
}

function normalizeRecipientEmail(value: string | null): string | null {
  if (value === null) return null
  const normalized = normalizeEmail(value)
  if (!normalized) return null
  if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Provide a valid recipient email.")
  }
  return normalized
}

function isExactBundleReplay(existing: {
  id: string
  actorUserId: string
  targetUserId: string
  actionKind: string
  reasonCode: string
  internalNote: string | null
  beforeState: Prisma.JsonValue
  afterState: Prisma.JsonValue
  outcome: string
  failureCode: string | null
  activity: {
    id: string
    userId: string
    adminActionId: string
    title: string
    explanation: string
    effectiveValue: string | null
  } | null
  emailIntent: {
    id: string
    userId: string
    adminActionId: string
    kind: string
    recipientEmail: string | null
    subject: string
    message: string
    status: string
    attemptCount: number
    lastAttemptAt: Date | null
    deliveredAt: Date | null
    failureCode: string | null
  } | null
}, input: NormalizedRecordInput): boolean {
  const activity = existing.activity
  const emailIntent = existing.emailIntent
  return existing.actorUserId === input.actorUserId
    && existing.targetUserId === input.targetUserId
    && existing.actionKind === input.actionKind
    && existing.reasonCode === input.reasonCode
    && existing.internalNote === input.internalNote
    && existing.outcome === "SUCCEEDED"
    && existing.failureCode === null
    && hasSameCanonicalJson(existing.beforeState, input.beforeState)
    && hasSameCanonicalJson(existing.afterState, input.afterState)
    && activity?.id != null
    && activity.userId === input.targetUserId
    && activity.adminActionId === existing.id
    && activity.title === input.activity.title
    && activity.explanation === input.activity.explanation
    && activity.effectiveValue === input.activity.effectiveValue
    && emailIntent?.id != null
    && emailIntent.userId === input.targetUserId
    && emailIntent.adminActionId === existing.id
    && emailIntent.kind === input.email.kind
    && emailIntent.recipientEmail === input.email.recipientEmail
    && emailIntent.subject === input.email.subject
    && emailIntent.message === input.email.message
    && hasCoherentEmailIntentState(emailIntent)
}

/** Serialization failures are mismatches, even when both values fail alike. */
function hasSameCanonicalJson(left: unknown, right: unknown): boolean {
  const canonicalLeft = canonicalJson(left)
  const canonicalRight = canonicalJson(right)
  return canonicalLeft !== null && canonicalRight !== null && canonicalLeft === canonicalRight
}

/** Acquires the shared action-key lock used by all writers before idempotency lookup. */
export async function acquireAdminActionIdempotencyLock(tx: Prisma.TransactionClient, idempotencyKey: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ADMIN_ACTION_IDEMPOTENCY_LOCK_PREFIX}${idempotencyKey}`}, 0))`)
}

function hasCoherentEmailIntentState(intent: NonNullable<Parameters<typeof isExactBundleReplay>[0]["emailIntent"]>): boolean {
  if (!Number.isSafeInteger(intent.attemptCount) || intent.attemptCount < 0) return false
  if (intent.recipientEmail === null) {
    return intent.status === "FAILED"
      && intent.failureCode === "RECIPIENT_UNAVAILABLE"
      && intent.attemptCount === 0
      && intent.lastAttemptAt === null
      && intent.deliveredAt === null
  }
  if (intent.status === "PENDING") {
    return intent.attemptCount === 0 && intent.lastAttemptAt === null && intent.deliveredAt === null && intent.failureCode === null
  }
  if (intent.status === "DELIVERED") {
    return intent.attemptCount > 0 && intent.lastAttemptAt instanceof Date && intent.deliveredAt instanceof Date && intent.failureCode === null
  }
  if (intent.status === "FAILED") {
    return intent.failureCode === "DELIVERY_FAILED" && intent.attemptCount > 0 && intent.lastAttemptAt instanceof Date && intent.deliveredAt === null
  }
  return false
}

/** Canonicalizes JSON-object key order so semantic snapshots replay reliably. */
function canonicalJson(value: unknown): string | null {
  try {
    return JSON.stringify(sortJsonValue(value))
  } catch {
    return null
  }
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, sortJsonValue((value as Record<string, unknown>)[key])]))
  }
  return value
}
