# Background Commerce and Ownership Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every email-verified account two permanent-background credits exactly once, add durable carts/orders/payments/ownership/reversal records, and fulfill $1 USD background purchases safely through Stripe.

**Architecture:** Add a generic transactional commerce core with a background-product adapter, current-state wallet/ownership/order tables, and append-only credit/commerce audit records. Resolve premium access from subscription feature keys plus current database ownership. Stripe webhooks are the fulfillment authority; database uniqueness, conditional writes, and Prisma transactions provide idempotency without session-level advisory locks.

**Tech Stack:** Next.js App Router, React 19, TypeScript/JavaScript with focused JSDoc, Prisma 7, Neon Postgres, Stripe Checkout/webhooks, Node test runner, existing account/legal/cache infrastructure.

**Approved design:** `docs/superpowers/specs/2026-07-18-background-commerce-ownership-design.md`

**2026-07-23 tax amendment:** Paid background checkout must not ship with tax
disabled. It requires Stripe automatic tax, explicit product-code and
provider/registration readiness, and webhook-time reconciliation of Stripe's
order and per-item tax amounts before fulfillment. The purchasing kill switch
stays off until the Ohio registration and product classification are reviewed.

## Global constraints

- Start from refreshed `main` on a new branch; suggested name: `codex/background-commerce-foundation`.
- Preserve the user-owned `TODO.md` edit and exclude it from every commit.
- This is Track 1A only. Do not build acquisition dialogs, cart presentation, or Account/Billing portfolio UI here.
- Keep background fulfillment generic enough for later product types, but implement only the `background` adapter now.
- Use integer minor units (`100` cents) and lowercase ISO currency (`usd`) everywhere. Never use floating-point money.
- Treat Stripe webhooks and verified database state as authoritative. Never grant ownership from a success URL, client callback, session claim, JWT, or cart state.
- Every mutation reloads `User.emailVerified` from the database. Session `emailVerified` is display context, not authorization.
- Do not use Neon session advisory locks. Runtime uses pooled transaction mode; rely on unique/check constraints, row updates with predicates, and serializable/retried Prisma transactions where required.
- Test the migration on an isolated Neon branch before any shared database. Use the repo's direct migration connection path, while application runtime retains the pooled `DATABASE_URL` contract.
- Do not enable automatic tax or international checkout until registrations, product tax code, and readiness checks are explicitly configured. Purchases initially fail closed outside the United States.
- Preserve membership subscriptions, donations, and their existing legal flows. Route commerce webhook events by explicit metadata purpose.
- Background ownership is permanent unless a refund, dispute loss, or approved retirement transition changes its recorded status. Never delete ownership, order, payment, credit, refund, dispute, or audit history.

## Target file map

- Modify `prisma/schema.prisma`; create `prisma/migrations/20260718120000_background_commerce_foundation/migration.sql`.
- Create `lib/commerce/constants.js`, `lib/commerce/errors.ts`, `lib/commerce/catalog.ts`, and `lib/commerce/transactions.ts`.
- Create `lib/commerce/credit-service.ts`, `lib/commerce/background-access.ts`, `lib/commerce/cart-service.ts`, `lib/commerce/order-service.ts`, `lib/commerce/fulfillment-service.ts`, `lib/commerce/reversal-service.ts`, and `lib/commerce/snapshot-service.ts`.
- Create `lib/commerce/admin-access.ts` and `lib/commerce/admin-service.ts`.
- Create `app/api/background-commerce/state/route.ts`, `app/api/background-commerce/credits/redeem/route.ts`, `app/api/background-commerce/cart/route.ts`, `app/api/background-commerce/checkout/route.ts`, and `app/api/background-commerce/checkout/cancel/route.ts`.
- Create `app/admin/commerce/page.tsx`, `app/admin/commerce/[orderId]/page.tsx`, and `app/admin/commerce/actions.ts`.
- Create `scripts/background-credit-backfill.mjs` and `scripts/commerce-reconcile.mjs`; add named scripts to `package.json`.
- Modify `lib/auth-users.ts`, `app/verify-email/page.tsx`, and `app/api/account/security/password/route.ts`.
- Modify `components/backgrounds/backgroundRegistry.ts`, `lib/membership.js`, `lib/stripe-billing.js`, `app/api/billing/webhook/route.ts`, `lib/legal-documents.js`, `lib/legal-acceptance.js`, and `scripts/stripe-readiness-check.mjs`.
- Add focused tests named in the tasks below; update `docs/wiki/billing-memberships.md`, `docs/project-state.md`, and `docs/project-log.md` only after validation.

---

## Task 1: Add the transactional commerce schema and migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260718120000_background_commerce_foundation/migration.sql`
- Create: `tests/commerce-schema.test.mjs`

- [ ] **Step 1: Write a failing schema contract test**

Read `prisma/schema.prisma` and the migration as text. Assert the presence of these models and database constraints before implementation:

```js
const requiredModels = [
  "CommerceCart",
  "CommerceCartItem",
  "CommerceOrder",
  "CommerceOrderItem",
  "CommercePayment",
  "CommerceRefund",
  "CommerceRefundItem",
  "CommerceDispute",
  "CommerceEvent",
  "CommerceWebhookReceipt",
  "BackgroundCreditWallet",
  "BackgroundCreditEntry",
  "BackgroundOwnership",
];
```

Assert unique keys for one cart and wallet per user, one cart item per product, one ownership per user/background, one webhook receipt per provider/event ID, one credit idempotency key, one Stripe session/payment ID, and one source order item or source credit entry per ownership. Assert a partial unique index allowing only one `PREPARING`/`AWAITING_PAYMENT` order per user. Assert SQL `CHECK` constraints for nonnegative balances/money and exactly one acquisition source.

Run: `node --test tests/commerce-schema.test.mjs`

Expected: FAIL because the models and migration do not exist.

- [ ] **Step 2: Add explicit domain enums**

Add Prisma enums for order, payment, fulfillment, refund, dispute, ownership source/status, and credit entry type. Use these exact lifecycle values:

```prisma
enum BackgroundOwnershipStatus {
  ACTIVE
  REFUND_PENDING
  DISPUTE_SUSPENDED
  REFUND_REVOKED
  DISPUTE_REVOKED
  RETIRED
}

enum BackgroundCreditEntryType {
  INITIAL_GRANT
  REDEMPTION
  RETIREMENT_REPLACEMENT
  ADMIN_CORRECTION
}
```

Order status must distinguish `PREPARING`, `AWAITING_PAYMENT`, `PAID`, `PAYMENT_FAILED`, `CANCELED`, `EXPIRED`, `REVIEW_REQUIRED`, `PARTIALLY_REFUNDED`, and `REFUNDED`. Disputes distinguish `OPEN`, `WON`, and `LOST`.

- [ ] **Step 3: Add generic commerce records**

Use `productType` plus `productKey` on cart/order items and retain immutable display-name/unit-price/currency snapshots on order items. Store processor identifiers only in server records. Add `reservationExpiresAt`, versioned legal-acceptance JSON, purchase country, return path, failure code, and fulfillment timestamps to orders. Add append-only `CommerceEvent` payload JSON containing identifiers and state transitions only—never email, card data, IP addresses, or Stripe object dumps.

- [ ] **Step 4: Add wallet and ownership records**

`BackgroundCreditWallet.balance` is current state; every delta has a `BackgroundCreditEntry`. `BackgroundOwnership` has exactly one acquisition source: a credit entry or an order item. Keep inactive rows; status transitions replace deletion. Ephemeral `CommerceCart`/`CommerceCartItem` rows may cascade with the account. Durable wallet, credit-entry, ownership, order, payment, refund, dispute, webhook-receipt, and commerce-event relations use `onDelete: Restrict`, matching `LegalAcceptance`. MassageLab has no account-deletion workflow today; a later dedicated branch must define lawful retention plus atomic anonymization before deleting a user with durable commerce history. Track 1 must test that such deletion is blocked instead of silently cascading financial/audit records.

- [ ] **Step 5: Write the SQL migration and database checks**

Generate the migration, inspect it, then add named PostgreSQL checks and the active-order partial unique index that Prisma cannot express. The migration must be forward-only and must not grant credits yet.

Run: `npm run prisma:generate`

Run: `npm run prisma:validate`

Expected: both PASS.

- [ ] **Step 6: Validate on an isolated Neon branch**

Create or select a disposable Neon branch through the normal project workflow. Point the migration command at its direct/unpooled connection. Apply the migration, run `npx prisma migrate status`, inspect all constraints, then delete the disposable branch through Neon after validation. Do not expose connection strings in logs or docs.

- [ ] **Step 7: Run the schema test and commit**

Run: `node --test tests/commerce-schema.test.mjs`

Expected: PASS.

```powershell
git add prisma/schema.prisma prisma/migrations/20260718120000_background_commerce_foundation/migration.sql tests/commerce-schema.test.mjs
git commit -m "feat: add background commerce data model"
```

---

## Task 2: Define money, catalog, transaction, and error contracts

**Files:**

- Create: `lib/commerce/constants.js`
- Create: `lib/commerce/errors.ts`
- Create: `lib/commerce/catalog.ts`
- Create: `lib/commerce/transactions.ts`
- Create: `tests/commerce-core.test.mjs`

- [ ] **Step 1: Write failing pure contract tests**

Cover fixed price/currency, United-States availability, safe return-path normalization, distinct background cart items, current/future enabled premium registry entries, retired/unavailable rejection, bounded checkout quantities, explicit disabled/Stripe tax readiness, and stable public error codes.

Use this public surface:

```ts
export const BACKGROUND_UNIT_AMOUNT = 100;
export const COMMERCE_CURRENCY = "usd";
export const CHECKOUT_RESERVATION_MINUTES = 30;
export const COMMERCE_PRODUCT_BACKGROUND = "background";
export const COMMERCE_PURCHASE_COUNTRIES = Object.freeze(["US"]);

export type CommerceProduct = {
  productType: "background";
  productKey: string;
  displayName: string;
  unitAmount: 100;
  currency: "usd";
  availableForPurchase: boolean;
};

export function resolveCommerceProduct(productType: string, productKey: string): CommerceProduct;
export function normalizeCommerceReturnPath(value: unknown): string;
export function getCommerceTaxReadiness(env?: NodeJS.ProcessEnv): {
  mode: "disabled" | "stripe";
  ready: boolean;
  taxCode: string | null;
};
```

Run: `node --test tests/commerce-core.test.mjs`

Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Implement constants and typed domain errors**

Use a `CommerceError` with a stable code, safe public message, and HTTP status. Include codes for authentication, verification, catalog unavailable, already owned, no credit, reserved cart, empty cart, legal consent, country unavailable, tax not ready, and stale concurrency. Do not surface database or Stripe messages.

- [ ] **Step 3: Implement the background catalog adapter**

Adapt enabled registry entries with `requiresSubscription: true`. Reuse landed `lib/background-catalog.js` if Track 3 has already introduced it; otherwise keep the adapter beside the registry and migrate imports later. Registry/UI state may describe products but never proves ownership or payment.

- [ ] **Step 4: Add a bounded transaction retry helper**

Wrap Prisma serializable transactions only around short database work. Retry known write-conflict/deadlock codes at most three times with jitter; never call Stripe inside a database transaction. Document why the pooled Neon runtime cannot use session advisory locks.

- [ ] **Step 5: Pass focused tests and commit**

Run: `node --test tests/commerce-core.test.mjs`

Expected: PASS.

```powershell
git add lib/commerce/constants.js lib/commerce/errors.ts lib/commerce/catalog.ts lib/commerce/transactions.ts tests/commerce-core.test.mjs
git commit -m "feat: define commerce domain contracts"
```

---

## Task 3: Provision two credits exactly once for every verified account

**Files:**

- Create: `lib/commerce/credit-service.ts`
- Create: `scripts/background-credit-backfill.mjs`
- Modify: `lib/auth-users.ts`
- Modify: `app/verify-email/page.tsx`
- Modify: `app/api/account/security/password/route.ts`
- Modify: `package.json`
- Create: `tests/background-credit-service.test.mjs`
- Create: `tests/background-credit-backfill.test.mjs`

- [ ] **Step 1: Write failing provisioning tests**

Test one initial grant of exactly two credits, repeated calls returning the existing wallet, concurrent calls creating one wallet/entry, unverified users receiving nothing, and a wallet/ledger mismatch failing closed for reconciliation. Use an idempotency key derived from the user, not a random request ID:

```ts
export const INITIAL_BACKGROUND_CREDIT_COUNT = 2;

export async function ensureVerifiedUserBackgroundCredits(
  prismaClient: PrismaClientOrTransaction,
  userId: string,
): Promise<{ balance: number; granted: boolean }>;
```

Run: `node --test tests/background-credit-service.test.mjs`

Expected: FAIL because the service does not exist.

- [ ] **Step 2: Implement atomic initial provisioning**

Inside one retried serializable transaction, reload `User.emailVerified`, create the wallet with balance two and an `INITIAL_GRANT` entry with delta two, and append a commerce event. Use unique constraints to make retries harmless. If a wallet already exists, validate that the initial entry exists and return it without changing balance.

- [ ] **Step 3: Route every verification path through the service**

After a database transition to verified, call the shared service from:

- `ensureGoogleUserState` in `lib/auth-users.ts`;
- token verification in `app/verify-email/page.tsx`;
- password creation verification in `app/api/account/security/password/route.ts`.

Keep the verification update and credit grant in the same transaction when the current flow permits it. Add a lazy repair call when verified account state is loaded so accounts missed during deployment self-heal safely.

- [ ] **Step 4: Add a resumable existing-account backfill**

`scripts/background-credit-backfill.mjs` selects verified users lacking wallets in stable ID batches, calls the same service, emits counts only, and supports dry-run plus a bounded `--limit`. Add:

```json
"commerce:backfill-credits": "node scripts/background-credit-backfill.mjs"
```

The script must never log email addresses, database URLs, or ledger payloads.

- [ ] **Step 5: Test backfill idempotency**

Test mixed verified/unverified accounts, restart after a partial batch, repeated full runs, and a concurrently provisioned account. The second completed run reports zero grants.

Run: `node --test tests/background-credit-service.test.mjs tests/background-credit-backfill.test.mjs`

Expected: PASS.

- [ ] **Step 6: Run a dry-run against the isolated branch and commit**

Run: `npm run commerce:backfill-credits -- --dry-run`

Expected: prints only eligible/already-provisioned counts and makes no writes.

```powershell
git add lib/commerce/credit-service.ts scripts/background-credit-backfill.mjs lib/auth-users.ts app/verify-email/page.tsx app/api/account/security/password/route.ts package.json tests/background-credit-service.test.mjs tests/background-credit-backfill.test.mjs
git commit -m "feat: provision verified account background credits"
```

