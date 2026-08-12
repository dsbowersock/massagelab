# Admin Queue Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn existing Admin metrics into privacy-safe actionable queues and preserve validated directory context when an Admin opens and returns from account detail.

**Architecture:** Add a pure browser-safe queue/navigation contract that owns queue, sort, role, and status allowlists, canonical query serialization, and fixed-origin internal return-URL validation. Extend the existing bounded directory query with canonical attention filters and direction-aware cursor traversal; run cursor usability, visible-page, and reverse-lookback reads in one consistent read transaction/snapshot so concurrency cannot mix navigation states. Derive deduplicated per-user dashboard counts and row badges from the same predicates, and carry a signed-by-validation internal return path into detail without treating cursor state as authority.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Prisma 7, URLSearchParams, Node test runner, Playwright.

## Global Constraints

- This branch is read-only except for URL/navigation state; it adds no mutation authority.
- Preserve search, supported filters, queue, and page size in return navigation.
- Preserve the directory's supported deterministic sort. This branch exposes `account_asc` and `account_desc`; forward boundaries, reverse-lookback queries, result reversal, and emitted next/previous cursors must all follow the selected ID direction.
- A cursor is navigation context only. Transport uses one opaque canonical unpadded base64url token that decodes exactly once into a canonical versioned JSON envelope containing `accountId` and the fingerprint of the normalized non-cursor query. Parsing returns one `ParsedAdminUserCursor` object containing both the unchanged token and validated decoded account ID; no API represents either value as an ambiguous bare cursor string. Reject malformed, non-canonical, double-encoded, wrong-version, or query-mismatched tokens before the transaction, and use only `parsedCursor.accountId` for existence checks and database comparisons. If that account is missing, deleted, or filtered out, fall back once to the first page while retaining safe non-cursor filters.
- Cursor usability, first/forward page selection, and any previous-page lookback must share one repeatable consistent read snapshot. Concurrent deletion or filter-state changes cannot let validation and page evidence observe different database states.
- Reject absolute, protocol-relative, encoded-external, malformed, and unsupported return URLs.
- Canonical queues: billing reconciliation, failed notification, commerce review, temporary access expiring within 30 days, and broader unresolved.
- Use one captured request time for queue filters and metrics; the temporary-expiry endpoint is exclusive.
- Expose only safe type badges/counts. Never include provider IDs, raw failure messages, payment instruments, internal notes, tokens, hashes, or mutation evidence.
- Preserve keyboard access, mobile layout, bounded queries, deterministic cursor ordering, and full-Admin authorization.
- Follow strict RED/GREEN development and stop at the user-controlled merge gate.

---

## File Structure

- Create `lib/admin/user-directory-query-contract.ts`: dependency-free browser-safe allowlists, query normalizer/parser, canonical User-ID grammar, and versioned cursor codec.
- Create `lib/admin/user-directory-navigation.ts`: browser-safe URL builder and fixed-origin return-URL sanitizer consuming the query contract.
- Modify `lib/admin/user-directory.ts`: consume the query contract while retaining Prisma predicates, database operations, safe row counts, and stale-cursor fallback.
- Modify `app/admin/users/page.tsx`: queue controls, context-carrying detail links, privacy-safe badges.
- Modify `app/admin/users/[userId]/page.tsx`: validated return link and section-link context preservation.
- Modify `app/admin/page.tsx`: metric cards become canonical queue links.
- Modify `tests/admin-user-directory.test.mjs`, `tests/admin-dashboard.test.mjs`, `tests/admin-user-detail.test.mjs`, `tests/admin-security-ui.test.mjs`, `tests/admin-user-operations-fixture.test.mjs`, and `tests/browser/admin-user-operations.spec.ts`.
- Modify canonical state/log/Admin runbook/release checklist.

### Task 1: Define canonical queue and return-URL contracts

**Files:**
- Create: `lib/admin/user-directory-query-contract.ts`
- Create: `lib/admin/user-directory-navigation.ts`
- Modify: `tests/admin-user-directory.test.mjs`

**Interfaces:**
- Produces:

```ts
export const ADMIN_USER_QUEUE_VALUES = [
  "billing_reconciliation",
  "failed_notification",
  "commerce_review",
  "temporary_expiring",
  "unresolved",
] as const

export type AdminUserQueue = (typeof ADMIN_USER_QUEUE_VALUES)[number]

export const ADMIN_USER_SORT_VALUES = ["account_asc", "account_desc"] as const
export const ADMIN_USER_ROLE_FILTER_VALUES = [
  "USER", "STUDENT", "LICENSED_THERAPIST", "CLIENT", "EDITOR",
  "ANATOMY_REVIEWER", "ANATOMY_EDITOR", "ADMIN",
] as const
export const ADMIN_USER_ROLE_STATUS_FILTER_VALUES = [
  "verified", "pending", "rejected", "revoked",
] as const
export const ADMIN_USER_EMAIL_VERIFICATION_FILTER_VALUES = ["verified", "unverified"] as const
export const ADMIN_USER_SUBSCRIPTION_STATUS_FILTER_VALUES = [
  "active", "trialing", "past_due", "unpaid", "paused", "incomplete",
  "incomplete_expired", "canceled",
] as const
export const ADMIN_USER_CREDIT_STATE_FILTER_VALUES = ["positive", "zero"] as const
export const ADMIN_USER_TEMPORARY_ACCESS_FILTER_VALUES = ["active", "none"] as const
export const ADMIN_USER_UNRESOLVED_FILTER_VALUES = ["yes", "no"] as const

export type AdminUserSort = (typeof ADMIN_USER_SORT_VALUES)[number]
export type AdminUserRoleFilter = (typeof ADMIN_USER_ROLE_FILTER_VALUES)[number]
export type AdminUserRoleStatusFilter = (typeof ADMIN_USER_ROLE_STATUS_FILTER_VALUES)[number]
export type AdminUserEmailVerificationFilter = (typeof ADMIN_USER_EMAIL_VERIFICATION_FILTER_VALUES)[number]
export type AdminUserSubscriptionStatusFilter = (typeof ADMIN_USER_SUBSCRIPTION_STATUS_FILTER_VALUES)[number]
export type AdminUserCreditStateFilter = (typeof ADMIN_USER_CREDIT_STATE_FILTER_VALUES)[number]
export type AdminUserTemporaryAccessFilter = (typeof ADMIN_USER_TEMPORARY_ACCESS_FILTER_VALUES)[number]
export type AdminUserUnresolvedFilter = (typeof ADMIN_USER_UNRESOLVED_FILTER_VALUES)[number]

export type CanonicalAdminUserId = string & { readonly __canonicalAdminUserId: unique symbol }

export type AdminDirectoryNavigationQuery = {
  query: string
  pageSize: number
  cursor: ParsedAdminUserCursor | null
  sort: AdminUserSort
  emailVerified: AdminUserEmailVerificationFilter | null
  role: AdminUserRoleFilter | null
  roleStatus: AdminUserRoleStatusFilter | null
  subscriptionStatus: AdminUserSubscriptionStatusFilter | null
  creditState: AdminUserCreditStateFilter | null
  temporaryAccess: AdminUserTemporaryAccessFilter | null
  unresolvedIssue: AdminUserUnresolvedFilter | null
  queue: AdminUserQueue | null
}

export function parseUserDirectoryQuery(
  input: URLSearchParams | Readonly<Record<string, string | readonly string[] | undefined>>,
): AdminDirectoryNavigationQuery

export type ParsedAdminUserCursor = {
  token: string
  accountId: CanonicalAdminUserId
  queryFingerprint: string
}

export function encodeAdminUserCursor(value: {
  accountId: CanonicalAdminUserId
  queryFingerprint: string
}): ParsedAdminUserCursor
export function decodeAdminUserCursor(value: {
  token: string
  expectedQueryFingerprint: string
}): ParsedAdminUserCursor

export function buildAdminUserDirectoryHref(
  query: AdminDirectoryNavigationQuery,
  cursor?: ParsedAdminUserCursor | null,
): string

export function sanitizeAdminUserDirectoryReturnTo(value: string | null | undefined): string
```

- [ ] **Step 1: Add RED URL tests**

