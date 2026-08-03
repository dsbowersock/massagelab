# Five-Card Adaptive Preview Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the centered background card plus two cards on each side play adaptive preview renditions, with poster-first rendering, shared connection/decode budgeting, loop-boundary quality changes, and accessible opt-in motion for Data Saver and reduced-motion users.

**Architecture:** The existing carousel already mounts the required five-card window at `visibleRadius: 2`; it will expose each mounted card's signed relative offset without changing geometry. Pure policy helpers select codec and tier from rendition metadata and bounded environment signals. A carousel-scoped coordinator measures fetch/decode health and allocates priority, while each preview component owns one abortable prepared source and swaps it only on the media `ended` boundary.

**Tech Stack:** React 19, Next.js, TypeScript, existing adaptive carousel, Fetch/AbortController/Blob URLs, HTMLVideoElement, Network Information hints where available, `node:test`, Playwright `desktop-chromium`.

## Global Constraints

- Execute only after the preview-pilot plan has produced and visually approved `BackgroundPreviewRenditionEntry` and frozen ladder presets.
- Reuse the existing five mounted background cards; do not change `visibleRadius: 2`, carousel geometry, station carousel behavior, or card detail semantics.
- Active playback offsets are exactly `-2`, `-1`, `0`, `1`, and `2`, deduplicated for collections smaller than five.
- Center download/decode priority is highest, offsets `-1/+1` are near priority, and offsets `-2/+2` are outer priority.
- On capable connections/devices, all five cards may reach their highest useful rendered-size tier.
- Adjacent cards downgrade before the center when bandwidth or decoding is constrained.
- Use Data Saver and connection APIs only as hints; measure actual rendition fetches and keep estimates session-local without analytics.
- Data Saver, detected very-slow connections, and reduced motion are poster-first with an accessible explicit `Play Preview` action on the centered full-detail card.
- Quality changes occur only at the authored loop boundary. Do not switch mid-loop.
- Failure order is selected rendition, lower tier, alternate codec, poster, registry fallback. Prevent repeated same-session retries.
- Cards outside the five-card window must not request video.
- Hidden tabs pause all five and suspend adaptation.
- Preserve current commerce, selection, favorite, entitlement, palette, and reduced-motion host behavior.
- Add JSDoc for priority allocation, throughput hysteresis, decode thresholds, object-URL lifecycle, and loop-boundary switching.

---

## File Structure

- Modify `components/carousels/adaptive-carousel-model.js`: signed relative-offset helper.
- Modify `components/carousels/adaptive-carousel-stage.tsx`: expose `relativeOffset` to renderers.
- Modify `tests/adaptive-carousel.test.mjs`: wrap, edge, and deduped offset coverage.
- Create `lib/background-preview-adaptation.js`: pure codec/tier, bitrate, hysteresis, and failure policy.
- Create `tests/background-preview-adaptation.test.mjs`: exhaustive policy tests.
- Create `components/backgrounds/background-preview-renditions.ts`: v2 manifest selection with v1 fallback.
- Modify `lib/background-catalog.js`: retain only legacy fallback selection; no adaptive state.
- Modify `tests/background-catalog.test.mjs`: v2 selection and v1 fallback coverage.
- Create `components/backgrounds/background-preview-fetch-cache.ts`: abortable measured Blob fetches and ref-counted object URLs.
- Create `components/backgrounds/background-preview-coordinator.tsx`: carousel-scoped shared policy/metric provider.
- Create `components/backgrounds/use-background-preview-playback.ts`: per-card preparation, cooldown, and fallback state machine.
- Modify `components/backgrounds/BackgroundPreviewMedia.tsx`: poster-first prepared-source playback and boundary switching.
- Modify `components/backgrounds/background-carousel.tsx`: provider and signed offsets.
- Modify `components/backgrounds/background-carousel-card.tsx`: five-card priority and accessible manual play.
- Modify `app/dev/bgpreviews/preview-pilot-review.tsx`: adaptive production-like fixture controls and diagnostics.
- Create `tests/browser/background-preview-adaptation.spec.ts`: request-count, constrained-mode, boundary, failure, and carousel-motion proof.
- Modify `tests/background-preview-media.test.mjs`: updated source contracts.
- Modify `docs/project-log.md` and `docs/project-state.md`: record validated runtime status without claiming full media rollout.

