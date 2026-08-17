# Atmosphere Physical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore canonical station artwork on the protected deployment, make one cold Play touch authoritative on the physically affected Samsung path, and use a coherent constrained-landscape player rail and viewport-fitted station carousel everywhere the active player is exposed.

**Architecture:** Keep the existing station-art identity, playback, player, and carousel owners. The centered card supplies a narrow touch/pen `pointerup` compatibility adapter without changing mouse/keyboard activation; Media Session publishes one cache-revisioned honest `512x512` PNG while app surfaces retain inline canonical SVG; every constrained-landscape route presents the existing player as a right rail and publishes its real overlay exclusion inset; only `/music` squeezes its bounded workspace around that rail, while other routes retain ordinary full-width vertical scrolling. The station carousel owns station-only looping, exact side-control geometry, glow clearance, and full allocated-stage use without changing Background carousel behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript/JavaScript, Sharp 0.35.3, Tailwind CSS 3, Embla Carousel, Radix UI, Media Session API, Node test runner, Playwright desktop/mobile Chromium and scoped WebKit, Vercel protected previews, GitHub Actions.

## Global Constraints

- Work only in `C:\tmp\massagelab-android-media-notifications` on `codex/media-notifications-audio-interruptions`; do not modify, switch, clean, or delete any other checkout or worktree.
- Preserve the untracked `docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md`; stage it only in the final documentation task after physical evidence is complete.
- Before every task, compare its file list with every active `codex/admin*` branch and worktree. Warn the user before editing a newly overlapping path.
- Do not redesign station artwork, add seeking/duration, add a second `<audio>`/AudioContext owner, or reintroduce the 10-second timeline.
- The rail activates on every route with an exposed player, landscape orientation, width at most `60rem`, and height at most `31.25rem`.
- Portrait retains the bottom player. Non-Music routes retain ordinary full-width vertical scrolling and are not squeezed by the rail; shared/fixed overlays still honor the real right-rail exclusion inset.
- Collapsed rail width is `7rem`; expanded rail width is `clamp(16rem, 34vw, 20rem)`.
- Collapsed rail exposes only decorative vinyl, Play/Stop, and Expand. Expanded rail uses transport row `Previous / Play-Stop / Next` and options row `Settings / Favorite / Background / Minimize`; Volume is never exposed in rail mode.
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

---

## Physical Round 3 Amendment — 2026-08-16

The physical Samsung Galaxy S24 Ultra retest of immutable deployed head
`4ef5804bcb7bc96e34a5b6bb731ee685af8e1883` supersedes Task 12's pending-device
assumption and the Round 2 inference that runtime readiness owned the remaining
first-touch failure. The centered Play control was stable and enabled for at
least five seconds, visibly depressed and produced Samsung haptic feedback, but
the first physical touch produced no player/loading state and Play remained
visible; the second touch started playback. The same exact head is green under
the trusted local Pixel-style Playwright tap contract. This is evidence for a
narrow physical compatibility seam between the received touch/pointer sequence
and the missing synthesized click, not evidence for a generic Chromium defect.

The same retest accepted immediate matching inline artwork, title/art pairing,
timeline removal, 16-second motion, portrait fit, current rail row ordering,
overlay clearance, and reduced-motion behavior. It reopened notification image
sharpness, rail vinyl geometry, station navigation spacing, global route
coverage for the landscape rail, full-height landscape station composition,
station looping, and category-pill glow clipping.

### Round 3 goal, architecture, and technology

**Goal:** make one physical Samsung Play touch authoritative without double
starting on browsers that do synthesize click; make the system artwork request
unambiguously fresh and full resolution; and finish the approved global
constrained-landscape rail plus station-only carousel presentation.

**Architecture:** reuse the centered station-card primary-action owner for a
touch/pen `pointerup` compatibility adapter, and reuse the same action function
for click/keyboard. Keep `station-artwork.ts` as canonical identity/URL owner
and the existing route as the platform raster adapter. Make compact-landscape
state global to the existing mini-player, but keep `/music` as the sole owner
of content squeezing/non-scrolling workspace behavior. Keep the adaptive
carousel controller shared while making the reduced-motion loop exception
explicitly station-only; keep Background behavior unchanged.

**Tech Stack:** unchanged from the parent plan: Next.js 16, React 19,
TypeScript/JavaScript, Sharp, Tailwind CSS, Embla, Radix UI, Media Session,
Node test runner, Playwright desktop/mobile Chromium plus WebKit media smoke,
Vercel, GitHub Actions, and CodeRabbit.

### Round 3 authority and scope checks

**Baseline/Authority Refs:**

- Exact local, remote, PR, and immutable-preview head:
  `4ef5804bcb7bc96e34a5b6bb731ee685af8e1883`.
- `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-8-report.md`
  through `task-12-report.md`.
- `docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md`.
- The four Samsung screenshots from the Round 3 retest and the user's approved
  interaction, responsive-layout, artwork, and validation sections.
- `docs/project-state.md`, `docs/project-log.md`, `docs/wiki/index.md`, and
  `docs/wiki/atmosphere-audio.md` for current product and operational bounds.

