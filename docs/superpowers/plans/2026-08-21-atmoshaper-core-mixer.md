# AtmoShaper Core Mixer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AtmoShaper “Coming soon” state with a free, responsive mixer that can layer generated noise, one optional existing Atmosphere station, one binaural tone, and one isochronic tone, while continuing to use MassageLab's single global player and playback lifecycle.

**Architecture:** Add a pure versioned recipe domain and a browser-only adapter-based mix controller. `MusicProvider` remains the only global playback owner and lazily loads the AtmoShaper runtime. The workspace edits a live-session recipe; it does not persist or unlock saved mixes in this phase. The existing category remains “Coming soon” until the final integration task, so intermediate commits do not expose an incomplete product.

**Tech Stack:** Next.js 16, React 19, TypeScript/JSDoc, Tone.js, Radix/shadcn controls, Node test runner, Playwright, CSS container/media queries.

**Spec:** `docs/superpowers/specs/2026-08-21-atmoshaper-design.md`

## Global Constraints

- This plan is package 1 of the approved design. Follow-up plans own: (a) the Moodist-first 84-concept catalog and production media pipeline, (b) guest/account saved mixes and Supporter recall, and (c) $1 permanent-slot commerce. Do not implement those systems here.
- Anyone can build and play the core mix without signing in or paying.
- A mix may have any number of generated noise layers, no more than one station foundation, no more than one binaural layer, and no more than one isochronic layer. The station is optional.
- Starting AtmoShaper replaces an ordinary station; starting an ordinary station replaces AtmoShaper. Never create a second global player.
- Keep heavy audio code behind the existing dynamic runtime boundary. Do not add static Tone, generator-piece, or sample imports to `music-provider.tsx` or UI components.
- Editing a stopped recipe must not make sound. Adding, removing, muting, or changing a layer during playback must use bounded ramps and must not restart healthy unchanged layers.
- One failed layer must not stop healthy layers. Preserve the recipe and expose Retry, Replace, or Remove.
- Use viewport/workspace geometry and CSS capabilities only. Do not branch on device names, user agents, or browser zoom.
- Use neutral experiential copy. Do not make medical, therapeutic, cognitive-performance, or sleep-treatment claims.
- Add focused JSDoc for every non-obvious shared helper, controller contract, and audio-bound rule.
- No provider catalog creation, production media publishing, Stripe mutation, deployment, or production enablement is authorized by this plan.

---

## Task 1: Build the versioned recipe domain

**Files:**

- Create: `lib/atmoshaper/recipe.js`
- Create: `tests/atmoshaper-recipe.test.mjs`

- [ ] **Step 1: Write failing recipe tests**

Cover all core invariants in `tests/atmoshaper-recipe.test.mjs`:

```js
import test from "node:test"
import assert from "node:assert/strict"
import {
  ATMOSHAPER_PRESETS,
  addAtmoShaperLayer,
  createAtmoShaperRecipe,
  moveAtmoShaperLayer,
  normalizeAtmoShaperRecipe,
  removeAtmoShaperLayer,
  updateAtmoShaperLayer,
} from "../lib/atmoshaper/recipe.js"

test("a single sound is a valid mix and exclusive layer kinds replace their predecessor", () => {
  let recipe = createAtmoShaperRecipe({ id: "mix-1", name: "My atmosphere" })
  recipe = addAtmoShaperLayer(recipe, {
    id: "noise-1",
    kind: "noise",
    sourceId: "noise:pink",
    volume: 0.7,
    muted: false,
    settings: { color: "pink" },
  })
  assert.equal(recipe.layers.length, 1)

  recipe = addAtmoShaperLayer(recipe, stationLayer("station-a", "station:trees"))
  recipe = addAtmoShaperLayer(recipe, stationLayer("station-b", "station:peace"))
  assert.deepEqual(
    recipe.layers.filter(({ kind }) => kind === "station").map(({ sourceId }) => sourceId),
    ["station:peace"],
  )
})

test("normalization rejects unsupported versions and clamps unsafe values", () => {
  assert.throws(
    () => normalizeAtmoShaperRecipe({ version: 99, id: "future", name: "Future", layers: [] }),
    /unsupported AtmoShaper recipe version/i,
  )
  const normalized = normalizeAtmoShaperRecipe({
    version: 1,
    id: "mix-2",
    name: "Bounds",
    layers: [{
      id: "brainwave",
      kind: "binaural",
      sourceId: "binaural:advanced",
      volume: 4,
      muted: false,
      settings: { carrierHz: 4_000, beatHz: -2 },
    }],
  })
  assert.equal(normalized.layers[0].volume, 1)
  assert.deepEqual(normalized.layers[0].settings, { carrierHz: 600, beatHz: 0.5 })
})

test("updates, removal, and ordering are immutable", () => {
  const original = addAtmoShaperLayer(
    addAtmoShaperLayer(createAtmoShaperRecipe({ id: "mix-3", name: "Order" }), noiseLayer("a")),
    noiseLayer("b"),
  )
  const updated = updateAtmoShaperLayer(original, "a", { volume: 0.25 })
  const moved = moveAtmoShaperLayer(updated, "b", 0)
  const removed = removeAtmoShaperLayer(moved, "a")
  assert.equal(original.layers[0].volume, 1)
  assert.deepEqual(moved.layers.map(({ id }) => id), ["b", "a"])
  assert.deepEqual(removed.layers.map(({ id }) => id), ["b"])
})

test("all named brainwave presets stay inside the documented safe bounds", () => {
  assert.deepEqual(Object.keys(ATMOSHAPER_PRESETS), ["delta", "theta", "alpha", "beta", "gamma"])
  for (const preset of Object.values(ATMOSHAPER_PRESETS)) {
    assert.ok(preset.carrierHz >= 80 && preset.carrierHz <= 600)
    assert.ok(preset.rateHz >= 0.5 && preset.rateHz <= 50)
  }
})
```

