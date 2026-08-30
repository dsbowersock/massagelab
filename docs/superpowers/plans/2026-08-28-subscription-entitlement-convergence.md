# Subscription Truth and Entitlement Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make signed Stripe membership events duplicate-safe and order-safe, then make Checkout and Portal returns converge visibly to MassageLab's persisted feature-key access.

**Architecture:** Add a dedicated membership webhook receipt plus a provider-event watermark and an authoritative-read marker instead of expanding the background-commerce receipt. Route membership events through a focused service that applies unambiguously ordered embedded snapshots, ignores older provider events, and reconciles equal-time, legacy, or post-authoritative events with Stripe outside the transaction. The local authoritative-read timestamp is used only for same-clock concurrency control—never compared with Stripe's clock. A bounded database-only return-status endpoint lets Checkout and Portal returns observe persisted access without trusting the URL.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7/PostgreSQL, Stripe 22, Node.js 24 tests, Playwright 1.60, and existing feature-key entitlement services.

**Spec:** `docs/superpowers/specs/2026-08-28-family-friends-readiness-design.md`

## Global Constraints

- Execute after the reviewed identity head. Preserve all identity rules and existing users/subscriptions/purchases.
- Stripe is the external payment authority; MassageLab's persisted MembershipSubscription and feature keys remain the ordinary runtime access authority.
- Preserve current Checkout price allowlisting, Supporter product/amounts, tax gates, Session reuse/idempotency, Portal behavior, active statuses, and period-end access semantics.
- Do not infer access from a Checkout URL, query parameter, displayed plan name, Stripe metadata alone, or browser state.
- Verify the raw webhook body and signature before parsing or persistence.
- Provider I/O never occurs inside a database transaction.
- A duplicate safely completes once; an older event never overwrites a newer event or a later authoritative provider read.
- A receipt that failed before completion remains retryable. Without a durable background worker, unresolved processing returns non-2xx so Stripe owns retry.
- Persist only event/order metadata needed for audit and retry; never store raw Stripe payloads, addresses, payment data, secrets, or tokens.
- Clear account membership cache only after a committed state change.
- The return-status endpoint is authenticated, private/no-store, database-only, and exposes no Stripe customer, subscription, Checkout Session, event, or receipt ID.
- Injected provider fixtures own required failure-path testing. Any real Stripe test-mode or live mutation remains a separate release authorization. No live charge, refund, cancellation, synthetic event, Portal configuration change, provider setting change, migration deployment, or deployment is authorized by this plan.
- Use strict TDD, focused JSDoc, bounded serializable transactions, and one independently reviewable commit per task.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Adds membership receipt and nullable event/authoritative watermarks. |
| `prisma/migrations/20260828130000_membership_subscription_convergence/migration.sql` | Additive receipt table, indexes, FK, and nullable subscription columns. |
| `tests/membership-webhook-migration.test.mjs` | Guards additive/no-payload schema and rollback compatibility. |
| `lib/membership-webhook-ordering.ts` | Pure event-vs-watermark ordering decision. |
| `tests/membership-webhook-ordering.test.mjs` | Covers duplicate/newer/older/equal/legacy/authoritative barriers. |
| `lib/membership-webhook-service.ts` | Receipt ownership, snapshot application, retry, provider reconciliation, and safe outcomes. |
| `tests/membership-webhook-service.test.mjs` | Covers lifecycle ordering, concurrency, provider failure, feature results, and transaction boundaries. |
| `lib/stripe-billing.js` | Retains exported `normalizeStripeSubscription`; keeps legacy writers through Task 2 compatibility, then removes them only after Task 3 routes every caller through convergence. |
| `app/api/billing/webhook/route.ts` | Preserves signature/background routing and delegates signed membership events. |
| `tests/membership-webhook-route.test.mjs` | Verifies dispatch, result status, cache timing, and unchanged non-membership routing. |
| `lib/membership-convergence.ts` | Projects persisted membership into a provider-ID-free return status. |
| `tests/membership-convergence-status.test.mjs` | Tests feature-key projection, billing attention, revision, and no-provider fields. |
| `app/api/billing/membership-status/route.ts` | Authenticated private/no-store persisted-state endpoint. |
| `app/account/membership-return-status.tsx` | Bounded Checkout/Portal return poller and safe retry UI. |
| `tests/membership-return-status.test.mjs` | Source/component contract for bounded reads and recoverable settlement. |
| `tests/browser/membership-return-status.spec.ts` | Throttled persisted-return UI on desktop and mobile with no Stripe call. |
| `tests/browser/membership-return-status-fixture.ts` | Opt-in disposable-database account/subscription fixture; production and unapproved databases fail closed. |
| `lib/membership-checkout.js` | Returns to persisted membership tab without Session ID authority. |
| `app/api/billing/portal/route.ts` | Returns to persisted membership status check. |
| `app/account/page.tsx` | Replaces static refresh notices with bounded status component. |
| `tests/browser/ci-lanes.mjs` | Assigns the new browser spec exactly once per ordinary project. |
| `tests/browser/ci-lanes.test.mjs` and `tests/browser-qa-harness.test.mjs` | Guard 26 project/spec pairs after identity plus membership specs. |