### Task 1: Expose each mounted card's signed relative offset

**Files:**
- Modify: `components/carousels/adaptive-carousel-model.js`
- Modify: `components/carousels/adaptive-carousel-stage.tsx`
- Modify: `tests/adaptive-carousel.test.mjs`

**Interfaces:**
- Produces: `getAdaptiveCarouselRelativeOffset(items, centeredId, itemId, visibleRadius, loop): number | null`.
- Extends: `AdaptiveCarouselItemRenderState` with `relativeOffset: number | null`.
- Consumed by: `background-carousel.tsx` in Task 6; station renderers may ignore the new field.

- [ ] **Step 1: Write failing wrapped-offset tests**

```js
import { getAdaptiveCarouselRelativeOffset } from "../components/carousels/adaptive-carousel-model.js"

it("resolves signed offsets inside the existing five-card window", () => {
  assert.deepEqual(items.map(({ id }) =>
    getAdaptiveCarouselRelativeOffset(items, "d", id, 2, true)
  ), [null, -2, -1, 0, 1, 2, null])
})

it("wraps signed offsets at carousel ends", () => {
  assert.equal(getAdaptiveCarouselRelativeOffset(items, "a", "g", 2, true), -1)
  assert.equal(getAdaptiveCarouselRelativeOffset(items, "a", "f", 2, true), -2)
  assert.equal(getAdaptiveCarouselRelativeOffset(items, "a", "d", 2, true), null)
})
```

- [ ] **Step 2: Run the focused test and verify missing export failure**

Run: `node --test tests/adaptive-carousel.test.mjs`
Expected: FAIL because `getAdaptiveCarouselRelativeOffset` is not exported.

- [ ] **Step 3: Implement the bounded signed-offset helper**

```js
export function getAdaptiveCarouselRelativeOffset(items, centeredId, itemId, visibleRadius, loop) {
  const center = items.findIndex(({ id }) => id === centeredId)
  const target = items.findIndex(({ id }) => id === itemId)
  if (center < 0 || target < 0) return null
  const matches = []
  for (let offset = -visibleRadius; offset <= visibleRadius; offset += 1) {
    const raw = center + offset
    const index = loop ? ((raw % items.length) + items.length) % items.length : raw
    if (index >= 0 && index < items.length && index === target) matches.push(offset)
  }
  return matches.sort((left, right) => Math.abs(left) - Math.abs(right) || left - right)[0] ?? null
}
```

For fewer than five unique items, return the smallest absolute matching offset, preferring the negative offset only when absolute values tie. Add a regression using three looped items.

- [ ] **Step 4: Pass the offset through the stage**

```ts
interface AdaptiveCarouselItemRenderState {
  centered: boolean
  nearby: boolean
  detailLevel: AdaptiveCarouselDetailLevel
  relativeOffset: number | null
}
```

Compute it beside `nearby` and `centered`, then pass the same value through all three `renderItem` branches. Do not change mounted IDs or detail levels.

- [ ] **Step 5: Run carousel tests and typecheck**

Run: `node --test tests/adaptive-carousel.test.mjs tests/carousel-lab.test.mjs tests/carousel-lab-source.test.mjs`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS after all render callbacks tolerate the added field.

- [ ] **Step 6: Commit the offset contract**

```bash
git add components/carousels/adaptive-carousel-model.js components/carousels/adaptive-carousel-stage.tsx tests/adaptive-carousel.test.mjs
git commit -m "Expose adaptive carousel relative offsets"
```

### Task 2: Implement pure adaptive tier and hysteresis policy

**Files:**
- Create: `lib/background-preview-adaptation.js`
- Create: `tests/background-preview-adaptation.test.mjs`

**Interfaces:**
- Produces: `getPreviewPriority(relativeOffset)`, `calculateRenditionBitrate(rendition)`, `resolveInitialPreviewPlan(input)`, `resolvePreviewTransition(input)`, and `resolveFailureFallback(input)`.
- `PreviewPriority`: `"center" | "near" | "outer" | null`.
- `PreviewPlan`: `{ mode: "auto" | "manual" | "poster", codec: "vp9" | "h264" | null, quality: "low" | "standard" | "high" | null }`.

