# AtmoShaper Signature Review Reconciliation Implementation Plan

> **Execution note:** Follow this plan inline with strict RED/GREEN evidence. Do not process, copy, encode, upload, qualify, publish, stage, commit, push, merge, deploy, or retire audio or review evidence in this slice.

**Goal:** Convert the completed fingerprint-matched version-3 Signature Sounds review into one deterministic, repository-owned construction review that preserves every note, applies the approved playback and speech interpretations, and remains inert until later audio work passes a new audible QA gate.

**Architecture:** Add one bounded pure construction-review owner between the browser workspace and the existing checksum-bound publication planner. The owner validates the discovery, listening, strategy-policy, workspace, and interpretation authorities; derives effective group playback and processing intent; and renders deterministic JSON or Markdown. A thin CLI reads both external human exports, prints JSON by default, and may atomically replace only the fixed construction-review data owner when an exact repository-relative output flag is supplied.

**Tech Stack:** Node.js ESM, JavaScript with `// @ts-check` and JSDoc, `node:test`, JSON data declarations, npm scripts, existing AtmoShaper validators, and PowerShell only for read-only Windows verification.

**Baseline / Authority Refs:**

- `AGENTS.md`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/wiki/atmosphere-audio.md`
- `docs/superpowers/plans/2026-08-23-atmoshaper-signature-candidate-review.md`, especially `Approved post-review reconciliation design`
- `docs/superpowers/plans/2026-08-23-atmoshaper-signature-review-curation.md`
- `data/atmoshaper/signature-sound-review.json`
- `data/atmoshaper/signature-sound-listening-review.json`
- `data/atmoshaper/signature-sound-playback-strategies.json`
- The unchanged external version-1 listening export that canonically reproduces the committed listening review
- The unchanged external version-3 complete-review export whose validated `updatedAt` is `2026-08-25T05:24:26.928Z`

**Compatibility Boundary:** Preserve the browser schema, localStorage state, both development review pages, all discovery/listening data, source identities, existing audition evidence, production runtime, publication eligibility, provider state, and raw media. The construction review is additive and cannot make a source production-qualified.

**TDD Route:** Strict. Record the focused RED before each production/data owner is created or changed, apply the minimum GREEN, then run adjacent and repository verification. Raw-hash-locked fixture copies make the suite hermetic; a second read-only run against the original external files proves those fixtures and real inputs have not drifted.

**Verification:** Focused owner/CLI tests, existing workspace/listening/preview/processing regressions, deterministic real-export regeneration, no-path/no-audio checks, typecheck, lint, full tests, build, and `git diff --check`.

## Aegis Visibility

- Canonical new owner: `lib/atmoshaper/signature-sound-construction-review.js`.
- Human interpretation owner: `data/atmoshaper/signature-sound-construction-interpretations.json`.
- Generated derived owner: `data/atmoshaper/signature-sound-construction-review.json`.
- Human evidence remains the two supplied exports. Immutable, path-free byte copies may be retained only as test evidence; neither copy becomes an editable product-data owner.
- Retirement: none. The development review interface and previous review artifacts remain useful for future concepts.
- Rewind rule: any missing note, stale fingerprint, unknown identity, unsupported resolution, excluded-source assignment, or non-reproducible output stops before publication and leaves the previous generated owner unchanged.

## Plan Basis

The user completed the concept/recording review, corrected the intended dynamic playback behavior, approved the exact speech-treatment split, and approved the post-review reconciliation design. A fresh read-only projection of the returned export produced 3,693 recordings, 93 groups, and exactly 38 construction-disposition notes: 27 group notes and 11 ingredient notes. The workspace also retains 57 non-empty overall-recording notes; all 57 are byte-for-byte-equivalent text inherited from the version-1 listening export, with no v3-only or changed overall note. They remain listening-review evidence and are not silently reclassified as group/ingredient construction instructions.

Facts:

- Discovery fingerprint: `a22a9d19d8ae8353c32c7f8f7ca2be3e7de3b55cceb0e4d8df4f69b552e512bf`.
- Version-1 export raw SHA-256: `0da9ad1dd4b184b059624af11963adbd2d85d4ad6c197b83691af6d58cd70dc0`; its canonical exported-review fingerprint is `deea86ef2099ad4d6af878588822fc922d4a2c43227638da420c2e164d311615`.
- Version-3 export raw SHA-256: `d370788a6ef9af7f147c0dcafda18285b759fbca24249b82224b2c16ba844486`.
- Committed curation SHA-256: `dc3c8fe2b14dc7d2e29b8ed813e93f89f2ecd47c4a235a1c32dd5ed2beed8bee`; the exact v1 evidence canonically reproduces its committed JSON byte-for-byte.
- Canonically normalized version-3 workspace SHA-256: `23b102e69850f6cd9d282f6520ff12d8f2ea42a4961a03b033bfa688f9fc8b5a`.
- The returned export is version 3 and matches the committed discovery and curation fingerprints.
- The 57 non-empty v3 overall-recording notes exactly equal the 57 non-empty version-1 listening notes by source ID and text; construction exact-coverage applies to the separate 27 group plus 11 ingredient notes.
- Two note-bearing ingredients are removed from their concepts and must remain traceable without receiving processing assignments.
- Air Traffic Control, Horror Suspense, and Sci-Fi Whistles have approved spaced-event settings.
- No current note is intentionally deferred; ambiguous outcomes are explicit alternatives or `needs-user-decision`.

Assumptions settled by the approved design:

- Construction intent describes an audible outcome and required QA, not a DSP implementation.
- A source-level speech treatment replaces the group-level speech treatment only within the same concept; unrelated group intents still apply.
- Metadata-only renames do not invalidate an otherwise exact audible approval. Playback or audio-processing changes do.

Unknowns intentionally left for later work:

- Exact trim timestamps, filters, source-separation methods, effect parameters, crossfade curves, and processing profiles.
- Whether technically difficult speech removal can meet the audible outcome.
- Final names for Ceiling Fan and Road.

## BaselineUsageDraft

- Required refs: all authority refs listed in the header.
- Acknowledged refs: all.
- Cited refs: approved candidate-review specification, current project state/log/wiki, immutable discovery/listening/strategy data, and returned export fingerprint/timestamp.
- Missing refs: none for reconciliation. Audio measurements and processed audition evidence are deliberately unavailable and are not prerequisites for this inert intent artifact.
- Decision: ready to plan and execute the reconciliation slice only.

## Requirement Ready Check

- Requirement source refs: approved reconciliation design plus the user's confirmations about spaced playback, group/source precedence, voice removal, speech obscuring, and no deferral.
- Goals and scope refs: `Outcome and authority boundary`, `Scope, non-goals, and later handoff`.
- User/scenario refs: the returned version-3 review, the exact 38 construction-disposition notes, and the 57 unchanged inherited overall-listening notes.
- Acceptance refs: `Strict TDD and acceptance criteria` in the approved design.
- Ambiguity remaining inside this slice: none. Method choices remain explicitly outside this slice.
- Status: ready.

## TaskStartSnapshot

- Worktree: `.worktrees/atmoshaper-catalog-audit`.
- Branch: `codex/atmoshaper-catalog-audit`.
- HEAD at plan time: `e0b5e77d689729e4f670818ac67567df0ceeb042`.
- Status: intentionally dirty with the existing catalog/review implementation and documentation. Preserve every pre-existing path.
- Development server: existing port 3013 server is outside this plan and must not be restarted unless a later implementation check actually requires it.

## Files

| Path | Action | Ownership boundary |
|---|---|---|
| `tests/fixtures/atmoshaper/signature-listening-review-v1-a22a9d19d8.json` | Create | Immutable byte-for-byte evidence fixture for canonical listening-review validation. |
| `tests/fixtures/atmoshaper/signature-complete-review-v3-a22a9d19d8.json` | Create | Immutable byte-for-byte evidence fixture for exact 93-group/38-note regression. |
| `lib/atmoshaper/signature-sound-construction-review.js` | Create | Closed interpretation/output schemas, exact note coverage, precedence, deterministic derivation, fingerprints, and renderers. |
| `tests/atmoshaper-signature-sound-construction-review.test.mjs` | Create | Canonical real-evidence and synthetic contract/derivation coverage; split helpers before this owner approaches 800 lines. |
| `data/atmoshaper/signature-sound-construction-interpretations.json` | Create | Repository-owned approved mapping from exact note identities to closed resolutions. |
| `data/atmoshaper/signature-sound-construction-review.json` | Create | Generated deterministic construction review for the exact returned export. |
| `scripts/atmoshaper-signature-sound-construction-review.mjs` | Create | Thin read/validate/render/atomic-publish CLI. |
| `tests/atmoshaper-signature-sound-construction-review-cli.test.mjs` | Create | Argument, no-write, containment, rollback, reread, and path-leak tests. |
| `package.json` | Modify | Add one named reconciliation script. |
| `docs/superpowers/plans/2026-08-23-atmoshaper-signature-candidate-review.md` | Modify | Record implementation/evidence only after GREEN; do not rewrite the approved design. |
| `docs/aegis/work/2026-08-23-atmoshaper-signature-sound-catalog/{10-intent,20-checkpoint,90-evidence}.md` | Modify | Record scope, checkpoint, RED/GREEN, real-export, and closeout evidence. |
| `docs/project-state.md`, `docs/project-log.md`, `docs/wiki/atmosphere-audio.md` | Modify | Sync verified current state and operator workflow after the artifact exists. |

The two test fixtures are immutable evidence copies, not editable authorities. Their raw byte hashes are asserted before parsing. Product data continues to hold only the interpretation declaration and generated construction review. The original Downloads files remain unchanged and are rechecked at the real-input gate.

## Compatibility

- Existing exported functions keep their signatures and behavior.
- The existing listening-review validator retains sole curation-validation authority and is called with the exact version-1 export, Moodist inventory, discovery review, and strategy policy.
- No browser route, React component, localStorage key, or export schema changes.
- Existing audition keys remain evidence of what was heard. They are not rewritten; derived groups with changed playback/audio intent are marked for rebuilt audition.
- `sound-processing-plan.js` remains unchanged and must reject construction-only intent through its existing qualification requirements.
- No fallback parses filenames or free text when a declaration entry is absent.

## Change Necessity

Code change is required. Static JSON alone cannot authenticate a version-3 workspace, prove exact note coverage, resolve source-over-group treatment precedence, invalidate stale audible approval, or publish atomically. Existing browser and publication owners are the wrong responsibility boundaries and are already 712 and 892 lines respectively.

## Existence Check

- Existing workspace owner: validates/migrates browser state and produces the complete projection, but does not interpret notes.
- Existing preview owner: validates strategy-specific settings and audition keys, but does not express repeat-history or processing requirements.
- Existing listening owner: already canonically validates the committed curation when given the historical version-1 export, Moodist inventory, discovery review, and strategy policy. Reuse it without adding a parallel reduced-authority validator.
- Existing audit/listening CLIs: provide established containment and atomic-replacement patterns, but neither owns construction intent.
- Decision: new construction owner is justified; no duplicate higher-level owner exists.

## Architecture Integrity Lens

- Source of truth remains separated: evidence input, approved interpretations, and generated construction review are distinct.
- The new owner calls existing canonical validators; it does not copy their schema logic except for its own closed contracts.
- All interpretation is declared. Runtime callers receive normalized intent and never parse notes.
- The generated output is recomputable and validated against all authorities at its consumer boundary.
- No compatibility adapter or fallback path is introduced.
- No retirement is warranted because the review UI remains intentionally reusable.

## Contract Draft

The interpretation declaration uses two closed arrays so a single approved outcome can satisfy multiple independently preserved notes:

```js
{
  version: 1,
  fingerprints: {
    discoveryReviewSha256,
    curationSha256,
    workspaceSha256
  },
  resolutions: [
    {
      id,
      type: "processing-intent",
      groupId,
      sourceId, // SHA-256 or null for a group default
      intentKind,
      desiredOutcome,
      state: "required" | "alternative" | "needs-user-decision",
      choiceSetId, // string or null
      qa: "audible-qa-required"
    }
  ],
  dispositions: [
    {
      id, // note-<sha256(stableJson({ scope, groupId, sourceId, originalNote }))>
      scope: "group" | "ingredient",
      groupId,
      sourceId,
      originalNote,
      classification,
      resolutionIds,
      state: "structured" | "deferred" | "needs-user-decision"
    }
  ]
}
```

`classification` is exactly one of `audio-processing`, `playback`, `audio-and-playback`, `concept-metadata`, `source-availability`, `preview-diagnostic`, or `removed-source-observation`.

The construction owner receives this exact authority bundle and calls the named existing owners before interpreting anything:

```js
{
  moodistConcepts,
  discoveryReview,
  exportedListeningReview, // immutable version-1 evidence
  listeningReview,
  strategyPolicy,
  workspace, // immutable version-3 evidence
  interpretations
}
```

It calls `validateSignatureSoundDiscoveryReview`, `validateSignatureSoundListeningReview`, `validateSignatureSoundPlaybackStrategies`, and `validateSignatureSoundReviewWorkspace`; then it uses `createSignatureSoundReviewProjection`. No construction-owned fallback accepts a merely shape-valid baseline.

`processing-intent` is limited to audible audio outcomes: `trim-segment`, `normalize-relative-level`, `remove-human-voice`, `obscure-speech-intelligibility`, `suppress-unwanted-element`, `emphasize-target-element`, `add-time-effect`, and `repair-loop`. Workflow and catalog outcomes remain distinct resolution types so they cannot be mistaken for completed audio processing.

`resolutions` is a closed discriminated union. In addition to `processing-intent`, it allows:

- `playback-override`: exact `strategyId` and existing-validator-approved `previewSettings` only.
- `nonrepeat-window`: exact `interveningSelections` required before a source may be selected again.
- `transition-duration-range`: exact minimum and maximum seconds.
- `boundary-mode-audition`: allowed modes `crossfade` and/or `overlap`.
- `overlap-next-event`: requires the preceding source to remain audible as the next starts.
- `rename-concept`: exact replacement label or `null` with `needs-user-decision`.
- `source-requirement`: `needs-additional-source` with an exact desired source description.
- `preview-diagnostic`: `investigate-preview-failure` without claiming a decoded or audible result.
- `audition-requirement`: an explicit `needs-rebuild-audition` outcome when the approved interpretation requires another audible pass even without a strategy/settings change.
- `no-assignment`: only `source-removed-from-concept`, and only for a removed ingredient.

The audible processing kinds are the audio-changing subset of the approved vocabulary. The remaining approved workflow/catalog outcomes use their distinct closed resolution types. `desiredOutcome` is human-readable approved intent, never an executable command or unverified success claim.

The generated review stores all 93 projected groups. Its playback record is:

```js
{
  strategyId,
  previewSettings,
  minimumSelectionsBeforeRepeat,
  constraints: []
}
```

`constraints` contains normalized `nonrepeat-window`, `transition-duration-range`, `boundary-mode-audition`, and `overlap-next-event` records. `minimumSelectionsBeforeRepeat` is the normalized `interveningSelections` value or `null`; when present, the validator requires it to agree exactly with the single nonrepeat constraint.

`sourceOverrides[sourceId]` contains the complete effective intent list for that source when it differs from the group default. In the exclusive `speech-treatment` family, a source-level `remove-human-voice` replaces group `obscure-speech-intelligibility`; unrelated intents accumulate.

Fingerprint rules:

1. `workspaceSha256 = sha256(stableJson(normalizedWorkspace))`.
2. `interpretationSha256 = sha256(stableJson(normalizedInterpretation))`.
3. Set `constructionReviewSha256` to the empty string, hash the complete canonical review, then store the result.
4. Validation repeats all three calculations and exact derivation; serialized drift fails.

Review-state rules:

- Precedence is `unresolved` > `needs-rebuild-audition` > `accepted`.
- `unresolved`: any `needs-user-decision`, unresolved alternative choice, missing included source, or preview-failure diagnostic remains.
- `needs-rebuild-audition`: effective playback or unverified audio outcome differs from the exact heard configuration, the workspace group lacked current exact approval, or an explicit `audition-requirement` applies.
- `accepted`: no unresolved/audio-changing resolution exists and the workspace contains current exact audition approval. An exact metadata-only rename may retain this state.
- These states describe construction-review readiness only, never production qualification.

## Approved Disposition Matrix

Every row below remains a separate disposition even when two rows share one resolution:

| Exact note locator | Required resolution | Disposition state |
|---|---|---|
| Birds group | Remove human voice from included sources | structured |
| Birds / `93af53fdf1740d4eac97d255d7183938408b14ff4d053316ae7818e53509e22f` | Trim spoken introduction | structured |
| Boiling Water group | Trim stove clicks and audition repaired loop | structured |
| Boiling Water / `d4d3d8e79de008a42450e8835383fd2255a801cd29a15f10386fe6cbdab1349c` | Reference the same trim/loop resolution | structured |
| Busy Street group | Obscure intelligible speech as group default | structured |
| Busy Street / `64538e1493a9eb2141af43b9c4637eff6e3382e244e7cde6b3cde2199e21815c` | Override with full human-voice removal | structured |
| Busy Street / `cf936ab0acc2f2af3be2b9458c6c740b150c9a185e43290aa1a25889a64e46c5` | Preserve note; no assignment because removed | structured |
| Busy Street / `f7e2c20668d276a4a125b189c7d44e845f20271e812f96c38405193d23a13e7d` | Override with full human-voice removal | structured |
| Cafe group | Obscure intelligible speech | structured |
| Campfire group | Normalize relative level | structured |
| Ceiling Fan group | Rename with replacement label unresolved | needs-user-decision |
| Church group | Normalize relative level | structured |
| Church / `353fd1303f56fb2d0afcc8a7b0a48fdade14218cc1687ff5aab04e0ac05319c1` | Trim spoken introduction | structured |
| Crickets group | Investigate preview failure | structured |
| Crickets / `2c7748c1d22f5f77731e27f3775cb30504d6957bd1efb0a02b94e820b57e3d9b` | Reference the same preview diagnostic | structured |
| Crowd group | Obscure intelligible speech | structured |
| Dryer group | Vary crossfade transition from 3.75 to 10 seconds | structured |
| Dryer / `a2cdc5b801058999b253de905dcdc45e612c5e944ef6e4202a0d815b91bf8d4f` | Trim dryer start/stop artifacts | structured |
| Howling Wind group | Rename to `Lunar Wind` | structured |
| Light Rain group | Audition level adjustment or target emphasis as alternatives | structured |
| Night Village group | Rename to `Countryside` | structured |
| Road group | Preserve passing-car meaning; replacement label unresolved | needs-user-decision |
| Supermarket / `3ab747b3b6206274da0fe25d8fb3b61be2e64b77006cf2d63636646450a02787` | Preserve note; no assignment because removed | structured |
| Thunder group | Suppress rain and emphasize thunder | structured |
| Train group | Remove human voice | structured |
| Walk on Gravel group | Require smooth crossfade/overlap event boundary | structured |
| Walk on Leaves group | Require three intervening selections before repeat | structured |
| Wind Chimes group | Loop repair or additional recordings as explicit alternatives | structured |
| Wind in Trees group | Needs additional user-made source | structured |
| Air Traffic Control group | Spaced 1-7 seconds, four intervening selections, relative normalization; retain speech | structured |
| Balcony Town / `93af53fdf1740d4eac97d255d7183938408b14ff4d053316ae7818e53509e22f` | Trim spoken introduction; may share physical edit with Birds | structured |
| Cat Vocalizations / `e10d824cc97dc53a4d6621ce582cd1754e3e1c91fdf7ffb1ec38e99620282e34` | Suppress microphone rub | structured |
| Coffee Shop group | Obscure intelligible speech | structured |
| Crowd Walla group | Obscure intelligible speech | structured |
| Horror Suspense group | Spaced 0-16 seconds | structured |
| Moon Footsteps group | Carry preceding event into the next | structured |
| Sci-Fi Whistles group | Keep spaced 0-8 seconds and require auditioned echo/delay | structured |
| Underwater Effects group | Rename to `Walking in Puddles`, retain cadence settings, and explicitly require rebuilt audition | structured |

Expected disposition summary for this export: 36 structured, 0 deferred, 2 needs-user-decision, total 38.

## Plan Pressure Test

- Wrong-owner risk: prevented by keeping interpretation out of the workspace and processing-plan owners.
- Silent-note-loss risk: prevented by stable IDs plus exact set equality between the 38 group/ingredient notes and dispositions, while a separate equality assertion proves all 57 overall notes remain unchanged inherited listening evidence.
- Accidental speech semantics: prevented by explicit treatment family and exact source overrides.
- False success risk: every audio-changing intent carries `audible-qa-required`; no processing state changes.
- Reproducibility risk from external exports: mitigated by raw-hash-locked immutable test evidence, canonical owner validation, exact workspace fingerprint, checked-in interpretation/output fingerprints, mandatory real-input regeneration, and documented operator commands.
- Write-safety risk: fixed destination, canonical containment, temp file, backup/rename rollback, reread validation, and residue checks.

## Plan-Time Complexity Check

- New pure owner target: at most 650 maintained lines. Split schema helpers before 800.
- Focused pure test target: at most 700 lines. Extract a fixture helper before 800.
- CLI target: at most 180 lines; CLI tests at most 450.
- Existing listening, workspace, preview, and publication owners require no production changes.
- Do not touch the 892-line publication planner or 712-line browser workspace unless a focused RED demonstrates an existing-owner defect; that would be a scope stop, not an opportunistic edit.

## Execution Readiness View

- Intent Lock: preserve the completed review and turn all 38 notes into deterministic construction intent.
- Scope Fence: validation, interpretation, inert output, summary, and docs only.
- Baseline Lock: exact discovery/curation/workspace fingerprints and approved disposition matrix.
- Compatibility Boundary: browser, runtime, qualification, processing, publication, providers, and media remain unchanged.
- Task Batches: immutable evidence and canonical RED; pure construction contract; safe CLI; real declaration/output; docs/full verification.
- Test Obligations: observed RED and GREEN for every code/data batch, then real input and full repository gates.
- Review Gates: self-review after each batch; independent plan review before execution; independent code review after all GREEN work.
- Drift/Rewind Rules: unexpected new notes, different fingerprints/counts, or inability to reproduce the checked-in output stops and returns to requirements reconciliation.
- Evidence Required Before Completion: focused/adjacent/full test receipts, real byte equality, no path/audio diff, docs link/fence checks, and clean diff check.
- Advisory Boundary: this plan prepares execution but cannot authorize audio work or Git publication.

## Tasks

### Task 1: Lock immutable evidence and record the canonical RED

**Files:** Create `tests/fixtures/atmoshaper/signature-listening-review-v1-a22a9d19d8.json`, `tests/fixtures/atmoshaper/signature-complete-review-v3-a22a9d19d8.json`, and the initial `tests/atmoshaper-signature-sound-construction-review.test.mjs`.

**Why:** Normal tests must reproduce the exact listening, inherited-overall-note, and 38-note construction authority checks without depending on one machine's Downloads directory, while the existing canonical validators must remain the only authority for discovery, curation, preview settings, and workspace state.

**Change Necessity:** The supplied exports currently exist only outside the repository. Without immutable evidence fixtures, the strict real-export acceptance proof is a non-hermetic one-off.

**Impact / Compatibility:** Test evidence only. The fixtures are byte-for-byte copies with asserted raw hashes and never become product data or writable UI state.

**Strict RED steps:**

1. Copy the two supplied files without normalization or reformatting and assert raw SHA-256 values `0da9ad1dd4b184b059624af11963adbd2d85d4ad6c197b83691af6d58cd70dc0` and `d370788a6ef9af7f147c0dcafda18285b759fbca24249b82224b2c16ba844486` before parsing.
2. In the new test, load Moodist, discovery, strategy policy, committed listening review, v1 evidence, and v3 evidence.
3. Call `validateSignatureSoundDiscoveryReview(discovery, moodist)`.
4. Call `validateSignatureSoundListeningReview(committedListening, { discoveryReview: discovery, moodistConcepts: moodist, exportedReview: v1Evidence, strategyPolicy })` and assert canonical rendered bytes still equal the committed listening file.
5. Call `validateSignatureSoundReviewWorkspace(v3Evidence, { discoveryReview: discovery, curatedReview: committedListening })` and project it; assert version 3, 3,693 recordings, 93 groups, 27 non-empty group notes, and 11 non-empty ingredient notes.
6. Assert the workspace has 57 non-empty overall-recording notes, the version-1 export has 57, and every source ID/text pair is identical. Keep these notes under the listening-review authority and outside the group/ingredient disposition index.
7. Direct-import the not-yet-created construction owner and assert its required exports. Run the focused test and record missing-owner RED only after all existing canonical validation assertions pass.
8. Mutate each evidence object in memory to prove stale discovery/curation fingerprints fail at their existing owners. Retain a changed group/ingredient-note mutation for Task 2, where exact disposition coverage must reject it.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-construction-review.test.mjs
```

