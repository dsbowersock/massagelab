"use client"

import { useState } from "react"
import { AtmosphereStationArtwork } from "@/components/atmosphere/station-artwork"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
  const [allFavoritesOpen, setAllFavoritesOpen] = useState(false)

  const renderStationDestination = (station: (typeof stations)[number], location: "mosaic" | "collection") => (
    <FavoriteStationTile
      busy={busy}
      collection={location === "collection"}
      onPlayStation={onPlayStation}
      playing={station.id === playingStationId}
      station={station}
    />
  )

  return (
    <section
      aria-busy={busy ? "true" : "false"}
      aria-labelledby="atmosphere-favorites-heading"
      className="ml-atmosphere-favorites-region"
      data-testid="atmosphere-favorites-region"
    >
      <h2 id="atmosphere-favorites-heading">Favorites</h2>
      {busy ? (
        <p aria-live="polite" className="sr-only" role="status">
          Favorites are unavailable while audio prepares.
        </p>
      ) : null}
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
                renderStationDestination(destination.station, "mosaic")
              ) : destination.kind === "empty" ? (
                <EmptyFavoriteTile centeredStation={centeredStation} onAddFavorite={onAddFavorite} />
              ) : (
                <Sheet open={allFavoritesOpen} onOpenChange={setAllFavoritesOpen}>
                  <SheetTrigger asChild>
                    <button
                      aria-label={`All favorites, ${destination.count} stations`}
                      className="ml-atmosphere-favorite-tile ml-atmosphere-favorite-collection"
                      data-favorite-destination="all-favorites"
                      type="button"
                    >
                      <span>All favorites</span>
                      <strong>{destination.count}</strong>
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    className="ml-atmosphere-all-favorites-sheet max-h-[min(80dvh,42rem)]"
                    side="bottom"
                  >
                    <SheetHeader>
                      <SheetTitle>All favorites</SheetTitle>
                      <SheetDescription>Start any saved Atmosphere station.</SheetDescription>
                    </SheetHeader>
                    <div className="ml-atmosphere-all-favorites-grid">
                      {model.allFavorites.map((station) => (
                        <div key={station.id}>
                          {renderStationDestination(station, "collection")}
                        </div>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
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
  collection = false,
  onPlayStation,
}: {
  station: (typeof stations)[number]
  playing: boolean
  busy: boolean
  collection?: boolean
  onPlayStation: (stationId: string) => void
}) {
  const unavailable = !station.enabled
  const disabled = busy || unavailable
  const label = getFavoriteStationActionLabel(station, { playing, unavailable })

  return (
    <button
      aria-current={playing ? "true" : undefined}
      aria-disabled={playing || disabled}
      aria-label={label}
      className="ml-atmosphere-favorite-tile"
      data-all-favorite-station={collection ? "" : undefined}
      data-favorite-destination="station"
      data-station-id={collection ? station.id : undefined}
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

/**
 * Keeps Favorite mosaic and collection controls on one accessibility contract:
 * only an active station is focusable-but-inert, while unavailable stations
 * remain plainly identified without introducing alternate playback controls.
 */
function getFavoriteStationActionLabel(
  station: (typeof stations)[number],
  { playing, unavailable }: { playing: boolean; unavailable: boolean },
) {
  if (playing) return `${station.title} playing`
  if (unavailable) return `${station.title} unavailable`
  return station.title
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
