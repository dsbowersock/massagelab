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

---

## Physical Round 2 Amendment — 2026-08-16

The Samsung Galaxy S24 Ultra retest at exact deployed head `4a698c44e9ee38445c8212adbd5e1cd15c8ea11e` supersedes Task 7's pending physical-green assumption. Hosted automation was green, but physical acceptance remains open because one centered Play touch still did not start playback, in-app artwork loaded progressively, the notification artwork was soft, the four-second vinyl rotation caused dizziness, portrait `/music` still scrolled, and the constrained-landscape rail/carousel composition did not fit the real browser viewport. Previous/Next title-and-art pairing, timeline removal, portrait bottom placement, and rail activation remain accepted.

### Amendment authority and readiness

**Baseline/Authority Refs:** this plan; `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-7-report.md`; the user-supplied Samsung screenshots (`720×1440` portrait and `1492×667` landscape raster); `docs/wiki/atmosphere-audio.md`; exact deployed head `4a698c44e9ee38445c8212adbd5e1cd15c8ea11e`.

**Requirement Ready Check:** ready. The user explicitly requires one-touch playback, immediate matching artwork, a slower non-dizzying vinyl, honest high-resolution system artwork, a two-row landscape rail, side-card carousel navigation, and a non-scrolling `/music` workspace in both portrait and constrained landscape. Exact Chrome CSS viewport dimensions remain an evidence gap, not a blocker; automated coverage uses conservative Samsung-class estimates and the next physical pass records the actual visual viewport.

**Change Necessity:** code-change. Documentation or user instructions cannot make the first touch authoritative, remove per-card artwork requests, increase the actual notification bitmap resolution, alter motion, or fit the workspace. Reuse the current playback, canonical artwork, player, carousel, and overlay owners; do not add a second audio context, artwork catalog, player, or carousel implementation.

**Compatibility Boundary:** preserve the absence of seeking/duration, all authoritative Pause/Stop/Previous/Next guards, the canonical station-art seed/palette/motif, portrait bottom-player placement, non-Music scrolling, Background carousel behavior, shared zero-inset portal behavior, and PR #183's draft/unmerged state.

**TDD Route:**
- Mode: auto
- Decision: strict
- Strict authority: the parent plan's explicit rule that every production change begins with the smallest reproducing RED.
- Test posture: causal diagnostic RED first, then focused GREEN and proportionate regression matrices.
- Verification: every task records exact RED/GREEN evidence, receives independent spec and quality review, and produces one scoped commit.

**Execution Readiness View:**
- Intent Lock: physical Samsung acceptance, not a visual redesign outside `/music`.
- Scope Fence: Tasks 8–12 below; no calls/meeting/PWA/Bluetooth/Apple claims.
- Baseline Lock: `4a698c44e9ee38445c8212adbd5e1cd15c8ea11e` plus the accepted behaviors above.
- Owner / Contract Constraints: provider owns playback; `station-artwork.ts` owns visual identity; mini-player owns player composition; station carousel/model own Music geometry; shared primitives consume only the existing zero-default inset.
- Drift / Rewind Rules: if a diagnostic RED does not reproduce its hypothesized boundary, stop that production path and test the next ranked boundary; after three failed repairs, return to architecture review.
- Review Gates: fresh implementer, spec review, quality review, coordinator verification, scoped commit, then next task.
- Evidence Required Before Completion: automated gates plus a fresh S24 Ultra observation at the exact immutable deployment.

### Task 8: Prove and repair the remaining one-touch activation boundary

