# Media Notifications and Audio Interruptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the route-persistent Atmosphere generator a portable browser media owner, correct notification and interruption behavior, an explicit resume preference, and faster latest-request-wins startup without changing the audible Tone/Web Audio model.

**Architecture:** `MusicProvider` remains the sole product-level owner and coordinates pure playback policy, one reusable silent `HTMLAudioElement` carrier, a Media Session adapter, observable interruption signals, and the existing generator runtime. Runtime startup becomes generation-scoped instead of queue-serialized, and every Generative.fm piece loads through an explicit per-piece dynamic import. UI work is limited to a sixth expanded-player settings action and one non-modal, session-scoped notice.

**Tech Stack:** Next.js 16, React 19, TypeScript/JavaScript with `// @ts-check`, Tone.js 14, Generative Music packages, Radix dropdown/checkbox primitives, Node test runner, Playwright Chromium/WebKit, FFmpeg/FFprobe, CSS safe-area variables.

## Global Constraints

- Work only in `C:\tmp\massagelab-android-media-notifications` on `codex/media-notifications-audio-interruptions`.
- The branch base is refreshed merged main `903e6def564d21427f72517a7e818de2e2b6a32a`; do not change another checkout or worktree.
- Before the first implementation edit, and again before canonical documentation edits, run `git -C C:\Users\derri\.codex\worktrees\508f\massagelab status --short`. If any admin-interface path newly overlaps a path in this plan, warn the user before editing it.
- Keep `MusicProvider` as the only long-lived playback owner. Components may render controls but may not create independent carriers, generator controllers, or Media Session handlers.
- Keep Tone/Web Audio as the only audible generator. The HTML media carrier is a silent ownership/focus mechanism, not a second program source.
- Do not add Notification permission, a service-worker notification, fake duration/seek state, Cast/AirPlay UI, fullscreen changes, backend schemas, admin behavior, account sync, or interruption-app/caller identification.
- Use feature/capability detection. Unsupported carrier, Media Session, Audio Session, or AudioContext signals must fail closed without preventing ordinary in-app generator playback or showing a false interruption promise.
- Explicit Pause/Stop always beats later focus, visibility, carrier, or AudioContext recovery events. An undifferentiated Media Session Pause is conservative and stays paused.
- Preserve hosted compressed indexes, bounded sample fetch/decode behavior, Cache API/IndexedDB behavior, current volume/favorite/route continuity, attribution, and the full 57-station catalog.
- Do not raise the existing sample batch/concurrency limits in this branch.
- Add focused JSDoc to every new shared helper and every changed non-obvious lifecycle boundary.
- Every task follows strict RED -> GREEN -> focused regression -> `git diff --check` -> scoped commit. Do not combine task commits.
- New tests must assert observable behavior. Do not add source-regex checks merely to prove that implementation text exists or disappeared; existing repository source-contract tests may remain as regressions, but they are not evidence for new behavior.
- Physical Android evidence is required before claiming this branch complete. Playwright WebKit is engine compatibility evidence, not iPhone/iPad certification.

---

## Interface Map

### Device preference

Create `lib/atmosphere/interruption-preference.js` with this public contract:

```js
export const ATMOSPHERE_INTERRUPTION_PREFERENCE_KEY =
  "massagelab-atmosphere-interruption-v1"
export const DEFAULT_RESUME_AFTER_INTERRUPTION = true

export function readAtmosphereInterruptionPreference(storageProvider) {
  // => { value: boolean, available: boolean }
}

export function writeAtmosphereInterruptionPreference(storageProvider, value) {
  // => { value: boolean, available: boolean }
}
```

`storageProvider` is a function such as `() => window.localStorage`, so a throwing `localStorage` getter is caught inside the helper. Persist JSON with an explicit schema version:

```json
{"version":1,"resumeAfterInterruption":true}
```

Missing, malformed, wrong-version, blocked-read, and blocked-write cases use the in-memory enabled default and never throw.

### Playback policy

Create `lib/atmosphere/playback-lifecycle.js` with a pure transition API:

```js
export function createAtmospherePlaybackLifecycle(resumeDefault = true) {
  return {
    status: "stopped",
    sessionId: 0,
    explicitIntent: "stop",
    interruptionObserved: false,
    resumeAfterInterruption: resumeDefault,
    noticeSessionId: null,
  }
}

export function transitionAtmospherePlayback(state, event) {
  // => { state: nextState, effects: string[] }
}
```

Use these event and effect names exactly so provider and tests share one vocabulary:

```js
// events
"BEGIN_IN_APP_SESSION"
"BEGIN_EXTERNAL_SESSION"
"START_SUCCEEDED"
"START_FAILED"
"EXPLICIT_PAUSE"
"EXPLICIT_STOP"
"INTERRUPTION_STARTED"
"INTERRUPTION_ENDED"
"SET_SESSION_RESUME"
"DISMISS_NOTICE"

// effects
"START_GENERATOR"
"STOP_GENERATOR_RETAIN_MEDIA"
"STOP_GENERATOR_DISMISS_MEDIA"
"RESUME_GENERATOR"
"NONE"
```

`BEGIN_IN_APP_SESSION` increments `sessionId`, copies the current saved default supplied on the event into the session, and exposes `noticeSessionId` only when `documentVisible && integrationAvailable`. `BEGIN_EXTERNAL_SESSION` increments the session but never exposes a notice. Previous/Next do not create a new lifecycle session; the provider reuses the current `resumeAfterInterruption` while replacing the station.

### Runtime controller

Keep `createAtmosphereRuntimeController({ adapters })`, but make `start(station)` return a result and make `stop()` synchronous from the caller's perspective:

```js
// start result
{ status: "active", requestId: number }
{ status: "stale", requestId: number }

// stop result
{ requestId: number }
```

Each start captures a monotonically increasing request ID, immediately detaches/stops the currently active cleanup handle, and begins its adapter without waiting for older preparation. After every await, a stale request cleans up its own returned activation and never publishes `activeStationId`. `stop()` increments the ID and detaches active cleanup immediately; it does not await unresolved stale starts.

### Per-piece loader

Create `lib/atmosphere/generative-fm-piece-loader.js`:

```js
export const generativeFmPieceImporters = Object.freeze({
  "observable-streams": () => import("@generative-music/piece-observable-streams"),
})

export async function loadGenerativeFmPieceModule(pieceId, importers = generativeFmPieceImporters) {
  // validates the ID, awaits only that importer, and returns module.default
}
```

