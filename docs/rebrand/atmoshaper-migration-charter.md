# AtmoShaper Migration Charter

## Authority

- Approved design: [AtmoShaper repository migration and modernization design](../superpowers/specs/2026-09-06-atmoshaper-repository-migration-design.md) (approved design commit `14f60fc1bc63e12b65b28c353b83e5f159247645`).
- Approved plan: [AtmoShaper repository migration Phase 1-2 implementation plan](../superpowers/plans/2026-09-06-atmoshaper-repository-migration.md).
- Superseded handoff: Derrick's 2026-09-06 AtmoShaper migration handoff supersedes the earlier Stage 1 handoff that kept this work inside `dsbowersock/massagelab`.
- This charter governs source selection for Phases 1-2. The old repository remains the historical archive, evidence source, and rollback source unless separately authorized otherwise.

## Source Lock

- Source repository: `https://github.com/dsbowersock/massagelab`
- Exact selected `main` SHA: `fa78ca01a42179329cc223df77c76f308e76320b`
- Selection date: 2026-09-06
- Local/tracked/live-ref agreement: `git rev-parse main`, `git rev-parse origin/main`, and the authenticated read-only GitHub API query for `repos/dsbowersock/massagelab/commits/main` each returned `fa78ca01a42179329cc223df77c76f308e76320b`.
- Source checkout: `C:/Users/derri/code/my_projects/massagelab` on `codex/atmoshaper-migration-preflight` at `f73c6590752958105363e5dd832b85946328f07a`; the selected source is `main`, not this preparation-branch commit.
- Node version: `v24.15.0`
- npm version: `11.12.1`
- Git version: `git version 2.55.0.windows.3`

`TaskStartSnapshot` command results:

```text
git rev-parse --show-toplevel
C:/Users/derri/code/my_projects/massagelab

git branch --show-current
codex/atmoshaper-migration-preflight

git rev-parse main
fa78ca01a42179329cc223df77c76f308e76320b

git rev-parse origin/main
fa78ca01a42179329cc223df77c76f308e76320b

git status --porcelain=v2 --branch
# branch.oid f73c6590752958105363e5dd832b85946328f07a
# branch.head codex/atmoshaper-migration-preflight

git diff --name-only
(no output)

git diff --cached --name-only
(no output)

git worktree list --porcelain
worktree C:/Users/derri/code/my_projects/massagelab
HEAD f73c6590752958105363e5dd832b85946328f07a
branch refs/heads/codex/atmoshaper-migration-preflight
```

No active rebase, merge, cherry-pick, revert, or bisect marker was present: `.git/rebase-merge`, `.git/rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, and `BISECT_LOG` were all absent. The standalone historical `.git/REBASE_HEAD` was present and left untouched; without an active rebase directory or Git status state, it is not an active operation.

```text
wsl.exe -d Ubuntu -- gh api repos/dsbowersock/massagelab/commits/main --jq .sha
fa78ca01a42179329cc223df77c76f308e76320b

node -v
v24.15.0

npm -v
11.12.1

