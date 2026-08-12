# Admin Operations Production Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the four Admin-era migrations on a disposable Neon clone, deploy only an exact contiguous terminal pending suffix to Production when necessary, and complete read-only Production smoke plus desktop/mobile disposable browser acceptance.

**Architecture:** Add a small fail-closed activation contract that statefully parses complete Prisma migration-status sections, accepts only an empty pending set or a contiguous terminal suffix of the expected inventory, and binds the direct connection to a project/branch/database identity obtained independently from the trusted Neon control plane. A single two-mode Production activation wrapper is the only approved Production status/deploy path; the standalone status entry point is rehearsal-only and rejects Production before spawning Prisma. Audit-only mode obtains the cooperative session advisory lock through bounded cancellation-aware try-lock polling, runs one preliminary trusted status, records allowlist-only sanitized evidence, and releases the lock without authorization or deploy capability. Before either disposable branch is created, its exact parent must pass a trusted data-safety gate; immediately after creation and before any migration, test, smoke, or fixture work, the child must independently prove inherited rows absent or sanitized. A completed rehearsal produces a short-lived authenticated attestation bound to the trusted Production target, exact clean checkout, ordered pending suffix, rehearsal identity, parent/inherited-data proofs, proof hashes/outcomes including canonical `rehearsal_read_only_smoke`, complete post-deploy status, and verified deletion. Final mode holds the migration advisory lock only from fresh final status through authorization, refetch, deploy, verified Production post-status, and nonce consumption; it then unlocks/closes. A separately owned exact-deployed-commit `production_read_only_smoke` runs without that lock and alone completes final evidence. Use existing Playwright fixture owners for browser acceptance and an explicit disposable-database identity token so the mutation sentinel cannot be enabled from a connection string alone.

**Tech Stack:** Prisma 7 migrations, Neon Postgres branches, Node scripts/tests, Next.js, Playwright Chromium, GitHub/Vercel deployment checks.

## Global Constraints

- Expected migration inventory is exactly:
  - `20260808090000_admin_authorization_audit_foundation`
  - `20260808093000_admin_jwt_session_version`
  - `20260808100000_admin_temporary_feature_access`
  - `20260808110000_admin_billing_goodwill`
- Use a direct/unpooled Neon connection for `prisma migrate status` and `prisma migrate deploy`; never use the pooled runtime connection for migration work.
- Obtain the target project ID, branch ID, database name, and direct endpoint hostname freshly from the authenticated Neon console or approved API. A connection-string hostname/database parse alone is not identity proof; the status contract must match the connection to that independently obtained control-plane binding.
- The only valid pending inventories are `[]` or one contiguous terminal suffix of the exact ordered four-migration list. Reject gaps, arbitrary order-preserving subsets, duplicates, reordering, and unknown names.
- An empty Production pending set is terminal for the deploy path: audit records the completed no-deploy `UP_TO_DATE`/`NO_OP` status packet without rehearsal, attestation issuance, final mode, authorization, or deploy; the checkpoint finalizes only through the later mode-specific smoke CAS. Rehearsal attestations and final mode require a nonempty contiguous terminal suffix.
- Migration deployment is authorized only after identity, pending-set, and disposable rehearsal gates pass.
- Stop for any non-terminal pending subset, ambiguous database identity, failed rehearsal, connection-role mismatch, or changed Production pending set.
- A Production deploy requires both a fresh authenticated rehearsal attestation and a separate fresh user authorization naming a sanitized semantic fingerprint produced only from the trusted project/branch/database/direct-host binding, exact clean checkout commit, and exact ordered pending suffix. Keep `checkedAt` and attestation expiry as separate freshness evidence; do not hash volatile timestamps into the semantic fingerprint. An attestation or authorization for another target, checkout, suffix, fingerprint, rehearsal branch, proof set, or freshness window does not carry forward.
- `npm run admin:operations:activation:production -- audit` and `npm run admin:operations:activation:production -- final` are the only approved Production status/deploy invocations. Both use 250 ms `pg_try_advisory_lock` polling with a 30-second monotonic acquisition deadline and cancellation. Audit mode locks only for its preliminary trusted status and sanitized audit record, then unlocks and cannot authorize or deploy. Final mode starts only with a valid short-lived rehearsal attestation, acquires a new target-scoped session advisory lock, derives and verifies the clean attached checkout SHA itself, and performs a fresh final status, separate user authorization bounded to 10 minutes, target/status refetch, semantic-fingerprint comparison, at most one deploy, and post-status before releasing the lock.
- Every command receives a fresh exact-name child environment built from an empty base plus its documented minimum. Database secrets are allowlisted only for migration status/deploy and an individually named focused/unit/smoke/browser child whose executable test proves actual database I/O is necessary. Prisma validate receives only fixed nonsecret syntactically valid placeholder URL values and performs no network I/O; generate, typecheck, lint, and build receive no database credential. Those static commands receive only explicit nonsecret run/scratch/manifest/config variables required by that command. The parent shell remains free of database variables. Per-command env-capture tests assert exact key sets and a denylist covering database/provider/auth/email secrets, failing on any undeclared inherited key.
- Every Prisma and Playwright invocation builds a complete platform-selected execution workspace from the clean checkout, exact `package-lock.json`, verified Node/package resolution, and build traces. The sealed workspace includes a verified Node runtime; required platform packages and browser artifacts; package/lock/TypeScript/Next/Prisma/Playwright configuration; selected schema/migrations/specs/fixtures; application/server source; and static assets. A command that generates Prisma client or build output must not consume a stale generated or `.next` artifact copied from the source/sealed workspace: later typecheck, runtime/server, and browser commands consume only the validated current-run scratch outputs described below. Missing, mismatched, stale, or unaccounted input fails before database connection, server start, browser launch, or child spawn.
- Copy the full source/dependency/config workspace into a new per-invocation root preserving layout. Reject traversal/collisions/missing/extra manifest entries, record path/size/digest/mode, `fsync`, seal, and verify. Executable, cwd, argv, schemas, configs, specs, fixtures, general module roots, and assets remain sealed-root absolute paths. Resolution may leave it only for trusted OS libraries and the separately guarded manifest-declared current-run Prisma/build scratch inputs below; all other scratch and checkout fallbacks reject. Keep both roots through complete tree exit and test tampering before consumption.
- Bind the workspace manifest to the wrapper-derived clean attached checkout SHA and exact lock/build identities before sealing. Snapshot creation may read that verified source checkout, but after sealing the execution child receives no checkout path or handle; the original tree is evidence/source material only, never a runtime dependency.
- Before sealing, create a separate exclusive run-owned writable scratch root. Redirect Prisma generation, `.next`/build output, test/browser results, traces, screenshots/videos, reports, caches, temp files, and server logs through explicit child variables/config/arguments into allowlisted bounded subdirectories. Scratch is not a general resolution root, executable/config/spec/schema source, or manifest member. The only scratch paths permitted as later inputs are manifest-declared absolute current-run Prisma-generated and build-output paths. After each producer exits, the owner canonicalizes every path beneath the current run's scratch root without symlink/reparse escape, validates expected file class/platform/runtime identity, size/mode, and SHA-256, closes the producer write phase, and binds the output-manifest digest to the run, clean commit, sealed-input manifest, producer command proof, and every consumer proof. Typecheck/tests may consume only that validated Prisma output; runtime/server and both browser projects may consume only that output plus the validated current-run build output. Resolution/open/spawn guards reject every other scratch read or execution and revalidate path and digest immediately before consumption. Snapshot construction creates a command-specific Prisma schema/config inside the workspace before sealing whose supported generator-output setting names only the scratch generation directory. Enforce byte/file/time quotas and keep scratch through full tree exit. After confirmed exit, attempt bounded verified scratch deletion; failure blocks completion evidence. If full-tree exit is unconfirmed, retain fail-closed Production lock semantics and skip unsafe scratch or disposable-row cleanup, but still independently and boundedly delete the exact run-owned disposable Neon branch using only its immutable receipt/lease and verify trusted-control-plane absence. RED/GREEN tests prove real current-run generation, typecheck, runtime/server, and desktop/mobile browser consumption; reject stale sealed artifacts, unmanifested/mutated outputs, wrong-run/digest/runtime bindings, and path escape; and cover both teardown paths.
- Before the first trusted lookup, orphan scan, connection, or other control-plane/network work, create one outer monotonic preflight deadline and `AbortSignal`. Give every phase only bounded remaining time; expiry/cancellation must return by that outer deadline and quarantine late lookup/orphan/status/connection results so they cannot acquire a lock, deploy, or mutate evidence/completion. The 30-second connection-plus-advisory-lock deadline begins before creating the direct connection but is only a nested maximum within the outer bound. The connector accepts the signal and provides a confirmed cancellation/close handshake bounded by remaining time. Tests independently hang trusted lookup, orphan scan, connection, try-lock, and status and prove bounded return, late-result close/quarantine, no downstream calls, and no unhandled rejection.
- Never run `prisma migrate dev`, `prisma migrate reset`, seeds, destructive SQL, Prisma Studio, or broad exports.
- Keep `ADMIN_BILLING_GOODWILL_LIVE_ENABLED` absent or false; perform no Production Admin mutation, email retry, or Stripe credit.
- Browser QA requires a separately identified disposable database, exact opt-in, an independently authenticated Neon control-plane lookup of project ID, branch ID, database name, and direct hostname, Playwright-owned SMTP-blank server, desktop/mobile Chromium, exact cleanup, deletion, and absence verification. Operator-supplied values that merely agree with each other or with the connection URL are not identity proof.
- Before creating a rehearsal branch, trusted parent evidence must prove the exact selected parent is approved for this rehearsal and satisfies the documented no-PHI compliance gate. Before creating a QA branch, trusted parent evidence must prove the exact selected parent is data-free or approved-sanitized for QA. A synthetic fixture plan or later fixture load is not parent-data proof. Missing, stale, ambiguous, or row-revealing evidence fails closed before branch creation.
- Immediately after each disposable branch is created, independently verify that inherited data is absent or conforms to the approved sanitization policy, before any migration/status/deploy, validation/generation, tests, smoke query, browser server, or fixture provisioning. The sanitized evidence records only target identity, policy/version or approved proof digest, aggregate pass/fail, and timestamp; it must expose no database rows, field values, PHI, credentials, connection strings, emails, or secrets. A mismatch or inability to prove the inherited-data state requires deletion/absence verification and a new safe parent decision.
- Evidence may contain migration names, commit IDs, branch/project identifiers, pass/fail state, and timestamps; it may not contain credentials, connection strings, database rows, emails, or provider IDs.
- Follow Neon guidance: create a short-lived branch from the selected parent, rehearse there, and delete it after verification.
- Before every new or resumed external run, perform a blocking trusted-control-plane absence check for branches with either Admin-operations disposable prefix. Treat every match as an alert. Automatic deletion is allowed only when trusted metadata proves the branch belongs to the same verified run owner/lease and explicit lease-expiry/staleness evidence proves that owner can no longer be active; otherwise require operator-reviewed cleanup. Wrap every newly created disposable branch in `try/finally` so cleanup runs after normal completion and catchable exceptions/cancellation. Do not claim that `finally` survives hard process termination, machine loss, or power failure. Resume remains blocked until the trusted control plane proves complete absence.
- Every bounded child owner tracks and owns the complete spawned process tree. On timeout, cancellation, or error it terminates that tree and boundedly awaits the root and all descendants. Confirmed exit is required before a successful Production advisory-unlock transition or unsafe scratch/fixture-row cleanup; inability to confirm it is blocking, retains fail-closed Production lock semantics, and records those cleanup steps as skipped/failed rather than safe. Disposable control-plane teardown is independent: whenever an immutable creation receipt/run lease exists, the owner still boundedly attempts deletion of that exact run-owned Neon branch and then trusted absence verification, even when descendants remain unconfirmed. The cross-platform owner uses an explicit process group on POSIX and a Windows Job Object or bounded `taskkill /T /F` adapter on Windows. Tests distinguish safe row/scratch cleanup from receipt-authorized branch deletion and prove the latter plus absence always run after branch creation.
- Supply the approved absolute durable state directory and store owner child-scoped to audit, rehearsal, final, and Production smoke. Namespaced records bind mode, target, commit, fingerprint, evidence version/digest, and only applicable audit/nonce/attestation/run fields. Missing/unavailable/ambiguous state blocks the child. Audit persists pending `NO_OP` before exit; a later smoke process reloads it and performs the cross-process CAS. Tests cover missing directory, process exit/reload, and audit-to-smoke recovery.

---

## File Structure

