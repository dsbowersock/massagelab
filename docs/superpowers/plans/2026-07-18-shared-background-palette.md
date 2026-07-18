# Shared Background Palette and Visual Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated per-background color state with one seven-swatch Source/Custom/Harmony palette, registry-driven renderer adapters, reversible draft editing, and separate reusable Color and Visual presets across Chimer, Clock, and the Music visualizer.

**Architecture:** Keep `ChimerPage` as the committed preference owner and `RunningTimer` as the active immersive renderer after Track 2. Add DOM-independent palette, preset, migration, and draft modules; a typed adapter registry beside the background registry; and one adapter resolver at the `BackgroundHost` boundary. The Visual panel edits an in-memory draft and writes the existing local/account Chimer JSON only on Apply. Source colors remain renderer metadata, while Custom/Harmony colors and saved presets remain user preferences.

**Tech Stack:** Next.js App Router, React 19, TypeScript/JavaScript with focused JSDoc, CSS Modules, shared Radix-backed controls, existing account-preferences JSON, Node test runner, Playwright.

**Approved design:** `docs/superpowers/specs/2026-07-18-shared-background-palette-design.md`

## Execution prerequisites and guardrails

- Implement on a new branch created from refreshed `main`; suggested name: `codex/shared-background-palette`.
- Rebase after Track 2 lands. This plan integrates with `app/chimer/immersive-panel-shell.tsx` and its persistent Visual panel instead of rebuilding that shell.
- Track 1 must expose real server-backed permanent ownership before Task 6. Use its canonical ownership resolver/response; do not create a temporary ownership table, cookie, local flag, or duplicate purchase authority.
- Preserve the user-owned `TODO.md` edit and exclude it from every commit.
- Preserve all non-color renderer settings and all existing timer, audio, reduced-motion, background eligibility, and feature-key behavior.
- Keep the existing renderer path active until Task 10's atomic cutover. Intermediate adapter commits must not partially recolor production backgrounds.
- Do not add DNA or Twisted Cubes here; Track 4B consumes the finished adapter contract.
- Do not add a Prisma migration. The committed data remains nested in existing Chimer preference JSON.

## Target file map

- Create `lib/background-palette.js`: palette modes, seven-swatch normalization, harmony generation, migration, preset limits, mapping resolution, and effective access behavior.
- Create `lib/background-visual-draft.js`: bounded draft history and Apply/Cancel transitions.
- Create `components/backgrounds/backgroundPaletteRegistry.ts`: palette roles, source values/behavior, mappings, visual-property keys/defaults, renderer families, and adapter application.
- Create `components/backgrounds/resolveBackgroundEffectProps.ts`: pure BackgroundHost boundary resolver.
- Create `components/chimer-controls/BackgroundPaletteEditor.tsx`: Source/Custom/Harmony, seven swatches, dynamic labels, mapping, and resets.
- Create `components/chimer-controls/BackgroundPresetManager.tsx`: separate Color and Visual preset actions.
- Create `app/chimer/unsaved-visual-changes-dialog.tsx`: Apply/Discard/Keep editing decision surface.
- Create `app/chimer/visual-draft-navigation-guard.tsx`: internal-link interception and native unload warning while dirty.
- Create `app/dev/buttons/background-palette-gallery.tsx`: development review matrix and live renderer sampler.
- Create `tests/background-palette.test.mjs`, `tests/background-visual-draft.test.mjs`, `tests/background-palette-registry.test.mjs`, `tests/background-palette-sync.test.mjs`, and `tests/browser/background-palette.spec.ts`.
- Modify `components/backgrounds/backgroundRegistry.ts`, `components/backgrounds/BackgroundHost.tsx`, `components/backgrounds/effects/css-backgrounds.tsx`, and only those individual effect files whose typed renderer props need correction.
- Modify `components/chimer-controls/GlobalColorPicker.tsx` only to keep `ColorPickerSwatch` reusable; retire its obsolete semantic Global Colors wrapper at cutover.
- Modify `app/chimer/page.tsx`, `app/chimer/running-timer.tsx`, `app/chimer/running-timer.module.css`, `app/chimer/immersive-panel-shell.tsx`, and `app/chimer/set-timer.tsx`.
- Modify `lib/chimer-timer.js`, `lib/account-preferences.js`, and `app/api/account/preferences/route.ts`.
- Modify `app/dev/buttons/page.tsx`, `tests/chimer-timer.test.mjs`, `tests/chimer-entitlements.test.mjs`, `tests/chimer-color-picker.test.mjs`, `tests/background-options.test.mjs`, `tests/account-preferences.test.mjs`, `tests/sitewide-control-rollout.test.mjs`, `docs/project-state.md`, and `docs/project-log.md`.