- [ ] **Step 1: Write failing priority and constrained-mode tests**

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getPreviewPriority,
  resolveInitialPreviewPlan,
} from "../lib/background-preview-adaptation.js"

describe("background preview adaptation", () => {
  it("maps the five signed offsets to center, near, and outer priority", () => {
    assert.deepEqual([-3, -2, -1, 0, 1, 2, 3].map(getPreviewPriority), [
      null, "outer", "near", "center", "near", "outer", null,
    ])
  })

  it("keeps Data Saver and reduced motion poster-first", () => {
    const common = {
      priority: "center", renderedWidth: 280, devicePixelRatio: 2,
      effectiveType: "4g", supportedCodecs: ["vp9", "h264"],
      measuredBitsPerSecond: 20_000_000, renditions: fixtureRenditions,
    }
    assert.equal(resolveInitialPreviewPlan({ ...common, saveData: true, reducedMotion: false }).mode, "manual")
    assert.equal(resolveInitialPreviewPlan({ ...common, saveData: false, reducedMotion: true }).mode, "manual")
  })
})
```

- [ ] **Step 2: Run the focused test and verify missing module failure**

Run: `node --test tests/background-preview-adaptation.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement initial policy with explicit ceilings**

```js
export function getPreviewPriority(offset) {
  if (offset === 0) return "center"
  if (Math.abs(offset) === 1) return "near"
  if (Math.abs(offset) === 2) return "outer"
  return null
}

const UNKNOWN_START = Object.freeze({ center: "standard", near: "low", outer: "low" })
const PRIORITY_SHARE = Object.freeze({ center: 0.50, near: 0.15, outer: 0.10 })

export function calculateRenditionBitrate(rendition) {
  return rendition.bytes * 8 / (rendition.durationMs / 1000)
}
```

`resolveInitialPreviewPlan` must:

1. Return poster mode for null priority or no supported codec.
2. Return manual mode for `saveData`, `reducedMotion`, `slow-2g`, or `2g`.
3. Prefer VP9 when supported, then H.264.
4. Cap quality by the smallest tier whose width is at least `renderedWidth * devicePixelRatio`; never download pixels that cannot be displayed.
5. On unknown throughput, use `UNKNOWN_START` capped by rendered size.
6. On measured throughput, allocate the priority share and choose the highest tier whose bitrate multiplied by a 1.5 safety factor fits that allocation.

- [ ] **Step 4: Add failing transition and failure-chain tests**

```js
it("upgrades only after two healthy loops and sufficient headroom", () => {
  assert.deepEqual(resolvePreviewTransition({
    quality: "low", nextQuality: "standard", atLoopBoundary: true,
    successfulLoops: 2, cooldownLoops: 0, stalls: 0, droppedFrameRatio: 0.01,
    measuredBitsPerSecond: 3_000_000, requiredBitsPerSecond: 1_500_000,
  }), { action: "upgrade", quality: "standard", cooldownLoops: 2 })
})

it("uses rendition, lower tier, alternate codec, then poster", () => {
  assert.deepEqual(resolveFailureFallback({ quality: "standard", codec: "vp9", failed: [] }), {
    quality: "low", codec: "vp9", terminal: false,
  })
})
```

- [ ] **Step 5: Implement boundary-only hysteresis**

Return `none` away from a boundary. Upgrade only after two healthy loops, no cooldown, dropped-frame ratio below `0.04`, zero stalls, and measured throughput at least `1.5 * required`. Downgrade after two stalls, dropped-frame ratio above `0.08`, or measured throughput below `1.1 * required`. Every switch starts a two-loop cooldown. `resolveFailureFallback` records attempted `(quality, codec)` pairs and never returns the same pair twice.

- [ ] **Step 6: Run the policy tests**

