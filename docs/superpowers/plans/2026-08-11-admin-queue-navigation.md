# Admin Queue Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn existing Admin metrics into privacy-safe actionable queues and preserve validated directory context when an Admin opens and returns from account detail.

**Architecture:** Add a pure browser-safe queue/navigation contract that owns queue names, query serialization, and internal return-URL validation. Extend the existing bounded directory query with canonical attention filters, derive dashboard links and row badges from the same predicates/counts, and carry a signed-by-validation internal return path into detail without treating cursor state as authority.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Prisma 7, URLSearchParams, Node test runner, Playwright.

## Global Constraints

- This branch is read-only except for URL/navigation state; it adds no mutation authority.
- Preserve search, supported filters, queue, and page size in return navigation.
- Preserve the directory's supported deterministic sort. This branch exposes `account_asc` and `account_desc`; every cursor query must use the selected ID direction consistently.
- A cursor is navigation context only. If stale, fall back to the first page while retaining safe non-cursor filters.
- Reject absolute, protocol-relative, encoded-external, malformed, and unsupported return URLs.
- Canonical queues: billing reconciliation, failed notification, commerce review, temporary access expiring within 30 days, and broader unresolved.
- Use one captured request time for queue filters and metrics; the temporary-expiry endpoint is exclusive.
- Expose only safe type badges/counts. Never include provider IDs, raw failure messages, payment instruments, internal notes, tokens, hashes, or mutation evidence.
- Preserve keyboard access, mobile layout, bounded queries, deterministic cursor ordering, and full-Admin authorization.
- Follow strict RED/GREEN development and stop at the user-controlled merge gate.

---

## File Structure

- Create `lib/admin/user-directory-navigation.ts`: pure queue definitions, URL builder, and return-URL sanitizer.
- Modify `lib/admin/user-directory.ts`: queue parser/predicates, safe row counts, stale-cursor fallback.
- Modify `app/admin/users/page.tsx`: queue controls, context-carrying detail links, privacy-safe badges.
- Modify `app/admin/users/[userId]/page.tsx`: validated return link and section-link context preservation.
- Modify `app/admin/page.tsx`: metric cards become canonical queue links.
- Modify `tests/admin-user-directory.test.mjs`, `tests/admin-dashboard.test.mjs`, `tests/admin-user-detail.test.mjs`, and `tests/browser/admin-user-operations.spec.ts`.
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

export type AdminDirectoryNavigationQuery = {
  query: string
  pageSize: number
  cursor: string | null
  sort: "account_asc" | "account_desc"
  emailVerified: "verified" | "unverified" | null
  role: string | null
  roleStatus: "verified" | "pending" | "rejected" | "revoked" | null
  subscriptionStatus: string | null
  creditState: "positive" | "zero" | null
  temporaryAccess: "active" | "none" | null
  unresolvedIssue: "yes" | "no" | null
  queue: AdminUserQueue | null
}

export function buildAdminUserDirectoryHref(
  query: AdminDirectoryNavigationQuery,
  cursor?: string | null,
): string

export function sanitizeAdminUserDirectoryReturnTo(value: string | null | undefined): string
```

- [ ] **Step 1: Add RED URL tests**

Assert the builder produces a stable `/admin/users?...` query preserving all supported fields, `sort`, and page size. Assert the sanitizer accepts only a normalized internal `/admin/users` URL and rejects:

```js
for (const unsafe of [
  "https://evil.example/admin/users",
  "//evil.example/admin/users",
  "/admin/users/target-id",
  "/admin/users?returnTo=https%3A%2F%2Fevil.example",
  "/admin/users?unknown=secret",
  "javascript:alert(1)",
]) {
  assert.equal(sanitizeAdminUserDirectoryReturnTo(unsafe), "/admin/users")
}
```

Assert unsupported queue values are omitted, unsupported sort values become `account_asc`, and cursor may be stripped independently.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/admin-user-directory.test.mjs`

Expected: FAIL because the navigation module and queue field do not exist.

