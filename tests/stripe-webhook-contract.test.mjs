import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  STRIPE_API_VERSION,
  STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS,
  STRIPE_MEMBERSHIP_WEBHOOK_EVENTS,
  STRIPE_PINNED_WEBHOOK_EVENTS,
  STRIPE_PINNED_WEBHOOK_URL,
  validatePinnedStripeWebhookEndpoint,
} from "../lib/stripe-webhook-contract.js"

function endpoint(overrides = {}) {
  return {
    id: "we_test_contract",
    object: "webhook_endpoint",
    api_version: STRIPE_API_VERSION,
    application: null,
    created: 1,
    description: null,
    enabled_events: [...STRIPE_PINNED_WEBHOOK_EVENTS],
    livemode: false,
    metadata: {},
    status: "enabled",
    url: STRIPE_PINNED_WEBHOOK_URL,
    ...overrides,
  }
}

describe("pinned Stripe webhook endpoint contract", () => {
  it("combines the five membership events with the ten commerce events exactly", () => {
    assert.equal(STRIPE_MEMBERSHIP_WEBHOOK_EVENTS.length, 5)
    assert.equal(STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS.length, 10)
    assert.equal(STRIPE_PINNED_WEBHOOK_EVENTS.length, 15)
    assert.deepEqual(
      new Set(STRIPE_PINNED_WEBHOOK_EVENTS),
      new Set([...STRIPE_MEMBERSHIP_WEBHOOK_EVENTS, ...STRIPE_BACKGROUND_COMMERCE_WEBHOOK_EVENTS]),
    )
  })

  it("accepts only the enabled pinned endpoint with the app API version and exact event set", () => {
    assert.deepEqual(validatePinnedStripeWebhookEndpoint(endpoint()), {
      ready: true,
      endpointFound: true,
      enabled: true,
      apiVersionCurrent: true,
      eventSetExact: true,
    })
  })

  it("rejects wildcard, missing, extra, and duplicate event configurations", () => {
    const cases = [
      ["wildcard", ["*"]],
      ["missing membership", STRIPE_PINNED_WEBHOOK_EVENTS.filter((event) => event !== "customer.subscription.resumed")],
      ["missing commerce", STRIPE_PINNED_WEBHOOK_EVENTS.filter((event) => event !== "refund.failed")],
      ["extra", [...STRIPE_PINNED_WEBHOOK_EVENTS, "customer.created"]],
      ["duplicate", [...STRIPE_PINNED_WEBHOOK_EVENTS, "refund.failed"]],
    ]

    for (const [name, enabledEvents] of cases) {
      const result = validatePinnedStripeWebhookEndpoint(endpoint({ enabled_events: enabledEvents }))
      assert.equal(result.eventSetExact, false, name)
      assert.equal(result.ready, false, name)
    }
  })

  it("rejects disabled and API-version-mismatched pinned endpoints", () => {
    assert.deepEqual(validatePinnedStripeWebhookEndpoint(endpoint({ status: "disabled" })), {
      ready: false,
      endpointFound: true,
      enabled: false,
      apiVersionCurrent: true,
      eventSetExact: true,
    })
    assert.deepEqual(validatePinnedStripeWebhookEndpoint(endpoint({ api_version: "2026-06-24.dahlia" })), {
      ready: false,
      endpointFound: true,
      enabled: true,
      apiVersionCurrent: false,
      eventSetExact: true,
    })
  })

  it("rejects missing or wrong-URL endpoints without exposing endpoint contents", () => {
    assert.deepEqual(validatePinnedStripeWebhookEndpoint(undefined), {
      ready: false,
      endpointFound: false,
      enabled: false,
      apiVersionCurrent: false,
      eventSetExact: false,
    })
    assert.deepEqual(validatePinnedStripeWebhookEndpoint(endpoint({ url: "https://example.invalid/webhook" })), {
      ready: false,
      endpointFound: false,
      enabled: false,
      apiVersionCurrent: false,
      eventSetExact: false,
    })
  })
})
