import type { Prisma, PrismaClient } from "@prisma/client"
import { generateRandomToken, hashToken, normalizeEmail } from "../auth-security.js"
import { sendPasswordResetEmail } from "../auth-mail.ts"
import { runCommerceTransaction } from "../commerce/transactions.ts"
import { requireFullAdminUser } from "./access.ts"
import { validateAdminReason, type AdminReasonCode } from "./operation-contract.ts"
import {
  acquireAdminActionIdempotencyLock,
  recordAdminActionBundle,
  type RecordAdminActionInput,
} from "./operation-service.ts"

type AdminSecurityBaseInput = {
  prismaClient: PrismaClient
  actorUserId: string
  targetUserId: string
  reasonCode: AdminReasonCode
  internalNote: string | null
  idempotencyKey: string
}

export type RevokeUserSessionsInput = AdminSecurityBaseInput & {
  /** Canonical optimistic-lock owner for every Auth.js JWT issued to the target. */
  expectedAuthSessionVersion: number
  /** Compatibility-only count of unexpired Prisma Session rows shown at preparation time. */
  expectedSessionCount: number
  now?: Date
}

export type RevokeUserSessionsResult = {
  /** Adapter Session rows deleted for compatibility; not a count of active JWTs or users signed out. */
  revokedSessionCount: number
  beforeAuthSessionVersion: number
  afterAuthSessionVersion: number
  emailIntentId: string
  replayed: boolean
}

export type ResetUserTwoFactorInput = AdminSecurityBaseInput & {
  confirmationEmail: string
  expectedTwoFactorEnabled: true
}

export type ResetUserTwoFactorResult = {
  deletedTwoFactorSecretCount: number
  deletedBackupCodeCount: number
  /** Adapter Session rows deleted for compatibility; JWT invalidation is version-owned. */
  revokedSessionCount: number
  beforeAuthSessionVersion: number
  afterAuthSessionVersion: number
  emailIntentId: string
  replayed: boolean
}

type PasswordResetSender = typeof sendPasswordResetEmail

export type SendAdminPasswordResetInput = AdminSecurityBaseInput & {
  /** Injectable transport seam; tests must never call the real SMTP owner. */
  sendEmail?: PasswordResetSender
  /** Injectable clock/token seams are internal verification aids, never result fields. */
  now?: Date
  generateToken?: () => string
}

export type SendAdminPasswordResetResult = {
  emailIntentId: string
  replayed: boolean
  deliveryStatus: "PENDING" | "DELIVERED" | "FAILED"
  deliveryAttempted: boolean
}

type SecurityTarget = {
  id: string
  email: string | null
  emailVerified: Date | null
  authSessionVersion: number
  twoFactorSecret: { enabledAt: Date | null } | null
}

type ExistingSecurityAction = Prisma.AdminActionGetPayload<{
  include: { activity: true; emailIntent: true }
}>

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1_000

/**
 * Invalidates every older target JWT by incrementing `authSessionVersion`
 * exactly once. Prisma Session deletion remains compatibility cleanup only and
 * its count must never be presented as an active-JWT or signed-out-user count.
 */
export async function revokeUserSessions(input: RevokeUserSessionsInput): Promise<RevokeUserSessionsResult> {
  validateBaseInput(input)
  validateExpectedCount(input.expectedAuthSessionVersion, "expected authentication session version")
  validateExpectedCount(input.expectedSessionCount, "expected adapter session count")
  const now = validDateOrNow(input.now)

  return runAdminSecurityTransaction(input.prismaClient, async (tx) => {
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireSecurityActor(tx, input)
    const target = await loadSecurityTarget(tx, input.targetUserId)
    const existing = await loadExistingAction(tx, input.idempotencyKey)
    if (existing) return replaySessionRevocation(tx, input, existing)

    const activeAdapterSessionCount = await tx.session.count({
      where: { userId: input.targetUserId, expires: { gt: now } },
    })
    if (target.authSessionVersion !== input.expectedAuthSessionVersion
      || activeAdapterSessionCount !== input.expectedSessionCount) {
      throw new Error("This security state changed since the operation was prepared. Refresh the account and try again.")
    }

    const updatedTarget = await incrementAuthSessionVersion(tx, target.id)
    const { count: revokedSessionCount } = await tx.session.deleteMany({ where: { userId: target.id } })
    const bundle = await recordAdminActionBundle(tx, buildSessionRevocationBundle(input, {
      recipientEmail: verifiedRecipient(target),
      beforeAuthSessionVersion: target.authSessionVersion,
      afterAuthSessionVersion: updatedTarget.authSessionVersion,
      adapterSessionCount: activeAdapterSessionCount,
      adapterSessionRowsDeleted: revokedSessionCount,
    }))

    return {
      revokedSessionCount,
      beforeAuthSessionVersion: target.authSessionVersion,
      afterAuthSessionVersion: updatedTarget.authSessionVersion,
      emailIntentId: bundle.emailIntentId,
      replayed: bundle.replayed,
    }
  })
}

