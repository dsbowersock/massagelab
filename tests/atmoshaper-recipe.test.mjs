import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  ATMOSHAPER_PRESETS,
  addAtmoShaperLayer,
  createAtmoShaperRecipe,
  moveAtmoShaperLayer,
  normalizeAtmoShaperRecipe,
  removeAtmoShaperLayer,
  updateAtmoShaperLayer,
} from "../lib/atmoshaper/recipe.js"

test("a single sound is a valid mix and exclusive layer kinds replace their predecessor", () => {
  let recipe = createAtmoShaperRecipe({ id: "mix-1", name: "My atmosphere" })
  recipe = addAtmoShaperLayer(recipe, {
    id: "noise-1",
    kind: "noise",
    sourceId: "noise:pink",
    volume: 0.7,
    muted: false,
    settings: { color: "pink" },
  })
  assert.equal(recipe.layers.length, 1)

  recipe = addAtmoShaperLayer(recipe, stationLayer("station-a", "station:trees"))
  recipe = addAtmoShaperLayer(recipe, stationLayer("station-b", "station:peace"))
  assert.deepEqual(
    recipe.layers.filter(({ kind }) => kind === "station").map(({ sourceId }) => sourceId),
    ["station:peace"],
  )
})

test("normalization rejects unsupported versions and clamps unsafe values", () => {
  assert.throws(
    () => normalizeAtmoShaperRecipe({ version: 99, id: "future", name: "Future", layers: [] }),
    /unsupported AtmoShaper recipe version/i,
  )
  const normalized = normalizeAtmoShaperRecipe({
    version: 1,
    id: "mix-2",
    name: "Bounds",
    layers: [{
      id: "brainwave",
      kind: "binaural",
      sourceId: "binaural:advanced",
      volume: 4,
      muted: false,
      settings: { carrierHz: 4_000, beatHz: -2 },
    }],
  })
  assert.equal(normalized.layers[0].volume, 1)
  assert.deepEqual(normalized.layers[0].settings, { carrierHz: 600, beatHz: 0.5 })
})

test("isochronic settings clamp their carrier and pulse rate to safe bounds", () => {
  const normalized = normalizeAtmoShaperRecipe({
    version: 1,
    id: "mix-iso",
    name: "Pulse",
    layers: [{
      id: "pulse",
      kind: "isochronic",
      sourceId: "isochronic:advanced",
      volume: 0.5,
      muted: false,
      settings: { carrierHz: 1, pulseHz: 99 },
    }],
  })

  assert.deepEqual(normalized.layers[0].settings, { carrierHz: 80, pulseHz: 50 })
})

test("updates, removal, and ordering are immutable", () => {
  const original = addAtmoShaperLayer(
    addAtmoShaperLayer(createAtmoShaperRecipe({ id: "mix-3", name: "Order" }), noiseLayer("a")),
    noiseLayer("b"),
  )
  const updated = updateAtmoShaperLayer(original, "a", { volume: 0.25 })
  const moved = moveAtmoShaperLayer(updated, "b", 0)
  const removed = removeAtmoShaperLayer(moved, "a")
  assert.equal(original.layers[0].volume, 1)
  assert.deepEqual(moved.layers.map(({ id }) => id), ["b", "a"])
  assert.deepEqual(removed.layers.map(({ id }) => id), ["b"])
})

test("normalization rejects duplicate exclusive layers and updates cannot change kinds", () => {
  assert.throws(() => normalizeAtmoShaperRecipe({
    version: 1,
    id: "mix-exclusive",
    name: "Exclusive",
    layers: [
      stationLayer("station-a", "station:trees"),
      stationLayer("station-b", "station:peace"),
    ],
  }), /exclusive.*station/i)

  const recipe = addAtmoShaperLayer(
    createAtmoShaperRecipe({ id: "mix-update", name: "Update" }),
    noiseLayer("noise"),
  )
  assert.throws(
    () => updateAtmoShaperLayer(recipe, "noise", { kind: "station" }),
    /layer kind cannot change/i,
  )
})

test("all named brainwave presets stay inside the documented safe bounds", () => {
  assert.deepEqual(Object.keys(ATMOSHAPER_PRESETS), ["delta", "theta", "alpha", "beta", "gamma"])
  for (const preset of Object.values(ATMOSHAPER_PRESETS)) {
    assert.ok(preset.carrierHz >= 80 && preset.carrierHz <= 600)
    assert.ok(preset.rateHz >= 0.5 && preset.rateHz <= 50)
  }
})

test("public recipe JSDoc explains replacement, immutability, missing-layer, and safety intent", () => {
  const source = readFileSync(new URL("../lib/atmoshaper/recipe.js", import.meta.url), "utf8")
  for (const intent of [
    /exclusive[\s\S]*replace/i,
    /normalized new recipe[\s\S]*without mutating/i,
    /missing layer[\s\S]*normalized copy/i,
    /clamps?[\s\S]*runtime-safe bounds/i,
  ]) assert.match(source, intent)
})

test("normalization rejects malformed recipe and layer data", () => {
  const recipe = createAtmoShaperRecipe({ id: "mix-4", name: "Validation" })

  assert.throws(() => addAtmoShaperLayer(recipe, noiseLayer(" ")), /layer id/i)
  assert.throws(() => addAtmoShaperLayer(recipe, { ...noiseLayer("unknown"), kind: "other" }), /layer kind/i)
  assert.throws(() => addAtmoShaperLayer(recipe, { ...noiseLayer("bad-settings"), settings: [] }), /settings/i)
  assert.throws(() => normalizeAtmoShaperRecipe({ version: 1, id: "mix", name: " ", layers: [] }), /name/i)
  assert.throws(() => normalizeAtmoShaperRecipe({
    version: 1,
    id: "mix",
    name: "Duplicate",
    layers: [noiseLayer("same"), noiseLayer("same")],
  }), /duplicate.*layer id/i)
})

function noiseLayer(id) {
  return {
    id,
    kind: "noise",
    sourceId: `noise:${id}`,
    volume: 1,
    muted: false,
    settings: { color: "pink" },
  }
}

function stationLayer(id, sourceId) {
  return {
    id,
    kind: "station",
    sourceId,
    volume: 1,
    muted: false,
    settings: {},
  }
}
