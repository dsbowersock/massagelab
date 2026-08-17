import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
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
    stationArtwork.ATMOSPHERE_MEDIA_SESSION_ARTWORK_REVISION,
    "2026-08-17-1",
  )
  assert.equal(
    getAtmosphereStationArtworkUrl("proof/drone", 512),
    "/api/atmosphere/stations/proof%2Fdrone/artwork?size=512&v=2026-08-17-1",
  )
  assert.equal(
    getAtmosphereStationArtworkUrl("proof/drone", 256),
    "/api/atmosphere/stations/proof%2Fdrone/artwork?size=256&v=2026-08-17-1",
  )
})

test("platform artwork route isolates the revisioned 512 derivative from legacy PNGs", () => {
  const routeSource = readFileSync(
    new URL("../app/api/atmosphere/stations/[stationId]/artwork/route.tsx", import.meta.url),
    "utf8",
  )

  assert.match(routeSource, /const url = new URL\(request\.url\)/)
  assert.match(routeSource, /parseArtworkSize\(url\.searchParams\.get\("size"\)\)/)
  assert.match(
    routeSource,
    /platformDerivative\s*=\s*size === 512\s*&&\s*url\.searchParams\.get\("v"\)\s*===\s*ATMOSPHERE_MEDIA_SESSION_ARTWORK_REVISION/,
  )
  assert.match(routeSource, /sharp\(Buffer\.from\(svg\), \{ density: 153\.6 \}\)/)
  assert.match(routeSource, /\.resize\(512, 512, \{ fit: "fill" \}\)\s*\.sharpen\(\)/)
  assert.match(routeSource, /sharp\(Buffer\.from\(svg\)\)\s*\.resize\(size, size, \{ fit: "fill" \}\)/)
  assert.match(routeSource, /\.toBuffer\(\{ resolveWithObject: true \}\)/)
  assert.match(routeSource, /info\.width !== size \|\| info\.height !== size/)
  assert.doesNotMatch(routeSource, /\.contrast\(|\.modulate\(|\.gamma\(|\b1024\b/)
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

test("physically reviewed station SVG serialization remains byte-identical", () => {
  const expectedHashes = new Map([
    ["mlab-proof-drone", "d6a5c73be68fb4e6e9e52a5e3ae78ee65b7b14ead30f4b6ca04b60395997b4c4"],
    ["generative-fm-trees", "f5d91f625fd508400b96a0af1f23defaa3002d552c3a314407b23d65d1fa9e42"],
    ["generative-fm-420hz-gamma-waves-for-big-brain", "9c5d5efb8e05e63eee2327f716b99a7acfa53af78cda7640392f0e7fc3bf10f1"],
  ])

  for (const [stationId, expectedHash] of expectedHashes) {
    const svg = renderAtmosphereStationArtworkSvg(stationInput(stationId))
    assert.equal(createHash("sha256").update(svg).digest("hex"), expectedHash)
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
