import type { Prisma, PrismaClient } from "@prisma/client"
import type Stripe from "stripe"
import { normalizeEmail } from "../auth-security.js"
import { runCommerceTransaction } from "../commerce/transactions.ts"
import { requireFullAdminUser } from "./access.ts"
import { validateAdminReason, type AdminReasonCode } from "./operation-contract.ts"
import {
  acquireAdminActionIdempotencyLock,
  recordAdminActionBundle,
  type RecordAdminActionInput,
} from "./operation-service.ts"

const ELIGIBLE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const

export type BillingGoodwillPreview = {
  customerId: string
  subscriptionId: string
  membershipLevel: "SUPPORTER"
  status: (typeof ELIGIBLE_SUBSCRIPTION_STATUSES)[number]
  currentCreditCents: number
  projectedNextInvoiceCents: number
  currency: "usd"
  livemode: boolean
}

export type BillingGoodwillPreviewErrorCode =
  | "TARGET_NOT_FOUND"
  | "CUSTOMER_COUNT_INVALID"
  | "SUBSCRIPTION_COUNT_INVALID"
  | "STRIPE_CUSTOMER_INVALID"
  | "STRIPE_SUBSCRIPTION_INVALID"
  | "CUSTOMER_SUBSCRIPTION_MISMATCH"
  | "STRIPE_PREVIEW_INVALID"

/** Carries only a bounded internal code; provider response data never crosses this boundary. */
export class BillingGoodwillPreviewError extends Error {
  readonly code: BillingGoodwillPreviewErrorCode

  constructor(code: BillingGoodwillPreviewErrorCode) {
    super(`Billing goodwill preview failed: ${code}.`)
    this.name = "BillingGoodwillPreviewError"
    this.code = code
  }
}

/** Shared injected Stripe surface for read-only preview and later goodwill mutation work. */
export type StripeGoodwillClient = Pick<Stripe, "customers" | "subscriptions" | "invoices">

export type BillingGoodwillResult = {
  operationId: string
  status: "VERIFIED" | "RECONCILIATION_REQUIRED" | "FAILED_BEFORE_MUTATION"
  amountCents: number
  endingCreditCents: number | null
  replayed: boolean
  emailIntentId: string | null
}

export type BillingGoodwillMutationErrorCode =
  | "OPERATION_KEY_IN_USE"
  | "OPERATION_NOT_FOUND"
  | "OPERATION_NOT_RECONCILABLE"

/** Stable operator error for local contract failures; provider payloads are never attached. */
export class BillingGoodwillMutationError extends Error {
  readonly code: BillingGoodwillMutationErrorCode

  constructor(code: BillingGoodwillMutationErrorCode, message: string) {
    super(message)
    this.name = "BillingGoodwillMutationError"
    this.code = code
  }
}

type BillingGoodwillMutationInput = {
  prismaClient: PrismaClient
  actorUserId: string
  targetUserId: string
  amountCents: number
  confirmationEmail: string
  expectedStartingCreditCents: number
  reasonCode: AdminReasonCode
  internalNote: string | null
  idempotencyKey: string
  stripeClient: StripeGoodwillClient
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
  /** Injectable invocation clock used to enforce the bounded Stripe replay window. */
  now?: Date
  /** Advancing clock used to recheck the replay margin immediately before mutation. */
  clock?: () => Date
}

type BillingGoodwillOperation = {
  id: string
  actorUserId: string
  targetUserId: string
  idempotencyKey: string
  reasonCode: AdminReasonCode
  internalNote: string | null
  amountCents: number
  currency: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  stripeBalanceTransactionId: string | null
  startingBalanceCents: number
  endingBalanceCents: number | null
  status: GoodwillPersistedStatus
  failureCode: string | null
  createdAt: Date
}

type GoodwillPersistedStatus =
  | "PREPARED"
  | "APPLIED"
  | "VERIFIED"
  | "FAILED_BEFORE_MUTATION"
  | "RECONCILIATION_REQUIRED"

type PreparedGoodwill = {
  operation: BillingGoodwillOperation
  recipientEmail: string
  replayed: boolean
  blocked: boolean
}

const BILLING_GOODWILL_MIN_CENTS = 1
const BILLING_GOODWILL_MAX_CENTS = 10_000
const BILLING_GOODWILL_DESCRIPTION = "MassageLab billing goodwill"
const STRIPE_IDEMPOTENCY_RETRY_WINDOW_MS = (24 * 60 - 5) * 60 * 1_000
export const BILLING_GOODWILL_UNRESOLVED_STATUSES = ["PREPARED", "APPLIED", "RECONCILIATION_REQUIRED"] as const
export type BillingGoodwillUnresolvedStatus = (typeof BILLING_GOODWILL_UNRESOLVED_STATUSES)[number]

/** Narrows persisted enum values to the shared operator-recovery state set. */
export function isBillingGoodwillUnresolvedStatus(value: unknown): value is BillingGoodwillUnresolvedStatus {
  return BILLING_GOODWILL_UNRESOLVED_STATUSES.includes(value as BillingGoodwillUnresolvedStatus)
}

type BillingGoodwillPrismaClient = Pick<
  PrismaClient,
  "user" | "stripeCustomer" | "membershipSubscription"
