# Billing Goodwill Reconciliation Correction Intent

## TaskIntentDraft

- Requested outcome: complete Branch 2 of the approved Admin Operations Closure program so an exact Stripe goodwill transaction can verify from immutable transaction evidence after unrelated Customer balance activity, with a final full-Admin authority check before any new provider create.
- Parent design/plan: `docs/superpowers/specs/2026-08-11-admin-operations-closure-design.md` and `docs/superpowers/plans/2026-08-11-billing-goodwill-reconciliation-correction.md`.
- Scope: historical/current balance evidence, provider-boundary Admin authority, truthful operator copy, canonical documentation, comprehensive validation, and the complete PR/review loop.
- Stop condition: stop at the user-controlled merge gate only after every task passes strict TDD, independent spec and quality review, coordinator verification, hosted checks, exact-head CodeRabbit review, valid-finding resolution, and zero unresolved review threads. Stop earlier only for a verified blocker, missing authorization, or scope drift.
- Non-goals: broader eligibility, amount limits, live gates, confirmation contracts, mutation entry points, replacement Stripe operations/idempotency keys, Branch 3 activation, or any live Stripe/payment action.
- Risk hints: immutable provider identity, historical versus current credit semantics, ambiguous provider outcomes, revocation races, privacy-safe errors/copy, idempotent replay, and preservation of the originating Admin evidence bundle.

## BaselineReadSetHint

- `AGENTS.md`
- refreshed `origin/main` at `132b59cdaf8a6b83601c565515cb03640e40b926`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- approved closure design and complete Branch 2 correction plan
- current billing-goodwill service, access owner, actions/form, and focused tests

## BaselineUsageDraft

- Required refs: all items above.
- Acknowledged: all required refs and the prior Branch 8 lifecycle record.
- Missing refs: none.
- Decision: continue.

## ImpactStatementDraft

The current service still derives historical verification from the preview starting balance plus requested amount and omits a separate current Customer observation. That can strand an exact transaction after legitimate intervening provider activity. The correction must preserve every existing financial, authority, idempotency, privacy, and live-mode boundary.

## Execution Readiness View

- Intent lock: exact historical evidence plus separate current observation.
- Scope fence: Branch 2 Tasks 1-4 only; Branch 3 and live payment actions are excluded.
- Baseline lock: exact refreshed `origin/main` merge `132b59cdaf8a6b83601c565515cb03640e40b926`.
- Owner constraints: `lib/admin/billing-goodwill.ts` remains the reconciliation owner; `lib/admin/access.ts` remains the authority owner; the existing local ledger and idempotency key remain canonical.
- Compatibility boundary: eligibility, USD-only rule, $0.01-$100.00 range, 23h55m replay margin, live gate, confirmations, mutation entry points, evidence bundle, and unresolved states stay unchanged.
- Task batches: historical/current evidence; final authority gate; truthful presentation; documentation/validation and PR loop.
- Test obligations: strict RED/GREEN/REFACTOR, spec review, quality review, coordinator verification, focused/adjacent/full validation, build, diff check, hosted review, and thread resolution.
- Drift rule: pause if any replacement provider operation/key, broader financial authority, new schema, Branch 3 activation, or live mutation appears.

## Slice Card - Task 1

- Goal: separate immutable transaction-time ending credit from a later current Customer credit.
- Parent plan/spec: Branch 2 Task 1 and the Billing acceptance section of the closure design.
- Files: `lib/admin/billing-goodwill.ts`, `tests/admin-billing-goodwill.test.mjs`.
- Boundary: no authority-owner, UI, documentation, schema, live-gate, eligibility, amount, or entry-point changes.
- Verification: strict RED on intervening activity and mismatch tables, then the complete focused billing-goodwill suite.
- Stop: Task 1 is independently spec/quality approved, coordinator-verified, and committed, or a contract conflict requires escalation.

## Slice Card - Task 2

- Goal: recheck fresh full-Admin database authority immediately before a new Stripe balance-transaction create.
- Parent plan/spec: Branch 2 Task 2 and the Billing acceptance/error-handling sections of the closure design.
- Files: `lib/admin/access.ts`, `lib/admin/billing-goodwill.ts`, `tests/admin-access.test.mjs`, `tests/admin-billing-goodwill.test.mjs`.
- Boundary: no reconciliation eligibility change, provider replacement, UI/copy/docs/schema change, or mapping of infrastructure/unknown failures to confirmed revocation.
- Verification: strict RED for typed denial, pre-create revocation, infrastructure failures, different authorized reconciler, and post-check race; then complete access and billing-goodwill suites.
- Stop: Task 2 is independently spec/quality approved, coordinator-verified, and committed, or an authority/ambiguity conflict requires escalation.

## Slice Card - Task 3

- Goal: present transaction-time and optional current Stripe credit truthfully in Admin action results while keeping pre-mutation projections distinct.
- Parent plan/spec: Branch 2 Task 3 and the Billing local-evidence/presentation acceptance in the closure design.
- Files: `app/admin/users/[userId]/billing-actions.ts`, `app/admin/users/[userId]/billing-goodwill-form.tsx`, `tests/admin-billing-goodwill-ui.test.mjs`, `tests/admin-security-ui.test.mjs`.
- Boundary: no service/provider/authority/schema/docs changes; Activity/email bundle remains historical-only.
- Verification: strict RED for divergent and unavailable current observations, then complete billing-goodwill/security UI suites.
- Stop: Task 3 is independently spec/quality approved, coordinator-verified, and committed, or a presentation/contract conflict requires escalation.

## Slice Card - Task 4

- Goal: document the terminal Branch 2 behavior, run comprehensive validation, and complete the branch and PR review loop through the user-controlled merge gate.
- Parent plan/spec: Branch 2 Task 4 plus the Billing acceptance, validation strategy, documentation/evidence, and rollout-order gates in the closure design.
- Files: `docs/project-state.md`, `docs/project-log.md`, `docs/wiki/admin-user-operations.md`, `docs/wiki/release-checklist.md`.
- Boundary: documentation, validation, and review only; no new service/UI/schema behavior, broader financial authority, Production activation, Branch 3 work, or live Stripe/payment action.
- Verification: focused and adjacent tests, typecheck, lint, Prisma validation, full unit suite, Production build, diff check, independent spec and quality review, exact-head CodeRabbit review, hosted checks, and review-thread resolution.
- Stop: stop at the user-controlled merge gate after the branch is independently approved, comprehensively validated, pushed in PR #181, hosted checks pass, valid findings are resolved, and zero review threads remain; escalate any blocker or scope drift.
