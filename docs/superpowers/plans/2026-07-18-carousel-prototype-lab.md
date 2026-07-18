# Carousel Prototype Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build six production-faithful carousel prototypes on the development-only `/dev/buttons` route so the user can choose one shared Background presentation and one Music Station presentation before any production rollout.

**Architecture:** Extract the duplicated Background catalog rules into one tested helper, then build a dev-only Embla controller whose behavior is shared by Existing, Cover Flow, and 3D presentation adapters. Real registry and Music-provider data flow through surface-specific card renderers; only the active surface/presentation is mounted, and its sanitized tuning remains local to the current device.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript/TSX, JavaScript helpers with Node test runner, existing `embla-carousel-react@8.5.1`, Tailwind CSS, CSS Modules, Radix/shadcn controls, Lucide icons, and Playwright 1.60.

## Global Constraints

- Track 3A changes `/dev/buttons` only except for behavior-preserving extraction of shared Background catalog helpers and the existing Music Station card.
- Do not replace production Clock, Chimer, BackgroundSelector, or Music rail carousel mechanics in Track 3A.
- Build exactly six combinations: Backgrounds and Music Stations crossed with Existing, Cover Flow, and 3D Carousel.
- Clock, active Chimer, and Music visualizer Backgrounds will share one later winner; do not create a third decision.
- Clicking or tapping a non-centered card only centers it. Selection, Play/Stop, Favorite, Save, and locked-access actions require a separate explicit control.
- Only the centered Background preview may mount and play video. Neighbors use posters; distant items use lightweight shells.
- Station artwork stays static. Prewarm only on centered, focused, hovered, or pressed intent.
- Reduced motion or Motion Off flattens every presentation to the same finite horizontal snap rail with no depth, rotation, scale animation, reflection, or animated masking.
- Cover Flow reflection applies to artwork only and defaults on.
- Add no autoplay, automatic advance, continuous spin, vertical carousel mode, shuffle-colors action, GSAP, ScrollTrigger, Tweakpane, iframe, or new runtime dependency.
- Store lab tuning only under `massagelab-carousel-lab-v1`; never account-sync it or consume it from production.
- Simulated access states never call Stripe, billing, cart, credit, subscription, or ownership mutations.
- Preserve the user-owned `TODO.md` worktree change and do not stage it.
- Add focused JSDoc/comments to non-obvious shared helpers as required by `AGENTS.md`.

---

## Scope Check

The approved spec already separates Track 3A prototype/review work from Track 3B production rollout. This plan implements Track 3A only. It ends at the user review gate with two winner choices still intentionally unknown; it must not create a production feature flag or infer winners from local storage.

## File Structure

- Create `lib/background-catalog.js`: shared Background filters, tags, preview selection, and saved-ID persistence.
- Create `tests/background-catalog.test.mjs`: pure catalog and malformed-storage coverage.
- Modify `components/backgrounds/BackgroundSelector.tsx`: consume the shared catalog helper without changing its production layout.
- Modify `app/chimer/running-timer.tsx`: consume the same helper while retaining the current radial carousel.
- Create `app/dev/buttons/carousel-lab/carousel-lab-model.js`: six tuning defaults, sanitization, storage parsing, identity reconciliation, mount-window math, and presentation variables.
- Create `tests/carousel-lab.test.mjs`: direct pure-model coverage.
- Create `app/dev/buttons/carousel-lab/use-carousel-lab-controller.ts`: shared Embla lifecycle, semantic index state, keyboard/focus behavior, live-region updates, and imperative transform writes.
- Create `app/dev/buttons/carousel-lab/carousel-stage.tsx`: generic accessible carousel stage and bounded full-card mounting.
- Create `app/dev/buttons/carousel-lab/carousel-stage.module.css`: Existing, Cover Flow, 3D, reduced-motion, reflection, responsive, and focus styling.
- Create `app/dev/buttons/carousel-lab/background-lab-card.tsx`: real registry card, centered-only media, saved state, and dev access popup.
- Create `app/dev/buttons/carousel-lab/background-lab-surface.tsx`: live Background filters, selection, access fixture, and carousel adapter.
- Create `components/atmosphere/station-carousel-card.tsx`: extracted production Station card with full and neighbor detail levels.
- Modify `app/browse/workspace.tsx`: use the extracted Station card while retaining the existing production rail.
- Create `app/dev/buttons/carousel-lab/station-lab-card.tsx`: thin adapter around the real Station card.
- Create `app/dev/buttons/carousel-lab/station-lab-surface.tsx`: real Music groups and per-category session positions.
- Create `app/dev/buttons/carousel-lab/tuning-panel.tsx`: adapter-relevant sliders/toggles and Reset.
- Create `app/dev/buttons/carousel-lab/carousel-lab.tsx`: surface/style tabs, real data, filters/categories, session positions, local tuning, and single active mount.
- Modify `app/dev/buttons/page.tsx`: add the Carousel Lab review tab.
- Create `tests/carousel-lab-source.test.mjs`: dev-boundary, dependency, source-isolation, and production-mechanics guards.
- Modify `tests/browser/control-system-review.spec.ts`: six-combination, interaction, persistence, access, media, keyboard, reduced-motion, and responsive coverage.
- Create `docs/carousel-sources.md`: CodePen URLs, attribution, MIT basis, native adaptation notes, and omissions.
- Modify `docs/project-state.md` and `docs/project-log.md`: record the implemented Track 3A review surface only after validation.

## Task 1: Shared Background Catalog Contract

**Files:**
- Create: `lib/background-catalog.js`
- Create: `tests/background-catalog.test.mjs`
- Modify: `components/backgrounds/BackgroundSelector.tsx:27-164`
- Modify: `app/chimer/running-timer.tsx:212-226, 755-933`

**Interfaces:**
- Produces: `BACKGROUND_VISUAL_FILTERS`, `BACKGROUND_SAVED_IDS_STORAGE_KEY`, `parseSavedBackgroundIds(raw)`, `readSavedBackgroundIds(storage)`, `writeSavedBackgroundIds(storage, ids)`, `getBackgroundPreviewMedia(option, preferredVariant)`, `matchesBackgroundVisualFilter(option, filter, savedIds)`, and `getBackgroundVisualTags(option)`.
- Consumes: registry-shaped objects with `id`, `label`, `provider`, `sourceUrl`, `recommendedUse`, `customizationSummary`, `motionIntensity`, `requiresSubscription`, and preview fields.

- [ ] **Step 1: Write the failing catalog tests**

Create `tests/background-catalog.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BACKGROUND_SAVED_IDS_STORAGE_KEY,
  BACKGROUND_VISUAL_FILTERS,
  getBackgroundPreviewMedia,
  getBackgroundVisualTags,
  matchesBackgroundVisualFilter,
  parseSavedBackgroundIds,
  readSavedBackgroundIds,
  writeSavedBackgroundIds,
} from "../lib/background-catalog.js"

const videoBackground = {
  id: "video",
  label: "Video field",
  provider: "MassageLab",
  sourceUrl: "https://example.test/demo",
  recommendedUse: "Animated ambient field",
  customizationSummary: "Interactive WebGL shader",
  motionIntensity: "medium",
  requiresSubscription: true,
  previewImageUrl: "/poster.webp",
  previewVideoUrl: "/preview.mp4",
}

describe("Background catalog helpers", () => {
  it("keeps the approved filter order", () => {
    assert.deepEqual(BACKGROUND_VISUAL_FILTERS.map(({ value }) => value), [
      "all", "static", "animated", "interactive", "shader",
      "image", "video", "premium", "saved",
    ])
  })

  it("selects preferred preview media deterministically", () => {
    assert.deepEqual(getBackgroundPreviewMedia(videoBackground, "landscape"), {
      type: "video",
      source: "/preview.mp4",
    })
    assert.equal(matchesBackgroundVisualFilter(videoBackground, "premium", []), true)
    assert.equal(matchesBackgroundVisualFilter(videoBackground, "saved", ["video"]), true)
    assert.deepEqual(getBackgroundVisualTags(videoBackground), [
      "Animated", "Interactive", "Shader", "Image", "Premium",
    ])
  })

  it("parses only unique string ids from storage", () => {
    assert.deepEqual(parseSavedBackgroundIds('["one",1,"one","two"]'), ["one", "two"])
    assert.deepEqual(parseSavedBackgroundIds("{broken"), [])
    assert.deepEqual(parseSavedBackgroundIds(null), [])
  })

  it("tolerates denied storage reads and writes", () => {
    const denied = {
      getItem() { throw new Error("denied") },
      setItem() { throw new Error("denied") },
    }
    assert.deepEqual(readSavedBackgroundIds(denied), [])
    assert.equal(writeSavedBackgroundIds(denied, ["one"]), false)

    const writes = []
    const storage = {
      getItem(key) {
        assert.equal(key, BACKGROUND_SAVED_IDS_STORAGE_KEY)
        return '["one"]'
      },
      setItem(key, value) { writes.push([key, value]) },
    }
    assert.deepEqual(readSavedBackgroundIds(storage), ["one"])
    assert.equal(writeSavedBackgroundIds(storage, ["one", "one", "two"]), true)
    assert.deepEqual(writes, [[BACKGROUND_SAVED_IDS_STORAGE_KEY, '["one","two"]']])
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/background-catalog.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/background-catalog.js`.

- [ ] **Step 3: Implement the shared catalog helper**

Create `lib/background-catalog.js` with `// @ts-check`, the nine approved filters, the existing interactive/shader hint arrays, and these public functions:

```js
// @ts-check

export const BACKGROUND_SAVED_IDS_STORAGE_KEY = "massagelab-chimer-saved-background-ids-v1"

export const BACKGROUND_VISUAL_FILTERS = Object.freeze([
  { value: "all", label: "All" },
  { value: "static", label: "Static" },
  { value: "animated", label: "Animated" },
  { value: "interactive", label: "Interactive" },
  { value: "shader", label: "Shader" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "premium", label: "Premium" },
  { value: "saved", label: "Saved" },
])

const INTERACTIVE_HINTS = ["interactive", "hover", "cursor", "rotate", "orbit", "spin", "mouse", "tap", "drag", "pan"]
const SHADER_HINTS = ["shader", "canvas", "webgl", "glsl", "fragment", "uniform", "three", "custom"]
const IMAGE_SUFFIXES = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".heic", ".heif", ".svg"]
const VIDEO_SUFFIXES = [".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"]

/** @param {unknown} raw @returns {string[]} */
export function parseSavedBackgroundIds(raw) {
  if (typeof raw !== "string") return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((entry) => typeof entry === "string"))]
  } catch {
    return []
  }
}

/** @param {{ getItem(key: string): string | null }} storage */
export function readSavedBackgroundIds(storage) {
  try {
    return parseSavedBackgroundIds(storage.getItem(BACKGROUND_SAVED_IDS_STORAGE_KEY))
  } catch {
    return []
  }
}

/** @param {{ setItem(key: string, value: string): void }} storage @param {string[]} ids */
export function writeSavedBackgroundIds(storage, ids) {
  try {
    storage.setItem(BACKGROUND_SAVED_IDS_STORAGE_KEY, JSON.stringify([...new Set(ids.filter((id) => typeof id === "string"))]))
    return true
  } catch {
    return false
  }
}

function sourceType(source) {
  const normalized = String(source ?? "").toLowerCase()
  if (VIDEO_SUFFIXES.some((suffix) => normalized.includes(suffix))) return "video"
  if (IMAGE_SUFFIXES.some((suffix) => normalized.includes(suffix)) || normalized.includes("/media/")) return "image"
  return null
}

/** @param {Record<string, any>} option @param {"landscape"|"square"|"vertical"} [preferredVariant] */
export function getBackgroundPreviewMedia(option, preferredVariant = "landscape") {
  const videos = preferredVariant === "vertical"
    ? [option.previewVerticalVideoUrl, option.previewSquareVideoUrl, option.previewVideoUrl]
    : preferredVariant === "square"
      ? [option.previewSquareVideoUrl, option.previewVideoUrl, option.previewVerticalVideoUrl]
      : [option.previewVideoUrl, option.previewSquareVideoUrl, option.previewVerticalVideoUrl]
  const candidates = [
    ...videos.map((source) => ({ type: "video", source })),
    { type: option.previewMediaType, source: option.previewMediaUrl },
    { type: "image", source: option.previewImageUrl },
    { type: sourceType(option.sourceUrl), source: option.sourceUrl },
  ]
  const match = candidates.find(({ type, source }) => source && (type === "image" || type === "video"))
  return match ? { type: match.type, source: match.source } : null
}

function isInteractive(option) {
  const text = [option.id, option.label, option.recommendedUse, option.customizationSummary].join(" ").toLowerCase()
  return INTERACTIVE_HINTS.some((hint) => text.includes(hint))
}

function isShader(option) {
  const text = [option.id, option.label, option.provider, option.sourceUrl, option.recommendedUse, option.customizationSummary].join(" ").toLowerCase()
  return SHADER_HINTS.some((hint) => text.includes(hint))
}

function hasMedia(option, type) {
  const media = getBackgroundPreviewMedia(option)
  if (type === "image") return Boolean(option.previewImageUrl || media?.type === "image")
  return Boolean(option.previewVideoUrl || option.previewSquareVideoUrl || option.previewVerticalVideoUrl || media?.type === "video")
}

/** @param {Record<string, any>} option @param {string} filter @param {string[]} savedIds */
export function matchesBackgroundVisualFilter(option, filter, savedIds) {
  if (filter === "all") return true
  if (filter === "saved") return savedIds.includes(option.id)
  if (filter === "premium") return Boolean(option.requiresSubscription)
  if (filter === "static") return option.motionIntensity === "static"
  if (filter === "animated") return option.motionIntensity !== "static"
  if (filter === "interactive") return isInteractive(option)
  if (filter === "shader") return isShader(option)
  if (filter === "image") return hasMedia(option, "image")
  if (filter === "video") return hasMedia(option, "video")
  return true
}

/** @param {Record<string, any>} option */
export function getBackgroundVisualTags(option) {
  const tags = [option.motionIntensity === "static" ? "Static" : "Animated"]
  if (isInteractive(option)) tags.push("Interactive")
  if (isShader(option)) tags.push("Shader")
  if (hasMedia(option, "image")) tags.push("Image")
  else if (hasMedia(option, "video")) tags.push("Video")
  tags.push(option.requiresSubscription ? "Premium" : "Free")
  return [...new Set(tags)]
}
```

- [ ] **Step 4: Replace duplicate consumers without changing their rendered structure**

In `BackgroundSelector.tsx`, import the shared exports, type its local filter as `(typeof BACKGROUND_VISUAL_FILTERS)[number]["value"]`, replace local-storage reads/writes with `readSavedBackgroundIds(window.localStorage)` and `writeSavedBackgroundIds(window.localStorage, ids)`, and delete the duplicated filter/tag functions.

In `running-timer.tsx`, import the same exports, keep the local `BackgroundVisualCategory` alias for existing state typing, replace `BACKGROUND_VISUAL_CATEGORIES` with `BACKGROUND_VISUAL_FILTERS`, call `matchesBackgroundVisualFilter`, `getBackgroundVisualTags`, and `getBackgroundPreviewMedia`, and replace the two saved-ID helpers with the shared storage functions. Do not change `activeBackgroundCarouselIndex`, `moveBackgroundCarousel`, pointer handlers, radial markup, or radial CSS.

- [ ] **Step 5: Run catalog and production source tests**

Run: `node --test tests/background-catalog.test.mjs tests/atmosphere-station-groups.test.mjs`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with no implicit-any errors from the JavaScript helper.

- [ ] **Step 6: Commit the shared catalog contract**

```bash
git add lib/background-catalog.js tests/background-catalog.test.mjs components/backgrounds/BackgroundSelector.tsx app/chimer/running-timer.tsx
git commit -m "Extract shared background catalog helpers"
```

## Task 2: Carousel Lab Model And Tuning Persistence

**Files:**
- Create: `app/dev/buttons/carousel-lab/carousel-lab-model.js`
- Create: `tests/carousel-lab.test.mjs`

**Interfaces:**
- Produces: `CAROUSEL_LAB_STORAGE_KEY`, `CAROUSEL_LAB_PAIRS`, `getDefaultCarouselLabTuning(surface, presentation)`, `sanitizeCarouselLabTuning(surface, presentation, value)`, `parseCarouselLabStorage(raw)`, `serializeCarouselLabStorage(record)`, `resolveEffectiveLoop(itemCount, visibleRadius, requested)`, `reconcileCenteredId(items, preferredId, selectedId)`, `getMountedItemIds(items, centeredId, visibleRadius, loop)`, and `getPresentationVariables(presentation, surface, progress, tuning, reducedMotion)`.
- Consumes: only plain data; this module must not import React, Embla, DOM APIs, account state, registry state, or Music state.

- [ ] **Step 1: Write the failing model tests**

Create `tests/carousel-lab.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CAROUSEL_LAB_PAIRS,
  CAROUSEL_LAB_STORAGE_KEY,
  getDefaultCarouselLabTuning,
  getMountedItemIds,
  getPresentationVariables,
  parseCarouselLabStorage,
  reconcileCenteredId,
  resolveEffectiveLoop,
  sanitizeCarouselLabTuning,
  serializeCarouselLabStorage,
} from "../app/dev/buttons/carousel-lab/carousel-lab-model.js"

const items = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: id }))

describe("Carousel Lab model", () => {
  it("defines exactly six independent surface/presentation pairs", () => {
    assert.equal(CAROUSEL_LAB_STORAGE_KEY, "massagelab-carousel-lab-v1")
    assert.deepEqual(CAROUSEL_LAB_PAIRS, [
      "backgrounds:existing", "backgrounds:cover-flow", "backgrounds:three-d",
      "stations:existing", "stations:cover-flow", "stations:three-d",
    ])
  })

  it("sanitizes shared and adapter-specific values", () => {
    assert.deepEqual(
      sanitizeCarouselLabTuning("backgrounds", "cover-flow", {
        cardWidth: 999,
        gap: -4,
        visibleRadius: 9.5,
        loop: "yes",
        motion: false,
        rotation: 34.4,
        centerScale: Infinity,
        edgeScale: 0.4,
        perspective: 901,
        reflection: false,
        reflectionOpacity: 0.43,
        reflectionGap: 7.7,
      }),
      {
        cardWidth: 280,
        gap: 0,
        visibleRadius: 4,
        loop: false,
        motion: false,
        rotation: 34,
        centerScale: 1.2,
        edgeScale: 0.6,
        perspective: 900,
        reflection: false,
        reflectionOpacity: 0.45,
        reflectionGap: 8,
      },
    )
  })

  it("resets malformed storage entries independently", () => {
    const parsed = parseCarouselLabStorage(JSON.stringify({
      version: 1,
      values: {
        "backgrounds:existing": { radius: 400 },
        "stations:three-d": "broken",
      },
    }))
    assert.equal(parsed["backgrounds:existing"].radius, 400)
    assert.deepEqual(parsed["stations:three-d"], getDefaultCarouselLabTuning("stations", "three-d"))
    assert.equal(Object.keys(parsed).length, 6)
    assert.deepEqual(parseCarouselLabStorage("{bad"), parseCarouselLabStorage(null))
    assert.deepEqual(parseCarouselLabStorage(serializeCarouselLabStorage(parsed)), parsed)
  })

  it("uses stable identity and a bounded nearby mount set", () => {
    assert.equal(reconcileCenteredId(items, "d", "b"), "d")
    assert.equal(reconcileCenteredId(items, "missing", "b"), "b")
    assert.equal(reconcileCenteredId(items, "missing", "also-missing"), "a")
    assert.equal(reconcileCenteredId([], "a", "b"), null)
    assert.deepEqual([...getMountedItemIds(items, "a", 1, false)], ["a", "b"])
    assert.deepEqual([...getMountedItemIds(items, "a", 1, true)], ["e", "a", "b"])
  })

  it("disables unstable loops and produces symmetric presentation variables", () => {
    assert.equal(resolveEffectiveLoop(5, 2, true), false)
    assert.equal(resolveEffectiveLoop(6, 2, true), true)
    assert.equal(resolveEffectiveLoop(20, 2, false), false)

    const tuning = getDefaultCarouselLabTuning("backgrounds", "cover-flow")
    const center = getPresentationVariables("cover-flow", "backgrounds", 0, tuning, false)
    const left = getPresentationVariables("cover-flow", "backgrounds", -1, tuning, false)
    const right = getPresentationVariables("cover-flow", "backgrounds", 1, tuning, false)
    assert.equal(center["--lab-scale"], "1.2")
    assert.equal(left["--lab-rotate-y"], "33deg")
    assert.equal(right["--lab-rotate-y"], "-33deg")
    assert.equal(getPresentationVariables("cover-flow", "backgrounds", 1, tuning, true)["--lab-scale"], "1")
  })
})
```

