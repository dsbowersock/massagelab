# Public Booking Traffic Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound public availability, booking, and waitlist traffic while making ambiguous retries converge on one durable result and preserving guest booking.

**Architecture:** Validate a canonical browser UUID and use a versioned UUID prefix plus a non-identifying selection digest as the existing domain-row ID. A narrow first prefix lookup handles an obvious replay; on a miss, one bounded Serializable transaction acquires a transaction-scoped PostgreSQL advisory lock and performs an authoritative second prefix lookup. Only the still-true remaining miss consumes write quota inside that same transaction before heavy database work. Availability uses quota before policy/solver/provider reads and a bounded public-projection cache for a short limiter-outage fallback. Server Actions return a typed state union consumed by `useActionState` instead of throwing redirects/errors through the form transport.

**Tech Stack:** Next.js App Router and Server Actions, React 19 `useActionState`, Prisma 7, PostgreSQL/Neon, Node.js 24 tests, Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-08-31-family-friends-abuse-cost-hardening-design.md`

## Global constraints

- Branch: `codex/family-friends-07-booking-traffic`, based on the exact reviewed PR B head.
- Do not add or change schema/migrations. Use existing `BookingGroup.id` and `BookingWaitlistEntry.id` text IDs.
- Accept only canonical lowercase UUIDv4 request IDs. Never derive operation identity from `AUTH_SECRET`, email, account ID, network identity, or another rotating secret.
- The stored SHA-256 digest covers only labeled non-identifying selection fields. It excludes email, account ID, practice-client ID, name, phone, notes, and free text.
- Compare caller ownership from the authoritative domain row and related practice client; never expose row/digest/owner details in a conflict.
- Run the narrow first replay lookup, then the locked authoritative second lookup, before write quota. Only the still-true miss consumes quota, inside the same outer transaction, before sequence recomputation, contact-owner mutation, scheduling locks, or event/appointment/notification writes. Revalidation and Google Calendar work remain post-commit only.
- Extend the operational limiter with a transaction-scoped entry point that accepts the caller's `Prisma.TransactionClient`; it must not open a nested transaction, and persistence failure must abort the outer bounded Serializable transaction.
- Do not automatically retry a durable action after an ambiguous result. Keep its UUID until success or a deliberate new submission.
- Tests must fake Google Calendar and database/provider seams; no hosted database or provider call.
- Do not push, merge, deploy, apply migrations, or change provider settings.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `lib/public-request-id.ts` | Browser-safe canonical UUIDv4 parsing only; no Node-only import. |
| `lib/public-request-owner.ts` | Server-only length-delimited selection digest and versioned request owner. |
| `lib/public-booking-idempotency.ts` | Narrow replay lookup, owner/selection comparison, advisory-lock/recheck helpers. |
| `lib/operational-rate-limit.ts` | Shared limiter core plus the transaction-scoped write-quota entry point used by booking and waitlist actions. |
| `lib/public-booking-availability-cache.ts` | Bounded account-mode/public-projection cache with 20s fresh and 60s outage-stale windows. |
| `app/calendar/actions/public-booking-state.ts` | Typed action result and fixed user-facing copy. |
| `app/calendar/actions/public-booking.ts` | Booking/waitlist validation, replay, quota, locked writes, downstream suppression. |
| `app/calendar/actions.ts` | `(previousState, formData)` Server Action adapters. |
| `app/api/book/[practiceSlug]/sequence-options/route.ts` | Cheap practice lookup, quota, stale outage fallback, expensive allowed path. |
| `app/book/[practiceSlug]/booking-picker.tsx` | 350ms availability debounce/cancellation, request ID lifecycle, pending/retry UI. |
| `tests/public-request-id.test.mjs` | UUID, tuple framing, digest privacy, and owner-length contract. |
| `tests/public-booking-traffic.test.mjs` | Availability order/cache and action replay/quota/concurrency/downstream contract. |
| `tests/public-booking-picker.test.mjs` | Source/UI adoption and state contract. |
| `tests/browser/public-booking-traffic.spec.ts` | Desktop/mobile intercepted pending/retry/conflict journeys. |

## Public request ownership

Create the browser-safe `lib/public-request-id.ts`:

```ts
export type PublicRequestNamespace =
  | "public-booking-v1"
  | "public-waitlist-v1"

