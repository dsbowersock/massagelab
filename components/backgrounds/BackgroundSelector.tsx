"use client"

import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react"
import { Lock, Sparkles, Star } from "lucide-react"
import {
  BACKGROUND_VISUAL_FILTERS,
  getBackgroundVisualTags,
  matchesBackgroundVisualFilter,
  readSavedBackgroundIds,
  writeSavedBackgroundIds,
} from "@/lib/background-catalog"
import { DEFAULT_BACKGROUND_ID } from "@/lib/background-options"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  type BackgroundDefinition,
  getBackgroundOptionsForCategory,
  userCanUseBackground,
  type BackgroundCategory,
  type BackgroundId,
} from "@/components/backgrounds/backgroundRegistry"

interface BackgroundSelectorProps {
  value: BackgroundId | string
  onChange: (value: BackgroundId) => void
  featureKeys?: string[]
  category: BackgroundCategory
  className?: string
  compact?: boolean
  description?: string
  renderSelectedControls?: (option: BackgroundDefinition) => ReactNode
}

type BackgroundVisualFilter = (typeof BACKGROUND_VISUAL_FILTERS)[number]["value"]

// Fallback previews keep the picker visual even before generated media loads or
// when a background does not provide a custom fallback style.
function getPreviewStyle(option: BackgroundDefinition): CSSProperties {
  return option.fallbackStyle ?? {
    background:
      option.motionIntensity === "static"
        ? "linear-gradient(135deg, rgba(249,115,22,0.76), rgba(15,23,42,0.96))"
        : "radial-gradient(circle at 24% 28%, rgba(249,115,22,0.72), transparent 34%), radial-gradient(circle at 78% 70%, rgba(65,105,225,0.56), transparent 42%), linear-gradient(135deg, #050505, #111827)",
  }
}

export function BackgroundSelector({
  value,
  onChange,
  featureKeys = [],
  category,
  className,
  compact = false,
  description = "Additional premium visual backgrounds are paused for source-matched review.",
  renderSelectedControls,
}: BackgroundSelectorProps) {
  const [upgradeMessage, setUpgradeMessage] = useState("")
  const [visualFilter, setVisualFilter] = useState<BackgroundVisualFilter>("all")
  const [savedBackgroundIds, setSavedBackgroundIds] = useState<BackgroundId[]>([])
  const options = useMemo(() => getBackgroundOptionsForCategory(category), [category])
  const visibleOptions = useMemo(
    () => options.filter((option) => matchesBackgroundVisualFilter(option, visualFilter, savedBackgroundIds)),
    [options, savedBackgroundIds, visualFilter],
  )
  const selectedOption = options.find((option) => option.id === value) ?? options.find((option) => option.id === DEFAULT_BACKGROUND_ID)

  useEffect(() => {
    setSavedBackgroundIds(readSavedBackgroundIds(window.localStorage) as BackgroundId[])
  }, [])

  function toggleSavedBackground(id: BackgroundId) {
    setSavedBackgroundIds((current) => {
      const nextIds = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]

      writeSavedBackgroundIds(window.localStorage, nextIds)

      return nextIds
    })
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>Visual background</p>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </div>

      {selectedOption ? (
        <div className="grid gap-2 rounded-md border border-border/80 bg-background/70 p-2">
          <div
            className="min-h-24 rounded-md border border-white/10"
            style={getPreviewStyle(selectedOption)}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground">{selectedOption.label}</span>
            <span className="text-muted-foreground">{getBackgroundVisualTags(selectedOption).slice(0, 3).join(" • ")}</span>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Background visual filters">
        {BACKGROUND_VISUAL_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              visualFilter === filter.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/80 bg-background/80 text-muted-foreground hover:border-primary/70 hover:text-foreground",
            )}
            onClick={() => setVisualFilter(filter.value)}
            role="tab"
            aria-selected={visualFilter === filter.value}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "grid gap-2",
          compact
            ? "grid-cols-1"
            : "auto-cols-[minmax(15rem,1fr)] grid-flow-col overflow-x-auto pb-2 snap-x snap-mandatory",
        )}
      >
        {visibleOptions.map((option) => {
          const canUse = userCanUseBackground(option, featureKeys)
          const isSelected = value === option.id || (!canUse && option.id === DEFAULT_BACKGROUND_ID)
          const isSaved = savedBackgroundIds.includes(option.id)

          return (
            <div
              key={option.id}
              className={cn(
                "grid min-h-full gap-2 overflow-hidden rounded-md border border-border/80 bg-background/80 p-2 text-sm transition hover:border-primary/60 hover:bg-accent snap-start",
                isSelected && "border-primary/70 bg-primary/10 shadow-md shadow-primary/10",
                !canUse && "cursor-not-allowed opacity-70",
              )}
            >
              <div
                className="min-h-28 rounded-md border border-white/10"
                style={getPreviewStyle(option)}
                aria-hidden="true"
              />
              <div className="grid gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-foreground">{option.label}</span>
                  <Badge variant={option.requiresSubscription ? (canUse ? "outline" : "secondary") : "outline"} className="shrink-0 gap-1">
                    {!canUse ? <Lock className="size-3" aria-hidden="true" /> : null}
                    {option.requiresSubscription ? (canUse ? "Premium" : "Locked") : "Free"}
                  </Badge>
                </div>
                <span className="text-xs leading-5 text-muted-foreground">
                  {option.provider} · {option.motionIntensity} motion · {option.performanceCost} cost
                </span>
                <span className="text-xs leading-5 text-muted-foreground">
                  {getBackgroundVisualTags(option).slice(0, 4).join(" • ")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-disabled={!canUse}
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-9 rounded-md border px-3 text-xs font-bold transition",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/80 bg-background hover:border-primary/70 hover:bg-primary/10",
                  )}
                  onClick={() => {
                    if (!canUse) {
                      setUpgradeMessage("Upgrade to a paid membership to use premium visual backgrounds.")
                      return
                    }

                    setUpgradeMessage("")
                    onChange(option.id)
                  }}
                >
                  {isSelected ? "Selected" : "Apply"}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border/80 bg-background px-2.5 text-xs font-bold transition hover:border-primary/70 hover:bg-primary/10"
                  onClick={() => toggleSavedBackground(option.id)}
                  aria-pressed={isSaved}
                  aria-label={`${isSaved ? "Unsave" : "Save"} ${option.label} background`}
                >
                  <Star className={cn("size-3.5", isSaved && "fill-current text-primary")} aria-hidden="true" />
                  {isSaved ? "Saved" : "Save"}
                </button>
              </div>
              {canUse && isSelected && renderSelectedControls ? (
                <div className="border-t border-border/70 px-3 py-3">
                  {renderSelectedControls(option)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {visibleOptions.length === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">No backgrounds match this filter yet.</p>
      ) : null}
      {upgradeMessage ? <p className="text-xs leading-5 text-primary">{upgradeMessage}</p> : null}
    </div>
  )
}
