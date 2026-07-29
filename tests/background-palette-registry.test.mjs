import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_CHIMER_SETTINGS, sanitizeChimerSettings } from "../lib/chimer-timer.js"
import {
  backgroundPaletteRegistry,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"
import {
  backgroundRegistry,
} from "../components/backgrounds/backgroundRegistry.ts"

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const VALID_STATUSES = new Set(["pending", "supported", "unsupported"])
const VALID_RENDERER_FAMILIES = new Set(["css-dom", "canvas", "webgl"])
const sanitizedDefaults = sanitizeChimerSettings(DEFAULT_CHIMER_SETTINGS)

function changedLeafPaths(before, after, prefix = "") {
  const paths = new Set()
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key
    const left = before?.[key]
    const right = after?.[key]
    if (
      left
      && right
      && typeof left === "object"
      && typeof right === "object"
      && !Array.isArray(left)
      && !Array.isArray(right)
    ) {
      for (const nestedPath of changedLeafPaths(left, right, path)) {
        paths.add(nestedPath)
      }
      continue
    }

    if (JSON.stringify(left) !== JSON.stringify(right)) {
      if (Array.isArray(left) && Array.isArray(right)) {
        const length = Math.max(left.length, right.length)
        for (let index = 0; index < length; index += 1) {
          if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) {
            paths.add(`${path}[${index}]`)
          }
        }
      } else {
        paths.add(path)
      }
    }
  }

  return paths
}

