// @ts-check

import {
  OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH,
  OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH,
  OBSERVABLE_STREAMS_R2_MANIFEST_URL,
  OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
  OBSERVABLE_STREAMS_R2_PUBLIC_MEDIA_BUCKET,
  OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL,
  OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_OBJECT_KEY,
  OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_URL,
} from "./observable-streams-adaptation.js"

export const GENERATIVE_FM_COLLECTION_PACKAGE_NAME = "@generative-music/pieces-alex-bainter"
export const GENERATIVE_FM_COLLECTION_PACKAGE_VERSION = "5.2.2"
export const GENERATIVE_FM_STATION_PREFIX = "generative-fm-"
export const OBSERVABLE_STREAMS_STATION_ID = "observable-streams-probe"

const GENERATIVE_FM_R2_OBJECT_PREFIX_BASE = "atmosphere/generative-fm"

/**
 * @typedef {object} HostedGenerativeFmPiece
 * @property {string} objectPrefix
 * @property {string | null} sampleIndexPath
 * @property {string | null} sampleBasePath
 * @property {string} sampleIndexObjectKey
 * @property {string} sampleIndexUrl
 * @property {string} manifestUrl
 * @property {ReadonlyArray<string>} hostedSampleGroups
 * @property {string} notice
 * @property {string=} stageCommand
 * @property {string} r2UploadCommand
 */

/** @type {Readonly<Record<string, HostedGenerativeFmPiece>>} */
const hostedGenerativeFmPieces = Object.freeze({
  "observable-streams": Object.freeze({
    objectPrefix: OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
    sampleIndexPath: OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH,
    sampleBasePath: OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH,
    sampleIndexObjectKey: OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_OBJECT_KEY,
    sampleIndexUrl: OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_URL,
    manifestUrl: OBSERVABLE_STREAMS_R2_MANIFEST_URL,
    hostedSampleGroups: Object.freeze([
      "observable-streams__sso-cor-anglais",
      "observable-streams__vsco2-piano-mf",
      "observable-streams__vsco2-violin-arcvib",
    ]),
    notice:
      "Observable Streams by Alex Bainter. MassageLab runs the package with a hosted CC0 VSCO sample adaptation.",
    stageCommand: "npm run atmosphere:samples:stage -- <audio-root>",
    r2UploadCommand: "npm run atmosphere:samples:r2:upload -- <audio-root> --dry-run --include-rendered",
  }),
  aisatsana: firstBatchHostedPiece({
    pieceId: "aisatsana",
    hostedSampleGroups: ["vsco2-piano-mf"],
    notice:
      "aisatsana by Alex Bainter. MassageLab runs the package with a hosted CC0 VSCO piano sample adaptation.",
  }),
  "at-sunrise": firstBatchHostedPiece({
    pieceId: "at-sunrise",
    hostedSampleGroups: ["at-sunrise__vcsl-vibraphone-soft-mallets-mp"],
    notice:
      "At Sunrise by Alex Bainter. MassageLab runs the package with hosted CC0 VCSL vibraphone rendered samples.",
  }),
  "little-bells": firstBatchHostedPiece({
    pieceId: "little-bells",
    hostedSampleGroups: ["little-bells__vsco2-glock"],
    notice:
      "Little Bells by Alex Bainter. MassageLab runs the package with hosted CC0 VSCO glockenspiel rendered samples.",
  }),
})
const hostedSampleGroups = Object.freeze([
  ...hostedGenerativeFmPieces["observable-streams"].hostedSampleGroups,
  ...hostedGenerativeFmPieces["at-sunrise"].hostedSampleGroups,
  ...hostedGenerativeFmPieces["little-bells"].hostedSampleGroups,
])
const hostedSampleGroupSet = new Set(hostedSampleGroups)

/** @typedef {string | string[]} GenerativeFmSampleGroup */

/**
 * Manifest-derived metadata for the Alex Bainter Generative.fm package catalog.
 * The sample names mirror the installed `*.gfm.manifest.json` files so station
 * availability can be decided without importing audio runtime packages during
 * server or test catalog reads.
 *
 * @type {ReadonlyArray<{
 *   id: string,
 *   title: string,
 *   tags: string[],
 *   sampleNameGroups: GenerativeFmSampleGroup[],
 * }>}
 */
