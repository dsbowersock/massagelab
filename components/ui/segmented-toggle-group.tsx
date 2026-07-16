"use client"

import * as React from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MetalAttentionRing } from "@/components/ui/metal-attention-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { triggerHapticFeedback, type HapticPattern } from "@/lib/haptics"
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
  /**
   * Keep this array memoized when activeRing or reflectSiblingOptions is enabled
   * so option refs and ring/reflection targets remain stable across renders.
   */
  options: readonly SegmentedToggleOption[]
  onValueChange: (value: string) => void
  disabled?: boolean
  iconOnly?: boolean
  /** Compresses equal-width segments so the complete group remains visible. */
  fit?: boolean
  size?: "sm" | "default" | "lg"
  hapticsEnabled?: boolean
  hapticDurationMs?: HapticPattern
  activeTone?: "default" | "attention"
  activeRing?: boolean
  reflectSiblingOptions?: boolean
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
  fit,
  size = "default",
  hapticsEnabled,
  hapticDurationMs,
  activeTone = "default",
  activeRing,
  reflectSiblingOptions,
  className,
}: SegmentedToggleGroupProps) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const optionRefs = React.useMemo(() => options.map(() => React.createRef<HTMLButtonElement>()), [options])
  const segmentStyle = {
    "--ml-segment-count": options.length,
    "--ml-segment-offset": `${selectedIndex * 100}%`,
  } as React.CSSProperties

  function handleValueChange(nextValue: string) {
    if (disabled || !nextValue || nextValue === value) {
      return
    }

    triggerHapticFeedback(hapticsEnabled, hapticDurationMs ?? [10, 22, 8])
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
        data-fit={fit || undefined}
        data-active-tone={activeTone === "attention" ? "attention" : undefined}
        style={segmentStyle}
        className={cn("ml-segmented-toggle-group", className)}
      >
        {options.map((option, optionIndex) => {
          const isSelected = option.value === value
          const toggleItem = (
            <ToggleGroupItem
              ref={optionRefs[optionIndex]}
              value={option.value}
              disabled={option.disabled}
              aria-label={option.label}
              data-selected={option.value === value}
              className={cn(iconOnly && (fit ? "px-1.5" : "px-3"))}
            >
              {option.icon}
              <span className={cn(iconOnly && "sr-only")}>{option.label}</span>
            </ToggleGroupItem>
          )
          const tooltipTrigger = (
            <TooltipTrigger asChild>
              {toggleItem}
            </TooltipTrigger>
          )
          const optionTrigger = activeRing && isSelected ? (
            <MetalAttentionRing
              className="ml-segmented-active-ring"
              metalMode="always"
              metalFullWidth
              metalReflectionTargets={reflectSiblingOptions ? optionRefs.filter((_, refIndex) => refIndex !== optionIndex) : undefined}
              metalRingCssPx={2}
              metalStrength={0.78}
            >
              {tooltipTrigger}
            </MetalAttentionRing>
          ) : tooltipTrigger

          return (
            <Tooltip key={option.value}>
              {optionTrigger}
              {iconOnly ? <TooltipContent>{option.label}</TooltipContent> : null}
            </Tooltip>
          )
        })}
      </ToggleGroup>
    </TooltipProvider>
  )
}
