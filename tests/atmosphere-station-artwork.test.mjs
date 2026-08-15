import assert from "node:assert/strict"
import test from "node:test"

import {
  getAtmosphereStationArtworkModel,
  getAtmosphereStationArtworkUrl,
  renderAtmosphereStationArtworkSvg,
} from "../lib/atmosphere/station-artwork.ts"
import { ATMOSPHERE_STATION_GROUP_DEFINITIONS } from "../lib/atmosphere/station-groups.js"
import {
  getAtmosphereStationById,
  getVisibleAtmosphereStations,
} from "../lib/atmosphere/stations.js"

function stationInput(stationId) {
  const station = getAtmosphereStationById(stationId)
  const groupId = ATMOSPHERE_STATION_GROUP_DEFINITIONS.find((group) => (
    group.stationIds.includes(station.id)
  ))?.id ?? "more-stations"

  return {
    description: station.description,
    groupId,
    stationId: station.id,
    title: station.title,
  }
}

test("canonical station artwork SVG is deterministic and its URL safely encodes ids", () => {
  const proof = stationInput("mlab-proof-drone")
  const first = renderAtmosphereStationArtworkSvg(proof)
  const second = renderAtmosphereStationArtworkSvg(proof)

  assert.equal(first, second)
  assert.match(first, /^<svg[^>]+viewBox="0 0 240 240"/)
  assert.match(first, /<circle/)
  assert.equal(
    getAtmosphereStationArtworkUrl("proof/drone"),
    "/api/atmosphere/stations/proof%2Fdrone/artwork",
  )
})

test("every visible station has deterministic canonical SVG artwork", () => {
  for (const station of getVisibleAtmosphereStations()) {
    const input = stationInput(station.id)
    const first = renderAtmosphereStationArtworkSvg(input)
    const second = renderAtmosphereStationArtworkSvg(input)

    assert.notEqual(first, "", `${station.id} emits artwork`)
    assert.equal(first, second, `${station.id} remains byte-stable`)
  }
})

test("stations sharing a palette retain seed-derived geometry", () => {
  for (const [firstId, secondId] of [
    ["mlab-proof-drone", "generative-fm-documentary-films"],
    ["generative-fm-trees", "generative-fm-impact"],
  ]) {
    const firstInput = stationInput(firstId)
    const secondInput = stationInput(secondId)
    const firstModel = getAtmosphereStationArtworkModel(firstInput)
    const secondModel = getAtmosphereStationArtworkModel(secondInput)

    assert.deepEqual(firstModel.palette, secondModel.palette)
    assert.notEqual(firstModel.seed, secondModel.seed)
    assert.notEqual(
      renderAtmosphereStationArtworkSvg(firstInput),
      renderAtmosphereStationArtworkSvg(secondInput),
    )
  }
})
