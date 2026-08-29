# Two-Factor Management Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make authenticator enrollment, enablement, backup-code rotation, and disablement safe enough for family-and-friends release by requiring fresh primary proof, current-factor proof where destructive, same-browser enrollment binding, exact concurrency control, and committed session revocation.

**Architecture:** Keep the existing User, TwoFactorSecret, BackupCode, AuthMethodIntent, AuthRateLimitBucket, and Session schema. Extract the current-factor and consumed-Google-reauth proof owners, add a signed short-lived enrollment cookie, and route every 2FA state change through one transaction-safe service; thin App Router handlers enforce browser request provenance and return only allowlisted no-store outcomes. Split the 2FA client workflow out of SecurityPanel so proof choices, confirmations, recovery, backup-code acknowledgment, and forced re-sign-in have one UI owner.

**Tech Stack:** Next.js 16 App Router, React 19, Auth.js 5 beta, Prisma 7/PostgreSQL, Argon2, otplib TOTP, AES-GCM secret encryption, signed HttpOnly cookies, Node.js 24 tests, and Playwright 1.60.

**Spec:** docs/superpowers/plans/2026-08-28-family-friends-readiness-program.md, refined by the confirmed 2026-08-29 two-factor-management diagnostic and the proof matrix below.

## Global Constraints

- TDD Route is strict. For every behavior task: write one focused RED test, run it and record the expected behavior failure, implement only that slice, run GREEN plus its named regression set, then commit only that task's owned files.
- No Prisma schema edit, migration, backfill, enum expansion, or database deployment. In particular, do not add an AuthMethodIntentPurpose value; use the existing currently reserved LINK_GOOGLE purpose as the Google primary-proof carrier for 2FA management.
- Do not add or migrate AccountSecurityEmailKind. This workstream sends no security email and does not change the existing delivery worker.
- Do not contact a live or shared database, Google/OAuth, SMTP/email, Stripe/payment, or any other provider. Do not change provider settings, environment values, deployments, aliases, remote branches, or Production.
- Keep OAuth tokens, raw passwords, submitted TOTP/backup codes, decrypted/encrypted TOTP material, binding values, database identifiers, raw email/network limiter identifiers, and provider details out of URLs, local/session storage, routine logs, UI error text, and evidence.
- Existing enabled TwoFactorSecret rows are immutable through setup. Setup against enabled state returns 409 and performs zero writes.
- A pre-fix pending TwoFactorSecret row with enabledAt null has no valid new enrollment binding and therefore cannot be enabled. A fresh proved setup may replace that pending row.
- Setup requires exact confirmed: true and a fresh primary proof. Password-only accounts use password proof. Accounts with both password and linked Google may choose password or linked-Google reauthentication. Google-only accounts must add a password before initial setup, so the setup control is hidden and the route/service reject it.
- Enable requires the same-browser, signed, unexpired enrollment binding plus a code from the newly issued secret. It never accepts only userId plus code.
- Disable and backup-code regeneration require exact confirmed: true, a fresh primary proof, and a current TOTP or unused backup code. Password proof and factor proof are distinct requirements even when one request supplies both fields.
- Existing enabled legacy accounts remain manageable: password-only uses password plus current factor; linked-method uses password or Google plus current factor; Google-only enabled legacy state uses Google plus current factor; enabled state with no usable primary method refuses self-service and keeps the existing full-admin reset as the recovery owner.
- Every committed enable, disable, or backup-code regeneration increments User.authSessionVersion exactly once and deletes all compatibility Session rows in the same transaction. Setup alone does neither.
- Account-method changes, the Credentials login contract, the existing full-admin 2FA reset, and lost-factor recovery stay behaviorally intact.
- All new route responses are private, no-store, and allowlisted. Client code maps status plus code and never renders an arbitrary server message.
- Every new or materially changed shared helper, service, route factory, proof contract, and non-obvious concurrency rule gets focused JSDoc describing intent and constraints.
- No change may touch concurrent browser-diagnostic artifacts, debug.log, package.json changes owned by another worker, or unrelated worktree files.

## First-Principles and TDD Readback

**First Principle:** A signed-in cookie by itself must never be enough to enroll, replace, disable, or regenerate a second factor.

**Non-negotiables:** Preserve existing enabled state, require independent proof appropriate to the transition, keep secrets private, make one transaction own each committed state change plus revocation, and retain full-admin recovery for a lost factor.

**Assumptions to Drop:** The current assumptions that “session means account owner,” “a pending secret proves its browser,” and “one click is sufficient confirmation” are not security boundaries.

**Smallest Sufficient Path:** Reuse the existing tables, TWO_FACTOR limiter buckets, password proof, LINK_GOOGLE intent, authSessionVersion, and adapter Session rows; add only focused proof, binding, service, request, route, and UI owners.

**Escalation Signal:** Stop for a new design review if implementation appears to require a new intent enum value, new database column, durable email event, provider-token storage, or a second session-revocation owner.

**Architecture Integrity Lens:**

- Canonical current-factor owner: lib/auth-two-factor-proof.ts.
- Canonical consumed Google reauthentication owner: lib/auth-method-intent-proof.ts.
- Canonical enrollment-cookie owner: lib/two-factor-enrollment-binding.ts.
- Canonical mutation owner: lib/account-two-factor-management.ts.
- Canonical browser request boundary: lib/account-security-request.ts.
- Canonical UI owner: app/account/security/two-factor-management-panel.tsx.
- Existing account-security-methods.ts becomes a consumer of the extracted Google proof; it must not keep a private duplicate.
- Existing authSessionVersion remains the JWT invalidation authority. The new service performs the required compatibility Session deletion in the same transaction.

**TDD Route:**

- Mode: off.
- Decision: strict.
- Strict authority: explicit task requirement.
- Test posture: strict RED test before every production behavior slice.
- RED/GREEN proves: the named proof, request, state-transition, rollback, concurrency, or UI contract for that slice.
- Still required: affected regressions, full local validation, hosted Linux, complete Browser QA, independent security review, and separately authorized private browser evidence.

## State and Proof Matrix

