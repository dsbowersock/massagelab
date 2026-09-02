import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import * as accountPreferences from "../lib/account-preferences.js"
import * as musicVisualizer from "../lib/music-visualizer.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const providerSource = await readFile(new URL("../components/providers/music-provider.tsx", import.meta.url), "utf8")
const miniPlayerSource = await readFile(new URL("../components/providers/music-mini-player.tsx", import.meta.url), "utf8")
const musicWorkspaceSource = await readFile(new URL("../app/browse/workspace.tsx", import.meta.url), "utf8")
const stationCardSource = await readFile(new URL("../components/atmosphere/station-carousel-card.tsx", import.meta.url), "utf8")

/** Executes the provider's exact account-ownership effect body in an isolated scope. */
function loadProviderAccountOwnershipEffect() {
  const startMarker = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*if\s*\(\s*!storageHydrated\s*\)\s*\{/
  const startMatch = startMarker.exec(providerSource)
  assert.ok(startMatch, "Music provider account effect start marker missing")
  const bodyStart = providerSource.indexOf("{", startMatch.index) + 1
  const endMarker = /\}\s*,\s*\[\s*(?=[^\]]*\baccountIntentTracker\b)(?=[^\]]*\bbootstrapAppSettings\.musicVisualizer\b)(?=[^\]]*\bbootstrapStatus\b)(?=[^\]]*\bownerKey\b)(?=[^\]]*\bpersistVisualizerAccountPreferences\b)(?=[^\]]*\bstorageHydrated\b)(?=[^\]]*\bsyncEnabled\b)[^\]]*\]\s*\)/
  const endMatch = endMarker.exec(providerSource.slice(bodyStart))
  assert.ok(endMatch, "Music provider account effect dependency boundary missing")
  const effectBody = providerSource.slice(bodyStart, bodyStart + endMatch.index)

  return loadCompiledModule(`
    export function runProviderAccountOwnershipEffect(scope) {
      const {
        accountDefaultBackgroundIdRef,
        accountIntentTracker,
        accountPreferencesHydratedRef,
        accountRequestIdRef,
        accountSyncVerifiedRef,
        accountWritePendingRef,
        adoptedAccountOwnerRef,
        bootstrapAppSettings,
        bootstrapStatus,
        failedAccountPayloadRef,
        ownerKey,
        pendingAccountDefaultBackgroundIdRef,
        persistVisualizerAccountPreferences,
        setAccountDefaultBackgroundId,
        setAccountError,
        setAccountSignedIn,
        setAccountStatus,
        setStorageState,
        storageHydrated,
        syncEnabled,
      } = scope
${effectBody}
    }
  `, "components/providers/music-provider-account-ownership.test.ts")
}

