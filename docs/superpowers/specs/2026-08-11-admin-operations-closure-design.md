# Admin Operations Closure Design

Date: 2026-08-11

Status: Approved design

Baseline: `origin/main` at `18926ca1f169bc6155a4afb7d6129659dca04c3a` after PR #179

## Purpose

Close the remaining correctness and activation gaps discovered after the Admin User Operations program, then improve the operator queue without expanding mutation authority. The work is intentionally split into four serial branches so password security, Stripe reconciliation, Production activation, and read-only operator navigation remain independently reviewable and reversible.

## Goals

1. Make password-reset consumption atomic, globally invalidating for outstanding reset links, and session-invalidating for both self-service and Admin-requested resets.
2. Let an exact Stripe goodwill transaction reconcile after unrelated Customer balance activity without weakening transaction identity, amount, currency, mode, or idempotency checks.
3. Verify and, when necessary, deploy the four Admin-era Prisma migrations through a rehearsed and fail-closed Production procedure, then complete real disposable-database browser acceptance.
4. Turn existing Admin metrics and evidence into useful privacy-safe work queues while preserving directory navigation context.

## Non-goals

- No impersonation, bulk account mutations, direct credit subtraction, automatic Stripe replacement transaction, or ordinary goodwill reversal control.
- No new hosted clinical or PHI-bearing storage.
- No live Stripe invoice credit during activation or browser QA.
- No automatic Production database seeding, reset, destructive schema command, or broad data export.
- No support-case subsystem in this program. A future privacy-bounded case record remains a separate design problem.
- No change to the accepted at-least-once email-delivery boundary.

## Serial branch structure

### Branch 1: Password-reset integrity

This branch owns reset-token consumption, password replacement, and authentication invalidation. It applies the same consumption contract to links created through ordinary self-service and Admin support.

#### Transaction contract

1. Validate the request shape, hash the raw reset token, and capture one request time.
2. Ask the existing reset-confirmation owner for a lightweight, read-only eligibility lookup using only the token hash, unconsumed/unexpired predicates, the captured time, and an identifier-only projection. If ineligible, return the existing safe expired-or-used response without hashing the password or opening the confirmation transaction.
3. If eligible, hash the new password outside the database transaction.
4. Enter a serializable transaction with the same token hash and captured time, then atomically claim the submitted token only when it is still unconsumed and unexpired. This compare-and-set is the sole concurrency authority; the preceding read is only an abuse-cost optimization.
5. If the claim affects no row, return the same safe expired-or-used response without changing the password.
6. Update or create the target password credential.
7. Consume every other outstanding reset token for that user in the same transaction.
8. Increment `User.authSessionVersion` exactly once.
9. Delete Prisma `Session` rows for adapter compatibility without presenting their count as active JWT sessions or users signed out.
10. Commit all effects together. A rollback leaves the prior password, token states, version, and compatibility sessions unchanged.

Concurrent submissions of the same token must produce exactly one successful password change. A losing request cannot overwrite the winner. If two different outstanding links race, the first successful transaction consumes the other link before it can change the password.

Ordinary self-service consumption does not create an Admin action, target Activity entry, or account-change email intent. An Admin-requested reset retains the immutable evidence created when the request was issued, but link consumption does not create a second Admin evidence bundle.

#### Authentication result

Incrementing `authSessionVersion` invalidates existing JWTs immediately in version terms. Auth.js observes the invalidation when an old token next reaches a successful database-backed refresh. Compatibility Session deletion remains secondary and must not be described as an exact active-session count.

### Branch 2: Billing-goodwill reconciliation correctness

This branch changes how historical provider evidence is interpreted; it does not broaden eligibility, amount limits, live gates, or mutation entry points.

#### Exact transaction verification

A known Stripe balance transaction is authoritative historical evidence only after validating:

- its exact balance-transaction identifier;
- the expected Stripe Customer;
- test/live mode;
- `usd` currency;
- the exact negative credit amount;
- the originating local operation and idempotency evidence; and
- a safe, non-positive historical `ending_balance`.

The transaction's `ending_balance` is the immediate balance after that provider transaction. It must not be derived from the earlier preview or required to equal `startingBalanceCents + amountCents`, because an invoice or another balance event can legitimately occur between the pre-create read and provider creation.

#### Local evidence and presentation

- Persist the transaction-time ending credit derived from the exact historical transaction.
- When a current Customer read is available, treat its balance as a separate observation and label it as current rather than historical.
- Activity, email, and Admin copy describe the transaction-time balance as immediately after this credit and never claim it is the Customer's current balance.
- A later invoice, refund, or balance adjustment cannot prevent the exact goodwill transaction from reaching `VERIFIED`.

Identity, Customer, currency, mode, amount, malformed readback, or missing-transaction mismatches remain unresolved and fail closed. Reconciliation never invents a replacement operation or new Stripe idempotency key.

