# Task 8 Commerce Reversal Report

Date: 2026-07-21
Branch: `codex/background-commerce-foundation`
Task: Track 1A Task 8, refunds, disputes, retirement, and reconciliation

## Status

Complete. Background purchase reversals now use exact order-item snapshots,
short serializable database transactions, Stripe object/event idempotency, and
append-only safe commerce events. The existing Task 7 signature verification,
Checkout routing, donation behavior, and membership reconciliation remain
unchanged.

## RED Evidence

1. Exact-item refund initiation:
   - Command: `node --test tests/background-reversals.test.mjs`
   - Expected failure: `ERR_MODULE_NOT_FOUND` for
     `lib/commerce/reversal-service.ts`.
2. Refund webhook finalization:
   - Expected failure: the new module did not export
     `applyStripeRefundEvent`.
3. Dispute lifecycle:
   - Expected failure: the new module did not export
     `applyStripeDisputeEvent`.
4. Retirement lifecycle:
   - Expected failure: the new module did not export
     `transitionRetiredBackgroundOwnership`.
5. Webhook routing and reconciliation:
   - Command: `node --test tests/background-reversals.test.mjs tests/commerce-reconcile.test.mjs`
   - Expected failures: the webhook lacked the pinned refund/dispute event
     mappings and `scripts/commerce-reconcile.mjs` did not exist.
6. Ambiguous refund recovery:
   - Expected failure: a pending local refund could not bind the processor
     refund from safe metadata after an ambiguous network result.
7. Independent dispute restoration:
   - Expected failure: a failed refund restored `ACTIVE` while an independent
     dispute was still open instead of retaining `DISPUTE_SUSPENDED`.
8. Aggregate reconciliation and pinned Stripe v22 statuses:
   - Expected failures: aggregate order/payment/refund/dispute drift was not
     reported, and `warning_closed` / `prevented` disputes remained `OPEN`.
9. Review hardening:
   - Command: `node --test tests/background-reversals.test.mjs tests/commerce-reconcile.test.mjs`
   - Eight expected failures covered dispute/refund precedence, positive partial
     disputes, same-second dispute ordering, newer OPEN watermarks, exact
     PaymentIntent binding, unresolved local placeholders, and overlap-aware
     reconciliation.
10. Resumable ambiguity and repair safety:
    - Expected failures showed initiation could not replay a `REFUND_PENDING`
      selection, reconciliation repair invoked unrelated projection writers,
      webhook binding mutated a placeholder before validating PaymentIntent,
      and one repair target leaked into later repair calls.
11. Terminal dispute immutability:
    - Two newer-event regressions failed because duplicate and contradictory
      terminal dispute deliveries returned `changed: true` and re-entered the
      domain transition path.
    - The minimal guard now processes each new receipt safely while leaving the
      terminal dispute, ownership projection, and domain-event stream unchanged.

## Implementation

- `lib/commerce/reversal-service.ts`
  - Stages exact selected refundable order items, their immutable gross amounts,
    a pending refund, purchase ownership suspension, and an audit event before
    invoking Stripe.
  - Uses `background-refund:<local-refund-id>` as the stable processor
    idempotency key. The processor call is outside every database transaction.
  - Stores the exact recoverable placeholder `pending:<local-refund-id>` and
    replays the same local refund for the same exact item selection after an
    ambiguous processor outcome. The resumable service reuses the original
    idempotency key, invokes Stripe outside transactions, and validates amount,
    currency, PaymentIntent, and safe metadata before atomically binding or
    finalizing.
  - A later signed refund event may also bind from safe local `refundId` and
    `orderId` metadata, but only after exact PaymentIntent and amount evidence
    matches. Mismatches stay pending and reportable without ownership mutation.
  - Finalizes pending refunds from `succeeded`, `failed`, and `canceled`
    processor states without touching credit ownership. Failed refunds restore
    only eligible purchase ownership and preserve an independently open dispute
    suspension.
  - Accepts positive integer partial disputes up to the payment amount and
    applies their state payment-wide. Suspends all purchase ownerships from a
    disputed payment, restores only
    `DISPUTE_SUSPENDED` ownership on funds reinstatement, and revokes only
    remaining active/suspended/refund-pending purchase ownership on loss.
    Terminal-over-OPEN tie-breaking plus separate OPEN/terminal processor
    watermarks make replay and older events monotonic without a schema change.
    Once `WON` or `LOST`, the dispute is immutable even when a newer duplicate,
    contradictory terminal, or OPEN event arrives.
  - Treats pinned Stripe v22 `won`, `warning_closed`, and `prevented` as funds
    reinstated; `lost` is the revocation terminal.
  - Retires an active owned background and atomically writes exactly one
    ownership-specific `RETIREMENT_REPLACEMENT` credit ledger entry. Unowned,
    legal-refund override, and free-conversion paths issue no replacement.
  - Re-reads refund and dispute state before ownership-drift repair, so a stale
    failed-refund finding cannot reactivate ownership during an OPEN or LOST
    dispute. Per-call transition copies prevent state leaking between repairs.