export function normalizePublicRequestId(value: unknown): string | null
```

Create the server-only `lib/public-request-owner.ts`:

```ts
export type PublicBookingSelectionLabel =
  | "serviceVariantId"
  | "addOnVariantId"
  | "pressure"
  | "requestedStart"
  | "preferredProviderId"

export type PublicWaitlistSelectionLabel =
  | "serviceVariantId"
  | "addOnVariantId"
  | "pressure"
  | "preferredStart"
  | "preferredProviderId"

type PublicRequestSelection =
  | {
      namespace: "public-booking-v1"
      selectionComponents: readonly { label: PublicBookingSelectionLabel; value: string }[]
    }
  | {
      namespace: "public-waitlist-v1"
      selectionComponents: readonly { label: PublicWaitlistSelectionLabel; value: string }[]
    }

export function publicRequestOwner(input: PublicRequestSelection & {
  requestId: string
}): {
  prefix: string
  selectionDigest: string
  id: string
}
```

`normalizePublicRequestId` accepts only `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/` and has no `server-only` or `node:*` dependency, so PR D may reuse it in the browser. `public-request-owner.ts` imports `server-only` and `node:crypto`. Before any digest work, it validates the namespace-specific closed label union and canonical component order/multiplicity; an unknown, missing, duplicate, out-of-order, or cross-namespace label fails closed before hashing. Only then does it length-prefix the domain, namespace, and every allowlisted label/value before SHA-256. The ID is `${namespace}:${requestId}:${selectionDigest}`; the prefix ends after the final colon before the digest.

Selection components are exact and canonical:

- booking: sorted service/add-on variant IDs, normalized pressure integer, requested start ISO string, and preferred provider ID or empty string;
- waitlist: sorted service/add-on variant IDs, normalized pressure integer, preferred start ISO string or empty string, and preferred provider ID or empty string.

No contact, email, account, user, practice-client, or free-text label or value enters these components. Those labels and aliases are explicitly prohibited rather than accepted as extensible strings. Future Layer C tests must cover every canonical label, reject cross-namespace and prohibited labels, and prove unknown labels fail before the hashing path is invoked. This Layer A reconciliation changes only the plan and does not add the Layer C owner or route runtime.

## Action state

Create `app/calendar/actions/public-booking-state.ts`:

```ts
export type PublicBookingActionState =
  | { status: "IDLE" }
  | { status: "SUCCESS"; redirectTo: string }
  | { status: "VALIDATION_ERROR"; message: string }
  | { status: "CONFLICT"; message: string }
  | { status: "RATE_LIMITED"; message: string; retryAfterSeconds: number }
  | { status: "UNAVAILABLE"; message: string }

export const INITIAL_PUBLIC_BOOKING_ACTION_STATE:
  PublicBookingActionState = { status: "IDLE" }
```

Action adapters become:

```ts
export async function requestBookingSequenceAction(
  previousState: PublicBookingActionState,
  formData: FormData,
): Promise<PublicBookingActionState>

export async function joinBookingWaitlistAction(
  previousState: PublicBookingActionState,
  formData: FormData,
): Promise<PublicBookingActionState>
```

The domain functions use the same signature and return the union. They do not call `redirect`; the client navigates only on `SUCCESS`.

## Idempotency transaction order

Create `lib/public-booking-idempotency.ts` with focused helpers for each domain row. The write transaction uses:

```ts
await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.prefix}, 0))`
```

The action performs one bounded narrow first prefix lookup before starting the write transaction. On a miss, the outer bounded Serializable transaction acquires the prefix advisory lock and repeats the bounded `id: { startsWith: owner.prefix }` query as the authoritative second prefix lookup before quota or `ensureBookingPracticeClient`. A matching row must have the exact concrete ID, practice, canonical caller owner, and immutable row fields. A mismatched concrete ID, owner, or immutable field returns generic `CONFLICT`. A match returns `SUCCESS` without quota or downstream replay. A concurrent same-request contender therefore waits for the lock and returns from the authoritative second prefix lookup without consuming new quota.

