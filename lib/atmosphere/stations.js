// @ts-check

export const ATMOSPHERE_STATION_IDS = Object.freeze([
  "mlab-proof-drone",
  "observable-streams-probe",
])

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
      "A Generative.fm package probe kept disabled until MassageLab has explicit sample-index and sample-hosting coverage.",
    disabledReason:
      "The package is installable, but the selected piece does not include the sample-index data required to resolve its sample names to hosted audio files.",
    tags: ["Generative.fm", "acoustic", "sample-hosting probe"],
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
      sampleNames: [
        "observable-streams__vsco2-piano-mf",
        "observable-streams__vsco2-violin-arcvib",
        "observable-streams__sso-cor-anglais",
      ],
    },
  },
])

const stationsById = new Map(atmosphereStations.map((station) => [station.id, station]))

export function listAtmosphereStations() {
  return [...atmosphereStations]
}

export function getVisibleAtmosphereStations() {
  return listAtmosphereStations()
}

export function getPlayableAtmosphereStations() {
  return atmosphereStations.filter((station) => station.enabled)
}

export function getAtmosphereStationById(stationId) {
  const station = stationsById.get(stationId)
  if (!station) {
    throw new Error(`Unknown Atmosphere station: ${stationId}`)
  }
  return station
}