The branch must also recheck fresh full-Admin authority immediately before the provider create boundary. Durable preparation still records the originating Admin, while a revoked Admin cannot cross into a new financial provider mutation after revocation becomes visible in the database. When that fresh check denies the invocation that created and still owns a never-attempted `PREPARED` operation, it atomically records `FAILED_BEFORE_MUTATION` with `ADMIN_AUTHORITY_REVOKED`; replays, lost ownership, and possibly committed attempts retain their canonical unresolved state.

### Branch 3: Production activation and browser acceptance

This is an operational branch and runbook checkpoint. Migration deployment is authorized when the audit proves Production is behind, but every identity and rehearsal gate remains mandatory.

#### Migration inventory

The expected Admin-era migrations are:

1. `20260808090000_admin_authorization_audit_foundation`
2. `20260808093000_admin_jwt_session_version`
3. `20260808100000_admin_temporary_feature_access`
4. `20260808110000_admin_billing_goodwill`

#### Deployment flow

1. Fetch the sanitized Production project ID, branch ID, database name, and direct endpoint hostname from the authenticated Neon console or approved API, then bind the read-only Prisma migration status connection to that independently obtained identity. Never accept the pooled runtime connection or treat values parsed only from a connection string as identity proof.
2. Compare the complete statefully parsed database migration-status section with the exact migration inventory on merged `main`.
3. If all migrations are already applied, record sanitized evidence and do not rerun them.
4. If any are missing, create an explicitly identified disposable Neon branch cloned from Production.
5. Require the pending set to be one contiguous terminal suffix of the four expected Admin migrations, then run `prisma migrate deploy` on the clone. A gap, arbitrary subset, older migration, or unrelated pending migration is unexpected drift and stops the flow.
6. Run schema validation, migration status, focused Admin suites, and read-only schema/data-shape checks against the clone.
7. Stop for unexpected drift, an unknown migration, a failed rehearsal, an ambiguous database identity, or a direct/runtime connection mismatch.
8. If rehearsal is exact and clean, refresh the trusted Production identity and pending suffix, produce a target-specific fingerprint from that identity, exact commit, suffix, and status timestamp, and stop for fresh user authorization naming that fingerprint. Only then run `prisma migrate deploy` once using the direct migration connection scoped to that child process.
9. Rerun Production migration status and record only sanitized migration names/statuses—never connection strings, credentials, or database rows.

Before creating either disposable branch, check the trusted control plane for orphaned Admin-operations rehearsal/QA branches from an interrupted run. Every disposable lifecycle uses `try/finally`; deletion and trusted control-plane absence verification run after success or failure, and incomplete deletion proof blocks the rollout.

No seed, reset, development migration, destructive SQL, Prisma Studio session, or broad export belongs in this flow.

#### Production read-only smoke

Confirm the exact merged commit is deployed, then perform read-only checks for:

- full-Admin access to user directory and detail;
- Reviewer access to anatomy review without account/commerce administration;
- Editor access to anatomy review and edit without account/commerce administration;
- ordinary-user denial;
- safe account, entitlement, billing, security, and Activity projections; and
- dashboard/directory counts loading without schema errors.

Keep `ADMIN_BILLING_GOODWILL_LIVE_ENABLED` absent or false. Do not perform a Production role change, token revocation, password request, 2FA reset, background-credit grant, temporary grant, email retry, or Stripe credit as part of activation.

#### Disposable browser acceptance

1. Create a separately identified QA database with all migrations applied. It must be distinct from Production and from the migration-rehearsal clone; the rehearsal clone is never reused for browser QA.
2. Populate it only from an approved synthetic or sanitized QA seed whose provenance is recorded. Do not copy or query Production rows to assemble the fixture.
3. Prove database identity before enabling `MASSAGELAB_BROWSER_QA_DATABASE=1`.
4. Require a Playwright-owned server with SMTP variables blanked.
5. Run the full Admin User Operations spec in both desktop and mobile Chromium.
6. Retain the billing fixture's presentation-only Stripe client and server-action mutation guard; assert zero matching form submissions and POST requests for billing goodwill.
7. Verify exact fixture cleanup in foreign-key-safe order.
8. Delete the disposable database and verify through the trusted Neon control plane that it is absent. Missing or inconclusive deletion evidence blocks acceptance rather than becoming a warning.

### Branch 4: Admin queue navigation

This branch is read-only except for URL and navigation state. It adds no mutation capability.

#### Directory context

- Carry a validated internal return URL from the directory into account detail.
- Preserve search, supported filters, sort, and page size.
- Reject external, malformed, or unsupported return URLs.
- Treat a cursor as navigation context, never authority. If it is stale, return to the first page while retaining safe non-cursor filters.

#### Actionable queues

