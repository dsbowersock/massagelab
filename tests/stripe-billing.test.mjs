import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"
import {
  normalizeStripeSubscription,
  stripeTimestampToDate,
  verifyStripeWebhookSignature,
} from "../lib/stripe-billing.js"

describe("Stripe billing helpers", () => {
  it("verifies Stripe webhook signatures with the raw request body", () => {
    const payload = JSON.stringify({ id: "evt_123", type: "customer.subscription.updated" })
    const timestamp = "1778791200"
    const secret = "whsec_test"
    const signedPayload = `${timestamp}.${payload}`
    const signature = createHmac("sha256", secret).update(signedPayload).digest("hex")

    assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret, { nowSeconds: 1778791205 }), true)
    assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=bad`, secret, { nowSeconds: 1778791205 }), false)
    assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret, { nowSeconds: 1778793001 }), false)
  })

  it("normalizes Stripe subscriptions into MassageLab subscription records", () => {
    const normalized = normalizeStripeSubscription({
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      current_period_start: 1778791200,
      current_period_end: 1781383200,
      cancel_at_period_end: false,
      canceled_at: null,
      discount: { coupon: { id: "E6lYinBx" } },
      metadata: { userId: "user_123", membershipLevel: "THERAPIST" },
      items: {
        data: [
          {
            price: {
              id: "price_therapist",
              product: "prod_therapist",
            },
          },
        ],
      },
    })

    assert.deepEqual(normalized, {
      stripeSubscriptionId: "sub_123",
      stripeCustomerId: "cus_123",
      status: "active",
      membershipLevel: "THERAPIST",
      stripePriceId: "price_therapist",
      stripeProductId: "prod_therapist",
      currentPeriodStart: new Date("2026-05-14T20:40:00.000Z"),
      currentPeriodEnd: new Date("2026-06-13T20:40:00.000Z"),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      couponId: "E6lYinBx",
      metadata: { userId: "user_123", membershipLevel: "THERAPIST" },
    })
    assert.equal(stripeTimestampToDate(null), null)
  })
})
