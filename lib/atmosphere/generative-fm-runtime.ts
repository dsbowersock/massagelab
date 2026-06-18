import { fetchGenerativeFmSampleIndex } from "./generative-fm-sample-index"

type GenerativeFmRuntimeStation = {
  id: string
  runtime?: {
    hostedSampleIndexUrl?: string
    hostedSampleIndexFormatUrls?: {
      opus?: string
    }
    pieceId?: string
    sampleNameGroups?: Array<string | string[]>
  }
}

type GenerativeFmRuntimeOptions = {
  station: GenerativeFmRuntimeStation
  volume?: number
}

type ToneModule = typeof import("tone")
type GenerativeFmSampleIndex = Record<string, string | string[] | Record<string, string>>
type WebProviderFactory = typeof import("@generative-music/web-provider").default
type WebLibraryFactory = typeof import("@generative-music/web-library").default
type WebLibrary = import("@generative-music/web-library").WebLibrary

type GenerativeMusicPiece = (options: {
  context: unknown
  destination: unknown
  sampleLibrary: WebLibrary
  onProgress: (progress: number) => void
}) => Promise<[deactivate: () => unknown, schedule: () => (() => unknown) | undefined]>

type GenerativeFmRuntimeConfig = {
  pieceId: string
  sampleGroups: Array<string | string[]>
  sampleFormat: "wav" | "opus"
  sampleIndexUrl: string
}

type GenerativeFmRuntimeModules = {
  Tone: ToneModule
  createWebProvider: WebProviderFactory
  createWebLibrary: WebLibraryFactory
}

type PreparedGenerativeFmRuntime = GenerativeFmRuntimeConfig & GenerativeFmRuntimeModules & {
  piece: GenerativeMusicPiece
  sampleIndex: GenerativeFmSampleIndex
  preparedFor: "playback" | "prewarm"
}

type PreparedGenerativeFmRuntimeResult = PreparedGenerativeFmRuntime & {
  usedCompletedPrewarm: boolean
}

type PreparedRuntimeCacheEntry = {
  promise: Promise<PreparedGenerativeFmRuntime>
  preparedFor: PreparedGenerativeFmRuntime["preparedFor"]
  settled: boolean
}

let activeVolumeNode: { volume: { value: number, rampTo?: (value: number, seconds: number) => unknown } } | null = null
let activeTransportOwner: symbol | null = null
let runtimeModulesPromise: Promise<GenerativeFmRuntimeModules> | null = null
const preparedRuntimeEntries = new Map<string, PreparedRuntimeCacheEntry>()

/**
 * Starts a Generative.fm package inside MassageLab's global audio lifecycle.
 * The adapter reuses any already prepared metadata/module promise, then starts
 * Tone only from the user-initiated playback path.
 */
