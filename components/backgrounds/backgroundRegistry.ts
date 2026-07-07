import type { CSSProperties, ComponentType } from "react"
import { DEFAULT_BACKGROUND_ID } from "../../lib/background-options.js"
import { hasPremiumBackgroundAccess } from "../../lib/membership.js"
import { backgroundPreviewManifest } from "./backgroundPreviewManifest.ts"
import type { BackgroundPreviewManifestEntry } from "./backgroundPreviewManifest.ts"
import type { BackgroundEffectProps } from "./effects/css-backgrounds"

export type BackgroundId =
  | "massage-lab-moving-gradient"
  | "static-gradient"
  | "massage-lab-particles-draft"
  | "massage-lab-noise-texture-draft"
  | "massage-lab-grid-pattern-draft"
  | "massage-lab-animated-grid-draft"
  | "massage-lab-retro-grid"
  | "massage-lab-aerial-rays"
  | "massage-lab-wave-current"
  | "massage-lab-electric-mist"
  | "massage-lab-astral-flow"
  | "massage-lab-deep-space-nebula"
  | "massage-lab-grid-bloom"
  | "massage-lab-chrome-flow"
  | "massage-lab-light-speed"
  | "massage-lab-synthesis"
  | "massage-lab-ferrofluid"
  | "massage-lab-lightfall"
  | "massage-lab-liquid-ether"
  | "massage-lab-prism"
  | "massage-lab-dark-veil"
  | "massage-lab-light-pillar"
  | "massage-lab-silk"
  | "massage-lab-floating-lines"
  | "massage-lab-side-rays"
  | "massage-lab-light-rays"
  | "massage-lab-pixel-blast"
  | "massage-lab-color-bends"
  | "massage-lab-evil-eye"
  | "massage-lab-line-waves"
  | "massage-lab-radar"
  | "massage-lab-soft-aurora"
  | "massage-lab-plasma"
  | "massage-lab-plasma-wave"
  | "massage-lab-particles"
  | "massage-lab-gradient-blinds"
  | "massage-lab-grainient"
  | "massage-lab-grid-scan"
  | "massage-lab-beams"
  | "massage-lab-pixel-snow"
  | "massage-lab-lightning"
  | "massage-lab-prismatic-burst"
  | "massage-lab-galaxy"
  | "massage-lab-dither"
  | "massage-lab-faulty-terminal"
  | "massage-lab-ripple-grid"
  | "massage-lab-dot-field"
  | "massage-lab-dot-grid"
  | "massage-lab-threads"
  | "massage-lab-iridescence"
  | "massage-lab-waves"
  | "massage-lab-grid-distortion"
  | "massage-lab-orb"
  | "massage-lab-letter-glitch"
  | "massage-lab-grid-motion"
  | "massage-lab-shape-grid"
  | "massage-lab-liquid-chrome"
  | "massage-lab-balatro"
  | "massage-lab-novatrix"
  | "massage-lab-matrix-rain"
  | "massage-lab-photon-beam"
  | "massage-lab-3d-globe"
  | "massage-lab-aurora"
  | "massage-lab-dotted-glow"
  | "massage-lab-sparkles"
  | "massage-lab-gradient-animation"
  | "massage-lab-background-beams"
  | "massage-lab-collision-beams"
  | "massage-lab-background-lines"
  | "massage-lab-glowing-stars"
  | "massage-lab-meteors"
  | "massage-lab-shooting-stars"
  | "massage-lab-reveal-dots"
  | "massage-lab-spotlight"
  | "massage-lab-lamp-effect"
  | "massage-lab-vortex"
  | "massage-lab-wavy-background"
  | "massage-lab-pixel-liquid"
  | "massage-lab-tile-grid"
  | "massage-lab-hex-grid"
  | "massage-lab-aurora-bars"
  | "massage-lab-bubble"
  | "massage-lab-gradient"
  | "massage-lab-stars"
  | "massage-lab-hole"

export type BackgroundCategory = "chimer" | "clock" | "music" | "ambient"
export type LicenseStatus = "verified" | "caution" | "unclear" | "blocked"
export type MotionIntensity = "static" | "subtle" | "medium" | "high"
export type PerformanceCost = "low" | "medium" | "high"

type BackgroundComponentLoader = () => Promise<{ default: ComponentType<BackgroundEffectProps> }>

export interface BackgroundDefinition {
  id: BackgroundId
  label: string
  provider: string
  sourceUrl: string
  license: string
  licenseStatus: LicenseStatus
  category: readonly BackgroundCategory[]
  recommendedUse: string
  motionIntensity: MotionIntensity
  performanceCost: PerformanceCost
  requiresSubscription: boolean
  enabled: boolean
  customizationSummary?: string
  disabledReason?: string
  previewMediaUrl?: string
  previewMediaType?: "image" | "video"
  previewImageUrl?: string
  previewVideoUrl?: string
  previewSquareVideoUrl?: string
  previewVerticalVideoUrl?: string
  previewVariants?: BackgroundPreviewManifestEntry["variants"]
  component?: BackgroundComponentLoader
  fallbackClassName?: string
  fallbackStyle?: CSSProperties
}

