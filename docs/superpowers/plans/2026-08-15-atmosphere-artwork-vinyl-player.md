# Atmosphere Artwork and Vinyl Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Atmosphere artwork identical across carousel, player, notification, and lock screen; publish the generator as Live; make the first Play activation authoritative; and add the approved decorative vinyl player-bar presentation.

**Architecture:** A pure station-art module owns deterministic SVG generation and canonical artwork URLs, while one Node route rasterizes that SVG to a cacheable 512 by 512 PNG used by every surface. `MusicProvider` remains the only playback owner; Media Session gains a guarded indefinite position publication, and the Componentry registry output is reduced to a pointer-inert CSS vinyl driven entirely by provider state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript/JavaScript, Sharp 0.35.3, Tailwind CSS 3, existing MassageLab button variants, Media Session API, Node test runner, Playwright desktop/mobile Chromium and scoped WebKit, Vercel preview deployment.

## Global Constraints

- Work only in `C:\tmp\massagelab-android-media-notifications` on `codex/media-notifications-audio-interruptions`.
- Start implementation from approved-plan HEAD after this plan commit; preserve the untracked `docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md` until Task 7 records new physical truth.
- Do not modify, switch, clean, reset, move, or delete any other checkout or worktree.
- Before Task 1 and again before Task 7 documentation edits, read the active admin worktree status and branch changed-file set. Warn the user before editing any newly overlapping path.
- `MusicProvider` remains the sole owner of the generator, carrier, Media Session, active station, favorites, volume, and interruption state.
- Do not add a second `<audio>` element, iframe, YouTube owner, Tone context, MediaStream carrier, tonearm, vinyl click handler, or independent playback state.
- Run `npx shadcn@latest add @componentry/music-player` exactly once in Task 4, then adapt its output. Do not retain `framer-motion`; use CSS animation only.
- Preserve Componentry's MIT copyright and permission notice in `docs/licenses/componentry-mit.txt` and cite that file from the adapted component.
- The canonical artwork must preserve the approved carousel design and be identical across carousel, player, notification, and lock screen.
- The record is decorative and pointer-inert. It spins only in Playing, freezes in every other state, and never spins under `prefers-reduced-motion: reduce`.
- Expanded primary controls are ordered exactly `Favorite`, `Previous`, `Play/Stop`, `Next`, `Background`. Settings is far left; desktop Volume then Minimize are at the right.
- Play uses `success`; Loading/Playing Stop uses `destructive`; Favorite/Previous/Next/Settings/Minimize use the approved glow treatment; Background uses `attention`.
- Minimized mode contains identity/status, Play/Stop, and Expand only. The same breakpoint-sized record shifts down so its upper arc remains visible.
- Short phone landscape uses a smaller complete record and a shorter horizontal expanded composition; the toolbar never scrolls.
- Preserve top/bottom placement, safe areas, shell reservation, Chimer offsets, interruption-notice anchoring, increased text, and existing visualizer routing.
- Publish `{ duration: Infinity, position: 0, playbackRate: 1 }` as the preferred position state. A rejection falls back to clearing position state without affecting playback.
- Keep all five Media Session actions: `play`, `pause`, `stop`, `previoustrack`, and `nexttrack`. Do not claim that One UI must expose all five visibly.
- A first visible Play control must accept one touch, mouse, or keyboard activation. Stop during Loading remains authoritative over all late completion.
- New tests must assert behavior, rendered semantics, geometry, or response bytes. Avoid new source-regex tests as primary evidence.
- Every implementation task follows RED, minimal GREEN, focused regression, `git diff --check`, scoped self-review, independent review, and a scoped commit.
- Physical Samsung acceptance is required before canonical project docs claim completion. Playwright WebKit is compatibility smoke, not Apple device certification.
- Never merge PR #183.

---

## File and Interface Map

### Canonical artwork module

Create `lib/atmosphere/station-artwork.ts` as the only geometry/model serializer:

```ts
export type AtmosphereStationArtworkInput = {
  description: string
  groupId: string
  stationId: string
  title: string
}

export type ArtworkPalette = {
  background: string
  foreground: string
  accent: string
  muted: string
  line: string
}

export type ArtworkMotif =
  | "honeycomb"
  | "moon-waves"
  | "rings"
  | "seed-lines"
  | "spiral"
  | "sunrise"

export function getAtmosphereStationArtworkModel(
  input: AtmosphereStationArtworkInput,
): { motif: ArtworkMotif; palette: ArtworkPalette; seed: number }

export function renderAtmosphereStationArtworkSvg(
  input: AtmosphereStationArtworkInput,
): string

export function getAtmosphereStationArtworkUrl(stationId: string): string
```

