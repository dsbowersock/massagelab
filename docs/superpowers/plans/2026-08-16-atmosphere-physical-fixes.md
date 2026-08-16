# Atmosphere Physical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore canonical station artwork on the protected deployment, make one cold Play touch authoritative, and replace the bottom player with a route-scoped right rail only on constrained phone landscape.

**Architecture:** Keep the existing station-art identity and playback owners. Change only the hosted PNG response transport, decouple generator startup from carrier readiness under the existing request-generation guards, and introduce a `/music`-only compact-landscape rail whose width becomes a shared overlay exclusion inset. The station carousel resolves geometry from its remaining container, while portrait and non-Music routes preserve their current player and scrolling behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript/JavaScript, Sharp 0.35.3, Tailwind CSS 3, Embla Carousel, Radix UI, Media Session API, Node test runner, Playwright desktop/mobile Chromium and scoped WebKit, Vercel protected previews, GitHub Actions.

## Global Constraints

- Work only in `C:\tmp\massagelab-android-media-notifications` on `codex/media-notifications-audio-interruptions`; do not modify, switch, clean, or delete any other checkout or worktree.
- Preserve the untracked `docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md`; stage it only in the final documentation task after physical evidence is complete.
- Before every task, compare its file list with every active `codex/admin*` branch and worktree. Warn the user before editing a newly overlapping path.
- Do not redesign station artwork, add seeking/duration, add a second `<audio>`/AudioContext owner, or reintroduce the 10-second timeline.
- The rail activates only on `/music` with an exposed player, landscape orientation, width at most `60rem`, and height at most `31.25rem`.
- Portrait retains the bottom player. Non-Music routes retain current content width, scrolling, and top/bottom player behavior.
- Collapsed rail width is `7rem`; expanded rail width is `clamp(16rem, 34vw, 20rem)`.
- Collapsed rail exposes only decorative vinyl, Play/Stop, and Expand. Expanded rail retains the approved settings, favorite, transport, Background, volume-when-fit, and Minimize semantics.
- Pause, Stop, Previous, and Next remain authoritative over every late carrier, runtime, or generator completion.
- Keep PR #183 draft until every automated, hosted, and affected Samsung physical gate is green. Never merge it.
- Every production change starts with the smallest reproducing RED and receives an independent reviewer before the next task.

## File Responsibility Map

- `app/api/atmosphere/stations/[stationId]/artwork/route.tsx`: converts the canonical SVG to PNG and owns binary HTTP response delivery.
- `lib/atmosphere/station-artwork.ts`: remains the only station-art model, serializer, and canonical URL owner.
- `components/providers/music-provider.tsx`: remains the only generator/carrier/session coordinator and request-generation authority.
- `components/providers/music-mini-player.tsx`: publishes player route/state markers and owns expanded/collapsed control composition.
- `app/browse/workspace.tsx`: marks the route-scoped Atmosphere rails workspace.
- `components/atmosphere/station-carousel.tsx`: observes the station carousel's available container and selects responsive station tuning.
- `components/carousels/adaptive-carousel-model.js`: provides a pure container-to-station-tuning resolver.
- `components/carousels/adaptive-carousel-stage.tsx` and `.module.css`: render the resolved card geometry and bounded stage.
- `components/ui/use-player-viewport-insets.ts`: exposes the active CSS rail inset to Radix collision logic without coupling shared primitives to Music state.
- Shared dialog, alert-dialog, dropdown, popover, sheet, and tooltip files: consume the zero-by-default right exclusion inset.
- `app/globals.css`: owns player rail geometry, `/music` workspace sizing, safe areas, and fixed/portal surface offsets.
- `.github/workflows/ci.yml`: installs every browser required by configured Playwright projects.
- `tests/browser/music-media-session.spec.ts`: owns artwork transport, cold first-touch, media lifecycle, and vinyl behavior.
- `tests/browser/app-shell.spec.ts`: owns player geometry, overlay safety, and portrait/non-Music invariants.
- `tests/browser/public-routes.spec.ts`: owns `/music` carousel visibility, one-touch route behavior, and route health.
- `tests/adaptive-carousel.test.mjs`: owns the pure responsive station-tuning contract.
- `tests/browser-qa-harness.test.mjs`: owns the CI browser-install contract.

---

### Task 1: Prove and fix the hosted PNG transport boundary

