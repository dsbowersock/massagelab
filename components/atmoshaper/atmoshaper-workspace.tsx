"use client"

import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { CurrentMix, CurrentMixTray } from "./current-mix"
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
      <div className="ml-atmoshaper-layout">
        <SoundLibrary actions={actions} recipe={recipe} />
        <div className="ml-atmoshaper-current-mix-desktop">
          <CurrentMix actions={actions} recipe={recipe} />
        </div>

        <Sheet>
          <div className="ml-atmoshaper-mix-tray">
            <CurrentMixTray recipe={recipe} />
            <SheetTrigger asChild>
              <Button type="button" size="sm" variant="outline" aria-label="Open full Current Mix">
                Full mix
              </Button>
            </SheetTrigger>
          </div>
          <SheetContent side="bottom" className="ml-atmoshaper-current-mix-sheet">
            <SheetHeader>
              <SheetTitle>Full Current Mix controls</SheetTitle>
              <SheetDescription>
                Adjust, reorder, retry, or remove every layer in this live mix.
              </SheetDescription>
            </SheetHeader>
            <div className="ml-atmoshaper-current-mix-sheet-body">
              <CurrentMix
                actions={actions}
                headingId="atmoshaper-current-mix-sheet-title"
                recipe={recipe}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
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
