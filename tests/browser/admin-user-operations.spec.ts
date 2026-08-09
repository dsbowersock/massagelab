import { expect, test } from "@playwright/test"
import {
  installAdminUserOperationsFixture,
  removeBrowserAdminFixture,
} from "./admin-user-operations-fixture"
import { hasBrowserAdminFixtureQaAuthorization } from "../../lib/admin/browser-qa-authorization"
import { createBrowserAdminFixtureIdentity } from "../../lib/admin/browser-fixture-identity"

const configuredQaDatabase = hasBrowserAdminFixtureQaAuthorization()

test.describe("Admin user operations", () => {
  test.beforeEach(async ({ context }, testInfo) => {
    test.skip(!configuredQaDatabase, "Admin user operations browser QA requires DATABASE_URL and MASSAGELAB_BROWSER_QA_DATABASE=1.")
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
})