Add small `noiseLayer` and `stationLayer` test factories in the test file; do not export test fixtures from production code.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/atmoshaper-recipe.test.mjs`

Expected: FAIL because `lib/atmoshaper/recipe.js` does not exist.

- [ ] **Step 3: Implement the recipe API and bounds**

Create `lib/atmoshaper/recipe.js` with these public constants and functions:

```js
export const ATMOSHAPER_RECIPE_VERSION = 1
export const ATMOSHAPER_LAYER_KINDS = Object.freeze([
  "ambient",
  "noise",
  "station",
  "binaural",
  "isochronic",
])
export const ATMOSHAPER_EXCLUSIVE_KINDS = new Set(["station", "binaural", "isochronic"])
export const ATMOSHAPER_FREQUENCY_BOUNDS = Object.freeze({
  carrierHz: { min: 80, max: 600 },
  rateHz: { min: 0.5, max: 50 },
})
export const ATMOSHAPER_PRESETS = Object.freeze({
  delta: Object.freeze({ carrierHz: 180, rateHz: 2 }),
  theta: Object.freeze({ carrierHz: 200, rateHz: 6 }),
  alpha: Object.freeze({ carrierHz: 220, rateHz: 10 }),
  beta: Object.freeze({ carrierHz: 240, rateHz: 18 }),
  gamma: Object.freeze({ carrierHz: 260, rateHz: 40 }),
})

/** Creates a normalized live-session recipe without starting audio. */
export function createAtmoShaperRecipe({ id, name = "AtmoShaper" }) {
  return normalizeAtmoShaperRecipe({
    version: ATMOSHAPER_RECIPE_VERSION,
    id,
    name,
    artworkSeed: id,
    layers: [],
  })
}

export function addAtmoShaperLayer(recipe, layer) {
  const normalized = normalizeLayer(layer)
  const retained = ATMOSHAPER_EXCLUSIVE_KINDS.has(normalized.kind)
    ? recipe.layers.filter(({ kind }) => kind !== normalized.kind)
    : recipe.layers
  return normalizeAtmoShaperRecipe({ ...recipe, layers: [...retained, normalized] })
}

export function updateAtmoShaperLayer(recipe, layerId, patch) {
  return normalizeAtmoShaperRecipe({
    ...recipe,
    layers: recipe.layers.map((layer) => (
      layer.id === layerId ? normalizeLayer({ ...layer, ...patch, id: layer.id }) : layer
    )),
  })
}
```

Implement `normalizeAtmoShaperRecipe`, `removeAtmoShaperLayer`, and `moveAtmoShaperLayer` with immutable returns. Reject duplicate layer ids, blank ids, blank names, unknown kinds, malformed settings, and recipe versions other than `1`. Clamp volume to `0..1`, carrier to `80..600 Hz`, and beat/pulse rate to `0.5..50 Hz`. Preserve array order. Use `structuredClone`-safe plain data only.

- [ ] **Step 4: Run recipe tests and the full Node suite**

Run:

```powershell
node --test tests/atmoshaper-recipe.test.mjs
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/atmoshaper/recipe.js tests/atmoshaper-recipe.test.mjs
git commit -m "feat(atmoshaper): define mix recipes"
```

---

## Task 2: Implement the adapter-based mix controller

**Files:**

- Create: `lib/atmoshaper/mix-controller.js`
- Create: `tests/atmoshaper-mix-controller.test.mjs`

- [ ] **Step 1: Write controller contract tests with fake adapters**

The tests must prove:

1. `start(recipe)` prepares and fades in each layer through `createAdapter(layer)`.
2. `applyRecipe(nextRecipe)` updates retained handles, fades out removed handles, and prepares only added layers.
3. One rejected adapter produces a failed layer snapshot while healthy layers keep playing.
4. A replacement exclusive layer is prepared before the working predecessor fades out.
5. `stop()` and `dispose()` clean every handle, including a handle that resolves after cancellation.
6. Stale asynchronous starts cannot publish `playing` after a newer request.

Use this fake-handle surface in tests:

```js
function createFakeHandle(log, layer) {
  return {
    async fadeIn() { log.push(["fadeIn", layer.id]) },
    async update(nextLayer) { log.push(["update", layer.id, nextLayer.volume]) },
    async pause() { log.push(["pause", layer.id]) },
    async resume() { log.push(["resume", layer.id]) },
    async fadeOutAndDispose() { log.push(["dispose", layer.id]) },
  }
}
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/atmoshaper-mix-controller.test.mjs`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the controller**

Export the following factory and snapshot contract:

```js
/**
 * Coordinates independently failing layer adapters behind one request lease.
 * Recipe equality is determined by stable layer ids; callers own normalization.
 */
