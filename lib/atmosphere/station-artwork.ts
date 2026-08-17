import { ATMOSPHERE_STATION_GROUP_DEFINITIONS } from "./station-groups.js"

export type AtmosphereStationArtworkInput = {
  description: string
  groupId: string
  stationId: string
  title: string
}

export type AtmosphereStationArtworkSize = 256 | 512

/**
 * Bump only when platform artwork publication must invalidate Media Session
 * caches; inline canonical SVG identity never depends on this token.
 */
export const ATMOSPHERE_MEDIA_SESSION_ARTWORK_REVISION = "2026-08-16-1"

type AtmosphereStationArtworkSource = {
  description?: unknown
  groupId?: unknown
  id?: unknown
  stationId?: unknown
  title?: unknown
}

export type ArtworkPalette = {
  background: string
  foreground: string
  accent: string
  muted: string
  line: string
}

export type ArtworkMotif = "honeycomb" | "moon-waves" | "rings" | "seed-lines" | "spiral" | "sunrise"

const palettes: ArtworkPalette[] = [
  { background: "#102a25", foreground: "#f28a19", accent: "#e7c06d", muted: "#6f8f78", line: "#f5d99c" },
  { background: "#1a1c18", foreground: "#d67822", accent: "#f0c36e", muted: "#9ebf91", line: "#ecd9ae" },
  { background: "#203129", foreground: "#e0832f", accent: "#d7e7b3", muted: "#51786f", line: "#f3d8a8" },
  { background: "#301a14", foreground: "#f19949", accent: "#e5d0a3", muted: "#7e4d38", line: "#f6d7a5" },
  { background: "#17242a", foreground: "#d98620", accent: "#8fd0ba", muted: "#35676f", line: "#ead7a8" },
]

/** Returns the deterministic motif, palette, and seed for one station identity. */
export function getAtmosphereStationArtworkModel(input: AtmosphereStationArtworkInput): {
  motif: ArtworkMotif
  palette: ArtworkPalette
  seed: number
} {
  const seed = hashString(`${input.stationId}:${input.title}:${input.groupId}`)
  return {
    motif: chooseMotif(`${input.title} ${input.description} ${input.groupId}`.toLowerCase(), seed),
    palette: palettes[seed % palettes.length],
    seed,
  }
}

/**
 * Resolves catalog and runtime station shapes to the one canonical artwork
 * input, keeping group fallback and validation out of presentation adapters.
 */
export function resolveAtmosphereStationArtworkInput(
  source: AtmosphereStationArtworkSource,
  groupId?: string,
): AtmosphereStationArtworkInput | null {
  const stationId = nonEmptyString(source.stationId) ?? nonEmptyString(source.id)
  const title = nonEmptyString(source.title)
  const description = nonEmptyString(source.description)
  if (!stationId || !title || !description) return null

  const resolvedGroupId = nonEmptyString(groupId)
    ?? nonEmptyString(source.groupId)
    ?? ATMOSPHERE_STATION_GROUP_DEFINITIONS.find((group) => group.stationIds.includes(stationId))?.id
    ?? "more-stations"

  return { description, groupId: resolvedGroupId, stationId, title }
}

/** Serializes the canonical station image with stable element ordering. */
export function renderAtmosphereStationArtworkSvg(input: AtmosphereStationArtworkInput): string {
  const { motif, palette, seed } = getAtmosphereStationArtworkModel(input)
  const idPrefix = escapeXml(`station-art-${input.stationId.replace(/[^a-z0-9-]/gi, "-")}`)
  const shadeId = `${idPrefix}-shade`
  const clipId = `${idPrefix}-clip`

  return `<svg xmlns="http://www.w3.org/2000/svg" height="240" viewBox="0 0 240 240" width="240"><defs><linearGradient id="${shadeId}" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${palette.background}"/><stop offset="100%" stop-color="${shadeHex(palette.background, -16)}"/></linearGradient><clipPath id="${clipId}"><rect height="240" rx="10" width="240"/></clipPath></defs><g clip-path="url(#${clipId})"><rect fill="url(#${shadeId})" height="240" width="240"/>${renderMotifSvg(motif, palette, seed)}${renderSeedSignature(palette, seed)}<rect fill="none" height="218" opacity="0.5" stroke="${palette.line}" stroke-width="1.5" width="218" x="11" y="11"/></g></svg>`
}