---

## Task 1: Define the pure palette, preset, migration, and access contract

**Files:**

- Create: `lib/background-palette.js`
- Create: `tests/background-palette.test.mjs`

- [ ] **Step 1: Write failing state and resolution tests**

Cover fresh Source defaults, exactly seven sanitized swatches, Swatch 1 as Primary, every supported harmony producing seven valid hex colors, Custom/ Harmony role resolution, duplicate role assignments, unused retained swatches, invalid mappings falling back to curated defaults, and Source using adapter source colors without mutating dormant Custom/Harmony state.

Use this public core:

```js
export const BACKGROUND_PALETTE_VERSION = 1;
export const BACKGROUND_PALETTE_SWATCH_COUNT = 7;
export const BACKGROUND_COLOR_PRESET_LIMIT = 6;
export const BACKGROUND_VISUAL_PRESET_LIMIT = 3;
export const DEFAULT_BACKGROUND_PALETTE_STATE = Object.freeze({
  mode: "source",
  primaryColor: "#f97316",
  harmony: "analogous",
  swatches: Object.freeze([
    "#f97316",
    "#fb923c",
    "#fb7185",
    "#0f172a",
    "#f8fafc",
    "#db2777",
    "#ea580c",
  ]),
});

export function normalizeBackgroundPaletteState(value) {}
export function generateBackgroundHarmonySwatches(primaryColor, harmony) {}
export function normalizeBackgroundColorMapping(value, adapter) {}
export function resolveBackgroundRoleColors({
  palette,
  adapter,
  mapping,
  canCustomize,
}) {}
```

Run: `node --test tests/background-palette.test.mjs`

Expected: FAIL because `lib/background-palette.js` does not exist.

- [ ] **Step 2: Add failing preset and preference-limit tests**

Define and test `normalizeSharedBackgroundVisualPreferences(value)` with this persisted shape:

```js
{
  version: 1,
  palette: DEFAULT_BACKGROUND_PALETTE_STATE,
  colorPresets: [],
  mappingsByBackground: {},
  visualPresetsByBackground: {},
  defaultVisualPresetByBackground: {},
}
```

Assert six Color presets total, three Visual presets per known background, no Source Color preset, bounded names/IDs/timestamps, known property keys only through an injected registry callback, stale default IDs removed, and unknown background IDs discarded. Add helpers for save/update/rename/delete/apply and default Visual preset resolution; helpers return new values and never mutate input.

- [ ] **Step 3: Add failing migration and access tests**

Test legacy `massagelab-chimer-global-color-v1` values in this order: `primary`, `secondary`, `accent`, `background`, `foreground`, `ctaStart`, `ctaEnd`. Harmony `custom` becomes Custom; every other valid legacy harmony becomes Harmony; no record becomes Source. Invalid JSON falls back safely. Non-color Chimer keys pass through unchanged.

Add access tests for:

```js
canCustomizeBackgroundColors({
  hasCustomColorFeature,
  selectedBackgroundId,
  permanentlyOwnedBackgroundIds,
});

resolveEffectiveBackgroundPaletteMode({ savedMode, canCustomize });
```

The feature unlocks every compatible background; permanent ownership unlocks only the selected owned premium background; neither unlock is required for Source. Effective mode falls back to Source without deleting saved Custom/Harmony data.

- [ ] **Step 4: Implement the module with focused JSDoc**

Keep it DOM-, React-, account-, and registry-import-free. Accept registry validation callbacks where needed to avoid circular imports. Use stable IDs from `crypto.randomUUID()` only in UI callers; pure helpers receive IDs/timestamps so tests are deterministic.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/background-palette.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add lib/background-palette.js tests/background-palette.test.mjs
git commit -m "feat: define shared background palette state"
```

---

## Task 2: Add bounded draft editing with complete snapshot semantics

**Files:**

- Create: `lib/background-visual-draft.js`
- Create: `tests/background-visual-draft.test.mjs`

- [ ] **Step 1: Write failing reducer tests**

Test an opening snapshot containing palette, Color presets, selected-background properties, mapping, Visual presets, and default preset ID. Cover multi-step Undo/Redo for all six value families, redo invalidation after a new edit, no-op deduplication, dirty comparison, and a 50-snapshot history cap.

Use this contract:

```js
export const BACKGROUND_VISUAL_HISTORY_LIMIT = 50;

