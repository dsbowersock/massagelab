# Background Preview Recipe and Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and visually validate a local-only eight-background preview pilot with per-background recipes and complete low/standard/high WebM and MP4 renditions for landscape, square, and vertical compositions.

**Architecture:** Pure recipe, asset-path, encoding-plan, and validation modules sit beside the existing generator. The renderer captures one high-quality master per aspect from the production `BackgroundHost`, derives all renditions and posters, and writes a sidecar v2 pilot manifest without replacing the production v1 manifest. A development-only review route presents synchronized quality, loop, poster, decoded-frame, and byte evidence.

**Tech Stack:** Node.js ESM, Playwright Chromium capture, FFmpeg/FFprobe, VP9 WebM, H.264 MP4, WebP, Next.js App Router, React, `node:test`, Playwright `desktop-chromium`.

## Global Constraints

- At execution time, use `superpowers:using-git-worktrees` to create an isolated worktree for generator changes and generated pilot media.
- Do not copy artifacts from the abandoned `C:\tmp\massagelab-bgpreviews-experiment`; start from the current committed generator and current branch.
- Pilot IDs are exactly: `massage-lab-moving-gradient`, `massage-lab-silk`, `massage-lab-wave-current`, `massage-lab-dna`, `massage-lab-twisted-cubes`, `massage-lab-galaxy`, `massage-lab-faulty-terminal`, and `massage-lab-tile-grid`.
- Capture passive default behavior only. Do not script pointer, hover, tap, or drag interaction.
- Allowed loop strategies are `natural` and `crossfade`. Do not reverse, ping-pong, morph, speed-ramp, or invent motion.
- Every recipe duration starts within 6-18 seconds; pilot evidence may revise a value only before presets are frozen.
- Generate landscape, square, and vertical independently from the real production renderer.
- Generate low, standard, and high VP9/WebM and H.264/MP4 renditions for every pilot aspect, plus one WebP poster per aspect.
- All renditions for one recipe/aspect share one authored duration and loop boundary.
- Display labels never appear in paths. Paths use `<id>/<recipe-revision>/<aspect>/<tier>.<extension>`.
- The pilot may not mutate `components/backgrounds/backgroundPreviewManifest.ts`, the production `public/chimer/background-previews/index.json`, R2, or Production.
- Generated pilot media stays uncommitted and local. Commit only reviewed source, tests, plan evidence, and small text manifests/contact-sheet metadata.
- Playable metadata alone is insufficient; animated captures require decoded-frame variation and visual proof.
- Add focused JSDoc for recipe constraints, manifest rules, loop intent, and validation thresholds.

---

## File Structure

- Create `scripts/chimer-preview-generation/preview-recipes.mjs`: pilot IDs, recipe schema, ladder presets, and lookup.
- Create `scripts/chimer-preview-generation/rendition-plan.mjs`: stable paths and one complete rendition work plan.
- Create `scripts/chimer-preview-generation/ffmpeg-plan.mjs`: deterministic FFmpeg argument builders for WebM, MP4, posters, natural loops, and crossfades.
- Create `scripts/chimer-preview-generation/media-validation.mjs`: decoded metadata, frame-variation, seam, and manifest completeness validation.
- Create `scripts/chimer-preview-generation/render-pilot.mjs`: isolated pilot CLI orchestration using shared helpers and the current capture surface.
- Create `scripts/chimer-preview-generation/rendition-manifest-module.mjs`: deterministic JSON and TypeScript sidecar serialization.
- Create `components/backgrounds/backgroundPreviewRenditionManifest.ts`: generated v2 pilot types, URL resolution, and pilot entries.
- Create `public/chimer/background-preview-pilot/index.json`: local text manifest; pilot video/poster files remain ignored.
- Modify `.gitignore`: ignore generated pilot WebM, MP4, WebP, PNG, raw frame, and master files while retaining `index.json`.
- Create `app/dev/bgpreviews/page.tsx`: development-only review route.
- Create `app/dev/bgpreviews/preview-pilot-review.tsx`: synchronized pilot review client.
- Create `app/dev/bgpreviews/preview-pilot-review.module.css`: bounded review layout.
- Create `tests/background-preview-recipes.test.mjs`: recipe, ladder, path, and manifest-domain tests.
- Create `tests/background-preview-encoding.test.mjs`: FFmpeg-plan and validation tests.
- Create `tests/browser/background-preview-pilot.spec.ts`: development-route visual/runtime proof.
- Modify `package.json`: add `chimer:preview:pilot` and `chimer:preview:pilot:validate`.
- Modify `docs/project-log.md`: record pilot readiness or visual approval accurately.
- Modify `docs/project-state.md`: only after the user approves frozen presets; do not claim full-catalog rollout.