>

/**
 * Reloads full-Admin authority and both local/provider billing identity before
 * producing a read-only next-invoice projection. No caller-supplied role or
 * provider object is trusted as authority.
 */
export async function previewInvoiceCredit(input: {
  prismaClient: BillingGoodwillPrismaClient
  actorUserId: string
  targetUserId: string
  stripeClient: StripeGoodwillClient
}): Promise<BillingGoodwillPreview> {
  await requireFullAdminUser({
    prismaClient: input.prismaClient,
    sessionUserId: input.actorUserId,
  })

  const target = await input.prismaClient.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true },
  })
  if (!target) throw previewError("TARGET_NOT_FOUND")

  const [customers, subscriptions] = await Promise.all([
    input.prismaClient.stripeCustomer.findMany({
      where: { userId: input.targetUserId },
      select: { stripeCustomerId: true },
      take: 2,
    }),
    input.prismaClient.membershipSubscription.findMany({
      where: {
        userId: input.targetUserId,
        membershipLevel: "SUPPORTER",
        status: { in: [...ELIGIBLE_SUBSCRIPTION_STATUSES] },
      },
      select: {
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        membershipLevel: true,
        status: true,
      },
      take: 2,
    }),
  ])

  if (customers.length !== 1) throw previewError("CUSTOMER_COUNT_INVALID")
  if (subscriptions.length !== 1) throw previewError("SUBSCRIPTION_COUNT_INVALID")

  const customerId = customers[0].stripeCustomerId
  const localSubscription = subscriptions[0]
  const subscriptionId = localSubscription.stripeSubscriptionId
  if (!isStripeId(customerId, "cus_")) throw previewError("STRIPE_CUSTOMER_INVALID")
  if (!isStripeId(subscriptionId, "sub_")) throw previewError("STRIPE_SUBSCRIPTION_INVALID")
  if (localSubscription.stripeCustomerId !== customerId) {
    throw previewError("CUSTOMER_SUBSCRIPTION_MISMATCH")
  }

  const customer = await safeStripeRead(
    () => input.stripeClient.customers.retrieve(customerId),
    "STRIPE_CUSTOMER_INVALID",
  )
  const customerEvidence = parseStripeCustomer(customer, customerId)

  const subscription = await safeStripeRead(
    () => input.stripeClient.subscriptions.retrieve(subscriptionId),
    "STRIPE_SUBSCRIPTION_INVALID",
  )
  const subscriptionEvidence = parseStripeSubscription(
    subscription,
    subscriptionId,
    customerId,
    customerEvidence.livemode,
  )

  const invoice = await safeStripeRead(
    () => input.stripeClient.invoices.createPreview({
      customer: customerId,
      subscription: subscriptionId,
      preview_mode: "next",
    }),
    "STRIPE_PREVIEW_INVALID",
  )
  const invoiceEvidence = parseStripeInvoicePreview(invoice, customerId, customerEvidence.livemode)

  return {
    customerId,
    subscriptionId,
    membershipLevel: "SUPPORTER",
    status: subscriptionEvidence.status,
    // Stripe represents a customer credit as a negative balance. Absolute value
    // converts it for display and canonicalizes zero; positive debits were rejected above.
    currentCreditCents: Math.abs(customerEvidence.balance),
    projectedNextInvoiceCents: invoiceEvidence.amountDue,
    currency: "usd",
    livemode: customerEvidence.livemode,
  }
}

/**
 * Persists an immutable PREPARED request before using the injected Stripe
 * client, then verifies the external result before creating Admin evidence.
 * Stripe I/O is deliberately outside every database transaction.
 */
export async function applyInvoiceCredit(
  input: BillingGoodwillMutationInput,
): Promise<BillingGoodwillResult> {
  const now = readMutationClock(input)
  validateMutationInput(input)
  const prepared = await prepareGoodwillOperation(input, false)
  if (prepared.operation.status === "VERIFIED") {
    return finalizeVerifiedGoodwill(input, prepared.operation, prepared.recipientEmail, true)
  }
  if (prepared.operation.status === "FAILED_BEFORE_MUTATION") {
    return operationResult(prepared.operation, prepared.replayed, null)
  }
  // Only the invocation that inserted PREPARED owns the initial provider
  // attempt. Every exact replay routes the operator to explicit reconciliation.
  if (prepared.replayed || prepared.blocked) {
    return unresolvedReplayResult(prepared.operation)
  }
  return executeGoodwillRequest(input, prepared, now)
}

/**
 * Replays the original Stripe request under its original idempotency key and
 * then performs authoritative readback. It cannot mint a replacement key.
 */
export async function reconcileInvoiceCredit(
  input: BillingGoodwillMutationInput,
): Promise<BillingGoodwillResult> {
  const now = readMutationClock(input)
  validateMutationInput(input)
  const prepared = await prepareGoodwillOperation(input, true)
  if (prepared.blocked) return unresolvedReplayResult(prepared.operation)
  return executeGoodwillRequest(input, { ...prepared, replayed: true }, now)
}

