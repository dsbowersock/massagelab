"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import { Heart, Play, Radio, Square, Wind } from "lucide-react"
import {
  AtmosphereStationCarousel,
  type AtmosphereStationCarouselView,
} from "@/components/atmosphere/station-carousel"
import { AtmosphereFavoritesSpeedDial } from "@/components/atmosphere/favorites-speed-dial"
import {
  STATION_CAROUSEL_LARGE_SCREEN_TUNING,
  STATION_CAROUSEL_TUNING,
} from "@/components/carousels/adaptive-carousel-model"
import { AppNotice, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { useMusic } from "@/components/providers/music-provider"
import { MusicLoadingProgress } from "@/components/providers/music-loading-progress"
import {
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

const FAVORITES_TO_CENTER_CARD_RATIO = STATION_CAROUSEL_LARGE_SCREEN_TUNING.favoritesRatio
const FAVORITES_MIN_SURROUNDING_GAP_PX = 4
const FAVORITES_BALANCED_FILL_RATIO = 0.8
const FAVORITES_MIN_USEFUL_EDGE_PX = STATION_CAROUSEL_TUNING.cardWidth

type AtmosphereFavoritesLayout = {
  edge: number
  fit: boolean
  scale: number
  top: number
}

type AtmosphereStationGroup = (typeof stationGroups)[number]
type AtmosphereWorkspaceLayout = "grid" | "rails"

export function AtmosphereWorkspace({ layout = "grid" }: { layout?: AtmosphereWorkspaceLayout } = {}) {
  const music = useMusic()
  const [centeredStationId, setCenteredStationId] = useState<string | null>(stations[0]?.id ?? null)
  const [atmosphereCarouselView, setAtmosphereCarouselView] = useState<AtmosphereStationCarouselView>("stations")
  const { prewarmStation: prewarmMusicStation } = music
  const isRailLayout = layout === "rails"
  const [carouselSlotRef, favoritesLayout] = useAtmosphereFavoritesLayout(
    centeredStationId,
    atmosphereCarouselView === "stations",
  )
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
    <div
      className={cn(
        "relative overflow-hidden",
        isRailLayout ? "h-full min-h-0" : "min-h-screen",
      )}
      data-atmosphere-workspace={isRailLayout ? "rails" : "grid"}
    >
      <AppPageShell
        width="full"
        className={cn(
          "relative z-10 bg-transparent",
          isRailLayout && "ml-atmosphere-workspace-page",
        )}
        contentClassName={cn(!isRailLayout && "pb-28", isRailLayout && "ml-atmosphere-rail-content")}
      >
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

      <div
        className={isRailLayout ? "ml-atmosphere-carousel-slot" : "space-y-8"}
        ref={isRailLayout ? carouselSlotRef : undefined}
      >
        {isRailLayout ? (
          <div
            className="ml-atmosphere-carousel-workspace"
            data-favorites-fit={favoritesLayout.fit ? "true" : "false"}
            style={{
              "--ml-atmosphere-favorites-edge": `${favoritesLayout.edge}px`,
              "--ml-atmosphere-favorites-top": `${favoritesLayout.top}px`,
              "--ml-atmosphere-workspace-scale": favoritesLayout.scale,
              "--ml-atmosphere-header-scale-rem": `${Math.min(
                favoritesLayout.scale,
                STATION_CAROUSEL_LARGE_SCREEN_TUNING.maxHeaderScale,
              )}rem`,
              "--ml-atmosphere-workspace-scale-rem": `${favoritesLayout.scale}rem`,
            } as CSSProperties}
          >
            <AtmosphereStationCarousel
              onCenteredStationChange={setCenteredStationId}
              onViewChange={setAtmosphereCarouselView}
            />
            {atmosphereCarouselView === "stations" ? (
              <div className="ml-atmosphere-favorites-slot">
                <AtmosphereFavoritesSpeedDial
                  busy={music.playbackState === "loading"}
                  favoriteIds={music.favorites}
                  onPlayStation={(stationId) => { void music.playStation(stationId) }}
                  playingStationId={music.playbackState === "playing" ? music.activeStationId : null}
                />
              </div>
            ) : null}
          </div>
        ) : (
          stationGroups.map((group) => (
            <AtmosphereStationGrid
              key={group.id}
              group={group}
              music={music}
              prewarmStation={prewarmStation}
            />
          ))
        )}
      </div>
      </AppPageShell>
    </div>
  )
}

/**
 * Derives the optional Favorites row from live rendered geometry. Browser zoom,
 * text scaling, player rails, and device emulation all change this same measured
 * space, so none of them needs a separate breakpoint or browser-specific rule.
 */
function useAtmosphereFavoritesLayout(centeredStationId: string | null, enabled: boolean) {
  const carouselSlotRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<AtmosphereFavoritesLayout>({ edge: 0, fit: false, scale: 1, top: 0 })

  useEffect(() => {
    const slot = carouselSlotRef.current
    if (!slot) return undefined
    if (!enabled) {
      setLayout((current) => current.fit ? { ...current, fit: false } : current)
      return undefined
    }

    let animationFrame = 0
    let resizeObserver: ResizeObserver | null = null

    const measure = () => {
      const stationCarousel = slot.querySelector<HTMLElement>(".ml-atmosphere-station-carousel")
      const centeredCard = slot.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"]',
      )
      if (!stationCarousel || !centeredCard) return

      const slotRect = slot.getBoundingClientRect()
      const centeredCardRect = centeredCard.getBoundingClientRect()
      const minimumEdge = centeredCardRect.width * FAVORITES_TO_CENTER_CARD_RATIO
      const scale = Math.max(1, centeredCardRect.width / STATION_CAROUSEL_TUNING.cardWidth)
      const centeredCardBottom = centeredCardRect.bottom - slotRect.top
      const availableBelowCarousel = slotRect.height - centeredCardBottom
      const preferredEdge = Math.min(
        slotRect.width * FAVORITES_BALANCED_FILL_RATIO,
        availableBelowCarousel * FAVORITES_BALANCED_FILL_RATIO,
      )
      const maximumFittingEdge = Math.min(
        slotRect.width * FAVORITES_BALANCED_FILL_RATIO,
        availableBelowCarousel - FAVORITES_MIN_SURROUNDING_GAP_PX * 2,
      )
      const constrainedLandscape = stationCarousel.dataset.constrainedLandscape === "true"
      const fit = maximumFittingEdge >= FAVORITES_MIN_USEFUL_EDGE_PX
        && !constrainedLandscape
      // Prefer 1.3x, then spend surplus portrait room on the mosaic. At a tight
      // boundary, use the largest useful square that preserves all four gaps.
      const edge = fit
        ? Math.min(
            maximumFittingEdge,
            Math.max(minimumEdge, preferredEdge),
          )
        : minimumEdge
      const remainingVerticalSpace = availableBelowCarousel - edge
      // Divide the live leftover workspace equally so the mosaic sits midway
      // between the carousel and the usable viewport bottom above the app rail.
      const surroundingGap = Math.max(0, remainingVerticalSpace / 2)
      const top = centeredCardBottom + surroundingGap

      setLayout((current) => (
        current.fit === fit
          && Math.abs(current.edge - edge) < 0.5
          && Math.abs(current.scale - scale) < 0.005
          && Math.abs(current.top - top) < 0.5
          ? current
          : { edge, fit, scale, top }
      ))
    }

    const scheduleMeasurement = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(measure)
    }

    resizeObserver = new ResizeObserver(scheduleMeasurement)
    resizeObserver.observe(slot)
    const stationCarousel = slot.querySelector<HTMLElement>(".ml-atmosphere-station-carousel")
    const centeredCard = slot.querySelector<HTMLElement>(
      '[data-carousel-slide][data-centered="true"]',
    )
    if (stationCarousel) resizeObserver.observe(stationCarousel)
    if (centeredCard) resizeObserver.observe(centeredCard)

    const mutationObserver = new MutationObserver(scheduleMeasurement)
    mutationObserver.observe(slot, {
      attributeFilter: ["class", "data-centered", "style"],
      attributes: true,
      childList: true,
      subtree: true,
    })
    window.addEventListener("resize", scheduleMeasurement)
    scheduleMeasurement()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener("resize", scheduleMeasurement)
    }
  }, [centeredStationId, enabled])

  return [carouselSlotRef, layout] as const
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