### Task 1: Define the recipe and rendition-ladder domain

**Files:**
- Create: `scripts/chimer-preview-generation/preview-recipes.mjs`
- Create: `tests/background-preview-recipes.test.mjs`

**Interfaces:**
- Produces: `PREVIEW_ASPECTS`, `PREVIEW_QUALITIES`, `PREVIEW_CODECS`, `PREVIEW_RENDITION_LADDER`, `PILOT_BACKGROUND_IDS`, `backgroundPreviewRecipes`, `getBackgroundPreviewRecipe(backgroundId)`, and `validateBackgroundPreviewRecipe(recipe)`.
- Consumed by: Tasks 2, 3, 5, 6, and the later adaptive-runtime plan.

- [ ] **Step 1: Write failing recipe and ladder tests**

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PILOT_BACKGROUND_IDS,
  PREVIEW_ASPECTS,
  PREVIEW_CODECS,
  PREVIEW_QUALITIES,
  PREVIEW_RENDITION_LADDER,
  getBackgroundPreviewRecipe,
  validateBackgroundPreviewRecipe,
} from "../scripts/chimer-preview-generation/preview-recipes.mjs"

describe("background preview recipes", () => {
  it("locks the approved pilot and three-by-three rendition ladder", () => {
    assert.equal(PILOT_BACKGROUND_IDS.length, 8)
    assert.deepEqual(PREVIEW_ASPECTS, ["landscape", "square", "vertical"])
    assert.deepEqual(PREVIEW_QUALITIES, ["low", "standard", "high"])
    assert.deepEqual(PREVIEW_CODECS, ["vp9", "h264"])
    assert.deepEqual(PREVIEW_RENDITION_LADDER.vertical, {
      low: { width: 216, height: 384 },
      standard: { width: 360, height: 640 },
      high: { width: 540, height: 960 },
    })
  })

  it("keeps every pilot recipe bounded and passive", () => {
    for (const id of PILOT_BACKGROUND_IDS) {
      const recipe = getBackgroundPreviewRecipe(id)
      assert.equal(recipe.backgroundId, id)
      assert.deepEqual(validateBackgroundPreviewRecipe(recipe), [])
      assert.ok(recipe.durationMs >= 6000 && recipe.durationMs <= 18000)
      assert.equal(recipe.passiveCaptureState, "default")
    }
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `node --test tests/background-preview-recipes.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the frozen dimension ladder and candidate recipes**

```js
export const PREVIEW_ASPECTS = Object.freeze(["landscape", "square", "vertical"])
export const PREVIEW_QUALITIES = Object.freeze(["low", "standard", "high"])
export const PREVIEW_CODECS = Object.freeze(["vp9", "h264"])

export const PREVIEW_RENDITION_LADDER = Object.freeze({
  landscape: Object.freeze({
    low: Object.freeze({ width: 384, height: 216 }),
    standard: Object.freeze({ width: 640, height: 360 }),
    high: Object.freeze({ width: 960, height: 540 }),
  }),
  square: Object.freeze({
    low: Object.freeze({ width: 256, height: 256 }),
    standard: Object.freeze({ width: 512, height: 512 }),
    high: Object.freeze({ width: 768, height: 768 }),
  }),
  vertical: Object.freeze({
    low: Object.freeze({ width: 216, height: 384 }),
    standard: Object.freeze({ width: 360, height: 640 }),
    high: Object.freeze({ width: 540, height: 960 }),
  }),
})

export const PILOT_BACKGROUND_IDS = Object.freeze([
  "massage-lab-moving-gradient", "massage-lab-silk", "massage-lab-wave-current",
  "massage-lab-dna", "massage-lab-twisted-cubes", "massage-lab-galaxy",
  "massage-lab-faulty-terminal", "massage-lab-tile-grid",
])

const recipe = (backgroundId, durationMs, posterTimeMs, loopStrategy, crossfadeMs, fps) => Object.freeze({
  backgroundId, recipeRevision: "recipe-1", warmupMs: 2200, durationMs,
  posterTimeMs, loopStrategy, crossfadeMs, fps, passiveCaptureState: "default",
  framing: Object.freeze({ landscape: null, square: null, vertical: null }),
})

export const backgroundPreviewRecipes = Object.freeze({
  "massage-lab-moving-gradient": recipe("massage-lab-moving-gradient", 12000, 4000, "crossfade", 900, 24),
  "massage-lab-silk": recipe("massage-lab-silk", 10000, 3333, "crossfade", 800, 24),
  "massage-lab-wave-current": recipe("massage-lab-wave-current", 10000, 3333, "crossfade", 800, 24),
  "massage-lab-dna": recipe("massage-lab-dna", 18000, 6000, "crossfade", 1000, 24),
  "massage-lab-twisted-cubes": recipe("massage-lab-twisted-cubes", 12000, 4000, "natural", 0, 24),
  "massage-lab-galaxy": recipe("massage-lab-galaxy", 12000, 4000, "crossfade", 900, 30),
  "massage-lab-faulty-terminal": recipe("massage-lab-faulty-terminal", 8000, 2667, "crossfade", 600, 30),
  "massage-lab-tile-grid": recipe("massage-lab-tile-grid", 12000, 4000, "crossfade", 900, 24),
})
```

`validateBackgroundPreviewRecipe` must return ordered diagnostics for unknown IDs, invalid revision format, duration outside 6-18 seconds, poster outside the final duration, unsupported loop strategy, missing/oversized crossfade, invalid fps, non-default interaction state, or missing aspect framing keys.

- [ ] **Step 4: Run the recipe tests**

Run: `node --test tests/background-preview-recipes.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the recipe domain**

```bash
git add scripts/chimer-preview-generation/preview-recipes.mjs tests/background-preview-recipes.test.mjs
git commit -m "Add per-background preview recipe domain"
```

### Task 2: Build stable asset paths and the v2 manifest domain

**Files:**
- Create: `scripts/chimer-preview-generation/rendition-plan.mjs`
- Modify: `tests/background-preview-recipes.test.mjs`

**Interfaces:**
- Consumes: a validated recipe and `PREVIEW_RENDITION_LADDER`.
- Produces: `buildPreviewAssetRelativePath(input): string`, `buildBackgroundRenditionPlan(recipe): RenditionWorkItem[]`, and `buildPilotManifestEntry({ recipe, renditions, posters })`.
- `RenditionWorkItem`: `{ backgroundId, recipeRevision, aspect, quality, codec, width, height, fps, relativePath, mimeType }`.

- [ ] **Step 1: Add failing path and cardinality tests**

```js
import {
  buildBackgroundRenditionPlan,
  buildPreviewAssetRelativePath,
} from "../scripts/chimer-preview-generation/rendition-plan.mjs"

it("uses stable IDs and recipe revisions in asset paths", () => {
  assert.equal(buildPreviewAssetRelativePath({
    backgroundId: "massage-lab-wave-current", recipeRevision: "recipe-2",
    aspect: "vertical", quality: "high", codec: "vp9",
  }), "massage-lab-wave-current/recipe-2/vertical/high.webm")
})

it("plans eighteen video renditions per recipe", () => {
  const plan = buildBackgroundRenditionPlan(getBackgroundPreviewRecipe("massage-lab-silk"))
  assert.equal(plan.length, 18)
  assert.equal(new Set(plan.map(({ relativePath }) => relativePath)).size, 18)
})
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `node --test tests/background-preview-recipes.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement stable path and work-plan builders**

```js
const CODEC_OUTPUT = Object.freeze({
  vp9: Object.freeze({ extension: "webm", mimeType: "video/webm; codecs=vp9" }),
  h264: Object.freeze({ extension: "mp4", mimeType: "video/mp4; codecs=avc1.42E01E" }),
})

export function buildPreviewAssetRelativePath({ backgroundId, recipeRevision, aspect, quality, codec }) {
  const output = CODEC_OUTPUT[codec]
  if (!output) throw new Error(`Unsupported preview codec: ${codec}`)
  return `${backgroundId}/${recipeRevision}/${aspect}/${quality}.${output.extension}`
}

export function buildBackgroundRenditionPlan(recipe) {
  return PREVIEW_ASPECTS.flatMap((aspect) => PREVIEW_QUALITIES.flatMap((quality) =>
    PREVIEW_CODECS.map((codec) => ({
      backgroundId: recipe.backgroundId,
      recipeRevision: recipe.recipeRevision,
      aspect,
      quality,
      codec,
      ...PREVIEW_RENDITION_LADDER[aspect][quality],
      fps: recipe.fps,
      relativePath: buildPreviewAssetRelativePath({ ...recipe, aspect, quality, codec }),
      mimeType: CODEC_OUTPUT[codec].mimeType,
    })),
  ))
}
```

- [ ] **Step 4: Add manifest-entry assertions**

Test that `buildPilotManifestEntry` rejects missing posters, a missing codec/tier/aspect, mixed durations, mixed recipe revisions, duplicate rendition keys, and paths containing the current display label.

- [ ] **Step 5: Run the focused tests**

Run: `node --test tests/background-preview-recipes.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the rendition domain**

```bash
git add scripts/chimer-preview-generation/rendition-plan.mjs tests/background-preview-recipes.test.mjs
git commit -m "Add stable preview rendition planning"
```

### Task 3: Add deterministic FFmpeg plans for both codecs and loop strategies

**Files:**
- Create: `scripts/chimer-preview-generation/ffmpeg-plan.mjs`
- Create: `tests/background-preview-encoding.test.mjs`

**Interfaces:**
- Produces: `buildNaturalVideoArgs(input): string[]`, `buildCrossfadeVideoArgs(input): string[]`, `buildPosterArgs(input): string[]`, and `buildRenditionEncodeArgs(input): string[]`.
- Consumed by: `render-pilot.mjs` in Task 5.

- [ ] **Step 1: Write failing codec and transition argument tests**

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildRenditionEncodeArgs } from "../scripts/chimer-preview-generation/ffmpeg-plan.mjs"

describe("background preview encoding plans", () => {
  it("builds bounded VP9 output with Lanczos scaling", () => {
    const args = buildRenditionEncodeArgs({
      inputPath: "master.webm", outputPath: "high.webm", codec: "vp9",
      width: 540, height: 960, fps: 24, durationMs: 10000,
      loopStrategy: "natural", crossfadeMs: 0,
    })
    assert.deepEqual(args.slice(-12), [
      "-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "2",
      "-crf", "30", "-b:v", "0", "-an", "high.webm",
    ])
    assert.ok(args.includes("fps=24,scale=540:960:flags=lanczos,format=yuv420p"))
  })

  it("uses libx264 fast-start output for compatibility renditions", () => {
    const args = buildRenditionEncodeArgs({
      inputPath: "master.webm", outputPath: "standard.mp4", codec: "h264",
      width: 640, height: 360, fps: 24, durationMs: 10000,
      loopStrategy: "crossfade", crossfadeMs: 800,
    })
    assert.ok(args.includes("libx264"))
    assert.ok(args.includes("+faststart"))
    assert.match(args[args.indexOf("-filter_complex") + 1], /xfade=transition=fade:duration=0\.800/)
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `node --test tests/background-preview-encoding.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement argument builders with one shared prefilter**

The natural filter is:

```js
const baseFilter = `fps=${fps},scale=${width}:${height}:flags=lanczos,format=yuv420p`
```

The crossfade builder must trim the authored capture, split it, blend the declared ending interval with frames from the declared beginning interval, and return one stream whose probed final duration becomes the manifest duration. Keep the filter in one helper and test the computed seconds and output label; do not duplicate the filter between codecs.

Codec suffixes are exact:

```js
const codecArgs = codec === "vp9"
  ? ["-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "2", "-crf", "30", "-b:v", "0"]
  : ["-c:v", "libx264", "-preset", "slow", "-crf", "21", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
```

- [ ] **Step 4: Add poster argument coverage**

Test and implement `buildPosterArgs` so it seeks to `posterTimeMs`, reads from the high-quality master, emits exactly one `libwebp` frame at quality 84, scales to the high aspect dimensions, and fails if the poster time is outside the authored duration.

- [ ] **Step 5: Run the encoding-plan tests**

Run: `node --test tests/background-preview-encoding.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the encoding domain**

```bash
git add scripts/chimer-preview-generation/ffmpeg-plan.mjs tests/background-preview-encoding.test.mjs
git commit -m "Add adaptive preview encoding plans"
```

### Task 4: Prove decoded animation, seams, and manifest completeness

**Files:**
- Create: `scripts/chimer-preview-generation/media-validation.mjs`
- Modify: `tests/background-preview-encoding.test.mjs`

**Interfaces:**
- Produces: `parseMediaProbe(result, path)`, `validateRenditionMetadata(actual, expected): string[]`, `calculateFrameVariation(frameHashes): number`, `validateAnimatedFrameVariation(input): string[]`, `validateLoopSeam(input): string[]`, and `validatePilotManifest(entries): string[]`.

- [ ] **Step 1: Add failing decoded-frame tests**

```js
import {
  calculateFrameVariation,
  validateAnimatedFrameVariation,
  validateLoopSeam,
} from "../scripts/chimer-preview-generation/media-validation.mjs"

it("rejects animated captures whose sampled decoded frames are identical", () => {
  assert.equal(calculateFrameVariation(["a", "a", "a", "a"]), 0)
  assert.deepEqual(validateAnimatedFrameVariation({
    backgroundId: "animated", motionIntensity: "medium", frameHashes: ["a", "a", "a", "a"],
  }), ["animated: decoded samples did not prove animation"])
})

it("applies different seam limits to natural and crossfade loops", () => {
  assert.deepEqual(validateLoopSeam({ strategy: "natural", normalizedDifference: 0.02 }), [])
  assert.deepEqual(validateLoopSeam({ strategy: "natural", normalizedDifference: 0.25 }), [
    "natural loop seam difference 0.250 exceeds 0.080",
  ])
  assert.deepEqual(validateLoopSeam({ strategy: "crossfade", normalizedDifference: 0.09 }), [])
})
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `node --test tests/background-preview-encoding.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement fail-closed validation helpers**

Use FFprobe JSON for codec, pixel format, dimensions, duration, average frame rate, and stream count. Sample at least the first, 25%, 50%, 75%, and final safe frame. Hash raw downscaled RGB samples for variation, and compute a normalized first/last pixel difference for seam evidence. Natural-loop maximum difference is `0.080`; crossfade maximum is `0.120`. These are rejection thresholds, not claims of visual approval.

- [ ] **Step 4: Add complete-manifest tests**

Build a synthetic entry and prove `validatePilotManifest` requires exactly 18 unique renditions, three posters, one recipe revision, one duration per aspect, supported MIME/codec pairs, positive bytes, 64-character lowercase SHA-256 values, and filenames rooted at the stable ID/revision.

- [ ] **Step 5: Run validation tests**

Run: `node --test tests/background-preview-encoding.test.mjs tests/background-preview-recipes.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit media validation**

```bash
git add scripts/chimer-preview-generation/media-validation.mjs tests/background-preview-encoding.test.mjs
git commit -m "Validate decoded preview media and loop seams"
```

### Task 5: Orchestrate isolated pilot capture without touching production media

**Files:**
- Create: `scripts/chimer-preview-generation/render-pilot.mjs`
- Modify: `package.json`
- Modify: `tests/background-preview-recipes.test.mjs`

**Interfaces:**
- Consumes: current capture route, recipe registry, rendition plan, FFmpeg plans, and media validation.
- Produces: `npm run chimer:preview:pilot -- --output-dir <absolute-temp-path> [--ids <csv>] [--force]`, local media, `index.json`, decoded frame strips, and `validation.json`.

- [ ] **Step 1: Add source-contract tests for safe defaults**

```js
it("keeps pilot output explicit and refuses the production preview directory", () => {
  const source = readFileSync(new URL(
    "../scripts/chimer-preview-generation/render-pilot.mjs", import.meta.url,
  ), "utf8")
  assert.match(source, /--output-dir/)
  assert.match(source, /output directory is required/i)
  assert.match(source, /public[\\/]chimer[\\/]background-previews/)
  assert.match(source, /refusing production preview directory/i)
  assert.doesNotMatch(source, /backgroundPreviewManifest\.ts/)
})
```

- [ ] **Step 2: Run the source-contract test and verify failure**

Run: `node --test tests/background-preview-recipes.test.mjs`
Expected: FAIL because `render-pilot.mjs` is missing.

- [ ] **Step 3: Implement bounded CLI parsing and safety checks**

The CLI requires an explicit output directory, resolves it to an absolute path, rejects the repo's production preview directory, restricts IDs to `PILOT_BACKGROUND_IDS`, and refuses an empty selection. `--force` may overwrite only files beneath the verified pilot output root.

- [ ] **Step 4: Reuse the current server and capture lifecycle**

Extract no unrelated server refactor. Copy only the proven `waitForServer`, Next-indicator suppression, production capture-route navigation, readiness checks, and Playwright context cleanup into focused helpers if sharing them with `render.mjs` reduces duplication. Record masters at the high dimensions for each aspect, with `warmupMs + durationMs + crossfadeMs` available to the encoder.

- [ ] **Step 5: Encode and validate one aspect before continuing**

For each background/aspect: capture master, create poster, encode six renditions, probe and decode them, write evidence, then continue. A failed background/aspect leaves diagnostics but does not publish a partial manifest entry.

- [ ] **Step 6: Add the npm scripts**

```json
"chimer:preview:pilot": "node --experimental-strip-types scripts/chimer-preview-generation/render-pilot.mjs",
"chimer:preview:pilot:validate": "node scripts/chimer-preview-generation/render-pilot.mjs --validate-only"
```

The validate-only mode also requires `--output-dir` and performs no browser or FFmpeg mutation.

- [ ] **Step 7: Run focused source tests**

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs tests/background-preview-media.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit pilot orchestration**

```bash
git add package.json scripts/chimer-preview-generation/render-pilot.mjs tests/background-preview-recipes.test.mjs
git commit -m "Add isolated adaptive preview pilot renderer"
```

### Task 6: Generate a typed sidecar manifest without changing production v1

**Files:**
- Create: `scripts/chimer-preview-generation/rendition-manifest-module.mjs`
- Modify: `scripts/chimer-preview-generation/render-pilot.mjs`
- Create: `components/backgrounds/backgroundPreviewRenditionManifest.ts`
- Create: `public/chimer/background-preview-pilot/index.json`
- Modify: `.gitignore`
- Modify: `tests/background-preview-recipes.test.mjs`

**Interfaces:**
- Produces: `BackgroundPreviewAspect`, `BackgroundPreviewQuality`, `BackgroundPreviewCodec`, `BackgroundPreviewRendition`, `BackgroundPreviewPoster`, `BackgroundPreviewRenditionEntry`, `backgroundPreviewRenditionManifest`, and `resolvePreviewRenditionUrl(url)`.
- Consumed by: the review route and the adaptive-runtime plan.

- [ ] **Step 1: Add a failing type/source contract**

```js
it("generates a v2 sidecar without replacing the production manifest", () => {
  const source = readFileSync(new URL(
    "../components/backgrounds/backgroundPreviewRenditionManifest.ts", import.meta.url,
  ), "utf8")
  assert.match(source, /export type BackgroundPreviewQuality = "low" \| "standard" \| "high"/)
  assert.match(source, /export type BackgroundPreviewCodec = "vp9" \| "h264"/)
  assert.match(source, /renditions: readonly BackgroundPreviewRendition\[\]/)
  assert.match(source, /posters: Record<BackgroundPreviewAspect, BackgroundPreviewPoster>/)
})
```

- [ ] **Step 2: Run the test and verify the missing file failure**

Run: `node --test tests/background-preview-recipes.test.mjs`
Expected: FAIL with file-not-found.

- [ ] **Step 3: Implement deterministic JSON and TypeScript serialization**

```ts
export type BackgroundPreviewAspect = "landscape" | "square" | "vertical"
export type BackgroundPreviewQuality = "low" | "standard" | "high"
export type BackgroundPreviewCodec = "vp9" | "h264"

export type BackgroundPreviewRendition = {
  aspect: BackgroundPreviewAspect
  quality: BackgroundPreviewQuality
  codec: BackgroundPreviewCodec
  url: string
  mimeType: string
  width: number
  height: number
  durationMs: number
  fps: number
  bytes: number
  sha256: string
}

export type BackgroundPreviewPoster = {
  url: string
  width: number
  height: number
  bytes: number
  sha256: string
}

export type BackgroundPreviewRenditionEntry = {
  backgroundId: string
  recipeRevision: string
  loopStrategy: "natural" | "crossfade"
  loopBoundaryMs: number
  renditions: readonly BackgroundPreviewRendition[]
  posters: Record<BackgroundPreviewAspect, BackgroundPreviewPoster>
}
```

`serializeRenditionManifest(entries)` must sort entries by background ID and renditions by aspect, quality, then codec. `renderRenditionManifestModule(entries)` emits the types above plus:

```ts
export const backgroundPreviewRenditionManifest: Readonly<Record<string, BackgroundPreviewRenditionEntry>> = Object.freeze({})
```

The initial checked-in object is empty and the development route shows explicit missing-pilot evidence. Task 8 replaces the empty object and index with validated text metadata after local generation. Generated URLs remain local under `/chimer/background-preview-pilot/`; do not add hosted R2 guessing.

Update `render-pilot.mjs` so a successful complete render or validate-only pass calls the same serializer for `index.json`; when `--write-module` is supplied, it also writes the TypeScript module. Refuse `--write-module` unless the manifest passes `validatePilotManifest`.

- [ ] **Step 4: Ignore generated pilot binaries while retaining text evidence**

Add exact `.gitignore` rules for `public/chimer/background-preview-pilot/**/*.webm`, `*.mp4`, `*.webp`, `*.png`, `*.rgb`, and `*.master.*`. Do not ignore `public/chimer/background-preview-pilot/index.json`.

- [ ] **Step 5: Run type and focused tests**

Run: `npm run typecheck`
Expected: PASS.

Run: `node --test tests/background-preview-recipes.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the sidecar contract and empty text manifest**

```bash
git add .gitignore scripts/chimer-preview-generation/rendition-manifest-module.mjs components/backgrounds/backgroundPreviewRenditionManifest.ts public/chimer/background-preview-pilot/index.json tests/background-preview-recipes.test.mjs
git commit -m "Add typed adaptive preview pilot manifest"
```

### Task 7: Build the development-only pilot review route

**Files:**
- Create: `app/dev/bgpreviews/page.tsx`
- Create: `app/dev/bgpreviews/preview-pilot-review.tsx`
- Create: `app/dev/bgpreviews/preview-pilot-review.module.css`
- Create: `tests/browser/background-preview-pilot.spec.ts`
- Modify: `tests/background-preview-recipes.test.mjs`

**Interfaces:**
- Consumes: `backgroundPreviewRenditionManifest` and local evidence files.
- Produces: `/dev/bgpreviews`, unavailable in Production, with background/aspect selectors, synchronized tiers/codecs, posters, replay, file metadata, frame strips, and validation diagnostics.

- [ ] **Step 1: Add a failing development-route source test**

```js
it("keeps the pilot review route development-only", () => {
  const source = readFileSync(new URL("../app/dev/bgpreviews/page.tsx", import.meta.url), "utf8")
  assert.match(source, /process\.env\.NODE_ENV === "production"/)
  assert.match(source, /notFound\(\)/)
  assert.match(source, /robots:\s*\{[\s\S]*index:\s*false[\s\S]*follow:\s*false/)
})
```

- [ ] **Step 2: Run the source test and verify file-not-found**

Run: `node --test tests/background-preview-recipes.test.mjs`
Expected: FAIL with file-not-found.

- [ ] **Step 3: Implement the guarded page and bounded review grid**

The page follows `app/dev/buttons/page.tsx`: call `notFound()` in Production, set noindex/nofollow metadata, and use `AppPageShell`. The client defaults to the first pilot background and vertical aspect. It renders six muted synchronized videos (three qualities by two codecs), one poster, bytes/dimensions/fps/duration, loop strategy, validation status, and decoded-frame strips.

- [ ] **Step 4: Add explicit review controls**

Add background and aspect selectors, Play/Pause all, Restart at loop boundary, Mute (locked on), and a natural/crossfade comparison only when the evidence directory contains both approved candidate outputs. No control edits recipes from the browser.

- [ ] **Step 5: Add browser proof**

```ts
import { expect, test } from "@playwright/test"

test("preview pilot compares complete synchronized renditions", async ({ page }) => {
  await page.goto("/dev/bgpreviews")
  const review = page.getByTestId("background-preview-pilot-review")
  await expect(review).toBeVisible()
  await expect(review.locator("video")).toHaveCount(6)
  await expect(review.getByText(/VP9.*Low/i)).toBeVisible()
  await expect(review.getByText(/H\.264.*High/i)).toBeVisible()
  await expect(review.getByText(/Loop strategy/i)).toBeVisible()
})
```

- [ ] **Step 6: Run focused browser proof**

Run: `npm run test:browser -- --project=desktop-chromium tests/browser/background-preview-pilot.spec.ts`
Expected: PASS when the local pilot output is present; otherwise the route must show an explicit missing-pilot-evidence notice and the test fixture supplies deterministic small media.

- [ ] **Step 7: Commit the review route**

```bash
git add app/dev/bgpreviews tests/background-preview-recipes.test.mjs tests/browser/background-preview-pilot.spec.ts
git commit -m "Add adaptive preview pilot review route"
```

### Task 8: Generate, validate, and obtain visual pilot approval

**Files:**
- Modify: `docs/project-log.md`
- Modify: `docs/project-state.md` only after approval

**Interfaces:**
- Consumes: the complete pilot toolchain and the user-approved design.
- Produces: local pilot evidence, frozen v1 ladder presets, and a user approval gate; no remote media.

- [ ] **Step 1: Verify FFmpeg capabilities**

Run: `ffmpeg -hide_banner -encoders`
Expected: available `libvpx-vp9`, `libx264`, and `libwebp` encoders. If an encoder is absent, stop and report the environment gap; do not silently omit a codec.

- [ ] **Step 2: Render into a verified disposable output root**

Run: `npm run chimer:preview:pilot -- --output-dir public/chimer/background-preview-pilot --write-module components/backgrounds/backgroundPreviewRenditionManifest.ts --force`
Expected: eight backgrounds, three aspects, 144 videos, 24 posters, one manifest, decoded-frame strips, and validation evidence. The command must not write the production preview directory.

- [ ] **Step 3: Validate the complete output independently**

Run: `npm run chimer:preview:pilot:validate -- --output-dir public/chimer/background-preview-pilot`
Expected: PASS with no incomplete rendition set, decode error, static animated capture, dimension mismatch, duration mismatch, hash mismatch, or seam threshold failure.

- [ ] **Step 4: Run repository validation**

Run: `node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs tests/background-preview-media.test.mjs tests/background-options.test.mjs`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `git diff --check`
Expected: PASS.

- [ ] **Step 5: Open the local review route and present the visual matrix**

Review every pilot background in landscape, square, and vertical. Compare low/standard/high, both codecs, posters, loop boundaries, file sizes, and decoded-frame strips. Record requested recipe or preset corrections in the recipe registry, regenerate only affected pilot entries with `--ids`, and repeat full validation.

- [ ] **Step 6: Stop for explicit user approval**

Do not freeze presets, update canonical state, plan full-catalog generation, or upload media until the user explicitly accepts the pilot's quality, duration, framing, and loop behavior.

- [ ] **Step 7: Freeze the validated text manifest and record approved pilot values**

After approval, rerun validate-only with `--write-module components/backgrounds/backgroundPreviewRenditionManifest.ts` to regenerate `public/chimer/background-preview-pilot/index.json` and the TypeScript module from the accepted output, then update `docs/project-log.md` and `docs/project-state.md` with the exact approved recipe revision, dimension ladder, codec settings, fps rules, seam thresholds, validation results, and the fact that full-catalog generation/publication remains unstarted.

- [ ] **Step 8: Commit approved source and documentation only**

```bash
git add scripts/chimer-preview-generation components/backgrounds/backgroundPreviewRenditionManifest.ts app/dev/bgpreviews tests package.json public/chimer/background-preview-pilot/index.json docs/project-log.md docs/project-state.md
git commit -m "Approve adaptive background preview pilot"
```

Before committing, confirm `git status --short` contains no generated WebM, MP4, WebP, decoded frames, temporary masters, or local secrets.
