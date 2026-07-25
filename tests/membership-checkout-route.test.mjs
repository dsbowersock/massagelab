import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createMembershipCheckoutPostHandler } from "../lib/membership-checkout.js"
import { hasSubscriptionBlockingNewCheckout } from "../lib/membership.js"

const MEMBERSHIP_BILLING_DOCUMENT = Object.freeze({
  key: "membership-billing-refunds",
  version: "current",
})

describe("Membership Checkout POST route", () => {
  it("returns JSON 401 for an anonymous API request before billing work", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      session: null,
    }))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
    }))

    assert.deepEqual(response, {
      body: { error: "Unauthorized" },
      status: 401,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
  })

  it("redirects an anonymous form request to sign in before billing work", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      session: null,
    }))(formRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
    }))

    assert.deepEqual(response, {
      url: "https://massagelab.app/login",
      status: 303,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
  })

  it("rejects a cross-origin form before parsing, validation, legal acceptance, or billing work", async () => {
    const calls = {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
      selectionValidation: 0,
      legalAcceptanceLookup: 0,
    }
    let formDataCalls = 0
    const request = {
      url: "https://massagelab.app/api/billing/checkout",
      headers: new Headers({
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://attacker.example",
      }),
      formData: async () => {
        formDataCalls += 1
        return new FormData()
      },
    }
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      alreadyAccepted: false,
      captureSelectionInputs: true,
      captureGuardCalls: true,
    }))(request)

    assert.deepEqual(response, {
      url: "https://massagelab.app/account?billing=invalid-request",
      status: 303,
    })
    assert.equal(formDataCalls, 0)
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
      selectionValidation: 0,
      legalAcceptanceLookup: 0,
    })
  })

  for (const [label, secFetchSite] of [
    ["missing Fetch Metadata", null],
    ["same-site Fetch Metadata", "same-site"],
  ]) {
    it(`rejects a form with ${label} when Origin and Referer are absent`, async () => {
      let formDataCalls = 0
      const headers = new Headers({
        "content-type": "application/x-www-form-urlencoded",
      })
      if (secFetchSite) {
        headers.set("sec-fetch-site", secFetchSite)
      }
      const request = {
        url: "https://massagelab.app/api/billing/checkout",
        headers,
        formData: async () => {
          formDataCalls += 1
          return new FormData()
        },
      }

      const calls = checkoutCallCounts()
      const response = await createMembershipCheckoutPostHandler(
        checkoutDependencies(calls),
      )(request)

      assert.deepEqual(response, {
        url: "https://massagelab.app/account?billing=invalid-request",
        status: 303,
      })
      assert.equal(formDataCalls, 0)
      assert.deepEqual(calls, {
        ensureCustomer: 0,
        createCheckout: 0,
        membershipLookup: 0,
      })
    })
  }

  for (const fetchSite of ["cross-site", "same-site"]) {
    it(`rejects ${fetchSite} browser JSON before parsing or billing work`, async () => {
      let jsonCalls = 0
      const calls = checkoutCallCounts()
      const request = {
        url: "https://massagelab.app/api/billing/checkout",
        headers: new Headers({
          "content-type": "application/json",
          "sec-fetch-site": fetchSite,
        }),
        json: async () => {
          jsonCalls += 1
          return {
            membershipLevel: "SUPPORTER",
            supporterAmountChoiceId: "support-1",
          }
        },
      }

      const response = await createMembershipCheckoutPostHandler(
        checkoutDependencies(calls),
      )(request)

      assert.deepEqual(response, {
        body: { error: "Invalid request origin" },
        status: 403,
      })
      assert.equal(jsonCalls, 0)
      assert.deepEqual(calls, {
        ensureCustomer: 0,
        createCheckout: 0,
        membershipLookup: 0,
      })
    })
  }

  it("accepts same-origin browser JSON", async () => {
    const calls = checkoutCallCounts()
    const request = new Request("https://massagelab.app/api/billing/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: "support-1",
      }),
    })

    const response = await createMembershipCheckoutPostHandler(
      checkoutDependencies(calls, { session: null }),
    )(request)

    assert.deepEqual(response, {
      body: { error: "Unauthorized" },
      status: 401,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
  })

  it("accepts a same-origin form and records required legal acceptance", async () => {
    const calls = checkoutCallCounts()
    const dependencies = checkoutDependencies(calls, {
      alreadyAccepted: false,
    })
    const response = await createMembershipCheckoutPostHandler(dependencies)(formRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: "membership-billing-refunds:current",
      billingTermsAccepted: "true",
    }, {
      origin: "https://massagelab.app",
    }))

    assert.deepEqual(response, {
      url: "https://checkout.stripe.com/c/test",
      status: 303,
    })
    assert.equal(calls.membershipLookup, 1)
    assert.equal(calls.ensureCustomer, 1)
    assert.equal(calls.createCheckout, 1)
    assert.ok(calls.recordedLegalAcceptances)
    assert.deepEqual(calls.recordedLegalAcceptances, {
      prismaClient: dependencies.prisma,
      userId: "user_123",
      documents: [MEMBERSHIP_BILLING_DOCUMENT],
      metadata: { source: "membership-checkout-test" },
    })
  })

  it("accepts the configured public origin when a proxy supplies an internal request URL", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls))(
      formRequest({
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: "support-1",
        interval: "month",
      }, {
        origin: "https://massagelab.app",
      }, "http://internal-proxy:3000/api/billing/checkout"),
    )

    assert.deepEqual(response, {
      url: "https://checkout.stripe.com/c/test",
      status: 303,
    })
    assert.equal(calls.membershipLookup, 1)
    assert.equal(calls.ensureCustomer, 1)
    assert.equal(calls.createCheckout, 1)
  })

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

  it("rejects an invalid JSON Supporter amount choice before billing work", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-9",
      interval: "month",
    }))

    assert.deepEqual(response, {
      body: { error: "Unsupported membership level" },
      status: 400,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
  })

  it("redirects a stale form Supporter amount choice before billing work", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls))(formRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "supporter",
      interval: "month",
    }))

    assert.deepEqual(response, {
      url: "https://massagelab.app/account?billing=unsupported-plan",
      status: 303,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
  })

  it("rejects an unconfigured JSON Supporter price before billing work", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      priceId: null,
    }))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
    }))

    assert.deepEqual(response, {
      body: { error: "Stripe price is not configured" },
      status: 400,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
  })

  it("redirects an unconfigured form Supporter price before billing work", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      priceId: null,
    }))(formRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
    }))

    assert.deepEqual(response, {
      url: "https://massagelab.app/account?billing=price-not-configured",
      status: 303,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
  })

  it("does not send an early-access discount with public Supporter Checkout", async () => {
    const calls = { ensureCustomer: 0, createCheckout: 0, checkoutOptions: null }
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      captureSelectionInputs: true,
    }))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: ["membership-billing-refunds:current"],
      billingTermsAccepted: true,
    }))

    assert.deepEqual(response, { body: { url: "https://checkout.stripe.com/c/test" }, status: 200 })
    assert.equal(calls.ensureCustomer, 1)
    assert.equal(calls.createCheckout, 1)
    assert.deepEqual(calls.validatedSelectionInputs, [{
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
    }])
    assert.deepEqual(calls.priceResolutionInputs, [{
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
    }])
    assert.deepEqual(calls.checkoutOptions, {
      customerId: "cus_123",
      priceId: "price_supporter_1_month",
      userId: "user_123",
      membershipLevel: "SUPPORTER",
      successUrl: "https://massagelab.app/account?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://massagelab.app/account?checkout=cancelled",
    })
    assert.equal(Object.hasOwn(calls.checkoutOptions, "couponId"), false)
    assert.equal(Object.hasOwn(calls.checkoutOptions, "discounts"), false)
  })

  for (const existingSubscription of [
    { status: "active", membershipLevel: "SUPPORTER" },
    { status: "trialing", membershipLevel: "SUPPORTER" },
    { status: "past_due", membershipLevel: "SUPPORTER" },
    { status: "unpaid", membershipLevel: "SUPPORTER" },
    { status: "paused", membershipLevel: "SUPPORTER" },
    { status: "incomplete", membershipLevel: "SUPPORTER" },
  ]) {
    it(`rejects an existing ${existingSubscription.status} subscription before Customer or Checkout Session creation`, async () => {
      const calls = checkoutCallCounts()
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

  it("allows Checkout after a canceled subscription even when its stale cancel-at-period-end flag remains set", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      subscriptions: [{
        status: "canceled",
        cancelAtPeriodEnd: true,
        membershipLevel: "SUPPORTER",
      }],
    }))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: ["membership-billing-refunds:current"],
      billingTermsAccepted: true,
    }))

    assert.deepEqual(response, {
      body: { url: "https://checkout.stripe.com/c/test" },
      status: 200,
    })
    assert.equal(calls.membershipLookup, 1)
    assert.equal(calls.ensureCustomer, 1)
    assert.equal(calls.createCheckout, 1)
  })

  it("routes a historical subscriber form submission to existing billing management", async () => {
    const calls = checkoutCallCounts()
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

  it("routes malformed multipart input through the form-safe unsupported-plan response", async () => {
    const calls = checkoutCallCounts()
    const request = {
      url: "https://massagelab.app/api/billing/checkout",
      headers: new Headers({
        "content-type": "multipart/form-data; boundary=broken",
        "sec-fetch-site": "same-origin",
      }),
      formData: async () => {
        throw new TypeError("Malformed multipart body")
      },
    }
    const response = await createMembershipCheckoutPostHandler(
      checkoutDependencies(calls),
    )(request)

    assert.deepEqual(response, {
      url: "https://massagelab.app/account?billing=unsupported-plan",
      status: 303,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
  })

  it("routes unexpected form field normalization failures through the form-safe Checkout error response", async (context) => {
    const calls = checkoutCallCounts()
    const request = {
      headers: new Headers({
        "content-type": "application/x-www-form-urlencoded",
        "sec-fetch-site": "same-origin",
      }),
      formData: async () => ({
        get: () => {
          throw new TypeError("Unable to read form field")
        },
        getAll: () => [],
      }),
    }
    const logged = captureConsoleErrors(context)

    const response = await createMembershipCheckoutPostHandler(
      checkoutDependencies(calls),
    )(request)

    assert.deepEqual(response, {
      url: "https://massagelab.app/account?billing=checkout-error",
      status: 303,
    })
    assert.deepEqual(calls, {
      ensureCustomer: 0,
      createCheckout: 0,
      membershipLookup: 0,
    })
    assert.deepEqual(logged, [[
      "Unable to start membership checkout",
      { code: "unexpected_error" },
    ]])
  })

  for (const [label, body] of [
    ["literal null", "null"],
    ["an array", "[]"],
    ["malformed JSON", "{"],
  ]) {
    it(`rejects ${label} JSON through the controlled unsupported-plan response`, async () => {
      const calls = checkoutCallCounts()
      const response = await createMembershipCheckoutPostHandler(
        checkoutDependencies(calls),
      )(rawJsonRequest(body))

      assert.deepEqual(response, {
        body: { error: "Unsupported membership level" },
        status: 400,
      })
      assert.deepEqual(calls, {
        ensureCustomer: 0,
        createCheckout: 0,
        membershipLookup: 0,
      })
    })
  }

  it("returns JSON 400 when the current membership legal document is missing", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      alreadyAccepted: false,
      missingLegalDocuments: [{ key: "membership-billing-refunds" }],
    }))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
    }))

    assert.deepEqual(response, {
      body: {
        error: "Accept the membership billing and refund terms before checkout.",
      },
      status: 400,
    })
    assert.equal(calls.membershipLookup, 1)
    assert.equal(calls.ensureCustomer, 0)
    assert.equal(calls.createCheckout, 0)
    assert.deepEqual(calls.requiredLegalEvents, ["checkout"])
    assert.deepEqual(calls.acceptedLegalDocumentInputs, [[]])
    assert.deepEqual(calls.missingLegalInputs, [{
      acceptedDocumentIds: [],
      documents: [MEMBERSHIP_BILLING_DOCUMENT],
    }])
    assert.equal(Object.hasOwn(calls, "recordedLegalAcceptances"), false)
  })

  it("records the exact current membership billing document before creating Checkout", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      alreadyAccepted: false,
    }))(jsonRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: ["membership-billing-refunds:current"],
      billingTermsAccepted: true,
    }))

    assert.deepEqual(response, {
      body: { url: "https://checkout.stripe.com/c/test" },
      status: 200,
    })
    assert.deepEqual(calls.requiredLegalEvents, ["checkout"])
    assert.deepEqual(calls.acceptedLegalDocumentInputs, [[
      "membership-billing-refunds:current",
    ]])
    assert.deepEqual(calls.missingLegalInputs, [{
      acceptedDocumentIds: ["membership-billing-refunds:current"],
      documents: [MEMBERSHIP_BILLING_DOCUMENT],
    }])
    assert.equal(
      typeof calls.recordedLegalAcceptances.prismaClient
        .membershipSubscription.findMany,
      "function",
    )
    assert.deepEqual({
      ...calls.recordedLegalAcceptances,
      prismaClient: undefined,
    }, {
      prismaClient: undefined,
      userId: "user_123",
      documents: [MEMBERSHIP_BILLING_DOCUMENT],
      metadata: { source: "membership-checkout-test" },
    })
    assert.equal(calls.ensureCustomer, 1)
    assert.equal(calls.createCheckout, 1)
  })

  it("redirects a form submission when the current membership legal document is missing", async () => {
    const calls = checkoutCallCounts()
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      alreadyAccepted: false,
      missingLegalDocuments: [{ key: "membership-billing-refunds" }],
    }))(formRequest({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
    }))

    assert.deepEqual(response, {
      url: "https://massagelab.app/account?billing=billing-terms-required",
      status: 303,
    })
    assert.equal(calls.membershipLookup, 1)
    assert.equal(calls.ensureCustomer, 0)
    assert.equal(calls.createCheckout, 0)
    assert.deepEqual(calls.requiredLegalEvents, ["checkout"])
    assert.deepEqual(calls.acceptedLegalDocumentInputs, [[]])
    assert.deepEqual(calls.missingLegalInputs, [{
      acceptedDocumentIds: [],
      documents: [MEMBERSHIP_BILLING_DOCUMENT],
    }])
    assert.equal(Object.hasOwn(calls, "recordedLegalAcceptances"), false)
  })

  it("returns the existing-subscription contract when Stripe finds a completed relevant Checkout before the webhook", async () => {
    const calls = checkoutCallCounts()
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

  it("returns a sanitized error when Stripe succeeds with a non-complete Session that has no URL", async (context) => {
    const calls = checkoutCallCounts()
    const logged = captureConsoleErrors(context)
    const response = await createMembershipCheckoutPostHandler(checkoutDependencies(calls, {
      checkoutSession: {
        id: "cs_open_without_url",
        status: "open",
        subscription: null,
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
      body: { error: "Unable to start checkout." },
      status: 500,
    })
    assert.deepEqual(logged, [[
      "Unable to start membership checkout",
      { code: "unexpected_error" },
    ]])
    assert.equal(calls.membershipLookup, 1)
    assert.equal(calls.ensureCustomer, 1)
    assert.equal(calls.createCheckout, 1)
  })

  it("logs only the sanitized code when membership Checkout setup fails", async (context) => {
    const calls = checkoutCallCounts()
    const failure = new Error("customer lookup failed")
    failure.code = "customer_lookup_failed"
    const logged = captureConsoleErrors(context)

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
      { code: "unexpected_error" },
    ]])
  })

  for (const [label, errorOption] of [
    ["session lookup", "sessionError"],
    ["public selection validation", "selectionError"],
    ["Stripe price resolution", "priceResolutionError"],
  ]) {
    it(`routes a rejected ${label} through the form-safe Checkout error response`, async (context) => {
      const calls = checkoutCallCounts()
      const failure = new Error(`${label} failed`)
      failure.code = `${errorOption}_failed`
      const logged = captureConsoleErrors(context)

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
      assert.deepEqual(calls, {
        ensureCustomer: 0,
        createCheckout: 0,
        membershipLookup: 0,
      })
      assert.deepEqual(logged, [[
        "Unable to start membership checkout",
        { code: "unexpected_error" },
      ]])
    })
  }

  for (const [label, errorOption] of [
    ["membership subscription lookup", "membershipLookupError"],
    ["legal acceptance lookup", "acceptedDocumentsError"],
    ["user lookup", "userLookupError"],
  ]) {
    it(`routes a rejected ${label} through the form-safe Checkout error response`, async (context) => {
      const calls = checkoutCallCounts()
      const failure = new Error(`${label} failed`)
      failure.code = `${errorOption}_failed`
      const logged = captureConsoleErrors(context)

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
        { code: "unexpected_error" },
      ]])
    })
  }
})

