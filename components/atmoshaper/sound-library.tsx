"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { AtmosphereStationArtwork } from "@/components/atmosphere/station-artwork"
import { useMusic } from "@/components/providers/music-provider"
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
import { purpleGlowClassName } from "@/components/ui/carousel-button-classes"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ATMOSHAPER_PRESETS, type AtmoShaperLayer, type AtmoShaperRecipe } from "@/lib/atmoshaper/recipe.js"
import { resolveAtmosphereStationArtworkInput } from "@/lib/atmosphere/station-artwork"
import { getPlayableAtmosphereStations } from "@/lib/atmosphere/stations.js"
import { cn } from "@/lib/utils"

import { BrainwaveArtwork } from "./brainwave-artwork"
import { BrainwaveLayerControls, type BrainwaveControlValues } from "./brainwave-layer-controls"
import { atmoShaperLayerSourceName } from "./current-mix"
import { NoiseArtwork } from "./noise-artwork"
import {
  atmoShaperPreviewMatchesCandidate,
  beginSoundLibraryPendingCommit,
  createSoundLibraryCandidateLayer,
  getAtmoShaperSourceConfigurationKey,
  resolveSoundLibraryCommit,
  settleSoundLibraryPendingCommit,
  soundLibraryCommitIsPending,
} from "./sound-library-model.js"
import type {
  AtmoShaperPromotionTransaction,
  AtmoShaperRecipeActions,
} from "./use-atmoshaper-recipe"

const NOISE_OPTIONS = [
  { color: "white", label: "White noise", detail: "Bright, even generated noise." },
  { color: "pink", label: "Pink noise", detail: "Generated noise with a warmer balance." },
  { color: "brown", label: "Brown noise", detail: "Deep, low-weighted generated noise." },
] as const

const PRESET_ENTRIES = [
  ["delta", "Delta", ATMOSHAPER_PRESETS.delta],
  ["theta", "Theta", ATMOSHAPER_PRESETS.theta],
  ["alpha", "Alpha", ATMOSHAPER_PRESETS.alpha],
  ["beta", "Beta", ATMOSHAPER_PRESETS.beta],
  ["gamma", "Gamma", ATMOSHAPER_PRESETS.gamma],
] as const
const STATION_DEFAULT_VOLUME = 0.75

type BrainwaveKind = "binaural" | "isochronic"
type BrainwavePresetId = (typeof PRESET_ENTRIES)[number][0]
type BrainwaveSelection = {
  presetId: BrainwavePresetId | null
  values: BrainwaveControlValues
}
type PlayableStation = ReturnType<typeof getPlayableAtmosphereStations>[number]

const noiseCandidates = new Map(NOISE_OPTIONS.map(({ color }) => [
  color,
  createSoundLibraryCandidateLayer({
    kind: "noise",
    sourceId: `noise:${color}`,
    volume: 0.55,
    muted: false,
    settings: { color },
  }),
]))

function createStationCandidate(station: PlayableStation): AtmoShaperLayer {
  return createSoundLibraryCandidateLayer({
    kind: "station",
    sourceId: station.id,
    volume: STATION_DEFAULT_VOLUME,
    muted: false,
    settings: {},
  })
}

/** A confirmation is required only when replacement would discard edits. */
function stationLayerIsCustomized(layer: AtmoShaperLayer) {
  return layer.volume !== STATION_DEFAULT_VOLUME
    || layer.muted
    || Object.keys(layer.settings).length > 0
}

function createBrainwaveCandidate(
  kind: BrainwaveKind,
  selection: BrainwaveSelection,
): AtmoShaperLayer {
  const presetId = selection.presetId ?? "advanced"
  return createSoundLibraryCandidateLayer({
    kind,
    sourceId: `${kind}:${presetId}`,
    volume: 0.5,
    muted: false,
    settings: kind === "binaural"
      ? { carrierHz: selection.values.carrierHz, beatHz: selection.values.rateHz }
      : { carrierHz: selection.values.carrierHz, pulseHz: selection.values.rateHz },
  })
}