**Files:**
- Modify first: `tests/browser/music-media-session.spec.ts`
- Modify only after causal RED: `components/providers/music-provider.tsx`
- Modify only if the proven owner requires it: `lib/atmosphere/tone-proof-runtime.ts`, `lib/atmosphere/generative-fm-piece-loader.js`, `components/atmosphere/station-carousel-card.tsx`
- Modify focused source contract only if production changes: `tests/music-visualizer-provider.test.mjs`
- Create ignored evidence: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-8-report.md`

**Why:** the accepted touch reaches `playStation`, but the first activation-sensitive Tone action can still occur after cold runtime imports or after the silent carrier consumes Android's activation opportunity.

**Repair Track:** playback provider/runtime activation seam. Do not patch Embla, the shared Button, or the service worker without contrary evidence.

**Retirement Track:** retire the current false confidence that `data-carousel-ready` or held-carrier coverage proves a cold, activation-safe runtime. Keep the existing test as carrier-order coverage.

- [ ] Add a deterministic cold-runtime case that holds the actual runtime-module phase while the initial center prewarm is in flight, requires `AudioContext.resume()` in the initiating Play task, performs one real mobile tap, releases modules after that task, and records resume timing plus generator generation. Require the current code to reproduce zero generation, then optionally prove a second touch succeeds.
- [ ] If the cold-runtime case does not reproduce, preload the runtime and add a separate one-use activation-token fake in which carrier `play()` can consume the token before Tone resume. Stop unless one boundary reproduces the physical two-touch shape.
- [ ] For a proven cold-runtime owner, add explicit provider runtime-readiness state and make the centered Play action non-actionable with truthful `Preparing` semantics until the shared runtime promise is ready; do not expose a tappable Play that cannot use the gesture. A readiness failure must expose a visible retry/error state rather than withholding Play indefinitely. Once Play appears/enables, exactly one real tap—without earlier hover, focus, or pointer-down prewarm—must reach one generator generation and Playing. For a proven activation-order owner, move only the activation-sensitive generator claim ahead of carrier playback while retaining early metadata/handlers and request/session guards. Do not implement both branches without evidence.
- [ ] Run the new exact reproduction and a fresh-page readiness case that forbids prior input prewarm, then the existing one-touch/held-carrier/module-loading/Stop/Pause/carrier-rejection cases, the provider/runtime Node suites, typecheck, build, and diff check.
- [ ] Obtain independent spec and quality approval, then create one scoped commit and append exact causal evidence to `task-8-report.md`.

### Task 9: Render canonical art immediately, publish honest system resolution, and slow the vinyl

**Files:**
- Modify: `lib/atmosphere/station-artwork.ts`
- Modify: `components/atmosphere/station-artwork.tsx`
- Modify: `components/providers/music-provider.tsx`
- Modify: `components/providers/music-mini-player.tsx`
- Modify: `components/ui/music-player.tsx`
- Modify: `app/api/atmosphere/stations/[stationId]/artwork/route.tsx`
- Modify: `lib/atmosphere/media-session-controller.js`
- Modify: `app/globals.css`
- Modify: `tests/atmosphere-station-artwork.test.mjs`
- Modify: `tests/atmosphere-media-session-controller.test.mjs`
- Modify: `tests/browser/music-media-session.spec.ts`
- Create ignored evidence: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-9-report.md`

**Why:** current app surfaces lazy-load one Sharp-backed HTTP PNG per card/vinyl, while Media Session labels a real `240×240` bitmap as `512×512`; the vinyl spins once every four seconds.

**Repair Track:** keep `station-artwork.ts` as the sole identity/model/serializer owner. Use inline canonical SVG for app cards and vinyl, and PNG adapters only for platform Media Session artwork.

**Retirement Track:** retire HTTP-error-driven in-app artwork loading and the dishonest 512 descriptor. Retain the proven byte-safe `new Uint8Array(png)` route response and no-timeline behavior.

- [ ] RED: decode route pixels and require honest allowlisted `256×256` and `512×512` variants; require mounted cards and vinyl to render canonical SVG with zero artwork API requests; require card/vinyl identity and Media Session descriptor pairing across Previous/Next; require a `16s` Playing-only animation and no animation under reduced motion.
- [ ] Add a canonical station-to-artwork-input resolver. Render the serialized SVG inline for cards and decorative vinyl with the existing accessible card label and neutral invalid-input fallback. The centered card must supply its already-owned canonical artwork input synchronously with the accepted Play intent so the provider can publish vinyl art before the lazy runtime resolves. Previous/Next must derive the adjacent station's canonical input from the already-loaded runtime and atomically publish title plus art. The provider/mini-player must not statically import `stations.js` or the full 58-station catalog; add a source/bundle-boundary regression assertion.
- [ ] Rasterize the same SVG at explicit native output dimensions. Publish honest 256 and 512 Media Session entries via the canonical URL helper. Keep unknown-station 404 behavior, bounded cache headers, non-cacheable generation failures, and the hosted `Uint8Array` response.
- [ ] Change the vinyl baseline to one 16-second linear revolution; keep Loading, Paused, Interrupted, Stopped, and Failed frozen and `prefers-reduced-motion: reduce` set to no animation.
- [ ] Run artwork/media-session Node suites, canonical artwork and lifecycle browser cases across Chromium/WebKit, typecheck, lint, build, hosted PNG byte/dimension proof, and diff check.
- [ ] Obtain independent spec and quality approval, create one scoped commit, and append exact request counts, decoded sizes, identity hashes, and motion evidence to `task-9-report.md`.

### Task 10: Fit the `/music` workspace and compose the requested rail/carousel controls

