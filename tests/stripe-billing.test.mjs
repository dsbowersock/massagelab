import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"
import {
  normalizeStripeSubscription,
  stripeTimestampToDate,
  upsertMembershipSubscriptionFromStripe,
  verifyStripeWebhookSignature,
} from "../lib/stripe-billing.js"
import * as stripeBilling from "../lib/stripe-billing.js"

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
    const env = {
      STRIPE_THERAPIST_MONTHLY_PRICE_ID: "price_therapist",
    }
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
    }, { env })

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

  it("uses subscription item billing periods when Stripe omits top-level periods", () => {
    const env = {
      STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_yearly",
    }
    const normalized = normalizeStripeSubscription({
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      metadata: { userId: "user_123", membershipLevel: "THERAPIST" },
      items: {
        data: [
          {
            current_period_start: 1778947065,
            current_period_end: 1810483065,
            price: {
              id: "price_therapist_yearly",
              product: "prod_therapist",
            },
          },
        ],
      },
    }, { env })

    assert.equal(normalized.currentPeriodStart.getTime(), 1778947065 * 1000)
    assert.equal(normalized.currentPeriodEnd.getTime(), 1810483065 * 1000)
  })

  it("rejects unmapped and Student Stripe prices instead of granting a paid membership", () => {
    const baseSubscription = {
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      current_period_start: 1778791200,
      current_period_end: 1781383200,
      metadata: { userId: "user_123", membershipLevel: "THERAPIST" },
    }
    const env = {
      STRIPE_THERAPIST_MONTHLY_PRICE_ID: "price_therapist",
      STRIPE_STUDENT_MONTHLY_PRICE_ID: "price_student",
    }

    assert.equal(
      normalizeStripeSubscription({
        ...baseSubscription,
        items: { data: [{ price: { id: "price_unknown", product: "prod_unknown" } }] },
      }, { env }),
      null,
    )
    assert.equal(
      normalizeStripeSubscription({
        ...baseSubscription,
        metadata: { userId: "user_123", membershipLevel: "STUDENT" },
        items: { data: [{ price: { id: "price_student", product: "prod_student" } }] },
      }, { env }),
      null,
    )
  })

  it("does not write a membership subscription for unmapped Stripe prices", async () => {
    const writes = []
    const prismaClient = {
      stripeCustomer: {
        upsert: async (args) => {
          writes.push(["customer", args])
          return args.create
        },
      },
      membershipSubscription: {
        upsert: async (args) => {
          writes.push(["subscription", args])
          return args.create
        },
      },
    }

    const result = await upsertMembershipSubscriptionFromStripe(prismaClient, {
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      metadata: { userId: "user_123", membershipLevel: "THERAPIST" },
      items: { data: [{ price: { id: "price_unknown", product: "prod_unknown" } }] },
    }, { env: { STRIPE_THERAPIST_MONTHLY_PRICE_ID: "price_therapist" } })

    assert.equal(result, null)
    assert.deepEqual(writes, [])
  })

  it("creates Stripe Customer Portal sessions with the stored customer and return URL", async () => {
    assert.equal(typeof stripeBilling.createStripeCustomerPortalSession, "function")
    let capturedPayload = null
    const session = await stripeBilling.createStripeCustomerPortalSession({
      customerId: "cus_123",
      returnUrl: "https://massagelab.app/account",
      stripeClient: {
        billingPortal: {
          sessions: {
            create: async (payload) => {
              capturedPayload = payload
              return { id: "bps_123", url: "https://billing.stripe.com/p/session/test" }
            },
          },
        },
      },
    })

    assert.deepEqual(capturedPayload, {
      customer: "cus_123",
      return_url: "https://massagelab.app/account",
    })
    assert.equal(session.url, "https://billing.stripe.com/p/session/test")
  })

  it("does not combine a configured checkout coupon with promotion code entry", async () => {
    let capturedPayload = null

    await stripeBilling.createStripeCheckoutSession({
      customerId: "cus_123",
      priceId: "price_supporter",
      userId: "user_123",
      membershipLevel: "SUPPORTER",
      successUrl: "https://massagelab.app/account?checkout=success",
      cancelUrl: "https://massagelab.app/account?checkout=cancelled",
      couponId: "E6lYinBx",
      stripeClient: {
        checkout: {
          sessions: {
            create: async (payload) => {
              capturedPayload = payload
              return { id: "cs_123", url: "https://checkout.stripe.com/c/test" }
            },
          },
        },
      },
    })

    assert.deepEqual(capturedPayload.discounts, [{ coupon: "E6lYinBx" }])
    assert.equal(Object.hasOwn(capturedPayload, "allow_promotion_codes"), false)
  })

  it("reconciles a Checkout Session subscription immediately after checkout completion", async () => {
    const writes = []
    const prismaClient = {
      stripeCustomer: {
        upsert: async (args) => {
          writes.push(["customer", args])
          return args.create
        },
      },
      membershipSubscription: {
        upsert: async (args) => {
          writes.push(["subscription", args])
          return args.create
        },
      },
    }

    const result = await stripeBilling.recordCheckoutSessionCompleted(prismaClient, {
      client_reference_id: "user_123",
      customer: "cus_123",
      subscription: "sub_123",
    }, {
      env: { STRIPE_THERAPIST_MONTHLY_PRICE_ID: "price_therapist" },
      retrieveSubscription: async (subscriptionId) => ({
        id: subscriptionId,
        customer: "cus_123",
        status: "active",
        current_period_start: 1778791200,
        current_period_end: 1781383200,
        metadata: { userId: "user_123", membershipLevel: "THERAPIST" },
        items: { data: [{ price: { id: "price_therapist", product: "prod_therapist" } }] },
      }),
    })

    assert.equal(result.customer.stripeCustomerId, "cus_123")
    assert.equal(result.subscription.membershipLevel, "THERAPIST")
    assert.equal(writes.some(([kind]) => kind === "subscription"), true)
  })
})
