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

- Task 13 focused behavior/browser proof and two-stage review.
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
