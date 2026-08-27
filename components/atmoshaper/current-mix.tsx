"use client"

import {
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type PointerSensorOptions,
  type ScreenReaderInstructions,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  AudioLines,
  CircleAlert,
  LoaderCircle,
  Play,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react"

import { useMusic } from "@/components/providers/music-provider"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { getAtmoShaperProductionConcept } from "@/lib/atmoshaper/production-catalog-runtime"
import {
  ATMOSHAPER_PRESETS,
  type AtmoShaperLayer,
  type AtmoShaperRecipe,
} from "@/lib/atmoshaper/recipe.js"
import { getAtmosphereStationById } from "@/lib/atmosphere/stations.js"

import { BrainwaveLayerControls } from "./brainwave-layer-controls"
import { SortableLayerRow } from "./sortable-layer-row"
import type { AtmoShaperRecipeActions } from "./use-atmoshaper-recipe"
import {
  atmoShaperWorkspaceTransportAction,
  canStopAtmoShaperWorkspaceRecipe,
  focusTargetAfterAtmoShaperRowsReconcile,
  focusTargetAfterAtmoShaperVisibleRowRemoval,
  projectRetainedAtmoShaperLayersForWorkspace,
  resolveAtmoShaperVisibleLayerState,
} from "./workspace-model.js"

type VisibleMixRow = {
  key: string
  layer: AtmoShaperLayer
  retained: boolean
}

type VisibleLayerRuntimeState = {
  status: string
  error?: string
}

const sortableScreenReaderInstructions: ScreenReaderInstructions = {
  draggable: "To grab a layer, press Space or Enter. Use the arrow keys to change its position. Press Space or Enter to drop it, or Escape to cancel.",
}

/** Lets the delayed TouchSensor own touch while PointerSensor handles mouse/pen. */
class AtmoShaperPointerSensor extends PointerSensor {
  static activators = [{
    eventName: "onPointerDown" as const,
    handler(event: ReactPointerEvent, options: PointerSensorOptions) {
      if (event.nativeEvent.pointerType === "touch") return false
      return PointerSensor.activators[0].handler(event, options)
    },
  }]
}

export function CurrentMix({
  activeLayerId = null,
  activeLayerRequestKey = 0,
  activeSoloLayerId,
  actions,
  expanded,
  headingId = "atmoshaper-current-mix-title",
  onOpenLayer,
  onRequestExpand,
  onToggleMuteLayer,
  onToggleSoloLayer,
  recipe,
}: {
  activeLayerId?: string | null
  activeLayerRequestKey?: number
  activeSoloLayerId: string | null
  actions: AtmoShaperRecipeActions
  expanded: boolean
  headingId?: string
  onOpenLayer(layerId: string, opener: HTMLElement): void
  onRequestExpand(opener: HTMLElement): void
  onToggleMuteLayer(layerId: string, muted: boolean): void
  onToggleSoloLayer(layerId: string): void
  recipe: AtmoShaperRecipe
}) {
  const music = useMusic()
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const pendingFocusTargetRef = useRef<string | null | undefined>(undefined)
  const focusedUnmountedRowKeyRef = useRef<string | null>(null)
  const lastHandledSelectionRequestKeyRef = useRef<number | null>(null)
  const sensors = useSensors(
    useSensor(AtmoShaperPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const retainedLayers = projectRetainedAtmoShaperLayersForWorkspace({
    activePlaybackKind: music.activePlaybackKind,
    activeLayers: music.atmoShaperSnapshot?.activeLayers ?? {},
    localRecipe: recipe,
    providerRecipeId: music.atmoShaperSnapshot?.recipe?.id ?? null,
  })
  const recipeLayerIds = useMemo(() => new Set(recipe.layers.map(({ id }) => id)), [recipe.layers])
  const visibleRows: VisibleMixRow[] = [
    ...recipe.layers.map((layer) => ({
      key: layer.id,
      layer,
      retained: false,
    })),
    ...retainedLayers.map((layer) => ({
      key: recipeLayerIds.has(layer.id) ? `retained:${layer.id}` : layer.id,
      layer,
      retained: true,
    })),
  ]
  const rowKeys = visibleRows.map(({ key }) => key)
  const rowKeySignature = rowKeys.join("\u0000")
  const previousRowKeysRef = useRef(rowKeys)
  const activeRowKey = activeLayerId
    ? visibleRows.find(({ layer }) => layer.id === activeLayerId)?.key ?? null
    : null
  const sourceNamesById = useMemo(() => new Map(recipe.layers.map((layer) => (
    [layer.id, atmoShaperLayerSourceName(layer)]
  ))), [recipe.layers])
  const sortableAnnouncements = useMemo<Announcements>(() => {
    const itemPosition = (id: string | number) => recipe.layers.findIndex((layer) => layer.id === String(id)) + 1
    const itemName = (id: string | number) => sourceNamesById.get(String(id)) ?? "Layer"
    const total = recipe.layers.length
    return {
      onDragStart({ active }) {
        return `Grabbed ${itemName(active.id)}. Position ${itemPosition(active.id)} of ${total}.`
      },
      onDragOver({ active, over }) {
        if (!over) return `${itemName(active.id)} is no longer over a valid position.`
        return `${itemName(active.id)} is over position ${itemPosition(over.id)} of ${total}.`
      },
      onDragEnd({ active, over }) {
        if (!over) return `${itemName(active.id)} was not moved.`
        return `Dropped ${itemName(active.id)} at position ${itemPosition(over.id)} of ${total}.`
      },
      onDragCancel({ active }) {
        return `Cancelled sorting ${itemName(active.id)}. It remains at position ${itemPosition(active.id)} of ${total}.`
      },
    }
  }, [recipe.layers, sourceNamesById])

  useLayoutEffect(() => {
    const previousRowKeys = previousRowKeysRef.current
    const nextRowKeys = rowKeySignature === "" ? [] : rowKeySignature.split("\u0000")
    previousRowKeysRef.current = nextRowKeys
    const focusedUnmountedRowKey = focusedUnmountedRowKeyRef.current
    focusedUnmountedRowKeyRef.current = null
    const requestedFocusTarget = pendingFocusTargetRef.current
    const focusTarget = requestedFocusTarget !== undefined
      ? requestedFocusTarget
      : focusTargetAfterAtmoShaperRowsReconcile(
          previousRowKeys,
          nextRowKeys,
          focusedUnmountedRowKey,
        )
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

  useLayoutEffect(() => {
    if (activeLayerRequestKey <= 0) return
    if (lastHandledSelectionRequestKeyRef.current === activeLayerRequestKey) return
    // A new-layer request may arrive in the same render batch as the recipe
    // update. Leave it unconsumed until rowKeySignature exposes the real row.
    if (!activeRowKey) return
    const activeRow = rowRefs.current.get(activeRowKey)
    if (!activeRow) return
    lastHandledSelectionRequestKeyRef.current = activeLayerRequestKey
    activeRow.focus({ preventScroll: true })
    activeRow.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeLayerRequestKey, activeRowKey, rowKeySignature])

  /** Defers focus until React commits the recipe state without the removed row. */
  function removeRow(row: VisibleMixRow) {
    pendingFocusTargetRef.current = focusTargetAfterAtmoShaperVisibleRowRemoval(visibleRows, row.key)
    if (row.retained) actions.removeRetainedLayer(row.layer)
    else actions.removeLayer(row.layer.id)
  }

  /** Captures focus ownership before React detaches a row during reconciliation. */
  function registerRowNode(rowKey: string, node: HTMLLIElement | null) {
    const previousNode = rowRefs.current.get(rowKey)
    if (!node) {
      if (previousNode && previousNode.contains(previousNode.ownerDocument.activeElement)) {
        focusedUnmountedRowKeyRef.current = rowKey
      }
      rowRefs.current.delete(rowKey)
      return
    }
    // Ref callback churn reattaches surviving rows; it is not a removal.
    if (focusedUnmountedRowKeyRef.current === rowKey) focusedUnmountedRowKeyRef.current = null
    rowRefs.current.set(rowKey, node)
  }

  /** Reordering remains organizational; the recipe helper changes no audio routing. */
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const targetIndex = recipe.layers.findIndex(({ id }) => id === String(over.id))
    if (targetIndex < 0 || !recipe.layers.some(({ id }) => id === activeId)) return
    actions.moveLayer(
      activeId,
      targetIndex,
      sourceNamesById.get(activeId) ?? "Layer",
    )
  }

  function resolveRuntimeState(row: VisibleMixRow): VisibleLayerRuntimeState {
    if (row.retained) return { status: "playing" }
    return resolveAtmoShaperVisibleLayerState({
      activePlaybackKind: music.activePlaybackKind,
      layerState: music.atmoShaperSnapshot?.layers[row.layer.id],
      localRecipeId: recipe.id,
      providerError: music.error,
      providerRecipeId: music.atmoShaperSnapshot?.recipe?.id ?? null,
      snapshotStatus: music.atmoShaperSnapshot?.status,
    })
  }

  function resolveCompactLayerState(
    layer: AtmoShaperLayer,
    runtimeState: VisibleLayerRuntimeState,
  ) {
    if (runtimeState.status === "failed" || runtimeState.status === "loading") {
      return runtimeState.status
    }
    return layer.muted ? "muted" : runtimeState.status
  }

  function renderRowControls(row: VisibleMixRow, reorderHandle: ReactNode = null) {
    const { layer, retained } = row
    const sourceName = atmoShaperLayerSourceName(layer)
    const runtimeState = resolveRuntimeState(row)

    return (
      <MixLayerControls
        actions={actions}
        isSoloed={activeSoloLayerId === layer.id}
        layer={layer}
        onOpenLayer={onOpenLayer}
        onRemove={() => removeRow(row)}
        onToggleMuteLayer={onToggleMuteLayer}
        onToggleSoloLayer={onToggleSoloLayer}
        reorderHandle={reorderHandle}
        retained={retained}
        runtimeState={runtimeState}
        sourceName={sourceName}
      />
    )
  }

  return (
    <section
      className="ml-atmoshaper-current-mix min-w-0"
      aria-labelledby={headingId}
      data-expanded={expanded}
    >
      <div className="sr-only">
        <h2
          ref={headingRef}
          id={headingId}
          className="text-xl font-semibold"
          tabIndex={-1}
        >
          Current Mix
        </h2>
        <p className="text-sm text-muted-foreground">
          {visibleRows.length === 0 ? "Add a sound to begin." : `${visibleRows.length} visible layer${visibleRows.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="ml-atmoshaper-expanded-mix-transport" aria-label="Current Mix playback">
        <AtmoShaperTransportButton recipe={recipe} />
      </div>

      <div className="ml-atmoshaper-master-volume-slot">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-atmoshaper-rail-button ml-atmoshaper-rail-master-volume"
          aria-label="Open whole mix volume controls"
          data-atmoshaper-focus-key="whole-mix-volume"
          onClick={(event) => onRequestExpand(event.currentTarget)}
        >
          <Volume2 aria-hidden="true" className="h-4 w-4" />
          <span>Volume</span>
        </Button>
        <label className="ml-atmoshaper-expanded-master-volume">
          <span className="text-sm font-medium">Whole mix volume</span>
          <Slider
            aria-label="Whole mix volume"
            min={0}
            max={1}
            step={0.05}
            value={[music.volume]}
            onValueChange={([value]) => music.setVolume(value)}
          />
        </label>
      </div>

      <DndContext
        accessibility={{
          announcements: sortableAnnouncements,
          screenReaderInstructions: sortableScreenReaderInstructions,
        }}
        collisionDetection={closestCenter}
        sensors={sensors}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={recipe.layers.map(({ id }) => id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="ml-atmoshaper-expanded-layers">
            {visibleRows.map((row) => {
              const sourceName = atmoShaperLayerSourceName(row.layer)
              if (row.retained) {
                return (
                  <li
                    key={row.key}
                    ref={(node) => registerRowNode(row.key, node)}
                    className="ml-atmoshaper-layer-row rounded-lg border bg-card p-3 text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[active-layer=true]:border-primary/60"
                    aria-current={activeLayerId === row.layer.id ? "true" : undefined}
                    data-active-layer={activeLayerId === row.layer.id ? "true" : "false"}
                    data-layer-id={row.layer.id}
                    data-layer-state="playing"
                    data-sortable="false"
                    tabIndex={-1}
                  >
                    {renderRowControls(row)}
                  </li>
                )
              }
              return (
                <SortableLayerRow
                  key={row.key}
                  active={activeLayerId === row.layer.id}
                  id={row.layer.id}
                  state={resolveCompactLayerState(row.layer, resolveRuntimeState(row))}
                  sourceName={sourceName}
                  onNodeChange={(node) => registerRowNode(row.key, node)}
                >
                  {(reorderHandle) => renderRowControls(row, reorderHandle)}
                </SortableLayerRow>
              )
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  )
}

function MixLayerControls({
  actions,
  isSoloed,
  layer,
  onOpenLayer,
  onRemove,
  onToggleMuteLayer,
  onToggleSoloLayer,
  reorderHandle,
  retained,
  runtimeState,
  sourceName,
}: {
  actions: AtmoShaperRecipeActions
  isSoloed: boolean
  layer: AtmoShaperLayer
  onOpenLayer(layerId: string, opener: HTMLElement): void
  onRemove(): void
  onToggleMuteLayer(layerId: string, muted: boolean): void
  onToggleSoloLayer(layerId: string): void
  reorderHandle: ReactNode
  retained: boolean
  runtimeState: VisibleLayerRuntimeState
  sourceName: string
}) {
  const music = useMusic()
  const status = runtimeState.status

  function updateLayer(patch: Partial<AtmoShaperLayer>) {
    if (retained) actions.restoreRetainedLayer(layer, patch)
    else actions.updateLayer(layer.id, patch)
  }

  const brainwaveRateKey = layer.kind === "binaural"
    ? "beatHz"
    : layer.kind === "isochronic"
      ? "pulseHz"
      : null
  const carrierHz = typeof layer.settings.carrierHz === "number"
    ? layer.settings.carrierHz
    : ATMOSHAPER_PRESETS.alpha.carrierHz
  const rateHz = brainwaveRateKey && typeof layer.settings[brainwaveRateKey] === "number"
    ? layer.settings[brainwaveRateKey]
    : ATMOSHAPER_PRESETS.alpha.rateHz

  return (
    <>
      <div className="ml-atmoshaper-layer-header flex min-w-0 items-start justify-between gap-3">
        <div className="ml-atmoshaper-layer-identity min-w-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-atmoshaper-layer-open"
            aria-label={`Open ${sourceName} controls, ${status}`}
            data-atmoshaper-focus-key={`layer:${layer.id}`}
            onClick={(event) => onOpenLayer(layer.id, event.currentTarget)}
          >
            <span className="ml-atmoshaper-layer-name" title={sourceName}>{sourceName}</span>
            {status === "failed" || status === "loading" ? (
              <span className="ml-atmoshaper-layer-state-badge" aria-hidden="true">
                {status === "failed"
                  ? <CircleAlert className="ml-atmoshaper-rail-status-icon h-3.5 w-3.5" />
                  : <LoaderCircle className="ml-atmoshaper-rail-status-icon h-3.5 w-3.5" />}
              </span>
            ) : null}
          </Button>
          <p className="ml-atmoshaper-layer-status text-sm capitalize text-muted-foreground">
            {retained ? `Still playing during replacement · ${status}` : status}
          </p>
          {!retained && runtimeState.error ? (
            <p className="mt-1 text-sm text-destructive">{runtimeState.error}</p>
          ) : null}
        </div>
        <div className="ml-atmoshaper-layer-header-actions">
          <Button
            type="button"
            size="icon"
            variant="destructive"
            aria-label={`Remove ${sourceName}`}
            onClick={onRemove}
          >
            <span aria-hidden="true">×</span>
            <span className="sr-only">Remove</span>
          </Button>
          {reorderHandle}
        </div>
      </div>

      <div className="ml-atmoshaper-layer-volume-row mt-3">
        <Slider
          className="ml-atmoshaper-layer-volume-slider ml-slider-compact"
          aria-label={`Volume for ${sourceName}`}
          min={0}
          max={1}
          step={0.05}
          value={[layer.volume]}
          onValueChange={([volume]) => updateLayer({ volume })}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`${layer.muted ? "Unmute" : "Mute"} ${sourceName}`}
          title={`${layer.muted ? "Unmute" : "Mute"} ${sourceName}`}
          onClick={() => {
            if (retained) updateLayer({ muted: !layer.muted })
            else onToggleMuteLayer(layer.id, layer.muted)
          }}
        >
          {layer.muted
            ? <Volume2 aria-hidden="true" className="h-4 w-4" />
            : <VolumeX aria-hidden="true" className="h-4 w-4" />}
          <span>{layer.muted ? "Unmute" : "Mute"}</span>
        </Button>
        {!retained ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`${isSoloed ? "Unsolo" : "Solo"} ${sourceName}`}
            aria-pressed={isSoloed}
            onClick={() => onToggleSoloLayer(layer.id)}
          >
            <AudioLines aria-hidden="true" className="h-4 w-4" />
            <span>{isSoloed ? "Unsolo" : "Solo"}</span>
          </Button>
        ) : null}
      </div>

      {brainwaveRateKey ? (
        <section className="ml-atmoshaper-layer-brainwave-controls" aria-label={`${sourceName} live settings`}>
          <BrainwaveLayerControls
            kind={layer.kind === "binaural" ? "binaural" : "isochronic"}
            values={{ carrierHz, rateHz }}
            onChange={(values) => updateLayer({
              settings: {
                ...layer.settings,
                carrierHz: values.carrierHz,
                [brainwaveRateKey]: values.rateHz,
              },
            })}
          />
        </section>
      ) : null}

      {!retained && status === "failed" ? (
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            aria-label={`Retry ${sourceName}`}
            onClick={() => void music.retryAtmoShaperLayer(layer.id)}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </>
  )
}

/** Shared transport intent keeps expanded and rail controls behavior-identical. */
export function useAtmoShaperTransportControls(recipe: AtmoShaperRecipe) {
  const music = useMusic()
  const transportAction = atmoShaperWorkspaceTransportAction({
    activePlaybackKind: music.activePlaybackKind,
    localRecipeId: recipe.id,
    playbackState: music.playbackState,
    providerRecipeId: music.atmoShaperSnapshot?.recipe?.id ?? null,
  })
  const canStop = music.atmoShaperPreview !== null || canStopAtmoShaperWorkspaceRecipe({
    activePlaybackKind: music.activePlaybackKind,
    localRecipeId: recipe.id,
    playbackState: music.playbackState,
    providerRecipeId: music.atmoShaperSnapshot?.recipe?.id ?? null,
  })
  const shouldStop = music.atmoShaperPreview !== null
    || (canStop && music.playbackState !== "paused")

  function handlePrimary() {
    if (shouldStop) void music.stopCurrent()
    else if (transportAction === "restart") void music.restartCurrent()
    else void music.playAtmoShaper(recipe)
  }

  return { handlePrimary, shouldStop }
}

function AtmoShaperTransportButton({ recipe }: { recipe: AtmoShaperRecipe }) {
  const transport = useAtmoShaperTransportControls(recipe)
  const label = transport.shouldStop ? "Stop AtmoShaper" : "Play AtmoShaper"

  return (
    <Button
      type="button"
      variant={transport.shouldStop ? "destructive" : "success"}
      className="ml-atmoshaper-transport-button"
      aria-label={label}
      disabled={!transport.shouldStop && recipe.layers.length === 0}
      onClick={transport.handlePrimary}
    >
      {transport.shouldStop
        ? <Square aria-hidden="true" className="h-4 w-4" />
        : <Play aria-hidden="true" className="h-4 w-4" />}
      <span className="ml-atmoshaper-transport-label-full">
        {transport.shouldStop ? "Stop AtmoShaper" : "Play AtmoShaper"}
      </span>
      <span className="ml-atmoshaper-transport-label-compact">
        {transport.shouldStop ? "Stop" : "Play"}
      </span>
    </Button>
  )
}

export function atmoShaperLayerSourceName(layer: AtmoShaperLayer) {
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
  if (layer.kind === "ambient") {
    return getAtmoShaperProductionConcept(layer.sourceId).label
  }
  const preset = layer.sourceId.split(":").at(-1) ?? "custom"
  const label = `${preset.charAt(0).toUpperCase()}${preset.slice(1)}`
  return `${label} ${layer.kind === "binaural" ? "binaural beat" : layer.kind === "isochronic" ? "isochronic tone" : "ambient sound"}`
}