- [ ] **Step 2: Run the model test and verify failure**

Run: `node --test tests/carousel-lab.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `carousel-lab-model.js`.

- [ ] **Step 3: Implement defaults, sanitization, identity, and transforms**

Create `app/dev/buttons/carousel-lab/carousel-lab-model.js`. Use `// @ts-check`, freeze the exported pair list, and define the curated defaults exactly:

```js
// @ts-check

export const CAROUSEL_LAB_STORAGE_KEY = "massagelab-carousel-lab-v1"
export const CAROUSEL_LAB_PAIRS = Object.freeze([
  "backgrounds:existing", "backgrounds:cover-flow", "backgrounds:three-d",
  "stations:existing", "stations:cover-flow", "stations:three-d",
])

const sharedDefaults = {
  backgrounds: { cardWidth: 208, gap: 16, visibleRadius: 3, loop: false, motion: true },
  stations: { cardWidth: 208, gap: 20, visibleRadius: 2, loop: false, motion: true },
}
const adapterDefaults = {
  existing: { spread: 35, radius: 285, scaleFalloff: 0.08 },
  "cover-flow": {
    rotation: 33, centerScale: 1.2, edgeScale: 0.75, perspective: 900,
    reflection: true, reflectionOpacity: 0.4, reflectionGap: 8,
  },
  "three-d": {
    perspective: 320, arcAngle: 22, depth: 280, centerScale: 1.08,
    edgeScale: 0.78, nearMask: 0.9, farMask: 1.8,
  },
}

const ranges = {
  cardWidth: { backgrounds: [160, 280, 4], stations: [168, 320, 4] },
  gap: [0, 64, 2],
  visibleRadius: [1, 4, 1],
  spread: [15, 50, 1],
  radius: [160, 420, 5],
  scaleFalloff: [0.04, 0.15, 0.01],
  rotation: [0, 55, 1],
  centerScaleCover: [1, 1.35, 0.01],
  edgeScaleCover: [0.6, 1, 0.01],
  perspectiveCover: [400, 1600, 20],
  reflectionOpacity: [0, 0.65, 0.05],
  reflectionGap: [0, 24, 1],
  perspectiveThreeD: [240, 1200, 20],
  arcAngle: [12, 50, 1],
  depth: [80, 520, 10],
  centerScaleThreeD: [1, 1.3, 0.01],
  edgeScaleThreeD: [0.55, 1, 0.01],
  nearMask: [0.25, 1.5, 0.05],
  farMask: [1, 3, 0.05],
}

function numberAt(value, fallback, range) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  const [min, max, step] = range
  const clamped = Math.min(max, Math.max(min, numeric))
  return Number((Math.round(clamped / step) * step).toFixed(4))
}

export function getDefaultCarouselLabTuning(surface, presentation) {
  const common = sharedDefaults[surface] ?? sharedDefaults.backgrounds
  const adapter = adapterDefaults[presentation] ?? adapterDefaults.existing
  return { ...common, ...adapter }
}

export function sanitizeCarouselLabTuning(surface, presentation, value) {
  const input = value && typeof value === "object" ? value : {}
  const defaults = getDefaultCarouselLabTuning(surface, presentation)
  const output = {
    cardWidth: numberAt(input.cardWidth, defaults.cardWidth, ranges.cardWidth[surface] ?? ranges.cardWidth.backgrounds),
    gap: numberAt(input.gap, defaults.gap, ranges.gap),
    visibleRadius: numberAt(input.visibleRadius, defaults.visibleRadius, ranges.visibleRadius),
    loop: typeof input.loop === "boolean" ? input.loop : defaults.loop,
    motion: typeof input.motion === "boolean" ? input.motion : defaults.motion,
  }
  if (presentation === "existing") {
    if (surface === "stations") return output
    return {
      ...output,
      spread: numberAt(input.spread, defaults.spread, ranges.spread),
      radius: numberAt(input.radius, defaults.radius, ranges.radius),
      scaleFalloff: numberAt(input.scaleFalloff, defaults.scaleFalloff, ranges.scaleFalloff),
    }
  }
  if (presentation === "cover-flow") {
    return {
      ...output,
      rotation: numberAt(input.rotation, defaults.rotation, ranges.rotation),
      centerScale: numberAt(input.centerScale, defaults.centerScale, ranges.centerScaleCover),
      edgeScale: numberAt(input.edgeScale, defaults.edgeScale, ranges.edgeScaleCover),
      perspective: numberAt(input.perspective, defaults.perspective, ranges.perspectiveCover),
      reflection: typeof input.reflection === "boolean" ? input.reflection : defaults.reflection,
      reflectionOpacity: numberAt(input.reflectionOpacity, defaults.reflectionOpacity, ranges.reflectionOpacity),
      reflectionGap: numberAt(input.reflectionGap, defaults.reflectionGap, ranges.reflectionGap),
    }
  }
  return {
    ...output,
    perspective: numberAt(input.perspective, defaults.perspective, ranges.perspectiveThreeD),
    arcAngle: numberAt(input.arcAngle, defaults.arcAngle, ranges.arcAngle),
    depth: numberAt(input.depth, defaults.depth, ranges.depth),
    centerScale: numberAt(input.centerScale, defaults.centerScale, ranges.centerScaleThreeD),
    edgeScale: numberAt(input.edgeScale, defaults.edgeScale, ranges.edgeScaleThreeD),
    nearMask: numberAt(input.nearMask, defaults.nearMask, ranges.nearMask),
    farMask: numberAt(input.farMask, defaults.farMask, ranges.farMask),
  }
}

export function parseCarouselLabStorage(raw) {
  let values = {}
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : null
    values = parsed?.version === 1 && parsed.values && typeof parsed.values === "object" ? parsed.values : {}
  } catch {
    values = {}
  }
  return Object.fromEntries(CAROUSEL_LAB_PAIRS.map((key) => {
    const [surface, presentation] = key.split(":")
    return [key, sanitizeCarouselLabTuning(surface, presentation, values[key])]
  }))
}

export function serializeCarouselLabStorage(record) {
  const values = Object.fromEntries(CAROUSEL_LAB_PAIRS.map((key) => {
    const [surface, presentation] = key.split(":")
    return [key, sanitizeCarouselLabTuning(surface, presentation, record?.[key])]
  }))
  return JSON.stringify({ version: 1, values })
}

export function resolveEffectiveLoop(itemCount, visibleRadius, requested) {
  return Boolean(requested && itemCount > visibleRadius * 2 + 1)
}

export function reconcileCenteredId(items, preferredId, selectedId) {
  const ids = new Set(items.map(({ id }) => id))
  if (preferredId && ids.has(preferredId)) return preferredId
  if (selectedId && ids.has(selectedId)) return selectedId
  return items[0]?.id ?? null
}

export function getMountedItemIds(items, centeredId, visibleRadius, loop) {
  const result = new Set()
  const center = items.findIndex(({ id }) => id === centeredId)
  if (center < 0) return result
  for (let offset = -visibleRadius; offset <= visibleRadius; offset += 1) {
    const raw = center + offset
    if (!loop && (raw < 0 || raw >= items.length)) continue
    result.add(items[(raw + items.length) % items.length].id)
  }
  return result
}

export function getPresentationVariables(presentation, surface, progress, tuning, reducedMotion) {
  if (reducedMotion || tuning.motion === false || (presentation === "existing" && surface === "stations")) {
    return {
      "--lab-x": "0px", "--lab-z": "0px", "--lab-rotate-y": "0deg",
      "--lab-scale": "1", "--lab-opacity": "1",
    }
  }
  const distance = Math.min(1, Math.abs(progress) / Math.max(1, tuning.visibleRadius))
  if (presentation === "existing") {
    const angle = progress * tuning.spread
    const radians = angle * Math.PI / 180
    return {
      "--lab-x": `${(Math.sin(radians) * tuning.radius).toFixed(2)}px`,
      "--lab-z": `${((Math.cos(radians) - 1) * tuning.radius).toFixed(2)}px`,
      "--lab-rotate-y": `${(-angle * 0.45).toFixed(2)}deg`,
      "--lab-scale": String(Math.max(0.65, 1 - Math.abs(progress) * tuning.scaleFalloff)),
      "--lab-opacity": String(Math.max(0.28, 1 - distance * 0.55)),
    }
  }
  if (presentation === "cover-flow") {
    return {
      "--lab-x": "0px", "--lab-z": `${(-distance * 90).toFixed(2)}px`,
      "--lab-rotate-y": `${(-Math.sign(progress) * tuning.rotation * Math.min(1, Math.abs(progress))).toFixed(2)}deg`,
      "--lab-scale": String(tuning.centerScale + (tuning.edgeScale - tuning.centerScale) * distance),
      "--lab-opacity": String(Math.max(0.4, 1 - distance * 0.45)),
    }
  }
  return {
    "--lab-x": "0px",
    "--lab-z": `${(-distance * tuning.depth).toFixed(2)}px`,
    "--lab-rotate-y": `${(-progress * tuning.arcAngle).toFixed(2)}deg`,
    "--lab-scale": String(tuning.centerScale + (tuning.edgeScale - tuning.centerScale) * distance),
    "--lab-opacity": String(Math.max(0.18, 1 - distance * (tuning.farMask / 2.5))),
  }
}
```