Assert `user-directory-query-contract.ts` is the single source for the parser, normalizers, cursor codec, canonical User-ID validator, and form/serializer sort/role/status allowlists. Both `user-directory-navigation.ts` and server-only `user-directory.ts` import that dependency-free contract; the contract/navigation import graph must not contain `@prisma/client`, `server-only`, `next/headers`, `lib/prisma`, auth, billing, database adapters, or any transitive server-only module. Prisma predicates and database operations remain exclusively in `user-directory.ts`. Add a source/import-graph contract that fails if a Client Component or browser-safe module imports `user-directory.ts`, or if the shared contract gains a forbidden direct/transitive import. Assert the builder produces a stable `/admin/users?...` query preserving all supported non-default fields and page size. Canonical serialization always includes `pageSize`, omits empty fields and the default `sort=account_asc`, emits `sort=account_desc` only when selected, and uses this fixed order: `q`, `emailVerified`, `role`, `roleStatus`, `subscriptionStatus`, `creditState`, `temporaryAccess`, `unresolvedIssue`, `queue`, non-default `sort`, `pageSize`, `cursor`. Assert parse -> build -> parse is idempotent.

Assert the sanitizer parses against one hard-coded inert origin such as `https://admin-navigation.invalid`, requires the raw input to begin with exactly one `/`, and then requires the parsed origin and `pathname === "/admin/users"` to match. It rejects credentials, host/origin changes, raw C0/DEL control characters, backslashes, encoded separators in the authority/path portion, fragments, duplicate singleton parameters, and every direct/double-encoded form below:

```js
for (const unsafe of [
  "https://evil.example/admin/users",
  "//evil.example/admin/users",
  "/admin/users\u0000?q=x",
  "/admin/users\r?q=x",
  "/admin/users\n?q=x",
  "/admin/users\t?q=x",
  "/admin/users/target-id",
  "/%2f%2fevil.example/admin/users",
  "/%252f%252fevil.example/admin/users",
  "/admin%5cusers",
  "/admin%255cusers",
  "https%3a%2f%2fevil.example%2fadmin%2fusers",
  "https%253a%252f%252fevil.example%252fadmin%252fusers",
  "/admin/users?returnTo=https%3A%2F%2Fevil.example",
  "/admin/users?returnTo=https%253A%252F%252Fevil.example",
  "/admin/users?unknown=secret",
  "javascript:alert(1)",
]) {
  assert.equal(sanitizeAdminUserDirectoryReturnTo(unsafe), "/admin/users")
}

for (const codePoint of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
  const rawControl = String.fromCodePoint(codePoint)
  assert.equal(sanitizeAdminUserDirectoryReturnTo(`/admin/users${rawControl}?q=x`), "/admin/users")
  assert.equal(sanitizeAdminUserDirectoryReturnTo(`/admin/users?q=x${rawControl}`), "/admin/users")
}
```

Before choosing the ID validator, audit the `User.id` schema declaration, Prisma's actual `cuid()` generator output for the repository-pinned version, every Production creation/Auth-adapter/import path, and a sanitized aggregate of current Production IDs (length/character-class/version counts only; never log IDs). Record the resulting canonical grammar and its compatibility rationale in the Admin runbook. Do not assume that the schema default constrains explicitly supplied IDs or impose an arbitrary CUID regex. Tests include representative generated IDs and every sanitized historical/imported class found by the audit, plus empty, overlong, control/whitespace, invalid-Unicode, and out-of-grammar cases; if current IDs cannot be classified safely, stop for a migration/compatibility decision before cursor validation ships.