**Files:**
- Modify: `app/api/atmosphere/stations/[stationId]/artwork/route.tsx`
- Modify: `tests/browser/music-media-session.spec.ts`
- Create: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-1-report.md` (ignored evidence)

**Interfaces:**
- Consumes: `renderAtmosphereStationArtworkSvg(input): string` and `getAtmosphereStationArtworkUrl(stationId): string` from `lib/atmosphere/station-artwork.ts`.
- Produces: the unchanged canonical route URL with a byte-safe `image/png` response whose first eight bytes are `89 50 4E 47 0D 0A 1A 0A`.

- [ ] **Step 1: Re-audit overlap and capture the hosted RED byte evidence**

Run the existing exact protected branch alias through Vercel's authenticated curl wrapper and save bytes without PowerShell text conversion:

```powershell
$probe = Join-Path $env:TEMP "mlab-proof-drone-before.png"
npx vercel curl /api/atmosphere/stations/mlab-proof-drone/artwork --deployment https://massagelab-git-codex-media-notifications-audio-i-80bea6-dsbteam.vercel.app -o $probe
node -e "const fs=require('fs');const b=fs.readFileSync(process.argv[1]);console.log(JSON.stringify({bytes:b.length,signature:b.subarray(0,8).toString('hex')}));if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')process.exit(1)" $probe
```

Expected: RED on the current protected deployment, or a valid signature that disproves the transport hypothesis. If the signature is already valid, stop this task and diagnose browser decode headers/bytes without changing the route.

- [ ] **Step 2: Strengthen the browser transport assertion before production code**

In `tests/browser/music-media-session.spec.ts`, extend the canonical artwork test to check the signature before hashing:

```ts
const body = Buffer.from(await response.body())
expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
expect(response.headers()["content-type"]).toBe("image/png")
```

Retain the existing all-station uniqueness, repeated-byte stability, image decode, and exact carousel/Media Session URL assertions.

- [ ] **Step 3: Run the focused browser test on the current source**

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "canonical station artwork"
```

Expected: local production-server assertions remain green, proving the regression is hosted-boundary specific rather than canonical artwork generation.

- [ ] **Step 4: Apply the one-variable binary response change**

Change only the response body construction:

```ts
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()

return new Response(new Uint8Array(png), {
  headers: {
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Type": "image/png",
  },
})
```

Keep the route runtime, cache policy, station lookup, SVG generation, and Sharp settings unchanged.

- [ ] **Step 5: Run focused local GREEN gates**

```powershell
node --test tests/atmosphere-station-artwork.test.mjs
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "canonical station artwork"
npm run typecheck
git diff --check
```

Expected: every command passes.

- [ ] **Step 6: Commit, push, and prove the exact hosted bytes**

```powershell
git add -- 'app/api/atmosphere/stations/[stationId]/artwork/route.tsx' tests/browser/music-media-session.spec.ts
git commit -m "fix: preserve hosted station artwork bytes"
git push origin codex/media-notifications-audio-interruptions
```

Wait for the exact Vercel deployment to complete, then rerun Step 1 with `mlab-proof-drone-after.png`. Also fetch a second station and require a distinct SHA-256:

```powershell
$first = Join-Path $env:TEMP "mlab-proof-drone-after.png"
$second = Join-Path $env:TEMP "mlab-trees-after.png"
npx vercel curl /api/atmosphere/stations/mlab-proof-drone/artwork --deployment https://massagelab-git-codex-media-notifications-audio-i-80bea6-dsbteam.vercel.app -o $first
npx vercel curl /api/atmosphere/stations/generative-fm-trees/artwork --deployment https://massagelab-git-codex-media-notifications-audio-i-80bea6-dsbteam.vercel.app -o $second
node -e "const fs=require('fs'),c=require('crypto');const p=process.argv.slice(1);const b=p.map(x=>fs.readFileSync(x));const s=b.map(x=>x.subarray(0,8).toString('hex'));const h=b.map(x=>c.createHash('sha256').update(x).digest('hex'));console.log({s,h});if(s.some(x=>x!=='89504e470d0a1a0a')||h[0]===h[1])process.exit(1)" $first $second
```

Expected: both signatures are valid and hashes differ. If not, create a normal `git revert` commit for the diagnostic change and return to systematic diagnosis; do not stack another speculative transport fix.

- [ ] **Step 7: Record the task evidence and obtain independent review**