**BaselineUsageDraft:**

- Required baseline refs: current exact head/status; canonical state/log/wiki;
  parent plan; Tasks 8–12 reports; physical QA report.
- Delivered context refs: physical screenshots and the user's direct Round 3
  observations/approvals.
- Acknowledged before plan refs: all required refs above.
- Cited in plan refs: all required refs above.
- Missing refs: none. Exact Samsung event traces are not remotely observable;
  deterministic pointerup-without-click coverage plus the physical gate owns
  that evidence boundary.
- Decision: continue.

**Requirement Ready Check:**

- Requirement source refs: direct Round 3 physical observations and four
  separately approved design sections.
- Goals and scope refs: one-touch adapter, one revisioned 512 Media Session
  image, global constrained-landscape rail, vinyl/side-control/stage/loop/glow
  presentation, and complete release gates.
- User/scenario refs: S24 Ultra, Chrome 151, phone portrait and constrained
  landscape, `/music` and non-Music routes, normal and reduced motion.
- Acceptance refs: the deterministic event matrix and exact geometry/gate list
  in Tasks 13–17.
- Open blocker questions: none before implementation. Physical notification
  sharpness is an explicit evidence fork, not an implicit authorization to add
  1024 artwork.
- Decision: ready.

**Change Necessity:**

- User-visible need: the first physical Play touch is ignored, notification art
  remains soft, the rail is route-inconsistent, and station presentation does
  not meet the approved geometry/loop/glow contract.
- No-change/non-code option: waiting, user training, or documenting double-tap
  and layout limitations would leave every defect intact.
- Why code change is necessary: each failure is owned by event dispatch,
  Media Session metadata, responsive player CSS/state, or carousel behavior.
- Minimum change boundary: the existing station card, artwork URL/controller,
  mini-player/CSS, adaptive carousel controller/stage, and focused tests.
- Decision: code-change.

**Existence Check:**

- Proposed new surface: no new playback, artwork, player, carousel, overlay, or
  gesture subsystem. The pointer adapter is local to the existing primary
  action; the artwork revision is part of the existing URL contract; the rail
  uses the existing compact-landscape query/state.
- Existing owner/reuse candidate: station card, `station-artwork.ts`, Media
  Session controller, mini-player, adaptive carousel controller/stage, and
  global CSS.
- Why existing surface is sufficient: every required signal and callback is
  already present at those owners.
- Entropy/retirement impact: retire route-only rail gating, dual Media Session
  candidates, reduced-motion station loop suppression, and the separate
  controls-row allocation; add no permanent fallback owner.
- Decision: reuse-existing.

**Architecture Integrity Lens:**

- Invariant: one user intent reaches the provider at most once; provider
  request/session guards remain authoritative; canonical SVG identity remains
  single-source; `/music` alone constrains its scroll workspace; Background
  carousel behavior does not change.
- Canonical owners: station card action, provider callback, canonical artwork
  helper/raster route, mini-player/body marker, adaptive controller/stage.
- Responsibility overlap: none planned. Pointer normalization must not move to
  the provider, and route-aware content squeezing must not move into shared
  overlay primitives.
- Higher-level simplification: one global rail-active marker replaces repeated
  route-specific player geometry while the existing Music-route marker remains
  only for workspace sizing.
- Retirement/falsifier: if pointerup-without-click does not reproduce zero
  activation on current code, stop Task 13 before production edits. If a forced
  revisioned 512 image remains soft physically, do not add 1024; invoke the
  platform-derivative fork in Task 14.
- Verdict: proceed.

**Compatibility Boundary:**

- Preserve provider request-generation, Pause/Stop/Previous/Next authority,
  loading/error/retry semantics, one AudioContext/carrier owner, and no seeking
  or fabricated duration/timeline.
- Preserve mouse click and keyboard Enter/Space activation, carousel dragging,
  card details, Favorite, and non-primary buttons.
- Preserve inline canonical SVG for carousel/vinyl, station identity across
  Previous/Next, direct legacy 256/512 route compatibility, and current cache
  success/error policies. Only the Media Session candidate list becomes one
  revisioned 512 entry.
- Preserve portrait bottom player. In constrained landscape, use the rail on
  every route while active; only `/music` content is squeezed/non-scrolling.
  Other route content stays full-width and vertically scrollable, while
  overlays clear the rail.
- Preserve Background carousel loop/reduced-motion/navigation/geometry. Station
  looping remains active with static zero-duration presentation under reduced
  motion.
- Keep PR #183 draft until exact-head automated, hosted, and affected Samsung
  gates pass. Never merge automatically.

**TDD Route:**

- Mode: auto.
- Decision: strict.
- Strict authority: the parent plan's explicit rule that every production
  change begins with the smallest reproducing RED.
- Test posture: deterministic regression RED for each current-code defect,
  minimal owner repair, focused GREEN, then proportionate broad verification.
- Reason: the physical click omission, shared rail behavior, and shared
  carousel controller all carry double-action/cross-route/cross-surface risk.
