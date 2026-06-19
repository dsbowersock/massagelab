"use client"

import { useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Heart, Play, Radio, Square, Wind } from "lucide-react"
import { AppNotice, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { useMusic } from "@/components/providers/music-provider"
import { MusicLoadingProgress } from "@/components/providers/music-loading-progress"
import { AtmosphereStationArtwork } from "@/components/atmosphere/station-artwork"
import { groupAtmosphereStations } from "@/lib/atmosphere/station-groups"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { cn } from "@/lib/utils"

const stations = getVisibleAtmosphereStations()
const stationGroups = groupAtmosphereStations(stations)
const generativeFmStations = stations.filter((station) => station.sourceType === "generative-fm-piece")
const playableGenerativeFmStationCount = generativeFmStations.filter((station) => station.enabled).length
const pendingGenerativeFmStationCount = generativeFmStations.length - playableGenerativeFmStationCount
const generativeFmCatalogStatusText = pendingGenerativeFmStationCount > 0
  ? ` ${playableGenerativeFmStationCount} hosted Generative.fm ${playableGenerativeFmStationCount === 1 ? "station is" : "stations are"} playable now; ${pendingGenerativeFmStationCount} more ${pendingGenerativeFmStationCount === 1 ? "station is" : "stations are"} being prepared.`
  : ` All ${playableGenerativeFmStationCount} hosted Generative.fm stations are playable now.`
const initialPrewarmStationIdSet = new Set([
  "observable-streams-probe",
  "generative-fm-aisatsana",
  "generative-fm-at-sunrise",
  "generative-fm-day-dream",
  "generative-fm-eno-machine",
  "generative-fm-lemniscate",
  "generative-fm-peace",
  "generative-fm-trees",
])
const initialPrewarmableGenerativeFmStationIds = generativeFmStations
  .filter((station) => station.enabled && initialPrewarmStationIdSet.has(station.id))
  .map((station) => station.id)
const initialPayloadPrewarmStationIdSet = new Set([
  "observable-streams-probe",
  "generative-fm-aisatsana",
  "generative-fm-day-dream",
])

type AtmosphereStation = (typeof stations)[number]
type AtmosphereStationGroup = (typeof stationGroups)[number]
type AtmosphereWorkspaceLayout = "grid" | "rails"

export function AtmosphereWorkspace({ layout = "grid" }: { layout?: AtmosphereWorkspaceLayout } = {}) {
  const music = useMusic()
  const { prewarmStation: prewarmMusicStation } = music
  const isRailLayout = layout === "rails"
  const prewarmStation = useCallback((stationId: string, options: { includeSamplePayloads?: boolean } = {}) => {
    void prewarmMusicStation(stationId, options)
  }, [prewarmMusicStation])

  // Keep background work small: warm only likely starter stations after initial
  // paint, then let user intent drive metadata/module warmups for the rest.
  useEffect(() => {
    if (initialPrewarmableGenerativeFmStationIds.length === 0) {
      return undefined
    }

    let cancelled = false
    const timeoutHandles: number[] = []
    const prewarmPlayableStations = () => {
      const includeStarterPayloads = canPrewarmCompressedSamplePayloads()
      initialPrewarmableGenerativeFmStationIds.forEach((stationId, index) => {
        const timeoutHandle = window.setTimeout(() => {
          if (!cancelled) {
            prewarmStation(stationId, {
              includeSamplePayloads: includeStarterPayloads && initialPayloadPrewarmStationIdSet.has(stationId),
            })
          }
        }, index * 75)
        timeoutHandles.push(timeoutHandle)
      })
    }

    const idleHandle = window.requestIdleCallback
      ? window.requestIdleCallback(prewarmPlayableStations, { timeout: 2_500 })
      : window.setTimeout(prewarmPlayableStations, 1_000)

    return () => {
      cancelled = true
      timeoutHandles.forEach((timeoutHandle) => window.clearTimeout(timeoutHandle))
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(idleHandle)
      } else {
        window.clearTimeout(idleHandle)
      }
    }
  }, [prewarmStation])

  return (
    <AppPageShell width="full" contentClassName="pb-28">
      {isRailLayout ? (
        <h1 className="sr-only">Atmosphere audio stations</h1>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-normal text-primary">Atmosphere</p>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Wellness audio stations
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Start a station, move to another MassageLab tool, and the bottom player keeps control of the sound.
                {generativeFmCatalogStatusText}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/wellness">Wellness hub</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/wellness/breathing">
                    <Wind aria-hidden="true" />
                    Breathing guide
                  </Link>
                </Button>
              </div>
            </div>
            <AppNotice
              tone="accent"
              title="Station tuner"
              description="Stations are grouped by listening feel so calm defaults, water textures, drones, and experimental pieces are easier to choose."
            />
          </div>
        </section>
      )}

      <div className={isRailLayout ? "space-y-9" : "space-y-8"}>
        {stationGroups.map((group) => (
          isRailLayout ? (
            <AtmosphereStationRail
              key={group.id}
              group={group}
              music={music}
              prewarmStation={prewarmStation}
            />
          ) : (
            <AtmosphereStationGrid
              key={group.id}
              group={group}
              music={music}
              prewarmStation={prewarmStation}
            />
          )
        ))}
      </div>
    </AppPageShell>
  )
}

