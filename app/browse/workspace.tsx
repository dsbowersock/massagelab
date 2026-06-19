"use client"

import { useCallback, useEffect } from "react"
import Link from "next/link"
import { Heart, Play, Radio, Square, Wind } from "lucide-react"
import { AppNotice, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { useMusic } from "@/components/providers/music-provider"
import { MusicLoadingProgress } from "@/components/providers/music-loading-progress"
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

export function AtmosphereWorkspace() {
  const music = useMusic()
  const { prewarmStation: prewarmMusicStation } = music
  const prewarmStation = useCallback((stationId: string) => {
    void prewarmMusicStation(stationId)
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
      initialPrewarmableGenerativeFmStationIds.forEach((stationId, index) => {
        const timeoutHandle = window.setTimeout(() => {
          if (!cancelled) {
            prewarmStation(stationId)
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

      <div className="space-y-8">
        {stationGroups.map((group) => (
          <section
            key={group.id}
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
              {group.stations.map((station) => {
                const isActive = music.activeStationId === station.id
                const isFavorite = music.favorites.includes(station.id)
                const attributionText = stationAttributionText(station)
                const attributionHref = station.attribution.notice ? "" : station.attribution.sourceUrl

                return (
                  <div
                    id={`station-${station.id}`}
                    key={station.id}
                    onFocus={() => prewarmStation(station.id)}
                    onPointerEnter={() => prewarmStation(station.id)}
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
                                href={attributionHref}
                                target={isExternalUrl(attributionHref) ? "_blank" : undefined}
                                rel={isExternalUrl(attributionHref) ? "noreferrer" : undefined}
                                className="underline-offset-4 hover:underline"
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
                          onClick={() => {
                            void music.playStation(station.id)
                          }}
                          onFocus={() => prewarmStation(station.id)}
                          onPointerDown={() => prewarmStation(station.id)}
                          disabled={!station.enabled || music.playbackState === "loading"}
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
              })}
            </div>
          </section>
        ))}
      </div>
    </AppPageShell>
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