/**
 * Creates a standard password-reset token and immutable Admin evidence in one
 * transaction. The raw token exists only in this call, crosses only the
 * standard reset-mail sender after commit, and is never returned or persisted.
 * A same-key replay never sends; a failed resend must call this function with a
 * new action key so it creates a new token, action, and intent.
 */
export async function sendAdminPasswordReset(input: SendAdminPasswordResetInput): Promise<SendAdminPasswordResetResult> {
  validateBaseInput(input)
  const now = validDateOrNow(input.now)
  const transactionResult = await runAdminSecurityTransaction(input.prismaClient, async (tx) => {
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireSecurityActor(tx, input)
    const target = await loadSecurityTarget(tx, input.targetUserId)
    const existing = await loadExistingAction(tx, input.idempotencyKey)
    if (existing) {
      return {
        result: await replayPasswordReset(tx, input, existing),
        rawToken: null,
        recipientEmail: null,
      }
    }

    const recipientEmail = verifiedRecipient(target)
    if (!recipientEmail) throw new Error("Target account does not have a verified email address.")

    const rawToken = (input.generateToken ?? generateRandomToken)()
    if (typeof rawToken !== "string" || !rawToken || rawToken.length > 512 || /\s/.test(rawToken)) {
      throw new Error("Password-reset token generation failed.")
    }
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS)
    await tx.passwordResetToken.create({
      data: {
        userId: target.id,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
      select: { id: true },
    })
    const bundle = await recordAdminActionBundle(tx, buildPasswordResetBundle(input, {
      recipientEmail,
      requestedAt: now,
      expiresAt,
    }))

    return {
      result: {
        emailIntentId: bundle.emailIntentId,
        replayed: bundle.replayed,
        deliveryStatus: "PENDING" as const,
        deliveryAttempted: false,
      },
      rawToken,
      recipientEmail,
    }
  })

  if (!transactionResult.rawToken || !transactionResult.recipientEmail) return transactionResult.result

  let delivered = false
  try {
    const delivery = await (input.sendEmail ?? sendPasswordResetEmail)(
      transactionResult.recipientEmail,
      transactionResult.rawToken,
    )
    delivered = delivery.delivered === true
  } catch {
    // Provider exceptions can contain recipient, raw-token, or transport data.
    console.error("Password-reset email delivery failed")
  }

  try {
    await recordPasswordResetDelivery(
      input.prismaClient,
      transactionResult.result.emailIntentId,
      delivered,
      now,
    )
  } catch {
    // The provider outcome is uncertain once its separate durable update fails;
    // never log transport, recipient, token, or persistence error details.
    console.error("Password-reset delivery status could not be recorded")
    return {
      emailIntentId: transactionResult.result.emailIntentId,
      replayed: false,
      deliveryStatus: "PENDING",
      deliveryAttempted: true,
    }
  }
  return {
    emailIntentId: transactionResult.result.emailIntentId,
    replayed: false,
    deliveryStatus: delivered ? "DELIVERED" : "FAILED",
    deliveryAttempted: true,
  }
}

/**
 * Deletes enabled 2FA material only after exact normalized-email confirmation,
 * then increments the JWT version in the same transaction. Only row counts and
 * boolean/version evidence leave the mutation boundary.
 */