describe("background palette adapter registry", () => {
  it("covers every enabled background exactly once and attaches the authoritative adapter", () => {
    const enabled = backgroundRegistry.filter((entry) => entry.enabled)
    assert.deepEqual(
      Object.keys(backgroundPaletteRegistry).sort(),
      enabled.map((entry) => entry.id).sort(),
    )
    for (const definition of enabled) {
      const adapter = backgroundPaletteRegistry[definition.id]
      assert.ok(adapter, `missing adapter for ${definition.id}`)
      assert.equal(definition.paletteAdapter, adapter)
      assert.equal(VALID_STATUSES.has(adapter.status), true)
    }
  })

  it("records explicit unsupported reasons and complete supported role contracts", () => {
    for (const [backgroundId, adapter] of Object.entries(backgroundPaletteRegistry)) {
      assert.ok(Array.isArray(adapter.visualPropertyKeys), backgroundId)
      assert.deepEqual(
        Object.keys(adapter.sourceVisualProperties),
        [...adapter.visualPropertyKeys],
        backgroundId,
      )

      if (adapter.status === "unsupported") {
        assert.ok(adapter.unsupportedReason.trim().length > 0, backgroundId)
        continue
      }

      assert.equal(VALID_RENDERER_FAMILIES.has(adapter.rendererFamily), true, backgroundId)
      assert.ok(adapter.roles.length > 0, backgroundId)
      assert.equal(new Set(adapter.roles.map((role) => role.id)).size, adapter.roles.length, backgroundId)
      assert.equal(
        new Set(adapter.roles.map((role) => role.rendererTarget)).size,
        adapter.roles.length,
        backgroundId,
      )

      const sourceRoleColors = {}
      const roleColors = {}
      for (const [index, role] of adapter.roles.entries()) {
        assert.ok(role.id.trim().length > 0, backgroundId)
        assert.ok(role.label.trim().length > 0, backgroundId)
        assert.match(role.sourceColor, HEX_COLOR, `${backgroundId}:${role.id}`)
        assert.ok(Number.isInteger(role.defaultSwatch) && role.defaultSwatch >= 0 && role.defaultSwatch <= 6)
        assert.ok(role.rendererTarget.trim().length > 0, backgroundId)
        sourceRoleColors[role.id] = role.sourceColor
        roleColors[role.id] = `#${(index + 1).toString(16).padStart(6, "0")}`
      }

      const before = adapter.applyRoleColors({}, sourceRoleColors)
      const after = adapter.applyRoleColors(before, roleColors)
      assert.deepEqual(
        [...changedLeafPaths(before, after)].sort(),
        adapter.roles.map((role) => role.rendererTarget).sort(),
        backgroundId,
      )
    }
  })

  it("copies every declared source visual property from sanitized Chimer defaults", () => {
    for (const [backgroundId, adapter] of Object.entries(backgroundPaletteRegistry)) {
      assert.deepEqual(
        adapter.sourceVisualProperties,
        Object.fromEntries(
          adapter.visualPropertyKeys.map((key) => [key, sanitizedDefaults[key]]),
        ),
        backgroundId,
      )
    }
  })

  it("keeps collision-prone renderer visual inventories independently exact", () => {
    const expectedKeysByBackground = {
      "massage-lab-plasma": [
        "massageLabPlasmaSpeed",
        "massageLabPlasmaDirection",
        "massageLabPlasmaScale",
        "massageLabPlasmaOpacity",
        "massageLabPlasmaMouseInteractive",
      ],
      "massage-lab-gradient": [
        "massageLabGradientOpacity",
      ],
      "massage-lab-prism": [
        "massageLabPrismHeight",
        "massageLabPrismBaseWidth",
        "massageLabPrismAnimationType",
        "massageLabPrismGlow",
        "massageLabPrismOffsetX",
        "massageLabPrismOffsetY",
        "massageLabPrismNoise",
        "massageLabPrismTransparent",
        "massageLabPrismScale",
        "massageLabPrismHueShift",
        "massageLabPrismColorFrequency",
        "massageLabPrismHoverStrength",
        "massageLabPrismInertia",
        "massageLabPrismBloom",
        "massageLabPrismTimeScale",
      ],
    }

    for (const [backgroundId, expectedKeys] of Object.entries(expectedKeysByBackground)) {
      const adapter = backgroundPaletteRegistry[backgroundId]
      assert.deepEqual(adapter.visualPropertyKeys, expectedKeys, backgroundId)
      assert.deepEqual(
        adapter.sourceVisualProperties,
        Object.fromEntries(expectedKeys.map((key) => [key, sanitizedDefaults[key]])),
        backgroundId,
      )
    }
  })

  it("models Vortex background and hue-driven particle colors as exact roles", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-vortex"]
    assert.notEqual(adapter.status, "unsupported")
    assert.deepEqual(
      adapter.roles.map(({ id, label, sourceColor, defaultSwatch, rendererTarget }) => ({
        id,
        label,
        sourceColor,
        defaultSwatch,
        rendererTarget,
      })),
      [
        {
          id: "background",
          label: "Background",
          sourceColor: "#000000",
          defaultSwatch: 0,
          rendererTarget: "vortex.backgroundColor",
        },
        {
          id: "particles",
          label: "Particles",
          sourceColor: "#3377FF",
          defaultSwatch: 1,
          rendererTarget: "vortex.baseHue",
        },
      ],
    )
    assert.equal(adapter.visualPropertyKeys.includes("vortexBaseHue"), false)

    const before = {
      vortex: {
        backgroundColor: "#000000",
        baseHue: 220,
        particleCount: sanitizedDefaults.vortexParticleCount,
      },
    }
    const after = adapter.applyRoleColors(before, {
      background: "#112233",
      particles: "#336699",
    })
    assert.equal(after.vortex.backgroundColor, "#112233")
    assert.equal(after.vortex.baseHue, 210)
    assert.equal(after.vortex.particleCount, before.vortex.particleCount)
    assert.deepEqual(
      [...changedLeafPaths(before, after)].sort(),
      ["vortex.backgroundColor", "vortex.baseHue"],
    )
  })

  it("round-trips Vortex's declared particle source color to its sanitized source hue", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-vortex"]
    assert.notEqual(adapter.status, "unsupported")
    const particleRole = adapter.roles.find((role) => role.id === "particles")
    assert.ok(particleRole)

    const applied = adapter.applyRoleColors(
      { vortex: { baseHue: 0 } },
      { particles: particleRole.sourceColor },
    )
    assert.equal(applied.vortex.baseHue, sanitizedDefaults.vortexBaseHue)
  })

  it("records the approved exhaustive and special Source behaviors", () => {
    assert.equal(
      backgroundPaletteRegistry["massage-lab-gradient-animation"].roles.length,
      7,
    )
    assert.equal(
      backgroundPaletteRegistry["massage-lab-ripple-grid"].sourceBehavior,
      "rainbow",
    )
    assert.equal(
      backgroundPaletteRegistry["massage-lab-aurora-bars"].sourceBehavior,
      "automatic",
    )
    assert.equal(
      backgroundPaletteRegistry["massage-lab-tile-grid"].sourceBehavior,
      "automatic",
    )
  })
})