---

### Task 1: Add durable membership receipt and freshness watermarks

**Files:**
- Create: `prisma/migrations/20260828130000_membership_subscription_convergence/migration.sql`
- Create: `tests/membership-webhook-migration.test.mjs`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces enum: `MembershipWebhookReceiptStatus = RECEIVED | APPLIED | IGNORED`.
- Produces model: `MembershipWebhookReceipt` unique by `(provider, providerEventId)`.
- Adds to MembershipSubscription: `lastStripeEventId`, `lastStripeEventCreatedAt`, `lastStripeAuthoritativeAt`.
- All three subscription fields are nullable; existing rows require reconciliation on their first later membership event.

- [ ] **Step 1: Write the failing migration test**

Create `tests/membership-webhook-migration.test.mjs` and assert:

```js
assert.match(schema, /enum MembershipWebhookReceiptStatus[\s\S]*RECEIVED[\s\S]*APPLIED[\s\S]*IGNORED/)
assert.match(schema, /model MembershipWebhookReceipt[\s\S]*@@unique\(\[provider, providerEventId\]\)/)
assert.match(schema, /lastStripeEventId\s+String\?/)
assert.match(schema, /lastStripeEventCreatedAt\s+DateTime\?/)
assert.match(schema, /lastStripeAuthoritativeAt\s+DateTime\?/)
assert.doesNotMatch(schema.match(/model MembershipWebhookReceipt[\s\S]*?\n\}/)?.[0] ?? "", /payload|address|paymentMethod|secret|token/i)
assert.match(migration, /CREATE TABLE "MembershipWebhookReceipt"/)
assert.match(migration, /ADD COLUMN\s+"lastStripeEventId" TEXT/)
assert.doesNotMatch(migration, /UPDATE "MembershipSubscription"/)
```

Also assert indexes on `(status, receivedAt)`, `(stripeSubscriptionId, providerEventCreatedAt)`, and `(userId, receivedAt)`, plus `ON DELETE SET NULL` for the optional User relation.

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test tests/membership-webhook-migration.test.mjs
```

Expected: FAIL because the enum/model/migration/watermarks do not exist.

- [ ] **Step 3: Add the exact additive model**

Add:

```prisma
enum MembershipWebhookReceiptStatus {
  RECEIVED
  APPLIED
  IGNORED
}

