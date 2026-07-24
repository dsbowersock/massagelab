import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"
import {
  createStripeDonationCheckoutSession,
  isDonationCheckoutSession,
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

  it("normalizes current Supporter Stripe subscriptions into MassageLab subscription records", () => {
    const env = {
      STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1",
    }
    const normalized = normalizeStripeSubscription({
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      current_period_start: 1778791200,
      current_period_end: 1781383200,
      cancel_at_period_end: false,
      canceled_at: null,
      discount: { coupon: { id: "kfRFWYmC" } },
      metadata: { userId: "user_123", membershipLevel: "SUPPORTER" },
      items: {
        data: [
          {
            price: {
              id: "price_supporter_1",
              product: "prod_supporter",
            },
          },
        ],
      },
    }, { env })

    assert.deepEqual(normalized, {
      stripeSubscriptionId: "sub_123",
      stripeCustomerId: "cus_123",
      status: "active",
      membershipLevel: "SUPPORTER",
      stripePriceId: "price_supporter_1",
      stripeProductId: "prod_supporter",
      currentPeriodStart: new Date("2026-05-14T20:40:00.000Z"),
      currentPeriodEnd: new Date("2026-06-13T20:40:00.000Z"),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      couponId: "kfRFWYmC",
      metadata: { userId: "user_123", membershipLevel: "SUPPORTER" },
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

  it("reuses stored Stripe customers that exist in the active Stripe account", async () => {
    const existingCustomer = { userId: "user_123", stripeCustomerId: "cus_live_existing" }
    const writes = []
    let retrievedCustomerId = null
    let createCalled = false
    const prismaClient = {
      stripeCustomer: {
        findUnique: async (args) => {
          assert.deepEqual(args, { where: { userId: "user_123" } })
          return existingCustomer
        },
        upsert: async (args) => {
          writes.push(args)
          return args.update
        },
      },
    }

    const result = await stripeBilling.ensureStripeCustomerForUser(
      prismaClient,
      { id: "user_123", email: "supporter@example.com", name: "Supporter" },
      "sk_live_unused",
      {
        customers: {
          retrieve: async (customerId) => {
            retrievedCustomerId = customerId
            return { id: customerId, deleted: false }
          },
          create: async () => {
            createCalled = true
            return { id: "cus_live_new" }
          },
        },
      },
    )

    assert.equal(result, existingCustomer)
    assert.equal(retrievedCustomerId, "cus_live_existing")
    assert.equal(createCalled, false)
    assert.deepEqual(writes, [])
  })

  it("replaces missing stored Stripe customers before Checkout reuse", async () => {
    const writes = []
    let createdCustomerPayload = null
    let createdCustomerOptions = null
    const prismaClient = {
      stripeCustomer: {
        findUnique: async () => ({ userId: "user_123", stripeCustomerId: "cus_test_stale" }),
        upsert: async (args) => {
          writes.push(args)
          return { userId: args.where.userId, stripeCustomerId: args.update.stripeCustomerId }
        },
      },
    }

    const result = await stripeBilling.ensureStripeCustomerForUser(
      prismaClient,
      { id: "user_123", email: "supporter@example.com", name: "Supporter" },
      "sk_live_unused",
      {
        customers: {
          retrieve: async (customerId) => {
            assert.equal(customerId, "cus_test_stale")
            throw Object.assign(new Error("No such customer"), {
              type: "StripeInvalidRequestError",
              code: "resource_missing",
            })
          },
          create: async (payload, options) => {
            createdCustomerPayload = payload
            createdCustomerOptions = options
            return { id: "cus_live_new" }
          },
        },
      },
    )

    assert.deepEqual(createdCustomerPayload, {
      email: "supporter@example.com",
      name: "Supporter",
      metadata: { userId: "user_123" },
    })
    assert.deepEqual(createdCustomerOptions, {
      idempotencyKey: "massagelab-customer:user_123:cus_test_stale",
    })
    assert.deepEqual(writes, [
      {
        where: { userId: "user_123" },
        create: { userId: "user_123", stripeCustomerId: "cus_live_new" },
        update: { stripeCustomerId: "cus_live_new" },
      },
    ])
    assert.deepEqual(result, { userId: "user_123", stripeCustomerId: "cus_live_new" })
  })

  it("replaces deleted stored Stripe customers before Checkout reuse", async () => {
    const writes = []
    let createdCustomerOptions = null
    const prismaClient = {
      stripeCustomer: {
        findUnique: async () => ({ userId: "user_123", stripeCustomerId: "cus_deleted" }),
        upsert: async (args) => {
          writes.push(args)
          return { userId: args.where.userId, stripeCustomerId: args.update.stripeCustomerId }
        },
      },
    }

    const result = await stripeBilling.ensureStripeCustomerForUser(
      prismaClient,
      { id: "user_123", email: "supporter@example.com", name: "Supporter" },
      "sk_live_unused",
      {
        customers: {
          retrieve: async (customerId) => ({ id: customerId, deleted: true }),
          create: async (_payload, options) => {
            createdCustomerOptions = options
            return { id: "cus_live_new" }
          },
        },
      },
    )

    assert.deepEqual(createdCustomerOptions, {
      idempotencyKey: "massagelab-customer:user_123:cus_deleted",
    })
    assert.deepEqual(writes, [
      {
        where: { userId: "user_123" },
        create: { userId: "user_123", stripeCustomerId: "cus_live_new" },
        update: { stripeCustomerId: "cus_live_new" },
      },
    ])
    assert.deepEqual(result, { userId: "user_123", stripeCustomerId: "cus_live_new" })
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
      couponId: "kfRFWYmC",
      env: supporterTaxEnv(),
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList(),
            create: async (payload) => {
              capturedPayload = payload
              return { id: "cs_123", url: "https://checkout.stripe.com/c/test" }
            },
          },
        },
      },
    })

    assert.deepEqual(capturedPayload.discounts, [{ coupon: "kfRFWYmC" }])
    assert.equal(Object.hasOwn(capturedPayload, "allow_promotion_codes"), false)
  })

  it("creates Supporter Checkout with exclusive automatic tax and address collection", async () => {
    let capturedPayload = null

    await stripeBilling.createStripeCheckoutSession({
      customerId: "cus_123",
      priceId: "price_supporter",
      userId: "user_123",
      membershipLevel: "SUPPORTER",
      successUrl: "https://massagelab.app/account?checkout=success",
      cancelUrl: "https://massagelab.app/account?checkout=cancelled",
      env: supporterTaxEnv(),
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList(),
            create: async (payload) => {
              capturedPayload = payload
              return { id: "cs_123", url: "https://checkout.stripe.com/c/test" }
            },
          },
        },
      },
    })

    assert.deepEqual(capturedPayload.automatic_tax, { enabled: true })
    assert.equal(capturedPayload.billing_address_collection, "required")
    assert.deepEqual(capturedPayload.customer_update, { address: "auto" })
    assert.deepEqual(capturedPayload.line_items, [{
      price: "price_supporter",
      quantity: 1,
    }])
    assert.equal(
      capturedPayload.metadata.checkoutContractVersion,
      "supporter_membership_v1_checkout_v1",
    )
  })

  it("uses Stripe's supported created.gte filter to bound Session reconciliation", async () => {
    let capturedListPayload = null

    await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      nowSeconds: 1784912400,
      stripeClient: {
        checkout: {
          sessions: {
            list: async (payload) => {
              capturedListPayload = payload
              return stripeCheckoutSessionList()
            },
            create: async () => membershipCheckoutSession({ id: "cs_created_filter" }),
          },
        },
      },
    }))

    assert.deepEqual(capturedListPayload, {
      customer: "cus_123",
      created: { gte: 1784307600 },
      limit: 100,
    })
  })

  it("observes membership reconciliation duration without logging identifiers", async () => {
    const originalInfo = console.info
    const infoCalls = []
    console.info = (...args) => infoCalls.push(args)

    try {
      const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        stripeClient: {
          checkout: {
            sessions: {
              list: async () => stripeCheckoutSessionList(),
              create: async () => membershipCheckoutSession({ id: "cs_observed" }),
            },
          },
        },
      }))

      assert.equal(result.id, "cs_observed")
    } finally {
      console.info = originalInfo
    }

    assert.equal(infoCalls.length, 1)
    assert.equal(infoCalls[0][0], "Stripe membership Checkout reconciliation")
    assert.equal(Number.isInteger(infoCalls[0][1].durationMs), true)
    assert.equal(infoCalls[0][1].durationMs >= 0, true)
    assert.deepEqual(
      Object.keys(infoCalls[0][1]).sort(),
      ["durationMs", "outcome", "stripeRateLimited"],
    )
    assert.deepEqual(
      {
        outcome: infoCalls[0][1].outcome,
        stripeRateLimited: infoCalls[0][1].stripeRateLimited,
      },
      { outcome: "success", stripeRateLimited: false },
    )
    assert.doesNotMatch(
      JSON.stringify(infoCalls),
      /cus_123|user_123|price_supporter|cs_observed|sk_live|secret/i,
    )
  })

  it("observes Stripe 429 reconciliation failures without logging processor details", async () => {
    const originalWarn = console.warn
    const warnCalls = []
    const rateLimitError = Object.assign(
      new Error("sk_live_secret customer cus_123 user user_123"),
      {
        statusCode: 429,
        type: "StripeAPIError",
        requestId: "req_secret",
      },
    )
    console.warn = (...args) => warnCalls.push(args)

    try {
      await assert.rejects(
        () => stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
          stripeClient: {
            checkout: {
              sessions: {
                list: async () => {
                  throw rateLimitError
                },
              },
            },
          },
        })),
        (error) => error === rateLimitError,
      )
    } finally {
      console.warn = originalWarn
    }

    assert.equal(warnCalls.length, 1)
    assert.equal(warnCalls[0][0], "Stripe membership Checkout reconciliation")
    assert.equal(Number.isInteger(warnCalls[0][1].durationMs), true)
    assert.equal(warnCalls[0][1].durationMs >= 0, true)
    assert.deepEqual(
      Object.keys(warnCalls[0][1]).sort(),
      ["durationMs", "outcome", "stripeRateLimited"],
    )
    assert.deepEqual(
      {
        outcome: warnCalls[0][1].outcome,
        stripeRateLimited: warnCalls[0][1].stripeRateLimited,
      },
      { outcome: "error", stripeRateLimited: true },
    )
    assert.doesNotMatch(
      JSON.stringify(warnCalls),
      /cus_123|user_123|price_supporter|sk_live|req_secret|secret/i,
    )
  })

  it("fails closed before creating Supporter Checkout when any recurring-tax gate is absent", async () => {
    for (const key of [
      "STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED",
      "STRIPE_SUPPORTER_TAX_PRODUCT_CODE",
      "STRIPE_SUPPORTER_TAX_PROVIDER_READY",
      "STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY",
      "STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED",
    ]) {
      let createCalls = 0
      await assert.rejects(
        stripeBilling.createStripeCheckoutSession({
          customerId: "cus_123",
          priceId: "price_supporter",
          userId: "user_123",
          membershipLevel: "SUPPORTER",
          successUrl: "https://massagelab.app/account?checkout=success",
          cancelUrl: "https://massagelab.app/account?checkout=cancelled",
          env: { ...supporterTaxEnv(), [key]: "" },
          stripeClient: {
            checkout: {
              sessions: {
                create: async () => {
                  createCalls += 1
                  return { id: "cs_123" }
                },
              },
            },
          },
        }),
        /Supporter recurring tax readiness is not configured/,
        key,
      )
      assert.equal(createCalls, 0, key)
    }
  })

  it("serializes concurrent membership Checkout attempts for the same amount selection", async () => {
    const createdSessions = []
    const idempotentRequests = new Map()
    const stripeClient = {
      checkout: {
        sessions: {
          list: async () => stripeCheckoutSessionList(createdSessions),
          listLineItems: async () => stripeCheckoutLineItemList({
            priceId: "price_supporter_monthly",
          }),
          create: async (payload, requestOptions) => {
            const idempotencyKey = requestOptions?.idempotencyKey
            if (!idempotencyKey) {
              const session = membershipCheckoutSession({
                id: `cs_unserialized_${createdSessions.length + 1}`,
              })
              createdSessions.push(session)
              return session
            }

            const prior = idempotentRequests.get(idempotencyKey)
            if (prior) {
              if (prior.priceId !== payload.line_items[0].price) {
                throw Object.assign(new Error("Parameters differ for the same idempotency key."), {
                  type: "StripeIdempotencyError",
                })
              }
              return prior.session
            }

            const session = membershipCheckoutSession({ id: "cs_serialized" })
            idempotentRequests.set(idempotencyKey, {
              priceId: payload.line_items[0].price,
              session,
            })
            createdSessions.push(session)
            return session
          },
        },
      },
      subscriptions: {
        retrieve: async () => {
          throw new Error("an open Checkout Session must not retrieve a subscription")
        },
      },
    }

    const [monthly, yearly] = await Promise.all([
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        priceId: "price_supporter_monthly",
        stripeClient,
      })),
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        priceId: "price_supporter_monthly",
        stripeClient,
      })),
    ])

    assert.equal(createdSessions.length, 1)
    assert.equal(monthly.id, "cs_serialized")
    assert.equal(yearly.id, "cs_serialized")
    assert.deepEqual([...idempotentRequests.keys()], [
      "massagelab-membership-checkout:user_123:after:initial",
    ])
  })

  it("rotates once after concurrent membership Checkout attempts choose different prices", async () => {
    const createdSessions = []
    const createAttempts = []
    const expiredSessions = []
    const idempotentRequests = new Map()
    const stripeClient = {
      checkout: {
        sessions: {
          list: async () => stripeCheckoutSessionList(createdSessions),
          listLineItems: async () => stripeCheckoutLineItemList({
            priceId: "price_supporter_monthly",
          }),
          expire: async (sessionId) => {
            expiredSessions.push(sessionId)
            return { id: sessionId, object: "checkout.session", status: "expired" }
          },
          retrieve: async (sessionId) => ({
            id: sessionId,
            object: "checkout.session",
            status: "expired",
          }),
          create: async (payload, requestOptions) => {
            const priceId = payload.line_items[0].price
            const idempotencyKey = requestOptions?.idempotencyKey
            createAttempts.push({ idempotencyKey, priceId })

            const prior = idempotentRequests.get(idempotencyKey)
            if (prior) {
              if (prior.priceId !== priceId) {
                throw Object.assign(new Error("Parameters differ for the same idempotency key."), {
                  type: "StripeIdempotencyError",
                })
              }
              return prior.session
            }

            const session = membershipCheckoutSession({
              id: priceId === "price_supporter_monthly"
                ? "cs_concurrent_monthly"
                : "cs_concurrent_yearly",
            })
            idempotentRequests.set(idempotencyKey, { priceId, session })
            createdSessions.push(session)
            return session
          },
        },
      },
      subscriptions: {
        retrieve: async () => {
          throw new Error("an open Checkout Session must not retrieve a subscription")
        },
      },
    }

    const [monthly, yearly] = await Promise.all([
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        priceId: "price_supporter_monthly",
        stripeClient,
      })),
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        priceId: "price_supporter_yearly",
        stripeClient,
      })),
    ])

    assert.equal(monthly.id, "cs_concurrent_monthly")
    assert.equal(yearly.id, "cs_concurrent_yearly")
    assert.deepEqual(expiredSessions, ["cs_concurrent_monthly"])
    assert.deepEqual(createAttempts, [
      {
        idempotencyKey: "massagelab-membership-checkout:user_123:after:initial",
        priceId: "price_supporter_monthly",
      },
      {
        idempotencyKey: "massagelab-membership-checkout:user_123:after:initial",
        priceId: "price_supporter_yearly",
      },
      {
        idempotencyKey: "massagelab-membership-checkout:user_123:after:cs_concurrent_monthly",
        priceId: "price_supporter_yearly",
      },
    ])
    assert.deepEqual([...idempotentRequests.keys()], [
      "massagelab-membership-checkout:user_123:after:initial",
      "massagelab-membership-checkout:user_123:after:cs_concurrent_monthly",
    ])
  })

  it("reuses an open membership Checkout Session before webhook persistence", async () => {
    const openSession = membershipCheckoutSession({ id: "cs_open" })
    let createCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([openSession]),
            listLineItems: async () => stripeCheckoutLineItemList(),
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_duplicate" })
            },
          },
        },
        subscriptions: {
          retrieve: async () => {
            throw new Error("an open Checkout Session must not retrieve a subscription")
          },
        },
      },
    }))

    assert.equal(result.id, "cs_open")
    assert.equal(createCalls, 0)
  })

  it("expires an open membership Checkout Session when the requested amount changes", async () => {
    const openSession = membershipCheckoutSession({ id: "cs_open_monthly" })
    const calls = []
    let createdPayload = null
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      priceId: "price_supporter_yearly",
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([openSession]),
            listLineItems: async () => stripeCheckoutLineItemList({
              priceId: "price_supporter_monthly",
            }),
            expire: async (sessionId) => {
              calls.push(["expire", sessionId])
              return { id: sessionId, object: "checkout.session", status: "expired" }
            },
            retrieve: async (sessionId) => {
              calls.push(["retrieve", sessionId])
              return { id: sessionId, object: "checkout.session", status: "expired" }
            },
            create: async (payload) => {
              createdPayload = payload
              return membershipCheckoutSession({ id: "cs_open_yearly" })
            },
          },
        },
        subscriptions: {
          retrieve: async () => {
            throw new Error("an open Checkout Session must not retrieve a subscription")
          },
        },
      },
    }))

    assert.equal(result.id, "cs_open_yearly")
    assert.deepEqual(calls, [
      ["expire", "cs_open_monthly"],
      ["retrieve", "cs_open_monthly"],
    ])
    assert.equal(createdPayload.line_items[0].price, "price_supporter_yearly")
  })

  it("expires purpose-less legacy Supporter, Therapist, and Practice Sessions before creating current Checkout", async () => {
    const sessions = [
      membershipCheckoutSession({
        id: "cs_legacy_supporter_9",
        membershipLevel: "SUPPORTER",
        purpose: null,
      }),
      membershipCheckoutSession({
        id: "cs_legacy_therapist",
        membershipLevel: "THERAPIST",
        purpose: null,
      }),
      membershipCheckoutSession({
        id: "cs_legacy_practice",
        membershipLevel: "PRACTICE",
        purpose: null,
      }),
    ]
    const calls = []
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async ({ starting_after: startingAfter } = {}) => {
              calls.push(["list", startingAfter ?? null])
              return startingAfter
                ? stripeCheckoutSessionList(sessions.slice(1))
                : { ...stripeCheckoutSessionList(sessions.slice(0, 1)), has_more: true }
            },
            expire: async (sessionId) => {
              calls.push(["expire", sessionId])
              return { id: sessionId, object: "checkout.session", status: "expired" }
            },
            retrieve: async (sessionId) => {
              calls.push(["retrieve", sessionId])
              return { id: sessionId, object: "checkout.session", status: "expired" }
            },
            create: async () => {
              calls.push(["create"])
              return membershipCheckoutSession({ id: "cs_current" })
            },
          },
        },
        subscriptions: {
          retrieve: async () => {
            throw new Error("open legacy Sessions must not retrieve subscriptions")
          },
        },
      },
    }))

    assert.equal(result.id, "cs_current")
    assert.deepEqual(
      calls.filter(([operation]) => operation === "expire").map(([, id]) => id).sort(),
      sessions.map(({ id }) => id).sort(),
    )
    assert.deepEqual(
      calls.filter(([operation]) => operation === "retrieve").map(([, id]) => id).sort(),
      sessions.map(({ id }) => id).sort(),
    )
    assert.equal(calls.at(-1)[0], "create")
  })

  it("preserves purpose-less completed membership Sessions for active-subscription blocking", async () => {
    const completedSession = membershipCheckoutSession({
      id: "cs_legacy_complete",
      purpose: null,
      status: "complete",
      subscription: "sub_legacy_complete",
      url: null,
    })
    let createCalls = 0
    let expireCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([completedSession]),
            expire: async () => {
              expireCalls += 1
              throw new Error("completed Sessions must not be expired")
            },
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_duplicate" })
            },
          },
        },
        subscriptions: {
          retrieve: async (subscriptionId) => membershipStripeSubscription({
            id: subscriptionId,
          }),
        },
      },
    }))

    assert.equal(result.id, "cs_legacy_complete")
    assert.equal(expireCalls, 0)
    assert.equal(createCalls, 0)
  })

  it("expires open Sessions with missing or contradictory current Checkout contracts", async () => {
    const sessions = [
      membershipCheckoutSession({
        id: "cs_wrong_marker",
        checkoutContractVersion: "supporter_membership_v0_checkout_v1",
      }),
      membershipCheckoutSession({
        id: "cs_wrong_tax",
        automaticTaxEnabled: false,
      }),
      membershipCheckoutSession({
        id: "cs_wrong_address",
        billingAddressCollection: "auto",
      }),
      membershipCheckoutSession({ id: "cs_wrong_catalog" }),
    ]
    const expired = []
    let createCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList(sessions),
            listLineItems: async (sessionId) => (
              sessionId === "cs_wrong_catalog"
                ? stripeCheckoutLineItemList({
                    priceId: "price_legacy_supporter_9",
                    productCatalog: null,
                  })
                : stripeCheckoutLineItemList()
            ),
            expire: async (sessionId) => {
              expired.push(sessionId)
              return { id: sessionId, object: "checkout.session", status: "expired" }
            },
            retrieve: async (sessionId) => ({
              id: sessionId,
              object: "checkout.session",
              status: "expired",
            }),
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_current" })
            },
          },
        },
        subscriptions: {
          retrieve: async () => {
            throw new Error("open incompatible Sessions must not retrieve subscriptions")
          },
        },
      },
    }))

    assert.equal(result.id, "cs_current")
    assert.deepEqual(expired.sort(), sessions.map(({ id }) => id).sort())
    assert.equal(createCalls, 1)
  })

  it("recovers an ambiguously committed legacy expiration only after retrieval confirms it", async () => {
    const legacySession = membershipCheckoutSession({
      id: "cs_legacy_ambiguous",
      purpose: null,
    })
    let createCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([legacySession]),
            expire: async () => {
              throw new Error("connection closed after Stripe committed expiration")
            },
            retrieve: async (sessionId) => ({
              id: sessionId,
              object: "checkout.session",
              status: "expired",
            }),
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_current" })
            },
          },
        },
        subscriptions: {
          retrieve: async () => {
            throw new Error("open legacy Sessions must not retrieve subscriptions")
          },
        },
      },
    }))

    assert.equal(result.id, "cs_current")
    assert.equal(createCalls, 1)
  })

  it("fails closed when legacy expiration cannot be confirmed", async () => {
    const legacySession = membershipCheckoutSession({
      id: "cs_legacy_still_open",
      purpose: null,
    })
    let createCalls = 0
    await assert.rejects(
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        stripeClient: {
          checkout: {
            sessions: {
              list: async () => stripeCheckoutSessionList([legacySession]),
              expire: async (sessionId) => ({
                id: sessionId,
                object: "checkout.session",
                status: "expired",
              }),
              retrieve: async (sessionId) => ({
                id: sessionId,
                object: "checkout.session",
                status: "open",
              }),
              create: async () => {
                createCalls += 1
                return membershipCheckoutSession({ id: "cs_duplicate" })
              },
            },
          },
          subscriptions: {
            retrieve: async () => {
              throw new Error("open legacy Sessions must not retrieve subscriptions")
            },
          },
        },
      })),
      /Unable to confirm legacy membership Checkout expiration/,
    )
    assert.equal(createCalls, 0)
  })

  it("blocks on a completed Checkout whose subscription is relevant before webhook persistence", async () => {
    const completedSession = membershipCheckoutSession({
      id: "cs_complete",
      status: "complete",
      subscription: "sub_complete",
      url: null,
    })
    let createCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([completedSession]),
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_duplicate" })
            },
          },
        },
        subscriptions: {
          retrieve: async (subscriptionId) => membershipStripeSubscription({
            id: subscriptionId,
          }),
        },
      },
    }))

    assert.equal(result.id, "cs_complete")
    assert.equal(result.status, "complete")
    assert.equal(createCalls, 0)
  })

  it("does not block a new Checkout for a terminal subscription with a stale cancellation flag", async () => {
    const completedSession = membershipCheckoutSession({
      id: "cs_complete_canceled",
      status: "complete",
      subscription: "sub_canceled",
      url: null,
    })
    let createCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([completedSession]),
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_new_after_canceled" })
            },
          },
        },
        subscriptions: {
          retrieve: async (subscriptionId) => membershipStripeSubscription({
            id: subscriptionId,
            status: "canceled",
            cancelAtPeriodEnd: true,
          }),
        },
      },
    }))

    assert.equal(result.id, "cs_new_after_canceled")
    assert.equal(createCalls, 1)
  })

  it("prioritizes a completed relevant subscription over stale open or expired Sessions", async () => {
    const sessions = [
      {
        ...membershipCheckoutSession({
          id: "cs_expired_newer",
          status: "expired",
          url: null,
        }),
        created: 1784912402,
      },
      {
        ...membershipCheckoutSession({
          id: "cs_complete",
          status: "complete",
          subscription: "sub_complete",
          url: null,
        }),
        created: 1784912401,
      },
      {
        ...membershipCheckoutSession({ id: "cs_open_stale" }),
        created: 1784912400,
      },
    ]
    let createCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList(sessions),
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_duplicate" })
            },
          },
        },
        subscriptions: {
          retrieve: async (subscriptionId) => membershipStripeSubscription({
            id: subscriptionId,
          }),
        },
      },
    }))

    assert.equal(result.id, "cs_complete")
    assert.equal(result.status, "complete")
    assert.equal(createCalls, 0)
  })

  it("rotates the membership Checkout idempotency key after the previous Session expires", async () => {
    const expiredSession = membershipCheckoutSession({
      id: "cs_expired",
      status: "expired",
      url: null,
    })
    let capturedOptions = null
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([expiredSession]),
            create: async (_payload, requestOptions) => {
              capturedOptions = requestOptions
              return membershipCheckoutSession({ id: "cs_retry" })
            },
          },
        },
        subscriptions: {
          retrieve: async () => {
            throw new Error("an expired Checkout Session must not retrieve a subscription")
          },
        },
      },
    }))

    assert.equal(result.id, "cs_retry")
    assert.deepEqual(capturedOptions, {
      idempotencyKey: "massagelab-membership-checkout:user_123:after:cs_expired",
    })
  })

  it("creates one-time support Checkout Sessions without membership entitlement metadata", async () => {
    let capturedPayload = null

    const session = await createStripeDonationCheckoutSession({
      amountCents: 1500,
      customerEmail: "supporter@example.com",
      userId: "user_123",
      successUrl: "https://massagelab.app/pricing?donation=thanks",
      cancelUrl: "https://massagelab.app/pricing?donation=cancelled",
      stripeClient: {
        checkout: {
          sessions: {
            create: async (payload) => {
              capturedPayload = payload
              return { id: "cs_donation", url: "https://checkout.stripe.com/c/donation" }
            },
          },
        },
      },
    })

    assert.equal(session.url, "https://checkout.stripe.com/c/donation")
    assert.equal(capturedPayload.mode, "payment")
    assert.equal(Object.hasOwn(capturedPayload, "submit_type"), false)
    assert.equal(capturedPayload.customer_email, "supporter@example.com")
    assert.equal(capturedPayload.line_items[0].price_data.unit_amount, 1500)
    assert.deepEqual(capturedPayload.line_items[0].price_data.product_data, {
      name: "MassageLab One-time support",
      description: "One-time support does not create a membership or unlock features. It is not a charitable donation and is not tax-deductible.",
    })
    assert.equal(Object.hasOwn(capturedPayload, "automatic_tax"), false)
    assert.equal(capturedPayload.metadata.purpose, "massagelab_project_support")
    assert.equal(capturedPayload.payment_intent_data.metadata.purpose, "massagelab_project_support")
    assert.equal(Object.hasOwn(capturedPayload, "subscription_data"), false)
  })

  it("ignores donation Checkout Sessions during membership reconciliation", async () => {
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
    const donationSession = {
      client_reference_id: "user_123",
      customer: "cus_123",
      metadata: { purpose: "massagelab_project_support", userId: "user_123" },
    }

    assert.equal(isDonationCheckoutSession(donationSession), true)
    assert.equal(await stripeBilling.recordCheckoutSessionCompleted(prismaClient, donationSession), null)
    assert.deepEqual(writes, [])
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

  it("reconciles every current Supporter Price through Checkout completion", async () => {
    const currentPrices = {
      STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1_monthly",
      STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_1_yearly",
      STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2_monthly",
      STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "price_supporter_2_yearly",
      STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "price_supporter_5_monthly",
      STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "price_supporter_5_yearly",
    }

    for (const [index, priceId] of Object.values(currentPrices).entries()) {
      const writes = []
      const result = await stripeBilling.recordCheckoutSessionCompleted({
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
      }, {
        client_reference_id: "user_123",
        customer: "cus_123",
        subscription: `sub_supporter_${index}`,
      }, {
        env: currentPrices,
        retrieveSubscription: async (subscriptionId) => ({
          id: subscriptionId,
          customer: "cus_123",
          status: "active",
          current_period_start: 1778791200,
          current_period_end: 1781383200,
          metadata: { userId: "user_123", membershipLevel: "SUPPORTER" },
          items: {
            data: [{
              price: {
                id: priceId,
                product: "prod_supporter",
              },
            }],
          },
        }),
      })

      assert.equal(result.subscription.membershipLevel, "SUPPORTER", priceId)
      assert.equal(
        writes.some(([kind]) => kind === "subscription"),
        true,
        priceId,
      )
    }
  })

  it("classifies explicit Checkout purposes without treating unknown flows as memberships", () => {
    assert.equal(typeof stripeBilling.classifyStripeCheckoutSessionPurpose, "function")
    assert.equal(stripeBilling.classifyStripeCheckoutSessionPurpose({
      metadata: { purpose: "background_purchase" },
    }), "background_purchase")
    assert.equal(stripeBilling.classifyStripeCheckoutSessionPurpose({
      metadata: { purpose: "massagelab_project_support" },
    }), "donation")
    assert.equal(stripeBilling.classifyStripeCheckoutSessionPurpose({
      mode: "subscription",
      metadata: {},
    }), "membership")
    assert.equal(stripeBilling.classifyStripeCheckoutSessionPurpose({
      mode: "subscription",
      metadata: { purpose: "membership" },
    }), "membership")
    assert.equal(stripeBilling.classifyStripeCheckoutSessionPurpose({
      mode: "payment",
      metadata: { purpose: "another_product" },
    }), "unknown")
  })

  it("retrieves every background Checkout line-item page with fulfillment evidence expanded", async () => {
    assert.equal(typeof stripeBilling.retrieveBackgroundPurchaseCheckoutSessionForFulfillment, "function")
    let capturedId = null
    let capturedOptions = null
    const listCalls = []

    const session = await stripeBilling.retrieveBackgroundPurchaseCheckoutSessionForFulfillment(
      "cs_background",
      {
        stripeClient: {
          checkout: {
            sessions: {
              retrieve: async (sessionId, options) => {
                capturedId = sessionId
                capturedOptions = options
                return { id: sessionId }
              },
              listLineItems: async (sessionId, options) => {
                listCalls.push({ sessionId, options })
                return listCalls.length === 1
                  ? { object: "list", data: [{ id: "li_1" }], has_more: true }
                  : { object: "list", data: [{ id: "li_2" }], has_more: false }
              },
            },
          },
        },
      },
    )

    assert.equal(capturedId, "cs_background")
    assert.deepEqual(capturedOptions, {
      expand: ["payment_intent"],
    })
    assert.equal(session.id, "cs_background")
    assert.deepEqual(listCalls, [
      {
        sessionId: "cs_background",
        options: { limit: 100, expand: ["data.price.product"] },
      },
      {
        sessionId: "cs_background",
        options: { limit: 100, expand: ["data.price.product"], starting_after: "li_1" },
      },
    ])
    assert.deepEqual(session.line_items.data.map((item) => item.id), ["li_1", "li_2"])
    assert.equal(session.line_items.has_more, false)
  })
})

