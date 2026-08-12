# Billing Goodwill Reconciliation Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify an exact Stripe goodwill transaction from its immutable transaction evidence even when later Customer balance activity changed the current balance.

**Architecture:** Keep the existing PREPARED/APPLIED/VERIFIED state machine and original idempotency key. Change authoritative readback so the transaction's own non-positive `ending_balance` becomes the persisted historical ending credit, return the separately observed current Customer credit when available, and recheck full-Admin authority immediately before any new provider create.

**Tech Stack:** TypeScript, Prisma 7, Stripe Customer Balance Transactions, Next.js server actions, React 19 action state, Node test runner.

## Global Constraints

- Do not broaden target eligibility, the $0.01-$100.00 range, USD-only rule, live-mode gate, confirmation contract, or mutation entry points.
- Validate exact transaction ID, Customer, mode, USD currency, exact negative amount, local operation, and idempotency evidence.
- Treat `transaction.ending_balance` as historical balance immediately after that exact transaction; do not derive it from the earlier preview.
- Treat a refreshed Customer balance as a separate current observation and never require it to equal historical evidence during reconciliation.
- Do not invent a replacement operation, transaction, or Stripe idempotency key.
- Preserve unresolved state for ambiguous or mismatched provider evidence.
- Recheck full-Admin database authority immediately before `customers.createBalanceTransaction`.
- Never log Stripe objects, IDs in operator-facing URLs, emails, raw errors, or payment data.
- Follow Stripe's idempotency boundary: the existing conservative 23h55m reissue margin remains unchanged.
- Stop at the user-controlled merge gate; any live credit remains separately authorized by exact account and amount.

---

## File Structure

- Modify `lib/admin/billing-goodwill.ts`: authoritative historical/current balance model and pre-create authority gate.
- Modify `app/admin/users/[userId]/billing-actions.ts`: truthful historical/current result copy.
- Modify `app/admin/users/[userId]/billing-goodwill-form.tsx`: labels for current preview versus historical verified result.
- Modify `tests/admin-billing-goodwill.test.mjs`: provider readback, replay, concurrency, and authority-revocation tests.
- Modify `tests/admin-billing-goodwill-ui.test.mjs`: result shape and copy contracts.
- Modify `tests/admin-security-ui.test.mjs`: keep the compiled detail-page dependency double faithful.
- Modify canonical state/log/Admin runbook/release checklist.

### Task 1: Separate historical and current credit evidence

**Files:**
- Modify: `lib/admin/billing-goodwill.ts`
- Modify: `tests/admin-billing-goodwill.test.mjs`

**Interfaces:**
- Changes `BillingGoodwillResult` to:

```ts
export type BillingGoodwillResult = {
  operationId: string
  status: "VERIFIED" | "RECONCILIATION_REQUIRED" | "FAILED_BEFORE_MUTATION"
  amountCents: number
  endingCreditCents: number | null
  currentCreditCents: number | null
  replayed: boolean
  emailIntentId: string | null
}
```

- Produces an internal validated readback:

```ts
type ValidatedGoodwillReadback = {
  historicalEndingCreditCents: number
  currentCreditCents: number
}
```

- [ ] **Step 1: Add RED tests for intervening Customer activity**

Create an operation prepared at 500 cents, credit amount 300, exact transaction `ending_balance: -650`, and refreshed Customer `balance: -125`. The exact transaction must verify despite both values differing from the preview-derived 800.

```js
assert.deepEqual(result, {
  operationId: "billing-op-1",
  status: "VERIFIED",
  amountCents: 300,
  endingCreditCents: 650,
  currentCreditCents: 125,
  replayed: true,
  emailIntentId: "intent-1",
})
assert.equal(fixture.state.operations.get("billing-op-1").endingBalanceCents, 650)
```

Add a first-settlement case in which the provider transaction and refreshed Customer already differ because an intervening provider event occurred between create and readback; the exact transaction must still verify.

- [ ] **Step 2: Add RED mismatch tests**

Use a table for wrong transaction ID, Customer, positive ending balance, unsafe ending balance, wrong currency, wrong amount, and wrong mode. Assert each remains unresolved, creates no replacement transaction, and records only a safe failure code.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/admin-billing-goodwill.test.mjs`

Expected: FAIL because `validateAuthoritativeReadback` still requires `abs(ending_balance) === starting + amount` and the result lacks `currentCreditCents`.

- [ ] **Step 4: Return exact transaction-time and current observations**

Replace preview-derived validation with:

```ts
const historicalEndingCreditCents = Math.abs(transaction.ending_balance)
const currentCreditCents = Math.abs(parseMutationCustomer(
  customer,
  operation.stripeCustomerId,
  expectedLivemode,
).balance)

