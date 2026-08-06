# Full-Catalog Adaptive Background Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, validate, and visually review the complete adaptive-preview media catalog for all 84 enabled backgrounds without publishing to R2 or activating Production.

**Architecture:** Extend the approved pilot recipe/encoding/validation pipeline into one explicit recipe record per stable background ID. Reuse the seven approved visual-character batches as resumable generation and review checkpoints, emit 18 videos plus three posters for each of 82 animated backgrounds, and emit three posters only for the two truthful static backgrounds. Keep local generation, remote publication, and Production manifest activation as separate gates.

**Tech Stack:** Node.js ESM, TypeScript, Playwright Chromium capture, FFmpeg/FFprobe, VP9/WebM, H.264/MP4, WebP, Next.js App Router, `node:test`, Playwright `desktop-chromium`.

## Global Constraints

- Start from merged Production commit `5768c18a8f1a4ebdec06862ee1e3c6776150338f` in an isolated worktree.
- Preserve all existing background IDs, labels, renderers, entitlements, ownership keys, settings, and the approved three-shape low/standard/high ladder.
- Preserve every approved eight-background `recipe-1` pilot value exactly.
- Capture passive default behavior only. Do not synthesize pointer, hover, tap, drag, click, cursor simulation, reverse, ping-pong, morph, or speed-ramp motion.
- Use only truthful `natural` or `crossfade` animated loops. Static Gradient and Solid Color are poster-only; do not fabricate video motion for them.
- Keep display labels out of media paths. Use `<background-id>/<recipe-revision>/<aspect>/<tier>.<extension>`.
- Generate landscape, square, and vertical independently from the production `BackgroundHost`.
- Animated entries require three qualities by two codecs by three aspects: 18 videos plus three posters.
- Full local cardinality is exactly 84 manifest entries, 82 animated entries, 2 static entries, 1,476 videos, and 252 posters.
- VP9 remains `libvpx-vp9 -deadline good -cpu-used 2 -crf 30 -b:v 0`; H.264 remains `libx264 -preset slow -crf 21 -profile:v high -pix_fmt yuv420p -movflags +faststart`; posters remain WebP quality 84.
- All binary output stays ignored and local under `public/chimer/background-preview-catalog/`. Commit only source, tests, plans, and approved text metadata.
- Do not invoke an upload command, mutate R2, replace the production v1 manifest, or activate Production in this plan.
- Treat each of the seven approved visual-character batches as an independently resumable render and review checkpoint.
- Add focused JSDoc for recipe completeness, poster-only semantics, resumability, atomic manifest updates, and publication boundaries.

---

### Task 1: Define complete catalog coverage and poster-only semantics

**Files:**
- Modify: `scripts/chimer-preview-generation/preview-recipes.mjs`
- Modify: `scripts/chimer-preview-generation/rendition-plan.mjs`
- Modify: `scripts/chimer-preview-generation/media-validation.mjs`
- Modify: `tests/background-preview-recipes.test.mjs`
- Modify: `tests/background-preview-encoding.test.mjs`

**Interfaces:**
- Consumes: `backgroundRegistry` and `BACKGROUND_BRANDING_AUDIT_BATCHES`.
- Produces: `FULL_CATALOG_BACKGROUND_IDS`, `FULL_CATALOG_BATCHES`, `ANIMATED_BACKGROUND_IDS`, `STATIC_BACKGROUND_IDS`, `mediaKind: "animated" | "poster-only"`, and schema-aware work/validation plans.

- [ ] **Step 1: Add failing coverage and cardinality tests**

```js
it("covers every enabled background exactly once", async () => {
  const enabled = backgroundRegistry.filter(({ enabled }) => enabled).map(({ id }) => id).sort()
  assert.deepEqual([...FULL_CATALOG_BACKGROUND_IDS].sort(), enabled)
  assert.equal(FULL_CATALOG_BACKGROUND_IDS.length, 84)
  assert.equal(ANIMATED_BACKGROUND_IDS.length, 82)
  assert.deepEqual(STATIC_BACKGROUND_IDS, ["solid-color", "static-gradient"])
})

it("plans video only for truthful animated recipes", () => {
  assert.equal(buildBackgroundRenditionPlan(getBackgroundPreviewRecipe("massage-lab-dna")).length, 18)
  assert.equal(buildBackgroundRenditionPlan(getBackgroundPreviewRecipe("solid-color")).length, 0)
  assert.equal(buildBackgroundPosterPlan(getBackgroundPreviewRecipe("solid-color")).length, 3)
})
```

