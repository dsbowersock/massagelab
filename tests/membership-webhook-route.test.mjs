import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  BACKGROUND_PURCHASE_PURPOSE,
  classifyStripeCheckoutSessionPurpose,
} from "../lib/stripe-billing.js"
import { MembershipWebhookRetryableError } from "../lib/membership-webhook-service.ts"
import {
  STRIPE_BACKGROUND_CHECKOUT_WEBHOOK_EVENTS,
  STRIPE_BACKGROUND_DISPUTE_WEBHOOK_EVENTS,
  STRIPE_BACKGROUND_REFUND_WEBHOOK_EVENTS,
  STRIPE_MEMBERSHIP_WEBHOOK_EVENTS,
} from "../lib/stripe-webhook-contract.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const routeSource = readFileSync(
  new URL("../app/api/billing/webhook/route.ts", import.meta.url),
  "utf8",
)
const membershipWebhookServiceSource = readFileSync(
  new URL("../lib/membership-webhook-service.ts", import.meta.url),
  "utf8",
)
const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8")
const MEMBERSHIP_WRITES_PAUSED_ENV = "MASSAGELAB_MEMBERSHIP_WEBHOOK_WRITES_PAUSED"

describe("signed membership webhook route", () => {
  it("keeps the cached display catalog outside webhook convergence authority", () => {
    assert.doesNotMatch(routeSource, /membership-pricing(?:\.js)?["']/)
    assert.doesNotMatch(membershipWebhookServiceSource, /membership-pricing(?:\.js)?["']/)
  })

  it("verifies the exact raw body and signature before parsing or writing", async () => {
    const harness = createWebhookHarness({ signatureValid: false })
    const rawBody = "{not-valid-json"

    const response = await harness.POST(webhookRequest(rawBody, "sig_invalid"))

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: "Invalid Stripe signature" })
    assert.deepEqual(harness.calls, [
      ["signature", rawBody, "sig_invalid", "whsec_test"],
    ])
  })

  it("documents the deployment bridge as a blank non-secret environment input", () => {
    assert.match(envExample, /^MASSAGELAB_MEMBERSHIP_WEBHOOK_WRITES_PAUSED=$/m)
    assert.doesNotMatch(envExample, /^MASSAGELAB_MEMBERSHIP_WEBHOOK_WRITES_PAUSED=.+$/m)
  })

  it("returns the retry contract for paused membership Checkout before processor, provider, database, or cache work", async () => {
    const harness = createWebhookHarness({
      environment: { [MEMBERSHIP_WRITES_PAUSED_ENV]: "1" },
      membershipResult: { outcome: "applied", changed: true, userId: "user_123" },
    })
    const event = checkoutEvent({ purpose: "membership", mode: "subscription" })

    const response = await harness.POST(webhookRequest(JSON.stringify(event)))

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { received: false, retry: true })
    assert.deepEqual(harness.calls.map(([name]) => name), ["signature", "classify"])
    assert.deepEqual(harness.membershipInputs, [])
    assert.deepEqual(harness.subscriptionRetrievals, [])
    assert.deepEqual(harness.databaseAccesses, [])
  })

  for (const eventType of STRIPE_MEMBERSHIP_WEBHOOK_EVENTS) {
    it(`returns the retry contract for paused ${eventType} before any membership work`, async () => {
      const harness = createWebhookHarness({
        environment: { [MEMBERSHIP_WRITES_PAUSED_ENV]: "1" },
      })

      const response = await harness.POST(webhookRequest(JSON.stringify(
        subscriptionEvent(eventType),
      )))

      assert.equal(response.status, 503)
      assert.deepEqual(await response.json(), { received: false, retry: true })
      assert.deepEqual(harness.calls.map(([name]) => name), ["signature"])
      assert.deepEqual(harness.membershipInputs, [])
      assert.deepEqual(harness.subscriptionRetrievals, [])
      assert.deepEqual(harness.databaseAccesses, [])
    })
  }

  for (const flagValue of [undefined, "0", "true", "yes", " 1 ", "1 "]) {
    it(`keeps ordinary convergence for the ${flagValue === undefined ? "missing" : JSON.stringify(flagValue)} pause value`, async () => {
      const environment = flagValue === undefined
        ? {}
        : { [MEMBERSHIP_WRITES_PAUSED_ENV]: flagValue }
      const harness = createWebhookHarness({ environment })

      const response = await harness.POST(webhookRequest(JSON.stringify(
        subscriptionEvent("customer.subscription.updated"),
      )))

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { received: true })
      assert.equal(harness.membershipInputs.length, 1)
    })
  }

  it("routes membership-purpose Checkout completion through convergence with the current retrieval owner", async () => {
    const harness = createWebhookHarness({
      membershipResult: { outcome: "applied", changed: true, userId: "user_123" },
    })
    const event = checkoutEvent({ purpose: "membership", mode: "subscription" })

    const response = await harness.POST(webhookRequest(JSON.stringify(event)))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { received: true })
    assert.equal(harness.membershipInputs.length, 1)
    assert.deepEqual(harness.membershipInputs[0].event, event)
    assert.strictEqual(
      harness.membershipInputs[0].retrieveSubscription,
      harness.retrieveStripeSubscription,
    )
    assert.deepEqual(harness.calls.map(([name]) => name), [
      "signature",
      "classify",
      "membership",
      "cache",
    ])
    assert.equal(harness.calls.some(([name]) => name === "legacy-checkout"), false)
  })

  for (const eventType of STRIPE_MEMBERSHIP_WEBHOOK_EVENTS) {
    it(`routes ${eventType} through convergence`, async () => {
      const harness = createWebhookHarness()
      const event = subscriptionEvent(eventType)

      const response = await harness.POST(webhookRequest(JSON.stringify(event)))

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { received: true })
      assert.deepEqual(harness.membershipInputs.map(({ event: input }) => input.type), [eventType])
      assert.strictEqual(
        harness.membershipInputs[0].retrieveSubscription,
        harness.retrieveStripeSubscription,
      )
      assert.equal(harness.calls.some(([name]) => name === "legacy-subscription"), false)
    })
  }

  for (const result of [
    { outcome: "applied", changed: false, userId: "user_123" },
    { outcome: "duplicate", changed: false, userId: "user_123" },
    { outcome: "ignored", changed: false, userId: null },
  ]) {
    it(`acknowledges the ${result.outcome} non-changing membership outcome without clearing cache`, async () => {
      const harness = createWebhookHarness({ membershipResult: result })

      const response = await harness.POST(webhookRequest(JSON.stringify(
        subscriptionEvent("customer.subscription.updated"),
      )))

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { received: true })
      assert.equal(harness.calls.some(([name]) => name === "cache"), false)
    })
  }

  it("clears the narrowed membership cache only after convergence commits a changed result", async () => {
    let finishMembership
    const membershipPending = new Promise((resolve) => {
      finishMembership = resolve
    })
    const harness = createWebhookHarness({ membershipPending })

    const responsePending = harness.POST(webhookRequest(JSON.stringify(
      subscriptionEvent("customer.subscription.updated"),
    )))
    await waitForCall(harness.calls, "membership")

    assert.deepEqual(harness.calls.map(([name]) => name), ["signature", "membership"])
    finishMembership({ outcome: "applied", changed: true, userId: "user_narrow" })

    const response = await responsePending
    assert.equal(response.status, 200)
    assert.deepEqual(harness.calls.at(-1), ["cache", "user_narrow", "membership"])
  })

  it("returns one privacy-safe 503 retry response for the typed unfinished outcome", async () => {
    const harness = createWebhookHarness({
      membershipError: new MembershipWebhookRetryableError("provider_unavailable"),
    })

    const response = await harness.POST(webhookRequest(JSON.stringify(
      subscriptionEvent("customer.subscription.updated"),
    )))
    const body = await response.json()

    assert.equal(response.status, 503)
    assert.deepEqual(body, { received: false, retry: true })
    assert.doesNotMatch(JSON.stringify(body), /provider_unavailable|sub_123|cus_123/i)
    assert.equal(harness.calls.some(([name]) => name === "cache"), false)
  })

  it("keeps unexpected membership failures non-2xx and private", async () => {
    const harness = createWebhookHarness({
      membershipError: new Error("Stripe subscription sub_sensitive failed for cus_sensitive"),
    })

    const response = await harness.POST(webhookRequest(JSON.stringify(
      subscriptionEvent("customer.subscription.updated"),
    )))
    const body = await response.json()

    assert.equal(response.status, 500)
    assert.deepEqual(body, { received: false })
    assert.doesNotMatch(JSON.stringify(body), /Stripe|sub_sensitive|cus_sensitive/i)
    assert.equal(harness.calls.some(([name]) => name === "cache"), false)
  })

  for (const [purpose, mode] of [
    ["donation", "payment"],
    ["future-purpose", "subscription"],
  ]) {
    it(`acknowledges ${purpose} Checkout without entitlement or commerce writes`, async () => {
      const harness = createWebhookHarness({
        environment: { [MEMBERSHIP_WRITES_PAUSED_ENV]: "1" },
      })
      const event = checkoutEvent({ purpose, mode })

      const response = await harness.POST(webhookRequest(JSON.stringify(event)))

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { received: true })
      assert.deepEqual(harness.calls.map(([name]) => name), ["signature", "classify"])
    })
  }
})

