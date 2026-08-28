# Family-and-Friends Readiness Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver and prove the five independently reviewable workstreams required for a safe three-to-five-person MassageLab soft launch.

**Architecture:** Implement the approved design as four stacked code branches followed by a release-and-operations branch. Each workstream has its own detailed plan, tests, commits, and review gate; the program advances only when the preceding branch is clean and its acceptance criteria pass.

**Tech Stack:** Next.js 16 App Router, React 19, Auth.js 5 beta, Prisma 7 with Neon PostgreSQL, Stripe 22, Node.js 24 test runner, Playwright 1.60, Vercel, SMTP email delivery, Cloudflare R2, and Sentry.

**Spec:** `docs/superpowers/specs/2026-08-28-family-friends-readiness-design.md`

## Global Constraints

- Preserve all existing users, subscriptions, purchases, feature-key entitlements, and access.
- Email/password and Google must each work as an independent sign-in method after that method is attached to the one normalized-email user account.
- A matching Google email must never silently create a second user or attach to an existing password account without password proof and two-factor proof when enabled.
- Google-first password addition requires recent Google reauthentication; unlinking requires recent authentication and another usable method.
- Stripe remains the payment authority; MassageLab's persisted subscription and feature keys remain the ordinary runtime access authority.
- Do not grant access from a Checkout return URL, displayed plan name, or browser-only state.
- Navigation and critical actions must acknowledge activation immediately without artificial delay and must clear pending UI on every settlement path.
- Keep persistent audio and the application shell alive across route feedback; preserve timers within their same-route or root-owned lifecycle without claiming that a route-local timer survives deliberate departure.
- Measure launch-path work before broad optimization; do not introduce speculative global caching.
- Keep registration and new Supporter Checkout independently pausable while preserving login, recovery, existing access, and the billing Portal.
- Keep clinical and PHI-bearing workflows local-first; do not add product analytics, session replay, individual journeys, or PHI telemetry.
- Test-mode Stripe is the primary failure-path environment. A live payment, refund, cancellation, synthetic provider event, provider-setting mutation, migration deployment, deployment, merge, or production secret change requires separate explicit authorization.
- Never commit or record secret values, credentials, connection strings, provider payloads, database rows, payment details, OAuth tokens, raw email addresses used as limiter keys, or identifiable tester activity.
- Use strict TDD for application changes, focused JSDoc for non-obvious shared helpers, and an independently reviewable commit at the end of each task.
- Run each workstream from an isolated worktree created with `superpowers:using-git-worktrees`; verify branch, HEAD, status, and dev-server state before editing.

## Plan suite

| Order | Workstream | Detailed plan | Completion boundary |
| --- | --- | --- | --- |
| 1 | Identity and account-method safety | `docs/superpowers/plans/2026-08-28-identity-account-method-safety.md` | One normalized-email account, explicit secure linking, recoverable auth UI, bounded limiter storage and email work |
| 2 | Subscription truth and entitlement convergence | `docs/superpowers/plans/2026-08-28-subscription-entitlement-convergence.md` | Duplicate/out-of-order-safe webhooks and Checkout-return convergence to persisted feature access |
| 3 | Navigation and action feedback | `docs/superpowers/plans/2026-08-28-navigation-action-feedback.md` | Shared route progress and critical-action pending/error states without shell teardown |
| 4 | Server path and cost controls | `docs/superpowers/plans/2026-08-28-server-cost-controls.md` | Provisioning removed from session refresh, duplicate entitlement work removed, measured route evidence, independent pause switches |
| 5 | Exact-head release and soft launch | `docs/superpowers/plans/2026-08-28-release-soft-launch.md` | Clean full gate, production-safe read-only receipt, operator runbook, guided cohort, and monitored sharing decision |

## Branch topology

Use stacked branches so later work consumes already-reviewed interfaces and overlapping forms are never changed in parallel:

```text
codex/family-friends-readiness-design
  -> codex/family-friends-identity
    -> codex/family-friends-subscription
      -> codex/family-friends-feedback
        -> codex/family-friends-cost-controls
          -> codex/family-friends-release-proof
            -> atomically update/deploy exact main
              -> codex/family-friends-launch-receipt (docs-only, after deployment)
```

The branch names are the default execution names. If one already exists, stop and inspect it; do not delete, reset, reuse, or overwrite it without explicit confirmation of ownership and state.

---

### Task 1: Establish the execution baseline

**Files:**
- Read: `docs/superpowers/specs/2026-08-28-family-friends-readiness-design.md`
- Read: all five detailed plans listed above
- Read: `docs/project-state.md`
- Read: `docs/project-log.md`
- Read: `docs/wiki/index.md`