const cssBackgrounds = () => import("./effects/css-backgrounds")
const massageLabLightSpeed = () => import("./effects/massage-lab-light-speed-background")
const massageLabElectricMist = () => import("./effects/massage-lab-electric-mist-background")
const massageLabAstralFlow = () => import("./effects/massage-lab-astral-flow-background")
const massageLabDeepSpaceNebula = () => import("./effects/massage-lab-deep-space-nebula-background")
const massageLabGridBloom = () => import("./effects/massage-lab-grid-bloom-background")
const massageLabChromeFlow = () => import("./effects/massage-lab-chrome-flow-background")
const massageLabWaveCurrent = () => import("./effects/massage-lab-wave-current-background")
const massageLabSynthesis = () => import("./effects/massage-lab-synthesis-background")
const massageLabFerrofluid = () => import("./effects/massage-lab-ferrofluid-background")
const massageLabLightfall = () => import("./effects/massage-lab-lightfall-background")
const massageLabLiquidEther = () => import("./effects/massage-lab-liquid-ether-background")
const massageLabPrism = () => import("./effects/massage-lab-prism-background")
const massageLabDarkVeil = () => import("./effects/massage-lab-dark-veil-background")
const massageLabLightPillar = () => import("./effects/massage-lab-light-pillar-background")
const massageLabSilk = () => import("./effects/massage-lab-silk-background")
const massageLabFloatingLines = () => import("./effects/massage-lab-floating-lines-background")
const massageLabSideRays = () => import("./effects/massage-lab-side-rays-background")
const massageLabLightRays = () => import("./effects/massage-lab-light-rays-background")
const massageLabPixelBlast = () => import("./effects/massage-lab-pixel-blast-background")
const massageLabColorBends = () => import("./effects/massage-lab-color-bends-background")
const massageLabEvilEye = () => import("./effects/massage-lab-evil-eye-background")
const massageLabLineWaves = () => import("./effects/massage-lab-line-waves-background")
const massageLabRadar = () => import("./effects/massage-lab-radar-background")
const massageLabSoftAurora = () => import("./effects/massage-lab-soft-aurora-background")
const massageLabPlasma = () => import("./effects/massage-lab-plasma-background")
const massageLabPlasmaWave = () => import("./effects/massage-lab-plasma-wave-background")
const massageLabParticles = () => import("./effects/massage-lab-particles-background")
const massageLabGradientBlinds = () => import("./effects/massage-lab-gradient-blinds-background")
const massageLabGrainient = () => import("./effects/massage-lab-grainient-background")
const massageLabGridScan = () => import("./effects/massage-lab-grid-scan-background")
const massageLabBeams = () => import("./effects/massage-lab-beams-background")
const massageLabPixelSnow = () => import("./effects/massage-lab-pixel-snow-background")
const massageLabLightning = () => import("./effects/massage-lab-lightning-background")
const massageLabPrismaticBurst = () => import("./effects/massage-lab-prismatic-burst-background")
const massageLabGalaxy = () => import("./effects/massage-lab-galaxy-background")
const massageLabDither = () => import("./effects/massage-lab-dither-background")
const massageLabFaultyTerminal = () => import("./effects/massage-lab-faulty-terminal-background")
const massageLabRippleGrid = () => import("./effects/massage-lab-ripple-grid-background")
const massageLabDotField = () => import("./effects/massage-lab-dot-field-background")
const massageLabDotGrid = () => import("./effects/massage-lab-dot-grid-background")
const massageLabThreads = () => import("./effects/massage-lab-threads-background")
const massageLabIridescence = () => import("./effects/massage-lab-iridescence-background")
const massageLabWaves = () => import("./effects/massage-lab-waves-background")
const massageLabGridDistortion = () => import("./effects/massage-lab-grid-distortion-background")
const massageLabOrb = () => import("./effects/massage-lab-orb-background")
const massageLabLetterGlitch = () => import("./effects/massage-lab-letter-glitch-background")
const massageLabGridMotion = () => import("./effects/massage-lab-grid-motion-background")
const massageLabShapeGrid = () => import("./effects/massage-lab-shape-grid-background")
const massageLabLiquidChrome = () => import("./effects/massage-lab-liquid-chrome-background")
const massageLabBalatro = () => import("./effects/massage-lab-balatro-background")
const massageLabNovatrix = () => import("./effects/massage-lab-novatrix-background")
const massageLabMatrixRain = () => import("./effects/massage-lab-matrix-rain-background")
const massageLabPhotonBeam = () => import("./effects/massage-lab-photon-beam-background")
const massageLab3DGlobe = () => import("./effects/massage-lab-3d-globe-background")
const massageLabRetroGrid = () => import("./effects/massage-lab-retro-grid-background")
const massageLabAerialRays = () => import("./effects/massage-lab-aerial-rays-background")
const massageLabSparkles = () => import("./effects/massage-lab-sparkles")
const massageLabShootingStars = () => import("./effects/massage-lab-shooting-stars-background")
const massageLabVortex = () => import("./effects/massage-lab-vortex-background")
const massageLabWavy = () => import("./effects/massage-lab-wavy-background")
const massageLabPixelLiquid = () => import("./effects/massage-lab-pixel-liquid-background")
const massageLabTileGrid = () => import("./effects/massage-lab-tile-grid-background")
const massageLabHexGrid = () => import("./effects/massage-lab-hex-grid-background")
const massageLabAuroraBars = () => import("./effects/massage-lab-aurora-bars-background")