export async function resetUserTwoFactor(input: ResetUserTwoFactorInput): Promise<ResetUserTwoFactorResult> {
  validateBaseInput(input)
  if (input.expectedTwoFactorEnabled !== true) {
    throw new Error("Confirm the expected two-factor state before resetting it.")
  }

  return runAdminSecurityTransaction(input.prismaClient, async (tx) => {
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireSecurityActor(tx, input)
    const target = await loadSecurityTarget(tx, input.targetUserId)
    const confirmedEmail = normalizeEmail(input.confirmationEmail)
    if (!confirmedEmail || confirmedEmail !== normalizeEmail(target.email)) {
      throw new Error("The confirmation email does not match the target account.")
    }

    const existing = await loadExistingAction(tx, input.idempotencyKey)
    if (existing) return replayTwoFactorReset(tx, input, existing)
    if (!target.twoFactorSecret?.enabledAt) {
      throw new Error("Two-factor authentication is not enabled for this account.")
    }

    const { count: deletedTwoFactorSecretCount } = await tx.twoFactorSecret.deleteMany({ where: { userId: target.id } })
    if (deletedTwoFactorSecretCount !== 1) {
      throw new Error("Two-factor authentication changed since this operation was prepared. Refresh the account and try again.")
    }
    const { count: deletedBackupCodeCount } = await tx.backupCode.deleteMany({ where: { userId: target.id } })
    const updatedTarget = await incrementAuthSessionVersion(tx, target.id)
    const { count: revokedSessionCount } = await tx.session.deleteMany({ where: { userId: target.id } })
    const bundle = await recordAdminActionBundle(tx, buildTwoFactorResetBundle(input, {
      recipientEmail: verifiedRecipient(target),
      confirmedEmail,
      beforeAuthSessionVersion: target.authSessionVersion,
      afterAuthSessionVersion: updatedTarget.authSessionVersion,
      credentialRowsDeleted: deletedTwoFactorSecretCount,
      recoveryRowsDeleted: deletedBackupCodeCount,
      adapterSessionRowsDeleted: revokedSessionCount,
    }))

    return {
      deletedTwoFactorSecretCount,
      deletedBackupCodeCount,
      revokedSessionCount,
      beforeAuthSessionVersion: target.authSessionVersion,
      afterAuthSessionVersion: updatedTarget.authSessionVersion,
      emailIntentId: bundle.emailIntentId,
      replayed: bundle.replayed,
    }
  })
}

async function requireSecurityActor(tx: Prisma.TransactionClient, input: AdminSecurityBaseInput): Promise<void> {
  await requireFullAdminUser({ prismaClient: tx, sessionUserId: input.actorUserId })
  if (input.actorUserId === input.targetUserId) {
    throw new Error("You cannot perform security remediation on your own account.")
  }
}

class AdminSecurityIdempotencySnapshotConflict extends Error {
  readonly code = "P2034"

  constructor() {
    super("Admin security idempotency requires a fresh transaction snapshot.")
    this.name = "AdminSecurityIdempotencySnapshotConflict"
  }
}

/**
 * Preserves the shared Serializable retry/backoff owner while permitting one
 * fresh-snapshot restart for the exact AdminAction idempotency race. A waiter
 * can acquire the advisory lock after the winner commits while retaining the
 * pre-winner Serializable snapshot; its create then proves the winner through
 * this unique constraint. No other P2002 is converted or retried.
 */
async function runAdminSecurityTransaction<T>(
  prismaClient: PrismaClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let idempotencyRestartUsed = false
  return runCommerceTransaction(prismaClient, async (tx) => {
    try {
      return await callback(tx)
    } catch (error) {
      if (!idempotencyRestartUsed && isAdminActionIdempotencyUniqueRace(error)) {
        idempotencyRestartUsed = true
        // P2034 delegates the bounded restart and jitter to the established
        // transaction owner instead of implementing another retry loop here.
        throw new AdminSecurityIdempotencySnapshotConflict()
      }
      throw error
    }
  })
}

