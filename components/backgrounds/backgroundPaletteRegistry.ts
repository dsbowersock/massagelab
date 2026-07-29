import {
  DEFAULT_CHIMER_SETTINGS,
  sanitizeChimerSettings,
} from "../../lib/chimer-timer.js"
import type {
  BackgroundEffectProps,
  CssDomPaletteBackgroundId,
  CssDomPaletteEffectPropsById,
} from "./effects/css-backgrounds"

export type BackgroundRendererFamily = "css-dom" | "canvas" | "webgl"
export type EffectiveBackgroundPaletteMode = "source" | "custom" | "harmony"

export interface BackgroundPaletteRole {
  id: string
  label: string
  /** Persisted legacy color key suppressed while the shared draft is active. */
  sourceSettingKey: string
  sourceColor: string
  defaultSwatch: 0 | 1 | 2 | 3 | 4 | 5 | 6
  rendererTarget: string
}

export interface SupportedBackgroundPaletteAdapter {
  status: "supported"
  rendererFamily: BackgroundRendererFamily
  roles: readonly BackgroundPaletteRole[]
  sourceBehavior?: "fixed" | "rainbow" | "automatic"
  visualPropertyKeys: readonly string[]
  sourceVisualProperties: Readonly<Record<string, unknown>>
  modeOverrides?: readonly BackgroundPaletteModeOverride[]
  applyRoleColors: (
    props: BackgroundEffectProps,
    colors: Readonly<Record<string, string>>,
    mode?: EffectiveBackgroundPaletteMode,
  ) => BackgroundEffectProps
}

export interface UnsupportedBackgroundPaletteAdapter {
  status: "unsupported"
  unsupportedReason: string
  visualPropertyKeys: readonly string[]
  sourceVisualProperties: Readonly<Record<string, unknown>>
}

export type BackgroundPaletteAdapter =
  | SupportedBackgroundPaletteAdapter
  | UnsupportedBackgroundPaletteAdapter

export interface BackgroundPaletteModeOverride {
  rendererTarget: string
  sourceValue?: unknown
  customValue?: unknown
}

type RoleTransform = "hex-hue" | "preserve-alpha"
type RoleSpec = readonly [
  id: string,
  label: string,
  sourceSettingKey: string,
  rendererTarget: string,
  transform?: RoleTransform,
  sourceColorOverride?: string,
]
type SupportedSpec = {
  id: string
  family: BackgroundRendererFamily
  prefixes: readonly string[]
  roles: readonly RoleSpec[]
  sourceBehavior?: SupportedBackgroundPaletteAdapter["sourceBehavior"]
  modeOverrides?: readonly BackgroundPaletteModeOverride[]
}
type UnsupportedSpec = {
  id: string
  prefixes?: readonly string[]
  reason?: string
}

const SANITIZED_SOURCE_SETTINGS = sanitizeChimerSettings(DEFAULT_CHIMER_SETTINGS)
const PALETTE_METADATA_SUFFIXES = [
  "PaletteMode",
  "PrimaryColor",
  "Harmony",
  "ControlVersion",
  "WarpSpeedVersion",
]
const FIXED_RENDERER_REASON =
  "This renderer has no meaningful color input, so the shared palette leaves its source rendering unchanged."

const role = (
  id: string,
  label: string,
  sourceSettingKey: string,
  rendererTarget: string,
  transform?: RoleTransform,
  sourceColorOverride?: string,
): RoleSpec => [
  id,
  label,
  sourceSettingKey,
  rendererTarget,
  transform,
  sourceColorOverride,
]

/**
 * Assigns each persisted setting to exactly one renderer namespace. The most
 * specific implementation namespace wins, preventing sibling names such as
 * Plasma/Plasma Wave, Gradient/Gradient Blinds, and Prism/Prismatic Burst from
 * leaking properties into one another.
 */
function visualInventory(
  backgroundId: string,
  prefixes: readonly string[],
  colorKeys: ReadonlySet<string>,
) {
  const visualPropertyKeys = Object.keys(SANITIZED_SOURCE_SETTINGS).filter((key) => (
    SETTING_NAMESPACE_OWNERS
      .filter(({ namespace }) => key.slice(0, namespace.length) === namespace)
      .sort((left, right) => right.namespace.length - left.namespace.length)
      .at(0)?.backgroundId === backgroundId
    && prefixes.some((prefix) => (
      key.slice(0, prefix.length) === prefix
    ))
    && !colorKeys.has(key)
    && !PALETTE_METADATA_SUFFIXES.some((suffix) => key.endsWith(suffix))
  ))
  return {
    visualPropertyKeys,
    sourceVisualProperties: Object.freeze(Object.fromEntries(
      visualPropertyKeys.map((key) => [key, SANITIZED_SOURCE_SETTINGS[key]]),
    )),
  }
}

function pathSegments(path: string) {
  return [...path.matchAll(/([^[.\]]+)|\[(\d+)\]/g)].map((match) => (
    match[2] === undefined ? match[1] : Number(match[2])
  ))
}

function hexHue(value: string) {
  const red = Number.parseInt(value.slice(1, 3), 16) / 255
  const green = Number.parseInt(value.slice(3, 5), 16) / 255
  const blue = Number.parseInt(value.slice(5, 7), 16) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum
  if (delta === 0) return 0
  const sector = maximum === red
    ? ((green - blue) / delta) % 6
    : maximum === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4
  return Math.round((sector * 60 + 360) % 360)
}

