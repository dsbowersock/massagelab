import { Volume } from "tone/build/esm/component/channel/Volume"
import { start } from "tone/build/esm/core/Global"
import type { InputNode } from "tone/build/esm/core/context/ToneAudioNode"

import { startGenerativeFmPiece } from "../atmosphere/generative-fm-runtime"
import { getAtmosphereStationById } from "../atmosphere/stations.js"
import { startToneProofDrone } from "../atmosphere/tone-proof-runtime"
import {
  createGeneratedAtmoShaperAdapter,
  type AtmoShaperAudioLayerHandle,
} from "./generated-audio-runtime"
import { createAmbientAtmoShaperAdapter } from "./ambient-audio-runtime"
import { createAtmoShaperMixController } from "./mix-controller.js"
import { rampSeconds } from "./audio-parameters.js"
import type { AtmoShaperLayer, AtmoShaperRecipe } from "./recipe.js"

type StationPlaybackHandle = (() => void) & {
  dispose(): Promise<void>
  setVolume(nextVolume: number, seconds?: number): void
}

type AtmoShaperLayerState = {
  status: "loading" | "playing" | "paused" | "failed"
  error?: string
}

type AtmoShaperPreviewState = AtmoShaperLayerState & {
  layer: AtmoShaperLayer
}

export type AtmoShaperRuntimeSnapshot = {
  status: string
  recipe: AtmoShaperRecipe | null
  layers: Record<string, AtmoShaperLayerState>
  activeLayers: Record<string, AtmoShaperLayer>
  preview: AtmoShaperPreviewState | null
}

/**
 * Lazily creates the one master output and all source-specific mixer adapters.
 * Approved ambient concepts and generated sources share the same private
 * master output and recoverable per-layer adapter boundary.
 */
export async function createAtmoShaperRuntime({
  initialMasterVolume,
  onSnapshot,
}: {
  initialMasterVolume: number
  onSnapshot: (snapshot: AtmoShaperRuntimeSnapshot) => void
}) {
  if (typeof window === "undefined") {
    throw new Error("AtmoShaper audio can only start in the browser.")
  }

  await start()
  const injectBrowserQaFailure = process.env.NEXT_PUBLIC_ATMOSHAPER_BROWSER_QA === "1"
    ? (await import("@/lib/atmoshaper/browser-qa")).injectAtmoShaperBrowserQaFailure
    : () => undefined
  const master = new Volume(volumeToDecibels(initialMasterVolume)).toDestination()

  /** Keeps committed layers and ephemeral previews on the same master output and adapter boundary. */
  function createAdapter(
    layer: AtmoShaperLayer,
    isCurrent: () => boolean,
    reportFailure: (error: unknown) => void,
  ) {
    injectBrowserQaFailure(layer)
    if (layer.kind === "noise" || layer.kind === "binaural" || layer.kind === "isochronic") {
      return createGeneratedAtmoShaperAdapter({ layer, destination: master })
    }
    if (layer.kind === "station") {
      return createStationFoundationAdapter({ layer, destination: master, isCurrent })
    }
    if (layer.kind === "ambient") {
      return createAmbientAtmoShaperAdapter({ layer, destination: master, reportFailure })
    }
    throw new Error(`Unsupported AtmoShaper layer kind: ${layer.kind}`)
  }

  const controller = createAtmoShaperMixController({
    onSnapshot(snapshot) {
      onSnapshot(snapshot as AtmoShaperRuntimeSnapshot)
    },
    createAdapter,
  })

  return {
    ...controller,
    setMasterVolume(volume: number) {
      master.volume.rampTo(volumeToDecibels(volume), rampSeconds())
    },
    async dispose() {
      await controller.dispose()
      master.dispose()
    },
  }
}

/** Adapts one catalog station without pausing its private generator schedule. */
async function createStationFoundationAdapter({
  destination,
  isCurrent,
  layer: initialLayer,
}: {
  destination: InputNode
  isCurrent: () => boolean
  layer: AtmoShaperLayer
}): Promise<AtmoShaperAudioLayerHandle> {
  const station = getAtmosphereStationById(initialLayer.sourceId)
  if (!station.enabled) {
    throw new Error(`Atmosphere station is unavailable: ${station.id}`)
  }

  const adapterId = station.runtime?.adapterId
  let playback: StationPlaybackHandle
  if (adapterId === "tone-proof-drone") {
    playback = await startToneProofDrone({
      ...(station.runtime?.defaultOptions ?? {}),
      destination,
      isCurrent,
      volume: 0,
    })
  } else if (adapterId === "generative-fm-piece") {
    playback = await startGenerativeFmPiece({ station, destination, volume: 0, isCurrent })
  } else {
    throw new Error(`Unsupported Atmosphere station adapter: ${String(adapterId)}`)
  }

  let layer = initialLayer
  let paused = true
  let disposed = false

  function targetVolume() {
    return paused || layer.muted ? 0 : Math.min(1, Math.max(0, layer.volume))
  }

  function rampPrivateOutput() {
    playback.setVolume(targetVolume(), rampSeconds())
  }

  return {
    async fadeIn() {
      if (disposed) return
      paused = false
      rampPrivateOutput()
    },
    async update(nextLayer) {
      if (disposed) return
      if (nextLayer.sourceId !== layer.sourceId) {
        throw new Error("AtmoShaper station source cannot change in place")
      }
      layer = nextLayer
      rampPrivateOutput()
    },
    async pause() {
      if (disposed) return
      paused = true
      rampPrivateOutput()
    },
    async resume() {
      if (disposed) return
      paused = false
      rampPrivateOutput()
    },
    async fadeOutAndDispose() {
      if (disposed) return
      disposed = true
      await playback.dispose()
    },
  }
}

/** Maps the public 0..1 control onto the conservative Atmosphere output range. */
function volumeToDecibels(volume: number) {
  const clampedVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.75))
  return -60 + clampedVolume * 48
}
