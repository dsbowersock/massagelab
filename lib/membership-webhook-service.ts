import type {
  MembershipLevel,
  MembershipWebhookReceipt,
  Prisma,
  PrismaClient,
} from "@prisma/client"
import { runCommerceTransaction } from "./commerce/transactions.ts"
import { decideMembershipEventOrder } from "./membership-webhook-ordering.ts"
import { normalizeStripeSubscription } from "./stripe-billing.js"
import { STRIPE_MEMBERSHIP_WEBHOOK_EVENTS } from "./stripe-webhook-contract.js"

const PROVIDER = "stripe"
const CHECKOUT_COMPLETED = "checkout.session.completed"
const MEMBERSHIP_EVENT_TYPES = new Set<string>(STRIPE_MEMBERSHIP_WEBHOOK_EVENTS)
const RETRYABLE_CODES = Object.freeze({
  malformed_event: "The membership event could not be processed safely.",
  ownership_mismatch: "The membership event ownership could not be verified.",
  price_unmapped: "The membership Price is not configured.",
  provider_unavailable: "The current membership state could not be retrieved.",
})

export type MembershipWebhookRetryCode = keyof typeof RETRYABLE_CODES

export type MembershipWebhookResult =
  | { outcome: "applied"; changed: true; userId: string }
  | { outcome: "applied"; changed: false; userId: string | null }
  | { outcome: "duplicate"; changed: false; userId: string | null }
  | { outcome: "ignored"; changed: false; userId: string | null }

type EventEnvelope = {
  eventId: string
  eventType: string
  eventCreatedAt: Date
  providerObjectId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  claimedUserId: string
  object: Record<string, unknown>
  requiresReconciliation: boolean
}

type SubscriptionSnapshot = {
  id?: string
  userId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: string
  membershipLevel: string
  stripePriceId: string | null
  stripeProductId: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  couponId: string | null
  metadata: unknown
  lastStripeEventId: string | null
  lastStripeEventCreatedAt: Date | null
  lastStripeAuthoritativeAt: Date | null
}

type NormalizedSubscription = NonNullable<ReturnType<typeof normalizeStripeSubscription>>

type ReconciliationPlan = {
  kind: "reconcile"
  envelope: EventEnvelope
  userId: string
  capturedSnapshot: {
    exists: boolean
    lastStripeEventId: string | null
    lastStripeEventCreatedAt: Date | null
    lastStripeAuthoritativeAt: Date | null
  }
}

type InitialResult =
  | { kind: "result"; result: MembershipWebhookResult }
  | { kind: "failure"; code: MembershipWebhookRetryCode }
  | ReconciliationPlan

/** Safe retry signal whose message and code never contain provider details. */
export class MembershipWebhookRetryableError extends Error {
  readonly code: MembershipWebhookRetryCode

  constructor(code: MembershipWebhookRetryCode) {
    super(RETRYABLE_CODES[code])
    this.name = "MembershipWebhookRetryableError"
    this.code = code
  }
}

/**
 * Owns duplicate-safe receipt processing and ordered membership convergence.
 * Every transaction callback is database-only; an injected Stripe retrieval
 * happens between short Serializable compare-and-commit transactions.
 */