- [ ] **Step 4: Run the model test and verify pass**

Run: `node --test tests/carousel-lab.test.mjs`

Expected: PASS for all five model cases.

- [ ] **Step 5: Commit the pure Carousel Lab model**

```bash
git add app/dev/buttons/carousel-lab/carousel-lab-model.js tests/carousel-lab.test.mjs
git commit -m "Add carousel lab tuning model"
```

## Task 3: Shared Embla Controller And Presentation Stage

**Files:**
- Create: `app/dev/buttons/carousel-lab/use-carousel-lab-controller.ts`
- Create: `app/dev/buttons/carousel-lab/carousel-stage.tsx`
- Create: `app/dev/buttons/carousel-lab/carousel-stage.module.css`
- Create: `tests/carousel-lab-source.test.mjs`

**Interfaces:**
- Consumes: `CarouselLabItem { id: string; label: string; disabled?: boolean }`, sanitized tuning, surface, presentation, initial/selected IDs, and `onCenteredItemChange(id)`.
- Produces: `useCarouselLabController(options)` with `viewportRef`, `centeredId`, `centeredIndex`, `mountedIds`, `effectiveLoop`, `canGoPrevious`, `canGoNext`, `centerItem(id, jump?)`, `goPrevious()`, `goNext()`, `handleKeyDown(event)`, `registerItemElement(id, element)`, and `statusText`.
- Produces: generic `CarouselStage<T>` whose `renderItem(item, state)` receives `centered`, `nearby`, and `detailLevel: "full" | "summary" | "shell"`; it also reports `effectiveLoop` through `onEffectiveLoopChange(value)`.

- [ ] **Step 1: Write failing source-boundary tests**

Create `tests/carousel-lab-source.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

describe("Carousel Lab source boundaries", () => {
  it("uses the existing Embla runtime and no source-demo dependencies", () => {
    const controller = read("app/dev/buttons/carousel-lab/use-carousel-lab-controller.ts")
    const stage = read("app/dev/buttons/carousel-lab/carousel-stage.tsx")
    const combined = `${controller}\n${stage}`
    assert.match(controller, /from "embla-carousel-react"/)
    assert.doesNotMatch(combined, /gsap|ScrollTrigger|Tweakpane|<iframe/i)
  })

  it("keeps presentation styling scoped to the lab", () => {
    const css = read("app/dev/buttons/carousel-lab/carousel-stage.module.css")
    assert.doesNotMatch(css, /(^|\n)\s*(body|:root|\*)\s*[{,]/)
    assert.match(css, /prefers-reduced-motion/)
    assert.match(css, /data-carousel-artwork/)
  })
})
```

- [ ] **Step 2: Run the source test and verify failure**

Run: `node --test tests/carousel-lab-source.test.mjs`

Expected: FAIL because the controller, stage, and CSS Module do not exist.

- [ ] **Step 3: Implement the controller hook**

Create `use-carousel-lab-controller.ts` with these exact public types and lifecycle:

```ts
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import {
  getMountedItemIds,
  getPresentationVariables,
  reconcileCenteredId,
  resolveEffectiveLoop,
} from "./carousel-lab-model"

export interface CarouselLabItem {
  id: string
  label: string
  disabled?: boolean
}

interface UseCarouselLabControllerOptions {
  items: readonly CarouselLabItem[]
  initialItemId?: string | null
  selectedItemId?: string | null
  surface: "backgrounds" | "stations"
  presentation: "existing" | "cover-flow" | "three-d"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  onCenteredItemChange?: (itemId: string) => void
}

export function useCarouselLabController(options: UseCarouselLabControllerOptions) {
  const { items, initialItemId, selectedItemId, surface, presentation, tuning, reducedMotion } = options
  const effectiveLoop = reducedMotion
    ? false
    : resolveEffectiveLoop(items.length, Number(tuning.visibleRadius), Boolean(tuning.loop))
  const [viewportRef, api] = useEmblaCarousel({
    align: "center",
    containScroll: effectiveLoop ? false : "trimSnaps",
    dragFree: false,
    loop: effectiveLoop,
    skipSnaps: false,
    duration: reducedMotion || tuning.motion === false ? 0 : 24,
  })
  const itemElements = useRef(new Map<string, HTMLElement>())
  const frameRef = useRef<number | null>(null)
  const onCenteredItemChangeRef = useRef(options.onCenteredItemChange)
  const [centeredId, setCenteredId] = useState<string | null>(() =>
    reconcileCenteredId(items, initialItemId, selectedItemId),
  )
  const [canGoPrevious, setCanGoPrevious] = useState(false)
  const [canGoNext, setCanGoNext] = useState(false)

  const centeredIndex = Math.max(0, items.findIndex(({ id }) => id === centeredId))
  const mountedIds = useMemo(
    () => getMountedItemIds(items, centeredId, Number(tuning.visibleRadius), effectiveLoop),
    [centeredId, effectiveLoop, items, tuning.visibleRadius],
  )

  useEffect(() => {
    onCenteredItemChangeRef.current = options.onCenteredItemChange
  }, [options.onCenteredItemChange])

  const writeTransforms = useCallback(() => {
    if (!api) return
    const snaps = api.scrollSnapList()
    const current = api.scrollProgress()
    items.forEach((item, index) => {
      let difference = (snaps[index] ?? 0) - current
      if (effectiveLoop && difference > 0.5) difference -= 1
      if (effectiveLoop && difference < -0.5) difference += 1
      const progress = difference * Math.max(1, items.length - 1)
      const variables = getPresentationVariables(presentation, surface, progress, tuning, reducedMotion)
      const element = itemElements.current.get(item.id)
      if (!element) return
      element.style.setProperty("--lab-progress", String(progress))
      Object.entries(variables).forEach(([name, value]) => element.style.setProperty(name, String(value)))
    })
  }, [api, effectiveLoop, items, presentation, reducedMotion, surface, tuning])

  const scheduleTransformWrite = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      writeTransforms()
    })
  }, [writeTransforms])

  useEffect(() => {
    if (!api) return
    const select = () => {
      const item = items[api.selectedScrollSnap()]
      setCenteredId(item?.id ?? null)
      setCanGoPrevious(effectiveLoop || api.canScrollPrev())
      setCanGoNext(effectiveLoop || api.canScrollNext())
      if (item) onCenteredItemChangeRef.current?.(item.id)
      scheduleTransformWrite()
    }
    select()
    api.on("select", select)
    api.on("reInit", select)
    api.on("scroll", scheduleTransformWrite)
    return () => {
      api.off("select", select)
      api.off("reInit", select)
      api.off("scroll", scheduleTransformWrite)
    }
  }, [api, effectiveLoop, items, scheduleTransformWrite])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    itemElements.current.forEach((element) => element.removeAttribute("style"))
    itemElements.current.clear()
  }, [])

  useEffect(() => {
    if (!api) return
    const nextId = reconcileCenteredId(items, centeredId, selectedItemId)
    const nextIndex = items.findIndex(({ id }) => id === nextId)
    if (nextIndex >= 0) api.scrollTo(nextIndex, true)
  }, [api, centeredId, items, selectedItemId])

  const centerItem = useCallback((id: string, jump = false) => {
    const index = items.findIndex((item) => item.id === id)
    if (index >= 0) api?.scrollTo(index, jump)
  }, [api, items])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); api?.scrollPrev() }
    if (event.key === "ArrowRight") { event.preventDefault(); api?.scrollNext() }
    if (!effectiveLoop && event.key === "Home") { event.preventDefault(); api?.scrollTo(0) }
    if (!effectiveLoop && event.key === "End") { event.preventDefault(); api?.scrollTo(items.length - 1) }
  }, [api, effectiveLoop, items.length])

  return {
    viewportRef,
    centeredId,
    centeredIndex,
    mountedIds,
    effectiveLoop,
    canGoPrevious,
    canGoNext,
    centerItem,
    goPrevious: () => api?.scrollPrev(),
    goNext: () => api?.scrollNext(),
    handleKeyDown,
    registerItemElement(id: string, element: HTMLElement | null) {
      if (element) itemElements.current.set(id, element)
      else itemElements.current.delete(id)
    },
    statusText: centeredId
      ? `${items[centeredIndex]?.label ?? "Item"}, item ${centeredIndex + 1} of ${items.length}`
      : "No carousel items",
  }
}
```

