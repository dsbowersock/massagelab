# Public Provider Ingress Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound anonymous donation Checkout and privacy-safe problem-report provider calls while preserving native-form and browser recovery.

**Architecture:** Give each donation attempt a canonical browser UUID retained for at most 24 hours and pass its versioned opaque key to Stripe's idempotency boundary. Validate origin, payload, and amount before consuming quota, then stop before constructing Stripe on denial. Replace the problem-report process-local map with PR A's durable multi-instance limiter after trusted-origin, JSON, size, and privacy validation but before Sentry capture. Clients expose pending, retry, conflict, and temporary-unavailable states without automatically replaying ambiguous provider actions.

**Tech Stack:** Next.js route handlers and React 19, Stripe 22, Sentry, Node.js 24 tests, Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-08-31-family-friends-abuse-cost-hardening-design.md`

## Global constraints

- Branch: `codex/family-friends-08-public-ingress`, based on the exact reviewed PR C head.
- Reuse PR A's `DONATION_CHECKOUT` and `PROBLEM_REPORT` operational requests and PR C's `normalizePublicRequestId`.
- Do not add or change schema/migrations.
- Donation idempotency key is exactly `massagelab-donation-v1:<canonical-uuid>`; it contains no email, account, amount, IP/network, Session ID, or secret-derived material.
- Quota is consumed before Stripe client construction and before Sentry capture/flush. Denied/unavailable paths call neither provider.
- Native donation forms retain 303 redirect semantics. JSON clients receive status/body and integer `Retry-After` for 429.
- Do not automatically resubmit Checkout or problem reports after an ambiguous/provider failure.
- Every provider test uses injected/intercepted fakes. Do not create a live or test Checkout Session, payment, customer, event, Sentry capture, or email.
- Do not push, merge, deploy, apply migrations, or change provider/environment settings.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `lib/stripe-billing.js` | Require and pass the donation idempotency key; normalize provider conflict. |
| `lib/donation-checkout-attempt.ts` | Pure 24-hour browser attempt record validation/rotation decisions. |
| `app/pricing/donation-checkout-form.tsx` | One native form with amount buttons, sessionStorage attempt retention, visible pending/retry controls. |
| `app/pricing/page.tsx` | Supplies a server-generated no-JS initial UUID, renders the client form, maps fixed notices. |
| `app/api/billing/donation/route.ts` | Parse/validate attempt, quota, Stripe key, JSON/303 error mapping. |
| `app/api/support/problem-report/route.ts` | Origin/MIME/body/privacy validation, durable limiter, Sentry boundary. |
| `app/support/support-diagnostic-report.tsx` | Parse 429/503, visible countdown/manual retry, no automatic replay. |
| `tests/stripe-billing.test.mjs` | Exact Stripe options/idempotency and provider-conflict mapping. |
| `tests/donation-checkout-route.test.mjs` | Validation/quota/provider order and transport-specific responses. |
| `tests/donations.test.mjs` | Pricing-page donation form and fixed-notice adoption. |
| `tests/problem-report-route.test.mjs` | Origin/MIME/privacy/quota order and zero Sentry denial. |
| `tests/problem-report.test.mjs` | Privacy payload regressions. |
| `tests/browser/public-provider-ingress.spec.ts` | Desktop/mobile donation/report pending and recovery proof. |

## Donation contracts

Update `createStripeDonationCheckoutSession`:

```js
/**
 * @param {{
 *   amountCents: number
 *   idempotencyKey: string
 *   currency?: string
 *   customerEmail?: string
 *   userId?: string
 *   successUrl: string
 *   cancelUrl: string
 *   apiKey?: string
 *   env?: Record<string, string | undefined>
 *   stripeClient?: {
 *     checkout: { sessions: { create: (
 *       payload: Record<string, unknown>,
 *       options: { idempotencyKey: string },
 *     ) => Promise<unknown> } }
 *   }
 * }} input
 */
export async function createStripeDonationCheckoutSession(input = {})

export class DonationCheckoutAttemptConflictError extends Error {}
```

Validate the exact versioned UUID key before constructing Stripe. Call `stripe.checkout.sessions.create(session, { idempotencyKey })`. Normalize only the provider's documented idempotency-parameter conflict shape to `DonationCheckoutAttemptConflictError`; rethrow every other provider error for the existing generic checkout-error path.

Create `lib/donation-checkout-attempt.ts`:

```ts
export type DonationCheckoutAttempt = {
  attemptId: string
  amountCents: number
  createdAt: number
}

export function readDonationCheckoutAttempt(
  value: string | null,
  input?: { now?: number },
): DonationCheckoutAttempt | null

