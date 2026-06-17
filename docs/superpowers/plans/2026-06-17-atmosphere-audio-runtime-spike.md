# Atmosphere Audio Runtime Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first hidden public Atmosphere runtime spike: a MassageLab-hosted audio provider, one audible local generator station, a disabled Generative.fm package probe station with attribution and sample-hosting findings, `/browse` controls, and a persistent bottom mini-player.

**Architecture:** Add a global client `MusicProvider` inside the existing root provider stack so audio state survives App Router navigation. Keep testable domain pieces in small JS modules under `lib/atmosphere`, use a browser-only Tone.js adapter for the audible proof station, and render `/browse` plus the bottom mini-player with existing MassageLab UI primitives. Generative.fm packages are installed and documented in this spike, but the first audible station uses a local Tone generator because the reusable sample-index/hosting source is not packaged with the selected piece.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tone.js 14.9.17, `@generative-music/web-provider` 3.0.0, `@generative-music/web-library` 0.2.2, `@generative-music/piece-observable-streams` 5.2.0, node:test, Playwright, existing `AppPageShell`/`AppSurface`/`Button`/`Slider` UI primitives.

---

## File Structure

- Modify `package.json`: add exact audio spike dependencies.
- Modify `package-lock.json`: lock the installed audio dependencies.
- Create `docs/wiki/atmosphere-audio.md`: package, licensing, attribution, and sample-hosting notes for the spike.
- Modify `docs/wiki/index.md`: link the Atmosphere audio wiki page.
- Create `lib/atmosphere/stations.js`: code-backed station catalog and source metadata.
- Create `lib/atmosphere/storage.js`: local storage schema constants, parser, serializer, and migration helpers.
- Create `lib/atmosphere/runtime-controller.js`: pure runtime controller that enforces stop-before-replace cleanup.
- Create `lib/atmosphere/tone-proof-runtime.ts`: browser-only Tone.js proof-station adapter.
- Replace `components/providers/music-provider.tsx`: global provider state, actions, local persistence, and runtime calls.
- Create `components/providers/music-mini-player.tsx`: persistent bottom mini-player UI.
- Modify `components/layout-wrapper.tsx`: render the mini-player in the global app shell with route-aware compact behavior.
- Replace `app/browse/page.tsx`: public hidden Atmosphere workspace for the runtime spike.
- Add `tests/atmosphere-stations.test.mjs`: station catalog and attribution tests.
- Add `tests/atmosphere-storage.test.mjs`: local schema parsing and migration tests.
- Add `tests/atmosphere-runtime-controller.test.mjs`: cleanup and replacement tests.
- Modify `tests/browser/public-routes.spec.ts`: include `/browse` smoke and add audio mini-player route-persistence coverage.

## Task 1: Install Audio Dependencies And Record Source Findings

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/wiki/atmosphere-audio.md`
- Modify: `docs/wiki/index.md`
- Test: `tests/atmosphere-stations.test.mjs` in Task 2 also checks the documented source metadata.

- [ ] **Step 1: Install exact spike dependencies**

Run:

```powershell
npm install tone@14.9.17 @generative-music/web-provider@3.0.0 @generative-music/web-library@0.2.2 @generative-music/piece-observable-streams@5.2.0
```

Expected: `package.json` and `package-lock.json` change. The dependency block in `package.json` includes these entries:

```json
{
  "@generative-music/piece-observable-streams": "5.2.0",
  "@generative-music/web-library": "0.2.2",
  "@generative-music/web-provider": "3.0.0",
  "tone": "14.9.17"
}
```

- [ ] **Step 2: Create the Atmosphere audio wiki page**

Create `docs/wiki/atmosphere-audio.md`:

```markdown
# Atmosphere Audio

This page records source, licensing, and runtime findings for the public Atmosphere audio branch series.

## Current Product Boundary

Atmosphere is a public, non-clinical audio workspace. It does not store PHI, therapist professional records, client appointment details, or clinical notes. The first implementation stays hidden from primary navigation while playback reliability, browser behavior, and source permissions are verified.

## Runtime Decision

MassageLab hosts the audio runtime in the app. It does not embed Generative.fm as a remote player UI. The first audible branch uses a small local Tone.js proof station so global audio lifecycle, route persistence, and cleanup can be validated before sample-heavy imported pieces are exposed.

## Package Findings

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `tone` | `14.9.17` | MIT | https://github.com/Tonejs/Tone.js |
| `@generative-music/web-provider` | `3.0.0` | MIT | https://github.com/generative-music/web-provider |
| `@generative-music/web-library` | `0.2.2` | MIT | https://github.com/generative-music/web-library |
| `@generative-music/piece-observable-streams` | `5.2.0` | MIT | https://github.com/generative-music/piece-observable-streams |

## Generative.fm Piece Probe

`@generative-music/piece-observable-streams` exports a default piece that activates through a Generative.fm-style sample library. Its package manifest lists these sample names:

- `observable-streams__vsco2-piano-mf`
- `observable-streams__vsco2-violin-arcvib`
- `observable-streams__sso-cor-anglais`

