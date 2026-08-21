"use client"

import { useMemo, useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ATMOSHAPER_PRESETS, type AtmoShaperLayer, type AtmoShaperRecipe } from "@/lib/atmoshaper/recipe.js"
import { getPlayableAtmosphereStations } from "@/lib/atmosphere/stations.js"

import { BrainwaveLayerControls, type BrainwaveControlValues } from "./brainwave-layer-controls"
import type { AtmoShaperRecipeActions } from "./use-atmoshaper-recipe"

const NOISE_OPTIONS = [
  { color: "white", label: "White noise" },
  { color: "pink", label: "Pink noise" },
  { color: "brown", label: "Brown noise" },
] as const

const PRESET_ENTRIES = [
  ["delta", "Delta", ATMOSHAPER_PRESETS.delta],
  ["theta", "Theta", ATMOSHAPER_PRESETS.theta],
  ["alpha", "Alpha", ATMOSHAPER_PRESETS.alpha],
  ["beta", "Beta", ATMOSHAPER_PRESETS.beta],
  ["gamma", "Gamma", ATMOSHAPER_PRESETS.gamma],
] as const
const STATION_DEFAULT_VOLUME = 0.75

type PlayableStation = ReturnType<typeof getPlayableAtmosphereStations>[number]

function createStationLayer(station: PlayableStation): AtmoShaperLayer {
  return {
    id: `station:${crypto.randomUUID()}`,
    kind: "station",
    sourceId: station.id,
    volume: STATION_DEFAULT_VOLUME,
    muted: false,
    settings: {},
  }
}

/** A confirmation is required only when replacement would discard edits. */
function stationLayerIsCustomized(layer: AtmoShaperLayer) {
  return layer.volume !== STATION_DEFAULT_VOLUME
    || layer.muted
    || Object.keys(layer.settings).length > 0
}

function createBrainwaveLayer(
  kind: "binaural" | "isochronic",
  sourceId: string,
  values: BrainwaveControlValues,
): AtmoShaperLayer {
  return {
    id: `${kind}:${crypto.randomUUID()}`,
    kind,
    sourceId,
    volume: 0.5,
    muted: false,
    settings: kind === "binaural"
      ? { carrierHz: values.carrierHz, beatHz: values.rateHz }
      : { carrierHz: values.carrierHz, pulseHz: values.rateHz },
  }
}