| Persisted state | Methods | Setup | Enable | Regenerate / disable |
| --- | --- | --- | --- | --- |
| Disabled, no pending row | Password only | Password + confirmation | New enrollment binding + new TOTP | Not applicable |
| Disabled, no pending row | Password + Google | Password or fresh LINK_GOOGLE proof + confirmation | New enrollment binding + new TOTP | Not applicable |
| Disabled, no pending row | Google only | Hidden and PASSWORD_REQUIRED; add password first | Rejected | Not applicable |
| Disabled, legacy pending row | Password or linked methods | Fresh proved setup replaces pending row | Old row without new binding is unusable | Not applicable |
| Enabled | Password only | 409, no writes | 409, no writes | Password + current TOTP/unused backup + confirmation |
| Enabled | Password + Google | 409, no writes | 409, no writes | Password or fresh LINK_GOOGLE proof, plus current TOTP/unused backup and confirmation |
| Enabled legacy state | Google only | 409, no writes | 409, no writes | Fresh LINK_GOOGLE proof + current TOTP/unused backup + confirmation |
| Enabled inconsistent state | No password or linked Google | 409, no writes | 409, no writes | Self-service rejected; full-admin reset remains available |
| No enabled secret, orphan backup codes | Any | Setup follows method rules | Fresh setup replaces codes only when enable commits | Regenerate/disable rejected as NOT_ENABLED |

## Public Contracts

### Request bodies

Only these exact JSON object shapes are accepted; unknown keys, arrays, null, non-JSON content types, oversized bodies, and mismatched proof fields fail before proof or mutation:

~~~~ts
type SetupBody =
  | { proofMethod: "PASSWORD"; password: string; confirmed: true }
  | { proofMethod: "GOOGLE"; confirmed: true }

type EnableBody = {
  code: string
  confirmed: true
}

type ManageBody =
  | {
      proofMethod: "PASSWORD"
      password: string
      twoFactorCode: string
      confirmed: true
    }
  | {
      proofMethod: "GOOGLE"
      twoFactorCode: string
      confirmed: true
    }
~~~~

### Allowlisted response codes

Success codes are TWO_FACTOR_SETUP_READY, TWO_FACTOR_ENABLED, TWO_FACTOR_DISABLED, and BACKUP_CODES_REGENERATED. Failure codes are AUTHENTICATION_REQUIRED, INVALID_REQUEST, UNTRUSTED_REQUEST, RATE_LIMITED, PASSWORD_REQUIRED, PRIMARY_PROOF_INVALID, GOOGLE_PROOF_EXPIRED, TWO_FACTOR_REQUIRED, TWO_FACTOR_INVALID, ALREADY_ENABLED, NOT_ENABLED, ENROLLMENT_EXPIRED, and CONFLICT.

Every response sets Cache-Control: private, no-store and Pragma: no-cache. A 429 also sets exact Retry-After. Responses never include submitted proof, database/provider identifiers, or private exception text.

### Cookies

- Existing ml-auth-method-binding carries LINK_GOOGLE reauthentication and keeps its current signed/HMAC-bound database-intent contract. A committed consumer nulls providerProvenAt by CAS, and its route clears the cookie.
- New ml-two-factor-enrollment is a signed payload containing version, userId, authSessionVersion, TwoFactorSecret id, exact updated-at timestamp, a domain-separated secret-row fingerprint, issued-at, and expires-at. It contains no TOTP secret.
- Enrollment lifetime is five minutes. The cookie is HttpOnly, SameSite=Strict, Secure in Production, path /api/account/security/totp, and Max-Age=300.
- Invalid-code and rate-limited enable responses retain a still-valid binding for retry. Success, expiry, wrong-user, wrong-row, already-enabled, and conflict responses clear it.

## File Responsibility Map

| File | Responsibility |
| --- | --- |
| lib/auth-two-factor-proof.ts | Canonical current TOTP/unused-backup matching and prepared proof for transaction-time consumption. |
| lib/auth-method-proof.ts | Credentials/password proof; delegates factor matching and defaults to immediate backup consumption for login. |
| lib/auth-rate-limit.ts | Exact purpose-scoped account failure clearing used by factor-only proof. |
| lib/auth-method-intent-proof.ts | Fresh consumed Google security-reauth predicate and one-use CAS for LINK_GOOGLE, ADD_PASSWORD, and REMOVE_PASSWORD. |
| lib/account-security-methods.ts | Existing password/provider mutations consuming the extracted Google reauth owner. |
| lib/account-security-request.ts | Browser-only same-origin JSON provenance, bounded parsing, and exact-key validation. |
| lib/two-factor-enrollment-binding.ts | Signed five-minute enrollment binding serialization, verification, and row fingerprinting. |
| lib/account-two-factor-management.ts | Setup, enable, disable, regenerate, CAS, rollback, and session-revocation state machine. |
| app/api/auth/google/intent/route.ts | Starts LINK_GOOGLE only through the trusted security-request boundary. |
| auth.ts | Sends completed LINK_GOOGLE proof to the exact two-factor return state without changing other Google purposes. |
| app/api/account/security/totp/setup/route.ts | Thin proved setup route and enrollment-cookie writer. |
| app/api/account/security/totp/enable/route.ts | Thin bound enable route and enrollment-cookie lifecycle owner. |
| app/api/account/security/totp/disable/route.ts | Thin destructive disable route. |
| app/api/account/security/backup-codes/route.ts | Thin destructive backup-code rotation route. |
| lib/two-factor-management-recovery.ts | Client allowlist from status/code to safe guidance. |
| app/account/security/two-factor-management-panel.tsx | Proof selection, confirmations, enrollment, code display/acknowledgment, recovery, and re-sign-in UI. |
| app/account/security/security-panel.tsx | Composition only: sign-in methods plus the new 2FA panel. |
| app/account/page.tsx | Parses exact reauth=two-factor display state and passes it to SecurityPanel; URL state never authorizes. |

---

### Task 1: Extract Canonical Current-Factor Proof

**Files:**

- Create: lib/auth-two-factor-proof.ts
- Create: tests/auth-two-factor-proof.test.mjs
- Modify: lib/auth-method-proof.ts:18-168
- Modify: lib/auth-rate-limit.ts:93-107
- Modify: tests/auth-method-proof.test.mjs
- Modify: tests/auth-rate-limit.test.mjs

