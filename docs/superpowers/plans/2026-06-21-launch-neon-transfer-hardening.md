# Launch Neon Transfer Hardening

Date: 2026-06-21

## Objective

Prepare MassageLab for a modest public-alpha share window while reducing avoidable Neon transfer and connection waste. The target audience is roughly 30 to 80 invited users with possible sharing beyond that group.

## Verified Inputs

- Neon project: `massagelab`.
- Current Neon-reported project transfer: about 8.16 GB.
- Runtime database: Prisma Client through Neon Postgres.
- Local runtime `DATABASE_URL`: verified to use a Neon pooled host without recording the value.
- Neon compute: autoscaling range currently 0.25 to 2 CU.
- Official Neon docs used for operational guidance:
  - https://neon.com/docs/connect/connection-pooling
  - https://neon.com/docs/introduction/scale-to-zero
  - https://neon.com/docs/introduction/autoscaling

## Scope

1. Guard production runtime connections so Prisma Client uses Neon pooled hosts.
2. Keep direct Neon URLs reserved for migrations and maintenance scripts.
3. Reduce repeated launch-path data transfer where existing code fetches unused columns.
4. Document admin/script behaviors that can burn transfer quickly.
5. Preserve site behavior and avoid broad refactors.

## Implementation Plan

1. Add a production `DATABASE_URL` validation guard in `lib/prisma.ts`.
   - Accept `postgres://` and `postgresql://`.
   - If `NODE_ENV=production` and the host is Neon, require the pooled `-pooler` host.
   - Do not echo candidate database URLs in thrown errors.
2. Narrow launch-path Prisma queries.
   - Signed-in homepage preference lookup should select only `appSettings`.
   - Public booking sequence generation should select only the practice, provider, service, resource, availability, capacity, and appointment fields used by option generation and final booking validation.
3. Update deployment docs with Neon launch operating rules.
4. Add/extend source-contract tests that guard pooled runtime configuration and transfer-heavy query projections.
5. Validate with focused tests, typecheck, lint, full tests, production build, and whitespace diff checks.

## Operational Checklist

- Use pooled Neon connection strings for runtime `DATABASE_URL`.
- Use direct Neon connection strings only for `DIRECT_URL`, migrations, `pg_dump`, Prisma Studio, and bounded maintenance scripts.
- Avoid Prisma Studio, seed scripts, full-table exports, and anatomy/admin maintenance scripts against production during the share window unless there is a specific need.
- Watch Neon transfer, compute, and connection graphs before and after sharing the site.
- Keep autoscaling at 0.25 to 2 CU unless evidence shows saturation; increasing compute does not reduce transfer by itself.
- Leave scale-to-zero enabled unless cold starts become the main user-facing issue during the share window.
