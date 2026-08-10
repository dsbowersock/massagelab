# Admin Background Credit Grants Evidence

## Setup and baseline

- Refreshed `origin/main` to `93d21f591ed17427997d60e2ac6da92ffec98116`, the verified PR #176 merge commit.
- Created the isolated `codex/admin-background-credit-grants` worktree from that exact commit; the root checkout's active rebase marker remains untouched.
- Ran repository-documented `npm install`; no manifest or lockfile change resulted. The install reported aggregate audit findings; no audit-fix mutation was authorized or run.
- Ran `npm run prisma:generate`: passed.
- Ran focused Admin access/operation and background-credit provisioning/redemption tests: 55/55 passed.
- Ran `npm run typecheck`: passed.

## Pending evidence

- Coordinator Task 15 commit.
- Whole-branch review, terminal validation, and PR loop.

## Task 14

- Genuine RED: the focused grant test failed because `grantAdminBackgroundCredits()` was not exported.
- Initial GREEN: 11/11 focused and 66/66 focused/adjacent tests, with typecheck, lint, and diff check passing.
- Stage 1 spec review found that a verification timestamp without a usable target email could mutate credits. Repair RED was 11/12; GREEN was 12/12 and 67/67 adjacent, with null/blank email rejected before any write. Spec re-review approved.
- Stage 2 quality review found that an absent wallet prepared as balance `0` could never pass a post-provision comparison against canonical balance `2`. Repair RED was 10/13; GREEN was 13/13 and 68/68 adjacent. The transaction now binds prepared balance `0`, actual pre-Admin balance `2`, and the resulting balance while rolling initial provisioning and the Admin grant back together. Quality re-review approved.
- Coordinator fresh verification: 68/68 focused/adjacent tests, typecheck, and full lint passed.
- Scope: `lib/commerce/credit-service.ts` and `tests/admin-background-credit-grant.test.mjs`; no schema, UI, manifest, lockfile, or mail-transport change.
- Coordinator commit: `ea327ef8215c9d310b35864c496e0369e805ba07`; committed diff and clean status read back.

## Task 15

- Genuine RED: the focused UI/action contract ran 10 tests with 9 expected failures before the new action/form/page integration existed; the browser source contract was the sole pass.
- Initial GREEN: 10/10 focused, then 129/129 focused/adjacent tests, with typecheck, lint, and diff check passing.
- Stage 1 spec review found self-target failed-delivery copy promised a suppressed retry control and query-string cache invalidations did not match Next pathname tags. Repair RED had 3 expected failures; GREEN was 11/11 and 130/130 adjacent. Spec re-review approved.
- Stage 2 quality review found confirmation survived amount changes, self-target delivery uncertainty still implied retry, and preset selection lacked pressed/group semantics. Repair RED had 3 expected failures; GREEN was 13/13 and 132/132 adjacent. Quality re-review approved with 99/99 reviewer-focused tests.
- Final contract: positive-only 1–25 grants, truthful missing-wallet `0 -> +2 -> +amount` preview, explicit fresh confirmation after amount changes, stable operation key, one Task 14 service call, locked pending-only delivery/replay recovery, truthful self-target copy, pathname revalidation, and accessible preset state.
- Real Playwright was not executed because neither `DATABASE_URL` nor `MASSAGELAB_BROWSER_QA_DATABASE=1` is available. The exact disposable-database and SMTP-blank owned-server source/fixture contracts are covered; no real database or email mutation occurred.
- Coordinator fresh verification: 115/115 focused/adjacent tests, typecheck, full lint, and `git diff --check` passed. Lint emitted only the existing Babel large-file deoptimization note for the Chimer timer.