const rawBackgroundRegistry: readonly BackgroundDefinition[] = [
  {
    id: "massage-lab-moving-gradient",
    label: "MassageLaba Lamp",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MassageLab internal implementation",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Free default; preserves the original Chimer and Clock moving gradient background.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: false,
    enabled: true,
    customizationSummary: "Clock/display color plus lamp main and orb colors.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabMovingGradientBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 18% 12%, rgba(255,122,26,0.26), transparent 34%), radial-gradient(circle at 78% 18%, rgba(65,105,225,0.22), transparent 34%), linear-gradient(145deg, #050505 0%, #101318 58%, #050505 100%)",
    },
  },
  {
    id: "static-gradient",
    label: "Static gradient",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MassageLab internal implementation",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Free static option and fallback for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "static",
    performanceCost: "low",
    requiresSubscription: false,
    enabled: true,
    component: () => cssBackgrounds().then((module) => ({ default: module.StaticGradientBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 18% 12%, rgba(255,122,26,0.26), transparent 34%), radial-gradient(circle at 78% 18%, rgba(65,105,225,0.22), transparent 34%), linear-gradient(145deg, #050505 0%, #101318 58%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-particles-draft",
    label: "Particles",
    provider: "MassageLab draft",
    sourceUrl: "internal",
    license: "MassageLab internal draft; MassageLab MIT source candidate not imported",
    licenseStatus: "verified",
    category: ["clock", "music", "ambient"],
    recommendedUse: "Draft placeholder for the MassageLab Particles candidate; review against the source demo before final activation.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: false,
    customizationSummary: "Draft: review against source demo before finalizing.",
    disabledReason: "Disabled during the background reset. Re-add only after source-matched implementation and user review.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabParticlesDraftBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 35% 20%, rgba(255,255,255,0.12), transparent 28%), radial-gradient(circle at 80% 70%, rgba(65,105,225,0.2), transparent 34%), linear-gradient(145deg, #050505, #10141c)",
    },
  },
  {
    id: "massage-lab-noise-texture-draft",
    label: "Noise texture",
    provider: "MassageLab draft",
    sourceUrl: "internal",
    license: "MassageLab internal draft; MassageLab MIT source candidate not imported",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Draft placeholder for the MassageLab Noise Texture candidate; review against the source demo before final activation.",
    motionIntensity: "static",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: false,
    customizationSummary: "Draft: review against source demo before finalizing.",
    disabledReason: "Disabled during the background reset. Re-add only after source-matched implementation and user review.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabNoiseTextureDraftBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 35%, rgba(255,122,26,0.18), transparent 36%), linear-gradient(145deg, #050505, #121212)",
    },
  },
  {
    id: "massage-lab-grid-pattern-draft",
    label: "Grid pattern",
    provider: "MassageLab draft",
    sourceUrl: "internal",
    license: "MassageLab internal draft; MassageLab MIT source candidate not imported",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Draft placeholder for the MassageLab Grid Pattern candidate; review against the source demo before final activation.",
    motionIntensity: "static",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: false,
    customizationSummary: "Draft: review against source demo before finalizing.",
    disabledReason: "Disabled during the background reset. Re-add only after source-matched implementation and user review.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabGridPatternDraftBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at center, rgba(255,255,255,0.07), transparent 36%), linear-gradient(145deg, #050505, #111827)",
    },
  },
  {
    id: "massage-lab-animated-grid-draft",
    label: "Animated grid",
    provider: "MassageLab draft",
    sourceUrl: "internal",
    license: "MassageLab internal draft; MassageLab MIT source candidate not imported",
    licenseStatus: "verified",
    category: ["music", "ambient"],
    recommendedUse: "Draft placeholder for the MassageLab Animated Grid candidate; review against the source demo before final activation.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: false,
    customizationSummary: "Draft: review against source demo before finalizing.",
    disabledReason: "Disabled during the background reset. Re-add only after source-matched implementation and user review.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabAnimatedGridDraftBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 48% 42%, rgba(255,255,255,0.08), transparent 34%), linear-gradient(145deg, #050505, #101827)",
    },
  },
  {
    id: "massage-lab-retro-grid",
    label: "Retro Grid",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; MassageLab repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium scrolling perspective-grid background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background fill, light and dark grid line colors, source angle, cell size, and opacity; source WebGL grid adapted with CSS fallback, reduced motion, and cleanup.",
    component: () => massageLabRetroGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 72%, rgba(128,128,128,0.16), transparent 38%), linear-gradient(180deg, #020617 0%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-aerial-rays",
    label: "Aerial Rays",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; MassageLab repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium softly animated top-down light-ray background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background fill, ray color, source ray count, blur, cycle speed, ray length, and opacity; source Motion animation adapted with native CSS keyframes, reduced motion, and no new dependency.",
    component: () => massageLabAerialRays().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 20% 15%, rgba(160,210,255,0.2), transparent 58%), radial-gradient(circle at 80% 10%, rgba(160,210,255,0.14), transparent 62%), #020617",
    },
  },
  {
    id: "massage-lab-wave-current",
    label: "Wave Current",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; copyright 2026 Amarnath; reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium shader-based wave surface for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background, valley, primary, and highlight colors, Speed X/Y percentages, and wave amplitude; source shader plane adapted with native canvas to avoid new dependencies, with optional primary-color harmony palettes.",
    component: () => massageLabWaveCurrent().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 54% 36%, rgba(0,212,255,0.22), transparent 34%), radial-gradient(circle at 36% 64%, rgba(7,22,151,0.32), transparent 44%), #000000",
    },
  },
  {
    id: "massage-lab-electric-mist",
    label: "Electric Mist",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; copyright 2026 Amarnath; reviewed 2026-07-03",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium high-energy lightning and mist shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Color, animation speed percentage, noise detail, distortion, and 1%-100% brightness; source shader model adapted with native canvas to avoid new dependencies, with the dense mist preserved and only the vertical sweep mask softened.",
    component: () => massageLabElectricMist().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(86,189,255,0.18), transparent 28%), linear-gradient(135deg, #050505, #07111b)",
    },
  },
  {
    id: "massage-lab-astral-flow",
    label: "Astral Flow",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; copyright 2026 Amarnath; reviewed 2026-07-03",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium breathing radial cosmic shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Color 1, Color 2, Color 3, animation speed percentage, Flow Min, and Flow Max; source shader model adapted with native canvas to avoid new dependencies, with optional primary-color harmony palettes.",
    component: () => massageLabAstralFlow().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(160,118,154,0.22), transparent 42%), linear-gradient(145deg, #05070a 0%, #140b1b 54%, #02030a 100%)",
    },
  },
  {
    id: "massage-lab-deep-space-nebula",
    label: "Deep Space Nebula",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; copyright 2026 Amarnath; reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium deep-space domain-warping shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Highlight color, nebula cloud color, deep-space color, and animation speed percentage; source shader model adapted with native canvas to avoid new dependencies, with optional primary-color harmony palettes.",
    component: () => massageLabDeepSpaceNebula().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(118,59,101,0.24), transparent 42%), radial-gradient(circle at 62% 44%, rgba(94,255,244,0.12), transparent 26%), linear-gradient(145deg, #1a0b2e 0%, #090414 58%, #010104 100%)",
    },
  },
  {
    id: "massage-lab-grid-bloom",
    label: "Grid Bloom",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; copyright 2026 Amarnath; reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium pulsing interference-grid shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Bloom color, animation speed percentage, grid density, rotation speed, fade falloff, distortion, and flow X/Y; source shader model adapted with native canvas to avoid new dependencies, with cursor interaction intentionally omitted.",
    component: () => massageLabGridBloom().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(224,64,251,0.2), transparent 40%), linear-gradient(145deg, #07010c 0%, #13051d 58%, #020104 100%)",
    },
  },
  {
    id: "massage-lab-chrome-flow",
    label: "Chrome Flow",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; copyright 2026 Amarnath; reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium liquid-metal shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Primary chrome color, secondary chrome color, flow speed percentage, and time scale percentage; source shader model adapted with native canvas to avoid new dependencies, with optional primary-color harmony palettes.",
    component: () => massageLabChromeFlow().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 42% 34%, rgba(255,255,255,0.22), transparent 30%), radial-gradient(circle at 64% 56%, rgba(74,74,74,0.32), transparent 42%), linear-gradient(145deg, #111111 0%, #2e2e2e 52%, #070707 100%)",
    },
  },
  {
    id: "massage-lab-light-speed",
    label: "Light Speed",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; copyright 2026 Amarnath; reviewed 2026-07-03",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium high-motion warp-speed field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Warp speed, particle count, light color, glow intensity, tunnel radius, and field length; source WebGL/R3F component adapted with native canvas to avoid new dependencies.",
    component: () => massageLabLightSpeed().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(176,38,255,0.18), transparent 38%), radial-gradient(circle at 52% 50%, rgba(51,178,255,0.1), transparent 48%), #000000",
    },
  },
  {
    id: "massage-lab-ferrofluid",
    label: "Ferrofluid",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-04",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium glowing ferrofluid contour shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Custom or harmony-based color palettes plus source speed, scale, turbulence, fluidity, rim width, sharpness, shimmer, glow, flow direction, and opacity; source OGL shader adapted with native WebGL, pointer events disabled, and cursor interaction intentionally omitted.",
    component: () => massageLabFerrofluid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 48%, rgba(255,255,255,0.18), transparent 34%), radial-gradient(circle at 34% 72%, rgba(96,165,250,0.1), transparent 28%), linear-gradient(145deg, #020617 0%, #040711 58%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-lightfall",
    label: "Lightfall",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-04",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium falling light-streak shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Custom or harmony-based streak colors plus background color, source speed, streak count, width, length, glow, density, twinkle, zoom, background glow, opacity, and opt-in cursor glow controls; source OGL shader adapted with native WebGL while the canvas remains pointer-events free.",
    component: () => massageLabLightfall().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 44%, rgba(166,200,255,0.18), transparent 34%), radial-gradient(circle at 62% 58%, rgba(255,159,252,0.1), transparent 30%), linear-gradient(145deg, #0615a8 0%, #091d5c 54%, #030614 100%)",
    },
  },
  {
    id: "massage-lab-liquid-ether",
    label: "Liquid Ether",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium fluid ether field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Custom or harmony-based palette colors plus source-shaped fluid controls for cursor force/size, viscosity, solver iterations, delta time, BFECC, resolution, bounce, auto-demo motion, resume/ramp timing, and opacity; source Three.js simulation adapted with native WebGL while the canvas remains pointer-events free.",
    component: () => massageLabLiquidEther().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 42% 46%, rgba(82,39,255,0.24), transparent 36%), radial-gradient(circle at 62% 58%, rgba(255,159,252,0.18), transparent 34%), linear-gradient(145deg, #070015 0%, #13072f 58%, #02010a 100%)",
    },
  },
  {
    id: "massage-lab-prism",
    label: "Prism",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium ray-marched prism field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source-shaped controls for prism height, base width, rotation mode including optional cursor hover, glow, bloom, noise, hue shift, color frequency, scale, time scale, transparency, and X/Y offset; source OGL shader adapted with native WebGL while the canvas remains pointer-events free.",
    component: () => massageLabPrism().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 48%, rgba(190,145,255,0.22), transparent 36%), radial-gradient(circle at 64% 52%, rgba(255,90,198,0.14), transparent 32%), linear-gradient(145deg, #090214 0%, #17072f 58%, #02010a 100%)",
    },
  },
  {
    id: "massage-lab-dark-veil",
    label: "Dark Veil",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium neural veil shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source-shaped controls for hue shift, noise intensity, scanline intensity, speed, scanline frequency, warp amount, and resolution scale; source OGL CPPN shader adapted with native WebGL while the canvas remains pointer-events free.",
    component: () => massageLabDarkVeil().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 46% 52%, rgba(124,58,237,0.28), transparent 38%), radial-gradient(circle at 64% 44%, rgba(236,72,153,0.16), transparent 34%), linear-gradient(145deg, #05010d 0%, #12051f 58%, #020007 100%)",
    },
  },
  {
    id: "massage-lab-light-pillar",
    label: "Light Pillar",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium vertical raymarched light-pillar shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "high",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Custom or harmony-based top and bottom colors plus source-shaped intensity, rotation speed, optional cursor interaction, glow amount, pillar width/height, noise, blend mode, pillar rotation, and quality controls; source Three.js shader adapted with native WebGL while the canvas remains pointer-events free.",
    component: () => massageLabLightPillar().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 46%, rgba(82,39,255,0.24), transparent 32%), radial-gradient(circle at 50% 54%, rgba(255,159,252,0.18), transparent 42%), linear-gradient(145deg, #050013 0%, #120424 56%, #020007 100%)",
    },
  },
  {
    id: "massage-lab-silk",
    label: "Silk",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium silk-wave shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Custom or harmony-based color plus source-shaped speed, scale, noise intensity, and rotation controls; source Three/R3F shader adapted with native WebGL while the canvas remains pointer-events free.",
    component: () => massageLabSilk().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 48% 44%, rgba(123,116,129,0.32), transparent 36%), radial-gradient(circle at 58% 58%, rgba(203,183,218,0.16), transparent 42%), linear-gradient(145deg, #07060a 0%, #181320 58%, #040307 100%)",
    },
  },
  {
    id: "massage-lab-floating-lines",
    label: "Floating Lines",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium layered wave-line shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony line colors, top/middle/bottom wave enablement, counts, spacing, wave positions, animation speed, cursor bend, parallax, damping, and blend-mode controls; source Three.js shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabFloatingLines().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 20% 12%, rgba(233,71,245,0.12), transparent 34%), radial-gradient(circle at 78% 88%, rgba(47,75,162,0.18), transparent 38%), linear-gradient(145deg, #02030a 0%, #060716 58%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-side-rays",
    label: "Side Rays",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium side-origin light-ray shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony ray colors, speed, intensity, spread, origin, tilt, saturation, blend, falloff, and opacity controls; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabSideRays().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 86% 10%, rgba(234,179,8,0.2), transparent 36%), radial-gradient(circle at 82% 14%, rgba(150,200,255,0.16), transparent 42%), linear-gradient(145deg, #03040a 0%, #07101f 58%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-light-rays",
    label: "Light Rays",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium source-shaped ray shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony ray color, origin, speed, spread, length, pulsating, fade distance, saturation, optional mouse follow, noise, and distortion controls; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabLightRays().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.24), transparent 42%), radial-gradient(circle at 42% 24%, rgba(160,210,255,0.16), transparent 42%), linear-gradient(180deg, #020617 0%, #05070d 100%)",
    },
  },
  {
    id: "massage-lab-pixel-blast",
    label: "Pixel Blast",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium dithered pixel-shape shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony pixel color, shape, pixel size, antialiasing, scale, density, jitter, ripple clicks, liquid pointer warp, speed, transparency, edge fade, and noise controls; source Three.js/postprocessing shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabPixelBlast().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 48% 44%, rgba(180,151,207,0.26), transparent 38%), radial-gradient(circle at 62% 62%, rgba(82,39,255,0.16), transparent 42%), linear-gradient(145deg, #05020a 0%, #0f0820 58%, #020106 100%)",
    },
  },
  {
    id: "massage-lab-color-bends",
    label: "Color Bends",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated color-bend shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source RGB bands or custom/harmony color arrays plus rotation, speed, auto-rotate, scale, frequency, warp, optional cursor influence, parallax, noise, iterations, intensity, band width, and transparency; source Three.js shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabColorBends().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 46% 48%, rgba(138,92,246,0.24), transparent 36%), radial-gradient(circle at 62% 52%, rgba(236,72,153,0.16), transparent 42%), linear-gradient(145deg, #05020a 0%, #10051e 58%, #020106 100%)",
    },
  },
  {
    id: "massage-lab-evil-eye",
    label: "Evil Eye",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium iris/flame shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony eye color, source intensity, pupil, iris, glow, scale, noise, flame speed, background color, and opt-in pupil follow; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabEvilEye().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,111,55,0.24), transparent 36%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0.8), transparent 58%), #000000",
    },
  },
  {
    id: "massage-lab-line-waves",
    label: "Line Waves",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated line-field shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony line colors, source speed, inner/outer line counts, warp, rotation, edge fade, color cycling, brightness, optional mouse warp, and mouse influence; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabLineWaves().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08), transparent 38%), linear-gradient(135deg, #020617 0%, #05070d 100%)",
    },
  },
  {
    id: "massage-lab-radar",
    label: "Radar",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium radar sweep shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony radar color, background, speed, scale, ring/spoke counts and thicknesses, sweep speed/width/lobes, falloff, brightness, optional mouse offset, and mouse influence; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabRadar().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(159,41,255,0.18), transparent 38%), linear-gradient(135deg, #000000 0%, #07030c 100%)",
    },
  },
  {
    id: "massage-lab-soft-aurora",
    label: "Soft Aurora",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium soft aurora band shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony aurora colors, speed, scale, brightness, noise frequency/amplitude, band height/spread, octave decay, layer offset, color speed, optional mouse shift, and mouse influence; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabSoftAurora().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 46% 64%, rgba(247,247,247,0.16), transparent 38%), radial-gradient(circle at 58% 66%, rgba(225,0,255,0.18), transparent 44%), linear-gradient(180deg, #05010d 0%, #10071e 58%, #020006 100%)",
    },
  },
  {
    id: "massage-lab-plasma",
    label: "Plasma",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium raymarched plasma shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony plasma color, source speed, direction including ping-pong, scale, opacity, and optional mouse warp; source WebGL2/OGL shader adapted with raw WebGL2 while the canvas remains pointer-events free.",
    component: () => massageLabPlasma().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 52%, rgba(255,255,255,0.16), transparent 34%), radial-gradient(circle at 42% 60%, rgba(138,92,246,0.18), transparent 42%), linear-gradient(145deg, #05010d 0%, #12051f 58%, #020006 100%)",
    },
  },
  {
    id: "massage-lab-plasma-wave",
    label: "Plasma Wave",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium two-color plasma wave shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony wave colors plus source-shaped X/Y offset, rotation, focal length, dual wave speeds, secondary direction, and bend controls; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabPlasmaWave().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 42% 48%, rgba(168,85,247,0.18), transparent 36%), radial-gradient(circle at 62% 54%, rgba(6,182,212,0.16), transparent 42%), linear-gradient(145deg, #04030a 0%, #09111e 58%, #010105 100%)",
    },
  },
  {
    id: "massage-lab-particles",
    label: "Particles",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium point-cloud particle field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony particle colors plus source-shaped particle count, spread, speed, hover push, alpha particles, base size, size randomness, camera distance, rotation, and pixel ratio; source OGL point shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabParticles().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12), transparent 35%), linear-gradient(145deg, #02030a 0%, #060812 58%, #000104 100%)",
    },
  },
  {
    id: "massage-lab-gradient-blinds",
    label: "Gradient Blinds",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium striped gradient spotlight shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony gradient colors plus source-shaped angle, noise, blind count, minimum blind width, mouse damping, mirror, spotlight radius/softness/opacity, distortion, shine direction, blend mode, DPR, and optional cursor spotlight; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabGradientBlinds().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "linear-gradient(90deg, rgba(255,159,252,0.28), rgba(82,39,255,0.3)), linear-gradient(145deg, #05010d 0%, #12051f 58%, #020006 100%)",
    },
  },
  {
    id: "massage-lab-grainient",
    label: "Grainient",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium grain-textured warped color field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony three-color palette plus source-shaped time, color balance, warp, blend, rotation, noise, grain, contrast, gamma, saturation, center, and zoom controls; source OGL WebGL2 shader adapted with raw WebGL2 while the canvas remains pointer-events free.",
    component: () => massageLabGrainient().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 30% 28%, rgba(255,159,252,0.2), transparent 36%), radial-gradient(circle at 70% 58%, rgba(82,39,255,0.24), transparent 42%), linear-gradient(145deg, #090012 0%, #140729 58%, #05020a 100%)",
    },
  },
  {
    id: "massage-lab-grid-scan",
    label: "Grid Scan",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium perspective grid scanner for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony grid and scan colors plus source-shaped sensitivity, line thickness, scan opacity, grid scale, line style, jitter, direction, noise, glow, softness, phase taper, duration, delay, and opt-in pointer skew/click scan pulses; source shader adapted with raw WebGL while webcam/face-api and postprocessing imports are omitted.",
    component: () => massageLabGridScan().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 46%, rgba(255,159,252,0.14), transparent 32%), linear-gradient(145deg, #05030a 0%, #100719 58%, #020106 100%)",
    },
  },
  {
    id: "massage-lab-synthesis",
    label: "Synthesis",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; copyright 2026 Amarnath; reviewed 2026-07-03",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium cosmic flow background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Color 1, Color 2, Color 3, animation speed, complexity, zoom scale, distortion, glow intensity, and flow frequency; source shader model adapted with native canvas to avoid new dependencies.",
    component: () => massageLabSynthesis().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 55% 42%, rgba(14,165,233,0.18), transparent 40%), radial-gradient(circle at 42% 55%, rgba(59,7,100,0.2), transparent 44%), linear-gradient(145deg, #0f172a 0%, #070512 56%, #020617 100%)",
    },
  },
  {
    id: "massage-lab-beams",
    label: "Beams",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium stacked light-beam shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source white or custom/harmony light color plus source-shaped beam width, height, count, speed, noise, scale, and rotation; raw WebGL port of the MassageLab stacked-plane displacement shader without Three/R3F.",
    component: () => massageLabBeams().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 32%, rgba(255,255,255,0.14), transparent 34%), linear-gradient(180deg, #000000 0%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-pixel-snow",
    label: "Pixel Snow",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium pixelated ray-marched snow background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "high",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source white or custom/harmony snow color plus source-shaped flake size, minimum flake size, pixel resolution, speed, depth fade, far plane, brightness, gamma, density, variant, and direction; WebGL2 port of the MassageLab fragment shader without Three/R3F.",
    component: () => massageLabPixelSnow().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.16), transparent 38%), linear-gradient(180deg, #020617 0%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-lightning",
    label: "Lightning",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium lightning-bolt shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony hue plus source-shaped X offset, speed, intensity, and size controls; raw WebGL port of the MassageLab lightning shader.",
    component: () => massageLabLightning().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(92,124,255,0.18), transparent 36%), linear-gradient(180deg, #02030a 0%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-prismatic-burst",
    label: "Prismatic Burst",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium spectral ray burst shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source spectral colors or custom/harmony gradient colors plus source-shaped intensity, speed, animation type, distortion, offset, hover damping, ray count, and blend controls.",
    component: () => massageLabPrismaticBurst().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 45%, rgba(147,197,253,0.22), transparent 34%), radial-gradient(circle at 68% 32%, rgba(236,72,153,0.18), transparent 30%), #02030a",
    },
  },
  {
    id: "massage-lab-galaxy",
    label: "Galaxy",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium star-field shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony hue shift plus source-shaped focal point, rotation, star speed, density, speed, glow, saturation, twinkle, cursor interaction, repulsion, center repulsion, and transparency controls.",
    component: () => massageLabGalaxy().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 44%, rgba(147,197,253,0.16), transparent 34%), radial-gradient(circle at 72% 24%, rgba(34,197,94,0.16), transparent 28%), #020617",
    },
  },
  {
    id: "massage-lab-dither",
    label: "Dither",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium dithered wave/noise shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony wave color plus source-shaped wave speed, frequency, amplitude, color count, pixel size, cursor interaction, and mouse radius controls.",
    component: () => massageLabDither().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "linear-gradient(135deg, rgba(148,163,184,0.22), transparent 48%), repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 5px), #020617",
    },
  },
  {
    id: "massage-lab-faulty-terminal",
    label: "Faulty Terminal",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium terminal/glitch shader for opt-in themed Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony tint plus source-shaped scale, grid, digit, time, scanline, glitch, flicker, noise, chromatic, dither, curvature, cursor, page-load, and brightness controls.",
    component: () => massageLabFaultyTerminal().then((module) => ({ default: module.default })),
    fallbackStyle: {
      backgroundColor: "#000000",
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 12px)",
      backgroundSize: "100% 4px, 18px 18px",
    },
  },
  {
    id: "massage-lab-ripple-grid",
    label: "Ripple Grid",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium rippling grid shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/rainbow/custom/harmony grid color plus source-shaped ripple, grid, fade, vignette, glow, opacity, rotation, cursor, and cursor-radius controls.",
    component: () => massageLabRippleGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18), transparent 42%), linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px), #020617",
      backgroundSize: "100% 100%, 40px 40px, 40px 40px",
    },
  },
  {
    id: "massage-lab-dot-field",
    label: "Dot Field",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium reactive dot-field canvas for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony dot gradient and glow colors plus source-shaped dot radius, spacing, cursor radius/force, bulge mode, bulge strength, glow radius, sparkle, wave, and cursor controls.",
    component: () => massageLabDotField().then((module) => ({ default: module.default })),
    fallbackStyle: {
      backgroundColor: "#080710",
      backgroundImage:
        "radial-gradient(circle at 2px 2px, rgba(180,151,207,0.32) 1px, transparent 1.8px), radial-gradient(circle at 50% 50%, rgba(18,15,23,0.85), transparent 32%)",
      backgroundSize: "18px 18px, 100% 100%",
    },
  },
  {
    id: "massage-lab-dot-grid",
    label: "Dot Grid",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium reactive dot-grid canvas for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony base and active colors plus source-shaped dot size, gap, proximity, speed trigger, shock radius/strength, max speed, resistance, return duration, cursor, and click-shock controls.",
    component: () => massageLabDotGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      backgroundColor: "#05030f",
      backgroundImage: "radial-gradient(circle at 2px 2px, rgba(82,39,255,0.72) 2px, transparent 2.8px)",
      backgroundSize: "48px 48px",
    },
  },
  {
    id: "massage-lab-threads",
    label: "Threads",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated thread-line shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony thread color plus source-shaped amplitude, distance, and optional mouse interaction; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabThreads().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 58% 48%, rgba(255,255,255,0.16), transparent 34%), linear-gradient(145deg, #05040a 0%, #0f1018 58%, #020204 100%)",
    },
  },
  {
    id: "massage-lab-iridescence",
    label: "Iridescence",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium iridescent shader wash for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony tint color plus source-shaped speed, amplitude, and optional mouse reaction; source OGL shader adapted with raw WebGL while the canvas remains pointer-events free.",
    component: () => massageLabIridescence().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 40% 42%, rgba(255,255,255,0.22), transparent 34%), radial-gradient(circle at 64% 56%, rgba(140,120,255,0.2), transparent 40%), linear-gradient(145deg, #f5f7ff 0%, #b5c4ff 46%, #f7a6d8 100%)",
    },
  },
  {
    id: "massage-lab-waves",
    label: "Wave Current",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium canvas wave-line field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony line color, optional transparent/custom background, source-shaped wave speed, amplitude, grid gap, friction, tension, max cursor movement, and optional cursor interaction; source canvas simulation adapted without new dependencies.",
    component: () => massageLabWaves().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0 1px, transparent 1px 22px), linear-gradient(145deg, #f8fafc 0%, #e5e7eb 46%, #dbeafe 100%)",
    },
  },
  {
    id: "massage-lab-grid-distortion",
    label: "Grid Distortion",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium image-distortion WebGL texture field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Custom/harmony generated texture colors plus source-shaped grid, mouse radius, strength, relaxation, and optional cursor interaction; source Three.js data-texture distortion adapted with raw WebGL and no arbitrary image URLs.",
    component: () => massageLabGridDistortion().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 30% 30%, rgba(91,124,250,0.42), transparent 34%), radial-gradient(circle at 70% 66%, rgba(247,183,210,0.36), transparent 42%), linear-gradient(145deg, #101827 0%, #111827 100%)",
    },
  },
  {
    id: "massage-lab-orb",
    label: "Orb",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium glowing orb shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony hue controls plus background color, hover intensity, hover rotation, forced hover state, and optional cursor interaction; source OGL shader adapted with raw WebGL.",
    component: () => massageLabOrb().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(156,67,254,0.68), transparent 28%), radial-gradient(circle at 58% 45%, rgba(76,194,233,0.46), transparent 34%), #000000",
    },
  },
  {
    id: "massage-lab-letter-glitch",
    label: "Letter Glitch",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium text-glitch canvas field for deliberately styled opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony glitch colors plus speed, smooth transitions, vignette toggles, and character set; source canvas character-grid model adapted with deterministic internal random state.",
    component: () => massageLabLetterGlitch().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.35), transparent 42%), repeating-linear-gradient(90deg, rgba(97,220,163,0.2) 0 1px, transparent 1px 10px), #000000",
    },
  },
  {
    id: "massage-lab-grid-motion",
    label: "Grid Motion",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium cursor-reactive tile grid for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony gradient, tile, and text colors plus source-shaped cursor max movement, inertia duration, and cursor toggle; source GSAP row motion replaced with local RAF smoothing.",
    component: () => massageLabGridMotion().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.72), transparent 44%), repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 12px, rgba(17,17,17,0.18) 12px 36px), #050505",
    },
  },
  {
    id: "massage-lab-shape-grid",
    label: "Shape Grid",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium moving geometric grid for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony border and hover-fill colors plus source-shaped direction, speed, shape, size, hover trail, and cursor toggle; source canvas drawing model preserved.",
    component: () => massageLabShapeGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "linear-gradient(rgba(153,153,153,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(153,153,153,0.16) 1px, transparent 1px), #050505",
      backgroundSize: "40px 40px",
    },
  },
  {
    id: "massage-lab-liquid-chrome",
    label: "Chrome Flow",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium liquid-metal shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony base-color controls plus source-shaped speed, amplitude, X/Y frequencies, and optional pointer ripple; source OGL shader adapted with raw WebGL.",
    component: () => massageLabLiquidChrome().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.62), transparent 22%), radial-gradient(circle at 62% 64%, rgba(26,26,26,0.9), transparent 34%), #ffffff",
    },
  },
  {
    id: "massage-lab-balatro",
    label: "Balatro",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium high-style swirl shader for deliberate opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony color controls plus source-shaped spin, contrast, lighting, pixel filter, rotation, offset, and optional cursor influence; source OGL shader adapted with raw WebGL.",
    component: () => massageLabBalatro().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 40% 50%, rgba(222,68,59,0.7), transparent 32%), radial-gradient(circle at 62% 46%, rgba(0,107,180,0.64), transparent 34%), #162325",
    },
  },
  {
    id: "massage-lab-novatrix",
    label: "Novatrix Field",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; MassageLab repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated WebGL field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Color, color harmony, animation speed, and passive drift amplitude; source WebGL shader adapted with native canvas to avoid adding the source ogl dependency.",
    component: () => massageLabNovatrix().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18), transparent 34%), radial-gradient(circle at 68% 34%, rgba(160,196,255,0.14), transparent 30%), linear-gradient(145deg, #02030a 0%, #070814 58%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-matrix-rain",
    label: "Matrix Rain",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; MassageLab repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium Matrix-style falling-character background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Character color, color harmony, font size, and falling speed; source 2D canvas behavior adapted with host sizing, reduced motion, and cleanup.",
    component: () => massageLabMatrixRain().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 44%, rgba(0,255,0,0.12), transparent 34%), linear-gradient(180deg, #000000 0%, #020802 100%)",
    },
  },
  {
    id: "massage-lab-photon-beam",
    label: "Photon Beam",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT; MassageLab repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated light-trail beam background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background, line, and signal colors with optional color harmony, plus source-shaped beam, signal, wave, trail, and bloom controls; adapted without adding Three.js.",
    component: () => massageLabPhotonBeam().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 58% 50%, rgba(0,217,255,0.16), transparent 38%), linear-gradient(180deg, #080808 0%, #020405 100%)",
    },
  },
  {
    id: "massage-lab-aurora",
    label: "Aurora field",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium subtle aurora for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source-matched CSS aurora adapted for MassageLab surfaces.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabAuroraBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 100% 0%, rgba(59,130,246,0.18), transparent 48%), radial-gradient(circle at 58% 38%, rgba(165,180,252,0.14), transparent 40%), linear-gradient(145deg, #050505, #111827)",
    },
  },
  {
    id: "massage-lab-dotted-glow",
    label: "Dotted glow",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium subtle dotted shimmer for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source-matched canvas shimmer adapted for MassageLab surfaces.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabDottedGlowBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(0,170,255,0.12), transparent 38%), radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 34%), linear-gradient(145deg, #050505, #101012)",
    },
  },
  {
    id: "massage-lab-sparkles",
    label: "Sparkles",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium particle field for Clock/Chimer tuning, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Particle color, density, and speed for Chimer and Clock.",
    component: () => massageLabSparkles().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 48%, rgba(99,193,255,0.12), transparent 32%), radial-gradient(circle at 18% 16%, rgba(255,122,26,0.1), transparent 28%), linear-gradient(145deg, #050505, #111111)",
    },
  },
  {
    id: "massage-lab-gradient-animation",
    label: "Animated gradient",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated gradient for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Background colors, glow colors, motion speed, and glow size for Chimer and Clock.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabGradientAnimationBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 42% 38%, rgba(18,113,255,0.22), transparent 34%), radial-gradient(circle at 64% 48%, rgba(221,74,255,0.16), transparent 32%), linear-gradient(40deg, rgb(20,8,42), rgb(0,17,82))",
    },
  },
  {
    id: "massage-lab-background-beams",
    label: "Beam field",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated SVG beam field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source-matched SVG paths adapted with native gradient animation and no added Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabBackgroundBeams })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 46%, rgba(24,204,252,0.12), transparent 34%), radial-gradient(circle at 70% 22%, rgba(174,72,255,0.12), transparent 30%), linear-gradient(145deg, #050505, #0a0e18)",
    },
  },
  {
    id: "massage-lab-collision-beams",
    label: "Collision beams",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium falling beam and collision burst field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source beam/collision behavior adapted with CSS animation and no added Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabBackgroundBeamsWithCollision })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 46%, rgba(99,102,241,0.14), transparent 34%), radial-gradient(circle at 70% 22%, rgba(168,85,247,0.12), transparent 30%), linear-gradient(180deg, #050505 0%, #080b13 56%, #111827 100%)",
    },
  },
  {
    id: "massage-lab-background-lines",
    label: "Light lines",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated SVG line field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source SVG paths adapted with deterministic CSS path animation, duration control, and no added Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabBackgroundLines })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 45%, rgba(36,122,251,0.12), transparent 36%), radial-gradient(circle at 25% 78%, rgba(214,89,12,0.1), transparent 32%), linear-gradient(145deg, #050505, #080b12 60%, #050505)",
    },
  },
  {
    id: "massage-lab-glowing-stars",
    label: "Glowing stars",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated star grid for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source star/glow cycle adapted without adding the source Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabGlowingStarsBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 42%, rgba(59,130,246,0.11), transparent 34%), radial-gradient(circle at 24% 82%, rgba(255,122,26,0.07), transparent 30%), linear-gradient(110deg, #141414 0.6%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-meteors",
    label: "Meteors",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium diagonal meteor field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source meteor direction and tail behavior adapted with deterministic CSS animation and no added Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabMeteorsBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 38%, rgba(100,116,139,0.14), transparent 34%), radial-gradient(circle at 22% 78%, rgba(255,122,26,0.08), transparent 30%), linear-gradient(145deg, #050505, #081018 62%, #050505)",
    },
  },
  {
    id: "massage-lab-shooting-stars",
    label: "Shooting stars",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; source credits Vijay Verma / figmaplug.in",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium star field with occasional shooting stars for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Star colors, density, twinkle, shooting speed, and frequency for Chimer and Clock.",
    component: () => massageLabShootingStars().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(72,220,249,0.12), transparent 34%), radial-gradient(circle at 24% 78%, rgba(255,122,26,0.06), transparent 30%), linear-gradient(145deg, #020617 0%, #030712 48%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-reveal-dots",
    label: "Reveal dots",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora; inspired by Clerk's website",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium dot matrix adapted from Canvas Reveal Effect for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Dot color, accent color, size, spacing, opacity, motion speed, and gradient overlay for Chimer and Clock.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabCanvasRevealDotsBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(0,255,255,0.1), transparent 34%), radial-gradient(circle at 74% 20%, rgba(34,211,238,0.08), transparent 30%), linear-gradient(145deg, #020617 0%, #07111b 52%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-3d-globe",
    label: "3D Globe",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; component registry reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium rotating globe background with optional location marker for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background, globe tint, manual or Follow Sun lighting, rotation speed with fixed reverse spin, screen pan, fixed axial tilt, scale, bump, atmosphere, wireframe, icon location markers, built-in MassageLab marker, and a Graphic view with structured stable map dots and Outer Glow; reviewed Three.js source adapted with a dependency-free native WebGL sphere renderer and 2D marker overlay.",
    component: () => massageLab3DGlobe().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 48%, rgba(77,166,255,0.24), transparent 34%), radial-gradient(circle at 36% 28%, rgba(255,255,255,0.12), transparent 24%), linear-gradient(145deg, #020617 0%, #06091a 54%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-spotlight",
    label: "Spotlight",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium mirrored spotlight beams for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Spotlight color, intensity, beam size, vertical offset, sweep, and speed for Chimer and Clock.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabSpotlightNewBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 20% -10%, rgba(213,236,255,0.14), transparent 45%), radial-gradient(ellipse at 80% -10%, rgba(213,236,255,0.12), transparent 45%), linear-gradient(180deg, #020617 0%, #050505 72%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-lamp-effect",
    label: "Lamp Glow",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium centered lamp glow adapted from the reviewed section-header effect.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Lamp beam color, background fill, glow intensity, beam width, glow width, vertical offset, and pulse speed for Chimer and Clock.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabLampEffectBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 50% 40%, rgba(6,182,212,0.24), transparent 34%), radial-gradient(ellipse at 50% 24%, rgba(34,211,238,0.16), transparent 28%), linear-gradient(180deg, #020617 0%, #050505 76%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-wavy-background",
    label: "Wave flow",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated canvas waves for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Wave colors, width, background fill, blur, speed, and opacity for Chimer and Clock.",
    component: () => massageLabWavy().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 45%, rgba(56,189,248,0.12), transparent 36%), linear-gradient(180deg, #000000 0%, #020617 100%)",
    },
  },
  {
    id: "massage-lab-vortex",
    label: "Vortex field",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "reviewed source license; author Manu Arora; inspired by crnacura/AmbientCanvasBackgrounds",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium high-motion canvas vortex for Music and opt-in Chimer, Clock, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "high",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Particle count, hue, speed, vertical spread, radius, and background color for Chimer and Clock.",
    component: () => massageLabVortex().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 46%, rgba(59,130,246,0.14), transparent 34%), radial-gradient(circle at 24% 72%, rgba(34,211,238,0.09), transparent 32%), linear-gradient(145deg, #000000 0%, #020617 52%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-pixel-liquid",
    label: "Pixel liquid",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MassageLab free/open-source component page reviewed 2026-07-02; internal app visual effect only",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium high-motion pixelated liquid field for Music and opt-in Chimer, Clock, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Background, base, accent, and highlight colors plus pixel size, detail, and motion speed for Chimer and Clock.",
    component: () => massageLabPixelLiquid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 44%, rgba(0,224,215,0.14), transparent 34%), radial-gradient(circle at 22% 78%, rgba(81,171,255,0.08), transparent 30%), linear-gradient(145deg, #020a0d 0%, #01040a 52%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-tile-grid",
    label: "MassageLab tile grid",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MassageLab internal implementation",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium internal tile-grid background for Chimer, Clock, Music, and future ambient treatment-room mode.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Tile size, joint size, change interval, active tile percentage, tile opacity, and auto/custom five-color palette controls.",
    component: () => massageLabTileGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(255,122,26,0.14), transparent 34%), radial-gradient(circle at 72% 68%, rgba(65,105,225,0.12), transparent 32%), linear-gradient(145deg, #050607 0%, #090d12 58%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-hex-grid",
    label: "MassageLab hex grid",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MassageLab internal implementation",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium internal hex-tile background for Chimer, Clock, Music, and future ambient treatment-room mode.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Primary color, color harmony, hex size, joint size, fade duration, active hex percentage, and hex opacity controls.",
    component: () => massageLabHexGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(34,211,238,0.14), transparent 34%), radial-gradient(circle at 70% 70%, rgba(180,92,255,0.12), transparent 32%), linear-gradient(145deg, #050607 0%, #090d12 58%, #050505 100%)",
    },
  },
  {
    id: "massage-lab-aurora-bars",
    label: "Aurora bars",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MassageLab free component license reviewed 2026-07-03; original idea credited to @SannaGranqvistX / Framer",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium aurora bar field for Chimer, Clock, Music, and future ambient mode; visualizer mode is only enabled by Music playback surfaces.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Chimer/Clock controls for background, auto monochrome or custom five-color bars, bar count, speed, blur, gap, and min/max height; Music can opt into visualizer mode.",
    component: () => massageLabAuroraBars().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 50% 68%, rgba(255,90,166,0.18), transparent 42%), radial-gradient(ellipse at 50% 92%, rgba(255,214,235,0.2), transparent 26%), linear-gradient(180deg, #000000 0%, #08010a 100%)",
    },
  },
  {
    id: "massage-lab-bubble",
    label: "Bubble field",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2025 Elliot Sutton; reviewed 2026-07-03",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium soft bubble field for Chimer, Clock, Music, and future ambient mode; cursor interaction is intentionally disabled.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source bubble colors and motion adapted with native CSS; cursor interactivity and the sixth mouse-following bubble are intentionally omitted.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabBubbleBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 28% 22%, rgba(18,113,255,0.32), transparent 36%), radial-gradient(circle at 72% 42%, rgba(221,74,255,0.24), transparent 34%), linear-gradient(135deg, #2e1065 0%, #1e3a8a 100%)",
    },
  },
  {
    id: "massage-lab-gradient",
    label: "Gradient field",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2025 Elliot Sutton; reviewed 2026-07-03",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated gradient field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Primary color, color harmony, and layer opacity for Chimer and Clock; source Motion transition is adapted with native CSS keyframes.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabGradientBackground })),
    fallbackStyle: {
      background:
        "linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(168,85,247,0.9) 50%, rgba(236,72,153,0.9) 100%)",
    },
  },
  {
    id: "massage-lab-stars",
    label: "Star field",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2025 Elliot Sutton; reviewed 2026-07-03",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated star field for Chimer, Clock, Music, and future ambient treatment-room mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Star color, speed, density, and parallax strength for Chimer and Clock; source Motion animation is adapted with CSS keyframes.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabStarsBackground })),
    fallbackStyle: {
      background: "radial-gradient(ellipse at bottom, #262626 0%, #000000 100%)",
    },
  },
  {
    id: "massage-lab-hole",
    label: "Depth well",
    provider: "MassageLab",
    sourceUrl: "internal",
    license: "MIT + Commons Clause; copyright 2025 Elliot Sutton; reviewed 2026-07-03",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated hole-grid field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Stroke color, particle color, line count, and disc count for Chimer and Clock; source Motion glow is adapted with CSS and canvas animation.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MassageLabHoleBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 50% 46%, rgba(255,255,255,0.08), transparent 34%), radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0.62), rgba(0,0,0,0.94)), linear-gradient(180deg, #030712 0%, #050505 100%)",
    },
  },
] as const

