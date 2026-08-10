import type { Prisma, PrismaClient } from "@prisma/client"
import { createHash } from "node:crypto"
import { normalizeEmail } from "../auth-security.js"
import { runCommerceTransaction } from "../commerce/transactions.ts"
import { requireFullAdminUser } from "./access.ts"
import { validateAdminReason, type AdminReasonCode } from "./operation-contract.ts"
import {
  acquireAdminActionIdempotencyLock,
  recordAdminActionBundle,
  type RecordAdminActionInput,
} from "./operation-service.ts"

export const ADMIN_GRANTABLE_FEATURE_KEYS = Object.freeze([
  "premium_backgrounds",
  "therapist_documentation_tools",
  "calendar_basic_scheduling",
  "calendar_full_scheduling",
  "external_calendar_sync",
] as const)

export type AdminGrantableFeatureKey = typeof ADMIN_GRANTABLE_FEATURE_KEYS[number]

/** One feature can retain at most this many independently revocable active grants. */
export const PER_FEATURE_ACTIVE_LIMIT = 100
/** The allowlist-wide ceiling lets every feature reach its per-feature maximum. */
export const TOTAL_ACTIVE_LIMIT = PER_FEATURE_ACTIVE_LIMIT * ADMIN_GRANTABLE_FEATURE_KEYS.length

type TemporaryAccessBaseInput = {
  prismaClient: PrismaClient
  actorUserId: string
  targetUserId: string
  expectedActiveGrantIds: string[]
  reasonCode: AdminReasonCode
  internalNote: string | null
  idempotencyKey: string
  /** Injectable clock used by deterministic service tests; production omits it. */
  now?: Date
}

export type GrantTemporaryFeatureAccessInput = TemporaryAccessBaseInput & {
  featureKey: AdminGrantableFeatureKey
  durationDays: number
}

export type RevokeTemporaryFeatureAccessInput = TemporaryAccessBaseInput & {
  grantId: string
}

export type TemporaryFeatureAccessMutationResult = {
  grantId: string
  featureKey: AdminGrantableFeatureKey
  effective: boolean
  expiresAt: string
  replayed: boolean
  emailIntentId: string
}

export type ActiveTemporaryFeatureAccess = {
  grantId: string
  featureKey: AdminGrantableFeatureKey
  startsAt: string
  expiresAt: string
}

type TemporaryAccessReader = Pick<PrismaClient, "temporaryFeatureGrant">
type ExistingAdminAction = Prisma.AdminActionGetPayload<{
  include: { activity: true; emailIntent: true }
}>

const ADMIN_GRANTABLE_FEATURE_KEY_SET = new Set<string>(ADMIN_GRANTABLE_FEATURE_KEYS)
const TEMPORARY_ACCESS_MIN_DAYS = 1
const TEMPORARY_ACCESS_MAX_DAYS = 365
const TEMPORARY_ACCESS_DAY_MS = 24 * 60 * 60 * 1_000

/**
 * Creates one immediately active, expiring grant. The append-only grant and
 * Admin evidence bundle commit in the same serializable transaction; transport
 * remains owned by the existing post-commit email-intent path.
 */