- Verification: each task records RED/GREEN evidence, receives fresh spec then
  quality review, and is committed once as an independently revertible slice.

**Plan Pressure Test:**

- Owner/contract/retirement: explicit in every task; no duplicate owner.
- Architecture integrity/higher-level path: global rail state is centralized in
  the mini-player, while content/overlay consumers remain separately bounded.
- Verification scope: event-level, source-contract, geometry, cross-route,
  engine, hosted, physical, and PR checks are named below.
- Task executability: Tasks 13–16 are independently reviewable; Task 17 owns
  release and physical completion only.
- Pressure result: proceed.

**Complexity Budget:**

- Artifact class: maintained React interaction owner, platform metadata adapter,
  responsive player CSS, shared carousel controller, and oversized browser
  suites.
- Target files: `station-carousel-card.tsx`, `music-mini-player.tsx`,
  `app/globals.css`, `use-adaptive-carousel-controller.ts`, station/stage files,
  and their existing canonical tests.
- Current pressure: provider and browser specs are already large; the provider
  does not need to change. `app-shell.spec.ts` already owns reusable geometry
  helpers and must not receive a second geometry framework.
- Projected pressure: within budget when the touch adapter remains local, rail
  state replaces rather than duplicates the route gate, and station behavior is
  one explicit shared-controller exception.
- Budget result: at-risk but bounded.
- Planned governance: split Tasks 13–16 by owner; reuse existing test helpers;
  create one coherent commit per task unless an explicitly named,
  evidence-gated sub-slice has its own RED/GREEN/review boundary; do not combine
  event, artwork, player, and carousel changes.

**Plan-Time Complexity Check:**

- Existing size/shape signals: `music-provider.tsx` and `app-shell.spec.ts` are
  high-pressure; `station-carousel-card.tsx` has two presentations; global CSS
  already groups Music workspace/player rules; shared controller currently
  conflates static presentation and finite looping.
- Owner fit: all changes fit existing owners without provider edits.
- Add-in-place risk: highest in global CSS and `app-shell.spec.ts`; keep selectors
  under the existing compact-landscape block and extend the settled-geometry
  fixture rather than duplicating it.
- Better boundary: Task 13 local action helper; Task 14 canonical revision
  constant; Task 15 global rail marker/presentation; Task 16 explicit station
  loop/static-motion split plus station-only stage CSS.
- Recommendation: split task; no broad refactor.

### Round 3 file responsibility additions

- `components/atmosphere/station-carousel-card.tsx`: owns normalized centered
  primary Play activation and synthetic-click suppression; it does not own
  playback lifecycle.
- `lib/atmosphere/station-artwork.ts`: owns the platform artwork revision and
  sized URL serialization.
- `lib/atmosphere/media-session-controller.js`: publishes the single current
  platform candidate.
- `components/providers/music-mini-player.tsx`: owns global compact-landscape
  rail state/body markers and the existing rail/bottom composition switch.
- `app/globals.css`: owns global rail/vinyl geometry, Music-only workspace
  squeezing, exact station-control placement, and category glow clearance.
- `components/carousels/use-adaptive-carousel-controller.ts`: owns effective
  loop separately from motion duration/presentation.
- `components/carousels/adaptive-carousel-stage.tsx` and `.module.css`: expose
  and place station custom controls relative to the side summaries without
  changing Background default controls.
- `components/carousels/adaptive-carousel-model.js`: owns constrained-landscape
  full-height station tuning and keeps the ordinary maximum elsewhere.
- Existing Node/Playwright suites remain the only test owners; no new test
  framework or benchmark is introduced.

### Execution Readiness View

- Intent Lock: implement only the four approved Round 3 repair surfaces and
  the final release gate.
- Scope Fence: Tasks 13–17; no provider redesign, 1024 image, notification UI,
  Background carousel redesign, call/PWA/Bluetooth/Apple claim, or merge.
- Baseline Lock: exact head `4ef5804b...`, clean tracked state, one intentional
  untracked QA report, accepted Round 3 behaviors above.
- Approved Behavior: exact pointerup rules, one revisioned 512 candidate,
  global rail/non-Music scroll split, rail vinyl geometry, 16px side controls,
  full constrained-landscape stage, station loop/static reduced motion, glow
  clearance, and the approved gate sequence.
- Owner/Contract Constraints: use the owners in the responsibility map; no
  second audio/artwork/player/carousel/overlay owner.
- Compatibility Boundary: as stated above.
- Retirement Boundary: remove obsolete route-only rail, dual published
  candidates, severe-height rail-vinyl shrink, station reduced-motion finite
  rail, controls-row reserve, and clipped pill padding; retain direct route
  size compatibility and Background behavior.
- Task Batches: Task 13 interaction; Task 14 platform art; Task 15 player; Task
  16 station carousel; Task 17 release.
- Test Obligations: strict RED/GREEN, fresh spec and quality review, coordinator
  rerun, one coherent task commit or named evidence-gated sub-slice commit, and
  exact-head full matrices before physical handoff.
