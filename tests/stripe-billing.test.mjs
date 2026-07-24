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
import {
  SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
  SUPPORTER_RECURRING_TAX_BEHAVIOR,
  SUPPORTER_RECURRING_TAX_CODE,
} from "../lib/stripe-price-contract.js"

const DEFAULT_SUPPORTER_PRICE_ID = "price_supporter_1_monthly"
const SUPPORTER_1_YEARLY_PRICE_ID = "price_supporter_1_yearly"
const SUPPORTER_2_MONTHLY_PRICE_ID = "price_supporter_2_monthly"
const SUPPORTER_2_YEARLY_PRICE_ID = "price_supporter_2_yearly"
const SUPPORTER_5_MONTHLY_PRICE_ID = "price_supporter_5_monthly"
const SUPPORTER_5_YEARLY_PRICE_ID = "price_supporter_5_yearly"
const SUPPORTER_PRICE_FIXTURES = Object.freeze({
  [DEFAULT_SUPPORTER_PRICE_ID]: Object.freeze({ interval: "month", unitAmount: 100 }),
  [SUPPORTER_1_YEARLY_PRICE_ID]: Object.freeze({ interval: "year", unitAmount: 1000 }),
  [SUPPORTER_2_MONTHLY_PRICE_ID]: Object.freeze({ interval: "month", unitAmount: 200 }),
  [SUPPORTER_2_YEARLY_PRICE_ID]: Object.freeze({ interval: "year", unitAmount: 2000 }),
  [SUPPORTER_5_MONTHLY_PRICE_ID]: Object.freeze({ interval: "month", unitAmount: 500 }),
  [SUPPORTER_5_YEARLY_PRICE_ID]: Object.freeze({ interval: "year", unitAmount: 5000 }),
})

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

  it("rejects retired membership coupons before reconciliation or Checkout creation", async () => {
    let listCalls = 0
    let createCalls = 0

    await assert.rejects(
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        couponId: "coupon_retired",
        stripeClient: {
          checkout: {
            sessions: {
              list: async () => {
                listCalls += 1
                return stripeCheckoutSessionList()
              },
              create: async () => {
                createCalls += 1
                return membershipCheckoutSession()
              },
            },
          },
        },
      })),
      /Membership coupons are not supported/,
    )

    assert.equal(listCalls, 0)
    assert.equal(createCalls, 0)
  })

  it("creates Supporter Checkout with exclusive automatic tax and address collection", async () => {
    let capturedPayload = null

    await stripeBilling.createStripeCheckoutSession({
      customerId: "cus_123",
      priceId: DEFAULT_SUPPORTER_PRICE_ID,
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
      price: DEFAULT_SUPPORTER_PRICE_ID,
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

  it("fails closed on malformed membership Checkout Session pages", async () => {
    for (const [label, page] of [
      ["data", { object: "list", data: null, has_more: false }],
      ["has_more", { object: "list", data: [], has_more: "false" }],
    ]) {
      await assert.rejects(
        stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
          stripeClient: {
            checkout: {
              sessions: {
                list: async () => page,
              },
            },
          },
        })),
        /invalid Checkout Session page/,
        label,
      )
    }
  })

  it("fails closed when membership Checkout Session pagination repeats a cursor", async () => {
    let repeatedCalls = 0
    await assert.rejects(
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        stripeClient: {
          checkout: {
            sessions: {
              list: async () => {
                repeatedCalls += 1
                return {
                  ...stripeCheckoutSessionList([
                    membershipCheckoutSession({
                      id: "cs_repeated_cursor",
                      status: "expired",
                    }),
                  ]),
                  has_more: true,
                }
              },
            },
          },
        },
      })),
      /pagination did not advance/,
    )
    assert.equal(repeatedCalls, 2)
  })

  it("falls back to actionable statuses when expired history fills the mixed-session scan", async () => {
    const listCalls = { mixed: 0, open: 0, complete: 0 }
    let createOptions = null
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async (payload) => {
              if (payload.status === "open" || payload.status === "complete") {
                listCalls[payload.status] += 1
                return stripeCheckoutSessionList()
              }

              listCalls.mixed += 1
              return {
                ...stripeCheckoutSessionList([
                  membershipCheckoutSession({
                    id: `cs_expired_page_${listCalls.mixed}`,
                    status: "expired",
                    url: null,
                  }),
                ]),
                has_more: true,
              }
            },
            create: async (_payload, requestOptions) => {
              createOptions = requestOptions
              return membershipCheckoutSession({ id: "cs_after_expired_history" })
            },
          },
        },
      },
    }))

    assert.equal(result.id, "cs_after_expired_history")
    assert.deepEqual(listCalls, { mixed: 10, open: 1, complete: 1 })
    assert.deepEqual(createOptions, {
      idempotencyKey: "massagelab-membership-checkout:user_123:after:cs_expired_page_1",
    })
  })

  it("fails closed with a distinct error when one actionable status exceeds ten pages", async () => {
    const listCalls = { mixed: 0, open: 0, complete: 0 }
    let createCalls = 0

    await assert.rejects(
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        stripeClient: {
          checkout: {
            sessions: {
              list: async (payload) => {
                if (payload.status === "complete") {
                  listCalls.complete += 1
                  return stripeCheckoutSessionList()
                }
                if (payload.status === "open") {
                  listCalls.open += 1
                  return {
                    ...stripeCheckoutSessionList([
                      membershipCheckoutSession({
                        id: `cs_open_page_${listCalls.open}`,
                      }),
                    ]),
                    has_more: true,
                  }
                }

                listCalls.mixed += 1
                return {
                  ...stripeCheckoutSessionList([
                    membershipCheckoutSession({
                      id: `cs_expired_page_${listCalls.mixed}`,
                      status: "expired",
                      url: null,
                    }),
                  ]),
                  has_more: true,
                }
              },
              create: async () => {
                createCalls += 1
                return membershipCheckoutSession({ id: "cs_unexpected_create" })
              },
            },
          },
        },
      })),
      (error) => {
        assert.equal(error.name, "MembershipCheckoutSessionHistoryCapError")
        assert.equal(error.code, "membership_checkout_history_cap_exceeded")
        assert.match(error.message, /Stripe open membership Checkout Session history exceeded/)
        return true
      },
    )

    assert.deepEqual(listCalls, { mixed: 10, open: 10, complete: 1 })
    assert.equal(createCalls, 0)
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
    assert.equal(
      infoCalls.flat().some((value) => value instanceof Error),
      false,
      "observability must never pass a raw Error to the logger",
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
    assert.equal(warnCalls.flat().includes(rateLimitError), false)
    assert.equal(
      warnCalls.flat().some((value) => value instanceof Error),
      false,
      "observability must reduce processor errors to safe aggregate fields",
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
          priceId: DEFAULT_SUPPORTER_PRICE_ID,
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

  it("authorizes new Checkout only from one exact current configured Price slot", async () => {
    const invalidSelections = [
      {
        label: "unmapped Price",
        overrides: { priceId: "price_unmapped" },
        expected: /not in the current configured catalog/,
      },
      {
        label: "historical Supporter Price",
        overrides: {
          priceId: "price_supporter_historical",
          env: {
            ...supporterTaxEnv(),
            STRIPE_SUPPORTER_MONTHLY_PRICE_ID: "price_supporter_historical",
          },
        },
        expected: /not in the current configured catalog/,
      },
      {
        label: "duplicate current catalog Price",
        overrides: {
          env: {
            ...supporterTaxEnv(),
            STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: DEFAULT_SUPPORTER_PRICE_ID,
          },
        },
        expected: /not in the current configured catalog/,
      },
      {
        label: "caller-supplied level contradicts the configured Price",
        overrides: { membershipLevel: "THERAPIST" },
        expected: /does not match the requested membership level/,
      },
    ]

    for (const { label, overrides, expected } of invalidSelections) {
      let listCalls = 0
      let createCalls = 0
      await assert.rejects(
        stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
          ...overrides,
          stripeClient: {
            checkout: {
              sessions: {
                list: async () => {
                  listCalls += 1
                  return stripeCheckoutSessionList()
                },
                create: async () => {
                  createCalls += 1
                  return membershipCheckoutSession()
                },
              },
            },
          },
        })),
        expected,
        label,
      )
      assert.equal(listCalls, 0, label)
      assert.equal(createCalls, 0, label)
    }
  })

  it("normalizes the authoritative configured Price before Checkout metadata and line items", async () => {
    let capturedPayload
    const result = await stripeBilling.createStripeCheckoutSession(
      membershipCheckoutOptions({
        priceId: ` ${DEFAULT_SUPPORTER_PRICE_ID} `,
        stripeClient: {
          checkout: {
            sessions: {
              list: async () => stripeCheckoutSessionList(),
              create: async (payload) => {
                capturedPayload = payload
                return membershipCheckoutSession({ id: "cs_normalized_price" })
              },
            },
          },
        },
      }),
    )

    assert.equal(result.id, "cs_normalized_price")
    assert.equal(capturedPayload.line_items[0].price, DEFAULT_SUPPORTER_PRICE_ID)
    assert.equal(capturedPayload.metadata.membershipLevel, "SUPPORTER")
    assert.equal(capturedPayload.subscription_data.metadata.membershipLevel, "SUPPORTER")
  })

  it("serializes concurrent membership Checkout attempts for the same amount selection", async () => {
    const createdSessions = []
    const idempotentRequests = new Map()
    const stripeClient = {
      checkout: {
        sessions: {
          list: async () => stripeCheckoutSessionList(createdSessions),
          listLineItems: async () => stripeCheckoutLineItemList({
            priceId: SUPPORTER_2_MONTHLY_PRICE_ID,
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

    const [monthly, duplicateMonthly] = await Promise.all([
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        priceId: SUPPORTER_2_MONTHLY_PRICE_ID,
        stripeClient,
      })),
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        priceId: SUPPORTER_2_MONTHLY_PRICE_ID,
        stripeClient,
      })),
    ])

    assert.equal(createdSessions.length, 1)
    assert.equal(monthly.id, "cs_serialized")
    assert.equal(duplicateMonthly.id, "cs_serialized")
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
            priceId: SUPPORTER_2_MONTHLY_PRICE_ID,
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
              id: priceId === SUPPORTER_2_MONTHLY_PRICE_ID
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
        priceId: SUPPORTER_2_MONTHLY_PRICE_ID,
        stripeClient,
      })),
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        priceId: SUPPORTER_1_YEARLY_PRICE_ID,
        stripeClient,
      })),
    ])

    assert.equal(monthly.id, "cs_concurrent_monthly")
    assert.equal(yearly.id, "cs_concurrent_yearly")
    assert.deepEqual(expiredSessions, ["cs_concurrent_monthly"])
    assert.deepEqual(createAttempts, [
      {
        idempotencyKey: "massagelab-membership-checkout:user_123:after:initial",
        priceId: SUPPORTER_2_MONTHLY_PRICE_ID,
      },
      {
        idempotencyKey: "massagelab-membership-checkout:user_123:after:initial",
        priceId: SUPPORTER_1_YEARLY_PRICE_ID,
      },
      {
        idempotencyKey: "massagelab-membership-checkout:user_123:after:cs_concurrent_monthly",
        priceId: SUPPORTER_1_YEARLY_PRICE_ID,
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

  it("fails closed instead of reusing a compatible open membership Checkout without a URL", async () => {
    const openSession = membershipCheckoutSession({ id: "cs_open_no_url", url: null })
    let createCalls = 0

    await assert.rejects(
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        stripeClient: {
          checkout: {
            sessions: {
              list: async () => stripeCheckoutSessionList([openSession]),
              listLineItems: async () => stripeCheckoutLineItemList(),
              create: async () => {
                createCalls += 1
                return membershipCheckoutSession({ id: "cs_unexpected" })
              },
            },
          },
        },
      })),
      /open Checkout Session without a URL/,
    )
    assert.equal(createCalls, 0)
  })

  it("fails closed on malformed membership Checkout line-item pages", async () => {
    const openSession = membershipCheckoutSession({ id: "cs_open_malformed_items" })
    for (const [label, page] of [
      ["data", { object: "list", data: null, has_more: false }],
      ["has_more", { object: "list", data: [], has_more: "false" }],
    ]) {
      await assert.rejects(
        stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
          stripeClient: {
            checkout: {
              sessions: {
                list: async () => stripeCheckoutSessionList([openSession]),
                listLineItems: async () => page,
              },
            },
          },
        })),
        /invalid membership Checkout line-item page/,
        label,
      )
    }
  })

  it("fails closed when membership Checkout line-item pagination repeats or exceeds ten pages", async () => {
    const openSession = membershipCheckoutSession({ id: "cs_open_item_pages" })
    let repeatedCalls = 0
    await assert.rejects(
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        stripeClient: {
          checkout: {
            sessions: {
              list: async () => stripeCheckoutSessionList([openSession]),
              listLineItems: async () => {
                repeatedCalls += 1
                return {
                  ...stripeCheckoutLineItemList(),
                  has_more: true,
                }
              },
            },
          },
        },
      })),
      /line-item pagination did not advance/,
    )
    assert.equal(repeatedCalls, 2)

    let cappedCalls = 0
    await assert.rejects(
      stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
        stripeClient: {
          checkout: {
            sessions: {
              list: async () => stripeCheckoutSessionList([openSession]),
              listLineItems: async () => {
                cappedCalls += 1
                const page = stripeCheckoutLineItemList()
                page.data[0].id = `li_page_${cappedCalls}`
                return { ...page, has_more: true }
              },
            },
          },
        },
      })),
      /line-item pagination exceeded the safe limit/,
    )
    assert.equal(cappedCalls, 10)
  })

  it("bounds compatibility reads while preserving ordered reuse and stale expiry", async () => {
    const sessions = [
      {
        ...membershipCheckoutSession({ id: "cs_reuse_first" }),
        created: 1784912404,
      },
      {
        ...membershipCheckoutSession({ id: "cs_stale_first" }),
        created: 1784912403,
      },
      {
        ...membershipCheckoutSession({ id: "cs_reuse_duplicate" }),
        created: 1784912402,
      },
      {
        ...membershipCheckoutSession({ id: "cs_stale_second" }),
        created: 1784912401,
      },
    ]
    const compatibleSessionIds = new Set([
      "cs_reuse_first",
      "cs_reuse_duplicate",
    ])
    const classificationGates = new Map(
      sessions.map(({ id }) => [id, deferred()]),
    )
    const initialWorkersStarted = deferred()
    const fourthWorkerStarted = deferred()
    const events = []
    let classificationStarts = 0
    let activeCompatibilityReads = 0
    let maximumCompatibilityReads = 0
    let createCalls = 0

    const resultPromise = stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList(sessions),
            listLineItems: async (sessionId) => {
              events.push(`classify:start:${sessionId}`)
              classificationStarts += 1
              activeCompatibilityReads += 1
              maximumCompatibilityReads = Math.max(
                maximumCompatibilityReads,
                activeCompatibilityReads,
              )
              if (classificationStarts === 3) initialWorkersStarted.resolve()
              if (sessionId === "cs_stale_second") fourthWorkerStarted.resolve()
              await classificationGates.get(sessionId).promise
              activeCompatibilityReads -= 1
              events.push(`classify:end:${sessionId}`)
              return stripeCheckoutLineItemList({
                priceId: compatibleSessionIds.has(sessionId)
                  ? DEFAULT_SUPPORTER_PRICE_ID
                  : SUPPORTER_2_MONTHLY_PRICE_ID,
              })
            },
            expire: async (sessionId) => {
              events.push(`expire:${sessionId}`)
              return { id: sessionId, object: "checkout.session", status: "expired" }
            },
            retrieve: async (sessionId) => {
              events.push(`retrieve:${sessionId}`)
              return { id: sessionId, object: "checkout.session", status: "expired" }
            },
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_unexpected_create" })
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

    await initialWorkersStarted.promise
    assert.deepEqual(
      events.filter((event) => event.startsWith("classify:start:")),
      [
        "classify:start:cs_reuse_first",
        "classify:start:cs_stale_first",
        "classify:start:cs_reuse_duplicate",
      ],
    )
    assert.equal(activeCompatibilityReads, 3)

    classificationGates.get("cs_reuse_duplicate").resolve()
    await fourthWorkerStarted.promise
    classificationGates.get("cs_stale_first").resolve()
    classificationGates.get("cs_stale_second").resolve()
    classificationGates.get("cs_reuse_first").resolve()

    const result = await resultPromise
    assert.equal(result.id, "cs_reuse_first")
    assert.equal(maximumCompatibilityReads, 3)
    assert.ok(
      events.indexOf("classify:end:cs_reuse_duplicate")
        < events.indexOf("classify:end:cs_reuse_first"),
    )
    assert.deepEqual(
      events.filter((event) => event.startsWith("expire:")),
      [
        "expire:cs_stale_first",
        "expire:cs_reuse_duplicate",
        "expire:cs_stale_second",
      ],
    )
    const firstExpiryIndex = events.findIndex((event) => event.startsWith("expire:"))
    const lastClassificationIndex = events.reduce(
      (latest, event, index) => (
        event.startsWith("classify:end:") ? index : latest
      ),
      -1,
    )
    assert.ok(firstExpiryIndex > lastClassificationIndex)
    assert.equal(createCalls, 0)
  })

  it("expires an open membership Checkout Session when the requested amount changes", async () => {
    const openSession = membershipCheckoutSession({ id: "cs_open_monthly" })
    const calls = []
    let createdPayload = null
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      priceId: SUPPORTER_1_YEARLY_PRICE_ID,
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([openSession]),
            listLineItems: async () => stripeCheckoutLineItemList({
              priceId: SUPPORTER_2_MONTHLY_PRICE_ID,
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
    assert.equal(createdPayload.line_items[0].price, SUPPORTER_1_YEARLY_PRICE_ID)
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

  it("blocks Checkout when legacy expiration confirmation races with completion", async () => {
    const legacySession = membershipCheckoutSession({
      id: "cs_legacy_completion_race",
      purpose: null,
    })
    const completedSession = membershipCheckoutSession({
      id: legacySession.id,
      purpose: null,
      status: "complete",
      subscription: "sub_legacy_completion_race",
      url: null,
    })
    const calls = []
    let createCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => stripeCheckoutSessionList([legacySession]),
            expire: async (sessionId) => {
              calls.push(["expire", sessionId])
              return { id: sessionId, object: "checkout.session", status: "expired" }
            },
            retrieve: async (sessionId) => {
              calls.push(["retrieve", sessionId])
              return completedSession
            },
            create: async () => {
              createCalls += 1
              return membershipCheckoutSession({ id: "cs_duplicate" })
            },
          },
        },
        subscriptions: {
          retrieve: async (subscriptionId) => {
            calls.push(["subscription", subscriptionId])
            return membershipStripeSubscription({ id: subscriptionId })
          },
        },
      },
    }))

    assert.equal(result.id, completedSession.id)
    assert.equal(result.status, "complete")
    assert.deepEqual(calls, [
      ["expire", legacySession.id],
      ["retrieve", legacySession.id],
      ["subscription", "sub_legacy_completion_race"],
    ])
    assert.equal(createCalls, 0)
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

  it("rotates the user-scoped key when create recovery finds a newer anchor", async () => {
    const recoveredAnchor = membershipCheckoutSession({
      id: "cs_recovered_anchor",
      status: "expired",
      url: null,
    })
    const createAttempts = []
    let listCalls = 0
    const result = await stripeBilling.createStripeCheckoutSession(membershipCheckoutOptions({
      stripeClient: {
        checkout: {
          sessions: {
            list: async () => {
              listCalls += 1
              return stripeCheckoutSessionList(
                listCalls === 1 ? [] : [recoveredAnchor],
              )
            },
            create: async (_payload, requestOptions) => {
              createAttempts.push(requestOptions.idempotencyKey)
              if (createAttempts.length === 1) {
                throw Object.assign(new Error("connection closed after create"), {
                  type: "StripeConnectionError",
                })
              }
              return membershipCheckoutSession({ id: "cs_recovered_create" })
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

    assert.equal(result.id, "cs_recovered_create")
    assert.deepEqual(createAttempts, [
      "massagelab-membership-checkout:user_123:after:initial",
      "massagelab-membership-checkout:user_123:after:cs_recovered_anchor",
    ])
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

  it("reconciles membership level from the Price mapping instead of subscription metadata", async () => {
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
        metadata: { userId: "user_123", membershipLevel: "SUPPORTER" },
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

  it("fails closed on malformed background fulfillment line-item pages", async () => {
    for (const [label, page] of [
      ["data", { object: "list", data: null, has_more: false }],
      ["has_more", { object: "list", data: [], has_more: "false" }],
    ]) {
      await assert.rejects(
        stripeBilling.retrieveBackgroundPurchaseCheckoutSessionForFulfillment(
          "cs_background",
          {
            stripeClient: {
              checkout: {
                sessions: {
                  retrieve: async (sessionId) => ({ id: sessionId }),
                  listLineItems: async () => page,
                },
              },
            },
          },
        ),
        /invalid Checkout line-item page/,
        label,
      )
    }
  })

  it("fails closed when background fulfillment pagination repeats or exceeds ten pages", async () => {
    let repeatedCalls = 0
    await assert.rejects(
      stripeBilling.retrieveBackgroundPurchaseCheckoutSessionForFulfillment(
        "cs_background",
        {
          stripeClient: {
            checkout: {
              sessions: {
                retrieve: async (sessionId) => ({ id: sessionId }),
                listLineItems: async () => {
                  repeatedCalls += 1
                  return {
                    object: "list",
                    data: [{ id: "li_repeated_cursor" }],
                    has_more: true,
                  }
                },
              },
            },
          },
        },
      ),
      /pagination did not advance/,
    )
    assert.equal(repeatedCalls, 2)

    let cappedCalls = 0
    await assert.rejects(
      stripeBilling.retrieveBackgroundPurchaseCheckoutSessionForFulfillment(
        "cs_background",
        {
          stripeClient: {
            checkout: {
              sessions: {
                retrieve: async (sessionId) => ({ id: sessionId }),
                listLineItems: async () => {
                  cappedCalls += 1
                  return {
                    object: "list",
                    data: [{ id: `li_page_${cappedCalls}` }],
                    has_more: true,
                  }
                },
              },
            },
          },
        },
      ),
      /pagination exceeded the safe limit/,
    )
    assert.equal(cappedCalls, 10)
  })
})

/** Returns the complete test-only environment for the current Supporter catalog. */
function supporterTaxEnv() {
  return {
    STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: DEFAULT_SUPPORTER_PRICE_ID,
    STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: SUPPORTER_1_YEARLY_PRICE_ID,
    STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: SUPPORTER_2_MONTHLY_PRICE_ID,
    STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: SUPPORTER_2_YEARLY_PRICE_ID,
    STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: SUPPORTER_5_MONTHLY_PRICE_ID,
    STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: SUPPORTER_5_YEARLY_PRICE_ID,
    STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED: "true",
    STRIPE_SUPPORTER_TAX_PRODUCT_CODE: SUPPORTER_RECURRING_TAX_CODE,
    STRIPE_SUPPORTER_TAX_PROVIDER_READY: "true",
    STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY: "true",
    STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED: "true",
  }
}

/** Builds one valid membership Checkout request with narrow per-test overrides. */
function membershipCheckoutOptions(overrides = {}) {
  return {
    customerId: "cus_123",
    priceId: DEFAULT_SUPPORTER_PRICE_ID,
    userId: "user_123",
    membershipLevel: "SUPPORTER",
    successUrl: "https://massagelab.app/account?checkout=success",
    cancelUrl: "https://massagelab.app/account?checkout=cancelled",
    env: supporterTaxEnv(),
    ...overrides,
  }
}

/** Builds a Stripe subscription whose configured Price is normalization authority. */
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
          id: DEFAULT_SUPPORTER_PRICE_ID,
          product: "prod_supporter",
        },
      }],
    },
  }
}

/** Builds a MassageLab-owned membership Checkout Session response. */
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

/** Wraps Checkout Sessions in Stripe's paginated list envelope. */
function stripeCheckoutSessionList(data = []) {
  return {
    object: "list",
    data,
    has_more: false,
    url: "/v1/checkout/sessions",
  }
}

/**
 * Builds one expanded line item whose billing evidence derives from its
 * configured Price ID, preventing contradictory amount/interval fixtures.
 */
function stripeCheckoutLineItemList({
  priceId = DEFAULT_SUPPORTER_PRICE_ID,
  productCatalog = SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
} = {}) {
  const priceFixture = SUPPORTER_PRICE_FIXTURES[priceId]
  assert.ok(priceFixture, `Missing Supporter Price fixture for ${priceId}`)
  const { interval, unitAmount } = priceFixture

  return {
    object: "list",
    data: [{
      id: "li_membership",
      object: "item",
      amount_discount: 0,
      amount_subtotal: unitAmount,
      amount_tax: 0,
      amount_total: unitAmount,
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
          tax_code: SUPPORTER_RECURRING_TAX_CODE,
        },
        recurring: {
          interval,
          interval_count: 1,
          trial_period_days: null,
          usage_type: "licensed",
        },
        tax_behavior: SUPPORTER_RECURRING_TAX_BEHAVIOR,
        transform_quantity: null,
        type: "recurring",
        unit_amount: unitAmount,
        unit_amount_decimal: String(unitAmount),
      },
      quantity: 1,
    }],
    has_more: false,
    url: "/v1/checkout/sessions/cs_membership/line_items",
  }
}

/** Creates a manually released Promise for deterministic concurrency tests. */
function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
