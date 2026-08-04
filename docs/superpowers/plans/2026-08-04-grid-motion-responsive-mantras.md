# Grid Motion Responsive Mantras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Grid Motion into a continuously moving, portrait-filling wellness background whose users can personalize with up to ten short mantras without starting from a blank slate.

**Architecture:** A small pure mantra-domain module owns starter content and normalization, `ChimerSettings` persists the normalized array, and one shared React editor is reused by setup and running Visual controls. The renderer derives enough rows from its measured height, repeats the normalized mantras across tiles, and combines continuous ambient row travel with optional additive pointer influence.

**Tech Stack:** JavaScript domain helpers with JSDoc, React 19 and TypeScript, CSS Modules, the existing Chimer settings sanitizer/entitlement reset pipeline, ResizeObserver, Node test runner, Playwright Chromium.

## Global Constraints

- Keep the background ID `massage-lab-grid-motion` and approved display name `Grid Motion` unchanged.
- Store user content only in the existing Chimer settings/preferences path; add no Prisma schema, API route, analytics event, or hosted clinical storage.
- A mantra contains 1 to 3 whitespace-delimited words after trimming/collapsing whitespace and no more than 28 Unicode characters.
- Store 1 to 10 mantras. Drop empty/invalid entries, preserve valid order, remove exact case-insensitive duplicates, and use the starter set only when the whole input is missing, invalid, or normalizes empty.
- The exact ten starter mantras are: `I am grounded`, `I choose ease`, `I can soften`, `Breathe and release`, `Rest is productive`, `I trust myself`, `I am enough`, `Peace begins within`, `My body knows`, `I welcome calm`.
- Setup and running Visual controls must use the same shared editor and copy: `Mantras`, `Up to 10 phrases. Each can use 3 words and 28 characters.`, `Add mantra`, and `Remove mantra`.
- Grid Motion must render at least 6 rows and enough additional rows to cover portrait height; cap rendered rows at 14 and keep 7 tiles per row.
- Ambient movement runs without cursor/touch input. Cursor interaction is optional and additive. Reduced motion renders a stable representative layout.
- Do not generate/replace preview media, change palette roles, alter entitlements, or change the future five-playing-preview contract.

---

### Task 1: Define and persist the Grid Motion mantra domain

**Files:**
- Create: `lib/grid-motion-mantras.js`
- Modify: `lib/chimer-timer.js`
- Modify: `app/chimer/running-timer.tsx`
- Modify: `app/chimer/set-timer.tsx`
- Modify: `app/chimer/page.tsx`
- Test: `tests/grid-motion-mantras.test.mjs`
- Test: `tests/chimer-timer.test.mjs`
- Test: `tests/chimer-entitlements.test.mjs`

**Interfaces:**
- Produces: `GRID_MOTION_MANTRA_LIMIT = 10`, `GRID_MOTION_MANTRA_WORD_LIMIT = 3`, `GRID_MOTION_MANTRA_CHARACTER_LIMIT = 28`, frozen `DEFAULT_GRID_MOTION_MANTRAS`, `normalizeGridMotionMantra(value): string`, and `normalizeGridMotionMantras(value, fallback?): string[]`.
- Produces: `ChimerSettings.massageLabGridMotionMantras: string[]`, passed through setup, running timer, reset/entitlement sanitization, and renderer props.

- [ ] **Step 1: Write failing pure-domain tests**

Create table-driven tests covering: whitespace collapse; 28-character cap without splitting a surrogate pair; first-three-word cap; empty rejection; case-insensitive duplicate removal; order preservation; ten-entry cap; fallback to all ten exact starters for `undefined`, non-array input, and all-invalid input; and a defensive returned copy that cannot mutate the frozen starters.

Example assertions:

```js
assert.equal(normalizeGridMotionMantra("  I   choose   ease  now "), "I choose ease")
assert.deepEqual(normalizeGridMotionMantras(["I am enough", "i am enough", "Breathe and release"]), [
  "I am enough",
  "Breathe and release",
])
assert.deepEqual(normalizeGridMotionMantras(undefined), [...DEFAULT_GRID_MOTION_MANTRAS])
```

