# Identity and Account-Method Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support email/password and Google as independent credentials on one normalized-email MassageLab account without silent linking, duplicate users, last-method lockout, unbounded email abuse, or unrecoverable auth UI.

**Architecture:** Replace Auth.js dangerous email linking with a browser-bound, short-lived intent that intercepts the verified Google callback before adapter linking. A matching-account owner then completes a fresh Auth.js Credentials sign-in, giving the confirmation route a five-minute password-authenticated session claim in addition to the Google/browser proof. Centralize password/2FA proof and account-method mutations in transaction-safe services, persist leased retryable security-email intents, and replace raw limiter keys with hashed account/network buckets: registration/reset consume all accepted work, while login/2FA count failures without charging healthy household sign-ins.

**Tech Stack:** Next.js 16 App Router, React 19, Auth.js 5 beta with Prisma Adapter, Prisma 7/PostgreSQL, Argon2, TOTP/backup codes, Node.js 24 tests, Playwright 1.60, and SMTP email delivery.

**Spec:** `docs/superpowers/specs/2026-08-28-family-friends-readiness-design.md`

## Global Constraints

- One normalized email identifies one MassageLab user. A matching Google email must not create a second user.
- Remove `allowDangerousEmailAccountLinking`; Google proof alone must not take over an existing password account.
- Password-first Google linking requires verified Google proof, a fresh Auth.js password sign-in with applicable two-factor proof, a matching session user, and explicit confirmation.
- Google-first password addition requires recent Google reauthentication or the verified email recovery path.
- Removing either credential requires recent proof, explicit confirmation, and another usable credential remaining.
- OAuth tokens, password material, TOTP secrets, backup codes, raw email/IP limiter identifiers, and linking proofs must not appear in URLs, local storage, routine logs, or release evidence.
- Linking intents are HttpOnly, SameSite=Lax, Secure in production, browser-bound, single-use, and expire after ten minutes.
- Public registration and password-reset responses do not disclose whether an account exists. The post-Google matching notice is allowed because the person has proven control of that exact Google email.
- Successful and failed syntactically accepted registration/reset requests consume account and network quotas before database or email work.
- A household network must accommodate the first three to five people; account buckets remain tighter than network buckets.
- Security-method changes queue a durable email intent in the same transaction. Delivery happens after commit; delivery failure never rolls back a safe credential change.
- Keep legal acceptance, callback sanitization, session-version revocation, current feature-key access, and local-first PHI boundaries intact.
- Do not change membership billing, sitewide route progress, session feature-key reuse, or production provider settings in this branch.
- Use strict TDD, focused JSDoc, bounded serializable transactions, and one reviewable commit per task.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Adds privacy-safe rate scopes, method intents, leased security-email intents, and relations. |
| `prisma/migrations/20260828120000_identity_method_safety/migration.sql` | Deletes ephemeral raw limiter keys, adds new auth tables/indexes, and enforces normalized-email uniqueness. |
| `scripts/check-normalized-email-collisions.mjs` | Read-only count-only preflight for the functional normalized-email index. |
| `tests/auth-schema-migration.test.mjs` | Guards additive schema, raw limiter deletion order, functional index, and no token/payload columns. |
| `tests/auth-google-callback-flow.test.mjs` | Locks the installed Auth.js sign-in-callback seam and absence of dangerous linking. |
| `lib/auth-rate-limit.ts` | HMAC account/network buckets, all-work email quotas, failure-only credential quotas, intentional retry metadata, and bounded cleanup. |
| `tests/auth-rate-limit.test.mjs` | Tests account/network thresholds, concurrency, expiry, cleanup, and privacy. |
| `lib/auth-method-proof.ts` | Shared password, two-factor, and one-use backup-code proof for login and method changes. |
| `tests/auth-method-proof.test.mjs` | Tests proof result codes, rate limiting, 2FA, and concurrent backup-code use. |
| `lib/auth-method-intents.ts` | Starts browser-bound intents and prepares Google create/link/reauth decisions. |
| `tests/auth-method-intents.test.mjs` | Tests new Google creation, normalized-email collision, expiry, replay, and browser binding. |
| `lib/account-security-email-intents.ts` | Queues and delivers retryable security notifications without logging sensitive fields. |
| `lib/account-security-methods.ts` | Transactional add/change/remove/link operations and last-method enforcement. |
| `tests/account-security-email-intents.test.mjs` | Tests durable queue, idempotency, delivery, and safe failure codes. |
| `tests/account-security-methods.test.mjs` | Tests proof requirements, single-use intents, conflicts, revocation, and notifications. |
| `lib/auth-registration-service.ts` | Enumeration-safe password registration/resend/existing-account behavior. |
| `tests/auth-registration-service.test.mjs` | Behavioral registration concurrency and existing-account matrix. |
| `lib/password-reset-request.ts` | Enumeration-safe, fully rate-consumed reset-request service. |
| `tests/auth-password-reset-request.test.mjs` | Known/unknown equality, delivery, quota, and provider-failure behavior. |
| `lib/password-reset-confirmation.ts` | Existing atomic reset consumption plus security-email intent output. |
| `auth.ts` | Uses shared credential proof and safe Google callback decision; removes dangerous linking. |
| `app/api/auth/google/intent/route.ts` | Starts sign-in/link/reauth intent and writes its private binding cookie. |
| `app/api/account/security/google/link/confirm/route.ts` | Confirms matching Google link from fresh password-authenticated session, browser-bound Google proof, and consent. |
| `app/api/account/security/google/unlink/route.ts` | Removes Google only after recent password/2FA proof and last-method recheck. |
| `app/api/account/security/password/route.ts` | Adds/changes password with the correct recent proof. |
| `app/api/account/security/password/disable/route.ts` | Removes password only after recent Google reauth and last-method recheck. |
| `app/api/account/register/route.ts` | Thin validation/response adapter around the registration service. |
| `app/api/account/password-reset/request/route.ts` | Thin validation/response adapter around the reset-request service. |
| `app/account/link-google/page.tsx` | Server-resolved matching-account explanation; no proof in URL. |
| `app/account/link-google/link-google-form.tsx` | Password/2FA/confirmation form and recoverable client states. |
| `app/account/security/sign-in-methods-panel.tsx` | Focused add/change/remove method UI. |
| `app/account/security/security-panel.tsx` | Retains TOTP/backup-code UI and composes the method panel. |
| `app/login/login-form.tsx` | Starts a Google sign-in intent before Auth.js OAuth. |
| `app/register/register-form.tsx` | Starts a Google registration intent before Auth.js OAuth. |
| `types/next-auth.d.ts` | Carries a private-to-the-account five-minute password-authenticated session timestamp used by link confirmation. |
| `lib/account-surface-data.js` and `.d.ts` | Existing method-availability contract consumed unchanged by the security panel. |
| `tests/account-security-routes.test.mjs` | Route-level auth, validation, response, cookie, and delivery scheduling contracts. |
| `lib/auth/browser-fixture-identity.ts` | Deterministic example.test identities for opt-in disposable-database browser QA. |
| `lib/auth/browser-fixture-records.ts` | Creates and removes only the deterministic browser-QA users, methods, and intents. |
| `tests/browser/identity-method-safety-fixture.ts` | Fails closed unless a disposable database is explicitly opted in, then installs records/cookies and cleans them. |
| `tests/browser/identity-method-safety.spec.ts` | Browser UI coverage with deterministic local API/session fixtures and no real provider calls. |
| `tests/browser/ci-lanes.mjs` | Assigns the identity browser spec exactly once to each ordinary browser project. |
| `tests/browser/ci-lanes.test.mjs` and `tests/browser-qa-harness.test.mjs` | Guard 24 project/spec pairs after adding the identity spec. |

