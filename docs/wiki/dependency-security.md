# Dependency Security Notes

Last reviewed: August 2, 2026.

Security Fix Wave 1 upgrades the directly reachable Next.js advisories and the
latent Auth.js advisory set. The remaining findings are reserved for the
separately triaged Fix Wave 2 and do not represent unresolved Wave 1 exposure.

## Current Findings

- `next@16.2.11` closes the confirmed App Router Server Action denial-of-service
  and endpoint-ID disclosure findings. MassageLab continues to authenticate and
  authorize inside each Server Action boundary.
- `next-auth@5.0.0-beta.32`, `@auth/prisma-adapter@2.11.3`, and
  `@auth/core@0.41.3` close the current Auth.js alerts. Existing auth checks use
  concrete session-user properties, Credentials/Google remain the only
  providers, and Auth.js email/magic-link sign-in remains disabled.
- Next still bundles `postcss@8.4.31`, while the top-level build dependency is
  `postcss@8.5.15`. MassageLab does not compile attacker-controlled CSS at
  runtime; their remaining advisories belong to Fix Wave 2.
- `nodemailer@7.0.13` is directly used in `lib/auth-mail.ts`. The current code does not pass user-controlled `envelope.size` or transport `name`, but the advisory remains relevant until an upgrade path is clean with Auth.js/NextAuth peer expectations.
- `hono` and `@hono/node-server` are development-only Prisma/shadcn tooling;
  `brace-expansion`, `fast-uri`, `sharp`, and `@babel/core` likewise have
  no current attacker-controlled production path under the reviewed
  configuration. Their version cleanup remains Fix Wave 2.

## Latest Dependency Updates

- `next` and `eslint-config-next` were updated from `16.2.6` to `16.2.11`.
- `next-auth` was updated from `5.0.0-beta.31` to `5.0.0-beta.32`;
  `@auth/prisma-adapter` moved to `2.11.3`, leaving one deduplicated
  `@auth/core@0.41.3` resolution.
- `ws` was updated from `8.20.0` to `8.21.0`, superseding Dependabot PR #31's `8.20.1` security bump for GHSA-58qx-3vcg-4xpx.
- Top-level `postcss` was updated from `8.5.14` to `8.5.15`. Next still installs its own nested `postcss@8.4.31`.

## Current Audit Count

The clean Fix Wave 1 install reported:

- Low: 2
- Moderate: 5
- High: 15
- Critical: 0

GitHub's default-branch Dependabot count can continue to show the pre-fix 42
alerts until this pull request merges and GitHub rescans the new lockfile.

## Local Checks

```bash
npm audit --json
npm ls nodemailer postcss next prisma @hono/node-server hono @auth/core --depth=6
```

Keep accepted residual risk and each completed fix wave documented here until
the dependency graph is clean.
