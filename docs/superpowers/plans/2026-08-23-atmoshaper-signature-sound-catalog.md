# AtmoShaper Signature Sound Catalog and Processing Pipeline Plan

**Goal:** Replace Moodist audio binaries with a provenance-first Signature Sounds workflow while retaining Moodist's 84 non-binaural concepts as the comparison inventory. Produce four explicit audit lists: production-qualified Moodist matches, candidates still needing audition or processing, uncovered Moodist concepts, and promising Signature Sounds concepts outside Moodist's 84.

**Architecture:** Keep raw audio, downloaded archives, and license captures outside Git under the caller-supplied audio root. Commit only the canonical concept inventory, curated candidate declarations, audit/processing logic, checksums and derived reports. One catalog-domain validator derives outcome lists from license, technical, and listening gates so documentation and future runtime consumers cannot disagree. Processing planning is fail-closed and read-only by default; it may write only to an explicitly supplied outside-Git output directory and never uploads.

**Tech Stack:** Node.js ES modules, JSON catalogs, Node's built-in test runner, existing MassageLab AtmoShaper contracts, and external audio tools only when explicitly discovered and invoked by a named processing command.

**Baseline/Authority Refs:** `AGENTS.md`; `docs/project-state.md`; `docs/project-log.md`; `docs/wiki/index.md`; `docs/superpowers/specs/2026-08-21-atmoshaper-design.md` lines 200-251; `docs/wiki/atmosphere-audio.md`; `docs/superpowers/plans/2026-08-22-atmoshaper-overlay-drawer-preview-ui.md`; Moodist repository commit `983f7412e8cd054e76d156977c563da2028e4428`; Signature Sounds About page captured 2026-08-23; local Signature Sounds license files and inventory at `C:\Users\derri\code\audio\Signature Samples`.

**Compatibility Boundary:** Preserve the accepted AtmoShaper UI/runtime at `63385adf`; do not edit the accepted design worktree or its reserved `debug.log`; do not add raw media or license captures to Git; do not use Moodist audio binaries; do not upload, deploy, push, merge, mutate R2/provider state, or restart the serving port 3012 process. Existing generated white/pink/brown noise stays native rather than becoming downloaded media.

**TDD Route:**

- Mode: off
- Decision: strict
- Strict authority: explicit user request carried by the accepted AtmoShaper handoff
- Test posture: strict RED test before every source/data-contract implementation slice
- Reason: the catalog outcome rules, evidence tiers, processing contract, and future runtime manifest are new shared contracts where permissive defaults could ship unverified media.
- Verification: each task records the expected RED failure, focused GREEN command, adjacent regression command, independent specification review, independent quality review, coordinator verification, and one scoped commit.

## Aegis Visibility

The critical pressure is not UI complexity; it is keeping provenance, listening judgment, processing readiness, and runtime eligibility under one fail-closed contract while still exposing useful discovery candidates.

## Plan Basis

### Confirmed facts

- Moodist advertises 84 sounds, and its current non-binaural categories contain exactly 84 concepts: 16 animals, 12 nature, 3 noise, 16 places, 8 rain, 16 things, 6 transport, and 7 urban.
- Moodist's current definitions provide asset paths but no per-sound creator, original URL, or license mapping. Its audio binaries therefore remain `upstream-unresolved` and are not candidates for shipment.
- Moodist's five binaural presets are separate from the 84-sound count and AtmoShaper already generates binaural audio natively.
- The local Signature Sounds root currently contains 100 top-level pack directories and 3,693 non-macOS audio files totaling 9,995,726,103 bytes.
- Signature Sounds currently describes its library as CC0, and multiple downloaded packs contain file-level or pack-level CC0 license text.
- Some downloaded collections contain third-party-looking filenames or lack local pack-specific license text. They need a stricter evidence tier than packs with an explicit local CC0 file.

### Assumptions to verify through the pipeline

- Local folder names and filename keywords are discovery signals, not sufficient concept-fit or listening evidence.
- A site-wide CC0 statement may support candidate discovery but does not automatically promote a file past provenance review when the pack appears aggregated from third parties.
- Technical analysis can identify duration, channels, sample rate, clipping risk, silence, and loop-boundary pressure, but it cannot replace human listening approval.

### Unknowns retained as gates

- Which exact Signature Sounds files pass listening review and dense-mix behavior.
- Which candidates need trimming, cleanup, crossfades, channel conversion, or loudness adjustment.
- Which Moodist concepts remain uncovered after exact-path candidate mapping.
- Which extra Signature Sounds concepts are desirable enough to promote from discovery to the product catalog.

## BaselineUsageDraft

