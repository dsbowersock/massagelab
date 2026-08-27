// Tone 14's top-level browser field resolves to a non-static bundle under
// Next/Turbopack, so the spike uses Tone's ESM files until package resolution
// can be revisited without breaking production builds.
import { Volume } from "tone/build/esm/component/channel/Volume"
import { Filter } from "tone/build/esm/component/filter/Filter"
import { start } from "tone/build/esm/core/Global"
import type { InputNode } from "tone/build/esm/core/context/ToneAudioNode"
import { Oscillator } from "tone/build/esm/source/oscillator/Oscillator"

type ToneProofDroneOptions = {
  baseFrequency?: number
  destination?: InputNode
  detuneCents?: number
  fadeSeconds?: number
  /** False once a newer request owns shared audio; stale starts must stay inert. */
  isCurrent?: () => boolean
  volume?: number
}

type ToneProofDronePlaybackHandle = (() => void) & {
  dispose(): Promise<void>
  setVolume(nextVolume: number, seconds?: number): void
}

let activeVolumeNode: Volume | null = null
let activeProofSession: {
  id: number
  startedAt: number
  output: Volume
} | null = null
let nextProofSessionId = 1

export interface ToneProofDroneDiagnostics {
  sessionId: number
  audioContextState: string
  startedAt: number
  currentTime: number
  elapsed: number
}

/**
 * Reads the active production Tone graph without creating or advancing it.
 * Guarded QA surfaces use this to prove playback identity and audio-context
 * time survive unrelated React draft updates.
 */
export function getToneProofDroneDiagnostics(): ToneProofDroneDiagnostics | null {
  if (!activeProofSession) {
    return null
  }
  const rawContext = activeProofSession.output.context.rawContext
  const currentTime = rawContext.currentTime
  return {
    sessionId: activeProofSession.id,
    audioContextState: rawContext.state,
    startedAt: activeProofSession.startedAt,
    currentTime,
    elapsed: currentTime - activeProofSession.startedAt,
  }
}

/**
 * Starts the first MassageLab-owned browser generator used to prove the global
 * Atmosphere lifecycle. The station intentionally avoids imported samples so
 * routing, autoplay, and cleanup can be validated before sample-heavy pieces.
 */
export async function startToneProofDrone({
  baseFrequency = 110,
  destination,
  detuneCents = 7,
  fadeSeconds = 1.2,
  isCurrent = () => true,
  volume = 0.75,
}: ToneProofDroneOptions = {}): Promise<ToneProofDronePlaybackHandle> {
  if (typeof window === "undefined") {
    throw new Error("Tone proof stations can only start in the browser.")
  }

  await start()

  // Activation is asynchronous, so confirm ownership before allocating nodes.
  if (!isCurrent()) {
    return createSilentToneProofHandle()
  }

  const safeBaseFrequency = toFinitePositive(baseFrequency, 110)
  const detuneRatio = Math.pow(2, toFiniteNumber(detuneCents, 7) / 1200)
  const safeFadeSeconds = toFiniteNonNegative(fadeSeconds, 1.2)
  const output = new Volume(volumeToDecibels(0))
  if (destination) output.connect(destination)
  else output.toDestination()
  const filter = new Filter(620, "lowpass", -12).connect(output)
  const baseOscillator = new Oscillator(safeBaseFrequency, "sine").connect(filter)
  const detunedOscillator = new Oscillator(safeBaseFrequency * detuneRatio, "sine").connect(filter)
  const lowOscillator = new Oscillator(safeBaseFrequency / 2, "triangle").connect(filter)
  let disposed = false
  let cleanupPromise: Promise<void> | null = null

  activeVolumeNode = output
  activeProofSession = {
    id: nextProofSessionId,
    startedAt: output.context.rawContext.currentTime,
    output,
  }
  nextProofSessionId += 1

  baseOscillator.start()
  detunedOscillator.start("+0.03")
  lowOscillator.start("+0.08")
  output.volume.rampTo(volumeToDecibels(volume), safeFadeSeconds)

  const beginCleanup = () => {
    if (cleanupPromise) return cleanupPromise
    if (activeVolumeNode === output) {
      activeVolumeNode = null
    }
    if (activeProofSession?.output === output) {
      activeProofSession = null
    }

    try {
      output.volume.rampTo(volumeToDecibels(0), safeFadeSeconds)
    } catch {
      // A failed fade must not prevent terminal graph cleanup.
    }

    cleanupPromise = new Promise((resolve) => {
      const disposeToneGraph = () => {
        if (disposed) {
          resolve()
          return
        }
        disposed = true

        disposeToneNode(baseOscillator)
        disposeToneNode(detunedOscillator)
        disposeToneNode(lowOscillator)
        disposeToneNode(filter)
        disposeToneNode(output)
        resolve()
      }

      if (safeFadeSeconds === 0) {
        disposeToneGraph()
        return
      }

      window.setTimeout(disposeToneGraph, Math.ceil(safeFadeSeconds * 1000))
    })
    return cleanupPromise
  }
  const stopPlayback = (() => {
    void beginCleanup()
  }) as ToneProofDronePlaybackHandle
  stopPlayback.setVolume = (nextVolume: number, seconds = 0.08) => {
    if (cleanupPromise) return
    output.volume.rampTo(volumeToDecibels(nextVolume), seconds)
  }
  stopPlayback.dispose = beginCleanup
  return stopPlayback
}

export function setToneProofDroneVolume(volume: number) {
  if (!activeVolumeNode) {
    return
  }

  activeVolumeNode.volume.value = volumeToDecibels(volume)
}

/** Preserves callable cleanup compatibility for starts invalidated before graph allocation. */
function createSilentToneProofHandle(): ToneProofDronePlaybackHandle {
  const stopPlayback = (() => undefined) as ToneProofDronePlaybackHandle
  stopPlayback.setVolume = () => undefined
  stopPlayback.dispose = async () => undefined
  return stopPlayback
}

function volumeToDecibels(volume: number) {
  const clampedVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.75))
  return -60 + clampedVolume * 48
}

function toFinitePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function toFiniteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}

function toFiniteNonNegative(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function disposeToneNode(node: { stop?: () => unknown; dispose: () => unknown }) {
  try {
    node.stop?.()
  } catch {
    // Terminal cleanup continues through the rest of the private graph.
  }
  try {
    node.dispose()
  } catch {
    // Terminal cleanup has no live recovery path for an individual node.
  }
}
