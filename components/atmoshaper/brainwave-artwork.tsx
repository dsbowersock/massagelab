type BrainwaveArtworkProps = {
  kind: "binaural" | "isochronic"
}

/** Static decorative waveform art; card headings retain accessible naming. */
export function BrainwaveArtwork({ kind }: BrainwaveArtworkProps) {
  const gradientId = `atmoshaper-${kind}-art-gradient`

  return (
    <svg
      aria-hidden="true"
      className="ml-atmoshaper-brainwave-artwork"
      data-brainwave-kind={kind}
      focusable="false"
      viewBox="0 0 520 220"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1b322b" />
          <stop offset="0.52" stopColor="#2d2142" />
          <stop offset="1" stopColor="#4d2419" />
        </linearGradient>
      </defs>
      <rect width="520" height="220" rx="20" fill={`url(#${gradientId})`} />
      <path d="M24 110 H496" stroke="#f1d19c" strokeOpacity="0.2" />
      {kind === "binaural" ? (
        <>
          <path
            data-wave-channel="left"
            d="M24 92 C44 35 66 35 86 92 S128 149 148 92 S190 35 210 92 S252 149 272 92 S314 35 334 92 S376 149 396 92 S438 35 458 92 S482 130 496 104"
            fill="none"
            stroke="#f0a04b"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            data-wave-channel="right"
            d="M24 129 C49 74 76 74 101 129 S153 184 178 129 S230 74 255 129 S307 184 332 129 S384 74 409 129 S461 184 496 112"
            fill="none"
            stroke="#b998ff"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </>
      ) : (
        <>
          <path
            data-pulse-envelope="true"
            d="M24 154 L52 154 L61 76 L70 154 L112 154 L124 52 L136 154 L178 154 L187 91 L196 154 L238 154 L250 42 L262 154 L304 154 L313 82 L322 154 L364 154 L376 58 L388 154 L430 154 L439 94 L448 154 L496 154"
            fill="none"
            stroke="#f0a04b"
            strokeLinejoin="round"
            strokeWidth="6"
          />
          <path d="M24 162 C83 188 139 179 197 165 S311 144 372 163 S453 184 496 162" fill="none" stroke="#b998ff" strokeOpacity="0.66" strokeWidth="3" />
        </>
      )}
      <rect x="10" y="10" width="500" height="200" rx="14" fill="none" stroke="#f1d19c" strokeOpacity="0.28" />
    </svg>
  )
}
