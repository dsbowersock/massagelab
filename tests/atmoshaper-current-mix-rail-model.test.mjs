import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  captureAtmoShaperMuteSnapshot,
  resolveAtmoShaperSoloToggle,
} from "../components/atmoshaper/current-mix-rail-model.js"

const layers = [
  { id: "rain", muted: false },
  { id: "brown", muted: true },
  { id: "station", muted: false },
]

describe("AtmoShaper collapsed-rail solo model", () => {
  it("captures the exact pre-solo mute pattern", () => {
    assert.deepEqual(captureAtmoShaperMuteSnapshot(layers), {
      rain: false,
      brown: true,
      station: false,
    })
  })

  it("solos one layer while retaining the original snapshot", () => {
    const result = resolveAtmoShaperSoloToggle({
      activeSoloLayerId: null,
      layers,
      layerId: "brown",
      muteSnapshot: null,
    })

    assert.equal(result.activeSoloLayerId, "brown")
    assert.deepEqual(result.muteSnapshot, { rain: false, brown: true, station: false })
    assert.deepEqual(result.mutedByLayerId, { rain: true, brown: false, station: true })
  })

  it("switches the solo target without replacing the original snapshot", () => {
    const snapshot = { rain: false, brown: true, station: false }
    const result = resolveAtmoShaperSoloToggle({
      activeSoloLayerId: "brown",
      layers,
      layerId: "station",
      muteSnapshot: snapshot,
    })

    assert.equal(result.activeSoloLayerId, "station")
    assert.equal(result.muteSnapshot, snapshot)
    assert.deepEqual(result.mutedByLayerId, { rain: true, brown: true, station: false })
  })

  it("turns solo off by restoring the exact captured mute pattern", () => {
    const snapshot = { rain: false, brown: true, station: false }
    const result = resolveAtmoShaperSoloToggle({
      activeSoloLayerId: "brown",
      layers,
      layerId: "brown",
      muteSnapshot: snapshot,
    })

    assert.equal(result.activeSoloLayerId, null)
    assert.equal(result.muteSnapshot, null)
    assert.deepEqual(result.mutedByLayerId, snapshot)
  })
})
