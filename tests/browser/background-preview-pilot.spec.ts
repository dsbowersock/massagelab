import { expect, test } from "@playwright/test"

test("preview pilot exposes synchronized rendition evidence or an explicit empty gate", async ({ page }) => {
  await page.goto("/dev/bgpreviews")
  const review = page.getByTestId("background-preview-pilot-review")
  await expect(review).toBeVisible()
  const missing = review.getByText(/No validated pilot media is loaded/i)
  if (await missing.isVisible()) {
    await expect(review.locator("video")).toHaveCount(0)
    return
  }
  await expect(review.locator("video")).toHaveCount(6)
  await expect(review.getByText(/VP9 · Low/i)).toBeVisible()
  await expect(review.getByText(/H\.264 · High/i)).toBeVisible()
  await expect(review.getByText(/Loop strategy/i)).toBeVisible()
  await review.getByRole("button", { name: "Restart all previews" }).click()
  await expect(review.locator("video").first()).toHaveJSProperty("currentTime", 0)
})