- [ ] **Step 3: Implement stable query serialization**

Use `URLSearchParams`; allow only the fields in `AdminDirectoryNavigationQuery`. Require `pathname === "/admin/users"`, no origin/host, and round-trip parse every parameter through the directory parser before rebuilding the canonical URL.

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

- [ ] **Step 1: Add exact parser and query RED tests**

For each queue, assert exact Prisma `where` shape in both forward and previous-cursor queries. Run the cases with `account_asc` and `account_desc`; require the `orderBy`, cursor boundary, next cursor, and previous cursor to use the same selected direction:

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

- [ ] **Step 4: Implement one-clock queue predicates**

Capture `requestNow` once in the page and pass it to both metrics and directory. Add `queueWhere(queue, now)` that reuses existing predicate owners and the exact exclusive temporary window.

- [ ] **Step 5: Extend the bounded select**

Add relation counts only; do not select operation rows or provider fields. Map missing optional counts to zero without fabricating totals.

- [ ] **Step 6: Add stale-cursor fallback**

If a supplied cursor produces zero visible rows and no previous rows under the current safe filters/sort, rerun only the first bounded page with the same non-cursor query and return `cursorReset: true`. Do not recursively retry or broaden filters.

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
- Consumes: canonical queue URLs from Task 1 and row attention counts from Task 2.
- Produces: keyboard-accessible queue links and safe badges.

- [ ] **Step 1: Add dashboard RED tests**

Require metric links:

```js
assert.equal(queueLinks.billing, "/admin/users?queue=billing_reconciliation&pageSize=25")
assert.equal(queueLinks.failedEmail, "/admin/users?queue=failed_notification&pageSize=25")
assert.equal(queueLinks.commerce, "/admin/users?queue=commerce_review&pageSize=25")
assert.equal(queueLinks.expiring, "/admin/users?queue=temporary_expiring&pageSize=25")
assert.equal(queueLinks.unresolved, "/admin/users?queue=unresolved&pageSize=25")
```

Update metrics if needed so failed notification and commerce counts are separately available while preserving the aggregate unresolved count.

- [ ] **Step 2: Add directory badge RED tests**

Require only nonzero badges with plain labels such as `Billing recovery 2`, `Failed notification 1`, `Commerce review 3`, and `Temporary expiring 1`. Assert badge markup contains no operation/provider identifiers.

- [ ] **Step 3: Run focused UI tests and verify RED**

Run: `node --test tests/admin-dashboard.test.mjs tests/admin-user-directory.test.mjs`

Expected: FAIL because dashboard stats are not links and rows expose only one combined count.

- [ ] **Step 4: Render queue links and filters**

Use the shared URL builder for dashboard metrics and a directory queue select/chip group. Add a two-option sort select (`Account ID ascending`, `Account ID descending`) whose values come from the parser allowlist. Show the active queue in the page heading/summary without trusting raw query text.

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

Using deterministic fixture rows, open a dashboard queue link, assert the canonical active filter and safe badges, navigate to detail, switch sections, and activate Back. Assert the URL restores the queue/search/page-size context. Add an invalid external `returnTo` navigation and assert Back points to `/admin/users`.

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

Review exact predicate/count agreement, time boundaries, forward/previous/stale cursor behavior, open-redirect resistance, privacy exclusions, responsive keyboard UX, and absence of new mutation authority.

- [ ] **Step 9: Commit docs and browser evidence**

```bash
git add tests/browser/admin-user-operations.spec.ts tests/admin-user-operations-fixture.test.mjs docs/project-state.md docs/project-log.md docs/wiki/admin-user-operations.md docs/wiki/release-checklist.md
git commit -m "docs: record admin queue navigation evidence"
```

- [ ] **Step 10: Complete the PR loop**

Push/open a ready PR, wait for hosted QA/CodeQL/Vercel/CodeRabbit, verify every exact-head finding, fix valid issues with RED/GREEN evidence, resolve threads, obtain a fresh clean review, and stop at the user merge gate.
