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

  test("Admin previews and confirms one positive background-credit goodwill grant", async ({ page }, testInfo) => {
    const fixture = createBrowserAdminFixtureIdentity(testInfo.project.name)
    await page.goto(`/admin/users/${encodeURIComponent(fixture.target.id)}?section=access`, { waitUntil: "domcontentloaded" })
    const creditCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Add background credits" }),
    })
    const submitButton = creditCard.getByRole("button", { name: "Add background credits" })
    await expect(creditCard.getByText("Current persisted balance: 0", { exact: true })).toBeVisible()
    await expect(creditCard.getByText("Automatic verified-account allocation: +2", { exact: true })).toBeVisible()
    await expect(submitButton).toBeDisabled()

    const fivePreset = creditCard.getByRole("button", { name: "+5" })
    await fivePreset.focus()
    await expect(fivePreset).toBeFocused()
    await fivePreset.press("Enter")
    await expect(creditCard.getByText("Admin grant: +5", { exact: true })).toBeVisible()
    await expect(creditCard.getByText("Resulting balance: 2 + 5 = 7", { exact: true })).toBeVisible()

    const customAmount = creditCard.getByLabel("Custom credit amount")
    await customAmount.fill("3")
    await expect(creditCard.getByText("Admin grant: +3", { exact: true })).toBeVisible()
    await expect(creditCard.getByText("Resulting balance: 2 + 3 = 5", { exact: true })).toBeVisible()
    await creditCard.getByLabel("Reason").selectOption("BACKGROUND_CREDIT_GOODWILL")
    const confirmation = creditCard.locator('input[name="confirmation"]')
    await creditCard.getByLabel(/I confirm that 3 background credits will be added/).check()
    await expect(submitButton).toBeEnabled()
    await customAmount.fill("4")
    await expect(confirmation).toBeChecked({ checked: false })
    await expect(submitButton).toBeDisabled()
    await customAmount.fill("3")
    await creditCard.getByLabel(/I confirm that 3 background credits will be added/).check()
    await expect(submitButton).toBeEnabled()
    await submitButton.focus()
    await expect(submitButton).toBeFocused()
    await submitButton.press("Enter")

    await expect(creditCard.getByText("Current balance: 5", { exact: true })).toBeVisible()
    await expect(creditCard.getByText(/3 background credits were added\. The balance changed from 2 to 5\./i)).toBeVisible()
    const freshConfirmation = creditCard.getByLabel(/I confirm that 1 background credit will be added/)
    await expect(freshConfirmation).toBeChecked({ checked: false })
    await expect(submitButton).toBeDisabled()

    await page.getByRole("navigation", { name: "Account detail sections" }).getByRole("link", { name: "Activity" }).click()
    const activity = page.getByRole("listitem").filter({ hasText: "Background credits added" }).first()
    await expect(activity).toContainText("Effective value: +3 credits")
    await expect(activity).toContainText("Email delivery")
  })

  test("Admin previews billing goodwill confirmation without creating a Stripe transaction", async ({ page }, testInfo) => {
    const fixture = createBrowserAdminFixtureIdentity(testInfo.project.name)
    const matchingPostRequests: string[] = []
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes(`/admin/users/${encodeURIComponent(fixture.target.id)}`)) {
        matchingPostRequests.push(request.url())
      }
    })
    await page.goto(`/admin/users/${encodeURIComponent(fixture.target.id)}?section=billing`, { waitUntil: "domcontentloaded" })
    await page.evaluate(() => {
      document.documentElement.dataset.billingGoodwillFormSubmissions = "0"
      document.addEventListener("submit", () => {
        const current = Number(document.documentElement.dataset.billingGoodwillFormSubmissions ?? "0")
        document.documentElement.dataset.billingGoodwillFormSubmissions = String(current + 1)
      }, { capture: true })
    })
    const billingCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Add invoice credit" }),
    })
    await expect(billingCard.getByText("Current Stripe credit", { exact: true })).toBeVisible()
    await expect(billingCard.getByText("Projected next invoice", { exact: true })).toBeVisible()
    await expect(billingCard.getByText("$0.00", { exact: true })).toBeVisible()
    await expect(billingCard.getByText("$20.00", { exact: true })).toBeVisible()
    await expect(billingCard.getByText("active", { exact: true })).toBeVisible()
    for (const amount of ["$1.00", "$2.00", "$5.00", "$10.00", "$20.00", "$50.00"]) {
      await expect(billingCard.getByRole("button", { name: amount, exact: true })).toBeVisible()
    }
    const submit = billingCard.getByRole("button", { name: "Apply invoice credit" })
    await expect(submit).toBeDisabled()
    await billingCard.getByLabel("Reason").selectOption("BILLING_GOODWILL")
    await billingCard.getByLabel("Confirmation email").fill(fixture.target.email)
    await billingCard.getByLabel("Exact dollar amount").fill("1.00")
    await expect(submit).toBeEnabled()
    const overflow = await page.locator("html").evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(overflow).toBe(false)
    const formSubmissionCount = Number(await page.locator("html").getAttribute("data-billing-goodwill-form-submissions"))
    expect(formSubmissionCount).toBe(0)
    expect(matchingPostRequests).toEqual([])
  })

  test("Admin grants and append-only revokes one bounded temporary feature with Account expiration evidence", async ({ page, browser }, testInfo) => {
    const fixture = createBrowserAdminFixtureIdentity(testInfo.project.name)
    const baseURL = String(testInfo.project.use.baseURL)
    const targetContext = await browser.newContext()
    try {
      await installSignedInSessionCookie(targetContext, baseURL, fixture.target)
      const targetPage = await targetContext.newPage()
      await page.goto(`/admin/users/${encodeURIComponent(fixture.target.id)}?section=access`, { waitUntil: "domcontentloaded" })

      const temporaryCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: "Temporary feature access" }),
      })
      const feature = temporaryCard.getByLabel("Temporary feature")
      const allowedOptions = await feature.locator("option").evaluateAll((options) => (
        options.map((option) => ({ value: (option as HTMLOptionElement).value, label: option.textContent?.trim() }))
      ))
      expect(allowedOptions).toEqual([
        { value: "premium_backgrounds", label: "Premium backgrounds" },
        { value: "therapist_documentation_tools", label: "Therapist documentation tools" },
        { value: "calendar_basic_scheduling", label: "Basic calendar scheduling" },
        { value: "calendar_full_scheduling", label: "Full calendar scheduling" },
        { value: "external_calendar_sync", label: "External calendar sync" },
      ])
      for (const excluded of [
        "chimer_custom_colors",
        "practice_management",
        "calendar_team_scheduling",
        "cloud_storage",
        "phi_storage_tools",
      ]) await expect(feature.locator(`option[value="${excluded}"]`)).toHaveCount(0)

      for (const days of [7, 30, 90]) {
        await expect(temporaryCard.getByRole("button", { name: `${days} days` })).toBeVisible()
      }
      const customDuration = temporaryCard.getByLabel("Custom duration")
      await expect(customDuration).toHaveAttribute("min", "1")
      await expect(customDuration).toHaveAttribute("max", "365")
      await expect(customDuration).toHaveAttribute("step", "1")
      const confirmation = temporaryCard.getByLabel(/I confirm this exact temporary grant/i)
      await temporaryCard.getByLabel("Reason").selectOption("ACCESS_REMEDIATION")
      await confirmation.check()
      await feature.selectOption("external_calendar_sync")
      await expect(confirmation).toBeChecked({ checked: false })
      await feature.selectOption("premium_backgrounds")
      await confirmation.check()
      await customDuration.fill("14")
      await expect(confirmation).toBeChecked({ checked: false })
      const previewStartsAt = await temporaryCard.locator('time[data-temporary-preview="starts"]').getAttribute("datetime")
      const previewExpiresAt = await temporaryCard.locator('time[data-temporary-preview="expires"]').getAttribute("datetime")
      if (!previewStartsAt || !previewExpiresAt) throw new Error("Temporary-access preview requires start and expiration timestamps.")
      expect(new Date(previewExpiresAt).getTime() - new Date(previewStartsAt).getTime()).toBe(14 * 24 * 60 * 60 * 1_000)
      await expect(temporaryCard.getByText(/Starts/)).toBeVisible()
      await expect(temporaryCard.getByText(/Expires/)).toBeVisible()
      await confirmation.check()
      const grantButton = temporaryCard.getByRole("button", { name: "Grant temporary access" })
      await expect(grantButton).toBeEnabled()
      await grantButton.press("Enter")

      await expect(temporaryCard.getByText(/Temporary Premium backgrounds access was granted through/i)).toBeVisible()
      await expect(confirmation).toBeChecked({ checked: false })
      await expect(grantButton).toBeDisabled()
      const activeGrant = temporaryCard.locator('[data-temporary-grant="active"]').first()
      await expect(activeGrant).toContainText("Premium backgrounds")
      await expect(activeGrant).toContainText("Starts")
      await expect(activeGrant).toContainText("Expires")
      const persistedStart = activeGrant.locator('time[data-temporary-evidence="starts"]')
      const persistedExpiry = activeGrant.locator('time[data-temporary-evidence="expires"]')
      await expect(persistedStart).toHaveCount(1)
      await expect(persistedExpiry).toHaveCount(1)
      const persistedStartsAt = await persistedStart.getAttribute("datetime")
      const persistedExpiresAt = await persistedExpiry.getAttribute("datetime")
      if (!persistedStartsAt || !persistedExpiresAt) throw new Error("Persisted temporary grant requires start and expiration timestamps.")
      expect(new Date(persistedExpiresAt).getTime() - new Date(persistedStartsAt).getTime()).toBe(14 * 24 * 60 * 60 * 1_000)
      const revokeConfirmation = activeGrant.getByLabel(/I confirm this append-only revocation/i)
      await expect(revokeConfirmation).toBeChecked({ checked: false })

      await targetPage.goto(new URL("/account?tab=membership", baseURL).href, { waitUntil: "domcontentloaded" })
      const accountTemporaryAccess = targetPage.locator('[data-account-temporary-access="active"]')
      await expect(accountTemporaryAccess).toContainText("Premium backgrounds")
      await expect(accountTemporaryAccess).toContainText(persistedExpiresAt.slice(0, 10))

      await activeGrant.getByLabel("Reason").selectOption("ACCESS_REMEDIATION")
      await revokeConfirmation.check()
      const revokeButton = activeGrant.getByRole("button", { name: "Revoke this temporary grant" })
      await expect(revokeButton).toBeEnabled()
      await revokeButton.press("Enter")
      await expect(temporaryCard.getByText(/one temporary Premium backgrounds grant was revoked/i)).toBeVisible()
      await expect(temporaryCard.getByText("No active temporary grants.", { exact: true })).toBeVisible()

      await page.getByRole("navigation", { name: "Account detail sections" }).getByRole("link", { name: "Activity" }).click()
      await expect(page.getByRole("listitem").filter({ hasText: "Temporary feature access granted" })).toHaveCount(1)
      await expect(page.getByRole("listitem").filter({ hasText: "Temporary feature access revoked" })).toHaveCount(1)

      await targetPage.reload({ waitUntil: "domcontentloaded" })
      await expect(targetPage.getByRole("heading", { name: "Temporary feature access" })).toHaveCount(0)
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
    await expect(page.locator('[data-detail-key="Two-factor authentication"] [data-detail-value]')).toHaveText("No")
  })
})