- Create `lib/admin/operations-activation-contract.ts`: pure expected-inventory, trusted control-plane binding, connection-role, terminal-suffix, authorization-fingerprint, and QA-identity validators.
- Create `lib/admin/neon-control-plane.ts`: server-only authenticated Neon lookup that returns only opaque module-branded evidence around a sanitized project/branch/database/direct-host binding. A module-private brand/`WeakSet` must make a structurally identical caller-created object fail evidence verification; tests obtain valid evidence only by driving the lookup through an injected mock `fetch`, never through a raw binding override.
- Create `lib/admin/admin-operations-data-safety.ts`: server-only owner of both the rehearsal policy's versioned canonical PHI-bearing table/workflow scope and the QA policy's complete application-schema table/relation scope plus exact sanitized residual allowlist. It alone runs the approved authenticated compliance query and returns opaque runtime-authorized parent or inherited evidence; caller objects, claimed digests, fixture provenance, and raw query results cannot create evidence.
- Create `lib/admin/admin-operations-fixture-provenance.ts`: server-only owner of the immutable approved fixture source/version allowlist, five-minute freshness bound, and opaque runtime-authorized source, proof, and verified-result registries for exact QA target/database/clean-commit provenance.
- Create `lib/admin/admin-operations-fixture-state.ts`: QA-only opaque owner that, immediately after fixture load, computes a canonical sanitized aggregate-state digest bound to the exact QA target, clean commit, run/lease, and passing `fixture_provenance` proof without exposing rows, PHI, PII, emails, or secrets.
- Create `lib/admin/admin-operations-qa-lifecycle-proofs.ts`: sole opaque runtime owner/API for stable `receipt_lease_capture` authority, renewable short-lived receipt verification, `server_ownership`, and `qa_sentinel`, using module-private classes/registries and canonical digest/freshness verification.
- Create `scripts/admin-operations-activation.mjs`: rehearsal-only read-only status/evidence command with an exact exit-code/signal contract; direct Production targets fail before Prisma spawn and it never invokes deploy itself.
- Create `scripts/admin-operations-production-activation.mjs`: the sole Production wrapper and cooperative session-lock owner.
- Create `scripts/admin-operations-rehearsal.mjs`: the disposable rehearsal owner that captures proof hashes/outcomes and emits the authenticated short-lived attestation only after complete post-deploy status and verified branch deletion.
- Create `scripts/admin-operations-attestation-store.mjs`: the sole durable cross-process nonce-state owner, backed by an operator-configured absolute state directory outside the repository and secret/evidence trees.
- Create `scripts/admin-operations-evidence-store.mjs`: durable pending-`NO_OP` and smoke-finalization/completed-evidence owner; it cannot create deployed pending-final state, which only the combined attestation-store generation creates.
- Create `scripts/admin-operations-production-smoke.mjs`: separately invoked, non-lock-owning read-only Production smoke owner and opaque proof producer/CAS finalizer.
- Create `scripts/admin-operations-repository-cli.mjs`: side-effect-free repository-local Prisma/Playwright closure resolver, immutable snapshot/seal adapter, current-run scratch-output manifest/digest validator and guarded consumer resolver, final manifest verifier, and process-tree owner used by every activation child.
- Create `scripts/admin-operations-browser-acceptance.mjs`: the exact desktop/mobile Playwright entry point using the repository CLI/process-tree owner.
- Create `tests/fixtures/admin-operations-cli-snapshot/schema.prisma`, `tests/fixtures/admin-operations-cli-snapshot/generate-schema.prisma`, `tests/fixtures/admin-operations-cli-snapshot/playwright.config.ts`, and `tests/fixtures/admin-operations-cli-snapshot/playwright-smoke.spec.ts`: database-free pinned-Prisma validation, command-specific real generation into the child-only `ADMIN_OPERATIONS_PRISMA_GENERATE_OUTPUT` scratch directory, and real Chromium Playwright smoke inputs used to prove preserved-layout closure execution.
- Create `tests/fixtures/admin-operations-env-capture.mjs`: cross-platform child that emits the sorted received environment names plus safe test-marker values and never prints secret values.
- Modify `next.config.mjs`: use the relative `distDir: "next-build"` only when a validated repository-CLI activation-build flag is present in the isolated writable current-run build workspace; ordinary builds retain `.next`. Never claim or pass an absolute `distDir`.
- Modify `package.json`: named rehearsal-status, sole Production-activation, and pinned browser-acceptance commands.
- Create `tests/admin-operations-activation.test.mjs`: pure contract and script-source coverage.
- Modify `lib/admin/browser-qa-authorization.ts`, `lib/admin/browser-fixture-provisioning.ts`, `lib/admin/browser-fixture-cleanup.ts`, and `lib/admin/browser-billing-goodwill-preview.ts`: require and await exact disposable identity before any mutation or preview adapter construction.
- Modify `tests/browser/admin-user-operations-fixture.ts`, `tests/browser/admin-user-operations.spec.ts`, `app/admin/users/[userId]/page.tsx`, `app/admin/users/[userId]/billing-actions.ts`, `tests/admin-user-operations-fixture.test.mjs`, `tests/admin-billing-goodwill-ui.test.mjs`, `tests/admin-security-ui.test.mjs`, `tests/browser-qa-harness.test.mjs`, and `playwright.config.ts`: update every async authorization caller, identity proof, and exact desktop/mobile invocation.
- Modify `docs/wiki/deployment.md`, `docs/wiki/release-checklist.md`, `docs/wiki/admin-user-operations.md`, `docs/project-state.md`, and `docs/project-log.md`.
- Create an Aegis work packet under `docs/aegis/work/2026-08-11-admin-operations-production-activation/` for sanitized intent, checkpoint, and evidence.

### Task 1: Build the fail-closed activation contract

**Files:**
- Create: `lib/admin/operations-activation-contract.ts`
- Create: `lib/admin/neon-control-plane.ts`
- Create: `lib/admin/admin-operations-data-safety.ts`
- Create: `lib/admin/admin-operations-fixture-provenance.ts`
- Create: `lib/admin/admin-operations-fixture-state.ts`
- Create: `lib/admin/admin-operations-qa-lifecycle-proofs.ts`
- Create: `tests/admin-operations-activation.test.mjs`

**Interfaces:**
- Produces:

```ts
export const ADMIN_OPERATIONS_MIGRATIONS = [
  "20260808090000_admin_authorization_audit_foundation",
  "20260808093000_admin_jwt_session_version",
  "20260808100000_admin_temporary_feature_access",
  "20260808110000_admin_billing_goodwill",
] as const

export const ADMIN_OPERATIONS_EVIDENCE_CHECK_NAMES = [
  "trusted_identity",
  "parent_trusted_identity",
  "receipt_lease_capture",
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
  "server_ownership",
  "qa_sentinel",
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

export type AdminOperationsEvidenceCheckName =
  (typeof ADMIN_OPERATIONS_EVIDENCE_CHECK_NAMES)[number]

export type TrustedNeonControlPlaneBinding = {
  projectId: string
  branchId: string
  branchName: string
  databaseName: string
  directHostname: string
}

export type TrustedNeonControlPlaneEvidence = object // opaque; created only by the authenticated lookup owner

export type AdminOperationsDataSafetyPurpose = "REHEARSAL_PARENT" | "QA_PARENT" | "REHEARSAL_INHERITED" | "QA_INHERITED"
export const ADMIN_OPERATIONS_DATA_SAFETY_MAX_AGE_MS = 5 * 60 * 1000
declare const approvedDataSafetyPolicyBrand: unique symbol // module-private, not exported
declare const approvedComplianceSourceBrand: unique symbol // module-private, not exported
export type ApprovedAdminOperationsDataSafetyPolicyVersion =
  ("admin-operations-rehearsal-no-phi-v1" | "admin-operations-qa-full-schema-v1")
  & { readonly [approvedDataSafetyPolicyBrand]: true }
export type ApprovedAuthenticatedComplianceSource = {
  readonly [approvedComplianceSourceBrand]: true
} // only the authenticated source owner creates it; no public constructor
export type TrustedAdminOperationsDataSafetyEvidence = object // opaque handle; runtime authority lives in a module-private class/WeakSet registry
export type VerifiedAdminOperationsDataSafetyResult = object // opaque handle; separately registered after verification

export async function loadTrustedAdminOperationsDataSafetyEvidence(input: {
  purpose: AdminOperationsDataSafetyPurpose
  target: TrustedNeonControlPlaneEvidence
  approvedComplianceSource: ApprovedAuthenticatedComplianceSource
}): Promise<TrustedAdminOperationsDataSafetyEvidence>

export function verifyTrustedAdminOperationsDataSafetyEvidence(input: {
  evidence: TrustedAdminOperationsDataSafetyEvidence
  purpose: AdminOperationsDataSafetyPurpose
  expectedTarget: TrustedNeonControlPlaneEvidence
  now: Date
}): VerifiedAdminOperationsDataSafetyResult

export const ADMIN_OPERATIONS_FIXTURE_PROVENANCE_MAX_AGE_MS = 5 * 60 * 1000
export type ApprovedAdminOperationsFixtureSourceVersion = "admin-operations-browser-fixture-v1" // exact owner allowlist
export type ApprovedAuthenticatedFixtureSource = object // opaque, module-private runtime authority
export type TrustedAdminOperationsFixtureProvenance = object // opaque proof, separately registered
export type VerifiedAdminOperationsFixtureProvenance = object // opaque verified result, separately registered

export async function loadTrustedAdminOperationsFixtureProvenance(input: {
  source: ApprovedAuthenticatedFixtureSource
  sourceVersion: ApprovedAdminOperationsFixtureSourceVersion
  qaTarget: TrustedNeonControlPlaneEvidence
  databaseName: string
  cleanCommit: string
}): Promise<TrustedAdminOperationsFixtureProvenance>

export function verifyTrustedAdminOperationsFixtureProvenance(input: {
  proof: TrustedAdminOperationsFixtureProvenance
  expectedTarget: TrustedNeonControlPlaneEvidence
  expectedDatabaseName: string
  expectedCleanCommit: string
  now: Date
}): VerifiedAdminOperationsFixtureProvenance

export function validateDirectNeonMigrationUrl(
  value: string,
  trustedBinding: TrustedNeonControlPlaneBinding,
): {
  projectId: string
  branchId: string
  databaseName: string
}

export function validateAdminOperationsPendingMigrations(
  pending: readonly string[],
): readonly string[]

export function buildAdminOperationsAuthorizationFingerprint(value: {
  target: TrustedNeonControlPlaneBinding
  commit: string
  pendingMigrations: readonly string[]
}): string

export function validateAdminOperationsStatusFreshness(value: {
  checkedAt: string
  now?: Date
  maxAgeMs: number
}): Date

export type AdminOperationsRehearsalAttestation = {
  schemaVersion: 1
  productionTarget: TrustedNeonControlPlaneBinding
  checkoutSha: string
  pendingMigrations: readonly ExpectedMigrationName[]
  rehearsalTarget: TrustedNeonControlPlaneBinding
  rehearsalBranchName: `admin-operations-migration-rehearsal-${string}-${string}`
  rehearsalRunId: string
  proofs: {
    preStatus: { outcome: "PENDING_SUFFIX"; sha256: string }
    deploy: { outcome: "PASS"; sha256: string }
    rehearsal_post_status: { outcome: "UP_TO_DATE"; sha256: string }
    prismaValidate: { outcome: "PASS"; sha256: string }
    prismaGenerate: { outcome: "PASS"; sha256: string }
    focusedTests: { outcome: "PASS"; sha256: string }
    typecheck: { outcome: "PASS"; sha256: string }
    lint: { outcome: "PASS"; sha256: string }
    fullTests: { outcome: "PASS"; sha256: string }
    build: { outcome: "PASS"; sha256: string }
    parentDataSafety: { outcome: "PASS"; sha256: string }
    inheritedDataSafety: { outcome: "PASS"; sha256: string }
    rehearsal_read_only_smoke: { outcome: "PASS"; sha256: string }
    scratch_cleanup: { outcome: "PASS"; sha256: string }
    branch_deleted: { outcome: "ABSENT"; sha256: string }
  }
  postDeployMigrations: Array<{ name: ExpectedMigrationName; status: "APPLIED" }>
  issuedAt: string
  expiresAt: string
  nonce: string
  signature: string
}

export type AdminOperationsAttestationNonceState =
  | { state: "ISSUED"; attestationDigest: string; expiresAt: string }
  | { state: "RESERVED"; attestationDigest: string; expiresAt: string; runId: string; reservedAt: string }
  | { state: "DEPLOY_STARTED"; attestationDigest: string; expiresAt: string; runId: string; startedAt: string }
  | { state: "CONSUMED"; attestationDigest: string; runId: string; consumedAt: string }

export type AdminOperationsAttestationNonceStore = {
  issue(input: { nonce: string; attestationDigest: string; expiresAt: string }): Promise<void>
  reserve(input: { nonce: string; attestationDigest: string; runId: string; now: Date }): Promise<void>
  assertReserved(input: { nonce: string; attestationDigest: string; runId: string; now: Date }): Promise<void>
  markDeployStarted(input: { nonce: string; attestationDigest: string; runId: string; now: Date }): Promise<void>
  releaseBeforeDeploy(input: { nonce: string; attestationDigest: string; runId: string; now: Date }): Promise<void>
  consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(input: { nonce: string; attestationDigest: string; runId: string; now: Date; pendingFinal: AdminOperationsPendingSmokeFinalization }): Promise<void>
}

export function validateDisposableAdminQaIdentity(value: {
  databaseUrl: string
  optIn: string | undefined
  expectedBinding: TrustedNeonControlPlaneBinding
  trustedEvidence: TrustedNeonControlPlaneEvidence
  vercelEnv: string | undefined
}): TrustedNeonControlPlaneBinding
```

The rehearsal attestation uses only the named `rehearsal_post_status` proof for its complete four-`APPLIED` post-deploy result; generic `postStatus` is prohibited. Its cleanup proofs are likewise exact and separate: `scratch_cleanup` proves bounded run-owned scratch deletion/absence after tree exit, while `branch_deleted` proves receipt-authorized rehearsal-branch deletion and trusted control-plane absence. Generic `cleanup`, camelCase `branchDeletion`, aliasing one proof to the other, omission, or swapped digests reject during signing, verification, final pre-spawn revalidation, acceptance, and evidence serialization.

- [ ] **Step 1: Write RED tests for exact migration inventory and terminal pending suffixes**