- Required baseline refs: all files and external/local evidence named in Baseline/Authority Refs.
- Delivered context refs: user-approved handoff plus the 2026-08-23 decision to use Moodist only as the concept inventory and add a fourth discovery list.
- Acknowledged before plan refs: all required refs.
- Cited in plan refs: all required refs.
- Missing refs: none for audit/pipeline implementation; exact source selections and listening approvals intentionally remain future evidence.
- Decision: continue.

## Requirement Ready Check

- Requirement source refs: AtmoShaper design catalog sections and the user's two 2026-08-23 catalog decisions.
- Goals and scope refs: four-list audit plus catalog/processing pipeline.
- User/scenario refs: a catalog maintainer scans the downloaded library, reviews candidates, records decisions, and produces only verified runtime-eligible manifests.
- Requirement item refs: Moodist-as-taxonomy, Signature-first media, no unclear rights, external raw assets, strict TDD, subagent-driven tasks, no external publication.
- Acceptance/verification criteria refs: exact 84 inventory, deterministic four-list derivation, evidence tiers, external-root scan, fail-closed processing plan, no raw media in Git.
- Open blocker questions: none for audit/pipeline implementation. Human listening remains a planned gate rather than a blocker.
- Decision: ready.

## Change Necessity

- User-visible need: build a trustworthy ambient catalog without relying on unresolved Moodist binaries and expose valuable Signature-only concepts.
- No-change/non-code option: a handwritten report cannot keep thousands of local files, license tiers, checksums, selections, and processing outputs consistent over time.
- Why code change is necessary: deterministic validation and derivation are required to prevent incomplete evidence or review-only candidates from entering a hosted manifest.
- Minimum change boundary: new catalog-domain data/helpers/scripts/tests plus documentation; existing mixer owners receive no new responsibility in this package.
- Decision: code-change.

## Existence Check

- Proposed new surface: AtmoShaper sound-catalog audit and processing owners.
- Existing owner/reuse candidate: the Atmosphere sample-intake/upload scripts are useful patterns but are tightly coupled to Generative.fm sample groups and R2 object layouts.
- Why existing surface is insufficient: this catalog needs concept mapping, four audit outcomes, evidence tiers, human listening state, loop recipes, and a no-upload processing manifest.
- Creation proof: a separate owner prevents the already specialized Atmosphere pipeline and the large AtmoShaper UI/controller files from absorbing unrelated provenance logic.
- Entropy/retirement impact: Moodist audio binaries retire from consideration immediately; the Moodist concept inventory remains a comparison baseline. New files are removable as one bounded catalog package.
- Decision: add-with-proof.

## Architecture Integrity Lens

- Invariant: no runtime-eligible sound exists without exact identity, accepted rights, technical pass, listening pass, and processed-output verification.
- Canonical owner/contract: `lib/atmoshaper/sound-catalog.js` derives states from committed catalog declarations; scripts consume that owner rather than reimplementing eligibility.
- Responsibility overlap: none with `MusicProvider`, the mix controller, or UI components.
- Higher-level simplification: one derived outcome model feeds reports and future manifests.
- Retirement/falsifier: delete candidate declarations that lose provenance; never preserve a compatibility fallback to Moodist binaries.
- Verdict: proceed with new bounded owner files.

## Ripple Signal Triage

- Producer: catalog declarations and audit derivation.
- Consumers in this package: scan report and processing plan.
- Future consumers explicitly excluded: ambient runtime adapter, Sound Library cards, hosted media manifest, and credits UI until approved processed assets exist.
- Verification expansion: producer and both current consumers are tested together; accepted AtmoShaper regression tests run after the package.

## Complexity Budget

- Artifact class: catalog data, pure domain helper, filesystem scanner, processing planner.
- Target files/artifacts: new focused files only; no additions to `mix-controller.js` (636 lines), `current-mix.tsx` (622), or `sound-library.tsx` (576).
- Current pressure: existing runtime/UI owners are already large; catalog ownership is absent.
- Projected post-change pressure: bounded if declarations, derivation, filesystem scanning, and processing planning remain separate.
- Budget result: within-budget.
- Planned governance: one responsibility per module, JSDoc on non-obvious evidence/eligibility rules, no upload code, and exact tests for every fail-closed branch.

## Plan-Time Complexity Check

- Target files: new `lib/atmoshaper/sound-catalog.js`, new scripts, new JSON data, focused tests and docs.
- Existing size/shape signals: current mixer/UI owners range from 576-636 lines and must not grow for catalog work.
- Owner fit: provenance and processing logic belong in independent catalog modules.
- Add-in-place risk: adding these rules to `recipe.js`, `mix-controller.js`, or the Sound Library would mix build-time evidence with runtime/UI responsibilities.
- Better file boundary: isolated catalog/audit/processing files.
- Recommendation: add owner files.

## Execution Readiness View