- Review Gates: no next task before current task review/verification/commit.
- Drift/Rewind Rules: verify every finding against current code; if a RED does
  not reproduce, stop that repair; after a review correction rerun the affected
  focused and proportionate checks; normal revert commits only after push.
- Evidence Required Before Completion: exact command counts, decoded artwork,
  geometry/event receipts, immutable deployment, S24 observations, checks,
  substantive CodeRabbit review, and zero unresolved threads.
- Advisory Boundary: method-pack execution guidance only; not GateDecision,
  PolicySnapshot, or completion authority.

### Task 13: Make the centered primary Play authoritative on touch/pen pointerup

**Files:**

- Modify: `components/atmosphere/station-carousel-card.tsx`
- Modify: `tests/browser/music-media-session.spec.ts`
- Modify: `tests/browser/public-routes.spec.ts`
- Modify only if needed for the local source contract:
  `tests/music-visualizer-provider.test.mjs`
- Create ignored evidence:
  `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-13-report.md`

**Why:** the S24 delivers a visible/haptic touch press but no resulting click or
playback intent, while trusted local tap coverage synthesizes click and passes.
The card must normalize both sequences to one provider call.

**Change Necessity:** input documentation cannot repair a missing click. The
minimum owner is the existing centered primary Play button; the provider and
shared Button remain unchanged.

**Impact/Compatibility:** only enabled, ready, inactive Play uses the adapter.
Retry, Preparing, Stop, Favorite, details, swipe, mouse, and keyboard keep their
current owners and semantics.

**Repair Track:** extract the existing ready Play body into one local
`activatePrimaryAction` callback. On `pointerdown`, record only touch/pen
pointer id, button element, and start coordinates. On `pointermove`, invalidate
when Euclidean movement exceeds 10 CSS pixels. On `pointercancel`, clear. On a
same-id `pointerup` delivered to the same button with movement at most 10px,
invoke Play once, arm suppression for only the immediately following synthetic
click, and clear that suppression at the next macrotask if no click arrives.
Do not call Play, prewarm, prevent carousel movement, or claim audio on
`pointerdown`. Mouse pointerup never invokes the adapter. The normal click
handler suppresses only the armed touch/pen click and otherwise invokes the
same callback; keyboard-generated click (`detail === 0`) remains authoritative.

**Retirement Track:** retire the false assumption that stable readiness plus a
local `tap()` proves physical click delivery. The adapter has no long-lived
fallback flag: its pending pointer and click-suppression state clear after
success, movement, cancellation, unmount, or the zero-delay cleanup.

- [ ] Capture `TaskStartSnapshot`: exact head/status, current primary-action
  DOM, all affected admin/password-reset overlap, and current local Pixel-style
  tap GREEN. Do not infer a generic Chrome root cause.
- [ ] Add a strict raw-event RED after Play has remained enabled for five
  seconds: dispatch one touch `pointerdown` plus same-target/same-id
  `pointerup` without `click`; require exactly one provider play call, one
  generator generation, and Loading/Playing. Current code must remain Play
  with no toolbar. Add the equivalent pen case.
- [ ] Add RED edge cases: append the browser's following synthetic `click` and
  require still one generation; movement `>10px`, mismatched pointer id, and
  `pointercancel` each produce zero activation; movement exactly `10px`
  remains eligible. Assert no activation occurs at pointerdown.
- [ ] Implement only the local normalized activation contract above. Do not
  add pointer handlers to the shared Button, Embla controller, provider, or
  other card controls.
- [ ] GREEN mouse `.click()`, keyboard Enter and Space, real Playwright
  touchscreen `tap()`, raw touch/pen pointerup-without-click, synthetic-click
  suppression, drag/move/cancel, Favorite, details, Retry, and Stop. Require one
  playback session/generation, never two.
- [ ] Run:

  ```powershell
  node --test tests/music-visualizer-provider.test.mjs
  npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "pointerup without click|synthetic click|first station Play|center station details"
  npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/public-routes.spec.ts --project=desktop-chromium --grep "first station Play|center station details"
  npm run typecheck
  npm run lint
  npm run build
  git diff --check
  ```

  Expected: all selected cases and static/build gates pass; the raw touch and
  pen cases report one generation, invalid sequences zero, and the combined
  pointerup/click sequence one.
- [ ] Obtain fresh spec then quality approval. The coordinator reruns the exact
  focused gates, stages only the authorized tracked files, commits
  `fix: normalize atmosphere touch activation`, and records the event receipt
  in `task-13-report.md`.

### Task 14: Publish one fresh, honest 512px Media Session artwork candidate

**Files:**

- Modify: `lib/atmosphere/station-artwork.ts`
- Modify: `lib/atmosphere/media-session-controller.js`
- Modify: `tests/atmosphere-station-artwork.test.mjs`
- Modify: `tests/atmosphere-media-session-controller.test.mjs`
- Modify: `tests/browser/music-media-session.spec.ts`
- Modify only if the physical derivative fork is triggered:
  `app/api/atmosphere/stations/[stationId]/artwork/route.tsx`
- Create ignored evidence:
  `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-14-report.md`

