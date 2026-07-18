# Clock, Chimer, and Music Visualizer Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Stop at each commit boundary for review when the user requests staged execution.

**Goal:** Replace the shared Clock/Chimer Settings overlay with persistent Clock, Visual, and Background panels; add a resource-conscious Music visualizer that reuses `/clock`; and add optional display rotation and forward glow without disrupting audio, timer, entitlement, or account-preference behavior.

**Architecture:** Keep `ChimerPage` as the state owner and `RunningTimer` as the one immersive renderer. Introduce DOM-independent visualizer preference/routing helpers, extend Atmosphere storage to v2, add visualizer state/actions to `MusicProvider`, and pass one compact mode contract into a reusable immersive panel shell. Clock and Visual are measured nonmodal docks; Background is the only modal full-screen layer. No Prisma migration is needed because account visualizer settings use the existing merged `appSettings` JSON.

**Tech Stack:** Next.js App Router, React 19, TypeScript/JavaScript with JSDoc, CSS Modules, Radix-backed shared controls/dialog primitives, Screen Wake Lock API, Node test runner, Playwright.

**Approved design:** `docs/superpowers/specs/2026-07-18-clock-chimer-music-visualizer-design.md`

**Branch and scope guardrails:**

- Implement on a new feature branch created from refreshed `main`; suggested name: `codex/clock-music-visualizer`.
- Preserve the pre-existing user edit in `TODO.md` and do not include it in any commit.
- Do not choose or replace a carousel in this track; Track 3 owns that decision.
- Do not add premium purchase/credit behavior, DNA, Twisted Cubes, or shuffle colors.
- Keep the current feature-key/background-eligibility checks authoritative; never infer access from a displayed plan name.
- Do not add a second visualizer renderer or a selectable `/music` page background.

---

## Task 1: Add pure visualizer preference and routing contracts

**Files:**

- Create: `lib/music-visualizer.js`
- Create: `tests/music-visualizer.test.mjs`

### Step 1: Write failing tests for defaults and sanitization

Cover:

- device defaults are `{ backgroundId: null, showClock: false }`;
- account defaults are `{ defaultBackgroundId: null, showClock: false }`;
- blank/non-string background IDs become `null`;
- only literal booleans are accepted for `showClock`;
- unknown fields are dropped.

Use this public contract:

```js
export const MUSIC_VISUALIZER_APP_SETTINGS_KEY = "musicVisualizer";
export const DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES = Object.freeze({
  backgroundId: null,
  showClock: false,
});
export const DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES = Object.freeze({
  defaultBackgroundId: null,
  showClock: false,
});

export function normalizeMusicVisualizerDevicePreferences(value) {}
export function normalizeMusicVisualizerAccountPreferences(value) {}
```

Run:

```powershell
node --test tests/music-visualizer.test.mjs
```

Expected: FAIL because `lib/music-visualizer.js` does not exist.

### Step 2: Write failing tests for selection resolution

The resolver receives an eligibility callback instead of importing React or account state:

```js
resolveMusicVisualizerBackground({
  deviceBackgroundId,
  accountDefaultBackgroundId,
  canUseBackground,
});
```

Assert this precedence and result shape:

```js
{ backgroundId: "device-id", source: "device", unavailableSavedId: null }
{ backgroundId: "default-id", source: "account", unavailableSavedId: null }
{ backgroundId: null, source: "none", unavailableSavedId: "locked-id" }
```

An unusable device choice may fall through to a usable account default, but neither saved value is deleted. If no saved value is usable, preserve the first unavailable ID for picker messaging.

### Step 3: Write failing tests for safe return paths and URL construction

Add tests for:

- accepting `/music`, `/wellness?tab=quick-log`, and other single-slash internal paths;
- rejecting `https://example.com`, `//example.com`, backslash variants, empty input, and `/clock?source=music` recursion;
- falling back to `/music`;
- emitting `/clock?source=music&returnTo=...` when a background is usable;
- adding `panel=background` only when selection is required;
- encoding the origin pathname plus search string once.

Public helpers:

```js
export function sanitizeMusicVisualizerReturnTo(value) {}

export function buildMusicVisualizerHref({
  returnTo,
  openBackgroundPanel = false,
}) {}
```

### Step 4: Implement the pure helpers with focused JSDoc

Keep the module DOM-independent. Validate route values through `URLSearchParams`, not string concatenation. Reject a return target when parsing its query reveals `source=music` on `/clock`.

