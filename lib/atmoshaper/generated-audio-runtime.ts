import { Panner } from "tone/build/esm/component/channel/Panner"
import { Gain } from "tone/build/esm/core/context/Gain"
import type { InputNode } from "tone/build/esm/core/context/ToneAudioNode"
import { Noise } from "tone/build/esm/source/Noise"
import { LFO } from "tone/build/esm/source/oscillator/LFO"
import { Oscillator } from "tone/build/esm/source/oscillator/Oscillator"

import { AtmoShaperNodeScope, withAtmoShaperNodeScope } from "./audio-node-scope.js"
import { binauralChannelFrequencies, rampSeconds } from "./audio-parameters.js"
import type { AtmoShaperLayer } from "./recipe.js"

export type AtmoShaperAudioLayer = AtmoShaperLayer

export type AtmoShaperAudioLayerHandle = {
  fadeIn(): Promise<void>
  update(layer: AtmoShaperLayer): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  fadeOutAndDispose(): Promise<void>
}

type GeneratedSourceGraph = {
  updateParameters(layer: AtmoShaperAudioLayer, seconds: number): void
}

/**
 * Creates one self-owned generated graph whose output feeds the shared mixer.
 * Parameter state survives pause; terminal disposal waits for the final ramp.
 */
export function createGeneratedAtmoShaperAdapter({
  destination,
  layer: initialLayer,
}: {
  destination: InputNode
  layer: AtmoShaperAudioLayer
}): AtmoShaperAudioLayerHandle {
  const { value: { graph, output }, disposeAll } = withAtmoShaperNodeScope((nodeScope) => {
    const output = nodeScope.track(new Gain(0))
    output.connect(destination)
    return { graph: createSourceGraph(initialLayer, output, nodeScope), output }
  })
  let layer = initialLayer
  let paused = true
  let disposing: Promise<void> | null = null

  function transitionSeconds(nextLayer = layer) {
    const requested = nextLayer.settings?.rampSeconds
    return rampSeconds(typeof requested === "number" && Number.isFinite(requested) ? requested : undefined)
  }

  function targetVolume() {
    if (paused || layer.muted) return 0
    return Math.min(1, Math.max(0, layer.volume))
  }

  function rampOutput(seconds = transitionSeconds()) {
    output.gain.rampTo(targetVolume(), seconds)
  }

  return {
    async fadeIn() {
      if (disposing) return
      paused = false
      rampOutput()
    },
    async update(nextLayer) {
      if (disposing) return
      if (nextLayer.kind !== layer.kind) {
        throw new Error("AtmoShaper generated layer kind cannot change in place")
      }
      layer = nextLayer
      const seconds = transitionSeconds(nextLayer)
      graph.updateParameters(nextLayer, seconds)
      rampOutput(seconds)
    },
    async pause() {
      if (disposing) return
      paused = true
      rampOutput()
    },
    async resume() {
      if (disposing) return
      paused = false
      rampOutput()
    },
    async fadeOutAndDispose() {
      if (!disposing) {
        disposing = (async () => {
          paused = true
          const seconds = transitionSeconds()
          try {
            rampOutput(seconds)
            await waitForRamp(seconds)
          } finally {
            disposeAll()
          }
        })()
      }
      await disposing
    },
  }
}

function createSourceGraph(
  layer: AtmoShaperAudioLayer,
  output: Gain,
  nodeScope: AtmoShaperNodeScope,
): GeneratedSourceGraph {
  if (layer.kind === "noise") return createNoiseGraph(layer, output, nodeScope)
  if (layer.kind === "binaural") return createBinauralGraph(layer, output, nodeScope)
  if (layer.kind === "isochronic") return createIsochronicGraph(layer, output, nodeScope)
  throw new Error(`Unsupported generated AtmoShaper layer kind: ${layer.kind}`)
}

function createNoiseGraph(layer: AtmoShaperAudioLayer, output: Gain, nodeScope: AtmoShaperNodeScope): GeneratedSourceGraph {
  const noise = nodeScope.track(new Noise(readNoiseType(layer)))
  noise.connect(output)
  noise.start()
  return {
    updateParameters(nextLayer) {
      noise.type = readNoiseType(nextLayer)
    },
  }
}

function createBinauralGraph(
  layer: AtmoShaperAudioLayer,
  output: Gain,
  nodeScope: AtmoShaperNodeScope,
): GeneratedSourceGraph {
  const frequencies = readBinauralFrequencies(layer)
  const leftPanner = nodeScope.track(new Panner(-1))
  leftPanner.connect(output)
  const rightPanner = nodeScope.track(new Panner(1))
  rightPanner.connect(output)
  const leftOscillator = nodeScope.track(new Oscillator(frequencies.leftHz, "sine"))
  leftOscillator.connect(leftPanner)
  leftOscillator.start()
  const rightOscillator = nodeScope.track(new Oscillator(frequencies.rightHz, "sine"))
  rightOscillator.connect(rightPanner)
  rightOscillator.start()

  return {
    updateParameters(nextLayer, seconds) {
      const next = readBinauralFrequencies(nextLayer)
      leftOscillator.frequency.rampTo(next.leftHz, seconds)
      rightOscillator.frequency.rampTo(next.rightHz, seconds)
    },
  }
}

function createIsochronicGraph(
  layer: AtmoShaperAudioLayer,
  output: Gain,
  nodeScope: AtmoShaperNodeScope,
): GeneratedSourceGraph {
  const carrierHz = readSetting(layer, "carrierHz", 220)
  const pulseHz = readSetting(layer, "pulseHz", 10)
  // A sine LFO keeps the gate above silence so the pulse remains pronounced
  // without introducing hard square-wave edges or zero-crossing clicks.
  const pulseGain = nodeScope.track(new Gain(0.08))
  pulseGain.connect(output)
  const carrier = nodeScope.track(new Oscillator(carrierHz, "sine"))
  carrier.connect(pulseGain)
  carrier.start()
  const pulse = nodeScope.track(new LFO(pulseHz, 0.08, 1))
  pulse.connect(pulseGain.gain)
  pulse.start()

  return {
    updateParameters(nextLayer, seconds) {
      carrier.frequency.rampTo(readSetting(nextLayer, "carrierHz", 220), seconds)
      pulse.frequency.rampTo(readSetting(nextLayer, "pulseHz", 10), seconds)
    },
  }
}

function readBinauralFrequencies(layer: AtmoShaperAudioLayer) {
  return binauralChannelFrequencies(
    readSetting(layer, "carrierHz", 220),
    readSetting(layer, "beatHz", 10),
  )
}

function readNoiseType(layer: AtmoShaperAudioLayer): "white" | "pink" | "brown" {
  const type = layer.sourceId.replace(/^noise:/, "")
  if (type === "white" || type === "pink" || type === "brown") return type
  throw new Error(`Unsupported AtmoShaper noise source: ${layer.sourceId}`)
}

function readSetting(layer: AtmoShaperAudioLayer, key: string, fallback: number) {
  const value = layer.settings?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function waitForRamp(seconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, Math.ceil(seconds * 1000)))
}