---

### Task 1: Lock the Auth.js seam and add identity persistence

**Files:**
- Create: `tests/auth-google-callback-flow.test.mjs`
- Create: `tests/auth-schema-migration.test.mjs`
- Create: `scripts/check-normalized-email-collisions.mjs`
- Create: `prisma/migrations/20260828120000_identity_method_safety/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `package.json`

**Interfaces:**
- Produces enums: `AuthAttemptScope`, `AuthMethodIntentPurpose`, `AuthMethodIntentStatus`, `AccountSecurityEmailKind`, `AccountSecurityEmailIntentStatus`.
- Produces models: `AuthMethodIntent`, `AccountSecurityEmailIntent`.
- Changes `AuthAttempt.key` to `keyHash` and adds `scope` with unique `(purpose, scope, keyHash)`.
- Produces database-only unique index `User_normalized_email_key` on `lower(btrim(email))` for non-null email.
- Produces command: `npm run auth:check-normalized-emails`.

- [ ] **Step 1: Write the failing Auth.js seam test**

Create `tests/auth-google-callback-flow.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("Google callback safety seam", () => {
  it("runs Auth.js signIn callback before adapter login/register handling", async () => {
    const callbackSource = await readFile(
      new URL("../node_modules/@auth/core/lib/actions/callback/index.js", import.meta.url),
      "utf8",
    )
    const oauthBranch = callbackSource.indexOf('provider.type === "oauth"')
    const authorizedCall = callbackSource.indexOf("const redirect = await handleAuthorized({", oauthBranch)
    const adapterCall = callbackSource.indexOf("await handleLoginOrRegister(", authorizedCall)
    const authorizedFunction = callbackSource.indexOf("async function handleAuthorized")
    const signInCall = callbackSource.indexOf("authorized = await signIn(params)", authorizedFunction)
    assert.ok(oauthBranch >= 0)
    assert.ok(authorizedCall > oauthBranch)
    assert.ok(adapterCall > authorizedCall)
    assert.ok(signInCall > authorizedFunction)
  })
})
```

- [ ] **Step 2: Write the failing schema and migration contract**

Create `tests/auth-schema-migration.test.mjs`. Read the schema, migration, preflight script, and `package.json`; assert:

```js
assert.match(schema, /enum AuthAttemptScope[\s\S]*ACCOUNT[\s\S]*NETWORK/)
assert.match(schema, /enum AuthAttemptPurpose[\s\S]*GOOGLE_INTENT/)
assert.match(schema, /model AuthMethodIntent[\s\S]*browserBindingHash\s+String/)
assert.match(schema, /enum AccountSecurityEmailIntentStatus[\s\S]*PROCESSING[\s\S]*DELIVERED[\s\S]*FAILED/)
assert.match(schema, /enum AccountSecurityEmailKind[\s\S]*PASSWORD_CHANGED/)
assert.match(schema, /model AccountSecurityEmailIntent[\s\S]*idempotencyKey\s+String\s+@unique[\s\S]*claimTokenHash\s+String\?[\s\S]*claimExpiresAt\s+DateTime\?/)
assert.doesNotMatch(schema.match(/model AuthMethodIntent[\s\S]*?\n\}/)?.[0] ?? "", /accessToken|refreshToken|idToken|rawPayload/)
assert.match(migration, /DELETE FROM "AuthAttempt";[\s\S]*RENAME COLUMN "key" TO "keyHash"/)
assert.match(migration, /CREATE UNIQUE INDEX "User_normalized_email_key"[\s\S]*lower\(btrim\("email"\)\)/)
assert.match(preflight, /normalized_collision_count/)
assert.doesNotMatch(preflight, /SELECT[\s\S]*email[\s\S]*console\.log/i)
assert.equal(packageJson.scripts["auth:check-normalized-emails"], "node scripts/check-normalized-email-collisions.mjs")
```

- [ ] **Step 3: Run both tests and verify RED**

```bash
node --test tests/auth-google-callback-flow.test.mjs tests/auth-schema-migration.test.mjs
```

Expected: the callback-order assertion passes against the installed dependency and the new persistence assertions fail. If callback order fails, stop and redesign instead of building a custom OAuth flow or enabling dangerous linking.

- [ ] **Step 4: Add the exact Prisma schema**

Add the enums and these field contracts:

```prisma
enum AuthAttemptScope {
  ACCOUNT
  NETWORK
}

enum AuthMethodIntentPurpose {
  SIGN_IN_OR_LINK
  LINK_GOOGLE
  ADD_PASSWORD
  REMOVE_PASSWORD
}

enum AuthMethodIntentStatus {
  PENDING
  PROVIDER_PROVEN
  CONSUMED
}

enum AccountSecurityEmailKind {
  GOOGLE_LINKED
  GOOGLE_UNLINKED
  PASSWORD_ENABLED
  PASSWORD_CHANGED
  PASSWORD_DISABLED
  PASSWORD_RECOVERED
}

enum AccountSecurityEmailIntentStatus {
  PENDING
  PROCESSING
  DELIVERED
  FAILED
}
```

Extend the existing `AuthAttemptPurpose` enum with `GOOGLE_INTENT`; the migration adds the enum value before the new intent route can consume its network bucket.

Replace the current `AuthAttempt` key contract:

```prisma
model AuthAttempt {
  id           String             @id @default(cuid())
  purpose      AuthAttemptPurpose
  scope        AuthAttemptScope
  keyHash      String
  count        Int                @default(0)
  windowStart  DateTime           @default(now())
  blockedUntil DateTime?
  updatedAt    DateTime           @updatedAt

  @@unique([purpose, scope, keyHash])
  @@index([updatedAt])
  @@index([blockedUntil])
}
```

Add these exact models and the two named User relations:

```prisma
model AuthMethodIntent {
  id                  String                 @id @default(cuid())
  targetUserId        String?
  purpose             AuthMethodIntentPurpose
  status              AuthMethodIntentStatus @default(PENDING)
  provider            String                 @default("google")
  browserBindingHash  String                 @unique
  providerAccountId   String?
  providerEmailHash   String?
  providerProvenAt    DateTime?
  expiresAt           DateTime
  consumedAt          DateTime?
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt
  targetUser          User?                  @relation("AuthMethodIntentTarget", fields: [targetUserId], references: [id], onDelete: Cascade)

  @@index([targetUserId, purpose, status])
  @@index([status, expiresAt])
  @@index([provider, providerAccountId])
}

model AccountSecurityEmailIntent {
  id               String                           @id @default(cuid())
  userId           String
  kind             AccountSecurityEmailKind
  recipientEmail   String
  subject          String
  message          String
  status           AccountSecurityEmailIntentStatus @default(PENDING)
  idempotencyKey   String                           @unique
  attemptCount     Int                              @default(0)
  claimTokenHash   String?
  claimExpiresAt   DateTime?
  lastAttemptedAt  DateTime?
  deliveredAt      DateTime?
  failureCode      String?
  createdAt        DateTime                         @default(now())
  updatedAt        DateTime                         @updatedAt
  user             User                             @relation("AccountSecurityEmailUser", fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, claimExpiresAt])
  @@index([userId, createdAt])
}
```

Add `authMethodIntents AuthMethodIntent[] @relation("AuthMethodIntentTarget")` and `accountSecurityEmailIntents AccountSecurityEmailIntent[] @relation("AccountSecurityEmailUser")` to User. No model contains an OAuth token, password/2FA material, raw provider payload, or raw limiter identifier.

- [ ] **Step 5: Add the migration with privacy-preserving order**

Generate/edit `prisma/migrations/20260828120000_identity_method_safety/migration.sql` so it:

```sql
DELETE FROM "AuthAttempt";
ALTER TABLE "AuthAttempt" RENAME COLUMN "key" TO "keyHash";
ALTER TABLE "AuthAttempt" ADD COLUMN "scope" "AuthAttemptScope" NOT NULL;
DROP INDEX "AuthAttempt_purpose_key_key";
CREATE UNIQUE INDEX "AuthAttempt_purpose_scope_keyHash_key"
  ON "AuthAttempt"("purpose", "scope", "keyHash");