export function createBackgroundVisualDraft(openingSnapshot) {}
export function reduceBackgroundVisualDraft(state, action) {}
export function getCommittedBackgroundVisualSnapshot(state) {}
```

Actions must include `replace`, `reset-colors`, `reset-properties`, `apply-color-preset`, `apply-visual-preset`, all preset mutations, `undo`, `redo`, `apply`, and `cancel`.

Run: `node --test tests/background-visual-draft.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement immutable history transitions**

Normalize snapshots before comparison. `apply` makes current the new opening snapshot and clears both stacks. `cancel` restores the opening snapshot and clears history. The reducer never writes local storage, calls an API, or changes background selection/navigation.

- [ ] **Step 3: Run focused tests and commit**

```powershell
node --test tests/background-visual-draft.test.mjs
git add lib/background-visual-draft.js tests/background-visual-draft.test.mjs
git commit -m "feat: add background visual draft history"
```

---

## Task 3: Build an exhaustive typed adapter and visual-property inventory

**Files:**

- Create: `components/backgrounds/backgroundPaletteRegistry.ts`
- Modify: `components/backgrounds/backgroundRegistry.ts`
- Create: `tests/background-palette-registry.test.mjs`
- Modify: `tests/background-options.test.mjs`

- [ ] **Step 1: Write failing registry coverage tests**

Import both registries with Node's TypeScript stripping. For every enabled `BackgroundDefinition`, require one same-ID palette inventory entry whose temporary migration status is `pending`, `supported`, or `unsupported`. Disabled candidates may be omitted. Unsupported entries need a non-empty user-facing reason. Supported entries require unique stable role IDs, labels, valid source colors, Swatch indexes 0-6, renderer targets, a renderer family, and known non-color property keys/defaults.

Run:

```powershell
node --experimental-strip-types --test tests/background-palette-registry.test.mjs
```

Expected: FAIL because the adapter registry does not exist.

- [ ] **Step 2: Define the typed contract**

```ts
export type BackgroundRendererFamily = "css-dom" | "canvas" | "webgl";

export interface BackgroundPaletteRole {
  id: string;
  label: string;
  sourceColor: string;
  defaultSwatch: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  rendererTarget: string;
}

export interface SupportedBackgroundPaletteAdapter {
  status: "pending" | "supported";
  rendererFamily: BackgroundRendererFamily;
  roles: readonly BackgroundPaletteRole[];
  sourceBehavior?: "fixed" | "rainbow" | "automatic";
  visualPropertyKeys: readonly string[];
  sourceVisualProperties: Readonly<Record<string, unknown>>;
  applyRoleColors: (
    props: BackgroundEffectProps,
    colors: Readonly<Record<string, string>>,
  ) => BackgroundEffectProps;
}

export interface UnsupportedBackgroundPaletteAdapter {
  status: "unsupported";
  unsupportedReason: string;
  visualPropertyKeys: readonly string[];
  sourceVisualProperties: Readonly<Record<string, unknown>>;
}
```

`rendererTarget` is a stable, adapter-owned dot/bracket path describing the concrete prop/CSS-variable/canvas-uniform destination. Require unique non-empty targets per adapter and test that `applyRoleColors` changes exactly those targets and no undeclared property. Use a separate keyed registry file to keep the large source ledger readable, then attach the adapter in `backgroundRegistry.map(...)` so each exported `BackgroundDefinition` has one authoritative palette contract.

- [ ] **Step 3: Inventory every enabled background without changing production rendering**

Classify each enabled renderer from its implementation, not its marketing label. Record every existing non-color property key and sanitized source default. Mark color-capable entries `pending`; mark fixed/non-color-capable media `unsupported` with the approved no-tint reason. Do not yet pass adapters into `BackgroundHost`.

- [ ] **Step 4: Test exact source-default parity**

For each inventory entry, assert `sourceVisualProperties` equals the corresponding sanitized `DEFAULT_CHIMER_SETTINGS` values. Require Gradient Animation to declare seven roles. Require Ripple Grid, Aurora Bars, and Tile Grid to declare their approved special Source behavior.

- [ ] **Step 5: Run tests and commit**

```powershell
node --experimental-strip-types --test tests/background-palette-registry.test.mjs tests/background-options.test.mjs
git add components/backgrounds/backgroundPaletteRegistry.ts components/backgrounds/backgroundRegistry.ts tests/background-palette-registry.test.mjs tests/background-options.test.mjs
git commit -m "feat: inventory background palette adapters"
```