This shortened interface example establishes the importer value shape; Task 3 contains the complete 57-entry literal that must be implemented. The normal runtime path must not import or index `@generative-music/pieces-alex-bainter`. Retain the aggregate dependency only if another catalog/provenance owner still imports it after the runtime change.

### Media carrier

Create `lib/atmosphere/media-playback-carrier.js`:

```js
export function createAtmosphereMediaCarrier({
  createAudio,
  sourceUrl = "/audio/atmosphere/media-session-carrier.mp3",
  onEvent = () => {},
}) {
  return {
    start,             // Promise<{ available: boolean }>
    pauseRetained,     // pauses without clearing src/metadata ownership
    stopAndDismiss,    // pauses, clears src, calls load, and releases ownership
    dispose,           // idempotent listener/source cleanup
    isAvailable,
    getElement,
  }
}
```

Create exactly one audio element lazily, set `loop = true`, `preload = "auto"`, and keep it audibly silent through the encoded asset rather than `muted = true`. Track internal operations so emitted `{ type: "play" | "pause", origin: "internal" | "external" }` events do not misclassify app-driven pause/stop.

### Media Session controller

Create `lib/atmosphere/media-session-controller.js`:

```js
export function createAtmosphereMediaSessionController({ mediaSession, createMetadata }) {
  return {
    publish({ metadata, playbackState, handlers }),
    clear(),
    dispose(),
    isAvailable(),
  }
}
```

`publish` replaces all five handlers (`play`, `pause`, `stop`, `previoustrack`, `nexttrack`), sets metadata and `none | paused | playing`, and guards individually unsupported actions. `clear` nulls every handler and metadata and sets playback state to `none` when accepted.

### Interruption monitor

Create `lib/atmosphere/media-interruption-monitor.js`:

```js
export function createAtmosphereInterruptionMonitor({
  audioSession,
  audioContext,
  carrier,
  documentTarget,
  onInterrupted,
  onRecovered,
  onAmbiguousPause,
}) {
  return { start, dispose, isAvailable, isInterrupted }
}
```

Specific `audioSession.state === "interrupted"` or `audioContext.state === "interrupted"` establishes an interruption. A carrier external pause is supporting evidence only when a specific interruption signal is current; otherwise call `onAmbiguousPause`. Visibility never starts an interruption; a return to visible may call `onRecovered` only after an interruption was already observed and the specific signal is no longer interrupted.

### Provider context

Extend the provider contract with:

```ts
type PlaybackState =
  | "stopped"
  | "loading"
  | "playing"
  | "interrupted"
  | "paused"
  | "failed"

type PlaybackStartOptions = {
  origin?: "in-app" | "media-session"
  continueSession?: boolean
}

playStation: (stationId: string, options?: PlaybackStartOptions) => Promise<void>
mediaIntegrationAvailable: boolean
resumeAfterInterruptionDefault: boolean
resumeAfterInterruptionForSession: boolean
interruptionNoticeSessionId: number | null
setSessionResumeAfterInterruption: (value: boolean) => void
setResumeAfterInterruptionDefault: (value: boolean) => void
dismissInterruptionNotice: (sessionId: number) => void
```

In-app `stopCurrent()` remains full stop/dismiss. Media Session Pause uses a private provider callback that stops the generator while retaining station, carrier, and metadata. Media Session Play invokes `playStation(activeStationId, { origin: "media-session" })`. Previous/Next use `{ continueSession: true }` so the session preference and notice state do not reset.

---

### Task 1: Add the guarded device preference and pure playback policy

**Files:**

- Create: `lib/atmosphere/interruption-preference.js`
- Create: `lib/atmosphere/playback-lifecycle.js`
- Create: `tests/atmosphere-interruption-preference.test.mjs`
- Create: `tests/atmosphere-playback-lifecycle.test.mjs`

- [ ] **Step 1: Write failing preference tests**

Cover enabled default, valid v1 read, malformed JSON, wrong version, throwing storage getter, throwing `getItem`, successful write, and throwing `setItem`. The getter test must pass a provider rather than acquiring storage before the helper:

```js
assert.deepEqual(
  readAtmosphereInterruptionPreference(() => {
    throw new DOMException("blocked", "SecurityError")
  }),
  { value: true, available: false },
)
```

- [ ] **Step 2: Write failing lifecycle tests**

Cover every approved transition and precedence rule:

```js
const interrupted = transitionAtmospherePlayback(playing, {
  type: "INTERRUPTION_STARTED",
}).state
assert.equal(interrupted.status, "interrupted")

const stopped = transitionAtmospherePlayback(interrupted, {
  type: "EXPLICIT_STOP",
}).state
const lateRecovery = transitionAtmospherePlayback(stopped, {
  type: "INTERRUPTION_ENDED",
})
assert.equal(lateRecovery.state.status, "stopped")
assert.deepEqual(lateRecovery.effects, ["NONE"])
```

Also prove: disabled session preference becomes Paused on interruption; ambiguous Pause stays Paused; in-app Play opens a notice only when visible/supported; external Play never opens it; session override does not mutate the supplied saved default; previous/next is intentionally absent from the reducer because it continues the same session.

- [ ] **Step 3: Run RED**

Run:

```powershell
node --test tests/atmosphere-interruption-preference.test.mjs tests/atmosphere-playback-lifecycle.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for both new helpers.

- [ ] **Step 4: Implement the minimal pure helpers**

Use guarded provider acquisition in the preference helper and an exhaustive `switch (event.type)` in the lifecycle helper. Unknown events must throw in tests instead of silently hiding a provider bug. Add JSDoc typedefs for state, event, effect, storage provider, and return values.

- [ ] **Step 5: Run GREEN and regression checks**

Run:

```powershell
node --test tests/atmosphere-interruption-preference.test.mjs tests/atmosphere-playback-lifecycle.test.mjs
npm run typecheck
git diff --check
```

Expected: all focused tests and typecheck pass; diff check is silent.

- [ ] **Step 6: Commit**

```powershell
git add lib/atmosphere/interruption-preference.js lib/atmosphere/playback-lifecycle.js tests/atmosphere-interruption-preference.test.mjs tests/atmosphere-playback-lifecycle.test.mjs
git commit -m "feat: define atmosphere interruption policy"
```

### Task 2: Replace queue serialization with latest-request-wins runtime control

**Files:**

- Modify: `lib/atmosphere/runtime-controller.js`
- Modify: `tests/atmosphere-runtime-controller.test.mjs`

- [ ] **Step 1: Replace the serial-queue assertions with failing cancellation assertions**

Delete the test that requires the second adapter to wait for the first. Add tests proving the opposite:

```js
const firstStart = controller.start(stationOne)
await firstAdapterEntered
const secondStart = controller.start(stationTwo)
await secondAdapterEntered

