# Faster PR Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the complete pull-request QA surface while reducing healthy PR feedback from roughly 25 minutes to 13 minutes or less by building once and running the ordinary Playwright suite in four balanced parallel lanes.

**Architecture:** Split the current sequential `qa` workflow into independent code-quality and browser-build jobs. Upload the built `.next` runtime once, download it into four deterministic browser lanes, and finish with a stable `qa` aggregation job. Keep lane ownership in a tested repository manifest so every ordinary Playwright project/spec pair runs exactly once.

**Tech Stack:** GitHub Actions, Node.js/npm, Next.js, Prisma, Playwright, Node's built-in test runner, PowerShell, GitHub CLI.

## Global Constraints

- Work only in `C:\Users\derri\code\my_projects\massagelab\.worktrees\ci-qa-review` on `codex/ci-qa-review`.
- Do not modify, clean, reset, or otherwise operate on the user's other checkouts or worktrees.
- Preserve all 310 currently listed ordinary Playwright tests across the two configured projects on every pull request and `main` push.
- Do not add path filters, remove checks, change provider configuration, or change branch/ruleset enforcement.
- Keep `qa` as the stable aggregate status name.
- Do not change dependencies, `package.json`, `package-lock.json`, product behavior, database schema, environment contracts, or secrets.
- Pin artifact actions to the reviewed commit SHAs in this plan.
- Add focused JSDoc for the lane manifest's non-obvious validation and resolution behavior.
- Treat `docs/project-state.md` and `docs/project-log.md` as proof records: update them only after hosted runs establish the outcome.
- Verify review findings against the current code before changing anything.
- Stop before merge and ask the user for authorization.

---

## Task 1: Define and test deterministic browser-QA lanes

**Files:**

- Create: `tests/browser/ci-lanes.mjs`
- Modify: `playwright.config.ts`
- Modify: `tests/browser-qa-harness.test.mjs`

### Step 1: Add failing lane-contract tests

- [ ] In `tests/browser-qa-harness.test.mjs`, import these exports from `./browser/ci-lanes.mjs`:

```js
import {
  BROWSER_QA_LANES,
  BROWSER_QA_PROJECT_NAMES,
  ORDINARY_BROWSER_QA_SPEC_FILES,
  assertBrowserQaLaneCoverage,
  resolveCiBrowserQaLaneProjects,
} from "./browser/ci-lanes.mjs";
```

- [ ] Add tests proving all of the following:

  - the manifest contains exactly four non-empty lanes;
  - the expected cross-product of two project names and nine ordinary spec files contains 18 unique pairs;
  - every expected pair appears exactly once across the four lanes;
  - no development/review-only spec is in the manifest;
  - an unknown lane ID is rejected;
  - an absent or blank lane environment value returns `null` so ordinary local Playwright behavior stays unchanged;
  - resolving each approved lane returns only its exact project/spec assignments.

- [ ] Use these exact expected values in the tests:

```js
const expectedProjects = ["desktop-chromium", "mobile-chromium"];
const expectedSpecs = [
  "admin-user-operations.spec.ts",
  "app-shell.spec.ts",
  "background-commerce.spec.ts",
  "control-system-review.spec.ts",
  "immersive-panel-shell.spec.ts",
  "local-first.spec.ts",
  "music-visualizer.spec.ts",
  "public-routes.spec.ts",
  "pwa.spec.ts",
];
```

- [ ] Run the focused test and confirm it fails because the lane module does not exist yet:

```powershell
node --test tests/browser-qa-harness.test.mjs
```

Expected: failure resolving `tests/browser/ci-lanes.mjs`.

### Step 2: Implement the lane manifest and its invariant checks

- [ ] Create `tests/browser/ci-lanes.mjs` with these exported constants and exact assignments. The assignment below is the evidence-driven rebalance derived from median project/spec timings across cold attempt 3 and warm attempts 4 and 5 of hosted run `32019891653` on exact commit `cff8a9f679c074e075d6b03995ad8bfbb833d225`. The previous assignment's per-lane browser-step medians were `353 / 289 / 280 / 278s` (26.98% spread); deterministic longest-processing-time allocation predicted raw-unit totals of `281.100 / 277.707 / 291.400 / 277.264s` (5.10% spread). Those were planning estimates rather than accepted performance proof. The later accepted cold-plus-two-warm exact-head result is recorded in `docs/wiki/ci-pr-checks.md` with medians of `288 / 291 / 291 / 325s` (12.85% spread):

