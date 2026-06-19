# CI Build Cache

## Goal

Reduce GitHub Actions CI time for repeated pull-request runs by persisting build artifacts that are safe and useful to reuse across runs.

## Scope

- Keep the existing `actions/setup-node` npm cache for package download data.
- Add a dedicated Next.js build cache restore/save step for `${{ github.workspace }}/.next/cache`.
- Key the cache by runner OS, `package-lock.json`, framework config files, Prisma schema files, and application source files so dependency or source changes refresh the primary cache while still allowing package-lock restore fallbacks.
- Cancel stale pull-request CI runs when newer commits are pushed to the same PR.
- Keep local `npm run build` behavior unchanged while letting CI call `npm run build:next` after the explicit Prisma generate step, avoiding a second Prisma client generation inside the build step.
- Keep Playwright browser installation explicit and uncached for now. Playwright's CI guidance still recommends installing browsers and Linux dependencies in CI; caching browser binaries would not avoid OS dependency setup and can cost about as much to restore as to download.

## Implementation Notes

- `.github/workflows/ci.yml` now restores `.next/cache` with a pinned `actions/cache@v4` SHA.
- The npm cache remains owned by `actions/setup-node` with `cache: npm`; the new cache step does not duplicate `~/.npm`.
- Browser QA still runs after the CI build step, so the restored Next.js cache benefits the build that produces the production server used by Playwright.
- CI keeps explicit `npm run prisma:validate` and `npm run prisma:generate` steps, then calls `npm run build:next` so `prebuild` does not generate Prisma a second time. Local `npm run build` still runs `prebuild`.
- Pull-request concurrency cancellation is limited to PR events; `main` push runs keep their normal completion behavior.

## References

- Next.js CI build caching: https://nextjs.org/docs/app/guides/ci-build-caching
- `actions/setup-node` dependency cache behavior: https://github.com/actions/setup-node#caching-global-packages-data
- Playwright CI browser installation guidance: https://playwright.dev/docs/ci

## Validation

- YAML/workflow shape inspection.
- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run build:next`
- `npm run lint`
- `git diff --check`
- Existing CI remains the source of truth for cache behavior on GitHub-hosted runners.
