"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import {
  markPressFeedbackHandled,
  playPressFeedback,
  playPressReleaseFeedback,
  wrapPressHandler,
  type PressFeedbackOptions,
} from "@/lib/press-feedback"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "ml-button-press-motion inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[background-color,color,box-shadow,transform,border-color,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "ml-button-tactile ml-button-default",
        // Backwards-compatible aliases while older call sites migrate to default/secondary.
        mechanical: "ml-button-tactile ml-button-default",
        mechanicalSecondary: "ml-button-tactile ml-button-secondary",
        cta: "ml-button-tactile ml-button-cta",
        ctaBlue: "ml-button-tactile ml-button-cta-blue",
        calendar: "ml-button-tactile ml-button-calendar",
        glow: "ml-button-tactile ml-button-glow",
        attention: "ml-button-tactile ml-button-attention",
        destructive: "ml-button-tactile ml-button-destructive",
        outline: "ml-button-tactile ml-button-outline",
        secondary: "ml-button-tactile ml-button-secondary",
        ghost: "ml-button-ghost",
        link: "ml-button-link",
      },
      tone: {
        default: "",
        setup: "ml-button-tone-setup",
        anatomime: "ml-button-tone-anatomime",
        pricing: "ml-button-tone-pricing",
      },
      effect: {
        none: "",
        glowFlicker: "ml-button-glow-neon-flicker",
      },
      size: {
        default: "h-10 px-4 py-2",
        compact: "h-8 rounded-md px-3 text-xs",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      tone: "default",
      effect: "none",
      size: "default",
    },
  }
)

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]

const tactileVariants: ReadonlySet<ButtonVariant> = new Set([
  "default",
  "mechanical",
  "mechanicalSecondary",
  "cta",
  "ctaBlue",
  "calendar",
  "glow",
  "attention",
  "destructive",
  "outline",
  "secondary",
])

const pressFeedbackMoveCancelPx = 10
const touchPressFeedbackDelayMs = 45
const releaseFeedbackAfterLatePressDelayMs = 24
const pointerClickGuardDurationMs = 600

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Overrides the persisted haptic preference for this pressable control. */
  hapticsEnabled?: boolean
  /** Overrides the default tap-sized haptic duration, in milliseconds. */
  hapticDurationMs?: number
  /** Overrides the shorter release-side haptic duration, in milliseconds. */
  hapticReleaseDurationMs?: number
  /** Explicitly enables or disables press feedback beyond variant defaults. */
  pressFeedback?: boolean
}

/** Normalizes `aria-disabled`, which React accepts as a boolean or string. */
function isAriaDisabled(value: ButtonProps["aria-disabled"]) {
  return value === true || value === "true"
}

/**
 * Explicit caller intent wins. Otherwise only tactile variants emit press
 * feedback so quiet utility/link buttons stay visually and physically calm.
 */