---

## Task 4: Complete CSS and DOM palette adapters

**Files:**

- Modify: `components/backgrounds/backgroundPaletteRegistry.ts`
- Modify: `components/backgrounds/effects/css-backgrounds.tsx`
- Modify: individual CSS/DOM effect files only where their color prop type is ambiguous
- Modify: `tests/background-palette-registry.test.mjs`
- Modify: `tests/background-options.test.mjs`

- [ ] **Step 1: Add failing CSS/DOM adapter assertions**

For every inventory entry classified `css-dom`, require `status: "supported"` or an explicit unsupported reason. Apply Source, Custom, and Harmony role maps to fixture props and assert only declared renderer targets change; speeds, sizes, opacity, density, interaction, and source behavior remain unchanged.

- [ ] **Step 2: Implement role metadata and typed application**

Migrate every CSS/DOM effect as one family, including the shared `css-backgrounds.tsx` exports. Preserve source Rainbow/Automatic paths when global mode is Source. Mapping functions must assign named roles, never declaration-order regex matching.

- [ ] **Step 3: Verify representative and exhaustive family tests**

Use representative exact-value assertions for Moving Gradient, Gradient Animation, Ripple Grid, Aurora Bars, and Tile Grid, plus a loop over every CSS/DOM inventory entry.

Run:

```powershell
node --experimental-strip-types --test tests/background-palette-registry.test.mjs tests/background-options.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add components/backgrounds/backgroundPaletteRegistry.ts components/backgrounds/effects tests/background-palette-registry.test.mjs tests/background-options.test.mjs
git commit -m "feat: adapt css backgrounds to shared palettes"
```

---

## Task 5: Complete Canvas/WebGL adapters and the BackgroundHost resolver

**Files:**

- Modify: `components/backgrounds/backgroundPaletteRegistry.ts`
- Create: `components/backgrounds/resolveBackgroundEffectProps.ts`
- Modify: Canvas/WebGL effect files only where their color prop type is ambiguous
- Modify: `tests/background-palette-registry.test.mjs`

- [ ] **Step 1: Write failing Canvas/WebGL and host-boundary tests**

Require every remaining enabled inventory entry to be `supported` or explicitly `unsupported`; no `pending` entry may remain. Exercise each adapter with Source, Custom, and Harmony fixture colors. Assert valid colors, unchanged non-color properties, no mutation, and no tint for unsupported media.

Define the staged resolver boundary without wiring it into production yet:

```ts
resolveBackgroundEffectProps({
  selectedId,
  effectProps,
  palette,
  mapping,
  canCustomize,
});
```

Run:

```powershell
node --experimental-strip-types --test tests/background-palette-registry.test.mjs
```

Expected: FAIL because Canvas/WebGL entries remain pending and the staged resolver does not exist.

- [ ] **Step 2: Implement every remaining typed adapter**

Map shader uniforms, Canvas draw colors, arrays, gradients, and structured renderer options by stable role ID. Preserve geometry and renderer lifecycle. Source mode must reproduce current source-visible values; Custom/Harmony must use the saved mapping. An adapter may return the original props object when unsupported or unchanged.

- [ ] **Step 3: Implement the staged host resolver**

Implement `resolveBackgroundEffectProps` as a pure adapter lookup and role-color application boundary. Test the compact input containing selected ID, normalized palette, mapping, access, and existing effect props. Do not import React or mutate props. Leave `BackgroundHost` on the existing production path until Task 10 so incomplete branch work never mixes old and new color sources.

- [ ] **Step 4: Run focused tests and typecheck**

```powershell
node --experimental-strip-types --test tests/background-palette-registry.test.mjs
npm run typecheck
```

Expected: PASS with zero pending enabled adapters.

- [ ] **Step 5: Commit**

```powershell
git add components/backgrounds/backgroundPaletteRegistry.ts components/backgrounds/resolveBackgroundEffectProps.ts components/backgrounds/effects tests/background-palette-registry.test.mjs
git commit -m "feat: define background palette resolver"
```

---

## Task 6: Persist nested preferences and integrate real ownership access

**Files:**

- Modify: `lib/chimer-timer.js`
- Modify: `lib/account-preferences.js`
- Modify: `app/api/account/preferences/route.ts`
- Modify: `app/chimer/page.tsx`
- Modify: `app/chimer/set-timer.tsx`
- Modify: `tests/chimer-timer.test.mjs`
- Modify: `tests/chimer-entitlements.test.mjs`
- Modify: `tests/account-preferences.test.mjs`
- Create: `tests/background-palette-sync.test.mjs`

