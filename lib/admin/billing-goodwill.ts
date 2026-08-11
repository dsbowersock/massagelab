import type { PrismaClient } from "@prisma/client"
import type Stripe from "stripe"
import { requireFullAdminUser } from "./access.ts"

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
  return { status: value.status }
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

function isStripeId(value: unknown, prefix: "cus_" | "sub_"): value is string {
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
