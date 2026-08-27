# AtmoShaper Signature Sounds Full-Pass Candidate Review Plan

**Goal:** Reclassify the complete local Signature Sounds inventory into an exhaustive, auditable review manifest and provide a development-only `/dev/candidates` page where every source remains visible, playable when the local root is configured, and locally reviewable without changing production catalog state.

**Architecture:** Keep the existing scan and production-candidate declaration authoritative for hashing and qualification. Add a separate discovery owner that combines the validated 3,693-file scan with an explicit review of all 100 top-level packs. Every scanned file must partition into proposed Moodist match, proposed Signature-only concept, excluded-with-reason, or unclassified. A generated repo-relative manifest feeds a server-rendered development page. A development-only, manifest-ID audio endpoint resolves files beneath a server-only local root, supports byte ranges, and never accepts a filesystem path from the browser. Browser-local decisions may be exported but never mutate the repository or production catalog.

**Tech Stack:** Node.js ES modules and built-in tests; JSON review rules and generated manifest; Next.js App Router server/client components; React local state and localStorage; guarded Node stream/Range handling; existing MassageLab AppPageShell/AppSurface/Button controls.

**Baseline/Authority Refs:** `AGENTS.md`; `docs/project-state.md`; `docs/project-log.md`; `docs/wiki/index.md`; `docs/wiki/atmosphere-audio.md`; `docs/superpowers/plans/2026-08-23-atmoshaper-signature-sound-catalog.md`; catalog commits `a5b0f0a2`, `9cce4abf`, `75b0f422`, `afb4e30c`, and `e0b5e77d`; the user correction that filename-level sources such as Footsteps In Snow and Walking On Stoney Pathway were omitted from the declaration-driven report.

**Compatibility Boundary:** Do not change the 84 Moodist identities, generated white/pink/brown noise, current qualification gates, audio provider/runtime, saved mixes, hosted manifests, R2, production routes, accepted UI worktree, or serving port 3012. No local source path may be serialized or sent to the browser. No audio may be copied, processed, encoded, uploaded, committed, or production-enabled. Candidate proposals remain pending until human review.

**TDD Route:**

- Mode: off.
- Decision: strict.
- Strict authority: explicit project request carried by the active catalog workstream.
- Test posture: strict RED tests for exhaustive discovery, safe ranged audio resolution, and the development-only review route before each production owner.
- Reason: this adds a data contract, a filesystem boundary, and a user-visible review route.
- Verification: focused producer/consumer tests, real-root deterministic regeneration, typecheck/lint/full test/build, and rendered local page review.

## Requirement Ready Check

- Requirement source: the user requested a full pass of Signature Sounds and a `/dev/candidates` review page.
- Scenario: locally review all possible catalog sources, including omissions from the original declaration, without qualifying or publishing them.
- Acceptance: all 100 packs and 3,693 audio files are accounted for; obvious omissions appear as proposals; every source remains reachable through a visible review state; the page supports search/filter/navigation, one audio player, local Keep/Maybe/Reject/notes, and JSON export; production and arbitrary-filesystem access fail closed.
- Open blocker questions: none. The page will use a server-only `ATMOSHAPER_SIGNATURE_SOUNDS_ROOT` environment variable and local-only review state.
- Decision: ready.

## Change Necessity and owner checks

- A static report cannot safely stream local audio or retain review decisions. Code change is necessary.
- Existing scan owner remains the complete hashed-inventory authority and will not absorb discovery/UI responsibilities.
- New discovery owner: `lib/atmoshaper/signature-sound-discovery.js` because the existing scanner is already large and qualification semantics must remain separate from filename/pack proposals.
- New audio boundary owner: `lib/atmoshaper/dev-candidate-audio.js` because safe root containment and Range parsing require direct tests independent of a Next route source check.
- New route/UI surfaces are justified by the requested review workflow and are production-404.
- Decision: add the two bounded owners and reuse existing scan/catalog/UI primitives.

## Complexity budget

- `signature-sound-scan.js` is already over the soft review threshold; no discovery logic is added there.
- Target discovery and audio helpers should remain below 500 maintained lines each.
- The client review component should remain below 600 lines and render one selected audio source rather than thousands of simultaneous media elements.
- The 100-pack rule declaration and generated 3,693-source manifest are data artifacts, not maintained logic.

## Files

- Create `data/atmoshaper/signature-sound-pack-reviews.json` — exact 100-pack review rules and file-specific overrides.
- Create `data/atmoshaper/signature-sound-review.json` — deterministic generated full-inventory review manifest.
- Create `lib/atmoshaper/signature-sound-discovery.js` — closed schemas, exhaustive partition, declaration annotations, fingerprints, and renderer input.
- Create `lib/atmoshaper/dev-candidate-audio.js` — manifest-bound root containment, metadata checks, MIME and byte-range resolution.
- Create `scripts/atmoshaper-signature-sound-discovery.mjs` and add `atmoshaper:sounds:discover` to `package.json`.
- Create `app/dev/candidates/page.tsx`, `candidate-review.tsx`, and `candidate-review.module.css`.
- Create `app/api/dev/atmoshaper-candidates/audio/[sourceId]/route.ts`.
- Create `tests/atmoshaper-signature-sound-discovery.test.mjs` and `tests/atmoshaper-dev-candidates.test.mjs`.
- Update `docs/wiki/atmosphere-audio.md`, `docs/project-state.md`, and `docs/project-log.md` after verified behavior exists.

## Task 1: Exhaustive discovery contract

1. Write fixture tests requiring closed pack-review schemas, exact scan-pack coverage, canonical Moodist mappings, stable source IDs/fingerprints, declaration annotations, and a four-way partition with no missing or duplicate scanned file.
2. Run the focused discovery test and record the expected RED for the missing owner/data.
3. Implement the minimum discovery owner and CLI wiring.
4. Run focused GREEN and adjacent catalog/audit tests.

## Task 2: Review all packs and generate the real manifest