export async function grantTemporaryFeatureAccess(
  input: GrantTemporaryFeatureAccessInput,
): Promise<TemporaryFeatureAccessMutationResult> {
  validateBaseMutationInput(input)
  assertGrantableFeatureKey(input.featureKey)
  if (!Number.isInteger(input.durationDays)
    || input.durationDays < TEMPORARY_ACCESS_MIN_DAYS
    || input.durationDays > TEMPORARY_ACCESS_MAX_DAYS) {
    throw new Error("Temporary access must last a whole number of days from 1 through 365.")
  }
  const now = captureNow(input.now)

  return runTemporaryAccessTransaction(input.prismaClient, async (tx) => {
    // Lock first. A waiter whose pre-lock Serializable snapshot cannot see the
    // winner is restarted only after an exact committed uniqueness conflict.
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireFullAdminUser({ prismaClient: tx, sessionUserId: input.actorUserId })
    const target = await loadTarget(tx, input.targetUserId)
    const existing = await loadExistingAction(tx, input.idempotencyKey)
    if (existing) return replayExistingGrant(tx, input, existing)

    const activeGrantIds = await loadExactActiveGrantIds(tx, input.targetUserId, input.featureKey, now)
    requireMatchingActiveSnapshot(activeGrantIds, input.expectedActiveGrantIds)
    if (activeGrantIds.length >= PER_FEATURE_ACTIVE_LIMIT) {
      throw new Error(`Temporary access has reached the active grant limit of ${PER_FEATURE_ACTIVE_LIMIT} for this feature.`)
    }
    const startsAt = new Date(now)
    const expiresAt = new Date(now.getTime() + input.durationDays * TEMPORARY_ACCESS_DAY_MS)
    const grant = await tx.temporaryFeatureGrant.create({
      data: {
        userId: input.targetUserId,
        featureKey: input.featureKey,
        startsAt,
        expiresAt,
        grantedById: input.actorUserId,
        reasonCode: input.reasonCode,
        internalNote: input.internalNote,
        idempotencyKey: input.idempotencyKey,
      },
    })
    const bundle = await recordAdminActionBundle(tx, buildGrantBundle(input, {
      grantId: grant.id,
      startsAt,
      expiresAt,
      recipientEmail: target.email,
    }))

    return mutationResult(grant.id, input.featureKey, true, expiresAt, bundle.replayed, bundle.emailIntentId)
  })
}

/**
 * Revokes one currently active grant by appending a distinct revocation row.
 * The original grant is never updated or deleted, and another overlapping
 * active grant keeps the temporary feature effective.
 */
export async function revokeTemporaryFeatureAccess(
  input: RevokeTemporaryFeatureAccessInput,
): Promise<TemporaryFeatureAccessMutationResult> {
  validateBaseMutationInput(input)
  validateIdentifier(input.grantId, "grant")
  if (!input.expectedActiveGrantIds.includes(input.grantId)) {
    throw new Error("The active grant snapshot must include the grant being revoked.")
  }
  const now = captureNow(input.now)

  return runTemporaryAccessTransaction(input.prismaClient, async (tx) => {
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireFullAdminUser({ prismaClient: tx, sessionUserId: input.actorUserId })
    const target = await loadTarget(tx, input.targetUserId)
    const existing = await loadExistingAction(tx, input.idempotencyKey)
    if (existing) return replayExistingRevocation(tx, input, existing)

    const grant = await tx.temporaryFeatureGrant.findUnique({
      where: { id: input.grantId },
      include: { revocation: true },
    })
    if (!grant || grant.userId !== input.targetUserId) {
      throw new Error("The temporary feature grant does not belong to this target account.")
    }
    assertGrantableFeatureKey(grant.featureKey)
    const activeGrantIds = await loadExactActiveGrantIds(tx, input.targetUserId, grant.featureKey, now)
    requireMatchingActiveSnapshot(activeGrantIds, input.expectedActiveGrantIds)
    if (grant.revocation || grant.startsAt.getTime() > now.getTime() || grant.expiresAt.getTime() <= now.getTime()) {
      throw new Error("Only an active temporary feature grant can be revoked.")
    }

    const effective = activeGrantIds.some((grantId) => grantId !== grant.id)
    await tx.temporaryFeatureGrantRevocation.create({
      data: {
        grantId: grant.id,
        revokedById: input.actorUserId,
        reasonCode: input.reasonCode,
        internalNote: input.internalNote,
        idempotencyKey: input.idempotencyKey,
        revokedAt: now,
      },
    })
    const bundle = await recordAdminActionBundle(tx, buildRevocationBundle(input, {
      featureKey: grant.featureKey,
      startsAt: grant.startsAt,
      expiresAt: grant.expiresAt,
      revokedAt: now,
      effective,
      recipientEmail: target.email,
    }))

    return mutationResult(grant.id, grant.featureKey, effective, grant.expiresAt, bundle.replayed, bundle.emailIntentId)
  })
}

/**
 * Returns every active allowlisted grant using the canonical half-open time
 * interval and deterministic expiry/id order. The query reads one sentinel
 * row beyond the allowlist-wide ceiling so corrupted state fails closed rather
 * than returning a partial entitlement projection.
 */
