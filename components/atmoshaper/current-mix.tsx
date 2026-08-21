"use client"

import { useLayoutEffect, useMemo, useRef } from "react"

import { useMusic } from "@/components/providers/music-provider"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { AtmoShaperLayer, AtmoShaperRecipe } from "@/lib/atmoshaper/recipe.js"
import { getAtmosphereStationById } from "@/lib/atmosphere/stations.js"

import type { AtmoShaperRecipeActions } from "./use-atmoshaper-recipe"
import {
  atmoShaperWorkspaceTransportAction,
  focusTargetAfterAtmoShaperLayerRemoval,
  projectRetainedAtmoShaperLayers,
} from "./workspace-model.js"

type VisibleMixRow = {
  key: string
  layer: AtmoShaperLayer
  recipeIndex: number | null
  retained: boolean
}

export function CurrentMix({
  actions,
  recipe,
}: {
  actions: AtmoShaperRecipeActions
  recipe: AtmoShaperRecipe
}) {
  const music = useMusic()
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const pendingFocusTargetRef = useRef<string | null | undefined>(undefined)
  const retainedLayers = projectRetainedAtmoShaperLayers(
    music.atmoShaperSnapshot?.recipe ?? null,
    music.atmoShaperSnapshot?.activeLayers ?? {},
  )
  const recipeLayerIds = useMemo(() => new Set(recipe.layers.map(({ id }) => id)), [recipe.layers])
  const visibleRows: VisibleMixRow[] = [
    ...recipe.layers.map((layer, recipeIndex) => ({
      key: layer.id,
      layer,
      recipeIndex,
      retained: false,
    })),
    ...retainedLayers.map((layer) => ({
      key: recipeLayerIds.has(layer.id) ? `retained:${layer.id}` : layer.id,
      layer,
      recipeIndex: null,
      retained: true,
    })),
  ]
  const rowKeys = visibleRows.map(({ key }) => key)
  const rowKeySignature = rowKeys.join("\u0000")
  const transportAction = atmoShaperWorkspaceTransportAction({
    activePlaybackKind: music.activePlaybackKind,
    localRecipeId: recipe.id,
    playbackState: music.playbackState,
    providerRecipeId: music.atmoShaperSnapshot?.recipe?.id ?? null,
  })
  const isPlayingThisRecipe = transportAction === "pause"

  useLayoutEffect(() => {
    const focusTarget = pendingFocusTargetRef.current
    if (focusTarget === undefined) return
    pendingFocusTargetRef.current = undefined
    if (focusTarget === null) {
      headingRef.current?.focus()
      return
    }
    const nextRow = rowRefs.current.get(focusTarget)
    if (nextRow) nextRow.focus()
    else headingRef.current?.focus()
  }, [rowKeySignature])

  function handlePlayPause() {
    if (transportAction === "pause") {
      void music.pauseCurrent()
    } else if (transportAction === "restart") {
      void music.restartCurrent()
    } else {
      void music.playAtmoShaper(recipe)
    }
  }

  /** Defers focus until React commits the recipe state without the removed row. */
  function removeRow(row: VisibleMixRow) {
    const coupledRemovalKeys = row.retained
      ? visibleRows
          .filter((candidate) => !candidate.retained && candidate.layer.kind === row.layer.kind)
          .map(({ key }) => key)
      : []
    pendingFocusTargetRef.current = focusTargetAfterAtmoShaperLayerRemoval(
      rowKeys,
      row.key,
      coupledRemovalKeys,
    )
    if (row.retained) actions.removeRetainedLayer(row.layer)
    else actions.removeLayer(row.layer.id)
  }

  return (
    <section className="ml-atmoshaper-current-mix min-w-0" aria-labelledby="atmoshaper-current-mix-title">
      <div className="space-y-1">
        <h2
          ref={headingRef}
          id="atmoshaper-current-mix-title"
          className="text-xl font-semibold"
          tabIndex={-1}
        >
          Current Mix
        </h2>
        <p className="text-sm text-muted-foreground">
          {visibleRows.length === 0 ? "Add a sound to begin." : `${visibleRows.length} visible layer${visibleRows.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <ol className="mt-4 space-y-3">
        {visibleRows.map((row) => {
          const { layer, recipeIndex, retained } = row
          const sourceName = layerSourceName(layer)
          const runtimeState = music.atmoShaperSnapshot?.layers[layer.id]
          const status = runtimeState?.status ?? (retained ? "playing" : "ready")

          return (
            <li
              key={row.key}
              ref={(node) => {
                if (node) rowRefs.current.set(row.key, node)
                else rowRefs.current.delete(row.key)
              }}
              className="rounded-lg border bg-card p-3 text-card-foreground"
              tabIndex={-1}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{sourceName}</h3>
                  <p className="text-sm capitalize text-muted-foreground">
                    {retained ? `Still playing during replacement · ${status}` : status}
                  </p>
                  {!retained && runtimeState?.error ? (
                    <p className="mt-1 text-sm text-destructive">{runtimeState.error}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={layer.muted}
                  onClick={() => {
                    if (retained) actions.restoreRetainedLayer(layer, { muted: !layer.muted })
                    else actions.updateLayer(layer.id, { muted: !layer.muted })
                  }}
                >
                  {layer.muted ? "Unmute" : "Mute"}
                </Button>
              </div>

              <div className="mt-3">
                <Slider
                  aria-label={`Volume for ${sourceName}`}
                  min={0}
                  max={1}
                  step={0.05}
                  value={[layer.volume]}
                  onValueChange={([volume]) => {
                    if (retained) actions.restoreRetainedLayer(layer, { volume })
                    else actions.updateLayer(layer.id, { volume })
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!retained && recipeIndex !== null ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Move earlier: ${sourceName}`}
                      disabled={recipeIndex === 0}
                      onClick={() => actions.moveLayer(layer.id, recipeIndex - 1)}
                    >
                      Move earlier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Move later: ${sourceName}`}
                      disabled={recipeIndex === recipe.layers.length - 1}
                      onClick={() => actions.moveLayer(layer.id, recipeIndex + 1)}
                    >
                      Move later
                    </Button>
                  </>
                ) : null}
                {!retained && status === "failed" ? (
                  <Button type="button" size="sm" onClick={() => void music.retryAtmoShaperLayer(layer.id)}>
                    Retry
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  aria-label={`Remove ${sourceName}`}
                  onClick={() => removeRow(row)}
                >
                  Remove
                </Button>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="ml-atmoshaper-master-controls mt-4 grid gap-3" aria-label="AtmoShaper playback controls">
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={recipe.layers.length === 0} onClick={handlePlayPause}>
            {isPlayingThisRecipe ? "Pause AtmoShaper" : "Play AtmoShaper"}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="Stop AtmoShaper"
            disabled={music.playbackState === "stopped"}
            onClick={() => void music.stopCurrent()}
          >
            Stop
          </Button>
        </div>
        <Slider
          aria-label="AtmoShaper master volume"
          min={0}
          max={1}
          step={0.05}
          value={[music.volume]}
          onValueChange={([value]) => music.setVolume(value)}
        />
      </div>
    </section>
  )
}

function layerSourceName(layer: AtmoShaperLayer) {
  if (layer.kind === "station") {
    try {
      return getAtmosphereStationById(layer.sourceId).title
    } catch {
      return "Unavailable Atmosphere station"
    }
  }
  if (layer.kind === "noise") {
    const color = String(layer.settings.color ?? layer.sourceId.replace("noise:", ""))
    return `${color.charAt(0).toUpperCase()}${color.slice(1)} noise`
  }
  const preset = layer.sourceId.split(":").at(-1) ?? "custom"
  const label = `${preset.charAt(0).toUpperCase()}${preset.slice(1)}`
  return `${label} ${layer.kind === "binaural" ? "binaural beat" : layer.kind === "isochronic" ? "isochronic tone" : "ambient sound"}`
}
