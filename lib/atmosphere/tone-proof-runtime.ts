import { Volume } from "tone/build/esm/component/channel/Volume"
import { Filter } from "tone/build/esm/component/filter/Filter"
import { start } from "tone/build/esm/core/Global"
import { Oscillator } from "tone/build/esm/source/oscillator/Oscillator"

type ToneProofDroneOptions = {
  baseFrequency?: number
  detuneCents?: number
  fadeSeconds?: number
  volume?: number
}

let activeVolumeNode: Volume | null = null

/**
 * Starts the first MassageLab-owned browser generator used to prove the global
 * Atmosphere lifecycle. The station intentionally avoids imported samples so
 * routing, autoplay, and cleanup can be validated before sample-heavy pieces.
 */
export async function startToneProofDrone({
  baseFrequency = 110,
  detuneCents = 7,
  volume = 0.75,
}: ToneProofDroneOptions = {}) {
  if (typeof window === "undefined") {
    throw new Error("Tone proof stations can only start in the browser.")
  }

  await start()

  const safeBaseFrequency = toFinitePositive(baseFrequency, 110)
  const detuneRatio = Math.pow(2, toFiniteNumber(detuneCents, 7) / 1200)
  const output = new Volume(volumeToDecibels(0)).toDestination()
  const filter = new Filter(620, "lowpass", -12).connect(output)
  const baseOscillator = new Oscillator(safeBaseFrequency, "sine").connect(filter)
  const detunedOscillator = new Oscillator(safeBaseFrequency * detuneRatio, "sine").connect(filter)
  const lowOscillator = new Oscillator(safeBaseFrequency / 2, "triangle").connect(filter)

  activeVolumeNode = output
  setToneProofDroneVolume(volume)

  baseOscillator.start()
  detunedOscillator.start("+0.03")
  lowOscillator.start("+0.08")

  return () => {
    if (activeVolumeNode === output) {
      activeVolumeNode = null
    }

    disposeToneNode(baseOscillator)
    disposeToneNode(detunedOscillator)
    disposeToneNode(lowOscillator)
    disposeToneNode(filter)
    disposeToneNode(output)
  }
}

export function setToneProofDroneVolume(volume: number) {
  if (!activeVolumeNode) {
    return
  }

  activeVolumeNode.volume.value = volumeToDecibels(volume)
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

function disposeToneNode(node: { stop?: () => unknown; dispose: () => unknown }) {
  try {
    node.stop?.()
  } finally {
    node.dispose()
  }
}