Assert all four exact names and ordering. Status validation accepts `[]`, the complete list, or a contiguous terminal suffix such as the final three, final two, or final one migrations. Activation routing treats `[]` only as audit's terminal no-op and rejects it from rehearsal attestation issuance and final mode. Reject gaps and arbitrary order-preserving subsets (including the middle two), as well as unknown, duplicate, malformed, reordered, or pre-Admin pending names. Validate the rehearsal attestation's canonical signed payload field by field: require the trusted Production target, exact attached clean checkout SHA, nonempty ordered suffix, trusted rehearsal target and prefixed branch identity, mandatory target-bound `parentDataSafety: PASS`, `inheritedDataSafety: PASS`, and `rehearsal_read_only_smoke: PASS` SHA-256 proofs, every other exact proof outcome above, a complete four-entry `APPLIED` post-status with `UP_TO_DATE`, verified cleanup/deletion, unique nonce, and bounded issue/expiry timestamps. The canonical bytes hashed for each data-safety proof include only its policy/version or approved proof digest, aggregate outcome, exact target binding, and timestamp—never rows, values, PHI, or secrets. The canonical bytes hashed for `rehearsal_read_only_smoke` include the sanitized smoke result plus the exact rehearsal target binding, checkout SHA, and ordered suffix, so proof replay across a branch, commit, or suffix fails final validation. Legacy `readOnlySmoke` and unintended `rehearsalReadOnlySmoke` are both rejected rather than accepted as aliases.

```js
assert.deepEqual(validateAdminOperationsPendingMigrations([
  "20260808093000_admin_jwt_session_version",
  "20260808100000_admin_temporary_feature_access",
  "20260808110000_admin_billing_goodwill",
]), [
  "20260808093000_admin_jwt_session_version",
  "20260808100000_admin_temporary_feature_access",
  "20260808110000_admin_billing_goodwill",
])
assert.throws(
  () => validateAdminOperationsPendingMigrations([
    "20260808093000_admin_jwt_session_version",
    "20260808100000_admin_temporary_feature_access",
  ]),
  /contiguous terminal suffix/,
)
assert.throws(
  () => validateAdminOperationsPendingMigrations(["20260718120000_background_commerce_foundation"]),
  /unexpected pending migration/,
)
```

Add explicit applied-history contradiction fixtures: reject an earlier singleton or prefix as pending when any later expected migration is already applied (for example, migration 1 pending while migration 4 is applied, or migrations 1-2 pending while 3-4 are applied). In both cases the pending names are allowlisted but are not a terminal suffix, so validation must fail rather than treating “known name” as sufficient.

- [ ] **Step 2: Write RED tests for trusted direct-Neon binding, fingerprints, and disposable identity gates**

Require `postgres:`/`postgresql:`, `.neon.tech`, and a hostname without `-pooler`. Require the URL and operator-expected tuple to match the binding unwrapped from opaque module-branded evidence returned by the independently authenticated Neon lookup; the URL parser cannot create that evidence. Explicitly assert that fabricated operator values which all match each other and the URL still fail, as does a structurally identical caller-created “trusted” object with all matching values. Valid test evidence may be created only by exercising the authenticated lookup with an injected mock HTTP response. Also fail when the lookup is missing/errors or returns any different project ID, branch ID, database name, or direct hostname. Reject changed bindings, missing database names, and query-log output. Assert the authorization fingerprint changes when the target project, branch, database, direct hostname, checkout commit, or ordered pending suffix changes. Build two evidence envelopes with the same semantic inputs and different `checkedAt` values and assert their fingerprints are identical, while the separate freshness validator accepts only finite ISO timestamps inside the caller-supplied bounded age. Attestations use canonical serialization plus HMAC-SHA-256 with a key supplied only to the rehearsal/final child by the approved secret runner; the key and signature never enter committed evidence. Reject expired, not-yet-valid, reused, malformed, or incorrectly signed attestations and any target, checkout, suffix, rehearsal identity, proof hash/outcome, post-status, cleanup, deletion, or trusted-control-plane absence mismatch. A successful Production deploy consumes the nonce; any mismatch or reappearance of the rehearsal branch invalidates it and requires a fresh rehearsal. Also reject Production QA and missing opt-in.

Drive the data-safety owner only through an injected approved authenticated compliance source. `ApprovedAuthenticatedComplianceSource` carries a module-private opaque brand created only by that authenticated source owner; callers cannot construct it. `ApprovedAdminOperationsDataSafetyPolicyVersion` is the exact branded literal union `"admin-operations-rehearsal-no-phi-v1" | "admin-operations-qa-full-schema-v1"`; each policy owns its scope plus immutable exported `ADMIN_OPERATIONS_DATA_SAFETY_MAX_AGE_MS = 300000`. Runtime authority for both `TrustedAdminOperationsDataSafetyEvidence` and `VerifiedAdminOperationsDataSafetyResult` is a module-private class/private field or two module-private `WeakSet` registries; no constructor, brand symbol, registration hook, or raw PASS result is exported. Verification returns only a registered opaque result that wrappers must unwrap internally. Tests prove `{}`, spread/structured clones, structural `{ outcome: "PASS" }`, assertions/casts, and an evidence object substituted for a verified result all fail. The rehearsal `NO_PHI` policy covers the canonical PHI-bearing workflow/table scope. The QA full-schema policy covers every application table/relation and its allowlisted sanitized residual aggregates. Reject forged/plain source/policy/evidence/result, caller digest, stale/wrong target/purpose/policy, incomplete scope, unallowlisted residual, non-`PASS`, and row-bearing evidence. Wrappers verify the registered result before create/work. Serializer tests retain only approved digest, aggregate outcome, policy version, and timestamp.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: FAIL with missing contract, data-safety, and fixture-provenance owner modules.

- [ ] **Step 4: Implement the pure validators**

Never return usernames, passwords, ports, or query parameters from the URL parser. Validate terminal suffixes and complete applied-history coherence by exact position, and serialize only the sanitized binding, commit, and suffix in one documented canonical field order before hashing the authorization fingerprint with SHA-256. Validate `checkedAt` independently against the allowed freshness window and include it only as non-fingerprint evidence. Use exact constant-time string equality where practical for identity fields, and require `VERCEL_ENV !== "production"` for the disposable QA identity. A raw `TrustedNeonControlPlaneBinding` supplied by the operator is only expected input; authorization code must unwrap authoritative binding data from valid opaque evidence produced by the server-only lookup owner, and a matching plain object must fail.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: PASS for terminal-suffix, trusted-binding, fingerprint, direct-host, data-safety, fixture-provenance, and disposable-identity cases.

- [ ] **Step 6: Commit the activation contract**

```bash
git add lib/admin/operations-activation-contract.ts lib/admin/neon-control-plane.ts lib/admin/admin-operations-data-safety.ts lib/admin/admin-operations-fixture-provenance.ts lib/admin/admin-operations-fixture-state.ts lib/admin/admin-operations-qa-lifecycle-proofs.ts tests/admin-operations-activation.test.mjs
git commit -m "feat: add fail-closed admin activation contract"
```

### Task 2: Add sanitized preflight and the sole Production wrapper

**Files:**
- Create: `scripts/admin-operations-activation.mjs`
- Create: `scripts/admin-operations-production-activation.mjs`
- Create: `scripts/admin-operations-rehearsal.mjs`
- Create: `scripts/admin-operations-attestation-store.mjs`
- Create: `scripts/admin-operations-evidence-store.mjs`
- Create: `scripts/admin-operations-production-smoke.mjs`
- Create: `scripts/admin-operations-repository-cli.mjs`
- Create: `scripts/admin-operations-browser-acceptance.mjs`
- Create: `tests/fixtures/admin-operations-cli-snapshot/schema.prisma`
- Create: `tests/fixtures/admin-operations-cli-snapshot/generate-schema.prisma`
- Create: `tests/fixtures/admin-operations-cli-snapshot/playwright.config.ts`
- Create: `tests/fixtures/admin-operations-cli-snapshot/playwright-smoke.spec.ts`
- Create: `tests/fixtures/admin-operations-env-capture.mjs`
- Modify: `next.config.mjs`
- Modify: `package.json`
- Modify: `tests/admin-operations-activation.test.mjs`

**Interfaces:**
- Consumes:
  - `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL` for the direct connection.
  - `ADMIN_OPERATIONS_NEON_PROJECT_ID`, `ADMIN_OPERATIONS_NEON_BRANCH_ID`, `ADMIN_OPERATIONS_NEON_DATABASE_NAME`, and `ADMIN_OPERATIONS_NEON_DIRECT_HOSTNAME`, populated from a fresh independent trusted-control-plane lookup; never derive these expected values from `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL`.
  - `ADMIN_OPERATIONS_ATTESTATION_STATE_DIR`, injected only into audit/rehearsal/final/smoke children by the approved runner, never the parent shell/runtime app, as one absolute operator-controlled namespaced durable directory outside the checkout, repository, secret material, and committed/sanitized evidence destinations. The store rejects relative paths, symlinks/reparse points, insecurely broad locations, and paths under the repository.
  - output from the verified immutable Prisma package-closure snapshot invoked with exact arguments `migrate`, `status`.
- Produces one allowlist-only evidence object with the exact schema defined below; the same serializer owns status stdout, audit records, checkpoints, and Aegis evidence.

