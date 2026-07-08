"use client"

import { TactileButton, type TactileButtonProps } from "@/components/chimer-controls/TactileButton"

export interface CTAButtonProps extends TactileButtonProps {
  withAttentionRing?: boolean
}

/**
 * High-attention Chimer compatibility wrapper backed by shared button variants.
 */
export function CTAButton({
  className,
  withAttentionRing = false,
  variant = "cta",
  ...props
}: CTAButtonProps) {
  return (
    <TactileButton
      variant={withAttentionRing ? "attention" : variant}
      className={className}
      {...props}
    />
  )
}
