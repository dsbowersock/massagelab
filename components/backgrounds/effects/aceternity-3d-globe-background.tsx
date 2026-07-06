"use client"

import { useEffect, useMemo, useRef, type CSSProperties } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import type { Aceternity3DGlobeOptions, BackgroundEffectProps } from "./css-backgrounds"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

const DEFAULT_EARTH_TEXTURE = "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg"
const DEFAULT_BUMP_TEXTURE = "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png"
const COBE_WORLD_MAP_MASK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAACAAQAAAADMzoqnAAAAAXNSR0IArs4c6QAABA5JREFUeNrV179uHEUAx/Hf3JpbF+E2VASBsmVKTBcpKJs3SMEDcDwBiVJAAewYEBUivIHT0uUBIt0YCovKD0CRjUC4QfHYh8hYXu+P25vZ2Zm9c66gMd/GJ/tz82d3bk8GN4SrByYF2366FNTACIAkivVAAazQdnf3MvAlbNUQfOPAdQDvSAimMWhwy4I2g4SU+Kp04ISLpPBAKLxPyic3O/CCi+Y7rUJbiodcpDOFY7CgxCEXmdYD2EYK2s5lApOx5pEDDYCUwM1XdJUwBV11QQMg59kePSCaPAASQMEL2hwo6TJFgxpg+TgC2ymXPbuvc40awr3D1QCFfbH9kcoqAOkZozpQo0aqAGQRKCog/+tjkgbNFEtg2FffBvBGlSxHoAaAa1u6X4PBAwDiR8FFsrQgeUhfJTSALaB9jy5NCybJPn1SVFiWk7ywN+KzhH1aKAuydhGkbEF4lWohLXDXavlyFgHY7LBnLRdlAP6BS5Cc8RfVDXbkwN/oIvmY+6obbNeBP0JwTuMGu9gTzy1Q4RS/cWpfzszeYwd+CAFrtBW/Hur0gLbJGlD+/OjVwe/drfBxkbbg63dndEDfiEBlAd7ac0BPe1D6Jd8dfbLH+RI0OzseFB5s01/M+gMdAeluLOCAuaUA9Lezo/vSgXoCX9rtEiXnp7Q1W/CNyWcd8DXoS6jH/YZ5vAJEWY2dXFQe2TUgaFaNejCzJ98g6HnlVrsE58sDcYqg+9XY75fPqdoh/kRQWiXKg8MWlJQxUFMPjqnyujhFBE7UxIMjyszk0QwQlFsezImsyvUYYYVED2pk6m0Tg8T04Fwjk2kdAwSACqlM6gRRt3vQYAFGX0Ah7Ebx1H+MDRI5ui0QldH4j7FGcm90XdxD2Jg1AOEAVAKhEFXSn4cKUELurIAKwJ3MArypPscQaLhJFICJ0ohjDySAdH8AhDtCiTuMycH8CXzhH9jUACAO5uMhoAwA5i+T6WAKmmAqnLy80wxHqIPFYpqCwxGaYLt4Dyievg5kEoVEUAhs6pqKgFtDQYOuaXypaWKQfIuwwoGSZgfLsu/XAtI8cGN+h7Cc1A5oLOMhwlIPXuhu48AIvsSBkvtV9wsJRKCyYLfq5lTrQMFd1a262oqBck9K1V0YjQg0iEYYgpS1A9GlXQV5cykwm4A7BzVsxQqo7E+zCegO7Ma7yKgsuOcfKbMBwLC8wvVNYDsANYalEpOAa6zpWjTeMKGwEwC1CiQewJc5EKfgy7GmRAZA4vUVGwE2dPM/g0xuAInE/yG5aZ8ISxWGfYigUVbdyBElTHh2uCwGdfCkOLGgQVBh3Ewp+/QK4CDlR5Ws/Zf7yhCf8pH7vinWAvoVCQ6zz0NX5V/6GkAVV+2/5qsJ/gU8bsxpM8IeAQAAAABJRU5ErkJggg=="
const GRAPHIC_FIBONACCI_GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const WEBGL_GLOBE_VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const WEBGL_GLOBE_FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_centerLongitude;
uniform float u_tilt;
uniform vec3 u_backgroundColor;
uniform vec3 u_globeColor;
uniform vec3 u_atmosphereColor;
uniform vec3 u_wireframeColor;
uniform vec3 u_graphicMapColor;
uniform vec3 u_graphicGlowColor;
uniform vec3 u_lightDirection;
uniform float u_ambientIntensity;
uniform float u_pointLightIntensity;
uniform float u_sunLighting;
uniform float u_graphicMode;
uniform float u_graphicMapSamples;
uniform float u_bumpScale;
uniform float u_textureReady;
uniform float u_bumpReady;
uniform float u_showAtmosphere;
uniform float u_atmosphereIntensity;
uniform float u_atmosphereBlur;
uniform float u_showWireframe;
uniform sampler2D u_earthTexture;
uniform sampler2D u_bumpTexture;

const float PI = 3.141592653589793;

vec3 viewToWorld(vec3 normal) {
  float c = cos(u_tilt);
  float s = sin(u_tilt);
  return normalize(vec3(
    normal.x * c + normal.y * s,
    -normal.x * s + normal.y * c,
    normal.z
  ));
}

float gridLine(float value, float divisions, float width) {
  float centered = abs(fract(value * divisions) - 0.5);
  return 1.0 - smoothstep(width, width * 1.8, centered);
}

float hash12(vec2 value) {
  vec3 value3 = fract(vec3(value.xyx) * 0.1031);
  value3 += dot(value3, value3.yzx + 33.33);
  return fract((value3.x + value3.y) * value3.z);
}

