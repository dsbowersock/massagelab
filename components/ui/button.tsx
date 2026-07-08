"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import {
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
        glow: "ml-button-tactile ml-button-glow",
        attention: "ml-button-tactile ml-button-attention",
        destructive: "ml-button-tactile ml-button-destructive",
        outline: "ml-button-tactile ml-button-outline",
        secondary: "ml-button-tactile ml-button-secondary",
        ghost: "ml-button-ghost",
        link: "ml-button-link",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
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
  "glow",
  "attention",
  "destructive",
  "outline",
  "secondary",
])

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Overrides the persisted haptic preference for this pressable control. */
  hapticsEnabled?: boolean
  /** Overrides the default tap-sized haptic duration, in milliseconds. */
  hapticDurationMs?: number
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
    size,
    asChild = false,
    disabled,
    hapticsEnabled,
    hapticDurationMs,
    onKeyDown,
    onPointerDown,
    pressFeedback,
    "aria-disabled": ariaDisabled,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    const resolvedVariant = variant ?? "default"
    const feedbackEnabled = shouldUsePressFeedback(resolvedVariant, pressFeedback)
    const feedbackOptions: PressFeedbackOptions = {
      ariaDisabled: isAriaDisabled(ariaDisabled),
      disabled,
      hapticDurationMs,
      hapticsEnabled,
    }

    const handlePointerDown = feedbackEnabled
      ? wrapPressHandler<React.PointerEvent<HTMLButtonElement>>(onPointerDown, feedbackOptions, {
          invokeHandlerBeforeFeedback: true,
        })
      : onPointerDown
    const handleKeyDown = feedbackEnabled
      ? wrapPressHandler<React.KeyboardEvent<HTMLButtonElement>>(onKeyDown, feedbackOptions, {
          invokeHandlerBeforeFeedback: true,
        })
      : onKeyDown

    return (
      <Comp
        className={cn(buttonVariants({ variant: resolvedVariant, size, className }))}
        ref={ref}
        disabled={disabled}
        aria-disabled={ariaDisabled}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