### Step 5: Run the focused tests

```powershell
node --test tests/music-visualizer.test.mjs
```

Expected: PASS.

### Step 6: Commit

```powershell
git add lib/music-visualizer.js tests/music-visualizer.test.mjs
git commit -m "test: define music visualizer preferences"
```

---

## Task 2: Migrate Atmosphere storage without losing device state

**Files:**

- Modify: `lib/atmosphere/storage.js`
- Modify: `tests/atmosphere-storage.test.mjs`
- Modify: `lib/background-options.js`
- Modify: `tests/background-options.test.mjs`

### Step 1: Add failing v2 migration tests

Add the nested v2 field:

```js
visualizer: {
  backgroundId: null,
  showClock: false,
}
```

Test all of these inputs:

- fresh state;
- valid v2 state;
- v1 state preserving favorites, recent stations, clamped volume, and mini-player collapse;
- v1 state plus legacy `massagelab.music.background` becoming `visualizer.backgroundId`;
- malformed JSON;
- a future unknown version returning an explicit `unsupported-version` result while preserving the original raw value;
- serialize/parse round trip.

### Step 2: Define explicit old/new keys

Use:

```js
export const ATMOSPHERE_STORAGE_KEY = "massagelab-atmosphere-v2";
export const LEGACY_ATMOSPHERE_STORAGE_KEY = "massagelab-atmosphere-v1";
export const ATMOSPHERE_STORAGE_VERSION = 2;
```

Update `parseAtmosphereStorage` to accept migration inputs:

```js
parseAtmosphereStorage(
  currentRawValue,
  ({ legacyRawValue = null, legacyBackgroundId = null } = {}),
);
```

Return a discriminated parse result: `{ status: "ready", state, shouldPersist }` or `{ status: "unsupported-version", rawVersion, rawValue }`. A future version is never normalized, serialized, or overwritten by v2 code; the provider keeps usable in-memory defaults and exposes the unsupported status until newer code can read it.

Precedence is an explicit current v2 `visualizer.backgroundId` value (including `null`), then v1 audio state, with `legacyBackgroundId` used only during the first migration when v2 has no visualizer field and `migrations.legacyMusicBackground` is not true. Every successful v2 write includes `migrations: { legacyMusicBackground: true }`. Restore/clear writes `backgroundId: null` with that marker, so the retained read-only legacy key can never resurrect a stale background.

### Step 3: Implement and document the migration

Reuse the normalizers from `lib/music-visualizer.js`. Serialization of supported state must always emit version 2, the one-shot migration marker, and no arbitrary fields. An `unsupported-version` result has no serialization path.

Keep `BACKGROUND_STORAGE_KEYS.music` only as a named legacy migration key. Rename it to `musicLegacy` if all call sites/tests are updated in the same commit, or add a deprecation comment if retaining the property avoids unnecessary churn. It must have no write path after Task 4.

### Step 4: Run focused tests

```powershell
node --test tests/atmosphere-storage.test.mjs tests/background-options.test.mjs
```

Expected: PASS.

### Step 5: Commit

```powershell
git add lib/atmosphere/storage.js lib/background-options.js tests/atmosphere-storage.test.mjs tests/background-options.test.mjs
git commit -m "feat: migrate visualizer device preferences"
```

---

## Task 3: Extend Chimer settings and shared display rules

**Files:**

- Modify: `lib/chimer-timer.js`
- Modify: `tests/chimer-timer.test.mjs`
- Create: `lib/immersive-display.js`
- Create: `tests/immersive-display.test.mjs`

### Step 1: Add failing Chimer-setting tests

Add sanitized settings with these defaults:

```js
showClockDisplay: true,
clockRotationEnabled: false,
clockForwardGlowEnabled: false,
```

Assert non-boolean input falls back to the defaults and that account/local sanitization preserves literal booleans. These are non-sensitive UI preferences and require no schema migration.

### Step 2: Add failing mode and wake-lock tests

Keep mode rules pure:

```js
export const IMMERSIVE_DISPLAY_CONTEXTS = Object.freeze({
  chimer: "chimer",
  clock: "clock",
  musicVisualizer: "musicVisualizer",
});

export function resolveImmersiveDisplayContext({ pathname, source }) {}

export function shouldRequestImmersiveWakeLock({
  context,
  timerStatus,
  keepScreenAwake,
}) {}
```

Assert:

- `/clock?source=music` resolves Music visualizer;
- ordinary `/clock` resolves Clock;
- active `/chimer` resolves Chimer;
- all three contexts request wake lock only when `keepScreenAwake === true` and the display is active;
- idle setup never requests it;
- ordinary Clock no longer bypasses the preference.

### Step 3: Implement the helpers and setting fields

Use focused JSDoc to explain that `context` controls UI semantics, while `timerStatus` remains authoritative for timer lifecycle. Do not import Next navigation into the helper.

### Step 4: Run focused tests

```powershell
node --test tests/chimer-timer.test.mjs tests/immersive-display.test.mjs
```

Expected: PASS.

### Step 5: Commit

```powershell
git add lib/chimer-timer.js lib/immersive-display.js tests/chimer-timer.test.mjs tests/immersive-display.test.mjs
git commit -m "feat: define immersive display settings"
```

---

## Task 4: Make Music provider state visualizer-aware and retain stopped stations

**Files:**

- Modify: `components/providers/music-provider.tsx`
- Modify: `lib/atmosphere/storage.js`
- Modify: `components/providers/music-mini-player.tsx`
- Modify: `app/browse/workspace.tsx`
- Modify: `tests/atmosphere-storage.test.mjs`
- Modify: `tests/account-preferences.test.mjs`
- Create: `tests/music-visualizer-provider.test.mjs`
- Modify: `tests/browser/public-routes.spec.ts`

### Step 1: Add failing source-contract tests for the provider

Lock the intended context surface before changing the large provider:

```ts
interface MusicVisualizerState {
  backgroundId: string | null;
  accountDefaultBackgroundId: string | null;
  showClock: boolean;
  storageStatus: "loading" | "available" | "unavailable" | "unsupported-version";
  storageError: string | null;
  accountStatus: "anonymous" | "loading" | "synced" | "saving" | "error";
  accountError: string | null;
}
```

Extend `MusicContextType` with:

```ts
visualizer: MusicVisualizerState
selectVisualizerBackground: (backgroundId: string) => void
setVisualizerShowClock: (showClock: boolean) => void
setCurrentVisualizerBackgroundAsDefault: () => Promise<void>
restoreVisualizerAccountDefault: () => void
retryVisualizerAccountSync: () => Promise<void>
```

The test should also assert that `stopCurrent` no longer calls `setActiveStationId(null)` or clears title/artist. It still invalidates outstanding play requests, stops the runtime, clears progress/error, and sets `playbackState` to `stopped`.

Run:

```powershell
node --test tests/music-visualizer-provider.test.mjs
```

Expected: FAIL because the provider does not expose visualizer state and still clears the selected station.

### Step 2: Add failing account-payload preservation tests

In `tests/account-preferences.test.mjs`, prove that:

```js
buildUserPreferencePayload({
  appSettings: {
    musicVisualizer: { defaultBackgroundId: "aurora", showClock: true },
  },
});
```

preserves the namespaced object and strips forbidden nested keys. Do not change the API route's top-level merge contract.

### Step 3: Hydrate local v2 state and migrate legacy keys

In `readStoredAtmosphereState`, read:

- `ATMOSPHERE_STORAGE_KEY`;
- `LEGACY_ATMOSPHERE_STORAGE_KEY`;
- the legacy Music background key.

After a successful supported migration, persist v2 and its consumed marker. Do not delete legacy keys in this track; leaving them read-only keeps rollback recoverable while the marker prevents re-consumption. If localStorage is denied, retain in-memory defaults and set `storageStatus: "unavailable"` with a safe `storageError`. If a future version is encountered, set `storageStatus: "unsupported-version"`, preserve the raw value, and do not write. Neither storage condition blocks visualizer use or changes account sync status.

### Step 4: Hydrate and sync account visualizer preferences

Follow the existing Chimer preference pattern:

1. Fetch `/api/auth/session`.
2. Use `canSyncAccountPreferencesFromSession`.
3. Fetch `/api/account/preferences` only for a signed-in account.
4. Normalize `appSettings.musicVisualizer`.
5. Make account `showClock` authoritative after hydration and mirror it into device state.
6. PUT only:

```json
{
  "appSettings": {
    "musicVisualizer": {
      "defaultBackgroundId": "...",
      "showClock": false
    }
  }
}
```

The existing route merges this top-level key with unrelated app settings. Use request sequencing/abort protection so a stale response cannot overwrite a newer choice. Saving a default is optimistic only for status; do not replace the last confirmed default until the response succeeds. Show-clock changes update locally immediately and retain a retryable error if sync fails.