- [ ] **Step 4: Implement the generic stage**

Create `carousel-stage.tsx` with `CarouselStageProps<T extends CarouselLabItem>`, two labeled navigation buttons, one polite status node, and one slide shell per item. Include `onEffectiveLoopChange?: (value: boolean) => void`, call it from an effect when `controller.effectiveLoop` changes, and set `tabIndex={0}` plus `onKeyDown={controller.handleKeyDown}` on the element with `data-testid="carousel-lab-stage"`. The slide click handler must be exactly gated:

```tsx
onClick={(event) => {
  if (item.id === controller.centeredId) return
  if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return
  controller.centerItem(item.id)
}}
onFocusCapture={() => {
  if (item.id !== controller.centeredId) controller.centerItem(item.id)
}}
```

For each item calculate:

```ts
const nearby = controller.mountedIds.has(item.id)
const centered = controller.centeredId === item.id
const detailLevel = centered ? "full" : nearby ? "summary" : "shell"
```

Render `renderItem(item, { centered, nearby, detailLevel })` only for `full` and `summary`; render a fixed-size `aria-label={item.label}` lightweight shell for `shell`. Set `aria-current={centered ? "true" : undefined}`, `aria-label={`${item.label}, item ${index + 1} of ${items.length}`}`, `data-centered`, and `data-detail-level`. Only a centered full renderer may include focusable actions.

On the stage root set `data-surface={surface}`, `data-presentation={presentation}`, `data-reflection={presentation === "cover-flow" && tuning.reflection === true}`, and `data-reduced-motion={reducedMotion || tuning.motion === false}`. Set the sanitized card-width, gap, perspective, reflection-opacity, and reflection-gap CSS variables on that same root.

- [ ] **Step 5: Implement scoped presentation CSS**

Create `carousel-stage.module.css` with:

```css
.root {
  --lab-card-width: 208px;
  --lab-gap: 16px;
  min-width: 0;
}

.stage {
  perspective: var(--lab-perspective, 900px);
  overflow: clip;
  padding: clamp(1rem, 4vw, 3rem) max(3rem, calc((100% - var(--lab-card-width)) / 2));
  touch-action: pan-y pinch-zoom;
}

.track {
  display: flex;
  align-items: stretch;
  gap: var(--lab-gap);
}

.slide {
  flex: 0 0 min(var(--lab-card-width), calc(100vw - 5rem));
  min-width: 0;
  opacity: var(--lab-opacity, 1);
  transform:
    translate3d(var(--lab-x, 0), 0, var(--lab-z, 0))
    rotateY(var(--lab-rotate-y, 0deg))
    scale(var(--lab-scale, 1));
  transform-style: preserve-3d;
  transition: opacity 160ms ease;
}

.slide[data-centered="true"] { z-index: 10; }
.slide:focus-visible { outline: 3px solid hsl(var(--ring)); outline-offset: 4px; }

.root[data-presentation="cover-flow"][data-reflection="true"] [data-carousel-artwork] {
  -webkit-box-reflect: below var(--lab-reflection-gap, 8px)
    linear-gradient(transparent 45%, rgb(0 0 0 / var(--lab-reflection-opacity, 0.4)));
}

.root[data-presentation="three-d"] .stage {
  mask-image: linear-gradient(90deg, transparent, black 12%, black 88%, transparent);
}

.root[data-reduced-motion="true"] .slide {
  opacity: 1 !important;
  transform: none !important;
  transition: none !important;
}

.root[data-reduced-motion="true"] [data-carousel-artwork] {
  -webkit-box-reflect: unset !important;
}

.root[data-reduced-motion="true"][data-presentation="three-d"] .stage {
  mask-image: none;
}

@media (max-width: 640px) {
  .stage { padding-inline: max(2.5rem, calc((100% - var(--lab-card-width)) / 2)); }
}

@media (prefers-reduced-motion: reduce) {
  .slide {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .root [data-carousel-artwork] { -webkit-box-reflect: unset !important; }
  .root[data-presentation="three-d"] .stage { mask-image: none; }
}
```

Add visually hidden status styling and previous/next button placement without negative page overflow. Inline root variables must set card width, gap, perspective, reflection opacity, and reflection gap from sanitized tuning.

- [ ] **Step 6: Run the focused tests**

Run: `node --test tests/carousel-lab.test.mjs tests/carousel-lab-source.test.mjs`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS, including the generic renderer and Embla event cleanup.

- [ ] **Step 7: Commit the shared controller and adapters**

```bash
git add app/dev/buttons/carousel-lab/use-carousel-lab-controller.ts app/dev/buttons/carousel-lab/carousel-stage.tsx app/dev/buttons/carousel-lab/carousel-stage.module.css tests/carousel-lab-source.test.mjs
git commit -m "Add shared carousel prototype controller"
```

## Task 4: Real Background Prototype Surface

**Files:**
- Create: `app/dev/buttons/carousel-lab/background-lab-card.tsx`
- Create: `app/dev/buttons/carousel-lab/background-lab-surface.tsx`
- Modify: `tests/carousel-lab-source.test.mjs`

**Interfaces:**
- Consumes: enabled entries from `backgroundRegistry`, shared catalog filters/tags/media/saved IDs, `CarouselStage`, current presentation/tuning, and reduced-motion state.
- Produces: `LabBackgroundAccessState = "free" | "owned" | "subscriber-unlocked" | "credit-available" | "locked"`, `BackgroundLabCard`, and `BackgroundLabSurface`.
- Guarantees: only a centered full card may render `<video>`; summary cards render a poster/fallback; shell cards are supplied by `CarouselStage`.

- [ ] **Step 1: Extend source tests for the Background surface**

Add this case to `tests/carousel-lab-source.test.mjs` before creating the components:

```js
  it("uses real Background data with isolated access fixtures and centered-only video", () => {
    const surface = read("app/dev/buttons/carousel-lab/background-lab-surface.tsx")
    const card = read("app/dev/buttons/carousel-lab/background-lab-card.tsx")
    const combined = `${surface}\n${card}`

    assert.match(surface, /backgroundRegistry/)
    assert.match(surface, /matchesBackgroundVisualFilter/)
    assert.match(surface, /readSavedBackgroundIds/)
    assert.match(card, /detailLevel === "full" && centered/)
    assert.match(card, /Use free credit/)
    assert.match(card, /Buy for \$1/)
    assert.match(card, /Unlock all/)
    assert.doesNotMatch(combined, /fetch\(|stripe|checkout|server action/i)
  })
```

- [ ] **Step 2: Run the source test and verify failure**

Run: `node --test tests/carousel-lab-source.test.mjs`

Expected: FAIL because `background-lab-surface.tsx` and `background-lab-card.tsx` do not exist.

- [ ] **Step 3: Implement the Background card and media lifecycle**

Create `background-lab-card.tsx` with:

```tsx
"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Lock, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { getBackgroundPreviewMedia, getBackgroundVisualTags } from "@/lib/background-catalog"

export type LabBackgroundAccessState =
  | "free"
  | "owned"
  | "subscriber-unlocked"
  | "credit-available"
  | "locked"

export interface BackgroundLabCardProps {
  option: BackgroundDefinition
  centered: boolean
  detailLevel: "full" | "summary"
  accessState: LabBackgroundAccessState
  selected: boolean
  saved: boolean
  reducedMotion: boolean
  onSelect: () => void
  onToggleSaved: () => void
}

export function BackgroundLabCard(props: BackgroundLabCardProps) {
  const { option, centered, detailLevel, accessState, selected, saved, reducedMotion } = props
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [devOutcome, setDevOutcome] = useState("")
  const media = getBackgroundPreviewMedia(option, "landscape")
  const canUse = accessState === "free" || accessState === "owned" || accessState === "subscriber-unlocked"
  const showVideo = detailLevel === "full" && centered && !reducedMotion && media?.type === "video"

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const syncPlayback = () => {
      if (!showVideo || document.visibilityState !== "visible") {
        video.pause()
        return
      }
      void video.play().catch(() => undefined)
    }
    syncPlayback()
    document.addEventListener("visibilitychange", syncPlayback)
    return () => {
      document.removeEventListener("visibilitychange", syncPlayback)
      video.pause()
    }
  }, [showVideo])

  const requestSelection = () => {
    if (canUse) {
      setDevOutcome("")
      props.onSelect()
      return
    }
    setDecisionOpen(true)
  }

  return (
    <article className="grid h-full overflow-hidden rounded-xl border border-border bg-background/90">
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-t-xl"
        data-carousel-artwork
      >
        {showVideo ? (
          <video
            ref={videoRef}
            data-testid="carousel-background-video"
            src={media.source}
            muted
            loop
            playsInline
            preload="metadata"
            className="size-full object-cover"
            aria-hidden="true"
          />
        ) : media?.type === "image" || option.previewImageUrl ? (
          <Image
            src={media?.type === "image" ? media.source : option.previewImageUrl ?? ""}
            alt=""
            fill
            sizes="(max-width: 640px) 70vw, 280px"
            className="object-cover"
            unoptimized
            aria-hidden="true"
          />
        ) : (
          <div className="size-full" style={option.fallbackStyle ?? { background: "#0f172a" }} aria-hidden="true" />
        )}
      </div>

      <div className="grid gap-2 p-3">
        <div>
          <h3 className="font-semibold">{option.label}</h3>
          {detailLevel === "full" ? (
            <>
              <p className="text-xs text-muted-foreground">{option.provider}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {getBackgroundVisualTags(option).slice(0, 4).join(" - ")}
              </p>
            </>
          ) : null}
        </div>

        {detailLevel === "full" ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={requestSelection} size="sm">
              {!canUse ? <Lock aria-hidden="true" /> : null}
              {selected ? "Selected" : "Select"}
            </Button>
            <Button
              aria-label={`${saved ? "Unsave" : "Save"} ${option.label}`}
              aria-pressed={saved}
              onClick={props.onToggleSaved}
              size="icon"
              variant="outline"
            >
              <Star className={saved ? "fill-current" : ""} aria-hidden="true" />
            </Button>
          </div>
        ) : null}
        {devOutcome ? <p role="status" className="text-xs text-primary">{devOutcome}</p> : null}
      </div>

      <AlertDialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock {option.label}</AlertDialogTitle>
            <AlertDialogDescription>
              Development preview only. These actions do not change credits, purchases, or membership.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogAction onClick={() => setDevOutcome("Dev preview: Use free credit")}>
              Use free credit
            </AlertDialogAction>
            <AlertDialogAction onClick={() => setDevOutcome("Dev preview: Buy for $1")}>
              Buy for $1
            </AlertDialogAction>
            <AlertDialogAction onClick={() => setDevOutcome("Dev preview: Unlock all")}>
              Unlock all
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}
```

