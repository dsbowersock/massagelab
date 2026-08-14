# Admin Queue Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn existing Admin metrics into privacy-safe actionable queues and preserve validated directory context when an Admin opens and returns from account detail.

**Architecture:** Add a browser-safe queue/navigation contract that owns queue, sort, role, and status allowlists, canonical query serialization, asynchronous Web Crypto SHA-256 query fingerprints, and fixed-origin internal return-URL validation. Every fingerprint API returns a `Promise`; Server Components/routes/helpers and Client Component async event handlers await it before navigation/state/database work, while Client Component render remains synchronous and consumes prepared values. Only envelope encode/decode remains synchronous after runtime validation. Extend the bounded directory query with canonical queues and one consistent read snapshot for cursor usability/page/lookback, then derive deduplicated counts/badges and validated return context.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Prisma 7, URLSearchParams, Node test runner, Playwright.

## Global Constraints

- This branch is read-only except for URL/navigation state; it adds no mutation authority.
- Preserve search, supported filters, queue, and page size in return navigation.
- Preserve the directory's supported deterministic sort. This branch exposes `account_asc` and `account_desc`; forward boundaries, reverse-lookback queries, result reversal, and emitted next/previous cursors must all follow the selected ID direction.
- A cursor is navigation context only. Transport uses one opaque canonical unpadded base64url token over exact UTF-8 bytes of `JSON.stringify` on an object constructed by inserting properties only in this order: `v`, `accountId`, `queryFingerprint`. The sole canonical payload is `{"v":1,"accountId":<JSON string>,"queryFingerprint":<JSON string>}` with no whitespace. Parsing returns one `ParsedAdminUserCursor` containing the unchanged token and validated decoded account ID. Reject malformed, padded, non-canonical, double-encoded, wrong-version, query-mismatched, duplicate/extra/missing-key, alternate-order, whitespace, or alternate JSON-escape spelling before the transaction, and use only `parsedCursor.accountId` for database comparisons. If that account is missing, deleted, or filtered out, fall back once to the first page while retaining safe filters.
- Compute the query fingerprint with `globalThis.crypto.subtle.digest("SHA-256", ...)` over the documented canonical UTF-8 bytes. Do not use `node:crypto`, a server helper, a hand-rolled hash, or a synchronous digest substitute. Server Components, routes, server helpers, and async Client Component event handlers await fingerprint-producing APIs before cursor decode/encode, navigation/state update, sanitizer success, or database work. Client Component render functions remain synchronous: they receive server-prepared canonical values or start an awaited async event handler; they never return a Promise or call these helpers during render. Pure envelope encode/decode may remain synchronous only with a validated fingerprint.
- Cursor usability, first/forward page selection, and any previous-page lookback must share one repeatable consistent read snapshot. Concurrent deletion or filter-state changes cannot let validation and page evidence observe different database states.
- Reject absolute, protocol-relative, encoded-external, malformed, and unsupported return URLs.
- Canonical queues: billing reconciliation, failed notification, commerce review, temporary access expiring within 30 days, and broader unresolved.
- Use one captured request time for queue filters and metrics; the temporary-expiry endpoint is exclusive.
- Expose only safe type badges/counts. Never include provider IDs, raw failure messages, payment instruments, internal notes, tokens, hashes, or mutation evidence.
- Preserve keyboard access, mobile layout, bounded queries, deterministic cursor ordering, and full-Admin authorization.
- Follow strict RED/GREEN development and stop at the user-controlled merge gate.

---

## File Structure

