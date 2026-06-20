# Refactor: Public Booking Calendar Actions

**Date:** 2026-06-20
**Mode:** extract
**Files changed:** 3

## Targets

- `app/calendar/actions.ts` -> `app/calendar/actions/public-booking.ts`: moved public booking sequence requests, guest/client identity resolution, waitlist joins, waitlist conversion, and transactional booking sequence writes behind the existing public action exports.
- `tests/calendar-booking-schema.test.mjs`: updated the source-shape assertion for lazy public booking sequence loading to follow the extracted module.

## Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `app/calendar/actions.ts` lines | 1,815 | 1,344 | -471 |
| Extracted helper lines | 0 | 517 | +517 |
| Public server action names | unchanged | unchanged | 0 |

## Transformations Applied

1. Extract public booking and waitlist implementation into `app/calendar/actions/public-booking.ts` -- `d170656`.

## Tests

- Baseline focused suite: `node --test tests/calendar*.test.mjs tests/public-booking-*.test.mjs` passed, 62 tests.
- Post-extraction focused suite: `node --test tests/calendar*.test.mjs tests/public-booking-*.test.mjs` passed, 62 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed, 641 tests across 83 suites.
- `npm run build` passed on rerun with a longer timeout; the first local build reached the route table before the tool timeout fired.

## Simplification Checks

| Check | Result |
|---|---|
| Behavior unchanged | PASS |
| Focused tests passed | PASS |
| New abstraction justified | yes |

## Learnings

- Calendar source-shape tests should track invariants in extracted action modules instead of assuming every booking invariant stays in `actions.ts`.
- Event creation, request review, and service catalog mutations still live in `actions.ts`; those are better handled as separate branch-sized extractions.
