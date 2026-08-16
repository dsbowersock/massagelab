import assert from "node:assert/strict"
import test from "node:test"

import * as stationArtwork from "../lib/atmosphere/station-artwork.ts"
import { ATMOSPHERE_STATION_GROUP_DEFINITIONS } from "../lib/atmosphere/station-groups.js"
import {
  getAtmosphereStationById,
  getVisibleAtmosphereStations,
} from "../lib/atmosphere/stations.js"

const {
  getAtmosphereStationArtworkModel,
  getAtmosphereStationArtworkUrl,
  renderAtmosphereStationArtworkSvg,
} = stationArtwork

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

test("canonical station artwork SVG is deterministic and its sized URL safely encodes ids", () => {
  const proof = stationInput("mlab-proof-drone")
  const first = renderAtmosphereStationArtworkSvg(proof)
  const second = renderAtmosphereStationArtworkSvg(proof)

  assert.equal(first, second)
  assert.match(first, /^<svg[^>]+viewBox="0 0 240 240"/)
  assert.match(first, /<circle/)
  assert.equal(
    getAtmosphereStationArtworkUrl("proof/drone", 512),
    "/api/atmosphere/stations/proof%2Fdrone/artwork?size=512",
  )
  assert.equal(
    getAtmosphereStationArtworkUrl("proof/drone", 256),
    "/api/atmosphere/stations/proof%2Fdrone/artwork?size=256",
  )
})

test("canonical input resolution reuses station identity and rejects invalid runtime data", () => {
  assert.equal(typeof stationArtwork.resolveAtmosphereStationArtworkInput, "function")
  const resolveAtmosphereStationArtworkInput = stationArtwork.resolveAtmosphereStationArtworkInput
  const station = getAtmosphereStationById("mlab-proof-drone")
  assert.deepEqual(resolveAtmosphereStationArtworkInput(station), stationInput(station.id))
  assert.equal(resolveAtmosphereStationArtworkInput({
    ...station,
    description: "",
  }), null)
  assert.equal(resolveAtmosphereStationArtworkInput({
    ...station,
    id: "",
  }), null)
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
