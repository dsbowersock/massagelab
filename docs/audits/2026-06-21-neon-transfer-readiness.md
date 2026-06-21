# Neon Transfer Readiness Audit

Date: 2026-06-21

## Summary

MassageLab has already reduced the largest known database-transfer risks from anatomy media/admin review paths. This follow-up hardens the runtime connection boundary and trims public/signed-in launch-path reads that still fetched broader rows than needed.

## Neon State Checked

- Project: `massagelab`.
- Transfer reported by Neon project metadata: about 8.16 GB.
- Compute range: 0.25 to 2 CU autoscaling.
- Local runtime environment: `DATABASE_URL` was checked for pooled-host shape without logging the URL.
- Pooled host guidance: Neon recommends pooled connection strings for serverless/web runtime clients, while direct connections remain appropriate for migrations, exports, and admin/session-level work.

No database rows, secrets, credentials, or connection strings were recorded.

## Still-Likely Transfer Risks

- Admin anatomy/media pages and scripts if run repeatedly against production.
- Prisma Studio or ad hoc exports pointed at production.
- Any future `SELECT *`-style query over anatomy/media tables.
- Public booking option generation under repeated booking-picker refreshes, especially for practices with many providers, availability rows, resources, or appointments.

## Branch Controls

- Production Prisma runtime now rejects direct Neon `DATABASE_URL` hosts and requires a pooled `-pooler` host.
- The signed-in homepage preference lookup selects only `appSettings`.
- Public booking sequence generation now projects the fields used by slot generation, service snapshots, provider policies, resources, and conflict checks.
- Transfer source-contract tests cover the pooled runtime guard and the public booking/homepage query projections.

## Launch Guidance

- During the student share window, keep production admin/media maintenance work quiet unless needed.
- If upgrading to Neon Launch temporarily, treat the additional quota as breathing room, not permission to run full exports or Studio browsing against production.
- Check Neon transfer daily during the share week, then reassess whether the paid plan is still needed.
