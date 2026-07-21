import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertBackgroundCommercePurchasingReady,
  createBackgroundPurchaseCheckoutSession,
  getBackgroundPurchaseCheckoutSessionEvidence,
} from "../lib/stripe-billing.js"
import { buildDigitalPurchaseConsent } from "../lib/legal-acceptance.js"
import { requiredLegalDocumentsForEvent } from "../lib/legal-documents.js"
import {
  createBackgroundCheckoutPostHandler,
  markBackgroundCheckoutIndeterminate,
  persistBackgroundCheckoutSession,
  releaseBackgroundCheckoutOrder,
} from "../app/api/background-commerce/checkout/route.ts"
import { createBackgroundCheckoutCancelPostHandler } from "../app/api/background-commerce/checkout/cancel/route.ts"

const NOW = new Date("2026-07-21T18:00:00.000Z")

function readyEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    STRIPE_SECRET_KEY: "sk_test_checkout",
    STRIPE_WEBHOOK_SECRET: "whsec_checkout",
    BACKGROUND_COMMERCE_PURCHASING_ENABLED: "true",
    BACKGROUND_COMMERCE_PRICE_CENTS: "100",
    BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "US",
    BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION: "2026-07-digital-purchases-v1",
    BACKGROUND_COMMERCE_WEBHOOK_READY: "true",
    BACKGROUND_COMMERCE_RECONCILIATION_READY: "true",
    BACKGROUND_COMMERCE_TAX_MODE: "disabled",
    ...overrides,
  }
}

function consentInput(overrides = {}) {
  const documents = requiredLegalDocumentsForEvent("digital-purchase")
  return {
    acceptedLegalDocuments: documents.map((document) => `${document.key}:${document.version}`),
    combinedConsentAccepted: true,
    purchaseCountry: "US",
    returnPath: "/clock",
    ...overrides,
  }
}

function currentConsent() {
  const input = consentInput()
  return buildDigitalPurchaseConsent({
    acceptedDocumentIds: input.acceptedLegalDocuments,
    combinedConsentAccepted: input.combinedConsentAccepted,
    now: NOW,
  })
}

function order(overrides = {}) {
  return {
    orderId: "order_123",
    publicId: "public_123",
    status: "PREPARING",
    expiresAt: new Date(NOW.getTime() + 30 * 60 * 1000).toISOString(),
    subtotalAmount: 200,
    currency: "usd",
    items: [
      {
        productType: "background",
        productKey: "aurora",
        displayName: "Aurora",
        unitAmount: 100,
        quantity: 1,
        currency: "usd",
      },
      {
        productType: "background",
        productKey: "vortex",
        displayName: "Vortex",
        unitAmount: 100,
        quantity: 1,
        currency: "usd",
      },
    ],
    ...overrides,
  }
}