- Create `lib/admin/user-directory-query-contract.ts`: dependency-free browser-safe allowlists, async Web Crypto query normalizer/parser/fingerprint owner, canonical User-ID grammar, and versioned cursor codec.
- Create `lib/admin/user-directory-navigation.ts`: browser-safe async URL builder and fixed-origin return-URL sanitizer consuming the query contract.
- Modify `lib/admin/user-directory.ts`: consume the query contract while retaining Prisma predicates, database operations, safe row counts, and stale-cursor fallback.
- Modify `app/admin/users/page.tsx`: queue controls, context-carrying detail links, privacy-safe badges.
- Modify `app/admin/users/[userId]/page.tsx`: validated return link and section-link context preservation.
- Modify `app/admin/page.tsx`: metric cards become canonical queue links.
- Modify `tests/admin-user-directory.test.mjs`, `tests/admin-dashboard.test.mjs`, `tests/admin-user-detail.test.mjs`, `tests/admin-security-ui.test.mjs`, `tests/admin-user-operations-fixture.test.mjs`, and `tests/browser/admin-user-operations.spec.ts`.
- Create `tests/types/admin-user-directory-query-contract.ts` and `tsconfig.admin-user-directory-contract.json`: tracked compile-fail fixture/config that executes the `@ts-expect-error` public-boundary contract.
- Create `tests/browser/user-directory-query-contract.browser.spec.ts`: tracked browser-graph fixture that imports and executes the shared Web Crypto contract.
- Create `scripts/verify-admin-user-directory-browser-contract.mjs`: repository-owned compiler/bundler runner that rejects Node builtins and server-only imports in the emitted browser graph.
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
  queryFingerprint: AdminUserQueryFingerprint
}

declare const preparedAdminDirectoryNonCursorQueryBrand: unique symbol // type-only; no exported constructible runtime value
export type PreparedAdminDirectoryNonCursorQuery = {
  readonly [preparedAdminDirectoryNonCursorQueryBrand]: true
} // owner-created nominal handle; payload lives only in a module-private WeakMap

declare const adminUserQueryFingerprintBrand: unique symbol
export type AdminUserQueryFingerprint = string & {
  readonly [adminUserQueryFingerprintBrand]: true
}

export async function computeAdminUserDirectoryQueryFingerprint(
  input: Omit<AdminDirectoryNavigationQuery, "cursor" | "queryFingerprint">,
): Promise<AdminUserQueryFingerprint>

export async function prepareAdminDirectoryNonCursorQuery(
  input: unknown,
): Promise<PreparedAdminDirectoryNonCursorQuery> // registers WeakMap<handle,{normalizedQuery,fingerprint}> after validation

export async function parseUserDirectoryQuery(
  input: URLSearchParams | Readonly<Record<string, string | readonly string[] | undefined>>,
): Promise<AdminDirectoryNavigationQuery>

export type ParsedAdminUserCursor = {
  token: string
  accountId: CanonicalAdminUserId
  queryFingerprint: AdminUserQueryFingerprint
}

export function encodeAdminUserCursor(value: {
  accountId: CanonicalAdminUserId
  queryFingerprint: AdminUserQueryFingerprint
}): ParsedAdminUserCursor
export function decodeAdminUserCursor(value: {
  token: string
  expectedQueryFingerprint: AdminUserQueryFingerprint
}): ParsedAdminUserCursor

export async function buildAdminUserDirectoryHref(
  query: PreparedAdminDirectoryNonCursorQuery,
  cursor: ParsedAdminUserCursor | null,
): Promise<string>

export async function sanitizeAdminUserDirectoryReturnTo(
  value: string | null | undefined,
): Promise<string>

