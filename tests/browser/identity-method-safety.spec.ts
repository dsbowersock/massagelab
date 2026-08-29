import { expect, test } from "@playwright/test"

const PRIVATE_QA_SKIP_REASON = "Identity method database-backed browser QA requires the missing explicit disposable-database opt-in/authorization."
const hasPrivateQaOptIn = process.env.MASSAGELAB_BROWSER_QA_DATABASE === "1"

test.describe("public account-entry recovery", () => {
  test("login prevents duplicate Credentials submission and recovers from a thrown request", async ({ page }) => {
    let requests = 0
    await page.route("**/api/auth/callback/credentials**", async (route) => {
      requests += 1
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.abort("failed")
    })
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Email").fill("browser-login@example.test")
    await page.getByLabel("Password").fill("not-a-real-password")
    const submit = page.getByRole("button", { name: "Sign in with email" })
    await submit.dblclick()
    const pending = page.getByRole("button", { name: "Signing in…" })
    await expect(pending).toBeDisabled()
    await expect(page.locator('p[role="alert"]')).toContainText(/sign in failed|try again/i)
    await expect(page.getByRole("button", { name: "Sign in with email" })).toBeEnabled()
    expect(requests).toBe(1)
  })

  test("registration announces pending work, prevents duplicates, and recovers after intercepted failure", async ({ page }) => {
    let requests = 0
    await page.route("**/api/account/register", async (route) => {
      requests += 1
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.abort("failed")
    })
    await page.goto("/register", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Email").fill("browser-register@example.test")
    await page.getByLabel("Password").fill("not-a-real-password")
    for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check()
    const submit = page.getByRole("button", { name: "Create account with email" })
    await submit.dblclick()
    const pending = page.getByRole("button", { name: "Creating account…" })
    await expect(pending).toBeDisabled()
    await expect(page.locator('p[role="alert"]')).toContainText(/could not create|try again/i)
    await expect(page.getByRole("button", { name: "Create account with email" })).toBeEnabled()
    expect(requests).toBe(1)
  })
})

test.describe("private identity-method journeys", () => {
  test.beforeEach(() => {
    test.skip(!hasPrivateQaOptIn, PRIVATE_QA_SKIP_REASON)
  })

  test.afterEach(async ({}, testInfo) => {
    if (!hasPrivateQaOptIn) return
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
    await page.getByLabel("Current password").fill(installed.password)
    await page.getByRole("checkbox", { name: /confirm.*remove Google/i }).check()
    await page.getByRole("button", { name: /unlink Google/i }).click()
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
    await page.getByText("Confirm this password sign-in change.").click()
    const save = page.getByRole("button", { name: "Add password sign-in" })
    await save.dblclick()
    await expect(page.getByRole("status")).toContainText(/enabled|saved/i)
    await expect(page.getByText("Enabled", { exact: true })).toBeVisible()
  })

  test("disables password only after completed Google proof and keeps Google available", async ({ context, page }, testInfo) => {
    const fixture = await import("./identity-method-safety-fixture")
    const baseURL = String(testInfo.project.use.baseURL)
    await fixture.installIdentityMethodSafetyFixture({ context, baseURL, projectName: testInfo.project.name, scenario: "BOTH_METHODS" })
    await page.goto("/account?tab=security&reauth=complete", { waitUntil: "domcontentloaded" })
    await page.getByLabel("Confirm disable password sign-in").check()
    const disable = page.getByRole("button", { name: "Disable password sign-in" })
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