**Interfaces:**

- Produces: PreparedTwoFactorProof, proveLoadedTwoFactorCode(), prepareCurrentTwoFactorProof(), and consumePreparedTwoFactorProof().
- Produces: clearCredentialAccountFailure() with exact purpose, Prisma client, email, and secret inputs.
- Preserves: verifyPasswordMethodProof() input and default login behavior; immediate backup-code consumption remains the default.
- Consumers: Task 4 and Task 5 transaction services.

- [ ] **Step 1: Write RED proof and concurrency tests**

Add tests that model an enabled secret, one TOTP, two unused backup codes, and TWO_FACTOR account/network buckets. Assert:

~~~~js
const proof = await prepareCurrentTwoFactorProof({
  prismaClient: database.client,
  userId: "user-1",
  twoFactorCode: "BACKUP-ONE",
  networkIdentifier: "203.0.113.10",
  now: NOW,
})

assert.equal(proof.status, "VERIFIED")
assert.equal(proof.proof.kind, "BACKUP_CODE")
assert.equal(database.backup("backup-1").usedAt, null)

await database.transaction((tx) =>
  consumePreparedTwoFactorProof(tx, proof.proof, NOW),
)
assert.deepEqual(database.backup("backup-1").usedAt, NOW)
~~~~

Also assert: missing code is TWO_FACTOR_REQUIRED; malformed/expired TOTP and wrong backup are TWO_FACTOR_INVALID; a blocked TWO_FACTOR bucket returns RATE_LIMITED before decrypt/Argon2; valid TOTP returns a prepared TOTP proof; two transactions racing one prepared backup code yield exactly one consumer; a rolled-back transaction leaves usedAt null; only the TWO_FACTOR account bucket clears on factor-only success; shared network pressure remains; and Credentials login still consumes a valid backup immediately.

- [ ] **Step 2: Run RED**

Run:

~~~~powershell
node --test tests/auth-two-factor-proof.test.mjs tests/auth-method-proof.test.mjs tests/auth-rate-limit.test.mjs
~~~~

Expected: FAIL because lib/auth-two-factor-proof.ts and clearCredentialAccountFailure do not exist; existing Credentials tests remain green outside the new assertions.

- [ ] **Step 3: Implement the minimal proof owner**

Use these exact contracts:

~~~~ts
export type PreparedTwoFactorProof = {
  userId: string
  authSessionVersion: number
  twoFactorSecretId: string
  enabledAtMs: number
  updatedAtMs: number
  kind: "TOTP" | "BACKUP_CODE"
  backupCodeId: string | null
}

export type CurrentTwoFactorProofResult =
  | { status: "VERIFIED"; proof: PreparedTwoFactorProof }
  | { status: "NOT_ENABLED" | "TWO_FACTOR_REQUIRED" | "TWO_FACTOR_INVALID" | "RATE_LIMITED" }

export async function prepareCurrentTwoFactorProof(input: {
  prismaClient?: ProofPrismaClient
  userId: string
  twoFactorCode: string
  networkIdentifier: string
  secret?: string
  now?: Date
}): Promise<CurrentTwoFactorProofResult>

export async function consumePreparedTwoFactorProof(
  tx: ProofTransactionClient,
  proof: PreparedTwoFactorProof,
  now: Date,
): Promise<boolean>
~~~~

The prepared proof contains no submitted code or secret. proveLoadedTwoFactorCode owns decrypt/TOTP and backup-hash matching. prepareCurrentTwoFactorProof checks only TWO_FACTOR buckets, records only TWO_FACTOR failures, and does not consume a backup. consumePreparedTwoFactorProof re-reads the exact enabled secret id/user/enabledAt/updatedAt snapshot and, for backup proof, updateMany where id, userId, and usedAt:null; it returns true only for one exact valid proof.

Refactor verifyPasswordMethodProof to use the same matcher. Preserve its default immediate backup updateMany behavior and every existing result code. Add an internal deferred option only to the typed service boundary:

~~~~ts
backupCodeConsumption?: "IMMEDIATE" | "DEFERRED"
~~~~

When DEFERRED succeeds, VERIFIED includes preparedTwoFactorProof; callers outside the new management service continue using the default and cannot accidentally bypass 2FA.

- [ ] **Step 4: Run GREEN and regressions**

Run:

~~~~powershell
node --test tests/auth-two-factor-proof.test.mjs tests/auth-method-proof.test.mjs tests/auth-rate-limit.test.mjs tests/account-security-methods.test.mjs
~~~~

Expected: PASS; login, account-method password proof, rate-limit isolation, and one-use backup behavior remain green.

- [ ] **Step 5: Commit**

~~~~powershell
git add lib/auth-two-factor-proof.ts lib/auth-method-proof.ts lib/auth-rate-limit.ts tests/auth-two-factor-proof.test.mjs tests/auth-method-proof.test.mjs tests/auth-rate-limit.test.mjs
git commit -m "refactor: centralize two-factor proof"
~~~~

**Independent review gate:** Verify no route can call a “password-only login” helper, no proof object carries secret/code material, and the default Credentials path still consumes backup codes immediately.

### Task 2: Reuse LINK_GOOGLE as Fresh Primary Proof

**Files:**

- Create: lib/auth-method-intent-proof.ts
- Create: tests/auth-method-intent-proof.test.mjs
- Modify: lib/account-security-methods.ts:97-238, 272-318
- Modify: tests/account-security-methods.test.mjs
- Modify: auth.ts:120-140
- Modify: tests/auth-google-callback-flow.test.mjs
- Test: tests/auth-method-intents.test.mjs

**Interfaces:**

- Produces: SecurityGoogleReauthPurpose, isFreshConsumedGoogleReauth(), and consumeFreshGoogleReauth().
- Consumes: existing AuthMethodIntent rows and the existing providerProvenAt one-use convention.
- Preserves: ADD_PASSWORD and REMOVE_PASSWORD behavior in account-security-methods.ts.
- Adds: exact LINK_GOOGLE return /account?tab=security&reauth=two-factor.
- Consumer: Task 4 and Task 5 services.

- [ ] **Step 1: Write RED extraction and return tests**

