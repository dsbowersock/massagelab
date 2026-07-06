"use client"

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react"
import { MovingBackground } from "@/components/moving-background"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

export interface BackgroundEffectProps {
  className?: string
  mainColor?: string
  orbColor?: string
  sparkles?: SparklesBackgroundOptions
  gradientAnimation?: GradientAnimationOptions
  animateUiGradient?: AnimateUiGradientOptions
  animateUiHole?: AnimateUiHoleOptions
  animateUiStars?: AnimateUiStarsOptions
  chamaacLightSpeed?: ChamaacLightSpeedOptions
  chamaacElectricMist?: ChamaacElectricMistOptions
  chamaacAstralFlow?: ChamaacAstralFlowOptions
  chamaacDeepSpaceNebula?: ChamaacDeepSpaceNebulaOptions
  chamaacGridBloom?: ChamaacGridBloomOptions
  chamaacLiquidChrome?: ChamaacLiquidChromeOptions
  chamaacWaves?: ChamaacWavesOptions
  chamaacSynthesis?: ChamaacSynthesisOptions
  reactBitsFerrofluid?: ReactBitsFerrofluidOptions
  reactBitsLightfall?: ReactBitsLightfallOptions
  reactBitsLiquidEther?: ReactBitsLiquidEtherOptions
  reactBitsPrism?: ReactBitsPrismOptions
  reactBitsDarkVeil?: ReactBitsDarkVeilOptions
  reactBitsLightPillar?: ReactBitsLightPillarOptions
  reactBitsSilk?: ReactBitsSilkOptions
  reactBitsFloatingLines?: ReactBitsFloatingLinesOptions
  reactBitsSideRays?: ReactBitsSideRaysOptions
  reactBitsLightRays?: ReactBitsLightRaysOptions
  reactBitsPixelBlast?: ReactBitsPixelBlastOptions
  reactBitsColorBends?: ReactBitsColorBendsOptions
  reactBitsEvilEye?: ReactBitsEvilEyeOptions
  reactBitsLineWaves?: ReactBitsLineWavesOptions
  reactBitsRadar?: ReactBitsRadarOptions
  reactBitsSoftAurora?: ReactBitsSoftAuroraOptions
  reactBitsPlasma?: ReactBitsPlasmaOptions
  reactBitsPlasmaWave?: ReactBitsPlasmaWaveOptions
  reactBitsParticles?: ReactBitsParticlesOptions
  reactBitsGradientBlinds?: ReactBitsGradientBlindsOptions
  reactBitsGrainient?: ReactBitsGrainientOptions
  reactBitsGridScan?: ReactBitsGridScanOptions
  reactBitsBeams?: ReactBitsBeamsOptions
  reactBitsPixelSnow?: ReactBitsPixelSnowOptions
  reactBitsLightning?: ReactBitsLightningOptions
  reactBitsPrismaticBurst?: ReactBitsPrismaticBurstOptions
  reactBitsGalaxy?: ReactBitsGalaxyOptions
  reactBitsDither?: ReactBitsDitherOptions
  reactBitsFaultyTerminal?: ReactBitsFaultyTerminalOptions
  reactBitsRippleGrid?: ReactBitsRippleGridOptions
  reactBitsDotField?: ReactBitsDotFieldOptions
  reactBitsDotGrid?: ReactBitsDotGridOptions
  reactBitsThreads?: ReactBitsThreadsOptions
  reactBitsIridescence?: ReactBitsIridescenceOptions
  reactBitsWaves?: ReactBitsWavesOptions
  eldoraNovatrix?: EldoraNovatrixOptions
  eldoraHacker?: EldoraHackerOptions
  eldoraPhotonBeam?: EldoraPhotonBeamOptions
  magicRetroGrid?: MagicRetroGridOptions
  magicLightRays?: MagicLightRaysOptions
  aceternity3DGlobe?: Aceternity3DGlobeOptions
  backgroundLines?: BackgroundLinesOptions
  shootingStars?: ShootingStarsBackgroundOptions
  canvasRevealDots?: CanvasRevealDotsOptions
  spotlight?: SpotlightNewOptions
  lamp?: LampSectionOptions
  vortex?: VortexBackgroundOptions
  wavy?: WavyBackgroundOptions
  pixelLiquid?: PixelLiquidOptions
  tileGrid?: TileGridOptions
  hexGrid?: HexGridOptions
  auroraBars?: AuroraBarsOptions
}

export interface SparklesBackgroundOptions {
  particleColor?: string
  particleDensity?: number
  speed?: number
  minSize?: number
  maxSize?: number
}

export interface GradientAnimationOptions {
  backgroundStartColor?: string
  backgroundEndColor?: string
  firstColor?: string
  secondColor?: string
  thirdColor?: string
  fourthColor?: string
  fifthColor?: string
  speed?: number
  size?: number
}

export interface AnimateUiGradientOptions {
  primaryColor?: string
  harmony?: ColorHarmony
  opacity?: number
}

export interface AnimateUiHoleOptions {
  strokeColor?: string
  numberOfLines?: number
  numberOfDiscs?: number
  particleColor?: string
}

export interface AnimateUiStarsOptions {
  starColor?: string
  speed?: number
  density?: number
  factor?: number
}

export interface ChamaacLightSpeedOptions {
  particleCount?: number
  warpSpeed?: number
  lightColor?: string
  intensity?: number
  radius?: number
  cylinderLength?: number
}

export interface ChamaacElectricMistOptions {
  color?: string
  speed?: number
  detail?: number
  distortion?: number
  brightness?: number
}

export interface ChamaacAstralFlowOptions {
  color1?: string
  color2?: string
  color3?: string
  speed?: number
  flowMin?: number
  flowMax?: number
}

export interface ChamaacDeepSpaceNebulaOptions {
  color1?: string
  color2?: string
  color3?: string
  speed?: number
}

export interface ChamaacGridBloomOptions {
  color?: string
  speed?: number
  gridScale?: number
  rotationSpeed?: number
  fadeFalloff?: number
  distortionAmount?: number
  flowSpeedX?: number
  flowSpeedY?: number
}

export interface ChamaacLiquidChromeOptions {
  speed?: number
  timeScale?: number
  color?: string
  color2?: string
}

export interface ChamaacWavesOptions {
  backgroundColor?: string
  waveColor1?: string
  waveColor2?: string
  waveColor3?: string
  waveSpeedX?: number
  waveSpeedY?: number
  waveAmpX?: number
}

export interface ChamaacSynthesisOptions {
  color1?: string
  color2?: string
  color3?: string
  speed?: number
  complexity?: number
  scale?: number
  distortion?: number
  glowIntensity?: number
  flowFrequency?: number
  contrast?: number
}

export interface ReactBitsFerrofluidOptions {
  colors?: string[]
  speed?: number
  scale?: number
  turbulence?: number
  fluidity?: number
  rimWidth?: number
  sharpness?: number
  shimmer?: number
  glow?: number
  flowDirection?: "up" | "down" | "left" | "right"
  opacity?: number
}

export interface ReactBitsLightfallOptions {
  colors?: string[]
  backgroundColor?: string
  speed?: number
  streakCount?: number
  streakWidth?: number
  streakLength?: number
  glow?: number
  density?: number
  twinkle?: number
  zoom?: number
  backgroundGlow?: number
  opacity?: number
  mouseInteraction?: boolean
  mouseStrength?: number
  mouseRadius?: number
  mouseDampening?: number
}

export interface ReactBitsLiquidEtherOptions {
  colors?: string[]
  mouseInteraction?: boolean
  mouseForce?: number
  cursorSize?: number
  isViscous?: boolean
  viscous?: number
  iterationsViscous?: number
  iterationsPoisson?: number
  dt?: number
  bfecc?: boolean
  resolution?: number
  isBounce?: boolean
  autoDemo?: boolean
  autoSpeed?: number
  autoIntensity?: number
  autoResumeDelay?: number
  autoRampDuration?: number
  opacity?: number
}

export interface ReactBitsPrismOptions {
  height?: number
  baseWidth?: number
  animationType?: "rotate" | "3drotate" | "hover"
  glow?: number
  offsetX?: number
  offsetY?: number
  noise?: number
  transparent?: boolean
  scale?: number
  hueShift?: number
  colorFrequency?: number
  hoverStrength?: number
  inertia?: number
  bloom?: number
  timeScale?: number
}

export interface ReactBitsDarkVeilOptions {
  hueShift?: number
  noiseIntensity?: number
  scanlineIntensity?: number
  speed?: number
  scanlineFrequency?: number
  warpAmount?: number
  resolutionScale?: number
}

export interface ReactBitsLightPillarOptions {
  topColor?: string
  bottomColor?: string
  intensity?: number
  rotationSpeed?: number
  interactive?: boolean
  glowAmount?: number
  pillarWidth?: number
  pillarHeight?: number
  noiseIntensity?: number
  mixBlendMode?: "screen" | "normal" | "lighten" | "plus-lighter"
  pillarRotation?: number
  quality?: "low" | "medium" | "high"
}

export interface ReactBitsSilkOptions {
  color?: string
  speed?: number
  scale?: number
  noiseIntensity?: number
  rotation?: number
}

export interface ReactBitsFloatingLinesOptions {
  linesGradient?: string[]
  enableTop?: boolean
  enableMiddle?: boolean
  enableBottom?: boolean
  topLineCount?: number
  middleLineCount?: number
  bottomLineCount?: number
  topLineDistance?: number
  middleLineDistance?: number
  bottomLineDistance?: number
  topWaveX?: number
  topWaveY?: number
  topWaveRotate?: number
  middleWaveX?: number
  middleWaveY?: number
  middleWaveRotate?: number
  bottomWaveX?: number
  bottomWaveY?: number
  bottomWaveRotate?: number
  animationSpeed?: number
  interactive?: boolean
  bendRadius?: number
  bendStrength?: number
  mouseDamping?: number
  parallax?: boolean
  parallaxStrength?: number
  mixBlendMode?: "screen" | "normal" | "lighten" | "plus-lighter"
}

export interface ReactBitsSideRaysOptions {
  speed?: number
  rayColor1?: string
  rayColor2?: string
  intensity?: number
  spread?: number
  origin?: "top-right" | "top-left" | "bottom-right" | "bottom-left"
  tilt?: number
  saturation?: number
  blend?: number
  falloff?: number
  opacity?: number
}

export interface ReactBitsLightRaysOptions {
  raysOrigin?: "top-left" | "top-center" | "top-right" | "left" | "right" | "bottom-left" | "bottom-center" | "bottom-right"
  raysColor?: string
  raysSpeed?: number
  lightSpread?: number
  rayLength?: number
  pulsating?: boolean
  fadeDistance?: number
  saturation?: number
  followMouse?: boolean
  mouseInfluence?: number
  noiseAmount?: number
  distortion?: number
}

export interface ReactBitsPixelBlastOptions {
  variant?: "square" | "circle" | "triangle" | "diamond"
  pixelSize?: number
  color?: string
  antialias?: boolean
  patternScale?: number
  patternDensity?: number
  liquid?: boolean
  liquidStrength?: number
  liquidRadius?: number
  pixelSizeJitter?: number
  enableRipples?: boolean
  rippleIntensityScale?: number
  rippleThickness?: number
  rippleSpeed?: number
  liquidWobbleSpeed?: number
  autoPauseOffscreen?: boolean
  speed?: number
  transparent?: boolean
  edgeFade?: number
  noiseAmount?: number
}

export interface ReactBitsColorBendsOptions {
  rotation?: number
  speed?: number
  colors?: string[]
  transparent?: boolean
  autoRotate?: number
  scale?: number
  frequency?: number
  warpStrength?: number
  mouseInfluence?: number
  parallax?: number
  noise?: number
  iterations?: number
  intensity?: number
  bandWidth?: number
  interactive?: boolean
}

export interface ReactBitsEvilEyeOptions {
  eyeColor?: string
  intensity?: number
  pupilSize?: number
  irisWidth?: number
  glowIntensity?: number
  scale?: number
  noiseScale?: number
  pupilFollow?: number
  flameSpeed?: number
  backgroundColor?: string
  interactive?: boolean
}

export interface ReactBitsLineWavesOptions {
  speed?: number
  innerLineCount?: number
  outerLineCount?: number
  warpIntensity?: number
  rotation?: number
  edgeFadeWidth?: number
  colorCycleSpeed?: number
  brightness?: number
  color1?: string
  color2?: string
  color3?: string
  enableMouseInteraction?: boolean
  mouseInfluence?: number
}

export interface ReactBitsRadarOptions {
  speed?: number
  scale?: number
  ringCount?: number
  spokeCount?: number
  ringThickness?: number
  spokeThickness?: number
  sweepSpeed?: number
  sweepWidth?: number
  sweepLobes?: number
  color?: string
  backgroundColor?: string
  falloff?: number
  brightness?: number
  enableMouseInteraction?: boolean
  mouseInfluence?: number
}

export interface ReactBitsSoftAuroraOptions {
  speed?: number
  scale?: number
  brightness?: number
  color1?: string
  color2?: string
  noiseFrequency?: number
  noiseAmplitude?: number
  bandHeight?: number
  bandSpread?: number
  octaveDecay?: number
  layerOffset?: number
  colorSpeed?: number
  enableMouseInteraction?: boolean
  mouseInfluence?: number
}

export interface ReactBitsPlasmaOptions {
  color?: string
  speed?: number
  direction?: "forward" | "reverse" | "pingpong"
  scale?: number
  opacity?: number
  mouseInteractive?: boolean
}

export interface ReactBitsPlasmaWaveOptions {
  xOffset?: number
  yOffset?: number
  rotationDeg?: number
  focalLength?: number
  speed1?: number
  speed2?: number
  dir2?: 1 | -1
  bend1?: number
  bend2?: number
  colors?: string[]
}

export interface ReactBitsParticlesOptions {
  particleCount?: number
  particleSpread?: number
  speed?: number
  colors?: string[]
  moveParticlesOnHover?: boolean
  particleHoverFactor?: number
  alphaParticles?: boolean
  particleBaseSize?: number
  sizeRandomness?: number
  cameraDistance?: number
  disableRotation?: boolean
  pixelRatio?: number
}

