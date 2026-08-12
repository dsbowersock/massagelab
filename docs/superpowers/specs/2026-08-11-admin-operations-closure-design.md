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

`lib/admin/admin-operations-data-safety.ts` is the server-only owner of approved data-safety evidence. Its exact branded policy union is `admin-operations-rehearsal-no-phi-v1 | admin-operations-qa-full-schema-v1`, and both policies use immutable exported `ADMIN_OPERATIONS_DATA_SAFETY_MAX_AGE_MS = 300000`. The rehearsal `NO_PHI` policy owns canonical PHI scope; QA owns every application table/relation and exact sanitized residual classes. The compliance source, evidence, and verified PASS result each require runtime authority: module-private class/private fields or separate module-private `WeakSet` registries with no exported constructor, brand, registration hook, or structural unwrapping. `{}`, cloned/spread evidence, structural PASS objects, casts, and swapping evidence for a verified result fail. Verification derives policy/freshness from purpose and returns only a registered opaque result. Serialization exposes only policy, timestamp, aggregate outcome, and owner digest. Forged/stale/wrong/incomplete/row-bearing inputs fail; a Production-derived non-PHI User/email/billing row fails QA full-schema proof.

`lib/admin/admin-operations-fixture-provenance.ts` is the server-only executable provenance owner. It owns immutable source/version allowlists and `ADMIN_OPERATIONS_FIXTURE_PROVENANCE_MAX_AGE_MS = 300000`; separate module-private class/`WeakSet` authorities create the authenticated source, proof, and verified result, with no public constructor/brand/registration hook. Its loader binds safe source version/digest to exact QA project/branch/database and clean commit, and its verifier derives freshness from the owner bound. Plain/forged/cloned/cast, stale/late, wrong source/version/target/database/commit/digest, or row-bearing inputs fail before fixture load/server/browser; an authenticated injected approved source succeeds. `fixture_provenance` is QA-only, may truthfully `FAIL` in attempt evidence, and must `PASS` for completion. Serialization retains only safe version/digest/outcome/timestamp and target/commit binding.

`lib/admin/admin-operations-fixture-state.ts` is the distinct QA-only post-load state owner. It queries only the canonical aggregate fixture assertions, canonicalizes their names/count classes/outcomes, and produces an opaque `fixture_state` proof whose digest binds exact QA target, clean commit, run/lease, and byte-identical passing provenance reference. It serializes no rows, field values, PHI, PII, emails, or secrets. Plain/cloned/forged, pre-load, stale, noncanonical, row-bearing, wrong target/commit/run/provenance, or mismatched desktop/mobile references reject.

#### Deployment flow

The only successful post-status transition is `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)`, producing `CONSUMED` plus the full pending-final payload in the same durable generation before unlock. This explicitly supersedes any standalone transition/consumption shorthand in deployment-flow step 13; tests observe the combined call and payload.

Each sealed execution workspace has a run-owned writable scratch root. Because pinned Next does not support absolute `distDir`, the repository CLI creates `<scratchRoot>/next-project` and materializes only manifest-declared required project inputs. At its standard `node_modules` lookup position, one explicit read-only POSIX bind mount or Windows junction/adapter canonically targets the exact sealed dependency snapshot; this sole reparse/mount exception is verified before/after build, while local, nested, or alternate dependency targets reject. Real pinned Next runs with directory/cwd there. The materialized config validates current-run cwd/input bindings and enables relative `distDir: "next-build"`, producing `<scratchRoot>/next-project/next-build`; normal builds retain `.next`. A pinned-version test uses actual Next config/path semantics and standard `require.resolve` to prove dependencies canonicalize to the sealed target, real build passes, all output stays under scratch, sealed bytes remain unchanged, and the output manifest feeds later consumers. Drift, fallback, escape, stale, or mutation rejects.