```ts
type SanitizedTargetBinding = { projectId: string; branchId: string; databaseName: string; directHostname: string }

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

For `qa` mode, top-level `target`, `parentTarget`, and `qaTarget` are required: exact four-field equality requires `target === qaTarget`, while `parentTarget` must be distinct. `parent_trusted_identity` binds `parentTarget`; the fresh post-create `qa_trusted_identity` binds both `target` and `qaTarget`. Every other mode requires both auxiliary fields to be `null`. The serializer copies only the four safe binding fields into each target and never spreads source objects. Attempt/completion validation, evidence-store CAS bindings, and fixture-provenance validation must use the correct target reference. Tests retain all QA targets and reject missing fields, `target`/`qaTarget` mismatch, parent/QA equality, swapped parent/QA, wrong, or extra targets; non-QA evidence with either auxiliary target rejects.

Each check requires an allowlisted `proofRef`. The proof owner hashes a canonical versioned envelope containing the exact check name/outcome, its matrix-selected sanitized target, exact commit, mode, and canonical output; only checks whose matrix contract names a safe manifest may carry a validated non-URL/non-path `manifestRef`. Attestation creation and verification bind these check proof hashes individually. The serializer copies only schema/version/digest and the optional allowlisted safe manifest reference. RED tests reject a missing proof, digest/output mismatch, target/commit/mode replay, proof references swapped between two checks, unsafe manifest references, or attestation proof-map disagreement.

Exactly one canonical smoke check appears in completed rehearsal/final evidence (`rehearsal_read_only_smoke` or `production_read_only_smoke` respectively); status/QA have none. The audit evidence row remains immutable with exactly `trusted_identity`, `orphan_scan`, and `migration_status`. Its smoke CAS does not append a check; it emits a separate `AdminOperationsFinalizedAuditCheckpoint` with `kind: "FINALIZED_AUDIT_NO_OP"`, the exact audit evidence/version/digest in `auditEvidence`, one `production_read_only_smoke` check, byte-identical `smokeProofRef`, and `finalizedFrom`, while rejecting every rehearsal/final/deployment field. In rehearsal/final evidence and that finalized-audit checkpoint, the smoke check's `proofRef` and top-level `smokeProofRef` are byte-identical references to one digest-addressed opaque envelope containing only allowlisted schema/version/digest/outcome/timestamp plus exact target/commit/fingerprint and applicable status/run/nonce/attestation bindings. CAS recomputes it and rejects audit-evidence mutation, missing equality, duplicate/alternate smoke proofs, replay, cross-mode/target/commit swaps, or concurrent reuse. RED tests cover both output shapes and mutate either reference independently.

Proof kinds are exact and non-interchangeable. `migration_status`, distinct `rehearsal_post_status`, `qa_post_status`, and `production_post_status` each require their own status envelope and cannot substitute. `fixture_provenance` and QA-only `fixture_state` require separate opaque-owner proofs: the latter is created only after fixture load and contains a canonical sanitized aggregate-state digest bound to exact QA target, clean commit, run/lease, and provenance proof, never rows, PHI, PII, emails, or secrets. `scratch_cleanup` is a distinct cleanup/absence proof bound to run, workspace manifest, scratch-output manifest, opaque scratch identity, confirmed full-tree exit, bounded deletion, and verified absence; no path is serialized. Rehearsal and QA completion require it after their final functional check, while a failure is retained in attempt evidence and never suppresses external cleanup. Production modes do not own an aggregate mode-level scratch: each sealed repository-CLI status/deploy invocation owns its separate scratch and its command proof cannot pass without confirmed tree exit plus bounded scratch deletion/absence, so final has no separate matrix entry. Before browsers, `smtp_isolation` proves the SMTP server/environment and `billing_mutation_guard_armed` proves instrumentation is armed for form, POST, and provider-mutation counts. Desktop/mobile browser proofs bind the same exact `fixture_state` proof reference/digest as well as exact QA target, commit, run/lease, project, viewport, spec/config digests, SMTP proof, and armed-guard proof. After both browser trees exit, `billing_zero_mutation` binds both browser proof digests. Missing, swapped, cross-run, substituted, row-bearing, or premature state/guard/browser proofs reject; rehearsal attestation signing/verification rejects the QA-only `fixture_state` name.

The QA lifecycle kinds are likewise exact, non-substitutable opaque-owner proof kinds: `receipt_lease_capture` is the stable authority produced only by `captureReceiptLeaseAuthority`, `server_ownership` only by `recordServerOwnership`, and `qa_sentinel` only by `recordQaSentinel`; none may be represented by a generic control-plane, command, status, cleanup, fixture, browser, or short-lived verification proof. The capture check retains the stable authority digest, while browser evidence carries one separately named renewable `receiptLeaseVerificationRef` whose envelope binds that digest. Each `browser_desktop` and `browser_mobile` envelope must carry that same byte-identical renewed verification ref plus byte-identical proof references/digests for `fixture_state`, `smtp_isolation`, `billing_mutation_guard_armed`, `server_ownership`, and `qa_sentinel`, in addition to its viewport-specific binding. Signing, serialization, QA acceptance-attestation construction/verification, and final browser-evidence validation reject an omitted kind, a kind substitution, a reference copied into a different field, different desktop/mobile references, an expired renewal, or any forged, cloned, replayed-to-another-completion, cross-target, cross-run, wrong-order, wrong-tree, wrong-build, or wrong-sentinel owner proof. Rehearsal attestation signing/verification rejects all three QA lifecycle kinds and the receipt verification ref as mode-incompatible.

`scripts/admin-operations-attestation-store.mjs` owns nonce and deployed pending-final state in one combined generation under the same per-nonce lock. Its `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)` replaces standalone consumption and atomically writes `CONSUMED` plus the full `AdminOperationsPendingSmokeFinalization` payload (`POST_STATUS_VERIFIED_AWAITING_SMOKE`, checks through `production_post_status`, evidence version/digest, commit, target, fingerprint, post-status digest, run, nonce, attestation). `scripts/admin-operations-evidence-store.mjs` owns pending `NO_OP`, completed variants, `get`, and `finalizeWithSmoke`, but cannot independently create deployed pending-final state. Crash injection before temp write, after fsync, before rename, after rename, and during recovery proves either old `DEPLOY_STARTED` or combined `CONSUMED` plus pending-final, never split. Crash/resume permits one matching smoke CAS; torn/ambiguous state, replay, mismatch, and concurrent finalizers fail. The smoke-proof producer/type is runtime-opaque and exposes no rows or secrets.

The evidence store owns a versioned compare-and-swap finalizer. The allowlisted smoke proof contains only schema version, digest, outcome, checkedAt, exact commit, sanitized target, and semantic fingerprint plus its mode-specific status binding. The `NO_OP` CAS binds the prior audit version/digest, exact commit, target, fingerprint, audit-status digest, and smoke proof; run, nonce, attestation, and Production-post-status fields must be null/absent and are rejected if supplied. The deployed-final CAS instead binds the partial-final version/digest, exact commit, target, fingerprint, Production post-status digest, final run ID, nonce, attestation digest, and smoke proof. Only a successful CAS produces completed activation/checkpoint evidence and records `finalizedFrom` plus `smokeProofRef`. Any missing/mismatched binding, prohibited cross-mode field, replay, or concurrent finalizer fails without changing evidence. The audit command may complete a no-deploy status packet, but its `NO_OP` checkpoint is not finalized until this explicit smoke-reference CAS; it never relies on an out-of-band note. Neither proof nor final evidence may contain rows, provider IDs, credentials, or secrets. Tests cover both binding sets, reject each deployment-only field independently on `NO_OP`, race two finalizers (exactly one wins), replay the winner, and mutate every required binding independently.

`mode` identifies only the execution phase that produced the evidence. Checkpoint and Aegis files are document destinations that embed this exact serialized object; they are not additional `mode` values. The serializer copies these fields individually and never spreads control-plane, child-process, Prisma, Stripe, fixture, or data-safety source objects. It rejects legacy `readOnlySmoke` and unintended `rehearsalReadOnlySmoke`. The validator uses this exact five-mode matrix as each mode's ordered completion set:

`lib/admin/admin-operations-qa-lifecycle-proofs.ts` alone exposes `captureReceiptLeaseAuthority(...)`, `verifyReceiptLeaseAuthority(...)`, `renewReceiptLeaseVerification(...)`, `verifyReceiptLeaseVerification(...)`, `recordServerOwnership(...)`, `verifyServerOwnership(...)`, `recordQaSentinel(...)`, and `verifyQaSentinel(...)`. Returned authorities/envelopes require distinct module-private classes/private fields plus separate `WeakSet` registries; there is no public constructor, brand, registration, unwrap, or caller-supplied renewal API. The stable canonical-v1 capture-authority digest binds parent/child targets, immutable creation receipt, owner lease, run ID, and monotonic creation sequence and never expires or changes. Server ownership binds that stable digest plus launch receipt, root PID/process-tree ID, origin, commit/run, and validated build-manifest digest; sentinel binds ownership digest, target/run/build digest, nonce, response digest, and checkedAt. Renewal accepts only the registered original authority and, through the owner's trusted-control-plane adapter, freshly re-fetches and exact-compares child target, receipt, lease, run, and creation sequence before issuing an opaque single-QA-completion-scoped verification envelope with stable-authority digest, owner-generated nonce, `checkedAt`, and `expiresAt`. `QA_RECEIPT_VERIFICATION_MAX_AGE_MS = 300000`; after server ownership and sentinel pass and immediately before `browser_desktop`, the owner issues one renewal ref, consumes it only for the named desktop envelope, named mobile envelope, and final QA-completion verification, then seals it consumed, all before expiry. Long setup may renew from the original authority, but callers cannot extend, clone, chain from an earlier envelope, alter its stable digest, or use it for another run/completion. Fake clocks test boundary/rollback behavior; long-run tests prove the stable authority remains valid while old renewals expire; renewal/replay tests reject changed lease/target/run/order, arbitrary caller input, chain substitution, cross-completion reuse, a third viewport use, expiry between viewports, and expiry before completion. Plain/cloned/spread/cast, wrong target/run/commit/tree/build/origin/nonce/digest, or mismatched viewport refs reject.

The executable environment allowlist is exact; `{BOOT}` means only `SystemRoot`, `WINDIR`, `ComSpec`, `PATHEXT`, and `TEMP`/`TMP` on Windows, or `HOME`, `TMPDIR`, `LANG`, and `LC_ALL` on POSIX, and only when the pinned executable demonstrably requires each key. All rows also receive `ADMIN_OPERATIONS_RUN_ID`; no row inherits anything else.

| Command | Exact additional environment keys |
| --- | --- |
| status / post-status | `{BOOT}`, `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL`, `DATABASE_URL`, `DIRECT_URL`, `ADMIN_OPERATIONS_TARGET_BINDING`, `ADMIN_OPERATIONS_SCRATCH_ROOT`, `ADMIN_OPERATIONS_INPUT_MANIFEST` |
| deploy | status keys plus `ADMIN_OPERATIONS_ATTESTATION_DIGEST` only in Production final |
| validate | `{BOOT}`, fixed nonsecret `DATABASE_URL=postgresql://validator:validator@127.0.0.1:1/validator`, identical fixed nonsecret `DIRECT_URL`, `ADMIN_OPERATIONS_SCRATCH_ROOT`, `ADMIN_OPERATIONS_INPUT_MANIFEST`; no target binding, secret, DNS, connection, or other network I/O |
| generate | `{BOOT}`, `ADMIN_OPERATIONS_SCRATCH_ROOT`, `ADMIN_OPERATIONS_INPUT_MANIFEST`, `ADMIN_OPERATIONS_PRISMA_GENERATE_OUTPUT` |
| focused tests / unit tests | `{BOOT}`, `ADMIN_OPERATIONS_SCRATCH_ROOT`, `ADMIN_OPERATIONS_INPUT_MANIFEST`; add exact `DATABASE_URL`, `DIRECT_URL`, target binding only to the named DB-I/O test subprocess proven by the test inventory |
| rehearsal / Production smoke | `{BOOT}`, `ADMIN_OPERATIONS_SCRATCH_ROOT`, `ADMIN_OPERATIONS_INPUT_MANIFEST`; add exact DB URL pair and target binding only because these named smoke owners execute documented read-only DB queries |
| browser owner/server | `{BOOT}`, exact disposable `DATABASE_URL`, `DIRECT_URL`, `ADMIN_OPERATIONS_TARGET_BINDING`, `ADMIN_OPERATIONS_RUN_ID`, stable capture digest, renewed `receiptLeaseVerificationRef`, build/fixture/SMTP/billing-guard/server/sentinel refs, SMTP blanking and QA opt-in; no Production/provider/auth secret |
| typecheck / lint | `{BOOT}`, `ADMIN_OPERATIONS_SCRATCH_ROOT`, `ADMIN_OPERATIONS_INPUT_MANIFEST`, validated generated-output manifest/ref |
| build | `{BOOT}`, `ADMIN_OPERATIONS_SCRATCH_ROOT`, build-workspace/input/dependency manifest refs and activation-build flag; no database credential |

Tests spawn the tracked `tests/fixtures/admin-operations-env-capture.mjs <commandName>` fixture for every row on Windows/POSIX, assert byte-exact sorted key/value names, start from empty, prove the parent unchanged, prove validate receives only the two fixed placeholder values and cannot receive real target bytes, and inject every denied database/provider/auth/email/system key individually; any extra/missing key fails before command work.

| Mode | Exact required checks | Outcome/completion constraint |
| --- | --- | --- |
| `status` | `trusted_identity`, `migration_status` | `UP_TO_DATE` or `PENDING_SUFFIX`; read-only and never completion authority |
| `audit` | `trusted_identity`, `orphan_scan`, `migration_status` | `PENDING_SUFFIX`, or `UP_TO_DATE`/`NO_OP`; an empty suffix is represented only by this `NO_OP` path and never as `final` |
| `rehearsal` | `trusted_identity`, `orphan_scan`, `parent_data_safety`, `inherited_data_safety`, `migration_status`, `migration_deploy`, `rehearsal_post_status`, `prisma_validate`, `prisma_generate`, `focused_tests`, `typecheck`, `lint`, `unit_tests`, `build`, `rehearsal_read_only_smoke`, `scratch_cleanup`, `branch_deleted` | `DEPLOYED`; nonempty suffix, distinct complete rehearsal post-status, scratch and branch absence |
| `qa` | `parent_trusted_identity`, `orphan_scan`, `parent_data_safety`, `receipt_lease_capture`, `qa_trusted_identity`, `inherited_data_safety`, `migration_status`, `migration_deploy`, `qa_post_status`, `fixture_provenance`, `fixture_state`, `smtp_isolation`, `billing_mutation_guard_armed`, `server_ownership`, `qa_sentinel`, `browser_desktop`, `browser_mobile`, `billing_zero_mutation`, `scratch_cleanup`, `fixture_cleanup`, `branch_deleted` | `DEPLOYED`; captured receipt/lease, QA state, owned sentinel-proven server, guards/browsers, zero mutation, cleanup |
| `final` | `trusted_identity`, `orphan_scan`, `migration_status`, `final_locked_refetch`, `final_fingerprint_match`, `fresh_production_authorization`, `production_migration_deploy`, `production_post_status`, `production_read_only_smoke` | `DEPLOYED`; nonempty attested suffix, complete Production four-`APPLIED` post-status, and postdeploy smoke on the exact deployed commit |

Validate evidence in two stages. **Attempt evidence** has overall `BLOCKED` or `FAILED`, contains only check names allowed for its mode, retains `PASS`/`FAIL` truthfully (including failed `parent_data_safety` or `inherited_data_safety`), and may contain only the exact reached prefix/subsequence permitted by the documented execution order and cleanup `finally` edges; it may not invent an unreached check. **Completion evidence** has the mode's successful outcome from the matrix, contains the exact full ordered set once, and requires every check `PASS`. Audit `UP_TO_DATE`/`NO_OP` completes the exact full no-deploy audit status packet only; the activation/checkpoint remains unfinalized until its bound smoke-reference CAS succeeds. Final completion likewise exists only after exact-commit `production_read_only_smoke: PASS`; nonce consumption after deploy/post-status does not complete its evidence. Unknown, duplicate, additional, out-of-order, or mode-incompatible names reject either evidence form; prohibited fields remain fail-closed. Identity/status, authorization, locked refetch, fingerprint comparison, deploy, post-status, and either canonical smoke proof must never be inferred from or conflated with another check. Add retention tests for all four target fields, commit SHA, ordered migration names/statuses, fingerprint, timestamps, outcomes, every full matrix row, and truthful partial attempt prefixes/cleanup edges. Add omission tests proving credentials, URLs, rows/row values, PHI, emails, raw stdout/stderr, unknown keys, data-safety source material, and provider transaction/payment/customer/subscription IDs never appear in serialized status, audit, checkpoint, or Aegis evidence. Reject the complete object rather than silently dropping a check when its name is unknown, including email-like (`operator@example.com`), URL-like (`https://example.com/check`), provider-ID-like (`customer_cus_123`), and database-looking (`DATABASE_URL`) names; assert none of those values is serialized into any destination.

- [ ] **Step 1: Add RED tests for the script boundary**

Assert the canonical QA evidence sequence byte-for-byte as `parent_trusted_identity -> orphan_scan -> parent_data_safety -> receipt_lease_capture -> qa_trusted_identity -> inherited_data_safety -> migration_status -> migration_deploy -> qa_post_status -> fixture_provenance -> fixture_state -> smtp_isolation -> billing_mutation_guard_armed -> server_ownership -> qa_sentinel -> browser_desktop -> browser_mobile -> billing_zero_mutation -> scratch_cleanup -> fixture_cleanup -> branch_deleted`. Fixture load, confirmed process-tree exit, and trusted absence remain tested operational boundaries without becoming matrix aliases. Browser envelopes bind the same renewed receipt-verification ref and identical fixture-state, server-ownership, sentinel, SMTP, and billing-guard refs. Tests reject missing/order-changed capture, forged/expired/mismatched renewal chains, and forged/stale/mismatched server/sentinel evidence.

