# AtmoShaper Signature Sound Catalog Intent

## TaskIntentDraft

- Requested outcome: retain Moodist's 84 concepts as a baseline, replace its unresolved audio with verified Signature Sounds candidates, add a fourth list for strong Signature-only concepts, and build a strict-TDD audit/processing pipeline.
- Scope: catalog inventory, candidate declarations, evidence tiers, deterministic four-list reporting, processing-plan validation, and documentation.
- Success evidence: exact 84 inventory; measured local scan; deterministic four outcomes; fail-closed processing plan; independent task reviews; relevant regression suite; no raw media in Git.
- Stop condition: done when all scoped tasks and review/verification gates pass; otherwise stop as blocked, needs-verification, or scope-exceeded with the next safe action.
- Non-goals: runtime ambient playback, media upload, R2/provider mutation, deployment, push, merge, accepted UI edits, saved mixes, commerce, or claiming listening approval without human evidence.
- Risk hints: site-wide versus pack-specific license evidence, third-party-looking filenames, false semantic matches, absent audio toolchain, and accidental raw-media inclusion.

## TaskStartSnapshot

- Worktree: linked worktree `.worktrees/atmoshaper-catalog-audit`
- Branch: `codex/atmoshaper-catalog-audit`
- HEAD: `63385adfb12e04fcf07d8679516124a055305832`
- Status: clean immediately before the first task-owned write.
- Accepted UI server: `http://localhost:3012/music` returned 200 and remains untouched.
- Reserved unrelated residue: the accepted design worktree's `debug.log`; never touch.

## BaselineReadSetHint

