// @ts-check

import fs from "node:fs/promises"
import path from "node:path"
import {
  GENERATIVE_FM_RENDER_PLAN_STATUS,
  createGenerativeFmRenderPlan,
} from "./generative-fm-render-plan.js"
import {
  decodeWav,
  encodePcm16Wav,
  noteNameToMidi,
  renderPitchShiftedSample,
  selectClosestSourceAsset,
} from "./prerendered-samples.js"
import { createObservableStreamsR2UploadPlan, publicUrlForR2Object } from "./r2-sample-hosting.js"
import { parseVscoPianoMappingChart } from "./sample-intake.js"

export const DEFAULT_GENERATIVE_FM_OBJECT_PREFIX_BASE = "atmosphere/generative-fm"

const VSCO_ROOT_MARKER = "vsco-2-ce-1.1.0/vsco-2-ce-1.1.0"
const VCSL_ROOT_MARKER = "vcsl-1.2.2-rc/vcsl-1.2.2-rc"
const VSCO_PIANO_SOURCE_INDEX_PIECE_IDS = new Set([
  "aisatsana",
  "day-dream",
  "eno-machine",
  "impact",
  "lemniscate",
  "pinwheels",
  "sevenths",
  "uun",
])

/**
 * Selects the local source WAVs needed for planned Generative.fm batches.
 * Rendered pieces keep their source selections in the manifest while
 * the package-facing rendered keys remain the primary runtime path.
 *
 * @param {{
 *   rootPath?: string,
 *   files?: Array<string | { relativePath?: string, path?: string, sizeBytes?: number }>,
 *   licenseTextByPath?: Record<string, string>,
 *   vscoPianoMappingChartText?: string,
 *   objectPrefixBase?: string,
 *   pieceIds?: string[],
 * }} params
 */
export function createGenerativeFmFirstBatchAssetPlans(params = {}) {
  const entries = normalizeEntries(params.files ?? [])
  const renderPlan = createGenerativeFmRenderPlan(params)
  const mappingBySampleNumber = new Map(
    parseVscoPianoMappingChart(params.vscoPianoMappingChartText ?? "")
      .map((row) => [row.sampleNumber, row.noteName]),
  )
  const objectPrefixBase = normalizeObjectPrefixBase(params.objectPrefixBase ?? DEFAULT_GENERATIVE_FM_OBJECT_PREFIX_BASE)

  return renderPlan.pieces.map((piece) => {
    if (piece.status !== GENERATIVE_FM_RENDER_PLAN_STATUS.READY_FOR_UPLOAD_PLANNING) {
      throw new Error(`Cannot create Generative.fm sample assets for ${piece.id}; source coverage is ${piece.status}.`)
    }

    const selectedAssets = selectSourceAssetsForPiece(piece.id, entries, mappingBySampleNumber)
    const missingNotes = sourceMissingNotesForPiece(piece.id, selectedAssets)
    const objectPrefix = `${objectPrefixBase}/${piece.id}`

    return {
      adaptationId: `generative-fm-${piece.id}-sample-hosting`,
      pieceId: piece.id,
      title: piece.title,
      rootPath: params.rootPath ?? null,
      objectPrefix,
      selectedAssets,
      missingNotes,
      renderedTargets: piece.renderedTargets.map((target) => ({
        ...target,
        notes: [...target.notes],
      })),
      excludedSources: [],
    }
  })
}

/**
 * Builds per-piece public-media upload plans for planned Generative.fm batches.
 * The returned plans include source WAVs, rendered WAV buffers, sample indexes,
 * and manifests, but callers decide whether to upload them.
 *
 * @param {{
 *   rootPath: string,
 *   files?: Array<string | { relativePath?: string, path?: string, sizeBytes?: number }>,
 *   licenseTextByPath?: Record<string, string>,
 *   vscoPianoMappingChartText?: string,
 *   bucket?: string,
 *   publicBaseUrl: string,
 *   objectPrefixBase?: string,
 *   cacheControl?: string,
 *   metadataCacheControl?: string,
 *   pieceIds?: string[],
 * }} params
 */
