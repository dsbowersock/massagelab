# Dependency Maintenance Gate Implementation Plan

## Goal

Close the newly reported safe-to-fix dependency advisories and the GitHub Actions Node 20 warning before Layer B, while preserving the exact user-visible and Production behavior shipped by Layer A.

## Architecture

Keep dependency policy in the existing `package.json` override owner, lock exact resolved copies in `package-lock.json`, enforce reviewed floors in the existing dependency-security regression test, and record residual risk in the existing dependency-security wiki. Update only the existing Next.js build-cache action in CI. No application route, schema, provider configuration, or entitlement behavior changes.

## Tech Stack

- Node.js 24 and npm lockfile v3
- Next.js 16, Prisma 7, Sentry Next.js SDK
- GitHub Actions on GitHub-hosted Ubuntu runners
- Node's built-in test runner

## Baseline/Authority Refs

- User-approved maintenance sequence in the current task
- `AGENTS.md`
- `docs/project-state.md`
- `docs/project-log.md`
- `docs/wiki/index.md`
- `docs/wiki/dependency-security.md`
- `tests/dependency-security.test.mjs`
- Current Production/main commit `94c05b827eb2511659994cdae00cfcb99f909d77`

No repository `SECURITY.md` applies to `package.json` or `.github/workflows/ci.yml`; that missing policy is retained as a triage proof gap rather than invented.

## Compatibility Boundary

- Preserve all application, authentication, subscription, booking, email, Sentry, and database behavior.
- Do not change Next.js, React, Auth.js, Prisma, Sentry SDK, Stripe SDK, or feature code versions in this maintenance slice.
- Limit transitive overrides to patched releases within the already resolved major line.
- Do not force `deepmerge-ts@8` into Prisma's exact `7.1.5` dependency; document the trusted CLI/config-only residual until Prisma adopts a compatible release.
- Do not change provider settings, send email, create payment activity, or apply migrations.

## TDD Route

- Mode: off
- Decision: skipped
- Strict authority: not applicable
- Test posture: post-change regression
- Reason: the work changes declarative dependency and workflow pins, not application behavior; the existing dependency-floor test is the canonical regression owner.
- Verification: focused dependency test, fresh audits, clean install, Prisma validation/generation, lint, typecheck, complete tests, Production build, hosted CI/CodeQL/CodeRabbit, and post-merge deployment health.

## Requirement Ready Check

- Requirement source: approved five-step maintenance sequence in the current task
- Goal and scope: safe nonbreaking fixes before Layer B
- Acceptance: reviewed patch floors resolve, CI warning is removed, full checks pass, residual major-only findings are documented, and the PR merges cleanly
- Open blocker questions: none
- Decision: ready

## Change Necessity

