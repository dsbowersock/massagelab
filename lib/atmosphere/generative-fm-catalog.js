// @ts-check

import {
  OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH,
  OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH,
  OBSERVABLE_STREAMS_R2_MANIFEST_URL,
  OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
  OBSERVABLE_STREAMS_R2_OPUS_MANIFEST_OBJECT_KEY,
  OBSERVABLE_STREAMS_R2_OPUS_SAMPLE_INDEX_OBJECT_KEY,
  OBSERVABLE_STREAMS_R2_PUBLIC_MEDIA_BUCKET,
  OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL,
  OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_OBJECT_KEY,
  OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_URL,
} from "./observable-streams-adaptation.js"
import { WEB_AUDIO_SIDECAR_FORMATS } from "./web-audio-format-pilot.js"

export const GENERATIVE_FM_COLLECTION_PACKAGE_NAME = "@generative-music/pieces-alex-bainter"
export const GENERATIVE_FM_COLLECTION_PACKAGE_VERSION = "5.2.2"
export const GENERATIVE_FM_STATION_PREFIX = "generative-fm-"
export const OBSERVABLE_STREAMS_STATION_ID = "observable-streams-probe"

const GENERATIVE_FM_R2_OBJECT_PREFIX_BASE = "atmosphere/generative-fm"
export const GENERATIVE_FM_SOURCE_INDEX_ROLLOUT_SAMPLE_GROUPS = Object.freeze({
  "420hz-gamma-waves-for-big-brain": Object.freeze(["waves", "vsco2-piano-mf", "sso-chorus-male"]),
  "a-viable-system": Object.freeze(["vsco2-piano-mf", "vsco2-contrabass-susvib", "vsco2-violin-arcvib"]),
  "above-the-rain": Object.freeze(["sso-chorus-female", "vsco2-trumpet-sus-mf"]),
  "agua-ravine": Object.freeze(["vsco2-piano-mf", "vcsl-vibraphone-soft-mallets-mp"]),
  apoapsis: Object.freeze(["vsco2-violins-susvib", "vsco2-piano-mf"]),
  "beneath-waves": Object.freeze(["sso-chorus-female", "sso-cor-anglais"]),
  bhairav: Object.freeze(["vsco2-piano-mf", "vsco2-cellos-susvib-mp"]),
  buttafingers: Object.freeze(["vcsl-wine-glasses-slow", "vcsl-claves"]),
  "documentary-films": Object.freeze(["vsco2-trumpet-sus-mf", "vsco2-trombone-sus-mf", "vsco2-tuba-sus-mf"]),
  drones: Object.freeze(["vsco2-trumpet-sus-f", "vsco2-trumpet-sus-mf"]),
  "drones-2": Object.freeze(["vsco2-violins-susvib"]),
  enough: Object.freeze(["sso-cor-anglais"]),
  "expand-collapse": Object.freeze(["vsco2-piano-mf"]),
  homage: Object.freeze(["vsco2-piano-mf", "vsco2-violins-susvib"]),
  nakaii: Object.freeze(["vsco2-piano-mf", "vsco2-violins-susvib"]),
  "oxalis-1": Object.freeze(["vsco2-piano-mf", "vsco2-glock"]),
  remembering: Object.freeze(["vsco2-piano-mf"]),
  "return-to-form": Object.freeze(["vsco2-piano-mf"]),
  ritual: Object.freeze([
    "vcsl-didgeridoo-sus",
    "vsco2-violins-susvib",
    "vcsl-bassdrum-hit-ff",
    "vcsl-darbuka-1-f",
    "vcsl-darbuka-2-f",
    "vcsl-darbuka-3-f",
    "vcsl-darbuka-4-f",
    "vcsl-darbuka-5-f",
  ]),
  soundtrack: Object.freeze(["vsco2-cellos-susvib-mp", "vsco2-glock"]),
  splash: Object.freeze(["vsco2-piano-mf"]),
  "spring-again": Object.freeze(["vsco2-piano-mf", "vsco2-violins-susvib", "vsco2-cello-susvib-f"]),
  substrate: Object.freeze(["vsco2-marimba", "vsco2-piano-mf"]),
  "timbral-oscillations": Object.freeze(["vsco2-piano-mf"]),
  yesterday: Object.freeze(["vcsl-tenor-sax-vib"]),
})
export const GENERATIVE_FM_REMAINING_GENERATOR_SAMPLE_GROUPS = Object.freeze({
  "animalia-chordata": Object.freeze(["whales"]),
  awash: Object.freeze(["vcsl-ocean-drum", "dry-guitar-vib"]),
  didgeridoobeats: Object.freeze([
    "vcsl-didgeridoo-sus",
    "itslucid-lofi-hats",
    "itslucid-lofi-kick",
    "itslucid-lofi-snare",
  ]),
  "eyes-closed": Object.freeze(["dan-tranh-gliss-ps", "vsco2-piano-mf"]),
  "last-transit": Object.freeze(["idling-truck"]),
  lullaby: Object.freeze(["vsco2-piano-mf", "birds", "explosion"]),
  meditation: Object.freeze(["kasper-singing-bowls"]),
  moment: Object.freeze(["acoustic-guitar", "alex-hum-1", "alex-hum-2"]),
  neuroplasticity: Object.freeze(["guitar-namaste", "vsco2-piano-mf"]),
  otherness: Object.freeze(["otherness"]),
  peace: Object.freeze(["native-american-flute-susvib"]),
  "pulse-code-modulation": Object.freeze(["vsco2-violins-susvib", "vsco2-piano-mf", "acoustic-guitar"]),
  skyline: Object.freeze([
    "itslucid-lofi-hats",
    "itslucid-lofi-kick",
    "itslucid-lofi-snare",
    "vsco2-violins-susvib",
  ]),
  stratospheric: Object.freeze(["guitar-coil-spank", "guitar-dusty"]),
  "stream-of-consciousness": Object.freeze([
    "snare-brush-stir",
    "snare-brush-hit-p",
    "ride-brush-p",
    "vsco2-piano-mf",
  ]),
  townsend: Object.freeze(["vsco2-flute-susvib", "acoustic-guitar-chords-cmaj"]),
  "western-medicine": Object.freeze(["guitar-harmonics", "vsco2-marimba", "vsco2-harp", "vsco2-piano-mf"]),
  zed: Object.freeze(["zed__pad", "zed__noise"]),
})