export async function processStripeMembershipEvent({
  prismaClient,
  event,
  env = process.env,
  retrieveSubscription,
  now = () => new Date(),
}: {
  prismaClient: Pick<PrismaClient, "$transaction">
  event: unknown
  env?: NodeJS.ProcessEnv
  retrieveSubscription: (subscriptionId: string) => Promise<unknown>
  now?: () => Date
}): Promise<MembershipWebhookResult> {
  const envelope = parseEventEnvelope(event)
  const attemptedAt = currentTime(now)

  const initial = await runCommerceTransaction(prismaClient, async (tx) => {
    const receipt = await tx.membershipWebhookReceipt.upsert({
      where: {
        provider_providerEventId: {
          provider: PROVIDER,
          providerEventId: envelope.eventId,
        },
      },
      create: {
        provider: PROVIDER,
        providerEventId: envelope.eventId,
        eventType: envelope.eventType,
        providerEventCreatedAt: envelope.eventCreatedAt,
        providerObjectId: envelope.providerObjectId,
        stripeSubscriptionId: envelope.stripeSubscriptionId,
      },
      update: {},
    })

    if (isTerminalReceipt(receipt.status)) {
      return { kind: "result", result: terminalResult(receipt) } satisfies InitialResult
    }

    const attempted = await tx.membershipWebhookReceipt.updateMany({
      where: { id: receipt.id, status: "RECEIVED" },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptedAt: attemptedAt,
        failureCode: null,
      },
    })
    if (attempted.count !== 1) {
      return {
        kind: "result",
        result: await readTerminalWinner(tx, receipt.id),
      } satisfies InitialResult
    }

    if (!receiptMatchesEnvelope(receipt, envelope)) {
      return recordInitialFailure(tx, receipt.id, "malformed_event")
    }

    const ownership = await resolveOwnership(tx, envelope)
    if (!ownership || (receipt.userId && receipt.userId !== ownership.userId)) {
      return recordInitialFailure(tx, receipt.id, "ownership_mismatch")
    }

    await tx.membershipWebhookReceipt.updateMany({
      where: { id: receipt.id, status: "RECEIVED" },
      data: { userId: ownership.userId },
    })

    const decision = envelope.requiresReconciliation
      ? "reconcile"
      : decideMembershipEventOrder({
          hasStoredSnapshot: Boolean(ownership.subscription),
          storedEventId: ownership.subscription?.lastStripeEventId ?? null,
          storedEventCreatedAt: ownership.subscription?.lastStripeEventCreatedAt ?? null,
          storedAuthoritativeAt: ownership.subscription?.lastStripeAuthoritativeAt ?? null,
          incomingEventId: envelope.eventId,
          incomingEventCreatedAt: envelope.eventCreatedAt,
        })

    if (decision === "duplicate") {
      const winner = await transitionReceipt(tx, receipt.id, "APPLIED", ownership.userId, attemptedAt)
      return {
        kind: "result",
        result: winner ?? { outcome: "applied", changed: false, userId: ownership.userId },
      } satisfies InitialResult
    }

    if (decision === "ignore-stale") {
      const winner = await transitionReceipt(tx, receipt.id, "IGNORED", ownership.userId, attemptedAt)
      return {
        kind: "result",
        result: winner ?? { outcome: "ignored", changed: false, userId: ownership.userId },
      } satisfies InitialResult
    }

    if (decision === "reconcile") {
      return {
        kind: "reconcile",
        envelope,
        userId: ownership.userId,
        capturedSnapshot: captureWatermarks(ownership.subscription),
      } satisfies InitialResult
    }

    const normalized = normalizeAndValidate(envelope.object, env)
    if (!normalized) {
      return recordInitialFailure(tx, receipt.id, "price_unmapped")
    }

    const winner = await transitionReceipt(tx, receipt.id, "APPLIED", ownership.userId, attemptedAt)
    if (winner) return { kind: "result", result: winner } satisfies InitialResult

    const changed = subscriptionChanged(ownership.subscription, normalized, ownership.userId)
    await writeSubscriptionSnapshot(tx, {
      normalized,
      userId: ownership.userId,
      eventId: envelope.eventId,
      eventCreatedAt: envelope.eventCreatedAt,
      authoritativeAt: undefined,
    })
    return {
      kind: "result",
      result: appliedResult(changed, ownership.userId),
    } satisfies InitialResult
  }, { maxRetries: 3 }) as InitialResult

  if (initial.kind === "result") return initial.result
  if (initial.kind === "failure") throw new MembershipWebhookRetryableError(initial.code)

  const authoritativeReadStartedAt = currentTime(now)
  let providerObject: unknown
  try {
    providerObject = await retrieveSubscription(initial.envelope.stripeSubscriptionId)
  } catch {
    return failAfterProviderRead(prismaClient, initial.envelope.eventId, "provider_unavailable")
  }

  const providerRecord = objectRecord(providerObject)
  if (!providerRecord) {
    return failAfterProviderRead(prismaClient, initial.envelope.eventId, "provider_unavailable")
  }
  const normalized = normalizeAndValidate(providerRecord, env)
  if (!normalized) {
    return failAfterProviderRead(prismaClient, initial.envelope.eventId, "price_unmapped")
  }
  if (
    normalized.stripeSubscriptionId !== initial.envelope.stripeSubscriptionId
    || normalized.stripeCustomerId !== initial.envelope.stripeCustomerId
    || (claimedSubscriptionUserId(normalized.metadata) && claimedSubscriptionUserId(normalized.metadata) !== initial.userId)
  ) {
    return failAfterProviderRead(prismaClient, initial.envelope.eventId, "ownership_mismatch")
  }

  const reconciled = await runCommerceTransaction(prismaClient, async (tx) => {
    const currentReceipt = await findReceipt(tx, initial.envelope.eventId)
    if (!currentReceipt) throw new MembershipWebhookRetryableError("malformed_event")
    if (isTerminalReceipt(currentReceipt.status)) {
      return { kind: "result" as const, result: terminalResult(currentReceipt) }
    }

    const refreshedEnvelope = {
      ...initial.envelope,
      stripeCustomerId: normalized.stripeCustomerId,
      claimedUserId: initial.userId,
    }
    const ownership = await resolveOwnership(tx, refreshedEnvelope)
    if (!ownership || ownership.userId !== initial.userId) {
      const failure = await commitProviderFailureOrWinner(tx, currentReceipt.id, "ownership_mismatch")
      return failure.kind === "result"
        ? failure
        : { kind: "failure" as const, code: "ownership_mismatch" as const }
    }

    if (watermarksChanged(initial.capturedSnapshot, ownership.subscription)) {
      const winner = await transitionReceipt(tx, currentReceipt.id, "IGNORED", ownership.userId, authoritativeReadStartedAt)
      return {
        kind: "result" as const,
        result: winner ?? { outcome: "ignored" as const, changed: false as const, userId: ownership.userId },
      }
    }

    const winner = await transitionReceipt(tx, currentReceipt.id, "APPLIED", ownership.userId, authoritativeReadStartedAt)
    if (winner) return { kind: "result" as const, result: winner }

    const changed = subscriptionChanged(ownership.subscription, normalized, ownership.userId)
    await writeSubscriptionSnapshot(tx, {
      normalized,
      userId: ownership.userId,
      eventId: initial.envelope.eventId,
      eventCreatedAt: initial.envelope.eventCreatedAt,
      authoritativeAt: authoritativeReadStartedAt,
    })
    return { kind: "result" as const, result: appliedResult(changed, ownership.userId) }
  }, { maxRetries: 3 })
  if (reconciled.kind === "failure") throw new MembershipWebhookRetryableError(reconciled.code)
  return reconciled.result
}

