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
  | "react-bits-ferrofluid"
  | "react-bits-lightfall"
  | "react-bits-liquid-ether"
  | "react-bits-prism"
  | "react-bits-dark-veil"
  | "react-bits-light-pillar"
  | "react-bits-silk"
  | "react-bits-floating-lines"
  | "react-bits-side-rays"
  | "react-bits-light-rays"
  | "react-bits-pixel-blast"
  | "react-bits-color-bends"
  | "react-bits-evil-eye"
  | "react-bits-line-waves"
  | "react-bits-radar"
  | "react-bits-soft-aurora"
  | "react-bits-plasma"
  | "react-bits-plasma-wave"
  | "react-bits-particles"
  | "react-bits-gradient-blinds"
  | "react-bits-grainient"
  | "react-bits-grid-scan"
  | "react-bits-beams"
  | "react-bits-pixel-snow"
  | "react-bits-lightning"
  | "react-bits-prismatic-burst"
  | "react-bits-galaxy"
  | "react-bits-dither"
  | "react-bits-faulty-terminal"
  | "react-bits-ripple-grid"
  | "react-bits-dot-field"
  | "react-bits-dot-grid"
  | "react-bits-threads"
  | "react-bits-iridescence"
  | "eldora-novatrix-background"
  | "eldora-hacker-background"
  | "eldora-photon-beam"
  | "aceternity-3d-globe"
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
const reactBitsFerrofluid = () => import("./effects/react-bits-ferrofluid-background")
const reactBitsLightfall = () => import("./effects/react-bits-lightfall-background")
const reactBitsLiquidEther = () => import("./effects/react-bits-liquid-ether-background")
const reactBitsPrism = () => import("./effects/react-bits-prism-background")
const reactBitsDarkVeil = () => import("./effects/react-bits-dark-veil-background")
const reactBitsLightPillar = () => import("./effects/react-bits-light-pillar-background")
const reactBitsSilk = () => import("./effects/react-bits-silk-background")
const reactBitsFloatingLines = () => import("./effects/react-bits-floating-lines-background")
const reactBitsSideRays = () => import("./effects/react-bits-side-rays-background")
const reactBitsLightRays = () => import("./effects/react-bits-light-rays-background")
const reactBitsPixelBlast = () => import("./effects/react-bits-pixel-blast-background")
const reactBitsColorBends = () => import("./effects/react-bits-color-bends-background")
const reactBitsEvilEye = () => import("./effects/react-bits-evil-eye-background")
const reactBitsLineWaves = () => import("./effects/react-bits-line-waves-background")
const reactBitsRadar = () => import("./effects/react-bits-radar-background")
const reactBitsSoftAurora = () => import("./effects/react-bits-soft-aurora-background")
const reactBitsPlasma = () => import("./effects/react-bits-plasma-background")
const reactBitsPlasmaWave = () => import("./effects/react-bits-plasma-wave-background")
const reactBitsParticles = () => import("./effects/react-bits-particles-background")
const reactBitsGradientBlinds = () => import("./effects/react-bits-gradient-blinds-background")
const reactBitsGrainient = () => import("./effects/react-bits-grainient-background")
const reactBitsGridScan = () => import("./effects/react-bits-grid-scan-background")
const reactBitsBeams = () => import("./effects/react-bits-beams-background")
const reactBitsPixelSnow = () => import("./effects/react-bits-pixel-snow-background")
const reactBitsLightning = () => import("./effects/react-bits-lightning-background")
const reactBitsPrismaticBurst = () => import("./effects/react-bits-prismatic-burst-background")
const reactBitsGalaxy = () => import("./effects/react-bits-galaxy-background")
const reactBitsDither = () => import("./effects/react-bits-dither-background")
const reactBitsFaultyTerminal = () => import("./effects/react-bits-faulty-terminal-background")
const reactBitsRippleGrid = () => import("./effects/react-bits-ripple-grid-background")
const reactBitsDotField = () => import("./effects/react-bits-dot-field-background")
const reactBitsDotGrid = () => import("./effects/react-bits-dot-grid-background")
const reactBitsThreads = () => import("./effects/react-bits-threads-background")
const reactBitsIridescence = () => import("./effects/react-bits-iridescence-background")
const eldoraNovatrix = () => import("./effects/eldora-novatrix-background")
const eldoraHacker = () => import("./effects/eldora-hacker-background")
const eldoraPhotonBeam = () => import("./effects/eldora-photon-beam-background")
const aceternity3DGlobe = () => import("./effects/aceternity-3d-globe-background")
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
    id: "react-bits-ferrofluid",
    label: "Ferrofluid",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/ferrofluid",
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
    component: () => reactBitsFerrofluid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 52% 48%, rgba(255,255,255,0.18), transparent 34%), radial-gradient(circle at 34% 72%, rgba(96,165,250,0.1), transparent 28%), linear-gradient(145deg, #020617 0%, #040711 58%, #000000 100%)",
    },
  },
  {
    id: "react-bits-lightfall",
    label: "Lightfall",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/lightfall",
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
    component: () => reactBitsLightfall().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 44%, rgba(166,200,255,0.18), transparent 34%), radial-gradient(circle at 62% 58%, rgba(255,159,252,0.1), transparent 30%), linear-gradient(145deg, #0615a8 0%, #091d5c 54%, #030614 100%)",
    },
  },
  {
    id: "react-bits-liquid-ether",
    label: "Liquid Ether",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/liquid-ether",
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
    component: () => reactBitsLiquidEther().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 42% 46%, rgba(82,39,255,0.24), transparent 36%), radial-gradient(circle at 62% 58%, rgba(255,159,252,0.18), transparent 34%), linear-gradient(145deg, #070015 0%, #13072f 58%, #02010a 100%)",
    },
  },
  {
    id: "react-bits-prism",
    label: "Prism",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/prism",
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
    component: () => reactBitsPrism().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 48%, rgba(190,145,255,0.22), transparent 36%), radial-gradient(circle at 64% 52%, rgba(255,90,198,0.14), transparent 32%), linear-gradient(145deg, #090214 0%, #17072f 58%, #02010a 100%)",
    },
  },
  {
    id: "react-bits-dark-veil",
    label: "Dark Veil",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/dark-veil",
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
    component: () => reactBitsDarkVeil().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 46% 52%, rgba(124,58,237,0.28), transparent 38%), radial-gradient(circle at 64% 44%, rgba(236,72,153,0.16), transparent 34%), linear-gradient(145deg, #05010d 0%, #12051f 58%, #020007 100%)",
    },
  },
  {
    id: "react-bits-light-pillar",
    label: "Light Pillar",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/light-pillar",
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
    component: () => reactBitsLightPillar().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 46%, rgba(82,39,255,0.24), transparent 32%), radial-gradient(circle at 50% 54%, rgba(255,159,252,0.18), transparent 42%), linear-gradient(145deg, #050013 0%, #120424 56%, #020007 100%)",
    },
  },
  {
    id: "react-bits-silk",
    label: "Silk",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/silk",
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
    component: () => reactBitsSilk().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 48% 44%, rgba(123,116,129,0.32), transparent 36%), radial-gradient(circle at 58% 58%, rgba(203,183,218,0.16), transparent 42%), linear-gradient(145deg, #07060a 0%, #181320 58%, #040307 100%)",
    },
  },
  {
    id: "react-bits-floating-lines",
    label: "Floating Lines",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/floating-lines",
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
    component: () => reactBitsFloatingLines().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 20% 12%, rgba(233,71,245,0.12), transparent 34%), radial-gradient(circle at 78% 88%, rgba(47,75,162,0.18), transparent 38%), linear-gradient(145deg, #02030a 0%, #060716 58%, #000000 100%)",
    },
  },
  {
    id: "react-bits-side-rays",
    label: "Side Rays",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/side-rays",
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
    component: () => reactBitsSideRays().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 86% 10%, rgba(234,179,8,0.2), transparent 36%), radial-gradient(circle at 82% 14%, rgba(150,200,255,0.16), transparent 42%), linear-gradient(145deg, #03040a 0%, #07101f 58%, #000000 100%)",
    },
  },
  {
    id: "react-bits-light-rays",
    label: "React Bits Light Rays",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/light-rays",
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
    component: () => reactBitsLightRays().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.24), transparent 42%), radial-gradient(circle at 42% 24%, rgba(160,210,255,0.16), transparent 42%), linear-gradient(180deg, #020617 0%, #05070d 100%)",
    },
  },
  {
    id: "react-bits-pixel-blast",
    label: "Pixel Blast",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/pixel-blast",
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
    component: () => reactBitsPixelBlast().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 48% 44%, rgba(180,151,207,0.26), transparent 38%), radial-gradient(circle at 62% 62%, rgba(82,39,255,0.16), transparent 42%), linear-gradient(145deg, #05020a 0%, #0f0820 58%, #020106 100%)",
    },
  },
  {
    id: "react-bits-color-bends",
    label: "Color Bends",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/color-bends",
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
    component: () => reactBitsColorBends().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 46% 48%, rgba(138,92,246,0.24), transparent 36%), radial-gradient(circle at 62% 52%, rgba(236,72,153,0.16), transparent 42%), linear-gradient(145deg, #05020a 0%, #10051e 58%, #020106 100%)",
    },
  },
  {
    id: "react-bits-evil-eye",
    label: "Evil Eye",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/evil-eye",
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
    component: () => reactBitsEvilEye().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,111,55,0.24), transparent 36%), radial-gradient(circle at 50% 50%, rgba(0,0,0,0.8), transparent 58%), #000000",
    },
  },
  {
    id: "react-bits-line-waves",
    label: "Line Waves",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/line-waves",
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
    component: () => reactBitsLineWaves().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08), transparent 38%), linear-gradient(135deg, #020617 0%, #05070d 100%)",
    },
  },
  {
    id: "react-bits-radar",
    label: "Radar",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/radar",
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
    component: () => reactBitsRadar().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(159,41,255,0.18), transparent 38%), linear-gradient(135deg, #000000 0%, #07030c 100%)",
    },
  },
  {
    id: "react-bits-soft-aurora",
    label: "Soft Aurora",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/soft-aurora",
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
    component: () => reactBitsSoftAurora().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 46% 64%, rgba(247,247,247,0.16), transparent 38%), radial-gradient(circle at 58% 66%, rgba(225,0,255,0.18), transparent 44%), linear-gradient(180deg, #05010d 0%, #10071e 58%, #020006 100%)",
    },
  },
  {
    id: "react-bits-plasma",
    label: "Plasma",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/plasma",
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
    component: () => reactBitsPlasma().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 52%, rgba(255,255,255,0.16), transparent 34%), radial-gradient(circle at 42% 60%, rgba(138,92,246,0.18), transparent 42%), linear-gradient(145deg, #05010d 0%, #12051f 58%, #020006 100%)",
    },
  },
  {
    id: "react-bits-plasma-wave",
    label: "Plasma Wave",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/plasma-wave",
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
    component: () => reactBitsPlasmaWave().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 42% 48%, rgba(168,85,247,0.18), transparent 36%), radial-gradient(circle at 62% 54%, rgba(6,182,212,0.16), transparent 42%), linear-gradient(145deg, #04030a 0%, #09111e 58%, #010105 100%)",
    },
  },
  {
    id: "react-bits-particles",
    label: "Particles",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/particles",
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
    component: () => reactBitsParticles().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12), transparent 35%), linear-gradient(145deg, #02030a 0%, #060812 58%, #000104 100%)",
    },
  },
  {
    id: "react-bits-gradient-blinds",
    label: "Gradient Blinds",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/gradient-blinds",
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
    component: () => reactBitsGradientBlinds().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "linear-gradient(90deg, rgba(255,159,252,0.28), rgba(82,39,255,0.3)), linear-gradient(145deg, #05010d 0%, #12051f 58%, #020006 100%)",
    },
  },
  {
    id: "react-bits-grainient",
    label: "Grainient",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/grainient",
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
    component: () => reactBitsGrainient().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 30% 28%, rgba(255,159,252,0.2), transparent 36%), radial-gradient(circle at 70% 58%, rgba(82,39,255,0.24), transparent 42%), linear-gradient(145deg, #090012 0%, #140729 58%, #05020a 100%)",
    },
  },
  {
    id: "react-bits-grid-scan",
    label: "Grid Scan",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/grid-scan",
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
    component: () => reactBitsGridScan().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 46%, rgba(255,159,252,0.14), transparent 32%), linear-gradient(145deg, #05030a 0%, #100719 58%, #020106 100%)",
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
    id: "react-bits-beams",
    label: "Beams",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/beams",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium stacked light-beam shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source white or custom/harmony light color plus source-shaped beam width, height, count, speed, noise, scale, and rotation; raw WebGL port of the React Bits stacked-plane displacement shader without Three/R3F.",
    component: () => reactBitsBeams().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 32%, rgba(255,255,255,0.14), transparent 34%), linear-gradient(180deg, #000000 0%, #050505 100%)",
    },
  },
  {
    id: "react-bits-pixel-snow",
    label: "Pixel Snow",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/pixel-snow",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium pixelated ray-marched snow background for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "high",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source white or custom/harmony snow color plus source-shaped flake size, minimum flake size, pixel resolution, speed, depth fade, far plane, brightness, gamma, density, variant, and direction; WebGL2 port of the React Bits fragment shader without Three/R3F.",
    component: () => reactBitsPixelSnow().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.16), transparent 38%), linear-gradient(180deg, #020617 0%, #050505 100%)",
    },
  },
  {
    id: "react-bits-lightning",
    label: "Lightning",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/lightning",
    license: "MIT + Commons Clause; copyright 2026 David Haz; reviewed 2026-07-05",
    licenseStatus: "caution",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium lightning-bolt shader for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "high",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Source/custom/harmony hue plus source-shaped X offset, speed, intensity, and size controls; raw WebGL port of the React Bits lightning shader.",
    component: () => reactBitsLightning().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 42%, rgba(92,124,255,0.18), transparent 36%), linear-gradient(180deg, #02030a 0%, #000000 100%)",
    },
  },
  {
    id: "react-bits-prismatic-burst",
    label: "Prismatic Burst",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/prismatic-burst",
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
    component: () => reactBitsPrismaticBurst().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 45%, rgba(147,197,253,0.22), transparent 34%), radial-gradient(circle at 68% 32%, rgba(236,72,153,0.18), transparent 30%), #02030a",
    },
  },
  {
    id: "react-bits-galaxy",
    label: "Galaxy",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/galaxy",
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
    component: () => reactBitsGalaxy().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 44%, rgba(147,197,253,0.16), transparent 34%), radial-gradient(circle at 72% 24%, rgba(34,197,94,0.16), transparent 28%), #020617",
    },
  },
  {
    id: "react-bits-dither",
    label: "Dither",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/dither",
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
    component: () => reactBitsDither().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "linear-gradient(135deg, rgba(148,163,184,0.22), transparent 48%), repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 5px), #020617",
    },
  },
  {
    id: "react-bits-faulty-terminal",
    label: "Faulty Terminal",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/faulty-terminal",
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
    component: () => reactBitsFaultyTerminal().then((module) => ({ default: module.default })),
    fallbackStyle: {
      backgroundColor: "#000000",
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 12px)",
      backgroundSize: "100% 4px, 18px 18px",
    },
  },
  {
    id: "react-bits-ripple-grid",
    label: "Ripple Grid",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/ripple-grid",
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
    component: () => reactBitsRippleGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18), transparent 42%), linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px), #020617",
      backgroundSize: "100% 100%, 40px 40px, 40px 40px",
    },
  },
  {
    id: "react-bits-dot-field",
    label: "Dot Field",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/dot-field",
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
    component: () => reactBitsDotField().then((module) => ({ default: module.default })),
    fallbackStyle: {
      backgroundColor: "#080710",
      backgroundImage:
        "radial-gradient(circle at 2px 2px, rgba(180,151,207,0.32) 1px, transparent 1.8px), radial-gradient(circle at 50% 50%, rgba(18,15,23,0.85), transparent 32%)",
      backgroundSize: "18px 18px, 100% 100%",
    },
  },
  {
    id: "react-bits-dot-grid",
    label: "Dot Grid",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/dot-grid",
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
    component: () => reactBitsDotGrid().then((module) => ({ default: module.default })),
    fallbackStyle: {
      backgroundColor: "#05030f",
      backgroundImage: "radial-gradient(circle at 2px 2px, rgba(82,39,255,0.72) 2px, transparent 2.8px)",
      backgroundSize: "48px 48px",
    },
  },
  {
    id: "react-bits-threads",
    label: "Threads",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/threads",
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
    component: () => reactBitsThreads().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 58% 48%, rgba(255,255,255,0.16), transparent 34%), linear-gradient(145deg, #05040a 0%, #0f1018 58%, #020204 100%)",
    },
  },
  {
    id: "react-bits-iridescence",
    label: "Iridescence",
    provider: "React Bits",
    sourceUrl: "https://reactbits.dev/backgrounds/iridescence",
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
    component: () => reactBitsIridescence().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 40% 42%, rgba(255,255,255,0.22), transparent 34%), radial-gradient(circle at 64% 56%, rgba(140,120,255,0.2), transparent 40%), linear-gradient(145deg, #f5f7ff 0%, #b5c4ff 46%, #f7a6d8 100%)",
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
    id: "aceternity-3d-globe",
    label: "3D Globe",
    provider: "Aceternity UI",
    sourceUrl: "https://ui.aceternity.com/components/3d-globe",
    license: "Aceternity License; component registry reviewed 2026-07-04",
    licenseStatus: "verified",
    category: ["chimer", "clock", "music", "ambient"],
    recommendedUse: "Premium rotating globe background with optional location marker for opt-in Chimer, Clock, Music, and future ambient mode.",
    motionIntensity: "medium",
    performanceCost: "medium",
    requiresSubscription: true,
    enabled: true,
    customizationSummary:
      "Background, globe tint, manual or Follow Sun lighting, rotation speed with fixed reverse spin, screen pan, fixed axial tilt, scale, bump, atmosphere, wireframe, icon location markers, built-in MassageLab marker, and a Graphic view with structured stable map dots and Outer Glow; Aceternity Three.js source adapted with a dependency-free native WebGL sphere renderer and 2D marker overlay.",
    component: () => aceternity3DGlobe().then((module) => ({ default: module.default })),
    fallbackStyle: {
      background:
        "radial-gradient(circle at 50% 48%, rgba(77,166,255,0.24), transparent 34%), radial-gradient(circle at 36% 28%, rgba(255,255,255,0.12), transparent 24%), linear-gradient(145deg, #020617 0%, #06091a 54%, #000000 100%)",
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
