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

1. Validate the request shape, hash the raw reset token, and capture an eligibility time.
2. Ask the existing reset-confirmation owner for a lightweight, read-only eligibility lookup using only the token hash, unconsumed/unexpired predicates, that eligibility time, and an identifier-only projection. If ineligible, return the existing safe expired-or-used response without hashing the password or opening the confirmation transaction.
3. If eligible, hash the new password outside the database transaction. The route does not capture or pass an authoritative claim time.
4. Enter a serializable transaction with the same token hash. Every transaction callback attempt captures a fresh authoritative time from the service-owned clock, including retries after serialization/deadlock/lock conflicts, then atomically claims the submitted token only when it is still unconsumed and unexpired at that attempt's time. This compare-and-set is the sole concurrency authority; the preceding read is only an abuse-cost optimization and cannot preserve eligibility across hashing or retries.
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

The branch must also recheck fresh full-Admin authority immediately before the provider create boundary. Durable preparation still records the originating Admin, while a revocation visible to that check prevents a new financial provider mutation. Only a typed database-confirmed authority denial may let the invocation that created and still owns a never-attempted `PREPARED` operation atomically record `FAILED_BEFORE_MUTATION` with `ADMIN_AUTHORITY_REVOKED`. Infrastructure, adapter, timeout, and unknown authorization failures remain privacy-safe and unresolved/retryable. A revocation that races after the successful check cannot be classified as definitely before mutation; provider ambiguity and reconciliation rules apply, as they do for replays, lost ownership, and possibly committed attempts.

### Branch 3: Production activation and browser acceptance

This is an operational branch and runbook checkpoint. Migration deployment is authorized when the audit proves Production is behind, but every identity and rehearsal gate remains mandatory.

#### Migration inventory

The expected Admin-era migrations are:

1. `20260808090000_admin_authorization_audit_foundation`
2. `20260808093000_admin_jwt_session_version`
3. `20260808100000_admin_temporary_feature_access`
4. `20260808110000_admin_billing_goodwill`

#### Trusted data-safety evidence owner

`lib/admin/admin-operations-data-safety.ts` is the server-only owner of approved data-safety evidence. Its exact branded policy union is `admin-operations-rehearsal-no-phi-v1 | admin-operations-qa-full-schema-v1`, and both policies use immutable exported `ADMIN_OPERATIONS_DATA_SAFETY_MAX_AGE_MS = 300000`. The rehearsal `NO_PHI` policy owns the canonical PHI-bearing workflow/table scope. The QA `DATA_FREE`/`APPROVED_SANITIZED` policy owns every application-schema table and relation—including users, emails/PII, billing, and Admin evidence—and enumerates the only allowed sanitized residual aggregate classes across that full scope. Callers cannot select policy, supply/narrow scope or residual classes, or choose max age. `ApprovedAuthenticatedComplianceSource` and policy values use module-private opaque brands with no public constructor. Verification accepts evaluation `now` only, derives the required policy from purpose, and requires producer brand, exact target/purpose/policy, finite in-bound `checkedAt`, complete scope/aggregate outcomes, allowed residual class, and `PASS`. Serialization exposes only policy, timestamp, aggregate outcome, and owner digest—never rows, values, PHI/PII, emails, credentials, or raw results. Forged source/policy/evidence, caller digest, stale/wrong target/purpose/policy, incomplete scope, unallowlisted residual, non-`PASS`, or row-bearing evidence fail closed. Any compatibility max-age override rejects negative, zero, nonfinite, or over-bound values. Tests include authenticated success for all purposes and a non-PHI Production-derived `User`/email or billing row that fails QA full-schema proof. Wrappers verify parent evidence before create and inherited evidence before work; fixtures cannot substitute.

#### Deployment flow

