# Refactor: Calendar Actions Facade

**Date:** 2026-06-20
**Mode:** extract
**Files changed:** 7

## Targets

- `app/calendar/actions.ts` -- kept as the stable public server-action import surface while moving the remaining implementation blocks into focused modules.
- `app/calendar/actions/preferences.ts` -- moved calendar preference persistence and merge behavior.
- `app/calendar/actions/setup.ts` -- moved practice creation and availability setup writes.
- `app/calendar/actions/reschedule.ts` -- moved calendar event rescheduling, locking, conflict checks, audit writes, and revalidation.
- `tests/calendar-creation-routes.test.mjs` -- updated source-shape checks to follow the extracted modules.

## Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `app/calendar/actions.ts` lines at branch start | 402 | 107 | -295 |
| `app/calendar/actions.ts` lines before calendar series | 2,551 | 107 | -2,444 |
| Public server action names | unchanged | unchanged | 0 |

## Transformations Applied

1. Extract calendar preference action -- `8855458`.
2. Extract practice and availability setup actions -- `2df41da`.
3. Extract calendar reschedule action -- `3fcc010`.
4. Keep extracted implementation modules server-only behind the public facade -- review-fix commit.

## Tests

- Baseline: `node --test tests/calendar*.test.mjs tests/public-booking-*.test.mjs tests/service-catalog.test.mjs tests/calendar-booking-schema.test.mjs` -- 71 passing.
- After preference extraction: `node --test tests/calendar-creation-routes.test.mjs tests/calendar-preferences.test.mjs` -- 21 passing; `npm run typecheck` passed.
- After setup extraction: focused calendar/public-booking/service suite -- 71 passing; `npm run typecheck` passed.
- After reschedule extraction: focused calendar/public-booking/service suite -- 71 passing; `npm run typecheck` passed.
- Final branch validation: `npm run typecheck`, `npm run lint`, `npm run test` -- 643 passing, `npm run build`, and `git diff --check` passed.
- Review hardening validation: `node --test tests/calendar-creation-routes.test.mjs`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` passed. Follow-up review fixes kept extracted modules server-only, rejected missing `dayOfWeek` before numeric coercion, validated schedule effective-date ordering, and documented the reschedule transaction contract.

## Skipped Review Items

- Preference write serialization, reschedule stale-row protection, and free-practice quota atomicity are valid concurrency hardening ideas, but they require a dedicated transaction/retry design and were not bundled into this behavior-preserving extraction branch.

## Simplification Checks

| Check | Result |
|---|---|
| Behavior unchanged | PASS |
| Focused tests passed | PASS |
| New abstraction justified | yes |

## Learnings

- `app/calendar/actions.ts` is now small enough to reason about as a public facade rather than as a domain implementation file.
- Source-shape tests should keep following behavior invariants into extracted modules instead of pinning all server-action details to the facade.
- The next optimization branch should shift from action decomposition to measured lazy-loading or local-first type hardening.