export interface ReactBitsGradientBlindsOptions {
  dpr?: number
  gradientColors?: string[]
  angle?: number
  noise?: number
  blindCount?: number
  blindMinWidth?: number
  mouseDampening?: number
  mirrorGradient?: boolean
  spotlightRadius?: number
  spotlightSoftness?: number
  spotlightOpacity?: number
  distortAmount?: number
  shineDirection?: "left" | "right"
  mixBlendMode?: "normal" | "screen" | "lighten" | "plus-lighter"
  enableMouseInteraction?: boolean
}

export interface ReactBitsGrainientOptions {
  timeSpeed?: number
  colorBalance?: number
  warpStrength?: number
  warpFrequency?: number
  warpSpeed?: number
  warpAmplitude?: number
  blendAngle?: number
  blendSoftness?: number
  rotationAmount?: number
  noiseScale?: number
  grainAmount?: number
  grainScale?: number
  grainAnimated?: boolean
  contrast?: number
  gamma?: number
  saturation?: number
  centerX?: number
  centerY?: number
  zoom?: number
  color1?: string
  color2?: string
  color3?: string
}

export interface ReactBitsGridScanOptions {
  sensitivity?: number
  lineThickness?: number
  linesColor?: string
  scanColor?: string
  scanOpacity?: number
  gridScale?: number
  lineStyle?: "solid" | "dashed" | "dotted"
  lineJitter?: number
  scanDirection?: "forward" | "backward" | "pingpong"
  noiseIntensity?: number
  bloomOpacity?: number
  scanGlow?: number
  scanSoftness?: number
  scanPhaseTaper?: number
  scanDuration?: number
  scanDelay?: number
  enablePointerInteraction?: boolean
  scanOnClick?: boolean
}

export interface ReactBitsBeamsOptions {
  beamWidth?: number
  beamHeight?: number
  beamNumber?: number
  lightColor?: string
  speed?: number
  noiseIntensity?: number
  scale?: number
  rotation?: number
}

export interface ReactBitsPixelSnowOptions {
  color?: string
  flakeSize?: number
  minFlakeSize?: number
  pixelResolution?: number
  speed?: number
  depthFade?: number
  farPlane?: number
  brightness?: number
  gamma?: number
  density?: number
  variant?: "square" | "round" | "snowflake"
  direction?: number
}

export interface ReactBitsLightningOptions {
  hue?: number
  xOffset?: number
  speed?: number
  intensity?: number
  size?: number
}

export interface ReactBitsPrismaticBurstOptions {
  intensity?: number
  speed?: number
  animationType?: "rotate" | "rotate3d" | "hover"
  colors?: string[]
  distort?: number
  offsetX?: number
  offsetY?: number
  hoverDampness?: number
  rayCount?: number
  mixBlendMode?: "lighten" | "screen" | "none"
}

export interface ReactBitsGalaxyOptions {
  focalX?: number
  focalY?: number
  rotationDeg?: number
  starSpeed?: number
  density?: number
  hueShift?: number
  speed?: number
  mouseInteraction?: boolean
  glowIntensity?: number
  saturation?: number
  mouseRepulsion?: boolean
  repulsionStrength?: number
  twinkleIntensity?: number
  rotationSpeed?: number
  autoCenterRepulsion?: number
  transparent?: boolean
}

export interface ReactBitsDitherOptions {
  color?: string
  waveSpeed?: number
  waveFrequency?: number
  waveAmplitude?: number
  colorNum?: number
  pixelSize?: number
  mouseInteraction?: boolean
  mouseRadius?: number
}

export interface ReactBitsFaultyTerminalOptions {
  scale?: number
  gridMulX?: number
  gridMulY?: number
  digitSize?: number
  timeScale?: number
  scanlineIntensity?: number
  glitchAmount?: number
  flickerAmount?: number
  noiseAmp?: number
  chromaticAberration?: number
  dither?: number
  curvature?: number
  tint?: string
  mouseReact?: boolean
  mouseStrength?: number
  pageLoadAnimation?: boolean
  brightness?: number
}

export interface ReactBitsRippleGridOptions {
  enableRainbow?: boolean
  gridColor?: string
  rippleIntensity?: number
  gridSize?: number
  gridThickness?: number
  fadeDistance?: number
  vignetteStrength?: number
  glowIntensity?: number
  opacity?: number
  gridRotation?: number
  mouseInteraction?: boolean
  mouseInteractionRadius?: number
}

export interface ReactBitsDotFieldOptions {
  dotRadius?: number
  dotSpacing?: number
  cursorRadius?: number
  cursorForce?: number
  bulgeOnly?: boolean
  bulgeStrength?: number
  glowRadius?: number
  sparkle?: boolean
  waveAmplitude?: number
  gradientFrom?: string
  gradientTo?: string
  glowColor?: string
  cursorInteraction?: boolean
}

export interface ReactBitsDotGridOptions {
  dotSize?: number
  gap?: number
  baseColor?: string
  activeColor?: string
  proximity?: number
  speedTrigger?: number
  shockRadius?: number
  shockStrength?: number
  maxSpeed?: number
  resistance?: number
  returnDuration?: number
  cursorInteraction?: boolean
  clickShock?: boolean
}

export interface ReactBitsThreadsOptions {
  color?: string
  amplitude?: number
  distance?: number
  enableMouseInteraction?: boolean
}

export interface ReactBitsIridescenceOptions {
  color?: string
  speed?: number
  amplitude?: number
  mouseReact?: boolean
}

export interface ReactBitsWavesOptions {
  lineColor?: string
  backgroundColor?: string
  transparentBackground?: boolean
  waveSpeedX?: number
  waveSpeedY?: number
  waveAmpX?: number
  waveAmpY?: number
  xGap?: number
  yGap?: number
  friction?: number
  tension?: number
  maxCursorMove?: number
  cursorInteraction?: boolean
}

export interface EldoraNovatrixOptions {
  color?: string
  speed?: number
  amplitude?: number
}

export interface EldoraHackerOptions {
  color?: string
  fontSize?: number
  speed?: number
}

export interface EldoraPhotonBeamOptions {
  colorBg?: string
  colorLine?: string
  colorSignal?: string
  useColor2?: boolean
  colorSignal2?: string
  useColor3?: boolean
  colorSignal3?: string
  lineCount?: number
  spreadHeight?: number
  spreadDepth?: number
  curveLength?: number
  straightLength?: number
  curvePower?: number
  waveSpeed?: number
  waveHeight?: number
  lineOpacity?: number
  signalCount?: number
  speedGlobal?: number
  trailLength?: number
  bloomStrength?: number
  bloomRadius?: number
}

export interface MagicRetroGridOptions {
  angle?: number
  cellSize?: number
  opacity?: number
  lightLineColor?: string
  darkLineColor?: string
  backgroundColor?: string
}

export interface MagicLightRaysOptions {
  backgroundColor?: string
  color?: string
  count?: number
  blur?: number
  speed?: number
  length?: number
  opacity?: number
}

export interface Aceternity3DGlobeOptions {
  viewStyle?: "realistic" | "graphic"
  backgroundColor?: string
  globeColor?: string
  graphicMapColor?: string
  graphicGlowColor?: string
  graphicMarkerColor?: string
  graphicMapSamples?: number
  autoRotateSpeed?: number
  reverseSpin?: boolean
  globeScale?: number
  bumpScale?: number
  ambientIntensity?: number
  pointLightIntensity?: number
  lightingMode?: "manual" | "sun"
  enablePan?: boolean
  panX?: number
  panY?: number
  showTilt?: boolean
  showAtmosphere?: boolean
  atmosphereColor?: string
  atmosphereIntensity?: number
  atmosphereBlur?: number
  showWireframe?: boolean
  wireframeColor?: string
  markerEnabled?: boolean
  markerLat?: number
  markerLng?: number
  markerLabel?: string
  markerIcon?: "pin" | "person" | "heart" | "star" | "home"
  markerSize?: number
}

export type ColorHarmony =
  | "analogous"
  | "complementary"
  | "split-complementary"
  | "triad"
  | "square"
  | "compound"
  | "shades"
  | "monochromatic"

export type AnimateUiGradientHarmony = ColorHarmony

export interface BackgroundLinesOptions {
  duration?: number
}

export interface ShootingStarsBackgroundOptions {
  starColor?: string
  trailColor?: string
  shootingStarColor?: string
  starDensity?: number
  twinkle?: boolean
  twinkleSpeed?: number
  shootingStarSpeed?: number
  shootingStarFrequency?: number
}

export interface CanvasRevealDotsOptions {
  backgroundColor?: string
  dotColor?: string
  accentColor?: string
  dotSize?: number
  dotSpacing?: number
  opacity?: number
  animationSpeed?: number
  showGradient?: boolean
}

export interface SpotlightNewOptions {
  color?: string
  opacity?: number
  width?: number
  height?: number
  smallWidth?: number
  translateY?: number
  duration?: number
  xOffset?: number
}

export interface LampSectionOptions {
  backgroundColor?: string
  color?: string
  glowOpacity?: number
  beamWidth?: number
  glowWidth?: number
  verticalOffset?: number
  pulseSpeed?: number
}

export interface VortexBackgroundOptions {
  particleCount?: number
  rangeY?: number
  baseHue?: number
  baseSpeed?: number
  rangeSpeed?: number
  baseRadius?: number
  rangeRadius?: number
  backgroundColor?: string
}

export interface WavyBackgroundOptions {
  colors?: string[]
  waveWidth?: number
  backgroundFill?: string
  blur?: number
  speed?: "slow" | "fast"
  waveOpacity?: number
}

export interface PixelLiquidOptions {
  backgroundColor?: string
  baseColor?: string
  accentColor?: string
  highlightColor?: string
  pixelSize?: number
  detail?: "low" | "medium" | "high"
  motionSpeed?: number
}

export interface TileGridOptions {
  paletteMode?: "auto" | "custom"
  primaryColor?: string
  colors?: string[]
  tileSize?: number
  jointSize?: number
  changeFrequency?: number
  activePercent?: number
  opacity?: number
}

export interface HexGridOptions {
  primaryColor?: string
  harmony?: ColorHarmony
  hexSize?: number
  jointSize?: number
  changeFrequency?: number
  activePercent?: number
  opacity?: number
}

export interface AuroraBarsOptions {
  paletteMode?: "auto" | "custom"
  primaryColor?: string
  barCount?: number
  colors?: string[]
  maxHeightRatio?: number
  minHeightRatio?: number
  speed?: number
  gap?: number
  blur?: number
  background?: string
  visualizerActive?: boolean
  audioLevel?: number
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
}

type DottedGlowDot = {
  x: number
  y: number
  phase: number
  speed: number
}

type RgbColor = [number, number, number]

type CanvasRevealDot = {
  x: number
  y: number
  opacity: number
  colorIndex: number
  phase: number
  speed: number
  sizeFactor: number
}

type AnimateUiHoleParticle = {
  x: number
  sx: number
  dx: number
  y: number
  vy: number
  progress: number
  radius: number
  color: string
}

type AnimateUiHoleDisc = {
  p: number
  x: number
  y: number
  w: number
  h: number
}

type AnimateUiHolePoint = {
  x: number
  y: number
}

const highlightedGridSquares = new Set([3, 8, 17, 24, 35, 48, 59, 66, 81, 90])
const sparkles = [
  ["12%", "22%", "3px", "-0.3s"],
  ["21%", "68%", "2px", "-1.2s"],
  ["33%", "38%", "4px", "-2.1s"],
  ["48%", "16%", "2px", "-3.4s"],
  ["58%", "74%", "3px", "-1.8s"],
  ["69%", "31%", "2px", "-0.7s"],
  ["78%", "58%", "4px", "-2.8s"],
  ["88%", "24%", "2px", "-4.1s"],
] as const

const DEFAULT_GRADIENT_ANIMATION: Required<GradientAnimationOptions> = {
  backgroundStartColor: "#2A063F",
  backgroundEndColor: "#000D52",
  firstColor: "#1271FF",
  secondColor: "#DD4AFF",
  thirdColor: "#64DCFF",
  fourthColor: "#C83232",
  fifthColor: "#B4B432",
  speed: 1,
  size: 80,
}

const DEFAULT_ANIMATE_UI_GRADIENT: Required<AnimateUiGradientOptions> = {
  primaryColor: "#3B82F6",
  harmony: "analogous",
  opacity: 1,
}

const DEFAULT_ANIMATE_UI_HOLE: Required<AnimateUiHoleOptions> = {
  strokeColor: "#737373",
  numberOfLines: 50,
  numberOfDiscs: 50,
  particleColor: "#FFFFFF",
}

const DEFAULT_ANIMATE_UI_STARS: Required<AnimateUiStarsOptions> = {
  starColor: "#FFFFFF",
  speed: 50,
  density: 1,
  factor: 0.05,
}

const animateUiGradientHarmonies = new Set<AnimateUiGradientHarmony>([
  "analogous",
  "complementary",
  "split-complementary",
  "triad",
  "square",
  "compound",
  "shades",
  "monochromatic",
])

const DEFAULT_BACKGROUND_LINES: Required<BackgroundLinesOptions> = {
  duration: 10,
}

const DEFAULT_CANVAS_REVEAL_DOTS: Required<CanvasRevealDotsOptions> = {
  backgroundColor: "#020617",
  dotColor: "#00FFFF",
  accentColor: "#22D3EE",
  dotSize: 3,
  dotSpacing: 6,
  opacity: 0.72,
  animationSpeed: 0.4,
  showGradient: false,
}

const DEFAULT_SPOTLIGHT_NEW: Required<SpotlightNewOptions> = {
  color: "#D5ECFF",
  opacity: 1,
  width: 560,
  height: 1380,
  smallWidth: 240,
  translateY: -350,
  duration: 7,
  xOffset: 100,
}

const DEFAULT_LAMP_SECTION: Required<LampSectionOptions> = {
  backgroundColor: "#020617",
  color: "#06B6D4",
  glowOpacity: 0.5,
  beamWidth: 480,
  glowWidth: 448,
  verticalOffset: -112,
  pulseSpeed: 9,
}

const LEGACY_CANVAS_REVEAL_DOTS: Required<CanvasRevealDotsOptions> = {
  backgroundColor: "#000000",
  dotColor: "#00FFFF",
  accentColor: "#FF7A1A",
  dotSize: 1.6,
  dotSpacing: 8,
  opacity: 0.34,
  animationSpeed: 0.4,
  showGradient: true,
}