export function createAtmoShaperMixController({ createAdapter, onSnapshot = () => undefined }) {
  let requestId = 0
  let disposed = false
  let status = "stopped"
  let recipe = null
  const handles = new Map()
  const layerStates = new Map()

  function publish() {
    onSnapshot({
      status,
      recipe,
      layers: Object.fromEntries(layerStates),
    })
  }

  async function start(nextRecipe) {
    const lease = ++requestId
    recipe = nextRecipe
    status = "loading"
    publish()
    await reconcile(nextRecipe, lease, true)
    if (lease !== requestId || disposed) return
    status = [...layerStates.values()].some(({ status: layerStatus }) => layerStatus === "playing")
      ? "playing"
      : "failed"
    publish()
  }

  return {
    start,
    applyRecipe,
    pause,
    resume,
    stop,
    dispose,
    getSnapshot: () => ({ status, recipe, layers: Object.fromEntries(layerStates) }),
  }
}
```

Implement the named inner methods. `reconcile` must use stable layer ids, prepare replacements before disposing the old exclusive-kind handle, catch failures per layer, and immediately dispose any handle that arrives for a stale lease. `applyRecipe` must only produce sound when controller status is `loading`, `playing`, or `paused`; stopped edits update the recipe and publish without creating adapters. `pause`/`resume` isolate handle errors and update only the affected layer state. `stop` invalidates the lease, fades/disposes all handles, clears runtime handles, retains the recipe, and publishes `stopped`. `dispose` additionally prevents later reuse.

- [ ] **Step 4: Run focused and full Node tests**

Run:

```powershell
node --test tests/atmoshaper-mix-controller.test.mjs
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/atmoshaper/mix-controller.js tests/atmoshaper-mix-controller.test.mjs
git commit -m "feat(atmoshaper): coordinate mixer layers"
```

---

## Task 3: Add generated-audio and station-foundation adapters

**Files:**

- Create: `lib/atmoshaper/generated-audio-runtime.ts`
- Create: `lib/atmoshaper/audio-parameters.js`
- Create: `lib/atmoshaper/runtime.ts`
- Create: `tests/atmoshaper-runtime-boundary.test.mjs`
- Modify: `lib/atmosphere/generative-fm-runtime.ts`
- Modify: `lib/atmosphere/tone-proof-runtime.ts`
- Create: `tests/generative-fm-runtime-source.test.mjs`
- Create: `tests/tone-proof-runtime-source.test.mjs`

- [ ] **Step 1: Write failing source-boundary and pure-scheduling tests**

In `tests/atmoshaper-runtime-boundary.test.mjs`, read source files and assert:

- `music-provider.tsx` does not statically import `tone`, `generated-audio-runtime`, or `lib/atmoshaper/runtime`.
- AtmoShaper UI files do not import `tone` or existing generator packages.
- `runtime.ts` is the only composition point importing the controller, generated runtime, station resolver, and generator runtime.
- every generated handle exposes `fadeIn`, `update`, `pause`, `resume`, and `fadeOutAndDispose`.

Put directly testable scheduling math in `audio-parameters.js` so the ordinary Node test command does not need a TypeScript loader:

```js
/** Returns the independent left/right tones for a centered binaural carrier. */
export function binauralChannelFrequencies(carrierHz, beatHz) {
  return {
    leftHz: carrierHz - beatHz / 2,
    rightHz: carrierHz + beatHz / 2,
  }
}

/** Keeps live Web Audio parameter changes click-free without feeling sluggish. */
export function rampSeconds(value = 0.08) {
  return Math.min(0.25, Math.max(0.03, value))
}
```

Add numeric `@param` and return-shape JSDoc to the actual `.js` file, then import these helpers into `generated-audio-runtime.ts`. Assert a 220 Hz / 10 Hz binaural setting becomes 215 Hz left and 225 Hz right, and ramps clamp to `0.03..0.25` seconds.

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/atmoshaper-runtime-boundary.test.mjs tests/generative-fm-runtime-source.test.mjs`

Expected: FAIL because the new runtime files and destination injection do not exist.

- [ ] **Step 3: Make the existing generator runtime destination-injectable**

Change `startGenerativeFmPiece` to accept an optional shared destination and return a callable cleanup handle with an instance volume setter. Keeping the result callable preserves the existing atmosphere runtime-controller contract:

