import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createMembershipCheckoutPostHandler } from "../lib/membership-checkout.js"

describe("Membership Checkout POST route", () => {
  for (const membershipLevel of ["THERAPIST", "PRACTICE"]) {
    it(`rejects ${membershipLevel} before creating a Stripe customer or Checkout Session`, async () => {
      const calls = { ensureCustomer: 0, createCheckout: 0 }
      const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls))(jsonRequest({
        membershipLevel,
        supporterAmountChoiceId: "support-1",
      }))

      assert.deepEqual(response, {
        body: { error: "Unsupported membership level" },
        status: 400,
      })
      assert.deepEqual(calls, { ensureCustomer: 0, createCheckout: 0 })
    })
  }

  it("does not send an early-access discount with public Supporter Checkout", async () => {
    const calls = { ensureCustomer: 0, createCheckout: 0, checkoutOptions: null }
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: ["membership-billing-refunds:current"],
      billingTermsAccepted: true,
    }))

    assert.deepEqual(response, { body: { url: "https://checkout.stripe.com/c/test" }, status: 200 })
    assert.equal(calls.ensureCustomer, 1)
    assert.equal(calls.createCheckout, 1)
    assert.equal(Object.hasOwn(calls.checkoutOptions, "couponId"), false)
  })

  for (const existingSubscription of [
    { status: "active", membershipLevel: "SUPPORTER" },
    { status: "trialing", membershipLevel: "SUPPORTER" },
    { status: "past_due", membershipLevel: "SUPPORTER" },
    { status: "unpaid", membershipLevel: "SUPPORTER" },
    { status: "paused", membershipLevel: "SUPPORTER" },
    { status: "incomplete", membershipLevel: "SUPPORTER" },
    {
      status: "canceled",
      cancelAtPeriodEnd: true,
      membershipLevel: "SUPPORTER",
    },
  ]) {
    const label = existingSubscription.cancelAtPeriodEnd
      ? "canceling"
      : existingSubscription.status

    it(`rejects an existing ${label} subscription before Customer or Checkout Session creation`, async () => {
      const calls = {
        ensureCustomer: 0,
        createCheckout: 0,
        membershipLookup: 0,
      }
      const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
        subscriptions: [existingSubscription],
      }))(jsonRequest({
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: "support-1",
        interval: "month",
        acceptedLegalDocuments: ["membership-billing-refunds:current"],
        billingTermsAccepted: true,
      }))

      assert.deepEqual(response, {
        body: {
          error: "Manage your existing subscription in the Customer Portal.",
        },
        status: 409,
      })
      assert.equal(calls.membershipLookup, 1)
      assert.equal(calls.ensureCustomer, 0)
      assert.equal(calls.createCheckout, 0)
    })
  }

  it("routes a historical subscriber form submission to existing billing management", async () => {
    const calls = {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    }
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      subscriptions: [{ status: "active", membershipLevel: "THERAPIST" }],
    }))(formRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: "membership-billing-refunds:current",
      billingTermsAccepted: "true",
    }))

    assert.deepEqual(response, {
      url: "https://massagelab.app/account?billing=existing-subscription",
      status: 303,
    })
    assert.equal(calls.membershipLookup, 1)
    assert.equal(calls.ensureCustomer, 0)
    assert.equal(calls.createCheckout, 0)
  })

  it("returns the existing-subscription contract when Stripe finds a completed relevant Checkout before the webhook", async () => {
    const calls = {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    }
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      checkoutSession: {
        id: "cs_completed",
        status: "complete",
        subscription: "sub_completed",
        url: null,
      },
    }))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: ["membership-billing-refunds:current"],
      billingTermsAccepted: true,
    }))

    assert.deepEqual(response, {
      body: {
        error: "Manage your existing subscription in the Customer Portal.",
      },
      status: 409,
    })
    assert.equal(calls.membershipLookup, 1)
    assert.equal(calls.ensureCustomer, 1)
    assert.equal(calls.createCheckout, 1)
  })

  it("logs the root cause when membership Checkout setup fails", async () => {
    const calls = { ensureCustomer: 0, createCheckout: 0, membershipLookup: 0 }
    const failure = new Error("customer lookup failed")
    failure.code = "customer_lookup_failed"
    const logged = []
    const originalConsoleError = console.error
    console.error = (...args) => logged.push(args)

    try {
      const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
        ensureCustomerError: failure,
      }))(jsonRequest({
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: "support-1",
        interval: "month",
        acceptedLegalDocuments: ["membership-billing-refunds:current"],
        billingTermsAccepted: true,
      }))

      assert.deepEqual(response, {
        body: { error: "Unable to start checkout." },
        status: 500,
      })
      assert.deepEqual(logged, [[
        "Unable to start membership checkout",
        { code: "customer_lookup_failed" },
      ]])
    } finally {
      console.error = originalConsoleError
    }
  })

  for (const [label, errorOption] of [
    ["membership subscription lookup", "membershipLookupError"],
    ["legal acceptance lookup", "acceptedDocumentsError"],
    ["user lookup", "userLookupError"],
  ]) {
    it(`routes a rejected ${label} through the form-safe Checkout error response`, async () => {
      const calls = { ensureCustomer: 0, createCheckout: 0, membershipLookup: 0 }
      const failure = new Error(`${label} failed`)
      failure.code = `${errorOption}_failed`
      const logged = []
      const originalConsoleError = console.error
      console.error = (...args) => logged.push(args)

      try {
        const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
          [errorOption]: failure,
        }))(formRequest({
          membershipLevel: "SUPPORTER",
          supporterAmountChoiceId: "support-1",
          interval: "month",
          acceptedLegalDocuments: "membership-billing-refunds:current",
          billingTermsAccepted: "true",
        }))

        assert.deepEqual(response, {
          url: "https://massagelab.app/account?billing=checkout-error",
          status: 303,
        })
        assert.equal(calls.ensureCustomer, 0)
        assert.equal(calls.createCheckout, 0)
        assert.deepEqual(logged, [[
          "Unable to start membership checkout",
          { code: `${errorOption}_failed` },
        ]])
      } finally {
        console.error = originalConsoleError
      }
    })
  }
})

