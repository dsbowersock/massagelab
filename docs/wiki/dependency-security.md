# Dependency Security Notes

Last reviewed: September 4, 2026.

Security Fix Waves 1 and 2 are merged. The September maintenance gate raises
all currently compatible transitive copies to their reviewed patched floors
and moves the GitHub-hosted build cache action to its Node 24 release. The
inventory is not recorded as clean: one advisory remains in Prisma's trusted
CLI/config dependency graph pending an upstream-compatible major update.

## Current Findings

- `next@16.2.12` closes the confirmed App Router Server Action denial-of-service
  and endpoint-ID disclosure findings. MassageLab continues to authenticate and
  authorize inside each Server Action boundary.
- `next-auth@5.0.0-beta.32`, `@auth/prisma-adapter@2.11.3`, and
  `@auth/core@0.41.3` close the current Auth.js alerts. Existing auth checks use
  concrete session-user properties, Credentials/Google remain the only
  providers, and Auth.js email/magic-link sign-in remains disabled.
- Next's bundled PostCSS and Sharp copies are overridden to `postcss@8.5.28`
  and `sharp@0.35.3`. The top-level PostCSS range starts at `8.5.28` and the
  current lock resolves every PostCSS copy at `8.5.28`.
- Auth.js does not enable its optional email provider. MassageLab imports
  patched `nodemailer@9.0.3` through the `nodemailer-v9` npm alias for its own
  account mailer, whose private boundary accepts only fixed text fields and
  disables file and URL access.
- Prisma `7.9.1` removes the former Prisma Hono path. shadcn's development-only
  Hono paths resolve through `hono@4.12.34` and `@hono/node-server@2.0.10`.
  Reviewed `brace-expansion`, `fast-uri`, `browserslist`, `nanoid`, `mysql2`,
  `body-parser`, `qs`, `@humanfs/node`, and `@babel/core` copies are pinned at
  or above their patched floors.
- `deepmerge-ts@7.1.5` remains because Prisma `7.9.1` and the available `7.10.0`
  release both declare that exact version through `@prisma/config`. MassageLab
  does not import `deepmerge-ts`; the package is reached only through the
  trusted Prisma CLI/config path. Forcing `deepmerge-ts@8` would cross a major
  compatibility boundary, so this residual remains tracked until Prisma adopts
  a compatible release.

## Latest Dependency Updates

- `next` and `eslint-config-next` were updated from `16.2.6` through `16.2.11`
  to `16.2.12`.
- `next-auth` was updated from `5.0.0-beta.31` to `5.0.0-beta.32`;
  `@auth/prisma-adapter` moved to `2.11.3`, leaving one deduplicated
  `@auth/core@0.41.3` resolution.
- `ws` was updated from `8.20.0` to `8.21.0`, superseding Dependabot PR #31's `8.20.1` security bump for GHSA-58qx-3vcg-4xpx.
- Top-level `postcss` moved from `8.5.14` through `8.5.15` to the patched
  `^8.5.18` range, currently resolved at `8.5.25`; Next's nested copy is
  overridden from `8.4.31` to `8.5.18`.
- Fix Wave 2 moves Prisma packages from `7.8.0` to `7.9.1`, shadcn from
  `4.7.0` to `4.16.1`, and replaces the vulnerable Nodemailer 7 runtime with
  the patched Nodemailer 9 alias. Narrow overrides cover remaining reviewed
  transitive copies without broad dependency cleanup.
- The post-merge closure raises the development-only `@hono/node-server` copy
  from `2.0.5` to `2.0.10` for GHSA-9mqv-5hh9-4cgg. MassageLab does not import
  Hono or expose the advisory's WebSocket upgrade route.
- The September maintenance gate raises PostCSS to `8.5.28`, fast-uri to
  `3.1.7`, Browserslist to `4.28.9`, nanoid to `3.3.18`, mysql2 to `3.24.3`,
  brace-expansion major lines to `1.1.18`, `2.1.4`, and `5.0.9`, Hono to
  `4.12.34`, body-parser to `2.3.0`, qs to `6.16.0`, and `@humanfs/node` to
  `0.16.8`. These are narrow transitive overrides; framework and application
  package versions remain unchanged.
- The Next.js build-cache step is pinned to official `actions/cache@v6.1.0`,
  whose action runtime is Node 24. Cache paths, keys, and restore behavior are
  unchanged, and the workflow continues to use GitHub-hosted runners.

## Current Audit Count

A fresh exact-lock closure install currently reports:

- Low: 0
- Moderate: 0
- High: 5
- Critical: 0

The full and `--omit=dev` audits both report the same five affected nodes, all
propagated from the single `deepmerge-ts` advisory described above. npm's omit
view retains this chain because Prisma is also an optional peer of the runtime
client; static dependency tracing still places the vulnerable package beneath
the root development-only Prisma CLI. This is a tracked residual, not a clean
result. The regression test independently verifies that every compatible
reviewed package family resolves above its patched floor. Default-branch
Dependabot and hosted CI rescans remain the final inventory checks after merge.

## Local Checks

```bash
# Run only where sharing the dependency graph with npm is authorized.
npm audit --json
npm audit --omit=dev --json
npm ls nodemailer nodemailer-v9 postcss next prisma @hono/node-server hono \
  brace-expansion fast-uri browserslist nanoid mysql2 body-parser qs \
  @humanfs/node deepmerge-ts sharp @babel/core @auth/core --depth=8
```

Keep accepted residual risk and each completed fix wave documented here until
the dependency graph is clean.
