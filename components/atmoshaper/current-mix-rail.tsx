"use client"

import type { RefObject } from "react"
import {
  CircleAlert,
  LoaderCircle,
  PanelLeftOpen,
  PanelRightOpen,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react"

import { useMusic } from "@/components/providers/music-provider"
import { Button } from "@/components/ui/button"
import type { AtmoShaperRecipe } from "@/lib/atmoshaper/recipe.js"

import {
  atmoShaperLayerSourceName,
  useAtmoShaperTransportControls,
} from "./current-mix"
import type { AtmoShaperRecipeActions } from "./use-atmoshaper-recipe"
import { resolveAtmoShaperVisibleLayerState } from "./workspace-model.js"

/** Persistent committed-layer navigation; temporary previews never enter it. */
export function CurrentMixRail({
  actions,
  drawerOpen,
  drawerSide,
  onOpenLayer,
  onToggleDrawer,
  primaryToggleRef,
  recipe,
}: {
  actions: AtmoShaperRecipeActions
  drawerOpen: boolean
  drawerSide: "left" | "right"
  onOpenLayer(layerId: string, opener: HTMLElement): void
  onToggleDrawer(opener: HTMLElement): void
  primaryToggleRef: RefObject<HTMLButtonElement | null>
  recipe: AtmoShaperRecipe
}) {
  const music = useMusic()
  const transport = useAtmoShaperTransportControls(recipe)
  const DrawerIcon = drawerSide === "left" ? PanelLeftOpen : PanelRightOpen

  return (
    <aside className="ml-atmoshaper-current-mix-rail" aria-label="Current Mix rail">
      <Button
        ref={primaryToggleRef}
        type="button"
        size="sm"
        variant="outline"
        className="ml-atmoshaper-rail-button"
        aria-controls="atmoshaper-current-mix-drawer"
        aria-expanded={drawerOpen}
        aria-label={`${drawerOpen ? "Close" : "Open"} Current Mix`}
        onClick={(event) => onToggleDrawer(event.currentTarget)}
      >
        <DrawerIcon aria-hidden="true" className="h-4 w-4" />
        <span>Mix</span>
      </Button>

      <div className="ml-atmoshaper-rail-transport" aria-label="Current Mix playback">
        <Button
          type="button"
          size="sm"
          variant="success"
          className="ml-atmoshaper-rail-button"
          aria-label={transport.isPlaying ? "Pause AtmoShaper" : "Play AtmoShaper"}
          disabled={recipe.layers.length === 0}
          onClick={transport.handlePlayPause}
        >
          {transport.isPlaying
            ? <Pause aria-hidden="true" className="h-4 w-4" />
            : <Play aria-hidden="true" className="h-4 w-4" />}
          <span>{transport.isPlaying ? "Pause" : "Play"}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-atmoshaper-rail-button"
          aria-label="Stop AtmoShaper"
          disabled={!transport.canStop}
          onClick={transport.handleStop}
        >
          <Square aria-hidden="true" className="h-4 w-4" />
          <span>Stop</span>
        </Button>
      </div>

      <ol className="ml-atmoshaper-rail-layers" aria-label="Committed layers in mix order">
        {recipe.layers.map((layer) => {
          const sourceName = atmoShaperLayerSourceName(layer)
          const runtimeState = resolveAtmoShaperVisibleLayerState({
            activePlaybackKind: music.activePlaybackKind,
            layerState: music.atmoShaperSnapshot?.layers[layer.id],
            localRecipeId: recipe.id,
            providerError: music.error,
            providerRecipeId: music.atmoShaperSnapshot?.recipe?.id ?? null,
            snapshotStatus: music.atmoShaperSnapshot?.status,
          })
          const state = runtimeState.status === "failed"
            ? "failed"
            : runtimeState.status === "loading"
              ? "loading"
              : layer.muted
                ? "muted"
                : runtimeState.status
          const StateIcon = state === "failed"
            ? CircleAlert
            : state === "loading"
              ? LoaderCircle
              : state === "muted"
                ? VolumeX
                : Volume2

          return (
            <li key={layer.id} className="ml-atmoshaper-rail-layer" data-layer-id={layer.id} data-layer-state={state}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-atmoshaper-rail-layer-open"
                aria-label={`Open ${sourceName} controls, ${state}`}
                onClick={(event) => onOpenLayer(layer.id, event.currentTarget)}
              >
                <StateIcon aria-hidden="true" className="ml-atmoshaper-rail-status-icon h-4 w-4" />
                <span className="ml-atmoshaper-rail-layer-name">{sourceName}</span>
                <span className="ml-atmoshaper-rail-layer-state">{state}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-atmoshaper-rail-layer-mute"
                aria-label={`${layer.muted ? "Unmute" : "Mute"} ${sourceName}`}
                aria-pressed={layer.muted}
                onClick={() => actions.updateLayer(layer.id, { muted: !layer.muted })}
              >
                {layer.muted
                  ? <Volume2 aria-hidden="true" className="h-4 w-4" />
                  : <VolumeX aria-hidden="true" className="h-4 w-4" />}
                <span>{layer.muted ? "Unmute" : "Mute"}</span>
              </Button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