Only the still-true remaining miss calls `consumeOperationalRateLimitInTransaction` with the same `Prisma.TransactionClient` to consume `BOOKING_CREATE` or `WAITLIST_JOIN`, then performs heavy database-only availability/contact/calendar work and explicitly sets the new `BookingGroup.id` or `BookingWaitlistEntry.id` to `owner.id`. The new limiter entry point delegates to the same rule resolution, key preparation, and bucket-consumption core as `consumeOperationalRateLimit` but does not open a nested transaction. Limiter persistence errors propagate through the outer bounded Serializable transaction, so a failed or retried transaction cannot commit quota without the domain row or commit the domain row without quota. Provider calls and revalidation remain outside the transaction and run after a new commit only.

For guest ownership, compare the row's related `practiceClient.email` after canonical email normalization. For signed-in ownership, compare the authoritative `createdById`/practice-client user mapping to the session user ID. Never return another caller's success path.

---

### Task 1: Add canonical request ownership

**Files:**
- Create: `tests/public-request-id.test.mjs`
- Create: `lib/public-request-id.ts`
- Create: `lib/public-request-owner.ts`
- Create: `lib/public-booking-idempotency.ts`

- [ ] **Step 1: Write RED coverage**

Prove canonical lowercase UUIDv4 only; wrong version/variant/case/whitespace rejected; the parser has no Node/server-only import; length-delimited tuples cannot collide; sorted selection arrays converge; changing any allowlisted selection changes the digest; contact/account/free-text fields are not accepted; namespace/prefix/ID lengths fit existing text IDs; advisory-lock helper uses only the versioned UUID prefix.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/public-request-id.test.mjs
```

Expected: missing modules/exports.

- [ ] **Step 3: Implement the minimum pure helpers**

Keep the UUID parser browser-safe and the namespace union closed. Use `node:crypto` SHA-256 and explicit tuple framing only in `public-request-owner.ts`. Put row-query/compare/lock helpers in the server-only idempotency module with focused JSDoc describing replay/privacy/concurrency constraints.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/public-request-id.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(booking): add public request ownership`

### Task 2: Bound availability before expensive reads

**Files:**
- Create: `tests/public-booking-traffic.test.mjs`
- Create: `lib/public-booking-availability-cache.ts`
- Modify: `app/api/book/[practiceSlug]/sequence-options/route.ts`

**Cache interface:**

```ts
export type PublicAvailabilityCacheValue = {
  options: readonly PublicBookingSequenceOption[]
  storedAt: number
}

export function publicAvailabilityCacheKey(input: {
  practiceId: string
  accountMode: "guest" | "signed-in"
  descriptor: PublicBookingSequenceDescriptor
  maxOptions: number
}): string

export function readPublicAvailabilityCache(
  key: string,
  input?: { now?: number; allowStale?: boolean },
): readonly PublicBookingSequenceOption[] | null

export function writePublicAvailabilityCache(
  key: string,
  options: readonly PublicBookingSequenceOption[],
  input?: { now?: number },
): void
```

Use a 20-second fresh TTL, 60-second outage-stale maximum, and 250-entry cap. The key uses practice ID, account mode, normalized descriptor, and max options; never user ID, cookie, email, or contact data. Copy/freeze the existing public projection.

- [ ] **Step 1: Write availability RED cases**