export function parseCanonicalAdminUserId(value: unknown): CanonicalAdminUserId
export function parseAdminUserQueryFingerprint(value: unknown): AdminUserQueryFingerprint
```

- [ ] **Step 1: Add RED URL tests**

Add boundary tests proving Server Components/routes/helpers use direct `await`, Client Component render functions remain synchronous and call no async query/navigation helper, and only `async` click/change/submit handlers await the helper before `router.push`/`replace` or state updates. Reject Promise-valued href/state, async Client Component render, and navigation/state mutation before resolution.

Define cursor bytes independently of object enumeration accidents. Encoder runtime-validates the exact canonical User ID and lowercase 64-hex fingerprint, creates a fresh object by assigning `v = 1`, then `accountId`, then `queryFingerprint`, runs standard `JSON.stringify` with no replacer/space, UTF-8 encodes that exact string, and emits RFC 4648 URL-safe base64 without `=` padding. Standard JSON escaping is authoritative: quotes, reverse solidus, and JSON control characters use `JSON.stringify` escapes; other valid Unicode scalar values, including non-ASCII and surrogate-pair characters, remain standard JSON string content and UTF-8 encode normally; lone surrogates and invalid IDs/fingerprints reject at their public validators.

Decoder first requires `^[A-Za-z0-9_-]+$` and rejects any `=`, then base64url-decodes once and UTF-8-decodes fatally. It parses JSON and requires a non-array ordinary object with exactly three own enumerable keys in exact order `v`, `accountId`, `queryFingerprint`; `v` is the number `1`, and the other two are strings passing their runtime validators and expected-fingerprint equality. It reconstructs the canonical object in the mandated insertion order, `JSON.stringify`/UTF-8 encodes it, and byte-compares those bytes with the originally decoded bytes. It then unpadded-base64url re-encodes the canonical bytes and requires exact token equality. Thus semantically equivalent encodings are rejected, including padding, alternate property order, whitespace, duplicate/extra keys, escaped-vs-literal Unicode equivalents, `\u` spellings where `JSON.stringify` emits the literal character, and alternate slash/control escapes.

Add shared Node and real-Chromium RED/golden vectors. One accepted vector must spell its exact canonical JSON string, UTF-8 hex bytes, and unpadded token for a representative validated account ID plus a 64-lowercase-hex fingerprint, and assert encode/decode/re-encode byte/token identity. Add an escaping vector containing only characters allowed by the audited ID grammar if that grammar admits them; otherwise directly unit-test the private canonical JSON byte helper with quotes, reverse solidus, controls, BMP non-ASCII, and a surrogate-pair scalar while public cursor validation still rejects invalid IDs. For every accepted vector, generate rejected variants with `=`, whitespace around separators, order `accountId,v,queryFingerprint`, duplicate `accountId`, an extra key, `v:1.0`, alternate `\uXXXX` versus literal Unicode, escaped `/`, malformed UTF-8, and one/two-layer base64url wrapping. Tests must prove rejection happens before transaction/query work.

Assert `user-directory-query-contract.ts` is the single source for the parser, normalizers, Web Crypto fingerprint owner, cursor codec, canonical User-ID validator, and form/serializer sort/role/status allowlists. Both `user-directory-navigation.ts` and server-only `user-directory.ts` import that dependency-free contract; the contract/navigation import graph must not contain `node:crypto`, `@prisma/client`, `server-only`, `next/headers`, `lib/prisma`, auth, billing, database adapters, or any transitive Node/server-only module. `node scripts/verify-admin-user-directory-browser-contract.mjs` compiles/bundles tracked `tests/browser/user-directory-query-contract.browser.spec.ts`, inspects the emitted browser dependency graph, then executes it in Chromium so real `globalThis.crypto.subtle` runs; a Node/server-only edge or browser failure is blocking. Prisma predicates and database operations remain exclusively in `user-directory.ts`. The async preparation owner normalizes/fingerprints raw noncursor input, rejects every unknown own key including `cursor` and `queryFingerprint`, and returns only a module-private-registry-backed `PreparedAdminDirectoryNonCursorQuery`; a plain object, clone/spread, or cast fails runtime verification. The awaited builder accepts only that opaque prepared handle plus one required explicit `ParsedAdminUserCursor | null`. `npx tsc -p tsconfig.admin-user-directory-contract.json --noEmit` executes tracked `tests/types/admin-user-directory-query-contract.ts`, including `@ts-expect-error` assertions proving a full `AdminDirectoryNavigationQuery` cannot satisfy the private brand or provide two cursor sources; JavaScript tests reject the same full object and forged/cloned handles. Canonical order remains `q`, filters, non-default sort, `pageSize`, then exactly one explicit cursor. Assert awaited parse -> prepare noncursor -> build -> parse is idempotent and no unresolved Promise is accepted.

Assert the sanitizer parses against one hard-coded inert origin such as `https://admin-navigation.invalid`, requires the raw input to begin with exactly one `/`, and then requires the parsed origin and `pathname === "/admin/users"` to match. It rejects credentials, host/origin changes, raw C0/DEL control characters, backslashes, encoded separators in the authority/path portion, fragments, duplicate singleton parameters, and every direct/double-encoded form below:

The bounded encoded-separator hazard scan is limited to the raw/decoded authority and pathname layers before `?`/`#`; it never rejects `%2F`, `%3A`, or their canonical encodings merely because they occur inside `q` or another allowlisted query value. Tests accept and round-trip `/admin/users?q=neck%2Fshoulder%3Aleft&pageSize=25` through the shared parser/builder while the same encoded slash/colon in authority or pathname, including double-encoded forms, remains rejected.

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
  "/admin/users#billing_reconciliation",
  "/admin/users%23billing_reconciliation",
  "/admin/users%2523billing_reconciliation",
  "/admin/users?q=x#billing_reconciliation",
  "/admin/users?queue=unresolved&queue=billing_reconciliation",
  "/admin/users?queue=unresolved%26queue%3Dbilling_reconciliation",
  "/admin/users?queue=unresolved%2526queue%253Dbilling_reconciliation",
  "/admin/users?pageSize=25&pageSize=50",
  "/admin/users?sort=account_asc&sort=account_desc",
  "/admin/users?q=x&q=y",
  "https://user:pass@admin-navigation.invalid/admin/users",
  "//user:pass@evil.example/admin/users",
  "/%2f%2fuser%3apass%40evil.example/admin/users",
  "/%252f%252fuser%253apass%2540evil.example/admin/users",
  "/admin/users?x=https://user:pass@evil.example",
  "/admin/users?x=https%3A%2F%2Fuser%3Apass%40evil.example",
  "/admin/users?x=https%253A%252F%252Fuser%253Apass%2540evil.example",
  "/admin/users?unknown=secret",
  "javascript:alert(1)",
]) {
  assert.equal(await sanitizeAdminUserDirectoryReturnTo(unsafe), "/admin/users")
}

for (const codePoint of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
  const rawControl = String.fromCodePoint(codePoint)
  assert.equal(await sanitizeAdminUserDirectoryReturnTo(`/admin/users${rawControl}?q=x`), "/admin/users")
  assert.equal(await sanitizeAdminUserDirectoryReturnTo(`/admin/users?q=x${rawControl}`), "/admin/users")
}
```

Before choosing the ID validator, audit the `User.id` schema declaration, Prisma's actual `cuid()` generator output for the repository-pinned version, every Production creation/Auth-adapter/import path, and a sanitized aggregate of current Production IDs (length/character-class/version counts only; never log IDs). Record the resulting canonical grammar and its compatibility rationale in the Admin runbook. Do not assume that the schema default constrains explicitly supplied IDs or impose an arbitrary CUID regex. Enforce the audited exact runtime grammar through `parseCanonicalAdminUserId(unknown)` at every public encoder/decoder/builder boundary; runtime authority is either that grammar check on every call or a module-private registry with no exported constructor/brand/registration hook. Type erasure is never authority. Tests include representative generated IDs and every sanitized historical/imported class found by the audit, plus empty, overlong, control/whitespace, invalid-Unicode, and out-of-grammar cases. Direct JavaScript calls, `as CanonicalAdminUserId` strings, spread/structured clones, and plain objects reject unless the actual runtime string satisfies the audited grammar. If current IDs cannot be classified safely, stop for a migration/compatibility decision before cursor validation ships.

Assert unsupported queue values are omitted, unsupported sort values become `account_asc`, and cursor may be stripped independently. Fingerprints use one exact byte grammar. Normalize accepted strings to Unicode NFC and reject lone surrogates; serialize UTF-8 in fixed order `v`, `q`, `emailVerified`, `role`, `roleStatus`, `subscriptionStatus`, `creditState`, `temporaryAccess`, `unresolvedIssue`, `queue`, `sort`, `pageSize`. Each field is ASCII name, `=`, decimal UTF-8 byte length, `:`, raw UTF-8 value bytes, then LF. `v=1`, default `sort=account_asc`, and default `pageSize=25` are always present; empty `q` is present with length zero; an omitted nullable filter is the one-byte value `-`; unknown or duplicate keys reject. Decimal page size has no sign/leading zeros. JSON, percent encoding, locale rules, whitespace folding, and platform newlines never participate. Hash those bytes with Web Crypto SHA-256 and encode exactly 64 lowercase hex characters. Golden vectors shared byte-for-byte by browser/server cover defaults and omitted filters, explicit empty search, composed/decomposed Unicode producing identical NFC bytes, every populated filter, non-default sort/page size, delimiter-like values, and duplicate rejection. Replace the obsolete `pageSize=25` shorthand vector with the digest calculated from the complete grammar.

`parseAdminUserQueryFingerprint(unknown)` validates `^[0-9a-f]{64}$` at every public encoder/decoder/builder boundary. The encoder and decoder likewise call `parseCanonicalAdminUserId`; no TypeScript cast is authority. Prove direct JavaScript calls, cast strings, clones/plain objects, uppercase/short/long/non-hex fingerprints, malformed IDs, invalid base64url, padding, duplicate/unknown JSON fields, noncanonical JSON/re-encoding, double encoding, wrong version, and query mismatch reject before database work. Valid encoding still uses exact field-order JSON `{ "v": 1, "accountId": ..., "queryFingerprint": ... }`, UTF-8, and unpadded base64url once.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/admin-user-directory.test.mjs`

