"use client"

import { AtmosphereStationArtwork } from "@/components/atmosphere/station-artwork"
import { Button } from "@/components/ui/button"
import { buildAtmosphereFavoritesSpeedDialModel } from "@/lib/atmosphere/favorites-speed-dial"
import { resolveAtmosphereStationArtworkInput } from "@/lib/atmosphere/station-artwork"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"

const stations = getVisibleAtmosphereStations()

export type AtmosphereFavoritesSpeedDialProps = {
  favoriteIds: string[]
  centeredStationId: string | null
  playingStationId: string | null
  busy: boolean
  onAddFavorite: (stationId: string) => void
  onPlayStation: (stationId: string) => void
}

/**
 * Shows the user's bounded, newest-first Favorites collection below the Station
 * carousel. A favorite tile starts or switches stations only: Pause and Stop
 * intentionally remain player-rail actions so a mosaic never becomes a second
 * playback authority.
 */
export function AtmosphereFavoritesSpeedDial({
  favoriteIds,
  centeredStationId,
  playingStationId,
  busy,
  onAddFavorite,
  onPlayStation,
}: AtmosphereFavoritesSpeedDialProps) {
  const model = buildAtmosphereFavoritesSpeedDialModel(favoriteIds, stations)
  const centeredStation = stations.find((station) => station.id === centeredStationId) ?? null

  return (
    <section
      aria-busy={busy}
      aria-labelledby="atmosphere-favorites-heading"
      className="ml-atmosphere-favorites-region"
      data-testid="atmosphere-favorites-region"
    >
      <h2 id="atmosphere-favorites-heading">Favorites</h2>
      <div className="ml-atmosphere-favorites-mosaic" data-testid="atmosphere-favorites-mosaic">
        {model.destinations.map((destination, index) => {
          const placement = model.layout[index]
          return (
            <div
              key={destination.kind === "station" ? destination.station.id : destination.kind}
              data-layout-row={placement.row}
              data-layout-column={placement.column}
              data-layout-column-span={placement.columnSpan}
              style={{
                gridRow: placement.row,
                gridColumn: `${placement.column} / span ${placement.columnSpan}`,
              }}
            >
              {destination.kind === "station" ? (
                <FavoriteStationTile
                  busy={busy}
                  onPlayStation={onPlayStation}
                  playing={destination.station.id === playingStationId}
                  station={destination.station}
                />
              ) : destination.kind === "empty" ? (
                <EmptyFavoriteTile centeredStation={centeredStation} onAddFavorite={onAddFavorite} />
              ) : (
                <div className="ml-atmosphere-favorite-tile ml-atmosphere-favorite-collection" data-favorite-destination="all-favorites">
                  <span>All favorites</span>
                  <strong>{destination.count}</strong>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FavoriteStationTile({
  station,
  playing,
  busy,
  onPlayStation,
}: {
  station: (typeof stations)[number]
  playing: boolean
  busy: boolean
  onPlayStation: (stationId: string) => void
}) {
  const unavailable = !station.enabled
  const disabled = busy || unavailable

  return (
    <button
      aria-current={playing ? "true" : undefined}
      aria-disabled={playing || disabled}
      className="ml-atmosphere-favorite-tile"
      data-favorite-destination="station"
      disabled={disabled}
      onClick={() => {
        if (!playing && !disabled) onPlayStation(station.id)
      }}
      type="button"
    >
      <AtmosphereStationArtwork artworkInput={resolveAtmosphereStationArtworkInput(station)} decorative />
      <span>{station.title}</span>
    </button>
  )
}

function EmptyFavoriteTile({
  centeredStation,
  onAddFavorite,
}: {
  centeredStation: (typeof stations)[number] | null
  onAddFavorite: (stationId: string) => void
}) {
  if (!centeredStation) {
    return (
      <div className="ml-atmosphere-favorite-tile ml-atmosphere-favorite-empty" data-favorite-destination="empty">
        Choose a station to add a favorite.
      </div>
    )
  }

  return (
    <div className="ml-atmosphere-favorite-tile ml-atmosphere-favorite-empty" data-favorite-destination="empty">
      <AtmosphereStationArtwork artworkInput={resolveAtmosphereStationArtworkInput(centeredStation)} decorative />
      <span>{centeredStation.title}</span>
      <Button
        onClick={() => onAddFavorite(centeredStation.id)}
        size="compact"
        type="button"
        variant="glow"
      >
        Add {centeredStation.title} to favorites
      </Button>
    </div>
  )
}