Prove invalid JSON/descriptor and missing practice consume no quota; practice lookup selects only `id`; allowed quota precedes policy/provider/signature/solver reads; authenticated requests use account+practice and authenticated network+practice; anonymous uses anonymous network+practice; 429 has integer `Retry-After`; unavailable with a complete cache value no older than 60 seconds returns it; unavailable miss/older value returns 503; no denied path calls the existing cached solver.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/public-booking-traffic.test.mjs --test-name-pattern="availability"
```

Expected: route loads policy/provider data before quota and no outage-stale cache exists.

- [ ] **Step 3: Implement the minimum route pipeline**

Parse/normalize the bounded descriptor, resolve the public practice ID only, derive network/account subject, and consume `BOOKING_AVAILABILITY`. On allowance, run the existing policy/account-mode checks and `cachedPublicBookingSequenceOptions`, then store the final options projection. On `RATE_LIMITED`, return 429 plus exact integer header. On `UNAVAILABLE`, read only the bounded stale projection; otherwise return generic 503.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/public-booking-traffic.test.mjs --test-name-pattern="availability"
node --test tests/public-booking-sequences.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(booking): bound availability traffic`

### Task 3: Add debounce and structured action recovery

**Files:**
- Create: `app/calendar/actions/public-booking-state.ts`
- Modify: `app/calendar/actions.ts`
- Modify: `app/book/[practiceSlug]/booking-picker.tsx`
- Modify: `tests/public-booking-picker.test.mjs`
- Modify: `tests/public-booking-traffic.test.mjs`

- [ ] **Step 1: Write UI/action RED coverage**

Prove availability starts only after 350ms, superseded request aborts, 429 parses integer header and counts down, 503 exposes manual retry, form uses `useActionState`, request ID persists through rate-limit/unavailable/ambiguous outcomes, success navigates, deliberate new submission rotates, and status text is accessible.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/public-booking-picker.test.mjs tests/public-booking-traffic.test.mjs --test-name-pattern="action state|debounce|request id"
```

Expected: immediate availability fetch, direct action forms, thrown redirect/errors, and no request ID lifecycle.

- [ ] **Step 3: Implement the minimum client/state contract**

Generate IDs with `crypto.randomUUID()` only in the browser, store booking and waitlist attempt IDs in component state, and submit hidden `requestId` fields. Use `useActionState` separately for booking/waitlist. Disable only while pending or during an accepted retry window. Keep fixed privacy-safe copy; do not reveal account/practice-client existence.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/public-booking-picker.test.mjs tests/public-booking-traffic.test.mjs --test-name-pattern="action state|debounce|request id"
```

- [ ] **Step 5: Review and commit**

Commit: `feat(booking): expose bounded booking action states`

### Task 4: Make booking creation idempotent and quota-protected

**Files:**
- Modify: `app/calendar/actions/public-booking.ts`
- Modify: `lib/operational-rate-limit.ts`
- Modify: `tests/public-booking-traffic.test.mjs`
- Modify: `tests/operational-rate-limit.test.mjs`
- Modify: `tests/booking-policy.test.mjs`

- [ ] **Step 1: Write booking RED coverage**