1. Before the first trusted-control-plane lookup, orphan scan, direct connection, or other network work, create one outer abortable monotonic preflight deadline. Every phase receives only its bounded remaining time and the same cancellation signal: trusted Production identity, blocking orphan scan, direct connection/handshake, try-lock polling, and preliminary status. The existing 30-second connection-plus-lock bound is a nested maximum, never a new or extending clock. Expiry/cancellation returns by the outer deadline, stops before deploy, and detaches only a quarantined late-result handler that consumes rejection or closes/destroys late success without allowing status, lock, deploy, evidence completion, or any other state transition. Tests hang each lookup/orphan/status phase independently, verify bounded cancellation/cleanup, and prove no downstream call or unhandled rejection.
2. Fetch trusted Production identity, then run the blocking trusted orphan scan, then status, then decide `NO_OP`/pending. Empty suffix cannot exit before the scan; an orphan blocks status and no-op completion.
3. Within the outer preflight bound, start the at-most-30-second direct-connection/try-lock sub-deadline before connection creation. The connector accepts the signal and confirms cancellation/close within remaining time; connect and handshake consume that same sub-bound, and the caller returns/throws within both bounds without awaiting an unbounded original promise. No try-lock/status/deploy follows a failed connect.
4. Compare complete status with merged inventory. Only after `trusted_identity -> orphan_scan -> migration_status` all pass may audit write its completed no-deploy `UP_TO_DATE`/`NO_OP` status packet; activation/checkpoint completion still requires the later bound smoke-reference CAS.
5. If any are missing, require trusted proof that the exact rehearsal parent passes the documented no-PHI compliance gate. Missing, stale, ambiguous, or row-revealing proof stops before branch creation.
6. Name the disposable rehearsal branch with its required prefix, UTC `YYYYMMDD-HHMMSS` timestamp, and at least 128 cryptographically random bits. Check the exact candidate in the trusted control plane with bounded collision regeneration, bind the exact name, random run suffix, returned branch ID, and owner lease to the run, then create it from the proven-safe parent.
7. Immediately after creation, independently prove inherited rows absent or approved-sanitized. This gate runs before any status, deploy, validation, generation, test, smoke, browser, or fixture work; ambiguity triggers deletion/absence verification and stops the run. Sanitized evidence exposes no rows, values, PHI, credentials, or secrets.
8. Require a contiguous suffix, then deploy. Commands use sealed dependency/config authority plus validated materialized current-run inputs/outputs. Tests execute generation -> materialize writable scratch project -> real pinned Next with relative `next-build` -> typecheck/runtime/server/desktop/mobile. Exact path-resolution assertions prove output is within scratch and the sealed root is unchanged; copied-input drift, dependency fallback, cross-run/path escape, or output mutation fails before use.
9. Run the rehearsal evidence sequence exactly as `migration_status -> migration_deploy -> rehearsal_post_status -> prisma_validate -> prisma_generate -> focused_tests -> typecheck -> lint -> unit_tests -> build -> rehearsal_read_only_smoke -> scratch_cleanup -> branch_deleted`. `rehearsal_post_status` is one complete `UP_TO_DATE` result with all four migrations `APPLIED`, bound to the rehearsal target/commit/run; generic post-status aliases and preliminary/QA/Production status substitutions reject. Every status, deploy, validate, generate, typecheck, lint, and build command receives database variables through an explicit one-process child-environment wrapper; no database variables are set in the parent shell. Every timeout/cancellation terminates and boundedly awaits the complete owned process tree. Inability to confirm descendant exit is blocking, retains fail-closed Production lock semantics where applicable, and prevents unsafe scratch/fixture-row cleanup, but the `finally` owner still independently and boundedly uses the immutable receipt/lease to delete the exact run-owned disposable Neon branch and then verify trusted absence. After confirmed tree exit, `scratch_cleanup` truthfully records bounded deletion/absence; FAIL blocks attestation but never suppresses branch deletion/absence. Only after both required cleanup proofs pass may the owner issue a short-lived authenticated attestation for the nonempty suffix, bound to the trusted Production target, exact attached clean checkout SHA, audited ordered pending suffix, trusted rehearsal branch/run identity, and canonical hashes/outcomes for every named proof. Its owner atomically creates an `ISSUED` nonce/digest record in the durable cross-process activation store. The attestation expires within 30 minutes, is single-use, and is invalidated by any target/checkout/suffix/proof/branch-absence change; it cannot be refreshed without a complete new rehearsal.
10. Stop for unexpected drift, an unknown migration, a failed or stale attestation, an ambiguous database identity, a dirty/detached/mismatched checkout, or a direct/runtime connection mismatch. Standalone status rejects Production before spawning Prisma; only the Production wrapper may run Production status.
11. With a valid nonempty-suffix attestation, enter the one approved Production activation wrapper. It derives its clean checkout SHA, reserves the exact durable nonce/digest, and preserves the nonce store's exclusive-lock, atomic-generation, fsync/rename, platform-recovery, and fail-closed ambiguity contracts. The outer preflight deadline already exists before its first lookup/orphan/network phase; the connection/try-lock sub-bound uses only remaining outer time. Contention, cancellation, connection loss, or either deadline's expiry stops before status or deploy. After acquisition it refreshes trusted Production identity/status, compares target/SHA/nonempty suffix to the attestation, and produces the semantic fingerprint; `checkedAt` remains separate freshness evidence.
12. While the wrapper retains that same session lock, request a distinct fresh user Production authorization naming the semantic fingerprint through an abort-aware callback with a 10-minute monotonic deadline. Authorization must both arrive before that deadline and name status evidence whose `checkedAt` remains within the same 10-minute freshness bound. Denial, cancellation, timeout, late resolution, or stale evidence stops before deploy. After timely authorization, re-fetch the opaque trusted target evidence and complete migration status under the lock, record a distinct locked-refetch check, recompute the semantic fingerprint, compare it to the attestation, authorization, and first locked fingerprints, record a distinct fingerprint-match check, and validate freshness separately. Immediately before spawn, repeat HMAC/expiry validation, trusted target and rehearsal-absence lookup, clean attached checkout/SHA derivation, nonempty suffix and every proof comparison, and durable proof that the nonce/digest remains `RESERVED` by this exact run.
13. The unchanged attestation, authorization, checkout, fingerprint, proofs, and reservation authorize `DEPLOY_STARTED` and one child-scoped deploy. Failure or ambiguity afterward remains reserved for reconciliation. After complete `UP_TO_DATE`/all-four-`APPLIED` post-status, call `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)` to write `CONSUMED` plus the full pending-final payload in one durable generation; only then unlock/close. Production smoke runs separately without the migration lock and alone completes final evidence.