const canvasRevealDotOpacities = [0.12, 0.16, 0.2, 0.28, 0.38, 0.5, 0.62, 0.74, 0.88, 1] as const

const glowingStarsCount = 216
const glowingStarsColumns = 18
const glowingStarsRows = 12
const glowingStarIndexes = Array.from({ length: glowingStarsCount }, (_, index) => index)
const meteorCount = 28
const aceternityMeteors = Array.from({ length: meteorCount }, (_, index) => ({
  left: `${((index + 0.5) / meteorCount) * 100}%`,
  delay: `-${((index * 0.73) % 12).toFixed(2)}s`,
  duration: `${9 + ((index * 7) % 6)}s`,
}))

const aceternityBeamPaths = [
  "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875",
  "M-373 -197C-373 -197 -305 208 159 335C623 462 691 867 691 867",
  "M-366 -205C-366 -205 -298 200 166 327C630 454 698 859 698 859",
  "M-359 -213C-359 -213 -291 192 173 319C637 446 705 851 705 851",
  "M-352 -221C-352 -221 -284 184 180 311C644 438 712 843 712 843",
  "M-345 -229C-345 -229 -277 176 187 303C651 430 719 835 719 835",
  "M-338 -237C-338 -237 -270 168 194 295C658 422 726 827 726 827",
  "M-331 -245C-331 -245 -263 160 201 287C665 414 733 819 733 819",
  "M-324 -253C-324 -253 -256 152 208 279C672 406 740 811 740 811",
  "M-317 -261C-317 -261 -249 144 215 271C679 398 747 803 747 803",
  "M-310 -269C-310 -269 -242 136 222 263C686 390 754 795 754 795",
  "M-303 -277C-303 -277 -235 128 229 255C693 382 761 787 761 787",
  "M-296 -285C-296 -285 -228 120 236 247C700 374 768 779 768 779",
  "M-289 -293C-289 -293 -221 112 243 239C707 366 775 771 775 771",
  "M-282 -301C-282 -301 -214 104 250 231C714 358 782 763 782 763",
  "M-275 -309C-275 -309 -207 96 257 223C721 350 789 755 789 755",
  "M-268 -317C-268 -317 -200 88 264 215C728 342 796 747 796 747",
  "M-261 -325C-261 -325 -193 80 271 207C735 334 803 739 803 739",
  "M-254 -333C-254 -333 -186 72 278 199C742 326 810 731 810 731",
  "M-247 -341C-247 -341 -179 64 285 191C749 318 817 723 817 723",
  "M-240 -349C-240 -349 -172 56 292 183C756 310 824 715 824 715",
  "M-233 -357C-233 -357 -165 48 299 175C763 302 831 707 831 707",
  "M-226 -365C-226 -365 -158 40 306 167C770 294 838 699 838 699",
  "M-219 -373C-219 -373 -151 32 313 159C777 286 845 691 845 691",
  "M-212 -381C-212 -381 -144 24 320 151C784 278 852 683 852 683",
  "M-205 -389C-205 -389 -137 16 327 143C791 270 859 675 859 675",
  "M-198 -397C-198 -397 -130 8 334 135C798 262 866 667 866 667",
  "M-191 -405C-191 -405 -123 0 341 127C805 254 873 659 873 659",
  "M-184 -413C-184 -413 -116 -8 348 119C812 246 880 651 880 651",
  "M-177 -421C-177 -421 -109 -16 355 111C819 238 887 643 887 643",
  "M-170 -429C-170 -429 -102 -24 362 103C826 230 894 635 894 635",
  "M-163 -437C-163 -437 -95 -32 369 95C833 222 901 627 901 627",
  "M-156 -445C-156 -445 -88 -40 376 87C840 214 908 619 908 619",
  "M-149 -453C-149 -453 -81 -48 383 79C847 206 915 611 915 611",
  "M-142 -461C-142 -461 -74 -56 390 71C854 198 922 603 922 603",
  "M-135 -469C-135 -469 -67 -64 397 63C861 190 929 595 929 595",
  "M-128 -477C-128 -477 -60 -72 404 55C868 182 936 587 936 587",
  "M-121 -485C-121 -485 -53 -80 411 47C875 174 943 579 943 579",
  "M-114 -493C-114 -493 -46 -88 418 39C882 166 950 571 950 571",
  "M-107 -501C-107 -501 -39 -96 425 31C889 158 957 563 957 563",
  "M-100 -509C-100 -509 -32 -104 432 23C896 150 964 555 964 555",
  "M-93 -517C-93 -517 -25 -112 439 15C903 142 971 547 971 547",
  "M-86 -525C-86 -525 -18 -120 446 7C910 134 978 539 978 539",
  "M-79 -533C-79 -533 -11 -128 453 -1C917 126 985 531 985 531",
  "M-72 -541C-72 -541 -4 -136 460 -9C924 118 992 523 992 523",
  "M-65 -549C-65 -549 3 -144 467 -17C931 110 999 515 999 515",
  "M-58 -557C-58 -557 10 -152 474 -25C938 102 1006 507 1006 507",
  "M-51 -565C-51 -565 17 -160 481 -33C945 94 1013 499 1013 499",
  "M-44 -573C-44 -573 24 -168 488 -41C952 86 1020 491 1020 491",
  "M-37 -581C-37 -581 31 -176 495 -49C959 78 1027 483 1027 483",
] as const

