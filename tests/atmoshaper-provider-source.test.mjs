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
    assert.match(atmoPath, /runtimeRef\.current\?\.controller\.stop\(\)/)
    assert.ok(
      atmoPath.indexOf("runtimeRef.current?.controller.stop()")
        < atmoPath.indexOf('import("@/lib/atmoshaper/runtime")'),
      "AtmoShaper must stop ordinary playback before creating its runtime",
    )
    assert.match(atmoPath, /requestId !== playbackRequestIdRef\.current/)
    assert.match(atmoPath, /runtimeLease !== atmoShaperRuntimeLeaseRef\.current/)
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
    assert.match(updatePath, /if \(activePlaybackKindRef\.current !== "atmoshaper"\) return/)
    assert.match(updatePath, /await runtime\.applyRecipe\(recipe\)/)
    assert.match(retryPath, /snapshot\.status === "failed"/)
    assert.match(
      retryPath,
      /await playAtmoShaper\(recipe\)/,
      "an all-failed retry must reacquire global playback and media ownership",
    )
    assert.match(stopPath, /await disposeAtmoShaperRuntime\(\)/)
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
})