**Why:** the platform currently receives both 256 and 512 candidates and may
reuse an earlier cached URL. The S24 notification image matches the station but
still appears soft.

**Change Necessity:** only metadata and a fresh URL can remove candidate/cache
ambiguity. The canonical helper/controller are the minimum boundary; inline
SVG app rendering does not change.

**Impact/Compatibility:** retain direct `size=256` and `size=512` route support,
unknown/unsupported/error semantics, byte-safe PNG response, and the exact
canonical art model. Publish only one `512x512 image/png` Media Session entry
whose URL contains a named revision query. Do not add 1024.

**Repair Track:** export one reviewed platform artwork revision constant from
`station-artwork.ts`; serialize it in the canonical 512 URL (for example,
`?size=512&v=<revision>`); and have the controller publish only that entry.
Previous/Next must replace title, station id, and revisioned URL in the same
metadata publication.

**Retirement Track:** retire dual 256/512 candidate publication and unversioned
platform cache identity. Do not retire the 256 route because it remains a
tested compatibility surface.

- [ ] RED the exact metadata array: one entry, `sizes: "512x512"`,
  `type: "image/png"`, revisioned canonical URL; no 256 descriptor. Require
  Previous/Next to change station URL atomically and repeated publication to
  keep the same revision.
- [ ] Add the revision to the canonical URL helper without allowing callers to
  hand-build it. Keep inline card/vinyl output and zero in-app route requests
  unchanged.
- [ ] Decode the exact revisioned 512 response with a real decoder in desktop
  Chromium, mobile Chromium, and WebKit; assert `512x512`, valid PNG signature,
  stable same-station hash, distinct cross-station hash, and no timeline.
- [ ] Run:

  ```powershell
  node --test tests/atmosphere-station-artwork.test.mjs tests/atmosphere-media-session-controller.test.mjs
  npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --project=mobile-chromium --project=webkit-media-smoke --grep "canonical station artwork|Media Session metadata|Previous and Next"
  npm run typecheck
  npm run lint
  npm run build
  git diff --check
  ```

  Expected: one revisioned 512 candidate, real 512 decode in every applicable
  engine, atomic identity transitions, zero timeline, and all gates green.
- [ ] Obtain spec/quality approval and one scoped commit
  `fix: refresh media session station artwork`.
- [ ] After the reviewed commit is pushed, deploy an immutable preview and
  physically inspect one notification plus one Previous/Next transition on the
  S24. If sharpness is acceptable, close the task.

#### Task 14B: Evidence-gated platform derivative

Task 14B does not exist unless the reviewed, revisioned Task 14A 512 image is
still physically soft on the S24. The triggering receipt must include the exact
deployment SHA/URL, requested revisioned artwork URL, decoded dimensions/hash,
and a sanitized notification observation. If triggered, add restrained
raster-only fine-detail contrast/sharpening behind the existing revisioned 512
route, prove canonical identity is unchanged, bump the revision, and rerun all
Task 14 gates. Task 14B receives its own strict RED/GREEN, fresh spec/quality
review, scoped `fix: tune media session artwork clarity` commit, immutable
deployment, and repeat physical notification/Previous/Next row. Never alter
inline SVG or add 1024 speculatively. This named sub-slice is the only exception
to Task 14's one-commit boundary.

### Task 15: Make the constrained-landscape player rail global and enlarge its vinyl

**Files:**

- Modify: `components/providers/music-mini-player.tsx`
- Modify: `app/globals.css`
- Modify: `tests/browser/app-shell.spec.ts`
- Modify: `tests/browser/public-routes.spec.ts`
- Modify only for a reproduced inset regression:
  `components/ui/use-player-viewport-insets.ts`
- Create ignored evidence:
  `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-15-report.md`

**Why:** active playback still renders a bottom player on non-Music routes in
constrained landscape, and the rail vinyl does not use the approved visual
space.

**Change Necessity:** route transition, player geometry, and overlay exclusion
are runtime/CSS behavior. The existing mini-player/body state and CSS are the
minimum owners.

**Impact/Compatibility:** every active constrained-landscape route gets the
same expanded/collapsed rail and action rows. `/music` alone applies content
padding/hidden scroll; non-Music pages remain full-width ordinary vertical
scroll surfaces. All real portals/fixed surfaces clear the rail. Portrait and
unconstrained layouts remain bottom/top as configured.

**Repair Track:** derive `isRailLayout = showPlayer && isCompactLandscape`
independent of pathname. Publish `data-layout="rail"` and one semantic
rail-active body marker globally; retain the Music-route marker only for the
bounded workspace. Switch rail composition on `isCompactLandscape`, not
`isMusicRoute`. Split global rail variables/toolbar/interruption/overlay rules
from Music-only workspace squeezing. Introduce an expanded-diameter variable
equal to `clamp(16rem, 34vw, 20rem)`; expanded rail and vinyl use that diameter,
top/left align the record at `(0,0)`, and keep it behind identity/actions.
Collapsed rail remains `7rem` wide but retains the expanded diameter, clips
overflow, and shows the vinyl's left arc plus only Play/Stop and Expand. Remove
the severe-height vinyl shrink.