- Intent Lock: replace Moodist binaries, not Moodist's 84-concept taxonomy; add Signature-only discoveries as a fourth outcome.
- Scope Fence: catalog evidence, candidate mapping, audit reporting, technical processing plan, and documentation only.
- Baseline Lock: exact commit/worktree and authority refs above.
- Approved Behavior: four lists are derived deterministically; only fully gated entries can be production-qualified.
- Owner/Contract Constraints: one canonical eligibility helper; raw media stays external; reports never infer listening approval.
- Compatibility Boundary: accepted mixer UI/runtime stays unchanged; native noise remains native.
- Retirement Boundary: Moodist audio has no fallback path and stays `upstream-unresolved` evidence only.
- Task Batches: inventory/contract; Signature scan and four-list report; processing planner; documentation/handoff.
- Test Obligations: strict RED/GREEN per code/data task, focused and adjacent regressions, then full relevant validation.
- Review Gates: independent specification review before independent quality review for every implementation task; fix and re-review all Critical/Important findings.
- Drift/Rewind Rules: any attempt to mark a candidate qualified without all gates rewinds to the failing test; any upload/runtime expansion pauses for authorization/new planning.
- Evidence Required Before Completion: exact inventory count, deterministic report, real local-root dry run, processing-plan dry run, no-Git-media guard, focused tests, typecheck/lint/regressions, clean diff checks.
- Advisory Boundary: method-pack execution guidance only; not completion or publication authority.

## Task 1: Establish the canonical inventory and fail-closed outcome model

**Files:**

- Create `data/atmoshaper/moodist-concepts.json`.
- Create `data/atmoshaper/signature-sound-candidates.json`.
- Create `lib/atmoshaper/sound-catalog.js`.
- Create `tests/atmoshaper-sound-catalog.test.mjs`.

**Why:** The four lists need one exact inventory and one eligibility owner before filesystem discovery or processing can be trustworthy.

**Change Necessity:** Static prose cannot validate 84 unique ids, category counts, evidence tiers, review state, or fail-closed outcome derivation. The minimum source boundary is one pure helper plus versioned JSON declarations.

**Impact/Compatibility:** No runtime imports and no UI edits. The three Moodist noise concepts declare `native-generated`; the five Moodist binaural presets are not part of this 84-entry file.

**Verification:** `node --test tests/atmoshaper-sound-catalog.test.mjs`.

1. Write RED tests asserting the exact category counts, 84 unique concept ids, supported candidate fields/evidence tiers, rejection of absolute paths and Moodist binaries, and four mutually exclusive derived outcomes.
2. Run the focused test and record an expected module/data-missing failure.
3. Add the 84-entry inventory, initial curated Signature candidate declarations, and minimal validator/deriver. Outcome rules are exact:
   - `qualified-moodist-match`: Moodist concept candidate with accepted license, technical `pass`, listening `pass`, and processing `verified`.
   - `needs-audition-or-processing`: a Moodist concept candidate exists but any non-rejected gate remains incomplete.
   - `recording-or-source-gap`: Moodist concept has no non-rejected candidate and is not native-generated.
   - `signature-extra-concept`: candidate intentionally has no Moodist concept id and has a distinct proposed concept id/name.
4. Run the focused test to GREEN and refactor without changing behavior.
5. Run adjacent recipe/workspace-model tests to prove no AtmoShaper contract regression.

## Task 2: Build the external-root Signature scanner and four-list report

**Files:**

- Create `lib/atmoshaper/signature-sound-scan.js`.
- Create `scripts/atmoshaper-signature-sound-audit.mjs`.
- Create `tests/atmoshaper-signature-sound-audit.test.mjs`.
- Modify `package.json` to add `atmoshaper:sounds:audit`.
- Create/update `docs/superpowers/reports/2026-08-23-atmoshaper-signature-sound-catalog-audit.md` from verified output.

**Why:** A repeatable local-root scan must prove declared packs/patterns exist and present all four lists without copying raw files into Git.

**Change Necessity:** Manual folder inspection cannot reliably detect renamed/missing candidates, archive sidecars, duplicate packs, or exact input checksums.

**Impact/Compatibility:** Scanner is read-only unless an explicit `--report-json` or `--report-markdown` destination is supplied. Repository documentation is updated through reviewed patches, not silently rewritten by ordinary scans.

**Verification:** `node --test tests/atmoshaper-signature-sound-audit.test.mjs`; `npm run atmoshaper:sounds:audit -- "C:\Users\derri\code\audio\Signature Samples"`.