```js
export const BROWSER_QA_PROJECT_NAMES = [
  "desktop-chromium",
  "mobile-chromium",
];

export const ORDINARY_BROWSER_QA_SPEC_FILES = [
  "admin-user-operations.spec.ts",
  "app-shell.spec.ts",
  "background-commerce.spec.ts",
  "control-system-review.spec.ts",
  "immersive-panel-shell.spec.ts",
  "local-first.spec.ts",
  "music-visualizer.spec.ts",
  "public-routes.spec.ts",
  "pwa.spec.ts",
];

export const BROWSER_QA_LANES = {
  "1": {
    "mobile-chromium": [
      "public-routes.spec.ts",
    ],
  },
  "2": {
    "desktop-chromium": [
      "public-routes.spec.ts",
      "immersive-panel-shell.spec.ts",
      "pwa.spec.ts",
    ],
    "mobile-chromium": [
      "immersive-panel-shell.spec.ts",
    ],
  },
  "3": {
    "desktop-chromium": [
      "app-shell.spec.ts",
    ],
    "mobile-chromium": [
      "background-commerce.spec.ts",
      "app-shell.spec.ts",
    ],
  },
  "4": {
    "desktop-chromium": [
      "background-commerce.spec.ts",
      "music-visualizer.spec.ts",
      "local-first.spec.ts",
      "admin-user-operations.spec.ts",
      "control-system-review.spec.ts",
    ],
    "mobile-chromium": [
      "music-visualizer.spec.ts",
      "local-first.spec.ts",
      "pwa.spec.ts",
      "admin-user-operations.spec.ts",
      "control-system-review.spec.ts",
    ],
  },
};
```

- [ ] Implement `assertBrowserQaLaneCoverage(lanes = BROWSER_QA_LANES)` as a pure validation function. Give it focused JSDoc explaining that it enforces exact-once coverage of the ordinary project/spec cross-product. It must throw descriptive errors for:

  - anything other than exactly four lane IDs;
  - an empty lane;
  - an unknown Playwright project;
  - an unknown ordinary spec;
  - a duplicate project/spec pair;
  - a missing project/spec pair.

- [ ] Implement `resolveCiBrowserQaLaneProjects(laneId)` with focused JSDoc. It must:

  - return `null` when `laneId` is absent or whitespace-only;
  - trim the lane ID;
  - validate the full manifest before resolving it;
  - throw a descriptive error for an unknown lane;
  - return only non-empty Playwright project descriptors in this shape:

```js
{
  name: "desktop-chromium",
  testMatch: [
    "**/public-routes.spec.ts",
    "**/app-shell.spec.ts",
  ],
}
```

- [ ] Run the focused test again:

```powershell
node --test tests/browser-qa-harness.test.mjs
```

Expected: lane-contract tests pass; any existing harness tests remain green.

### Step 3: Make Playwright consume a lane only when CI requests one

- [ ] Import `resolveCiBrowserQaLaneProjects` into `playwright.config.ts`.

- [ ] Extract the existing desktop and mobile project definitions into an `ordinaryProjects` array without changing their devices, viewport settings, names, or other options.

- [ ] Resolve `process.env.PLAYWRIGHT_CI_LANE` once. When the resolver returns `null`, configure Playwright with the existing complete `ordinaryProjects` array. When it returns lane descriptors, merge each descriptor's `testMatch` into the corresponding ordinary project and configure only those lane projects.

- [ ] Keep all current development-spec ignores, `fullyParallel`, retry, worker, reporter, `use`, and `webServer` behavior unchanged.

### Step 4: Verify ordinary and lane-specific discovery

- [ ] Run the focused contract test and TypeScript check:

```powershell
node --test tests/browser-qa-harness.test.mjs
npm run typecheck
```

Expected: both commands pass.

- [ ] Confirm ordinary discovery still lists 310 tests:

```powershell
npx playwright test --list
```

Expected final line: `Total: 310 tests in 9 files`.

- [ ] List every lane independently:

```powershell
$env:PLAYWRIGHT_CI_LANE = "1"; npx playwright test --list
$env:PLAYWRIGHT_CI_LANE = "2"; npx playwright test --list
$env:PLAYWRIGHT_CI_LANE = "3"; npx playwright test --list
$env:PLAYWRIGHT_CI_LANE = "4"; npx playwright test --list
Remove-Item Env:PLAYWRIGHT_CI_LANE
```