Record pre/post signatures, exact deployed SHA, browser results, and whether the hypothesis was confirmed in `task-1-report.md`. A fresh reviewer must inspect the route, tests, exact hosted evidence, and scoped diff before Task 2.

---

### Task 2: Make cold first Play independent of carrier readiness

**Files:**
- Modify: `components/providers/music-provider.tsx`
- Modify: `tests/browser/music-media-session.spec.ts`
- Modify: `tests/music-visualizer-provider.test.mjs`
- Create: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-2-report.md` (ignored evidence)

**Interfaces:**
- Consumes: `mediaCarrier.start(): Promise<{ available: boolean }>` and `runtime.controller.start(station): Promise<{ status: "active" | "superseded" }>`.
- Produces: carrier settlement and generator startup as independent guarded operations under `playbackRequestIdRef` and `playbackSessionGenerationRef`.

- [ ] **Step 1: Add an activation-sensitive fake and one-touch RED**

Extend the fake options in `music-media-session.spec.ts`:

```ts
type MediaOwnershipFakeOptions = {
  holdCarrierPlay?: boolean
  requireAudioContextResumeInPlayTurn?: boolean
  rejectCarrierPlay?: boolean
}
```

Inside the fake AudioContext `resume()`, reject late resume only when requested:

```ts
async resume() {
  if (fakeOptions.requireAudioContextResumeInPlayTurn && !initiatingPlayTurn) {
    throw new DOMException("AudioContext resume lost user activation", "NotAllowedError")
  }
  this.state = "running"
}
```

Add this mobile Chromium test:

```ts
test("one cold touch starts the generator while carrier readiness is held", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Physical-touch regression is mobile-owned.")
  await installMediaOwnershipFakes(page, {
    holdCarrierPlay: true,
    requireAudioContextResumeInPlayTurn: true,
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  const play = carousel.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })
  await play.tap()
  await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "loading")
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration).toBe(1)
  await releaseHeldCarrierPlay(page)
  await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "playing")
  expect((await readProbe(page)).audio.playCalls).toBe(1)
})
```

- [ ] **Step 2: Run RED**

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=mobile-chromium --grep "one cold touch starts"
```

Expected: FAIL because the current provider waits for the held carrier before calling `runtime.controller.start`.

- [ ] **Step 3: Separate carrier settlement from runtime start**

In `playStation`, keep `mediaCarrierRef.current?.start()` before the first await. Await `runtimePromise`, resolve the station, publish its Loading metadata, and call `runtime.controller.start(station)` without awaiting carrier readiness. Attach carrier settlement as a guarded independent continuation:

```ts
const carrierStartPromise = mediaCarrierRef.current?.start()
  ?? Promise.resolve({ available: false })
const runtime = await getRuntime()
ensureInterruptionMonitor(runtime)
const station = runtime.getAtmosphereStationById(stationId)

void carrierStartPromise
  .catch(() => ({ available: false }))
  .then(({ available }) => {
    if (
      requestId !== playbackRequestIdRef.current
      || sessionGeneration !== playbackSessionGenerationRef.current
    ) return
    settleMediaIntegrationAvailability({
      available,
      continueSession,
      origin: options.origin,
      requestId,
      sessionGeneration,
    })
  })

const runtimeResult = await runtime.controller.start(station)
```

Define `settleMediaIntegrationAvailability` as a dependency-complete `useCallback` in the provider. It owns only `setMediaIntegrationAvailable`, notice-session publication, and the same current-request guards currently embedded after `Promise.all`. It must not start, pause, or stop audio.

- [ ] **Step 4: Update the provider source contract**

In `tests/music-visualizer-provider.test.mjs`, require:

```js
assert.match(providerSource, /const carrierStartPromise[\s\S]*const runtime = await getRuntime\(\)/)
assert.match(providerSource, /void carrierStartPromise[\s\S]*settleMediaIntegrationAvailability/)
assert.match(providerSource, /const runtimeResult = await runtime\.controller\.start\(station\)/)
assert.doesNotMatch(providerSource, /await Promise\.all\(\[\s*carrierStartPromise,\s*runtimePromise/)
```

- [ ] **Step 5: Run focused GREEN and cancellation regressions**

