import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { BILLING_PORTAL_DESTINATIONS } from "../lib/billing-portal-destinations.js"
import { projectAccountShellAppSettings } from "../lib/account-shell-bootstrap.js"
import { createMembershipCheckoutPostHandler } from "../lib/membership-checkout.js"
import { getMembershipConvergenceStatus } from "../lib/membership-convergence.ts"
import { hasSubscriptionBlockingNewCheckout } from "../lib/membership.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const [
  authUsersSource,
  sidebarSource,
  pricingPageSource,
  portalRouteSource,
  accountSurfaceDataSource,
  membershipSource,
  stripeBillingSource,
] = await Promise.all([
  readFile(new URL("../lib/auth-users.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/sidebar/sidebar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/billing/portal/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/account-surface-data.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/membership.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/stripe-billing.js", import.meta.url), "utf8"),
])

/** Returns one named function body bounded by the next named owner. */
function namedFunctionSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `missing function marker: ${startMarker}`)
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : source.length
  assert.notEqual(end, -1, `missing function boundary: ${endMarker}`)
  return source.slice(start, end)
}

function callCount(source, callPattern) {
  return source.match(callPattern)?.length ?? 0
}

function authSnapshotWorkload(calls) {
  const database = {
    user: {
      async findUnique() {
        calls.userGraphReads += 1
        return {
          email: "workload@example.test",
          emailVerified: new Date("2026-08-29T12:00:00.000Z"),
          authSessionVersion: 0,
          roles: [{ role: "USER", status: "VERIFIED" }],
          membershipSubscriptions: [],
          studentAccess: null,
          twoFactorSecret: null,
        }
      },
    },
    userRole: { findUnique: async () => null, upsert: async () => {} },
  }
  const loadTemporaryGrants = async (receivedDatabase) => {
    assert.equal(receivedDatabase, database)
    calls.temporaryGrantReads += 1
    return []
  }
  const { getUserAuthState } = loadCompiledModule(authUsersSource, "lib/auth-users.workload.test.ts", {
    "@/lib/auth-env": { isAdminEmail: () => false },
    "@/lib/account-permissions": {
      buildAccountCapabilities: (_roles, input) => ({ featureCount: input.features.length }),
      highestRole: () => "USER",
      normalizeRoleAssignments: (roles) => roles,
    },
    "@/lib/commerce/transactions": { runCommerceTransaction: async () => {} },
    "@/lib/membership": {
      buildEntitlements: () => {
        calls.entitlementBuilds += 1
        return { features: ["calendar_basic"] }
      },
      loadActiveTemporaryGrants: loadTemporaryGrants,
    },
    "@/lib/phi-sync": { isHostedClinicalSyncEnabled: () => false },
    "@/lib/prisma": { prisma: database },
  })
  return { database, getUserAuthState, loadTemporaryGrants }
}

function sidebarNavigationWorkload(calls) {
  const database = {
    userPreference: {
      async findUnique() {
        calls.preferenceReads += 1
        return {
          appSettings: {
            appBarPosition: "top",
            sidebarPosition: "right",
            themeMode: "system",
            musicVisualizer: {
              defaultBackgroundId: "aurora",
              showClock: true,
              token: "must-not-cross",
            },
            onboarding: { primaryRole: "therapist" },
            soapDraft: "must-not-cross",
          },
        }
      },
    },
    practiceMembership: {
      async findMany() {
        calls.practiceRoleReads += 1
        return []
      },
    },
    membershipSubscription: {
      async findMany() {
        calls.entitlementReads += 1
        return []
      },
    },
    studentAccess: {
      async findUnique() {
        calls.entitlementReads += 1
        return null
      },
    },
    temporaryFeatureGrant: {
      async findMany() {
        calls.entitlementReads += 1
        return []
      },
    },
    userRole: {
      async findMany() {
        calls.entitlementReads += 1
        return []
      },
    },
  }
  const compiled = loadCompiledModule(sidebarSource, "components/sidebar/sidebar.workload.test.tsx", {
    "@/auth": {
      getCurrentSession: async () => {
        calls.authSnapshots += 1
        return {
          user: {
            id: "workload-user",
            name: "Workload Test",
            email: "workload@example.test",
            featureKeys: ["calendar_basic"],
          },
        }
      },
    },
    "@/components/sidebar/app-sidebar-client": { AppSidebarClient: () => null },
    "@/lib/account-preferences": { canSyncAccountPreferences: () => true },
    "@/lib/account-shell-bootstrap": { projectAccountShellAppSettings },
    "@/lib/membership": { FEATURE_KEYS: { therapistDocumentationTools: "therapist_documentation_tools" } },
    "@/lib/navigation": { resolveNavigation: (context) => context },
    "@/lib/prisma": { prisma: database },
  })
  return { getAppSidebarData: compiled.getAppSidebarData }
}