- [ ] **Step 2: Run the focused tests and verify the missing exports fail**

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs`

Expected: FAIL because the full-catalog exports and poster-only plan do not exist.

- [ ] **Step 3: Add the complete batch inventory and schema extension**

Import the existing `BACKGROUND_BRANDING_AUDIT_BATCHES`, freeze copied `{ slug, title, ids }` rows, flatten them into `FULL_CATALOG_BACKGROUND_IDS`, and fail module initialization if the flattened IDs contain duplicates. Extend recipes with `mediaKind`. `poster-only` requires `durationMs: 0`, `fps: 0`, `loopStrategy: "static"`, `crossfadeMs: 0`, and an in-range `posterTimeMs` used only as capture warmup timing.

- [ ] **Step 4: Extend planning and validation without weakening animated checks**

Add `buildBackgroundPosterPlan(recipe)` for all three aspects. Keep `buildBackgroundRenditionPlan(recipe)` at exactly 18 rows for animated entries and zero for poster-only entries. `validateCatalogManifest` must require 18 videos plus three posters for animated entries and exactly three posters with no videos for poster-only entries.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the complete catalog domain**

```bash
git add scripts/chimer-preview-generation/preview-recipes.mjs scripts/chimer-preview-generation/rendition-plan.mjs scripts/chimer-preview-generation/media-validation.mjs tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs
git commit -m "Define full background preview catalog"
```

### Task 2: Author explicit per-background candidate recipes

**Files:**
- Create: `data/background-preview-recipes.json`
- Create: `scripts/chimer-preview-generation/seed-catalog-recipes.mjs`
- Modify: `scripts/chimer-preview-generation/preview-recipes.mjs`
- Modify: `tests/background-preview-recipes.test.mjs`

**Interfaces:**
- Consumes: canonical registry motion intensity, approved pilot values, and stable batch IDs.
- Produces: one explicit JSON recipe row per enabled ID and `getBackgroundPreviewRecipe(id)` backed by that data.

- [ ] **Step 1: Add failing explicit-record tests**

```js
it("materializes an independent recipe for every enabled ID", () => {
  assert.equal(Object.keys(backgroundPreviewRecipes).length, 84)
  for (const id of FULL_CATALOG_BACKGROUND_IDS) {
    const recipe = getBackgroundPreviewRecipe(id)
    assert.equal(recipe.backgroundId, id)
    assert.deepEqual(validateBackgroundPreviewRecipe(recipe), [])
    assert.ok(["candidate", "approved"].includes(recipe.reviewStatus))
  }
})

it("preserves every approved pilot recipe byte-for-byte", () => {
  for (const [id, expected] of Object.entries(APPROVED_PILOT_RECIPES)) {
    assert.deepEqual(getBackgroundPreviewRecipe(id), expected)
  }
})
```

- [ ] **Step 2: Run the recipe test and verify it fails at eight entries**

Run: `node --test tests/background-preview-recipes.test.mjs`

Expected: FAIL because only the eight approved pilot recipes exist.

- [ ] **Step 3: Implement a deterministic one-time candidate seeder**

The seeder writes all 84 explicit rows in canonical batch order. Preserve pilot rows with `reviewStatus: "approved"`. Write Static Gradient and Solid Color as `poster-only`. Seed other subtle rows at 12 seconds/24 fps, medium rows at 10 seconds/24 fps, and high rows at 8 seconds/30 fps; use poster time at one-third duration and a 0.6-0.9 second crossfade. Add explicit natural-loop overrides only for renderers with an authored finite cycle proven in source; all other candidates use crossfade. The generator consumes the materialized JSON and never derives timing from motion intensity at runtime.

- [ ] **Step 4: Generate and inspect the explicit recipe JSON**

Run: `node --experimental-strip-types scripts/chimer-preview-generation/seed-catalog-recipes.mjs`

Expected: 84 stable rows, the exact eight approved pilot rows, 82 animated rows, and two poster-only rows.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the candidate recipe catalog**

```bash
git add data/background-preview-recipes.json scripts/chimer-preview-generation/seed-catalog-recipes.mjs scripts/chimer-preview-generation/preview-recipes.mjs tests/background-preview-recipes.test.mjs
git commit -m "Author full background preview recipes"
```

### Task 3: Generalize capture into a resumable catalog renderer

**Files:**
- Create: `scripts/chimer-preview-generation/render-catalog.mjs`
- Create: `scripts/chimer-preview-generation/generation-checkpoint.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `tests/background-preview-recipes.test.mjs`
- Modify: `tests/background-preview-encoding.test.mjs`