Assert unsupported queue values are omitted, unsupported sort values become `account_asc`, and cursor may be stripped independently. Cursor tests must prove the encoder canonicalizes exactly `{ "v": 1, "accountId": ..., "queryFingerprint": ... }` in documented field order to UTF-8 and unpadded base64url once, and returns a `ParsedAdminUserCursor`; `queryFingerprint` is SHA-256 over the documented canonical serialization of every normalized non-cursor filter, sort, and page-size field. The decoder accepts the transport token once, validates canonical re-encoding/version/User-ID/query binding, and returns the same unchanged `token` plus separately named `accountId` and `queryFingerprint`. Reject invalid base64url, padding, empty/overlong payloads, non-UTF-8 bytes, duplicate/unknown JSON fields, noncanonical JSON or re-encoding, a double-encoded token, wrong version, mismatched normalized query fingerprint, and any decoded ID outside the audited Production grammar. The builder accepts only the parsed structure, emits `.token` unchanged, and never re-encodes it; database source/tests may compare only `.accountId`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/admin-user-directory.test.mjs`

Expected: FAIL because the navigation module and queue field do not exist.

- [ ] **Step 3: Implement stable query serialization**

Use `URLSearchParams`; allow only the fields in `AdminDirectoryNavigationQuery`. Before canonical parsing, perform a bounded hazard inspection of the raw string and at most two successful `decodeURIComponent` layers. At every inspected layer reject malformed percent encoding, `\u0000-\u001f`/`\u007f`, backslashes, credentials, absolute/protocol-relative origins, or a path other than exactly `/admin/users`; after the second layer, reject any remaining percent sequence that could decode into a control, slash, backslash, colon, or authority delimiter. This inspection never turns decoded query text into canonical state: after it passes, parse the original input once against the fixed inert origin, reject any origin/credential/path ambiguity, and round-trip every parameter through the dependency-free shared query parser before rebuilding the canonical URL. Never use a request header or caller-supplied origin as the sanitizer base. Normalize all non-cursor fields first, compute their canonical query fingerprint, then decode the cursor token exactly once and require the envelope's fingerprint to match. The canonical builder uses the documented fixed field order, always emits `pageSize`, omits `account_asc`, includes `account_desc`, and strips unsupported/default values consistently. It receives `ParsedAdminUserCursor | null` and emits only `parsedCursor.token` unchanged, so neither parser nor builder can re-encode the account ID or confuse the transport token with a database boundary.

- [ ] **Step 4: Implement stale-cursor stripping**

The sanitizer accepts a valid cursor, but expose a helper or builder option to return the same canonical query without `cursor`. This is used after the directory proves a cursor no longer identifies a usable page.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/admin-user-directory.test.mjs`

Expected: PASS for safe serialization and external/malformed URL rejection.

- [ ] **Step 6: Commit the navigation contract**

```bash
git add lib/admin/user-directory-query-contract.ts lib/admin/user-directory-navigation.ts tests/admin-user-directory.test.mjs
git commit -m "feat: define admin directory queue navigation"
```

### Task 2: Add canonical queue predicates and safe row evidence

**Files:**
- Modify: `lib/admin/user-directory.ts`
- Modify: `tests/admin-user-directory.test.mjs`

**Interfaces:**
- Consumes: `AdminUserQueue` and canonical active temporary-grant predicate.
- Extends `AdminUserDirectoryQuery` with `queue: AdminUserQueue | null`.
- Extends rows with:

```ts
attention: {
  billingReconciliation: number
  failedNotification: number
  commerceReview: number
  temporaryExpiring: number
}
```

- [ ] **Step 1: Add exact parser and direction-aware query RED tests**

For each queue, assert exact Prisma `where` shape in forward, cursor-usability, and previous-page lookback queries. Run multi-page cases with `account_asc` and `account_desc` and assert actual returned row order plus next/previous navigation targets, not only `orderBy` objects. Transaction input carries `parsedCursor: ParsedAdminUserCursor | null`; test names and fixtures use `parsedCursor.token` and `parsedCursor.accountId`, and assert no Prisma predicate or comparison receives `.token`. The algorithm is explicit:

- `account_asc`: after decoding the transport token once, forward rows use `id > decodedCursorAccountId` ordered ascending; previous lookback uses `id < decodedCursorAccountId` ordered descending, takes at most one page, and derives a separate earlier decoded boundary ID from that reversed window.
- `account_desc`: after decoding the transport token once, forward rows use `id < decodedCursorAccountId` ordered descending; previous lookback uses `id > decodedCursorAccountId` ordered ascending, takes at most one page, and derives a separate earlier decoded boundary ID from that reversed window.
- Any rows fetched in the opposite direction for previous-page calculation are private decoded-ID boundary evidence, not a page to expose. Reverse that window into forward order, then derive the earlier decoded boundary ID from it. Keep the established exclusive decoded-ID predicates (`>` for ascending, `<` for descending); do not change them to inclusive comparisons. Encode the last visible decoded row ID exactly once to produce a next-cursor token, and encode a derived previous decoded boundary ID exactly once to produce a previous-cursor token. The opaque token is transport only and never appears in an `id`, `gt`, `lt`, equality, ordering, or boundary comparison. Previous tokens must reproduce the immediately preceding page with no gaps or duplicates; the first page emits no previous token.