```ts
type GenerativeFmPlaybackHandle = (() => void) & {
  setVolume(nextVolume: number, seconds?: number): void
}

export async function startGenerativeFmPiece({
  station,
  volume,
  destination,
  onLoadProgress,
  isCurrent,
}: GenerativeFmRuntimeOptions & { destination?: unknown }): Promise<GenerativeFmPlaybackHandle> {
  const output = new Tone.Volume(volumeToDecibels(0))
  if (destination) output.connect(destination)
  else output.toDestination()

  const stop = () => {
    // Retain the existing owner-aware fade, transport cleanup, and disposal body.
  }
  stop.setVolume = (nextVolume: number, seconds = 0.08) => {
    output.volume.rampTo(volumeToDecibels(nextVolume), seconds)
  }
  return stop
}
```

Apply the same optional-destination/callable-handle pattern to `startToneProofDrone`. Import its destination type with `import type` so the current lazy/runtime bundle behavior does not change. Keep the global `setGenerativeFmPieceVolume` and `setToneProofDroneVolume` paths for ordinary station playback. Only AtmoShaper adapters use instance setters. Extend both source tests to protect destination branches, callable compatibility, owner-aware cleanup, and instance volume ramps.

- [ ] **Step 4: Implement generated sources and runtime composition**

`generated-audio-runtime.ts` must create per-layer gain stages connected to one injected AtmoShaper master destination:

- Noise: Tone `Noise` for white, pink, or brown.
- Binaural: two oscillators routed through left/right panners using `binauralChannelFrequencies`.
- Isochronic: one oscillator gated by a pulse-rate oscillator/gain graph; clamp modulation so the pulse remains intentional but click-free.
- All handles start at silent gain, ramp to recipe volume, ramp live parameter changes, and dispose every node/timer.
- `pause` silences without forgetting parameters; `resume` restores the target volume.

`runtime.ts` must export one lazy-load entry point:

```ts
export async function createAtmoShaperRuntime({
  initialMasterVolume,
  onSnapshot,
}: {
  initialMasterVolume: number
  onSnapshot: (snapshot: AtmoShaperRuntimeSnapshot) => void
}) {
  const master = new Tone.Volume(volumeToDecibels(initialMasterVolume)).toDestination()
  const controller = createAtmoShaperMixController({
    onSnapshot,
    createAdapter(layer) {
      if (layer.kind === "noise" || layer.kind === "binaural" || layer.kind === "isochronic") {
        return createGeneratedAtmoShaperAdapter({ layer, destination: master })
      }
      if (layer.kind === "station") {
        return createStationFoundationAdapter({ layer, destination: master })
      }
      throw new Error(`Unsupported AtmoShaper layer kind: ${layer.kind}`)
    },
  })

  return {
    ...controller,
    setMasterVolume(volume: number) {
      master.volume.rampTo(volumeToDecibels(volume), rampSeconds())
    },
    async dispose() {
      await controller.dispose()
      master.dispose()
    },
  }
}
```

Resolve station ids from the existing `lib/atmosphere/stations` catalog. Reuse existing tone-proof and generative-FM startup functions through destination-aware adapters; wrap each returned callable handle to implement pause/resume by ramping its private output without stopping the shared generator schedule. Do not duplicate station definitions or package mappings. Reject ambient layer kinds in this package with a recoverable per-layer error because the licensed catalog/media pipeline belongs to the follow-up plan.

- [ ] **Step 5: Run focused tests, typecheck, and full Node tests**

Run:

```powershell
node --test tests/atmoshaper-runtime-boundary.test.mjs tests/generative-fm-runtime-source.test.mjs tests/tone-proof-runtime-source.test.mjs
npm run typecheck
npm run test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add lib/atmoshaper/audio-parameters.js lib/atmoshaper/generated-audio-runtime.ts lib/atmoshaper/runtime.ts lib/atmosphere/generative-fm-runtime.ts lib/atmosphere/tone-proof-runtime.ts tests/atmoshaper-runtime-boundary.test.mjs tests/generative-fm-runtime-source.test.mjs tests/tone-proof-runtime-source.test.mjs
git commit -m "feat(atmoshaper): add generated audio adapters"
```

---

## Task 4: Give `MusicProvider` source-aware global ownership

**Files:**

- Modify: `components/providers/music-provider.tsx`
- Modify: `tests/atmosphere-provider-lazy-boundary.test.mjs`
- Create: `tests/atmoshaper-provider-source.test.mjs`

- [ ] **Step 1: Write failing provider source tests**

Add source assertions proving the context exposes a generic active playback identity and AtmoShaper actions while preserving the lazy boundary:

```js
assert.match(providerSource, /activePlaybackKind:\s*PlaybackKind/)
assert.match(providerSource, /playAtmoShaper:\s*\(recipe:/)
assert.match(providerSource, /updateAtmoShaper:\s*\(recipe:/)
assert.match(providerSource, /restartCurrent:\s*\(\)\s*=>\s*Promise<void>/)
assert.match(providerSource, /import\("@\/lib\/atmoshaper\/runtime"\)/)
assert.doesNotMatch(providerSource, /^import .*lib\/atmoshaper\/runtime/m)
```