1. Add tests that reject missing/extra pack reviews and require the known omitted snow, stoney-path, rain, Underground, grocery, train, fireworks, and utility recordings to appear as pending proposals.
2. Record RED against an incomplete rule declaration.
3. Classify all 100 packs explicitly; use file overrides for mixed packs and keep uncertain material visible as unclassified rather than silently excluding it.
4. Run the real read-only hash scan and explicitly write the generated review manifest in-repo.
5. Verify 100 packs, 3,693 sources, exact bucket totals, no absolute root, deterministic second regeneration, and no audio/binary output.

## Task 3: Guarded development audio endpoint

1. Write fixture tests for production denial, missing root, unknown manifest ID, traversal/canonical escape, size mismatch, full response, valid byte ranges, invalid ranges, MIME types, and no path leakage.
2. Record RED for the missing audio helper/route.
3. Implement the minimum helper and route using only manifest IDs and `ATMOSHAPER_SIGNATURE_SOUNDS_ROOT`.
4. Run focused GREEN and verify source files remain unchanged.

## Task 4: `/dev/candidates` review page

1. Write route/component contract tests requiring production `notFound`, noindex metadata, exhaustive summary counts, filters, previous/next navigation, one metadata-preloaded audio player, disabled/configuration state, local Keep/Maybe/Reject/notes, and JSON export.
2. Record RED for the missing page.
3. Implement the server page and client review component using existing application surfaces and controls.
4. Run focused GREEN, typecheck, and lint.
5. Start a separate local development server without touching port 3012; verify the rendered page, filtering, audio Range response, keyboard operation, narrow layout, and no document overflow.

## Task 5: Closeout