model MembershipWebhookReceipt {
  id                     String                         @id @default(cuid())
  userId                 String?
  provider               String
  providerEventId        String
  eventType              String
  providerEventCreatedAt DateTime
  providerObjectId       String
  stripeSubscriptionId   String?
  status                 MembershipWebhookReceiptStatus @default(RECEIVED)
  attemptCount           Int                            @default(0)
  failureCode            String?
  receivedAt             DateTime                       @default(now())
  lastAttemptedAt        DateTime?
  processedAt            DateTime?
  user                   User?                          @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@unique([provider, providerEventId])
  @@index([status, receivedAt])
  @@index([stripeSubscriptionId, providerEventCreatedAt])
  @@index([userId, receivedAt])
}
```

Add the User relation and these nullable MembershipSubscription fields:

```prisma
lastStripeEventId        String?
lastStripeEventCreatedAt DateTime?
lastStripeAuthoritativeAt DateTime?
```

- [ ] **Step 4: Add the migration**

Create the enum/table/indexes/FK and three nullable columns. Do not backfill or rewrite a membership row. Pre-bridge application instances must remain able to run against the expanded schema only through the later paused-bridge cutover and bounded drain. After that cutover, never use pre-bridge code for rollback; rollback means bridge-capable code with `MASSAGELAB_MEMBERSHIP_WEBHOOK_WRITES_PAUSED` exactly `1`, while the additive schema remains in place.

- [ ] **Step 5: Verify and commit persistence**

```bash
npm run prisma:generate
npm run prisma:validate
node --test tests/membership-webhook-migration.test.mjs
git diff --check
git add prisma/schema.prisma prisma/migrations/20260828130000_membership_subscription_convergence/migration.sql tests/membership-webhook-migration.test.mjs
git commit -m "feat: add durable membership webhook receipts"
```

Expected: all commands pass.

---

### Task 2: Converge duplicate and out-of-order membership state

**Files:**
- Create: `lib/membership-webhook-ordering.ts`
- Create: `lib/membership-webhook-service.ts`
- Create: `tests/membership-webhook-ordering.test.mjs`
- Create: `tests/membership-webhook-service.test.mjs`
- Verify: `lib/stripe-billing.js`
- Modify: `tests/stripe-billing.test.mjs`
- Modify: `tests/membership.test.mjs`

**Interfaces:**
- Produces `MembershipEventOrderDecision = "apply" | "duplicate" | "ignore-stale" | "reconcile"`.
- Produces `decideMembershipEventOrder({ hasStoredSnapshot, storedEventId, storedEventCreatedAt, storedAuthoritativeAt, incomingEventId, incomingEventCreatedAt })`.
- Produces `processStripeMembershipEvent({ prismaClient, event, env, retrieveSubscription, now }): Promise<MembershipWebhookResult>`.
- Produces this exact safe result contract:

```ts
type MembershipWebhookResult =
  | { outcome: "applied"; changed: true; userId: string }
  | { outcome: "applied"; changed: false; userId: string | null }
  | { outcome: "duplicate"; changed: false; userId: string | null }
  | { outcome: "ignored"; changed: false; userId: string | null }