Assert a LINK_GOOGLE row is accepted only when target user, provider, linked provider account, status CONSUMED, non-null providerProvenAt, five-minute freshness, and expiresAt all match. Assert the CAS nulls providerProvenAt exactly once, a rollback restores it, and ADD_PASSWORD/REMOVE_PASSWORD existing tests still pass.

In tests/auth-google-callback-flow.test.mjs, change the LINK_GOOGLE expectation only:

~~~~js
assert.equal(
  await callbacks.signIn(googleCallbackInput),
  "/account?tab=security&reauth=two-factor",
)
~~~~

Keep ADD_PASSWORD and REMOVE_PASSWORD returning /account?tab=security&reauth=complete.

- [ ] **Step 2: Run RED**

Run:

~~~~powershell
node --test tests/auth-method-intent-proof.test.mjs tests/account-security-methods.test.mjs tests/auth-method-intents.test.mjs tests/auth-google-callback-flow.test.mjs
~~~~

Expected: FAIL because the extracted proof module and purpose-specific return do not exist.

- [ ] **Step 3: Implement the extracted consumer**

Use:

~~~~ts
export type SecurityGoogleReauthPurpose =
  | "LINK_GOOGLE"
  | "ADD_PASSWORD"
  | "REMOVE_PASSWORD"

export function isFreshConsumedGoogleReauth(
  intent: unknown,
  purpose: SecurityGoogleReauthPurpose,
  userId: string,
  now: Date,
): boolean

export async function consumeFreshGoogleReauth(
  tx: GoogleProofTransactionClient,
  intent: FreshGoogleReauthIntent,
  now: Date,
): Promise<boolean>
~~~~

Move the existing five-minute predicate and providerProvenAt:null CAS from account-security-methods.ts into this file. account-security-methods.ts imports it for ADD_PASSWORD and REMOVE_PASSWORD and keeps its linked-account ownership recheck.

In auth.ts, branch only the successful LINK_GOOGLE decision:

~~~~ts
if (result.kind === "REAUTH_COMPLETE") {
  return result.purpose === "LINK_GOOGLE"
    ? "/account?tab=security&reauth=two-factor"
    : "/account?tab=security&reauth=complete"
}
~~~~

Do not add a purpose to Prisma or TypeScript unions; LINK_GOOGLE already exists.

- [ ] **Step 4: Run GREEN and regressions**

Run:

~~~~powershell
node --test tests/auth-method-intent-proof.test.mjs tests/account-security-methods.test.mjs tests/auth-method-intents.test.mjs tests/auth-google-callback-flow.test.mjs tests/account-security-routes.test.mjs
~~~~

Expected: PASS; account linking, password add/remove, and their recovery paths are unchanged.

- [ ] **Step 5: Commit**

~~~~powershell
git add lib/auth-method-intent-proof.ts lib/account-security-methods.ts auth.ts tests/auth-method-intent-proof.test.mjs tests/account-security-methods.test.mjs tests/auth-google-callback-flow.test.mjs
git commit -m "refactor: share google security reauthentication"
~~~~

**Independent review gate:** Confirm LINK_GOOGLE is not used to link a provider here, providerProvenAt is one-use, account ownership is re-read, and no enum/schema diff exists.

### Task 3: Add Trusted JSON and Enrollment-Binding Boundaries

**Files:**

- Create: lib/account-security-request.ts
- Create: tests/account-security-request.test.mjs
- Create: lib/two-factor-enrollment-binding.ts
- Create: tests/two-factor-enrollment-binding.test.mjs

**Interfaces:**

- Produces: parseTrustedAccountSecurityJson() and noStoreJsonHeaders().
- Produces: TWO_FACTOR_ENROLLMENT_COOKIE, signTwoFactorEnrollmentBinding(), and verifyTwoFactorEnrollmentBinding().
- Consumes: configured site URL and AUTH_SECRET supplied by callers.
- Consumers: Task 4 services and Task 6 routes.

- [ ] **Step 1: Write RED request and cookie tests**

For request parsing, assert acceptance requires all of: request URL origin equals configured URL origin, Origin equals that origin exactly, Sec-Fetch-Site equals same-origin exactly, media type equals application/json after case/parameter normalization, UTF-8 body is at most 4096 bytes, JSON is a non-array object, keys exactly match an allowed shape, and no duplicate semantic field is admitted through an unknown key.

Reject missing/contradictory Origin, same-site/cross-site/none/missing fetch metadata, apex/www mismatch, malformed URL, form/text media types, arrays/null, invalid JSON, oversized body, and unknown keys before the handler calls session/proof/database dependencies.

For enrollment binding, assert signature tampering, wrong user, wrong row, secret-row fingerprint mismatch, future issue time, expiry, malformed encoding, oversized payload, and wrong secret all reject. Assert the verified value contains no TOTP secret.

- [ ] **Step 2: Run RED**

Run:

~~~~powershell
node --test tests/account-security-request.test.mjs tests/two-factor-enrollment-binding.test.mjs
~~~~

Expected: FAIL because both modules are absent.

- [ ] **Step 3: Implement exact bounded contracts**

Use:

~~~~ts
export async function parseTrustedAccountSecurityJson<T extends Record<string, unknown>>(input: {
  request: Request
  expectedSiteUrl: string
  allowedKeys: readonly string[]
  maxBytes?: number
}): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST" }
>

export const TWO_FACTOR_ENROLLMENT_COOKIE = "ml-two-factor-enrollment"

export type TwoFactorEnrollmentBinding = {
  version: 1
  userId: string
  authSessionVersion: number
  twoFactorSecretId: string
  secretRowFingerprint: string
  updatedAtMs: number
  issuedAtMs: number
  expiresAtMs: number
}
~~~~

Sign base64url canonical JSON with HMAC-SHA-256 using domain two-factor-enrollment-binding and AUTH_SECRET. Fingerprint the exact encryptedSecret plus row id/user/updatedAt with a separate domain. Use timingSafeEqual, strict integer/range checks, five-minute maximum age, and a bounded encoded length. Do not decode a TOTP secret.

- [ ] **Step 4: Run GREEN**

Run:

~~~~powershell
node --test tests/account-security-request.test.mjs tests/two-factor-enrollment-binding.test.mjs tests/donation-checkout-route.test.mjs
~~~~

Expected: PASS; the new browser-only policy does not alter the existing checkout-origin helper.

- [ ] **Step 5: Commit**

~~~~powershell
git add lib/account-security-request.ts lib/two-factor-enrollment-binding.ts tests/account-security-request.test.mjs tests/two-factor-enrollment-binding.test.mjs
git commit -m "feat: bind two-factor enrollment to one browser"
~~~~

**Independent review gate:** Confirm no request header contributes a trusted origin, no metadata-free exception exists, the cookie is signed rather than merely encoded, and no secret is serialized.

### Task 4: Implement Proved Setup and Bound Enable

**Files:**

- Create: lib/account-two-factor-management.ts
- Create: tests/account-two-factor-management.test.mjs
- Test: tests/admin-security-service.test.mjs

**Interfaces:**

- Consumes: verifyPasswordMethodProof(), consumeFreshGoogleReauth(), enrollment binding helpers, TOTP helpers, runCommerceTransaction(), and Prisma transaction delegates.
- Produces: startTwoFactorEnrollment() and enableTwoFactor().
- Preserves: existing full-admin reset and every enabled row until a separately proved disable.
- Consumer: Task 6 routes.

- [ ] **Step 1: Write RED setup/enable state-machine tests**

Cover every disabled matrix row:

- password-only setup succeeds only after correct password and confirmed:true;
- linked-method setup accepts password or a fresh consumed LINK_GOOGLE proof;
- Google-only setup returns PASSWORD_REQUIRED for either proof method and performs no write;
- enabled setup returns ALREADY_ENABLED/409 semantics before password hashing, Google consumption, secret generation, or write;
- legacy pending setup cannot be enabled without a new binding and is replaced only by fresh proved setup;
- orphan backup codes do not authorize enable;
- setup generates the secret, encryption, and QR data before the transaction so QR/encryption failure leaves no pending row;
- concurrent setups never overwrite enabled state, and only the binding whose fingerprint matches the committed pending row can enable;
- enable rejects missing/tampered/expired/wrong-user/wrong-version/wrong-row binding and wrong new code;
- invalid new code records TWO_FACTOR pressure; 429 returns the exact retry delay;
- enable generates and hashes eight backup codes before the transaction;
- enable CAS changes enabledAt from null exactly once, replaces orphan/old backup rows, increments authSessionVersion once, and deletes Session rows in the same transaction.

Add exact rollback injection after each mutation point:

~~~~js
for (const failurePoint of [
  "after-secret-cas",
  "after-backup-delete",
  "after-backup-create",
  "after-session-version",
  "after-adapter-session-delete",
]) {
  const before = database.snapshot()
  const result = await enableWithInjectedFailure(failurePoint)
  assert.equal(result.status, "CONFLICT")
  assert.deepEqual(database.snapshot(), before)
}
~~~~

Also assert two concurrent enables yield one ENABLED and one CONFLICT/ALREADY_ENABLED, one version increment, one final eight-code set, and one committed Session deletion.

- [ ] **Step 2: Run RED**

Run:

~~~~powershell
node --test tests/account-two-factor-management.test.mjs
~~~~

Expected: FAIL because the service does not exist and current setup/enable behavior lacks proof, binding, CAS, and revocation.

- [ ] **Step 3: Implement setup and enable**

Use these result contracts:

~~~~ts
export type TwoFactorManagementFailureCode =
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "PASSWORD_REQUIRED"
  | "PRIMARY_PROOF_INVALID"
  | "GOOGLE_PROOF_EXPIRED"
  | "TWO_FACTOR_REQUIRED"
  | "TWO_FACTOR_INVALID"
  | "ALREADY_ENABLED"
  | "NOT_ENABLED"
  | "ENROLLMENT_EXPIRED"
  | "CONFLICT"

export type StartEnrollmentResult =
  | {
      status: "SETUP_READY"
      qrCode: string
      manualCode: string
      enrollmentBinding: string
    }
  | { status: "REJECTED"; code: TwoFactorManagementFailureCode; retryAfterSeconds?: number }

export type EnableTwoFactorResult =
  | { status: "ENABLED"; backupCodes: string[] }
  | { status: "REJECTED"; code: TwoFactorManagementFailureCode; retryAfterSeconds?: number }
~~~~

startTwoFactorEnrollment first reads only the signed-in user's method/state projection. It rejects enabled and Google-only states before expensive proof. Password calls verifyPasswordMethodProof against the disabled user and captures authSessionVersion. Google requires a still-linked account and consumes an exact fresh LINK_GOOGLE intent inside the same transaction that writes the pending row. Generate secret, encrypted payload, QR, and binding inputs before mutation. The transaction re-reads methods/version/state; it may create or CAS-replace only enabledAt:null. Sign the cookie from the exact committed row snapshot.

enableTwoFactor verifies the binding and new code before its short serializable transaction. Hash all backup codes first. In the transaction re-read the exact pending row and User version, updateMany the row where enabledAt:null and its id/updatedAt/fingerprint still match, replace backup rows, updateMany User where id plus expected authSessionVersion with increment:1, and delete Session rows. Any count mismatch throws a private conflict so runCommerceTransaction rolls back all writes.

Do not queue an email. Clear account-surface cache only after the committed service result at the route layer.

- [ ] **Step 4: Run GREEN and recovery regressions**

Run:

~~~~powershell
node --test tests/account-two-factor-management.test.mjs tests/auth-security.test.mjs tests/auth-method-proof.test.mjs tests/auth-method-intent-proof.test.mjs tests/admin-security-service.test.mjs
~~~~

Expected: PASS; the admin lost-factor reset remains available and unchanged.

- [ ] **Step 5: Commit**

~~~~powershell
git add lib/account-two-factor-management.ts tests/account-two-factor-management.test.mjs
git commit -m "feat: harden two-factor enrollment"
~~~~

**Independent review gate:** Review exact setup immutability, pre-fix pending rejection, QR/encryption pre-transaction ordering, binding-to-row checks, CAS counts, rollback snapshots, and one version increment.

### Task 5: Implement Dual-Proof Disable and Backup Rotation