---

## Task 4: Add the canonical permanent-access and credit-redemption services

**Files:**

- Create: `lib/commerce/background-access.ts`
- Modify: `components/backgrounds/backgroundRegistry.ts`
- Modify: `lib/membership.js`
- Create: `tests/background-access.test.mjs`
- Create: `tests/background-credit-redemption.test.mjs`
- Modify: `tests/background-options.test.mjs`
- Modify: `tests/chimer-entitlements.test.mjs`

- [ ] **Step 1: Write failing access tests**

Cover free backgrounds, an active `premium_backgrounds` subscription, active credit/purchase ownership, subscription cancellation, refund/dispute/retired statuses, current/future premium IDs, and fresh database reads. Lock the resolver to:

```ts
export type BackgroundAccessDecision = {
  canUse: boolean;
  canCustomizeColors: boolean;
  accessSource: "free" | "subscription" | "ownership" | "locked";
  isPermanentlyOwned: boolean;
  ownershipStatus: BackgroundOwnershipStatus | null;
  creditEligibility: { eligible: boolean; disabledReason: string | null };
  purchaseEligibility: { eligible: boolean; disabledReason: string | null };
  reservation: { active: boolean; orderId: string | null; expiresAt: string | null };
  disabledReason: string | null;
};

export async function resolveBackgroundAccessForUser(input: {
  prismaClient: PrismaClientOrTransaction;
  userId: string;
  backgroundId: string;
}): Promise<BackgroundAccessDecision>;
```

`canUse` is true for `premium_backgrounds` or active permanent ownership. `canCustomizeColors` is true for `chimer_custom_colors` or active permanent ownership of that background. The two feature checks are independent. `isPermanentlyOwned` is true only for active credit/purchase ownership, even when subscription access also exists. Eligibility, reservation, and safe disabled-reason fields come from the same fresh server transaction so Track 1B never reconstructs them from badges, feature keys, cart rows, or stale client state.

- [ ] **Step 2: Remove the compatibility shortcut**

After the resolver is available, change `hasPremiumBackgroundAccess` so `chimer_custom_colors` no longer grants premium use. Paid membership definitions retain both feature keys, so paid behavior is unchanged. Update registry helpers to consume a resolved access decision or owned-ID snapshot instead of pretending feature keys express ownership.

- [ ] **Step 3: Write failing redemption lifecycle tests**

Cover explicit confirmation, one-credit decrement, one active ownership, non-swappability, repeated/idempotent request, no-credit rejection, already-owned rejection, free/disabled/unknown background rejection, checkout-reserved rejection, concurrent last-credit requests, and subscriber redemption while subscribed.

```ts
export async function redeemBackgroundCredit(input: {
  prismaClient: PrismaClient;
  userId: string;
  backgroundId: string;
  confirmationAccepted: true;
  idempotencyKey: string;
}): Promise<{ backgroundId: string; remainingCredits: number }>;
```

- [ ] **Step 4: Implement redemption as one atomic transaction**

Reload verification, product state, reservation state, wallet balance, and ownership. Decrement with `where: { balance: { gte: 1 } }`, create a `REDEMPTION` entry, create active ownership sourced only from that entry, and append an audit event. Any uniqueness collision resolves to the existing idempotent result only when request/user/background match; otherwise return a safe conflict.

- [ ] **Step 5: Pass focused tests and commit**

Run: `node --test tests/background-access.test.mjs tests/background-credit-redemption.test.mjs tests/background-options.test.mjs tests/chimer-entitlements.test.mjs`

Expected: PASS.

```powershell
git add lib/commerce/background-access.ts components/backgrounds/backgroundRegistry.ts lib/membership.js tests/background-access.test.mjs tests/background-credit-redemption.test.mjs tests/background-options.test.mjs tests/chimer-entitlements.test.mjs
git commit -m "feat: resolve permanent background access"
```

---

## Task 5: Implement the persistent account cart and reservation lifecycle

**Files:**

- Create: `lib/commerce/cart-service.ts`
- Create: `lib/commerce/order-service.ts`
- Create: `tests/commerce-cart.test.mjs`
- Create: `tests/commerce-reservations.test.mjs`

- [ ] **Step 1: Write failing cart tests**

Test one account cart across requests/devices, add/remove idempotency, duplicate suppression, multiple distinct items, owned/free/retired/unavailable pruning with typed notices, subscriber retention, sign-out persistence, stable ordering, and a computed subtotal of `$1` per remaining item.

```ts
export async function getCommerceCartSnapshot(input: CartServiceInput): Promise<CommerceCartSnapshot>;
export async function addCommerceCartItem(input: CartMutationInput): Promise<CommerceCartSnapshot>;
export async function removeCommerceCartItem(input: CartMutationInput): Promise<CommerceCartSnapshot>;

export type CommerceCartSnapshot = {
  items: CommerceProduct[];
  reservedOrder: { orderId: string; expiresAt: string } | null;
  subtotalAmount: number;
  currency: "usd";
  notices: Array<{ code: string; productKey: string }>;
};
```

