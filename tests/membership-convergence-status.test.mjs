import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  buildMembershipConvergenceStatus,
  getMembershipConvergenceStatus,
} from "../lib/membership-convergence.ts"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

function subscription({
  status = "active",
  updatedAt = "2026-08-29T12:00:00.000Z",
  currentPeriodEnd = "2026-09-29T12:00:00.000Z",
  cancelAtPeriodEnd = false,
} = {}) {
  return {
    id: "database-row-1",
    stripeSubscriptionId: "provider-subscription-sentinel",
    stripeCustomerId: "provider-customer-sentinel",
    lastStripeEventId: "provider-event-sentinel",
    status,
    membershipLevel: "SUPPORTER",
    updatedAt: new Date(updatedAt),
    currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
    cancelAtPeriodEnd,
  }
}

function summary({
  paidLevel = "SUPPORTER",
  features = ["calendar_basic_scheduling", "premium_backgrounds"],
  subscriptions = [subscription()],
  stripeCustomer = { stripeCustomerId: "provider-customer-sentinel" },
} = {}) {
  return {
    stripeCustomer,
    subscriptions,
    entitlements: {
      paidLevel,
      features,
    },
  }
}

describe("persisted membership convergence status", () => {
  it("projects active feature-key access and ISO persistence evidence without provider identifiers", () => {
    const status = buildMembershipConvergenceStatus(summary({
      subscriptions: [subscription({ cancelAtPeriodEnd: true })],
    }))

    assert.deepEqual(status, {
      state: "active",
      paidLevel: "SUPPORTER",
      featureKeys: ["calendar_basic_scheduling", "premium_backgrounds"],
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-09-29T12:00:00.000Z",
      revision: "2026-08-29T12:00:00.000Z",
      portalAvailable: true,
    })
    assert.deepEqual(Object.keys(status), [
      "state",
      "paidLevel",
      "featureKeys",
      "subscriptionStatus",
      "cancelAtPeriodEnd",
      "currentPeriodEnd",
      "revision",
      "portalAvailable",
    ])
    assert.doesNotMatch(JSON.stringify(status), /provider-(?:subscription|customer|event)-sentinel/)
  })

  it("uses the newest persisted revision for billing attention instead of display ordering", () => {
    for (const attentionStatus of ["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      const status = buildMembershipConvergenceStatus(summary({
        paidLevel: null,
        features: ["calendar_basic_scheduling"],
        subscriptions: [
          subscription({
            status: "active",
            updatedAt: "2026-08-29T11:00:00.000Z",
          }),
          subscription({
            status: attentionStatus,
            updatedAt: "2026-08-29T13:00:00.000Z",
            currentPeriodEnd: null,
          }),
        ],
      }))

      assert.equal(status.state, "billing-attention")
      assert.equal(status.subscriptionStatus, attentionStatus)
      assert.equal(status.revision, "2026-08-29T13:00:00.000Z")
      assert.equal(status.currentPeriodEnd, null)
      assert.equal(status.paidLevel, null)
    }
  })

  it("prefers valid persisted revisions to invalid dates in either input order", () => {
    const invalidRevision = subscription({
      status: "canceled",
      updatedAt: "not-a-date",
      currentPeriodEnd: null,
    })
    const validRevision = subscription({
      status: "past_due",
      updatedAt: "2026-08-29T13:00:00.000Z",
      currentPeriodEnd: null,
    })

    const projections = [
      [invalidRevision, validRevision],
      [validRevision, invalidRevision],
    ].map((subscriptions) => {
      const status = buildMembershipConvergenceStatus(summary({
        paidLevel: null,
        features: [],
        subscriptions,
      }))
      return {
        state: status.state,
        subscriptionStatus: status.subscriptionStatus,
        revision: status.revision,
      }
    })

    assert.deepEqual(projections, [
      {
        state: "billing-attention",
        subscriptionStatus: "past_due",
        revision: "2026-08-29T13:00:00.000Z",
      },
      {
        state: "billing-attention",
        subscriptionStatus: "past_due",
        revision: "2026-08-29T13:00:00.000Z",
      },
    ])
  })

  it("reports no active membership and Portal availability independently", () => {
    assert.deepEqual(buildMembershipConvergenceStatus(summary({
      paidLevel: null,
      features: ["calendar_basic_scheduling"],
      subscriptions: [subscription({ status: "canceled", currentPeriodEnd: null })],
      stripeCustomer: null,
    })), {
      state: "no-active-membership",
      paidLevel: null,
      featureKeys: ["calendar_basic_scheduling"],
      subscriptionStatus: "canceled",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      revision: "2026-08-29T12:00:00.000Z",
      portalAvailable: false,
    })

    const empty = buildMembershipConvergenceStatus(summary({
      paidLevel: null,
      features: [],
      subscriptions: [],
    }))
    assert.equal(empty.state, "no-active-membership")
    assert.equal(empty.subscriptionStatus, null)
    assert.equal(empty.revision, null)
    assert.equal(empty.portalAvailable, true)
  })

  it("loads the persisted membership summary exactly once", async () => {
    const calls = []
    const expectedSummary = summary()
    const now = new Date("2026-08-29T12:30:00.000Z")
    const status = await getMembershipConvergenceStatus({
      prismaClient: { sentinel: true },
      userId: "user-1",
      now,
      getMembershipSummary: async (...args) => {
        calls.push(args)
        return expectedSummary
      },
    })

    assert.equal(status.state, "active")
    assert.deepEqual(calls, [[{ sentinel: true }, "user-1", now]])
  })
})