Prove validation before lookup; same UUID/owner/selection at the narrow first lookup returns the original success without quota, sequence solve, contact update, events, notifications, revalidation, or Google push; same UUID with changed selection/owner conflicts generically. Prove a first-lookup miss acquires the prefix advisory lock and performs the authoritative second prefix lookup before quota; a concurrent same-request contender returns there without consuming new quota; and only the still-true remaining miss consumes `BOOKING_CREATE` before heavy work. Prove the transaction-scoped limiter uses the supplied transaction without nesting, and that denial, unavailability, limiter persistence failure, or later transaction failure commits neither quota nor domain work. Concurrent same submissions create one group/event set and consume write quota once; concurrent changed selections produce one success/one conflict; retry after transaction failure with no owner may continue.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/public-booking-traffic.test.mjs --test-name-pattern="booking create"
```

Expected: generated group ID, no replay/lock/quota, and provider/revalidation replay risk.

- [ ] **Step 3: Refactor the minimum ordered service**

Parse session, headers, canonical request ID, bounded fields, normalized owner, and selection. Run one narrow first prefix lookup. On its miss, enter the bounded Serializable write transaction, acquire the prefix advisory lock, and run the authoritative second prefix lookup. Return a match or conflict from the recheck without quota or downstream work. Only the still-true remaining miss uses `consumeOperationalRateLimitInTransaction` on that transaction client to consume `BOOKING_CREATE`; after allowance, recompute availability/staff context, ensure the practice client, create `BookingGroup` with `owner.id`, and write its events/appointments/notifications in the same transaction. After a new commit only, perform best-effort Google pushes and route revalidation. Return `SUCCESS` with the existing public path. Map validation/conflict/limit/unavailability to the typed union.

- [ ] **Step 4: Run GREEN and regressions**

```powershell
node --test tests/public-booking-traffic.test.mjs --test-name-pattern="booking create"
node --test tests/booking-policy.test.mjs tests/calendar-booking-schema.test.mjs tests/neon-transfer-hardening.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(booking): make guest bookings idempotent`

### Task 5: Make waitlist joins idempotent and quota-protected

**Files:**
- Modify: `app/calendar/actions/public-booking.ts`
- Modify: `tests/public-booking-traffic.test.mjs`

- [ ] **Step 1: Write waitlist RED coverage**

Mirror booking proofs for `WAITLIST_JOIN`: bounded validation; narrow first prefix replay; owner/selection conflict; prefix advisory lock plus authoritative second prefix lookup before quota; only the still-true remaining miss consumes `WAITLIST_JOIN` before heavy work; denied zero solver/contact/entry/revalidation work; one entry and one quota consumption under same-request concurrency; no repeat revalidation on replay; failed transaction leaves no owner or committed quota.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/public-booking-traffic.test.mjs --test-name-pattern="waitlist"
```

Expected: generated waitlist ID and no replay/lock/quota.

- [ ] **Step 3: Implement the same owner protocol**

Use `public-waitlist-v1`, the exact waitlist selection components, and the authoritative related practice-client owner. Run the narrow first prefix lookup; on a miss, enter the bounded Serializable transaction, acquire the prefix advisory lock, and perform the authoritative second prefix lookup. A match or conflict returns without quota. Only the still-true remaining miss uses `consumeOperationalRateLimitInTransaction` on the same transaction client to consume `WAITLIST_JOIN`, then proves no currently bookable option before contact and entry creation. Set `BookingWaitlistEntry.id` to the concrete owner ID and revalidate only after a new commit.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/public-booking-traffic.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat(booking): make waitlist joins idempotent`

### Task 6: Browser proof and exact-head evidence

**Files:**
- Create: `tests/browser/public-booking-traffic.spec.ts`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Write intercepted browser RED/GREEN journeys**

Use mocked availability and Server Action responses where supported by the existing harness. Prove 350ms debounce/cancellation, pending control, 429 countdown, 503 manual retry, conflict copy, ID retention/rotation, one visible success navigation, guest and signed-in normal paths, and no provider traffic.

```powershell
npm run build:browser-qa
npm run test:browser -- tests/browser/public-booking-traffic.spec.ts --project=desktop-chromium --project=mobile-chromium
```

- [ ] **Step 2: Run the PR gate**

```powershell
node --test tests/public-request-id.test.mjs tests/public-booking-traffic.test.mjs tests/public-booking-picker.test.mjs tests/public-booking-sequences.test.mjs tests/booking-policy.test.mjs tests/calendar-booking-schema.test.mjs tests/neon-transfer-hardening.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/public-booking-traffic.spec.ts --project=desktop-chromium --project=mobile-chromium
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

- [ ] **Step 3: Record and commit evidence**

Record exact PR B base, focused/browser totals, replay and concurrency receipts, zero-provider boundary, and no schema/live action.

Commit: `docs: record public booking traffic hardening`

## Completion receipts

- Availability quota precedes expensive reads, with only a bounded 60-second complete public projection used during limiter outage.
- A concurrent same-request/owner/selection contender returns from the authoritative second prefix lookup without consuming new quota or replaying provider/downstream work; only the still-true miss consumes quota inside the domain transaction.
- Same UUID with a changed owner or selection conflicts generically, including concurrent submissions.
- Denied/unavailable booking and waitlist attempts create no contact, calendar, notification, sync, revalidation, or provider work.
- Browser controls visibly debounce, pend, back off, and recover without silently replaying durable actions.
