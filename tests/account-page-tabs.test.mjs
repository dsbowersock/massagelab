import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import ts from "typescript"
import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  findElements,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"
import {
  accountPageGroups,
  accountPageNavigationItems,
  accountPageSectionIds,
  accountPageTabs,
  filterAccountPageGroups,
  formatAccountDate,
  getAccountTabHref,
  selectAccountTab,
} from "../lib/account-page.js"
import { BILLING_PORTAL_DESTINATIONS } from "../lib/billing-portal-destinations.js"
import { resolveMembershipPricingMode } from "../lib/membership.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const accountPageSource = await readFile(
  new URL("../app/account/page.tsx", import.meta.url),
  "utf8",
)

/**
 * Uses the installed TypeScript parser to locate only lexical top-level
 * function declarations. Parser nodes make comments, strings, regular
 * expressions, template literals, and nested declarations non-boundaries.
 */
function topLevelFunctionDeclarations(source, fileName = "fixture.tsx") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  return sourceFile.statements
    .filter((statement) => ts.isFunctionDeclaration(statement) && statement.name)
    .map((statement) => ({
      end: statement.getEnd(),
      name: statement.name.text,
      start: statement.getStart(sourceFile),
    }))
}

/** Extracts one top-level function at its parser-defined lexical boundaries. */
function topLevelFunctionSource(source, functionName, fileName) {
  const declarations = topLevelFunctionDeclarations(source, fileName)
  const declaration = declarations.find(
    (declaration) => declaration.name === functionName,
  )
  assert.ok(
    declaration,
    `${fileName} must contain the ${functionName} function`,
  )

  return source.slice(declaration.start, declaration.end)
}

/** Executes the production return normalizer together with its real notice mapper. */
function loadAccountReturnContract() {
  const source = [
    `export ${topLevelFunctionSource(accountPageSource, "normalizeAccountReturnState", "app/account/page.tsx")}`,
    topLevelFunctionSource(accountPageSource, "billingMessage", "app/account/page.tsx"),
    `export ${topLevelFunctionSource(accountPageSource, "accountNotice", "app/account/page.tsx")}`,
  ].join("\n")

  return loadCompiledModule(source, "app/account/account-return-state.test.ts")
}

