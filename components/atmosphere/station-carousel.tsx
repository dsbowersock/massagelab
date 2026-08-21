"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { StepBack, StepForward } from "lucide-react"
import { AtmosphereStationCarouselCard } from "@/components/atmosphere/station-carousel-card"
import { AdaptiveCarouselStage } from "@/components/carousels/adaptive-carousel-stage"
import {
  getResponsiveStationCarouselTuning,
} from "@/components/carousels/adaptive-carousel-model"
import { useMusic } from "@/components/providers/music-provider"
import { Button } from "@/components/ui/button"
import { purpleGlowClassName } from "@/components/ui/carousel-button-classes"
import { MetalFavoriteIcon } from "@/components/ui/metal-favorite-icon"
import { buildAtmosphereFavoritesSpeedDialModel } from "@/lib/atmosphere/favorites-speed-dial"
import { groupAtmosphereStations } from "@/lib/atmosphere/station-groups"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { cn } from "@/lib/utils"

const stations = getVisibleAtmosphereStations()
const stationGroups = groupAtmosphereStations(stations)
const FAVORITES_CATEGORY_ID = "favorites"
const ATMOSHAPER_CATEGORY_ID = "atmoshaper"
// Reserve the overlaid station-control row without changing card geometry.
const STATION_CONTROLS_RESERVE_PX = 60

export type AtmosphereStationCarouselView = "stations" | "favorites" | "atmoshaper"

// A Favorites carousel still renders each station with the artwork family from
// its catalog category rather than inventing a separate Favorites art style.
const stationGroupIdByStationId = new Map(stationGroups.flatMap((group) => (
  group.stations.map((station) => [station.id, group.id] as const)
)))

type AtmosphereStationCarouselProps = {
  onCenteredStationChange?: (stationId: string) => void
  onViewChange?: (view: AtmosphereStationCarouselView) => void
}

type AtmosphereStationCarouselStyle = CSSProperties & {
  "--ml-atmosphere-station-stage-block-size": string
}

/** Returns the active station's category, falling back to the first review category. */
function getInitialStationGroup(activeStationId: string | null) {
  return (activeStationId
    ? stationGroups.find((candidate) => candidate.stations.some(({ id }) => id === activeStationId))
    : undefined) ?? stationGroups[0]
}

/**
 * Presents the real Atmosphere catalog through a stage-allocation-responsive
 * Music carousel while retaining one centered station per category. Center
 * changes may prewarm audio, but playback and favorites remain explicit card
 * actions.
 */
