# Admin Queue Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn existing Admin metrics into privacy-safe actionable queues and preserve validated directory context when an Admin opens and returns from account detail.

**Architecture:** Add a pure browser-safe queue/navigation contract that owns queue, sort, role, and status allowlists, canonical query serialization, and fixed-origin internal return-URL validation. Extend the existing bounded directory query with canonical attention filters and direction-aware cursor traversal; run cursor usability, visible-page, and reverse-lookback reads in one consistent read transaction/snapshot so concurrency cannot mix navigation states. Derive deduplicated per-user dashboard counts and row badges from the same predicates, and carry a signed-by-validation internal return path into detail without treating cursor state as authority.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Prisma 7, URLSearchParams, Node test runner, Playwright.

## Global Constraints

- This branch is read-only except for URL/navigation state; it adds no mutation authority.
- Preserve search, supported filters, queue, and page size in return navigation.
- Preserve the directory's supported deterministic sort. This branch exposes `account_asc` and `account_desc`; forward boundaries, reverse-lookback queries, result reversal, and emitted next/previous cursors must all follow the selected ID direction.
- A cursor is navigation context only. Before using it in a page query, prove that it decodes to an existing account still matched by the current safe filters. If missing, deleted, or filtered out, fall back once to the first page while retaining safe non-cursor filters.
- Cursor usability, first/forward page selection, and any previous-page lookback must share one repeatable consistent read snapshot. Concurrent deletion or filter-state changes cannot let validation and page evidence observe different database states.
- Reject absolute, protocol-relative, encoded-external, malformed, and unsupported return URLs.
- Canonical queues: billing reconciliation, failed notification, commerce review, temporary access expiring within 30 days, and broader unresolved.
- Use one captured request time for queue filters and metrics; the temporary-expiry endpoint is exclusive.
- Expose only safe type badges/counts. Never include provider IDs, raw failure messages, payment instruments, internal notes, tokens, hashes, or mutation evidence.
- Preserve keyboard access, mobile layout, bounded queries, deterministic cursor ordering, and full-Admin authorization.
- Follow strict RED/GREEN development and stop at the user-controlled merge gate.

---

## File Structure

- Create `lib/admin/user-directory-navigation.ts`: pure browser-safe queue/sort/role/status definitions, URL builder, and fixed-origin return-URL sanitizer.
- Modify `lib/admin/user-directory.ts`: queue parser/predicates, safe row counts, stale-cursor fallback.
- Modify `app/admin/users/page.tsx`: queue controls, context-carrying detail links, privacy-safe badges.
- Modify `app/admin/users/[userId]/page.tsx`: validated return link and section-link context preservation.
- Modify `app/admin/page.tsx`: metric cards become canonical queue links.
- Modify `tests/admin-user-directory.test.mjs`, `tests/admin-dashboard.test.mjs`, `tests/admin-user-detail.test.mjs`, `tests/admin-security-ui.test.mjs`, `tests/admin-user-operations-fixture.test.mjs`, and `tests/browser/admin-user-operations.spec.ts`.
- Modify canonical state/log/Admin runbook/release checklist.

### Task 1: Define canonical queue and return-URL contracts

**Files:**
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