Add an explicit four-page numeric proof with `pageSize=2` and symbolic labels `01` through `08` mapped to eight lexically ordered representative account IDs that pass the audited Production grammar. Ascending must expose `[01,02]`, `[03,04]`, `[05,06]`, `[07,08]`; page 4 receives opaque token `encode("06")`, decodes it once to `parsedCursor.accountId = ID("06")`, and its private descending lookback from that exclusive decoded boundary ID is `[05,04]`. Reversing to `[04,05]` derives earlier decoded boundary ID `ID("04")`, whose one-time encoding makes the Previous token and reproduces page 3 `[05,06]` rather than exposing lookback rows. Page 3 similarly derives `ID("02")`, and page 2 returns to the tokenless first page. Descending page 4 receives `encode("03")`, decodes once to `parsedCursor.accountId = ID("03")`, and its private ascending lookback from that exclusive decoded boundary ID is `[04,05]`; reversing to `[05,04]` derives `ID("05")`, whose one-time encoding reproduces page 3 `[04,03]`. Assert all forward and backward tokens/decoded boundaries, and explicitly assert that neither lookback window is returned as visible items or compared as an opaque token.

The response and URL contract is exact; notably, `previousCursor: null` is a valid page-2 Previous target rather than evidence that Previous is unavailable:

In this table, visible values are the `01`-`08` aliases for representative validated account IDs. `encode("ID")` is compact notation for `encodeAdminUserCursor({ accountId: ID("ID"), queryFingerprint: currentQueryFingerprint }).token`; every non-null cursor cell is that opaque canonical transport token, never the alias or decoded ID, and URL assertions contain it exactly once.

| Sort | Page | Input cursor token | Visible decoded IDs | `nextCursor` token | `hasPreviousPage` | `previousCursor` token | Previous URL |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `account_asc` | 1 | `null` | `01,02` | `encode("02")` | `false` | `null` | none; do not render/enable Previous |
| `account_asc` | 2 | `encode("02")` | `03,04` | `encode("04")` | `true` | `null` | canonical page-1 URL with the `cursor` parameter omitted |
| `account_asc` | 3 | `encode("04")` | `05,06` | `encode("06")` | `true` | `encode("02")` | canonical URL with `cursor=${encode("02")}` |
| `account_asc` | 4 | `encode("06")` | `07,08` | `null` | `true` | `encode("04")` | canonical URL with `cursor=${encode("04")}` |
| `account_desc` | 1 | `null` | `08,07` | `encode("07")` | `false` | `null` | none; do not render/enable Previous |
| `account_desc` | 2 | `encode("07")` | `06,05` | `encode("05")` | `true` | `null` | canonical page-1 URL with the `cursor` parameter omitted |
| `account_desc` | 3 | `encode("05")` | `04,03` | `encode("03")` | `true` | `encode("07")` | canonical URL with `cursor=${encode("07")}` |
| `account_desc` | 4 | `encode("03")` | `02,01` | `null` | `true` | `encode("05")` | canonical URL with `cursor=${encode("05")}` |

The page component decides Previous availability from `hasPreviousPage`, never from truthiness of `previousCursor`. The shared URL builder deletes `cursor` when the chosen cursor is `null`, while retaining the validated queue, search, role, status, sort, and page-size parameters. Tests assert these exact response objects and hrefs for both sorts, including page 1 `false/null` and page 2 `true/null`.

Make this a complete table-driven matrix across all five queues and both sorts. For every `(queue, sort)` pair, use enough matching deterministic IDs for at least three full pages, traverse forward page 1 -> page 2 -> page 3 using emitted opaque next-cursor tokens, then traverse page 3 -> page 2 -> page 1 using emitted opaque previous-cursor tokens. Assert each page's exact selected-direction decoded ID order, exact token and URL round-trip equality for pages 1 and 2, no gaps, no duplicates, no comparison against an opaque token, and no previous cursor on the restored first page. In both ascending and descending matrices, include malformed, double-encoded, and non-canonical token cases and prove they fail parsing before the transaction starts.

- `billing_reconciliation`: `AdminBillingGoodwillOperation.status in PREPARED/APPLIED/RECONCILIATION_REQUIRED`.
- `failed_notification`: `AdminEmailIntent.status === FAILED`.
- `commerce_review`: review-required order, pending refund, or open dispute.
- `temporary_expiring`: canonical allowlisted active grant with `expiresAt > now` and `< now + 30 days`.
- `unresolved`: the existing broader unresolved predicate.

