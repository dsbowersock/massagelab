"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { atmoShaperLayerSourceName, CurrentMix, CurrentMixTray } from "./current-mix"
import { SoundLibrary } from "./sound-library"
import {
  createAtmoShaperLayerSelectionRequest,
  resolveSoundLibraryPreviewAnnouncement,
} from "./sound-library-model.js"
import { useAtmoShaperRecipe } from "./use-atmoshaper-recipe"

export function AtmoShaperWorkspace() {
  const { actions, announce, announcement, music, recipe } = useAtmoShaperRecipe()
  const failedLayerIdsRef = useRef(new Set<string>())
  const previewAnnouncementStateRef = useRef<{
    sourceKey: string
    sourceName: string
    status: "loading" | "playing" | "paused" | "failed"
  } | null>(null)
  const desktopMixRef = useRef<HTMLDivElement | null>(null)
  const [layerSelectionRequest, setLayerSelectionRequest] = useState<{
    layerId: string
    requestKey: number
  } | null>(null)
  const [mixSheetOpen, setMixSheetOpen] = useState(false)

  const selectLayer = useCallback((layerId: string) => {
    setLayerSelectionRequest((current) => (
      createAtmoShaperLayerSelectionRequest(current, layerId)
    ))
    const desktopMix = desktopMixRef.current
    const desktopMixVisible = desktopMix
      ? window.getComputedStyle(desktopMix).display !== "none"
      : false
    if (!desktopMixVisible) setMixSheetOpen(true)
  }, [])

  const { stopAtmoShaperPreview } = music
  useEffect(() => () => {
    void stopAtmoShaperPreview()
  }, [stopAtmoShaperPreview])

  useEffect(() => {
    const failedLayers = Object.entries(music.atmoShaperSnapshot?.layers ?? {})
      .filter(([, state]) => state.status === "failed")
    const currentFailedIds = new Set(failedLayers.map(([layerId]) => layerId))
    const newlyFailedLayers = failedLayers.filter(([layerId]) => !failedLayerIdsRef.current.has(layerId))
    failedLayerIdsRef.current = currentFailedIds

    if (newlyFailedLayers.length > 0) {
      const recipeLayers = new Map([
        ...recipe.layers,
        ...Object.values(music.atmoShaperSnapshot?.activeLayers ?? {}),
      ].map((layer) => [layer.id, layer]))
      announce(newlyFailedLayers
        .map(([layerId, state]) => {
          const layer = recipeLayers.get(layerId)
          const sourceName = layer ? atmoShaperLayerSourceName(layer) : "Layer"
          return `${sourceName} failed${state.error ? `: ${state.error}` : "."}`
        })
        .join(" "))
    }
  }, [announce, music.atmoShaperSnapshot?.activeLayers, music.atmoShaperSnapshot?.layers, recipe.layers])

  useEffect(() => {
    const preview = music.atmoShaperPreview
    const transition = resolveSoundLibraryPreviewAnnouncement(
      previewAnnouncementStateRef.current,
      preview,
      preview ? atmoShaperLayerSourceName(preview.layer) : null,
    )
    previewAnnouncementStateRef.current = transition.state
    if (transition.message) announce(transition.message)
  }, [announce, music.atmoShaperPreview])

  return (
    <div className="ml-atmoshaper-workspace min-w-0" aria-label="AtmoShaper live mixer">
      <div className="ml-atmoshaper-layout">
        <SoundLibrary actions={actions} onSelectLayer={selectLayer} recipe={recipe} />
        <div ref={desktopMixRef} className="ml-atmoshaper-current-mix-desktop">
          <CurrentMix
            activeLayerId={layerSelectionRequest?.layerId ?? null}
            activeLayerRequestKey={layerSelectionRequest?.requestKey ?? 0}
            actions={actions}
            recipe={recipe}
          />
        </div>

        <Sheet open={mixSheetOpen} onOpenChange={setMixSheetOpen}>
          <div className="ml-atmoshaper-mix-tray">
            <CurrentMixTray recipe={recipe} />
            <SheetTrigger asChild>
              <Button type="button" size="sm" variant="outline" aria-label="Open full Current Mix">
                Full mix
              </Button>
            </SheetTrigger>
          </div>
          <SheetContent
            side="bottom"
            className="ml-atmoshaper-current-mix-sheet"
            onOpenAutoFocus={(event) => {
              if (layerSelectionRequest) event.preventDefault()
            }}
          >
            <SheetHeader>
              <SheetTitle>Full Current Mix controls</SheetTitle>
              <SheetDescription>
                Adjust, reorder, retry, or remove every layer in this live mix.
              </SheetDescription>
            </SheetHeader>
            <div className="ml-atmoshaper-current-mix-sheet-body">
              <CurrentMix
                activeLayerId={layerSelectionRequest?.layerId ?? null}
                activeLayerRequestKey={layerSelectionRequest?.requestKey ?? 0}
                actions={actions}
                headingId="atmoshaper-current-mix-sheet-title"
                recipe={recipe}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <p
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
