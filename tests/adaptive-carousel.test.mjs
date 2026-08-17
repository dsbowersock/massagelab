import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  BACKGROUND_CAROUSEL_BASE_TUNING,
  STATION_CAROUSEL_TUNING,
  getMountedAdaptiveCarouselItemIds,
  getResponsiveBackgroundCarouselTuning,
  getResponsiveStationCarouselTuning,
  resolveEffectiveCarouselLoop,
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
const controllerSource = readFileSync(
  new URL("../components/carousels/use-adaptive-carousel-controller.ts", import.meta.url),
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
const stationCarouselSource = readFileSync(
  new URL("../components/atmosphere/station-carousel.tsx", import.meta.url),
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
    assert.match(stageSource, /customControlsVisible\?: boolean/)
    assert.match(stageSource, /customControlsVisible = true/)
    assert.match(
      stageSource,
      /renderControls && customControlsVisible[\s\S]*\? renderControls\(controlState\)[\s\S]*: !renderControls[\s\S]*\? defaultNavigation[\s\S]*: null/,
    )
    assert.match(stageSource, /data-has-custom-controls=/)
    assert.match(
      stageSource,
      /data-station-carousel-controls=\{surface === "stations" && renderControls && customControlsVisible[\s\S]*viewportProfile === "music-fit"/,
    )
    assert.match(
      stageSource,
      /surface === "stations" && renderControls && customControlsVisible/,
    )
    assert.doesNotMatch(stageSource, /data-carousel-controls="true"/)
  })

  it("keeps the Music baseline stable and bounds Background media to five cards", () => {
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

  it("station tuning fits three cards inside a constrained rail workspace", () => {
    assert.deepEqual(
      getResponsiveStationCarouselTuning({
        containerWidth: 556,
        containerHeight: 246,
        constrainedLandscape: true,
      }),
      {
        ...STATION_CAROUSEL_TUNING,
        cardWidth: 192,
        cardHeight: 246,
        visibleRadius: 1,
      },
    )
  })

  it("lets constrained-landscape stations consume the full measured stage height", () => {
    const landscape = getResponsiveStationCarouselTuning({
      containerWidth: 556,
      containerHeight: 246,
      constrainedLandscape: true,
    })
    assert.equal(landscape.cardHeight, 246)

    const portrait = getResponsiveStationCarouselTuning({
      containerWidth: 556,
      containerHeight: 246,
      constrainedLandscape: false,
    })
    assert.equal(portrait.cardHeight, 224)
  })

  it("keeps wide short portrait stage cards on the stable width-derived 7:6 ratio", () => {
    const expanded = getResponsiveStationCarouselTuning({
      containerWidth: 556,
      containerHeight: 246,
      constrainedLandscape: false,
    })
    const collapsed = getResponsiveStationCarouselTuning({
      containerWidth: 556,
      containerHeight: 412,
      constrainedLandscape: false,
    })
    assert.deepEqual(
      { width: expanded.cardWidth, height: expanded.cardHeight },
      { width: 192, height: 224 },
    )
    assert.deepEqual(
      { width: collapsed.cardWidth, height: collapsed.cardHeight },
      { width: 192, height: 224 },
    )

    const narrow = getResponsiveStationCarouselTuning({
      containerWidth: 420,
      containerHeight: 210,
      constrainedLandscape: false,
    })
    assert.equal(narrow.cardWidth, 161)
    assert.equal(narrow.cardHeight, Math.round(161 * 224 / 192))
  })

  it("keeps station looping independent from static reduced-motion presentation", () => {
    assert.equal(resolveEffectiveCarouselLoop(7, 1, true), true)
    assert.match(controllerSource, /surface === "stations"[\s\S]*resolveEffectiveCarouselLoop/)
    assert.match(controllerSource, /duration: staticPresentation \? 0 : 45/)
    assert.doesNotMatch(controllerSource, /const finiteRail = reducedMotion \|\| tuning\.motion === false/)
  })

  it("station tuning consumes the measured stage allocation without a fixed control subtraction", () => {
    const tuning = getResponsiveStationCarouselTuning({
      containerWidth: 420,
      containerHeight: 210,
      constrainedLandscape: true,
    })
    assert.equal(tuning.cardWidth, 161)
    assert.equal(tuning.cardHeight, 210)
    assert.equal(tuning.visibleRadius, 1)

    const severeHeight = getResponsiveStationCarouselTuning({
      containerWidth: 360,
      containerHeight: 96,
      constrainedLandscape: true,
    })
    assert.equal(severeHeight.cardWidth, 160)
    assert.equal(severeHeight.cardHeight, 96)
    assert.equal(severeHeight.visibleRadius, 1)
  })

  it("owns live station capability and constrained-landscape media queries without touch heuristics", () => {
    assert.match(stationCarouselSource, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/)
    assert.match(
      stationCarouselSource,
      /window\.matchMedia\("\(any-hover: hover\) and \(any-pointer: fine\)"\)/,
    )
    assert.match(
      stationCarouselSource,
      /window\.matchMedia\([\s\S]*"\(orientation: landscape\) and \(max-width: 60rem\) and \(max-height: 31\.25rem\)"/,
    )
    assert.match(stationCarouselSource, /const showStationControls = reducedMotion \|\| hasFineHoverPointer/)
    assert.match(stationCarouselSource, /customControlsVisible=\{showStationControls\}/)
    assert.match(stationCarouselSource, /constrainedLandscape/)
    assert.doesNotMatch(stationCarouselSource, /maxTouchPoints/)
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
    assert.match(backgroundCarouselSource, /onPreviewPreferenceChange=\{handlePreviewPreferenceChange\}/)
    assert.match(backgroundCarouselSource, /preferenceHydrated && previewPreferenceEnabled && active && !reducedMotion/)
    assert.match(backgroundCarouselSource, /readBackgroundPreviewPreference\(\(\) => window\.localStorage\)/)
    assert.match(backgroundCarouselSource, /writeBackgroundPreviewPreference\(\(\) => window\.localStorage, enabled\)/)
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
