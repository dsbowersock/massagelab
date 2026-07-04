import type { CSSProperties, ComponentType } from "react"
import { DEFAULT_BACKGROUND_ID } from "../../lib/background-options.js"
import { hasPremiumBackgroundAccess } from "../../lib/membership.js"
import type { BackgroundEffectProps } from "./effects/css-backgrounds"

export type BackgroundId =
  | "massage-lab-moving-gradient"
  | "static-gradient"
  | "magic-particles"
  | "magic-noise-texture"
  | "magic-grid-pattern"
  | "magic-animated-grid"
  | "magicui-retro-grid"
  | "magicui-light-rays"
  | "chamaac-waves"
  | "chamaac-electric-mist"
  | "chamaac-astral-flow"
  | "chamaac-deep-space-nebula"
  | "chamaac-grid-bloom"
  | "chamaac-liquid-chrome"
  | "chamaac-light-speed"
  | "chamaac-synthesis"
  | "eldora-novatrix-background"
  | "eldora-hacker-background"
  | "eldora-photon-beam"
  | "aceternity-aurora"
  | "aceternity-dotted-glow"
  | "aceternity-sparkles"
  | "aceternity-gradient-animation"
  | "aceternity-background-beams"
  | "aceternity-background-beams-collision"
  | "aceternity-background-lines"
  | "aceternity-glowing-stars"
  | "aceternity-meteors"
  | "aceternity-shooting-stars"
  | "aceternity-canvas-reveal-dots"
  | "aceternity-spotlight-new"
  | "aceternity-lamp-effect"
  | "aceternity-vortex"
  | "aceternity-wavy-background"
  | "unlumen-pixel-liquid"
  | "massage-lab-tile-grid"
  | "massage-lab-hex-grid"
  | "unlumen-aurora-bars"
  | "animate-ui-bubble"
  | "animate-ui-gradient"
  | "animate-ui-stars"
  | "animate-ui-hole"

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
  component?: BackgroundComponentLoader
  fallbackClassName?: string
  fallbackStyle?: CSSProperties
}

const cssBackgrounds = () => import("./effects/css-backgrounds")
const chamaacLightSpeed = () => import("./effects/chamaac-light-speed-background")
const chamaacElectricMist = () => import("./effects/chamaac-electric-mist-background")
const chamaacAstralFlow = () => import("./effects/chamaac-astral-flow-background")
const chamaacDeepSpaceNebula = () => import("./effects/chamaac-deep-space-nebula-background")
const chamaacGridBloom = () => import("./effects/chamaac-grid-bloom-background")
const chamaacLiquidChrome = () => import("./effects/chamaac-liquid-chrome-background")
const chamaacWaves = () => import("./effects/chamaac-waves-background")
const chamaacSynthesis = () => import("./effects/chamaac-synthesis-background")
const eldoraNovatrix = () => import("./effects/eldora-novatrix-background")
const eldoraHacker = () => import("./effects/eldora-hacker-background")
const eldoraPhotonBeam = () => import("./effects/eldora-photon-beam-background")
const magicRetroGrid = () => import("./effects/magicui-retro-grid-background")
const magicLightRays = () => import("./effects/magicui-light-rays-background")
const aceternitySparkles = () => import("./effects/aceternity-sparkles")
const aceternityShootingStars = () => import("./effects/aceternity-shooting-stars-background")
const aceternityVortex = () => import("./effects/aceternity-vortex-background")
const aceternityWavy = () => import("./effects/aceternity-wavy-background")
const unlumenPixelLiquid = () => import("./effects/unlumen-pixel-liquid-background")
const massageLabTileGrid = () => import("./effects/massage-lab-tile-grid-background")
const massageLabHexGrid = () => import("./effects/massage-lab-hex-grid-background")
const unlumenAuroraBars = () => import("./effects/unlumen-aurora-bars-background")