Run: `node --test tests/background-preview-adaptation.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit the pure policy**

```bash
git add lib/background-preview-adaptation.js tests/background-preview-adaptation.test.mjs
git commit -m "Add adaptive background preview policy"
```

### Task 3: Resolve v2 renditions with a bounded legacy fallback

**Files:**
- Create: `components/backgrounds/background-preview-renditions.ts`
- Modify: `lib/background-catalog.js`
- Modify: `tests/background-catalog.test.mjs`

**Interfaces:**
- Consumes: `backgroundPreviewRenditionManifest`, a background ID, aspect, browser codec support, and legacy registry media.
- Produces: `getBackgroundPreviewRenditionSet(input): { entry, posterUrl, renditions, legacyVideoUrl }`.
- The returned `renditions` are sorted quality low/standard/high and codec VP9/H.264.

- [ ] **Step 1: Add failing v2 selection tests**

```js
it("selects one aspect from the v2 rendition entry without mixing poster shapes", () => {
  const selected = getBackgroundPreviewRenditionSet({
    backgroundId: "pilot", aspect: "vertical", entry: fixtureEntry,
    legacy: { previewVerticalVideoUrl: "/legacy.webm", previewVerticalImageUrl: "/legacy.webp" },
  })
  assert.equal(selected.posterUrl, "/pilot/vertical.webp")
  assert.equal(selected.renditions.length, 6)
  assert.ok(selected.renditions.every(({ aspect }) => aspect === "vertical"))
  assert.equal(selected.legacyVideoUrl, "/legacy.webm")
})
```

- [ ] **Step 2: Run the test and verify missing export failure**

Run: `node --test tests/background-catalog.test.mjs`
Expected: FAIL because `background-preview-renditions.ts` does not exist or the helper is missing.

- [ ] **Step 3: Implement deterministic aspect selection**

Filter v2 renditions by exact aspect, discard malformed or duplicate `(quality, codec)` pairs, and use only the matching aspect poster. When v2 is absent, return the current `getBackgroundPreviewAssets` result as `legacyVideoUrl` and `posterUrl` with an empty rendition array. Do not synthesize v2 asset paths.

- [ ] **Step 4: Preserve existing v1 tests**

Keep `getBackgroundPreviewAssets` unchanged for legacy consumers and add tests showing v2 selection does not alter current landscape/square/vertical fallback order.

- [ ] **Step 5: Run catalog and type tests**

Run: `node --test tests/background-catalog.test.mjs tests/background-preview-media.test.mjs`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit rendition selection**

```bash
git add components/backgrounds/background-preview-renditions.ts lib/background-catalog.js tests/background-catalog.test.mjs
git commit -m "Resolve adaptive background preview renditions"
```

### Task 4: Add measured, abortable rendition fetching

**Files:**
- Create: `components/backgrounds/background-preview-fetch-cache.ts`
- Modify: `tests/background-preview-adaptation.test.mjs`

**Interfaces:**
- Produces: `fetchPreviewRendition(rendition, options): Promise<LoadedPreviewRendition>` and `PreviewRenditionCache`.
- `LoadedPreviewRendition`: `{ rendition, objectUrl, elapsedMs, bitsPerSecond, release(): void }`.
- Consumed by: `use-background-preview-playback.ts`.

- [ ] **Step 1: Add failing measured-fetch tests with injected dependencies**

```js
it("measures known manifest bytes over elapsed fetch time", async () => {
  const loaded = await fetchPreviewRendition(fixtureRendition, {
    fetchImpl: async () => new Response(new Blob([new Uint8Array(1000)]), { status: 200 }),
    now: (() => { const times = [100, 300]; return () => times.shift() })(),
    createObjectURL: () => "blob:preview",
    revokeObjectURL: () => undefined,
    signal: new AbortController().signal,
  })
  assert.equal(loaded.objectUrl, "blob:preview")
  assert.equal(loaded.elapsedMs, 200)
  assert.equal(loaded.bitsPerSecond, fixtureRendition.bytes * 8 / 0.2)
})
```

- [ ] **Step 2: Run the focused test and verify missing module failure**

Run: `node --test tests/background-preview-adaptation.test.mjs`
Expected: FAIL with missing module/export.

- [ ] **Step 3: Implement exact fetch validation and cleanup**

Fetch with the supplied abort signal and `cache: "force-cache"`. Require `response.ok`, read a Blob, and require `blob.size === rendition.bytes`; a mismatch is an asset failure. Construct a new Blob with the manifest MIME type when the response omits it. Measure using manifest bytes because cross-origin resource timing may hide transfer size.

- [ ] **Step 4: Implement ref-counted cache behavior**

Cache by immutable rendition URL. Concurrent requests share one promise. Each acquisition increments a reference count; `release()` decrements it and revokes the object URL only after the last consumer releases it. Aborted or rejected fetches never enter the cache.

- [ ] **Step 5: Add abort, byte-mismatch, deduplication, and revocation tests**

Use injected `fetchImpl`, clock, and URL functions. Assert that two consumers trigger one fetch, one release retains the URL, the second revokes it once, and byte mismatch rejects without caching.

- [ ] **Step 6: Run the focused tests**

Run: `node --test tests/background-preview-adaptation.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit measured fetching**

