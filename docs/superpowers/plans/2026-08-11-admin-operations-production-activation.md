# Admin Operations Production Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the four Admin-era migrations on a disposable Neon clone, deploy only an exact contiguous terminal pending suffix to Production when necessary, and complete read-only Production smoke plus desktop/mobile disposable browser acceptance.

**Architecture:** Add a small fail-closed activation contract that statefully parses complete Prisma migration-status sections, accepts only an empty pending set or a contiguous terminal suffix of the expected inventory, and binds the direct connection to a project/branch/database identity obtained independently from the trusted Neon control plane. A single two-mode Production activation wrapper is the only approved Production status/deploy path; the standalone status entry point is rehearsal-only and rejects Production before spawning Prisma. Audit-only mode obtains the cooperative session advisory lock through bounded cancellation-aware try-lock polling, runs one preliminary trusted status, records allowlist-only sanitized evidence, and releases the lock without authorization or deploy capability. A completed rehearsal produces a short-lived authenticated attestation bound to the trusted Production target, exact clean checkout, ordered pending suffix, rehearsal identity, proof hashes/outcomes, complete post-deploy status, and verified deletion. Final mode requires that attestation, obtains a new lock with the same bound, and holds it from a fresh final trusted status through a distinct bounded user authorization, target/status refetch, semantic-fingerprint comparison, deploy, and post-status. Use existing Playwright fixture owners for browser acceptance and an explicit disposable-database identity token so the mutation sentinel cannot be enabled from a connection string alone.

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
- An empty Production pending set is terminal: audit records `UP_TO_DATE`/`NO_OP` and activation ends without rehearsal, attestation issuance, final mode, authorization, or deploy. Rehearsal attestations and final mode require a nonempty contiguous terminal suffix.
- Migration deployment is authorized only after identity, pending-set, and disposable rehearsal gates pass.
- Stop for any non-terminal pending subset, ambiguous database identity, failed rehearsal, connection-role mismatch, or changed Production pending set.
- A Production deploy requires both a fresh authenticated rehearsal attestation and a separate fresh user authorization naming a sanitized semantic fingerprint produced only from the trusted project/branch/database/direct-host binding, exact clean checkout commit, and exact ordered pending suffix. Keep `checkedAt` and attestation expiry as separate freshness evidence; do not hash volatile timestamps into the semantic fingerprint. An attestation or authorization for another target, checkout, suffix, fingerprint, rehearsal branch, proof set, or freshness window does not carry forward.
- `npm run admin:operations:activation:production -- audit` and `npm run admin:operations:activation:production -- final` are the only approved Production status/deploy invocations. Both use 250 ms `pg_try_advisory_lock` polling with a 30-second monotonic acquisition deadline and cancellation. Audit mode locks only for its preliminary trusted status and sanitized audit record, then unlocks and cannot authorize or deploy. Final mode starts only with a valid short-lived rehearsal attestation, acquires a new target-scoped session advisory lock, derives and verifies the clean attached checkout SHA itself, and performs a fresh final status, separate user authorization bounded to 10 minutes, target/status refetch, semantic-fingerprint comparison, at most one deploy, and post-status before releasing the lock.
- Every status, deploy, validate, and generate command receives database variables through an explicit child-environment wrapper for that one process. Never set or reuse `DATABASE_URL`, `DIRECT_URL`, or activation database variables in the parent shell.
- Every Prisma and Playwright invocation resolves the repository-local package binary from this checkout's `node_modules` and verifies its installed version against the exact `package-lock.json` entry before spawn. Execute the resolved JavaScript CLI with `process.execPath`/`execFile`, `shell: false`, an exact argument array, and a newly constructed allowlisted child environment. Never use `npx`, package download, a global executable, or a `PATH` fallback; a missing local package/bin, missing lock entry, version mismatch, unexpected bin target, or malicious `PATH` must fail before any database connection, browser server, or child spawn.
- Never run `prisma migrate dev`, `prisma migrate reset`, seeds, destructive SQL, Prisma Studio, or broad exports.
- Keep `ADMIN_BILLING_GOODWILL_LIVE_ENABLED` absent or false; perform no Production Admin mutation, email retry, or Stripe credit.
- Browser QA requires a separately identified disposable database, exact opt-in, an independently authenticated Neon control-plane lookup of project ID, branch ID, database name, and direct hostname, Playwright-owned SMTP-blank server, desktop/mobile Chromium, exact cleanup, deletion, and absence verification. Operator-supplied values that merely agree with each other or with the connection URL are not identity proof.
- Evidence may contain migration names, commit IDs, branch/project identifiers, pass/fail state, and timestamps; it may not contain credentials, connection strings, database rows, emails, or provider IDs.
- Follow Neon guidance: create a short-lived branch from the selected parent, rehearse there, and delete it after verification.
- Before every new or resumed external run, perform a blocking trusted-control-plane absence check for branches with either Admin-operations disposable prefix. Treat every match as an alert. Automatic deletion is allowed only when trusted metadata proves the branch belongs to the same verified run owner/lease and explicit lease-expiry/staleness evidence proves that owner can no longer be active; otherwise require operator-reviewed cleanup. Wrap every newly created disposable branch in `try/finally` so cleanup runs after normal completion and catchable exceptions/cancellation. Do not claim that `finally` survives hard process termination, machine loss, or power failure. Resume remains blocked until the trusted control plane proves complete absence.
- Every bounded child owner tracks and owns the complete spawned process tree. On timeout, cancellation, or error it must terminate that tree, await confirmed exit of the root and all descendants, and only then release an advisory lock, close its database connection, clean fixtures, delete a disposable branch, or verify branch absence. The cross-platform owner uses an explicit process group on POSIX and a Windows Job Object or bounded `taskkill /T /F` adapter on Windows; failure to confirm full-tree exit is blocking and forbids unlock/deletion.

