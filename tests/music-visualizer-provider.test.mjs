import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const providerSource = await readFile(new URL("../components/providers/music-provider.tsx", import.meta.url), "utf8")
const miniPlayerSource = await readFile(new URL("../components/providers/music-mini-player.tsx", import.meta.url), "utf8")
const musicWorkspaceSource = await readFile(new URL("../app/browse/workspace.tsx", import.meta.url), "utf8")
const stationCardSource = await readFile(new URL("../components/atmosphere/station-carousel-card.tsx", import.meta.url), "utf8")

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

  it("verifies the session before account sync and guards stale responses", () => {
    const syncStart = providerSource.indexOf("const syncVisualizerAccountPreferences")
    const syncSource = providerSource.slice(syncStart, providerSource.indexOf("// Keep the provider mounted", syncStart))
    const sessionRequest = syncSource.indexOf('"/api/auth/session"')
    const preferencesRequest = syncSource.indexOf('"/api/account/preferences"')
    assert.notEqual(syncStart, -1)
    assert.notEqual(sessionRequest, -1)
    assert.notEqual(preferencesRequest, -1)
    assert.ok(sessionRequest < preferencesRequest)
    assert.match(providerSource, /canSyncAccountPreferencesFromSession/)
    assert.match(providerSource, /normalizeMusicVisualizerAccountPreferences/)
    assert.match(providerSource, /accountRequestIdRef/)
    assert.match(providerSource, /appSettings:\s*{[\s\S]*musicVisualizer/)
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
    assert.match(miniPlayerSource, /variant=\{isPlayingOrLoading \? "destructive" : "success"\}/)
    assert.match(miniPlayerSource, /variant="attention"/)
    assert.match(miniPlayerSource, /TooltipProvider/)
    assert.match(miniPlayerSource, /ml-music-player-collapsed/)
    assert.match(miniPlayerSource, /data-testid="music-player-toolbar-controls"/)
    assert.doesNotMatch(toolbarActions, /\btitle=/)
    assert.equal((toolbarActions.match(/<TooltipContent>/g) ?? []).length, 7)
    for (const accessibleNamePattern of [
      /aria-label="Previous station"/,
      /aria-label=\{playStopLabel\}/,
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
  it("surfaces timeout failures as retryable account errors", () => {
    assert.match(providerSource, /function isAbortError[\s\S]*error\.name === "AbortError"/)
    assert.match(
      providerSource,
      /failedAccountPayloadRef\.current = payload[\s\S]*setAccountStatus\("error"\)[\s\S]*Try again/,
    )
    assert.match(
      providerSource,
      /setAccountStatus\("error"\)[\s\S]*preferences could not be loaded\. Try again/,
    )
  })
})
