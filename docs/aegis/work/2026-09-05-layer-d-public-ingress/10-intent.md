# Layer D Public Provider Ingress Intent

## TaskIntentDraft

- Requested outcome: proceed with the planned Layer D hardening after Layers A-C reached Production.
- Scope: port the existing donation Checkout quota/idempotency and durable problem-report protection onto exact current `main`, reconcile canonical documentation, and complete local review and verification.
- Success evidence: the intended Layer D runtime/test patch is preserved on current `main`; donation denial never constructs Stripe; problem-report denial never captures or flushes Sentry; client retries remain manual and visible; focused, browser, static, full-suite, and independent review gates pass.
- Stop condition: stop as blocked, needs-verification, or scope-exceeded on semantic conflict, unexpected runtime drift, failed verification, or any need for schema, migration, environment, provider, email, payment, push, merge, or deployment action without separate authorization.
- Non-goals: no schema or migration change; no provider/environment setting change; no real Stripe Checkout, payment, customer, event, Sentry capture, or email; no push, PR, merge, or deployment in the local integration slice.
- Risk hints: provider idempotency conflicts, quota-before-provider ordering, privacy leakage, automatic retry of ambiguous provider actions, and stale Layer C documentation.

## TaskStartSnapshot

- Repository root: `C:/Users/derri/code/my_projects/massagelab`.
- Reused worktree: `.worktrees/family-friends-public-ingress`.
- Pre-task branch/HEAD: `codex/family-friends-08-public-ingress` at `28124d64246a55876ecd4f06d88ee6f0e1cab38c`, clean, with no active merge, rebase, cherry-pick, revert, or bisect.
- Current integration branch/HEAD: `codex/family-friends-08-public-ingress-r3` at `8cc0c80f4d0e08cd85f0431af963f339e1f6f5d4`.
- Preserved source: `codex/family-friends-08-public-ingress-r2` at `cdd39c2cbb14d86fea881742a7c38d9cd42cc07a` remains unchanged in its own worktree.
- Unrelated root-checkout browser artifacts and all other worktrees remain untouched.

## BaselineReadSetHint

- `AGENTS.md`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/superpowers/plans/2026-08-31-family-friends-abuse-cost-hardening-program.md`
- `docs/superpowers/plans/2026-08-31-public-provider-ingress-hardening.md`
- `docs/superpowers/specs/2026-08-31-family-friends-abuse-cost-hardening-design.md`
- source branch `cdd39c2cbb14d86fea881742a7c38d9cd42cc07a`
- current-main baseline `8cc0c80f4d0e08cd85f0431af963f339e1f6f5d4`

## BaselineUsageDraft

- Required refs: all BaselineReadSetHint entries.
- Acknowledged refs: all.
- Cited refs: parent program, Layer D plan, approved design, and exact source/current-main identities.
- Missing refs: none for local integration.
- Decision: continue.

## Change Necessity

- User-visible need: public donation and diagnostic actions must show progress/recovery while avoiding duplicate or unbounded provider work.
- No-change / non-code option: provider dashboards alone cannot enforce MassageLab's request validation, retained attempt identity, route ordering, or manual-retry UI contracts.
- Why code change is necessary: these boundaries live in the application before Stripe or Sentry is invoked.
- Minimum change boundary: port only the already implemented Layer D runtime/test behavior and reconcile its documentation onto current `main`.
- Decision: code-change.

## Complexity and Owner Fit

- Artifact class: provider-facing route handlers, one pure attempt owner, two focused client components, and contract tests.
- Current pressure: medium; the source patch is substantial but already splits attempt state from route/provider adapters and UI.
- Planned governance: preserve the source owner split; add no new fallback, adapter, schema, or provider responsibility during the port.
- Decision: port existing owners, then review exact current-main behavior before any correction.

## TDD Route Guard

- Mode: off.
- Decision: skipped for the port itself because no new strict-TDD authority was supplied and the implementation already carries historical RED/GREEN tests.
- Test posture: fresh focused and full GREEN verification on the current-main integration, with a new failing regression only if review exposes a real defect.

## Execution Readiness View

- Intent lock: bound donation Checkout and privacy-safe problem-report provider calls without removing intended public access.
- Scope fence: Layer D runtime, tests, and canonical documentation only.
- Baseline lock: source `cdd39c2c` onto current `main` `8cc0c80f`.
- Owner constraints: reuse Layer A operational limits and Layer C canonical UUID parsing; do not duplicate either owner.
- Compatibility boundary: preserve current pricing, tax, support-only donation semantics, privacy-safe Sentry payload, and Layers A-C behavior.
- Retirement boundary: process-local problem-report limiting is replaced by the durable shared limiter; no compatibility copy remains.
- Task batches: port runtime/test commits; reconcile docs; focused/browser/full verification; specification review; quality/security review.
- Test obligations: Layer D focused Node matrix, desktop/mobile browser journey, Prisma validate/generate, typecheck, lint, repository tests, build, and diff check.
- Review gates: specification compliance first, then code quality/security, then coordinator verification.
- Drift/rewind rules: stop if a current-main runtime/test owner changed since the historical base or if the port requires schema/provider behavior outside the plan.
- Evidence required: exact patch identity, provider non-invocation tests, retry behavior tests, clean Git state, and review approvals.
- Advisory boundary: this record guides execution; it does not authorize external actions or grant completion.
