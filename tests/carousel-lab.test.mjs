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
  it("defines exactly six independent surface/presentation pairs", () => {
    assert.equal(CAROUSEL_LAB_STORAGE_KEY, "massagelab-carousel-lab-v2")
    assert.deepEqual(CAROUSEL_LAB_PAIRS, [
      "backgrounds:existing", "backgrounds:cover-flow", "backgrounds:three-d",
      "stations:existing", "stations:cover-flow", "stations:three-d",
    ])
  })

  it("uses production Existing geometry and source-native reference defaults", () => {
    assert.deepEqual(getDefaultCarouselLabTuning("backgrounds", "existing"), {
      cardWidth: 224,
      gap: 0,
      visibleRadius: 3,
      loop: true,
      motion: true,
      spread: 35,
      radius: 285,
      scaleFalloff: 0.16,
    })

    const coverFlow = getDefaultCarouselLabTuning("backgrounds", "cover-flow")
    assert.equal(coverFlow.cardWidth, 216)
    assert.equal(coverFlow.gap, 0)
    assert.equal(coverFlow.visibleRadius, 4)
    assert.equal(coverFlow.rotation, 33)
    assert.equal(coverFlow.centerScale, 1.2)
    assert.equal(coverFlow.edgeScale, 0.75)
    assert.equal(coverFlow.reflectionOpacity, 0.75)

    const threeD = getDefaultCarouselLabTuning("backgrounds", "three-d")
    assert.equal(threeD.cardWidth, 192)
    assert.equal(threeD.gap, 20)
    assert.equal(threeD.perspective, 320)
    assert.equal(threeD.ringItems, 16)
    assert.equal(threeD.depth, 1)
    assert.equal(threeD.nearMask, 0.9)
    assert.equal(threeD.farMask, 1.8)
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
        centerScale: 1.2,
        edgeScale: 0.6,
        perspective: 900,
        reflection: false,
        reflectionOpacity: 0.45,
        reflectionGap: 8,
      },
    )
  })

  it("resets malformed storage entries independently", () => {
    const parsed = parseCarouselLabStorage(JSON.stringify({
      version: 2,
      values: {
        "backgrounds:existing": { radius: 400 },
        "stations:three-d": "broken",
      },
    }))
    assert.equal(parsed["backgrounds:existing"].radius, 400)
    assert.deepEqual(parsed["stations:three-d"], getDefaultCarouselLabTuning("stations", "three-d"))
    assert.equal(Object.keys(parsed).length, 6)
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
    assert.equal(resolveEffectiveLoop(5, 2, true), false)
    assert.equal(resolveEffectiveLoop(6, 2, true), true)
    assert.equal(resolveEffectiveLoop(20, 2, false), false)

    const tuning = getDefaultCarouselLabTuning("backgrounds", "existing")
    const center = getPresentationVariables("existing", "backgrounds", 0, tuning, false)
    const left = getPresentationVariables("existing", "backgrounds", -1, tuning, false)
    const right = getPresentationVariables("existing", "backgrounds", 1, tuning, false)
    assert.equal(center["--lab-scale"], "1")
    assert.equal(left["--lab-rotate-y"], "35deg")
    assert.equal(right["--lab-rotate-y"], "-35deg")
    assert.equal(left["--lab-scale"], "0.84")
    assert.equal(right["--lab-z"], "-28px")
    assert.equal(getPresentationVariables("existing", "backgrounds", 1, tuning, true)["--lab-scale"], "1")
  })

  it("uses Cover Flow depth, edge origins, and symmetric side rotation", () => {
    const tuning = getDefaultCarouselLabTuning("backgrounds", "cover-flow")
    const center = getPresentationVariables("cover-flow", "backgrounds", 0, tuning, false)
    const movingRight = getPresentationVariables("cover-flow", "backgrounds", 0.5, tuning, false)
    const left = getPresentationVariables("cover-flow", "backgrounds", -1, tuning, false)
    const right = getPresentationVariables("cover-flow", "backgrounds", 1, tuning, false)

    assert.equal(center["--lab-scale"], "1.2")
    assert.notEqual(center["--lab-z"], "0px")
    assert.notEqual(movingRight["--lab-x"], "0px")
    assert.equal(left["--lab-rotate-y"], "33deg")
    assert.equal(right["--lab-rotate-y"], "-33deg")
    assert.equal(left["--lab-origin-x"], "100%")
    assert.equal(right["--lab-origin-x"], "0%")
  })

  it("places 3D cards on one source-style ring instead of fading a flat rail", () => {
    const tuning = getDefaultCarouselLabTuning("backgrounds", "three-d")
    const center = getPresentationVariables("three-d", "backgrounds", 0, tuning, false, 16)
    const side = getPresentationVariables("three-d", "backgrounds", 1, tuning, false, 81)

    assert.equal(center["--lab-z"], "0px")
    assert.equal(center["--lab-rotate-y"], "0deg")
    assert.equal(side["--lab-rotate-y"], "22.5deg")
    assert.notEqual(side["--lab-z"], "0px")
    assert.equal(side["--lab-opacity"], "1")
    assert.equal(getPresentationVariables("three-d", "backgrounds", 1, tuning, true, 16)["--lab-z"], "0px")
  })
})