const aceternityBackgroundLinePaths = [
  "M720 450C720 450 742.459 440.315 755.249 425.626C768.039 410.937 778.88 418.741 789.478 401.499C800.076 384.258 817.06 389.269 826.741 380.436C836.423 371.603 851.957 364.826 863.182 356.242C874.408 347.657 877.993 342.678 898.867 333.214C919.741 323.75 923.618 319.88 934.875 310.177C946.133 300.474 960.784 300.837 970.584 287.701C980.384 274.564 993.538 273.334 1004.85 263.087C1016.15 252.84 1026.42 250.801 1038.22 242.1C1050.02 233.399 1065.19 230.418 1074.63 215.721C1084.07 201.024 1085.49 209.128 1112.65 194.884C1139.8 180.64 1132.49 178.205 1146.43 170.636C1160.37 163.066 1168.97 158.613 1181.46 147.982C1193.95 137.35 1191.16 131.382 1217.55 125.645C1243.93 119.907 1234.19 118.899 1254.53 100.846C1274.86 82.7922 1275.12 92.8914 1290.37 76.09C1305.62 59.2886 1313.91 62.1868 1323.19 56.7536C1332.48 51.3204 1347.93 42.8082 1361.95 32.1468C1375.96 21.4855 1374.06 25.168 1397.08 10.1863C1420.09 -4.79534 1421.41 -3.16992 1431.52 -15.0078",
  "M720 450C720 450 741.044 435.759 753.062 410.636C765.079 385.514 770.541 386.148 782.73 370.489C794.918 354.83 799.378 353.188 811.338 332.597C823.298 312.005 825.578 306.419 843.707 295.493C861.837 284.568 856.194 273.248 877.376 256.48C898.558 239.713 887.536 227.843 909.648 214.958C931.759 202.073 925.133 188.092 941.063 177.621C956.994 167.151 952.171 154.663 971.197 135.041C990.222 115.418 990.785 109.375 999.488 96.1291C1008.19 82.8827 1011.4 82.2181 1032.65 61.8861C1053.9 41.5541 1045.74 48.0281 1064.01 19.5798C1082.29 -8.86844 1077.21 -3.89415 1093.7 -19.66C1110.18 -35.4258 1105.91 -46.1146 1127.68 -60.2834C1149.46 -74.4523 1144.37 -72.1024 1154.18 -97.6802C1163.99 -123.258 1165.6 -111.332 1186.21 -135.809C1206.81 -160.285 1203.29 -160.861 1220.31 -177.633C1237.33 -194.406 1236.97 -204.408 1250.42 -214.196",
  "M720 450C720 450 712.336 437.768 690.248 407.156C668.161 376.544 672.543 394.253 665.951 365.784C659.358 337.316 647.903 347.461 636.929 323.197C625.956 298.933 626.831 303.639 609.939 281.01C593.048 258.381 598.7 255.282 582.342 242.504C565.985 229.726 566.053 217.66 559.169 197.116C552.284 176.572 549.348 171.846 529.347 156.529C509.345 141.211 522.053 134.054 505.192 115.653C488.33 97.2527 482.671 82.5627 473.599 70.7833C464.527 59.0039 464.784 50.2169 447 32.0721C429.215 13.9272 436.29 0.858563 423.534 -12.6868C410.777 -26.2322 407.424 -44.0808 394.364 -56.4916C381.303 -68.9024 373.709 -72.6804 365.591 -96.1992C357.473 -119.718 358.364 -111.509 338.222 -136.495C318.08 -161.481 322.797 -149.499 315.32 -181.761C307.843 -214.023 294.563 -202.561 285.795 -223.25C277.026 -243.94 275.199 -244.055 258.602 -263.871",
  "M720 450C720 450 738.983 448.651 790.209 446.852C841.436 445.052 816.31 441.421 861.866 437.296C907.422 433.172 886.273 437.037 930.656 436.651C975.04 436.264 951.399 432.343 1001.57 425.74C1051.73 419.138 1020.72 425.208 1072.85 424.127C1124.97 423.047 1114.39 420.097 1140.02 414.426C1165.65 408.754 1173.1 412.143 1214.55 411.063C1256.01 409.983 1242.78 406.182 1285.56 401.536C1328.35 396.889 1304.66 400.796 1354.41 399.573C1404.16 398.35 1381.34 394.315 1428.34 389.376C1475.35 384.438 1445.96 386.509 1497.93 385.313C1549.9 384.117 1534.63 382.499 1567.23 381.48",
  "M720 450C720 450 696.366 458.841 682.407 472.967C668.448 487.093 673.23 487.471 647.919 492.882C622.608 498.293 636.85 499.899 609.016 512.944C581.182 525.989 596.778 528.494 571.937 533.778C547.095 539.062 551.762 548.656 536.862 556.816C521.962 564.975 515.626 563.279 497.589 575.159C479.552 587.04 484.343 590.435 461.111 598.728C437.879 607.021 442.512 605.226 423.603 618.397C404.694 631.569 402.411 629.541 390.805 641.555C379.2 653.568 369.754 658.175 353.238 663.929C336.722 669.683 330.161 674.689 312.831 684.116C295.5 693.543 288.711 698.815 278.229 704.041C267.747 709.267 258.395 712.506 240.378 726.65C222.361 740.795 230.097 738.379 203.447 745.613C176.797 752.847 193.747 752.523 166.401 767.148C139.056 781.774 151.342 783.641 130.156 791.074C108.97 798.507 116.461 802.688 96.0974 808.817C75.7334 814.946 83.8553 819.505 59.4513 830.576C35.0473 841.648 48.2548 847.874 21.8337 853.886C-4.58739 859.898 10.5966 869.102 -16.396 874.524",
  "M720 450C720 450 695.644 482.465 682.699 506.197C669.755 529.929 671.059 521.996 643.673 556.974C616.286 591.951 625.698 590.8 606.938 615.255C588.178 639.71 592.715 642.351 569.76 665.92C546.805 689.49 557.014 687.498 538.136 722.318C519.258 757.137 520.671 760.818 503.256 774.428C485.841 788.038 491.288 790.063 463.484 831.358C435.681 872.653 437.554 867.001 425.147 885.248C412.74 903.495 411.451 911.175 389.505 934.331C367.559 957.486 375.779 966.276 352.213 990.918C328.647 1015.56 341.908 1008.07 316.804 1047.24C291.699 1086.42 301.938 1060.92 276.644 1100.23C251.349 1139.54 259.792 1138.78 243.151 1153.64",
  "M719.974 450C719.974 450 765.293 459.346 789.305 476.402C813.318 493.459 825.526 487.104 865.093 495.586C904.659 504.068 908.361 510.231 943.918 523.51C979.475 536.789 963.13 535.277 1009.79 547.428C1056.45 559.579 1062.34 555.797 1089.82 568.96C1117.31 582.124 1133.96 582.816 1159.12 592.861C1184.28 602.906 1182.84 603.359 1233.48 614.514C1284.12 625.67 1254.63 632.207 1306.33 644.465C1358.04 656.723 1359.27 656.568 1378.67 670.21C1398.07 683.852 1406.16 676.466 1456.34 692.827C1506.51 709.188 1497.73 708.471 1527.54 715.212",
  "M720 450C720 450 727.941 430.821 734.406 379.251C740.87 327.681 742.857 359.402 757.864 309.798C772.871 260.194 761.947 271.093 772.992 244.308C784.036 217.524 777.105 200.533 786.808 175.699C796.511 150.864 797.141 144.333 808.694 107.307C820.247 70.2821 812.404 88.4169 819.202 37.1016C826 -14.2137 829.525 -0.990829 839.341 -30.3874C849.157 -59.784 844.404 -61.5924 855.042 -98.7516C865.68 -135.911 862.018 -144.559 876.924 -167.488C891.83 -190.418 886.075 -213.535 892.87 -237.945C899.664 -262.355 903.01 -255.031 909.701 -305.588C916.393 -356.144 917.232 -330.612 925.531 -374.777",
  "M720 450C720 450 722.468 499.363 726.104 520.449C729.739 541.535 730.644 550.025 738.836 589.07C747.028 628.115 743.766 639.319 746.146 659.812C748.526 680.306 754.006 693.598 757.006 732.469C760.007 771.34 760.322 765.244 763.893 805.195C767.465 845.146 769.92 822.227 773.398 868.469C776.875 914.71 776.207 901.365 778.233 940.19C780.259 979.015 782.53 990.477 787.977 1010.39C793.424 1030.3 791.788 1060.01 797.243 1082.24C802.698 1104.47 801.758 1130.29 808.181 1149.64C814.604 1168.99 813.135 1171.5 818.026 1225.28C822.918 1279.06 820.269 1267.92 822.905 1293.75",
  "M720 450C720 450 737.033 492.46 757.251 515.772C777.468 539.084 768.146 548.687 785.517 570.846C802.887 593.005 814.782 609.698 824.589 634.112C834.395 658.525 838.791 656.702 855.55 695.611C872.31 734.519 875.197 724.854 890.204 764.253C905.21 803.653 899.844 790.872 919.927 820.763C940.01 850.654 939.071 862.583 954.382 886.946C969.693 911.309 968.683 909.254 993.997 945.221C1019.31 981.187 1006.67 964.436 1023.49 1007.61C1040.32 1050.79 1046.15 1038.25 1059.01 1073.05C1071.88 1107.86 1081.39 1096.19 1089.45 1131.96C1097.51 1167.73 1106.52 1162.12 1125.77 1196.89",
  "M720 450C720 450 687.302 455.326 670.489 467.898C653.676 480.47 653.159 476.959 626.58 485.127C600.002 493.295 599.626 495.362 577.94 503.841C556.254 512.319 556.35 507.426 533.958 517.44C511.566 527.454 505.82 526.441 486.464 539.172C467.108 551.904 461.312 546.36 439.357 553.508C417.402 560.657 406.993 567.736 389.393 572.603C371.794 577.47 371.139 583.76 344.54 587.931C317.941 592.102 327.375 593.682 299.411 607.275C271.447 620.868 283.617 615.022 249.868 622.622C216.119 630.223 227.07 630.86 203.77 638.635C180.47 646.41 168.948 652.487 156.407 657.28C143.866 662.073 132.426 669.534 110.894 675.555C89.3615 681.575 90.3234 680.232 61.1669 689.897C32.0105 699.562 34.3696 702.021 15.9011 709.789C-2.56738 717.558 2.38861 719.841 -29.9494 729.462C-62.2873 739.083 -52.5552 738.225 -77.4307 744.286",
  "M720 450C720 450 743.97 465.061 754.884 490.648C765.798 516.235 781.032 501.34 791.376 525.115C801.72 548.889 808.417 538.333 829.306 564.807C850.195 591.281 852.336 582.531 865.086 601.843C877.835 621.155 874.512 621.773 902.383 643.857C930.255 665.94 921.885 655.976 938.025 681.74C954.164 707.505 959.384 709.719 977.273 720.525C995.162 731.33 994.233 731.096 1015.92 757.676C1037.61 784.257 1025.74 768.848 1047.82 795.343C1069.91 821.837 1065.95 815.45 1085.93 834.73C1105.91 854.009 1110.53 848.089 1124.97 869.759C1139.4 891.428 1140.57 881.585 1158.53 911.499C1176.5 941.414 1184.96 933.829 1194.53 948.792C1204.09 963.755 1221.35 973.711 1232.08 986.224C1242.8 998.738 1257.34 1015.61 1269.99 1026.53C1282.63 1037.45 1293.81 1040.91 1307.21 1064.56",
  "M720 450C720 450 718.24 412.717 716.359 397.31C714.478 381.902 713.988 362.237 710.785 344.829C707.582 327.42 708.407 322.274 701.686 292.106C694.965 261.937 699.926 270.857 694.84 240.765C689.753 210.674 693.055 217.076 689.674 184.902C686.293 152.728 686.041 149.091 682.676 133.657C679.311 118.223 682.23 106.005 681.826 80.8297C681.423 55.6545 677.891 60.196 675.66 30.0226C673.429 -0.150848 672.665 -7.94842 668.592 -26.771C664.52 -45.5935 664.724 -43.0755 661.034 -78.7766C657.343 -114.478 658.509 -103.181 653.867 -133.45C649.226 -163.719 650.748 -150.38 647.052 -182.682C643.357 -214.984 646.125 -214.921 645.216 -238.402C644.307 -261.883 640.872 -253.4 637.237 -291.706C633.602 -330.012 634.146 -309.868 630.717 -343.769C627.288 -377.669 628.008 -370.682 626.514 -394.844",
  "M720 450C720 450 730.384 481.55 739.215 507.557C748.047 533.564 751.618 537.619 766.222 562.033C780.825 586.447 774.187 582.307 787.606 618.195C801.025 654.082 793.116 653.536 809.138 678.315C825.16 703.095 815.485 717.073 829.898 735.518C844.311 753.964 845.351 773.196 852.197 786.599C859.042 800.001 862.876 805.65 872.809 845.974C882.742 886.297 885.179 874.677 894.963 903.246C904.747 931.816 911.787 924.243 921.827 961.809C931.867 999.374 927.557 998.784 940.377 1013.59C953.197 1028.4 948.555 1055.77 966.147 1070.54C983.739 1085.31 975.539 1105.69 988.65 1125.69C1001.76 1145.69 1001.82 1141.59 1007.54 1184.37C1013.27 1227.15 1018.98 1198.8 1029.67 1241.58",
  "M720 450C720 450 684.591 447.135 657.288 439.014C629.985 430.894 618.318 435.733 600.698 431.723C583.077 427.714 566.975 425.639 537.839 423.315C508.704 420.991 501.987 418.958 476.29 413.658C450.592 408.359 460.205 410.268 416.97 408.927C373.736 407.586 396.443 401.379 359.262 396.612C322.081 391.844 327.081 393.286 300.224 391.917C273.368 390.547 264.902 385.49 241.279 382.114C217.655 378.739 205.497 378.95 181.98 377.253C158.464 375.556 150.084 369.938 117.474 366.078C84.8644 362.218 81.5401 361.501 58.8734 358.545C36.2067 355.59 33.6442 351.938 -3.92281 346.728C-41.4898 341.519 -18.6466 345.082 -61.4654 341.179C-104.284 337.275 -102.32 338.048 -121.821 332.369",
  "M720 450C720 450 714.384 428.193 708.622 410.693C702.86 393.193 705.531 397.066 703.397 372.66C701.264 348.254 697.8 345.181 691.079 330.466C684.357 315.751 686.929 312.356 683.352 292.664C679.776 272.973 679.079 273.949 674.646 255.07C670.213 236.192 670.622 244.371 665.271 214.561C659.921 184.751 659.864 200.13 653.352 172.377C646.841 144.623 647.767 151.954 644.123 136.021C640.48 120.088 638.183 107.491 636.127 96.8178C634.072 86.1443 632.548 77.5871 626.743 54.0492C620.938 30.5112 622.818 28.9757 618.613 16.577C614.407 4.17831 615.555 -13.1527 608.752 -24.5691C601.95 -35.9855 603.375 -51.0511 599.526 -60.1492C595.678 -69.2472 593.676 -79.3623 587.865 -100.431C582.053 -121.5 584.628 -117.913 578.882 -139.408C573.137 -160.903 576.516 -161.693 571.966 -182.241C567.416 -202.789 567.42 -198.681 562.834 -218.28C558.248 -237.879 555.335 -240.47 552.072 -260.968C548.808 -281.466 547.605 -280.956 541.772 -296.427C535.94 -311.898 537.352 -315.211 535.128 -336.018C532.905 -356.826 531.15 -360.702 524.129 -377.124",
  "M720 450C720 450 711.433 430.82 707.745 409.428C704.056 388.035 704.937 381.711 697.503 370.916C690.069 360.121 691.274 359.999 685.371 334.109C679.469 308.22 677.496 323.883 671.24 294.303C664.984 264.724 667.608 284.849 662.065 258.116C656.522 231.383 656.357 229.024 647.442 216.172C638.527 203.319 640.134 192.925 635.555 178.727C630.976 164.529 630.575 150.179 624.994 139.987C619.413 129.794 615.849 112.779 612.251 103.074C608.654 93.3696 606.942 85.6729 603.041 63.0758C599.14 40.4787 595.242 36.9267 589.533 23.8967C583.823 10.8666 581.18 -2.12401 576.96 -14.8333C572.739 -27.5425 572.696 -37.7703 568.334 -51.3441C563.972 -64.9179 562.14 -67.2124 556.992 -93.299C551.844 -119.386 550.685 -109.743 544.056 -129.801C537.428 -149.859 534.97 -151.977 531.034 -170.076C527.099 -188.175 522.979 -185.119 519.996 -207.061C517.012 -229.004 511.045 -224.126 507.478 -247.077C503.912 -270.029 501.417 -271.033 495.534 -287C489.651 -302.968 491.488 -300.977 484.68 -326.317C477.872 -351.657 476.704 -348.494 472.792 -363.258",
  "M720 450C720 450 723.524 466.673 728.513 497.319C733.503 527.964 731.894 519.823 740.001 542.706C748.108 565.589 744.225 560.598 748.996 588.365C753.766 616.131 756.585 602.096 761.881 636.194C767.178 670.293 768.155 649.089 771.853 679.845C775.551 710.6 775.965 703.738 781.753 724.555C787.54 745.372 787.248 758.418 791.422 773.79C795.596 789.162 798.173 807.631 804.056 819.914C809.938 832.197 806.864 843.07 811.518 865.275C816.171 887.48 816.551 892.1 822.737 912.643C828.922 933.185 830.255 942.089 833.153 956.603C836.052 971.117 839.475 969.242 846.83 1003.98C854.185 1038.71 850.193 1028.86 854.119 1048.67C858.045 1068.48 857.963 1074.39 863.202 1094.94C868.44 1115.49 867.891 1108.03 874.497 1138.67C881.102 1169.31 880.502 1170.72 887.307 1186.56C894.111 1202.4 890.388 1209.75 896.507 1231.25C902.627 1252.76 902.54 1245.39 906.742 1279.23",
  "M720 450C720 450 698.654 436.893 669.785 424.902C640.916 412.91 634.741 410.601 615.568 402.586C596.396 394.571 594.829 395.346 568.66 378.206C542.492 361.067 547.454 359.714 514.087 348.978C480.721 338.242 479.79 334.731 467.646 329.846C455.502 324.96 448.63 312.156 416.039 303.755C383.448 295.354 391.682 293.73 365.021 280.975C338.36 268.219 328.715 267.114 309.809 252.575C290.903 238.036 277.185 246.984 259.529 230.958C241.873 214.931 240.502 224.403 211.912 206.241C183.323 188.078 193.288 190.89 157.03 181.714C120.772 172.538 127.621 170.109 108.253 154.714C88.8857 139.319 75.4927 138.974 56.9647 132.314C38.4366 125.654 33.8997 118.704 4.77584 106.7C-24.348 94.6959 -19.1326 90.266 -46.165 81.9082",
  "M720 450C720 450 711.596 475.85 701.025 516.114C690.455 556.378 697.124 559.466 689.441 579.079C681.758 598.693 679.099 597.524 675.382 642.732C671.665 687.94 663.4 677.024 657.844 700.179C652.288 723.333 651.086 724.914 636.904 764.536C622.723 804.158 631.218 802.853 625.414 827.056C619.611 851.259 613.734 856.28 605.94 892.262C598.146 928.244 595.403 924.314 588.884 957.785C582.364 991.255 583.079 991.176 575.561 1022.63C568.044 1054.08 566.807 1058.45 558.142 1084.32C549.476 1110.2 553.961 1129.13 542.367 1149.25C530.772 1169.37 538.268 1180.37 530.338 1207.27C522.407 1234.17 520.826 1245.53 512.156 1274.2",
  "M720 450C720 450 730.571 424.312 761.424 411.44C792.277 398.569 772.385 393.283 804.069 377.232C835.752 361.182 829.975 361.373 848.987 342.782C867.999 324.192 877.583 330.096 890.892 303.897C904.201 277.698 910.277 282.253 937.396 264.293C964.514 246.333 949.357 246.834 978.7 230.438C1008.04 214.042 990.424 217.952 1021.51 193.853C1052.6 169.753 1054.28 184.725 1065.97 158.075C1077.65 131.425 1087.76 139.068 1111.12 120.345C1134.49 101.622 1124.9 104.858 1151.67 86.3162C1178.43 67.7741 1167.09 66.2676 1197.53 47.2606C1227.96 28.2536 1225.78 23.2186 1239.27 12.9649C1252.76 2.7112 1269.32 -9.47929 1282.88 -28.5587C1296.44 -47.6381 1305.81 -41.3853 1323.82 -62.7027C1341.83 -84.0202 1340.32 -82.3794 1368.98 -98.9326",
] as const

const aceternityBackgroundLineColors = [
  "#46A5CA",
  "#8C2F2F",
  "#4FAE4D",
  "#D6590C",
  "#811010",
  "#247AFB",
  "#A534A0",
  "#A8A438",
  "#D6590C",
  "#46A29C",
  "#670F6D",
  "#D7C200",
  "#59BBEB",
  "#504F1C",
  "#55BC54",
  "#4D3568",
  "#9F39A5",
  "#363636",
  "#860909",
  "#6A286F",
  "#604483",
] as const

const aceternityCollisionBeams = [
  { x: 10, duration: 7, repeatDelay: 3, delay: 2, height: 56, rotate: 0 },
  { x: 600, duration: 3, repeatDelay: 3, delay: 4, height: 56, rotate: 0 },
  { x: 100, duration: 7, repeatDelay: 7, delay: 0, height: 24, rotate: 0 },
  { x: 400, duration: 5, repeatDelay: 14, delay: 4, height: 56, rotate: 0 },
  { x: 800, duration: 11, repeatDelay: 2, delay: 0, height: 80, rotate: 0 },
  { x: 1000, duration: 4, repeatDelay: 2, delay: 0, height: 48, rotate: 0 },
  { x: 1200, duration: 6, repeatDelay: 4, delay: 2, height: 24, rotate: 0 },
] as const

const aceternityCollisionParticles = [
  [-36, -44],
  [-28, -24],
  [-22, -58],
  [-16, -34],
  [-10, -50],
  [-4, -18],
  [6, -42],
  [12, -62],
  [18, -28],
  [24, -52],
  [32, -36],
  [38, -18],
] as const

export function MassageLabMovingGradientBackground({
  className,
  mainColor,
  orbColor,
}: BackgroundEffectProps) {
  return (
    <MovingBackground
      className={cn(styles.effectLayer, className)}
      mainColor={mainColor}
      orbColor={orbColor}
      testId="background-host-moving-gradient"
    />
  )
}

export function StaticGradientBackground({ className }: BackgroundEffectProps) {
  return <div className={cn(styles.effectLayer, className)} />
}