function membershipSummary() {
  return {
    stripeCustomer: { stripeCustomerId: "provider-customer-sentinel" },
    subscriptions: [{
      status: "active",
      membershipLevel: "SUPPORTER",
      updatedAt: new Date("2026-08-29T12:00:00.000Z"),
      currentPeriodEnd: new Date("2026-09-29T12:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }],
    entitlements: {
      paidLevel: "SUPPORTER",
      features: ["premium_backgrounds"],
    },
  }
}

function validCheckoutRequest() {
  return new Request("https://massagelab.app/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      membershipLevel: "SUPPORTER",
      supporterAmountChoiceId: "support-1",
      interval: "month",
      acceptedLegalDocuments: ["membership-billing-refunds:current"],
      billingTermsAccepted: true,
    }),
  })
}

function checkoutDependencies(calls) {
  const requiredDocument = Object.freeze({
    key: "membership-billing-refunds",
    version: "current",
  })
  return {
    NextResponse: {
      json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
      redirect: (url, status) => ({ url, status }),
    },
    getCurrentSession: async () => ({ user: { id: "workload-user" } }),
    getPublicLaunchControls: () => ({ supporterCheckoutOpen: true }),
    getSiteUrl: () => "https://massagelab.app",
    isPublicSupporterCheckoutSelection: (input) => (
      input.membershipLevel === "SUPPORTER"
      && input.supporterAmountChoiceId === "support-1"
    ),
    resolveStripePriceId: () => "price_supporter_month",
    acceptedDocumentIdsFromInput: (ids) => ids,
    hasAcceptedCurrentDocuments: async () => true,
    legalRequestMetadata: () => ({ source: "family-friends-workload-test" }),
    missingRequiredLegalDocuments: () => [],
    recordLegalAcceptances: async () => {},
    requiredLegalDocumentsForEvent: () => [requiredDocument],
    hasSubscriptionBlockingNewCheckout,
    prisma: {
      membershipSubscription: { findMany: async () => [] },
      user: {
        findUnique: async () => ({
          id: "workload-user",
          email: "workload@example.test",
          name: "Workload Test",
        }),
      },
    },
    ensureStripeCustomerForUser: async () => ({ stripeCustomerId: "cus_workload" }),
    createStripeCheckoutSession: async () => {
      calls.checkoutSessionCreates += 1
      return { status: "open", url: "https://checkout.stripe.test/session" }
    },
  }
}

function portalPost(calls) {
  return loadCompiledModule(portalRouteSource, "app/api/billing/portal/route.ts", {
    "next/server": {
      NextResponse: { redirect: (url, status) => ({ url, status }) },
    },
    "@/auth": {
      getCurrentSession: async () => ({ user: { id: "workload-user" } }),
    },
    "@/lib/auth-env": {
      getSiteUrl: () => "https://massagelab.app",
    },
    "@/lib/billing-portal-destinations": {
      BILLING_PORTAL_DESTINATIONS,
    },
    "@/lib/prisma": {
      prisma: {
        stripeCustomer: {
          findUnique: async () => ({ stripeCustomerId: "cus_workload" }),
        },
        membershipSubscription: {
          findFirst: async () => null,
        },
      },
    },
    "@/lib/stripe-billing": {
      createStripeCustomerPortalSession: async () => {
        calls.portalSessionCreates += 1
        return { url: "https://billing.stripe.test/session" }
      },
    },
  }).POST
}