describe("Music visualizer provider contract", () => {
  it("exposes visualizer state and actions through MusicContext", () => {
    for (const contract of [
      /interface MusicVisualizerState\s*{[\s\S]*backgroundId: string \| null/,
      /accountDefaultBackgroundId: string \| null/,
      /showClock: boolean/,
      /storageStatus: "loading" \| "available" \| "unavailable" \| "unsupported-version"/,
      /storageError: string \| null/,
      /accountStatus: "anonymous" \| "loading" \| "synced" \| "saving" \| "error"/,
      /accountError: string \| null/,
      /visualizer: MusicVisualizerState/,
      /selectVisualizerBackground: \(backgroundId: string\) => void/,
      /setVisualizerShowClock: \(showClock: boolean\) => void/,
      /setCurrentVisualizerBackgroundAsDefault: \(\) => Promise<void>/,
      /restoreVisualizerAccountDefault: \(\) => void/,
      /retryVisualizerAccountSync: \(\) => Promise<void>/,
    ]) assert.match(providerSource, contract)
  })

  it("hydrates all storage generations without overwriting future versions", () => {
    for (const contract of [
      /getItem\(ATMOSPHERE_STORAGE_KEY\)/,
      /getItem\(LEGACY_ATMOSPHERE_STORAGE_KEY\)/,
      /getItem\(BACKGROUND_STORAGE_KEYS\.music\)/,
      /legacyRawValue:/,
      /legacyBackgroundId:/,
      /unsupported-version/,
      /storageStatus !== "available"/,
    ]) assert.match(providerSource, contract)
  })

  it("consumes one owner-keyed shell bootstrap and its shared patch writer", () => {
    assert.doesNotMatch(providerSource, /\/api\/auth\/session/)
    assert.doesNotMatch(providerSource, /\/api\/account\/preferences/)
    assert.match(providerSource, /useAccountShellBootstrap/)
    assert.match(providerSource, /normalizeMusicVisualizerAccountPreferences/)
    assert.match(providerSource, /accountRequestIdRef/)
    assert.match(providerSource, /writeAppSettingsPatch\(\{ musicVisualizer: payload \}\)/)
  })

  it("adopts owner B only after clearing owner A transport and account state", () => {
    const { runProviderAccountOwnershipEffect } = loadProviderAccountOwnershipEffect()
    const accountIntentTracker = musicVisualizer.createMusicVisualizerAccountIntentTracker()
    accountIntentTracker.record({
      ownerKey: "owner-a",
      changes: { showClock: false },
      basePreferences: { defaultBackgroundId: "owner-a-default", showClock: true },
    })
    const state = {
      accountDefaultBackgroundIdRef: { current: "owner-a-default" },
      accountPreferencesHydratedRef: { current: true },
      accountRequestIdRef: { current: 7 },
      accountSyncVerifiedRef: { current: true },
      accountWritePendingRef: { current: { ownerKey: "owner-a", requestId: 7 } },
      adoptedAccountOwnerRef: { current: { ownerKey: "owner-a", syncEnabled: true } },
      failedAccountPayloadRef: {
        current: { defaultBackgroundId: "owner-a-failed", showClock: false },
      },
      pendingAccountDefaultBackgroundIdRef: { current: "owner-a-pending" },
      storageState: { visualizer: { backgroundId: null, showClock: false } },
    }
    const observed = {
      accountDefaultBackgroundIds: [],
      accountErrors: [],
      accountSignedIn: [],
      accountStatuses: [],
      persisted: [],
    }

    runProviderAccountOwnershipEffect({
      ...state,
      accountIntentTracker,
      bootstrapAppSettings: {
        musicVisualizer: { defaultBackgroundId: "owner-b-default", showClock: true },
      },
      bootstrapStatus: "ready",
      ownerKey: "owner-b",
      persistVisualizerAccountPreferences: async (preferences) => observed.persisted.push(preferences),
      setAccountDefaultBackgroundId: (value) => observed.accountDefaultBackgroundIds.push(value),
      setAccountError: (value) => observed.accountErrors.push(value),
      setAccountSignedIn: (value) => observed.accountSignedIn.push(value),
      setAccountStatus: (value) => observed.accountStatuses.push(value),
      setStorageState: (update) => {
        state.storageState = typeof update === "function" ? update(state.storageState) : update
      },
      storageHydrated: true,
      syncEnabled: true,
    })

    assert.deepEqual(state.adoptedAccountOwnerRef.current, { ownerKey: "owner-b", syncEnabled: true })
    assert.equal(state.accountRequestIdRef.current, 8)
    assert.equal(state.accountWritePendingRef.current, null)
    assert.equal(state.failedAccountPayloadRef.current, null)
    assert.equal(state.pendingAccountDefaultBackgroundIdRef.current, null)
    assert.equal(state.accountDefaultBackgroundIdRef.current, "owner-b-default")
    assert.equal(state.accountSyncVerifiedRef.current, true)
    assert.equal(state.accountPreferencesHydratedRef.current, true)
    assert.equal(accountIntentTracker.hasIntent("owner-a"), false)
    assert.deepEqual(observed.accountDefaultBackgroundIds, [null, "owner-b-default"])
    assert.deepEqual(observed.accountSignedIn, [false, true])
    assert.deepEqual(observed.accountStatuses, ["synced"])
    assert.deepEqual(observed.persisted, [])
    assert.equal(state.storageState.visualizer.showClock, true)
    assert.equal(musicVisualizer.shouldApplyMusicVisualizerAccountWriteCompletion({
      currentOwner: state.adoptedAccountOwnerRef.current,
      currentRequestId: state.accountRequestIdRef.current,
      isMounted: true,
      requestId: 7,
      requestOwnerKey: "owner-a",
    }), false)

    // Keep only the provider-to-tested-helper anchors; reset semantics are behavioral above.
    assert.match(providerSource, /accountIntentTracker\.reconcile/)
    assert.match(providerSource, /shouldApplyMusicVisualizerAccountWriteCompletion\(\{/)
  })

  it("admits only the exact mounted, sync-enabled owner and request generation", () => {
    const current = {
      currentOwner: { ownerKey: "owner-a", syncEnabled: true },
      currentRequestId: 7,
      isMounted: true,
      requestId: 7,
      requestOwnerKey: "owner-a",
    }
    const cases = [
      { label: "exact current write", input: {}, expected: true },
      {
        label: "owner mismatch",
        input: { currentOwner: { ownerKey: "owner-b", syncEnabled: true } },
        expected: false,
      },
      { label: "request generation mismatch", input: { currentRequestId: 8 }, expected: false },
      { label: "unmounted provider", input: { isMounted: false }, expected: false },
      {
        label: "sync-disabled owner",
        input: { currentOwner: { ownerKey: "owner-a", syncEnabled: false } },
        expected: false,
      },
      {
        label: "ownerless completion",
        input: { currentOwner: null, requestOwnerKey: undefined },
        expected: false,
      },
    ]

    for (const { label, input, expected } of cases) {
      assert.equal(
        musicVisualizer.shouldApplyMusicVisualizerAccountWriteCompletion({ ...current, ...input }),
        expected,
        label,
      )
    }
  })

  it("serializes active saves and collapses queued work to the latest snapshot", { timeout: 2_000 }, async () => {
    assert.equal(
      typeof accountPreferences.createSerializedPreferenceWriter,
      "function",
      "account preferences must expose a provider-neutral serialized writer",
    )
    const deferred = []
    const sentRequestIds = []
    let markSecondSendStarted
    const secondSendStarted = new Promise((resolve) => { markSecondSendStarted = resolve })
    const writer = accountPreferences.createSerializedPreferenceWriter({
      send: (request) => {
        sentRequestIds.push(request.requestId)
        if (sentRequestIds.length === 2) markSecondSendStarted()
        return new Promise((resolve) => deferred.push(resolve))
      },
    })

    writer.enqueue({ requestBody: "first", requestId: 1 })
    writer.enqueue({ requestBody: "superseded", requestId: 2 })
    writer.enqueue({ requestBody: "latest", requestId: 3 })
    assert.deepEqual(sentRequestIds, [1])

    deferred.shift()(true)
    await secondSendStarted
    assert.deepEqual(sentRequestIds, [1, 3])
    deferred.shift()(true)
    await writer.whenIdle()
  })

  it("reconciles pre-ready local intent into a delayed bootstrap projection", () => {
    assert.equal(
      typeof musicVisualizer.createMusicVisualizerAccountIntentTracker,
      "function",
      "Music account sync must expose one owner-scoped intent lifecycle",
    )
    assert.match(providerSource, /accountIntentTracker\.record/)
    assert.match(providerSource, /accountIntentTracker\.reconcile/)
    assert.match(providerSource, /accountIntentTracker\.confirm/)
    const tracker = musicVisualizer.createMusicVisualizerAccountIntentTracker()

    const intent = tracker.record({
      ownerKey: "owner-a",
      changes: { showClock: true },
    })
    const resolution = tracker.reconcile({
      ownerKey: "owner-a",
      projection: { defaultBackgroundId: "server-background", showClock: false },
    })

    assert.equal(intent.revision, 1)
    assert.equal(intent.preferences, null)
    assert.deepEqual(resolution, {
      status: "repersist",
      revision: 1,
      preferences: { defaultBackgroundId: "server-background", showClock: true },
    })
  })

  it("projects an owned default background without reading inherited unrelated fields", () => {
    for (const [defaultBackgroundId, expectedBackgroundId] of [
      ["  trimmed-background  ", "trimmed-background"],
      ["   ", null],
    ]) {
      const changes = Object.create(Object.defineProperty({}, "showClock", {
        get() {
          throw new Error("unrelated inherited showClock must not be read")
        },
      }))
      Object.defineProperty(changes, "defaultBackgroundId", {
        value: defaultBackgroundId,
        enumerable: true,
      })
      const tracker = musicVisualizer.createMusicVisualizerAccountIntentTracker()

      const intent = tracker.record({
        ownerKey: "owner-a",
        changes,
        basePreferences: { defaultBackgroundId: "server-background", showClock: true },
      })

      assert.deepEqual(intent.preferences, {
        defaultBackgroundId: expectedBackgroundId,
        showClock: true,
      })
    }
  })

  it("keeps completed local intent over stale same-owner bootstrap until acknowledgement", () => {
    const tracker = musicVisualizer.createMusicVisualizerAccountIntentTracker()
    const intent = tracker.record({
      ownerKey: "owner-a",
      changes: { showClock: true },
      basePreferences: { defaultBackgroundId: "server-background", showClock: false },
    })
    tracker.confirm({
      ownerKey: "owner-a",
      preferences: intent.preferences,
    })

    assert.deepEqual(tracker.reconcile({
      ownerKey: "owner-a",
      projection: { defaultBackgroundId: "server-background", showClock: false },
    }), {
      status: "repersist",
      revision: 1,
      preferences: { defaultBackgroundId: "server-background", showClock: true },
    })
    assert.deepEqual(tracker.reconcile({
      ownerKey: "owner-a",
      projection: { defaultBackgroundId: "server-background", showClock: true },
    }), {
      status: "adopt",
      revision: 1,
      preferences: { defaultBackgroundId: "server-background", showClock: true },
    })
    assert.equal(tracker.hasIntent("owner-a"), false)
  })

  it("retries the exact failed write before delegating a failed bootstrap retry", () => {
    const retryStart = providerSource.indexOf("const retryVisualizerAccountSync")
    assert.notEqual(retryStart, -1, "retryVisualizerAccountSync anchor missing")
    const retryEnd = providerSource.indexOf("const getPlaybackDiagnostics", retryStart)
    assert.notEqual(retryEnd, -1, "getPlaybackDiagnostics anchor missing")
    const retrySource = providerSource.slice(retryStart, retryEnd)
    assert.match(
      retrySource,
      /failedAccountPayloadRef\.current[\s\S]*persistVisualizerAccountPreferences\(failedPayload\)[\s\S]*return/,
    )
    assert.match(retrySource, /bootstrapStatus === "failed"[\s\S]*retryFallback\(\)/)
  })

  it("carries a pending default through a newer show-clock save", () => {
    assert.match(providerSource, /pendingAccountDefaultBackgroundIdRef/)
    assert.match(
      providerSource,
      /defaultBackgroundId:\s*pendingAccountDefaultBackgroundIdRef\.current[\s\S]*\?\? accountDefaultBackgroundIdRef\.current/,
    )
    assert.match(
      providerSource,
      /pendingAccountDefaultBackgroundIdRef\.current = backgroundId[\s\S]*await persistVisualizerAccountPreferences/,
    )
  })

  it("mirrors committed storage state without side effects in state updaters", () => {
    assert.match(
      providerSource,
      /useEffect\(\(\) => \{\s*storageStateRef\.current = storageState\s*\}, \[storageState\]\)/,
    )
    assert.equal((providerSource.match(/storageStateRef\.current =/g) ?? []).length, 2)
  })

  it("retains stopped identity synchronously and guards its 60-second retirement", () => {
    const start = providerSource.indexOf("const stopCurrent = useCallback")
    const end = providerSource.indexOf("const handleInterruptionStarted", start)
    const stopCurrentSource = providerSource.slice(start, end)
    assert.notEqual(start, -1)
    assert.notEqual(end, -1)
    assert.match(providerSource, /const STOPPED_PLAYER_RETENTION_MS = 60_000/)
    assert.doesNotMatch(stopCurrentSource, /setActiveStation(Id|Title|Artwork)\(null\)/)
    for (const contract of [
      /playbackRequestIdRef\.current = requestId/,
      /const sessionGeneration = playbackSessionGenerationRef\.current/,
      /const stoppedStationId = activeStationIdRef\.current/,
      /controller\.stop\(\)/,
      /EXPLICIT_STOP/,
      /stopAndDismiss\(\)/,
      /mediaSessionControllerRef\.current\?\.clear\(\)/,
      /setLoadingProgress\(null\)/,
      /setLoadingStartedAt\(null\)/,
      /setError\(null\)/,
    ]) assert.match(stopCurrentSource, contract)

    const retirementStart = providerSource.indexOf("const retireStoppedPlayer = useCallback")
    const retirementEnd = providerSource.indexOf("\n  }, [])", retirementStart) + "\n  }, [])".length
    const retirementSource = providerSource.slice(retirementStart, retirementEnd)
    assert.notEqual(retirementStart, -1)
    assert.notEqual(retirementEnd, -1)
    for (const contract of [
      /sessionGeneration !== playbackSessionGenerationRef\.current/,
      /playbackLifecycleRef\.current\.status !== "stopped"/,
      /activeStationIdRef\.current !== stoppedStationId/,
      /activeStationIdRef\.current = null/,
      /activeStationMetadataRef\.current = null/,
      /activeStationArtworkRef\.current = null/,
      /setActiveStationId\(null\)/,
      /setActiveStationTitle\(null\)/,
      /setActiveStationArtwork\(null\)/,
    ]) assert.match(retirementSource, contract)
    assert.doesNotMatch(retirementSource, /controller\.(?:start|stop)|publishMediaSession|commitPlaybackLifecycle|setStorageState/)
    assert.equal((providerSource.match(/window\.setTimeout/g) ?? []).length, 1)
    assert.equal((providerSource.match(/scheduleStoppedPlayerRetirement\(/g) ?? []).length, 1)
    assert.match(providerSource, /const playStation = useCallback\(async \([\s\S]*?\) => \{\s*cancelStoppedPlayerRetirement\(\)/)
    assert.match(providerSource, /const playAdjacentStation = useCallback\(async \(direction: 1 \| -1\) => \{\s*cancelStoppedPlayerRetirement\(\)/)
    assert.match(providerSource, /const navigationRequestId = playbackRequestIdRef\.current/)
    assert.match(providerSource, /navigationRequestId !== playbackRequestIdRef\.current/)
    assert.match(providerSource, /navigationSessionGeneration !== playbackSessionGenerationRef\.current/)
    assert.match(providerSource, /useEffect\(\(\) => \(\) => \{\s*cancelStoppedPlayerRetirement\(\)/)
  })

  it("starts the generator independently from guarded carrier settlement", () => {
    assert.match(providerSource, /const carrierStartPromise[\s\S]*const runtime = await getRuntime\(\)/)
    assert.match(providerSource, /void carrierStartPromise[\s\S]*settleMediaIntegrationAvailability/)
    assert.match(providerSource, /const runtimeResult = await runtime\.controller\.start\(station\)/)
    assert.doesNotMatch(providerSource, /await Promise\.all\(\[\s*carrierStartPromise,\s*runtimePromise/)
  })

  it("publishes retryable runtime readiness before the centered Play action", () => {
    for (const contract of [
      /type RuntimeReadinessState = {[\s\S]*status: "idle" \| "preparing" \| "ready" \| "error"/,
      /runtimeReadiness: RuntimeReadinessState/,
      /setRuntimeReadiness\({ status: "preparing", error: null }\)/,
      /setRuntimeReadiness\({ status: "ready", error: null }\)/,
      /setRuntimeReadiness\({ status: "error", error: "Audio setup failed\. Try again\." }\)/,
      /const retryRuntimeReadiness = useCallback\(\(\) => {[\s\S]*window\.location\.reload\(\)/,
    ]) assert.match(providerSource, contract)
    assert.doesNotMatch(
      providerSource,
      /catch\(\(caughtError\) => {\s*runtimeLoadPromiseRef\.current = null/,
      "failed runtime readiness must stay latched until the explicit page reload",
    )

    for (const contract of [
      /music\.runtimeReadiness\.status === "preparing"/,
      /Preparing audio for \$\{station\.title\}/,
      /Retry audio setup/,
      /music\.retryRuntimeReadiness\(\)/,
      /role="status"[\s\S]*aria-live="polite"[\s\S]*Preparing audio/,
    ]) assert.match(stationCardSource, contract)
  })

  it("transports canonical active artwork without bundling the full station catalog", () => {
    for (const source of [providerSource, miniPlayerSource]) {
      assert.doesNotMatch(source, /from\s+["']@\/lib\/atmosphere\/stations(?:\.js)?["']/)
    }
    for (const contract of [
      /activeStationArtwork: AtmosphereStationArtworkInput \| null/,
      /artworkInput\?: AtmosphereStationArtworkInput/,
      /setActiveStationArtwork\(/,
      /resolveAtmosphereStationArtworkInput\(nextStation\)/,
      /resolvedSuppliedArtwork\?\.stationId === stationId/,
    ]) assert.match(providerSource, contract)
    assert.match(stationCardSource, /artworkInput:\s*stationArtworkInput/)
    assert.match(miniPlayerSource, /artworkInput=\{music\.activeStationArtwork\}/)
  })
})

describe("Persistent player visualizer boundary", () => {
  it("uses one icon-only leaf toolbar without horizontal scrolling", () => {
    const toolbarActions = miniPlayerSource.slice(
      miniPlayerSource.indexOf("const previousAction"),
      miniPlayerSource.indexOf("  return (", miniPlayerSource.indexOf("const previousAction")),
    )

    assert.doesNotMatch(miniPlayerSource, /RefreshCw|Restart|overflow-x-auto/)
    assert.match(miniPlayerSource, /variant=\{isPlaying \? "glow" : "success"\}/)
    assert.match(miniPlayerSource, /variant="destructive"/)
    assert.match(miniPlayerSource, /variant="attention"/)
    assert.match(miniPlayerSource, /TooltipProvider/)
    assert.match(miniPlayerSource, /ml-music-player-collapsed/)
    assert.match(miniPlayerSource, /data-testid="music-player-toolbar-controls"/)
    assert.doesNotMatch(toolbarActions, /\btitle=/)
    assert.equal((toolbarActions.match(/<TooltipContent>/g) ?? []).length, 8)
    for (const accessibleNamePattern of [
      /aria-label="Previous station"/,
      /aria-label=\{playPauseLabel\}/,
      /aria-label=\{isLoading \? "Cancel loading" : "Stop"\}/,
      /aria-label="Next station"/,
      /aria-label=\{visualizerActionLabel\}/,
      /aria-label="Player settings"/,
      /aria-label="Minimize"/,
      /aria-label="Expand"/,
    ]) {
      assert.match(toolbarActions, accessibleNamePattern)
    }
  })

  it("replaces visualizer history on minimize but pushes on entry", () => {
    for (const contract of [
      /usePathname/, /useSearchParams/, /buildMusicVisualizerHref/,
      /sanitizeMusicVisualizerReturnTo/, /Minimize visualizer/, /Background/,
    ]) assert.match(miniPlayerSource, contract)
    assert.match(
      miniPlayerSource,
      /const visualizerHref = isMusicVisualizerRoute[\s\S]*sanitizeMusicVisualizerReturnTo\(searchParams\.get\("returnTo"\)\)[\s\S]*buildMusicVisualizerHref\(/,
    )
    assert.match(miniPlayerSource, /<Link[\s\S]*href=\{visualizerHref\}[\s\S]*replace=\{isMusicVisualizerRoute\}/)
    assert.match(miniPlayerSource, /data-visual-draft-navigation-mode=\{isMusicVisualizerRoute \? "replace" : undefined\}/)
    assert.doesNotMatch(miniPlayerSource, /router\.(?:push|replace)/)
    assert.doesNotMatch(miniPlayerSource, /backgroundRegistry/)
  })

  it("keeps background rendering and legacy writes out of Music discovery", () => {
    assert.doesNotMatch(musicWorkspaceSource, /BackgroundHost|BackgroundSelector|BACKGROUND_STORAGE_KEYS|localStorage/)
  })
})

describe("Music visualizer account timeout boundary", () => {
  it("surfaces failed writes as retryable account errors", () => {
    assert.match(providerSource, /const succeeded = await writeAppSettingsPatch/)
    assert.match(
      providerSource,
      /failedAccountPayloadRef\.current = payload[\s\S]*setAccountStatus\("error"\)[\s\S]*Try again/,
    )
  })
})
