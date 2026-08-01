import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS,
  getTwistedCubeAlpha,
  getTwistedCubeCycleSeconds,
  getTwistedCubeDelaySeconds,
  getTwistedCubeSourceOutline,
  getTwistedCubesBackgroundOptionsFromChimerSettings,
  interpolateTwistedCubeOutline,
  sanitizeTwistedCubesBackgroundOptions,
  toTwistedCubesChimerSettingsPatch,
} from "../lib/twisted-cubes-background.js"
import { resolveResponsiveBackgroundTransform } from "../lib/background-effect-layout.js"

describe("Twisted Cubes background domain rules", () => {
  it("preserves the exact source defaults", () => {
    assert.deepEqual(DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS, {
      layerCount: 20,
      rotationSpeed: 0.25,
      layerStagger: 0.1,
      viewAngleX: -35,
      viewAngleY: -45,
      scale: 1,
      positionX: 0,
      positionY: 0,
      layerDepthSpacing: 50,
      opacityFalloff: 0.85,
      outlineThickness: 0.0075,
    })
    assert.equal(Object.isFrozen(DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS), true)
  })

  it("sanitizes every Twisted Cubes property to its approved stored range", () => {
    assert.deepEqual(sanitizeTwistedCubesBackgroundOptions({}), DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS)
    assert.deepEqual(
      sanitizeTwistedCubesBackgroundOptions({
        layerCount: 0,
        rotationSpeed: 0,
        layerStagger: -1,
        viewAngleX: -999,
        viewAngleY: -999,
        scale: 0,
        positionX: -999,
        positionY: -999,
        layerDepthSpacing: 0,
        opacityFalloff: -1,
        outlineThickness: 0,
      }),
      {
        layerCount: 6,
        rotationSpeed: 0.01,
        layerStagger: 0,
        viewAngleX: -80,
        viewAngleY: -80,
        scale: 0.4,
        positionX: -35,
        positionY: -35,
        layerDepthSpacing: 10,
        opacityFalloff: 0,
        outlineThickness: 0.0025,
      },
    )
    assert.deepEqual(
      sanitizeTwistedCubesBackgroundOptions({
        layerCount: 99.9,
        rotationSpeed: 99,
        layerStagger: 99,
        viewAngleX: 999,
        viewAngleY: 999,
        scale: 99,
        positionX: 999,
        positionY: 999,
        layerDepthSpacing: 999,
        opacityFalloff: 99,
        outlineThickness: 99,
      }),
      {
        layerCount: 30,
        rotationSpeed: 3,
        layerStagger: 0.3,
        viewAngleX: 80,
        viewAngleY: 80,
        scale: 1.2,
        positionX: 35,
        positionY: 35,
        layerDepthSpacing: 70,
        opacityFalloff: 0.95,
        outlineThickness: 0.02,
      },
    )
    assert.equal(sanitizeTwistedCubesBackgroundOptions({ layerCount: 20.8 }).layerCount, 20)
  })

  it("falls back to source defaults for non-finite Twisted Cubes inputs", () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      assert.deepEqual(
        sanitizeTwistedCubesBackgroundOptions(
          Object.fromEntries(Object.keys(DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS).map((key) => [key, invalid])),
        ),
        DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS,
      )
    }
  })

  it("preserves source-derived cycle, count-relative delay, and depth alpha", () => {
    assert.equal(getTwistedCubeCycleSeconds(1), 4)
    assert.equal(getTwistedCubeCycleSeconds(2), 2)
    assert.equal(getTwistedCubeCycleSeconds(0), 400)
    assert.equal(getTwistedCubeCycleSeconds(Infinity), 16)

    assert.ok(Math.abs(getTwistedCubeDelaySeconds({ oneBasedIndex: 1, count: 20, stagger: 0.1 }) + 1.7) < 1e-12)
    assert.ok(Math.abs(getTwistedCubeDelaySeconds({ oneBasedIndex: 20, count: 20, stagger: 0.1 }) - 0.2) < 1e-12)
    assert.equal(getTwistedCubeDelaySeconds({ oneBasedIndex: 3, count: 10, stagger: 0.2 }), -1)

    assert.equal(getTwistedCubeAlpha({ oneBasedIndex: 1, count: 20, opacityFalloff: 0.85 }), 0.9575)
    assert.ok(Math.abs(getTwistedCubeAlpha({ oneBasedIndex: 20, count: 20, opacityFalloff: 0.85 }) - 0.15) < 1e-12)
    assert.ok(Math.abs(getTwistedCubeAlpha({ oneBasedIndex: 30, count: 6, opacityFalloff: 0.95 }) - 0.05) < 1e-12)
  })

  it("keeps Source outlines continuous from 180 through 340 HSL degrees", () => {
    assert.equal(getTwistedCubeSourceOutline({ oneBasedIndex: 1, count: 20 }), "hsl(180 80% 60%)")
    assert.equal(getTwistedCubeSourceOutline({ oneBasedIndex: 20, count: 20 }), "hsl(340 80% 60%)")
    assert.equal(getTwistedCubeSourceOutline({ oneBasedIndex: 11, count: 20 }), "hsl(264.2105263157895 80% 60%)")
  })

  it("interpolates six Custom or Harmony anchors through five sRGB segments", () => {
    const anchors = ["#000000", "#330000", "#660000", "#990000", "#cc0000", "#ffffff"]
    assert.equal(interpolateTwistedCubeOutline({ anchors, oneBasedIndex: 1, count: 20 }), anchors[0])
    assert.equal(interpolateTwistedCubeOutline({ anchors, oneBasedIndex: 20, count: 20 }), anchors[5])
    assert.equal(interpolateTwistedCubeOutline({ anchors, oneBasedIndex: 3, count: 20 }), "rgb(27 0 0)")
    assert.equal(interpolateTwistedCubeOutline({ anchors, oneBasedIndex: 5, count: 20 }), "rgb(54 0 0)")
    assert.notEqual(
      interpolateTwistedCubeOutline({ anchors, oneBasedIndex: 3, count: 20 }),
      interpolateTwistedCubeOutline({ anchors, oneBasedIndex: 4, count: 20 }),
    )
  })

  it("uses supplied source anchors when a Custom or Harmony anchor is malformed", () => {
    const anchors = ["#000000", "invalid", "#660000", "#990000", "#cc0000", "#ffffff"]
    const sourceAnchors = ["#001122", "#223344", "#445566", "#667788", "#8899aa", "#bbccdd"]
    assert.equal(
      interpolateTwistedCubeOutline({ anchors, sourceAnchors, oneBasedIndex: 5, count: 20 }),
      "rgb(38 48 64)",
    )
  })

  it("maps flat Chimer preferences into sanitized Twisted Cubes options", () => {
    assert.deepEqual(
      getTwistedCubesBackgroundOptionsFromChimerSettings({
        massageLabTwistedCubesLayerCount: 24.6,
        massageLabTwistedCubesRotationSpeed: 2,
        massageLabTwistedCubesLayerStagger: 0.2,
        massageLabTwistedCubesViewAngleX: -40,
        massageLabTwistedCubesViewAngleY: 50,
        massageLabTwistedCubesScale: 0.8,
        massageLabTwistedCubesPositionX: 4,
        massageLabTwistedCubesPositionY: -5,
        massageLabTwistedCubesLayerDepthSpacing: 40,
        massageLabTwistedCubesOpacityFalloff: 0.5,
        massageLabTwistedCubesOutlineThickness: 0.01,
      }),
      {
        layerCount: 24,
        rotationSpeed: 2,
        layerStagger: 0.2,
        viewAngleX: -40,
        viewAngleY: 50,
        scale: 0.8,
        positionX: 4,
        positionY: -5,
        layerDepthSpacing: 40,
        opacityFalloff: 0.5,
        outlineThickness: 0.01,
      },
    )
  })

  it("serializes only known Twisted Cubes UI properties into a partial Chimer patch", () => {
    assert.deepEqual(
      toTwistedCubesChimerSettingsPatch({
        layerCount: 8,
        positionX: 12,
        interpolatedOutline: "rgb(1 2 3)",
        alpha: 0.5,
        anchors: ["#000000"],
        unrelated: true,
      }),
      { massageLabTwistedCubesLayerCount: 8, massageLabTwistedCubesPositionX: 12 },
    )
  })

  it("reuses the shared responsive transform without changing stored options", () => {
    const stored = { scale: 1.2, positionX: 35, positionY: -35 }
    assert.deepEqual(
      resolveResponsiveBackgroundTransform({ ...stored, compactViewport: true }),
      { scale: 1, positionX: 20, positionY: -20 },
    )
    assert.deepEqual(stored, { scale: 1.2, positionX: 35, positionY: -35 })
  })
})