export const GENERATIVE_FM_PIECES = Object.freeze([
  {
    id: "420hz-gamma-waves-for-big-brain",
    title: "420hz Gamma Waves for Big Brain",
    tags: ["dream", "electronic", "drone"],
    sampleNameGroups: ["waves", "vsco2-piano-mf", "sso-chorus-male"],
  },
  {
    id: "a-viable-system",
    title: "A Viable System",
    tags: ["acoustic"],
    sampleNameGroups: [
      ["a-viable-system__vsco2-piano-mf", "vsco2-piano-mf"],
      ["a-viable-system__vsco2-contrabass-susvib", "vsco2-contrabass-susvib"],
      ["a-viable-system__vsco2-violin-arcvib", "vsco2-violin-arcvib"],
    ],
  },
  {
    id: "above-the-rain",
    title: "Above the Rain",
    tags: ["drone", "calm", "electronic"],
    sampleNameGroups: [
      ["above-the-rain__sso-chorus-female", "sso-chorus-female"],
      ["above-the-rain__vsco2-trumpet-sus-mf", "vsco2-trumpet-sus-mf"],
    ],
  },
  {
    id: "agua-ravine",
    title: "Agua Ravine",
    tags: ["acoustic"],
    sampleNameGroups: [
      ["agua-ravine__vsco2-piano-mf", "vsco2-piano-mf"],
      ["agua-ravine__vcsl-vibraphone-soft-mallets-mp", "vcsl-vibraphone-soft-mallets-mp"],
    ],
  },
  {
    id: "aisatsana",
    title: "aisatsana (generative remix)",
    tags: ["calm", "acoustic"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "animalia-chordata",
    title: "Animalia Chordata",
    tags: ["noise", "electronic"],
    sampleNameGroups: [
      ["animalia-chordata__whales-dryer", "whales"],
      ["animalia-chordata__whales-wetter", "whales"],
    ],
  },
  {
    id: "apoapsis",
    title: "Apoapsis",
    tags: ["calm", "electronic", "dream"],
    sampleNameGroups: [
      ["apoapsis__vsco2-violins-susvib", "vsco2-violins-susvib"],
      ["apoapsis__vsco2-piano-mf", "vsco2-piano-mf"],
    ],
  },
  {
    id: "at-sunrise",
    title: "At Sunrise",
    tags: ["calm", "dream", "electronic"],
    sampleNameGroups: [["at-sunrise__vcsl-vibraphone-soft-mallets-mp", "vcsl-vibraphone-soft-mallets-mp"]],
  },
  {
    id: "awash",
    title: "Awash",
    tags: ["electronic", "dream"],
    sampleNameGroups: [
      ["awash__vcsl-ocean-drum", "vcsl-ocean-drum"],
      ["awash__dry-guitar-vib", "dry-guitar-vib"],
    ],
  },
  {
    id: "beneath-waves",
    title: "Beneath Waves",
    tags: ["dark", "drone", "electronic"],
    sampleNameGroups: [
      ["beneath-waves__sso-chorus-female", "sso-chorus-female"],
      ["beneath-waves__sso-cor-anglais", "sso-cor-anglais"],
    ],
  },
  {
    id: "bhairav",
    title: "Bhairav",
    tags: ["acoustic"],
    sampleNameGroups: [
      ["bhairav__vsco2-piano-mf", "vsco2-piano-mf"],
      ["bhairav__vsco2-cellos-susvib-mp", "vsco2-cellos-susvib-mp"],
    ],
  },
  {
    id: "buttafingers",
    title: "Buttafingers",
    tags: ["drone", "electronic"],
    sampleNameGroups: ["vcsl-wine-glasses-slow", ["buttafingers__vcsl-claves", "vcsl-claves"]],
  },
  {
    id: "day-dream",
    title: "Day/Dream",
    tags: ["electronic", "calm"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "didgeridoobeats",
    title: "Didgeridoobeats",
    tags: ["electronic"],
    sampleNameGroups: [
      ["didgeridoobeats__vcsl-didgeridoo-sus", "vcsl-didgeridoo-sus"],
      "itslucid-lofi-hats",
      "itslucid-lofi-kick",
      "itslucid-lofi-snare",
    ],
  },
  {
    id: "documentary-films",
    title: "Documentary Films",
    tags: ["drone", "calm"],
    sampleNameGroups: [
      ["documentary-films__vsco2-trumpet-sus-mf", "vsco2-trumpet-sus-mf"],
      ["documentary-films__vsco2-trombone-sus-mf", "vsco2-trombone-sus-mf"],
      ["documentary-films__vsco2-tuba-sus-mf", "vsco2-tuba-sus-mf"],
    ],
  },
  {
    id: "drones",
    title: "Drones",
    tags: ["drone", "electronic"],
    sampleNameGroups: ["vsco2-trumpet-sus-f", "vsco2-trumpet-sus-mf"],
  },
  {
    id: "drones-2",
    title: "Drones II",
    tags: ["drone", "electronic"],
    sampleNameGroups: ["vsco2-violins-susvib"],
  },
  {
    id: "eno-machine",
    title: "Eno Machine",
    tags: ["calm", "acoustic"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "enough",
    title: "Enough",
    tags: ["dark", "electronic"],
    sampleNameGroups: ["sso-cor-anglais"],
  },
  {
    id: "expand-collapse",
    title: "Expand/Collapse",
    tags: ["acoustic", "electronic"],
    sampleNameGroups: [["expand-collapse__vsco2-piano-mf", "vsco2-piano-mf"]],
  },
  {
    id: "eyes-closed",
    title: "Eyes Closed",
    tags: ["electronic", "calm", "dream"],
    sampleNameGroups: ["dan-tranh-gliss-ps", "vsco2-piano-mf"],
  },
  {
    id: "homage",
    title: "Homage",
    tags: ["electronic", "drone", "calm"],
    sampleNameGroups: ["vsco2-piano-mf", ["homage__vsco2-violins-susvib", "vsco2-violins-susvib"]],
  },
  {
    id: "impact",
    title: "Impact",
    tags: ["electronic", "acoustic"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "last-transit",
    title: "Last Transit",
    tags: ["noise", "electronic"],
    sampleNameGroups: [["last-transit__idling-truck", "idling-truck"]],
  },
  {
    id: "lemniscate",
    title: "Lemniscate",
    tags: ["calm", "acoustic"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "little-bells",
    title: "Little Bells",
    tags: ["acoustic"],
    sampleNameGroups: [["little-bells__vsco2-glock", "vsco2-glock"]],
  },
  {
    id: "lullaby",
    title: "Lullaby",
    tags: ["dream", "calm", "electronic"],
    sampleNameGroups: ["vsco2-piano-mf", ["lullaby__birds", "birds"], ["lullaby__explosion", "explosion"]],
  },
  {
    id: "meditation",
    title: "Meditation",
    tags: ["calm"],
    sampleNameGroups: ["kasper-singing-bowls"],
  },
  {
    id: "moment",
    title: "Moment",
    tags: ["calm", "acoustic"],
    sampleNameGroups: [
      ["moment__acoustic-guitar", "acoustic-guitar"],
      ["moment__alex-hum-1", "alex-hum-1"],
      ["moment__alex-hum-2", "alex-hum-2"],
    ],
  },
  {
    id: "nakaii",
    title: "Nakaii",
    tags: ["calm", "electronic"],
    sampleNameGroups: ["vsco2-piano-mf", "vsco2-violins-susvib"],
  },
  {
    id: "neuroplasticity",
    title: "Neuroplasticity",
    tags: ["electronic"],
    sampleNameGroups: ["guitar-namaste", "vsco2-piano-mf"],
  },
  {
    id: "no-refrain",
    title: "No Refrain",
    tags: ["acoustic"],
    sampleNameGroups: [["no-refrain__vsco2-piano-mf", "vsco2-piano-mf"]],
  },
  {
    id: "observable-streams",
    title: "Observable Streams",
    tags: ["acoustic"],
    sampleNameGroups: [
      ["observable-streams__vsco2-piano-mf", "vsco2-piano-mf"],
      ["observable-streams__vsco2-violin-arcvib", "vsco2-violin-arcvib"],
      ["observable-streams__sso-cor-anglais", "sso-cor-anglais"],
    ],
  },
  {
    id: "otherness",
    title: "Otherness",
    tags: ["electronic"],
    sampleNameGroups: ["otherness"],
  },
  {
    id: "oxalis-1",
    title: "Oxalis 1",
    tags: ["acoustic", "calm"],
    sampleNameGroups: [["oxalis-1__vsco2-piano-mf", "vsco2-piano-mf"], ["oxalis-1__vsco2-glock", "vsco2-glock"]],
  },
  {
    id: "peace",
    title: "Peace",
    tags: ["calm", "acoustic"],
    sampleNameGroups: [["peace__native-american-flute-susvib", "native-american-flute-susvib"]],
  },
  {
    id: "pinwheels",
    title: "Pinwheels",
    tags: ["acoustic"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "pulse-code-modulation",
    title: "Pulse-code Modulation",
    tags: ["drone", "electronic", "calm"],
    sampleNameGroups: [
      ["pulse-code-modulation__vsco2-violins-susvib", "vsco2-violins-susvib"],
      ["pulse-code-modulation__vsco2-piano-mf", "vsco2-piano-mf"],
      ["pulse-code-modulation__acoustic-guitar", "acoustic-guitar"],
    ],
  },
  {
    id: "remembering",
    title: "Remembering",
    tags: ["acoustic"],
    sampleNameGroups: [["remembering__vsco2-piano-mf", "vsco2-piano-mf"]],
  },
  {
    id: "return-to-form",
    title: "Return to Form",
    tags: ["electronic"],
    sampleNameGroups: [["return-to-form__vsco2-piano-mf", "vsco2-piano-mf"]],
  },
  {
    id: "ritual",
    title: "Ritual",
    tags: ["drone", "electronic"],
    sampleNameGroups: [
      ["ritual__vcsl-didgeridoo-sus", "vcsl-didgeridoo-sus"],
      ["ritual__vsco2-violins-susvib", "vsco2-violins-susvib"],
      ["ritual__vcsl-bassdrum-hit-ff", "vcsl-bassdrum-hit-ff"],
      ["ritual__vcsl-darbuka-1-f", "vcsl-darbuka-1-f"],
      ["ritual__vcsl-darbuka-2-f", "vcsl-darbuka-2-f"],
      ["ritual__vcsl-darbuka-3-f", "vcsl-darbuka-3-f"],
      ["ritual__vcsl-darbuka-4-f", "vcsl-darbuka-4-f"],
      ["ritual__vcsl-darbuka-5-f", "vcsl-darbuka-5-f"],
    ],
  },
  {
    id: "sevenths",
    title: "Sevenths",
    tags: ["acoustic"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "skyline",
    title: "Skyline",
    tags: ["drone", "electronic"],
    sampleNameGroups: [
      ["skyline__itslucid-lofi-hats", "itslucid-lofi-hats"],
      ["skyline__itslucid-lofi-kick", "itslucid-lofi-kick"],
      ["skyline__itslucid-lofi-snare", "itslucid-lofi-snare"],
      ["skyline__vsco2-violins-susvib", "vsco2-violins-susvib"],
    ],
  },
  {
    id: "soundtrack",
    title: "Soundtrack",
    tags: ["electronic", "drone", "dark"],
    sampleNameGroups: [["soundtrack__vsco2-cellos-susvib-mp", "vsco2-cellos-susvib-mp"], ["soundtrack__vsco2-glock", "vsco2-glock"]],
  },
  {
    id: "splash",
    title: "Splash",
    tags: ["calm"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "spring-again",
    title: "Spring Again",
    tags: ["acoustic"],
    sampleNameGroups: [["spring-again__vsco2-piano-mf", "vsco2-piano-mf"], "vsco2-violins-susvib", "vsco2-cello-susvib-f"],
  },
  {
    id: "stratospheric",
    title: "Stratospheric",
    tags: ["acoustic"],
    sampleNameGroups: [["stratospheric__guitar-coil-spank", "guitar-coil-spank"], ["stratospheric__guitar-dusty", "guitar-dusty"]],
  },
  {
    id: "stream-of-consciousness",
    title: "Stream of Consciousness",
    tags: ["electronic"],
    sampleNameGroups: [
      ["stream-of-consciousness__snare-brush-stir", "snare-brush-stir"],
      "snare-brush-hit-p",
      "ride-brush-p",
      ["stream-of-consciousness__vsco2-piano-mf-reverse", "vsco2-piano-mf"],
      ["stream-of-consciousness__vsco2-piano-mf-low", "vsco2-piano-mf"],
    ],
  },
  {
    id: "substrate",
    title: "Substrate",
    tags: ["electronic", "calm"],
    sampleNameGroups: [["substrate__vsco2-marimba", "vsco2-marimba"], ["substrate__vsco2-piano-mf", "vsco2-piano-mf"]],
  },
  {
    id: "timbral-oscillations",
    title: "Timbral Oscillations",
    tags: ["electronic"],
    sampleNameGroups: [["timbral-oscillations__vsco2-piano-mf", "vsco2-piano-mf"]],
  },
  {
    id: "townsend",
    title: "Townsend",
    tags: ["calm", "acoustic"],
    sampleNameGroups: [["townsend__vsco2-flute-susvib", "vsco2-flute-susvib"], ["townsend__acoustic-guitar-chords-cmaj", "acoustic-guitar-chords-cmaj"]],
  },
  {
    id: "transmission",
    title: "Transmission",
    tags: ["electronic"],
    sampleNameGroups: [["transmission__vsco2-piano-mf", "vsco2-piano-mf"]],
  },
  {
    id: "trees",
    title: "Trees",
    tags: ["acoustic"],
    sampleNameGroups: [["trees__vsco2-piano-mf", "vsco2-piano-mf"]],
  },
  {
    id: "uun",
    title: "Uun",
    tags: ["acoustic"],
    sampleNameGroups: ["vsco2-piano-mf"],
  },
  {
    id: "western-medicine",
    title: "Western Medicine",
    tags: ["electronic"],
    sampleNameGroups: [
      ["western-medicine__guitar-harmonics", "guitar-harmonics"],
      ["western-medicine__vsco2-marimba", "vsco2-marimba"],
      ["western-medicine__vsco2-harp", "vsco2-harp"],
      ["western-medicine__vsco2-piano-mf", "vsco2-piano-mf"],
    ],
  },
  {
    id: "yesterday",
    title: "Yesterday",
    tags: ["calm", "acoustic"],
    sampleNameGroups: [["yesterday__vcsl-tenor-sax-vib", "vcsl-tenor-sax-vib"]],
  },
  {
    id: "zed",
    title: "Zed",
    tags: ["calm", "electronic"],
    sampleNameGroups: [["zed__pad", ""], ["zed__noise", ""]],
  },
])

/** @returns {string[]} */
export function listHostedGenerativeFmSampleGroups() {
  return [...hostedSampleGroups]
}

/** @returns {string[]} */
export function listHostedGenerativeFmPieceIds() {
  return Object.keys(hostedGenerativeFmPieces)
}

/**
 * @param {string} pieceId
 */
export function isHostedGenerativeFmPiece(pieceId) {
  return Boolean(hostedGenerativeFmPieces[pieceId])
}

/**
 * @param {string} pieceId
 * @returns {string}
 */
export function getGenerativeFmStationId(pieceId) {
  return pieceId === "observable-streams" ? OBSERVABLE_STREAMS_STATION_ID : `${GENERATIVE_FM_STATION_PREFIX}${pieceId}`
}

/**
 * Builds MassageLab station entries for every installed Generative.fm piece.
 * Stations are sorted with immediately playable pieces first; sample-pending
 * entries remain visible so the catalog tracks exactly what still needs R2
 * sample hosting before playback can be enabled.
 */
export function createGenerativeFmStations() {
  return GENERATIVE_FM_PIECES.map(createGenerativeFmStation).sort((left, right) => {
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1
    }

    return left.title.localeCompare(right.title)
  })
}

/**
 * @param {typeof GENERATIVE_FM_PIECES[number]} piece
 */
function createGenerativeFmStation(piece) {
  const hostedPiece = hostedGenerativeFmPieces[piece.id]
  const missingSampleGroups = hostedPiece ? [] : findMissingSampleGroups(piece.sampleNameGroups)
  const enabled = Boolean(hostedPiece) || missingSampleGroups.length === 0
  const stationId = getGenerativeFmStationId(piece.id)

  return {
    id: stationId,
    title: piece.title,
    artist: "Alex Bainter",
    sourceType: "generative-fm-piece",
    enabled,
    description: enabled
      ? `A MassageLab-hosted Generative.fm station using ${piece.title} with the current public-media sample index.`
      : `Generative.fm station metadata is ready; playback waits for hosted samples for ${formatSampleGroups(missingSampleGroups)}.`,
    disabledReason: enabled
      ? undefined
      : `Needs hosted samples before playback: ${formatSampleGroups(missingSampleGroups)}.`,
    tags: ["Generative.fm", ...piece.tags, enabled ? "sample-hosted" : "samples pending"],
    attribution: {
      artist: "Alex Bainter",
      license: "MIT",
      sourceUrl: "https://github.com/generative-music/pieces-alex-bainter",
      notice: hostedPiece?.notice ?? `${piece.title} by Alex Bainter. MassageLab runs the generator through the Generative.fm package catalog.`,
    },
    runtime: {
      adapterId: "generative-fm-piece",
      packageName: GENERATIVE_FM_COLLECTION_PACKAGE_NAME,
      packageVersion: GENERATIVE_FM_COLLECTION_PACKAGE_VERSION,
      pieceId: piece.id,
      r2Bucket: OBSERVABLE_STREAMS_R2_PUBLIC_MEDIA_BUCKET,
      r2PublicBaseUrl: OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL,
      ...(hostedPiece ? {
        sampleIndexPath: hostedPiece.sampleIndexPath ?? null,
        sampleBasePath: hostedPiece.sampleBasePath ?? null,
        r2ObjectPrefix: hostedPiece.objectPrefix,
        r2SampleIndexObjectKey: hostedPiece.sampleIndexObjectKey,
        hostedSampleIndexUrl: hostedPiece.sampleIndexUrl,
        hostedManifestUrl: hostedPiece.manifestUrl,
        ...(hostedPiece.stageCommand ? { stageCommand: hostedPiece.stageCommand } : {}),
        r2UploadCommand: hostedPiece.r2UploadCommand,
      } : {}),
      sampleNameGroups: cloneSampleGroups(piece.sampleNameGroups),
      sampleNames: flattenSampleGroups(piece.sampleNameGroups),
      missingSampleGroups: missingSampleGroups.map((group) => [...group]),
    },
  }
}

/**
 * @param {GenerativeFmSampleGroup[]} sampleNameGroups
 * @returns {string[][]}
 */
function findMissingSampleGroups(sampleNameGroups) {
  return sampleNameGroups
    .map(normalizeSampleGroup)
    .filter((group) => group.length > 0 && !group.some((name) => hostedSampleGroupSet.has(name)))
}

/**
 * @param {GenerativeFmSampleGroup} sampleGroup
 * @returns {string[]}
 */
function normalizeSampleGroup(sampleGroup) {
  const names = Array.isArray(sampleGroup) ? sampleGroup : [sampleGroup]
  return names.map((name) => name.trim()).filter(Boolean)
}

/**
 * @param {GenerativeFmSampleGroup[]} sampleNameGroups
 * @returns {GenerativeFmSampleGroup[]}
 */
function cloneSampleGroups(sampleNameGroups) {
  return sampleNameGroups.map((group) => Array.isArray(group) ? [...group] : group)
}

/**
 * @param {GenerativeFmSampleGroup[]} sampleNameGroups
 * @returns {string[]}
 */
function flattenSampleGroups(sampleNameGroups) {
  return [...new Set(sampleNameGroups.flatMap(normalizeSampleGroup))]
}

/**
 * @param {string[][]} sampleGroups
 */
function formatSampleGroups(sampleGroups) {
  return sampleGroups.map((group) => group.join(" or ")).join(", ")
}

/**
 * Builds hosting metadata for the first non-Observable Streams Generative.fm
 * batch. These sample indexes are intentionally piece-specific; source names
 * like `vsco2-piano-mf` must not become globally hosted for every piano piece.
 *
 * @param {{ pieceId: string, hostedSampleGroups: string[], notice: string }} params
 */
function firstBatchHostedPiece({ pieceId, hostedSampleGroups, notice }) {
  const objectPrefix = `${GENERATIVE_FM_R2_OBJECT_PREFIX_BASE}/${pieceId}`

  return Object.freeze({
    objectPrefix,
    sampleIndexPath: null,
    sampleBasePath: null,
    sampleIndexObjectKey: `${objectPrefix}/sample-index.json`,
    sampleIndexUrl: `${OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL}/${objectPrefix}/sample-index.json`,
    manifestUrl: `${OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL}/${objectPrefix}/manifest.json`,
    hostedSampleGroups: Object.freeze([...hostedSampleGroups]),
    notice,
    r2UploadCommand: `npm run atmosphere:samples:generative:r2:upload -- <audio-root> --piece ${pieceId}`,
  })
}
