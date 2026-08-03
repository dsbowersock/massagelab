# Dependency Security Notes

Last reviewed: August 2, 2026.

Security Fix Wave 1 is merged. Fix Wave 2 is in ready PR #164 but is not yet
merged or rescanned on GitHub's default branch, so the dependency inventory is
not recorded as clean.

## Current Findings

- `next@16.2.12` closes the confirmed App Router Server Action denial-of-service
  and endpoint-ID disclosure findings. MassageLab continues to authenticate and
  authorize inside each Server Action boundary.
- `next-auth@5.0.0-beta.32`, `@auth/prisma-adapter@2.11.3`, and
  `@auth/core@0.41.3` close the current Auth.js alerts. Existing auth checks use
  concrete session-user properties, Credentials/Google remain the only
  providers, and Auth.js email/magic-link sign-in remains disabled.
- Next's bundled PostCSS and Sharp copies are overridden to `postcss@8.5.18`
  and `sharp@0.35.3`. The top-level PostCSS range starts at `8.5.18` and the
  current lock resolves `8.5.25`.
- Auth.js does not enable its optional email provider. MassageLab imports
  patched `nodemailer@9.0.3` through the `nodemailer-v9` npm alias for its own
  account mailer, whose private boundary accepts only fixed text fields and
  disables file and URL access.
- Prisma `7.9.1` removes the former Prisma Hono path. shadcn's development-only
  Hono paths resolve through `hono@4.12.27` and `@hono/node-server@2.0.5`.
  Reviewed `brace-expansion`, `fast-uri`, and `@babel/core` copies are also
  pinned above their patched floors.

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

## Current Audit Count

A fresh exact-lock Fix Wave 2 install currently reports:

- Low: 1
- Moderate: 2
- High: 9
- Critical: 0

These are aggregate npm install counts, not a clean result. A standalone
detailed audit was unavailable under the agent environment's security policy,
and GitHub's default-branch inventory cannot rescan this lockfile before merge.
The regression test independently verifies that every package family in the
27-alert post-Wave 1 Dependabot inventory resolves above its reviewed patched
floor.

## Local Checks

```bash
npm audit --json
npm ls nodemailer nodemailer-v9 postcss next prisma @hono/node-server hono \
  brace-expansion fast-uri sharp @babel/core @auth/core --depth=8
```

Keep accepted residual risk and each completed fix wave documented here until
the dependency graph is clean.
