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
    assert.equal(station.attribution.sourceUrl, "/wellness/atmosphere")
    assert.match(station.description, /MassageLab-hosted/i)
    assert.equal(station.attribution.license, "MassageLab internal proof")
  })

  it("exposes the Generative.fm Observable Streams station as playable with hosted samples", () => {
    const station = getAtmosphereStationById("observable-streams-probe")

    assert.equal(station.sourceType, "generative-fm-piece")
    assert.equal(station.enabled, true)
    assert.equal(station.runtime.packageName, "@generative-music/piece-observable-streams")
    assert.equal(station.runtime.adaptationId, "observable-streams-vsco-adaptation")
    assert.equal(
      station.runtime.sampleIndexPath,
      "/audio/atmosphere/observable-streams-vsco-adaptation/sample-index.json",
    )
    assert.equal(
      station.runtime.sampleBasePath,
      "/audio/atmosphere/observable-streams-vsco-adaptation/samples",
    )
    assert.equal(station.runtime.r2Bucket, "massagelab-public-media")
    assert.equal(station.runtime.r2PublicBaseUrl, "https://media.massagelab.app")
    assert.equal(station.runtime.r2ObjectPrefix, "atmosphere/observable-streams-vsco-adaptation")
    assert.equal(
      station.runtime.r2SampleIndexObjectKey,
      "atmosphere/observable-streams-vsco-adaptation/sample-index.json",
    )
    assert.equal(
      station.runtime.r2ManifestObjectKey,
      "atmosphere/observable-streams-vsco-adaptation/manifest.json",
    )
    assert.equal(
      station.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.json",
    )
    assert.equal(
      station.runtime.hostedManifestUrl,
      "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/manifest.json",
    )
    assert.match(station.runtime.stageCommand, /atmosphere:samples:stage/)
    assert.match(station.runtime.r2UploadCommand, /atmosphere:samples:r2:upload/)
    assert.deepEqual(station.runtime.sampleNameGroups, [
      ["observable-streams__vsco2-piano-mf", "vsco2-piano-mf"],
      ["observable-streams__vsco2-violin-arcvib", "vsco2-violin-arcvib"],
      ["observable-streams__sso-cor-anglais", "sso-cor-anglais"],
    ])
    assert.deepEqual(station.runtime.sampleNames, [
      "observable-streams__vsco2-piano-mf",
      "observable-streams__vsco2-violin-arcvib",
      "observable-streams__sso-cor-anglais",
    ])
    assert.deepEqual(
      station.runtime.samplePlan.map((sample) => sample.localSource),
      [
        "VSCO 2 Community Edition upright piano",
        "VSCO 2 Community Edition solo violin arco vibrato",
        "VSCO 2 Community Edition sustained oboe",
      ],
    )
    assert.match(station.runtime.samplePlan[2].adaptationReason, /excludes SSO/i)
    assert.equal(station.attribution.license, "MIT")
    assert.equal(station.attribution.artist, "Alex Bainter")
    assert.match(station.attribution.notice, /hosted CC0 VSCO sample adaptation/i)
  })

  it("separates visible stations from playable stations", () => {
    assert.deepEqual(
      getVisibleAtmosphereStations().map((station) => station.id),
      ["mlab-proof-drone", "observable-streams-probe"],
    )
    assert.deepEqual(
      getPlayableAtmosphereStations().map((station) => station.id),
      ["mlab-proof-drone", "observable-streams-probe"],
    )
  })

  it("returns cloned station data so callers cannot mutate the catalog", () => {
    const station = getAtmosphereStationById("mlab-proof-drone")
    station.enabled = false
    station.tags.push("mutated")
    station.attribution.license = "mutated"
    station.runtime.defaultOptions.baseFrequency = 999
    const probe = getAtmosphereStationById("observable-streams-probe")
    probe.runtime.samplePlan[0].localSource = "mutated"
    probe.runtime.sampleNameGroups[0].push("mutated")

    const freshStation = getAtmosphereStationById("mlab-proof-drone")
    const freshProbe = getAtmosphereStationById("observable-streams-probe")

    assert.equal(freshStation.enabled, true)
    assert.equal(freshStation.attribution.license, "MassageLab internal proof")
    assert.equal(freshStation.runtime.defaultOptions.baseFrequency, 110)
    assert.equal(freshStation.tags.includes("mutated"), false)
    assert.equal(freshProbe.runtime.samplePlan[0].localSource, "VSCO 2 Community Edition upright piano")
    assert.deepEqual(freshProbe.runtime.sampleNameGroups[0], [
      "observable-streams__vsco2-piano-mf",
      "vsco2-piano-mf",
    ])
  })

  it("throws for unknown station ids", () => {
    assert.throws(
      () => getAtmosphereStationById("missing-station"),
      /Unknown Atmosphere station: missing-station/,
    )
  })
})
