import { createHmac, timingSafeEqual } from "node:crypto"
import {
  buildCheckoutSessionPayload,
  formEncodeStripePayload,
  isPaidMembershipLevel,
  normalizeMembershipLevel,
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

  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((part) => part.split("="))
      .filter((part) => part.length === 2),
  )
  const timestamp = Number(parts.t)
  const signature = parts.v1

  if (!Number.isFinite(timestamp) || !signature || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false
  }

  const signedPayload = `${timestamp}.${rawBody}`
  const expected = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex")
  const expectedBuffer = Buffer.from(expected, "hex")
  const signatureBuffer = Buffer.from(signature, "hex")

  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer)
}

export function normalizeStripeSubscription(subscription) {
  const metadata = objectRecord(subscription?.metadata)
  const firstItem = subscription?.items?.data?.[0] ?? {}
  const price = objectRecord(firstItem.price)
  const rawMembershipLevel = normalizeMembershipLevel(metadata.membershipLevel, "SUPPORTER")
  const membershipLevel = isPaidMembershipLevel(rawMembershipLevel) ? rawMembershipLevel : "SUPPORTER"

  return {
    stripeSubscriptionId: safeString(subscription?.id),
    stripeCustomerId: stripeId(subscription?.customer),
    status: safeString(subscription?.status),
    membershipLevel,
    stripePriceId: safeString(price.id),
    stripeProductId: stripeId(price.product),
    currentPeriodStart: stripeTimestampToDate(subscription?.current_period_start),
    currentPeriodEnd: stripeTimestampToDate(subscription?.current_period_end),
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

export async function stripeApiRequest(path, { method = "POST", body, apiKey = getStripeSecretKey() } = {}) {
  assertStripeKey(apiKey)
  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION,
    },
    body,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = payload?.error?.message || `Stripe request failed with status ${response.status}.`
    throw new Error(message)
  }

  return payload
}

export async function createStripeCustomer({ email, name, userId, apiKey } = {}) {
  const body = new URLSearchParams()
  if (email) body.set("email", email)
  if (name) body.set("name", name)
  if (userId) body.set("metadata[userId]", userId)

  return stripeApiRequest("customers", { body, apiKey })
}

export async function createStripeCheckoutSession(options) {
  const payload = buildCheckoutSessionPayload(options)
  const body = formEncodeStripePayload(payload)

  return stripeApiRequest("checkout/sessions", { body, apiKey: options.apiKey })
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

export async function recordCheckoutSessionCompleted(prismaClient, session) {
  const userId = safeString(session?.client_reference_id) || safeString(session?.metadata?.userId)
  const stripeCustomerId = stripeId(session?.customer)

  if (!userId || !stripeCustomerId) {
    return null
  }

  return prismaClient.stripeCustomer.upsert({
    where: { userId },
    create: { userId, stripeCustomerId },
    update: { stripeCustomerId },
  })
}

export async function upsertMembershipSubscriptionFromStripe(prismaClient, subscription) {
  const normalized = normalizeStripeSubscription(subscription)
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
