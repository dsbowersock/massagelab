# CI and PR Checks

This guide explains the checks that run for a pull request and for a push to
`main`. It is an operator guide for the repository-owned CI workflow, not a
replacement for reviewing a change or its external provider statuses.

## What happens on a pull request

The CI workflow has two independent starting jobs. **Code quality** installs
dependencies, validates and generates Prisma, then runs lint, typecheck, and
unit tests. **Browser build** independently installs dependencies, restores the
Next.js build cache, generates Prisma, builds the application, and uploads the
runtime output as an artifact.

After **Browser build** succeeds, **Browser QA** starts a four-lane matrix. Each
lane downloads that same build artifact and runs only its assigned Playwright
project/spec pairs. `tests/browser/ci-lanes.mjs` is the canonical lane owner:
it validates that the four lanes cover every ordinary desktop- and
mobile-Chromium project/spec pair exactly once. Do not duplicate or hand-edit a
separate lane list in a workflow or runbook.

The final `qa` job always runs after `code_quality`, `browser_build`, and the
four-lane `browser_qa` matrix have concluded. It succeeds only when every
upstream result succeeded, giving pull requests one stable repository-owned QA
result.

## Repository-owned checks

| Check | Owner | Purpose | Local command | A failure usually means |
| --- | --- | --- | --- | --- |
| Dependency install | Every CI job | Reproduce the lockfile dependency graph. | `npm ci` | The lockfile, package manifest, registry access, or platform dependency setup is inconsistent. |
| Prisma validation | `code_quality` | Validate the Prisma schema before code-quality checks. | `npm run prisma:validate` | The schema is invalid or the checked-in Prisma configuration is inconsistent. |
| Prisma generation | `code_quality`, `browser_build`, and each `browser_qa` lane | Generate the Prisma client needed by following commands. | `npm run prisma:generate` | Prisma generation cannot produce the client from the current schema and dependencies. |
| Lint | `code_quality` | Enforce repository lint rules. | `npm run lint` | A source or configuration lint rule is violated. |
| Typecheck | `code_quality` | Check TypeScript without emitting output. | `npm run typecheck` | A type contract or TypeScript configuration is invalid. |
| Unit tests | `code_quality` | Exercise the Node unit-test suite. | `npm run test` | A tested behavior or test environment assumption failed. |
| Next build | `browser_build` | Build the production application used by browser QA. | `npm run build` | A production build, static generation, or build-time dependency failed. |
| Browser QA | `browser_qa` matrix | Run the exact Playwright partition against the built runtime. | `npm run test:browser` | The assigned browser behavior failed, the lane mapping is invalid, or browser/runtime setup failed. |
| Final `qa` | `qa` | Aggregate Code quality, Browser build, and all Browser QA lanes. | Run the preceding commands and all four lane discoveries described below. | At least one upstream repository-owned result was not successful. |

## External checks

| Check or signal | What it covers | Relationship to repository QA |
| --- | --- | --- |
| CodeQL | GitHub's default analysis of Actions and JavaScript/TypeScript. | Valuable security analysis, but not a replacement for repository QA. |
| Vercel | Preview deployment build and preview status. | Deployment feedback, not a replacement for repository QA. |
| CodeRabbit | Automated code-review status and findings. | Review feedback, not a replacement for repository QA. |
| Dependabot | Dependency update and security-update signal. | Informational for this lane; it is not a current `qa` gate. |
| `npm audit` | Dependency advisory signal that can be run locally. | Informational for this lane; it is not a current `qa` gate. |

## Caching, artifacts, retries, and cancellation

- **Next.js cache:** Browser build restores and saves `.next/cache` using the
  lockfile and relevant application/configuration sources in its cache key. The
  cache speeds builds; it is not the browser runtime artifact.
- **Runtime artifact:** Browser build uploads `.next` excluding `.next/cache`.
  The artifact is named for the commit and run attempt, retained for one day,
  and downloaded by every Browser QA lane.
- **Diagnostics:** Every Browser QA lane uploads `test-results` even on
  failure. These diagnostics are retained for seven days when present.
- **Retries:** Playwright retries a failed test once in CI and captures a trace
  on the first retry; local runs do not retry by default.
- **Cancellation:** A newer run for the same pull request cancels the earlier
  in-progress pull-request run. Pushes to `main` execute the identical workflow
  without that pull-request cancellation behavior.

## Diagnosing a browser-lane failure

Start with the failing lane number and its `browser-diagnostics` artifact in
the workflow run. The lane ID maps to its projects and spec filenames only
through `tests/browser/ci-lanes.mjs`; inspect that file to identify the exact
assignment. Then reproduce the project/spec locally. For example:

```powershell
$env:PLAYWRIGHT_CI_LANE = "3"; npm run test:browser
Remove-Item Env:PLAYWRIGHT_CI_LANE
npx playwright test tests/browser/public-routes.spec.ts --project=mobile-chromium
```

Use `npx playwright test --list` before an expensive run when confirming a
partition. Always remove `PLAYWRIGHT_CI_LANE` after a lane-scoped command so
ordinary local discovery returns to the full project matrix.

## Current enforcement

This is a verified snapshot dated **2026-08-16**, not a permanent guarantee:
the current GitHub repository ruleset blocks deletion of the default branch and
non-fast-forward updates, but does not currently require status checks. In
particular, it does not require `qa`, CodeQL, Vercel, or CodeRabbit to pass
before merge. Changing that enforcement is a separate repository-governance
decision after the workflow has proven stable.
