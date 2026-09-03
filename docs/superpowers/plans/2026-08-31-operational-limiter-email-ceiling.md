# Operational Limiter and Email Ceiling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one deployment-wide, privacy-safe operational quota service and use it to cap outbound auth/security email attempts without changing the existing auth limiter.

**Architecture:** Store fixed-window counters in a new additive Prisma model keyed by versioned private policy, scope, and an HMAC-reduced subject. Resolve every rule from a closed discriminated request union, consume all applicable rules in one bounded Serializable transaction, and perform cleanup only after the authoritative decision. The SMTP boundary supplies a private mandatory classification and consumes its quota immediately before transporter construction. Existing Admin email intents use nullable claim-token, lease, and unique retry-operation-key hash fields in the same pending migration so a short claim transaction can commit before quota and SMTP, followed by exact-token finalization in another short transaction.

**Tech Stack:** Prisma 7, PostgreSQL/Neon, Next.js server modules, Nodemailer, Node.js 24 tests.

**Spec:** `docs/superpowers/specs/2026-08-31-family-friends-abuse-cost-hardening-design.md`

## Global constraints

- Branch: `codex/family-friends-05-abuse-cost-foundation`, based on `6af8a7f4b2bbb9bf30af48b25b1f78bd3c2ee379` plus the approved design/plans.
- This is the only branch in the stack allowed to modify `prisma/schema.prisma` or add a migration.
- Do not modify, widen, backfill, or reuse `AuthRateLimitBucket`.
- Do not accept caller-supplied policy names, limits, windows, global literals, hashes, or raw database keys.
- Do not store or log raw email, account ID, network identifier, room/player identifier, practice ID, or composite subject.
- Reuse `authRequestNetworkIdentifier`, `normalizeEmail`, and `runCommerceTransaction`; do not create competing trust, normalization, or retry owners.
- Invalid input, missing secret, and exhausted database retry fail closed as `UNAVAILABLE` before protected work.
- Do not apply the migration, connect to Production, construct a real SMTP transporter, or send email.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | New scope enum, additive operational bucket model, and three nullable Admin email claim fields. |
| `prisma/migrations/20260831120000_operational_rate_limit_bucket/migration.sql` | Limiter objects plus three nullable Admin email claim columns and the retry-key claim index. |
| `lib/operational-rate-limit-policy.ts` | Closed request union, subject validation/normalization, and exact fixed rules. |
| `lib/operational-rate-limit.ts` | HMAC key creation, atomic consumption, bounded retry mapping, and cleanup. |
| `lib/auth-mail.ts` | Private mandatory mail classification and limiter placement. |
| `lib/admin/email-intents.ts` | Short durable claim, out-of-transaction SMTP, and exact-token finalization. |
| `app/api/account/register/route.ts` | Dedicated existing-account registration notice wrapper. |
| `tests/operational-rate-limit-schema.test.mjs` | Additive migration/schema contract. |
| `tests/operational-rate-limit-policy.test.mjs` | Exact policy and subject-expansion contract. |
| `tests/operational-rate-limit.test.mjs` | Privacy, atomicity, concurrency, expiry, failure, and cleanup. |
| `tests/auth-mail-ceiling.test.mjs` | SMTP classification, zero-work denial, and attempt charging. |
| `tests/admin-operation-service.test.mjs` | Admin claim concurrency, lease recovery, and ambiguity contracts. |
| `tests/auth-registration.test.mjs` | Existing-account registration wrapper regression. |

## Public interfaces

