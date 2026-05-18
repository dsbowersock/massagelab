import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  accountPageGroups,
  accountPageNavigationItems,
  accountPageSectionIds,
  accountPageTabs,
  filterAccountPageGroups,
  getAccountTabHref,
  selectAccountTab,
} from "../lib/account-page.js"

describe("Account page tab model", () => {
  it("groups existing account sections into stable account navigation without dropping current features", () => {
    assert.deepEqual(accountPageGroups.map((group) => group.id), [
      "personal",
      "payments",
      "practice",
    ])
    assert.deepEqual(accountPageGroups.map((group) => group.label), [
      "Personal account",
      "Payments & plans",
      "Practice management",
    ])
    assert.deepEqual(accountPageTabs.map((tab) => tab.id), [
      "overview",
      "profile",
      "security",
      "credentials",
      "app-settings",
      "therapist-defaults",
      "sync",
      "membership",
      "tools",
    ])
    assert.equal(accountPageTabs[2].id, "security")

    assert.deepEqual(accountPageSectionIds, [
      "account-summary",
      "quick-actions",
      "profile-defaults",
      "security-settings",
      "role-verification",
      "app-layout-settings",
      "app-theme-settings",
      "local-therapist-defaults",
      "preference-sync",
      "clinical-sync",
      "membership",
      "membership-pricing",
      "subscription-status",
      "billing-portal",
      "anatomy-feedback",
      "content-tools",
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
      "orders-invoices",
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
    assert.equal(getAccountTabHref("profile"), "/account?tab=profile")
    assert.equal(getAccountTabHref("security"), "/account?tab=security")
    assert.equal(getAccountTabHref("membership"), "/account?tab=membership")
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
      filterAccountPageGroups("therapist defaults").flatMap((group) => group.items.map((item) => item.id)),
      ["therapist-defaults"],
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
})