function parseEventEnvelope(event: unknown): EventEnvelope {
  const eventRecord = objectRecord(event)
  const data = objectRecord(eventRecord?.data)
  const object = objectRecord(data?.object)
  const eventId = nonemptyString(eventRecord?.id)
  const eventType = nonemptyString(eventRecord?.type)
  const created = eventRecord?.created
  const eventCreatedAt = typeof created === "number" && Number.isFinite(created) && Number.isInteger(created) && created >= 0
    ? new Date(created * 1000)
    : null
  if (!eventId || !eventType || !object || !eventCreatedAt || !Number.isFinite(eventCreatedAt.getTime())) {
    throw new MembershipWebhookRetryableError("malformed_event")
  }

  if (eventType === CHECKOUT_COMPLETED) {
    const stripeSubscriptionId = stripeId(object.subscription)
    const stripeCustomerId = stripeId(object.customer)
    const providerObjectId = nonemptyString(object.id)
    const metadata = objectRecord(object.metadata)
    const claimedUserId = nonemptyString(object.client_reference_id) || nonemptyString(metadata?.userId)
    if (!providerObjectId || !stripeSubscriptionId || !stripeCustomerId || !claimedUserId) {
      throw new MembershipWebhookRetryableError("malformed_event")
    }
    return { eventId, eventType, eventCreatedAt, providerObjectId, stripeSubscriptionId, stripeCustomerId, claimedUserId, object, requiresReconciliation: true }
  }

  if (!MEMBERSHIP_EVENT_TYPES.has(eventType)) {
    throw new MembershipWebhookRetryableError("malformed_event")
  }
  const stripeSubscriptionId = nonemptyString(object.id)
  const stripeCustomerId = stripeId(object.customer)
  if (!stripeSubscriptionId || !stripeCustomerId) {
    throw new MembershipWebhookRetryableError("malformed_event")
  }
  return {
    eventId,
    eventType,
    eventCreatedAt,
    providerObjectId: stripeSubscriptionId,
    stripeSubscriptionId,
    stripeCustomerId,
    claimedUserId: claimedSubscriptionUserId(object.metadata),
    object,
    requiresReconciliation: false,
  }
}