- [ ] **Step 2: Run the pure-domain test and confirm it fails**

Run: `node --test tests/grid-motion-mantras.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure mantra contract**

Use JSDoc to document the user-content boundary. Normalize each candidate by `String(value)` only when `typeof value === "string"`, apply Unicode-safe character limiting with `Array.from(...)`, collapse whitespace, then retain at most three nonempty words. Apply the 28-character limit before a final trim; never append ellipsis. `normalizeGridMotionMantras` must return a new array and accept an optional already-normalized fallback for the settings sanitizer.

- [ ] **Step 4: Add the failing settings/persistence tests**

Extend `tests/chimer-timer.test.mjs` to prove valid mantras normalize and round-trip, invalid/all-empty input falls back to the ten starters, and arrays cap at ten. Extend `tests/chimer-entitlements.test.mjs` to prove the background-specific reset uses the exact starter array without sharing a mutable reference.

- [ ] **Step 5: Thread the new setting through existing typed props**

Add `massageLabGridMotionMantras: [...DEFAULT_GRID_MOTION_MANTRAS]` to `DEFAULT_CHIMER_SETTINGS`, normalize it with `normalizeGridMotionMantras(input.massageLabGridMotionMantras, fallback.massageLabGridMotionMantras)`, and include it in the background reset block. Add the array prop to setup/running prop types and the `app/chimer/page.tsx` call. Pass it into both `BackgroundHost` calls as `massageLabGridMotion.mantras`.

- [ ] **Step 6: Run focused settings tests**

Run: `node --test tests/grid-motion-mantras.test.mjs tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs tests/background-options.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/grid-motion-mantras.js lib/chimer-timer.js app/chimer/running-timer.tsx app/chimer/set-timer.tsx app/chimer/page.tsx tests/grid-motion-mantras.test.mjs tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs
git commit -m "feat: persist Grid Motion mantras"
```

---

### Task 2: Fill portrait screens and animate Grid Motion autonomously

**Files:**
- Modify: `components/backgrounds/effects/css-backgrounds.tsx`
- Modify: `components/backgrounds/effects/massage-lab-grid-motion-background.tsx`
- Modify: `components/backgrounds/BackgroundHost.module.css`
- Test: `tests/grid-motion-background.test.mjs`

**Interfaces:**
- Consumes: `MassageLabGridMotionOptions.mantras?: string[]` and `normalizeGridMotionMantras` from Task 1.
- Produces: `resolveGridMotionRowCount(height: number): number`, exported for unit tests; 6-14 rendered rows with 7 tiles each; ambient-plus-pointer row transforms.

- [ ] **Step 1: Write failing row-count and source-contract tests**

Require:

```js
assert.equal(resolveGridMotionRowCount(390), 7)
assert.equal(resolveGridMotionRowCount(844), 13)
assert.equal(resolveGridMotionRowCount(1200), 14)
```

The helper contract is:

```ts
Math.min(14, Math.max(6, Math.ceil(height / 76) + 1))
```

Also require renderer source to use normalized mantras, a `ResizeObserver`, timestamp-derived ambient phase, `Math.sin`, seven tiles per row, and cursor influence added to—not substituted for—the ambient target.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/grid-motion-background.test.mjs`

Expected: FAIL because Grid Motion has four hardcoded rows, fixed one-word items, and pointer-only targets.

- [ ] **Step 3: Make row count responsive**

Add `mantras?: string[]` to `MassageLabGridMotionOptions`, normalize it in `resolveGridMotionOptions`, and keep it outside the `Required<>` shortcut so the resolved type is explicit. Track row count in React state initialized to `6`. Observe the container and set rows from `resolveGridMotionRowCount(entry.contentRect.height)`; remove the observer on cleanup. Resize `currentOffsetsRef.current` without discarding existing offsets for surviving rows.

Render `rowCount` rows and exactly seven tiles per row. Resolve tile text with:

```ts
mantras[(rowIndex * 7 + itemIndex) % mantras.length]
```

Use a stable key containing row index, item index, and text because the same mantra repeats.

- [ ] **Step 4: Add autonomous row motion with pointer as an additive influence**

Track a RAF start timestamp. For row `index`, compute:

```ts
const direction = index % 2 === 0 ? 1 : -1
const ambientPhase = elapsedSeconds * 0.32 + index * 0.58
const ambientTarget = Math.sin(ambientPhase) * options.maxMoveAmount * 0.34 * direction
const pointerTarget = options.cursorInteraction
  ? (mouseXRef.current - 0.5) * options.maxMoveAmount * 0.66 * direction
  : 0
const target = ambientTarget + pointerTarget
```

Keep existing duration-derived smoothing. When motion is reduced, use elapsed seconds `0` and synchronously settle every row to its representative target without RAF. The pointer listener must remain absent when disabled.

- [ ] **Step 5: Adjust CSS for 6-14 rows without portrait gaps**

Change the container from a fixed `height: min(92vh, 960px)` to `min-height: 112%; height: auto`, keep it centered/rotated, reduce the row gap to `clamp(0.45rem, 1.2vw, 1rem)`, and give each row `grid-auto-rows: clamp(3.4rem, 7.2vh, 5.8rem)`. Remove the item `aspect-ratio` so row height governs. Keep overflow clipped by the root.

- [ ] **Step 6: Run the focused tests**

Run: `node --test tests/grid-motion-background.test.mjs tests/background-options.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/backgrounds/effects/css-backgrounds.tsx components/backgrounds/effects/massage-lab-grid-motion-background.tsx components/backgrounds/BackgroundHost.module.css tests/grid-motion-background.test.mjs
git commit -m "fix: make Grid Motion responsive and autonomous"
```

---

### Task 3: Reuse one accessible mantra editor in setup and running Visual controls

**Files:**
- Create: `app/chimer/grid-motion-mantra-editor.tsx`
- Modify: `app/chimer/set-timer.tsx`
- Modify: `app/chimer/running-timer.tsx`
- Modify: `app/chimer/chimer.module.css`
- Test: `tests/grid-motion-mantra-editor.test.mjs`

**Interfaces:**
- Consumes: normalized `string[]`, `GRID_MOTION_MANTRA_LIMIT`, `GRID_MOTION_MANTRA_WORD_LIMIT`, `GRID_MOTION_MANTRA_CHARACTER_LIMIT`, and `normalizeGridMotionMantra`.
- Produces: `GridMotionMantraEditor({ value, onChange }: { value: string[]; onChange(value: string[]): void })` shared by both Visual-control surfaces.

- [ ] **Step 1: Write the failing shared-editor source test**

Require the component to render the exact heading/helper/add/remove copy from Global Constraints, one explicitly labeled input per item, an Add button disabled at ten, and Remove disabled when one item remains. Require the in-focus draft limiter to enforce `GRID_MOTION_MANTRA_CHARACTER_LIMIT` with Unicode code points and require the input to omit native `maxLength`, which would preempt astral characters because HTML counts UTF-16 code units. Require each visible Remove button to have a unique indexed and phrase-specific accessible label. Require both `set-timer.tsx` and `running-timer.tsx` to import and render the shared component rather than duplicate input markup.

- [ ] **Step 2: Run the focused editor test and confirm it fails**

Run: `node --test tests/grid-motion-mantra-editor.test.mjs`

Expected: FAIL because the shared editor does not exist.

- [ ] **Step 3: Implement controlled editing without a blank-slate state**

Render a compact fieldset-like group under the existing Grid Motion motion controls. For each entry, render a text input without native `maxLength`, give the input an indexed accessible name such as "Mantra 1", and give the compact destructive/ghost Remove `Button` a unique indexed and phrase-specific accessible name such as "Remove mantra 1: I am grounded". On change, bound the local draft with `Array.from(...)` before passing `normalizeGridMotionMantra(...)` into a copied array; a fourth word is discarded and overlong input is capped at 28 Unicode code points. Add appends `"I am calm"` only when fewer than ten entries exist. Remove is disabled at one entry. Call `onChange` only with 1-10 normalized entries.

- [ ] **Step 4: Integrate the same component in both control surfaces**

Setup usage:

```tsx
<GridMotionMantraEditor
  value={settings.massageLabGridMotionMantras}
  onChange={(massageLabGridMotionMantras) => onSettingsChange({ massageLabGridMotionMantras })}
/>
```