`renderAtmosphereStationArtworkSvg` serializes the current 240 by 240 SVG, including gradient, clip, border, and all six seeded motifs. Escape all text/identifier input before including it in XML. `getAtmosphereStationArtworkUrl` returns:

```ts
`/api/atmosphere/stations/${encodeURIComponent(stationId)}/artwork`
```

### Artwork component

Keep `components/atmosphere/station-artwork.tsx` as the accessible page boundary:

```ts
type AtmosphereStationArtworkProps = AtmosphereStationArtworkInput & {
  className?: string
}

export function AtmosphereStationArtwork(props: AtmosphereStationArtworkProps): React.ReactNode
```

It renders the canonical route as an unoptimized same-origin image with `${title} station artwork` alt text. It no longer owns geometry. If that image request fails, the component replaces the broken image with a neutral, labeled MassageLab artwork fallback; the fallback is visual-only and must not block station playback.

### Artwork route

`app/api/atmosphere/stations/[stationId]/artwork/route.tsx` stays Node-runtime and returns:

```ts
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
return new Response(png, {
  headers: {
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Type": "image/png",
  },
})
```

Add `sharp: "0.35.3"` as a direct exact dependency even though Next currently supplies it transitively.

### Media Session position

Keep `createAtmosphereMediaSessionController` public API unchanged. Internally add:

```js
function publishLivePositionState() {
  if (!mediaSession || typeof mediaSession.setPositionState !== "function") return
  try {
    mediaSession.setPositionState({
      duration: Number.POSITIVE_INFINITY,
      playbackRate: 1,
      position: 0,
    })
  } catch {
    clearPositionState()
  }
}
```

`publish()` calls `publishLivePositionState()`. `clear()` continues to call the empty-state `clearPositionState()`.

### Decorative vinyl

After registry installation, `components/ui/music-player.tsx` exports only:

```ts
export type StationVinylProps = React.HTMLAttributes<HTMLDivElement> & {
  artworkSrc: string
  playing: boolean
}

export function StationVinyl({
  artworkSrc,
  playing,
  className,
  ...props
}: StationVinylProps): React.ReactNode
```

The root uses `aria-hidden="true"`, `data-playing={playing}`, and `pointer-events-none`. The record disc renders the canonical artwork through an unoptimized decorative image child and retains Componentry-inspired grooves, glare, center label, and pin. CSS owns rotation and reduced motion.

### Player control groups

Refactor `MusicMiniPlayer` into these internal render groups without creating another state owner:

```tsx
<div data-testid="music-player-toolbar-left">{settingsAction}</div>
<div data-testid="music-player-toolbar-primary-controls">
  {favoriteAction}
  {previousAction}
  {playStopAction}
  {nextAction}
  {visualizerAction}
</div>
<div data-testid="music-player-toolbar-right">
  {volumeControl}
  {collapseAction}
</div>
```

Collapsed mode renders only identity, `playStopAction`, and `expandAction`.

---

### Task 1: Make station artwork canonical and byte-stable

**Files:**

- Create: `lib/atmosphere/station-artwork.ts`
- Create: `tests/atmosphere-station-artwork.test.mjs`
- Modify: `components/atmosphere/station-artwork.tsx`
- Modify: `app/api/atmosphere/stations/[stationId]/artwork/route.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/browser/music-media-session.spec.ts`

**Interfaces:**

- Produces: `getAtmosphereStationArtworkModel`, `renderAtmosphereStationArtworkSvg`, and `getAtmosphereStationArtworkUrl` with the signatures in the interface map.
- Consumers: the carousel component, artwork API route, Task 4 vinyl player, and existing Media Session controller.

- [ ] **Step 1: Write failing pure artwork tests**

Create direct behavioral tests that import `lib/atmosphere/station-artwork.ts` and assert:

```js
const proof = stationInput("mlab-proof-drone")
const first = renderAtmosphereStationArtworkSvg(proof)
const second = renderAtmosphereStationArtworkSvg(proof)

assert.equal(first, second)
assert.match(first, /^<svg[^>]+viewBox="0 0 240 240"/)
assert.match(first, /<circle/)
assert.equal(
  getAtmosphereStationArtworkUrl("proof/drone"),
  "/api/atmosphere/stations/proof%2Fdrone/artwork",
)
```

