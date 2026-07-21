"use client"

import { useEffect, useId, useState } from "react"
import { Heart, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetalFavoriteIconProps {
  kind: "heart" | "star"
  selected: boolean
  className?: string
}

/**
 * Traces a selected favorite glyph with a compact chromatic-metal gradient.
 * The SVG stroke follows the icon path itself; it intentionally does not add
 * another ring around the surrounding Glow button.
 */
export function MetalFavoriteIcon({ kind, selected, className }: MetalFavoriteIconProps) {
  const gradientId = `favorite-metal-${useId().replaceAll(":", "")}`
  const Icon = kind === "heart" ? Heart : Star
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return (
    <Icon
      aria-hidden="true"
      className={cn(selected && "drop-shadow-[0_0_4px_rgba(174,120,255,0.9)]", className)}
      data-metal-icon-trace={selected ? "true" : undefined}
      fill={selected ? "hsl(var(--button-cta-face))" : "none"}
      stroke={selected ? `url(#${gradientId})` : "currentColor"}
      strokeWidth={selected ? 2.8 : 2}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
          gradientUnits="objectBoundingBox"
          spreadMethod="reflect"
        >
          <stop offset="0%" stopColor="#f7f8ff" />
          <stop offset="28%" stopColor="#9b79ff" />
          <stop offset="58%" stopColor="#ff9a55" />
          <stop offset="82%" stopColor="#6f55d9" />
          <stop offset="100%" stopColor="#ffffff" />
          {selected && !reducedMotion ? (
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 0.5 0.5"
              to="360 0.5 0.5"
              dur="2.6s"
              repeatCount="indefinite"
            />
          ) : null}
        </linearGradient>
      </defs>
    </Icon>
  )
}
