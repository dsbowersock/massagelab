import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  BACKGROUND_CAROUSEL_BASE_TUNING,
  STATION_CAROUSEL_TUNING,
  getMountedAdaptiveCarouselItemIds,
  getResponsiveBackgroundCarouselTuning,
  resolveAdaptiveCarouselViewportProfile,
} from "../components/carousels/adaptive-carousel-model.js"

const items = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id }))
const stageStyles = readFileSync(
  new URL("../components/carousels/adaptive-carousel-stage.module.css", import.meta.url),
  "utf8",
)
const stageSource = readFileSync(
  new URL("../components/carousels/adaptive-carousel-stage.tsx", import.meta.url),
  "utf8",
)
const backgroundCarouselSource = readFileSync(
  new URL("../components/backgrounds/background-carousel.tsx", import.meta.url),
  "utf8",
)
const backgroundControlTraySource = readFileSync(
  new URL("../components/backgrounds/background-carousel-control-tray.tsx", import.meta.url),
  "utf8",
)

describe("production adaptive carousel", () => {
  it("uses three Background renderers only in short landscape", () => {
    const cases = [
      [{ containerWidth: 479, viewportWidth: 390, viewportHeight: 844 }, "phone-portrait", 164, 312, 22, 2],
      [{ containerWidth: 1000, viewportWidth: 844, viewportHeight: 480 }, "short-landscape", 200, 240, 26, 1],
      [{ containerWidth: 759, viewportWidth: 779, viewportHeight: 1121 }, "tablet", 220, 304, 29, 2],
      [{ containerWidth: 760, viewportWidth: 1365, viewportHeight: 820 }, "compact-desktop", 256, 360, 33, 2],
      [{ containerWidth: 960, viewportWidth: 1121, viewportHeight: 779 }, "wide-landscape", 280, 388, 36, 2],
    ]

    assert.equal(BACKGROUND_CAROUSEL_BASE_TUNING.visibleRadius, 2)
    for (const [dimensions, expectedProfile, cardWidth, cardHeight, spread, visibleRadius] of cases) {
      const profile = resolveAdaptiveCarouselViewportProfile(dimensions)
      const tuning = getResponsiveBackgroundCarouselTuning(profile)
      assert.equal(profile, expectedProfile)
      assert.equal(tuning.cardWidth, cardWidth)
      assert.equal(tuning.cardHeight, cardHeight)
      assert.equal(tuning.spread, spread)
      assert.equal(tuning.visibleRadius, visibleRadius)
      assert.equal(tuning.radius, 420)
      assert.equal(tuning.scaleFalloff, 0.08)
    }
  })

  it("offers typed custom controls while retaining default navigation", () => {
    assert.match(stageSource, /export interface AdaptiveCarouselControlState/)
    assert.match(stageSource, /renderControls\?: \(state: AdaptiveCarouselControlState\) => ReactNode/)
    assert.match(stageSource, /renderControls \? renderControls\(controlState\) : defaultNavigation/)
    assert.match(stageSource, /data-has-custom-controls=/)
  })

  it("keeps Music cards fixed on every device and bounds Background media to five cards", () => {
    assert.deepEqual(STATION_CAROUSEL_TUNING, {
      cardWidth: 192,
      cardHeight: 224,
      gap: 0,
      visibleRadius: 4,
      loop: true,
      motion: true,
      spread: 27,
      radius: 420,
      scaleFalloff: 0.05,
    })
    assert.deepEqual(
      [...getMountedAdaptiveCarouselItemIds(items, "d", 2, true)],
      ["b", "c", "d", "e", "f"],
    )
  })

  it("offers one tray-owned Animated previews switch wired to the saved preference", () => {
    const switchContract = 'label="Animated previews"'

    assert.equal(
      backgroundControlTraySource.split(switchContract).length - 1,
      1,
      "the Background control tray renders exactly one Animated previews switch",
    )
    assert.match(backgroundControlTraySource, /checked=\{previewPreferenceEnabled\}/)
    assert.match(backgroundControlTraySource, /onCheckedChange=\{onPreviewPreferenceChange\}/)
    assert.match(backgroundCarouselSource, /<BackgroundCarouselControlTray[\s\S]*previewPreferenceEnabled=\{previewPreferenceEnabled\}/)
    assert.match(backgroundCarouselSource, /onPreviewPreferenceChange=\{setPreviewPreferenceEnabled\}/)
    assert.doesNotMatch(backgroundCarouselSource, /aria-pressed=\{previewPlaybackActive\}/)
  })

  it("bounds non-looping renderers at the collection edges", () => {
    assert.deepEqual(
      [...getMountedAdaptiveCarouselItemIds(items.slice(0, 3), "a", 2, false)],
      ["a", "b", "c"],
    )
  })

  it("normalizes looped indexes when the radius exceeds the item count", () => {
    const mountedIds = getMountedAdaptiveCarouselItemIds(items.slice(0, 3), "a", 4, true)
    assert.deepEqual([...mountedIds].sort(), ["a", "b", "c"])
  })

  it("uses the approved compact vertical padding for short Station and Background stages", () => {
    assert.match(
      stageStyles,
      /@media \(max-height: 44rem\)[\s\S]*data-surface="stations"[\s\S]*padding-block: 1\.553125rem[\s\S]*data-surface="backgrounds"[\s\S]*padding-block: 0\.4375rem/,
    )
  })
})
