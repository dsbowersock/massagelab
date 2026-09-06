# Layer D Public Provider Ingress Evidence

## Initial integration evidence

- Current-main baseline: `8cc0c80f4d0e08cd85f0431af963f339e1f6f5d4`.
- Preserved Layer D source: `cdd39c2cbb14d86fea881742a7c38d9cd42cc07a`.
- Historical Layer D base: `c8d86e0bc581f88203336cef492fc73c09d306be`.
- Source patch: 25 files, 3,236 insertions, 531 deletions.
- Current-main overlap inside those 25 paths: only `docs/project-state.md`, `docs/project-log.md`, `docs/wiki/deployment.md`, and `docs/wiki/release-checklist.md` changed; runtime and test paths are unchanged from the historical base.
- Target worktree was clean with no active Git operation before branch creation.
- External-action evidence: PR #204 was pushed and opened under exact authorization; its initial hosted review evidence is recorded below.

## Port identity

- Exact runtime/test head: `b8c8f40f27fe8412ed1a4e8784fd6dc73ef2c027`.
- Ten runtime/test commits were replayed in their original order. `git range-diff` maps every source commit to its current-main counterpart, and all 21 original non-documentation paths compared byte-for-byte with the preserved source head at the initial port checkpoint. After independent corrections, 16 of those paths remain byte-identical and five contain reviewed fixes; the correction also extends the existing shared `lib/problem-report.js` helper, which was outside the original 21-path source patch.
- Historical docs-only commits `1056c155ac96609576005856c783ad5425e18c29` and `cdd39c2cbb14d86fea881742a7c38d9cd42cc07a` were deliberately omitted because their Layer A-C and migration status claims are stale. Canonical docs were rewritten from current `main` instead.
- Layer D changes no Prisma schema, migration, package, workflow, or environment/provider setting.
- Independent specification review found one inherited boundary defect: browser attempt reuse remained valid through the exact 24-hour Stripe pruning floor. Commit `1ac38584975dcbef7074e7fb0c15ebc469b29b77` changes only the attempt-age owner and its test so `23h55m - 1ms` remains valid and exactly `23h55m` rotates. The focused donation test passes 10/10 after the correction.
- The exact-head specification re-review returned SPEC PASS at `1ac38584975dcbef7074e7fb0c15ebc469b29b77`.
- Independent quality review then found three client recovery defects: no diagnostic request deadline, a per-second countdown inside an atomic polite live region, and a post-success email derived from selectors that could change while the request was pending. Commit `201d45f0413d8f0d16852e7025d56738541db350` adds one 10-second fetch/body deadline with accurate uncertain/manual-only recovery, one stable wait announcement plus one readiness change outside the visual countdown, and immutable submitted taxonomy for the email. Final review found one remaining malformed-success edge; commit `b8c8f40f27fe8412ed1a4e8784fd6dc73ef2c027` requires a canonical 32-hex Sentry receipt before entering `sent`, otherwise returning to uncertain manual recovery. The final affected matrix, TypeScript, lint, fresh 115-page Browser-QA build, and all 12 desktop/mobile browser cases pass.

## Verification receipts

- Focused ingress/owner Node matrix: 251 passed, 0 failed.
- Adjacent operational-limiter/schema/public-request-ID matrix: 52 passed, 0 failed.
- Complete Node suite: 4,145 tests; 4,142 passed, 0 failed, 3 intentionally skipped.
- Prisma schema validation and Prisma client generation: passed.
- TypeScript: passed.
- ESLint: passed with only the established Chimer large-file Babel note.
- Base-to-head `git diff --check`: passed.
- Fresh Browser-QA build: passed and generated 115 pages.
- Fresh Production build: passed and generated 115 pages. The expected fixed privacy-safe Anatomime shedder initialization diagnostic appeared in the inert local build context.
- Public-provider Browser QA: the original 10/10 matrix passed against an isolated current-branch server on port 43118; the expanded matrix passed at 12/12 after the first quality correction on port 43119 and again after final receipt validation against a freshly rebuilt exact candidate on isolated port 43120. The earlier default-port run reused another worktree's pre-Layer-D server and is explicitly discarded, not counted as evidence.
- No real Stripe, Sentry, email, database, migration, provider-setting, payment, merge, Production deployment, or other Production action was performed.

## Review boundary

- Independent exact-head specification re-review after `1ac38584`: SPEC PASS.
- Independent exact-head quality/security re-review: QUALITY/SECURITY PASS at `b8c8f40f27fe8412ed1a4e8784fd6dc73ef2c027` with no actionable runtime or test findings.
- PR #204 opened against `8cc0c80f4d0e08cd85f0431af963f339e1f6f5d4` from exact initial head `1512883ff1eb1047aad5f82de5d7fdd089ca0e11`. Initial hosted Code quality, Browser build, all four Browser QA lanes, aggregate QA, all three CodeQL analyzers, Vercel preview, and GitHub Codex review passed.
- The first exact-head GitHub-hosted CodeRabbit review raised six verified minor findings. The review-fix candidate preserves mounted donation status/alert regions, adds the reachable `invalid-request` return notice, corrects the evidence count to five pre-hosted findings, imports the production diagnostic timeout into Browser QA, proves rapid double-click suppression while the first POST is still pending, and makes the Stripe double return a distinct session for a distinct attempt key.
- Corrected-head hosted CI and a fresh eligible GitHub-hosted CodeRabbit review remain pending. Merge, Production deployment, and Production verification remain outside the current authorization.
