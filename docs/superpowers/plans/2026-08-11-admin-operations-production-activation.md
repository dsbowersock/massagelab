# Admin Operations Production Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the four Admin-era migrations on a disposable Neon clone, deploy only an exact contiguous terminal pending suffix to Production when necessary, and complete read-only Production smoke plus desktop/mobile disposable browser acceptance.

**Architecture:** Add a small fail-closed activation contract that statefully parses complete Prisma migration-status sections, accepts only an empty pending set or a contiguous terminal suffix of the expected inventory, and binds the direct connection to a project/branch/database identity obtained independently from the trusted Neon control plane. Use existing Prisma deploy commands for schema mutation, existing Playwright fixture owners for browser acceptance, and an explicit disposable-database identity token so the mutation sentinel cannot be enabled from a connection string alone.

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
- Migration deployment is authorized only after identity, pending-set, and disposable rehearsal gates pass.
- Stop for any non-terminal pending subset, ambiguous database identity, failed rehearsal, connection-role mismatch, or changed Production pending set.
- A Production deploy requires a fresh user authorization naming the sanitized target-specific fingerprint produced from the trusted project/branch/database binding, exact commit, exact ordered pending suffix, and preflight timestamp. Authorization for another branch, database, commit, pending set, or earlier fingerprint does not carry forward.
- Never run `prisma migrate dev`, `prisma migrate reset`, seeds, destructive SQL, Prisma Studio, or broad exports.
- Keep `ADMIN_BILLING_GOODWILL_LIVE_ENABLED` absent or false; perform no Production Admin mutation, email retry, or Stripe credit.
- Browser QA requires a separately identified disposable database, exact opt-in, an independently authenticated Neon control-plane lookup of project ID, branch ID, database name, and direct hostname, Playwright-owned SMTP-blank server, desktop/mobile Chromium, exact cleanup, deletion, and absence verification. Operator-supplied values that merely agree with each other or with the connection URL are not identity proof.
- Evidence may contain migration names, commit IDs, branch/project identifiers, pass/fail state, and timestamps; it may not contain credentials, connection strings, database rows, emails, or provider IDs.
- Follow Neon guidance: create a short-lived branch from the selected parent, rehearse there, and delete it after verification.
- Before every new or resumed external run, perform a blocking trusted-control-plane absence/recovery check for orphaned branches with either Admin-operations disposable prefix. Wrap every newly created disposable branch in `try/finally` so cleanup runs after normal completion and catchable exceptions/cancellation. Do not claim that `finally` survives hard process termination, machine loss, or power failure; the mandatory startup orphan check owns recovery from those cases. Inability to recover an orphan or prove deletion blocks continuation.

---

## File Structure

- Create `lib/admin/operations-activation-contract.ts`: pure expected-inventory, trusted control-plane binding, connection-role, terminal-suffix, authorization-fingerprint, and QA-identity validators.
- Create `lib/admin/neon-control-plane.ts`: server-only authenticated Neon lookup that returns only opaque module-branded evidence around a sanitized project/branch/database/direct-host binding. A module-private brand/`WeakSet` must make a structurally identical caller-created object fail evidence verification; tests obtain valid evidence only by driving the lookup through an injected mock `fetch`, never through a raw binding override.
- Create `scripts/admin-operations-activation.mjs`: read-only status/evidence command; it never invokes deploy itself.
- Modify `package.json`: named read-only activation command.
- Create `tests/admin-operations-activation.test.mjs`: pure contract and script-source coverage.
- Modify `lib/admin/browser-qa-authorization.ts`: require exact disposable identity in addition to URL and opt-in.
- Modify `tests/admin-user-operations-fixture.test.mjs`, `tests/browser/admin-user-operations-fixture.ts`, `tests/browser/admin-user-operations.spec.ts`, and `playwright.config.ts`: identity proof and exact desktop/mobile invocation.
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
  checkedAt: string
}): string

