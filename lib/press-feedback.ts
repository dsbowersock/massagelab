import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from "react"

import { triggerHapticFeedback } from "@/lib/haptics"

export type PressFeedbackEvent =
  | ReactMouseEvent<HTMLElement>
  | ReactPointerEvent<HTMLElement>
  | ReactTouchEvent<HTMLElement>
  | ReactKeyboardEvent<HTMLElement>

export interface PressFeedbackOptions {
  disabled?: boolean
  ariaDisabled?: boolean
  hapticsEnabled?: boolean
  hapticDurationMs?: number
}

interface PressHandlerBehavior {
  /** Lets generic Button handlers cancel feedback with preventDefault first. */
  invokeHandlerBeforeFeedback?: boolean
}

function isKeyboardEvent(event: PressFeedbackEvent): event is ReactKeyboardEvent<HTMLElement> {
  return "key" in event
}

function isActivationKey(event: ReactKeyboardEvent<HTMLElement>) {
  return event.key === "Enter" || event.key === " "
}

// A 15ms pulse reads as a tap; values below 8ms disappear on many devices,
// while values above 30ms start to feel sluggish for press feedback.
const defaultHapticDurationMs = 15
const minHapticDurationMs = 8
const maxHapticDurationMs = 30

function normalizeDuration(duration: number | undefined) {
  if (typeof duration !== "number" || Number.isNaN(duration)) {
    return defaultHapticDurationMs
  }

  return Math.max(minHapticDurationMs, Math.min(maxHapticDurationMs, Math.round(duration)))
}

function shouldSkipFeedback(options: PressFeedbackOptions = {}) {
  return Boolean(options.disabled || options.ariaDisabled)
}

/**
 * Returns true only for event shapes that represent a deliberate press.
 * Pointer and touch events are accepted; keyboard events must be Enter or Space
 * and repeated keydown events are ignored to avoid haptic spam.
 */
export function shouldHandlePressFeedbackEvent(event: PressFeedbackEvent) {
  if (!isKeyboardEvent(event)) {
    return true
  }

  return isActivationKey(event) && !event.repeat
}

/**
 * Plays the sitewide press feedback pulse when the control is enabled.
 * The helper respects the persisted haptic preference through `lib/haptics`
 * and silently no-ops when vibration is unavailable.
 */
export function playPressFeedback(options: PressFeedbackOptions = {}): void {
  if (shouldSkipFeedback(options)) {
    return
  }

  triggerHapticFeedback(options.hapticsEnabled, normalizeDuration(options.hapticDurationMs))
}

/**
 * Applies press feedback for a concrete UI event and reports whether feedback
 * played. Canceled events, disabled controls, non-activation keyboard events,
 * and key repeats return false.
 */
export function playPressFeedbackForEvent(
  event: PressFeedbackEvent,
  options: PressFeedbackOptions = {},
): boolean {
  if (event.defaultPrevented || shouldSkipFeedback(options) || !shouldHandlePressFeedbackEvent(event)) {
    return false
  }

  playPressFeedback(options)
  return true
}

/**
 * Wraps press handlers while centralizing haptic preference, keyboard
 * activation, and disabled-state handling. Non-activation keyboard events still
 * reach the wrapped handler, but they do not trigger haptics.
 */
export function wrapPressHandler<EventType extends PressFeedbackEvent>(
  handler: ((event: EventType) => void) | undefined,
  options: PressFeedbackOptions = {},
  behavior: PressHandlerBehavior = {},
) {
  return (event: EventType) => {
    if (shouldSkipFeedback(options)) {
      return
    }

    if (!shouldHandlePressFeedbackEvent(event)) {
      handler?.(event)
      return
    }

    if (behavior.invokeHandlerBeforeFeedback) {
      handler?.(event)
      if (!event.defaultPrevented) {
        playPressFeedback(options)
      }
      return
    }

    if (!playPressFeedbackForEvent(event, options)) {
      return
    }

    handler?.(event)
  }
}
