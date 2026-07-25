import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
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
import { resolveMembershipPricingMode } from "../lib/membership.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const accountPageSource = await readFile(
  new URL("../app/account/page.tsx", import.meta.url),
  "utf8",
)

describe("Account page tab model", () => {
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
 * Executes the production MembershipTab function while replacing only its I/O
 * and visual dependencies, so pricing and Portal gating remain behavioral.
 */
async function renderMembershipTab({
  subscriptions,
  stripeCustomer,
}) {
  const functionStart = accountPageSource.indexOf("async function MembershipTab")
  assert.notEqual(
    functionStart,
    -1,
    "Account page source must contain the MembershipTab function",
  )
  const functionEnd = accountPageSource.indexOf(
    "\nasync function BackgroundCommerceTab",
    functionStart,
  )
  assert.notEqual(
    functionEnd,
    -1,
    "MembershipTab extraction must end at BackgroundCommerceTab",
  )
  assert.ok(
    functionEnd > functionStart,
    "MembershipTab extraction must end after its start marker",
  )

  const imports = `
    import {
      Button,
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
  const source = `${imports}\nexport ${accountPageSource.slice(functionStart, functionEnd)}`
  const Div = passThroughElement("div")
  const compiledMembershipTab = loadCompiledModule(source, "app/account/membership-tab.test.tsx", {
    "react/jsx-runtime": {
      Fragment: Symbol.for("account-membership-tab-test.fragment"),
      jsx: createElement,
      jsxs: createElement,
    },
    "test-dependencies": {
      Button: passThroughElement("button"),
      Card: Div,
      CardContent: Div,
      CardDescription: Div,
      CardHeader: Div,
      CardTitle: Div,
      CreditCard: passThroughElement("credit-card"),
      FEATURE_KEYS: { chimerCustomColors: "chimer_custom_colors" },
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
            features: [],
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