export function SoundLibrary({
  actions,
  recipe,
}: {
  actions: AtmoShaperRecipeActions
  recipe: AtmoShaperRecipe
}) {
  const stations = useMemo(() => getPlayableAtmosphereStations(), [])
  const [pendingStation, setPendingStation] = useState<PlayableStation | null>(null)
  const [binauralAdvanced, setBinauralAdvanced] = useState<BrainwaveControlValues>({
    carrierHz: 220,
    rateHz: 10,
  })
  const [isochronicAdvanced, setIsochronicAdvanced] = useState<BrainwaveControlValues>({
    carrierHz: 220,
    rateHz: 10,
  })
  const currentStationLayer = recipe.layers.find((layer) => layer.kind === "station")

  function addStation(station: PlayableStation) {
    if (
      currentStationLayer
      && stationLayerIsCustomized(currentStationLayer)
    ) {
      setPendingStation(station)
      return
    }
    actions.addLayer(createStationLayer(station))
  }

  function addPreset(kind: "binaural" | "isochronic", presetId: string, values: BrainwaveControlValues) {
    actions.addLayer(createBrainwaveLayer(kind, `${kind}:${presetId}`, values))
  }

  return (
    <section className="ml-atmoshaper-library min-w-0" aria-labelledby="atmoshaper-library-title">
      <div className="space-y-1">
        <h2 id="atmoshaper-library-title" className="text-xl font-semibold">Sound Library</h2>
        <p className="text-sm text-muted-foreground">Build a live mix from generated sounds and an optional station foundation.</p>
      </div>

      <Tabs defaultValue="noise" className="mt-4 min-w-0">
        <TabsList className="h-auto w-full flex-wrap justify-start" aria-label="AtmoShaper sound groups">
          <TabsTrigger value="noise">Noise</TabsTrigger>
          <TabsTrigger value="stations">Atmosphere stations</TabsTrigger>
          <TabsTrigger value="binaural">Binaural beats</TabsTrigger>
          <TabsTrigger value="isochronic">Isochronic tones</TabsTrigger>
          <TabsTrigger value="ambient">Ambient sounds</TabsTrigger>
        </TabsList>

        <TabsContent value="noise" className="grid gap-3 sm:grid-cols-3">
          {NOISE_OPTIONS.map(({ color, label }) => (
            <article key={color} className="rounded-lg border bg-card p-3 text-card-foreground">
              <h3 className="font-medium">{label}</h3>
              <Button
                type="button"
                className="mt-3 w-full"
                aria-label={`Add ${label}`}
                onClick={() => actions.addLayer({
                  id: `noise:${crypto.randomUUID()}`,
                  kind: "noise",
                  sourceId: `noise:${color}`,
                  volume: 0.55,
                  muted: false,
                  settings: { color },
                })}
              >
                Add
              </Button>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="stations" className="grid gap-3 sm:grid-cols-2">
          {stations.map((station) => (
            <article key={station.id} className="rounded-lg border bg-card p-3 text-card-foreground">
              <h3 className="font-medium">{station.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{station.description}</p>
              <Button
                type="button"
                className="mt-3"
                aria-label={`Add ${station.title} station`}
                onClick={() => addStation(station)}
              >
                Add station
              </Button>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="binaural" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use headphones so the separate left and right tones can be heard as intended.
          </p>
          <PresetGrid kind="binaural" onAdd={addPreset} />
          <AdvancedCard
            kind="binaural"
            values={binauralAdvanced}
            onChange={setBinauralAdvanced}
            onAdd={() => addPreset("binaural", "advanced", binauralAdvanced)}
          />
        </TabsContent>

        <TabsContent value="isochronic" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Isochronic tones have an intentionally pulsing character and do not require headphones.
          </p>
          <PresetGrid kind="isochronic" onAdd={addPreset} />
          <AdvancedCard
            kind="isochronic"
            values={isochronicAdvanced}
            onChange={setIsochronicAdvanced}
            onAdd={() => addPreset("isochronic", "advanced", isochronicAdvanced)}
          />
        </TabsContent>

        <TabsContent value="ambient">
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Ambient sound library is being prepared. Verified loops and source details will arrive in a follow-up.
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={pendingStation !== null} onOpenChange={(open) => {
        if (!open) setPendingStation(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace station foundation?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the current station and discards its customized volume, mute, or settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current station</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingStation) actions.addLayer(createStationLayer(pendingStation))
              setPendingStation(null)
            }}>
              Replace station
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function PresetGrid({
  kind,
  onAdd,
}: {
  kind: "binaural" | "isochronic"
  onAdd(kind: "binaural" | "isochronic", presetId: string, values: BrainwaveControlValues): void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {PRESET_ENTRIES.map(([presetId, label, preset]) => (
        <Button
          key={presetId}
          type="button"
          variant="outline"
          aria-label={`Add ${label} ${kind} preset`}
          onClick={() => onAdd(kind, presetId, preset)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

function AdvancedCard({
  kind,
  onAdd,
  onChange,
  values,
}: {
  kind: "binaural" | "isochronic"
  onAdd(): void
  onChange(values: BrainwaveControlValues): void
  values: BrainwaveControlValues
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="font-medium">Advanced</h3>
      <div className="mt-3">
        <BrainwaveLayerControls kind={kind} values={values} onChange={onChange} />
      </div>
      <Button type="button" className="mt-4" onClick={onAdd}>
        Add Advanced {kind === "binaural" ? "binaural beat" : "isochronic tone"}
      </Button>
    </section>
  )
}