- [ ] **Step 2: Implement server-side reconciliation on every cart read/mutation**

Reload ownership and catalog inside the service. Delete invalid cart rows transactionally and return safe notice codes. Never remove an item merely because a subscription currently includes it. Reject unverified accounts before revealing commerce state.

- [ ] **Step 3: Write failing reservation tests**

Cover exactly one active order per user, 30-minute expiry, all cart items bound to the order snapshot, inability to remove/redeem/re-reserve bound items, cancellation release, expiration release, double-submit idempotency, and an expired order never becoming the active reservation.

- [ ] **Step 4: Implement prepare/cancel/expire order operations**

`prepareBackgroundOrder` reconciles the cart and legal/country readiness, then creates the order and immutable order items inside one transaction. Do not call Stripe yet. `cancelPreparedOrder` and `expirePreparedOrders` transition status and clear reservations without deleting rows. Rely on Task 1's active-order partial unique index as the final database guard.

- [ ] **Step 5: Pass focused tests and commit**

Run: `node --test tests/commerce-cart.test.mjs tests/commerce-reservations.test.mjs`

Expected: PASS.

```powershell
git add lib/commerce/cart-service.ts lib/commerce/order-service.ts tests/commerce-cart.test.mjs tests/commerce-reservations.test.mjs
git commit -m "feat: add persistent commerce cart reservations"
```

---

## Task 6: Add versioned digital-purchase consent and checkout creation

**Files:**

- Modify: `lib/legal-documents.js`
- Modify: `lib/legal-acceptance.js`
- Modify: `lib/stripe-billing.js`
- Create: `app/api/background-commerce/checkout/route.ts`
- Create: `app/api/background-commerce/checkout/cancel/route.ts`
- Modify: `tests/legal-documents.test.mjs`
- Modify: `tests/legal-acceptance.test.mjs`
- Create: `tests/background-checkout.test.mjs`

- [ ] **Step 1: Add failing legal-document tests**

Add the `digital-purchases-refunds` document key and `digital-purchase` acceptance event without changing membership `checkout`. Require the current Terms, Privacy Policy, and Digital Purchases & Refund Policy. Test versioned IDs and this evidence captured from one combined, unchecked per-order consent control:

```ts
type DigitalPurchaseConsent = {
  documentIds: string[];
  documentVersions: Record<string, string>;
  combinedConsentAccepted: true;
  acceptedAt: string;
};
```

The UI control is unchecked for every order and combines policy acceptance, final-sale acknowledgment, and the request for immediate delivery. A past account-level acceptance does not replace the per-order consent snapshot.

- [ ] **Step 2: Write failing checkout-route tests**

Cover signed-in/verified requirements, nonempty reconciled cart, explicit current consent, provisional U.S. request context, required Stripe billing-address collection, production purchasing enablement, tax-readiness fail-closed behavior, exactly one line item per distinct background at 100 cents, 30-minute session expiry, explicit metadata, safe success/cancel URLs, subscriber purchase, and Stripe failure returning the order to a retryable state. Treat browser-submitted country as untrusted. Bind the final order country only from the retrieved Stripe Session's `customer_details.address.country`, require `US`, and revalidate it before fulfillment; missing or non-U.S. processor evidence transitions the order to `REVIEW_REQUIRED` without granting ownership.

Stripe metadata must include only stable identifiers:

```js
{
  purpose: "background_purchase",
  orderId,
  userId,
  schemaVersion: "2",
  taxMode: "stripe",
  taxCode: "<reviewed Stripe Tax code>",
  taxBehavior: "exclusive",
}
```

- [ ] **Step 3: Add a dedicated background Checkout helper**

Do not overload subscription or donation helpers with ambiguous behavior. Add `createBackgroundPurchaseCheckoutSession` using `mode: "payment"`, `customer`, `billing_address_collection: "required"`, one line item per order item, `expires_at` 30 minutes from creation, metadata on both session and payment intent, and an idempotency key derived from order ID plus checkout attempt. Use inline price data at the fixed amount until a catalog-price migration is deliberately planned. Set `automatic_tax.enabled` only when `BACKGROUND_COMMERCE_TAX_MODE=stripe` and a configured digital-product tax code passes readiness; otherwise keep it false.

Add a separate `BACKGROUND_COMMERCE_PURCHASING_ENABLED=true` production kill switch. Both the route and Stripe helper call one `assertBackgroundCommercePurchasingReady` guard that requires the switch plus legal, catalog, U.S.-country, tax, webhook, and reconciliation readiness. A valid disabled-tax posture alone is never sufficient to enable purchasing.

- [ ] **Step 4: Implement checkout creation without a long transaction**