export async function createGenerativeFmFirstBatchR2UploadPlans(params) {
  if (!params.rootPath) throw new Error("rootPath is required for Generative.fm upload plans.")
  if (!params.publicBaseUrl) throw new Error("publicBaseUrl is required for Generative.fm upload plans.")

  const assetPlans = createGenerativeFmFirstBatchAssetPlans(params)
  const uploadPlans = []

  for (const assetPlan of assetPlans) {
    if (assetPlan.missingNotes.length > 0) {
      const missing = assetPlan.missingNotes
        .map((note) => `${note.instrumentName} ${note.noteName ?? "(source)"}`)
        .join(", ")
      throw new Error(`Cannot create upload plan for ${assetPlan.pieceId}; missing source notes: ${missing}`)
    }

    const renderedSampleObjects = await createGenerativeFmFirstBatchRenderedSampleObjects({
      assetPlan,
      audioRoot: params.rootPath,
      publicBaseUrl: params.publicBaseUrl,
      cacheControl: params.cacheControl,
    })
    const uploadPlan = createObservableStreamsR2UploadPlan({
      assetPlan,
      renderedSampleObjects,
      bucket: params.bucket,
      publicBaseUrl: params.publicBaseUrl,
      objectPrefix: assetPlan.objectPrefix,
      cacheControl: params.cacheControl,
      metadataCacheControl: params.metadataCacheControl,
    })

    uploadPlans.push({
      ...uploadPlan,
      pieceId: assetPlan.pieceId,
      title: assetPlan.title,
    })
  }

  return uploadPlans
}

/**
 * @param {{
 *   assetPlan: ReturnType<typeof createGenerativeFmFirstBatchAssetPlans>[number],
 *   audioRoot: string,
 *   publicBaseUrl: string,
 *   cacheControl?: string,
 * }} params
 */
export async function createGenerativeFmFirstBatchRenderedSampleObjects({
  assetPlan,
  audioRoot,
  publicBaseUrl,
  cacheControl,
}) {
  const resolvedAudioRoot = path.resolve(audioRoot)
  const decodedSourceCache = new Map()
  const renderedSampleObjects = []

  for (const target of assetPlan.renderedTargets) {
    const sourceAssets = assetPlan.selectedAssets.filter((asset) => asset.instrumentName === target.sourceInstrumentName)
    if (sourceAssets.length === 0) {
      throw new Error(`Cannot render ${target.renderedInstrumentName}; missing ${target.sourceInstrumentName} source assets.`)
    }

    for (const noteName of target.notes) {
      const sourceAsset = selectClosestSourceAsset(sourceAssets, noteName)
      const sourcePath = resolveContainedSourcePath(resolvedAudioRoot, sourceAsset.sourceRelativePath)
      const decodedSource = await readDecodedWavFromCache(decodedSourceCache, sourcePath)
      const renderedWav = renderPitchShiftedSample({
        source: decodedSource,
        sourceNoteName: sourceAsset.noteName,
        targetNoteName: noteName,
        pitchShiftSemitones: target.pitchShiftSemitones,
        additionalRenderLengthSeconds: target.additionalRenderLengthSeconds,
        reverb: target.reverb,
      })
      const body = encodePcm16Wav(renderedWav)
      const outputFileName = `${target.outputFilePrefix}-${noteNameToSlug(noteName)}.wav`
      const objectKey = `${assetPlan.objectPrefix}/rendered/${target.renderedInstrumentName}/${outputFileName}`

      renderedSampleObjects.push({
        kind: "rendered-sample",
        instrumentName: target.renderedInstrumentName,
        noteName,
        sourceInstrumentName: target.sourceInstrumentName,
        sourceNoteName: sourceAsset.noteName,
        sourceRelativePath: sourceAsset.sourceRelativePath,
        outputFileName,
        objectKey,
        publicUrl: publicUrlForR2Object(publicBaseUrl, objectKey),
        contentType: "audio/wav",
        cacheControl,
        body,
        sizeBytes: body.byteLength,
        render: {
          pitchShiftSemitones: target.pitchShiftSemitones,
          additionalRenderLengthSeconds: target.additionalRenderLengthSeconds,
          renderEffect: target.renderEffect,
          reverb: target.reverb,
        },
      })
    }
  }

  return renderedSampleObjects
}

/**
 * @param {string} pieceId
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {Map<string, string>} mappingBySampleNumber
 */
function selectSourceAssetsForPiece(pieceId, entries, mappingBySampleNumber) {
  if (VSCO_PIANO_SOURCE_INDEX_PIECE_IDS.has(pieceId)) return selectVscoPianoMfAssets(entries, mappingBySampleNumber)
  if (pieceId === "at-sunrise") return selectVcslVibraphoneSoftMalletAssets(entries)
  if (pieceId === "little-bells") return selectVscoGlockAssets(entries)
  throw new Error(`Unsupported Generative.fm upload-plan piece: ${pieceId}`)
}