/**
 * Prepares or replays one durable goodwill operation under fresh authorization
 * and the shared idempotency lock. Reconciliation-only calls require an
 * existing unresolved row. `replayed` identifies an existing operation whose
 * first provider attempt this caller does not own; `blocked` identifies local
 * identity drift that prevents the provider boundary from being crossed.
 */
async function prepareGoodwillOperation(
  input: BillingGoodwillMutationInput,
  reconciliationOnly: boolean,
): Promise<PreparedGoodwill> {
  return runBillingGoodwillTransaction(input.prismaClient, async (tx) => {
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireFullAdminUser({ prismaClient: tx, sessionUserId: input.actorUserId })
    const target = await loadVerifiedTarget(tx, input.targetUserId, input.confirmationEmail)
    const [existing, existingAction] = await Promise.all([
      tx.adminBillingGoodwillOperation.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      }) as Promise<BillingGoodwillOperation | null>,
      tx.adminAction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { activity: true, emailIntent: true },
      }),
    ])

    if (existing) {
      assertExactOperationReplay(existing, input, reconciliationOnly)
      if (existing.status === "VERIFIED") {
        assertCoherentVerifiedOperation(existing)
        if (!existingAction) throw operationKeyInUse()
        try {
          await recordAdminActionBundle(
            tx,
            buildGoodwillBundle(existing, target.email, existing.endingBalanceCents as number),
          )
        } catch {
          throw operationKeyInUse()
        }
      } else if (existingAction) {
        throw operationKeyInUse()
      }
      if (reconciliationOnly && !isBillingGoodwillUnresolvedStatus(existing.status)) {
        throw mutationError("OPERATION_NOT_RECONCILABLE", "This billing goodwill operation no longer requires reconciliation.")
      }
      if (reconciliationOnly
        && isBillingGoodwillUnresolvedStatus(existing.status)
        && existing.stripeBalanceTransactionId === null) {
        let billing: { customerId: string; subscriptionId: string }
        try {
          billing = await loadLocalBillingEligibility(tx, input.targetUserId)
        } catch (error) {
          if (!(error instanceof LocalBillingEligibilityError)) throw error
          const blocked = await tx.adminBillingGoodwillOperation.update({
            where: { id: existing.id },
            data: { status: "RECONCILIATION_REQUIRED", failureCode: "AMBIGUOUS_IDENTITY_CHANGED" },
          }) as BillingGoodwillOperation
          return { operation: blocked, recipientEmail: target.email, replayed: true, blocked: true }
        }
        if (billing.customerId !== existing.stripeCustomerId
          || billing.subscriptionId !== existing.stripeSubscriptionId) {
          const blocked = await tx.adminBillingGoodwillOperation.update({
            where: { id: existing.id },
            data: { status: "RECONCILIATION_REQUIRED", failureCode: "AMBIGUOUS_IDENTITY_CHANGED" },
          }) as BillingGoodwillOperation
          return { operation: blocked, recipientEmail: target.email, replayed: true, blocked: true }
        }
      }
      return { operation: existing, recipientEmail: target.email, replayed: true, blocked: false }
    }
    if (existingAction) throw operationKeyInUse()
    if (reconciliationOnly) {
      throw mutationError("OPERATION_NOT_FOUND", "The billing goodwill operation was not found.")
    }

    const billing = await loadLocalBillingEligibility(tx, input.targetUserId)
    const operation = await tx.adminBillingGoodwillOperation.create({
      data: {
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        idempotencyKey: input.idempotencyKey,
        reasonCode: input.reasonCode,
        internalNote: input.internalNote,
        amountCents: input.amountCents,
        currency: "usd",
        stripeCustomerId: billing.customerId,
        stripeSubscriptionId: billing.subscriptionId,
        startingBalanceCents: input.expectedStartingCreditCents,
        status: "PREPARED",
        failureCode: null,
      },
    }) as BillingGoodwillOperation
    return { operation, recipientEmail: target.email, replayed: false, blocked: false }
  })
}