Dashboard and directory metrics link to canonical filters for:

- billing reconciliation;
- failed notification;
- commerce review;
- temporary access expiring within 30 days; and
- the existing broader unresolved view.

Directory rows show privacy-safe type badges and counts without exposing provider identifiers, raw failure messages, payment instruments, internal notes, or mutation evidence. Temporary-expiry queries use one captured request time and an exclusive 30-day endpoint.

Completed Admin actions revalidate the affected detail, directory, dashboard, Account, and Activity owners already established by the program. Returning from detail restores useful queue context.

## Error handling

- Password-reset token conflicts return the existing generic expired-or-used response. They do not reveal whether another request consumed the token.
- Database serialization conflicts use bounded established retry behavior. In addition to the existing top-level retry codes, Prisma adapter `P2039` retries only when `meta.driverAdapterError.cause.originalCode` is exactly `40P01` or `55P03`; other adapter shapes, messages, and uniqueness failures remain terminal.
- Stripe reconciliation preserves the canonical unresolved state for ambiguous provider evidence. It never downgrades a possibly committed operation to definitely-not-mutated.
- Migration or database identity ambiguity stops the operational flow before mutation.
- Browser QA stops before fixture provisioning when database identity, sentinel, server ownership, or SMTP isolation is unproven.
- Queue parsing ignores unsupported values and falls back to safe defaults without redirecting to an external URL.

## Validation strategy

Every implementation branch follows strict RED/GREEN development, focused spec review, quality review, comprehensive validation, hosted PR review, and the user-controlled merge gate.

### Password-reset acceptance

- concurrent same-token submissions yield one success;
- two different outstanding links cannot both change the password;
- all outstanding tokens become consumed after success;
- `authSessionVersion` increments once;
- compatibility sessions are deleted without overclaiming JWT counts;
- old JWTs fail after the next successful database-backed refresh;
- expired, already-consumed, missing, and rollback cases remain safe; and
- missing, expired, and consumed links stop before password hashing, while a post-gate race still receives the identical generic invalid response;
- Prisma adapter-shaped deadlock and lock failures retry through the one shared bounded owner, including different-token contention;
- self-service and Admin-requested links use the same consumption owner; and
- successful consumption creates exactly zero new `Activity`, `AdminAction`, or email-intent records. For an Admin-requested link, the request-time evidence remains unchanged and consumption creates no second evidence bundle.

### Billing acceptance

- an intervening invoice or balance adjustment does not strand the exact credit;
- transaction-time and current balances remain separate;
- wrong Customer, amount, currency, mode, transaction, and malformed readback fail closed;
- exact replay and concurrent reconciliation create no replacement credit;
- the original evidence bundle remains immutable; and
- authority revoked before provider creation prevents the create call.

### Activation acceptance

- disposable migration rehearsal and post-deploy migration status pass;
- the four expected migrations are applied exactly once;
- read-only role-matrix and projection checks pass on the exact deployed commit;
- desktop and mobile Admin browser suites pass against the disposable migrated database;
- SMTP and billing mutation guards remain closed;
- fixture cleanup succeeds; and
- the QA fixture provenance is an approved synthetic or sanitized seed in a separate QA database, with no Production-row copy and no migration-rehearsal-clone reuse; and
- the disposable database is deleted and verified absent through the trusted control plane, with acceptance blocked until that verification succeeds.

### Queue acceptance

- exact parser and filter-query contracts;
- dashboard/count/filter agreement;
- deterministic forward and previous cursor behavior;
- safe internal return URLs and external-URL rejection;
- stale-cursor fallback with retained filters;
- exact 30-day clock boundaries;
- responsive and keyboard-accessible navigation; and
- privacy assertions for badges, URLs, and result payloads.

Each code branch must also pass affected tests, adjacent regressions, typecheck, lint, full unit tests, the Production build, and `git diff --check`. Schema-changing or operational branches additionally run Prisma generation and validation.

## Documentation and evidence

Each branch updates `docs/project-state.md` and `docs/project-log.md` when its state changes. Stable operational behavior belongs in the Admin runbook and release checklist. Migration deployment records sanitized migration names and results only. Disposable browser evidence records the approved synthetic/sanitized seed provenance, separate QA-database purpose, and blocking cleanup/deletion outcome without connection strings, credentials, copied Production rows, or reuse of the migration-rehearsal clone.

## Rollout order and gates

The branches merge serially in this order:

1. Password-reset integrity
2. Billing-goodwill reconciliation correctness
3. Production activation and browser acceptance
4. Admin queue navigation

Branch 3 refreshes from merged Branches 1 and 2 before migration rehearsal and acceptance. Branch 4 starts only after activation evidence is recorded. Every PR stops at the user's merge gate. Any request for a live Stripe credit remains a separate authorization naming the controlled account and exact amount.
