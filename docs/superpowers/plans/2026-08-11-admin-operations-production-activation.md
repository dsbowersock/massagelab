# Admin Operations Production Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the four Admin-era migrations on a disposable Neon clone, deploy only an exact expected pending subset to Production when necessary, and complete read-only Production smoke plus desktop/mobile disposable browser acceptance.

**Architecture:** Add a small fail-closed activation contract that parses sanitized Prisma migration status and validates direct-versus-pooled Neon connection roles without exposing URLs. Use existing Prisma deploy commands for schema mutation, existing Playwright fixture owners for browser acceptance, and an explicit disposable-database identity token so the mutation sentinel cannot be enabled from a connection string alone.

**Tech Stack:** Prisma 7 migrations, Neon Postgres branches, Node scripts/tests, Next.js, Playwright Chromium, GitHub/Vercel deployment checks.

## Global Constraints

- Expected migration inventory is exactly:
  - `20260808090000_admin_authorization_audit_foundation`
  - `20260808093000_admin_jwt_session_version`
  - `20260808100000_admin_temporary_feature_access`
  - `20260808110000_admin_billing_goodwill`
- Use a direct/unpooled Neon connection for `prisma migrate status` and `prisma migrate deploy`; never use the pooled runtime connection for migration work.
- Migration deployment is authorized only after identity, pending-set, and disposable rehearsal gates pass.
- Stop for any pending migration outside the exact four-name allowlist, ambiguous database identity, failed rehearsal, connection-role mismatch, or changed Production pending set.
- Never run `prisma migrate dev`, `prisma migrate reset`, seeds, destructive SQL, Prisma Studio, or broad exports.
- Keep `ADMIN_BILLING_GOODWILL_LIVE_ENABLED` absent or false; perform no Production Admin mutation, email retry, or Stripe credit.
- Browser QA requires a separately identified disposable database, exact opt-in, Playwright-owned SMTP-blank server, desktop/mobile Chromium, exact cleanup, deletion, and absence verification.
- Evidence may contain migration names, commit IDs, branch/project identifiers, pass/fail state, and timestamps; it may not contain credentials, connection strings, database rows, emails, or provider IDs.
- Follow Neon guidance: create a short-lived branch from the selected parent, rehearse there, and delete it after verification.

---

## File Structure

- Create `lib/admin/operations-activation-contract.ts`: pure expected-inventory, connection-role, pending-set, and QA-identity validators.
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

export function validateDirectNeonMigrationUrl(value: string): {
  hostname: string
  database: string
}

export function validateAdminOperationsPendingMigrations(
  pending: readonly string[],
): readonly string[]

export function validateDisposableAdminQaIdentity(value: {
  databaseUrl: string
  optIn: string | undefined
  databaseId: string | undefined
  expectedDatabaseId: string | undefined
  vercelEnv: string | undefined
}): { databaseId: string }
```

- [ ] **Step 1: Write RED tests for exact migration inventory and pending subsets**

Assert all four exact names and ordering. Accept `[]` and any order-preserving subset. Reject unknown, duplicate, malformed, or pre-Admin pending names.

```js
assert.deepEqual(validateAdminOperationsPendingMigrations([
  "20260808093000_admin_jwt_session_version",
  "20260808100000_admin_temporary_feature_access",
]), [
  "20260808093000_admin_jwt_session_version",
  "20260808100000_admin_temporary_feature_access",
])
assert.throws(
  () => validateAdminOperationsPendingMigrations(["20260718120000_background_commerce_foundation"]),
  /unexpected pending migration/,
)
```

- [ ] **Step 2: Write RED tests for direct Neon and disposable identity gates**

Require `postgres:`/`postgresql:`, `.neon.tech`, and a hostname without `-pooler`. Reject missing database names, query-log output, Production QA, mismatched database IDs, missing opt-in, and an identity not prefixed `admin-operations-qa-`.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: FAIL with missing contract module.

- [ ] **Step 4: Implement the pure validators**

Never return usernames, passwords, ports, or query parameters from the URL parser. Use exact constant-time string equality where practical for database IDs, and require `VERCEL_ENV !== "production"` for the disposable QA identity.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: PASS for exact-subset, direct-host, and disposable-identity cases.

- [ ] **Step 6: Commit the activation contract**

```bash
git add lib/admin/operations-activation-contract.ts tests/admin-operations-activation.test.mjs
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
  - `ADMIN_OPERATIONS_DATABASE_ID` and `ADMIN_OPERATIONS_EXPECTED_DATABASE_ID` for identity binding.
  - `npx prisma migrate status` output.
