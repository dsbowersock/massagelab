import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
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
      "orders-invoices",
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
