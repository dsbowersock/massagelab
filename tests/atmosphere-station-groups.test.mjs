import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { groupAtmosphereStations } from "../lib/atmosphere/station-groups.js"
import { getAtmosphereStationById, getVisibleAtmosphereStations } from "../lib/atmosphere/stations.js"

describe("Atmosphere station groups", () => {
  it("places every visible station into exactly one listener-facing group", () => {
    const stations = getVisibleAtmosphereStations()
    const groups = groupAtmosphereStations(stations)
    const groupedStationIds = groups.flatMap((group) => group.stations.map((station) => station.id))

    assert.equal(groupedStationIds.length, stations.length)
    assert.equal(new Set(groupedStationIds).size, stations.length)
    assert.deepEqual(
      new Set(groupedStationIds),
      new Set(stations.map((station) => station.id)),
    )
  })

  it("keeps calm defaults before more experimental texture stations", () => {
    const groups = groupAtmosphereStations(getVisibleAtmosphereStations())
    const starterGroup = groups.find((group) => group.id === "treatment-room-starters")
    const experimentalGroup = groups.find((group) => group.id === "rhythm-experimental")

    assert.ok(starterGroup)
    assert.ok(experimentalGroup)
    assert.equal(starterGroup.stations.some((station) => station.id === "mlab-proof-drone"), true)
    assert.equal(starterGroup.stations.some((station) => station.id === "generative-fm-aisatsana"), true)
    assert.equal(experimentalGroup.stations.some((station) => station.id === "generative-fm-awash"), true)
    assert.equal(experimentalGroup.stations.some((station) => station.id === "generative-fm-moment"), true)
    assert.equal(experimentalGroup.stations.some((station) => station.id === "generative-fm-neuroplasticity"), true)
  })

  it("sets listener expectations for sparse or darker QA-flagged stations", () => {
    assert.match(getAtmosphereStationById("generative-fm-little-bells").description, /long quiet gaps/i)
    assert.match(getAtmosphereStationById("generative-fm-beneath-waves").description, /little literal wave sound/i)
    assert.match(getAtmosphereStationById("generative-fm-awash").description, /distorted, voice-like edges/i)
    assert.match(getAtmosphereStationById("generative-fm-moment").description, /faint human-like color/i)
    assert.match(getAtmosphereStationById("generative-fm-neuroplasticity").description, /voice-like artifacts/i)
  })
})
