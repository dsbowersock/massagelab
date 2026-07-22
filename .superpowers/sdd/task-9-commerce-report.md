# Task 9 Commerce Operations Report

Date: 2026-07-21
Branch: `codex/background-commerce-foundation`
Task: Track 1A Task 9, safe user APIs and full-admin operations

## Status

Complete. User-owned commerce state, credit redemption, and persistent cart
operations now use fresh database-verified identity checks and private no-store
responses. Full account administrators have a separate, freshly authorized
operator queue and order-detail surface for exact-item refunds and deterministic
reconciliation. Anatomy-scoped administration does not grant commerce authority.

## RED Evidence

1. Safe snapshot and admin authority:
   - Command: `node --test tests/background-commerce-api.test.mjs tests/commerce-admin.test.mjs`
   - Expected failures: `ERR_MODULE_NOT_FOUND` for
     `lib/commerce/snapshot-service.ts` and `lib/commerce/admin-access.ts`.
2. User API routes:
   - Command: `node --test tests/background-commerce-api.test.mjs`
   - Expected failure: `ERR_MODULE_NOT_FOUND` for
     `app/api/background-commerce/state/route.ts` before the state, redeem, and
     cart route slice existed.
3. Admin refund/reconciliation service:
   - Command: `node --test tests/commerce-admin.test.mjs`
   - Expected failure: `ERR_MODULE_NOT_FOUND` for
     `lib/commerce/admin-service.ts`.
4. Order detail and operator pages/actions:
   - Expected failures: missing `getCommerceAdminOrderDetail` export, followed by
     `ENOENT` for `app/admin/commerce/actions.ts` before the final page/action
     slice was implemented.

## Authorization Matrix

| Identity | User commerce APIs | Commerce admin pages/actions |
| --- | --- | --- |
| Anonymous | Denied (`AUTH_REQUIRED`) | Denied; page redirects to sign-in |
| Missing database user | Denied (`AUTH_REQUIRED`) | Denied |
| Unverified account | Denied (`EMAIL_VERIFICATION_REQUIRED`) | Denied |
| Ordinary verified account | Allowed for own state/cart/redeem | Denied |
| Verified therapist | Allowed for own state/cart/redeem | Denied |
| Verified anatomy admin only | Allowed for own state/cart/redeem | Denied |
| Pending `ADMIN` assignment | Allowed for own state/cart/redeem | Denied |
| Verified `ADMIN` assignment | Allowed for own state/cart/redeem | Allowed |

Every route reloads the session user from the database. Every server action calls
`requireCommerceAdminUser` inside the action before reading input or mutating.
The commerce helper uses verified `ADMIN` role assignments through
`canAdministerAccounts`; it does not reuse `requireAnatomyAdminUser`.

## Safe User Snapshot

The response contains exactly:

- `creditBalance`
- `ownedBackgroundIds` for active ownership only
- `ownerships`: `backgroundId`, normalized source/status, and `acquiredAt`
- `cart`: the established `CommerceCartSnapshot`
- `recentOrders`: internal order ID, status, item count, subtotal, tax, total,
  currency, and creation time

The projection excludes Stripe identifiers, payment-method data, email,
IP/user-agent/legal-acceptance detail, raw metadata/events, ledger idempotency
keys, processor payloads, and internal failure detail. No React/server cache is
used, and route responses set `Cache-Control: private, no-store`, so committed
wallet, ownership, order, and cart changes are visible on the next read.

## Behavior

- `GET /api/background-commerce/state` returns the safe combined snapshot.
- `POST /api/background-commerce/credits/redeem` requires a valid background ID,
  literal confirmation, and a non-empty idempotency key before calling the
  existing serializable redemption service.
- `GET`, `POST`, and `DELETE /api/background-commerce/cart` delegate to the
  existing persistent cart service and expose only background item mutations.
- Known `CommerceError` values retain stable public code/message/status JSON;
  unknown failures collapse to the established generic commerce error.
- The admin queue lists `REVIEW_REQUIRED` orders, pending refunds, open disputes,
  and deterministic reconciliation findings using internal account/order IDs plus
  one minimum account label.
- Order detail projects immutable item/amount/status/audit history without raw
  event payloads or processor identifiers.
- Exact-item refund preparation requires a bounded reason, distinct items from
  the target paid order, current purchase ownership, no pending/succeeded refund,
  and a deterministic sum within the succeeded payment amount. The existing
  reversal service revalidates the selection transactionally, writes the
  `BACKGROUND_REFUND_INITIATED` audit event, and performs the processor request
  outside the transaction with its stable idempotency key.
- Reconciliation actions pass only an exact identifier-based issue to the
  existing evidence-rechecking repair service. No heuristic repair is exposed.

## Visual And Performance Notes

- Both operator pages are React Server Components and add no client bundle.
- The list uses one relational server read; dashboard anatomy metrics and the
  full-admin commerce queue run in parallel after authority is known.
- Only rendered safe fields cross the page boundary; no processor objects are
  serialized.
- Pages reuse the existing `AppPageShell`, Card, and Button treatments with a
  compact responsive list/detail layout. No public purchase UI or Track 1B
  picker work was added.
- Production build validation covered the two new admin routes and three API
  routes. No separate browser screenshot review was performed for this minimal
  operator-only surface.

## Validation

- Focused Task 9:
  - `node --test tests/background-commerce-api.test.mjs tests/commerce-admin.test.mjs`
  - PASS, 14/14 tests.
- Task 9 plus Task 8/7 regressions:
  - `node --test tests/background-commerce-api.test.mjs tests/commerce-admin.test.mjs tests/background-reversals.test.mjs tests/commerce-reconcile.test.mjs tests/background-fulfillment.test.mjs tests/stripe-billing.test.mjs`
  - PASS, 85/85 tests.
- Full repository tests:
  - `npm run test`
  - PASS, 1,288/1,288 tests across 138 suites.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with zero errors; two pre-existing warnings remain in
  untouched `lib/commerce/fulfillment-service.ts` and
  `tests/background-checkout.test.mjs`.
- `npm run build`: PASS; route collection includes `/admin/commerce`,
  `/admin/commerce/[orderId]`, and all three new user APIs.
- `git diff --check`: PASS; only the expected Windows line-ending notice was
  emitted.

## Commit

- `feat: expose secure background commerce operations`