- [ ] **Step 1: Verify Track 1's ownership contract before editing**

Confirm Track 1 is merged and identify its canonical server resolver plus the account-preferences field containing permanent owned background IDs. If absent, stop this task; do not mock an ownership array in production. Update the import/field names below to Track 1's landed names while preserving this behavior.

- [ ] **Step 2: Add failing nested-preference and migration tests**

Add `backgroundVisualPreferences` to `DEFAULT_CHIMER_SETTINGS` through `normalizeSharedBackgroundVisualPreferences`. Test local round trips, account payload round trips, malformed payloads, preset limits, known property clamps, no PHI fields, and preservation of every non-color Chimer value.

Test one-time browser migration from the old Global Colors state and saved-palette records into the nested preference. Inspect the raw parsed Chimer record before `sanitizeChimerSettings` adds defaults; migrate only when nested version 1 state is truly absent. After the new local commit succeeds, remove both old keys. Invalid old records are removed and fresh Source state is used.

- [ ] **Step 3: Add failing access and retention tests**

Cover feature access, owned-background-only access, unowned premium Source-only behavior, free-background existing entitlement behavior, subscription loss, ownership loss/refund, and data retention. The server sanitizer keeps valid saved palettes/presets even when access is absent; the effective resolver forces Source and disables editing. This prevents silent preference destruction while still enforcing access at render/edit time.

- [ ] **Step 4: Wire committed local/account state**

`ChimerPage` owns committed `backgroundVisualPreferences`, writes `CHIMER_STORAGE_KEY` on Apply, and includes the sanitized nested value in the existing `PUT /api/account/preferences`. Extend GET data with Track 1's owned IDs. Maintain a retryable sync state containing the exact last locally applied sanitized payload. A failed PUT leaves local state active and marks cloud state stale until Retry succeeds.

Do not use the current broad `canUseAccountColorControls` shortcut for per-background color access. Compute:

```ts
const canCustomizeSelectedBackground = canCustomizeBackgroundColors({
  hasCustomColorFeature: featureKeys.includes(FEATURE_KEYS.chimerCustomColors),
  selectedBackgroundId,
  permanentlyOwnedBackgroundIds,
});
```

- [ ] **Step 5: Run focused tests**

```powershell
node --test tests/background-palette.test.mjs tests/background-palette-sync.test.mjs tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs tests/account-preferences.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add lib/background-palette.js lib/chimer-timer.js lib/account-preferences.js app/api/account/preferences/route.ts app/chimer/page.tsx app/chimer/set-timer.tsx tests/background-palette-sync.test.mjs tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs tests/account-preferences.test.mjs
git commit -m "feat: sync shared background preferences"
```

---

## Task 7: Build the shared palette and separate preset controls

**Files:**

- Create: `components/chimer-controls/BackgroundPaletteEditor.tsx`
- Create: `components/chimer-controls/BackgroundPresetManager.tsx`
- Modify: `components/chimer-controls/GlobalColorPicker.tsx`
- Modify: `components/chimer-controls/chimer-controls.module.css`
- Modify: `tests/chimer-color-picker.test.mjs`
- Create: `tests/background-palette-editor.test.mjs`

- [ ] **Step 1: Write failing UI contract tests**

Require a labeled Source/Custom/Harmony single-choice control; seven always-visible swatches; Swatch 1 Primary; dynamic role labels; compact combined labels for shared swatches; explicit Not used labels; read-only Source context; mapping selectors exposing swatch number and color; and access messaging that preserves Source.

Require separate Color and Visual managers. Color supports Save as new/Apply/Update/Rename/Delete with six maximum and no default action. Visual supports those actions plus Set as default with three maximum for the selected background. Preset actions emit draft actions and never persist directly.

Run: `node --test tests/background-palette-editor.test.mjs tests/chimer-color-picker.test.mjs`

Expected: FAIL because the components do not exist.

- [ ] **Step 2: Implement the palette editor**

Reuse the accessible `ColorPickerSwatch` primitive. Replace the old semantic field union with indexed seven-swatch presentation in the new component; do not duplicate the HSV/eyedropper implementation. Harmony exposes Primary plus the existing harmony choice control and renders six derived read-only swatches. Source renders resolved source-role colors read-only and keeps dormant saved values untouched.

- [ ] **Step 3: Implement both preset managers**

Use bounded name inputs, keyboard-accessible menus, confirmation for delete, polite status text, and disabled limit messaging. Visual preset summaries exclude shared colors and include the active role mapping. Default markers appear only on Visual presets.