**Interfaces:**
- Consumes: approved design commit `697ba2a9` and the committed plan-suite head.
- Produces: a clean isolated identity worktree whose HEAD contains the design and all plan documents.

- [ ] **Step 1: Verify the documentation branch**

Run:

```bash
git status --short --branch
git log -1 --oneline --decorate
git diff --check
```

Expected: branch `codex/family-friends-readiness-design`, no uncommitted paths, and the plan-suite commit at HEAD.

- [ ] **Step 2: Read the source-of-truth documents and every detailed plan**

Read the spec, `docs/project-state.md`, `docs/project-log.md`, `docs/wiki/index.md`, and each plan in the table. Record any source drift before editing; do not silently substitute historical checklist or audit claims for current repository truth.

- [ ] **Step 3: Create the identity worktree using the required worktree skill**

Invoke `superpowers:using-git-worktrees`, select a safe path under the repository's `.worktrees` convention, and create `codex/family-friends-identity` from the verified plan-suite HEAD.

- [ ] **Step 4: Verify the isolated worktree**

Run in the new worktree:

```bash
git branch --show-current
git status --short --branch
git rev-parse HEAD
npm run prisma:generate
```

Expected: the identity branch is checked out, status is clean, HEAD matches the plan-suite head, and Prisma generation passes.

---

### Task 2: Execute and review identity safety

**Files:**
- Follow: `docs/superpowers/plans/2026-08-28-identity-account-method-safety.md`

**Interfaces:**
- Produces: the account-method API, linking records, limiter contract, UI, migrations, and tests consumed by later workstreams.

- [ ] **Step 1: Execute the identity plan task-by-task**

Use `superpowers:subagent-driven-development` for fresh task workers and two-stage review, or `superpowers:executing-plans` if the user selected inline execution. Do not mix execution styles within one task.

- [ ] **Step 2: Run the identity plan's focused and complete gates**

Run every command in that plan from its final task. Expected: all focused identity tests, Prisma validation/generation, typecheck, lint, the full Node test suite, the production build, browser identity coverage, and `git diff --check` pass.

- [ ] **Step 3: Review the identity diff against the spec**

Confirm there is no dangerous automatic provider linking, duplicate normalized-email creation path, last-method lockout, raw limiter identity retention, or failure path that strands a busy form. Resolve all supported review findings before continuing.

- [ ] **Step 4: Create the subscription branch from the reviewed identity head**

After identity approval, use `superpowers:using-git-worktrees` to create `codex/family-friends-subscription` from the exact reviewed identity commit. Verify the new branch, HEAD, and clean status before edits.

---

### Task 3: Execute and review subscription convergence

**Files:**
- Follow: `docs/superpowers/plans/2026-08-28-subscription-entitlement-convergence.md`

**Interfaces:**
- Consumes: reviewed identity head.
- Produces: durable Stripe event receipt/order state and persisted Checkout-return status consumed by feedback and release work.

- [ ] **Step 1: Execute the subscription plan task-by-task**

Keep Stripe provider calls injected or test-mode only. No live Checkout, event emission, refund, cancellation, or Portal mutation is authorized by plan execution.

- [ ] **Step 2: Run the subscription plan's focused and complete gates**

Expected: schema/migration contracts, duplicate and out-of-order event tests, Checkout-return status tests, membership/feature-key tests, Prisma gates, typecheck, lint, full Node tests, production build, focused browser tests, and `git diff --check` pass.

- [ ] **Step 3: Review authority and retry behavior**

Confirm older events cannot overwrite newer state, unfinished receipts can retry, provider retrieval happens outside database transactions, unresolved work is not falsely acknowledged, and access comes only from persisted feature keys.

- [ ] **Step 4: Create the feedback branch from the reviewed subscription head**

After subscription approval, use the worktree skill to create `codex/family-friends-feedback` from the exact reviewed subscription commit and verify clean state.

---

### Task 4: Execute and review interaction feedback

**Files:**
- Follow: `docs/superpowers/plans/2026-08-28-navigation-action-feedback.md`

**Interfaces:**
- Consumes: final identity and subscription forms/status endpoints.
- Produces: shared route-progress and async-action primitives consumed by cost-control pause states and the release browser matrix.

- [ ] **Step 1: Execute the feedback plan task-by-task**

Adopt the shared primitives on the launch-critical inventory before considering lower-risk cosmetic surfaces. Do not add artificial delay or replace the persistent shell with a full-page loader.

