import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CAROUSEL_LAB_PAIRS,
  CAROUSEL_LAB_STORAGE_KEY,
  getDefaultCarouselLabTuning,
  getMountedItemIds,
  getPresentationVariables,
  parseCarouselLabStorage,
  reconcileCenteredId,
  resolveEffectiveLoop,
  sanitizeCarouselLabTuning,
  serializeCarouselLabStorage,
} from "../app/dev/buttons/carousel-lab/carousel-lab-model.js"

const items = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: id }))

describe("Carousel Lab model", () => {
  it("defines seven independent surface/presentation pairs", () => {
    assert.equal(CAROUSEL_LAB_STORAGE_KEY, "massagelab-carousel-lab-v3")
    assert.deepEqual(CAROUSEL_LAB_PAIRS, [
      "backgrounds:existing", "backgrounds:cover-flow", "backgrounds:three-d",
      "stations:existing", "stations:cover-flow", "stations:three-d",
      "stations:background-picker",
    ])
  })

  it("uses production Existing geometry and source-native reference defaults", () => {
    assert.deepEqual(getDefaultCarouselLabTuning("backgrounds", "existing"), {
      cardWidth: 268,
      gap: 18,
      visibleRadius: 4,
      loop: true,
      motion: true,
      spread: 27,
      radius: 420,
      scaleFalloff: 0.05,
    })

    const coverFlow = getDefaultCarouselLabTuning("backgrounds", "cover-flow")
    assert.equal(coverFlow.cardWidth, 192)
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
    assert.equal(threeD.gap, 0)
    assert.equal(threeD.loop, true)
    assert.equal(threeD.perspective, 50)
    assert.equal(threeD.ringItems, 14)
    assert.equal(threeD.depth, 1)
    assert.equal(threeD.nearMask, 1)
    assert.equal(threeD.farMask, 2)

    const stationCover = getDefaultCarouselLabTuning("stations", "cover-flow")
    assert.equal(stationCover.rotation, 16)
    assert.equal(stationCover.centerScale, 1.25)
    assert.equal(stationCover.edgeScale, 0.6)
    assert.equal(stationCover.perspective, 320)
    assert.equal(stationCover.reflectionGap, 3)

    assert.deepEqual(getDefaultCarouselLabTuning("stations", "background-picker"), {
      cardWidth: 192,
      gap: 0,
      visibleRadius: 4,
      loop: true,
      motion: true,
      spread: 27,
      radius: 420,
      scaleFalloff: 0.05,
    })
  })

  it("sanitizes shared and adapter-specific values", () => {
    assert.deepEqual(
      sanitizeCarouselLabTuning("backgrounds", "cover-flow", {
        cardWidth: 999,
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
      version: 3,
      values: {
        "backgrounds:existing": { radius: 400 },
        "stations:three-d": "broken",
      },
    }))
    assert.equal(parsed["backgrounds:existing"].radius, 400)
    assert.deepEqual(parsed["stations:three-d"], getDefaultCarouselLabTuning("stations", "three-d"))
    assert.equal(Object.keys(parsed).length, 7)
    assert.deepEqual(parseCarouselLabStorage("{bad"), parseCarouselLabStorage(null))
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
    assert.equal(left["--lab-rotate-y"], "27deg")
    assert.equal(right["--lab-rotate-y"], "-27deg")
    assert.equal(left["--lab-scale"], "0.95")
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