- User-visible need: reduce avoidable release/security maintenance risk before inviting early users.
- No-change option: documentation alone would leave known vulnerable transitive copies, the deprecated CI runtime pin, and a Windows-only false failure in the raw fixture-hash gate in place.
- Minimum change boundary: `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `.gitattributes`, the existing dependency-security test, and canonical security/release documentation.
- Decision: config-and-test change; no application source change.

## Execution Readiness View

- Intent Lock: close safe patch-level dependency findings and the cache-action runtime warning before Layer B.
- Scope Fence: dependency metadata, lock resolution, CI cache pin, existing security regression, and canonical documentation only.
- Baseline Lock: start from exact clean `main` commit `94c05b827eb2511659994cdae00cfcb99f909d77`; preserve all other worktrees and untracked primary-checkout files.
- Approved Behavior: no user-visible or server-runtime behavior change.
- Owner / Contract Constraints: `package.json` owns override policy; `package-lock.json` owns exact resolution; the existing dependency-security test owns floor enforcement.
- Compatibility Boundary: reviewed patch releases within current major lines; no forced `deepmerge-ts` major, framework upgrade, provider mutation, or migration.
- Retirement Boundary: remove overrides only after upstream packages adopt the reviewed floors.
- Task Batches: dependency floors, cache action, documentation, complete local verification, hosted review, merge/deploy verification.
- Test Obligations: focused floor test, audit comparison, clean install, Prisma checks, lint, typecheck, complete tests, build, and hosted browser lanes.
- Review Gates: exact head, hosted CI/CodeQL/CodeRabbit, no unresolved actionable comments.
- Drift / Rewind Rules: stop on unrelated lockfile churn, major-version pressure, runtime reachability, critical advisory, unexpected migration, or hosted failure.
- Evidence Required Before Completion: clean task branch, exact committed files, green local and hosted gates, exact deployed SHA, 46 current migrations, public health, and aggregate error-free Vercel/Sentry window.
- Advisory Boundary: this view organizes execution evidence and does not itself grant completion.

## Current Checkpoint

- Exact base remains `94c05b827eb2511659994cdae00cfcb99f909d77`; the primary checkout and all unrelated worktrees remain untouched.
- Initial npm resolution exposed unrelated transitive refreshes. The lockfile was narrowed to the reviewed package families and their required dependency closure before clean-install verification.
- `npm ci`, the focused 4/4 dependency-security contract, Prisma validation/generation, TypeScript, lint, `git diff --check`, and the 115-page Production build pass.
- The exact baseline reproduced nine AtmoShaper raw-byte failures only on the Windows checkout. Git-blob hashes matched their pinned authorities. After the narrow LF checkout policy, the focused suite passes 10/10 and the complete suite passes `3,884`, fails `0`, and intentionally skips `3` across `3,887` tests.
- Fresh full and `--omit=dev` audits each report five high affected nodes, all propagated from the one documented `deepmerge-ts` Prisma CLI/config advisory. No new critical or Production-reachable finding appeared.
- Hosted PR review, hosted CI/CodeQL/CodeRabbit, merge, deployment, and post-deploy verification remain pending.

## Triage Summary

The current npm report normalizes to advisory claims across PostCSS, fast-uri, brace-expansion, nanoid, deepmerge-ts, Browserslist, mysql2, Hono, body-parser, qs, and `@humanfs/node`. Static repository evidence finds no application import of those packages. PostCSS, fast-uri, brace-expansion, nanoid, and Browserslist are reached through trusted build/bundler configuration. Hono, body-parser, qs, and `@humanfs/node` occur only in local development tooling. `deepmerge-ts` and `mysql2` are reached through the Prisma CLI; MassageLab deploys PostgreSQL through Neon and has no MySQL runtime path. The hosted application therefore does not establish the attacker-controlled sources or supported boundary crossings required to confirm the advisory claims. Patch-level hygiene remains worthwhile where compatibility is bounded.

## Files

- Modify `package.json`: raise existing override floors and add narrow overrides for newly affected transitive families.
- Modify `package-lock.json`: resolve only the reviewed package copies.
- Modify `.github/workflows/ci.yml`: pin `actions/cache@v6.1.0` by exact commit and update the provenance comment.
- Add `.gitattributes`: keep the two raw-hash-locked AtmoShaper authority fixtures and their byte-compared canonical listening export as LF on every checkout.
- Modify `tests/dependency-security.test.mjs`: assert the new reviewed floors.
- Modify `docs/wiki/dependency-security.md`: replace stale counts with current triage, fixes, and residual risk.
- Modify `docs/project-state.md` and `docs/project-log.md`: record the maintenance release only after verification/merge evidence exists.

## Tasks

### Task 1: Raise safe dependency floors

1. Update the existing PostCSS floor and Next.js nested override to `8.5.28`.
2. Raise `fast-uri` within major 3 to `3.1.7`.
3. Raise brace-expansion major-2 and major-5 copies to `2.1.4` and `5.0.9`; preserve the unaffected major-1 floor.
4. Add exact reviewed overrides for `nanoid@3.3.18`, `browserslist@4.28.9`, and `mysql2@3.24.3`.
5. Raise development-tool-only floors for `brace-expansion@1.1.18`, `hono@4.12.34`, `body-parser@2.3.0`, `qs@6.16.0`, and `@humanfs/node@0.16.8`.
6. Regenerate only the lockfile and inspect the complete package/lock diff for unrelated upgrades.
7. Update the existing dependency-floor regression assertions and run `node --test tests/dependency-security.test.mjs`.
8. Run fresh full and `--omit=dev` audits; stop if a new runtime-reachable or critical finding appears.

### Task 2: Remove the GitHub Actions runtime warning

1. Replace the exact `actions/cache` v4 commit with official `v6.1.0` commit `55cc8345863c7cc4c66a329aec7e433d2d1c52a9`.
2. Update the pin comment to identify v6.1.0 and the review date.
3. Preserve all cache inputs, keys, paths, and restore behavior.

### Task 3: Document closure and residual risk

1. Record the static reachability verdicts and exact patched floors in `docs/wiki/dependency-security.md`.
2. Record that `deepmerge-ts@7.1.5` remains a trusted Prisma CLI/config dependency awaiting upstream compatibility; do not describe the inventory as clean while it remains.
3. Update canonical project state/log only with verified outcomes; do not claim hosted closure before the latest PR head is reviewed.

### Task 4: Make the raw fixture-hash gate reproducible on Windows

1. Confirm the failing AtmoShaper construction-review test reproduces on an untouched checkout of the exact baseline commit.
2. Confirm each committed Git blob has the expected SHA-256 and the Windows worktree copy differs only because Git converted LF to CRLF.
3. Add exact `text eol=lf` attributes for those two authority fixtures and the byte-compared canonical listening export without changing their committed blobs.
4. Re-run the focused AtmoShaper construction-review test and the complete suite.

### Task 5: Verify, review, and integrate

1. Run `npm ci` from the exact lockfile.
2. Run `npm run prisma:validate`, `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `git diff --check`.
3. Commit only task-owned files, push the maintenance branch, and open one focused PR.
4. Require hosted CI, CodeQL, and hosted CodeRabbit review on the latest head; resolve valid comments without expanding scope.
5. Merge only after all gates pass and the base/head remain exact.
6. Monitor the exact Production deployment, public aliases, deployed SHA, migrations remaining at 46, and aggregate Vercel/Sentry health.

## Risks and Stop Conditions

- Stop if lockfile generation updates unrelated direct dependencies or crosses a reviewed major line.
- Stop if Prisma validation/generation fails with the mysql2 patch override.
- Stop if the audit exposes a remotely reachable Production path, any critical advisory, or a fix requiring an unapproved framework migration.
- Stop before merge on hosted failure, unresolved CodeRabbit finding, base/head drift, or unexpected migration.

## Retirement

- Remove each transitive override when its direct upstream dependency resolves at or above the reviewed floor and the focused test proves every lockfile copy remains safe.
- Revisit the deferred `deepmerge-ts` advisory when Prisma publishes a compatible dependency update; do not force the major override sooner.
