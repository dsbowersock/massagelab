import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const componentUrls = {
  brainwaveArtwork: new URL("../components/atmoshaper/brainwave-artwork.tsx", import.meta.url),
  controls: new URL("../components/atmoshaper/brainwave-layer-controls.tsx", import.meta.url),
  hook: new URL("../components/atmoshaper/use-atmoshaper-recipe.ts", import.meta.url),
  library: new URL("../components/atmoshaper/sound-library.tsx", import.meta.url),
  model: new URL("../components/atmoshaper/sound-library-model.js", import.meta.url),
  mix: new URL("../components/atmoshaper/current-mix.tsx", import.meta.url),
  rail: new URL("../components/atmoshaper/current-mix-rail.tsx", import.meta.url),
  noiseArtwork: new URL("../components/atmoshaper/noise-artwork.tsx", import.meta.url),
  sortableRow: new URL("../components/atmoshaper/sortable-layer-row.tsx", import.meta.url),
  workspace: new URL("../components/atmoshaper/atmoshaper-workspace.tsx", import.meta.url),
}

async function readSource(url) {
  try {
    return await readFile(url, "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") return ""
    throw error
  }
}

const [
  brainwaveArtworkSource,
  controlsSource,
  hookSource,
  librarySource,
  modelSource,
  mixSource,
  railSource,
  noiseArtworkSource,
  sortableRowSource,
  workspaceSource,
] = await Promise.all([
  readSource(componentUrls.brainwaveArtwork),
  readSource(componentUrls.controls),
  readSource(componentUrls.hook),
  readSource(componentUrls.library),
  readSource(componentUrls.model),
  readSource(componentUrls.mix),
  readSource(componentUrls.rail),
  readSource(componentUrls.noiseArtwork),
  readSource(componentUrls.sortableRow),
  readSource(componentUrls.workspace),
])
const packageSource = [
  brainwaveArtworkSource,
  controlsSource,
  hookSource,
  librarySource,
  modelSource,
  mixSource,
  railSource,
  noiseArtworkSource,
  sortableRowSource,
  workspaceSource,
].join("\n")