Also assert the ordinary `playStation` path calls AtmoShaper disposal before its station adapter starts, and the AtmoShaper path stops the ordinary runtime controller before creating the mix runtime.

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/atmoshaper-provider-source.test.mjs tests/atmosphere-provider-lazy-boundary.test.mjs`

Expected: FAIL because the context is station-only.

- [ ] **Step 3: Extend the provider contract**

Add these public types/fields:

```ts
export type MusicPlaybackKind = "station" | "atmoshaper" | null

interface MusicContextType {
  activePlaybackKind: MusicPlaybackKind
  activeStationId: string | null
  activeStationTitle: string | null
  activeStationArtwork: AtmosphereStationArtworkInput | null
  canNavigateStations: boolean
  atmoShaperSnapshot: AtmoShaperRuntimeSnapshot | null
  playAtmoShaper: (recipe: AtmoShaperRecipe) => Promise<void>
  updateAtmoShaper: (recipe: AtmoShaperRecipe) => Promise<void>
  retryAtmoShaperLayer: (layerId: string) => Promise<void>
  pauseCurrent: () => Promise<void>
  restartCurrent: () => Promise<void>
}
```

Keep `activeStationId` reserved for ordinary stations so Favorites and station navigation cannot mistake a mix for a station. For AtmoShaper, set:

```ts
setActivePlaybackKind("atmoshaper")
setActiveStationId(null)
setActiveStationTitle(recipe.name || "AtmoShaper")
setActiveStationArtwork({
  stationId: `atmoshaper:${recipe.artworkSeed}`,
  title: recipe.name || "AtmoShaper",
  groupId: "atmoshaper",
})
```

Store the current recipe and lazy runtime in refs. `playAtmoShaper` must invalidate/stop ordinary playback, update metadata, create one runtime with dynamic `import("@/lib/atmoshaper/runtime")`, start the recipe, and publish Media Session metadata for the complete mix. `updateAtmoShaper` updates the ref and calls `applyRecipe`; if stopped, it must remain silent. `pauseCurrent` silences the active owner and publishes `paused` without disposing its recipe/runtime; `restartCurrent` resumes a paused owner and recreates a stopped owner by dispatching on `activePlaybackKind`. `setVolume` must update only the active source's master output. `stopCurrent` must dispose whichever source owns playback and preserve the existing stopped-player retention behavior.

Set Media Session previous/next handlers to `null` while AtmoShaper owns playback. Its play handler calls `restartCurrent`; pause/stop act on the global owner. Preserve interruption and visibility behavior, and add focused comments where source replacement changes the old station-only assumptions.

- [ ] **Step 4: Run tests and typecheck**

Run:

```powershell
node --test tests/atmoshaper-provider-source.test.mjs tests/atmosphere-provider-lazy-boundary.test.mjs
npm run typecheck
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add components/providers/music-provider.tsx tests/atmoshaper-provider-source.test.mjs tests/atmosphere-provider-lazy-boundary.test.mjs
git commit -m "feat(atmoshaper): integrate global playback ownership"
```

---

## Task 5: Make the persistent player represent a complete mix

**Files:**

- Modify: `components/providers/music-mini-player.tsx`
- Create: `tests/music-mini-player-source.test.mjs`
- Modify: `tests/browser/music-media-session.spec.ts`

- [ ] **Step 1: Add failing station-versus-mix player tests**

Source tests must assert:

- player visibility is based on `activePlaybackKind`, not only `activeStationId`;
- Play/Pause calls `restartCurrent()` or `pauseCurrent()` and Stop remains a separate cancellable action;
- favorite and previous/next controls render only when `canNavigateStations` is true;
- Play is enabled for a stopped AtmoShaper mix even though `activeStationId` is null.

Extend the browser media-session fixture so an AtmoShaper mix publishes its title/artwork, exposes Play/Pause/Stop, and has no previous/next handlers.

- [ ] **Step 2: Confirm RED**

Run:

```powershell
node --test tests/music-mini-player-source.test.mjs
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium
```

Expected: at least the source test FAILS because the mini-player is station-only.

- [ ] **Step 3: Update the player without adding a second surface**

Replace station-only gating with source-aware identity and distinct transport actions:

```tsx
const hasPlaybackIdentity = music.activePlaybackKind !== null
const showPlayer = hasPlaybackIdentity || music.playbackState === "failed"

function handlePlayPause() {
  if (music.playbackState === "playing") void music.pauseCurrent()
  else if (music.playbackState !== "loading") void music.restartCurrent()
}

