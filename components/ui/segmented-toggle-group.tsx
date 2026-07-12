"use client"

import * as React from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { triggerHapticFeedback } from "@/lib/haptics"
import { cn } from "@/lib/utils"

export interface SegmentedToggleOption {
  value: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SegmentedToggleGroupProps {
  label: string
  value: string
  options: readonly SegmentedToggleOption[]
  onValueChange: (value: string) => void
  disabled?: boolean
  iconOnly?: boolean
  size?: "sm" | "default" | "lg"
  hapticsEnabled?: boolean
  className?: string
}

/**
 * Shared single-choice segmented control with Radix keyboard semantics,
 * touch-sized options, and tooltips for icon-only presentations.
 */
export function SegmentedToggleGroup({
  label,
  value,
  options,
  onValueChange,
  disabled,
  iconOnly,
  size = "default",
  hapticsEnabled,
  className,
}: SegmentedToggleGroupProps) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const segmentStyle = {
    "--ml-segment-count": options.length,
    "--ml-segment-offset": `${selectedIndex * 100}%`,
  } as React.CSSProperties

  function handleValueChange(nextValue: string) {
    if (disabled || !nextValue || nextValue === value) {
      return
    }

    triggerHapticFeedback(hapticsEnabled, [10, 22, 8])
    onValueChange(nextValue)
  }

  return (
    <TooltipProvider delayDuration={250}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        size={size}
        aria-label={label}
        data-icon-only={iconOnly || undefined}
        style={segmentStyle}
        className={cn("ml-segmented-toggle-group", className)}
      >
        {options.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={option.value}
                disabled={option.disabled}
                aria-label={option.label}
                data-selected={option.value === value}
                className={cn(iconOnly && "px-3")}
              >
                {option.icon}
                <span className={cn(iconOnly && "sr-only")}>{option.label}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            {iconOnly ? <TooltipContent>{option.label}</TooltipContent> : null}
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  )
}
