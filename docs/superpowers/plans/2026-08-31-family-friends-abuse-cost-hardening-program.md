# Family-and-Friends Abuse and Cost Hardening Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve MassageLab's intended anonymous and signed-in family-and-friends experiences while bounding avoidable database, provider, and email cost and giving users visible retry guidance.

**Architecture:** Deliver one shared privacy-safe operational limiter followed by three focused consumers. Stack the PRs so every downstream surface imports the reviewed limiter contract, while PR C's canonical public-request UUID parser is reused by donation Checkout without reusing booking row ownership. Keep high-frequency Anatomime polling off the durable limiter after joined-player proof, and keep every provider boundary behind validation and quota decisions.

**Tech Stack:** Next.js 16 App Router and Server Actions, React 19, Prisma 7, PostgreSQL/Neon, Auth.js 5 beta, Stripe 22, Sentry, Ably, Node.js 24 tests, and Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-08-31-family-friends-abuse-cost-hardening-design.md`

## Authorization boundary

- Local design, code, tests, documentation, and code review are authorized.
- Do not push, merge, deploy, apply the additive migration, change a provider or environment setting, send email, capture a Sentry event, or create a live/test Stripe Checkout Session, payment, customer, or event.
- Provider boundaries are verified with injected or intercepted fakes only.
- The root agent owns all Git mutations and records each reviewed task commit.
- Preserve the unrelated root checkout and all user-owned worktrees.

## PR stack

| Order | Branch | Detailed plan | Owns |
| --- | --- | --- | --- |
| A | `codex/family-friends-05-abuse-cost-foundation` | `docs/superpowers/plans/2026-08-31-operational-limiter-email-ceiling.md` | Additive operational bucket, fixed policy registry, atomic limiter, deployment-wide email ceiling. |
| B | `codex/family-friends-06-anatomime-traffic` | `docs/superpowers/plans/2026-08-31-anatomime-traffic-hardening.md` | Anatomime create/join/token/poll protection, joined-player proof, cadence and recovery. |
| C | `codex/family-friends-07-booking-traffic` | `docs/superpowers/plans/2026-08-31-public-booking-traffic-hardening.md` | Availability protection, booking/waitlist quotas and idempotency, structured action recovery. |
| D | `codex/family-friends-08-public-ingress` | `docs/superpowers/plans/2026-08-31-public-provider-ingress-hardening.md` | Donation Checkout quota/idempotency and durable problem-report protection. |

## Dependency contracts

PR A is the only schema owner. It exports a discriminated operational request union and one `consumeOperationalRateLimit` boundary. Downstream branches never choose policy names, windows, limits, global subjects, or HMAC inputs.

PR C exports canonical UUIDv4 parsing and deterministic request ownership. PR D reuses that parser for donation attempts but does not reuse booking row ownership.

No intermediate PR is deployed. Each branch is based on the exact reviewed predecessor head and remains under CodeRabbit's 100-file review limit.

## Execution workflow

### Phase 1: PR A foundation

- [ ] Implement the additive Prisma persistence contract with strict RED/GREEN evidence.
- [ ] Implement the fixed policy registry and privacy-safe HMAC key construction.
- [ ] Implement atomic multi-rule consumption, bounded retry, and bounded cleanup.
- [ ] Classify every auth mail wrapper and enforce the global ceiling immediately before SMTP construction.
- [ ] Run focused and full validation, obtain task review, resolve findings, then obtain a no-actionable-comment CodeRabbit review on the exact head.
- [ ] Record the reviewed PR A head before creating PR B.

### Phase 2: PR B Anatomime

- [ ] Branch from the reviewed PR A head.
- [ ] Add narrow viewer preflight, local HMAC shedding, and coalesced presence primitives.
- [ ] Protect create/join persistence and bind realtime tokens to proven joined players.
- [ ] Reduce valid polls to one full hydration and presence writes to at most one per player per 15 seconds.
- [ ] Replace fixed polling loops with status-aware cadence, backoff, `Retry-After`, and terminal recovery.
- [ ] Run focused/browser/full validation and complete task plus CodeRabbit review before PR C.

### Phase 3: PR C public booking

- [ ] Branch from the reviewed PR B head.
- [ ] Add canonical request ownership with payload digests and transaction-scoped UUID-prefix serialization.
- [ ] Put availability quota before solver/provider/calendar reads and add bounded stale-public-result fallback.
- [ ] Add 350ms debounce, request cancellation, structured action states, and accessible retry guidance.
- [ ] Make booking and waitlist retries converge without replaying calendar, notification, revalidation, or provider work.
- [ ] Run focused/browser/full validation and complete task plus CodeRabbit review before PR D.

### Phase 4: PR D provider ingress

- [ ] Branch from the reviewed PR C head.
- [ ] Pass one opaque idempotency key to the Stripe Session create boundary.
- [ ] Retain a donation attempt UUID across ambiguous outcomes and put quota before Stripe construction.
- [ ] Replace process-local problem-report limiting with the durable limiter after origin/MIME/payload privacy validation and before Sentry.
- [ ] Add visible retry/manual recovery for donation and problem-report clients.
- [ ] Run focused/browser/full validation and complete task plus CodeRabbit review.

### Phase 5: exact-candidate proof

- [ ] Review the combined D head against the approved spec, all four plans, and all PR interfaces.
- [ ] Verify only the expected additive migration exists and `npx prisma migrate status` is read-only if run against a configured target.
- [ ] Run Prisma validation/generation, focused tests, full typecheck/lint/test/build, and `git diff --check` on the exact candidate.
- [ ] Run provider-intercepted desktop and mobile browser journeys for all in-scope retry, unavailable, conflict, and normal-use paths.
- [ ] Confirm tests produced no SMTP, Ably, Sentry, Stripe, Google Calendar, deployment, migration, or provider mutation.
- [ ] Record known pre-existing failures separately from candidate regressions with exact command output.
- [ ] Stop and request fresh authorization before any push, merge, migration application, deployment, provider setting change, email, or payment action.

## Review gates

Every task receives a spec-compliance review followed by a code-quality review before its coordinator commit. Every PR receives:

1. focused tests for the owning surface;
2. typecheck and lint;
3. relevant desktop and mobile Playwright proof;
4. full test/build validation;
5. exact-head diff review;
6. CodeRabbit review until the latest successful trigger returns no actionable comments; and
7. a clean worktree receipt.

A review-window or rate-limit message is not a completed review. Wait for eligibility, trigger again, and evaluate the resulting review. Do not merge merely because hosted CI is green.

## Program stop conditions

- A limiter decision is ambiguous, fails open, logs request-derived identifiers, or permits provider work after denial.
- A task requires widening the approved schema beyond the one operational bucket migration.
- Booking idempotency cannot prove same-owner/same-payload replay and same-ID/changed-payload conflict under concurrency.
- A browser path silently retries a durable/provider-creating action after an ambiguous result.
- Any validation attempts a real provider call or changes hosted state.
- A predecessor PR is not reviewed at the exact head intended as the next base.
