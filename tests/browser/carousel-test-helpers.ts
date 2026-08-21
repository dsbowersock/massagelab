import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Selects a requested production slide for tests that need a known centered
 * item before exercising playback or details. Navigation behavior is covered
 * separately; this setup helper avoids accumulating animation timing.
 */
export async function centerCarouselItem(
  page: Page,
  itemId: string,
  nextButtonName: "Next background" | "Next station",
): Promise<Locator> {
  const slide = page.locator(
    `[data-carousel-slide="true"][data-carousel-item-id="${itemId}"]:not([data-carousel-loop-clone="true"])`,
  )
  await expect(slide, `${nextButtonName} setup target ${itemId}`).toBeAttached()
  if ((await slide.getAttribute("data-centered")) !== "true") {
    await slide.dispatchEvent("click")
  }
  await expect(slide).toHaveAttribute("data-centered", "true")
  return slide
}
