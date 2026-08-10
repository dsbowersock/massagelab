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

  test("Admin confirms sign-in token revocation and the target JWT is rejected on refresh", async ({ page, browser }, testInfo) => {
    const fixture = createBrowserAdminFixtureIdentity(testInfo.project.name)
    const baseURL = String(testInfo.project.use.baseURL)
    const targetContext = await browser.newContext()
    try {
      await installSignedInSessionCookie(targetContext, baseURL, fixture.target)
      const targetPage = await targetContext.newPage()
      const sessionUrl = new URL("/api/auth/session", baseURL).href
      const beforeSession = await (await targetPage.request.get(sessionUrl)).json()
      expect(beforeSession.user?.id).toBe(fixture.target.id)

      await page.goto(`/admin/users/${encodeURIComponent(fixture.target.id)}?section=security`, { waitUntil: "domcontentloaded" })
      await expect(page.getByText("Compatibility Session rows", { exact: true })).toBeVisible()
      await expect(page.getByText(/not a count of active JWT sessions or users signed out/i)).toBeVisible()
      const revokeCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: "Revoke sign-in tokens and sessions" }),
      })
      const revokeButton = revokeCard.getByRole("button", { name: "Revoke sign-in tokens and sessions" })
      await expect(revokeButton).toBeDisabled()
      await revokeCard.getByLabel("Reason").selectOption("SECURITY_RECOVERY")
      await expect(revokeButton).toBeDisabled()
      await revokeCard.getByLabel(/I confirm that existing sign-in tokens will be invalidated/).check()
      await expect(revokeButton).toBeEnabled()
      await revokeButton.focus()
      await expect(revokeButton).toBeFocused()
      await revokeButton.press("Enter")
      await expect(revokeCard.getByText(/Existing sign-in tokens were invalidated/)).toBeVisible()

      await targetPage.reload({ waitUntil: "domcontentloaded" })
      const afterSession = await (await targetPage.request.get(sessionUrl)).json()
      expect(afterSession?.user?.id).toBeUndefined()
    } finally {
      await targetContext.close()
    }
  })

  test("Admin creates a fresh failed reset delivery and uses the fresh-token Activity resend", async ({ page }, testInfo) => {
    const fixture = createBrowserAdminFixtureIdentity(testInfo.project.name)
    await page.goto(`/admin/users/${encodeURIComponent(fixture.target.id)}?section=security`, { waitUntil: "domcontentloaded" })
    const resetCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Send password reset" }),
    })
    const resetButton = resetCard.getByRole("button", { name: "Send password reset" })
    await expect(resetButton).toBeDisabled()
    await resetCard.getByLabel("Reason").selectOption("LOGIN_SUPPORT")
    await resetCard.getByLabel(/I confirm this creates a fresh password-reset link/).check()
    await expect(resetButton).toBeEnabled()
    await resetButton.press("Enter")
    await expect(resetCard.getByText(/fresh password-reset link was created, but email delivery failed/i)).toBeVisible()

    await page.getByRole("navigation", { name: "Account detail sections" }).getByRole("link", { name: "Activity" }).click()
    const failedReset = page.getByRole("listitem").filter({ hasText: "Password reset requested" }).first()
    const submittedActivityId = await failedReset.getAttribute("data-activity-id")
    if (!submittedActivityId) throw new Error("Failed password-reset Activity requires a durable row identity.")
    const submittedFailedReset = page.locator(`[data-activity-id="${submittedActivityId}"]`)
    const submittedFeedback = submittedFailedReset.getByRole("status")
    const resendButton = submittedFailedReset.getByRole("button", { name: "Send a new reset link" })
    await expect(resendButton).toBeDisabled()
    await submittedFailedReset.getByLabel("Reason").selectOption("LOGIN_SUPPORT")
    await submittedFailedReset.getByLabel(/I confirm this creates a fresh password-reset link/).check()
    await expect(resendButton).toBeEnabled()
    await resendButton.focus()
    await resendButton.press("Enter")
    await expect(page.getByRole("listitem").filter({ hasText: "Password reset requested" })).toHaveCount(2)
    await expect(submittedFailedReset).toBeVisible()
    await expect(submittedFeedback).toContainText(/fresh password-reset link was created, but email delivery failed/i)
  })

  test("Admin Security is self-read-only and 2FA reset requires the target confirmation email", async ({ page }, testInfo) => {
    const fixture = createBrowserAdminFixtureIdentity(testInfo.project.name)
    await page.goto(`/admin/users/${encodeURIComponent(fixture.operator.id)}?section=security`, { waitUntil: "domcontentloaded" })
    await expect(page.getByText(/cannot perform security remediation on your own account/i)).toBeVisible()
    await expect(page.getByRole("button", { name: "Send password reset" })).toHaveCount(0)

    await page.goto(`/admin/users/${encodeURIComponent(fixture.target.id)}?section=security`, { waitUntil: "domcontentloaded" })
    const twoFactorCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Reset two-factor authentication" }),
    })
    const twoFactorButton = twoFactorCard.getByRole("button", { name: "Reset two-factor authentication" })
    await twoFactorCard.getByLabel("Reason").selectOption("SECURITY_RECOVERY")
    await twoFactorCard.getByLabel("Confirmation email").fill("mismatch@example.test")
    await expect(twoFactorButton).toBeDisabled()
    await twoFactorCard.getByLabel("Confirmation email").fill(fixture.target.email)
    await expect(twoFactorButton).toBeEnabled()
    await twoFactorButton.press("Enter")
    await expect(page.getByText(/Two-factor authentication was reset and existing sign-in tokens were invalidated/)).toBeVisible()
    await expect(page.getByText("Two-factor authentication", { exact: true }).locator("xpath=following-sibling::*[1]")).toHaveText("No")
  })
})