/** Returns a revisioned, honest same-origin PNG endpoint for one allowlisted output size. */
export function getAtmosphereStationArtworkUrl(
  stationId: string,
  size: AtmosphereStationArtworkSize,
): string {
  return `/api/atmosphere/stations/${encodeURIComponent(stationId)}/artwork?size=${size}&v=${encodeURIComponent(ATMOSPHERE_MEDIA_SESSION_ARTWORK_REVISION)}`
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function chooseMotif(text: string, seed: number): ArtworkMotif {
  if (/bell|glock|mallet|piano|key|little/.test(text)) return "honeycomb"
  if (/wave|water|rain|ocean|lullaby|beneath/.test(text)) return "moon-waves"
  if (/drone|string|cinematic|soundtrack|enough/.test(text)) return "rings"
  if (/tree|nature|animal|field|forest|spring/.test(text)) return "seed-lines"
  if (/moment|neuro|ritual|impact|awash|otherness/.test(text)) return "spiral"
  const fallbackMotifs: ArtworkMotif[] = [
    "sunrise",
    "moon-waves",
    "spiral",
    "rings",
    "seed-lines",
    "honeycomb",
  ]
  return fallbackMotifs[seed % fallbackMotifs.length]
}

function renderMotifSvg(motif: ArtworkMotif, palette: ArtworkPalette, seed: number): string {
  if (motif === "honeycomb") return renderHoneycombMotif(palette, seed)
  if (motif === "moon-waves") return renderMoonWavesMotif(palette, seed)
  if (motif === "rings") return renderRingsMotif(palette, seed)
  if (motif === "seed-lines") return renderSeedLinesMotif(palette, seed)
  if (motif === "spiral") return renderSpiralMotif(palette, seed)
  return renderSunriseMotif(palette, seed)
}

function renderHoneycombMotif(palette: ArtworkPalette, seed: number): string {
  const cells: string[] = []
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const x = 34 + column * 38 + (row % 2) * 19
      const y = 38 + row * 32
      const active = (row + column + seed) % 4 === 0
      cells.push(`<polygon fill="${active ? palette.foreground : "transparent"}" opacity="${active ? "0.55" : "1"}" points="${hexagonPoints(x, y, 20)}" stroke="${active ? palette.accent : palette.line}" stroke-width="${active ? "1" : "2"}"/>`)
    }
  }
  return `<g><path d="M13 194C56 176 91 208 129 190C166 173 189 146 227 162" fill="none" opacity="0.36" stroke="${palette.muted}" stroke-width="28"/>${cells.join("")}<circle cx="178" cy="61" fill="${palette.accent}" opacity="0.85" r="11"/></g>`
}

function renderMoonWavesMotif(palette: ArtworkPalette, seed: number): string {
  const moonX = 142 + (seed % 35)
  const waves = [0, 1, 2, 3, 4].map((index) => (`<path d="M-18 ${124 + index * 22}C34 ${92 + index * 8} 75 ${150 + index * 4} 123 ${116 + index * 16}C167 ${84 + index * 12} 200 ${124 + index * 8} 258 ${94 + index * 14}" fill="none" opacity="${0.95 - index * 0.12}" stroke="${index % 2 === 0 ? palette.line : palette.muted}" stroke-linecap="round" stroke-width="${index === 0 ? "3" : "2"}"/>`)).join("")
  return `<g><circle cx="${moonX}" cy="58" fill="${palette.accent}" r="26"/><circle cx="${moonX + 12}" cy="50" fill="${palette.background}" r="26"/>${waves}<circle cx="43" cy="45" fill="${palette.foreground}" opacity="0.75" r="3"/></g>`
}

function renderRingsMotif(palette: ArtworkPalette, seed: number): string {
  const centerX = 118 + (seed % 19) - 9
  const centerY = 112 + (seed % 27) - 13
  const rings = [0, 1, 2, 3, 4, 5].map((index) => (`<circle cx="${centerX}" cy="${centerY}" fill="${index === 0 ? palette.foreground : "none"}" opacity="${index === 0 ? "0.82" : `${0.82 - index * 0.08}`}" r="${18 + index * 18}" stroke="${index === 0 ? "none" : palette.line}" stroke-width="2"/>`)).join("")
  return `<g>${rings}<path d="M12 185C58 145 103 223 150 181C190 146 202 121 229 137" fill="none" opacity="0.5" stroke="${palette.muted}" stroke-width="24"/></g>`
}