git --version
git version 2.55.0.windows.3
```

If local, tracked, or live `main` changes before source-baseline work begins, this lock is invalid and Task 1 must be rerun against the newer clean, fully verified `main`.

## Phase Scope

### Phase 1 deliverables

- Establish exact source identity and clean source-state evidence.
- Produce the classified file/reference, compatibility, provider/domain, local-data/PWA, cleanup, and refactor inventories.
- Capture baseline verification, visual, route/bundle, metadata/PWA, and external-boundary evidence without provider or production mutation.

### Phase 2 deliverables

- Create a fresh-root public `dsbowersock/atmoshaper` repository from the locked source without importing MassageLab Git history.
- Record exact lineage, verify source/destination parity, and retain MassageLab as the authoritative history and rollback repository.
- Publish only after Phase 1 and destination verification gates pass; no tag, merge decision, deployment, or production/provider change is implied.

### Explicit later-phase deferrals

- Phase 3 documentation and historical-artifact consolidation.
- Phase 4 evidence-backed dead-code, dependency, and asset cleanup.
- Phase 5 targeted behavior-preserving refactors.
- Phase 6 preview-only public rebrand and the later approved-logo branch.
- Migration-parity assets and their evidence remain through the cleanup, refactor, and preview-rebrand sequence. After Phase 6, an explicit reviewed keep, update, or retire decision is required; neither the old repository nor parity evidence may be silently retired.
- Phase 7 parallel Vercel/environment staging, Phase 8 local-data/PWA transition, Phase 9 provider/account preparation, and Phase 10 production-domain cutover.
- No Phase 1-2 work authorizes runtime rebranding, legal-document changes, provider writes, database writes, DNS changes, or production deployment.

## Compatibility Invariants

- **Runtime and visual parity:** the initial destination must preserve source routes, behavior, responsive geometry, accessibility, keyboard/focus/reduced-motion behavior, feature-key entitlements, APIs, provider-call boundaries, and working visual assets. An unexplained difference falsifies parity.
- **Legal/operator separation:** public product identity may not change the proprietary license, legal operator, copyright ownership, accepted legal text/version/effective date, or acceptance history. No trademark-registration claim is permitted without separate approval.
- **Local-first PHI boundary:** clinical notes, intake, journals, ROM sessions, and encrypted professional-record workflows remain local-first. No phase may automatically transfer PHI or encrypted vault content between origins.
- **Stable private identifiers:** Prisma migrations and objects, `MASSAGELAB_` environment variables, Stripe metadata/idempotency namespaces, auth and security identifiers, browser storage/cache/vault identifiers, R2 identities, export schemas, and durable audit/operation identifiers remain unchanged unless a later dedicated migration proves compatibility and rollback.
- **Atmosphere public label versus internal `atmoshaper` identifiers:** the later public audio label is `Atmosphere` or `Atmosphere mixer`; existing internal `atmoshaper` modules, scripts, data, tests, storage, paths, and release identifiers remain private compatibility identifiers. Global replacement is prohibited.

## Verification Ledger

| Gate | Source result | Destination result | Comparison | Evidence date |
| --- | --- | --- | --- | --- |
| Task 1 checkout and operation state | Clean preparation checkout; one root worktree; no active Git operation. Historical standalone `REBASE_HEAD` retained untouched. | Not created | Not applicable until Phase 2 | 2026-09-06 |
| Task 1 source-ref selection | Local `main`, `origin/main`, and live GitHub `main` all `fa78ca01a42179329cc223df77c76f308e76320b`. | Not created | Exact source lock established | 2026-09-06 |
| Source baseline installation, Prisma, typecheck, lint, tests, builds, Browser QA, and measurements | Passed locally: dependency/schema setup, typecheck/lint, 4,197-test unit suite, both 115-page builds, all four Browser-QA lanes, 22/22 fresh-build no-update migration parity, PWA checks, route/bundle/public-output measurements, and redacted hosted identity readbacks are recorded in the reference inventory. Task 3 parity is committed as `ecd28af0`; Task 4A source-QA hardening is committed as `a8fe56fd`. | Not created | Source gate passed only; destination comparison remains pending | 2026-09-08 |
| Fresh-root bootstrap and source/destination parity | Locked source available | Pending Phase 2 | Pending; no parity claim yet | — |

## Current Status

- Current phase: Phase 1 local preflight is complete through the Task 4 source-baseline gate. The destination repository has not been created.
- Last passed gate: Task 4 local source verification on 2026-09-08 against locked `main` `fa78ca01a42179329cc223df77c76f308e76320b`, with Task 3 parity commit `ecd28af0` and reviewed Task 4A hardening commit `a8fe56fd` carried as declared overlays.
- Current authorization boundary: review-only publication of `codex/atmoshaper-migration-preflight`, creation of a MassageLab pull request, and hosted-check inspection are authorized. No destination repository or deployment, no production or destination provider/DNS configuration, no production database mutation, and no Phase 2 acceptance has occurred. This boundary preserves the disclosed, authorization-bound temporary empty QA-project lifecycle recorded in the source-baseline receipt.
- Next exact action: complete Task 4 Step 10 by publishing the branch for review, opening the MassageLab pull request, and inspecting its hosted checks. Do not merge it or create the destination as part of that review publication.