function currentTime(now: () => Date): Date {
  const value = now()
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new MembershipWebhookRetryableError("malformed_event")
  }
  return new Date(value)
}

async function resolveOwnership(tx: Prisma.TransactionClient, envelope: EventEnvelope): Promise<{ userId: string; subscription: SubscriptionSnapshot | null } | null> {
  const customer = await tx.stripeCustomer.findUnique({
    where: { stripeCustomerId: envelope.stripeCustomerId },
  })
  if (!customer?.userId) return null

  const subscription = await tx.membershipSubscription.findUnique({
    where: { stripeSubscriptionId: envelope.stripeSubscriptionId },
  }) as SubscriptionSnapshot | null
  if (envelope.claimedUserId && envelope.claimedUserId !== customer.userId) return null
  if (subscription && (
    subscription.userId !== customer.userId
    || subscription.stripeCustomerId !== envelope.stripeCustomerId
  )) return null
  return { userId: customer.userId, subscription }
}

function normalizeAndValidate(
  object: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
): NormalizedSubscription | null {
  const normalized = normalizeStripeSubscription(object, { env }) as NormalizedSubscription | null
  if (!normalized) return null
  if (!normalized.stripeSubscriptionId || !normalized.stripeCustomerId) return null
  return normalized
}

function receiptMatchesEnvelope(receipt: MembershipWebhookReceipt, envelope: EventEnvelope): boolean {
  return receipt.eventType === envelope.eventType
    && sameDate(receipt.providerEventCreatedAt, envelope.eventCreatedAt)
    && receipt.providerObjectId === envelope.providerObjectId
    && receipt.stripeSubscriptionId === envelope.stripeSubscriptionId
}

function isTerminalReceipt(status: unknown): status is "APPLIED" | "IGNORED" {
  return status === "APPLIED" || status === "IGNORED"
}

function terminalResult(receipt: MembershipWebhookReceipt): MembershipWebhookResult {
  return receipt.status === "APPLIED"
    ? { outcome: "duplicate", changed: false, userId: nonemptyString(receipt.userId) || null }
    : { outcome: "ignored", changed: false, userId: nonemptyString(receipt.userId) || null }
}

async function findReceipt(tx: Prisma.TransactionClient, eventId: string): Promise<MembershipWebhookReceipt | null> {
  return tx.membershipWebhookReceipt.findUnique({
    where: { provider_providerEventId: { provider: PROVIDER, providerEventId: eventId } },
  })
}