describe("family-and-friends server workload baseline", () => {
  it("keeps the shared display catalog out of membership, entitlement, and customer authority", () => {
    assert.match(pricingPageSource, /import\s*\{\s*getMembershipPricingCatalog\s*\}\s*from\s*["']@\/lib\/membership-pricing["']/)
    assert.match(accountSurfaceDataSource, /import\s*\{\s*getMembershipPricingCatalog\s*\}\s*from\s*["']\.\/membership-pricing\.js["']/)
    assert.doesNotMatch(membershipSource, /membership-pricing(?:\.js)?["']/)
    assert.doesNotMatch(stripeBillingSource, /membership-pricing(?:\.js)?["']/)
  })

  it("locks the ordinary verified-auth and signed-in sidebar call counts", async () => {
    const authRefresh = namedFunctionSlice(
      authUsersSource,
      "export async function getUserAuthState",
      null,
    )
    const backgroundCreditProvisionerCalls = callCount(
      authRefresh,
      /ensureVerifiedUserBackgroundCredits\s*\(/g,
    )
    const authCalls = { userGraphReads: 0, temporaryGrantReads: 0, entitlementBuilds: 0 }
    const authWorkload = authSnapshotWorkload(authCalls)
    const authState = await authWorkload.getUserAuthState(
      "workload-user",
      authWorkload.database,
      authWorkload.loadTemporaryGrants,
    )
    const sidebarCalls = {
      authSnapshots: 0,
      preferenceReads: 0,
      practiceRoleReads: 0,
      entitlementReads: 0,
      clientBootstrapEndpointRequests: 0,
      commerceSnapshotLoads: 0,
    }
    const sidebarWorkload = sidebarNavigationWorkload(sidebarCalls)
    assert.equal(typeof sidebarWorkload.getAppSidebarData, "function")
    const shell = await sidebarWorkload.getAppSidebarData()
    if (shell.accountBootstrap?.preferenceStatus !== "ready") {
      sidebarCalls.clientBootstrapEndpointRequests += 1
    }

    const logicalOrmOperations = (
      authCalls.userGraphReads
      + authCalls.temporaryGrantReads
      + sidebarCalls.preferenceReads
      + sidebarCalls.practiceRoleReads
    )

    assert.equal(backgroundCreditProvisionerCalls, 0)
    assert.deepEqual(authCalls, {
      userGraphReads: 1,
      temporaryGrantReads: 1,
      entitlementBuilds: 1,
    })
    assert.deepEqual(sidebarCalls, {
      authSnapshots: 1,
      preferenceReads: 1,
      practiceRoleReads: 1,
      entitlementReads: 0,
      clientBootstrapEndpointRequests: 0,
      commerceSnapshotLoads: 0,
    })
    assert.equal(logicalOrmOperations, 4)
    assert.deepEqual(shell.navigation.featureKeys, authState.featureKeys)
    assert.deepEqual(shell.accountBootstrap, {
      ownerKey: "workload-user",
      syncEnabled: true,
      preferenceStatus: "ready",
      appSettings: {
        app: {
          appBarPosition: "top",
          sidebarPosition: "right",
          sidebarTriggerPosition: "top",
          ambientMotionMode: "system",
          themeMode: "system",
          hapticFeedbackEnabled: true,
        },
        musicVisualizer: {
          defaultBackgroundId: "aurora",
          showClock: true,
        },
      },
      hasPracticeMembership: false,
    })
    console.log(`verified auth refresh: background-credit provisioner calls = ${backgroundCreditProvisionerCalls}`)
    console.log(`ordinary signed-in shell: auth snapshots = ${sidebarCalls.authSnapshots}; auth user graph reads = ${authCalls.userGraphReads}; temporary-grant reads = ${authCalls.temporaryGrantReads}; entitlement builds = ${authCalls.entitlementBuilds}`)
    console.log(`ordinary signed-in shell: preference reads = ${sidebarCalls.preferenceReads}; practice-role reads = ${sidebarCalls.practiceRoleReads}; separate membership entitlement loads = ${sidebarCalls.entitlementReads}; logical ORM operations = ${logicalOrmOperations}`)
    console.log(`ordinary signed-in shell: client bootstrap endpoint requests = ${sidebarCalls.clientBootstrapEndpointRequests}; commerce snapshot loads = ${sidebarCalls.commerceSnapshotLoads}`)
  })

  it("loads one persisted membership return summary without Stripe", async () => {
    const calls = { persistedSummaryLoads: 0, stripeCalls: 0 }
    await getMembershipConvergenceStatus({
      prismaClient: { sentinel: "workload-database" },
      userId: "workload-user",
      getMembershipSummary: async () => {
        calls.persistedSummaryLoads += 1
        return membershipSummary()
      },
    })

    assert.deepEqual(calls, { persistedSummaryLoads: 1, stripeCalls: 0 })
    console.log(`membership status read: persisted summary loads = ${calls.persistedSummaryLoads}; Stripe calls = ${calls.stripeCalls}`)
  })

  it("calls Checkout and Portal providers only for explicit actions", async () => {
    const pricingPage = namedFunctionSlice(
      pricingPageSource,
      "export default async function PricingPage",
      "function pricingOneTimeSupportNotice",
    )
    const ordinaryRenderProviderCalls = callCount(
      pricingPage,
      /createStripe(?:Checkout|CustomerPortal)Session\s*\(/g,
    )
    const calls = { checkoutSessionCreates: 0, portalSessionCreates: 0 }

    const checkout = createMembershipCheckoutPostHandler(checkoutDependencies(calls))
    await checkout(validCheckoutRequest())
    const portal = portalPost(calls)
    await portal({
      formData: async () => {
        const data = new FormData()
        data.set("destination", BILLING_PORTAL_DESTINATIONS.MANAGE)
        return data
      },
    })

    assert.equal(calls.checkoutSessionCreates, 1)
    assert.equal(calls.portalSessionCreates, 1)
    assert.equal(ordinaryRenderProviderCalls, 0)
    console.log(`valid explicit Checkout: Checkout-session creates = ${calls.checkoutSessionCreates}; ordinary render = ${ordinaryRenderProviderCalls}`)
    console.log(`valid explicit Portal action: Portal-session creates = ${calls.portalSessionCreates}; ordinary render = ${ordinaryRenderProviderCalls}`)
  })
})
