"use client"

import type * as React from "react"

import {
  playPressFeedback,
  wrapPressHandler,
  type PressFeedbackOptions,
} from "@/lib/press-feedback"

export type ChimerPressEvent =
  | React.MouseEvent<HTMLElement>
  | React.TouchEvent<HTMLElement>
  | React.KeyboardEvent<HTMLElement>
  | React.PointerEvent<HTMLElement>

export type HapticPressOptions = PressFeedbackOptions

export { playPressFeedback }

/**
 * Compatibility wrapper for existing Chimer controls while the press-feedback
 * behavior lives in the shared UI helper.
 */
export function wrapChimerPressHandler<T extends ChimerPressEvent>(
  handler: (event: T) => void,
  options: HapticPressOptions = {},
) {
  return wrapPressHandler(handler, options)
}
