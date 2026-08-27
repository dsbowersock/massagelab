# AtmoShaper Signature Construction Audition Plan

## Goal

Turn the reconciled playback requirements into exact, audible, development-only construction auditions without processing or copying audio. The retained review tool must let the user hear and explicitly judge the corrected scheduler behavior while keeping audio-processing-dependent groups visibly incomplete.

## Architecture

Add one pure construction-audition owner above the immutable construction review and reuse the existing browser player through an expanded, closed playback policy. Add one separate construction-QA evidence owner so final construction judgments bind the exact construction fingerprint, source/artifact identities, scheduler algorithm, and settings heard. The version-3 source/design workspace remains unchanged.

## Tech Stack

Node.js ESM domain owners and tests, React/Next.js development routes, browser `Audio`, browser-local storage, SHA-256 canonical identities, and the existing Signature source byte-range route.

## Baseline / Authority Refs

- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/wiki/atmosphere-audio.md`
- `docs/superpowers/plans/2026-08-23-atmoshaper-signature-candidate-review.md`
- `docs/aegis/plans/2026-08-25-atmoshaper-signature-review-reconciliation.md`
- `data/atmoshaper/signature-sound-construction-review.json`
- `lib/atmoshaper/signature-sound-construction-review.js`
- `lib/atmoshaper/signature-sound-preview.js`
- `lib/atmoshaper/signature-sound-preview-player.js`
- `lib/atmoshaper/signature-sound-review-workspace.js`

## Compatibility Boundary

- Preserve the version-1 listening export, version-3 complete review, construction interpretations, construction review, discovery/curation fingerprints, source decisions, and current development-review localStorage keys byte-for-byte.
- Keep one browser player owner. Do not introduce parallel scheduling logic or encode scheduler behavior into audio files.
- Keep original source audio read-only and outside Git. This plan writes no derived audio and does not invoke FFmpeg.
- Do not change production playback, qualification, publication, providers, uploads, deployment, Git staging, commit, push, or merge state.
- Construction QA is explicit. Successful `audio.play()` is not approval.

## TDD Route

- Mode: auto
- Decision: strict
- Strict authority: recorded auto decision
- Test posture: strict RED tests before each owner/runtime/UI slice
- Reason: scheduler history, timing ranges, exact audition identity, and stale-evidence behavior are contract-sensitive and easy to overstate through a merely audible preview.
- Verification: focused RED/GREEN, adjacent Signature suites, typecheck, lint, full test, Production build, live development-route readback, and diff/scope checks.

## Aegis Visibility

Planning is required because playback construction adds a new exact-evidence contract while preserving the immutable review workspace and keeping future derived-media processing behind a separate authorization boundary.

## BaselineUsageDraft

- Required baseline refs: all files listed above.
- Delivered context refs: the completed construction-reconciliation checkpoint and independent feasibility/architecture/acceptance reviews.
- Acknowledged before plan refs: all required refs.
- Cited in plan refs: all required refs.
- Missing refs: none for playback construction.
- Decision: continue.

## Requirement Ready Check

- Requirement source refs: returned listening/complete-review exports and the approved construction review.
- Goals and scope refs: exact playback resolutions and `needs-rebuild-audition` group states.
- User/scenario refs: the user needs to hear the implemented construction rather than approve a paper description.
- Requirement items: exact gap ranges, repeat windows, transition range, cadence boundary A/B, next-event overlap, renamed Walking in Puddles audition, and explicit QA.
- Acceptance criteria: machine-verifiable timing/history plus user-owned audible QA bound to exact bytes/settings.
- Open blocker questions: Walk on Stone has `change` with no group note, so it remains visible but blocked; this does not block the eight specified construction auditions.
- Decision: ready.

## Change Necessity

- User-visible need: hear the corrected construction behavior before it is treated as accepted.
- No-change/non-code option: the existing preview can audition fixed transitions and immediate-repeat avoidance only.
- Why code change is necessary: it cannot enforce three/four-selection history, variable transition ranges, explicit cadence boundary treatments, overlap-next-event semantics, or construction-fingerprint-bound QA.
- Minimum change boundary: one pure construction-audition owner, one QA owner, the existing scheduler/player, and one retained development page.
- Decision: code-change.

## Existence Check

- Proposed new surfaces: construction audition projection and construction QA evidence.
- Existing reuse candidates: construction review, preview settings/player, and v3 review workspace.
- Why existing surfaces are insufficient: construction review is inert intent; preview v3 evidence describes raw design review; neither owns processed/rebuilt construction acceptance.
- Creation proof: exact construction fingerprint and scheduler algorithm must be independently bound without mutating historical v3 evidence.
- Entropy/retirement impact: both new owners are bounded to construction QA and remain reusable when derived artifacts arrive; the old v3 workspace is retained as immutable input.
- Decision: add-with-proof.

## Architecture Integrity Lens

- Invariant: an approval names the exact sources/artifacts, scheduler algorithm, policy, and settings heard.
- Canonical owners: construction review for intent; construction audition owner for executable playback projection; construction QA owner for human judgment; existing player for browser execution.
- Responsibility overlap: none. The new owners do not interpret notes, mutate source review, process audio, or qualify publication.
- Higher-level simplification: extend the existing player with one validated construction policy instead of creating a second playback engine.
- Retirement/falsifier: a future production scheduler may consume the same pure policy; the development component remains removable without losing QA evidence.
- Verdict: proceed.

## Complexity Budget

- Artifact class: domain owner, browser adapter, development component.
- Current pressure: preview owner 267 lines; player 244; group preview component 203.
- Projected pressure: keep each new owner under 500 lines and each new component under 450; extract scheduler helpers rather than pushing the existing player above 400.
- Budget result: within-budget if policy math remains pure and UI remains a consumer.
- Planned governance: measure line counts at every task close; split pure timing/history helpers from browser lifecycle if the player approaches 400 lines.

## Execution Readiness View

- Intent Lock: audible reconstruction of approved playback requirements only.
- Scope Fence: development scheduler, QA evidence, and page; no audio processing or production runtime.
- Baseline Lock: immutable discovery, curation, v1/v3 review, and construction fingerprints.
- Approved Behavior: exact ranges/history/boundary behavior recorded in the construction review.
- Owner / Contract Constraints: one player; construction and QA owners remain closed and fingerprint-bound.
- Compatibility Boundary: no v3 migration, source-decision change, or stale approval reuse.
- Retirement Boundary: raw review evidence remains historical; construction QA supersedes it only for the exact rebuilt configuration.
- Task Batches: pure projection, scheduler behavior, QA/page, then repository/live verification.
- Test Obligations: strict RED/GREEN plus timing/history property pressure and stale-identity mutations.
- Review Gates: independent spec/code review before declaring this slice complete.
- Drift / Rewind Rules: stop if a requested behavior lacks a construction resolution, requires media processing, or changes production/runtime ownership.
- Evidence Required Before Completion: focused and repository GREEN, live page response, exact eight-group projection, no media/binary diff, and independent approvals.
- Advisory Boundary: method-pack execution guidance only; not GateDecision, PolicySnapshot, or completion authority.

## Files

Create:

- `lib/atmoshaper/signature-sound-construction-audition.js`
- `lib/atmoshaper/signature-sound-construction-qa.js`
- `tests/atmoshaper-signature-sound-construction-audition.test.mjs`
- `tests/atmoshaper-signature-sound-construction-qa.test.mjs`
- `app/dev/candidates/construction/page.tsx`
- `app/dev/candidates/construction/construction-audition-review.tsx`
- `app/dev/candidates/construction/construction-audition-review.module.css`

Modify:

- `lib/atmoshaper/signature-sound-preview.js`
- `lib/atmoshaper/signature-sound-preview-player.js`
- `tests/atmoshaper-signature-sound-preview.test.mjs`
- `app/dev/candidates/page.tsx`
- `tests/atmoshaper-dev-candidates.test.mjs`
- `docs/wiki/atmosphere-audio.md`
- `docs/project-state.md`
- `docs/project-log.md`
- active Aegis checkpoint/evidence files

## Task 1: Lock the exact construction-audition projection

**Why:** Runtime work must consume structured construction intent rather than repeat note interpretation in the page.

**Change Necessity:** The current preview accepts only v3 strategy/settings/source input and cannot authenticate the construction review.

**Impact / Compatibility:** Pure owner only; no browser, filesystem, media, or data writes.

**Strict steps:**

1. Add a focused test that imports the missing construction-audition owner and expects a projection bound to the exact construction fingerprint and scheduler algorithm `signature-construction-audition-v1`.
2. Assert the queue contains Air Traffic Control, Horror Suspense, Sci-Fi Whistles, Dryer, Walk on Gravel, Walk on Leaves, Moon Footsteps, and Walking in Puddles. Keep Walk on Stone visible as blocked because no requested change is recorded.
3. Assert exact policies: gaps `1–7`, `0–16`, `0–8`; history windows `4` and `3`; Dryer transition range `3.75–10`; Gravel boundary candidates `crossfade|overlap`; Moon explicit next-event overlap; Walking in Puddles `105 SPM / 8%` jitter.
4. Assert processing-dependent groups expose missing-intent blockers and cannot receive a complete construction-QA decision from raw bytes alone.
5. Run the focused test and record missing-owner RED.
6. Implement the closed pure owner with only canonical construction-review fields and fresh copied output.
7. Add unknown-field, stale-fingerprint, fabricated-group, unsupported-policy, and input-mutation pressure.
8. Rerun focused GREEN.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-construction-audition.test.mjs
```

