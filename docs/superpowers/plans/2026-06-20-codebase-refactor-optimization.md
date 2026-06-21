# Codebase Refactor Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve current MassageLab behavior while making the app easier to reason about, lighter in the browser, and more reliable for an initial 30-80 user alpha expansion.

**Architecture:** This is a measurement-first refactor series, not a rewrite. Each branch must keep public routes, local-first PHI boundaries, feature-key entitlements, persisted browser storage keys, Prisma schema compatibility, and current validation behavior intact unless a separate product decision says otherwise.

**Tech Stack:** Next.js App Router, React, TypeScript with existing JavaScript modules, Prisma 7 with Neon/Postgres, NextAuth, Stripe, Sentry, Playwright, Node test runner, Tailwind/shadcn UI, FullCalendar, Tone/Generative.fm.

---

## Current Findings

- Codebase size excluding migrations and media: 518 TS/TSX/JS/MJS/CSS files, about 122,670 lines.
- Largest code areas: `lib/` about 53,795 lines, `app/` about 35,387 lines, `tests/` about 16,925 lines.
- Route inventory: 53 page route files, 43 API route files, 6 server-action files, and 102 app/component client modules.
- Prisma schema: 104 models, 48 enums, 194 indexes, and 91 unique constraints.
- Current validation baseline: `npm run typecheck`, `npm run lint`, and `npm run test` pass; `npm run test` reports 638 passing tests.
- Current build baseline gap: `npm run build` timed out once and the retry hit Next's "Another next build process is already running" state. No TypeScript, lint, or unit-test failure was observed, but the first optimization branch must establish a clean production build baseline before changing code.
- Git-history high-risk overlap: `tests/browser/public-routes.spec.ts`, `app/education/flashcards/flashcards-client.tsx`, and `app/admin/anatomy/page.tsx` appear in both hotspot and bug-fix lists.
- Large user-facing files worth splitting carefully: `app/admin/anatomy/page.tsx` (3546 lines), `app/calendar/actions.ts` (2551), `app/education/flashcards/flashcards-client.tsx` (2066), `app/notes/intake/client-page.tsx` (1194), `app/anatomime/page.tsx` (1110), `app/book/[practiceSlug]/booking-picker.tsx` (925), and `app/calendar/calendar-workspace.tsx` (836).
- Duplicate TS/JS module pairs exist in `lib/` for anatomy, Anatomime, flashcards, and MBLEx helpers. Treat them as compatibility debt; do not delete them opportunistically.

## Non-Goals

- Do not rewrite the app, change product behavior, or redesign screens as part of this refactor series.
- Do not move SOAP, intake, journal, ROM, transcript, or therapist professional-record data to hosted storage.
- Do not replace feature-key entitlement checks with plan-name checks.
- Do not add a CMS, payment marketplace, external calendar sync, hosted PHI sync, or voice transcription work under this plan.
- Do not chase fewer lines as the primary metric. Prefer less repeated work, fewer global side effects, smaller responsibilities per file, lower client payloads, and stronger tests.

## Branch Sequence

### Task 1: Establish Current Build And Performance Baseline

**Files:**
- Create: `docs/audits/2026-06-20-refactor-baseline.md`
- Modify: no runtime files

- [x] **Step 1: Confirm the worktree is clean**

Run: `git status --short`

Expected: no tracked file output except intentional documentation edits for this branch.

- [x] **Step 2: clear only stale local build state if needed**

If `npm run build` reports another build is running, first verify no active MassageLab build process exists:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'massagelab|next|npm' } |
  Select-Object ProcessId, CreationDate, CommandLine