---

## File Structure

- Create `lib/admin/operations-activation-contract.ts`: pure expected-inventory, trusted control-plane binding, connection-role, terminal-suffix, authorization-fingerprint, and QA-identity validators.
- Create `lib/admin/neon-control-plane.ts`: server-only authenticated Neon lookup that returns only opaque module-branded evidence around a sanitized project/branch/database/direct-host binding. A module-private brand/`WeakSet` must make a structurally identical caller-created object fail evidence verification; tests obtain valid evidence only by driving the lookup through an injected mock `fetch`, never through a raw binding override.
- Create `scripts/admin-operations-activation.mjs`: rehearsal-only read-only status/evidence command with an exact exit-code/signal contract; direct Production targets fail before Prisma spawn and it never invokes deploy itself.
- Create `scripts/admin-operations-production-activation.mjs`: the sole Production wrapper and cooperative session-lock owner.
- Create `scripts/admin-operations-rehearsal.mjs`: the disposable rehearsal owner that captures proof hashes/outcomes and emits the authenticated short-lived attestation only after complete post-deploy status and verified branch deletion.
- Create `scripts/admin-operations-attestation-store.mjs`: the sole durable cross-process nonce-state owner, backed by an operator-configured absolute state directory outside the repository and secret/evidence trees.
- Create `scripts/admin-operations-repository-cli.mjs`: side-effect-free repository-local Prisma/Playwright resolver and process-tree owner used by every activation child.
- Create `scripts/admin-operations-browser-acceptance.mjs`: the exact desktop/mobile Playwright entry point using the repository CLI/process-tree owner.
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
  "orphan_scan",
  "migration_status",
  "migration_deploy",
  "prisma_validate",
  "prisma_generate",
  "focused_tests",
  "typecheck",
  "lint",
  "unit_tests",
  "build",
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
    postStatus: { outcome: "UP_TO_DATE"; sha256: string }
    prismaValidate: { outcome: "PASS"; sha256: string }
    prismaGenerate: { outcome: "PASS"; sha256: string }
    focusedTests: { outcome: "PASS"; sha256: string }
    fullTests: { outcome: "PASS"; sha256: string }
    readOnlySmoke: { outcome: "PASS"; sha256: string }
    cleanup: { outcome: "PASS"; sha256: string }
    branchDeletion: { outcome: "ABSENT"; sha256: string }
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
  consumeAfterVerifiedDeploy(input: { nonce: string; attestationDigest: string; runId: string; now: Date }): Promise<void>
}

export function validateDisposableAdminQaIdentity(value: {
  databaseUrl: string
  optIn: string | undefined
  expectedBinding: TrustedNeonControlPlaneBinding
  trustedEvidence: TrustedNeonControlPlaneEvidence
  vercelEnv: string | undefined
}): TrustedNeonControlPlaneBinding
```

- [ ] **Step 1: Write RED tests for exact migration inventory and terminal pending suffixes**

Assert all four exact names and ordering. Status validation accepts `[]`, the complete list, or a contiguous terminal suffix such as the final three, final two, or final one migrations. Activation routing treats `[]` only as audit's terminal no-op and rejects it from rehearsal attestation issuance and final mode. Reject gaps and arbitrary order-preserving subsets (including the middle two), as well as unknown, duplicate, malformed, reordered, or pre-Admin pending names. Validate the rehearsal attestation's canonical signed payload field by field: require the trusted Production target, exact attached clean checkout SHA, nonempty ordered suffix, trusted rehearsal target and prefixed branch identity, SHA-256 proof hashes with the exact outcomes above (including mandatory `readOnlySmoke: PASS`), a complete four-entry `APPLIED` post-status with `UP_TO_DATE`, verified cleanup/deletion, unique nonce, and bounded issue/expiry timestamps. The canonical bytes hashed for `readOnlySmoke` include the sanitized smoke result plus the exact rehearsal target binding, checkout SHA, and ordered suffix, so proof replay across a branch, commit, or suffix fails final validation.

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

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: FAIL with missing contract module.

- [ ] **Step 4: Implement the pure validators**

Never return usernames, passwords, ports, or query parameters from the URL parser. Validate terminal suffixes and complete applied-history coherence by exact position, and serialize only the sanitized binding, commit, and suffix in one documented canonical field order before hashing the authorization fingerprint with SHA-256. Validate `checkedAt` independently against the allowed freshness window and include it only as non-fingerprint evidence. Use exact constant-time string equality where practical for identity fields, and require `VERCEL_ENV !== "production"` for the disposable QA identity. A raw `TrustedNeonControlPlaneBinding` supplied by the operator is only expected input; authorization code must unwrap authoritative binding data from valid opaque evidence produced by the server-only lookup owner, and a matching plain object must fail.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: PASS for terminal-suffix, trusted-binding, fingerprint, direct-host, and disposable-identity cases.

- [ ] **Step 6: Commit the activation contract**

```bash
git add lib/admin/operations-activation-contract.ts lib/admin/neon-control-plane.ts tests/admin-operations-activation.test.mjs
git commit -m "feat: add fail-closed admin activation contract"
```

### Task 2: Add sanitized preflight and the sole Production wrapper

**Files:**
- Create: `scripts/admin-operations-activation.mjs`
- Create: `scripts/admin-operations-production-activation.mjs`
- Create: `scripts/admin-operations-rehearsal.mjs`
- Create: `scripts/admin-operations-attestation-store.mjs`
- Create: `scripts/admin-operations-repository-cli.mjs`
- Create: `scripts/admin-operations-browser-acceptance.mjs`
- Modify: `package.json`
- Modify: `tests/admin-operations-activation.test.mjs`

**Interfaces:**
- Consumes:
  - `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL` for the direct connection.
  - `ADMIN_OPERATIONS_NEON_PROJECT_ID`, `ADMIN_OPERATIONS_NEON_BRANCH_ID`, `ADMIN_OPERATIONS_NEON_DATABASE_NAME`, and `ADMIN_OPERATIONS_NEON_DIRECT_HOSTNAME`, populated from a fresh independent trusted-control-plane lookup; never derive these expected values from `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL`.
  - `ADMIN_OPERATIONS_ATTESTATION_STATE_DIR`, injected only into rehearsal/final children by the approved runner, as an absolute operator-controlled durable directory outside the checkout, repository, secret material, and committed/sanitized evidence destinations. The store rejects relative paths, symlinks/reparse points, insecurely broad locations, and paths under the repository.
  - output from the verified repository-local Prisma CLI invoked with exact arguments `migrate`, `status`.
- Produces one allowlist-only evidence object with the exact schema defined below; the same serializer owns status stdout, audit records, checkpoints, and Aegis evidence.

```ts
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