Also run the tracked type and real browser-graph contracts:

```bash
npx tsc -p tsconfig.admin-user-directory-contract.json --noEmit
node scripts/verify-admin-user-directory-browser-contract.mjs
```

Expected: FAIL because the navigation module and queue field do not exist.

- [ ] **Step 3: Implement stable query serialization**

Use `URLSearchParams`; allow only documented singleton fields and reject duplicates before reading values. Apply the exact NFC/UTF-8 length-prefixed canonical byte grammar in browser and server. Hazard-inspect at most two decoded authority/path layers, stopping at `?`/`#`; reject malformed/control/backslash/origin/path hazards there, but preserve valid encoded slash/colon in allowlisted query values. Reject fragments and credential-bearing or duplicate-singleton direct/double-encoded return targets. Never turn decoded query text into route authority. Normalize one noncursor value, await its fingerprint, decode one cursor, and call the builder with exactly one explicit cursor/null. Every public codec/builder call runtime-validates IDs, fingerprints, and prepared handles despite JavaScript calls or TypeScript casts.

- [ ] **Step 4: Implement stale-cursor stripping**

The sanitizer accepts a valid cursor, but expose a helper or builder option to return the same canonical query without `cursor`. This is used after the directory proves a cursor no longer identifies a usable page.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/admin-user-directory.test.mjs`

Expected: PASS for safe serialization and external/malformed URL rejection.

- [ ] **Step 6: Commit the navigation contract**

```bash
git add lib/admin/user-directory-query-contract.ts lib/admin/user-directory-navigation.ts tests/admin-user-directory.test.mjs tests/types/admin-user-directory-query-contract.ts tsconfig.admin-user-directory-contract.json tests/browser/user-directory-query-contract.browser.spec.ts scripts/verify-admin-user-directory-browser-contract.mjs
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
- Consumes and awaits: `buildAdminUserDirectoryHref` and `sanitizeAdminUserDirectoryReturnTo`.
- Adds detail query parameter `returnTo`, whose value is the encoded canonical internal directory path.

- [ ] **Step 1: Add RED source and compiled-page tests**

Require desktop and mobile account links to include one validated return path. Require detail's Back link to use the sanitized path and section tabs to preserve it. Assert external return values render `/admin/users`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/admin-user-directory.test.mjs tests/admin-user-detail.test.mjs`

Expected: FAIL because links currently hardcode the detail path and `/admin/users` back link.

- [ ] **Step 3: Build one canonical current directory URL**

In `AdminUserDirectoryPage`, await parsing and build the current URL from the parsed query, selected sort, and effective cursor. Pass the resolved string to `AccountIdentity`; create the detail href with `URLSearchParams` rather than string concatenation.

- [ ] **Step 4: Validate return context in detail**

Read one `returnTo` string from `searchParams`, await its sanitizer, and use the resolved string for Back. Extend `sectionHref` so switching detail sections retains the same canonical return path.

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

Compute each dashboard queue metric as a deduplicated account count from the exact exported `queueWhere(queue, requestNow)` predicate. Each request owner captures its own `requestNow` exactly once: all dashboard metrics share the dashboard request time, while directory filtering and row evidence share the directory request time; deterministic predicate/count tests inject the same time. Await the shared URL builder for dashboard metrics and a directory queue select/chip group; never pass its unresolved Promise into an href. Add a two-option sort select (`Account ID ascending`, `Account ID descending`) whose values, together with role and status controls, come from the browser-safe contract rather than route-local duplicate arrays. Show the active queue in the page heading/summary without trusting raw query text.

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
- Modify: `tests/browser/user-directory-query-contract.browser.spec.ts`
- Modify: `tests/types/admin-user-directory-query-contract.ts`
- Modify: `tsconfig.admin-user-directory-contract.json`
- Modify: `scripts/verify-admin-user-directory-browser-contract.mjs`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify: `docs/wiki/admin-user-operations.md`
- Modify: `docs/wiki/release-checklist.md`

