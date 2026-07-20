"use client"

import { useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Heart, Play, Radio, Square, Wind } from "lucide-react"
import { AppNotice, AppPageShell, AppSurface, appRailScrollerClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { useMusic } from "@/components/providers/music-provider"
import { MusicLoadingProgress } from "@/components/providers/music-loading-progress"
import {
  AtmosphereStationCarouselCard,
  canPrewarmCompressedSamplePayloads,
  isExternalUrl,
  stationAttributionText,
  type AtmosphereStation,
} from "@/components/atmosphere/station-carousel-card"
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
    <div className="relative min-h-screen overflow-hidden">
      <AppPageShell width="full" className="relative z-10 bg-transparent" contentClassName="pb-28">
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
    </div>
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
          className={cn(appRailScrollerClassName, "scroll-smooth")}
        >
          {group.stations.map((station) => (
            <AtmosphereStationCarouselCard
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