- [ ] **Step 4: Verify controls and commit**

```powershell
node --test tests/background-palette-editor.test.mjs tests/chimer-color-picker.test.mjs
npm run typecheck
git add components/chimer-controls/BackgroundPaletteEditor.tsx components/chimer-controls/BackgroundPresetManager.tsx components/chimer-controls/GlobalColorPicker.tsx components/chimer-controls/chimer-controls.module.css tests/background-palette-editor.test.mjs tests/chimer-color-picker.test.mjs
git commit -m "feat: add shared palette and preset controls"
```

---

## Task 8: Integrate draft editing and unsaved-change protection into Visual

**Files:**

- Create: `app/chimer/unsaved-visual-changes-dialog.tsx`
- Create: `app/chimer/visual-draft-navigation-guard.tsx`
- Modify: `app/chimer/running-timer.tsx`
- Modify: `app/chimer/running-timer.module.css`
- Modify: `app/chimer/immersive-panel-shell.tsx`
- Modify: `app/chimer/page.tsx`
- Modify: `tests/background-visual-draft.test.mjs`
- Modify: `tests/immersive-panel-shell.test.mjs`
- Modify: `tests/sitewide-control-rollout.test.mjs`

- [ ] **Step 1: Add failing integration and guard tests**

Require Visual to open from a complete committed snapshot and preview draft palette, mapping, and non-color properties through the active `BackgroundHost`. Assert no local-storage/API write before Apply. Assert Apply sends one sanitized snapshot; Cancel restores the opening view; and Undo/Redo covers colors, properties, mappings, resets, and preset mutations.

Add guard cases for Visual close, Visual-to-Clock/Background panel change, background selection, internal same-origin link navigation, browser back/forward attempt when observable, and `beforeunload`. The custom dialog has Apply changes, Discard changes, and Keep editing. Only dirty drafts install the native unload warning.

Run:

```powershell
node --test tests/background-visual-draft.test.mjs tests/immersive-panel-shell.test.mjs tests/sitewide-control-rollout.test.mjs
```

Expected: FAIL because `RunningTimer` still mutates committed settings directly and no draft guard exists.

- [ ] **Step 2: Wire one selected-background draft**

When Visual opens, derive its snapshot from committed shared preferences plus the selected adapter's sanitized non-color properties and mapping. Pass draft values to live renderer props. Keep background selection outside Undo history, but guard a selection change while dirty. After a confirmed switch, auto-apply that background's default Visual preset; when none exists, use registry source property defaults and curated mapping.

Organize Visual after Track 2 as:

1. Keep screen awake;
2. Shared Colors;
3. Selected Background Properties;
4. sticky Undo/Redo/Apply/Cancel/status row.

`Use source colors` changes only palette mode. `Reset visual properties` changes only selected non-color properties and curated mapping. Both are one undoable action.

- [ ] **Step 3: Add the three-choice guard**

Let `RunningTimer` own pending intent (`close-panel`, `change-panel`, `select-background`, or `navigate`). The dialog performs Apply then resumes, Discard then resumes, or clears the pending intent and keeps editing. `visual-draft-navigation-guard.tsx` captures eligible same-origin anchor clicks while dirty and installs `beforeunload`; ignore downloads, external links, modified clicks, hash-only links, and targets other than `_self`.

The panel shell continues to own focus and dismissal mechanics, but calls a request callback before closing/changing Visual. Do not make Clock or Background use draft semantics.

- [ ] **Step 4: Add accessibility and responsive behavior**

The decision dialog is modal and focus trapped. Sticky actions remain reachable at phone portrait, short landscape, and 200% zoom. Dirty/saved/sync-error status is textual and politely announced; live color movement is not announced. Disable Undo/Redo/Apply when unavailable and restore focus after canceling a pending action.

- [ ] **Step 5: Run focused tests and commit**

```powershell
node --test tests/background-palette.test.mjs tests/background-visual-draft.test.mjs tests/background-palette-editor.test.mjs tests/immersive-panel-shell.test.mjs tests/sitewide-control-rollout.test.mjs
npm run typecheck
git add app/chimer/unsaved-visual-changes-dialog.tsx app/chimer/visual-draft-navigation-guard.tsx app/chimer/running-timer.tsx app/chimer/running-timer.module.css app/chimer/immersive-panel-shell.tsx app/chimer/page.tsx tests/background-visual-draft.test.mjs tests/immersive-panel-shell.test.mjs tests/sitewide-control-rollout.test.mjs
git commit -m "feat: add visual draft editing workflow"
```