- `AGENTS.md`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/superpowers/specs/2026-08-21-atmoshaper-design.md`
- `docs/wiki/atmosphere-audio.md`
- `docs/superpowers/plans/2026-08-22-atmoshaper-overlay-drawer-preview-ui.md`
- user-provided AtmoShaper catalog handoff and 2026-08-23 decisions

## BaselineUsageDraft

- Required refs: all BaselineReadSetHint entries plus current Moodist and Signature Sounds evidence.
- Acknowledged refs: all.
- Cited refs: parent plan and this intent.
- Missing refs: none for implementation; listening decisions remain deliberately unmade.
- Decision: continue.

## ImpactStatementDraft

The package adds a new build-time catalog owner without changing the accepted mixer UI/runtime. Its highest-impact rule is fail-closed eligibility: discovery candidates and interesting extra concepts remain visible without becoming production-qualified.

## Execution Readiness View

- Intent Lock: Moodist taxonomy retained; Moodist binaries retired; fourth Signature-only list required.
- Scope Fence: audit and processing planning only.
- Baseline Lock: plan refs and TaskStartSnapshot above.
- Compatibility Boundary: no accepted UI/runtime changes and no external mutations.
- Task Batches: inventory/model; scanner/report; processing planner; docs/handoff.
- Test Obligations: strict RED/GREEN for code/data tasks.
- Review Gates: spec review, then quality review, per task.
- Drift/Rewind Rules: incomplete evidence cannot be represented as qualified.
- Evidence Required Before Completion: see parent plan.
- Advisory Boundary: method-pack execution guidance only; not completion or publication authority.

## Follow-up curation intent — 2026-08-23

- Requested outcome: preserve the fingerprint-matched human listening export, apply the confirmed source/group precedence, and keep composition candidates active with dynamic playback strategies.
- Scope: exported-review validation, deterministic normalized curation, human-owned strategy policy, and development-page projection.
- Non-goals: production runtime implementation, exact timing calibration, qualification, processing, audio mutation, upload, deployment, push, or merge.
- Success evidence: every one of the 926 proposed sources has a normalized decision; explicit Rejects remain source-only; only unmarked proposed sources become contextual Maybe; excluded/unclassified sources are untouched; all concept groups remain active and receive a dynamic strategy; the real export regenerates byte-identically; focused and repository checks pass.
- Stop condition: complete only with verified curation and projection; otherwise stop as needs-verification, blocked, or scope-exceeded.
- Plan: `docs/superpowers/plans/2026-08-23-atmoshaper-signature-review-curation.md`.
- Baseline usage: the original catalog baseline, exhaustive-discovery plan/manifest, supplied export, and the user's three confirmations are acknowledged; no baseline is missing.
- Execution readiness: intent is locked to curation, scope is fenced away from production playback, compatibility retains discovery and qualification state, and strict RED/GREEN applies to the new contract and its page consumer.

## Audible review follow-up intent — 2026-08-23

- Requested outcome: perform each proposed group strategy audibly before approval and retain `/dev/candidates` for future concept review.
- Scope: closed preview settings, authoritative Keep/Maybe source binding, reusable scheduling logic, one-at-a-time browser audition, and a versioned export of the exact heard configuration.
- Non-goals: production player integration, audio processing or copying, technical/listening/processing qualification, publication, upload, deployment, push, merge, or commit.
- Success evidence: strategy-specific timing is audibly previewable; only non-rejected ingredients enter the chosen pool; approval requires current-config audition evidence; setting changes invalidate stale approval; raw recording review remains available; focused and repository verification pass.
- TDD route: strict. Contract, scheduling, and page-consumer RED must be observed before the preview owners and UI exist.
- Complexity boundary: extract the pure scheduler, browser player adapter, and preview controls instead of expanding the existing group-review component into a second responsibility.

## Shared recording and concept workspace intent — 2026-08-24

- Requested outcome: preserve all earlier browser review work while splitting recording and concept review into two focused pages backed by one local workspace and one complete export.
- Scope: v3 fingerprint-bound workspace and legacy migration; per-concept source inclusion/removal and notes; multi-concept and custom-concept assignment; exact-source audition identity; shared route/provider state; targeted ingredient playback.
- Non-goals: production playback/catalog promotion, source qualification, audio processing/copying, server/database persistence, upload, deployment, staging, commit, push, or merge.
- Success evidence: v1/v2 state migrates without deletion; one recording can differ across concepts; custom concepts appear immediately; exact included IDs drive preview/approval; both pages export one deterministic JSON; focused and repository verification plus live route/audio checks pass.
- Stop condition: complete only when Tasks 6–10 in the approved parent plan are verified; otherwise stop as needs-verification, blocked, or scope-exceeded with legacy data preserved.
- TDD route: Mode off, Decision strict, with explicit authority carried by the active catalog/review workstream. Every new contract and behavior receives an observed RED before production code.
- Change necessity: code-change. Existing separate localStorage writers and exports cannot express or synchronize exact per-concept ingredients.
- Complexity boundary: add one bounded workspace owner/provider and extract the ingredient UI instead of adding a new responsibility to the approximately 420-line group-review component.
- Baseline usage: the original candidate-review plan, immutable discovery manifest, imported listening curation, v1 recording draft, v2 group review, current preview owner, and the user's approved 2026-08-24 design are acknowledged; no required baseline is missing.
- Execution readiness: intent, scope, baselines, legacy preservation, sole-v3-owner rule, exact-source approval boundary, Tasks 6–10, test obligations, and rewind rules match the approved plan amendment.

## Post-review construction reconciliation intent — 2026-08-25

- Requested outcome: preserve the two completed human exports and derive one deterministic construction review that reconciles every group/ingredient note into closed playback, processing, metadata, source, diagnostic, audition, or removed-source outcomes.
- Parent plan: `docs/aegis/plans/2026-08-25-atmoshaper-signature-review-reconciliation.md`.
- Scope: immutable evidence fixtures, exact authority validation, 38 construction dispositions, source-over-group precedence, deterministic JSON/Markdown, one no-write-by-default CLI, and documentation sync.
- Non-goals: audio decoding/editing/encoding/copying, DSP method selection, technical/listening/processing qualification, production runtime or scheduler changes, publication-ledger changes, provider/upload/deployment work, staging, commit, push, or merge.
- Strict authority: Mode off, Decision strict, inherited from the active catalog/review workstream's explicit route. Every production/data owner begins with an observed failing test.
- Evidence boundary: 57 non-empty overall-recording notes are exact v1-to-v3 inherited listening evidence. Construction disposition coverage applies separately to 27 group and 11 ingredient notes.
- Stop condition: done only when all five plan tasks and independent review pass; otherwise stop as blocked, needs-verification, or scope-exceeded without changing audio or external state.