The selected package does not include the actual sample-index data needed to resolve those names to hosted audio files. Until MassageLab has explicit sample hosting or a documented first-party sample index, Observable Streams should remain a disabled catalog probe rather than a playable station.

## Attribution Draft

Observable Streams by Alex Bainter. Used as a Generative.fm package probe with permission and MIT package licensing. Before any imported piece becomes playable, verify sample file license, hosting rights, CORS behavior, and attribution wording.
```

- [ ] **Step 3: Link the wiki page**

Modify `docs/wiki/index.md` and add this bullet in the `Pages` list after `PWA offline strategy`:

```markdown
- [Atmosphere audio](atmosphere-audio.md)
```

- [ ] **Step 4: Verify dependency metadata**

Run:

```powershell
npm ls tone @generative-music/web-provider @generative-music/web-library @generative-music/piece-observable-streams
```

Expected: PASS with the installed versions listed and no missing-package errors.

- [ ] **Step 5: Commit dependency and source notes**

Run:

```powershell
git add package.json package-lock.json docs/wiki/atmosphere-audio.md docs/wiki/index.md
git commit -m "Add Atmosphere audio spike dependencies"
```

Expected: commit succeeds with only dependency and wiki changes.

## Task 2: Define The Station Catalog And Source Metadata

**Files:**
- Create: `lib/atmosphere/stations.js`
- Test: `tests/atmosphere-stations.test.mjs`

- [ ] **Step 1: Write the failing station catalog tests**

Create `tests/atmosphere-stations.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ATMOSPHERE_STATION_IDS,
  getAtmosphereStationById,
  getPlayableAtmosphereStations,
  getVisibleAtmosphereStations,
  listAtmosphereStations,
} from "../lib/atmosphere/stations.js"

describe("Atmosphere station catalog", () => {
  it("defines the runtime spike stations in stable order", () => {
    assert.deepEqual(ATMOSPHERE_STATION_IDS, [
      "mlab-proof-drone",
      "observable-streams-probe",
    ])

    assert.deepEqual(
      listAtmosphereStations().map((station) => station.id),
      ATMOSPHERE_STATION_IDS,
    )
  })

  it("exposes one playable MassageLab-hosted proof station", () => {
    const station = getAtmosphereStationById("mlab-proof-drone")

    assert.equal(station.title, "MassageLab Proof Drone")
    assert.equal(station.sourceType, "tone-generator")
    assert.equal(station.enabled, true)
    assert.equal(station.runtime.adapterId, "tone-proof-drone")
    assert.match(station.description, /MassageLab-hosted/i)
    assert.equal(station.attribution.license, "MassageLab internal proof")
  })

  it("keeps the Generative.fm package probe visible but not playable", () => {
    const station = getAtmosphereStationById("observable-streams-probe")

    assert.equal(station.sourceType, "generative-fm-piece")
    assert.equal(station.enabled, false)
    assert.equal(station.runtime.packageName, "@generative-music/piece-observable-streams")
    assert.deepEqual(station.runtime.sampleNames, [
      "observable-streams__vsco2-piano-mf",
      "observable-streams__vsco2-violin-arcvib",
      "observable-streams__sso-cor-anglais",
    ])
    assert.match(station.disabledReason, /sample-index/i)
    assert.equal(station.attribution.license, "MIT")
    assert.equal(station.attribution.artist, "Alex Bainter")
  })

  it("separates visible stations from playable stations", () => {
    assert.deepEqual(
      getVisibleAtmosphereStations().map((station) => station.id),
      ["mlab-proof-drone", "observable-streams-probe"],
    )
    assert.deepEqual(
      getPlayableAtmosphereStations().map((station) => station.id),
      ["mlab-proof-drone"],
    )
  })

  it("throws for unknown station ids", () => {
    assert.throws(
      () => getAtmosphereStationById("missing-station"),
      /Unknown Atmosphere station: missing-station/,
    )
  })
})
```

- [ ] **Step 2: Run the station tests and verify they fail**

Run:

```powershell
npm run test -- tests/atmosphere-stations.test.mjs
```

Expected: FAIL because `lib/atmosphere/stations.js` does not exist.

- [ ] **Step 3: Implement the station catalog**

Create `lib/atmosphere/stations.js`:

```js
// @ts-check

export const ATMOSPHERE_STATION_IDS = Object.freeze([
  "mlab-proof-drone",
  "observable-streams-probe",
])

