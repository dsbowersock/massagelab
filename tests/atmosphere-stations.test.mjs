import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ATMOSPHERE_STATION_IDS,
  getAtmosphereStationById,
  getPlayableAtmosphereStations,
  getVisibleAtmosphereStations,
  listAtmosphereStations,
} from "../lib/atmosphere/stations.js"
import {
  GENERATIVE_FM_COLLECTION_PACKAGE_NAME,
  GENERATIVE_FM_COLLECTION_PACKAGE_VERSION,
  GENERATIVE_FM_PIECES,
  OBSERVABLE_STREAMS_STATION_ID,
} from "../lib/atmosphere/generative-fm-catalog.js"

describe("Atmosphere station catalog", () => {
  it("defines the proof station plus the full Generative.fm catalog in stable order", () => {
    assert.equal(ATMOSPHERE_STATION_IDS[0], "mlab-proof-drone")
    assert.equal(ATMOSPHERE_STATION_IDS.length, GENERATIVE_FM_PIECES.length + 1)
    assert.equal(new Set(ATMOSPHERE_STATION_IDS).size, ATMOSPHERE_STATION_IDS.length)
    assert.equal(ATMOSPHERE_STATION_IDS.includes(OBSERVABLE_STREAMS_STATION_ID), true)
    assert.equal(ATMOSPHERE_STATION_IDS.includes("generative-fm-aisatsana"), true)
    assert.equal(ATMOSPHERE_STATION_IDS.includes("generative-fm-zed"), true)

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
    assert.match(station.description, /soft, steady drone/i)
    assert.equal(station.attribution.license, "MassageLab internal proof")
  })

  it("exposes the Generative.fm Observable Streams station as playable with hosted samples", () => {
    const station = getAtmosphereStationById("observable-streams-probe")

    assert.equal(station.sourceType, "generative-fm-piece")
    assert.equal(station.enabled, true)
    assert.equal(station.runtime.packageName, GENERATIVE_FM_COLLECTION_PACKAGE_NAME)
    assert.equal(station.runtime.packageVersion, GENERATIVE_FM_COLLECTION_PACKAGE_VERSION)
    assert.equal(station.runtime.pieceId, "observable-streams")
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
      station.runtime.r2OpusSampleIndexObjectKey,
      "atmosphere/observable-streams-vsco-adaptation/sample-index.opus.json",
    )
    assert.equal(
      station.runtime.r2OpusManifestObjectKey,
      "atmosphere/observable-streams-vsco-adaptation/manifest.opus.json",
    )
    assert.equal(
      station.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.json",
    )
    assert.deepEqual(station.runtime.hostedSampleIndexFormatUrls, {
      opus: "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.opus.json",
      aac: "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.aac.json",
      mp3: "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/sample-index.mp3.json",
    })
    assert.equal(
      station.runtime.hostedManifestUrl,
      "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/manifest.json",
    )
    assert.deepEqual(station.runtime.hostedManifestFormatUrls, {
      opus: "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/manifest.opus.json",
      aac: "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/manifest.aac.json",
      mp3: "https://media.massagelab.app/atmosphere/observable-streams-vsco-adaptation/manifest.mp3.json",
    })
    assert.match(station.runtime.stageCommand, /atmosphere:samples:stage/)
    assert.match(station.runtime.r2UploadCommand, /atmosphere:samples:r2:upload/)
    assert.match(station.runtime.r2WebAudioUploadCommand, /atmosphere:samples:web-audio:r2:upload/)
    assert.deepEqual(station.runtime.sampleNameGroups, [
      ["observable-streams__vsco2-piano-mf", "vsco2-piano-mf"],
      ["observable-streams__vsco2-violin-arcvib", "vsco2-violin-arcvib"],
      ["observable-streams__sso-cor-anglais", "sso-cor-anglais"],
    ])
    assert.deepEqual(station.runtime.sampleNames, [
      "observable-streams__vsco2-piano-mf",
      "vsco2-piano-mf",
      "observable-streams__vsco2-violin-arcvib",
      "vsco2-violin-arcvib",
      "observable-streams__sso-cor-anglais",
      "sso-cor-anglais",
    ])
    assert.deepEqual(station.runtime.missingSampleGroups, [])
    assert.equal(station.attribution.license, "MIT")
    assert.equal(station.attribution.artist, "Alex Bainter")
    assert.equal(station.attribution.notice, "")
    assert.match(station.description, /Piano, violin, and oboe-like tones/i)
  })

  it("separates visible stations from playable stations", () => {
    const visibleStationIds = getVisibleAtmosphereStations().map((station) => station.id)
    const playableStationIds = getPlayableAtmosphereStations().map((station) => station.id)

    assert.equal(visibleStationIds.length, 58)
    assert.equal(playableStationIds.length, 58)
    assert.equal(playableStationIds.includes("mlab-proof-drone"), true)
    assert.equal(playableStationIds.includes(OBSERVABLE_STREAMS_STATION_ID), true)
    assert.equal(playableStationIds.includes("generative-fm-420hz-gamma-waves-for-big-brain"), true)
    assert.equal(playableStationIds.includes("generative-fm-a-viable-system"), true)
    assert.equal(playableStationIds.includes("generative-fm-above-the-rain"), true)
    assert.equal(playableStationIds.includes("generative-fm-agua-ravine"), true)
    assert.equal(playableStationIds.includes("generative-fm-aisatsana"), true)
    assert.equal(playableStationIds.includes("generative-fm-apoapsis"), true)
    assert.equal(playableStationIds.includes("generative-fm-at-sunrise"), true)
    assert.equal(playableStationIds.includes("generative-fm-beneath-waves"), true)
    assert.equal(playableStationIds.includes("generative-fm-bhairav"), true)
    assert.equal(playableStationIds.includes("generative-fm-buttafingers"), true)
    assert.equal(playableStationIds.includes("generative-fm-day-dream"), true)
    assert.equal(playableStationIds.includes("generative-fm-documentary-films"), true)
    assert.equal(playableStationIds.includes("generative-fm-drones"), true)
    assert.equal(playableStationIds.includes("generative-fm-drones-2"), true)
    assert.equal(playableStationIds.includes("generative-fm-eno-machine"), true)
    assert.equal(playableStationIds.includes("generative-fm-enough"), true)
    assert.equal(playableStationIds.includes("generative-fm-expand-collapse"), true)
    assert.equal(playableStationIds.includes("generative-fm-homage"), true)
    assert.equal(playableStationIds.includes("generative-fm-impact"), true)
    assert.equal(playableStationIds.includes("generative-fm-lemniscate"), true)
    assert.equal(playableStationIds.includes("generative-fm-little-bells"), true)
    assert.equal(playableStationIds.includes("generative-fm-nakaii"), true)
    assert.equal(playableStationIds.includes("generative-fm-pinwheels"), true)
    assert.equal(playableStationIds.includes("generative-fm-oxalis-1"), true)
    assert.equal(playableStationIds.includes("generative-fm-remembering"), true)
    assert.equal(playableStationIds.includes("generative-fm-return-to-form"), true)
    assert.equal(playableStationIds.includes("generative-fm-ritual"), true)
    assert.equal(playableStationIds.includes("generative-fm-sevenths"), true)
    assert.equal(playableStationIds.includes("generative-fm-soundtrack"), true)
    assert.equal(playableStationIds.includes("generative-fm-splash"), true)
    assert.equal(playableStationIds.includes("generative-fm-spring-again"), true)
    assert.equal(playableStationIds.includes("generative-fm-substrate"), true)
    assert.equal(playableStationIds.includes("generative-fm-timbral-oscillations"), true)
    assert.equal(playableStationIds.includes("generative-fm-uun"), true)
    assert.equal(playableStationIds.includes("generative-fm-no-refrain"), true)
    assert.equal(playableStationIds.includes("generative-fm-transmission"), true)
    assert.equal(playableStationIds.includes("generative-fm-trees"), true)
    assert.equal(playableStationIds.includes("generative-fm-yesterday"), true)
    assert.equal(playableStationIds.includes("generative-fm-animalia-chordata"), true)
    assert.equal(playableStationIds.includes("generative-fm-awash"), true)
    assert.equal(playableStationIds.includes("generative-fm-didgeridoobeats"), true)
    assert.equal(playableStationIds.includes("generative-fm-eyes-closed"), true)
    assert.equal(playableStationIds.includes("generative-fm-last-transit"), true)
    assert.equal(playableStationIds.includes("generative-fm-lullaby"), true)
    assert.equal(playableStationIds.includes("generative-fm-meditation"), true)
    assert.equal(playableStationIds.includes("generative-fm-moment"), true)
    assert.equal(playableStationIds.includes("generative-fm-neuroplasticity"), true)
    assert.equal(playableStationIds.includes("generative-fm-otherness"), true)
    assert.equal(playableStationIds.includes("generative-fm-peace"), true)
    assert.equal(playableStationIds.includes("generative-fm-pulse-code-modulation"), true)
    assert.equal(playableStationIds.includes("generative-fm-skyline"), true)
    assert.equal(playableStationIds.includes("generative-fm-stratospheric"), true)
    assert.equal(playableStationIds.includes("generative-fm-stream-of-consciousness"), true)
    assert.equal(playableStationIds.includes("generative-fm-townsend"), true)
    assert.equal(playableStationIds.includes("generative-fm-western-medicine"), true)
    assert.equal(playableStationIds.includes("generative-fm-zed"), true)

    const hostedPianoStation = getAtmosphereStationById("generative-fm-aisatsana")
    assert.equal(hostedPianoStation.enabled, true)
    assert.match(hostedPianoStation.description, /Sparse piano notes/i)
    assert.doesNotMatch(hostedPianoStation.description, /hosted|sample index|public-media/i)
    assert.equal(
      hostedPianoStation.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/generative-fm/aisatsana/sample-index.json",
    )
    assert.equal(
      hostedPianoStation.runtime.r2OpusSampleIndexObjectKey,
      "atmosphere/generative-fm/aisatsana/sample-index.opus.json",
    )
    assert.deepEqual(
      hostedPianoStation.runtime.hostedSampleIndexFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/aisatsana", "sample-index"),
    )
    assert.deepEqual(
      hostedPianoStation.runtime.hostedManifestFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/aisatsana", "manifest"),
    )
    assert.match(hostedPianoStation.runtime.r2WebAudioUploadCommand, /atmosphere:samples:generative:web-audio:r2:upload/)

    const secondBatchPianoStation = getAtmosphereStationById("generative-fm-day-dream")
    assert.equal(secondBatchPianoStation.enabled, true)
    assert.equal(
      secondBatchPianoStation.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/generative-fm/day-dream/sample-index.json",
    )
    assert.deepEqual(
      secondBatchPianoStation.runtime.hostedSampleIndexFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/day-dream", "sample-index"),
    )

    const thirdBatchPianoStation = getAtmosphereStationById("generative-fm-pinwheels")
    assert.equal(thirdBatchPianoStation.enabled, true)
    assert.equal(
      thirdBatchPianoStation.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/generative-fm/pinwheels/sample-index.json",
    )
    assert.deepEqual(
      thirdBatchPianoStation.runtime.hostedSampleIndexFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/pinwheels", "sample-index"),
    )

    const renderedVibraphoneStation = getAtmosphereStationById("generative-fm-at-sunrise")
    assert.equal(renderedVibraphoneStation.enabled, true)
    assert.deepEqual(
      renderedVibraphoneStation.runtime.hostedSampleIndexFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/at-sunrise", "sample-index"),
    )

    const renderedPianoStation = getAtmosphereStationById("generative-fm-no-refrain")
    assert.equal(renderedPianoStation.enabled, true)
    assert.match(renderedPianoStation.description, /Piano notes cycle/i)
    assert.equal(
      renderedPianoStation.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/generative-fm/no-refrain/sample-index.json",
    )
    assert.deepEqual(
      renderedPianoStation.runtime.hostedSampleIndexFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/no-refrain", "sample-index"),
    )
    assert.deepEqual(renderedPianoStation.runtime.missingSampleGroups, [])

    const transmissionStation = getAtmosphereStationById("generative-fm-transmission")
    assert.equal(transmissionStation.enabled, true)
    assert.deepEqual(
      transmissionStation.runtime.hostedManifestFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/transmission", "manifest"),
    )

    const treesStation = getAtmosphereStationById("generative-fm-trees")
    assert.equal(treesStation.enabled, true)
    assert.equal(
      treesStation.runtime.r2OpusSampleIndexObjectKey,
      "atmosphere/generative-fm/trees/sample-index.opus.json",
    )

    const sourceRolloutStation = getAtmosphereStationById("generative-fm-splash")
    assert.equal(sourceRolloutStation.enabled, true)
    assert.match(sourceRolloutStation.description, /Piano tones scatter and ripple/i)
    assert.equal(
      sourceRolloutStation.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/generative-fm/splash/sample-index.json",
    )
    assert.deepEqual(sourceRolloutStation.runtime.missingSampleGroups, [])

    const fluteReplacementStation = getAtmosphereStationById("generative-fm-peace")
    assert.equal(fluteReplacementStation.enabled, true)
    assert.equal(
      fluteReplacementStation.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/generative-fm/peace/sample-index.json",
    )
    assert.deepEqual(
      fluteReplacementStation.runtime.hostedSampleIndexFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/peace", "sample-index"),
    )
    assert.deepEqual(fluteReplacementStation.runtime.missingSampleGroups, [])

    const zedStation = getAtmosphereStationById("generative-fm-zed")
    assert.equal(zedStation.enabled, true)
    assert.equal(
      zedStation.runtime.hostedSampleIndexUrl,
      "https://media.massagelab.app/atmosphere/generative-fm/zed/sample-index.json",
    )
    assert.deepEqual(
      zedStation.runtime.hostedSampleIndexFormatUrls,
      expectedFormatUrls("atmosphere/generative-fm/zed", "sample-index"),
    )
    assert.deepEqual(zedStation.runtime.missingSampleGroups, [])
  })

  it("returns cloned station data so callers cannot mutate the catalog", () => {
    const station = getAtmosphereStationById("mlab-proof-drone")
    station.enabled = false
    station.tags.push("mutated")
    station.attribution.license = "mutated"
    station.runtime.defaultOptions.baseFrequency = 999
    const probe = getAtmosphereStationById("observable-streams-probe")
    probe.runtime.sampleNameGroups[0].push("mutated")
    const zed = getAtmosphereStationById("generative-fm-zed")
    zed.runtime.sampleNameGroups[0].push("mutated")

    const freshStation = getAtmosphereStationById("mlab-proof-drone")
    const freshProbe = getAtmosphereStationById("observable-streams-probe")
    const freshZed = getAtmosphereStationById("generative-fm-zed")

    assert.equal(freshStation.enabled, true)
    assert.equal(freshStation.attribution.license, "MassageLab internal proof")
    assert.equal(freshStation.runtime.defaultOptions.baseFrequency, 110)
    assert.equal(freshStation.tags.includes("mutated"), false)
    assert.deepEqual(freshProbe.runtime.sampleNameGroups[0], [
      "observable-streams__vsco2-piano-mf",
      "vsco2-piano-mf",
    ])
    assert.deepEqual(freshZed.runtime.sampleNameGroups[0], ["zed__pad", ""])
  })

  it("throws for unknown station ids", () => {
    assert.throws(
      () => getAtmosphereStationById("missing-station"),
      /Unknown Atmosphere station: missing-station/,
    )
  })
})

/**
 * @param {string} objectPrefix
 * @param {"sample-index" | "manifest"} metadataBaseName
 */
function expectedFormatUrls(objectPrefix, metadataBaseName) {
  return {
    opus: `https://media.massagelab.app/${objectPrefix}/${metadataBaseName}.opus.json`,
    aac: `https://media.massagelab.app/${objectPrefix}/${metadataBaseName}.aac.json`,
    mp3: `https://media.massagelab.app/${objectPrefix}/${metadataBaseName}.mp3.json`,
  }
}