export function validateDisposableAdminQaIdentity(value: {
  databaseUrl: string
  optIn: string | undefined
  expectedBinding: TrustedNeonControlPlaneBinding
  trustedEvidence: TrustedNeonControlPlaneEvidence
  vercelEnv: string | undefined
}): TrustedNeonControlPlaneBinding
```

- [ ] **Step 1: Write RED tests for exact migration inventory and terminal pending suffixes**

Assert all four exact names and ordering. Accept only `[]`, the complete list, or a contiguous terminal suffix such as the final three, final two, or final one migrations. Reject gaps and arbitrary order-preserving subsets (including the middle two), as well as unknown, duplicate, malformed, reordered, or pre-Admin pending names.

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

Require `postgres:`/`postgresql:`, `.neon.tech`, and a hostname without `-pooler`. Require the URL and operator-expected tuple to match the binding unwrapped from opaque module-branded evidence returned by the independently authenticated Neon lookup; the URL parser cannot create that evidence. Explicitly assert that fabricated operator values which all match each other and the URL still fail, as does a structurally identical caller-created “trusted” object with all matching values. Valid test evidence may be created only by exercising the authenticated lookup with an injected mock HTTP response. Also fail when the lookup is missing/errors or returns any different project ID, branch ID, database name, or direct hostname. Reject changed bindings, missing database names, and query-log output. Assert the authorization fingerprint changes when the target project, branch, database, commit, ordered pending suffix, or timestamp changes. Also reject Production QA and missing opt-in.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: FAIL with missing contract module.

- [ ] **Step 4: Implement the pure validators**

Never return usernames, passwords, ports, or query parameters from the URL parser. Validate terminal suffixes and complete applied-history coherence by exact position, and serialize the sanitized binding, commit, suffix, and timestamp in one documented canonical field order before hashing the authorization fingerprint with SHA-256. Use exact constant-time string equality where practical for identity fields, and require `VERCEL_ENV !== "production"` for the disposable QA identity. A raw `TrustedNeonControlPlaneBinding` supplied by the operator is only expected input; authorization code must unwrap authoritative binding data from valid opaque evidence produced by the server-only lookup owner, and a matching plain object must fail.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: PASS for terminal-suffix, trusted-binding, fingerprint, direct-host, and disposable-identity cases.

- [ ] **Step 6: Commit the activation contract**

```bash
git add lib/admin/operations-activation-contract.ts lib/admin/neon-control-plane.ts tests/admin-operations-activation.test.mjs
git commit -m "feat: add fail-closed admin activation contract"
```

### Task 2: Add sanitized read-only migration preflight

**Files:**
- Create: `scripts/admin-operations-activation.mjs`
- Modify: `package.json`
- Modify: `tests/admin-operations-activation.test.mjs`

**Interfaces:**
- Consumes:
  - `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL` for the direct connection.
  - `ADMIN_OPERATIONS_NEON_PROJECT_ID`, `ADMIN_OPERATIONS_NEON_BRANCH_ID`, `ADMIN_OPERATIONS_NEON_DATABASE_NAME`, and `ADMIN_OPERATIONS_NEON_DIRECT_HOSTNAME`, populated from a fresh independent trusted-control-plane lookup; never derive these expected values from `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL`.
  - `npx prisma migrate status` output.
- Produces one JSON object containing only the sanitized `target` project/branch/database identity, `commit`, `expectedMigrations`, `pendingMigrations`, `status`, `checkedAt`, and `authorizationFingerprint`.

- [ ] **Step 1: Add RED tests for the script boundary**

Compile/import the script helpers without executing Prisma, reading activation environment, printing, or spawning. Assert it rejects trusted-binding mismatch before spawning, sets both `DATABASE_URL` and `DIRECT_URL` only in the Prisma child's environment, and redacts URLs from stdout/stderr.

Drive the status parser from static sanitized fixtures for: exact up-to-date output, one and multiple unapplied migrations, Windows and LF newlines, connection failure, failed migration, divergence, missing migration table, truncated unapplied output, duplicate/contradictory status headings, and migration-looking lines embedded in diagnostics. Include explicit tests named for later-applied-history contradiction: a parsed earlier singleton `[migration 1]` pending while migration 4 is known later in the expected history, and an earlier prefix `[migrations 1, 2]` pending while 3-4 are later in that history. Both must fail as non-terminal pending sets even though every individual name is allowlisted. The parser must be a state machine over a recognized complete status section: it may collect `^\d{14}_[a-z0-9_]+$` lines only between the exact unapplied heading and its recognized terminal guidance/end marker, or accept the exact complete up-to-date marker. Reject incomplete, mixed, repeated, or migration-looking diagnostic output rather than scraping matching lines globally.

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

Inside `main`, require exact `status` mode, validate the trusted control-plane binding before spawning, and build the Prisma child's environment with both `DATABASE_URL` and `DIRECT_URL` set from `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL`. Call the local Prisma CLI with `migrate status`, parse only a recognized complete section, validate `[]` or the exact terminal pending suffix, and print sanitized JSON plus the target-specific fingerprint. Prisma may exit nonzero when migrations are unapplied: accept that only when the stateful parser proves one complete unapplied section and the parsed names form an allowed terminal suffix; reject connection, divergence, failed-migration, missing-table, truncated, later-applied/earlier-pending non-terminal sets, contradictory, or unparseable output. Do not implement a deploy subcommand; deployment remains an explicit operator command after rehearsal review.

- [ ] **Step 4: Add the named npm command**

```json
"admin:operations:activation:status": "node scripts/admin-operations-activation.mjs status"
```

- [ ] **Step 5: Run tests and static validation**

```bash
node --test tests/admin-operations-activation.test.mjs
npm run typecheck
npm run lint
git diff --check
```

Expected: PASS and no secret-bearing output.

- [ ] **Step 6: Commit the preflight tool**

```bash
git add scripts/admin-operations-activation.mjs package.json tests/admin-operations-activation.test.mjs
git commit -m "feat: add read-only admin migration preflight"
```

### Task 3: Strengthen disposable browser-database identity

**Files:**
- Modify: `lib/admin/neon-control-plane.ts`
- Modify: `lib/admin/browser-qa-authorization.ts`
- Modify: `tests/admin-user-operations-fixture.test.mjs`
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

Replace the URL-plus-boolean/operator-pair expectation with exact trusted-binding cases. Assert mutation remains denied when any expected field is missing, any trusted field differs, the authenticated lookup is unavailable/errors, the trusted branch name lacks the prefix, or `VERCEL_ENV=production`. Include a regression where fabricated project/branch/database/direct-host environment values all match each other and the connection URL: authorization must still fail because no independently fetched trusted binding exists. Include one success case only when the awaited control-plane result independently matches all four fields and the parsed direct URL.

- [ ] **Step 2: Run fixture tests and verify RED**

Run: `node --test tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs`

Expected: FAIL because the current guard accepts only URL plus opt-in.

- [ ] **Step 3: Await trusted identity, then reuse the pure activation validator**

Make both browser-QA authorization helpers async. They first call the server-only authenticated Neon owner with only the project/branch selector, then pass its opaque evidence plus the independently supplied expected tuple and parsed direct URL to `validateDisposableAdminQaIdentity`. The validator verifies the module-private evidence brand before unwrapping the sanitized binding. The boolean helper catches lookup/evidence/validation errors and returns false; the throwing helper keeps a static safe message. Never fall back to expected environment fields when the lookup fails, never accept a structurally matching plain object, and ensure fixture provisioning awaits authorization before its first database mutation.

- [ ] **Step 4: Require exact desktop and mobile projects**

In the browser spec, assert the project name is one of the configured Admin projects before provisioning. Update `playwright.config.ts` so the documented command selects both Chromium viewports and always disables server reuse for any invocation that can select the Admin spec.

- [ ] **Step 5: Preserve SMTP and billing mutation guards**

Keep the Playwright-owned server requirement, blank SMTP environment, presentation-only billing client, server-action QA guard, zero form submissions, and zero matching POST requests. Add source-contract assertions that these remain active with the new four-field expected tuple, awaited trusted lookup, and no operator-value fallback.

- [ ] **Step 6: Run focused browser harness tests and verify GREEN**

```bash
node --test tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs tests/admin-billing-goodwill-ui.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit the identity guard**

