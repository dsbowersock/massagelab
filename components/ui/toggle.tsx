"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { triggerHapticFeedback } from "@/lib/haptics"
import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "ml-toggle inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-[background-color,color,box-shadow,transform,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "ml-toggle-physical",
        outline: "ml-toggle-outline",
        ghost: "ml-toggle-ghost",
      },
      tone: {
        blue: "",
        alert: "ml-toggle-tone-alert",
      },
      size: {
        default: "h-10 px-3 min-w-10",
        sm: "h-9 px-2.5 min-w-9",
        lg: "h-11 px-5 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      tone: "blue",
      size: "default",
    },
  }
)

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {
  hapticsEnabled?: boolean
  hapticDurationMs?: number
  hapticReleaseDurationMs?: number
}

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  ToggleProps
>(({
  className,
  variant,
  tone,
  size,
  disabled,
  hapticsEnabled,
  hapticDurationMs = 10,
  hapticReleaseDurationMs = 8,
  onPressedChange,
  ...props
}, ref) => {
  function handlePressedChange(pressed: boolean) {
    if (disabled) {
      return
    }

    triggerHapticFeedback(hapticsEnabled, [hapticDurationMs, 22, hapticReleaseDurationMs])
    onPressedChange?.(pressed)
  }

  return (
    <TogglePrimitive.Root
      ref={ref}
      className={cn(toggleVariants({ variant, tone, size, className }))}
      disabled={disabled}
      onPressedChange={handlePressedChange}
      {...props}
    />
  )
})

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