#### Sanitized activation evidence schema

The approved absolute durable state directory/store is provided child-scoped to audit, rehearsal, final, and Production smoke. Namespaced records bind mode, target, commit, fingerprint, evidence version/digest, and only applicable audit-status or nonce/attestation/run fields. Audit writes pending `NO_OP` durably before exit; a later independent smoke process reloads it and performs the cross-process CAS. Missing/unavailable/ambiguous directory, namespace mismatch, and binding mismatch fail closed; tests cover missing directory, process exit/reload, and audit-to-smoke recovery.

Status output, audit records, checkpoints, and Aegis evidence use one allowlist-only shape:

```ts
type SanitizedTargetBinding = { projectId: string; branchId: string; databaseName: string; directHostname: string }

const ADMIN_OPERATIONS_EVIDENCE_CHECK_NAMES = [
  "trusted_identity",
  "parent_trusted_identity",
  "qa_trusted_identity",
  "orphan_scan",
  "parent_data_safety",
  "inherited_data_safety",
  "migration_status",
  "migration_deploy",
  "rehearsal_post_status",
  "qa_post_status",
  "prisma_validate",
  "prisma_generate",
  "focused_tests",
  "typecheck",
  "lint",
  "unit_tests",
  "build",
  "rehearsal_read_only_smoke",
  "production_read_only_smoke",
  "fixture_provenance",
  "fixture_state",
  "smtp_isolation",
  "billing_mutation_guard_armed",
  "billing_zero_mutation",
  "browser_desktop",
  "browser_mobile",
  "scratch_cleanup",
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
  target: SanitizedTargetBinding
  parentTarget: SanitizedTargetBinding | null
  qaTarget: SanitizedTargetBinding | null
  commitSha: string
  migrations: Array<{ name: ExpectedMigrationName; status: "APPLIED" | "PENDING" }>
  fingerprint: string
  checkedAt: string
  completedAt: string | null
  outcome: "UP_TO_DATE" | "PENDING_SUFFIX" | "DEPLOYED" | "NO_OP" | "BLOCKED" | "FAILED"
  checks: Array<{ name: AdminOperationsEvidenceCheckName; outcome: "PASS" | "FAIL" | "SKIPPED" | "BLOCKED"; checkedAt: string; proofRef: { schemaVersion: 1; digest: string; manifestRef?: string } }>
  smokeProofRef: { schemaVersion: 1; digest: string } | null
  finalizedFrom: { evidenceVersion: number; evidenceDigest: string } | null
}
```

In `qa` mode, top-level `target`, `parentTarget`, and `qaTarget` are mandatory; `target === qaTarget` by exact four-field equality and `parentTarget` must be distinct. `parent_trusted_identity` binds only `parentTarget`, and the fresh post-create `qa_trusted_identity` binds both `target` and `qaTarget`. All other modes require both auxiliary fields to be `null`. The allowlist serializer copies only the four safe fields and never spreads source objects. Attempt/completion validation, durable CAS records, and fixture-provenance validation bind the appropriate reference. Tests prove all QA targets survive serialization and reject missing, target/QA mismatch, parent/QA equality, swapped parent/QA, wrong, or extra targets, as well as either auxiliary field in another mode.

Every check has an allowlisted `proofRef`. Its canonical proof envelope is versioned and hashes the exact check name/outcome, sanitized target selected for that check, commit, mode, and canonical output; `manifestRef`, when that check's matrix entry permits it, is a validated safe relative/opaque manifest identifier and never a URL or filesystem path. The per-mode matrix defines the required proof kind for every check (control-plane identity, status, command output, data-safety/provenance, authorization, cleanup/deletion, or smoke), and attestation verification recomputes and binds those proof digests rather than trusting outcomes alone. Serialization retains only schema/version/digest and an allowlisted safe manifest reference. Missing, mismatched, replayed-across-target/commit/mode, or swapped-between-check proof references reject; tests cover each case.