Compile/import the script helpers without executing Prisma, reading activation environment, printing, or spawning. Assert it rejects trusted-binding mismatch before spawning, sets both `DATABASE_URL` and `DIRECT_URL` only in the Prisma child's environment, leaves the parent environment unchanged, and never copies URLs or raw stdout/stderr into evidence. Drive direct `main` with a trusted Production binding and assert it fails before the spawn double is called; drive it with a trusted `admin-operations-migration-rehearsal-...` binding and assert status succeeds with the same child-only environment boundaries. Production status is implemented inside the Production wrapper rather than exposed through an export or forgeable environment nonce. Exercise the shared serializer with a source object containing every retained field plus credentials, URLs, rows, emails, raw command output, unknown fields, and provider transaction/payment/customer/subscription IDs; assert the exact retained object and exact omission of every prohibited field when that object is printed as status/audit output or embedded in checkpoint/Aegis destinations. Separately test all five modes: `BLOCKED`/`FAILED` attempt evidence accepts only truthful reached order prefixes plus documented cleanup edges and retains `FAIL`, including failed parent/inherited safety; successful completion accepts only the exact full ordered set with every check `PASS`. Require and verify the exact per-check proof kind/digest for every matrix row; reject missing, mismatched, replayed, or swapped proof references. Reject missing completion checks, invented/unreached attempt checks, out-of-order, duplicate, additional, mode-incompatible, and unknown email-, URL-, provider-ID-, or database-looking names. Assert audit `[]` emits the completed no-deploy `NO_OP` status packet with its full passing audit set and cannot call rehearsal/final, while attestation creation and final mode both reject `[]`; assert its checkpoint and deployed final each remain unfinalized until their mode-specific Production smoke CAS passes.

With fully injected owners, assert the canonical rehearsal evidence sequence byte-for-byte as `trusted_identity -> orphan_scan -> parent_data_safety -> inherited_data_safety -> migration_status -> migration_deploy -> rehearsal_post_status -> prisma_validate -> prisma_generate -> focused_tests -> typecheck -> lint -> unit_tests -> build -> rehearsal_read_only_smoke -> scratch_cleanup -> branch_deleted`; the post-status proof is distinct and mandatory in attestation/acceptance. QA follows its canonical matrix sequence above. Add table rows for receipt/lease capture and renewal, process-tree exit/safety, fixture cleanup, branch deletion, and trusted absence failure/throw/timeout. Capture failure permits no row cleanup/deletion. After valid capture, fixture-row cleanup is called only for confirmed safe exit and otherwise is truthfully `SKIPPED`/`BLOCKED`; exact deletion is still called once and absence still follows even when deletion fails. Every failure blocks acceptance.

The QA fixture owners produce separate opaque allowlisted proofs. `fixture_provenance` binds approved source ID/version/digest to exact trusted QA project/branch/database and clean commit. Only after fixture load, `fixture_state` computes a canonical sanitized aggregate-state digest and binds it to that exact target, commit, run/lease, and provenance proof. Attempt evidence may retain either `FAIL`; completion requires both `PASS`. Reject missing, forged/plain/cloned, stale, mismatched, pre-load, cross-run/target/commit/provenance, noncanonical, and row-bearing state. Serializer and browser-proof/acceptance attestations retain only safe schema/version/digest/outcome/timestamp and binding digests; both browser proofs must reference the same byte-identical `fixture_state` proof. Rehearsal attestation rejects it as QA-only.

Drive the status parser from static sanitized fixtures for: exact up-to-date output, one and multiple unapplied migrations, Windows and LF newlines, connection failure, failed migration, divergence, missing migration table, truncated unapplied output, duplicate/contradictory status headings, and migration-looking lines embedded in diagnostics. Include explicit tests named for later-applied-history contradiction: a parsed earlier singleton `[migration 1]` pending while migration 4 is known later in the expected history, and an earlier prefix `[migrations 1, 2]` pending while 3-4 are later in that history. Both must fail as non-terminal pending sets even though every individual name is allowlisted. The parser must be a state machine over a recognized complete status section: it may collect `^\d{14}_[a-z0-9_]+$` lines only between the exact unapplied heading and its recognized terminal guidance/end marker, or accept the exact complete up-to-date marker. Reject incomplete, mixed, repeated, or migration-looking diagnostic output rather than scraping matching lines globally. Assert the child-process contract exactly: exit `0` is accepted only with one complete up-to-date section; exit `1` is accepted only with one complete allowed pending-suffix section; an up-to-date section with exit `1`, a pending section with exit `0`, every other exit code, `null` exit code, or any termination signal is rejected regardless of parseable text.

- [ ] **Step 2: Run the script test and verify RED**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: FAIL because the script and npm command do not exist.

- [ ] **Step 3: Implement read-only `status` mode**

Expose pure helpers for tests, and run only when invoked directly. Use an ESM-safe main guard that also works for Windows paths; importing the module must be side-effect free:

```js
import path from "node:path"
import { pathToFileURL } from "node:url"

const isMain = Boolean(process.argv[1])
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  await main(process.argv.slice(2), process.env)
}
```

Inside `main`, require exact `status` mode, validate the trusted control-plane binding before spawning, and reject a Production branch/target before constructing the Prisma child. Standalone status accepts only a trusted disposable rehearsal or QA branch identity. Build, seal, and finally verify the complete Prisma execution workspace, including sealed Node, package closure, `prisma.config.ts`, schema, migrations, generated inputs, and exact command fixtures. Invoke the sealed Node executable with the sealed Prisma bin and `migrate status`; set `cwd` to the sealed repository root and make every path argument absolute beneath it. Build a fresh allowlisted child environment with both database URLs while clearing checkout/module/config fallback variables. Missing/unmanifested runtime input, resolution escape, seal failure, checkout read, or manifest mismatch stops before spawn. Parse only one recognized complete section and retain the established exit/content contract. Do not export a Production capability issuer or deploy subcommand; the Production wrapper owns its status spawn privately and reuses only pure parsing/validation helpers.

- [ ] **Step 4: Add RED tests for the cooperative Production wrapper**

Include both `scripts/admin-operations-attestation-store.mjs` (combined nonce/deployed-pending owner) and `scripts/admin-operations-evidence-store.mjs` (NO_OP/finalizer owner) in RED import/API coverage; missing either owner or the combined transition must fail.

Compile/import `scripts/admin-operations-production-activation.mjs` and the nonce-store owner without side effects. The store uses an operator-configured absolute state directory outside the checkout, repository, secret directory, and evidence output. It serializes transitions with an exclusive per-nonce owner lock created via `open(..., "wx")`; the lock contains the nonce, digest, run ID, and unpredictable ownership token, and only that open handle/owner may transition or release it. Represent state as monotonically numbered immutable same-directory generation records so Windows never needs an overwrite rename: write the next canonical record to an exclusively created temp file, `fsync` the file, close it, atomically rename it to a previously nonexistent generation name, then on POSIX `fsync` the parent directory before acknowledging the transition. Remove the owner lock only after durable acknowledgement and sync that directory removal on POSIX. On Windows, retry only documented sharing/access violations for a short bound while the same owner lock is held, never unlink a destination to make rename succeed, reopen and byte-verify the winning generation, and retain the lock/recovery marker on any ambiguous result. Because Node cannot durably fsync Windows directory metadata, local Windows final mode supports orderly/process-crash recovery only; power-loss/machine-loss recovery is fail-closed and requires operator Production-status reconciliation before automation can be re-enabled. A Production deploy needing stronger automatic recovery must use a supported external durable compare-and-swap store or run the filesystem store on POSIX. Existing, stale, malformed, torn, or ambiguously owned locks/records fail closed rather than being deleted or reused automatically.

Test recovery by injecting a crash at every file/rename/sync/lock-release boundary. Ignore and quarantine incomplete temp files without advancing state; reject malformed/torn generations, missing generation sequences, multiple highest generations, a state record without matching ownership evidence, or a missing state after an acknowledged transition. Prove `ISSUED`/`RESERVED` may resume only when the complete validated generation and owner rules allow it. Any ambiguous or recovered `DEPLOY_STARTED` remains non-reusable and requires manual Production-status reconciliation; `CONSUMED` is terminal even when stale earlier generations remain. Cover POSIX directory-sync ordering and the explicit Windows rename/sharing/reopen-verification behavior, including the Windows power-loss manual-reconciliation gate. Test two real child processes racing to reserve the same `ISSUED` nonce: exactly one reaches `RESERVED`, bound to its unpredictable run ID. Test duplicate issue, wrong digest/run ID, consumed, expired, and malformed records; safe `RESERVED -> ISSUED` release only by the owning run before deploy; atomic `RESERVED -> DEPLOY_STARTED`; no automatic release from `DEPLOY_STARTED`; and `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)` only after verified post-status, writing `CONSUMED` plus the full pending-final payload in the same generation. Crash tests assert recovery yields either the old `DEPLOY_STARTED` generation or that complete combined record.

With injected checkout inspector, attestation verifier, durable nonce store, connection factory, lock connection, trusted lookup, private Production status runner, authorization callback, and deploy runner, assert audit order is exactly `outer deadline/AbortSignal -> trusted_identity -> orphan_scan -> migration_status -> NO_OP/PENDING_SUFFIX decision`. The outer preflight bound exists before the first trusted lookup/network call, and each lookup, scan, connection, try-lock probe, and status receives only its remaining time. Independently hang each phase and prove timeout/cancellation returns by the outer deadline, quarantines/closes late results, emits no unhandled rejection, records no success, and calls no later phase or deploy. The connection-plus-lock clock remains an at-most-30-second nested bound. Audit `[]` records its completed no-deploy `UP_TO_DATE`/`NO_OP` status packet only after the passing scan and status, then unlocks/closes; it never calls rehearsal/final/deploy, and its checkpoint remains unfinalized pending the mode-specific smoke CAS. Separately assert final mode rejects `[]` and follows this exact nonempty-suffix order:

```text
create outer preflight deadline/AbortSignal -> derive attached clean checkout SHA -> verify fresh signed rehearsal attestation with nonempty suffix
-> atomically reserve the durable nonce to this unpredictable final run ID
-> create the at-most-30-second connection/lock sub-deadline inside the already-running outer bound -> race abort-aware connection plus bounded cancellation/close handshake -> poll target-scoped pg_try_advisory_lock with both clocks' remaining time
-> final trusted target/status -> compare attested target, checkout, and suffix
-> emit semantic fingerprint plus separate checkedAt
-> await distinct abort-aware fresh user Production authorization naming that fingerprint within deadline
-> re-fetch trusted target and status under the same lock
-> recompute and constant-time compare semantic fingerprint
-> re-derive clean checkout SHA and compare it to attestation and authorized fingerprint
-> immediately revalidate signature, expiry, target, checkout, suffix, every proof, branch absence, and nonce reservation ownership
-> atomically and durably mark the reserved nonce DEPLOY_STARTED immediately before spawning deploy once
-> post-deploy trusted status proves UP_TO_DATE and all four APPLIED under the same lock
-> call consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...) to write CONSUMED plus full pending-final payload in one durable generation after verified post-status
-> if any child is cancelled/times out, terminate and await its complete process tree
-> advisory unlock and close in finally only after every owned child/descendant has exited
-> separately owned exact-deployed-commit Production smoke runs only after unlock/close and completes final evidence
```

Assert the Production smoke owner cannot acquire, inherit, retain, delay release of, or execute under the migration advisory-lock connection. Deploy plus verified post-status calls `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)`, writing `CONSUMED` plus full pending-final payload in one durable generation before lock release. Final evidence remains partial until separate smoke passes.

Assert the audit lock is released before rehearsal begins and final mode opens a new dedicated connection and reacquires the lock. Inject a monotonic clock, cancellation-aware sleep, `AbortSignal`, deadlines, repository CLI resolver, and process-tree owner. Cover immediate acquisition, contention followed by acquisition, contention through the 30-second deadline, a hung try-lock probe, cancellation during lock polling, delayed authorization that succeeds within 10 minutes, authorization timeout, cancellation while awaiting authorization, and late authorization resolution after timeout. During final mode, that same connection remains open and owns the cooperative lock throughout. Reject missing/expired/reused/bad-signature attestations, empty suffix, incomplete proof sets, non-UP_TO_DATE rehearsal post-status, post-rehearsal branch presence, detached/dirty/unverifiable checkout, nonce/store mismatch, changed authorized inputs, deploy failure, or inconclusive post-status using the established fail-closed rules. Preserve process-tree-before-unlock/close/cleanup ordering and nonce ambiguity behavior.

Add exact RED/GREEN executable-closure tests in `tests/admin-operations-activation.test.mjs`. RED fails while the resolver copies only a bin or lacks an OS-enforced seal. GREEN builds a fresh snapshot and invokes the real repository-pinned tools with no `PATH` fallback:

Add six focused contract tables to the same suite: (1) real Prisma generation and a pinned-Next-compatible writable current-run build workspace under scratch, with verified source materialization, forced sealed dependency resolution, relative `next-build` output, manifesting/consumption, and rejection of input drift, dependency fallback, cross-run/path escape, stale sealed, or mutated output; (2) canonical smoke reference equality/CAS; (3) QA fixture-state/guards/browsers; (4) capture/teardown failures and safe cleanup; (5) distinct post-status; and (6) synchronous Client render. Each begins RED and reaches GREEN only through the named owner.

