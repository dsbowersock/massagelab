// @ts-check

/** @typedef {{ id: string, enabled: boolean }} FavoriteStation */
/**
 * @template {FavoriteStation} TStation
 * @typedef {{ kind: "station", station: TStation } | { kind: "all-favorites", count: number } | { kind: "empty" }} FavoriteDestination
 */
/** @typedef {{ index: number, row: number, column: number, columnSpan: number }} FavoriteMosaicPlacement */

export const ATMOSPHERE_FAVORITES_MOSAIC_LIMIT = 9

/** @type {Readonly<Record<number, ReadonlyArray<readonly [number, number, number]>>>} */
const layouts = Object.freeze({
  1: createImmutableLayout([[1, 1, 6]]),
  2: createImmutableLayout([[1, 1, 6], [2, 1, 6]]),
  3: createImmutableLayout([[1, 1, 3], [1, 4, 3], [2, 1, 6]]),
  4: createImmutableLayout([[1, 1, 3], [1, 4, 3], [2, 1, 3], [2, 4, 3]]),
  5: createImmutableLayout([[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 3], [2, 4, 3]]),
  6: createImmutableLayout([[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2]]),
  7: createImmutableLayout([[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 6]]),
  8: createImmutableLayout([[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 3], [3, 4, 3]]),
  9: createImmutableLayout([[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 2], [3, 3, 2], [3, 5, 2]]),
})

/**
 * Freezes a layout template without widening its fixed three-number tuples.
 *
 * @param {ReadonlyArray<readonly [number, number, number]>} placements
 * @returns {ReadonlyArray<readonly [number, number, number]>}
 */
function createImmutableLayout(placements) {
  return Object.freeze(placements.map((placement) => /** @type {readonly [number, number, number]} */ (
    Object.freeze([placement[0], placement[1], placement[2]])
  )))
}

/**
 * Retains the station discriminant while mapping the generic catalog shape.
 *
 * @template {FavoriteStation} TStation
 * @param {TStation} station
 * @returns {{ kind: "station", station: TStation }}
 */
function createStationDestination(station) {
  return { kind: "station", station }
}

/**
 * Converts a destination count into the approved six-column mosaic placements.
 * Zero and invalid counts use the one-tile empty-state layout; larger counts cap at nine.
 *
 * @param {number} destinationCount
 * @returns {FavoriteMosaicPlacement[]}
 */
export function getAtmosphereFavoritesMosaicLayout(destinationCount) {
  const normalizedCount = Number.isFinite(destinationCount) ? Math.trunc(destinationCount) : 0
  const count = Math.min(ATMOSPHERE_FAVORITES_MOSAIC_LIMIT, Math.max(1, normalizedCount))
  return layouts[count].map(([row, column, columnSpan], index) => ({
    index,
    row,
    column,
    columnSpan,
  }))
}

/**
 * Filters persisted favorite IDs against the current catalog and prepares the bounded mosaic.
 * Catalog order is never used: the persisted favorite sequence remains newest-first.
 *
 * @template {FavoriteStation} TStation
 * @param {readonly string[]} favoriteIds
 * @param {readonly TStation[]} stations
 * @returns {{ allFavorites: TStation[], destinations: FavoriteDestination<TStation>[], layout: FavoriteMosaicPlacement[] }}
 */
export function buildAtmosphereFavoritesSpeedDialModel(favoriteIds, stations) {
  const stationById = new Map(stations.map((station) => [station.id, station]))
  const seen = new Set()
  const allFavorites = favoriteIds.flatMap((stationId) => {
    const station = stationById.get(stationId)
    if (!station || seen.has(stationId)) return []
    seen.add(stationId)
    return [station]
  })
  /** @type {FavoriteDestination<TStation>[]} */
  const destinations = allFavorites.length === 0
    ? [{ kind: "empty" }]
    : allFavorites.length > ATMOSPHERE_FAVORITES_MOSAIC_LIMIT
      ? [
          ...allFavorites.slice(0, 8).map(createStationDestination),
          { kind: "all-favorites", count: allFavorites.length },
        ]
      : allFavorites.map(createStationDestination)

  return {
    allFavorites,
    destinations,
    layout: getAtmosphereFavoritesMosaicLayout(destinations.length),
  }
}