const atmosphereStations = Object.freeze([
  {
    id: "mlab-proof-drone",
    title: "MassageLab Proof Drone",
    artist: "MassageLab",
    sourceType: "tone-generator",
    enabled: true,
    description:
      "A MassageLab-hosted Tone.js proof station for validating global playback, route persistence, and cleanup before imported sample-heavy generators are exposed.",
    tags: ["massage room", "soft drone", "runtime spike"],
    attribution: {
      artist: "MassageLab",
      license: "MassageLab internal proof",
      sourceUrl: "/browse",
      notice: "Original runtime proof station for MassageLab.",
    },
    runtime: {
      adapterId: "tone-proof-drone",
      defaultOptions: {
        baseFrequency: 110,
        detuneCents: 7,
        fadeSeconds: 1.2,
      },
    },
  },
  {
    id: "observable-streams-probe",
    title: "Observable Streams",
    artist: "Alex Bainter",
    sourceType: "generative-fm-piece",
    enabled: false,
    description:
      "A Generative.fm package probe kept disabled until MassageLab has explicit sample-index and sample-hosting coverage.",
    disabledReason:
      "The package is installable, but the selected piece does not include the sample-index data required to resolve its sample names to hosted audio files.",
    tags: ["Generative.fm", "acoustic", "sample-hosting probe"],
    attribution: {
      artist: "Alex Bainter",
      license: "MIT",
      sourceUrl: "https://github.com/generative-music/piece-observable-streams",
      notice:
        "Observable Streams by Alex Bainter. Package used as a disabled probe pending sample hosting verification.",
    },
    runtime: {
      adapterId: "generative-fm-piece",
      packageName: "@generative-music/piece-observable-streams",
      packageVersion: "5.2.0",
      sampleNames: [
        "observable-streams__vsco2-piano-mf",
        "observable-streams__vsco2-violin-arcvib",
        "observable-streams__sso-cor-anglais",
      ],
    },
  },
])

const stationsById = new Map(atmosphereStations.map((station) => [station.id, station]))

export function listAtmosphereStations() {
  return [...atmosphereStations]
}

export function getVisibleAtmosphereStations() {
  return listAtmosphereStations()
}

export function getPlayableAtmosphereStations() {
  return atmosphereStations.filter((station) => station.enabled)
}

export function getAtmosphereStationById(stationId) {
  const station = stationsById.get(stationId)
  if (!station) {
    throw new Error(`Unknown Atmosphere station: ${stationId}`)
  }
  return station
}
```

- [ ] **Step 4: Run the station tests and verify they pass**

Run:

```powershell
npm run test -- tests/atmosphere-stations.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the station catalog**

Run:

```powershell
git add lib/atmosphere/stations.js tests/atmosphere-stations.test.mjs
git commit -m "Add Atmosphere station catalog"
```

Expected: commit succeeds with catalog and tests.

## Task 3: Add Local Storage And Runtime Cleanup Helpers

**Files:**
- Create: `lib/atmosphere/storage.js`
- Create: `lib/atmosphere/runtime-controller.js`
- Test: `tests/atmosphere-storage.test.mjs`
- Test: `tests/atmosphere-runtime-controller.test.mjs`

- [ ] **Step 1: Write storage tests**

Create `tests/atmosphere-storage.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ATMOSPHERE_STORAGE_KEY,
  ATMOSPHERE_STORAGE_VERSION,
  createDefaultAtmosphereStorage,
  parseAtmosphereStorage,
  serializeAtmosphereStorage,
} from "../lib/atmosphere/storage.js"

describe("Atmosphere local storage helpers", () => {
  it("defines a versioned storage key", () => {
    assert.equal(ATMOSPHERE_STORAGE_KEY, "massagelab-atmosphere-v1")
    assert.equal(ATMOSPHERE_STORAGE_VERSION, 1)
  })

  it("creates safe defaults", () => {
    assert.deepEqual(createDefaultAtmosphereStorage(), {
      version: 1,
      favorites: [],
      recentStations: [],
      volume: 0.75,
      miniPlayerCollapsed: false,
    })
  })

  it("parses valid persisted storage and normalizes duplicates", () => {
    const parsed = parseAtmosphereStorage(JSON.stringify({
      version: 1,
      favorites: ["mlab-proof-drone", "mlab-proof-drone"],
      recentStations: ["observable-streams-probe", "mlab-proof-drone"],
      volume: 0.35,
      miniPlayerCollapsed: true,
    }))

    assert.deepEqual(parsed.favorites, ["mlab-proof-drone"])
    assert.deepEqual(parsed.recentStations, ["observable-streams-probe", "mlab-proof-drone"])
    assert.equal(parsed.volume, 0.35)
    assert.equal(parsed.miniPlayerCollapsed, true)
  })

  it("falls back to defaults for malformed or unsupported data", () => {
    assert.deepEqual(parseAtmosphereStorage("{not json"), createDefaultAtmosphereStorage())
    assert.deepEqual(parseAtmosphereStorage(JSON.stringify({ version: 99 })), createDefaultAtmosphereStorage())
  })

  it("serializes only supported fields", () => {
    assert.equal(
      serializeAtmosphereStorage({
        version: 1,
        favorites: ["mlab-proof-drone"],
        recentStations: ["mlab-proof-drone"],
        volume: 2,
        miniPlayerCollapsed: false,
        ignored: "not persisted",
      }),
      JSON.stringify({
        version: 1,
        favorites: ["mlab-proof-drone"],
        recentStations: ["mlab-proof-drone"],
        volume: 1,
        miniPlayerCollapsed: false,
      }),
    )
  })
})
```

- [ ] **Step 2: Write runtime cleanup tests**