describe("non-membership billing webhook routing", () => {
  for (const eventType of STRIPE_BACKGROUND_CHECKOUT_WEBHOOK_EVENTS) {
    it(`preserves ${eventType} background fulfillment routing`, async () => {
      const harness = createWebhookHarness({
        backgroundChanged: true,
        environment: { [MEMBERSHIP_WRITES_PAUSED_ENV]: "1" },
      })
      const event = checkoutEvent({
        eventType,
        purpose: BACKGROUND_PURCHASE_PURPOSE,
        mode: "payment",
      })

      const response = await harness.POST(webhookRequest(JSON.stringify(event)))

      assert.equal(response.status, 200)
      assert.deepEqual(harness.backgroundRetrievals, [event.data.object.id])
      assert.equal(harness.fulfillmentInputs.length, 1)
      assert.equal(harness.fulfillmentInputs[0].eventType, eventType)
      assert.strictEqual(harness.fulfillmentInputs[0].session, harness.retrievedBackgroundSession)
      assert.deepEqual(harness.calls.at(-1), ["cache", "background_user", "membership"])
      assert.equal(harness.membershipInputs.length, 0)
    })
  }

  for (const eventType of STRIPE_BACKGROUND_REFUND_WEBHOOK_EVENTS) {
    it(`preserves ${eventType} refund routing`, async () => {
      const harness = createWebhookHarness({
        environment: { [MEMBERSHIP_WRITES_PAUSED_ENV]: "1" },
      })
      const event = processorEvent(eventType, {
        id: "re_123",
        payment_intent: "pi_123",
      })

      const response = await harness.POST(webhookRequest(JSON.stringify(event)))

      assert.equal(response.status, 200)
      assert.equal(harness.refundInputs.length, 1)
      assert.equal(harness.refundInputs[0].eventType, eventType)
      assert.deepEqual(harness.refundInputs[0].refund, event.data.object)
      assert.equal(harness.membershipInputs.length, 0)
    })
  }

  for (const eventType of STRIPE_BACKGROUND_DISPUTE_WEBHOOK_EVENTS) {
    it(`preserves ${eventType} dispute routing`, async () => {
      const harness = createWebhookHarness({
        environment: { [MEMBERSHIP_WRITES_PAUSED_ENV]: "1" },
      })
      const event = processorEvent(eventType, {
        id: "dp_123",
        charge: { id: "ch_123", payment_intent: "pi_123" },
      })

      const response = await harness.POST(webhookRequest(JSON.stringify(event)))

      assert.equal(response.status, 200)
      assert.equal(harness.disputeInputs.length, 1)
      assert.equal(harness.disputeInputs[0].eventType, eventType)
      assert.equal(harness.disputeInputs[0].paymentIntentId, "pi_123")
      assert.deepEqual(harness.disputeInputs[0].dispute, event.data.object)
      assert.equal(harness.membershipInputs.length, 0)
    })
  }

  it("preserves dispute charge retrieval before reversal processing", async () => {
    const harness = createWebhookHarness({
      environment: { [MEMBERSHIP_WRITES_PAUSED_ENV]: "1" },
    })
    const event = processorEvent("charge.dispute.created", {
      id: "dp_123",
      charge: "ch_123",
    })

    const response = await harness.POST(webhookRequest(JSON.stringify(event)))

    assert.equal(response.status, 200)
    assert.deepEqual(harness.chargeRetrievals, ["ch_123"])
    assert.equal(harness.disputeInputs[0].paymentIntentId, "pi_from_charge")
  })
})