1. Validate auth, verification, country, tax readiness, and submitted consent.
2. Prepare/reserve the order in a short database transaction.
3. Ensure the existing Stripe customer outside that transaction.
4. Create the Stripe session outside that transaction.
5. Persist session ID, expiry, and `AWAITING_PAYMENT` using a conditional update from `PREPARING`.
6. If that conditional update loses a race, retrieve the local order and Stripe Session: expire a still-unpaid Session before releasing/restoring local reservation state, leave a paid Session for monotonic webhook fulfillment, and return the already-associated Session only when identifiers match.
7. If Stripe creation fails, conditionally mark `PAYMENT_FAILED` and release reservations only while the order remains `PREPARING`.

Return only `{ url, orderId }`; never return processor objects.

- [ ] **Step 5: Implement explicit cancellation**

The cancel route validates order ownership, expires an open Stripe Session when present, retrieves its final payment status, then conditionally transitions only `PREPARING`/`AWAITING_PAYMENT` unpaid orders and releases items in one transaction. Payment completion and fulfillment use their own monotonic predicates, so cancellation cannot overwrite a paid/fulfilled order or release its reservation while a Session remains payable.

- [ ] **Step 6: Pass focused tests and commit**

Run: `node --test tests/legal-documents.test.mjs tests/legal-acceptance.test.mjs tests/background-checkout.test.mjs`

Expected: PASS.

```powershell
git add lib/legal-documents.js lib/legal-acceptance.js lib/stripe-billing.js app/api/background-commerce/checkout/route.ts app/api/background-commerce/checkout/cancel/route.ts tests/legal-documents.test.mjs tests/legal-acceptance.test.mjs tests/background-checkout.test.mjs
git commit -m "feat: create compliant background checkout"
```

---

## Task 7: Fulfill purchases idempotently from Stripe webhooks

**Files:**

- Create: `lib/commerce/fulfillment-service.ts`
- Modify: `app/api/billing/webhook/route.ts`
- Modify: `lib/stripe-billing.js`
- Create: `tests/background-fulfillment.test.mjs`
- Modify: `tests/stripe-billing.test.mjs`

- [ ] **Step 1: Write failing fulfillment tests**

Test valid paid session fulfillment, repeated event delivery, two different event IDs for the same session, out-of-order async payment events, invalid purpose/order/user/item metadata, amount/currency/item mismatch, ownership already acquired by credit while checkout was open, and one failed item causing `REVIEW_REQUIRED` rather than silent partial success.

```ts
export async function fulfillBackgroundPurchase(input: {
  prismaClient: PrismaClient;
  eventId: string;
  session: Stripe.Checkout.Session;
}): Promise<{ orderId: string; userId: string; status: string }>;
```

- [ ] **Step 2: Dispatch webhook purposes explicitly**

Retain signature verification and raw-body handling. Before the existing membership path, inspect `metadata.purpose`:

- `background_purchase` -> commerce fulfillment;
- donation marker -> existing donation behavior;
- membership/no marker compatible with current subscriptions -> existing membership behavior;
- unknown explicit purpose -> acknowledge and record no domain mutation.

Handle `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired` for background orders.

- [ ] **Step 3: Implement transactional idempotent fulfillment**

Retrieve the Checkout Session with line items/payment intent outside the transaction when the event payload is incomplete. Then, in one short transaction:

1. insert `CommerceWebhookReceipt(provider="stripe", eventId)`;
2. enforce a monotonic transition table through conditional order/status predicates and processor event timestamps, so late `expired` or `async_payment_failed` events cannot regress `PAID`, fulfilled, partially refunded, or refunded state;
3. validate customer, user, currency, item keys, and totals against the order snapshot;
4. upsert the payment state;
5. create one active purchase ownership per unowned order item;
6. mark every item fulfilled and order paid;
7. release cart reservations and remove purchased cart items;
8. append commerce events.

If a credit already owns an item, keep that ownership, record the purchase item as requiring operator review, and do not overwrite its source. Do not automatically refund in the webhook.

- [ ] **Step 4: Make receipt and mutation atomic**

The webhook receipt must commit in the same transaction as its domain transition. A unique-receipt collision returns the stored result without repeating fulfillment. Do not insert a receipt and then perform fulfillment in a separate transaction.

- [ ] **Step 5: Clear account commerce cache after committed events**

Extend `clearAccountSurfaceDataCache` with the existing `membership` surface or the new commerce-aware cache key chosen in Task 10. Clear only after a committed grant, fulfillment, refund, dispute, or retirement state change.

- [ ] **Step 6: Pass focused tests and commit**

Run: `node --test tests/background-fulfillment.test.mjs tests/stripe-billing.test.mjs`

Expected: PASS.

```powershell
git add lib/commerce/fulfillment-service.ts app/api/billing/webhook/route.ts lib/stripe-billing.js tests/background-fulfillment.test.mjs tests/stripe-billing.test.mjs
git commit -m "feat: fulfill background purchases from webhooks"
```

---

## Task 8: Implement refunds, disputes, retirement, and reconciliation

**Files:**

