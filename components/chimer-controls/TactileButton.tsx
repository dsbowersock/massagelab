"use client"

import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { wrapChimerPressHandler, type HapticPressOptions } from "@/components/chimer-controls/haptics"
import { cn } from "@/lib/utils"
import styles from "./chimer-controls.module.css"

export interface TactileButtonProps extends Omit<ButtonProps, "onClick" | "onKeyDown" | "onTouchStart"> {
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>
  onTouchStart?: React.TouchEventHandler<HTMLButtonElement>
  hapticsEnabled?: boolean
  hapticDurationMs?: HapticPressOptions["hapticDurationMs"]
  className?: string
}

function wrapMousePress(
  handler: React.MouseEventHandler<HTMLButtonElement> | undefined,
  disabled: boolean | undefined,
  hapticsEnabled?: boolean,
  hapticDurationMs?: number,
) {
  if (!handler) {
    return undefined
  }

  return wrapChimerPressHandler((event: React.MouseEvent<HTMLButtonElement>) => {
    handler(event)
  }, { disabled, hapticsEnabled, hapticDurationMs })
}

/**
 * Type-safe per-event wrapper to preserve JSX handler typing.
 */
function wrapTouchPress(
  handler: React.TouchEventHandler<HTMLButtonElement> | undefined,
  disabled: boolean | undefined,
  hapticsEnabled?: boolean,
  hapticDurationMs?: number,
) {
  if (!handler) {
    return undefined
  }

  return wrapChimerPressHandler((event: React.TouchEvent<HTMLButtonElement>) => {
    handler(event)
  }, { disabled, hapticsEnabled, hapticDurationMs })
}

/**
 * Type-safe per-event wrapper to preserve JSX handler typing.
 */
function wrapKeyPress(
  handler: React.KeyboardEventHandler<HTMLButtonElement> | undefined,
  disabled: boolean | undefined,
  hapticsEnabled?: boolean,
  hapticDurationMs?: number,
) {
  if (!handler) {
    return undefined
  }

  return wrapChimerPressHandler((event: React.KeyboardEvent<HTMLButtonElement>) => {
    handler(event)
  }, { disabled, hapticsEnabled, hapticDurationMs })
}

/**
 * Groups wrapped pointer, touch, and keyboard handlers so haptics stay
 * consistent across button activation paths.
 */
function createButtonHandlers(
  onClick: React.MouseEventHandler<HTMLButtonElement> | undefined,
  onKeyDown: React.KeyboardEventHandler<HTMLButtonElement> | undefined,
  onTouchStart: React.TouchEventHandler<HTMLButtonElement> | undefined,
  disabled: boolean | undefined,
  hapticsEnabled?: boolean,
  hapticDurationMs?: number,
) {
  return {
    onClick: wrapMousePress(onClick, disabled, hapticsEnabled, hapticDurationMs),
    onKeyDown: wrapKeyPress(onKeyDown, disabled, hapticsEnabled, hapticDurationMs),
    onTouchStart: wrapTouchPress(onTouchStart, disabled, hapticsEnabled, hapticDurationMs),
  }
}

/**
 * Shared button wrapper for tactile controls with the elevated/depressed visual state
 * and optional haptic intent feedback.
 */
export function TactileButton({
  className,
  hapticsEnabled,
  hapticDurationMs,
  disabled,
  onClick,
  onKeyDown,
  onTouchStart,
  type = "button",
  ...buttonProps
}: TactileButtonProps) {
  const { onClick: wrappedOnClick, onKeyDown: wrappedOnKeyDown, onTouchStart: wrappedOnTouchStart } =
    createButtonHandlers(onClick, onKeyDown, onTouchStart, disabled, hapticsEnabled, hapticDurationMs)

  return (
    <Button
      type={type}
      disabled={disabled}
      className={cn(styles.tactileButton, className)}
      onClick={wrappedOnClick}
      onKeyDown={wrappedOnKeyDown}
      onTouchStart={wrappedOnTouchStart}
      {...buttonProps}
    />
  )
}
