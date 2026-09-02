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
import { SIX_PRICE_ENVIRONMENT } from "./helpers/membership-pricing-environment.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const HISTORICAL_BROWSER_QA_RECEIPT_PATTERN =
  /127 Browser-QA passes(?:,| with)\s+37 documented\s+authorization-gated skips/i
const [
  authUsersSource,
  sidebarSource,
  pricingPageSource,
  portalRouteSource,
  accountSurfaceDataSource,
  membershipSource,
  membershipPricingSource,
  stripeBillingSource,
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
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("../lib/rsc-session.ts", import.meta.url), "utf8"),
  readFile(new URL("../docs/project-state.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/project-log.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/wiki/deployment.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/wiki/release-checklist.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/superpowers/plans/2026-08-29-bootstrap-pricing-cost-hardening.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/superpowers/reports/2026-08-29-bootstrap-pricing-cost-hardening.md", import.meta.url), "utf8"),
])

/** Collapses Markdown wrapping so exact prose claims do not depend on line layout. */
function normalizeDocumentationWhitespace(source) {
  return source.replace(/\s+/g, " ").trim()
}

const normalizedProjectStateSource = normalizeDocumentationWhitespace(projectStateSource)
const normalizedProjectLogSource = normalizeDocumentationWhitespace(projectLogSource)
const normalizedDeploymentSource = normalizeDocumentationWhitespace(deploymentSource)
const normalizedReleaseChecklistSource = normalizeDocumentationWhitespace(releaseChecklistSource)
// Advance this review-date ceiling only alongside newly verified project-state evidence.
const PROJECT_STATE_VERIFIED_DATE_UPPER_BOUND = "2026-09-02"

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

/**
 * Requires two nearby semantic fragments in either prose order. Fragments must
 * be anchor-free and must not depend on captures or backreferences. Only each
 * fragment's source is retained; its flags are discarded and the composed
 * expression is case-insensitive only.
 */
function assertBoundedEitherOrder(source, left, right, maxCharacters = 120) {
  assert.match(
    source,
    new RegExp(
      `(?:${left.source}.{0,${maxCharacters}}${right.source}|${right.source}.{0,${maxCharacters}}${left.source})`,
      "i",
    ),
  )
}

/**
 * Compiles one fresh isolated pricing module per invocation. Calls through the
 * returned module share that invocation's singleton cache, while separate tests
 * and helper invocations receive independent module and cache state.
 */
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
        return { features: ["premium_backgrounds"] }
      },
      loadActiveTemporaryGrants: loadTemporaryGrants,
    },
    "@/lib/phi-sync": { isHostedClinicalSyncEnabled: () => false },
    "@/lib/prisma": { prisma: database },
  })
  return { database, getUserAuthState, loadTemporaryGrants }
}

/**
 * Loads the sidebar with feature keys produced by `getUserAuthState` and then
 * projected through the `getCurrentRscSession` double. The legacy `@/auth`
 * double carries a poison feature key so an accidental direct-auth read cannot
 * satisfy the authoritative session assertion.
 *
 * @param {{ legacyAuthSnapshots: number, rscAuthSnapshots: number, preferenceReads: number, practiceRoleReads: number, entitlementReads: number }} calls Mutable workload counters.
 * @param {ReadonlyArray<string>} authoritativeFeatureKeys Entitlements from the auth workload.
 * @returns {{ getAppSidebarData: () => Promise<{ navigation: { featureKeys: string[] }, accountBootstrap: object }> }} Compiled sidebar projection entry point.
 */