CREATE INDEX "AuthAttempt_updatedAt_idx" ON "AuthAttempt"("updatedAt");
CREATE INDEX "AuthAttempt_blockedUntil_idx" ON "AuthAttempt"("blockedUntil");
CREATE UNIQUE INDEX "User_normalized_email_key"
  ON "User" (lower(btrim("email"))) WHERE "email" IS NOT NULL;
```

Add `GOOGLE_INTENT` to the existing purpose enum, then create the new enums/tables/indexes and foreign keys before their use. The deletion must precede the rename so no existing raw email/IP limiter key survives. Do not rewrite existing User, Account, PasswordCredential, subscription, purchase, or entitlement rows.

- [ ] **Step 6: Add a count-only collision preflight**

Create `scripts/check-normalized-email-collisions.mjs` using a Prisma client and a fixed query that returns only:

```sql
SELECT COUNT(*)::int AS normalized_collision_count
FROM (
  SELECT lower(btrim("email"))
  FROM "User"
  WHERE "email" IS NOT NULL
  GROUP BY lower(btrim("email"))
  HAVING COUNT(*) > 1
) collisions
```

Print only `normalized_collision_count=<number>`. Exit nonzero when the count is not zero. Require `AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL`, validate that it is a direct non-pooler Neon URL, and redact URL-like/error tokens with the existing backfill-script pattern. Add `"auth:check-normalized-emails": "node scripts/check-normalized-email-collisions.mjs"` to `package.json`. Running it against production is a later read-only release gate, not part of local implementation.

- [ ] **Step 7: Verify schema and migration contracts**

```bash
npm run prisma:generate
npm run prisma:validate
node --test tests/auth-google-callback-flow.test.mjs tests/auth-schema-migration.test.mjs
git diff --check
```

Expected: all schema, migration, preflight, and installed-dependency seam assertions pass.

- [ ] **Step 8: Commit persistence and the dependency seam test**

```bash
git add package.json prisma/schema.prisma prisma/migrations/20260828120000_identity_method_safety/migration.sql scripts/check-normalized-email-collisions.mjs tests/auth-schema-migration.test.mjs tests/auth-google-callback-flow.test.mjs
git commit -m "feat: add identity method safety persistence"
```

---

### Task 2: Replace raw failure-only auth limits and centralize proof

**Files:**
- Modify: `lib/auth-rate-limit.ts`
- Modify: `lib/domain-types.ts`
- Create: `lib/auth-method-proof.ts`
- Create: `tests/auth-rate-limit.test.mjs`
- Create: `tests/auth-method-proof.test.mjs`
- Modify: `auth.ts`
- Modify: `types/next-auth.d.ts`
- Modify: `tests/auth-session-version.test.mjs`

**Interfaces:**
- Produces: `AuthRateLimitScope = "ACCOUNT" | "NETWORK"`
- Produces: `AuthRateLimitDecision = { allowed: true } | { allowed: false, retryAfterSeconds: number }`
- Produces: `authRateLimitKeyHash({ purpose, scope, identifier, secret }): string`
- Produces: `consumeEmailWorkRateLimit(...)` for REGISTER/PASSWORD_RESET accepted work.
- Produces: `consumeGoogleIntentStartRateLimit(...)` for the privacy-hashed GOOGLE_INTENT network bucket.
- Produces: `checkCredentialRateLimit(...)`, `recordCredentialFailure(...)`, and `clearCredentialAccountFailures(...)` for LOGIN/TWO_FACTOR.
- Produces: `pruneAuthRateLimits({ prismaClient, before, maxRows }): Promise<number>` plus a deterministic injectable `maybePruneAuthRateLimits` hook.
- Produces: `verifyPasswordMethodProof(...): Promise<PasswordMethodProofResult>`
- Extends maintained `AuthAttemptPurpose` with `GOOGLE_INTENT` so it stays aligned with Prisma.
- Extends JWT/session typing with `lastPasswordAuthenticatedAt?: number` as finite epoch milliseconds; it is minted only by a successful Credentials sign-in.
- Preserves public credential-login error codes.

- [ ] **Step 1: Write failing limiter tests**

Cover exact 15-minute policies:

```ts
REGISTER:       account 5, network 12
PASSWORD_RESET: account 5, network 20
LOGIN:          account 8, network 30
TWO_FACTOR:     account 8, network 30
GOOGLE_INTENT:  network 30
```

Test accepted registration/reset consumption, a sixth registration for one account, twelve distinct household registrations, the thirteenth network request, exact `Retry-After`, 15-minute expiry, two concurrent increments without lost count, HMAC domain separation, 64-character stored hashes, and absence of raw identifiers. Source/assertion coverage keeps `lib/domain-types.ts` aligned with Prisma by requiring `GOOGLE_INTENT`. For LOGIN/TWO_FACTOR, prove successful proofs do not increment either bucket, failed proofs increment account and network atomically, the network block cannot be cleared by one successful account, and three to five healthy household users can repeatedly sign in. For GOOGLE_INTENT, prove thirty accepted starts consume the privacy-hashed network bucket, the thirty-first is rejected before an intent row is created, and no raw network identifier is persisted or logged. Prove `pruneAuthRateLimits` deletes at most 100 stale rows and `maybePruneAuthRateLimits` can be forced on/off in tests.

- [ ] **Step 2: Write failing shared-proof tests**

In `tests/auth-method-proof.test.mjs`, use a fake Prisma dependency to cover invalid password, unverified email, required/invalid/valid TOTP, one-use backup code, two concurrent uses of one backup code where only one `updateMany(...usedAt: null)` succeeds, pre-proof limiter rejection, failed-proof recording, and successful proof clearing only that account's LOGIN/TWO_FACTOR failure buckets without incrementing or clearing the shared network bucket.

Use this result union:

```ts
type PasswordMethodProofResult =
  | { status: "VERIFIED"; backupCodeConsumed: boolean; authSessionVersion: number }
  | { status: "EMAIL_UNVERIFIED" | "INVALID" | "TWO_FACTOR_REQUIRED" | "TWO_FACTOR_INVALID" | "RATE_LIMITED" }