---

## Task 9: Add the development review matrix and exhaustive renderer sweep

**Files:**

- Create: `app/dev/buttons/background-palette-gallery.tsx`
- Modify: `app/dev/buttons/page.tsx`
- Modify: `tests/sitewide-control-rollout.test.mjs`
- Create: `tests/browser/background-palette.spec.ts`

- [ ] **Step 1: Write failing development-surface tests**

Add a `Background palettes` tab to `/dev/buttons`. Require static specimens for Source, Custom, Harmony, unused/shared role labels, access-locked state, dirty history states, sync failure/retry, Color preset limit, Visual preset limit/default, mapping, and both reset actions.

Require an adapter-status grid containing every enabled background and its renderer family, status, roles, source behavior, and unsupported reason. Require one live selector that mounts only the currently selected effect with test-only premium feature access; do not add a production access bypass to `BackgroundHost`.

- [ ] **Step 2: Build the gallery**

Use the real palette editor, preset manager, adapter registry, and `BackgroundHost`. Provide deterministic CSS/DOM, Canvas, and WebGL representatives plus the full live selector. Keep this route development-only through its existing `notFound()` guard.

- [ ] **Step 3: Write the exhaustive Playwright sweep**

In `tests/browser/background-palette.spec.ts`, use the development gallery inventory to select every enabled background in Source, Custom, and Harmony. For each combination assert the selected `data-background-id`, no unexpected fallback marker, no page/console error, valid adapter status, and a mounted effect or intentional unsupported result. Check representative resolved role colors through deterministic data attributes rather than pixel color equality.

Also cover:

- global palette persistence while switching backgrounds;
- dynamic labels without swatch mutation;
- selected-background-only remapping;
- Source restoration;
- Ripple Grid rainbow, Aurora Bars automatic, Tile Grid automatic;
- Gradient Animation consuming all seven roles;
- unsupported media remaining untinted;
- no timer/audio interruption during live draft edits.

- [ ] **Step 4: Run the review tests**

```powershell
node --test tests/sitewide-control-rollout.test.mjs
npm run test:browser -- tests/browser/background-palette.spec.ts
```

Expected: PASS in desktop, phone portrait, short landscape, and reduced-motion cases.

- [ ] **Step 5: Commit**

```powershell
git add app/dev/buttons/background-palette-gallery.tsx app/dev/buttons/page.tsx tests/sitewide-control-rollout.test.mjs tests/browser/background-palette.spec.ts
git commit -m "test: add background palette review matrix"
```

---

## Task 10: Perform the atomic cutover, remove obsolete color state, and validate

**Files:**

- Modify: `lib/chimer-timer.js`
- Modify: `lib/background-palette.js`
- Modify: `app/chimer/page.tsx`
- Modify: `app/chimer/running-timer.tsx`
- Modify: `app/chimer/set-timer.tsx`
- Modify: `components/chimer-controls/GlobalColorPicker.tsx`
- Modify: `components/backgrounds/BackgroundHost.tsx`
- Modify: `components/backgrounds/backgroundPaletteRegistry.ts`
- Modify: `tests/chimer-timer.test.mjs`
- Modify: `tests/chimer-entitlements.test.mjs`
- Modify: `tests/chimer-color-picker.test.mjs`
- Modify: `tests/background-options.test.mjs`
- Modify: `tests/background-palette-registry.test.mjs`
- Modify: `tests/background-palette-sync.test.mjs`
- Modify: `tests/sitewide-control-rollout.test.mjs`
- Modify: `tests/browser/background-palette.spec.ts`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Add failing legacy-cutover assertions**

Require all enabled adapters to be final `supported`/`unsupported` entries; remove the `pending` type. Assert production no longer contains the heuristic palette function, old Global Colors writes, semantic global fields, or per-background palette mode/Primary/harmony/individual color controls. Allow legacy key strings only inside the one-time migration test/reader.

Replace brittle source tests that count 216 RunningTimer and 211 SetTimer color controls with behavioral palette-editor, adapter-coverage, and registry-target assertions.

Run:

```powershell
node --experimental-strip-types --test tests/background-palette-registry.test.mjs tests/chimer-color-picker.test.mjs tests/chimer-timer.test.mjs
```

Expected: FAIL while legacy fields and controls remain.

- [ ] **Step 2: Remove obsolete per-background color fields in one commit**