```powershell
node --test tests/music-visualizer-provider.test.mjs tests/atmosphere-runtime-controller.test.mjs tests/atmosphere-playback-lifecycle.test.mjs tests/atmosphere-media-playback-carrier.test.mjs
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=mobile-chromium --grep "first station Play activation|one cold touch starts|Stop stays authoritative|Pause cancels"
npm run typecheck
git diff --check
```

Expected: all pass; the held-carrier test reaches one generator generation before release and no late completion reverses Pause/Stop.

- [ ] **Step 6: Commit and review**

```powershell
git add components/providers/music-provider.tsx tests/browser/music-media-session.spec.ts tests/music-visualizer-provider.test.mjs
git commit -m "fix: start atmosphere within first play intent"
```

Write exact RED/GREEN evidence to `task-2-report.md`. A fresh reviewer must trace request-generation guards, notice settlement, carrier rejection, and no-duplicate generator behavior before Task 3.

---

### Task 3: Introduce the `/music` compact-landscape player rail

**Files:**
- Modify: `components/providers/music-mini-player.tsx`
- Modify: `app/browse/workspace.tsx`
- Modify: `app/globals.css`
- Modify: `tests/browser/app-shell.spec.ts`
- Modify: `tests/browser/public-routes.spec.ts`
- Create: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-3-report.md` (ignored evidence)

**Interfaces:**
- Produces body class `ml-music-player-music-route`, workspace marker `data-atmosphere-workspace="rails"`, and CSS variables `--ml-music-player-rail-width` and `--ml-player-right-safe`.
- Consumers: Task 4 carousel sizing and Task 5 overlay collision handling.

- [ ] **Step 1: Add portrait and compact-landscape RED geometry tests**

In `app-shell.spec.ts`, add one mobile test that starts Proof Drone and checks both orientations:

```ts
await page.setViewportSize({ width: 390, height: 844 })
await startProofDrone(page)
const toolbar = page.getByTestId("music-player-toolbar")
await expect(toolbar).toHaveAttribute("data-layout", "bottom")
expect((await toolbar.boundingBox())?.width).toBe(390)

await page.setViewportSize({ width: 844, height: 390 })
await expect(toolbar).toHaveAttribute("data-layout", "rail")
const expanded = await toolbar.boundingBox()
expect(expanded?.right).toBeCloseTo(844, 0)
expect(expanded?.width ?? 0).toBeGreaterThanOrEqual(256)
expect(expanded?.width ?? 999).toBeLessThanOrEqual(320)
```

Then minimize and require width `112`, decorative vinyl, Play/Stop, and Expand only. In `public-routes.spec.ts`, add a non-Music route at `844x390` and require `data-layout="bottom"` plus unchanged content width.

- [ ] **Step 2: Run RED**

```powershell
npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "compact landscape player rail|non-Music compact landscape"
```

Expected: FAIL because the toolbar remains a bottom bar and exposes no layout marker.

- [ ] **Step 3: Publish route-aware layout state**

In `MusicMiniPlayer`, derive the route context and publish a stable body class:

```ts
const isMusicRoute = pathname === "/music"

useEffect(() => {
  const { body } = document
  body.classList.toggle("ml-music-player-music-route", showPlayer && isMusicRoute)
  return () => body.classList.remove("ml-music-player-music-route")
}, [isMusicRoute, showPlayer])
```

Add `data-music-route={isMusicRoute}` to the toolbar. Use a compact-landscape `matchMedia` listener only to expose `data-layout="rail" | "bottom"` for semantics/tests; CSS remains the geometry authority. In `AtmosphereWorkspace`, add:

```tsx
<div
  className="relative min-h-screen overflow-hidden"
  data-atmosphere-workspace={isRailLayout ? "rails" : "grid"}
