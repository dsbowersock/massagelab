# Admin Background Credit Grants Intent

## Requested outcome

Complete Branch 6 of the approved Admin User Operations program: add positive-only Admin background-credit goodwill grants to the canonical commerce ledger, then expose confirmed preview controls in the target account's Access section.

## Scope and non-goals

- Scope: `grantAdminBackgroundCredits()`, route-local Admin action and controls, bounded Access/Activity refresh, disposable desktop/mobile QA contracts, focused tests, and current Admin operations documentation.
- Non-goals: subtracting credits, setting an exact balance, changing redemption/ownership semantics, adding a second wallet or audit owner, changing membership entitlements, applying real database mutations, or starting Branch 7.
- Risk hints: stale-balance concurrency, idempotent replay, atomic wallet/ledger/commerce/audit evidence, fresh full-Admin authority, self-target behavior, and post-commit notification truth.

## Baseline read set and usage

- Required and acknowledged: refreshed `origin/main` project state/log/wiki index; Admin user operations wiki; Branch 6 plan Tasks 14-15; `lib/commerce/credit-service.ts`; shared commerce transaction, Admin access, operation bundle, account-detail, email-intent, fixture, and browser owners.
- Baseline commit: `93d21f591ed17427997d60e2ac6da92ffec98116`, merge commit for PR #176.
- Missing baseline refs: none.

## Impact statement

The change extends the existing verified-user wallet and immutable Admin evidence owners. It does not introduce a new persistence model or entitlement path. The grant is a positive integer from 1 through 25, uses optimistic wallet version/balance evidence, and stays atomic with its ledger entry, commerce event, Admin action, target activity, and email intent.

## Execution readiness view

- Intent lock: Admin goodwill adds credits only.
- Scope fence: Branch 6 Tasks 14-15 only.
- Owner lock: canonical wallet/ledger, `runCommerceTransaction()`, fresh Admin access, `recordAdminActionBundle()`, and locked post-commit email delivery.
- Compatibility boundary: existing initial grants, redemption, ownership, and membership behavior remain unchanged.
- Task batches: Task 14 service; Task 15 action/UI/browser/docs.
- Test obligation: strict RED/GREEN, two-stage review per task, whole-branch review, focused/full/type/lint/build/diff gates.
- Stop: pause for a new owner/schema/product decision, missing disposable browser database authority, or user-controlled PR merge.

## Slice cards

### Task 14

- Goal: add positive-only Admin credit grants in one serializable transaction.
- Parent plan/spec: `docs/superpowers/plans/2026-08-08-admin-user-operations-program.md`, Branch 6 Task 14.
- Files: `lib/commerce/credit-service.ts`, `tests/admin-background-credit-grant.test.mjs`.
- Boundary: no UI, schema, negative adjustment, or exact-balance operation.
- Verification: focused grant/service/redemption tests, typecheck, lint, diff check, then spec and quality review.
- Stop: commit only after both reviews approve.

### Task 15

- Goal: add previewed, confirmed, full-Admin goodwill controls to Access and Activity.
- Parent plan/spec: same parent plan, Branch 6 Task 15.
- Files: route action/form/page, browser spec/fixture only as necessary, focused UI tests, state/log/wiki.
- Boundary: presets plus integer 1-25 input; no subtract/set-balance control and no real email/database mutation.
- Verification: focused UI/commerce tests, browser source contracts or authorized disposable run, typecheck, lint, full unit/build/diff, two-stage review.
- Stop: PR merge gate before Branch 7.
