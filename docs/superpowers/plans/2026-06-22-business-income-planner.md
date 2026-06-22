# Business Income Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, browser-local and account-syncable business income planner for massage students and therapists.

**Architecture:** Put all business math and persistence payload normalization in `lib/business-income-planner.js`, with tests proving the worksheet-derived formulas before UI code exists. Add a public hub at `/tools/business-planner` and an income planner at `/tools/business-planner/income`; the client owns local edits, reads optional signed-in seed data from `appSettings`, and saves one current worksheet through the existing account preferences API. Navigation, homepage discovery, SEO route contract, and public browser smoke tests make the tool discoverable without adding a database table.

**Tech Stack:** Next.js App Router, React client component, existing `AppPageShell`/`AppSurface` UI primitives, `Input`/`Button` controls, Recharts through `components/ui/chart.tsx`, existing `UserPreference.appSettings`, Node test runner, Playwright public route smoke tests.

---

### Task 1: Calculator Contract

**Files:**
- Create: `lib/business-income-planner.js`
- Create: `tests/business-income-planner.test.mjs`

- [ ] **Step 1: Write failing calculator tests**

Create `tests/business-income-planner.test.mjs` with tests importing `BUSINESS_INCOME_PRESETS`, `calculateBusinessIncomePlan`, and `normalizeBusinessIncomePlannerInput` from `../lib/business-income-planner.js`.

Required assertions:
- Presets include `starting_part_time`, `growing_solo_practice`, `full_schedule`, and `custom`.
- Negative numeric input normalizes to zero.
- A 20-client-hour week, 21 days off, 60-minute average session, `$60,000` take-home target, `$1,000` monthly fixed expenses, `$6` per-session cost, and `25%` set-aside produces positive annual hours, sessions, gross revenue, hourly target, and 30/60/90/120 prices.
- Zero weekly client hours returns calculation warnings and no finite hourly target.
- Workload scenarios include 50, 70, 90, and 100 percent capacity.
- Employee comparison returns annual gross and estimated take-home only when a wage is present.
- Persistence normalization removes PHI-shaped keys such as `clientName`, `soapDraft`, and `wellnessEntries`.

Run:

```powershell
node --test tests/business-income-planner.test.mjs
```

Expected: fail because `lib/business-income-planner.js` does not exist yet.

- [ ] **Step 2: Implement calculator helper**

Create `lib/business-income-planner.js` with:
- `BUSINESS_INCOME_PRESETS`
- `BUSINESS_INCOME_LOCAL_STORAGE_KEY`
- `BUSINESS_INCOME_APP_SETTINGS_KEY`
- `normalizeBusinessIncomePlannerInput(value)`
- `calculateBusinessIncomePlan(value)`
- `sanitizeBusinessIncomePlannerPreference(value)`

Implementation requirements:
- Use JSDoc for exported functions and the persisted preference shape.
- Clamp money, hours, days, and minutes to non-negative numbers.
- Clamp set-aside rate to `0 <= rate <= 0.8`.
- Use the formulas from the design spec.
- Return warnings for missing client hours or missing average session length.
- Keep `sessionPrices` keyed by `30`, `60`, `90`, and `120`.
- Keep `workloadScenarios` for 50, 70, 90, and 100 percent capacity.
- Drop forbidden persistence keys recursively.

Run:

```powershell
node --test tests/business-income-planner.test.mjs
```

Expected: pass.

---

### Task 2: Public Routes And Planner UI

**Files:**
- Create: `app/tools/business-planner/page.tsx`
- Create: `app/tools/business-planner/income/page.tsx`
- Create: `app/tools/business-planner/income/income-planner-client.tsx`
- Test: `tests/browser/public-routes.spec.ts`

- [ ] **Step 1: Add failing route coverage**

Modify `tests/browser/public-routes.spec.ts` to include:
- `{ path: "/tools/business-planner", expectedText: /Business Planner/i }`
- `{ path: "/tools/business-planner/income", expectedText: /Business Income Planner/i }`

Run:

```powershell
npm run test:browser -- tests/browser/public-routes.spec.ts -g "anonymous public route /tools/business-planner" --project=desktop-chromium
```

Expected: fail because the routes do not exist yet.

- [ ] **Step 2: Build hub and income pages**

Create the hub with `AppPageShell`, a live Income Planner card linking to `/tools/business-planner/income`, and planned non-clickable cards for future business planner tools.

Create the income page as a server component that:
- Exports `createPublicPageMetadata("/tools/business-planner/income")`.
- Reads `getCurrentSession()`.
- If signed in, selects only `appSettings` from `prisma.userPreference`.
- Passes the current persisted worksheet from `appSettings.businessIncomePlannerIncome` into the client.