```

If no active build command is present, remove only the local `.next` build output before rerunning the build. Do not touch source files or user branches.

- [x] **Step 3: Run the release gate**

Run:

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands pass. If `build` fails after a clean `.next`, fix the build before starting refactors.

- [x] **Step 4: capture route and bundle baseline**

Save the build route table, first-load JS values, and any warnings into `docs/audits/2026-06-20-refactor-baseline.md`. Include the current line-count/hotspot summary and note that the first pass has no behavior changes.

- [x] **Step 5: run focused browser smoke checks**

Run:

```bash
npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium
```

Expected: pass, or document any existing browser-only failure before refactoring.

### Task 2: Slim The Anatomy Admin Browser Data Load

**Files:**
- Modify: `app/admin/anatomy/page.tsx`
- Create: `app/admin/anatomy/browser-data.ts`
- Create: `app/admin/anatomy/browser-types.ts`
- Test: `tests/anatomy-admin-browser-ui.test.mjs`
- Test: `tests/anatomy-queries.test.mjs`

- [x] **Step 1: move shared admin browser types**

Extract `AnatomyBrowserView`, `BodySystemBrowserView`, `TissueTypeBrowserView`, `AnatomyBrowserData`, and related view constants into `browser-types.ts`. Keep names stable so tests and links remain readable.

- [x] **Step 2: move data loading behind typed functions**

Move `getAnatomyFoundationCounts`, `getAnatomyBrowserData`, and `getAnatomyQuickResult` into `browser-data.ts`. Export `getAnatomyBrowserDataForView({ view, searchQuery, selectedEntity })`.

- [x] **Step 3: load only the selected view's required slices**

Replace the current broad all-table `Promise.all` in `getAnatomyBrowserData()` with view-scoped loader branches. Keep shared lookup data only where a table actually needs it.

- [x] **Step 4: preserve search, quick queries, and entity detail behavior**

Run existing admin tests after each loader change. Add focused assertions that a body-system view still displays taxonomy rows and that maintenance view still loads counts, recent terms, and recent flags.

- [x] **Step 5: validate**

Run:

```bash
node --test tests/anatomy-admin-browser-ui.test.mjs tests/anatomy-media-review.test.mjs tests/anatomy-queries.test.mjs tests/anatomy-foundation.test.mjs
npm run typecheck
npm run lint
```

Expected: pass. Compare build route output for `/admin/anatomy` before and after.

### Task 3: Split The Flashcards Client State Machine

**Files:**
- Modify: `app/education/flashcards/flashcards-client.tsx`
- Create: `app/education/flashcards/flashcard-api-client.ts`
- Create: `app/education/flashcards/flashcard-progress-dashboard.tsx`
- Create: `app/education/flashcards/flashcard-runner.tsx`
- Create: `app/education/flashcards/flashcard-setup-builder.tsx`
- Test: `tests/flashcard-community.test.mjs`
- Test: `tests/flashcard-progress.test.mjs`
- Test: `tests/browser/public-routes.spec.ts`

- [x] **Step 1: extract API response parsers and fetch wrappers**

Move `progressPayload`, `promptDeckPayload`, `promptSummaryRows`, `sessionStartPayload`, and related response parsing into `flashcard-api-client.ts`. Keep fallback dynamic imports of `@/lib/anatomy-study`; do not statically import the heavy sourced adapter into the first client bundle.

- [x] **Step 2: extract pure display components**

Move `PromptFront`, `PromptBack`, `PromptBadges`, `PromptSourceLinks`, and runner controls into `flashcard-runner.tsx`. Props should be explicit and serializable.

- [x] **Step 3: extract setup UI**

Move category, region, prompt-type, exact-prompt, deck-size, answer-mode, and save controls into `flashcard-setup-builder.tsx`. Keep `NormalizedFlashcardDeckConfig` as the data contract.

- [x] **Step 4: extract progress dashboard UI**

Move signed-in mastery cards, recent progress rows, and next-round controls into `flashcard-progress-dashboard.tsx`. Keep `FlashcardProgressPayload` shape stable.

- [x] **Step 5: validate behavior**

Run:

```bash
node --test tests/flashcard-community.test.mjs tests/flashcard-progress.test.mjs
npm run test:browser -- tests/browser/public-routes.spec.ts -g "Flashcards" --project=desktop-chromium
npm run typecheck
npm run lint
```

Expected: public decks, temporary decks, typed checks, reveal review, progress dashboard, next mastery round, local draft restore, and admin image flagging continue to work.

### Task 4: Add Cached Sourced Prompt Catalog Helpers

**Files:**
- Modify: `lib/anatomy-study.ts`
- Modify: `lib/flashcard-progress-helpers.ts`
- Modify: `app/api/education/flashcards/progress/route.ts`
- Modify: `app/api/education/flashcards/sessions/route.ts`
- Test: `tests/flashcard-community.test.mjs`
- Test: `tests/flashcard-progress.test.mjs`

- [x] **Step 1: add a process-local prompt catalog helper**

Create a helper that builds the current sourced prompt list once per media-option signature and returns immutable prompt summaries plus prompt ids.

- [x] **Step 2: use the helper in progress APIs**

Replace per-request prompt-universe reconstruction in `progress/route.ts` with the cached helper. Preserve current media-review filtering and current-prompt filtering.

- [x] **Step 3: keep session start bounded**

Keep the existing skip-mastered query safe for current prompt counts. If prompt counts grow beyond the existing `flashcard-scale` warning in `app/api/education/flashcards/sessions/route.ts`, add batched progress lookup before expanding deck sizes.

- [x] **Step 4: validate**

Run:

```bash
node --test tests/flashcard-community.test.mjs tests/flashcard-progress.test.mjs
npm run typecheck
npm run lint
```

Expected: same API response shapes with fewer repeated prompt-catalog rebuilds.

### Task 5: Decompose Calendar Server Actions

**Files:**
- Modify: `app/calendar/actions.ts`
- Create: `app/calendar/actions/access.ts`
- Create: `app/calendar/actions/availability.ts`
- Create: `app/calendar/actions/booking.ts`
- Create: `app/calendar/actions/preferences.ts`
- Create: `app/calendar/actions/public-booking.ts`
- Create: `app/calendar/actions/reschedule.ts`
- Create: `app/calendar/actions/service-catalog.ts`
- Create: `app/calendar/actions/services.ts`
- Create: `app/calendar/actions/setup.ts`
- Create: `app/calendar/actions/events.ts`
- Test: `tests/calendar*.test.mjs`
- Test: `tests/public-booking-*.test.mjs`

- [x] **Step 1: preserve the public action exports**

Keep `app/calendar/actions.ts` as the import surface used by pages and forms. Move implementation groups into smaller files and re-export the same action names.

- [x] **Step 2: extract access and parsing helpers**

Move `currentUserId`, `assertPracticeAccess`, `assertPracticeTherapist`, field parsers, and PHI-shaped operational note checks to `access.ts`.

- [x] **Step 3: extract availability and conflict logic**

Move provider availability, resource conflict, appointment conflict, row locking, and schedule override logic to `availability.ts`.

- [x] **Step 4: extract booking and waitlist mutations**

Move public booking sequence request, waitlist join, waitlist conversion, provider booking policy, and capacity rules to `booking.ts`.

- [x] **Step 5: extract service catalog mutations**

Move create/update service, variants, resources, and service limits to `service-catalog.ts`.

- [x] **Step 6: extract event creation and request review**

Move appointment, personal event, class, reminder, reschedule, and appointment request review to `events.ts`.

- [x] **Step 7: validate**

Run:

```bash
node --test tests/calendar*.test.mjs tests/public-booking-*.test.mjs
npm run typecheck
npm run lint
```

Expected: no import-path behavior change, same server-action names, same form behavior, and lower per-file reasoning cost.

### Task 6: Harden Calendar Mutation Concurrency

**Files:**
- Modify: `app/calendar/actions/preferences.ts`
- Modify: `app/calendar/actions/reschedule.ts`
- Modify: `app/calendar/actions/setup.ts`
- Modify if shared locking helpers need tightening: `app/calendar/actions/availability.ts`
- Test: `tests/calendar-creation-routes.test.mjs`
- Test: `tests/calendar*.test.mjs`
- Test: `tests/public-booking-*.test.mjs`

- [x] **Step 1: keep the action-facade split intact**

Start from the decomposed calendar action modules. Do not re-merge implementation back into `app/calendar/actions.ts`; this branch should harden mutation semantics inside the focused modules created by Task 5.

- [x] **Step 2: serialize preference patch writes**

Prevent lost updates when multiple calendar preference forms patch the same JSON preference row close together. Preserve `mergeCalendarPreferencePatch` sanitization, feature boundaries, and existing route revalidation while using a transaction, conditional retry, or database-side merge strategy that proves the final row includes both valid patches.

- [x] **Step 3: harden reschedule stale-row protection**

Make reschedule writes re-check the current event state at update time so a concurrent cancel, status change, ownership change, or earlier reschedule cannot be overwritten by a stale form submission. Preserve the existing editability checks, conflict checks, audit logging, lock ordering, and calendar revalidation contract.

- [x] **Step 4: make free-practice quota enforcement atomic with creation**

Ensure the free-practice count/quota check and practice creation cannot interleave across concurrent submissions for the same user. Keep entitlement decisions based on feature keys such as `calendar_practices`, preserve default service setup, and avoid plan-name branching.

- [x] **Step 5: validate**

Run:

```bash
node --test tests/calendar-creation-routes.test.mjs tests/calendar*.test.mjs tests/public-booking-*.test.mjs
npm run typecheck
npm run lint
npm run test
```

Expected: same calendar action names and user-visible behavior, no quota bypass under concurrent setup submissions, no lost preference patches, no stale reschedule overwrite, and no regression to public booking or calendar creation routes.

### Task 7: Measure And Lazy-Load Heavy Client Workspaces

**Files:**
- Modify after measurement only: `app/calendar/page.tsx`
- Modify after measurement only: `app/calendar/calendar-workspace.tsx`
- Modify after measurement only: `app/book/[practiceSlug]/booking-picker.tsx`
- Modify after measurement only: `components/providers/music-provider.tsx`
- Modify after measurement only: `app/anatomime/page.tsx`
- Test: `tests/browser/public-routes.spec.ts`

- [x] **Step 1: use the clean production build output to identify largest first-load routes**

Do not add `next/dynamic` blindly. Pick targets from current build output and browser traces.

2026-06-20 branch note: refreshed `main`, ran a clean production build, and used `.next/diagnostics/route-bundle-stats.json` to separate shared shell weight from route-owned chunks. The measured global shell cost was the best branch-sized target because `components/providers/music-provider.tsx` statically imported the Atmosphere station catalog plus Tone/Generative.fm runtime helpers through `app/layout.tsx`.

- [ ] **Step 2: calendar workspace**

If FullCalendar is in a public first-load bundle or a non-calendar bundle, wrap the workspace client island so FullCalendar loads only on `/calendar`.

2026-06-20 branch note: measured `/calendar` at 2,100,580 bytes with about 307.6 KB route-owned chunks before this pass, and the FullCalendar work did not appear in the public/simple-route route-owned chunks. Calendar workspace splitting was skipped for this branch.

- [ ] **Step 3: public booking picker**

If the booking wizard bundle is large, split weekly availability grid and account-benefits card from the first step while keeping direct slot clicks accessible.

2026-06-20 branch note: measured `/book/[practiceSlug]` at 1,829,866 bytes with about 43.3 KB route-owned chunks before this pass, so the booking picker was not the strongest measured target.

- [x] **Step 4: music provider**

Keep route-persistent playback. Measure whether globally importing station catalog/runtime code increases first-load JS on non-music routes. If it does, introduce a lightweight global playback shell that dynamically imports the station runtime only after the user opens `/music`, `/browse`, or plays a station.

2026-06-20 result: `MusicProvider` now keeps only the lightweight provider/storage shell in the global layout and loads station catalog, runtime controller, Generative.fm runtime, and Tone proof runtime through a cached async runtime path when a station is played or prewarmed. After the production rebuild, representative first-load JavaScript dropped from 1,787,081 to 1,113,612 bytes on `/`, from 2,100,580 to 1,427,111 bytes on `/calendar`, and from about 1.81 MB to 1,598,886 bytes on `/music` and `/browse`, while route-persistent playback and Media Session browser checks passed.

- [x] **Step 5: Anatomime**

Split shared-room creation/join widgets from the solo game runner only if bundle output shows the combined route is heavy enough to matter.

2026-06-20 branch note: `/anatomime` still measured as a large route-owned client bundle after the shared audio shell reduction. Keep it as a separate follow-up branch so the game state and shared-session widgets can be split with focused tests.

2026-06-20 result: `/anatomime` was the next measured route-owned target at 2,889,251 first-load JavaScript bytes, 1,775,639 bytes above the home shell. The route now renders a lightweight team/round setup shell, warms the lazy game client during online idle so the service worker can cache its chunks for offline play, and renders the sourced anatomy deck and full game workspace after "Choose Anatomy Terms." Production route-bundle diagnostics dropped `/anatomime` to 1,122,077 bytes, leaving only 8,016 bytes above the home shell while keeping `/anatomime/join` and `/anatomime/play/[code]` unchanged. Added a source-contract test for the lazy boundary, and focused Anatomime browser tests passed.

- [x] **Step 6: validate**

Run:

```bash
npm run build
npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium
```

Expected: lower or unchanged first-load JS for public routes, no broken audio persistence, no calendar workspace regressions, no booking wizard interaction regression.

2026-06-20 result: the Anatomime lazy client branch passed `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium`, and `git diff --check`.

### Task 8: Harden Neon Transfer Hotspots

**Files:**
- Modify: `lib/anatomy-study-media.ts`
- Modify: `app/admin/anatomy/browser-data.ts`
- Modify: `app/admin/anatomy/media-review/page.tsx`
- Modify: `lib/anatomy-queries.ts`
- Modify: `scripts/anatomy-media-view-coverage.ts`
- Modify: `scripts/anatomy-media-view-requests.ts`
- Test: `tests/neon-transfer-hardening.test.mjs`

- [x] **Step 1: project repeated public study-media reads**

Replace repeated whole-table anatomy media loads with a reviewed BodyParts3D image/diagram projection, approved link filtering, and a short process-local cache.

- [x] **Step 2: project admin media review rows**

Keep the mobile media-review queue paginated and select only the asset/source fields rendered by the review card and sibling-image summary.

- [x] **Step 3: reduce admin/script media record width**

Keep anatomy browser media candidates and maintenance scripts on explicit media/link/request snippets instead of full asset/source/link records.

2026-06-20 result: the Neon transfer-hardening branch narrowed DB-backed flashcard media loading to reviewed open-reuse BodyParts3D image/diagram assets with approved links, added a 60-second in-process media-options cache for repeated flashcard API calls, projected admin media-review rows to rendered asset/source fields, limited selected-entity media details to the matching entity links, and projected BodyParts3D maintenance scripts. Added a source-contract test to guard these transfer boundaries.

### Task 9: Harden Local-First Documentation Types

**Files:**
- Modify: `app/notes/intake/client-page.tsx`
- Modify: `app/notes/soap/client-page.tsx`
- Modify: `app/notes/soap/components/*.tsx`
- Create: `app/notes/intake/types.ts`
- Modify or create: `app/notes/soap/types.ts`
- Test: `tests/local-intake-builder.test.mjs`
- Test: `tests/local-intake-workspace-page.test.mjs`
- Test: `tests/local-note-client-safety.test.mjs`

- [x] **Step 1: add local intake UI types**

Replace `type AnyRecord = Record<string, any>` in the intake client with named workspace, template, response, document, and client profile types derived from the normalized local intake contract.

- [x] **Step 2: keep storage compatibility**

Do not change `massagelab-professional-record-vault-v1`, intake workspace schema versions, `.mlab` transfer format, or plaintext export warnings.

- [x] **Step 3: type SOAP component props**

Replace broad `any` props in SOAP subcomponents with the existing `SoapNoteData` fields and narrow callback types.

- [x] **Step 4: validate**

Run:

```bash
node --test tests/local-intake-builder.test.mjs tests/local-intake-workspace-page.test.mjs tests/local-note-client-safety.test.mjs
npm run typecheck
npm run lint
```

Expected: no storage key changes, no hosted clinical network paths, no local document export schema change.

2026-06-20 result: the local-first type-hardening branch added named intake workspace/template/response/document/client UI types, moved `SoapNoteData` and SOAP section state setter contracts into the shared SOAP type file, replaced broad intake/SOAP `any` prop bags in the touched local-first clients, and added source-contract tests that preserve the encrypted professional-record vault, plaintext export warnings, and no clinical upload/network path boundaries.

### Task 10: Decide TS/JS Compatibility Policy Before Deleting Duplicates

**Files:**
- Modify: `tsconfig.json` only if a chosen branch intentionally changes JS handling
- Modify: duplicated `lib/*.ts` / `lib/*.js` pairs only one pair per branch
- Test: matching Node tests for each migrated helper

- [x] **Step 1: document current duplicate pairs**

Start with these pairs: `anatomime-session-server`, `anatomime-shared`, `anatomy-admin-source-input`, `anatomy-foundation`, `anatomy-media-review`, `anatomy-queries`, `anatomy-study`, `flashcard-community`, `flashcard-progress`, and `mblex-content-outline`.

- [x] **Step 2: choose one compatibility strategy**

Preferred default: TypeScript source as the canonical implementation with JavaScript compatibility wrappers only where Node tests or runtime imports still require `.js`.

- [ ] **Step 3: migrate one pair at a time**

For each pair, map imports first, update tests, remove or shrink only the duplicate that is proven unused, then run the focused test suite.

- [ ] **Step 4: validate**

Run:

```bash
npm run typecheck
npm run lint
npm run test
```

Expected: no runtime import breakage and no broad mechanical churn.

2026-06-20 result: the compatibility-policy branch documented the current duplicate pair inventory in `docs/audits/2026-06-20-ts-js-compatibility-inventory.md`, confirmed the listed `.js` files are one-line wrappers over canonical `.ts` implementations, and added `tests/ts-js-compatibility.test.mjs` to prevent wrapper drift. No wrappers were deleted in this pass because current Node tests and a few runtime compatibility imports still use `.js` paths. Future cleanup should migrate one pair per branch.

2026-06-21 follow-up: a fresh reference scan still showed no direct `.js` consumer for `anatomime-session-server`, so `lib/anatomime-session-server.js` was removed as the first low-risk wrapper migration.

## Acceptance For The Whole Series

- Current product behavior remains unchanged unless a later task explicitly asks for behavior changes.
- `npm run prisma:validate`, `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass on each branch.
- Targeted browser tests pass for changed user-facing routes.
- Production build output and route first-load JS are captured before and after client-splitting branches.
- Admin and signed-in routes perform less unnecessary data work, especially `/admin/anatomy`, flashcard progress APIs, and any measured global app-shell work.
- Local-first PHI boundaries remain intact and tested.
- Feature gates continue to use feature keys such as `chimer_custom_colors`.
- Refactors are branch-sized, reviewable, and easy to revert.