describe("Account page tab model", () => {
  it("extracts only lexical top-level function declarations", () => {
    const fixture = [
      "async function Target() {",
      "  function Nested() {}",
      '  const stringValue = "function StringValue() {}"',
      "  const expression = /function RegexValue\\(\\) \\{\\}/",
      "  const template = `function TemplateValue() {}`",
      "  // function LineComment() {}",
      "  /* export function BlockComment() {} */",
      "}",
      "export function Next() {}",
      "export default async function Final() {}",
    ].join("\n")

    assert.deepEqual(
      topLevelFunctionDeclarations(fixture).map(({ name }) => name),
      ["Target", "Next", "Final"],
    )
    const targetSource = topLevelFunctionSource(fixture, "Target", "fixture.tsx")
    assert.match(targetSource, /function Nested/)
    assert.doesNotMatch(targetSource, /export function Next/)
    assert.equal(
      topLevelFunctionSource(fixture, "Final", "fixture.tsx"),
      "export default async function Final() {}",
    )
  })

  it("groups existing account sections into stable account navigation without dropping current features", () => {
    assert.deepEqual(accountPageGroups.map((group) => group.id), [
      "general",
      "account",
      "preferences",
      "practice",
      "support",
      "legal",
    ])
    assert.deepEqual(accountPageGroups.map((group) => group.label), [
      "General",
      "Account",
      "Preferences",
      "Practice",
      "Support",
      "Legal",
    ])
    assert.deepEqual(accountPageTabs.map((tab) => tab.id), [
      "overview",
      "app-settings",
      "profile",
      "security",
      "credentials",
      "activity",
      "therapist-defaults",
      "sync",
      "tools",
      "membership",
      "orders-invoices",
    ])
    assert.equal(accountPageTabs[3].id, "security")

    assert.deepEqual(accountPageSectionIds, [
      "account-summary",
      "quick-actions",
      "app-layout-settings",
      "app-theme-settings",
      "profile-defaults",
      "security-settings",
      "role-verification",
      "account-activity",
      "local-therapist-defaults",
      "preference-sync",
      "clinical-sync",
      "anatomy-feedback",
      "anatomy-browser-access",
      "account-session",
      "membership",
      "membership-pricing",
      "subscription-status",
      "billing-portal",
      "background-commerce",
    ])
  })

  it("keeps current account navigation labels readable", () => {
    assert.equal(accountPageTabs.every((tab) => tab.label.length <= 22), true)
    assert.equal(accountPageTabs.every((tab) => tab.description.length > 0), true)
  })

  it("marks future settings rows as planned instead of actionable account sections", () => {
    const plannedIds = accountPageNavigationItems
      .filter((item) => item.status === "planned")
      .map((item) => item.id)

    assert.deepEqual(plannedIds, [
      "accessibility",
      "notifications",
      "practice-profile",
      "people",
    ])
    assert.equal(accountPageNavigationItems.every((item) => item.status !== "planned" || item.sections.length === 0), true)
    assert.equal(accountPageNavigationItems.every((item) => item.status !== "planned" || !item.href), true)
  })

  it("selects useful default tabs from account return states", () => {
    assert.equal(selectAccountTab("security", {}), "security")
    assert.equal(selectAccountTab("app-settings", {}), "app-settings")
    assert.equal(selectAccountTab("unknown", {}), "overview")
    assert.equal(selectAccountTab(undefined, { checkout: "success" }), "membership")
    assert.equal(selectAccountTab(undefined, { portal: "returned" }), "membership")
    assert.equal(selectAccountTab(undefined, { billing: "checkout-error" }), "membership")
  })

  it("normalizes conflicting account outcomes to one controller or notice owner", () => {
    const { accountNotice, normalizeAccountReturnState } = loadAccountReturnContract()

    for (const [params, expectedKind] of [
      [{ checkout: "success", portal: "error" }, "checkout"],
      [{ checkout: "success", portal: "returned" }, "checkout"],
      [{ checkout: "cancelled", portal: "returned" }, "portal"],
    ]) {
      const state = normalizeAccountReturnState(params)
      assert.deepEqual(state, { kind: expectedKind, notice: {} })
      assert.equal(accountNotice(state.notice), null)
    }

    const conflictingNotices = normalizeAccountReturnState({
      checkout: "cancelled",
      portal: "error",
    })
    assert.deepEqual(conflictingNotices, {
      kind: null,
      notice: { checkout: "cancelled" },
    })
    assert.equal(accountNotice(conflictingNotices.notice)?.title, "Checkout cancelled")

    assert.match(accountPageSource, /MembershipReturnStatus/)
    assert.equal((accountPageSource.match(/<MembershipReturnStatus/g) ?? []).length, 1)
    assert.match(accountPageSource, /<MembershipReturnStatus kind=\{returnState\.kind\} \/>/)
    assert.equal((accountPageSource.match(/<AccountNotice \{\.\.\.returnState\.notice\} \/>/g) ?? []).length, 2)
    assert.doesNotMatch(accountPageSource, /session_id|CHECKOUT_SESSION_ID/)
  })

  it("preserves each ordinary account controller and notice outcome", () => {
    const { accountNotice, normalizeAccountReturnState } = loadAccountReturnContract()

    for (const [params, expectedKind] of [
      [{ checkout: "success" }, "checkout"],
      [{ portal: "returned" }, "portal"],
    ]) {
      const state = normalizeAccountReturnState(params)
      assert.deepEqual(state, { kind: expectedKind, notice: {} })
      assert.equal(accountNotice(state.notice), null)
    }

    const checkoutCancelled = normalizeAccountReturnState({ checkout: "cancelled" })
    assert.deepEqual(checkoutCancelled, {
      kind: null,
      notice: { checkout: "cancelled" },
    })
    assert.equal(accountNotice(checkoutCancelled.notice)?.title, "Checkout cancelled")

    for (const [portal, expectedTitle] of [
      ["customer-not-found", "Billing portal unavailable"],
      ["subscription-not-found", "Subscription change unavailable"],
      ["error", "Billing portal unavailable"],
    ]) {
      const state = normalizeAccountReturnState({ portal })
      assert.deepEqual(state, { kind: null, notice: { portal } })
      assert.equal(accountNotice(state.notice)?.title, expectedTitle)
    }

    const legal = normalizeAccountReturnState({ legal: "therapist-agreement-required" })
    assert.deepEqual(legal, {
      kind: null,
      notice: { legal: "therapist-agreement-required" },
    })
    assert.equal(accountNotice(legal.notice)?.title, "Therapist Agreement required")

    const billing = normalizeAccountReturnState({ billing: "existing-subscription" })
    assert.deepEqual(billing, {
      kind: null,
      notice: { billing: "existing-subscription" },
    })
    assert.equal(accountNotice(billing.notice)?.title, "Checkout unavailable")

    assert.match(accountPageSource, /checkout === "cancelled"/)
    assert.match(accountPageSource, /portal === "error"/)
  })

  it("maps profile and credential action outcomes to explicit safe notices", () => {
    const { accountNotice, normalizeAccountReturnState } = loadAccountReturnContract()
    const cases = [
      [{ profile: "saved" }, "Profile saved"],
      [{ profile: "save-failed" }, "Profile could not be saved"],
      [{ credential: "submitted" }, "Verification submitted"],
      [{ credential: "submit-failed" }, "Verification could not be submitted"],
    ]
    for (const [params, expectedTitle] of cases) {
      const state = normalizeAccountReturnState(params)
      assert.deepEqual(state, { kind: null, notice: params })
      assert.equal(accountNotice(state.notice)?.title, expectedTitle)
    }
    assert.match(accountPageSource, /<PendingSubmissionForm action=\{saveProfileAction\}/)
    assert.match(accountPageSource, /pendingLabel="Saving profile…"/)
    assert.match(accountPageSource, /<PendingSubmissionForm action=\{requestCredentialVerificationAction\}/)
    assert.match(accountPageSource, /pendingLabel="Submitting verification…"/)
  })

  it("builds stable account tab hrefs for route-backed navigation", () => {
    assert.equal(getAccountTabHref("orders-invoices"), "/account?tab=orders-invoices")
    assert.equal(getAccountTabHref("profile"), "/account?tab=profile")
    assert.equal(getAccountTabHref("security"), "/account?tab=security")
    assert.equal(getAccountTabHref("membership"), "/account?tab=membership")
  })

  it("formats account dates with a stable ISO calendar date", () => {
    assert.equal(formatAccountDate(new Date("2026-05-18T14:30:00.000Z")), "2026-05-18")
  })

  it("formats account dates from the local calendar day instead of UTC", () => {
    assert.equal(formatAccountDate(new Date(2026, 4, 18, 23, 30)), "2026-05-18")
  })

  it("points existing subscribers to the focused membership-change action", () => {
    const source = `export ${topLevelFunctionSource(
      accountPageSource,
      "billingMessage",
      "app/account/page.tsx",
    )}`
    const { billingMessage } = loadCompiledModule(
      source,
      "app/account/billing-message.test.ts",
    )

    assert.equal(
      billingMessage("existing-subscription"),
      "Use Change support amount or billing period to update your current membership.",
    )
  })

  it("describes premium-background access without presenting color controls as a membership benefit", async () => {
    const active = await renderMembershipTab({
      features: ["premium_backgrounds"],
      subscriptions: [subscription("active")],
      stripeCustomer: { stripeCustomerId: "cus_123" },
    })
    const text = elementText(active)
    const statusTiles = findElements(
      active,
      (element) => element.type === "status-tile",
    ).map((element) => element.props)

    assert.match(text, /free Chimer color controls apply to every background you can access/i)
    assert.match(text, /every premium background/i)
    assert.ok(statusTiles.some(({ label, value }) => label === "Premium backgrounds" && value === "Included"))
    assert.ok(statusTiles.every(({ label }) => label !== "Saved Chimer colors"))
    assert.match(text, /backgrounds bought for \$1 or claimed with a credit remain permanently available/i)
    assert.doesNotMatch(text, /Paid memberships currently unlock Chimer custom colors/)
    assert.doesNotMatch(text, /Basic Chimer remains free/)
    assert.doesNotMatch(accountPageSource, /Custom colors unlocked/)
    assert.doesNotMatch(accountPageSource, /label="Chimer colors"/)
    assert.match(
      accountPageSource,
      /sessionHasActiveMembershipBenefits\(session\.user as AccountSessionUser\)/,
    )
  })

  it("shows every active temporary feature expiration without grant, actor, or note identifiers", async () => {
    const tree = await renderMembershipTab({
      features: ["premium_backgrounds", "external_calendar_sync"],
      featureAccess: [{
        featureKey: "premium_backgrounds",
        sources: [
          {
            source: "temporary",
            expiresAt: "2026-09-01T00:00:00.000Z",
            grantId: "privacy-grant-sentinel",
            grantedById: "privacy-actor-sentinel",
            internalNote: "privacy-note-sentinel",
            idempotencyKey: "privacy-operation-sentinel",
          },
          { source: "temporary", expiresAt: "2026-10-01T00:00:00.000Z" },
        ],
      }, {
        featureKey: "external_calendar_sync",
        sources: [{ source: "temporary", expiresAt: "2026-09-15T00:00:00.000Z" }],
      }],
      subscriptions: [],
      stripeCustomer: null,
    })
    const text = elementText(tree)
    const temporaryRows = findElements(
      tree,
      (element) => element.type === "li" && typeof element.props["data-temporary-feature-key"] === "string",
    )
    const temporaryAccessContainer = findElement(
      tree,
      (element) => element.props["data-account-temporary-access"] === "active",
    )

    assert.match(text, /Temporary feature access/i)
    assert.match(text, /Premium backgrounds/i)
    assert.match(text, /External calendar sync/i)
    assert.match(text, /2026-09-01/)
    assert.match(text, /2026-10-01/)
    assert.match(text, /2026-09-15/)
    assert.equal(temporaryRows.length, 3)
    assert.ok(temporaryAccessContainer)
    assert.deepEqual(temporaryRows.map((row) => ({
      featureKey: row.props["data-temporary-feature-key"],
      expiresAt: row.props["data-temporary-expires-at"],
    })), [
      { featureKey: "external_calendar_sync", expiresAt: "2026-09-15T00:00:00.000Z" },
      { featureKey: "premium_backgrounds", expiresAt: "2026-09-01T00:00:00.000Z" },
      { featureKey: "premium_backgrounds", expiresAt: "2026-10-01T00:00:00.000Z" },
    ])
    const serializedTree = JSON.stringify(tree)
    for (const sentinel of [
      "privacy-grant-sentinel",
      "privacy-actor-sentinel",
      "privacy-note-sentinel",
      "privacy-operation-sentinel",
    ]) {
      assert.doesNotMatch(text, new RegExp(sentinel))
      assert.doesNotMatch(serializedTree, new RegExp(sentinel))
    }
    assert.match(accountPageSource, /key=\{`\$\{access\.featureKey\}:\$\{access\.expiresAt\}`\}/)
    assert.doesNotMatch(accountPageSource, /temporaryAccess\.map\(\(access, index\)/)
    assert.doesNotMatch(text, /grant-|actor|internal note|idempotency/i)
    assert.doesNotMatch(accountPageSource, /temporaryAccess.*grantId|temporaryAccess.*grantedById/i)
  })

  it("omits temporary-access expiration presentation when request-time entitlements have no active temporary source", async () => {
    const tree = await renderMembershipTab({
      features: ["premium_backgrounds"],
      featureAccess: [{
        featureKey: "premium_backgrounds",
        sources: [{ source: "membership", expiresAt: null }],
      }],
      subscriptions: [subscription("active")],
      stripeCustomer: { stripeCustomerId: "cus_123" },
    })

    assert.doesNotMatch(elementText(tree), /Temporary feature access/i)
  })

  it("keeps Account pricing and billing Portal actions independently gated", async () => {
    const terminalWithPortal = await renderMembershipTab({
      subscriptions: [subscription("canceled")],
      stripeCustomer: { stripeCustomerId: "cus_123" },
    })
    const terminalPricing = membershipPricingProps(terminalWithPortal)
    assert.equal(terminalPricing.mode, "checkout")
    assert.equal(terminalPricing.portalActionAvailable, true)
    assert.equal(billingPortalForms(terminalWithPortal).length, 1)

    const blockingWithPortal = await renderMembershipTab({
      subscriptions: [subscription("active")],
      stripeCustomer: { stripeCustomerId: "cus_123" },
    })
    const blockingPricing = membershipPricingProps(blockingWithPortal)
    assert.equal(blockingPricing.mode, "portal")
    assert.equal(blockingPricing.portalActionAvailable, true)
    assert.equal(billingPortalForms(blockingWithPortal).length, 1)

    const terminalWithoutPortal = await renderMembershipTab({
      subscriptions: [subscription("canceled")],
      stripeCustomer: null,
    })
    const unavailablePricing = membershipPricingProps(terminalWithoutPortal)
    assert.equal(unavailablePricing.mode, "checkout")
    assert.equal(unavailablePricing.portalActionAvailable, false)
    assert.equal(billingPortalForms(terminalWithoutPortal).length, 0)
    assert.match(
      elementText(terminalWithoutPortal),
      /Billing management is temporarily unavailable\. Contact support/,
    )
  })

  it("filters account navigation by label, group, and description", () => {
    assert.deepEqual(
      filterAccountPageGroups("billing").flatMap((group) => group.items.map((item) => item.id)),
      ["membership", "orders-invoices"],
    )
    assert.deepEqual(
      filterAccountPageGroups("sidebar position").flatMap((group) => group.items.map((item) => item.id)),
      ["app-settings"],
    )
    assert.deepEqual(
      filterAccountPageGroups("app bar").flatMap((group) => group.items.map((item) => item.id)),
      ["app-settings"],
    )
    assert.deepEqual(
      filterAccountPageGroups("quick actions").flatMap((group) => group.items.map((item) => item.id)),
      ["app-settings"],
    )
    assert.deepEqual(
      filterAccountPageGroups("drawer side").flatMap((group) => group.items.map((item) => item.id)),
      ["app-settings"],
    )
    assert.deepEqual(
      filterAccountPageGroups("therapist defaults").flatMap((group) => group.items.map((item) => item.id)),
      ["therapist-defaults"],
    )
    assert.deepEqual(
      filterAccountPageGroups("anatomy browser").flatMap((group) => group.items.map((item) => item.id)),
      ["tools"],
    )
    assert.deepEqual(
      filterAccountPageGroups("practice").map((group) => group.id),
      ["practice"],
    )
    assert.deepEqual(
      filterAccountPageGroups("authenticator").flatMap((group) => group.items.map((item) => item.id)),
      ["security"],
    )
    assert.deepEqual(filterAccountPageGroups("not-a-real-setting"), [])
  })

  it("keeps the signed-in account page led by navigation instead of a duplicate home card", async () => {
    const [accountPage, accountShell] = await Promise.all([
      readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/account/account-settings-shell.tsx", import.meta.url), "utf8"),
    ])

    assert.doesNotMatch(accountPage, /Account home/)
    assert.match(accountPage, /summaryLinks=\{accountSummaryLinks\}/)
    assert.match(accountShell, /aria-label="Account shortcuts"/)
  })
})

/** Builds a minimal Supporter subscription fixture for one Stripe status. */
function subscription(status) {
  return {
    id: `sub_${status}`,
    status,
    membershipLevel: "SUPPORTER",
    currentPeriodEnd: null,
    couponId: null,
  }
}

/**
 * Finds the pricing-card node, asserts its shared fixture props, and returns
 * the complete props used for mode and Portal gating checks.
 */
function membershipPricingProps(tree) {
  const pricingCards = findElement(
    tree,
    (element) => element.type === "membership-pricing-cards",
  )
  assert.ok(pricingCards)
  assert.deepEqual(pricingCards.props.catalog, { id: "pricing-catalog" })
  assert.equal(pricingCards.props.activeMembershipLevel, "SUPPORTER")
  return pricingCards.props
}

/** Collects rendered POST forms that open the Stripe Billing Portal. */
function billingPortalForms(tree) {
  return findElements(
    tree,
    (element) => (
      element.type === "form"
      && element.props.action === "/api/billing/portal"
      && element.props.method === "post"
    ),
  )
}

/**
 * Renders the production MembershipTab with feature-key values injected into
 * the mocked account-surface entitlement response. It returns the rendered
 * MembershipTab tree while replacing only I/O and visual dependencies, so
 * pricing and Portal gating remain behavioral; membershipPricingProps extracts
 * pricing-card props separately.
 */
async function renderMembershipTab({
  features = [],
  featureAccess = [],
  subscriptions,
  stripeCustomer,
}) {
  const membershipTabSource = topLevelFunctionSource(
    accountPageSource,
    "MembershipTab",
    "app/account/page.tsx",
  )

  const imports = `
    import {
      Button,
      BILLING_PORTAL_DESTINATIONS,
      Card,
      CardContent,
      CardDescription,
      CardHeader,
      CardTitle,
      CreditCard,
      FEATURE_KEYS,
      MembershipPricingCards,
      StatusTile,
      SupporterInterestsPanel,
      TabPanelIntro,
      TabsContent,
      cn,
      formatAccountDate,
      formatMembershipLevel,
      getAccountSurfaceData,
      resolveMembershipPricingMode,
      settingsInsetClassName,
      settingsSurfaceClassName,
    } from "test-dependencies"
  `
  const source = `${imports}\nexport ${membershipTabSource}`
  const Div = passThroughElement("div")
  const compiledMembershipTab = loadCompiledModule(source, "app/account/membership-tab.test.tsx", {
    "react/jsx-runtime": {
      Fragment: Symbol.for("account-membership-tab-test.fragment"),
      jsx: createElement,
      jsxs: createElement,
    },
    "test-dependencies": {
      Button: passThroughElement("button"),
      BILLING_PORTAL_DESTINATIONS,
      Card: Div,
      CardContent: Div,
      CardDescription: Div,
      CardHeader: Div,
      CardTitle: Div,
      CreditCard: passThroughElement("credit-card"),
      FEATURE_KEYS: {
        premiumBackgrounds: "premium_backgrounds",
      },
      MembershipPricingCards: passThroughElement("membership-pricing-cards"),
      StatusTile: passThroughElement("status-tile"),
      SupporterInterestsPanel: passThroughElement("supporter-interests"),
      TabPanelIntro: passThroughElement("tab-panel-intro"),
      TabsContent: passThroughElement("tabs-content"),
      cn: (...classes) => classes.filter(Boolean).join(" "),
      formatAccountDate,
      formatMembershipLevel: (level) => level,
      getAccountSurfaceData: async () => ({
        pricingCatalog: { id: "pricing-catalog" },
        membershipSummary: {
          entitlements: {
            features,
            featureAccess,
            level: "SUPPORTER",
            paidLevel: "SUPPORTER",
          },
          stripeCustomer,
          subscriptions,
        },
      }),
      resolveMembershipPricingMode,
      settingsInsetClassName: "settings-inset",
      settingsSurfaceClassName: "settings-surface",
    },
  })

  return renderFunctionComponents(await compiledMembershipTab.MembershipTab({
    userId: "user_123",
    sessionUser: {
      email: "supporter@example.com",
      name: "Supporter",
    },
  }))
}