Expected RED: evidence/hash/canonical-owner assertions pass, then the absent construction owner/export fails. Do not change production code or create product data in Task 1.

### Task 2: Define the pure construction-review contract and derivation

**Files:** Extend `tests/atmoshaper-signature-sound-construction-review.test.mjs`, then create `lib/atmoshaper/signature-sound-construction-review.js`.

**Why:** This is the bounded canonical owner for interpretation validation, exact note coverage, precedence, state derivation, fingerprints, and deterministic rendering.

**Change Necessity:** No existing owner represents these rules without mixing browser persistence or publication processing.

**Impact / Compatibility:** New inert library only. It does not read the filesystem or mutate inputs.

**Strict RED/GREEN steps:**

1. Retain Task 1's direct-import RED for `validateSignatureSoundConstructionInterpretations`, `createSignatureSoundConstructionReview`, `validateSignatureSoundConstructionReview`, `renderSignatureSoundConstructionReviewJson`, and `renderSignatureSoundConstructionReviewMarkdown`.
2. Build a small synthetic authority fixture containing group and ingredient notes, one removed ingredient, a group speech default, one source speech override, shared resolution references, a playback override, a needs-user-decision rename, and an otherwise approved metadata-only rename with an `audition-requirement`.
3. Add RED mutations for every fail-closed case: unknown fields/types, missing/duplicate/fabricated disposition, changed note text with stale ID, unknown resolution, duplicate resolution reference, unknown group/source/strategy/intent, removed-source processing assignment, source override outside its concept, invalid settings, fingerprint drift, summary drift, output-order drift, and construction hash drift.
4. Add RED assertions for complete speech precedence, shared physical edit reuse without disposition collapse, no-assignment note retention, stale audition state after playback/audio changes, and an `audition-requirement` forcing an otherwise approved metadata-only rename to `needs-rebuild-audition`.
5. Implement only the closed constants, stable JSON/hash helpers, canonical-owner orchestration, interpretation normalizer, exact note-index comparison, resolution normalizer, exact rederivation validator, and renderers required to turn the fixture GREEN. `validateSignatureSoundConstructionReview` always requires the complete authority bundle; no weaker shape-only acceptance export exists.
6. Confirm inputs are deep-equal to pre-call copies and two differently ordered equivalent declarations render byte-identically.
7. Run the focused and adjacent workspace/listening/preview suites.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-construction-review.test.mjs
node --test tests/atmoshaper-signature-sound-listening-review.test.mjs tests/atmoshaper-signature-sound-review-workspace.test.mjs tests/atmoshaper-signature-sound-preview.test.mjs
```

Expected: all pass; synthetic summary proves every note is in exactly one disposition.

### Task 3: Add the no-write-by-default reconciliation CLI

**Files:** Create `tests/atmoshaper-signature-sound-construction-review-cli.test.mjs` and `scripts/atmoshaper-signature-sound-construction-review.mjs`; modify `package.json`.

**Why:** Operators need a deterministic, path-free way to validate an external export and an explicit safe way to replace the single generated owner.

**Change Necessity:** Library calls alone do not supply argument validation, repository input loading, atomic publication, or reread verification.

**Impact / Compatibility:** New script only. Default execution writes nothing.

**CLI contract:**

```text
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>"
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>" --format markdown
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>" --output data/atmoshaper/signature-sound-construction-review.json
```

- Default stdout is deterministic JSON and no filesystem write occurs.
- `--format` accepts only `json` or `markdown` and affects stdout only.
- `--output` accepts only the exact fixed repository-relative owner path.
- Moodist, discovery, strategy policy, committed listening review, and interpretations are loaded from the canonical worktree. Both human exports are explicit read-only arguments so the existing listening and workspace owners can validate the complete authority chain.

**Strict RED/GREEN steps:**

1. Direct-import the absent CLI runner and record RED.
2. Add RED cases for missing/extra export args, swapped v1/v3 inputs, absolute output, `..` escape, alternate repository path, unknown flag/format, invalid JSON, stale export, and path-free error text.
3. Add RED no-write proof for default JSON and Markdown runs.
4. Add RED publication cases for canonical parent containment, directory junction/symlink escape, preexisting output preservation on derivation/write/rename/reread failure, temp/backup cleanup, and successful reread validation through `validateSignatureSoundConstructionReview` with the complete authority bundle.
5. Implement a thin runner that loads JSON, calls only canonical library owners, renders stdout, and uses a same-directory `wx` temp plus backup/rename rollback for the fixed output.
6. Add `"atmoshaper:sounds:reconcile-review": "node scripts/atmoshaper-signature-sound-construction-review.mjs"` to `package.json`.
7. Run focused CLI and pure-owner tests to GREEN.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-construction-review-cli.test.mjs tests/atmoshaper-signature-sound-construction-review.test.mjs
```