describe("AtmoShaper live-session workspace source contract", () => {
  it("owns one session recipe through the canonical pure helpers", () => {
    for (const contract of [
      /createAtmoShaperRecipe/,
      /addAtmoShaperLayer/,
      /updateAtmoShaperLayer/,
      /removeAtmoShaperLayer/,
      /moveAtmoShaperLayer/,
      /useReducer/,
      /crypto\.randomUUID\(\)/,
      /updateAtmoShaper\(recipe\)/,
      /initializeAtmoShaperWorkspaceRecipe/,
      /shouldSyncAtmoShaperWorkspaceRecipe/,
    ]) assert.match(hookSource, contract)

    assert.doesNotMatch(packageSource, /localStorage|sessionStorage|document\.cookie|cookies\(|server action|use server|account api/i)
  })

  it("offers the scoped sound library and honest ambient follow-up", () => {
    for (const label of [
      "White noise",
      "Pink noise",
      "Brown noise",
      "Atmosphere stations",
      "Binaural beats",
      "Isochronic tones",
      "Delta",
      "Theta",
      "Alpha",
      "Beta",
      "Gamma",
      "Advanced",
    ]) assert.match(librarySource, new RegExp(label))

    assert.match(librarySource, /getPlayableAtmosphereStations/)
    assert.match(librarySource, /sourceId:\s*station\.id/)
    assert.match(librarySource, /ATMOSHAPER_PRODUCTION_CATALOG/)
    assert.match(librarySource, /Search ambient sounds/)
    assert.doesNotMatch(librarySource, /Ambient sound library is being prepared/)
    assert.doesNotMatch(librarySource, /Lo-Fi|YouTube/)
  })

  it("bounds advanced carrier and beat or pulse controls", () => {
    assert.match(controlsSource, /Carrier pitch/)
    assert.match(controlsSource, /Beat frequency difference/)
    assert.match(controlsSource, /Pulse rate/)
    assert.match(controlsSource, /min=\{ATMOSHAPER_FREQUENCY_BOUNDS\.carrierHz\.min\}/)
    assert.match(controlsSource, /max=\{ATMOSHAPER_FREQUENCY_BOUNDS\.carrierHz\.max\}/)
    assert.match(controlsSource, /min=\{ATMOSHAPER_FREQUENCY_BOUNDS\.rateHz\.min\}/)
    assert.match(controlsSource, /max=\{ATMOSHAPER_FREQUENCY_BOUNDS\.rateHz\.max\}/)
    assert.match(controlsSource, /step=\{1\}/)
    assert.match(controlsSource, /step=\{0\.5\}/)
  })

  it("uses exclusive replacement and confirms only customized station replacement", () => {
    assert.match(librarySource, /currentStationLayer/)
    assert.match(librarySource, /stationLayerIsCustomized/)
    assert.match(librarySource, /setPendingStation/)
    assert.match(librarySource, /AlertDialog/)
    assert.match(librarySource, /Replace station foundation/)
    assert.match(librarySource, /resolveSoundLibraryCommit/)
    assert.match(librarySource, /resolution\.type === "select-existing"/)
    assert.match(librarySource, /stationReplacementConfirmed/)
    assert.doesNotMatch(librarySource, /currentStationLayer\.sourceId !==/)
  })

  it("renders ordered layer controls and source-aware transport", () => {
    for (const contract of [
      /recipe\.layers\.map/,
      /Volume for/,
      /aria-label=\{`\$\{layer\.muted \? "Unmute" : "Mute"\} \$\{sourceName\}`\}/,
      /title=\{`\$\{layer\.muted \? "Unmute" : "Mute"\} \$\{sourceName\}`\}/,
      /SortableLayerRow/,
      /Retry/,
      /Remove/,
      /Play AtmoShaper/,
      /Stop AtmoShaper/,
      /Whole mix volume/,
      /music\.retryAtmoShaperLayer/,
      /music\.restartCurrent/,
      /music\.playAtmoShaper\(recipe\)/,
      /music\.stopCurrent/,
      /canStopAtmoShaperWorkspaceRecipe/,
      /projectRetainedAtmoShaperLayers/,
      /restoreRetainedLayer/,
      /removeRetainedLayer/,
    ]) assert.match(mixSource, contract)

    assert.match(mixSource, /music\.runtimeReadiness\.status === "ready"/)
    assert.match(mixSource, /!transport\.audioReady \|\| recipe\.layers\.length === 0/)
    assert.match(workspaceSource, /prepareAtmoShaperAudio\(\)/)
    assert.match(librarySource, /previewStatus === "failed"\) && !audioReady/)
    assert.match(mixSource, /min=\{0\}/)
    assert.match(mixSource, /max=\{1\}/)
    assert.match(mixSource, /step=\{0\.05\}/)
    assert.match(mixSource, /Still playing during replacement/)
    assert.match(mixSource, /music\.atmoShaperPreview !== null \|\| canStopAtmoShaperWorkspaceRecipe/)
    assert.match(mixSource, /if \(shouldStop\) void music\.stopCurrent\(\)/)
    assert.doesNotMatch(mixSource, /Pause AtmoShaper|music\.pauseCurrent/)
  })

  it("restores focus after explicit removal and focused-row reconciliation", () => {
    assert.match(mixSource, /focusTargetAfterAtmoShaperVisibleRowRemoval/)
    assert.match(mixSource, /focusTargetAfterAtmoShaperRowsReconcile/)
    assert.match(mixSource, /useLayoutEffect/)
    assert.match(mixSource, /rowRefs/)
    assert.match(mixSource, /previousNode\.contains\(previousNode\.ownerDocument\.activeElement\)/)
    assert.match(mixSource, /focusedUnmountedRowKeyRef/)
    assert.match(mixSource, /headingRef/)
    assert.match(mixSource, /tabIndex=\{-1\}/)
  })

  it("consumes selection focus once without replaying it after row removal", () => {
    const removalFocusEffect = mixSource.indexOf("const requestedFocusTarget = pendingFocusTargetRef.current")
    const alreadyHandledGuard = mixSource.indexOf(
      "lastHandledSelectionRequestKeyRef.current === activeLayerRequestKey",
    )
    const missingRowGuard = mixSource.indexOf("if (!activeRow) return")
    const consumeRequest = mixSource.indexOf(
      "lastHandledSelectionRequestKeyRef.current = activeLayerRequestKey",
    )

    assert.ok(removalFocusEffect >= 0 && alreadyHandledGuard > removalFocusEffect)
    assert.ok(missingRowGuard >= 0 && consumeRequest > missingRowGuard)
    assert.equal(
      mixSource.match(/lastHandledSelectionRequestKeyRef\.current = activeLayerRequestKey/g)?.length,
      1,
    )
    assert.match(mixSource, /\[activeLayerRequestKey, activeRowKey, rowKeySignature\]/)
  })

  it("projects retained runtime rows only for the current local recipe owner", () => {
    assert.match(mixSource, /projectRetainedAtmoShaperLayersForWorkspace/)
    assert.match(mixSource, /activePlaybackKind:\s*music\.activePlaybackKind/)
    assert.match(mixSource, /localRecipe:\s*recipe/)
    assert.match(mixSource, /providerRecipeId:/)
  })

  it("announces discrete changes without narrating sliders", () => {
    assert.match(workspaceSource, /role="status"/)
    assert.match(workspaceSource, /aria-live="polite"/)
    assert.match(hookSource, /Layer added/)
    assert.match(hookSource, /Layer removed/)
    assert.match(hookSource, /moved to position/)
    assert.match(hookSource, /action\.toIndex \+ 1/)
    assert.match(hookSource, /return nextRecipe/)
    assert.match(hookSource, /syncRevision: state\.syncRevision \+ resolution\.syncRevisionDelta/)
    assert.match(hookSource, /const \{ recipe, syncRevision \} = state/)
    assert.match(hookSource, /recipe,\s*syncRevision,\s*updateAtmoShaper,/)
    assert.match(workspaceSource, /sourceName} failed/)
    assert.match(workspaceSource, /resolveSoundLibraryPreviewAnnouncement/)
    assert.match(modelSource, /previousState\?\.sourceKey === nextState\.sourceKey/)
    assert.match(modelSource, /previousState\.status === nextState\.status/)
    assert.doesNotMatch(controlsSource, /aria-live/)
    assert.doesNotMatch(mixSource, /aria-live/)
    assert.doesNotMatch(librarySource, /role="alert"/)
  })

  it("names source actions and announces every new failure through a stable live region", () => {
    assert.match(mixSource, /aria-label=\{`\$\{layer\.muted \? "Unmute" : "Mute"\} \$\{sourceName\}`\}/)
    assert.match(mixSource, /aria-label=\{`Retry \$\{sourceName\}`\}/)
    assert.match(workspaceSource, /newlyFailedLayers/)
    assert.match(workspaceSource, /\.map\(\(\[layerId, state\]\)/)
    assert.match(workspaceSource, /atmoShaperLayerSourceName/)
    assert.doesNotMatch(workspaceSource, /key=\{announcement\?\.id\}/)
  })

  it("gives honest brainwave guidance without health claims or persistence UI", () => {
    assert.match(librarySource, /headphones/i)
    assert.match(librarySource, /intentionally pulsing/i)
    assert.doesNotMatch(packageSource, /treat|therap|diagnos|cognitive|brain health|sleep treatment/i)
    assert.doesNotMatch(packageSource, /Save As|My Mixes|Paywall|Supporter|purchase|checkout/i)
  })

  it("wires card preview, promotion, duplicate selection, and route cleanup", () => {
    for (const contract of [
      /previewAtmoShaperLayer/,
      /stopAtmoShaperPreview/,
      /setAtmoShaperPreviewVolume/,
      /promoteAtmoShaperPreview\(optimisticRecipe\)/,
      /actions\.addLayer\(preview\.layer, \{ announce: false \}\)/,
      /actions\.addLayer\(resolution\.layer\)/,
      /soundLibraryCommitIsPending/,
      /beginSoundLibraryPendingCommit/,
      /settleSoundLibraryPendingCommit/,
      /actions\.settleLayerPromotion\(transaction, settlement\)/,
      /aria-busy=\{commitPending \|\| undefined\}/,
      /onSelectLayer\(resolution\.layerId, opener, "select-existing"\)/,
      /ml-atmoshaper-card-preview-controls/,
      /Retry/,
      /Stop Preview/,
    ]) assert.match(librarySource, contract)

    assert.match(workspaceSource, /layerSelectionRequest/)
    assert.match(workspaceSource, /createAtmoShaperLayerSelectionRequest\(current, layerId, \{ opener, reason \}\)/)
    assert.match(workspaceSource, /activeLayerRequestKey=\{layerSelectionRequest\?\.requestKey \?\? 0\}/)
    assert.match(workspaceSource, /onSelectLayer=\{selectLibraryLayer\}/)
    assert.match(workspaceSource, /void stopAtmoShaperPreview\(\)/)
    assert.match(mixSource, /activeLayerId/)
    assert.match(mixSource, /activeLayerRequestKey/)
    assert.match(mixSource, /lastHandledSelectionRequestKeyRef/)
    assert.match(
      mixSource,
      /lastHandledSelectionRequestKeyRef\.current === activeLayerRequestKey\) return/,
    )
    assert.match(mixSource, /if \(!activeRowKey\) return/)
    assert.match(mixSource, /if \(!activeRow\) return/)
    assert.match(
      mixSource,
      /lastHandledSelectionRequestKeyRef\.current = activeLayerRequestKey/,
    )
    assert.match(mixSource, /activeRow\.focus\(\{ preventScroll: true \}\)/)
    assert.match(mixSource, /activeRow\.scrollIntoView/)
    assert.match(mixSource, /\[activeLayerRequestKey, activeRowKey, rowKeySignature\]/)

  })

  it("uses one measured opposite-edge panel and restores its exact opener", () => {
    assert.match(workspaceSource, /useSettings\(\)/)
    assert.match(workspaceSource, /new ResizeObserver/)
    assert.match(workspaceSource, /resolveAtmoShaperDrawerMode/)
    assert.match(workspaceSource, /oppositeAtmoShaperEdge\(settings\.sidebarPosition\)/)
    assert.match(workspaceSource, /shouldAutoOpenAtmoShaperDrawer/)
    assert.match(workspaceSource, /drawerMode=\{drawerMode\}/)
    assert.match(workspaceSource, /drawerSide=\{drawerSide\}/)
    assert.match(workspaceSource, /expanded=\{mixDrawerOpen\}/)
    assert.match(workspaceSource, /currentMixPanelRef/)
    assert.match(workspaceSource, /ml-atmoshaper-current-mix-overlay-narrow/)
    assert.match(workspaceSource, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/)
    assert.equal(workspaceSource.match(/<Sheet\s/g)?.length ?? 0, 0)

    assert.match(librarySource, /onAdd\(event\.currentTarget\)/)
    assert.match(librarySource, /pendingStationCommit/)
    assert.match(librarySource, /opener:\s*HTMLElement/)
    assert.match(workspaceSource, /opener\?\.isConnected \? opener : primaryRailToggleRef\.current/)
    assert.match(workspaceSource, /window\.requestAnimationFrame\(\(\) => \{/)
    assert.match(workspaceSource, /isAtmoShaperFocusRestoreTarget\(exactOpener\)/)
    assert.match(workspaceSource, /primaryRailToggleRef\.current/)
    assert.doesNotMatch(workspaceSource, /const focusTarget = exactOpener\?\.isConnected/)
    assert.match(workspaceSource, /focusTarget\.focus\(\{ preventScroll: true \}\)/)
  })

  it("renders committed layers only in the persistent rail", () => {
    assert.match(workspaceSource, /<CurrentMixRail/)
    assert.match(railSource, /<CurrentMix/)
    assert.match(mixSource, /recipe\.layers\.map/)
    assert.doesNotMatch(railSource, /atmoShaperPreview\.layer|preview\.layer/)
    assert.match(mixSource, /Open \$\{sourceName\} controls, \$\{status\}/)
    assert.match(mixSource, /ml-atmoshaper-layer-name/)
    assert.match(mixSource, /ml-atmoshaper-layer-volume-row/)
    assert.doesNotMatch(mixSource, /aria-pressed=\{layer\.muted\}/)
    assert.match(mixSource, /aria-label=\{`\$\{layer\.muted \? "Unmute" : "Mute"\} \$\{sourceName\}`\}/)
    assert.match(mixSource, /aria-pressed=\{isSoloed\}/)
    assert.match(sortableRowSource, /data-layer-state=\{state\}/)
    assert.match(mixSource, /status === "loading"/)
    assert.match(mixSource, /status === "failed"/)
    assert.match(mixSource, /variant=\{transport\.shouldStop \? "destructive" : "success"\}/)
    assert.match(mixSource, /music\.stopCurrent/)
  })

  it("widens one continuously mounted Current Mix control tree", () => {
    assert.match(workspaceSource, /<CurrentMixRail[\s\S]*?expanded=\{mixDrawerOpen\}/)
    assert.doesNotMatch(workspaceSource, /!mixDrawerOpen\s*\?\s*\(\s*<CurrentMixRail/)
    assert.equal(workspaceSource.match(/<Sheet\s/g)?.length ?? 0, 0)
    assert.match(railSource, /data-expanded=\{expanded\}/)
    assert.match(railSource, /<CurrentMix[\s\S]*?expanded=\{expanded\}/)
  })

  it("sorts from visible handles with pointer, touch, keyboard, and announcements", () => {
    assert.match(mixSource, /class AtmoShaperPointerSensor extends PointerSensor/)
    assert.match(mixSource, /pointerType === "touch"\) return false/)
    assert.match(mixSource, /useSensor\(AtmoShaperPointerSensor, \{ activationConstraint: \{ distance: 6 \} \}\)/)
    assert.match(mixSource, /useSensor\(TouchSensor, \{ activationConstraint: \{ delay: 180, tolerance: 8 \} \}\)/)
    assert.match(mixSource, /useSensor\(KeyboardSensor, \{ coordinateGetter: sortableKeyboardCoordinates \}\)/)
    assert.match(mixSource, /screenReaderInstructions: sortableScreenReaderInstructions/)
    for (const announcement of ["Grabbed", "over position", "Dropped", "Cancelled sorting"]) {
      assert.match(mixSource, new RegExp(announcement))
    }
    assert.match(mixSource, /actions\.moveLayer\([\s\S]*?activeId,[\s\S]*?targetIndex/)
    assert.match(sortableRowSource, /useSortable\(\{ id \}\)/)
    assert.match(sortableRowSource, /ml-atmoshaper-layer-drag-handle/)
    assert.match(sortableRowSource, /\{\.\.\.attributes\}[\s\S]*?\{\.\.\.listeners\}/)
    assert.match(mixSource, /data-sortable="false"/)
    assert.doesNotMatch(packageSource, /Move earlier|Move later/)
  })

  it("maps live brainwave settings without inventing station or noise controls", () => {
    assert.match(mixSource, /<BrainwaveLayerControls/)
    assert.match(mixSource, /kind=\{layer\.kind === "binaural" \? "binaural" : "isochronic"\}/)
    assert.match(mixSource, /carrierHz: values\.carrierHz/)
    assert.match(mixSource, /\[brainwaveRateKey\]: values\.rateHz/)
    assert.match(mixSource, /if \(retained\) actions\.restoreRetainedLayer/)
    assert.match(mixSource, /layer\.kind === "binaural"[\s\S]*?layer\.kind === "isochronic"/)
  })

  it("retires the prior column, tray, and positional controls", () => {
    assert.doesNotMatch(
      packageSource,
      /CurrentMixTray|Move earlier|Move later|ml-atmoshaper-mix-tray|ml-atmoshaper-current-mix-desktop/,
    )
  })

  it("composes semantic glow and success controls without nested buttons", () => {
    assert.match(librarySource, /<TabsTrigger key=\{value\} value=\{value\} asChild>/)
    assert.match(librarySource, /variant="glow"/)
    assert.match(librarySource, /size="compact"/)
    assert.match(librarySource, /variant="success"/)
    assert.match(mixSource, /variant=\{transport\.shouldStop \? "destructive" : "success"\}/)
    assert.doesNotMatch(librarySource, /<TabsTrigger[^>]*>\s*<button/)
  })

  it("uses canonical station art and decorative static source artwork", () => {
    assert.match(librarySource, /AtmosphereStationArtwork/)
    assert.match(librarySource, /resolveAtmosphereStationArtworkInput\(station\)/)
    assert.doesNotMatch(librarySource, /\/api\/atmosphere\/stations|renderAtmosphereStationArtworkSvg/)

    assert.match(noiseArtworkSource, /feTurbulence/)
    assert.match(noiseArtworkSource, /aria-hidden="true"/)
    for (const color of ["white", "pink", "brown"]) {
      assert.match(noiseArtworkSource, new RegExp(`${color}:`))
    }

    assert.match(brainwaveArtworkSource, /data-wave-channel="left"/)
    assert.match(brainwaveArtworkSource, /data-wave-channel="right"/)
    assert.match(brainwaveArtworkSource, /data-pulse-envelope="true"/)
    assert.match(brainwaveArtworkSource, /aria-hidden="true"/)
    assert.doesNotMatch(brainwaveArtworkSource, /requestAnimationFrame|setInterval|useEffect/)
  })

  it("keeps source identity decisions pure and outside persistence", () => {
    assert.match(modelSource, /createSoundLibraryCandidateLayer/)
    assert.match(modelSource, /getAtmoShaperSourceConfigurationKey/)
    assert.match(modelSource, /atmoShaperPreviewMatchesCandidate/)
    assert.match(modelSource, /resolveSoundLibraryCommit/)
    assert.match(modelSource, /type: "select-existing"/)
    assert.doesNotMatch(modelSource, /localStorage|sessionStorage|fetch\(|use server/i)
  })
})