releaseSecond()
assert.deepEqual(await secondStart, { status: "active", requestId: 2 })
releaseFirst()
assert.deepEqual(await firstStart, { status: "stale", requestId: 1 })
assert.equal(controller.getActiveStationId(), "two")
assert.deepEqual(events, ["start:one", "start:two", "dispose:one"])
```

Add distinct tests for Stop while adapter preparation is unresolved, stale adapter rejection not clearing a newer active station, two stale activations each disposing their own cleanup exactly once, and active cleanup detaching immediately on replacement.

- [ ] **Step 2: Run RED**

Run:

```powershell
node --test tests/atmosphere-runtime-controller.test.mjs
```

Expected: the newer adapter is not entered until the old queue releases and `stop()` does not return immediately.

- [ ] **Step 3: Implement request generations without a shared operation promise**

Use this control shape:

```js
let latestRequestId = 0
let active = null

function detachActive() {
  const current = active
  active = null
  current?.cleanup()
}

async function start(station) {
  const requestId = ++latestRequestId
  detachActive()
  const nextCleanup = await resolveAdapter(station)({ station })
  if (requestId !== latestRequestId) {
    nextCleanup?.()
    return { status: "stale", requestId }
  }
  active = { stationId: station.id, cleanup: nextCleanup ?? null }
  return { status: "active", requestId }
}

function stop() {
  const requestId = ++latestRequestId
  detachActive()
  return { requestId }
}
```

Guard adapter failures: only the current request may clear current state or propagate into provider-visible failure; stale rejections must still reject their own promise for diagnostics but cannot mutate a newer activation.

- [ ] **Step 4: Run GREEN and focused provider regressions**

Run:

```powershell
node --test tests/atmosphere-runtime-controller.test.mjs tests/atmosphere-provider-lazy-boundary.test.mjs tests/music-visualizer-provider.test.mjs
npm run typecheck
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add lib/atmosphere/runtime-controller.js tests/atmosphere-runtime-controller.test.mjs
git commit -m "perf: make atmosphere runtime latest request wins"
```

### Task 3: Load only the selected Generative.fm piece and request Tone activation early

**Files:**

- Create: `lib/atmosphere/generative-fm-piece-loader.js`
- Create: `tests/atmosphere-generative-fm-piece-loader.test.mjs`
- Modify: `lib/atmosphere/generative-fm-runtime.ts`
- Run unchanged regression: `tests/atmosphere-provider-lazy-boundary.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing loader contract**

Assert the exact 57 IDs, one importer invocation, default-export resolution, and unknown-ID rejection through the real loader API:

```js
assert.deepEqual(Object.keys(generativeFmPieceImporters).sort(), expectedPieceIds.sort())
assert.equal(calls.length, 0)
const piece = await loadGenerativeFmPieceModule("trees", fakeImporters)
assert.equal(piece, expectedPiece)
assert.deepEqual(calls, ["trees"])
```

- [ ] **Step 2: Add a failing early-activation ordering test**

Add an injectable seam around runtime-module loading in the new loader test or a focused runtime test. Prove the Tone activation promise begins before sample-index and piece preparation resolve:

```js
assert.deepEqual(events.slice(0, 2), ["load-runtime-modules", "tone-start"])
assert.equal(events.includes("activate-piece"), false)
```

- [ ] **Step 3: Run RED**

Run:

```powershell
node --test tests/atmosphere-generative-fm-piece-loader.test.mjs tests/atmosphere-provider-lazy-boundary.test.mjs
```

Expected: new module missing.

- [ ] **Step 4: Add the direct package dependencies**

Keep the existing direct Observable Streams dependency and add these exact aggregate-manifest versions to root dependencies with `npm install` so the lockfile records them as supported direct imports:

```text
@generative-music/piece-420hz-gamma-waves-for-big-brain@5.2.0
@generative-music/piece-a-viable-system@5.2.0
@generative-music/piece-above-the-rain@5.2.0
@generative-music/piece-agua-ravine@5.2.0
@generative-music/piece-aisatsana@5.2.0
@generative-music/piece-animalia-chordata@5.2.0
@generative-music/piece-apoapsis@5.2.0
@generative-music/piece-at-sunrise@5.2.0
@generative-music/piece-awash@5.2.0
@generative-music/piece-beneath-waves@5.2.0
@generative-music/piece-bhairav@5.2.0
@generative-music/piece-buttafingers@5.2.0
@generative-music/piece-day-dream@5.2.0
@generative-music/piece-didgeridoobeats@5.2.0
@generative-music/piece-documentary-films@5.2.0
@generative-music/piece-drones@5.2.0
@generative-music/piece-drones-2@5.2.0
@generative-music/piece-eno-machine@5.2.0
@generative-music/piece-enough@5.2.0
@generative-music/piece-expand-collapse@5.2.0
@generative-music/piece-eyes-closed@5.2.0
@generative-music/piece-homage@5.2.0
@generative-music/piece-impact@5.2.0
@generative-music/piece-last-transit@5.2.0
@generative-music/piece-lemniscate@5.2.0
@generative-music/piece-little-bells@5.2.0
@generative-music/piece-lullaby@5.2.0
@generative-music/piece-meditation@5.2.0
@generative-music/piece-moment@5.2.0
@generative-music/piece-nakaii@5.2.0
@generative-music/piece-neuroplasticity@5.2.0
@generative-music/piece-no-refrain@5.2.0
@generative-music/piece-otherness@5.2.0
@generative-music/piece-oxalis-1@5.2.0
@generative-music/piece-peace@5.2.0
@generative-music/piece-pinwheels@5.2.0
@generative-music/piece-pulse-code-modulation@5.2.0
@generative-music/piece-remembering@5.2.0
@generative-music/piece-return-to-form@5.2.0
@generative-music/piece-ritual@5.2.0
@generative-music/piece-sevenths@5.2.0
@generative-music/piece-skyline@5.2.2
@generative-music/piece-soundtrack@5.2.0
@generative-music/piece-splash@5.2.0
@generative-music/piece-spring-again@5.2.0
@generative-music/piece-stratospheric@5.2.0
@generative-music/piece-stream-of-consciousness@5.2.0
@generative-music/piece-substrate@5.2.0
@generative-music/piece-timbral-oscillations@5.2.0
@generative-music/piece-townsend@5.2.0
@generative-music/piece-transmission@5.2.0
@generative-music/piece-trees@5.2.0
@generative-music/piece-uun@5.2.0
@generative-music/piece-western-medicine@5.2.0
@generative-music/piece-yesterday@5.2.0
@generative-music/piece-zed@5.2.0
```

