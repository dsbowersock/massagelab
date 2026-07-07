"use client"

import { cn } from "@/lib/utils"
import { TactileButton, type TactileButtonProps } from "@/components/chimer-controls/TactileButton"
import styles from "./chimer-controls.module.css"

/**
 * Subtle glass/glow treatment for premium or secondary visual actions.
 */
export function GlowButton({ className, ...props }: TactileButtonProps) {
  return (
    <TactileButton
      className={cn(styles.glowButton, className)}
      {...props}
    />
  )
}
