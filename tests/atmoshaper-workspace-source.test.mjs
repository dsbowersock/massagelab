import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const componentUrls = {
  controls: new URL("../components/atmoshaper/brainwave-layer-controls.tsx", import.meta.url),
  hook: new URL("../components/atmoshaper/use-atmoshaper-recipe.ts", import.meta.url),
  library: new URL("../components/atmoshaper/sound-library.tsx", import.meta.url),
  mix: new URL("../components/atmoshaper/current-mix.tsx", import.meta.url),
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

const [controlsSource, hookSource, librarySource, mixSource, workspaceSource] = await Promise.all([
  readSource(componentUrls.controls),
  readSource(componentUrls.hook),
  readSource(componentUrls.library),
  readSource(componentUrls.mix),
  readSource(componentUrls.workspace),
])
const packageSource = [controlsSource, hookSource, librarySource, mixSource, workspaceSource].join("\n")

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
    assert.match(librarySource, /Ambient sound library is being prepared/)
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
    assert.match(librarySource, /addLayer\(createStationLayer/)
    assert.doesNotMatch(
      librarySource,
      /currentStationLayer\.sourceId !== station\.id/,
      "customized station replacement needs confirmation even when the selected source is unchanged",
    )
  })

  it("renders ordered layer controls and source-aware transport", () => {
    for (const contract of [
      /recipe\.layers\.map/,
      /Volume for/,
      /aria-pressed=\{layer\.muted\}/,
      /Move earlier/,
      /Move later/,
      /Retry/,
      /Remove/,
      /Play AtmoShaper/,
      /Pause AtmoShaper/,
      /Stop AtmoShaper/,
      /AtmoShaper master volume/,
      /music\.retryAtmoShaperLayer/,
      /music\.restartCurrent/,
      /music\.playAtmoShaper\(recipe\)/,
      /music\.pauseCurrent/,
      /music\.stopCurrent/,
      /projectRetainedAtmoShaperLayers/,
      /restoreRetainedLayer/,
      /removeRetainedLayer/,
    ]) assert.match(mixSource, contract)

    assert.match(mixSource, /disabled=\{recipe\.layers\.length === 0\}/)
    assert.match(mixSource, /min=\{0\}/)
    assert.match(mixSource, /max=\{1\}/)
    assert.match(mixSource, /step=\{0\.05\}/)
    assert.match(mixSource, /Still playing during replacement/)
  })

  it("restores focus after removal through stable row refs", () => {
    assert.match(mixSource, /focusTargetAfterAtmoShaperVisibleRowRemoval/)
    assert.match(mixSource, /useLayoutEffect/)
    assert.match(mixSource, /rowRefs/)
    assert.match(mixSource, /headingRef/)
    assert.match(mixSource, /tabIndex=\{-1\}/)
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
    assert.match(workspaceSource, /Layer failed/)
    assert.doesNotMatch(controlsSource, /aria-live/)
    assert.doesNotMatch(mixSource, /aria-live/)
  })

  it("gives honest brainwave guidance without health claims or persistence UI", () => {
    assert.match(librarySource, /headphones/i)
    assert.match(librarySource, /intentionally pulsing/i)
    assert.doesNotMatch(packageSource, /treat|therap|diagnos|cognitive|brain health|sleep treatment/i)
    assert.doesNotMatch(packageSource, /Save As|My Mixes|Paywall|Supporter|purchase|checkout/i)
  })
})