Iterate every station from `getVisibleAtmosphereStations()` with its real group and assert nonempty deterministic SVG. Include same-motif/same-palette pairs such as Proof Drone/Documentary Films and Trees/Impact and assert that their seed-derived geometry differs. The browser PNG test in Step 7, rather than hidden XML differences alone, is the authoritative all-station uniqueness check.

- [ ] **Step 2: Run the pure tests and capture RED**

Run:

```powershell
node --test tests/atmosphere-station-artwork.test.mjs
```

Expected: fail because `lib/atmosphere/station-artwork.ts` does not exist.

- [ ] **Step 3: Extract the model and serialize the exact current SVG**

Move palettes, hashing, motif choice, seeded geometry, color shading, and helper math from `components/atmosphere/station-artwork.tsx` into the new module. The string serializer must emit the same shapes and geometry currently produced by:

- `HoneycombMotif`
- `MoonWavesMotif`
- `RingsMotif`
- `SeedLinesMotif`
- `SpiralMotif`
- `SunriseMotif`

Use a focused XML helper:

```ts
function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character)
}
```

Keep stable element order and fixed decimal formatting so byte hashes remain stable.

- [ ] **Step 4: Make the page component consume the canonical URL**

Replace inline motif ownership with the route-backed image. Track the failed URL, reset that state when the station URL changes, and render a neutral labeled fallback instead of a broken image when the canonical request fails:

```tsx
<Image
  unoptimized
  alt={`${title} station artwork`}
  className={cn("h-full w-full rounded-[9px] object-cover", className)}
  height={512}
  src={getAtmosphereStationArtworkUrl(stationId)}
  width={512}
/>
```

Retain the existing prop shape so carousel callers do not need unrelated rewrites. Add a rendered browser case that aborts the artwork request, verifies the fallback remains visible and labeled, then activates Play once and verifies playback still reaches Loading/Playing.

- [ ] **Step 5: Add Sharp as a declared dependency**

Run:

```powershell
npm install sharp@0.35.3 --save-exact
```

Expected: `package.json` and `package-lock.json` declare the exact direct dependency; no unrelated package upgrades.

- [ ] **Step 6: Replace the approximate route renderer**

Remove `renderRasterMotif`. Resolve the real station and group as today, call `renderAtmosphereStationArtworkSvg`, convert it with Sharp, and return PNG/cache headers. Keep the existing bounded 404 response.

- [ ] **Step 7: Make pure tests GREEN**

Run:

```powershell
node --test tests/atmosphere-station-artwork.test.mjs
npm run typecheck
```

Expected: all artwork tests pass and TypeScript accepts the shared interfaces.

- [ ] **Step 8: Add failing route/browser identity assertions**

Extend `music-media-session.spec.ts` to request every visible station artwork path against a fresh production build and assert:

```ts
expect(response.status()).toBe(200)
expect(response.headers()["content-type"]).toContain("image/png")
expect(response.headers()["cache-control"]).toContain("max-age=86400")
```

Hash response bodies, assert all known stations are unique, and repeat two representative requests to prove byte stability. In the rendered Music route, assert the centered card image `src` equals the URL placed in `MediaMetadata.artwork[0].src` after Play.

Expected RED before rebuilding: the old production artifact or inline SVG does not satisfy the canonical image-src assertion.

- [ ] **Step 9: Build and run route/browser GREEN**

Run:

```powershell
npm run build
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "canonical station artwork"
```

Expected: valid, distinct, stable PNGs and exact card/metadata URL identity.

- [ ] **Step 10: Review and commit Task 1**

Run `git diff --check`, inspect only the files listed for Task 1, and commit:

```powershell
git add package.json package-lock.json lib/atmosphere/station-artwork.ts components/atmosphere/station-artwork.tsx 'app/api/atmosphere/stations/[stationId]/artwork/route.tsx' tests/atmosphere-station-artwork.test.mjs tests/browser/music-media-session.spec.ts
git commit -m "fix: unify atmosphere station artwork"
```

---

### Task 2: Publish Atmosphere as indefinite Live media

**Files:**

- Modify: `lib/atmosphere/media-session-controller.js`
- Modify: `tests/atmosphere-media-session-controller.test.mjs`
- Modify: `tests/browser/music-media-session.spec.ts`

**Interfaces:**

- Consumes: existing `createAtmosphereMediaSessionController({ mediaSession, createMetadata })`.
- Produces: no public API change; `publish()` attempts an infinite position state and `clear()` removes it.

- [ ] **Step 1: Add failing controller tests**

Record every `setPositionState` argument and assert:

```js
controller.publish(publication)
assert.deepEqual(positionCalls[0], {
  duration: Number.POSITIVE_INFINITY,
  playbackRate: 1,
  position: 0,
})

controller.clear()
assert.equal(positionCalls.at(-1), undefined)
```

Add a fake that throws on the infinite dictionary but accepts the no-argument clear. Assert `publish()` does not throw, the clear fallback occurs, metadata remains assigned, and all five handlers remain installed.

- [ ] **Step 2: Run controller RED**

Run:

```powershell
node --test tests/atmosphere-media-session-controller.test.mjs
```

Expected: fail because current `publish()` only clears position state.

- [ ] **Step 3: Implement guarded Live publication**

Add `publishLivePositionState()` exactly as defined in the interface map. Call it from `publish()` after playback state and before handlers. Keep `clearPositionState()` for `clear()` and rejection fallback.

- [ ] **Step 4: Run controller GREEN**

Run:

```powershell
node --test tests/atmosphere-media-session-controller.test.mjs tests/atmosphere-media-playback-carrier.test.mjs
```

Expected: all controller and carrier tests pass.

- [ ] **Step 5: Extend the rendered Media Session probe**

In `music-media-session.spec.ts`, make the fake capture a boolean rather than JSON-serialize Infinity:

```ts
probe.livePositionPublished = state?.duration === Number.POSITIVE_INFINITY
  && state.position === 0
  && state.playbackRate === 1
```

Assert true while Loading/Playing, assert a clear call after Stop, and add a rejection case proving the generator still reaches Playing with metadata and handlers intact.

- [ ] **Step 6: Run browser GREEN and commit**

Run:

```powershell
npm run build
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "Live position|position rejection"
npm run typecheck
git diff --check
```

Commit only the three Task 2 files:

```powershell
git add lib/atmosphere/media-session-controller.js tests/atmosphere-media-session-controller.test.mjs tests/browser/music-media-session.spec.ts
git commit -m "fix: publish atmosphere as live media"
```

---

### Task 3: Make the first visible station Play activation authoritative

**Files:**

- Modify: `components/atmosphere/station-carousel-card.tsx`
- Modify: `app/globals.css`
- Modify: `tests/browser/public-routes.spec.ts`
- Modify: `tests/browser/music-media-session.spec.ts`

**Interfaces:**

- Consumes: the existing `data-carousel-ready="true"` state emitted by `AdaptiveCarouselStage` after Embla initializes.
- Preserves: existing `prewarmStation` and `music.playStation` provider contracts without adding another readiness state owner.

- [ ] **Step 1: Add a pre-hydration single-activation RED test**

In a JavaScript-disabled browser context, navigate to `/music` and assert that the server-rendered station carousel does not expose visually actionable Play or Favorite controls before hydration can ever attach handlers. In a normal mobile Chromium context, wait for `data-carousel-ready="true"`, locate the first visible enabled Play control, issue exactly one touch activation, and record whether the toolbar reaches Loading/Playing. Also record carrier play-call count and state history. The normal-context assertion is:

```ts
await expect.poll(() => readCarrierProbe(page).playCalls).toBe(1)
await expect(toolbar).toHaveAttribute("data-playback-state", /loading|playing/)
expect(history).not.toContain("stopped-after-accepted-play")
```

Expected RED: current CSS leaves the server-rendered action visibly actionable before readiness, even though no client handler can accept it.

- [ ] **Step 2: Add one-activation ready-state coverage**

After the control becomes visible and enabled, run exactly one `tap()`, one mouse `click()`, and one keyboard Enter activation in separate fresh-page cases. Each must produce one accepted carrier call and no duplicate generator start.

- [ ] **Step 3: Run the focused RED command**

Run:

```powershell
npm run test:browser -- tests/browser/public-routes.spec.ts tests/browser/music-media-session.spec.ts --project=mobile-chromium --grep "first station Play activation"
```

Expected: at least the pre-hydration case fails on current behavior; retain its state/probe evidence in the task report.

- [ ] **Step 4: Gate actionable controls with the existing carousel readiness contract**

Hide and disable pointer interaction for Play/Favorite while the enclosing carousel region reports `data-carousel-ready="false"`. Scope the rule to the station carousel so Background controls and other carousel consumers are unchanged:

```css
[aria-label="Station carousel"][data-carousel-ready="false"]
  [data-carousel-primary-action],
[aria-label="Station carousel"][data-carousel-ready="false"]
  [data-carousel-favorite-action] {
  visibility: hidden;
  pointer-events: none;
}
```