`mode` identifies only the execution phase that produced the evidence. Checkpoint and Aegis files are document destinations that embed this exact serialized object; they are not additional `mode` values. The serializer copies these fields individually and never spreads control-plane, child-process, Prisma, Stripe, or fixture objects. Define one exact required-check-name set per mode from the union above; a mode's validator requires exactly one entry for each of its required names, rejects missing/duplicate/additional names, and accepts only `PASS` or `FAIL`. Audit's empty-suffix `NO_OP` is a completed audit packet, not a final packet with omitted checks. Final mode is reachable only for a nonempty attested suffix and requires distinct `PASS` entries for `trusted_identity`, `orphan_scan`, `migration_status`, `final_locked_refetch`, `final_fingerprint_match`, `fresh_production_authorization`, `production_migration_deploy`, and `production_post_status`; there is no final-mode skip rule. Identity/status, authorization, locked refetch, fingerprint comparison, deploy, and post-status evidence must never be inferred from or conflated with another check. Add retention tests for all four target fields, commit SHA, ordered migration names/statuses, fingerprint, timestamps, outcomes, and every mode's exact required checks. Add omission tests proving credentials, URLs, rows/row values, emails, raw stdout/stderr, unknown keys, and provider transaction/payment/customer/subscription IDs never appear in serialized status, audit, checkpoint, or Aegis evidence. Reject the complete object rather than silently dropping a check when its name is unknown, including email-like (`operator@example.com`), URL-like (`https://example.com/check`), provider-ID-like (`customer_cus_123`), and database-looking (`DATABASE_URL`) names; assert none of those values is serialized into any destination.

- [ ] **Step 1: Add RED tests for the script boundary**

Compile/import the script helpers without executing Prisma, reading activation environment, printing, or spawning. Assert it rejects trusted-binding mismatch before spawning, sets both `DATABASE_URL` and `DIRECT_URL` only in the Prisma child's environment, leaves the parent environment unchanged, and never copies URLs or raw stdout/stderr into evidence. Drive direct `main` with a trusted Production binding and assert it fails before the spawn double is called; drive it with a trusted `admin-operations-migration-rehearsal-...` binding and assert status succeeds with the same child-only environment boundaries. Production status is implemented inside the Production wrapper rather than exposed through an export or forgeable environment nonce. Exercise the shared serializer with a source object containing every retained field plus credentials, URLs, rows, emails, raw command output, unknown fields, and provider transaction/payment/customer/subscription IDs; assert the exact retained object and exact omission of every prohibited field when that object is printed as status/audit output or embedded in checkpoint/Aegis destinations. Separately assert all five execution modes and every allowlisted check name are accepted only in its mode's exact required set, missing/duplicate/additional required checks reject, `FAIL` is retained truthfully, and unknown email-, URL-, provider-ID-, and database-looking check names reject serialization. Assert audit `[]` emits `NO_OP` and cannot call rehearsal/final, while attestation creation and final mode both reject `[]`.

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

Inside `main`, require exact `status` mode, validate the trusted control-plane binding before spawning, and reject a Production branch/target before constructing the Prisma child. Standalone status accepts only a trusted disposable rehearsal or QA branch identity. Resolve the Prisma package and its declared `prisma` bin only under this checkout's `node_modules`, compare the installed package version and normalized bin target with the exact lockfile entry, then invoke that JavaScript entry through `process.execPath`/`execFile` with `shell: false` and the exact arguments `[resolvedBin, "migrate", "status"]`. Build a fresh allowlisted child environment with both `DATABASE_URL` and `DIRECT_URL` set from `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL` without modifying `process.env`; do not inherit or consult `PATH`. Missing/mismatched local artifacts stop before spawn, with no `npx`, install, network, global-binary, `.cmd`, or PATH fallback. Parse only a recognized complete section, validate `[]` or the exact terminal pending suffix, and print sanitized JSON plus the semantic target-specific fingerprint and separate `checkedAt`. Accept exit `0` only for one complete up-to-date section and exit `1` only for one complete allowed pending-suffix section. Reject all other exit-code/content pairings, every signal, connection, divergence, failed-migration, missing-table, truncated, later-applied/earlier-pending non-terminal set, contradictory, or unparseable output. Do not export a Production capability issuer or implement a deploy subcommand here; the Production wrapper owns its status spawn privately and reuses only pure parsing/validation helpers.

- [ ] **Step 4: Add RED tests for the cooperative Production wrapper**