describe("private membership status endpoint", () => {
  async function loadRoute({
    session,
    sessionError = null,
    projectedStatus = buildMembershipConvergenceStatus(summary()),
    statusError = null,
  } = {}) {
    const routeSource = await readFile(
      new URL("../app/api/billing/membership-status/route.ts", import.meta.url),
      "utf8",
    )
    const calls = []
    const route = loadCompiledModule(routeSource, "app/api/billing/membership-status/route.ts", {
      "next/server": {
        NextResponse: {
          json(body, init = {}) {
            return new Response(JSON.stringify(body), {
              status: init.status ?? 200,
              headers: init.headers,
            })
          },
        },
      },
      "@/auth": {
        getCurrentSession: async () => {
          if (sessionError) throw sessionError
          return session
        },
      },
      "@/lib/membership-convergence": {
        getMembershipConvergenceStatus: async (input) => {
          calls.push(input)
          if (statusError) throw statusError
          return projectedStatus
        },
      },
      "@/lib/prisma": {
        prisma: { sentinel: "database-only" },
      },
    })
    return { calls, GET: route.GET, routeSource }
  }

  it("returns a private no-store 401 without loading membership state", async () => {
    const { calls, GET } = await loadRoute({ session: null })
    const response = await GET(new Request("https://massagelab.app/api/billing/membership-status?session_id=ignored"))

    assert.equal(response.status, 401)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.deepEqual(await response.json(), { error: "Unauthorized" })
    assert.deepEqual(calls, [])
  })

  it("keeps a rejected session lookup private and does not load membership state", async () => {
    const { calls, GET } = await loadRoute({
      sessionError: new Error("session store unavailable with private details"),
    })

    const response = await GET()

    assert.equal(response.status, 503)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.deepEqual(await response.json(), { error: "Membership status unavailable" })
    assert.deepEqual(calls, [])
  })

  it("returns one database-only projection and ignores submitted provider or Session identifiers", async () => {
    const { calls, GET, routeSource } = await loadRoute({
      session: { user: { id: "user-1" } },
    })
    let bodyReads = 0
    const response = await GET({
      url: "https://massagelab.app/api/billing/membership-status?session_id=ignored&subscription_id=ignored&event_id=ignored",
      async json() {
        bodyReads += 1
        return { session_id: "ignored", customer_id: "ignored" }
      },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.equal(bodyReads, 0)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], {
      prismaClient: { sentinel: "database-only" },
      userId: "user-1",
    })
    assert.equal((await response.json()).state, "active")
    assert.doesNotMatch(routeSource, /stripe|session_id|customer_id|subscription_id|event_id/i)
  })

  it("keeps a failed persisted read private and retryable", async () => {
    const { GET } = await loadRoute({
      session: { user: { id: "user-1" } },
      statusError: new Error("database unavailable"),
    })

    const response = await GET()

    assert.equal(response.status, 503)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.deepEqual(await response.json(), { error: "Membership status unavailable" })
  })
})