**Retirement Track:** retire pathname-gated rail layout and the special
`4.25rem` severe-height record. Retain Music-route state only for workspace
allocation; do not add per-route rail exceptions.

- [ ] RED at `844x390`, `746x284`, and the captured S24-class viewport: start
  on `/music`, then client-navigate while playing to `/`, `/wellness`, and
  `/clock`. Require `data-layout="rail"` throughout landscape, exact action
  sets in both rail states, one active rail body marker, and zero stale route
  class/inset after returning to portrait.
- [ ] RED non-Music behavior: `.ml-app-scroll` remains vertically scrollable,
  content keeps full viewport width, no Music workspace padding is applied,
  and settled Dialog/Sheet/Dropdown/Tooltip/interruption surfaces and every
  semantic action end at or before the real rail left edge.
- [ ] RED vinyl geometry: expanded diameter equals expanded rail width within
  one pixel and shares its top/left edge; identity/actions paint above it;
  collapsed diameter equals expanded diameter, left edge/top remain fixed,
  visible clipped width equals the collapsed rail width, and no right/center arc
  replacement or scale-down occurs.
- [ ] Implement the global marker/composition and CSS split above. Do not
  constrain or disable non-Music route scrolling.
- [ ] Extend the existing settled-overlay geometry helper/matrix rather than
  creating a second oracle. Test expanded/collapsed states before and after
  each client route transition, safe-area offsets, increased text, and focus/
  Escape restoration.
- [ ] Run:

  ```powershell
  npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "global constrained landscape rail|real music rail|compact landscape player rail|vinyl geometry|non-Music"
  npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=desktop-chromium --grep "route transition|non-Music|overlay"
  node --test tests/app-settings.test.mjs tests/calendar-creation-routes.test.mjs
  npm run typecheck
  npm run lint
  npm run build
  git diff --check
  ```

  Expected: global rail on all constrained-landscape routes, ordinary
  non-Music scroll/full width, real overlay clearance, exact vinyl clipping,
  portrait parity, and all gates green.
- [ ] Obtain fresh spec/quality approval, commit
  `fix: use the player rail across landscape routes`, and record all route,
  scroll, vinyl, and overlay rectangles in `task-15-report.md`.

### Task 16: Finish station-only carousel fit, looping, controls, and pill glow

**Files:**

- Modify: `components/atmosphere/station-carousel.tsx`
- Modify: `components/carousels/adaptive-carousel-model.js`
- Modify: `components/carousels/use-adaptive-carousel-controller.ts`
- Modify: `components/carousels/adaptive-carousel-stage.tsx`
- Modify: `components/carousels/adaptive-carousel-stage.module.css`
- Modify: `app/globals.css`
- Modify: `tests/adaptive-carousel.test.mjs`
- Modify: `tests/browser/app-shell.spec.ts`
- Modify: `tests/browser/public-routes.spec.ts`
- Create ignored evidence:
  `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-16-report.md`

**Why:** side navigation is farther than 16px from its preview, the stage still
reserves a separate controls row and caps constrained-landscape card height,
reduced motion disables station looping, and the pill scroller clips its glow.

**Change Necessity:** these are carousel/controller/CSS contracts; no user or
documentation setting can repair them. Existing owners suffice.

**Impact/Compatibility:** Music station controls and constrained-landscape
geometry change. Background default/custom navigation, loop policy, and
reduced-motion behavior stay byte/DOM/behavior compatible. Station reduced
motion remains static with zero-duration transitions but continues to wrap.

**Repair Track:**

1. Separate motion suppression from loop eligibility in the shared controller.
   For stations, resolve requested loop normally even under reduced motion and
   set Embla duration to zero; presentation transforms/transitions remain none.
   For Background, retain the current finite non-looping reduced-motion path.
2. For station `music-fit`, stop allocating a second controls row. Top-align
   summary presentations, expose the controls wrapper with a stable data
   marker, and position Previous/Next at
   `sideCard.bottom + 16px` in their existing left/right columns. Keep both
   controls and the central card inside the allocated stage.
3. In the responsive model, remove the `224px` card-height ceiling only when
   the measured stage is constrained landscape (`width > height` and height is
   within the existing compact boundary); ordinary portrait/desktop tuning
   keeps the current cap. The center card consumes the resulting stage height;
   summary height remains bounded so its 16px-offset control fits.
4. Restore pill paint space with equal negative block margin and internal block
   padding so the glow is not clipped while net layout height is unchanged.
   Preserve horizontal scrolling, all pills, accessible group name, and the
   scarce-height visually hidden label contract.

**Retirement Track:** retire station reduced-motion `finiteRail`, the station
controls grid row/min-height reserve, constrained-landscape `224px` ceiling,
and block-padding overrides that clip pill halos. Do not retire shared
Background defaults or station category semantics.