/**
 * @typedef {object} HostedGenerativeFmPiece
 * @property {string} objectPrefix
 * @property {string | null} sampleIndexPath
 * @property {string | null} sampleBasePath
 * @property {string} sampleIndexObjectKey
 * @property {string=} opusSampleIndexObjectKey
 * @property {string=} opusManifestObjectKey
 * @property {string} sampleIndexUrl
 * @property {string} manifestUrl
 * @property {{ opus?: string, aac?: string, mp3?: string }=} sampleIndexFormatUrls
 * @property {{ opus?: string, aac?: string, mp3?: string }=} manifestFormatUrls
 * @property {ReadonlyArray<string>} hostedSampleGroups
 * @property {string} notice
 * @property {string=} stageCommand
 * @property {string} r2UploadCommand
 * @property {string=} r2WebAudioUploadCommand
 */

/** @type {Readonly<Record<string, HostedGenerativeFmPiece>>} */
const hostedGenerativeFmPieces = Object.freeze({
  "observable-streams": Object.freeze({
    objectPrefix: OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
    sampleIndexPath: OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH,
    sampleBasePath: OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH,
    sampleIndexObjectKey: OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_OBJECT_KEY,
    opusSampleIndexObjectKey: OBSERVABLE_STREAMS_R2_OPUS_SAMPLE_INDEX_OBJECT_KEY,
    opusManifestObjectKey: OBSERVABLE_STREAMS_R2_OPUS_MANIFEST_OBJECT_KEY,
    sampleIndexUrl: OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_URL,
    manifestUrl: OBSERVABLE_STREAMS_R2_MANIFEST_URL,
    sampleIndexFormatUrls: createWebAudioFormatMetadataUrls({
      objectPrefix: OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
      metadataBaseName: "sample-index",
    }),
    manifestFormatUrls: createWebAudioFormatMetadataUrls({
      objectPrefix: OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
      metadataBaseName: "manifest",
    }),
    hostedSampleGroups: Object.freeze([
      "observable-streams__sso-cor-anglais",
      "observable-streams__vsco2-piano-mf",
      "observable-streams__vsco2-violin-arcvib",
    ]),
    notice: "",
    stageCommand: "npm run atmosphere:samples:stage -- <audio-root>",
    r2UploadCommand: "npm run atmosphere:samples:r2:upload -- <audio-root> --dry-run --include-rendered",
    r2WebAudioUploadCommand: "npm run atmosphere:samples:web-audio:r2:upload -- <audio-root> --dry-run",
  }),
  aisatsana: hostedBatchPiece({
    pieceId: "aisatsana",
    hostedSampleGroups: ["vsco2-piano-mf"],
  }),
  "day-dream": hostedBatchPiece({
    pieceId: "day-dream",
    hostedSampleGroups: ["vsco2-piano-mf"],
  }),
  "eno-machine": hostedBatchPiece({
    pieceId: "eno-machine",
    hostedSampleGroups: ["vsco2-piano-mf"],
  }),
  impact: hostedBatchPiece({
    pieceId: "impact",
    hostedSampleGroups: ["vsco2-piano-mf"],
  }),
  lemniscate: hostedBatchPiece({
    pieceId: "lemniscate",
    hostedSampleGroups: ["vsco2-piano-mf"],
  }),
  pinwheels: hostedBatchPiece({
    pieceId: "pinwheels",
    hostedSampleGroups: ["vsco2-piano-mf"],
  }),
  sevenths: hostedBatchPiece({
    pieceId: "sevenths",
    hostedSampleGroups: ["vsco2-piano-mf"],
  }),
  uun: hostedBatchPiece({
    pieceId: "uun",
    hostedSampleGroups: ["vsco2-piano-mf"],
  }),
  "at-sunrise": hostedBatchPiece({
    pieceId: "at-sunrise",
    hostedSampleGroups: ["at-sunrise__vcsl-vibraphone-soft-mallets-mp"],
  }),
  "little-bells": hostedBatchPiece({
    pieceId: "little-bells",
    hostedSampleGroups: ["little-bells__vsco2-glock"],
  }),
  "no-refrain": hostedBatchPiece({
    pieceId: "no-refrain",
    hostedSampleGroups: ["no-refrain__vsco2-piano-mf"],
  }),
  transmission: hostedBatchPiece({
    pieceId: "transmission",
    hostedSampleGroups: ["transmission__vsco2-piano-mf"],
  }),
  trees: hostedBatchPiece({
    pieceId: "trees",
    hostedSampleGroups: ["trees__vsco2-piano-mf"],
  }),
  ...Object.fromEntries(
    Object.entries(GENERATIVE_FM_SOURCE_INDEX_ROLLOUT_SAMPLE_GROUPS).map(([pieceId, hostedSampleGroups]) => [
      pieceId,
      hostedBatchPiece({ pieceId, hostedSampleGroups }),
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(GENERATIVE_FM_REMAINING_GENERATOR_SAMPLE_GROUPS).map(([pieceId, hostedSampleGroups]) => [
      pieceId,
      hostedBatchPiece({ pieceId, hostedSampleGroups }),
    ]),
  ),
})
const hostedSampleGroups = Object.freeze([
  ...hostedGenerativeFmPieces["observable-streams"].hostedSampleGroups,
  ...hostedGenerativeFmPieces["at-sunrise"].hostedSampleGroups,
  ...hostedGenerativeFmPieces["little-bells"].hostedSampleGroups,
  ...hostedGenerativeFmPieces["no-refrain"].hostedSampleGroups,
  ...hostedGenerativeFmPieces.transmission.hostedSampleGroups,
  ...hostedGenerativeFmPieces.trees.hostedSampleGroups,
])
const hostedSampleGroupSet = new Set(hostedSampleGroups)

/** @typedef {string | string[]} GenerativeFmSampleGroup */

/**
 * Listener-facing descriptions keep the station catalog useful without
 * exposing hosting, package, or sample-index implementation details.
 *
 * @type {Readonly<Record<string, string>>}
 */
const GENERATIVE_FM_LISTENER_DESCRIPTIONS = Object.freeze({
  "420hz-gamma-waves-for-big-brain":
    "A bright, gently pulsing mix of surf, soft piano tones, and distant choral color for an alert but calm room.",
  "a-viable-system":
    "Slow piano, bowed strings, and deep bass notes move in a spacious, steady pattern with a grounded feel.",
  "above-the-rain":
    "Soft brass and airy choir tones hover above a misty, slow-moving atmosphere.",
  "agua-ravine":
    "Rippling piano and vibraphone tones drift like water over stone.",
  aisatsana:
    "Sparse piano notes bloom into a quiet, reflective room with long spaces between phrases.",
  "animalia-chordata":
    "Low, organic calls and watery textures create a deep, immersive soundscape.",
  apoapsis:
    "Piano and strings orbit slowly, creating a weightless, night-sky feeling.",
  "at-sunrise":
    "Warm vibraphone notes rise slowly and shimmer like first light.",
  awash:
    "Ocean-drum swells and guitar tones create a broad, wave-like wash.",
  "beneath-waves":
    "Soft choir and oboe-like tones sit under a slow aquatic haze.",
  bhairav:
    "Low cello and piano tones create a meditative, modal atmosphere.",
  buttafingers:
    "Wine-glass tones and light wooden taps make a delicate, glassy texture.",
  "day-dream":
    "Time-stretched piano notes drift in slow motion, soft and suspended.",
  didgeridoobeats:
    "Didgeridoo tones and low-key rhythmic hits make an earthy pulse.",
  "documentary-films":
    "Low brass tones move with a calm, cinematic weight.",
  drones:
    "Sustained trumpet tones form a steady, minimal drone bed.",
  "drones-2":
    "Sustained violin tones create a warmer, string-based drone.",
  "eno-machine":
    "Piano notes appear in gentle, shifting patterns with a calm ambient feel.",
  enough:
    "Oboe-like tones move simply and patiently, leaving a lot of quiet space.",
  "expand-collapse":
    "Piano tones open and settle in slow breaths, expanding and softening over time.",
  "eyes-closed":
    "Gliding string-like tones create a dreamy, inward soundscape.",
  homage:
    "Piano and sustained strings combine into a restrained, reflective ambient piece.",
  impact:
    "Forward and reversed piano notes answer each other in soft, blooming waves.",
  "last-transit":
    "A low vehicle-like hum creates a steady, urban ambient bed.",
  lemniscate:
    "Piano tones slowly pan and overlap in looping left-right motion.",
  "little-bells":
    "Tiny bell tones sparkle gently with long, airy reverb.",
  lullaby:
    "Bird-like ambience and soft bursts create a strange, dreamlike lullaby texture.",
  meditation:
    "Singing-bowl tones form a still, resonant space for quiet focus.",
  moment:
    "Guitar and hummed vocal tones create an intimate, human ambient bed.",
  nakaii:
    "Sustained strings move slowly in a calm, spacious wash.",
  neuroplasticity:
    "Guitar-like tones and quiet hums create a thoughtful, meditative texture.",
  "no-refrain":
    "Piano notes cycle without a chorus, forming a patient, repeating field.",
  "observable-streams":
    "Piano, violin, and oboe-like tones drift in slowly changing streams.",
  otherness:
    "A more abstract atmosphere with unfamiliar tones and a suspended mood.",
  "oxalis-1":
    "Glockenspiel and marimba colors create a bright, gently patterned texture.",
  peace:
    "Flute-like tones create a soft, open, breathy atmosphere.",
  pinwheels:
    "Piano figures turn lightly in place, bright and unhurried.",
  "pulse-code-modulation":
    "Piano and guitar colors pulse with a subtle electronic edge.",
  remembering:
    "Piano tones arrive like quiet memories, spacious and reflective.",
  "return-to-form":
    "Slow piano tones gather and release with a calm sense of return.",
  ritual:
    "Hand-drum textures create a grounded, ceremonial pulse.",
  sevenths:
    "Piano harmonies built from seventh chords create a mellow, gently unresolved mood.",
  skyline:
    "Soft drums and sustained strings suggest a distant city horizon.",
  soundtrack:
    "Cello and glockenspiel tones create a dark, cinematic ambience.",
  splash:
    "Piano tones scatter and ripple like drops across a quiet surface.",
  "spring-again":
    "Cello and violin tones move with a slow, hopeful lift.",
  stratospheric:
    "Electric guitar textures stretch into a high, airy atmosphere.",
  "stream-of-consciousness":
    "Brushy percussion creates a subtle, restless current.",
  substrate:
    "Low piano tones form a steady foundation under sparse, quiet movement.",
  "timbral-oscillations":
    "Piano tones slowly shift in color and density.",
  townsend:
    "Flute and guitar colors create a soft, pastoral drift.",
  transmission:
    "Piano tones pulse like a distant signal through a quiet room.",
  trees:
    "Piano notes fall slowly and irregularly, like light moving through branches.",
  uun:
    "Minimal piano tones create a spacious, open-ended sound field.",
  "western-medicine":
    "Harp, marimba, and piano colors create a clean, glassy shimmer.",
  yesterday:
    "Tenor saxophone tones create a warm, nostalgic haze.",
  zed:
    "Pad and noise layers create a soft, abstract sleep-state atmosphere.",
})

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
    description: getGenerativeFmListenerDescription(piece),
    disabledReason: enabled
      ? undefined
      : "This station is still being prepared for playback.",
    tags: ["Generative.fm", ...piece.tags, enabled ? "sample-hosted" : "samples pending"],
    attribution: {
      artist: "Alex Bainter",
      license: "MIT",
      sourceUrl: "https://github.com/generative-music/pieces-alex-bainter",
      notice: hostedPiece?.notice ?? "",
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
        ...(hostedPiece.opusSampleIndexObjectKey
          ? { r2OpusSampleIndexObjectKey: hostedPiece.opusSampleIndexObjectKey }
          : {}),
        ...(hostedPiece.opusManifestObjectKey
          ? { r2OpusManifestObjectKey: hostedPiece.opusManifestObjectKey }
          : {}),
        hostedSampleIndexUrl: hostedPiece.sampleIndexUrl,
        hostedManifestUrl: hostedPiece.manifestUrl,
        ...(hostedPiece.sampleIndexFormatUrls ? { hostedSampleIndexFormatUrls: hostedPiece.sampleIndexFormatUrls } : {}),
        ...(hostedPiece.manifestFormatUrls ? { hostedManifestFormatUrls: hostedPiece.manifestFormatUrls } : {}),
        ...(hostedPiece.stageCommand ? { stageCommand: hostedPiece.stageCommand } : {}),
        r2UploadCommand: hostedPiece.r2UploadCommand,
        ...(hostedPiece.r2WebAudioUploadCommand ? { r2WebAudioUploadCommand: hostedPiece.r2WebAudioUploadCommand } : {}),
      } : {}),
      sampleNameGroups: cloneSampleGroups(piece.sampleNameGroups),
      sampleNames: flattenSampleGroups(piece.sampleNameGroups),
      missingSampleGroups: missingSampleGroups.map((group) => [...group]),
    },
  }
}