Use one non-interactive `npm install --save-exact` command containing those packages. Do not remove `@generative-music/pieces-alex-bainter` until `rg` proves it has no remaining catalog/provenance owner.

- [ ] **Step 5: Implement the complete importer map**

The object must contain the full exact mapping, including:

```js
const generativeFmPieceImporters = Object.freeze({
  "420hz-gamma-waves-for-big-brain": () => import("@generative-music/piece-420hz-gamma-waves-for-big-brain"),
  "a-viable-system": () => import("@generative-music/piece-a-viable-system"),
  "above-the-rain": () => import("@generative-music/piece-above-the-rain"),
  "agua-ravine": () => import("@generative-music/piece-agua-ravine"),
  aisatsana: () => import("@generative-music/piece-aisatsana"),
  "animalia-chordata": () => import("@generative-music/piece-animalia-chordata"),
  apoapsis: () => import("@generative-music/piece-apoapsis"),
  "at-sunrise": () => import("@generative-music/piece-at-sunrise"),
  awash: () => import("@generative-music/piece-awash"),
  "beneath-waves": () => import("@generative-music/piece-beneath-waves"),
  bhairav: () => import("@generative-music/piece-bhairav"),
  buttafingers: () => import("@generative-music/piece-buttafingers"),
  "day-dream": () => import("@generative-music/piece-day-dream"),
  didgeridoobeats: () => import("@generative-music/piece-didgeridoobeats"),
  "documentary-films": () => import("@generative-music/piece-documentary-films"),
  drones: () => import("@generative-music/piece-drones"),
  "drones-2": () => import("@generative-music/piece-drones-2"),
  "eno-machine": () => import("@generative-music/piece-eno-machine"),
  enough: () => import("@generative-music/piece-enough"),
  "expand-collapse": () => import("@generative-music/piece-expand-collapse"),
  "eyes-closed": () => import("@generative-music/piece-eyes-closed"),
  homage: () => import("@generative-music/piece-homage"),
  impact: () => import("@generative-music/piece-impact"),
  "last-transit": () => import("@generative-music/piece-last-transit"),
  lemniscate: () => import("@generative-music/piece-lemniscate"),
  "little-bells": () => import("@generative-music/piece-little-bells"),
  lullaby: () => import("@generative-music/piece-lullaby"),
  meditation: () => import("@generative-music/piece-meditation"),
  moment: () => import("@generative-music/piece-moment"),
  nakaii: () => import("@generative-music/piece-nakaii"),
  neuroplasticity: () => import("@generative-music/piece-neuroplasticity"),
  "no-refrain": () => import("@generative-music/piece-no-refrain"),
  "observable-streams": () => import("@generative-music/piece-observable-streams"),
  otherness: () => import("@generative-music/piece-otherness"),
  "oxalis-1": () => import("@generative-music/piece-oxalis-1"),
  peace: () => import("@generative-music/piece-peace"),
  pinwheels: () => import("@generative-music/piece-pinwheels"),
  "pulse-code-modulation": () => import("@generative-music/piece-pulse-code-modulation"),
  remembering: () => import("@generative-music/piece-remembering"),
  "return-to-form": () => import("@generative-music/piece-return-to-form"),
  ritual: () => import("@generative-music/piece-ritual"),
  sevenths: () => import("@generative-music/piece-sevenths"),
  skyline: () => import("@generative-music/piece-skyline"),
  soundtrack: () => import("@generative-music/piece-soundtrack"),
  splash: () => import("@generative-music/piece-splash"),
  "spring-again": () => import("@generative-music/piece-spring-again"),
  stratospheric: () => import("@generative-music/piece-stratospheric"),
  "stream-of-consciousness": () => import("@generative-music/piece-stream-of-consciousness"),
  substrate: () => import("@generative-music/piece-substrate"),
  "timbral-oscillations": () => import("@generative-music/piece-timbral-oscillations"),
  townsend: () => import("@generative-music/piece-townsend"),
  transmission: () => import("@generative-music/piece-transmission"),
  trees: () => import("@generative-music/piece-trees"),
  uun: () => import("@generative-music/piece-uun"),
  "western-medicine": () => import("@generative-music/piece-western-medicine"),
  yesterday: () => import("@generative-music/piece-yesterday"),
  zed: () => import("@generative-music/piece-zed"),
})
```

- [ ] **Step 6: Wire early activation and selected-piece loading**

In `startGenerativeFmPiece`, begin runtime-module loading and `Tone.start()` before awaiting sample/piece preparation:

```ts
const modulesPromise = loadGenerativeFmRuntimeModules()
const toneActivationPromise = modulesPromise.then(({ Tone }) => Tone.start())
const preparedPromise = getPreparedGenerativeFmRuntime(station, "playback")
const [prepared] = await Promise.all([preparedPromise, toneActivationPromise])
```

Replace the aggregate package lookup in `loadGenerativeFmPiece` with `loadGenerativeFmPieceModule(pieceId)`. Preserve lazy provider boundaries, prewarm behavior, telemetry fields, and bounded sample fetching.

- [ ] **Step 7: Run GREEN and build verification**

Run:

```powershell
node --test tests/atmosphere-generative-fm-piece-loader.test.mjs tests/atmosphere-provider-lazy-boundary.test.mjs tests/atmosphere-runtime-controller.test.mjs
npm run typecheck
npm run build
git diff --check
```