Exactly one mode-appropriate canonical smoke check appears in completed rehearsal/final evidence (`rehearsal_read_only_smoke` or `production_read_only_smoke` respectively); status/QA have none. The no-deploy audit row remains immutable with exactly `trusted_identity`, `orphan_scan`, and `migration_status`. Its smoke CAS does not append to or mutate that evidence. Instead it produces a separate `AdminOperationsFinalizedAuditCheckpoint` with `kind: "FINALIZED_AUDIT_NO_OP"`, the exact completed audit evidence/version/digest in `auditEvidence`, one `production_read_only_smoke` check, byte-identical `smokeProofRef`, and `finalizedFrom`; no rehearsal/final/deployment fields are permitted. For rehearsal/final evidence and the finalized-audit checkpoint, the smoke check's `proofRef` and top-level `smokeProofRef` are byte-identical references to one digest-addressed opaque smoke envelope, never two proofs. The envelope metadata is allowlisted schema/version/digest/outcome/timestamp plus exact target/commit/fingerprint and mode-specific audit/rehearsal/Production status and run/nonce/attestation bindings. CAS recomputes the digest, requires reference byte equality and exact pending-version bindings, and rejects mutation of the embedded audit evidence, duplicate smoke checks, alternate proof objects, replay, cross-mode/target/commit swapping, or concurrent reuse. Serializer/CAS RED tests cover both output shapes and mutate either reference independently.

Proof-kind assignment is exact: identity/orphan/locked-refetch use control-plane proof; statuses/fingerprint use non-substitutable status/fingerprint proofs; deploy/validate/generate/test/typecheck/lint/build use command proof; safety, `fixture_provenance`, and distinct QA-only `fixture_state` use opaque-owner proofs; authorization uses authorization proof; scratch, fixture, branch deletion, and trusted-absence outcomes use distinct cleanup/control-plane proofs; smoke uses its canonical envelope. `fixture_state` is produced only after fixture load and binds a canonical sanitized aggregate digest to exact QA target, commit, run/lease, and provenance reference. Both browser proofs bind its same byte-identical ref/digest plus SMTP and armed-billing proofs. Serializer, acceptance attestation, and browser validators reject omission, substitution, cross-binding, row-bearing payloads, and different desktop/mobile state refs; rehearsal attestation rejects this QA-only check. `scratch_cleanup` also binds the validated current-run output-manifest digest and confirmed tree exit. Failure remains truthful while independently authorized external teardown continues.

`mode` identifies only the execution phase. Checkpoint and Aegis files are destinations that embed the same serialized evidence object, not extra mode values. The serializer constructs this shape field by field, never spreads source objects, and rejects unknown or obsolete names including legacy `readOnlySmoke` and unintended `rehearsalReadOnlySmoke`. Its matrix defines each mode's ordered completion set:

The rehearsal attestation proof map uses the same canonical names as rehearsal evidence: `scratch_cleanup` and `branch_deleted`. The first binds bounded run-owned scratch deletion/absence; the second independently binds receipt-authorized rehearsal-branch deletion and trusted control-plane absence. Generic `cleanup`, camelCase `branchDeletion`, omission, aliasing, swapped references, or reuse of one digest for both proofs reject at signing, verification, final pre-spawn revalidation, serialization, and acceptance.

| Mode | Exact required checks | Required outcome |
| --- | --- | --- |
| `status` | `trusted_identity`, `migration_status` | `UP_TO_DATE` or `PENDING_SUFFIX`; never completion authority |
| `audit` | `trusted_identity`, `orphan_scan`, `migration_status` | `PENDING_SUFFIX`, or canonical empty-suffix `UP_TO_DATE`/`NO_OP`; never `final` |
| `rehearsal` | `trusted_identity`, `orphan_scan`, `parent_data_safety`, `inherited_data_safety`, `migration_status`, `migration_deploy`, `rehearsal_post_status`, `prisma_validate`, `prisma_generate`, `focused_tests`, `typecheck`, `lint`, `unit_tests`, `build`, `rehearsal_read_only_smoke`, `scratch_cleanup`, `branch_deleted` | `DEPLOYED`, distinct complete four-`APPLIED` rehearsal post-status, scratch and branch absence |
| `qa` | `parent_trusted_identity`, `orphan_scan`, `parent_data_safety`, `qa_trusted_identity`, `inherited_data_safety`, `migration_status`, `migration_deploy`, `qa_post_status`, `fixture_provenance`, `fixture_state`, `smtp_isolation`, `billing_mutation_guard_armed`, `browser_desktop`, `browser_mobile`, `billing_zero_mutation`, `scratch_cleanup`, `fixture_cleanup`, `branch_deleted` | `DEPLOYED`, distinct targets, QA status, sanitized fixture state, guards/browsers, post-run zero mutation, scratch/external cleanup |
| `final` | `trusted_identity`, `orphan_scan`, `migration_status`, `final_locked_refetch`, `final_fingerprint_match`, `fresh_production_authorization`, `production_migration_deploy`, `production_post_status`, `production_read_only_smoke` | `DEPLOYED`, nonempty attested suffix, complete Production four-`APPLIED` post-status, exact-commit postdeploy smoke |

