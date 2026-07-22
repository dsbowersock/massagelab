export const STRIPE_API_VERSION = "2026-02-25.clover"
export const STRIPE_PINNED_WEBHOOK_URL = "https://www.massagelab.app/api/billing/webhook"

export const STRIPE_MEMBERSHIP_WEBHOOK_EVENTS = Object.freeze([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
])

export const STRIPE_BACKGROUND_CHECKOUT_WEBHOOK_EVENTS = Object.freeze([
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
])

export const STRIPE_BACKGROUND_REFUND_WEBHOOK_EVENTS = Object.freeze([
  "refund.created",
  "refund.updated",
  "refund.failed",
])

export const STRIPE_BACKGROUND_DISPUTE_WEBHOOK_EVENTS = Object.freeze([
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
])

export const STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS = Object.freeze([
  ...STRIPE_BACKGROUND_CHECKOUT_WEBHOOK_EVENTS,
  ...STRIPE_BACKGROUND_REFUND_WEBHOOK_EVENTS,
  ...STRIPE_BACKGROUND_DISPUTE_WEBHOOK_EVENTS,
])

export const STRIPE_PINNED_WEBHOOK_EVENTS = Object.freeze([
  ...STRIPE_MEMBERSHIP_WEBHOOK_EVENTS,
  ...STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS,
])

/**
 * Compares a Stripe endpoint snapshot with the one shared MassageLab webhook
 * contract. The result exposes booleans only so readiness output cannot leak
 * endpoint secrets or processor payloads.
 */
export function validatePinnedStripeWebhookEndpoint(endpoint) {
  const endpointFound = Boolean(endpoint && endpoint.url === STRIPE_PINNED_WEBHOOK_URL)
  if (!endpointFound) {
    return {
      ready: false,
      endpointFound: false,
      enabled: false,
      apiVersionCurrent: false,
      eventSetExact: false,
    }
  }

  const enabled = endpoint.status === "enabled"
  const apiVersionCurrent = endpoint.api_version === STRIPE_API_VERSION
  const enabledEvents = Array.isArray(endpoint.enabled_events) ? endpoint.enabled_events : []
  const enabledEventSet = new Set(enabledEvents)
  const eventSetExact = enabledEvents.length === STRIPE_PINNED_WEBHOOK_EVENTS.length
    && enabledEventSet.size === STRIPE_PINNED_WEBHOOK_EVENTS.length
    && STRIPE_PINNED_WEBHOOK_EVENTS.every((event) => enabledEventSet.has(event))

  return {
    ready: enabled && apiVersionCurrent && eventSetExact,
    endpointFound,
    enabled,
    apiVersionCurrent,
    eventSetExact,
  }
}