1. Fetch the sanitized Production project ID, branch ID, database name, and direct endpoint hostname from the authenticated Neon console or approved API, then bind the read-only Prisma migration status connection to that independently obtained identity. Never accept the pooled runtime connection or treat values parsed only from a connection string as identity proof.
2. Compare the complete statefully parsed database migration-status section with the exact migration inventory on merged `main`. Accept child exit `0` only with one complete up-to-date section and exit `1` only with one complete allowed pending-suffix section; reject every other code, signal, or code/content pairing.
3. If all migrations are already applied, record audit `UP_TO_DATE`/`NO_OP` and end activation without rehearsal, attestation, final mode, Production authorization, or deploy.
4. If any are missing, require trusted proof that the exact rehearsal parent passes the documented no-PHI compliance gate. Missing, stale, ambiguous, or row-revealing proof stops before branch creation.
5. Name the disposable rehearsal branch with its required prefix, UTC `YYYYMMDD-HHMMSS` timestamp, and at least 128 cryptographically random bits. Check the exact candidate in the trusted control plane with bounded collision regeneration, bind the exact name, random run suffix, returned branch ID, and owner lease to the run, then create it from the proven-safe parent.
6. Immediately after creation, independently prove inherited rows absent or approved-sanitized. This gate runs before any status, deploy, validation, generation, test, smoke, browser, or fixture work; ambiguity triggers deletion/absence verification and stops the run. Sanitized evidence exposes no rows, values, PHI, credentials, or secrets.
7. Require the pending set to be one contiguous terminal suffix of the four expected Admin migrations, then run `prisma migrate deploy` on the clone. A gap, arbitrary subset, older migration, or unrelated pending migration is unexpected drift and stops the flow. Every Prisma/Playwright owner resolves only this checkout's installed package bin, verifies its installed version/bin against `package-lock.json`, and invokes the JavaScript CLI through `process.execPath`/`execFile` with `shell: false`, exact arguments, and a clean allowlisted child environment. Missing/mismatched local artifacts, malicious `PATH`, or any need for `npx`, download, global, `.cmd`, or PATH fallback stops before spawn.
8. Run schema validation, generation, focused and full tests, migration status, and read-only schema/data-shape checks against the clone. Every status, deploy, validate, and generate command receives database variables through an explicit one-process child-environment wrapper; no database variables are set in the parent shell. The post-deploy status must be one complete `UP_TO_DATE` result with all four migrations `APPLIED`. Every timeout/cancellation terminates and awaits the complete owned process tree before unlock, connection close, fixture cleanup, disposable deletion, or absence verification; inability to confirm descendant exit blocks cleanup. Delete the rehearsal branch, verify its trusted-control-plane absence, and only then issue a short-lived authenticated attestation for the nonempty suffix, bound to the trusted Production target, exact attached clean checkout SHA, audited ordered pending suffix, trusted rehearsal branch/run identity, canonical hashes/outcomes for parent/inherited-data safety, status/deploy/validate/generate/focused/full proof, mandatory `rehearsal_read_only_smoke: PASS` whose canonical hash binds the exact rehearsal target/checkout/suffix, complete post-deploy status, cleanup, and deletion. Its owner atomically creates an `ISSUED` nonce/digest record in the durable cross-process activation store. The attestation expires within 30 minutes, is single-use, and is invalidated by any target/checkout/suffix/proof/branch-absence change; it cannot be refreshed without a complete new rehearsal.
8. Stop for unexpected drift, an unknown migration, a failed or stale attestation, an ambiguous database identity, a dirty/detached/mismatched checkout, or a direct/runtime connection mismatch. Standalone status rejects Production before spawning Prisma; only the Production wrapper may run Production status.
9. With a valid nonempty-suffix attestation, enter the one approved Production activation wrapper. It derives the attached clean checkout SHA and empty status itself from the exact Prisma working directory, compares them to the attestation, generates an unpredictable run ID, and atomically reserves the exact durable `ISSUED` nonce/digest to that run before opening a deploy path. The store holds an exclusive per-nonce owner lock and appends monotonically numbered immutable generation records: exclusively write/fsync a same-directory temp, close, atomically rename to a nonexistent generation, then fsync the parent directory on POSIX before acknowledging. Windows never unlinks an existing destination; it retries only bounded documented sharing violations under the same ownership, reopens/byte-verifies the new generation, and retains blocking ownership/recovery evidence on ambiguity. Since directory fsync is unavailable there, local Windows final mode guarantees orderly/process-crash recovery only; power/machine-loss requires manual Production-status reconciliation, or final mode must use a supported external durable CAS store/POSIX filesystem. Torn temps may be quarantined, but malformed/missing/conflicting generations and any ambiguous `DEPLOY_STARTED` fail closed with no automatic reuse; `CONSUMED` remains terminal. The wrapper opens a dedicated direct connection and polls `pg_try_advisory_lock` with a cancellation-aware 250 ms wait and a 30-second monotonic deadline. Every probe is itself raced against the same abort/deadline; a hung probe causes connection destruction/closure rather than extending the bound. Contention, cancellation, connection loss, or deadline expiry stops before status or deploy. After acquisition it refreshes trusted Production identity and complete status, compares target/SHA/nonempty suffix to the attestation, and produces a semantic fingerprint from the sanitized target, wrapper-derived checkout SHA, and ordered suffix. Record `checkedAt` separately as freshness evidence; volatile timestamps are not part of the fingerprint.
10. While the wrapper retains that same session lock, request a distinct fresh user Production authorization naming the semantic fingerprint through an abort-aware callback with a 10-minute monotonic deadline. Authorization must both arrive before that deadline and name status evidence whose `checkedAt` remains within the same 10-minute freshness bound. Denial, cancellation, timeout, late resolution, or stale evidence stops before deploy. After timely authorization, re-fetch the opaque trusted target evidence and complete migration status under the lock, record a distinct locked-refetch check, recompute the semantic fingerprint, compare it to the attestation, authorization, and first locked fingerprints, record a distinct fingerprint-match check, and validate freshness separately. Immediately before spawn, repeat HMAC/expiry validation, trusted target and rehearsal-absence lookup, clean attached checkout/SHA derivation, nonempty suffix and every proof comparison, and durable proof that the nonce/digest remains `RESERVED` by this exact run.
11. Only the unchanged attestation, authorization, checkout, fingerprint, target-bound `rehearsal_read_only_smoke: PASS`, parent/inherited-data proofs, other proofs, and reservation authorize the store to durably mark this run's nonce `DEPLOY_STARTED`, immediately followed by one child-scoped `prisma migrate deploy`. A safely known failure before that transition releases this run's unexpired `RESERVED` record to `ISSUED`. Any failure or ambiguity after `DEPLOY_STARTED` leaves it durably reserved and blocks automated retry for manual Production-status reconciliation. The wrapper reruns complete Production status under the same lock and requires `UP_TO_DATE` plus all four `APPLIED`; only then does it durably transition the nonce to `CONSUMED`. On child timeout/cancellation it terminates and awaits the full process tree. The canonical migration-lock boundary ends after verified post-status and nonce consumption: unlock if acquired, close the dedicated connection, then invoke a separately owned exact-deployed-commit `production_read_only_smoke` that cannot own, inherit, or delay that lock. At post-status only deploy/post-status checks may be `PASS`; final evidence remains partial until smoke passes, and smoke failure cannot reopen the deploy lock. No manual or second Production deploy path is approved; the cooperative lock does not claim to fence arbitrary external SQL clients.

