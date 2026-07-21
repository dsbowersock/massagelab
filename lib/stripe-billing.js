import Stripe from "stripe"
import { DONATION_PURPOSE } from "./donations.js"
import {
  normalizeMembershipLevel,
  resolveStripePriceMembershipLevel,
} from "./membership.js"
import { getCommerceTaxReadiness } from "./commerce/catalog.ts"
import { COMMERCE_ERROR_CODES, CommerceError } from "./commerce/errors.ts"
import {
  DIGITAL_PURCHASES_REFUNDS_VERSION,
  legalDocumentAcceptanceId,
  requiredLegalDocumentsForEvent,
} from "./legal-documents.js"

export const STRIPE_API_VERSION = "2026-02-25.clover"
export const BACKGROUND_PURCHASE_PURPOSE = "background_purchase"
export const BACKGROUND_PURCHASE_SCHEMA_VERSION = "1"

export function stripeTimestampToDate(value) {
  return typeof value === "number" ? new Date(value * 1000) : null
}

function safeString(value) {
  return typeof value === "string" ? value : ""
}

function objectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function stripeId(value) {
  if (typeof value === "string") {
    return value
  }

  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id
  }

  return ""
}

export function verifyStripeWebhookSignature(
  rawBody,
  signatureHeader,
  webhookSecret,
  { nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300 } = {},
) {
  if (!rawBody || !signatureHeader || !webhookSecret) {
    return false
  }

  const stripe = getStripeClient("sk_test_webhook_verification")
  try {
    stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret, toleranceSeconds, undefined, nowSeconds * 1000)
    return true
  } catch {
    return false
  }
}

export function normalizeStripeSubscription(subscription, { env = process.env } = {}) {
  const metadata = objectRecord(subscription?.metadata)
  const firstItem = subscription?.items?.data?.[0] ?? {}
  const price = objectRecord(firstItem.price)
  const currentPeriodStart = subscription?.current_period_start ?? firstItem.current_period_start
  const currentPeriodEnd = subscription?.current_period_end ?? firstItem.current_period_end
  const membershipLevel = resolveStripePriceMembershipLevel({ priceId: safeString(price.id), env })

  if (!membershipLevel) {
    return null
  }

  return {
    stripeSubscriptionId: safeString(subscription?.id),
    stripeCustomerId: stripeId(subscription?.customer),
    status: safeString(subscription?.status),
    membershipLevel,
    stripePriceId: safeString(price.id),
    stripeProductId: stripeId(price.product),
    currentPeriodStart: stripeTimestampToDate(currentPeriodStart),
    currentPeriodEnd: stripeTimestampToDate(currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    canceledAt: stripeTimestampToDate(subscription?.canceled_at),
    couponId: safeString(subscription?.discount?.coupon?.id) || null,
    metadata,
  }
}

export function getStripeSecretKey(env = process.env) {
  return env.STRIPE_SECRET_KEY?.trim() || ""
}

export function getStripeWebhookSecret(env = process.env) {
  return env.STRIPE_WEBHOOK_SECRET?.trim() || ""
}

function assertStripeKey(apiKey) {
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.")
  }
}

export function getStripeClient(apiKey = getStripeSecretKey()) {
  assertStripeKey(apiKey)
  return new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
  })
}

export async function createStripeCustomer({ email, name, userId, apiKey, stripeClient, idempotencyKey } = {}) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const metadata = userId ? { userId } : undefined
  const requestOptions = idempotencyKey ? { idempotencyKey } : undefined

  return stripe.customers.create({
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(metadata ? { metadata } : {}),
  }, requestOptions)
}

/**
 * Stripe reports a missing Customer as StripeInvalidRequestError with
 * resource_missing on either code or raw.code; every other error should fail.
 */
function isMissingStripeResourceError(error) {
  return error?.type === "StripeInvalidRequestError"
    && (error?.code === "resource_missing" || error?.raw?.code === "resource_missing")
}

function stripeCustomerCreateIdempotencyKey(userId, existingStripeCustomerId = "") {
  return `massagelab-customer:${userId}:${existingStripeCustomerId || "new"}`
}