Expected: exact 57-ID behavior test passes; the unchanged lazy-boundary regression passes; production build resolves all dynamic imports. Review the runtime diff to verify it no longer imports the aggregate collection, but do not add a lexical test for that implementation detail.

- [ ] **Step 8: Commit**

```powershell
git add package.json package-lock.json lib/atmosphere/generative-fm-piece-loader.js lib/atmosphere/generative-fm-runtime.ts tests/atmosphere-generative-fm-piece-loader.test.mjs
git commit -m "perf: load atmosphere pieces on demand"
```

### Task 4: Add the portable media carrier asset and lifecycle

**Files:**

- Create: `public/audio/atmosphere/media-session-carrier.mp3`
- Create: `lib/atmosphere/media-playback-carrier.js`
- Create: `tests/atmosphere-media-playback-carrier.test.mjs`

- [ ] **Step 1: Write failing carrier tests with a fake audio element**

The fake must record listeners, `play`, `pause`, `load`, `src`, `loop`, and `preload`. Cover one-element reuse, internal event classification, external pause classification, rejected `play()` availability, pause retention, full dismissal, and idempotent disposal:

```js
await carrier.start()
await carrier.start()
assert.equal(createdAudio.length, 1)
assert.equal(createdAudio[0].loop, true)

carrier.pauseRetained()
assert.equal(createdAudio[0].src, carrierUrl)

carrier.stopAndDismiss()
assert.equal(createdAudio[0].src, "")
assert.equal(createdAudio[0].loadCalls, 1)
```

- [ ] **Step 2: Run RED**

Run:

```powershell
node --test tests/atmosphere-media-playback-carrier.test.mjs
```

Expected: module missing.

- [ ] **Step 3: Generate and validate the committed carrier asset**

Create a ten-second mono MP3 containing encoded digital silence. Do not reuse `public/notification.mp3`; it is a text placeholder, not media.

```powershell
New-Item -ItemType Directory -Force public/audio/atmosphere
ffmpeg -n -f lavfi -i anullsrc=r=44100:cl=mono -t 10 -c:a libmp3lame -b:a 32k -write_xing 0 public/audio/atmosphere/media-session-carrier.mp3
ffprobe -v error -show_entries format=duration,format_name -show_entries stream=codec_name,channels,sample_rate -of json public/audio/atmosphere/media-session-carrier.mp3
```

Expected: MP3 codec, mono, 44100 Hz, duration at least 9.9 seconds, nonzero file size. Listen once at system-safe volume to confirm silence; the asset must not contain spoken or musical content.

- [ ] **Step 4: Implement the carrier**

Acquire the element lazily inside `start()`. Set internal-operation markers before calling `play()` or `pause()` and clear them after the corresponding event/microtask, so app operations are not reported as external. A rejected play returns `{ available: false }` and leaves ordinary generator startup possible.

- [ ] **Step 5: Run GREEN and media-file checks**

Run:

```powershell
node --test tests/atmosphere-media-playback-carrier.test.mjs
ffprobe -v error -show_entries format=duration,format_name -show_entries stream=codec_name,channels,sample_rate -of json public/audio/atmosphere/media-session-carrier.mp3
git diff --check
```

- [ ] **Step 6: Commit**

```powershell
git add public/audio/atmosphere/media-session-carrier.mp3 lib/atmosphere/media-playback-carrier.js tests/atmosphere-media-playback-carrier.test.mjs
git commit -m "feat: add atmosphere media ownership carrier"
```

### Task 5: Add isolated Media Session and interruption adapters

**Files:**

- Create: `lib/atmosphere/media-session-controller.js`
- Create: `lib/atmosphere/media-interruption-monitor.js`
- Create: `tests/atmosphere-media-session-controller.test.mjs`
- Create: `tests/atmosphere-media-interruption-monitor.test.mjs`

- [ ] **Step 1: Write failing Media Session controller tests**

Cover capability absence, metadata construction, five handler registrations, handler replacement, unsupported-action exceptions, playback-state mapping, clear, and idempotent dispose:

```js
controller.publish({
  metadata: stationMetadata,
  playbackState: "paused",
  handlers,
})
assert.equal(mediaSession.playbackState, "paused")
assert.deepEqual([...registeredActions].sort(), [
  "nexttrack", "pause", "play", "previoustrack", "stop",
])
```

- [ ] **Step 2: Write failing interruption monitor tests**

Use injected EventTarget-like fakes. Prove all of these:

- Audio Session `interrupted` calls `onInterrupted` once and a later `active` calls `onRecovered` once.
- AudioContext `interrupted`/`running` behaves the same when Audio Session is absent.
- Carrier external pause without a specific signal calls `onAmbiguousPause`, never `onInterrupted`.
- Carrier internal pause/stop does nothing.
- `visibilitychange` while hidden never starts an interruption.
- Visibility return only recovers an already-observed interruption whose specific signal cleared.
- `dispose()` removes every listener and late events do nothing.

- [ ] **Step 3: Run RED**

```powershell
node --test tests/atmosphere-media-session-controller.test.mjs tests/atmosphere-media-interruption-monitor.test.mjs
```

Expected: both new modules missing.

- [ ] **Step 4: Implement the adapters with capability guards**

Keep browser types structural and injected; do not make tests depend on a real `navigator`. Set `audioSession.type = "playback"` only inside a guarded block when that property exists. Normalize AudioContext states as strings so WebKit's nonstandard `interrupted` value is accepted without weakening TypeScript elsewhere.

- [ ] **Step 5: Run GREEN and regression checks**

```powershell
node --test tests/atmosphere-media-session-controller.test.mjs tests/atmosphere-media-interruption-monitor.test.mjs tests/atmosphere-media-playback-carrier.test.mjs
npm run typecheck
git diff --check
```

- [ ] **Step 6: Commit**

```powershell
git add lib/atmosphere/media-session-controller.js lib/atmosphere/media-interruption-monitor.js tests/atmosphere-media-session-controller.test.mjs tests/atmosphere-media-interruption-monitor.test.mjs
git commit -m "feat: observe atmosphere media interruptions"
```

### Task 6: Integrate carrier, policy, Media Session, and interruptions in MusicProvider

**Files:**

- Modify: `components/providers/music-provider.tsx`
- Modify: `tests/music-visualizer-provider.test.mjs`
- Run unchanged regression: `tests/atmosphere-provider-lazy-boundary.test.mjs`
- Create: `tests/browser/music-media-session.spec.ts`

