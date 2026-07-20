"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMusic } from "@/components/providers/music-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { groupAtmosphereStations } from "@/lib/atmosphere/station-groups"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { CarouselStage } from "./carousel-stage"
import { StationLabCard } from "./station-lab-card"

const stationGroups = groupAtmosphereStations(getVisibleAtmosphereStations())

export interface StationLabSurfaceProps {
  presentation: "existing" | "cover-flow" | "three-d"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  onEffectiveLoopChange: (value: boolean) => void
}

/**
 * Presents real grouped stations while retaining one centered position per
 * category for the current lab session. Center changes prewarm only; playback,
 * stop, and favorite actions remain explicit controls inside the full card.
 */
export function StationLabSurface(props: StationLabSurfaceProps) {
  const music = useMusic()
  const [groupId, setGroupId] = useState(stationGroups[0]?.id ?? "")
  const [initialItemId, setInitialItemId] = useState(() => {
    const firstGroup = stationGroups[0]
    if (!firstGroup) return undefined
    return firstGroup.stations.some((station) => station.id === music.activeStationId)
      ? music.activeStationId
      : firstGroup.stations[0]?.id
  })
  const positionsRef = useRef(new Map<string, string>())
  const prewarmAbortRef = useRef<AbortController | null>(null)
  const group = stationGroups.find((candidate) => candidate.id === groupId) ?? stationGroups[0]
  const stationItems = useMemo(
    () => (group?.stations ?? []).map((station) => ({
      ...station,
      label: station.title,
      disabled: !station.enabled,
      statusLabel: station.enabled ? "available" : "not playable yet",
    })),
    [group],
  )

  const prewarmStation = useCallback((
    stationId: string,
    options: { includeSamplePayloads?: boolean } = {},
  ) => {
    prewarmAbortRef.current?.abort()
    const controller = new AbortController()
    prewarmAbortRef.current = controller
    void music.prewarmStation(stationId, { ...options, signal: controller.signal })
  }, [music])

  useEffect(() => () => {
    prewarmAbortRef.current?.abort()
  }, [])

  const handleCenteredItemChange = useCallback((stationId: string) => {
    if (!group) return
    positionsRef.current.set(group.id, stationId)
    prewarmStation(stationId)
  }, [group, prewarmStation])

  const handleGroupChange = useCallback((nextGroupId: string) => {
    prewarmAbortRef.current?.abort()
    prewarmAbortRef.current = null
    const nextGroup = stationGroups.find((candidate) => candidate.id === nextGroupId) ?? stationGroups[0]
    const nextInitialItemId = nextGroup
      ? positionsRef.current.get(nextGroup.id)
        ?? (nextGroup.stations.some((station) => station.id === music.activeStationId)
          ? music.activeStationId
          : nextGroup.stations[0]?.id)
      : undefined
    setInitialItemId(nextInitialItemId)
    setGroupId(nextGroupId)
  }, [music.activeStationId])

  if (!group) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No stations are available for this prototype.
      </p>
    )
  }

  return (
    <section className="grid gap-4" aria-label="Station carousel prototype">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <div className="grid max-w-sm gap-1.5">
          <label htmlFor="station-lab-category" className="text-sm font-medium">
            Station category
          </label>
          <Select value={group.id} onValueChange={handleGroupChange}>
            <SelectTrigger id="station-lab-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stationGroups.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <h3 className="font-semibold tracking-normal">{group.title}</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <CarouselStage
        key={group.id}
        items={stationItems}
        initialItemId={initialItemId}
        surface="stations"
        presentation={props.presentation}
        tuning={props.tuning}
        reducedMotion={props.reducedMotion}
        onCenteredItemChange={handleCenteredItemChange}
        onEffectiveLoopChange={props.onEffectiveLoopChange}
        renderItem={(station, { detailLevel }) => {
          if (detailLevel === "shell") return null
          return (
            <StationLabCard
              groupId={group.id}
              station={station}
              detailLevel={detailLevel}
              prewarmStation={prewarmStation}
            />
          )
        }}
      />
    </section>
  )
}