export function donationCheckoutAttemptForAmount(input: {
  current: DonationCheckoutAttempt | null
  amountCents: number
  createId: () => string
  now?: number
}): DonationCheckoutAttempt

export function donationCheckoutIdempotencyKey(attemptId: string): string
```

Reject malformed/noncanonical UUID, non-allowlisted amount, invalid timestamp, future timestamp, or age over 24 hours. Keep an existing record only when the amount is unchanged and it remains valid. Amount change, expiry, confirmed success/cancel, invalid/conflicting response, or deliberate new attempt rotates/removes it. Rate-limited, unavailable, timeout, generic provider error, and redirect ambiguity retain it.

## Problem-report order

The route order is:

1. trusted same-origin check using the canonical site URL and existing trusted-origin helper;
2. JSON media type check (`Content-Type` media type equals `application/json`) before body read;
3. existing bounded 2,048-byte body read and object parse;
4. existing category, area, safe-path normalization, and privacy-scrub payload construction;
5. `Sentry.isEnabled()` availability check;
6. trusted platform network identity via `authRequestNetworkIdentifier`;
7. durable `PROBLEM_REPORT` consumption;
8. exactly one `captureMessage` and bounded flush.

Origin failure is 403; MIME failure is 415; invalid body is 400; Sentry/limiter unavailability is generic 503; denial is 429 with integer `Retry-After`. None of those failure paths calls `captureMessage`.

---

### Task 1: Add Stripe donation idempotency

**Files:**
- Modify: `tests/stripe-billing.test.mjs`
- Modify: `lib/stripe-billing.js`

- [ ] **Step 1: Write Stripe-boundary RED coverage**

Prove missing/malformed/unversioned key fails before client creation; valid key is passed once as the second `create` argument; the key is absent from Session metadata/line items; same key/same payload returns the provider result; documented provider parameter conflict becomes `DonationCheckoutAttemptConflictError`; unrelated errors remain unchanged.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/stripe-billing.test.mjs --test-name-pattern="donation.*idempot"
```

Expected: donation create accepts no idempotency key and calls Stripe with one argument.

- [ ] **Step 3: Implement the minimum adapter change**

Require the exact `massagelab-donation-v1:` canonical UUID format before `getStripeClient`. Pass only `{ idempotencyKey }` in request options and add focused JSDoc. Normalize only the explicit Stripe idempotency conflict seam represented in the injected fake.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/stripe-billing.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(billing): add donation checkout idempotency`

### Task 2: Bound donation Checkout attempts

**Files:**
- Create: `lib/donation-checkout-attempt.ts`
- Create: `app/pricing/donation-checkout-form.tsx`
- Modify: `app/pricing/page.tsx`
- Modify: `app/api/billing/donation/route.ts`
- Modify: `tests/donation-checkout-route.test.mjs`
- Modify: `tests/stripe-billing.test.mjs`
- Modify: `tests/donations.test.mjs`

- [ ] **Step 1: Write attempt/route RED coverage**

Prove 24-hour parse/retention/rotation rules; form and JSON parse `checkoutAttemptId`; invalid origin/amount/attempt consumes no quota; authenticated input supplies account plus network/global donation rules; anonymous uses network/global rules; denial/unavailability constructs no Stripe client; JSON 429 has exact header, 503 is generic, and conflict is 409; form outcomes redirect 303 to fixed `rate-limited`, `unavailable`, or `conflict` pricing notices; allowed call receives the exact versioned key.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/donation-checkout-route.test.mjs tests/stripe-billing.test.mjs --test-name-pattern="donation"
```

Expected: no attempt parsing, quota, provider key, conflict mapping, or retained client state.

- [ ] **Step 3: Implement the minimum route pipeline**

Extend `donationRequest` to return amount and attempt ID for form/JSON. Validate origin, parse body, allowlist amount, and canonicalize attempt before session/quota. Derive network/account and consume `DONATION_CHECKOUT`. Map decision before calling `createStripeDonationCheckoutSession`. Preserve existing success/cancel URL, amount, tax, metadata, and support-only semantics.

Render one `DonationCheckoutForm` for all allowlisted amounts. `page.tsx` supplies a server-generated `crypto.randomUUID()` initial ID so no-JS submits once; on hydration, the component adopts a valid sessionStorage record. Before native submission, synchronously set hidden amount/attempt inputs and persist the record. Show pending text; do not automatically submit on retry eligibility.