Compile/import `scripts/admin-operations-production-activation.mjs` and the nonce-store owner without side effects. The store uses an operator-configured absolute state directory outside the checkout, repository, secret directory, and evidence output. It serializes transitions with an exclusive per-nonce owner lock created via `open(..., "wx")`; the lock contains the nonce, digest, run ID, and unpredictable ownership token, and only that open handle/owner may transition or release it. Represent state as monotonically numbered immutable same-directory generation records so Windows never needs an overwrite rename: write the next canonical record to an exclusively created temp file, `fsync` the file, close it, atomically rename it to a previously nonexistent generation name, then on POSIX `fsync` the parent directory before acknowledging the transition. Remove the owner lock only after durable acknowledgement and sync that directory removal on POSIX. On Windows, retry only documented sharing/access violations for a short bound while the same owner lock is held, never unlink a destination to make rename succeed, reopen and byte-verify the winning generation, and retain the lock/recovery marker on any ambiguous result. Because Node cannot durably fsync Windows directory metadata, local Windows final mode supports orderly/process-crash recovery only; power-loss/machine-loss recovery is fail-closed and requires operator Production-status reconciliation before automation can be re-enabled. A Production deploy needing stronger automatic recovery must use a supported external durable compare-and-swap store or run the filesystem store on POSIX. Existing, stale, malformed, torn, or ambiguously owned locks/records fail closed rather than being deleted or reused automatically.

Test recovery by injecting a crash at every file/rename/sync/lock-release boundary. Ignore and quarantine incomplete temp files without advancing state; reject malformed/torn generations, missing generation sequences, multiple highest generations, a state record without matching ownership evidence, or a missing state after an acknowledged transition. Prove `ISSUED`/`RESERVED` may resume only when the complete validated generation and owner rules allow it. Any ambiguous or recovered `DEPLOY_STARTED` remains non-reusable and requires manual Production-status reconciliation; `CONSUMED` is terminal even when stale earlier generations remain. Cover POSIX directory-sync ordering and the explicit Windows rename/sharing/reopen-verification behavior, including the Windows power-loss manual-reconciliation gate. Test two real child processes racing to reserve the same `ISSUED` nonce: exactly one reaches `RESERVED`, bound to its unpredictable run ID. Test duplicate issue, wrong digest/run ID, consumed, expired, and malformed records; safe `RESERVED -> ISSUED` release only by the owning run before deploy; atomic `RESERVED -> DEPLOY_STARTED`; no automatic release from `DEPLOY_STARTED`; and atomic `DEPLOY_STARTED -> CONSUMED` only after verified post-status.

With injected checkout inspector, attestation verifier, durable nonce store, lock connection, trusted lookup, private Production status runner, authorization callback, and deploy runner, first assert audit-only mode's exact order: derive and verify an attached clean checkout SHA, open the dedicated direct connection, acquire the target-scoped lock, run one preliminary trusted target/status lookup, record only sanitized audit evidence, then unlock/close. Audit `[]` records `UP_TO_DATE`/`NO_OP` and ends activation; it never calls rehearsal, attestation, authorization, final, or deploy owners. Audit mode must reject authorization/deploy inputs and never call either owner. Separately assert final mode rejects `[]` and follows this exact nonempty-suffix order:

```text
derive attached clean checkout SHA -> verify fresh signed rehearsal attestation with nonempty suffix
-> atomically reserve the durable nonce to this unpredictable final run ID
-> open dedicated direct connection -> poll target-scoped pg_try_advisory_lock within deadline
-> final trusted target/status -> compare attested target, checkout, and suffix
-> emit semantic fingerprint plus separate checkedAt
-> await distinct abort-aware fresh user Production authorization naming that fingerprint within deadline
-> re-fetch trusted target and status under the same lock
-> recompute and constant-time compare semantic fingerprint
-> re-derive clean checkout SHA and compare it to attestation and authorized fingerprint
-> immediately revalidate signature, expiry, target, checkout, suffix, every proof, branch absence, and nonce reservation ownership
-> atomically and durably mark the reserved nonce DEPLOY_STARTED immediately before spawning deploy once
-> post-deploy trusted status proves UP_TO_DATE and all four APPLIED under the same lock
-> atomically consume the nonce only after that verified post-status
-> if any child is cancelled/times out, terminate and await its complete process tree
-> advisory unlock and close in finally only after every owned child/descendant has exited
```

