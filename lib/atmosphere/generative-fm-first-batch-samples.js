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
const SIGNATURE_SAMPLES_ROOT_MARKER = "signature samples"
const SIGNATURE_SOUNDS_BEACH_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_beach_ambience_recordings_cc0/ss_beach_ambience_recordings_cc0`
const SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_choirs_vocals_sfx_teaser_cc0/ss_choirs_vocals_sfx_teaser_cc0`
const SIGNATURE_SOUNDS_SERBIAN_CHOIR_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_serbian_orthodox_choirs_original_recordings_cc0/ss_serbian_orthodox_choirs_original_recordings_cc0`
const SIGNATURE_SOUNDS_BELL_ONE_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_bell_one_kit_key_cc0/ss_bell_one_kit_key_cc0`
const SIGNATURE_SOUNDS_BURIAL_PADS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_burial_pads_cc0/ss_burial_pads_cc0`
const SIGNATURE_SOUNDS_SPIRITUAL_ACOUSTICS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/spiritual+acoustics+cc0+signaturesounds.org/spiritual acoustics cc0 signaturesounds.org`
const SIGNATURE_SOUNDS_UNDERWATER_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/underwater+one+shots+2/underwater one shots`
const SIGNATURE_SOUNDS_SPANISH_GUITAR_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/spanish+guitar/spanish guitar`
const SIGNATURE_SOUNDS_CUTLERY_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_cutlery_percussion_foley_cc0/ss_cutlery_percussion_foley_cc0`
const SIGNATURE_SOUNDS_VHS_DRUM_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/vhs-drumkit+cc0+2/vhs-drumkit cc0`
const SIGNATURE_SOUNDS_LONDON_UNDERGROUND_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/london+underground+rcordings/london underground rcordings`
const SIGNATURE_SOUNDS_KOTOR_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/kotor,+montenegro+-signaturesounds.org/kotor, montenegro -signaturesounds.org`
const SIGNATURE_SOUNDS_FIREWORKS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/distant+fireworks/distant fireworks`
const SIGNATURE_SOUNDS_LOOPS_AMBIENCE_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/loops+of+ambience/loops of ambience`
const SIGNATURE_SOUNDS_BEACH_ROCKS_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/ss_beach-rocks_textures_cc0/ss_beach-rocks_textures_cc0`
const SIGNATURE_SOUNDS_CYMBAL_CRASHES_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/cymbal+crashes+-+signaturesounds.org/cymbal crashes - signaturesounds.org`
const SIGNATURE_SOUNDS_WHITE_NOISE_ROOT_MARKER =
  `${SIGNATURE_SAMPLES_ROOT_MARKER}/white+noise/white noise`
const SOURCE_COLLECTION_TYPE = Object.freeze({
  NOTES: "notes",
  ARRAY: "array",
})
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

    const selectedAssets = selectSourceAssetsForPiece(piece, entries, mappingBySampleNumber)
    const missingNotes = sourceMissingNotesForPiece(piece, selectedAssets)
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
 * @param {ReturnType<typeof createGenerativeFmRenderPlan>["pieces"][number]} piece
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {Map<string, string>} mappingBySampleNumber
 */
function selectSourceAssetsForPiece(piece, entries, mappingBySampleNumber) {
  return sourceSelectionTargetsForPiece(piece).flatMap((target) =>
    selectSourceAssetsForInstrument({
      target,
      entries,
      mappingBySampleNumber,
    })
  )
}

/**
 * @param {ReturnType<typeof createGenerativeFmRenderPlan>["pieces"][number]} piece
 * @param {Array<{ instrumentName: string, noteName: string | null }>} selectedAssets
 */
function sourceMissingNotesForPiece(piece, selectedAssets) {
  const selectedInstrumentNames = new Set(selectedAssets.map((asset) => asset.instrumentName))
  return sourceSelectionTargetsForPiece(piece)
    .filter((target) => !selectedInstrumentNames.has(target.instrumentName))
    .map((target) => ({ instrumentName: target.instrumentName, noteName: null }))
}

/**
 * @param {ReturnType<typeof createGenerativeFmRenderPlan>["pieces"][number]} piece
 */
