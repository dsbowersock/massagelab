"use client"

import * as React from "react"
import { shouldPlayHaptics, triggerHapticFeedback } from "@/lib/haptics"

export type ChimerPressEvent =
  | React.MouseEvent<HTMLElement>
  | React.TouchEvent<HTMLElement>
  | React.KeyboardEvent<HTMLElement>

export type HapticPressOptions = {
  /**
   * Enables vibration feedback for supported devices.
   */
  hapticsEnabled?: boolean
  /**
   * Vibration duration in milliseconds.
   */
  hapticDurationMs?: number
  /**
   * Set true to disable the interaction handler.
   */
  disabled?: boolean
}

function isActivationKey(event: ChimerPressEvent): event is React.KeyboardEvent<HTMLElement> {
  return "key" in event && (event.key === "Enter" || event.key === " ")
}

function isKeyboardEvent(event: ChimerPressEvent): event is React.KeyboardEvent<HTMLElement> {
  return "key" in event
}

function normalizeHapticDuration(duration: number | undefined) {
  if (typeof duration !== "number" || Number.isNaN(duration)) {
    return 15
  }

  return Math.max(8, Math.min(30, Math.round(duration)))
}

/**
 * Wrap an event handler with the same vibration behavior used by existing Chimer
 * interactions while preserving keyboard + mouse / touch activation.
 */
export function wrapChimerPressHandler<T extends ChimerPressEvent>(
  handler: (event: T) => void,
  options: HapticPressOptions = {},
) {
  return (event: T) => {
    if (options.disabled) {
      return
    }

    if (isKeyboardEvent(event) && !isActivationKey(event)) {
      return
    }

    if (shouldPlayHaptics(options.hapticsEnabled)) {
      triggerHapticFeedback(options.hapticsEnabled, normalizeHapticDuration(options.hapticDurationMs))
    }

    handler(event)
  }
}
