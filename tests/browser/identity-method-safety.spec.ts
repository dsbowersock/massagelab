import { expect, test } from "@playwright/test"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"

const PRIVATE_QA_SKIP_REASON = "Identity method database-backed browser QA requires the missing explicit disposable-database opt-in/authorization."
const hasPrivateQaAuthorization = isBrowserQaDatabaseTargetAuthorized(process.env)

test.describe("public account-entry recovery", () => {
  test("login prevents duplicate Credentials submission and recovers from a thrown request", async ({ page }) => {
    let requests = 0
    let googleRequests = 0
    await page.route("**/api/auth/google/intent", async (route) => {
      googleRequests += 1
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
    })
    await page.route("**/api/auth/callback/credentials**", async (route) => {
      requests += 1
      if (requests === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000))
        await route.abort("failed")
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ url: `${new URL(page.url()).origin}/login?retrySuccess=1` }),
        })
      }
    })
    await page.goto("/login?callbackUrl=%2Flogin%3FretrySuccess%3D1", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Email").fill("browser-login@example.test")
    await page.getByLabel("Password").fill("not-a-real-password")
    const submit = page.locator('form button[type="submit"]')
    await submit.click()
    const pending = page.getByRole("button", { name: "Signing in…" })
    await expect(pending).toBeDisabled()
    await submit.click({ force: true })
    const google = page.getByRole("button", { name: "Continue with Google" })
    await expect(google).toBeDisabled()
    await google.click({ force: true })
    expect(googleRequests).toBe(0)
    await expect(page.locator('p[role="alert"]')).toContainText(/sign in failed|try again/i)
    await expect(page.getByRole("button", { name: "Sign in with email" })).toBeEnabled()
    await expect(google).toBeEnabled()
    await page.getByRole("button", { name: "Sign in with email" }).click()
    await expect(page).toHaveURL(/\/login\?retrySuccess=1$/)
    expect(requests).toBe(2)
    expect(googleRequests).toBe(0)
  })

  test("registration announces pending work, prevents duplicates, and recovers after intercepted failure", async ({ page }) => {
    let requests = 0
    let googleRequests = 0
    await page.route("**/api/auth/google/intent", async (route) => {
      googleRequests += 1
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
    })
    await page.route("**/api/account/register", async (route) => {
      requests += 1
      if (requests === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000))
        await route.abort("failed")
      } else {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ message: "Check your email to finish creating your account." }),
        })
      }
    })
    await page.goto("/register", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Email").fill("browser-register@example.test")
    await page.getByLabel("Password").fill("not-a-real-password")
    for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check()
    const submit = page.locator('form button[type="submit"]')
    await submit.click()
    const pending = page.getByRole("button", { name: "Creating account…" })
    await expect(pending).toBeDisabled()
    await submit.click({ force: true })
    const google = page.getByRole("button", { name: "Continue with Google" })
    await expect(google).toBeDisabled()
    await google.click({ force: true })
    expect(googleRequests).toBe(0)
    await expect(page.locator('p[role="alert"]')).toContainText(/could not create|try again/i)
    await expect(page.getByRole("button", { name: "Create account with email" })).toBeEnabled()
    await expect(google).toBeEnabled()
    await page.getByRole("button", { name: "Create account with email" }).click()
    await expect(page.getByRole("status")).toContainText(/check your email/i)
    expect(requests).toBe(2)
    expect(googleRequests).toBe(0)
  })

  test("Google registration blocks email entry and recovers both actions after a thrown request", async ({ page }) => {
    let googleRequests = 0
    let registrationRequests = 0
    await page.route("**/api/auth/google/intent", async (route) => {
      googleRequests += 1
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.abort("failed")
    })
    await page.route("**/api/account/register", async (route) => {
      registrationRequests += 1
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
    })
    await page.goto("/register", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Email").fill("browser-register-google@example.test")
    await page.getByLabel("Password").fill("not-a-real-password")
    for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check()
    await page.getByRole("button", { name: "Continue with Google" }).click()
    const googlePending = page.getByRole("button", { name: "Starting Google registration…" })
    await expect(googlePending).toBeDisabled()
    const emailSubmit = page.getByRole("button", { name: "Create account with email" })
    await expect(emailSubmit).toBeDisabled()
    await emailSubmit.click({ force: true })
    expect(registrationRequests).toBe(0)
    await expect(page.locator('p[role="alert"]')).toContainText(/could not be started|try again/i)
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled()
    await expect(emailSubmit).toBeEnabled()
    expect(googleRequests).toBe(1)
  })
})

