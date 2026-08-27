"use client"

import { useRef, useState, type RefObject } from "react"
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AtmoShaperRecipe } from "@/lib/atmoshaper/recipe.js"

import { CurrentMix } from "./current-mix"
import { resolveAtmoShaperSoloToggle } from "./current-mix-rail-model.js"
import type { AtmoShaperRecipeActions } from "./use-atmoshaper-recipe"

/**
 * Keeps Solo reversible across the collapsed rail and expanded drawer.
 * The workspace owns this state so widening the control stack does not reset it.
 */
export function useAtmoShaperSoloControls(
  actions: AtmoShaperRecipeActions,
  recipe: AtmoShaperRecipe,
) {
  const [activeSoloLayerId, setActiveSoloLayerId] = useState<string | null>(null)
  const soloMuteSnapshotRef = useRef<Record<string, boolean> | null>(null)

  function applyMutePattern(mutedByLayerId: Record<string, boolean>) {
    Object.entries(mutedByLayerId).forEach(([layerId, muted]) => {
      actions.updateLayer(layerId, { muted })
    })
  }

  function toggleSoloLayer(layerId: string) {
    const result = resolveAtmoShaperSoloToggle({
      activeSoloLayerId,
      layers: recipe.layers,
      layerId,
      muteSnapshot: soloMuteSnapshotRef.current,
    })

    applyMutePattern(result.mutedByLayerId)
    soloMuteSnapshotRef.current = result.muteSnapshot
    setActiveSoloLayerId(result.activeSoloLayerId)
  }

  function toggleMuteLayer(layerId: string, muted: boolean) {
    if (activeSoloLayerId) {
      const result = resolveAtmoShaperSoloToggle({
        activeSoloLayerId,
        layers: recipe.layers,
        layerId: activeSoloLayerId,
        muteSnapshot: soloMuteSnapshotRef.current,
      })
      applyMutePattern(result.mutedByLayerId)
      soloMuteSnapshotRef.current = null
      setActiveSoloLayerId(null)
    }

    actions.updateLayer(layerId, { muted: !muted })
  }

  return { activeSoloLayerId, toggleMuteLayer, toggleSoloLayer }
}

/**
 * One edge-owned control tree that widens in place. Keeping this element and
 * its controls mounted lets the rail read as one panel instead of a rail being
 * replaced by an unrelated drawer.
 */
export function CurrentMixRail({
  activeLayerId,
  activeLayerRequestKey,
  activeSoloLayerId,
  actions,
  drawerMode,
  drawerSide,
  expanded,
  onOpenLayer,
  onToggleMuteLayer,
  onToggleDrawer,
  onToggleSoloLayer,
  panelRef,
  primaryToggleRef,
  recipe,
}: {
  activeLayerId: string | null
  activeLayerRequestKey: number
  activeSoloLayerId: string | null
  actions: AtmoShaperRecipeActions
  drawerMode: "roomy" | "narrow"
  drawerSide: "left" | "right"
  expanded: boolean
  onOpenLayer(layerId: string, opener: HTMLElement): void
  onToggleMuteLayer(layerId: string, muted: boolean): void
  onToggleDrawer(opener: HTMLElement): void
  onToggleSoloLayer(layerId: string): void
  panelRef: RefObject<HTMLElement | null>
  primaryToggleRef: RefObject<HTMLButtonElement | null>
  recipe: AtmoShaperRecipe
}) {
  const DrawerIcon = expanded
    ? drawerSide === "left" ? PanelLeftClose : PanelRightClose
    : drawerSide === "left" ? PanelLeftOpen : PanelRightOpen

  return (
    <aside
      ref={panelRef}
      className="ml-atmoshaper-current-mix-rail"
      aria-label="Current Mix rail"
      data-drawer-mode={drawerMode}
      data-expanded={expanded}
    >
      <div
        id="atmoshaper-current-mix-drawer"
        className="ml-atmoshaper-current-mix-drawer"
        role={expanded ? "dialog" : undefined}
        aria-label={expanded ? "Current Mix controls" : undefined}
        aria-modal={expanded && drawerMode === "narrow" ? "true" : undefined}
      >
        <Button
          ref={primaryToggleRef}
          type="button"
          size="sm"
          variant="outline"
          className="ml-atmoshaper-rail-button ml-atmoshaper-mix-toggle"
          aria-controls="atmoshaper-current-mix-drawer"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Close" : "Open"} Current Mix`}
          data-atmoshaper-focus-key="mix"
          onClick={(event) => {
            event.stopPropagation()
            onToggleDrawer(event.currentTarget)
          }}
        >
          <DrawerIcon aria-hidden="true" className="h-4 w-4" />
          <span>Mix</span>
        </Button>
        <CurrentMix
          activeLayerId={activeLayerId}
          activeLayerRequestKey={activeLayerRequestKey}
          activeSoloLayerId={activeSoloLayerId}
          actions={actions}
          expanded={expanded}
          headingId="atmoshaper-current-mix-title"
          onOpenLayer={onOpenLayer}
          onRequestExpand={onToggleDrawer}
          onToggleMuteLayer={onToggleMuteLayer}
          onToggleSoloLayer={onToggleSoloLayer}
          recipe={recipe}
        />
      </div>
    </aside>
  )
}
