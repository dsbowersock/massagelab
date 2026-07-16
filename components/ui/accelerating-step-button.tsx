"use client"

import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"

export interface AcceleratingStepButtonProps
  extends Omit<
    ButtonProps,
    "onClick" | "onPointerCancel" | "onPointerDown" | "onPointerUp"
  > {
  /** Amount applied for an ordinary activation or each held repeat. */
  step: number
  /** Total amount applied across a quick double activation. */
  doubleStep?: number
  onStep: (amount: number) => void
  repeatDelayMs?: number
  doublePressWindowMs?: number
}

const repeatSlowMs = 360
const repeatMediumMs = 190
const repeatFastMs = 90
const repeatAccelerationMs = 1500

/**
 * Shared stepper action that preserves immediate single presses while adding
 * accelerated press-and-hold repetition and a larger double-press step.
 */
export function AcceleratingStepButton({
  step,
  doubleStep = step * 5,
  onStep,
  repeatDelayMs = 480,
  doublePressWindowMs = 280,
  disabled,
  ...buttonProps
}: AcceleratingStepButtonProps) {
  const repeatTimerRef = React.useRef<number | null>(null)
  const pressStartedAtRef = React.useRef(0)
  const repeatedRef = React.useRef(false)
  const suppressClickRef = React.useRef(false)
  const lastActivationAtRef = React.useRef(0)

  const clearRepeatTimer = React.useCallback(() => {
    if (repeatTimerRef.current !== null) {
      window.clearTimeout(repeatTimerRef.current)
      repeatTimerRef.current = null
    }
  }, [])

  const scheduleRepeat = React.useCallback(function repeat() {
    const elapsed = performance.now() - pressStartedAtRef.current
    const interval = elapsed >= repeatAccelerationMs
      ? repeatFastMs
      : elapsed >= repeatAccelerationMs / 2
        ? repeatMediumMs
        : repeatSlowMs

    repeatTimerRef.current = window.setTimeout(() => {
      repeatedRef.current = true
      onStep(step)
      repeat()
    }, interval)
  }, [onStep, step])

  React.useEffect(() => clearRepeatTimer, [clearRepeatTimer])

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (
      disabled
      || event.isPrimary === false
      || (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return
    }

    clearRepeatTimer()
    repeatedRef.current = false
    suppressClickRef.current = false
    pressStartedAtRef.current = performance.now()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    repeatTimerRef.current = window.setTimeout(() => {
      repeatedRef.current = true
      onStep(step)
      scheduleRepeat()
    }, repeatDelayMs)
  }

  function finishPointerPress() {
    clearRepeatTimer()
    if (repeatedRef.current) {
      suppressClickRef.current = true
      lastActivationAtRef.current = 0
    }
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    const now = performance.now()
    if (
      lastActivationAtRef.current > 0
      && now - lastActivationAtRef.current <= doublePressWindowMs
    ) {
      onStep(doubleStep - step)
      lastActivationAtRef.current = 0
      return
    }

    onStep(step)
    lastActivationAtRef.current = now
  }

  return (
    <Button
      {...buttonProps}
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={finishPointerPress}
      onPointerCancel={finishPointerPress}
    />
  )
}