```

- [ ] **Step 3: Run both focused tests and verify RED**

```bash
node --test tests/auth-rate-limit.test.mjs tests/auth-method-proof.test.mjs
```

Expected: FAIL because the new APIs and proof service do not exist.

- [ ] **Step 4: Implement privacy-safe email-work and credential-failure policies**

Use HMAC-SHA256 with `AUTH_SECRET` and input `${purpose}\0${scope}\0${identifier}`. Normalize email before hashing; normalize IP to the already extracted address string and never persist or log it.

`consumeEmailWorkRateLimit` is restricted to REGISTER/PASSWORD_RESET. In one bounded serializable transaction it checks and increments both account and network buckets before database/hash/email work, so successful and failed accepted requests consume quota. `consumeGoogleIntentStartRateLimit` consumes only the GOOGLE_INTENT network bucket before any intent lookup/prune/create and returns the same bounded retry metadata. `checkCredentialRateLimit` reads LOGIN/TWO_FACTOR account/network blocks before proof without incrementing. Only a failed password, TOTP, or backup-code proof calls `recordCredentialFailure`, which increments both buckets atomically. A fully successful proof calls `clearCredentialAccountFailures` for that account only; it neither increments nor clears the shared network bucket. A blocked result includes `Math.max(1, Math.ceil((blockedUntil-now)/1000))`.

Bounded cleanup first selects at most `maxRows` rows whose `updatedAt < before` and whose `blockedUntil` is null or expired, then deletes only those IDs. `consumeEmailWorkRateLimit`, `consumeGoogleIntentStartRateLimit`, and `recordCredentialFailure` schedule `maybePruneAuthRateLimits({ maxRows: 100, before: now - 24 hours })` after their primary transaction. Its injected `shouldPrune()` defaults to one privacy-neutral random sample in 64, so cleanup is exercised without adding a query to every request.

- [ ] **Step 5: Extract password and two-factor proof**

Move the password/TOTP/backup-code logic from the Credentials provider into `verifyPasswordMethodProof`. Query by `userId` for account-method changes and by normalized email through a thin login adapter. Consume the backup code with:

```ts
const consumed = await prismaClient.backupCode.updateMany({
  where: { id: validBackupCodeId, usedAt: null },
  data: { usedAt: now },
})
if (consumed.count !== 1) return { status: "TWO_FACTOR_INVALID" }
```

Map the result back to the existing `EMAIL_UNVERIFIED`, `INVALID_CREDENTIALS`, `RATE_LIMITED`, `TWO_FACTOR_REQUIRED`, and `TWO_FACTOR_INVALID` login errors. On successful Credentials sign-in, return server-produced finite epoch milliseconds as `passwordAuthenticatedAt`. Only the JWT callback branch where `account.provider === "credentials"` may copy it to `lastPasswordAuthenticatedAt`; every other sign-in leaves that claim unset. Link confirmation accepts only a finite value with `0 <= now - lastPasswordAuthenticatedAt <= 5 minutes`, rejecting missing, future, or expired values. Update mocks and session assertions in `tests/auth-session-version.test.mjs` for the new rate/proof imports and claim.

- [ ] **Step 6: Run focused and regression tests**

```bash
node --test tests/auth-rate-limit.test.mjs tests/auth-method-proof.test.mjs tests/auth-security.test.mjs tests/auth-session-version.test.mjs
npm run typecheck
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit limiter and proof services**

```bash
git add auth.ts types/next-auth.d.ts lib/auth-rate-limit.ts lib/auth-method-proof.ts lib/domain-types.ts tests/auth-rate-limit.test.mjs tests/auth-method-proof.test.mjs tests/auth-session-version.test.mjs
git commit -m "security: bound auth work and share method proof"
```

---

### Task 3: Replace dangerous Google linking with private intents

**Files:**
- Create: `lib/auth-method-intents.ts`
- Create: `tests/auth-method-intents.test.mjs`
- Create: `app/api/auth/google/intent/route.ts`
- Modify: `auth.ts`
- Modify: `app/login/login-form.tsx`
- Modify: `app/register/register-form.tsx`
- Modify: `lib/legal-acceptance-gate.js`
- Modify: `tests/legal-acceptance.test.mjs`
- Modify: `tests/auth-google-callback-flow.test.mjs`

**Interfaces:**
- Produces cookie: `AUTH_METHOD_INTENT_COOKIE = "ml-auth-method-binding"`.
- Produces: `startAuthMethodIntent(...) -> { intentId, expiresAt, browserBindingToken }`.
- Produces: `prepareGoogleAuthentication(...) -> CONTINUE | LINK_REQUIRED | REAUTH_COMPLETE | REJECTED`.
- Consumes only verified Google profile email and allowlisted Account fields.
- Fixed callback destinations: `/account/link-google`, `/account?tab=security&reauth=complete`, and the three allowlisted retry paths; SIGN_IN_OR_LINK additionally preserves the normalized registration legal gate.

- [ ] **Step 1: Write failing intent-service tests**

Cover: unverified/missing Google email; no intent; other-browser token; expired/consumed intent; existing linked provider; first Google user creation; normalized-email existing password account returning `LINK_REQUIRED` without Account creation; current-session Google reauth; provider ID attached to another user; and replay. Route/handler cases prove the thirtieth network start is accepted, the thirty-first returns 429 before row creation, raw network data is absent, an already-built registration legal gate with a safe nested callback is rebuilt equivalently, a malicious prebuilt gate's nested external/API/legal callback falls back to `/onboarding`, and security-purpose callbacks ignore caller input. Callback cases assert each rejected condition returns its fixed recoverable retry path rather than `false`/AccessDenied.

Include concurrent first-use proof:

```js
const results = await Promise.all([
  prepareGoogleAuthentication(googleInput(db, " Family@Example.com ", "google-sub-a")),
  prepareGoogleAuthentication(googleInput(db, "family@example.com", "google-sub-a")),
])
assert.equal(db.usersByNormalizedEmail("family@example.com").length, 1)
assert.equal(db.accountsByProviderId("google", "google-sub-a").length, 1)
assert.deepEqual(results.map((result) => result.kind).sort(), ["CONTINUE", "CONTINUE"])
```

Barrier a second race so a password user appears between the initial read and create; the retry must return `LINK_REQUIRED`, create no Google Account, and leave one browser-bound `PROVIDER_PROVEN` intent.

Add the dangerous-linking case to `tests/auth-google-callback-flow.test.mjs` in this task:

```js
it("does not allow Auth.js automatic email account linking", async () => {
  const authSource = await readFile(new URL("../auth.ts", import.meta.url), "utf8")
  assert.doesNotMatch(authSource, /allowDangerousEmailAccountLinking\s*:\s*true/)
  assert.match(authSource, /prepareGoogleAuthentication/)
})
```

- [ ] **Step 2: Run the intent test and verify RED**

```bash
node --test tests/auth-method-intents.test.mjs tests/auth-google-callback-flow.test.mjs tests/legal-acceptance.test.mjs
```

Expected: FAIL because the service/route do not exist and dangerous linking remains.

- [ ] **Step 3: Implement intent creation**

Before any intent lookup, pruning, or creation, the route calls `consumeGoogleIntentStartRateLimit` with the already extracted network address and returns HTTP 429 plus exact `Retry-After` when blocked. `startAuthMethodIntent` then generates 32 random bytes for the binding token, stores only its HMAC/SHA-256 binding hash, expires at `now + 10 minutes`, and prunes at most 100 expired/consumed intents before creating one `PENDING` row. `LINK_GOOGLE`, `ADD_PASSWORD`, and `REMOVE_PASSWORD` require `targetUserId`; `SIGN_IN_OR_LINK` may be anonymous but is no longer an unbounded database-write path.

The intent route accepts only:

```ts
type GoogleIntentPurpose = "SIGN_IN_OR_LINK" | "LINK_GOOGLE" | "ADD_PASSWORD" | "REMOVE_PASSWORD"
```