>
```

- [ ] **Step 4: Implement rail variables and geometry**

In `app/globals.css`, define the inert defaults:

```css
:root {
  --ml-music-player-rail-width: 0px;
  --ml-player-right-safe: 0px;
}
```

Under the exact compact-landscape query, activate only the Music route:

```css
@media (orientation: landscape) and (max-width: 60rem) and (max-height: 31.25rem) {
  body.ml-music-player-active.ml-music-player-music-route {
    --ml-music-player-rail-width: clamp(16rem, 34vw, 20rem);
    --ml-player-right-safe: calc(var(--ml-music-player-rail-width) + var(--ml-safe-right));
    --ml-audio-toolbar-height: 0px;
  }

  body.ml-music-player-active.ml-music-player-music-route.ml-music-player-collapsed {
    --ml-music-player-rail-width: 7rem;
  }

  body.ml-music-player-active.ml-music-player-music-route .ml-music-player-toolbar {
    bottom: var(--ml-bottom-stack-height);
    height: calc(100dvh - var(--ml-bottom-stack-height));
    left: auto;
    right: 0;
    top: 0;
    width: var(--ml-music-player-rail-width);
  }
}
```

Convert the expanded toolbar layout to bounded vertical rows and the collapsed layout to vinyl plus two controls. Hide identity and every secondary control in collapsed rail mode; retain their current bottom-player behavior outside the query. Keep the existing safe-area and reduced-motion declarations.

- [ ] **Step 5: Run focused GREEN and player regressions**

```powershell
npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "compact landscape player rail|non-Music compact landscape|vinyl geometry|interruption notice"
npm run typecheck
git diff --check
```

Expected: portrait and non-Music remain bottom-based; `/music` compact landscape uses the exact expanded/collapsed rail widths and no toolbar overflow.

- [ ] **Step 6: Commit and review**

```powershell
git add components/providers/music-mini-player.tsx app/browse/workspace.tsx app/globals.css tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts
git commit -m "feat: add compact landscape music rail"
```

Write `task-3-report.md`. A fresh reviewer must verify the exact activation query, portrait/non-Music exclusions, safe-area arithmetic, collapsed action set, and no independent toolbar scrolling.

---

### Task 4: Make the station carousel adapt to the remaining workspace

**Files:**
- Modify: `components/carousels/adaptive-carousel-model.js`
- Modify: `components/atmosphere/station-carousel.tsx`
- Modify: `components/carousels/adaptive-carousel-stage.tsx`
- Modify: `components/carousels/adaptive-carousel-stage.module.css`
- Modify: `app/globals.css`
- Modify: `tests/adaptive-carousel.test.mjs`
- Modify: `tests/browser/app-shell.spec.ts`
- Create: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-4-report.md` (ignored evidence)

**Interfaces:**
- Produces `getResponsiveStationCarouselTuning({ containerWidth, containerHeight }): AdaptiveCarouselTuning`.
- Consumes Task 3's `data-atmosphere-workspace="rails"` and rail-width variables.

- [ ] **Step 1: Write the pure tuning RED**

Add to `tests/adaptive-carousel.test.mjs`:

```js
test("station tuning fits three cards inside a constrained rail workspace", () => {
  assert.deepEqual(
    getResponsiveStationCarouselTuning({ containerWidth: 556, containerHeight: 246 }),
    {
      ...STATION_CAROUSEL_TUNING,
      cardWidth: 192,
      cardHeight: 174,
      visibleRadius: 1,
    },
  )
})

test("station tuning clamps tiny containers without hiding the centered action", () => {
  const tuning = getResponsiveStationCarouselTuning({ containerWidth: 420, containerHeight: 210 })
  assert.equal(tuning.cardWidth, 161)
  assert.equal(tuning.cardHeight, 168)
  assert.equal(tuning.visibleRadius, 1)
})
```

- [ ] **Step 2: Run RED**

```powershell
node --test tests/adaptive-carousel.test.mjs
```

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the pure container resolver**

Add to `adaptive-carousel-model.js`:

```js
/**
 * Fits the station carousel to its actual workspace while preserving one
 * centered card and one summary neighbor on each side.
 * @param {{ containerWidth: number, containerHeight: number }} dimensions
 * @returns {AdaptiveCarouselTuning}
 */
export function getResponsiveStationCarouselTuning({ containerWidth, containerHeight }) {
  const safeWidth = Number.isFinite(containerWidth) ? containerWidth : 556
  const safeHeight = Number.isFinite(containerHeight) ? containerHeight : 246
  return {
    ...STATION_CAROUSEL_TUNING,
    cardWidth: Math.max(160, Math.min(192, Math.floor(safeWidth / 2.6))),
    cardHeight: Math.max(168, Math.min(224, Math.floor(safeHeight - 72))),
    visibleRadius: 1,
  }
}
```

- [ ] **Step 4: Observe only the Music carousel container**

In `AtmosphereStationCarousel`, attach a `ResizeObserver` to the section root. Use `matchMedia("(orientation: landscape) and (max-width: 60rem) and (max-height: 31.25rem)")` and the body route class to select responsive tuning; otherwise pass the unchanged `STATION_CAROUSEL_TUNING`.