- Create: `lib/commerce/reversal-service.ts`
- Create: `scripts/commerce-reconcile.mjs`
- Modify: `app/api/billing/webhook/route.ts`
- Modify: `package.json`
- Create: `tests/background-reversals.test.mjs`
- Create: `tests/commerce-reconcile.test.mjs`

- [ ] **Step 1: Write failing refund tests**

Cover exact-item partial refund, full refund, pending/succeeded/failed processor states, idempotent webhook replay, purchase ownership entering `REFUND_PENDING`, successful revocation, failed-refund restoration, credit ownership never revoked by purchase refund, and amounts never exceeding selected refundable order-item totals.

- [ ] **Step 2: Write failing dispute tests**

Cover an opened dispute suspending all purchase ownerships from the payment, a won dispute restoring only items not independently refunded/retired, a lost dispute revoking all remaining purchase ownerships, repeated/out-of-order events, and no account disablement.

- [ ] **Step 3: Write failing retirement tests**

Cover active owned premium retirement moving ownership to `RETIRED` and granting exactly one replacement credit, repeated retirement idempotency, unowned/subscription-only users receiving no credit, legal-refund override, and a premium background becoming free causing neither refund nor replacement.

- [ ] **Step 4: Implement reversal transitions**

Use processor object IDs and webhook event IDs as idempotency boundaries. Every transition updates current state and appends an event/ledger entry in one transaction. Refund initiation records selected order-item IDs and exact amounts before calling Stripe; the later webhook finalizes ownership status. Dispute status is derived from Stripe dispute events, never from client input.

- [ ] **Step 5: Add webhook event coverage**

Handle Stripe refund and dispute events required by the pinned API version. Retrieve the Charge/PaymentIntent only when needed to resolve the local `CommercePayment`. Unknown payment references are recorded for reconciliation without exposing their contents.

- [ ] **Step 6: Add a read-only-first reconciliation script**

`scripts/commerce-reconcile.mjs` reports mismatched order/payment/ownership/refund/dispute states by internal ID. `--repair` applies only deterministic idempotent transitions through the same services. Add:

```json
"commerce:reconcile": "node scripts/commerce-reconcile.mjs"
```

Default invocation must never mutate.

- [ ] **Step 7: Pass focused tests and commit**

Run: `node --test tests/background-reversals.test.mjs tests/commerce-reconcile.test.mjs`

Expected: PASS.

```powershell
git add lib/commerce/reversal-service.ts scripts/commerce-reconcile.mjs app/api/billing/webhook/route.ts package.json tests/background-reversals.test.mjs tests/commerce-reconcile.test.mjs
git commit -m "feat: reconcile commerce reversals"
```

---

## Task 9: Expose safe user APIs and full-admin operations

**Files:**

- Create: `lib/commerce/snapshot-service.ts`
- Create: `lib/commerce/admin-access.ts`
- Create: `lib/commerce/admin-service.ts`
- Create: `app/api/background-commerce/state/route.ts`
- Create: `app/api/background-commerce/credits/redeem/route.ts`
- Create: `app/api/background-commerce/cart/route.ts`
- Create: `app/admin/commerce/page.tsx`
- Create: `app/admin/commerce/[orderId]/page.tsx`
- Create: `app/admin/commerce/actions.ts`
- Modify: `app/admin/page.tsx`
- Create: `tests/background-commerce-api.test.mjs`
- Create: `tests/commerce-admin.test.mjs`

- [ ] **Step 1: Write failing safe-snapshot tests**

Define one response shared by the future picker and Account/Billing UI:

```ts
export type BackgroundCommerceSnapshot = {
  creditBalance: number;
  ownedBackgroundIds: string[];
  ownerships: Array<{
    backgroundId: string;
    source: "credit" | "purchase";
    status: "active" | "refund_pending" | "dispute_suspended" | "refund_revoked" | "dispute_revoked" | "retired";
    acquiredAt: string;
  }>;
  cart: CommerceCartSnapshot;
  recentOrders: Array<{
    id: string;
    status: string;
    itemCount: number;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    currency: "usd";
    createdAt: string;
  }>;
};
```

Exclude Stripe IDs, payment method data, raw metadata/events, ledger idempotency keys, email, IP, and internal failure detail. Test current reads immediately reflect mutations.

- [ ] **Step 2: Implement user-owned routes**

- `GET /api/background-commerce/state` returns the safe snapshot.
- `POST /api/background-commerce/credits/redeem` requires background ID, explicit confirmation, and idempotency key.
- `GET/POST/DELETE /api/background-commerce/cart` uses the cart service.

Every route requires a signed-in, database-verified user and maps `CommerceError` to stable JSON. Add `Cache-Control: private, no-store` so ownership is never shared or stale at the HTTP layer.

- [ ] **Step 3: Require full account administration**

Create an access helper that reloads the user and requires `canAdministerAccounts`/`ADMIN`. Do not reuse `requireAnatomyAdminUser`, because anatomy-scoped administration must not grant commerce authority.