Keep the three `AlertDialogAction` controls inside the shown `AlertDialogFooter className="sm:flex-wrap"` and keep `AlertDialogCancel` last. Do not replace these actions with links or real mutations.

- [ ] **Step 4: Implement the Background surface**

Create `background-lab-surface.tsx`. Export:

```ts
interface BackgroundLabSurfaceProps {
  presentation: "existing" | "cover-flow" | "three-d"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  onEffectiveLoopChange: (value: boolean) => void
}
```

Implementation requirements:

```tsx
const enabledBackgrounds = backgroundRegistry.filter((option) => option.enabled)
const [filter, setFilter] = useState("all")
const [accessState, setAccessState] = useState<LabBackgroundAccessState>("free")
const [selectedId, setSelectedId] = useState<BackgroundId>(DEFAULT_BACKGROUND_ID as BackgroundId)
const [savedIds, setSavedIds] = useState<BackgroundId[]>([])

useEffect(() => {
  setSavedIds(readSavedBackgroundIds(window.localStorage) as BackgroundId[])
}, [])

const visibleOptions = useMemo(
  () => enabledBackgrounds.filter((option) =>
    matchesBackgroundVisualFilter(option, filter, savedIds),
  ),
  [filter, savedIds],
)
const filterCenterId = visibleOptions.some((option) => option.id === selectedId)
  ? selectedId
  : visibleOptions[0]?.id ?? null
```

Render all nine `BACKGROUND_VISUAL_FILTERS` as an accessible single-select group and all five access states in a labeled `Select`. Render `CarouselStage` with `key={filter}`, `initialItemId={filterCenterId}`, `selectedItemId={selectedId}`, and `onEffectiveLoopChange={props.onEffectiveLoopChange}`. The key intentionally restarts the filter view so the selected background is centered when present and the first result is centered otherwise. The filter buttons retain focus after the change. The empty state copy is exactly `No backgrounds match this filter.`

The Save handler must update state and call `writeSavedBackgroundIds(window.localStorage, nextIds)`. The Select handler changes only `selectedId` inside the dev surface. Pass `detailLevel`, `centered`, and `reducedMotion` to `BackgroundLabCard`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `node --test tests/background-catalog.test.mjs tests/carousel-lab.test.mjs tests/carousel-lab-source.test.mjs`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with `BackgroundDefinition`, `BackgroundId`, and AlertDialog props correctly typed.

- [ ] **Step 6: Commit the Background prototype**

```bash
git add app/dev/buttons/carousel-lab/background-lab-card.tsx app/dev/buttons/carousel-lab/background-lab-surface.tsx tests/carousel-lab-source.test.mjs
git commit -m "Add real background carousel prototypes"
```

## Task 5: Shared Music Station Card And Prototype Surface

**Files:**
- Create: `components/atmosphere/station-carousel-card.tsx`
- Create: `app/dev/buttons/carousel-lab/station-lab-card.tsx`
- Create: `app/dev/buttons/carousel-lab/station-lab-surface.tsx`
- Modify: `app/browse/workspace.tsx:319-509`
- Modify: `tests/carousel-lab-source.test.mjs`

**Interfaces:**
- Produces: `AtmosphereStationCarouselCard({ groupId, music, prewarmStation, station, detailLevel })`, with `detailLevel: "full" | "summary"`.
- Produces: `StationLabSurface({ presentation, tuning, reducedMotion })`.
- Consumes: `groupAtmosphereStations(getVisibleAtmosphereStations())`, `useMusic()`, and the shared `CarouselStage`.
- Guarantees: production `AtmosphereStationRail` retains its current headings, controls, rail scrolling, card content, Play/Stop/Favorite actions, loading state, attribution, and prewarm triggers.

- [ ] **Step 1: Extend source tests for real Station reuse**

Add:

```js
  it("reuses the production Station card and real Music provider in the lab", () => {
    const workspace = read("app/browse/workspace.tsx")
    const sharedCard = read("components/atmosphere/station-carousel-card.tsx")
    const labSurface = read("app/dev/buttons/carousel-lab/station-lab-surface.tsx")
    assert.match(workspace, /AtmosphereStationCarouselCard/)
    assert.match(sharedCard, /music\.playStation/)
    assert.match(sharedCard, /music\.stopCurrent/)
    assert.match(sharedCard, /music\.toggleFavorite/)
    assert.match(sharedCard, /MusicLoadingProgress/)
    assert.match(labSurface, /groupAtmosphereStations/)
    assert.match(labSurface, /getVisibleAtmosphereStations/)
    assert.match(labSurface, /useMusic\(\)/)
  })
```

- [ ] **Step 2: Run the source test and verify failure**

Run: `node --test tests/carousel-lab-source.test.mjs`

Expected: FAIL because the shared Station card and lab Station surface do not exist and `workspace.tsx` does not import the shared card.

- [ ] **Step 3: Extract the production Station card**

Create `components/atmosphere/station-carousel-card.tsx` by moving the current `AtmosphereStationCard` markup from `workspace.tsx:401-509` without changing copy or handlers. Export these props:

```ts
import type { useMusic } from "@/components/providers/music-provider"
import type { getVisibleAtmosphereStations } from "@/lib/atmosphere/stations"

export type AtmosphereStation = ReturnType<typeof getVisibleAtmosphereStations>[number]

export interface AtmosphereStationCarouselCardProps {
  groupId: string
  music: ReturnType<typeof useMusic>
  prewarmStation: (
    stationId: string,
    options?: { includeSamplePayloads?: boolean },
  ) => void
  station: AtmosphereStation
  detailLevel?: "full" | "summary"
}
```

The component defaults `detailLevel = "full"`. For `summary`, render the same `AtmosphereStationArtwork` and title but omit description, attribution, disabled notice, loading overlay, and every button. For `full`, preserve the current markup and handlers exactly. Keep `onFocus` and `onPointerEnter` on the article only in full mode; the lab wrapper owns summary-card centering.

Move `stationAttributionText`, `isExternalUrl`, and `canPrewarmCompressedSamplePayloads` with the card. Export `canPrewarmCompressedSamplePayloads` so the lab surface uses the same data-saver decision.

In `workspace.tsx`, import `AtmosphereStationCarouselCard`, replace only the card JSX inside `AtmosphereStationRail`, and delete the moved local card/helper functions. Leave `AtmosphereStationGridCard`, `AtmosphereStationRail`, `scrollRail`, and the initial idle prewarm behavior unchanged.

- [ ] **Step 4: Add the thin lab card adapter**

Create `station-lab-card.tsx`:

```tsx
"use client"

import {
  AtmosphereStationCarouselCard,
  type AtmosphereStation,
} from "@/components/atmosphere/station-carousel-card"
import { useMusic } from "@/components/providers/music-provider"

interface StationLabCardProps {
  groupId: string
  station: AtmosphereStation
  detailLevel: "full" | "summary"
  prewarmStation: (
    stationId: string,
    options?: { includeSamplePayloads?: boolean },
  ) => void
}

export function StationLabCard(props: StationLabCardProps) {
  const music = useMusic()
  return <AtmosphereStationCarouselCard {...props} music={music} />
}
```

- [ ] **Step 5: Implement category/session-position behavior**

Create `station-lab-surface.tsx` with module-level real data:

```ts
const stationGroups = groupAtmosphereStations(getVisibleAtmosphereStations())
```

Inside `StationLabSurface`:

```tsx
const music = useMusic()
const [groupId, setGroupId] = useState(stationGroups[0]?.id ?? "")
const positionsRef = useRef(new Map<string, string>())
const group = stationGroups.find((candidate) => candidate.id === groupId) ?? stationGroups[0]

const initialItemId =
  positionsRef.current.get(group.id)
  ?? (group.stations.some((station) => station.id === music.activeStationId)
    ? music.activeStationId
    : group.stations[0]?.id)

const prewarmStation = useCallback((
  stationId: string,
  options: { includeSamplePayloads?: boolean } = {},
) => {
  void music.prewarmStation(stationId, options)
}, [music])

const handleCenteredItemChange = useCallback((stationId: string) => {
  positionsRef.current.set(group.id, stationId)
  prewarmStation(stationId)
}, [group.id, prewarmStation])
```

Give `StationLabSurface` the same `onEffectiveLoopChange: (value: boolean) => void` prop as the Background surface. Render a labeled category `Select`, the selected group's real title/description, and `CarouselStage key={group.id}` with `initialItemId` and `onEffectiveLoopChange={props.onEffectiveLoopChange}`. The category key applies the saved session position or active-station fallback only when the category changes; do not add an effect that recenters on every playback-state update. Render `StationLabCard` for full/summary detail. Full cards retain explicit Play/Stop/Favorite actions; centering never invokes them.

