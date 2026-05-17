import Stripe from "stripe"
import {
  normalizeMembershipLevel,
  resolveStripePriceMembershipLevel,
} from "./membership.js"

export const STRIPE_API_VERSION = "2026-02-25.clover"

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

export async function createStripeCustomer({ email, name, userId, apiKey, stripeClient } = {}) {
  const stripe = stripeClient ?? getStripeClient(apiKey)
  const metadata = userId ? { userId } : undefined

  return stripe.customers.create({
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(metadata ? { metadata } : {}),
  })
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

export async function ensureStripeCustomerForUser(prismaClient, user, apiKey = getStripeSecretKey()) {
  const existing = await prismaClient.stripeCustomer.findUnique({
    where: { userId: user.id },
  })

  if (existing) {
    return existing
  }

  const customer = await createStripeCustomer({
    email: user.email,
    name: user.name,
    userId: user.id,
    apiKey,
  })

  return prismaClient.stripeCustomer.create({
    data: {
      userId: user.id,
      stripeCustomerId: customer.id,
    },
  })
}

export async function recordCheckoutSessionCompleted(prismaClient, session, {
  env = process.env,
  retrieveSubscription = retrieveStripeSubscription,
} = {}) {
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