async function executeGoodwillRequest(
  input: BillingGoodwillMutationInput,
  prepared: PreparedGoodwill,
  now: Date,
): Promise<BillingGoodwillResult> {
  const operation = prepared.operation
  const liveGateFailure = liveGateFailureCode(input.env)
  if (liveGateFailure) {
    const failed = await persistPreCallFailure(input.prismaClient, operation, liveGateFailure, prepared.replayed)
    return settlePersistedOutcome(input, failed, prepared)
  }

  const expectedLivemode = isLiveSecretKey(input.env?.STRIPE_SECRET_KEY)
  if (operation.stripeBalanceTransactionId !== null) {
    if (!isStripeId(operation.stripeBalanceTransactionId, "cbtxn_")) {
      const unresolved = await persistGoodwillState(input.prismaClient, operation.id, {
        status: "RECONCILIATION_REQUIRED",
        failureCode: "PERSISTED_TRANSACTION_ID_INVALID",
      }, [...BILLING_GOODWILL_UNRESOLVED_STATUSES])
      return settlePersistedOutcome(input, unresolved, prepared)
    }
    return readbackAndFinalizeGoodwill(
      input,
      prepared,
      operation,
      operation.stripeBalanceTransactionId,
      expectedLivemode,
    )
  }
  if (prepared.replayed && !isInsideStripeRetryWindow(operation.createdAt, now)) {
    const unresolved = await persistGoodwillState(input.prismaClient, operation.id, {
      status: "RECONCILIATION_REQUIRED",
      failureCode: "IDEMPOTENCY_RETRY_WINDOW_EXPIRED",
    }, [...BILLING_GOODWILL_UNRESOLVED_STATUSES])
    return settlePersistedOutcome(input, unresolved, prepared)
  }

  let customer: { balance: number; livemode: boolean }
  try {
    const rawCustomer = await input.stripeClient.customers.retrieve(operation.stripeCustomerId)
    customer = parseMutationCustomer(rawCustomer, operation.stripeCustomerId, expectedLivemode)
  } catch {
    const failed = await persistPreCallFailure(input.prismaClient, operation, "STRIPE_CUSTOMER_INVALID", prepared.replayed)
    return settlePersistedOutcome(input, failed, prepared)
  }

  try {
    const rawSubscription = await input.stripeClient.subscriptions.retrieve(operation.stripeSubscriptionId)
    const subscription = parseStripeSubscription(
      rawSubscription,
      operation.stripeSubscriptionId,
      operation.stripeCustomerId,
      customer.livemode,
    )
    if (subscription.currency !== "usd") throw new Error("non-USD subscription")
  } catch {
    const failed = await persistPreCallFailure(input.prismaClient, operation, "STRIPE_SUBSCRIPTION_INVALID", prepared.replayed)
    return settlePersistedOutcome(input, failed, prepared)
  }

  const currentCreditCents = Math.abs(customer.balance)
  // Only a never-attempted PREPARED request can use the starting balance as a
  // stale-form guard. An unresolved request may already have committed at
  // Stripe, so reconciliation must replay the same key before judging balance.
  if (operation.status === "PREPARED"
    && !prepared.replayed
    && currentCreditCents !== operation.startingBalanceCents) {
    const failed = await persistPreCallFailure(input.prismaClient, operation, "STARTING_CREDIT_CHANGED", false)
    return settlePersistedOutcome(input, failed, prepared)
  }

  if (prepared.replayed && !isInsideStripeRetryWindow(operation.createdAt, readMutationClock(input))) {
    const unresolved = await persistGoodwillState(input.prismaClient, operation.id, {
      status: "RECONCILIATION_REQUIRED",
      failureCode: "IDEMPOTENCY_RETRY_WINDOW_EXPIRED",
    }, [...BILLING_GOODWILL_UNRESOLVED_STATUSES])
    return settlePersistedOutcome(input, unresolved, prepared)
  }

  let createdTransactionId: string
  try {
    const created = await input.stripeClient.customers.createBalanceTransaction(
      operation.stripeCustomerId,
      buildStripeGoodwillRequest(operation),
      { idempotencyKey: operation.idempotencyKey },
    )
    if (!isRecord(created) || !isStripeId(created.id, "cbtxn_")) {
      throw new Error("invalid balance transaction")
    }
    createdTransactionId = created.id
  } catch {
    const unresolved = await persistGoodwillState(input.prismaClient, operation.id, {
      status: "RECONCILIATION_REQUIRED",
      failureCode: "STRIPE_CREATE_OUTCOME_UNKNOWN",
    }, [...BILLING_GOODWILL_UNRESOLVED_STATUSES])
    return settlePersistedOutcome(input, unresolved, prepared)
  }

  let applied: BillingGoodwillOperation
  try {
    applied = await persistGoodwillState(input.prismaClient, operation.id, {
      status: "APPLIED",
      stripeBalanceTransactionId: createdTransactionId,
      failureCode: null,
      appliedAt: new Date(),
    }, [...BILLING_GOODWILL_UNRESOLVED_STATUSES])
  } catch {
    const unresolved = await persistGoodwillState(input.prismaClient, operation.id, {
      status: "RECONCILIATION_REQUIRED",
      failureCode: "LOCAL_APPLIED_WRITE_FAILED",
    }, [...BILLING_GOODWILL_UNRESOLVED_STATUSES])
    return settlePersistedOutcome(input, unresolved, prepared)
  }

  return readbackAndFinalizeGoodwill(
    input,
    prepared,
    applied,
    createdTransactionId,
    expectedLivemode,
  )
}

/**
 * Reads the exact provider transaction and Customer, then finalizes verified
 * local evidence or returns a safe unresolved result. Initial settlement must
 * prove that the current Customer balance still equals the transaction ending
 * balance; a replayed historical reconciliation validates the immutable
 * transaction ending balance without assuming later Customer activity stopped.
 */