- [ ] **Step 6: Run focused regression tests**

Run: `node --test tests/atmosphere-stations.test.mjs tests/atmosphere-station-groups.test.mjs tests/carousel-lab-source.test.mjs`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with the extracted Station type and `useMusic` return type.

- [ ] **Step 7: Commit the Station prototype**

```bash
git add components/atmosphere/station-carousel-card.tsx app/browse/workspace.tsx app/dev/buttons/carousel-lab/station-lab-card.tsx app/dev/buttons/carousel-lab/station-lab-surface.tsx tests/carousel-lab-source.test.mjs
git commit -m "Add real station carousel prototypes"
```

## Task 6: Carousel Lab Shell, Tuning Controls, And Six-Way Review

**Files:**
- Create: `app/dev/buttons/carousel-lab/tuning-panel.tsx`
- Create: `app/dev/buttons/carousel-lab/carousel-lab.tsx`
- Modify: `app/dev/buttons/page.tsx:15-21, 47-91`
- Modify: `tests/carousel-lab-source.test.mjs`

**Interfaces:**
- Consumes: all six sanitized tuning records, `BackgroundLabSurface`, `StationLabSurface`, and `CAROUSEL_LAB_STORAGE_KEY`.
- Produces: `CarouselLab`, one active surface/presentation mount, per-pair Reset, a compact tuning summary, and current-device persistence.
- Emits stable test hooks: `carousel-lab`, `carousel-lab-stage`, `carousel-lab-summary`, `carousel-surface-<surface>`, `carousel-presentation-<presentation>`, and `carousel-tuning-<field>`.

- [ ] **Step 1: Extend source tests for the shell boundary**

Add:

```js
  it("mounts one dev-only prototype and never imports the lab from production routes", () => {
    const page = read("app/dev/buttons/page.tsx")
    const lab = read("app/dev/buttons/carousel-lab/carousel-lab.tsx")
    const productionSources = [
      read("app/chimer/running-timer.tsx"),
      read("app/browse/workspace.tsx"),
      read("components/backgrounds/BackgroundSelector.tsx"),
    ].join("\n")

    assert.match(page, /<CarouselLab/)
    assert.match(lab, /massagelab-carousel-lab-v1|CAROUSEL_LAB_STORAGE_KEY/)
    assert.match(lab, /surface === "backgrounds"/)
    assert.match(lab, /<BackgroundLabSurface/)
    assert.match(lab, /<StationLabSurface/)
    assert.doesNotMatch(productionSources, /dev\/buttons\/carousel-lab|CarouselLab/)
  })
```

- [ ] **Step 2: Run the source test and verify failure**

Run: `node --test tests/carousel-lab-source.test.mjs`

Expected: FAIL because `CarouselLab` and `tuning-panel.tsx` do not exist and the page has no Carousel tab.

- [ ] **Step 3: Implement the focused tuning panel**

Create `tuning-panel.tsx` with:

```ts
interface TuningPanelProps {
  surface: "backgrounds" | "stations"
  presentation: "existing" | "cover-flow" | "three-d"
  value: Record<string, number | boolean>
  effectiveLoop: boolean
  reducedMotion: boolean
  onChange: (next: Record<string, number | boolean>) => void
  onReset: () => void
}
```

Use native range inputs with explicit labels and formatted values. Define these field lists in the file:

```ts
const sharedFields = [
  ["cardWidth", "Card width", 160, 320, 4, "px"],
  ["gap", "Gap", 0, 64, 2, "px"],
  ["visibleRadius", "Nearby radius", 1, 4, 1, ""],
] as const

const existingBackgroundFields = [
  ["spread", "Angular spread", 15, 50, 1, "deg"],
  ["radius", "Radius", 160, 420, 5, "px"],
  ["scaleFalloff", "Scale falloff", 0.04, 0.15, 0.01, ""],
] as const

const coverFlowFields = [
  ["rotation", "Side rotation", 0, 55, 1, "deg"],
  ["centerScale", "Center scale", 1, 1.35, 0.01, "x"],
  ["edgeScale", "Edge scale", 0.6, 1, 0.01, "x"],
  ["perspective", "Perspective", 400, 1600, 20, "px"],
  ["reflectionOpacity", "Reflection opacity", 0, 0.65, 0.05, ""],
  ["reflectionGap", "Reflection gap", 0, 24, 1, "px"],
] as const

const threeDFields = [
  ["perspective", "Perspective", 240, 1200, 20, "px"],
  ["arcAngle", "Arc angle", 12, 50, 1, "deg"],
  ["depth", "Depth", 80, 520, 10, "px"],
  ["centerScale", "Center scale", 1, 1.3, 0.01, "x"],
  ["edgeScale", "Edge scale", 0.55, 1, 0.01, "x"],
  ["nearMask", "Near mask falloff", 0.25, 1.5, 0.05, ""],
  ["farMask", "Far mask falloff", 1, 3, 0.05, ""],
] as const
```

Clamp Background card width to 280 and Station card width to 320 in the rendered input even though the shared descriptor spans both maxima. Render switches for Loop and Motion on every presentation; render Reflection only for Cover Flow. Show `Loop unavailable for this item count` when Loop is requested but `effectiveLoop` is false. Show `Reduced-motion rail` when device preference or Motion Off is active. Reset calls only `onReset`.

- [ ] **Step 4: Implement current-device persistence and one active mount**

Create `carousel-lab.tsx`. Its state and hydration path must use:

```tsx
"use client"

const [surface, setSurface] = useState<"backgrounds" | "stations">("backgrounds")
const [presentation, setPresentation] =
  useState<"existing" | "cover-flow" | "three-d">("existing")
const [records, setRecords] = useState(() => parseCarouselLabStorage(null))
const [storageHydrated, setStorageHydrated] = useState(false)
const [deviceReducedMotion, setDeviceReducedMotion] = useState(false)
const [effectiveLoop, setEffectiveLoop] = useState(false)

useEffect(() => {
  try {
    setRecords(parseCarouselLabStorage(window.localStorage.getItem(CAROUSEL_LAB_STORAGE_KEY)))
  } catch {
    setRecords(parseCarouselLabStorage(null))
  }
  setStorageHydrated(true)
}, [])

useEffect(() => {
  if (!storageHydrated) return
  try {
    window.localStorage.setItem(CAROUSEL_LAB_STORAGE_KEY, serializeCarouselLabStorage(records))
  } catch {
    // Device-only review tuning stays usable in memory when storage is denied.
  }
}, [records, storageHydrated])

useEffect(() => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  const update = () => setDeviceReducedMotion(query.matches)
  update()
  query.addEventListener("change", update)
  return () => query.removeEventListener("change", update)
}, [])

const pairKey = `${surface}:${presentation}`
const tuning = records[pairKey]
const reducedMotion = deviceReducedMotion || tuning.motion === false
```

Render two accessible segmented groups:

- **Surface:** Backgrounds, Music Stations.
- **Presentation:** Existing, Cover Flow, 3D Carousel.

Use actual conditional branches so only one surface is mounted:

```tsx
{surface === "backgrounds" ? (
  <BackgroundLabSurface
    key={pairKey}
    presentation={presentation}
    tuning={tuning}
    reducedMotion={reducedMotion}
    onEffectiveLoopChange={setEffectiveLoop}
  />
) : (
  <StationLabSurface
    key={pairKey}
    presentation={presentation}
    tuning={tuning}
    reducedMotion={reducedMotion}
    onEffectiveLoopChange={setEffectiveLoop}
  />
)}
```

Update one record through `sanitizeCarouselLabTuning(surface, presentation, next)`. Reset one record through `getDefaultCarouselLabTuning(surface, presentation)`. The summary text must include surface label, presentation label, card width, gap, nearby radius, loop effective state, and motion effective state.

Pass the `effectiveLoop` state to `TuningPanel`. Reset `effectiveLoop` to false in the surface/presentation change handlers before the newly mounted stage reports its resolved value. Do not create a global carousel store.

- [ ] **Step 5: Add the Carousel Lab page tab**

In `app/dev/buttons/page.tsx`:

```tsx
import { CarouselLab } from "./carousel-lab/carousel-lab"
```

Add `{ value: "carousels", label: "Carousels" }` after `cards-status` in `reviewSections`, then add:

```tsx
<TabsContent value="carousels" className="mt-0">
  <CarouselLab />
</TabsContent>
```

Do not remove or rename any existing review tab.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `node --test tests/carousel-lab.test.mjs tests/carousel-lab-source.test.mjs tests/background-catalog.test.mjs`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the complete review shell**

```bash
git add app/dev/buttons/carousel-lab/tuning-panel.tsx app/dev/buttons/carousel-lab/carousel-lab.tsx app/dev/buttons/page.tsx tests/carousel-lab-source.test.mjs
git commit -m "Add carousel comparison lab"
```

## Task 7: Browser Contract, Source Ledger, And Review Gate

**Files:**
- Modify: `tests/browser/control-system-review.spec.ts`
- Modify: `tests/carousel-lab-source.test.mjs`
- Create: `docs/carousel-sources.md`
- Modify: `docs/project-state.md:3, 27-47`
- Modify: `docs/project-log.md:7`

**Interfaces:**
- Produces: automated proof for six combinations, center-before-action, tuning persistence/reset, access isolation, one-video limit, keyboard navigation, reduced motion, cleanup, and phone overflow.
- Produces: a permanent source/license record.
- Ends with: a manual user review request for exactly two winner/default decisions; no Track 3B implementation.