export function SoundLibrary({
  actions,
  onSelectLayer,
  recipe,
}: {
  actions: AtmoShaperRecipeActions
  onSelectLayer(
    layerId: string,
    opener: HTMLElement,
    reason: "commit" | "select-existing",
  ): void
  recipe: AtmoShaperRecipe
}) {
  const music = useMusic()
  const stations = useMemo(() => getPlayableAtmosphereStations(), [])
  const stationCandidates = useMemo(() => new Map(stations.map((station) => (
    [station.id, createStationCandidate(station)]
  ))), [stations])
  const [pendingStationCommit, setPendingStationCommit] = useState<{
    candidate: AtmoShaperLayer
    opener: HTMLElement
  } | null>(null)
  const pendingCommitGenerationRef = useRef(0)
  const pendingCommitsRef = useRef<AtmoShaperPromotionTransaction[]>([])
  const mountedRef = useRef(true)
  const [pendingSourceKeys, setPendingSourceKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [activeTab, setActiveTab] = useState("noise")
  const [binauralSelection, setBinauralSelection] = useState<BrainwaveSelection>(() => ({
    presetId: "alpha",
    values: { ...ATMOSHAPER_PRESETS.alpha },
  }))
  const [isochronicSelection, setIsochronicSelection] = useState<BrainwaveSelection>(() => ({
    presetId: "alpha",
    values: { ...ATMOSHAPER_PRESETS.alpha },
  }))
  const tabListRef = useRef<HTMLDivElement | null>(null)
  const binauralCandidate = useMemo(
    () => createBrainwaveCandidate("binaural", binauralSelection),
    [binauralSelection],
  )
  const isochronicCandidate = useMemo(
    () => createBrainwaveCandidate("isochronic", isochronicSelection),
    [isochronicSelection],
  )
  const currentStationLayer = recipe.layers.find((layer) => layer.kind === "station")

  useEffect(() => {
    const activeTrigger = tabListRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
    activeTrigger?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    })
  }, [activeTab])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  function replacePendingCommits(pendingTransactions: AtmoShaperPromotionTransaction[]) {
    pendingCommitsRef.current = pendingTransactions
    if (mountedRef.current) {
      setPendingSourceKeys(new Set(pendingTransactions.map(({ sourceKey }) => sourceKey)))
    }
  }

  /**
   * Resolves duplicate selection before station replacement, then adopts a
   * matching live preview or performs a silent immutable recipe edit.
   */
  async function commitCandidate(
    candidate: AtmoShaperLayer,
    opener: HTMLElement,
    stationReplacementConfirmed = false,
  ) {
    const sourceKey = getAtmoShaperSourceConfigurationKey(candidate)
    // This guard intentionally precedes duplicate selection. The optimistic
    // row may already be rendered while its provider transfer is still live.
    if (soundLibraryCommitIsPending(pendingCommitsRef.current, sourceKey)) return

    const preview = music.atmoShaperPreview
    const previewMatches = atmoShaperPreviewMatchesCandidate(preview, candidate)
    const previewCanPromote = previewMatches
      && (preview?.status === "playing" || preview?.status === "paused")
    const layer = previewCanPromote && preview ? preview.layer : candidate
    const resolution = resolveSoundLibraryCommit(recipe, layer)

    if (resolution.type === "select-existing") {
      if (previewMatches) await music.stopAtmoShaperPreview()
      onSelectLayer(resolution.layerId, opener, "select-existing")
      return
    }

    if (
      candidate.kind === "station"
      && currentStationLayer
      && stationLayerIsCustomized(currentStationLayer)
      && !stationReplacementConfirmed
    ) {
      setPendingStationCommit({ candidate, opener })
      return
    }

    // A failed/loading preview cannot be adopted. Retire it first so provider
    // reconciliation does not classify the same id as a pending promotion.
    if (previewMatches && !previewCanPromote) {
      await music.stopAtmoShaperPreview()
    }
    if (!previewCanPromote || !preview) {
      actions.addLayer(resolution.layer)
      onSelectLayer(resolution.layer.id, opener, "commit")
      return
    }

    const priorRecipe = recipe
    const optimisticRecipe = actions.addLayer(preview.layer, { announce: false })
    const transaction: AtmoShaperPromotionTransaction = {
      generation: ++pendingCommitGenerationRef.current,
      sourceKey,
      sourceName: atmoShaperLayerSourceName(preview.layer),
      priorRecipe,
      optimisticRecipe,
    }
    const started = beginSoundLibraryPendingCommit(pendingCommitsRef.current, transaction)
    if (started.status !== "started") return
    replacePendingCommits(started.pendingTransactions)
    onSelectLayer(preview.layer.id, opener, "commit")

    let settlement
    try {
      settlement = await music.promoteAtmoShaperPreview(optimisticRecipe)
    } catch (caughtError) {
      settlement = {
        status: "failed" as const,
        error: caughtError instanceof Error
          ? caughtError.message
          : "This sound could not be added.",
      }
    }

    const settled = settleSoundLibraryPendingCommit(
      pendingCommitsRef.current,
      transaction.generation,
    )
    if (!settled.owned) return
    replacePendingCommits(settled.pendingTransactions)
    if (mountedRef.current) actions.settleLayerPromotion(transaction, settlement)
  }

  return (
    <section className="ml-atmoshaper-library min-w-0" aria-labelledby="atmoshaper-library-title">
      <div className="space-y-1">
        <h2 id="atmoshaper-library-title" className="text-xl font-semibold">Sound Library</h2>
        <p className="text-sm text-muted-foreground">Preview generated sounds or an optional station foundation, then add what fits.</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="ml-atmoshaper-library-tabs-root mt-4 min-w-0"
        data-active-library-tab={activeTab}
      >
        {activeTab === "isochronic" || activeTab === "binaural" ? (
          <div className="ml-atmoshaper-library-brainwave-canvas" aria-hidden="true">
            <BrainwaveArtwork kind={activeTab} />
          </div>
        ) : null}
        <TabsList
          ref={tabListRef}
          className="ml-atmoshaper-library-tabs-list"
          aria-label="AtmoShaper sound groups"
        >
          {[
            ["noise", "Noise"],
            ["stations", "Atmosphere stations"],
            ["binaural", "Binaural beats"],
            ["isochronic", "Isochronic tones"],
            ["ambient", "Ambient sounds"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} asChild>
              <Button
                type="button"
                className="ml-atmoshaper-library-tab shrink-0"
                size="compact"
                variant="glow"
              >
                {label}
              </Button>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="noise" className="ml-atmoshaper-card-grid">
          {NOISE_OPTIONS.map(({ color, detail, label }) => {
            const candidate = noiseCandidates.get(color)
            if (!candidate) return null
            return (
              <article key={color} className="ml-atmoshaper-library-card" data-library-source={candidate.sourceId}>
                <div className="ml-atmoshaper-library-art" data-art-kind="noise">
                  <NoiseArtwork color={color} />
                </div>
                <div className="ml-atmoshaper-library-card-copy">
                  <h3 className="font-semibold">{label}</h3>
                  <p>{detail}</p>
                </div>
                <LibraryCardActions
                  candidate={candidate}
                  commitPending={pendingSourceKeys.has(getAtmoShaperSourceConfigurationKey(candidate))}
                  sourceName={label}
                  onAdd={(opener) => void commitCandidate(candidate, opener)}
                />
              </article>
            )
          })}
        </TabsContent>

        <TabsContent value="stations" className="ml-atmoshaper-card-grid ml-atmoshaper-station-grid">
          {stations.map((station) => {
            const candidate = stationCandidates.get(station.id)
            if (!candidate) return null
            return (
              <article key={station.id} className="ml-atmoshaper-library-card" data-library-source={station.id}>
                <div className="ml-atmoshaper-library-art" data-art-kind="station">
                  <AtmosphereStationArtwork
                    artworkInput={resolveAtmosphereStationArtworkInput(station)}
                    decorative
                  />
                </div>
                <div className="ml-atmoshaper-library-card-copy">
                  <h3 className="font-semibold">{station.title}</h3>
                  <p>{station.description}</p>
                </div>
                <LibraryCardActions
                  candidate={candidate}
                  commitPending={pendingSourceKeys.has(getAtmoShaperSourceConfigurationKey(candidate))}
                  sourceName={`${station.title} station`}
                  onAdd={(opener) => void commitCandidate(candidate, opener)}
                />
              </article>
            )
          })}
        </TabsContent>

        <TabsContent value="binaural" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use headphones so the separate left and right tones can be heard as intended.
          </p>
          <BrainwaveLibraryCard
            candidate={binauralCandidate}
            commitPending={pendingSourceKeys.has(getAtmoShaperSourceConfigurationKey(binauralCandidate))}
            kind="binaural"
            selection={binauralSelection}
            onAdd={(opener) => void commitCandidate(binauralCandidate, opener)}
            onSelectionChange={setBinauralSelection}
          />
        </TabsContent>

        <TabsContent value="isochronic" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Isochronic tones have an intentionally pulsing character and do not require headphones.
          </p>
          <BrainwaveLibraryCard
            candidate={isochronicCandidate}
            commitPending={pendingSourceKeys.has(getAtmoShaperSourceConfigurationKey(isochronicCandidate))}
            kind="isochronic"
            selection={isochronicSelection}
            onAdd={(opener) => void commitCandidate(isochronicCandidate, opener)}
            onSelectionChange={setIsochronicSelection}
          />
        </TabsContent>

        <TabsContent value="ambient">
          <div className="ml-atmoshaper-library-placeholder">
            Ambient sound library is being prepared. Verified loops and source details will arrive in a follow-up.
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={pendingStationCommit !== null} onOpenChange={(open) => {
        if (!open) setPendingStationCommit(null)
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
              const pending = pendingStationCommit
              setPendingStationCommit(null)
              if (pending) void commitCandidate(pending.candidate, pending.opener, true)
            }}>
              Replace station
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function LibraryCardActions({
  candidate,
  commitPending,
  onAdd,
  sourceName,
}: {
  candidate: AtmoShaperLayer
  commitPending: boolean
  onAdd(opener: HTMLButtonElement): void
  sourceName: string
}) {
  const music = useMusic()
  const previewMatches = atmoShaperPreviewMatchesCandidate(music.atmoShaperPreview, candidate)
  const previewStatus = previewMatches ? music.atmoShaperPreview?.status : null
  const previewLabel = previewMatches
    ? previewStatus === "failed" ? "Retry Preview" : "Stop Preview"
    : "Preview"
  const previewAriaLabel = previewMatches
    ? previewStatus === "failed"
      ? `Retry preview for ${sourceName}`
      : `Stop preview for ${sourceName}`
    : `Preview ${sourceName}`

  function handlePreview() {
    if (!previewMatches || previewStatus === "failed") {
      void music.previewAtmoShaperLayer(candidate)
      return
    }
    void music.stopAtmoShaperPreview()
  }

  return (
    <div className="ml-atmoshaper-library-card-actions" data-preview-active={previewMatches ? "true" : "false"}>
      <div className="ml-atmoshaper-card-primary-actions">
        <Button
          type="button"
          variant="outline"
          aria-label={previewAriaLabel}
          aria-pressed={previewMatches && previewStatus !== "failed"}
          onClick={handlePreview}
        >
          {previewLabel}
        </Button>
        <Button
          type="button"
          variant="success"
          aria-label={`Add ${sourceName}`}
          aria-busy={commitPending || undefined}
          disabled={commitPending || (previewMatches && previewStatus === "loading")}
          onClick={(event) => onAdd(event.currentTarget)}
        >
          {commitPending ? "Adding…" : "Add"}
        </Button>
      </div>
      <div
        className="ml-atmoshaper-card-preview-controls"
        aria-hidden={!previewMatches}
      >
        <span
          className={cn(
            "ml-atmoshaper-card-preview-status text-xs text-muted-foreground",
            previewMatches && previewStatus === "failed" && "text-destructive",
          )}
          title={previewMatches && previewStatus === "failed"
            ? music.atmoShaperPreview?.error ?? "This preview could not start."
            : undefined}
        >
          {previewMatches && previewStatus === "failed"
            ? music.atmoShaperPreview?.error ?? "This preview could not start."
            : previewMatches
              ? previewStatus
              : "ready to preview"}
        </span>
        <Slider
          aria-label={`Preview volume for ${sourceName}`}
          disabled={!previewMatches}
          min={0}
          max={1}
          step={0.05}
          value={[previewMatches ? (music.atmoShaperPreview?.layer.volume ?? candidate.volume) : candidate.volume]}
          onValueChange={([volume]) => void music.setAtmoShaperPreviewVolume(volume)}
        />
      </div>
    </div>
  )
}

function BrainwaveLibraryCard({
  candidate,
  commitPending,
  kind,
  onAdd,
  onSelectionChange,
  selection,
}: {
  candidate: AtmoShaperLayer
  commitPending: boolean
  kind: BrainwaveKind
  onAdd(opener: HTMLButtonElement): void
  onSelectionChange(selection: BrainwaveSelection): void
  selection: BrainwaveSelection
}) {
  const title = kind === "binaural" ? "Binaural beats" : "Isochronic tones"
  const selectedLabel = PRESET_ENTRIES.find(([presetId]) => presetId === selection.presetId)?.[1]
    ?? "Advanced"

  return (
    <article
      className="ml-atmoshaper-brainwave-panel"
      data-brainwave-kind={kind}
      data-library-source={candidate.sourceId}
    >
      <div className="ml-atmoshaper-brainwave-backdrop" data-art-kind={kind} aria-hidden="true">
        <BrainwaveArtwork kind={kind} />
      </div>
      <div className="ml-atmoshaper-brainwave-content">
        <div className="ml-atmoshaper-library-card-copy">
          <h3 className="font-semibold">{title}</h3>
          <p>{selectedLabel} configuration · {selection.values.carrierHz} Hz carrier · {selection.values.rateHz} Hz {kind === "binaural" ? "difference" : "pulse"}</p>
        </div>

        <div className="ml-atmoshaper-preset-buttons" role="group" aria-label={`${title} presets`}>
          {PRESET_ENTRIES.map(([presetId, label, values]) => {
            const selected = presetId === selection.presetId
            return (
              <Button
                key={presetId}
                type="button"
                aria-pressed={selected}
                className={cn("shrink-0", selected && purpleGlowClassName)}
                onClick={() => onSelectionChange({ presetId, values: { ...values } })}
                size="compact"
                variant="glow"
              >
                {label}
              </Button>
            )
          })}
        </div>

        <section className="ml-atmoshaper-advanced-controls" aria-label={`Advanced ${title} configuration`}>
          <h4 className="font-medium">Advanced</h4>
          <BrainwaveLayerControls
            kind={kind}
            values={selection.values}
            onChange={(values) => onSelectionChange({ presetId: null, values })}
          />
        </section>

        <LibraryCardActions
          candidate={candidate}
          commitPending={commitPending}
          sourceName={atmoShaperLayerSourceName(candidate)}
          onAdd={onAdd}
        />
      </div>
    </article>
  )
}
