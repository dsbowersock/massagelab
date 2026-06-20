# Codebase Refactor Baseline

Date: 2026-06-20
Scope: baseline for the behavior-preserving refactor and optimization series.

## Verdict

MassageLab is in a clean enough state to begin branch-sized optimization work. The production build, Prisma schema, TypeScript, lint, Node tests, and focused public-route browser suite all pass on the current branch. No runtime behavior was changed for this baseline.

The highest-risk cleanup should stay measurement-first. The current source and build metrics point to two kinds of work: server/data-load slimming where pages fetch more than the active view needs, and client bundle reduction where large route-owned clients plus shared chunks inflate first-load JavaScript.

## Validation Baseline

| Command | Result | Notes |
| --- | --- | --- |
| `npm run prisma:validate` | Passed | Prisma schema valid. |
| `npm run prisma:generate` | Passed | Prisma Client v7.8.0 generated. |
| `npm run typecheck` | Passed | `tsc --noEmit`. |
| `npm run lint` | Passed | `eslint .`. |
| `npm run test` | Passed | 638 tests, 0 failures, 83 suites, 20.4s reported test duration. |
| `npm run build` | Passed | Next 16.2.6 Turbopack production build. |
| `npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium` | Passed | 35 Playwright checks, 0 failures, 2.4m. |

Build timing from the successful production run:

| Stage | Time |
| --- | ---: |
| Optimized production compile | 23.8s |
| `runAfterProductionCompile` | 7.4s |
| TypeScript inside build | 29.8s |
| Static page generation | 78 pages in 7.2s |
| Command wall time | 106.2s |

Build diagnostics ended at `static-generation`, which confirms the previous stale-build-lock problem was transient generated-output state rather than a source failure.

## Source Shape

Measured source files exclude `node_modules`, `.next`, Prisma migrations, and anatomy media payloads.

| Area | Files | Lines |
| --- | ---: | ---: |
| Total measured source | 519 | 122,675 |
| `lib` | 164 | 53,795 |
| `app` | 159 | 35,387 |
| `tests` | 85 | 16,925 |
| `components` | 76 | 10,303 |
| `scripts` | 13 | 2,743 |
| `prisma/seed.ts` | 1 | 2,266 |

Route inventory:

| Route/file type | Count |
| --- | ---: |
| App page route files | 53 |
| API route files | 43 |
| Server action files | 6 |
| Client modules | 104 |

Largest source files:

| File | Lines | Refactor posture |
| --- | ---: | --- |
| `lib/anatomy-foundation.ts` | 6,205 | Data foundation; avoid broad edits unless generated-data tooling exists. |
| `tests/anatomy-foundation.test.mjs` | 4,811 | Valuable coverage; do not shrink before source shape is stable. |
| `app/admin/anatomy/page.tsx` | 3,546 | Good first server/data-load target. |
| `app/calendar/actions.ts` | 2,551 | Decompose after safer baseline branches. |
| `prisma/seed.ts` | 2,266 | Keep seed behavior stable; avoid incidental formatting churn. |
| `app/education/flashcards/flashcards-client.tsx` | 2,066 | Good client-state and bundle target. |
| `lib/anatomime-room-server.ts` | 1,661 | Shared game rules; refactor only with focused tests. |
| `app/notes/intake/client-page.tsx` | 1,194 | Local-first client workflow; type hardening should preserve storage keys. |
| `app/anatomime/page.tsx` | 1,110 | Large route-owned client and large first-load bundle. |

Largest client modules:

| Client module | Lines |
| --- | ---: |
| `app/education/flashcards/flashcards-client.tsx` | 2,066 |
| `app/notes/intake/client-page.tsx` | 1,194 |
| `app/anatomime/page.tsx` | 1,110 |
| `app/book/[practiceSlug]/booking-picker.tsx` | 925 |
| `app/calendar/calendar-workspace.tsx` | 836 |
| `app/chimer/running-timer.tsx` | 798 |
| `components/sidebar/app-sidebar-client.tsx` | 782 |
| `app/chimer/page.tsx` | 779 |
| `components/ui/sidebar.tsx` | 774 |
| `components/wellness/wellness-hub-client.tsx` | 732 |

## Route Bundle Baseline

Next route bundle diagnostics report uncompressed first-load JavaScript. These are not network-compressed transfer sizes, but they are useful for comparing future branches.

| Route | First-load JS | Chunk count |
| --- | ---: | ---: |
| `/notes/soap` | 3.53 MB | 25 |
| `/anatomime` | 3.40 MB | 23 |
| `/calendar` | 2.00 MB | 22 |
| `/notes/intake` | 1.82 MB | 24 |
| `/education/flashcards` | 1.77 MB | 22 |
| `/education/flashcards/decks` | 1.77 MB | 22 |
| `/education/flashcards/decks/[slug]` | 1.77 MB | 22 |
| `/notes/rom` | 1.76 MB | 23 |
| `/notes/journal` | 1.76 MB | 23 |
| `/account` | 1.76 MB | 22 |
| `/wellness` | 1.76 MB | 22 |
| `/clock` | 1.75 MB | 22 |
| `/chimer` | 1.75 MB | 22 |
| `/notes` | 1.75 MB | 22 |
| `/book/[practiceSlug]` | 1.75 MB | 22 |

Largest emitted static assets:

| Asset | Uncompressed size |
| --- | ---: |
| `.next/static/chunks/009i9hv7fklnj.js` | 1,688.5 KB |
| `.next/static/chunks/074mib8zkt041.js` | 447.6 KB |
| `.next/static/chunks/17_6z7gnxyy.w.js` | 412.6 KB |
| `.next/static/chunks/0m-2lj4nj03ee.js` | 272.2 KB |
| `.next/static/chunks/11._zj8j1o76o.js` | 234.8 KB |

## Initial Optimization Targets

1. Slim `/admin/anatomy` data loading first if the goal is reliability and database pressure. The page currently loads broad browser data for the whole admin surface before the active view is known. Split the loader by selected view, preserve URL behavior, and keep the existing admin browser tests as the guardrail.
2. Measure shared first-load JavaScript before changing global providers. The route bundle baseline shows a large shared chunk appears across many routes, so global layout/provider changes should be verified with `route-bundle-stats.json`, not by file size alone.
3. Split large route-owned clients after server/data-load cleanup. `/notes/soap`, `/anatomime`, `/calendar`, `/notes/intake`, and flashcards are the clearest client bundle targets, but each owns real workflow state and needs focused browser coverage.
4. Decompose `app/calendar/actions.ts` by domain after behavior is pinned. It is a shared server-action choke point, so the safe path is extraction with identical exports and targeted tests.
5. Keep local-first storage keys and PHI boundaries stable while hardening types in notes, intake, SOAP, journal, and ROM workflows.
6. Do not remove JS compatibility files until each duplicate TS/JS pair has a documented runtime/import path decision.

## Next Branch Acceptance

The first implementation branch should leave this baseline passing and improve one measurable surface. For the anatomy admin loader branch, acceptance is:

- `app/admin/anatomy/page.tsx` no longer loads every heavy admin dataset for every selected view.
- Existing anatomy admin browser, media review, and anatomy foundation tests pass.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and the focused public-route browser suite still pass.
- Any route bundle or build-time change is recorded against this baseline rather than described impressionistically.