First harden `buildRegistrationLegalProviderRedirectPath`: when input already targets `/legal/accept`, parse only its `callbackUrl`, pass that nested value through `safePostLegalAcceptanceCallback`, and rebuild with `buildRegistrationLegalAcceptancePath`; never return the original gate string verbatim. Extend `tests/legal-acceptance.test.mjs` for safe nested paths, duplicate parameters, external/protocol-relative/API/nested-legal values, and malformed encoding. For `SIGN_IN_OR_LINK`, normalize caller input with that hardened builder. Add an exact test that a register-origin legal gate survives intent creation and the later Google callback round trip with the safe nested destination intact. For `LINK_GOOGLE`, `ADD_PASSWORD`, and `REMOVE_PASSWORD`, ignore caller callback input and return the fixed `/account?tab=security` destination after requiring a session. Set the returned token as an HttpOnly SameSite=Lax cookie with `maxAge: 600`, `secure: NODE_ENV === "production"`, and `path: "/"`. Its JSON contains only `{ ok: true, callbackUrl }`.

- [ ] **Step 4: Implement Google callback decisions**

`prepareGoogleAuthentication` runs bounded serializable database work:

- verify email/profile and browser binding;
- if provider account already belongs to the normalized user, consume/complete the intent and return `CONTINUE`;
- if no normalized user exists, create User with `emailVerified: now`, Profile, and minimal Google Account (`type`, `provider`, `providerAccountId`) in one transaction, call `ensureUserRole(userId, email, tx)` so configured Admin semantics are preserved, consume the intent, and return `{ kind: "CONTINUE", userId, created: true }`;
- if a normalized user exists without that provider, store only the verified email hash and provider account ID, mark the intent `PROVIDER_PROVEN`, and return `LINK_REQUIRED`;
- for account-security reauth, require the current session user, normalized email, and existing provider ID all match, then mark the exact purpose proof and return `REAUTH_COMPLETE`.

Do not store access, refresh, or ID tokens. A unique User/Account race retries and resolves to the existing user outcome; it never creates a duplicate or attaches to a different user. Every rejected outcome carries only one allowlisted fixed local `recoveryPath`: `/login?auth=google-retry`, `/login?auth=google-unavailable`, or `/account?tab=security&auth=google-retry`, selected from the intent purpose/session state rather than caller input. Tests cover missing, expired, wrong-browser, unverified-profile, and account-security rejection destinations.

- [ ] **Step 5: Wire Auth.js and remove dangerous linking**

Remove `allowDangerousEmailAccountLinking`. In the Google `signIn` callback, read the private cookie, call `prepareGoogleAuthentication`, and return only:

```ts
if (result.kind === "CONTINUE") return true
if (result.kind === "LINK_REQUIRED") return "/account/link-google"
if (result.kind === "REAUTH_COMPLETE") return "/account?tab=security&reauth=complete"
return result.recoveryPath
```

Keep `isVerifiedGoogleProfile` as the first check, but map failure to fixed `/login?auth=google-unavailable` retry UI instead of Auth.js AccessDenied. The register button's callback remains the existing sanitized `/legal/accept?...` destination, so first-time Google users must record required legal acceptance before entering ordinary app use even though the service created the user/account before Auth.js adapter handling. Login-originated callbacks keep their normalized legal-gate/app-local destination. No rejected callback returns `false` or a caller-provided URL.

- [ ] **Step 6: Start an intent before every owned Google button**

In login/register forms, POST the appropriate purpose to `/api/auth/google/intent`, wait for `{ ok: true, callbackUrl }`, then call `signIn("google", { redirectTo: callbackUrl })`. Keep a local pending/error state and `finally` cleanup; the sitewide shared pending primitive is introduced by Track 3.

- [ ] **Step 7: Run focused tests and commit**

```bash
node --test tests/auth-method-intents.test.mjs tests/auth-google-callback-flow.test.mjs tests/auth-registration.test.mjs tests/auth-session-version.test.mjs tests/legal-acceptance.test.mjs
npm run typecheck
npm run lint
git diff --check
git add auth.ts lib/auth-method-intents.ts app/api/auth/google/intent/route.ts app/login/login-form.tsx app/register/register-form.tsx lib/legal-acceptance-gate.js tests/auth-method-intents.test.mjs tests/auth-google-callback-flow.test.mjs tests/auth-registration.test.mjs tests/auth-session-version.test.mjs tests/legal-acceptance.test.mjs
git commit -m "security: require private Google auth intents"
```

Expected: all checks pass and no source contains dangerous automatic linking.

---

### Task 4: Implement transactional method changes and notifications

**Files:**
- Create: `lib/account-security-email-intents.ts`
- Create: `lib/account-security-methods.ts`
- Create: `tests/account-security-email-intents.test.mjs`
- Create: `tests/account-security-methods.test.mjs`
- Modify: `tests/auth-account-linking.test.mjs`

**Interfaces:**
- Produces: `queueAccountSecurityEmail(tx, { userId, kind, recipientEmail, idempotencyKey })`.
- Produces: `deliverAccountSecurityEmailIntent({ prismaClient, intentId, send, now })`.
- Produces `AuthMethodMutationResult = UPDATED | REJECTED` with safe result codes.
- Produces: `confirmGoogleLink`, `setPasswordMethod`, `removeGoogleMethod`, and `removePasswordMethod`.

- [ ] **Step 1: Write failing notification-intent tests**

Test unique idempotency, one delivery attempt at a time, `PENDING/FAILED -> PROCESSING -> DELIVERED`, a second worker rejected while the five-minute claim lease is live, expired-lease recovery after a crashed worker, safe `FAILED` code without raw error, retry from FAILED, no email-content logging, possible duplicate notification after an ambiguous provider send, and no credential rollback when delivery fails after commit.

- [ ] **Step 2: Write failing method-mutation tests**

Required cases:

```js
const first = await confirmGoogleLink(linkInput({
  sessionUserId: "user-1", lastPasswordAuthenticatedAt: nowMs, confirmed: true,
}))
const replay = await confirmGoogleLink(linkInput({
  sessionUserId: "user-1", lastPasswordAuthenticatedAt: nowMs, confirmed: true,
}))
assert.equal(first.status, "UPDATED")
assert.deepEqual(replay, { status: "REJECTED", code: "INTENT_EXPIRED" })
assert.equal(db.googleAccountsFor("user-1").length, 1)
assert.equal(db.securityEmailsByKind("GOOGLE_LINKED").length, 1)
```

Also cover missing explicit confirmation; absent, non-finite, future, mismatched, or stale password-authenticated session claims; provider collision; the target user's email changing after Google proof but before commit; Google-first password add without/mismatched/expired Google reauth; current-password change; Google unlink; password disable; concurrent removal; last-method rejection; and session-version increment for destructive credential changes. Wrong-password and required/invalid 2FA behavior stays in the shared Credentials proof tests that mint the recent session claim.

- [ ] **Step 3: Run service tests and verify RED**

```bash
node --test tests/account-security-email-intents.test.mjs tests/account-security-methods.test.mjs tests/auth-account-linking.test.mjs
```

Expected: FAIL because the services do not exist and the current unlink helper lacks recent proof.

- [ ] **Step 4: Implement durable security-email intents**

Queue the fixed subject/body chosen by `AccountSecurityEmailKind` inside the credential transaction. Use the account email at mutation time and a deterministic idempotency key such as `google-linked:<userId>:<authMethodIntentId>`. Include fixed copy for `PASSWORD_CHANGED` as well as enabled/disabled/recovered events.