const stopAction = (
  <Button
    type="button"
    aria-label={music.playbackState === "loading" ? "Cancel loading" : "Stop"}
    disabled={music.playbackState === "stopped"}
    onClick={() => void music.stopCurrent()}
  >
    <Square aria-hidden="true" />
  </Button>
)
```

Guard `favoriteAction`, `previousAction`, and `nextAction` with `music.canNavigateStations`. Preserve loading cancellation through Stop. Keep the same player shell, title, artwork, master volume, collapse behavior, visualizer action, safe-area reservations, and interruption notice. Do not add layer controls to the global player; those remain in the workspace.

- [ ] **Step 4: Run focused browser and deterministic tests**

Run:

```powershell
node --test tests/music-mini-player-source.test.mjs
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add components/providers/music-mini-player.tsx tests/music-mini-player-source.test.mjs tests/browser/music-media-session.spec.ts
git commit -m "feat(atmoshaper): represent mixes in music player"
```

---

## Task 6: Build the live-session AtmoShaper workspace

**Files:**

- Create: `components/atmoshaper/use-atmoshaper-recipe.ts`
- Create: `components/atmoshaper/atmoshaper-workspace.tsx`
- Create: `components/atmoshaper/sound-library.tsx`
- Create: `components/atmoshaper/current-mix.tsx`
- Create: `components/atmoshaper/brainwave-layer-controls.tsx`
- Create: `tests/atmoshaper-workspace-source.test.mjs`

- [ ] **Step 1: Write failing UI contract tests**

Use source-contract tests for the unmounted client components and reserve end-to-end behavior for Task 8. Assert that:

- the library offers White noise, Pink noise, Brown noise, existing Atmosphere stations, Binaural beats, and Isochronic tones;
- Delta, Theta, Alpha, Beta, and Gamma preset labels exist;
- advanced controls have explicit carrier and beat/pulse labels plus bounded `min`, `max`, and `step` props;
- Current Mix renders volume, mute, remove, retry, reorder, Play/Pause, Stop, and master-volume controls;
- binaural copy contains a headphone note but neither binaural nor isochronic copy contains prohibited health claims;
- there is no Save/My Mixes control in this package, because paid recall belongs to the persistence plan.

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/atmoshaper-workspace-source.test.mjs`

Expected: FAIL because the workspace files do not exist.

- [ ] **Step 3: Implement one local recipe owner**

`use-atmoshaper-recipe.ts` owns the current live-session recipe with a reducer around Task 1 helpers. Generate the id once with `crypto.randomUUID()` in an initializer. Expose actions:

```ts
type AtmoShaperRecipeActions = {
  addLayer(layer: AtmoShaperLayer): void
  updateLayer(layerId: string, patch: AtmoShaperLayerPatch): void
  removeLayer(layerId: string): void
  moveLayer(layerId: string, toIndex: number): void
  reset(): void
}
```

On every recipe change call `music.updateAtmoShaper(recipe)`. That provider method is silent when stopped and live when playing. Do not use localStorage, cookies, server actions, or account APIs in this package.

- [ ] **Step 4: Implement the library and Current Mix**

`SoundLibrary` uses accessible tabs or grouped sections:

- **Noise:** three Add cards creating distinct `noise:*` layers.
- **Stations:** the existing station catalog, using the station id as `sourceId`; adding a second station replaces the first after an accessible confirmation only when the current station layer has customized values.
- **Binaural:** five presets plus Advanced; adding replaces the existing binaural layer.
- **Isochronic:** five presets plus Advanced; adding replaces the existing isochronic layer.
- **Ambient sounds:** render an honest follow-up message such as “Ambient sound library is being prepared” rather than fake catalog entries.

`CurrentMix` maps ordered recipe layers. Each row has a visible source name/status, labeled volume slider, mute toggle with `aria-pressed`, Move earlier/later buttons, Retry when failed, and Remove. Render global controls as:

```tsx
<div className="ml-atmoshaper-master-controls" aria-label="AtmoShaper playback controls">
  <Button onClick={isPlaying ? () => void music.pauseCurrent() : () => void music.playAtmoShaper(recipe)}>
    {isPlaying ? "Pause AtmoShaper" : "Play AtmoShaper"}
  </Button>
  <Button
    aria-label="Stop AtmoShaper"
    disabled={music.playbackState === "stopped"}
    onClick={() => void music.stopCurrent()}
  >
    Stop
  </Button>
  <Slider
    aria-label="AtmoShaper master volume"
    min={0}
    max={1}
    step={0.05}
    value={[music.volume]}
    onValueChange={([value]) => music.setVolume(value)}
  />
</div>
```

Disable Play only when `recipe.layers.length === 0`. Announce layer add/remove/failure in a polite live region. Do not narrate continuous slider movement. If the active global owner is an ordinary station, the first AtmoShaper Play click replaces it through the provider; editing alone does not.

- [ ] **Step 5: Run focused tests, lint, and typecheck**

Run:

```powershell
node --test tests/atmoshaper-workspace-source.test.mjs
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add components/atmoshaper tests/atmoshaper-workspace-source.test.mjs
git commit -m "feat(atmoshaper): build live mixer workspace"
```

---

## Task 7: Integrate the workspace and balance-fill responsive layout