async function readbackAndFinalizeGoodwill(
  input: BillingGoodwillMutationInput,
  prepared: PreparedGoodwill,
  operation: BillingGoodwillOperation,
  transactionId: string,
  expectedLivemode: boolean,
): Promise<BillingGoodwillResult> {
  let endingCreditCents: number
  try {
    const [transaction, refreshedCustomer] = await Promise.all([
      input.stripeClient.customers.retrieveBalanceTransaction(
        operation.stripeCustomerId,
        transactionId,
      ),
      input.stripeClient.customers.retrieve(operation.stripeCustomerId),
    ])
    endingCreditCents = validateAuthoritativeReadback(
      transaction,
      refreshedCustomer,
      { ...operation, stripeBalanceTransactionId: transactionId },
      expectedLivemode,
      prepared.replayed,
    )
  } catch (error) {
    const failureCode = error instanceof GoodwillReadbackValidationError
      ? error.code
      : "STRIPE_READBACK_FAILED"
    const unresolved = await persistGoodwillState(input.prismaClient, operation.id, {
      status: "RECONCILIATION_REQUIRED",
      failureCode,
    }, ["APPLIED", "RECONCILIATION_REQUIRED"])
    return settlePersistedOutcome(input, unresolved, prepared)
  }

  const verified = {
    ...operation,
    stripeBalanceTransactionId: transactionId,
    endingBalanceCents: endingCreditCents,
  }
  try {
    return await finalizeVerifiedGoodwill(input, verified, prepared.recipientEmail, prepared.replayed)
  } catch {
    const unresolved = await persistGoodwillState(input.prismaClient, operation.id, {
      status: "RECONCILIATION_REQUIRED",
      failureCode: "LOCAL_VERIFICATION_WRITE_FAILED",
    }, ["APPLIED", "RECONCILIATION_REQUIRED"])
    return settlePersistedOutcome(input, unresolved, prepared)
  }
}

async function finalizeVerifiedGoodwill(
  input: BillingGoodwillMutationInput,
  verifiedEvidence: BillingGoodwillOperation,
  recipientEmail: string,
  replayed: boolean,
): Promise<BillingGoodwillResult> {
  return runBillingGoodwillTransaction(input.prismaClient, async (tx) => {
    await acquireAdminActionIdempotencyLock(tx, input.idempotencyKey)
    await requireFullAdminUser({ prismaClient: tx, sessionUserId: input.actorUserId })
    const target = await loadVerifiedTarget(tx, input.targetUserId, input.confirmationEmail)
    const current = await tx.adminBillingGoodwillOperation.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    }) as BillingGoodwillOperation | null
    if (!current) throw mutationError("OPERATION_NOT_FOUND", "The billing goodwill operation was not found.")
    assertExactOperationReplay(current, input, replayed)

    const endingCreditCents = current.status === "VERIFIED"
      ? current.endingBalanceCents
      : verifiedEvidence.endingBalanceCents
    if (!Number.isSafeInteger(endingCreditCents) || (endingCreditCents as number) < 0) {
      throw new Error("Verified billing goodwill evidence is incomplete.")
    }

    const bundle = await recordAdminActionBundle(
      tx,
      buildGoodwillBundle(current, target.email || recipientEmail, endingCreditCents as number),
    )

    if (current.status !== "VERIFIED") {
      await tx.adminBillingGoodwillOperation.update({
        where: { id: current.id },
        data: {
          status: "VERIFIED",
          endingBalanceCents: endingCreditCents,
          failureCode: null,
          verifiedAt: new Date(),
        },
      })
    }

    return {
      operationId: current.id,
      status: "VERIFIED",
      amountCents: current.amountCents,
      endingCreditCents: endingCreditCents as number,
      replayed: replayed || bundle.replayed,
      emailIntentId: bundle.emailIntentId,
    }
  })
}

function validateMutationInput(input: BillingGoodwillMutationInput): void {
  validateIdentifier(input.actorUserId, "actor")
  validateIdentifier(input.targetUserId, "target")
  validateIdentifier(input.idempotencyKey, "operation key")
  if (!Number.isInteger(input.amountCents)
    || input.amountCents < BILLING_GOODWILL_MIN_CENTS
    || input.amountCents > BILLING_GOODWILL_MAX_CENTS) {
    throw new Error("Billing goodwill must be a whole number of cents from 1 through 10000.")
  }
  if (!Number.isSafeInteger(input.expectedStartingCreditCents) || input.expectedStartingCreditCents < 0) {
    throw new Error("Provide a valid prepared invoice-credit balance.")
  }
  if (input.internalNote !== null && typeof input.internalNote !== "string") {
    throw new Error("Internal notes must be text.")
  }
  validateAdminReason(input.reasonCode, input.internalNote)
  requireValidEmail(input.confirmationEmail, "confirmation")
}

async function loadVerifiedTarget(
  tx: Prisma.TransactionClient,
  targetUserId: string,
  confirmationEmail: string,
): Promise<{ id: string; email: string }> {
  const target = await tx.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, emailVerified: true },
  })
  const email = requireValidEmail(target?.email, "target")
  if (!target?.emailVerified) {
    throw new Error("Billing goodwill requires a verified target account with an email.")
  }
  if (email !== requireValidEmail(confirmationEmail, "confirmation")) {
    throw new Error("The confirmation email does not match the target account.")
  }
  return { id: target.id, email }
}