**Interfaces:**
- Consumes: full recipe registry, existing capture helpers, FFmpeg plans, media validation, and batch inventory.
- Produces: `npm run chimer:preview:catalog -- --output-dir <path> [--batch <slug>] [--ids <csv>] [--resume] [--force]` and `npm run chimer:preview:catalog:validate -- --output-dir <path>`.

- [ ] **Step 1: Add failing CLI and checkpoint source contracts**

```js
it("requires an explicit safe catalog output and supports resumable batches", () => {
  const source = readFileSync(new URL("../scripts/chimer-preview-generation/render-catalog.mjs", import.meta.url), "utf8")
  assert.match(source, /--output-dir/)
  assert.match(source, /--batch/)
  assert.match(source, /--resume/)
  assert.match(source, /refusing production preview directory/i)
  assert.doesNotMatch(source, /upload-r2/)
})
```

- [ ] **Step 2: Run focused tests and verify the missing renderer fails**

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs`

Expected: FAIL with file-not-found.

- [ ] **Step 3: Implement bounded selection and safe output rules**

Require `--output-dir`, reject `public/chimer/background-previews` and the pilot directory, accept one approved batch slug or known IDs, and default to all seven batches. `--force` may remove only files under the verified catalog root. `--resume` skips only an aspect whose poster and all required animated renditions pass hash and decode validation.

- [ ] **Step 4: Implement atomic per-aspect checkpoints**

Render one background/aspect at a time with a single Chromium capture worker. Encode into a temporary sibling directory, validate every expected file, then rename into its immutable recipe path and atomically update `generation-state.json`. A failed aspect records a sanitized diagnostic and leaves the last valid manifest entry unchanged.

- [ ] **Step 5: Preserve the proven capture lifecycle**

Reuse the pilot server readiness, shellless capture route, Next-indicator suppression, warmup, high-dimension independent aspect capture, poster extraction, encoding, frame strips, and cleanup. Poster-only recipes capture one representative still per aspect after warmup and never invoke video encoders.

- [ ] **Step 6: Add scripts and ignore generated binaries**

```json
"chimer:preview:catalog": "node --experimental-strip-types scripts/chimer-preview-generation/render-catalog.mjs",
"chimer:preview:catalog:validate": "node scripts/chimer-preview-generation/render-catalog.mjs --validate-only"
```

Ignore `public/chimer/background-preview-catalog/**/*.webm`, `*.mp4`, `*.webp`, `*.png`, `*.rgb`, `*.master.*`, and temporary directories while retaining `index.json`, `validation.json`, and `generation-state.json` for local evidence.

- [ ] **Step 7: Run focused tests**

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs tests/background-preview-media.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit the catalog renderer**

```bash
git add .gitignore package.json scripts/chimer-preview-generation/render-catalog.mjs scripts/chimer-preview-generation/generation-checkpoint.mjs tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs
git commit -m "Add resumable full preview renderer"
```

### Task 4: Emit a scalable full-catalog manifest without a generated TypeScript wall

**Files:**
- Create: `public/chimer/background-preview-catalog/index.json`
- Create: `components/backgrounds/backgroundPreviewCatalogManifest.ts`
- Modify: `scripts/chimer-preview-generation/rendition-manifest-module.mjs`
- Modify: `scripts/chimer-preview-generation/render-catalog.mjs`
- Modify: `tests/background-preview-recipes.test.mjs`

**Interfaces:**
- Consumes: complete validated output and existing v2 rendition types.
- Produces: deterministic schema v3 JSON with `mediaKind`, plus a small typed wrapper that imports and validates JSON instead of emitting thousands of TypeScript lines.

- [ ] **Step 1: Add failing manifest shape tests**

```js
it("serializes the exact full-catalog cardinality", () => {
  const manifest = buildSyntheticCatalogManifest()
  assert.deepEqual(validateCatalogManifest(manifest.entries), [])
  assert.equal(manifest.entries.length, 84)
  assert.equal(manifest.entries.flatMap((entry) => entry.renditions).length, 1476)
  assert.equal(manifest.entries.flatMap((entry) => Object.values(entry.posters)).length, 252)
})
```

- [ ] **Step 2: Run the recipe test and verify schema v3 support is missing**

Run: `node --test tests/background-preview-recipes.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add deterministic v3 JSON serialization**

