"use client"

import { Heart, Play, Square } from "lucide-react"
import { AtmosphereStationArtwork } from "@/components/atmosphere/station-artwork"
import { MusicLoadingProgress } from "@/components/providers/music-loading-progress"
import type { useMusic } from "@/components/providers/music-provider"
import { AppNotice, appMediaTileClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import type { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { cn } from "@/lib/utils"

export type AtmosphereStation = ReturnType<typeof getVisibleAtmosphereStations>[number]

export interface AtmosphereStationCarouselCardProps {
  groupId: string
  music: ReturnType<typeof useMusic>
  prewarmStation: (
    stationId: string,
    options?: { includeSamplePayloads?: boolean },
  ) => void
  station: AtmosphereStation
  detailLevel?: "full" | "summary"
}

/**
 * Renders the production Atmosphere rail card or its inert artwork/title
 * summary. Playback, favorite, loading, attribution, and prewarm behavior stay
 * exclusive to the full card so Carousel Lab centering cannot trigger actions.
 */
export function AtmosphereStationCarouselCard({
  groupId,
  music,
  prewarmStation,
  station,
  detailLevel = "full",
}: AtmosphereStationCarouselCardProps) {
  const isActive = music.activeStationId === station.id
  const isFavorite = music.favorites.includes(station.id)

  if (detailLevel === "summary") {
    return (
      <article
        id={`station-${station.id}`}
        className={cn(
          appMediaTileClassName,
          "flex min-w-[min(58vw,10.75rem)] snap-start flex-col overflow-hidden transition-colors sm:min-w-[10.875rem] lg:min-w-[11.25rem] xl:min-w-[11.625rem]",
          isActive && "border-primary/80 shadow-lg shadow-primary/15",
        )}
      >
        <div className="relative aspect-[4/3] rounded-[9px] bg-background p-1">
          <AtmosphereStationArtwork
            description={station.description}
            groupId={groupId}
            stationId={station.id}
            title={station.title}
          />
        </div>
        <div className="p-2">
          <h3 className="truncate text-sm font-semibold tracking-normal">{station.title}</h3>
        </div>
      </article>
    )
  }

  const attributionText = stationAttributionText(station)
  const attributionHref = station.attribution.notice ? "" : station.attribution.sourceUrl

  return (
    <article
      id={`station-${station.id}`}
      className={cn(
        appMediaTileClassName,
        "flex min-w-[min(58vw,10.75rem)] snap-start flex-col overflow-hidden transition-colors sm:min-w-[10.875rem] lg:min-w-[11.25rem] xl:min-w-[11.625rem]",
        isActive && "border-primary/80 shadow-lg shadow-primary/15",
      )}
      onFocus={() => prewarmStation(station.id)}
      onPointerEnter={() => prewarmStation(station.id, {
        includeSamplePayloads: canPrewarmCompressedSamplePayloads(),
      })}
    >
      <div className="relative aspect-[4/3] rounded-[9px] bg-background p-1">
        <AtmosphereStationArtwork
          description={station.description}
          groupId={groupId}
          stationId={station.id}
          title={station.title}
        />
        {isActive && music.playbackState === "loading" ? (
          <div className="absolute inset-x-2 bottom-2 rounded-md border border-background/30 bg-background/80 p-2 backdrop-blur">
            <MusicLoadingProgress compact progress={music.loadingProgress} startedAt={music.loadingStartedAt} />
          </div>
        ) : null}
      </div>
      <div className="flex min-h-[8.25rem] flex-1 flex-col gap-2 p-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-normal">{station.title}</h3>
          <p className="mt-1 min-h-[2.5rem] overflow-hidden text-xs leading-5 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {station.description}
          </p>
        </div>

        {attributionText ? (
          <p className="truncate text-xs text-muted-foreground">
            {attributionHref ? (
              <a
                className="underline-offset-4 hover:underline"
                href={attributionHref}
                rel={isExternalUrl(attributionHref) ? "noreferrer" : undefined}
                target={isExternalUrl(attributionHref) ? "_blank" : undefined}
              >
                {attributionText}
              </a>
            ) : attributionText}
          </p>
        ) : null}

        {!station.enabled && station.disabledReason ? (
          <AppNotice tone="default" title="Not playable yet" description={station.disabledReason} />
        ) : null}

        <div className="mt-auto flex items-center gap-2">
          <Button
            aria-label={isActive ? `Restart ${station.title}` : `Play ${station.title}`}
            className="flex-1"
            disabled={!station.enabled || music.playbackState === "loading"}
            onClick={() => {
              void music.playStation(station.id)
            }}
            onFocus={() => prewarmStation(station.id)}
            onPointerDown={() => prewarmStation(station.id)}
            size="sm"
          >
            <Play aria-hidden="true" />
            {isActive ? "Restart" : "Play"}
          </Button>
          {isActive ? (
            <Button
              aria-label={`Stop ${station.title}`}
              onClick={() => void music.stopCurrent()}
              size="icon"
              title={`Stop ${station.title}`}
              variant="outline"
            >
              <Square aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            aria-label={isFavorite ? `Remove ${station.title} from favorites` : `Favorite ${station.title}`}
            onClick={() => music.toggleFavorite(station.id)}
            size="icon"
            title={isFavorite ? "Favorited" : "Favorite"}
            variant="ghost"
          >
            <Heart aria-hidden="true" className={cn(isFavorite && "fill-primary text-primary")} />
          </Button>
        </div>
      </div>
    </article>
  )
}

export function stationAttributionText(station: AtmosphereStation) {
  const notice = station.attribution.notice.trim()
  if (notice) {
    return notice
  }

  const artist = station.attribution.artist.trim()
  const license = station.attribution.license.trim()
  if (artist && license) {
    return `${artist} · ${license}`
  }

  return artist || license
}

export function isExternalUrl(href: string) {
  return /^https?:\/\//i.test(href)
}

/**
 * Decides whether idle/hover warmup may fetch compressed audio payloads.
 *
 * Payload warmup is skipped when the browser reports data-saver mode, but when
 * connection information is unavailable we assume a normal connection so
 * browsers without the Network Information API can still benefit from warmup.
 */
export function canPrewarmCompressedSamplePayloads() {
  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: string
      saveData?: boolean
    }
  }).connection
  if (connection?.saveData) {
    return false
  }

  return !["slow-2g", "2g"].includes(connection?.effectiveType ?? "")
}