Assert `expiresAt === windowEnd` is excluded.

- [ ] **Step 2: Add RED row-projection privacy tests**

Require exact four counts and assert serialized rows omit Stripe IDs, payment IDs, failure code/message, recipient email, internal note, action evidence, and grant IDs.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/admin-user-directory.test.mjs`

Expected: FAIL because queue parsing/predicates and attention counts are absent.

- [ ] **Step 4: Implement one-clock shared user predicates**

Capture `requestNow` once in the page and pass it to both metrics and directory. Export `queueWhere(queue, now)` as the one `Prisma.UserWhereInput` owner used by the bounded directory and dashboard `user.count`; it reuses existing predicate owners and the exact exclusive temporary window. Because the predicate selects users through `some` relations, multiple matching operations for one user still contribute one account to dashboard counts.

- [ ] **Step 5: Extend the bounded select**

Add relation counts only; do not select operation rows or provider fields. Map missing optional counts to zero without fabricating totals.

- [ ] **Step 6: Add explicit cursor-usability checks and stale fallback**

Inside one interactive read transaction with a repeatable consistent snapshot, perform the bounded identifier-only cursor-usability lookup, visible-page query, and any previous-page lookback using the same safe `where` filters. Decode the canonical token once before the transaction, retain the opaque token only for navigation output, and require the separately named decoded account ID to exist and remain matched before any boundary query. Every `id`, `gt`, `lt`, and Prisma cursor comparison uses the decoded ID; none uses or decodes the opaque token again. A missing/deleted ID or an account excluded by changed filters/queue is unusable even if other rows exist after it. Strip an unusable cursor, run only the first bounded page in that same snapshot with the same non-cursor query, and return `cursorReset: true`; do not rely on a thrown Prisma cursor error, recursively retry, or broaden filters. Tests must cover malformed, double-encoded, and non-canonical cursor tokens (rejected by parsing), nonexistent decoded IDs, deleted rows, filter-changed rows, valid cursors at both sort directions, and a valid cursor whose following page is legitimately empty. Add deterministic concurrency tests that delete the cursor row or change its queue/filter match between the fake lookup and page query; the transaction snapshot must yield one coherent before-state or after-state, never a mixed state, and every read must be asserted against the same transaction client.

```ts
return {
  items,
  nextCursor,
  previousCursor,
  hasPreviousPage,
  cursorReset,
}
```

When the visible page is the tokenless first page, return `hasPreviousPage: false` and `previousCursor: null`. When a valid decoded cursor account ID selects page 2, return `hasPreviousPage: true` and `previousCursor: null`; this deliberately means “Previous navigates to tokenless page 1.” Page 3 and later return `hasPreviousPage: true` plus the non-null opaque token produced by encoding the decoded exclusive boundary ID exactly once.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `node --test tests/admin-user-directory.test.mjs`

Expected: PASS for every queue, exact boundaries, forward/previous cursors, fallback, and privacy assertions.

- [ ] **Step 8: Commit query behavior**

```bash
git add lib/admin/user-directory.ts tests/admin-user-directory.test.mjs
git commit -m "feat: add privacy-safe admin account queues"
```

### Task 3: Preserve directory context through account detail

**Files:**
- Modify: `app/admin/users/page.tsx`
- Modify: `app/admin/users/[userId]/page.tsx`
- Modify: `tests/admin-user-directory.test.mjs`
- Modify: `tests/admin-user-detail.test.mjs`
- Modify: `tests/admin-security-ui.test.mjs`

**Interfaces:**
- Consumes: `buildAdminUserDirectoryHref` and `sanitizeAdminUserDirectoryReturnTo`.
- Adds detail query parameter `returnTo`, whose value is the encoded canonical internal directory path.

- [ ] **Step 1: Add RED source and compiled-page tests**

Require desktop and mobile account links to include one validated return path. Require detail's Back link to use the sanitized path and section tabs to preserve it. Assert external return values render `/admin/users`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/admin-user-directory.test.mjs tests/admin-user-detail.test.mjs`

Expected: FAIL because links currently hardcode the detail path and `/admin/users` back link.

- [ ] **Step 3: Build one canonical current directory URL**

In `AdminUserDirectoryPage`, build the current URL from the parsed query, selected sort, and effective cursor. Pass it to `AccountIdentity`; create the detail href with `URLSearchParams` rather than string concatenation.

