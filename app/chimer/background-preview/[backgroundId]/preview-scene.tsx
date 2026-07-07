"use client"

import { useEffect, useState } from "react"

import { BackgroundHost } from "@/components/backgrounds/BackgroundHost"
import type { BackgroundId } from "@/components/backgrounds/backgroundRegistry"
import { FEATURE_KEYS } from "@/lib/membership"
import styles from "./preview-scene.module.css"

const PREVIEW_FEATURE_KEYS = [FEATURE_KEYS.premiumBackgrounds]

/**
 * Internal capture surface for Chimer preview media generation. It intentionally
 * mounts the production BackgroundHost so generated assets track the live effect.
 */
export function ChimerBackgroundPreviewScene({
  backgroundId,
  label,
}: {
  backgroundId: BackgroundId
  label: string
}) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    document.body.classList.add("chimer-preview-capture")
    const timeout = window.setTimeout(() => setIsReady(true), 600)

    return () => {
      window.clearTimeout(timeout)
      document.body.classList.remove("chimer-preview-capture")
    }
  }, [])

  return (
    <main
      className={styles.scene}
      data-chimer-preview-scene={backgroundId}
      data-preview-ready={isReady ? "true" : "false"}
    >
      <h1 className={styles.label}>{label}</h1>
      <BackgroundHost
        selectedId={backgroundId}
        featureKeys={PREVIEW_FEATURE_KEYS}
        category="chimer"
        className={styles.background}
        testId="chimer-preview-background"
      />
      <div className={styles.frame} aria-hidden="true" />
    </main>
  )
}
