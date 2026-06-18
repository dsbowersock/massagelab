import { fetchGenerativeFmSampleIndex } from "./generative-fm-sample-index"

type GenerativeFmRuntimeStation = {
  id: string
  runtime?: {
    hostedSampleIndexUrl?: string
    sampleNameGroups?: Array<string | string[]>
  }
}

type GenerativeFmRuntimeOptions = {
  station: GenerativeFmRuntimeStation
  volume?: number
}

type ToneModule = typeof import("tone")

type GenerativeMusicPiece = (options: {
  context: unknown
  destination: unknown
  sampleLibrary: unknown
  onProgress: (progress: number) => void
}) => Promise<[deactivate: () => unknown, schedule: () => (() => unknown) | undefined]>

let activeVolumeNode: { volume: { value: number, rampTo?: (value: number, seconds: number) => unknown } } | null = null

/**
 * Starts a Generative.fm package inside MassageLab's global audio lifecycle.
 * The adapter intentionally fetches the hosted sample index before importing
 * sample-heavy runtime modules so station failures stay clear and actionable.
 */
export async function startGenerativeFmPiece({
  station,
  volume = 0.75,
}: GenerativeFmRuntimeOptions) {
  if (typeof window === "undefined") {
    throw new Error("Generative.fm stations can only start in the browser.")
  }

  const sampleIndexUrl = station.runtime?.hostedSampleIndexUrl
  if (!sampleIndexUrl) {
    throw new Error("Generative.fm station is missing a hosted sample-index URL.")
  }

  const sampleGroups = station.runtime?.sampleNameGroups
  if (!sampleGroups || sampleGroups.length === 0) {
    throw new Error("Generative.fm station is missing package sample-name groups.")
  }

  const sampleIndex = await fetchGenerativeFmSampleIndex({ sampleIndexUrl, sampleGroups })
  const [
    Tone,
    { default: createWebProvider },
    { default: createWebLibrary },
    { default: createObservableStreamsPiece },
  ] = await Promise.all([
    import("tone"),
    import("@generative-music/web-provider"),
    import("@generative-music/web-library"),
    import("@generative-music/piece-observable-streams"),
  ])

  await Tone.start()

  const provider = createWebProvider()
  const sampleLibrary = createWebLibrary({ sampleIndex, provider })
  const output = new Tone.Volume(volumeToDecibels(volume)).toDestination()
  const piece = createObservableStreamsPiece as GenerativeMusicPiece
  const [deactivate, schedule] = await piece({
    context: resolveToneContext(Tone),
    destination: output,
    sampleLibrary,
    onProgress: () => undefined,
  })
  const endStage = schedule()

  Tone.Transport.start()
  activeVolumeNode = output

  let disposed = false
  return () => {
    if (disposed) {
      return
    }
    disposed = true

    if (activeVolumeNode === output) {
      activeVolumeNode = null
    }

    output.volume.rampTo?.(volumeToDecibels(0), 0.1)
    endStage?.()
    deactivate()

    // Give the piece cleanup and volume ramp a short window before clearing Tone's shared transport.
    window.setTimeout(() => {
      Tone.Transport.stop()
      Tone.Transport.cancel()
      output.dispose()
    }, 150)
  }
}

export function setGenerativeFmPieceVolume(volume: number) {
  if (!activeVolumeNode) {
    return
  }

  activeVolumeNode.volume.value = volumeToDecibels(volume)
}

function resolveToneContext(Tone: ToneModule) {
  if (typeof Tone.getContext === "function") {
    return Tone.getContext()
  }

  return Tone.context
}

function volumeToDecibels(volume: number) {
  const clampedVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.75))
  return -60 + clampedVolume * 48
}