Running usage:

```tsx
<GridMotionMantraEditor
  value={massageLabGridMotionMantras}
  onChange={(next) => handleSettingsChange({ massageLabGridMotionMantras: next })}
/>
```

Add compact CSS module classes for the group, rows, inputs, helper copy, and buttons. Use existing focus-ring/control tokens and preserve phone-panel horizontal containment.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
node --test tests/grid-motion-mantra-editor.test.mjs tests/grid-motion-mantras.test.mjs tests/chimer-timer.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/chimer/grid-motion-mantra-editor.tsx app/chimer/set-timer.tsx app/chimer/running-timer.tsx app/chimer/chimer.module.css tests/grid-motion-mantra-editor.test.mjs
git commit -m "feat: add shared Grid Motion mantra editor"
```

---

### Task 4: Prove portrait coverage, autonomous motion, editing, and persistence

**Files:**
- Modify: `app/dev/buttons/background-palette-gallery.tsx`
- Modify: `app/globals.css`
- Modify: `tests/browser/background-palette.spec.ts`
- Modify: `tests/background-animation-autonomy.test.mjs`
- Modify: `docs/project-log.md`
- Test: `tests/browser/background-palette.spec.ts`

**Interfaces:**
- Consumes: the existing `/dev/buttons` real-background fixture plus the production setup/running Visual-control paths already exercised by Chimer browser helpers.
- Produces: browser evidence for 390x844 and 844x390 layout, motion without pointer input, reduced-motion stability, ten-starter presentation, edit/add/remove constraints, and remount persistence.

- [ ] **Step 1: Add the failing real-browser Grid Motion test**

Add one test named `fills phone viewports and persists editable Grid Motion mantras`. At `390x844`, select the real Grid Motion renderer and assert: at least 12 rows, exactly 7 tiles per row, the rendered layer covers the host bounds, and two host screenshots `700ms` apart differ without dispatching pointer events. Verify starter text includes `I am grounded` and `Breathe and release`. At `844x390`, assert at least 6 rows and no uncovered host strip.

Open the production-equivalent Visual controls in the fixture, change the first mantra to `Move with ease`, verify a fourth word is not stored, remove one entry, add one entry, and verify the list never exceeds ten. Remount the selected background and assert `Move with ease` remains visible. Under `reducedMotion: "reduce"`, require two screenshots `400ms` apart to match exactly.

- [ ] **Step 2: Run the browser test and confirm the current implementation fails**

Run: `npm run test:browser -- tests/browser/background-palette.spec.ts --project=mobile-chromium --grep "fills phone viewports and persists editable Grid Motion mantras"`

Expected: FAIL because the current renderer has four rows, pointer-only motion, and no mantra editor/schema.

- [ ] **Step 3: Add only the minimum dev-fixture plumbing required for the proof**

If the existing palette fixture cannot edit background-specific settings, extend its development-only Grid Motion specimen to mount the production `GridMotionMantraEditor` and hold settings through an unmount/remount toggle. Do not add a public route or production diagnostic attribute. Keep the test driven through real renderer DOM and real input events.

- [ ] **Step 4: Record the completed Grid Motion remediation**

Append a dated 2026-08-04 project-log entry recording responsive 6-14-row coverage, continuous ambient motion with additive cursor response, the ten wellness-first starter phrases, the 1-3-word/28-character/10-entry contract, shared setup/running controls, and existing preference persistence. State that background IDs and preview media are unchanged.

- [ ] **Step 5: Run the plan gate**

Run:

```bash
node --test tests/grid-motion-mantras.test.mjs tests/grid-motion-background.test.mjs tests/grid-motion-mantra-editor.test.mjs tests/chimer-timer.test.mjs tests/chimer-entitlements.test.mjs tests/background-options.test.mjs
npm run test:browser -- tests/browser/background-palette.spec.ts --project=mobile-chromium --grep "Grid Motion"
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands PASS; the production build completes all configured routes.

- [ ] **Step 6: Commit**

```bash
git add tests/browser/background-palette.spec.ts docs/project-log.md
git commit -m "test: prove responsive Grid Motion mantras"
```