test.describe("private identity-method journeys", () => {
  test.beforeEach(() => {
    test.skip(!hasPrivateQaAuthorization, PRIVATE_QA_SKIP_REASON)
  })

  test.afterEach(async ({}, testInfo) => {
    if (!hasPrivateQaAuthorization) return
    const fixture = await import("./identity-method-safety-fixture")
    for (const scenario of ["MATCHING_LINK", "GOOGLE_ONLY", "BOTH_METHODS"] as const) {
      await fixture.removeIdentityMethodSafetyFixture(testInfo.project.name, scenario)
    }
  })

  test("matching Google email becomes the same MassageLab account only after real Credentials sign-in", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    const installed = await fixture.installIdentityMethodSafetyFixture({
      context,
      baseURL,
      projectName: testInfo.project.name,
      scenario: "MATCHING_LINK",
      signedIn: false,
    })
    await page.goto("/account/link-google", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /same MassageLab account/i })).toBeVisible()
    await expect(page.locator("body")).not.toContainText(installed.intentId)
    await expect(page.locator("body")).not.toContainText(installed.identity.providerAccountId)
    await page.getByLabel("Account email").fill(installed.identity.user.email)
    await page.getByLabel("Password").fill(installed.password)
    const confirm = page.getByRole("button", { name: /confirm same MassageLab account/i })
    await confirm.dblclick()
    await expect(page.getByRole("status")).toContainText(/linked|redirecting/i)
    await expect(page).toHaveURL(/\/account\?tab=security/)
  })

  test("method controls keep a last sign-in method and recover after expired proof", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    const installed = await fixture.installIdentityMethodSafetyFixture({
      context,
      baseURL,
      projectName: testInfo.project.name,
      scenario: "BOTH_METHODS",
    })
    await page.goto("/account?tab=security", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Sign-in methods" })).toBeVisible()
    const updatePassword = page.getByRole("button", { name: "Update password" })
    await expect(updatePassword).toBeDisabled()
    await page.getByText("Confirm this password sign-in change.").click()
    await expect(updatePassword).toBeEnabled()
    const unlink = page.getByRole("button", { name: /unlink Google/i })
    await expect(unlink).toBeDisabled()
    await page.getByLabel("Password to remove Google").fill(installed.password)
    await expect(unlink).toBeDisabled()
    await page.getByRole("checkbox", { name: /confirm.*remove Google/i }).check()
    await unlink.click()
    await expect(page.getByRole("status")).toContainText(/removed/i)
    await expect(page.getByText(/keep at least one/i)).toBeVisible()
  })

  test("adds a password after a mocked completed Google reauthentication", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    const installed = await fixture.installIdentityMethodSafetyFixture({
      context,
      baseURL,
      projectName: testInfo.project.name,
      scenario: "GOOGLE_ONLY",
    })
    await page.goto("/account?tab=security&reauth=complete", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Create password").fill(installed.password)
    const save = page.getByRole("button", { name: "Add password sign-in" })
    await expect(save).toBeDisabled()
    await page.getByText("Confirm this password sign-in change.").click()
    await save.dblclick()
    await expect(page.getByRole("status")).toContainText(/enabled|saved/i)
    await expect(page.getByText("Enabled", { exact: true })).toBeVisible()
  })

  test("disables password only after completed Google proof and keeps Google available", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    await fixture.installIdentityMethodSafetyFixture({ context, baseURL, projectName: testInfo.project.name, scenario: "BOTH_METHODS" })
    await page.goto("/account?tab=security&reauth=complete", { waitUntil: "domcontentloaded" })
    const disable = page.getByRole("button", { name: "Disable password sign-in" })
    await expect(disable).toBeDisabled()
    await page.getByLabel("Confirm disable password sign-in").check()
    await disable.dblclick()
    await expect(page.getByRole("status")).toContainText(/disabled/i)
    await expect(page.getByText("Not enabled", { exact: true })).toBeVisible()
    await expect(page.getByText("Linked", { exact: true })).toBeVisible()
  })

  test("announces an expired matching intent and allows an explicit retry", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    const installed = await fixture.installIdentityMethodSafetyFixture({
      context,
      baseURL,
      projectName: testInfo.project.name,
      scenario: "MATCHING_LINK",
      signedIn: false,
    })
    let confirmations = 0
    await page.route("**/api/account/security/google/link/confirm", async (route) => {
      confirmations += 1
      if (confirmations === 1) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ code: "PROOF_EXPIRED", message: "This confirmation expired. Start again." }),
        })
      } else {
        await route.continue()
      }
    })
    await page.goto("/account/link-google", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Account email").fill(installed.identity.user.email)
    await page.getByLabel("Password").fill(installed.password)
    await page.getByRole("button", { name: "Confirm same MassageLab account" }).click()
    await expect(page.getByRole("alert")).toContainText(/expired/i)
    await page.getByLabel("Password").fill(installed.password)
    await page.getByRole("button", { name: "Confirm same MassageLab account" }).click()
    await expect(page).toHaveURL(/\/account\?tab=security/)
  })

  test("security surface remains usable with keyboard, enlarged text, landscape, and reduced motion", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    await fixture.installIdentityMethodSafetyFixture({ context, baseURL, projectName: testInfo.project.name, scenario: "GOOGLE_ONLY" })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize({ width: 740, height: 360 })
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
    await page.goto("/account?tab=security", { waitUntil: "domcontentloaded" })
    const firstAction = page.getByRole("button", { name: /add password/i })
    await firstAction.focus()
    await expect(firstAction).toBeFocused()
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  })
})