async function readTerminalWinner(tx: Prisma.TransactionClient, receiptId: string): Promise<MembershipWebhookResult> {
  const winner = await tx.membershipWebhookReceipt.findUnique({ where: { id: receiptId } })
  if (!winner || !isTerminalReceipt(winner.status)) {
    // A fixed Serializable snapshot may lose a conditional write without yet
    // seeing its winner. Re-enter the complete bounded transaction instead of
    // misclassifying the unfinished local read as a provider failure.
    throw Object.assign(new Error("Membership receipt serialization conflict."), { code: "P2034" })
  }
  return terminalResult(winner)
}

async function transitionReceipt(tx: Prisma.TransactionClient, receiptId: string, status: "APPLIED" | "IGNORED", userId: string, processedAt: Date): Promise<MembershipWebhookResult | null> {
  const transition = await tx.membershipWebhookReceipt.updateMany({
    where: { id: receiptId, status: "RECEIVED" },
    data: { status, userId, failureCode: null, processedAt },
  })
  return transition.count === 1 ? null : readTerminalWinner(tx, receiptId)
}

async function recordInitialFailure(tx: Prisma.TransactionClient, receiptId: string, code: MembershipWebhookRetryCode): Promise<InitialResult> {
  const update = await tx.membershipWebhookReceipt.updateMany({
    where: { id: receiptId, status: "RECEIVED" },
    data: { failureCode: code },
  })
  if (update.count === 1) return { kind: "failure", code }
  return { kind: "result", result: await readTerminalWinner(tx, receiptId) }
}

async function commitProviderFailureOrWinner(
  tx: Prisma.TransactionClient,
  receiptId: string,
  code: MembershipWebhookRetryCode,
): Promise<{ kind: "failure" } | { kind: "result"; result: MembershipWebhookResult }> {
  const update = await tx.membershipWebhookReceipt.updateMany({
    where: { id: receiptId, status: "RECEIVED" },
    data: { failureCode: code },
  })
  if (update.count !== 1) return { kind: "result", result: await readTerminalWinner(tx, receiptId) }
  return { kind: "failure" }
}

async function failAfterProviderRead(
  prismaClient: Pick<PrismaClient, "$transaction">,
  eventId: string,
  code: MembershipWebhookRetryCode,
): Promise<MembershipWebhookResult> {
  const outcome = await runCommerceTransaction(prismaClient, async (tx) => {
    const receipt = await findReceipt(tx, eventId)
    if (!receipt) return { kind: "failure" as const }
    if (isTerminalReceipt(receipt.status)) return { kind: "result" as const, result: terminalResult(receipt) }
    const updated = await tx.membershipWebhookReceipt.updateMany({
      where: { id: receipt.id, status: "RECEIVED" },
      data: { failureCode: code },
    })
    if (updated.count === 1) return { kind: "failure" as const }
    return { kind: "result" as const, result: await readTerminalWinner(tx, receipt.id) }
  }, { maxRetries: 3 })
  if (outcome.kind === "result") return outcome.result
  throw new MembershipWebhookRetryableError(code)
}

function captureWatermarks(subscription: SubscriptionSnapshot | null) {
  return {
    exists: Boolean(subscription),
    lastStripeEventId: subscription?.lastStripeEventId ?? null,
    lastStripeEventCreatedAt: subscription?.lastStripeEventCreatedAt ?? null,
    lastStripeAuthoritativeAt: subscription?.lastStripeAuthoritativeAt ?? null,
  }
}

/** Compares only provider-to-provider and local-to-local concurrency marks. */
function watermarksChanged(captured: ReconciliationPlan["capturedSnapshot"], current: SubscriptionSnapshot | null): boolean {
  return captured.exists !== Boolean(current)
    || captured.lastStripeEventId !== (current?.lastStripeEventId ?? null)
    || !sameDate(captured.lastStripeEventCreatedAt, current?.lastStripeEventCreatedAt ?? null)
    || !sameDate(captured.lastStripeAuthoritativeAt, current?.lastStripeAuthoritativeAt ?? null)
}

