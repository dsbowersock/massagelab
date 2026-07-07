"use client"

import * as React from "react"

import { Toggle } from "@/components/ui/toggle"
import { triggerHapticFeedback } from "@/lib/haptics"
import { cn } from "@/lib/utils"
import styles from "./chimer-controls.module.css"

interface StyledToggleControlProps extends Omit<React.ComponentPropsWithoutRef<typeof Toggle>, "onPressedChange"> {
  label: string
  valueLabel?: string
  checked: boolean
  description?: string
  onCheckedChange: (checked: boolean) => void
  hapticsEnabled?: boolean
  hapticDurationMs?: number
  className?: string
}

/**
 * Styled boolean switch used by Chimer controls, with label/value structure
 * matching the rest of the tactile control family.
 */
export function StyledToggleControl({
  label,
  valueLabel,
  description,
  checked,
  disabled,
  className,
  hapticsEnabled,
  hapticDurationMs,
  onCheckedChange,
}: StyledToggleControlProps) {
  const handleCheckedChange = (nextValue: boolean) => {
    if (disabled) {
      return
    }

    triggerHapticFeedback(hapticsEnabled, hapticDurationMs)
    onCheckedChange(nextValue)
  }

  return (
    <section className={cn(styles.controlCard, styles.toggleControlRow, className)}>
      <div>
        <p className={styles.controlLabel}>{label}</p>
        {description ? <p className={styles.controlDescription}>{description}</p> : null}
      </div>
      <Toggle
        className={styles.toggleControlSwitch}
        pressed={checked}
        onPressedChange={handleCheckedChange}
        disabled={disabled}
        aria-label={valueLabel ?? `${label} toggle`}
      />
    </section>
  )
}