/** Creates the baseline effect counters shared by Checkout route tests. */
function checkoutCallCounts(overrides = {}) {
  return {
    ensureCustomer: 0,
    createCheckout: 0,
    membershipLookup: 0,
    ...overrides,
  }
}

/** Uses node:test lifecycle-managed mocks so console restoration is automatic. */
function captureConsoleErrors(context) {
  const logged = []
  context.mock.method(console, "error", (...args) => logged.push(args))
  return logged
}

function jsonRequest(body) {
  return new Request("https://massagelab.app/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function rawJsonRequest(body) {
  return new Request("https://massagelab.app/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

function formRequest(
  body,
  headers = {},
  url = "https://massagelab.app/api/billing/checkout",
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: new URLSearchParams(body),
  })
}

/**
 * Builds production-shaped Checkout dependencies while recording database,
 * Customer, legal-acceptance, and Session effects on the supplied call log.
 * Optional errors let each test fail one boundary without invoking real I/O.
 */
function checkoutDependencies(calls, {
  subscriptions = [],
  checkoutSession = { url: "https://checkout.stripe.com/c/test" },
  ensureCustomerError = null,
  membershipLookupError = null,
  acceptedDocumentsError = null,
  userLookupError = null,
  sessionError = null,
  selectionError = null,
  priceResolutionError = null,
  priceId = "price_supporter_1_month",
  session = { user: { id: "user_123" } },
  alreadyAccepted = true,
  missingLegalDocuments = [],
  captureSelectionInputs = false,
  captureGuardCalls = false,
} = {}) {
  const prisma = {
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
  }

  return {
    NextResponse: {
      json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
      redirect: (url, status) => ({ url, status }),
    },
    getCurrentSession: async () => {
      if (sessionError) throw sessionError
      return session
    },
    getSiteUrl: () => "https://massagelab.app",
    isPublicSupporterCheckoutSelection: (input) => {
      if (captureGuardCalls) calls.selectionValidation = (calls.selectionValidation ?? 0) + 1
      if (selectionError) throw selectionError
      if (captureSelectionInputs) {
        calls.validatedSelectionInputs = [
          ...(calls.validatedSelectionInputs ?? []),
          {
            membershipLevel: input.membershipLevel,
            supporterAmountChoiceId: input.supporterAmountChoiceId,
            interval: input.interval,
          },
        ]
      }
      return input.membershipLevel === "SUPPORTER" && input.supporterAmountChoiceId === "support-1"
    },
    resolveStripePriceId: (input) => {
      if (priceResolutionError) throw priceResolutionError
      if (captureSelectionInputs) {
        calls.priceResolutionInputs = [
          ...(calls.priceResolutionInputs ?? []),
          input,
        ]
      }
      return priceId
    },
    acceptedDocumentIdsFromInput: (ids) => {
      calls.acceptedLegalDocumentInputs = [
        ...(calls.acceptedLegalDocumentInputs ?? []),
        ids,
      ]
      return ids
    },
    hasAcceptedCurrentDocuments: async () => {
      if (captureGuardCalls) calls.legalAcceptanceLookup = (calls.legalAcceptanceLookup ?? 0) + 1
      if (acceptedDocumentsError) throw acceptedDocumentsError
      return alreadyAccepted
    },
    legalRequestMetadata: () => ({ source: "membership-checkout-test" }),
    missingRequiredLegalDocuments: (input) => {
      calls.missingLegalInputs = [
        ...(calls.missingLegalInputs ?? []),
        input,
      ]
      return missingLegalDocuments
    },
    recordLegalAcceptances: async (input) => {
      calls.recordedLegalAcceptances = input
    },
    requiredLegalDocumentsForEvent: (event) => {
      calls.requiredLegalEvents = [...(calls.requiredLegalEvents ?? []), event]
      return [MEMBERSHIP_BILLING_DOCUMENT]
    },
    hasSubscriptionBlockingNewCheckout,
    prisma,
    ensureStripeCustomerForUser: async () => {
      calls.ensureCustomer = (calls.ensureCustomer ?? 0) + 1
      if (ensureCustomerError) throw ensureCustomerError
      return { stripeCustomerId: "cus_123" }
    },
    createStripeCheckoutSession: async (options) => {
      calls.createCheckout = (calls.createCheckout ?? 0) + 1
      calls.checkoutOptions = options
      return checkoutSession
    },
  }
}
