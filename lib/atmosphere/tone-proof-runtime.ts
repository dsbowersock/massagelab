import * as Tone from "tone"

type ToneProofDroneOptions = {
  baseFrequency?: number
  detuneCents?: number
  fadeSeconds?: number
  volume?: number
}

let activeVolumeNode: Tone.Volume | null = null

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

  await Tone.start()

  const safeBaseFrequency = toFinitePositive(baseFrequency, 110)
  const detuneRatio = Math.pow(2, toFiniteNumber(detuneCents, 7) / 1200)
  const output = new Tone.Volume(volumeToDecibels(0)).toDestination()
  const filter = new Tone.Filter(620, "lowpass", -12).connect(output)
  const baseOscillator = new Tone.Oscillator(safeBaseFrequency, "sine").connect(filter)
  const detunedOscillator = new Tone.Oscillator(safeBaseFrequency * detuneRatio, "sine").connect(filter)
  const lowOscillator = new Tone.Oscillator(safeBaseFrequency / 2, "triangle").connect(filter)

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
