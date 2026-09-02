import { expect, type Locator, type Page } from "@playwright/test"

const QUIET_GEOMETRY_RANGE_CSS_PX = 1
const QUIET_GEOMETRY_WINDOW_MS = 50
const QUIET_GEOMETRY_SAMPLE_COUNT = 4
const GEOMETRY_SAMPLE_INTERVAL_MS = 16
const GEOMETRY_OBSERVATION_LIMIT_MS = 250

/**
 * Requires a near-frame-cadence quiet window whose total geometry range stays
 * within one CSS pixel, rather than accepting a single easing-tail lull.
 */
export async function waitForStableSlideGeometry(slide: Locator, label: string) {
  let recentSamples: string[] = []
  try {
    await expect.poll(async () => {
      const observation = await slide.evaluate(async (element, limits) => {
        type Geometry = { x: number; y: number; width: number; height: number }

        const maximumDelta = (left: Geometry, right: Geometry) => Math.max(
          Math.abs(left.x - right.x),
          Math.abs(left.y - right.y),
          Math.abs(left.width - right.width),
          Math.abs(left.height - right.height),
        )
        // Some headless WebKit runs throttle rAF while an async locator
        // evaluation is pending. A page-context timer keeps all samples on one
        // browser roundtrip while performance.now() supplies monotonic timing.
        const nextSample = () => new Promise<void>((resolve) => {
          setTimeout(resolve, limits.sampleIntervalMs)
        })
        const observedAt = performance.now()
        let previous: Geometry | null = null
        let minimum: Geometry | null = null
        let maximum: Geometry | null = null
        let quietStartedAt = observedAt
        let quietSampleCount = 0
        const samples: string[] = []

        while (performance.now() - observedAt <= limits.observationLimitMs) {
          if (!element.isConnected) {
            return { recentSamples: ["detached"], settled: false }
          }

          const rect = element.getBoundingClientRect()
          const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          const sampledAt = performance.now()
          const stepDelta = previous === null ? null : maximumDelta(box, previous)
          if (minimum === null || maximum === null) {
            minimum = box
            maximum = box
            quietStartedAt = sampledAt
            quietSampleCount = 1
          } else {
            const candidateMinimum: Geometry = {
              x: Math.min(minimum.x, box.x),
              y: Math.min(minimum.y, box.y),
              width: Math.min(minimum.width, box.width),
              height: Math.min(minimum.height, box.height),
            }
            const candidateMaximum: Geometry = {
              x: Math.max(maximum.x, box.x),
              y: Math.max(maximum.y, box.y),
              width: Math.max(maximum.width, box.width),
              height: Math.max(maximum.height, box.height),
            }
            if (maximumDelta(candidateMinimum, candidateMaximum) > limits.rangeCssPx) {
              // Reseed after any per-axis peak-to-peak range exceeds the WebKit
              // allowance, including damped motion on opposite sides of an anchor.
              minimum = box
              maximum = box
              quietStartedAt = sampledAt
              quietSampleCount = 1
            } else {
              minimum = candidateMinimum
              maximum = candidateMaximum
              quietSampleCount += 1
            }
          }

          if (minimum === null || maximum === null) {
            throw new Error("Geometry bounds were not seeded by the current sample.")
          }
          const quietRange = maximumDelta(minimum, maximum)
          const quietDuration = sampledAt - quietStartedAt
          previous = box
          samples.push(
            `x=${box.x.toFixed(2)},y=${box.y.toFixed(2)},w=${box.width.toFixed(2)},h=${box.height.toFixed(2)},step=${stepDelta?.toFixed(2) ?? "initial"},range=${quietRange.toFixed(2)},quiet=${quietDuration.toFixed(0)}ms`,
          )
          samples.splice(0, Math.max(0, samples.length - 6))
          if (
            quietSampleCount >= limits.sampleCount
            && quietDuration >= limits.windowMs
          ) {
            return { recentSamples: samples, settled: true }
          }
          await nextSample()
        }

        return { recentSamples: samples, settled: false }
      }, {
        observationLimitMs: GEOMETRY_OBSERVATION_LIMIT_MS,
        rangeCssPx: QUIET_GEOMETRY_RANGE_CSS_PX,
        sampleCount: QUIET_GEOMETRY_SAMPLE_COUNT,
        sampleIntervalMs: GEOMETRY_SAMPLE_INTERVAL_MS,
        windowMs: QUIET_GEOMETRY_WINDOW_MS,
      })
      recentSamples = observation.recentSamples
      return observation.settled
    }, {
      message: `${label} settled`,
      // Retry a bounded browser-side observation if the slide stayed in motion.
      // The assertion timeout intentionally remains Playwright's 7.5s default.
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