#### Sanitized activation evidence schema

Status output, audit records, checkpoints, and Aegis evidence use one allowlist-only shape:

```ts
const ADMIN_OPERATIONS_EVIDENCE_CHECK_NAMES = [
  "trusted_identity",
  "orphan_scan",
  "parent_data_safety",
  "inherited_data_safety",
  "migration_status",
  "migration_deploy",
  "prisma_validate",
  "prisma_generate",
  "focused_tests",
  "typecheck",
  "lint",
  "unit_tests",
  "build",
  "rehearsal_read_only_smoke",
  "production_read_only_smoke",
  "browser_desktop",
  "browser_mobile",
  "fixture_cleanup",
  "branch_deleted",
  "final_locked_refetch",
  "final_fingerprint_match",
  "fresh_production_authorization",
  "production_migration_deploy",
  "production_post_status",
] as const

type AdminOperationsEvidenceCheckName =
  (typeof ADMIN_OPERATIONS_EVIDENCE_CHECK_NAMES)[number]

type SanitizedActivationEvidence = {
  schemaVersion: 1
  mode: "status" | "audit" | "final" | "rehearsal" | "qa"
  target: { projectId: string; branchId: string; databaseName: string; directHostname: string }
  commitSha: string
  migrations: Array<{ name: ExpectedMigrationName; status: "APPLIED" | "PENDING" }>
  fingerprint: string
  checkedAt: string
  completedAt: string | null
  outcome: "UP_TO_DATE" | "PENDING_SUFFIX" | "DEPLOYED" | "NO_OP" | "BLOCKED" | "FAILED"
  checks: Array<{ name: AdminOperationsEvidenceCheckName; outcome: "PASS" | "FAIL"; checkedAt: string }>
}
```