**Files:**

- Modify: lib/account-two-factor-management.ts
- Modify: tests/account-two-factor-management.test.mjs
- Test: tests/account-security-methods.test.mjs
- Test: tests/admin-security-service.test.mjs

**Interfaces:**

- Produces: disableTwoFactor() and regenerateBackupCodes().
- Consumes: password proof with DEFERRED backup consumption or fresh LINK_GOOGLE proof, plus PreparedTwoFactorProof.
- Preserves: setup/enable contracts from Task 4 and full-admin recovery.
- Consumer: Task 6 routes.

- [ ] **Step 1: Write RED destructive-transition tests**

For both disable and regenerate, cover password-only, linked-method password, linked-method Google, Google-only enabled legacy, and no-primary-method inconsistent state. Assert:

- confirmed must be exactly true;
- password proof alone is insufficient;
- Google proof alone is insufficient;
- current factor alone is insufficient;
- password plus current TOTP succeeds;
- password plus unused backup succeeds and consumes it only inside the mutation transaction;
- linked Google plus current factor succeeds;
- Google-only enabled legacy uses Google plus factor;
- absent enabled secret returns NOT_ENABLED without deleting orphan backup codes;
- no usable password/Google primary returns PRIMARY_PROOF_INVALID and leaves state for full-admin recovery;
- stale authSessionVersion, replaced secret, used backup, consumed Google proof, or method change returns CONFLICT/GOOGLE_PROOF_EXPIRED with no mutation;
- disable deletes the exact secret and all backup codes, increments version once, and deletes Session rows;
- regeneration leaves the exact enabled secret untouched, replaces the entire backup set with eight new hashes, increments version once, and deletes Session rows;
- returned backup codes exist only in the success result and are never persisted plaintext.

Add rollback injection at current-factor consume, Google proof consume, secret/backup mutation, version increment, and Session deletion. Every injected failure must restore secret, codes, providerProvenAt, authSessionVersion, and Session rows. Add two concurrent password/TOTP regenerations and disables; exactly one commits because User version and secret snapshot CAS are the final barrier.

- [ ] **Step 2: Run RED**

Run:

~~~~powershell
node --test tests/account-two-factor-management.test.mjs
~~~~

Expected: FAIL because disableTwoFactor and regenerateBackupCodes do not yet implement dual proof or atomic revocation.

- [ ] **Step 3: Implement minimal destructive services**

Use:

~~~~ts
type PrimaryProof =
  | { kind: "PASSWORD"; password: string }
  | { kind: "GOOGLE"; intentId: string }

export async function disableTwoFactor(input: {
  prismaClient?: TwoFactorManagementClient
  userId: string
  primaryProof: PrimaryProof
  twoFactorCode: string
  networkIdentifier: string
  confirmed: boolean
  now?: Date
}): Promise<ManageTwoFactorResult>

export async function regenerateBackupCodes(
  input: DisableTwoFactorInput,
): Promise<RegenerateBackupCodesResult>
~~~~

Password path asks verifyPasswordMethodProof for DEFERRED factor consumption and accepts only VERIFIED with preparedTwoFactorProof. Google path prepares factor proof separately and requires a fresh LINK_GOOGLE intent. The mutation transaction re-reads User, enabled secret, password/Google method ownership, and version; consumes prepared factor and Google proof by exact CAS; applies disable or rotation; increments version with updateMany where expected version; and deletes Session rows.

Hash regeneration codes before the transaction. A backup code proved outside the transaction is not marked used until consumePreparedTwoFactorProof commits with the state change. Retried serializable transactions may reuse a proof only when the earlier attempt rolled back.

- [ ] **Step 4: Run GREEN and mutation regressions**

Run:

~~~~powershell
node --test tests/account-two-factor-management.test.mjs tests/auth-two-factor-proof.test.mjs tests/account-security-methods.test.mjs tests/admin-security-service.test.mjs tests/password-reset-confirmation.test.mjs
~~~~

Expected: PASS; all session-revoking account paths remain green.

- [ ] **Step 5: Commit**

~~~~powershell
git add lib/account-two-factor-management.ts tests/account-two-factor-management.test.mjs
git commit -m "feat: require dual proof for two-factor changes"
~~~~

**Independent review gate:** Inspect every transaction boundary and failure injection; verify prepared backup and Google proofs roll back, regenerated plaintext never enters persistence/logs, and exactly one concurrent mutation wins.

### Task 6: Replace Session-Only Routes with Thin Hardened Handlers

**Files:**

- Create: tests/account-two-factor-routes.test.mjs
- Modify: app/api/account/security/totp/setup/route.ts:1-34
- Modify: app/api/account/security/totp/enable/route.ts:1-56
- Modify: app/api/account/security/totp/disable/route.ts:1-24
- Modify: app/api/account/security/backup-codes/route.ts:1-37
- Modify: app/api/auth/google/intent/route.ts:24-89
- Modify: tests/auth-method-intents.test.mjs

**Interfaces:**

- Consumes: Task 3 request/binding helpers and Task 4/5 services.
- Produces: createTwoFactorSetupHandler(), createTwoFactorEnableHandler(), createTwoFactorDisableHandler(), and createBackupCodeRegenerationHandler() dependency-injected factories plus POST exports.
- Preserves: generic SIGN_IN_OR_LINK, ADD_PASSWORD, and REMOVE_PASSWORD intent-start behavior.
- Consumer: Task 7 UI.

- [ ] **Step 1: Write RED route-contract tests**

Compile each route with injected session, site URL, clock, request parser, intent resolver, service, cache, and cookie adapters. For every route, assert untrusted/non-JSON/unknown-key input returns before session, proof, limiter, or database work. Assert unauthenticated is 401, exact body parsing, network identifier forwarding, allowlisted status mapping, no-store headers, no private result fields, cache clear only after commit, and no email scheduling.

Cookie cases:

- setup success writes a five-minute enrollment cookie with HttpOnly, SameSite strict, exact path, Secure by environment, and no readable secret;
- enable retains a valid binding only for TWO_FACTOR_INVALID and RATE_LIMITED;
- enable clears it on success/expiry/conflict/already-enabled;
- a committed Google-primary action clears ml-auth-method-binding;
- failed/unconsumed Google proof remains available until its own existing expiry.

