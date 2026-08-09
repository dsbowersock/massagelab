import { expect, test } from "@playwright/test"
import {
  installAdminUserOperationsFixture,
  removeBrowserAdminFixture,
} from "./admin-user-operations-fixture"
import { hasBrowserAdminFixtureQaAuthorization } from "../../lib/admin/browser-qa-authorization"
import { createBrowserAdminFixtureIdentity } from "../../lib/admin/browser-fixture-identity"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

const configuredQaDatabase = hasBrowserAdminFixtureQaAuthorization()
const usesPlaywrightOwnedServer = !["1", "true"].includes(process.env.PLAYWRIGHT_SKIP_WEB_SERVER?.trim().toLowerCase() ?? "")

test.describe("Admin user operations", () => {
  test.beforeEach(async ({ context }, testInfo) => {
    test.skip(!configuredQaDatabase, "Admin user operations browser QA requires DATABASE_URL and MASSAGELAB_BROWSER_QA_DATABASE=1.")
    if (!usesPlaywrightOwnedServer) {
      throw new Error("Admin user operations browser QA requires Playwright's SMTP-disabled spawned server.")
    }
    const baseURL = testInfo.project.use.baseURL
    if (!baseURL) throw new Error("Admin user operations browser QA requires a configured base URL.")
    await installAdminUserOperationsFixture(context, baseURL, testInfo.project.name)
  })

  test.afterEach(async ({}, testInfo) => {
    if (configuredQaDatabase) await removeBrowserAdminFixture(testInfo.project.name)
  })

  test("Admin navigates from the directory to an independently loaded detail section without overflow", async ({ page }, testInfo) => {
    const fixture = createBrowserAdminFixtureIdentity(testInfo.project.name)
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" })
    const targetLink = page.getByRole("link", { name: fixture.target.name })
    await expect(targetLink).toBeVisible()
    const directoryOverflow = await page.locator("html").evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(directoryOverflow).toBe(false)
    await targetLink.focus()
    await expect(targetLink).toBeFocused()
    await targetLink.press("Enter")

    await expect(page.getByRole("heading", { name: fixture.target.name })).toBeVisible()
    const sectionNavigation = page.getByRole("navigation", { name: "Account detail sections" })
    await expect(sectionNavigation).toBeVisible()
    await expect(sectionNavigation.getByRole("link", { name: "Security" })).toBeVisible()
    await sectionNavigation.getByRole("link", { name: "Security" }).click()
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible()
    const detailOverflow = await page.locator("html").evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(detailOverflow).toBe(false)
  })

  test("Admin confirms a delegated role change and invalidates the target JWT", async ({ page, browser }, testInfo) => {
    const fixture = createBrowserAdminFixtureIdentity(testInfo.project.name)
    const baseURL = String(testInfo.project.use.baseURL)
    const targetContext = await browser.newContext()
    try {
      await installSignedInSessionCookie(targetContext, baseURL, fixture.target)
      const targetPage = await targetContext.newPage()
      await targetPage.goto(new URL("/account", baseURL).href, { waitUntil: "domcontentloaded" })
      const sessionUrl = new URL("/api/auth/session", baseURL).href
      const beforeSessionResponse = await targetPage.request.get(sessionUrl)
      expect(beforeSessionResponse.ok()).toBe(true)
      const beforeSession = await beforeSessionResponse.json()
      expect(beforeSession.user?.id).toBe(fixture.target.id)

      await page.goto(`/admin/users/${encodeURIComponent(fixture.target.id)}?section=access`, { waitUntil: "domcontentloaded" })
      const reviewerCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: "Anatomy Reviewer" }),
      })
      const editorCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: "Anatomy Editor" }),
      })
      await expect(page.getByText(
        "Reviewer can review anatomy content. Editor can review and edit anatomy content.",
        { exact: true },
      )).toBeVisible()
      await expect(reviewerCard.getByText("Current state: Not assigned (ABSENT)", { exact: true })).toBeVisible()
      await expect(reviewerCard.getByText("After confirmation: Assigned (VERIFIED)", { exact: true })).toBeVisible()
      await expect(editorCard.getByText("Current state: Not assigned (ABSENT)", { exact: true })).toBeVisible()
      await expect(editorCard.getByText("After confirmation: Assigned (VERIFIED)", { exact: true })).toBeVisible()
      await reviewerCard.getByLabel("Reason").selectOption("ROLE_ASSIGNMENT")
      await reviewerCard.getByLabel(/I understand this exact change will sign the user out/).check()
      const assignButton = reviewerCard.getByRole("button", { name: "Assign Anatomy Reviewer" })
      await expect(assignButton).toBeEnabled()
      await assignButton.focus()
      await expect(assignButton).toBeFocused()
      await assignButton.press("Enter")
      await expect(reviewerCard.getByText("Current state: Assigned (VERIFIED)", { exact: true })).toBeVisible()
      await expect(reviewerCard.getByText("After confirmation: Not assigned (REVOKED)", { exact: true })).toBeVisible()
      const revokeButton = reviewerCard.getByRole("button", { name: "Revoke Anatomy Reviewer" })
      const revokeConfirmation = reviewerCard.getByLabel(/I understand this exact change will sign the user out/)
      await expect(revokeConfirmation).toBeChecked({ checked: false })
      await expect(revokeButton).toBeDisabled()
      const detailOverflow = await page.locator("html").evaluate((element) => element.scrollWidth > element.clientWidth)
      expect(detailOverflow).toBe(false)

      await targetPage.reload({ waitUntil: "domcontentloaded" })
      const afterSessionResponse = await targetPage.request.get(sessionUrl)
      expect(afterSessionResponse.ok()).toBe(true)
      const afterSession = await afterSessionResponse.json()
      expect(afterSession?.user?.id).toBeUndefined()
    } finally {
      await targetContext.close()
    }
  })
})