export const backgroundRegistry: readonly BackgroundDefinition[] = [
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
    id: "magic-particles",
    label: "Particles",
    provider: "MassageLab draft",
    sourceUrl: "https://magicui.design/docs/components/particles",
    license: "MassageLab internal draft; Magic UI MIT source candidate not imported",
    licenseStatus: "verified",
    category: ["clock", "music", "ambient"],
    recommendedUse: "Draft placeholder for the Magic UI Particles candidate; review against the source demo before final activation.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: false,
    customizationSummary: "Draft: review against source demo before finalizing.",
    disabledReason: "Disabled during the background reset. Re-add only after source-matched implementation and user review.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MagicParticlesBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 35% 20%, rgba(255,255,255,0.12), transparent 28%), radial-gradient(circle at 80% 70%, rgba(65,105,225,0.2), transparent 34%), linear-gradient(145deg, #050505, #10141c)",
    },
  },
  {
    id: "magic-noise-texture",
    label: "Noise texture",
    provider: "MassageLab draft",
    sourceUrl: "https://magicui.design/docs/components/noise-texture",
    license: "MassageLab internal draft; Magic UI MIT source candidate not imported",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Draft placeholder for the Magic UI Noise Texture candidate; review against the source demo before final activation.",
    motionIntensity: "static",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: false,
    customizationSummary: "Draft: review against source demo before finalizing.",
    disabledReason: "Disabled during the background reset. Re-add only after source-matched implementation and user review.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MagicNoiseTextureBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 35%, rgba(255,122,26,0.18), transparent 36%), linear-gradient(145deg, #050505, #121212)",
    },
  },
  {
    id: "magic-grid-pattern",
    label: "Grid pattern",
    provider: "MassageLab draft",
    sourceUrl: "https://magicui.design/docs/components/grid-pattern",
    license: "MassageLab internal draft; Magic UI MIT source candidate not imported",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Draft placeholder for the Magic UI Grid Pattern candidate; review against the source demo before final activation.",
    motionIntensity: "static",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: false,
    customizationSummary: "Draft: review against source demo before finalizing.",
    disabledReason: "Disabled during the background reset. Re-add only after source-matched implementation and user review.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MagicGridPatternBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at center, rgba(255,255,255,0.07), transparent 36%), linear-gradient(145deg, #050505, #111827)",
    },
  },
  {
    id: "magic-animated-grid",
    label: "Animated grid",
    provider: "MassageLab draft",
    sourceUrl: "https://magicui.design/docs/components/animated-grid-pattern",
    license: "MassageLab internal draft; Magic UI MIT source candidate not imported",
    licenseStatus: "verified",
    category: ["music", "ambient"],
    recommendedUse: "Draft placeholder for the Magic UI Animated Grid candidate; review against the source demo before final activation.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: false,
    customizationSummary: "Draft: review against source demo before finalizing.",
    disabledReason: "Disabled during the background reset. Re-add only after source-matched implementation and user review.",
    component: () => cssBackgrounds().then((module) => ({ default: module.MagicAnimatedGridBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 48% 42%, rgba(255,255,255,0.08), transparent 34%), linear-gradient(145deg, #050505, #101827)",
    },
  },
  {
    id: "magicui-retro-grid",
    label: "Retro Grid",
    provider: "Magic UI",
    sourceUrl: "https://magicui.design/docs/components/retro-grid",
    license: "MIT; Magic UI repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium scrolling perspective-grid background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background fill, light and dark grid line colors, source angle, cell size, and opacity; source WebGL grid adapted with CSS fallback, reduced motion, and cleanup.",
    component: () => magicRetroGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 72%, rgba(128,128,128,0.16), transparent 38%), linear-gradient(180deg, #020617 0%, #050505 100%)",
    },
  },
  {
    id: "magicui-light-rays",
    label: "Light Rays",
    provider: "Magic UI",
    sourceUrl: "https://magicui.design/docs/components/light-rays",
    license: "MIT; Magic UI repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium softly animated top-down light-ray background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background fill, ray color, source ray count, blur, cycle speed, ray length, and opacity; source Motion animation adapted with native CSS keyframes, reduced motion, and no new dependency.",
    component: () => magicLightRays().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 20% 15%, rgba(160,210,255,0.2), transparent 58%), radial-gradient(circle at 80% 10%, rgba(160,210,255,0.14), transparent 62%), #020617",
    },
  },
  {
    id: "chamaac-waves",
    label: "Waves",
    provider: "Chamaac UI",
    sourceUrl: "https://www.chamaac.com/components/backgrounds/waves",
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
    component: () => chamaacWaves().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 54% 36%, rgba(0,212,255,0.22), transparent 34%), radial-gradient(circle at 36% 64%, rgba(7,22,151,0.32), transparent 44%), #000000",
    },
  },
  {
    id: "chamaac-electric-mist",
    label: "Electric Mist",
    provider: "Chamaac UI",
    sourceUrl: "https://www.chamaac.com/components/backgrounds/electric-mist",
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
    component: () => chamaacElectricMist().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(86,189,255,0.18), transparent 28%), linear-gradient(135deg, #050505, #07111b)",
    },
  },
  {
    id: "chamaac-astral-flow",
    label: "Astral Flow",
    provider: "Chamaac UI",
    sourceUrl: "https://www.chamaac.com/components/backgrounds/astral-flow",
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
    component: () => chamaacAstralFlow().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(160,118,154,0.22), transparent 42%), linear-gradient(145deg, #05070a 0%, #140b1b 54%, #02030a 100%)",
    },
  },
  {
    id: "chamaac-deep-space-nebula",
    label: "Deep Space Nebula",
    provider: "Chamaac UI",
    sourceUrl: "https://www.chamaac.com/components/backgrounds/nebula",
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
    component: () => chamaacDeepSpaceNebula().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(118,59,101,0.24), transparent 42%), radial-gradient(circle at 62% 44%, rgba(94,255,244,0.12), transparent 26%), linear-gradient(145deg, #1a0b2e 0%, #090414 58%, #010104 100%)",
    },
  },
  {
    id: "chamaac-grid-bloom",
    label: "Grid Bloom",
    provider: "Chamaac UI",
    sourceUrl: "https://www.chamaac.com/components/backgrounds/grid-bloom",
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
    component: () => chamaacGridBloom().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(224,64,251,0.2), transparent 40%), linear-gradient(145deg, #07010c 0%, #13051d 58%, #020104 100%)",
    },
  },
  {
    id: "chamaac-liquid-chrome",
    label: "Liquid Chrome",
    provider: "Chamaac UI",
    sourceUrl: "https://www.chamaac.com/components/backgrounds/liquid-chrome",
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
    component: () => chamaacLiquidChrome().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 42% 34%, rgba(255,255,255,0.22), transparent 30%), radial-gradient(circle at 64% 56%, rgba(74,74,74,0.32), transparent 42%), linear-gradient(145deg, #111111 0%, #2e2e2e 52%, #070707 100%)",
    },
  },
  {
    id: "chamaac-light-speed",
    label: "Light Speed",
    provider: "Chamaac UI",
    sourceUrl: "https://www.chamaac.com/components/backgrounds/light-speed",
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
    component: () => chamaacLightSpeed().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(176,38,255,0.18), transparent 38%), radial-gradient(circle at 52% 50%, rgba(51,178,255,0.1), transparent 48%), #000000",
    },
  },
  {
    id: "chamaac-synthesis",
    label: "Synthesis",
    provider: "Chamaac UI",
    sourceUrl: "https://www.chamaac.com/components/backgrounds/synthesis",
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
    component: () => chamaacSynthesis().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 55% 42%, rgba(14,165,233,0.18), transparent 40%), radial-gradient(circle at 42% 55%, rgba(59,7,100,0.2), transparent 44%), linear-gradient(145deg, #0f172a 0%, #070512 56%, #020617 100%)",
    },
  },
  {
    id: "eldora-novatrix-background",
    label: "Novatrix Background",
    provider: "Eldora UI",
    sourceUrl: "https://www.eldoraui.site/docs/components/novatrix-background",
    license: "MIT; Eldora UI repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated WebGL field for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Color, color harmony, animation speed, and passive drift amplitude; source WebGL shader adapted with native canvas to avoid adding the source ogl dependency.",
    component: () => eldoraNovatrix().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18), transparent 34%), radial-gradient(circle at 68% 34%, rgba(160,196,255,0.14), transparent 30%), linear-gradient(145deg, #02030a 0%, #070814 58%, #000000 100%)",
    },
  },
  {
    id: "eldora-hacker-background",
    label: "Hacker Background",
    provider: "Eldora UI",
    sourceUrl: "https://www.eldoraui.site/docs/components/hacker-background",
    license: "MIT; Eldora UI repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium Matrix-style falling-character background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Character color, color harmony, font size, and falling speed; source 2D canvas behavior adapted with host sizing, reduced motion, and cleanup.",
    component: () => eldoraHacker().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 44%, rgba(0,255,0,0.12), transparent 34%), linear-gradient(180deg, #000000 0%, #020802 100%)",
    },
  },
  {
    id: "eldora-photon-beam",
    label: "Photon Beam",
    provider: "Eldora UI",
    sourceUrl: "https://www.eldoraui.site/docs/components/photon-beam",
    license: "MIT; Eldora UI repository reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated light-trail beam background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background, line, and signal colors with optional color harmony, plus source-shaped beam, signal, wave, trail, and bloom controls; adapted without adding Three.js.",
    component: () => eldoraPhotonBeam().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 58% 50%, rgba(0,217,255,0.16), transparent 38%), linear-gradient(180deg, #080808 0%, #020405 100%)",
    },
  },
  {
    id: "aceternity-aurora",
    label: "Aurora background",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/aurora-background",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium subtle aurora for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source-matched CSS aurora adapted for MassageLab surfaces.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityAuroraBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 100% 0%, rgba(59,130,246,0.18), transparent 48%), radial-gradient(circle at 58% 38%, rgba(165,180,252,0.14), transparent 40%), linear-gradient(145deg, #050505, #111827)",
    },
  },
  {
    id: "aceternity-dotted-glow",
    label: "Dotted glow background",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/dotted-glow-background",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium subtle dotted shimmer for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source-matched canvas shimmer adapted for MassageLab surfaces.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityDottedGlowBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(0,170,255,0.12), transparent 38%), radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 34%), linear-gradient(145deg, #050505, #101012)",
    },
  },
  {
    id: "aceternity-sparkles",
    label: "Sparkles",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/sparkles",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium particle field for Clock/Chimer tuning, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Particle color, density, and speed for Chimer and Clock.",
    component: () => aceternitySparkles().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 48%, rgba(99,193,255,0.12), transparent 32%), radial-gradient(circle at 18% 16%, rgba(255,122,26,0.1), transparent 28%), linear-gradient(145deg, #050505, #111111)",
    },
  },
  {
    id: "aceternity-gradient-animation",
    label: "Gradient animation",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/background-gradient-animation",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated gradient for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Background colors, glow colors, motion speed, and glow size for Chimer and Clock.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityGradientAnimationBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 42% 38%, rgba(18,113,255,0.22), transparent 34%), radial-gradient(circle at 64% 48%, rgba(221,74,255,0.16), transparent 32%), linear-gradient(40deg, rgb(20,8,42), rgb(0,17,82))",
    },
  },
  {
    id: "aceternity-background-beams",
    label: "Background beams",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/background-beams",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated SVG beam field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source-matched SVG paths adapted with native gradient animation and no added Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityBackgroundBeams })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 46%, rgba(24,204,252,0.12), transparent 34%), radial-gradient(circle at 70% 22%, rgba(174,72,255,0.12), transparent 30%), linear-gradient(145deg, #050505, #0a0e18)",
    },
  },
  {
    id: "aceternity-background-beams-collision",
    label: "Background beams with collision",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/background-beams-with-collision",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium falling beam and collision burst field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source beam/collision behavior adapted with CSS animation and no added Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityBackgroundBeamsWithCollision })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 46%, rgba(99,102,241,0.14), transparent 34%), radial-gradient(circle at 70% 22%, rgba(168,85,247,0.12), transparent 30%), linear-gradient(180deg, #050505 0%, #080b13 56%, #111827 100%)",
    },
  },
  {
    id: "aceternity-background-lines",
    label: "Background lines",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/background-lines",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated SVG line field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source SVG paths adapted with deterministic CSS path animation, duration control, and no added Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityBackgroundLines })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 45%, rgba(36,122,251,0.12), transparent 36%), radial-gradient(circle at 25% 78%, rgba(214,89,12,0.1), transparent 32%), linear-gradient(145deg, #050505, #080b12 60%, #050505)",
    },
  },
  {
    id: "aceternity-glowing-stars",
    label: "Glowing stars",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/glowing-stars-effect",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated star grid for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source star/glow cycle adapted without adding the source Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityGlowingStarsBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 42%, rgba(59,130,246,0.11), transparent 34%), radial-gradient(circle at 24% 82%, rgba(255,122,26,0.07), transparent 30%), linear-gradient(110deg, #141414 0.6%, #050505 100%)",
    },
  },
  {
    id: "aceternity-meteors",
    label: "Meteors",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/meteors",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium diagonal meteor field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source meteor direction and tail behavior adapted with deterministic CSS animation and no added Motion dependency.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityMeteorsBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 38%, rgba(100,116,139,0.14), transparent 34%), radial-gradient(circle at 22% 78%, rgba(255,122,26,0.08), transparent 30%), linear-gradient(145deg, #050505, #081018 62%, #050505)",
    },
  },
  {
    id: "aceternity-shooting-stars",
    label: "Shooting stars and stars background",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/shooting-stars-and-stars-background",
    license: "Aceternity License; source credits Vijay Verma / figmaplug.in",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium star field with occasional shooting stars for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Star colors, density, twinkle, shooting speed, and frequency for Chimer and Clock.",
    component: () => aceternityShootingStars().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(72,220,249,0.12), transparent 34%), radial-gradient(circle at 24% 78%, rgba(255,122,26,0.06), transparent 30%), linear-gradient(145deg, #020617 0%, #030712 48%, #050505 100%)",
    },
  },
  {
    id: "aceternity-canvas-reveal-dots",
    label: "Canvas reveal dots",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/canvas-reveal-effect",
    license: "Aceternity License; author Manu Arora; inspired by Clerk's website",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium dot matrix adapted from Canvas Reveal Effect for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Dot color, accent color, size, spacing, opacity, motion speed, and gradient overlay for Chimer and Clock.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityCanvasRevealDotsBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(0,255,255,0.1), transparent 34%), radial-gradient(circle at 74% 20%, rgba(34,211,238,0.08), transparent 30%), linear-gradient(145deg, #020617 0%, #07111b 52%, #050505 100%)",
    },
  },
  {
    id: "aceternity-spotlight-new",
    label: "Spotlight New",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/spotlight-new",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium mirrored spotlight beams for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Spotlight color, intensity, beam size, vertical offset, sweep, and speed for Chimer and Clock.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternitySpotlightNewBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 20% -10%, rgba(213,236,255,0.14), transparent 45%), radial-gradient(ellipse at 80% -10%, rgba(213,236,255,0.12), transparent 45%), linear-gradient(180deg, #020617 0%, #050505 72%, #000000 100%)",
    },
  },
  {
    id: "aceternity-lamp-effect",
    label: "Lamp Section Header",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/lamp-effect",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium centered lamp glow adapted from the Aceternity section-header effect.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Lamp beam color, background fill, glow intensity, beam width, glow width, vertical offset, and pulse speed for Chimer and Clock.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AceternityLampEffectBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 50% 40%, rgba(6,182,212,0.24), transparent 34%), radial-gradient(ellipse at 50% 24%, rgba(34,211,238,0.16), transparent 28%), linear-gradient(180deg, #020617 0%, #050505 76%, #000000 100%)",
    },
  },
  {
    id: "aceternity-wavy-background",
    label: "Wavy background",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/wavy-background",
    license: "Aceternity License; author Manu Arora",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated canvas waves for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Wave colors, width, background fill, blur, speed, and opacity for Chimer and Clock.",
    component: () => aceternityWavy().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 45%, rgba(56,189,248,0.12), transparent 36%), linear-gradient(180deg, #000000 0%, #020617 100%)",
    },
  },
  {
    id: "aceternity-vortex",
    label: "Vortex background",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/vortex",
    license: "Aceternity License; author Manu Arora; inspired by crnacura/AmbientCanvasBackgrounds",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium high-motion canvas vortex for Music and opt-in Chimer, Clock, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "high",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Particle count, hue, speed, vertical spread, radius, and background color for Chimer and Clock.",
    component: () => aceternityVortex().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 46%, rgba(59,130,246,0.14), transparent 34%), radial-gradient(circle at 24% 72%, rgba(34,211,238,0.09), transparent 32%), linear-gradient(145deg, #000000 0%, #020617 52%, #050505 100%)",
    },
  },
  {
    id: "unlumen-pixel-liquid",
    label: "Pixel liquid",
    provider: "Unlumen UI",
    sourceUrl: "https://ui.unlumen.com/components/pixel-liquid-bg",
    license: "Unlumen UI free/open-source component page reviewed 2026-07-02; internal app visual effect only",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium high-motion pixelated liquid field for Music and opt-in Chimer, Clock, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Background, base, accent, and highlight colors plus pixel size, detail, and motion speed for Chimer and Clock.",
    component: () => unlumenPixelLiquid().then((module) => ({ default: module.default })),
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
    id: "unlumen-aurora-bars",
    label: "Aurora bars",
    provider: "Unlumen UI",
    sourceUrl: "https://ui.unlumen.com/components/aurora-bars",
    license: "Unlumen UI free component license reviewed 2026-07-03; original idea credited to @SannaGranqvistX / Framer",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium aurora bar field for Chimer, Clock, Music, and future ambient mode; visualizer mode is only enabled by Music playback surfaces.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Chimer/Clock controls for background, auto monochrome or custom five-color bars, bar count, speed, blur, gap, and min/max height; Music can opt into visualizer mode.",
    component: () => unlumenAuroraBars().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 50% 68%, rgba(255,90,166,0.18), transparent 42%), radial-gradient(ellipse at 50% 92%, rgba(255,214,235,0.2), transparent 26%), linear-gradient(180deg, #000000 0%, #08010a 100%)",
    },
  },
  {
    id: "animate-ui-bubble",
    label: "Bubble background",
    provider: "Animate UI",
    sourceUrl: "https://animate-ui.com/docs/components/backgrounds/bubble",
    license: "MIT + Commons Clause; copyright 2025 Elliot Sutton; reviewed 2026-07-03",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium soft bubble field for Chimer, Clock, Music, and future ambient mode; cursor interaction is intentionally disabled.",
    motionIntensity: "medium",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Source bubble colors and motion adapted with native CSS; cursor interactivity and the sixth mouse-following bubble are intentionally omitted.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AnimateUiBubbleBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 28% 22%, rgba(18,113,255,0.32), transparent 36%), radial-gradient(circle at 72% 42%, rgba(221,74,255,0.24), transparent 34%), linear-gradient(135deg, #2e1065 0%, #1e3a8a 100%)",
    },
  },
  {
    id: "animate-ui-gradient",
    label: "Gradient background",
    provider: "Animate UI",
    sourceUrl: "https://animate-ui.com/docs/components/backgrounds/gradient",
    license: "MIT + Commons Clause; copyright 2025 Elliot Sutton; reviewed 2026-07-03",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated gradient field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "subtle",
    performanceCost: "low",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Primary color, color harmony, and layer opacity for Chimer and Clock; source Motion transition is adapted with native CSS keyframes.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AnimateUiGradientBackground })),
    fallbackStyle: {
      background:
        "linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(168,85,247,0.9) 50%, rgba(236,72,153,0.9) 100%)",
    },
  },
  {
    id: "animate-ui-stars",
    label: "Stars background",
    provider: "Animate UI",
    sourceUrl: "https://animate-ui.com/docs/components/backgrounds/stars",
    license: "MIT + Commons Clause; copyright 2025 Elliot Sutton; reviewed 2026-07-03",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated star field for Chimer, Clock, Music, and future ambient treatment-room mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Star color, speed, density, and parallax strength for Chimer and Clock; source Motion animation is adapted with CSS keyframes.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AnimateUiStarsBackground })),
    fallbackStyle: {
      background: "radial-gradient(ellipse at bottom, #262626 0%, #000000 100%)",
    },
  },
  {
    id: "animate-ui-hole",
    label: "Hole background",
    provider: "Animate UI",
    sourceUrl: "https://animate-ui.com/docs/components/backgrounds/hole",
    license: "MIT + Commons Clause; copyright 2025 Elliot Sutton; reviewed 2026-07-03",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium animated hole-grid field for Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary: "Stroke color, particle color, line count, and disc count for Chimer and Clock; source Motion glow is adapted with CSS and canvas animation.",
    component: () => cssBackgrounds().then((module) => ({ default: module.AnimateUiHoleBackground })),
    fallbackStyle: {
      background:
        "radial-gradient(ellipse at 50% 46%, rgba(255,255,255,0.08), transparent 34%), radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0.62), rgba(0,0,0,0.94)), linear-gradient(180deg, #030712 0%, #050505 100%)",
    },
  },
] as const

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
