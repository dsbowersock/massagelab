import type { ReactNode } from "react"

import styles from "@/app/chimer/running-timer.module.css"

/** Keeps background-specific property editors on one accessible group structure. */
export function BackgroundPropertyGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <fieldset className={styles.backgroundPropertyGroup}>
      <legend>{label}</legend>
      {children}
    </fieldset>
  )
}
