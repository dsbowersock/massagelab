import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_DNA_BACKGROUND_OPTIONS,
  DNA_SOURCE_GEOMETRY,
  createDnaNodeRoleAssignments,
  getDnaBackgroundOptionsFromChimerSettings,
  getDnaNodeCycleSeconds,
  getDnaStrandDelaySeconds,
  getDnaStrandPhase,
  getDnaStrandRotationSeconds,
  sanitizeDnaBackgroundOptions,
  toDnaChimerSettingsPatch,
} from "../lib/dna-background.js"
import { resolveResponsiveBackgroundTransform } from "../lib/background-effect-layout.js"

describe("DNA background domain and shared layout rules", () => {
  it("preserves the exact source defaults and fixed source geometry", () => {
    assert.deepEqual(DEFAULT_DNA_BACKGROUND_OPTIONS, {
      strandCount: 13,
      nodeMotionSpeed: 1,
      strandRotationSpeed: 1,
      strandAngle: 30,
      scale: 1,
      positionX: 0,
      positionY: 0,
      strandSpacing: 0.5,
      connectorWidth: 94,
      connectorThickness: 30,
      outlineThickness: 0.5,
    })
    assert.deepEqual(DNA_SOURCE_GEOMETRY, { heightVmin: 65, aspectRatio: "2 / 5" })
    assert.equal(Object.isFrozen(DEFAULT_DNA_BACKGROUND_OPTIONS), true)
    assert.equal(Object.isFrozen(DNA_SOURCE_GEOMETRY), true)
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
        nodeMotionSpeed: 0.25,
        strandRotationSpeed: 0.1,
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
        strandCount: 25,
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
    for (const invalid of [NaN, Infinity, -Infinity]) {
      assert.deepEqual(
        sanitizeDnaBackgroundOptions(
          Object.fromEntries(Object.keys(DEFAULT_DNA_BACKGROUND_OPTIONS).map((key) => [key, invalid])),
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
    assert.equal(getDnaNodeCycleSeconds(0), 8)
    assert.equal(getDnaStrandRotationSeconds(Infinity), 14)

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

  it("creates two deterministic valid role assignments per strand and normalizes invalid randomness", () => {
    assert.deepEqual(createDnaNodeRoleAssignments(3, () => 0.5), [2, 2, 2])
    assert.deepEqual(createDnaNodeRoleAssignments(3, () => 2), [3, 3, 3])
    assert.deepEqual(createDnaNodeRoleAssignments(3, () => -1), [0, 0, 0])
    for (const invalid of [NaN, Infinity, -Infinity]) {
      assert.deepEqual(createDnaNodeRoleAssignments(2, () => invalid), [0, 0])
    }
    const assignments = createDnaNodeRoleAssignments(25, () => 0.9999)
    assert.equal(assignments.length, 25)
    assert.ok(assignments.every((assignment) => Number.isInteger(assignment) && assignment >= 0 && assignment <= 3))
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
        positionX: 12,
        backgroundColor: "#123456",
        nodeRoles: [1, 2],
        computedPhase: 0.2,
        unrelated: true,
      }),
      { massageLabDnaStrandCount: 8, massageLabDnaPositionX: 12 },
    )
  })
})
