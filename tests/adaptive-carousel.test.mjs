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

  it("preserves the approved fixed Station composition in constrained landscape", () => {
    assert.deepEqual(
      getResponsiveStationCarouselTuning({
        containerWidth: 556,
        containerHeight: 246,
        constrainedLandscape: true,
      }),
      {
        ...STATION_CAROUSEL_TUNING,
        cardWidth: 192,
        cardHeight: 224,
        visibleRadius: 4,
      },
    )
  })

  it("keeps constrained-landscape stations on the approved fixed baseline", () => {
    const landscape = getResponsiveStationCarouselTuning({
      containerWidth: 556,
      containerHeight: 246,
      constrainedLandscape: true,
    })
    assert.deepEqual(
      { width: landscape.cardWidth, height: landscape.cardHeight },
      { width: 192, height: 224 },
    )

    const portrait = getResponsiveStationCarouselTuning({
      containerWidth: 556,
      containerHeight: 246,
      constrainedLandscape: false,
    })
    assert.equal(portrait.cardHeight, 224)
  })

  it("compresses only the medium-width Station wing sweep", () => {
    const medium = getResponsiveStationCarouselTuning({
      containerWidth: 650,
      containerHeight: 420,
      constrainedLandscape: false,
    })
    const roomy = getResponsiveStationCarouselTuning({
      containerWidth: 740,
      containerHeight: 246,
      constrainedLandscape: true,
    })
    const constrained = getResponsiveStationCarouselTuning({
      containerWidth: 556,
      containerHeight: 246,
      constrainedLandscape: true,
    })
    assert.equal(medium.spread, 20)
    assert.equal(roomy.spread, STATION_CAROUSEL_TUNING.spread)
    assert.equal(constrained.spread, STATION_CAROUSEL_TUNING.spread)
  })

  it("keeps portrait cards fixed across stage and player-rail changes", () => {
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
    assert.equal(narrow.cardWidth, 192)
    assert.equal(narrow.cardHeight, 224)
  })

  it("fluidly scales the complete Station composition on laptop and TV-sized stages", () => {
    const laptop = getResponsiveStationCarouselTuning({
      containerWidth: 1368,
      containerHeight: 800,
      constrainedLandscape: false,
    })
    assert.deepEqual(
      { width: laptop.cardWidth, height: laptop.cardHeight },
      { width: 274, height: 319 },
    )
    assert.equal(laptop.radius, 599)

    const television = getResponsiveStationCarouselTuning({
      containerWidth: 2488,
      containerHeight: 1400,
      constrainedLandscape: false,
    })
    assert.deepEqual(
      { width: television.cardWidth, height: television.cardHeight },
      { width: 480, height: 560 },
    )
    assert.equal(television.radius, 1050)

    const shortTelevisionStage = getResponsiveStationCarouselTuning({
      containerWidth: 2488,
      containerHeight: 800,
      constrainedLandscape: false,
    })
    assert.ok(shortTelevisionStage.cardWidth < television.cardWidth)
    assert.ok(
      shortTelevisionStage.cardHeight + shortTelevisionStage.cardWidth * 1.3 + 8 <= 801,
    )
  })

  it("keeps station looping independent from static reduced-motion presentation", () => {
    assert.equal(resolveEffectiveCarouselLoop(7, 1, true), true)
    assert.match(controllerSource, /surface === "stations"[\s\S]*resolveEffectiveCarouselLoop/)
    assert.match(controllerSource, /duration: staticPresentation \? 0 : 45/)
    assert.doesNotMatch(controllerSource, /const finiteRail = reducedMotion \|\| tuning\.motion === false/)
  })

  it("scales the approved Station ratio down only when constrained height requires it", () => {
    const tuning = getResponsiveStationCarouselTuning({
      containerWidth: 420,
      containerHeight: 210,
      constrainedLandscape: true,
    })
    assert.equal(tuning.cardWidth, 180)
    assert.equal(tuning.cardHeight, 210)
    assert.equal(tuning.visibleRadius, 4)

    const severeHeight = getResponsiveStationCarouselTuning({
      containerWidth: 360,
      containerHeight: 96,
      constrainedLandscape: true,
    })
    assert.equal(severeHeight.cardWidth, Math.round(96 * 192 / 224))
    assert.equal(severeHeight.cardHeight, 96)
    assert.equal(severeHeight.visibleRadius, 4)
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
