import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const providerSource = await readFile(
  new URL("../components/providers/music-provider.tsx", import.meta.url),
  "utf8",
)

function sourceBetween(startMarker, endMarker) {
  const start = providerSource.indexOf(startMarker)
  const end = providerSource.indexOf(endMarker, start)
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`)
  return providerSource.slice(start, end)
}

describe("AtmoShaper provider ownership contract", () => {
  it("exposes source-aware identity and complete global transport actions", () => {
    for (const contract of [
      /export type MusicPlaybackKind = "station" \| "atmoshaper" \| null/,
      /activePlaybackKind: PlaybackKind/,
      /activeStationId: string \| null/,
      /canNavigateStations: boolean/,
      /atmoShaperSnapshot: AtmoShaperRuntimeSnapshot \| null/,
      /playAtmoShaper: \(recipe: AtmoShaperRecipe\) => Promise<void>/,
      /updateAtmoShaper: \(recipe: AtmoShaperRecipe\) => Promise<void>/,
      /retryAtmoShaperLayer: \(layerId: string\) => Promise<void>/,
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
      "const updateAtmoShaper = useCallback",
    )

    assert.match(stationPath, /disposeAtmoShaperRuntime\(\)/)
    assert.ok(
      stationPath.indexOf("disposeAtmoShaperRuntime()")
        < stationPath.indexOf("runtime.controller.start(station)"),
      "station playback must dispose AtmoShaper before its adapter starts",
    )
    assert.match(atmoPath, /runtimeRef\.current\?\.controller\.stopAndWait\(\)/)
    assert.ok(
      atmoPath.indexOf("runtimeRef.current?.controller.stopAndWait()")
        < atmoPath.indexOf('import("@/lib/atmoshaper/runtime")'),
      "AtmoShaper must begin awaited ordinary disposal before creating its runtime",
    )
    assert.ok(
      atmoPath.indexOf("await ordinaryStationDisposal")
        < atmoPath.indexOf('import("@/lib/atmoshaper/runtime")'),
      "AtmoShaper must finish ordinary disposal before creating its runtime",
    )
    assert.match(atmoPath, /sessionGeneration !== playbackSessionGenerationRef\.current/)
    assert.match(atmoPath, /runtimeLease !== atmoShaperRuntimeLeaseRef\.current/)
    assert.match(atmoPath, /settleSourceRuntimeStartup/)
    assert.match(atmoPath, /recipe:\s*atmoShaperRecipeRef\.current/)
    assert.match(atmoPath, /revision:\s*atmoShaperRecipeRevisionRef\.current/)
    assert.match(atmoPath, /desiredTransport:\s*atmoShaperDesiredTransportRef\.current/)
    assert.match(
      atmoPath,
      /recipe:\s*atmoShaperRecipeRef\.current \?\? snapshot\.recipe/,
      "startup callbacks must not republish a superseded captured recipe",
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
    assert.match(updatePath, /await runtime\.applyRecipe\(recipe\)/)
    assert.match(retryPath, /snapshot\.status === "failed"/)
    assert.match(
      retryPath,
      /await playAtmoShaper\(recipe\)/,
      "an all-failed retry must reacquire global playback and media ownership",
    )
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

  it("keeps ordinary station identity separate from AtmoShaper artwork identity", () => {
    const atmoPath = sourceBetween(
      "const playAtmoShaper = useCallback",
      "const updateAtmoShaper = useCallback",
    )
    assert.match(atmoPath, /setActivePlaybackKind\("atmoshaper"\)/)
    assert.match(atmoPath, /activeStationIdRef\.current = null/)
    assert.match(atmoPath, /setActiveStationId\(null\)/)
    assert.match(atmoPath, /stationId: `atmoshaper:\$\{recipe\.artworkSeed\}`/)
    assert.match(atmoPath, /groupId: "atmoshaper"/)
  })

  it("does not publish failed or stopped mixes as playing carrier sessions", () => {
    const mediaPath = sourceBetween("const publishMediaSession = useCallback", "const ensureInterruptionMonitor")
    const atmoPath = sourceBetween(
      "const playAtmoShaper = useCallback",
      "const updateAtmoShaper = useCallback",
    )
    const restartPath = sourceBetween("const restartCurrent = useCallback", "const stopCurrent = useCallback")
    const stopPath = sourceBetween("const stopCurrent = useCallback", "const handleInterruptionStarted = useCallback")

    assert.match(mediaPath, /state === "paused" \|\| state === "interrupted"/)
    assert.match(mediaPath, /state === "failed" \|\| state === "stopped"/)
    assert.match(mediaPath, /\? "none"\s*:\s*"playing"/)
    assert.match(atmoPath, /nextSnapshot\.status === "failed"[\s\S]*?stopAndDismiss\(\)[\s\S]*?publishMediaSession\([^,]+, "failed"\)/)
    assert.match(atmoPath, /snapshot\.status === "playing"[\s\S]*?else[\s\S]*?stopAndDismiss\(\)[\s\S]*?publishMediaSession\(latestMetadata, "failed"\)/)
    assert.match(restartPath, /snapshot\.status === "playing"[\s\S]*?else[\s\S]*?stopAndDismiss\(\)/)
    assert.match(stopPath, /mediaCarrierRef\.current\?\.stopAndDismiss\(\)/)
    assert.match(stopPath, /mediaSessionControllerRef\.current\?\.clear\(\)/)
  })
})