function preserveAlpha(color: string, current: unknown) {
  const match = typeof current === "string"
    ? current.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/i)
    : null
  const alpha = match ? Number(match[1]) : 1
  const red = Number.parseInt(color.slice(1, 3), 16)
  const green = Number.parseInt(color.slice(3, 5), 16)
  const blue = Number.parseInt(color.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function setRendererValue(
  props: BackgroundEffectProps,
  target: string,
  value: unknown,
) {
  const result = structuredClone(props) as Record<string, unknown>
  const segments = pathSegments(target)
  let cursor: Record<string | number, unknown> = result
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const nextSegment = segments[index + 1]
    const existing = cursor[segment]
    const next = existing && typeof existing === "object"
      ? structuredClone(existing)
      : typeof nextSegment === "number" ? [] : {}
    cursor[segment] = next
    cursor = next as Record<string | number, unknown>
  }
  cursor[segments.at(-1)!] = structuredClone(value)
  return result as BackgroundEffectProps
}

/**
 * Applies one declared role without mutating caller-owned props. Paths are
 * adapter-owned renderer contracts, including indexed color-array uniforms.
 */
function setRendererTarget(
  props: BackgroundEffectProps,
  target: string,
  color: string,
  transform?: RoleTransform,
) {
  const segments = pathSegments(target)
  let current: unknown = props
  for (const segment of segments) {
    current = current && typeof current === "object"
      ? (current as Record<string | number, unknown>)[segment]
      : undefined
  }
  const value = transform === "hex-hue"
    ? hexHue(color)
    : transform === "preserve-alpha"
      ? preserveAlpha(color, current)
      : color
  return setRendererValue(props, target, value)
}

function roleColor(
  colors: Readonly<Record<string, string>>,
  roleId: string,
  current: string | undefined,
) {
  return typeof colors[roleId] === "string" ? colors[roleId] : current
}

function roleColorArray(
  current: string[] | undefined,
  roleIds: readonly string[],
  colors: Readonly<Record<string, string>>,
) {
  const result = [...(current ?? [])]
  roleIds.forEach((roleId, index) => {
    const nextColor = colors[roleId]
    if (typeof nextColor === "string") {
      result[index] = nextColor
    }
  })
  return result
}

/**
 * Applies CSS/DOM colors through the concrete prop names consumed by each
 * effect. The explicit background and role cases are intentionally verbose:
 * they make palette changes auditable and prevent declaration order or target
 * string parsing from deciding which renderer property receives a color.
 */
export function applyCssDomPaletteRoleColors<
  BackgroundId extends CssDomPaletteBackgroundId,
>(
  backgroundId: BackgroundId,
  props: BackgroundEffectProps & CssDomPaletteEffectPropsById[BackgroundId],
  colors: Readonly<Record<string, string>>,
): BackgroundEffectProps {
  switch (backgroundId) {
    case "massage-lab-moving-gradient":
      return {
        ...props,
        mainColor: roleColor(colors, "main", props.mainColor),
        orbColor: roleColor(colors, "orb", props.orbColor),
      }
    case "massage-lab-aerial-rays":
      return {
        ...props,
        massageLabAerialRays: {
          ...props.massageLabAerialRays,
          backgroundColor: roleColor(
            colors,
            "background",
            props.massageLabAerialRays?.backgroundColor,
          ),
          color: roleColor(colors, "rays", props.massageLabAerialRays?.color),
        },
      }
    case "massage-lab-grid-motion":
      return {
        ...props,
        massageLabGridMotion: {
          ...props.massageLabGridMotion,
          gradientColor: roleColor(
            colors,
            "gradient",
            props.massageLabGridMotion?.gradientColor,
          ),
          tileColor: roleColor(colors, "tile", props.massageLabGridMotion?.tileColor),
          textColor: roleColor(colors, "text", props.massageLabGridMotion?.textColor),
        },
      }
    case "massage-lab-gradient-animation":
      return {
        ...props,
        gradientAnimation: {
          ...props.gradientAnimation,
          backgroundStartColor: roleColor(
            colors,
            "backdrop-start",
            props.gradientAnimation?.backgroundStartColor,
          ),
          backgroundEndColor: roleColor(
            colors,
            "backdrop-end",
            props.gradientAnimation?.backgroundEndColor,
          ),
          firstColor: roleColor(colors, "gradient-1", props.gradientAnimation?.firstColor),
          secondColor: roleColor(colors, "gradient-2", props.gradientAnimation?.secondColor),
          thirdColor: roleColor(colors, "gradient-3", props.gradientAnimation?.thirdColor),
          fourthColor: roleColor(colors, "gradient-4", props.gradientAnimation?.fourthColor),
          fifthColor: roleColor(colors, "gradient-5", props.gradientAnimation?.fifthColor),
        },
      }
    case "massage-lab-shooting-stars":
      return {
        ...props,
        shootingStars: {
          ...props.shootingStars,
          starColor: roleColor(colors, "stars", props.shootingStars?.starColor),
          trailColor: roleColor(colors, "trails", props.shootingStars?.trailColor),
          shootingStarColor: roleColor(
            colors,
            "shooting-stars",
            props.shootingStars?.shootingStarColor,
          ),
        },
      }
    case "massage-lab-spotlight":
      return {
        ...props,
        spotlight: {
          ...props.spotlight,
          color: roleColor(colors, "spotlight", props.spotlight?.color),
        },
      }
    case "massage-lab-lamp-effect":
      return {
        ...props,
        lamp: {
          ...props.lamp,
          backgroundColor: roleColor(colors, "background", props.lamp?.backgroundColor),
          color: roleColor(colors, "lamp", props.lamp?.color),
        },
      }
    case "massage-lab-aurora-bars":
      return {
        ...props,
        auroraBars: {
          ...props.auroraBars,
          background: roleColor(colors, "background", props.auroraBars?.background),
          colors: roleColorArray(
            props.auroraBars?.colors,
            ["bar-1", "bar-2", "bar-3", "bar-4", "bar-5"],
            colors,
          ),
        },
      }
    case "massage-lab-gradient":
      return {
        ...props,
        massageLabGradient: {
          ...props.massageLabGradient,
          primaryColor: roleColor(
            colors,
            "primary",
            props.massageLabGradient?.primaryColor,
          ),
        },
      }
    case "massage-lab-stars":
      return {
        ...props,
        massageLabStars: {
          ...props.massageLabStars,
          starColor: roleColor(colors, "stars", props.massageLabStars?.starColor),
        },
      }
  }

  return props
}

