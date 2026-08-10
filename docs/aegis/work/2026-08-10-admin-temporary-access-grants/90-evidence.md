# Admin Temporary Access Grants Evidence

## Setup and baseline

- Verified PR #177 merged at `4a275cc6673960b6a8cc2432f98079eb581730ba`; refreshed `origin/main` to that exact commit.
- Created isolated branch/worktree `codex/admin-temporary-access-grants` / `.worktrees/admin-temporary-access-grants`; the protected root checkout's Git-operation marker remains untouched.
- Ran repository-documented `npm install`: passed with no manifest or lockfile change. The install reported 33 aggregate audit findings (1 low, 5 moderate, 27 high); no audit-fix mutation was authorized or run.
- Ran `npm run prisma:generate`: passed.
- Ran `npm run prisma:validate`: schema valid.
- Ran focused Admin access/operation, membership, account-surface, and Admin-detail tests: 73/73 passed.
- Ran `npm run typecheck`: passed.

## Pending evidence

- Task 16 coordinator commit.
- Tasks 17-18, whole-branch review, terminal validation, and PR loop.

## Task 16

- Genuine RED: `tests/admin-temporary-access.test.mjs` failed because `lib/admin/temporary-access.ts` did not exist.
- Initial GREEN: 15/15 focused and 95/95 focused/adjacent tests; Prisma generate/validate, typecheck, lint, and diff check passed.
- Spec review found that unverified targets could mutate and PostgreSQL Serializable waiters could surface narrow `P2002` races from stale snapshots. Repair RED had 6 expected failures; GREEN reached 19/19 and 101/101 adjacent. The service now requires a current verified usable email and converts only the first exact relevant grant/revocation/AdminAction uniqueness race into the established fresh-snapshot restart path. A follow-up test repair replaced an impossible injected uniqueness error with a coherent committed AdminAction winner; spec re-review approved.
- Quality review found that the active list could silently truncate valid sources and revocation replay accepted inconsistent historical evidence. Repair RED had 7 expected failures; GREEN reached 24/24 and 112/112 adjacent. The service now enforces 100 active grants per feature and 500 total across the five-key allowlist, reads a 501st sentinel and fails closed instead of truncating, stores compact deterministic count-plus-SHA256 snapshot evidence, derives revocation effectiveness from remaining IDs, and validates the revocation time inside the grant interval. Quality re-review approved.
- Coordinator fresh verification: 112/112 focused/adjacent tests, Prisma generate/validate, typecheck, full lint, and `git diff --check` passed. Lint emitted only the existing Babel large-file deoptimization note for the Chimer timer.
- Scope remained the planned Prisma schema/migration, temporary-access service, focused tests, and Branch 7 Aegis records. No live PostgreSQL, email, or browser mutation occurred.