Expected: all pass; host-limited file-symlink creation may skip, but the Windows directory-junction containment case must run where junction creation is available.

### Task 4: Author the exact interpretations and generate the construction review

**Files:** Create `data/atmoshaper/signature-sound-construction-interpretations.json` and `data/atmoshaper/signature-sound-construction-review.json`; extend the pure focused test with data-owner checks.

**Why:** The approved human interpretations and their deterministic derived result must become reviewable repository artifacts.

**Change Necessity:** Neither artifact exists. Free-text inference is prohibited.

**Impact / Compatibility:** Adds inert JSON only; no source status or runtime behavior changes.

**Strict RED/GREEN steps:**

1. Add a data-owner test that reads the expected interpretation/output files, performs full authority-bundle validation and exact rederivation, and checks fixed fingerprints, 93 groups, 3,693 projected recordings, 38 dispositions, 36/0/2 state counts, and required named resolutions. Run it before either file exists and record RED.
2. Run the CLI against both real external exports with no output flag. Confirm JSON parses, stdout contains no machine path, and the command writes nothing.
3. Author all 38 exact disposition records and the minimum shared resolution set from the approved matrix. Do not paraphrase `originalNote`; copy it exactly from the normalized projection.
4. Validate that Air Traffic Control is spaced 1-7 with repeat protection 4 and normalization; Horror Suspense is spaced 0-16; Sci-Fi Whistles stays spaced 0-8 with time effect; Walk on Leaves uses repeat protection 3; Underwater Effects retains cadence settings but is `needs-rebuild-audition` after the approved rename.
5. Validate the speech map, especially Busy Street source overrides and no speech-removal assignment for Air Traffic Control.
6. Validate the two removed ingredient notes exist with `no-assignment` and produce no group/source processing assignment.
7. Use the explicit output command once to atomically create the generated owner, then rerun the no-write JSON command and compare its bytes to the checked-in result.
8. Run `--format markdown` and inspect the summary for all unresolved/rebuild groups without claiming processing success.
9. Rerun focused tests to GREEN.

