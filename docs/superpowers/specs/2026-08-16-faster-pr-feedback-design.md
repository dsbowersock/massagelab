# Faster PR Feedback Design

Date: 2026-08-16

Status: Approved design

Baseline: refreshed `origin/main` at `ccb2642c1d3f410a9dc41742c6d700a3c75c42aa`

Worktree: `.worktrees/ci-qa-review` on `codex/ci-qa-review`

## Purpose

Reduce the time from a pull-request update to trustworthy merge-ready feedback without removing any existing Prisma, lint, type, unit, build, or browser coverage. The branch also documents the complete PR-check system in plain language so repository operators can understand what runs, why it runs, which provider owns it, and how to diagnose failures.

## Current evidence

The repository-owned `.github/workflows/ci.yml` currently runs one sequential `qa` job for pull requests and pushes to `main`. Its steps are dependency installation, Chromium installation, Prisma validation, Prisma generation, lint, typecheck, unit tests, a Production Next.js build, and Browser QA.

Representative hosted evidence from successful pull-request run `31958461963` on 2026-08-16:

| Measurement | Baseline |
| --- | ---: |
| Complete `qa` job | 25m 13s |
| Browser QA step | 19m 43s |
| Browser share of elapsed job time | about 78% |
| Ordinary Playwright matrix | 310 cases in 9 files |
| Browser projects | desktop Chromium and mobile Chromium |
| CI Playwright workers | 1 |
| CI retries | 1 |
| Unit-test result at the worktree baseline | 2,502 passed, 1 skipped, 0 failed |

The same repository-owned workflow runs again after merge on a push to `main`; representative successful push run `31961697406` took 25m 14s. Pull-request concurrency already cancels superseded runs and must remain intact.

Additional pull-request signals are provider-owned rather than steps in `ci.yml`:

- GitHub default CodeQL analyzes Actions and JavaScript/TypeScript.
- Vercel builds a preview deployment and publishes preview status.
- CodeRabbit publishes review status.
- Dependabot and npm audit provide dependency-security signals but do not currently fail the repository-owned QA job.

The active default-branch ruleset prevents deletion and non-fast-forward updates. It does not currently require QA, CodeQL, Vercel, or CodeRabbit to pass before merge.

## Goals

1. Preserve the complete ordinary pull-request test matrix on every pull request.
2. Preserve the complete workflow on pushes to `main`.
3. Build the Production application once and reuse that exact build across four isolated browser lanes.
4. Keep one Playwright worker in each lane to avoid shared-runner CPU contention and shared-server state races.
5. Run code-quality validation independently from browser-build preparation so useful failures arrive early.
6. Produce one stable final `qa` result that truthfully represents every repository-owned required check.
7. Retain retries, traces, screenshots, timeouts, production-server behavior, and superseded-run cancellation.
8. Reach 13 minutes or less for a healthy cached pull-request workflow after runner start, subject to verification on GitHub-hosted runners.
9. Document the purpose, owner, local equivalent, and failure response for every pull-request signal.

## Non-goals

- Removing, skipping, or path-filtering existing tests to obtain a faster result.
- Moving the full browser suite to nightly or post-merge-only execution.
- Enabling `fullyParallel` or multiple Playwright workers inside one lane.
- Changing application behavior, data models, database state, production settings, Stripe state, or PHI boundaries.
- Fixing current npm audit or Dependabot findings in this branch.
- Reconfiguring CodeQL, Vercel, or CodeRabbit.
- Making any status check mandatory in repository rules during this branch.
- Changing the development-only visual-review spec exclusions used by ordinary Production-server QA.

## Chosen architecture

Each workflow begins two independent tracks:

```text
pull request or main push
|-- code-quality
|   |-- npm ci
|   |-- Prisma validate and generate
|   |-- lint
|   |-- typecheck
|   `-- unit tests
|
`-- browser-build
    |-- npm ci
    |-- Prisma generate
    |-- restore Next.js cache
    |-- Production Next.js build
    `-- upload exact build artifact
        |-- browser lane 1
        |-- browser lane 2
        |-- browser lane 3
        `-- browser lane 4

code-quality + browser-build + all four lanes
`-- final qa result
```

`code-quality` and `browser-build` start together. Browser lanes depend only on a successful `browser-build`, so they do not wait for lint, typecheck, or unit tests. The final `qa` job depends on both tracks and executes with always-run semantics so an upstream failure cannot become an ambiguous skipped summary.

## Job contracts

### Code quality

The code-quality job owns:

1. locked dependency installation;
2. Prisma schema validation;
3. Prisma client generation;
4. ESLint;
5. TypeScript checking; and
6. the complete Node unit-test suite.

The steps remain separately named so the first failing contract is visible without opening raw logs. The job does not build the application or install Chromium.

### Browser build

The browser-build job owns:

1. locked dependency installation;
2. Prisma client generation required by application imports;
3. restoration of the existing Next.js build cache;
4. one Production `next build`; and
5. publication of the exact `.next` runtime output required by `next start`.

The artifact excludes `.next/cache`, because cache entries are build inputs rather than runtime output. Upload configuration must explicitly include the hidden `.next` directory, bind the artifact name to the exact commit, and retain it for one day. Actions remain pinned by immutable commit SHA.

### Browser lanes

Each browser lane:

1. checks out the exact workflow commit;
2. sets up Node 24 with the npm cache;
3. runs `npm ci`;
4. regenerates the Prisma client required by server imports;
5. installs Chromium and its hosted-runner dependencies;
6. downloads the commit-bound build artifact;
7. starts the existing Production Playwright web server against that build;
8. runs its assigned project/spec pairs with one worker and the existing retry policy; and
9. uploads Playwright traces, screenshots, and test output when diagnostics exist.

Every lane uses the existing CI authentication placeholder and SMTP-disabled Playwright server environment. No lane receives production credentials, database rows, or external service secrets.

### Final QA result

The final job retains the stable check name `qa`. It runs after code quality, browser build, and the complete browser matrix even when an upstream result is failed, cancelled, or skipped. It succeeds only when code quality, browser build, and all four browser lanes report success. Its implementation reports the failed dependency names without inventing a second test result.

The repository ruleset remains unchanged. Making `qa` mandatory is a separate governance decision after several pull requests prove the new workflow stable.

## Browser-lane ownership

Naive Playwright `--shard=1/4` is not selected. The current configuration intentionally uses `fullyParallel: false`, so automatic sharding would distribute primarily by file rather than by individual test and would leave the large `public-routes` work uneven. Enabling full parallelism would also change the current state-isolation contract.

A focused lane manifest is the canonical owner of project/spec assignments. `playwright.config.ts` consumes a CI-only lane identifier and constructs only the project/spec combinations owned by that lane. An ordinary local `npm run test:browser` invocation remains unchanged and continues to run both configured projects with the existing development-review exclusions.

The current assignment is an evidence-driven rebalance based on median per-project, per-spec completion-time deltas from cold attempt 3 and warm attempts 4 and 5 of hosted run `32019891653` on exact commit `cff8a9f679c074e075d6b03995ad8bfbb833d225`. The previous assignment's per-lane browser-step medians were `353 / 289 / 280 / 278s`, a 26.98% spread. Deterministic longest-processing-time allocation of all 18 indivisible project/spec units predicts the raw-unit totals below; these estimates drive the rebalance and remain planning evidence, not accepted performance proof. A new cold-plus-two-warm exact-head proof is still required.

| Lane | Project/spec ownership | Estimated browser time |
| --- | --- | ---: |
| 1 | mobile `public-routes` | 281.100s |
| 2 | desktop `public-routes`, `immersive-panel-shell`, and `pwa`; mobile `immersive-panel-shell` | 277.707s |
| 3 | desktop `app-shell`; mobile `background-commerce` and `app-shell` | 291.400s |
| 4 | desktop `background-commerce`, `music-visualizer`, `local-first`, `admin-user-operations`, and `control-system-review`; mobile `music-visualizer`, `local-first`, `pwa`, `admin-user-operations`, and `control-system-review` | 277.264s |

The manifest exposes a pure validation surface used by unit tests. Validation rejects:

- an unknown or empty lane;
- an unknown Playwright project;
- an unknown or development-only ordinary-QA spec;
- a duplicate project/spec pair;
- a missing project/spec pair; or
- any lane count other than exactly four.

This makes full coverage a source-level invariant rather than a review convention. Future production-QA specs must be added to the manifest before the focused regression test passes.

## Failure and cancellation behavior

- A code-quality failure is visible immediately and makes final `qa` fail. Browser work already in progress may finish so its independent evidence is retained.
- A browser-build failure prevents all browser lanes from starting and makes final `qa` fail.
- One browser-lane failure does not stop the other lanes from producing evidence.
- Playwright keeps one CI retry and `trace: on-first-retry`; screenshots remain failure-only.
- Diagnostic upload steps run after a test failure and must not hide the original exit status.
- Browser diagnostics are retained for seven days; the one-day reusable build artifact remains separate.
- The final job distinguishes failed, cancelled, and skipped dependencies and fails for every non-success result.
- A newer commit on the same pull request cancels the superseded workflow through the existing concurrency group.
- A cancelled superseded workflow is not relabeled as a product regression.
- The existing 35-minute monolithic protection is replaced with exact bounds: 12 minutes for code quality, 12 minutes for browser build, 15 minutes for each browser lane, and 2 minutes for final `qa`.

## Caching and artifact boundaries

- `actions/setup-node` continues to cache npm download material keyed by the lockfile; `node_modules` is not shared as an artifact.
- Only the browser-build job restores and saves `.next/cache`.
- Browser lanes consume immutable runtime output from the exact browser-build job; they do not restore a mutable Next.js cache or run `next build`.
- The runtime artifact is not committed and is not reused across commits.
- Artifact download or extraction failure fails the affected lane before Playwright starts.
- The artifact contains no `.env` files, test results, credentials, or logs.

## Source and documentation boundaries

Expected implementation owners are:

- `.github/workflows/ci.yml` for job orchestration, caching, artifacts, diagnostics, and the final result;
- `tests/browser/ci-lanes.mjs` as the focused lane manifest for exact project/spec ownership and validation;
- `playwright.config.ts` for CI-only lane selection without changing ordinary local behavior;
- `tests/browser-qa-harness.test.mjs` for workflow, artifact, lane-completeness, and failure-summary contracts;
- `docs/wiki/ci-pr-checks.md` for the plain-language operator guide;
- `docs/wiki/index.md` and `docs/wiki/release-checklist.md` for discoverability and local validation references; and
- `docs/project-state.md` and `docs/project-log.md` for current state and before/after hosted evidence.

No application component, Prisma schema, migration, public asset, dependency version, or lockfile change is expected.

## CI and PR-checks guide

The new wiki page explains each signal with four questions: who owns it, what it proves, how it runs locally when applicable, and what a failure means.

It covers:

- locked dependency installation and the distinction between installation audit output and a failing QA gate;
- Prisma validation and generation;
- lint and typechecking;
- unit tests;
- the Production build;
- Browser QA projects, lane selection, retries, traces, screenshots, and local focused commands;
- the final `qa` summary;
- GitHub default CodeQL;
- Vercel preview status;
- CodeRabbit review status;
- Dependabot and npm audit signals;
- cache and artifact behavior;
- superseded-run cancellation;
- pushes to `main`; and
- the current non-required status of checks in repository rules.

The guide must not imply that a green provider status proves another provider's concern, or that an informational dependency alert is already remediated.

## Verification strategy

### Focused source contracts

Tests verify that:

- ordinary QA still resolves exactly 310 current Playwright cases at the approved baseline;
- both desktop and mobile projects remain covered;
- every ordinary project/spec pair belongs to exactly one of four lanes;
- development-only review specs remain outside ordinary QA;
- the workflow contains separate code-quality and browser-build jobs;
- browser lanes depend on and download the shared build rather than rebuilding;
- the upload explicitly includes `.next` while excluding `.next/cache`;
- every lane uses one worker and the existing retry/diagnostic contract;
- final `qa` uses always-run semantics and rejects every non-success upstream result;
- pull-request cancellation and pushes to `main` remain configured; and
- workflow permissions remain `contents: read` with unspecified scopes disabled.

### Local validation

Run focused CI-harness tests first, then Prisma validation and generation, lint, typecheck, the complete unit suite, the Production build, Playwright test listing for every lane and the combined ordinary matrix, and `git diff --check`. Local listing proves selection completeness; it does not substitute for hosted timing or browser execution.

### Hosted validation

The pull request is the authoritative integration test for GitHub Actions artifact transfer and hosted concurrency. For each successful workflow, record:

- workflow created, started, and completed times;
- code-quality and browser-build durations;
- each browser lane's setup and test duration;
- final `qa` outcome;
- total test counts and skip/retry/failure summaries; and
- whether diagnostic artifacts were produced and remained usable.

The initial workflow is rebalanced if the slowest browser execution is more than 20% slower than the fastest or if one lane is the clear critical path. A healthy cached workflow passes the speed goal when runner-start-to-final-`qa` completion is 13 minutes or less. Created-to-completed time is also reported so GitHub queue delay remains visible rather than being misattributed to repository execution.

At least three successful representative pull-request runs must preserve full counts, show no newly introduced recurring retry, and demonstrate stable artifact transfer before the branch is described as proven. One run must follow a change that invalidates the Next.js cache so the design is not accepted only on a warm-cache result.

## Rollback

The workflow change remains one branch-sized, reversible unit. Rollback restores the previous single sequential `qa` job and removes only the lane manifest and CI-specific tests/docs introduced by this branch. It does not require application, database, provider, or production-state rollback.

## Acceptance criteria

The design is fulfilled when:

- every current Prisma, lint, type, unit, build, and ordinary browser check still runs on every pull request;
- pushes to `main` retain the complete suite;
- the Production application is built once and reused by exactly four isolated browser lanes;
- project/spec ownership is complete, duplicate-free, deterministic, and regression-tested;
- ordinary local Playwright behavior remains unchanged;
- retries, traces, screenshots, timeouts, SMTP isolation, and superseded-run cancellation remain intact;
- final `qa` fails for every upstream non-success and never becomes ambiguously skipped;
- three representative hosted runs meet the coverage and stability contract;
- healthy cached runner time is 13 minutes or less, with cold-cache evidence recorded separately;
- the CI/PR-checks wiki explains repository-owned and provider-owned signals in plain language;
- repository merge rules remain unchanged; and
- the branch changes no product behavior, dependency version, lockfile, database state, or external provider configuration.