function AtmosphereStationGrid({
  group,
  music,
  prewarmStation,
}: {
  group: AtmosphereStationGroup
  music: ReturnType<typeof useMusic>
  prewarmStation: (stationId: string, options?: { includeSamplePayloads?: boolean }) => void
}) {
  return (
    <section
      aria-labelledby={`station-group-${group.id}`}
      className="space-y-3"
    >
      <div>
        <h2 id={`station-group-${group.id}`} className="text-xl font-semibold tracking-normal">
          {group.title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{group.description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {group.stations.map((station) => (
          <AtmosphereStationGridCard
            key={station.id}
            music={music}
            prewarmStation={prewarmStation}
            station={station}
          />
        ))}
      </div>
    </section>
  )
}

function AtmosphereStationGridCard({
  music,
  prewarmStation,
  station,
}: {
  music: ReturnType<typeof useMusic>
  prewarmStation: (stationId: string, options?: { includeSamplePayloads?: boolean }) => void
  station: AtmosphereStation
}) {
  const isActive = music.activeStationId === station.id
  const isFavorite = music.favorites.includes(station.id)
  const attributionText = stationAttributionText(station)
  const attributionHref = station.attribution.notice ? "" : station.attribution.sourceUrl

  return (
    <div
      id={`station-${station.id}`}
      onFocus={() => prewarmStation(station.id)}
      onPointerEnter={() => prewarmStation(station.id, {
        includeSamplePayloads: canPrewarmCompressedSamplePayloads(),
      })}
    >
      <AppSurface
        title={station.title}
        icon={<Radio aria-hidden="true" className="size-5" />}
        badge={station.enabled ? "Playable" : "Samples pending"}
        className={cn(isActive && "border-primary/70")}
        contentClassName="gap-4"
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{station.description}</p>
          {attributionText ? (
            <p className="text-xs text-muted-foreground">
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
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!station.enabled || music.playbackState === "loading"}
            onClick={() => {
              void music.playStation(station.id)
            }}
            onFocus={() => prewarmStation(station.id)}
            onPointerDown={() => prewarmStation(station.id)}
          >
            <Play aria-hidden="true" />
            {isActive ? "Restart station" : "Play station"}
          </Button>
          {isActive ? (
            <Button variant="outline" onClick={() => void music.stopCurrent()}>
              <Square aria-hidden="true" />
              Stop
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => music.toggleFavorite(station.id)}>
            <Heart aria-hidden="true" className={cn(isFavorite && "fill-primary text-primary")} />
            {isFavorite ? "Favorited" : "Favorite"}
          </Button>
        </div>
        {isActive && music.playbackState === "loading" ? (
          <MusicLoadingProgress
            progress={music.loadingProgress}
            startedAt={music.loadingStartedAt}
          />
        ) : null}
      </AppSurface>
    </div>
  )
}

function AtmosphereStationRail({
  group,
  music,
  prewarmStation,
}: {
  group: AtmosphereStationGroup
  music: ReturnType<typeof useMusic>
  prewarmStation: (stationId: string, options?: { includeSamplePayloads?: boolean }) => void
}) {
  const railRef = useRef<HTMLDivElement | null>(null)

  function scrollRail(direction: 1 | -1) {
    const rail = railRef.current
    if (!rail) {
      return
    }

    rail.scrollBy({
      behavior: "smooth",
      left: direction * Math.min(rail.clientWidth * 0.9, 760),
    })
  }

  return (
    <section
      aria-labelledby={`station-group-${group.id}`}
      className="group/station-rail space-y-3"
      data-testid={`station-rail-${group.id}`}
    >
      <div className="max-w-3xl">
        <h2 id={`station-group-${group.id}`} className="text-xl font-semibold tracking-normal">
          {group.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
      </div>
      <div className="relative">
        <div
          aria-label={`${group.title} station rail controls`}
          className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 hidden items-center justify-between px-2 opacity-0 transition-opacity duration-150 [@media(hover:hover)_and_(pointer:fine)]:flex [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/station-rail:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/station-rail:opacity-100 sm:px-4"
          data-testid={`station-rail-controls-${group.id}`}
        >
          <Button
            aria-label={`Previous ${group.title} stations`}
            className="pointer-events-auto rounded-full border-background/40 bg-background/85 shadow-lg backdrop-blur hover:bg-background"
            onClick={() => scrollRail(-1)}
            size="icon"
            title={`Previous ${group.title} stations`}
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            aria-label={`Next ${group.title} stations`}
            className="pointer-events-auto rounded-full border-background/40 bg-background/85 shadow-lg backdrop-blur hover:bg-background"
            onClick={() => scrollRail(1)}
            size="icon"
            title={`Next ${group.title} stations`}
            variant="outline"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <div
          ref={railRef}
          aria-label={`${group.title} stations`}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 scroll-smooth [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {group.stations.map((station) => (
            <AtmosphereStationCard
              groupId={group.id}
              key={station.id}
              music={music}
              prewarmStation={prewarmStation}
              station={station}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function AtmosphereStationCard({
  groupId,
  music,
  prewarmStation,
  station,
}: {
  groupId: string
  music: ReturnType<typeof useMusic>
  prewarmStation: (stationId: string, options?: { includeSamplePayloads?: boolean }) => void
  station: AtmosphereStation
}) {
  const isActive = music.activeStationId === station.id
  const isFavorite = music.favorites.includes(station.id)
  const attributionText = stationAttributionText(station)
  const attributionHref = station.attribution.notice ? "" : station.attribution.sourceUrl

  return (
    <article
      id={`station-${station.id}`}
      className={cn(
        "flex min-w-[min(72vw,14.25rem)] snap-start flex-col overflow-hidden rounded-md border border-border/80 bg-card shadow-sm transition-colors sm:min-w-[14.5rem] lg:min-w-[15rem] xl:min-w-[15.5rem]",
        isActive && "border-primary/80 shadow-lg shadow-primary/15",
      )}
      onFocus={() => prewarmStation(station.id)}
      onPointerEnter={() => prewarmStation(station.id, {
        includeSamplePayloads: canPrewarmCompressedSamplePayloads(),
      })}
    >
      <div className="relative aspect-[4/3] bg-background">
        <AtmosphereStationArtwork
          description={station.description}
          groupId={groupId}
          stationId={station.id}
          title={station.title}
        />
        <div className="absolute left-2 top-2 rounded-md border border-background/40 bg-background/80 px-2 py-1 text-[0.7rem] font-medium text-foreground shadow-sm backdrop-blur">
          {station.enabled ? "Playable" : "Samples pending"}
        </div>
        {isActive && music.playbackState === "loading" ? (
          <div className="absolute inset-x-2 bottom-2 rounded-md border border-background/30 bg-background/80 p-2 backdrop-blur">
            <MusicLoadingProgress compact progress={music.loadingProgress} startedAt={music.loadingStartedAt} />
          </div>
        ) : null}
      </div>
      <div className="flex min-h-[11rem] flex-1 flex-col gap-2.5 p-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-normal">{station.title}</h3>
          <p className="mt-1 min-h-[3.25rem] overflow-hidden text-xs leading-5 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
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

function stationAttributionText(station: (typeof stations)[number]) {
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

function isExternalUrl(href: string) {
  return /^https?:\/\//i.test(href)
}

/**
 * Decides whether idle/hover warmup may fetch compressed audio payloads.
 *
 * Payload warmup is skipped when the browser reports data-saver mode, but when
 * connection information is unavailable we assume a normal connection so
 * browsers without the Network Information API can still benefit from warmup.
 */
function canPrewarmCompressedSamplePayloads() {
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
