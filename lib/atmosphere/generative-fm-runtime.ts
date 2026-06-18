import { fetchGenerativeFmSampleIndex } from "./generative-fm-sample-index"

type GenerativeFmRuntimeStation = {
  id: string
  runtime?: {
    hostedSampleIndexUrl?: string
    pieceId?: string
    sampleNameGroups?: Array<string | string[]>
  }
}

type GenerativeFmRuntimeOptions = {
  station: GenerativeFmRuntimeStation
  volume?: number
}

type ToneModule = typeof import("tone")
type WebLibrary = import("@generative-music/web-library").WebLibrary

type GenerativeMusicPiece = (options: {
  context: unknown
  destination: unknown
  sampleLibrary: WebLibrary
  onProgress: (progress: number) => void
}) => Promise<[deactivate: () => unknown, schedule: () => (() => unknown) | undefined]>

let activeVolumeNode: { volume: { value: number, rampTo?: (value: number, seconds: number) => unknown } } | null = null
let activeTransportOwner: symbol | null = null

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

  const pieceId = station.runtime?.pieceId
  if (!pieceId) {
    throw new Error("Generative.fm station is missing a package piece id.")
  }

  const sampleIndex = await fetchGenerativeFmSampleIndex({ sampleIndexUrl, sampleGroups })
  const [
    Tone,
    { default: createWebProvider },
    { default: createWebLibrary },
    piece,
  ] = await Promise.all([
    import("tone"),
    import("@generative-music/web-provider"),
    import("@generative-music/web-library"),
    loadGenerativeFmPiece(pieceId),
  ])

  await Tone.start()

  const provider = createWebProvider()
  const sampleLibrary = createWebLibrary({ sampleIndex, provider })
  const output = new Tone.Volume(volumeToDecibels(volume)).toDestination()
  let deactivate: () => unknown
  let schedule: () => (() => unknown) | undefined
  try {
    const runtime = await piece({
      context: resolveToneContext(Tone),
      destination: output,
      sampleLibrary,
      onProgress: () => undefined,
    })
    deactivate = runtime[0]
    schedule = runtime[1]
  } catch (error) {
    output.dispose()
    throw error
  }

  let endStage: (() => unknown) | undefined
  try {
    endStage = schedule()
  } catch (error) {
    deactivate()
    output.dispose()
    throw error
  }

  Tone.Transport.start()
  activeVolumeNode = output
  const transportOwner = Symbol(station.id)
  activeTransportOwner = transportOwner

  let disposed = false
  return () => {
    if (disposed) {
      return
    }
    disposed = true

    if (activeVolumeNode === output) {
      activeVolumeNode = null
    }
    const ownsTransport = activeTransportOwner === transportOwner
    if (ownsTransport) {
      activeTransportOwner = null
      // Cancel queued package events before disposing samplers so a late
      // Transport callback cannot trigger a released buffer.
      Tone.Transport.stop()
      Tone.Transport.cancel()
    }

    output.volume.rampTo?.(volumeToDecibels(0), 0.1)
    endStage?.()
    deactivate()

    // Give the piece cleanup and volume ramp a short window before dropping the output node.
    window.setTimeout(() => {
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

/**
 * Loads the requested Generative.fm package piece. Observable Streams stays on
 * the single-piece package because its exported runtime matches the hosted
 * rendered sample keys verified for MassageLab playback; the aggregate package
 * remains the catalog source for future sample-enabled stations.
 */
async function loadGenerativeFmPiece(pieceId: string): Promise<GenerativeMusicPiece> {
  if (pieceId === "observable-streams") {
    const { default: piece } = await import("@generative-music/piece-observable-streams")
    return piece
  }

  const { byId: piecesById } = await import("@generative-music/pieces-alex-bainter")
  const piece = piecesById?.[pieceId] as GenerativeMusicPiece | undefined
  if (!piece) {
    throw new Error(`Generative.fm package did not expose piece id: ${pieceId}`)
  }

  return piece
}

/**
 * Maps UI volume values from 0..1 onto a conservative -60 dB..-12 dB range.
 * The -12 dB upper cap is intentional so imported Generative.fm pieces stay
 * below unity gain inside MassageLab's shared audio graph.
 */
function volumeToDecibels(volume: number) {
  const clampedVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.75))
  return -60 + clampedVolume * 48
}
