import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { BILLING_PORTAL_DESTINATIONS } from "../lib/billing-portal-destinations.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const portalRouteSource = await readFile(
  new URL("../app/api/billing/portal/route.ts", import.meta.url),
  "utf8",
)

function portalRequest(destination, { rejectFormData = false } = {}) {
  return {
    formData: async () => {
      if (rejectFormData) {
        throw new TypeError("Malformed form body")
      }
      const formData = new FormData()
      if (destination) formData.set("destination", destination)
      return formData
    },
  }
}

/**
 * Loads the production route with deterministic account, subscription, and
 * Stripe doubles so each action can assert its exact Portal boundary.
 */
function portalPost({
  customer = {
    stripeCustomerId: "cus_supporter",
  },
  portalSession = {
    url: "https://billing.stripe.com/p/session/supporter",
  },
  session = {
    user: {
      id: "user_supporter",
    },
  },
  subscription = {
    stripeSubscriptionId: "sub_supporter",
    status: "active",
  },
} = {}) {
  const calls = {
    customerQueries: [],
    portalInputs: [],
    subscriptionQueries: [],
  }
  const route = loadCompiledModule(
    portalRouteSource,
    "app/api/billing/portal/route.ts",
    {
      "next/server": {
        NextResponse: {
          redirect: (url, status) => ({ status, url }),
        },
      },
      "@/auth": {
        getCurrentSession: async () => session,
      },
      "@/lib/auth-env": {
        getSiteUrl: () => "https://massagelab.app",
      },
      "@/lib/billing-portal-destinations": {
        BILLING_PORTAL_DESTINATIONS,
      },
      "@/lib/prisma": {
        prisma: {
          membershipSubscription: {
            findFirst: async (query) => {
              calls.subscriptionQueries.push(query)
              if (
                subscription
                && Array.isArray(query?.where?.status?.in)
                && !query.where.status.in.includes(subscription.status)
              ) {
                return null
              }
              return subscription
            },
          },
          stripeCustomer: {
            findUnique: async (query) => {
              calls.customerQueries.push(query)
              return customer
            },
          },
        },
      },
      "@/lib/stripe-billing": {
        createStripeCustomerPortalSession: async (input) => {
          calls.portalInputs.push(input)
          return portalSession
        },
      },
    },
  )

  return {
    calls,
    POST: route.POST,
  }
}

describe("Customer Portal POST route", () => {
  it("opens the general billing-account Portal without querying a subscription", async () => {
    const { calls, POST } = portalPost()

    const response = await POST(portalRequest("manage"))

    assert.deepEqual(response, {
      status: 303,
      url: "https://billing.stripe.com/p/session/supporter",
    })
    assert.deepEqual(calls.customerQueries, [{
      where: { userId: "user_supporter" },
    }])
    assert.deepEqual(calls.subscriptionQueries, [])
    assert.deepEqual(calls.portalInputs, [{
      customerId: "cus_supporter",
      returnUrl: "https://massagelab.app/account?portal=returned",
      subscriptionId: undefined,
    }])
  })

  it("opens Stripe's direct price-selection flow for the current subscription", async () => {
    const { calls, POST } = portalPost()

    const response = await POST(portalRequest("subscription-update"))

    assert.deepEqual(response, {
      status: 303,
      url: "https://billing.stripe.com/p/session/supporter",
    })
    assert.deepEqual(calls.subscriptionQueries, [{
      where: {
        userId: "user_supporter",
        stripeCustomerId: "cus_supporter",
        status: {
          in: ["active", "trialing"],
        },
      },
      orderBy: [
        { currentPeriodEnd: "desc" },
        { updatedAt: "desc" },
      ],
      select: {
        stripeSubscriptionId: true,
      },
    }])
    assert.deepEqual(calls.portalInputs, [{
      customerId: "cus_supporter",
      returnUrl: "https://massagelab.app/account?portal=returned",
      subscriptionId: "sub_supporter",
    }])
  })

  it("fails closed before Stripe when no current subscription can be changed", async () => {
    const { calls, POST } = portalPost({ subscription: null })

    const response = await POST(portalRequest("subscription-update"))

    assert.deepEqual(response, {
      status: 303,
      url: "https://massagelab.app/account?portal=subscription-not-found",
    })
    assert.equal(calls.subscriptionQueries.length, 1)
    assert.deepEqual(calls.portalInputs, [])
  })

  it("rejects incomplete and paused subscriptions from the focused change flow", async () => {
    for (const status of ["incomplete", "paused"]) {
      const { calls, POST } = portalPost({
        subscription: {
          stripeSubscriptionId: `sub_${status}`,
          status,
        },
      })

      const response = await POST(portalRequest("subscription-update"))

      assert.deepEqual(response, {
        status: 303,
        url: "https://massagelab.app/account?portal=subscription-not-found",
      })
      assert.equal(calls.subscriptionQueries.length, 1)
      assert.deepEqual(calls.portalInputs, [])
    }
  })

  it("defaults malformed or unknown form destinations to general management", async () => {
    for (const request of [
      portalRequest("unexpected"),
      portalRequest(null, { rejectFormData: true }),
    ]) {
      const { calls, POST } = portalPost()
      const response = await POST(request)

      assert.deepEqual(response, {
        status: 303,
        url: "https://billing.stripe.com/p/session/supporter",
      })
      assert.deepEqual(calls.subscriptionQueries, [])
      assert.equal(calls.portalInputs.length, 1)
      assert.equal(calls.portalInputs[0].subscriptionId, undefined)
    }
  })

  it("requires a signed-in account with a stored Stripe Customer", async () => {
    const anonymous = portalPost({ session: null })
    const anonymousResponse = await anonymous.POST(
      portalRequest("subscription-update"),
    )

    assert.deepEqual(anonymousResponse, {
      status: 303,
      url: "https://massagelab.app/login",
    })
    assert.deepEqual(anonymous.calls.customerQueries, [])
    assert.deepEqual(anonymous.calls.subscriptionQueries, [])
    assert.deepEqual(anonymous.calls.portalInputs, [])

    const withoutCustomer = portalPost({ customer: null })
    const withoutCustomerResponse = await withoutCustomer.POST(
      portalRequest("subscription-update"),
    )

    assert.deepEqual(withoutCustomerResponse, {
      status: 303,
      url: "https://massagelab.app/account?portal=customer-not-found",
    })
    assert.deepEqual(withoutCustomer.calls.subscriptionQueries, [])
    assert.deepEqual(withoutCustomer.calls.portalInputs, [])
  })
})
