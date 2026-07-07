import { KeyboardEvent, MouseEvent, SyntheticEvent, TouchEvent } from "react";
import { shouldPlayHaptics, triggerHapticFeedback } from "@/lib/haptics";

export interface PressHandlerOptions {
  /** When true, a subtle vibration is triggered before invoking the action. */
  hapticsEnabled?: boolean;
  /** Vibration length in milliseconds. */
  hapticDurationMs?: number;
  /** Optional guard to skip haptics for specific interactions. */
  skipHaptics?: boolean;
  /** Optional guard to stop actions on disabled controls. */
  disabled?: boolean;
}

type ChimerPressEvent = MouseEvent<HTMLElement> | TouchEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
type PossiblyDisabledElement = { disabled?: boolean } | null;

function hasDisabledTarget(event: ChimerPressEvent | SyntheticEvent): boolean {
  const maybeTarget = event.currentTarget as PossiblyDisabledElement;

  if (maybeTarget && typeof maybeTarget === "object" && "disabled" in maybeTarget) {
    return !!maybeTarget.disabled;
  }

  return false;
}

const isActivationKey = (event: KeyboardEvent): boolean =>
  event.key === "Enter" || event.key === " ";

/**
 * Wrap an event handler so press/tap/key-activation and the optional haptic cue
 * stay in one place.
 */
export function withChimerPress(
  handler: () => void,
  options: PressHandlerOptions = {}
): (event: ChimerPressEvent | SyntheticEvent) => void {
  const {
    hapticsEnabled,
    hapticDurationMs = 15,
    skipHaptics = false,
    disabled = false,
  } = options;

  return function handlePress(event: ChimerPressEvent | SyntheticEvent) {
    if (disabled || hasDisabledTarget(event)) {
      return;
    }

    const maybeKeyboardEvent = event as KeyboardEvent;
    if ("key" in maybeKeyboardEvent && !isActivationKey(maybeKeyboardEvent as KeyboardEvent)) {
      return;
    }

    if (!skipHaptics && shouldPlayHaptics(hapticsEnabled)) {
      if (!("key" in maybeKeyboardEvent)) {
        triggerHapticFeedback(hapticsEnabled, hapticDurationMs);
      } else if (isActivationKey(maybeKeyboardEvent as KeyboardEvent)) {
        triggerHapticFeedback(hapticsEnabled, hapticDurationMs);
      }
    }

    handler();
  };
}