`mode` identifies only the execution phase. Checkpoint and Aegis files are destinations that embed the same serialized evidence object, not extra mode values. The serializer constructs this shape field by field, never spreads source objects, and rejects unknown or obsolete names including legacy `readOnlySmoke` and unintended `rehearsalReadOnlySmoke`. Its matrix defines each mode's ordered completion set:

| Mode | Exact required checks | Required outcome |
| --- | --- | --- |
| `status` | `trusted_identity`, `migration_status` | `UP_TO_DATE` or `PENDING_SUFFIX`; never completion authority |
| `audit` | `trusted_identity`, `orphan_scan`, `migration_status` | `PENDING_SUFFIX`, or canonical empty-suffix `UP_TO_DATE`/`NO_OP`; never `final` |
| `rehearsal` | `trusted_identity`, `orphan_scan`, `parent_data_safety`, `inherited_data_safety`, `migration_status`, `migration_deploy`, `prisma_validate`, `prisma_generate`, `focused_tests`, `typecheck`, `lint`, `unit_tests`, `build`, `rehearsal_read_only_smoke`, `branch_deleted` | `DEPLOYED`, complete four-`APPLIED` post-status, verified absence |
| `qa` | `trusted_identity`, `orphan_scan`, `parent_data_safety`, `inherited_data_safety`, `migration_status`, `migration_deploy`, `browser_desktop`, `browser_mobile`, `fixture_cleanup`, `branch_deleted` | `DEPLOYED`, both browser projects, cleanup and absence |
| `final` | `trusted_identity`, `orphan_scan`, `migration_status`, `final_locked_refetch`, `final_fingerprint_match`, `fresh_production_authorization`, `production_migration_deploy`, `production_post_status`, `production_read_only_smoke` | `DEPLOYED`, nonempty attested suffix, complete Production four-`APPLIED` post-status, exact-commit postdeploy smoke |

Evidence validation has two stages. Attempt evidence has overall `BLOCKED` or `FAILED`; it retains `PASS`/`FAIL` truthfully, including failed parent/inherited safety, and contains only mode-allowed checks actually reached in the documented order (plus documented cleanup `finally` edges). Completion evidence has the mode's successful outcome, contains its exact full ordered matrix set once, and every check is `PASS`. Audit `UP_TO_DATE`/`NO_OP` is successful completion with the full audit set. Final completion exists only after `production_read_only_smoke: PASS`; nonce consumption after deploy/post-status remains partial attempt evidence until then. Unknown, duplicate, additional, out-of-order, invented/unreached, mode-incompatible, prohibited, or row-bearing values reject the entire object. Credentials, connection/direct URLs, database rows or values, PHI, emails, raw command output, parent/inherited-data source material, provider transaction/payment/customer/subscription IDs, attestation signing keys, and other secrets remain prohibited. Tests cover every full completion set and allowed partial attempt prefix/cleanup edge.