function request(body) {
  return new Request("https://massagelab.test/api/background-commerce/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function checkoutHarness(overrides = {}) {
  const calls = []
  const preparedOrder = order()
  const deps = {
    env: readyEnv(),
    now: () => NOW,
    siteUrl: "https://massagelab.test",
    catalogReady: true,
    getSessionUserId: async () => "user_123",
    loadUser: async () => ({
      id: "user_123",
      email: "subscriber@example.com",
      name: "Subscriber",
      emailVerified: NOW,
    }),
    prepareOrder: async (input) => {
      calls.push(["prepare", input])
      return preparedOrder
    },
    ensureCustomer: async (_user) => {
      calls.push(["customer"])
      return { stripeCustomerId: "cus_123" }
    },
    createCheckoutSession: async (input) => {
      calls.push(["stripe-create", input])
      return {
        id: "cs_123",
        url: "https://checkout.stripe.com/c/pay",
        expires_at: Math.floor(NOW.getTime() / 1000) + 1800,
        status: "open",
        payment_status: "unpaid",
      }
    },
    persistCheckoutSession: async (input) => {
      calls.push(["persist", input])
      return true
    },
    markCheckoutFailure: async (input) => {
      calls.push(["failure", input])
      return true
    },
    markCheckoutIndeterminate: async (input) => {
      calls.push(["indeterminate", input])
      return true
    },
    loadOrder: async () => ({
      id: "order_123",
      userId: "user_123",
      status: "AWAITING_PAYMENT",
      stripeCheckoutSessionId: "cs_123",
    }),
    retrieveCheckoutSession: async (sessionId) => {
      calls.push(["stripe-retrieve", sessionId])
      return {
        id: sessionId,
        url: "https://checkout.stripe.com/c/pay",
        status: "open",
        payment_status: "unpaid",
        customer_details: null,
      }
    },
    expireCheckoutSession: async (sessionId) => {
      calls.push(["stripe-expire", sessionId])
      return { id: sessionId, status: "expired", payment_status: "unpaid" }
    },
    releaseUnpaidOrder: async (input) => {
      calls.push(["release", input])
      return true
    },
    markReviewRequired: async (input) => {
      calls.push(["review", input])
      return true
    },
    ...overrides,
  }
  return { calls, deps, preparedOrder }
}

describe("background purchasing readiness", () => {
  it("fails closed unless purchasing, legal, webhook, reconciliation, catalog, country, and tax are ready", () => {
    const legalConsent = currentConsent()
    const base = {
      env: readyEnv(),
      purchaseCountry: "US",
      legalConsent,
      catalogReady: true,
    }

    assert.doesNotThrow(() => assertBackgroundCommercePurchasingReady(base))

    const failures = [
      { env: readyEnv({ BACKGROUND_COMMERCE_PURCHASING_ENABLED: "false" }) },
      { env: readyEnv({ BACKGROUND_COMMERCE_PRICE_CENTS: "200" }) },
      { env: readyEnv({ BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "US,CA" }) },
      { env: readyEnv({ BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION: "stale" }) },
      { env: readyEnv({ BACKGROUND_COMMERCE_WEBHOOK_READY: "false" }) },
      { env: readyEnv({ BACKGROUND_COMMERCE_RECONCILIATION_READY: "false" }) },
      { env: readyEnv({ STRIPE_WEBHOOK_SECRET: "" }) },
      { catalogReady: false },
      { purchaseCountry: "CA" },
      { legalConsent: null },
      {
        env: readyEnv({
          BACKGROUND_COMMERCE_TAX_MODE: "stripe",
          BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_10202003",
          BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "true",
          BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "false",
        }),
      },
    ]

    for (const failure of failures) {
      assert.throws(
        () => assertBackgroundCommercePurchasingReady({ ...base, ...failure }),
        /purchases are temporarily unavailable/i,
      )
    }
  })
})

describe("background Stripe Checkout adapter", () => {
  it("creates one fixed-price line per distinct background with stable metadata and a derived idempotency key", async () => {
    let capturedPayload
    let capturedOptions
    const session = await createBackgroundPurchaseCheckoutSession({
      orderId: "order_123",
      userId: "user_123",
      checkoutAttempt: 2,
      customerId: "cus_123",
      items: order().items,
      legalConsent: currentConsent(),
      purchaseCountry: "US",
      successUrl: "https://massagelab.test/account?backgroundPurchase=success&orderId=order_123",
      cancelUrl: "https://massagelab.test/account?backgroundPurchase=cancelled&orderId=order_123",
      now: NOW,
      env: readyEnv(),
      stripeClient: {
        checkout: {
          sessions: {
            create: async (payload, options) => {
              capturedPayload = payload
              capturedOptions = options
              return { id: "cs_123", url: "https://checkout.stripe.com/c/pay" }
            },
          },
        },
      },
    })

    assert.equal(session.url, "https://checkout.stripe.com/c/pay")
    assert.equal(capturedPayload.mode, "payment")
    assert.equal(capturedPayload.customer, "cus_123")
    assert.equal(capturedPayload.billing_address_collection, "required")
    assert.equal(capturedPayload.expires_at, Math.floor(NOW.getTime() / 1000) + 1800)
    assert.deepEqual(capturedPayload.automatic_tax, { enabled: false })
    assert.deepEqual(capturedPayload.metadata, {
      purpose: "background_purchase",
      orderId: "order_123",
      userId: "user_123",
      schemaVersion: "1",
    })
    assert.deepEqual(capturedPayload.payment_intent_data.metadata, capturedPayload.metadata)
    assert.equal(capturedPayload.line_items.length, 2)
    assert.deepEqual(capturedPayload.line_items.map((item) => ({
      name: item.price_data.product_data.name,
      amount: item.price_data.unit_amount,
      currency: item.price_data.currency,
      quantity: item.quantity,
    })), [
      { name: "Aurora", amount: 100, currency: "usd", quantity: 1 },
      { name: "Vortex", amount: 100, currency: "usd", quantity: 1 },
    ])
    assert.deepEqual(capturedOptions, {
      idempotencyKey: "background-purchase:order_123:attempt:2",
    })
    assert.equal(Object.hasOwn(capturedPayload, "client_reference_id"), false)
  })

  it("enables automatic tax and attaches the configured digital-product tax code only when fully ready", async () => {
    let capturedPayload
    const env = readyEnv({
      BACKGROUND_COMMERCE_TAX_MODE: "stripe",
      BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_10202003",
      BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "true",
      BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "true",
    })

    await createBackgroundPurchaseCheckoutSession({
      orderId: "order_tax",
      userId: "user_123",
      checkoutAttempt: 1,
      customerId: "cus_123",
      items: order({ items: order().items.slice(0, 1) }).items,
      legalConsent: currentConsent(),
      purchaseCountry: "US",
      successUrl: "https://massagelab.test/account",
      cancelUrl: "https://massagelab.test/account",
      now: NOW,
      env,
      stripeClient: {
        checkout: {
          sessions: {
            create: async (payload) => {
              capturedPayload = payload
              return { id: "cs_tax", url: "https://checkout.stripe.com/c/tax" }
            },
          },
        },
      },
    })

    assert.deepEqual(capturedPayload.automatic_tax, { enabled: true })
    assert.equal(capturedPayload.line_items[0].price_data.product_data.tax_code, "txcd_10202003")
    assert.equal(capturedPayload.line_items[0].price_data.tax_behavior, "exclusive")
  })

  it("retries a connection failure with the identical payload and idempotency key", async () => {
    const attempts = []
    const session = await createBackgroundPurchaseCheckoutSession({
      orderId: "order_connection_race",
      userId: "user_123",
      checkoutAttempt: 1,
      customerId: "cus_123",
      items: order({ items: order().items.slice(0, 1) }).items,
      legalConsent: currentConsent(),
      purchaseCountry: "US",
      successUrl: "https://massagelab.test/account?backgroundPurchase=success",
      cancelUrl: "https://massagelab.test/account?backgroundPurchase=cancelled",
      now: NOW,
      env: readyEnv(),
      stripeClient: {
        checkout: {
          sessions: {
            create: async (payload, options) => {
              attempts.push({ payload, options })
              if (attempts.length === 1) {
                throw Object.assign(new Error("connection lost after send"), {
                  type: "StripeConnectionError",
                })
              }
              return { id: "cs_connection_race", url: "https://checkout.stripe.com/c/recovered" }
            },
          },
        },
      },
    })

    assert.equal(session.id, "cs_connection_race")
    assert.equal(attempts.length, 2)
    assert.strictEqual(attempts[1].payload, attempts[0].payload)
    assert.strictEqual(attempts[1].options, attempts[0].options)
    assert.equal(attempts[0].options.idempotencyKey, "background-purchase:order_connection_race:attempt:1")
  })

  it("treats only retrieved US processor country evidence as fulfillment-safe", () => {
    assert.deepEqual(getBackgroundPurchaseCheckoutSessionEvidence({
      status: "complete",
      payment_status: "paid",
      customer_details: { address: { country: "us" } },
    }), {
      status: "complete",
      paymentStatus: "paid",
      purchaseCountry: "US",
      paid: true,
      reviewRequired: false,
    })
    for (const country of [null, "CA"]) {
      assert.equal(getBackgroundPurchaseCheckoutSessionEvidence({
        status: "complete",
        payment_status: "paid",
        customer_details: country ? { address: { country } } : null,
      }).reviewRequired, true)
    }
  })
})

describe("background checkout route", () => {
  it("requires a signed-in database-verified account and fresh explicit consent", async () => {
    const anonymous = checkoutHarness({ getSessionUserId: async () => null })
    let response = await createBackgroundCheckoutPostHandler(anonymous.deps)(request(consentInput()))
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: "AUTH_REQUIRED",
      message: "Sign in to continue.",
    })

    const unverified = checkoutHarness({
      loadUser: async () => ({
        id: "user_123",
        email: "user@example.com",
        name: "User",
        emailVerified: null,
      }),
    })
    response = await createBackgroundCheckoutPostHandler(unverified.deps)(request(consentInput()))
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, "EMAIL_VERIFICATION_REQUIRED")

    const staleConsent = checkoutHarness()
    response = await createBackgroundCheckoutPostHandler(staleConsent.deps)(request(consentInput({
      acceptedLegalDocuments: [],
    })))
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error, "LEGAL_CONSENT_REQUIRED")
    assert.equal(staleConsent.calls.some(([name]) => name === "prepare"), false)

    const nonUs = checkoutHarness()
    response = await createBackgroundCheckoutPostHandler(nonUs.deps)(request(consentInput({
      purchaseCountry: "CA",
    })))
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, "COUNTRY_UNAVAILABLE")
  })

  it("prepares, creates, and conditionally associates Checkout outside database transactions", async () => {
    const harness = checkoutHarness()
    const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      url: "https://checkout.stripe.com/c/pay",
      orderId: "order_123",
    })
    assert.deepEqual(harness.calls.map(([name]) => name), [
      "prepare",
      "customer",
      "stripe-create",
      "persist",
    ])
    const prepareInput = harness.calls[0][1]
    assert.equal(prepareInput.userId, "user_123")
    assert.deepEqual(prepareInput.legalAcceptance, currentConsent())
    const checkoutInput = harness.calls[2][1]
    assert.equal(checkoutInput.customerId, "cus_123")
    assert.equal(checkoutInput.checkoutAttempt, 1)
    assert.match(checkoutInput.successUrl, /^https:\/\/massagelab\.test\/account\?/)
    assert.match(checkoutInput.cancelUrl, /^https:\/\/massagelab\.test\/account\?/)
    assert.equal(checkoutInput.successUrl.includes("checkout.stripe.com"), false)
  })

  it("allows a subscriber to purchase permanent ownership without plan-name branching", async () => {
    const harness = checkoutHarness({
      loadUser: async () => ({
        id: "user_123",
        email: "subscriber@example.com",
        name: "Subscriber",
        emailVerified: NOW,
        membershipLevel: "SUPPORTER",
      }),
    })
    const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))

    assert.equal(response.status, 200)
    assert.equal(harness.calls.some(([name]) => name === "stripe-create"), true)
  })

  it("returns a PREPARING order to a retryable state after Stripe creation fails", async () => {
    const harness = checkoutHarness({
      createCheckoutSession: async () => {
        throw new Error("processor secret that must not leak")
      },
    })
    const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))
    const body = await response.json()

    assert.equal(response.status, 500)
    assert.deepEqual(body, {
      error: "UNKNOWN",
      message: "Unexpected commerce processing error.",
    })
    assert.equal(JSON.stringify(body).includes("processor secret"), false)
    assert.equal(harness.calls.some(([name]) => name === "failure"), true)
  })

  it("keeps indeterminate connection and 5xx creation outcomes reserved for reconciliation", async () => {
    for (const processorError of [
      Object.assign(new Error("connection outcome unknown"), {
        type: "StripeConnectionError",
      }),
      Object.assign(new Error("server outcome unknown"), {
        type: "StripeAPIError",
        statusCode: 500,
      }),
    ]) {
      const checkoutInputs = []
      const harness = checkoutHarness({
        createCheckoutSession: async (input) => {
          checkoutInputs.push(input)
          throw processorError
        },
      })
      const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))

      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), {
        error: "PAYMENT_PENDING",
        message: "Your payment is still processing.",
      })
      assert.equal(checkoutInputs.length, 1)
      assert.equal(checkoutInputs[0].orderId, "order_123")
      assert.equal(checkoutInputs[0].checkoutAttempt, 1)
      assert.equal(harness.calls.some(([name]) => name === "indeterminate"), true)
      assert.equal(harness.calls.some(([name]) => name === "failure"), false)
      assert.equal(harness.calls.some(([name]) => name === "release"), false)
    }
  })

  it("replays the same order with an identical Stripe payload after wall-clock time advances", async () => {
    const firstRequestAt = new Date(NOW.getTime() + 10 * 1000)
    let currentNow = firstRequestAt
    let localOrder = {
      id: "order_123",
      userId: "user_123",
      status: "PREPARING",
      stripeCheckoutSessionId: null,
    }
    const stripeAttempts = []
    const stripeClient = {
      checkout: {
        sessions: {
          create: async (payload, options) => {
            stripeAttempts.push({ payload, options })
            if (stripeAttempts.length <= 2) {
              throw Object.assign(new Error("connection outcome unknown"), {
                type: "StripeConnectionError",
              })
            }
            return {
              id: "cs_replayed",
              url: "https://checkout.stripe.com/c/replayed",
              expires_at: payload.expires_at,
              status: "open",
              payment_status: "unpaid",
            }
          },
        },
      },
    }
    const harness = checkoutHarness({
      now: () => currentNow,
      prepareOrder: async (input) => {
        harness.calls.push(["prepare", input])
        return harness.preparedOrder
      },
      createCheckoutSession: async (input) => createBackgroundPurchaseCheckoutSession({
        ...input,
        stripeClient,
      }),
      markCheckoutIndeterminate: async (input) => {
        harness.calls.push(["indeterminate", input])
        localOrder = { ...localOrder, status: "AWAITING_PAYMENT" }
        return true
      },
      persistCheckoutSession: async (input) => {
        harness.calls.push(["persist", input])
        assert.equal(localOrder.id, input.orderId)
        assert.equal(localOrder.status, "AWAITING_PAYMENT")
        assert.equal(localOrder.stripeCheckoutSessionId, null)
        localOrder = {
          ...localOrder,
          stripeCheckoutSessionId: input.sessionId,
        }
        return true
      },
      loadOrder: async () => localOrder,
    })
    const handler = createBackgroundCheckoutPostHandler(harness.deps)

    const firstResponse = await handler(request(consentInput()))
    assert.equal(firstResponse.status, 409)
    assert.equal((await firstResponse.json()).error, "PAYMENT_PENDING")
    assert.equal(localOrder.status, "AWAITING_PAYMENT")
    assert.equal(localOrder.stripeCheckoutSessionId, null)

    currentNow = new Date(NOW.getTime() + 5 * 60 * 1000)
    const secondResponse = await handler(request(consentInput()))
    assert.equal(secondResponse.status, 200)
    assert.deepEqual(await secondResponse.json(), {
      url: "https://checkout.stripe.com/c/replayed",
      orderId: "order_123",
    })

    assert.equal(stripeAttempts.length, 3)
    assert.ok(
      stripeAttempts[0].payload.expires_at
        >= Math.floor(firstRequestAt.getTime() / 1000) + 30 * 60,
    )
    assert.equal(JSON.stringify(stripeAttempts[2].payload), JSON.stringify(stripeAttempts[0].payload))
    assert.deepEqual(stripeAttempts[2].payload, stripeAttempts[0].payload)
    assert.deepEqual(stripeAttempts[2].options, stripeAttempts[0].options)
    assert.equal(stripeAttempts[2].options.idempotencyKey, "background-purchase:order_123:attempt:1")
    assert.equal(localOrder.stripeCheckoutSessionId, "cs_replayed")
    assert.equal(harness.calls.filter(([name]) => name === "prepare").length, 2)
  })

  it("releases only definite Stripe request rejections without leaking processor details", async () => {
    const harness = checkoutHarness({
      createCheckoutSession: async () => {
        throw Object.assign(new Error("invalid processor detail"), {
          type: "StripeInvalidRequestError",
          statusCode: 400,
        })
      },
    })
    const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))
    const body = await response.json()

    assert.equal(response.status, 500)
    assert.equal(body.error, "UNKNOWN")
    assert.equal(JSON.stringify(body).includes("invalid processor detail"), false)
    assert.equal(harness.calls.some(([name]) => name === "failure"), true)
    assert.equal(harness.calls.some(([name]) => name === "indeterminate"), false)
  })

  it("retrieves and expires an ID-bearing malformed Session before releasing its reservation", async () => {
    let retrievalCount = 0
    const harness = checkoutHarness({
      createCheckoutSession: async () => ({ id: "cs_malformed" }),
      loadOrder: async () => ({
        id: "order_123",
        userId: "user_123",
        status: "PREPARING",
        stripeCheckoutSessionId: null,
      }),
      retrieveCheckoutSession: async (sessionId) => {
        retrievalCount += 1
        harness.calls.push(["stripe-retrieve", sessionId])
        return retrievalCount === 1
          ? { id: sessionId, status: "open", payment_status: "unpaid" }
          : { id: sessionId, status: "expired", payment_status: "unpaid" }
      },
    })
    const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))

    assert.equal(response.status, 409)
    assert.deepEqual(harness.calls.filter(([name]) => name.startsWith("stripe")).map(([name, value]) => [name, value]), [
      ["stripe-retrieve", "cs_malformed"],
      ["stripe-expire", "cs_malformed"],
      ["stripe-retrieve", "cs_malformed"],
    ])
    assert.equal(harness.calls.some(([name]) => name === "release"), true)
    assert.equal(harness.calls.some(([name]) => name === "failure"), false)
  })

  it("keeps malformed paid and async-pending Sessions reserved and monotonic", async () => {
    for (const processorSession of [
      {
        id: "cs_malformed",
        status: "complete",
        payment_status: "paid",
        customer_details: { address: { country: "US" } },
      },
      {
        id: "cs_malformed",
        status: "complete",
        payment_status: "unpaid",
        customer_details: { address: { country: "US" } },
      },
    ]) {
      const harness = checkoutHarness({
        createCheckoutSession: async () => ({ id: "cs_malformed" }),
        loadOrder: async () => ({
          id: "order_123",
          userId: "user_123",
          status: "PREPARING",
          stripeCheckoutSessionId: null,
        }),
        retrieveCheckoutSession: async () => processorSession,
      })
      const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))

      assert.equal(response.status, 409)
      assert.equal((await response.json()).error, "PAYMENT_PENDING")
      assert.equal(harness.calls.some(([name]) => name === "indeterminate"), true)
      assert.equal(harness.calls.some(([name]) => name === "release"), false)
      assert.equal(harness.calls.some(([name]) => name === "failure"), false)
    }
  })

  it("expires an orphaned open Session before releasing a lost-race reservation", async () => {
    let retrievalCount = 0
    const harness = checkoutHarness({
      persistCheckoutSession: async () => false,
      loadOrder: async () => ({
        id: "order_123",
        userId: "user_123",
        status: "PREPARING",
        stripeCheckoutSessionId: null,
      }),
      retrieveCheckoutSession: async (sessionId) => {
        retrievalCount += 1
        harness.calls.push(["stripe-retrieve", sessionId])
        return retrievalCount === 1
          ? { id: sessionId, status: "open", payment_status: "unpaid", customer_details: null }
          : { id: sessionId, status: "expired", payment_status: "unpaid", customer_details: null }
      },
    })
    const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))

    assert.equal(response.status, 409)
    const names = harness.calls.map(([name]) => name)
    assert.ok(names.indexOf("stripe-expire") > names.indexOf("stripe-retrieve"))
    assert.ok(names.indexOf("release") > names.indexOf("stripe-expire"))
  })

  it("retrieves a race-winning associated Session before returning its URL", async () => {
    const harness = checkoutHarness({
      persistCheckoutSession: async () => false,
    })
    const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      url: "https://checkout.stripe.com/c/pay",
      orderId: "order_123",
    })
    assert.equal(harness.calls.some(([name]) => name === "stripe-retrieve"), true)
    assert.equal(harness.calls.some(([name]) => name === "stripe-expire"), false)
  })

  it("never releases a paid lost-race Session and sends invalid final country to review", async () => {
    const harness = checkoutHarness({
      persistCheckoutSession: async () => false,
      loadOrder: async () => ({
        id: "order_123",
        userId: "user_123",
        status: "PREPARING",
        stripeCheckoutSessionId: null,
      }),
      retrieveCheckoutSession: async () => ({
        id: "cs_123",
        status: "complete",
        payment_status: "paid",
        customer_details: { address: { country: "CA" } },
      }),
    })
    const response = await createBackgroundCheckoutPostHandler(harness.deps)(request(consentInput()))

    assert.equal(response.status, 202)
    assert.equal((await response.json()).status, "REVIEW_REQUIRED")
    assert.equal(harness.calls.some(([name]) => name === "release"), false)
    assert.equal(harness.calls.some(([name]) => name === "review"), true)
  })
})