Create `tests/atmosphere-runtime-controller.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createAtmosphereRuntimeController } from "../lib/atmosphere/runtime-controller.js"

describe("Atmosphere runtime controller", () => {
  it("starts a playable station and records the cleanup handle", async () => {
    const events = []
    const controller = createAtmosphereRuntimeController({
      adapters: {
        "tone-proof-drone": async ({ station }) => {
          events.push(`start:${station.id}`)
          return () => events.push(`stop:${station.id}`)
        },
      },
    })

    await controller.start({ id: "mlab-proof-drone", runtime: { adapterId: "tone-proof-drone" } })

    assert.equal(controller.getActiveStationId(), "mlab-proof-drone")
    assert.deepEqual(events, ["start:mlab-proof-drone"])
  })

  it("stops the previous station before replacement", async () => {
    const events = []
    const controller = createAtmosphereRuntimeController({
      adapters: {
        a: async ({ station }) => {
          events.push(`start:${station.id}`)
          return () => events.push(`stop:${station.id}`)
        },
      },
    })

    await controller.start({ id: "one", runtime: { adapterId: "a" } })
    await controller.start({ id: "two", runtime: { adapterId: "a" } })

    assert.equal(controller.getActiveStationId(), "two")
    assert.deepEqual(events, ["start:one", "stop:one", "start:two"])
  })

  it("clears active state when a station fails to start", async () => {
    const events = []
    const controller = createAtmosphereRuntimeController({
      adapters: {
        bad: async () => {
          events.push("start:bad")
          throw new Error("Audio failed")
        },
      },
    })

    await assert.rejects(
      () => controller.start({ id: "bad-station", runtime: { adapterId: "bad" } }),
      /Audio failed/,
    )

    assert.equal(controller.getActiveStationId(), null)
    assert.deepEqual(events, ["start:bad"])
  })

  it("throws when an adapter is missing", async () => {
    const controller = createAtmosphereRuntimeController({ adapters: {} })

    await assert.rejects(
      () => controller.start({ id: "missing", runtime: { adapterId: "missing-adapter" } }),
      /No Atmosphere runtime adapter registered: missing-adapter/,
    )
  })
})
```

- [ ] **Step 3: Run helper tests and verify they fail**

Run:

```powershell
npm run test -- tests/atmosphere-storage.test.mjs tests/atmosphere-runtime-controller.test.mjs
```

Expected: FAIL because helper modules do not exist.

- [ ] **Step 4: Implement storage helpers**

Create `lib/atmosphere/storage.js`:

```js
// @ts-check

export const ATMOSPHERE_STORAGE_KEY = "massagelab-atmosphere-v1"
export const ATMOSPHERE_STORAGE_VERSION = 1

export function createDefaultAtmosphereStorage() {
  return {
    version: ATMOSPHERE_STORAGE_VERSION,
    favorites: [],
    recentStations: [],
    volume: 0.75,
    miniPlayerCollapsed: false,
  }
}

export function parseAtmosphereStorage(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return createDefaultAtmosphereStorage()
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!parsed || parsed.version !== ATMOSPHERE_STORAGE_VERSION) {
      return createDefaultAtmosphereStorage()
    }

    return {
      version: ATMOSPHERE_STORAGE_VERSION,
      favorites: normalizeStringList(parsed.favorites),
      recentStations: normalizeStringList(parsed.recentStations).slice(0, 12),
      volume: clampVolume(parsed.volume),
      miniPlayerCollapsed: parsed.miniPlayerCollapsed === true,
    }
  } catch {
    return createDefaultAtmosphereStorage()
  }
}

export function serializeAtmosphereStorage(value) {
  return JSON.stringify({
    version: ATMOSPHERE_STORAGE_VERSION,
    favorites: normalizeStringList(value?.favorites),
    recentStations: normalizeStringList(value?.recentStations).slice(0, 12),
    volume: clampVolume(value?.volume),
    miniPlayerCollapsed: value?.miniPlayerCollapsed === true,
  })
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set()
  const result = []

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0 || seen.has(item)) {
      continue
    }
    seen.add(item)
    result.push(item)
  }

  return result
}

function clampVolume(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.75
  }
  return Math.min(1, Math.max(0, value))
}
```

- [ ] **Step 5: Implement runtime controller**

Create `lib/atmosphere/runtime-controller.js`:

```js
// @ts-check

export function createAtmosphereRuntimeController({ adapters }) {
  let activeStationId = null
  let cleanup = null

  async function stop() {
    const cleanupToRun = cleanup
    cleanup = null
    activeStationId = null

    if (typeof cleanupToRun === "function") {
      cleanupToRun()
    }
  }

  return {
    async start(station) {
      await stop()

      const adapterId = station?.runtime?.adapterId
      const adapter = adapters?.[adapterId]
      if (typeof adapter !== "function") {
        throw new Error(`No Atmosphere runtime adapter registered: ${adapterId}`)
      }

      const nextCleanup = await adapter({ station })
      activeStationId = station.id
      cleanup = typeof nextCleanup === "function" ? nextCleanup : null
    },
    stop,
    getActiveStationId() {
      return activeStationId
    },
  }
}
```

- [ ] **Step 6: Run helper tests and verify they pass**

Run:

