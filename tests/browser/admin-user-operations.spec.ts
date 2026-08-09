import { expect, test } from "@playwright/test"
import {
  BROWSER_ADMIN_TARGET,
  installAdminUserOperationsFixture,
  removeBrowserAdminFixture,
} from "./admin-user-operations-fixture"
import { hasBrowserAdminFixtureQaAuthorization } from "../../lib/admin/browser-qa-authorization"

const configuredQaDatabase = hasBrowserAdminFixtureQaAuthorization()

test.describe("Admin user operations", () => {
  test.beforeEach(async ({ context }, testInfo) => {
    test.skip(!configuredQaDatabase, "Admin user operations browser QA requires DATABASE_URL and MASSAGELAB_BROWSER_QA_DATABASE=1.")
    const baseURL = testInfo.project.use.baseURL
    if (!baseURL) throw new Error("Admin user operations browser QA requires a configured base URL.")
    await installAdminUserOperationsFixture(context, baseURL)
  })

  test.afterEach(async () => {
    if (configuredQaDatabase) await removeBrowserAdminFixture()
  })

  test("Admin navigates from the directory to an independently loaded detail section without overflow", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" })
    const targetLink = page.getByRole("link", { name: BROWSER_ADMIN_TARGET.name })
    await expect(targetLink).toBeVisible()
    await targetLink.focus()
    await expect(targetLink).toBeFocused()
    await targetLink.press("Enter")

    await expect(page.getByRole("heading", { name: BROWSER_ADMIN_TARGET.name })).toBeVisible()
    const sectionNavigation = page.getByRole("navigation", { name: "Account detail sections" })
    await expect(sectionNavigation).toBeVisible()
    await expect(sectionNavigation.getByRole("link", { name: "Security" })).toBeVisible()
    await sectionNavigation.getByRole("link", { name: "Security" }).click()
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible()
    const horizontalOverflow = await page.locator("html").evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(horizontalOverflow).toBe(false)
  })
})