### Step 5: Implement selection/default actions

- `selectVisualizerBackground(id)` updates the device value only.
- `setCurrentVisualizerBackgroundAsDefault()` requires sign-in and a current usable choice.
- `restoreVisualizerAccountDefault()` clears only the device override.
- `retryVisualizerAccountSync()` retries the last failed default/show-clock payload.

Eligibility resolution remains outside persistence: pass saved IDs through the existing background option/feature-key gate before rendering.

### Step 6: Add the persistent player action

Use `usePathname`, `useSearchParams`, and `useRouter` in `MusicMiniPlayer`.

- When a station is selected, show Background in expanded layout and an icon-first accessible equivalent in collapsed layout.
- On the visualizer route, label it **Minimize visualizer**.
- Otherwise call `buildMusicVisualizerHref` with the current route and `openBackgroundPanel: true` when neither the device choice nor account default supplies a saved candidate. Do not import the large background registry into the global player; `/clock` is the final eligibility authority and opens Background itself when a saved candidate is locked, disabled, unknown, or outside the Music category.
- Do not mutate playback when navigating.
- Keep the player visible for `loading`, `playing`, `stopped`, and recoverable `failed` states as long as `activeStationId` is retained.

### Step 7: Remove the selectable `/music` page background

Delete `BackgroundHost`, `BackgroundSelector`, local background state/effects, and direct legacy-key writes from `app/browse/workspace.tsx`. Keep station/category discovery layout otherwise unchanged.

### Step 8: Add a browser test for retained stopped state

Extend the existing persistent-player scenario:

1. select a proof station;
2. verify Background in expanded mode;
3. collapse and verify its accessible control;
4. stop playback;
5. verify station identity and Background remain;
6. navigate to another client route and verify the player/action persist.

Run:

```powershell
node --test tests/atmosphere-storage.test.mjs tests/account-preferences.test.mjs tests/music-visualizer-provider.test.mjs
```

```powershell
npm run test:browser -- tests/browser/public-routes.spec.ts -g "visualizer action retains selected station" --project=desktop-chromium
```

Expected: PASS.

### Step 9: Commit

```powershell
git add components/providers/music-provider.tsx components/providers/music-mini-player.tsx app/browse/workspace.tsx lib/atmosphere/storage.js tests/atmosphere-storage.test.mjs tests/account-preferences.test.mjs tests/music-visualizer-provider.test.mjs tests/browser/public-routes.spec.ts
git commit -m "feat: add persistent music visualizer state"
```

---

## Task 5: Build the reusable immersive panel shell

**Files:**

- Create: `app/chimer/immersive-panel-shell.tsx`
- Create: `app/chimer/immersive-panel-shell.module.css`
- Create: `tests/immersive-panel-shell.test.mjs`
- Modify: `app/chimer/running-timer.tsx`
- Modify: `app/chimer/running-timer.module.css`
- Modify: `tests/app-settings.test.mjs`
- Modify: `tests/sitewide-control-rollout.test.mjs`
- Modify: `tests/chimer-color-picker.test.mjs`

### Step 1: Add failing shell contract tests

Test the exported panel identifiers and source contracts:

```ts
export type ImmersivePanelId = "clock" | "visual" | "background" | null;
```

Required shell props:

```ts
interface ImmersivePanelShellProps {
  activePanel: ImmersivePanelId;
  onActivePanelChange: (panel: ImmersivePanelId) => void;
  protectedDisplayRef: RefObject<HTMLElement | null>;
  clockContent: ReactNode;
  visualContent: ReactNode;
  backgroundContent: ReactNode;
  backgroundUnavailableMessage?: string | null;
  hapticsEnabled: boolean;
}
```

Assert that the old `SettingsTab`, `<Tabs>`, Settings button, and settings auto-close timer names are absent after the refactor. Update existing tests that deliberately inspect the old three-tab production markup; `/dev/buttons` may retain review examples, but production assertions must target the three immersive controls.

Run:

```powershell
node --test tests/immersive-panel-shell.test.mjs
```

Expected: FAIL because the shell and three-control production contract do not exist.

### Step 2: Implement one-active-panel state and control semantics

The shell renders one grouped toolbar:

- Clock, Visual, Background controls;
- icon plus label when space permits;
- icon-only with tooltips at narrow widths;
- `aria-expanded`, `aria-controls`, and an accessible name on every control;
- selecting the active control closes it;
- selecting a different control switches directly.