```powershell
npm run test -- tests/atmosphere-storage.test.mjs tests/atmosphere-runtime-controller.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit helpers**

Run:

```powershell
git add lib/atmosphere/storage.js lib/atmosphere/runtime-controller.js tests/atmosphere-storage.test.mjs tests/atmosphere-runtime-controller.test.mjs
git commit -m "Add Atmosphere runtime helpers"
```

Expected: commit succeeds with helper modules and tests.

## Task 4: Implement Browser Runtime, Provider, And Mini-Player

**Files:**
- Create: `lib/atmosphere/tone-proof-runtime.ts`
- Replace: `components/providers/music-provider.tsx`
- Create: `components/providers/music-mini-player.tsx`
- Modify: `components/layout-wrapper.tsx`

- [ ] **Step 1: Create the Tone proof runtime**

Create `lib/atmosphere/tone-proof-runtime.ts`:

```ts
type ToneModule = typeof import("tone")

type ToneProofOptions = {
  baseFrequency?: number
  detuneCents?: number
  fadeSeconds?: number
  volume?: number
}

let activeVolumeNode: { volume: { rampTo: (value: number, rampTime: number) => unknown } } | null = null
let gainToDb: ((gain: number) => number) | null = null

export async function startToneProofDrone(options: ToneProofOptions = {}) {
  const Tone: ToneModule = await import("tone")

  await Tone.start()
  gainToDb = Tone.gainToDb

  const baseFrequency = options.baseFrequency ?? 110
  const detuneCents = options.detuneCents ?? 7
  const fadeSeconds = options.fadeSeconds ?? 1.2
  const volume = Math.min(1, Math.max(0, options.volume ?? 0.75))

  const output = new Tone.Volume(Tone.gainToDb(Math.max(0.001, volume))).toDestination()
  activeVolumeNode = output
  const filter = new Tone.Filter({ frequency: 1200, type: "lowpass", rolloff: -12 }).connect(output)
  const tremolo = new Tone.Tremolo({ frequency: 0.035, depth: 0.18 }).connect(filter)
  tremolo.start()

  const main = new Tone.Oscillator({ frequency: baseFrequency, type: "sine" }).connect(tremolo)
  const fifth = new Tone.Oscillator({
    frequency: baseFrequency * 1.5,
    type: "sine",
    volume: -16,
  }).connect(tremolo)
  fifth.detune.value = detuneCents

  output.volume.rampTo(Tone.gainToDb(Math.max(0.001, volume)), fadeSeconds)
  main.start()
  fifth.start("+0.2")

  return () => {
    output.volume.rampTo(-60, 0.2)
    window.setTimeout(() => {
      main.stop()
      fifth.stop()
      tremolo.stop()
      main.dispose()
      fifth.dispose()
      tremolo.dispose()
      filter.dispose()
      output.dispose()
      if (activeVolumeNode === output) {
        activeVolumeNode = null
      }
    }, 250)
  }
}

export function setToneProofDroneVolume(volume: number) {
  if (!activeVolumeNode || !gainToDb) {
    return
  }

  activeVolumeNode.volume.rampTo(gainToDb(Math.max(0.001, Math.min(1, Math.max(0, volume)))), 0.15)
}
```

- [ ] **Step 2: Replace the music provider**

Replace `components/providers/music-provider.tsx` with:

```tsx
"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { getAtmosphereStationById } from "@/lib/atmosphere/stations"
import {
  ATMOSPHERE_STORAGE_KEY,
  createDefaultAtmosphereStorage,
  parseAtmosphereStorage,
  serializeAtmosphereStorage,
} from "@/lib/atmosphere/storage"
import { createAtmosphereRuntimeController } from "@/lib/atmosphere/runtime-controller"
import { setToneProofDroneVolume, startToneProofDrone } from "@/lib/atmosphere/tone-proof-runtime"

type PlaybackState = "stopped" | "loading" | "playing" | "failed"

type MusicContextType = {
  activeStationId: string | null
  activeStationTitle: string | null
  playbackState: PlaybackState
  error: string | null
  favorites: string[]
  recentStations: string[]
  volume: number
  miniPlayerCollapsed: boolean
  playStation: (stationId: string) => Promise<void>
  stopCurrent: () => Promise<void>
  setVolume: (volume: number) => void
  toggleFavorite: (stationId: string) => void
  setMiniPlayerCollapsed: (collapsed: boolean) => void
}

const defaultStorage = createDefaultAtmosphereStorage()

