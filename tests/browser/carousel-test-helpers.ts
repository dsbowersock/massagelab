import { expect, type Locator, type Page } from "@playwright/test"

export async function waitForStableSlideGeometry(slide: Locator, label: string) {
  let previousBox: Awaited<ReturnType<Locator["boundingBox"]>> = null
  let stableComparisons = 0
  const recentSamples: string[] = []
  try {
    await expect.poll(async () => {
      const box = await slide.boundingBox()
      if (!box) {
        // Discard pre-detachment samples so a reconnected slide must establish
        // fresh consecutive geometry before it can be considered settled.
        previousBox = null
        stableComparisons = 0
        recentSamples.push("detached")
        return false
      }
      const maxDelta = previousBox === null
        ? null
        : Math.max(
            Math.abs(box.x - previousBox.x),
            Math.abs(box.y - previousBox.y),
            Math.abs(box.width - previousBox.width),
            Math.abs(box.height - previousBox.height),
          )
      // WebKit can report a visually stationary transformed slide with
      // subpixel box jitter. One CSS pixel remains strict enough to reject an
      // in-flight snap while avoiding a false timeout on rasterization noise.
      const stable = maxDelta !== null && maxDelta <= 1
      stableComparisons = stable ? stableComparisons + 1 : 0
      previousBox = box
      recentSamples.push(
        `x=${box.x.toFixed(2)},y=${box.y.toFixed(2)},w=${box.width.toFixed(2)},h=${box.height.toFixed(2)},delta=${maxDelta?.toFixed(2) ?? "initial"}`,
      )
      recentSamples.splice(0, Math.max(0, recentSamples.length - 6))
      // Semantic readiness and exact centered identity are checked by the
      // caller, so one additional bounded transition is enough to distinguish
      // the requested slide from an in-flight snap without extending timeouts.
      return stableComparisons >= 1
    }, {
      message: `${label} settled`,
      intervals: [50, 75, 100, 100, 100],
    }).toBe(true)
  } catch (error) {
    throw new Error(
      `${label} did not settle; recent geometry: ${recentSamples.join(" | ") || "no samples"}`,
      { cause: error },
    )
  }
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
  const stage = carousel.locator('div[tabindex="0"]').first()
  const slide = carousel.locator(
    `[data-carousel-slide="true"][data-carousel-item-id="${itemId}"]:not([data-carousel-loop-clone="true"])`,
  )
  const centeredSlide = carousel.locator('[data-carousel-slide="true"][data-centered="true"]')
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await expect(slide, `${nextButtonName} setup target ${itemId}`).toBeAttached()
  await expect(centeredSlide).toHaveCount(1)
  await expect(centeredSlide).toHaveAttribute("data-carousel-item-id", /.+/)
  await waitForStableSlideGeometry(centeredSlide, `${nextButtonName} current slide`)
  if (
    nextButtonName === "Next station"
    && (await carousel.getByRole("button", { name: nextButtonName }).count()) === 0
  ) {
    // Touch-only Station navigation is keyboard-accessible through the stage.
    // Keep the helper's historical focus contract so rerenders caused by a
    // favorite change restore focus to the still-connected carousel surface.
    await stage.focus()
  }
  if ((await slide.getAttribute("data-centered")) !== "true") {
    const accessibleLabel = await slide.getAttribute("aria-label")
    if (accessibleLabel?.match(/item 1 of \d+/)) {
      // Home is an intentional instant jump in the production carousel. It is
      // deterministic even immediately after a user swipe, unlike starting a
      // second animated scroll while Embla is completing momentum cleanup.
      await stage.press("Home")
    } else {
      await slide.dispatchEvent("click")
    }
  }
  await expect(slide).toHaveAttribute("data-centered", "true")
  await expect(centeredSlide).toHaveAttribute("data-carousel-item-id", itemId)
  await waitForStableSlideGeometry(slide, `${nextButtonName} setup target ${itemId}`)
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await expect(centeredSlide).toHaveAttribute("data-carousel-item-id", itemId)
  return slide
}