Before creating either disposable branch, check the trusted control plane for Admin-operations rehearsal/QA names. Every match is a blocking alert. Automatic deletion requires trusted metadata matching the verified run owner/lease plus explicit proof that the lease is stale and its owner cannot still be active; ambiguous ownership or staleness requires operator-reviewed cleanup. Before creation, the exact rehearsal parent must also pass trusted no-PHI compliance proof and the exact QA parent must pass trusted data-free/approved-sanitized proof; synthetic fixture loading does not satisfy either gate. Immediately after creation and before any migration/status/deploy, test, smoke, browser server, or fixture load, independently prove inherited rows absent or approved-sanitized. Missing, stale, ambiguous, or contradictory proof fails closed and triggers deletion/absence verification. Sanitized evidence may expose only target identity, policy/version or approved proof digest, aggregate outcome, and timestamp—never rows, values, PHI, credentials, connection material, emails, or secrets. Every disposable lifecycle uses `try/finally`; deletion and trusted control-plane absence verification run after success or failure, and resume remains blocked until complete absence is proven.

No seed, reset, development migration, destructive SQL, Prisma Studio session, or broad export belongs in this flow.

#### Canonical Production read-only smoke

Confirm the exact merged commit is deployed, then record canonical `production_read_only_smoke` and perform read-only checks for:

- full-Admin access to user directory and detail;
- Reviewer access to anatomy review without account/commerce administration;
- Editor access to anatomy review and edit without account/commerce administration;
- ordinary-user denial;
- safe account, entitlement, billing, security, and Activity projections; and
- dashboard/directory counts loading without schema errors.

Keep `ADMIN_BILLING_GOODWILL_LIVE_ENABLED` absent or false. Do not perform a Production role change, token revocation, password request, 2FA reset, background-credit grant, temporary grant, email retry, or Stripe credit as part of activation.

#### Disposable browser acceptance

1. Before creation, prove through trusted evidence that the exact QA parent is data-free or approved-sanitized. Then create a separately identified disposable QA Neon branch containing the QA database, distinct from Production and from the migration-rehearsal clone; the rehearsal branch is never reused for browser QA.
2. Immediately after creation, prove inherited rows absent or approved-sanitized before migrations, tests, browser startup, or fixture provisioning. Then apply all migrations and populate only from an approved synthetic or sanitized QA seed whose provenance is recorded. The seed is not evidence for either parent or inherited-row safety gate. Do not copy or query Production rows to assemble the fixture.
3. Prove database identity before enabling `MASSAGELAB_BROWSER_QA_DATABASE=1`. The authenticated lookup is asynchronous, and fixture provisioning, cleanup, wrapper/spec gates, billing preview/guards, and their tests must await it before the first transaction, create/delete mutation, or preview-adapter construction; an unresolved Promise never counts as authorization.
4. Require a Playwright-owned server with SMTP variables blanked.
5. Run the full Admin User Operations spec in both desktop and mobile Chromium.
6. Retain the billing fixture's presentation-only Stripe client and server-action mutation guard; assert zero matching form submissions and POST requests for billing goodwill.
7. Verify exact fixture cleanup in foreign-key-safe order.
8. Delete the exact disposable QA Neon branch and verify that branch's absence through the trusted Neon control plane. Missing or inconclusive branch-deletion/absence evidence blocks acceptance rather than becoming a warning.

### Branch 4: Admin queue navigation

This branch is read-only except for URL and navigation state. It adds no mutation capability.

#### Directory context