```bash
git add lib/admin/neon-control-plane.ts lib/admin/browser-qa-authorization.ts tests/admin-user-operations-fixture.test.mjs tests/browser/admin-user-operations-fixture.ts tests/browser/admin-user-operations.spec.ts playwright.config.ts tests/browser-qa-harness.test.mjs
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

Specify that the operator obtains the Production direct connection through the approved secret channel and, in a separate fresh lookup through the authenticated Neon console or approved API, records the sanitized project ID, branch ID, database name, and direct endpoint hostname. The operator must bind those independently obtained expected values for the status command; copying identity fields out of the connection string is not proof. Run the status command through the approved environment runner so its activation variables exist only for that child command and the shell's/runtime app's `DATABASE_URL` is not replaced:

```powershell
# Pseudocode: the approved secret runner injects these into this command only.
Invoke-WithScopedEnvironment -Environment $productionStatusEnvironment -Command {
  npm run admin:operations:activation:status
}
```

The document must instruct the operator not to paste secret values into evidence and to stop unless target binding is exact and the pending set is `[]` or one contiguous terminal suffix of the four migrations. Record only the sanitized target, commit, ordered suffix, timestamp, and fingerprint.

- [ ] **Step 2: Document disposable Neon rehearsal**

Before creating anything on every fresh or resumed run, query the trusted control plane for branches whose names start with `admin-operations-migration-rehearsal-` or `admin-operations-qa-`. Stop and recover/delete any prior orphan, then verify absence; do not silently create another disposable branch alongside it. This startup gate is mandatory because a hard kill, machine loss, or power failure can bypass in-process cleanup.

Use the Neon console/approved API to create a branch whose name is `admin-operations-migration-rehearsal-` followed by the UTC creation timestamp in `YYYYMMDD-HHMMSS` form. Follow Neon's official [branching workflow](https://neon.com/docs/introduction/branching) and use the direct connection described by the official [connection guidance](https://neon.com/docs/connect/connection-errors). Fetch the new project/branch/database/direct-host binding back from the trusted control plane. Wrap all work after creation in `try/finally`, with deletion and trusted control-plane absence verification in `finally` for normal completion and catchable exceptions/cancellation; do not represent this as protection from hard termination.

Run each command with child-scoped environment. The status command receives `ADMIN_OPERATIONS_MIGRATION_DIRECT_URL` plus the independently obtained target binding and lets its own child map that URL to Prisma's `DATABASE_URL`/`DIRECT_URL`. Only `prisma:migrate:deploy`, `prisma:validate`, and `prisma:generate` receive the rehearsal direct URL as child-scoped `DATABASE_URL`/`DIRECT_URL`; never invoke the status command with only runtime Prisma variables and never leave the rehearsal URL in the parent shell:

```bash
npm run admin:operations:activation:status
npm run prisma:migrate:deploy
npm run prisma:validate
npm run prisma:generate
npm run admin:operations:activation:status
```

Run focused Admin suites and read-only smoke queries. Record only sanitized target identity, names/statuses, fingerprints, and pass/fail evidence. The `finally` block covers normal completion and catchable command failures/cancellation, while the next run's mandatory startup orphan check covers cleanup that a hard termination bypassed. Inability to verify branch absence is a blocking result.

- [ ] **Step 3: Document the authorized Production deploy gate**

Immediately before Production deploy, perform a fresh trusted control-plane lookup and rerun the read-only status. Compare the commit and ordered terminal suffix to rehearsal, and verify the sanitized Production target binding. If no migration is pending, record no-op and do not deploy. Otherwise stop for fresh user authorization that names the exact newly emitted target-specific fingerprint. Only that fingerprint authorizes one `npm run prisma:migrate:deploy` child process with the Production direct URL scoped to that process. Authorization expires if the target, commit, suffix, timestamp/fingerprint, or status changes. Rerun trusted binding and status after deploy.

- [ ] **Step 4: Document read-only Production smoke**

On the exact deployed commit, verify the Admin/Reviewer/Editor/ordinary-user role matrix and account/detail/dashboard projections without invoking any mutation. Keep live goodwill disabled.

- [ ] **Step 5: Document disposable browser acceptance and teardown**

Create a second disposable branch whose name is `admin-operations-qa-` followed by the UTC creation timestamp in `YYYYMMDD-HHMMSS` form; never reuse the rehearsal branch. Wrap provisioning, approved synthetic/sanitized fixture setup, test execution, exact fixture cleanup, and branch deletion in `try/finally` for graceful exits. Apply all migrations, set the operator-expected four-field binding and opt-in, require the independently authenticated Neon lookup to return the same binding, blank SMTP, run:

```bash
npx playwright test tests/browser/admin-user-operations.spec.ts --project=desktop-chromium --project=mobile-chromium
```

In `finally`, attempt foreign-key-safe fixture cleanup, delete the branch through Neon, and verify through the trusted control plane that it is absent. Because hard termination can bypass `finally`, every resumed run performs the blocking orphan-prefix absence/recovery check before provisioning. Missing or inconclusive deletion evidence blocks completion.

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
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Expected: all pass with the single intentional unit-test skip and 104-page build.

- [ ] **Step 2: Complete reviews and the PR loop**

Obtain spec, security/operations, and quality review. Push/open PR, wait for hosted checks and a fresh CodeRabbit review, resolve valid findings, and stop at the user merge gate.

- [ ] **Step 3: Refresh exact merged main before external work**

After user merge approval, create a clean activation worktree from refreshed `origin/main`. Record its commit. Do not run operational commands from a dirty checkout.

- [ ] **Step 4: Execute the read-only Production audit**

Fetch the fresh trusted project/branch/database binding, then run the status command with the approved Production direct URL in child-scoped environment. If all four are applied, skip deployment and proceed to smoke/browser acceptance. If one contiguous terminal suffix is pending, continue. Otherwise stop and ask the user for direction.

- [ ] **Step 5: Rehearse on the disposable clone**

First perform the blocking trusted-control-plane orphan-prefix absence/recovery check. Then create, identify, migrate, validate, test, and read-only smoke the rehearsal clone exactly as Task 4 specifies inside `try/finally`. On normal completion or catchable failure/cancellation, delete it and block until trusted control-plane absence verification succeeds. A later resume repeats the startup orphan check because hard termination may have bypassed `finally`.

- [ ] **Step 6: Deploy the exact terminal pending suffix when needed**

Reconfirm the Production target through a fresh trusted control-plane lookup and rerun status. Require the unchanged ordered terminal suffix, exact commit, and a fresh target-specific authorization fingerprint. Stop for user authorization naming that exact fingerprint, then run `npm run prisma:migrate:deploy` once with the direct connection scoped only to that child command. Rerun status. Stop immediately on any unexpected output; do not attempt manual SQL repair.

- [ ] **Step 7: Run Production read-only smoke**

Verify exact deployed commit, role matrix, and safe projections. Record no account-level values.

- [ ] **Step 8: Run disposable desktop/mobile browser acceptance**

After another blocking orphan-prefix absence/recovery check, create a fresh identified QA branch distinct from the rehearsal clone, apply migrations, load only the approved synthetic/sanitized seed, set the expected binding variables and sentinel, require the independent trusted lookup, and run both projects inside `try/finally`. On normal completion or catchable failure/cancellation, verify fixture cleanup, delete the branch, and block until the trusted control plane verifies absence; a resumed run must assume hard termination may have bypassed cleanup and repeat the startup check.

- [ ] **Step 9: Commit sanitized evidence**

```bash
git add docs/project-state.md docs/project-log.md docs/aegis/work/2026-08-11-admin-operations-production-activation/20-checkpoint.md docs/aegis/work/2026-08-11-admin-operations-production-activation/90-evidence.md
git commit -m "docs: record admin operations activation evidence"
```

Open a documentation-only PR for the executed evidence if the implementation PR is already merged; complete hosted checks and stop at the user merge gate.