/**
 * @param {string} pieceId
 * @param {Array<{ instrumentName: string, noteName: string }>} selectedAssets
 */
function sourceMissingNotesForPiece(pieceId, selectedAssets) {
  if (selectedAssets.length > 0) return []

  if (VSCO_PIANO_SOURCE_INDEX_PIECE_IDS.has(pieceId)) return [{ instrumentName: "vsco2-piano-mf", noteName: null }]
  if (pieceId === "at-sunrise") return [{ instrumentName: "vcsl-vibraphone-soft-mallets-mp", noteName: null }]
  if (pieceId === "little-bells") return [{ instrumentName: "vsco2-glock", noteName: null }]
  return [{ instrumentName: pieceId, noteName: null }]
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {Map<string, string>} mappingBySampleNumber
 */
function selectVscoPianoMfAssets(entries, mappingBySampleNumber) {
  return entries
    .map((entry) => matchVscoPianoMfFile(entry, mappingBySampleNumber))
    .filter(Boolean)
    .filter((asset) => asset.dynamicLayer === "2" && asset.roundRobin === "1")
    .sort(compareAssetsByMidi)
    .map((asset) => toSelectedAsset({
      ...asset,
      instrumentName: "vsco2-piano-mf",
      filePrefix: "vsco2-piano-mf",
    }))
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 */
function selectVcslVibraphoneSoftMalletAssets(entries) {
  const bestByNote = new Map()
  const matches = entries.map(matchVcslVibraphoneSoftMalletFile).filter(Boolean)

  for (const match of matches) {
    const existing = bestByNote.get(match.noteName)
    if (!existing || compareDynamicAsset(match, existing) < 0) {
      bestByNote.set(match.noteName, match)
    }
  }

  return [...bestByNote.values()]
    .sort(compareAssetsByMidi)
    .map((asset) => toSelectedAsset({
      ...asset,
      instrumentName: "vcsl-vibraphone-soft-mallets-mp",
      dynamicLayer: `v${asset.dynamicVersion}`,
      filePrefix: "vcsl-vibraphone-soft-mallets-mp",
    }))
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 */
function selectVscoGlockAssets(entries) {
  return entries
    .map(matchVscoGlockFile)
    .filter(Boolean)
    .sort(compareAssetsByMidi)
    .map((asset) => toSelectedAsset({
      ...asset,
      instrumentName: "vsco2-glock",
      dynamicLayer: "medium",
      filePrefix: "vsco2-glock",
    }))
}

/**
 * @param {{ displayPath: string, normalizedPath: string, sizeBytes: number | null }} entry
 * @param {Map<string, string>} mappingBySampleNumber
 */
function matchVscoPianoMfFile(entry, mappingBySampleNumber) {
  if (!entry.normalizedPath.includes(`${VSCO_ROOT_MARKER}/keys/upright piano/`) || !entry.normalizedPath.endsWith(".wav")) {
    return null
  }

  const match = /^player_dyn(?<dynamicLayer>\d+)_rr(?<roundRobin>\d+)_(?<sampleNumber>\d{3})\.wav$/.exec(basename(entry.normalizedPath))
  if (!match?.groups) return null

  const noteName = mappingBySampleNumber.get(match.groups.sampleNumber)
  if (!noteName) return null

  return {
    ...entry,
    noteName,
    dynamicLayer: match.groups.dynamicLayer,
    roundRobin: match.groups.roundRobin,
  }
}

/**
 * @param {{ displayPath: string, normalizedPath: string, sizeBytes: number | null }} entry
 */
function matchVcslVibraphoneSoftMalletFile(entry) {
  if (
    !entry.normalizedPath.includes(`${VCSL_ROOT_MARKER}/idiophones/struck idiophones/vibraphone/soft mallets/`) ||
    !entry.normalizedPath.endsWith(".wav")
  ) {
    return null
  }

  const match = /^vibes_soft_(?<note>[a-g]#?\d)_v(?<dynamicVersion>\d+)_rr(?<roundRobin>\d+)_main\.wav$/.exec(basename(entry.normalizedPath))
  if (!match?.groups) return null

  return {
    ...entry,
    noteName: normalizeNoteName(match.groups.note),
    dynamicVersion: Number.parseInt(match.groups.dynamicVersion, 10),
    roundRobin: match.groups.roundRobin,
  }
}

/**
 * @param {{ displayPath: string, normalizedPath: string, sizeBytes: number | null }} entry
 */
function matchVscoGlockFile(entry) {
  if (!entry.normalizedPath.includes(`${VSCO_ROOT_MARKER}/percussion/glock/`) || !entry.normalizedPath.endsWith(".wav")) {
    return null
  }

  const match = /^glock_(?:medium_)?(?<note>[a-g]#?\d)(?:_v\d+_rr\d+)?\.wav$/.exec(basename(entry.normalizedPath))
  if (!match?.groups) return null

  return {
    ...entry,
    noteName: normalizeNoteName(match.groups.note),
  }
}

/**
 * @param {{ displayPath: string, noteName: string, dynamicLayer?: string, filePrefix: string, instrumentName: string, sizeBytes: number | null }} asset
 */
function toSelectedAsset(asset) {
  return {
    instrumentName: asset.instrumentName,
    noteName: asset.noteName,
    dynamicLayer: asset.dynamicLayer ?? null,
    sourceRelativePath: asset.displayPath,
    outputFileName: `${asset.filePrefix}-${noteNameToSlug(asset.noteName)}.wav`,
    sizeBytes: asset.sizeBytes,
  }
}

/**
 * @param {{ noteName: string }} left
 * @param {{ noteName: string }} right
 */
function compareAssetsByMidi(left, right) {
  return noteNameToMidi(left.noteName) - noteNameToMidi(right.noteName)
}

/**
 * @param {{ dynamicVersion?: number, roundRobin?: string }} left
 * @param {{ dynamicVersion?: number, roundRobin?: string }} right
 */
function compareDynamicAsset(left, right) {
  const dynamicDelta = (left.dynamicVersion ?? 99) - (right.dynamicVersion ?? 99)
  if (dynamicDelta !== 0) return dynamicDelta
  return Number.parseInt(left.roundRobin ?? "99", 10) - Number.parseInt(right.roundRobin ?? "99", 10)
}

/**
 * @param {Map<string, { sampleRate: number, channels: Float32Array[] }>} cache
 * @param {string} sourcePath
 */
async function readDecodedWavFromCache(cache, sourcePath) {
  const cached = cache.get(sourcePath)
  if (cached) return cached

  const decoded = decodeWav(await fs.readFile(sourcePath))
  cache.set(sourcePath, decoded)
  return decoded
}

/**
 * @param {string} resolvedAudioRoot
 * @param {string} sourceRelativePath
 */
function resolveContainedSourcePath(resolvedAudioRoot, sourceRelativePath) {
  const sourcePath = path.resolve(resolvedAudioRoot, sourceRelativePath)
  const sourcePathFromRoot = path.relative(resolvedAudioRoot, sourcePath)
  if (sourcePathFromRoot.startsWith("..") || path.isAbsolute(sourcePathFromRoot)) {
    throw new Error(`Invalid sourceRelativePath outside audioRoot: ${sourceRelativePath}`)
  }
  return sourcePath
}

/**
 * @param {Array<string | { relativePath?: string, path?: string, sizeBytes?: number }>} files
 */
function normalizeEntries(files) {
  return files.map(normalizeEntry).filter((entry) => entry.normalizedPath)
}

/**
 * @param {string | { relativePath?: string, path?: string, sizeBytes?: number }} file
 */
function normalizeEntry(file) {
  const displayPath = typeof file === "string" ? file : file.relativePath ?? file.path ?? ""
  const normalizedPath = normalizePortablePath(displayPath)

  return {
    displayPath: normalizedPath,
    normalizedPath: normalizedPath.toLowerCase(),
    sizeBytes: typeof file === "string" ? null : file.sizeBytes ?? null,
  }
}

/**
 * @param {string} noteName
 */
function normalizeNoteName(noteName) {
  return noteName.toUpperCase()
}

/**
 * @param {string} filePath
 */
function normalizePortablePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/\/+/g, "/")
}

/**
 * @param {string} value
 */
function normalizeObjectPrefixBase(value) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/")
  if (!normalized || normalized.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid Generative.fm object prefix base: ${value}`)
  }
  return normalized
}

/**
 * @param {string} filePath
 */
function basename(filePath) {
  const slashIndex = filePath.lastIndexOf("/")
  return slashIndex === -1 ? filePath : filePath.slice(slashIndex + 1)
}

/**
 * @param {string} noteName
 */
function noteNameToSlug(noteName) {
  return noteName.toLowerCase().replace("#", "-sharp")
}