```bash
git add components/backgrounds/background-preview-fetch-cache.ts tests/background-preview-adaptation.test.mjs
git commit -m "Add measured preview rendition fetching"
```

### Task 5: Build the carousel-scoped coordinator and per-card state machine

**Files:**
- Create: `components/backgrounds/background-preview-coordinator.tsx`
- Create: `components/backgrounds/use-background-preview-playback.ts`
- Modify: `tests/background-preview-adaptation.test.mjs`

**Interfaces:**
- Produces: `BackgroundPreviewCoordinatorProvider`, `useBackgroundPreviewCoordinator()`, and `useBackgroundPreviewPlayback(input)`.
- Coordinator input: `{ enabled, reducedMotion }`; active cards register and unregister through the playback hook.
- Playback input: `{ backgroundId, priority, renderedWidth, renditions, posterUrl, legacyVideoUrl }`.
- Playback output: `{ posterUrl, currentSource, preparedQuality, mode, isPlaying, requiresManualPlay, requestManualPlay, mediaHandlers }`.

- [ ] **Step 1: Add reducer tests for shared throughput and priority allocation**

Test a pure exported `backgroundPreviewCoordinatorReducer` with five registered IDs. Report two measured downloads and assert the exponentially weighted estimate uses weight `0.25` for the new sample. Report decode pressure on an outer card and assert its quality ceiling drops before center. Unregister an active ID and assert its pending request is aborted and metrics are retained only for the current session aggregate.

- [ ] **Step 2: Run the focused test and verify missing exports**

