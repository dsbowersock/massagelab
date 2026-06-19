type AtmosphereStationArtworkProps = {
  description: string
  groupId: string
  stationId: string
  title: string
}

type ArtworkPalette = {
  background: string
  foreground: string
  accent: string
  muted: string
  line: string
}

const palettes: ArtworkPalette[] = [
  { background: "#102a25", foreground: "#f28a19", accent: "#e7c06d", muted: "#6f8f78", line: "#f5d99c" },
  { background: "#1a1c18", foreground: "#d67822", accent: "#f0c36e", muted: "#9ebf91", line: "#ecd9ae" },
  { background: "#203129", foreground: "#e0832f", accent: "#d7e7b3", muted: "#51786f", line: "#f3d8a8" },
  { background: "#301a14", foreground: "#f19949", accent: "#e5d0a3", muted: "#7e4d38", line: "#f6d7a5" },
  { background: "#17242a", foreground: "#d98620", accent: "#8fd0ba", muted: "#35676f", line: "#ead7a8" },
]

/**
 * Renders deterministic, MassageLab-owned placeholder station artwork.
 *
 * The shapes intentionally stay SVG-native instead of generated files so every
 * station has a unique organic-geometric thumbnail without copied assets or a
 * large checked-in image set.
 */
export function AtmosphereStationArtwork({
  description,
  groupId,
  stationId,
  title,
}: AtmosphereStationArtworkProps) {
  const seed = hashString(`${stationId}:${title}:${groupId}`)
  const palette = palettes[seed % palettes.length]
  const motif = chooseMotif(`${title} ${description} ${groupId}`.toLowerCase(), seed)
  const idPrefix = `station-art-${stationId.replace(/[^a-z0-9-]/gi, "-")}`

  return (
    <svg
      aria-label={`${title} station artwork`}
      className="h-full w-full rounded-[9px]"
      role="img"
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${idPrefix}-shade`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.background} />
          <stop offset="100%" stopColor={shadeHex(palette.background, -16)} />
        </linearGradient>
        <clipPath id={`${idPrefix}-clip`}>
          <rect height="240" rx="10" width="240" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idPrefix}-clip)`}>
        <rect fill={`url(#${idPrefix}-shade)`} height="240" width="240" />
        {renderMotif(motif, palette, seed)}
        <rect fill="none" height="218" opacity="0.5" stroke={palette.line} strokeWidth="1.5" width="218" x="11" y="11" />
      </g>
    </svg>
  )
}

/**
 * Chooses the organic-geometric artwork motif for a station.
 *
 * @param text Lowercase station title, description, and group text used for sound/feel keyword matching.
 * @param seed Stable station hash used only when no keyword rule matches.
 * @returns One of the motif ids supported by `renderMotif`; keyword matches win before the seeded fallback.
 */
function chooseMotif(text: string, seed: number) {
  if (/bell|glock|mallet|piano|key|little/.test(text)) return "honeycomb"
  if (/wave|water|rain|ocean|lullaby|beneath/.test(text)) return "moon-waves"
  if (/drone|string|cinematic|soundtrack|enough/.test(text)) return "rings"
  if (/tree|nature|animal|field|forest|spring/.test(text)) return "seed-lines"
  if (/moment|neuro|ritual|impact|awash|otherness/.test(text)) return "spiral"
  return ["sunrise", "moon-waves", "spiral", "rings", "seed-lines", "honeycomb"][seed % 6]
}

function renderMotif(motif: string, palette: ArtworkPalette, seed: number) {
  if (motif === "honeycomb") return <HoneycombMotif palette={palette} seed={seed} />
  if (motif === "moon-waves") return <MoonWavesMotif palette={palette} seed={seed} />
  if (motif === "rings") return <RingsMotif palette={palette} seed={seed} />
  if (motif === "seed-lines") return <SeedLinesMotif palette={palette} seed={seed} />
  if (motif === "spiral") return <SpiralMotif palette={palette} seed={seed} />
  return <SunriseMotif palette={palette} seed={seed} />
}

function HoneycombMotif({ palette, seed }: { palette: ArtworkPalette; seed: number }) {
  const cells = []
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const x = 34 + column * 38 + (row % 2) * 19
      const y = 38 + row * 32
      const active = (row + column + seed) % 4 === 0
      cells.push(
        <polygon
          fill={active ? palette.foreground : "transparent"}
          key={`${row}-${column}`}
          opacity={active ? "0.55" : "1"}
          points={hexagonPoints(x, y, 20)}
          stroke={active ? palette.accent : palette.line}
          strokeWidth={active ? "1" : "2"}
        />,
      )
    }
  }

  return (
    <g>
      <path d="M13 194C56 176 91 208 129 190C166 173 189 146 227 162" fill="none" opacity="0.36" stroke={palette.muted} strokeWidth="28" />
      {cells}
      <circle cx="178" cy="61" fill={palette.accent} opacity="0.85" r="11" />
    </g>
  )
}