- [ ] RED loop behavior from first/last station using button, Arrow keys, direct
  side-card navigation, and a real mobile Chromium drag/swipe in normal and
  reduced motion. Execute both last→first and first→last swipe directions and
  assert the centered station identity changes to the wrapped endpoint. Under
  reduced motion, also assert zero transition duration and no animated
  presentation transform while identity still wraps. Run the same drag loop in
  WebKit where the configured media-smoke project exposes the station fixture.
  Require enabled controls at both edges and unchanged Background button,
  keyboard, and drag edge behavior in normal and reduced motion.
- [ ] RED geometry at `390x844`, `844x390`, `746x284`, and the captured S24
  viewport. For both selected categories and after remount, require each side
  control's top to equal its corresponding side-card bottom plus `16px ±1`,
  horizontal center aligned with that card, and all boxes inside the stage.
- [ ] RED constrained-landscape height: stage begins immediately after the
  category-pill allocation and ends at the usable viewport/app-bar edge; center
  card consumes the stage's full available height within one pixel, while the
  side-control columns stay in that same allocation, with no `224px` ceiling. Require no
  `.ml-app-scroll` overflow and no card/title/action clipping.
- [ ] RED pill paint space by requiring the scroller's clip/padding box to
  contain each selected/unselected button halo at top and bottom while the
  picker/stage boundary and total workspace height are unchanged before/after
  the clearance rule. Include increased text and horizontal scroll.
- [ ] Implement the four owner changes above. Do not change Background
  `renderControls`, profile constants, or animation policy.
- [ ] Run:

  ```powershell
  node --test tests/adaptive-carousel.test.mjs
  npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "station carousel loops|station swipe wraps|16px below|full constrained landscape|category pill glow|four-view|Background default navigation|Background drag"
  npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=desktop-chromium --project=webkit-media-smoke --grep "station carousel loops|station swipe wraps|reduced motion|Background default navigation|Background drag"
  npm run typecheck
  npm run lint
  npm run build
  git diff --check
  ```

  Expected: station button/keyboard/side-card/drag wrap in both directions and
  both motion modes, wrapped identity changes with static/no-transition reduced-
  motion presentation, unchanged Background drag and edge behavior, exact
  side-control/stage/glow geometry, no route scroll, and all gates green.
- [ ] Obtain fresh spec/quality approval, commit
  `fix: complete responsive station carousel behavior`, and record identity,
  transition, geometry, scroll, and glow receipts in `task-16-report.md`.

### Task 17: Full verification, immutable Samsung acceptance, and draft PR loop

**Files:**

- Modify after physical GREEN only:
  `docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md`
- Modify after physical GREEN only: `docs/project-state.md`
- Modify after physical GREEN only: `docs/project-log.md`
- Modify after physical GREEN only: `docs/wiki/atmosphere-audio.md`
- Create ignored evidence:
  `.superpowers/sdd/2026-08-16-atmosphere-physical-fixes/task-17-report.md`

**Why:** Round 3 is not complete until one exact head passes broad automation,
hosted proof, affected S24 rows, and the substantive review loop.

**Change Necessity:** source work ends after Tasks 13–16. Documentation changes
become necessary only to record confirmed final behavior; before physical GREEN
the QA report remains untracked and canonical docs remain unchanged.

**Impact/Compatibility:** no merge. Do not mark PR #183 ready or trigger
CodeRabbit until every preceding local/hosted/affected physical row is green.
Do not infer PWA, Bluetooth, calls, meetings, carrier failure, or Apple results.

**Repair Track:** verify exact current code and repair only deterministic,
still-valid failures in their canonical owner with the smallest strict cycle.

**Retirement Track:** on successful completion, retire the draft-only review
state and pending affected-Samsung rows through truthful documentation. Keep all
unexecuted platform/device rows explicitly pending.

- [ ] Capture exact final preflight: head/status, staged/untracked files, no
  merge/rebase/cherry-pick, refreshed `origin/main`, PR head/draft state, and
  committed/dirty overlap with every active admin/password-reset worktree.
- [ ] Run the complete focused Node matrix from Task 12 plus all Task 13–16
  suites, then:

  ```powershell
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts tests/browser/music-visualizer.spec.ts --project=desktop-chromium
  npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts tests/browser/music-visualizer.spec.ts --project=mobile-chromium
  npm run test:browser -- tests/browser/music-media-session.spec.ts --project=webkit-media-smoke
  git diff --check
  ```

  Expected: zero failures; only intentional project/engine skips and the known
  non-failing Babel large-file note are acceptable.
- [ ] Push the reviewed exact head, wait for Vercel/CodeQL/GitHub QA, deploy one
  immutable preview, and prove `/music` HTTP 200, inline SVG with zero in-app
  artwork requests, one revisioned 512 platform response with real decode and
  stable/distinct hashes, no route exceptions, and matching PR/remote/deployed
  SHA.