Run: `node --test tests/background-preview-adaptation.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement the provider's bounded environment snapshot**

Read `navigator.connection?.saveData` and `effectiveType` behind a typed local interface, `document.visibilityState`, and codec support from a detached video element's `canPlayType`. Do not persist or transmit these values. Visibility changes pause/resume policy; they do not discard the current poster or successful cached source.

- [ ] **Step 4: Implement priority-aware preparation**

Start center preparation first, then near, then outer. Use one abort controller per background. The coordinator exposes the current throughput estimate and a per-priority allocation to the card hook. A manual request bypasses only the `manual` mode gate for that background; it does not disable reduced motion globally.

- [ ] **Step 5: Implement per-card boundary state**

The hook selects the initial plan, fetches the candidate rendition, records metrics, and exposes media event handlers. `ended` is the only handler that promotes a prepared source: release the old Blob URL, install the prepared source, decrement cooldown, and replay from `0`. `waiting`, `stalled`, `error`, and `getVideoPlaybackQuality()` feed the pure transition/failure policy.

- [ ] **Step 6: Add cleanup and retry tests**

Assert unmount aborts unfinished fetches and releases loaded URLs, visibility pause starts no new fetch, failed pairs are not retried, and leaving the active five-card set stops and cleans the card.

- [ ] **Step 7: Run tests and typecheck**

Run: `node --test tests/background-preview-adaptation.test.mjs`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit coordinator state**

```bash
git add components/backgrounds/background-preview-coordinator.tsx components/backgrounds/use-background-preview-playback.ts tests/background-preview-adaptation.test.mjs
git commit -m "Coordinate five adaptive background previews"
```

### Task 6: Integrate five-card playback and accessible manual motion

**Files:**
- Modify: `components/backgrounds/BackgroundPreviewMedia.tsx`
- Modify: `components/backgrounds/background-carousel.tsx`
- Modify: `components/backgrounds/background-carousel-card.tsx`
- Modify: `tests/background-preview-media.test.mjs`

**Interfaces:**
- Consumes: relative offsets, v2 rendition selection, coordinator/provider, and playback hook.
- Produces: five active preview components on ordinary connections and one centered `Play Preview` action in manual mode.

- [ ] **Step 1: Replace the old centered-only source assertion with a failing five-card assertion**

```js
it("activates every mounted Background card while keeping shells poster-only", () => {
  assert.match(carouselSource, /relativeOffset/)
  assert.match(cardSource, /active=\{active && detailLevel !== "shell"\}/)
  assert.doesNotMatch(cardSource, /active && centered && detailLevel/)
})
```

- [ ] **Step 2: Run the focused test and verify failure against current centered-only code**

Run: `node --test tests/background-preview-media.test.mjs`
Expected: FAIL because the card still requires `centered`.

- [ ] **Step 3: Wrap the stage in the coordinator provider**

In `background-carousel.tsx`, wrap the stage with `BackgroundPreviewCoordinatorProvider`, pass `relativeOffset` to each card, and keep the existing `active` route-level gate. Each non-shell card registers itself with the coordinator through `useBackgroundPreviewPlayback`; cleanup unregisters it, so the provider does not duplicate carousel center state.

- [ ] **Step 4: Give each card a v2 or legacy playback source**

Resolve vertical renditions by `option.id`. Set priority from relative offset. Pass `active && detailLevel !== "shell"` to the preview. Summary cards remain decorative inside the existing inert subtree; they play but gain no focusable controls.

- [ ] **Step 5: Change media playback to explicit boundary restart**

Remove the native `loop` attribute for v2 playback. Use `onEnded` from the playback hook to switch a prepared rendition or restart the current source at time `0`. Keep legacy v1 clips on the current native-loop behavior until their background has a v2 entry.

- [ ] **Step 6: Add centered manual playback control**

When `centered && detailLevel === "full" && requiresManualPlay`, render a normal shared Button with visible text `Play Preview`, `aria-label={`Play preview for ${option.label}`}`, and an `onClick` calling `requestManualPlay`. After playback starts, change it to `Pause Preview` with matching accessible state. Do not render buttons inside summary cards.

- [ ] **Step 7: Preserve poster and fallback behavior**

Keep the registry fallback mounted behind the media. Keep the aspect-matched poster visible until the prepared video fires `loadeddata`. On terminal failure, release video URLs and reveal the poster; if the poster fails, the registry fallback remains.

- [ ] **Step 8: Run focused tests and typecheck**

Run: `node --test tests/background-preview-media.test.mjs tests/background-catalog.test.mjs tests/adaptive-carousel.test.mjs tests/background-preview-adaptation.test.mjs`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit the integrated runtime**

```bash
git add components/backgrounds/BackgroundPreviewMedia.tsx components/backgrounds/background-carousel.tsx components/backgrounds/background-carousel-card.tsx tests/background-preview-media.test.mjs
git commit -m "Play five adaptive background previews"
```

### Task 7: Prove network, boundary, constrained-mode, and failure behavior in Chromium

**Files:**
- Modify: `app/dev/bgpreviews/preview-pilot-review.tsx`
- Create: `tests/browser/background-preview-adaptation.spec.ts`

**Interfaces:**
- Consumes: production preview components with deterministic pilot fixture media.
- Produces: browser evidence for the complete adaptive state machine.

- [ ] **Step 1: Add fixture controls without creating a second runtime**

Extend `/dev/bgpreviews` with a seven-background production `BackgroundCarousel` fixture and diagnostics for active IDs, priority, current tier/codec, measured throughput, stalls, dropped-frame ratio, cooldown, and failed pairs. Controls may inject test-only connection samples and rendition failures through provider props; they must not fork production selection logic.

- [ ] **Step 2: Write the five-request-window test**

```ts
test("only the center and two cards on each side request video", async ({ page }) => {
  const requests = []
  page.on("request", (request) => {
    if (/background-preview-pilot.*\.(webm|mp4)$/.test(request.url())) requests.push(request.url())
  })
  await page.goto("/dev/bgpreviews?fixture=adaptive")
  await expect.poll(() => new Set(requests.map((url) => new URL(url).pathname.split("/")[3])).size).toBe(5)
  await expect(page.locator('[data-preview-priority="center"] video')).toBeVisible()
  await expect(page.locator('[data-preview-priority="near"] video')).toHaveCount(2)
  await expect(page.locator('[data-preview-priority="outer"] video')).toHaveCount(2)
})
```

- [ ] **Step 3: Write constrained-mode and manual-play tests**

Inject `saveData: true`, assert zero video requests and a visible centered Play Preview button, click it, and assert exactly one background begins requesting/playing. Repeat with reduced motion. Verify no autoplay resumes after recentering until the new center receives explicit play.

- [ ] **Step 4: Write loop-boundary transition tests**

Use deterministic two-second fixture clips and provider samples. Assert a prepared upgrade does not change `data-preview-quality` before `ended`; after the boundary it changes once and starts a two-loop cooldown. Inject two stalls and assert the downgrade follows the same boundary rule.

- [ ] **Step 5: Write failure-chain and carousel-movement tests**

Abort or return 404 for selected high VP9, low VP9, and H.264 requests in sequence. Assert bounded fallback reaches poster without repeated URLs. Move the carousel one item and prove the departing outer card stops, the new outer card starts, and the center retains priority.

- [ ] **Step 6: Write hidden-tab and decode-pressure tests**

Drive the review fixture's visibility injection and assert all videos pause and no new fetch begins. Inject dropped-frame ratio `0.10` on all adjacent cards and `0.02` on center; assert adjacent ceilings fall before center.

- [ ] **Step 7: Run focused Chromium tests**

Run: `npm run test:browser -- --project=desktop-chromium tests/browser/background-preview-adaptation.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit browser evidence**