Keep active state in `RunningTimer`, because background selection and route `panel=background` must close/open it. The shell owns interaction mechanics, focus restoration, and measured layout.

### Step 3: Implement nonmodal Clock/Visual dismissal

Render a labeled `role="dialog"` panel without a focus trap. Close it on:

- its Close button;
- active toolbar toggle;
- `Escape`;
- outside pointer interaction.

Do not treat interactions inside approved portaled controls as outside. Reuse the existing color-picker portal marker or introduce one shared selector constant consumed by both shell and picker. Restore focus to the originating toolbar control after keyboard/Close dismissal.

### Step 4: Implement modal full-screen Background

Use the existing Radix-backed Dialog primitive if its overlay/content contract can guarantee:

- fixed viewport coverage above app bar and Music player;
- focus trap and inert underlying content;
- always-visible Close control;
- close only through Close or `Escape` (disable overlay-click dismissal);
- focus restoration to Background.

Give the overlay a documented z-index token above the current global player/navigation layers. Add `data-immersive-panel="background"` for browser geometry tests.

### Step 5: Implement bottom-first safe-stage measurement

Use one `ResizeObserver` for the protected display and open dock, plus viewport/orientation listeners. Compute placement in a small documented function:

```ts
type DockPlacement = {
  edge: "bottom" | "top";
  reservedPx: number;
  maxPanelPx: number;
};
```

Rules:

1. Prefer bottom when display bounds plus panel height and safe-area gap fit.
2. Otherwise try top.
3. If neither full panel fits, preserve the display and cap the dock to the remaining edge space with internal scroll.
4. Set CSS variables on the immersive root; re-center the protected stage within the unreserved region.
5. Never derive placement from transformed glow/rotation bounds; measure the stable display wrapper.

Expose test locators:

```html
data-immersive-stage data-protected-display data-immersive-dock="top|bottom"
```

### Step 6: Refactor existing panel contents into slots

In `RunningTimer`:

- preserve existing Clock, Visual, and Background controls;
- remove the Tabs wrapper and auto-close scheduling/effects;
- move Keep screen awake to the first Visual row;
- keep background selection/filtering in Background;
- keep effect controls/global colors/palettes in Visual;
- keep timer-only adjustments in Clock;
- keep only one active panel.

Do not split every background control out of the large file in this task. Extract only small render helpers if needed to keep the shell call readable.

### Step 7: Run focused tests

```powershell
node --test tests/immersive-panel-shell.test.mjs tests/app-settings.test.mjs tests/sitewide-control-rollout.test.mjs tests/chimer-color-picker.test.mjs
```

Expected: PASS.

```powershell
npm run typecheck
```

Expected: PASS.

### Step 8: Commit

```powershell
git add app/chimer/immersive-panel-shell.tsx app/chimer/immersive-panel-shell.module.css app/chimer/running-timer.tsx app/chimer/running-timer.module.css tests/immersive-panel-shell.test.mjs tests/app-settings.test.mjs tests/sitewide-control-rollout.test.mjs tests/chimer-color-picker.test.mjs
git commit -m "feat: add immersive display panels"
```

---

## Task 6: Integrate Chimer, Clock, and Music visualizer modes

**Files:**

- Modify: `app/chimer/page.tsx`
- Modify: `app/chimer/running-timer.tsx`
- Modify: `app/chimer/running-timer.module.css`
- Modify: `components/providers/music-provider.tsx`
- Modify: `tests/immersive-display.test.mjs`
- Create: `tests/music-visualizer-integration.test.mjs`
- Modify: `tests/background-options.test.mjs`

### Step 1: Define the compact mode object

Add this near `RunningTimerProps`; do not add another large set of unrelated booleans:

```ts
interface ImmersiveDisplayMode {
  context: "chimer" | "clock" | "musicVisualizer";
  backgroundCategory: "chimer" | "clock" | "music";
  selectedBackgroundId: string | null;
  showClock: boolean;
  canToggleClock: boolean;
  initialPanel: ImmersivePanelId;
  unavailableBackgroundMessage: string | null;
  storageStatus: MusicVisualizerState["storageStatus"];
  storageError: string | null;
  onShowClockChange?: (showClock: boolean) => void;
  onBackgroundChange: (backgroundId: string) => void;
  onClose: () => void;
  musicDefaultActions?: {
    signedIn: boolean;
    currentIsDefault: boolean;
    accountStatus: MusicVisualizerState["accountStatus"];
    accountError: string | null;
    onSetDefault: () => Promise<void>;
    onRestoreDefault: () => void;
    onRetry: () => Promise<void>;
  };
}
```