- [ ] **Step 1: Write failing provider behavior tests**

Install deterministic Media Session, Audio, and held generator-start fakes before the app loads. Exercise the real provider through `/music` and assert carrier-before-runtime ordering and distinct Pause/Stop behavior:

```ts
await startStation(page)
await expect.poll(() => mediaCalls(page)).toMatchObject({ play: 1 })
await expect(page.getByText("Preparing audio...")).toBeVisible()

await invokeMediaAction(page, "pause")
await expect(page.getByText("Paused")).toBeVisible()
await expect.poll(() => carrierSource(page)).not.toBe("")

await invokeMediaAction(page, "stop")
await expect(page.getByText("Stopped")).toBeVisible()
await expect.poll(() => carrierSource(page)).toBe("")
```

Also prove Play calls the carrier before the held generator preparation resolves, and update the existing stop-retains-station regression only as needed so it continues to protect selected identity after full in-app Stop.

- [ ] **Step 2: Run RED**

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "provider media ownership"
```

Expected: carrier calls/state and separate Pause/Stop semantics are absent.

- [ ] **Step 3: Initialize device/session state and browser adapters once**

Use refs for carrier, Media Session controller, monitor, and current lifecycle state. Hydrate the saved preference in a client effect through `() => window.localStorage`. Create browser adapters once and dispose them only on provider unmount; route changes must not duplicate them.

- [ ] **Step 4: Make Play claim media immediately and honor request results**

At the top of an accepted Play intent, before any `await`:

```ts
setPlaybackState("loading")
const carrierStartPromise = carrierRef.current?.start()
  ?? Promise.resolve({ available: false })
const runtimePromise = getRuntime()

const [carrierResult, runtime] = await Promise.all([
  carrierStartPromise,
  runtimePromise,
])
const station = runtime.getAtmosphereStationById(stationId)
const runtimeResult = await runtime.controller.start(station)
```

The carrier call is therefore made in the initiating event turn while the lazy runtime loads in parallel. Only the provider's current request may publish Playing/Failed, metadata, or progress. A carrier rejection sets `mediaIntegrationAvailable` false for the attempt but does not cancel a valid generator start.

- [ ] **Step 5: Implement exact action semantics**

- In-app Play from stopped/paused: new in-app lifecycle session and eligible notice.
- Media Session Play: fresh generator session, no notice while backgrounded.
- Media Session Pause: clear auto-resume eligibility, stop generator, `carrier.pauseRetained()`, preserve metadata, publish Paused.
- Media Session Stop and in-app Stop: invalidate request, stop generator, `carrier.stopAndDismiss()`, clear Media Session, publish Stopped while retaining selected station in app context.
- Previous/Next: continue the current session preference and replace metadata only after the new station becomes current.
- Specific interruption with preference enabled: publish Interrupted, stop/dispose generator while carrier/platform owns interrupted intent, resume fresh on recovery if the same session remains current.
- Specific interruption with preference disabled: become Paused and clear auto-resume eligibility.
- Ambiguous pause: become Paused and never auto-resume.

- [ ] **Step 6: Remove the old inline Media Session helper ownership**

Delete `AtmosphereMediaSession`, `mediaSessionActions`, `setAtmosphereMediaSessionMetadata`, `setAtmosphereMediaSessionHandler`, and `clearAtmosphereMediaSessionHandlers` from the provider after their replacement is wired. There must be one handler owner.

- [ ] **Step 7: Run GREEN and focused provider regressions**

```powershell
node --test tests/music-visualizer-provider.test.mjs tests/atmosphere-provider-lazy-boundary.test.mjs tests/atmosphere-runtime-controller.test.mjs tests/atmosphere-playback-lifecycle.test.mjs tests/atmosphere-media-session-controller.test.mjs tests/atmosphere-media-interruption-monitor.test.mjs tests/atmosphere-media-playback-carrier.test.mjs
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "provider media ownership"
npm run typecheck
git diff --check
```

- [ ] **Step 8: Commit**

```powershell
git add components/providers/music-provider.tsx tests/music-visualizer-provider.test.mjs tests/browser/music-media-session.spec.ts
git commit -m "feat: coordinate atmosphere media sessions"
```

### Task 7: Add Player settings and the 30-second session notice

**Files:**

- Create: `components/providers/music-interruption-notice.tsx`
- Modify: `components/providers/music-mini-player.tsx`
- Modify: `app/globals.css`
- Modify: `tests/music-visualizer-provider.test.mjs`
- Modify: `tests/browser/app-shell.spec.ts`

- [ ] **Step 1: Write failing rendered-control contracts**

Render the real player and require the expanded action order and exact accessible text:

```ts
const expandedActionNames = await player.getByRole("button").evaluateAll((buttons) =>
  buttons.map((button) => button.getAttribute("aria-label")),
)
expect(expandedActionNames).toEqual([
  "Previous station",
  "Play",
  "Next station",
  "Background",
  "Player settings",
  "Collapse",
])
await expect(notice).toContainText(
  "Calls and other audio may temporarily pause or mute this station.",
)
await expect(notice.getByRole("checkbox", {
  name: "Resume automatically when the interruption ends",
})).toBeChecked()
```

Require six narrow columns, no change to the collapsed three-control structure, nonmodal region semantics, polite live text, labeled Close action, and a functional settings checkbox. The existing source-oriented toolbar test may be updated to match the rendered implementation, but it is not the proof for these new behaviors.

- [ ] **Step 2: Add failing browser tests before UI implementation**

In `app-shell.spec.ts`, add focused mobile assertions for expanded/collapsed geometry, top/bottom placement, short landscape, safe-area clearance, and no horizontal control scrolling. Add fake-clock tests for the notice:

```ts
await page.clock.install()
await startStation(page)
await expect(notice).toBeVisible()
await page.clock.fastForward("29:59")
await expect(notice).toBeVisible()
await page.clock.fastForward("00:01")
await expect(notice).toBeHidden()
```

Also prove hover and focus pause the deadline, Close works by keyboard, checkbox changes only the active session, Previous/Next does not reopen the notice, and collapsed toolbar remains unchanged.

- [ ] **Step 3: Run RED**

```powershell
node --test tests/music-visualizer-provider.test.mjs
npm run test:browser -- tests/browser/app-shell.spec.ts --project=mobile-chromium --grep "Atmosphere interruption notice|six expanded player actions"
```

Expected: missing notice component/settings action and geometry assertions fail.

- [ ] **Step 4: Implement the notice timer as a pausable deadline**

The component owns only presentation/timing. Use remaining milliseconds rather than restarting 30 seconds after every hover/focus:

```ts
const deadlineRef = useRef(Date.now() + 30_000)
const remainingRef = useRef(30_000)