- Produces one JSON object containing only `databaseId`, `commit`, `expectedMigrations`, `pendingMigrations`, `status`, and `checkedAt`.

- [ ] **Step 1: Add RED tests for the script boundary**

Compile/import the script helpers without executing Prisma. Assert it rejects identity mismatch before spawning, uses `DIRECT_URL` only for Prisma, redacts URLs from stdout/stderr, and parses only migration-name lines matching `^\d{14}_[a-z0-9_]+$`.

- [ ] **Step 2: Run the script test and verify RED**

Run: `node --test tests/admin-operations-activation.test.mjs`

Expected: FAIL because the script and npm command do not exist.

- [ ] **Step 3: Implement read-only `status` mode**

Expose pure helpers for tests, and run only when invoked directly:

```js
const mode = process.argv[2]
if (mode !== "status") throw new Error("Use the read-only status mode.")

const childEnv = {
  ...process.env,
  DATABASE_URL: process.env.ADMIN_OPERATIONS_MIGRATION_DIRECT_URL,
  DIRECT_URL: process.env.ADMIN_OPERATIONS_MIGRATION_DIRECT_URL,
}
```

Call the local Prisma CLI with `migrate status`, parse the result, validate the exact pending subset, and print sanitized JSON. Prisma may exit nonzero when migrations are unapplied: accept that only when output unambiguously lists unapplied migrations and every parsed name is allowlisted; reject connection, divergence, failed-migration, missing-table, or unparseable output. Do not implement a deploy subcommand; deployment remains an explicit operator command after rehearsal review.

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
- Modify: `lib/admin/browser-qa-authorization.ts`
- Modify: `tests/admin-user-operations-fixture.test.mjs`
- Modify: `tests/browser/admin-user-operations-fixture.ts`
- Modify: `tests/browser/admin-user-operations.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/browser-qa-harness.test.mjs`

**Interfaces:**
- Requires `MASSAGELAB_BROWSER_QA_DATABASE=1`.
- Requires exact equality between `MASSAGELAB_BROWSER_QA_DATABASE_ID` and `MASSAGELAB_BROWSER_QA_EXPECTED_DATABASE_ID`.
- Requires the ID prefix `admin-operations-qa-` and denies Vercel Production.

- [ ] **Step 1: Add RED authorization tests**

Replace the URL-plus-boolean-only expectation with exact identity cases. Assert mutation remains denied when either ID is missing, IDs differ, the ID lacks the prefix, or `VERCEL_ENV=production`.

- [ ] **Step 2: Run fixture tests and verify RED**

Run: `node --test tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs`

Expected: FAIL because the current guard accepts only URL plus opt-in.

- [ ] **Step 3: Reuse the pure activation validator**

Call `validateDisposableAdminQaIdentity` from both `hasBrowserAdminFixtureQaAuthorization` and `requireBrowserAdminFixtureQaAuthorization`. The boolean helper catches validation errors and returns false; the throwing helper keeps a static safe message.

- [ ] **Step 4: Require exact desktop and mobile projects**

In the browser spec, assert the project name is one of the configured Admin projects before provisioning. Update `playwright.config.ts` so the documented command selects both Chromium viewports and always disables server reuse for any invocation that can select the Admin spec.

- [ ] **Step 5: Preserve SMTP and billing mutation guards**

Keep the Playwright-owned server requirement, blank SMTP environment, presentation-only billing client, server-action QA guard, zero form submissions, and zero matching POST requests. Add source-contract assertions that these remain active with the new identity variables.

- [ ] **Step 6: Run focused browser harness tests and verify GREEN**

