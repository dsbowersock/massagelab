# Production migration deployment gate plan

## Goal

Prevent a Vercel Production deployment from becoming READY when committed
Prisma migrations have not been applied to the Production Neon database.
Preview, CI, and ordinary local builds must remain database-independent.

## Incident boundary

The 2026-08-27 Production deployment exposed four unapplied Admin User
Operations migrations. Google OAuth reached Auth.js, but its Prisma adapter
could not load `User.authSessionVersion`. The four committed migrations were
applied through the reviewed direct Neon maintenance connection, after which
Prisma reported all 40 migrations current and the authentication schema
dependency was restored.

## Implementation

1. Add a testable `scripts/assert-production-migrations-current.mjs` owner.
2. Skip unless `VERCEL_ENV` is exactly `production`.
3. In Production, require `DIRECT_URL` or `DATABASE_URL_UNPOOLED`; never fall
   back to the pooled runtime URL for the maintenance check.
4. Run Prisma's read-only `migrate status` command. Missing configuration, an
   execution error, or any nonzero status makes the wrapper fail the build; the
   wrapper does not forward Prisma's original numeric exit code and never
   applies migrations.
5. Add the check to `prebuild` before Prisma client generation. A failed new
   Production build leaves the previously healthy deployment active until an
   operator runs the separately authorized migration deployment and redeploys.
6. Document the recovery sequence and record the incident in current-state and
   chronological documentation.

## Verification

- Seven focused unit tests pass for the non-Production skip, direct-URL
  enforcement, unpooled fallback, passing status, execution failure, pending
  status, and package-script wiring.
- The checker skips without database access outside Vercel Production and a
  live read-only Production rehearsal reports all 40 migrations current.
- Prisma validation, typecheck, lint, the 109-page Production build, and
  `git diff --check` pass. The repository-wide unit command reaches nine
  pre-existing AtmoShaper construction-review failures because committed
  authority fixtures do not match that test's pinned checksums; this branch
  modifies neither the fixtures nor the failing test.
- No second Production migration deploy was run as part of gate validation.

## Rollback

Revert the script and package wiring. The already-applied additive database
migrations remain in place; rollback does not remove tables, columns, role
values, or migration history.