function sourceSelectionTargetsForPiece(piece) {
  const targets = [
    ...piece.sourceIndexTargets.map((target) => ({
      instrumentName: target.instrumentName,
      sourceInstrumentName: target.sourceInstrumentName,
    })),
    ...piece.renderedTargets.map((target) => ({
      instrumentName: target.sourceInstrumentName,
      sourceInstrumentName: target.sourceInstrumentName,
    })),
  ]
  const seen = new Set()

  return targets.filter((target) => {
    const key = `${target.instrumentName}\0${target.sourceInstrumentName}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * @param {{
 *   target: { instrumentName: string, sourceInstrumentName: string },
 *   entries: ReturnType<typeof normalizeEntries>,
 *   mappingBySampleNumber: Map<string, string>,
 * }} params
 */
function selectSourceAssetsForInstrument({ target, entries, mappingBySampleNumber }) {
  switch (target.sourceInstrumentName) {
    case "waves":
      return selectSignatureBeachWavesAssets(entries, target.instrumentName)
    case "sso-chorus-female":
      return selectSignatureFemaleChorusAssets(entries, target.instrumentName)
    case "sso-chorus-male":
      return selectSignatureMaleChorusAssets(entries, target.instrumentName)
    case "sso-cor-anglais":
      return selectVscoOboeSusAssets(entries, target.instrumentName)
    case "vsco2-piano-mf":
      return selectVscoPianoMfAssets(entries, mappingBySampleNumber, target.instrumentName)
    case "vsco2-contrabass-susvib":
      return selectVscoContrabassSusVibAssets(entries, target.instrumentName)
    case "vsco2-violin-arcvib":
      return selectVscoViolinArcoVibAssets(entries, target.instrumentName)
    case "vsco2-trumpet-sus-mf":
      return selectVscoTrumpetSusAssets(entries, target.instrumentName, 1)
    case "vsco2-trumpet-sus-f":
      return selectVscoTrumpetSusAssets(entries, target.instrumentName, 3)
    case "vsco2-violins-susvib":
      return selectVscoViolinsSusVibAssets(entries, target.instrumentName)
    case "vsco2-cellos-susvib-mp":
      return selectVscoCellosSusVibAssets(entries, target.instrumentName, 1)
    case "vsco2-cello-susvib-f":
      return selectVscoCellosSusVibAssets(entries, target.instrumentName, 3)
    case "vsco2-trombone-sus-mf":
      return selectVscoTromboneSusAssets(entries, target.instrumentName)
    case "vsco2-tuba-sus-mf":
      return selectVscoTubaSusAssets(entries, target.instrumentName)
    case "vsco2-glock":
      return selectVscoGlockAssets(entries, target.instrumentName)
    case "vsco2-marimba":
      return selectVscoMarimbaAssets(entries, target.instrumentName)
    case "vcsl-vibraphone-soft-mallets-mp":
      return selectVcslVibraphoneSoftMalletAssets(entries, target.instrumentName)
    case "vcsl-wine-glasses-slow":
      return selectVcslWineGlassesSlowAssets(entries, target.instrumentName)
    case "vcsl-claves":
      return selectVcslClavesAssets(entries, target.instrumentName)
    case "vcsl-didgeridoo-sus":
      return selectVcslDidgeridooSusAssets(entries, target.instrumentName)
    case "vcsl-bassdrum-hit-ff":
      return selectVcslBassdrumHitFfAssets(entries, target.instrumentName)
    case "vcsl-darbuka-1-f":
    case "vcsl-darbuka-2-f":
    case "vcsl-darbuka-3-f":
    case "vcsl-darbuka-4-f":
    case "vcsl-darbuka-5-f":
      return selectVcslDarbukaHitAssets(entries, target.instrumentName, target.sourceInstrumentName)
    case "vcsl-tenor-sax-vib":
      return selectVcslTenorSaxVibAssets(entries, target.instrumentName)
    case "vcsl-ocean-drum":
      return selectVcslOceanDrumAssets(entries, target.instrumentName)
    case "vsco2-flute-susvib":
    case "native-american-flute-susvib":
      return selectVscoFluteSusVibAssets(entries, target.instrumentName)
    case "vsco2-harp":
      return selectVscoHarpAssets(entries, target.instrumentName)
    case "whales":
      return selectSignatureUnderwaterAssets(entries, target.instrumentName)
    case "dry-guitar-vib":
      return selectSignatureSpiritualAcousticsNoteAssets(entries, target.instrumentName, [
        "C3", "D#3", "G3", "A#3", "C4", "D#4", "G4", "A#4",
      ])
    case "dan-tranh-gliss-ps":
      return selectSignatureSpanishGuitarArrayAssets(entries, target.instrumentName)
    case "itslucid-lofi-hats":
      return selectSignatureCutleryPercussionAssets(entries, target.instrumentName)
    case "itslucid-lofi-kick":
      return selectSignatureVhsDrumAssets(entries, target.instrumentName, "bdr")
    case "itslucid-lofi-snare":
      return selectSignatureVhsDrumAssets(entries, target.instrumentName, "sdr")
    case "kasper-singing-bowls":
      return selectSignatureBellOneAssets(entries, target.instrumentName)
    case "idling-truck":
      return selectSignatureTransitEngineAssets(entries, target.instrumentName)
    case "birds":
      return selectSignatureBirdsAssets(entries, target.instrumentName)
    case "explosion":
      return selectSignatureFireworksAssets(entries, target.instrumentName)
    case "acoustic-guitar":
      return selectSignatureSpiritualAcousticsNoteAssets(entries, target.instrumentName, [
        "C2", "E2", "G2", "C3", "E3", "G3", "C4", "E4", "G4",
      ])
    case "alex-hum-1":
      return selectSignatureChoirTeaserHumAssets(entries, target.instrumentName)
    case "alex-hum-2":
      return selectSignatureSerbianChoirAssets(entries, target.instrumentName)
    case "guitar-namaste":
      return selectSignatureSpiritualAcousticsNoteAssets(entries, target.instrumentName, ["G2", "C3", "G3", "C4"])
    case "otherness":
      return selectSignatureBurialPadAssets(entries, target.instrumentName, [
        "C2", "D#2", "F#2", "A2", "C3", "D#3", "F#3", "A3",
      ])
    case "guitar-coil-spank":
      return selectSignatureAmbientGuitarLoopAssets(entries, target.instrumentName, 0)
    case "guitar-dusty":
      return selectSignatureAmbientGuitarLoopAssets(entries, target.instrumentName, 4)
    case "snare-brush-stir":
    case "snare-brush-hit-p":
      return selectSignatureBeachRockPercussionAssets(entries, target.instrumentName)
    case "ride-brush-p":
      return selectSignatureCymbalCrashAssets(entries, target.instrumentName)
    case "acoustic-guitar-chords-cmaj":
      return selectSignatureSpanishGuitarArrayAssets(entries, target.instrumentName)
    case "guitar-harmonics":
      return selectSignatureSpiritualAcousticsNoteAssets(entries, target.instrumentName, ["C3", "C4", "G4", "C5"])
    case "zed__pad":
      return selectSignatureBurialPadAssets(entries, target.instrumentName, [
        "C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4",
      ])
    case "zed__noise":
      return selectSignatureWhiteNoiseAssets(entries, target.instrumentName)
    default:
      throw new Error(`Unsupported Generative.fm source instrument: ${target.sourceInstrumentName}`)
  }
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {Map<string, string>} mappingBySampleNumber
 * @param {string} instrumentName
 */
function selectVscoPianoMfAssets(entries, mappingBySampleNumber, instrumentName = "vsco2-piano-mf") {
  return entries
    .map((entry) => matchVscoPianoMfFile(entry, mappingBySampleNumber))
    .filter(Boolean)
    .filter((asset) => asset.dynamicLayer === "2" && asset.roundRobin === "1")
    .sort(compareAssetsByMidi)
    .map((asset) => toSelectedAsset({
      ...asset,
      instrumentName,
      filePrefix: instrumentName,
    }))
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVcslVibraphoneSoftMalletAssets(entries, instrumentName = "vcsl-vibraphone-soft-mallets-mp") {
  const bestByNote = new Map()
  const matches = entries.map(matchVcslVibraphoneSoftMalletFile).filter(Boolean)

  for (const match of matches) {
    const existing = bestByNote.get(match.noteName)
    if (!existing || comparePreferredAsset(match, existing) < 0) {
      bestByNote.set(match.noteName, match)
    }
  }

  return [...bestByNote.values()]
    .sort(compareAssetsByMidi)
    .map((asset) => toSelectedAsset({
      ...asset,
      instrumentName,
      dynamicLayer: `v${asset.dynamicVersion}`,
      filePrefix: instrumentName,
    }))
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoGlockAssets(entries, instrumentName = "vsco2-glock") {
  return entries
    .map(matchVscoGlockFile)
    .filter(Boolean)
    .sort(compareAssetsByMidi)
    .map((asset) => toSelectedAsset({
      ...asset,
      instrumentName,
      dynamicLayer: "medium",
      filePrefix: instrumentName,
    }))
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureBeachWavesAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_BEACH_ROOT_MARKER],
    filePattern: /^beach_ambience_(?<order>\d+)\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureFemaleChorusAssets(entries, instrumentName) {
  return selectFixedNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER],
    filePattern: /^choirs_children_ambience_-(?<order>\d+)\.wav$/,
    notes: ["C5", "D5", "E5", "G5", "C6"],
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureMaleChorusAssets(entries, instrumentName) {
  return selectFixedNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER],
    filePattern: /^men_of[ _]choirs_(?<order>\d+)_(?:build-up_)?(?:key_)?d\.wav$/,
    notes: ["D3", "D4", "D5", "D6"],
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoOboeSusAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/woodwinds/oboe/sus/`],
      filePattern: /^oboe_sus_(?<note>[a-g]#?\d)_v(?<variant>\d+)_main\.wav$/,
      preferredVariant: 1,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoContrabassSusVibAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/strings/solo contrabass/susvib/`],
      filePattern: /^bkctbss_susvib_(?<note>[a-g]#?\d)_v(?<variant>\d+)_rr(?<roundRobin>\d+)\.wav$/,
      preferredVariant: 1,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoViolinArcoVibAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/strings/solo violin/arco vib/`],
      filePattern: /^llvln_arcovib_(?<note>[a-g]#?\d)_(?<dynamic>f|p)\.wav$/,
      preferredDynamic: "p",
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 * @param {number} preferredVariant
 */
function selectVscoTrumpetSusAssets(entries, instrumentName, preferredVariant) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/brass/trumpet/sus/`],
      filePattern: /^sum_shtrumpet_sus_(?<note>[a-g]#?\d)_v(?<variant>\d+)_rr(?<roundRobin>\d+)\.wav$/,
      preferredVariant,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoViolinsSusVibAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/strings/violin section/susvib/`],
      filePattern: /^vlnens_susvib_(?<note>[a-g]#?\d)_v(?<variant>\d+)\.wav$/,
      preferredVariant: 1,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 * @param {number} preferredVariant
 */
function selectVscoCellosSusVibAssets(entries, instrumentName, preferredVariant) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/strings/cello section/susvib/`],
      filePattern: /^susvib_(?<note>[a-g]#?\d)_v(?<variant>\d+)_(?<roundRobin>\d+)\.wav$/,
      preferredVariant,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoTromboneSusAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/brass/tenor trombone/sus/`],
      filePattern: /^tenortbn_sus_(?<note>[a-g]#?\d)_v(?<variant>\d+)_(?<roundRobin>\d+)\.wav$/,
      preferredVariant: 1,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoTubaSusAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/brass/tuba/sus/`],
      filePattern: /^tuba3_sus_(?<note>[a-g]#?\d)_v(?<variant>\d+)_rr(?<roundRobin>\d+)_mid\.wav$/,
      preferredVariant: 1,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoMarimbaAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/percussion/marimba/`],
      filePattern: /^marimba_hit_outrigger_(?<note>[a-g]#?\d)_loud_01\.wav$/,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVcslWineGlassesSlowAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VCSL_ROOT_MARKER}/idiophones/friction idiophones/wine glasses/sustains/slow/`],
      filePattern: /^glass\d+_(?<note>[a-g]#?\d)_slow_(?<variant>\d+)_main\.wav$/,
      preferredVariant: 1,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVcslClavesAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [`${VCSL_ROOT_MARKER}/idiophones/struck idiophones/claves/`],
    filePattern: /^claves\d+_hit_v(?<order>\d+)_rr\d+_mid\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVcslDidgeridooSusAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [`${VCSL_ROOT_MARKER}/aerophones/lip aerophones/didgeridoo/`],
    filePattern: /^didgeridoo1_sus(?<order>\d+)_main\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVcslBassdrumHitFfAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [`${VCSL_ROOT_MARKER}/membranophones/struck membranophones/bass drum 2/`],
    filePattern: /^bassdrum_hit_ff\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 * @param {string} sourceInstrumentName
 */
function selectVcslDarbukaHitAssets(entries, instrumentName, sourceInstrumentName) {
  const darbukaId = /^vcsl-darbuka-(?<id>\d)-f$/.exec(sourceInstrumentName)?.groups?.id
  if (!darbukaId) return []

  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [`${VCSL_ROOT_MARKER}/membranophones/struck membranophones/darbuka/`],
    filePattern: new RegExp(`^darbuka_${darbukaId}_hit_vl2_rr(?<order>\\d+)\\.wav$`),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVcslTenorSaxVibAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VCSL_ROOT_MARKER}/aerophones/reed aerophones/tenor saxophone/vibrato/`],
      filePattern: /^bretttenor_vib_main_(?<note>[a-g]#?\d)_var(?<variant>\d+)\.wav$/,
      preferredVariant: 1,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVcslOceanDrumAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [`${VCSL_ROOT_MARKER}/membranophones/other membranophones/ocean drum/`],
    filePattern: /^oceandrum_sus_(?<order>\d+)_mid\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoFluteSusVibAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/woodwinds/flute/susvib/`],
      filePattern: /^ldflute_susvib_(?<note>[a-g]#?\d)_v(?<variant>\d+)_(?<roundRobin>\d+)\.wav$/,
      preferredVariant: 1,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectVscoHarpAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [`${VSCO_ROOT_MARKER}/strings/harp/`],
      filePattern: /^ksharp_(?<note>[a-g]#?\d)_(?<dynamic>mf|mp|f)\.wav$/,
      preferredDynamic: "mf",
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureUnderwaterAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_UNDERWATER_ROOT_MARKER],
    filePattern: /^underwater one shots(?:-(?<order>\d+))?\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 * @param {string[]} notes
 */
function selectSignatureSpiritualAcousticsNoteAssets(entries, instrumentName, notes) {
  return selectFixedNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_SPIRITUAL_ACOUSTICS_ROOT_MARKER],
    filePattern: /^spiritual acoustics loop (?<order>\d+)\.wav$/,
    notes,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureSpanishGuitarArrayAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_SPANISH_GUITAR_ROOT_MARKER],
    filePattern: /^spanish guitars \(signaturesounds\.org\).*\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureCutleryPercussionAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_CUTLERY_ROOT_MARKER],
    filePattern: /^cutlery_percussion_(?<order>\d+)\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 * @param {"bdr" | "sdr"} drumPrefix
 */
function selectSignatureVhsDrumAssets(entries, instrumentName, drumPrefix) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_VHS_DRUM_ROOT_MARKER],
    filePattern: new RegExp(`^${drumPrefix}-(?<order>\\d+)\\.wav$`),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureBellOneAssets(entries, instrumentName) {
  return selectBestNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    matchFile: (entry) => matchNoteFile(entry, {
      pathIncludes: [SIGNATURE_SOUNDS_BELL_ONE_ROOT_MARKER],
      filePattern: /^bell_one_shot_\s*(?<note>[a-g]#?\d)\.wav$/,
    }),
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureTransitEngineAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_LONDON_UNDERGROUND_ROOT_MARKER],
    filePattern: /^train engine revving up and track noises\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureBirdsAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_KOTOR_ROOT_MARKER],
    filePattern: /^kotor, montenegro - birds singing in the evening\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureFireworksAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_FIREWORKS_ROOT_MARKER],
    filePattern: /^far away fireworks-(?<order>\d+)\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureChoirTeaserHumAssets(entries, instrumentName) {
  return selectFixedNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_CHOIR_TEASER_ROOT_MARKER],
    filePattern: /^choirs_children_ambience_-(?<order>\d+)\.wav$/,
    notes: ["C2", "E2", "G2", "C3", "E3", "G3", "C4", "E4", "G4"],
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureSerbianChoirAssets(entries, instrumentName) {
  return selectFixedNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_SERBIAN_CHOIR_ROOT_MARKER],
    filePattern: /^choir_serbianorthodox_ambience_?-?(?<order>\d+)?\.wav$/,
    notes: ["C2", "E2", "G2", "C3", "E3", "G3", "C4", "E4", "G4"],
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 * @param {string[]} notes
 */
