# Background Preview Publication And Adaptive Runtime Plan

> **Execution:** Use `superpowers:subagent-driven-development` task by task. The existing full-catalog worktree and branch remain the isolated workspace.

**Goal:** Promote the user-approved 84-background catalog from local review evidence into a safely publishable, poster-first adaptive preview runtime without uploading local masters or diagnostic artifacts and without allowing Production to reference media before hosted verification.

**Architecture:** Preserve stable background IDs, the existing carousel controller, the production v1 fallback, and all three generated aspect shapes. Record the completed visual approval in the recipe/catalog metadata, derive an immutable R2 allowlist exclusively from approved manifest references, and generate a compact published-manifest artifact for runtime use. The production carousel stays poster-only until the user selects one carousel-wide Play Preview control; then only the five mounted cards (center plus two on either side) may each request one vertical rendition. Initial quality follows the current connection, codec is chosen once from browser support, and later connection changes become pending changes applied only on the video's real loop-boundary `ended` event.

## Global Constraints

- Keep all 84 existing background IDs unchanged.
- Treat the user's 2026-08-07 approval of all `/dev/bgpreviews?catalog=full` previews as the review gate for all 84 entries.
- Preserve the three aspect shapes, three quality tiers, and VP9/H.264 final renditions in the publication catalog.
- Publish only the 1,728 manifest-referenced media objects: 1,476 videos and 252 posters totaling 862,078,635 bytes. Never select encoder masters, frame strips, validation evidence, checkpoints, or the local review manifest for media upload.
- Use an immutable release prefix derived from the approved catalog revision under `chimer/background-preview-catalog/`; never overwrite the production v1 prefix.
- Reuse the configured `massagelab-public-media` bucket and `https://media.massagelab.app` custom domain. Reject `r2.dev`, non-HTTPS public bases, and arbitrary object prefixes in the catalog publisher.
- Media objects use `public, max-age=31536000, immutable`. Do not upload mutable metadata as part of the 1,728-object media operation.
- A dry run must require no R2 credentials and must emit an exact machine-readable object/byte/type/cache plan. A live upload remains a separate explicit approval gate.
- Production must retain v1 assets unless a hosted, verified catalog base URL is configured. Local development may use the checked-out catalog directory.
- Poster-only entries never create video elements.
- Poster is the default for every card. One carousel-wide `Play Preview` / `Pause Previews` control governs preview motion and defaults off on each mount.
- Play Preview may activate only non-shell cards in the existing radius-two window: no more than five video elements.
- The production card remains vertical. The other two aspect shapes stay published for other/future consumers but are not fetched by this card.
- Each active card exposes only one video `src`; alternate aspects, qualities, and codecs must not appear in the DOM.
- Initial quality policy: Save-Data, `slow-2g`, or `2g` selects low; `3g` selects standard; `4g` selects high; unavailable Network Information selects standard.
- Prefer VP9 when `canPlayType` reports support, otherwise H.264; if neither works, remain on the poster. An asset error may try the other codec for the same aspect/quality, then fall back to the poster.
- Connection changes while playing update only a pending quality. Remove native `loop`; apply the pending rendition on `ended`, or restart the same rendition at that boundary. A brief poster while the new rendition starts is acceptable and avoids preloading a second video.
- Reduced motion, an inactive panel, a hidden document, Pause Previews, or absent hosted catalog configuration must remain poster-only.
- Add focused JSDoc/comments for approval promotion, manifest-only selection, immutable publication boundaries, connection-quality mapping, codec selection, and loop-boundary switching.
- Preserve unrelated local work and generated binaries. Do not run a live R2 upload or mutate Vercel/Production in this plan without explicit user authorization at the publication gate.

### Task 1: Promote the fully reviewed catalog to approved metadata