void main() {
  vec2 point = (gl_FragCoord.xy - u_center) / u_radius;
  float radiusSquared = dot(point, point);
  float distanceFromCenter = sqrt(radiusSquared);
  float atmosphereReach = 1.0 + clamp(u_atmosphereBlur, 0.5, 5.0) * 0.08;
  float outerGlow = u_showAtmosphere
    * u_atmosphereIntensity
    * smoothstep(atmosphereReach, 1.0, distanceFromCenter)
    * smoothstep(0.78, 1.0, distanceFromCenter);
  float graphicOuterGlow = u_graphicMode
    * (1.0 - smoothstep(1.0, 1.075, distanceFromCenter))
    * smoothstep(0.985, 1.0, distanceFromCenter);
  vec3 background = u_backgroundColor
    + u_atmosphereColor * outerGlow * 0.22
    + u_graphicGlowColor * graphicOuterGlow * 0.09;

  if (radiusSquared > 1.0) {
    gl_FragColor = vec4(background, 1.0);
    return;
  }

  float z = sqrt(max(0.0, 1.0 - radiusSquared));
  vec3 normalView = normalize(vec3(point.x, point.y, z));
  vec3 normalWorld = viewToWorld(normalView);
  float latitude = asin(clamp(normalWorld.y, -1.0, 1.0));
  float longitude = atan(normalWorld.x, normalWorld.z) + u_centerLongitude;
  vec2 textureUv = vec2(fract((longitude + PI) / (2.0 * PI)), 0.5 - latitude / PI);

  vec3 earthColor = texture2D(u_earthTexture, textureUv).rgb;
  vec3 fallbackColor = mix(u_globeColor, vec3(0.12, 0.28, 0.45), 0.42 + normalWorld.y * 0.08);
  vec3 color = mix(fallbackColor, earthColor, u_textureReady);
  color = mix(color, color * u_globeColor * 1.7, 0.08);

  float bump = texture2D(u_bumpTexture, textureUv).r;
  float bumpRight = texture2D(u_bumpTexture, textureUv + vec2(0.0014, 0.0)).r;
  float bumpUp = texture2D(u_bumpTexture, textureUv + vec2(0.0, 0.0028)).r;
  float bumpStrength = u_bumpReady * min(u_bumpScale / 3.0, 1.0);
  vec3 litNormal = normalize(normalView + vec3(
    (bump - bumpRight) * bumpStrength * 0.54,
    (bump - bumpUp) * bumpStrength * 0.54,
    0.0
  ));
  color = pow(max(color, vec3(0.0)), vec3(0.86));
  color *= mix(0.9, 1.24, smoothstep(0.18, 0.88, bump) * bumpStrength);

  vec3 lightDirection = normalize(u_lightDirection);
  float ndl = dot(litNormal, lightDirection);
  float softDay = smoothstep(-0.16, 0.38, ndl);
  float sunDay = smoothstep(-0.035, 0.035, ndl);
  float day = mix(softDay, sunDay, u_sunLighting);
  float ambient = 0.12 + clamp(u_ambientIntensity, 0.0, 2.0) * 0.24;
  float pointLight = clamp(u_pointLightIntensity / 4.0, 0.0, 1.0);
  float manualShade = mix(ambient * 0.5, min(1.46, ambient + pointLight * 1.18), softDay);
  float sunNightShade = 0.018 + clamp(u_ambientIntensity, 0.0, 2.0) * 0.025;
  float sunDayShade = min(1.64, 0.74 + pointLight * 1.28 + clamp(u_ambientIntensity, 0.0, 2.0) * 0.04);
  float sunShade = mix(sunNightShade, sunDayShade, sunDay);
  color = mix(color, mix(color * vec3(0.18, 0.28, 0.46), color, sunDay), u_sunLighting);
  float shade = mix(manualShade, sunShade, u_sunLighting);
  color *= shade;

  float specular = pow(max(dot(reflect(-lightDirection, litNormal), vec3(0.0, 0.0, 1.0)), 0.0), 36.0)
    * pointLight
    * day
    * 0.34;
  color += vec3(specular);
  color += (bump - 0.5) * 0.22 * bumpStrength * day;

  float rim = smoothstep(0.68, 1.0, radiusSquared);
  color *= 1.0 - rim * 0.64;
  color += u_atmosphereColor * rim * u_showAtmosphere * u_atmosphereIntensity * 0.2;

  float landSignal = max(earthColor.g - earthColor.b * 0.58, earthColor.r - earthColor.b * 0.34);
  float landMask = smoothstep(0.02, 0.18, landSignal) * u_textureReady;
  float density = mix(62.0, 118.0, clamp((u_graphicMapSamples - 1000.0) / 9000.0, 0.0, 1.0));
  float latitudeCompression = max(0.42, cos(latitude));
  vec2 dotUv = vec2((longitude + PI) / (2.0 * PI), (latitude + PI * 0.5) / PI);
  vec2 dotGrid = vec2(dotUv.x * density * latitudeCompression, dotUv.y * density * 0.58);
  vec2 dotIndex = floor(dotGrid);
  vec2 dotJitter = vec2(hash12(dotIndex + 17.17), hash12(dotIndex + 43.31)) * 0.22 - 0.11;
  vec2 dotCell = fract(dotGrid) - 0.5 - dotJitter;
  float dotShape = 1.0 - smoothstep(0.055, 0.13, length(dotCell));
  float facing = smoothstep(-0.12, 0.58, normalView.z);
  float graphicDay = mix(0.86, sunDay, u_sunLighting);
  float edgeFalloff = smoothstep(0.52, 1.0, radiusSquared);
  float graphicRimGlow = smoothstep(0.78, 1.0, radiusSquared);
  float graphicRimLine = smoothstep(0.972, 0.993, radiusSquared);
  float graphicInnerShade = 1.0 - smoothstep(0.46, 1.0, radiusSquared) * 0.08;
  vec3 graphicBase = mix(vec3(0.024, 0.025, 0.028), vec3(0.098, 0.102, 0.108), edgeFalloff);
  graphicBase += u_graphicGlowColor * graphicRimGlow * 0.012;
  float shaderDotLayer = step(1.0, u_graphicMapSamples);
  vec3 graphicDots = u_graphicMapColor * shaderDotLayer * dotShape * landMask * facing * mix(0.18, 0.92, graphicDay);
  vec3 graphicColor = graphicBase * graphicInnerShade
    + graphicDots
    + u_graphicGlowColor * graphicRimLine * 0.14
    + u_graphicGlowColor * pow(graphicRimLine, 7.0) * 0.28;
  graphicColor = mix(graphicColor * vec3(0.42, 0.44, 0.48), graphicColor, graphicDay);
  color = mix(color, graphicColor, u_graphicMode);

  if (u_showWireframe > 0.5 && u_graphicMode < 0.5) {
    float latLine = gridLine((latitude + PI * 0.5) / PI, 9.0, 0.014);
    float lonLine = gridLine((longitude + PI) / (2.0 * PI), 18.0, 0.012);
    float line = max(latLine, lonLine) * smoothstep(0.99, 0.65, radiusSquared);
    color = mix(color, u_wireframeColor, clamp(line * 0.32, 0.0, 1.0));
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`

type RgbColor = [number, number, number]
type GlobeViewStyle = "realistic" | "graphic"
type GlobeLightingMode = "manual" | "sun"
type GlobeMarkerIcon = "pin" | "person" | "heart" | "star" | "home"
type RenderedMarkerIcon = GlobeMarkerIcon | "massagelab"
type ViewVector = { x: number; y: number; z: number }
type GraphicMapPoint = { latitude: number; longitude: number; brightness: number }

const EARTH_AXIAL_TILT_DEGREES = 23.44
const FIXED_SUN_LIGHT_VECTOR = normalizeViewVector({ x: -0.86, y: 0.08, z: 0.5 })
const FIXED_SUN_LONGITUDE_OFFSET_DEGREES = radiansToDegrees(
  Math.atan2(FIXED_SUN_LIGHT_VECTOR.x, FIXED_SUN_LIGHT_VECTOR.z),
)
const MASSAGELAB_MARKER_ICON_SOURCE = "/brand/massagelab-mark-square-tight.png"
const MASSAGELAB_MARKER = {
  latitude: 40.8687,
  longitude: -82.3182,
  label: "",
  icon: "massagelab" as const,
  markerSize: 0.052,
}

interface ResolvedGlobeOptions {
  viewStyle: GlobeViewStyle
  backgroundColor: string
  globeColor: string
  graphicMapColor: string
  graphicGlowColor: string
  graphicMarkerColor: string
  graphicMapSamples: number
  autoRotateSpeed: number
  reverseSpin: boolean
  globeScale: number
  bumpScale: number
  ambientIntensity: number
  pointLightIntensity: number
  lightingMode: GlobeLightingMode
  enablePan: boolean
  panX: number
  panY: number
  showTilt: boolean
  showAtmosphere: boolean
  atmosphereColor: string
  atmosphereIntensity: number
  atmosphereBlur: number
  showWireframe: boolean
  wireframeColor: string
  markerEnabled: boolean
  markerLat: number
  markerLng: number
  markerLabel: string
  markerIcon: GlobeMarkerIcon
  markerSize: number
}

const DEFAULT_GLOBE_OPTIONS: ResolvedGlobeOptions = {
  viewStyle: "realistic",
  backgroundColor: "#020617",
  globeColor: "#1A1A2E",
  graphicMapColor: "#FFFFFF",
  graphicGlowColor: "#FFFFFF",
  graphicMarkerColor: "#FB6415",
  graphicMapSamples: 8000,
  autoRotateSpeed: 0.3,
  reverseSpin: true,
  globeScale: 0.4,
  bumpScale: 1,
  ambientIntensity: 0.6,
  pointLightIntensity: 1.5,
  lightingMode: "manual",
  enablePan: false,
  panX: 0,
  panY: 0,
  showTilt: true,
  showAtmosphere: false,
  atmosphereColor: "#4DA6FF",
  atmosphereIntensity: 0.5,
  atmosphereBlur: 2,
  showWireframe: false,
  wireframeColor: "#4A9EFF",
  markerEnabled: false,
  markerLat: 39.8283,
  markerLng: -98.5795,
  markerLabel: "Your location",
  markerIcon: "pin",
  markerSize: 0.06,
}

function resolveGlobeOptions(options: Aceternity3DGlobeOptions | undefined): ResolvedGlobeOptions {
  return {
    viewStyle: options?.viewStyle === "graphic" || options?.viewStyle === "realistic"
      ? options.viewStyle
      : DEFAULT_GLOBE_OPTIONS.viewStyle,
    backgroundColor: normalizeHexColor(options?.backgroundColor, DEFAULT_GLOBE_OPTIONS.backgroundColor),
    globeColor: normalizeHexColor(options?.globeColor, DEFAULT_GLOBE_OPTIONS.globeColor),
    graphicMapColor: normalizeHexColor(options?.graphicMapColor, DEFAULT_GLOBE_OPTIONS.graphicMapColor),
    graphicGlowColor: normalizeHexColor(options?.graphicGlowColor, DEFAULT_GLOBE_OPTIONS.graphicGlowColor),
    graphicMarkerColor: normalizeHexColor(options?.graphicMarkerColor, DEFAULT_GLOBE_OPTIONS.graphicMarkerColor),
    graphicMapSamples: clampNumber(
      options?.graphicMapSamples,
      DEFAULT_GLOBE_OPTIONS.graphicMapSamples,
      1000,
      10000,
    ),
    autoRotateSpeed: clampNumber(options?.autoRotateSpeed, DEFAULT_GLOBE_OPTIONS.autoRotateSpeed, 0.01, 2),
    // Reverse spin and axial tilt are fixed product defaults now; legacy options are ignored.
    reverseSpin: true,
    globeScale: clampNumber(options?.globeScale, DEFAULT_GLOBE_OPTIONS.globeScale, 0.05, 0.95),
    bumpScale: clampNumber(options?.bumpScale, DEFAULT_GLOBE_OPTIONS.bumpScale, 0, 3),
    ambientIntensity: clampNumber(options?.ambientIntensity, DEFAULT_GLOBE_OPTIONS.ambientIntensity, 0, 2),
    pointLightIntensity: clampNumber(options?.pointLightIntensity, DEFAULT_GLOBE_OPTIONS.pointLightIntensity, 0, 4),
    lightingMode: options?.lightingMode === "sun" || options?.lightingMode === "manual"
      ? options.lightingMode
      : DEFAULT_GLOBE_OPTIONS.lightingMode,
    enablePan:
      typeof options?.enablePan === "boolean"
        ? options.enablePan
        : DEFAULT_GLOBE_OPTIONS.enablePan,
    panX: clampNumber(options?.panX, DEFAULT_GLOBE_OPTIONS.panX, -50, 50),
    panY: clampNumber(options?.panY, DEFAULT_GLOBE_OPTIONS.panY, -50, 50),
    showTilt: true,
    showAtmosphere:
      typeof options?.showAtmosphere === "boolean"
        ? options.showAtmosphere
        : DEFAULT_GLOBE_OPTIONS.showAtmosphere,
    atmosphereColor: normalizeHexColor(options?.atmosphereColor, DEFAULT_GLOBE_OPTIONS.atmosphereColor),
    atmosphereIntensity: clampNumber(
      options?.atmosphereIntensity,
      DEFAULT_GLOBE_OPTIONS.atmosphereIntensity,
      0,
      2,
    ),
    atmosphereBlur: clampNumber(options?.atmosphereBlur, DEFAULT_GLOBE_OPTIONS.atmosphereBlur, 0.5, 5),
    showWireframe:
      typeof options?.showWireframe === "boolean"
        ? options.showWireframe
        : DEFAULT_GLOBE_OPTIONS.showWireframe,
    wireframeColor: normalizeHexColor(options?.wireframeColor, DEFAULT_GLOBE_OPTIONS.wireframeColor),
    markerEnabled:
      typeof options?.markerEnabled === "boolean"
        ? options.markerEnabled
        : DEFAULT_GLOBE_OPTIONS.markerEnabled,
    markerLat: clampNumber(options?.markerLat, DEFAULT_GLOBE_OPTIONS.markerLat, -90, 90),
    markerLng: clampNumber(options?.markerLng, DEFAULT_GLOBE_OPTIONS.markerLng, -180, 180),
    markerLabel: normalizeOptionalShortText(options?.markerLabel, DEFAULT_GLOBE_OPTIONS.markerLabel, 80),
    markerIcon: normalizeMarkerIcon(options?.markerIcon, DEFAULT_GLOBE_OPTIONS.markerIcon),
    markerSize: clampNumber(options?.markerSize, DEFAULT_GLOBE_OPTIONS.markerSize, 0.03, 0.16),
  }
}

export default function Aceternity3DGlobeBackground({
  className,
  aceternity3DGlobe,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const markerCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const optionAmbientIntensity = aceternity3DGlobe?.ambientIntensity
  const optionAtmosphereBlur = aceternity3DGlobe?.atmosphereBlur
  const optionAtmosphereColor = aceternity3DGlobe?.atmosphereColor
  const optionAtmosphereIntensity = aceternity3DGlobe?.atmosphereIntensity
  const optionAutoRotateSpeed = aceternity3DGlobe?.autoRotateSpeed
  const optionBackgroundColor = aceternity3DGlobe?.backgroundColor
  const optionBumpScale = aceternity3DGlobe?.bumpScale
  const optionGlobeColor = aceternity3DGlobe?.globeColor
  const optionGlobeScale = aceternity3DGlobe?.globeScale
  const optionGraphicGlowColor = aceternity3DGlobe?.graphicGlowColor
  const optionGraphicMapColor = aceternity3DGlobe?.graphicMapColor
  const optionGraphicMapSamples = aceternity3DGlobe?.graphicMapSamples
  const optionGraphicMarkerColor = aceternity3DGlobe?.graphicMarkerColor
  const optionEnablePan = aceternity3DGlobe?.enablePan
  const optionLightingMode = aceternity3DGlobe?.lightingMode
  const optionPanX = aceternity3DGlobe?.panX
  const optionPanY = aceternity3DGlobe?.panY
  const optionShowTilt = aceternity3DGlobe?.showTilt
  const optionMarkerEnabled = aceternity3DGlobe?.markerEnabled
  const optionMarkerIcon = aceternity3DGlobe?.markerIcon
  const optionMarkerLabel = aceternity3DGlobe?.markerLabel
  const optionMarkerLat = aceternity3DGlobe?.markerLat
  const optionMarkerLng = aceternity3DGlobe?.markerLng
  const optionMarkerSize = aceternity3DGlobe?.markerSize
  const optionPointLightIntensity = aceternity3DGlobe?.pointLightIntensity
  const optionReverseSpin = aceternity3DGlobe?.reverseSpin
  const optionShowAtmosphere = aceternity3DGlobe?.showAtmosphere
  const optionShowWireframe = aceternity3DGlobe?.showWireframe
  const optionViewStyle = aceternity3DGlobe?.viewStyle
  const optionWireframeColor = aceternity3DGlobe?.wireframeColor
  const resolved = useMemo(() => resolveGlobeOptions({
    ambientIntensity: optionAmbientIntensity,
    atmosphereBlur: optionAtmosphereBlur,
    atmosphereColor: optionAtmosphereColor,
    atmosphereIntensity: optionAtmosphereIntensity,
    autoRotateSpeed: optionAutoRotateSpeed,
    backgroundColor: optionBackgroundColor,
    bumpScale: optionBumpScale,
    enablePan: optionEnablePan,
    globeColor: optionGlobeColor,
    globeScale: optionGlobeScale,
    graphicGlowColor: optionGraphicGlowColor,
    graphicMapColor: optionGraphicMapColor,
    graphicMapSamples: optionGraphicMapSamples,
    graphicMarkerColor: optionGraphicMarkerColor,
    lightingMode: optionLightingMode,
    panX: optionPanX,
    panY: optionPanY,
    showTilt: optionShowTilt,
    markerEnabled: optionMarkerEnabled,
    markerIcon: optionMarkerIcon,
    markerLabel: optionMarkerLabel,
    markerLat: optionMarkerLat,
    markerLng: optionMarkerLng,
    markerSize: optionMarkerSize,
    pointLightIntensity: optionPointLightIntensity,
    reverseSpin: optionReverseSpin,
    showAtmosphere: optionShowAtmosphere,
    showWireframe: optionShowWireframe,
    viewStyle: optionViewStyle,
    wireframeColor: optionWireframeColor,
  }), [
    optionAmbientIntensity,
    optionAtmosphereBlur,
    optionAtmosphereColor,
    optionAtmosphereIntensity,
    optionAutoRotateSpeed,
    optionBackgroundColor,
    optionBumpScale,
    optionEnablePan,
    optionGlobeColor,
    optionGlobeScale,
    optionGraphicGlowColor,
    optionGraphicMapColor,
    optionGraphicMapSamples,
    optionGraphicMarkerColor,
    optionLightingMode,
    optionPanX,
    optionPanY,
    optionShowTilt,
    optionMarkerEnabled,
    optionMarkerIcon,
    optionMarkerLabel,
    optionMarkerLat,
    optionMarkerLng,
    optionMarkerSize,
    optionPointLightIntensity,
    optionReverseSpin,
    optionShowAtmosphere,
    optionShowWireframe,
    optionViewStyle,
    optionWireframeColor,
  ])
  const style = {
    "--ml-aceternity-globe-background": resolved.backgroundColor,
  } as CSSProperties

  useEffect(() => {
    const globeCanvas = globeCanvasRef.current
    const markerCanvas = markerCanvasRef.current
    const container = containerRef.current
    const gl = globeCanvas?.getContext("webgl", {
      alpha: false,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    })
    const markerContext = markerCanvas?.getContext("2d")

    if (!globeCanvas || !markerCanvas || !container || !gl || !markerContext) {
      return undefined
    }

    const renderer = createGlobeRenderer(gl)
    if (!renderer) {
      return undefined
    }

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let pixelRatio = 1
    let canvasWidth = 0
    let canvasHeight = 0
    let lastPaint = 0
    const isGraphicMode = resolved.viewStyle === "graphic"
    let rotationDegrees = isGraphicMode ? -102 : 0
    let textureReady = false
    let bumpReady = false
    let massagelabMarkerReady = false
    let graphicMapPoints: GraphicMapPoint[] = []
    let paintFrame: (timestamp: number, animate: boolean) => void = () => undefined

    const earthTexture = new Image()
    earthTexture.crossOrigin = "anonymous"
    earthTexture.decoding = "async"
    earthTexture.onload = () => {
      renderer.uploadEarthTexture(earthTexture)
      textureReady = true
      paintFrame(performance.now(), shouldRun)
    }
    earthTexture.src = DEFAULT_EARTH_TEXTURE

    const bumpTexture = new Image()
    bumpTexture.crossOrigin = "anonymous"
    bumpTexture.decoding = "async"
    bumpTexture.onload = () => {
      renderer.uploadBumpTexture(bumpTexture)
      bumpReady = true
      paintFrame(performance.now(), shouldRun)
    }
    bumpTexture.src = DEFAULT_BUMP_TEXTURE

    const graphicMapMask = new Image()
    graphicMapMask.decoding = "async"
    graphicMapMask.onload = () => {
      if (isGraphicMode) {
        graphicMapPoints = createGraphicMapPoints(graphicMapMask, resolved.graphicMapSamples, "cobe")
        paintFrame(performance.now(), shouldRun)
      }
    }
    graphicMapMask.src = COBE_WORLD_MAP_MASK

    const massagelabMarkerImage = new Image()
    massagelabMarkerImage.decoding = "async"
    massagelabMarkerImage.onload = () => {
      massagelabMarkerReady = true
      paintFrame(performance.now(), shouldRun)
    }
    massagelabMarkerImage.src = MASSAGELAB_MARKER_ICON_SOURCE

    const backgroundRgb = parseHexColorToRgb(resolved.backgroundColor)
    const globeRgb = parseHexColorToRgb(resolved.globeColor)
    const atmosphereRgb = parseHexColorToRgb(resolved.atmosphereColor)
    const wireframeRgb = parseHexColorToRgb(resolved.wireframeColor)
    const graphicMapRgb = parseHexColorToRgb(resolved.graphicMapColor)
    const graphicGlowRgb = parseHexColorToRgb(resolved.graphicGlowColor)
    const graphicMarkerRgb = parseHexColorToRgb(resolved.graphicMarkerColor)
    const backgroundColor = rgbToUnit(backgroundRgb)
    const globeColor = rgbToUnit(globeRgb)
    const atmosphereColor = rgbToUnit(atmosphereRgb)
    const wireframeColor = rgbToUnit(wireframeRgb)
    const graphicMapColor = rgbToUnit(graphicMapRgb)
    const graphicGlowColor = rgbToUnit(graphicGlowRgb)

    paintFrame = (timestamp: number, animate: boolean) => {
      if (!canvasWidth || !canvasHeight) {
        return
      }

      const currentSunState = resolved.lightingMode === "sun" ? getSunState(new Date()) : null

      if (currentSunState) {
        rotationDegrees = normalizeDegrees(currentSunState.subsolarLongitude - FIXED_SUN_LONGITUDE_OFFSET_DEGREES)
      } else if (animate) {
        const deltaSeconds = lastPaint ? Math.min(0.08, (timestamp - lastPaint) / 1000) : 0
        const spinDirection = resolved.reverseSpin ? -1 : 1
        rotationDegrees = normalizeDegrees(rotationDegrees + deltaSeconds * resolved.autoRotateSpeed * 18 * spinDirection)
      }
      lastPaint = timestamp

      const width = canvasWidth
      const height = canvasHeight
      const radius = Math.min(width, height) * resolved.globeScale
      const centerX = width / 2 + (resolved.enablePan ? (resolved.panX / 100) * width : 0)
      const centerY = height / 2 + (resolved.enablePan ? (resolved.panY / 100) * height : 0)
      const tiltDegrees = getAxialTiltDegrees(resolved.showTilt, currentSunState)
      const centerLongitude = normalizeDegrees(rotationDegrees)
      const overlayCenterLongitude = isGraphicMode ? toGraphicMapLongitude(centerLongitude) : centerLongitude
      const lightVector = currentSunState
        ? getFixedSunLightVector(currentSunState)
        : normalizeViewVector({ x: -0.5, y: 0.42, z: 0.76 })
      const pointLightIntensity = resolved.pointLightIntensity
        * (currentSunState ? currentSunState.orbitLightMultiplier : 1)

      renderer.render({
        centerX,
        centerY,
        radius,
        centerLongitude,
        tiltDegrees,
        lightVector,
        textureReady,
        bumpReady,
        backgroundColor,
        globeColor,
        atmosphereColor,
        wireframeColor,
        graphicMode: isGraphicMode,
        graphicMapColor,
        graphicGlowColor,
        graphicMapSamples: isGraphicMode ? 0 : resolved.graphicMapSamples,
        ambientIntensity: resolved.ambientIntensity,
        pointLightIntensity,
        sunLighting: Boolean(currentSunState),
        bumpScale: resolved.bumpScale,
        showAtmosphere: resolved.showAtmosphere,
        atmosphereIntensity: resolved.atmosphereIntensity,
        atmosphereBlur: resolved.atmosphereBlur,
        showWireframe: resolved.showWireframe,
      })

      markerContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      markerContext.clearRect(0, 0, width, height)

      if (isGraphicMode && graphicMapPoints.length) {
        drawGraphicMapDots(markerContext, {
          points: graphicMapPoints,
          centerX,
          centerY,
          radius,
          centerLongitude: overlayCenterLongitude,
          tiltDegrees,
          lightVector,
          sunLighting: Boolean(currentSunState),
          graphicMapRgb,
        })
      }

      drawLocationMarker(markerContext, {
        centerX,
        centerY,
        radius,
        centerLongitude: overlayCenterLongitude,
        tiltDegrees,
        markerLat: MASSAGELAB_MARKER.latitude,
        markerLng: MASSAGELAB_MARKER.longitude,
        markerSize: MASSAGELAB_MARKER.markerSize,
        markerLabel: MASSAGELAB_MARKER.label,
        markerIcon: MASSAGELAB_MARKER.icon,
        markerImage: massagelabMarkerReady ? massagelabMarkerImage : null,
        atmosphereRgb,
        graphicMode: isGraphicMode,
        graphicMarkerRgb,
      })

      if (resolved.markerEnabled) {
        drawLocationMarker(markerContext, {
          centerX,
          centerY,
          radius,
          centerLongitude: overlayCenterLongitude,
          tiltDegrees,
          markerLat: resolved.markerLat,
          markerLng: resolved.markerLng,
          markerSize: resolved.markerSize,
          markerLabel: resolved.markerLabel,
          markerIcon: resolved.markerIcon,
          markerImage: null,
          atmosphereRgb,
          graphicMode: isGraphicMode,
          graphicMarkerRgb,
        })
      }
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
      const physicalWidth = Math.ceil(width * pixelRatio)
      const physicalHeight = Math.ceil(height * pixelRatio)
      globeCanvas.width = physicalWidth
      globeCanvas.height = physicalHeight
      markerCanvas.width = physicalWidth
      markerCanvas.height = physicalHeight
      renderer.resize(width, height, pixelRatio)
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
      if (!resizeCanvas()) {
        requestResizeRetry()
        return
      }
      animationFrame = window.requestAnimationFrame(draw)
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 720px)")

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      const hasMotion = resolved.lightingMode === "sun" || resolved.autoRotateSpeed > 0
      if (shouldAnimate && hasMotion) {
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
      earthTexture.onload = null
      bumpTexture.onload = null
      massagelabMarkerImage.onload = null
      renderer.dispose()
    }
  }, [resolved])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.aceternity3dGlobe, className)}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={globeCanvasRef} className={styles.aceternity3dGlobeCanvas} />
      <canvas ref={markerCanvasRef} className={styles.aceternity3dGlobeMarkerCanvas} />
    </div>
  )
}

function createGlobeRenderer(gl: WebGLRenderingContext) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, WEBGL_GLOBE_VERTEX_SHADER)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, WEBGL_GLOBE_FRAGMENT_SHADER)

  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  const positionLocation = gl.getAttribLocation(program, "a_position")
  const vertexBuffer = gl.createBuffer()
  const earthTexture = createGlobeTexture(gl)
  const bumpTexture = createGlobeTexture(gl)

  if (!vertexBuffer || !earthTexture || !bumpTexture) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.useProgram(program)
  gl.uniform1i(gl.getUniformLocation(program, "u_earthTexture"), 0)
  gl.uniform1i(gl.getUniformLocation(program, "u_bumpTexture"), 1)

  const uniforms = {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    center: gl.getUniformLocation(program, "u_center"),
    radius: gl.getUniformLocation(program, "u_radius"),
    centerLongitude: gl.getUniformLocation(program, "u_centerLongitude"),
    tilt: gl.getUniformLocation(program, "u_tilt"),
    backgroundColor: gl.getUniformLocation(program, "u_backgroundColor"),
    globeColor: gl.getUniformLocation(program, "u_globeColor"),
    atmosphereColor: gl.getUniformLocation(program, "u_atmosphereColor"),
    wireframeColor: gl.getUniformLocation(program, "u_wireframeColor"),
    graphicMapColor: gl.getUniformLocation(program, "u_graphicMapColor"),
    graphicGlowColor: gl.getUniformLocation(program, "u_graphicGlowColor"),
    lightDirection: gl.getUniformLocation(program, "u_lightDirection"),
    ambientIntensity: gl.getUniformLocation(program, "u_ambientIntensity"),
    pointLightIntensity: gl.getUniformLocation(program, "u_pointLightIntensity"),
    sunLighting: gl.getUniformLocation(program, "u_sunLighting"),
    graphicMode: gl.getUniformLocation(program, "u_graphicMode"),
    graphicMapSamples: gl.getUniformLocation(program, "u_graphicMapSamples"),
    bumpScale: gl.getUniformLocation(program, "u_bumpScale"),
    textureReady: gl.getUniformLocation(program, "u_textureReady"),
    bumpReady: gl.getUniformLocation(program, "u_bumpReady"),
    showAtmosphere: gl.getUniformLocation(program, "u_showAtmosphere"),
    atmosphereIntensity: gl.getUniformLocation(program, "u_atmosphereIntensity"),
    atmosphereBlur: gl.getUniformLocation(program, "u_atmosphereBlur"),
    showWireframe: gl.getUniformLocation(program, "u_showWireframe"),
  }
  let cssHeight = 0
  let pixelRatio = 1

  return {
    uploadEarthTexture(image: HTMLImageElement) {
      uploadGlobeTexture(gl, earthTexture, image)
    },
    uploadBumpTexture(image: HTMLImageElement) {
      uploadGlobeTexture(gl, bumpTexture, image)
    },
    resize(width: number, height: number, nextPixelRatio: number) {
      cssHeight = height
      pixelRatio = nextPixelRatio
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    },
    render(details: {
      centerX: number
      centerY: number
      radius: number
      centerLongitude: number
      tiltDegrees: number
      lightVector: ViewVector
      textureReady: boolean
      bumpReady: boolean
      backgroundColor: RgbColor
      globeColor: RgbColor
      atmosphereColor: RgbColor
      wireframeColor: RgbColor
      graphicMode: boolean
      graphicMapColor: RgbColor
      graphicGlowColor: RgbColor
      graphicMapSamples: number
      ambientIntensity: number
      pointLightIntensity: number
      sunLighting: boolean
      bumpScale: number
      showAtmosphere: boolean
      atmosphereIntensity: number
      atmosphereBlur: number
      showWireframe: boolean
    }) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, earthTexture)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, bumpTexture)
      gl.uniform2f(uniforms.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight)
      gl.uniform2f(uniforms.center, details.centerX * pixelRatio, (cssHeight - details.centerY) * pixelRatio)
      gl.uniform1f(uniforms.radius, details.radius * pixelRatio)
      gl.uniform1f(uniforms.centerLongitude, degreesToRadians(details.centerLongitude))
      gl.uniform1f(uniforms.tilt, degreesToRadians(details.tiltDegrees))
      gl.uniform3f(uniforms.backgroundColor, ...details.backgroundColor)
      gl.uniform3f(uniforms.globeColor, ...details.globeColor)
      gl.uniform3f(uniforms.atmosphereColor, ...details.atmosphereColor)
      gl.uniform3f(uniforms.wireframeColor, ...details.wireframeColor)
      gl.uniform3f(uniforms.graphicMapColor, ...details.graphicMapColor)
      gl.uniform3f(uniforms.graphicGlowColor, ...details.graphicGlowColor)
      gl.uniform3f(uniforms.lightDirection, details.lightVector.x, details.lightVector.y, details.lightVector.z)
      gl.uniform1f(uniforms.ambientIntensity, details.ambientIntensity)
      gl.uniform1f(uniforms.pointLightIntensity, details.pointLightIntensity)
      gl.uniform1f(uniforms.sunLighting, details.sunLighting ? 1 : 0)
      gl.uniform1f(uniforms.graphicMode, details.graphicMode ? 1 : 0)
      gl.uniform1f(uniforms.graphicMapSamples, details.graphicMapSamples)
      gl.uniform1f(uniforms.bumpScale, details.bumpScale)
      gl.uniform1f(uniforms.textureReady, details.textureReady ? 1 : 0)
      gl.uniform1f(uniforms.bumpReady, details.bumpReady ? 1 : 0)
      gl.uniform1f(uniforms.showAtmosphere, details.showAtmosphere ? 1 : 0)
      gl.uniform1f(uniforms.atmosphereIntensity, details.atmosphereIntensity)
      gl.uniform1f(uniforms.atmosphereBlur, details.atmosphereBlur)
      gl.uniform1f(uniforms.showWireframe, details.showWireframe ? 1 : 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    dispose() {
      gl.deleteTexture(earthTexture)
      gl.deleteTexture(bumpTexture)
      gl.deleteBuffer(vertexBuffer)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteProgram(program)
    },
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    return null
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createGlobeTexture(gl: WebGLRenderingContext) {
  const texture = gl.createTexture()
  if (!texture) {
    return null
  }

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([18, 32, 51, 255]),
  )
  return texture
}

function uploadGlobeTexture(gl: WebGLRenderingContext, texture: WebGLTexture, image: HTMLImageElement) {
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
}

function createGraphicMapPoints(image: HTMLImageElement, sampleCount: number, source: "earth" | "cobe" = "earth"): GraphicMapPoint[] {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const canvas = document.createElement("canvas")
  const width = Math.min(720, sourceWidth)
  const height = Math.max(1, Math.round((width / Math.max(1, sourceWidth)) * sourceHeight))
  const context = canvas.getContext("2d", { willReadFrequently: true })

  if (!context || !width || !height) {
    return []
  }

  canvas.width = width
  canvas.height = height
  context.drawImage(image, 0, 0, width, height)

  let pixels: Uint8ClampedArray
  try {
    pixels = context.getImageData(0, 0, width, height).data
  } catch {
    return []
  }

  const densityBudget = Math.max(1000, Math.min(10000, Math.round(sampleCount)))
  const points: GraphicMapPoint[] = []

  // Match Cobe's density-driven sphere sampling: the slider sets sample density, not an exact dot count.
  for (let index = 0; index < densityBudget; index += 1) {
    const yUnit = 1 - (index + 0.5) * 2 / densityBudget
    const radiusAtY = Math.sqrt(Math.max(0, 1 - yUnit * yUnit))
    const angle = index * GRAPHIC_FIBONACCI_GOLDEN_ANGLE
    const xUnit = Math.cos(angle) * radiusAtY
    const zUnit = Math.sin(angle) * radiusAtY
    const latitude = radiansToDegrees(Math.asin(yUnit))
    const longitude = radiansToDegrees(Math.atan2(xUnit, zUnit))
    const textureLongitudeUnit = source === "cobe"
      ? positiveModulo(Math.atan2(zUnit, -xUnit) / (Math.PI * 2), 1)
      : (longitude + 180) / 360
    const textureX = Math.max(0, Math.min(width - 1, Math.floor(textureLongitudeUnit * width)))
    const textureY = Math.max(0, Math.min(height - 1, Math.floor((0.5 - latitude / 180) * height)))
    const brightness = getGraphicLandBrightnessAt(pixels, width, height, textureX, textureY, source)

    if (brightness <= 0.08) {
      continue
    }

    points.push({
      latitude,
      longitude,
      brightness,
    })
  }

  return points
}

function drawGraphicMapDots(
  context: CanvasRenderingContext2D,
  details: {
    points: GraphicMapPoint[]
    centerX: number
    centerY: number
    radius: number
    centerLongitude: number
    tiltDegrees: number
    lightVector: ViewVector
    sunLighting: boolean
    graphicMapRgb: RgbColor
  },
) {
  const {
    points,
    centerX,
    centerY,
    radius,
    centerLongitude,
    tiltDegrees,
    lightVector,
    sunLighting,
    graphicMapRgb,
  } = details
  const dotRadius = Math.max(0.75, Math.min(1.85, radius / 390))
  const bucketCount = 6
  const paths = Array.from({ length: bucketCount }, () => new Path2D())
  const usedBuckets = new Set<number>()

  for (const point of points) {
    const vector = latLngToViewVector(point.latitude, point.longitude, centerLongitude, tiltDegrees)

    if (vector.z < -0.04) {
      continue
    }

    const x = centerX + vector.x * radius
    const y = centerY - vector.y * radius
    const limbFade = smoothstepNumber(-0.04, 0.28, vector.z)
    const facingFade = smoothstepNumber(-0.02, 0.64, vector.z)
    const daylight = sunLighting ? smoothstepNumber(-0.035, 0.035, dotViewVectors(vector, lightVector)) : 0.92
    const opacity = limbFade * facingFade * (sunLighting ? 0.1 + daylight * 0.82 : 0.82) * (0.74 + point.brightness * 0.26)

    if (opacity < 0.04) {
      continue
    }

    const bucket = Math.max(0, Math.min(bucketCount - 1, Math.floor(opacity * bucketCount)))
    const path = paths[bucket]
    path.moveTo(x + dotRadius, y)
    path.arc(x, y, dotRadius, 0, Math.PI * 2)
    usedBuckets.add(bucket)
  }

  if (!usedBuckets.size) {
    return
  }

  context.save()
  context.fillStyle = rgba(graphicMapRgb, 1)
  for (const bucket of usedBuckets) {
    context.globalAlpha = Math.min(0.94, (bucket + 1) / bucketCount)
    context.fill(paths[bucket])
  }
  context.restore()
}

function getGraphicLandBrightnessAt(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  source: "earth" | "cobe",
) {
  const center = source === "cobe"
    ? getGraphicMaskBrightness(pixels, (y * width + x) * 4)
    : getGraphicLandBrightness(pixels, (y * width + x) * 4)

  if (source === "cobe") {
    return center
  }

  if (center >= 0.28) {
    return center
  }

  let brightness = center
  const offsets = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
    [-2, -2],
    [2, -2],
    [-2, 2],
    [2, 2],
  ]

  for (const [offsetX, offsetY] of offsets) {
    const sampleX = Math.max(0, Math.min(width - 1, x + offsetX))
    const sampleY = Math.max(0, Math.min(height - 1, y + offsetY))
    const sample = getGraphicLandBrightness(pixels, (sampleY * width + sampleX) * 4)
    brightness = Math.max(brightness, sample * 0.94)
  }

  return brightness
}

function getGraphicMaskBrightness(pixels: Uint8ClampedArray, index: number) {
  const red = pixels[index] / 255
  const green = pixels[index + 1] / 255
  const blue = pixels[index + 2] / 255
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114

  return luminance > 0.48 ? 1 : 0
}

function getGraphicLandBrightness(pixels: Uint8ClampedArray, index: number) {
  const red = pixels[index] / 255
  const green = pixels[index + 1] / 255
  const blue = pixels[index + 2] / 255
  const landSignal = Math.max(green - blue * 0.58, red - blue * 0.34)

  return smoothstepNumber(0.02, 0.2, landSignal) * (0.78 + Math.max(red, green, blue) * 0.22)
}

function dotViewVectors(first: ViewVector, second: ViewVector) {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function smoothstepNumber(edge0: number, edge1: number, value: number) {
  const unit = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return unit * unit * (3 - 2 * unit)
}

function drawLocationMarker(
  context: CanvasRenderingContext2D,
  details: {
    centerX: number
    centerY: number
    radius: number
    centerLongitude: number
    tiltDegrees: number
    markerLat: number
    markerLng: number
    markerSize: number
    markerLabel: string
    markerIcon: RenderedMarkerIcon
    markerImage: HTMLImageElement | null
    atmosphereRgb: RgbColor
    graphicMode: boolean
    graphicMarkerRgb: RgbColor
  },
) {
  const {
    centerX,
    centerY,
    radius,
    centerLongitude,
    tiltDegrees,
    markerLat,
    markerLng,
    markerSize,
    markerLabel,
    markerIcon,
    markerImage,
    atmosphereRgb,
    graphicMode,
    graphicMarkerRgb,
  } = details
  const markerPosition = projectLatLngToGlobe(
    markerLat,
    markerLng,
    centerLongitude,
    tiltDegrees,
    centerX,
    centerY,
    radius,
    graphicMode,
  )
  const surfaceX = markerPosition.x
  const surfaceY = markerPosition.y
  const surfaceZ = markerPosition.z

  if (graphicMode) {
    drawGraphicLocationMarker(context, {
      surfaceX,
      surfaceY,
      surfaceZ,
      radius,
      markerSize,
      graphicMarkerRgb,
    })
    return
  }

  if (surfaceZ < -0.08) {
    return
  }

  const visibility = Math.min(1, Math.max(0, (surfaceZ + 0.08) / 0.35))
  const iconRadius = Math.max(15, Math.min(58, radius * markerSize * 1.65))
  const iconX = surfaceX
  const iconY = surfaceY - iconRadius * 1.5
  const label = markerLabel.trim()

  context.save()
  context.globalAlpha = visibility
  context.strokeStyle = rgba([255, 255, 255], 0.72)
  context.lineWidth = 1
  context.shadowBlur = 0
  context.beginPath()
  context.moveTo(surfaceX, surfaceY)
  context.lineTo(iconX, iconY + iconRadius)
  context.stroke()

  context.shadowColor = rgba(atmosphereRgb, 0.35)
  context.shadowBlur = iconRadius * 0.25
  context.fillStyle = rgba([2, 6, 23], 0.74)
  context.strokeStyle = rgba([255, 255, 255], 0.9)
  context.lineWidth = Math.max(2, iconRadius * 0.1)
  context.beginPath()
  context.arc(iconX, iconY, iconRadius, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  drawMarkerIcon(context, markerIcon, iconX, iconY, iconRadius * 0.82, atmosphereRgb, markerImage)

  context.shadowBlur = 0
  context.fillStyle = markerIcon === "massagelab" ? "rgba(255, 122, 26, 0.98)" : rgba([255, 255, 255], 0.98)
  context.beginPath()
  context.arc(surfaceX, surfaceY, Math.max(3, iconRadius * 0.16), 0, Math.PI * 2)
  context.fill()

  if (label) {
    context.font = `700 ${Math.max(11, Math.min(15, iconRadius * 0.36))}px system-ui, sans-serif`
    const labelWidth = Math.min(180, context.measureText(label).width + 18)
    const labelHeight = Math.max(22, iconRadius * 0.48)
    const labelY = iconY + iconRadius + labelHeight * 0.74
    context.fillStyle = rgba([2, 6, 23], 0.72)
    roundRect(context, iconX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight, labelHeight / 2)
    context.fill()
    context.fillStyle = "rgba(255, 255, 255, 0.92)"
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(label, iconX, labelY)
  }

  context.restore()
}

function drawGraphicLocationMarker(
  context: CanvasRenderingContext2D,
  details: {
    surfaceX: number
    surfaceY: number
    surfaceZ: number
    radius: number
    markerSize: number
    graphicMarkerRgb: RgbColor
  },
) {
  const { surfaceX, surfaceY, surfaceZ, radius, markerSize, graphicMarkerRgb } = details

  if (surfaceZ < -0.04) {
    return
  }

  const visibility = Math.min(1, Math.max(0, (surfaceZ + 0.04) / 0.22))
  const dotRadius = Math.max(1.7, Math.min(5.2, radius * markerSize * 0.26))

  context.save()
  context.globalAlpha = visibility
  context.shadowColor = rgba(graphicMarkerRgb, 0.9)
  context.shadowBlur = dotRadius * 2
  context.fillStyle = rgba(graphicMarkerRgb, 0.88)
  context.beginPath()
  context.arc(surfaceX, surfaceY, dotRadius, 0, Math.PI * 2)
  context.fill()
  context.shadowBlur = 0
  context.fillStyle = rgba([255, 255, 255], 0.68)
  context.beginPath()
  context.arc(surfaceX - dotRadius * 0.25, surfaceY - dotRadius * 0.25, dotRadius * 0.28, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function drawMarkerIcon(
  context: CanvasRenderingContext2D,
  icon: RenderedMarkerIcon,
  x: number,
  y: number,
  radius: number,
  atmosphereRgb: RgbColor,
  markerImage: HTMLImageElement | null,
) {
  const gradient = context.createLinearGradient(x - radius, y - radius, x + radius, y + radius)
  if (icon === "massagelab") {
    gradient.addColorStop(0, "rgba(255, 194, 111, 1)")
    gradient.addColorStop(1, "rgba(255, 122, 26, 1)")
  } else {
    gradient.addColorStop(0, rgba(atmosphereRgb, 1))
    gradient.addColorStop(1, "rgba(255, 122, 26, 1)")
  }

  context.save()
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.clip()
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  if (icon === "massagelab" && markerImage) {
    context.drawImage(markerImage, x - radius, y - radius, radius * 2, radius * 2)
    context.restore()
    return
  }
  context.strokeStyle = "rgba(255, 255, 255, 0.94)"
  context.fillStyle = "rgba(255, 255, 255, 0.94)"
  context.lineWidth = Math.max(2, radius * 0.11)
  context.lineCap = "round"
  context.lineJoin = "round"

  if (icon === "massagelab") {
    context.font = `800 italic ${Math.max(14, radius * 0.9)}px system-ui, sans-serif`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText("m", x, y + radius * 0.08)
    context.restore()
    return
  }

  if (icon === "person") {
    context.beginPath()
    context.arc(x, y - radius * 0.28, radius * 0.22, 0, Math.PI * 2)
    context.fill()
    context.beginPath()
    context.arc(x, y + radius * 0.52, radius * 0.42, Math.PI, 0)
    context.stroke()
    context.restore()
    return
  }

  if (icon === "heart") {
    context.beginPath()
    context.moveTo(x, y + radius * 0.42)
    context.bezierCurveTo(x - radius * 0.9, y - radius * 0.1, x - radius * 0.54, y - radius * 0.72, x, y - radius * 0.34)
    context.bezierCurveTo(x + radius * 0.54, y - radius * 0.72, x + radius * 0.9, y - radius * 0.1, x, y + radius * 0.42)
    context.fill()
    context.restore()
    return
  }

  if (icon === "star") {
    drawStar(context, x, y, radius * 0.58, radius * 0.25)
    context.fill()
    context.restore()
    return
  }

  if (icon === "home") {
    context.beginPath()
    context.moveTo(x - radius * 0.55, y - radius * 0.02)
    context.lineTo(x, y - radius * 0.48)
    context.lineTo(x + radius * 0.55, y - radius * 0.02)
    context.moveTo(x - radius * 0.38, y)
    context.lineTo(x - radius * 0.38, y + radius * 0.45)
    context.lineTo(x + radius * 0.38, y + radius * 0.45)
    context.lineTo(x + radius * 0.38, y)
    context.stroke()
    context.restore()
    return
  }

  context.beginPath()
  context.moveTo(x, y - radius * 0.58)
  context.bezierCurveTo(x - radius * 0.42, y - radius * 0.58, x - radius * 0.68, y - radius * 0.28, x - radius * 0.68, y + radius * 0.08)
  context.bezierCurveTo(x - radius * 0.68, y + radius * 0.44, x, y + radius * 0.7, x, y + radius * 0.7)
  context.bezierCurveTo(x, y + radius * 0.7, x + radius * 0.68, y + radius * 0.44, x + radius * 0.68, y + radius * 0.08)
  context.bezierCurveTo(x + radius * 0.68, y - radius * 0.28, x + radius * 0.42, y - radius * 0.58, x, y - radius * 0.58)
  context.stroke()
  context.beginPath()
  context.arc(x, y + radius * 0.02, radius * 0.18, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, outerRadius: number, innerRadius: number) {
  context.beginPath()
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const pointX = x + Math.cos(angle) * radius
    const pointY = y + Math.sin(angle) * radius
    if (index === 0) {
      context.moveTo(pointX, pointY)
    } else {
      context.lineTo(pointX, pointY)
    }
  }
  context.closePath()
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
}

function projectLatLngToGlobe(
  latitude: number,
  longitude: number,
  centerLongitude: number,
  tiltDegrees: number,
  centerX: number,
  centerY: number,
  radius: number,
  useGraphicMapSpace = false,
) {
  const projectedLongitude = useGraphicMapSpace ? toGraphicMapLongitude(longitude) : longitude
  const vector = latLngToViewVector(latitude, projectedLongitude, centerLongitude, tiltDegrees)
  return {
    x: centerX + vector.x * radius,
    y: centerY - vector.y * radius,
    z: vector.z,
  }
}

function toGraphicMapLongitude(longitude: number) {
  // Cobe's embedded mask is sampled with a quarter-turn texture offset; markers need the same map space.
  return normalizeDegrees(longitude + 90)
}

function latLngToViewVector(latitude: number, longitude: number, centerLongitude: number, tiltDegrees: number): ViewVector {
  const latRad = degreesToRadians(latitude)
  const lngRad = degreesToRadians(normalizeDegrees(longitude - centerLongitude))
  const cosLat = Math.cos(latRad)
  const baseVector = {
    x: cosLat * Math.sin(lngRad),
    y: Math.sin(latRad),
    z: cosLat * Math.cos(lngRad),
  }
  const tiltRad = degreesToRadians(tiltDegrees)

  return normalizeViewVector({
    x: baseVector.x * Math.cos(tiltRad) - baseVector.y * Math.sin(tiltRad),
    y: baseVector.x * Math.sin(tiltRad) + baseVector.y * Math.cos(tiltRad),
    z: baseVector.z,
  })
}

function normalizeViewVector(vector: ViewVector): ViewVector {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z) || 1
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  }
}

function getSunState(date: Date) {
  const year = date.getUTCFullYear()
  const dayOfYear = Math.max(
    1,
    Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(year, 0, 0)) / 86400000),
  )
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const declination = -23.44 * Math.cos(((dayOfYear + 10) / 365) * Math.PI * 2)
  const meanAnomaly = ((dayOfYear - 3) / 365.25) * Math.PI * 2
  const distanceAu = 1.00014 - 0.01671 * Math.cos(meanAnomaly) - 0.00014 * Math.cos(meanAnomaly * 2)

  return {
    subsolarLatitude: declination,
    subsolarLongitude: normalizeDegrees((12 - utcHours) * 15),
    orbitLightMultiplier: 1 / Math.max(0.92, distanceAu * distanceAu),
  }
}

function getAxialTiltDegrees(showTilt: boolean, sunState: ReturnType<typeof getSunState> | null) {
  if (!showTilt) {
    return 0
  }

  // With the sun fixed off the left edge, axial tilt should lean across the screen instead of toward the viewer.
  if (!sunState) {
    return EARTH_AXIAL_TILT_DEGREES
  }

  return sunState.subsolarLatitude >= 0 ? EARTH_AXIAL_TILT_DEGREES : -EARTH_AXIAL_TILT_DEGREES
}

function getFixedSunLightVector(sunState: ReturnType<typeof getSunState>) {
  return normalizeViewVector({
    x: FIXED_SUN_LIGHT_VECTOR.x,
    y: FIXED_SUN_LIGHT_VECTOR.y + Math.sin(degreesToRadians(sunState.subsolarLatitude)) * 0.24,
    z: FIXED_SUN_LIGHT_VECTOR.z,
  })
}

function normalizeDegrees(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toUpperCase() : fallback
}

function normalizeOptionalShortText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback
  }

  return value.trim().slice(0, maxLength)
}

function normalizeMarkerIcon(value: unknown, fallback: GlobeMarkerIcon): GlobeMarkerIcon {
  return value === "pin" || value === "person" || value === "heart" || value === "star" || value === "home"
    ? value
    : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function rgbToUnit([red, green, blue]: RgbColor): RgbColor {
  return [red / 255, green / 255, blue / 255]
}

function rgba([red, green, blue]: RgbColor, alpha: number) {
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`
}