function sidebarNavigationWorkload(calls, authoritativeFeatureKeys) {
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
            featureKeys: ["legacy_direct_auth_must_not_be_used"],
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
            featureKeys: [...authoritativeFeatureKeys],
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
  it("keeps project-state launch-cost claims current and dated", () => {
    assert.match(normalizedProjectStateSource, /ordinary non-practice shell/i)
    assert.match(normalizedProjectStateSource, /four logical ORM operations/i)
    assert.match(normalizedProjectStateSource, /zero client bootstrap endpoints/i)
    assert.match(normalizedProjectStateSource, /zero ordinary commerce snapshots/i)
    assert.match(normalizedProjectStateSource, /public display catalog only/i)
    assert.match(
      normalizedProjectStateSource,
      /(?:local timing `first`.{0,80}\bnot\b.{0,80}platform cold evidence|platform cold evidence.{0,80}\bnot\b.{0,80}local timing `first`)/i,
    )
    assert.match(normalizedProjectStateSource, /Live Stripe verification is `NOT RUN`/i)
    const verifiedDateMatch = /^Verified: (\d{4}-\d{2}-\d{2})\r?$/m.exec(projectStateSource)
    assert.ok(verifiedDateMatch, "project state must include one ISO-formatted Verified date")
    const verifiedDate = new Date(`${verifiedDateMatch[1]}T00:00:00.000Z`)
    assert.equal(
      Number.isNaN(verifiedDate.getTime()) ? null : verifiedDate.toISOString().slice(0, 10),
      verifiedDateMatch[1],
      "project-state Verified must be a real ISO calendar date",
    )
    assert.ok(
      verifiedDateMatch[1] <= PROJECT_STATE_VERIFIED_DATE_UPPER_BOUND,
      `project-state Verified date must not exceed ${PROJECT_STATE_VERIFIED_DATE_UPPER_BOUND}`,
    )
  })

  it("keeps project-log migration and historical workload claims ordered", () => {
    const septemberMigrationCorrection = namedFunctionSlice(
      normalizedProjectLogSource,
      "## 2026-09-01 — Combined migration-order correction",
      "## 2026-08-29 — Bootstrap and public-pricing cost hardening evidence",
    )
    const augustSubscriptionReview = namedFunctionSlice(
      normalizedProjectLogSource,
      "## 2026-08-29 — Final membership convergence review fixes",
      "## 2026-08-29 — Initial subscription entitlement convergence implementation and Task 5 evidence",
    )
    const augustIdentityReview = namedFunctionSlice(
      normalizedProjectLogSource,
      "## 2026-08-29 — Final identity safety review remediation",
      "## 2026-08-28 — Local identity and account-method safety verification",
    )
    const augustBootstrapEvidence = namedFunctionSlice(
      normalizedProjectLogSource,
      "## 2026-08-29 — Bootstrap and public-pricing cost hardening evidence",
      "## 2026-08-29 — Server path and family launch cost controls",
    )

    assert.match(augustBootstrapEvidence, /ordinary non-practice shell/i)
    assert.match(augustBootstrapEvidence, /five-minute complete TTL/i)
    assert.match(augustBootstrapEvidence, /fifteen-second incomplete\/fallback TTL/i)
    for (const authority of ["Checkout", "Portal", "entitlements", "customers", "webhooks"]) {
      assert.match(augustBootstrapEvidence, new RegExp(`\\b${authority}\\b.{0,100}\\buncached\\b`, "i"))
    }
    assert.match(augustBootstrapEvidence, HISTORICAL_BROWSER_QA_RECEIPT_PATTERN)
    assert.match(augustBootstrapEvidence, /documented authorization-gated skips.{0,80}zero failures/i)
    assert.match(septemberMigrationCorrection, /five-migration pre-runtime order/i)
    assert.match(augustSubscriptionReview, /three-migration order/i)
    assert.match(augustSubscriptionReview, /2026-09-01 correction/i)
    assert.match(augustSubscriptionReview, /sole current migration inventory/i)
    assert.match(augustIdentityReview, /two identity migrations/i)
    assert.match(augustIdentityReview, /`20260828130000_membership_subscription_convergence`/i)
    assert.match(augustIdentityReview, /three-migration pre-runtime set/i)
    assert.match(augustIdentityReview, /2026-09-01 correction/i)
    assert.match(augustIdentityReview, /sole current migration inventory/i)
    assert.equal(callCount(septemberMigrationCorrection, /20260901100000_auth_method_intent_two_factor_purposes/g), 1)
    assert.equal(callCount(septemberMigrationCorrection, /20260901101000_auth_method_intent_registration_callback/g), 1)
    assert.match(
      septemberMigrationCorrection,
      /20260901100000_auth_method_intent_two_factor_purposes[\s\S]*20260901101000_auth_method_intent_registration_callback/,
    )
  })

  it("keeps deployment guidance explicit about timing and launch controls", () => {
    const deploymentCostControls = namedFunctionSlice(
      normalizedDeploymentSource,
      "## Family-And-Friends Launch Cost Controls",
      "## Identity, Membership Schema, And Writer Rollout",
    )
    const deploymentTimingContext = namedFunctionSlice(
      normalizedDeploymentSource,
      "**BLOCKED HISTORICAL CONTEXT:**",
      "Before a sharing window",
    )

    assert.match(normalizedDeploymentSource, /public display catalog only/i)
    assert.match(deploymentCostControls, /process-local/i)
    assert.match(deploymentCostControls, /single-flight/i)
    for (const stableClass of [/every slot is configured/, /exactly unconfigured/]) {
      assertBoundedEitherOrder(deploymentCostControls, stableClass, /\bfive-minute TTL\b/)
    }
    for (const failureClass of [/\bconfigured lookup\b/, /\bmalformed projection failures\b/]) {
      assertBoundedEitherOrder(deploymentCostControls, failureClass, /\bfifteen-second retry TTL\b/)
    }
    assert.match(deploymentCostControls, /2\.5-second timeout/i)
    assert.match(deploymentCostControls, /one SDK network retry/i)
    for (const authority of ["Checkout", "Portal", "entitlements", "customers", "webhooks"]) {
      assert.match(deploymentCostControls, new RegExp(`\\b${authority}\\b.{0,100}\\buncached\\b`, "i"))
    }
    assert.match(deploymentTimingContext, /^\*\*BLOCKED HISTORICAL CONTEXT:\*\*/)
    for (const concept of [
      /21\/21 samples/,
      /seven fixed routes/,
      /three samples per route/,
      /`706c52167466f984f3e405986af11ff3d2343a02`/,
      /uncommitted dirty Task 9/,
      /patch identity was not recorded/,
      /deployed exact commit/,
      /read-only Vercel aggregate/,
      /operational gate/,
      /cold row as `NOT RUN`/,
    ]) {
      assert.match(deploymentTimingContext, concept)
    }
    assert.match(deploymentTimingContext, /\bunreproducible\b/i)
    const blockedEvidenceNegation = /\bnot\b[^.]{0,160}\bevidence\b/i
      .exec(deploymentTimingContext)?.[0] ?? ""
    assert.notEqual(blockedEvidenceNegation, "", "historical context must retain a bounded not-evidence clause")
    for (const blockedEvidenceKind of [/\bcompletion\b/i, /\brelease\b/i, /\bexact-candidate\b/i]) {
      assert.match(blockedEvidenceNegation, blockedEvidenceKind)
    }
    assert.match(
      deploymentTimingContext,
      /(?:local timing `first`.{0,80}\bnot\b.{0,80}platform cold evidence|platform cold evidence.{0,80}\bnot\b.{0,80}local timing `first`)/i,
    )
    assert.doesNotMatch(deploymentSource, /^The final local timing receipt returned/m)
    assert.match(deploymentCostControls, /MASSAGELAB_PUBLIC_REGISTRATION_PAUSED/)
    assert.match(deploymentCostControls, /MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED/)
    assert.match(deploymentCostControls, /exact lowercase value `true` pauses/i)
    assert.match(deploymentCostControls, /An absent flag[\s\S]{0,100}leaves that path open/i)
    assert.match(deploymentCostControls, /changing one flag does not change[\s\S]{0,40}the other/i)
  })

  it("keeps release-checklist gates aligned with launch controls", () => {
    const releaseCostControls = namedFunctionSlice(
      normalizedReleaseChecklistSource,
      "## Family-And-Friends Cost And Pause Gate",
      "## Navigation And Action Feedback Gate",
    )
    const liveActionGate = namedFunctionSlice(
      releaseCostControls,
      "Keep live Stripe",
      "Historical live payment evidence",
    )

    assert.match(normalizedReleaseChecklistSource, /four logical ORM operations/i)
    assert.match(releaseCostControls, /public display catalog only/i)
    assert.match(releaseCostControls, /process-local/i)
    assert.match(releaseCostControls, /single-flight/i)
    for (const stableClass of [/\bstable configured\b/, /\bexactly unconfigured\b/]) {
      assertBoundedEitherOrder(releaseCostControls, stableClass, /\bfive-minute TTL\b/)
    }
    for (const failureClass of [/\bconfigured lookup\b/, /\bmalformed projection failures\b/]) {
      assertBoundedEitherOrder(releaseCostControls, failureClass, /\bfifteen-second retry TTL\b/)
    }
    assert.match(releaseCostControls, /every required slot is configured before release/i)
    assert.match(normalizedReleaseChecklistSource, /zero client bootstrap endpoints/i)
    assert.match(normalizedReleaseChecklistSource, /zero ordinary commerce snapshots/i)
    assert.match(normalizedReleaseChecklistSource, HISTORICAL_BROWSER_QA_RECEIPT_PATTERN)
    assert.match(releaseCostControls, /zero failures/i)
    assert.match(releaseCostControls, /documented authorization-gated private rows/i)
    assert.match(releaseCostControls, /skips are never passes/i)
    for (const gatedConcept of [
      /live Stripe/i,
      /payment\/catalog\/webhook\/Portal/i,
      /private database rows/i,
      /provider settings/i,
      /OAuth\/mail delivery/i,
      /deployment/,
      /push/,
      /merge/,
      /Production actions/,
      /recorded as `NOT RUN`/,
      /separate authorization/,
    ]) {
      assert.match(liveActionGate, gatedConcept)
    }
    assert.match(releaseCostControls, /MASSAGELAB_PUBLIC_REGISTRATION_PAUSED/)
    assert.match(releaseCostControls, /MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED/)
    assert.match(releaseCostControls, /switches independently/i)
    assert.match(releaseCostControls, /Only lowercase `true` pauses a path/i)
    assert.match(releaseCostControls, /absence defaults open/i)
  })

  it("keeps cost-hardening plan and report evidence explicitly bounded", () => {
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
    assert.doesNotMatch(costHardeningReportSource, /^\| Claim \| Evidence \| Exact SHA \| Limits \|\r?$/m)
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
    }
    const sidebarWorkload = sidebarNavigationWorkload(sidebarCalls, authState.featureKeys)
    assert.equal(typeof sidebarWorkload.getAppSidebarData, "function")
    const shell = await sidebarWorkload.getAppSidebarData()

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
    })
    assert.equal(logicalOrmOperations, 4)
    assert.deepEqual(shell.navigation.featureKeys, authState.featureKeys)
    assert.deepEqual(shell.navigation.featureKeys, ["premium_backgrounds"])
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
  })

  it("loads one persisted membership return summary", async () => {
    const calls = { persistedSummaryLoads: 0 }
    await getMembershipConvergenceStatus({
      prismaClient: { sentinel: "workload-database" },
      userId: "workload-user",
      getMembershipSummary: async () => {
        calls.persistedSummaryLoads += 1
        return membershipSummary()
      },
    })

    assert.deepEqual(calls, { persistedSummaryLoads: 1 })
    console.log(`membership status read: persisted summary loads = ${calls.persistedSummaryLoads}`)
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
