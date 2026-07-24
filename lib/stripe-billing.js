import Stripe from "stripe"
import { DONATION_PURPOSE } from "./donations.js"
import {
  getConfiguredMembershipOptions,
  hasSubscriptionBlockingNewCheckout,
  isPaidMembershipLevel,
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
import { getSupporterRecurringTaxReadiness } from "./stripe-readiness.js"
import { STRIPE_API_VERSION } from "./stripe-webhook-contract.js"

export { STRIPE_API_VERSION }
export const BACKGROUND_PURCHASE_PURPOSE = "background_purchase"
export const BACKGROUND_PURCHASE_SCHEMA_VERSION = "2"
const MEMBERSHIP_CHECKOUT_PURPOSE = "membership"
const SUPPORTER_MEMBERSHIP_CATALOG_VERSION = "supporter_membership_v1"
export const SUPPORTER_MEMBERSHIP_CHECKOUT_CONTRACT_VERSION = "supporter_membership_v1_checkout_v1"
const MAX_MEMBERSHIP_CHECKOUT_SESSION_PAGES = 100
const MEMBERSHIP_CHECKOUT_RECONCILIATION_WINDOW_SECONDS = 7 * 24 * 60 * 60

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

function isMassageLabMembershipCheckoutSession(session, { customerId, userId }) {
  const metadata = objectRecord(session?.metadata)
  const purpose = safeString(metadata.purpose)
  const clientReferenceId = safeString(session?.client_reference_id)

  return session?.mode === "subscription"
    && stripeId(session?.customer) === customerId
    && safeString(metadata.userId) === userId
    && (!clientReferenceId || clientReferenceId === userId)
    && isPaidMembershipLevel(metadata.membershipLevel)
    && (!purpose || purpose === MEMBERSHIP_CHECKOUT_PURPOSE)
}

/**
 * Lists every bounded page needed to find recent MassageLab-owned membership
 * Sessions. The seven-day window covers open Sessions and webhook reconciliation
 * races without scanning a customer's full Checkout history synchronously.
 * Malformed or non-advancing pagination fails closed.
 */
async function listStripeMembershipCheckoutSessions(
  stripe,
  { customerId, userId, nowSeconds = Math.floor(Date.now() / 1000) },
) {
  const sessions = []
  const seenCursors = new Set()
  let startingAfter

  for (let pageNumber = 0; pageNumber < MAX_MEMBERSHIP_CHECKOUT_SESSION_PAGES; pageNumber += 1) {
    const page = await stripe.checkout.sessions.list({
      customer: customerId,
      created: {
        gte: Math.max(
          0,
          Math.floor(nowSeconds) - MEMBERSHIP_CHECKOUT_RECONCILIATION_WINDOW_SECONDS,
        ),
      },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (!Array.isArray(page?.data) || typeof page?.has_more !== "boolean") {
      throw new Error("Stripe returned an invalid Checkout Session page.")
    }

    sessions.push(...page.data.filter((session) => (
      isMassageLabMembershipCheckoutSession(session, { customerId, userId })
    )))
    if (!page.has_more) {
      return sessions.sort((left, right) => {
        const createdDelta = Number(right?.created ?? 0) - Number(left?.created ?? 0)
        return createdDelta || safeString(right?.id).localeCompare(safeString(left?.id))
      })
    }

    const nextCursor = safeString(page.data.at(-1)?.id)
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("Stripe Checkout Session pagination did not advance.")
    }
    seenCursors.add(nextCursor)
    startingAfter = nextCursor
  }

  throw new Error("Stripe Checkout Session pagination exceeded the safe limit.")
}

/**
 * Projects a Stripe Checkout Session to the non-sensitive fields returned to
 * the membership route after reuse or completed-subscription detection.
 * @param {Record<string, unknown>} session
 * @returns {{ id: string, status: string, subscription: string | null, url: string | null }}
 */
function membershipCheckoutProjection(session) {
  return {
    id: safeString(session?.id),
    status: safeString(session?.status),
    subscription: stripeId(session?.subscription) || null,
    url: typeof session?.url === "string" ? session.url : null,
  }
}

/**
 * Reads every expanded line item needed to validate a reusable membership
 * Session. Invalid, stalled, or more than 100 pages fail closed.
 * @param {Record<string, any>} stripe
 * @param {string} sessionId
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function listStripeMembershipCheckoutLineItems(stripe, sessionId) {
  const lineItems = []
  const seenCursors = new Set()
  let startingAfter

  for (let pageNumber = 0; pageNumber < MAX_MEMBERSHIP_CHECKOUT_SESSION_PAGES; pageNumber += 1) {
    const page = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ["data.price.product"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (!Array.isArray(page?.data) || typeof page?.has_more !== "boolean") {
      throw new Error("Stripe returned an invalid membership Checkout line-item page.")
    }
    lineItems.push(...page.data)
    if (!page.has_more) {
      return lineItems
    }

    const nextCursor = safeString(page.data.at(-1)?.id)
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("Stripe membership Checkout line-item pagination did not advance.")
    }
    seenCursors.add(nextCursor)
    startingAfter = nextCursor
  }

  throw new Error("Stripe membership Checkout line-item pagination exceeded the safe limit.")
}

/**
 * Reuses only Sessions created by the current Supporter Checkout contract.
 * The version marker is necessary but not sufficient: Stripe's returned
 * tax/address state and the expanded configured Price/Product must also match.
 */
async function isCurrentSupporterMembershipCheckoutSession(
  stripe,
  session,
  { currentPriceIds, requestedPriceId },
) {
  const metadata = objectRecord(session?.metadata)
  if (
    safeString(metadata.purpose) !== MEMBERSHIP_CHECKOUT_PURPOSE
    || safeString(metadata.membershipLevel).toUpperCase() !== "SUPPORTER"
    || safeString(metadata.checkoutContractVersion)
      !== SUPPORTER_MEMBERSHIP_CHECKOUT_CONTRACT_VERSION
    || session?.automatic_tax?.enabled !== true
    || session?.billing_address_collection !== "required"
  ) {
    return false
  }

  const lineItems = await listStripeMembershipCheckoutLineItems(stripe, session.id)
  if (lineItems.length !== 1 || lineItems[0]?.quantity !== 1) {
    return false
  }

  const price = objectRecord(lineItems[0]?.price)
  const priceId = safeString(price.id)
  const product = objectRecord(price.product)
  const productMetadata = objectRecord(product.metadata)

  return priceId === requestedPriceId
    && currentPriceIds.has(priceId)
    && price.active === true
    && price.tax_behavior === "exclusive"
    && product.active === true
    && product.tax_code === "txcd_10000000"
    && safeString(productMetadata.massagelab_catalog)
      === SUPPORTER_MEMBERSHIP_CATALOG_VERSION
}

function membershipCheckoutExpirationIdempotencyKey(sessionId) {
  return `massagelab-membership-checkout-expire:${sessionId}`
}

/**
 * An expiration can commit even when its response is lost. Re-retrieval is the
 * authority: only a confirmed terminal Session permits current Checkout to
 * continue.
 */
async function expireAndConfirmLegacyMembershipCheckout(stripe, sessionId) {
  try {
    await stripe.checkout.sessions.expire(
      sessionId,
      {},
      {
        idempotencyKey: membershipCheckoutExpirationIdempotencyKey(sessionId),
      },
    )
  } catch {
    // An ambiguous POST may still have committed; confirmation below decides.
  }

  let confirmed
  try {
    confirmed = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    throw new Error("Unable to confirm legacy membership Checkout expiration.")
  }
  if (confirmed?.status !== "expired") {
    throw new Error("Unable to confirm legacy membership Checkout expiration.")
  }
}

/**
 * Reconciles recent Stripe membership Sessions for a customer and user.
 * @param {Record<string, any>} stripe
 * @param {{ customerId: string, userId: string, priceId: string, env?: Record<string, string>, nowSeconds?: number }} options
 * @returns {Promise<{ session: ReturnType<typeof membershipCheckoutProjection> | null, latestSessionId: string }>}
 *
 * Completed blocking memberships take precedence. Compatible open Sessions are
 * reused; incompatible and duplicate open Sessions are expired in order.
 * Unsupported or invalid Stripe states fail closed, while latestSessionId
 * anchors Checkout rotation and idempotency.
 */
async function resolveExistingStripeMembershipCheckout(stripe, options) {
  const sessions = await listStripeMembershipCheckoutSessions(stripe, options)
  for (const completedSession of sessions.filter((session) => session?.status === "complete")) {
    const subscriptionId = stripeId(completedSession.subscription)
    if (!subscriptionId) {
      throw new Error("Stripe returned a completed membership Checkout without a subscription.")
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (hasSubscriptionBlockingNewCheckout([subscription])) {
      return {
        session: membershipCheckoutProjection(completedSession),
        latestSessionId: safeString(completedSession.id),
      }
    }
  }

  const currentPriceIds = new Set(
    getConfiguredMembershipOptions(options.env).map(({ priceId }) => priceId),
  )
  const reusableOpenSessions = []
  const incompatibleOpenSessions = []
  for (const openSession of sessions.filter((session) => session?.status === "open")) {
    if (await isCurrentSupporterMembershipCheckoutSession(
      stripe,
      openSession,
      { currentPriceIds, requestedPriceId: options.priceId },
    )) {
      reusableOpenSessions.push(openSession)
    } else {
      incompatibleOpenSessions.push(openSession)
    }
  }

  const reusableOpenSession = reusableOpenSessions[0]
  const sessionsToExpire = [
    ...incompatibleOpenSessions,
    ...reusableOpenSessions.slice(1),
  ]
  for (const sessionToExpire of sessionsToExpire) {
    await expireAndConfirmLegacyMembershipCheckout(stripe, sessionToExpire.id)
  }

  if (reusableOpenSession) {
    if (typeof reusableOpenSession.url !== "string" || !reusableOpenSession.url) {
      throw new Error("Stripe returned an open Checkout Session without a URL.")
    }
    return {
      session: membershipCheckoutProjection(reusableOpenSession),
      latestSessionId: safeString(sessions[0]?.id) || "initial",
    }
  }
  if (sessionsToExpire.length > 0) {
    return {
      session: null,
      latestSessionId: safeString(sessions[0]?.id) || "initial",
    }
  }

  const latestSession = sessions[0]
  if (!latestSession) {
    return { session: null, latestSessionId: "initial" }
  }
  if (latestSession.status === "expired" || latestSession.status === "complete") {
    return { session: null, latestSessionId: safeString(latestSession.id) }
  }
  throw new Error("Stripe returned an unsupported membership Checkout Session status.")
}

function membershipCheckoutIdempotencyKey(userId, latestSessionId) {
  return `massagelab-membership-checkout:${userId}:after:${latestSessionId}`
}

/**
 * Returns a safe Checkout projection while serializing membership attempts at
 * Stripe. Open Sessions are reused; terminal Sessions rotate the deterministic
 * user-scoped idempotency key; completed relevant subscriptions block until
 * webhook persistence catches up. If a concurrent different-price request
 * advances the latest Session during create recovery, one retry uses a key
 * anchored to that Session; no create path retries more than once.
 */
export async function createStripeCheckoutSession(options) {
  const stripe = options.stripeClient ?? getStripeClient(options.apiKey)
  const membershipLevel = normalizeMembershipLevel(options.membershipLevel)
  const supporterTax = membershipLevel === "SUPPORTER"
    ? getSupporterRecurringTaxReadiness(options.env)
    : null
  if (supporterTax && !supporterTax.ready) {
    throw new Error("Supporter recurring tax readiness is not configured.")
  }
  const session = {
    mode: "subscription",
    customer: options.customerId,
    client_reference_id: options.userId,
    ...(supporterTax
      ? {
          automatic_tax: { enabled: true },
          billing_address_collection: "required",
          customer_update: { address: "auto" },
        }
      : {}),
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    line_items: [
      {
        price: options.priceId,
        quantity: 1,
      },
    ],
    metadata: {
      purpose: MEMBERSHIP_CHECKOUT_PURPOSE,
      checkoutContractVersion: SUPPORTER_MEMBERSHIP_CHECKOUT_CONTRACT_VERSION,
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

  const existing = await resolveExistingStripeMembershipCheckout(stripe, {
    customerId: options.customerId,
    env: options.env,
    nowSeconds: options.nowSeconds,
    priceId: options.priceId,
    userId: options.userId,
  })
  if (existing.session) {
    return existing.session
  }

  const requestOptions = {
    idempotencyKey: membershipCheckoutIdempotencyKey(
      options.userId,
      existing.latestSessionId,
    ),
  }
  try {
    return membershipCheckoutProjection(
      await stripe.checkout.sessions.create(session, requestOptions),
    )
  } catch (error) {
    const recovered = await resolveExistingStripeMembershipCheckout(stripe, {
      customerId: options.customerId,
      env: options.env,
      nowSeconds: options.nowSeconds,
      priceId: options.priceId,
      userId: options.userId,
    })
    if (recovered.session) {
      return recovered.session
    }
    if (recovered.latestSessionId !== existing.latestSessionId) {
      return membershipCheckoutProjection(
        await stripe.checkout.sessions.create(session, {
          idempotencyKey: membershipCheckoutIdempotencyKey(
            options.userId,
            recovered.latestSessionId,
          ),
        }),
      )
    }
    throw error
  }
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
    throw new Error("One-time support amount must be at least $1.00.")
  }

  const stripe = stripeClient ?? getStripeClient(apiKey)
  const metadata = {
    purpose: DONATION_PURPOSE,
    ...(userId ? { userId } : {}),
  }
  const session = {
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: "MassageLab One-time support",
            description: "One-time support does not create a membership or unlock features. It is not a charitable donation and is not tax-deductible.",
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

  // This non-entitlement payment intentionally omits Automatic Tax. Its tax
  // classification requires tax-professional review and is separate from the
  // permanent-background `txcd_10000000` classification.

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
 * Paid background checkout requires Stripe Tax plus the kill switch, legal,
 * catalog, geography, webhook, and reconciliation signals.
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
    taxMode: "stripe",
    taxCode: tax.taxCode,
    taxBehavior: "exclusive",
  }
  const lineItems = items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.displayName,
        metadata: {
          productType: item.productType,
          productKey: item.productKey,
          taxCode: tax.taxCode,
        },
        tax_code: tax.taxCode,
      },
      unit_amount: 100,
      tax_behavior: "exclusive",
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
    customer_update: { address: "auto" },
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Sample the clock once immediately before the first create call, then reuse
    // this exact payload only for the immediate in-call connection retry.
    expires_at: checkoutExpiresAt,
    automatic_tax: { enabled: true },
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
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  })
  const lineItems = []
  let startingAfter
  let lineItemList

  do {
    lineItemList = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ["data.price.product"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (!Array.isArray(lineItemList?.data)) {
      throw new Error("Stripe returned an invalid Checkout line-item page.")
    }
    lineItems.push(...lineItemList.data)
    if (!lineItemList.has_more) break

    const lastLineItemId = lineItemList.data.at(-1)?.id
    if (!lastLineItemId) {
      throw new Error("Stripe Checkout line-item pagination did not advance.")
    }
    startingAfter = lastLineItemId
  } while (true)

  return {
    ...session,
    line_items: {
      ...lineItemList,
      data: lineItems,
      has_more: false,
    },
  }
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
  if (purpose === MEMBERSHIP_CHECKOUT_PURPOSE && session?.mode === "subscription") {
    return MEMBERSHIP_CHECKOUT_PURPOSE
  }
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
