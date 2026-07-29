import type {
  BackgroundPaletteAdapter,
  BackgroundRendererFamily,
} from "./backgroundPaletteRegistry.ts"
import type { BackgroundEffectProps } from "./effects/css-backgrounds"

export type BackgroundHostLoadStatus = "loading" | "loaded" | "error"

export interface BackgroundHostDiagnosticSnapshot {
  requestedId: string
  loadedId: string | null
  status: "loading" | "loaded" | "unsupported" | "error"
  rendererFamily: BackgroundRendererFamily
  resolvedRendererTargets: Readonly<Record<string, unknown>>
  applicationChanged: boolean
  fallback: boolean
  reducedMotion: boolean
  error: string | null
}

interface BackgroundHostDiagnosticInput {
  requestedId: string
  loadedId: string | null
  loadStatus: BackgroundHostLoadStatus
  adapter: BackgroundPaletteAdapter
  baseEffectProps: BackgroundEffectProps
  appliedEffectProps: BackgroundEffectProps
  reducedMotion: boolean
  error: string | null
}

function rendererPathSegments(path: string) {
  return [...path.matchAll(/([^[.\]]+)|\[(\d+)\]/g)].map((match) => (
    match[2] === undefined ? match[1] : Number(match[2])
  ))
}

/**
 * Reads the exact nested prop path named by an adapter. Diagnostics consume
 * the post-adapter object passed to the renderer, never gallery metadata.
 */
export function readBackgroundRendererTarget(
  props: BackgroundEffectProps,
  target: string,
) {
  let value: unknown = props
  for (const segment of rendererPathSegments(target)) {
    if (!value || typeof value !== "object") {
      return undefined
    }
    value = (value as Record<string | number, unknown>)[segment]
  }
  return value
}

/**
 * Builds an opt-in development snapshot from the Host's actual load state and
 * post-adapter renderer props. A stale async component can never masquerade as
 * the requested renderer.
 */
export function createBackgroundHostDiagnosticSnapshot({
  requestedId,
  loadedId,
  loadStatus,
  adapter,
  baseEffectProps,
  appliedEffectProps,
  reducedMotion,
  error,
}: BackgroundHostDiagnosticInput): BackgroundHostDiagnosticSnapshot {
  const staleLoad = loadStatus === "loaded" && loadedId !== requestedId
  const targetPaths = adapter.status === "supported"
    ? [...new Set([
        ...adapter.roles.map((role) => role.rendererTarget),
        ...(adapter.modeOverrides ?? []).map((override) => override.rendererTarget),
      ])]
    : []
  const resolvedRendererTargets = Object.fromEntries(
    targetPaths.map((target) => [
      target,
      readBackgroundRendererTarget(appliedEffectProps, target),
    ]),
  )
  const changedTargets = targetPaths.filter((target) => (
    JSON.stringify(readBackgroundRendererTarget(baseEffectProps, target))
    !== JSON.stringify(resolvedRendererTargets[target])
  ))
  const resolvedError = staleLoad
    ? `Stale renderer loaded for ${loadedId ?? "unknown"} while ${requestedId} was requested.`
    : error
  const status = staleLoad || loadStatus === "error"
    ? "error"
    : loadStatus === "loading"
      ? "loading"
      : adapter.status === "unsupported"
        ? "unsupported"
        : "loaded"

  return {
    requestedId,
    loadedId,
    status,
    rendererFamily: adapter.rendererFamily,
    resolvedRendererTargets,
    applicationChanged: adapter.status === "supported" && changedTargets.length > 0,
    fallback: loadStatus !== "loaded" || staleLoad,
    reducedMotion,
    error: resolvedError,
  }
}
