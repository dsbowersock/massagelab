# Body Sensation Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a useful first body-sensation tracker to `/wellness` with selectable body regions, richer sensation/context fields, private custom vocabulary capture, and timeline filters.

**Architecture:** Extend the existing client-owned wellness foundation instead of adding a second storage path. Body sensations remain `ClientWellnessEntry` rows with `category: "body_sensation"`, selected body regions in `regions`, sensation terms in `sensations`, contexts in `contexts`, and non-narrative body-sensation details in normalized metadata. Custom user terms may create `ClientWellnessVocabularySuggestion` rows with `status: "PRIVATE"` for the signed-in user only; no global suggestion, therapist sharing, calendar payload, or professional-record import is added in this branch.

**Tech Stack:** Next.js App Router, React client components, Prisma/Postgres, existing wellness server actions, `node:test`, TypeScript, Tailwind/shadcn primitives.

---

## Files

- Create: `components/wellness/body-region-selector.tsx`
- Modify: `components/wellness/wellness-hub-client.tsx`
- Modify: `app/wellness/actions.ts`
- Modify: `lib/client-wellness.js`
- Modify: `tests/client-wellness.test.mjs`
- Modify: `tests/client-wellness-source-guards.test.mjs`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

## Privacy Boundary

- Anonymous visitors can use the body map and filters in memory only.
- Signed-in users can save body-sensation entries and private custom term suggestions.
- Custom terms must stay private to the user and `status: "PRIVATE"` until a future reviewed vocabulary workflow exists.
- Do not add therapist/practice foreign keys, therapist visibility, calendar event payloads, notification payloads, Sentry metadata, or professional-record vault writes.

### Task 1: Body Sensation Helper Contract

**Files:**
- Modify: `lib/client-wellness.js`
- Modify: `tests/client-wellness.test.mjs`

- [ ] **Step 1: Add failing tests for body-sensation metadata and custom terms.**

Add tests asserting:

```js
const payload = normalizeClientWellnessEntryInput({
  category: "body_sensation",
  metadata: {
    durationMinutes: "45",
    bodyPosition: "sitting",
    activityContext: "typing at laptop",
    movementEffect: "worse",
    privateNarrative: "drop this",
  },
}, new Date("2026-06-16T12:00:00.000Z"))

assert.deepEqual(payload.metadata, {
  durationMinutes: 45,
  bodyPosition: "sitting",
  activityContext: "typing at laptop",
  movementEffect: "worse",
})
assert.deepEqual(normalizeClientWellnessCustomTerms(["  Zingy ", "zingy", "", 42, "x".repeat(120)]), [
  "Zingy",
  "x".repeat(80),
])
```

Run: `node --test tests/client-wellness.test.mjs`
Expected: FAIL until the helper exports `normalizeClientWellnessCustomTerms` and preserves the body-sensation metadata keys.

- [ ] **Step 2: Implement body-sensation metadata normalization.**

Keep only:

```js
durationMinutes: integer 0-10080
bodyPosition: trimmed string up to 80 chars
activityContext: trimmed string up to 160 chars
movementEffect: "better" | "worse" | "unchanged" | "unsure"
```

- [ ] **Step 3: Implement custom term normalization.**

Export `normalizeClientWellnessCustomTerms(input)` that accepts string arrays or comma-separated text, trims whitespace, deduplicates case-insensitively, limits to 8 terms, and truncates each term to 80 characters.

- [ ] **Step 4: Run focused tests.**

Run: `node --test tests/client-wellness.test.mjs`
Expected: PASS.

### Task 2: Private Vocabulary Suggestions

**Files:**
- Modify: `app/wellness/actions.ts`
- Modify: `tests/client-wellness.test.mjs`
- Modify: `tests/client-wellness-source-guards.test.mjs`

- [ ] **Step 1: Add server-action guard tests.**

Assert `app/wellness/actions.ts` imports `normalizeClientWellnessCustomTerms`, reads `customSensations`, writes `prisma.clientWellnessVocabularySuggestion.createMany`, filters suggestions by `userId`, and sets `status: "PRIVATE"`. Also assert the action source does not contain `status: "APPROVED"` or therapist/practice ownership.

