"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AtmosphereStationCarouselCard } from "@/components/atmosphere/station-carousel-card"
import { AdaptiveCarouselStage } from "@/components/carousels/adaptive-carousel-stage"
import { STATION_CAROUSEL_TUNING } from "@/components/carousels/adaptive-carousel-model"
import { useMusic } from "@/components/providers/music-provider"
import { Button } from "@/components/ui/button"
import { purpleGlowClassName } from "@/components/ui/carousel-button-classes"
import { groupAtmosphereStations } from "@/lib/atmosphere/station-groups"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { cn } from "@/lib/utils"

const stationGroups = groupAtmosphereStations(getVisibleAtmosphereStations())

/**
 * Presents the real Atmosphere catalog through the approved fixed-size Music
 * carousel while retaining one centered station per category. Center changes
 * may prewarm audio, but playback and favorites remain explicit card actions.
 */
export function AtmosphereStationCarousel() {
  const music = useMusic()
  const [groupId, setGroupId] = useState(stationGroups[0]?.id ?? "")
  const [initialItemId, setInitialItemId] = useState(() => {
    const firstGroup = stationGroups[0]
    if (!firstGroup) return undefined
    return firstGroup.stations.some(({ id }) => id === music.activeStationId)
      ? music.activeStationId ?? undefined
      : firstGroup.stations[0]?.id
  })
  const [reducedMotion, setReducedMotion] = useState(false)
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
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

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
  }, [group, prewarmStation])

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

  if (!group) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No stations are available right now.
      </p>
    )
  }

  return (
    <section className="grid gap-4" aria-label="Atmosphere audio stations">
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Station category</p>
          <div
            className="-mx-8 -my-8 flex gap-2 overflow-x-auto px-8 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

        <div>
          <h2 className="font-semibold tracking-normal">{group.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <AdaptiveCarouselStage
        key={group.id}
        items={stationItems}
        initialItemId={initialItemId}
        surface="stations"
        presentation="background-picker"
        tuning={STATION_CAROUSEL_TUNING}
        reducedMotion={reducedMotion}
        testId="station-carousel-stage"
        onCenteredItemChange={handleCenteredItemChange}
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
    </section>
  )
}