function shouldUsePressFeedback(variant: ButtonVariant, explicitValue: boolean | undefined) {
  if (typeof explicitValue === "boolean") {
    return explicitValue
  }

  return tactileVariants.has(variant)
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    tone,
    effect,
    size,
    asChild = false,
    disabled,
    hapticsEnabled,
    hapticDurationMs,
    hapticReleaseDurationMs,
    onClick,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    pressFeedback,
    "aria-disabled": ariaDisabled,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    const resolvedVariant = variant ?? "default"
    const feedbackEnabled = shouldUsePressFeedback(resolvedVariant, pressFeedback)
    const resolvedAriaDisabled = isAriaDisabled(ariaDisabled)
    const pointerFeedbackRef = React.useRef<{
      pointerId: number
      x: number
      y: number
      downPlayed: boolean
      timerId: number | null
    } | null>(null)
    const pointerHandledClickRef = React.useRef(false)
    const pointerClickGuardTimerRef = React.useRef<number | null>(null)
    const releaseFeedbackTimerRef = React.useRef<number | null>(null)
    const feedbackOptions = React.useMemo<PressFeedbackOptions>(() => ({
      ariaDisabled: resolvedAriaDisabled,
      disabled,
      hapticDurationMs,
      hapticReleaseDurationMs,
      hapticsEnabled,
    }), [disabled, hapticDurationMs, hapticReleaseDurationMs, hapticsEnabled, resolvedAriaDisabled])

    const clearPointerFeedbackTimer = React.useCallback(() => {
      const pointerFeedback = pointerFeedbackRef.current
      if (pointerFeedback?.timerId != null) {
        window.clearTimeout(pointerFeedback.timerId)
        pointerFeedback.timerId = null
      }
    }, [])

    const clearPointerClickGuardTimer = React.useCallback(() => {
      if (pointerClickGuardTimerRef.current != null) {
        window.clearTimeout(pointerClickGuardTimerRef.current)
        pointerClickGuardTimerRef.current = null
      }
    }, [])

    const clearReleaseFeedbackTimer = React.useCallback(() => {
      if (releaseFeedbackTimerRef.current != null) {
        window.clearTimeout(releaseFeedbackTimerRef.current)
        releaseFeedbackTimerRef.current = null
      }
    }, [])

    React.useEffect(() => (
      () => {
        clearPointerFeedbackTimer()
        clearPointerClickGuardTimer()
        clearReleaseFeedbackTimer()
      }
    ), [clearPointerClickGuardTimer, clearPointerFeedbackTimer, clearReleaseFeedbackTimer])

    const markPointerHandledClick = React.useCallback(() => {
      pointerHandledClickRef.current = true
      clearPointerClickGuardTimer()
      pointerClickGuardTimerRef.current = window.setTimeout(() => {
        pointerHandledClickRef.current = false
        pointerClickGuardTimerRef.current = null
      }, pointerClickGuardDurationMs)
    }, [clearPointerClickGuardTimer])

    const playReleaseFeedback = React.useCallback((delayMs = 0) => {
      clearReleaseFeedbackTimer()
      if (delayMs > 0) {
        releaseFeedbackTimerRef.current = window.setTimeout(() => {
          playPressReleaseFeedback(feedbackOptions)
          releaseFeedbackTimerRef.current = null
        }, delayMs)
        return
      }

      playPressReleaseFeedback(feedbackOptions)
    }, [clearReleaseFeedbackTimer, feedbackOptions])

    const cancelPointerFeedback = React.useCallback(() => {
      clearPointerFeedbackTimer()
      pointerFeedbackRef.current = null
    }, [clearPointerFeedbackTimer])

    const playPointerDownFeedback = React.useCallback((pointerId: number) => {
      const pointerFeedback = pointerFeedbackRef.current
      if (!pointerFeedback || pointerFeedback.pointerId !== pointerId || pointerFeedback.downPlayed) {
        return
      }

      pointerFeedback.downPlayed = true
      pointerFeedback.timerId = null
      playPressFeedback(feedbackOptions)
    }, [feedbackOptions])

    const shouldCancelPointerFeedback = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
      const pointerFeedback = pointerFeedbackRef.current
      if (!pointerFeedback || pointerFeedback.pointerId !== event.pointerId) {
        return false
      }

      return (
        Math.abs(event.clientX - pointerFeedback.x) > pressFeedbackMoveCancelPx
        || Math.abs(event.clientY - pointerFeedback.y) > pressFeedbackMoveCancelPx
      )
    }, [])

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event)
      if (
        !feedbackEnabled
        || event.defaultPrevented
        || feedbackOptions.disabled
        || feedbackOptions.ariaDisabled
        || event.isPrimary === false
        || (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return
      }

      const pointerFeedback: {
        pointerId: number
        x: number
        y: number
        downPlayed: boolean
        timerId: number | null
      } = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        downPlayed: false,
        timerId: null,
      }
      pointerFeedbackRef.current = pointerFeedback

      if (event.pointerType === "touch" || event.pointerType === "pen") {
        pointerFeedback.timerId = window.setTimeout(() => {
          playPointerDownFeedback(event.pointerId)
        }, touchPressFeedbackDelayMs)
        return
      }

      playPointerDownFeedback(event.pointerId)
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerMove?.(event)
      if (!feedbackEnabled || !shouldCancelPointerFeedback(event)) {
        return
      }

      cancelPointerFeedback()
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerUp?.(event)
      const pointerFeedback = pointerFeedbackRef.current
      if (
        !feedbackEnabled
        || !pointerFeedback
        || pointerFeedback.pointerId !== event.pointerId
        || event.defaultPrevented
      ) {
        cancelPointerFeedback()
        return
      }

      if (shouldCancelPointerFeedback(event)) {
        cancelPointerFeedback()
        return
      }

      clearPointerFeedbackTimer()
      pointerFeedbackRef.current = null
      markPointerHandledClick()

      if (!pointerFeedback.downPlayed) {
        playPressFeedback(feedbackOptions)
        playReleaseFeedback(releaseFeedbackAfterLatePressDelayMs)
        return
      }

      playReleaseFeedback()
    }

    const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerCancel?.(event)
      cancelPointerFeedback()
    }

    // Keyboard/programmatic clicks still fall back to click-time feedback. Pointer clicks
    // are guarded so touch devices get one physical press/release pair instead of duplicates.
    const handleClick = feedbackEnabled
      ? (event: React.MouseEvent<HTMLButtonElement>) => {
          if (pointerHandledClickRef.current) {
            pointerHandledClickRef.current = false
            clearPointerClickGuardTimer()
            markPressFeedbackHandled(event)
            onClick?.(event)
            return
          }

          wrapPressHandler<React.MouseEvent<HTMLButtonElement>>(onClick, feedbackOptions, {
            invokeHandlerBeforeFeedback: true,
          })(event)
        }
      : onClick

    return (
      <Comp
        className={cn(buttonVariants({ variant: resolvedVariant, tone, effect, size, className }))}
        ref={ref}
        disabled={disabled}
        aria-disabled={ariaDisabled}
        onClick={handleClick}
        onKeyDown={onKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
