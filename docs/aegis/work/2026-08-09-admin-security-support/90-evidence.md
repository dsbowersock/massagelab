# Admin Security Support Evidence

## Setup

- Refreshed `origin/main` to `3cab3b03a5fe705cb15949356dbe41ec186af85c`, merge commit for PR #175.
- Created `codex/admin-security-support` and its isolated worktree from that exact commit.
- Confirmed the new worktree is clean, tracks exact `origin/main`, and has no active Git operation.
- Ran the repository-documented `npm install` successfully. The install reported the repository's existing aggregate audit findings; no audit-fix mutation was authorized or run.
- Ran `npm run prisma:generate` successfully.
- Ran focused baseline coverage for Admin access, operation service, role service, user-detail Security projection, auth security, and JWT session version: 68/68 passed.
- Ran `npm run typecheck`: passed.

## Pending evidence

- Whole-branch and terminal validation.

## Task 12

- Genuine RED: the focused security-service test failed with `ERR_MODULE_NOT_FOUND` before the production service existed.
- Initial GREEN: 14/14 focused tests and 67/67 combined regressions.
- Spec review found missing 2FA confirmation replay identity, impossible persisted replay evidence acceptance, and incomplete password/2FA concurrency coverage. Focused repair RED was 15 passed/5 failed; GREEN was 20/20 and 73/73 combined.
- Quality review found a production PostgreSQL Serializable snapshot race hidden by the original fake. A faithful fixed-snapshot RED produced 19 passed/3 failed across revoke/password/2FA concurrency. The bounded exact-constraint retry repair passed 22/22 focused and 75/75 combined.
- Stage 1 spec re-review: approved; independent 77/77 plus typecheck passed.
- Stage 2 quality re-review: approved; focused 22/22 plus typecheck passed.
- Coordinator fresh verification: 75/75 focused/adjacent tests, typecheck, and full lint passed. `git diff --check` and no-index checks reported no whitespace errors; only expected LF-to-CRLF notices appeared for new files.
- Scope: `lib/admin/security-service.ts` and `tests/admin-security-service.test.mjs`; no schema, package, lockfile, or `lib/auth-mail.ts` change.
- Coordinator commit: `bc42d87936699cbd5abd51afe2075895360b9076`; exact committed file list and clean status read back, and `git diff --check HEAD^ HEAD` passed.

## Task 13

- Genuine RED: the focused security-UI suite failed 0/12 before the route actions and forms existed.
- Initial GREEN: 12/12 focused, 113/113 focused/adjacent, and 34/34 final refined tests passed with typecheck, lint, and diff check.
- Stage 1 spec review found only two canonical-wiki ownership/state wording mismatches. The wording-only correction passed 50/50 focused tests, typecheck, lint, and diff check; spec re-review approved.
- Stage 2 quality review found Activity rows keyed by display position could remount the submitted password-reset form and discard its live feedback after revalidation. The durable `UserAccountActivity.id` fix recorded a 21/24 RED and 24/24 GREEN, then 114/114 adjacent regressions; quality re-review approved.
- Browser execution remained intentionally deferred because the worktree has neither an approved disposable `DATABASE_URL` nor `MASSAGELAB_BROWSER_QA_DATABASE=1`. Source/harness contracts require the exact sentinel, an SMTP-blank Playwright-owned server, exact-ID cleanup, desktop/mobile controls, and durable submitted-form feedback.
- Coordinator fresh verification: Branch 5 gate 43/43, typecheck, full lint, and diff check passed.