function selectSignatureBurialPadAssets(entries, instrumentName, notes) {
  return selectFixedNoteAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_BURIAL_PADS_ROOT_MARKER],
    filePattern: /^burial_pad_long_(?<order>\d+)\.wav$/,
    notes,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 * @param {number} offset
 */
function selectSignatureAmbientGuitarLoopAssets(entries, instrumentName, offset) {
  const assets = selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [`${SIGNATURE_SOUNDS_LOOPS_AMBIENCE_ROOT_MARKER}/guitars/`],
    filePattern: /^(?:ambient|amient) guitars loop (?<order>\d+)(?:-\d+)? \d+bpm\.wav$/,
  })
  if (assets.length === 0 || offset <= 0) return assets
  return [...assets.slice(offset), ...assets.slice(0, offset)]
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureBeachRockPercussionAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_BEACH_ROCKS_ROOT_MARKER],
    filePattern: /^beach_rocks_percussion_one_shots_textures_(?<order>\d+)\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureCymbalCrashAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_CYMBAL_CRASHES_ROOT_MARKER],
    filePattern: /^cymbal crash (?<order>\d+)\.wav$/,
  })
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {string} instrumentName
 */
function selectSignatureWhiteNoiseAssets(entries, instrumentName) {
  return selectArrayAssets(entries, {
    instrumentName,
    filePrefix: instrumentName,
    pathIncludes: [SIGNATURE_SOUNDS_WHITE_NOISE_ROOT_MARKER],
    filePattern: /^white noise(?:-(?<order>\d+))?\.wav$/,
  })
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
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {{ instrumentName: string, filePrefix: string, matchFile: (entry: ReturnType<typeof normalizeEntry>) => null | ({ displayPath: string, normalizedPath: string, sizeBytes: number | null, noteName: string, dynamicLayer?: string, priority?: number, roundRobin?: string }) }} params
 */
function selectBestNoteAssets(entries, { instrumentName, filePrefix, matchFile }) {
  const bestByNote = new Map()
  const matches = entries.map(matchFile).filter(Boolean)

  for (const match of matches) {
    const existing = bestByNote.get(match.noteName)
    if (!existing || comparePreferredAsset(match, existing) < 0) {
      bestByNote.set(match.noteName, match)
    }
  }

  return [...bestByNote.values()]
    .sort(compareAssetsByMidi)
    .map((asset) => toSelectedAsset({
      ...asset,
      instrumentName,
      filePrefix,
    }))
}

/**
 * @param {ReturnType<typeof normalizeEntry>} entry
 * @param {{ pathIncludes: string[], filePattern: RegExp, preferredVariant?: number, preferredDynamic?: string }} params
 */
function matchNoteFile(entry, { pathIncludes, filePattern, preferredVariant, preferredDynamic }) {
  if (!entry.normalizedPath.endsWith(".wav") || !pathIncludes.every((part) => entry.normalizedPath.includes(part))) {
    return null
  }

  const match = filePattern.exec(basename(entry.normalizedPath))
  if (!match?.groups) return null

  const variant = match.groups.variant ? Number.parseInt(match.groups.variant, 10) : null
  const dynamic = match.groups.dynamic ?? null
  const priority = variant !== null && preferredVariant !== undefined
    ? Math.abs(variant - preferredVariant)
    : dynamic && preferredDynamic
      ? dynamic === preferredDynamic ? 0 : 1
      : 0

  return {
    ...entry,
    noteName: normalizeNoteName(match.groups.note),
    dynamicLayer: dynamic ?? (variant !== null ? `v${variant}` : null),
    priority,
    roundRobin: match.groups.roundRobin ?? null,
  }
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {{ instrumentName: string, filePrefix: string, pathIncludes: string[], filePattern: RegExp }} params
 */
function selectArrayAssets(entries, { instrumentName, filePrefix, pathIncludes, filePattern }) {
  return entries
    .map((entry) => matchArrayFile(entry, { pathIncludes, filePattern }))
    .filter(Boolean)
    .sort(compareArrayAssets)
    .map((asset) => toArraySelectedAsset({
      ...asset,
      instrumentName,
      filePrefix,
    }))
}

/**
 * @param {ReturnType<typeof normalizeEntries>} entries
 * @param {{ instrumentName: string, filePrefix: string, pathIncludes: string[], filePattern: RegExp, notes: string[] }} params
 */
function selectFixedNoteAssets(entries, { instrumentName, filePrefix, pathIncludes, filePattern, notes }) {
  return entries
    .map((entry) => matchArrayFile(entry, { pathIncludes, filePattern }))
    .filter(Boolean)
    .sort(compareArrayAssets)
    .slice(0, notes.length)
    .map((asset, index) => toSelectedAsset({
      ...asset,
      instrumentName,
      filePrefix,
      noteName: notes[index],
      dynamicLayer: `take-${asset.order ?? index + 1}`,
    }))
}

/**
 * @param {ReturnType<typeof normalizeEntry>} entry
 * @param {{ pathIncludes: string[], filePattern: RegExp }} params
 */
function matchArrayFile(entry, { pathIncludes, filePattern }) {
  if (!entry.normalizedPath.endsWith(".wav") || !pathIncludes.every((part) => entry.normalizedPath.includes(part))) {
    return null
  }

  const match = filePattern.exec(basename(entry.normalizedPath))
  if (!match) return null

  return {
    ...entry,
    order: match.groups?.order ? Number.parseInt(match.groups.order, 10) : 0,
  }
}

/**
 * @param {{ displayPath: string, noteName: string, dynamicLayer?: string | null, filePrefix: string, instrumentName: string, collectionType?: "notes" | "array", sizeBytes: number | null }} asset
 */
function toSelectedAsset(asset) {
  return {
    instrumentName: asset.instrumentName,
    noteName: asset.noteName,
    collectionType: asset.collectionType ?? SOURCE_COLLECTION_TYPE.NOTES,
    dynamicLayer: asset.dynamicLayer ?? null,
    sourceRelativePath: asset.displayPath,
    outputFileName: `${asset.filePrefix}-${noteNameToSlug(asset.noteName)}.wav`,
    sizeBytes: asset.sizeBytes,
  }
}

/**
 * @param {{ displayPath: string, normalizedPath: string, order?: number, filePrefix: string, instrumentName: string, sizeBytes: number | null }} asset
 */
function toArraySelectedAsset(asset) {
  return {
    instrumentName: asset.instrumentName,
    noteName: null,
    collectionType: SOURCE_COLLECTION_TYPE.ARRAY,
    dynamicLayer: asset.order ? `take-${asset.order}` : null,
    sourceRelativePath: asset.displayPath,
    outputFileName: `${asset.filePrefix}-${slugifyFileStem(basename(asset.normalizedPath).replace(/\.wav$/i, ""))}.wav`,
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
 * @param {{ priority?: number | null, dynamicVersion?: number, roundRobin?: string | null, normalizedPath?: string }} left
 * @param {{ priority?: number | null, dynamicVersion?: number, roundRobin?: string | null, normalizedPath?: string }} right
 */
function comparePreferredAsset(left, right) {
  const priorityDelta = (left.priority ?? left.dynamicVersion ?? 99) - (right.priority ?? right.dynamicVersion ?? 99)
  if (priorityDelta !== 0) return priorityDelta

  const roundRobinDelta = Number.parseInt(left.roundRobin ?? "99", 10) - Number.parseInt(right.roundRobin ?? "99", 10)
  if (roundRobinDelta !== 0) return roundRobinDelta

  return (left.normalizedPath ?? "").localeCompare(right.normalizedPath ?? "")
}

/**
 * @param {{ order?: number, normalizedPath: string }} left
 * @param {{ order?: number, normalizedPath: string }} right
 */
function compareArrayAssets(left, right) {
  const orderDelta = (left.order ?? 0) - (right.order ?? 0)
  if (orderDelta !== 0) return orderDelta
  return left.normalizedPath.localeCompare(right.normalizedPath)
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
  return files.map(normalizeEntry).filter((entry) => entry.normalizedPath && !isIgnoredSampleInventoryPath(entry.normalizedPath))
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
 * Excludes archive sidecar files that can be present in downloaded packs but
 * are not real source audio for a browser-hosted Generative.fm sample index.
 *
 * @param {string} normalizedPath
 */
function isIgnoredSampleInventoryPath(normalizedPath) {
  return normalizedPath.includes("/__macosx/") || basename(normalizedPath).startsWith("._")
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
 * @param {string} value
 */
function slugifyFileStem(value) {
  return value
    .toLowerCase()
    .replace(/#/g, "-sharp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * @param {string} noteName
 */
function noteNameToSlug(noteName) {
  return noteName.toLowerCase().replace(/#/g, "-sharp")
}
