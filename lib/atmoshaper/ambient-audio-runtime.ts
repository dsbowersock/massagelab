import { Gain } from "tone/build/esm/core/context/Gain"
import type { InputNode } from "tone/build/esm/core/context/ToneAudioNode"

import { rampSeconds } from "./audio-parameters.js"
import type { AtmoShaperAudioLayerHandle } from "./generated-audio-runtime"
import {
  getAtmoShaperProductionConcept,
  type AtmoShaperProductionConcept,
  type AtmoShaperProductionSource,
} from "./production-catalog-runtime"
import { selectAtmoShaperProductionAudioUrl } from "./production-catalog.js"
import type { AtmoShaperLayer } from "./recipe.js"
import { createSignatureSoundPreviewPlayer } from "./signature-sound-preview-player.js"

type PreviewPlayer = ReturnType<typeof createSignatureSoundPreviewPlayer>

/**
 * Streams one reviewed production concept through an isolated layer gain. The
 * development scheduler remains the single owner of the approved sequence,
 * cadence, region, lane, and crossfade semantics; only its output binding is
 * replaced with the production AtmoShaper graph.
 */
export async function createAmbientAtmoShaperAdapter({
  destination,
  layer: initialLayer,
}: {
  destination: InputNode
  layer: AtmoShaperLayer
}): Promise<AtmoShaperAudioLayerHandle> {
  if (initialLayer.kind !== "ambient") throw new Error("AtmoShaper ambient adapter needs an ambient layer")
  const concept = getAtmoShaperProductionConcept(initialLayer.sourceId)
  const output = new Gain(0)
  output.connect(destination)
  let layer = initialLayer
  let paused = true
  let disposed = false
  let engine = await startConceptEngine({ concept, layer, output })

  function targetVolume() {
    return paused || layer.muted ? 0 : Math.min(1, Math.max(0, layer.volume))
  }

  function rampOutput(seconds = transitionSeconds(layer)) {
    output.gain.rampTo(targetVolume(), seconds)
  }

  return {
    async fadeIn() {
      if (disposed) return
      paused = false
      rampOutput()
    },
    async update(nextLayer) {
      if (disposed) return
      if (nextLayer.kind !== "ambient" || nextLayer.sourceId !== layer.sourceId) {
        throw new Error("AtmoShaper ambient source cannot change in place")
      }
      const priorSelectedSource = selectedSourceId(concept, layer)
      const nextSelectedSource = selectedSourceId(concept, nextLayer)
      layer = nextLayer
      if (priorSelectedSource !== nextSelectedSource) {
        engine.stop()
        engine = await startConceptEngine({ concept, layer, output })
      }
      rampOutput()
    },
    async pause() {
      if (disposed) return
      paused = true
      rampOutput()
    },
    async resume() {
      if (disposed) return
      paused = false
      rampOutput()
    },
    async fadeOutAndDispose() {
      if (disposed) return
      disposed = true
      paused = true
      const seconds = transitionSeconds(layer)
      rampOutput(seconds)
      try {
        await waitForRamp(seconds)
      } finally {
        engine.stop()
        output.dispose()
      }
    },
  }
}

async function startConceptEngine({
  concept,
  layer,
  output,
}: {
  concept: AtmoShaperProductionConcept
  layer: AtmoShaperLayer
  output: Gain
}) {
  if (concept.playbackMode?.kind === "prebaked-intro-loop") {
    return startPrebakedLoop(concept, output)
  }
  const rawContext = requireRealtimeAudioContext(output)
  const capabilityProbe = document.createElement("audio")
  const player: PreviewPlayer = createSignatureSoundPreviewPlayer({
    createAudio(url: string) {
      const audio = new Audio(url)
      audio.preload = "auto"
      audio.crossOrigin = "anonymous"
      return audio
    },
    resolveAudioUrl(source: AtmoShaperProductionSource) {
      return selectAtmoShaperProductionAudioUrl(source, (contentType) => (
        capabilityProbe.canPlayType(contentType)
      ))
    },
    createVoiceOutput(audio: HTMLAudioElement, gainDb: number) {
      const sourceNode = rawContext.createMediaElementSource(audio)
      const gainNode = rawContext.createGain()
      gainNode.gain.value = 10 ** (gainDb / 20)
      sourceNode.connect(gainNode)
      gainNode.connect(output.input)
      return {
        resume: () => rawContext.resume(),
        disconnect() {
          sourceNode.disconnect()
          gainNode.disconnect()
        },
      }
    },
  })
  const selectedId = selectedSourceId(concept, layer)
  await player.start({
    groupId: concept.groupId,
    strategyId: concept.playbackConfiguration.strategyId,
    previewSettings: concept.playbackConfiguration.previewSettings,
    constructionPolicy: concept.playbackConfiguration.constructionPolicy,
    sources: selectedId
      ? concept.sources.filter(({ sourceId }) => sourceId === selectedId)
      : concept.sources,
    runtimePolicy: concept.runtimePolicy,
  })
  return { stop: () => player.stop() }
}

/** Keeps the processed one-time opening outside the repeated artifact region. */
async function startPrebakedLoop(concept: AtmoShaperProductionConcept, output: Gain) {
  const source = concept.sources[0]
  if (!source || concept.sources.length !== 1 || concept.playbackMode?.kind !== "prebaked-intro-loop") {
    throw new Error("AtmoShaper processed loop needs exactly one artifact")
  }
  const probe = document.createElement("audio")
  const url = selectAtmoShaperProductionAudioUrl(source, (contentType) => probe.canPlayType(contentType))
  const response = await fetch(url)
  if (!response.ok) throw new Error("AtmoShaper processed loop could not be loaded")
  const rawContext = requireRealtimeAudioContext(output)
  if (rawContext.state !== "running") await rawContext.resume()
  const buffer = await rawContext.decodeAudioData(await response.arrayBuffer())
  const loopStart = concept.playbackMode.artifactLoopStartSeconds
  if (loopStart <= 0 || loopStart >= buffer.duration) {
    throw new Error("AtmoShaper processed loop timing does not fit its artifact")
  }
  const bufferSource = rawContext.createBufferSource()
  bufferSource.buffer = buffer
  bufferSource.loop = true
  bufferSource.loopStart = loopStart
  bufferSource.loopEnd = buffer.duration
  bufferSource.connect(output.input)
  bufferSource.start()
  return {
    stop() {
      try { bufferSource.stop() } catch { /* The source may already be stopped. */ }
      bufferSource.disconnect()
    },
  }
}

function selectedSourceId(concept: AtmoShaperProductionConcept, layer: AtmoShaperLayer) {
  if (concept.sourceSelection?.kind !== "single-source-loop") return null
  const selected = typeof layer.settings.selectedSourceId === "string"
    ? layer.settings.selectedSourceId
    : concept.sourceSelection.defaultSourceId
  if (!concept.sources.some(({ sourceId }) => sourceId === selected)) {
    throw new Error(`AtmoShaper selected source is outside ${concept.label}`)
  }
  return selected
}

function transitionSeconds(layer: AtmoShaperLayer) {
  const requested = layer.settings.rampSeconds
  return rampSeconds(typeof requested === "number" && Number.isFinite(requested) ? requested : undefined)
}

function waitForRamp(seconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, Math.max(0, seconds) * 1000))
}

/** Production streaming requires the realtime context created by the browser. */
function requireRealtimeAudioContext(output: Gain): AudioContext {
  const rawContext = output.context.rawContext
  if (!("createMediaElementSource" in rawContext)) {
    throw new Error("AtmoShaper ambient audio needs a realtime browser audio context")
  }
  return rawContext
}