- Carry a validated internal return URL from the directory into account detail.
- Preserve search, supported filters, sort, and page size.
- Reject external, malformed, or unsupported return URLs.
- Treat a cursor as navigation context, never authority. Transport carries an opaque canonical unpadded base64url token encoding exact canonical versioned JSON `{v: 1, accountId, queryFingerprint}`. The dependency-free parser normalizes non-cursor fields first, awaits `globalThis.crypto.subtle.digest("SHA-256", ...)` over canonical UTF-8 bytes, encodes the 32 digest bytes as exactly 64 lowercase hex characters, validates `^[0-9a-f]{64}$`, and returns branded `AdminUserQueryFingerprint`; arbitrary strings and casts are not fingerprint authority. The cursor encoder accepts only that brand. The decoder validates exact alphabet/length before branding the embedded value, accepts a branded expected fingerprint, and returns `ParsedAdminUserCursor { token, accountId, queryFingerprint }`; the URL builder emits only `.token`, while database predicates compare only `.accountId`. Browser-targeted and server tests share the fixed golden vector: UTF-8 `pageSize=25` produces `32f4c91b2ecbbdbdeb591ad1412b6c5359082e521c91fb7909b9933d741f99eb`; uppercase, short, long, non-hex, and arbitrary strings reject. Every parser, sanitizer, build-preparation helper, URL builder, route, component, server owner, and test that produces or consumes `queryFingerprint` is async and awaited. Pure cursor envelope encode/decode may remain synchronous only with an already computed branded fingerprint. Do not use `node:crypto`, server helpers, hand-rolled crypto, or synchronous digest substitutes. Reject malformed/noncanonical JSON or base64url, wrong versions, query mismatches, double encoding, or unresolved Promises before the transaction. Establish the production `User.id` grammar first from the schema, repository-pinned Prisma generator output, every creation/Auth/import path, and sanitized current-ID shape aggregates; do not assume `cuid()` constrains explicit IDs or invent a regex. Preserve every representative current class in tests and stop for a compatibility/migration decision if the grammar cannot be classified safely. Cursor usability, visible-page selection, and reverse-lookback boundary evidence share one repeatable consistent read snapshot. If the decoded account is stale, return to the first page in that snapshot while retaining safe non-cursor filters.
- Keep query allowlists, async normalization/parser/fingerprint logic, the audited User-ID validator, and cursor codec in one dependency-free browser-safe module imported by both navigation and the server directory module. Prisma predicates and database operations stay server-only. Source/import-graph tests and a browser-targeted import/build proof execute the Web Crypto path and prevent Client Components or the shared browser-safe graph from reaching `node:crypto`, Prisma, auth, Next server APIs, billing, or other Node/server-only dependencies.
- Cursor pagination separates availability from the boundary value. Tokenless page 1 returns `hasPreviousPage: false` and `previousCursor: null`. Page 2 returns `hasPreviousPage: true` and `previousCursor: null`, meaning Previous uses the canonical tokenless page-1 URL. Page 3 and later return `hasPreviousPage: true` with a non-null opaque token created by encoding a decoded exclusive boundary ID exactly once. The UI renders/enables Previous from `hasPreviousPage`, not token truthiness, and the shared URL builder omits `cursor` when the selected previous token is null.
- With `pageSize=2`, map labels `01`-`08` to eight lexically ordered representative account IDs accepted by the audited Production grammar. Ascending pages are `01,02` / `03,04` / `05,06` / `07,08`, with previous response pairs `false/null`, `true/null`, `true/encode("02")`, `true/encode("04")`. Descending pages are `08,07` / `06,05` / `04,03` / `02,01`, with previous response pairs `false/null`, `true/null`, `true/encode("07")`, `true/encode("05")`. Here `encode("ID")` means the `.token` returned by encoding that representative ID with the current normalized-query fingerprint. Every non-null response/URL cursor is that opaque token, never the displayed alias or decoded ID, and tests assert exact token/URL behavior in both directions.

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
- Stripe reconciliation preserves the canonical unresolved state for ambiguous provider evidence, infrastructure/unknown authority-check failures, and revocation races after a successful pre-provider check. It never downgrades a possibly committed operation to definitely-not-mutated; only the typed database-confirmed denial before any provider attempt maps to `ADMIN_AUTHORITY_REVOKED`.
- Migration or database identity ambiguity, unexpected status exit/signal, changed post-authorization semantic fingerprint, stale freshness evidence, or unproven orphan ownership/absence stops the operational flow before mutation.
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
- a token that expires between retry attempts cannot be claimed by the later attempt, and the failed retry leaves every reset mutation uncommitted;
- self-service and Admin-requested links use the same consumption owner; and
- successful consumption creates exactly zero new `Activity`, `AdminAction`, or email-intent records. For an Admin-requested link, the request-time evidence remains unchanged and consumption creates no second evidence bundle.