async function loadLocalBillingEligibility(tx: Prisma.TransactionClient, targetUserId: string) {
  const [customers, subscriptions] = await Promise.all([
    tx.stripeCustomer.findMany({
      where: { userId: targetUserId },
      select: { stripeCustomerId: true },
      take: 2,
    }),
    tx.membershipSubscription.findMany({
      where: {
        userId: targetUserId,
        membershipLevel: "SUPPORTER",
        status: { in: [...ELIGIBLE_SUBSCRIPTION_STATUSES] },
      },
      select: {
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        membershipLevel: true,
        status: true,
      },
      take: 2,
    }),
  ])
  if (customers.length !== 1) throw new LocalBillingEligibilityError("Billing goodwill requires one Stripe customer.")
  if (subscriptions.length !== 1) throw new LocalBillingEligibilityError("Billing goodwill requires one eligible Supporter subscription.")
  const customerId = customers[0].stripeCustomerId
  const subscriptionId = subscriptions[0].stripeSubscriptionId
  if (!isStripeId(customerId, "cus_")
    || !isStripeId(subscriptionId, "sub_")
    || subscriptions[0].stripeCustomerId !== customerId) {
    throw new LocalBillingEligibilityError("Billing goodwill billing identity is invalid.")
  }
  return { customerId, subscriptionId }
}

class LocalBillingEligibilityError extends Error {}

function assertExactOperationReplay(
  operation: BillingGoodwillOperation,
  input: BillingGoodwillMutationInput,
  allowDifferentReconciler = false,
): void {
  if ((!allowDifferentReconciler && operation.actorUserId !== input.actorUserId)
    || operation.targetUserId !== input.targetUserId
    || operation.idempotencyKey !== input.idempotencyKey
    || operation.reasonCode !== input.reasonCode
    || operation.internalNote !== input.internalNote
    || operation.amountCents !== input.amountCents
    || operation.currency !== "usd"
    || operation.startingBalanceCents !== input.expectedStartingCreditCents
    || !isStripeId(operation.stripeCustomerId, "cus_")
    || !isStripeId(operation.stripeSubscriptionId, "sub_")) {
    throw mutationError("OPERATION_KEY_IN_USE", "This administrative operation key is already in use.")
  }
}

function assertCoherentVerifiedOperation(operation: BillingGoodwillOperation): void {
  const expectedEndingCreditCents = operation.startingBalanceCents + operation.amountCents
  if (!isStripeId(operation.stripeBalanceTransactionId, "cbtxn_")
    || !Number.isSafeInteger(expectedEndingCreditCents)
    || operation.endingBalanceCents !== expectedEndingCreditCents
    || operation.failureCode !== null) {
    throw operationKeyInUse()
  }
}

function buildGoodwillBundle(
  operation: BillingGoodwillOperation,
  recipientEmail: string,
  endingCreditCents: number,
): RecordAdminActionInput {
  return {
    actorUserId: operation.actorUserId,
    targetUserId: operation.targetUserId,
    actionKind: "BILLING_GOODWILL_CREDIT_VERIFIED",
    reasonCode: operation.reasonCode,
    internalNote: operation.internalNote,
    idempotencyKey: operation.idempotencyKey,
    beforeState: {
      startingCreditCents: operation.startingBalanceCents,
      amountCents: operation.amountCents,
      currency: "usd",
    },
    afterState: {
      endingCreditCents,
      amountCents: operation.amountCents,
      currency: "usd",
    },
    activity: {
      title: "Invoice credit added",
      explanation: `Massage Lab support added a $${formatUsd(operation.amountCents)} credit toward future invoices. The invoice credit balance immediately after this credit was $${formatUsd(endingCreditCents)}.`,
      effectiveValue: `+$${formatUsd(operation.amountCents)} invoice credit`,
    },
    email: {
      kind: "BILLING_GOODWILL_CREDIT_VERIFIED",
      recipientEmail,
      subject: "A credit was added to your Massage Lab billing account",
      message: `Massage Lab support added a $${formatUsd(operation.amountCents)} credit toward future invoices. The invoice credit balance immediately after this credit was $${formatUsd(endingCreditCents)}. If you did not expect this change, contact Massage Lab support.`,
    },
  }
}

function operationKeyInUse(): BillingGoodwillMutationError {
  return mutationError("OPERATION_KEY_IN_USE", "This administrative operation key is already in use.")
}

function parseMutationCustomer(value: unknown, expectedId: string, expectedLivemode: boolean) {
  const customer = parseStripeCustomer(value, expectedId)
  if (customer.livemode !== expectedLivemode) throw new Error("Stripe mode mismatch")
  return customer
}

function buildStripeGoodwillRequest(operation: BillingGoodwillOperation) {
  return {
    amount: -operation.amountCents,
    currency: "usd" as const,
    description: BILLING_GOODWILL_DESCRIPTION,
    metadata: { operationId: operation.id, targetUserId: operation.targetUserId },
  }
}

class GoodwillReadbackValidationError extends Error {
  readonly code: "STRIPE_TRANSACTION_INVALID" | "STRIPE_CUSTOMER_INVALID"

  constructor(code: "STRIPE_TRANSACTION_INVALID" | "STRIPE_CUSTOMER_INVALID") {
    super(code)
    this.code = code
  }
}

