import { expect, test } from "@playwright/test"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"

const PRIVATE_QA_SKIP_REASON = "Membership return database-backed browser QA requires an explicitly approved disposable target/fingerprint and applied 20260828130000_membership_subscription_convergence migration."
const hasPrivateQaAuthorization = isBrowserQaDatabaseTargetAuthorized(process.env)

function recordsProviderRequest(urlValue: string) {
  const url = new URL(urlValue)
  return url.hostname.endsWith("stripe.com")
    || url.pathname === "/api/billing/checkout"
    || url.pathname === "/api/billing/portal"
}

test.describe("public membership return boundary", () => {
  test("keeps anonymous status private and makes no provider request", async ({ page }) => {
    const providerRequests: string[] = []
    page.on("request", (request) => {
      if (recordsProviderRequest(request.url())) providerRequests.push(request.url())
    })

    await page.goto("/account?tab=membership&checkout=success&session_id=ignored", {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByRole("heading", { name: "Membership & billing" }).first()).toBeVisible()
    await expect(page.getByText("Sign in to manage membership and billing", { exact: true })).toBeVisible()
    await expect(page.locator("[data-membership-return-status]")).toHaveCount(0)

    const statusResponse = await page.evaluate(async () => {
      const response = await fetch("/api/billing/membership-status?session_id=ignored", {
        credentials: "same-origin",
      })
      return {
        body: await response.json(),
        cacheControl: response.headers.get("cache-control"),
        status: response.status,
      }
    })
    expect(statusResponse).toEqual({
      body: { error: "Unauthorized" },
      cacheControl: "private, no-store",
      status: 401,
    })
    expect(providerRequests).toEqual([])
  })
})

test.describe("private persisted membership returns", () => {
  test.beforeEach(() => {
    test.skip(!hasPrivateQaAuthorization, PRIVATE_QA_SKIP_REASON)
  })

  test.afterEach(async ({}, testInfo) => {
    if (!hasPrivateQaAuthorization) return
    const fixture = await import("./membership-return-status-fixture")
    await fixture.removeMembershipReturnStatusFixture(testInfo.project.name)
  })

  test("Checkout keeps an old terminal revision processing before active access settles", async ({ context, page }, testInfo) => {
    const fixture = await import("./membership-return-status-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    await fixture.installMembershipReturnStatusFixture({
      context,
      baseURL,
      projectName: testInfo.project.name,
      status: "incomplete_expired",
    })
    const providerRequests: string[] = []
    let statusReads = 0
    page.on("request", (request) => {
      if (recordsProviderRequest(request.url())) providerRequests.push(request.url())
    })
    page.on("response", async (response) => {
      if (!response.url().includes("/api/billing/membership-status")) return
      statusReads += 1
      if (statusReads === 1) {
        await fixture.updateMembershipReturnStatusFixture({
          projectName: testInfo.project.name,
          status: "active",
        })
      }
    })

    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/account?tab=membership&checkout=success&session_id=ignored", {
      waitUntil: "domcontentloaded",
    })
    const returnStatus = page.locator("[data-membership-return-status]")
    await expect(returnStatus).toHaveAttribute("aria-busy", "true")
    await expect(returnStatus).toContainText(/finalizing your membership/i)
    await expect(returnStatus).not.toContainText(/needs billing attention/i)
    await expect(returnStatus).toContainText(/membership access is active/i)
    await expect(returnStatus).toHaveAttribute("aria-busy", "false")

    const featureLink = page.getByRole("link", { name: "Open premium backgrounds" })
    await featureLink.focus()
    await expect(featureLink).toBeFocused()
    await page.setViewportSize({ width: 844, height: 390 })
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    expect(statusReads).toBeGreaterThanOrEqual(2)
    expect(providerRequests).toEqual([])
  })

  test("Portal shows first-read billing attention while watching a revision", async ({ context, page }, testInfo) => {
    const fixture = await import("./membership-return-status-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    await fixture.installMembershipReturnStatusFixture({
      context,
      baseURL,
      projectName: testInfo.project.name,
      status: "past_due",
    })
    const providerRequests: string[] = []
    let statusReads = 0
    page.on("request", (request) => {
      if (recordsProviderRequest(request.url())) providerRequests.push(request.url())
    })
    page.on("response", async (response) => {
      if (!response.url().includes("/api/billing/membership-status")) return
      statusReads += 1
      if (statusReads === 1) {
        await fixture.updateMembershipReturnStatusFixture({
          projectName: testInfo.project.name,
          status: "active",
        })
      }
    })

    await page.goto("/account?tab=membership&portal=returned", { waitUntil: "domcontentloaded" })
    const returnStatus = page.locator("[data-membership-return-status]")
    await expect(returnStatus).toContainText(/needs billing attention/i)
    await expect(returnStatus).toHaveAttribute("aria-busy", "true")
    await expect(returnStatus).toContainText(/membership access is active/i)
    await expect(returnStatus).toHaveAttribute("aria-busy", "false")
    expect(statusReads).toBeGreaterThanOrEqual(2)
    expect(providerRequests).toEqual([])
  })
})
