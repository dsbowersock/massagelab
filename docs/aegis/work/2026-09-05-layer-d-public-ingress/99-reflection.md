# Layer D Public Provider Ingress Reflection

## Outcome

- The historical Layer D runtime and tests were first preserved exactly on current `main` without importing stale release claims. Independent review then corrected one inherited attempt-age defect plus three diagnostic-client recovery and accessibility defects.
- Donation and voluntary diagnostic requests now have durable cost/abuse boundaries before provider work while keeping intended anonymous access and explicit user recovery.
- Layer D remains local-only until independent review and a separately authorized hosted PR gate complete.

## Evidence Ladder

- Static: Prisma validate/generate, TypeScript, lint, and diff checks pass.
- Focused: 251 ingress/owner tests and 52 adjacent limiter/schema/request-ID tests pass.
- Broad: the complete Node suite passes 4,142 with 0 failures and 3 intentional skips across 4,145 tests; fresh Browser-QA and Production builds each generate 115 pages.
- Behavioral: all 12 desktop/mobile public-provider cases pass against an isolated exact-candidate build with a clean runner exit.
- Review: exact-head specification review passes at `1ac38584`; exact-head quality/security review passes at final runtime/test head `b8c8f40f` after all four findings were corrected.

## Non-Goals Preserved

- No schema or migration was added.
- No provider/environment setting, live or test Stripe/Sentry action, email, payment, database access, push, PR, merge, deployment, or Production action occurred.
- Existing Layers A-C Production state, all 46 current migrations, and the membership webhook-write pause flag at `0` were not changed.

## Reuse Guidance

- Browser evidence must use an isolated exact-candidate server; Playwright's permitted existing-server reuse can otherwise test the wrong worktree.
- The donation attempt remains reusable only through `23h55m - 1ms`; it rotates at exactly `23h55m` so the browser recovery bound stays below Stripe's 24-hour pruning floor.
- Diagnostic requests settle under one 10-second client deadline, surface transport uncertainty without automatic replay, announce a stable wait state and one readiness change, and keep the successful email bound to the submitted taxonomy.
- The hosted CodeRabbit zero-findings rule belongs to the GitHub PR review, not an open-ended local CLI loop.