export async function listActiveTemporaryFeatureAccess(input: {
  prismaClient: TemporaryAccessReader
  userId: string
  now?: Date
}): Promise<ActiveTemporaryFeatureAccess[]> {
  validateIdentifier(input.userId, "user")
  const now = captureNow(input.now)
  const grants = await input.prismaClient.temporaryFeatureGrant.findMany({
    where: activeGrantWhere(input.userId, now),
    select: { id: true, featureKey: true, startsAt: true, expiresAt: true },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: TOTAL_ACTIVE_LIMIT + 1,
  })
  if (grants.length > TOTAL_ACTIVE_LIMIT) {
    throw new Error(`Temporary access has more than ${TOTAL_ACTIVE_LIMIT} active grants and cannot be listed safely.`)
  }

  return grants.map((grant) => {
    assertGrantableFeatureKey(grant.featureKey)
    return {
      grantId: grant.id,
      featureKey: grant.featureKey,
      startsAt: grant.startsAt.toISOString(),
      expiresAt: grant.expiresAt.toISOString(),
    }
  })
}

function validateBaseMutationInput(input: TemporaryAccessBaseInput): void {
  validateIdentifier(input.actorUserId, "actor")
  validateIdentifier(input.targetUserId, "target")
  validateIdentifier(input.idempotencyKey, "operation key")
  if (input.internalNote !== null && typeof input.internalNote !== "string") {
    throw new Error("Internal notes must be text.")
  }
  validateAdminReason(input.reasonCode, input.internalNote)
  normalizeExpectedActiveGrantIds(input.expectedActiveGrantIds)
}

function validateIdentifier(value: string, label: string): void {
  if (typeof value !== "string" || !value.trim() || value.length > 191 || /[\r\n]/.test(value)) {
    throw new Error(`Provide a valid ${label}.`)
  }
}

function normalizeExpectedActiveGrantIds(value: string[]): string[] {
  if (!Array.isArray(value) || value.length > PER_FEATURE_ACTIVE_LIMIT) {
    throw new Error("Provide a valid active grant snapshot.")
  }
  for (const grantId of value) validateIdentifier(grantId, "active grant snapshot")
  const normalized = [...value].sort()
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Provide a valid active grant snapshot.")
  }
  return normalized
}

function assertGrantableFeatureKey(value: string): asserts value is AdminGrantableFeatureKey {
  if (!ADMIN_GRANTABLE_FEATURE_KEY_SET.has(value)) {
    throw new Error("Select a valid temporary access feature.")
  }
}

function captureNow(value?: Date): Date {
  const now = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid operation time.")
  return now
}

async function loadTarget(tx: Prisma.TransactionClient, targetUserId: string) {
  const target = await tx.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, emailVerified: true },
  })
  if (!target) throw new Error("Target account was not found.")
  const email = normalizeEmail(target.email)
  if (!target.emailVerified || !email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Temporary access requires a verified target account with an email.")
  }
  return { id: target.id, email }
}

async function loadExistingAction(tx: Prisma.TransactionClient, idempotencyKey: string): Promise<ExistingAdminAction | null> {
  return tx.adminAction.findUnique({
    where: { idempotencyKey },
    include: { activity: true, emailIntent: true },
  })
}

function activeGrantWhere(userId: string, now: Date, featureKey?: AdminGrantableFeatureKey) {
  return {
    userId,
    featureKey: featureKey ?? { in: [...ADMIN_GRANTABLE_FEATURE_KEYS] },
    startsAt: { lte: now },
    expiresAt: { gt: now },
    revocation: null,
  }
}

async function loadExactActiveGrantIds(
  tx: Prisma.TransactionClient,
  userId: string,
  featureKey: AdminGrantableFeatureKey,
  now: Date,
): Promise<string[]> {
  const grants = await tx.temporaryFeatureGrant.findMany({
    where: activeGrantWhere(userId, now, featureKey),
    select: { id: true },
    orderBy: { id: "asc" },
    take: PER_FEATURE_ACTIVE_LIMIT + 1,
  })
  if (grants.length > PER_FEATURE_ACTIVE_LIMIT) {
    throw new Error("Temporary access has too many active grants to change safely.")
  }
  return grants.map((grant) => grant.id).sort()
}