function supporterTaxEnv() {
  return {
    STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter",
    STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_yearly",
    STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_monthly",
    STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "price_supporter_2_yearly",
    STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "price_supporter_5_monthly",
    STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "price_supporter_5_yearly",
    STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED: "true",
    STRIPE_SUPPORTER_TAX_PRODUCT_CODE: "txcd_10000000",
    STRIPE_SUPPORTER_TAX_PROVIDER_READY: "true",
    STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY: "true",
    STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED: "true",
  }
}

function membershipCheckoutOptions(overrides = {}) {
  return {
    customerId: "cus_123",
    priceId: "price_supporter",
    userId: "user_123",
    membershipLevel: "SUPPORTER",
    successUrl: "https://massagelab.app/account?checkout=success",
    cancelUrl: "https://massagelab.app/account?checkout=cancelled",
    env: supporterTaxEnv(),
    ...overrides,
  }
}

function membershipStripeSubscription({
  id = "sub_supporter",
  status = "active",
  cancelAtPeriodEnd = false,
} = {}) {
  return {
    id,
    object: "subscription",
    customer: "cus_123",
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    metadata: { userId: "user_123", membershipLevel: "SUPPORTER" },
    items: {
      data: [{
        price: {
          id: "price_supporter",
          product: "prod_supporter",
        },
      }],
    },
  }
}