return { historicalEndingCreditCents, currentCreditCents }
```

Retain `transaction.ending_balance <= 0`, safe cents, exact ID/Customer/USD/amount/mode validation. Remove the `historicalReconciliation` boolean because neither initial nor replay validation may assume no intervening provider event.

- [ ] **Step 5: Persist historical evidence and return current evidence**

Pass `historicalEndingCreditCents` into `finalizeVerifiedGoodwill`. Persist it in the existing `endingBalanceCents` field and the immutable Admin bundle. Add `currentCreditCents` to every result constructor; use `null` when no fresh provider read occurred, including local VERIFIED replay.

- [ ] **Step 6: Relax verified replay coherence without weakening it**

Update `assertCoherentVerifiedOperation` so it requires a valid persisted transaction ID, a non-null safe nonnegative `endingBalanceCents`, and `failureCode === null`; it must no longer compare against `startingBalanceCents + amountCents`.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `node --test tests/admin-billing-goodwill.test.mjs`

Expected: all exact readback, mismatch, replay, retry-window, and bundle tests PASS.

- [ ] **Step 8: Commit the readback correction**

```bash
git add lib/admin/billing-goodwill.ts tests/admin-billing-goodwill.test.mjs
git commit -m "fix: reconcile exact Stripe goodwill evidence"
```

### Task 2: Recheck Admin authority at the provider boundary

**Files:**
- Modify: `lib/admin/billing-goodwill.ts`
- Modify: `tests/admin-billing-goodwill.test.mjs`

**Interfaces:**
- Consumes: existing `requireFullAdminUser({ prismaClient, sessionUserId })`.
- Produces: a final database-backed authorization check immediately before create.

- [ ] **Step 1: Add a gated RED regression**

Prepare the operation as an authorized Admin, pause after Customer/subscription reads and the advancing-clock check, revoke the actor's Admin role in the fake database, then release the gate. Assert:

```js
await assert.rejects(operationPromise, /full administrator access/i)
assert.equal(stripeCalls.createBalanceTransaction, 0)
assert.equal(fixture.state.operations.get("billing-op-1").status, "PREPARED")
```

Also prove that a revoked actor may read/reconcile a known transaction only if the existing reconciliation contract permits a different freshly authorized Admin; the original revoked actor may not create.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/admin-billing-goodwill.test.mjs --test-name-pattern="revoked before provider creation"`

Expected: FAIL because the last authority load currently occurs during preparation.

- [ ] **Step 3: Add the final authority check**

Immediately after the final retry-window clock read and before `createBalanceTransaction`:

```ts
await requireFullAdminUser({
  prismaClient: input.prismaClient,
  sessionUserId: input.actorUserId,
})
```

Document why this read is intentionally outside the durable preparation transaction: it closes the authority-revocation window at the irreversible provider boundary.

- [ ] **Step 4: Handle a denied boundary without provider ambiguity**

If the fresh authority check throws before create, persist `FAILED_BEFORE_MUTATION` with a static safe code such as `ADMIN_AUTHORITY_REVOKED` only when this invocation is the never-attempted PREPARED creator. Preserve `RECONCILIATION_REQUIRED` for replay/possibly-committed states. Do not expose the thrown error.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-billing-goodwill.test.mjs`

Expected: PASS with zero provider mutation after revocation and unchanged concurrent/replay semantics.

- [ ] **Step 6: Commit the authority gate**

```bash
git add lib/admin/billing-goodwill.ts tests/admin-billing-goodwill.test.mjs
git commit -m "fix: recheck admin authority before Stripe mutation"
```

### Task 3: Present historical and current balances truthfully

**Files:**
- Modify: `app/admin/users/[userId]/billing-actions.ts`
- Modify: `app/admin/users/[userId]/billing-goodwill-form.tsx`
- Modify: `tests/admin-billing-goodwill-ui.test.mjs`
- Modify: `tests/admin-security-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1's `BillingGoodwillResult.currentCreditCents`.
- Produces: operator copy that distinguishes transaction-time from current balance.

- [ ] **Step 1: Add RED action-copy tests**

