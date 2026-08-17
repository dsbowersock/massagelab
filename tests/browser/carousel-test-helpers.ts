import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Advances a production carousel until the requested item owns its centered
 * renderer. Visible controls retain their real click path, while touch-only
 * station carousels use the same keyboard navigation exposed by the stage.
 */
export async function centerCarouselItem(
  page: Page,
  itemId: string,
  nextButtonName: "Next background" | "Next station",
): Promise<Locator> {
  const slide = page.locator(`[data-carousel-slide="true"][data-carousel-item-id="${itemId}"]`)
  const carousel = page.getByRole("region", {
    name: nextButtonName === "Next station" ? "Station carousel" : "Background carousel",
  })
  const nextButton = carousel.getByRole("button", { name: nextButtonName })
  await expect(slide).toBeAttached()
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if ((await slide.getAttribute("data-centered")) === "true") return slide
    if (await nextButton.count()) {
      await expect(nextButton).toBeVisible()
      await nextButton.click()
    } else {
      if (nextButtonName !== "Next station") {
        throw new Error(`Carousel navigation control ${nextButtonName} is missing`)
      }
      await page.getByTestId("station-carousel-stage").focus()
      await page.keyboard.press("ArrowRight")
    }
  }
  throw new Error(`Carousel item ${itemId} could not be centered`)
}