const MusicContext = createContext<MusicContextType>({
  activeStationId: null,
  activeStationTitle: null,
  playbackState: "idle",
  error: null,
  favorites: defaultStorage.favorites,
  recentStations: defaultStorage.recentStations,
  volume: defaultStorage.volume,
  miniPlayerCollapsed: defaultStorage.miniPlayerCollapsed,
  playStation: async () => undefined,
  stopCurrent: async () => undefined,
  setVolume: () => undefined,
  toggleFavorite: () => undefined,
  setMiniPlayerCollapsed: () => undefined,
})

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [storageState, setStorageState] = useState(defaultStorage)
  const controllerRef = useRef<ReturnType<typeof createAtmosphereRuntimeController> | null>(null)
  const volumeRef = useRef(defaultStorage.volume)

  if (!controllerRef.current) {
    controllerRef.current = createAtmosphereRuntimeController({
      adapters: {
        "tone-proof-drone": async ({ station }) => {
          return startToneProofDrone({
            ...station.runtime.defaultOptions,
            volume: volumeRef.current,
          })
        },
      },
    })
  }

  useEffect(() => {
    setStorageState(parseAtmosphereStorage(window.localStorage.getItem(ATMOSPHERE_STORAGE_KEY)))
  }, [])

  useEffect(() => {
    window.localStorage.setItem(ATMOSPHERE_STORAGE_KEY, serializeAtmosphereStorage(storageState))
  }, [storageState])

  useEffect(() => {
    volumeRef.current = storageState.volume
    setToneProofDroneVolume(storageState.volume)
  }, [storageState.volume])

  useEffect(() => {
    return () => {
      void controllerRef.current?.stop()
    }
  }, [])

  const playStation = useCallback(async (stationId: string) => {
    const station = getAtmosphereStationById(stationId)

    if (!station.enabled) {
      setActiveStationId(station.id)
      setPlaybackState("failed")
      setError(station.disabledReason ?? "This station is not playable yet.")
      return
    }

    setPlaybackState("loading")
    setError(null)
    setActiveStationId(station.id)

    try {
      await controllerRef.current?.start(station)
      setPlaybackState("playing")
      setStorageState((current) => ({
        ...current,
        recentStations: [station.id, ...current.recentStations.filter((id) => id !== station.id)].slice(0, 12),
      }))
    } catch (caughtError) {
      setPlaybackState("failed")
      setError(caughtError instanceof Error ? caughtError.message : "Audio could not start.")
    }
  }, [])

  const stopCurrent = useCallback(async () => {
    await controllerRef.current?.stop()
    setPlaybackState("stopped")
    setActiveStationId(null)
    setError(null)
  }, [])

  const setVolume = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(1, Math.max(0, nextVolume))
    volumeRef.current = clampedVolume
    setToneProofDroneVolume(clampedVolume)
    setStorageState((current) => ({
      ...current,
      volume: clampedVolume,
    }))
  }, [])

  const toggleFavorite = useCallback((stationId: string) => {
    setStorageState((current) => {
      const isFavorite = current.favorites.includes(stationId)
      return {
        ...current,
        favorites: isFavorite
          ? current.favorites.filter((id) => id !== stationId)
          : [stationId, ...current.favorites],
      }
    })
  }, [])

  const setMiniPlayerCollapsed = useCallback((collapsed: boolean) => {
    setStorageState((current) => ({ ...current, miniPlayerCollapsed: collapsed }))
  }, [])

  const activeStationTitle = useMemo(() => {
    if (!activeStationId) return null
    return getAtmosphereStationById(activeStationId).title
  }, [activeStationId])

  const value = useMemo<MusicContextType>(() => ({
    activeStationId,
    activeStationTitle,
    playbackState,
    error,
    favorites: storageState.favorites,
    recentStations: storageState.recentStations,
    volume: storageState.volume,
    miniPlayerCollapsed: storageState.miniPlayerCollapsed,
    playStation,
    stopCurrent,
    setVolume,
    toggleFavorite,
    setMiniPlayerCollapsed,
  }), [activeStationId, activeStationTitle, error, playStation, playbackState, setMiniPlayerCollapsed, setVolume, stopCurrent, storageState, toggleFavorite])

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
}

export function useMusic() {
  return useContext(MusicContext)
}
```

- [ ] **Step 3: Create the mini-player**

Create `components/providers/music-mini-player.tsx`:

```tsx
"use client"