For `endingCreditCents: 650` and `currentCreditCents: 125`, require:

```js
assert.match(message, /immediately after this credit was \$6\.50/)
assert.match(message, /current Stripe credit is \$1\.25/)
assert.doesNotMatch(message, /resulting Stripe credit is now/i)
```

For local VERIFIED replay with `currentCreditCents: null`, require historical wording only and no current-balance claim.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test tests/admin-billing-goodwill-ui.test.mjs tests/admin-security-ui.test.mjs`

Expected: FAIL because `presentGoodwillResult` still labels historical evidence as the resulting Stripe credit.

- [ ] **Step 3: Centralize truthful balance copy**

Add a small route-local helper:

```ts
function balanceEvidenceMessage(result: BillingGoodwillResult): string {
  const historical = result.endingCreditCents === null
    ? ""
    : ` The Stripe credit immediately after this transaction was ${formatUsd(result.endingCreditCents)}.`
  const current = result.currentCreditCents === null
    ? ""
    : ` The current Stripe credit is ${formatUsd(result.currentCreditCents)}.`
  return historical + current
}
```

Use it for delivered and warning outcomes. Keep Activity/email bundle copy in `buildGoodwillBundle` historical-only because delivery may happen after the provider read.

- [ ] **Step 4: Keep preview labels distinct**

Retain `Current Stripe credit` and `Resulting credit` in the pre-mutation preview. Add a focused comment or copy qualifier that the resulting value is a projection before provider activity, not stored reconciliation evidence.

- [ ] **Step 5: Update compiled page/action doubles**

Add `currentCreditCents` to every `BillingGoodwillResult` fixture and preserve the real `BillingGoodwillControls` prop shape in `tests/admin-security-ui.test.mjs`.

- [ ] **Step 6: Run UI tests and verify GREEN**

Run: `node --test tests/admin-billing-goodwill-ui.test.mjs tests/admin-security-ui.test.mjs`

Expected: PASS with stable live regions and no provider identifiers.

- [ ] **Step 7: Commit presentation changes**

```bash
git add app/admin/users/[userId]/billing-actions.ts app/admin/users/[userId]/billing-goodwill-form.tsx tests/admin-billing-goodwill-ui.test.mjs tests/admin-security-ui.test.mjs
git commit -m "fix: distinguish historical and current Stripe credit"
```

### Task 4: Document and validate the branch

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify: `docs/wiki/admin-user-operations.md`
- Modify: `docs/wiki/release-checklist.md`

**Interfaces:**
- Consumes: terminal service/UI evidence.
- Produces: stable reconciliation guidance.

- [ ] **Step 1: Update canonical docs**

Document exact immutable transaction validation, historical `ending_balance`, separate current Customer observation, final Admin authority recheck, and unchanged live/test gates. Link the runbook to Stripe's official [Customer Balance Transaction API](https://docs.stripe.com/api/customer_balance_transactions/object) and [idempotent request guidance](https://docs.stripe.com/api/idempotent_requests).

- [ ] **Step 2: Run focused and adjacent validation**

```bash
node --test tests/admin-billing-goodwill.test.mjs tests/admin-billing-goodwill-ui.test.mjs tests/admin-user-directory.test.mjs tests/admin-dashboard.test.mjs tests/admin-operation-service.test.mjs tests/admin-security-ui.test.mjs tests/stripe-billing.test.mjs
npm run typecheck
npm run lint
npm run prisma:validate
```

Expected: PASS; no schema change is expected.

- [ ] **Step 3: Run comprehensive validation**

```bash
npm run test
npm run build
git diff --check
```

Expected: full unit suite PASS with the one intentional skip, 104-page build PASS, and clean diff check.

- [ ] **Step 4: Request spec and quality review**

Reviewers must explicitly exercise intervening provider activity, immutable evidence, no replacement create, authority revocation at the provider boundary, and privacy-safe copy.

- [ ] **Step 5: Commit docs**

```bash
git add docs/project-state.md docs/project-log.md docs/wiki/admin-user-operations.md docs/wiki/release-checklist.md
git commit -m "docs: clarify goodwill reconciliation evidence"
```

- [ ] **Step 6: Complete the PR loop**

Push, open a ready PR, wait for hosted checks and a fresh CodeRabbit review, verify findings at the exact head, resolve valid threads, and stop at the user merge gate. Do not perform a live Stripe credit as part of this branch.