Write a source test that requires this single mode prop and rejects a parallel `MusicVisualizerRunningTimer` component.

The Visual panel renders a nonblocking device-storage notice from `storageStatus`/`storageError`, independently from account sync notices. Clock and Chimer pass `available`/`null`; Music visualizer passes the provider's live storage fields.

Run:

```powershell
node --test tests/music-visualizer-integration.test.mjs
```

Expected: FAIL because `RunningTimer` does not yet accept the mode contract.

### Step 2: Resolve mode in `ChimerPage`

Use `useSearchParams` plus `resolveImmersiveDisplayContext`.

- `chimer`: existing active timer behavior/settings/category.
- `clock`: `settings.showClockDisplay`, normal Clock background, existing close behavior.
- `musicVisualizer`: Music provider selection/default resolution, `visualizer.showClock`, category `music`, optional initial Background panel.

Sanitize `returnTo` once with the pure helper. Music visualizer `onClose` must call `router.replace(safeReturnTo)`. Ordinary Back remains normal browser history behavior.

### Step 3: Enforce explicit usable visualizer selection

Before rendering a Music background, resolve the saved IDs through the existing option registry and feature-key eligibility. Use `isBackgroundId(id) && canUseBackgroundId(id, featureKeys, "music")`; `isBackgroundId` is required because the registry's fallback definition makes `canUseBackgroundId` alone insufficient for unknown IDs.

- If usable: pass it to `RunningTimer`.
- If not usable: pass `null`, open Background, and show the retained unavailable-ID explanation.
- Never briefly render a stale or locked ID before feature/account hydration finishes.

Selecting an available background must:

1. update the device preference;
2. update the mode's selected ID;
3. close Background immediately;
4. reveal the visualizer without changing audio.

### Step 4: Implement separate Show clock controls

- Active Chimer: always show timer information; no Show clock toggle.
- Ordinary Clock: toggle `settings.showClockDisplay`, default true.
- Music visualizer: toggle `music.visualizer.showClock`, default false.

When Clock display is off, keep the background running and disable rotation/forward-glow controls with a short explanation. Do not change or erase their saved values.

### Step 5: Apply the shared wake-lock rule

Replace:

```ts
timerState.status === "clock" ||
  (timerState.status !== "idle" && settings.keepTimerScreenAwake);
```

with `shouldRequestImmersiveWakeLock(...)`. Preserve the current visibility-release/reacquire lifecycle. Surface unsupported/denied status at the top of Visual without changing the saved preference.

### Step 6: Add Music default controls to Visual

Render Set as visualizer default, current/default status, Restore account default, saving/error status, and retry only in `musicVisualizer` context. Anonymous users get none of these account actions. Restore clears the device override and reruns resolution; it must not delete the account default.

### Step 7: Unmount on minimize

Navigating away must unmount `RunningTimer`'s Music `BackgroundHost`; no global visualizer canvas/WebGL node should remain. The global provider retains station and visualizer preferences.

### Step 8: Run focused tests

```powershell
node --test tests/immersive-display.test.mjs tests/music-visualizer-integration.test.mjs tests/background-options.test.mjs
```

Expected: PASS.

```powershell
npm run typecheck
```

Expected: PASS.

### Step 9: Commit

```powershell
git add app/chimer/page.tsx app/chimer/running-timer.tsx app/chimer/running-timer.module.css components/providers/music-provider.tsx tests/immersive-display.test.mjs tests/music-visualizer-integration.test.mjs tests/background-options.test.mjs
git commit -m "feat: reuse clock as music visualizer"
```

---

## Task 7: Add centered-display rotation and forward glow

**Files:**

- Modify: `app/chimer/running-timer.tsx`
- Modify: `app/chimer/running-timer.module.css`
- Modify: `tests/music-visualizer-integration.test.mjs`
- Modify: `tests/background-options.test.mjs`
- Modify: `docs/project-log.md`

### Step 1: Verify source terms before code transfer

