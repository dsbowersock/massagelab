import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildAtmosphereFavoritesSpeedDialModel,
  getAtmosphereFavoritesMosaicLayout,
} from "../lib/atmosphere/favorites-speed-dial.js"

const expectedSpans = {
  0: [[1, 1, 6]],
  1: [[1, 1, 6]],
  2: [[1, 1, 6], [2, 1, 6]],
  3: [[1, 1, 3], [1, 4, 3], [2, 1, 6]],
  4: [[1, 1, 3], [1, 4, 3], [2, 1, 3], [2, 4, 3]],
  5: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 3], [2, 4, 3]],
  6: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2]],
  7: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 6]],
  8: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 3], [3, 4, 3]],
  9: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 2], [3, 3, 2], [3, 5, 2]],
}

const stations = Array.from({ length: 11 }, (_, index) => ({
  id: `station-${index + 1}`,
  title: `Station ${index + 1}`,
  enabled: index !== 4,
}))

describe("Atmosphere Favorites speed dial", () => {
  it("maps zero through nine destinations to the approved six-column layouts", () => {
    for (const [count, expected] of Object.entries(expectedSpans)) {
      const actual = getAtmosphereFavoritesMosaicLayout(Number(count))
        .map(({ row, column, columnSpan }) => [row, column, columnSpan])
      assert.deepEqual(actual, expected)
    }
  })

  it("keeps valid favorites newest-first and omits unknown and repeated IDs", () => {
    const model = buildAtmosphereFavoritesSpeedDialModel(
      ["station-3", "missing", "station-1", "station-3", "station-5"],
      stations,
    )
    assert.deepEqual(model.allFavorites.map(({ id }) => id), ["station-3", "station-1", "station-5"])
    assert.equal(model.allFavorites[2].enabled, false)
  })

  it("uses eight newest stations and one collection destination above nine favorites", () => {
    const model = buildAtmosphereFavoritesSpeedDialModel(
      stations.map(({ id }) => id),
      stations,
    )
    assert.deepEqual(model.destinations.slice(0, 8).map(({ station }) => station.id),
      stations.slice(0, 8).map(({ id }) => id))
    assert.deepEqual(model.destinations[8], { kind: "all-favorites", count: 11 })
    assert.equal(model.layout.length, 9)
  })

  it("returns one empty destination when no valid favorite remains", () => {
    const model = buildAtmosphereFavoritesSpeedDialModel(["missing"], stations)
    assert.deepEqual(model.destinations, [{ kind: "empty" }])
    assert.equal(model.layout.length, 1)
  })
})
