# Password Reset Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every self-service and Admin-requested password-reset link use one atomic consumption path that changes the password once, consumes all outstanding links, and invalidates existing authentication sessions.

**Architecture:** Keep request parsing and raw-token hashing in the existing route, then ask the reset-confirmation owner for a lightweight boolean eligibility read using the token hash and one captured time. Only an eligible request pays the password-hashing cost, still outside the transaction. The same owner then uses the repository's bounded Serializable transaction owner, claims the submitted token with an authoritative compare-and-set update, and performs credential replacement, sibling-token consumption, JWT-version increment, and compatibility Session deletion in one transaction.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 7, PostgreSQL/Neon, Auth.js JWT session versioning, Node test runner.

## Global Constraints

- Applies identically to ordinary self-service links and links issued by `sendAdminPasswordReset`.
- Hash the raw token first, perform the read-only non-authoritative eligibility gate, and return the existing generic invalid-link response before password hashing when the gate fails.
- Hash the password only after eligibility passes and before the database transaction; no expensive password hashing may run while a transaction is open.
- Pass the same token hash and captured time through the eligibility lookup and confirmation service. The transaction's compare-and-set remains the sole claim authority if state changes after the read.
- Return the existing generic expired-or-used response for missing, expired, consumed, or concurrently lost tokens.
- Increment `User.authSessionVersion` exactly once on a successful password replacement.
- Delete Prisma `Session` rows only as compatibility cleanup; never present that count as active JWTs or people signed out.
- Create no new `AdminAction`, `UserAccountActivity`, or `AdminEmailIntent` when a link is consumed.
- Use the established bounded Serializable retry owner; keep database-only work inside its callback.
- Extend that one retry owner only for Prisma adapter `P2039` errors whose exact `meta.driverAdapterError.cause.originalCode` is `40P01` or `55P03`; never retry other adapter shapes or message text.
- Preserve PHI/privacy boundaries and never log raw reset tokens, hashes, passwords, emails, or database rows.
- Follow strict RED/GREEN development and stop at the user-controlled merge gate.
- The approved 2026-08-12 final-review fix wave stops after a verified local commit; pushing, PR creation, GitHub mutation, live database access, and email delivery are outside that wave.

---

## File Structure

- Create `lib/password-reset-confirmation.ts`: sole transaction owner for reset-token consumption and authentication invalidation.
- Modify `app/api/account/password-reset/confirm/route.ts`: parse/hash, call the service, and preserve the public response contract.
- Create `tests/password-reset-confirmation.test.mjs`: faithful transaction, rollback, and concurrency coverage.
- Create `tests/password-reset-confirm-route.test.mjs`: compiled route contract proving both reset sources converge on the shared service.
- Modify `tests/auth-session-version.test.mjs`: retain the JWT-observation boundary and connect it to reset consumption.
- Modify `docs/project-state.md`, `docs/project-log.md`, `docs/wiki/admin-user-operations.md`, and `docs/wiki/release-checklist.md`: record the completed security behavior and operational verification.

### Task 1: Define the atomic reset-consumption contract

**Files:**
- Create: `tests/password-reset-confirmation.test.mjs`
- Create: `lib/password-reset-confirmation.ts`

**Interfaces:**
- Consumes: `runCommerceTransaction(prismaClient, callback)` from `lib/commerce/transactions.ts`.
- Produces:

```ts
export async function isPasswordResetTokenEligible(input: {
  prismaClient: Pick<PrismaClient, "passwordResetToken">
  tokenHash: string
  now?: Date
}): Promise<boolean>

export type ConfirmPasswordResetInput = {
  prismaClient: Pick<PrismaClient, "$transaction">
  tokenHash: string
  passwordHash: string
  now?: Date
}

export type ConfirmPasswordResetResult =
  | { status: "UPDATED" }
  | { status: "INVALID" }

export async function confirmPasswordReset(
  input: ConfirmPasswordResetInput,
): Promise<ConfirmPasswordResetResult>
```

- [ ] **Step 1: Write the focused failing tests for input and invalid-token behavior**

Add tests that reject blank/oversized hashes before opening a transaction, reject an invalid `now`, return `{ status: "INVALID" }` for missing/expired/consumed tokens, and assert no credential, token, version, or Session mutation occurred.

