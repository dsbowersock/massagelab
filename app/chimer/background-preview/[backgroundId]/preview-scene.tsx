"use client"

import { useEffect, useState } from "react"

import { BackgroundHost } from "@/components/backgrounds/BackgroundHost"
import type { BackgroundId } from "@/components/backgrounds/backgroundRegistry"
import { DEFAULT_CHIMER_SETTINGS } from "@/lib/chimer-timer"
import { resolveDnaTwistedCubesBackgroundHostProps } from "@/lib/dna-twisted-cubes-background-host"
import { FEATURE_KEYS } from "@/lib/membership"
import styles from "./preview-scene.module.css"

const PREVIEW_ACCESS = Object.freeze({
  featureKeys: [FEATURE_KEYS.premiumBackgrounds],
  ownedBackgroundIds: [],
})

// Preview capture uses the same canonical setting-to-host adapter as Chimer,
// Clock, and Music so newly added effects never mount with missing geometry.
const PREVIEW_TRACK_4B_EFFECT_PROPS = resolveDnaTwistedCubesBackgroundHostProps({
  settings: DEFAULT_CHIMER_SETTINGS,
  category: "chimer",
})

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
        {...PREVIEW_TRACK_4B_EFFECT_PROPS}
        selectedId={backgroundId}
        access={PREVIEW_ACCESS}
        category="chimer"
        massageLabGridMotion={{
          mantras: [...DEFAULT_CHIMER_SETTINGS.massageLabGridMotionMantras],
        }}
        className={styles.background}
        testId="chimer-preview-background"
      />
      <div className={styles.frame} aria-hidden="true" />
    </main>
  )
}
