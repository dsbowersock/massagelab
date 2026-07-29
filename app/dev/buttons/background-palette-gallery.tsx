"use client"

import { memo, useEffect, useMemo, useState } from "react"

import { BackgroundHost } from "@/components/backgrounds/BackgroundHost"
import {
  backgroundPaletteRegistry,
  type BackgroundPaletteAdapter,
} from "@/components/backgrounds/backgroundPaletteRegistry"
import {
  backgroundRegistry,
  type BackgroundDefinition,
  type BackgroundId,
} from "@/components/backgrounds/backgroundRegistry"
import {
  BackgroundPaletteEditor,
  type BackgroundColorMapping,
  type BackgroundPaletteEditorValue,
} from "@/components/chimer-controls/BackgroundPaletteEditor"
import {
  BackgroundColorPresetManager,
  BackgroundVisualPresetManager,
  type BackgroundColorPreset,
  type BackgroundVisualPreset,
} from "@/components/chimer-controls/BackgroundPresetManager"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Notice } from "@/components/ui/notice"
import { useMusic } from "@/components/providers/music-provider"
import { FEATURE_KEYS } from "@/lib/membership"
import {
  DEFAULT_BACKGROUND_PALETTE_STATE,
  normalizeBackgroundColorMapping,
  resolveBackgroundRoleColors,
} from "@/lib/background-palette.js"

const DEVELOPMENT_REVIEW_FEATURE_KEYS = [
  FEATURE_KEYS.premiumBackgrounds,
  FEATURE_KEYS.chimerCustomColors,
]