- `app/api/billing/webhook/route.ts`
  - Adds `refund.created`, `refund.updated`, `refund.failed`,
    `charge.dispute.created`, `charge.dispute.updated`, and
    `charge.dispute.closed` handling.
  - Resolves a dispute's Charge outside the transaction only when its
    PaymentIntent is not already present.
  - Unknown payment/refund references create identifier-hash receipts for
    reconciliation; no raw Stripe objects or payloads are stored.
- `scripts/commerce-reconcile.mjs`
  - Defaults strictly to identifier-only read-only reporting.
  - Reports exact unresolved local placeholders without exposing processor IDs.
  - `--repair` may invoke only the idempotent pending-refund resume service;
    ownership and aggregate drift remain report-only from the CLI.
- `package.json`
  - Adds `commerce:reconcile`.

No Prisma schema or migration change was required.

## Event Mapping

| Processor/domain input | Current-state transition | Safe audit record |
| --- | --- | --- |
| Operator exact-item initiation | Purchase ownership `ACTIVE` -> `REFUND_PENDING`; refund `PENDING` | `BACKGROUND_REFUND_INITIATED` |
| Stripe refund binding | Pending local placeholder -> Stripe refund ID | `BACKGROUND_REFUND_PROCESSOR_BOUND` |
| Refund succeeded | Selected purchase ownership -> `REFUND_REVOKED`; aggregates -> partial/full refund | `BACKGROUND_REFUND_SUCCEEDED` |
| Refund failed/canceled | Eligible selected ownership -> `ACTIVE` or `DISPUTE_SUSPENDED` | `BACKGROUND_REFUND_FAILED` |
| Dispute opened/under review | Payment's active purchase ownership -> `DISPUTE_SUSPENDED` | `BACKGROUND_DISPUTE_OPEN` |
| Dispute won/warning closed/prevented | Eligible suspended purchase ownership -> `ACTIVE` | `BACKGROUND_DISPUTE_WON` |
| Dispute lost | Remaining active/suspended/refund-pending purchase ownership -> `DISPUTE_REVOKED` | `BACKGROUND_DISPUTE_LOST` |
| Explicit catalog retirement | Active ownership -> `RETIRED`; wallet +1 | `BACKGROUND_OWNERSHIP_RETIRED` plus immutable credit entry |
| Deterministic repair | Verified stale ownership projection -> expected state | `COMMERCE_REVERSAL_RECONCILED` |

Every processor event also receives a unique `CommerceWebhookReceipt` in the
same transaction as its domain transition.

## Validation

- Focused Task 8 plus Task 7 regression:
  - `node --test tests/background-reversals.test.mjs tests/commerce-reconcile.test.mjs tests/background-fulfillment.test.mjs tests/stripe-billing.test.mjs`
  - PASS, 71/71 tests.
- Full repository tests:
  - `npm run test`
  - PASS, 1,274/1,274 tests across 136 suites.
- `npm run typecheck`
  - PASS.
- `npm run lint`
  - PASS with no errors or warnings.
- `git diff --check`
  - PASS; only expected Windows line-ending notices were emitted.

## Risks And Follow-up Boundary

- No live Stripe request or production database mutation was performed.
- Task 9's full-admin service remains responsible for authorization and for
  adapting `createProcessorRefund` to `stripe.refunds.create` with the supplied
  amount, metadata, and idempotency key.
- Reconciliation intentionally does not guess at ownership or aggregate
  repairs. Repair mode is limited to the stable-idempotency pending-refund
  resume path; all other findings remain identifier-only operator reports.
- Catalog-wide retirement orchestration and cache invalidation belong to the
  future operator surface; this task provides the atomic ownership-specific
  transition.

## Commit

- `feat: reconcile commerce reversals` (this Task 8 commit)
- `fix: harden commerce reversal recovery` (review follow-up)
- `fix: freeze terminal commerce disputes` (terminal-ordering follow-up)
