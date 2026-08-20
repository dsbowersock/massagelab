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
import { groupAtmosphereStations } from "@/lib/atmosphere/station-groups"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { cn } from "@/lib/utils"

const stationGroups = groupAtmosphereStations(getVisibleAtmosphereStations())

type AtmosphereStationCarouselProps = {
  onCenteredStationChange?: (stationId: string) => void
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
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const stageAllocationRef = useRef<HTMLDivElement | null>(null)
  const positionsRef = useRef(new Map<string, string>())
  const prewarmAbortRef = useRef<AbortController | null>(null)
  const group = stationGroups.find(({ id }) => id === groupId) ?? stationGroups[0]
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
    const allocation = stageAllocationRef.current
    if (!allocation) return
    const stage = allocation.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [group?.id])

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
    const nextGroup = stationGroups.find(({ id }) => id === nextGroupId) ?? stationGroups[0]
    const nextInitialItemId = nextGroup
      ? positionsRef.current.get(nextGroup.id)
        ?? (nextGroup.stations.some(({ id }) => id === music.activeStationId)
          ? music.activeStationId ?? undefined
          : nextGroup.stations[0]?.id)
      : undefined
    setInitialItemId(nextInitialItemId)
    setGroupId(nextGroupId)
  }, [music.activeStationId])

  const tuning = useMemo(
    () => getResponsiveStationCarouselTuning({
      containerWidth: stageSize.width,
      containerHeight: stageSize.height,
      constrainedLandscape,
    }),
    [constrainedLandscape, stageSize.height, stageSize.width],
  )
  const showStationControls = reducedMotion || hasFineHoverPointer
  const carouselStyle: AtmosphereStationCarouselStyle = {
    "--ml-atmosphere-station-stage-block-size": `${Number(tuning.cardHeight) + (showStationControls ? 60 : 0)}px`,
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
            {stationGroups.map((candidate) => {
              const selected = candidate.id === group.id
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
          </div>
        </div>

        <div className="ml-atmosphere-selected-category">
          <h2 className="font-semibold tracking-normal">{group.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <div ref={stageAllocationRef} className="ml-atmosphere-station-stage-allocation">
        <AdaptiveCarouselStage
          key={group.id}
          items={stationItems}
          initialItemId={initialItemId}
          surface="stations"
          presentation="background-picker"
          tuning={tuning}
          reducedMotion={reducedMotion}
          customControlsVisible={showStationControls}
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
          renderItem={(station, { detailLevel }) => {
            if (detailLevel === "shell") return null
            return (
              <AtmosphereStationCarouselCard
                groupId={group.id}
                station={station}
                music={music}
                prewarmStation={prewarmStation}
                detailLevel={detailLevel}
                displayMode="carousel"
                favoriteClassName={purpleGlowClassName}
              />
            )
          }}
        />
      </div>
    </section>
  )
}
