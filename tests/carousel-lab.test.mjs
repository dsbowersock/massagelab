import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CAROUSEL_LAB_PAIRS,
  CAROUSEL_LAB_STORAGE_KEY,
  getDefaultCarouselLabTuning,
  getMountedItemIds,
  getPresentationVariables,
  getResponsiveBackgroundTuning,
  parseCarouselLabStorage,
  reconcileCenteredId,
  resolveCarouselLabViewportProfile,
  resolveEffectiveLoop,
  sanitizeCarouselLabTuning,
  serializeCarouselLabStorage,
} from "../app/dev/buttons/carousel-lab/carousel-lab-model.js"

const items = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: id }))

describe("Carousel Lab model", () => {
  it("defines the two selected surface/presentation review pairs", () => {
    assert.equal(CAROUSEL_LAB_STORAGE_KEY, "massagelab-carousel-lab-v4")
    assert.deepEqual(CAROUSEL_LAB_PAIRS, [
      "backgrounds:existing", "stations:background-picker",
    ])
  })

  it("uses the approved compact Background fit and fixed Station dimensions", () => {
    assert.deepEqual(getDefaultCarouselLabTuning("backgrounds", "existing"), {
      cardWidth: 256,
      cardHeight: 360,
      gap: 0,
      visibleRadius: 2,
      loop: true,
      motion: true,
      responsive: true,
      spread: 33,
      radius: 420,
      scaleFalloff: 0.08,
    })

    const coverFlow = getDefaultCarouselLabTuning("backgrounds", "cover-flow")
    assert.equal(coverFlow.cardWidth, 192)
    assert.equal(coverFlow.cardHeight, 304)
    assert.equal(coverFlow.gap, 0)
    assert.equal(coverFlow.visibleRadius, 4)
    assert.equal(coverFlow.rotation, 16)
    assert.equal(coverFlow.centerScale, 1.25)
    assert.equal(coverFlow.edgeScale, 0.6)
    assert.equal(coverFlow.perspective, 320)
    assert.equal(coverFlow.reflectionOpacity, 0.75)
    assert.equal(coverFlow.reflectionGap, 1)

    const threeD = getDefaultCarouselLabTuning("backgrounds", "three-d")
    assert.equal(threeD.cardWidth, 200)
    assert.equal(threeD.cardHeight, 304)
    assert.equal(threeD.gap, 0)
    assert.equal(threeD.loop, true)
    assert.equal(threeD.perspective, 50)
    assert.equal(threeD.ringItems, 14)
    assert.equal(threeD.depth, 1)
    assert.equal(threeD.nearMask, 1)
    assert.equal(threeD.farMask, 2)

    const stationCover = getDefaultCarouselLabTuning("stations", "cover-flow")
    assert.equal(stationCover.cardHeight, 304)
    assert.equal(stationCover.rotation, 16)
    assert.equal(stationCover.centerScale, 1.25)
    assert.equal(stationCover.edgeScale, 0.6)
    assert.equal(stationCover.perspective, 320)
    assert.equal(stationCover.reflectionGap, 3)

    assert.deepEqual(getDefaultCarouselLabTuning("stations", "background-picker"), {
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
  })

  it("maps available space to all five approved responsive Background profiles", () => {
    const cases = [
      [{ containerWidth: 479, viewportWidth: 390, viewportHeight: 844 }, "phone-portrait", 164, 312, 22],
      [{ containerWidth: 1000, viewportWidth: 844, viewportHeight: 480 }, "short-landscape", 200, 240, 26],
      [{ containerWidth: 759, viewportWidth: 779, viewportHeight: 1121 }, "tablet", 220, 304, 29],
      [{ containerWidth: 760, viewportWidth: 1365, viewportHeight: 820 }, "compact-desktop", 256, 360, 33],
      [{ containerWidth: 960, viewportWidth: 1121, viewportHeight: 779 }, "wide-landscape", 280, 388, 36],
    ]
    const stored = getDefaultCarouselLabTuning("backgrounds", "existing")

    for (const [dimensions, expectedProfile, cardWidth, cardHeight, spread] of cases) {
      const profile = resolveCarouselLabViewportProfile(dimensions)
      assert.equal(profile, expectedProfile)
      assert.deepEqual(
        getResponsiveBackgroundTuning(profile, { ...stored, loop: false, motion: false }),
        {
          ...stored,
          cardWidth,
          cardHeight,
          gap: 0,
          visibleRadius: 2,
          loop: false,
          motion: false,
          spread,
          radius: 420,
          scaleFalloff: 0.08,
        },
      )
    }

    assert.equal(
      resolveCarouselLabViewportProfile({ containerWidth: 760, viewportWidth: 844, viewportHeight: 481 }),
      "compact-desktop",
    )
    assert.equal(
      resolveCarouselLabViewportProfile({ containerWidth: 959, viewportWidth: 1365, viewportHeight: 820 }),
      "compact-desktop",
    )
  })

  it("sanitizes shared and adapter-specific values", () => {
    assert.deepEqual(
      sanitizeCarouselLabTuning("backgrounds", "cover-flow", {
        cardWidth: 999,
        cardHeight: 999,
        gap: -4,
        visibleRadius: 9.5,
        loop: "yes",
        motion: false,
        rotation: 34.4,
        centerScale: Infinity,
        edgeScale: 0.4,
        perspective: 901,
        reflection: false,
        reflectionOpacity: 0.43,
        reflectionGap: 7.7,
      }),
      {
        cardWidth: 280,
        cardHeight: 480,
        gap: 0,
        visibleRadius: 4,
        loop: true,
        motion: false,
        rotation: 34,
        centerScale: 1.25,
        edgeScale: 0.6,
        perspective: 900,
        reflection: false,
        reflectionOpacity: 0.45,
        reflectionGap: 8,
      },
    )

    assert.deepEqual(
      sanitizeCarouselLabTuning("stations", "background-picker", {
        cardWidth: 196,
        cardHeight: 244,
        gap: 4,
        visibleRadius: 3,
        loop: true,
        motion: true,
        spread: 31,
        radius: 390,
        scaleFalloff: 0.08,
      }),
      {
        cardWidth: 196,
        cardHeight: 244,
        gap: 4,
        visibleRadius: 3,
        loop: true,
        motion: true,
        spread: 31,
        radius: 390,
        scaleFalloff: 0.08,
      },
    )
  })

  it("resets malformed storage entries independently", () => {
    const parsed = parseCarouselLabStorage(JSON.stringify({
      version: 4,
      values: {
        "backgrounds:existing": { radius: 400 },
        "stations:background-picker": "broken",
      },
    }))
    assert.equal(parsed["backgrounds:existing"].radius, 400)
    assert.equal(parsed["backgrounds:existing"].cardHeight, 360)
    assert.deepEqual(
      parsed["stations:background-picker"],
      getDefaultCarouselLabTuning("stations", "background-picker"),
    )
    assert.equal(Object.keys(parsed).length, 2)
    assert.deepEqual(parseCarouselLabStorage("{bad"), parseCarouselLabStorage(null))
    assert.deepEqual(
      parseCarouselLabStorage(JSON.stringify({ version: 3, values: {} })),
      parseCarouselLabStorage(null),
    )
    assert.deepEqual(parseCarouselLabStorage(serializeCarouselLabStorage(parsed)), parsed)
  })

  it("uses stable identity and a bounded nearby mount set", () => {
    assert.equal(reconcileCenteredId(items, "d", "b"), "d")
    assert.equal(reconcileCenteredId(items, "missing", "b"), "b")
    assert.equal(reconcileCenteredId(items, "missing", "also-missing"), "a")
    assert.equal(reconcileCenteredId([], "a", "b"), null)
    assert.deepEqual([...getMountedItemIds(items, "a", 1, false)], ["a", "b"])
    assert.deepEqual([...getMountedItemIds(items, "a", 1, true)], ["e", "a", "b"])
  })

  it("disables unstable loops and produces production-faithful Existing variables", () => {
    assert.equal(resolveEffectiveLoop(5, 2, true), true)
    assert.equal(resolveEffectiveLoop(3, 4, true), true)
    assert.equal(resolveEffectiveLoop(2, 1, true), false)
    assert.equal(resolveEffectiveLoop(20, 2, false), false)

    const tuning = getDefaultCarouselLabTuning("backgrounds", "existing")
    const center = getPresentationVariables("existing", "backgrounds", 0, tuning, false)
    const left = getPresentationVariables("existing", "backgrounds", -1, tuning, false)
    const right = getPresentationVariables("existing", "backgrounds", 1, tuning, false)
    assert.equal(center["--lab-scale"], "1")
    assert.equal(left["--lab-rotate-y"], "33deg")
    assert.equal(right["--lab-rotate-y"], "-33deg")
    assert.equal(left["--lab-scale"], "0.92")
    assert.equal(right["--lab-z"], "-28px")
    assert.equal(getPresentationVariables("existing", "backgrounds", 1, tuning, true)["--lab-scale"], "1")

    const picker = getDefaultCarouselLabTuning("stations", "background-picker")
    assert.deepEqual(
      getPresentationVariables("background-picker", "stations", 1, picker, false),
      getPresentationVariables("existing", "backgrounds", 1, picker, false),
    )
  })

  it("uses Cover Flow depth, edge origins, and symmetric side rotation", () => {
    const tuning = getDefaultCarouselLabTuning("backgrounds", "cover-flow")
    const center = getPresentationVariables("cover-flow", "backgrounds", 0, tuning, false)
    const movingRight = getPresentationVariables("cover-flow", "backgrounds", 0.5, tuning, false)
    const left = getPresentationVariables("cover-flow", "backgrounds", -1, tuning, false)
    const right = getPresentationVariables("cover-flow", "backgrounds", 1, tuning, false)

    assert.equal(center["--lab-scale"], "1.25")
    assert.notEqual(center["--lab-z"], "0px")
    assert.notEqual(movingRight["--lab-x"], "0px")
    assert.equal(left["--lab-rotate-y"], "16deg")
    assert.equal(right["--lab-rotate-y"], "-16deg")
    assert.equal(left["--lab-origin-x"], "100%")
    assert.equal(right["--lab-origin-x"], "0%")
  })

  it("places 3D cards on one source-style ring instead of fading a flat rail", () => {
    const tuning = getDefaultCarouselLabTuning("backgrounds", "three-d")
    const center = getPresentationVariables("three-d", "backgrounds", 0, tuning, false, 16)
    const side = getPresentationVariables("three-d", "backgrounds", 1, tuning, false, 81)

    assert.equal(center["--lab-z"], "0px")
    assert.equal(center["--lab-rotate-y"], "0deg")
    assert.equal(side["--lab-rotate-y"], "25.71deg")
    assert.notEqual(side["--lab-z"], "0px")
    assert.equal(side["--lab-opacity"], "1")
    assert.equal(getPresentationVariables("three-d", "backgrounds", 1, tuning, true, 16)["--lab-z"], "0px")
  })
})