```text
DATABASE_URL=postgresql://validator:validator@127.0.0.1:1/validator DIRECT_URL=postgresql://validator:validator@127.0.0.1:1/validator <sealedRoot>/runtime/node <sealedRoot>/workspace/node_modules/prisma/build/index.js validate --schema <sealedRoot>/workspace/tests/fixtures/admin-operations-cli-snapshot/schema.prisma
ADMIN_OPERATIONS_PRISMA_GENERATE_OUTPUT=<scratchRoot>/prisma-generated <sealedRoot>/runtime/node <sealedRoot>/workspace/node_modules/prisma/build/index.js generate --schema <sealedRoot>/workspace/tests/fixtures/admin-operations-cli-snapshot/generate-schema.prisma
cwd=<scratchRoot>/next-project ADMIN_OPERATIONS_ACTIVATION_BUILD=1 ADMIN_OPERATIONS_RUN_ID=<runId> ADMIN_OPERATIONS_BUILD_WORKSPACE=<scratchRoot>/next-project ADMIN_OPERATIONS_BUILD_INPUT_MANIFEST=<inputManifestDigest> ADMIN_OPERATIONS_SEALED_DEPENDENCY_ROOT=<sealedRoot>/workspace/node_modules <sealedRoot>/runtime/node <sealedRoot>/workspace/node_modules/next/dist/bin/next build .
<sealedRoot>/runtime/node <sealedRoot>/workspace/node_modules/@playwright/test/cli.js test <sealedRoot>/workspace/tests/fixtures/admin-operations-cli-snapshot/playwright-smoke.spec.ts --config=<sealedRoot>/workspace/tests/fixtures/admin-operations-cli-snapshot/playwright.config.ts --project=desktop-chromium
<sealedRoot>/runtime/node <sealedRoot>/workspace/scripts/admin-operations-browser-acceptance.mjs
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs <commandName>
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs status
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs post-status
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs deploy
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs validate
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs generate
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs focused-tests
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs unit-tests
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs smoke
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs browser
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs typecheck
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs lint
<sealedRoot>/runtime/node <sealedRoot>/workspace/tests/fixtures/admin-operations-env-capture.mjs build
```

The validation fixture requires no database. For Next, the repository CLI creates `<scratchRoot>/next-project`, materializes only manifest-declared project inputs needed by pinned Next (source, public assets, package metadata, tsconfig, `next.config.mjs`, and validated current-run Prisma output) from sealed/validated sources, and records canonical path/size/mode/SHA plus run/commit/sealed-manifest bindings. At the ordinary `<scratchRoot>/next-project/node_modules` lookup position it installs one explicit read-only dependency projection: a POSIX read-only bind mount or Windows junction/adapter whose canonical target is exactly `<sealedRoot>/workspace/node_modules`. This is the sole allowlisted reparse/mount exception; target equality, seal/read-only state, and manifest digest are verified before and after build, and a local directory, nested reparse, or alternate target rejects. Thus pinned Next and application imports use standard project `node_modules` lookup while bytes remain forced to the sealed snapshot. The real sealed Next CLI runs with both `cwd` and directory `.` at the scratch project. The materialized config validates cwd/run/input bindings and chooses relative `distDir: "next-build"`, yielding `<scratchRoot>/next-project/next-build`; ordinary builds retain `.next`. Tests assert `require.resolve("next/package.json", { paths: [buildWorkspace] })` canonicalizes into the exact sealed dependency root, run the real pinned build, prove all outputs are under scratch and the sealed root is byte-identical, and reject copied-input drift, local dependency fallback, wrong projection/target, cross-run/path escape, stale artifacts, and mutated/unmanifested output.

Expose test hooks before Next spawn and output consumption. Deny the source mirror; real commands pass from verified materialized inputs plus the single read-only dependency projection. Mutate copied input, replace the projection with local `node_modules` or a wrong/nested target, redirect resolution, cross-run/path escape, or mutate output after manifesting, and require failure before use. Assert the sealed root remains byte-identical and unwritten.

- [ ] **Step 5: Implement the only approved Production path**

`ADMIN_OPERATIONS_ATTESTATION_STATE_DIR` is canonical and exists only in audit, rehearsal, final, and smoke child environments—never parent shell/runtime app. All four use one namespaced store. Test audit writes pending `NO_OP`, exits, then a fresh smoke process reloads/finalizes it; missing directory and namespace/binding mismatch fail.

Implement `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)` as the combined store's only verified-post-status transition. Crash-inject before temp write, after fsync, before rename, after rename, and during recovery; assert durable state is either old `DEPLOY_STARTED` or one combined `CONSUMED` plus full pending-final generation, never split. The evidence store cannot independently create deployed pending-final state.

The wrapper must require exact `audit` or `final` mode and obtain the direct URL and expected tuple only through its child-scoped environment input. Before its first Git/trusted/control-plane/network phase, it creates the outer monotonic preflight deadline and `AbortSignal`; every preflight owner receives only remaining time and must honor cancellation. It runs Git itself in the exact working directory used for Prisma: require attached HEAD, exact `git rev-parse HEAD`, and empty tracked/untracked status; caller-provided SHA values are comparison inputs only and can never establish checkout identity. Before the dedicated direct PostgreSQL connection, it starts the at-most-30-second connection/try-lock sub-deadline within the outer bound. The connector accepts the signal and exposes a cancellation/close handshake bounded by remaining time; a late driver, trusted lookup, orphan scan, or status result is handled only by a detached quarantine that consumes rejection or closes/destroys success and cannot reach lock/status/deploy or mutate completion. Only timely success polls `pg_try_advisory_lock` with both bounds. Set `lockAcquired = true` only from the successful database result. In `finally`, first require the process-tree owner to terminate/await every outstanding child and descendant; only after confirmed quiescence call `pg_advisory_unlock` when acquired, then close. Audit mode records evidence only after all bounded phases pass.

Final mode rejects an empty suffix. It first verifies the canonical HMAC signature, one-time nonce, issue/expiry window, complete proof hashes/outcomes, trusted Production/rehearsal identities, exact nonempty ordered suffix, complete UP_TO_DATE/all-four-APPLIED rehearsal post-status, and verified rehearsal cleanup/deletion in the short-lived attestation. It also rechecks trusted absence of that exact rehearsal branch, computes the canonical attestation digest, generates an unpredictable final `runId`, and atomically reserves the durable `ISSUED` nonce/digest to that run. Any mismatch, stale proof, unavailable/ambiguous store, existing reservation, or non-`ISSUED` state blocks final mode. After acquiring its new lock, final mode must run a new trusted target/status read and compare target, clean checkout SHA, and suffix to the attestation. While holding that lock, it emits the semantic fingerprint and status-owned freshness timestamp and invokes the authorization owner for a distinct fresh Production authorization with the fingerprint, an `AbortSignal`, and a 10-minute monotonic deadline. Race the callback against that deadline, signal cancellation to the owner, and permanently ignore any late resolution. Authorization must resolve affirmatively inside that bound and the status-owned `checkedAt` must remain no older than 10 minutes; denial, timeout, abort, or late resolution cannot authorize deploy. It then re-fetches opaque trusted target evidence and reruns complete status, recording the distinct locked-refetch check. Recompute the semantic fingerprint from the refreshed target, wrapper-derived checkout SHA, and ordered suffix; compare it to the authorization, attestation, and first final-mode fingerprint, recording a separate fingerprint-match check.

Immediately before spawn, repeat the full canonical HMAC verification and freshness check; re-fetch/compare trusted target and rehearsal-branch absence; re-derive clean checkout state/SHA; compare the exact nonempty suffix and every proof hash/outcome, including target-bound `parentDataSafety: PASS`, `inheritedDataSafety: PASS`, and `rehearsal_read_only_smoke: PASS`; and ask the durable store to prove the nonce/digest is still `RESERVED` by this exact run. Only after every last-moment check passes may the store durably transition this run's record to `DEPLOY_STARTED`, immediately followed by one child-scoped deploy through the verified repository CLI/process-tree owner. A safely classified failure before that transition releases this run's unexpired `RESERVED` record to `ISSUED`; a crash/ambiguous store result requires manual reconciliation. Once `DEPLOY_STARTED`, every spawn signal/nonzero/timeout, exception, cancellation, connection loss, or inconclusive/failed post-status leaves the record unchanged and blocks automated retry pending manual Production-status reconciliation. On cancellation/timeout the owner terminates and awaits the entire child tree before any lock release or connection close; inability to confirm exit keeps cleanup blocked. Only after deploy returns success and a complete UP_TO_DATE/all-four-APPLIED post-status passes may the store call `consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...)`, writing `CONSUMED` plus the full pending-final payload in the same generation before advisory unlock. Final evidence remains incomplete until a distinct exact-commit `production_read_only_smoke: PASS` CAS finalizes it. The lock is cooperative: every approved Production operator path uses this wrapper, and the docs must not imply it fences arbitrary external SQL clients.

- [ ] **Step 6: Add the named npm commands**

```json
"admin:operations:activation:status": "node scripts/admin-operations-activation.mjs status",
"admin:operations:activation:rehearsal": "node scripts/admin-operations-rehearsal.mjs",
"admin:operations:activation:production": "node scripts/admin-operations-production-activation.mjs",
"admin:operations:activation:smoke": "node scripts/admin-operations-production-smoke.mjs",
"admin:operations:browser-acceptance": "node scripts/admin-operations-browser-acceptance.mjs"
```

- [ ] **Step 7: Run tests and static validation**

```bash
node --test tests/admin-operations-activation.test.mjs
npm run typecheck
npm run lint
git diff --check
```

Expected: PASS, including real pinned Prisma/Playwright preserved-layout snapshot execution, dependency/TOCTOU tamper rejection, combined-generation crash/recovery, evidence-finalizer cases, and no secret-bearing output.

- [ ] **Step 8: Commit the preflight and Production wrapper**

```bash
git add scripts/admin-operations-activation.mjs scripts/admin-operations-production-activation.mjs scripts/admin-operations-production-smoke.mjs scripts/admin-operations-rehearsal.mjs scripts/admin-operations-attestation-store.mjs scripts/admin-operations-evidence-store.mjs scripts/admin-operations-repository-cli.mjs scripts/admin-operations-browser-acceptance.mjs next.config.mjs package.json tests/admin-operations-activation.test.mjs tests/fixtures/admin-operations-env-capture.mjs tests/fixtures/admin-operations-cli-snapshot/schema.prisma tests/fixtures/admin-operations-cli-snapshot/generate-schema.prisma tests/fixtures/admin-operations-cli-snapshot/playwright.config.ts tests/fixtures/admin-operations-cli-snapshot/playwright-smoke.spec.ts
git commit -m "feat: add locked admin migration activation"
```

### Task 3: Strengthen disposable browser-database identity

**Files:**
- Modify: `lib/admin/neon-control-plane.ts`
- Modify: `lib/admin/browser-qa-authorization.ts`
- Modify: `lib/admin/browser-fixture-provisioning.ts`
- Modify: `lib/admin/browser-fixture-cleanup.ts`
- Modify: `lib/admin/browser-billing-goodwill-preview.ts`
- Modify: `app/admin/users/[userId]/page.tsx`
- Modify: `app/admin/users/[userId]/billing-actions.ts`
- Modify: `tests/admin-user-operations-fixture.test.mjs`
- Modify: `tests/admin-billing-goodwill-ui.test.mjs`
- Modify: `tests/admin-security-ui.test.mjs`
- Modify: `tests/browser/admin-user-operations-fixture.ts`
- Modify: `tests/browser/admin-user-operations.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/browser-qa-harness.test.mjs`

**Interfaces:**
- Requires `MASSAGELAB_BROWSER_QA_DATABASE=1`.
- Requires operator-expected `MASSAGELAB_BROWSER_QA_NEON_PROJECT_ID`, `MASSAGELAB_BROWSER_QA_NEON_BRANCH_ID`, `MASSAGELAB_BROWSER_QA_NEON_DATABASE_NAME`, and `MASSAGELAB_BROWSER_QA_NEON_DIRECT_HOSTNAME`.
- Independently loads the authoritative project ID, branch ID, database name, direct hostname, and QA-prefixed branch name through the server-only authenticated Neon control-plane owner. All expected fields and the direct database URL must match that returned binding; no environment tuple or URL-derived tuple can substitute for the lookup.
- Requires trusted branch name prefix `admin-operations-qa-` and denies Vercel Production.

- [ ] **Step 1: Add RED authorization tests**

Replace the URL-plus-boolean/operator-pair expectation with exact trusted-binding cases. Assert mutation remains denied when any expected field is missing, any trusted field differs, the authenticated lookup is unavailable/errors, the trusted branch name lacks the prefix, or `VERCEL_ENV=production`. Include a regression where fabricated project/branch/database/direct-host environment values all match each other and the connection URL: authorization must still fail because no independently fetched trusted binding exists. Include one success case only when the awaited control-plane result independently matches all four fields and the parsed direct URL. Add explicit Promise-truthiness regressions: passing or branching on the unresolved Promise returned by either async helper must never authorize, construct the preview adapter, open a transaction, or call the first create/delete mutation.

- [ ] **Step 2: Run fixture tests and verify RED**

Run: `node --test tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs`

Expected: FAIL because the current guard accepts only URL plus opt-in.

- [ ] **Step 3: Await trusted identity, then reuse the pure activation validator**

Make both browser-QA authorization helpers async. They first call the server-only authenticated Neon owner with only the project/branch selector, then pass its opaque evidence plus the independently supplied expected tuple and parsed direct URL to `validateDisposableAdminQaIdentity`. The validator verifies the module-private evidence brand before unwrapping the sanitized binding. The boolean helper catches lookup/evidence/validation errors and returns false; the throwing helper keeps a static safe message. Never fall back to expected environment fields when the lookup fails or accept a structurally matching plain object.

Update and test every caller explicitly: `createBrowserAdminFixtureRecords` in `lib/admin/browser-fixture-provisioning.ts`, `removeBrowserAdminFixtureRecords` in `lib/admin/browser-fixture-cleanup.ts`, `installAdminUserOperationsFixture` and `removeBrowserAdminFixture` in `tests/browser/admin-user-operations-fixture.ts`, the configured-QA gate and hooks in `tests/browser/admin-user-operations.spec.ts`, `browserBillingGoodwillPreviewClient` and `isBrowserBillingGoodwillMutationBlocked` in `lib/admin/browser-billing-goodwill-preview.ts`, their detail-page and billing-action callers in `app/admin/users/[userId]/page.tsx` and `app/admin/users/[userId]/billing-actions.ts`, and all doubles/assertions in `tests/admin-user-operations-fixture.test.mjs`, `tests/admin-billing-goodwill-ui.test.mjs`, `tests/admin-security-ui.test.mjs`, and `tests/browser-qa-harness.test.mjs`. Every caller must `await` authorization before its first transaction, create/delete call, Stripe-preview adapter construction, or mutation-guard decision. No `if (hasBrowserAdminFixtureQaAuthorization(...))`-style Promise truthiness is allowed.