Assert the audit lock is released before rehearsal begins and final mode opens a new dedicated connection and reacquires the lock. Inject a monotonic clock, cancellation-aware sleep, `AbortSignal`, deadlines, repository CLI resolver, and process-tree owner. Cover immediate acquisition, contention followed by acquisition, contention through the 30-second deadline, a hung try-lock probe, cancellation during lock polling, delayed authorization that succeeds within 10 minutes, authorization timeout, cancellation while awaiting authorization, and late authorization resolution after timeout. During final mode, that same connection remains open and owns the cooperative lock throughout. Reject missing/expired/reused/bad-signature attestations, empty suffix, incomplete proof sets (including missing/non-`PASS` `readOnlySmoke` or a smoke hash bound to another target/checkout/suffix), non-UP_TO_DATE rehearsal post-status, any post-rehearsal branch-presence result, detached HEAD, dirty checkout, unverifiable Git output, checkout SHA mismatch, unavailable nonce store, nonce digest mismatch, or reservation owned by another run before authorization or deploy. After authorization/refetch, mutate each signature/target/checkout/suffix/proof/expiry/absence input in turn and assert the immediate pre-spawn revalidation fails without calling deploy. A changed target, checkout SHA, pending suffix, malformed/stale `checkedAt`, denied/mismatched authorization, failed locked refetch/fingerprint proof, deploy signal/nonzero exit, or post-status other than complete UP_TO_DATE/all-four-APPLIED stops safely. Assert every required final evidence entry is distinct and `PASS`, including fresh Production authorization; final evidence has no skip outcome. A known safe failure before `markDeployStarted` releases only this run's `RESERVED` nonce back to `ISSUED` if still unexpired, allowing a new final attempt. If the process fails after `markDeployStarted`, or deploy returns a signal/nonzero/timeout, throws after spawn, or post-status is not conclusively verified, leave `DEPLOY_STARTED` durably reserved and block automation for manual Production-status reconciliation; never release or reuse it. Only verified deploy plus complete post-status atomically consumes it. For a hung root child with a surviving grandchild, on both POSIX and the Windows adapter assert tree termination begins at the deadline and all exit confirmations occur before `pg_advisory_unlock`, connection close, fixture cleanup, disposable deletion, or absence verification. If any descendant cannot be confirmed exited, those cleanup actions are not called and the run is blocking. Assert `pg_advisory_unlock` is called exactly once only after successful acquisition and confirmed owned-child exit; it is never called on contention/cancellation before acquisition. Close is called exactly once only after process-tree quiescence in every acquired-lock case. No timeout/cancellation/late callback may reach deploy. Test absent local Prisma/Playwright bins, lockfile/installed-version mismatch, unexpected bin targets, and a malicious `PATH`; all fail before spawn and no test permits download or PATH/global fallback. Freeze one timestamp and generate concurrent rehearsal/QA candidates; assert their cryptographic suffixes differ, exact-name control-plane collisions cause bounded regeneration, exhaustion fails before creation, and the exact name/suffix/returned branch ID remain bound to the same owner lease and attestation. Assert no exported helper or documented Production command can invoke Production status or deploy outside these wrapper modes.

- [ ] **Step 5: Implement the only approved Production path**

The wrapper must require exact `audit` or `final` mode and obtain the direct URL and expected tuple only through its child-scoped environment input. It runs Git itself in the exact working directory used for Prisma: require attached HEAD, exact `git rev-parse HEAD`, and empty tracked/untracked status; caller-provided SHA values are comparison inputs only and can never establish checkout identity. Both modes open a dedicated direct PostgreSQL connection and derive the same stable advisory-lock key from the sanitized Production target. Poll `pg_try_advisory_lock` every 250 ms using an abort-aware injected sleep until acquired or a 30-second monotonic deadline expires; never use blocking `pg_advisory_lock`. Race each database probe against that same `AbortSignal` and remaining deadline so a hung connection cannot make acquisition unbounded; on probe timeout/abort, destroy or close the connection and stop. Set `lockAcquired = true` only from the successful database result. In `finally`, first require the process-tree owner to terminate/await every outstanding child and descendant; only after confirmed quiescence call `pg_advisory_unlock` when `lockAcquired` is true, then close the connection, preserving the original failure if cleanup also fails. Audit mode runs one preliminary trusted target/status read, records sanitized audit evidence, then exits; its code path has no authorization or deploy call.

Final mode rejects an empty suffix. It first verifies the canonical HMAC signature, one-time nonce, issue/expiry window, complete proof hashes/outcomes, trusted Production/rehearsal identities, exact nonempty ordered suffix, complete UP_TO_DATE/all-four-APPLIED rehearsal post-status, and verified rehearsal cleanup/deletion in the short-lived attestation. It also rechecks trusted absence of that exact rehearsal branch, computes the canonical attestation digest, generates an unpredictable final `runId`, and atomically reserves the durable `ISSUED` nonce/digest to that run. Any mismatch, stale proof, unavailable/ambiguous store, existing reservation, or non-`ISSUED` state blocks final mode. After acquiring its new lock, final mode must run a new trusted target/status read and compare target, clean checkout SHA, and suffix to the attestation. While holding that lock, it emits the semantic fingerprint and status-owned freshness timestamp and invokes the authorization owner for a distinct fresh Production authorization with the fingerprint, an `AbortSignal`, and a 10-minute monotonic deadline. Race the callback against that deadline, signal cancellation to the owner, and permanently ignore any late resolution. Authorization must resolve affirmatively inside that bound and the status-owned `checkedAt` must remain no older than 10 minutes; denial, timeout, abort, or late resolution cannot authorize deploy. It then re-fetches opaque trusted target evidence and reruns complete status, recording the distinct locked-refetch check. Recompute the semantic fingerprint from the refreshed target, wrapper-derived checkout SHA, and ordered suffix; compare it to the authorization, attestation, and first final-mode fingerprint, recording a separate fingerprint-match check.

Immediately before spawn, repeat the full canonical HMAC verification and freshness check; re-fetch/compare trusted target and rehearsal-branch absence; re-derive clean checkout state/SHA; compare the exact nonempty suffix and every proof hash/outcome, including the target/checkout/suffix-bound `readOnlySmoke: PASS`; and ask the durable store to prove the nonce/digest is still `RESERVED` by this exact run. Only after every last-moment check passes may the store durably transition this run's record to `DEPLOY_STARTED`, immediately followed by one child-scoped deploy through the verified repository CLI/process-tree owner. A safely classified failure before that transition releases this run's unexpired `RESERVED` record to `ISSUED`; a crash/ambiguous store result requires manual reconciliation. Once `DEPLOY_STARTED`, every spawn signal/nonzero/timeout, exception, cancellation, connection loss, or inconclusive/failed post-status leaves the record unchanged and blocks automated retry pending manual Production-status reconciliation. On cancellation/timeout the owner terminates and awaits the entire child tree before any lock release or connection close; inability to confirm exit keeps cleanup blocked. Only after deploy returns success and a complete UP_TO_DATE/all-four-APPLIED post-status passes may the store durably transition `DEPLOY_STARTED` to `CONSUMED`, after which final evidence records all required checks as `PASS`. The lock is cooperative: every approved Production operator path uses this wrapper, and the docs must not imply it fences arbitrary external SQL clients.

