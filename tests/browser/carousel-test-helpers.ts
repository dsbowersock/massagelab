import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Advances a production carousel until the requested item owns its centered
 * renderer, returning that slide for any follow-up assertions.
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
  await expect(slide).toBeAttached()
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if ((await slide.getAttribute("data-centered")) === "true") return slide
    await carousel.getByRole("button", { name: nextButtonName }).click()
  }
  throw new Error(`Carousel item ${itemId} could not be centered`)
}