function MoonWavesMotif({ palette, seed }: { palette: ArtworkPalette; seed: number }) {
  const moonX = 142 + (seed % 35)
  return (
    <g>
      <circle cx={moonX} cy="58" fill={palette.accent} r="26" />
      <circle cx={moonX + 12} cy="50" fill={palette.background} r="26" />
      {[0, 1, 2, 3, 4].map((index) => (
        <path
          d={`M-18 ${124 + index * 22}C34 ${92 + index * 8} 75 ${150 + index * 4} 123 ${116 + index * 16}C167 ${84 + index * 12} 200 ${124 + index * 8} 258 ${94 + index * 14}`}
          fill="none"
          key={index}
          opacity={0.95 - index * 0.12}
          stroke={index % 2 === 0 ? palette.line : palette.muted}
          strokeLinecap="round"
          strokeWidth={index === 0 ? "3" : "2"}
        />
      ))}
      <circle cx="43" cy="45" fill={palette.foreground} opacity="0.75" r="3" />
    </g>
  )
}

function RingsMotif({ palette, seed }: { palette: ArtworkPalette; seed: number }) {
  const centerX = 118 + (seed % 19) - 9
  const centerY = 112 + (seed % 27) - 13
  return (
    <g>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <circle
          cx={centerX}
          cy={centerY}
          fill={index === 0 ? palette.foreground : "none"}
          key={index}
          opacity={index === 0 ? "0.82" : `${0.82 - index * 0.08}`}
          r={18 + index * 18}
          stroke={index === 0 ? "none" : palette.line}
          strokeWidth="2"
        />
      ))}
      <path d="M12 185C58 145 103 223 150 181C190 146 202 121 229 137" fill="none" opacity="0.5" stroke={palette.muted} strokeWidth="24" />
    </g>
  )
}

function SeedLinesMotif({ palette, seed }: { palette: ArtworkPalette; seed: number }) {
  return (
    <g>
      {[0, 1, 2, 3, 4, 5, 6].map((index) => {
        const x = 42 + index * 27
        const lean = ((seed + index) % 3 - 1) * 10
        return (
          <g key={index}>
            <path d={`M${x} 222C${x + lean} 177 ${x - lean} 126 ${x + lean} 58`} fill="none" opacity="0.72" stroke={palette.line} strokeWidth="2" />
            <ellipse cx={x + lean} cy={84 + (index % 3) * 28} fill={index % 2 ? palette.muted : palette.foreground} opacity="0.74" rx="6" ry="15" transform={`rotate(${lean * 2} ${x + lean} ${84 + (index % 3) * 28})`} />
          </g>
        )
      })}
      <circle cx="190" cy="55" fill={palette.accent} opacity="0.85" r="8" />
    </g>
  )
}

function SpiralMotif({ palette, seed }: { palette: ArtworkPalette; seed: number }) {
  const dots = []
  for (let index = 0; index < 70; index += 1) {
    const angle = index * 0.44 + (seed % 11) * 0.05
    const radius = 4 + index * 1.25
    const x = 120 + Math.cos(angle) * radius
    const y = 120 + Math.sin(angle) * radius
    dots.push(
      <circle
        cx={x.toFixed(2)}
        cy={y.toFixed(2)}
        fill={index % 6 === 0 ? palette.foreground : palette.line}
        key={index}
        opacity={0.95 - index * 0.006}
        r={index % 6 === 0 ? "3.4" : "2.2"}
      />,
    )
  }

  return (
    <g>
      <rect fill={palette.foreground} height="72" opacity="0.22" transform="rotate(18 178 49)" width="120" x="118" y="20" />
      {dots}
    </g>
  )
}

function SunriseMotif({ palette, seed }: { palette: ArtworkPalette; seed: number }) {
  const sunX = 90 + (seed % 70)
  return (
    <g>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <path
          d={`M-18 ${176 + index * 11}C45 ${130 + index * 12} 87 ${198 - index * 9} 141 ${150 + index * 7}C184 ${111 + index * 6} 213 ${145 + index * 8} 260 ${121 + index * 9}`}
          fill="none"
          key={index}
          opacity={0.78 - index * 0.08}
          stroke={index % 2 ? palette.muted : palette.line}
          strokeLinecap="round"
          strokeWidth={index === 0 ? "22" : "2"}
        />
      ))}
      <circle cx={sunX} cy="83" fill={palette.foreground} r="34" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <path
          d={`M${sunX} 83L${sunX + Math.cos(index * Math.PI / 4) * 95} ${83 + Math.sin(index * Math.PI / 4) * 95}`}
          key={index}
          opacity="0.34"
          stroke={palette.accent}
          strokeWidth="1.5"
        />
      ))}
    </g>
  )
}

function hexagonPoints(cx: number, cy: number, radius: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index + Math.PI / 6
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`
  }).join(" ")
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

/**
 * Adjusts a six-digit hex color by the same channel offset.
 *
 * @param hex Color string in `#rrggbb` or `rrggbb` form.
 * @param amount Signed channel offset; positive lightens and negative darkens.
 * @returns A clamped `#rrggbb` color string.
 */
function shadeHex(hex: string, amount: number) {
  const normalized = hex.replace("#", "")
  const value = Number.parseInt(normalized, 16)
  const red = clampColor((value >> 16) + amount)
  const green = clampColor(((value >> 8) & 0xff) + amount)
  const blue = clampColor((value & 0xff) + amount)
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Clamps a color channel to the CSS RGB byte range.
 *
 * @param value Raw channel value after shade adjustment.
 * @returns An integer-compatible number between 0 and 255.
 */
function clampColor(value: number) {
  return Math.max(0, Math.min(255, value))
}
