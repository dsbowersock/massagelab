# Dependency Security Notes

Last reviewed: June 9, 2026.

`npm audit --json` reports no high or critical advisories. Remaining advisories are dependency-level alerts with no safe non-breaking automated fix currently available.

## Current Findings

- `next@16.2.6` bundles a nested `postcss@8.4.31`, which is below the fixed PostCSS advisory range. A scoped npm override was tested but left `npm ls` invalid because Next still installed its pinned nested package. Track whether a Next release updates the nested dependency.
- `nodemailer@7.0.13` is directly used in `lib/auth-mail.ts`. The current code does not pass user-controlled `envelope.size` or transport `name`, but the advisory remains relevant until an upgrade path is clean with Auth.js/NextAuth peer expectations.
- `hono` is pulled transitively through Prisma tooling and shadcn/MCP tooling. It is overridden to `4.12.21`, resolving the June 2026 Hono moderate advisories without downgrading Prisma or shadcn.

## Latest Dependency Updates

- `ws` was updated from `8.20.0` to `8.21.0`, superseding Dependabot PR #31's `8.20.1` security bump for GHSA-58qx-3vcg-4xpx.
- Top-level `postcss` was updated from `8.5.14` to `8.5.15`. Next still installs its own nested `postcss@8.4.31`.
- Transitive `brace-expansion` audit findings were resolved by updating vulnerable lockfile entries to patched versions.
- Transitive `hono` was overridden to `4.12.21`, reducing the current audit from 7 advisories to 6.

## Current Audit Count

- Low: 3
- Moderate: 3
- High: 0
- Critical: 0

## Local Checks

```bash
npm audit --json
npm ls nodemailer postcss next prisma @hono/node-server hono @auth/core --depth=6
```

Keep accepted residual risk documented here until the audit is clean.
