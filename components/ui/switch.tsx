"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { triggerHapticFeedback } from "@/lib/haptics"
import { cn } from "@/lib/utils"

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: "default" | "compact" | "dense"
  tone?: "orange" | "blue" | "leaf" | "alert"
  hapticsEnabled?: boolean
  hapticDurationMs?: number
  hapticReleaseDurationMs?: number
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({
  className,
  size = "default",
  tone = "orange",
  disabled,
  hapticsEnabled,
  hapticDurationMs = 10,
  hapticReleaseDurationMs = 8,
  onCheckedChange,
  ...props
}, ref) => {
  function handleCheckedChange(checked: boolean) {
    if (disabled) {
      return
    }

    triggerHapticFeedback(hapticsEnabled, [hapticDurationMs, 22, hapticReleaseDurationMs])
    onCheckedChange?.(checked)
  }

  return (
    <SwitchPrimitives.Root
      className={cn(
        "ml-switch peer inline-flex shrink-0 cursor-pointer items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-size={size}
      data-tone={tone}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb className="ml-switch-thumb pointer-events-none block" />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
