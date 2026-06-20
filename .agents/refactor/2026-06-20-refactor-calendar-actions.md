# Calendar Actions Refactor Summary

Date: 2026-06-20
Scope: `app/calendar/actions.ts`
Mode: behavior-preserving decomposition

## Target

Task 5 from `docs/superpowers/plans/2026-06-20-codebase-refactor-optimization.md` called out `app/calendar/actions.ts` as a high-risk server action file. This pass kept `app/calendar/actions.ts` as the public action surface while extracting cohesive helper groups into `app/calendar/actions/*`.

## Size Change

- `app/calendar/actions.ts` before branch: 2,551 lines
- `app/calendar/actions.ts` after branch: 1,815 lines
- Public action file reduction: 736 lines
- Branch diff: 9 files, 1,007 insertions, 877 deletions

## Transformations

- Extracted access, role, and form parsing helpers to `app/calendar/actions/access.ts`.
- Extracted provider availability, conflict checks, and row locking helpers to `app/calendar/actions/availability.ts`.
- Extracted calendar route revalidation to `app/calendar/actions/revalidation.ts`.
- Extracted booking policy and capacity settings implementations to `app/calendar/actions/booking.ts`.
- Extracted service variant selection and service snapshot helpers to `app/calendar/actions/service-catalog.ts`.
- Extracted audit and notification writing to `app/calendar/actions/audit.ts`.
- Updated source-shape tests so they assert the moved invariants in their new modules instead of assuming everything lives in `actions.ts`.

## Validation

- Baseline focused calendar/public-booking tests passed before edits: 62 tests.
- Focused calendar/public-booking tests passed after each extraction.
- `npm run typecheck` passed after the final code extraction.
- `npm run lint` passed after the final code extraction.
- `npm run test` passed: 641 tests, 83 suites.
- `npm run build` passed with Next.js production build and Prisma generation.

## Behavior Notes

- Public server action export names remain available from `app/calendar/actions.ts`.
- Booking setting actions now delegate to extracted implementations, preserving the original public action names.
- The locking SQL, outside-provider-availability guard, and public add-on limit tests still pin the same behavior in the extracted files.

## Deferred Work

The public booking sequence and waitlist flow still live in `app/calendar/actions.ts`. Those functions share more local state and should be extracted in a separate branch-sized pass instead of being moved at the end of this one.