Create `income-planner-client.tsx` as a client component that:
- Renders preset buttons, assumptions inputs, summary metrics, chart, workload scenarios, employee comparison, and interpretation.
- Uses `localStorage` for anonymous persistence.
- Uses the existing `/api/account/preferences` PUT route only when signed in.
- Sends `{ appSettings: { businessIncomePlannerIncome: sanitizedInput } }` so the account has one overwritten current worksheet.
- Does not call account APIs for anonymous users.

Run:

```powershell
npm run test:browser -- tests/browser/public-routes.spec.ts -g "anonymous public route /tools/business-planner" --project=desktop-chromium
npm run test:browser -- tests/browser/public-routes.spec.ts -g "anonymous public route /tools/business-planner/income" --project=desktop-chromium
```

Expected: pass.

---

### Task 3: Discovery, SEO, And Navigation

**Files:**
- Modify: `lib/seo.js`
- Modify: `lib/navigation.js`
- Modify: `lib/onboarding-preferences.js`
- Modify: `app/page.tsx`
- Modify: `tests/seo.test.mjs`
- Modify: `tests/navigation-model.test.mjs`
- Modify: `tests/onboarding-preferences.test.mjs`

- [ ] **Step 1: Add failing source-contract tests**

Update tests so they expect:
- `/tools/business-planner` and `/tools/business-planner/income` in `PUBLIC_SEO_ROUTES`.
- `readProjectFile("app/tools/business-planner/income/page.tsx")` or the client source to contain `business income planner`.
- Navigation visible routes include the business planner hub and income planner under Tools.
- Home tool catalog contains `business_income_planner`.
- Student and therapist default shortcut order includes the income planner when manage-practice or run-session signals are present.

Run:

```powershell
node --test tests/seo.test.mjs tests/navigation-model.test.mjs tests/onboarding-preferences.test.mjs
```

Expected: fail until route metadata, navigation, and catalog entries are added.

- [ ] **Step 2: Wire discovery and metadata**

Update:
- `lib/seo.js` with public route metadata for `/tools/business-planner` and `/tools/business-planner/income`.
- `lib/navigation.js` with public Tools routes for Business Planner and Income Planner.
- `lib/onboarding-preferences.js` with a `business_income_planner` catalog entry and role/use-case defaults.
- `app/page.tsx` icon imports/map with a suitable lucide icon.

Run:

```powershell
node --test tests/seo.test.mjs tests/navigation-model.test.mjs tests/onboarding-preferences.test.mjs
```

Expected: pass.

---

### Task 4: Persistence And Source Guards

**Files:**
- Modify: `tests/account-preferences.test.mjs`
- Create or modify: `tests/business-income-planner-source.test.mjs`

- [ ] **Step 1: Add failing guard tests**

Add tests asserting:
- `removeForbiddenPreferenceFields()` removes business planner nested forbidden keys when a planner payload accidentally includes PHI-shaped names.
- The income page reads `select: { appSettings: true }` instead of the full preference row.
- The income planner source contains `/api/account/preferences` only behind a signed-in guard.
- The repo does not add a `BusinessIncomeScenario` Prisma model.

Run:

```powershell
node --test tests/account-preferences.test.mjs tests/business-income-planner-source.test.mjs
```

Expected: fail until source guards or forbidden-key coverage are present.

- [ ] **Step 2: Satisfy guard tests**

Add any missing forbidden-key test coverage and keep implementation scoped to `UserPreference.appSettings`. Do not modify `prisma/schema.prisma` for this feature.

Run:

```powershell
node --test tests/account-preferences.test.mjs tests/business-income-planner-source.test.mjs
```

Expected: pass.

---

### Task 5: Project Docs And Validation

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Update project docs**

Update project state and log to mention the business planner income tool as a branch outcome or active implementation, preserving local-first and no-PHI boundaries.

- [ ] **Step 2: Run focused validation**

Run:

```powershell
node --test tests/business-income-planner.test.mjs tests/business-income-planner-source.test.mjs tests/account-preferences.test.mjs tests/seo.test.mjs tests/navigation-model.test.mjs tests/onboarding-preferences.test.mjs
npm run typecheck
npm run lint
npm run test:browser -- tests/browser/public-routes.spec.ts -g "anonymous public route /tools/business-planner" --project=desktop-chromium
npm run test:browser -- tests/browser/public-routes.spec.ts -g "anonymous public route /tools/business-planner/income" --project=desktop-chromium
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Commit implementation**

Stage implementation files and commit:

```powershell
git add app docs lib tests
git commit -m "Add business income planner tool"
```
