import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const playerSource = await readFile(
  new URL("../components/providers/music-mini-player.tsx", import.meta.url),
  "utf8",
)

function sourceBetween(startMarker, endMarker) {
  const start = playerSource.indexOf(startMarker)
  const end = playerSource.indexOf(endMarker, start)
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`)
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`)
  return playerSource.slice(start, end)
}

describe("persistent music player source ownership", () => {
  it("keeps one player visible for either source identity, including stopped mixes", () => {
    assert.match(playerSource, /const hasPlaybackIdentity = music\.activePlaybackKind !== null/)
    assert.match(playerSource, /const showPlayer = hasPlaybackIdentity/)
    assert.doesNotMatch(playerSource, /showPlayer = .*activeStationId|showPlayer = .*playbackState/)
    assert.doesNotMatch(playerSource, /const hasStation = Boolean\(music\.activeStationId\)/)
    assert.match(playerSource, /disabled=\{isLoading \|\| !hasPlaybackIdentity\}/)
  })

  it("routes Play and Pause through generic transport while keeping Stop cancellable", () => {
    const playPausePath = sourceBetween("function handlePlayPause()", "const favoriteAction")

    assert.match(playPausePath, /music\.playbackState === "playing"/)
    assert.match(playPausePath, /music\.pauseCurrent\(\)/)
    assert.match(playPausePath, /music\.playbackState !== "loading"/)
    assert.match(playPausePath, /music\.restartCurrent\(\)/)
    assert.doesNotMatch(playPausePath, /playStation|stopCurrent/)

    assert.match(playerSource, /aria-label=\{isLoading \? "Cancel loading" : "Stop"\}/)
    assert.match(playerSource, /disabled=\{music\.playbackState === "stopped"\}/)
    assert.match(playerSource, /onClick=\{\(\) => void music\.stopCurrent\(\)\}/)
  })

  it("keeps station-only actions behind navigation capability", () => {
    assert.match(
      playerSource,
      /const favoriteAction = music\.canNavigateStations && music\.activeStationId \? \(/,
    )
    assert.match(playerSource, /const previousAction = music\.canNavigateStations \? \(/)
    assert.match(playerSource, /const nextAction = music\.canNavigateStations \? \(/)
  })

  it("retains the existing shell features without adding mix-layer controls", () => {
    for (const contract of [
      /StationVinyl/,
      /MusicLoadingProgress/,
      /MusicInterruptionNotice/,
      /Atmosphere volume/,
      /setMiniPlayerCollapsed/,
      /visualizerHref/,
      /ml-music-player-toolbar/,
    ]) assert.match(playerSource, contract)

    assert.doesNotMatch(playerSource, /retryAtmoShaperLayer|updateAtmoShaper|AtmoShaper layer/)
  })
})