/**
 * @param {typeof GENERATIVE_FM_PIECES[number]} piece
 * @returns {string}
 */
function getGenerativeFmListenerDescription(piece) {
  return GENERATIVE_FM_LISTENER_DESCRIPTIONS[piece.id] ??
    `${piece.title} creates a generative ambient soundscape for quiet focus.`
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
 * Builds hosting metadata for non-Observable Streams Generative.fm batches.
 * These sample indexes are intentionally piece-specific; source names
 * like `vsco2-piano-mf` must not become globally hosted for every piano piece.
 *
 * @param {{ pieceId: string, hostedSampleGroups: readonly string[], notice?: string }} params
 */
function hostedBatchPiece({ pieceId, hostedSampleGroups, notice = "" }) {
  const objectPrefix = `${GENERATIVE_FM_R2_OBJECT_PREFIX_BASE}/${pieceId}`
  const opusSampleIndexObjectKey = `${objectPrefix}/sample-index.opus.json`
  const opusManifestObjectKey = `${objectPrefix}/manifest.opus.json`

  return Object.freeze({
    objectPrefix,
    sampleIndexPath: null,
    sampleBasePath: null,
    sampleIndexObjectKey: `${objectPrefix}/sample-index.json`,
    opusSampleIndexObjectKey,
    opusManifestObjectKey,
    sampleIndexUrl: `${OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL}/${objectPrefix}/sample-index.json`,
    manifestUrl: `${OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL}/${objectPrefix}/manifest.json`,
    sampleIndexFormatUrls: createWebAudioFormatMetadataUrls({
      objectPrefix,
      metadataBaseName: "sample-index",
    }),
    manifestFormatUrls: createWebAudioFormatMetadataUrls({
      objectPrefix,
      metadataBaseName: "manifest",
    }),
    hostedSampleGroups: Object.freeze([...hostedSampleGroups]),
    notice,
    r2UploadCommand: `npm run atmosphere:samples:generative:r2:upload -- <audio-root> --piece ${pieceId}`,
    r2WebAudioUploadCommand: `npm run atmosphere:samples:generative:web-audio:r2:upload -- <audio-root> --piece ${pieceId} --dry-run`,
  })
}

/**
 * @param {{ objectPrefix: string, metadataBaseName: "sample-index" | "manifest" }} params
 */
function createWebAudioFormatMetadataUrls({ objectPrefix, metadataBaseName }) {
  return Object.freeze(Object.fromEntries(
    WEB_AUDIO_SIDECAR_FORMATS.map((format) => [
      format.id,
      `${OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL}/${objectPrefix}/${metadataBaseName}.${format.id}.json`,
    ]),
  ))
}