- [ ] **Step 2: Read custom terms from form data.**

Add a helper in `app/wellness/actions.ts`:

```ts
function customSensationsFromFormData(formData: FormData) {
  return normalizeClientWellnessCustomTerms(formData.getAll("customSensations"))
}
```

- [ ] **Step 3: Save private suggestions after a successful body-sensation entry.**

Inside `createClientWellnessEntryAction`, after `clientWellnessEntry.create`, save only new private suggestions for the signed-in user:

```ts
await createPrivateVocabularySuggestions(userId, payload.category, customTerms)
```

The helper should load existing private terms for `{ userId, category, status: "PRIVATE" }`, dedupe case-insensitively, and create only missing terms with `status: "PRIVATE"`.

- [ ] **Step 4: Run focused tests.**

Run: `node --test tests/client-wellness.test.mjs`
Run: `node --test tests/client-wellness-source-guards.test.mjs`
Expected: PASS.

### Task 3: Body Region Selector UI

**Files:**
- Create: `components/wellness/body-region-selector.tsx`
- Modify: `components/wellness/wellness-hub-client.tsx`

- [ ] **Step 1: Create a controlled 2D selector.**

Build `BodyRegionSelector` with:

```ts
type BodyRegionSelectorProps = {
  selectedRegions: string[]
  onChange: (regions: string[]) => void
}
```

Use front/back grouped buttons for head, neck, shoulders, chest, abdomen, upper back, low back, hips, arms, hands, thighs, knees, calves, ankles, and feet. Render hidden `<input name="regions" value={region} />` elements for each selected region so the existing form path still works.

- [ ] **Step 2: Wire selected regions into the quick-log form.**

Replace the static region checkboxes with `BodyRegionSelector`, and reset the selected regions after a successful save/practice entry.

- [ ] **Step 3: Keep touch and keyboard behavior usable.**

Each region button must use `aria-pressed`, a visible label, and a minimum 40px touch target. The selector should not require pointer-only interaction.

### Task 4: Richer Body Sensation Fields And Filters

**Files:**
- Modify: `components/wellness/wellness-hub-client.tsx`

- [ ] **Step 1: Add body-sensation fields.**

Add fields for duration minutes, body position, activity/context detail, and movement effect. Serialize them into the form `metadata` JSON as `durationMinutes`, `bodyPosition`, `activityContext`, and `movementEffect`.

- [ ] **Step 2: Add custom term form payloads.**

When the custom sensation term is present, append it to both `sensations` and `customSensations`.

- [ ] **Step 3: Add timeline filters.**

Add category, region, and sensation/context filters above the timeline. Filter the displayed entries client-side while keeping export/delete actions operating on the full saved set.

- [ ] **Step 4: Show body-sensation details in timeline entries.**

Display selected regions, sensation terms, duration, movement effect, and contexts as compact chips. Keep raw notes as normal timeline text only; do not copy them into status, logs, notification copy, or calendar data.

### Task 5: Docs And Validation

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Update current state.**

Record that `/wellness` now includes the first 2D body-sensation tracker, richer body-sensation details, private custom term suggestions, and timeline filtering.

- [ ] **Step 2: Update project log.**

Add a 2026-06-16 entry linking this plan and summarizing the branch outcome.

- [ ] **Step 3: Run validation.**

Run:

```powershell
node --test tests/client-wellness.test.mjs
node --test tests/client-wellness-source-guards.test.mjs
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

## Acceptance Criteria

- `/wellness` quick log includes a usable 2D body-region selector.
- Body-sensation entries can capture sensation terms, intensity, duration, body position, movement effect, context, and notes.
- Anonymous visitors can practice with the same UI without persistence.
- Signed-in custom sensation terms create only private user-owned vocabulary suggestions.
- Timeline filters can narrow entries by category, region, and sensation/context.
- No therapist/practice visibility, sharing bridge, calendar payload, notification payload, Sentry metadata, or professional-record vault write is added.