export async function startGenerativeFmPiece({
  station,
  volume = 0.75,
}: GenerativeFmRuntimeOptions) {
  if (typeof window === "undefined") {
    throw new Error("Generative.fm stations can only start in the browser.")
  }

  const startedAt = performance.now()
  const prepared = await getPreparedGenerativeFmRuntime(station, "playback")
  const preparedAt = performance.now()
  const { Tone, createWebProvider, createWebLibrary, piece, pieceId, sampleIndex } = prepared

  await Tone.start()
  const toneStartedAt = performance.now()

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
  const activatedAt = performance.now()

  let endStage: (() => unknown) | undefined
  try {
    endStage = schedule()
  } catch (error) {
    deactivate()
    output.dispose()
    throw error
  }

  Tone.Transport.start()
  const scheduledAt = performance.now()
  recordStartupTiming({
    stationId: station.id,
    pieceId,
    sampleFormat: prepared.sampleFormat,
    usedPrewarm: prepared.usedCompletedPrewarm,
    prepareWaitMs: preparedAt - startedAt,
    toneStartMs: toneStartedAt - preparedAt,
    pieceActivateMs: activatedAt - toneStartedAt,
    scheduleMs: scheduledAt - activatedAt,
    totalMs: scheduledAt - startedAt,
  })
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

/**
 * Prepares the hosted sample-index metadata and browser runtime modules without
 * starting Tone or downloading audio sample payloads. The next playback request
 * reuses the same promise so quick hover/tap races do not duplicate work.
 */
export async function prewarmGenerativeFmPiece({
  station,
}: {
  station: GenerativeFmRuntimeStation
}) {
  if (typeof window === "undefined") {
    return
  }

  await getPreparedGenerativeFmRuntime(station, "prewarm")
}

export function setGenerativeFmPieceVolume(volume: number) {
  if (!activeVolumeNode) {
    return
  }

  activeVolumeNode.volume.value = volumeToDecibels(volume)
}

async function getPreparedGenerativeFmRuntime(
  station: GenerativeFmRuntimeStation,
  preparedFor: PreparedGenerativeFmRuntime["preparedFor"],
): Promise<PreparedGenerativeFmRuntimeResult> {
  const config = readGenerativeFmRuntimeConfig(station)
  const cacheKey = preparedRuntimeCacheKey(config)
  const cachedEntry = preparedRuntimeEntries.get(cacheKey)
  if (cachedEntry) {
    const usedCompletedPrewarm = preparedFor === "playback"
      && cachedEntry.preparedFor === "prewarm"
      && cachedEntry.settled
    const prepared = await cachedEntry.promise
    return { ...prepared, usedCompletedPrewarm }
  }

  const entry: PreparedRuntimeCacheEntry = {
    preparedFor,
    settled: false,
    promise: Promise.resolve(null as never),
  }

  entry.promise = Promise.all([
    fetchGenerativeFmSampleIndex({
      sampleIndexUrl: config.sampleIndexUrl,
      sampleGroups: config.sampleGroups,
    }) as Promise<GenerativeFmSampleIndex>,
    loadGenerativeFmRuntimeModules(),
    loadGenerativeFmPiece(config.pieceId),
  ]).then(([sampleIndex, modules, piece]) => ({
    ...config,
    ...modules,
    piece,
    sampleIndex,
    preparedFor,
  })).then((prepared) => {
    entry.settled = true
    return prepared
  }).catch((error) => {
    preparedRuntimeEntries.delete(cacheKey)
    throw error
  })

  preparedRuntimeEntries.set(cacheKey, entry)
  const prepared = await entry.promise
  return { ...prepared, usedCompletedPrewarm: false }
}

function readGenerativeFmRuntimeConfig(station: GenerativeFmRuntimeStation): GenerativeFmRuntimeConfig {
  const { sampleFormat, sampleIndexUrl } = selectHostedSampleIndexUrl(station.runtime)
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

  return { pieceId, sampleFormat, sampleGroups, sampleIndexUrl }
}

/**
 * Selects the hosted sample-index URL and audio format for runtime prep.
 * The resolved sampleFormat also partitions the prepared-runtime cache so an
 * Opus-capable browser does not reuse a WAV fallback preparation, or vice versa.
 *
 * @param runtime Station runtime metadata with the WAV fallback URL and optional format sidecars.
 * @returns The selected sample format and its sample-index URL, if configured.
 */
function selectHostedSampleIndexUrl(runtime: GenerativeFmRuntimeStation["runtime"]) {
  const opusSampleIndexUrl = runtime?.hostedSampleIndexFormatUrls?.opus
  if (opusSampleIndexUrl && canPlayAudioType('audio/ogg; codecs="opus"')) {
    return { sampleFormat: "opus" as const, sampleIndexUrl: opusSampleIndexUrl }
  }

  return { sampleFormat: "wav" as const, sampleIndexUrl: runtime?.hostedSampleIndexUrl }
}

/**
 * Safely checks browser playback support for an audio MIME type.
 *
 * @param audioType MIME type passed to HTMLAudioElement.canPlayType.
 * @returns True when the browser reports playback support; false on failure or unsupported types.
 */
function canPlayAudioType(audioType: string) {
  try {
    const audio = document.createElement("audio")
    return audio.canPlayType(audioType) !== ""
  } catch {
    return false
  }
}

function preparedRuntimeCacheKey({ pieceId, sampleFormat, sampleGroups, sampleIndexUrl }: GenerativeFmRuntimeConfig) {
  return JSON.stringify([pieceId, sampleFormat, sampleIndexUrl, sampleGroups])
}

function loadGenerativeFmRuntimeModules() {
  runtimeModulesPromise = runtimeModulesPromise ?? Promise.all([
    import("tone"),
    import("@generative-music/web-provider"),
    import("@generative-music/web-library"),
  ]).then(([Tone, { default: createWebProvider }, { default: createWebLibrary }]) => ({
    Tone,
    createWebProvider,
    createWebLibrary,
  })).catch((error) => {
    runtimeModulesPromise = null
    throw error
  })

  return runtimeModulesPromise
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

function recordStartupTiming(detail: {
  stationId: string
  pieceId: string
  sampleFormat: "wav" | "opus"
  usedPrewarm: boolean
  prepareWaitMs: number
  toneStartMs: number
  pieceActivateMs: number
  scheduleMs: number
  totalMs: number
}) {
  window.dispatchEvent(new CustomEvent("massagelab:atmosphere-startup-timing", { detail }))

  try {
    if (window.localStorage.getItem("massagelab:atmosphere:debug") === "1") {
      console.info("MassageLab Atmosphere startup timing", detail)
    }
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}
