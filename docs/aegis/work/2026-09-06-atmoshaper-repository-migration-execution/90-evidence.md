# AtmoShaper Repository Migration Execution Evidence

## Setup receipt — 2026-09-06

- `git rev-parse --show-toplevel`: `C:/Users/derri/code/my_projects/massagelab`.
- `git branch --show-current`: `codex/atmoshaper-migration-preflight`.
- Start `HEAD`: `3cb3f893d6b6e5a93aa3d7c243351f88f286deae`.
- Local `main`: `fa78ca01a42179329cc223df77c76f308e76320b`.
- Tracked `origin/main`: `fa78ca01a42179329cc223df77c76f308e76320b`.
- Live GitHub `dsbowersock/massagelab` `main`: `fa78ca01a42179329cc223df77c76f308e76320b`.
- `git status --porcelain=v2 --branch`: branch header only; no path entries.
- `git diff --name-only` and `git diff --cached --name-only`: empty.
- `git worktree list --porcelain`: one root checkout on the preflight branch.
- Active operation checks: `rebase-merge`, `rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, and `BISECT_LOG` all absent.
- Superpowers workspace: `.superpowers/sdd/2026-09-06-atmoshaper-repository-migration/`; Git-ignored and plan-specific.
- Aegis workspace helper: not present in the installed Aegis package; lifecycle records are maintained directly under this directory.

## Current evidence state

- This evidence now includes Tasks 1 and 2 only; it is not a complete Phase 1 or Phase 2 gate result.

## Task 1 receipt — source lock and authority

- Selected source: `dsbowersock/massagelab` `main` at `fa78ca01a42179329cc223df77c76f308e76320b` on 2026-09-06.
- Fresh pre-commit coordinator check: local `main`, tracked `origin/main`, and live GitHub `main` all returned the selected SHA.
- Toolchain: Node `v24.15.0`, npm `11.12.1`, Git `2.55.0.windows.3`.
- Created: `docs/rebrand/atmoshaper-migration-charter.md` and `docs/rebrand/atmoshaper-rollback-plan.md`.
- Review: specification content compliant after the coordinator-owned post-review commit sequencing ruling; quality review found one missing parity-asset retirement trigger; fix round 1 added it; scoped re-review marked it addressed with no new breakage.
- Verification: staged paths exactly matched the two Task 1 documents; cached and final diff checks passed; no unstaged path remained; authority design/plan commits read back correctly.
- Commit: `67545daee7773985f2b975ee4ccd7cadb80a6021` (`docs: lock AtmoShaper migration source`), exactly two added files, post-commit status clean.
- Protected state: runtime, `main`, old history, historical `.git/REBASE_HEAD`, providers, database, deployment, DNS, payment, email, media, and legal ownership remained untouched.

## Task 2 receipt — migration boundaries and exact export manifest

- Locked-source inventory: 1,856 Git-tracked files totaling 37,102,557 bytes across 41 top-level partitions.
- Created: the reference inventory, exact JSON export manifest, external-account checklist, domain cutover plan, local-data/PWA plan, cleanup register, and refactor register.
- Exact export contract: one omitted source path, five replaced paths, 37 Task 5 additions, six Task 6 additions, and 37 overlay paths; Task 5 total `1,856 - 1 + 37 = 1,892`; final total `1,856 - 1 + 37 + 6 = 1,898`.
- Omission proof: only `.agents/refactor/2026-06-21-refactor-anatomime-session-wrapper.md` is omitted; it is a completed historical planning artifact with no live reference.
- Prospective artifacts: the parity spec plus 24 planned snapshots are absent from the locked source and must be reconciled by Task 3 before export.
- Specification review correction: 112 historical plans were regrouped into 22 entries whose files have identical complete owner sets; fresh re-review passed.
- Quality review correction: the active Ably realtime integration was added as a distinct provider boundary with unverified configuration state, isolated staging verification, rollback, and no credential or message mutation; fresh re-review passed.
- Compatibility notes: the shipped catalog remains 51 concepts, while 84 is retained only as historical research scope; the service worker's delete-all-noncurrent-caches activation behavior is recorded as a Phase 8 local-data hazard; proprietary licensing and exact-file provenance requirements remain preserved.
- Verification: the seven staged paths exactly matched the task contract; JSON sets were safe, sorted, unique, mutually consistent, and matched the embedded Markdown contract; cached/final diff checks passed; no unstaged path remained.
- Commit: `421a4f5ecf53012bf6af19a385b8a82f82b4883f` (`docs: inventory AtmoShaper migration boundaries`), exactly seven added files, post-commit status clean.
- Protected state: runtime, `main`, old history, providers, credentials, messages, database, deployment, DNS, payment, email, media, and legal ownership remained untouched.