export function MagicParticlesBackground({ className }: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 767px)")
    const particles: Particle[] = []
    let animationFrame = 0
    let initialized = false
    let pixelRatio = 1

    const resizeCanvas = () => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.floor(window.innerWidth * pixelRatio))
      canvas.height = Math.max(1, Math.floor(window.innerHeight * pixelRatio))
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    const initializeParticles = () => {
      if (initialized) {
        return
      }

      initialized = true
      const count = Math.min(96, Math.max(42, Math.floor(window.innerWidth / 18)))

      for (let index = 0; index < count; index += 1) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.18,
          vy: -0.08 - Math.random() * 0.18,
          size: 0.7 + Math.random() * 1.9,
          alpha: 0.18 + Math.random() * 0.58,
        })
      }
    }

    const draw = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight)
      context.fillStyle = "rgba(255, 255, 255, 0.74)"

      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.y < -12) {
          particle.y = window.innerHeight + 12
          particle.x = Math.random() * window.innerWidth
        }

        if (particle.x < -12) {
          particle.x = window.innerWidth + 12
        } else if (particle.x > window.innerWidth + 12) {
          particle.x = -12
        }

        context.globalAlpha = particle.alpha
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
      })

      context.globalAlpha = 1
      animationFrame = window.requestAnimationFrame(draw)
    }

    const stopAnimation = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }

      canvas.hidden = true
      context.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }

    const startAnimation = () => {
      if (animationFrame) {
        return
      }

      canvas.hidden = false
      resizeCanvas()
      initializeParticles()
      draw()
    }

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        documentHidden: document.hidden,
      })

      if (shouldAnimate) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    window.addEventListener("resize", resizeCanvas)
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      window.removeEventListener("resize", resizeCanvas)
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
    }
  }, [])

  return <canvas ref={canvasRef} className={cn(styles.effectLayer, styles.particlesCanvas, className)} />
}

export function MagicNoiseTextureBackground({ className }: BackgroundEffectProps) {
  const id = useId()

  return (
    <svg className={cn(styles.effectLayer, styles.noiseTexture, className)} aria-hidden="true">
      <filter id={`${id}-noise`}>
        <feTurbulence baseFrequency="0.72" numOctaves="3" seed="8" type="fractalNoise" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0.46" />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id}-noise)`} />
    </svg>
  )
}

export function MagicGridPatternBackground({ className }: BackgroundEffectProps) {
  const id = useId()
  const squares = [[4, 3], [6, 6], [9, 4], [12, 8], [15, 5], [18, 11]]

  return (
    <svg className={cn(styles.effectLayer, styles.gridPattern, className)} aria-hidden="true">
      <defs>
        <pattern id={`${id}-grid`} width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M44 0H0V44" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-grid)`} />
      {squares.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x * 44} y={y * 44} width="43" height="43" fill="rgba(255,255,255,0.09)" />
      ))}
    </svg>
  )
}

export function MagicAnimatedGridBackground({ className }: BackgroundEffectProps) {
  return (
    <div className={cn(styles.effectLayer, styles.animatedGrid, className)} aria-hidden="true">
      {Array.from({ length: 96 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            styles.animatedGridSquare,
            highlightedGridSquares.has(index) && styles.animatedGridSquareHighlight,
          )}
          style={{ "--delay": `${(index % 12) * -0.22}s` } as CSSProperties}
        />
      ))}
    </div>
  )
}

export function ChamaacWavesBackground({ className }: BackgroundEffectProps) {
  return (
    <svg className={cn(styles.effectLayer, styles.waves, className)} viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
      <path className={styles.wavePath} d="M-120 620C140 470 350 760 620 590C880 426 1030 514 1210 420C1360 342 1490 386 1580 316" fill="none" stroke="rgba(113, 168, 255, 0.48)" strokeWidth="38" />
      <path className={styles.wavePath} d="M-80 468C220 300 360 555 600 430C800 326 1010 288 1185 360C1350 428 1468 332 1550 250" fill="none" stroke="rgba(255, 122, 26, 0.24)" strokeWidth="30" />
      <path className={styles.wavePath} d="M-120 748C180 625 370 770 620 700C870 630 1040 728 1250 590C1390 500 1495 548 1580 470" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="24" />
    </svg>
  )
}

export function ChamaacElectricMistBackground({ className }: BackgroundEffectProps) {
  return <div className={cn(styles.effectLayer, styles.electricMist, className)} aria-hidden="true" />
}

// Aceternity UI Aurora Background by Manu Arora, adapted as an internal MassageLab premium visual effect.
export function AceternityAuroraBackground({ className }: BackgroundEffectProps) {
  return (
    <div className={cn(styles.effectLayer, styles.aceternityAurora, className)} aria-hidden="true">
      <div className={styles.aceternityAuroraField} />
    </div>
  )
}

// Aceternity UI Dotted Glow Background by Manu Arora, adapted as an internal MassageLab premium visual effect.
export function AceternityDottedGlowBackground({ className }: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!container || !canvas || !context) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 767px)")
    const gap = 14
    const radius = 1.7
    const opacity = 0.58
    const baseColor = "rgba(230, 238, 255, 0.74)"
    const glowColor = "rgba(0, 170, 255, 0.86)"
    let animationFrame = 0
    let resizeRetryFrame = 0
    let dots: DottedGlowDot[] = []
    let shouldRun = false
    let pixelRatio = 1
    let canvasWidth = 0
    let canvasHeight = 0

    const regenerateDots = (width: number, height: number) => {
      dots = []
      const columns = Math.ceil(width / gap) + 2
      const rows = Math.ceil(height / gap) + 2

      for (let column = -1; column < columns; column += 1) {
        for (let row = -1; row < rows; row += 1) {
          dots.push({
            x: column * gap + (row % 2 === 0 ? 0 : gap * 0.5),
            y: row * gap,
            phase: Math.random() * Math.PI * 2,
            speed: 0.42 + Math.random() * 0.88,
          })
        }
      }
    }

    const measureCanvasArea = () => {
      const containerRect = container.getBoundingClientRect()
      const parentRect = container.parentElement?.getBoundingClientRect()
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const measuredWidth =
        containerRect.width >= 32 ? containerRect.width : parentRect && parentRect.width >= 32 ? parentRect.width : viewportWidth
      const measuredHeight =
        containerRect.height >= 32 ? containerRect.height : parentRect && parentRect.height >= 32 ? parentRect.height : viewportHeight

      return {
        width: Math.max(1, Math.floor(measuredWidth)),
        height: Math.max(1, Math.floor(measuredHeight)),
      }
    }

    const resizeCanvas = () => {
      const { width, height } = measureCanvasArea()
      if (width < 32 || height < 32) {
        return false
      }

      const nextPixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
      if (canvasWidth === width && canvasHeight === height && pixelRatio === nextPixelRatio) {
        return true
      }

      canvasWidth = width
      canvasHeight = height
      pixelRatio = nextPixelRatio
      canvas.width = Math.floor(width * pixelRatio)
      canvas.height = Math.floor(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      regenerateDots(width, height)

      return true
    }

    const requestResizeRetry = () => {
      if (resizeRetryFrame) {
        return
      }

      resizeRetryFrame = window.requestAnimationFrame(() => {
        resizeRetryFrame = 0
        if (!shouldRun) {
          return
        }

        if (!resizeCanvas()) {
          requestResizeRetry()
          return
        }

        if (!animationFrame) {
          animationFrame = window.requestAnimationFrame(draw)
        }
      })
    }

    const draw = (now: number) => {
      if (!shouldRun) {
        return
      }

      const width = canvasWidth || canvas.width / pixelRatio
      const height = canvasHeight || canvas.height / pixelRatio
      context.clearRect(0, 0, width, height)

      const depthGradient = context.createRadialGradient(
        width * 0.5,
        height * 0.38,
        Math.min(width, height) * 0.08,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.7,
      )
      depthGradient.addColorStop(0, "rgba(0,0,0,0)")
      depthGradient.addColorStop(1, "rgba(0,0,0,0.34)")
      context.fillStyle = depthGradient
      context.fillRect(0, 0, width, height)

      context.fillStyle = baseColor
      const time = now / 1000

      dots.forEach((dot) => {
        const phase = (time * dot.speed + dot.phase) % 2
        const linearPulse = phase < 1 ? phase : 2 - phase
        const alpha = 0.18 + 0.62 * linearPulse

        context.globalAlpha = alpha * opacity
        if (alpha > 0.58) {
          context.shadowColor = glowColor
          context.shadowBlur = 6 * ((alpha - 0.58) / 0.42)
        } else {
          context.shadowColor = "transparent"
          context.shadowBlur = 0
        }

        context.beginPath()
        context.arc(dot.x, dot.y, radius, 0, Math.PI * 2)
        context.fill()
      })

      context.globalAlpha = 1
      context.shadowColor = "transparent"
      context.shadowBlur = 0
      animationFrame = window.requestAnimationFrame(draw)
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }

      if (resizeRetryFrame) {
        window.cancelAnimationFrame(resizeRetryFrame)
        resizeRetryFrame = 0
      }

      canvas.hidden = true
      context.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio)
    }

    const startAnimation = () => {
      if (shouldRun) {
        return
      }

      shouldRun = true
      canvas.hidden = false
      if (!resizeCanvas()) {
        requestResizeRetry()
        return
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        // This canvas scales dot count with viewport size, so compact windows should not drop to a blank background.
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (shouldAnimate) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    const handleResize = () => {
      if (!shouldRun || canvas.hidden) {
        return
      }

      if (!resizeCanvas()) {
        requestResizeRetry()
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })

    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
    }
  }, [])

  return (
    <div ref={containerRef} className={cn(styles.effectLayer, styles.dottedGlowLayer, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.dottedGlowCanvas} />
    </div>
  )
}

// Aceternity UI Background Gradient Animation by Manu Arora, adapted as an internal MassageLab premium visual effect.
export function AceternityGradientAnimationBackground({
  className,
  gradientAnimation,
}: BackgroundEffectProps) {
  const generatedId = useId()
  const filterId = `ml-gradient-goo-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const [isSafari, setIsSafari] = useState(false)
  const resolved = resolveGradientAnimationOptions(gradientAnimation)
  const style = {
    "--ml-gradient-background-start": resolved.backgroundStartColor,
    "--ml-gradient-background-end": resolved.backgroundEndColor,
    "--ml-gradient-first-color": hexToRgbTriplet(resolved.firstColor),
    "--ml-gradient-second-color": hexToRgbTriplet(resolved.secondColor),
    "--ml-gradient-third-color": hexToRgbTriplet(resolved.thirdColor),
    "--ml-gradient-fourth-color": hexToRgbTriplet(resolved.fourthColor),
    "--ml-gradient-fifth-color": hexToRgbTriplet(resolved.fifthColor),
    "--ml-gradient-size": `${resolved.size}%`,
    "--ml-gradient-offset": `${resolved.size / -2}%`,
    "--ml-gradient-size-small": `${resolved.size * 0.72}%`,
    "--ml-gradient-offset-small": `${resolved.size * -0.36}%`,
    "--ml-gradient-size-medium": `${resolved.size * 0.8}%`,
    "--ml-gradient-offset-medium": `${resolved.size * -0.4}%`,
    "--ml-gradient-first-duration": `${30 / resolved.speed}s`,
    "--ml-gradient-second-duration": `${20 / resolved.speed}s`,
    "--ml-gradient-third-duration": `${40 / resolved.speed}s`,
    "--ml-gradient-fourth-duration": `${40 / resolved.speed}s`,
    "--ml-gradient-fifth-duration": `${20 / resolved.speed}s`,
    "--ml-gradient-filter": isSafari ? "blur(40px)" : `url(#${filterId}) blur(40px)`,
  } as CSSProperties

  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
  }, [])

  return (
    <div className={cn(styles.effectLayer, styles.aceternityGradientAnimation, className)} style={style} aria-hidden="true">
      <svg className={styles.gradientAnimationFilterSvg} focusable="false" aria-hidden="true">
        <filter id={filterId}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </svg>
      <div className={styles.gradientAnimationField}>
        <span className={cn(styles.gradientAnimationBlob, styles.gradientAnimationBlobFirst)} />
        <span className={cn(styles.gradientAnimationBlob, styles.gradientAnimationBlobSecond)} />
        <span className={cn(styles.gradientAnimationBlob, styles.gradientAnimationBlobThird)} />
        <span className={cn(styles.gradientAnimationBlob, styles.gradientAnimationBlobFourth)} />
        <span className={cn(styles.gradientAnimationBlob, styles.gradientAnimationBlobFifth)} />
      </div>
    </div>
  )
}