**Real-input verification:**

```powershell
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>"
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>" --format markdown
npm run atmoshaper:sounds:reconcile-review -- "<listening-review-v1-json>" "<complete-review-v3-json>" --output data/atmoshaper/signature-sound-construction-review.json
```

Expected: version 1; 3,693 recordings; 93 groups; 38 dispositions; 36 structured; 0 deferred; 2 needs-user-decision; exact fingerprints; default rerun byte-equals the generated owner; no external path appears; both external exports remain byte-identical.

### Task 5: Synchronize documentation and close the reconciliation slice

**Files:** Modify only the documentation paths listed in the file map after all code/data gates pass.

**Why:** Current state and operator instructions must describe the new inert artifact without overstating audio completion or runtime readiness.

**Change Necessity:** Existing docs end at completed browser review and do not record construction reconciliation.

**Impact / Compatibility:** Documentation only.

**Steps:**

1. Record the exact TaskStartSnapshot and strict RED/GREEN receipts in the Aegis work record.
2. Append a dated project-log entry with file owners, exact counts, command receipts, and no-audio/no-publication boundary.
3. Update project state to say the review is reconciled into construction intent while audio processing, rebuilt auditions, technical QA, qualification, and production runtime remain pending.
4. Add the operator CLI commands and authority chain to the atmosphere-audio wiki.
5. Add an implementation/evidence section beneath the approved design without changing its approval wording.
6. Verify all new local Markdown links, balanced fences, and absence of machine-absolute paths.
7. Run focused, adjacent, full repository, and diff checks once from the catalog worktree.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-construction-review.test.mjs tests/atmoshaper-signature-sound-construction-review-cli.test.mjs
node --test tests/atmoshaper-signature-sound-discovery.test.mjs tests/atmoshaper-signature-sound-listening-review.test.mjs tests/atmoshaper-signature-sound-review-workspace.test.mjs tests/atmoshaper-signature-sound-preview.test.mjs tests/atmoshaper-sound-processing-plan.test.mjs
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
git status --short
```

Expected: zero failures. Any documented pre-existing warning must be identified as unrelated; a real failure is not waived. Git status contains only pre-existing paths plus the plan-authorized reconciliation paths. No audio extension or binary diff is present.

## Risks

- **Semantic overreach:** An implementation might convert desired outcome into an unapproved filter. Mitigation: intent strings plus QA state, no executable processing recipe.
- **Disposition drift:** A later export may add/change notes. Mitigation: workspace hash and exact note-set equality fail closed.
- **Approval overstatement:** Existing approvals could be misread as approval of processed audio. Mitigation: audio-affecting resolutions force rebuilt audition and docs retain pending gates.
- **Source precedence bug:** Busy Street defaults could incorrectly obscure sources that require full removal. Mitigation: explicit speech family replacement tests on exact source IDs.
- **Removed-source mutation:** Notes could accidentally reactivate removed ingredients. Mitigation: only `no-assignment` is valid for those two exact locators.
- **External-path leakage:** CLI errors/output could expose the Downloads path. Mitigation: generic labels and explicit no-machine-path tests.
- **Atomic-write regression:** Failure could truncate the current owner. Mitigation: same-directory temp, backup/rename rollback, reread validation, and injected-failure tests.

## Retirement

No implementation path is retired. The external export remains human evidence; the browser UI remains for future concepts; discovery/listening data remain immutable inputs; the construction review becomes the sole normalized owner of post-review intent for this export. A future UI-native construction editor may replace the hand-authored interpretation declaration only through a separately approved migration that reproduces the same fingerprints and dispositions.

## Execution Handoff

Execution route: inline in the catalog worktree. Start with Task 1 RED, stop at each task's GREEN and compatibility receipts, and do not begin Task 4 real publication if the export fingerprints/counts differ from this plan. After Task 5, request an independent code/spec review before any Git publication or audio-processing plan.
