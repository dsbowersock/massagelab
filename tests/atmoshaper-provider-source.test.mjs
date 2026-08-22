import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { runInNewContext } from "node:vm"
import ts from "typescript"

import { createAtmoShaperMixController } from "../lib/atmoshaper/mix-controller.js"

const providerSource = await readFile(
  new URL("../components/providers/music-provider.tsx", import.meta.url),
  "utf8",
)
const commandGateSource = await readFile(
  new URL("../lib/atmoshaper/provider-command-gate.ts", import.meta.url),
  "utf8",
)
const commandGateCompiled = ts.transpileModule(commandGateSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const commandGateModule = await import(
  `data:text/javascript;base64,${Buffer.from(commandGateCompiled.outputText).toString("base64")}`
)
const {
  createAtmoShaperProviderCommandGate,
  executeAtmoShaperPromotionCommand,
  executeAtmoShaperRecipeReconciliation,
} = commandGateModule

function sourceBetween(startMarker, endMarker) {
  const start = providerSource.indexOf(startMarker)
  const end = providerSource.indexOf(endMarker, start)
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`)
  return providerSource.slice(start, end)
}

function loadPromotionOwnershipHelpers() {
  const helperSource = sourceBetween(
    "type AtmoShaperPromotionSettlement =",
    "type ToneProofDroneDiagnostics =",
  )
  const compiled = ts.transpileModule(`${helperSource}\n;globalThis.__promotionHelpers = {\n  hasCommittedAtmoShaperMediaOwnership,\n  settleAtmoShaperPromotion,\n  canContinueAtmoShaperPreviewRequest,\n  isAtmoShaperPreviewOnlyPlayback,\n}`, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const context = {}
  runInNewContext(compiled.outputText, context)
  return context.__promotionHelpers
}

const promotionOwnership = loadPromotionOwnershipHelpers()

function controllerLayer(id, kind = "ambient", volume = 0.5) {
  return { id, kind, sourceId: `${id}-source`, volume, muted: false, settings: {} }
}

function controllerRecipe(layers, name = "Provider command mix") {
  return { version: 1, id: "provider-command", name, artworkSeed: "provider-command", layers }
}

function deferred() {
  let resolve
  const promise = new Promise((settle) => { resolve = settle })
  return { promise, resolve }
}

function createTrackedController({ rejectLayerIds = new Set(), onUpdate = async () => undefined } = {}) {
  const operations = []
  const handles = []
  const controller = createAtmoShaperMixController({
    async createAdapter(layer) {
      operations.push(["create", layer.id])
      if (rejectLayerIds.has(layer.id)) throw new Error(`${layer.id} unavailable`)
      const handle = {
        layerId: layer.id,
        disposed: false,
        async fadeIn() { operations.push(["fadeIn", layer.id]) },
        async update(nextLayer) {
          operations.push(["update", layer.id, nextLayer.volume])
          await onUpdate(nextLayer)
        },
        async pause() { operations.push(["pause", layer.id]) },
        async resume() { operations.push(["resume", layer.id]) },
        async fadeOutAndDispose() {
          handle.disposed = true
          operations.push(["dispose", layer.id])
        },
      }
      handles.push(handle)
      return handle
    },
  })
  return { controller, handles, operations }
}

describe("AtmoShaper provider ownership contract", () => {
  it("exposes source-aware identity and complete global transport actions", () => {
    for (const contract of [
      /export type MusicPlaybackKind = "station" \| "atmoshaper" \| null/,
      /activePlaybackKind: PlaybackKind/,
      /activeStationId: string \| null/,
      /canNavigateStations: boolean/,
      /atmoShaperSnapshot: AtmoShaperRuntimeSnapshot \| null/,
      /atmoShaperPreview: AtmoShaperPreviewSnapshot \| null/,
      /activeLayers: Record<string, AtmoShaperLayer>/,
      /playAtmoShaper: \(recipe: AtmoShaperRecipe\) => Promise<void>/,
      /updateAtmoShaper: \(recipe: AtmoShaperRecipe\) => Promise<void>/,
      /retryAtmoShaperLayer: \(layerId: string\) => Promise<void>/,
      /previewAtmoShaperLayer: \(layer: AtmoShaperLayer\) => Promise<void>/,
      /setAtmoShaperPreviewVolume: \(volume: number\) => Promise<void>/,
      /stopAtmoShaperPreview: \(\) => Promise<void>/,
      /promoteAtmoShaperPreview: \(recipe: AtmoShaperRecipe\) => Promise<void>/,
      /pauseCurrent: \(\) => Promise<void>/,
      /restartCurrent: \(\) => Promise<void>/,
    ]) assert.match(providerSource, contract)
  })

  it("replaces the old owner before starting the next owner", () => {
    const stationPath = sourceBetween(
      "const playStation = useCallback",
      "const playAdjacentStation = useCallback",
    )
    const atmoPath = sourceBetween(
      "const playAtmoShaper = useCallback",
      "const promoteAtmoShaperPreview = useCallback",
    )
    const snapshotPath = sourceBetween(
      "const publishAtmoShaperRuntimeSnapshot = useCallback",
      "const loadAtmoShaperRuntime = useCallback",
    )

    assert.match(stationPath, /stopAtmoShaperPreview\(\)/)
    assert.match(stationPath, /disposeAtmoShaperRuntime\(\)/)
    assert.ok(
      stationPath.indexOf("stopAtmoShaperPreview()")
        < stationPath.indexOf("runtime.controller.start(station)"),
      "station playback must stop preview before its adapter starts",
    )
    assert.match(atmoPath, /runtimeRef\.current\?\.controller\.stopAndWait\(\)/)
    assert.ok(
      atmoPath.indexOf("runtimeRef.current?.controller.stopAndWait()")
        < atmoPath.indexOf("loadAtmoShaperRuntime(runtimeLease)"),
      "AtmoShaper must begin awaited ordinary disposal before creating its runtime",
    )
    assert.match(
      atmoPath,
      /Promise\.all\(\[[\s\S]*?ordinaryStationDisposal,[\s\S]*?atmoShaperPreviewStop,[\s\S]*?priorAtmoShaperDisposal,[\s\S]*?\]\)\.then\(\(\) => loadAtmoShaperRuntime\(runtimeLease\)\)/,
      "AtmoShaper must finish ordinary disposal and preview cleanup before creating its runtime",
    )
    assert.match(atmoPath, /sessionGeneration !== playbackSessionGenerationRef\.current/)
    assert.match(atmoPath, /runtimeLease !== atmoShaperRuntimeLeaseRef\.current/)
    assert.match(atmoPath, /settleSourceRuntimeStartup/)
    assert.match(atmoPath, /const guardedStartup = commandGate\.run\(\{/)
    assert.match(atmoPath, /recipe:\s*atmoShaperRecipeRef\.current/)
    assert.match(atmoPath, /revision:\s*atmoShaperRecipeRevisionRef\.current/)
    assert.match(atmoPath, /desiredTransport:\s*atmoShaperDesiredTransportRef\.current/)
    assert.match(
      snapshotPath,
      /recipe:\s*atmoShaperRecipeRef\.current \?\? snapshot\.recipe/,
      "startup callbacks must not republish a superseded captured recipe",
    )
  })

  it("keeps preview-only playback unpublished and reuses the canonical runtime", () => {
    const previewPath = sourceBetween(
      "const previewAtmoShaperLayer = useCallback",
      "const playStation = useCallback",
    )

    assert.match(previewPath, /runtimeRef\.current\?\.controller\.stopAndWait\(\)/)
    assert.ok(
      previewPath.indexOf("await ordinaryStationDisposal")
        < previewPath.indexOf("loadAtmoShaperRuntime(runtimeLease)"),
      "preview must await ordinary station disposal before lazy runtime creation",
    )
    assert.match(previewPath, /runtimeOwner === "committed"/)
    assert.match(previewPath, /atmoShaperPendingRuntimeRef\.current/)
    assert.match(previewPath, /interruptionMonitorRef\.current\?\.start\(\)/)
    assert.match(previewPath, /await runtime\.startPreview\(layer\)/)
    assert.doesNotMatch(previewPath, /setActivePlaybackKind\("atmoshaper"\)/)
    assert.doesNotMatch(previewPath, /publishMediaSession\(/)
    assert.doesNotMatch(previewPath, /mediaCarrierRef\.current\?\.start\(\)/)
    assert.match(previewPath, /commitPlaybackLifecycle\(\{ type: "EXPLICIT_STOP" \}\)/)
  })

  it("guards every preview continuation with provider and runtime leases", () => {
    const previewPath = sourceBetween(
      "const previewAtmoShaperLayer = useCallback",
      "const playStation = useCallback",
    )
    const stopPreviewPath = sourceBetween(
      "const stopAtmoShaperPreviewSlot = useCallback",
      "const setAtmoShaperPreviewVolume = useCallback",
    )
    const publicStopPreviewPath = sourceBetween(
      "const stopAtmoShaperPreview = useCallback",
      "const setAtmoShaperPreviewVolume = useCallback",
    )

    assert.match(previewPath, /const previewLease = \+\+atmoShaperPreviewLeaseRef\.current/)
    assert.match(previewPath, /previewLease !== atmoShaperPreviewLeaseRef\.current/)
    assert.match(previewPath, /requestId !== playbackRequestIdRef\.current/)
    assert.match(previewPath, /sessionGeneration !== playbackSessionGenerationRef\.current/)
    assert.match(previewPath, /runtimeLease !== atmoShaperRuntimeLeaseRef\.current/)
    assert.match(stopPreviewPath, /const previewLease = \+\+atmoShaperPreviewLeaseRef\.current/)
    assert.match(stopPreviewPath, /atmoShaperRuntimeRef\.current !== runtime/)
    assert.match(
      publicStopPreviewPath,
      /atmoShaperPreviewRequestLeaseRef\.current \+= 1/,
      "public Stop Preview must supersede a request waiting at the promotion boundary",
    )
  })

  it("rejects a preview superseded while awaiting promotion cancellation", () => {
    const previewPath = sourceBetween(
      "const previewAtmoShaperLayer = useCallback",
      "const playStation = useCallback",
    )
    const stationPath = sourceBetween(
      "const playStation = useCallback",
      "const playAdjacentStation = useCallback",
    )
    const atmoPath = sourceBetween(
      "const playAtmoShaper = useCallback",
      "const promoteAtmoShaperPreview = useCallback",
    )
    const requestLeaseIndex = previewPath.indexOf(
      "const previewRequestLease = ++atmoShaperPreviewRequestLeaseRef.current",
    )
    const playbackRequestIndex = previewPath.indexOf(
      "const admittedPlaybackRequestId = playbackRequestIdRef.current",
    )
    const sessionIndex = previewPath.indexOf(
      "const admittedSessionGeneration = playbackSessionGenerationRef.current",
    )
    const cancellationIndex = previewPath.indexOf(
      "await stopAtmoShaperPreviewSlot()",
    )
    const admissionGuardIndex = previewPath.indexOf(
      "if (!canContinueAtmoShaperPreviewRequest({",
    )

    for (const captureIndex of [requestLeaseIndex, playbackRequestIndex, sessionIndex]) {
      assert.ok(captureIndex !== -1 && captureIndex < cancellationIndex)
    }
    assert.ok(cancellationIndex < admissionGuardIndex)
    for (const forbiddenStaleEffect of [
      "runtimeRef.current?.controller.stopAndWait()",
      "activePlaybackKindRef.current = null",
      "const canReuseRuntime =",
      "const pendingRuntime = atmoShaperPendingRuntimeRef.current",
      "await runtime.startPreview(layer)",
      "setAtmoShaperPreview(preview)",
    ]) {
      assert.ok(
        admissionGuardIndex < previewPath.indexOf(forbiddenStaleEffect),
        `admission must be rechecked before: ${forbiddenStaleEffect}`,
      )
    }

    // A newer station may continue the same lifecycle generation, so its
    // request/preview generations alone must still reject the older preview.
    assert.equal(promotionOwnership.canContinueAtmoShaperPreviewRequest({
      previewRequestCurrent: false,
      playbackRequestCurrent: false,
      sessionCurrent: true,
    }), false)
    // A newer committed or pending mix advances every global admission guard.
    assert.equal(promotionOwnership.canContinueAtmoShaperPreviewRequest({
      previewRequestCurrent: false,
      playbackRequestCurrent: false,
      sessionCurrent: false,
    }), false)
    assert.equal(promotionOwnership.canContinueAtmoShaperPreviewRequest({
      previewRequestCurrent: false,
      playbackRequestCurrent: true,
      sessionCurrent: true,
    }), false, "a newer preview supersedes the older preview locally")
    assert.equal(promotionOwnership.canContinueAtmoShaperPreviewRequest({
      previewRequestCurrent: true,
      playbackRequestCurrent: true,
      sessionCurrent: true,
    }), true)

    assert.ok(
      stationPath.indexOf("playbackRequestIdRef.current = requestId")
        < stationPath.indexOf('activePlaybackKindRef.current = "station"'),
      "a newer station invalidates the old preview before publishing station ownership",
    )
    assert.ok(
      atmoPath.indexOf("playbackRequestIdRef.current = requestId")
        < atmoPath.indexOf("atmoShaperPendingRuntimeRef.current = pendingRuntime"),
      "a newer mix invalidates the old preview before exposing its pending runtime",
    )
    assert.ok(
      atmoPath.indexOf("stopAtmoShaperPreview()")
        < atmoPath.indexOf("atmoShaperPendingRuntimeRef.current = pendingRuntime"),
      "pending mix ownership also advances the local preview request generation",
    )
  })

  it("keeps AtmoShaper paused and stopped edits silent while retaining its recipe", () => {
    const pausePath = sourceBetween("const pauseCurrent = useCallback", "const restartCurrent = useCallback")
    const restartPath = sourceBetween("const restartCurrent = useCallback", "const stopCurrent = useCallback")
    const updatePath = sourceBetween("const updateAtmoShaper = useCallback", "const retryAtmoShaperLayer = useCallback")
    const retryPath = sourceBetween("const retryAtmoShaperLayer = useCallback", "const playAdjacentStation = useCallback")
    const stopPath = sourceBetween("const stopCurrent = useCallback", "const handleInterruptionStarted = useCallback")

    assert.match(pausePath, /activePlaybackKindRef\.current === "atmoshaper"/)
    assert.match(pausePath, /await runtime\?\.pause\(\)/)
    assert.match(pausePath, /status: "paused"/)
    assert.doesNotMatch(pausePath, /disposeAtmoShaperRuntime\(\)/)
    assert.match(restartPath, /activePlaybackKindRef\.current/)
    assert.match(restartPath, /atmoShaperRecipeRef\.current/)
    assert.match(restartPath, /await runtime\.resume\(\)/)
    assert.match(updatePath, /atmoShaperRecipeRef\.current = recipe/)
    assert.match(updatePath, /atmoShaperRecipeRevisionRef\.current \+= 1/)
    assert.match(updatePath, /if \(activePlaybackKindRef\.current !== "atmoshaper"\) return/)
    assert.match(updatePath, /await commandGate\.run\(\{/)
    assert.match(updatePath, /executeAtmoShaperRecipeReconciliation\(\{/)
    assert.doesNotMatch(updatePath, /force:\s*true/)
    assert.match(updatePath, /activeLayers: currentSnapshot\?\.activeLayers \?\? \{\}/)
    assert.match(retryPath, /snapshot\.status === "failed"/)
    assert.match(
      retryPath,
      /await playAtmoShaper\(recipe\)/,
      "an all-failed retry must reacquire global playback and media ownership",
    )
    assert.match(
      retryPath,
      /executeAtmoShaperRecipeReconciliation\(\{[\s\S]*?force:\s*true/,
      "a partial-mix retry must force the unchanged recipe through the serialized runtime path",
    )
    assert.match(stopPath, /await stopAtmoShaperPreview\(\)/)
    assert.match(stopPath, /await atmoShaperPreviewStop/)
    assert.match(stopPath, /await disposeAtmoShaperRuntime\(\)/)
    assert.match(stopPath, /commitOwnedPlaybackEffect/)
    assert.match(stopPath, /requestId === playbackRequestIdRef\.current/)
    assert.match(stopPath, /activePlaybackKindRef\.current === stoppedPlaybackKind/)
    assert.match(stopPath, /scheduleStoppedPlayerRetirement/)
  })

  it("routes volume, Media Session, interruption, and navigation by current owner", () => {
    const mediaPath = sourceBetween("const publishMediaSession = useCallback", "const ensureInterruptionMonitor")
    const volumePath = sourceBetween("const setVolume = useCallback", "const toggleFavorite = useCallback")
    const interruptionPath = sourceBetween(
      "const handleInterruptionStarted = useCallback",
      "const setSessionResumeAfterInterruption = useCallback",
    )

    assert.match(mediaPath, /restartCurrentRef\.current/)
    assert.match(mediaPath, /activePlaybackKindRef\.current === "station"/)
    assert.match(mediaPath, /previoustrack: canNavigateStations/)
    assert.match(mediaPath, /nexttrack: canNavigateStations/)
    assert.match(volumePath, /activePlaybackKindRef\.current === "atmoshaper"/)
    assert.match(volumePath, /atmoShaperRuntimeRef\.current\?\.setMasterVolume\(clampedVolume\)/)
    assert.match(volumePath, /activePlaybackKindRef\.current === "station"/)
    assert.match(interruptionPath, /atmoShaperRuntimeRef\.current\?\.pause\(\)/)
    assert.match(interruptionPath, /runtime\.resume\(\)/)
    assert.match(interruptionPath, /mediaCarrierRef\.current\?\.start\(\)/)
    assert.match(providerSource, /canNavigateStations:\s*activePlaybackKind === "station"/)
  })

  it("routes preview-only interruption without claiming the global lifecycle", () => {
    const interruptionPath = sourceBetween(
      "const handleInterruptionStarted = useCallback",
      "const setSessionResumeAfterInterruption = useCallback",
    )

    assert.match(interruptionPath, /isAtmoShaperPreviewOnlyPlayback\(/)
    assert.match(interruptionPath, /atmoShaperPreviewInterruptedRef\.current = true/)
    assert.match(interruptionPath, /runtime\.pause\(\)/)
    assert.match(interruptionPath, /atmoShaperPreviewInterruptedRef\.current = false/)
    assert.match(interruptionPath, /runtime\.resume\(\)/)
    assert.ok(
      interruptionPath.indexOf("const current = playbackLifecycleRef.current")
        < interruptionPath.indexOf('commitPlaybackLifecycle({ type: "INTERRUPTION_STARTED" })'),
      "the preview-only branch must return before the global interruption lifecycle",
    )
  })

  it("keeps ordinary station identity separate from AtmoShaper artwork identity", () => {
    const atmoPath = sourceBetween(
      "const playAtmoShaper = useCallback",
      "const promoteAtmoShaperPreview = useCallback",
    )
    assert.match(atmoPath, /setActivePlaybackKind\("atmoshaper"\)/)
    assert.match(atmoPath, /activeStationIdRef\.current = null/)
    assert.match(atmoPath, /setActiveStationId\(null\)/)
    assert.match(atmoPath, /stationId: `atmoshaper:\$\{recipe\.artworkSeed\}`/)
    assert.match(atmoPath, /groupId: "atmoshaper"/)
  })

  it("promotes the live runtime into the one published AtmoShaper owner", () => {
    const promotionPath = sourceBetween(
      "const promoteAtmoShaperPreview = useCallback",
      "const updateAtmoShaper = useCallback",
    )
    const successfulCommitPath = promotionPath.slice(
      promotionPath.indexOf("atmoShaperRecipeRef.current = committedRecipe"),
      promotionPath.indexOf("} catch (caughtError)"),
    )

    assert.match(promotionPath, /atmoShaperRuntimeOwnerRef\.current = "committed"/)
    assert.match(promotionPath, /setActivePlaybackKind\("atmoshaper"\)/)
    assert.match(promotionPath, /publishMediaSession\(/)
    assert.match(promotionPath, /mediaCarrierRef\.current\?\.start\(\)/)
    assert.match(promotionPath, /executeAtmoShaperPromotionCommand\(\{/)
    assert.match(promotionPath, /const queuedPromotion = await commandGate\.run\(\{/)
    assert.match(
      promotionPath,
      /areAtmoShaperRecipesEqual\(readDesiredPromotionRecipe\(\), desiredRecipe\)/,
      "the gate must recheck the exact latest desired recipe before mutating",
    )
    assert.match(
      promotionPath,
      /areAtmoShaperRecipesEqual\(promotionCommand\.recipe, latestDesiredRecipe\)/,
      "publication must wait until the adopted handle converges to latest provider intent",
    )
    assert.ok(
      promotionPath.indexOf("executeAtmoShaperPromotionCommand({")
        < promotionPath.indexOf('setActivePlaybackKind("atmoshaper")'),
      "promotion must transfer the live handle before publishing the global owner",
    )
    assert.doesNotMatch(successfulCommitPath, /disposeAtmoShaperRuntime\(\)/)
    assert.match(promotionPath, /settleAtmoShaperPromotion\(/)
    assert.match(promotionPath, /previewLease === atmoShaperPreviewLeaseRef\.current/)
    assert.match(promotionPath, /runtimeLease === atmoShaperRuntimeLeaseRef\.current/)
  })

  it("reacquires lifecycle and carrier ownership for stopped or failed committed runtimes", () => {
    const promotionPath = sourceBetween(
      "const promoteAtmoShaperPreview = useCallback",
      "const updateAtmoShaper = useCallback",
    )

    for (const terminalStatus of ["stopped", "failed"]) {
      assert.equal(
        promotionOwnership.hasCommittedAtmoShaperMediaOwnership(
          "committed",
          "atmoshaper",
          terminalStatus,
        ),
        false,
        `${terminalStatus} runtimes have dismissed media ownership`,
      )
    }
    for (const ownedStatus of ["loading", "playing", "paused", "interrupted"]) {
      assert.equal(
        promotionOwnership.hasCommittedAtmoShaperMediaOwnership(
          "committed",
          "atmoshaper",
          ownedStatus,
        ),
        true,
        `${ownedStatus} runtimes retain their current media session`,
      )
    }

    assert.match(promotionPath, /if \(!hadMediaOwnership\) \{[\s\S]*?BEGIN_IN_APP_SESSION/)
    assert.ok(
      promotionPath.indexOf("executeAtmoShaperPromotionCommand({")
        < promotionPath.indexOf('type: "BEGIN_IN_APP_SESSION"'),
      "a terminal runtime must begin its replacement lifecycle only after the handle transfers",
    )
    assert.match(
      promotionPath,
      /const carrierStartPromise = hadMediaOwnership[\s\S]*?\? null[\s\S]*?: mediaCarrierRef\.current\?\.start\(\)/,
    )
    assert.equal(promotionOwnership.settleAtmoShaperPromotion({
      transactionCurrent: true,
      previewCurrent: true,
      runtimeCurrent: true,
      requestCurrent: true,
      sessionCurrent: true,
      hadMediaOwnership: false,
    }), "commit")
  })

  it("retires a stop-cancelled promotion without rolling back a newer global owner", () => {
    const promotionPath = sourceBetween(
      "const promoteAtmoShaperPreview = useCallback",
      "const updateAtmoShaper = useCallback",
    )
    const stopPreviewPath = sourceBetween(
      "const stopAtmoShaperPreviewSlot = useCallback",
      "const setAtmoShaperPreviewVolume = useCallback",
    )
    const retirePath = sourceBetween(
      "const retireUnownedPromotion = async",
      "const restoreCommittedPromotion = async",
    )

    // This executes the provider's production settlement helper for the exact
    // interleaving: promotion captures lease N, Stop Preview advances it to N+1,
    // and no newer station or mix has claimed the global request/session.
    assert.equal(promotionOwnership.settleAtmoShaperPromotion({
      transactionCurrent: true,
      previewCurrent: false,
      runtimeCurrent: true,
      requestCurrent: true,
      sessionCurrent: true,
      hadMediaOwnership: false,
    }), "retire-unowned")
    assert.match(retirePath, /await disposeAtmoShaperRuntime\(\)/)
    assert.match(retirePath, /activePlaybackKindRef\.current = null/)
    assert.match(retirePath, /setActivePlaybackKind\(null\)/)
    assert.match(retirePath, /commitPlaybackLifecycle\(\{ type: "EXPLICIT_STOP" \}\)/)
    assert.match(retirePath, /mediaCarrierRef\.current\?\.stopAndDismiss\(\)/)
    assert.match(retirePath, /mediaSessionControllerRef\.current\?\.clear\(\)/)
    assert.match(stopPreviewPath, /const pendingPromotion = atmoShaperPromotionPromiseRef\.current/)
    assert.match(stopPreviewPath, /await pendingPromotion/)

    assert.equal(promotionOwnership.settleAtmoShaperPromotion({
      transactionCurrent: true,
      previewCurrent: false,
      runtimeCurrent: true,
      requestCurrent: false,
      sessionCurrent: false,
      hadMediaOwnership: false,
    }), "superseded")
    assert.match(promotionPath, /if \(settlement === "superseded"\) return/)
    assert.equal(promotionOwnership.settleAtmoShaperPromotion({
      transactionCurrent: true,
      previewCurrent: false,
      runtimeCurrent: true,
      requestCurrent: true,
      sessionCurrent: true,
      hadMediaOwnership: true,
    }), "restore-committed")
  })

  it("leaves a newer overlapping promotion authoritative when the older one settles", async () => {
    const promotionPath = sourceBetween(
      "const promoteAtmoShaperPreview = useCallback",
      "const updateAtmoShaper = useCallback",
    )
    const catchPath = promotionPath.slice(
      promotionPath.indexOf("} catch (caughtError)"),
      promotionPath.indexOf("} finally"),
    )
    let releaseOlderPromotion
    const olderPromotionDeferred = new Promise((resolve) => {
      releaseOlderPromotion = resolve
    })
    let currentGeneration = 1
    const olderGeneration = currentGeneration
    const olderEffects = []
    const authoritativeState = {
      recipe: "newer-recipe",
      handle: "newer-handle",
      metadata: "newer-metadata",
    }
    const olderSettlement = (async () => {
      await olderPromotionDeferred
      const settlement = promotionOwnership.settleAtmoShaperPromotion({
        transactionCurrent: olderGeneration === currentGeneration,
        previewCurrent: false,
        runtimeCurrent: true,
        requestCurrent: true,
        sessionCurrent: true,
        hadMediaOwnership: true,
      })
      if (settlement === "superseded") return
      if (settlement === "restore-committed") {
        olderEffects.push("restore")
        authoritativeState.recipe = "older-prior-recipe"
        authoritativeState.handle = "older-restored-handle"
      } else if (settlement === "retire-unowned") {
        olderEffects.push("dispose")
        authoritativeState.handle = null
      } else {
        olderEffects.push("publish")
        authoritativeState.metadata = "older-metadata"
      }
    })()

    // The second promotion replaces transaction identity without advancing the
    // active mix's global playback/session generations.
    currentGeneration += 1
    releaseOlderPromotion()
    await olderSettlement

    assert.deepEqual(olderEffects, [])
    assert.deepEqual(authoritativeState, {
      recipe: "newer-recipe",
      handle: "newer-handle",
      metadata: "newer-metadata",
    })
    assert.match(promotionPath, /const promotionGeneration = \+\+atmoShaperPromotionGenerationRef\.current/)
    assert.match(promotionPath, /transactionCurrent: isPromotionTransactionCurrent\(\)/)
    assert.ok(
      promotionPath.indexOf('if (settlement === "superseded") return')
        < promotionPath.indexOf('if (settlement === "retire-unowned")'),
      "the older transaction must return before any rollback or commit branch",
    )
    assert.match(
      catchPath,
      /if \(!isPromotionTransactionCurrent\(\) \|\| !isGlobalTransactionCurrent\(\)\) return/,
      "an older rejected promotion must not restore over the newer transaction",
    )
  })

  it("serializes promotion with automatic recipe sync without recreating the preview adapter", async () => {
    const updateEntered = deferred()
    const releasePromotionUpdate = deferred()
    let shouldBlockPromotionUpdate = false
    const previewLayer = controllerLayer("preview-rain", "noise", 0.4)
    const desiredLayer = { ...previewLayer, volume: 0.7 }
    const desiredRecipe = controllerRecipe([desiredLayer], "Committed preview")
    const { controller, handles, operations } = createTrackedController({
      async onUpdate(nextLayer) {
        if (!shouldBlockPromotionUpdate || nextLayer.id !== previewLayer.id) return
        shouldBlockPromotionUpdate = false
        updateEntered.resolve()
        await releasePromotionUpdate.promise
      },
    })
    const runtime = {
      getSnapshot: () => controller.getSnapshot(),
      applyRecipe: (recipe) => controller.applyRecipe(recipe),
      promotePreview: (recipe) => controller.promotePreview(recipe),
    }
    const gate = createAtmoShaperProviderCommandGate()
    let receipt = null

    await controller.startPreview(previewLayer)
    const previewHandle = handles[0]
    operations.length = 0
    shouldBlockPromotionUpdate = true
    const promotion = gate.run({
      isCurrent: () => true,
      execute: async () => {
        const result = await executeAtmoShaperPromotionCommand({
          runtime,
          runtimeLease: 1,
          previewLayer,
          desiredRecipe,
          priorReceipt: receipt,
        })
        receipt = result.receipt
        return result
      },
    })
    await updateEntered.promise
    const automaticSync = gate.run({
      isCurrent: () => true,
      execute: () => executeAtmoShaperRecipeReconciliation({ runtime, desiredRecipe }),
    })

    releasePromotionUpdate.resolve()
    const [promotionResult, syncResult] = await Promise.all([promotion, automaticSync])

    assert.equal(promotionResult.status, "executed")
    assert.equal(syncResult.status, "executed")
    assert.equal(syncResult.value.status, "unchanged")
    assert.equal(handles.length, 1, "the preview adapter is the only adapter ever created")
    assert.equal(handles[0], previewHandle, "the exact preview handle remains authoritative")
    assert.equal(previewHandle.disposed, false)
    assert.equal(operations.some(([operation]) => operation === "create"), false)
    assert.equal(operations.some(([operation]) => operation === "fadeIn"), false)
    assert.equal(operations.some(([operation]) => operation === "dispose"), false)
    assert.deepEqual(controller.getSnapshot().activeLayers[previewLayer.id], desiredLayer)
    assert.equal(controller.getSnapshot().preview, null)
  })

  it("forces an unchanged partial-mix recipe to retry only its failed adapter", async () => {
    const operations = []
    const handles = []
    let failedAttempts = 0
    const healthyLayer = controllerLayer("healthy-rain", "noise", 0.45)
    const failedLayer = controllerLayer("failed-stream", "station", 0.55)
    const recipe = controllerRecipe([healthyLayer, failedLayer], "Partial mix")
    const controller = createAtmoShaperMixController({
      createAdapter(layer) {
        operations.push(["create", layer.id])
        if (layer.id === failedLayer.id && failedAttempts++ === 0) {
          throw new Error("stream temporarily unavailable")
        }
        const handle = {
          layerId: layer.id,
          disposed: false,
          async fadeIn() { operations.push(["fadeIn", layer.id]) },
          async update() { operations.push(["update", layer.id]) },
          async pause() { operations.push(["pause", layer.id]) },
          async resume() { operations.push(["resume", layer.id]) },
          async fadeOutAndDispose() {
            handle.disposed = true
            operations.push(["dispose", layer.id])
          },
        }
        handles.push(handle)
        return handle
      },
    })
    const runtime = {
      getSnapshot: () => controller.getSnapshot(),
      applyRecipe: (desiredRecipe) => controller.applyRecipe(desiredRecipe),
    }
    const gate = createAtmoShaperProviderCommandGate()

    await controller.start(recipe)
    assert.equal(controller.getSnapshot().status, "playing")
    assert.equal(controller.getSnapshot().layers[failedLayer.id].status, "failed")
    const healthyHandle = handles.find((handle) => handle.layerId === healthyLayer.id)
    operations.length = 0

    const ordinarySync = await gate.run({
      isCurrent: () => true,
      execute: () => executeAtmoShaperRecipeReconciliation({
        runtime,
        desiredRecipe: recipe,
      }),
    })
    assert.equal(ordinarySync.status, "executed")
    assert.equal(ordinarySync.value.status, "unchanged")
    assert.deepEqual(operations, [])

    const retry = await gate.run({
      isCurrent: () => true,
      execute: () => executeAtmoShaperRecipeReconciliation({
        runtime,
        desiredRecipe: recipe,
        force: true,
      }),
    })

    assert.equal(retry.status, "executed")
    assert.equal(retry.value.status, "reconciled")
    assert.deepEqual(
      operations.filter(([operation]) => operation === "create"),
      [["create", failedLayer.id]],
      "only the failed adapter is recreated",
    )
    assert.equal(handles.find((handle) => handle.layerId === healthyLayer.id), healthyHandle)
    assert.equal(healthyHandle.disposed, false)
    assert.equal(operations.some(([operation]) => operation === "dispose"), false)
    assert.equal(controller.getSnapshot().layers[healthyLayer.id].status, "playing")
    assert.equal(controller.getSnapshot().layers[failedLayer.id].status, "playing")
    assert.deepEqual(controller.getSnapshot().activeLayers, {
      [healthyLayer.id]: healthyLayer,
      [failedLayer.id]: failedLayer,
    })
  })

  it("serializes overlapping promotions and adopts the live preview only once", async () => {
    const olderUpdateEntered = deferred()
    const releaseOlderUpdate = deferred()
    let shouldBlockOlderUpdate = false
    const previewLayer = controllerLayer("preview-stream", "station", 0.3)
    const olderRecipe = controllerRecipe([{ ...previewLayer, volume: 0.6 }], "Older promotion")
    const newerLayer = { ...previewLayer, volume: 0.9 }
    const newerRecipe = controllerRecipe([newerLayer], "Newer promotion")
    const { controller, handles, operations } = createTrackedController({
      async onUpdate(nextLayer) {
        if (!shouldBlockOlderUpdate || nextLayer.volume !== 0.6) return
        shouldBlockOlderUpdate = false
        olderUpdateEntered.resolve()
        await releaseOlderUpdate.promise
      },
    })
    let promoteCalls = 0
    let applyCalls = 0
    const runtime = {
      getSnapshot: () => controller.getSnapshot(),
      async applyRecipe(recipe) {
        applyCalls += 1
        await controller.applyRecipe(recipe)
      },
      async promotePreview(recipe) {
        promoteCalls += 1
        await controller.promotePreview(recipe)
      },
    }
    const gate = createAtmoShaperProviderCommandGate()
    let receipt = null
    const promote = (desiredRecipe) => gate.run({
      isCurrent: () => true,
      execute: async () => {
        const result = await executeAtmoShaperPromotionCommand({
          runtime,
          runtimeLease: 7,
          previewLayer,
          desiredRecipe,
          priorReceipt: receipt,
        })
        receipt = result.receipt
        return result
      },
    })

    await controller.startPreview(previewLayer)
    const previewHandle = handles[0]
    operations.length = 0
    shouldBlockOlderUpdate = true
    const olderPromotion = promote(olderRecipe)
    await olderUpdateEntered.promise
    const newerPromotion = promote(newerRecipe)
    releaseOlderUpdate.resolve()
    const [olderResult, newerResult] = await Promise.all([olderPromotion, newerPromotion])

    assert.equal(olderResult.status, "executed")
    assert.equal(newerResult.status, "executed")
    assert.equal(promoteCalls, 1, "only the command that owns the live preview may promote")
    assert.equal(applyCalls, 1, "the newer promotion safely reconciles the adopted handle")
    assert.equal(handles.length, 1)
    assert.equal(handles[0], previewHandle)
    assert.equal(previewHandle.disposed, false)
    assert.equal(operations.some(([operation]) => operation === "create"), false)
    assert.equal(operations.some(([operation]) => operation === "fadeIn"), false)
    assert.equal(operations.some(([operation]) => operation === "dispose"), false)
    assert.deepEqual(controller.getSnapshot().activeLayers[previewLayer.id], newerLayer)
    assert.equal(controller.getSnapshot().recipe.name, "Newer promotion")
    assert.equal(controller.getSnapshot().preview, null)
  })

  it("pauses and resumes retained stopped and failed runtime previews as preview-only audio", async () => {
    for (const terminalStatus of ["stopped", "failed"]) {
      const rejectLayerIds = terminalStatus === "failed" ? new Set(["broken"]) : new Set()
      const { controller, operations } = createTrackedController({ rejectLayerIds })
      const terminalRecipe = terminalStatus === "failed"
        ? controllerRecipe([controllerLayer("broken")], "Failed mix")
        : controllerRecipe([], "Stopped mix")
      await controller.start(terminalRecipe)
      assert.equal(controller.getSnapshot().status, terminalStatus)

      const previewLayer = controllerLayer(`terminal-${terminalStatus}`, "ambient")
      await controller.startPreview(previewLayer)
      operations.length = 0
      const retainedLifecycleStatus = terminalStatus
      assert.equal(
        promotionOwnership.isAtmoShaperPreviewOnlyPlayback(
          "committed",
          "atmoshaper",
          retainedLifecycleStatus,
        ),
        true,
      )

      await controller.pause()
      assert.equal(controller.getSnapshot().status, terminalStatus)
      assert.equal(controller.getSnapshot().preview.status, "paused")
      assert.deepEqual(operations, [["pause", previewLayer.id]])

      assert.equal(
        promotionOwnership.isAtmoShaperPreviewOnlyPlayback(
          "committed",
          "atmoshaper",
          retainedLifecycleStatus,
        ),
        true,
      )
      await controller.resume()
      assert.equal(controller.getSnapshot().status, terminalStatus)
      assert.equal(controller.getSnapshot().preview.status, "playing")
      assert.deepEqual(operations, [
        ["pause", previewLayer.id],
        ["resume", previewLayer.id],
      ])
    }
  })

  it("does not publish failed or stopped mixes as playing carrier sessions", () => {
    const mediaPath = sourceBetween("const publishMediaSession = useCallback", "const ensureInterruptionMonitor")
    const atmoPath = sourceBetween(
      "const playAtmoShaper = useCallback",
      "const promoteAtmoShaperPreview = useCallback",
    )
    const snapshotPath = sourceBetween(
      "const publishAtmoShaperRuntimeSnapshot = useCallback",
      "const loadAtmoShaperRuntime = useCallback",
    )
    const restartPath = sourceBetween("const restartCurrent = useCallback", "const stopCurrent = useCallback")
    const stopPath = sourceBetween("const stopCurrent = useCallback", "const handleInterruptionStarted = useCallback")

    assert.match(mediaPath, /state === "paused" \|\| state === "interrupted"/)
    assert.match(mediaPath, /state === "failed" \|\| state === "stopped"/)
    assert.match(mediaPath, /\? "none"\s*:\s*"playing"/)
    assert.match(snapshotPath, /nextSnapshot\.status === "failed"[\s\S]*?stopAndDismiss\(\)[\s\S]*?publishMediaSession\([^,]+, "failed"\)/)
    assert.match(snapshotPath, /nextSnapshot\.status === "stopped"[\s\S]*?commitPlaybackLifecycle\(\{ type: "EXPLICIT_STOP" \}\)[\s\S]*?stopAndDismiss\(\)[\s\S]*?clear\(\)/)
    assert.match(
      atmoPath,
      /snapshot\.status === "playing"[\s\S]*?else if \(snapshot\.status === "stopped"\)[\s\S]*?commitPlaybackLifecycle\(\{ type: "EXPLICIT_STOP" \}\)[\s\S]*?setError\(null\)[\s\S]*?stopAndDismiss\(\)[\s\S]*?clear\(\)[\s\S]*?else[\s\S]*?publishMediaSession\(latestMetadata, "failed"\)/,
      "startup settlement must preserve an async remove-last stop instead of republishing failure",
    )
    assert.match(restartPath, /snapshot\.status === "playing"[\s\S]*?else[\s\S]*?stopAndDismiss\(\)/)
    assert.match(stopPath, /mediaCarrierRef\.current\?\.stopAndDismiss\(\)/)
    assert.match(stopPath, /mediaSessionControllerRef\.current\?\.clear\(\)/)
  })

  it("cannot retain or republish the interruption notice after terminal failure", () => {
    const settlePath = sourceBetween(
      "const settleMediaIntegrationAvailability = useCallback",
      "const playStation = useCallback",
    )
    assert.match(settlePath, /playbackLifecycleRef\.current\.status/)
    assert.match(settlePath, /lifecycleStatus !== "failed"/)
    assert.match(settlePath, /lifecycleStatus !== "stopped"/)
    assert.match(settlePath, /setInterruptionNoticeSessionId\(null\)/)
  })
})