/** Requires Prisma's exact model plus single-field target; ambiguous P2002 metadata fails closed. */
function isAdminActionIdempotencyUniqueRace(error: unknown): boolean {
  try {
    if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "P2002") return false
    const meta = (error as { meta?: unknown }).meta
    if (!meta || typeof meta !== "object" || (meta as { modelName?: unknown }).modelName !== "AdminAction") return false
    const target = (meta as { target?: unknown }).target
    return Array.isArray(target) && target.length === 1 && target[0] === "idempotencyKey"
  } catch {
    return false
  }
}

async function loadSecurityTarget(tx: Prisma.TransactionClient, targetUserId: string): Promise<SecurityTarget> {
  const target = await tx.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      authSessionVersion: true,
      twoFactorSecret: { select: { enabledAt: true } },
    },
  })
  if (!target) throw new Error("Target account was not found.")
  return target
}

async function loadExistingAction(tx: Prisma.TransactionClient, idempotencyKey: string): Promise<ExistingSecurityAction | null> {
  return tx.adminAction.findUnique({
    where: { idempotencyKey },
    include: { activity: true, emailIntent: true },
  })
}

async function incrementAuthSessionVersion(tx: Prisma.TransactionClient, targetUserId: string) {
  return tx.user.update({
    where: { id: targetUserId },
    data: { authSessionVersion: { increment: 1 } },
    select: { authSessionVersion: true },
  })
}

type SessionRevocationFacts = {
  recipientEmail: string | null
  beforeAuthSessionVersion: number
  afterAuthSessionVersion: number
  adapterSessionCount: number
  adapterSessionRowsDeleted: number
}

function buildSessionRevocationBundle(input: AdminSecurityBaseInput, facts: SessionRevocationFacts): RecordAdminActionInput {
  return {
    ...bundleIdentity(input, "SESSIONS_REVOKED"),
    beforeState: {
      authSessionVersion: facts.beforeAuthSessionVersion,
      adapterSessionCount: facts.adapterSessionCount,
    },
    afterState: {
      authSessionVersion: facts.afterAuthSessionVersion,
      adapterSessionRowsDeleted: facts.adapterSessionRowsDeleted,
    },
    activity: {
      title: "Sign-in tokens invalidated",
      explanation: "Existing sign-in tokens were invalidated for your account by Massage Lab support. You will be signed out when an older token next reaches a successful database-backed session refresh.",
      effectiveValue: "Security refresh required",
    },
    email: {
      kind: "SESSIONS_REVOKED",
      recipientEmail: facts.recipientEmail,
      subject: "Your Massage Lab sign-in tokens were invalidated",
      message: "Existing sign-in tokens were invalidated for your account by Massage Lab support. You will be signed out when an older token next reaches a successful database-backed session refresh. If you did not expect this action, contact Massage Lab support.",
    },
  }
}

type TwoFactorResetFacts = {
  recipientEmail: string | null
  confirmedEmail: string
  beforeAuthSessionVersion: number
  afterAuthSessionVersion: number
  credentialRowsDeleted: number
  recoveryRowsDeleted: number
  adapterSessionRowsDeleted: number
}

function buildTwoFactorResetBundle(input: AdminSecurityBaseInput, facts: TwoFactorResetFacts): RecordAdminActionInput {
  return {
    ...bundleIdentity(input, "TWO_FACTOR_RESET"),
    beforeState: {
      twoFactorEnabled: true,
      confirmedEmail: facts.confirmedEmail,
      authSessionVersion: facts.beforeAuthSessionVersion,
    },
    afterState: {
      twoFactorEnabled: false,
      authSessionVersion: facts.afterAuthSessionVersion,
      credentialRowsDeleted: facts.credentialRowsDeleted,
      recoveryRowsDeleted: facts.recoveryRowsDeleted,
      adapterSessionRowsDeleted: facts.adapterSessionRowsDeleted,
    },
    activity: {
      title: "Two-factor authentication reset",
      explanation: "Massage Lab support reset two-factor authentication for your account and invalidated existing sign-in tokens. You can configure two-factor authentication again from Account Security.",
      effectiveValue: "Two-factor authentication off",
    },
    email: {
      kind: "TWO_FACTOR_RESET",
      recipientEmail: facts.recipientEmail,
      subject: "Your Massage Lab two-factor authentication was reset",
      message: "Massage Lab support reset two-factor authentication for your account and invalidated existing sign-in tokens. You can configure two-factor authentication again from Account Security. If you did not expect this action, contact Massage Lab support.",
    },
  }
}