function requireMatchingActiveSnapshot(actual: string[], expected: string[]): void {
  const normalizedExpected = normalizeExpectedActiveGrantIds(expected)
  if (actual.length !== normalizedExpected.length
    || actual.some((grantId, index) => grantId !== normalizedExpected[index])) {
    throw new Error("Temporary access changed since this operation was prepared. Refresh the account and try again.")
  }
}

class TemporaryAccessIdempotencySnapshotConflict extends Error {
  readonly code = "P2034"

  constructor() {
    super("Temporary access idempotency requires a fresh transaction snapshot.")
    this.name = "TemporaryAccessIdempotencySnapshotConflict"
  }
}

/**
 * Delegates retries to the established serializable transaction owner while
 * allowing one fresh-snapshot restart for only the unique constraints that can
 * prove a concurrent temporary-access or Admin evidence writer committed.
 */
async function runTemporaryAccessTransaction<T>(
  prismaClient: PrismaClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let snapshotRestartUsed = false
  return runCommerceTransaction(prismaClient, async (tx) => {
    try {
      return await callback(tx)
    } catch (error) {
      if (!snapshotRestartUsed && isTemporaryAccessUniqueRace(error)) {
        snapshotRestartUsed = true
        throw new TemporaryAccessIdempotencySnapshotConflict()
      }
      throw error
    }
  })
}

/** Exact model/field matching keeps unrelated uniqueness failures fail-closed. */
function isTemporaryAccessUniqueRace(error: unknown): boolean {
  try {
    if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "P2002") return false
    const meta = (error as { meta?: unknown }).meta
    if (!meta || typeof meta !== "object") return false
    const modelName = (meta as { modelName?: unknown }).modelName
    const target = (meta as { target?: unknown }).target
    if (!Array.isArray(target) || target.length !== 1 || typeof target[0] !== "string") return false

    return (modelName === "TemporaryFeatureGrant" && target[0] === "idempotencyKey")
      || (modelName === "TemporaryFeatureGrantRevocation"
        && (target[0] === "idempotencyKey" || target[0] === "grantId"))
      || (modelName === "AdminAction" && target[0] === "idempotencyKey")
  } catch {
    return false
  }
}

function buildGrantBundle(
  input: Omit<GrantTemporaryFeatureAccessInput, "prismaClient" | "now">,
  facts: { grantId: string; startsAt: Date; expiresAt: Date; recipientEmail: string | null },
): RecordAdminActionInput {
  const expectedActiveGrantSnapshot = snapshotExpectedActiveGrantIds(input.expectedActiveGrantIds)
  const expiresAt = facts.expiresAt.toISOString()
  return {
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    actionKind: "TEMPORARY_FEATURE_ACCESS_GRANTED",
    reasonCode: input.reasonCode,
    internalNote: input.internalNote,
    idempotencyKey: input.idempotencyKey,
    beforeState: { featureKey: input.featureKey, durationDays: input.durationDays, expectedActiveGrantSnapshot },
    afterState: {
      grantId: facts.grantId,
      featureKey: input.featureKey,
      startsAt: facts.startsAt.toISOString(),
      expiresAt,
      effective: true,
    },
    activity: {
      title: "Temporary feature access granted",
      explanation: `Massage Lab support granted temporary ${input.featureKey} access through ${expiresAt}.`,
      effectiveValue: `${input.featureKey} through ${expiresAt}`,
    },
    email: {
      kind: "TEMPORARY_FEATURE_ACCESS_GRANTED",
      recipientEmail: facts.recipientEmail,
      subject: "Temporary Massage Lab access was granted",
      message: `Massage Lab support granted temporary ${input.featureKey} access through ${expiresAt}. If you did not expect this change, contact Massage Lab support.`,
    },
  }
}