```bash
node --test tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs tests/admin-billing-goodwill-ui.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit the identity guard**

```bash
git add lib/admin/browser-qa-authorization.ts tests/admin-user-operations-fixture.test.mjs tests/browser/admin-user-operations-fixture.ts tests/browser/admin-user-operations.spec.ts playwright.config.ts tests/browser-qa-harness.test.mjs
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

Specify that the operator obtains the Production direct connection through the approved secret channel, binds the expected database ID, runs:

```powershell
$env:ADMIN_OPERATIONS_MIGRATION_DIRECT_URL = $approvedProductionDirectUrl
$env:ADMIN_OPERATIONS_DATABASE_ID = $sanitizedProductionDatabaseId
$env:ADMIN_OPERATIONS_EXPECTED_DATABASE_ID = $sanitizedProductionDatabaseId
npm run admin:operations:activation:status
```

The document must instruct the operator not to paste values into evidence and to stop unless the pending set is an exact subset of the four migrations.

- [ ] **Step 2: Document disposable Neon rehearsal**

Use the Neon console/approved API to create a branch whose name is `admin-operations-migration-rehearsal-` followed by the UTC creation timestamp in `YYYYMMDD-HHMMSS` form. Follow Neon's official [branching workflow](https://neon.com/docs/introduction/branching) and use the direct connection described by the official [connection guidance](https://neon.com/docs/connect/connection-errors). Bind its direct endpoint to `DATABASE_URL` and `DIRECT_URL` only for the migration process, then run:

```bash
npm run admin:operations:activation:status
npm run prisma:migrate:deploy
npm run prisma:validate
npm run prisma:generate
npm run admin:operations:activation:status
```

Run focused Admin suites and read-only smoke queries. Record only names/statuses and pass/fail evidence.

- [ ] **Step 3: Document the authorized Production deploy gate**

Immediately before Production deploy, rerun the read-only status and compare it to rehearsal. If unchanged and exact, run `npm run prisma:migrate:deploy` with the Production direct URL, then rerun status. If no migration is pending, record no-op and do not deploy.

- [ ] **Step 4: Document read-only Production smoke**

On the exact deployed commit, verify the Admin/Reviewer/Editor/ordinary-user role matrix and account/detail/dashboard projections without invoking any mutation. Keep live goodwill disabled.

- [ ] **Step 5: Document disposable browser acceptance and teardown**

Create a second disposable branch whose name is `admin-operations-qa-` followed by the UTC creation timestamp in `YYYYMMDD-HHMMSS` form, apply all migrations, set the exact identity pair and opt-in, blank SMTP, run:

```bash
npx playwright test tests/browser/admin-user-operations.spec.ts --project=desktop-chromium --project=mobile-chromium
```

After exact fixture cleanup, delete the branch through Neon and verify it is absent before marking evidence complete.

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

Run the status command with the approved Production direct URL. If all four are applied, skip deployment and proceed to smoke/browser acceptance. If an exact subset is pending, continue. Otherwise stop and ask the user for direction.

- [ ] **Step 5: Rehearse on the disposable clone**

Create, identify, migrate, validate, test, and read-only smoke the rehearsal clone exactly as Task 4 specifies. Delete it after evidence is captured, and verify absence.

- [ ] **Step 6: Deploy the exact pending subset when needed**

Reconfirm Production identity and unchanged pending set. Run `npm run prisma:migrate:deploy` once using the direct connection. Rerun status. Stop immediately on any unexpected output; do not attempt manual SQL repair.

- [ ] **Step 7: Run Production read-only smoke**

Verify exact deployed commit, role matrix, and safe projections. Record no account-level values.

- [ ] **Step 8: Run disposable desktop/mobile browser acceptance**

Create a fresh identified QA branch, apply migrations, set exact identity variables and sentinel, run both projects, verify cleanup, delete branch, and verify absence.

- [ ] **Step 9: Commit sanitized evidence**

```bash
git add docs/project-state.md docs/project-log.md docs/aegis/work/2026-08-11-admin-operations-production-activation/20-checkpoint.md docs/aegis/work/2026-08-11-admin-operations-production-activation/90-evidence.md
git commit -m "docs: record admin operations activation evidence"
```

Open a documentation-only PR for the executed evidence if the implementation PR is already merged; complete hosted checks and stop at the user merge gate.
