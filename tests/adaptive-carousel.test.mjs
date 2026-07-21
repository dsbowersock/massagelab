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

describe("production adaptive carousel", () => {
  it("locks the approved Background winner to radius two across every responsive profile", () => {
    const cases = [
      [{ containerWidth: 479, viewportWidth: 390, viewportHeight: 844 }, "phone-portrait", 164, 312, 22],
      [{ containerWidth: 1000, viewportWidth: 844, viewportHeight: 480 }, "short-landscape", 200, 240, 26],
      [{ containerWidth: 759, viewportWidth: 779, viewportHeight: 1121 }, "tablet", 220, 304, 29],
      [{ containerWidth: 760, viewportWidth: 1365, viewportHeight: 820 }, "compact-desktop", 256, 360, 33],
      [{ containerWidth: 960, viewportWidth: 1121, viewportHeight: 779 }, "wide-landscape", 280, 388, 36],
    ]

    assert.equal(BACKGROUND_CAROUSEL_BASE_TUNING.visibleRadius, 2)
    for (const [dimensions, expectedProfile, cardWidth, cardHeight, spread] of cases) {
      const profile = resolveAdaptiveCarouselViewportProfile(dimensions)
      const tuning = getResponsiveBackgroundCarouselTuning(profile)
      assert.equal(profile, expectedProfile)
      assert.equal(tuning.cardWidth, cardWidth)
      assert.equal(tuning.cardHeight, cardHeight)
      assert.equal(tuning.spread, spread)
      assert.equal(tuning.visibleRadius, 2)
      assert.equal(tuning.radius, 420)
      assert.equal(tuning.scaleFalloff, 0.08)
    }
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

  it("uses the approved compact vertical padding for short Station and Background stages", () => {
    assert.match(
      stageStyles,
      /@media \(max-height: 44rem\)[\s\S]*data-surface="stations"[\s\S]*padding-block: 1\.553125rem[\s\S]*data-surface="backgrounds"[\s\S]*padding-block: 0\.4375rem/,
    )
  })
})