function buildRevocationBundle(
  input: Omit<RevokeTemporaryFeatureAccessInput, "prismaClient" | "now">,
  facts: {
    featureKey: AdminGrantableFeatureKey
    startsAt: Date
    expiresAt: Date
    revokedAt: Date
    effective: boolean
    recipientEmail: string | null
  },
): RecordAdminActionInput {
  const expectedActiveGrantSnapshot = snapshotExpectedActiveGrantIds(input.expectedActiveGrantIds)
  const expiresAt = facts.expiresAt.toISOString()
  return {
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    actionKind: "TEMPORARY_FEATURE_ACCESS_REVOKED",
    reasonCode: input.reasonCode,
    internalNote: input.internalNote,
    idempotencyKey: input.idempotencyKey,
    beforeState: {
      grantId: input.grantId,
      featureKey: facts.featureKey,
      startsAt: facts.startsAt.toISOString(),
      expiresAt,
      expectedActiveGrantSnapshot,
      effective: true,
    },
    afterState: {
      grantId: input.grantId,
      featureKey: facts.featureKey,
      expiresAt,
      revokedAt: facts.revokedAt.toISOString(),
      effective: facts.effective,
    },
    activity: {
      title: "Temporary feature access revoked",
      explanation: facts.effective
        ? `Massage Lab support revoked one temporary ${facts.featureKey} grant. Another temporary grant remains active.`
        : `Massage Lab support revoked temporary ${facts.featureKey} access.`,
      effectiveValue: facts.effective ? `${facts.featureKey} remains active` : "Temporary access removed",
    },
    email: {
      kind: "TEMPORARY_FEATURE_ACCESS_REVOKED",
      recipientEmail: facts.recipientEmail,
      subject: "Temporary Massage Lab access was revoked",
      message: facts.effective
        ? `Massage Lab support revoked one temporary ${facts.featureKey} grant, but another temporary grant remains active. If you did not expect this change, contact Massage Lab support.`
        : `Massage Lab support revoked temporary ${facts.featureKey} access. If you did not expect this change, contact Massage Lab support.`,
    },
  }
}

async function replayExistingGrant(
  tx: Prisma.TransactionClient,
  input: GrantTemporaryFeatureAccessInput,
  existing: ExistingAdminAction,
): Promise<TemporaryFeatureAccessMutationResult> {
  const grant = await tx.temporaryFeatureGrant.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  const before = readRecord(existing.beforeState)
  const after = readRecord(existing.afterState)
  const expectedActiveGrantSnapshot = snapshotExpectedActiveGrantIds(input.expectedActiveGrantIds)
  if (!grant
    || existing.actorUserId !== input.actorUserId
    || existing.targetUserId !== input.targetUserId
    || existing.actionKind !== "TEMPORARY_FEATURE_ACCESS_GRANTED"
    || existing.reasonCode !== input.reasonCode
    || existing.internalNote !== input.internalNote
    || grant.userId !== input.targetUserId
    || grant.featureKey !== input.featureKey
    || grant.grantedById !== input.actorUserId
    || grant.reasonCode !== input.reasonCode
    || grant.internalNote !== input.internalNote
    || grant.idempotencyKey !== input.idempotencyKey
    || grant.expiresAt.getTime() - grant.startsAt.getTime() !== input.durationDays * TEMPORARY_ACCESS_DAY_MS
    || before?.featureKey !== input.featureKey
    || before.durationDays !== input.durationDays
    || !sameExpectedActiveGrantSnapshot(before.expectedActiveGrantSnapshot, expectedActiveGrantSnapshot)
    || after?.grantId !== grant.id
    || after.featureKey !== input.featureKey
    || after.startsAt !== grant.startsAt.toISOString()
    || after.expiresAt !== grant.expiresAt.toISOString()
    || after.effective !== true
    || !existing.emailIntent) {
    throw operationKeyInUse()
  }

  const bundle = await recordAdminActionBundle(tx, buildGrantBundle(input, {
    grantId: grant.id,
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    recipientEmail: existing.emailIntent.recipientEmail,
  }))
  return mutationResult(grant.id, input.featureKey, true, grant.expiresAt, bundle.replayed, bundle.emailIntentId)
}

