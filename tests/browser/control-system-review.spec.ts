import { expect, test } from "@playwright/test"

test.describe("control-system review lab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/buttons")
    await expect(page.getByRole("heading", { name: "Control system review", level: 1 })).toBeVisible()
    await page.waitForLoadState("networkidle")
    await expect(page.locator('[data-review-lab-ready="true"]')).toBeAttached()
  })

  test("all review families are reachable and interactive", async ({ page }) => {
    const sections = [
      { tab: "Buttons", heading: "Buttons" },
      { tab: "Choices", heading: "Segmented controls, tabs, and pill choices" },
      { tab: "Fields & color", heading: "Text inputs and textareas" },
      { tab: "Cards & status", heading: "Selectable cards and control cards" },
      { tab: "Navigation & surfaces", heading: "Navigation controls" },
      { tab: "Protected routes", heading: "Protected route proofs" },
    ]

    for (const section of sections) {
      await page.getByRole("tab", { name: section.tab }).click()
      await expect(page.getByRole("heading", { name: section.heading })).toBeVisible()
    }

    await expect(page.getByText("Chimer duration entry", { exact: true })).toBeVisible()
    await expect(page.getByLabel("1 hours 30 minutes")).toBeVisible()
    await page.getByRole("button", { name: "Increase minutes" }).click()
    await expect(page.getByLabel("1 hours 31 minutes")).toBeVisible()
    await page.waitForTimeout(350)
    await page.getByRole("button", { name: "Increase minutes" }).dblclick()
    await expect(page.getByLabel("1 hours 36 minutes")).toBeVisible()

    await page.getByRole("tab", { name: "Cards & status" }).click()
    const upperBackControls = page.getByRole("button", { name: "Left upper back" })
    await expect(upperBackControls).toHaveCount(2)
    await upperBackControls.last().click()
    await expect(upperBackControls.last()).toHaveAttribute("aria-pressed", "false")
  })

  test("phone layout keeps the review tabs navigable without page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByRole("tab", { name: "Fields & color" }).click()
    await expect(page.getByRole("heading", { name: "Text inputs and textareas" })).toBeVisible()

    await page.getByRole("tab", { name: "Protected routes" }).click()
    await expect(page.getByRole("heading", { name: "Protected route proofs" })).toBeVisible()

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(pageOverflows).toBe(false)
  })
})