function subscriptionChanged(existing: SubscriptionSnapshot | null, normalized: NormalizedSubscription, userId: string): boolean {
  if (!existing) return true
  return existing.userId !== userId
    || existing.stripeCustomerId !== normalized.stripeCustomerId
    || existing.status !== normalized.status
    || existing.membershipLevel !== normalized.membershipLevel
    || existing.stripePriceId !== normalized.stripePriceId
    || existing.stripeProductId !== normalized.stripeProductId
    || !sameDate(existing.currentPeriodStart, normalized.currentPeriodStart)
    || !sameDate(existing.currentPeriodEnd, normalized.currentPeriodEnd)
    || existing.cancelAtPeriodEnd !== normalized.cancelAtPeriodEnd
    || !sameDate(existing.canceledAt, normalized.canceledAt)
    || existing.couponId !== normalized.couponId
}

async function writeSubscriptionSnapshot(tx: Prisma.TransactionClient, {
  normalized,
  userId,
  eventId,
  eventCreatedAt,
  authoritativeAt,
}: {
  normalized: NormalizedSubscription
  userId: string
  eventId: string
  eventCreatedAt: Date
  authoritativeAt: Date | undefined
}) {
  const normalizedFields = {
    stripeCustomerId: normalized.stripeCustomerId,
    status: normalized.status,
    membershipLevel: normalized.membershipLevel as MembershipLevel,
    stripePriceId: normalized.stripePriceId,
    stripeProductId: normalized.stripeProductId,
    currentPeriodStart: normalized.currentPeriodStart,
    currentPeriodEnd: normalized.currentPeriodEnd,
    cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
    canceledAt: normalized.canceledAt,
    couponId: normalized.couponId,
    metadata: safeMembershipMetadata(normalized.metadata),
    lastStripeEventId: eventId,
    lastStripeEventCreatedAt: eventCreatedAt,
    ...(authoritativeAt ? { lastStripeAuthoritativeAt: authoritativeAt } : {}),
  }
  return tx.membershipSubscription.upsert({
    where: { stripeSubscriptionId: normalized.stripeSubscriptionId },
    create: {
      userId,
      stripeSubscriptionId: normalized.stripeSubscriptionId,
      ...normalizedFields,
      ...(!authoritativeAt ? { lastStripeAuthoritativeAt: null } : {}),
    },
    update: normalizedFields,
  })
}

function safeMembershipMetadata(value: unknown): Record<string, string> {
  const metadata = objectRecord(value)
  if (!metadata) return {}
  return Object.fromEntries(["userId", "membershipLevel", "purpose"].flatMap((key) => {
    const safeValue = nonemptyString(metadata[key])
    return safeValue ? [[key, safeValue]] : []
  }))
}

function appliedResult(changed: boolean, userId: string): MembershipWebhookResult {
  return changed
    ? { outcome: "applied", changed: true, userId }
    : { outcome: "applied", changed: false, userId }
}

function claimedSubscriptionUserId(value: unknown): string {
  return nonemptyString(objectRecord(value)?.userId)
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function nonemptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stripeId(value: unknown): string {
  if (typeof value === "string") return nonemptyString(value)
  return nonemptyString(objectRecord(value)?.id)
}

function sameDate(left: unknown, right: unknown): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left === null || left === undefined) && (right === null || right === undefined)
  }
  const leftDate = left instanceof Date ? left : new Date(String(left))
  const rightDate = right instanceof Date ? right : new Date(String(right))
  return Number.isFinite(leftDate.getTime())
    && Number.isFinite(rightDate.getTime())
    && leftDate.getTime() === rightDate.getTime()
}