export type AdminDirectoryNavigationQuery = {
  query: string
  pageSize: number
  cursor: string | null
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

export function buildAdminUserDirectoryHref(
  query: AdminDirectoryNavigationQuery,
  cursor?: string | null,
): string

export function sanitizeAdminUserDirectoryReturnTo(value: string | null | undefined): string
```

- [ ] **Step 1: Add RED URL tests**

Assert the browser-safe contract is the single source for parser, form-option, and serializer sort/role/status values; server-only Prisma code may consume these types but the navigation module must not import `@prisma/client`. Assert the builder produces a stable `/admin/users?...` query preserving all supported non-default fields and page size. Canonical serialization always includes `pageSize`, omits empty fields and the default `sort=account_asc`, emits `sort=account_desc` only when selected, and uses this fixed order: `q`, `emailVerified`, `role`, `roleStatus`, `subscriptionStatus`, `creditState`, `temporaryAccess`, `unresolvedIssue`, `queue`, non-default `sort`, `pageSize`, `cursor`. Assert parse -> build -> parse is idempotent.

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

Assert unsupported queue values are omitted, unsupported sort values become `account_asc`, and cursor may be stripped independently.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/admin-user-directory.test.mjs`

Expected: FAIL because the navigation module and queue field do not exist.

- [ ] **Step 3: Implement stable query serialization**

Use `URLSearchParams`; allow only the fields in `AdminDirectoryNavigationQuery`. Before canonical parsing, perform a bounded hazard inspection of the raw string and at most two successful `decodeURIComponent` layers. At every inspected layer reject malformed percent encoding, `\u0000-\u001f`/`\u007f`, backslashes, credentials, absolute/protocol-relative origins, or a path other than exactly `/admin/users`; after the second layer, reject any remaining percent sequence that could decode into a control, slash, backslash, colon, or authority delimiter. This inspection never turns decoded query text into canonical state: after it passes, parse the original input once against the fixed inert origin, reject any origin/credential/path ambiguity, and round-trip every parameter through the shared directory parser before rebuilding the canonical URL. Never use a request header or caller-supplied origin as the sanitizer base. The canonical builder uses the documented fixed field order, always emits `pageSize`, omits `account_asc`, includes `account_desc`, and strips unsupported/default values consistently.

- [ ] **Step 4: Implement stale-cursor stripping**

The sanitizer accepts a valid cursor, but expose a helper or builder option to return the same canonical query without `cursor`. This is used after the directory proves a cursor no longer identifies a usable page.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/admin-user-directory.test.mjs`

Expected: PASS for safe serialization and external/malformed URL rejection.

- [ ] **Step 6: Commit the navigation contract**

```bash
git add lib/admin/user-directory-navigation.ts tests/admin-user-directory.test.mjs
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

For each queue, assert exact Prisma `where` shape in forward, cursor-usability, and previous-page lookback queries. Run multi-page cases with `account_asc` and `account_desc` and assert actual returned row order plus next/previous navigation targets, not only `orderBy` objects. The algorithm is explicit:

- `account_asc`: forward rows use `id > cursor` ordered ascending; previous lookback uses `id < cursor` ordered descending, takes at most one page, and derives the earlier forward boundary from that reversed window.
- `account_desc`: forward rows use `id < cursor` ordered descending; previous lookback uses `id > cursor` ordered ascending, takes at most one page, and derives the earlier forward boundary from that reversed window.
- Any rows fetched in the opposite direction for previous-page calculation are private boundary evidence, not a page to expose. Reverse that window into forward order, then derive the earlier forward boundary from it. Keep the established exclusive forward predicates (`>` for ascending, `<` for descending); do not change them to inclusive comparisons. Next cursors come from the last visible row in the selected forward order. Previous cursors must reproduce the immediately preceding page with no gaps or duplicates; the first page emits no previous cursor.

Add an explicit four-page numeric proof with `pageSize=2` and IDs `01` through `08`. Ascending must expose `[01,02]`, `[03,04]`, `[05,06]`, `[07,08]`; page 4's private descending lookback from exclusive cursor `06` is `[05,04]`, which reverses to `[04,05]` and derives earlier forward boundary `04`, so following Previous exposes page 3 `[05,06]` rather than exposing lookback rows. Page 3 similarly derives `02`, and page 2 returns to the cursorless first page. Descending must expose `[08,07]`, `[06,05]`, `[04,03]`, `[02,01]`; page 4's private ascending lookback from exclusive cursor `03` is `[04,05]`, which reverses to `[05,04]` and derives boundary `05`, reproducing page 3 `[04,03]`. Assert all forward and backward targets, and explicitly assert that neither lookback window is returned as visible items.

Make this a complete table-driven matrix across all five queues and both sorts. For every `(queue, sort)` pair, use enough matching deterministic IDs for at least three full pages, traverse forward page 1 -> page 2 -> page 3 using emitted next cursors, then traverse page 3 -> page 2 -> page 1 using emitted previous cursors. Assert each page's exact selected-direction ID order, exact round-trip equality for pages 1 and 2, no gaps, no duplicates, and no previous cursor on the restored first page.

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

Inside one interactive read transaction with a repeatable consistent snapshot, perform the bounded identifier-only cursor-usability lookup, visible-page query, and any previous-page lookback using the same safe `where` filters. Require the decoded account to exist and remain matched before any boundary query. A missing/deleted ID or an account excluded by changed filters/queue is unusable even if other rows exist after it. Strip an unusable cursor, run only the first bounded page in that same snapshot with the same non-cursor query, and return `cursorReset: true`; do not rely on a thrown Prisma cursor error, recursively retry, or broaden filters. Tests must cover malformed cursors (rejected by parsing), nonexistent IDs, deleted rows, filter-changed rows, valid cursors at both sort directions, and a valid cursor whose following page is legitimately empty. Add deterministic concurrency tests that delete the cursor row or change its queue/filter match between the fake lookup and page query; the transaction snapshot must yield one coherent before-state or after-state, never a mixed state, and every read must be asserted against the same transaction client.

```ts
return {
  items,
  nextCursor,
  previousCursor,
  hasPreviousPage,
  cursorReset,
}
```

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

With Branch 3's exact disposable identity variables and SMTP-blank Playwright-owned server:

```bash
npx playwright test tests/browser/admin-user-operations.spec.ts --project=desktop-chromium --project=mobile-chromium
```

Expected: both projects PASS, fixture cleanup PASS, zero billing-goodwill submissions/POSTs. Delete the disposable database and verify absence.

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