- [ ] **Step 1: Write failing desktop interaction coverage**

Append to `tests/browser/control-system-review.spec.ts`:

```ts
  test("Carousel Lab exposes six real combinations with center-before-action", async ({ page }) => {
    await page.getByRole("tab", { name: "Carousels" }).click()
    await expect(page.getByTestId("carousel-lab")).toBeVisible()

    for (const surface of ["Backgrounds", "Music Stations"]) {
      await page.getByRole("button", { name: surface, exact: true }).click()
      for (const presentation of ["Existing", "Cover Flow", "3D Carousel"]) {
        await page.getByRole("button", { name: presentation, exact: true }).click()
        await expect(page.getByTestId("carousel-lab-stage")).toHaveCount(1)
        await expect(page.getByTestId("carousel-lab-summary")).toContainText(surface)
        await expect(page.getByTestId("carousel-lab-summary")).toContainText(presentation)
      }
    }

    await page.getByRole("button", { name: "Backgrounds", exact: true }).click()
    await page.getByRole("button", { name: "Existing", exact: true }).click()
    const slides = page.locator('[data-carousel-slide="true"]')
    expect(await slides.count()).toBeGreaterThan(2)
    const originalSelected = await page.locator('[data-background-selected="true"]').getAttribute("data-background-id")
    await slides.nth(1).click()
    await expect(slides.nth(1)).toHaveAttribute("data-centered", "true")
    expect(await page.locator('[data-background-selected="true"]').getAttribute("data-background-id")).toBe(originalSelected)
  })
```

Add `data-carousel-slide="true"` in `CarouselStage` and `data-background-id` plus `data-background-selected` in `BackgroundLabCard` before running this test.

- [ ] **Step 2: Add persistence, access, and media coverage**

Add:

```ts
  test("Carousel Lab persists tuning locally and keeps access actions mutation-free", async ({ page }) => {
    const mutationRequests: string[] = []
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.method() !== "HEAD") mutationRequests.push(request.url())
    })

    await page.getByRole("tab", { name: "Carousels" }).click()
    const width = page.getByTestId("carousel-tuning-cardWidth")
    await width.evaluate((input) => {
      const range = input as HTMLInputElement
      range.value = "248"
      range.dispatchEvent(new Event("input", { bubbles: true }))
      range.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("248px")
    await page.reload()
    await page.getByRole("tab", { name: "Carousels" }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("248px")

    await page.getByLabel("Background access state").selectOption("locked")
    await page.locator('[data-centered="true"]').getByRole("button", { name: /^Select/ }).click()
    await expect(page.getByRole("button", { name: "Use free credit" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Buy for $1" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Unlock all" })).toBeVisible()
    await page.getByRole("button", { name: "Buy for $1" }).click()
    await expect(page.getByText("Dev preview: Buy for $1")).toBeVisible()
    expect(mutationRequests).toEqual([])

    await expect(page.locator('video[data-testid="carousel-background-video"]')).toHaveCount(0)
    await page.getByLabel("Background visual filters").getByRole("button", { name: "Video" }).click()
    expect(await page.locator('video[data-testid="carousel-background-video"]').count()).toBeLessThanOrEqual(1)
  })
```

The test uses `locator.evaluate` because Playwright does not fill range inputs as text. Keep the expected sanitized value at 248 because the step is 4.

- [ ] **Step 3: Add keyboard, reduced-motion, cleanup, and phone coverage**

Add:

```ts
  test("Carousel Lab supports keyboard, reduced motion, cleanup, and phone width", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("tab", { name: "Carousels" }).click()
    await page.getByRole("button", { name: "3D Carousel", exact: true }).click()
    await expect(page.getByTestId("carousel-lab-summary")).toContainText("Reduced-motion rail")

    const stage = page.getByTestId("carousel-lab-stage")
    await stage.focus()
    await stage.press("End")
    await expect(page.locator('[data-carousel-slide="true"]').last()).toHaveAttribute("data-centered", "true")
    await stage.press("Home")
    await expect(page.locator('[data-carousel-slide="true"]').first()).toHaveAttribute("data-centered", "true")

    await page.getByRole("button", { name: "Music Stations", exact: true }).click()
    await expect(page.locator('video[data-testid="carousel-background-video"]')).toHaveCount(0)
    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(pageOverflows).toBe(false)
  })
```

In the same test, Tab from the stage and assert the first focusable card action belongs to `[data-centered="true"]`. Add a `page.on("console")` collector and assert no error messages after switching all three presentations.

- [ ] **Step 4: Run focused Playwright tests and make them pass**

Run: `npm run build`

Expected: PASS.

In PowerShell, set the development-route server command and port:

```powershell
$env:PLAYWRIGHT_PORT = "3102"
$env:PLAYWRIGHT_START_COMMAND = "npm run dev -- -p 3102"
```

Run: `npm run test:browser -- tests/browser/control-system-review.spec.ts --project=desktop-chromium`

Expected: PASS.

Run: `npm run test:browser -- tests/browser/control-system-review.spec.ts --project=mobile-chromium`

Expected: PASS.

- [ ] **Step 5: Add the source/license ledger**

Create `docs/carousel-sources.md`:

```markdown
# Carousel Prototype Sources

Verified: 2026-07-18

This ledger covers the third-party presentation ideas adapted only for MassageLab's development-only Carousel Lab. Public CodePens are MIT licensed under CodePen's public-Pen licensing policy: https://blog.codepen.io/documentation/licensing/

## Cover Flow

- Source: https://codepen.io/jh3y/pen/ZEqNVxx
- Source title: CSS Scroll Driven Animation Cover Flow - Infinite Edition
- Author: jh3y / Jhey
- License: MIT through CodePen's public-Pen policy
- Retained ideas: center emphasis, side-card Y rotation, scale falloff, stacking, optional artwork reflection
- MassageLab adaptation: React, existing Embla, scoped CSS Module, real Background and Music Station cards
- Omitted: source images, demo controls, global styles, automatic animation, and text/action reflection

## 3D Carousel

- Source: https://codepen.io/jh3y/pen/PovoorJ
- Source title: CSS Scroll-Driven Image Carousel
- Author: jh3y / Jhey
- License: MIT through CodePen's public-Pen policy
- Retained ideas: perspective arc, depth, center emphasis, edge falloff, and scroll-linked transforms
- MassageLab adaptation: React, existing Embla, bounded nearby cards, scoped CSS Module, and imperative CSS variables
- Omitted: source images, GSAP, ScrollTrigger, Tweakpane, global styles, vertical mode, backface demo behavior, and automatic animation

## Runtime Boundary

- No iframe or runtime source fetch is used.
- No new runtime dependency is added.
- Track 3A is review-only on /dev/buttons.
- Production use requires a separate Track 3B design after two explicit winner decisions.
```

Extend `tests/carousel-lab-source.test.mjs` to assert both CodePen URLs, the CodePen licensing URL, `MIT`, and the omitted names `GSAP`, `ScrollTrigger`, and `Tweakpane` are present in the ledger.

- [ ] **Step 6: Run the complete validation gate**

Run each command independently:

```powershell
node --test tests/background-catalog.test.mjs tests/carousel-lab.test.mjs tests/carousel-lab-source.test.mjs tests/atmosphere-stations.test.mjs tests/atmosphere-station-groups.test.mjs
npm run lint
npm run typecheck
npm run test
npm run build
$env:PLAYWRIGHT_PORT = "3102"
$env:PLAYWRIGHT_START_COMMAND = "npm run dev -- -p 3102"
npm run test:browser -- tests/browser/control-system-review.spec.ts
git diff --check
```

Expected: every command exits 0. Confirm `git diff --name-only` does not show production carousel-style replacement files beyond the approved helper/card extraction, and confirm `TODO.md` remains unstaged.

- [ ] **Step 7: Record the validated review surface**

In `docs/project-state.md`, change `Verified: 2026-07-16` to `Verified: 2026-07-18` and add this bullet under **Website And Tool Surface** after the control-system review checkpoint:

```markdown
- Carousel prototype review: the development-only `/dev/buttons` Carousel Lab compares Existing, Cover Flow, and 3D Carousel presentations with real Background and Music Station data through one Embla controller. Tuning is current-device-only, reduced motion uses a flat rail, simulated Background access cannot mutate billing, and production rollout remains blocked on explicit user approval of one shared Background winner and one Music Station winner.
```

Add this newest entry immediately before `## 2026-07-17` in `docs/project-log.md`:

```markdown
## 2026-07-18

- Implemented and validated the development-only Carousel Lab on `/dev/buttons`: six production-faithful combinations compare Existing, Cover Flow, and 3D presentations across real Background and Music Station cards with shared accessible Embla mechanics, bounded media/resource behavior, current-device tuning, reduced-motion fallback, and mutation-free access fixtures. Production carousel rollout remains paused until the user chooses one shared Background winner and one Music Station winner.

```

- [ ] **Step 8: Commit validation and documentation**

```bash
git add tests/browser/control-system-review.spec.ts tests/carousel-lab-source.test.mjs docs/carousel-sources.md docs/project-state.md docs/project-log.md
git commit -m "Validate carousel prototype review lab"
```

- [ ] **Step 9: Stop at the visual review gate**

Run the app, open `/dev/buttons`, and present all six combinations with their saved tuning summaries. Ask the user for exactly:

1. the shared Background winner and accepted default values; and
2. the Music Station winner and accepted default values.

Do not start Track 3B, change production carousels, or infer either choice from the last-open tab. After the user supplies both choices, begin a separate Track 3B brainstorming/specification pass against the then-current Track 1, Track 2, and Track 4 contracts.