function jsonRequest(body) {
  return new Request("https://massagelab.app/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function formRequest(body) {
  return new Request("https://massagelab.app/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  })
}

function checkoutDependencies(calls, {
  subscriptions = [],
  checkoutSession = { url: "https://checkout.stripe.com/c/test" },
  ensureCustomerError = null,
  membershipLookupError = null,
  acceptedDocumentsError = null,
  userLookupError = null,
} = {}) {
  return {
    NextResponse: {
      json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
      redirect: (url, status) => ({ url, status }),
    },
    getCurrentSession: async () => ({ user: { id: "user_123" } }),
    getSiteUrl: () => "https://massagelab.app",
    isPublicSupporterCheckoutSelection: (input) => input.membershipLevel === "SUPPORTER" && input.supporterAmountChoiceId === "support-1",
    resolveStripePriceId: () => "price_supporter_1_month",
    acceptedDocumentIdsFromInput: (ids) => ids,
    hasAcceptedCurrentDocuments: async () => {
      if (acceptedDocumentsError) throw acceptedDocumentsError
      return true
    },
    legalRequestMetadata: () => ({}),
    missingRequiredLegalDocuments: () => [],
    recordLegalAcceptances: async () => {},
    requiredLegalDocumentsForEvent: () => [],
    hasSubscriptionBlockingNewCheckout: (candidates) => candidates.some(
      (subscription) => (
        ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(subscription.status)
        || subscription.cancelAtPeriodEnd === true
      ),
    ),
    prisma: {
      user: {
        findUnique: async () => {
          if (userLookupError) throw userLookupError
          return { id: "user_123", email: "supporter@example.com", name: "Supporter" }
        },
      },
      membershipSubscription: {
        findMany: async () => {
          calls.membershipLookup = (calls.membershipLookup ?? 0) + 1
          if (membershipLookupError) throw membershipLookupError
          return subscriptions
        },
      },
    },
    ensureStripeCustomerForUser: async () => {
      calls.ensureCustomer += 1
      if (ensureCustomerError) throw ensureCustomerError
      return { stripeCustomerId: "cus_123" }
    },
    createStripeCheckoutSession: async (options) => {
      calls.createCheckout += 1
      calls.checkoutOptions = options
      return checkoutSession
    },
  }
}
