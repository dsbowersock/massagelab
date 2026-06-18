// @ts-check

import { createGenerativeFmStations } from "./generative-fm-catalog.js"

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

const generativeFmStations = createGenerativeFmStations()

export const ATMOSPHERE_STATION_IDS = Object.freeze([
  "mlab-proof-drone",
  ...generativeFmStations.map((station) => station.id),
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
      sourceUrl: "/wellness/atmosphere",
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
  ...generativeFmStations,
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
  if (Array.isArray(runtime.sampleNameGroups)) {
    runtime.sampleNameGroups = runtime.sampleNameGroups.map((group) => Array.isArray(group) ? [...group] : group)
  }
  if (Array.isArray(runtime.samplePlan)) {
    runtime.samplePlan = runtime.samplePlan.map((entry) => ({ ...entry }))
  }
  if (Array.isArray(runtime.missingSampleGroups)) {
    runtime.missingSampleGroups = runtime.missingSampleGroups.map((group) => Array.isArray(group) ? [...group] : group)
  }

  return {
    ...station,
    tags: [...station.tags],
    attribution: { ...station.attribution },
    runtime,
  }
}