Do not add a second React hydration flag. Once the existing region changes to `true`, the first visible actionable Play control necessarily has an attached client handler.

- [ ] **Step 5: Remove redundant touch-time prewarm replacement**

Remove the primary Play button's `onPointerDown={() => prewarmStation(station.id)}`. Center changes and focus already prewarm. Keep the click handler as the only playback command and keep `onFocus` prewarm for keyboard users.

- [ ] **Step 6: Run focused GREEN**

Run the command from Step 3 again. Assert one activation, one carrier claim, Loading/Playing transition, Stop availability, and no duplicate start across touch, mouse, and keyboard.

- [ ] **Step 7: Run carousel regressions and commit**

Run:

```powershell
node --test tests/carousel-lab-source.test.mjs
npm run test:browser -- tests/browser/public-routes.spec.ts --project=mobile-chromium --grep "center station|first station Play activation"
npm run typecheck
git diff --check
```

Commit:

```powershell
git add app/globals.css components/atmosphere/station-carousel-card.tsx tests/browser/public-routes.spec.ts tests/browser/music-media-session.spec.ts
git commit -m "fix: accept the first station play action"
```

---

### Task 4: Add the visual-only vinyl and approved control semantics

**Files:**

- Create via registry, then rewrite: `components/ui/music-player.tsx`
- Create: `docs/licenses/componentry-mit.txt`
- Modify: `components/providers/music-mini-player.tsx`
- Modify: `tests/browser/app-shell.spec.ts`
- Modify: `tests/browser/music-media-session.spec.ts`

**Interfaces:**

- Consumes: `getAtmosphereStationArtworkUrl`, `music.activeStationId`, `music.playbackState`, `music.favorites`, and existing player actions.
- Produces: `StationVinyl({ artworkSrc, playing, className, ...props })` and the three player control-group test IDs in the interface map.

- [ ] **Step 1: Add failing rendered semantics tests**

Against an active station, assert the expanded toolbar contains:

```ts
await expect(toolbar.getByTestId("station-vinyl")).toHaveAttribute(
  "data-artwork-src",
  /\/api\/atmosphere\/stations\/mlab-proof-drone\/artwork$/,
)

const actionLabels = await primary
  .locator('button[aria-label], a[aria-label]')
  .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")))

expect(actionLabels).toEqual([
  `Favorite ${stationTitle}`,
  "Previous station",
  "Stop",
  "Next station",
  "Background",
])
```

Use accessible names rather than visible icon text for the final order assertion. Assert Settings is in the left group, Volume and Minimize are in the right group, and the vinyl is not focusable or clickable.

Assert semantic classes/variants through rendered behavior and stable component classes:

- Play has success styling.
- Loading/Playing Stop has destructive styling.
- Previous/Next/Settings/Minimize have glow styling.
- Background has attention styling.
- Favorite reuses the carousel heart component, `aria-pressed`, and purple selected class.

Expected RED: vinyl and favorite player action do not exist, action order is six unrelated success buttons, and semantic variants are wrong.

- [ ] **Step 2: Run rendered RED**

Run:

```powershell
npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "vinyl player controls"
```

- [ ] **Step 3: Install the requested registry component**

Run exactly:

```powershell
npx shadcn@latest add @componentry/music-player
```

Inspect the diff immediately. The expected functional addition is `components/ui/music-player.tsx`. Do not accept unrelated theme, package, or existing component rewrites.

- [ ] **Step 4: Preserve the MIT notice**

Create `docs/licenses/componentry-mit.txt` with the complete upstream MIT text and copyright line:

```text
MIT License

Copyright (c) 2026 Harsh Jadhav
```

Include the complete permission, condition, warranty, and liability paragraphs from the reviewed upstream LICENSE. Add a component doc comment naming the source URL, license file, and adaptation boundary.

- [ ] **Step 5: Reduce the registry output to `StationVinyl`**

Delete the generated audio, iframe, YouTube parsing, local state, effect, click target, and tonearm. Remove the `framer-motion` import. Render only:

```tsx
<div
  {...props}
  aria-hidden="true"
  className={cn("ml-station-vinyl pointer-events-none", className)}
  data-artwork-src={artworkSrc}
  data-playing={playing}
  data-testid="station-vinyl"
>
  <div className="ml-station-vinyl-disc">
    <Image
      unoptimized
      alt=""
      className="ml-station-vinyl-artwork"
      draggable={false}
      fill
      sizes="8rem"
      src={artworkSrc}
    />
    <span className="ml-station-vinyl-grooves" />
    <span className="ml-station-vinyl-glare" />
    <span className="ml-station-vinyl-label"><span /></span>
  </div>
</div>
```

