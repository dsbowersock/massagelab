# AtmoShaper Signature Sound Catalog Intent

## TaskIntentDraft

- Requested outcome: retain Moodist's 84 concepts as a baseline, replace its unresolved audio with verified Signature Sounds candidates, add a fourth list for strong Signature-only concepts, and build a strict-TDD audit/processing pipeline.
- Scope: catalog inventory, candidate declarations, evidence tiers, deterministic four-list reporting, processing-plan validation, and documentation.
- Success evidence: exact 84 inventory; measured local scan; deterministic four outcomes; fail-closed processing plan; independent task reviews; relevant regression suite; no raw media in Git.
- Stop condition: done when all scoped tasks and review/verification gates pass; otherwise stop as blocked, needs-verification, or scope-exceeded with the next safe action.
- Non-goals: runtime ambient playback, media upload, R2/provider mutation, deployment, push, merge, accepted UI edits, saved mixes, commerce, or claiming listening approval without human evidence.
- Risk hints: site-wide versus pack-specific license evidence, third-party-looking filenames, false semantic matches, absent audio toolchain, and accidental raw-media inclusion.

## TaskStartSnapshot

- Worktree: `C:\Users\derri\code\my_projects\massagelab\.worktrees\atmoshaper-catalog-audit`
- Branch: `codex/atmoshaper-catalog-audit`
- HEAD: `63385adfb12e04fcf07d8679516124a055305832`
- Status: clean immediately before the first task-owned write.
- Accepted UI server: `http://localhost:3012/music` returned 200 and remains untouched.
- Reserved unrelated residue: `C:\Users\derri\code\my_projects\massagelab\.worktrees\atmoshaper-design\debug.log`; never touch.

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
