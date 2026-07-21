/**
 * Recolors the shared Glow material with existing CTA-purple tokens while
 * retaining Button-owned geometry, focus, hover, press, and reduced motion.
 */
export const purpleGlowClassName = [
  "[--brand-orange:var(--button-cta-face)]",
  "[--brand-orange-glow:var(--button-cta-face-bright)]",
  "[--button-orange-start:var(--button-cta-face-bright)]",
  "[--button-orange-depth:var(--button-cta-face-depth)]",
  "[--button-orange-edge:var(--button-cta-corner)]",
].join(" ")