describe("background checkout cancellation", () => {
  it("moves an indeterminate PREPARING order to durable AWAITING_PAYMENT state", async () => {
    const events = []
    const updates = []
    const prismaClient = {
      $transaction: async (callback) => callback({
        commerceOrder: {
          findUnique: async () => ({
            id: "order_123",
            userId: "user_123",
            status: "PREPARING",
            stripeCheckoutSessionId: null,
          }),
          updateMany: async (args) => {
            updates.push(args)
            return { count: 1 }
          },
        },
        commerceEvent: {
          create: async ({ data }) => {
            events.push(data)
            return data
          },
        },
      }),
    }

    assert.equal(await markBackgroundCheckoutIndeterminate(prismaClient, {
      userId: "user_123",
      orderId: "order_123",
      sessionId: "cs_indeterminate",
      reasonCode: "CHECKOUT_OUTCOME_INDETERMINATE",
    }), true)
    assert.equal(updates[0].data.status, "AWAITING_PAYMENT")
    assert.equal(updates[0].data.stripeCheckoutSessionId, "cs_indeterminate")
    assert.equal(Object.hasOwn(updates[0].data, "reservationExpiresAt"), false)
    assert.equal(events[0].eventType, "CHECKOUT_RECONCILIATION_REQUIRED")
  })

  it("binds a retried Session to the same indeterminate active order", async () => {
    const events = []
    const updates = []
    const prismaClient = {
      $transaction: async (callback) => callback({
        commerceOrder: {
          findUnique: async () => ({
            id: "order_123",
            userId: "user_123",
            status: "AWAITING_PAYMENT",
            stripeCheckoutSessionId: null,
          }),
          updateMany: async (args) => {
            updates.push(args)
            return { count: 1 }
          },
        },
        commerceEvent: {
          create: async ({ data }) => {
            events.push(data)
            return data
          },
        },
      }),
    }

    assert.equal(await persistBackgroundCheckoutSession(prismaClient, {
      userId: "user_123",
      orderId: "order_123",
      sessionId: "cs_recovered",
      expiresAt: new Date(NOW.getTime() + 30 * 60 * 1000),
    }), true)
    assert.equal(updates[0].where.status, "AWAITING_PAYMENT")
    assert.equal(updates[0].data.stripeCheckoutSessionId, "cs_recovered")
    assert.equal(events[0].eventType, "CHECKOUT_SESSION_RECOVERED")
  })

  it("records the exact won source state when an unpaid reservation is released", async () => {
    const events = []
    const updates = []
    const prismaClient = {
      $transaction: async (callback) => callback({
        commerceOrder: {
          findUnique: async () => ({
            id: "order_123",
            userId: "user_123",
            status: "AWAITING_PAYMENT",
            stripeCheckoutSessionId: "cs_123",
          }),
          updateMany: async (args) => {
            updates.push(args)
            return { count: 1 }
          },
        },
        commerceEvent: {
          create: async ({ data }) => {
            events.push(data)
            return data
          },
        },
      }),
    }

    assert.equal(await releaseBackgroundCheckoutOrder(prismaClient, {
      userId: "user_123",
      orderId: "order_123",
      expectedSessionId: "cs_123",
      allowedStatuses: ["PREPARING", "AWAITING_PAYMENT"],
      processorStatus: "expired",
      paymentStatus: "unpaid",
      terminalStatus: "CANCELED",
      reasonCode: "CUSTOMER_CANCELED",
    }), true)
    assert.equal(events[0].fromState, "AWAITING_PAYMENT")
    assert.deepEqual(updates[0].where.status, "AWAITING_PAYMENT")
  })

  it("expires and re-retrieves an open unpaid Session before conditional release", async () => {
    const harness = checkoutHarness()
    let retrievalCount = 0
    harness.deps.loadOrder = async () => ({
      id: "order_123",
      userId: "user_123",
      status: "AWAITING_PAYMENT",
      stripeCheckoutSessionId: "cs_123",
    })
    harness.deps.retrieveCheckoutSession = async (sessionId) => {
      retrievalCount += 1
      harness.calls.push(["stripe-retrieve", sessionId])
      return retrievalCount === 1
        ? { id: sessionId, status: "open", payment_status: "unpaid", customer_details: null }
        : { id: sessionId, status: "expired", payment_status: "unpaid", customer_details: null }
    }

    const response = await createBackgroundCheckoutCancelPostHandler(harness.deps)(request({
      orderId: "order_123",
    }))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { orderId: "order_123", status: "CANCELED" })
    assert.deepEqual(harness.calls.filter(([name]) => name.startsWith("stripe")).map(([name]) => name), [
      "stripe-retrieve",
      "stripe-expire",
      "stripe-retrieve",
    ])
    assert.equal(harness.calls.at(-1)[0], "release")
  })

  it("does not release paid or async-pending Sessions", async () => {
    for (const processorSession of [
      {
        id: "cs_123",
        status: "complete",
        payment_status: "paid",
        customer_details: { address: { country: "US" } },
      },
      {
        id: "cs_123",
        status: "complete",
        payment_status: "unpaid",
        customer_details: { address: { country: "US" } },
      },
    ]) {
      const harness = checkoutHarness({
        retrieveCheckoutSession: async () => processorSession,
      })
      const response = await createBackgroundCheckoutCancelPostHandler(harness.deps)(request({
        orderId: "order_123",
      }))

      assert.equal(response.status, 409)
      assert.equal((await response.json()).error, "PAYMENT_PENDING")
      assert.equal(harness.calls.some(([name]) => name === "release"), false)
    }
  })

  it("re-retrieves after an expiration race and preserves the newly paid Session", async () => {
    let retrievalCount = 0
    const harness = checkoutHarness({
      retrieveCheckoutSession: async (sessionId) => {
        retrievalCount += 1
        return retrievalCount === 1
          ? { id: sessionId, status: "open", payment_status: "unpaid", customer_details: null }
          : {
              id: sessionId,
              status: "complete",
              payment_status: "paid",
              customer_details: { address: { country: "US" } },
            }
      },
      expireCheckoutSession: async () => {
        throw new Error("Session completed before expiration")
      },
    })
    const response = await createBackgroundCheckoutCancelPostHandler(harness.deps)(request({
      orderId: "order_123",
    }))

    assert.equal(response.status, 409)
    assert.equal((await response.json()).error, "PAYMENT_PENDING")
    assert.equal(retrievalCount, 2)
    assert.equal(harness.calls.some(([name]) => name === "release"), false)
  })

  it("rejects cancellation for an order not owned by the authenticated database user", async () => {
    const harness = checkoutHarness({
      loadOrder: async () => ({
        id: "order_123",
        userId: "someone_else",
        status: "AWAITING_PAYMENT",
        stripeCheckoutSessionId: "cs_123",
      }),
    })
    const response = await createBackgroundCheckoutCancelPostHandler(harness.deps)(request({
      orderId: "order_123",
    }))

    assert.equal(response.status, 409)
    assert.equal((await response.json()).error, "STALE_CONCURRENCY")
    assert.equal(harness.calls.some(([name]) => name.startsWith("stripe")), false)
  })
})