```ts
export type OperationalRateLimitScope = "GLOBAL" | "NETWORK" | "ACCOUNT" | "RESOURCE"

export type OperationalAccountSubject =
  | { kind: "ACCOUNT_ID"; value: string }
  | { kind: "EMAIL"; value: string }

export type OperationalBookingSubject =
  | { kind: "ACCOUNT_ID"; value: string }
  | { kind: "GUEST_EMAIL"; value: string }

export type OperationalRateLimitRequest =
  | { operation: "ANATOMIME_ROOM_CREATE"; networkIdentifier: string; account?: OperationalAccountSubject }
  | { operation: "ANATOMIME_ROOM_JOIN"; networkIdentifier: string; roomIdentifier: string }
  | { operation: "ANATOMIME_REALTIME_TOKEN_START"; networkIdentifier: string; roomIdentifier: string }
  | { operation: "ANATOMIME_REALTIME_TOKEN_ISSUE"; playerId: string; roomId: string }
  | { operation: "ANATOMIME_UNJOINED_LOOKUP"; networkIdentifier: string; roomIdentifier: string }
  | { operation: "BOOKING_AVAILABILITY"; networkIdentifier: string; practiceId: string; account?: OperationalAccountSubject }
  | { operation: "BOOKING_CREATE"; networkIdentifier: string; practiceId: string; owner: OperationalBookingSubject }
  | { operation: "WAITLIST_JOIN"; networkIdentifier: string; practiceId: string; owner: OperationalBookingSubject }
  | { operation: "DONATION_CHECKOUT"; networkIdentifier: string; account?: OperationalAccountSubject }
  | { operation: "PROBLEM_REPORT"; networkIdentifier: string }
  | { operation: "EMAIL_PUBLIC_AUTH" }
  | { operation: "EMAIL_SECURITY" }

export type OperationalRateLimitDecision =
  | { allowed: true }
  | { allowed: false; reason: "RATE_LIMITED"; retryAfterSeconds: number }
  | { allowed: false; reason: "UNAVAILABLE" }

export type OperationalRateLimitClient =
  Pick<PrismaClient, "$transaction" | "operationalRateLimitBucket">

export async function consumeOperationalRateLimit(
  input: OperationalRateLimitRequest & {
    prismaClient?: OperationalRateLimitClient
    secret?: string
    now?: Date
    shouldPrune?: () => boolean
  },
): Promise<OperationalRateLimitDecision>

export function operationalRateLimitKeyHash(input: {
  policy: string
  scope: OperationalRateLimitScope
  normalizedSubjectComponents: readonly { label: string; value: string }[]
  secret: string
}): string

export async function pruneOperationalRateLimits(input: {
  prismaClient?: Pick<PrismaClient, "operationalRateLimitBucket">
  before: Date
  maxRows: number
}): Promise<number>

export async function maybePruneOperationalRateLimits(input: {
  prismaClient?: Pick<PrismaClient, "operationalRateLimitBucket">
  before: Date
  maxRows?: number
  shouldPrune?: () => boolean
}): Promise<number>
```

The private policy module exports only the types needed by the service:

```ts
export type OperationalRateLimitRule = {
  policy: string
  scope: OperationalRateLimitScope
  limit: number
  windowMs: number
  normalizedSubjectComponents: readonly { label: string; value: string }[]
}

export function resolveOperationalRateLimitRules(
  request: OperationalRateLimitRequest,
): readonly OperationalRateLimitRule[] | null
```

## Exact policy registry

All policy keys end in `.v1` and each window uses a distinct key.

| Operation | Fixed rules |
| --- | --- |
| Room create | account 6/15m and 20/24h; shared network 15/15m and 40/24h; anonymous-only network 5/15m and 15/24h. |
| Room join | network 30/15m and 100/24h; network+room 20/10m. |
| Realtime token start/issue | network+room 60/10m; player 6/10m; room 40/10m. |
| Unjoined lookup | network+room 60/10m. |
| Availability | account+practice 40/5m; anonymous network+practice 60/5m; authenticated network+practice 120/5m. |
| Booking create | owner+practice 3/30m and 8/24h; network+practice 12/30m and 30/24h. |
| Waitlist join | owner+practice 2/30m and 4/24h; network+practice 12/30m and 30/24h. |
| Donation | account 6/15m and 20/24h; anonymous network 5/15m and 15/24h; shared network 15/15m and 40/24h; global 100/24h. |
| Problem report | network 5/10m; global 50/10m and 250/24h. |
| Email public auth | public-auth global 70/24h plus total global 90/24h. |
| Email security | total global 90/24h, preserving the last 20 attempts from public-auth traffic. |

The implementation uses the exact private names in the approved design, including `anatomime.room-create.account.15m.v1`, `booking.create.owner-practice.30m.v1`, `donation.global.24h.v1`, `problem-report.global.10m.v1`, `email.public-auth.global.24h.v1`, and `email.total.global.24h.v1`.

---

### Task 1: Add the additive persistence contract

**Files:**
- Create: `tests/operational-rate-limit-schema.test.mjs`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260831120000_operational_rate_limit_bucket/migration.sql`

- [ ] **Step 1: Write the failing schema test**

Assert the enum values, model fields/defaults, composite unique key, two cleanup indexes, exact migration order, and absence of destructive/DML statements.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/operational-rate-limit-schema.test.mjs
```

Expected: failure because the enum, model, and migration do not exist.

- [ ] **Step 3: Add the minimum schema and SQL**

Add `OperationalRateLimitScope` near `AuthAttemptScope`. Add `OperationalRateLimitBucket` immediately after `AuthRateLimitBucket` with the exact approved shape:

```prisma
model OperationalRateLimitBucket {
  id           String                    @id @default(cuid())
  policy       String
  scope        OperationalRateLimitScope
  keyHash      String
  count        Int                       @default(0)
  windowStart  DateTime                  @default(now())
  blockedUntil DateTime?
  updatedAt    DateTime                  @updatedAt

  @@unique([policy, scope, keyHash])
  @@index([updatedAt])
  @@index([blockedUntil])
}
```

The Task 1 limiter portion of the migration creates only the enum, eight table columns/defaults (`id` plus seven non-id columns: `policy`, `scope`, `keyHash`, `count`, `windowStart`, `blockedUntil`, and `updatedAt`), unique index, and two cleanup indexes. That limiter portion contains no backfill, foreign key, trigger, row rewrite, or change to the auth bucket. Task 4 later extends the same single migration with the Admin email claim columns, append-only retry-key table and indexes, and its `RESTRICT` foreign key to `AdminEmailIntent`.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/operational-rate-limit-schema.test.mjs
npm run prisma:validate
npm run prisma:generate
```

- [ ] **Step 5: Review and commit**

Commit: `feat: add operational limiter persistence`

### Task 2: Define the closed policy registry

**Files:**
- Create: `lib/operational-rate-limit-policy.ts`
- Create: `tests/operational-rate-limit-policy.test.mjs`

- [ ] **Step 1: Write policy RED coverage**

Table-drive every request variant and assert the exact private keys, scope, threshold, window, labeled normalized components, authenticated/anonymous branching, email reserve composition, and `.v1` suffix. Add malformed, empty, over-bound, unknown-runtime-operation, and noncanonical-email cases.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/operational-rate-limit-policy.test.mjs
```

Expected: missing module and policy resolver.

- [ ] **Step 3: Implement the minimum resolver**

Use small bounded normalizers. Email subjects call `normalizeEmail`; identifiers are trimmed and length-bounded. Each composite rule uses labeled components. `GLOBAL` uses one private literal. The exhaustive switch returns `null` for unrecognized runtime input rather than manufacturing a rule.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/operational-rate-limit-policy.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat: define operational limiter policies`

### Task 3: Consume all rules atomically

**Files:**
- Create: `lib/operational-rate-limit.ts`
- Create: `tests/operational-rate-limit.test.mjs`

- [ ] **Step 1: Write service RED coverage**

Prove length-delimited HMAC domain separation, no raw subject in stored rows, deterministic rule order, final-slot acceptance, next-request denial, fixed-window reset, latest `Retry-After`, all-rule no-write denial, concurrent same-bucket consumption, bounded-retry exhaustion, randomized cleanup, 100-row cap, and reactivation-safe deletion.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/operational-rate-limit.test.mjs tests/commerce-core.test.mjs
```

Expected: missing service exports.

- [ ] **Step 3: Implement the minimum atomic service**

Build the HMAC payload by length-prefixing the `operational-rate-limit:v1` domain, policy, scope, every component label, and every normalized value. Resolve and sort rules before the transaction. Inside `runCommerceTransaction`, load every bucket, return the latest active block with zero writes if any rule is exhausted, reset expired windows, increment every permitted bucket, and set `blockedUntil` when the accepted request fills the final slot. Map validation, secret, or database/retry failure to `UNAVAILABLE`.

After the committed decision, sample cleanup one-in-64. Select at most 100 rows older than the conservative 24-hour boundary and repeat the stale `updatedAt` plus inactive `blockedUntil` predicate in deletion. Cleanup failure does not change the decision and logs no request-derived data.

- [ ] **Step 4: Run GREEN**

```powershell
node --test tests/operational-rate-limit.test.mjs tests/operational-rate-limit-policy.test.mjs tests/commerce-core.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat: enforce atomic operational quotas`

### Task 4: Enforce the SMTP ceiling

**Files:**
- Create: `tests/auth-mail-ceiling.test.mjs`
- Modify: `tests/auth-registration.test.mjs`
- Modify: `tests/operational-rate-limit-schema.test.mjs`
- Modify: `tests/admin-operation-service.test.mjs`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/20260831120000_operational_rate_limit_bucket/migration.sql`
- Modify: `lib/auth-mail.ts`
- Modify: `lib/admin/email-intents.ts`
- Modify: `app/api/account/register/route.ts`

**Private boundary:**

```ts
type MailAttemptClass = "PUBLIC_AUTH" | "SECURITY"

async function sendMail(
  mailClass: unknown,
  to: string,
  subject: string,
  text: string,
): Promise<MailResult>

