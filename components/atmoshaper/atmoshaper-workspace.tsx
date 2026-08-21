"use client"

import { useEffect, useRef } from "react"

import { CurrentMix } from "./current-mix"
import { SoundLibrary } from "./sound-library"
import { useAtmoShaperRecipe } from "./use-atmoshaper-recipe"

export function AtmoShaperWorkspace() {
  const { actions, announce, announcement, music, recipe } = useAtmoShaperRecipe()
  const failedLayerIdsRef = useRef(new Set<string>())

  useEffect(() => {
    const failedLayers = Object.entries(music.atmoShaperSnapshot?.layers ?? {})
      .filter(([, state]) => state.status === "failed")
    const currentFailedIds = new Set(failedLayers.map(([layerId]) => layerId))
    const newlyFailed = failedLayers.find(([layerId]) => !failedLayerIdsRef.current.has(layerId))
    failedLayerIdsRef.current = currentFailedIds

    if (newlyFailed) {
      const [, state] = newlyFailed
      announce(`Layer failed${state.error ? `: ${state.error}` : "."}`)
    }
  }, [announce, music.atmoShaperSnapshot?.layers])

  return (
    <div className="ml-atmoshaper-workspace min-w-0" aria-label="AtmoShaper live mixer">
      <SoundLibrary actions={actions} recipe={recipe} />
      <CurrentMix actions={actions} recipe={recipe} />
      <p
        key={announcement?.id}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement?.message ?? ""}
      </p>
    </div>
  )
}