function withGeneratedPreview(entry: BackgroundDefinition): BackgroundDefinition {
  const preview = backgroundPreviewManifest[entry.id as keyof typeof backgroundPreviewManifest]

  if (!preview) {
    return entry
  }

  return {
    ...entry,
    previewMediaUrl: preview.previewMediaUrl,
    previewMediaType: preview.previewMediaType,
    previewVideoUrl: preview.previewVideoUrl ?? (preview.previewMediaType === "video" ? preview.previewMediaUrl : entry.previewVideoUrl),
    previewSquareVideoUrl: preview.previewSquareVideoUrl ?? entry.previewSquareVideoUrl,
    previewVerticalVideoUrl: preview.previewVerticalVideoUrl ?? entry.previewVerticalVideoUrl,
    previewVariants: preview.variants ?? entry.previewVariants,
    previewImageUrl: preview.previewMediaType === "image" ? preview.previewMediaUrl : entry.previewImageUrl,
  }
}

export const backgroundRegistry: readonly BackgroundDefinition[] = rawBackgroundRegistry.map(withGeneratedPreview)

export function getBackgroundDefinition(id: unknown) {
  return backgroundRegistry.find((entry) => entry.id === id) ?? backgroundRegistry[0]
}

export function getBackgroundOptionsForCategory(category: BackgroundCategory) {
  return backgroundRegistry.filter((entry) => entry.enabled && entry.category.includes(category))
}

export function userCanUseBackground(entry: BackgroundDefinition, featureKeys: string[] = []) {
  return entry.enabled && (!entry.requiresSubscription || hasPremiumBackgroundAccess(featureKeys))
}

export function canUseBackgroundId(id: unknown, featureKeys: string[] = [], category?: BackgroundCategory) {
  const entry = getBackgroundDefinition(id)
  return (!category || entry.category.includes(category)) && userCanUseBackground(entry, featureKeys)
}

export function resolveAccessibleBackgroundDefinition(
  id: unknown,
  featureKeys: string[] = [],
  category?: BackgroundCategory,
) {
  const entry = getBackgroundDefinition(id)
  if ((!category || entry.category.includes(category)) && userCanUseBackground(entry, featureKeys)) {
    return entry
  }

  return getBackgroundDefinition(DEFAULT_BACKGROUND_ID)
}