Sort entries by approved batch order and renditions by aspect, quality, then codec. Include `schemaVersion: 3`, `catalogRevision`, `backgroundId`, `recipeRevision`, `mediaKind`, loop fields, rendition metadata, poster metadata, bytes, SHA-256, and batch slug. Reject candidate or incomplete entries when producing a publication manifest, but allow candidate rows in the local review manifest.

- [ ] **Step 4: Add the small typed runtime wrapper**

Import the JSON with a JSON import assertion, reuse existing v2 public types where compatible, add poster-only narrowing, validate once at module initialization, and expose `backgroundPreviewCatalogManifest` plus `resolveCatalogPreviewUrl`. Do not replace the production manifest consumer in this task.

- [ ] **Step 5: Run typecheck and focused tests**

Run: `npm run typecheck`

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the scalable manifest contract**

```bash
git add public/chimer/background-preview-catalog/index.json components/backgrounds/backgroundPreviewCatalogManifest.ts scripts/chimer-preview-generation/rendition-manifest-module.mjs scripts/chimer-preview-generation/render-catalog.mjs tests/background-preview-recipes.test.mjs
git commit -m "Add full preview manifest contract"
```

### Task 5: Expand `/dev/bgpreviews` into a full-catalog batch review surface

**Files:**
- Modify: `app/dev/bgpreviews/preview-pilot-review.tsx`
- Modify: `app/dev/bgpreviews/preview-pilot-review.module.css`
- Modify: `app/dev/bgpreviews/page.tsx`
- Modify: `tests/browser/background-preview-pilot.spec.ts`
- Modify: `tests/background-preview-recipes.test.mjs`

**Interfaces:**
- Consumes: local schema v3 manifest, approved batch inventory, and existing synchronized player components.
- Produces: batch/background/aspect review, six synchronized players for animated entries, three posters for static entries, validation diagnostics, and next-unreviewed navigation.

- [ ] **Step 1: Add failing browser/source contracts**

```ts
test("full catalog review resets sources across batch, background, and aspect", async ({ page }) => {
  await page.goto("/dev/bgpreviews?catalog=full")
  await expect(page.getByTestId("background-preview-catalog-review")).toBeVisible()
  await page.getByLabel("Background").selectOption("massage-lab-dna")
  await expect(page.locator("video")).toHaveCount(6)
  await page.getByLabel("Background").selectOption("solid-color")
  await expect(page.locator("video")).toHaveCount(0)
  await expect(page.locator("img")).toHaveCount(3)
})
```

- [ ] **Step 2: Run the focused browser test and verify full-catalog mode fails**

Run: `npm run test:browser -- --project=desktop-chromium tests/browser/background-preview-pilot.spec.ts`

Expected: FAIL because the full-catalog review mode does not exist.

- [ ] **Step 3: Add batch and review-state controls**

Add batch, background, and aspect selectors; Previous/Next background; Play/Pause all; Restart at boundary; validation summary; current recipe metadata; and per-aspect source-reset keys. Keep the approved pilot view available. Show explicit missing/failed evidence instead of stale media.

- [ ] **Step 4: Add poster-only presentation**

For Static Gradient and Solid Color, show the three independently captured posters with dimensions, bytes, hash, and a clear `Static background — no motion preview required` status. Do not render fake video elements.

- [ ] **Step 5: Run browser and focused tests**

Run: `npm run test:browser -- --project=desktop-chromium tests/browser/background-preview-pilot.spec.ts`

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-media.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the review surface**

```bash
git add app/dev/bgpreviews tests/browser/background-preview-pilot.spec.ts tests/background-preview-recipes.test.mjs
git commit -m "Expand preview review to full catalog"
```

### Task 6: Generate and independently validate all seven local batches

**Files:**
- Local ignored output: `public/chimer/background-preview-catalog/`
- Modify after accepted local generation: `public/chimer/background-preview-catalog/index.json`
- Modify: `docs/project-log.md`
- Modify: `docs/project-state.md`

