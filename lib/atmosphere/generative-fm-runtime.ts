import {
  fetchGenerativeFmSampleIndex,
  selectGenerativeFmSampleWarmupUrls,
} from "./generative-fm-sample-index"
import {
  createBoundedGenerativeFmWebProvider,
  createGenerativeFmProviderRequestStats,
} from "./generative-fm-provider"

type HostedCompressedSampleFormat = "opus" | "aac" | "mp3"
type HostedSampleFormat = HostedCompressedSampleFormat | "wav"

type GenerativeFmRuntimeStation = {
  id: string
  runtime?: {
    hostedSampleIndexUrl?: string
    hostedSampleIndexFormatUrls?: Partial<Record<HostedCompressedSampleFormat, string>>
    pieceId?: string
    sampleNameGroups?: Array<string | string[]>
  }
}

type GenerativeFmRuntimeOptions = {
  station: GenerativeFmRuntimeStation
  volume?: number
  onLoadProgress?: (progress: number) => void
}

type GenerativeFmPrewarmOptions = {
  station: GenerativeFmRuntimeStation
  includeSamplePayloads?: boolean
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
  sampleFormat: HostedSampleFormat
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

type SamplePayloadPrewarmResult = {
  sampleUrlCount: number
  failedUrlCount: number
}

type SamplePayloadPrewarmEntry = {
  promise: Promise<SamplePayloadPrewarmResult>
  settled: boolean
  sampleUrlCount: number
  failedUrlCount: number
}

let activeVolumeNode: { volume: { value: number, rampTo?: (value: number, seconds: number) => unknown } } | null = null
let activeTransportOwner: symbol | null = null
let runtimeModulesPromise: Promise<GenerativeFmRuntimeModules> | null = null
const preparedRuntimeEntries = new Map<string, PreparedRuntimeCacheEntry>()
const samplePayloadPrewarmEntries = new Map<string, SamplePayloadPrewarmEntry>()
const GENERATIVE_FM_HANDOFF_FADE_SECONDS = 1.2
const SAMPLE_REQUEST_PROGRESS_START = 0.34
const SAMPLE_REQUEST_PROGRESS_SPAN = 0.34
const SAMPLE_PAYLOAD_PREWARM_LIMIT = 24
const SAMPLE_PAYLOAD_PREWARM_CONCURRENCY = 3
const HOSTED_SAMPLE_FORMAT_PREFERENCE: ReadonlyArray<{
  id: HostedCompressedSampleFormat
  audioType: string
}> = Object.freeze([
  { id: "opus", audioType: 'audio/ogg; codecs="opus"' },
  { id: "aac", audioType: 'audio/mp4; codecs="mp4a.40.2"' },
  { id: "mp3", audioType: "audio/mpeg" },
])

/**
 * Starts a Generative.fm package inside MassageLab's global audio lifecycle.
 * The adapter reuses any already prepared metadata/module promise, then starts
 * Tone only from the user-initiated playback path.
 */
export async function startGenerativeFmPiece({
  onLoadProgress,
  station,
  volume = 0.75,
}: GenerativeFmRuntimeOptions) {
  if (typeof window === "undefined") {
    throw new Error("Generative.fm stations can only start in the browser.")
  }

  const startedAt = performance.now()
  reportLoadProgress(onLoadProgress, 0.04)
  const prepared = await getPreparedGenerativeFmRuntime(station, "playback")
  const preparedAt = performance.now()
  reportLoadProgress(onLoadProgress, 0.22)
  const { Tone, createWebProvider, createWebLibrary, piece, pieceId, sampleIndex } = prepared

  await Tone.start()
  const toneStartedAt = performance.now()
  reportLoadProgress(onLoadProgress, 0.32)

  const providerRequestStats = createGenerativeFmProviderRequestStats()
  const provider = createBoundedGenerativeFmWebProvider({
    provider: createWebProvider(),
    stats: providerRequestStats,
    onSampleProgress: (progress) => {
      const totalUniqueUrlCount = Math.max(1, progress.totalUniqueUrlCount)
      reportLoadProgress(
        onLoadProgress,
        SAMPLE_REQUEST_PROGRESS_START + (progress.loadedUniqueUrlCount / totalUniqueUrlCount) * SAMPLE_REQUEST_PROGRESS_SPAN,
      )
    },
  }) as ReturnType<WebProviderFactory>
  const sampleLibrary = createWebLibrary({ sampleIndex, provider })
  const output = new Tone.Volume(volumeToDecibels(0)).toDestination()
  let deactivate: () => unknown
  let schedule: () => (() => unknown) | undefined
  try {
    const runtime = await piece({
      context: resolveToneContext(Tone),
      destination: output,
      sampleLibrary,
      onProgress: (progress) => reportLoadProgress(onLoadProgress, 0.32 + clampLoadProgress(progress) * 0.56),
    })
    deactivate = runtime[0]
    schedule = runtime[1]
  } catch (error) {
    output.dispose()
    throw error
  }
  const activatedAt = performance.now()
  reportLoadProgress(onLoadProgress, 0.9)

  const transportOwner = Symbol(station.id)
  let endStage: (() => unknown) | undefined
  try {
    if (activeTransportOwner) {
      // Generative.fm pieces share Tone.Transport and package callbacks are not
      // owner-scoped. Clear old future callbacks before the next station claims
      // the transport; already-started sources keep fading through their output.
      Tone.Transport.cancel()
      activeTransportOwner = null
    }

    endStage = schedule()
  } catch (error) {
    deactivate()
    output.dispose()
    throw error
  }
  reportLoadProgress(onLoadProgress, 0.97)

  Tone.Transport.start()
  const scheduledAt = performance.now()
  reportLoadProgress(onLoadProgress, 1)
  const samplePayloadPrewarm = readSamplePayloadPrewarmState(prepared)
  recordStartupTiming({
    stationId: station.id,
    pieceId,
    sampleFormat: prepared.sampleFormat,
    usedPrewarm: prepared.usedCompletedPrewarm,
    usedSamplePayloadPrewarm: samplePayloadPrewarm.settled
      && samplePayloadPrewarm.sampleUrlCount > samplePayloadPrewarm.failedUrlCount,
    samplePayloadPrewarmCount: samplePayloadPrewarm.sampleUrlCount,
    sampleRequestBatchCount: providerRequestStats.batchCount,
    sampleRequestCount: providerRequestStats.requestCount,
    sampleRequestMaxBatchSize: providerRequestStats.maxBatchSize,
    sampleRequestMemoryHitUrlCount: providerRequestStats.memoryHitUrlCount,
    sampleRequestUniqueUrlCount: providerRequestStats.uniqueUrlCount,
    sampleRequestUrlCount: providerRequestStats.requestedUrlCount,
    prepareWaitMs: preparedAt - startedAt,
    toneStartMs: toneStartedAt - preparedAt,
    pieceActivateMs: activatedAt - toneStartedAt,
    scheduleMs: scheduledAt - activatedAt,
    totalMs: scheduledAt - startedAt,
  })
  activeVolumeNode = output
  activeTransportOwner = transportOwner
  output.volume.rampTo?.(volumeToDecibels(volume), GENERATIVE_FM_HANDOFF_FADE_SECONDS)

  let disposed = false
  return () => {
    if (disposed) {
      return
    }
    disposed = true

    if (activeVolumeNode === output) {
      activeVolumeNode = null
    }

    output.volume.rampTo?.(volumeToDecibels(0), GENERATIVE_FM_HANDOFF_FADE_SECONDS)

    // Let the old piece fade under the next station. If no newer station has
    // claimed the shared Transport by the end of the fade, stop it as part of
    // the normal user-visible stop path.
    window.setTimeout(() => {
      const ownsTransport = activeTransportOwner === transportOwner
      if (ownsTransport) {
        activeTransportOwner = null
        // Cancel queued package events before disposing samplers so a late
        // Transport callback cannot trigger a released buffer.
        Tone.Transport.stop()
        Tone.Transport.cancel()
      }

      endStage?.()
      deactivate()
      output.dispose()
    }, Math.ceil(GENERATIVE_FM_HANDOFF_FADE_SECONDS * 1000))
  }
}

/**
 * Prepares the hosted sample-index metadata and browser runtime modules without
 * starting Tone or downloading audio sample payloads. The next playback request
 * reuses the same promise so quick hover/tap races do not duplicate work.
 */
export async function prewarmGenerativeFmPiece({
  station,
  includeSamplePayloads = false,
}: GenerativeFmPrewarmOptions) {
  if (typeof window === "undefined") {
    return
  }

  const prepared = await getPreparedGenerativeFmRuntime(station, "prewarm")
  if (includeSamplePayloads) {
    await prewarmGenerativeFmSamplePayloads(prepared)
  }
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
 * Opus, AAC, MP3, and WAV preparations cannot accidentally reuse each other.
 *
 * @param runtime Station runtime metadata with the WAV fallback URL and optional format sidecars.
 * @returns The selected sample format and its sample-index URL, if configured.
 */
function selectHostedSampleIndexUrl(runtime: GenerativeFmRuntimeStation["runtime"]) {
  for (const format of HOSTED_SAMPLE_FORMAT_PREFERENCE) {
    const sampleIndexUrl = runtime?.hostedSampleIndexFormatUrls?.[format.id]
    if (sampleIndexUrl && canPlayAudioType(format.audioType)) {
      return { sampleFormat: format.id, sampleIndexUrl }
    }
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

/**
 * Opportunistically warms selected compressed sample payloads for one prepared
 * runtime configuration. Results are cached by the same runtime key as metadata
 * preparation, WAV remains lazy because it is the large fallback format, and
 * failed warmups collapse to a counted failure result without blocking playback.
 */
function prewarmGenerativeFmSamplePayloads(prepared: PreparedGenerativeFmRuntime): Promise<SamplePayloadPrewarmResult> {
  const cacheKey = preparedRuntimeCacheKey(prepared)
  const existingEntry = samplePayloadPrewarmEntries.get(cacheKey)
  if (existingEntry) {
    return existingEntry.promise
  }

  // WAV payloads can still be large; compressed formats already cover the
  // browsers this branch is trying to speed up, so keep WAV fallback lazy.
  if (prepared.sampleFormat === "wav") {
    return Promise.resolve({ sampleUrlCount: 0, failedUrlCount: 0 })
  }

  const sampleUrls = selectGenerativeFmSampleWarmupUrls({
    sampleIndex: prepared.sampleIndex,
    sampleGroups: prepared.sampleGroups,
    maxUrls: SAMPLE_PAYLOAD_PREWARM_LIMIT,
  })
  const entry: SamplePayloadPrewarmEntry = {
    settled: false,
    sampleUrlCount: sampleUrls.length,
    failedUrlCount: sampleUrls.length,
    promise: warmSamplePayloadUrls(sampleUrls).then((result) => {
      entry.failedUrlCount = result.failedUrlCount
      entry.settled = true
      return result
    }).catch(() => {
      samplePayloadPrewarmEntries.delete(cacheKey)
      return { sampleUrlCount: sampleUrls.length, failedUrlCount: sampleUrls.length }
    }),
  }

  samplePayloadPrewarmEntries.set(cacheKey, entry)
  return entry.promise
}

/**
 * Reads the current payload-prewarm cache state without requiring a cache hit.
 * Missing entries default to an unsettled, zero-count state so telemetry can be
 * emitted safely for immediate playback and WAV fallback paths.
 */
function readSamplePayloadPrewarmState(prepared: PreparedGenerativeFmRuntime) {
  const entry = samplePayloadPrewarmEntries.get(preparedRuntimeCacheKey(prepared))
  return {
    sampleUrlCount: entry?.sampleUrlCount ?? 0,
    failedUrlCount: entry?.failedUrlCount ?? 0,
    settled: entry?.settled ?? false,
  }
}

/**
 * Fetches sample payload URLs with bounded browser-side concurrency. Individual
 * fetch failures are counted and swallowed because payload warmup is an
 * optimization; the actual playback path remains responsible for surfacing
 * real runtime loading errors.
 */
async function warmSamplePayloadUrls(sampleUrls: string[]): Promise<SamplePayloadPrewarmResult> {
  if (sampleUrls.length === 0 || typeof fetch !== "function") {
    return { sampleUrlCount: sampleUrls.length, failedUrlCount: 0 }
  }

  let failedUrlCount = 0
  let nextUrlIndex = 0
  const workerCount = Math.min(SAMPLE_PAYLOAD_PREWARM_CONCURRENCY, sampleUrls.length)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextUrlIndex < sampleUrls.length) {
      const sampleUrl = sampleUrls[nextUrlIndex]
      nextUrlIndex += 1
      try {
        const response = await fetch(sampleUrl, {
          cache: "force-cache",
          credentials: "omit",
          mode: "cors",
        })
        if (!response.ok) {
          failedUrlCount += 1
          continue
        }

        await response.arrayBuffer()
      } catch {
        failedUrlCount += 1
      }
    }
  }))

  return { sampleUrlCount: sampleUrls.length, failedUrlCount }
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

function reportLoadProgress(onLoadProgress: GenerativeFmRuntimeOptions["onLoadProgress"], progress: number) {
  try {
    onLoadProgress?.(clampLoadProgress(progress))
  } catch {
    // Progress reporting is best-effort UI feedback and must not block audio startup.
  }
}

function clampLoadProgress(progress: number) {
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
}

function recordStartupTiming(detail: {
  stationId: string
  pieceId: string
  sampleFormat: HostedSampleFormat
  usedPrewarm: boolean
  usedSamplePayloadPrewarm: boolean
  samplePayloadPrewarmCount: number
  sampleRequestBatchCount: number
  sampleRequestCount: number
  sampleRequestMaxBatchSize: number
  sampleRequestMemoryHitUrlCount: number
  sampleRequestUniqueUrlCount: number
  sampleRequestUrlCount: number
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