- [ ] **Step 4: Require exact desktop and mobile projects**

In the browser spec, assert the project name is one of the configured Admin projects before provisioning. Update `playwright.config.ts` so the documented command selects both Chromium viewports and always disables server reuse for any invocation that can select the Admin spec.

- [ ] **Step 5: Preserve SMTP and billing mutation guards**

Keep the Playwright-owned server requirement, blank SMTP environment, presentation-only billing client, server-action QA guard, zero form submissions, and zero matching POST requests. Add source-contract assertions that these remain active with the new four-field expected tuple, awaited trusted lookup, no operator-value fallback, and no unresolved-Promise authorization path.

- [ ] **Step 6: Run focused browser harness tests and verify GREEN**

```bash
node --test tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs tests/admin-billing-goodwill-ui.test.mjs tests/admin-security-ui.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit the identity guard**

```bash
git add lib/admin/neon-control-plane.ts lib/admin/browser-qa-authorization.ts lib/admin/browser-fixture-provisioning.ts lib/admin/browser-fixture-cleanup.ts lib/admin/browser-billing-goodwill-preview.ts app/admin/users/[userId]/page.tsx app/admin/users/[userId]/billing-actions.ts tests/admin-user-operations-fixture.test.mjs tests/admin-billing-goodwill-ui.test.mjs tests/admin-security-ui.test.mjs tests/browser/admin-user-operations-fixture.ts tests/browser/admin-user-operations.spec.ts playwright.config.ts tests/browser-qa-harness.test.mjs
git commit -m "fix: bind admin browser QA to disposable database identity"
```

### Task 4: Write the exact activation runbook and evidence packet

**Files:**
- Modify: `docs/wiki/deployment.md`
- Modify: `docs/wiki/release-checklist.md`
- Modify: `docs/wiki/admin-user-operations.md`
- Create: `docs/aegis/work/2026-08-11-admin-operations-production-activation/10-intent.md`
- Create: `docs/aegis/work/2026-08-11-admin-operations-production-activation/20-checkpoint.md`
- Create: `docs/aegis/work/2026-08-11-admin-operations-production-activation/90-evidence.md`

**Interfaces:**
- Consumes: exact four-name inventory and sanitized status output.
- Produces: an executable operator sequence with explicit stop gates.

- [ ] **Step 1: Document the read-only Production audit**

Specify that the operator obtains the Production direct connection through the approved secret channel and, in a separate fresh lookup through the authenticated Neon console or approved API, records the sanitized project ID, branch ID, database name, and direct endpoint hostname. Copying identity fields out of the connection string is not proof. Production audit and deploy both use the one activation wrapper; do not run the standalone status or Prisma deploy command against Production. Invoke the wrapper through the approved environment runner so its activation variables exist only for that child command and the parent shell/runtime app never receives `DATABASE_URL` or `DIRECT_URL`:

```powershell
# Pseudocode: the approved secret runner injects these into this command only.
Invoke-WithScopedEnvironment -Environment $productionActivationEnvironment -Command {
  npm run admin:operations:activation:production -- audit
}
```

Audit-only mode obtains its cooperative session advisory lock through the bounded try-lock contract, performs one preliminary trusted status, serializes the exact allowlisted evidence schema, and releases the lock only if acquired. It has no authorization or deploy capability, and its evidence cannot authorize final mode. If the suffix is empty, record a completed no-deploy `UP_TO_DATE`/`NO_OP` audit status packet and end the deploy activation path; the activation/checkpoint remains unfinalized until read-only smoke creates its allowlisted proof and wins the bound versioned CAS. Do not create a rehearsal, attestation, final invocation, authorization request, or deploy attempt. Only a nonempty contiguous terminal suffix enters rehearsal and later final mode. The document must instruct the operator not to paste secret values into evidence and to stop unless target binding is exact and the pending set is `[]` or one contiguous terminal suffix.

- [ ] **Step 2: Document disposable Neon rehearsal**

Before creating anything on every fresh or resumed run, query the trusted control plane for branches whose names start with `admin-operations-migration-rehearsal-` or `admin-operations-qa-`. Every match is an alert and blocks resume until trusted absence is proven. Auto-delete only when trusted metadata matches the verified run owner and lease and explicit stale/expired-lease proof shows that run cannot still be active. When ownership, lease, or staleness is missing or ambiguous, require operator-reviewed cleanup; never infer ownership from the name prefix or silently create another disposable branch alongside it. This startup gate is mandatory because a hard kill, machine loss, or power failure can bypass in-process cleanup. Then, before branch creation, obtain trusted parent-data-safety evidence: the exact rehearsal parent must pass the documented no-PHI compliance proof, while the exact QA parent must be verified data-free or approved-sanitized. Synthetic fixture loading is never a substitute. Fail closed on missing, stale, ambiguous, or row-revealing evidence.

Use the Neon console/approved API to create a branch named `admin-operations-migration-rehearsal-YYYYMMDD-HHMMSS-<runSuffix>`, where `runSuffix` is at least 128 bits from `crypto.randomBytes` encoded as lowercase hex/base64url. Before creation, check the exact candidate against the trusted control plane; on collision generate a new suffix and retry a small bounded number of times, then fail closed. Bind the exact branch name, random run ID/suffix, and returned branch ID to the verified owner lease and later attestation; a timestamp or prefix alone never proves ownership. Follow Neon's official [branching workflow](https://neon.com/docs/introduction/branching) and use the direct connection described by the official [connection guidance](https://neon.com/docs/connect/connection-errors). Fetch the new project/branch/database/direct-host binding back from the trusted control plane. Immediately verify inherited rows are absent or conform to the approved sanitization policy. This verification runs before status, migration deploy, validation/generation, tests, or smoke. Its allowlisted evidence contains no rows, values, PHI, connection material, or secrets; ambiguity triggers deletion/absence verification and stops the run. The rehearsal owner independently derives attached HEAD, exact clean checkout SHA, and empty worktree status from the checkout it will use, and binds those values plus the trusted Production target and audited ordered pending suffix to the run. Wrap all work after creation in `try/finally`; on cancellation/timeout terminate and boundedly await the owned process tree, skip unsafe row/scratch cleanup if full exit is unconfirmed, and independently use the immutable receipt/lease to attempt exact Neon branch deletion plus trusted absence verification regardless. Do not represent `finally` as protection from hard termination.

Invoke the rehearsal owner through the secret runner. It resolves the pinned CLI and builds a separate empty-base allowlisted environment per command. Status/deploy receive the rehearsal direct URL only when required. Validate receives only the fixed nonsecret `postgresql://validator:validator@127.0.0.1:1/validator` value in both URL keys and must not resolve DNS or connect; generate/typecheck/lint/build receive no database credential. A focused/unit/smoke child receives one only when an executable test proves database I/O. Exact env-capture and denylist tests cover every child; the parent stays clean. No PATH fallback, `npx`, or downloads.

```powershell
Invoke-WithScopedEnvironment -Environment $rehearsalEnvironment -Command {
  npm run admin:operations:activation:rehearsal
}
```

Capture the second status only as `rehearsal_post_status`; it must be one complete `UP_TO_DATE` result containing the exact four expected migrations, each `APPLIED`, and any generic alias, pending, missing, duplicate, additional, truncated, or contradictory result blocks attestation. Record canonical hashes in the canonical rehearsal evidence sequence stated below, without grouped aliases or omitted checks. The separate canonical `rehearsal_read_only_smoke` envelope binds its mandatory `PASS`, sanitized result, exact rehearsal target, checkout SHA, and audited suffix. Legacy smoke or post-status aliases reject. On timeout/cancellation, terminate and boundedly await the owned process tree. If any descendant exit is unconfirmed, record a blocking failure, retain fail-closed Production lock semantics where applicable, and skip unsafe fixture-row/scratch cleanup; nevertheless, the same `finally` owner must boundedly attempt deletion of the exact rehearsal branch from its immutable receipt/lease and then trusted absence verification. Failure or ambiguity in either control-plane step is separately blocking. The next run's mandatory startup orphan check covers cleanup that a hard termination bypassed.

Only after the `finally` cleanup completes and a new trusted-control-plane lookup proves the exact rehearsal branch absent may the rehearsal owner issue an attestation for the audited nonempty suffix. Canonically serialize and HMAC-sign the trusted Production target, exact clean checkout SHA, audited ordered pending suffix, trusted rehearsal binding, exact timestamp-plus-random branch name/run ID, all proof hashes/outcomes in exact execution order for status, deploy, post-status, validate, generate, focused tests, typecheck, lint, full tests, build, `parentDataSafety: PASS`, `inheritedDataSafety: PASS`, `rehearsal_read_only_smoke: PASS`, cleanup, and branch deletion, complete four-APPLIED post-status, issuance time, expiry, and unique nonce. Before returning the attestation, compute its canonical digest and ask the durable nonce-store owner to atomically create the nonce record in `ISSUED`; an existing nonce, store/lock ambiguity, or durability failure invalidates issuance. The attestation expires no later than 30 minutes after verified deletion; it is not extendable or refreshable without rerunning the complete rehearsal. The signing key exists only in the rehearsal/final child environment and neither it nor the signature is committed to evidence. A failed/missing proof, changed proof bytes, smoke proof for another target/checkout/suffix, branch reappearance, target/checkout/suffix change, expiry, bad signature, or non-`ISSUED` nonce invalidates the attestation and requires a fresh rehearsal or manual reconciliation according to the durable state.

- [ ] **Step 3: Document the authorized Production deploy gate**

Before attestation issuance the rehearsal owner records the distinct `rehearsal_post_status` immediately after `migration_deploy`; it is a complete `UP_TO_DATE` four-`APPLIED` envelope bound to rehearsal target/commit/run. The signed proof map, validator, final pre-spawn check, acceptance evidence, and runbook all use that exact name; generic `postStatus` and substitution by any other status check reject.

The rehearsal executable must run the canonical rehearsal evidence sequence exactly as `trusted_identity -> orphan_scan -> parent_data_safety -> inherited_data_safety -> migration_status -> migration_deploy -> rehearsal_post_status -> prisma_validate -> prisma_generate -> focused_tests -> typecheck -> lint -> unit_tests -> build -> rehearsal_read_only_smoke -> scratch_cleanup -> branch_deleted`. Confirm full tree exit before `scratch_cleanup`; that operational boundary does not add a matrix check. The attestation's canonical signed/verified proof map includes every exact proof in that sequence. Missing, non-`PASS`, or byte-mutated hashes fail signing/verification and final pre-spawn validation. A failed scratch proof is retained in attempt evidence and blocks attestation without suppressing branch cleanup. Tests assert exact order, failure truthfulness, and mutation rejection, and Task 2 validation/staging covers the rehearsal owner and activation test file.

After rehearsal and its cleanup/absence gate complete, invoke `npm run admin:operations:activation:production -- final` through the same explicit child-environment wrapper and supply the still-fresh authenticated attestation for the nonempty suffix through the approved non-committed channel. Before final mode performs any checkout inspection, attestation/nonce work, trusted lookup, orphan/branch-absence scan, status, connection, or other network/control-plane phase, it starts one outer monotonic deadline and `AbortSignal`; every phase consumes only remaining outer time and quarantines late results. Within that already-running bound, final mode rejects an empty suffix or invalid attestation, derives the attached clean checkout SHA and cleanliness from the exact Prisma working directory, compares them to the attestation, and atomically reserves the durable nonce to its unpredictable run ID. Immediately before connection creation it starts the nested at-most-30-second connection/try-lock bound, capped by remaining outer time; connection and polling consume both bounds. It does not reuse audit mode's lock, status, fingerprint, or `checkedAt`. Under the new lock it performs bounded fresh final trusted status, compares target/SHA/suffix to the attestation, emits the semantic fingerprint plus status-owned freshness timestamp, and awaits distinct abort-aware Production authorization for at most 10 minutes and remaining outer time. After authorization it boundedly re-fetches target/status, records locked-refetch and fingerprint-match checks, then immediately before spawn repeats signature/expiry, target, checkout, suffix, every proof, branch absence, and nonce-reservation validation under the same outer bound. Only then may the nonce owner mark `DEPLOY_STARTED` and spawn one child-scoped deploy. Complete `UP_TO_DATE` all-four-`APPLIED` post-status is required before the combined `CONSUMED` plus pending-final transition. Safe pre-start failures release only the owning unexpired reservation; post-start ambiguity blocks automation. Unlock only if acquired and always close in `finally`; there is no manual Production deploy fallback.

- [ ] **Step 4: Document read-only Production smoke**

The smoke owner creates one opaque digest-addressed envelope and inserts its exact serialized reference both into the canonical smoke check and `smokeProofRef`; it never creates a second proof. CAS requires byte equality and recomputed digest/bindings. Tests reject either-side mutation, duplicate mode smoke checks, alternate references, replay, cross-mode/target/commit/run use, and concurrent reuse.

On the exact deployed commit, verify the Admin/Reviewer/Editor/ordinary-user role matrix and account/detail/dashboard projections without invoking any mutation. Keep live goodwill disabled. Create the allowlisted smoke proof, then atomically CAS-finalize the expected partial evidence version/digest and mode-specific bindings; record this only as canonical `production_read_only_smoke`; it is distinct from, and cannot be satisfied by, `rehearsal_read_only_smoke`. Final deployed evidence is incomplete until it passes. The deployed-final CAS requires the Production post-status digest plus run/nonce/attestation. The audit `NO_OP` CAS instead requires its audit-status digest and rejects run/nonce/attestation/Production-post-status fields; use its explicit `smokeProofRef` and versioned CAS, never vague linkage.

