"use client"

import { cn } from "@/lib/utils"
import { TactileButton, type TactileButtonProps } from "@/components/chimer-controls/TactileButton"
import styles from "./chimer-controls.module.css"

export interface CTAButtonProps extends TactileButtonProps {
  withAttentionRing?: boolean
}

/**
 * High-attention button treatment used for important calls to action.
 */
export function CTAButton({
  className,
  withAttentionRing = false,
  ...props
}: CTAButtonProps) {
  return (
    <TactileButton
      className={cn(
        styles.ctaButton,
        withAttentionRing && styles.ctaRing,
        className,
      )}
      {...props}
    />
  )
}
