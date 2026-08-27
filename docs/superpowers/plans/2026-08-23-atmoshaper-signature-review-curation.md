# AtmoShaper Signature Review Curation and Dynamic Strategy Plan

**Goal:** Import the fingerprint-matched Signature Sounds listening export into a repository-owned, auditable curation artifact; preserve each explicit source decision and note; interpret only unmarked proposed candidates as contextual Maybes; and attach active group-level dynamic playback strategies without qualifying or publishing any audio.

**Architecture:** Add a listening-review owner beside the existing discovery owner. It validates the browser export against the immutable discovery manifest, applies the user-confirmed decision precedence, and derives concept-group summaries from canonical manifest identities. A small human-owned strategy declaration defines dynamic strategy families and concept-specific overrides, with an adaptive dynamic sequence as the fallback. The generated curation JSON is data for review and future runtime design; it does not change the production candidate declaration, processing planner, or audio runtime. The development candidates page projects the committed curation and group strategies while keeping local draft controls separate.

**Tech Stack:** Node.js ES modules and built-in tests; closed JSON schemas; deterministic JSON rendering; Next.js App Router and React; existing development-only candidate page.

**Baseline/Authority Refs:** `AGENTS.md`; `docs/project-state.md`; `docs/project-log.md`; `docs/wiki/index.md`; `docs/wiki/atmosphere-audio.md`; `docs/superpowers/plans/2026-08-23-atmoshaper-signature-candidate-review.md`; `data/atmoshaper/signature-sound-review.json`; user export `atmoshaper-signature-review-a22a9d19d8.json`; and the user-confirmed rules recorded in this conversation.

**Compatibility Boundary:** Do not alter the 84 Moodist identities, discovery classifications, explicit source Rejects, production Signature declaration, qualification gates, processing plan, generated noise, saved mixes, runtime, provider, hosted manifests, R2, deployment, or production routes. Do not serialize the local Signature root or the external export path. No audio is copied, edited, encoded, uploaded, or committed.

**Approved follow-up:** The user approved a group-centric strategy review after the source-level curation. The development page must let the user approve a proposed group strategy or mark it for changes, choose a replacement from the four existing strategy families, leave group-level notes, and export the sparse review against the exact curation fingerprint. This remains browser-local design review and does not make any group production-approved.

**TDD Route:**

- Mode: off.
- Decision: strict.
- Strict authority: the active parent catalog workstream already records a strict route for this review contract.
- Test posture: strict RED tests for export validation, source-level precedence, group independence, deterministic curation, and the development-page projection.
- Verification: focused producer/consumer tests, real-export import, deterministic regeneration, adjacent catalog/runtime-boundary tests, full repository validation, and page source/runtime checks.

## Requirement Ready Check

- Requirement source: the reviewed JSON plus the user's three explicit confirmations.
- Source decision rule: Keep and Maybe remain explicit; Reject excludes only that recording and never rejects its group.
- Unmarked rule: only proposed candidate sources without a decision, including a note-only entry, become contextual Maybe. Excluded and unclassified discovery sources remain untouched.
- Playback rule: groups stay active and use dynamic playback. Needing sequencing, cadence, crossfading, overlap, or other assembly is not a deferred status.
- Named strategies: snow/gravel/stone/moon footsteps use cadence sequencing; Horror uses dynamic end-to-end/crossfade variation; Keys Jingling uses dynamic event sequencing with end-to-end/crossfade treatment; whistles use appropriately spaced events; crowds, public places, waves, and similar recordings use shuffled whole-source sequences with transition treatment selected for the group.
- Open blocker questions: none.
- Decision: ready.

## Change Necessity and owner checks

- Browser localStorage and a Downloads export are not durable project state, so a data-only note is insufficient.
- The existing discovery owner classifies inventory and must not own listening decisions or runtime-strategy interpretation.
- Add `lib/atmoshaper/signature-sound-listening-review.js` as the closed validation and derivation owner. Keep the importer as thin I/O wiring and keep the page as a projection consumer.
- Store strategy policy separately from generated curation so human intent remains readable and regeneration remains deterministic.
- Decision: code change with new bounded owner and data artifacts.

## Complexity budget

- Do not add listening-review responsibility to the 453-line discovery owner.
- Keep the new listening-review owner below 500 maintained lines and its test below 600 lines.
- Keep the importer below 200 lines.
- Candidate page changes are projection-only and should keep the 295-line component below its existing 600-line budget.

## Files

- Create `data/atmoshaper/signature-sound-playback-strategies.json` for human-owned strategy families, default behavior, and concept overrides.
- Create `data/atmoshaper/signature-sound-listening-review.json` as the deterministic normalized result of the supplied export.
- Create `lib/atmoshaper/signature-sound-listening-review.js` for closed validation, precedence, group derivation, fingerprints, and rendering.
- Create `scripts/atmoshaper-signature-sound-listening-review.mjs` and add a named npm import script.
- Create `tests/atmoshaper-signature-sound-listening-review.test.mjs`.
- Modify `app/dev/candidates/page.tsx` and `candidate-review.tsx` to project curated decisions and group strategies without replacing browser-local draft state.
- Modify `tests/atmoshaper-dev-candidates.test.mjs` for the projection contract.
- Create `lib/atmoshaper/signature-sound-group-review.js` for the closed browser-export contract without adding review state to the curation owner.
- Create `app/dev/candidates/group-strategy-review.tsx` for the group-centric review workflow; keep recording review in `candidate-review.tsx`.
- Create `tests/atmoshaper-signature-sound-group-review.test.mjs` for fingerprint, identity, decision, strategy, and deterministic-export coverage.
- Update `docs/wiki/atmosphere-audio.md`, `docs/project-state.md`, and `docs/project-log.md` after verified behavior exists.

