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

- Task 17 coordinator commit.
- Task 18, whole-branch review, terminal validation, and PR loop.

## Task 16

- Genuine RED: `tests/admin-temporary-access.test.mjs` failed because `lib/admin/temporary-access.ts` did not exist.
- Initial GREEN: 15/15 focused and 95/95 focused/adjacent tests; Prisma generate/validate, typecheck, lint, and diff check passed.
- Spec review found that unverified targets could mutate and PostgreSQL Serializable waiters could surface narrow `P2002` races from stale snapshots. Repair RED had 6 expected failures; GREEN reached 19/19 and 101/101 adjacent. The service now requires a current verified usable email and converts only the first exact relevant grant/revocation/AdminAction uniqueness race into the established fresh-snapshot restart path. A follow-up test repair replaced an impossible injected uniqueness error with a coherent committed AdminAction winner; spec re-review approved.
- Quality review found that the active list could silently truncate valid sources and revocation replay accepted inconsistent historical evidence. Repair RED had 7 expected failures; GREEN reached 24/24 and 112/112 adjacent. The service now enforces 100 active grants per feature and 500 total across the five-key allowlist, reads a 501st sentinel and fails closed instead of truncating, stores compact deterministic count-plus-SHA256 snapshot evidence, derives revocation effectiveness from remaining IDs, and validates the revocation time inside the grant interval. Quality re-review approved.
- Coordinator fresh verification: 112/112 focused/adjacent tests, Prisma generate/validate, typecheck, full lint, and `git diff --check` passed. Lint emitted only the existing Babel large-file deoptimization note for the Chimer timer.
- Scope remained the planned Prisma schema/migration, temporary-access service, focused tests, and Branch 7 Aegis records. No live PostgreSQL, email, or browser mutation occurred.
- Coordinator commit: `0bccd681046d8c2661bc2e83c4273a0d63a1e3fd`; committed diff and clean worktree read back.

## Task 17

- Genuine RED: initial entitlement/account/Admin tests recorded 11 expected failures for missing temporary-source merging and loader evidence; an incremental auth-wiring RED recorded one expected source-contract failure.
- Initial GREEN: 49/49 focused and 141/141 focused/adjacent tests; typecheck, full lint, and diff check passed.
- Spec review found that the complete authorization loader enforced the 500-row invariant only after an unbounded read. Repair RED required the exact 501-row sentinel; GREEN covered 500 accepted and 501 rejected while preserving the exact predicate, select, order, and complete authorization input. Spec re-review approved.
- Quality review found that an invalid evaluation clock could activate temporary grants and that indistinguishable duplicate source/expiry entries could leak into `featureAccess`. Repair RED had the two expected failures; GREEN validated finite-Date fail-closed behavior, one captured omitted clock, exact source-plus-expiry deduplication, and deterministic retention of distinct sources. Quality re-review approved.
- Final architecture: `lib/membership.js` remains the canonical entitlement owner; additive `featureAccess` preserves deterministic membership/temporary sources while legacy `featureDetails` stays compatible. Auth, entitlement state, uncached Account membership, and Admin Access use the complete active set with one request-time boundary. Admin separately displays at most 25 safe rows with truthful total/truncation evidence.
- Coordinator fresh verification: 86/86 focused/adjacent tests, typecheck, full lint, and `git diff --check` passed. Lint emitted only the existing Babel large-file deoptimization note.
- Scope: the seven planned Task 17 files plus the narrowly necessary `lib/admin/user-detail.ts`; no live database, email, browser, schema, manifest, or lockfile mutation.