- [ ] **Step 5: Document disposable browser acceptance and teardown**

The canonical QA evidence sequence is `parent_trusted_identity -> orphan_scan -> parent_data_safety -> receipt_lease_capture -> qa_trusted_identity -> inherited_data_safety -> migration_status -> migration_deploy -> qa_post_status -> fixture_provenance -> fixture_state -> smtp_isolation -> billing_mutation_guard_armed -> server_ownership -> qa_sentinel -> browser_desktop -> browser_mobile -> billing_zero_mutation -> scratch_cleanup -> fixture_cleanup -> branch_deleted`. Fixture load occurs between provenance and state, confirmed process-tree exit precedes scratch cleanup, and trusted absence completes branch deletion without creating extra check names. Capture authority binds parent/child targets, immutable receipt, lease, run, and creation order. Server ownership binds its stable digest plus launch/process tree and validated build manifest; sentinel binds that live server to QA target/run. Both browsers bind the same renewed receipt-verification ref and identical fixture-state, SMTP-isolation, billing-guard, server-ownership, and sentinel proof refs/digests.

Browser work follows the corresponding contiguous portion of the canonical QA evidence sequence above; fixture load, confirmed process-tree exit, and trusted absence retain their stated operational boundaries without becoming extra or aliased checks. After `server_ownership` and `qa_sentinel`, obtain the renewed receipt-verification ref immediately before `browser_desktop`. Both browsers share it byte-identically and bind identical fixture-state, SMTP-isolation, billing-guard, server-ownership, and sentinel refs/digests; no omission/substitution is allowed.

Execute QA in the authoritative order. After passing provenance, load fixtures, compute/verify `fixture_state`, then establish SMTP and billing guards before server/browser proofs. Both browser proofs bind byte-identical refs/digests for receipt capture, fixture state, SMTP isolation, armed billing guard, server ownership, and QA sentinel. Fixture-row cleanup runs only after positively confirmed full process-tree exit/safety; otherwise record it truthfully as `SKIPPED`/`BLOCKED` without row mutation. Missing receipt/lease capture authorizes neither cleanup nor deletion. Once capture succeeds, exact branch deletion and trusted absence remain unconditional after every failure; fixture-cleanup failure cannot suppress them and deletion failure cannot suppress absence. Every failure/throw/timeout blocks acceptance. Never reuse rehearsal; proofs expose no rows, PHI, or secrets. Invoke the pinned owner:

```bash
npm run admin:operations:browser-acceptance
```

This outer npm command is a bootstrap only: it verifies clean source identity and constructs/seals source/dependency/config inputs. It has no capability against source-checkout paths. Operational children use sealed executables/config/specs plus only validated current-run Prisma/build scratch manifests; no other path is runtime authority.

The browser owner uses sealed dependencies/config plus a verified manifest-declared copy of required project inputs in a writable current-run scratch build workspace. Real pinned Next runs there with relative `next-build`; guarded dependency resolution stays sealed, and the validated output manifest feeds typecheck, server/runtime, and both browsers. One outer owner then applies the established safe cleanup rules.

The full-acceptance test executes real pinned Next from the writable scratch project, proves relative `next-build` resolves beneath scratch with no sealed write, and proves standard `node_modules` lookup canonicalizes through the sole read-only projection to sealed dependencies. It rejects copied-input drift, local/wrong dependency fallback, cross-run/path escape, stale or mutated output. Its teardown assertions remain unchanged.

- [ ] **Step 6: Commit the runbook**

```bash
git add docs/wiki/deployment.md docs/wiki/release-checklist.md docs/wiki/admin-user-operations.md docs/aegis/work/2026-08-11-admin-operations-production-activation
git commit -m "docs: define admin operations production activation"
```

### Task 5: Validate code, merge the branch, then execute activation

**Files:**
- Modify after execution: `docs/project-state.md`
- Modify after execution: `docs/project-log.md`
- Modify after execution: `docs/aegis/work/2026-08-11-admin-operations-production-activation/20-checkpoint.md`
- Modify after execution: `docs/aegis/work/2026-08-11-admin-operations-production-activation/90-evidence.md`

**Interfaces:**
- Consumes: merged Branches 1 and 2 plus user authorization for migration deployment when behind.
- Produces: sanitized exact activation evidence.

- [ ] **Step 1: Run pre-PR validation**

```bash
node --test tests/admin-operations-activation.test.mjs tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs tests/admin-billing-goodwill-ui.test.mjs
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Run the database-aware static commands in separate children. `$databaseBlankValidationEnvironment` starts empty, adds only the minimum platform bootstrap, run/scratch/input-manifest keys, and the same fixed nonsecret syntactically valid `postgresql://validator:validator@127.0.0.1:1/validator` value for both `DATABASE_URL` and `DIRECT_URL`; it contains no target binding or real database bytes and validate is guarded against DNS/connection/network I/O. `$databaseBlankGenerationEnvironment` starts empty with only bootstrap/run/scratch/input/output-manifest keys and no database URL or activation variables:

```powershell
Invoke-WithScopedEnvironment -Environment $databaseBlankValidationEnvironment -Command { npm run prisma:validate }
Invoke-WithScopedEnvironment -Environment $databaseBlankGenerationEnvironment -Command { npm run prisma:generate }
```

Expected: all pass with the single intentional unit-test skip and 104-page build.

- [ ] **Step 2: Complete reviews and the PR loop**

Obtain spec, security/operations, and quality review. Push/open PR, wait for hosted checks and a fresh CodeRabbit review, resolve valid findings, and stop at the user merge gate.

- [ ] **Step 3: Refresh exact merged main before external work**

After user merge approval, create a clean activation worktree from refreshed `origin/main`. Record its commit. Do not run operational commands from a dirty checkout.

- [ ] **Step 4: Execute the read-only Production audit**

Fetch the fresh trusted project/branch/database binding, then invoke only `npm run admin:operations:activation:production -- audit` through its explicit child environment. Audit-only mode uses the bounded cancellation-aware try-lock contract, records trusted identity, performs the blocking orphan scan, and only then runs status, records the exact allowlisted evidence schema, unlocks only if acquired, and always closes; it cannot request authorization or deploy. Its fingerprint and `checkedAt` cannot authorize final mode. Only after the orphan scan passes, if all four migrations are applied, record a completed no-deploy `UP_TO_DATE`/`NO_OP` audit status packet and end the deploy activation path without rehearsal/attestation/final/authorization/deploy. The activation/checkpoint remains unfinalized until Step 7 creates the allowlisted smoke proof and CAS-finalizes that exact audit version/digest and bindings. If one nonempty contiguous terminal suffix is pending, continue to the disposable rehearsal. Otherwise stop and ask the user for direction.

- [ ] **Step 5: Rehearse on the disposable clone**

First perform the blocking trusted-control-plane prefix scan. Treat every match as an alert; auto-delete only with verified matching owner/lease and explicit stale proof, otherwise require operator cleanup, and do not resume until absence is proven. Before branch creation, obtain trusted proof that the exact rehearsal parent passes the no-PHI compliance gate. Create and identify the rehearsal branch only after that proof passes; immediately after creation, independently prove inherited rows absent or approved-sanitized before any status or mutation. Then execute the canonical rehearsal evidence sequence exactly as `trusted_identity -> orphan_scan -> parent_data_safety -> inherited_data_safety -> migration_status -> migration_deploy -> rehearsal_post_status -> prisma_validate -> prisma_generate -> focused_tests -> typecheck -> lint -> unit_tests -> build -> rehearsal_read_only_smoke -> scratch_cleanup -> branch_deleted`; the named rehearsal post-status must be complete four-`APPLIED` `UP_TO_DATE` and non-substitutable. Record every canonical proof in order inside `try/finally`; `scratch_cleanup: FAIL` blocks attestation but branch deletion/absence still runs. Only after both cleanup proofs pass may the rehearsal owner sign the maximum-30-minute attestation. A later resume repeats the scan because hard termination may have bypassed `finally`. Complete every rehearsal and cleanup/absence gate before starting the final Production wrapper; no Production advisory lock is held during rehearsal.

- [ ] **Step 6: Deploy the exact terminal pending suffix when needed**

Only after rehearsal and verified disposable cleanup succeed, invoke `npm run admin:operations:activation:production -- final` through its explicit child environment with the still-fresh authenticated rehearsal attestation for a nonempty suffix. The wrapper first starts the outer monotonic deadline and `AbortSignal`, before any checkout inspection, attestation validation/digest, nonce reservation, trusted target lookup, rehearsal-absence lookup, orphan scan, status, connection, or other network/control-plane work. Every such phase receives only remaining outer time; timeout/cancellation quarantines late results and stops before deploy. Within that outer bound, final mode derives the SHA from its exact working checkout, requires attached HEAD and empty status, validates the attestation and all-four-`APPLIED` rehearsal proof, boundedly verifies current rehearsal-branch absence, computes the digest, and reserves the durable `ISSUED` nonce. Immediately before connection it creates the nested at-most-30-second connection/try-lock bound capped by remaining outer time, then connects and polls using both bounds. Under the acquired lock it performs bounded fresh target lookup and complete final status, derives the semantic fingerprint and status-owned `checkedAt`, and never reuses audit evidence or refreshes `checkedAt` without status. Separate abort-aware Production authorization is capped by 10 minutes, status freshness, and remaining outer time. The locked refetch, fingerprint comparison, and immediate pre-spawn signature/expiry/target/rehearsal-absence/checkout/suffix/proof/reservation checks all remain under that same outer bound. Only then may it mark `DEPLOY_STARTED` and spawn at most one child-scoped deploy. Successful deploy plus complete `UP_TO_DATE` all-four-`APPLIED` post-status permits the combined consumed/pending-final transition; exact-commit smoke still finalizes later. Safe pre-start failure releases only this run's unexpired reservation, while post-start ambiguity blocks automation. Stop on unexpected output; unlock only if acquired, always close in `finally`, and never release the lock for manual deploy or SQL repair.

- [ ] **Step 7: Run Production read-only smoke**

Flow-order tests observe `production_post_status -> consumeAfterVerifiedDeployAndWritePendingSmokeFinalization(...) -> advisory unlock/close -> smoke`; no standalone consume API or transition is permitted.

Invoke `npm run admin:operations:activation:smoke` through a child-scoped environment containing the approved state directory and trusted target inputs. This executable loads the durable pending `NO_OP` or deployed record after process exit/reload, verifies exact clean deployed commit, target, fingerprint, and mode-specific audit-status or Production-post-status/run/nonce/attestation binding, runs only allowlisted read-only smoke, creates the runtime-opaque proof, and CAS-finalizes. It has no migration lock/connection, status, deploy, or mutation capability. RED/GREEN and source tests prove it cannot acquire/inherit the advisory lock or call deploy; missing state, mismatch, replay, and concurrent finalization fail, while one cross-process reload succeeds.

Verify the exact commit, role matrix, and safe projections, then create the allowlisted smoke proof. Branch the CAS by mode: `NO_OP` binds the prior audit version/digest, commit, target, fingerprint, audit-status digest, and smoke proof, and requires run/nonce/attestation/Production-post-status fields to be null or absent; deployed final binds the partial-final version/digest, commit, target, fingerprint, Production post-status digest, run, nonce, attestation, and smoke proof. Persist `finalizedFrom` and `smokeProofRef`; a missing/mismatched binding, any prohibited `NO_OP` deployment field, replay, or concurrent finalizer fails. Record no account-level values.

- [ ] **Step 8: Run disposable desktop/mobile browser acceptance**

Follow the canonical QA evidence sequence above byte-for-byte. Fixture load, confirmed process-tree exit, receipt-authorized deletion, and trusted absence retain their stated operational positions and semantics without changing `fixture_state`, `scratch_cleanup`, or `branch_deleted` into aliases. Both browsers bind the same renewed receipt-verification ref and identical fixture-state/SMTP-isolation/billing-guard/server-ownership/sentinel proofs.

Await the parent binding and require atomic branch creation plus immutable receipt/lease capture before any child database work. Capture failure fails closed with no unauthorized row cleanup/deletion. After deploy/status and provenance, load fixtures and record sanitized `fixture_state`; then SMTP and billing guards precede distinct desktop/mobile proofs binding its same digest. Any later failure still enters independent authorized teardown.

After another blocking prefix scan, prove the exact QA parent data-free or approved-sanitized, create a fresh branch distinct from rehearsal, and seal its immutable receipt/lease. Immediately prove inherited safety before status or mutation. Then follow the authoritative sequence above inside `try/finally`. Missing or invalid provenance/guards prevents browser work. Confirmed tree exit permits `scratch_cleanup` and fixture-row cleanup; if exit is unconfirmed, record their blocked/skipped outcomes instead. In either case, independently and boundedly delete the exact branch using the receipt/lease and block until trusted absence is proven. Scratch failure remains truthful failed attempt evidence, while cleanup/absence outcomes are recorded separately. A resumed run repeats the prefix scan because hard termination may have bypassed teardown.

- [ ] **Step 9: Commit sanitized evidence**

```bash
git add docs/project-state.md docs/project-log.md docs/aegis/work/2026-08-11-admin-operations-production-activation/20-checkpoint.md docs/aegis/work/2026-08-11-admin-operations-production-activation/90-evidence.md
git commit -m "docs: record admin operations activation evidence"
```

Open a documentation-only PR for the executed evidence if the implementation PR is already merged; complete hosted checks and stop at the user merge gate.