export async function createStripeCheckoutSession(options) {
  const stripe = options.stripeClient ?? getStripeClient(options.apiKey)
  const membershipLevel = normalizeMembershipLevel(options.membershipLevel)
  const session = {
    mode: "subscription",
    customer: options.customerId,
    client_reference_id: options.userId,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    line_items: [
      {
        price: options.priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId: options.userId,
      membershipLevel,
    },
    subscription_data: {
      metadata: {
        userId: options.userId,
        membershipLevel,
      },
    },
  }

  if (options.couponId) {
    session.discounts = [{ coupon: options.couponId }]
  }

  return stripe.checkout.sessions.create(session)
}

/**
 * @param {{
 *   amountCents: number
 *   currency?: string
 *   customerEmail?: string
 *   userId?: string
 *   successUrl: string
 *   cancelUrl: string
 *   apiKey?: string
 *   stripeClient?: {
 *     checkout: {
 *       sessions: {
 *         create: (payload: Record<string, unknown>) => Promise<unknown>
 *       }
 *     }
 *   }
 * }} input
 * @returns {Promise<{ url?: string | null } & Record<string, unknown>>}
 */
export async function createStripeDonationCheckoutSession({
  amountCents,
  currency = "usd",
  customerEmail = "",
  userId = "",
  successUrl,
  cancelUrl,
  apiKey,
  stripeClient,
} = {}) {
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw new Error("Donation amount must be at least $1.00.")
  }

  const stripe = stripeClient ?? getStripeClient(apiKey)
  const metadata = {
    purpose: DONATION_PURPOSE,
    ...(userId ? { userId } : {}),
  }
  const session = {
    mode: "payment",
    submit_type: "donate",
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: "MassageLab project support",
            description: "One-time support for MassageLab development, privacy infrastructure, and compliance groundwork.",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
    },
  }

  if (customerEmail) {
    session.customer_email = customerEmail
  }

  return stripe.checkout.sessions.create(session)
}

function explicitTrue(value) {
  return String(value ?? "").trim().toLowerCase() === "true"
}

function hasCurrentDigitalPurchaseConsent(value) {
  if (
    !value
    || typeof value !== "object"
    || value.combinedConsentAccepted !== true
    || !Array.isArray(value.documentIds)
    || !value.documentVersions
    || typeof value.documentVersions !== "object"
    || Array.isArray(value.documentVersions)
    || typeof value.acceptedAt !== "string"
    || !Number.isFinite(Date.parse(value.acceptedAt))
  ) {
    return false
  }

  const documents = requiredLegalDocumentsForEvent("digital-purchase")
  const expectedIds = documents.map((document) => legalDocumentAcceptanceId(document))
  return value.documentIds.length === expectedIds.length
    && expectedIds.every((documentId, index) => value.documentIds[index] === documentId)
    && documents.every((document) => value.documentVersions[document.key] === document.version)
    && Object.keys(value.documentVersions).length === documents.length
}

/**
 * One fail-closed gate shared by the background route and Stripe adapter.
 *
 * Disabled tax is a supported tax posture, but it never enables purchasing by
 * itself: the kill switch plus legal, catalog, geography, webhook, and
 * reconciliation signals must all be ready.
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv
 *   purchaseCountry?: string
 *   legalConsent?: unknown
 *   catalogReady?: boolean
 * }} input
 */
export function assertBackgroundCommercePurchasingReady({
  env = process.env,
  purchaseCountry,
  legalConsent,
  catalogReady,
} = {}) {
  const tax = getCommerceTaxReadiness(env)
  const purchaseCountries = String(env.BACKGROUND_COMMERCE_PURCHASE_COUNTRIES ?? "")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean)
  const ready = explicitTrue(env.BACKGROUND_COMMERCE_PURCHASING_ENABLED)
    && String(env.BACKGROUND_COMMERCE_PRICE_CENTS ?? "").trim() === "100"
    && purchaseCountries.length === 1
    && purchaseCountries[0] === "US"
    && env.BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION === DIGITAL_PURCHASES_REFUNDS_VERSION
    && explicitTrue(env.BACKGROUND_COMMERCE_WEBHOOK_READY)
    && explicitTrue(env.BACKGROUND_COMMERCE_RECONCILIATION_READY)
    && Boolean(env.STRIPE_SECRET_KEY?.trim())
    && Boolean(env.STRIPE_WEBHOOK_SECRET?.trim())
    && purchaseCountry === "US"
    && catalogReady === true
    && tax.ready
    && hasCurrentDigitalPurchaseConsent(legalConsent)

  if (!ready) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.TAX_NOT_READY })
  }

  return tax
}

function stripeErrorType(error) {
  return error && typeof error === "object" && typeof error.type === "string"
    ? error.type
    : ""
}

function stripeErrorStatus(error) {
  return error && typeof error === "object" && Number.isInteger(error.statusCode)
    ? error.statusCode
    : null
}

/**
 * Identifies outcomes where Stripe may have accepted Session creation even
 * though this process did not receive a conclusive response.
 */
export function isIndeterminateBackgroundCheckoutError(error) {
  const type = stripeErrorType(error)
  const status = stripeErrorStatus(error)
  return type === "StripeConnectionError"
    || type === "StripeAPIError"
    || type === "StripeIdempotencyError"
    || (status !== null && status >= 500)
}

function isStripeConnectionError(error) {
  return stripeErrorType(error) === "StripeConnectionError"
}