1. Write RED fixture tests for root validation, extension allowlisting, `__MACOSX`/resource-fork exclusion, normalized relative paths, SHA-256 identity, declared pack/pattern resolution, duplicate detection, license-evidence tier summaries, and the four headings.
2. Run the focused test and record the expected missing-module/behavior failure.
3. Implement pure scan helpers and a CLI that defaults to stdout JSON/Markdown summaries, never emits absolute source paths in committed reports, and exits nonzero for declaration or invariant failures.
4. Run the focused test to GREEN and refactor.
5. Run the CLI against the real Signature root, review every declared mapping, and patch the dated report with measured counts and the four explicit lists. Do not promote any entry based only on filename similarity.

## Task 3: Build a fail-closed processing recipe and manifest planner

**Files:**

- Create `data/atmoshaper/sound-processing-recipes.json`.
- Create `lib/atmoshaper/sound-processing-plan.js`.
- Create `scripts/atmoshaper-sound-processing-plan.mjs`.
- Create `tests/atmoshaper-sound-processing-plan.test.mjs`.
- Modify `package.json` to add `atmoshaper:sounds:process-plan`.

**Why:** Approved source files need reproducible trims, fades/crossfades, loudness targets, encodes, checksums, and manifest identities before a later publication/runtime package.

**Change Necessity:** A prose recipe cannot guarantee deterministic versioned object paths or refuse unapproved candidates.

**Impact/Compatibility:** This task plans and validates processing only. It does not upload, edit source files, write into the repository, or create a runtime catalog. Actual encodes require an explicit outside-Git output root and discovered toolchain.

**Verification:** `node --test tests/atmoshaper-sound-processing-plan.test.mjs`; dry-run against a fixture and, when at least one exact candidate is listening-approved, against the real root.

1. Write RED tests for eligibility refusal, exact source checksum matching, bounded trims/crossfades, channel/sample-rate/loudness declarations, immutable output versioning, WebM/Opus plus AAC or MP3 fallback planning, duplicate object rejection, and outside-Git output enforcement.
2. Run the focused test and record the expected missing-module/behavior failure.
3. Implement the minimal recipe validator and deterministic dry-run planner. Tool invocations remain data output unless a later explicitly authorized execution slice is approved.
4. Run the focused test to GREEN and refactor.
5. Run Task 1-3 tests together and verify the planner produces no files in its default mode.

## Task 4: Synchronize audit decisions and hand off the listening/recording queue

**Files:**

- Modify `docs/wiki/atmosphere-audio.md`.
- Modify `docs/project-state.md`.
- Modify `docs/project-log.md`.
- Update `docs/aegis/work/2026-08-23-atmoshaper-signature-sound-catalog/*`.

**Why:** Future work must know that Moodist media is retired, what each list means, what remains unreviewed, and which external actions are still unauthorized.

**Change Necessity:** Documentation/config-only; no source change is necessary in this task.

**Impact/Compatibility:** Record only aggregate/local-path-safe facts. Do not document secrets, provider rows, raw license captures, or absolute per-file paths.

**Verification:** focused catalog tests; `npm run typecheck`; `npm run lint`; relevant deterministic AtmoShaper tests; `git diff --check`; source guard confirming no audio extensions are added.

1. Update the wiki with the four-list vocabulary, evidence tiers, scan commands, listening workflow, and no-upload boundary.
2. Update current state and chronological log only with verified results and exact remaining gates.
3. Run focused tests, typecheck, lint, relevant AtmoShaper regressions, and diff/media guards.
4. Request final independent review of the complete committed range and resolve all Critical/Important findings.

## Risks

- The site-wide CC0 statement may be over-applied to aggregated packs; mitigate with explicit evidence tiers and fail closed where third-party provenance appears.
- Filename matching can produce false concept matches; never convert discovery to listening pass automatically.
- Technical metrics can miss distracting speech, announcements, repetition, or scene mismatch; human listening remains mandatory.
- Large source roots can make repeated hashing slow; cache only outside Git or recompute deterministically without weakening identity checks.
- Encoding tools may be absent from PATH; planning remains useful and must report `needs-toolchain` instead of improvising downloads.

## Retirement and authorization boundaries

- Moodist binaries are retired from the candidate pool now. Only concept ids/names/categories and upstream reference paths remain as research evidence.
- There is no compatibility fallback to Moodist audio.
- Runtime ambient adapters, hosted manifests, Sound Library cards, credits UI, media uploads, R2 changes, deployment, push, and merge require later verified inputs and any applicable fresh authorization.
- A candidate becomes production-qualified only after license, technical, listening, and processed-output gates all pass; losing any gate removes it from that list automatically.

## Execution Route

- Decision: subagent-driven.
- Evidence: the user selected this workflow; tasks have bounded, sequential owners and require independent spec and quality review.
- Fallback: inline only if subagent support becomes unavailable.
- User confirmation required: no for Tasks 1-4 inside the stated boundaries; yes before any upload, deployment, provider mutation, push, merge, or scope expansion into runtime delivery.