export function AtmosphereStationCarousel({
  onCenteredStationChange,
  onViewChange,
}: AtmosphereStationCarouselProps = {}) {
  const music = useMusic()
  const [groupId, setGroupId] = useState(() => getInitialStationGroup(music.activeStationId)?.id ?? "")
  const [initialItemId, setInitialItemId] = useState(() => {
    const initialGroup = getInitialStationGroup(music.activeStationId)
    if (!initialGroup) return undefined
    return initialGroup.stations.some(({ id }) => id === music.activeStationId)
      ? music.activeStationId ?? undefined
      : initialGroup.stations[0]?.id
  })
  const [reducedMotion, setReducedMotion] = useState(false)
  const [hasFineHoverPointer, setHasFineHoverPointer] = useState(false)
  const [constrainedLandscape, setConstrainedLandscape] = useState(false)
  const [responsiveLayout, setResponsiveLayout] = useState(() => ({
    containerHeight: 0,
    containerWidth: 0,
    tuning: getResponsiveStationCarouselTuning({
      containerWidth: 0,
      containerHeight: 0,
      constrainedLandscape: false,
    }),
  }))
  const stageAllocationRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLElement | null>(null)
  const positionsRef = useRef(new Map<string, string>())
  const prewarmAbortRef = useRef<AbortController | null>(null)
  const favoriteStations = useMemo(
    () => buildAtmosphereFavoritesSpeedDialModel(music.favorites, stations).allFavorites,
    [music.favorites],
  )
  const isFavoritesCategory = groupId === FAVORITES_CATEGORY_ID
  const isAtmoshaperCategory = groupId === ATMOSHAPER_CATEGORY_ID
  const group = useMemo(() => (
    isFavoritesCategory
      ? {
          id: FAVORITES_CATEGORY_ID,
          title: "Favorites",
          description: "Your saved Atmosphere stations.",
          stations: favoriteStations,
        }
      : isAtmoshaperCategory
        ? {
            id: ATMOSHAPER_CATEGORY_ID,
            title: "Atmoshaper",
            description: "Layer ambient sounds into your own soundscape.",
            stations: [],
          }
        : stationGroups.find(({ id }) => id === groupId) ?? stationGroups[0]
  ), [favoriteStations, groupId, isAtmoshaperCategory, isFavoritesCategory])
  const stationItems = useMemo(
    () => (group?.stations ?? []).map((station) => ({
      ...station,
      label: station.title,
      disabled: !station.enabled,
      statusLabel: station.enabled ? "available" : "not playable yet",
    })),
    [group],
  )

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const finePointerQuery = window.matchMedia("(any-hover: hover) and (any-pointer: fine)")
    const constrainedLandscapeQuery = window.matchMedia(
      "(orientation: landscape) and (max-width: 60rem) and (max-height: 31.25rem)",
    )
    const update = () => {
      setReducedMotion(reducedMotionQuery.matches)
      setHasFineHoverPointer(finePointerQuery.matches)
      setConstrainedLandscape(constrainedLandscapeQuery.matches)
    }
    update()
    reducedMotionQuery.addEventListener("change", update)
    finePointerQuery.addEventListener("change", update)
    constrainedLandscapeQuery.addEventListener("change", update)
    return () => {
      reducedMotionQuery.removeEventListener("change", update)
      finePointerQuery.removeEventListener("change", update)
      constrainedLandscapeQuery.removeEventListener("change", update)
    }
  }, [])

  // Category changes remount the keyed stage, so rebind measurement to the
  // current stage row rather than retaining a disconnected zero-sized node.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const measuredTuning = getResponsiveStationCarouselTuning({
        containerWidth: entry.contentRect.width,
        containerHeight: entry.contentRect.height,
        constrainedLandscape,
      })
      setResponsiveLayout((current) => {
        const meaningfulStageResize = Math.abs(current.containerWidth - entry.contentRect.width) >= 1
          || Math.abs(current.containerHeight - entry.contentRect.height) >= 1
        const adjacentRoundedSize = !constrainedLandscape
          && !meaningfulStageResize
          && Math.abs(current.tuning.cardWidth - measuredTuning.cardWidth) <= 1
          && Math.abs(current.tuning.cardHeight - measuredTuning.cardHeight) <= 1
        if (adjacentRoundedSize) return current

        // A one-pixel card change can alter the remaining stage height enough
        // to request the previous rounded size on the next frame. Preserve the
        // last stable tuning only for sub-pixel feedback; genuine stage resizes
        // still receive the newly measured composition.
        return {
          containerHeight: entry.contentRect.height,
          containerWidth: entry.contentRect.width,
          tuning: measuredTuning,
        }
      })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [constrainedLandscape, group?.id, stationItems.length])

  const prewarmStation = useCallback((
    stationId: string,
    options: { includeSamplePayloads?: boolean } = {},
  ) => {
    prewarmAbortRef.current?.abort()
    const controller = new AbortController()
    prewarmAbortRef.current = controller
    void music.prewarmStation(stationId, { ...options, signal: controller.signal })
  }, [music])

  useEffect(() => () => prewarmAbortRef.current?.abort(), [])

  const handleCenteredItemChange = useCallback((stationId: string) => {
    if (!group) return
    positionsRef.current.set(group.id, stationId)
    prewarmStation(stationId)
    onCenteredStationChange?.(stationId)
  }, [group, onCenteredStationChange, prewarmStation])

  const handleGroupChange = useCallback((nextGroupId: string) => {
    prewarmAbortRef.current?.abort()
    prewarmAbortRef.current = null
    const nextView: AtmosphereStationCarouselView = nextGroupId === FAVORITES_CATEGORY_ID
      ? "favorites"
      : nextGroupId === ATMOSHAPER_CATEGORY_ID
        ? "atmoshaper"
        : "stations"
    const nextStations = nextGroupId === FAVORITES_CATEGORY_ID
      ? favoriteStations
      : nextGroupId === ATMOSHAPER_CATEGORY_ID
        ? []
        : stationGroups.find(({ id }) => id === nextGroupId)?.stations ?? stationGroups[0]?.stations ?? []
    const nextInitialItemId = nextStations.length > 0
      ? positionsRef.current.get(nextGroupId)
        ?? (nextStations.some(({ id }) => id === music.activeStationId)
          ? music.activeStationId ?? undefined
          : nextStations[0]?.id)
      : undefined
    setInitialItemId(nextInitialItemId)
    onViewChange?.(nextView)
    setGroupId(nextGroupId)
  }, [favoriteStations, music.activeStationId, onViewChange])

  const tuning = responsiveLayout.tuning
  const showStationControls = reducedMotion || hasFineHoverPointer
  const carouselStyle: AtmosphereStationCarouselStyle = {
    "--ml-atmosphere-station-stage-block-size": `${Number(tuning.cardHeight) + (showStationControls ? STATION_CONTROLS_RESERVE_PX : 0)}px`,
  }

  if (!group) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No stations are available right now.
      </p>
    )
  }

  return (
    <section
      className="ml-atmosphere-station-carousel grid gap-4"
      aria-label="Atmosphere audio stations"
      data-constrained-landscape={constrainedLandscape ? "true" : "false"}
      data-music-storage-status={music.visualizer.storageStatus}
      style={carouselStyle}
    >
      <div className="ml-atmosphere-station-heading grid gap-3">
        <div className="ml-atmosphere-category-picker grid gap-1.5">
          <p className="ml-atmosphere-category-label text-sm font-medium">Station category</p>
          <div
            className="ml-atmosphere-category-pills -my-10 flex gap-2 overflow-x-auto px-8 py-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Station category"
          >
            <Button
              type="button"
              aria-pressed={isFavoritesCategory}
              className={cn("shrink-0", isFavoritesCategory && purpleGlowClassName)}
              onClick={() => handleGroupChange(FAVORITES_CATEGORY_ID)}
              size="compact"
              variant="glow"
            >
              <MetalFavoriteIcon kind="heart" selected />
              Favorites
            </Button>
            {stationGroups.map((candidate) => {
              const selected = candidate.id === groupId
              return (
                <Button
                  key={candidate.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn("shrink-0", selected && purpleGlowClassName)}
                  onClick={() => handleGroupChange(candidate.id)}
                  size="compact"
                  variant="glow"
                >
                  {candidate.title}
                </Button>
              )
            })}
            <Button
              type="button"
              aria-pressed={isAtmoshaperCategory}
              className={cn("shrink-0", isAtmoshaperCategory && purpleGlowClassName)}
              onClick={() => handleGroupChange(ATMOSHAPER_CATEGORY_ID)}
              size="compact"
              variant="glow"
            >
              Atmoshaper
            </Button>
          </div>
        </div>

        <div className="ml-atmosphere-selected-category">
          <h2 className="font-semibold tracking-normal">{group.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <div ref={stageAllocationRef} className="ml-atmosphere-station-stage-allocation">
        {isFavoritesCategory && stationItems.length === 0 ? (
          <div
            className="ml-atmosphere-station-special-state"
            data-special-state="favorites"
            data-testid="atmosphere-favorites-category-empty"
          >
            <div className="ml-atmosphere-station-special-content">
              <span className="ml-atmosphere-station-special-icon" aria-hidden="true">
                <MetalFavoriteIcon kind="heart" selected />
              </span>
              <strong>Heart a station and it will appear here.</strong>
            </div>
          </div>
        ) : isAtmoshaperCategory ? (
          <div
            className="ml-atmosphere-station-special-state"
            data-testid="atmoshaper-coming-soon"
          >
            <strong>Coming soon</strong>
          </div>
        ) : (
          <AdaptiveCarouselStage
            key={group.id}
            items={stationItems}
            initialItemId={initialItemId}
            surface="stations"
            presentation="background-picker"
            tuning={tuning}
            reducedMotion={reducedMotion}
            customControlsVisible={showStationControls}
            stageRef={stageRef}
            testId="station-carousel-stage"
            viewportProfile="music-fit"
            onCenteredItemChange={handleCenteredItemChange}
            renderControls={({ canGoPrevious, canGoNext, goPrevious, goNext }) => (
              <div className="ml-atmosphere-station-controls" data-testid="station-carousel-controls">
                <Button
                  type="button"
                  aria-label="Previous station"
                  className="ml-atmosphere-station-control ml-atmosphere-station-control-previous"
                  disabled={!canGoPrevious}
                  onClick={goPrevious}
                  size="icon"
                  variant="glow"
                >
                  <StepBack aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  aria-label="Next station"
                  className="ml-atmosphere-station-control ml-atmosphere-station-control-next"
                  disabled={!canGoNext}
                  onClick={goNext}
                  size="icon"
                  variant="glow"
                >
                  <StepForward aria-hidden="true" />
                </Button>
              </div>
            )}
            renderItem={(station, { detailLevel, loopClone }) => {
              if (detailLevel === "shell") return null
              return (
                <AtmosphereStationCarouselCard
                  groupId={stationGroupIdByStationId.get(station.id) ?? group.id}
                  station={station}
                  music={music}
                  prewarmStation={prewarmStation}
                  detailLevel={detailLevel}
                  displayMode="carousel"
                  favoriteClassName={purpleGlowClassName}
                  suppressDomId={loopClone}
                />
              )
            }}
          />
        )}
      </div>
    </section>
  )
}