**Files:**

- Modify: `components/atmosphere/station-carousel.tsx`
- Modify: `app/browse/workspace.tsx`
- Modify: `app/globals.css`
- Modify: `tests/carousel-lab-source.test.mjs`
- Create: `tests/atmoshaper-layout-source.test.mjs`

- [ ] **Step 1: Write failing integration and layout tests**

Replace the old assertion that AtmoShaper always says “Coming soon.” Assert the selected category renders `<AtmoShaperWorkspace />` and does not mount the station carousel stage or Favorites mosaic.

In `tests/atmoshaper-layout-source.test.mjs`, assert CSS has:

- a wide two-column `Sound Library / Current Mix` grid;
- a narrow single-column library with a sticky compact Current Mix tray;
- an accessible expanded sheet/dialog for the full Current Mix on narrow layouts;
- `min-width: 0`, bounded overflow regions, and bottom reservations using the existing music-player/navigation CSS variables;
- a constrained-landscape rule that keeps transport and the mix tray reachable;
- no device names, user-agent checks, or zoom queries.

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/carousel-lab-source.test.mjs tests/atmoshaper-layout-source.test.mjs`

Expected: FAIL because AtmoShaper still renders “Coming soon” and has no workspace CSS.

- [ ] **Step 3: Replace the special state only at the completed integration point**

Import `AtmoShaperWorkspace` in `station-carousel.tsx` and replace:

```tsx
{isAtmoshaperCategory ? (
  <AtmoShaperWorkspace />
) : isFavoritesCategory ? (
  favoritesState
) : (
  stationCarouselStage
)}
```

Preserve the AtmoShaper category's position, selected purple heart-like visual treatment, keyboard scrolling, and existing view-change callback. In `app/browse/workspace.tsx`, keep Favorites geometry disabled for the AtmoShaper view and give the AtmoShaper allocation the full measured content area between the heading and persistent shell controls.

- [ ] **Step 4: Add balance-fill CSS without device branches**

Use a container on the workspace:

```css
.ml-atmoshaper-workspace {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.78fr);
  gap: clamp(1rem, 2.2cqi, 2rem);
  min-width: 0;
  min-height: 0;
  padding-block-end: calc(var(--ml-audio-toolbar-height, 0px) + env(safe-area-inset-bottom));
}

.ml-atmoshaper-library,
.ml-atmoshaper-current-mix {
  min-width: 0;
  min-height: 0;
}

@container (max-width: 46rem) {
  .ml-atmoshaper-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .ml-atmoshaper-current-mix-desktop {
    display: none;
  }

  .ml-atmoshaper-mix-tray {
    position: sticky;
    inset-block-end: calc(var(--ml-audio-toolbar-height, 0px) + env(safe-area-inset-bottom));
  }
}
```

Use `clamp()` and available height to let cards/columns grow on large screens. At 200% text zoom and narrow portrait, allow internal library scrolling but do not create document-level horizontal scrolling. The expanded Current Mix uses the existing Sheet component with focus restoration to its trigger. Reduced motion removes decorative transitions but keeps audio ramps.

- [ ] **Step 5: Run deterministic checks**

Run:

```powershell
node --test tests/carousel-lab-source.test.mjs tests/atmoshaper-layout-source.test.mjs
npm run lint
npm run typecheck
npm run test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add components/atmosphere/station-carousel.tsx app/browse/workspace.tsx app/globals.css tests/carousel-lab-source.test.mjs tests/atmoshaper-layout-source.test.mjs
git commit -m "feat(atmoshaper): integrate responsive mixer"
```

---

## Task 8: Prove playback, failure isolation, accessibility, and viewport behavior

**Files:**

- Create: `tests/browser/atmoshaper.spec.ts`
- Modify: `tests/browser/ci-lanes.mjs`
- Modify: `tests/browser/ci-lanes.test.mjs`
- Modify: `docs/wiki/atmosphere-audio.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Write the browser test before changing CI discovery**

`tests/browser/atmoshaper.spec.ts` must cover:

```ts
test("builds and plays a free multi-layer mix through one global player", async ({ page }) => {
  await page.goto("/music")
  await page.getByRole("button", { name: "AtmoShaper" }).click()
  await page.getByRole("button", { name: "Add Pink noise" }).click()
  await page.getByRole("button", { name: "Add Alpha binaural preset" }).click()
  await page.getByRole("button", { name: "Play AtmoShaper" }).click()

  await expect(page.getByLabel("AtmoShaper playback controls")).toBeVisible()
  await expect(page.locator(".ml-music-player")).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Favorite AtmoShaper" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Previous station" })).toHaveCount(0)
})
```

Add cases for:

- ordinary station → AtmoShaper replacement and AtmoShaper → ordinary station replacement;
- stopped recipe edits staying silent;
- live volume/mute/remove updates without changing healthy layer ids;
- one injected adapter failure leaving another layer playing, with Retry/Remove visible;
- narrow Current Mix tray opening/closing with focus restoration;
- keyboard-only add, reorder, mute, retry, and remove;
- reduced motion;
- 200% text zoom;
- no document horizontal/vertical overflow at 375×667, 412×915, 844×390, 768×1024, 912×1368, 1440×900, and 2560×1440;
- useful growth at 1440×900 and 2560×1440 rather than a TV-small fixed panel.

For audio assertions, add a guarded test-only diagnostics snapshot through the existing provider diagnostics pattern; do not inspect private Tone nodes from the page. Inject the failure through a test-only adapter hook that is absent from production builds.

- [ ] **Step 2: Run the new spec and confirm meaningful failures**

Run:

```powershell
npm run build
npm run test:browser -- tests/browser/atmoshaper.spec.ts --project=desktop-chromium --project=mobile-chromium
```

Expected: any missing behavior fails with an assertion tied to the product contract. Fix product code, not test expectations, unless the expectation contradicts the approved spec.

- [ ] **Step 3: Fix issues found by the real browser matrix**

Make the smallest implementation changes needed in Tasks 3–7 files. Record measured geometry in test failure messages: viewport, workspace rectangle, library rectangle, Current Mix rectangle/tray rectangle, player rectangle, `scrollWidth/clientWidth`, and `scrollHeight/clientHeight`. Do not introduce device-specific or zoom-specific branches.

- [ ] **Step 4: Add the spec to CI lane coverage**

Add `atmoshaper.spec.ts` to the music/atmosphere Chromium lane in `tests/browser/ci-lanes.mjs`, then update `tests/browser/ci-lanes.test.mjs` so discovery remains deterministic and every new browser spec belongs to exactly one intended lane.

- [ ] **Step 5: Document the implemented boundary**

Update `docs/wiki/atmosphere-audio.md` with:

- supported core layers and one-per-kind limits;
- single global playback ownership;
- generated-audio/runtime lazy loading;
- the fact that the current recipe is live-session only;
- ambient catalog, saved mixes, Supporter recall, permanent slots, user artwork, public sharing, and lo-fi remaining later packages.

Append a concise dated entry to `docs/project-log.md` only after all validation passes. Do not claim production deployment or catalog licensing completion.

- [ ] **Step 6: Run the full validation gate**

Run:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:browser -- tests/browser/atmoshaper.spec.ts tests/browser/music-media-session.spec.ts --project=desktop-chromium --project=mobile-chromium
git diff --check
```

Expected: all commands PASS. If WebKit media smoke is in release scope, run the existing focused WebKit media spec separately and classify teardown-only hangs using the project's existing retry evidence rules.

- [ ] **Step 7: Self-review against the spec before committing**

Check every changed file and answer these explicitly in the implementation report:

- Can a user play one individual sound with no station?
- Are station, binaural, and isochronic limits enforced in the domain and UI?
- Does an AtmoShaper mix replace ordinary station playback in both directions?
- Does one layer failure preserve healthy playback?
- Is every heavy runtime import still lazy?
- Is there exactly one global player?
- Are all controls usable by keyboard and at enlarged text?
- Are there zero device-name, user-agent, or zoom branches?
- Did this package avoid saved-mix, entitlement, commerce, catalog-media, and lo-fi scope?

Scan for incomplete implementation markers:

```powershell
rg -n "TODO|FIXME|placeholder|Coming soon|throw new Error\(\"Not implemented" components/atmoshaper lib/atmoshaper components/providers/music-provider.tsx components/atmosphere/station-carousel.tsx
```

Expected: no unresolved core-mixer placeholder. The ambient-library follow-up copy is deliberate product copy and should be referenced in the report if it matches the scan.

- [ ] **Step 8: Commit the verified package**

```powershell
git add tests/browser/atmoshaper.spec.ts tests/browser/ci-lanes.mjs tests/browser/ci-lanes.test.mjs docs/wiki/atmosphere-audio.md docs/project-log.md components lib app tests
git commit -m "test(atmoshaper): verify core mixer experience"
```

---

## Follow-Up Planning Order

After this package is accepted, write and review separate implementation plans in this order:

1. **Moodist-first sound catalog and media pipeline:** enumerate all 84 Moodist concepts and exact upstream sources, preserve license evidence, audit quality, retain suitable entries, use Signature Samples/owned/CC0 replacements, create the self-recording checklist, process loops, publish immutable media, and add ambient adapters.
2. **Saved mixes and Supporter recall:** unlimited locked guest/account saves, local-to-account import, cross-device sync, preserve-both conflicts, version migration, standard artwork, feature-key access, lapse relocking, and complete-recipe privacy boundaries.
3. **One-dollar permanent slots:** dedicated Stripe product/readiness, stable slot ownership, authenticated Checkout, webhook/reconciliation fulfillment, refunds/disputes, tax review, and release authorization gates.
4. **Integrated release hardening:** full device/browser/resource matrix, dense-layer performance ceilings based on measurement, accessibility audit, catalog credits, commerce rehearsal, and production enablement authorization.