export async function sendExistingAccountRegistrationNotice(
  email: string,
): Promise<MailResult>
```

- [ ] **Step 1: Write mail RED coverage**

Inject limiter and Nodemailer doubles. Prove unconfigured SMTP consumes no quota; denied/unavailable quota constructs no transporter; allowed delivery constructs once and sends once; provider failure is not refunded; unknown classification fails closed; verification/reset/setup/existing-account notice use `PUBLIC_AUTH`; account-change notices use `SECURITY`.

Add Admin-intent RED coverage proving SMTP never runs inside an interactive
transaction; concurrent initial and retry attempts make one provider call; a
live claim is busy without an attempt; an expired claim is recoverable; a stale
finalizer is ambiguous; and retry replay consumes neither another claim nor
another provider attempt.

- [ ] **Step 2: Run RED**

```powershell
node --test tests/auth-mail-ceiling.test.mjs tests/auth-registration.test.mjs
```

Expected: wrappers lack mandatory classification and registration reuses the security notice.

- [ ] **Step 3: Implement the minimum classified boundary**

Order `sendMail` as: validate class; return undelivered if SMTP is unconfigured; consume the matching operational request; return undelivered on denial/unavailability; construct transporter; attempt exactly one send. Do not refund after timeout or provider error. Move the existing-account registration subject/copy into the dedicated wrapper and replace the registration route's `sendAccountChangeEmail` use.

Extend the same pending additive migration with nullable
`AdminEmailIntent.deliveryClaimTokenHash`,
`AdminEmailIntent.deliveryClaimExpiresAt`, and unique
`AdminEmailIntent.deliveryClaimOperationKeyHash`, plus the append-only
`AdminEmailRetryOperationKey` owner; do not add another migration or a transient
enum value. The owner stores only a domain-separated operation-key hash, binds
it to one `AdminEmailIntent`, and is never deleted. Claim an eligible intent in
a short transaction using a separate domain-separated hash of 32 random bytes
and a five-minute lease, call the ordinary classified sender only after commit,
and finalize only the exact claim in a second short transaction. Keep
`PENDING`/`FAILED` while claimed. Live claims return busy without transport. An
expired retry claim may be recovered either by the same reserved retry key or a
fresh key that creates another permanent owner for the same intent. Neither key
may ever claim a different intent. Stale post-provider finalizers return
ambiguous without overwriting replacement claims. Retry finalization clears
only active claim state and persists its audit and outcome atomically; every
historical hashed key owner remains append-only.

- [ ] **Step 4: Run GREEN and regressions**

```powershell
node --test tests/auth-mail-ceiling.test.mjs tests/auth-registration.test.mjs tests/auth-registration-service.test.mjs tests/email-verification-request.test.mjs tests/email-verification-request-route.test.mjs tests/auth-password-reset-request.test.mjs tests/password-reset-request-route.test.mjs tests/account-security-email-intents.test.mjs tests/account-security-email-retry.test.mjs tests/admin-operation-service.test.mjs tests/admin-security-service.test.mjs tests/dependency-security.test.mjs tests/operational-rate-limit-schema.test.mjs
```

- [ ] **Step 5: Review and commit**

Commit: `feat: enforce deployment-wide email ceilings`

### Task 5: Record evidence and release boundary

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify: `docs/wiki/deployment.md`
- Modify: `docs/wiki/release-checklist.md`

- [ ] **Step 1: Update only verified current state**

Record the new additive migration as the pending 46th migration requiring separate authorization, the exact test receipts, the no-email/no-provider boundary, and additive rollback posture. Do not silently rewrite the status of prior migrations without current evidence.

- [ ] **Step 2: Run exact-head validation**

```powershell
npm run prisma:validate
npm run prisma:generate
node --test tests/operational-rate-limit-schema.test.mjs tests/operational-rate-limit-policy.test.mjs tests/operational-rate-limit.test.mjs tests/auth-mail-ceiling.test.mjs tests/auth-rate-limit.test.mjs
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

- [ ] **Step 3: Review and commit**

Commit: `docs: record operational limiter release boundary`

## Completion receipts

- One additive migration only; no migration application.
- All policy keys are private/versioned and all stored subjects are HMAC-reduced.
- Multi-rule consumption is atomic and failure is closed.
- Public auth can consume at most 70 of 90 daily mail attempts, preserving 20 for security mail.
- Denied/unavailable mail constructs no SMTP client; provider tests are fully stubbed.
- Exact reviewed head, clean status, focused/full command output, and known pre-existing failures are recorded before PR B is based on it.