Add fixed notice mappings for rate limited, temporarily unavailable, and conflicting attempt. Success/cancel clears the stored attempt on hydration; generic checkout-error retains it.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/donation-checkout-route.test.mjs tests/stripe-billing.test.mjs tests/donations.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(billing): bound donation checkout attempts`

### Task 3: Replace process-local problem-report limiting

**Files:**
- Modify: `tests/problem-report-route.test.mjs`
- Modify: `tests/problem-report.test.mjs`
- Modify: `tests/sentry-operational-boundary.test.mjs`
- Modify: `app/api/support/problem-report/route.ts`

- [ ] **Step 1: Write route RED coverage**

Use fresh module imports and injected/mocked limiter/Sentry boundaries. Prove cross-instance calls share the durable fake; process-local Map/hash helpers are absent; untrusted origin returns 403; wrong/missing MIME returns 415; oversized/invalid body returns 400; those cases consume no quota/capture; disabled Sentry returns 503 before quota; valid sanitized payload consumes once; 429 carries exact integer header; limiter unavailable is 503; denied/unavailable performs zero capture/flush; allowed performs one capture and one bounded flush.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/problem-report-route.test.mjs tests/problem-report.test.mjs tests/sentry-operational-boundary.test.mjs
```

Expected: route uses module-local Map, lacks origin/MIME checks and `Retry-After`, and does not call PR A.

- [ ] **Step 3: Implement the ordered durable boundary**

Delete the local Map, SHA client key, prune, and capacity helpers. Reuse the trusted-origin/site URL and `authRequestNetworkIdentifier` owners. Construct the existing sanitized payload before quota; do not log the request or payload on denial. Consume `PROBLEM_REPORT`, then capture/flush once. Keep the existing generic unavailable response and privacy-safe success projection.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/problem-report-route.test.mjs tests/problem-report.test.mjs tests/sentry-operational-boundary.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(support): enforce durable report limits`

### Task 4: Show public ingress retry guidance

**Files:**
- Modify: `app/support/support-diagnostic-report.tsx`
- Modify: `app/pricing/donation-checkout-form.tsx`
- Create: `tests/browser/public-provider-ingress.spec.ts`

**Diagnostic status:**

```ts
type DiagnosticStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; result: DiagnosticResponse }
  | { kind: "rate-limited"; retryAt: number }
  | { kind: "unavailable" }
  | { kind: "failed" }
```

- [ ] **Step 1: Write browser RED journeys**

Intercept provider-facing routes. Prove donation button pending state and attempt retention across 429/503/generic error, rotation on amount change/conflict/success/cancel, fixed pricing notices, and no silent resubmit. Prove diagnostic 429 countdown from header, 503 manual retry, pending status, no automatic capture retry, and existing mailto fallback.

- [ ] **Step 2: Run browser RED**

```powershell
npm run build:browser-qa
npm run test:browser -- tests/browser/public-provider-ingress.spec.ts --project=desktop-chromium --project=mobile-chromium
```

Expected: native forms have no retained attempt; report UI collapses all errors to failed and ignores `Retry-After`.

- [ ] **Step 3: Implement accessible manual recovery**

Parse only positive integer `Retry-After`; use a visible live status/countdown and keep submit disabled only until its deadline. On 503 show a manual retry action. Do not schedule another POST. Preserve the support email fallback and no-clinical-details guidance.

- [ ] **Step 4: Run browser GREEN**

```powershell
npm run test:browser -- tests/browser/public-provider-ingress.spec.ts --project=desktop-chromium --project=mobile-chromium
```

- [ ] **Step 5: Review and commit**

Commit: `feat(support): show ingress retry guidance`

### Task 5: Record evidence and exact-head proof

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify: `docs/wiki/deployment.md`
- Modify: `docs/wiki/release-checklist.md`

- [ ] **Step 1: Record receipts**

Record exact PR C base, focused/browser totals, exact idempotency option receipt, zero-provider denial receipts, durable report limiter ownership, and no schema/hosted action.

- [ ] **Step 2: Run the PR and whole-stack gate**

```powershell
node --test tests/donation-checkout-route.test.mjs tests/stripe-billing.test.mjs tests/problem-report-route.test.mjs tests/problem-report.test.mjs tests/sentry-operational-boundary.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/public-provider-ingress.spec.ts --project=desktop-chromium --project=mobile-chromium
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

- [ ] **Step 3: Review and commit**

Commit: `docs: record public ingress hardening`

## Completion receipts

- Donation retries use one opaque provider idempotency key for the retained attempt and denial never constructs Stripe.
- Native form and JSON transports receive their intended fixed 303 or structured 429/503/409 behavior.
- Problem-report quotas survive serverless instance changes and every invalid/denied/unavailable path performs zero Sentry capture.
- Clients visibly pend, back off, and offer manual recovery without automatically replaying ambiguous provider work.
- No real Stripe/Sentry/email/provider action or schema change occurred.