- [ ] **Step 4: Validate return context in detail**

Read one `returnTo` string from `searchParams`, sanitize it, and use it for Back. Extend `sectionHref` so switching detail sections retains the same canonical return path.

- [ ] **Step 5: Handle stale-cursor notice**

When `cursorReset` is true, render a status message explaining that results returned to the first page while filters were retained. Use the cursorless canonical URL for detail return context.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/admin-user-directory.test.mjs tests/admin-user-detail.test.mjs tests/admin-security-ui.test.mjs`

Expected: PASS with faithful compiled-page doubles and no external navigation.

- [ ] **Step 7: Commit context navigation**

```bash
git add app/admin/users/page.tsx app/admin/users/[userId]/page.tsx tests/admin-user-directory.test.mjs tests/admin-user-detail.test.mjs tests/admin-security-ui.test.mjs
git commit -m "feat: preserve admin directory return context"
```

### Task 4: Make metrics and rows actionable

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/users/page.tsx`
- Modify: `tests/admin-dashboard.test.mjs`
- Modify: `tests/admin-user-directory.test.mjs`

**Interfaces:**
- Consumes: canonical queue URLs from Task 1, exported shared `queueWhere(queue, requestNow)` user predicates from Task 2, and row attention counts from Task 2.
- Produces: keyboard-accessible queue links and safe badges.

- [ ] **Step 1: Add dashboard RED tests**

Require metric links and canonical default serialization:

```js
assert.equal(queueLinks.billing, "/admin/users?queue=billing_reconciliation&pageSize=25")
assert.equal(queueLinks.failedEmail, "/admin/users?queue=failed_notification&pageSize=25")
assert.equal(queueLinks.commerce, "/admin/users?queue=commerce_review&pageSize=25")
assert.equal(queueLinks.expiring, "/admin/users?queue=temporary_expiring&pageSize=25")
assert.equal(queueLinks.unresolved, "/admin/users?queue=unresolved&pageSize=25")
```

Update metrics if needed so failed notification and commerce counts are separately available while preserving the aggregate unresolved count.

For every queue, seed one user with multiple matching child records plus another user with one match. Assert the dashboard metric is `2`, not the number of operations/intents/grants. For `commerce_review`, add separate deduplication populations for each relation owner: multiple review-required orders for one account, multiple pending refunds for one account, and multiple open disputes for one account must each count as one account in isolated cases. Add an overlap case where one account matches all three relations and still contributes one, alongside distinct accounts that prove every OR branch remains included. Require the dashboard to call `user.count({ where: queueWhere(queue, requestNow) })` (or an equivalently deduplicated user-ID query) with the same captured time and exact shared predicate used by the directory; do not separately count child tables or reimplement predicates in the page.

- [ ] **Step 2: Add directory badge RED tests**

Require only nonzero badges with plain labels such as `Billing recovery 2`, `Failed notification 1`, `Commerce review 3`, and `Temporary expiring 1`. Assert badge markup contains no operation/provider identifiers.

- [ ] **Step 3: Run focused UI tests and verify RED**

Run: `node --test tests/admin-dashboard.test.mjs tests/admin-user-directory.test.mjs`

Expected: FAIL because dashboard stats are not links and rows expose only one combined count.

- [ ] **Step 4: Derive per-user metrics and render queue links/filters**

Compute each dashboard queue metric as a deduplicated account count from the exact exported `queueWhere(queue, requestNow)` predicate. Each request owner captures its own `requestNow` exactly once: all dashboard metrics share the dashboard request time, while directory filtering and row evidence share the directory request time; deterministic predicate/count tests inject the same time. Use the shared URL builder for dashboard metrics and a directory queue select/chip group. Add a two-option sort select (`Account ID ascending`, `Account ID descending`) whose values, together with role and status controls, come from the browser-safe contract rather than route-local duplicate arrays. Show the active queue in the page heading/summary without trusting raw query text.

- [ ] **Step 5: Render responsive privacy-safe badges**

Use semantic list/text markup shared by desktop table and mobile cards. Account links remain the only row navigation target; badges do not submit mutations.

- [ ] **Step 6: Run UI tests and verify GREEN**