Modify auth-method intent route tests so LINK_GOOGLE requires the trusted browser JSON boundary before limiter/session/intent work, while the other three purposes keep their prior tested contract.

- [ ] **Step 2: Run RED**

Run:

~~~~powershell
node --test tests/account-two-factor-routes.test.mjs tests/auth-method-intents.test.mjs
~~~~

Expected: FAIL because the current four routes authorize on session alone and accept no exact request provenance.

- [ ] **Step 3: Implement thin handlers**

Each handler must:

1. call parseTrustedAccountSecurityJson before getCurrentSession;
2. require session.user.id, and setup also requires session email through the service read rather than trusting client input;
3. validate the exact discriminated body and confirmed:true;
4. resolve ml-auth-method-binding only for proofMethod GOOGLE with purpose LINK_GOOGLE and status CONSUMED;
5. call one service with requestIp and no raw proof logging;
6. map only the public code/status table;
7. set no-store headers on every response;
8. apply cookie/cache effects only for the exact result class.

The handlers return success payloads only as:

~~~~ts
{ code: "TWO_FACTOR_SETUP_READY", qrCode, manualCode }
{ code: "TWO_FACTOR_ENABLED", backupCodes }
{ code: "TWO_FACTOR_DISABLED" }
{ code: "BACKUP_CODES_REGENERATED", backupCodes }
~~~~

Do not return message, userId, intentId, secret row id, version, or provider data.

- [ ] **Step 4: Run GREEN and route regressions**

Run:

~~~~powershell
node --test tests/account-two-factor-routes.test.mjs tests/auth-method-intents.test.mjs tests/account-security-routes.test.mjs tests/auth-google-callback-flow.test.mjs
~~~~

Expected: PASS with zero provider or database connection.

- [ ] **Step 5: Commit**

~~~~powershell
git add app/api/account/security/totp/setup/route.ts app/api/account/security/totp/enable/route.ts app/api/account/security/totp/disable/route.ts app/api/account/security/backup-codes/route.ts app/api/auth/google/intent/route.ts tests/account-two-factor-routes.test.mjs tests/auth-method-intents.test.mjs
git commit -m "feat: harden two-factor management routes"
~~~~

**Independent review gate:** Confirm provenance precedes session/database work, shapes are exact, all failures are no-store/allowlisted, cookie effects match the table, and other Google intent purposes did not drift.

### Task 7: Build the Recoverable Account-Security Experience

**Files:**

- Create: lib/two-factor-management-recovery.ts
- Create: tests/two-factor-management-recovery.test.mjs
- Create: app/account/security/two-factor-management-panel.tsx
- Create: tests/account-two-factor-ui.test.mjs
- Modify: app/account/security/security-panel.tsx:11-203
- Modify: app/account/page.tsx:47-57, 127-130, 321-345, 467-480
- Modify: tests/account-security-routes.test.mjs:259-289
- Modify: tests/account-page-tabs.test.mjs
- Modify: tests/account-surface-data.test.mjs
- Modify: tests/browser/identity-method-safety.spec.ts only for authorization-gated private acceptance cases

**Interfaces:**

- Consumes: Task 6 exact endpoint shapes and LINK_GOOGLE intent start.
- Produces: TwoFactorManagementPanel props hasPasswordCredential, googleLinked, twoFactorEnabled, and googlePrimaryProofReady.
- Preserves: SignInMethodsPanel state isolation and Account tab loading.

- [ ] **Step 1: Write RED recovery, component, and acceptance tests**

Recovery tests map every allowed status/code pair to fixed guidance and map unknown code, wrong status, arbitrary message, provider detail, and malformed JSON to “Something went wrong. Please try again.”

Component tests assert:

- disabled password-only shows setup, password field, explicit confirmation, and no Google choice;
- disabled linked-method offers password or “Confirm with Google”;
- disabled Google-only hides setup and explains “Add a password first,” leaving SignInMethodsPanel as the add-password owner;
- googlePrimaryProofReady changes display only; setup still POSTs confirmed:true and server proofMethod GOOGLE;
- enabled password-only and linked-method controls require explicit destructive confirmation, primary proof, and current authenticator/backup code;
- enabled Google-only legacy shows Google management, not setup;
- enabled with no usable primary method shows full-admin recovery guidance and sends no request;
- QR/manual code stay only in React memory and are cleared after enable/expiry;
- backup codes appear only after enable/regenerate, with a required “I saved these backup codes” acknowledgment;
- no router refresh/sign-out occurs before acknowledgment would erase visible codes;
- after acknowledgment, current codes are cleared and the UI uses Auth.js signOut with a fixed /login?security=two-factor-changed callback;
- disable success gives an explicit re-sign-in transition;
- double submit is locked, pending labels and aria-busy are present, error/status live regions are correct, and focus remains on the action/recovery surface;
- the client sends application/json and never renders result.message.

Account-page tests accept only exact reauth=two-factor as googlePrimaryProofReady; other query values are false and never become service authorization.

Add authorization-gated Playwright cases for password-only, linked-method Google return, Google-only setup hiding, backup acknowledgment, and signed-out-after-change. These cases must use the existing verified disposable QA fixture gate, intercepted Google endpoints, example.test identities, and exact cleanup. They remain skipped unless the separate disposable-database authorization is present; they never contact live OAuth.

- [ ] **Step 2: Run RED**

Run:

~~~~powershell
node --test tests/two-factor-management-recovery.test.mjs tests/account-two-factor-ui.test.mjs tests/account-security-routes.test.mjs tests/account-page-tabs.test.mjs tests/account-surface-data.test.mjs
~~~~

Expected: FAIL because the split panel, allowlisted recovery mapper, proof forms, acknowledgment, and exact return prop do not exist.

- [ ] **Step 3: Implement the split UI owner**

SecurityPanel becomes composition:

~~~~tsx
<SignInMethodsPanel
  hasPasswordCredential={hasPasswordCredential}
  googleLinked={googleLinked}
  pendingAction={pendingAction}
  beginAction={beginAction}
  finishAction={finishAction}
