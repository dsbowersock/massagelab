# AtmoShaper Repository Migration Execution Intent

## TaskIntentDraft

- Requested outcome: execute the approved Phase 1-2 plan to prepare MassageLab, build a fresh-history AtmoShaper repository from an exact verified source commit, prove source/destination parity, and publish an unmerged bootstrap review.
- Scope: the ten tasks in `docs/superpowers/plans/2026-09-06-atmoshaper-repository-migration.md`.
- Success evidence: exact source lock; complete inventories and export manifest; passing source and destination gates; fresh-root proof; public `dsbowersock/atmoshaper`; exact remote refs; unmerged PRs; and explicit absence of prohibited mutations.
- Stop condition: done, blocked, needs-verification, or scope-exceeded. Stop before irreversible/destructive, security-sensitive, or unapproved external actions, and on a plan defect that leaves every path forward a guess.
- Non-goals: no runtime rebrand; no merge or deployment; no DNS/domain/provider/environment/database/payment/email/media/legal-owner mutation; no old-repository deletion or history rewrite; no Phase 3-10 implementation.
- Risk hints: source drift, accidental history transfer, unsafe omission, visual/functional drift, private-file publication, persistent-identifier breakage, disposable-QA target misuse, and external publication against the wrong owner/ref.

## TaskStartSnapshot

- Repository root: `C:/Users/derri/code/my_projects/massagelab`.
- Branch/HEAD: `codex/atmoshaper-migration-preflight` at `3cb3f893d6b6e5a93aa3d7c243351f88f286deae`.
- Source candidates: local `main`, `origin/main`, and live GitHub `main` all equal `fa78ca01a42179329cc223df77c76f308e76320b`.
- Status: clean; no staged, unstaged, or untracked paths.
- Git operations: no active merge, rebase, cherry-pick, revert, or bisect. The known standalone historical `.git/REBASE_HEAD` is not an active operation and remains untouched.
- Worktrees: one root checkout only. It is reused because no concurrent-checkout or dirty-state conflict exists.

## BaselineReadSetHint

- `AGENTS.md`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/superpowers/specs/2026-09-06-atmoshaper-repository-migration-design.md`
- `docs/superpowers/plans/2026-09-06-atmoshaper-repository-migration.md`
- current Git tree and live `dsbowersock/massagelab` `main`
- task-specific source/tests/provider docs named by the plan

## BaselineUsageDraft

- Required refs: all BaselineReadSetHint entries.
- Acknowledged refs: canonical project state/log/wiki, approved design/plan, current local/tracked/live Git identities.
- Cited refs: approved design and plan own execution; current state/log supply runtime, legal, provider, AtmoShaper, and verification history.
- Missing refs: none for Task 1; later task-specific evidence remains to be gathered by its owning task.
- Decision: continue.

## TDD Route Guard

- Mode: off.
- Decision: skipped; neither the user nor repository requires strict TDD for this migration.
- Strict authority: none.
- Test posture: characterization before transfer, proportional focused verification, then complete source/destination gates.

## Change Necessity

- User-visible need: establish AtmoShaper as a fresh repository without changing the existing application behavior or losing source/legal/compatibility evidence.
- No-change / non-code option: documentation alone cannot prove byte/classification/visual parity or prevent unsafe/private publication.
- Why changes are necessary: migration authority documents, deterministic parity tests, a classified export, and repository audits are required evidence and safeguards.
- Minimum change boundary: Phase 1 documentation/characterization in MassageLab and Phase 2 fresh-root/audit/verification work in AtmoShaper.
- Decision: code-change only where Tasks 3 and 6 explicitly require migration test/audit tooling; all other slices are documentation, evidence, or Git lifecycle work.

## Execution Readiness View

- Intent lock: fresh AtmoShaper repository from one exact verified MassageLab `main` tree with behavior/design/legal/compatibility preserved.
- Scope fence: approved plan Tasks 1-10 and only Phase 1-2.
- Baseline lock: source SHA must match local `main`, `origin/main`, and live GitHub; any drift rewinds Task 1.
- Owner/contract constraints: MassageLab remains historical/legal source owner; current runtime owners and persistent private identifiers remain unchanged.
- Compatibility boundary: no runtime rebrand or stable identifier/data/schema change.
- Retirement boundary: old repository never retires; parity assets remain through preview rebrand pending a later explicit decision.
- Task batches: Tasks 1-4 source preflight; Tasks 5-10 destination bootstrap/publication/report.
- Test obligations: focused migration tests, full Node suite, both builds, four Browser QA lanes, desktop/mobile parity, audits, exact-hosted checks.
- Review gates: per-task implementer, specification review, quality review, coordinator verification; final whole-branch review.
- Drift/rewind rules: source drift returns to Task 1; failed source gate stops export; failed destination gate stops GitHub creation.
- Evidence required: SHAs, clean statuses, command results/counts, snapshots/hashes, inventories, path equations, fresh-root proof, exact remote refs, hosted check identity.
- Advisory boundary: this work record guides execution; it does not authorize merge, deploy, provider mutation, or completion by itself.