async function replayExistingRevocation(
  tx: Prisma.TransactionClient,
  input: RevokeTemporaryFeatureAccessInput,
  existing: ExistingAdminAction,
): Promise<TemporaryFeatureAccessMutationResult> {
  const revocation = await tx.temporaryFeatureGrantRevocation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  const grant = revocation
    ? await tx.temporaryFeatureGrant.findUnique({ where: { id: revocation.grantId } })
    : null
  const before = readRecord(existing.beforeState)
  const after = readRecord(existing.afterState)
  const expectedActiveGrantIds = normalizeExpectedActiveGrantIds(input.expectedActiveGrantIds)
  const expectedActiveGrantSnapshot = snapshotExpectedActiveGrantIds(expectedActiveGrantIds)
  const expectedEffective = expectedActiveGrantIds.some((grantId) => grantId !== input.grantId)
  if (!revocation
    || !grant
    || !ADMIN_GRANTABLE_FEATURE_KEY_SET.has(grant.featureKey)
    || existing.actorUserId !== input.actorUserId
    || existing.targetUserId !== input.targetUserId
    || existing.actionKind !== "TEMPORARY_FEATURE_ACCESS_REVOKED"
    || existing.reasonCode !== input.reasonCode
    || existing.internalNote !== input.internalNote
    || grant.id !== input.grantId
    || grant.userId !== input.targetUserId
    || revocation.grantId !== input.grantId
    || revocation.revokedById !== input.actorUserId
    || revocation.reasonCode !== input.reasonCode
    || revocation.internalNote !== input.internalNote
    || revocation.idempotencyKey !== input.idempotencyKey
    || revocation.revokedAt.getTime() < grant.startsAt.getTime()
    || revocation.revokedAt.getTime() >= grant.expiresAt.getTime()
    || before?.grantId !== input.grantId
    || before.featureKey !== grant.featureKey
    || before.startsAt !== grant.startsAt.toISOString()
    || before.expiresAt !== grant.expiresAt.toISOString()
    || before.effective !== true
    || !sameExpectedActiveGrantSnapshot(before.expectedActiveGrantSnapshot, expectedActiveGrantSnapshot)
    || after?.grantId !== input.grantId
    || after.featureKey !== grant.featureKey
    || after.expiresAt !== grant.expiresAt.toISOString()
    || after.revokedAt !== revocation.revokedAt.toISOString()
    || after.effective !== expectedEffective
    || !existing.emailIntent) {
    throw operationKeyInUse()
  }
  assertGrantableFeatureKey(grant.featureKey)

  const bundle = await recordAdminActionBundle(tx, buildRevocationBundle(input, {
    featureKey: grant.featureKey,
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    revokedAt: revocation.revokedAt,
    effective: expectedEffective,
    recipientEmail: existing.emailIntent.recipientEmail,
  }))
  return mutationResult(grant.id, grant.featureKey, expectedEffective, grant.expiresAt, bundle.replayed, bundle.emailIntentId)
}

function mutationResult(
  grantId: string,
  featureKey: AdminGrantableFeatureKey,
  effective: boolean,
  expiresAt: Date,
  replayed: boolean,
  emailIntentId: string,
): TemporaryFeatureAccessMutationResult {
  return { grantId, featureKey, effective, expiresAt: expiresAt.toISOString(), replayed, emailIntentId }
}

function readRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : null
}

/** Hashing keeps a 100-ID optimistic-lock snapshot inside shared audit bounds. */
function snapshotExpectedActiveGrantIds(value: string[]) {
  const normalized = normalizeExpectedActiveGrantIds(value)
  return {
    count: normalized.length,
    digest: createHash("sha256").update(JSON.stringify(normalized)).digest("hex"),
  }
}

function sameExpectedActiveGrantSnapshot(
  value: Prisma.JsonValue | undefined,
  expected: ReturnType<typeof snapshotExpectedActiveGrantIds>,
): boolean {
  const snapshot = readRecord(value as Prisma.JsonValue)
  return snapshot?.count === expected.count && snapshot.digest === expected.digest
}

function operationKeyInUse(): Error {
  return new Error("This administrative operation key is already in use.")
}