Run: `node --test tests/admin-dashboard.test.mjs tests/admin-user-directory.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit actionable presentation**

```bash
git add app/admin/page.tsx app/admin/users/page.tsx tests/admin-dashboard.test.mjs tests/admin-user-directory.test.mjs
git commit -m "feat: link admin metrics to support queues"
```

### Task 5: Browser acceptance, docs, and terminal validation

**Files:**
- Modify: `tests/browser/admin-user-operations.spec.ts`
- Modify: `tests/admin-user-operations-fixture.test.mjs`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify: `docs/wiki/admin-user-operations.md`
- Modify: `docs/wiki/release-checklist.md`

**Interfaces:**
- Consumes: completed activation/browser database gate from Branch 3.
- Produces: desktop/mobile proof of queue navigation and context restoration.

- [ ] **Step 1: Add browser RED coverage**

Using deterministic fixture rows, including multiple matching records for one account, open a dashboard queue link, assert its deduplicated per-user metric, canonical active filter/default serialization, and safe badges, navigate to detail, switch sections, and activate Back. Assert the URL restores the queue/search/page-size/sort context. Add absolute, protocol-relative, encoded-separator/backslash, duplicate-parameter, and invalid external `returnTo` navigation cases and assert Back points to `/admin/users`.

- [ ] **Step 2: Add keyboard and mobile assertions**

Focus and activate metric/detail/back links by keyboard. Assert no horizontal overflow in desktop or mobile projects and no raw failure/provider evidence in rendered text or hrefs.

- [ ] **Step 3: Run source/focused browser contracts**

```bash
node --test tests/admin-user-directory.test.mjs tests/admin-dashboard.test.mjs tests/admin-user-detail.test.mjs tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs
```

Expected: PASS after implementation.

- [ ] **Step 4: Run real disposable browser QA**

Use Branch 3's pinned browser-acceptance owner with its exact disposable Neon identity gate and SMTP-blank Playwright-owned server:

```bash
npm run admin:operations:browser-acceptance
```

Expected: the wrapper runs the exact Admin User Operations spec in desktop/mobile Chromium, both projects PASS, fixture cleanup PASS, and zero billing-goodwill submissions/POSTs. The same owner awaits its complete process tree, deletes the exact disposable Neon branch only after fixture cleanup, and verifies that branch's trusted-control-plane absence; missing exit, cleanup, deletion, or absence proof blocks acceptance.

- [ ] **Step 5: Update canonical docs**

Document each queue, exact safe evidence, exclusive expiry window, internal return URL, and stale-cursor fallback. State explicitly that queues do not grant mutation authority.

- [ ] **Step 6: Verify every established mutation revalidates queue consumers**

Run the focused action/source suites and require each completed role, security, background-credit, temporary-access, notification-retry, and billing-goodwill action to revalidate its target detail plus `/admin/users` and `/admin`. Preserve Account/Activity revalidation where the established owner already requires it; this branch does not add mutation calls.

```bash
node --test tests/admin-role-ui.test.mjs tests/admin-security-ui.test.mjs tests/admin-background-credit-ui.test.mjs tests/admin-temporary-access.test.mjs tests/account-activity.test.mjs tests/admin-billing-goodwill-ui.test.mjs
```

Expected: PASS with exact pathname-only `revalidatePath` assertions and no query-string cache tags.

- [ ] **Step 7: Run comprehensive validation**

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Expected: all pass with the single intentional unit-test skip and 104-page build.

- [ ] **Step 8: Request spec and quality review**

Review exact shared-predicate/deduplicated-user count agreement, time boundaries, ascending/descending forward-and-reverse pagination, explicit cursor usability and stale fallback, fixed-origin open-redirect resistance, canonical default serialization, privacy exclusions, responsive keyboard UX, and absence of new mutation authority.

- [ ] **Step 9: Commit docs and browser evidence**

```bash
git add tests/browser/admin-user-operations.spec.ts tests/admin-user-operations-fixture.test.mjs docs/project-state.md docs/project-log.md docs/wiki/admin-user-operations.md docs/wiki/release-checklist.md
git commit -m "docs: record admin queue navigation evidence"
```

- [ ] **Step 10: Complete the PR loop**

Push/open a ready PR, wait for hosted QA/CodeQL/Vercel/CodeRabbit, verify every exact-head finding, fix valid issues with RED/GREEN evidence, resolve threads, obtain a fresh clean review, and stop at the user merge gate.