function validateAuthoritativeReadback(
  transaction: unknown,
  customer: unknown,
  operation: BillingGoodwillOperation,
  expectedLivemode: boolean,
  historicalReconciliation: boolean,
): number {
  if (!isRecord(transaction)
    || transaction.id !== operation.stripeBalanceTransactionId
    || transaction.customer !== operation.stripeCustomerId
    || transaction.currency !== "usd"
    || transaction.amount !== -operation.amountCents
    || !isSafeCents(transaction.ending_balance)
    || transaction.ending_balance > 0
    || typeof transaction.livemode !== "boolean"
    || transaction.livemode !== expectedLivemode) {
    throw new GoodwillReadbackValidationError("STRIPE_TRANSACTION_INVALID")
  }
  if (!isRecord(customer)
    || customer.id !== operation.stripeCustomerId
    || customer.deleted === true
    || typeof customer.livemode !== "boolean"
    || customer.livemode !== expectedLivemode) {
    throw new GoodwillReadbackValidationError("STRIPE_CUSTOMER_INVALID")
  }
  const expectedEndingCreditCents = operation.startingBalanceCents + operation.amountCents
  if (!Number.isSafeInteger(expectedEndingCreditCents)
    || Math.abs(transaction.ending_balance) !== expectedEndingCreditCents) {
    throw new GoodwillReadbackValidationError("STRIPE_TRANSACTION_INVALID")
  }
  // Initial settlement proves both historical transaction and current Customer
  // balance. Later reconciliation cannot assume no intervening invoice or balance event.
  if (!historicalReconciliation) {
    let customerEvidence: { balance: number; livemode: boolean }
    try {
      customerEvidence = parseMutationCustomer(customer, operation.stripeCustomerId, expectedLivemode)
    } catch {
      throw new GoodwillReadbackValidationError("STRIPE_CUSTOMER_INVALID")
    }
    if (Math.abs(customerEvidence.balance) !== expectedEndingCreditCents
      || customerEvidence.balance !== transaction.ending_balance) {
      throw new GoodwillReadbackValidationError("STRIPE_TRANSACTION_INVALID")
    }
  }
  return expectedEndingCreditCents
}

/** A replayable operation is never downgraded to definitely-not-mutated. */
async function persistPreCallFailure(
  prismaClient: PrismaClient,
  operation: BillingGoodwillOperation,
  failureCode: string,
  possiblyCommitted: boolean,
): Promise<BillingGoodwillOperation> {
  const definitelyNotMutated = operation.status === "PREPARED" && !possiblyCommitted
  return persistGoodwillState(prismaClient, operation.id, {
    status: definitelyNotMutated ? "FAILED_BEFORE_MUTATION" : "RECONCILIATION_REQUIRED",
    failureCode,
  }, [...BILLING_GOODWILL_UNRESOLVED_STATUSES])
}

async function persistGoodwillState(
  prismaClient: PrismaClient,
  operationId: string,
  data: Record<string, unknown>,
  allowedStatuses: GoodwillPersistedStatus[],
): Promise<BillingGoodwillOperation> {
  return runBillingGoodwillTransaction(prismaClient, async (tx) => {
    await tx.adminBillingGoodwillOperation.updateMany({
      where: { id: operationId, status: { in: allowedStatuses } },
      data,
    })
    const operation = await tx.adminBillingGoodwillOperation.findUnique({ where: { id: operationId } })
    if (!operation) throw new Error("Billing goodwill operation was not found.")
    return operation as BillingGoodwillOperation
  })
}

/** A concurrent verifier wins over a stale failure writer and supplies the existing intent. */
async function settlePersistedOutcome(
  input: BillingGoodwillMutationInput,
  operation: BillingGoodwillOperation,
  prepared: PreparedGoodwill,
): Promise<BillingGoodwillResult> {
  if (operation.status === "VERIFIED") {
    return finalizeVerifiedGoodwill(input, operation, prepared.recipientEmail, true)
  }
  return operationResult(operation, prepared.replayed, null)
}

function unresolvedReplayResult(operation: BillingGoodwillOperation): BillingGoodwillResult {
  return {
    operationId: operation.id,
    status: "RECONCILIATION_REQUIRED",
    amountCents: operation.amountCents,
    endingCreditCents: null,
    replayed: true,
    emailIntentId: null,
  }
}

function operationResult(
  operation: BillingGoodwillOperation,
  replayed: boolean,
  emailIntentId: string | null,
): BillingGoodwillResult {
  if (operation.status !== "VERIFIED"
    && operation.status !== "RECONCILIATION_REQUIRED"
    && operation.status !== "FAILED_BEFORE_MUTATION") {
    throw new Error("Billing goodwill operation is not in a returnable state.")
  }
  return {
    operationId: operation.id,
    status: operation.status as BillingGoodwillResult["status"],
    amountCents: operation.amountCents,
    endingCreditCents: operation.endingBalanceCents,
    replayed,
    emailIntentId,
  }
}