```js
await assert.rejects(
  () => confirmPasswordReset({ prismaClient: database, tokenHash: "", passwordHash: "hash", now }),
  /valid reset token hash/,
)
assert.equal(database.transactionAttempts, 0)

assert.deepEqual(await confirmPasswordReset({
  prismaClient: database,
  tokenHash: "missing-token-hash",
  passwordHash: "new-password-hash",
  now,
}), { status: "INVALID" })
assert.deepEqual(database.state, before)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/password-reset-confirmation.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/password-reset-confirmation.ts`.

- [ ] **Step 3: Add the typed service shell and pre-transaction validation**

Implement finite-Date capture plus bounded opaque-hash validation. Add JSDoc stating that the return value deliberately reveals no user or token state and that every successful effect is committed atomically.

```ts
function captureNow(value?: Date): Date {
  const now = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(now.getTime())) throw new Error("Provide a valid reset time.")
  return now
}

function validateOpaqueHash(value: string, label: string): void {
  if (typeof value !== "string" || value.length < 1 || value.length > 512) {
    throw new Error(`Provide a valid ${label}.`)
  }
}
```

- [ ] **Step 4: Implement the minimal invalid-token transaction**

Implement `isPasswordResetTokenEligible` in this same owner as a read-only lookup using `tokenHash`, `consumedAt: null`, `expiresAt: { gt: now }`, and `select: { id: true }`. Validate the opaque hash and time before querying, and return only a boolean. Separately, use `runCommerceTransaction` in `confirmPasswordReset`, load only `id` and `userId`, and return `INVALID` without mutation if the token is absent; the compare-and-set claim in Task 2 remains authoritative for expiration, consumption, and races.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/password-reset-confirmation.test.mjs`

Expected: PASS for the validation and non-mutating invalid-token cases.

- [ ] **Step 6: Commit the domain contract**

```bash
git add lib/password-reset-confirmation.ts tests/password-reset-confirmation.test.mjs
git commit -m "test: define atomic password reset consumption"
```

### Task 2: Make successful consumption atomic and race-safe

**Files:**
- Modify: `lib/password-reset-confirmation.ts`
- Modify: `lib/commerce/transactions.ts`
- Modify: `tests/password-reset-confirmation.test.mjs`
- Modify: `tests/commerce-core.test.mjs`

**Interfaces:**
- Consumes: the Task 1 `confirmPasswordReset` signature.
- Produces: one successful mutation bundle or the same generic `INVALID` result.

- [ ] **Step 1: Add RED tests for the complete successful bundle**

Model two outstanding tokens, an existing credential, `authSessionVersion: 4`, and two compatibility Session rows. Assert:

```js
assert.deepEqual(result, { status: "UPDATED" })
assert.equal(state.passwordCredential.passwordHash, "new-password-hash")
assert.equal(state.passwordResetTokens.every((token) => token.consumedAt?.getTime() === now.getTime()), true)
assert.equal(state.user.authSessionVersion, 5)
assert.equal(state.sessions.length, 0)
assert.equal(state.adminActions.length, 0)
assert.equal(state.activities.length, 0)
assert.equal(state.emailIntents.length, 0)
```

Add a rollback test that throws on the final Session deletion and proves the old password, every token, the version, and Session rows are restored.

- [ ] **Step 2: Add RED tests for same-token and different-token concurrency**

The fake must retain a fixed Serializable snapshot and enforce committed token/version state. Gate two calls at the claim boundary. Retain each result together with its contender, identify the sole `UPDATED` result, and assert that the committed password hash belongs to that contender. Assert exactly one `UPDATED`, one `INVALID`, one version increment, and all links consumed without assuming contender A wins.

```js
assert.deepEqual(resultsByContender.map(({ result }) => result.status).sort(), ["INVALID", "UPDATED"])
const [updated] = resultsByContender.filter(({ result }) => result.status === "UPDATED")
assert.equal(database.state.passwordCredential.passwordHash, updated.contender.passwordHash)
assert.equal(database.state.user.authSessionVersion, 5)
assert.equal(database.state.passwordResetTokens.every((token) => token.consumedAt), true)
```

Repeat with two different token hashes and different password hashes; correlate the committed password to whichever contender returned `UPDATED` rather than hard-coding a winner.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/password-reset-confirmation.test.mjs`

Expected: FAIL because successful consumption does not yet update the complete bundle and concurrent losers can still overwrite state.

- [ ] **Step 4: Implement the compare-and-set claim and atomic bundle**

Inside the Serializable callback:

```ts
const token = await tx.passwordResetToken.findUnique({
  where: { tokenHash: input.tokenHash },
  select: { id: true, userId: true },
})
if (!token) return { status: "INVALID" } as const

const claim = await tx.passwordResetToken.updateMany({
  where: {
    id: token.id,
    userId: token.userId,
    consumedAt: null,
    expiresAt: { gt: now },
  },
  data: { consumedAt: now },
})
if (claim.count !== 1) return { status: "INVALID" } as const
```

Then, in the same callback, upsert `PasswordCredential`, consume remaining unconsumed rows for `userId`, increment `authSessionVersion`, and delete `Session` rows. Do not return the Session delete count.

- [ ] **Step 5: Preserve and extend bounded Serializable retries**

Keep `runCommerceTransaction` as the single shared retry owner and keep database-only work in its callback. Preserve top-level `P2034`, `40P01`, and `55P03` retries. Also recognize only top-level `P2039` with exact nested `meta.driverAdapterError.cause.originalCode` `40P01` or `55P03`; wrong, missing, malformed, message-only, uniqueness, and other adapter cases remain terminal. The different-token contention regression must exercise this adapter-shaped path, while the existing top-level `P2034` regression remains green. Maximum total attempts stays capped at three with full jitter.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/password-reset-confirmation.test.mjs`

Expected: all success, rollback, retry, and concurrency cases PASS.

- [ ] **Step 7: Commit the atomic implementation**

```bash
git add lib/password-reset-confirmation.ts tests/password-reset-confirmation.test.mjs
git commit -m "fix: consume password resets atomically"
```

### Task 3: Route both reset sources through the shared owner

**Files:**
- Modify: `app/api/account/password-reset/confirm/route.ts`
- Create: `tests/password-reset-confirm-route.test.mjs`
- Modify: `tests/auth-security.test.mjs`
- Modify: `tests/admin-security-service.test.mjs`

**Interfaces:**
- Consumes: `isPasswordResetTokenEligible({ prismaClient, tokenHash, now })` followed, only when eligible, by `confirmPasswordReset({ prismaClient, tokenHash, passwordHash, now })`.
- Produces: unchanged public JSON/status messages.

- [ ] **Step 1: Write a compiled route RED test**

Compile the route with doubles for `NextResponse`, `hashToken`, `isPasswordResetTokenEligible`, `hashPassword`, `confirmPasswordReset`, and Prisma. Prove request validation happens first; eligible flow orders raw-token hashing, eligibility, password hashing, and confirmation; and the route never writes reset state directly. Missing, expired, and consumed eligibility failures must not call `hashPassword`, `confirmPasswordReset`, or any direct mutation API.

```js
assert.deepEqual(calls, [
  ["hashToken", "raw-reset-token"],
  ["isPasswordResetTokenEligible", { tokenHash: "token-hash" }],
  ["hashPassword", "a-long-new-password"],
  ["confirmPasswordReset", { tokenHash: "token-hash", passwordHash: "password-hash" }],
])
assert.doesNotMatch(routeSource, /passwordResetToken\.(findUnique|update)/)
assert.doesNotMatch(routeSource, /passwordCredential\.upsert/)
```

Assert `INVALID` maps to status 400 and the exact current message, while `UPDATED` maps to the current success message.

- [ ] **Step 2: Run the route test and verify RED**

Run: `node --test tests/password-reset-confirm-route.test.mjs`

Expected: FAIL because the route still owns direct Prisma mutations.

- [ ] **Step 3: Replace direct route writes with the service**

Keep request shape validation first, then hash the token, capture one time, perform the non-authoritative read-only gate, and only then hash the password before invoking the transactional service:

```ts
const tokenHash = hashToken(token)
const now = new Date()
const eligible = await isPasswordResetTokenEligible({ prismaClient: prisma, tokenHash, now })
if (!eligible) {
  return NextResponse.json(
    { message: "This reset link is expired or has already been used." },
    { status: 400 },
  )
}
const passwordHash = await hashPassword(password)
const result = await confirmPasswordReset({ prismaClient: prisma, tokenHash, passwordHash, now })
if (result.status === "INVALID") {
  return NextResponse.json(
    { message: "This reset link is expired or has already been used." },
    { status: 400 },
  )
}
```

- [ ] **Step 4: Prove self-service and Admin-issued tokens share the same schema/consumer**

In the security tests, retain Admin issuance through `passwordResetToken.create`; in the route test, assert the consumer accepts only `tokenHash` and does not branch on issuer, email-intent kind, or Admin evidence.

- [ ] **Step 5: Run affected tests and verify GREEN**

Run:

```bash
node --test tests/password-reset-confirm-route.test.mjs tests/password-reset-confirmation.test.mjs tests/auth-security.test.mjs tests/admin-security-service.test.mjs
```

Expected: PASS with unchanged issuance and public-response behavior.

- [ ] **Step 6: Commit route integration**

```bash
git add app/api/account/password-reset/confirm/route.ts tests/password-reset-confirm-route.test.mjs tests/auth-security.test.mjs tests/admin-security-service.test.mjs
git commit -m "fix: route reset links through atomic consumption"
```

### Task 4: Verify authentication invalidation semantics

**Files:**
- Modify: `tests/auth-session-version.test.mjs`
- Modify: `tests/password-reset-confirmation.test.mjs`

**Interfaces:**
- Consumes: `decideAuthSessionVersion` and the successful reset result.
- Produces: regression evidence that old JWTs fail on the next successful DB-backed Auth.js refresh.

- [ ] **Step 1: Add the behavior-level regression**

Start with a token version equal to the pre-reset database version, execute reset consumption, then feed the incremented version and old token version to `decideAuthSessionVersion`:

```js
const decision = decideAuthSessionVersion({
  currentVersion: database.state.user.authSessionVersion,
  tokenVersion: 4,
  isSignIn: false,
})
assert.deepEqual(decision, { status: "reject" })
```

Assert the reset result exposes no Session count.

- [ ] **Step 2: Run authentication tests and verify RED or meaningful coverage gap**

Run: `node --test tests/auth-session-version.test.mjs tests/password-reset-confirmation.test.mjs`

Expected before the assertion is connected: FAIL because reset-consumption evidence is not supplied to the Auth.js decision test.

- [ ] **Step 3: Complete the shared fixture or exported test helper needed by the regression**

Keep production Auth.js behavior unchanged. Reuse the compiled-module harness already used by `tests/auth-session-version.test.mjs`; do not export the nested Auth.js callback solely for testing.

- [ ] **Step 4: Run the authentication tests and verify GREEN**

Run: `node --test tests/auth-session-version.test.mjs tests/password-reset-confirmation.test.mjs`

Expected: PASS, including existing legacy-version and missing-account cases.

- [ ] **Step 5: Commit authentication evidence**

```bash
git add tests/auth-session-version.test.mjs tests/password-reset-confirmation.test.mjs
git commit -m "test: prove reset-driven JWT invalidation"
```

### Task 5: Document and validate the branch

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify: `docs/wiki/admin-user-operations.md`
- Modify: `docs/wiki/release-checklist.md`

**Interfaces:**
- Consumes: terminal validation evidence from Tasks 1-4.
- Produces: canonical, non-secret operational truth.

- [ ] **Step 1: Update canonical documentation**

Record that successful consumption atomically changes the password, consumes all links, increments the JWT version, and deletes compatibility sessions. State explicitly that no second Admin evidence bundle is created and that the Session delete count is not an active-JWT count.

- [ ] **Step 2: Run focused and adjacent validation**

```bash
node --test tests/password-reset-confirmation.test.mjs tests/password-reset-confirm-route.test.mjs tests/commerce-core.test.mjs tests/auth-security.test.mjs tests/auth-session-version.test.mjs tests/admin-security-service.test.mjs tests/admin-security-ui.test.mjs
npm run typecheck
npm run lint
```

Expected: every command PASS; lint may print only the repository's existing Babel large-file note.

- [ ] **Step 3: Run comprehensive validation**

```bash
npm run test
npm run build
git diff --check
```

Expected: full unit suite PASS with the single intentional skip, 104-page Production build PASS, and no whitespace errors.

- [ ] **Step 4: Request two-stage review**

Request focused spec review against `docs/superpowers/specs/2026-08-11-admin-operations-closure-design.md`, then quality/security review. Apply only verified current findings with new RED/GREEN coverage.

- [ ] **Step 5: Commit documentation and terminal evidence**

```bash
git add docs/project-state.md docs/project-log.md docs/wiki/admin-user-operations.md docs/wiki/release-checklist.md
git commit -m "docs: record password reset integrity"
```

- [ ] **Step 6: Run the PR loop**

Push a `codex/` branch, open a ready PR describing the atomic transaction and validation evidence, wait for QA/CodeQL/Vercel/CodeRabbit, verify every finding against the exact head, fix valid issues, resolve threads, obtain a fresh clean review, and stop at the user merge gate.