Expected: every command succeeds and its listed project/spec pairs match the manifest. The contract test is the authoritative exact-once coverage proof.

- [ ] Confirm the worktree diff is whitespace-clean:

```powershell
git diff --check
```

- [ ] Commit Task 1:

```powershell
git add tests/browser/ci-lanes.mjs playwright.config.ts tests/browser-qa-harness.test.mjs
git commit -m "test: define browser QA lanes"
```

---

## Task 2: Split the GitHub Actions workflow and aggregate its result

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `tests/browser-qa-harness.test.mjs`

### Step 1: Add failing workflow source-contract tests

- [ ] Extend the existing CI workflow assertions in `tests/browser-qa-harness.test.mjs` to require:

  - jobs named `code_quality`, `browser_build`, `browser_qa`, and `qa`;
  - `code_quality` and `browser_build` can start independently;
  - `npm run build` appears exactly once in the workflow source;
  - the browser matrix contains the exact lanes `["1", "2", "3", "4"]` and `fail-fast: false`;
  - `PLAYWRIGHT_CI_LANE` is populated from `matrix.lane`;
  - `browser_qa` depends on `browser_build`;
  - the build artifact name contains both `${{ github.sha }}` and `${{ github.run_attempt }}`;
  - the `.next` upload excludes `.next/cache/**`, fails when files are missing, includes hidden files, and retains the artifact for one day;
  - the browser diagnostic upload is guarded by `always()`, targets `test-results`, ignores missing files, includes hidden files, and retains diagnostics for seven days;
  - the upload and download actions use the exact reviewed SHAs below;
  - timeouts are 12 minutes for quality, 12 minutes for build, 15 minutes per browser lane, and 2 minutes for the final aggregate;
  - the final `qa` job uses `always()`, needs all three upstream job groups, and rejects any dependency result other than `success`;
  - existing `pull_request`/`main` triggers, `contents: read`, and PR concurrency cancellation remain present;
  - Prisma generation occurs before typecheck and before the browser run.

- [ ] Run the focused test and confirm the new assertions fail against the current sequential job:

```powershell
node --test tests/browser-qa-harness.test.mjs
```

Expected: failures identify the missing split-job workflow structure.

### Step 2: Implement the independent code-quality job

- [ ] Replace the current single `qa` implementation in `.github/workflows/ci.yml` with a `code_quality` job named `Code quality` and `timeout-minutes: 12`.

- [ ] Preserve the current runner, Node version, npm cache behavior, authentication-safe environment values, and pinned checkout/setup actions.

- [ ] Run these steps in order:

```yaml
- run: npm ci
- run: npm run prisma:validate
- run: npm run prisma:generate
- run: npm run lint
- run: npm run typecheck
- run: npm run test
```

- [ ] Do not add a `needs` relationship to `code_quality`, so it begins immediately.

### Step 3: Build once and publish the runtime artifact

- [ ] Add `browser_build`, named `Browser build`, with `timeout-minutes: 12` and no dependency on `code_quality`.

- [ ] Preserve checkout, setup-node, `npm ci`, and the existing Next.js cache step. Change only the cache key prefix from `nextjs-` to `nextjs-v2-` so the first hosted proof run deliberately exercises a cold cache and later runs can exercise the warm path.

- [ ] Run Prisma generation, then run `npm run build` exactly once in the workflow.

- [ ] Upload the runtime with `actions/upload-artifact` pinned exactly to:

```yaml
uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
with:
  name: next-runtime-${{ github.sha }}-${{ github.run_attempt }}
  path: |
    .next
    !.next/cache/**
  if-no-files-found: error
  retention-days: 1
  include-hidden-files: true
```

### Step 4: Run four complete, balanced browser lanes

- [ ] Add `browser_qa`, named `Browser QA (lane ${{ matrix.lane }})`, with `needs: browser_build`, `timeout-minutes: 15`, and this exact strategy:

```yaml
strategy:
  fail-fast: false
  matrix:
    lane: ["1", "2", "3", "4"]
```

- [ ] Set `PLAYWRIGHT_CI_LANE: ${{ matrix.lane }}` for the job.

- [ ] In each lane, run checkout, setup-node, `npm ci`, `npm run prisma:generate`, and the existing Chromium-only Playwright installation command.