Delete duplicated palette mode, Primary, harmony, and individual renderer color fields from `DEFAULT_CHIMER_SETTINGS`, `sanitizeChimerSettings`, entitlement sanitization, `ChimerSettings` consumers, setup/running props, and Visual controls. Keep all non-color properties, source-specific behavior controls, clock digit/stroke/shadow/glow colors, background selection, and source adapter values.

The one-time migration reads old Global Colors only when nested v1 preferences are absent and never writes the old keys. Sanitized account/local payloads emit only the nested shared palette/presets/mappings plus non-color settings.

- [ ] **Step 3: Switch every immersive context to the shared input**

Delete the heuristic host matcher and pass the same committed/draft palette contract through active Chimer, ordinary `/clock`, and `/clock?source=music`. `BackgroundHost` calls the staged resolver, memoized by selected ID, palette, mapping, access, and effect props; only the selected adapter consumes it, and unsupported media gets no generated tint. Confirm Track 1 owned-background access and `chimer_custom_colors` both work in all three contexts.

- [ ] **Step 4: Run the complete automated gate**

```powershell
node --experimental-strip-types --test tests/background-palette-registry.test.mjs
node --test tests/background-palette.test.mjs tests/background-visual-draft.test.mjs tests/background-palette-editor.test.mjs tests/background-palette-sync.test.mjs tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs tests/chimer-color-picker.test.mjs tests/background-options.test.mjs tests/account-preferences.test.mjs tests/sitewide-control-rollout.test.mjs
npm run test:browser -- tests/browser/background-palette.spec.ts
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

Expected: every command passes; browser sweep reports every enabled background in all three modes without unexpected fallbacks or console errors.

- [ ] **Step 5: Perform manual acceptance review**

Review `/dev/buttons`, `/clock`, active Chimer, and Music visualizer at desktop, phone portrait, short landscape, 200% zoom, and reduced motion. Verify live draft/Undo/Redo/Apply/Cancel, the three-choice guard, local/account persistence, retry after simulated save failure, preset limits/defaults, special Source behaviors, and timer/music continuity.

- [ ] **Step 6: Update canonical documentation**

Update `docs/project-state.md` with the final shared-palette architecture and current limitations. Append `docs/project-log.md` with implementation commits, ownership/Track 2 dependencies, migration behavior, adapter/render sweep results, and validation commands. Do not add this work to the public Roadmap.

- [ ] **Step 7: Commit the cutover**

```powershell
git add lib/background-palette.js lib/chimer-timer.js app/chimer/page.tsx app/chimer/running-timer.tsx app/chimer/set-timer.tsx components/chimer-controls/GlobalColorPicker.tsx components/backgrounds/BackgroundHost.tsx components/backgrounds/backgroundPaletteRegistry.ts tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs tests/chimer-color-picker.test.mjs tests/background-options.test.mjs tests/background-palette-registry.test.mjs tests/background-palette-sync.test.mjs tests/sitewide-control-rollout.test.mjs tests/browser/background-palette.spec.ts docs/project-state.md docs/project-log.md
git commit -m "feat: cut over to shared background palettes"
```

Before committing, inspect `git status --short` and preserve every unrelated working-tree change. If the user-owned `TODO.md` modification is still present in this workspace, confirm `git diff --cached --name-only` does not include it; do not require that branch-specific dirty state in a different workspace.

---

## Final acceptance checklist

- One global Source/Custom/Harmony mode and exactly seven persisted swatches drive every compatible background.
- Source preserves original colors and special automatic/rainbow behavior; fixed media remains untinted.
- All enabled backgrounds have a typed supported adapter or explicit unsupported reason; no heuristic color matching remains.
- Dynamic labels, curated defaults, and optional per-background role remapping work without changing global swatches.
- Fresh backgrounds use source colors and source property values until edited.
- Draft preview, 50-step Undo/Redo, Apply, Cancel, separate resets, and unsaved-change guards work.
- Color presets are global, separate, and capped at six; Visual presets are per-background, capped at three, and may be defaulted.
- Local and account sync retain valid saved data across access changes and expose retryable save failures.
- `chimer_custom_colors` unlocks all compatible backgrounds; permanent ownership unlocks only the owned premium background.
- Existing non-color controls, timers, audio, reduced motion, and background eligibility remain intact.
- Active Chimer, Clock, and Music visualizer share the same mode-aware palette contract.
- `/dev/buttons`, exhaustive Source/Custom/Harmony rendering, focused tests, full test suite, lint, typecheck, build, and diff check pass.
- `TODO.md` remains untouched by Track 4A commits, and the public Roadmap remains unchanged.