```

`changed` is true only when the committed transaction changes persisted subscription fields that can affect the membership summary or feature-key access; receipt attempts, terminal status, and watermark-only writes do not make it true. A changing result necessarily has the verified persisted owner needed for cache invalidation. Non-changing results carry that owner when resolved and otherwise use `null`; no caller may assume `userId` is non-null without narrowing `changed: true`.
- Produces safe retry error: `MembershipWebhookRetryableError` with allowlisted `code`.
- Preserves exported `normalizeStripeSubscription(subscription, { env })`.

- [ ] **Step 1: Write the pure ordering table as RED**

Create table-driven cases:

```ts
same event ID                                      -> duplicate
no stored snapshot                                -> apply
stored snapshot with no event/authoritative mark  -> reconcile
incoming newer than event, no authoritative mark  -> apply
incoming older than last event                    -> ignore-stale
different event after authoritative provider read -> reconcile
equal event timestamp with a different event ID   -> reconcile
```

`storedAuthoritativeAt` is the local start time of the last successful current-subscription retrieval. It is only a marker that a provider read has occurred and a same-clock concurrency fence between local reconciliation attempts. Stripe `event.created` is never compared with this local value because it has second resolution and comes from a different clock.

- [ ] **Step 2: Write failing service tests**

Required cases:

- completed duplicate and retry of an unfinished receipt;
- older-then-newer and newer-then-older delivery;
- canceled followed by delayed active cannot reactivate;
- newer resumed event restores access;
- equal-time different IDs reconcile;
- legacy null watermark reconciles;
- any different event after an authoritative snapshot reconciles instead of trusting cross-system clocks;
- same-second events and simulated positive/negative local clock skew never produce `ignore-stale` solely from `lastStripeAuthoritativeAt`;
- provider failure leaves receipt RECEIVED with safe failure code and throws retryable error;
- current provider retrieval occurs outside `$transaction`;
- a newer event committed during retrieval prevents the reconciled read from overwriting it;
- two reconciliation workers for the same receipt, where one commits APPLIED while the other is awaiting the provider, leave the winning receipt APPLIED, return a non-changing terminal result from the resumed worker, and mutate the subscription snapshot exactly once;
- `past_due`, `unpaid`, `paused`, and canceled remove paid features under existing resolver semantics;
- active/trialing grant existing `premium_backgrounds` behavior;
- Price change updates persisted price but not feature-key rules;
- unknown Price, customer/user/subscription mismatch, or malformed event grants nothing;
- serializable conflict retries are bounded; and
- concurrent duplicate delivery changes one snapshot once.

- [ ] **Step 3: Run both service tests and verify RED**

```bash
node --test tests/membership-webhook-ordering.test.mjs tests/membership-webhook-service.test.mjs
```

Expected: FAIL because the new modules do not exist.

- [ ] **Step 4: Implement the pure ordering function**

Use exact comparisons:

```ts
if (storedEventId === incomingEventId) return "duplicate"
if (!hasStoredSnapshot) return "apply"
if (!storedEventCreatedAt && !storedAuthoritativeAt) return "reconcile"
if (storedEventCreatedAt && incomingEventCreatedAt < storedEventCreatedAt) return "ignore-stale"
if (storedEventCreatedAt && incomingEventCreatedAt.getTime() === storedEventCreatedAt.getTime()) return "reconcile"
if (storedAuthoritativeAt) return "reconcile"
return "apply"
```

Reject invalid dates before calling the pure function.

- [ ] **Step 5: Implement receipt ownership and direct apply**

Validate nonempty event ID/type/object/subscription IDs and convert Stripe `event.created` seconds to a Date. In a bounded serializable database-only transaction:

1. create or load the unique receipt as RECEIVED;
2. return immediately for APPLIED/IGNORED receipts;
3. increment `attemptCount`, set `lastAttemptedAt`, and clear the previous safe failure code;
4. resolve persisted StripeCustomer and subscription ownership without moving either to another user; and
5. compute the ordering decision.

For `apply`, normalize the embedded subscription, upsert its allowed fields, write event ID/time, retain any newer `lastStripeAuthoritativeAt`, and mark the receipt APPLIED atomically. For `ignore-stale`, leave the snapshot untouched and mark the receipt IGNORED. For a matching event watermark with a RECEIVED receipt, mark it APPLIED without rewriting access.

- [ ] **Step 6: Implement bounded provider reconciliation**

For Checkout completion, legacy null marks, or equal-time ambiguity:

1. capture `authoritativeReadStartedAt = now()`;
2. retrieve the current Stripe subscription outside any transaction;
3. validate subscription ID, customer ID, stored customer ownership, and allowlisted Price mapping;
4. enter a short serializable transaction and re-read receipt/snapshot;
5. if the re-read receipt is already APPLIED, return `{ outcome: "duplicate", changed: false, userId }`; if it is already IGNORED, return `{ outcome: "ignored", changed: false, userId }`; do not change its status or the snapshot;
6. compare the re-read event ID/time and local authoritative marker with the values captured before retrieval; if any changed during the provider read, transition only a still-RECEIVED receipt to IGNORED without applying the fetched snapshot;
7. otherwise apply the current normalized snapshot, set the incoming event ID/time, set `lastStripeAuthoritativeAt = authoritativeReadStartedAt`, and transition only the still-RECEIVED receipt to APPLIED.

Every post-provider terminal transition is conditional on `status = RECEIVED`. If that conditional write loses to another worker, re-read and return the winning terminal result; never rewrite APPLIED to IGNORED or IGNORED to APPLIED. The concurrency test must hold worker A after provider retrieval, allow worker B for the same receipt to commit APPLIED, then resume worker A and assert final receipt status APPLIED, one snapshot mutation, and `changed: false` from A.

On retrieval/configuration/mapping failure, retain RECEIVED, persist only an allowlisted code such as `provider_unavailable`, `price_unmapped`, or `ownership_mismatch`, and throw `MembershipWebhookRetryableError`. No unresolved event returns success because there is no background worker.

- [ ] **Step 7: Migrate service expectations while retaining route compatibility**

Keep `normalizeStripeSubscription`, `recordCheckoutSessionCompleted`, and `upsertMembershipSubscriptionFromStripe` exported through this task because the unchanged webhook route still imports the legacy writers. Move convergence-owned expectations into the service tests, but preserve enough legacy coverage for the compatibility exports. Do not remove either writer until Task 3 changes the route and repository search proves there is no remaining runtime caller.

- [ ] **Step 8: Run focused tests and commit**

```bash
node --test tests/membership-webhook-ordering.test.mjs tests/membership-webhook-service.test.mjs tests/stripe-billing.test.mjs tests/membership.test.mjs
npm run typecheck
git diff --check
git add lib/membership-webhook-ordering.ts lib/membership-webhook-service.ts tests/membership-webhook-ordering.test.mjs tests/membership-webhook-service.test.mjs tests/stripe-billing.test.mjs tests/membership.test.mjs
git commit -m "feat: converge ordered membership webhook state"
```

Expected: PASS.

---

### Task 3: Route signed membership events through convergence

**Files:**
- Create: `tests/membership-webhook-route.test.mjs`
- Modify: `app/api/billing/webhook/route.ts`
- Modify: `lib/stripe-billing.js`
- Modify: `tests/stripe-billing.test.mjs`
- Modify: `tests/membership.test.mjs`
- Verify: `lib/stripe-webhook-contract.js`
- Verify: background commerce/refund/dispute tests.

**Interfaces:**
- Membership `applied`/`duplicate`/`ignored` outcome -> HTTP 200 `{ received: true }`.
- Retryable unfinished membership outcome -> HTTP 503 `{ received: false, retry: true }`.
- Donation/unknown Checkout remains non-entitling.
- Background checkout/refund/dispute routing remains unchanged.

- [ ] **Step 1: Write failing route tests**

Inject signature verification and processors. Cover invalid signature causing zero parse/write; membership-purpose `checkout.session.completed`; every type in `STRIPE_MEMBERSHIP_WEBHOOK_EVENTS`; 200 for `applied`/`duplicate`/`ignored`; 503 for `MembershipWebhookRetryableError`; cache clear only after `changed: true`; and unchanged donation/background/refund/dispute dispatch.

- [ ] **Step 2: Run route tests and verify RED**

```bash
node --test tests/membership-webhook-route.test.mjs tests/stripe-webhook-contract.test.mjs
```

Expected: FAIL because membership routing still calls the bypass writers.

- [ ] **Step 3: Delegate only membership events**

Preserve raw-body signature verification. Route membership Checkout completion and subscription events to `processStripeMembershipEvent`. Catch only its typed retryable error for the 503 response; unexpected errors remain non-2xx and privacy-safe. Call `clearAccountSurfaceDataCache(result.userId, "membership")` only when `changed` is true and after service completion.

After the route delegates every membership event, remove `recordCheckoutSessionCompleted` and `upsertMembershipSubscriptionFromStripe` from `lib/stripe-billing.js`, migrate/delete their remaining legacy-only tests, and require repository search to show no runtime caller or import. This removal occurs in the same task and commit as route integration so no committed task boundary has a broken import or typecheck.

Do not alter the webhook event contract, pinned Stripe API version, or background-commerce branches.

- [ ] **Step 4: Run route and non-regression tests**

```bash
node --test tests/membership-webhook-route.test.mjs tests/stripe-webhook-contract.test.mjs tests/stripe-billing.test.mjs tests/membership.test.mjs tests/background-reversals.test.mjs tests/background-fulfillment.test.mjs
npm run typecheck
npm run lint
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Commit route integration**

