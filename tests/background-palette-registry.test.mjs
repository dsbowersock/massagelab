import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_CHIMER_SETTINGS, sanitizeChimerSettings } from "../lib/chimer-timer.js"
import {
  backgroundPaletteRegistry,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"
import {
  backgroundRegistry,
} from "../components/backgrounds/backgroundRegistry.ts"
import {
  resolveBackgroundEffectProps,
} from "../components/backgrounds/resolveBackgroundEffectProps.ts"
import {
  generateBackgroundHarmonySwatches,
  resolveBackgroundRoleColors,
} from "../lib/background-palette.js"

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const VALID_STATUSES = new Set(["pending", "supported", "unsupported"])
const VALID_RENDERER_FAMILIES = new Set(["css-dom", "canvas", "webgl"])
const sanitizedDefaults = sanitizeChimerSettings(DEFAULT_CHIMER_SETTINGS)
const CUSTOM_SWATCHES = [
  "#110011",
  "#220022",
  "#330033",
  "#440044",
  "#550055",
  "#660066",
  "#770077",
]
const HARMONY_PRIMARY = "#2A6F97"

const cssDomFixtures = {
  "massage-lab-moving-gradient": {
    className: "moving-gradient-fixture",
    mainColor: "#010101",
    orbColor: "#020202",
  },
  "massage-lab-aerial-rays": {
    massageLabAerialRays: {
      backgroundColor: "#010101",
      color: "#020202",
      count: 11,
      blur: 27,
      speed: 9,
      length: 83,
      opacity: 0.42,
    },
  },
  "massage-lab-grid-motion": {
    massageLabGridMotion: {
      gradientColor: "#010101",
      tileColor: "#020202",
      textColor: "#030303",
      maxMoveAmount: 211,
      baseDuration: 1.3,
      cursorInteraction: false,
    },
  },
  "massage-lab-gradient-animation": {
    gradientAnimation: {
      backgroundStartColor: "#010101",
      backgroundEndColor: "#020202",
      firstColor: "#030303",
      secondColor: "#040404",
      thirdColor: "#050505",
      fourthColor: "#060606",
      fifthColor: "#070707",
      speed: 1.7,
      size: 63,
    },
  },
  "massage-lab-shooting-stars": {
    shootingStars: {
      starColor: "#010101",
      trailColor: "#020202",
      shootingStarColor: "#030303",
      starDensity: 0.00023,
      twinkle: false,
      twinkleSpeed: 1.4,
      shootingStarSpeed: 1.6,
      shootingStarFrequency: 0.8,
    },
  },
  "massage-lab-spotlight": {
    spotlight: {
      color: "#010101",
      opacity: 0.54,
      width: 711,
      height: 1203,
      smallWidth: 331,
      translateY: -217,
      duration: 5.4,
      xOffset: 43,
    },
  },
  "massage-lab-lamp-effect": {
    lamp: {
      backgroundColor: "#010101",
      color: "#020202",
      glowOpacity: 0.33,
      beamWidth: 241,
      glowWidth: 397,
      verticalOffset: 37,
      pulseSpeed: 4.2,
    },
  },
  "massage-lab-aurora-bars": {
    auroraBars: {
      paletteMode: "auto",
      primaryColor: "#ABCDEF",
      colors: ["#010101", "#020202", "#030303", "#040404", "#050505"],
      barCount: 31,
      maxHeightRatio: 0.84,
      minHeightRatio: 0.22,
      speed: 0.73,
      gap: 5,
      blur: 4,
      background: "#060606",
      visualizerActive: true,
      audioLevel: 0.61,
    },
  },
  "massage-lab-gradient": {
    massageLabGradient: {
      primaryColor: "#010101",
      harmony: "compound",
      opacity: 0.57,
    },
  },
  "massage-lab-stars": {
    massageLabStars: {
      starColor: "#010101",
      speed: 37,
      density: 0.72,
      factor: 0.014,
    },
  },
}

function roleColorsForMode(adapter, mode) {
  const palette = {
    mode,
    primaryColor: mode === "custom" ? CUSTOM_SWATCHES[0] : HARMONY_PRIMARY,
    harmony: "triadic",
    swatches: CUSTOM_SWATCHES,
  }
  return resolveBackgroundRoleColors({
    palette,
    adapter,
    mapping: {},
    canCustomize: true,
  })
}

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

function fixtureForAdapter(adapter) {
  const fixture = {
    rendererLifecycle: {
      frame: 42,
      mounted: true,
    },
  }

  for (const role of adapter.roles) {
    const segments = [...role.rendererTarget.matchAll(/([^[.\]]+)|\[(\d+)\]/g)]
      .map((match) => match[2] === undefined ? match[1] : Number(match[2]))
    let cursor = fixture
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]
      const nextSegment = segments[index + 1]
      cursor[segment] ??= typeof nextSegment === "number" ? [] : {}
      cursor = cursor[segment]
    }
    cursor[segments.at(-1)] = "fixture-color"
  }

  return fixture
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

  it("completes every CSS/DOM adapter and changes only named renderer targets in every palette mode", () => {
    const cssDomEntries = Object.entries(backgroundPaletteRegistry).filter(([, adapter]) => (
      adapter.status !== "unsupported" && adapter.rendererFamily === "css-dom"
    ))
    assert.deepEqual(
      cssDomEntries.map(([backgroundId]) => backgroundId).sort(),
      Object.keys(cssDomFixtures).sort(),
    )

    for (const [backgroundId, adapter] of cssDomEntries) {
      assert.equal(adapter.status, "supported", backgroundId)
      const fixture = cssDomFixtures[backgroundId]
      const sourceBehavior = adapter.sourceBehavior

      for (const mode of ["source", "custom", "harmony"]) {
        const after = adapter.applyRoleColors(fixture, roleColorsForMode(adapter, mode))
        assert.deepEqual(
          [...changedLeafPaths(fixture, after)].sort(),
          adapter.roles.map((role) => role.rendererTarget).sort(),
          `${backgroundId}:${mode}`,
        )
        assert.deepEqual(fixture, cssDomFixtures[backgroundId], `${backgroundId}:${mode}:mutation`)
        assert.equal(adapter.sourceBehavior, sourceBehavior, `${backgroundId}:${mode}:source-behavior`)
      }
    }
  })

  it("completes every Canvas/WebGL adapter immutably in every palette mode", () => {
    const entries = Object.entries(backgroundPaletteRegistry).filter(([, adapter]) => (
      adapter.status !== "unsupported"
      && (adapter.rendererFamily === "canvas" || adapter.rendererFamily === "webgl")
    ))
    assert.ok(entries.length > 0)

    for (const [backgroundId, adapter] of entries) {
      assert.equal(adapter.status, "supported", backgroundId)
      const fixture = fixtureForAdapter(adapter)
      const original = structuredClone(fixture)

      for (const mode of ["source", "custom", "harmony"]) {
        const roleColors = roleColorsForMode(adapter, mode)
        assert.deepEqual(Object.keys(roleColors).sort(), adapter.roles.map((role) => role.id).sort())
        for (const color of Object.values(roleColors)) {
          assert.match(color, HEX_COLOR, `${backgroundId}:${mode}`)
        }

        const resolved = adapter.applyRoleColors(fixture, roleColors)
        assert.notEqual(resolved, fixture, `${backgroundId}:${mode}:identity`)
        assert.deepEqual(
          [...changedLeafPaths(fixture, resolved)].sort(),
          adapter.roles.map((role) => role.rendererTarget).sort(),
          `${backgroundId}:${mode}:targets`,
        )
        assert.deepEqual(
          resolved.rendererLifecycle,
          fixture.rendererLifecycle,
          `${backgroundId}:${mode}:lifecycle`,
        )
        assert.deepEqual(fixture, original, `${backgroundId}:${mode}:mutation`)
      }
    }
  })

  it("leaves no enabled adapter pending", () => {
    for (const definition of backgroundRegistry.filter((entry) => entry.enabled)) {
      assert.notEqual(
        backgroundPaletteRegistry[definition.id].status,
        "pending",
        definition.id,
      )
    }
  })

  it("resolves staged effect props through the selected adapter and saved mapping", () => {
    const effectProps = {
      massageLabRetroGrid: {
        backgroundColor: "#010101",
        lightLineColor: "#020202",
        darkLineColor: "#030303",
        opacity: 0.63,
        speed: 1.7,
      },
    }
    const palette = {
      mode: "custom",
      primaryColor: CUSTOM_SWATCHES[0],
      harmony: "triadic",
      swatches: CUSTOM_SWATCHES,
    }
    const mapping = {
      background: 6,
      "light-lines": 5,
      "dark-lines": 4,
    }
    const resolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-retro-grid",
      effectProps,
      palette,
      mapping,
      canCustomize: true,
    })

    assert.deepEqual(resolved, {
      massageLabRetroGrid: {
        backgroundColor: CUSTOM_SWATCHES[6],
        lightLineColor: CUSTOM_SWATCHES[5],
        darkLineColor: CUSTOM_SWATCHES[4],
        opacity: 0.63,
        speed: 1.7,
      },
    })
    assert.deepEqual(effectProps.massageLabRetroGrid, {
      backgroundColor: "#010101",
      lightLineColor: "#020202",
      darkLineColor: "#030303",
      opacity: 0.63,
      speed: 1.7,
    })
  })

  it("falls back to source colors when customization access is unavailable", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-retro-grid"]
    const effectProps = fixtureForAdapter(adapter)
    const resolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-retro-grid",
      effectProps,
      palette: {
        mode: "custom",
        primaryColor: CUSTOM_SWATCHES[0],
        harmony: "triadic",
        swatches: CUSTOM_SWATCHES,
      },
      mapping: {
        background: 6,
        "light-lines": 5,
        "dark-lines": 4,
      },
      canCustomize: false,
    })
    const expected = adapter.applyRoleColors(
      effectProps,
      Object.fromEntries(adapter.roles.map((role) => [role.id, role.sourceColor])),
    )

    assert.deepEqual(resolved, expected)
    assert.deepEqual(effectProps, fixtureForAdapter(adapter))
  })

  it("returns original props for unsupported or unknown backgrounds without tinting", () => {
    const effectProps = {
      className: "fixed-media",
      media: {
        src: "/backgrounds/source.mp4",
        opacity: 0.8,
      },
    }
    const input = {
      effectProps,
      palette: {
        mode: "custom",
        primaryColor: CUSTOM_SWATCHES[0],
        harmony: "triadic",
        swatches: CUSTOM_SWATCHES,
      },
      mapping: {},
      canCustomize: true,
    }

    assert.equal(
      resolveBackgroundEffectProps({ ...input, selectedId: "static-gradient" }),
      effectProps,
    )
    assert.equal(
      resolveBackgroundEffectProps({ ...input, selectedId: "not-a-background" }),
      effectProps,
    )
    assert.deepEqual(effectProps, {
      className: "fixed-media",
      media: {
        src: "/backgrounds/source.mp4",
        opacity: 0.8,
      },
    })
  })

  it("maps Moving Gradient and all seven Gradient Animation roles exactly", () => {
    const movingAdapter = backgroundPaletteRegistry["massage-lab-moving-gradient"]
    const moving = movingAdapter.applyRoleColors(
      cssDomFixtures["massage-lab-moving-gradient"],
      roleColorsForMode(movingAdapter, "custom"),
    )
    assert.deepEqual(moving, {
      className: "moving-gradient-fixture",
      mainColor: CUSTOM_SWATCHES[0],
      orbColor: CUSTOM_SWATCHES[1],
    })

    const gradientAdapter = backgroundPaletteRegistry["massage-lab-gradient-animation"]
    const gradient = gradientAdapter.applyRoleColors(
      cssDomFixtures["massage-lab-gradient-animation"],
      roleColorsForMode(gradientAdapter, "custom"),
    )
    assert.deepEqual(gradient.gradientAnimation, {
      backgroundStartColor: CUSTOM_SWATCHES[0],
      backgroundEndColor: CUSTOM_SWATCHES[1],
      firstColor: CUSTOM_SWATCHES[2],
      secondColor: CUSTOM_SWATCHES[3],
      thirdColor: CUSTOM_SWATCHES[4],
      fourthColor: CUSTOM_SWATCHES[5],
      fifthColor: CUSTOM_SWATCHES[6],
      speed: 1.7,
      size: 63,
    })
  })

  it("preserves Ripple Grid rainbow and Aurora Bars/Tile Grid automatic Source controls", () => {
    const rippleAdapter = backgroundPaletteRegistry["massage-lab-ripple-grid"]
    const rippleFixture = {
      massageLabRippleGrid: {
        gridColor: "#010101",
        enableRainbow: true,
        rippleIntensity: 0.17,
        gridSize: 17,
        opacity: 0.63,
        mouseInteraction: false,
      },
    }
    const rippleSource = rippleAdapter.applyRoleColors(
      rippleFixture,
      roleColorsForMode(rippleAdapter, "source"),
    )
    const rippleCustom = rippleAdapter.applyRoleColors(
      rippleFixture,
      roleColorsForMode(rippleAdapter, "custom"),
    )
    const rippleHarmony = rippleAdapter.applyRoleColors(
      rippleFixture,
      roleColorsForMode(rippleAdapter, "harmony"),
    )
    assert.equal(rippleAdapter.sourceBehavior, "rainbow")
    assert.deepEqual(
      [...changedLeafPaths(rippleFixture, rippleSource)],
      ["massageLabRippleGrid.gridColor"],
    )
    assert.equal(
      rippleSource.massageLabRippleGrid.gridColor,
      roleColorsForMode(rippleAdapter, "source").grid,
    )
    assert.equal(rippleSource.massageLabRippleGrid.enableRainbow, true)
    assert.equal(rippleSource.massageLabRippleGrid.rippleIntensity, 0.17)
    assert.equal(rippleSource.massageLabRippleGrid.gridSize, 17)
    assert.equal(rippleSource.massageLabRippleGrid.opacity, 0.63)
    assert.equal(rippleSource.massageLabRippleGrid.mouseInteraction, false)
    assert.equal(rippleCustom.massageLabRippleGrid.gridColor, CUSTOM_SWATCHES[0])
    assert.equal(
      rippleHarmony.massageLabRippleGrid.gridColor,
      generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")[0],
    )

    const auroraAdapter = backgroundPaletteRegistry["massage-lab-aurora-bars"]
    const auroraFixture = cssDomFixtures["massage-lab-aurora-bars"]
    const auroraSource = auroraAdapter.applyRoleColors(
      auroraFixture,
      roleColorsForMode(auroraAdapter, "source"),
    )
    const auroraCustom = auroraAdapter.applyRoleColors(
      auroraFixture,
      roleColorsForMode(auroraAdapter, "custom"),
    )
    assert.equal(auroraAdapter.sourceBehavior, "automatic")
    assert.equal(auroraSource.auroraBars.paletteMode, "auto")
    assert.equal(auroraSource.auroraBars.primaryColor, "#ABCDEF")
    assert.equal(
      auroraSource.auroraBars.background,
      roleColorsForMode(auroraAdapter, "source").background,
    )
    assert.deepEqual(
      auroraSource.auroraBars.colors,
      auroraAdapter.roles.slice(1).map((role) => (
        roleColorsForMode(auroraAdapter, "source")[role.id]
      )),
    )
    assert.equal(auroraCustom.auroraBars.paletteMode, "auto")
    assert.equal(auroraCustom.auroraBars.background, CUSTOM_SWATCHES[0])
    assert.deepEqual(auroraCustom.auroraBars.colors, CUSTOM_SWATCHES.slice(1, 6))

    const tileAdapter = backgroundPaletteRegistry["massage-lab-tile-grid"]
    const tileFixture = {
      tileGrid: {
        paletteMode: "auto",
        primaryColor: "#ABCDEF",
        colors: ["#010101", "#020202", "#030303", "#040404", "#050505"],
        tileSize: 43,
        jointSize: 3,
        changeFrequency: 0.42,
        activePercent: 0.31,
        opacity: 0.77,
      },
    }
    const tileSource = tileAdapter.applyRoleColors(
      tileFixture,
      roleColorsForMode(tileAdapter, "source"),
    )
    const tileCustom = tileAdapter.applyRoleColors(
      tileFixture,
      roleColorsForMode(tileAdapter, "custom"),
    )
    const harmonyColors = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    const tileHarmony = tileAdapter.applyRoleColors(
      tileFixture,
      roleColorsForMode(tileAdapter, "harmony"),
    )
    assert.equal(tileAdapter.sourceBehavior, "automatic")
    assert.equal(tileSource.tileGrid.paletteMode, "auto")
    assert.equal(tileSource.tileGrid.primaryColor, "#ABCDEF")
    assert.deepEqual(
      tileSource.tileGrid.colors,
      tileAdapter.roles.map((role) => roleColorsForMode(tileAdapter, "source")[role.id]),
    )
    assert.deepEqual(tileCustom.tileGrid.colors, CUSTOM_SWATCHES.slice(0, 5))
    assert.equal(tileHarmony.tileGrid.paletteMode, "auto")
    assert.deepEqual(tileHarmony.tileGrid.colors, harmonyColors.slice(0, 5))
    assert.equal(tileHarmony.tileGrid.tileSize, 43)
    assert.equal(tileHarmony.tileGrid.changeFrequency, 0.42)
    assert.equal(tileHarmony.tileGrid.opacity, 0.77)
  })
})
