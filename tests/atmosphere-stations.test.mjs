import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ATMOSPHERE_STATION_IDS,
  getAtmosphereStationById,
  getPlayableAtmosphereStations,
  getVisibleAtmosphereStations,
  listAtmosphereStations,
} from "../lib/atmosphere/stations.js"

describe("Atmosphere station catalog", () => {
  it("defines the runtime spike stations in stable order", () => {
    assert.deepEqual(ATMOSPHERE_STATION_IDS, [
      "mlab-proof-drone",
      "observable-streams-probe",
    ])

    assert.deepEqual(
      listAtmosphereStations().map((station) => station.id),
      ATMOSPHERE_STATION_IDS,
    )
  })

  it("exposes one playable MassageLab-hosted proof station", () => {
    const station = getAtmosphereStationById("mlab-proof-drone")

    assert.equal(station.title, "MassageLab Proof Drone")
    assert.equal(station.sourceType, "tone-generator")
    assert.equal(station.enabled, true)
    assert.equal(station.runtime.adapterId, "tone-proof-drone")
    assert.match(station.description, /MassageLab-hosted/i)
    assert.equal(station.attribution.license, "MassageLab internal proof")
  })

  it("keeps the Generative.fm package probe visible but not playable", () => {
    const station = getAtmosphereStationById("observable-streams-probe")

    assert.equal(station.sourceType, "generative-fm-piece")
    assert.equal(station.enabled, false)
    assert.equal(station.runtime.packageName, "@generative-music/piece-observable-streams")
    assert.deepEqual(station.runtime.sampleNames, [
      "observable-streams__vsco2-piano-mf",
      "observable-streams__vsco2-violin-arcvib",
      "observable-streams__sso-cor-anglais",
    ])
    assert.match(station.disabledReason, /sample-index/i)
    assert.equal(station.attribution.license, "MIT")
    assert.equal(station.attribution.artist, "Alex Bainter")
  })

  it("separates visible stations from playable stations", () => {
    assert.deepEqual(
      getVisibleAtmosphereStations().map((station) => station.id),
      ["mlab-proof-drone", "observable-streams-probe"],
    )
    assert.deepEqual(
      getPlayableAtmosphereStations().map((station) => station.id),
      ["mlab-proof-drone"],
    )
  })

  it("throws for unknown station ids", () => {
    assert.throws(
      () => getAtmosphereStationById("missing-station"),
      /Unknown Atmosphere station: missing-station/,
    )
  })
})