Delivery generates a 32-byte claim token, stores only its hash, and atomically changes PENDING/FAILED—or PROCESSING with an expired lease—to PROCESSING with `claimExpiresAt = now + 5 minutes` while incrementing `attemptCount`. Only that claimant calls existing `sendAccountChangeEmail`; its compare-and-set records DELIVERED or FAILED with a small allowlisted code and clears claim fields. A live lease prevents concurrent sends. A crash after provider acceptance can cause a later duplicate security notice, so copy must remain idempotent and the runbook must treat duplicates as possible; the application never claims impossible exactly-once SMTP delivery. Never persist a thrown error message.

- [ ] **Step 5: Implement transaction-safe credential mutations**

Direct password/2FA proof happens before the credential-mutation transaction by calling `verifyPasswordMethodProof` with the root Prisma client. That proof owns its short rate-limit/backup-code transactions and returns the verified user's `authSessionVersion`; Argon2 and limiter work never run inside or open a nested mutation transaction. The later bounded serializable mutation transaction re-reads User, Account, PasswordCredential, TwoFactorSecret, and intent state and rejects `CONFLICT` if the current `authSessionVersion` differs from the proved version. This keeps the transaction short while preventing a password/method change between proof and commit.

Matching Google confirmation consumes only the fresh Credentials-session claim and requires `sessionUserId === intent.targetUserId` plus finite epoch milliseconds satisfying `0 <= now - lastPasswordAuthenticatedAt <= 5 minutes`; Google proof or a pre-existing unrelated session is insufficient. Inside the final transaction, normalize the reloaded target `User.email`, HMAC it with the same domain-separated helper used for `providerEmailHash`, and compare in constant time. A missing email or hash mismatch—including an email changed after the callback—rejects without attaching the provider. Every mutation must:

- consume the exact intent with an `updateMany` compare-and-set;
- require the pre-transaction proof's unchanged `authSessionVersion` where direct password/2FA proof is required, while matching-account linking consumes only the validated fresh Credentials-session claim;
- reject if the provider ID is attached elsewhere;
- create/delete only the requested credential;
- reject any result with zero remaining methods;
- increment `authSessionVersion` for password change/removal and provider removal;
- queue exactly one security email; and
- return a safe union, never an ORM/provider error.

Use these rejection codes: `INVALID_PROOF`, `TWO_FACTOR_REQUIRED`, `TWO_FACTOR_INVALID`, `INTENT_EXPIRED`, `LAST_METHOD`, `ALREADY_LINKED`, and `CONFLICT`.

- [ ] **Step 6: Run service tests and commit**

```bash
node --test tests/account-security-email-intents.test.mjs tests/account-security-methods.test.mjs tests/auth-account-linking.test.mjs tests/auth-security.test.mjs tests/auth-session-version.test.mjs
npm run typecheck
git diff --check
git add lib/account-security-email-intents.ts lib/account-security-methods.ts tests/account-security-email-intents.test.mjs tests/account-security-methods.test.mjs tests/auth-account-linking.test.mjs
git commit -m "security: enforce account method mutation proofs"
```

---

### Task 5: Make registration and reset enumeration-safe and fully bounded

**Files:**
- Create: `lib/auth-registration-service.ts`
- Create: `lib/password-reset-request.ts`
- Create: `tests/auth-registration-service.test.mjs`
- Create: `tests/auth-password-reset-request.test.mjs`
- Modify: `app/api/account/register/route.ts`
- Modify: `app/api/account/password-reset/request/route.ts`
- Modify: `lib/password-reset-confirmation.ts`
- Modify: `app/api/account/password-reset/confirm/route.ts`
- Modify: `tests/auth-registration.test.mjs`
- Modify: `tests/password-reset-confirmation.test.mjs`
- Modify: `tests/password-reset-confirm-route.test.mjs`

**Interfaces:**
- Produces `PublicAuthWorkResult = { status: "ACCEPTED" } | { status: "RATE_LIMITED", retryAfterSeconds: number }`.
- Produces: `registerPasswordAccount(input): Promise<PublicAuthWorkResult>`.
- Produces: `requestPasswordReset(input): Promise<PublicAuthWorkResult>`.
- Public accepted response: HTTP 202 with one neutral message for new, password-existing, Google-first, and unknown-reset cases.
- Internal email behavior differs only after quota consumption and never changes the public account-existence signal.

- [ ] **Step 1: Write failing registration-service tests**

Cover new User+Profile+PasswordCredential+verification token creation in one transaction; normalized duplicate race; unverified password user with correct password receiving a fresh verification; verified password user receiving an existing-account sign-in/reset notice; Google-first user receiving a password-add/recovery link; invalid password/legal input rejected before service; provider delivery failure preserving one recoverable account/token state; and identical public accepted results.

- [ ] **Step 2: Write failing reset-request tests**

Use the exact known/unknown equality case:

```js
for (const email of ["known@example.com", "unknown@example.com"]) {
  assert.deepEqual(await requestPasswordReset(resetInput(db, email)), { status: "ACCEPTED" })
}
assert.equal(db.rateBucket("PASSWORD_RESET", "ACCOUNT", "known@example.com").count, 1)
assert.equal(db.rateBucket("PASSWORD_RESET", "ACCOUNT", "unknown@example.com").count, 1)
assert.equal(db.sentResetMessages.length, 1)
assert.equal(db.persistedRawIdentifiers.length, 0)
```

Also test 429 with `Retry-After`, provider failure, expired-token cleanup, and no different status/body for unknown accounts.

- [ ] **Step 3: Run behavioral tests and verify RED**

```bash
node --test tests/auth-registration-service.test.mjs tests/auth-password-reset-request.test.mjs
```

Expected: FAIL because the services do not exist.

- [ ] **Step 4: Implement registration as one-account orchestration**

Consume REGISTER account/network buckets before hash, database, or email work. For a new email, create User, Profile, PasswordCredential, verification token, and legal acceptance transactionally, then call `ensureUserRole(userId, email, tx)` inside that transaction rather than hard-coding USER so the existing configured-Admin-email rule remains intact. For an existing email:

- unverified password user plus correct submitted password: issue a new verification token while preserving overlapping usable links;
- verified password user: send a fixed existing-account sign-in/reset notice;
- Google-first user: issue a password reset/addition token to the verified account email; and
- mismatched/untrusted submitted password: do not change credentials, but keep the same public accepted response.

Catch normalized-email unique races, reload, and follow the existing-account path. No path creates a second User. Return `{ status: "ACCEPTED" }` with the same message for every accepted account state, including delivery failure; the message always includes a neutral resend/recovery instruction. Preserve a recoverable token when delivery fails and expose delivery health only through privacy-safe operations, never the public response.

- [ ] **Step 5: Implement reset request and completion notification**

Consume PASSWORD_RESET account/network buckets for every syntactically valid request. Known verified users receive a single-use reset token; unknown users do not. Both return HTTP 202 and the same body. Do not record a failure merely because no user exists.

Extend `confirmPasswordReset` so the password/session-version/token-consumption transaction also queues `PASSWORD_RECOVERED`; return its email intent ID internally. The route schedules `deliverAccountSecurityEmailIntent` only after commit. Preserve the existing one-winner reset race and outward confirmation messages.

- [ ] **Step 6: Make routes thin and intentional**

Routes parse/validate, call the services, map `RATE_LIMITED` to HTTP 429 with the exact `Retry-After`, and map ACCEPTED to the neutral HTTP 202 response. No rate-limit exception escapes as a generic 500. Update the registration form's accepted copy to tell the person to check that address for the appropriate next step without saying whether an account already existed.

- [ ] **Step 7: Run focused tests and commit**