const CUSTOM_SWATCHES = [
  "#ff5119",
  "#fbbf24",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const

const SOURCE_PALETTE: BackgroundPaletteEditorValue = {
  ...DEFAULT_BACKGROUND_PALETTE_STATE,
  swatches: [...DEFAULT_BACKGROUND_PALETTE_STATE.swatches],
}

const CUSTOM_PALETTE: BackgroundPaletteEditorValue = {
  mode: "custom",
  primaryColor: CUSTOM_SWATCHES[0],
  harmony: "analogous",
  swatches: CUSTOM_SWATCHES,
}

const HARMONY_PALETTE: BackgroundPaletteEditorValue = {
  mode: "harmony",
  primaryColor: "#0ea5e9",
  harmony: "triad",
  swatches: CUSTOM_SWATCHES,
}

const enabledBackgrounds = backgroundRegistry.filter((entry) => entry.enabled)

const presetPalette = {
  mode: "custom" as const,
  primaryColor: CUSTOM_SWATCHES[0],
  harmony: "analogous",
  swatches: CUSTOM_SWATCHES,
}

const colorPresetFixtures: BackgroundColorPreset[] = Array.from(
  { length: 6 },
  (_, index) => ({
    id: `review-color-${index + 1}`,
    name: `Review colors ${index + 1}`,
    timestamp: index + 1,
    palette: presetPalette,
  }),
)

const visualPresetFixtures: BackgroundVisualPreset[] = Array.from(
  { length: 3 },
  (_, index) => ({
    id: `review-visual-${index + 1}`,
    name: `Review visual ${index + 1}`,
    timestamp: index + 1,
    properties: { speed: index + 1 },
    mapping: { main: index },
  }),
)

function adapterFamily(adapter: BackgroundPaletteAdapter) {
  return adapter.rendererFamily
}

function adapterSourceBehavior(adapter: BackgroundPaletteAdapter) {
  return adapter.status === "supported" ? (adapter.sourceBehavior ?? "fixed") : "unchanged"
}

function roleSummary(adapter: BackgroundPaletteAdapter) {
  return adapter.status === "supported"
    ? adapter.roles.map((role) => role.label).join(", ")
    : "No palette roles"
}

function unsupportedReason(adapter: BackgroundPaletteAdapter) {
  return adapter.status === "unsupported" ? adapter.unsupportedReason : ""
}

function defaultMapping(adapter: BackgroundPaletteAdapter): BackgroundColorMapping {
  return normalizeBackgroundColorMapping({}, adapter) as BackgroundColorMapping
}

function representativeByFamily(family: "css-dom" | "canvas" | "webgl") {
  return enabledBackgrounds.find((entry) => (
    entry.paletteAdapter?.status === "supported"
    && entry.paletteAdapter.rendererFamily === family
  ))
}

const StaticEditorSpecimen = memo(function StaticEditorSpecimen({
  title,
  palette,
  adapter,
  mapping,
  canCustomize = true,
}: {
  title: string
  palette: BackgroundPaletteEditorValue
  adapter: BackgroundPaletteAdapter
  mapping?: BackgroundColorMapping
  canCustomize?: boolean
}) {
  return (
    <AppSurface title={title} variant="inset">
      <BackgroundPaletteEditor
        palette={palette}
        adapter={adapter}
        mapping={mapping}
        canCustomize={canCustomize}
        backgroundName={title}
        onPaletteChange={() => undefined}
        onMappingChange={() => undefined}
      />
    </AppSurface>
  )
})

/**
 * Reads the globally mounted production Music provider and its active Tone
 * graph. Palette edits therefore prove continuity of the same station session,
 * playback state, and audio-context clock used by the real Music route.
 */
function ProductionMusicContinuityProbe() {
  const music = useMusic()
  const [diagnostics, setDiagnostics] = useState(() => music.getPlaybackDiagnostics())

  useEffect(() => {
    let frame = 0
    const update = () => {
      setDiagnostics(music.getPlaybackDiagnostics())
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [music])

  return (
    <div
      className="flex flex-wrap items-center gap-3 text-sm"
      data-background-palette-music-continuity
      data-music-station-id={music.activeStationId ?? ""}
      data-music-playback-state={music.playbackState}
      data-music-session-id={diagnostics?.sessionId ?? ""}
      data-music-audio-context-state={diagnostics?.audioContextState ?? ""}
      data-music-audio-elapsed={diagnostics?.elapsed ?? 0}
    >
      <Button
        size="compact"
        variant="secondary"
        onClick={() => void music.playStation("mlab-proof-drone")}
      >
        Play MassageLab Proof Drone
      </Button>
      <span>{music.activeStationTitle ?? "No station selected"}</span>
      <span>Production playback {music.playbackState}</span>
    </div>
  )
}

/**
 * Development-only palette migration matrix. It deliberately grants the
 * existing feature keys to this guarded fixture instead of adding any access
 * bypass to BackgroundHost or the production ownership resolver.
 */
export function BackgroundPaletteGallery() {
  const initialBackground = enabledBackgrounds[0]
  const [selectedId, setSelectedId] = useState<BackgroundId>(
    initialBackground?.id ?? "massage-lab-moving-gradient",
  )
  const [palette, setPalette] = useState<BackgroundPaletteEditorValue>(CUSTOM_PALETTE)
  const [mappingsByBackground, setMappingsByBackground] = useState<
    Partial<Record<BackgroundId, BackgroundColorMapping>>
  >({})
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  const selectedBackground = useMemo(
    () => enabledBackgrounds.find((entry) => entry.id === selectedId) ?? initialBackground,
    [initialBackground, selectedId],
  )
  const adapter = selectedBackground?.paletteAdapter
    ?? backgroundPaletteRegistry[selectedId]
    ?? backgroundPaletteRegistry["massage-lab-moving-gradient"]
  const selectedMapping = adapter
    ? (mappingsByBackground[selectedId] ?? defaultMapping(adapter))
    : {}
  const resolvedRoleColors = adapter?.status === "supported"
    ? resolveBackgroundRoleColors({
      palette,
      adapter,
      mapping: selectedMapping,
      canCustomize: true,
    })
    : {}
  const movingGradientAdapter = backgroundPaletteRegistry["massage-lab-moving-gradient"]
  const sharedRoleMapping: BackgroundColorMapping = movingGradientAdapter
    ? { main: 0, orb: 0 }
    : {}
  const unsupportedAdapter = backgroundPaletteRegistry["massage-lab-aurora"]
    ?? Object.values(backgroundPaletteRegistry).find((entry) => entry.status === "unsupported")
  const representativeEntries = (["css-dom", "canvas", "webgl"] as const)
    .map(representativeByFamily)
    .filter((entry): entry is BackgroundDefinition => Boolean(entry))

  if (process.env.NODE_ENV === "production") {
    return null
  }

  function updateSelectedMapping(nextMapping: BackgroundColorMapping) {
    setMappingsByBackground((current) => ({
      ...current,
      [selectedId]: nextMapping,
    }))
  }

  function ignorePresetAction() {
    // Static preset specimens demonstrate the real bounded controls; the
    // production draft reducer remains the sole mutation authority.
  }

  return (
    <div className="space-y-8" data-background-palette-gallery>
      <section className="space-y-4" aria-labelledby="background-palette-review-heading">
        <div>
          <h2 id="background-palette-review-heading" className="text-2xl font-semibold">
            Background palette review
          </h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            Review the shared Source, Custom, and Harmony contract, bounded draft states,
            adapter coverage, and one selected production renderer at a time.
          </p>
        </div>

        <Notice
          tone="info"
          title="Development-only premium fixture"
          description="This guarded gallery supplies the real premium_backgrounds and chimer_custom_colors feature keys. Production access checks and BackgroundHost remain unchanged."
        />
      </section>

      <section className="space-y-4" aria-labelledby="palette-static-states-heading">
        <div>
          <h3 id="palette-static-states-heading" className="text-xl font-semibold">
            Static editor states
          </h3>
          <p className="text-sm text-muted-foreground">
            Source, Custom, Harmony, unused roles, Shared roles, and Access locked use the real editor.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <StaticEditorSpecimen
            title="Source"
            palette={SOURCE_PALETTE}
            adapter={movingGradientAdapter}
          />
          <StaticEditorSpecimen
            title="Custom · Not used by this background"
            palette={CUSTOM_PALETTE}
            adapter={movingGradientAdapter}
          />
          <StaticEditorSpecimen
            title="Harmony · Shared roles"
            palette={HARMONY_PALETTE}
            adapter={movingGradientAdapter}
            mapping={sharedRoleMapping}
          />
          <StaticEditorSpecimen
            title="Access locked"
            palette={CUSTOM_PALETTE}
            adapter={movingGradientAdapter}
            canCustomize={false}
          />
          {unsupportedAdapter ? (
            <StaticEditorSpecimen
              title="Unsupported untinted"
              palette={CUSTOM_PALETTE}
              adapter={unsupportedAdapter}
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="draft-preset-states-heading">
        <div>
          <h3 id="draft-preset-states-heading" className="text-xl font-semibold">
            Draft, sync, and preset limits
          </h3>
          <p className="text-sm text-muted-foreground">
            Static specimens expose every bounded history, reset, retry, and default state.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AppSurface title="Unsaved changes" variant="inset">
            <p className="text-sm text-muted-foreground" role="status">
              Unsaved changes · history step 3 of 5
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="compact">Undo</Button>
              <Button size="compact">Redo</Button>
              <Button size="compact">Apply</Button>
              <Button size="compact" variant="secondary">Cancel</Button>
            </div>
          </AppSurface>
          <AppSurface title="Sync failed" variant="inset">
            <p className="text-sm text-destructive" role="alert">
              Sync failed. Local changes remain active and the cloud state is stale.
            </p>
            <Button className="mt-4" size="compact" variant="secondary">
              Retry
            </Button>
          </AppSurface>
          <BackgroundColorPresetManager
            presets={colorPresetFixtures}
            currentPalette={presetPalette}
            onDraftAction={ignorePresetAction}
          />
          <BackgroundVisualPresetManager
            presets={visualPresetFixtures}
            currentProperties={{ speed: 2 }}
            currentMapping={{ main: 0 }}
            backgroundName="Moving gradient"
            defaultPresetId="review-visual-1"
            roleLabels={{ main: "Main light" }}
            onDraftAction={ignorePresetAction}
          />
          <AppSurface title="Separate reset actions" variant="inset">
            <p className="text-sm text-muted-foreground">
              Color mapping remains background-specific and neither reset mutates the other state family.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="compact" onClick={() => setPalette((current) => ({ ...current, mode: "source" }))}>
                Use source colors
              </Button>
              <Button size="compact" variant="secondary" onClick={() => {
                if (!adapter) return
                updateSelectedMapping(defaultMapping(adapter))
              }}>
                Reset visual properties
              </Button>
            </div>
          </AppSurface>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="representative-renderers-heading">
        <div>
          <h3 id="representative-renderers-heading" className="text-xl font-semibold">
            Deterministic renderer-family representatives
          </h3>
          <p className="text-sm text-muted-foreground">
            CSS/DOM, Canvas, and WebGL inventory representatives use registry source metadata.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {representativeEntries.map((entry) => {
            const entryAdapter = entry.paletteAdapter
            const colors = entryAdapter?.status === "supported"
              ? resolveBackgroundRoleColors({
                palette: CUSTOM_PALETTE,
                adapter: entryAdapter,
                mapping: defaultMapping(entryAdapter),
                canCustomize: true,
              })
              : {}
            return (
              <AppSurface
                key={entry.id}
                title={entryAdapter?.status === "supported" ? entryAdapter.rendererFamily : "Unsupported"}
                variant="inset"
              >
                <p className="font-medium">{entry.label}</p>
                <p className="mt-1 break-words text-xs text-muted-foreground">{entry.id}</p>
                <p className="mt-2 text-sm">{entryAdapter ? roleSummary(entryAdapter) : "Missing adapter"}</p>
                <div className="relative mt-3 h-24 overflow-hidden rounded-lg border border-border">
                  <BackgroundHost
                    selectedId={entry.id}
                    featureKeys={DEVELOPMENT_REVIEW_FEATURE_KEYS}
                    massageLabLightSpeed={{
                      particleCount: 20,
                      warpSpeed: 0.1,
                      intensity: 0.25,
                    }}
                    backgroundPalette={{
                      palette: CUSTOM_PALETTE,
                      mapping: entryAdapter?.status === "supported"
                        ? defaultMapping(entryAdapter)
                        : {},
                      canCustomize: true,
                    }}
                    className="absolute inset-0"
                    testId={`background-palette-${entryAdapter?.rendererFamily ?? "unknown"}-representative`}
                    diagnostics
                  />
                </div>
                <output
                  className="sr-only"
                  data-family-representative={entryAdapter?.rendererFamily ?? "unknown"}
                  data-resolved-role-colors={JSON.stringify(colors)}
                />
              </AppSurface>
            )
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="live-background-palette-heading">
        <div>
          <h3 id="live-background-palette-heading" className="text-xl font-semibold">
            Live selected renderer
          </h3>
          <p className="text-sm text-muted-foreground">
            Only the selected effect is mounted. Shared swatches persist while labels and mappings follow the selection.
          </p>
        </div>

        <label className="grid max-w-2xl gap-1 text-sm font-medium">
          Live background
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.currentTarget.value as BackgroundId)}
            className="h-10 rounded-md border border-input bg-background px-3"
          >
            {enabledBackgrounds.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label} · {entry.id}</option>
            ))}
          </select>
        </label>
        <label className="grid max-w-xs gap-1 text-sm font-medium">
          Live palette mode
          <select
            value={palette.mode}
            onChange={(event) => {
              const mode = event.currentTarget.value as BackgroundPaletteEditorValue["mode"]
              setPalette((current) => ({ ...current, mode }))
            }}
            className="h-10 rounded-md border border-input bg-background px-3"
          >
            <option value="source">Source</option>
            <option value="custom">Custom</option>
            <option value="harmony">Harmony</option>
          </select>
        </label>
        <ProductionMusicContinuityProbe />

        {adapter && selectedBackground ? (
          <>
            <div data-live-palette-controls>
              <BackgroundPaletteEditor
                palette={palette}
                adapter={adapter}
                mapping={selectedMapping}
                canCustomize
                backgroundName={selectedBackground.label}
                onPaletteChange={setPalette}
                onMappingChange={updateSelectedMapping}
              />
            </div>
            <div
              className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
              data-background-palette-live-selector
              data-background-id={selectedId}
              data-adapter-status={adapter.status}
              data-renderer-family={adapterFamily(adapter)}
              data-source-behavior={adapterSourceBehavior(adapter)}
              data-unsupported-reason={unsupportedReason(adapter)}
              data-palette-mode={palette.mode}
              data-shared-swatches={JSON.stringify(palette.swatches)}
              data-active-mapping={JSON.stringify(selectedMapping)}
              data-active-role-labels={JSON.stringify(
                adapter.status === "supported"
                  ? Object.fromEntries(adapter.roles.map((role) => [role.id, role.label]))
                  : {},
              )}
              data-resolved-role-colors={JSON.stringify(resolvedRoleColors)}
              data-role-count={adapter.status === "supported" ? adapter.roles.length : 0}
              data-reduced-motion={reducedMotion ? "true" : "false"}
            >
              <div className="relative min-h-80 overflow-hidden rounded-2xl border border-border bg-black">
                <BackgroundHost
                  selectedId={selectedId}
                  featureKeys={DEVELOPMENT_REVIEW_FEATURE_KEYS}
                  massageLabLightSpeed={{
                    particleCount: 20,
                    warpSpeed: 0.1,
                    intensity: 0.25,
                  }}
                  massageLabPhotonBeam={{
                    lineCount: 12,
                    signalCount: 8,
                    trailLength: 1,
                    bloomStrength: 0,
                    bloomRadius: 0,
                  }}
                  massageLabRippleGrid={{
                    gridColor: "#ffffff",
                    enableRainbow: true,
                    gridSize: 17,
                    rippleIntensity: 0.17,
                    opacity: 0.63,
                    mouseInteraction: false,
                  }}
                  auroraBars={{
                    paletteMode: "auto",
                    primaryColor: "#abcdef",
                    colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
                    background: "#060606",
                    barCount: 12,
                    speed: 0.2,
                  }}
                  tileGrid={{
                    paletteMode: "auto",
                    primaryColor: "#abcdef",
                    colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
                    tileSize: 43,
                    jointSize: 3,
                    changeFrequency: 0.42,
                    activePercent: 0.31,
                    opacity: 0.77,
                  }}
                  gradientAnimation={{
                    backgroundStartColor: "#010101",
                    backgroundEndColor: "#020202",
                    firstColor: "#030303",
                    secondColor: "#040404",
                    thirdColor: "#050505",
                    fourthColor: "#060606",
                    fifthColor: "#070707",
                    speed: 1.7,
                    size: 63,
                  }}
                  backgroundPalette={{
                    palette,
                    mapping: selectedMapping,
                    canCustomize: true,
                  }}
                  className="absolute inset-0"
                  motionEnabled
                  testId="background-palette-live-host"
                  diagnostics
                />
                <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-background/85 p-3 text-xs text-foreground backdrop-blur">
                  <p className="font-semibold">{selectedBackground.label}</p>
                  <p>{adapter.status} · {adapterFamily(adapter)} · {adapterSourceBehavior(adapter)}</p>
                </div>
              </div>
              <AppSurface title="Resolved contract" variant="inset">
                <dl className="grid gap-2 text-sm">
                  <div><dt className="font-semibold">Status</dt><dd>{adapter.status}</dd></div>
                  <div><dt className="font-semibold">Roles</dt><dd>{roleSummary(adapter)}</dd></div>
                  <div><dt className="font-semibold">Source behavior</dt><dd>{adapterSourceBehavior(adapter)}</dd></div>
                  {adapter.status === "unsupported" ? (
                    <div><dt className="font-semibold">Unsupported reason</dt><dd>{adapter.unsupportedReason}</dd></div>
                  ) : null}
                </dl>
              </AppSurface>
            </div>
          </>
        ) : null}

      </section>

      <section className="space-y-4" aria-labelledby="adapter-status-heading">
        <div>
          <h3 id="adapter-status-heading" className="text-xl font-semibold">
            Exhaustive adapter status
          </h3>
          <p className="text-sm text-muted-foreground">
            Every enabled background reports a renderer family, adapter status, roles, Source behavior, and explicit unsupported reason.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Background</th>
                <th className="p-3">Family</th>
                <th className="p-3">Status</th>
                <th className="p-3">Roles</th>
                <th className="p-3">Source behavior</th>
                <th className="p-3">Unsupported reason</th>
              </tr>
            </thead>
            <tbody>
              {enabledBackgrounds.map((entry) => {
                const entryAdapter = entry.paletteAdapter
                  ?? backgroundPaletteRegistry[entry.id]
                const status = entryAdapter?.status ?? "unsupported"
                const family = entryAdapter ? adapterFamily(entryAdapter) : "missing"
                const behavior = entryAdapter ? adapterSourceBehavior(entryAdapter) : "unknown"
                const reason = entryAdapter
                  ? unsupportedReason(entryAdapter)
                  : "Enabled background is missing a palette adapter."
                return (
                  <tr
                    key={entry.id}
                    className="border-t border-border align-top"
                    data-palette-adapter-row
                    data-background-id={entry.id}
                    data-adapter-status={status}
                    data-renderer-family={family}
                    data-source-behavior={behavior}
                    data-unsupported-reason={reason}
                  >
                    <td className="p-3">
                      <span className="font-medium">{entry.label}</span>
                      <span className="block break-all text-xs text-muted-foreground">{entry.id}</span>
                    </td>
                    <td className="p-3">{family}</td>
                    <td className="p-3">{status}</td>
                    <td className="p-3">{entryAdapter ? roleSummary(entryAdapter) : "Missing adapter"}</td>
                    <td className="p-3">{behavior}</td>
                    <td className="p-3">{reason || "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