/**
 * Creates only one-time permanent-background Checkout Sessions.
 *
 * The immutable order snapshot is the price authority; line items cannot be
 * merged because each background must remain independently refundable later.
 */
export async function createBackgroundPurchaseCheckoutSession({
  orderId,
  userId,
  checkoutAttempt,
  customerId,
  items,
  legalConsent,
  purchaseCountry,
  successUrl,
  cancelUrl,
  now = () => new Date(),
  env = process.env,
  apiKey,
  stripeClient,
} = {}) {
  const distinctKeys = new Set()
  const validItems = Array.isArray(items)
    && items.length > 0
    && items.every((item) => {
      const valid = item?.productType === "background"
        && typeof item.productKey === "string"
        && item.productKey.length > 0
        && typeof item.displayName === "string"
        && item.displayName.length > 0
        && item.unitAmount === 100
        && item.quantity === 1
        && item.currency === "usd"
        && !distinctKeys.has(item.productKey)
      if (valid) distinctKeys.add(item.productKey)
      return valid
    })
  const tax = assertBackgroundCommercePurchasingReady({
    env,
    purchaseCountry,
    legalConsent,
    catalogReady: Boolean(validItems),
  })
  if (
    !orderId
    || !userId
    || !customerId
    || !Number.isInteger(checkoutAttempt)
    || checkoutAttempt < 1
    || !successUrl
    || !cancelUrl
  ) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.TAX_NOT_READY })
  }

  const metadata = {
    purpose: BACKGROUND_PURCHASE_PURPOSE,
    orderId,
    userId,
    schemaVersion: BACKGROUND_PURCHASE_SCHEMA_VERSION,
  }
  const automaticTaxEnabled = tax.mode === "stripe"
  const lineItems = items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.displayName,
        metadata: {
          productType: item.productType,
          productKey: item.productKey,
        },
        ...(automaticTaxEnabled ? { tax_code: tax.taxCode } : {}),
      },
      unit_amount: 100,
      ...(automaticTaxEnabled ? { tax_behavior: "exclusive" } : {}),
    },
    quantity: 1,
  }))
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const checkoutNow = typeof now === "function" ? now() : now
  const checkoutExpiresAt = Math.floor(checkoutNow.getTime() / 1000) + 30 * 60
  if (!Number.isFinite(checkoutExpiresAt)) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.TAX_NOT_READY })
  }
  const payload = {
    mode: "payment",
    customer: customerId,
    billing_address_collection: "required",
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Sample the clock once immediately before the first create call, then reuse
    // this exact payload only for the immediate in-call connection retry.
    expires_at: checkoutExpiresAt,
    automatic_tax: { enabled: automaticTaxEnabled },
    line_items: lineItems,
    metadata,
    payment_intent_data: { metadata },
  }
  const requestOptions = {
    idempotencyKey: `background-purchase:${orderId}:attempt:${checkoutAttempt}`,
  }

  try {
    return await stripe.checkout.sessions.create(payload, requestOptions)
  } catch (error) {
    if (!isStripeConnectionError(error)) throw error
    // A connection error can occur after Stripe creates the Session. Reusing
    // both objects preserves the exact parameters and idempotency boundary.
    return stripe.checkout.sessions.create(payload, requestOptions)
  }
}

/**
 * Extracts processor-authoritative fulfillment evidence from a retrieved
 * Session. Browser country remains provisional and is never accepted here.
 */
export function getBackgroundPurchaseCheckoutSessionEvidence(session) {
  const status = safeString(session?.status)
  const paymentStatus = safeString(session?.payment_status)
  const rawCountry = safeString(session?.customer_details?.address?.country).toUpperCase()
  const paid = paymentStatus === "paid"
  const purchaseCountry = rawCountry === "US" ? "US" : null

  return {
    status,
    paymentStatus,
    purchaseCountry,
    paid,
    reviewRequired: paid && purchaseCountry !== "US",
  }
}

export async function retrieveBackgroundPurchaseCheckoutSession(
  sessionId,
  { apiKey, stripeClient } = {},
) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  return stripe.checkout.sessions.retrieve(sessionId)
}

/**
 * Retrieves the processor-owned fields required to reconcile an immutable order snapshot.
 *
 * This helper must be called before opening the commerce transaction.
 */
export async function retrieveBackgroundPurchaseCheckoutSessionForFulfillment(
  sessionId,
  { apiKey, stripeClient } = {},
) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product", "payment_intent"],
  })
}

export async function expireBackgroundPurchaseCheckoutSession(
  sessionId,
  { apiKey, stripeClient } = {},
) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  return stripe.checkout.sessions.expire(sessionId)
}

export async function createStripeCustomerPortalSession({ customerId, returnUrl, apiKey, stripeClient } = {}) {
  const stripe = stripeClient ?? getStripeClient(apiKey)

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}