function buildPasswordResetBundle(input: AdminSecurityBaseInput, facts: {
  recipientEmail: string
  requestedAt: Date
  expiresAt: Date
}): RecordAdminActionInput {
  return {
    ...bundleIdentity(input, "PASSWORD_RESET_REQUESTED"),
    beforeState: { resetRequestState: "NONE" },
    afterState: {
      resetRequestState: "CREATED",
      requestedAt: facts.requestedAt.toISOString(),
      expiresAt: facts.expiresAt.toISOString(),
    },
    activity: {
      title: "Password reset requested",
      explanation: "Massage Lab support requested a password-reset email for your account. The secure link expires 60 minutes after it is created.",
      effectiveValue: "Reset email requested",
    },
    email: {
      kind: "PASSWORD_RESET",
      recipientEmail: facts.recipientEmail,
      subject: "Reset your MassageLab password",
      message: "A standard secure password-reset message was requested. The reset link is generated only for delivery and is not stored in this administrative record.",
    },
  }
}

function bundleIdentity(input: AdminSecurityBaseInput, actionKind: string) {
  return {
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    actionKind,
    reasonCode: input.reasonCode,
    internalNote: input.internalNote,
    idempotencyKey: input.idempotencyKey,
  }
}

async function replaySessionRevocation(
  tx: Prisma.TransactionClient,
  input: RevokeUserSessionsInput,
  existing: ExistingSecurityAction,
): Promise<RevokeUserSessionsResult> {
  const before = readSessionRevocationBefore(existing.beforeState)
  const after = readSessionRevocationAfter(existing.afterState)
  assertReplayIdentity(existing, input, "SESSIONS_REVOKED")
  if (!before || !after
    || before.authSessionVersion !== input.expectedAuthSessionVersion
    || before.adapterSessionCount !== input.expectedSessionCount
    || after.authSessionVersion !== before.authSessionVersion + 1
    || after.adapterSessionRowsDeleted < before.adapterSessionCount
    || !existing.emailIntent) {
    throw operationKeyInUse()
  }

  const bundle = await recordAdminActionBundle(tx, buildSessionRevocationBundle(input, {
    recipientEmail: existing.emailIntent.recipientEmail,
    beforeAuthSessionVersion: before.authSessionVersion,
    afterAuthSessionVersion: after.authSessionVersion,
    adapterSessionCount: before.adapterSessionCount,
    adapterSessionRowsDeleted: after.adapterSessionRowsDeleted,
  }))
  return {
    revokedSessionCount: after.adapterSessionRowsDeleted,
    beforeAuthSessionVersion: before.authSessionVersion,
    afterAuthSessionVersion: after.authSessionVersion,
    emailIntentId: bundle.emailIntentId,
    replayed: bundle.replayed,
  }
}

async function replayTwoFactorReset(
  tx: Prisma.TransactionClient,
  input: ResetUserTwoFactorInput,
  existing: ExistingSecurityAction,
): Promise<ResetUserTwoFactorResult> {
  const before = readTwoFactorBefore(existing.beforeState)
  const after = readTwoFactorAfter(existing.afterState)
  assertReplayIdentity(existing, input, "TWO_FACTOR_RESET")
  if (!before || !after
    || before.twoFactorEnabled !== true
    || before.confirmedEmail !== normalizeEmail(input.confirmationEmail)
    || after.twoFactorEnabled !== false
    || after.authSessionVersion !== before.authSessionVersion + 1
    || after.credentialRowsDeleted !== 1
    || !existing.emailIntent) {
    throw operationKeyInUse()
  }

  const bundle = await recordAdminActionBundle(tx, buildTwoFactorResetBundle(input, {
    recipientEmail: existing.emailIntent.recipientEmail,
    confirmedEmail: before.confirmedEmail,
    beforeAuthSessionVersion: before.authSessionVersion,
    afterAuthSessionVersion: after.authSessionVersion,
    credentialRowsDeleted: after.credentialRowsDeleted,
    recoveryRowsDeleted: after.recoveryRowsDeleted,
    adapterSessionRowsDeleted: after.adapterSessionRowsDeleted,
  }))
  return {
    deletedTwoFactorSecretCount: after.credentialRowsDeleted,
    deletedBackupCodeCount: after.recoveryRowsDeleted,
    revokedSessionCount: after.adapterSessionRowsDeleted,
    beforeAuthSessionVersion: before.authSessionVersion,
    afterAuthSessionVersion: after.authSessionVersion,
    emailIntentId: bundle.emailIntentId,
    replayed: bundle.replayed,
  }
}

