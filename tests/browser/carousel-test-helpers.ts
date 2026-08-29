import { expect, type Locator, type Page } from "@playwright/test"

type SlideGeometry = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>

const QUIET_GEOMETRY_RANGE_CSS_PX = 1
const QUIET_GEOMETRY_WINDOW_MS = 50
const QUIET_GEOMETRY_SAMPLE_COUNT = 4

function maxGeometryDelta(left: SlideGeometry, right: SlideGeometry) {
  return Math.max(
    Math.abs(left.x - right.x),
    Math.abs(left.y - right.y),
    Math.abs(left.width - right.width),
    Math.abs(left.height - right.height),
  )
}

/**
 * Requires a near-frame-cadence quiet window whose total geometry range stays
 * within one CSS pixel, rather than accepting a single easing-tail lull.
 */
export async function waitForStableSlideGeometry(slide: Locator, label: string) {
  let previousBox: SlideGeometry | null = null
  let quietAnchorBox: SlideGeometry | null = null
  let quietStartedAt = 0
  let quietSampleCount = 0
  const recentSamples: string[] = []
  try {
    await expect.poll(async () => {
      const box = await slide.boundingBox()
      if (!box) {
        // Discard pre-detachment samples so a reconnected slide must establish
        // fresh consecutive geometry before it can be considered settled.
        previousBox = null
        quietAnchorBox = null
        quietStartedAt = 0
        quietSampleCount = 0
        recentSamples.push("detached")
        recentSamples.splice(0, Math.max(0, recentSamples.length - 6))
        return false
      }

      const sampledAt = performance.now()
      const stepDelta = previousBox === null ? null : maxGeometryDelta(box, previousBox)
      if (quietAnchorBox === null) {
        quietAnchorBox = box
        quietStartedAt = sampledAt
        quietSampleCount = 1
      } else if (maxGeometryDelta(box, quietAnchorBox) > QUIET_GEOMETRY_RANGE_CSS_PX) {
        // Reset the whole quiet window when cumulative movement exceeds the
        // WebKit subpixel allowance, even if one intermediate step was small.
        quietAnchorBox = box
        quietStartedAt = sampledAt
        quietSampleCount = 1
      } else {
        quietSampleCount += 1
      }

      const quietRange = maxGeometryDelta(box, quietAnchorBox)
      const quietDuration = sampledAt - quietStartedAt
      previousBox = box
      recentSamples.push(
        `x=${box.x.toFixed(2)},y=${box.y.toFixed(2)},w=${box.width.toFixed(2)},h=${box.height.toFixed(2)},step=${stepDelta?.toFixed(2) ?? "initial"},range=${quietRange.toFixed(2)},quiet=${quietDuration.toFixed(0)}ms`,
      )
      recentSamples.splice(0, Math.max(0, recentSamples.length - 6))
      return quietSampleCount >= QUIET_GEOMETRY_SAMPLE_COUNT
        && quietDuration >= QUIET_GEOMETRY_WINDOW_MS
    }, {
      message: `${label} settled`,
      // Browser-to-runner bounding-box reads are slower than rAF, but a 16ms
      // polling cadence still supplies multiple samples inside the unchanged
      // assertion timeout on Chromium and WebKit.
      intervals: [16],
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