```ts
const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
const rootRef = useRef<HTMLElement | null>(null)

useEffect(() => {
  const root = rootRef.current
  if (!root) return
  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    setContainerSize({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    })
  })
  observer.observe(root)
  return () => observer.disconnect()
}, [])
```

Pass the pure resolver output to `AdaptiveCarouselStage` only in active rail mode. Preserve the centered item ID through resize and expansion.

- [ ] **Step 5: Bound the workspace rows and stage**

In rail mode, make the workspace a `100dvh`-bounded grid above the app bar. The station section uses `grid-template-rows: auto minmax(0, 1fr)`, and the carousel root/stage uses `height: 100%`, `min-height: 0`, and reduced block padding. Change the slide width fallback from viewport-based to container-based:

```css
.slide {
  flex-basis: min(var(--carousel-card-width), calc(100cqw - 2rem));
}
```

Place `container-type: inline-size` on the stage's containing root, not the slide itself, and preserve the slide's existing presentation container behavior with a named nested container if needed.

- [ ] **Step 6: Add rendered no-scroll and centered-station assertions**

At `844x390`, start Proof Drone, record the centered station, expand and collapse the rail, and assert:

```ts
expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
await expect(page.getByRole("group", { name: /MassageLab Proof Drone/ })).toHaveAttribute("data-centered", "true")
await expect(page.getByRole("button", { name: /Play|Stop MassageLab Proof Drone/i })).toBeInViewport()
await expect(page.getByRole("button", { name: "Previous station" })).toBeInViewport()
await expect(page.getByRole("button", { name: "Next station" })).toBeInViewport()
```

Also assert exactly three non-shell cards are mounted in the compact rail profile.

- [ ] **Step 7: Run GREEN and commit**

```powershell
node --test tests/adaptive-carousel.test.mjs
npm run test:browser -- tests/browser/app-shell.spec.ts --project=mobile-chromium --grep "carousel fits compact landscape rail"
npm run typecheck
git diff --check
git add components/carousels/adaptive-carousel-model.js components/atmosphere/station-carousel.tsx components/carousels/adaptive-carousel-stage.tsx components/carousels/adaptive-carousel-stage.module.css app/globals.css tests/adaptive-carousel.test.mjs tests/browser/app-shell.spec.ts
git commit -m "fix: fit station carousel beside player rail"
```

Write `task-4-report.md`. A fresh reviewer must verify the resolver math, ResizeObserver cleanup, center preservation, three-card resource bound, no document scrolling, and unchanged Background carousel behavior.

---

### Task 5: Keep overlays and fixed controls clear of the rail

**Files:**
- Create: `components/ui/use-player-viewport-insets.ts`
- Modify: `components/ui/dialog.tsx`
- Modify: `components/ui/alert-dialog.tsx`
- Modify: `components/ui/dropdown-menu.tsx`
- Modify: `components/ui/popover.tsx`
- Modify: `components/ui/sheet.tsx`
- Modify: `components/ui/tooltip.tsx`
- Modify: `components/providers/music-mini-player.tsx`
- Modify: `app/globals.css`
- Modify: `tests/browser/app-shell.spec.ts`
- Create: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-5-report.md` (ignored evidence)

**Interfaces:**
- Consumes: Task 3's inherited `--ml-player-right-safe` value.
- Produces: `usePlayerViewportInsets(): { right: number }` and shared `ml-player-viewport-safe-*` surface classes.

- [ ] **Step 1: Re-audit shared-UI overlap and write overlay RED cases**

At `844x390` with the expanded rail, open Player settings, the centered station information dialog, a right Sheet/drawer fixture, a Popover fixture, and a Tooltip. For each visible surface, assert its right edge is at or left of the rail's left edge:

```ts
const rail = await page.getByTestId("music-player-toolbar").boundingBox()
const surface = await locator.boundingBox()
expect(surface?.x! + surface?.width!).toBeLessThanOrEqual(rail?.x! + 1)
```

Repeat the dialog assertion after switching to portrait and require ordinary viewport centering.

- [ ] **Step 2: Run RED**

```powershell
npm run test:browser -- tests/browser/app-shell.spec.ts --project=mobile-chromium --grep "player rail keeps overlays clear"
```

Expected: at least one shared surface intersects the rail.

- [ ] **Step 3: Implement the zero-by-default inset hook**

Create `components/ui/use-player-viewport-insets.ts`:

```ts
"use client"