Review the source and license for [Neon Clock](https://codepen.io/wheatup/pen/JjzdMbK). Record:

- source URL;
- author attribution;
- reusable license terms if explicit;
- whether declarations were adapted or the behavior was independently reproduced.

If terms are unclear, do not copy source-specific declarations. Independently implement the already-approved behavior: approximately 40-second `rotateY(-10deg)` to `rotateY(10deg)` motion and a transformed/blurred/masked duplicate projection.

### Step 2: Add failing markup/style tests

Require:

- one stable `data-protected-display` wrapper;
- a nested rotation layer only when enabled and the centered display is visible;
- one `aria-hidden="true"`, pointer-free forward projection when enabled;
- projection content derived from the same display data/color;
- a reduced-motion rule that sets animation to `none`;
- no duplicated interactive controls.

Run:

```powershell
node --test tests/music-visualizer-integration.test.mjs tests/background-options.test.mjs
```

Expected: FAIL because the two effect controls and decorative layers do not exist.

### Step 3: Add the two Clock-panel toggles

Use the shared toggle control with labels:

- Display rotation
- Forward glow

Bind directly to `clockRotationEnabled` and `clockForwardGlowEnabled`. Both default off. Show no speed/intensity sliders. Disable both when the current Clock context has Show clock off; active Chimer remains eligible because timer information cannot be hidden.

### Step 4: Implement rotation without destabilizing measurement

Keep the outer protected wrapper untransformed and measured. Apply perspective/rotation to an inner visual layer:

```css
@keyframes immersive-display-yaw {
  0%,
  100% {
    transform: rotateY(-10deg);
  }
  50% {
    transform: rotateY(10deg);
  }
}

.displayRotationEnabled {
  animation: immersive-display-yaw 40s ease-in-out infinite;
  transform-style: preserve-3d;
}

@media (prefers-reduced-motion: reduce) {
  .displayRotationEnabled {
    animation: none;
  }
}
```

Use the existing resolved display swap state so the effect follows whichever display is centered.

### Step 5: Implement the decorative forward projection

Render a semantic-free duplicate beneath the primary visual layer. Derive color from the active primary display color and apply:

- shallow `rotateX`/translate transform;
- blur and opacity falloff;
- linear-gradient mask;
- `pointer-events: none`;
- bounded overflow so it cannot enter toolbar hit areas.

Time/timer updates should flow from the same already-computed display parts rather than a second interval.

### Step 6: Run focused tests and typecheck

```powershell
node --test tests/music-visualizer-integration.test.mjs tests/background-options.test.mjs tests/chimer-timer.test.mjs
```

```powershell
npm run typecheck
```

Expected: PASS.

### Step 7: Commit

```powershell
git add app/chimer/running-timer.tsx app/chimer/running-timer.module.css lib/chimer-timer.js tests/music-visualizer-integration.test.mjs tests/background-options.test.mjs tests/chimer-timer.test.mjs docs/project-log.md
git commit -m "feat: add immersive clock display effects"
```

---

## Task 8: Prove panel geometry, accessibility, persistence, and playback continuity

**Files:**

- Create: `tests/browser/music-visualizer.spec.ts`
- Modify: `tests/browser/public-routes.spec.ts`
- Modify: `playwright.config.ts` only if a named short-landscape project is necessary; prefer per-test viewport overrides
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

### Step 1: Add anonymous browser coverage

Use the existing deterministic proof station/runtime fixtures. Cover:

1. select station and open visualizer Background picker;
2. verify modal bounds cover viewport and global app/player controls are not interactable;
3. select an available real background and verify immediate reveal;
4. verify Show clock begins off;
5. enable it, reload/reopen, and verify device persistence;
6. minimize to the exact origin route without stopping/clearing station;
7. reopen visualizer and verify selected background;
8. stop audio and verify Background action remains available;
9. browser Back returns without a visualizer loop.

Run the new desktop spec before fixing any uncovered integration gaps:

```powershell
npm run test:browser -- tests/browser/music-visualizer.spec.ts --project=desktop-chromium
```

Expected: FAIL until the new acceptance scenarios, stable test locators, and any exposed integration gaps are completed.

### Step 2: Add ordinary Clock and active Chimer separation coverage

Assert:

- ordinary `/clock` begins with clock visible and remembers its own Show clock value;
- changing Music Show clock does not change ordinary Clock;
- active Chimer has no Show clock toggle;
- timer-only remaining/chime controls appear only during active Chimer;
- Keep screen awake is the first Visual control in all contexts.

### Step 3: Add dismissal and focus coverage

For Clock and Visual:

- active toggle closes;
- switching buttons keeps one panel active;
- Close restores focus;
- `Escape` restores focus;
- outside click closes;
- interaction in the shared color-picker portal does not close;
- waiting beyond the former auto-close duration leaves the panel open.

For Background:

- outside overlay interaction does not close;
- `Escape` and Close do;
- focus remains trapped inside while open;
- focus returns to Background.

### Step 4: Add safe-stage geometry coverage

Run the same bounding-box assertion at:

- desktop viewport;
- mobile portrait project;
- a short landscape viewport such as `844x390`;
- 200% browser zoom/emulation where Playwright supports it reliably.

For each Clock/Visual panel, assert no intersection between `[data-protected-display]` and `[data-immersive-dock]`. Allow edge fallback and internal scroll; do not assert a fixed top/bottom placement except that bottom wins when both fit.

### Step 5: Add effect and resource coverage

- Rotation class follows the centered display before/after swap.
- Reduced-motion emulation reports no running rotation animation.
- Forward projection is `aria-hidden` and has `pointer-events: none`.
- After Minimize, no Music visualizer BackgroundHost/canvas/WebGL root remains.
- Player, selected station, background choice, and Show clock remain available.

### Step 6: Add signed-in preference coverage

Use the repo's existing authenticated test fixture or route mocks; do not introduce a production-only bypass. Cover:

- account default hydration;
- device override precedence;
- Set as visualizer default;
- Restore account default;
- failed PUT leaves current device selection active and shows retry;
- unrelated app settings survive the account update.

### Step 7: Run focused Playwright passes

```powershell
npm run test:browser -- tests/browser/music-visualizer.spec.ts --project=desktop-chromium
```

```powershell
npm run test:browser -- tests/browser/music-visualizer.spec.ts --project=mobile-chromium
```

```powershell
npm run test:browser -- tests/browser/public-routes.spec.ts -g "visualizer action retains selected station" --project=desktop-chromium
```

Expected: PASS.

### Step 8: Run the repository gate

```powershell
npm run lint
```

```powershell
npm run typecheck
```

```powershell
npm run test
```

```powershell
npm run build
```

```powershell
git diff --check
```

Expected: all PASS. If a command hits the known Windows sandbox launch failure before execution, rerun the same repo command through the approved outside-sandbox path; do not treat that as an application failure.

### Step 9: Perform manual visual review

Review active Chimer, ordinary Clock, and Music visualizer at desktop, phone portrait, and short landscape. Specifically inspect:

- centered display remains readable with Clock/Visual open;
- player remains reachable except under the intentional Background modal;
- labels collapse before tool actions/controls disappear;
- full-screen picker has a reachable Close control;
- rotation/glow do not clip or overlap controls;
- visualizer Minimize returns to the expected route.

### Step 10: Update canonical docs

In `docs/project-state.md`, record the delivered current behavior and validation status without promoting other track work. In `docs/project-log.md`, add the dated implementation/decision entry, including the no-Prisma preference storage choice and source/license handling for the Neon Clock inspiration.

### Step 11: Commit

```powershell
git add tests/browser/music-visualizer.spec.ts tests/browser/public-routes.spec.ts playwright.config.ts docs/project-state.md docs/project-log.md
git commit -m "test: validate immersive music visualizer"
```

Before committing, unstage `playwright.config.ts` if no project change was needed.

---

## Final acceptance checklist

- Three separate Clock, Visual, and Background controls replace production Settings tabs.
- Only one panel is active; no panel auto-closes.
- Clock/Visual never overlap protected digits at required viewports.
- Background is the only panel that covers the display and all global chrome.
- Music player Background action persists after station selection across loading, playing, stopped, recoverable failure, collapse, and route changes.
- Stopping audio retains the selected station; clearing/changing a station occurs only through an explicit selection action.
- Music visualizer uses `/clock?source=music`, requires an explicit usable background, and minimizes to a sanitized origin.
- `/music` has no separate user-selected background.
- Device choice, account default, Restore, and two separate Show clock preferences follow the approved precedence.
- Minimize unmounts the visualizer renderer while preserving playback/player/preferences.
- Keep screen awake is first in Visual and governs all three immersive contexts.
- Rotation and Forward glow are independent, off by default, centered-display-aware, and reduced-motion safe.
- Current entitlement/background gating remains intact.
- Focus, tooltips, modal semantics, outside-click rules, and zoom/phone access meet the accessibility contract.
- Focused tests, desktop/mobile Playwright, lint, typecheck, full tests, build, and diff check pass.
- `TODO.md` remains untouched by Track 2 commits.