The final DOM must remain decorative and pointer-inert. It must not create an additional artwork URL, playback owner, or focus target.

- [ ] **Step 6: Rebuild the expanded player markup**

Compute:

```tsx
const activeArtworkSrc = music.activeStationId
  ? getAtmosphereStationArtworkUrl(music.activeStationId)
  : null
const isVinylPlaying = music.playbackState === "playing"
const isFavorite = music.activeStationId
  ? music.favorites.includes(music.activeStationId)
  : false
```

Add `StationVinyl` behind foreground content. Add Favorite before Previous. Apply exact button variants and test IDs from the interface map. Keep Loading as Stop. Keep the existing settings menu, interruption preference, visualizer link behavior, and dirty-draft navigation marker.

- [ ] **Step 7: Keep collapsed semantics minimal**

Collapsed markup must render only identity/status, Play/Stop, and Expand. It may render the decorative vinyl but no hidden duplicate Settings/Favorite/Previous/Next/Background/Volume controls.

- [ ] **Step 8: Run semantic GREEN**

Run:

```powershell
npm run typecheck
npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/music-media-session.spec.ts --project=desktop-chromium --grep "vinyl player controls"
```

Expected: exact order, variants, Favorite behavior, canonical artwork URL, and no second media owner.

- [ ] **Step 9: Commit Task 4**

Run `git diff --check`, verify `npm ls framer-motion --depth=0` remains empty, and commit:

```powershell
git add components/ui/music-player.tsx docs/licenses/componentry-mit.txt components/providers/music-mini-player.tsx tests/browser/app-shell.spec.ts tests/browser/music-media-session.spec.ts
git commit -m "feat: add atmosphere vinyl player surface"
```

---

### Task 5: Implement responsive vinyl geometry and motion

**Files:**

- Modify: `app/globals.css`
- Modify: `components/providers/music-mini-player.tsx`
- Modify: `components/ui/music-player.tsx`
- Modify: `tests/browser/app-shell.spec.ts`
- Modify: `tests/browser/music-media-session.spec.ts`

**Interfaces:**

- Consumes: Task 4 `StationVinyl` and player group test IDs.
- Produces: CSS data-state behavior for expanded, collapsed, Playing, and reduced-motion presentations.

- [ ] **Step 1: Add failing expanded geometry tests**

For desktop and phone portrait, measure:

- vinyl fully inside toolbar bounds;
- vinyl left edge aligned with the content/safe-area boundary;
- identity and controls inside toolbar bounds;
- no surface, grid, or document horizontal/vertical overflow;
- primary Play/Stop center within tolerance of toolbar center;
- Settings left of the primary group;
- Volume and Minimize right of the primary group, with Minimize farthest right;
- shell reservation equals actual toolbar root height.

Use DOM rectangles and `scrollHeight <= clientHeight`, not screenshot-only evidence.

- [ ] **Step 2: Add failing minimized geometry tests**

Capture the expanded vinyl diameter, minimize the bar, and assert:

```ts
expect(collapsedVinyl.width).toBeCloseTo(expandedVinyl.width, 0)
expect(collapsedVinyl.top).toBeGreaterThan(expandedVinyl.top)
expect(collapsedVinyl.top).toBeLessThan(toolbar.bottom)
```

Assert only the upper arc intersects the collapsed toolbar, identity remains legible, only Play/Stop and Expand are actionable, and reservation equals the compact root height.

- [ ] **Step 3: Add failing short-landscape and safe-area tests**

Use an 844 by 390 viewport and explicit 24px top/bottom safe inset probes. Assert the smaller vinyl is complete, controls do not scroll, app content retains positive usable height, interruption notice sits exactly 8px beyond the actual toolbar edge, and Chimer offsets follow the final root height once.

- [ ] **Step 4: Add failing motion-state tests**

Normal motion:

```ts
await expect(vinyl).toHaveAttribute("data-playing", "true")
expect(await vinyl.locator(".ml-station-vinyl-disc").evaluate(
  (node) => getComputedStyle(node).animationPlayState,
)).toBe("running")
```

After Pause, Interruption, Stop, Loading, or failure, assert `paused`. Capture transform before/after a short wait to prove Playing advances and Paused does not. Under reduced motion, assert `animationName === "none"` or transform remains unchanged while Playing.

- [ ] **Step 5: Run geometry/motion RED**

Run:

```powershell
npm run test:browser -- tests/browser/app-shell.spec.ts tests/browser/music-media-session.spec.ts --project=mobile-chromium --grep "vinyl geometry|vinyl motion"
```

