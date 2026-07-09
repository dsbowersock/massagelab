"use client"

import { TactileButton, type TactileButtonProps } from "@/components/chimer-controls/TactileButton"
import { MetalAttentionRing } from "@/components/ui/metal-attention-button"

export interface CTAButtonProps extends TactileButtonProps {
  /** Legacy Chimer affordance; wraps the selected variant instead of changing it. */
  withAttentionRing?: boolean
}

/**
 * High-attention Chimer compatibility wrapper backed by shared button variants.
 */
export function CTAButton({
  className,
  withAttentionRing = false,
  disabled,
  variant = "cta",
  ...props
}: CTAButtonProps) {
  const button = (
    <TactileButton
      variant={variant}
      className={className}
      disabled={disabled}
      {...props}
    />
  )

  if (!withAttentionRing) {
    return button
  }

  return (
    <MetalAttentionRing metalMode={disabled ? "off" : "cycle"}>
      {button}
    </MetalAttentionRing>
  )
}