### Billing acceptance

- an intervening invoice or balance adjustment does not strand the exact credit;
- transaction-time and current balances remain separate;
- wrong Customer, amount, currency, mode, transaction, and malformed readback fail closed;
- exact replay and concurrent reconciliation create no replacement credit;
- the original evidence bundle remains immutable; and
- authority revocation visible to the final pre-provider check prevents the create call and maps only its typed denial to `ADMIN_AUTHORITY_REVOKED`;
- infrastructure/unknown authority failures remain retryable and privacy-safe, while a revocation racing after the successful check remains provider-ambiguous for reconciliation.

### Activation acceptance

- every accepted path begins with the trusted Production audit and ends with trusted status proving all four expected migrations `APPLIED` exactly once; standalone status rejects Production before Prisma spawn;
- when that audit returns an empty pending set, acceptance requires `UP_TO_DATE`/`NO_OP` evidence and proves there was no rehearsal branch, rehearsal attestation, final-mode invocation, fresh Production authorization, deploy attempt, or nonce issuance/reservation/state transition;
- only when the audit returns a nonempty contiguous terminal suffix does acceptance require disposable rehearsal and complete rehearsal post-deploy `UP_TO_DATE`/all-four-`APPLIED` status, followed by verified cleanup/deletion;
- only that nonempty-suffix path issues a fresh authenticated single-use rehearsal attestation binding the trusted Production target, exact clean attached checkout SHA, ordered suffix, rehearsal identity, and proof hashes/outcomes;
- only that nonempty-suffix path enters final mode, where the wrapper derives and rechecks its own clean checkout SHA and records locked refetch, fingerprint match, distinct fresh user Production authorization, deploy, and complete Production post-status as separate passing checks; and
- only that nonempty-suffix path moves the durable nonce atomically through `ISSUED`, this-run `RESERVED`, `DEPLOY_STARTED`, and verified `CONSUMED`; pre-spawn safe failure can release only the owning reservation, while any post-start ambiguity blocks automation for manual reconciliation;
- read-only role-matrix and projection checks pass on the exact deployed commit;
- desktop and mobile Admin browser suites pass against the migrated QA database contained by the separately identified disposable QA Neon branch;
- SMTP and billing mutation guards remain closed;
- fixture cleanup succeeds; and
- trusted pre-creation parent-data proof and immediate post-creation inherited-row absence/sanitization proof pass for both rehearsal and QA before migrations/tests/smoke/browser fixtures, with no rows, PHI, credentials, or secrets exposed;
- the rehearsal attestation contains canonical target-bound `rehearsal_read_only_smoke: PASS`, while deployed Production proof is canonical `production_read_only_smoke: PASS`; legacy `readOnlySmoke` and unintended `rehearsalReadOnlySmoke` are rejected rather than aliased;
- the QA fixture provenance is an approved synthetic or sanitized seed in that separate QA branch/database binding, with no Production-row copy and no migration-rehearsal-branch reuse; and
- the exact disposable QA Neon branch is deleted and its trusted-control-plane branch absence is verified, with acceptance blocked until that verification succeeds.

### Queue acceptance

- exact awaited parser, sanitizer, build-preparation, URL-builder, and filter-query contracts using browser Web Crypto SHA-256, plus browser import/build proof with no Node/server crypto;
- dashboard/count/filter agreement;
- deterministic forward and previous cursor behavior with opaque canonical base64url tokens decoded once to separate account IDs, encoded once at boundaries, and never compared directly in database predicates;
- malformed, double-encoded, and non-canonical cursors fail before database reads in both sort directions;
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