Expected: fail because Task 4 has semantic structure but not final layout/motion contracts.

- [ ] **Step 6: Implement bounded expanded and collapsed CSS**

Use toolbar-scoped custom properties:

```css
.ml-music-player-toolbar {
  --ml-station-vinyl-size: 8rem;
  --ml-music-player-expanded-content-height: 10rem;
}

.ml-station-vinyl-disc {
  animation: ml-station-vinyl-spin 4s linear infinite;
  animation-play-state: paused;
}

.ml-station-vinyl[data-playing="true"] .ml-station-vinyl-disc {
  animation-play-state: running;
}

@media (prefers-reduced-motion: reduce) {
  .ml-station-vinyl-disc {
    animation: none;
  }
}
```

Use a left-aligned absolute vinyl layer, foreground overlay, and a three-column action grid whose center column owns the five primary buttons. Expanded mode shows the complete record. Collapsed mode keeps `--ml-station-vinyl-size` and translates the record downward without changing its diameter.

- [ ] **Step 7: Implement short-landscape exception**

Within the existing short-landscape range, set a smaller vinyl size and shorter expanded content height. Keep the same complete action set and preserve top/bottom safe-area formulas. Do not hide controls or add toolbar scrolling.

- [ ] **Step 8: Run geometry/motion GREEN**

Run the Step 5 command for both `mobile-chromium` and `desktop-chromium`. Then run the existing focused top/bottom/loading/increased-text app-shell cases.

- [ ] **Step 9: Commit Task 5**

Run typecheck and diff check, then commit only the five Task 5 files:

```powershell
git add app/globals.css components/providers/music-mini-player.tsx components/ui/music-player.tsx tests/browser/app-shell.spec.ts tests/browser/music-media-session.spec.ts
git commit -m "fix: preserve vinyl player responsive geometry"
```

---

### Task 6: Run integration regressions and close automated gaps

**Files:**

- Modify only if a demonstrated regression needs a focused correction: files already owned by Tasks 1-5
- Modify: `tests/browser/public-routes.spec.ts`
- Modify: `tests/browser/app-shell.spec.ts`
- Modify: `tests/browser/music-media-session.spec.ts`
- Create: `.superpowers/sdd/2026-08-15-atmosphere-artwork-vinyl-player/task-6-report.md` (ignored evidence)

**Interfaces:**

- Consumes: all Task 1-5 public interfaces and test IDs.
- Produces: an exact-head automated acceptance report; no new product API.

- [ ] **Step 1: Run focused Node suites**

Run separately:

```powershell
node --test tests/atmosphere-station-artwork.test.mjs tests/atmosphere-media-session-controller.test.mjs tests/atmosphere-media-playback-carrier.test.mjs tests/atmosphere-playback-lifecycle.test.mjs tests/atmosphere-runtime-controller.test.mjs tests/generative-fm-piece-loader.test.mjs
```

No failing result may be waived as unrelated without a focused reproduction and written classification.

- [ ] **Step 2: Run focused desktop browser matrix**

Run:

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=desktop-chromium --workers=1
```

Use one worker to avoid the previously observed local Next server contention during long Moment startup cases.

- [ ] **Step 3: Run focused mobile browser matrix**

Run:

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts tests/browser/app-shell.spec.ts tests/browser/public-routes.spec.ts --project=mobile-chromium --workers=1
```

- [ ] **Step 4: Run scoped WebKit media smoke**

Run:

```powershell
npm run test:browser -- tests/browser/music-media-session.spec.ts --project=webkit-media-smoke --workers=1
```

Keep existing bounded Web Audio fakes and Apple-certification disclaimer.

- [ ] **Step 5: Run repository gates separately**

