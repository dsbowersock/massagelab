import type { BackgroundEffectProps } from "./effects/css-backgrounds"

export type BackgroundRendererPathSegment = string | number

/**
 * Parses the adapter-owned dotted/indexed paths shared by palette application
 * and renderer diagnostics.
 */
export function parseBackgroundRendererPath(
  path: string,
): BackgroundRendererPathSegment[] {
  return [...path.matchAll(/([^[.\]]+)|\[(\d+)\]/g)].map((match) => (
    match[2] === undefined ? match[1] : Number(match[2])
  ))
}

/** Reads one adapter-owned renderer path without changing its source object. */
export function readBackgroundRendererTarget(
  props: BackgroundEffectProps,
  target: string,
) {
  let value: unknown = props
  for (const segment of parseBackgroundRendererPath(target)) {
    if (!value || typeof value !== "object") {
      return undefined
    }
    value = (value as Record<string | number, unknown>)[segment]
  }
  return value
}
