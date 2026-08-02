import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS,
  TWISTED_CUBES_OPTION_BOUNDS,
  TWISTED_CUBES_LAYER_STEP_VMAX,
  TWISTED_CUBES_DEPTH_PROJECTION_DIVISOR,
  getTwistedCubeAlpha,
  getTwistedCubeCycleSeconds,
  getTwistedCubeDelaySeconds,
  getTwistedCubeDepthScale,
  getTwistedCubeLayerSizeVmax,
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
      scale: 0.3,
      positionX: 0,
      positionY: 0,
      layerDepthSpacing: 50,
      opacityFalloff: 0.85,
      outlineThickness: 0.0075,
    })
    assert.equal(TWISTED_CUBES_LAYER_STEP_VMAX, 20)
    assert.equal(TWISTED_CUBES_DEPTH_PROJECTION_DIVISOR, 10000)
    assert.equal(Object.isFrozen(DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS), true)
    assert.equal(Object.isFrozen(TWISTED_CUBES_OPTION_BOUNDS), true)
    assert.equal(TWISTED_CUBES_OPTION_BOUNDS.layerCount.maximum, 30)
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
        scale: 0.1,
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
    for (const invalid of [NaN, Infinity, -Infinity, null, undefined, "20", true, {}]) {
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
    assert.equal(
      getTwistedCubeCycleSeconds(Infinity),
      4 / DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS.rotationSpeed,
    )

    // Delay follows (-(count - 2) + oneBasedIndex) * stagger.
    assert.ok(Math.abs(getTwistedCubeDelaySeconds({ oneBasedIndex: 1, count: 20, stagger: 0.1 }) + 1.7) < 1e-12)
    assert.ok(Math.abs(getTwistedCubeDelaySeconds({ oneBasedIndex: 20, count: 20, stagger: 0.1 }) - 0.2) < 1e-12)
    assert.equal(getTwistedCubeDelaySeconds({ oneBasedIndex: 3, count: 10, stagger: 0.2 }), -1)
    assert.ok(Number.isFinite(getTwistedCubeDelaySeconds({ oneBasedIndex: 1, count: 0, stagger: 0.1 })))

    // Alpha clamps oneBasedIndex to count, then applies clamp(1 - (falloff / count) * index, 0, 1).
    assert.equal(getTwistedCubeAlpha({ oneBasedIndex: 1, count: 20, opacityFalloff: 0.85 }), 0.9575)
    assert.ok(Math.abs(getTwistedCubeAlpha({ oneBasedIndex: 20, count: 20, opacityFalloff: 0.85 }) - 0.15) < 1e-12)
    assert.ok(Math.abs(getTwistedCubeAlpha({ oneBasedIndex: 30, count: 6, opacityFalloff: 0.95 }) - 0.05) < 1e-12)
    assert.ok(Number.isFinite(getTwistedCubeAlpha({ oneBasedIndex: 1, count: 0, opacityFalloff: 0.85 })))
  })

  it("scales the complete layer progression and fills the viewport at the approved default", () => {
    // Size is oneBasedIndex * 20 * scale vmax, with scale 0 retaining the 20vmax minimum.
    assert.ok(Math.abs(getTwistedCubeLayerSizeVmax({
      oneBasedIndex: 1,
      count: 20,
      scale: 0.3,
    }) - 6) < 1e-12)
    assert.equal(getTwistedCubeLayerSizeVmax({ oneBasedIndex: 20, count: 20, scale: 0.3 }), 120)
    assert.equal(getTwistedCubeLayerSizeVmax({ oneBasedIndex: 20, count: 20, scale: 1.2 }), 480)
    assert.equal(getTwistedCubeLayerSizeVmax({ oneBasedIndex: 10, count: 20, scale: 1 }), 200)
    assert.equal(getTwistedCubeLayerSizeVmax({ oneBasedIndex: 10, count: 20, scale: 0 }), 20)
  })

  it("projects layer depth visibly without introducing perspective distortion", () => {
    assert.equal(getTwistedCubeDepthScale({ oneBasedIndex: 20, count: 20, layerDepthSpacing: 50 }), 1)
    assert.equal(getTwistedCubeDepthScale({ oneBasedIndex: 1, count: 20, layerDepthSpacing: 50 }), 1.095)
    assert.equal(getTwistedCubeDepthScale({ oneBasedIndex: 1, count: 30, layerDepthSpacing: 70 }), 1.203)
    assert.ok(
      getTwistedCubeDepthScale({ oneBasedIndex: 1, count: 20, layerDepthSpacing: 51 })
        > getTwistedCubeDepthScale({ oneBasedIndex: 1, count: 20, layerDepthSpacing: 50 }),
    )
  })

  it("keeps Source outlines continuous from 180 through 340 HSL degrees", () => {
    assert.equal(getTwistedCubeSourceOutline({ oneBasedIndex: 1, count: 0 }), "hsl(180 80% 60%)")
    assert.equal(getTwistedCubeSourceOutline({ oneBasedIndex: 1, count: 1 }), "hsl(180 80% 60%)")
    assert.equal(getTwistedCubeSourceOutline({ oneBasedIndex: 1, count: 20 }), "hsl(180 80% 60%)")
    assert.equal(getTwistedCubeSourceOutline({ oneBasedIndex: 20, count: 20 }), "hsl(340 80% 60%)")
    const middleOutline = getTwistedCubeSourceOutline({ oneBasedIndex: 11, count: 20 })
    const middleHue = Number(/^hsl\(([-\d.]+)/.exec(middleOutline)?.[1])
    assert.ok(Math.abs(middleHue - 264.2105263157895) < 1e-12)
  })

  it("interpolates six Custom or Harmony anchors through five sRGB segments", () => {
    const anchors = ["#000000", "#330000", "#660000", "#990000", "#cc0000", "#ffffff"]
    assert.equal(interpolateTwistedCubeOutline({ anchors, oneBasedIndex: 1, count: 0 }), anchors[0])
    assert.equal(interpolateTwistedCubeOutline({ anchors, oneBasedIndex: 1, count: 1 }), anchors[0])
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
    const hslSourceAnchors = [
      "hsl(180 80% 60%)",
      "hsl(212 80% 60%)",
      "hsl(244 80% 60%)",
      "hsl(276 80% 60%)",
      "hsl(308 80% 60%)",
      "hsl(340 80% 60%)",
    ]
    assert.equal(
      interpolateTwistedCubeOutline({
        anchors: ["invalid", ...anchors.slice(1)],
        sourceAnchors: hslSourceAnchors,
        oneBasedIndex: 1,
        count: 6,
      }),
      hslSourceAnchors[0],
    )
    assert.equal(
      interpolateTwistedCubeOutline({
        anchors: [anchors[0], "invalid", ...anchors.slice(2)],
        sourceAnchors: hslSourceAnchors,
        oneBasedIndex: 2,
        count: 6,
      }),
      "rgb(71 148 235)",
    )
    assert.equal(
      interpolateTwistedCubeOutline({
        anchors: [anchors[0], "invalid", ...anchors.slice(2)],
        oneBasedIndex: 2,
        count: 6,
      }),
      "rgb(71 148 235)",
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
        rotationSpeed: 0.5,
        layerStagger: 0.15,
        viewAngleX: -20,
        viewAngleY: 25,
        scale: 0.4,
        positionX: 12,
        positionY: -9,
        layerDepthSpacing: 30,
        opacityFalloff: 0.7,
        outlineThickness: 0.005,
        interpolatedOutline: "rgb(1 2 3)",
        alpha: 0.5,
        anchors: ["#000000"],
        unrelated: true,
      }),
      {
        massageLabTwistedCubesLayerCount: 8,
        massageLabTwistedCubesRotationSpeed: 0.5,
        massageLabTwistedCubesLayerStagger: 0.15,
        massageLabTwistedCubesViewAngleX: -20,
        massageLabTwistedCubesViewAngleY: 25,
        massageLabTwistedCubesScale: 0.4,
        massageLabTwistedCubesPositionX: 12,
        massageLabTwistedCubesPositionY: -9,
        massageLabTwistedCubesLayerDepthSpacing: 30,
        massageLabTwistedCubesOpacityFalloff: 0.7,
        massageLabTwistedCubesOutlineThickness: 0.005,
      },
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
