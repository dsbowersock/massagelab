# Admin Security Support Intent

## Requested outcome

Complete Branch 5 of the approved Admin User Operations program: give freshly verified full Admin operators bounded, auditable session revocation, standard password-reset delivery, and explicitly confirmed two-factor reset controls.

## Slice Card

- Goal: implement and validate Branch 5 Tasks 12 and 13 without expanding Admin access or exposing authentication secrets.
- Parent plan/spec: `docs/superpowers/plans/2026-08-08-admin-user-operations-program.md` and `docs/superpowers/specs/2026-08-08-admin-user-operations-program-design.md` in the preserved program-design checkout.
- Files: the Branch 5 service, action, user-detail, browser-test, focused-test, mail-helper, and canonical documentation owners named by Tasks 12 and 13.
- Boundary: full Admin only; no self-target lockout operations, password access/setting, secret or backup-code exposure, impersonation, background-credit work, temporary access, Stripe mutation, PHI, or live email in automated tests.
- Verification: task-focused tests and two-stage review per task; then Prisma validation when relevant, typecheck, lint, full unit suite, production build, exact desktop/mobile Admin browser QA on an approved disposable database, diff check, whole-branch review, and GitHub PR review loop.
- Stop: complete only after Branch 5 is reviewed and merge-ready; pause for a new architecture/authority decision, unsafe database or mail boundary, missing disposable-browser authority, or live external mutation.

## Baseline and compatibility locks

- Exact base: `origin/main` at `3cab3b03a5fe705cb15949356dbe41ec186af85c`, the merge of PR #175.
- Canonical read order: `docs/project-state.md`, `docs/project-log.md`, `docs/wiki/index.md`, then the approved program design/plan and `docs/wiki/admin-user-operations.md`.
- Branch 4 correction: `User.authSessionVersion` is the canonical JWT invalidation owner. Security session revocation and 2FA reset must increment it atomically; deleting Prisma `Session` rows is compatibility-only and its count is not an active JWT-session count.
- Shared owners: fresh full-Admin database authority, serializable transaction helper, immutable Admin action/activity/email bundle, locked email-intent delivery, auth token hashing/normalization, and generic privacy-safe logging remain canonical.
- Password resets persist only a token hash and expiration. Raw reset tokens exist only in memory for standard mail delivery and are never written to audit, activity, email-intent, or result payloads.

## Execution Readiness View

- Intent lock: bounded login remediation only.
- Scope fence: Tasks 12 and 13; Branches 6-8 remain untouched.
- Baseline lock: merged main plus approved design/plan and Branch 4 JWT correction.
- Compatibility boundary: existing password-reset/auth-mail paths and JWT invalidation behavior must remain compatible.
- Retirement boundary: Prisma Session-row deletion is not presented as JWT-session truth.
- Task batches: Task 12 service, spec review, quality review, coordinator commit; then Task 13 UI/browser/docs, spec review, quality review, coordinator commit.
- Test obligations: secret-boundary, stale-state, idempotency, self-target, transaction, delivery, accessibility, desktop/mobile, and no-real-email coverage.
- Drift rule: stop if a schema/auth/mail owner not covered by the approved plan is required.
- Cleanup owner: the coordinating agent owns `codex/admin-security-support` and `.worktrees/admin-security-support` through successful PR merge and proven integration.
