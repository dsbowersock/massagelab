import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  DEFAULT_CHIMER_SETTINGS,
  sanitizeChimerSettings,
} from "../lib/chimer-timer.js"
import {
  BACKGROUND_PALETTE_METADATA_SUFFIXES,
  DNA_SOURCE_NODE_ROLE_COLORS,
  TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS,
  applyCssDomPaletteRoleColors,
  backgroundPaletteRegistry,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"
import {
  backgroundRegistry,
} from "../components/backgrounds/backgroundRegistry.ts"
import {
  resolveBackgroundFallbackStyle,
  resolveBackgroundEffectProps,
} from "../components/backgrounds/resolveBackgroundEffectProps.ts"
import {
  parseBackgroundRendererPath,
  readBackgroundRendererTarget,
} from "../components/backgrounds/backgroundRendererPaths.ts"
import {
  generateBackgroundHarmonySwatches,
  resolveBackgroundRoleColors,
} from "../lib/background-palette.js"

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const CSS_COLOR = /^(?:#[0-9a-f]{6}|hsl\([\d.]+ [\d.]+% [\d.]+%\))$/i
const VALID_STATUSES = new Set(["supported", "unsupported"])
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
const SWATCH_SEVEN_BACKGROUND_IDS = [
  "massage-lab-retro-grid",
  "massage-lab-aerial-rays",
  "massage-lab-wave-current",
  "massage-lab-photon-beam",
  "massage-lab-reveal-dots",
  "massage-lab-3d-globe",
  "massage-lab-lamp-effect",
  "massage-lab-wavy-background",
  "massage-lab-pixel-liquid",
  "massage-lab-aurora-bars",
]

const cssDomFixtures = {
  "solid-color": {
    solidColor: "#010101",
  },
  "static-gradient": {
    staticGradient: {
      type: "linear",
      colorCount: 7,
      angle: 145,
      centerX: 50,
      centerY: 50,
      radialShape: "ellipse",
      radialSize: "farthest-corner",
      stopPositions: [0, 17, 33, 50, 67, 83, 100],
      colors: ["#010101", "#020202", "#030303", "#040404", "#050505", "#060606", "#070707"],
    },
  },
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
  "massage-lab-aurora": {
    massageLabAurora: {
      backgroundColor: "#010101",
      colors: ["#020202", "#030303", "#040404", "#050505", "#060606"],
      speed: 1.4,
      intensity: 0.64,
      blur: 17,
      reach: 82,
    },
  },
  "massage-lab-bubble": {
    massageLabBubble: {
      paletteMode: "source",
      backgroundColor: "#010101",
      colors: ["#020202", "#030303", "#040404", "#050505", "#060606"],
      speed: 1.4,
      intensity: 0.64,
      size: 1.3,
      blur: 27,
      blendStrength: 22,
    },
  },
  "massage-lab-background-beams": {
    massageLabBackgroundBeams: {
      paletteMode: "source",
      backgroundColor: "#010101",
      colors: ["#020202", "#030303", "#040404"],
      speed: 1.4,
      intensity: 0.64,
      beamWidth: 0.9,
      glowStrength: 7,
    },
  },
  "massage-lab-collision-beams": {
    massageLabCollisionBeams: {
      paletteMode: "source",
      backgroundColor: "#010101",
      beamColor: "#020202",
      accentColor: "#030303",
      particleColor: "#040404",
      surfaceColor: "#050505",
      speed: 1.4,
      intensity: 0.64,
      beamWidth: 1.5,
      burstSize: 1.2,
    },
  },
  "massage-lab-glowing-stars": {
    massageLabGlowingStars: {
      paletteMode: "source",
      backgroundColor: "#010101",
      starColor: "#020202",
      peakColor: "#030303",
      afterglowColor: "#040404",
      glowCoreColor: "#050505",
      glowAuraColor: "#060606",
      speed: 1.4,
      intensity: 0.64,
      activeStars: 9,
      starSize: 1.5,
      glowStrength: 1.2,
    },
  },
  "massage-lab-meteors": {
    massageLabMeteors: {
      paletteMode: "source",
      backgroundColor: "#010101",
      meteorColor: "#020202",
      tailColor: "#030303",
      glowColor: "#040404",
      edgeColor: "#050505",
      speed: 1.4,
      intensity: 0.64,
      count: 19,
      size: 2.5,
      tailLength: 72,
    },
  },
  "massage-lab-background-lines": {
    backgroundLines: {
      paletteMode: "source",
      backgroundColor: "#010101",
      colors: ["#020202", "#030303", "#040404", "#050505", "#060606", "#070707"],
      duration: 14,
      intensity: 0.74,
      count: 18,
      lineWidth: 3.2,
      glowStrength: 13,
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
  "massage-lab-dna": {
    massageLabDna: {
      strandCount: 70,
      showBaseLetters: false,
      nodeMotionSpeed: 0.06,
      strandRotationEnabled: true,
      strandRotationSpeed: 0.02,
      strandRotationDirection: "clockwise",
      strandAngle: 30,
      scale: 0.5,
      positionX: 0,
      positionY: 0,
      strandSpacing: 0.5,
      nodeSize: 100,
      connectorWidth: 94,
      connectorThickness: 15,
      outlineThickness: 0.1,
      backgroundColor: "#010101",
      nodeRoleColors: ["#020202", "#030303", "#040404", "#050505"],
      connectorColor: "#060606",
      outlineColor: "#070707",
    },
  },
  "massage-lab-twisted-cubes": {
    massageLabTwistedCubes: {
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
      paletteMode: "source",
      backgroundColor: "#010101",
      outlineAnchors: ["#020202", "#030303", "#040404", "#050505", "#060606", "#070707"],
    },
  },
}

function roleColorsForMode(adapter, mode) {
  const palette = paletteForMode(mode)
  return resolveBackgroundRoleColors({
    palette,
    adapter,
    mapping: {},
    canCustomize: true,
  })
}

function paletteForMode(mode) {
  return {
    mode,
    primaryColor: mode === "custom" ? CUSTOM_SWATCHES[0] : HARMONY_PRIMARY,
    harmony: "triadic",
    swatches: CUSTOM_SWATCHES,
  }
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
  it("shares one parser and reader for dotted and indexed renderer paths", () => {
    const props = {
      renderer: {
        colors: ["#111111", "#222222"],
      },
    }

    assert.deepEqual(
      parseBackgroundRendererPath("renderer.colors[1]"),
      ["renderer", "colors", 1],
    )
    assert.equal(
      readBackgroundRendererTarget(props, "renderer.colors[1]"),
      "#222222",
    )
    assert.equal(
      readBackgroundRendererTarget(props, "renderer.missing.value"),
      undefined,
    )
  })

  it("publishes only final adapters and keeps legacy renderer colors out of persisted settings", () => {
    const legacyColorKeys = new Set(
      Object.values(backgroundPaletteRegistry).flatMap((adapter) => (
        adapter.status === "supported"
          ? adapter.roles.map((role) => role.sourceSettingKey)
          : []
      )),
    )

    for (const [backgroundId, adapter] of Object.entries(backgroundPaletteRegistry)) {
      assert.equal(
        VALID_STATUSES.has(adapter.status),
        true,
        `${backgroundId} has non-final status ${adapter.status}`,
      )
    }

    for (const key of legacyColorKeys) {
      assert.equal(key in DEFAULT_CHIMER_SETTINGS, false, `${key} remains in defaults`)
      assert.equal(key in sanitizedDefaults, false, `${key} remains in sanitized settings`)
    }
    for (const key of Object.keys(DEFAULT_CHIMER_SETTINGS)) {
      assert.equal(
        BACKGROUND_PALETTE_METADATA_SUFFIXES.some((suffix) => key.endsWith(suffix)),
        false,
        `${key} remains as per-background palette metadata`,
      )
    }
  })

  it("owns the complete legacy palette metadata suffix inventory", () => {
    assert.deepEqual(BACKGROUND_PALETTE_METADATA_SUFFIXES, [
      "PaletteMode",
      "PrimaryColor",
      "Harmony",
    ])
    assert.equal(BACKGROUND_PALETTE_METADATA_SUFFIXES.includes("ControlVersion"), false)
    assert.equal(BACKGROUND_PALETTE_METADATA_SUFFIXES.includes("WarpSpeedVersion"), false)
    for (const key of [
      "massageLabShapeGridPaletteMode",
      "massageLabShapeGridPrimaryColor",
      "massageLabShapeGridHarmony",
      "massageLabPhotonBeamPaletteMode",
      "massageLabPhotonBeamPrimaryColor",
      "massageLabPhotonBeamHarmony",
    ]) {
      assert.equal(
        BACKGROUND_PALETTE_METADATA_SUFFIXES.some((suffix) => key.endsWith(suffix)),
        true,
        key,
      )
    }
  })

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
        assert.equal(VALID_RENDERER_FAMILIES.has(adapter.rendererFamily), true, backgroundId)
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
        assert.ok(role.sourceSettingKey.trim().length > 0, backgroundId)
        assert.equal(
          adapter.visualPropertyKeys.includes(role.sourceSettingKey),
          false,
          `${backgroundId}:${role.sourceSettingKey}`,
        )
        const sourceColorPattern = adapter.rendererFamily === "css-dom" ? CSS_COLOR : HEX_COLOR
        assert.match(role.sourceColor, sourceColorPattern, `${backgroundId}:${role.id}`)
        assert.equal(
          role.sourceColorFormat,
          HEX_COLOR.test(role.sourceColor) ? "hex" : "css",
          `${backgroundId}:${role.id}`,
        )
        assert.ok(Number.isInteger(role.defaultSwatch) && role.defaultSwatch >= 0 && role.defaultSwatch <= 6)
        assert.ok(role.rendererTarget.trim().length > 0, backgroundId)
        sourceRoleColors[role.id] = role.sourceColor
        roleColors[role.id] = `#${(index + 1).toString(16).padStart(6, "0")}`
      }

      const before = adapter.applyRoleColors(fixtureForAdapter(adapter), sourceRoleColors)
      const after = adapter.applyRoleColors(before, roleColors)
      assert.deepEqual(
        [...changedLeafPaths(before, after)].sort(),
        adapter.roles.map((role) => role.rendererTarget).sort(),
        backgroundId,
      )
    }
  })

  it("keeps every literal Background role out of Swatch 1", () => {
    const swatchOneBackgrounds = Object.entries(backgroundPaletteRegistry)
      .flatMap(([backgroundId, adapter]) => (
        adapter.status === "supported"
          ? adapter.roles
            .filter((role) => role.label === "Background" && role.defaultSwatch === 0)
            .map(() => backgroundId)
          : []
      ))

    assert.deepEqual(swatchOneBackgrounds, [])
  })

  it("keeps Solid Color to one truthful custom swatch without Harmony", () => {
    const adapter = backgroundPaletteRegistry["solid-color"]
    assert.equal(adapter.status, "supported")
    assert.equal(adapter.supportsHarmony, false)
    assert.deepEqual(adapter.visualPropertyKeys, [])
    assert.deepEqual(
      adapter.roles.map((role) => ({
        id: role.id,
        label: role.label,
        sourceColor: role.sourceColor,
        defaultSwatch: role.defaultSwatch,
        rendererTarget: role.rendererTarget,
      })),
      [{
        id: "color",
        label: "Color",
        sourceColor: "#FF7A1A",
        defaultSwatch: 0,
        rendererTarget: "solidColor",
      }],
    )

    const sourceResolved = resolveBackgroundEffectProps({
      selectedId: "solid-color",
      effectProps: { solidColor: "#010101" },
      palette: paletteForMode("source"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(sourceResolved.solidColor.toLowerCase(), "#ff7a1a")

    const customResolved = resolveBackgroundEffectProps({
      selectedId: "solid-color",
      effectProps: { solidColor: "#010101" },
      palette: paletteForMode("custom"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(customResolved.solidColor, CUSTOM_SWATCHES[0])

    const harmonyResolved = resolveBackgroundEffectProps({
      selectedId: "solid-color",
      effectProps: { solidColor: "#010101" },
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(harmonyResolved.solidColor.toLowerCase(), "#ff7a1a")
  })

  it("keeps audited Swatch 7 backgrounds independent from Harmony", () => {
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")

    for (const backgroundId of SWATCH_SEVEN_BACKGROUND_IDS) {
      const adapter = backgroundPaletteRegistry[backgroundId]
      assert.equal(adapter.status, "supported", backgroundId)
      const backgroundRole = adapter.roles.find((role) => role.label === "Background")
      const visualRoles = adapter.roles.filter((role) => role !== backgroundRole)

      assert.ok(backgroundRole, backgroundId)
      assert.equal(backgroundRole.defaultSwatch, 6, backgroundId)
      assert.equal(backgroundRole.harmonyColorSource, "saved-swatch", backgroundId)
      assert.deepEqual(
        visualRoles.map((role) => role.defaultSwatch),
        visualRoles.map((_, index) => index),
        backgroundId,
      )

      const sourceColors = roleColorsForMode(adapter, "source")
      const customColors = roleColorsForMode(adapter, "custom")
      const harmonyColors = roleColorsForMode(adapter, "harmony")
      assert.equal(
        sourceColors.background.toLowerCase(),
        backgroundRole.sourceColor.toLowerCase(),
        backgroundId,
      )
      assert.equal(customColors.background, CUSTOM_SWATCHES[6], backgroundId)
      assert.equal(harmonyColors.background, CUSTOM_SWATCHES[6], backgroundId)
      for (const [index, visualRole] of visualRoles.entries()) {
        assert.equal(customColors[visualRole.id], CUSTOM_SWATCHES[index], `${backgroundId}:${visualRole.id}`)
        assert.equal(harmonyColors[visualRole.id], harmonySwatches[index], `${backgroundId}:${visualRole.id}`)
      }
    }
  })

  it("grounds unsupported renderer families in their actual implementations", async () => {
    const cssBackgroundSource = await readFile(
      new URL("../components/backgrounds/effects/css-backgrounds.tsx", import.meta.url),
      "utf8",
    )
    const dottedGlowStart = cssBackgroundSource.indexOf(
      "export function MassageLabDottedGlowBackground",
    )
    const dottedGlowEnd = cssBackgroundSource.indexOf(
      "\nexport function ",
      dottedGlowStart + 1,
    )
    const dottedGlowImplementation = cssBackgroundSource.slice(
      dottedGlowStart,
      dottedGlowEnd > dottedGlowStart ? dottedGlowEnd : undefined,
    )

    assert.notEqual(dottedGlowStart, -1)
    assert.match(dottedGlowImplementation, /getContext\("2d"\)/)
    assert.match(dottedGlowImplementation, /<canvas/)
    assert.equal(
      backgroundPaletteRegistry["massage-lab-dotted-glow"].rendererFamily,
      "canvas",
    )
    assert.equal(backgroundPaletteRegistry["static-gradient"].rendererFamily, "css-dom")
    assert.equal(backgroundPaletteRegistry["massage-lab-aurora"].rendererFamily, "css-dom")
    assert.equal(backgroundPaletteRegistry["massage-lab-prism"].rendererFamily, "webgl")
    assert.equal(backgroundPaletteRegistry["massage-lab-dark-veil"].rendererFamily, "webgl")
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

  it("models Vortex with an independent Swatch 7 background and procedural particle hue", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-vortex"]
    assert.notEqual(adapter.status, "unsupported")
    assert.equal(adapter.supportsHarmony, false)
    assert.deepEqual(
      adapter.roles.map(({ id, label, sourceColor, defaultSwatch, harmonyColorSource, rendererTarget }) => ({
        id,
        label,
        sourceColor,
        defaultSwatch,
        harmonyColorSource,
        rendererTarget,
      })),
      [
        {
          id: "background",
          label: "Background",
          sourceColor: "#000000",
          defaultSwatch: 6,
          harmonyColorSource: "saved-swatch",
          rendererTarget: "vortex.backgroundColor",
        },
      ],
    )
    assert.equal(adapter.visualPropertyKeys.includes("vortexBaseHue"), true)

    const before = {
      vortex: {
        backgroundColor: "#000000",
        baseHue: 300,
        particleCount: sanitizedDefaults.vortexParticleCount,
      },
    }
    const after = adapter.applyRoleColors(before, {
      background: "#112233",
    }, "custom")
    assert.equal(after.vortex.backgroundColor, "#112233")
    assert.equal(after.vortex.baseHue, 300)
    assert.equal(after.vortex.particleCount, before.vortex.particleCount)
    assert.deepEqual([...changedLeafPaths(before, after)], ["vortex.backgroundColor"])
  })

  it("keeps Vortex's authored hue range and rejects stale Harmony rendering", () => {
    const effectProps = {
      vortex: {
        backgroundColor: "#000000",
        baseHue: 300,
        particleCount: 420,
        rangeY: 120,
      },
    }
    const sourceResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-vortex",
      effectProps,
      palette: paletteForMode("source"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(sourceResolved.vortex.baseHue, 220)

    const customResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-vortex",
      effectProps,
      palette: paletteForMode("custom"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(customResolved.vortex.backgroundColor, CUSTOM_SWATCHES[6])
    assert.equal(customResolved.vortex.baseHue, 300)

    const staleHarmonyResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-vortex",
      effectProps,
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(staleHarmonyResolved.vortex.backgroundColor, "#000000")
    assert.equal(staleHarmonyResolved.vortex.baseHue, 220)
    assert.equal(staleHarmonyResolved.vortex.particleCount, effectProps.vortex.particleCount)
    assert.equal(staleHarmonyResolved.vortex.rangeY, effectProps.vortex.rangeY)
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
    assert.equal(backgroundPaletteRegistry["massage-lab-dna"].sourceBehavior, "fixed")
    assert.equal(backgroundPaletteRegistry["massage-lab-twisted-cubes"].sourceBehavior, "automatic")
  })

  it("declares the exact DNA roles and preserves non-color DNA options", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-dna"]
    assert.equal(adapter.status, "supported")
    assert.equal(adapter.rendererFamily, "css-dom")
    assert.deepEqual(
      adapter.roles.map(({ id, label, sourceColor, defaultSwatch, rendererTarget }) => ({
        id,
        label,
        sourceColor,
        defaultSwatch,
        rendererTarget,
      })),
      [
        { id: "background", label: "Background", sourceColor: "hsl(210 80% 12%)", defaultSwatch: 3, rendererTarget: "massageLabDna.backgroundColor" },
        { id: "node-one", label: "Adenine (A)", sourceColor: "hsl(44 98% 60%)", defaultSwatch: 0, rendererTarget: "massageLabDna.nodeRoleColors[0]" },
        { id: "node-two", label: "Thymine (T)", sourceColor: "hsl(197 50% 44%)", defaultSwatch: 1, rendererTarget: "massageLabDna.nodeRoleColors[1]" },
        { id: "node-three", label: "Guanine (G)", sourceColor: "hsl(0 0% 100%)", defaultSwatch: 2, rendererTarget: "massageLabDna.nodeRoleColors[2]" },
        { id: "node-four", label: "Cytosine (C)", sourceColor: "hsl(331 76% 50%)", defaultSwatch: 5, rendererTarget: "massageLabDna.nodeRoleColors[3]" },
        { id: "connector", label: "Connector", sourceColor: "#ffffff", defaultSwatch: 4, rendererTarget: "massageLabDna.connectorColor" },
        { id: "outline", label: "Outline", sourceColor: "#000000", defaultSwatch: 6, rendererTarget: "massageLabDna.outlineColor" },
      ],
    )
    assert.deepEqual(adapter.visualPropertyKeys, [
      "massageLabDnaStrandCount",
      "massageLabDnaShowBaseLetters",
      "massageLabDnaNodeMotionSpeed",
      "massageLabDnaStrandRotationEnabled",
      "massageLabDnaStrandRotationSpeed",
      "massageLabDnaStrandRotationDirection",
      "massageLabDnaStrandAngle",
      "massageLabDnaScale",
      "massageLabDnaPositionX",
      "massageLabDnaPositionY",
      "massageLabDnaStrandSpacing",
      "massageLabDnaNodeSize",
      "massageLabDnaConnectorWidth",
      "massageLabDnaConnectorThickness",
      "massageLabDnaOutlineThickness",
    ])
    const fixture = cssDomFixtures["massage-lab-dna"]
    const original = structuredClone(fixture)
    const applied = adapter.applyRoleColors(fixture, Object.fromEntries(
      adapter.roles.map((role, index) => [role.id, CUSTOM_SWATCHES[index]]),
    ))
    assert.deepEqual(
      [...changedLeafPaths(fixture, applied)].sort(),
      adapter.roles.map((role) => role.rendererTarget).sort(),
    )
    assert.deepEqual(fixture, original)
    assert.equal(applied.massageLabDna.strandCount, 70)
    assert.equal(applied.massageLabDna.showBaseLetters, false)
    assert.equal(applied.massageLabDna.connectorWidth, 94)
  })

  it("keeps Twisted Cubes continuous in Source and resolves exactly six Custom/Harmony anchors", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-twisted-cubes"]
    assert.equal(adapter.status, "supported")
    assert.deepEqual(
      adapter.roles.map(({ id, label, sourceColor, defaultSwatch, rendererTarget }) => ({
        id,
        label,
        sourceColor,
        defaultSwatch,
        rendererTarget,
      })),
      [
        { id: "background", label: "Background", sourceColor: "hsl(210 20% 12%)", defaultSwatch: 3, rendererTarget: "massageLabTwistedCubes.backgroundColor" },
        { id: "outline-one", label: "Outline 1", sourceColor: "hsl(180 80% 60%)", defaultSwatch: 0, rendererTarget: "massageLabTwistedCubes.outlineAnchors[0]" },
        { id: "outline-two", label: "Outline 2", sourceColor: "hsl(212 80% 60%)", defaultSwatch: 1, rendererTarget: "massageLabTwistedCubes.outlineAnchors[1]" },
        { id: "outline-three", label: "Outline 3", sourceColor: "hsl(244 80% 60%)", defaultSwatch: 2, rendererTarget: "massageLabTwistedCubes.outlineAnchors[2]" },
        { id: "outline-four", label: "Outline 4", sourceColor: "hsl(276 80% 60%)", defaultSwatch: 4, rendererTarget: "massageLabTwistedCubes.outlineAnchors[3]" },
        { id: "outline-five", label: "Outline 5", sourceColor: "hsl(308 80% 60%)", defaultSwatch: 5, rendererTarget: "massageLabTwistedCubes.outlineAnchors[4]" },
        { id: "outline-six", label: "Outline 6", sourceColor: "hsl(340 80% 60%)", defaultSwatch: 6, rendererTarget: "massageLabTwistedCubes.outlineAnchors[5]" },
      ],
    )
    assert.equal(new Set(adapter.roles.map((role) => role.rendererTarget)).size, 7)

    const fixture = cssDomFixtures["massage-lab-twisted-cubes"]
    const originalFixture = structuredClone(fixture)
    const custom = resolveBackgroundEffectProps({
      selectedId: "massage-lab-twisted-cubes",
      effectProps: fixture,
      palette: paletteForMode("custom"),
      canCustomize: true,
    })
    assert.equal(custom.massageLabTwistedCubes.paletteMode, "resolved")
    assert.deepEqual(custom.massageLabTwistedCubes.outlineAnchors, [
      CUSTOM_SWATCHES[0], CUSTOM_SWATCHES[1], CUSTOM_SWATCHES[2],
      CUSTOM_SWATCHES[4], CUSTOM_SWATCHES[5], CUSTOM_SWATCHES[6],
    ])
    assert.equal(custom.massageLabTwistedCubes.layerCount, 20)

    const harmony = resolveBackgroundEffectProps({
      selectedId: "massage-lab-twisted-cubes",
      effectProps: fixture,
      palette: paletteForMode("harmony"),
      canCustomize: true,
    })
    assert.equal(harmony.massageLabTwistedCubes.paletteMode, "resolved")
    assert.equal(harmony.massageLabTwistedCubes.outlineAnchors.length, 6)
    assert.equal(new Set(harmony.massageLabTwistedCubes.outlineAnchors).size, 6)
    assert.notDeepEqual(
      harmony.massageLabTwistedCubes.outlineAnchors,
      TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS,
    )

    const source = resolveBackgroundEffectProps({
      selectedId: "massage-lab-twisted-cubes",
      effectProps: fixture,
      palette: paletteForMode("source"),
      canCustomize: true,
    })
    assert.equal(source.massageLabTwistedCubes.paletteMode, "source")
    assert.equal(source.massageLabTwistedCubes.backgroundColor, "hsl(210 20% 12%)")

    const denied = resolveBackgroundEffectProps({
      selectedId: "massage-lab-twisted-cubes",
      effectProps: { ...fixture, massageLabTwistedCubes: { ...fixture.massageLabTwistedCubes, paletteMode: "resolved" } },
      palette: paletteForMode("custom"),
      canCustomize: false,
    })
    assert.equal(denied.massageLabTwistedCubes.paletteMode, "source")
    assert.deepEqual(fixture, originalFixture)
  })

  it("completes DNA and Twisted Cubes role arrays from source fallbacks", () => {
    const dnaFixture = structuredClone(cssDomFixtures["massage-lab-dna"])
    delete dnaFixture.massageLabDna.nodeRoleColors
    const dna = applyCssDomPaletteRoleColors("massage-lab-dna", dnaFixture, {
      "node-one": "#123456",
    })
    assert.deepEqual(dna.massageLabDna.nodeRoleColors, [
      "#123456",
      ...DNA_SOURCE_NODE_ROLE_COLORS.slice(1),
    ])

    const cubesFixture = structuredClone(cssDomFixtures["massage-lab-twisted-cubes"])
    cubesFixture.massageLabTwistedCubes.outlineAnchors = ["#abcdef"]
    const cubes = applyCssDomPaletteRoleColors("massage-lab-twisted-cubes", cubesFixture, {
      "outline-three": "#654321",
    })
    assert.deepEqual(cubes.massageLabTwistedCubes.outlineAnchors, [
      "#abcdef",
      TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS[1],
      "#654321",
      ...TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS.slice(3),
    ])
  })

  it("preserves Static Gradient's configured two-to-seven color count", () => {
    const adapter = backgroundPaletteRegistry["static-gradient"]
    assert.equal(adapter.status, "supported")
    const roleColors = Object.fromEntries(
      adapter.roles.map((role, index) => [role.id, CUSTOM_SWATCHES[index]]),
    )

    for (const colorCount of [2, 4, 7]) {
      const fixture = structuredClone(cssDomFixtures["static-gradient"])
      fixture.staticGradient.colorCount = colorCount
      fixture.staticGradient.colors = fixture.staticGradient.colors.slice(0, colorCount)
      const resolved = applyCssDomPaletteRoleColors("static-gradient", fixture, roleColors)

      assert.equal(resolved.staticGradient.colors.length, colorCount)
      assert.deepEqual(resolved.staticGradient.colors, CUSTOM_SWATCHES.slice(0, colorCount))
    }
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
      const original = structuredClone(fixture)

      for (const mode of ["source", "custom", "harmony"]) {
        const after = adapter.applyRoleColors(fixture, roleColorsForMode(adapter, mode))
        assert.deepEqual(
          [...changedLeafPaths(fixture, after)].sort(),
          adapter.roles.map((role) => role.rendererTarget).sort(),
          `${backgroundId}:${mode}`,
        )
        assert.deepEqual(fixture, original, `${backgroundId}:${mode}:mutation`)
        assert.notEqual(after, fixture, `${backgroundId}:${mode}:identity`)
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

  it("copies only modified renderer paths and preserves unrelated identities", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-lightfall"]
    const colors = {
      "streak-1": "#110011",
      "streak-2": "#220022",
      "streak-3": "#330033",
      background: "#440044",
    }
    const unchangedMetadata = { frame: 42 }
    const unchangedNested = { intensity: 0.75 }
    const originalColors = ["#111111", "#222222", "#333333"]
    const props = {
      rendererLifecycle: unchangedMetadata,
      massageLabLightfall: {
        colors: originalColors,
        backgroundColor: "#000000",
        tuning: unchangedNested,
      },
    }

    const resolved = adapter.applyRoleColors(props, colors)

    assert.notEqual(resolved, props)
    assert.equal(resolved.rendererLifecycle, unchangedMetadata)
    assert.notEqual(resolved.massageLabLightfall, props.massageLabLightfall)
    assert.notEqual(resolved.massageLabLightfall.colors, originalColors)
    assert.equal(resolved.massageLabLightfall.tuning, unchangedNested)
    assert.deepEqual(resolved.massageLabLightfall.colors, [
      "#110011",
      "#220022",
      "#330033",
    ])
    assert.deepEqual(props.massageLabLightfall.colors, [
      "#111111",
      "#222222",
      "#333333",
    ])
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

  it("uses resolved Custom colors for static fallbacks while preserving Source and denied fallbacks", () => {
    const fallbackStyle = { background: "linear-gradient(#010101, #020202)" }
    const palette = {
      mode: "custom",
      primaryColor: CUSTOM_SWATCHES[0],
      harmony: "triadic",
      swatches: CUSTOM_SWATCHES,
    }
    const input = {
      selectedId: "massage-lab-retro-grid",
      fallbackStyle,
      palette,
      mapping: {
        background: 6,
        "light-lines": 5,
        "dark-lines": 4,
      },
    }

    const custom = resolveBackgroundFallbackStyle({
      ...input,
      canCustomize: true,
    })
    assert.deepEqual(custom, {
      background: `linear-gradient(135deg, ${CUSTOM_SWATCHES[6]} 0%, ${CUSTOM_SWATCHES[5]} 50%, ${CUSTOM_SWATCHES[4]} 100%)`,
    })
    assert.equal(
      resolveBackgroundFallbackStyle({
        ...input,
        palette: { ...palette, mode: "source" },
        canCustomize: true,
      }),
      fallbackStyle,
    )
    assert.equal(
      resolveBackgroundFallbackStyle({
        ...input,
        canCustomize: false,
      }),
      fallbackStyle,
    )
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
      resolveBackgroundEffectProps({ ...input, selectedId: "massage-lab-prism" }),
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

  it("preserves renderer-grounded spectral, hue, and alpha Source contracts", () => {
    const sourcePalette = paletteForMode("source")

    const prismaticProps = {
      massageLabPrismaticBurst: {
        colors: ["#8A5CF6", "#EC4899", "#22D3EE", "#FFFFFF"],
        intensity: 2.4,
        rayCount: 19,
      },
    }
    const prismatic = resolveBackgroundEffectProps({
      selectedId: "massage-lab-prismatic-burst",
      effectProps: prismaticProps,
      palette: sourcePalette,
      mapping: {},
      canCustomize: true,
    })
    assert.deepEqual(prismatic, {
      massageLabPrismaticBurst: {
        colors: [],
        intensity: 2.4,
        rayCount: 19,
      },
    })
    assert.deepEqual(prismaticProps.massageLabPrismaticBurst.colors, [
      "#8A5CF6",
      "#EC4899",
      "#22D3EE",
      "#FFFFFF",
    ])

    const galaxyProps = {
      massageLabGalaxy: {
        hueShift: 12,
        density: 1.4,
        transparent: true,
      },
    }
    const galaxy = resolveBackgroundEffectProps({
      selectedId: "massage-lab-galaxy",
      effectProps: galaxyProps,
      palette: sourcePalette,
      mapping: {},
      canCustomize: true,
    })
    assert.equal(galaxy.massageLabGalaxy.hueShift, 140)
    assert.equal(galaxy.massageLabGalaxy.density, 1.4)
    assert.equal(galaxy.massageLabGalaxy.transparent, true)
    assert.equal(
      backgroundPaletteRegistry["massage-lab-galaxy"].roles[0].sourceColor,
      "#00FF55",
    )
    assert.deepEqual(galaxyProps.massageLabGalaxy, {
      hueShift: 12,
      density: 1.4,
      transparent: true,
    })

    const orbProps = {
      massageLabOrb: {
        hue: 271,
        hoverIntensity: 0.44,
        backgroundColor: "#010203",
      },
    }
    const orb = resolveBackgroundEffectProps({
      selectedId: "massage-lab-orb",
      effectProps: orbProps,
      palette: sourcePalette,
      mapping: {},
      canCustomize: true,
    })
    assert.equal(orb.massageLabOrb.hue, 0)
    assert.equal(orb.massageLabOrb.hoverIntensity, 0.44)
    assert.equal(orb.massageLabOrb.backgroundColor, "#000000")
    assert.equal(
      backgroundPaletteRegistry["massage-lab-orb"].roles[0].sourceColor,
      "#FF0000",
    )
    assert.deepEqual(orbProps.massageLabOrb, {
      hue: 271,
      hoverIntensity: 0.44,
      backgroundColor: "#010203",
    })

    const dotFieldProps = {
      massageLabDotField: {
        gradientFrom: "rgba(1, 2, 3, 0.35)",
        gradientTo: "rgba(4, 5, 6, 0.25)",
        glowColor: "#010101",
        dotRadius: 2.1,
        cursorInteraction: false,
      },
    }
    const dotFieldSource = resolveBackgroundEffectProps({
      selectedId: "massage-lab-dot-field",
      effectProps: dotFieldProps,
      palette: sourcePalette,
      mapping: {},
      canCustomize: true,
    })
    assert.deepEqual(dotFieldSource.massageLabDotField, {
      gradientFrom: "rgba(168, 85, 247, 0.35)",
      gradientTo: "rgba(180, 151, 207, 0.25)",
      glowColor: "#120f17",
      dotRadius: 2.1,
      cursorInteraction: false,
    })

    const dotFieldCustomProps = {
      massageLabDotField: {
        ...dotFieldProps.massageLabDotField,
        gradientFrom: "rgba(1, 2, 3, 0.61)",
        gradientTo: "rgba(4, 5, 6, 0.17)",
      },
    }
    const dotFieldCustom = resolveBackgroundEffectProps({
      selectedId: "massage-lab-dot-field",
      effectProps: dotFieldCustomProps,
      palette: paletteForMode("custom"),
      mapping: {},
      canCustomize: true,
    })
    assert.deepEqual(dotFieldCustom.massageLabDotField, {
      gradientFrom: "rgba(17, 0, 17, 0.61)",
      gradientTo: "rgba(34, 0, 34, 0.17)",
      glowColor: "#330033",
      dotRadius: 2.1,
      cursorInteraction: false,
    })
    const dotFieldWithoutAuthoredProps = resolveBackgroundEffectProps({
      selectedId: "massage-lab-dot-field",
      effectProps: { massageLabDotField: { dotRadius: 2.1 } },
      palette: paletteForMode("custom"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(
      dotFieldWithoutAuthoredProps.massageLabDotField.gradientFrom,
      "rgba(17, 0, 17, 0.35)",
    )
    assert.equal(
      dotFieldWithoutAuthoredProps.massageLabDotField.gradientTo,
      "rgba(34, 0, 34, 0.25)",
    )
    assert.deepEqual(dotFieldProps.massageLabDotField, {
      gradientFrom: "rgba(1, 2, 3, 0.35)",
      gradientTo: "rgba(4, 5, 6, 0.25)",
      glowColor: "#010101",
      dotRadius: 2.1,
      cursorInteraction: false,
    })
  })

  it("restores every special Source contract when customization access is unavailable", () => {
    const effectProps = {
      massageLabPrismaticBurst: {
        colors: ["#111111", "#222222", "#333333", "#444444"],
        intensity: 1.8,
      },
      massageLabGalaxy: {
        hueShift: 12,
        density: 1.4,
      },
      massageLabOrb: {
        hue: 271,
        hoverIntensity: 0.44,
        backgroundColor: "#010203",
      },
      massageLabDotField: {
        gradientFrom: "rgba(1, 2, 3, 0.35)",
        gradientTo: "rgba(4, 5, 6, 0.25)",
        glowColor: "#010101",
        dotRadius: 2.1,
      },
      tileGrid: {
        paletteMode: "custom",
        colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
        tileSize: 43,
      },
      auroraBars: {
        paletteMode: "custom",
        colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
        background: "#010101",
        barCount: 31,
      },
      massageLabRippleGrid: {
        enableRainbow: true,
        gridColor: "#010101",
        rippleIntensity: 0.17,
      },
    }
    const original = structuredClone(effectProps)
    const resolveFallback = (selectedId) => resolveBackgroundEffectProps({
      selectedId,
      effectProps,
      palette: paletteForMode("custom"),
      mapping: {},
      canCustomize: false,
    })

    assert.deepEqual(
      resolveFallback("massage-lab-prismatic-burst").massageLabPrismaticBurst.colors,
      [],
    )
    assert.equal(
      resolveFallback("massage-lab-galaxy").massageLabGalaxy.hueShift,
      140,
    )
    assert.equal(resolveFallback("massage-lab-orb").massageLabOrb.hue, 0)
    assert.deepEqual(
      resolveFallback("massage-lab-dot-field").massageLabDotField,
      {
        gradientFrom: "rgba(168, 85, 247, 0.35)",
        gradientTo: "rgba(180, 151, 207, 0.25)",
        glowColor: "#120f17",
        dotRadius: 2.1,
      },
    )
    assert.equal(resolveFallback("massage-lab-tile-grid").tileGrid.paletteMode, "auto")
    assert.equal(resolveFallback("massage-lab-aurora-bars").auroraBars.paletteMode, "auto")
    assert.equal(
      resolveFallback("massage-lab-ripple-grid").massageLabRippleGrid.enableRainbow,
      true,
    )
    assert.deepEqual(effectProps, original)
  })

  it("switches renderer-owned palette controls with the effective mode", () => {
    const customPalette = paletteForMode("custom")
    const harmonyPalette = paletteForMode("harmony")
    const sourcePalette = paletteForMode("source")
    const harmonyColors = generateBackgroundHarmonySwatches(
      HARMONY_PRIMARY,
      "triadic",
    )

    const tileProps = {
      tileGrid: {
        paletteMode: "auto",
        primaryColor: "#ABCDEF",
        colors: ["#010101", "#020202", "#030303", "#040404", "#050505"],
        tileSize: 43,
        opacity: 0.77,
      },
    }
    const tileCustom = resolveBackgroundEffectProps({
      selectedId: "massage-lab-tile-grid",
      effectProps: tileProps,
      palette: customPalette,
      mapping: {},
      canCustomize: true,
    })
    const tileHarmony = resolveBackgroundEffectProps({
      selectedId: "massage-lab-tile-grid",
      effectProps: tileProps,
      palette: harmonyPalette,
      mapping: {},
      canCustomize: true,
    })
    const tileSource = resolveBackgroundEffectProps({
      selectedId: "massage-lab-tile-grid",
      effectProps: {
        tileGrid: {
          ...tileProps.tileGrid,
          paletteMode: "custom",
        },
      },
      palette: sourcePalette,
      mapping: {},
      canCustomize: true,
    })
    assert.equal(tileCustom.tileGrid.paletteMode, "custom")
    assert.deepEqual(tileCustom.tileGrid.colors, CUSTOM_SWATCHES.slice(0, 5))
    assert.equal(tileHarmony.tileGrid.paletteMode, "custom")
    assert.deepEqual(tileHarmony.tileGrid.colors, harmonyColors.slice(0, 5))
    assert.equal(tileSource.tileGrid.paletteMode, "auto")
    assert.equal(tileSource.tileGrid.tileSize, 43)
    assert.equal(tileSource.tileGrid.opacity, 0.77)

    const auroraProps = {
      auroraBars: {
        paletteMode: "auto",
        primaryColor: "#ABCDEF",
        colors: ["#010101", "#020202", "#030303", "#040404", "#050505"],
        background: "#060606",
        barCount: 31,
        audioLevel: 0.61,
      },
    }
    const auroraCustom = resolveBackgroundEffectProps({
      selectedId: "massage-lab-aurora-bars",
      effectProps: auroraProps,
      palette: customPalette,
      mapping: {},
      canCustomize: true,
    })
    const auroraHarmony = resolveBackgroundEffectProps({
      selectedId: "massage-lab-aurora-bars",
      effectProps: auroraProps,
      palette: harmonyPalette,
      mapping: {},
      canCustomize: true,
    })
    const auroraSource = resolveBackgroundEffectProps({
      selectedId: "massage-lab-aurora-bars",
      effectProps: {
        auroraBars: {
          ...auroraProps.auroraBars,
          paletteMode: "custom",
        },
      },
      palette: sourcePalette,
      mapping: {},
      canCustomize: true,
    })
    assert.equal(auroraCustom.auroraBars.paletteMode, "custom")
    assert.equal(auroraCustom.auroraBars.background, CUSTOM_SWATCHES[6])
    assert.deepEqual(auroraCustom.auroraBars.colors, CUSTOM_SWATCHES.slice(0, 5))
    assert.equal(auroraHarmony.auroraBars.paletteMode, "custom")
    assert.equal(auroraHarmony.auroraBars.background, CUSTOM_SWATCHES[6])
    assert.deepEqual(auroraHarmony.auroraBars.colors, harmonyColors.slice(0, 5))
    assert.equal(auroraSource.auroraBars.paletteMode, "auto")
    assert.equal(auroraSource.auroraBars.barCount, 31)
    assert.equal(auroraSource.auroraBars.audioLevel, 0.61)

    const rippleProps = {
      massageLabRippleGrid: {
        gridColor: "#FFFFFF",
        rippleIntensity: 0.17,
        mouseInteraction: false,
      },
    }
    const rippleCustom = resolveBackgroundEffectProps({
      selectedId: "massage-lab-ripple-grid",
      effectProps: rippleProps,
      palette: customPalette,
      mapping: {},
      canCustomize: true,
    })
    const rippleHarmony = resolveBackgroundEffectProps({
      selectedId: "massage-lab-ripple-grid",
      effectProps: rippleProps,
      palette: harmonyPalette,
      mapping: {},
      canCustomize: true,
    })
    const rippleSource = resolveBackgroundEffectProps({
      selectedId: "massage-lab-ripple-grid",
      effectProps: rippleProps,
      palette: sourcePalette,
      mapping: {},
      canCustomize: true,
    })
    const rippleAccessFallback = resolveBackgroundEffectProps({
      selectedId: "massage-lab-ripple-grid",
      effectProps: rippleProps,
      palette: customPalette,
      mapping: {},
      canCustomize: false,
    })
    const rippleWithoutSavedPalette = resolveBackgroundEffectProps({
      selectedId: "massage-lab-ripple-grid",
      effectProps: rippleProps,
      palette: undefined,
      mapping: undefined,
      canCustomize: true,
    })
    assert.equal(rippleCustom.massageLabRippleGrid.enableRainbow, false)
    assert.equal(rippleCustom.massageLabRippleGrid.gridColor, CUSTOM_SWATCHES[0])
    assert.equal(rippleHarmony.massageLabRippleGrid.enableRainbow, false)
    assert.equal(rippleHarmony.massageLabRippleGrid.gridColor, harmonyColors[0])
    assert.equal(rippleSource.massageLabRippleGrid.enableRainbow, true)
    assert.equal(rippleAccessFallback.massageLabRippleGrid.enableRainbow, true)
    assert.equal(rippleWithoutSavedPalette.massageLabRippleGrid.enableRainbow, true)
    assert.equal(rippleAccessFallback.massageLabRippleGrid.gridColor, "#ffffff")
    assert.equal(rippleAccessFallback.massageLabRippleGrid.rippleIntensity, 0.17)
    assert.equal(rippleAccessFallback.massageLabRippleGrid.mouseInteraction, false)

    const photonProps = {
      massageLabPhotonBeam: {
        colorBg: "#080808",
        colorLine: "#005F6F",
        colorSignal: "#00D9FF",
        colorSignal2: "#00FFFF",
        colorSignal3: "#00B8D4",
        lineCount: 80,
      },
    }
    const photonCustom = resolveBackgroundEffectProps({
      selectedId: "massage-lab-photon-beam",
      effectProps: photonProps,
      palette: customPalette,
      mapping: {},
      canCustomize: true,
    })
    const photonHarmony = resolveBackgroundEffectProps({
      selectedId: "massage-lab-photon-beam",
      effectProps: photonProps,
      palette: harmonyPalette,
      mapping: {},
      canCustomize: true,
    })
    const photonSource = resolveBackgroundEffectProps({
      selectedId: "massage-lab-photon-beam",
      effectProps: photonProps,
      palette: sourcePalette,
      mapping: {},
      canCustomize: true,
    })
    assert.equal(photonCustom.massageLabPhotonBeam.useColor2, true)
    assert.equal(photonCustom.massageLabPhotonBeam.useColor3, true)
    assert.equal(photonCustom.massageLabPhotonBeam.colorBg, CUSTOM_SWATCHES[6])
    assert.equal(photonCustom.massageLabPhotonBeam.colorSignal2, CUSTOM_SWATCHES[2])
    assert.equal(photonCustom.massageLabPhotonBeam.colorSignal3, CUSTOM_SWATCHES[3])
    assert.equal(photonHarmony.massageLabPhotonBeam.useColor2, true)
    assert.equal(photonHarmony.massageLabPhotonBeam.useColor3, true)
    assert.equal(photonHarmony.massageLabPhotonBeam.colorBg, CUSTOM_SWATCHES[6])
    assert.equal(photonHarmony.massageLabPhotonBeam.colorSignal2, harmonyColors[2])
    assert.equal(photonHarmony.massageLabPhotonBeam.colorSignal3, harmonyColors[3])
    assert.equal(photonSource.massageLabPhotonBeam.useColor2, false)
    assert.equal(photonSource.massageLabPhotonBeam.useColor3, false)
    assert.equal(photonSource.massageLabPhotonBeam.lineCount, 80)
    assert.equal(Object.hasOwn(photonProps.massageLabPhotonBeam, "useColor2"), false)
    assert.equal(Object.hasOwn(photonProps.massageLabPhotonBeam, "useColor3"), false)

    assert.deepEqual(
      backgroundPaletteRegistry["massage-lab-tile-grid"].modeOverrides,
      [{ rendererTarget: "tileGrid.paletteMode", sourceValue: "auto", customValue: "custom" }],
    )
    assert.deepEqual(
      backgroundPaletteRegistry["massage-lab-aurora-bars"].modeOverrides,
      [{ rendererTarget: "auroraBars.paletteMode", sourceValue: "auto", customValue: "custom" }],
    )
    assert.deepEqual(
      backgroundPaletteRegistry["massage-lab-ripple-grid"].modeOverrides,
      [{ rendererTarget: "massageLabRippleGrid.enableRainbow", sourceValue: true, customValue: false }],
    )
    assert.deepEqual(
      backgroundPaletteRegistry["massage-lab-photon-beam"].modeOverrides,
      [
        { rendererTarget: "massageLabPhotonBeam.useColor2", sourceValue: false, customValue: true },
        { rendererTarget: "massageLabPhotonBeam.useColor3", sourceValue: false, customValue: true },
      ],
    )
    assert.deepEqual(tileProps.tileGrid.paletteMode, "auto")
    assert.deepEqual(auroraProps.auroraBars.paletteMode, "auto")
    assert.equal(Object.hasOwn(rippleProps.massageLabRippleGrid, "enableRainbow"), false)
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

  it("reserves Swatch 7 for Aurora Field's background", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-aurora"]
    assert.deepEqual(
      Object.fromEntries(adapter.roles.map((role) => [role.id, role.defaultSwatch])),
      {
        background: 6,
        "aurora-1": 0,
        "aurora-2": 1,
        "aurora-3": 2,
        "aurora-4": 3,
        "aurora-5": 4,
      },
    )

    const resolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-aurora",
      effectProps: cssDomFixtures["massage-lab-aurora"],
      palette: paletteForMode("custom"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(resolved.massageLabAurora.backgroundColor, CUSTOM_SWATCHES[6])
    assert.deepEqual(resolved.massageLabAurora.colors, CUSTOM_SWATCHES.slice(0, 5))

    const harmonyResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-aurora",
      effectProps: cssDomFixtures["massage-lab-aurora"],
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    assert.equal(harmonyResolved.massageLabAurora.backgroundColor, CUSTOM_SWATCHES[6])
    assert.deepEqual(harmonyResolved.massageLabAurora.colors, harmonySwatches.slice(0, 5))
  })

  it("keeps Dotted Glow's Swatch 7 background independent from Harmony", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-dotted-glow"]
    assert.deepEqual(
      Object.fromEntries(adapter.roles.map((role) => [role.id, {
        defaultSwatch: role.defaultSwatch,
        harmonyColorSource: role.harmonyColorSource,
      }])),
      {
        background: { defaultSwatch: 6, harmonyColorSource: "saved-swatch" },
        dots: { defaultSwatch: 0, harmonyColorSource: "generated" },
        glow: { defaultSwatch: 1, harmonyColorSource: "generated" },
      },
    )

    const effectProps = {
      massageLabDottedGlow: {
        speed: 1.3,
        dotSize: 2.2,
        dotSpacing: 18,
        opacity: 0.66,
        glowStrength: 5,
      },
    }
    const resolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-dotted-glow",
      effectProps,
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    assert.equal(resolved.massageLabDottedGlow.backgroundColor, CUSTOM_SWATCHES[6])
    assert.equal(resolved.massageLabDottedGlow.dotColor, harmonySwatches[0])
    assert.equal(resolved.massageLabDottedGlow.glowColor, harmonySwatches[1])
    assert.deepEqual(
      {
        speed: resolved.massageLabDottedGlow.speed,
        dotSize: resolved.massageLabDottedGlow.dotSize,
        dotSpacing: resolved.massageLabDottedGlow.dotSpacing,
        opacity: resolved.massageLabDottedGlow.opacity,
        glowStrength: resolved.massageLabDottedGlow.glowStrength,
      },
      effectProps.massageLabDottedGlow,
    )
  })

  it("keeps Bubble Field's Swatch 7 background independent from Harmony", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-bubble"]
    assert.deepEqual(
      Object.fromEntries(adapter.roles.map((role) => [role.id, {
        defaultSwatch: role.defaultSwatch,
        harmonyColorSource: role.harmonyColorSource,
      }])),
      {
        background: { defaultSwatch: 6, harmonyColorSource: "saved-swatch" },
        "bubble-1": { defaultSwatch: 0, harmonyColorSource: "generated" },
        "bubble-2": { defaultSwatch: 1, harmonyColorSource: "generated" },
        "bubble-3": { defaultSwatch: 2, harmonyColorSource: "generated" },
        "bubble-4": { defaultSwatch: 3, harmonyColorSource: "generated" },
        "bubble-5": { defaultSwatch: 4, harmonyColorSource: "generated" },
      },
    )

    const effectProps = cssDomFixtures["massage-lab-bubble"]
    const sourceResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-bubble",
      effectProps,
      palette: paletteForMode("source"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(sourceResolved.massageLabBubble.paletteMode, "source")

    const harmonyResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-bubble",
      effectProps,
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    assert.equal(harmonyResolved.massageLabBubble.paletteMode, "resolved")
    assert.equal(harmonyResolved.massageLabBubble.backgroundColor, CUSTOM_SWATCHES[6])
    assert.deepEqual(harmonyResolved.massageLabBubble.colors, harmonySwatches.slice(0, 5))
    assert.deepEqual(
      {
        speed: harmonyResolved.massageLabBubble.speed,
        intensity: harmonyResolved.massageLabBubble.intensity,
        size: harmonyResolved.massageLabBubble.size,
        blur: harmonyResolved.massageLabBubble.blur,
        blendStrength: harmonyResolved.massageLabBubble.blendStrength,
      },
      {
        speed: effectProps.massageLabBubble.speed,
        intensity: effectProps.massageLabBubble.intensity,
        size: effectProps.massageLabBubble.size,
        blur: effectProps.massageLabBubble.blur,
        blendStrength: effectProps.massageLabBubble.blendStrength,
      },
    )
  })

  it("keeps Beam Field's Swatch 7 background independent from Harmony", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-background-beams"]
    assert.deepEqual(
      Object.fromEntries(adapter.roles.map((role) => [role.id, {
        defaultSwatch: role.defaultSwatch,
        harmonyColorSource: role.harmonyColorSource,
      }])),
      {
        background: { defaultSwatch: 6, harmonyColorSource: "saved-swatch" },
        "beam-1": { defaultSwatch: 0, harmonyColorSource: "generated" },
        "beam-2": { defaultSwatch: 1, harmonyColorSource: "generated" },
        "beam-3": { defaultSwatch: 2, harmonyColorSource: "generated" },
      },
    )

    const effectProps = cssDomFixtures["massage-lab-background-beams"]
    const sourceResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-background-beams",
      effectProps,
      palette: paletteForMode("source"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(sourceResolved.massageLabBackgroundBeams.paletteMode, "source")

    const harmonyResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-background-beams",
      effectProps,
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    assert.equal(harmonyResolved.massageLabBackgroundBeams.paletteMode, "resolved")
    assert.equal(harmonyResolved.massageLabBackgroundBeams.backgroundColor, CUSTOM_SWATCHES[6])
    assert.deepEqual(harmonyResolved.massageLabBackgroundBeams.colors, harmonySwatches.slice(0, 3))
    assert.deepEqual(
      {
        speed: harmonyResolved.massageLabBackgroundBeams.speed,
        intensity: harmonyResolved.massageLabBackgroundBeams.intensity,
        beamWidth: harmonyResolved.massageLabBackgroundBeams.beamWidth,
        glowStrength: harmonyResolved.massageLabBackgroundBeams.glowStrength,
      },
      {
        speed: effectProps.massageLabBackgroundBeams.speed,
        intensity: effectProps.massageLabBackgroundBeams.intensity,
        beamWidth: effectProps.massageLabBackgroundBeams.beamWidth,
        glowStrength: effectProps.massageLabBackgroundBeams.glowStrength,
      },
    )
  })

  it("keeps Collision Beams' Swatch 7 background independent from Harmony", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-collision-beams"]
    assert.deepEqual(
      Object.fromEntries(adapter.roles.map((role) => [role.id, {
        defaultSwatch: role.defaultSwatch,
        harmonyColorSource: role.harmonyColorSource,
      }])),
      {
        background: { defaultSwatch: 6, harmonyColorSource: "saved-swatch" },
        beam: { defaultSwatch: 0, harmonyColorSource: "generated" },
        accent: { defaultSwatch: 1, harmonyColorSource: "generated" },
        particles: { defaultSwatch: 2, harmonyColorSource: "generated" },
        surface: { defaultSwatch: 3, harmonyColorSource: "generated" },
      },
    )

    const effectProps = cssDomFixtures["massage-lab-collision-beams"]
    const sourceResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-collision-beams",
      effectProps,
      palette: paletteForMode("source"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(sourceResolved.massageLabCollisionBeams.paletteMode, "source")

    const harmonyResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-collision-beams",
      effectProps,
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    assert.equal(harmonyResolved.massageLabCollisionBeams.paletteMode, "resolved")
    assert.equal(harmonyResolved.massageLabCollisionBeams.backgroundColor, CUSTOM_SWATCHES[6])
    assert.equal(harmonyResolved.massageLabCollisionBeams.beamColor, harmonySwatches[0])
    assert.equal(harmonyResolved.massageLabCollisionBeams.accentColor, harmonySwatches[1])
    assert.equal(harmonyResolved.massageLabCollisionBeams.particleColor, harmonySwatches[2])
    assert.equal(harmonyResolved.massageLabCollisionBeams.surfaceColor, harmonySwatches[3])
    assert.deepEqual(
      {
        speed: harmonyResolved.massageLabCollisionBeams.speed,
        intensity: harmonyResolved.massageLabCollisionBeams.intensity,
        beamWidth: harmonyResolved.massageLabCollisionBeams.beamWidth,
        burstSize: harmonyResolved.massageLabCollisionBeams.burstSize,
      },
      {
        speed: effectProps.massageLabCollisionBeams.speed,
        intensity: effectProps.massageLabCollisionBeams.intensity,
        beamWidth: effectProps.massageLabCollisionBeams.beamWidth,
        burstSize: effectProps.massageLabCollisionBeams.burstSize,
      },
    )
  })

  it("keeps Glowing Stars' Swatch 7 background independent from Harmony", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-glowing-stars"]
    assert.deepEqual(
      Object.fromEntries(adapter.roles.map((role) => [role.id, {
        defaultSwatch: role.defaultSwatch,
        harmonyColorSource: role.harmonyColorSource,
      }])),
      {
        background: { defaultSwatch: 6, harmonyColorSource: "saved-swatch" },
        stars: { defaultSwatch: 0, harmonyColorSource: "generated" },
        peak: { defaultSwatch: 1, harmonyColorSource: "generated" },
        afterglow: { defaultSwatch: 2, harmonyColorSource: "generated" },
        "glow-core": { defaultSwatch: 3, harmonyColorSource: "generated" },
        "glow-aura": { defaultSwatch: 4, harmonyColorSource: "generated" },
      },
    )

    const effectProps = cssDomFixtures["massage-lab-glowing-stars"]
    const sourceResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-glowing-stars",
      effectProps,
      palette: paletteForMode("source"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(sourceResolved.massageLabGlowingStars.paletteMode, "source")

    const harmonyResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-glowing-stars",
      effectProps,
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    assert.equal(harmonyResolved.massageLabGlowingStars.paletteMode, "resolved")
    assert.equal(harmonyResolved.massageLabGlowingStars.backgroundColor, CUSTOM_SWATCHES[6])
    assert.equal(harmonyResolved.massageLabGlowingStars.starColor, harmonySwatches[0])
    assert.equal(harmonyResolved.massageLabGlowingStars.peakColor, harmonySwatches[1])
    assert.equal(harmonyResolved.massageLabGlowingStars.afterglowColor, harmonySwatches[2])
    assert.equal(harmonyResolved.massageLabGlowingStars.glowCoreColor, harmonySwatches[3])
    assert.equal(harmonyResolved.massageLabGlowingStars.glowAuraColor, harmonySwatches[4])
    assert.deepEqual(
      {
        speed: harmonyResolved.massageLabGlowingStars.speed,
        intensity: harmonyResolved.massageLabGlowingStars.intensity,
        activeStars: harmonyResolved.massageLabGlowingStars.activeStars,
        starSize: harmonyResolved.massageLabGlowingStars.starSize,
        glowStrength: harmonyResolved.massageLabGlowingStars.glowStrength,
      },
      {
        speed: effectProps.massageLabGlowingStars.speed,
        intensity: effectProps.massageLabGlowingStars.intensity,
        activeStars: effectProps.massageLabGlowingStars.activeStars,
        starSize: effectProps.massageLabGlowingStars.starSize,
        glowStrength: effectProps.massageLabGlowingStars.glowStrength,
      },
    )
  })

  it("keeps Meteors' Swatch 7 background independent from Harmony", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-meteors"]
    assert.deepEqual(
      Object.fromEntries(adapter.roles.map((role) => [role.id, {
        defaultSwatch: role.defaultSwatch,
        harmonyColorSource: role.harmonyColorSource,
      }])),
      {
        background: { defaultSwatch: 6, harmonyColorSource: "saved-swatch" },
        meteors: { defaultSwatch: 0, harmonyColorSource: "generated" },
        tails: { defaultSwatch: 1, harmonyColorSource: "generated" },
        glow: { defaultSwatch: 2, harmonyColorSource: "generated" },
        edge: { defaultSwatch: 3, harmonyColorSource: "generated" },
      },
    )

    const effectProps = cssDomFixtures["massage-lab-meteors"]
    const sourceResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-meteors",
      effectProps,
      palette: paletteForMode("source"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(sourceResolved.massageLabMeteors.paletteMode, "source")

    const harmonyResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-meteors",
      effectProps,
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    assert.equal(harmonyResolved.massageLabMeteors.paletteMode, "resolved")
    assert.equal(harmonyResolved.massageLabMeteors.backgroundColor, CUSTOM_SWATCHES[6])
    assert.equal(harmonyResolved.massageLabMeteors.meteorColor, harmonySwatches[0])
    assert.equal(harmonyResolved.massageLabMeteors.tailColor, harmonySwatches[1])
    assert.equal(harmonyResolved.massageLabMeteors.glowColor, harmonySwatches[2])
    assert.equal(harmonyResolved.massageLabMeteors.edgeColor, harmonySwatches[3])
    assert.deepEqual(
      {
        speed: harmonyResolved.massageLabMeteors.speed,
        intensity: harmonyResolved.massageLabMeteors.intensity,
        count: harmonyResolved.massageLabMeteors.count,
        size: harmonyResolved.massageLabMeteors.size,
        tailLength: harmonyResolved.massageLabMeteors.tailLength,
      },
      {
        speed: effectProps.massageLabMeteors.speed,
        intensity: effectProps.massageLabMeteors.intensity,
        count: effectProps.massageLabMeteors.count,
        size: effectProps.massageLabMeteors.size,
        tailLength: effectProps.massageLabMeteors.tailLength,
      },
    )
  })

  it("keeps Light Lines' Swatch 7 background independent from Harmony", () => {
    const adapter = backgroundPaletteRegistry["massage-lab-background-lines"]
    assert.deepEqual(
      Object.fromEntries(adapter.roles.map((role) => [role.id, {
        defaultSwatch: role.defaultSwatch,
        harmonyColorSource: role.harmonyColorSource,
      }])),
      {
        background: { defaultSwatch: 6, harmonyColorSource: "saved-swatch" },
        "line-1": { defaultSwatch: 0, harmonyColorSource: "generated" },
        "line-2": { defaultSwatch: 1, harmonyColorSource: "generated" },
        "line-3": { defaultSwatch: 2, harmonyColorSource: "generated" },
        "line-4": { defaultSwatch: 3, harmonyColorSource: "generated" },
        "line-5": { defaultSwatch: 4, harmonyColorSource: "generated" },
        "line-6": { defaultSwatch: 5, harmonyColorSource: "generated" },
      },
    )

    const effectProps = cssDomFixtures["massage-lab-background-lines"]
    const sourceResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-background-lines",
      effectProps,
      palette: paletteForMode("source"),
      mapping: {},
      canCustomize: true,
    })
    assert.equal(sourceResolved.backgroundLines.paletteMode, "source")

    const harmonyResolved = resolveBackgroundEffectProps({
      selectedId: "massage-lab-background-lines",
      effectProps,
      palette: paletteForMode("harmony"),
      mapping: {},
      canCustomize: true,
    })
    const harmonySwatches = generateBackgroundHarmonySwatches(HARMONY_PRIMARY, "triadic")
    assert.equal(harmonyResolved.backgroundLines.paletteMode, "resolved")
    assert.equal(harmonyResolved.backgroundLines.backgroundColor, CUSTOM_SWATCHES[6])
    assert.deepEqual(harmonyResolved.backgroundLines.colors, harmonySwatches.slice(0, 6))
    assert.deepEqual(
      {
        duration: harmonyResolved.backgroundLines.duration,
        intensity: harmonyResolved.backgroundLines.intensity,
        count: harmonyResolved.backgroundLines.count,
        lineWidth: harmonyResolved.backgroundLines.lineWidth,
        glowStrength: harmonyResolved.backgroundLines.glowStrength,
      },
      {
        duration: effectProps.backgroundLines.duration,
        intensity: effectProps.backgroundLines.intensity,
        count: effectProps.backgroundLines.count,
        lineWidth: effectProps.backgroundLines.lineWidth,
        glowStrength: effectProps.backgroundLines.glowStrength,
      },
    )
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
    assert.equal(auroraCustom.auroraBars.background, CUSTOM_SWATCHES[6])
    assert.deepEqual(auroraCustom.auroraBars.colors, CUSTOM_SWATCHES.slice(0, 5))

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
