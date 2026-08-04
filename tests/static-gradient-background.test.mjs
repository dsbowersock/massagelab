import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS,
  DEFAULT_STATIC_GRADIENT_CHIMER_SETTINGS,
  STATIC_GRADIENT_SOURCE_COLORS,
  buildStaticGradientCss,
  distributeStaticGradientStops,
  getStaticGradientBackgroundOptionsFromChimerSettings,
  sanitizeStaticGradientBackgroundOptions,
  toStaticGradientChimerSettingsPatch,
} from "../lib/static-gradient-background.js"
import { DEFAULT_CHIMER_SETTINGS, sanitizeChimerSettings } from "../lib/chimer-timer.js"

describe("Static Gradient background", () => {
  it("starts with all seven source colors and evenly distributed stops", () => {
    assert.deepEqual(STATIC_GRADIENT_SOURCE_COLORS, [
      "#050505",
      "#26140A",
      "#FF7A1A",
      "#101318",
      "#4169E1",
      "#10182B",
      "#050505",
    ])
    assert.deepEqual(DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS, {
      type: "linear",
      colorCount: 7,
      angle: 145,
      centerX: 50,
      centerY: 50,
      radialShape: "ellipse",
      radialSize: "farthest-corner",
      stopPositions: [0, 17, 33, 50, 67, 83, 100],
    })
    assert.deepEqual(distributeStaticGradientStops(2), [0, 100, 100, 100, 100, 100, 100])
    assert.deepEqual(distributeStaticGradientStops(4), [0, 33, 67, 100, 100, 100, 100])
  })

  it("sanitizes the supported geometry and keeps active stops ordered", () => {
    assert.deepEqual(
      sanitizeStaticGradientBackgroundOptions({
        type: "radial",
        colorCount: 4.9,
        angle: 999,
        centerX: -10,
        centerY: 130,
        radialShape: "circle",
        radialSize: "closest-side",
        stopPositions: [80, 10, 65, 40, 0, 0, 0],
      }),
      {
        type: "radial",
        colorCount: 4,
        angle: 360,
        centerX: 0,
        centerY: 100,
        radialShape: "circle",
        radialSize: "closest-side",
        stopPositions: [80, 80, 80, 80, 100, 100, 100],
      },
    )

    assert.deepEqual(
      sanitizeStaticGradientBackgroundOptions({
        type: "conic",
        colorCount: 99,
        radialShape: "square",
        radialSize: "cover",
        stopPositions: "invalid",
      }),
      {
        ...DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS,
        colorCount: 7,
      },
    )
  })

  it("builds truthful linear and radial CSS from the active colors", () => {
    assert.equal(
      buildStaticGradientCss({
        ...DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS,
        colorCount: 3,
        angle: 90,
        stopPositions: [10, 50, 90, 100, 100, 100, 100],
        colors: ["#111111", "#777777", "#FFFFFF", "#000000", "#000000", "#000000", "#000000"],
      }),
      "linear-gradient(90deg, #111111 10%, #777777 50%, #FFFFFF 90%)",
    )
    assert.equal(
      buildStaticGradientCss({
        ...DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS,
        type: "radial",
        colorCount: 2,
        centerX: 25,
        centerY: 75,
        radialShape: "circle",
        radialSize: "closest-side",
        stopPositions: [0, 100, 100, 100, 100, 100, 100],
        colors: ["#FF0000", "#0000FF", "#000000", "#000000", "#000000", "#000000", "#000000"],
      }),
      "radial-gradient(circle closest-side at 25% 75%, #FF0000 0%, #0000FF 100%)",
    )
  })

  it("maps flat Chimer settings through a complete reversible patch", () => {
    const options = getStaticGradientBackgroundOptionsFromChimerSettings({
      staticGradientType: "radial",
      staticGradientColorCount: 3,
      staticGradientAngle: 30,
      staticGradientCenterX: 20,
      staticGradientCenterY: 80,
      staticGradientRadialShape: "circle",
      staticGradientRadialSize: "farthest-side",
      staticGradientStopPositions: [5, 35, 95, 100, 100, 100, 100],
    })

    assert.deepEqual(options, {
      type: "radial",
      colorCount: 3,
      angle: 30,
      centerX: 20,
      centerY: 80,
      radialShape: "circle",
      radialSize: "farthest-side",
      stopPositions: [5, 35, 95, 100, 100, 100, 100],
    })
    assert.deepEqual(toStaticGradientChimerSettingsPatch(options), {
      staticGradientType: "radial",
      staticGradientColorCount: 3,
      staticGradientAngle: 30,
      staticGradientCenterX: 20,
      staticGradientCenterY: 80,
      staticGradientRadialShape: "circle",
      staticGradientRadialSize: "farthest-side",
      staticGradientStopPositions: [5, 35, 95, 100, 100, 100, 100],
    })
  })

  it("persists sanitized gradient settings through the canonical Chimer schema", () => {
    assert.deepEqual(
      Object.fromEntries(Object.keys(DEFAULT_STATIC_GRADIENT_CHIMER_SETTINGS).map((key) => [
        key,
        DEFAULT_CHIMER_SETTINGS[key],
      ])),
      DEFAULT_STATIC_GRADIENT_CHIMER_SETTINGS,
    )
    const sanitized = sanitizeChimerSettings({
      ...DEFAULT_CHIMER_SETTINGS,
      staticGradientType: "radial",
      staticGradientColorCount: 2,
      staticGradientCenterX: 101,
      staticGradientStopPositions: [20, 80],
    })
    assert.equal(sanitized.staticGradientType, "radial")
    assert.equal(sanitized.staticGradientColorCount, 2)
    assert.equal(sanitized.staticGradientCenterX, 100)
    assert.deepEqual(sanitized.staticGradientStopPositions, [20, 80, 100, 100, 100, 100, 100])
  })
})