- [ ] **Step 6: Add the named npm commands**

```json
"admin:operations:activation:status": "node scripts/admin-operations-activation.mjs status",
"admin:operations:activation:rehearsal": "node scripts/admin-operations-rehearsal.mjs",
"admin:operations:activation:production": "node scripts/admin-operations-production-activation.mjs",
"admin:operations:browser-acceptance": "node scripts/admin-operations-browser-acceptance.mjs"
```

- [ ] **Step 7: Run tests and static validation**

```bash
node --test tests/admin-operations-activation.test.mjs
npm run typecheck
npm run lint
git diff --check
```

Expected: PASS and no secret-bearing output.

- [ ] **Step 8: Commit the preflight and Production wrapper**

```bash
git add scripts/admin-operations-activation.mjs scripts/admin-operations-production-activation.mjs scripts/admin-operations-rehearsal.mjs scripts/admin-operations-attestation-store.mjs scripts/admin-operations-repository-cli.mjs scripts/admin-operations-browser-acceptance.mjs package.json tests/admin-operations-activation.test.mjs
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

Audit-only mode obtains its cooperative session advisory lock through the bounded try-lock contract, performs one preliminary trusted status, serializes the exact allowlisted evidence schema, and releases the lock only if acquired. It has no authorization or deploy capability, and its evidence cannot authorize final mode. If the suffix is empty, record `UP_TO_DATE`/`NO_OP`, end activation, and proceed only to read-only smoke/browser acceptance; do not create a rehearsal, attestation, final invocation, authorization request, or deploy attempt. Only a nonempty contiguous terminal suffix enters rehearsal and later final mode. The document must instruct the operator not to paste secret values into evidence and to stop unless target binding is exact and the pending set is `[]` or one contiguous terminal suffix.

- [ ] **Step 2: Document disposable Neon rehearsal**

Before creating anything on every fresh or resumed run, query the trusted control plane for branches whose names start with `admin-operations-migration-rehearsal-` or `admin-operations-qa-`. Every match is an alert and blocks resume until trusted absence is proven. Auto-delete only when trusted metadata matches the verified run owner and lease and explicit stale/expired-lease proof shows that run cannot still be active. When ownership, lease, or staleness is missing or ambiguous, require operator-reviewed cleanup; never infer ownership from the name prefix or silently create another disposable branch alongside it. This startup gate is mandatory because a hard kill, machine loss, or power failure can bypass in-process cleanup.

Use the Neon console/approved API to create a branch named `admin-operations-migration-rehearsal-YYYYMMDD-HHMMSS-<runSuffix>`, where `runSuffix` is at least 128 bits from `crypto.randomBytes` encoded as lowercase hex/base64url. Before creation, check the exact candidate against the trusted control plane; on collision generate a new suffix and retry a small bounded number of times, then fail closed. Bind the exact branch name, random run ID/suffix, and returned branch ID to the verified owner lease and later attestation; a timestamp or prefix alone never proves ownership. Follow Neon's official [branching workflow](https://neon.com/docs/introduction/branching) and use the direct connection described by the official [connection guidance](https://neon.com/docs/connect/connection-errors). Fetch the new project/branch/database/direct-host binding back from the trusted control plane. The rehearsal owner independently derives attached HEAD, exact clean checkout SHA, and empty worktree status from the checkout it will use, and binds those values plus the trusted Production target and audited ordered pending suffix to the run. Wrap all work after creation in `try/finally`, but on cancellation/timeout terminate and await the entire owned child process tree before deletion and trusted control-plane absence verification. Do not represent `finally` as protection from hard termination.

Invoke the single rehearsal owner through the approved child-scoped secret runner. It resolves and verifies the repository-local Prisma CLI once, then runs status, deploy, validate, and generate with exact argument arrays, `shell: false`, and a fresh allowlisted environment for each child. The status child receives `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL` plus the independently obtained rehearsal target binding and lets its own Prisma child map that URL to `DATABASE_URL`/`DIRECT_URL`; the other children receive the rehearsal direct URL as child-only `DATABASE_URL`/`DIRECT_URL`. The parent shell remains without database variables, and no step uses npm PATH resolution, `npx`, or downloads:

```powershell
Invoke-WithScopedEnvironment -Environment $rehearsalEnvironment -Command {
  npm run admin:operations:activation:rehearsal
}
```

Capture the second status result rather than treating command success as sufficient. It must be one complete `UP_TO_DATE` result containing the exact four expected migrations, each with status `APPLIED`; any pending, missing, duplicate, additional, truncated, or contradictory entry blocks attestation. Run focused Admin suites and the full unit suite plus read-only smoke queries. Hash the canonical sanitized output of pre-status, deploy, complete post-status, validate, generate, focused tests, full tests, cleanup, and deletion/absence proof with SHA-256 and record each exact outcome. The separate `readOnlySmoke` hash envelope contains its mandatory `PASS` outcome, sanitized smoke result, exact trusted rehearsal target, exact checkout SHA, and audited ordered suffix. Record results only through the exact allowlisted evidence serializer. On timeout/cancellation, terminate and await the entire owned process tree before fixture cleanup, branch deletion, or absence verification; if any descendant survives, do not delete and record a blocking failure. The next run's mandatory startup orphan check covers cleanup that a hard termination bypassed. Inability to verify child-tree exit or branch absence is blocking.

Only after the `finally` cleanup completes and a new trusted-control-plane lookup proves the exact rehearsal branch absent may the rehearsal owner issue an attestation for the audited nonempty suffix. Canonically serialize and HMAC-sign the trusted Production target, exact clean checkout SHA, audited ordered pending suffix, trusted rehearsal binding, exact timestamp-plus-random branch name/run ID, all proof hashes/outcomes including `readOnlySmoke: PASS`, complete four-APPLIED post-status, issuance time, expiry, and unique nonce. Before returning the attestation, compute its canonical digest and ask the durable nonce-store owner to atomically create the nonce record in `ISSUED`; an existing nonce, store/lock ambiguity, or durability failure invalidates issuance. The attestation expires no later than 30 minutes after verified deletion; it is not extendable or refreshable without rerunning the complete rehearsal. The signing key exists only in the rehearsal/final child environment and neither it nor the signature is committed to evidence. A failed/missing proof, changed proof bytes, smoke proof for another target/checkout/suffix, branch reappearance, target/checkout/suffix change, expiry, bad signature, or non-`ISSUED` nonce invalidates the attestation and requires a fresh rehearsal or manual reconciliation according to the durable state.

- [ ] **Step 3: Document the authorized Production deploy gate**

After rehearsal and its cleanup/absence gate complete, invoke `npm run admin:operations:activation:production -- final` through the same explicit child-environment wrapper and supply the still-fresh authenticated attestation for the nonempty suffix through the approved non-committed channel. Final mode rejects an empty suffix or a missing, expired, invalid, reused, mismatched, unreserved, or ambiguously stored attestation before authorization or deployment. It derives the attached clean checkout SHA and cleanliness itself from the exact Prisma working directory, compares them to the attestation, atomically reserves the durable nonce to its unpredictable run ID, opens a new dedicated connection, and obtains the cooperative session lock through 250 ms cancellation-aware try-lock polling within 30 seconds; it does not reuse audit mode's lock, status, fingerprint, or `checkedAt`. Under that new lock it performs fresh final trusted status, compares the target/SHA/suffix to the attestation, emits the semantic fingerprint plus status-owned freshness timestamp, and then awaits a distinct fresh user Production authorization naming that exact fingerprint for at most 10 minutes. After authorization it re-fetches the trusted target and complete status and records the locked-refetch check, recomputes and compares the fingerprint and records the fingerprint-match check, then immediately before spawn repeats signature/expiry, target, checkout, suffix, every proof, branch absence, and nonce-reserved-to-this-run validation. Only then does the nonce owner atomically mark `DEPLOY_STARTED` and the wrapper spawn one child-scoped deploy. Complete `UP_TO_DATE` status with all four migrations `APPLIED` is required before the nonce is atomically consumed and every required final check is recorded `PASS`. Safe failures before `DEPLOY_STARTED` release the owning reservation when still unexpired; any failure or ambiguity after `DEPLOY_STARTED` leaves it reserved and blocks automation for manual reconciliation. Unlock only if acquired and always close in `finally`. Do not provide a manual Production deploy fallback.

- [ ] **Step 4: Document read-only Production smoke**

On the exact deployed commit, verify the Admin/Reviewer/Editor/ordinary-user role matrix and account/detail/dashboard projections without invoking any mutation. Keep live goodwill disabled.

- [ ] **Step 5: Document disposable browser acceptance and teardown**

Create a second disposable branch named `admin-operations-qa-YYYYMMDD-HHMMSS-<runSuffix>`; never reuse the rehearsal branch. Generate at least 128 random bits for the suffix, check the exact candidate in the trusted control plane, retry collisions within a small bound, and bind exact name/suffix/returned branch ID to the verified run-owner lease. Wrap provisioning, approved synthetic/sanitized fixture setup, test execution, exact fixture cleanup, and branch deletion in `try/finally` for graceful exits. Apply all migrations through the verified repository-local Prisma owner, set the operator-expected four-field binding and opt-in only for the Playwright child, require the independently authenticated Neon lookup to return the same binding, blank SMTP, and invoke the pinned browser owner:

```bash
npm run admin:operations:browser-acceptance
```

The browser owner resolves `@playwright/test` and its declared `playwright` bin only inside this checkout, verifies its installed version/bin against `package-lock.json`, and invokes it with `process.execPath`/`execFile`, `shell: false`, exact arguments `test tests/browser/admin-user-operations.spec.ts --project=desktop-chromium --project=mobile-chromium`, and a clean allowlisted environment that does not consult `PATH`. In `finally`, first terminate and await the complete Playwright/server process tree, then attempt foreign-key-safe fixture cleanup, delete the branch through Neon, and verify through the trusted control plane that it is absent. If descendant exit cannot be confirmed, do not clean/delete/unlock and fail closed. Because hard termination can bypass `finally`, every resumed run performs the blocking prefix scan before provisioning. A match is an alert; only verified matching exact branch ID/name/run suffix/owner lease plus explicit stale proof permits automatic deletion, otherwise operator cleanup is required. Missing or inconclusive deletion evidence blocks completion.

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

Run the database-aware static commands in separate children whose explicit validation environment removes `DATABASE_URL`, `DIRECT_URL`, and activation database variables:

```powershell
Invoke-WithScopedEnvironment -Environment $databaseBlankValidationEnvironment -Command { npm run prisma:validate }
Invoke-WithScopedEnvironment -Environment $databaseBlankValidationEnvironment -Command { npm run prisma:generate }
```

Expected: all pass with the single intentional unit-test skip and 104-page build.

- [ ] **Step 2: Complete reviews and the PR loop**

Obtain spec, security/operations, and quality review. Push/open PR, wait for hosted checks and a fresh CodeRabbit review, resolve valid findings, and stop at the user merge gate.

- [ ] **Step 3: Refresh exact merged main before external work**

After user merge approval, create a clean activation worktree from refreshed `origin/main`. Record its commit. Do not run operational commands from a dirty checkout.

- [ ] **Step 4: Execute the read-only Production audit**

Fetch the fresh trusted project/branch/database binding, then invoke only `npm run admin:operations:activation:production -- audit` through its explicit child environment. Audit-only mode uses the bounded cancellation-aware try-lock contract, performs one preliminary trusted status, records the exact allowlisted evidence schema, unlocks only if acquired, and always closes; it cannot request authorization or deploy. Its fingerprint and `checkedAt` cannot authorize final mode. If all four migrations are applied, record `UP_TO_DATE`/`NO_OP`, end activation without rehearsal/attestation/final/authorization/deploy, and proceed to smoke/browser acceptance. If one nonempty contiguous terminal suffix is pending, continue to the disposable rehearsal. Otherwise stop and ask the user for direction.

- [ ] **Step 5: Rehearse on the disposable clone**

First perform the blocking trusted-control-plane prefix scan. Treat every match as an alert; auto-delete only with verified matching owner/lease and explicit stale proof, otherwise require operator cleanup, and do not resume until absence is proven. Then create, identify, migrate, validate, generate, run focused and full tests, and read-only smoke the rehearsal clone exactly as Task 4 specifies inside `try/finally`. Capture a complete post-deploy `UP_TO_DATE` status with all four migrations `APPLIED`. On normal completion or catchable failure/cancellation, delete it and block until trusted control-plane absence verification succeeds. Only after verified absence may the rehearsal owner sign the maximum-30-minute attestation containing the trusted Production target, exact clean checkout SHA, audited ordered suffix, rehearsal identity, canonical proof hashes/outcomes, complete post-status, and cleanup/deletion proof. A later resume repeats the scan because hard termination may have bypassed `finally`. Complete every rehearsal and cleanup/absence gate before starting the final Production wrapper; no Production advisory lock is held during rehearsal.

- [ ] **Step 6: Deploy the exact terminal pending suffix when needed**

Only after rehearsal and verified disposable cleanup succeed, invoke `npm run admin:operations:activation:production -- final` through its explicit child environment with the still-fresh authenticated rehearsal attestation for a nonempty suffix. Final mode derives the SHA from its exact working checkout, requires attached HEAD and an empty status, rejects any caller/attestation mismatch, computes the attestation digest, and atomically reserves its durable `ISSUED` nonce to an unpredictable run ID before opening a deploy path. It verifies the signature, expiry, complete proof set, all-four-APPLIED post-status, and current absence of the rehearsal branch; invalid evidence requires a fresh rehearsal or durable-state reconciliation. It then opens a new dedicated connection, obtains the cooperative session lock through 250 ms cancellation-aware try-lock polling within 30 seconds, performs a fresh trusted target lookup and complete final status, and derives the semantic fingerprint plus `checkedAt` from that exact status result. It does not reuse audit-mode evidence. Never refresh or replace `checkedAt` from the clock without a new complete status. Require the final status target, nonempty ordered suffix, and wrapper-derived checkout SHA to equal the attestation, then stop for a separate abort-aware fresh user Production authorization naming the semantic fingerprint, bounded to 10 minutes and the same status-evidence freshness window. After timely authorization, re-fetch the trusted target and complete status under the same lock, record the distinct locked-refetch proof, recompute and compare the semantic fingerprint to the attestation/authorization/first locked result, record the distinct fingerprint proof, and validate the new status-owned `checkedAt`. Immediately before spawn, revalidate the HMAC signature and expiry, re-fetch/compare target and rehearsal absence, re-derive clean checkout/SHA, compare suffix and every proof hash/outcome, and atomically prove the nonce/digest remains `RESERVED` by this run. Then atomically mark `DEPLOY_STARTED` and immediately run at most one child-scoped deploy. Only a successful deploy followed by complete `UP_TO_DATE`/all-four-`APPLIED` post-status atomically consumes the nonce and permits all distinct required final proofs, including fresh Production authorization, to be `PASS`. A safely known pre-spawn failure releases this run's unexpired reservation; any failure/ambiguity after `DEPLOY_STARTED` retains the record and blocks automation for manual Production-status reconciliation. Stop immediately on unexpected output; unlock only if acquired, always close in `finally`, and do not release the lock to run a manual command or attempt SQL repair.

- [ ] **Step 7: Run Production read-only smoke**

Verify exact deployed commit, role matrix, and safe projections. Record no account-level values.

- [ ] **Step 8: Run disposable desktop/mobile browser acceptance**

After another blocking prefix scan with the same alert/verified-owner/lease/stale-proof rules, create a fresh identified QA branch distinct from the rehearsal clone, apply migrations through its explicit child environment, load only the approved synthetic/sanitized seed, set the expected binding variables and sentinel only for the Playwright child, require the independent trusted lookup, and run both projects inside `try/finally`. On normal completion or catchable failure/cancellation, verify fixture cleanup, delete the branch, and block until the trusted control plane verifies absence; a resumed run must assume hard termination may have bypassed cleanup and repeat the startup check.

- [ ] **Step 9: Commit sanitized evidence**

```bash
git add docs/project-state.md docs/project-log.md docs/aegis/work/2026-08-11-admin-operations-production-activation/20-checkpoint.md docs/aegis/work/2026-08-11-admin-operations-production-activation/90-evidence.md
git commit -m "docs: record admin operations activation evidence"
```

Open a documentation-only PR for the executed evidence if the implementation PR is already merged; complete hosted checks and stop at the user merge gate.