function supported(spec: SupportedSpec): SupportedBackgroundPaletteAdapter {
  const colorKeys = new Set(spec.roles.map((entry) => entry[2]))
  const inventory = visualInventory(spec.id, spec.prefixes, colorKeys)
  const roles = spec.roles.map(([
    id,
    label,
    sourceSettingKey,
    rendererTarget,
    ,
    sourceColorOverride,
  ], index) => ({
    id,
    label,
    sourceSettingKey,
    sourceColor: sourceColorOverride
      ?? String(SANITIZED_SOURCE_SETTINGS[sourceSettingKey]),
    defaultSwatch: (index % 7) as BackgroundPaletteRole["defaultSwatch"],
    rendererTarget,
  }))
  return Object.freeze({
    status: "supported",
    rendererFamily: spec.family,
    roles: Object.freeze(roles),
    ...(spec.sourceBehavior ? { sourceBehavior: spec.sourceBehavior } : {}),
    ...(spec.modeOverrides
      ? { modeOverrides: Object.freeze(spec.modeOverrides.map((override) => Object.freeze(override))) }
      : {}),
    ...inventory,
    applyRoleColors(
      props: BackgroundEffectProps,
      colors: Readonly<Record<string, string>>,
      mode?: EffectiveBackgroundPaletteMode,
    ) {
      const withColors = spec.family === "css-dom"
        ? applyCssDomPaletteRoleColors(
          spec.id as CssDomPaletteBackgroundId,
          props,
          colors,
        )
        : spec.roles.reduce((next, [id, , , target, transform]) => (
          typeof colors[id] === "string"
            ? setRendererTarget(next, target, colors[id], transform)
            : next
        ), props)

      if (!mode || !spec.modeOverrides) {
        return withColors
      }

      return spec.modeOverrides.reduce((next, override) => {
        const valueKey = mode === "source" ? "sourceValue" : "customValue"
        return Object.hasOwn(override, valueKey)
          ? setRendererValue(next, override.rendererTarget, override[valueKey])
          : next
      }, withColors)
    },
  })
}

function unsupported(spec: UnsupportedSpec): UnsupportedBackgroundPaletteAdapter {
  return Object.freeze({
    status: "unsupported",
    unsupportedReason: spec.reason ?? FIXED_RENDERER_REASON,
    ...visualInventory(spec.id, spec.prefixes ?? [], new Set()),
  })
}