- [ ] On the recorded S24 Ultra/Chrome 151, capture CSS/visual viewport/DPR and
  run the affected matrix:
  1. after Play is visibly ready for five seconds, one touch starts a player and
     one session;
  2. carousel/vinyl/notification/lock-screen art match; notification 512 art is
     acceptably sharp or invokes the bounded Task 14 derivative fork;
  3. Previous/Next atomically update title/art and no timeline appears;
  4. portrait bottom player, `/music` fit, 16-second vinyl, and reduced motion;
  5. expanded/collapsed rail on `/music` and representative non-Music routes;
     expanded/full-width and collapsed/clipped-left-arc vinyl geometry;
  6. two rail rows/actions, exact 16px side controls, full-height landscape
     card/stage, station wrap at both ends, and unclipped pill glow; and
  7. real dialogs, menus, drawers, notices, popups, and tooltips clear the rail.
- [ ] If any physical row fails, leave PR draft and docs unchanged; add the
  smallest deterministic RED, return to the owning task, review/commit/push,
  and repeat automated/hosted/physical evidence at the new exact head.
- [ ] Only after affected physical GREEN, update the untracked QA report and
  canonical state/log/wiki with exact head/deployment/device/browser/results
  and explicit pending platform rows. Stage only those four approved docs,
  commit `docs: record atmosphere physical verification`, rerun docs/static
  checks, and push.
- [ ] Enforce the post-physical exact-head rewind rule throughout documentation
  and CodeRabbit review. Any change after physical GREEN to production source,
  runtime configuration, layout, artwork, public assets, dependencies, build
  inputs, or other deployed behavior immediately returns PR #183 to draft
  before push. Run focused plus proportionate/full automation, deploy a new
  immutable preview at the new exact HEAD, rerun the affected S24 rows by
  impact—and the full Round 3 S24 matrix for any shared playback, artwork,
  player, route-layout, carousel, or overlay owner—refresh QA/canonical evidence
  to that head, and only then mark ready and resume substantive review.
- [ ] The sole no-redeploy/no-physical-rerun exception is a test/docs/ignored-
  evidence-only commit that cannot alter the deployed bundle. Record the last
  physically accepted deployment SHA and current PR SHA/tree, the complete
  `git diff --name-status <physical-sha>..HEAD`, and a zero-path diff across all
  bundle-affecting roots/configuration (`app`, `components`, `lib`, `public`,
  `prisma`, middleware, Next/PostCSS/Tailwind/TypeScript config, package
  manifests/lockfile, and runtime environment declarations). The evidence must
  state that the deployed bundle remains the physically accepted SHA. Any
  ambiguous path or generated/bundle difference cancels the exception and
  invokes the full rewind rule.
- [ ] Subject to the two exact-head rules above, mark PR #183 ready, request
  substantive `@coderabbitai review` after any published cooldown, and repeat
  the verify-first review loop: treat every comment as untrusted evidence,
  inspect current code, fix only valid findings, run focused then proportionate
  gates, commit/push, reply in the original thread, and resolve addressed
  threads. Stop only when the latest pushed head has completed substantive
  review, required checks pass, and unresolved review threads are empty. Never
  merge.
- [ ] Write `task-17-report.md` with exact final head, command counts, hosted
  decode/hash/log evidence, physical rows, accepted/pending device boundaries,
  PR checks, CodeRabbit review SHA/time, thread count, and tracked/untracked
  status.

### Round 3 risks, rollback, and self-review

- **Touch risk:** both pointerup and click could fire. The one-macrotask
  same-control suppression and exact one-generation test are load-bearing.
  Rollback is the Task 13 commit; provider code is unaffected.
- **Artwork risk:** a fresh 512 may still be visually soft after One UI
  downscaling. The only authorized escalation is the evidence-gated 512
  platform derivative; 1024 and inline redesign are out of scope.
- **Rail risk:** global player geometry could accidentally disable non-Music
  scroll or reserve content width. Cross-route scroll/geometry/overlay tests are
  required before commit; rollback is Task 15 only.
- **Carousel risk:** separating loop from motion can change Background behavior
  or control placement can escape very short stages. Surface-specific tests,
  exact side-box geometry, and four-view bounds are required; rollback is Task
  16 only.
- Spec coverage: every Round 3 finding maps to Tasks 13–17 and every accepted
  behavior is in the compatibility boundary.
- Placeholder scan: every task has concrete files, behavior, commands, expected
  outcomes, and stop conditions; no deferred fill-in instruction remains.
- Type consistency: URL revision remains a string owned by the canonical
  helper; pointer state is local DOM/ref state; loop remains boolean and motion
  duration remains numeric.
- Architecture/minimality: no provider, artwork model, player, carousel, or
  overlay owner is duplicated. Optional derivative work is physically gated.
- Verification: every production task has an exact RED, focused commands,
  expected results, reviews, and one coherent task commit, except named Task
  14B which has its own evidence trigger and complete sub-slice gates. Task 17
  owns broad/hosted/physical/PR completion and exact-head rewind.
- Repair/retirement: each task identifies both; direct route compatibility and
  Background behavior are deliberately retained.
- Execution route: subagent-driven. Tasks 13–16 have bounded owners and require
  fresh implementer, spec reviewer, and quality reviewer; Task 17 is coordinated
  serially. Fallback is inline execution with the same gates if agent capacity
  is unavailable. No new user confirmation is required before implementation;
  deployment/PR actions remain limited by the explicit Task 17 stop boundaries.