1. Update operational/current-state/history docs with corrected discovery semantics and review instructions.
2. Run focused and adjacent suites, full `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.
3. Confirm no media/binary, machine-absolute path, upload/runtime/provider, production route, push, or merge change.
4. Commit coherent verified slices locally and hand off the URL, environment command, manifest totals, validation receipts, and remaining human-review gate.

## Risks and retirement

- Filename and pack-name matches are proposals, never listening evidence. Uncertain files remain visible as unclassified.
- Browser audio access is retained only while the route is development-only, manifest-ID-only, and root-confined. Remove the endpoint when candidate listening is complete if no later local-review workflow needs it.
- Browser-local decisions are disposable review state. Promotion into `signature-sound-candidates.json` requires a separate reviewed import/curation step.
- If real inventory fingerprints change, regenerate the manifest and use a new localStorage review key rather than silently applying decisions to different files.

---

# 2026-08-24 approved follow-up: shared recording and concept review workspace

## Goal

Preserve every existing recording decision, recording note, concept strategy choice, group note, and safely derivable audition approval while splitting the heavy review page into a recording workflow and a concept workflow backed by one browser-local source of truth. Let a recording be included or removed independently for each concept, carry a concept-specific note, map to multiple existing concepts, or create a new local concept. Make the exact included recordings—not a coarse Keep/Maybe pool—the configuration that playback and approval bind to, and export the complete review as one deterministic JSON handoff.

## Architecture

Add one closed, fingerprint-bound review-workspace owner above the immutable discovery and curated-listening baselines. The workspace stores sparse recording edits, per-recording concept decisions, custom concepts, and group strategy reviews; selectors derive the effective concept membership and exact included source IDs from the immutable baselines plus those edits. A segment-level client provider owns localStorage migration, persistence, same-browser-tab state, and cross-tab storage reconciliation. `/dev/candidates` becomes a lightweight hub, `/dev/candidates/recordings` owns individual recording review and concept assignment, and `/dev/candidates/concepts` owns exact ingredient selection and audible strategy approval. Both workflows read and write the same workspace and export the same validated payload.

The existing v1 recording draft and v2 group review remain read-only migration inputs. First load creates v3 without deleting or rewriting either legacy key. The current v2 group validator remains only as the legacy compatibility owner; all new writes and exports use the v3 workspace owner.

## Tech stack

- Node.js ES modules and built-in `node:test` for the closed workspace, migration, selector, and preview contracts.
- Next.js App Router server layout/pages plus React client context for the shared development-only workspace.
- Existing `AppPageShell`, `AppSurface`, `Button`, development audio endpoint, immutable discovery manifest, curated listening review, scheduler, and single preview player.
- Browser `localStorage` for the v3 draft and `storage` events for immediate cross-tab reconciliation; no database, server mutation, upload, or repository write from the UI.

## Baseline and authority refs

- `AGENTS.md`; `docs/project-state.md`; `docs/project-log.md`; `docs/wiki/index.md`; `docs/wiki/atmosphere-audio.md`.
- This plan's original exhaustive discovery and `/dev/candidates` requirements.
- `data/atmoshaper/signature-sound-review.json` as the immutable recording/source identity and suggested-concept baseline.
- `data/atmoshaper/signature-sound-listening-review.json` as the imported overall recording-decision, note, active-group, and strategy baseline.
- `lib/atmoshaper/signature-sound-group-review.js` as the v2 legacy review validator only.
- User-approved behavior: concept-specific removal; multi-concept assignment; user-created local concepts; immediate cross-page updates; two focused pages; exact track inclusion replacing the Keep + Maybe / Keep only selector; and preservation rather than restart.

## Task intent

- Outcome: one coherent local review containing recording-level observations and exact concept-by-concept playback ingredients.
- Primary scenario: while reviewing Busy Street, the user sees every mapped recording, can play a chosen one in the setup, include or remove it only for Busy Street, leave a Busy-Street-specific note, and immediately see the same decision from the recording page.
- Success evidence: legacy drafts migrate without deletion; two routes share updates; a recording may differ across concepts; custom concepts appear immediately; exact included IDs drive playback and approval; one export reconstructs every decision and note; automated and live-page checks pass.
- Stop condition: the local review and export workflow is complete and verified. Do not process audio or modify production catalog/runtime state.

## Requirement Ready Check

- Requirement source refs: the approved 2026-08-24 conversation and the original full-pass plan.
- Goals and scope refs: preserve previous work, make concept membership exact, split the heavy page, and produce one complete handoff.
- User/scenario refs: Busy Street's 17 usable options and recordings that may serve multiple concepts.
- Requirement items: concept-specific include/remove; per-concept track notes; overall recording review retained; existing and custom concept assignment; immediate cross-page state; exact-source playback; unified export; legacy migration.
- Acceptance refs: approved design above plus focused producer/consumer tests and live development route checks.
- Open blocker questions: none.
- Decision: ready.

## Compatibility boundary

- Preserve the immutable discovery review, imported curation, all earlier browser keys, the 84 Moodist identities, current Signature extras, and every production qualification gate.
- The v3 workspace is fingerprint-bound to both the discovery review and curation. It must never attach decisions to a different inventory or silently accept an unknown source, group, strategy, or field.
- Existing v1 recording and v2 group data are migration inputs, not competing live owners. New writes never update or delete them.
- A recording-level Keep/Maybe/Reject value remains an overall observation. Per-concept include/remove is authoritative for that concept's preview and may intentionally differ across concepts.
- A removed source remains visible inside that concept so it can be restored. Removing it from one concept must not change any other concept.
- New concepts are local `custom:` concepts. They do not become Moodist identities, production catalog entries, qualified sources, or published sounds through this workflow.
- No source path leaves the existing manifest-ID audio boundary. No audio copy, processing, encoding, upload, production provider/runtime wiring, staging, commit, push, merge, or deployment is authorized by this plan.

## TDD Route

- Mode: off.
- Decision: strict.
- Strict authority: the explicit strict route already recorded for the active catalog/review workstream.
- Test posture: strict RED tests before each new workspace, migration, route, exact-source preview, and export behavior.
- Reason: this changes persistence, a closed export contract, migration, playback identity, and a multi-page user workflow.
- Verification: focused owner tests, producer/consumer integration tests, full repository tests, typecheck, lint, build, diff hygiene, and live HTTP/audio checks.

## Change Necessity

- User-visible need: review and annotate exact recordings within each concept, map recordings to multiple or new concepts, and work across two lighter pages without losing earlier work.
- No-change option: the current lower recording queue can store global decisions and notes, but it neither alters group playback nor enters the group export; the current group page cannot express per-concept ingredients.
- Why code is necessary: data, local state, playback selection, approval identity, page routing, and export validation must share a new exact concept-assignment contract.
- Minimum boundary: one workspace owner/provider, two focused route pages reusing current components, a bounded ingredient component, versioned preview identity, migration tests, and documentation sync.
- Decision: code-change.

## Existence and architecture integrity

- Proposed new surface: `signature-sound-review-workspace.js` plus a segment provider.
- Existing reuse candidates: the recording client owns only a v1 global draft; the group-review owner owns only v2 strategy approval; the imported listening-review owner creates repository curation and must not become browser persistence.
- Creation proof: neither existing owner can canonically reconcile both drafts, custom concepts, exact per-concept inclusion, migration, and a single export without mixing unrelated responsibilities. The new owner retires both live draft/export paths instead of becoming a third peer.
- Canonical contract: immutable discovery/curation baselines plus the validated v3 workspace; UI components are callers and do not normalize or invent identities independently.
- Higher-level simplification: one workspace payload, one provider, one export, and one effective-membership selector replace two localStorage writers and two exports.
- Retirement: v1/v2 keys become read-only recovery/migration inputs; `sourcePool` is absent from v3; `signature-sound-group-review.js` remains bounded to v2 validation and can retire only after preserving legacy browser data is no longer required.
- Decision: add with proof; architecture is aligned.

## Workspace v3 contract

```js
{
  version: 3,
  fingerprints: {
    discoveryReviewSha256: "<64 lowercase hex>",
    curationSha256: "<64 lowercase hex>"
  },
  updatedAt: "<canonical ISO timestamp>",
  customConcepts: {
    "custom:<stable-slug>": { label: "<trimmed user label>" }
  },
  recordings: {
    "<known sourceId>": {
      decision: "keep | maybe | reject", // optional overall override
      note: "<overall recording note>",  // optional overall override
      concepts: {
        "<known or custom groupId>": {
          decision: "include | remove",
          note: "<note about this recording in this concept>"
        }
      }
    }
  },
  groups: {
    "<known or custom groupId>": {
      strategyId: "<known strategy>",
      previewSettings: { "<closed strategy-specific fields>": "<values>" },
      note: "<group-level strategy note>",
      decision: "approve | change",       // optional
      auditionedAt: "<canonical ISO>",    // paired optional evidence
      auditionKey: "<exact-source key>"   // paired optional evidence
    }
  }
}
```

- `recordings` and `groups` remain sparse. Effective baseline mapping comes from the immutable manifest and curated decision list.
- For a baseline-mapped source with no v3 concept override, curated Keep/Maybe means included and curated Reject means removed.
- Adding a source to an unrelated or custom concept writes an explicit `include`. Later `remove` retains the relationship and note so the source stays visible for restoration.
- Custom IDs use a normalized `custom:<slug>` with a numeric suffix for a case-folded collision. Labels and IDs are unique and validated.
- Effective included source IDs are sorted before audition-key generation and export normalization.

## Migration contract

1. Validate and load an existing matching v3 workspace when present.
2. Otherwise seed from immutable discovery and curation and independently inspect:
   - `atmoshaper-signature-candidates:<discovery fingerprint>` v1;
   - `atmoshaper-signature-group-review-v2:<curation fingerprint>` v2.
3. Copy v1 overall decisions and notes into sparse v3 recording overrides.
4. Copy v2 strategies, settings, group notes, and decisions. Convert `keep-and-maybe` to the default effective included set. Convert `keep-only` by recording explicit concept-specific removals for that group's Maybe sources.
5. Recompute the v3 exact-source audition key from the derived sorted included IDs. Preserve a valid v2 audition timestamp and approval only when the legacy pool, immutable source list, strategy, and settings yield that exact v3 configuration.
6. Persist v3 only after the complete normalized payload validates. Never delete or rewrite a legacy key.
7. Surface invalid matching v3 state as a recoverable review error rather than silently replacing it. An invalid legacy key may be ignored with a visible migration warning while the other valid legacy key and immutable baselines remain available.

## User workflow

### Hub: `/dev/candidates`

- Show links to Recording review and Concept review, the shared workspace fingerprint/status, recording/concept progress, and one Export complete review action.
- Retain development-only `notFound()` and `noindex` behavior for the entire segment.

### Recording review: `/dev/candidates/recordings`

- Preserve search, discovery/decision/concept filters, pagination, raw audio control, metadata, overall Keep/Maybe/Reject, and overall note.
- Add a searchable multi-concept editor showing suggested, assigned, included, and removed concepts.
- Selecting an existing concept writes concept-specific `include`; removing it writes `remove` rather than deleting its history.
- Add-concept accepts one trimmed label, creates a collision-safe `custom:` identity, assigns the current recording as included, and makes the group immediately visible on the concept page.
- Existing imported decisions/notes remain visible as the baseline; v3 changes are the editable overlay.

### Concept review: `/dev/candidates/concepts`

- Preserve concept search/status filters, proposed/selected strategy, strategy-specific controls, transport, approval, and group note.
- Remove the Keep + Maybe / Keep only selector. The exact included-source count replaces it.
- Add a collapsed ingredient section per concept so 93 groups and large source sets are not rendered as expanded controls simultaneously.
- Each ingredient row shows filename/path, earlier overall decision, Included/Removed state, concept-specific note, active-playing state, and Play this in setup.
- Play this starts the full current setup at the selected included source, then continues its configured dynamic behavior through the shared single player. It is valid current-configuration audition evidence because the entire exact included set, strategy, and settings are bound.
- Include/remove stops an active preview and clears audition/approval for only that concept. Recording or group note edits do not change audio and do not clear audition evidence.
- Removed sources remain listed and cannot be selected by random/next playback until restored.

## File map and complexity budget

- Create `lib/atmoshaper/signature-sound-review-workspace.js`: closed v3 schema, baseline selectors, legacy migration, exact included-source projection, custom-concept IDs, and deterministic renderer. Target below 600 maintained lines.
- Create `tests/atmoshaper-signature-sound-review-workspace.test.mjs`: fixture and real-baseline contract/migration tests. Split fixtures into a helper before 800 lines rather than growing one oversized test owner.
- Create `app/dev/candidates/review-workspace-provider.tsx`: one localStorage owner, state/update API, migration warnings, storage-event reconciliation, and unified export. Target below 450 lines.
- Create `app/dev/candidates/recordings/page.tsx` and `app/dev/candidates/concepts/page.tsx`; modify `app/dev/candidates/page.tsx` into the lightweight hub and add a segment `layout.tsx` for the development guard/shared provider/navigation.
- Modify `candidate-review.tsx` to consume the shared workspace and edit concept membership; keep pagination and media behavior. Current pressure is approximately 340 lines; target below 550.
- Modify `group-strategy-review.tsx` for exact ingredient state and provider actions. It is already approximately 420 lines, so do not add the ingredient list in place.
- Create `app/dev/candidates/concept-ingredient-review.tsx` and its module CSS as the bounded ingredient UI owner. Target below 350 lines.
- Modify `group-strategy-preview.tsx` to remove `sourcePool` and report exact included counts.
- Modify `signature-sound-preview.js` and `signature-sound-preview-player.js` for sorted exact-source audition identities and an optional validated initial source. Preserve the current pool-key helper only for v2 migration validation.
- Modify focused tests and operational/current-state/history docs after behavior is verified.
- Budget result: within budget with extraction. Adding ingredient UI directly to `group-strategy-review.tsx` is rejected as an at-risk mixed-purpose expansion.

## Execution readiness

- Intent lock: preserve prior work and make exact concept-level ingredients reviewable/exportable.
- Scope fence: development review only; no production/runtime/media/provider/catalog qualification work.
- Baseline lock: discovery and curation fingerprints plus the legacy v1/v2 validators.
- Owner constraint: the v3 workspace is canonical; components cannot maintain parallel copies.
- Compatibility: legacy keys remain untouched; source identity and audio containment stay immutable.
- Task batches: contract/migration; shared provider; route split/recording workflow; exact preview/concept workflow; export/docs/closeout.
- Drift rule: any need for server persistence, production integration, destructive legacy cleanup, or a second export returns to design rather than entering implementation.
- Evidence required: strict RED/GREEN receipts for each batch, real migration fixtures, exact-source approval invalidation, cross-page state, full validation, and live local route/audio responses.

## Task 6: v3 workspace, selectors, and safe legacy migration

**Files:** create `lib/atmoshaper/signature-sound-review-workspace.js` and `tests/atmoshaper-signature-sound-review-workspace.test.mjs`; modify `lib/atmoshaper/signature-sound-preview.js`, `tests/atmoshaper-signature-sound-preview.test.mjs`, and `lib/atmoshaper/signature-sound-group-review.js` only if a documented legacy helper import is needed.

**Why:** this is the canonical contract that prevents two pages, two drafts, and two exports from disagreeing.

**Steps:**

1. Write fixture tests for closed v3 fields, both fingerprints, known source/group/strategy identities, sparse recording overrides, per-concept include/remove notes, custom concept uniqueness, deterministic normalization, effective baseline membership, sorted exact included IDs, and exact-source audition keys.
2. Write migration tests with simultaneous v1 and v2 inputs proving notes/decisions survive, `keep-only` becomes per-concept Maybe removals, valid approvals are rebound to exact IDs, invalid/stale approvals fail closed, and input objects remain unchanged.
3. Run `node --test tests/atmoshaper-signature-sound-review-workspace.test.mjs tests/atmoshaper-signature-sound-preview.test.mjs tests/atmoshaper-signature-sound-group-review.test.mjs`; record the expected RED for the missing v3 owner/exact key.
4. Implement the minimum closed workspace, selectors, renderer, collision-safe custom identity, exact audition key, and migration functions with JSDoc describing immutable inputs and failure boundaries.
5. Rerun the same command to GREEN, then include `tests/atmoshaper-signature-sound-listening-review.test.mjs` and the real discovery/curation fixtures.

## Task 7: shared provider, preservation, and unified export

**Files:** create `app/dev/candidates/review-workspace-provider.tsx`; modify `tests/atmoshaper-dev-candidates.test.mjs`.

**Why:** one client owner must migrate, persist, synchronize, and export the review without destroying legacy browser work.

**Steps:**

1. Add RED source/integration contracts requiring one v3 key, read-only v1/v2 migration reads, no legacy `removeItem`/write, validator-before-write, a visible migration/invalid-state boundary, storage-event reconciliation, and one renderer-backed export.
2. Run `node --test tests/atmoshaper-dev-candidates.test.mjs` and capture the expected provider/export RED.
3. Implement the provider with immutable baseline props, functional updates, canonical timestamps, guarded migration, localStorage persistence after validation, cross-tab `storage` reconciliation, and a shared `exportReview()`.
4. GREEN the page/provider test and the Task 6 owner tests.

## Task 8: split routes and recording-to-concept assignment

**Files:** create `app/dev/candidates/layout.tsx`, `app/dev/candidates/recordings/page.tsx`, and `app/dev/candidates/concepts/page.tsx`; modify `app/dev/candidates/page.tsx`, `candidate-review.tsx`, its CSS, and `tests/atmoshaper-dev-candidates.test.mjs`.

**Why:** the current combined page is too heavy, and recording review needs direct control over the concept relationships that the concept page consumes.

**Steps:**

1. Add RED contracts for the three-route structure, shared navigation/provider, segment-wide development denial/noindex, preserved recording controls, searchable concept editor, multi-concept include/remove, add-concept, and immediate shared-state projection.
2. Add owner tests proving one recording can be included in Busy Street and removed from Traffic without changing either concept's other recordings, and that a custom concept appears with its first included source.
3. Run the focused workspace/page tests and capture the expected route/assignment RED.
4. Implement the hub and two pages; refactor `CandidateReview` to consume provider state and write overall recording plus concept-specific changes. Do not add another localStorage or export path.
5. GREEN focused tests, then run `npm run typecheck` before proceeding.

## Task 9: exact ingredient review and targeted setup playback

**Files:** create `app/dev/candidates/concept-ingredient-review.tsx` and its CSS; modify `group-strategy-review.tsx`, `group-strategy-preview.tsx`, their CSS, `lib/atmoshaper/signature-sound-preview-player.js`, and the preview/group/page tests.

**Why:** the user must identify, audition, include/remove, and annotate each recording inside the concept whose final behavior is being approved.

**Steps:**

1. Add RED scheduler/player tests for a validated `initialSourceId`, rejection of an absent/removed initial source, continued no-immediate-repeat scheduling afterward, and one-active-player cleanup.
2. Add RED workspace/group tests proving exact included IDs enter the audition key; include/remove stops and invalidates only that concept; notes do not invalidate; removed sources remain visible but unplayable by setup transport.
3. Add RED page contracts for collapsed ingredient sections, Included/Removed controls, concept-specific notes, playing highlight, Play this in setup, no `sourcePool`, and accessible labels/status.
4. Run the focused preview/workspace/group/page suite and capture the expected failures.
5. Implement optional initial-source playback in the existing single player; exact-source preview wiring; and the extracted ingredient UI. Keep all playback URLs manifest-ID-only.
6. GREEN the focused suite and run the adjacent catalog, discovery, listening, recipe, sound-library, workspace, and provider suites.

## Task 10: real migration/export proof, docs, and closeout

**Files:** modify `docs/project-state.md`, `docs/project-log.md`, `docs/wiki/atmosphere-audio.md`, and the existing Aegis work checkpoint/evidence files; modify production source only if a verification-discovered defect first receives a strict RED.

**Why:** closeout must prove that the user's existing work survives and the exported handoff fully describes exact concept construction without overstating production readiness.

**Steps:**

1. Build fixture exports shaped like the current real v1 recording review and partial v2 group review; migrate twice and prove byte-identical normalized v3 output apart from an explicitly supplied timestamp.
2. Probe Busy Street and at least one shared recording: verify effective included counts, different concept decisions, per-concept notes, and exact-source approval invalidation.
3. Verify a custom concept created from a recording appears in concept selectors and the concept review without a server or import round trip.
4. Run:
   - `node --test tests/atmoshaper-signature-sound-review-workspace.test.mjs tests/atmoshaper-signature-sound-preview.test.mjs tests/atmoshaper-signature-sound-group-review.test.mjs tests/atmoshaper-dev-candidates.test.mjs`;
   - the adjacent AtmoShaper catalog/discovery/listening/runtime/workspace/provider suites;
   - `npm run typecheck`;
   - `npm run lint`;
   - `npm run test`;
   - `npm run build`;
   - `git diff --check` plus trailing-whitespace and machine-path scans for untracked task files.
5. With the existing server-owned Signature root, verify HTTP 200 for the hub, recordings page, and concepts page; HTTP 206 for one manifest-bound audio range; and no Production availability.
6. Manually verify narrow and roomy layouts, keyboard reachability, collapsed large ingredient groups, active-track highlighting, cross-page/cross-tab updates, migration warnings, and one complete export download.
7. Update docs with the v3 workflow, preservation rule, exact-source approval boundary, validation receipts, and continued non-production status. Do not stage, commit, push, merge, deploy, upload, process, or copy audio.

## Plan pressure test and risks

- Owner/contract/retirement: proceed; v3 is the sole new live owner and v1/v2 are explicitly read-only migration inputs.
- Architecture integrity: proceed; the shared provider prevents page-local divergence and the exact-source selector prevents caller-side pool reconstruction.
- Verification scope: producer, consumer, migration, preview, route, full repository, build, and live local checks are explicit.
- Task executability: each batch has exact files, RED boundary, GREEN command, and stop condition.
- Primary risks: localStorage quota, corrupt legacy data, custom-label collisions, source assignment drift, oversized concept lists, approval surviving audio-changing edits, and multiple audio owners.
- Mitigations: sparse overrides; immutable fingerprints; validate-before-write; collision-safe IDs; collapsed ingredient rendering; exact sorted source IDs in audition keys; and continued use of one existing preview player.
- Rollback: v3 uses a new key and routes/components only. Legacy keys remain untouched, so removing the v3 provider/routes restores the earlier review state without data migration reversal.
- Completion boundary: GREEN proves the development review/export workflow only. Human listening judgment, audio processing, technical/processing qualification, production catalog promotion, publication, and deployment remain separate future work.

## Approved post-review reconciliation design

**Design approval:** The user approved this direction on 2026-08-25. This section is the written specification for review; it does not authorize implementation, audio processing, media copying, publication, catalog qualification, or production wiring.

### Outcome and authority boundary

The completed version-3 review export is human-owned evidence. Reconciliation must validate and preserve it unchanged, bind it to the exact discovery and curation baselines, and produce one deterministic repository-owned construction review. That construction review translates every non-empty group or ingredient note into an explicit disposition and supplies the effective playback and processing intent for later planning.

The current completed export validates as version 3 with the exact discovery and curation fingerprints, 834 sparse recording entries, 93 group entries, 3,693 projected recordings, and 93 projected groups. It contains 38 note-bearing review entries: 27 group notes and 11 concept-ingredient notes. Those counts are acceptance evidence for this exact input, not universal schema constants for future exports.

Authority remains separated:

1. `signature-sound-review.json` owns immutable discovered recording identities and suggested concept mappings.
2. `signature-sound-listening-review.json` owns imported overall recording decisions and baseline dynamic strategy assignments.
3. The validated version-3 export owns the user's exact concept ingredients, selected preview settings, decisions, audition evidence, and free-text notes.
4. The new construction review owns the explicit reconciliation of that export into effective playback constraints, processing outcomes, note dispositions, and QA requirements.
5. `sound-processing-plan.js` remains the later checksum-bound publication-processing planner. It must not parse human notes or accept unresolved construction intent as a qualified assignment.

The browser workspace, legacy drafts, downloaded exports, discovery review, and listening review remain unchanged by reconciliation. The construction review may correct effective strategy intent without rewriting its evidence inputs.

### Considered approaches

1. **Process directly from free-text notes:** rejected because it cannot prove that every note was handled consistently and would mix interpretation with destructive media work.
2. **Extend the browser workspace and require another review pass:** rejected for this slice because the user completed the review and should not need to hunt through 93 concepts again. The development interface remains available for future concepts.
3. **Generate a fingerprinted construction review:** selected because it preserves the user's original evidence, makes every interpretation reviewable, supports future exports, and creates a closed input for later processing design without qualifying audio.

### Construction-review contract

The maintained output should be `data/atmoshaper/signature-sound-construction-review.json`, validated and rendered by a bounded owner rather than added to the already mixed review-workspace or publication-planner owners. Its conceptual version-1 shape is:

```js
{
  version: 1,
  fingerprints: {
    discoveryReviewSha256: "<exact baseline sha256>",
    curationSha256: "<exact baseline sha256>",
    workspaceSha256: "<canonical normalized v3 sha256>",
    interpretationSha256: "<canonical approved interpretation sha256>",
    constructionReviewSha256: "<canonical output projection sha256>"
  },
  sourceReview: {
    version: 3,
    updatedAt: "<timestamp copied from the normalized export>"
  },
  summary: {
    projectedRecordingCount: 3693,
    groupCount: 93,
    noteDispositionCount: 38,
    structuredNoteCount: "<derived>",
    deferredNoteCount: "<derived>",
    needsDecisionNoteCount: "<derived>"
  },
  groups: [
    {
      groupId: "<known exact group id>",
      label: "<baseline or approved replacement label>",
      includedSourceIds: ["<sorted exact source ids>"],
      playback: {
        strategyId: "<known strategy>",
        previewSettings: { "<closed strategy settings>": "<value>" },
        minimumSelectionsBeforeRepeat: "<positive integer or null>"
      },
      processingIntents: ["<closed outcome records>"],
      sourceOverrides: {
        "<included exact source id>": ["<closed outcome records>"]
      },
      reviewState: "accepted | needs-rebuild-audition | unresolved",
      noteDispositionIds: ["<stable disposition ids>"]
    }
  ],
  noteDispositions: [
    {
      id: "<stable id derived from scope, identities, and original note>",
      scope: "group | ingredient",
      groupId: "<known group id>",
      sourceId: "<known source id or null>",
      originalNote: "<exact preserved text>",
      classification: "<closed intent class>",
      resolution: "<structured outcome or explicit reason>",
      state: "structured | deferred | needs-user-decision"
    }
  ]
}
```

The schema must be closed and fail on unknown fields, identities, strategies, treatment kinds, duplicate dispositions, source overrides for excluded ingredients, mismatched counts, stale fingerprints, or output fingerprints that do not reproduce. The input path and machine-absolute Signature root must never enter the output. Output ordering and JSON rendering must be deterministic; wall-clock generation time is not an output identity.

Every non-empty note must have exactly one disposition. One structured processing outcome may satisfy multiple dispositions when the same source and edit are intentionally shared across concepts, but the two original note entries remain independently traceable.

### Processing-intent vocabulary and precedence

Construction intent records specify audible outcomes, not an assumed DSP algorithm. Initial closed intent kinds are:

- `trim-segment`: remove a bounded unwanted beginning, ending, or identified artifact region while retaining desired ambience.
- `normalize-relative-level`: align perceived level among recordings in one concept without flattening intended dynamics.
- `remove-human-voice`: remove audible human speech/vocal presence while retaining the wanted non-human environment as far as technically feasible.
- `obscure-speech-intelligibility`: retain human environmental texture but make spoken words indiscernible.
- `suppress-unwanted-element`: reduce a named non-speech element such as rain, a microphone rub, or an isolated shout while preserving the target sound.
- `emphasize-target-element`: make a named target such as thunder or light rain appropriately perceptible.
- `add-time-effect`: apply and audition a named effect such as echo or delay.
- `repair-loop`: construct and audition a smoother repeat or transition boundary.
- `needs-additional-source`: retain the concept but record that another recording or user-made recording is required.
- `investigate-preview-failure`: diagnose an unsupported or failed local preview before listening status can advance.
- `rename-concept`: apply an exact approved replacement label or retain an explicit unresolved name decision.

Ingredient/source instructions override a group default only for that source inside that concept. A source that is removed from a concept keeps its note disposition but receives no processing assignment for that concept. A shared physical recording may have one checksum-bound edit reused across concepts only when the required audible outcome is identical; otherwise later planning must create concept-specific derived variants.

`remove-human-voice` and `obscure-speech-intelligibility` are acceptance outcomes. The later implementation may use manual cuts, spectral repair, source separation, filtering, or another bounded technique, but it cannot mark either outcome successful until a new audible QA pass confirms the requested result. A merely attempted filter is not success evidence.

### Approved playback reconciliation

The effective playback settings must apply these user-approved corrections:

- `signature-extra:air-traffic-control`: change from adaptive whole-source/end-to-end playback to `spaced-event-sequence` with `minimumGapSeconds: 1`, `maximumGapSeconds: 7`, `minimumSelectionsBeforeRepeat: 4`, and relative-level normalization.
- `signature-extra:horror-suspense`: change from adaptive one-shot/end-to-end playback to `spaced-event-sequence` with `minimumGapSeconds: 0` and `maximumGapSeconds: 16`.
- `signature-extra:sci-fi-whistles`: retain `spaced-event-sequence` with `minimumGapSeconds: 0` and `maximumGapSeconds: 8`; separately require an auditioned echo or delay treatment.

Any effective strategy or settings change makes prior exact-configuration audition evidence stale. The construction review must set the affected group to `needs-rebuild-audition`; it must not carry an earlier Approve or audition key forward as proof of the corrected configuration.

Other explicit playback constraints must also be represented rather than left only in prose:

- `moodist:dryer`: vary crossfade transition duration from 3.75 to 10 seconds.
- `moodist:walk-on-gravel`: audition a smooth overlap/crossfade boundary between cadence events; the exact technique remains implementation-owned and must be re-auditioned.
- `moodist:walk-on-leaves`: do not repeat a recording until at least three other selections have occurred.
- `signature-extra:moon-footsteps`: overlap events so the preceding recording remains audible when the next begins.

The current preview scheduler's immediate-repeat protection is not evidence that three- or four-selection history windows are implemented. Those constraints remain construction requirements until focused scheduler/runtime tests and listening prove them.

### Approved speech reconciliation

The user confirmed this exact outcome split:

- Full human-voice removal: `moodist:birds`, `moodist:train`, and the two included Busy Street sources `64538e1493a9eb2141af43b9c4637eff6e3382e244e7cde6b3cde2199e21815c` and `f7e2c20668d276a4a125b189c7d44e845f20271e812f96c38405193d23a13e7d`.
- Preserve environmental human presence while obscuring intelligible words: `moodist:busy-street` as the group default, `moodist:cafe`, `moodist:crowd`, `signature-extra:coffee-shop`, and `signature-extra:crowd-walla`.
- Trim spoken introductions: source `93af53fdf1740d4eac97d255d7183938408b14ff4d053316ae7818e53509e22f` in both Birds and Balcony Town, plus Church source `353fd1303f56fb2d0afcc8a7b0a48fdade14218cc1687ff5aab04e0ac05319c1`.

Busy Street source `cf936ab0acc2f2af3be2b9458c6c740b150c9a185e43290aa1a25889a64e46c5` retains its note but is already removed from that concept, so reconciliation must not create a Busy Street processing assignment for it.

Air Traffic Control intentionally depends on its radio speech and receives no speech-removal treatment unless a later explicit review changes that product behavior.

### Remaining note dispositions

All remaining notes must be represented with these fixed interpretations or explicit unresolved states:

- Boiling Water: trim the stove on/off clicks from the beginning and end, then audition the resulting loop.
- Campfire and Church: normalize recording levels within each concept.
- Ceiling Fan: mark `rename-concept` as `needs-user-decision`; do not invent a replacement label from the filename automatically.
- Crickets: investigate the unsupported-source preview failure before treating listening as complete.
- Dryer: trim the hand-dryer start/stop artifacts in addition to the variable-transition requirement.
- Howling Wind: rename to `Lunar Wind`.
- Light Rain: audition level adjustment or target emphasis; approval of the original setup does not select a processing algorithm.
- Night Village: rename to `Countryside`.
- Road: record that the sources are passing-car events rather than tire-road noise and mark the final replacement label as `needs-user-decision`.
- Thunder: suppress rain and emphasize thunder, then re-audition.
- Wind Chimes: repair the loop or add recordings; keep the outcome unresolved until one path passes listening.
- Wind in Trees: retain as `needs-additional-source` with the user's intent to make a recording.
- Cat Vocalizations source `e10d824cc97dc53a4d6621ce582cd1754e3e1c91fdf7ffb1ec38e99620282e34`: suppress microphone-rub noise.
- Supermarket source `3ab747b3b6206274da0fe25d8fb3b61be2e64b77006cf2d63636646450a02787`: preserve the counter-thud/microphone note, but create no Supermarket processing assignment because the source is removed from that concept.
- Underwater Effects: rename to `Walking in Puddles`; retain its selected walking-cadence strategy pending rebuilt audition.

No note may disappear merely because its source is removed, its group was previously approved, it duplicates a shared physical edit, or its requested method is not yet known.

### Reconciliation flow and failure behavior

1. Read the discovery review, listening review, playback strategy policy, and returned version-3 export.
2. Validate all four inputs with their existing canonical owners before interpreting notes.
3. Canonically normalize and fingerprint the version-3 workspace without mutating it.
4. Validate a repository-owned approved interpretation declaration containing only exact group/source identities and closed outcomes.
5. Derive effective concept ingredients, playback, source precedence, note dispositions, and review state.
6. Require exact coverage of every non-empty group and ingredient note. Reject missing, duplicated, fabricated, or stale dispositions.
7. Render deterministic JSON to stdout by default. An explicit repository-relative output flag may publish only the construction-review owner through the same atomic, containment-safe discipline used by the existing catalog tools.
8. Re-read and validate the written result before reporting success.

Failure must leave the existing construction review unchanged. The tool must not partially publish output, rewrite a downloaded export, modify browser storage, or fall back to filename/free-text inference when an identity or interpretation is missing.

### Scope, non-goals, and later handoff

This reconciliation slice includes validation, deterministic construction intent, exact note coverage, a human-readable summary, focused tests, and documentation sync. It deliberately excludes:

- decoding, editing, separating, filtering, normalizing, looping, encoding, copying, or uploading audio;
- choosing exact trim timestamps without measured/listened evidence;
- claiming that speech removal, speech obscuring, loop repair, target emphasis, or preview repair succeeded;
- production catalog promotion, processing qualification, publication-ledger mutation, provider/runtime integration, staging, commit, push, merge, deployment, or external provider actions;
- changing the version-3 browser schema or requiring the user to repeat the completed review;
- retiring the development review interface, legacy drafts, or original exports.

Future concept exports may use the same reconciliation owner with a new fingerprint-bound interpretation declaration. Extending the development UI with first-class construction controls is a separate design decision, not a prerequisite for preserving this review.

### File boundary and complexity budget

The implementation plan should prefer:

- a new bounded `lib/atmoshaper/signature-sound-construction-review.js` owner for the closed interpretation/output contracts and derivation;
- a matching focused test owner, split before 800 lines if fixture coverage grows;
- one repository-owned interpretation data file and one generated construction-review data file;
- one thin CLI and named npm script;
- documentation updates after verified output exists.

Do not add this responsibility to `signature-sound-review-workspace.js` (currently about 674 lines) or `sound-processing-plan.js` (currently about 840 lines). The former owns browser persistence/migration/projection; the latter owns measured, eligible, checksum-bound publication recipes. Adding human-note interpretation to either would create a mixed owner and push existing pressure further over its intended boundary.

### Strict TDD and acceptance criteria

Implementation remains on the already-authorized strict TDD route. Before production/data implementation, RED coverage must prove at least:

1. the real normalized version-3 export is accepted only with its exact discovery and curation fingerprints;
2. all 38 current note-bearing entries require exactly one disposition;
3. missing, duplicate, fabricated, stale, unknown-field, unknown-treatment, and excluded-source assignment cases fail closed;
4. Air Traffic Control becomes spaced 1-7 seconds with four-selection repeat protection;
5. Horror Suspense becomes spaced 0-16 seconds;
6. Sci-Fi Whistles remains spaced 0-8 seconds with a separate time-effect intent;
7. group speech defaults and exact Busy Street source overrides resolve with the approved precedence;
8. removed Busy Street and Supermarket ingredients preserve notes without receiving concept processing assignments;
9. strategy changes invalidate prior audition/approval evidence in the derived construction state;
10. every remaining note receives the fixed structured, deferred, or needs-user-decision outcome above;
11. deterministic fingerprints and rendering reproduce after round-trip validation;
12. no input path, machine-absolute root, audio binary, browser storage mutation, or media/output directory is created during validation and dry-run.

Success means the deterministic construction review and readable reconciliation summary pass focused and adjacent tests, the real export accounts for all 38 notes, and the output remains explicitly pre-processing and non-production. It does not mean any audio has passed technical, listening, processing, publication, or runtime gates.

## 2026-08-25 implementation evidence

- The approved follow-up is implemented by the bounded 556-line construction owner, a 177-line no-write-by-default CLI, exact interpretation/generated JSON owners, and focused contract/transaction tests. The browser workspace and processing planner were not expanded.
- Raw-hash-locked evidence reproduces the exact authority chain: 3,693 recordings, 93 groups, 27 group notes, 11 ingredient notes, and 57 inherited overall notes identical to the version-1 listening evidence.
- The generated result contains 44 closed resolutions and 38 dispositions: 36 structured, 0 deferred, and 2 needs-user-decision. Its discovery, curation, workspace, interpretation, and construction fingerprints are `a22a9d19d8ae8353c32c7f8f7ca2be3e7de3b55cceb0e4d8df4f69b552e512bf`, `dc3c8fe2b14dc7d2e29b8ed813e93f89f2ecd47c4a235a1c32dd5ed2beed8bee`, `23b102e69850f6cd9d282f6520ff12d8f2ea42a4961a03b033bfa688f9fc8b5a`, `e2d7d02024ad3a67325c8c87e36d923d6aa8f8aa8a8f0e4b4f9fbe8f169bdfdc`, and `a3e782b6c1c2d808bd7e8214cb655163f1bdfbc473318ae0ac9c916ccb84954d`.
- Strict TDD receipts: pure-owner behavior first passed 3 authority sections and failed 4 unimplemented behavior sections, then reached 9/9; the CLI first failed direct import because its runner did not exist, then the combined data/CLI focus reached 16 passes with one host-limited Windows file-symlink skip. A later classification/state pressure test failed before the pure owner learned to reject mismatched disposition semantics, then returned GREEN.
- Real default JSON and Markdown runs wrote nothing, exposed no machine path, and retained the input hashes. Explicit fixed-path publication succeeded; a fresh direct no-write run byte-equals the 193,309-character generated owner. Directory-junction containment, preflight preservation, rename rollback, reread rollback, and residue cleanup ran in focused tests.
- This evidence records construction intent only. No audio was copied, decoded, processed, encoded, qualified, published, uploaded, or connected to production, and no server, deployment, staging, commit, push, or merge action occurred.
