import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { BILLING_PORTAL_DESTINATIONS } from "../lib/billing-portal-destinations.js"
import { projectAccountShellAppSettings } from "../lib/account-shell-bootstrap.js"
import { createMembershipCheckoutPostHandler } from "../lib/membership-checkout.js"
import { getMembershipConvergenceStatus } from "../lib/membership-convergence.ts"
import {
  BILLING_INTERVALS,
  SUPPORTER_AMOUNT_CHOICES,
  getConfiguredMembershipOptions,
  hasSubscriptionBlockingNewCheckout,
} from "../lib/membership.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const SIX_PRICE_ENVIRONMENT = Object.freeze({
  STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1_month",
  STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_1_year",
  STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2_month",
  STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "price_supporter_2_year",
  STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "price_supporter_5_month",
  STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "price_supporter_5_year",
})
const [
  authUsersSource,
  sidebarSource,
  pricingPageSource,
  portalRouteSource,
  accountSurfaceDataSource,
  membershipSource,
  membershipPricingSource,
  stripeBillingSource,
  backgroundCommerceProviderSource,
  layoutWrapperSource,
  nextConfigSource,
  rscSessionSource,
  projectStateSource,
  projectLogSource,
  deploymentSource,
  releaseChecklistSource,
  costHardeningPlanSource,
  costHardeningReportSource,
] = await Promise.all([
  readFile(new URL("../lib/auth-users.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/sidebar/sidebar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/billing/portal/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/account-surface-data.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/membership.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/membership-pricing.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/stripe-billing.js", import.meta.url), "utf8"),
  readFile(new URL("../components/backgrounds/BackgroundCommerceProvider.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8"),
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("../lib/rsc-session.ts", import.meta.url), "utf8"),
  readFile(new URL("../docs/project-state.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/project-log.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/wiki/deployment.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/wiki/release-checklist.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/superpowers/plans/2026-08-29-bootstrap-pricing-cost-hardening.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/superpowers/reports/2026-08-29-bootstrap-pricing-cost-hardening.md", import.meta.url), "utf8"),
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

/** Loads a fresh copy of the production module so this test exercises its singleton owner. */
function sharedMembershipPricingWorkload(priceReads, {
  configuredEnvironment = SIX_PRICE_ENVIRONMENT,
  clientConstructions = [],
  constructClient,
  providerKey = "test-provider-key",
} = {}) {
  const membershipPricing = loadCompiledModule(
    membershipPricingSource,
    "lib/membership-pricing.shared-workload.test.js",
    {
      "./membership.js": {
        BILLING_INTERVALS,
        SUPPORTER_AMOUNT_CHOICES,
        getConfiguredMembershipOptions: () => getConfiguredMembershipOptions(configuredEnvironment),
      },
      "./stripe-billing.js": {
        getStripeSecretKey: () => providerKey,
        getStripeClient(apiKey) {
          const construction = { apiKey, stripeClient: null }
          clientConstructions.push(construction)
          const stripeClient = constructClient
            ? constructClient(apiKey)
            : { constructionNumber: clientConstructions.length }
          construction.stripeClient = stripeClient
          return stripeClient
        },
        async retrieveStripePrice(priceId, { apiKey, stripeClient, requestOptions }) {
          priceReads.push({ priceId, apiKey, stripeClient, options: requestOptions })
          return {
            id: priceId,
            unit_amount: 100,
            currency: "usd",
            recurring: { interval: priceId.endsWith("_year") ? "year" : "month" },
          }
        },
      },
      "./stripe-price-contract.js": {
        SUPPORTER_MEMBERSHIP_PRODUCT_NAME: "Supporter",
      },
    },
  )
  return membershipPricing
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
        calls.legacyAuthSnapshots += 1
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
    "@/lib/rsc-session": {
      getCurrentRscSession: async () => {
        calls.rscAuthSnapshots += 1
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
  it("keeps canonical launch operations aligned with the measured cost boundaries", () => {
    const deploymentCostControls = namedFunctionSlice(
      deploymentSource,
      "## Family-And-Friends Launch Cost Controls",
      "## Identity, Membership Schema, And Writer Rollout",
    )
    const deploymentTimingContext = namedFunctionSlice(
      deploymentSource,
      "**BLOCKED HISTORICAL CONTEXT:**",
      "Before a sharing window",
    )
    const releaseCostControls = namedFunctionSlice(
      releaseChecklistSource,
      "## Family-And-Friends Cost And Pause Gate",
      "## Navigation And Action Feedback Gate",
    )
    const septemberMigrationCorrection = namedFunctionSlice(
      projectLogSource,
      "## 2026-09-01 — Combined migration-order correction",
      "## 2026-08-29 — Bootstrap and public-pricing cost hardening evidence",
    )
    const augustSubscriptionReview = namedFunctionSlice(
      projectLogSource,
      "## 2026-08-29 — Final membership convergence review fixes",
      "## 2026-08-29 — Initial subscription entitlement convergence implementation and Task 5 evidence",
    )
    const augustIdentityReview = namedFunctionSlice(
      projectLogSource,
      "## 2026-08-29 — Final identity safety review remediation",
      "## 2026-08-28 — Local identity and account-method safety verification",
    )

    assert.match(projectStateSource, /ordinary non-practice shell/i)
    assert.match(projectStateSource, /four logical ORM operations/i)
    assert.match(projectStateSource, /zero client bootstrap endpoints/i)
    assert.match(projectStateSource, /zero ordinary commerce snapshots/i)
    assert.match(projectStateSource, /public display catalog only/i)
    assert.match(projectStateSource, /local timing `first` is not platform cold/i)
    assert.match(projectStateSource, /live Stripe[^\n]*`NOT RUN`/i)
    assert.match(projectStateSource, /^Verified: 2026-09-01$/m)

    assert.match(projectLogSource, /ordinary non-practice shell/i)
    assert.match(projectLogSource, /five-minute complete[^\n]*fifteen-second incomplete/i)
    assert.match(projectLogSource, /Checkout, Portal, entitlements, customers, and webhooks remain uncached/i)
    assert.match(
      projectLogSource,
      /127 Browser-QA passes.{0,160}37 documented authorization-gated skips.{0,80}zero failures/i,
    )
    assert.match(septemberMigrationCorrection, /one exact five-migration pre-runtime order/i)
    assert.match(augustSubscriptionReview, /then-current three-migration order/i)
    assert.match(augustSubscriptionReview, /2026-09-01 correction above is the sole current migration inventory/i)
    assert.match(augustIdentityReview, /two identity migrations plus `20260828130000_membership_subscription_convergence` formed the three-migration pre-runtime set/i)
    assert.match(augustIdentityReview, /2026-09-01 correction above for the sole current migration inventory/i)
    assert.equal(callCount(projectLogSource, /20260901100000_auth_method_intent_two_factor_purposes/g), 1)
    assert.equal(callCount(projectLogSource, /20260901101000_auth_method_intent_registration_callback/g), 1)

    assert.match(deploymentSource, /public display catalog only/i)
    assert.match(deploymentCostControls, /owner is process-local and\s+single-flight/i)
    assert.match(
      deploymentSource,
      /stable results use a five-minute TTL[\s\S]{0,180}configured lookup or\s+malformed projection failures use a fifteen-second retry TTL/i,
    )
    assert.match(deploymentSource, /2\.5-second timeout[^\n]*one SDK network retry/i)
    assert.match(deploymentSource, /Checkout, Portal, entitlements, customers, and webhooks remain uncached/i)
    assert.match(deploymentTimingContext, /^\*\*BLOCKED HISTORICAL CONTEXT:\*\*/)
    assert.match(deploymentTimingContext, /HTTP `200` observation for 21\/21 samples\s+across seven fixed routes with three samples per route/)
    assert.match(
      deploymentTimingContext,
      /reported from runtime\s+base `706c52167466f984f3e405986af11ff3d2343a02` plus an uncommitted dirty Task 9\s+working-tree delta whose patch identity was not recorded/,
    )
    assert.match(deploymentTimingContext, /unreproducible\s+and is not completion, release, or exact-candidate evidence/)
    assert.match(deploymentTimingContext, /local timing\s+`first` label is not platform cold evidence/)
    assert.match(deploymentTimingContext, /deployed exact commit still\s+requires a separate read-only Vercel aggregate/)
    assert.match(deploymentTimingContext, /this remains an\s+operational gate/)
    assert.match(deploymentTimingContext, /record the\s+cold row as `NOT RUN`/)
    assert.doesNotMatch(deploymentSource, /^The final local timing receipt returned/m)
    assert.match(deploymentCostControls, /MASSAGELAB_PUBLIC_REGISTRATION_PAUSED/)
    assert.match(deploymentCostControls, /MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED/)
    assert.match(deploymentCostControls, /exact lowercase value `true` pauses/i)
    assert.match(deploymentCostControls, /An absent flag[\s\S]{0,100}leaves that path open/i)
    assert.match(deploymentCostControls, /changing one flag does not change[\s\S]{0,40}the other/i)

    assert.match(releaseChecklistSource, /four logical ORM operations/i)
    assert.match(releaseCostControls, /public display catalog only is process-local and single-flight/i)
    assert.match(
      releaseCostControls,
      /stable configured or exactly unconfigured results have a five-minute TTL[\s\S]{0,160}configured lookup\/malformed projection failures have a fifteen-second retry\s+TTL/i,
    )
    assert.match(releaseCostControls, /every required slot is configured before release/i)
    assert.match(releaseChecklistSource, /zero client bootstrap\s+endpoints/i)
    assert.match(releaseChecklistSource, /zero ordinary commerce snapshots/i)
    assert.match(
      releaseChecklistSource,
      /127 Browser-QA passes with 37 documented\s+authorization-gated skips/i,
    )
    assert.match(
      releaseChecklistSource,
      /zero failures and no skips except the documented\s+authorization-gated private rows; skips are never passes/i,
    )
    assert.match(releaseChecklistSource, /live Stripe[^\n]*`NOT RUN`/i)
    assert.match(releaseCostControls, /MASSAGELAB_PUBLIC_REGISTRATION_PAUSED/)
    assert.match(releaseCostControls, /MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED/)
    assert.match(releaseCostControls, /switches independently/i)
    assert.match(releaseCostControls, /Only lowercase `true` pauses a path/i)
    assert.match(releaseCostControls, /absence defaults open/i)

    assert.match(
      costHardeningPlanSource,
      /do not create real Stripe Checkout Session, Portal Session, Customer, subscription, payment, refund, cancellation, webhook, or provider-setting resources/i,
    )
    assert.match(
      costHardeningPlanSource,
      /deterministic injected doubles may exercise these logical create contracts, but they neither contact Stripe nor persist provider resources/i,
    )
    assert.match(
      costHardeningReportSource,
      /The measurements below were reported from the recorded runtime base `706c52167466f984f3e405986af11ff3d2343a02` plus an uncommitted dirty Task 9 working-tree delta/,
    )
    assert.match(
      costHardeningReportSource,
      /Every measured row is \*\*BLOCKED HISTORICAL CONTEXT\*\* and is explicitly not completion, release, or exact-head evidence/,
    )
    assert.match(
      costHardeningReportSource,
      /exact measured source tree[\s\S]{0,160}\*\*UNKNOWN\*\*/,
    )
    assert.match(
      costHardeningReportSource,
      /whether any individual receipt exercised Task-9-delta-owned code[\s\S]{0,40}\*\*UNKNOWN\*\*/,
    )
    assert.match(costHardeningReportSource, /no row may be assigned an exact measured SHA/)
    assert.match(
      costHardeningReportSource,
      /Bare SHAs identify runtime bases or implementation owners only; they do not identify reproducible measured working trees/,
    )
    assert.match(costHardeningReportSource, /Rows marked \*\*OPEN GATE\*\* were not run or measured and remain required before release/)
    const reportDataRows = costHardeningReportSource
      .split(/\r?\n/)
      .filter((line) => /^\| \*\*(?:BLOCKED HISTORICAL CONTEXT|OPEN GATE)\*\* \|/.test(line))
    const allReportRows = costHardeningReportSource
      .split(/\r?\n/)
      .filter((line) => line.startsWith("| ") && !line.startsWith("| Status |") && !line.startsWith("| --- |"))
    assert.ok(reportDataRows.length > 0)
    assert.deepEqual(reportDataRows, allReportRows)
    for (const row of reportDataRows) {
      const isOpenGate = /\*\*(?:NOT RUN|NOT MEASURED)/.test(row)
      assert.match(
        row,
        isOpenGate
          ? /^\| \*\*OPEN GATE\*\* \|/
          : /^\| \*\*BLOCKED HISTORICAL CONTEXT\*\* \|/,
      )
    }
    assert.doesNotMatch(costHardeningReportSource, /^Every measured receipt in this table remains attributed to /m)
    assert.doesNotMatch(
      costHardeningReportSource,
      /^\| (?:\*\*BLOCKED HISTORICAL CONTEXT\*\* \| )?Dirty Task 9 snapshot measured \|/m,
    )
    assert.doesNotMatch(costHardeningReportSource, /^\| Candidate measured \|/m)
    assert.doesNotMatch(costHardeningReportSource, /^\| Claim \| Evidence \| Exact SHA \| Limits \|$/m)
    assert.doesNotMatch(
      costHardeningReportSource,
      /\|[^|\n]*at candidate `706c52167466f984f3e405986af11ff3d2343a02`[^|\n]*\|/,
    )
    assert.doesNotMatch(
      costHardeningReportSource,
      /\|\s*Candidate `706c52167466f984f3e405986af11ff3d2343a02`\s*\|/,
    )
    assert.match(
      costHardeningPlanSource,
      /npm run test:browser -- tests\/browser\/app-shell\.spec\.ts tests\/browser\/background-commerce\.spec\.ts tests\/browser\/public-routes\.spec\.ts tests\/browser\/membership-return-status\.spec\.ts --project=desktop-chromium --workers=1 --retries=0/,
    )
    assert.match(
      costHardeningPlanSource,
      /npm run test:browser -- tests\/browser\/membership-return-status\.spec\.ts --project=mobile-chromium --workers=1 --retries=0/,
    )
  })

  it("keeps the shared display catalog out of membership, entitlement, and customer authority", () => {
    assert.match(pricingPageSource, /import\s*\{\s*getMembershipPricingCatalog\s*\}\s*from\s*["']@\/lib\/membership-pricing["']/)
    assert.match(accountSurfaceDataSource, /import\s*\{\s*getMembershipPricingCatalog\s*\}\s*from\s*["']\.\/membership-pricing\.js["']/)
    assert.doesNotMatch(membershipSource, /membership-pricing(?:\.js)?["']/)
    assert.doesNotMatch(stripeBillingSource, /membership-pricing(?:\.js)?["']/)
  })

  it("limits the Browser-QA auth-entry proof to the explicit RSC session wrapper", () => {
    assert.doesNotMatch(nextConfigSource, /@\/auth/)
    assert.match(rscSessionSource, /from\s*["']@\/lib\/rsc-session-proof["']/)
    assert.match(rscSessionSource, /NEXT_PUBLIC_RSC_SESSION_PROOF\s*===\s*["']1["']/)
  })

  it("shares six public display Price reads across concurrent cold and warm callers", async () => {
    const priceReads = []
    const clientConstructions = []
    const { getMembershipPricingCatalog } = sharedMembershipPricingWorkload(priceReads, {
      clientConstructions,
    })

    await Promise.all(Array.from({ length: 20 }, () => getMembershipPricingCatalog()))
    const concurrentColdLogicalPriceReads = priceReads.length
    const beforeWarmRead = priceReads.length
    await getMembershipPricingCatalog()
    const warmLogicalPriceReads = priceReads.length - beforeWarmRead

    assert.equal(concurrentColdLogicalPriceReads, 6)
    assert.equal(warmLogicalPriceReads, 0)
    assert.equal(clientConstructions.length, 1)
    assert.equal(clientConstructions[0].apiKey, "test-provider-key")
    assert.equal(priceReads.every(({ stripeClient }) => (
      stripeClient === clientConstructions[0].stripeClient
    )), true)
    assert.equal(priceReads.every(({ apiKey }) => apiKey === "test-provider-key"), true)
    assert.equal(priceReads.every(({ options }) => (
      options.timeout === 2_500 && options.maxNetworkRetries === 1
    )), true)
    console.log(`public pricing catalog: concurrent cold logical Price reads = ${concurrentColdLogicalPriceReads}; warm logical Price reads = ${warmLogicalPriceReads}`)
  })

  it("fails configured pricing visibly when the one Stripe client construction fails", async () => {
    const priceReads = []
    const clientConstructions = []
    const { getMembershipPricingCatalog } = sharedMembershipPricingWorkload(priceReads, {
      clientConstructions,
      constructClient() {
        throw new Error("private Stripe construction failure")
      },
    })

    const catalog = await getMembershipPricingCatalog()
    const configuredPrice = catalog.plans[0].amountChoices[0].prices.month

    assert.equal(clientConstructions.length, 1)
    assert.equal(priceReads.length, 0)
    assert.equal(configuredPrice.isConfigured, true)
    assert.equal(configuredPrice.isLookupAvailable, false)
    assert.equal(configuredPrice.displayPrice, "Price unavailable")
    assert.doesNotMatch(JSON.stringify(catalog), /private Stripe construction failure/)
  })

  it("does not construct a Stripe client for configured prices without a provider key", async () => {
    const priceReads = []
    const clientConstructions = []
    const { getMembershipPricingCatalog } = sharedMembershipPricingWorkload(priceReads, {
      clientConstructions,
      providerKey: "",
    })

    const catalog = await getMembershipPricingCatalog()
    const configuredPrice = catalog.plans[0].amountChoices[0].prices.month

    assert.equal(clientConstructions.length, 0)
    assert.equal(priceReads.length, 0)
    assert.equal(configuredPrice.isConfigured, true)
    assert.equal(configuredPrice.isLookupAvailable, false)
    assert.equal(configuredPrice.displayPrice, "Price unavailable")
  })

  it("does not construct a Stripe client when no display Price slots are configured", async () => {
    const priceReads = []
    const clientConstructions = []
    const { getMembershipPricingCatalog } = sharedMembershipPricingWorkload(priceReads, {
      configuredEnvironment: {},
      clientConstructions,
      constructClient() {
        throw new Error("must not construct")
      },
    })

    const catalog = await getMembershipPricingCatalog()

    assert.equal(clientConstructions.length, 0)
    assert.equal(priceReads.length, 0)
    assert.equal(catalog.plans[0].amountChoices[0].prices.month.isConfigured, false)
    assert.equal(catalog.plans[0].amountChoices[0].prices.month.displayPrice, "Price unavailable")
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
      legacyAuthSnapshots: 0,
      rscAuthSnapshots: 0,
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
      legacyAuthSnapshots: 0,
      rscAuthSnapshots: 1,
      preferenceReads: 1,
      practiceRoleReads: 1,
      entitlementReads: 0,
      clientBootstrapEndpointRequests: 0,
      commerceSnapshotLoads: 0,
    })
    assert.equal(logicalOrmOperations, 4)
    assert.match(backgroundCommerceProviderSource, /const ensureSnapshot/)
    assert.doesNotMatch(
      backgroundCommerceProviderSource,
      /Account state must load even when there is no guest intent/,
    )
    assert.match(layoutWrapperSource, /ownerKey=\{ownerKey\}/)
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
    console.log(`ordinary signed-in shell: RSC auth snapshots = ${sidebarCalls.rscAuthSnapshots}; legacy direct-auth snapshots = ${sidebarCalls.legacyAuthSnapshots}; auth user graph reads = ${authCalls.userGraphReads}; temporary-grant reads = ${authCalls.temporaryGrantReads}; entitlement builds = ${authCalls.entitlementBuilds}`)
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