Canonical `ADMIN_OPERATIONS_ATTESTATION_STATE_DIR` exists only in audit, rehearsal, final, and Production-smoke child environments, never parent shell/runtime app; all use one namespaced store. Audit writes pending `NO_OP`, exits, and a fresh smoke process reloads/finalizes it. Missing directory or namespace/binding mismatch fails.

Evidence validation has two stages. Attempt evidence has overall `BLOCKED` or `FAILED`; it retains `PASS`/`FAIL` truthfully, including failed parent/inherited safety, and contains only mode-allowed checks actually reached in documented order plus cleanup edges. Completion evidence has the mode's successful outcome, exact full ordered set once, and every check `PASS`. Audit `UP_TO_DATE`/`NO_OP` is a completed no-deploy audit status packet, not completed activation/checkpoint evidence; the latter requires its bound smoke-reference CAS. Final mode likewise completes only after `production_read_only_smoke: PASS`. The durable successful nonterminal `AdminOperationsPendingSmokeFinalization` record has outcome `POST_STATUS_VERIFIED_AWAITING_SMOKE` and exact passing checks only through `production_post_status`; it is neither attempt nor completion evidence. Unknown, duplicate, additional, out-of-order, invented, prohibited, or row-bearing values reject.

`scripts/admin-operations-attestation-store.mjs` owns nonce and deployed pending-final state as a single durable generation under the same per-nonce lock. `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)` atomically writes `CONSUMED` plus the full pending-final payload; there is no standalone consume on this path. `scripts/admin-operations-evidence-store.mjs` may write pending `NO_OP` and finalize/read completed variants, but cannot independently create deployed pending-final state. Crash injection before temp write, after fsync, before rename, after rename, and during recovery yields either old `DEPLOY_STARTED` or combined `CONSUMED` plus pending-final, never split; torn/ambiguous state fails closed. Crash/reload permits exactly one matching smoke CAS, while mismatch, replay, and concurrent finalizers fail. The smoke-proof producer/type is runtime-opaque with no public constructor or brand export.

An allowlisted smoke proof reference carries only schema/version/digest/outcome/timestamp, exact commit, sanitized target, semantic fingerprint, and its mode-specific status binding. The `NO_OP` CAS binds the prior audit version/digest, commit, target, fingerprint, audit-status digest, and smoke proof; run, nonce, attestation, and Production-post-status fields must be null/absent and reject if supplied. Its only output is the separate immutable `AdminOperationsFinalizedAuditCheckpoint` described above; it never mutates audit evidence or creates final-mode evidence. The deployed-final CAS binds the partial-final version/digest, commit, target, fingerprint, Production post-status digest, run ID, nonce, attestation digest, and smoke proof, and only it creates completed deployed-final evidence. Both outputs record `finalizedFrom`/`smokeProofRef`; missing or mismatched fields, cross-mode fields, replay, and concurrent finalizers fail. Tests exercise both exact output/binding sets and independently reject every deployment-only field on `NO_OP`. Proofs expose no provider IDs, rows, credentials, or secrets.

Before creating either disposable branch, check the trusted control plane for Admin-operations rehearsal/QA names. Every match is a blocking alert. Automatic deletion requires trusted metadata matching the verified run owner/lease plus explicit proof that the lease is stale and its owner cannot still be active; ambiguous ownership or staleness requires operator-reviewed cleanup. Before creation, the exact rehearsal parent must also pass trusted no-PHI compliance proof and the exact QA parent must pass trusted data-free/approved-sanitized proof; synthetic fixture loading does not satisfy either gate. Immediately after creation and before any migration/status/deploy, test, smoke, browser server, or fixture load, independently prove inherited rows absent or approved-sanitized. Missing, stale, ambiguous, or contradictory proof fails closed and triggers deletion/absence verification. Sanitized evidence may expose only target identity, policy/version or approved proof digest, aggregate outcome, and timestamp—never rows, values, PHI, credentials, connection material, emails, or secrets. Every disposable lifecycle uses `try/finally`; deletion and trusted control-plane absence verification run after success or failure, and resume remains blocked until complete absence is proven.

