"use client"

import { useState } from "react"
import { AtmosphereStationArtwork } from "@/components/atmosphere/station-artwork"
import { appMediaTileClassName } from "@/components/ui/app-surface"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  buildAtmosphereFavoritesSpeedDialModel,
  getAtmosphereFavoriteStationTileState,
} from "@/lib/atmosphere/favorites-speed-dial"
import { resolveAtmosphereStationArtworkInput } from "@/lib/atmosphere/station-artwork"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"

const stations = getVisibleAtmosphereStations()
type AtmosphereFavoriteStation = (typeof stations)[number]
const favoriteTileClassName = `${appMediaTileClassName} ml-atmosphere-favorite-tile`

export type AtmosphereFavoritesSpeedDialProps = {
  favoriteIds: string[]
  playingStationId: string | null
  busy: boolean
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
  playingStationId,
  busy,
  onPlayStation,
}: AtmosphereFavoritesSpeedDialProps) {
  const model = buildAtmosphereFavoritesSpeedDialModel(favoriteIds, stations)
  const [allFavoritesOpen, setAllFavoritesOpen] = useState(false)

  const renderStationDestination = (station: AtmosphereFavoriteStation, location: "mosaic" | "collection") => (
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
      aria-label="Favorites"
      className="ml-atmosphere-favorites-region"
      data-testid="atmosphere-favorites-region"
    >
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
                <EmptyFavoriteTile />
              ) : (
                <Sheet open={allFavoritesOpen} onOpenChange={setAllFavoritesOpen}>
                  <SheetTrigger asChild>
                    <button
                      aria-label={`All favorites, ${destination.count} stations`}
                      className={`${favoriteTileClassName} ml-atmosphere-favorite-collection`}
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
  station: AtmosphereFavoriteStation
  playing: boolean
  busy: boolean
  collection?: boolean
  onPlayStation: (stationId: string) => void
}) {
  const tileState = getAtmosphereFavoriteStationTileState(station, { busy, playing })

  return (
    <button
      aria-current={playing ? "true" : undefined}
      aria-disabled={tileState.ariaDisabled}
      aria-label={tileState.ariaLabel}
      className={favoriteTileClassName}
      data-all-favorite-station={collection ? "" : undefined}
      data-favorite-destination="station"
      data-station-id={collection ? station.id : undefined}
      disabled={tileState.disabled}
      onClick={() => {
        if (!tileState.canPlay) return
        onPlayStation(station.id)
      }}
      type="button"
    >
      <AtmosphereStationArtwork artworkInput={resolveAtmosphereStationArtworkInput(station)} decorative />
      <span>{station.title}</span>
    </button>
  )
}

function EmptyFavoriteTile() {
  return (
    <div className={`${favoriteTileClassName} ml-atmosphere-favorite-empty`} data-favorite-destination="empty">
      <strong>Add favorites to make your speed dial</strong>
      <span>Heart a station and it will appear here.</span>
    </div>
  )
}