export async function retrieveStripeSubscription(subscriptionId, { apiKey, stripeClient } = {}) {
  if (!subscriptionId) {
    return null
  }

  const stripe = stripeClient ?? getStripeClient(apiKey)

  return stripe.subscriptions.retrieve(subscriptionId)
}

export async function retrieveStripePrice(priceId, { apiKey, stripeClient } = {}) {
  if (!priceId) {
    return null
  }

  const stripe = stripeClient ?? getStripeClient(apiKey)

  return stripe.prices.retrieve(priceId)
}

export async function ensureStripeCustomerForUser(prismaClient, user, apiKey = getStripeSecretKey(), stripeClient) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const existing = await prismaClient.stripeCustomer.findUnique({
    where: { userId: user.id },
  })

  if (existing) {
    try {
      const customer = await stripe.customers.retrieve(existing.stripeCustomerId)
      if (!customer?.deleted) {
        return existing
      }
    } catch (error) {
      if (!isMissingStripeResourceError(error)) {
        throw error
      }
    }
    // A stored customer can become stale after switching Stripe modes; replace it
    // with a customer created in the active account before starting Checkout.
  }

  const customer = await createStripeCustomer({
    email: user.email,
    name: user.name,
    userId: user.id,
    idempotencyKey: stripeCustomerCreateIdempotencyKey(user.id, existing?.stripeCustomerId),
    stripeClient: stripe,
  })

  return prismaClient.stripeCustomer.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      stripeCustomerId: customer.id,
    },
    update: {
      stripeCustomerId: customer.id,
    },
  })
}

export function isDonationCheckoutSession(session) {
  return safeString(session?.metadata?.purpose) === DONATION_PURPOSE
}

/**
 * Keeps Checkout flows disjoint so an unknown explicit purpose can never fall
 * through to membership reconciliation.
 */
export function classifyStripeCheckoutSessionPurpose(session) {
  const purpose = safeString(session?.metadata?.purpose)
  if (purpose === BACKGROUND_PURCHASE_PURPOSE) return BACKGROUND_PURCHASE_PURPOSE
  if (purpose === DONATION_PURPOSE) return "donation"
  if (purpose) return "unknown"
  return session?.mode === "payment" ? "unknown" : "membership"
}

export async function recordCheckoutSessionCompleted(prismaClient, session, {
  env = process.env,
  retrieveSubscription = retrieveStripeSubscription,
} = {}) {
  if (classifyStripeCheckoutSessionPurpose(session) !== "membership") {
    return null
  }

  const userId = safeString(session?.client_reference_id) || safeString(session?.metadata?.userId)
  const stripeCustomerId = stripeId(session?.customer)

  if (!userId || !stripeCustomerId) {
    return null
  }

  const customer = await prismaClient.stripeCustomer.upsert({
    where: { userId },
    create: { userId, stripeCustomerId },
    update: { stripeCustomerId },
  })
  const subscriptionId = stripeId(session?.subscription)
  const stripeSubscription = subscriptionId ? await retrieveSubscription(subscriptionId) : null
  const subscription = stripeSubscription
    ? await upsertMembershipSubscriptionFromStripe(prismaClient, stripeSubscription, { env })
    : null

  return { customer, subscription }
}

export async function upsertMembershipSubscriptionFromStripe(prismaClient, subscription, { env = process.env } = {}) {
  const normalized = normalizeStripeSubscription(subscription, { env })
  if (!normalized) {
    return null
  }

  if (!normalized.stripeSubscriptionId || !normalized.stripeCustomerId) {
    return null
  }

  let userId = safeString(normalized.metadata.userId)

  if (!userId) {
    const customer = await prismaClient.stripeCustomer.findUnique({
      where: { stripeCustomerId: normalized.stripeCustomerId },
    })
    userId = customer?.userId ?? ""
  }

  if (!userId) {
    return null
  }

  await prismaClient.stripeCustomer.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: normalized.stripeCustomerId,
    },
    update: {
      stripeCustomerId: normalized.stripeCustomerId,
    },
  })

  return prismaClient.membershipSubscription.upsert({
    where: { stripeSubscriptionId: normalized.stripeSubscriptionId },
    create: {
      userId,
      ...normalized,
    },
    update: {
      userId,
      stripeCustomerId: normalized.stripeCustomerId,
      status: normalized.status,
      membershipLevel: normalized.membershipLevel,
      stripePriceId: normalized.stripePriceId,
      stripeProductId: normalized.stripeProductId,
      currentPeriodStart: normalized.currentPeriodStart,
      currentPeriodEnd: normalized.currentPeriodEnd,
      cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
      canceledAt: normalized.canceledAt,
      couponId: normalized.couponId,
      metadata: normalized.metadata,
    },
  })
}
