type NoiseArtworkProps = {
  color: "white" | "pink" | "brown"
}

const palettes = {
  white: {
    base: "#777a76",
    tint: "#b9bab5",
    shadow: "#2f322f",
    wave: "#f2f1ec",
    waveOpacity: "0.9",
    frequency: "0.92",
    textureOpacity: "0.92",
  },
  pink: {
    base: "#4a2730",
    tint: "#f2a0b8",
    shadow: "#1f1017",
    wave: "#f2a0b8",
    waveOpacity: "0.42",
    frequency: "0.46",
    textureOpacity: "0.72",
  },
  brown: {
    base: "#3a2318",
    tint: "#c47c49",
    shadow: "#150d08",
    wave: "#c47c49",
    waveOpacity: "0.42",
    frequency: "0.58",
    textureOpacity: "0.72",
  },
} as const

/** Decorative procedural texture; the surrounding card owns the source name. */
export function NoiseArtwork({ color }: NoiseArtworkProps) {
  const palette = palettes[color]
  const filterId = `atmoshaper-${color}-noise-texture`
  const gradientId = `atmoshaper-${color}-noise-gradient`

  return (
    <svg
      aria-hidden="true"
      className="ml-atmoshaper-noise-artwork"
      data-noise-color={color}
      focusable="false"
      viewBox="0 0 320 190"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={palette.tint} />
          <stop offset="0.58" stopColor={palette.base} />
          <stop offset="1" stopColor={palette.shadow} />
        </linearGradient>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            baseFrequency={palette.frequency}
            numOctaves="4"
            seed={color === "white" ? "17" : color === "pink" ? "29" : "41"}
            stitchTiles="stitch"
            type="fractalNoise"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0.08 0.46" />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="320" height="190" rx="18" fill={`url(#${gradientId})`} />
      <rect width="320" height="190" rx="18" filter={`url(#${filterId})`} opacity={palette.textureOpacity} />
      <path d="M22 150 C72 115 112 166 163 127 S252 74 298 105" fill="none" stroke={palette.wave} strokeOpacity={palette.waveOpacity} strokeWidth="2" />
      <rect x="9" y="9" width="302" height="172" rx="12" fill="none" stroke={palette.tint} strokeOpacity="0.38" />
    </svg>
  )
}
