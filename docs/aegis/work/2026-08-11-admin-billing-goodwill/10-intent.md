# Admin Billing Goodwill Intent

## TaskIntentDraft

- Requested outcome: complete Branch 8, the final branch of the approved Admin User Operations program, so full Admin can preview, apply, and reconcile bounded Stripe invoice-credit goodwill with truthful local evidence and explicit production gating.
- Parent plan/spec: `docs/superpowers/plans/2026-08-08-admin-user-operations-program.md` and its source design on the protected `codex/admin-user-operations-program-design` branch, Branch 8 Tasks 19-21.
- Scope: billing-goodwill ledger and migration; injected read-only Stripe preview; bounded apply/reconciliation service; Admin controls, directory/dashboard evidence, browser contracts, and canonical operational docs.
- Stop condition: stop as done only after Tasks 19-21 pass spec and quality review, whole-branch review, terminal local/hosted gates, and the PR is ready for the user-controlled merge. Stop as needs-verification when evidence is unavailable, blocked for a genuine external dependency, or scope-exceeded if a new billing/product contract is required.
- Non-goals: coupons, promotion codes, trials, price changes, renewal changes, payment-method management, raw Stripe payload display, background-credit changes, account impersonation, PHI administration, or any live Stripe mutation without separate explicit authorization.
- Risk hints: fresh full-Admin authority, exact local/Stripe customer and subscription identity, cents/currency signs, idempotency, ambiguous external commits, safe persisted failure codes, reconciliation, post-verification notification, test/live key gating, and zero network access in unit tests.

## BaselineReadSetHint

- `AGENTS.md`
- refreshed `origin/main` at PR #178 merge `c2aaf6979dc3fdb3438aa3dce7e7d3b4f8999ed2`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/wiki/admin-user-operations.md`
- `docs/wiki/billing-memberships.md`
- `docs/wiki/release-checklist.md`
- protected parent Branch 8 plan/design excerpt
- `prisma/schema.prisma`
- existing Admin access, operation bundle, transaction, membership, and Stripe billing owners plus focused tests

## BaselineUsageDraft

- Required refs: all items above.
- Acknowledged: repository instructions, refreshed canonical state/log/wiki, exact Branch 8 Tasks 19-21, worktree state, local-development setup, and predecessor Branch 7 completion.
- Cited by parent plan: ledger schema, read-only preview, injected Stripe adapter, safe apply/reconcile flow, Admin billing controls, production gate, browser QA, and canonical docs.
- Missing refs: none. The parent plan/spec intentionally remains on the protected design branch rather than this implementation branch.
- Decision: continue.

## ImpactStatementDraft

Branch 8 introduces an externally applied monetary credit. Local state must distinguish preparation, verified application, definite pre-mutation failure, and ambiguous reconciliation without inventing success or retrying under a new key. Customer, subscription, currency, amount sign, balance, authority, and live-mode boundaries must fail closed, and no raw Stripe error or payload may be persisted or displayed.

## Execution Readiness View

- Intent lock: bounded invoice-credit goodwill only.
- Scope fence: Branch 8 Tasks 19-21; unrelated billing products and live smoke are excluded.
- Baseline lock: exact PR #178 merged `origin/main` plus the protected parent-plan excerpt.
- Owner constraints: shared Admin authority/evidence bundle and transaction helpers remain authoritative; Stripe is authoritative for customer, subscription, preview, balance transaction, and balance readback.
- Compatibility boundary: existing membership, subscription switching, Checkout, customer portal, tax, background commerce, role, security, credits, and temporary access behavior remains unchanged.
- Retirement boundary: retired `chimer_custom_colors` remains absent from current entitlement decisions.
- Task batches: Task 19 ledger/read-only preview; Task 20 apply/reconcile/live gate; Task 21 Admin UI/metrics/browser/docs/program closure.
- Test obligations: strict RED/GREEN, spec review, quality review, coordinator verification, whole-branch review, Prisma generate/validate, Stripe stubs with no network, focused/adjacent tests, browser gate when authorized, typecheck, lint, full unit, build, diff check, and clean PR loop.
- Drift rule: pause if payment methods, promotions, price/renewal mutation, a second idempotency key, raw provider data, or ungated live mutation appears.

## Slice Card — Task 19

- Goal: add the billing-goodwill operation ledger and a read-only, injected Stripe preview.
- Parent plan/spec: Branch 8 Task 19.
- Files: Prisma schema/migration, `lib/admin/billing-goodwill.ts`, `tests/admin-billing-goodwill.test.mjs`.
- Boundary: no Stripe mutation, reconcile flow, Admin UI, browser execution, email delivery, or live network access.
- Verification: strict RED, focused preview/eligibility tests, Prisma generate/validate, adjacent Admin/Stripe tests, typecheck/lint/diff check, and two-stage review.
- Stop: Task 19 reviewed, verified, and committed, or an authority/schema/Stripe contract conflict requires escalation.