```bash
node --test tests/auth-registration-service.test.mjs tests/auth-password-reset-request.test.mjs tests/auth-registration.test.mjs tests/password-reset-confirmation.test.mjs tests/password-reset-confirm-route.test.mjs
npm run typecheck
npm run lint
git diff --check
git add lib/auth-registration-service.ts lib/password-reset-request.ts app/api/account/register/route.ts app/api/account/password-reset/request/route.ts lib/password-reset-confirmation.ts app/api/account/password-reset/confirm/route.ts tests/auth-registration-service.test.mjs tests/auth-password-reset-request.test.mjs tests/auth-registration.test.mjs tests/password-reset-confirmation.test.mjs tests/password-reset-confirm-route.test.mjs
git commit -m "security: make account entry enumeration safe"
```

---

### Task 6: Add account-method routes and recoverable UI

**Files:**
- Create: `app/account/link-google/page.tsx`
- Create: `app/account/link-google/link-google-form.tsx`
- Create: `app/api/account/security/google/link/confirm/route.ts`
- Create: `app/api/account/security/password/disable/route.ts`
- Create: `app/account/security/sign-in-methods-panel.tsx`
- Create: `lib/auth/browser-fixture-identity.ts`
- Create: `lib/auth/browser-fixture-records.ts`
- Create: `scripts/assert-browser-qa-database-target.mjs`
- Create: `tests/browser-qa-database-target.test.mjs`
- Create: `tests/browser/identity-method-safety-fixture.ts`
- Create: `tests/account-security-routes.test.mjs`
- Create: `tests/browser/identity-method-safety.spec.ts`
- Modify: `app/api/account/security/google/unlink/route.ts`
- Modify: `app/api/account/security/password/route.ts`
- Modify: `app/account/security/security-panel.tsx`
- Verify: `lib/account-surface-data.js`
- Verify: `lib/account-surface-data.d.ts`
- Verify: `tests/account-surface-data.test.mjs`
- Modify: `tests/browser/ci-lanes.mjs`
- Modify: `tests/browser/ci-lanes.test.mjs`
- Modify: `tests/browser-qa-harness.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Link form performs `signIn("credentials", { redirect: false })` first; link-confirm JSON accepts only exact `confirmed: true`.
- Link confirmation requires the binding cookie, `session.user.id === intent.targetUserId`, and `lastPasswordAuthenticatedAt` no older than five minutes.
- Google unlink JSON accepts `password`, optional `twoFactorCode`, and exact `confirmed: true`; it reuses shared proof because the user is already signed in and is proving a destructive method removal.
- Password ADD/CHANGE uses `mode`, `newPassword`, optional current password/2FA, and exact confirmation.
- Password disable accepts `confirmed: true` and consumes a recent REMOVE_PASSWORD Google intent.
- All route responses contain only safe `code`, `message`, and current method booleans.
- Produces `npm run browser-qa:db:target`, a read-only URL/fingerprint guard required before any disposable-browser-database migration or fixture write.

- [ ] **Step 1: Write failing route tests**

Inject the method services and email dispatcher. Test unauthenticated 401; missing/mismatched/stale password-authenticated session 403; malformed 400; proof-domain rejection 403/409; exact binding-cookie lookup; Secure/HttpOnly/SameSite cookie attributes; successful method response; delivery scheduled only after success; and no raw proof/provider fields in response or logs. Source-test that the link form completes Credentials sign-in before its confirmation POST and never sends password/2FA to the confirmation route.

- [ ] **Step 2: Write failing surface and browser tests**

Keep the existing account-surface `hasPasswordCredential` and `googleLinked` assertions unchanged; they are an input, not RED work. Add unit tests for `assert-browser-qa-database-target.mjs`: it requires `MASSAGELAB_BROWSER_QA_DATABASE=1`, both dedicated QA URL variables, non-Production environment, and either read-only fingerprint display or an exact approved fingerprint match; it never prints either URL. Browser tests always cover the public login/register pending and recovery states with intercepted OAuth/mail endpoints. Matching-link and account-security browser cases use an explicitly opted-in disposable local QA database only: `tests/browser/identity-method-safety-fixture.ts` requires the verified dedicated QA URL plus `MASSAGELAB_BROWSER_QA_DATABASE=1`, generates project-qualified `example.test` users, hashes a fixed non-production password, creates only the required method/PROVIDER_PROVEN intent rows, installs the signed session and HttpOnly binding cookie, and removes those exact rows in `afterEach`. It refuses a non-example identity and never runs against Production. Route/service tests remain authoritative for 2FA, concurrency, and provider proof. Cover:

- matching-account explanation and explicit “same MassageLab account” confirmation;
- a real fresh Credentials sign-in before link confirmation, with conditional 2FA retained in route/service coverage;
- add password after mocked completed Google reauth;
- unlink Google and disable password with last-method messaging;
- pending labels, duplicate-click prevention, thrown fetch recovery, expired intent, and retry; and
- desktop/mobile keyboard focus, status announcements, enlarged text, landscape, and reduced motion.

- [ ] **Step 3: Run route/surface tests and verify RED**

```bash
node --test tests/account-security-routes.test.mjs tests/account-surface-data.test.mjs tests/browser-qa-database-target.test.mjs
```

Expected: FAIL because the routes/panels and fresh-session link contract do not exist; existing account-surface method booleans remain green regression coverage.

- [ ] **Step 4: Implement fixed local linking page and routes**

The server page reads the binding cookie and resolves only whether a valid `PROVIDER_PROVEN` intent exists; it never places intent/provider identifiers in markup or URL. The form explains that the existing password account and proven Google email will become one account, asks for the account email/password and applicable 2FA, performs Auth.js Credentials sign-in without redirect, then submits only explicit confirmation. The route re-reads the resulting session, verifies its user and five-minute password-authenticated timestamp against the intent, and only then calls `confirmGoogleLink`.

Each route authenticates where required, reads the private binding cookie, calls one service, schedules security-email delivery after a successful transaction, clears the binding cookie after consumption, and returns generic recovery guidance for expired/mismatched proof. A matching-account confirmation never accepts password or 2FA fields directly.

- [ ] **Step 5: Split and implement sign-in-method UI**

Keep TOTP and backup codes in `security-panel.tsx`. Move credential method controls to `sign-in-methods-panel.tsx` with states:

```ts
type MethodActionState = "idle" | "proving" | "saving" | "redirecting" | "success" | "error"
```

Every action uses `try/catch/finally`, prevents a second submission, keeps labels visible, sets `aria-busy`, and renders a polite status or assertive error. Track 3 will later replace these local patterns with the shared primitive without changing the service contract.

- [ ] **Step 6: Implement the disposable-target guard and prepare only through its own mutation gate**

Create `scripts/assert-browser-qa-database-target.mjs` with pure URL parsing/fingerprint exports plus a CLI. It requires both dedicated QA URL variables and `MASSAGELAB_BROWSER_QA_DATABASE=1`, rejects `VERCEL_ENV=production`, hashes the two parsed host/port/database tuples, and supports only `--print-fingerprint` or `--expected-fingerprint=<64 lowercase hex>`. It never connects, mutates, or prints a URL. Add this exact package script:

```json
"browser-qa:db:target": "node scripts/assert-browser-qa-database-target.mjs"
```

Ordinary public browser rows skip this step. For the private matching-link rows, first put the disposable runtime and direct URLs only in `MASSAGELAB_BROWSER_QA_DATABASE_URL` and `MASSAGELAB_BROWSER_QA_DIRECT_URL` in a fresh PowerShell process. Run the read-only target command with `--print-fingerprint`; it outputs only a SHA-256 fingerprint of the parsed host/port/database tuple and refuses `VERCEL_ENV=production`. Present that fingerprint, the Neon/local branch/database identity, and the exact committed migration list to the user. Request authorization specifically to apply those migrations to that disposable target—never Production.

After that exact target is approved, set `MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT` to the approved fingerprint and run:

```powershell
$setupExit = 0
try {
  $env:MASSAGELAB_BROWSER_QA_DATABASE = "1"
  $env:DATABASE_URL = $env:MASSAGELAB_BROWSER_QA_DATABASE_URL
  $env:DIRECT_URL = $env:MASSAGELAB_BROWSER_QA_DIRECT_URL
  npm run browser-qa:db:target -- --expected-fingerprint=$env:MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT
  if ($LASTEXITCODE -ne 0) { $setupExit = $LASTEXITCODE }
  if ($setupExit -eq 0) {
    npm run prisma:migrate:deploy
    $setupExit = $LASTEXITCODE
  }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
  Remove-Item Env:MASSAGELAB_BROWSER_QA_DATABASE -ErrorAction SilentlyContinue
}
if ($setupExit -ne 0) { exit $setupExit }
```

Run this only in the fresh process so cleanup cannot erase pre-existing shell values. If approval or a pre-migrated disposable database is unavailable, leave the database-backed rows skipped with that exact reason; route/service coverage and public browser cases remain executable.

- [ ] **Step 7: Run focused browser and unit tests**

Before running, add `identity-method-safety.spec.ts` to `ORDINARY_BROWSER_QA_SPEC_FILES`, assign its desktop pair to lane 1 and mobile pair to lane 2, and update harness assertions to 12 ordinary specs and 24 exact project/spec pairs. Keep four nonempty lanes and exact-once coverage. Public cases always run; disposable-database cases skip with a clear reason unless the explicit local QA opt-in is present.

```bash
node --test tests/account-security-routes.test.mjs tests/account-security-email-intents.test.mjs tests/account-security-methods.test.mjs tests/account-surface-data.test.mjs tests/auth-registration.test.mjs tests/auth-account-linking.test.mjs tests/browser-qa-database-target.test.mjs tests/browser/ci-lanes.test.mjs tests/browser-qa-harness.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/identity-method-safety.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/identity-method-safety.spec.ts --project=mobile-chromium
npm run typecheck
npm run lint
git diff --check
```

Expected: PASS with no real provider or mail call; without QA opt-in, only the database-backed cases skip.

If Task 6's exact disposable target and migrations were approved, run the private rows in a second fresh PowerShell process so the application server and fixture share the same guarded runtime URL:

```powershell
$browserExit = 0
try {
  $env:MASSAGELAB_BROWSER_QA_DATABASE = "1"
  $env:DATABASE_URL = $env:MASSAGELAB_BROWSER_QA_DATABASE_URL
  $env:DIRECT_URL = $env:MASSAGELAB_BROWSER_QA_DIRECT_URL
  npm run browser-qa:db:target -- --expected-fingerprint=$env:MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT
  if ($LASTEXITCODE -ne 0) { $browserExit = $LASTEXITCODE }
  if ($browserExit -eq 0) {
    npm run build:browser-qa
    $browserExit = $LASTEXITCODE
  }
  if ($browserExit -eq 0) {
    npm run test:browser -- tests/browser/identity-method-safety.spec.ts --project=desktop-chromium
    $browserExit = $LASTEXITCODE
  }
  if ($browserExit -eq 0) {
    npm run test:browser -- tests/browser/identity-method-safety.spec.ts --project=mobile-chromium
    $browserExit = $LASTEXITCODE
  }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
  Remove-Item Env:MASSAGELAB_BROWSER_QA_DATABASE -ErrorAction SilentlyContinue
}
if ($browserExit -ne 0) { exit $browserExit }
```

The fingerprint guard runs again immediately before the build; if it fails, neither app nor fixture starts. Run only in the fresh process so cleanup cannot erase pre-existing shell values, then verify the fixture removed its exact rows.

- [ ] **Step 8: Commit routes and UI**

```bash
git add package.json app/account/link-google/page.tsx app/account/link-google/link-google-form.tsx app/api/account/security/google/link/confirm/route.ts app/api/account/security/password/disable/route.ts app/account/security/sign-in-methods-panel.tsx app/api/account/security/google/unlink/route.ts app/api/account/security/password/route.ts app/account/security/security-panel.tsx lib/auth/browser-fixture-identity.ts lib/auth/browser-fixture-records.ts scripts/assert-browser-qa-database-target.mjs tests/browser-qa-database-target.test.mjs tests/browser/identity-method-safety-fixture.ts tests/account-security-routes.test.mjs tests/browser/identity-method-safety.spec.ts tests/browser/ci-lanes.mjs tests/browser/ci-lanes.test.mjs tests/browser-qa-harness.test.mjs
git commit -m "feat: add secure sign-in method management"
```

---

### Task 7: Document and verify the identity workstream

**Files:**
- Modify: `docs/wiki/deployment.md`
- Modify: `docs/wiki/release-checklist.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**
- Documents the normalized-email preflight, additive migration, OAuth callback/origin proof, SMTP delivery proof, limiter policy, and recovery runbook boundary.
- Makes no deployment, provider, or live-user claim without exact evidence.