/** Loads the production route with explicit, inert processor dependencies. */
function createWebhookHarness({
  signatureValid = true,
  membershipResult = { outcome: "applied", changed: false, userId: "user_123" },
  membershipError = null,
  membershipPending = null,
  backgroundChanged = false,
  environment = {},
} = {}) {
  const calls = []
  const membershipInputs = []
  const fulfillmentInputs = []
  const refundInputs = []
  const disputeInputs = []
  const backgroundRetrievals = []
  const chargeRetrievals = []
  const subscriptionRetrievals = []
  const databaseAccesses = []
  const prismaClient = new Proxy({ owner: "test-prisma" }, {
    get(target, property, receiver) {
      databaseAccesses.push(String(property))
      return Reflect.get(target, property, receiver)
    },
  })
  const retrievedBackgroundSession = { id: "cs_background_retrieved" }
  const retrieveStripeSubscription = async (subscriptionId) => {
    subscriptionRetrievals.push(subscriptionId)
    return { id: subscriptionId }
  }

  const stripeBilling = {
    BACKGROUND_PURCHASE_PURPOSE,
    classifyStripeCheckoutSessionPurpose: (session) => {
      calls.push(["classify"])
      return classifyStripeCheckoutSessionPurpose(session)
    },
    getStripeClient: () => ({
      charges: {
        retrieve: async (chargeId) => {
          chargeRetrievals.push(chargeId)
          return { id: chargeId, payment_intent: "pi_from_charge" }
        },
      },
    }),
    getStripeWebhookSecret: () => "whsec_test",
    recordCheckoutSessionCompleted: async (...args) => {
      calls.push(["legacy-checkout", ...args])
      return { customer: { userId: "legacy_user" } }
    },
    retrieveBackgroundPurchaseCheckoutSessionForFulfillment: async (sessionId) => {
      backgroundRetrievals.push(sessionId)
      return retrievedBackgroundSession
    },
    retrieveStripeSubscription,
    upsertMembershipSubscriptionFromStripe: async (...args) => {
      calls.push(["legacy-subscription", ...args])
      return { userId: "legacy_user" }
    },
    verifyStripeWebhookSignature: (rawBody, signature, secret) => {
      calls.push(["signature", rawBody, signature, secret])
      return signatureValid
    },
  }
  const processStripeMembershipEvent = async (input) => {
    calls.push(["membership", input.event.type])
    membershipInputs.push(input)
    if (membershipError) throw membershipError
    if (membershipPending) return membershipPending
    return membershipResult
  }

  const routeModule = loadCompiledModule(routeSource, "billing-webhook-route.test.ts", {
    "node:process": { env: environment },
    "next/server": {
      NextResponse: {
        json: (body, init = {}) => Response.json(body, { status: init.status ?? 200 }),
      },
    },
    "@/lib/account-surface-data": {
      clearAccountSurfaceDataCache: (userId, scope) => {
        calls.push(["cache", userId, scope])
      },
    },
    "@/lib/commerce/fulfillment-service": {
      fulfillBackgroundPurchase: async (input) => {
        calls.push(["background", input.eventType])
        fulfillmentInputs.push(input)
        return { changed: backgroundChanged, userId: "background_user" }
      },
    },
    "@/lib/commerce/reversal-service": {
      applyStripeDisputeEvent: async (input) => {
        calls.push(["dispute", input.eventType])
        disputeInputs.push(input)
        return { changed: false }
      },
      applyStripeRefundEvent: async (input) => {
        calls.push(["refund", input.eventType])
        refundInputs.push(input)
        return { changed: false }
      },
    },
    "@/lib/membership-webhook-service": {
      MembershipWebhookRetryableError,
      processStripeMembershipEvent,
    },
    "@/lib/prisma": { prisma: prismaClient },
    "@/lib/stripe-billing": stripeBilling,
    "@/lib/stripe-webhook-contract": {
      STRIPE_BACKGROUND_CHECKOUT_WEBHOOK_EVENTS,
      STRIPE_BACKGROUND_DISPUTE_WEBHOOK_EVENTS,
      STRIPE_BACKGROUND_REFUND_WEBHOOK_EVENTS,
      STRIPE_MEMBERSHIP_WEBHOOK_EVENTS,
    },
  })

  return {
    POST: routeModule.POST,
    backgroundRetrievals,
    calls,
    chargeRetrievals,
    databaseAccesses,
    disputeInputs,
    fulfillmentInputs,
    membershipInputs,
    prismaClient,
    refundInputs,
    retrievedBackgroundSession,
    retrieveStripeSubscription,
    subscriptionRetrievals,
  }
}

function webhookRequest(rawBody, signature = "sig_valid") {
  return new Request("https://massagelab.app/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: rawBody,
  })
}

function checkoutEvent({
  eventType = "checkout.session.completed",
  purpose,
  mode,
}) {
  return processorEvent(eventType, {
    id: "cs_123",
    mode,
    client_reference_id: "user_123",
    customer: "cus_123",
    subscription: "sub_123",
    metadata: { purpose, userId: "user_123" },
  })
}

function subscriptionEvent(type) {
  return processorEvent(type, {
    id: "sub_123",
    customer: "cus_123",
    metadata: { userId: "user_123" },
  })
}

function processorEvent(type, object) {
  return {
    id: `evt_${type.replaceAll(".", "_")}`,
    type,
    created: 1778791200,
    data: { object },
  }
}

async function waitForCall(calls, expectedName) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (calls.some(([name]) => name === expectedName)) return
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.fail(`Expected ${expectedName} call before the bounded wait elapsed`)
}
