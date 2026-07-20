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
    assert.equal(CAROUSEL_LAB_STORAGE_KEY, "massagelab-carousel-lab-v1")
    assert.deepEqual(CAROUSEL_LAB_PAIRS, [
      "backgrounds:existing", "backgrounds:cover-flow", "backgrounds:three-d",
      "stations:existing", "stations:cover-flow", "stations:three-d",
    ])
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
        loop: false,
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
      version: 1,
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

  it("disables unstable loops and produces symmetric presentation variables", () => {
    assert.equal(resolveEffectiveLoop(5, 2, true), false)
    assert.equal(resolveEffectiveLoop(6, 2, true), true)
    assert.equal(resolveEffectiveLoop(20, 2, false), false)

    const tuning = getDefaultCarouselLabTuning("backgrounds", "cover-flow")
    const center = getPresentationVariables("cover-flow", "backgrounds", 0, tuning, false)
    const left = getPresentationVariables("cover-flow", "backgrounds", -1, tuning, false)
    const right = getPresentationVariables("cover-flow", "backgrounds", 1, tuning, false)
    assert.equal(center["--lab-scale"], "1.2")
    assert.equal(left["--lab-rotate-y"], "33deg")
    assert.equal(right["--lab-rotate-y"], "-33deg")
    assert.equal(getPresentationVariables("cover-flow", "backgrounds", 1, tuning, true)["--lab-scale"], "1")
  })

  it("uses both near and far mask falloff for non-centered 3D cards", () => {
    const tuning = getDefaultCarouselLabTuning("backgrounds", "three-d")
    const progress = 1

    const lowNear = getPresentationVariables("three-d", "backgrounds", progress, {
      ...tuning,
      nearMask: 0.25,
    }, false)
    const highNear = getPresentationVariables("three-d", "backgrounds", progress, {
      ...tuning,
      nearMask: 1.5,
    }, false)
    assert.notEqual(lowNear["--lab-opacity"], highNear["--lab-opacity"])

    const lowFar = getPresentationVariables("three-d", "backgrounds", progress, {
      ...tuning,
      farMask: 1,
    }, false)
    const highFar = getPresentationVariables("three-d", "backgrounds", progress, {
      ...tuning,
      farMask: 3,
    }, false)
    assert.notEqual(lowFar["--lab-opacity"], highFar["--lab-opacity"])

    assert.equal(getPresentationVariables("three-d", "backgrounds", 0, tuning, false)["--lab-opacity"], "1")
    assert.equal(getPresentationVariables("three-d", "backgrounds", progress, tuning, true)["--lab-opacity"], "1")
  })
})