- [ ] **Step 1: Document identity configuration and gates**

Add the Google intent-cookie/linking contract, exact limiter thresholds/15-minute window, bounded 24-hour stale cleanup, count-only collision command, required migration order, Google publishing/callback checks, SMTP sender/SPF/DKIM/DMARC/bounce checks, and safe security-email failure review to deployment/release docs.

State that provider-setting changes, migration application, real Google account testing, and production mail tests remain separate execution gates. Do not print configuration values.

- [ ] **Step 2: Run the full local identity gate**

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
npm run build:browser-qa
npm run test:browser -- tests/browser/identity-method-safety.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/identity-method-safety.spec.ts --project=mobile-chromium
```

Expected: every command passes. For the full matching-link UI rows, first complete Task 6's approved fingerprint/migration setup, then use Task 6 Step 7's exact fingerprint-checked runtime wrapper; verify fixture cleanup afterward. Ordinary CI still runs the public cases without a database. If Windows sandbox launch fails before execution with error 1312, rerun the same command through the approved outside-sandbox path and do not report it as an app failure.

- [ ] **Step 3: Perform the final security review**

Search and inspect:

```bash
rg -n "allowDangerousEmailAccountLinking|ml-auth-method-binding|AuthMethodIntent|AccountSecurityEmailIntent|AuthAttempt|providerAccountId|access_token|refresh_token|id_token" auth.ts app lib prisma tests docs
```

Confirm dangerous linking is absent; private proofs are absent from URLs/local storage/logs; raw limiter identifiers are absent from persistence; Account provider IDs are unique; method removal cannot leave zero credentials; and no billing/entitlement behavior changed.

- [ ] **Step 4: Update canonical documents with exact evidence**

In project state/log, record the exact identity head, migration name, focused/full gate results, and that provider/deployment verification remains pending. Do not claim live Google or mail delivery until it is actually completed in the release plan.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/wiki/deployment.md docs/wiki/release-checklist.md docs/project-state.md docs/project-log.md
git commit -m "docs: record identity safety gates"
```

- [ ] **Step 6: Record the clean handoff**

```bash
git status --short --branch
git log --oneline --decorate -7
```

Expected: clean identity branch and seven independently reviewable task commits. Hand off the exact head, migration status as local-only, validation results, and all still-pending external checks to the subscription workstream.
