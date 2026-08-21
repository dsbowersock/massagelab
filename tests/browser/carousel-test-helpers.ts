import { expect, type Locator, type Page } from "@playwright/test"

async function waitForStableSlideGeometry(slide: Locator, label: string) {
  let previousBox: Awaited<ReturnType<Locator["boundingBox"]>> = null
  let stableComparisons = 0
  await expect.poll(async () => {
    const box = await slide.boundingBox()
    if (!box) {
      previousBox = null
      stableComparisons = 0
      return false
    }
    const stable = previousBox !== null && Math.max(
      Math.abs(box.x - previousBox.x),
      Math.abs(box.y - previousBox.y),
      Math.abs(box.width - previousBox.width),
      Math.abs(box.height - previousBox.height),
    ) <= 0.25
    stableComparisons = stable ? stableComparisons + 1 : 0
    previousBox = box
    // Embla can briefly pause near a snap while momentum is still active.
    // Require a sustained quiet window so a setup selection is not ignored
    // by an in-flight drag from the preceding test action.
    return stableComparisons >= 5
  }, {
    message: `${label} settled`,
    intervals: [50, 75, 100, 100, 100],
  }).toBe(true)
}

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
  const carousel = page.getByRole("region", {
    name: nextButtonName === "Next station" ? "Station carousel" : "Background carousel",
  })
  const slide = page.locator(
    `[data-carousel-slide="true"][data-carousel-item-id="${itemId}"]:not([data-carousel-loop-clone="true"])`,
  )
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await expect(slide, `${nextButtonName} setup target ${itemId}`).toBeAttached()
  await waitForStableSlideGeometry(
    carousel.locator('[data-carousel-slide="true"][data-centered="true"]'),
    `${nextButtonName} current slide`,
  )
  if ((await slide.getAttribute("data-centered")) !== "true") {
    const accessibleLabel = await slide.getAttribute("aria-label")
    if (accessibleLabel?.match(/item 1 of \d+/)) {
      // Home is an intentional instant jump in the production carousel. It is
      // deterministic even immediately after a user swipe, unlike starting a
      // second animated scroll while Embla is completing momentum cleanup.
      await carousel.locator('div[tabindex="0"]').first().press("Home")
    } else {
      await slide.dispatchEvent("click")
    }
  }
  await expect(slide).toHaveAttribute("data-centered", "true")
  await waitForStableSlideGeometry(slide, `${nextButtonName} setup target ${itemId}`)
  return slide
}
