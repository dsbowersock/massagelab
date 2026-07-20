"use client"

import { useEffect, useMemo, useState } from "react"
import {
  backgroundRegistry,
  type BackgroundId,
} from "@/components/backgrounds/backgroundRegistry"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BACKGROUND_VISUAL_FILTERS,
  matchesBackgroundVisualFilter,
  readSavedBackgroundIds,
  writeSavedBackgroundIds,
} from "@/lib/background-catalog"
import { DEFAULT_BACKGROUND_ID } from "@/lib/background-options"
import { BackgroundLabCard, type LabBackgroundAccessState } from "./background-lab-card"
import { CarouselStage } from "./carousel-stage"

export interface BackgroundLabSurfaceProps {
  presentation: "existing" | "cover-flow" | "three-d"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  onEffectiveLoopChange: (value: boolean) => void
}

const enabledBackgrounds = backgroundRegistry.filter((option) => option.enabled)
const ACCESS_STATES: readonly { value: LabBackgroundAccessState; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "owned", label: "Owned" },
  { value: "subscriber-unlocked", label: "Subscriber unlocked" },
  { value: "credit-available", label: "Credit available" },
  { value: "locked", label: "Locked" },
]

/** Hosts real enabled backgrounds with browser-only saved and access fixtures. */
export function BackgroundLabSurface(props: BackgroundLabSurfaceProps) {
  const [filter, setFilter] = useState("all")
  const [accessState, setAccessState] = useState<LabBackgroundAccessState>("free")
  const [selectedId, setSelectedId] = useState<BackgroundId>(DEFAULT_BACKGROUND_ID as BackgroundId)
  const [savedIds, setSavedIds] = useState<BackgroundId[]>([])

  useEffect(() => {
    setSavedIds(readSavedBackgroundIds(window.localStorage) as BackgroundId[])
  }, [])

  const visibleOptions = useMemo(
    () => enabledBackgrounds.filter((option) =>
      matchesBackgroundVisualFilter(option, filter, savedIds),
    ),
    [filter, savedIds],
  )
  const filterCenterId = visibleOptions.some((option) => option.id === selectedId)
    ? selectedId
    : visibleOptions[0]?.id ?? null

  const toggleSaved = (optionId: BackgroundId) => {
    setSavedIds((currentIds) => {
      const nextIds = currentIds.includes(optionId)
        ? currentIds.filter((id) => id !== optionId)
        : [...currentIds, optionId]
      writeSavedBackgroundIds(window.localStorage, nextIds)
      return nextIds
    })
  }

  return (
    <section className="grid gap-4" aria-label="Background carousel prototype">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <div role="radiogroup" aria-label="Background visual filter" className="flex flex-wrap gap-2">
          {BACKGROUND_VISUAL_FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={filter === option.value}
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="grid max-w-sm gap-1.5">
          <label htmlFor="background-lab-access-state" className="text-sm font-medium">
            Access state fixture
          </label>
          <Select
            value={accessState}
            onValueChange={(value) => setAccessState(value as LabBackgroundAccessState)}
          >
            <SelectTrigger id="background-lab-access-state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCESS_STATES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibleOptions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No backgrounds match this filter.
        </p>
      ) : (
        <CarouselStage
          key={filter}
          items={visibleOptions}
          initialItemId={filterCenterId}
          selectedItemId={selectedId}
          surface="backgrounds"
          presentation={props.presentation}
          tuning={props.tuning}
          reducedMotion={props.reducedMotion}
          onEffectiveLoopChange={props.onEffectiveLoopChange}
          renderItem={(option, { centered, detailLevel }) => {
            if (detailLevel === "shell") return null
            return (
              <BackgroundLabCard
                option={option}
                centered={centered}
                detailLevel={detailLevel}
                accessState={accessState}
                selected={selectedId === option.id}
                saved={savedIds.includes(option.id)}
                reducedMotion={props.reducedMotion}
                onSelect={() => setSelectedId(option.id)}
                onToggleSaved={() => toggleSaved(option.id)}
              />
            )
          }}
        />
      )}
    </section>
  )
}
