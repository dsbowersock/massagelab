import { expect, test } from "@playwright/test"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"
import { installNativeSubmitSnapshotRecorder } from "./native-submission-snapshot"

const PRIVATE_QA_SKIP_REASON = "Membership return database-backed browser QA requires an explicitly approved disposable target/fingerprint and applied 20260828130000_membership_subscription_convergence migration."
const hasPrivateQaAuthorization = isBrowserQaDatabaseTargetAuthorized(process.env)

/** Flags provider or provider-starting billing calls while allowing database-only status reads. */
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
    await expect(page.getByText("Sign in to check your membership update", { exact: true })).toBeVisible()
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

  test("Billing attention claims one delayed portal POST with accessible pending feedback", async ({ context, page }, testInfo) => {
    const fixture = await import("./membership-return-status-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    await fixture.installMembershipReturnStatusFixture({
      context,
      baseURL,
      projectName: testInfo.project.name,
      status: "past_due",
    })
    let portalPosts = 0
    let portalRouteStarted = false
    let markPortalRouteFinished: () => void = () => undefined
    let releasePortalRoute: () => void = () => undefined
    const portalRouteFinish = new Promise<void>((resolve) => {
      markPortalRouteFinished = resolve
    })
    const portalRouteRelease = new Promise<void>((resolve) => {
      releasePortalRoute = resolve
    })
    await page.route("**/api/billing/portal", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback()
        return
      }
      portalPosts += 1
      portalRouteStarted = true
      try {
        await portalRouteRelease
        await route.fulfill({ status: 204, body: "" })
      } finally {
        markPortalRouteFinished()
      }
    })

    await page.goto("/account?tab=membership&portal=returned", { waitUntil: "domcontentloaded" })
    const form = page.locator('form[action="/api/billing/portal"]')
    const pendingLabel = "Opening billing portal…"
    const recorder = await installNativeSubmitSnapshotRecorder({ page, form, pendingLabel })
    await form.evaluate((element) => {
      let attempts = 0
      const recordDuplicatePrevention = (event: SubmitEvent) => {
        if (event.target !== element) return
        attempts += 1
        if (attempts !== 2) return
        element.dataset.duplicateSubmitPrevented = String(event.defaultPrevented)
        document.removeEventListener("submit", recordDuplicatePrevention)
      }
      document.addEventListener("submit", recordDuplicatePrevention)
    })

    try {
      await form.getByRole("button", { name: "Manage billing account" }).evaluate((element) => {
        ;(element as HTMLButtonElement).click()
      })

      const snapshot = await recorder.snapshot
      await expect.poll(
        () => portalRouteStarted,
        { message: "billing portal route must start before pending-state assertions", timeout: 5_000 },
      ).toBe(true)
      await expect(form).toHaveAttribute("data-duplicate-submit-prevented", "true")
      expect(snapshot).toMatchObject({
        buttonAriaBusy: "true",
        buttonDisabled: true,
        formAriaBusy: "true",
        pendingCopyVisible: true,
        statusCount: 1,
        statusText: pendingLabel,
      })
      expect(portalPosts).toBe(1)
    } finally {
      releasePortalRoute()
      if (portalRouteStarted) await portalRouteFinish
    }
  })
})