```bash
git add app/api/billing/webhook/route.ts lib/stripe-billing.js tests/membership-webhook-route.test.mjs tests/stripe-billing.test.mjs tests/membership.test.mjs
git commit -m "feat: route membership events through convergence"
```

---

### Task 4: Show persisted membership status after Checkout and Portal

**Files:**
- Create: `lib/membership-convergence.ts`
- Create: `tests/membership-convergence-status.test.mjs`
- Create: `app/api/billing/membership-status/route.ts`
- Create: `app/account/membership-return-status.tsx`
- Create: `tests/membership-return-status.test.mjs`
- Create: `tests/browser/membership-return-status-fixture.ts`
- Create: `tests/browser/membership-return-status.spec.ts`
- Modify: `lib/membership-checkout.js`
- Modify: `app/api/billing/portal/route.ts`
- Modify: `app/account/page.tsx`
- Modify: `tests/membership-checkout-route.test.mjs`
- Modify: `tests/billing-portal-route.test.mjs`
- Modify: `tests/supporter-membership-final-review.test.mjs`
- Modify: `tests/account-page-tabs.test.mjs`
- Modify: `tests/browser/ci-lanes.mjs`
- Modify: `tests/browser/ci-lanes.test.mjs`
- Modify: `tests/browser-qa-harness.test.mjs`