**Interfaces:**
- Consumes: completed activation/browser database gate from Branch 3.
- Produces: desktop/mobile proof of queue navigation and context restoration.

- [ ] **Step 1: Add browser RED coverage**

Using deterministic fixture rows, including multiple matching records for one account, open a resolved dashboard queue link, assert its deduplicated per-user metric, canonical active filter/default serialization, and safe badges, navigate to detail, switch sections, and activate Back. Assert the URL restores queue/search/page-size/sort context. Add unsafe `returnTo` cases and require `/admin/users`. Source/compiled tests prove Server Components/routes/helpers and async Client event handlers await parser/fingerprint/builder/sanitizer Promises before navigation/state, while Client render remains synchronous and consumes resolved values; the browser-targeted graph contains no Node/server-only dependency.

- [ ] **Step 2: Add keyboard and mobile assertions**

Focus and activate metric/detail/back links by keyboard. Assert no horizontal overflow in desktop or mobile projects and no raw failure/provider evidence in rendered text or hrefs.

- [ ] **Step 3: Run source/focused browser contracts**

```bash
node --test tests/admin-user-directory.test.mjs tests/admin-dashboard.test.mjs tests/admin-user-detail.test.mjs tests/admin-user-operations-fixture.test.mjs tests/browser-qa-harness.test.mjs
npx tsc -p tsconfig.admin-user-directory-contract.json --noEmit
node scripts/verify-admin-user-directory-browser-contract.mjs
```

Expected: PASS after implementation.

- [ ] **Step 4: Run real disposable browser QA**

Use Branch 3's pinned browser-acceptance owner with its exact disposable Neon identity gate and SMTP-blank Playwright-owned server:

```bash
npm run admin:operations:browser-acceptance
```

Expected canonical QA evidence sequence: `parent_trusted_identity -> orphan_scan -> parent_data_safety -> receipt_lease_capture -> qa_trusted_identity -> inherited_data_safety -> migration_status -> migration_deploy -> qa_post_status -> fixture_provenance -> fixture_state -> smtp_isolation -> billing_mutation_guard_armed -> server_ownership -> qa_sentinel -> browser_desktop -> browser_mobile -> billing_zero_mutation -> scratch_cleanup -> fixture_cleanup -> branch_deleted`. The outer owner records stable capture authority before child identity, binding parent/child targets, immutable receipt, lease, run, and creation order. After long-running setup, `server_ownership` binds the stable authority digest plus launch/process tree/current build manifest and `qa_sentinel` binds the live QA target/run; then fresh trusted-control-plane re-verification of the unchanged registered authority produces one short-lived receipt-verification ref immediately before `browser_desktop`. Both browsers share the renewal ref byte-identically and bind identical fixture-state, SMTP-isolation, billing-guard, server-ownership, and sentinel refs/digests; the renewal remains within five minutes through both envelope constructions and QA completion. Fixture loading, tree exit, deletion, and absence retain their established operational boundaries without adding check aliases.

Add failure/throw/timeout rows for receipt capture/renewal, every gate, `server_ownership`, `qa_sentinel`, browsers/tree/zero/scratch, fixture cleanup, deletion, and absence. Fake-clock/long-run/renewal/replay tests reject arbitrary renewal input, changed lease/target/run/creation order, chain substitution, old-envelope expiry, clock rollback, cross-completion/third-use replay, expiry between viewports or before completion, forged/cross-run/tree/build/sentinel proofs, and mismatched viewport refs. Row cleanup requires tree safety; deletion/absence remain unconditional post-capture.

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
git add tests/browser/admin-user-operations.spec.ts tests/browser/user-directory-query-contract.browser.spec.ts tests/types/admin-user-directory-query-contract.ts tsconfig.admin-user-directory-contract.json scripts/verify-admin-user-directory-browser-contract.mjs tests/admin-user-operations-fixture.test.mjs docs/project-state.md docs/project-log.md docs/wiki/admin-user-operations.md docs/wiki/release-checklist.md
git commit -m "docs: record admin queue navigation evidence"
```

- [ ] **Step 10: Complete the PR loop**

Push/open a ready PR, wait for hosted QA/CodeQL/Vercel/CodeRabbit, verify every exact-head finding, fix valid issues with RED/GREEN evidence, resolve threads, obtain a fresh clean review, and stop at the user merge gate.