import { Pause, Play, Square, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { useMusic } from "./music-provider"

export function MusicMiniPlayer({ compact = false }: { compact?: boolean }) {
  const music = useMusic()
  const hasStation = Boolean(music.activeStationId)

  if (!hasStation && music.playbackState !== "failed") {
    return null
  }

  if (music.miniPlayerCollapsed || compact) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-md border border-border/80 bg-card/95 px-3 py-2 shadow-xl shadow-black/30 backdrop-blur">
          <span className="max-w-[11rem] truncate text-xs font-medium">
            {music.activeStationTitle ?? "Atmosphere"}
          </span>
          <Button size="sm" variant="secondary" onClick={() => void music.stopCurrent()}>
            <Square aria-hidden="true" />
            Stop
          </Button>
          {!compact ? (
            <Button size="sm" variant="ghost" onClick={() => music.setMiniPlayerCollapsed(false)}>
              Expand
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6">
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-md border border-border/80 bg-card/95 p-3 shadow-2xl shadow-black/35 backdrop-blur sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{music.activeStationTitle ?? "Atmosphere"}</p>
          <p className={cn("text-xs text-muted-foreground", music.error && "text-destructive")}>
            {music.error ?? playerStatusLabel(music.playbackState)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (music.activeStationId) void music.playStation(music.activeStationId)
            }}
            disabled={!music.activeStationId || music.playbackState === "loading"}
          >
            {music.playbackState === "playing" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {music.playbackState === "playing" ? "Restart" : "Play"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void music.stopCurrent()}>
            <Square aria-hidden="true" />
            Stop
          </Button>
        </div>
        <label className="flex min-w-36 items-center gap-2 text-xs text-muted-foreground">
          <Volume2 aria-hidden="true" className="size-4 shrink-0" />
          <Slider
            aria-label="Atmosphere volume"
            min={0}
            max={1}
            step={0.05}
            value={[music.volume]}
            onValueChange={([value]) => music.setVolume(value ?? 0.75)}
          />
        </label>
        <Button size="sm" variant="ghost" onClick={() => music.setMiniPlayerCollapsed(true)}>
          Collapse
        </Button>
      </div>
    </div>
  )
}

function playerStatusLabel(state: string) {
  if (state === "loading") return "Loading station..."
  if (state === "playing") return "Playing"
  if (state === "stopped") return "Stopped"
  if (state === "waiting-for-gesture") return "Tap play to start audio"
  return "Ready"
}
```

- [ ] **Step 4: Wire provider and player into the app shell**

Modify `app/layout.tsx`:

```tsx
import { MusicProvider } from "@/components/providers/music-provider"
```

Wrap the existing `SidebarProvider` block with `MusicProvider` inside `TherapistSettingsProvider`:

```tsx
<TherapistSettingsProvider syncEnabled={canSyncAccountSettings}>
  <MusicProvider>
    <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden bg-background">
      <SidebarCalendarProvider enabled={Boolean(user)}>
        <AppSidebarClient user={user} navigation={navigation} />
        <SidebarInset className="min-h-0 overflow-hidden bg-transparent">
          <main className="relative h-full min-w-0 overflow-hidden">
            <LayoutWrapper user={user} navigation={navigation}>{children}</LayoutWrapper>
          </main>
        </SidebarInset>
      </SidebarCalendarProvider>
    </SidebarProvider>
  </MusicProvider>
</TherapistSettingsProvider>
```

Modify `components/layout-wrapper.tsx`:

```tsx
import { MusicMiniPlayer } from "@/components/providers/music-mini-player"
```

Add route-aware player flags below the existing route booleans:

```tsx
const isChimerRoute = pathname.startsWith("/chimer")
const musicPlayerCompact = isChimerRoute
```

Render the player inside the shell after the scroll/content container:

```tsx
      <div
        className={cn(
          "ml-app-scroll relative z-10 min-h-0 w-full flex-1 overscroll-contain",
          isCalendarWorkspaceRoute ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        <div
          className={cn(
            "ml-app-content mx-auto w-full",
            isCalendarOperatorRoute || isPublicBookingRoute ? "max-w-none" : "max-w-screen-2xl",
            isCalendarWorkspaceRoute && "h-full min-h-0 pb-0",
            isFlashcardsRoute && "pb-0",
          )}
        >
          {children}
        </div>
      </div>
      <MusicMiniPlayer compact={musicPlayerCompact} />
```

- [ ] **Step 5: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit provider and mini-player**

Run:

```powershell
git add app/layout.tsx components/layout-wrapper.tsx components/providers/music-provider.tsx components/providers/music-mini-player.tsx lib/atmosphere/tone-proof-runtime.ts
git commit -m "Add global Atmosphere audio provider"
```

Expected: commit succeeds with provider and mini-player changes.

## Task 5: Replace `/browse` With The Hidden Atmosphere Runtime Workspace

**Files:**
- Replace: `app/browse/page.tsx`

- [ ] **Step 1: Replace the route with a client-backed shell**

Replace `app/browse/page.tsx`:

```tsx
import { AtmosphereWorkspace } from "./workspace"

export default function BrowsePage() {
  return <AtmosphereWorkspace />
}
```

- [ ] **Step 2: Create the workspace client component**

Create `app/browse/workspace.tsx`:

```tsx
"use client"

import { Heart, Play, Radio, Square } from "lucide-react"
import { AppNotice, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"
import { cn } from "@/lib/utils"
import { useMusic } from "@/components/providers/music-provider"

const stations = getVisibleAtmosphereStations()

export function AtmosphereWorkspace() {
  const music = useMusic()

  return (
    <AppPageShell width="full" contentClassName="pb-28">
      <section className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-normal text-primary">Atmosphere</p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">MassageLab-hosted audio stations</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              This hidden public workbench proves MassageLab's own audio runtime. Start the proof station, leave this page, and the bottom player should keep control of the sound.
            </p>
          </div>
          <AppNotice
            tone="accent"
            title="Runtime spike"
            description="Generative.fm packages are installed and documented, but sample-heavy imported pieces stay disabled until sample hosting is verified."
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {stations.map((station) => {
          const isActive = music.activeStationId === station.id
          const isFavorite = music.favorites.includes(station.id)
          return (
            <AppSurface
              key={station.id}
              title={station.title}
              icon={<Radio aria-hidden="true" className="size-5" />}
              badge={station.enabled ? "Playable" : "Probe"}
              className={cn(isActive && "border-primary/70")}
              contentClassName="gap-4"
            >
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{station.description}</p>
                <p className="text-xs text-muted-foreground">
                  {station.attribution.notice}
                </p>
                {!station.enabled && station.disabledReason ? (
                  <AppNotice tone="default" title="Not playable yet" description={station.disabledReason} />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void music.playStation(station.id)}
                  disabled={!station.enabled || music.playbackState === "loading"}
                >
                  <Play aria-hidden="true" />
                  {isActive ? "Restart station" : "Play station"}
                </Button>
                {isActive ? (
                  <Button variant="outline" onClick={() => void music.stopCurrent()}>
                    <Square aria-hidden="true" />
                    Stop
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => music.toggleFavorite(station.id)}>
                  <Heart aria-hidden="true" className={cn(isFavorite && "fill-primary text-primary")} />
                  {isFavorite ? "Favorited" : "Favorite"}
                </Button>
              </div>
            </AppSurface>
          )
        })}
      </section>
    </AppPageShell>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit the workspace route**

Run:

```powershell
git add app/browse/page.tsx app/browse/workspace.tsx
git commit -m "Build hidden Atmosphere workspace"
```

Expected: commit succeeds with `/browse` route changes.

## Task 6: Add Browser Coverage For Public Route And Global Playback State

**Files:**
- Modify: `tests/browser/public-routes.spec.ts`

- [ ] **Step 1: Add `/browse` to public route smoke coverage**

Modify `publicRoutes` in `tests/browser/public-routes.spec.ts` and add this item after `/chimer`:

```ts
{ path: "/browse", expectedText: /MassageLab-hosted audio stations/i },
```

- [ ] **Step 2: Add an Atmosphere route-persistence browser test**

Add this test after the homepage tests in `tests/browser/public-routes.spec.ts`:

```ts
test("Atmosphere proof station keeps global player state across routes", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/browse", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: /MassageLab-hosted audio stations/i })).toBeVisible()
  await page.getByRole("button", { name: /^Play station$/i }).first().click()

  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(page.getByText(/Playing|Loading station/i).last()).toBeVisible()

  await page.goto("/education/flashcards", { waitUntil: "domcontentloaded" })
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await page.getByRole("button", { name: /^Stop$/i }).last().click()
  await expect(page.getByText("MassageLab Proof Drone").last()).toHaveCount(0)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})
```

- [ ] **Step 3: Run the focused browser test**

Run:

```powershell
npm run test:browser -- tests/browser/public-routes.spec.ts -g "Atmosphere proof station"
```

Expected: PASS. If Chromium blocks audio output in headless mode, the UI should still pass because the click is a user gesture and the assertions target player state, not audible output.

- [ ] **Step 4: Commit browser coverage**

Run:

```powershell
git add tests/browser/public-routes.spec.ts
git commit -m "Cover Atmosphere global player behavior"
```

Expected: commit succeeds with browser test changes.

## Task 7: Run Full Validation And Update Project Docs

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Update current project state**

Modify `docs/project-state.md` in `Open Priorities` so the generative music bullet reads:

```markdown
- P2: Continue the Atmosphere audio branch series from the hidden runtime spike: `/browse` now proves a MassageLab-hosted global audio provider, a local Tone proof station, a disabled Generative.fm package probe with attribution/sample-hosting notes, and route-persistent mini-player behavior before public sidebar exposure, custom ambient mixes, Wellness breathing, account sync, feature gates, or YouTube support.
```

- [ ] **Step 2: Update chronological project log**

Add this entry under the `2026-06-17` log section, or create that date section above `2026-06-16` if needed:

```markdown
- Added the hidden Atmosphere audio runtime spike: `/browse` now hosts a public workbench for MassageLab-owned audio playback, the global music provider survives route navigation, the bottom mini-player controls active audio, the first audible station uses a local Tone.js proof generator, and the Generative.fm Observable Streams package remains a disabled probe until sample-index and sample-hosting rights are verified.
```

- [ ] **Step 3: Run code validation**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands pass.

- [ ] **Step 4: Run browser validation**

Run:

```powershell
npm run test:browser
```

Expected: PASS for desktop and mobile browser smoke coverage.

- [ ] **Step 5: Check diff hygiene**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: no whitespace errors; diff only includes Atmosphere audio runtime, docs, tests, and dependency changes.

- [ ] **Step 6: Final commit**

Run:

```powershell
git add docs/project-state.md docs/project-log.md
git commit -m "Document Atmosphere runtime spike"
```

Expected: commit succeeds. The branch is ready for review after the validation output is summarized.

## Self-Review Checklist

- The plan covers the first approved branch only: hidden runtime spike, not ambient mixer, Wellness breathing, generator controls, signed-in sync, paid gates, or YouTube.
- The plan installs and documents current package versions verified on 2026-06-17.
- The playable station is MassageLab-hosted and does not embed Generative.fm.
- The Generative.fm package probe is visible and attributed, but not playable until sample-index and sample-hosting are solved.
- The global provider is mounted in the root app shell so route navigation does not stop playback.
- The mini-player is route-aware and compact on Chimer routes.
- The local storage schema is versioned and stores only non-PHI audio preferences.
- Tests cover catalog shape, storage parsing, runtime cleanup, public route rendering, and player route persistence.
- Validation uses the repo's standard scripts.
