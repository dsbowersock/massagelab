"use client"

import { cn } from "@/lib/utils"
import styles from "./chimer-controls.module.css"

export interface LoaderProps {
  shape?: "sphere"
  variant?: "dither"
  size?: number
  speed?: number
  color?: string
  className?: string
  label?: string
}

function toSpeed(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 1
  }

  return Math.max(0.4, Math.min(3, value))
}

function normalizeSize(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 44
  }

  return Math.max(24, Math.min(140, Math.round(value)))
}

/**
 * Orange-tinted, animated loader used for background generation and visual loading states.
 */
export function Loader({
  shape = "sphere",
  variant = "dither",
  size = 44,
  speed = 1,
  color = "#ea580c",
  className,
  label = "Loading",
}: LoaderProps) {
  if (shape !== "sphere") {
    return null
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        styles.loaderWrapper,
        className,
      )}
      style={
        {
          "--ml-loader-size": `${normalizeSize(size)}px`,
          "--ml-loader-speed": `${toSpeed(speed)}s`,
          "--ml-loader-color": color,
        } as React.CSSProperties
      }
    >
      <span
        className={styles.loaderSphere}
        data-variant={variant}
        aria-hidden="true"
      />
      <span className={styles.loaderText}>{label}</span>
      <span className={styles.srOnly}>Loading</span>
    </span>
  )
}