**Interfaces:**
- Produces `MembershipConvergenceStatus` with only state, paidLevel, featureKeys, subscriptionStatus, cancelAtPeriodEnd, period end, revision, and Portal availability.
- Produces poll delays `[0, 1000, 2000, 4000, 8000]` (five reads over at most 15 seconds).
- Checkout success URL: `/account?tab=membership&checkout=success`.
- Checkout cancel URL: `/account?tab=membership&checkout=cancelled`.
- Portal return URL: `/account?tab=membership&portal=returned`.

- [ ] **Step 1: Write failing projection and endpoint tests**

Test active access, billing attention, no active membership, cancel-at-period-end, persisted feature keys, ISO period end/revision, Portal availability, and absence of provider IDs. Endpoint cases: unauthenticated 401; `Cache-Control: private, no-store`; exactly one persisted summary load; no Stripe dependency/call; ignored query/body Session IDs. Include an old terminal subscription as the first Checkout-return read, followed by a new active revision: the old row must not end polling or display a false new-payment failure.

Use status states:

```ts
type MembershipConvergenceState = "active" | "billing-attention" | "no-active-membership"
```

`revision` is the latest persisted MembershipSubscription `updatedAt` ISO string or `null`, never a provider ID. For `kind="checkout"`, the first response establishes `baselineRevision`; active access may settle immediately, but `billing-attention`/`no-active-membership` cannot be attributed to the just-finished Checkout unless a later read has a different revision. If no revision changes, exhaust the bound and show still-processing guidance. Portal may present current persisted state on its first read because it is not claiming a new payment result.

- [ ] **Step 2: Write failing return-component and browser tests**

Cover Checkout processing -> active, billing attention only after a revision change observed during that polling run, five-read bound through transient failures, timeout with safe status retry, Portal showing current access/attention immediately while watching revision, and absence of any Checkout recreation. Explicitly test old `incomplete_expired` revision -> processing -> new active revision. Browser assertions include immediate status, eventual settlement, keyboard focus, phone portrait/landscape, enlarged text, reduced motion, and no provider request.

- [ ] **Step 3: Run tests and verify RED**

```bash
node --test tests/membership-convergence-status.test.mjs tests/membership-return-status.test.mjs tests/membership-checkout-route.test.mjs tests/billing-portal-route.test.mjs
```

Expected: FAIL because the projection, endpoint, component, and new return URLs do not exist.

- [ ] **Step 4: Implement the database-only projection and endpoint**

Build from `getUserMembershipSummary`. Active means `entitlements.paidLevel` is non-null. Billing attention means no active paid level and the newest subscription status is `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, or `paused`. Otherwise state is no active membership. Return `entitlements.features`, never displayed plan logic.

The endpoint authenticates with `getCurrentSession`, returns 401 when absent, and always sets `Cache-Control: private, no-store`. It accepts no Session/event/customer/subscription ID and never constructs a Stripe client.

- [ ] **Step 5: Implement the bounded return UI**

Export:

```ts
export const MEMBERSHIP_RETURN_POLL_DELAYS_MS = [0, 1000, 2000, 4000, 8000] as const

