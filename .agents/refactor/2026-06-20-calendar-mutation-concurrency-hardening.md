# Refactor: Calendar Mutation Concurrency Hardening

**Date:** 2026-06-20
**Mode:** target
**Files changed:** 7

## Targets

- `app/calendar/actions/preferences.ts` -- serialized calendar preference patch merges with a parent user-row lock before reading and upserting `UserPreference`.
- `app/calendar/actions/reschedule.ts` -- locks the target calendar event through the deterministic scheduling-lock phase, re-reads current mutable state, rejects stale schedule/status/owner/resource snapshots, rechecks actor membership and editability, then keeps availability/conflict checks and cascaded updates inside the same transaction.
- `app/calendar/actions/setup.ts` -- moved free-practice quota counting and practice creation into one transaction guarded by a parent user-row lock, then serialized global slug allocation with a transaction-scoped advisory lock.
- `app/calendar/actions/availability.ts` -- accepts target event ids for reschedules and locks target plus overlapping calendar events in deterministic id order after membership and availability-source locks.

## Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Focused calendar source tests | 24 passing | 27 passing | +3 |
| Concurrency contract assertions | 0 | 3 | +3 |
| Public server action names | unchanged | unchanged | 0 |

## Transformations Applied

1. Added lock-backed preference merge transaction.
2. Added deterministic target/overlap event locking plus stale-snapshot rechecks for reschedules.
3. Added lock-backed free-practice quota and slug allocation transaction.
4. Added focused source tests for the three transaction contracts.

## Tests

- Baseline: `node --test tests/calendar-creation-routes.test.mjs tests/calendar-preferences.test.mjs tests/calendar-workspace.test.mjs` -- 24 passing.
- Focused final: `node --test tests/calendar-creation-routes.test.mjs tests/calendar-preferences.test.mjs tests/calendar-workspace.test.mjs` -- 27 passing.
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.

## Learnings

- `User` is the stable lock target for per-user preference and practice setup races because the child rows may not exist yet.
- Reschedule needs both a target-event lock and the existing schedule-window locks: the first serializes stale drag submissions for the same event, while the second preserves provider/resource conflict protection.