function pauseTimer() {
  remainingRef.current = Math.max(0, deadlineRef.current - Date.now())
  clearDismissTimer()
}

function resumeTimer() {
  deadlineRef.current = Date.now() + remainingRef.current
  scheduleDismiss(remainingRef.current)
}
```

Pause while either pointer hover or focus-within is active; resume only after both clear. Do not move or restore focus on open/close.

- [ ] **Step 5: Implement settings and responsive layout**

Insert a leaf-green horizontal-three-dot `Player settings` action between Background and Collapse. Use the existing dropdown primitives. The checkbox label in the menu is `Resume after interruptions`; changing it calls `setResumeAfterInterruptionDefault`, which updates saved and current-session values. Hide or clearly disable the option when `mediaIntegrationAvailable` is false.

Change only the expanded narrow action grid from `grid-cols-5` to `grid-cols-6`. Preserve the established 7rem/4.5rem content heights unless rendered tests prove the new control cannot fit. Position the notice outside the toolbar's layout reservation using the existing `--ml-audio-toolbar-height`, `--ml-safe-top`, and `--ml-safe-bottom` variables so it sits immediately beyond the toolbar without covering controls.

- [ ] **Step 6: Run GREEN and the full relevant shell matrix**

```powershell
node --test tests/music-visualizer-provider.test.mjs
npm run test:browser -- tests/browser/app-shell.spec.ts --project=mobile-chromium --grep "Atmosphere interruption notice|six expanded player actions|mobile top player|mobile bottom player|loading toolbar fits"
npm run test:browser -- tests/browser/app-shell.spec.ts --project=desktop-chromium --grep "Atmosphere"
npm run typecheck
git diff --check
```

- [ ] **Step 7: Commit**

```powershell
git add components/providers/music-interruption-notice.tsx components/providers/music-mini-player.tsx app/globals.css tests/music-visualizer-provider.test.mjs tests/browser/app-shell.spec.ts
git commit -m "feat: add atmosphere interruption preferences"
```

### Task 8: Add focused Chromium and WebKit lifecycle coverage

**Files:**

- Modify: `tests/browser/music-media-session.spec.ts`
- Modify: `tests/browser/public-routes.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Extract the existing media-session scenario into a focused failing spec**

Move or supersede `Atmosphere registers mobile media notification controls for active stations` from `public-routes.spec.ts`. Install deterministic `MediaSession`, `MediaMetadata`, `Audio`, `AudioContext`, and optional `audioSession` fakes through `page.addInitScript` before app code.

The fake audio element must expose events and call counts so the browser test can assert one carrier across route changes and station replacements.

- [ ] **Step 2: Add the complete lifecycle matrix**

Cover:

- Loading publishes active intent and Pause cancels a deliberately held startup.
- Playing metadata/artwork and all five action handlers.
- Notification Pause -> Paused, carrier source retained, generator stopped.
- Notification Play -> fresh Playing session without a background notice.
- Notification Stop -> Stopped, handlers/metadata cleared, carrier source cleared.
- Previous/Next preserves current session preference.
- Specific interruption enabled -> Interrupted -> fresh Playing on recovery.
- Specific interruption disabled -> Paused and no recovery.
- Explicit Pause or Stop followed by fake focus/visibility recovery never restarts.
- Ambiguous carrier pause remains Paused.
- Route changes reuse one carrier and one action-handler owner.
- Unsupported media APIs still allow ordinary in-app Playing and do not show the notice/setting as functional.

- [ ] **Step 3: Add a scoped WebKit project**

Append this project without expanding other specs to WebKit:

```ts
{
  name: "webkit-media-smoke",
  testMatch: /music-media-session\.spec\.ts/,
  use: {
    ...devices["Desktop Safari"],
    viewport: { width: 1024, height: 768 },
  },
}
```

The spec may gate engine-specific mock details with capability checks, but it must run the portable carrier lifecycle, unsupported fallback, Play/Pause/Stop semantics, and notice accessibility in both Chromium and WebKit. Do not label this project iOS certification.

- [ ] **Step 4: Run RED before filling missing production behavior**

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=mobile-chromium
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=webkit-media-smoke
```

Expected: any lifecycle path not completed by Tasks 4-7 fails here. Fix only the smallest relevant provider/adapter defect and rerun the exact failing case before the full spec.

- [ ] **Step 5: Run GREEN and adjacent route regressions**

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=mobile-chromium
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=webkit-media-smoke
npm run test:browser -- tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=mobile-chromium
npm run typecheck
git diff --check
```

- [ ] **Step 6: Commit**

```powershell
git add tests/browser/music-media-session.spec.ts tests/browser/public-routes.spec.ts playwright.config.ts
git commit -m "test: cover portable atmosphere media sessions"
```

### Task 9: Measure startup responsiveness and close regressions

**Files:**

- Modify if evidence requires: `lib/atmosphere/generative-fm-runtime.ts`
- Modify if evidence requires: `lib/atmosphere/runtime-controller.js`
- Modify: `tests/browser/music-media-session.spec.ts`
- Create: `docs/superpowers/qa/2026-08-14-atmosphere-startup-responsiveness.md`

- [ ] **Step 1: Establish repeatable cold/warm measurements**

Use the existing `massagelab:atmosphere-startup-timing` event. In Chromium desktop, measure the same three stations in a fresh context (cold) and then again in the same context (warm): `observable-streams`, `little-bells`, and one historically slow station (`moment`). Record carrier-call latency, Tone activation, preparation, piece activation, scheduling, total, sample format, request count, batch count, and cache hits.

Add a browser assertion that Play enters Loading and calls carrier `play()` in the initiating event turn, before the held sample-index request resolves. Add a Stop-during-each-phase matrix: module loading, sample-index fetch, provider decode, piece activation, and scheduling. Each late completion must remain Stopped and dispose any returned activation.