**Files:**
- Modify: `data/background-preview-recipes.json`
- Modify: `scripts/chimer-preview-generation/rendition-manifest-module.mjs`
- Modify: `public/chimer/background-preview-catalog/index.json`
- Modify: `tests/background-preview-recipes.test.mjs`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Requirements:**

- Change every recipe and manifest entry to `reviewStatus: "approved"` without changing any recipe settings, rendition metadata, URLs, hashes, or bytes.
- Promote the revision from `catalog-candidate-1` to `catalog-approved-1` through the serializer rather than a one-off output-only edit.
- Make publication serialization use `requireApproved: true` and fail closed if any candidate reappears.
- Lock exact approval count 84, animated count 82, poster-only count 2, video count 1,476, poster count 252, referenced-object count 1,728, and referenced bytes 862,078,635 in focused tests.
- Correct the canonical state: all 84 previews are visually approved; 822.1 MiB is the publishable payload and the remaining 577.5 MiB of the 1.367 GiB local directory is generation/validation material.

**Validation:**

```powershell
node --test tests/background-preview-recipes.test.mjs tests/background-preview-encoding.test.mjs
npm run chimer:preview:catalog:validate
git diff --check
```

### Task 2: Add a manifest-only immutable R2 publication planner

**Files:**
- Create: `scripts/chimer-preview-generation/catalog-r2-publication.mjs`
- Create: `scripts/chimer-preview-generation/catalog-r2-upload.mjs`
- Create: `tests/chimer-preview-catalog-r2-upload.test.mjs`
- Modify: `package.json`
- Modify: `docs/wiki/deployment.md`

**Requirements:**

- Load the approved schema-v3 catalog and construct a unique POSIX relative-path allowlist only from rendition and poster URLs.
- Reject absolute URLs, traversal, backslashes, duplicate paths, unknown extensions, candidate entries, a non-approved revision, missing files, byte mismatches, and SHA-256 mismatches before any upload.
- Require exactly 1,728 objects and 862,078,635 bytes for `catalog-approved-1`.
- Map `.webm` to `video/webm`, `.mp4` to `video/mp4`, and `.webp` to `image/webp` with immutable media caching.
- Fix the release prefix to `chimer/background-preview-catalog/catalog-approved-1`. Do not accept an arbitrary catalog object-prefix override.
- Reuse `readAtmospherePublicMediaR2Env`, `publicUrlForR2Object`, `missingAtmosphereR2UploadEnv`, and `putAtmosphereObjectToR2`.
- Add `check`, mutation-free `upload --dry-run`, and separately gated live `upload` behavior. The dry run emits an exact summary and works without credentials; live mode fails before its first PUT if configuration or local validation is incomplete.
- Add package commands `chimer:preview:catalog:r2:check` and `chimer:preview:catalog:r2:upload`.
- Tests use small synthetic fixtures for failure cases and may use the real ignored local catalog only for an opt-in/existing-worktree exact dry run. They must prove diagnostic artifacts cannot enter the plan.

**Validation:**

```powershell
node --test tests/chimer-preview-catalog-r2-upload.test.mjs tests/chimer-preview-r2-upload.test.mjs
npm run chimer:preview:catalog:r2:check
npm run chimer:preview:catalog:r2:upload -- --dry-run --public-base-url https://media.massagelab.app
git diff --check
```

### Task 3: Generate a compact approved runtime manifest and pure selector

**Files:**
- Create: `scripts/chimer-preview-generation/published-runtime-manifest.mjs`
- Create: `data/background-preview-published-manifest.json`
- Create: `components/backgrounds/backgroundPreviewPublishedManifest.ts`
- Create: `lib/background-preview-runtime.js`
- Create: `tests/background-preview-runtime.test.mjs`
- Modify: `package.json`

**Requirements:**