- [ ] Download the build artifact with `actions/download-artifact` pinned exactly to:

```yaml
uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c
with:
  name: next-runtime-${{ github.sha }}-${{ github.run_attempt }}
  path: .next
```

- [ ] Run the unchanged repository browser command:

```yaml
- run: npm run test:browser
```

- [ ] Upload lane diagnostics after the browser step, even on failure:

```yaml
- if: ${{ always() }}
  uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
  with:
    name: browser-diagnostics-${{ github.sha }}-${{ github.run_attempt }}-lane-${{ matrix.lane }}
    path: test-results
    if-no-files-found: ignore
    retention-days: 7
    include-hidden-files: true
```

### Step 5: Restore `qa` as a stable aggregate status

- [ ] Add a final job with job ID and display name `qa`. Give it `timeout-minutes: 2`, `if: ${{ always() }}`, and these dependencies:

```yaml
needs:
  - code_quality
  - browser_build
  - browser_qa
```

- [ ] Add one shell step that prints each dependency result and exits non-zero unless all three results equal `success`. Use explicit environment variables so expressions are evaluated by Actions before the shell runs:

```yaml
env:
  CODE_QUALITY_RESULT: ${{ needs.code_quality.result }}
  BROWSER_BUILD_RESULT: ${{ needs.browser_build.result }}
  BROWSER_QA_RESULT: ${{ needs.browser_qa.result }}
run: |
  failed=0
  for dependency_result in \
    "code_quality=$CODE_QUALITY_RESULT" \
    "browser_build=$BROWSER_BUILD_RESULT" \
    "browser_qa=$BROWSER_QA_RESULT"; do
    dependency="${dependency_result%%=*}"
    result="${dependency_result#*=}"
    echo "$dependency: $result"
    if [ "$result" != "success" ]; then
      echo "::error::$dependency returned $result"
      failed=1
    fi
  done
  exit "$failed"
```

This intentionally makes cancellation, skipped dependencies, build failures, and any failed matrix lane visible as a failed final `qa` status.

### Step 6: Verify and commit the workflow split

- [ ] Run focused tests, typechecking, and diff validation:

```powershell
node --test tests/browser-qa-harness.test.mjs
npm run typecheck
git diff --check
```

Expected: all commands pass.

- [ ] Inspect the workflow diff and confirm `npm run build` occurs once and `npm run test:browser` occurs once in the matrix job definition:

```powershell
git diff -- .github/workflows/ci.yml tests/browser-qa-harness.test.mjs
rg -n "npm run build|npm run test:browser|timeout-minutes|upload-artifact|download-artifact" .github/workflows/ci.yml
```

- [ ] Commit Task 2:

```powershell
git add .github/workflows/ci.yml tests/browser-qa-harness.test.mjs
git commit -m "ci: parallelize browser QA"
```

---

## Task 3: Explain the PR check system and complete local validation

**Files:**

- Create: `docs/wiki/ci-pr-checks.md`
- Modify: `docs/wiki/index.md`
- Modify: `docs/wiki/release-checklist.md`

### Step 1: Write the operator-facing CI and PR checks guide

- [ ] Create `docs/wiki/ci-pr-checks.md` with these sections:

  1. **What happens on a pull request** — explain the independent `Code quality` and `Browser build` starts, the build artifact, four browser lanes, and final `qa` aggregation.
  2. **Repository-owned checks** — a table covering `npm ci`, Prisma validation/generation, lint, typecheck, unit tests, Next build, browser QA, and final `qa`. For each, state its owner, purpose, local command, and what a failure usually means.
  3. **External checks** — a table explaining CodeQL, Vercel, CodeRabbit, Dependabot, and `npm audit`; make clear that CodeQL/Vercel/CodeRabbit are not replacements for repository QA and that Dependabot/`npm audit` are not current `qa` gates.
  4. **Caching, artifacts, retries, and cancellation** — document `.next` cache behavior, the one-day runtime artifact, seven-day diagnostics, one Playwright retry on CI, PR concurrency cancellation, and identical workflow execution on `main` pushes.
  5. **Diagnosing a browser-lane failure** — explain how the lane ID maps through `tests/browser/ci-lanes.mjs`, where artifacts appear, and how to rerun the exact project/spec locally.
  6. **Current enforcement** — state that the repository's current GitHub ruleset blocks default-branch deletion and non-fast-forward updates but does not currently require status checks. Describe this as a verified snapshot dated 2026-08-16, not a permanent guarantee.