export function MembershipReturnStatus({ kind }: { kind: "checkout" | "portal" }) {
  // fetch persisted status only; settle or exhaust the exact delay list
}
```

Render immediate canonical Loader/status feedback with `aria-busy` and one polite live region. Checkout stops early for active state, or for billing attention after `revision !== baselineRevision`. It never treats an old terminal row as the new Checkout's failure. Portal displays current access immediately and continues bounded checks for a changed revision. Active `premium_backgrounds` access links to `/chimer?panel=background`; confirmed billing attention offers the existing Portal; timeout says the update is still processing and offers only a status retry. Every fetch failure advances/settles safely and clears permanent busy state.

- [ ] **Step 6: Remove return-URL authority**

Update Checkout and Portal URLs to the exact paths above. Remove `{CHECKOUT_SESSION_ID}` from the success URL. In `app/account/page.tsx`, render the return component only for exact `checkout=success` or `portal=returned`; retain cancellation/error notices and ignore any historical/malicious `session_id` parameter.

- [ ] **Step 7: Add the browser spec to CI lanes**

Add `membership-return-status.spec.ts` to `ORDINARY_BROWSER_QA_SPEC_FILES`. Assign its desktop pair to lane 1 and mobile pair to lane 2. Update harness assertions so the identity and membership workstream total is 13 ordinary specs and 26 exact project/spec pairs. Keep exactly four nonempty lanes and exact-once coverage. Public/fixture-free cases always run. Account-page cases use `tests/browser/membership-return-status-fixture.ts`, project-qualified `example.test` rows, a signed session cookie, and exact cleanup. They must reuse Identity Task 6's existing `npm run browser-qa:db:target` guard, `MASSAGELAB_BROWSER_QA_DATABASE*` variables, approved SHA-256 target fingerprint, and guarded fresh-process setup/runtime wrappers; do not create a second target-check mechanism. The approved migration list for that disposable target must include the membership migration before any Subscription fixture write. If the exact target/fingerprint and migration application were not separately approved, or a pre-migrated disposable target is unavailable, keep only these database-backed rows skipped with that exact reason; ordinary CI and public/fixture-free cases still run.

- [ ] **Step 8: Run focused tests and browser coverage**

```bash
node --test tests/membership-convergence-status.test.mjs tests/membership-return-status.test.mjs tests/membership-checkout-route.test.mjs tests/billing-portal-route.test.mjs tests/supporter-membership-final-review.test.mjs tests/account-page-tabs.test.mjs tests/account-surface-data.test.mjs tests/browser/ci-lanes.test.mjs tests/browser-qa-harness.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/membership-return-status.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/membership-return-status.spec.ts --project=mobile-chromium
npm run typecheck
npm run lint
git diff --check
```

Expected: PASS. If the disposable database was authorized, run the database-backed Subscription rows only inside Identity Task 6 Step 7's fresh-process runtime wrapper, with the fingerprint guard immediately before `build:browser-qa`, and verify exact fixture cleanup afterward. Otherwise record their explicit skip; never point the fixture at Production or run it from a shell whose pre-existing database values could be cleared.

- [ ] **Step 9: Commit return convergence**

```bash
git add lib/membership-convergence.ts app/api/billing/membership-status/route.ts app/account/membership-return-status.tsx lib/membership-checkout.js app/api/billing/portal/route.ts app/account/page.tsx tests/membership-convergence-status.test.mjs tests/membership-return-status.test.mjs tests/browser/membership-return-status-fixture.ts tests/browser/membership-return-status.spec.ts tests/membership-checkout-route.test.mjs tests/billing-portal-route.test.mjs tests/supporter-membership-final-review.test.mjs tests/account-page-tabs.test.mjs tests/browser/ci-lanes.mjs tests/browser/ci-lanes.test.mjs tests/browser-qa-harness.test.mjs
git commit -m "feat: show persisted membership return status"
```

---

### Task 5: Document and verify subscription convergence

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify: `docs/wiki/release-checklist.md`

**Interfaces:**
- Documents migration order, receipt retry ownership, event/authoritative ordering, database-only return status, and remaining external gates.

- [ ] **Step 1: Add exact release documentation**

Record the additive migration, unique receipt, event watermark, authoritative-read barrier, duplicate/stale/equal/legacy behavior, retryable 503 rule, database-only bounded polling, and feature-key authority. State explicitly that no live event/payment/provider action or deployment was performed.

- [ ] **Step 2: Run the complete workstream gate**

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
npm run build:browser-qa
npm run test:browser -- tests/browser/membership-return-status.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/membership-return-status.spec.ts --project=mobile-chromium
```

Expected: every command passes.

- [ ] **Step 3: Review billing non-regression boundaries**

Confirm current price/tax/Checkout idempotency code is unchanged; background-commerce receipt/routing is unchanged; Portal remains customer-based; all access assertions use persisted feature keys; no raw payload/provider secrets are stored; and only ambiguous/legacy/Checkout-completion or post-authoritative membership events retrieve Stripe. Ordinary page rendering never does.

- [ ] **Step 4: Update canonical state with exact evidence**

Record the exact subscription head, migration name, focused/full/browser results, and that production migration/provider/live verification remains pending. Do not repeat historical billing smoke as exact-head proof.

- [ ] **Step 5: Commit documentation and record handoff**

```bash
git add docs/project-state.md docs/project-log.md docs/wiki/release-checklist.md
git commit -m "docs: record membership convergence gates"
git status --short --branch
git log --oneline --decorate -5
```

Expected: clean branch with five task commits. Hand off the exact head and pending additive migration to the interaction-feedback workstream.