- Generate the tracked runtime artifact from the approved schema-v3 manifest; never hand-maintain the 84-entry lookup.
- Retain stable ID, media kind, loop boundary, three posters, and all rendition aspect/quality/codec URLs plus MIME types. Omit review-only hashes, byte counts, batch labels, and diagnostic metadata from the browser artifact.
- Fail closed unless all 84 entries are approved and the exact cardinality matches Task 1.
- Resolve hosted URLs only when `NEXT_PUBLIC_CHIMER_PREVIEW_CATALOG_BASE_URL` is a valid HTTPS custom-domain base. In local development, support `/chimer/background-preview-catalog`; in Production without a configured base, return no catalog video and retain v1 fallback behavior.
- Export pure helpers for vertical poster lookup, connection-to-quality mapping, supported-codec choice, one-rendition selection, and same-aspect/same-codec pending-quality resolution.
- The selector returns at most one rendition and never returns alternate URLs.

**Validation:**

```powershell
node --test tests/background-preview-runtime.test.mjs tests/background-preview-recipes.test.mjs
npm run typecheck
git diff --check
```

### Task 4: Integrate poster-first, five-card, boundary-safe playback

**Files:**
- Modify: `components/backgrounds/BackgroundPreviewMedia.tsx`
- Modify: `components/backgrounds/background-carousel-card.tsx`
- Modify: `components/backgrounds/background-carousel.tsx`
- Modify: `tests/background-preview-media.test.mjs`
- Modify: `tests/adaptive-carousel.test.mjs`

**Requirements:**

- Add one accessible carousel-wide Play Preview toggle above the stage, default off, with `aria-pressed` and Play/Pause wording.
- When enabled, pass play intent to all five non-shell cards; do not restrict playback to the centered card.
- Strict catalog mode renders poster/fallback only until play intent and never mounts a video for poster-only entries.
- On activation, sample the connection and codec support once and mount one selected vertical video URL.
- Listen for Network Information changes only while relevant, store a pending quality, and leave the current source unchanged until `ended`.
- Remove native looping in strict catalog mode. At `ended`, either switch to the pending rendition or restart the current video. Keep visibility, inactive-panel, reduced-motion, play rejection, and asset-error cleanup safe.
- Preserve the existing legacy media URLs for v1 fallback when the published catalog base is unavailable, but keep the production carousel poster-first: v1 rows without posters show their registry fallback until Play Preview. Preserve the old auto-play behavior only for non-carousel development callers that do not opt into strict mode.

**Validation:**

```powershell
node --test tests/background-preview-media.test.mjs tests/background-preview-runtime.test.mjs tests/adaptive-carousel.test.mjs
npm run typecheck
npm run lint
git diff --check
```

### Task 5: Prove the production request budget and prepare the publication gate

**Files:**
- Create: `tests/browser/background-carousel-preview.spec.ts`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify as required: `playwright.config.ts`

**Requirements:**

- Browser coverage proves zero videos by default, no more than five after Play Preview, exactly one `src` per playing card, vertical-only selection, poster-only static behavior, zero players under reduced motion, hidden/inactive pause behavior, and no mid-loop source change after a simulated connection update.
- Prove the pending source changes only after `ended` and playback restarts from the boundary.
- Preserve the full-catalog review route's intentional six-rendition comparison behavior.
- Run the manifest-only real dry run and record its exact 1,728-object / 862,078,635-byte output. Do not live-upload.
- Record the remaining separately authorized sequence: live immutable upload, remote byte/hash/header verification, Production catalog-base configuration, deploy, and hosted carousel smoke/rollback.

**Validation:**

```powershell
npm run test:browser -- --project=desktop-chromium tests/browser/background-carousel-preview.spec.ts tests/browser/background-preview-pilot.spec.ts
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
git status --short
```

## Publication Gate

After Tasks 1-5 pass and review is clean, stop and present:

- the immutable prefix and public base;
- the exact allowlisted object count and bytes;
- the dry-run evidence;
- the remote verification and rollback commands;
- the fact that no live upload or Production configuration has occurred.

Only explicit user authorization after that report permits the live R2 upload and Production activation sequence.
