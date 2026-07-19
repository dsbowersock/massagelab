import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const providerSource = await readFile(new URL("../components/providers/music-provider.tsx", import.meta.url), "utf8")
const miniPlayerSource = await readFile(new URL("../components/providers/music-mini-player.tsx", import.meta.url), "utf8")
const musicWorkspaceSource = await readFile(new URL("../app/browse/workspace.tsx", import.meta.url), "utf8")

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

  it("retains station identity when stopCurrent stops the runtime", () => {
    const start = providerSource.indexOf("const stopCurrent")
    const end = providerSource.indexOf("// Expose the active station", start)
    const stopCurrentSource = providerSource.slice(start, end)
    assert.notEqual(start, -1)
    assert.notEqual(end, -1)
    assert.doesNotMatch(stopCurrentSource, /setActiveStation(Id|Title|Artist)\(null\)/)
    for (const contract of [
      /playbackRequestIdRef\.current = requestId/,
      /controller\.stop\(\)/,
      /setPlaybackState\("stopped"\)/,
      /setLoadingProgress\(null\)/,
      /setLoadingStartedAt\(null\)/,
      /setError\(null\)/,
    ]) assert.match(stopCurrentSource, contract)
  })
})

describe("Persistent player visualizer boundary", () => {
  it("replaces visualizer history on minimize but pushes on entry", () => {
    const actionStart = miniPlayerSource.indexOf("const handleVisualizerAction")
    const actionSource = miniPlayerSource.slice(
      actionStart,
      miniPlayerSource.indexOf("useEffect", actionStart),
    )

    assert.notEqual(actionStart, -1)
    for (const contract of [
      /usePathname/, /useSearchParams/, /useRouter/, /buildMusicVisualizerHref/,
      /sanitizeMusicVisualizerReturnTo/, /Minimize visualizer/, /Background/,
    ]) assert.match(miniPlayerSource, contract)
    assert.match(
      actionSource,
      /router\.replace\(sanitizeMusicVisualizerReturnTo\(searchParams\.get\("returnTo"\)\)\)/,
    )
    assert.match(actionSource, /router\.push\(buildMusicVisualizerHref\(/)
    assert.doesNotMatch(
      actionSource,
      /router\.push\(sanitizeMusicVisualizerReturnTo/,
    )
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
