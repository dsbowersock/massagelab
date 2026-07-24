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
})

function jsonRequest(body) {
  return new Request("https://massagelab.app/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function checkoutDependencies(calls) {
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
    hasAcceptedCurrentDocuments: async () => true,
    legalRequestMetadata: () => ({}),
    missingRequiredLegalDocuments: () => [],
    recordLegalAcceptances: async () => {},
    requiredLegalDocumentsForEvent: () => [],
    prisma: {
      user: {
        findUnique: async () => ({ id: "user_123", email: "supporter@example.com", name: "Supporter" }),
      },
    },
    ensureStripeCustomerForUser: async () => {
      calls.ensureCustomer += 1
      return { stripeCustomerId: "cus_123" }
    },
    createStripeCheckoutSession: async (options) => {
      calls.createCheckout += 1
      calls.checkoutOptions = options
      return { url: "https://checkout.stripe.com/c/test" }
    },
  }
}
