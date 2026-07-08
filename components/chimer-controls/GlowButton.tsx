"use client"

import { TactileButton, type TactileButtonProps } from "@/components/chimer-controls/TactileButton"

/**
 * Subtle glow Chimer compatibility wrapper backed by the shared glow variant.
 */
export function GlowButton({ className, variant = "glow", ...props }: TactileButtonProps) {
  return (
    <TactileButton
      variant={variant}
      className={className}
      {...props}
    />
  )
}