No seed, reset, development migration, destructive SQL, Prisma Studio session, or broad export belongs in this flow.

#### Canonical Production read-only smoke

The only post-status state transition is `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)`, which writes the single combined durable generation before advisory unlock/close. Flow tests observe post-status -> combined call -> unlock/close -> smoke; no standalone consume API or wording is authoritative.

`scripts/admin-operations-production-smoke.mjs`, invoked by `npm run admin:operations:activation:smoke`, is the executable non-lock-owning owner. With child-scoped durable-state and trusted-target inputs, it loads pending `NO_OP` or deployed state cross-process, verifies exact clean commit, target, fingerprint, and mode-specific status/run/nonce/attestation bindings, runs only allowlisted read-only role/projection checks, produces a runtime-opaque proof, and CAS-finalizes. It cannot create/acquire/inherit the migration lock, run migration status/deploy, or mutate data. Missing/mismatched state, replay/concurrency, and proof mismatch fail; source/tests enforce these absences and successful one-time reload finalization.

Confirm the exact merged commit is deployed, then record canonical `production_read_only_smoke` and perform read-only checks for:

- full-Admin access to user directory and detail;
- Reviewer access to anatomy review without account/commerce administration;
- Editor access to anatomy review and edit without account/commerce administration;
- ordinary-user denial;
- safe account, entitlement, billing, security, and Activity projections; and
- dashboard/directory counts loading without schema errors.

Keep `ADMIN_BILLING_GOODWILL_LIVE_ENABLED` absent or false. Do not perform a Production role change, token revocation, password request, 2FA reset, background-credit grant, temporary grant, email retry, or Stripe credit as part of activation.

#### Disposable browser acceptance

QA target semantics/order are exact: parent proof gates atomic creation plus immutable receipt/lease capture; capture failure fails closed before child database/fixture work and supplies no authority for row cleanup or branch deletion. After valid capture, child identity gates database work but not control-plane teardown. Success order is parent identity, orphan scan, parent safety, create/capture, child identity, inherited safety, migration status/deploy, `qa_post_status`, provenance, fixture load, `fixture_state`, SMTP isolation, armed billing guard, desktop, mobile, zero mutation, scratch cleanup, fixture cleanup, exact branch deletion, then trusted absence. Fixture-row cleanup is attempted only after confirmed full process-tree exit/safety; otherwise its truthful result is `SKIPPED`/`BLOCKED`. Exact receipt/lease deletion plus trusted absence remain unconditional across every post-capture failure.

The QA owner records parent gates, atomically creates/captures, then performs fresh child lookup. After deploy/status and provenance it loads fixtures, derives `fixture_state`, and only then proves SMTP/billing guards and starts server/browsers. Browser project/viewport envelopes cannot substitute for each other and must bind the same state proof.

1. Before creation, prove through trusted evidence that the exact QA parent is data-free or approved-sanitized. Then create a separately identified disposable QA Neon branch containing the QA database, distinct from Production and from the migration-rehearsal clone; the rehearsal branch is never reused for browser QA.
2. Immediately after creation, prove inherited safety, migrate/status, then verify opaque provenance. Continue `fixture load -> fixture_state -> smtp_isolation -> billing_mutation_guard_armed -> server -> browser_desktop -> browser_mobile -> billing_zero_mutation -> scratch_cleanup -> fixture_cleanup -> branch_deleted -> trusted absence`. Fixture state serializes only canonical aggregate digest/outcome/timestamp and target/commit/run/provenance bindings. Missing/forged/stale/wrong/row-bearing proof prevents browser work while authorized teardown still runs.
3. Prove database identity before enabling `MASSAGELAB_BROWSER_QA_DATABASE=1`. The authenticated lookup is asynchronous, and fixture provisioning, cleanup, wrapper/spec gates, billing preview/guards, and their tests must await it before the first transaction, create/delete mutation, or preview-adapter construction; an unresolved Promise never counts as authorization.
4. Require a Playwright-owned server with SMTP variables blanked.
5. Run the full Admin User Operations spec in both desktop and mobile Chromium.
6. Retain the billing fixture's presentation-only Stripe client and server-action mutation guard; assert zero matching form submissions and POST requests for billing goodwill.
7. Verify exact fixture cleanup in foreign-key-safe order only after complete process-tree exit/safety is confirmed; otherwise perform no row mutation and record cleanup truthfully as `SKIPPED`/`BLOCKED`.
8. Delete the exact disposable QA Neon branch and verify that branch's absence through the trusted Neon control plane. Missing or inconclusive branch-deletion/absence evidence blocks acceptance rather than becoming a warning.