## Task 2: Extend the single preview scheduler for construction policies

**Why:** The user must hear the actual history/timing/boundary behavior, not a paper claim.

**Change Necessity:** Current selection excludes only the immediately previous source; continuous transitions use one fixed duration; cadence has no explicit boundary or next-event-overlap policy.

**Impact / Compatibility:** Legacy v2/v3 settings and audition identities remain byte-compatible. Construction policies use a separate validator and identity path.

**Strict steps:**

1. Add RED tests for rolling source history with windows 3 and 4, including fewer available sources than the requested window.
2. Add RED tests proving every sampled transition duration stays within `3.75–10` and samples a new value per boundary.
3. Add RED tests for cadence `crossfade` and `overlap` envelopes and explicit next-event overlap while retaining 40–180 SPM and 0–30% jitter bounds.
4. Add RED tests that legacy preview settings/keys are unchanged and malformed construction policies fail closed.
5. Implement pure selection/timing/envelope helpers in `signature-sound-preview.js`.
6. Wire those helpers into the existing player without adding a second browser player or counting playback start as QA.
7. Prove Stop/unmount retire all voices, timers, fades, history, and late promise errors.
8. Rerun preview plus construction-audition GREEN.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-preview.test.mjs tests/atmoshaper-signature-sound-construction-audition.test.mjs
```

## Task 3: Add exact construction-QA evidence and the retained review page

**Why:** Audible comparison and explicit judgment are the user-owned acceptance gate.

**Change Necessity:** Existing v3 Approve evidence binds raw design review and is invalid for rebuilt construction.

**Impact / Compatibility:** Adds a separate browser-local record and export. Existing review keys, exports, and routes remain unchanged.

**Strict steps:**

1. Add a missing-owner RED for a version-1 construction-QA record with the construction fingerprint, scheduler algorithm, and sparse per-group decisions.
2. Require each `pass|needs-rework|reject` decision to bind the exact audition identity, timestamp, audible note, and scope `playback-only|complete-construction`.
3. Reject `complete-construction` when required processed artifacts are absent; allow playback-only judgment so spacing/cadence can advance independently.
4. Add stale-source/settings/algorithm/fingerprint, unknown-group, unknown-field, and input-mutation tests.
5. Implement deterministic import/export and a new isolated localStorage key without migrating or deleting v1/v2/v3 records.
6. Add `/dev/candidates/construction` as a retained, development-only page. Show original sources, exact required behavior, blockers, A/B controls, Start/Stop, explicit QA controls, notes, and export.
7. Keep one active player across groups and make every policy/source change stop playback and invalidate only the affected construction-QA decision.
8. Add the hub link and page/source contract tests, then run focused GREEN.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-construction-qa.test.mjs tests/atmoshaper-signature-sound-construction-audition.test.mjs tests/atmoshaper-signature-sound-preview.test.mjs tests/atmoshaper-dev-candidates.test.mjs
```