- [ ] **Step 4: Write failing admin authorization and action tests**

Cover anonymous, ordinary, therapist, anatomy-admin-only, and full-admin access. Test exact-item refund preparation, reason requirement, amount calculation, duplicate prevention, deterministic reconciliation, and audit-event creation. Admin responses must identify customers by internal user/order IDs and the minimum existing account label; never render processor payloads.

- [ ] **Step 5: Add minimal operator pages**

The list page shows actionable `REVIEW_REQUIRED`, pending refund, open dispute, and reconciliation states. The detail page shows immutable item/amount/status history and exact-item refund controls. Server actions call `admin-service`; pages never import Stripe directly. Add a narrow Commerce link/count to `app/admin/page.tsx` visible only to full admins.

- [ ] **Step 6: Pass focused tests and commit**

Run: `node --test tests/background-commerce-api.test.mjs tests/commerce-admin.test.mjs`

Expected: PASS.

```powershell
git add lib/commerce/snapshot-service.ts lib/commerce/admin-access.ts lib/commerce/admin-service.ts app/api/background-commerce/state/route.ts app/api/background-commerce/credits/redeem/route.ts app/api/background-commerce/cart/route.ts app/admin/commerce/page.tsx app/admin/commerce/[orderId]/page.tsx app/admin/commerce/actions.ts app/admin/page.tsx tests/background-commerce-api.test.mjs tests/commerce-admin.test.mjs
git commit -m "feat: expose secure background commerce operations"
```

---

## Task 10: Add readiness gates, run rollout validation, and document operations

**Files:**

- Modify: `scripts/stripe-readiness-check.mjs`
- Modify: `tests/stripe-readiness.test.mjs`
- Modify: `docs/wiki/billing-memberships.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Write failing readiness tests**

Require the pinned Stripe key/webhook configuration plus explicit background-commerce readiness values: fixed USD price, purchase-country allowlist, current digital-purchase document/version, webhook event coverage, and tax mode. Fail production readiness when international commerce or automatic tax is enabled without explicit registration/tax-code configuration.

- [ ] **Step 2: Extend the readiness script**

Report only configured/missing booleans and safe identifiers. Never print secrets. Verify the webhook endpoint subscribes to Checkout completion/expiration/async payment, refund, and dispute events required by the implementation. Keep membership readiness output unchanged.

- [ ] **Step 3: Exercise the complete isolated-branch rollout**

On a disposable Neon branch with Stripe test mode:

1. apply the migration;
2. run the verified-user credit backfill twice;
3. redeem one credit;
4. create a multi-item test Checkout;
5. replay its completion webhook twice;
6. issue an exact-item partial refund;
7. replay refund and dispute fixtures;
8. run reconciliation in read-only mode;
9. confirm wallet, ledger, ownership, order, payment, and audit invariants.

Record only synthetic IDs in local QA notes; do not commit database rows or secrets.

- [ ] **Step 4: Run complete automated validation**

Run in this order:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run lint
npm run test
npm run typecheck
npm run build
npm run stripe:readiness
npm run commerce:reconcile
git diff --check
```

Expected: all PASS; reconciliation reports no unresolved deterministic mismatch. If readiness intentionally reports test-mode/non-production status, capture that exact expected status in the PR rather than weakening the check.

- [ ] **Step 5: Update canonical project documentation**

Document current implemented state, migration/backfill order, webhook event contract, final-sale exception process, dispute/retirement behavior, reconciliation commands, tax/country fail-closed posture, and Track 1B dependency. Do not add this work to the public Roadmap.

- [ ] **Step 6: Final scope and privacy audit**

Confirm:

- every verified account receives exactly two credits once;
- no unverified mutation succeeds;
- neither JWT nor UI state grants ownership;
- subscription and permanent ownership remain separate;
- `chimer_custom_colors` no longer unlocks premium use;
- subscriber purchases remain allowed;
- refund/dispute/retirement preserve history;
- anatomy-only admins cannot access commerce;
- no raw Stripe object, secret, email, IP, or card data enters audit JSON/logs;
- `TODO.md` is unchanged and unstaged.

- [ ] **Step 7: Commit documentation and readiness**

```powershell
git add scripts/stripe-readiness-check.mjs tests/stripe-readiness.test.mjs docs/wiki/billing-memberships.md docs/project-state.md docs/project-log.md
git commit -m "docs: operationalize background commerce foundation"
```

## Track 1A completion criteria

- Migration and backfill are verified on an isolated Neon branch and are safely repeatable.
- Every verified current/future account receives two credits exactly once.
- Credit redemption and purchase fulfillment create permanent, auditable ownership.
- Persistent carts and 30-minute reservations survive account sessions/devices.
- Stripe fulfillment, refund, dispute, expiration, and replay handling are idempotent.
- Full-admin operators can act on exact items without exposing processor data.
- User APIs expose a safe current snapshot for Track 1B.
- All required automated and manual validation passes.
- No purchase-surface UI or public Roadmap scope has leaked into this branch.