function liveGateFailureCode(env: BillingGoodwillMutationInput["env"]): string | null {
  const secretKey = env?.STRIPE_SECRET_KEY
  if (typeof secretKey !== "string" || (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_"))) {
    return "STRIPE_KEY_INVALID"
  }
  if (isLiveSecretKey(secretKey)
    && (env?.NODE_ENV !== "production"
      || env?.VERCEL_ENV !== "production"
      || env?.ADMIN_BILLING_GOODWILL_LIVE_ENABLED !== "true")) {
    return "LIVE_STRIPE_DISABLED"
  }
  return null
}

function isLiveSecretKey(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith("sk_live_")
}

function captureNow(value?: Date): Date {
  const now = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid operation time.")
  return now
}

/** Reads an advancing injected clock when present; fixed `now` remains deterministic for tests. */
function readMutationClock(input: Pick<BillingGoodwillMutationInput, "clock" | "now">): Date {
  return captureNow(input.clock ? input.clock() : input.now)
}

function isInsideStripeRetryWindow(createdAt: Date, now: Date): boolean {
  if (!(createdAt instanceof Date) || !Number.isFinite(createdAt.getTime())) return false
  const ageMs = now.getTime() - createdAt.getTime()
  return ageMs >= 0 && ageMs < STRIPE_IDEMPOTENCY_RETRY_WINDOW_MS
}

function requireValidEmail(value: unknown, label: "target" | "confirmation"): string {
  const email = normalizeEmail(typeof value === "string" ? value : null)
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(label === "target"
      ? "Billing goodwill requires a verified target account with an email."
      : "Provide a valid confirmation email.")
  }
  return email
}

function validateIdentifier(value: string, label: string): void {
  if (typeof value !== "string" || !value.trim() || value.length > 191 || /[\r\n]/.test(value)) {
    throw new Error(`Provide a valid ${label}.`)
  }
}

function formatUsd(cents: number): string {
  return (cents / 100).toFixed(2)
}

function mutationError(code: BillingGoodwillMutationErrorCode, message: string) {
  return new BillingGoodwillMutationError(code, message)
}

class BillingGoodwillIdempotencySnapshotConflict extends Error {
  readonly code = "P2034"
}

async function runBillingGoodwillTransaction<T>(
  prismaClient: PrismaClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let snapshotRestartUsed = false
  return runCommerceTransaction(prismaClient, async (tx) => {
    try {
      return await callback(tx)
    } catch (error) {
      if (!snapshotRestartUsed && isBillingGoodwillUniqueRace(error)) {
        snapshotRestartUsed = true
        throw new BillingGoodwillIdempotencySnapshotConflict()
      }
      throw error
    }
  })
}

function isBillingGoodwillUniqueRace(error: unknown): boolean {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "P2002") return false
  const meta = (error as { meta?: unknown }).meta
  if (!meta || typeof meta !== "object") return false
  const modelName = (meta as { modelName?: unknown }).modelName
  const target = (meta as { target?: unknown }).target
  return Array.isArray(target)
    && target.length === 1
    && target[0] === "idempotencyKey"
    && (modelName === "AdminBillingGoodwillOperation" || modelName === "AdminAction")
}

function parseStripeCustomer(value: unknown, expectedId: string) {
  if (!isRecord(value)
    || value.id !== expectedId
    || value.deleted === true
    || typeof value.livemode !== "boolean"
    || !isSafeCents(value.balance)
    || value.balance > 0) {
    throw previewError("STRIPE_CUSTOMER_INVALID")
  }
  return { balance: value.balance, livemode: value.livemode }
}

function parseStripeSubscription(
  value: unknown,
  expectedId: string,
  expectedCustomerId: string,
  expectedLivemode: boolean,
) {
  if (!isRecord(value) || value.id !== expectedId) {
    throw previewError("STRIPE_SUBSCRIPTION_INVALID")
  }
  if (typeof value.customer !== "string"
    || value.customer !== expectedCustomerId) {
    throw previewError("CUSTOMER_SUBSCRIPTION_MISMATCH")
  }
  if (!isEligibleStatus(value.status)
    || typeof value.livemode !== "boolean"
    || value.livemode !== expectedLivemode) {
    throw previewError("STRIPE_SUBSCRIPTION_INVALID")
  }
  return {
    status: value.status,
    currency: typeof value.currency === "string" ? value.currency : null,
  }
}

function parseStripeInvoicePreview(value: unknown, expectedCustomerId: string, expectedLivemode: boolean) {
  if (!isRecord(value)
    || typeof value.customer !== "string"
    || value.customer !== expectedCustomerId
    || value.currency !== "usd"
    || typeof value.livemode !== "boolean"
    || value.livemode !== expectedLivemode
    || !isSafeCents(value.amount_due)
    || value.amount_due < 0) {
    throw previewError("STRIPE_PREVIEW_INVALID")
  }
  return { amountDue: value.amount_due }
}

function isEligibleStatus(value: unknown): value is BillingGoodwillPreview["status"] {
  return typeof value === "string"
    && (ELIGIBLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
}

function isSafeCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value)
}

function isStripeId(value: unknown, prefix: "cus_" | "sub_" | "cbtxn_"): value is string {
  return typeof value === "string"
    && value.length <= 255
    && new RegExp(`^${prefix}[A-Za-z0-9]+$`).test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Replaces provider failures with stable codes so raw Stripe details never escape. */
async function safeStripeRead<T>(
  operation: () => Promise<T>,
  code: BillingGoodwillPreviewErrorCode,
): Promise<T> {
  try {
    return await operation()
  } catch {
    throw previewError(code)
  }
}

function previewError(code: BillingGoodwillPreviewErrorCode): BillingGoodwillPreviewError {
  return new BillingGoodwillPreviewError(code)
}