```bash
git add app/dev/bgpreviews/preview-pilot-review.tsx tests/browser/background-preview-adaptation.spec.ts
git commit -m "Verify five-card adaptive preview playback"
```

### Task 8: Complete validation and record runtime readiness

**Files:**
- Modify: `docs/project-log.md`
- Modify: `docs/project-state.md`

**Interfaces:**
- Consumes: approved pilot manifest and validated adaptive runtime.
- Produces: an implementation checkpoint ready for full-catalog media planning; no R2 publication.

- [ ] **Step 1: Run focused Node coverage**

Run: `node --test tests/adaptive-carousel.test.mjs tests/background-catalog.test.mjs tests/background-preview-adaptation.test.mjs tests/background-preview-media.test.mjs tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run static checks**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Run the focused browser matrix**

Run: `npm run test:browser -- --project=desktop-chromium tests/browser/background-preview-adaptation.spec.ts tests/browser/background-preview-pilot.spec.ts`
Expected: PASS on desktop and the test files' phone/short-landscape projects or explicit emulation blocks.

- [ ] **Step 4: Run a Production build**

Run: `npm run build`
Expected: PASS with the `/dev/bgpreviews` route still returning not-found in Production execution.

- [ ] **Step 5: Check the diff**

Run: `git diff --check`
Expected: PASS.

Run: `git status --short`
Expected: only intended source, tests, and documentation; no generated pilot media or secrets.

- [ ] **Step 6: Update canonical documentation accurately**

Record the exact five-card runtime behavior, thresholds, validation results, and approved pilot dependency. State explicitly that branding copy rollout, full-catalog media generation, R2 publication, and production manifest activation remain separate unstarted gates.

- [ ] **Step 7: Commit runtime readiness**

```bash
git add docs/project-log.md docs/project-state.md
git commit -m "Record adaptive preview runtime readiness"
```

- [ ] **Step 8: Stop before full-catalog generation or remote mutation**

The next work requires a new implementation plan using the frozen pilot presets. Do not invoke `chimer:preview:r2:upload`, alter production media paths, or delete legacy assets in this plan.
