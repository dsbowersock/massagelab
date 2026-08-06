export interface CanvasRevealDotMotionInput {
  phase: number
  speed: number
  timeSeconds: number
  animate: boolean
}

export interface CanvasRevealDotMotion {
  alphaMultiplier: number
}

/**
 * Resolves one anchored dot's passive twinkle. Seeded per-dot phase and speed
 * keep the source-like field evenly distributed instead of creating a sweep,
 * while the wider opacity range remains legible at phone scale. Reduced motion
 * returns the authored steady-state multiplier.
 */
export function resolveCanvasRevealDotTwinkle({
  phase,
  speed,
  timeSeconds,
  animate,
}: CanvasRevealDotMotionInput): CanvasRevealDotMotion {
  if (!animate) {
    return { alphaMultiplier: 1 }
  }

  const pulse = (Math.sin(timeSeconds * speed * 1.55 + phase) + 1) / 2

  return {
    alphaMultiplier: 0.65 + pulse * pulse * 0.8,
  }
}