**Interfaces:**
- Consumes: complete recipe registry and resumable renderer.
- Produces: 1,476 videos, 252 posters, decoded-frame evidence, validation state, and one local v3 manifest; no remote mutation.

- [ ] **Step 1: Verify encoder availability**

Run: `ffmpeg -hide_banner -encoders`

Expected: `libvpx-vp9`, `libx264`, and `libwebp` are available.

- [ ] **Step 2: Render each curated batch sequentially**

Run each command with the exact slug and `--resume` after any interruption:

```bash
npm run chimer:preview:catalog -- --output-dir public/chimer/background-preview-catalog --batch 01-foundations --resume
npm run chimer:preview:catalog -- --output-dir public/chimer/background-preview-catalog --batch 02-flow-and-liquid --resume
npm run chimer:preview:catalog -- --output-dir public/chimer/background-preview-catalog --batch 03-light-and-rays --resume
npm run chimer:preview:catalog -- --output-dir public/chimer/background-preview-catalog --batch 04-grids-and-pixels --resume
npm run chimer:preview:catalog -- --output-dir public/chimer/background-preview-catalog --batch 05-atmosphere-and-cosmos --resume
npm run chimer:preview:catalog -- --output-dir public/chimer/background-preview-catalog --batch 06-digital-energy --resume
npm run chimer:preview:catalog -- --output-dir public/chimer/background-preview-catalog --batch 07-fields-and-celestial --resume
```

Expected after batch 7: 84 entries, 1,476 videos, 252 posters, and no failed aspect checkpoint.

- [ ] **Step 3: Run independent complete-output validation**

Run: `npm run chimer:preview:catalog:validate -- --output-dir public/chimer/background-preview-catalog`

Expected: PASS with exact cardinality, valid hashes, full decode, expected codecs/dimensions/durations/frame rates, meaningful animated frame variation, and seam values within the approved thresholds.

- [ ] **Step 4: Run repository verification**

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs tests/background-preview-media.test.mjs tests/background-options.test.mjs`

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run build`

Run: `git diff --check`

Expected: PASS.

- [ ] **Step 5: Record generation truthfully**

Update the canonical docs with exact local counts, validation results, candidate/approved recipe status, and the explicit fact that R2 publication and Production activation remain unstarted. Confirm `git status --short` contains no generated binary media.

- [ ] **Step 6: Commit source and text evidence only**

```bash
git add data/background-preview-recipes.json scripts/chimer-preview-generation components/backgrounds/backgroundPreviewCatalogManifest.ts app/dev/bgpreviews tests package.json public/chimer/background-preview-catalog/index.json docs/project-log.md docs/project-state.md
git commit -m "Generate complete adaptive preview catalog"
```

### Task 7: Visual batch acceptance and publication handoff

**Files:**
- Modify as recipes are corrected: `data/background-preview-recipes.json`
- Modify after final local acceptance: `docs/project-log.md`
- Modify after final local acceptance: `docs/project-state.md`

**Interfaces:**
- Consumes: complete locally validated catalog and `/dev/bgpreviews?catalog=full`.
- Produces: approved recipes and a publication-ready handoff; still no R2 or Production mutation.

- [ ] **Step 1: Review every background in all three aspects**

Use the seven curated batches. For animated entries compare low/standard/high VP9 and H.264, poster choice, framing, motion truthfulness, duration, and loop seam. For static entries review all three posters.

- [ ] **Step 2: Regenerate only corrected IDs**

After any recipe edit, increment that background's recipe revision, rerun `chimer:preview:catalog -- --ids <csv> --force`, then rerun complete validation. Never overwrite an already reviewed immutable recipe path.

- [ ] **Step 3: Require explicit user acceptance of the complete local catalog**

Do not mark candidate rows approved until the user accepts their visual results. Regenerate the JSON manifest after status changes and repeat complete validation.

- [ ] **Step 4: Prepare but do not execute the publication plan**

Report exact local bytes, object count, hashes, catalog revision, expected immutable R2 prefix, rollback manifest, and the commands that a separately authorized publication task would dry-run. Do not upload or activate from this branch without explicit authorization.

- [ ] **Step 5: Commit the accepted local catalog metadata**

```bash
git add data/background-preview-recipes.json public/chimer/background-preview-catalog/index.json docs/project-log.md docs/project-state.md
git commit -m "Approve full background preview recipes"
```