**Files:**
- Modify: `components/layout-wrapper.tsx`
- Modify: `app/browse/workspace.tsx`
- Modify: `components/providers/music-mini-player.tsx`
- Modify: `components/atmosphere/station-carousel.tsx`
- Modify: `components/carousels/adaptive-carousel-model.js`
- Modify only through its existing extension point: `components/carousels/adaptive-carousel-stage.tsx`, `components/carousels/adaptive-carousel-stage.module.css`
- Modify: `app/globals.css`
- Modify: `tests/adaptive-carousel.test.mjs`
- Modify: `tests/browser/app-shell.spec.ts`
- Modify: `tests/browser/public-routes.spec.ts`
- Create ignored evidence: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-10-report.md`

**Why:** portrait has no bounded workspace and scrolls inside `.ml-app-scroll`; landscape rail CSS stacks desktop groups; the station surface uses the shared center navigation strip and sizes from its enclosing section rather than the actual stage allocation.

**Repair Track:** route-owned `/music` viewport sizing, mini-player presentation groups, and station-specific carousel controls. Playback callbacks and Background carousel defaults remain unchanged.

**Retirement Track:** retire fixed portrait card sizing, magic `72px` stage subtraction, the Music center navigation strip, and tests that inspect only document scroll instead of `.ml-app-scroll`.

- [ ] RED at `360×670`, `746×284`, `390×844`, and `844×390`: require `.ml-app-scroll` not to scroll on `/music`; the player remains `data-layout="bottom"` in every portrait case; selected/side cards and controls remain visible; no clipping; center persists through expanded/collapsed player transitions. When height is scarce, hide the selected category heading and description only. Keep the `Station category` label visible when it fits and otherwise visually hidden (not removed), while preserving the category control's accessible name and all pills.
- [ ] RED the expanded rail's exact DOM/focus/visual grouping: top row `Previous station`, Play/Stop, `Next station`; bottom row `Player settings`, Favorite, `Background`, `Minimize`; no Volume control in rail mode. Collapsed remains decorative vinyl plus Play/Stop and Expand only.
- [ ] RED Music-only custom navigation through `renderControls`: Previous centered beneath the left side card and Next beneath the right side card, with no separate center strip. Preserve shared/default Background navigation unchanged.
- [ ] Bound the route workspace to the actual visual/dynamic viewport above the bottom app stack/player in portrait and beside the rail in landscape. Measure the allocated station stage box, remove fixed subtraction, and tune exactly three non-shell Music cards from available width and height. Hide presentational metadata rather than enabling page scroll when height is scarce.
- [ ] Refactor mini-player presentation only into the two requested rail rows. At severe height, shrink/reflow vinyl and identity before transport; never make the rail independently scroll.
- [ ] Run focused model and browser geometry suites, Background carousel regressions, non-Music scrolling regressions, increased-text and safe-area cases, typecheck, lint, build, and diff check.
- [ ] Obtain independent spec and quality approval, create one scoped commit, and record actual bounding boxes/scroll owners/control order in `task-10-report.md`.

### Task 11: Prove real-rail overlay clearance at Samsung-class viewports

**Files:**
- Modify first: `tests/browser/app-shell.spec.ts`
- Modify only for a reproduced collision: `components/ui/use-player-viewport-insets.ts`, relevant shared Radix primitive, `components/providers/music-interruption-notice.tsx`, `app/globals.css`
- Create ignored evidence: `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-11-report.md`

**Why:** the physical tester could not confirm clearance, and prior coverage sometimes injected the inset on unrelated routes instead of using the actual rail bounding box.

- [ ] At both Samsung-class and existing constrained-landscape sizes, open Player settings, interruption notice, station dialog, exposed right Sheet/drawer, production Popover, and Tooltip against the active expanded/collapsed rail. Use the toolbar's real left edge as the acceptance oracle and record each surface rectangle.
- [ ] Require zero-inset portrait and non-Music parity, correct focus/escape behavior, and no hidden action or portal content. If every surface already passes, make no production edit and commit only a durable test correction if needed.
- [ ] For each reproduced collision, repair only its canonical shared/fixed owner while preserving caller collision padding and zero-inset `undefined` semantics. Re-run shared/admin surface regressions, typecheck, lint, build, and diff check.
- [ ] Obtain independent spec and quality approval, create one scoped commit only if tracked changes are necessary, and record exact geometry in `task-11-report.md`.

### Task 12: Revalidate, deploy, repeat Samsung acceptance, and finish the draft PR loop

**Files:** same documentation/report boundaries as Task 7; no canonical documentation edit before physical green.

- [ ] Run the full Task 7 local gate plus the new Task 8–11 focused suites, audit exact scope/admin overlap, push reviewed commits, and require Vercel, CodeQL, and GitHub QA at one exact head.
- [ ] Reprove `/music`, valid distinct 256/512 PNGs, browser SVG rendering with zero art-route requests, and bounded artwork-route runtime logs on the immutable deployment.
- [ ] On the S24 Ultra/Chrome 151, record `innerWidth`, `innerHeight`, document client dimensions, `visualViewport` dimensions/offsets, DPR, and orientation. Re-run one-touch playback, all artwork surfaces, Previous/Next pairing, no timeline, portrait/landscape fit, expanded/collapsed rail, overlays, and Samsung Settings → Accessibility → Vision/Visibility enhancements → Reduce animations/Remove animations.
- [ ] Only after physical green, update and stage the approved QA/state/log/wiki documentation paths; then mark PR #183 ready and run the substantive CodeRabbit check/thread-resolution loop. Never merge.

### Amendment self-review

- Every physical finding maps to Tasks 8–12; accepted behaviors are explicit compatibility boundaries.
- No task introduces a second playback, artwork, player, or carousel owner.
- Production branches are evidence-gated; a non-reproduced hypothesis cannot authorize a repair.
- Exact Chrome CSS viewport remains intentionally captured at physical retest instead of inferred from screenshot pixels.
- Deferred Task 4/5 test-quality notes remain in the SDD ledger and must be presented to final branch review.
