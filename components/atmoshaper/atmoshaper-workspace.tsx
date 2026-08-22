"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { useSettings } from "@/components/providers/settings-provider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { atmoShaperLayerSourceName, CurrentMix } from "./current-mix"
import { CurrentMixRail } from "./current-mix-rail"
import { SoundLibrary } from "./sound-library"
import {
  createAtmoShaperLayerSelectionRequest,
  resolveSoundLibraryPreviewAnnouncement,
} from "./sound-library-model.js"
import { useAtmoShaperRecipe } from "./use-atmoshaper-recipe"
import {
  isAtmoShaperFocusRestoreTarget,
  oppositeAtmoShaperEdge,
  resolveAtmoShaperDrawerMode,
  shouldAutoOpenAtmoShaperDrawer,
} from "./workspace-model.js"

type LayerSelectionReason = "commit" | "select-existing" | "rail"
type LayerSelectionRequest = {
  layerId: string
  requestKey: number
  opener: HTMLElement | null
  reason: LayerSelectionReason
}

export function AtmoShaperWorkspace() {
  const { actions, announce, announcement, music, recipe } = useAtmoShaperRecipe()
  const { settings } = useSettings()
  const failedLayerIdsRef = useRef(new Set<string>())
  const previewAnnouncementStateRef = useRef<{
    sourceKey: string
    sourceName: string
    status: "loading" | "playing" | "paused" | "failed"
  } | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const primaryRailToggleRef = useRef<HTMLButtonElement | null>(null)
  const drawerOpenerRef = useRef<HTMLElement | null>(null)
  const previousLayerCountRef = useRef(recipe.layers.length)
  const [layerSelectionRequest, setLayerSelectionRequest] = useState<LayerSelectionRequest | null>(null)
  const [mixDrawerOpen, setMixDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"roomy" | "narrow">("narrow")
  const drawerSide = oppositeAtmoShaperEdge(settings.sidebarPosition)

  const requestDrawerOpen = useCallback((opener: HTMLElement | null) => {
    if (mixDrawerOpen) return
    drawerOpenerRef.current = opener?.isConnected ? opener : primaryRailToggleRef.current
    setMixDrawerOpen(true)
  }, [mixDrawerOpen])

  const selectLibraryLayer = useCallback((
    layerId: string,
    opener: HTMLElement,
    reason: "commit" | "select-existing",
  ) => {
    setLayerSelectionRequest((current) => (
      createAtmoShaperLayerSelectionRequest(current, layerId, { opener, reason })
    ))
    if (reason === "select-existing") requestDrawerOpen(opener)
  }, [requestDrawerOpen])

  const openRailLayer = useCallback((layerId: string, opener: HTMLElement) => {
    setLayerSelectionRequest((current) => (
      createAtmoShaperLayerSelectionRequest(current, layerId, { opener, reason: "rail" })
    ))
    requestDrawerOpen(opener)
  }, [requestDrawerOpen])

  useLayoutEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return

    const measure = (inlineSize: number, blockSize: number) => {
      const parsedRootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      )
      const rootFontSize = Number.isFinite(parsedRootFontSize) ? parsedRootFontSize : 16
      setDrawerMode(resolveAtmoShaperDrawerMode({ inlineSize, blockSize, rootFontSize }))
    }
    const initialRect = workspace.getBoundingClientRect()
    measure(initialRect.width, initialRect.height)
    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      measure(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const previousLayerCount = previousLayerCountRef.current
    const nextLayerCount = recipe.layers.length
    previousLayerCountRef.current = nextLayerCount
    if (!shouldAutoOpenAtmoShaperDrawer(previousLayerCount, nextLayerCount)) return
    const firstAddOpener = layerSelectionRequest?.reason === "commit"
      ? layerSelectionRequest.opener
      : null
    requestDrawerOpen(firstAddOpener)
  }, [layerSelectionRequest, recipe.layers.length, requestDrawerOpen])

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

  const requestedLayerIsVisible = Boolean(
    layerSelectionRequest
    && (
      recipe.layers.some(({ id }) => id === layerSelectionRequest.layerId)
      || Object.values(music.atmoShaperSnapshot?.activeLayers ?? {})
        .some(({ id }) => id === layerSelectionRequest.layerId)
    ),
  )

  return (
    <div
      ref={workspaceRef}
      className="ml-atmoshaper-workspace min-w-0"
      aria-label="AtmoShaper live mixer"
      data-current-mix-side={drawerSide}
      data-drawer-mode={drawerMode}
    >
      <div className="ml-atmoshaper-layout" data-current-mix-side={drawerSide}>
        <CurrentMixRail
          actions={actions}
          drawerOpen={mixDrawerOpen}
          drawerSide={drawerSide}
          onOpenLayer={openRailLayer}
          onToggleDrawer={(opener) => {
            if (mixDrawerOpen) setMixDrawerOpen(false)
            else requestDrawerOpen(opener)
          }}
          primaryToggleRef={primaryRailToggleRef}
          recipe={recipe}
        />
        <SoundLibrary actions={actions} onSelectLayer={selectLibraryLayer} recipe={recipe} />
      </div>

      <Sheet
        modal={drawerMode === "narrow"}
        open={mixDrawerOpen}
        onOpenChange={(open) => {
          if (open) requestDrawerOpen(primaryRailToggleRef.current)
          else setMixDrawerOpen(false)
        }}
      >
        <SheetContent
          id="atmoshaper-current-mix-drawer"
          side={drawerSide}
          className="ml-atmoshaper-current-mix-drawer"
          data-drawer-mode={drawerMode}
          overlayClassName={drawerMode === "roomy"
            ? "ml-atmoshaper-current-mix-overlay-roomy"
            : "ml-atmoshaper-current-mix-overlay-narrow"}
          onInteractOutside={(event) => {
            if (drawerMode === "roomy") event.preventDefault()
          }}
          onOpenAutoFocus={(event) => {
            if (requestedLayerIsVisible) event.preventDefault()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const exactOpener = drawerOpenerRef.current
            drawerOpenerRef.current = null
            window.requestAnimationFrame(() => {
              const fallbackOpener = primaryRailToggleRef.current
              const focusTarget = isAtmoShaperFocusRestoreTarget(exactOpener)
                ? exactOpener
                : fallbackOpener
              if (focusTarget && isAtmoShaperFocusRestoreTarget(focusTarget)) {
                focusTarget.focus({ preventScroll: true })
              }
            })
          }}
        >
          <SheetHeader>
            <SheetTitle>Current Mix controls</SheetTitle>
            <SheetDescription>
              Adjust, reorder, retry, or remove every layer in this live mix.
            </SheetDescription>
          </SheetHeader>
          <div className="ml-atmoshaper-current-mix-drawer-body">
            <CurrentMix
              activeLayerId={layerSelectionRequest?.layerId ?? null}
              activeLayerRequestKey={layerSelectionRequest?.requestKey ?? 0}
              actions={actions}
              headingId="atmoshaper-current-mix-drawer-title"
              recipe={recipe}
            />
          </div>
        </SheetContent>
      </Sheet>

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
