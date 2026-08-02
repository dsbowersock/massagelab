import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_DNA_BACKGROUND_OPTIONS,
  DNA_BASE_PAIRS,
  DNA_BASE_ROLE_INDEX,
  DNA_OPTION_BOUNDS,
  DNA_SOURCE_GEOMETRY,
  createDnaStrandAssignments,
  getDnaBackgroundOptionsFromChimerSettings,
  getDnaNodeCycleSeconds,
  getDnaStrandDelaySeconds,
  getDnaStrandPhase,
  getDnaStrandRotationSeconds,
  sanitizeDnaBackgroundOptions,
  toDnaChimerSettingsPatch,
} from "../lib/dna-background.js"
import {
  clampBoundedBackgroundOption,
  clampEffectiveValue,
  resolveRenderCount,
  resolveResponsiveBackgroundTransform,
} from "../lib/background-effect-layout.js"

describe("DNA background domain and shared layout rules", () => {
  it("preserves the approved continuous-strand defaults and fixed geometry", () => {
    assert.deepEqual(DEFAULT_DNA_BACKGROUND_OPTIONS, {
      strandCount: 70,
      showBaseLetters: false,
      nodeMotionSpeed: 0.06,
      strandRotationSpeed: 0.02,
      strandAngle: 30,
      scale: 0.5,
      positionX: 0,
      positionY: 0,
      strandSpacing: 0.5,
      connectorWidth: 94,
      connectorThickness: 15,
      outlineThickness: 0.1,
    })
    assert.deepEqual(DNA_SOURCE_GEOMETRY, {
      widthVmin: 26,
      minimumHeightVmin: 240,
      viewportHeightVmax: 230,
    })
    assert.equal(Object.isFrozen(DEFAULT_DNA_BACKGROUND_OPTIONS), true)
    assert.equal(Object.isFrozen(DNA_OPTION_BOUNDS), true)
    assert.equal(DNA_OPTION_BOUNDS.strandCount.maximum, 81)
    assert.equal(Object.isFrozen(DNA_SOURCE_GEOMETRY), true)
  })

  it("clamps invalid responsive values through the same bounded fallback path", () => {
    assert.equal(clampEffectiveValue(Number.NaN, 0.1, 1, 99), 1)
    assert.equal(clampEffectiveValue(Number.POSITIVE_INFINITY, -20, 20, -99), -20)
    assert.equal(
      clampBoundedBackgroundOption(8.9, { minimum: 1, maximum: 7, integer: true }, 3),
      7,
    )
    assert.equal(
      clampBoundedBackgroundOption(Number.NaN, { minimum: 1, maximum: 7 }, 3),
      3,
    )
    assert.equal(
      clampBoundedBackgroundOption(Number.NaN, { minimum: 1, maximum: 7, integer: true }, 9.8),
      7,
    )
    assert.equal(
      clampBoundedBackgroundOption(Number.NaN, { minimum: 1, maximum: 7, integer: true }, 4.8),
      4,
    )
    assert.equal(resolveRenderCount(12.9, 10), 10)
    assert.equal(resolveRenderCount(-4, 10), 0)
    assert.equal(resolveRenderCount(Number.NaN, 10), 0)
  })

  it("sanitizes every DNA property to its approved stored range", () => {
    assert.deepEqual(sanitizeDnaBackgroundOptions({}), DEFAULT_DNA_BACKGROUND_OPTIONS)
    assert.deepEqual(
      sanitizeDnaBackgroundOptions({
        strandCount: 0,
        nodeMotionSpeed: 0,
        strandRotationSpeed: 0,
        strandAngle: -999,
        scale: 0,
        positionX: -999,
        positionY: -999,
        strandSpacing: -1,
        connectorWidth: 0,
        connectorThickness: 0,
        outlineThickness: -1,
      }),
      {
        strandCount: 7,
        showBaseLetters: false,
        nodeMotionSpeed: 0.01,
        strandRotationSpeed: 0.01,
        strandAngle: -180,
        scale: 0.4,
        positionX: -35,
        positionY: -35,
        strandSpacing: 0,
        connectorWidth: 60,
        connectorThickness: 10,
        outlineThickness: 0,
      },
    )
    assert.deepEqual(
      sanitizeDnaBackgroundOptions({
        strandCount: 99.9,
        nodeMotionSpeed: 99,
        strandRotationSpeed: 99,
        strandAngle: 999,
        scale: 99,
        positionX: 999,
        positionY: 999,
        strandSpacing: 99,
        connectorWidth: 999,
        connectorThickness: 999,
        outlineThickness: 99,
      }),
      {
        strandCount: 81,
        showBaseLetters: false,
        nodeMotionSpeed: 3,
        strandRotationSpeed: 3,
        strandAngle: 180,
        scale: 1.2,
        positionX: 35,
        positionY: 35,
        strandSpacing: 2,
        connectorWidth: 100,
        connectorThickness: 60,
        outlineThickness: 1.5,
      },
    )
    assert.equal(sanitizeDnaBackgroundOptions({ strandCount: 13.9 }).strandCount, 13)
  })

  it("falls back to source defaults for non-finite DNA inputs", () => {
    const numericOptionKeys = Object.keys(DEFAULT_DNA_BACKGROUND_OPTIONS)
      .filter((key) => key !== "showBaseLetters")
    for (const invalid of [NaN, Infinity, -Infinity, null, undefined, "20", true, {}]) {
      assert.deepEqual(
        sanitizeDnaBackgroundOptions(
          Object.fromEntries(numericOptionKeys.map((key) => [key, invalid])),
        ),
        DEFAULT_DNA_BACKGROUND_OPTIONS,
      )
    }
  })

  it("uses independent inverse speed durations and the source sine phase", () => {
    assert.equal(getDnaNodeCycleSeconds(1), 2)
    assert.equal(getDnaStrandRotationSeconds(1), 14)
    assert.equal(getDnaNodeCycleSeconds(2), 1)
    assert.equal(getDnaStrandRotationSeconds(2), 7)
    assert.equal(getDnaNodeCycleSeconds(0), 200)
    assert.equal(getDnaStrandRotationSeconds(0), 1400)
    assert.equal(getDnaNodeCycleSeconds(Number.NaN), 2 / DEFAULT_DNA_BACKGROUND_OPTIONS.nodeMotionSpeed)
    assert.equal(
      getDnaStrandRotationSeconds(Infinity),
      14 / DEFAULT_DNA_BACKGROUND_OPTIONS.strandRotationSpeed,
    )

    const phase = Math.sin((Math.PI / 180) * 45 * (3 / 13))
    assert.equal(getDnaStrandPhase({ oneBasedIndex: 3, total: 13 }), phase)
    assert.equal(
      getDnaStrandDelaySeconds({ oneBasedIndex: 3, total: 13, speed: 1 }),
      -phase * 2,
    )
    assert.equal(
      getDnaStrandDelaySeconds({ oneBasedIndex: 3, total: 13, speed: 2 }),
      -phase,
    )
  })

  it("creates biologically valid base pairs with nucleotide-specific swatch roles", () => {
    const sequence = [0, 0.26, 0.51, 0.76]
    let index = 0
    const assignments = createDnaStrandAssignments(4, () => sequence[index++])

    assert.deepEqual(DNA_BASE_PAIRS, [["A", "T"], ["T", "A"], ["G", "C"], ["C", "G"]])
    assert.deepEqual(DNA_BASE_ROLE_INDEX, { A: 0, T: 1, G: 2, C: 3 })
    assert.deepEqual(assignments, [
      { startBase: "A", endBase: "T", startRole: 0, endRole: 1 },
      { startBase: "T", endBase: "A", startRole: 1, endRole: 0 },
      { startBase: "G", endBase: "C", startRole: 2, endRole: 3 },
      { startBase: "C", endBase: "G", startRole: 3, endRole: 2 },
    ])
    for (const [value, expectedPair] of [
      [-1, { startBase: "A", endBase: "T", startRole: 0, endRole: 1 }],
      [1, { startBase: "C", endBase: "G", startRole: 3, endRole: 2 }],
      [2, { startBase: "C", endBase: "G", startRole: 3, endRole: 2 }],
      [Number.NaN, { startBase: "A", endBase: "T", startRole: 0, endRole: 1 }],
      [Number.POSITIVE_INFINITY, { startBase: "A", endBase: "T", startRole: 0, endRole: 1 }],
      [Number.NEGATIVE_INFINITY, { startBase: "A", endBase: "T", startRole: 0, endRole: 1 }],
    ]) {
      assert.deepEqual(createDnaStrandAssignments(1, () => value), [expectedPair], String(value))
    }
  })

  it("preserves only explicit boolean base-letter preferences", () => {
    assert.equal(sanitizeDnaBackgroundOptions({ showBaseLetters: true }).showBaseLetters, true)
    assert.equal(sanitizeDnaBackgroundOptions({ showBaseLetters: "true" }).showBaseLetters, false)
  })

  it("clamps only the effective responsive transform without changing stored options", () => {
    const stored = { scale: 1.2, positionX: 35, positionY: -35 }
    assert.deepEqual(
      resolveResponsiveBackgroundTransform({ ...stored, compactViewport: true }),
      { scale: 1, positionX: 20, positionY: -20 },
    )
    assert.deepEqual(
      resolveResponsiveBackgroundTransform({ ...stored, compactViewport: false }),
      stored,
    )
    assert.deepEqual(stored, { scale: 1.2, positionX: 35, positionY: -35 })
  })

  it("maps flat Chimer preferences into sanitized DNA options", () => {
    assert.deepEqual(
      getDnaBackgroundOptionsFromChimerSettings({
        massageLabDnaStrandCount: 24.6,
        massageLabDnaShowBaseLetters: true,
        massageLabDnaNodeMotionSpeed: 2,
        massageLabDnaStrandRotationSpeed: 0.5,
        massageLabDnaStrandAngle: -40,
        massageLabDnaScale: 0.8,
        massageLabDnaPositionX: 4,
        massageLabDnaPositionY: -5,
        massageLabDnaStrandSpacing: 1.1,
        massageLabDnaConnectorWidth: 80,
        massageLabDnaConnectorThickness: 44,
        massageLabDnaOutlineThickness: 1,
      }),
      {
        strandCount: 24,
        showBaseLetters: true,
        nodeMotionSpeed: 2,
        strandRotationSpeed: 0.5,
        strandAngle: -40,
        scale: 0.8,
        positionX: 4,
        positionY: -5,
        strandSpacing: 1.1,
        connectorWidth: 80,
        connectorThickness: 44,
        outlineThickness: 1,
      },
    )
  })

  it("serializes only known DNA UI properties into a partial Chimer patch", () => {
    assert.deepEqual(
      toDnaChimerSettingsPatch({
        strandCount: 8,
        showBaseLetters: true,
        positionX: 12,
        backgroundColor: "#123456",
        nodeRoles: [1, 2],
        computedPhase: 0.2,
        unrelated: true,
      }),
      { massageLabDnaStrandCount: 8, massageLabDnaShowBaseLetters: true, massageLabDnaPositionX: 12 },
    )
  })
})