### Branch 4: Admin queue navigation

This branch is read-only except for URL and navigation state. It adds no mutation capability.

#### Directory context

- Carry a validated internal return URL from the directory into account detail.
- Preserve search, supported filters, sort, and page size.
- Reject external, malformed, or unsupported return URLs.
- Treat a cursor as navigation context, never authority. Transport is opaque canonical unpadded base64url over the exact UTF-8 bytes produced by standard `JSON.stringify` on a fresh object populated only in order `v`, `accountId`, `queryFingerprint`: `{"v":1,"accountId":<JSON string>,"queryFingerprint":<JSON string>}`, with no whitespace. Encoder runtime-validates the audited User ID and lowercase 64-hex fingerprint first. Decoder requires only URL-safe alphabet with no `=`, decodes once, fatally decodes UTF-8, parses a non-array object with exactly those three own enumerable keys in that order, requires numeric `v === 1` and exact string types/validators/fingerprint match, then reconstructs, JSON-stringifies, UTF-8 encodes, and byte-compares the canonical payload before re-encoding unpadded base64url and requiring exact token equality. Reject padding, malformed bytes/JSON, duplicate/extra/missing keys, alternate order, whitespace, `1.0`, alternate JSON escape spellings (including `\u` versus literal Unicode or escaped slash), double wrapping, wrong versions/fingerprints, forged brands, and out-of-grammar IDs before transaction work. JSON.stringify escaping for quote, reverse solidus, controls, valid BMP/scalar Unicode, and surrogate pairs is authoritative; lone surrogates reject. Shared Node/browser executable tests include exact JSON/UTF-8-hex/token goldens, helper escaping vectors, every noncanonical negative variant, and encode/decode/re-encode byte identity. The decoder returns `ParsedAdminUserCursor { token, accountId, queryFingerprint }`; URLs emit only `.token`, while database predicates compare only `.accountId`. Server Components, routes, server owners, helpers, and tests await fingerprint-producing/consuming APIs; Client render remains synchronous and only async event handlers await before navigation/state. Cursor usability, visible-page selection, and reverse lookback share one repeatable snapshot; a stale decoded account falls back to its first page while retaining safe filters.
- Keep query allowlists, async normalization/parser/fingerprint logic, the audited User-ID validator, and cursor codec in one dependency-free browser-safe module imported by both navigation and the server directory module. Prisma predicates and database operations stay server-only. Source/import-graph tests and a browser-targeted import/build proof execute the Web Crypto path and prevent Client Components or the shared browser-safe graph from reaching `node:crypto`, Prisma, auth, Next server APIs, billing, or other Node/server-only dependencies.
- Canonical fingerprint bytes normalize accepted strings to NFC, reject lone surrogates, and serialize fields in fixed order `v`, `q`, `emailVerified`, `role`, `roleStatus`, `subscriptionStatus`, `creditState`, `temporaryAccess`, `unresolvedIssue`, `queue`, `sort`, `pageSize`. Each field is ASCII name, `=`, unsigned decimal UTF-8 byte length without leading zeros, `:`, raw UTF-8 value bytes, then LF. `v=1`, `sort=account_asc`, and `pageSize=25` are always present by default; empty `q` is present with zero length; each omitted nullable filter is the one-byte value `-`; unknown or duplicate keys reject. JSON, percent encoding, locale rules, whitespace folding, and platform newlines never participate. Shared browser/server golden byte-and-digest vectors use this complete all-field grammar and exactly the cases defined in the [queue-navigation plan](../plans/2026-08-11-admin-queue-navigation.md): defaults and omitted filters, explicit empty search, composed/decomposed Unicode producing identical NFC bytes, every populated filter in order, non-default sort/page size, delimiter-like values, and duplicate rejection. No legacy shorthand input or digest is accepted.
- The tracked type fixture/config runs every `@ts-expect-error`, while the tracked browser fixture is compiled/bundled, its emitted graph is inspected for Node/server imports, and Chromium executes the real Web Crypto path. Public codec/builder boundaries runtime-validate the audited Production User-ID grammar and exact lowercase 64-hex fingerprint; JavaScript calls, casts, clones, plain objects, and malformed brands cannot bypass validation.
- An async normalize-and-fingerprint owner rejects unknown own keys including `cursor`/`queryFingerprint`, creates `PreparedAdminDirectoryNonCursorQuery` with a readonly unique-symbol nominal property whose symbol is not exported as a constructible runtime value, and registers `WeakMap<handle,{normalizedQuery,fingerprint}>`. The builder recovers payload only from that private map and accepts exactly one explicit `ParsedAdminUserCursor | null`; a full query cannot compile, while plain/cloned/cast/JavaScript full objects fail runtime validation.
- Encoded-separator hazard inspection applies only to raw/decoded authority and pathname layers before query/fragment. Encoded slash/colon in an allowlisted `q` value (for example `neck%2Fshoulder%3Aleft`) survives parser/canonical builder round-trip; the same direct/double-encoded separators in authority/path remain rejected.
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
- One outer QA owner covers atomic receipt/lease capture and every phase. Its failure matrix injects failure/throw/timeout at capture; each gate including fixture load/state; both browsers/tree/zero/scratch; fixture cleanup; branch deletion; and trusted absence. Capture failure performs no child database work or unauthorized cleanup/deletion. After valid capture, fixture-row cleanup is attempted only with confirmed full-tree exit/safety and otherwise records `SKIPPED`/`BLOCKED`; exact branch deletion and trusted absence are still attempted unconditionally and independently. Fixture-cleanup failure still reaches deletion/absence, deletion failure still reaches absence, and all failures block acceptance.
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
- when that audit returns an empty pending set, acceptance requires the completed no-deploy `UP_TO_DATE`/`NO_OP` status packet plus its later mode-specific smoke CAS, with deployment-only CAS fields absent, and proves there was no rehearsal branch, rehearsal attestation, final-mode invocation, fresh Production authorization, deploy attempt, or nonce issuance/reservation/state transition;
- only when the audit returns a nonempty contiguous terminal suffix does acceptance require disposable rehearsal and complete rehearsal post-deploy `UP_TO_DATE`/all-four-`APPLIED` status, followed by verified cleanup/deletion;
- that rehearsal result is recorded only as distinct `rehearsal_post_status`, bound to rehearsal target/commit/run and non-substitutable with preliminary, QA, or Production status;
- only that nonempty-suffix path issues a fresh authenticated single-use rehearsal attestation binding the trusted Production target, exact clean attached checkout SHA, ordered suffix, rehearsal identity, and proof hashes/outcomes;
- only that nonempty-suffix path enters final mode, where the wrapper derives and rechecks its own clean checkout SHA and records locked refetch, fingerprint match, distinct fresh user Production authorization, deploy, and complete Production post-status as separate passing checks; and
- only that nonempty-suffix path moves the durable nonce atomically through `ISSUED`, this-run `RESERVED`, `DEPLOY_STARTED`, and verified `CONSUMED`; pre-spawn safe failure can release only the owning reservation, while any post-start ambiguity blocks automation for manual reconciliation;
- read-only role-matrix and projection checks pass on the exact deployed commit;
- desktop and mobile Admin browser suites pass against the migrated QA database contained by the separately identified disposable QA Neon branch;
- SMTP and billing mutation guards remain closed;
- `smtp_isolation` and `billing_mutation_guard_armed` pass before either browser and their references bind each project/viewport-specific browser proof; after both browser trees exit, distinct `billing_zero_mutation` binds both browser proofs and proves the armed instrumentation observed zero forms, POSTs, or provider mutations;
- rehearsal and QA `scratch_cleanup` proofs pass after confirmed owned-tree exit; a failed proof is retained in attempt evidence, blocks completion, and does not suppress fixture or receipt-authorized branch teardown;
- fixture cleanup succeeds after confirmed full-tree exit/safety (completion never treats `SKIPPED`/`BLOCKED` as success); and
- trusted pre-creation parent-data proof and immediate post-creation inherited-row absence/sanitization proof pass for both rehearsal and QA before migrations/tests/smoke/browser fixtures, with no rows, PHI, credentials, or secrets exposed;
- the rehearsal attestation contains canonical target-bound `rehearsal_read_only_smoke: PASS`, while deployed Production proof is canonical `production_read_only_smoke: PASS`; legacy `readOnlySmoke` and unintended `rehearsalReadOnlySmoke` are rejected rather than aliased;
- the QA fixture provenance is an approved synthetic or sanitized seed in that separate QA branch/database binding, with no Production-row copy and no migration-rehearsal-branch reuse; and
- the exact disposable QA Neon branch is deleted and its trusted-control-plane branch absence is verified, with acceptance blocked until that verification succeeds.

### Queue acceptance

- exact awaited parser, sanitizer, build-preparation, URL-builder, and filter-query contracts using browser Web Crypto SHA-256, plus browser import/build proof with no Node/server crypto;
- exact NFC/UTF-8 canonical-byte golden vectors in browser/server, an executed tracked TypeScript compile-fail fixture, and a compiled/bundled/executed tracked browser graph;
- sanitizer RED vectors for fragments, credentials, and duplicate singleton parameters, including direct/double encodings, all falling back to `/admin/users`;
- runtime rejection of forged/erased User-ID and fingerprint brands at every public codec/builder boundary;
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
