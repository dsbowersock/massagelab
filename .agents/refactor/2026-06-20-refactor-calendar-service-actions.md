# Refactor: Calendar Service Actions

**Date:** 2026-06-20
**Mode:** extract
**Files changed:** 3

## Targets

- `app/calendar/actions.ts` service catalog mutation block -- extracted service parsing, resource, entitlement-limit, create, and update logic into `app/calendar/actions/services.ts`.
- `tests/calendar-creation-routes.test.mjs` -- added a source-shape guard that keeps service forms wired to stable public action exports while implementation lives in the focused module.

## Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `app/calendar/actions.ts` lines | 767 | 402 | -365 |
| Extracted service module lines | 0 | 394 | +394 |
| Focused calendar/service tests | 70 | 71 | +1 |

## Transformations Applied

1. Extract service catalog mutation implementation into `app/calendar/actions/services.ts` -- `6d92aba`
2. Keep `createServiceAction` and `updateServiceAction` exported from `app/calendar/actions.ts` as delegates -- `6d92aba`
3. Add source-shape coverage for the service action boundary -- `6d92aba`

## Tests

- Baseline: `node --test tests/calendar*.test.mjs tests/public-booking-*.test.mjs tests/service-catalog.test.mjs tests/calendar-booking-schema.test.mjs` -- 70 passing.
- Focused final: same command -- 71 passing.
- Full final:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test` -- 643 passing.
  - `npm run build`
  - `git diff --check`

## Simplification Checks

| Check | Result |
|---|---|
| Behavior unchanged | PASS |
| Focused tests passed | PASS |
| New abstraction justified | yes |

## Learnings

- `app/calendar/actions.ts` still owns preferences, availability, practice setup, rescheduling, and stable action re-exports; the next extraction target should be availability/practice setup only if it stays similarly bounded.
