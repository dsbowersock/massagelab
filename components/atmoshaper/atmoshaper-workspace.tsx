"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { useSettings } from "@/components/providers/settings-provider"
import { Button } from "@/components/ui/button"

import { atmoShaperLayerSourceName } from "./current-mix"
import { CurrentMixRail, useAtmoShaperSoloControls } from "./current-mix-rail"
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
  const currentMixPanelRef = useRef<HTMLElement | null>(null)
  const primaryRailToggleRef = useRef<HTMLButtonElement | null>(null)
  const drawerOpenerRef = useRef<HTMLElement | null>(null)
  const drawerOpenerKeyRef = useRef<string | null>(null)
  const previousLayerCountRef = useRef(recipe.layers.length)
  const [layerSelectionRequest, setLayerSelectionRequest] = useState<LayerSelectionRequest | null>(null)
  const [mixDrawerOpen, setMixDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"roomy" | "narrow">("narrow")
  const drawerSide = oppositeAtmoShaperEdge(settings.sidebarPosition)
  const soloControls = useAtmoShaperSoloControls(actions, recipe)

  const requestDrawerOpen = useCallback((opener: HTMLElement | null) => {
    if (mixDrawerOpen) return
    drawerOpenerRef.current = opener?.isConnected ? opener : primaryRailToggleRef.current
    drawerOpenerKeyRef.current = opener?.dataset.atmoshaperFocusKey ?? null
    setMixDrawerOpen(true)
  }, [mixDrawerOpen])

  const closeDrawer = useCallback((restoreFocus: boolean) => {
    setMixDrawerOpen(false)
    const exactOpener = drawerOpenerRef.current
    const openerKey = drawerOpenerKeyRef.current
    drawerOpenerRef.current = null
    drawerOpenerKeyRef.current = null
    if (!restoreFocus) return
    window.requestAnimationFrame(() => {
      const semanticOpener = openerKey
        ? Array.from(document.querySelectorAll<HTMLElement>("[data-atmoshaper-focus-key]"))
            .find((candidate) => candidate.dataset.atmoshaperFocusKey === openerKey)
        : null
      const focusTarget = isAtmoShaperFocusRestoreTarget(exactOpener)
        ? exactOpener
        : isAtmoShaperFocusRestoreTarget(semanticOpener)
          ? semanticOpener
          : primaryRailToggleRef.current
      if (focusTarget && isAtmoShaperFocusRestoreTarget(focusTarget)) {
        focusTarget.focus({ preventScroll: true })
      }
    })
  }, [])

  const toggleDrawer = useCallback((opener: HTMLElement) => {
    if (mixDrawerOpen) closeDrawer(true)
    else requestDrawerOpen(opener)
  }, [closeDrawer, mixDrawerOpen, requestDrawerOpen])

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

  const { prepareAtmoShaperAudio, stopAtmoShaperPreview } = music
  useEffect(() => {
    void prepareAtmoShaperAudio()
  }, [prepareAtmoShaperAudio])

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

  useLayoutEffect(() => {
    if (!mixDrawerOpen || !requestedLayerIsVisible) return
    currentMixPanelRef.current
      ?.querySelector<HTMLElement>("[data-active-layer='true']")
      ?.focus({ preventScroll: true })
  }, [mixDrawerOpen, requestedLayerIsVisible, layerSelectionRequest?.requestKey])

  useEffect(() => {
    if (!mixDrawerOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && currentMixPanelRef.current?.contains(target)) return
      closeDrawer(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeDrawer(true)
        return
      }
      if (event.key !== "Tab" || drawerMode !== "narrow") return
      const panel = currentMixPanelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )).filter((element) => element.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1) ?? first
      const active = document.activeElement
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeDrawer, drawerMode, mixDrawerOpen])

  return (
    <div
      ref={workspaceRef}
      className="ml-atmoshaper-workspace min-w-0"
      aria-label="AtmoShaper live mixer"
      data-current-mix-side={drawerSide}
      data-drawer-mode={drawerMode}
    >
      {music.runtimeReadiness.status !== "ready" ? (
        <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted-foreground" role="status">
          <span>
            {music.runtimeReadiness.status === "error"
              ? music.runtimeReadiness.error ?? "Audio setup failed. Try again."
              : "Preparing AtmoShaper audio…"}
          </span>
          {music.runtimeReadiness.status === "error" ? (
            <Button type="button" size="sm" variant="outline" onClick={music.retryRuntimeReadiness}>
              Retry audio setup
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="ml-atmoshaper-layout" data-current-mix-side={drawerSide}>
        <CurrentMixRail
          activeLayerId={layerSelectionRequest?.layerId ?? null}
          activeLayerRequestKey={layerSelectionRequest?.requestKey ?? 0}
          activeSoloLayerId={soloControls.activeSoloLayerId}
          actions={actions}
          drawerMode={drawerMode}
          drawerSide={drawerSide}
          expanded={mixDrawerOpen}
          onOpenLayer={openRailLayer}
          onToggleMuteLayer={soloControls.toggleMuteLayer}
          onToggleDrawer={toggleDrawer}
          onToggleSoloLayer={soloControls.toggleSoloLayer}
          panelRef={currentMixPanelRef}
          primaryToggleRef={primaryRailToggleRef}
          recipe={recipe}
        />
        <SoundLibrary actions={actions} onSelectLayer={selectLibraryLayer} recipe={recipe} />
      </div>

      {mixDrawerOpen && drawerMode === "narrow" ? (
        <div
          className="ml-atmoshaper-current-mix-overlay-narrow"
          aria-hidden="true"
          data-state="open"
        />
      ) : null}

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