## Task 1: Closed listening-review contract

1. Write failing fixture tests for exact manifest fingerprint, exact source-ID membership, allowed export fields, allowed decisions, notes, candidate-only decision coverage, and rejection of unknown or excluded/unclassified promotion.
2. Verify RED for the missing owner.
3. Implement the minimum validator and normalized decision derivation.
4. Verify GREEN and source-copy safety.

## Task 2: Dynamic group-strategy contract

1. Write failing tests proving explicit Reject is source-only, all 926 proposed sources receive a normalized decision, note-only and missing proposed entries become contextual Maybe, and excluded/unclassified sources receive no listening decision.
2. Require every proposed concept group to remain active even if it currently has zero non-rejected ingredients.
3. Require the confirmed cadence, Horror, Keys, whistles, crowds, public-place, and waves strategy mappings; require every other active group to inherit the adaptive dynamic fallback; forbid a deferred strategy/state.
4. Implement the closed strategy validator and deterministic group derivation, then verify GREEN.

## Task 3: Import the supplied export

1. Add a thin CLI that reads the external export, current manifest, Moodist inventory, and human-owned strategy declaration.
2. Validate before writing and atomically publish only `data/atmoshaper/signature-sound-listening-review.json` inside the current worktree.
3. Import the supplied `a22a9d19d8` export and verify expected explicit and contextual totals, exact export/manifest fingerprints, no machine path, and byte-identical second regeneration.

## Task 4: Candidates-page projection

1. Write failing consumer coverage requiring the committed curated review and group strategy summary on the development-only page.
2. Show committed decision origin and playback strategy separately from the editable browser-local draft; never silently mutate or clear localStorage.
3. Keep individual rejected cards filterable and show their group as active.
4. Verify focused page tests, typecheck, and a local page response.

## Task 5: Closeout

1. Update current-state, history, and the Atmosphere Audio runbook with the normalized totals, decision precedence, active strategy families, and explicit non-production boundary.
2. Run focused and adjacent suites, full `npm run test`, `npm run typecheck`, `npm run lint`, Prisma validation if package state requires it, `npm run build`, and `git diff --check`.
3. Confirm no audio/binary, absolute machine path, provider/runtime/production, upload, deployment, push, or merge change.

## Task 6: Group strategy approval workflow

1. Write failing owner tests for a versioned sparse group review whose fingerprint exactly matches `curationSha256`, whose group IDs and strategy IDs are canonical, and whose only decisions are `approve` or `change` with a note.
2. Write failing page-consumer coverage requiring one group-review owner, group cards, source-decision counts, proposed/selected strategy details, Approve and Needs changes controls, localStorage isolation from the recording review, and a fingerprinted JSON export.
3. Verify RED for the missing owner and component.
4. Implement the pure closed export validator/renderer and a separate `GroupStrategyReview` client component. Keep all 93 groups visible and active; zero-ingredient groups remain reviewable and visibly need sources.
5. Replace the confusing `Committed curation` and `Committed dynamic playback strategies` labels with source-review and proposed-strategy language. Do not alter the normalized source decisions or strategy declaration.
6. Verify focused owner/consumer tests, adjacent catalog review tests, typecheck, lint, full tests, build, the live development page, deterministic export behavior, and `git diff --check`.

## Task 7: Audible group-strategy preview and retained review tool

1. Retain `/dev/candidates` as a development-only concept intake and audition surface for this catalog and future concepts; do not schedule its removal with the current review.
2. Write strict failing tests for closed strategy-specific preview settings, authoritative non-rejected source pools, shuffled ordering without immediate repeats, cadence and spaced-event timing, a version-2 review export, and approval only after the exact current configuration has been auditioned.
3. Add a reusable pure scheduling/settings owner and a browser-only player adapter. Keep both separate from production playback, processing, publication, and the server-owned audio-root boundary.
4. Let the reviewer audition one group at a time using Keep plus Maybe or Keep-only ingredients, start and stop playback, advance to the next boundary or event, and tune strategy-appropriate transition, cadence, or spacing controls while listening.
5. Clear stale approval/audition evidence whenever the selected strategy, source pool, or preview settings change. Export the exact heard settings and audition timestamp with each reviewed group.
6. Preserve the lower individual-recording players as ingredient inspection. Explain that raw scheduling preview is design evidence, not final processed loudness, seam, technical, qualification, or production-runtime evidence.
7. Verify focused RED/GREEN, adjacent catalog suites, full tests, typecheck, lint, build, live development-page response, real group/source binding, and `git diff --check` without audio mutation or external publication.

## Risks and retirement

- A group can be active while having zero currently usable recordings; that means the concept remains live but needs another source, not that a rejected recording is restored.
- Dynamic strategy metadata is design input, not proof that the production runtime implements the strategy. Runtime implementation requires a separate behavior slice and browser/audio scheduling acceptance.
- Exact timing, crossfade length, overlap, gain, and cadence jitter remain runtime calibration parameters; this curation records the confirmed strategy family without inventing listening approval for those parameters.
- An `approve` decision on the development page means the proposed or selected design is accepted for the later runtime-design slice; it does not pass listening, technical, processing, publication, or production gates.
- A `change` decision preserves the chosen alternative and note as requested design feedback. It does not mutate the human-owned strategy declaration until a later explicit import/reconciliation slice.
- The import CLI is retained while browser review exports remain part of the catalog workflow. `/dev/candidates` is now an intentionally retained development tool for later concept intake and audition; retire it only through a separate explicit product decision.
