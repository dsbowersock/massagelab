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

- Coordinator commit/readback for the final Task 18 review correction.
- PR loop: push, hosted checks, fresh re-review, thread resolution, and the user-controlled merge gate.

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
- Coordinator commit: `7a56c9544a35233a8b9d8de2283c4553cac9b82a`; committed diff and clean worktree read back.

## Task 18

- Genuine RED: the initial focused 67-test UI/action/Account/directory/dashboard/fixture run had 16 expected missing-feature failures before production edits. A separate verified-usable-email regression recorded one expected failure before its guard was added.
- Initial GREEN: 67/67 focused, then 200/200 Task 16-18 and adjacent regressions; typecheck, full lint, and diff check passed.
- Spec review found that remaining revoke forms could preserve confirmation across fresh operation keys and browser QA treated preview time as the authoritative service expiration. Repair RED had the two expected failures; GREEN keyed each revoke form by its fresh operation ID and changed browser evidence to assert the persisted 14-day interval and use the persisted expiration. Spec re-review approved.
- Quality review found that directory filters and dashboard metrics counted arbitrary stored feature strings instead of the canonical allowlist. Repair RED had three exact-query failures; GREEN added the five-key predicate to active/none cursor queries and active/expiring metric counts while preserving one request time and the exclusive 30-day endpoint. Quality re-review approved.
- Coordinator Task 18 commit: `9be97fa7a24c5bab3201a3c7b8d4ce8332b839bc` (`feat: add temporary access controls`); committed diff and clean worktree read back.
- Terminal evidence on the final corrected tree: full unit 2,342 passed / 0 failed / 1 intentional skip and production build 104/104 pages.
- Final post-commit review found that `listActiveTemporaryFeatureAccess()` and the complete authorization loader `loadActiveTemporaryGrants()` enforced only the 500-row total ceiling, so malformed persistence could return 101-500 active rows for one allowlisted feature despite the canonical 100-per-feature invariant. Strict repair RED was 61/63 with exactly those two missing rejections. Both owners now count returned rows against their canonical five-key allowlist after the exact query, reject a 101st row for any one feature, accept the valid 100-by-five maximum, and retain the existing 501st total sentinel and query predicates.
- Final correction verification: 63/63 focused loader/UI tests and 202/202 Task 16-18 adjacent tests passed; typecheck, full lint, Prisma validation, and `git diff --check` passed. Lint emitted only the existing Babel large-file deoptimization note.
- Final UI boundary: full Admin, verified usable recipient, complete optimistic snapshot, exact five feature labels, 7/30/90 plus 1-365-day custom duration, stable operation keys, confirmation reset, append-only revoke controls, post-commit locked email delivery, safe replay/self-target copy, request-time Account expiration, and privacy-safe bounded Admin evidence.
- Fixture/browser source covers desktop/mobile grant, authoritative expiration, Account visibility, revoke, fresh confirmation, excluded keys, exact disposable database opt-in, SMTP-blank owned server, and FK cleanup from revocations to grants to exact users.
- Real Playwright was not executed because neither `DATABASE_URL` nor `MASSAGELAB_BROWSER_QA_DATABASE=1` is available. No live database, email, or browser mutation occurred.
- Coordinator fresh verification: 135/135 focused/adjacent tests, typecheck, full lint, and `git diff --check` passed. Lint emitted only the existing Babel large-file deoptimization note.
- PR loop remains pending after the coordinator commits and reads back the final correction.
