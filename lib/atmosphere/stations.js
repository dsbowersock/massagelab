// @ts-check

import {
  OBSERVABLE_STREAMS_ADAPTATION_ID,
  OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH,
  OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH,
  OBSERVABLE_STREAMS_R2_MANIFEST_OBJECT_KEY,
  OBSERVABLE_STREAMS_R2_MANIFEST_URL,
  OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
  OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL,
  OBSERVABLE_STREAMS_R2_PUBLIC_MEDIA_BUCKET,
  OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_OBJECT_KEY,
  OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_URL,
} from "./observable-streams-adaptation.js"

/**
 * @typedef {object} AtmosphereAttribution
 * @property {string} artist
 * @property {string} license
 * @property {string} sourceUrl
 * @property {string} notice
 *
 * @typedef {object} AtmosphereStation
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {string} sourceType
 * @property {boolean} enabled
 * @property {string} description
 * @property {string} [disabledReason]
 * @property {string[]} tags
 * @property {AtmosphereAttribution} attribution
 * @property {Record<string, any>} runtime
 */

export const ATMOSPHERE_STATION_IDS = Object.freeze([
  "mlab-proof-drone",
  "observable-streams-probe",
])

/** @type {ReadonlyArray<AtmosphereStation>} */
const atmosphereStations = Object.freeze([
  {
    id: "mlab-proof-drone",
    title: "MassageLab Proof Drone",
    artist: "MassageLab",
    sourceType: "tone-generator",
    enabled: true,
    description:
      "A MassageLab-hosted Tone.js proof station for validating global playback, route persistence, and cleanup before imported sample-heavy generators are exposed.",
    tags: ["massage room", "soft drone", "runtime spike"],
    attribution: {
      artist: "MassageLab",
      license: "MassageLab internal proof",
      sourceUrl: "/browse",
      notice: "Original runtime proof station for MassageLab.",
    },
    runtime: {
      adapterId: "tone-proof-drone",
      defaultOptions: {
        baseFrequency: 110,
        detuneCents: 7,
        fadeSeconds: 1.2,
      },
    },
  },
  {
    id: "observable-streams-probe",
    title: "Observable Streams",
    artist: "Alex Bainter",
    sourceType: "generative-fm-piece",
    enabled: false,
    description:
      "A Generative.fm package probe kept disabled until MassageLab has explicit sample-index and sample-hosting coverage for its CC0 VSCO adaptation.",
    disabledReason:
      "The package is installable, but the selected piece still needs a MassageLab-hosted sample-index. The original SSO cor anglais source is excluded in favor of a CC0 VSCO oboe adaptation.",
    tags: ["Generative.fm", "acoustic", "sample-hosting probe", "VSCO adaptation"],
    attribution: {
      artist: "Alex Bainter",
      license: "MIT",
      sourceUrl: "https://github.com/generative-music/piece-observable-streams",
      notice:
        "Observable Streams by Alex Bainter. Package used as a disabled probe pending sample hosting verification.",
    },
    runtime: {
      adapterId: "generative-fm-piece",
      packageName: "@generative-music/piece-observable-streams",
      packageVersion: "5.2.0",
      adaptationId: OBSERVABLE_STREAMS_ADAPTATION_ID,
      sampleIndexPath: OBSERVABLE_STREAMS_PUBLIC_INDEX_PATH,
      sampleBasePath: OBSERVABLE_STREAMS_PUBLIC_SAMPLE_BASE_PATH,
      r2Bucket: OBSERVABLE_STREAMS_R2_PUBLIC_MEDIA_BUCKET,
      r2PublicBaseUrl: OBSERVABLE_STREAMS_R2_PUBLIC_BASE_URL,
      r2ObjectPrefix: OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
      r2SampleIndexObjectKey: OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_OBJECT_KEY,
      r2ManifestObjectKey: OBSERVABLE_STREAMS_R2_MANIFEST_OBJECT_KEY,
      hostedSampleIndexUrl: OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_URL,
      hostedManifestUrl: OBSERVABLE_STREAMS_R2_MANIFEST_URL,
      stageCommand: "npm run atmosphere:samples:stage -- <audio-root>",
      r2UploadCommand: "npm run atmosphere:samples:r2:upload -- <audio-root> --dry-run",
      sampleNames: [
        "observable-streams__vsco2-piano-mf",
        "observable-streams__vsco2-violin-arcvib",
        "observable-streams__sso-cor-anglais",
      ],
      samplePlan: [
        {
          sourceName: "vsco2-piano-mf",
          renderedName: "observable-streams__vsco2-piano-mf",
          localSource: "VSCO 2 Community Edition upright piano",
        },
        {
          sourceName: "vsco2-violin-arcvib",
          renderedName: "observable-streams__vsco2-violin-arcvib",
          localSource: "VSCO 2 Community Edition solo violin arco vibrato",
        },
        {
          sourceName: "sso-cor-anglais",
          renderedName: "observable-streams__sso-cor-anglais",
          localSource: "VSCO 2 Community Edition sustained oboe",
          adaptationReason:
            "MassageLab excludes SSO Sampling Plus raw-sample redistribution and maps the package cor anglais role to a CC0 VSCO oboe source.",
        },
      ],
    },
  },
])

const stationsById = new Map(atmosphereStations.map((station) => [station.id, station]))

/** @returns {AtmosphereStation[]} */
export function listAtmosphereStations() {
  return atmosphereStations.map(cloneStation)
}

/** @returns {AtmosphereStation[]} */
export function getVisibleAtmosphereStations() {
  return listAtmosphereStations()
}

/** @returns {AtmosphereStation[]} */
export function getPlayableAtmosphereStations() {
  return atmosphereStations.filter((station) => station.enabled).map(cloneStation)
}

/**
 * @param {string} stationId
 * @returns {AtmosphereStation}
 */
export function getAtmosphereStationById(stationId) {
  const station = stationsById.get(stationId)
  if (!station) {
    throw new Error(`Unknown Atmosphere station: ${stationId}`)
  }
  return cloneStation(station)
}

/**
 * @param {AtmosphereStation} station
 * @returns {AtmosphereStation}
 */
function cloneStation(station) {
  const runtime = { ...station.runtime }
  if (runtime.defaultOptions && typeof runtime.defaultOptions === "object") {
    runtime.defaultOptions = { ...runtime.defaultOptions }
  }
  if (Array.isArray(runtime.sampleNames)) {
    runtime.sampleNames = [...runtime.sampleNames]
  }
  if (Array.isArray(runtime.samplePlan)) {
    runtime.samplePlan = runtime.samplePlan.map((entry) => ({ ...entry }))
  }

  return {
    ...station,
    tags: [...station.tags],
    attribution: { ...station.attribution },
    runtime,
  }
}