- [ ] Include these focused local diagnosis examples:

```powershell
$env:PLAYWRIGHT_CI_LANE = "3"; npm run test:browser
Remove-Item Env:PLAYWRIGHT_CI_LANE
npx playwright test tests/browser/public-routes.spec.ts --project=mobile-chromium
```

- [ ] Do not include secrets, environment values, database data, credentials, or PHI-bearing examples.

### Step 2: Link the guide from stable operational docs

- [ ] Add `CI and PR checks` to `docs/wiki/index.md` near local-development and release operations.

- [ ] Update the automated-gate section of `docs/wiki/release-checklist.md` to link to the new guide and explain that the stable `qa` result aggregates code quality, build, and all browser lanes.

- [ ] Do not yet edit `docs/project-state.md` or `docs/project-log.md`; hosted results do not exist at this point.

### Step 3: Run the complete local validation surface

- [ ] Run each validation separately so failures remain attributable:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run lint
npm run typecheck
npm run test
npm run build
node --test tests/browser-qa-harness.test.mjs
npx playwright test --list
```

Expected: every command passes; ordinary Playwright discovery remains 310 tests in 9 files.

- [ ] Re-run all four lane discovery commands and clear the environment afterward:

```powershell
$env:PLAYWRIGHT_CI_LANE = "1"; npx playwright test --list
$env:PLAYWRIGHT_CI_LANE = "2"; npx playwright test --list
$env:PLAYWRIGHT_CI_LANE = "3"; npx playwright test --list
$env:PLAYWRIGHT_CI_LANE = "4"; npx playwright test --list
Remove-Item Env:PLAYWRIGHT_CI_LANE
```

- [ ] Confirm a clean diff and review the documentation changes:

```powershell
git diff --check
git diff -- docs/wiki/ci-pr-checks.md docs/wiki/index.md docs/wiki/release-checklist.md
```

- [ ] Commit Task 3:

```powershell
git add docs/wiki/ci-pr-checks.md docs/wiki/index.md docs/wiki/release-checklist.md
git commit -m "docs: explain CI and PR checks"
```

---

## Task 4: Review, prove hosted performance, and record verified results

**Files:**

- Potentially modify, only if evidence requires rebalancing: `tests/browser/ci-lanes.mjs`
- Potentially modify with matching coverage expectations: `tests/browser-qa-harness.test.mjs`
- Modify after hosted proof: `docs/wiki/ci-pr-checks.md`
- Modify after hosted proof: `docs/project-state.md`
- Modify after hosted proof: `docs/project-log.md`

### Step 1: Review the exact local branch before publication

- [ ] Invoke the `coderabbit:code-review` skill and run its documented local exact-head review against refreshed `origin/main`. Resolve only findings verified against the current code, then rerun the review until it is genuinely clean.

- [ ] Run final pre-publication validation:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
node --test tests/browser-qa-harness.test.mjs
git diff --check
git status --short
```

Expected: all commands pass and `git status --short` is empty.

### Step 2: Push and open the pull request

- [ ] Refresh remote state without touching other worktrees, then verify this branch still has the intended base relationship:

```powershell
git fetch origin
git merge-base --is-ancestor origin/main HEAD
```

Expected: the ancestry command exits zero. If it does not, stop and reconcile this isolated branch with current `origin/main` before pushing.

- [ ] Push the branch and open a PR describing the workflow split, preserved coverage, the stable `qa` aggregate, the new guide, and the hosted proof plan:

```powershell
git push -u origin codex/ci-qa-review
gh pr create --base main --head codex/ci-qa-review --title "Speed up PR feedback without reducing QA" --body-file PR_BODY.md
Remove-Item -LiteralPath PR_BODY.md
```

Before running the command, create the PR body through the approved editing workflow, use it only for the PR submission, and do not commit it. The explicit cleanup keeps the worktree clean. Do not include memory citations in the PR body.

### Step 3: Capture one cold-cache and at least two warm-cache successes

- [ ] Watch the first PR run. Because the cache prefix changed to `nextjs-v2-`, treat this as the cold-cache measurement:

```powershell
gh pr checks --watch
gh run list --branch codex/ci-qa-review --workflow CI --limit 5
```

- [ ] Record the run ID and inspect its jobs and step timing:

```powershell
gh run view RUN_ID --json jobs,conclusion,createdAt,updatedAt,url
```

Replace `RUN_ID` with the numeric ID printed by `gh run list`.

- [ ] Rerun the same workflow twice so the same commit receives two warm-cache measurements:

```powershell
gh run rerun RUN_ID
gh run watch RUN_ID --exit-status
gh run rerun RUN_ID
gh run watch RUN_ID --exit-status
```

- [ ] After each attempt, capture job and step timing with `gh run view`. Confirm all of these acceptance criteria across at least three successful attempts:

  - ordinary coverage remains 310 tests in 9 spec files before lane filtering;
  - all four lane jobs succeed and the final `qa` succeeds;
  - per-lane browser-step medians across the accepted one-cold plus two-warm exact-head window differ by no more than 20%, calculated as `(slowest median - fastest median) / fastest median`; individual-run spread is recorded as diagnostic evidence rather than used as the balance gate;
  - healthy end-to-end feedback, measured from the earliest runner job start to final `qa` completion, is 13 minutes or less;
  - at least one measurement is cold-cache and at least two are warm-cache;
  - no new recurring Playwright retry appears.

### Step 4: Rebalance only if hosted evidence requires it

- [ ] If the per-lane median spread across the accepted hosted window exceeds the 20% balance threshold, extract per-project/spec durations from the successful hosted logs.

- [ ] Reassign the 18 project/spec units with longest-processing-time greedy allocation: sort units from slowest to fastest and place each next unit in the currently lightest lane. Preserve exactly four non-empty lanes and exactly-once coverage.

- [ ] Update only `tests/browser/ci-lanes.mjs` and the matching exact-assignment expectations in `tests/browser-qa-harness.test.mjs`.

- [ ] Validate and commit any evidence-driven rebalance:

```powershell
node --test tests/browser-qa-harness.test.mjs
npm run typecheck
npx playwright test --list
git diff --check
git add tests/browser/ci-lanes.mjs tests/browser-qa-harness.test.mjs
git commit -m "ci: rebalance browser QA lanes"
git push
```

- [ ] Restart the three-successful-run proof for the new exact head. Do not claim the target from results belonging to an older commit.

### Step 5: Record only verified hosted results

- [ ] After the exact head meets the acceptance criteria, update `docs/wiki/ci-pr-checks.md` with:

  - the exact commit SHA measured;
  - the cold and warm run URLs;
  - the cold miss/save and warm exact-primary-hit cache truth;
  - total time-to-`qa` for each attempt;
  - per-lane browser durations, medians, and spread;
  - whether retries occurred;
  - the before/after comparison against the observed roughly 25-minute sequential baseline.

- [ ] Add a concise 2026-08-17 current-state bullet to `docs/project-state.md` describing the verified four-lane PR QA architecture and measured feedback time.

- [ ] Add a 2026-08-17 chronological entry to `docs/project-log.md` recording the implementation, validation commands, hosted run evidence, preserved coverage, and any remaining operational caveat.

- [ ] Validate and commit the proof record:

```powershell
git diff --check
git diff -- docs/wiki/ci-pr-checks.md docs/project-state.md docs/project-log.md docs/superpowers/specs/2026-08-16-faster-pr-feedback-design.md docs/superpowers/plans/2026-08-16-faster-pr-feedback.md
git add docs/wiki/ci-pr-checks.md docs/project-state.md docs/project-log.md docs/superpowers/specs/2026-08-16-faster-pr-feedback-design.md docs/superpowers/plans/2026-08-16-faster-pr-feedback.md
git commit -m "docs: record faster CI proof"
git push
```

### Step 6: Shepherd the final PR checks and stop at the merge gate

- [ ] Watch the final exact-head checks, including repository QA, CodeQL, Vercel, and CodeRabbit:

```powershell
gh pr checks --watch
```

- [ ] Inspect any failure or review comment against the current exact head. Apply only supported fixes, rerun proportionate validation, push, and explicitly resolve addressed review threads.

- [ ] Confirm the branch is clean and report the final handoff:

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
gh pr view --json number,url,state,headRefName,baseRefName,statusCheckRollup
```

- [ ] Stop before merge. Give the user the worktree, branch, HEAD, PR URL, validation results, measured cold/warm timing, lane spread, unresolved items if any, and the explicit merge-authorization gate.
