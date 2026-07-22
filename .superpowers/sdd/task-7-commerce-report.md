# Task 7 Commerce Fulfillment Report

Date: 2026-07-21
Branch: codex/background-commerce-foundation
Task: Track 1A Task 7, idempotent permanent-background fulfillment from Stripe webhooks

## Status

Complete. Signed Checkout webhooks now explicitly separate permanent-background
commerce, donations, memberships, and unknown explicit purposes. Background
fulfillment retrieves processor evidence before opening a short serializable
database transaction, then commits the webhook receipt and every won domain
transition atomically.

## RED Evidence

1. Initial fulfillment RED:
   - Command: node --test tests/background-fulfillment.test.mjs
   - Expected failure: ERR_MODULE_NOT_FOUND for the planned
     lib/commerce/fulfillment-service.ts.
2. Stripe dispatch and retrieval RED:
   - Command: node --test tests/stripe-billing.test.mjs
   - Expected failures: classifyStripeCheckoutSessionPurpose and
     retrieveBackgroundPurchaseCheckoutSessionForFulfillment were undefined;
     13/15 tests passed.
3. Unsuccessful-event ordering RED:
   - Command: node --test tests/background-fulfillment.test.mjs
   - Expected failures: failed-then-expired ended EXPIRED rather than
     PAYMENT_FAILED, and late completed-pending revived PAYMENT_FAILED to
     AWAITING_PAYMENT; 16/18 tests passed.
4. Lost-transition payment monotonicity RED:
   - Command: node --test tests/background-fulfillment.test.mjs
   - Expected failure: an unpaid event that lost its order predicate still
     downgraded the payment from SUCCEEDED to FAILED; 18/19 tests passed.

## Files And Behavior

- lib/commerce/fulfillment-service.ts
  - Adds one database-only fulfillment boundary for completed, async-succeeded,
    async-failed, and expired background Checkout events.
  - Inserts CommerceWebhookReceipt in the same transaction as every order,
    payment, item, ownership, cart, and CommerceEvent mutation.
  - Recovers duplicate receipt races without repeating fulfillment.
  - Binds Task 6's unbound PREPARING/AWAITING_PAYMENT order only from signed,
    retrieved Session metadata; it never creates or replaces a Checkout Session.
  - Reconciles purpose/schema, order/user/customer, final U.S. country, currency,
    subtotal/tax/total, payment intent, item keys, display names, quantities, line
    amounts, and fulfillment-adapter snapshots before granting ownership.
  - Creates purchase ownerships as one atomic createMany statement, fulfills all
    items together, releases the reservation, and removes only the purchased cart
    rows after a fully reconciled payment.
  - Preserves credit ownership conflicts, marks only the conflicting purchase
    item failed, leaves other items pending, records REVIEW_REQUIRED, and never
    overwrites the credit source or initiates an automatic refund.
  - Uses explicit status and fulfillment predicates. Paid, fulfilled, partially
    refunded, refunded, and review states cannot be regressed by late failed or
    expired events. PAYMENT_FAILED deterministically outranks EXPIRED when both
    unsuccessful events arrive, and a late pending completion cannot revive a
    failed order.
  - Stores only the sanitized processor event timestamp in CommerceEvent payload;
    raw Stripe payloads are not persisted.
- app/api/billing/webhook/route.ts
  - Preserves raw request-body signature verification.
  - Dispatches background_purchase to commerce, donation to the existing no-
    entitlement behavior, compatible absent-purpose subscription Sessions to
    existing membership reconciliation, and unknown explicit purposes to a safe
    acknowledgement with no domain mutation.
  - Retrieves expanded line-item Product metadata and PaymentIntent evidence
    before fulfillment opens its database transaction.
  - Clears the existing membership account surface only after a committed
    commerce mutation.
- lib/stripe-billing.js
  - Adds stable productType/productKey metadata to each inline background Product.
  - Adds explicit purpose classification and expanded fulfillment retrieval.
  - Keeps membership reconciliation from interpreting donations, background
    purchases, or unknown explicit purposes as subscriptions.
- tests/background-fulfillment.test.mjs
  - Covers valid paid fulfillment, unbound order binding, same-event replay, two
    event IDs for one Session, paid terminal monotonicity, both failed/expired
    orders, late pending delivery, lost transition races, failed-to-paid recovery,
    purpose/order/user/customer/country/currency/totals/item mismatches, credit
    ownership conflicts, and all-or-review adapter behavior.
- tests/stripe-billing.test.mjs
  - Covers explicit Checkout purpose classification and expanded retrieval.

## Validation

- node --test tests/background-fulfillment.test.mjs tests/stripe-billing.test.mjs
  - PASS, 35/35 tests across 2 suites after the expired-session review fix.
- node --test tests/background-checkout.test.mjs tests/background-fulfillment.test.mjs tests/stripe-billing.test.mjs
  - PASS, 61/61 tests across 6 suites after the expired-session review fix.
- npm run test
  - PASS, 1,238/1,238 tests across 135 suites after the expired-session
    review fix.
- npm run typecheck
  - PASS.
- npm run lint
  - PASS.
- git diff --check
  - PASS; Windows LF/CRLF normalization warnings only.

## Risks And Review Notes

- The schema has no dedicated processor-event-created timestamp column. Task 7
  therefore uses explicit conditional order/fulfillment predicates as the
  authoritative monotonic guard and stores the sanitized Stripe event created
  timestamp in CommerceEvent payload for audit evidence. A future schema change
  may add a first-class provider timestamp if reconciliation needs temporal
  queries beyond the deterministic status table.
- Product keys are now written to inline Stripe Product metadata. Existing Task 6
  test Sessions created before this change are not production state; production
  purchasing remains behind the readiness kill switch.
- No live Stripe request and no production database mutation were performed.

## Commit

- e28ac44 feat: fulfill background purchases from webhooks
- Planned review-fix commit: fix: expire unpaid background checkouts safely

## Important Expired-Session Review Fix

Date: 2026-07-21

### RED Evidence

- Command: node --test tests/background-fulfillment.test.mjs
- Result: FAIL, 19/20 tests passed.
- Exact defect: a valid Stripe v22 expired/unpaid Session with trusted Session,
  order, user, customer, currency, amount, and item binding evidence but
  customer_details=null and payment_intent=null transitioned to REVIEW_REQUIRED
  instead of EXPIRED.

### Fix

- Final U.S. billing-country evidence remains mandatory before paid ownership
  fulfillment.
- Expired/unpaid handling no longer requires final country evidence that Stripe
  does not guarantee on an abandoned Session.
- Stable Session/order/user/customer binding, schema version, currency,
  subtotal/tax/total, line-item keys, quantities, amounts, and adapter snapshots
  remain required when present in the retrieved Session.
- Expiry still grants no ownership, creates no payment without a PaymentIntent,
  clears the reservation, and preserves the cart.

### Final Validation

- Focused Task 7: PASS, 35/35.
- Task 6 checkout plus Task 7: PASS, 61/61.
- Full npm test: PASS, 1,238/1,238 across 135 suites.
- npm run typecheck: PASS.
- npm run lint: PASS.
- git diff --check: PASS; Windows LF/CRLF normalization warnings only.
