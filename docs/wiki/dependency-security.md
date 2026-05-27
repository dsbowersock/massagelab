# Dependency Security Notes

Last reviewed: May 15, 2026.

`npm audit --json` reports no high or critical advisories. Remaining advisories are dependency-level alerts with no safe non-breaking automated fix currently available.

## Current Findings

- `next@16.2.6` bundles a nested `postcss@8.4.31`, which is below the fixed PostCSS advisory range. A scoped npm override was tested but left `npm ls` invalid because Next still installed its pinned nested package. Track whether a Next release updates the nested dependency.
- `nodemailer@7.0.13` is directly used in `lib/auth-mail.ts`. The current code does not pass user-controlled `envelope.size` or transport `name`, but the advisory remains relevant until an upgrade path is clean with Auth.js/NextAuth peer expectations.
- `@hono/node-server` is pulled through Prisma tooling and is overridden to `1.19.13`, resolving the Prisma tooling advisory without downgrading Prisma.

## Current Audit Count

- Low: 3
- Moderate: 3
- High: 0
- Critical: 0

## Local Checks

```bash
npm audit --json
npm ls nodemailer postcss next prisma @hono/node-server @auth/core --depth=6
```

Keep accepted residual risk documented here until the audit is clean.