- [ ] **Step 2: Run focused responsiveness tests**

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "immediate carrier|latest request|startup timing"
node --test tests/atmosphere-runtime-controller.test.mjs tests/atmosphere-generative-fm-piece-loader.test.mjs
```

- [ ] **Step 3: Make only evidence-backed corrections**

Do not change sample concurrency. Fix only stale-publication, delayed-carrier, or duplicated-import behavior demonstrated by the focused tests. Record the before/after timing table and test environment in `docs/superpowers/qa/2026-08-14-atmosphere-startup-responsiveness.md`; do not claim network-wide performance from one local run.

- [ ] **Step 4: Run the relevant full browser matrix**

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=mobile-chromium
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=webkit-media-smoke
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add lib/atmosphere/generative-fm-runtime.ts lib/atmosphere/runtime-controller.js tests/browser/music-media-session.spec.ts docs/superpowers/qa/2026-08-14-atmosphere-startup-responsiveness.md
git commit -m "test: verify atmosphere startup responsiveness"
```

If the runtime files did not need correction, omit them from `git add`; do not create no-op source churn.

### Task 10: Complete physical Android acceptance, document the platform boundary, and run the final gate

**Files:**

- Create: `docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md`
- Modify: `docs/wiki/atmosphere-audio.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Recheck admin-interface overlap before canonical docs edits**

Run:

```powershell
git -C C:\Users\derri\.codex\worktrees\508f\massagelab status --short
git status --short
```

Compare every admin path with the four planned documentation paths. If an overlap appears, stop and warn the user before editing the overlapping file.

- [ ] **Step 2: Build a production-like candidate for device testing**

Run:

```powershell
npm run build
```

Serve the resulting candidate through the project's approved HTTPS/device-access workflow. Do not expose a development server or secrets publicly merely to reach a phone.

- [ ] **Step 3: Execute and record the Android matrix**

The QA report must identify device model, Android version, browser/PWA mode, browser version, date, station, saved preference, current-session preference, expected result, actual result, and pass/fail for each row:

1. Browser-tab playback shows notification drawer metadata/artwork.
2. Installed-PWA playback shows the same where installation is supported.
3. Lock-screen card shows station metadata.
4. Notification Pause stops audible generator and retains resumable card.
5. Notification Play starts a fresh generator session.
6. Notification Stop dismisses the card.
7. Bluetooth/headset Play/Pause behaves like Media Session Play/Pause.
8. Previous/Next changes station when the OS exposes those buttons and preserves session preference.
9. In-app Stop dismisses the card while retaining selected station in MassageLab.
10. Screen lock/background/return preserves the correct active or paused intent.
11. Ignored/declined incoming call with auto-resume enabled.
12. Ignored/declined incoming call with auto-resume disabled.
13. Answered/ended incoming call with auto-resume enabled.
14. Answered/ended incoming call with auto-resume disabled.
15. Zoom, Google Meet, or another available calling/media app that produces an observable interruption.
16. Forced carrier failure still permits ordinary in-app generator playback and hides unsupported promises.

For each call/meeting row, separately record: whether the OS muted/ducked audio, whether MassageLab entered Interrupted or Paused, whether the generator was torn down, and whether audible playback actually recovered. Do not rewrite an observed result to match the intended policy.

- [ ] **Step 4: Apply only validated physical-device fixes**

If a physical row fails, first add the smallest reproducible automated regression using the injected media/audio fakes. Establish RED, implement the fix, rerun the focused browser test, then repeat the physical row. Do not use device-only conditionals based on user agent when capability/state evidence can express the behavior.

- [ ] **Step 5: Update stable and canonical documentation**

Update `docs/wiki/atmosphere-audio.md` with carrier ownership, exact Pause/Play/Stop semantics, preference key/default, interruption limitations, per-piece loading, and startup telemetry. Update `docs/project-state.md` and append `docs/project-log.md` only with implemented and verified truth.

State Apple status exactly: portable WebKit implementation and focused engine smoke pass; physical iPhone/iPad notification, lock-screen, background, and real-call behavior remain pending until Apple hardware or an authorized remote-device service is available. Do not use “iOS certified” or equivalent language.

- [ ] **Step 6: Run the final automated gate**

Run each command separately:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/public-routes.spec.ts tests/browser/app-shell.spec.ts --project=mobile-chromium
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=webkit-media-smoke
git diff --check
git status --short
```

Expected: lint/typecheck/full Node/build pass; all relevant Chromium and focused WebKit tests pass; diff check is silent. `git status --short` may show only the four intended documentation files and any explicitly added physical-regression fix.

- [ ] **Step 7: Commit documentation and acceptance evidence**

```powershell
git add docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md docs/wiki/atmosphere-audio.md docs/project-state.md docs/project-log.md
git commit -m "docs: verify atmosphere media interruptions"
```

- [ ] **Step 8: Verify the exact committed branch**

```powershell
git status --short
git log --oneline --decorate -12
git diff --check 903e6def564d21427f72517a7e818de2e2b6a32a..HEAD
```

Expected: clean worktree, the planned task commits are present, and the full branch diff passes whitespace validation.

---

## Final Review Checklist

- [ ] One reusable carrier exists; route/station changes do not create duplicates.
- [ ] Carrier failure never blocks ordinary generator playback.
- [ ] Notification Pause retains the card; Stop dismisses it; Play starts fresh.
- [ ] In-app Stop dismisses the OS card but preserves selected station identity in the app.
- [ ] Explicit Pause/Stop cannot be overridden by late recovery signals.
- [ ] Automatic resume defaults enabled, persists locally, and can be overridden for one session.
- [ ] Notice opens only for eligible visible in-app new sessions, lasts 30 active seconds, and never blocks/overlaps controls.
- [ ] Expanded toolbar has six actions without overflow; collapsed toolbar is unchanged.
- [ ] Every one of the 57 piece IDs imports its dedicated package; the runtime path does not load the aggregate collection.
- [ ] Stop/replacement is latest-request-wins and every stale activation disposes exactly once.
- [ ] Sample concurrency and hosting/fallback behavior are unchanged.
- [ ] Chromium desktop/mobile and focused WebKit lifecycle tests pass.
- [ ] Android physical results are recorded without waivers or false claims.
- [ ] Apple physical-device behavior is explicitly pending, not certified.
- [ ] Cast, fullscreen-control changes, notification permission, backend/admin, and account synchronization remain absent from the branch.