/>
<TwoFactorManagementPanel
  twoFactorEnabled={twoFactorEnabled}
  hasPasswordCredential={hasPasswordCredential}
  googleLinked={googleLinked}
  googlePrimaryProofReady={googlePrimaryProofReady}
  pendingAction={pendingAction}
  beginAction={beginAction}
  finishAction={finishAction}
/>
~~~~

TwoFactorManagementPanel owns separate state objects for setup, disable, and regenerate; never reuse one password/code/confirmation across actions. Starting Google proof POSTs exact { purpose: "LINK_GOOGLE" } to /api/auth/google/intent, then calls signIn("google") using the existing intent flow. After the exact return, the user still chooses and confirms the operation.

Use the safe recovery mapper for every non-success. Backup codes remain in component state only. The acknowledgment is a real checkbox with associated label and an enabled “I saved these codes; sign in again” button. Do not put secrets in URL, storage, toast persistence, analytics, or logs.

In AccountPage, add reauth?: string to search params, compute:

~~~~ts
const googlePrimaryProofReady = params?.reauth === "two-factor"
~~~~

Pass it through ActiveAccountTab and SecurityTab. Treat it as display-only; every service call still requires the signed HttpOnly intent cookie.

- [ ] **Step 4: Run GREEN and rendered regressions**

Run:

~~~~powershell
node --test tests/two-factor-management-recovery.test.mjs tests/account-two-factor-ui.test.mjs tests/account-security-routes.test.mjs tests/account-page-tabs.test.mjs tests/account-surface-data.test.mjs tests/auth-google-callback-flow.test.mjs
npm run typecheck
npm run lint
~~~~

Expected: PASS. Lint may emit only already-established unchanged warnings; no new warning is accepted.

If and only if the separately authorized disposable QA target is active, run:

~~~~powershell
npm run build:browser-qa
npx playwright test tests/browser/identity-method-safety.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1
~~~~

Expected: public cases pass; the new private 2FA cases pass only under their explicit fixture gate and otherwise report intentional authorization skips. No live OAuth request is allowed.

- [ ] **Step 5: Commit**

~~~~powershell
git add lib/two-factor-management-recovery.ts app/account/security/two-factor-management-panel.tsx app/account/security/security-panel.tsx app/account/page.tsx tests/two-factor-management-recovery.test.mjs tests/account-two-factor-ui.test.mjs tests/account-security-routes.test.mjs tests/account-page-tabs.test.mjs tests/account-surface-data.test.mjs tests/browser/identity-method-safety.spec.ts
git commit -m "feat: add recoverable two-factor management"
~~~~

**Independent review gate:** Review the four method/state presentations, URL-as-display-only boundary, confirmation isolation, code acknowledgment before sign-out, accessibility, and absence of arbitrary response rendering.

## Final Validation and Review Gates

Do not claim this blocker closed from focused GREEN alone.

### 1. Exact change and schema boundary

~~~~powershell
git status --short
git diff --check
git diff -- prisma/schema.prisma prisma/migrations
git diff --name-only
~~~~

Expected: no schema/migration diff, no concurrent artifact/package/debug residue staged, and only planned source/test/docs paths in this workstream.

### 2. Prisma and static validation

~~~~powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
~~~~

Expected: all pass. Generation is validation only and applies no migration.

### 3. Focused security matrix

~~~~powershell
node --test tests/auth-security.test.mjs tests/auth-rate-limit.test.mjs tests/auth-two-factor-proof.test.mjs tests/auth-method-proof.test.mjs tests/auth-method-intents.test.mjs tests/auth-method-intent-proof.test.mjs tests/account-security-methods.test.mjs tests/account-two-factor-management.test.mjs tests/account-security-request.test.mjs tests/two-factor-enrollment-binding.test.mjs tests/account-two-factor-routes.test.mjs tests/two-factor-management-recovery.test.mjs tests/account-two-factor-ui.test.mjs tests/account-security-routes.test.mjs tests/auth-google-callback-flow.test.mjs tests/admin-security-service.test.mjs tests/password-reset-confirmation.test.mjs
~~~~

Expected: all pass with no real database, provider, or mail call.

### 4. Full local gates

~~~~powershell
npm run test
npm run build
npm run build:browser-qa
npm run test:browser -- --workers=1
git diff --check
~~~~

Expected: the ordinary and Browser-QA builds pass and the Browser-QA run exits with final totals. On Windows, do not misreport the established line-ending fixture failures as this branch's regression; nevertheless, a clean hosted Linux full Node result remains required before release closure.

Private database-backed browser rows remain authorization-gated. A local public Browser-QA pass does not substitute for the private password-only/linked/Google-only acceptance cases, and skipped private cases must be reported as open evidence rather than passes.

### 5. Hosted and private gates requiring separate authorization

- Push/hosted CI requires explicit push authorization; do not push merely to obtain Linux evidence.
- A disposable private-browser target requires its exact fingerprint and existing QA authorization gates; do not connect without them.
- Google is intercepted in browser tests. No real OAuth, account link, provider setting, email, or Production identity is created.
- No live database migration or schema operation exists for this plan.

### 6. Independent review sequence

After each task commit, dispatch a fresh spec reviewer, then a fresh code/security reviewer. Before final completion, request:

1. a first-principles security review of proof independence and canonical owners;
2. a concurrency/rollback review of every CAS count and injected failure receipt;
3. a route review of exact JSON/origin/fetch-metadata/no-store behavior;
4. a UX/accessibility review of setup hiding, legacy management, confirmations, backup acknowledgment, and re-sign-in;
5. a final diff review proving no schema/email/provider/live-authority expansion.

Any Critical or Important finding reopens the owning task under strict RED/GREEN. A new enum, schema need, durable security-email need, or provider-token carrier is an escalation signal and requires a revised approved plan before implementation.

### 7. Completion receipt

The final handoff must name:

- branch and exact HEAD;
- all task commits and reviewer verdicts;
- focused and full command totals;
- exact Browser-QA totals and intentional private skips;
- hosted Linux status;
- proof that schema/migrations are unchanged;
- proof that no live database/OAuth/email/provider/payment/deployment action occurred;
- any residual authorization-gated evidence;
- the unchanged full-admin lost-factor recovery path.