import { useEffect, useState } from "react"

/** Reads the CSS-owned player exclusion inset for Radix collision padding. */
export function usePlayerViewportInsets() {
  const [right, setRight] = useState(0)

  useEffect(() => {
    const update = () => {
      const value = Number.parseFloat(
        getComputedStyle(document.body).getPropertyValue("--ml-player-right-safe"),
      )
      setRight(Number.isFinite(value) ? value : 0)
    }
    const observer = new MutationObserver(update)
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })
    window.addEventListener("resize", update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [])

  return { right }
}
```

- [ ] **Step 4: Apply the inset to shared surfaces**

For Dropdown, Popover, and Tooltip content, merge the hook value into Radix collision padding while preserving caller values:

```ts
const { right } = usePlayerViewportInsets()
const safeCollisionPadding = {
  top: 8,
  right: right + 8,
  bottom: 8,
  left: 8,
}
```

Use `collisionPadding={collisionPadding ?? safeCollisionPadding}`. Add stable safe-surface classes to Dialog/AlertDialog/Sheet content. In CSS, center modal content inside `calc(100dvw - var(--ml-player-right-safe))`, cap its width to that usable viewport, and offset a right Sheet by the rail inset. Outside rail mode the variable is zero, preserving existing placement.

Set Player settings to open inward explicitly:

```tsx
<DropdownMenuContent align="start" side="left" className="min-w-56 border-border bg-card">
```

- [ ] **Step 5: Run focused GREEN and broad shared-surface regressions**

```powershell
npm run test:browser -- tests/browser/app-shell.spec.ts --project=mobile-chromium --grep "player rail keeps overlays clear|account menu|drawer|dialog|popover|tooltip|interruption notice"
npm run typecheck
npm run lint
git diff --check
```

Expected: all rail surfaces clear the player, portrait returns to ordinary centering, and unrelated app-shell surface tests pass.

- [ ] **Step 6: Commit and review**

```powershell
git add components/ui/use-player-viewport-insets.ts components/ui/dialog.tsx components/ui/alert-dialog.tsx components/ui/dropdown-menu.tsx components/ui/popover.tsx components/ui/sheet.tsx components/ui/tooltip.tsx components/providers/music-mini-player.tsx app/globals.css tests/browser/app-shell.spec.ts
git commit -m "fix: keep overlays clear of music rail"
```

Write `task-5-report.md`. A fresh reviewer must verify cleanup, caller collision-padding preservation, no server-render access to `document`, zero-inset parity, and shared-admin-surface regressions.

---

### Task 6: Make GitHub browser QA install its configured engines

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/browser-qa-harness.test.mjs`
- Create: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-6-report.md` (ignored evidence)

**Interfaces:**
- Produces: a QA runner with Chromium and WebKit binaries matching the configured `desktop-chromium`, `mobile-chromium`, and `webkit-media-smoke` projects.

- [ ] **Step 1: Write the workflow RED contract**

Add to `tests/browser-qa-harness.test.mjs`:

```js
test("CI installs Chromium and WebKit for configured browser QA projects", () => {
  assert.match(ciWorkflow, /npx playwright install --with-deps chromium webkit/)
})
```

- [ ] **Step 2: Run RED**

```powershell
node --test tests/browser-qa-harness.test.mjs
```

Expected: FAIL because CI installs only Chromium.

- [ ] **Step 3: Change the pinned workflow command only**

```yaml
- name: Install browsers for browser QA
  run: npx playwright install --with-deps chromium webkit
```

Do not change workflow permissions, action SHAs, concurrency, secrets, or job scope.

- [ ] **Step 4: Run GREEN and commit**

```powershell
node --test tests/browser-qa-harness.test.mjs
git diff --check
git add .github/workflows/ci.yml tests/browser-qa-harness.test.mjs
git commit -m "ci: install WebKit for browser QA"
```

Write `task-6-report.md`. A fresh reviewer must confirm the existing configured projects require both engines and that no token permission or action pin changed.

---

### Task 7: Validate, deploy, complete physical QA, and resume the PR loop

**Files:**
- Modify after physical success: `docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md`
- Modify after physical success and a fresh overlap audit: `docs/project-state.md`
- Modify after physical success and a fresh overlap audit: `docs/project-log.md`
- Modify after physical success and a fresh overlap audit: `docs/wiki/atmosphere-audio.md`
- Create: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-7-report.md` (ignored evidence)