// Aceternity UI Background Beams by Manu Arora, adapted as an internal MassageLab premium visual effect.
export function AceternityBackgroundBeams({ className }: BackgroundEffectProps) {
  const generatedId = useId()
  const gradientIdPrefix = `ml-background-beams-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`

  return (
    <div className={cn(styles.effectLayer, styles.aceternityBackgroundBeams, className)} aria-hidden="true">
      <svg
        className={styles.backgroundBeamsSvg}
        viewBox="0 0 696 316"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          {aceternityBeamPaths.map((_, index) => {
            const duration = 11 + (index % 8)
            const delay = (index % 10) * 0.45
            const gradientId = `${gradientIdPrefix}-${index}`

            return (
              <linearGradient
                key={gradientId}
                id={gradientId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#18CCFC" stopOpacity="0" />
                <stop offset="14%" stopColor="#18CCFC" stopOpacity="0.78" />
                <stop offset="32.5%" stopColor="#6344F5" stopOpacity="0.72" />
                <stop offset="100%" stopColor="#AE48FF" stopOpacity="0" />
                <animate
                  attributeName="x1"
                  values="-20%;100%;-20%"
                  dur={`${duration}s`}
                  begin={`${delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y1"
                  values="0%;100%;0%"
                  dur={`${duration}s`}
                  begin={`${delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="x2"
                  values="20%;120%;20%"
                  dur={`${duration}s`}
                  begin={`${delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y2"
                  values="20%;120%;20%"
                  dur={`${duration}s`}
                  begin={`${delay}s`}
                  repeatCount="indefinite"
                />
              </linearGradient>
            )
          })}
        </defs>
        {aceternityBeamPaths.map((path, index) => (
          <path
            key={`${path}-${index}`}
            d={path}
            className={styles.backgroundBeamPath}
            stroke={`url(#${gradientIdPrefix}-${index})`}
          />
        ))}
      </svg>
    </div>
  )
}

// Aceternity UI Background Beams With Collision by Manu Arora, adapted as an internal MassageLab premium visual effect.
export function AceternityBackgroundBeamsWithCollision({ className }: BackgroundEffectProps) {
  return (
    <div className={cn(styles.effectLayer, styles.aceternityBackgroundBeamsCollision, className)} aria-hidden="true">
      <div className={styles.collisionBeamsLayer}>
        {aceternityCollisionBeams.map((beam) => {
          const cycle = beam.duration + beam.repeatDelay
          const beamX = `${Math.min(98, Math.max(2, (beam.x / 1200) * 100))}%`
          const style = {
            "--ml-collision-beam-x": beamX,
            "--ml-collision-beam-height": `${beam.height}px`,
            "--ml-collision-beam-cycle": `${cycle}s`,
            "--ml-collision-beam-delay": `${beam.delay}s`,
            "--ml-collision-beam-rotate": `${beam.rotate}deg`,
          } as CSSProperties

          return (
            <span key={`${beam.x}-${beam.duration}`} className={styles.collisionBeam} style={style} />
          )
        })}
      </div>

      {aceternityCollisionBeams.map((beam, beamIndex) => {
        const cycle = beam.duration + beam.repeatDelay
        const beamX = `${Math.min(98, Math.max(2, (beam.x / 1200) * 100))}%`
        const style = {
          "--ml-collision-beam-x": beamX,
          "--ml-collision-beam-cycle": `${cycle}s`,
          "--ml-collision-beam-delay": `${beam.delay}s`,
        } as CSSProperties

        return (
          <span key={`${beam.x}-collision`} className={styles.collisionExplosion} style={style}>
            <span className={styles.collisionExplosionGlow} />
            {aceternityCollisionParticles.map(([x, y], particleIndex) => (
              <span
                key={`${beamIndex}-${particleIndex}`}
                className={styles.collisionParticle}
                style={{
                  "--ml-collision-particle-x": `${x}px`,
                  "--ml-collision-particle-y": `${y}px`,
                } as CSSProperties}
              />
            ))}
          </span>
        )
      })}

      <div className={styles.collisionSurface} />
    </div>
  )
}

// Aceternity UI Background Lines by Manu Arora, adapted as an internal MassageLab premium visual effect.
export function AceternityBackgroundLines({
  className,
  backgroundLines,
}: BackgroundEffectProps) {
  const resolved = resolveBackgroundLinesOptions(backgroundLines)

  const renderPaths = (pass: 0 | 1) => (
    aceternityBackgroundLinePaths.map((path, index) => {
      const repeatDelay = 2 + ((index * 5 + pass * 3) % 10)
      const delay = (index * 3 + pass * 5) % 10
      const style = {
        "--ml-background-line-color": aceternityBackgroundLineColors[index % aceternityBackgroundLineColors.length],
        "--ml-background-line-cycle": `${resolved.duration + repeatDelay}s`,
        "--ml-background-line-delay": `${delay}s`,
      } as CSSProperties

      return (
        <path
          key={`${pass}-${index}`}
          className={styles.backgroundLinePath}
          d={path}
          style={style}
        />
      )
    })
  )

  return (
    <div className={cn(styles.effectLayer, styles.aceternityBackgroundLines, className)} aria-hidden="true">
      <svg
        className={styles.backgroundLinesSvg}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        {renderPaths(0)}
        {renderPaths(1)}
      </svg>
    </div>
  )
}

// Aceternity UI Glowing Stars by Manu Arora, adapted as an internal MassageLab premium visual effect.
export function AceternityGlowingStarsBackground({ className }: BackgroundEffectProps) {
  const [glowingStars, setGlowingStars] = useState<number[]>([])

  useEffect(() => {
    const selectGlowingStars = () => {
      const selected = new Set<number>()

      while (selected.size < 5) {
        selected.add(Math.floor(Math.random() * glowingStarsCount))
      }

      setGlowingStars([...selected])
    }

    selectGlowingStars()
    const interval = window.setInterval(selectGlowingStars, 3000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className={cn(styles.effectLayer, styles.aceternityGlowingStars, className)} aria-hidden="true">
      <div
        className={styles.glowingStarsGrid}
        style={{
          "--ml-glowing-stars-columns": glowingStarsColumns,
          "--ml-glowing-stars-rows": glowingStarsRows,
        } as CSSProperties}
      >
        {glowingStarIndexes.map((index) => {
          const isGlowing = glowingStars.includes(index)
          const delay = (index % 10) * 0.1

          return (
            <span key={index} className={styles.glowingStarsCell}>
              <span
                className={cn(styles.glowingStarsStar, isGlowing && styles.glowingStarsStarActive)}
                style={{ "--ml-glowing-star-delay": `${delay}s` } as CSSProperties}
              />
              {isGlowing ? (
                <span
                  className={styles.glowingStarsGlow}
                  style={{ "--ml-glowing-star-delay": `${delay}s` } as CSSProperties}
                />
              ) : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// Aceternity UI Meteors by Manu Arora, adapted as an internal MassageLab premium visual effect.
export function AceternityMeteorsBackground({ className }: BackgroundEffectProps) {
  return (
    <div className={cn(styles.effectLayer, styles.aceternityMeteors, className)} aria-hidden="true">
      <div className={styles.meteorsLayer}>
        {aceternityMeteors.map((meteor, index) => (
          <span
            key={`meteor-${index}`}
            className={styles.meteor}
            style={
              {
                "--ml-meteor-left": meteor.left,
                "--ml-meteor-delay": meteor.delay,
                "--ml-meteor-duration": meteor.duration,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}

// Animate UI Bubble Background adapted as an internal MassageLab premium effect.
// Cursor interaction from the source component is intentionally omitted.
export function AnimateUiBubbleBackground({ className }: BackgroundEffectProps) {
  const filterId = `ml-bubble-goo-${useId().replace(/:/g, "")}`

  return (
    <div className={cn(styles.effectLayer, styles.animateUiBubble, className)} aria-hidden="true">
      <svg className={styles.bubbleFilterSvg} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <div
        className={styles.bubbleGooLayer}
        style={{ "--ml-bubble-filter": `url(#${filterId}) blur(40px)` } as CSSProperties}
      >
        <span className={cn(styles.bubbleOrb, styles.bubbleOrbOne)} />
        <span className={cn(styles.bubbleOrb, styles.bubbleOrbTwo)} />
        <span className={cn(styles.bubbleOrb, styles.bubbleOrbThree)} />
        <span className={cn(styles.bubbleOrb, styles.bubbleOrbFour)} />
        <span className={cn(styles.bubbleOrb, styles.bubbleOrbFive)} />
      </div>
      <span className={styles.bubbleVignette} />
    </div>
  )
}

// Animate UI Gradient Background adapted as an internal MassageLab premium effect.
// The source Motion background-position loop is reproduced with CSS keyframes to avoid adding motion.
export function AnimateUiGradientBackground({
  className,
  animateUiGradient,
}: BackgroundEffectProps) {
  const resolved = resolveAnimateUiGradientOptions(animateUiGradient)
  const [fromColor, viaColor, toColor] = createAnimateUiGradientPalette(
    resolved.primaryColor,
    resolved.harmony,
  )
  const style = {
    "--ml-animate-gradient-from": fromColor,
    "--ml-animate-gradient-via": viaColor,
    "--ml-animate-gradient-to": toColor,
    "--ml-animate-gradient-opacity": resolved.opacity,
  } as CSSProperties

  return (
    <div
      className={cn(styles.effectLayer, styles.animateUiGradient, className)}
      style={style}
      aria-hidden="true"
    />
  )
}

// Animate UI Stars Background adapted as an internal MassageLab premium effect.
// The source Motion layers are reproduced with CSS keyframes, while parallax listens at window level to avoid pointer capture.
export function AnimateUiStarsBackground({
  className,
  animateUiStars,
}: BackgroundEffectProps) {
  const resolved = resolveAnimateUiStarsOptions(animateUiStars)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const smallCount = Math.round(clampNumber(1000 * resolved.density, 1000, 250, 1500))
  const mediumCount = Math.round(clampNumber(400 * resolved.density, 400, 100, 700))
  const largeCount = Math.round(clampNumber(200 * resolved.density, 200, 50, 360))
  const smallShadow = useMemo(
    () => buildAnimateUiStarsShadow(smallCount, resolved.starColor, 17),
    [smallCount, resolved.starColor],
  )
  const mediumShadow = useMemo(
    () => buildAnimateUiStarsShadow(mediumCount, resolved.starColor, 113),
    [mediumCount, resolved.starColor],
  )
  const largeShadow = useMemo(
    () => buildAnimateUiStarsShadow(largeCount, resolved.starColor, 233),
    [largeCount, resolved.starColor],
  )
  const style = {
    "--ml-stars-small-shadow": smallShadow,
    "--ml-stars-medium-shadow": mediumShadow,
    "--ml-stars-large-shadow": largeShadow,
    "--ml-stars-speed-small": `${resolved.speed}s`,
    "--ml-stars-speed-medium": `${resolved.speed * 2}s`,
    "--ml-stars-speed-large": `${resolved.speed * 3}s`,
    "--ml-stars-offset-x": `${offset.x}px`,
    "--ml-stars-offset-y": `${offset.y}px`,
  } as CSSProperties

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    if (reducedMotionQuery.matches || resolved.factor <= 0) {
      setOffset({ x: 0, y: 0 })
      return
    }

    let animationFrame: number | null = null
    let nextOffset = { x: 0, y: 0 }

    const syncOffset = () => {
      animationFrame = null
      setOffset(nextOffset)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      nextOffset = {
        x: -(event.clientX - centerX) * resolved.factor,
        y: -(event.clientY - centerY) * resolved.factor,
      }

      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(syncOffset)
      }
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true })

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
    }
  }, [resolved.factor])

  return (
    <div
      className={cn(styles.effectLayer, styles.animateUiStars, className)}
      style={style}
      aria-hidden="true"
    >
      <div className={styles.starsParallaxLayer}>
        <div className={cn(styles.starsLayer, styles.starsLayerSmall)}>
          <span className={styles.starsField} />
          <span className={styles.starsFieldRepeat} />
        </div>
        <div className={cn(styles.starsLayer, styles.starsLayerMedium)}>
          <span className={styles.starsField} />
          <span className={styles.starsFieldRepeat} />
        </div>
        <div className={cn(styles.starsLayer, styles.starsLayerLarge)}>
          <span className={styles.starsField} />
          <span className={styles.starsFieldRepeat} />
        </div>
      </div>
    </div>
  )
}

// Animate UI Hole Background adapted as an internal MassageLab premium effect.
// Mirrors the source disc tween, clip path, and square-particle canvas loop while replacing Motion with CSS.
export function AnimateUiHoleBackground({
  className,
  animateUiHole,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const resolved = resolveAnimateUiHoleOptions(animateUiHole)
  const particleColorTriplet = hexToRgbTriplet(resolved.particleColor)
  const style = {
    "--ml-hole-stroke": resolved.strokeColor,
    "--ml-hole-particle-color": particleColorTriplet,
  } as CSSProperties

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")

    if (!container || !canvas || !context) {
      return undefined
    }

    const particleColor = parseHexColorToRgb(resolved.particleColor)
    const lineCount = resolved.numberOfLines
    const discCount = resolved.numberOfDiscs
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")
    const linear = (progress: number) => progress
    const easeInExpo = (progress: number) => (
      progress === 0 ? 0 : 2 ** (10 * (progress - 1))
    )
    let pixelRatio = 1
    let canvasWidth = 0
    let canvasHeight = 0
    let shouldRun = false
    let animationFrame = 0
    let resizeRetryFrame = 0
    let startDisc: AnimateUiHoleDisc = { p: 0, x: 0, y: 0, w: 0, h: 0 }
    let endDisc: AnimateUiHoleDisc = { p: 1, x: 0, y: 0, w: 0, h: 0 }
    let clipDisc: AnimateUiHoleDisc = { p: 0, x: 0, y: 0, w: 0, h: 0 }
    let clipPath = new Path2D()
    let linesCanvas: HTMLCanvasElement | null = null
    let particleArea = {
      sx: 0,
      sw: 0,
      ex: 0,
      ew: 0,
      h: 1,
    }
    let discs: AnimateUiHoleDisc[] = []
    let particles: AnimateUiHoleParticle[] = []

    const tweenValue = (
      start: number,
      end: number,
      progress: number,
      ease: ((value: number) => number) = linear,
    ) => start + (end - start) * ease(progress)

    const tweenDisc = (progress: number): AnimateUiHoleDisc => ({
      p: progress,
      x: tweenValue(startDisc.x, endDisc.x, progress),
      y: tweenValue(startDisc.y, endDisc.y, progress, easeInExpo),
      w: tweenValue(startDisc.w, endDisc.w, progress),
      h: tweenValue(startDisc.h, endDisc.h, progress),
    })

    const createParticle = (startInside = false): AnimateUiHoleParticle => {
      const startX = particleArea.sx + particleArea.sw * Math.random()
      const endX = particleArea.ex + particleArea.ew * Math.random()
      const y = startInside ? particleArea.h * Math.random() : particleArea.h
      const radius = 0.5 + Math.random() * 4
      const alpha = Math.min(1, Math.max(0.12, Math.random()))

      return {
        x: startX,
        sx: startX,
        dx: endX - startX,
        y,
        vy: 0.5 + Math.random(),
        progress: 0,
        radius,
        color: `rgba(${particleColor[0]}, ${particleColor[1]}, ${particleColor[2]}, ${alpha})`,
      }
    }

    const setDiscs = () => {
      startDisc = {
        p: 0,
        x: canvasWidth * 0.5,
        y: canvasHeight * 0.45,
        w: canvasWidth * 0.75,
        h: canvasHeight * 0.7,
      }
      endDisc = {
        p: 1,
        x: canvasWidth * 0.5,
        y: canvasHeight * 0.95,
        w: 0,
        h: 0,
      }
      discs = []

      let prevBottom = canvasHeight
      let nextClipDisc: AnimateUiHoleDisc | null = null

      for (let index = 0; index < discCount; index += 1) {
        const disc = tweenDisc(index / discCount)
        const bottom = disc.y + disc.h

        if (bottom <= prevBottom) {
          nextClipDisc = { ...disc }
        }

        prevBottom = bottom
        discs.push(disc)
      }

      clipDisc = nextClipDisc ?? discs[Math.max(0, Math.floor(discs.length * 0.5))] ?? startDisc
      clipPath = new Path2D()
      clipPath.ellipse(clipDisc.x, clipDisc.y, clipDisc.w, clipDisc.h, 0, 0, Math.PI * 2)
      clipPath.rect(clipDisc.x - clipDisc.w, 0, clipDisc.w * 2, clipDisc.y)
    }

    const setLines = () => {
      const lineSets: AnimateUiHolePoint[][] = Array.from({ length: lineCount }, () => [])
      const linesAngle = (Math.PI * 2) / lineCount

      for (const disc of discs) {
        for (let index = 0; index < lineCount; index += 1) {
          const angle = index * linesAngle
          lineSets[index]?.push({
            x: disc.x + Math.cos(angle) * disc.w,
            y: disc.y + Math.sin(angle) * disc.h,
          })
        }
      }

      const offscreenCanvas = document.createElement("canvas")
      offscreenCanvas.width = canvasWidth
      offscreenCanvas.height = canvasHeight
      const offscreenContext = offscreenCanvas.getContext("2d")

      if (!offscreenContext) {
        linesCanvas = null
        return
      }

      offscreenContext.strokeStyle = resolved.strokeColor
      offscreenContext.lineWidth = 2

      for (const line of lineSets) {
        offscreenContext.save()
        let lineIsIn = false

        for (let index = 1; index < line.length; index += 1) {
          const point = line[index]
          const previousPoint = line[index - 1]

          if (!point || !previousPoint) {
            continue
          }

          if (
            !lineIsIn &&
            (offscreenContext.isPointInPath(clipPath, point.x, point.y) ||
              offscreenContext.isPointInStroke(clipPath, point.x, point.y))
          ) {
            lineIsIn = true
          } else if (lineIsIn) {
            offscreenContext.clip(clipPath)
          }

          offscreenContext.beginPath()
          offscreenContext.moveTo(previousPoint.x, previousPoint.y)
          offscreenContext.lineTo(point.x, point.y)
          offscreenContext.stroke()
        }

        offscreenContext.restore()
      }

      linesCanvas = offscreenCanvas
    }

    const setParticles = () => {
      particleArea = {
        sw: clipDisc.w * 0.5,
        ew: clipDisc.w * 2,
        h: Math.max(1, canvasHeight * 0.85),
        sx: 0,
        ex: 0,
      }
      particleArea.sx = (canvasWidth - particleArea.sw) / 2
      particleArea.ex = (canvasWidth - particleArea.ew) / 2
      particles = Array.from({ length: 100 }, () => createParticle(true))
    }

    const rebuildScene = () => {
      setDiscs()
      setLines()
      setParticles()
    }

    const drawDiscs = () => {
      context.strokeStyle = resolved.strokeColor
      context.lineWidth = 2

      context.beginPath()
      context.ellipse(startDisc.x, startDisc.y, startDisc.w, startDisc.h, 0, 0, Math.PI * 2)
      context.stroke()

      for (let index = 0; index < discs.length; index += 1) {
        if (index % 5 !== 0) {
          continue
        }

        const disc = discs[index]

        if (!disc) {
          continue
        }

        const shouldClip = disc.w < clipDisc.w - 5

        if (shouldClip) {
          context.save()
          context.clip(clipPath)
        }

        context.beginPath()
        context.ellipse(disc.x, disc.y, disc.w, disc.h, 0, 0, Math.PI * 2)
        context.stroke()

        if (shouldClip) {
          context.restore()
        }
      }
    }

    const drawLines = () => {
      if (linesCanvas) {
        context.drawImage(linesCanvas, 0, 0)
      }
    }

    const drawParticles = () => {
      context.save()
      context.clip(clipPath)

      for (const particle of particles) {
        context.fillStyle = particle.color
        context.beginPath()
        context.rect(particle.x, particle.y, particle.radius, particle.radius)
        context.fill()
      }

      context.restore()
    }

    const moveDiscs = () => {
      for (const disc of discs) {
        const nextDisc = tweenDisc((disc.p + 0.001) % 1)
        disc.p = nextDisc.p
        disc.x = nextDisc.x
        disc.y = nextDisc.y
        disc.w = nextDisc.w
        disc.h = nextDisc.h
      }
    }

    const moveParticles = () => {
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index]

        if (!particle) {
          continue
        }

        particle.progress = 1 - particle.y / particleArea.h
        particle.x = particle.sx + particle.dx * particle.progress
        particle.y -= particle.vy

        if (particle.y < 0) {
          particles[index] = createParticle(false)
        }
      }
    }

    const drawFrame = (animate: boolean) => {
      if (canvasWidth <= 0 || canvasHeight <= 0) {
        return
      }

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.save()
      context.scale(pixelRatio, pixelRatio)

      if (animate) {
        moveDiscs()
        moveParticles()
      }

      drawDiscs()
      drawLines()
      drawParticles()
      context.restore()
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvasWidth = width
      canvasHeight = height
      canvas.width = Math.ceil(width * pixelRatio)
      canvas.height = Math.ceil(height * pixelRatio)
      rebuildScene()
      drawFrame(false)

      return true
    }

    const requestResizeRetry = () => {
      if (resizeRetryFrame) {
        return
      }

      resizeRetryFrame = window.requestAnimationFrame(() => {
        resizeRetryFrame = 0
        if (!resizeCanvas() && shouldRun) {
          requestResizeRetry()
        }
      })
    }

    const draw = () => {
      if (!shouldRun) {
        return
      }

      drawFrame(true)
      animationFrame = window.requestAnimationFrame(draw)
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }

      if (resizeRetryFrame) {
        window.cancelAnimationFrame(resizeRetryFrame)
        resizeRetryFrame = 0
      }

      drawFrame(false)
    }

    const startAnimation = () => {
      if (shouldRun) {
        return
      }

      shouldRun = true
      if (!resizeCanvas()) {
        requestResizeRetry()
        return
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (shouldAnimate) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    const handleResize = () => {
      if (!resizeCanvas()) {
        requestResizeRetry()
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
      canvas.width = 0
      canvas.height = 0
    }
  }, [
    resolved.numberOfDiscs,
    resolved.numberOfLines,
    resolved.particleColor,
    resolved.strokeColor,
  ])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.animateUiHole, className)}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.animateUiHoleCanvas} />
      <span className={styles.holeGlow} />
      <span className={styles.holeScanlines} />
    </div>
  )
}

// Aceternity UI Canvas Reveal Effect dot matrix, adapted as a passive internal MassageLab premium background.
export function AceternityCanvasRevealDotsBackground({
  className,
  canvasRevealDots,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const resolved = resolveCanvasRevealDotsOptions(canvasRevealDots)
  const {
    backgroundColor,
    dotColor,
    accentColor,
    dotSize,
    dotSpacing,
    opacity,
    animationSpeed,
    showGradient,
  } = resolved
  const style = {
    "--ml-canvas-reveal-background": backgroundColor,
    "--ml-canvas-reveal-dot-color": hexToRgbTriplet(dotColor),
    "--ml-canvas-reveal-accent-color": hexToRgbTriplet(accentColor),
    "--ml-canvas-reveal-gradient-opacity": showGradient ? 1 : 0,
  } as CSSProperties

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const context = canvas?.getContext("2d", { alpha: false })

    if (!canvas || !container || !context) {
      return
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px), (max-height: 480px)")
    const dotRgb = parseHexColorToRgb(dotColor)
    const accentRgb = parseHexColorToRgb(accentColor)
    const palette = [
      dotRgb,
      accentRgb,
      mixRgb(dotRgb, accentRgb, 0.44),
      mixRgb(dotRgb, [255, 255, 255], 0.38),
      mixRgb(accentRgb, [255, 255, 255], 0.46),
    ]

    let animationFrame = 0
    let resizeRetryFrame = 0
    let lastPaint = 0
    let shouldRun = false
    let pixelRatio = 1
    let canvasWidth = 0
    let canvasHeight = 0
    let dots: CanvasRevealDot[] = []

    const buildDots = (width: number, height: number) => {
      const spacing = Math.max(dotSpacing, dotSize + 2)
      const columns = Math.ceil(width / spacing) + 6
      const rows = Math.ceil(height / spacing) + 6
      const nextDots: CanvasRevealDot[] = []

      for (let row = -3; row < rows; row += 1) {
        for (let column = -3; column < columns; column += 1) {
          const seed = row * 4001 + column * 9176 + 97
          const opacityIndex = Math.floor(seededFraction(seed + 11) * canvasRevealDotOpacities.length)
          const colorIndex = Math.floor(seededFraction(seed + 23) * palette.length)
          const x = column * spacing + spacing / 2
          const y = row * spacing + spacing / 2

          nextDots.push({
            x,
            y,
            opacity: canvasRevealDotOpacities[opacityIndex] ?? canvasRevealDotOpacities[0],
            colorIndex,
            phase: seededFraction(seed + 71) * Math.PI * 2,
            speed: 0.55 + seededFraction(seed + 89) * 0.9,
            sizeFactor: 1,
          })
        }
      }

      return nextDots
    }

    const paintFrame = (timestamp: number, animate: boolean) => {
      if (canvasWidth <= 0 || canvasHeight <= 0) {
        return
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.fillStyle = backgroundColor
      context.fillRect(0, 0, canvasWidth, canvasHeight)

      const time = (timestamp / 1000) * animationSpeed
      const dotPixelSize = Math.max(1, dotSize)

      for (const dot of dots) {
        const shimmer = animate
          ? 0.86 + ((Math.sin(time * dot.speed * 2.2 + dot.phase) + 1) / 2) * 0.24
          : 1
        const alpha = Math.min(1, Math.max(0.02, dot.opacity * opacity * shimmer))
        const color = palette[dot.colorIndex] ?? palette[0]
        const size = dotPixelSize * dot.sizeFactor

        context.globalAlpha = alpha
        context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
        context.fillRect(Math.round(dot.x - size / 2), Math.round(dot.y - size / 2), size, size)
      }

      context.globalAlpha = 1
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvasWidth = width
      canvasHeight = height
      canvas.width = Math.ceil(width * pixelRatio)
      canvas.height = Math.ceil(height * pixelRatio)
      dots = buildDots(width, height)
      paintFrame(performance.now(), shouldRun)

      return true
    }

    const requestResizeRetry = () => {
      if (resizeRetryFrame) {
        return
      }

      resizeRetryFrame = window.requestAnimationFrame(() => {
        resizeRetryFrame = 0
        if (!resizeCanvas() && shouldRun) {
          requestResizeRetry()
        }
      })
    }

    const draw = (timestamp: number) => {
      if (!shouldRun) {
        return
      }

      if (timestamp - lastPaint >= 1000 / 30) {
        lastPaint = timestamp
        paintFrame(timestamp, true)
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }

      if (resizeRetryFrame) {
        window.cancelAnimationFrame(resizeRetryFrame)
        resizeRetryFrame = 0
      }

      paintFrame(performance.now(), false)
    }

    const startAnimation = () => {
      if (shouldRun) {
        return
      }

      shouldRun = true
      lastPaint = 0
      if (!resizeCanvas()) {
        requestResizeRetry()
        return
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (shouldAnimate) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    const handleResize = () => {
      if (!resizeCanvas()) {
        requestResizeRetry()
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
    }
  }, [accentColor, animationSpeed, backgroundColor, dotColor, dotSize, dotSpacing, opacity])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.aceternityCanvasRevealDots, className)}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.canvasRevealDotsCanvas} />
      <span className={styles.canvasRevealDotsOverlay} />
    </div>
  )
}

// Aceternity UI Spotlight New by Manu Arora, adapted with CSS keyframes so no Motion runtime is added.
export function AceternitySpotlightNewBackground({
  className,
  spotlight,
}: BackgroundEffectProps) {
  const resolved = resolveSpotlightNewOptions(spotlight)
  const colorTriplet = hexToRgbTriplet(resolved.color)
  const style = {
    "--ml-spotlight-color": colorTriplet,
    "--ml-spotlight-opacity": resolved.opacity,
    "--ml-spotlight-width": `${resolved.width}px`,
    "--ml-spotlight-height": `${resolved.height}px`,
    "--ml-spotlight-small-width": `${resolved.smallWidth}px`,
    "--ml-spotlight-translate-y": `${resolved.translateY}px`,
    "--ml-spotlight-duration": `${resolved.duration}s`,
    "--ml-spotlight-x-offset": `${resolved.xOffset}px`,
  } as CSSProperties

  const renderBeams = () => (
    <>
      <span className={cn(styles.spotlightNewBeam, styles.spotlightNewBeamPrimary)} />
      <span className={cn(styles.spotlightNewBeam, styles.spotlightNewBeamSecondary)} />
      <span className={cn(styles.spotlightNewBeam, styles.spotlightNewBeamTertiary)} />
    </>
  )

  return (
    <div
      className={cn(styles.effectLayer, styles.aceternitySpotlightNew, className)}
      style={style}
      aria-hidden="true"
    >
      <div className={cn(styles.spotlightNewGroup, styles.spotlightNewGroupLeft)}>
        {renderBeams()}
      </div>
      <div className={cn(styles.spotlightNewGroup, styles.spotlightNewGroupRight)}>
        {renderBeams()}
      </div>
    </div>
  )
}

// Aceternity UI Lamp Section Header by Manu Arora, adapted as an internal passive background.
export function AceternityLampEffectBackground({
  className,
  lamp,
}: BackgroundEffectProps) {
  const resolved = resolveLampSectionOptions(lamp)
  const lampColorTriplet = hexToRgbTriplet(resolved.color)
  const coreGlowWidth = Math.round(Math.max(144, resolved.glowWidth * 0.58))
  const style = {
    "--ml-lamp-background": resolved.backgroundColor,
    "--ml-lamp-color": lampColorTriplet,
    "--ml-lamp-glow-opacity": resolved.glowOpacity,
    "--ml-lamp-beam-width": `${resolved.beamWidth}px`,
    "--ml-lamp-glow-width": `${resolved.glowWidth}px`,
    "--ml-lamp-core-glow-width": `${coreGlowWidth}px`,
    "--ml-lamp-vertical-offset": `${resolved.verticalOffset}px`,
    "--ml-lamp-pulse-speed": `${resolved.pulseSpeed}s`,
  } as CSSProperties

  return (
    <div
      className={cn(styles.effectLayer, styles.aceternityLampEffect, className)}
      style={style}
      aria-hidden="true"
    >
      <div className={styles.lampRig}>
        <span className={cn(styles.lampBeam, styles.lampBeamLeft)} />
        <span className={cn(styles.lampBeam, styles.lampBeamRight)} />
        <span className={styles.lampWideGlow} />
        <span className={styles.lampCoreGlow} />
        <span className={styles.lampLine} />
      </div>
    </div>
  )
}

export function AceternitySparklesBackground({ className }: BackgroundEffectProps) {
  return (
    <div className={cn(styles.effectLayer, styles.sparkles, className)} aria-hidden="true">
      {sparkles.map(([x, y, size, delay]) => (
        <span
          key={`${x}-${y}`}
          className={styles.sparkle}
          style={{
            "--x": x,
            "--y": y,
            "--size": size,
            "--delay": delay,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

function resolveGradientAnimationOptions(
  gradientAnimation: GradientAnimationOptions | undefined,
): Required<GradientAnimationOptions> {
  return {
    backgroundStartColor: normalizeHexColor(gradientAnimation?.backgroundStartColor, DEFAULT_GRADIENT_ANIMATION.backgroundStartColor),
    backgroundEndColor: normalizeHexColor(gradientAnimation?.backgroundEndColor, DEFAULT_GRADIENT_ANIMATION.backgroundEndColor),
    firstColor: normalizeHexColor(gradientAnimation?.firstColor, DEFAULT_GRADIENT_ANIMATION.firstColor),
    secondColor: normalizeHexColor(gradientAnimation?.secondColor, DEFAULT_GRADIENT_ANIMATION.secondColor),
    thirdColor: normalizeHexColor(gradientAnimation?.thirdColor, DEFAULT_GRADIENT_ANIMATION.thirdColor),
    fourthColor: normalizeHexColor(gradientAnimation?.fourthColor, DEFAULT_GRADIENT_ANIMATION.fourthColor),
    fifthColor: normalizeHexColor(gradientAnimation?.fifthColor, DEFAULT_GRADIENT_ANIMATION.fifthColor),
    speed: clampNumber(gradientAnimation?.speed, DEFAULT_GRADIENT_ANIMATION.speed, 0.25, 2.5),
    size: clampNumber(gradientAnimation?.size, DEFAULT_GRADIENT_ANIMATION.size, 45, 120),
  }
}

function resolveAnimateUiGradientOptions(
  animateUiGradient: AnimateUiGradientOptions | undefined,
): Required<AnimateUiGradientOptions> {
  const requestedHarmony = animateUiGradient?.harmony

  return {
    primaryColor: normalizeHexColor(animateUiGradient?.primaryColor, DEFAULT_ANIMATE_UI_GRADIENT.primaryColor),
    harmony: requestedHarmony && animateUiGradientHarmonies.has(requestedHarmony)
      ? requestedHarmony
      : DEFAULT_ANIMATE_UI_GRADIENT.harmony,
    opacity: clampNumber(animateUiGradient?.opacity, DEFAULT_ANIMATE_UI_GRADIENT.opacity, 0.15, 1),
  }
}

function resolveAnimateUiHoleOptions(
  animateUiHole: AnimateUiHoleOptions | undefined,
): Required<AnimateUiHoleOptions> {
  return {
    strokeColor: normalizeHexColor(animateUiHole?.strokeColor, DEFAULT_ANIMATE_UI_HOLE.strokeColor),
    numberOfLines: Math.trunc(clampNumber(animateUiHole?.numberOfLines, DEFAULT_ANIMATE_UI_HOLE.numberOfLines, 12, 96)),
    numberOfDiscs: Math.trunc(clampNumber(animateUiHole?.numberOfDiscs, DEFAULT_ANIMATE_UI_HOLE.numberOfDiscs, 12, 96)),
    particleColor: normalizeHexColor(animateUiHole?.particleColor, DEFAULT_ANIMATE_UI_HOLE.particleColor),
  }
}

function resolveAnimateUiStarsOptions(
  animateUiStars: AnimateUiStarsOptions | undefined,
): Required<AnimateUiStarsOptions> {
  return {
    starColor: normalizeHexColor(animateUiStars?.starColor, DEFAULT_ANIMATE_UI_STARS.starColor),
    speed: clampNumber(animateUiStars?.speed, DEFAULT_ANIMATE_UI_STARS.speed, 18, 120),
    density: clampNumber(animateUiStars?.density, DEFAULT_ANIMATE_UI_STARS.density, 0.25, 1.5),
    factor: clampNumber(animateUiStars?.factor, DEFAULT_ANIMATE_UI_STARS.factor, 0, 0.12),
  }
}

function createAnimateUiGradientPalette(
  primaryColor: string,
  harmony: AnimateUiGradientHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const richSaturation = Math.min(0.92, Math.max(0.34, saturation))
  const balancedLightness = Math.min(0.72, Math.max(0.24, lightness))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue - 8, richSaturation, balancedLightness),
        hslToHex(hue + 180, Math.min(0.9, richSaturation * 0.9), Math.min(0.68, balancedLightness + 0.04)),
        hslToHex(hue + 8, richSaturation, Math.max(0.22, balancedLightness - 0.03)),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, richSaturation, balancedLightness),
        hslToHex(hue + 150, Math.min(0.88, richSaturation * 0.9), Math.min(0.7, balancedLightness + 0.03)),
        hslToHex(hue + 210, Math.min(0.9, richSaturation * 0.95), Math.max(0.24, balancedLightness - 0.04)),
      ]
    case "triad":
      return [
        hslToHex(hue, richSaturation, balancedLightness),
        hslToHex(hue + 120, Math.min(0.9, richSaturation * 0.92), Math.min(0.7, balancedLightness + 0.02)),
        hslToHex(hue + 240, Math.min(0.9, richSaturation * 0.96), Math.max(0.24, balancedLightness - 0.03)),
      ]
    case "square":
      return [
        hslToHex(hue, richSaturation, balancedLightness),
        hslToHex(hue + 90, Math.min(0.86, richSaturation * 0.9), Math.min(0.68, balancedLightness + 0.04)),
        hslToHex(hue + 180, Math.min(0.9, richSaturation * 0.94), Math.max(0.24, balancedLightness - 0.04)),
      ]
    case "compound":
      return [
        hslToHex(hue - 24, Math.min(0.92, richSaturation * 0.94), Math.min(0.68, balancedLightness + 0.02)),
        hslToHex(hue, richSaturation, balancedLightness),
        hslToHex(hue + 180, Math.min(0.88, richSaturation * 0.86), Math.max(0.26, balancedLightness - 0.05)),
      ]
    case "shades":
      return [
        hslToHex(hue, richSaturation, Math.min(0.82, balancedLightness + 0.22)),
        hslToHex(hue, richSaturation, balancedLightness),
        hslToHex(hue, richSaturation, Math.max(0.16, balancedLightness - 0.24)),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, Math.min(0.7, richSaturation * 0.64), Math.min(0.78, balancedLightness + 0.18)),
        hslToHex(hue, richSaturation, balancedLightness),
        hslToHex(hue, Math.min(0.98, richSaturation * 1.08), Math.max(0.2, balancedLightness - 0.18)),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 32, Math.min(0.9, richSaturation * 0.9), Math.max(0.26, balancedLightness - 0.02)),
        hslToHex(hue, richSaturation, balancedLightness),
        hslToHex(hue + 32, Math.min(0.92, richSaturation * 0.98), Math.min(0.72, balancedLightness + 0.04)),
      ]
  }
}

function resolveCanvasRevealDotsOptions(
  canvasRevealDots: CanvasRevealDotsOptions | undefined,
): Required<CanvasRevealDotsOptions> {
  const resolved = {
    backgroundColor: normalizeHexColor(canvasRevealDots?.backgroundColor, DEFAULT_CANVAS_REVEAL_DOTS.backgroundColor),
    dotColor: normalizeHexColor(canvasRevealDots?.dotColor, DEFAULT_CANVAS_REVEAL_DOTS.dotColor),
    accentColor: normalizeHexColor(canvasRevealDots?.accentColor, DEFAULT_CANVAS_REVEAL_DOTS.accentColor),
    dotSize: clampNumber(canvasRevealDots?.dotSize, DEFAULT_CANVAS_REVEAL_DOTS.dotSize, 1, 5),
    dotSpacing: clampNumber(canvasRevealDots?.dotSpacing, DEFAULT_CANVAS_REVEAL_DOTS.dotSpacing, 4, 24),
    opacity: clampNumber(canvasRevealDots?.opacity, DEFAULT_CANVAS_REVEAL_DOTS.opacity, 0.08, 1),
    animationSpeed: clampNumber(canvasRevealDots?.animationSpeed, DEFAULT_CANVAS_REVEAL_DOTS.animationSpeed, 0.1, 1),
    showGradient:
      typeof canvasRevealDots?.showGradient === "boolean"
        ? canvasRevealDots.showGradient
        : DEFAULT_CANVAS_REVEAL_DOTS.showGradient,
  }

  return isLegacyCanvasRevealDotsDefault(resolved) ? DEFAULT_CANVAS_REVEAL_DOTS : resolved
}

function resolveBackgroundLinesOptions(
  backgroundLines: BackgroundLinesOptions | undefined,
): Required<BackgroundLinesOptions> {
  return {
    duration: clampNumber(backgroundLines?.duration, DEFAULT_BACKGROUND_LINES.duration, 4, 18),
  }
}

function resolveSpotlightNewOptions(spotlight: SpotlightNewOptions | undefined): Required<SpotlightNewOptions> {
  return {
    color: normalizeHexColor(spotlight?.color, DEFAULT_SPOTLIGHT_NEW.color),
    opacity: clampNumber(spotlight?.opacity, DEFAULT_SPOTLIGHT_NEW.opacity, 0.25, 1.5),
    width: clampNumber(spotlight?.width, DEFAULT_SPOTLIGHT_NEW.width, 240, 900),
    height: clampNumber(spotlight?.height, DEFAULT_SPOTLIGHT_NEW.height, 600, 1800),
    smallWidth: clampNumber(spotlight?.smallWidth, DEFAULT_SPOTLIGHT_NEW.smallWidth, 120, 420),
    translateY: clampNumber(spotlight?.translateY, DEFAULT_SPOTLIGHT_NEW.translateY, -650, 120),
    duration: clampNumber(spotlight?.duration, DEFAULT_SPOTLIGHT_NEW.duration, 3, 16),
    xOffset: clampNumber(spotlight?.xOffset, DEFAULT_SPOTLIGHT_NEW.xOffset, 0, 220),
  }
}

function resolveLampSectionOptions(lamp: LampSectionOptions | undefined): Required<LampSectionOptions> {
  return {
    backgroundColor: normalizeHexColor(lamp?.backgroundColor, DEFAULT_LAMP_SECTION.backgroundColor),
    color: normalizeHexColor(lamp?.color, DEFAULT_LAMP_SECTION.color),
    glowOpacity: clampNumber(lamp?.glowOpacity, DEFAULT_LAMP_SECTION.glowOpacity, 0.18, 0.95),
    beamWidth: clampNumber(lamp?.beamWidth, DEFAULT_LAMP_SECTION.beamWidth, 240, 900),
    glowWidth: clampNumber(lamp?.glowWidth, DEFAULT_LAMP_SECTION.glowWidth, 180, 900),
    verticalOffset: clampNumber(lamp?.verticalOffset, DEFAULT_LAMP_SECTION.verticalOffset, -320, 160),
    pulseSpeed: clampNumber(lamp?.pulseSpeed, DEFAULT_LAMP_SECTION.pulseSpeed, 4, 18),
  }
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function isLegacyCanvasRevealDotsDefault(resolved: Required<CanvasRevealDotsOptions>) {
  // Keep existing saved settings from the first teal CSS-grid pass from forcing the wrong demo look.
  return Object.entries(LEGACY_CANVAS_REVEAL_DOTS).every(([key, value]) => (
    resolved[key as keyof CanvasRevealDotsOptions] === value
  ))
}

function seededFraction(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function buildAnimateUiStarsShadow(count: number, color: string, seedBase: number) {
  return Array.from({ length: count }, (_, index) => {
    const seed = seedBase + index * 97
    const x = Math.floor(seededFraction(seed + 11) * 4000) - 2000
    const y = Math.floor(seededFraction(seed + 29) * 4000) - 2000
    return `${x}px ${y}px ${color}`
  }).join(", ")
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function mixRgb(first: RgbColor, second: RgbColor, amount: number): RgbColor {
  return [
    Math.round(first[0] + (second[0] - first[0]) * amount),
    Math.round(first[1] + (second[1] - first[1]) * amount),
    Math.round(first[2] + (second[2] - first[2]) * amount),
  ]
}

function rgbToHsl([red, green, blue]: RgbColor): RgbColor {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2

  if (max === min) {
    return [0, 0, lightness]
  }

  const delta = max - min
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min)
  let hue = 0

  if (max === r) {
    hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60
  } else if (max === g) {
    hue = ((b - r) / delta + 2) * 60
  } else {
    hue = ((r - g) / delta + 4) * 60
  }

  return [hue, saturation, lightness]
}

function hslToHex(rawHue: number, saturation: number, lightness: number) {
  const hue = ((rawHue % 360) + 360) % 360
  const s = Math.min(1, Math.max(0, saturation))
  const l = Math.min(1, Math.max(0, lightness))
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = l - chroma / 2
  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) {
    r = chroma
    g = x
  } else if (hue < 120) {
    r = x
    g = chroma
  } else if (hue < 180) {
    g = chroma
    b = x
  } else if (hue < 240) {
    g = x
    b = chroma
  } else if (hue < 300) {
    r = x
    b = chroma
  } else {
    r = chroma
    b = x
  }

  const toHex = (channel: number) => Math.round((channel + match) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToRgbTriplet(value: string) {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  return `${red}, ${green}, ${blue}`
}