## Task 4: Verify the playback-construction slice

**Why:** A development page is not accepted merely because it compiles.

**Impact / Compatibility:** Verification and documentation only.

**Steps:**

1. Run focused and adjacent Signature suites.
2. Run typecheck, lint, full tests, and Production build.
3. Read the live page and one original source byte range. Do not restart the existing server unless required for current code.
4. Confirm no audio extension, binary diff, machine path, or external output was added.
5. Update project state/log/wiki and the work checkpoint/evidence with exact receipts.
6. Obtain independent specification and code reviews; correct Critical/Important findings under focused RED/GREEN before closeout.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-construction-audition.test.mjs tests/atmoshaper-signature-sound-construction-qa.test.mjs tests/atmoshaper-signature-sound-preview.test.mjs tests/atmoshaper-dev-candidates.test.mjs tests/atmoshaper-signature-sound-construction-review.test.mjs
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
git status --short
```

## Task 5: Recover an exact returned construction-QA export

**Why:** The reviewer returned valid fingerprint-bound evidence after a restart, but the retained page can only export QA. Replaying already-confirmed setups would discard useful work, and the existing helper text does not clearly say that Start alone is insufficient to enable a decision.

**Change Necessity:** Documentation cannot restore browser-local evidence. The smallest safe change is a closed JSON parser in the existing storage adapter plus import wiring and explicit guidance in the existing construction component.

**Impact / Compatibility:** Import accepts only the current construction fingerprint, scheduler algorithm, closed group identities, and exact configurations through the canonical validator. Invalid input leaves the current in-memory record untouched. Import does not fabricate heard evidence, infer a decision, alter older review keys, or weaken the exact-confirmation gate.

**Complexity Budget:** Keep the storage adapter below 100 lines and the construction component below its existing 450-line limit. Add no owner or responsibility beyond storage/import adaptation and page wiring.

**Strict steps:**

1. Add RED coverage for parsing valid deterministic QA JSON and rejecting stale or malformed JSON without mutating the caller's current record.
2. Add RED page-contract coverage for an explicit JSON import control, canonical validation, playback stop before restoration, and recovery guidance that names Confirm Current Setup Heard.
3. Implement the minimal storage parser and page wiring; restore exact configuration selections, stop active playback, persist through the existing effect, and keep invalid input visible as an error without replacing current QA.
4. Validate the returned export against the current generated audition and record its raw SHA-256 plus the exact preserved/missing-decision counts.
5. Run focused, adjacent, typecheck, lint, diff, scope, and live-route checks. Update checkpoint/evidence and canonical docs without claiming final audible acceptance or derived audio.

**Verification:**

```powershell
node --test tests/atmoshaper-signature-sound-construction-qa.test.mjs tests/atmoshaper-dev-candidates.test.mjs
npm run typecheck
npm run lint
git diff --check
```

## Follow-up Derived-Audio Plan Boundary

After playback construction is auditable, create a separate plan for external derived variants. It must name an explicit absolute output root disjoint from the repository, linked checkout, filesystem root, and Signature source tree; exact batch; recipes; toolchain version; output identity; technical measurements; development-only streaming route; and explicit artifact QA. The first recommended vertical slice is Campfire relative normalization, followed by a user-timestamped Boiling Water trim/loop experiment. Full voice removal and rain/thunder separation must not be claimed from ordinary FFmpeg filters.

## Risks

- **Stale approval:** construction changes could reuse raw v3 evidence. Mitigation: separate fingerprint/algorithm/source/settings-bound QA.
- **Accidental second scheduler:** UI-specific timing could drift. Mitigation: one pure policy and one player.
- **Randomness gaps:** sampled tests could miss range/history failures. Mitigation: injected deterministic random sequences and property pressure.
- **Processing overstatement:** raw playback could be marked fully complete. Mitigation: processing blockers and scoped playback-only decisions.
- **Walk on Stone ambiguity:** a Change decision lacks instructions. Mitigation: visible blocked entry; no inferred setting change.

## Retirement

No existing review path is retired. The source/strategy pages remain available for future concepts; v3 evidence remains historical input. Construction QA becomes the sole evidence for rebuilt playback only when its exact audition identity matches. A later production scheduler can reuse the pure construction policy after a separate production plan and qualification gate.

## Execution Route

- Decision: inline
- Evidence: Tasks are sequential and edit shared scheduler/page contracts; parallel implementation would create overlap.
- Fallback: pause at the latest focused GREEN if runtime evidence or scope drifts.
- User confirmation required: no for Tasks 1–4; yes before any derived-audio write in the follow-up plan.