Run:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
git status --short
```

Expected final status before Task 7: clean tracked tree plus only the intentional untracked Android QA report.

- [ ] **Step 6: Correct only reproduced integration defects**

For any failure, add or tighten the smallest reproducing test first, confirm RED, apply the minimal owned-file correction, and rerun the failed focused command plus the affected matrix. Do not perform unrelated cleanup.

- [ ] **Step 7: Write the exact-head automated report**

Record branch, HEAD, changed-file scope, admin overlap audit, exact commands/counts, environment-only retries, known physical gate, and remaining user action in the ignored task report.

- [ ] **Step 8: Commit test-only hardening if required**

If Step 6 changed tracked tests or code, commit only those demonstrated corrections with a focused message. If no tracked changes remain, do not create an empty verification commit.

---

### Task 7: Complete physical Android acceptance, canonical docs, and PR loop

**Files:**

- Modify: `docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md`
- Modify after physical truth is complete: `docs/wiki/atmosphere-audio.md`
- Modify after physical truth is complete: `docs/project-state.md`
- Modify after physical truth is complete: `docs/project-log.md`
- Create: `.superpowers/sdd/2026-08-15-atmosphere-artwork-vinyl-player/task-7-report.md` (ignored evidence)

**Interfaces:**

- Consumes: exact automated-green branch head and draft PR #183.
- Produces: physical Android evidence, canonical documentation, and a reviewed ready PR; no product API.

- [ ] **Step 1: Recheck admin overlap before documentation edits**

Read status and `origin/main...HEAD` changed files for the active admin worktrees. If `docs/project-state.md`, `docs/project-log.md`, or `docs/wiki/atmosphere-audio.md` newly overlaps, warn the user and coordinate before editing.

- [ ] **Step 2: Push the automated-green head and wait for Vercel**

Push the branch without force. Verify PR #183 head equals the local SHA and wait for Vercel, CodeQL, and GitHub QA checks. Keep the PR in draft during physical testing.

- [ ] **Step 3: Verify the protected preview through authenticated tooling**

Use Vercel's authenticated protected-deployment request path. Verify `/music` returns 200 and two artwork endpoints return `image/png` with distinct hashes. Do not mistake a Vercel login HTML response for app success.

- [ ] **Step 4: Run the Samsung acceptance matrix**

On Samsung S24 Ultra SM-S928U1, One UI 8.5, Android 16, Chrome 151.0.7922.137, record:

1. matching carousel/player/notification/lock-screen artwork;
2. Previous and Next title/artwork pairing;
3. Live presentation instead of a ten-second timeline;
4. one-activation carousel Play;
5. expanded player control order, colors, Favorite, Background, Settings, Volume, and Minimize;
6. minimized vinyl arc, Play/Stop, and Expand;
7. portrait and landscape toolbar fit;
8. reduced-motion stationary vinyl;
9. notification Pause/Play/Previous/Next/interruption/dismissal behavior;
10. exact OS-visible controls, including whether Stop remains omitted.

- [ ] **Step 5: Honor the timeline decision gate**

If One UI shows Live or no finite scrubber, mark the row Pass. If it still shows ten seconds, mark it Failed/Observed, stop product expansion, and create a separate brainstorming spec for a MediaStream carrier. Do not implement that fallback under this plan.

- [ ] **Step 6: Update the QA report with exact observations**

Replace Pending rows only with user-observed Pass, Fail, Not exposed, or Not run. Preserve device/browser/build fields and distinguish OS behavior from provider/generator behavior.

- [ ] **Step 7: Update canonical docs truthfully**

Only after physical results are known:

- update `docs/wiki/atmosphere-audio.md` with artwork ownership, Live position behavior, player controls, reduced motion, and platform limitations;
- update `docs/project-state.md` with current branch/PR/physical status;
- append `docs/project-log.md` with the chronological implementation and acceptance evidence.

Do not claim Apple physical certification or a visible Android Stop button when not observed.

- [ ] **Step 8: Run the final documentation-aware gate**

Run lint, typecheck, full Node tests, build, the three browser projects affected by final edits, diff check, and exact status. Confirm no admin overlap appeared during documentation work.

- [ ] **Step 9: Commit and push physical/canonical evidence**

Stage only the QA report and approved canonical docs:

```powershell
git add docs/superpowers/qa/2026-08-14-android-media-notifications-audio-interruptions.md docs/wiki/atmosphere-audio.md docs/project-state.md docs/project-log.md
git commit -m "docs: record atmosphere media acceptance"
git push origin codex/media-notifications-audio-interruptions
```

- [ ] **Step 10: Complete the hosted review loop without merging**

Mark PR #183 ready only after every required physical row and hosted check is truthful. Trigger a substantive CodeRabbit review on the exact pushed head, verify every finding against current code, fix only valid issues with focused RED/GREEN evidence, reply in the original threads, resolve addressed threads, and repeat through any cooldown until:

- the latest pushed head has a completed substantive CodeRabbit review;
- all required GitHub checks pass;
- unresolved review threads are empty.

Never merge the PR.

- [ ] **Step 11: Write the final task report**

Record the final exact HEAD, PR URL, physical matrix, automated commands/counts, CodeRabbit review identity, resolved/declined findings, admin overlap result, Apple limitation, and explicit no-merge state.
