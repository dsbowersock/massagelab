"use client"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useMusic } from "@/components/providers/music-provider"
import type { AtmoShaperLayer, AtmoShaperRecipe } from "@/lib/atmoshaper/recipe.js"
import { getAtmosphereStationById } from "@/lib/atmosphere/stations.js"

import type { AtmoShaperRecipeActions } from "./use-atmoshaper-recipe"

export function CurrentMix({
  actions,
  recipe,
}: {
  actions: AtmoShaperRecipeActions
  recipe: AtmoShaperRecipe
}) {
  const music = useMusic()
  const isPlaying = music.activePlaybackKind === "atmoshaper" && music.playbackState === "playing"
  const providerOwnsRecipe = music.activePlaybackKind === "atmoshaper"
    && music.atmoShaperSnapshot?.recipe?.id === recipe.id

  function handlePlayPause() {
    if (isPlaying) {
      void music.pauseCurrent()
    } else if (providerOwnsRecipe) {
      void music.restartCurrent()
    } else {
      void music.playAtmoShaper(recipe)
    }
  }

  return (
    <section className="ml-atmoshaper-current-mix min-w-0" aria-labelledby="atmoshaper-current-mix-title">
      <div className="space-y-1">
        <h2 id="atmoshaper-current-mix-title" className="text-xl font-semibold">Current Mix</h2>
        <p className="text-sm text-muted-foreground">
          {recipe.layers.length === 0 ? "Add a sound to begin." : `${recipe.layers.length} layer${recipe.layers.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <ol className="mt-4 space-y-3">
        {recipe.layers.map((layer, index) => {
          const sourceName = layerSourceName(layer)
          const runtimeState = music.atmoShaperSnapshot?.layers[layer.id]
          const status = runtimeState?.status ?? "ready"

          return (
            <li key={layer.id} className="rounded-lg border bg-card p-3 text-card-foreground">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{sourceName}</h3>
                  <p className="text-sm capitalize text-muted-foreground">{status}</p>
                  {runtimeState?.error ? <p className="mt-1 text-sm text-destructive">{runtimeState.error}</p> : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={layer.muted}
                  onClick={() => actions.updateLayer(layer.id, { muted: !layer.muted })}
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
                  onValueChange={([volume]) => actions.updateLayer(layer.id, { volume })}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Move earlier: ${sourceName}`}
                  disabled={index === 0}
                  onClick={() => actions.moveLayer(layer.id, index - 1)}
                >
                  Move earlier
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Move later: ${sourceName}`}
                  disabled={index === recipe.layers.length - 1}
                  onClick={() => actions.moveLayer(layer.id, index + 1)}
                >
                  Move later
                </Button>
                {status === "failed" ? (
                  <Button type="button" size="sm" onClick={() => void music.retryAtmoShaperLayer(layer.id)}>
                    Retry
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  aria-label={`Remove ${sourceName}`}
                  onClick={() => actions.removeLayer(layer.id)}
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
            {isPlaying ? "Pause AtmoShaper" : "Play AtmoShaper"}
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
