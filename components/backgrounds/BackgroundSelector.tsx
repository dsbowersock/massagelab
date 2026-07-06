"use client"

import { type ReactNode, useMemo, useState } from "react"
import { Lock, Sparkles } from "lucide-react"
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
  const options = useMemo(() => getBackgroundOptionsForCategory(category), [category])

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>Visual background</p>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {options.map((option) => {
          const canUse = userCanUseBackground(option, featureKeys)
          const isSelected = value === option.id || (!canUse && option.id === DEFAULT_BACKGROUND_ID)

          return (
            <div
              key={option.id}
              className={cn(
                "overflow-hidden rounded-md border border-border/80 bg-background/80 text-sm transition hover:border-primary/60 hover:bg-accent",
                isSelected && "border-primary/70 bg-primary/10 shadow-md shadow-primary/10",
                !canUse && "cursor-not-allowed opacity-70",
              )}
            >
              <button
                type="button"
                aria-disabled={!canUse}
                aria-pressed={isSelected}
                className="flex min-h-16 w-full items-start justify-between gap-3 border-0 bg-transparent p-3 text-left text-inherit"
                onClick={() => {
                  if (!canUse) {
                    setUpgradeMessage("Upgrade to a paid membership to use premium visual backgrounds.")
                    return
                  }

                  setUpgradeMessage("")
                  onChange(option.id)
                }}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {option.provider} · {option.motionIntensity} motion · {option.performanceCost} cost
                  </span>
                  {option.customizationSummary ? (
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {option.customizationSummary}
                    </span>
                  ) : null}
                </span>
                {option.requiresSubscription ? (
                  <Badge variant={canUse ? "outline" : "secondary"} className="shrink-0 gap-1">
                    {!canUse ? <Lock className="size-3" aria-hidden="true" /> : null}
                    {canUse ? "Premium" : "Locked"}
                  </Badge>
                ) : null}
              </button>
              {canUse && isSelected && renderSelectedControls ? (
                <div className="border-t border-border/70 px-3 py-3">
                  {renderSelectedControls(option)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {upgradeMessage ? <p className="text-xs leading-5 text-primary">{upgradeMessage}</p> : null}
    </div>
  )
}