const SUPPORTED_SPECS: readonly SupportedSpec[] = [
  { id: "massage-lab-moving-gradient", family: "css-dom", prefixes: ["movingBackground"], roles: [role("main", "Main light", "movingBackgroundMainColor", "mainColor"), role("orb", "Orb light", "movingBackgroundOrbColor", "orbColor")] },
  { id: "massage-lab-retro-grid", family: "webgl", prefixes: ["massageLabRetroGrid"], roles: [role("background", "Background", "massageLabRetroGridBackgroundColor", "massageLabRetroGrid.backgroundColor"), role("light-lines", "Light grid lines", "massageLabRetroGridLightLineColor", "massageLabRetroGrid.lightLineColor"), role("dark-lines", "Dark grid lines", "massageLabRetroGridDarkLineColor", "massageLabRetroGrid.darkLineColor")] },
  { id: "massage-lab-aerial-rays", family: "css-dom", prefixes: ["massageLabAerialRays"], roles: [role("background", "Background", "massageLabAerialRaysBackgroundColor", "massageLabAerialRays.backgroundColor"), role("rays", "Rays", "massageLabAerialRaysColor", "massageLabAerialRays.color")] },
  { id: "massage-lab-wave-current", family: "webgl", prefixes: ["massageLabWaveCurrent"], roles: [role("background", "Background", "massageLabWaveCurrentBackgroundColor", "massageLabWaveCurrent.backgroundColor"), role("wave-1", "Wave 1", "massageLabWaveCurrentColorOne", "massageLabWaveCurrent.waveColor1"), role("wave-2", "Wave 2", "massageLabWaveCurrentColorTwo", "massageLabWaveCurrent.waveColor2"), role("wave-3", "Wave 3", "massageLabWaveCurrentColorThree", "massageLabWaveCurrent.waveColor3")] },
  { id: "massage-lab-electric-mist", family: "webgl", prefixes: ["massageLabElectricMist"], roles: [role("mist", "Mist", "massageLabElectricMistColor", "massageLabElectricMist.color")] },
  { id: "massage-lab-astral-flow", family: "webgl", prefixes: ["massageLabAstralFlow"], roles: [role("space", "Deep space", "massageLabAstralFlowColorOne", "massageLabAstralFlow.color1"), role("flow", "Flow", "massageLabAstralFlowColorTwo", "massageLabAstralFlow.color2"), role("highlight", "Highlight", "massageLabAstralFlowColorThree", "massageLabAstralFlow.color3")] },
  { id: "massage-lab-deep-space-nebula", family: "webgl", prefixes: ["massageLabDeepSpaceNebula"], roles: [role("glow", "Nebula glow", "massageLabDeepSpaceNebulaColorOne", "massageLabDeepSpaceNebula.color1"), role("cloud", "Nebula cloud", "massageLabDeepSpaceNebulaColorTwo", "massageLabDeepSpaceNebula.color2"), role("space", "Deep space", "massageLabDeepSpaceNebulaColorThree", "massageLabDeepSpaceNebula.color3")] },
  { id: "massage-lab-grid-bloom", family: "webgl", prefixes: ["massageLabGridBloom"], roles: [role("bloom", "Grid bloom", "massageLabGridBloomColor", "massageLabGridBloom.color")] },
  { id: "massage-lab-chrome-flow", family: "webgl", prefixes: ["massageLabChromeFlow"], roles: [role("chrome-light", "Chrome light", "massageLabChromeFlowColorOne", "massageLabChromeFlow.color"), role("chrome-shadow", "Chrome shadow", "massageLabChromeFlowColorTwo", "massageLabChromeFlow.color2")] },
  { id: "massage-lab-light-speed", family: "canvas", prefixes: ["massageLabLightSpeed"], roles: [role("light", "Warp light", "massageLabLightSpeedLightColor", "massageLabLightSpeed.lightColor")] },
  { id: "massage-lab-ferrofluid", family: "webgl", prefixes: ["massageLabFerrofluid"], roles: [role("fluid-1", "Fluid 1", "massageLabFerrofluidColorOne", "massageLabFerrofluid.colors[0]"), role("fluid-2", "Fluid 2", "massageLabFerrofluidColorTwo", "massageLabFerrofluid.colors[1]"), role("fluid-3", "Fluid 3", "massageLabFerrofluidColorThree", "massageLabFerrofluid.colors[2]")] },
  { id: "massage-lab-lightfall", family: "webgl", prefixes: ["massageLabLightfall"], roles: [role("streak-1", "Streak 1", "massageLabLightfallColorOne", "massageLabLightfall.colors[0]"), role("streak-2", "Streak 2", "massageLabLightfallColorTwo", "massageLabLightfall.colors[1]"), role("streak-3", "Streak 3", "massageLabLightfallColorThree", "massageLabLightfall.colors[2]"), role("background", "Background", "massageLabLightfallBackgroundColor", "massageLabLightfall.backgroundColor")] },
  { id: "massage-lab-liquid-ether", family: "webgl", prefixes: ["massageLabLiquidEther"], roles: [role("fluid-1", "Fluid 1", "massageLabLiquidEtherColorOne", "massageLabLiquidEther.colors[0]"), role("fluid-2", "Fluid 2", "massageLabLiquidEtherColorTwo", "massageLabLiquidEther.colors[1]"), role("fluid-3", "Fluid 3", "massageLabLiquidEtherColorThree", "massageLabLiquidEther.colors[2]")] },
  { id: "massage-lab-light-pillar", family: "webgl", prefixes: ["massageLabLightPillar"], roles: [role("top", "Pillar top", "massageLabLightPillarTopColor", "massageLabLightPillar.topColor"), role("bottom", "Pillar bottom", "massageLabLightPillarBottomColor", "massageLabLightPillar.bottomColor")] },
  { id: "massage-lab-silk", family: "webgl", prefixes: ["massageLabSilk"], roles: [role("silk", "Silk", "massageLabSilkColor", "massageLabSilk.color")] },
  { id: "massage-lab-floating-lines", family: "webgl", prefixes: ["massageLabFloatingLines"], roles: [role("line-1", "Line 1", "massageLabFloatingLinesColorOne", "massageLabFloatingLines.linesGradient[0]"), role("line-2", "Line 2", "massageLabFloatingLinesColorTwo", "massageLabFloatingLines.linesGradient[1]"), role("line-3", "Line 3", "massageLabFloatingLinesColorThree", "massageLabFloatingLines.linesGradient[2]")] },
  { id: "massage-lab-side-rays", family: "webgl", prefixes: ["massageLabSideRays"], roles: [role("ray-1", "Ray 1", "massageLabSideRaysColorOne", "massageLabSideRays.rayColor1"), role("ray-2", "Ray 2", "massageLabSideRaysColorTwo", "massageLabSideRays.rayColor2")] },
  { id: "massage-lab-light-rays", family: "webgl", prefixes: ["massageLabLightRays"], roles: [role("rays", "Light rays", "massageLabLightRaysColor", "massageLabLightRays.raysColor")] },
  { id: "massage-lab-pixel-blast", family: "webgl", prefixes: ["massageLabPixelBlast"], roles: [role("pixels", "Pixels", "massageLabPixelBlastColor", "massageLabPixelBlast.color")] },
  { id: "massage-lab-color-bends", family: "webgl", prefixes: ["massageLabColorBends"], roles: [role("band-1", "Band 1", "massageLabColorBendsColorOne", "massageLabColorBends.colors[0]"), role("band-2", "Band 2", "massageLabColorBendsColorTwo", "massageLabColorBends.colors[1]"), role("band-3", "Band 3", "massageLabColorBendsColorThree", "massageLabColorBends.colors[2]"), role("background", "Background", "massageLabColorBendsColorFour", "massageLabColorBends.colors[3]")] },
  { id: "massage-lab-evil-eye", family: "webgl", prefixes: ["massageLabEvilEye"], roles: [role("eye", "Eye", "massageLabEvilEyeColor", "massageLabEvilEye.eyeColor"), role("background", "Background", "massageLabEvilEyeBackgroundColor", "massageLabEvilEye.backgroundColor")] },
  { id: "massage-lab-line-waves", family: "webgl", prefixes: ["massageLabLineWaves"], roles: [role("line-1", "Line 1", "massageLabLineWavesColorOne", "massageLabLineWaves.color1"), role("line-2", "Line 2", "massageLabLineWavesColorTwo", "massageLabLineWaves.color2"), role("line-3", "Line 3", "massageLabLineWavesColorThree", "massageLabLineWaves.color3")] },
  { id: "massage-lab-radar", family: "webgl", prefixes: ["massageLabRadar"], roles: [role("radar", "Radar", "massageLabRadarColor", "massageLabRadar.color"), role("background", "Background", "massageLabRadarBackgroundColor", "massageLabRadar.backgroundColor")] },
  { id: "massage-lab-soft-aurora", family: "webgl", prefixes: ["massageLabSoftAurora"], roles: [role("aurora-light", "Aurora light", "massageLabSoftAuroraColorOne", "massageLabSoftAurora.color1"), role("aurora-color", "Aurora color", "massageLabSoftAuroraColorTwo", "massageLabSoftAurora.color2")] },
  { id: "massage-lab-plasma", family: "webgl", prefixes: ["massageLabPlasma"], roles: [role("plasma", "Plasma", "massageLabPlasmaColor", "massageLabPlasma.color")] },
  { id: "massage-lab-plasma-wave", family: "webgl", prefixes: ["massageLabPlasmaWave"], roles: [role("plasma-1", "Plasma 1", "massageLabPlasmaWaveColorOne", "massageLabPlasmaWave.colors[0]"), role("plasma-2", "Plasma 2", "massageLabPlasmaWaveColorTwo", "massageLabPlasmaWave.colors[1]")] },
  { id: "massage-lab-particles", family: "webgl", prefixes: ["massageLabParticles"], roles: [role("particle-1", "Particle 1", "massageLabParticlesColorOne", "massageLabParticles.colors[0]"), role("particle-2", "Particle 2", "massageLabParticlesColorTwo", "massageLabParticles.colors[1]"), role("particle-3", "Particle 3", "massageLabParticlesColorThree", "massageLabParticles.colors[2]")] },
  { id: "massage-lab-gradient-blinds", family: "webgl", prefixes: ["massageLabGradientBlinds"], roles: [role("gradient-1", "Gradient 1", "massageLabGradientBlindsColorOne", "massageLabGradientBlinds.gradientColors[0]"), role("gradient-2", "Gradient 2", "massageLabGradientBlindsColorTwo", "massageLabGradientBlinds.gradientColors[1]")] },
  { id: "massage-lab-grainient", family: "webgl", prefixes: ["massageLabGrainient"], roles: [role("gradient-1", "Gradient 1", "massageLabGrainientColorOne", "massageLabGrainient.color1"), role("gradient-2", "Gradient 2", "massageLabGrainientColorTwo", "massageLabGrainient.color2"), role("gradient-3", "Gradient 3", "massageLabGrainientColorThree", "massageLabGrainient.color3")] },
  { id: "massage-lab-grid-scan", family: "webgl", prefixes: ["massageLabGridScan"], roles: [role("grid", "Grid lines", "massageLabGridScanLinesColor", "massageLabGridScan.linesColor"), role("scan", "Scan", "massageLabGridScanScanColor", "massageLabGridScan.scanColor")] },
  { id: "massage-lab-synthesis", family: "webgl", prefixes: ["massageLabSynthesis"], roles: [role("field-1", "Field 1", "massageLabSynthesisColorOne", "massageLabSynthesis.color1"), role("field-2", "Field 2", "massageLabSynthesisColorTwo", "massageLabSynthesis.color2"), role("field-3", "Field 3", "massageLabSynthesisColorThree", "massageLabSynthesis.color3")] },
  { id: "massage-lab-beams", family: "webgl", prefixes: ["massageLabBeams"], roles: [role("light", "Beam light", "massageLabBeamsLightColor", "massageLabBeams.lightColor")] },
  { id: "massage-lab-pixel-snow", family: "webgl", prefixes: ["massageLabPixelSnow"], roles: [role("snow", "Snow", "massageLabPixelSnowColor", "massageLabPixelSnow.color")] },
  { id: "massage-lab-lightning", family: "webgl", prefixes: ["massageLabLightning"], roles: [role("lightning", "Lightning", "massageLabLightningColor", "massageLabLightning.hue", "hex-hue")] },
  {
    id: "massage-lab-prismatic-burst",
    family: "webgl",
    prefixes: ["massageLabPrismaticBurst"],
    roles: [role("ray-1", "Ray 1", "massageLabPrismaticBurstColorOne", "massageLabPrismaticBurst.colors[0]"), role("ray-2", "Ray 2", "massageLabPrismaticBurstColorTwo", "massageLabPrismaticBurst.colors[1]"), role("ray-3", "Ray 3", "massageLabPrismaticBurstColorThree", "massageLabPrismaticBurst.colors[2]"), role("ray-4", "Ray 4", "massageLabPrismaticBurstColorFour", "massageLabPrismaticBurst.colors[3]")],
    // An empty color array is the shader's spectral Source sentinel.
    modeOverrides: [{ rendererTarget: "massageLabPrismaticBurst.colors", sourceValue: [] }],
  },
  {
    id: "massage-lab-galaxy",
    family: "webgl",
    prefixes: ["massageLabGalaxy"],
    // The renderer's source hue is 140; #00FF55 round-trips to that exact uniform.
    roles: [role("stars", "Stars", "massageLabGalaxyColor", "massageLabGalaxy.hueShift", "hex-hue", "#00FF55")],
  },
  { id: "massage-lab-dither", family: "webgl", prefixes: ["massageLabDither"], roles: [role("wave", "Wave", "massageLabDitherColor", "massageLabDither.color")] },
  { id: "massage-lab-faulty-terminal", family: "webgl", prefixes: ["massageLabFaultyTerminal"], roles: [role("tint", "Terminal tint", "massageLabFaultyTerminalTint", "massageLabFaultyTerminal.tint")] },
  {
    id: "massage-lab-ripple-grid",
    family: "webgl",
    prefixes: ["massageLabRippleGrid"],
    sourceBehavior: "rainbow",
    roles: [role("grid", "Grid", "massageLabRippleGridColor", "massageLabRippleGrid.gridColor")],
    // Source preserves the existing/default rainbow choice; mapped colors must disable it.
    modeOverrides: [{ rendererTarget: "massageLabRippleGrid.enableRainbow", customValue: false }],
  },
  {
    id: "massage-lab-dot-field",
    family: "canvas",
    prefixes: ["massageLabDotField"],
    roles: [
      role("gradient-start", "Gradient start", "massageLabDotFieldGradientFromColor", "massageLabDotField.gradientFrom", "preserve-alpha"),
      role("gradient-end", "Gradient end", "massageLabDotFieldGradientToColor", "massageLabDotField.gradientTo", "preserve-alpha"),
      role("glow", "Glow", "massageLabDotFieldGlowColor", "massageLabDotField.glowColor"),
    ],
  },
  { id: "massage-lab-dot-grid", family: "canvas", prefixes: ["massageLabDotGrid"], roles: [role("base", "Base dots", "massageLabDotGridBaseColor", "massageLabDotGrid.baseColor"), role("active", "Active dots", "massageLabDotGridActiveColor", "massageLabDotGrid.activeColor")] },
  { id: "massage-lab-threads", family: "webgl", prefixes: ["massageLabThreads"], roles: [role("threads", "Threads", "massageLabThreadsColor", "massageLabThreads.color")] },
  { id: "massage-lab-iridescence", family: "webgl", prefixes: ["massageLabIridescence"], roles: [role("tint", "Iridescent tint", "massageLabIridescenceColor", "massageLabIridescence.color")] },
  { id: "massage-lab-waves", family: "canvas", prefixes: ["massageLabWaves"], roles: [role("lines", "Wave lines", "massageLabWavesLineColor", "massageLabWaves.lineColor"), role("background", "Background", "massageLabWavesBackgroundColor", "massageLabWaves.backgroundColor")] },
  { id: "massage-lab-grid-distortion", family: "webgl", prefixes: ["massageLabGridDistortion"], roles: [role("texture-1", "Texture 1", "massageLabGridDistortionColorOne", "massageLabGridDistortion.colorOne"), role("texture-2", "Texture 2", "massageLabGridDistortionColorTwo", "massageLabGridDistortion.colorTwo"), role("texture-3", "Texture 3", "massageLabGridDistortionColorThree", "massageLabGridDistortion.colorThree")] },
  {
    id: "massage-lab-orb",
    family: "webgl",
    prefixes: ["massageLabOrb"],
    // The renderer's source hue is 0; #FF0000 round-trips to that exact uniform.
    roles: [role("orb", "Orb", "massageLabOrbColor", "massageLabOrb.hue", "hex-hue", "#FF0000"), role("background", "Background", "massageLabOrbBackgroundColor", "massageLabOrb.backgroundColor")],
  },
  { id: "massage-lab-letter-glitch", family: "canvas", prefixes: ["massageLabLetterGlitch"], roles: [role("glyph-1", "Glyph 1", "massageLabLetterGlitchColorOne", "massageLabLetterGlitch.colorOne"), role("glyph-2", "Glyph 2", "massageLabLetterGlitchColorTwo", "massageLabLetterGlitch.colorTwo"), role("glyph-3", "Glyph 3", "massageLabLetterGlitchColorThree", "massageLabLetterGlitch.colorThree")] },
  { id: "massage-lab-grid-motion", family: "css-dom", prefixes: ["massageLabGridMotion"], roles: [role("gradient", "Gradient", "massageLabGridMotionGradientColor", "massageLabGridMotion.gradientColor"), role("tile", "Tile", "massageLabGridMotionTileColor", "massageLabGridMotion.tileColor"), role("text", "Text", "massageLabGridMotionTextColor", "massageLabGridMotion.textColor")] },
  { id: "massage-lab-shape-grid", family: "canvas", prefixes: ["massageLabShapeGrid"], roles: [role("border", "Shape border", "massageLabShapeGridBorderColor", "massageLabShapeGrid.borderColor"), role("hover", "Hover fill", "massageLabShapeGridHoverFillColor", "massageLabShapeGrid.hoverFillColor")] },
  { id: "massage-lab-liquid-chrome", family: "webgl", prefixes: ["massageLabLiquidChrome"], roles: [role("chrome", "Chrome", "massageLabLiquidChromeBaseColor", "massageLabLiquidChrome.baseColor")] },
  { id: "massage-lab-balatro", family: "webgl", prefixes: ["massageLabBalatro"], roles: [role("field-1", "Field 1", "massageLabBalatroColorOne", "massageLabBalatro.color1"), role("field-2", "Field 2", "massageLabBalatroColorTwo", "massageLabBalatro.color2"), role("field-3", "Field 3", "massageLabBalatroColorThree", "massageLabBalatro.color3")] },
  { id: "massage-lab-novatrix", family: "webgl", prefixes: ["massageLabNovatrix"], roles: [role("field", "Field", "massageLabNovatrixColor", "massageLabNovatrix.color")] },
  { id: "massage-lab-matrix-rain", family: "canvas", prefixes: ["massageLabMatrixRain"], roles: [role("glyphs", "Glyphs", "massageLabMatrixRainColor", "massageLabMatrixRain.color")] },
  { id: "massage-lab-photon-beam", family: "canvas", prefixes: ["massageLabPhotonBeam"], roles: [role("background", "Background", "massageLabPhotonBeamColorBg", "massageLabPhotonBeam.colorBg"), role("lines", "Beam lines", "massageLabPhotonBeamColorLine", "massageLabPhotonBeam.colorLine"), role("signal-1", "Signal 1", "massageLabPhotonBeamColorSignal", "massageLabPhotonBeam.colorSignal"), role("signal-2", "Signal 2", "massageLabPhotonBeamColorSignal2", "massageLabPhotonBeam.colorSignal2"), role("signal-3", "Signal 3", "massageLabPhotonBeamColorSignal3", "massageLabPhotonBeam.colorSignal3")] },
  { id: "massage-lab-sparkles", family: "canvas", prefixes: ["sparkles"], roles: [role("particles", "Particles", "sparklesParticleColor", "sparkles.particleColor")] },
  { id: "massage-lab-gradient-animation", family: "css-dom", prefixes: ["gradientAnimation"], roles: [role("backdrop-start", "Backdrop start", "gradientAnimationBackgroundStartColor", "gradientAnimation.backgroundStartColor"), role("backdrop-end", "Backdrop end", "gradientAnimationBackgroundEndColor", "gradientAnimation.backgroundEndColor"), role("gradient-1", "Gradient 1", "gradientAnimationFirstColor", "gradientAnimation.firstColor"), role("gradient-2", "Gradient 2", "gradientAnimationSecondColor", "gradientAnimation.secondColor"), role("gradient-3", "Gradient 3", "gradientAnimationThirdColor", "gradientAnimation.thirdColor"), role("gradient-4", "Gradient 4", "gradientAnimationFourthColor", "gradientAnimation.fourthColor"), role("gradient-5", "Gradient 5", "gradientAnimationFifthColor", "gradientAnimation.fifthColor")] },
  { id: "massage-lab-shooting-stars", family: "css-dom", prefixes: ["shootingStars"], roles: [role("stars", "Stars", "shootingStarsStarColor", "shootingStars.starColor"), role("trails", "Trails", "shootingStarsTrailColor", "shootingStars.trailColor"), role("shooting-stars", "Shooting stars", "shootingStarsShootingStarColor", "shootingStars.shootingStarColor")] },
  { id: "massage-lab-reveal-dots", family: "canvas", prefixes: ["canvasRevealDots"], roles: [role("background", "Background", "canvasRevealDotsBackgroundColor", "canvasRevealDots.backgroundColor"), role("dots", "Dots", "canvasRevealDotsDotColor", "canvasRevealDots.dotColor"), role("accent", "Accent", "canvasRevealDotsAccentColor", "canvasRevealDots.accentColor")] },
  { id: "massage-lab-3d-globe", family: "webgl", prefixes: ["massageLab3DGlobe"], roles: [role("background", "Background", "massageLab3DGlobeBackgroundColor", "massageLab3DGlobe.backgroundColor"), role("globe", "Globe", "massageLab3DGlobeGlobeColor", "massageLab3DGlobe.globeColor"), role("map", "Map", "massageLab3DGlobeGraphicMapColor", "massageLab3DGlobe.graphicMapColor"), role("map-glow", "Map glow", "massageLab3DGlobeGraphicGlowColor", "massageLab3DGlobe.graphicGlowColor"), role("marker", "Marker", "massageLab3DGlobeGraphicMarkerColor", "massageLab3DGlobe.graphicMarkerColor"), role("atmosphere", "Atmosphere", "massageLab3DGlobeAtmosphereColor", "massageLab3DGlobe.atmosphereColor"), role("wireframe", "Wireframe", "massageLab3DGlobeWireframeColor", "massageLab3DGlobe.wireframeColor")] },
  { id: "massage-lab-spotlight", family: "css-dom", prefixes: ["spotlight"], roles: [role("spotlight", "Spotlight", "spotlightColor", "spotlight.color")] },
  { id: "massage-lab-lamp-effect", family: "css-dom", prefixes: ["lamp"], roles: [role("background", "Background", "lampBackgroundColor", "lamp.backgroundColor"), role("lamp", "Lamp", "lampColor", "lamp.color")] },
  { id: "massage-lab-wavy-background", family: "canvas", prefixes: ["wavy"], roles: [role("background", "Background", "wavyBackgroundFill", "wavy.backgroundFill"), role("wave-1", "Wave 1", "wavyColorOne", "wavy.colors[0]"), role("wave-2", "Wave 2", "wavyColorTwo", "wavy.colors[1]"), role("wave-3", "Wave 3", "wavyColorThree", "wavy.colors[2]"), role("wave-4", "Wave 4", "wavyColorFour", "wavy.colors[3]"), role("wave-5", "Wave 5", "wavyColorFive", "wavy.colors[4]")] },
  {
    id: "massage-lab-vortex",
    family: "canvas",
    prefixes: ["vortex"],
    roles: [
      role("background", "Background", "vortexBackgroundColor", "vortex.backgroundColor"),
      // Source strokes are hsla(220, 100%, 60%); #3377FF is that exact opaque HSL color.
      role("particles", "Particles", "vortexBaseHue", "vortex.baseHue", "hex-hue", "#3377FF"),
    ],
  },
  { id: "massage-lab-pixel-liquid", family: "canvas", prefixes: ["pixelLiquid"], roles: [role("background", "Background", "pixelLiquidBackgroundColor", "pixelLiquid.backgroundColor"), role("base", "Base", "pixelLiquidBaseColor", "pixelLiquid.baseColor"), role("accent", "Accent", "pixelLiquidAccentColor", "pixelLiquid.accentColor"), role("highlight", "Highlight", "pixelLiquidHighlightColor", "pixelLiquid.highlightColor")] },
  {
    id: "massage-lab-tile-grid",
    family: "canvas",
    prefixes: ["tileGrid"],
    sourceBehavior: "automatic",
    roles: [role("tile-1", "Tile 1", "tileGridColorOne", "tileGrid.colors[0]"), role("tile-2", "Tile 2", "tileGridColorTwo", "tileGrid.colors[1]"), role("tile-3", "Tile 3", "tileGridColorThree", "tileGrid.colors[2]"), role("tile-4", "Tile 4", "tileGridColorFour", "tileGrid.colors[3]"), role("tile-5", "Tile 5", "tileGridColorFive", "tileGrid.colors[4]")],
    modeOverrides: [{ rendererTarget: "tileGrid.paletteMode", sourceValue: "auto", customValue: "custom" }],
  },
  { id: "massage-lab-hex-grid", family: "canvas", prefixes: ["hexGrid"], roles: [role("hexes", "Hexes", "hexGridPrimaryColor", "hexGrid.primaryColor")] },
  {
    id: "massage-lab-aurora-bars",
    family: "css-dom",
    prefixes: ["auroraBars"],
    sourceBehavior: "automatic",
    roles: [role("background", "Background", "auroraBarsBackgroundColor", "auroraBars.background"), role("bar-1", "Bar 1", "auroraBarsColorOne", "auroraBars.colors[0]"), role("bar-2", "Bar 2", "auroraBarsColorTwo", "auroraBars.colors[1]"), role("bar-3", "Bar 3", "auroraBarsColorThree", "auroraBars.colors[2]"), role("bar-4", "Bar 4", "auroraBarsColorFour", "auroraBars.colors[3]"), role("bar-5", "Bar 5", "auroraBarsColorFive", "auroraBars.colors[4]")],
    modeOverrides: [{ rendererTarget: "auroraBars.paletteMode", sourceValue: "auto", customValue: "custom" }],
  },
  { id: "massage-lab-gradient", family: "css-dom", prefixes: ["massageLabGradient"], roles: [role("primary", "Gradient primary", "massageLabGradientPrimaryColor", "massageLabGradient.primaryColor")] },
  { id: "massage-lab-stars", family: "css-dom", prefixes: ["massageLabStars"], roles: [role("stars", "Stars", "massageLabStarsColor", "massageLabStars.starColor")] },
  { id: "massage-lab-hole", family: "canvas", prefixes: ["massageLabHole"], roles: [role("strokes", "Strokes", "massageLabHoleStrokeColor", "massageLabHole.strokeColor"), role("particles", "Particles", "massageLabHoleParticleColor", "massageLabHole.particleColor")] },
]