function renderSeedLinesMotif(palette: ArtworkPalette, seed: number): string {
  const lines = [0, 1, 2, 3, 4, 5, 6].map((index) => {
    const x = 42 + index * 27
    const lean = ((seed + index) % 3 - 1) * 10
    const leafY = 84 + (index % 3) * 28
    return `<g><path d="M${x} 222C${x + lean} 177 ${x - lean} 126 ${x + lean} 58" fill="none" opacity="0.72" stroke="${palette.line}" stroke-width="2"/><ellipse cx="${x + lean}" cy="${leafY}" fill="${index % 2 ? palette.muted : palette.foreground}" opacity="0.74" rx="6" ry="15" transform="rotate(${lean * 2} ${x + lean} ${leafY})"/></g>`
  }).join("")
  return `<g>${lines}<circle cx="190" cy="55" fill="${palette.accent}" opacity="0.85" r="8"/></g>`
}

function renderSpiralMotif(palette: ArtworkPalette, seed: number): string {
  const dots: string[] = []
  for (let index = 0; index < 70; index += 1) {
    const angle = index * 0.44 + (seed % 11) * 0.05
    const radius = 4 + index * 1.25
    const x = 120 + Math.cos(angle) * radius
    const y = 120 + Math.sin(angle) * radius
    dots.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" fill="${index % 6 === 0 ? palette.foreground : palette.line}" opacity="${0.95 - index * 0.006}" r="${index % 6 === 0 ? "3.4" : "2.2"}"/>`)
  }
  return `<g><rect fill="${palette.foreground}" height="72" opacity="0.22" transform="rotate(18 178 49)" width="120" x="118" y="20"/>${dots.join("")}</g>`
}

function renderSunriseMotif(palette: ArtworkPalette, seed: number): string {
  const sunX = 90 + (seed % 70)
  const waves = [0, 1, 2, 3, 4, 5].map((index) => (`<path d="M-18 ${176 + index * 11}C45 ${130 + index * 12} 87 ${198 - index * 9} 141 ${150 + index * 7}C184 ${111 + index * 6} 213 ${145 + index * 8} 260 ${121 + index * 9}" fill="none" opacity="${0.78 - index * 0.08}" stroke="${index % 2 ? palette.muted : palette.line}" stroke-linecap="round" stroke-width="${index === 0 ? "22" : "2"}"/>`)).join("")
  const rays = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => (`<path d="M${sunX} 83L${sunX + Math.cos(index * Math.PI / 4) * 95} ${83 + Math.sin(index * Math.PI / 4) * 95}" opacity="0.34" stroke="${palette.accent}" stroke-width="1.5"/>`)).join("")
  return `<g>${waves}<circle cx="${sunX}" cy="83" fill="${palette.foreground}" r="34"/>${rays}</g>`
}

/**
 * Encodes all four seed bytes as a restrained cluster of accent points so
 * stations with a shared palette and motif still retain distinct geometry.
 */
function renderSeedSignature(palette: ArtworkPalette, seed: number): string {
  return [0, 8, 16, 24].map((shift) => {
    const byte = (seed >>> shift) & 0xff
    const x = 16 + (byte % 16) * 2
    const y = 190 + Math.floor(byte / 16) * 2
    return `<rect fill="${palette.accent}" height="1.5" opacity="0.55" width="1.5" x="${x}" y="${y}"/>`
  }).join("")
}

function hexagonPoints(cx: number, cy: number, radius: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index + Math.PI / 6
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`
  }).join(" ")
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function shadeHex(hex: string, amount: number): string {
  const normalized = hex.replace("#", "")
  const value = Number.parseInt(normalized, 16)
  const red = clampColor((value >> 16) + amount)
  const green = clampColor(((value >> 8) & 0xff) + amount)
  const blue = clampColor((value & 0xff) + amount)
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, value))
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character)
}