async function replayPasswordReset(
  tx: Prisma.TransactionClient,
  input: SendAdminPasswordResetInput,
  existing: ExistingSecurityAction,
): Promise<SendAdminPasswordResetResult> {
  assertReplayIdentity(existing, input, "PASSWORD_RESET_REQUESTED")
  const timing = readPasswordResetTiming(existing.afterState)
  if (!timing || !existing.emailIntent || !isCoherentPasswordResetIntent(existing.emailIntent)
    || timing.expiresAt.getTime() - timing.requestedAt.getTime() !== PASSWORD_RESET_TTL_MS) {
    throw operationKeyInUse()
  }

  const bundle = await recordAdminActionBundle(tx, buildPasswordResetBundle(input, {
    recipientEmail: existing.emailIntent.recipientEmail,
    requestedAt: timing.requestedAt,
    expiresAt: timing.expiresAt,
  }))
  return {
    emailIntentId: bundle.emailIntentId,
    replayed: bundle.replayed,
    deliveryStatus: emailIntentStatus(existing.emailIntent.status),
    deliveryAttempted: false,
  }
}

async function recordPasswordResetDelivery(
  prismaClient: PrismaClient,
  intentId: string,
  delivered: boolean,
  now: Date,
): Promise<void> {
  await prismaClient.$transaction(async (tx) => {
    await tx.adminEmailIntent.update({
      where: { id: intentId },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        status: delivered ? "DELIVERED" : "FAILED",
        deliveredAt: delivered ? now : null,
        failureCode: delivered ? null : "DELIVERY_FAILED",
      },
      select: { id: true },
    })
  }, { isolationLevel: "Serializable" })
}

function validateBaseInput(input: AdminSecurityBaseInput): void {
  for (const [value, label] of [
    [input.actorUserId, "actor"],
    [input.targetUserId, "target"],
    [input.idempotencyKey, "operation key"],
  ] as const) {
    if (typeof value !== "string" || !value.trim() || value.length > 191 || /[\r\n]/.test(value)) {
      throw new Error(`Provide a valid ${label}.`)
    }
  }
  if (input.internalNote !== null && typeof input.internalNote !== "string") {
    throw new Error("Internal notes must be text.")
  }
  validateAdminReason(input.reasonCode, input.internalNote)
}

function validateExpectedCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Provide a valid ${label}.`)
}

function validDateOrNow(value: Date | undefined): Date {
  if (value === undefined) return new Date()
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("Provide a valid operation time.")
  return new Date(value)
}

function verifiedRecipient(target: SecurityTarget): string | null {
  const email = normalizeEmail(target.email)
  return target.emailVerified && email ? email : null
}

function assertReplayIdentity(existing: ExistingSecurityAction, input: AdminSecurityBaseInput, actionKind: string): void {
  if (existing.actorUserId !== input.actorUserId
    || existing.targetUserId !== input.targetUserId
    || existing.actionKind !== actionKind
    || existing.reasonCode !== input.reasonCode
    || existing.internalNote !== input.internalNote) {
    throw operationKeyInUse()
  }
}

function operationKeyInUse(): Error {
  return new Error("This administrative operation key is already in use.")
}

function emailIntentStatus(value: string): SendAdminPasswordResetResult["deliveryStatus"] {
  if (value === "PENDING" || value === "DELIVERED" || value === "FAILED") return value
  throw new Error("The existing password-reset delivery record is incomplete.")
}

function readSessionRevocationBefore(value: Prisma.JsonValue): { authSessionVersion: number; adapterSessionCount: number } | null {
  const record = jsonRecord(value)
  return record && safeCount(record.authSessionVersion) !== null && safeCount(record.adapterSessionCount) !== null
    ? { authSessionVersion: record.authSessionVersion as number, adapterSessionCount: record.adapterSessionCount as number }
    : null
}

function readSessionRevocationAfter(value: Prisma.JsonValue): { authSessionVersion: number; adapterSessionRowsDeleted: number } | null {
  const record = jsonRecord(value)
  return record && safeCount(record.authSessionVersion) !== null && safeCount(record.adapterSessionRowsDeleted) !== null
    ? { authSessionVersion: record.authSessionVersion as number, adapterSessionRowsDeleted: record.adapterSessionRowsDeleted as number }
    : null
}

function readTwoFactorBefore(value: Prisma.JsonValue): { twoFactorEnabled: boolean; confirmedEmail: string; authSessionVersion: number } | null {
  const record = jsonRecord(value)
  return record && typeof record.twoFactorEnabled === "boolean" && isNormalizedEmail(record.confirmedEmail)
    && safeCount(record.authSessionVersion) !== null
    ? {
        twoFactorEnabled: record.twoFactorEnabled,
        confirmedEmail: record.confirmedEmail,
        authSessionVersion: record.authSessionVersion as number,
      }
    : null
}

function readTwoFactorAfter(value: Prisma.JsonValue): {
  twoFactorEnabled: boolean
  authSessionVersion: number
  credentialRowsDeleted: number
  recoveryRowsDeleted: number
  adapterSessionRowsDeleted: number
} | null {
  const record = jsonRecord(value)
  if (!record || typeof record.twoFactorEnabled !== "boolean") return null
  for (const key of ["authSessionVersion", "credentialRowsDeleted", "recoveryRowsDeleted", "adapterSessionRowsDeleted"] as const) {
    if (safeCount(record[key]) === null) return null
  }
  return record as ReturnType<typeof readTwoFactorAfter>
}

function readPasswordResetTiming(value: Prisma.JsonValue): { requestedAt: Date; expiresAt: Date } | null {
  const record = jsonRecord(value)
  if (!record || record.resetRequestState !== "CREATED" || typeof record.requestedAt !== "string" || typeof record.expiresAt !== "string") return null
  const requestedAt = new Date(record.requestedAt)
  const expiresAt = new Date(record.expiresAt)
  return Number.isFinite(requestedAt.getTime()) && Number.isFinite(expiresAt.getTime())
    ? { requestedAt, expiresAt }
    : null
}

function jsonRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : null
}

function safeCount(value: Prisma.JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function isNormalizedEmail(value: Prisma.JsonValue | null): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 320
    && normalizeEmail(value) === value
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Rejects impossible password-intent states before replaying them through the bundle owner. */
function isCoherentPasswordResetIntent(intent: NonNullable<ExistingSecurityAction["emailIntent"]>): intent is NonNullable<ExistingSecurityAction["emailIntent"]> & { recipientEmail: string } {
  if (intent.kind !== "PASSWORD_RESET" || !isNormalizedEmail(intent.recipientEmail)) return false
  if (!Number.isSafeInteger(intent.attemptCount) || intent.attemptCount < 0) return false
  if (intent.status === "PENDING") {
    return intent.attemptCount === 0 && intent.lastAttemptAt === null && intent.deliveredAt === null && intent.failureCode === null
  }
  if (intent.status === "DELIVERED") {
    return intent.attemptCount > 0 && intent.lastAttemptAt instanceof Date && intent.deliveredAt instanceof Date && intent.failureCode === null
  }
  if (intent.status === "FAILED") {
    return intent.attemptCount > 0 && intent.lastAttemptAt instanceof Date && intent.deliveredAt === null && intent.failureCode === "DELIVERY_FAILED"
  }
  return false
}
