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

  const backgroundSelect = review.getByLabel("Background")
  const backgroundOptions = await backgroundSelect.locator("option").evaluateAll((options) =>
    options.map((option) => ({ label: option.textContent?.trim() ?? "", value: (option as HTMLOptionElement).value })),
  )
  const initialBackgroundId = await backgroundSelect.evaluate((select) => (select as HTMLSelectElement).value)
  const nextBackground = backgroundOptions.find((option) => option.value !== initialBackgroundId)
  expect(nextBackground).toBeDefined()

  const firstVideo = review.locator("video").first()
  const initialSource = await firstVideo.evaluate((video) => (video as HTMLVideoElement).currentSrc)
  await backgroundSelect.selectOption(nextBackground!.value)
  await expect(review.getByText(`${nextBackground!.label} · vertical`, { exact: true })).toBeVisible()
  await expect.poll(() => firstVideo.evaluate((video) => (video as HTMLVideoElement).currentSrc)).not.toBe(initialSource)
  await expect.poll(() => firstVideo.evaluate((video) => (video as HTMLVideoElement).currentSrc)).toContain(`/${nextBackground!.value}/`)

  await review.getByLabel("Aspect").selectOption("landscape")
  await expect(review.getByText(`${nextBackground!.label} · landscape`, { exact: true })).toBeVisible()
  await expect.poll(() => firstVideo.evaluate((video) => (video as HTMLVideoElement).currentSrc)).toContain("/landscape/")

  await review.getByRole("button", { name: "Restart all previews" }).click()
  await expect(review.locator("video").first()).toHaveJSProperty("currentTime", 0)
})