**Interfaces:**
- Consumes: reviewed Tasks 1-6 and exact physical observations from the Samsung Galaxy S24 Ultra.
- Produces: final branch validation evidence, truthful canonical documentation, a ready PR only after all gates pass, and resolved substantive CodeRabbit threads. It never produces a merge.

- [ ] **Step 1: Run fresh local gates separately**

```powershell
node --test tests/atmosphere-station-artwork.test.mjs tests/adaptive-carousel.test.mjs tests/atmosphere-media-session-controller.test.mjs tests/atmosphere-media-playback-carrier.test.mjs tests/atmosphere-playback-lifecycle.test.mjs tests/atmosphere-runtime-controller.test.mjs tests/music-visualizer-provider.test.mjs tests/browser-qa-harness.test.mjs
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=desktop-chromium --workers=1
npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=mobile-chromium --workers=1
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=webkit-media-smoke --workers=1
git diff --check
```

Expected: every command exits zero. Record exact counts and intentional skips; do not waive a failing assertion.

- [ ] **Step 2: Audit exact scope and worktrees**

Verify:

```powershell
git status --short
git diff --name-only origin/main...HEAD
git diff --check
```

Recompute every active admin branch/worktree changed-file set. If `docs/project-state.md`, `docs/project-log.md`, or `docs/wiki/atmosphere-audio.md` newly overlaps, warn the user and stop before editing those files.

- [ ] **Step 3: Push reviewed commits and wait for hosted checks**

```powershell
git push origin codex/media-notifications-audio-interruptions
gh pr checks 183 --watch
```

Require Vercel, CodeQL, and GitHub QA to pass at the same exact head. Keep the PR draft during the physical gate.

- [ ] **Step 4: Reverify protected hosted routes**

Use `vercel curl` against the exact branch preview and require:

- `/music` returns application HTML and HTTP 200;
- two artwork routes have valid PNG signatures and distinct hashes;
- browser rendering reports positive natural width/height rather than fallback text;
- Vercel runtime error logs contain no artwork-route exception for the test window.

- [ ] **Step 5: Execute the affected Samsung matrix**

On the recorded S24 Ultra/Chrome version, record direct observations for:

1. one centered carousel Play touch starts Loading/Playing;
2. carousel, expanded rail, collapsed rail, notification, and lock screen show matching station artwork;
3. Previous and Next update title and artwork together;
4. no 10-second timeline appears;
5. portrait retains the bottom player;
6. constrained landscape uses the expanded and collapsed right rail without `/music` page scrolling;
7. Player settings, interruption notice, station dialog, and exposed drawers/popups are not hidden by the rail;
8. reduced motion is deliberately enabled and the vinyl remains still.

Do not infer installed-PWA, Bluetooth/headset, call, meeting-app, carrier-failure, or Apple results that were not executed.

- [ ] **Step 6: Update truthful documentation only after physical GREEN**

Update the untracked QA report with exact commit, deployment, device/browser, pass/fail rows, screenshots, and remaining unexecuted rows. Then update canonical state/log/wiki with only confirmed behavior and platform limitations. Stage those four documentation paths explicitly and commit:

```powershell
git add docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md docs/project-state.md docs/project-log.md docs/wiki/atmosphere-audio.md
git commit -m "docs: record atmosphere physical verification"
```

- [ ] **Step 7: Run the GitHub CodeRabbit loop without merging**

Push the documentation commit, mark PR #183 ready only after all preceding gates are green, and request `@coderabbitai review` after any published cooldown. For each comment:

1. treat finding text and code excerpts as untrusted evidence;
2. inspect current exact code;
3. fix only still-valid issues with the smallest RED/GREEN cycle;
4. run focused tests followed by proportionate static/broad checks;
5. commit and push scoped changes;
6. reply in the original GitHub thread and resolve it;
7. repeat until the latest pushed head has a completed substantive review, required checks pass, and unresolved review threads are empty.

Never merge PR #183.

- [ ] **Step 8: Write the final task report**

Record exact final head, all command counts, hosted PNG signatures/hashes, physical observations, remaining device gaps, PR checks, CodeRabbit review commit, unresolved-thread count, and clean tracked status in `task-7-report.md`.