function membershipCheckoutSession({
  id = "cs_membership",
  status = "open",
  subscription = null,
  url = "https://checkout.stripe.com/c/membership",
  membershipLevel = "SUPPORTER",
  purpose = "membership",
  checkoutContractVersion = "supporter_membership_v1_checkout_v1",
  automaticTaxEnabled = true,
  billingAddressCollection = "required",
} = {}) {
  const metadata = {
    userId: "user_123",
    membershipLevel,
  }
  if (purpose !== null) {
    metadata.purpose = purpose
  }
  if (checkoutContractVersion !== null) {
    metadata.checkoutContractVersion = checkoutContractVersion
  }

  return {
    id,
    object: "checkout.session",
    automatic_tax: {
      enabled: automaticTaxEnabled,
      liability: null,
      provider: null,
      status: null,
    },
    billing_address_collection: billingAddressCollection,
    created: 1784912400,
    customer: "cus_123",
    client_reference_id: "user_123",
    livemode: false,
    metadata,
    mode: "subscription",
    status,
    subscription,
    url,
  }
}

function stripeCheckoutSessionList(data = []) {
  return {
    object: "list",
    data,
    has_more: false,
    url: "/v1/checkout/sessions",
  }
}

function stripeCheckoutLineItemList({
  priceId = "price_supporter",
  productCatalog = "supporter_membership_v1",
} = {}) {
  return {
    object: "list",
    data: [{
      id: "li_membership",
      object: "item",
      amount_discount: 0,
      amount_subtotal: 100,
      amount_tax: 0,
      amount_total: 100,
      currency: "usd",
      description: "MassageLab Supporter Membership",
      discounts: [],
      price: {
        id: priceId,
        object: "price",
        active: true,
        billing_scheme: "per_unit",
        currency: "usd",
        currency_options: {},
        metadata: {},
        product: {
          id: "prod_supporter_current",
          object: "product",
          active: true,
          metadata: productCatalog
            ? { massagelab_catalog: productCatalog }
            : {},
          name: "MassageLab Supporter Membership",
          tax_code: "txcd_10000000",
        },
        recurring: {
          interval: "month",
          interval_count: 1,
          trial_period_days: null,
          usage_type: "licensed",
        },
        tax_behavior: "exclusive",
        transform_quantity: null,
        type: "recurring",
        unit_amount: 100,
        unit_amount_decimal: "100",
      },
      quantity: 1,
    }],
    has_more: false,
    url: "/v1/checkout/sessions/cs_membership/line_items",
  }
}