- [ ] **Step 2: Run the feedback plan's focused and complete gates**

Expected: shared unit/source contracts, throttled browser routes and actions, duplicate-submit prevention, thrown-request cleanup, keyboard/status announcements, mobile layouts, reduced motion, full repository gates, and `git diff --check` pass.

- [ ] **Step 3: Review persistent client state**

Keep music playing across the real `/music` -> `/clock?source=music` route transition and confirm route progress does not recreate its root provider. Separately reuse the exact Chimer DOM-identity regression while changing existing same-page Visual draft controls: its timer node must remain and advance, while a deliberate route departure may unmount that route-local timer. Do not claim Chimer persistence across a route change.

- [ ] **Step 4: Create the cost-controls branch from the reviewed feedback head**

After feedback approval, use the worktree skill to create `codex/family-friends-cost-controls` from the exact reviewed feedback commit and verify clean state.

---

### Task 5: Execute and review server and cost controls

**Files:**
- Follow: `docs/superpowers/plans/2026-08-28-server-cost-controls.md`

**Interfaces:**
- Consumes: final registration, Checkout, session, entitlement, and pending-control interfaces.
- Produces: measured workload evidence, bounded session work, pause switches, and operational documentation consumed by the release gate.

- [ ] **Step 1: Execute the server/cost plan task-by-task**

Capture the before measurement before changing the hot paths. Keep all production-provider configuration read-only during code implementation.

- [ ] **Step 2: Run the server/cost plan's focused and complete gates**

Expected: provisioning-lifecycle, session feature-key, workload-measurement, pause-control, registration, Checkout, full repository, production build, and focused browser tests pass with `git diff --check`.

- [ ] **Step 3: Compare the before-and-after evidence**

Confirm ordinary session refresh performs no background-credit transaction, the sidebar does not re-query entitlements already loaded for the session, no new provider call appears in ordinary render, and both pause controls preserve login, recovery, existing access, and Portal entry.

- [ ] **Step 4: Create the release-proof branch from the reviewed cost-control head**

After cost-control approval, use the worktree skill to create `codex/family-friends-release-proof` from the exact reviewed cost-control commit and verify clean state.

---

### Task 6: Produce exact-head release proof and run the controlled launch

**Files:**
- Follow: `docs/superpowers/plans/2026-08-28-release-soft-launch.md`

**Interfaces:**
- Consumes: the exact reviewed combined candidate and all workstream evidence.
- Produces: canonical documentation, a sanitized release receipt, operator runbook, and a go/pause decision for the first three to five people.

- [ ] **Step 1: Execute the release plan through the local and CI gate**

Do not begin provider or deployed-system checks until the exact candidate is clean and every local/hosted repository gate is green.

- [ ] **Step 2: Complete read-only production checks**

Verify deployed commit, migration status, Google/email/Stripe configuration posture, database pooling, monitoring, spend alerts, R2 delivery, and pause controls without printing or recording secrets or identifiable rows.

- [ ] **Step 3: Stop at every external mutation gate**

Request separate explicit authorization before a deployment, migration application, provider-setting change, synthetic event, live charge, refund, cancellation, or other production mutation. Approval for one exact action does not authorize adjacent actions.

- [ ] **Step 4: Continue from the deployed-main receipt branch**

After the exact reviewed release head is incorporated into the authorized atomic `main` update and deployed, create `codex/family-friends-launch-receipt` from that deployed `origin/main` SHA as specified by the release plan. Keep post-deploy evidence there; do not append it to the release-proof branch.

- [ ] **Step 5: Run the guided cohort and safety window**

After the release receipt is approved and the candidate is deployed through an authorized path, follow the three-to-five-person checklist and 48-to-72-hour forwarding hold in the release plan.

- [ ] **Step 6: Record the sharing decision**

Open forwarding only if the release plan's technical gates remain healthy. Continue two-to-four weeks of aggregate operational observation; do not treat low usage, free-only use, or low conversion as a technical failure.

## Program completion criteria

The program is complete only when:

- all five detailed plans are implemented and reviewed in order;
- their commits are represented in the exact candidate;
- canonical documentation and the release receipt describe that exact candidate;
- the deployed commit and migration state are read back safely;
- email/password, Google, recovery, subscription, entitlement, Portal, and pending-state matrices pass at the approved boundary;
- registration and Checkout pause switches are proven independently;
- the first-cohort operator runbook is available; and
- either the 48-to-72-hour safety window passes and sharing opens, or a documented pause condition keeps the launch closed without harming existing users.