const UNSUPPORTED_SPECS: readonly UnsupportedSpec[] = [
  { id: "static-gradient" },
  { id: "massage-lab-prism", prefixes: ["massageLabPrism"], reason: "Prism exposes spectral and hue controls rather than a concrete color target, so its source rendering remains unchanged during adapter migration." },
  { id: "massage-lab-dark-veil", prefixes: ["massageLabDarkVeil"], reason: "Dark Veil exposes a hue shift rather than a concrete color target, so its source rendering remains unchanged during adapter migration." },
  { id: "massage-lab-aurora" },
  { id: "massage-lab-dotted-glow" },
  { id: "massage-lab-background-beams" },
  { id: "massage-lab-collision-beams" },
  { id: "massage-lab-background-lines", prefixes: ["backgroundLines"] },
  { id: "massage-lab-glowing-stars" },
  { id: "massage-lab-meteors" },
  { id: "massage-lab-bubble" },
]

const SETTING_NAMESPACE_OWNERS = Object.freeze([
  ...SUPPORTED_SPECS,
  ...UNSUPPORTED_SPECS,
].flatMap((spec) => (spec.prefixes ?? []).map((namespace) => ({
  backgroundId: spec.id,
  namespace,
}))))

/**
 * Complete migration-time source ledger. Every color-capable renderer exposes
 * an immutable adapter, while unsupported renderers explicitly retain their
 * original output. Production routing remains deferred to the atomic cutover.
 */
export const backgroundPaletteRegistry: Readonly<Record<string, BackgroundPaletteAdapter>> =
  Object.freeze(Object.fromEntries([
    ...SUPPORTED_SPECS.map((spec) => [spec.id, supported(spec)] as const),
    ...UNSUPPORTED_SPECS.map((spec) => [spec.id, unsupported(spec)] as const),
  ]))

/**
 * Dependency-injected persistence authority used by Chimer/account JSON
 * sanitizers. Keeping these lookups beside the adapter ledger prevents
 * component code and plain-JavaScript persistence helpers from guessing which
 * visual keys or color-role IDs belong to a background.
 */
export const backgroundPreferenceNormalizationOptions = Object.freeze({
  isKnownBackgroundId: (backgroundId: string) => (
    Object.hasOwn(backgroundPaletteRegistry, backgroundId)
  ),
  getVisualPropertyKeys: (backgroundId: string) => (
    backgroundPaletteRegistry[backgroundId]?.visualPropertyKeys ?? null
  ),
  getColorRoleIds: (backgroundId: string) => {
    const adapter = backgroundPaletteRegistry[backgroundId]
    return adapter?.status === "supported"
      ? adapter.roles.map((roleDefinition) => roleDefinition.id)
      : []
  },
})
