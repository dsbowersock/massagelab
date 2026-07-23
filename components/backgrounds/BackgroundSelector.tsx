"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { Sparkles } from "lucide-react"
import {
  BACKGROUND_VISUAL_FILTERS,
  matchesBackgroundVisualFilter,
  readSavedBackgroundIds,
  writeSavedBackgroundIds,
} from "@/lib/background-catalog"
import { DEFAULT_BACKGROUND_ID } from "@/lib/background-options"
import { cn } from "@/lib/utils"
import {
  BackgroundAcquisitionDialog,
  type BackgroundAcquisitionMode,
} from "@/components/backgrounds/BackgroundAcquisitionDialog"
import { BackgroundCarousel } from "@/components/backgrounds/background-carousel"
import { useBackgroundCreditStatus } from "@/components/backgrounds/BackgroundCommerceProvider"
import {
  type BackgroundDefinition,
  getBackgroundOptionsForCategory,
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
  const [acquisition, setAcquisition] = useState<{
    background: BackgroundDefinition
    mode: BackgroundAcquisitionMode
  } | null>(null)
  const creditStatus = useBackgroundCreditStatus()
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
        <div className="flex shrink-0 items-center gap-2">
          {creditStatus ? (
            <span
              className="text-xs font-semibold text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {creditStatus}
            </span>
          ) : null}
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
        </div>
      </div>

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

      {visibleOptions.length > 0 ? (
        <BackgroundCarousel
          key={visualFilter}
          options={visibleOptions}
          selectedId={selectedOption?.id ?? value}
          featureKeys={featureKeys}
          savedIds={savedBackgroundIds}
          onSelect={(backgroundId) => {
            setUpgradeMessage("")
            onChange(backgroundId)
          }}
          onLockedSelect={(option) => {
            setUpgradeMessage(`${option.label} has purchase options available.`)
            setAcquisition({ background: option, mode: "locked" })
          }}
          onKeepPermanently={(option) => {
            setUpgradeMessage(`Keep ${option.label} permanently with a credit or purchase.`)
            setAcquisition({ background: option, mode: "keep-permanently" })
          }}
          onToggleSaved={toggleSavedBackground}
        />
      ) : null}

      <BackgroundAcquisitionDialog
        background={acquisition?.background ?? null}
        mode={acquisition?.mode ?? "locked"}
        open={Boolean(acquisition)}
        onOpenChange={(open) => {
          if (!open) setAcquisition(null)
        }}
        onAcquired={(background) => {
          setAcquisition(null)
          setUpgradeMessage("")
          onChange(background.id)
        }}
      />

      {selectedOption && renderSelectedControls ? (
        <div className="rounded-md border border-border/70 bg-background/70 px-3 py-3">
          {renderSelectedControls(selectedOption)}
        </div>
      ) : null}
      {visibleOptions.length === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">No backgrounds match this filter yet.</p>
      ) : null}
      {upgradeMessage ? <p className="text-xs leading-5 text-primary">{upgradeMessage}</p> : null}
    </div>
  )
}
