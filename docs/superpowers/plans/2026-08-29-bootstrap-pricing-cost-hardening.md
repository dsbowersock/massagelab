# Bootstrap and Pricing Cost Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an ordinary signed-in, non-practice shell reuse one server-owned bootstrap and make public membership-price display reads bounded and shared, without caching or moving authentication, entitlement, customer, payment, Portal, or webhook authority.

**Architecture:** Extend the existing root sidebar read into the one server bootstrap owner for the signed-in account's shell-safe `UserPreference.appSettings` projection and practice-role presence, then deliver that projection through one account-owner-keyed client context. Settings and Music consume that context; profile, calendar, and background-commerce data stay lazy behind actual consumers. Move the only in-process cache and single-flight for the six public display Prices into `lib/membership-pricing.js`, while every user-specific membership read and every Stripe mutation remains fresh and server-authoritative.

**Tech Stack:** Next.js App Router and React Server Components, React client contexts, Auth.js, Prisma/Neon, Stripe Node SDK 22.x, Node test runner, Playwright, existing route-timing/workload harnesses.

**Spec:** `docs/superpowers/specs/2026-08-28-family-friends-readiness-design.md`

## Global Constraints

- TDD Route is strict for every behavior-changing task: write the focused RED test, observe the intended failure, implement the smallest owner-level change, then run the listed GREEN and regression commands.
- Do not connect to or mutate a live or private database. Do not apply a migration; this plan requires no schema change.
- Do not create a Checkout, Portal session, Customer, subscription, payment, refund, cancellation, webhook event, or provider setting. Do not call live Stripe during implementation or verification.
- Do not push, deploy, merge, change Production environment values, or change OAuth, mail, Stripe, Neon, R2, Vercel, or Sentry configuration without a separate exact authorization.
- Clinical notes, intake forms, journals, ROM sessions, transcripts, and other PHI-bearing workflows remain local-first. The shell bootstrap may serialize only the explicit app-layout and Music visualizer fields defined below.
- The cache boundary is public display catalog data only. Session, user, practice, membership, entitlements, customers, Checkout, Portal, webhook receipts, commerce ownership, and billing-return status remain uncached by this work.
- Existing independent registration and Supporter Checkout pause controls remain server-read on each request. Neither pause value belongs in the pricing catalog cache.
- Existing `/api/account/preferences` and `/api/account/profile` `PUT` authentication, sanitization, authorization, persistence, and cache invalidation remain server-owned.
- A provider call count means a logical SDK method invocation. With `maxNetworkRetries: 1`, Stripe may perform one retry behind one logical invocation; documentation must not call six logical reads six network attempts.
- “Cold catalog” means an empty in-process catalog owner. It is not a Vercel cold start, a newly deployed instance, or a globally empty cache.
- The existing timing harness's `first` sample means the first request after its owned local server becomes ready. It is not platform cold-start evidence.

---

## First-Principles Decision

**First Principle:** An ordinary shell should discover account state once from the server and reuse a narrow projection; public price display may be briefly stale, but login, access, and money authority may not be stale.

**Non-negotiables:** One account owner per client generation; fail closed across owner changes; no raw `appSettings` serialization; no global commerce read without commerce intent; no user/payment cache; no live-provider verification.

**Assumptions to Drop:** Each mounted provider does not need to rediscover the session or fetch the same preferences. Account does not need a second price-cache owner. Every signed-in person does not need a calendar or commerce snapshot on every route.

**Smallest Sufficient Path:** Reuse the root's existing preference and practice-role reads, add one narrow client carrier and one fallback coordinator, lazily activate specialized providers, and centralize the already-public price projection cache in its existing domain module.

**Escalation Signal:** Stop for design review if implementation needs a second bootstrap endpoint, a raw JSON settings carrier, a persistent/TTL session cache, cached entitlements or customer state, a new database table, or a provider mutation.

### Owner and Retirement Matrix

| Concern | Canonical owner after this plan | Retired duplicate | Falsifier / retirement proof |
| --- | --- | --- | --- |
| Shell-safe app settings | Root `getAppSidebarData()` plus `projectAccountShellAppSettings()` | Settings GET and Music preferences GET | Built client proof observes no ordinary preferences GET after a successful server read |
| Signed-in state for Music | Root session/bootstrap owner | Music `/api/auth/session` GET | Music source and browser network proof contain no session request |
| Fallback preferences read | `AccountShellBootstrapProvider` | Per-provider retries | Two consumers share one request; old-owner completion is ignored |
| Therapist cloud defaults | `TherapistSettingsProvider` on first consumer | Global mount GET | No consumer means zero profile GET; concurrent consumers mean one |
| Calendar sidebar context | Existing authenticated endpoint, enabled by root practice-role presence | Every signed-in user's endpoint call | Zero-practice owner makes zero requests; practice member still loads |
| Background commerce snapshot | Existing provider, activated by commerce intent | Global signed-in mount refresh | Ordinary shell makes zero snapshot reads; picker/return/cart intent still loads |
| RSC session snapshot | Request-scoped React `cache()` wrapper, only if measured | Repeated page/layout Auth.js calls | Actual RSC counter is exactly one; no module TTL or persistent value exists |
| Public pricing catalog | `lib/membership-pricing.js` process-local owner | Account's private 5-minute wrapper | Concurrent cold callers total six logical Price reads; warm callers add zero |
| Checkout/payment authority | Existing Checkout route and Stripe billing contract | None | Stale display ID is revalidated/rejected server-side; no catalog cache is consulted |

## Evidence Baseline and Honest Target

Current code inspection at plan time confirms these distinct calls for a signed-in shell:

- root: one `getCurrentSession()` invocation, one `userPreference.findUnique`, and one `practiceMembership.findMany`;
- Settings: one client `GET /api/account/preferences`;
- Music: one client `GET /api/auth/session`, followed by another `GET /api/account/preferences`;
- Therapist settings: one client `GET /api/account/profile` on every provider mount;
- calendar: one client `GET /api/calendar/sidebar-context` for every signed-in user;
- background commerce: one client `GET /api/background-commerce/state` for every signed-in user;
- pricing: six concurrent Stripe Price retrievals per uncached `getMembershipPricingCatalog()` call;
- Account membership: a separate five-minute pricing cache in `lib/account-surface-data.js`.

The acceptance target is intentionally scoped to an ordinary signed-in, non-practice shell with no pending guest-cart merge and no mounted feature consumer that legitimately requests therapist, calendar, or commerce data:

| Measurement | Target |
| --- | ---: |
| Client bootstrap endpoints (`/api/auth/session`, preferences GET, profile GET, calendar context GET) | 0 |
| Background-commerce snapshot GET | 0 |
| Logical ORM operations | 4 |
| Auth snapshots | 1 |
| Entitlement builds | 1 |
| Background-credit provisioner calls | 0 |
| Commerce snapshot builds | 0 |

The four logical ORM operations are: auth user graph, active temporary grants, shell `UserPreference.appSettings`, and shell practice roles. This is a deterministic logical-operation receipt, not a claim about Prisma's emitted SQL count or Neon transfer bytes.

## File Responsibility Map

| File | Responsibility after implementation |
| --- | --- |
| `lib/account-shell-bootstrap.js` | Pure allowlisted projection and serializable bootstrap contract |
| `components/sidebar/sidebar.tsx` | One root session, preference projection, practice roles, navigation, and bootstrap assembly |
| `components/providers/account-shell-bootstrap-provider.tsx` | Account-owner-keyed client state and the sole failure-only preferences fallback |
| `components/providers/settings-provider.tsx` | Local app settings plus bootstrap consumption and existing authenticated PUT |
| `components/providers/music-provider.tsx` | Playback plus bootstrap consumption and existing Music preference PUT; no session or initial GET |
| `components/providers/therapist-settings-provider.tsx` | Immediate local defaults and first-consumer, single-flight cloud hydration |
| `components/sidebar/sidebar-calendar-provider.tsx` | Practice-member-only endpoint hydration with owner-change cancellation |
| `components/backgrounds/BackgroundCommerceProvider.tsx` | Intent-driven, owner-keyed commerce snapshot and existing mutations |
| `lib/rsc-session.ts` | RSC-request-only cached adapter around `getCurrentSession`, if the proof gate requires it |
| `lib/membership-pricing.js` | Public display catalog construction, single-flight, dynamic TTL, and Price read options |
| `lib/account-surface-data.js` | Fresh account surfaces; no second public-pricing cache |
| `tests/family-friends-server-workload.test.mjs` | Deterministic logical work receipt and authority source guards |
| `docs/superpowers/reports/2026-08-29-bootstrap-pricing-cost-hardening.md` | Exact-SHA local evidence with careful first/cold/provider labels |

## Complexity Budgets

- `components/providers/music-provider.tsx` is over 3,000 lines and is already a strong source-complexity pressure signal. This plan permits only move-out/removal of account discovery and narrow consumption wiring there; it must not add another request coordinator or responsibility.
- `app/account/page.tsx` is over 1,200 lines. Pricing work must stay in `lib/membership-pricing.js` and `lib/account-surface-data.js`; Account receives data without new cache or payment logic.
- `lib/stripe-billing.js` is over 1,700 lines. Its only allowed change is the narrow request-options passthrough for the existing read-only `retrieveStripePrice`; no Checkout, Portal, Customer, subscription, webhook, or reconciliation branch changes.
- New client-provider files should stay focused on one owner and one state machine. If a new file exceeds roughly 400 lines or mixes server projection, client fallback, and feature-specific state, stop and split before review.

---

### Task 1: Establish the shell bootstrap projection and exact server workload

**Files:**
- Create: `lib/account-shell-bootstrap.js`
- Create: `tests/account-shell-bootstrap.test.mjs`
- Modify: `components/sidebar/sidebar.tsx`
- Modify: `tests/family-friends-server-workload.test.mjs`

**Interfaces:**
- Produces: `projectAccountShellAppSettings(value): { app: AppSettings, musicVisualizer: MusicVisualizerAccountPreferences }`.
- Produces: `AccountShellBootstrap = { ownerKey, syncEnabled, preferenceStatus, appSettings, hasPracticeMembership }`.
- `preferenceStatus` is exactly `"anonymous" | "ready" | "failed"`.
- `ownerKey` is the authenticated user id or `null`; it is never logged or placed in a URL.
- The projection includes only the keys returned by `normalizeAppSettings()` and `normalizeMusicVisualizerAccountPreferences()`. It excludes onboarding, supporter interests, planner data, unknown keys, and every PHI-shaped key.
- `getAppSidebarData()` remains the sole root server owner and returns `{ user, canSyncAccountSettings, navigation, accountBootstrap }`.

- [ ] **Step 1: Write the pure projection RED tests**

Create `tests/account-shell-bootstrap.test.mjs` with cases equivalent to:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { projectAccountShellAppSettings } from "../lib/account-shell-bootstrap.js"

describe("account shell bootstrap", () => {
  it("projects only app-layout and Music visualizer fields", () => {
    const projected = projectAccountShellAppSettings({
      appBarPosition: "top",
      sidebarPosition: "right",
      themeMode: "system",
      musicVisualizer: { defaultBackgroundId: "aurora", showClock: true, token: "drop" },
      onboarding: { primaryRole: "therapist" },
      supporterRoadmapInterests: ["voice"],
      soapDraft: "must-not-cross",
      unknown: "must-not-cross",
    })

    assert.deepEqual(projected.app, {
      appBarPosition: "top",
      sidebarPosition: "right",
      sidebarTriggerPosition: "top",
      ambientMotionMode: "system",
      themeMode: "system",
      hapticFeedbackEnabled: true,
    })
    assert.deepEqual(projected.musicVisualizer, {
      defaultBackgroundId: "aurora",
      showClock: true,
    })
    assert.doesNotMatch(JSON.stringify(projected), /soap|onboarding|supporter|unknown|token/i)
  })
})
```

Extend `tests/family-friends-server-workload.test.mjs` so the signed-in shell fake counts `userGraphReads`, `temporaryGrantReads`, `preferenceReads`, `practiceRoleReads`, `entitlementBuilds`, `commerceSnapshotLoads`, and client bootstrap endpoint intentions. Assert the exact target table above and keep the established background-credit call count at zero.

- [ ] **Step 2: Run RED and confirm the missing owner contract**

Run:

```bash
node --test tests/account-shell-bootstrap.test.mjs tests/family-friends-server-workload.test.mjs
```

Expected: FAIL because the pure projection and combined bootstrap result do not exist, and the current workload does not account for the duplicate client discovery calls.

- [ ] **Step 3: Add the allowlisted pure projection**

Implement `lib/account-shell-bootstrap.js` with the following contract, using the existing normalizers rather than copying their rules:

```js
// @ts-check
import { normalizeAppSettings } from "./app-settings.js"
import { normalizeMusicVisualizerAccountPreferences } from "./music-visualizer.js"

export function projectAccountShellAppSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {}
  return {
    app: normalizeAppSettings(source),
    musicVisualizer: normalizeMusicVisualizerAccountPreferences(source.musicVisualizer),
  }
}
```

Do not return or spread the source record.

- [ ] **Step 4: Make the existing root reads assemble one bootstrap**

In `components/sidebar/sidebar.tsx`:

1. replace `loadSidebarQuickActionOnboarding()` with one preference loader that selects only `appSettings` and returns both the existing onboarding projection and `projectAccountShellAppSettings(appSettings)`;
2. return `preferenceStatus: "ready"` for a successful read, including a missing row, and `"failed"` only after the existing privacy-safe warning path;
3. retain one `practiceMembership.findMany` read, return its rows through `getSidebarNavigationContext`, and derive `hasPracticeMembership` from `practiceRoles.length > 0`;
4. assemble `accountBootstrap` without a second Prisma call; and
5. keep anonymous output at `ownerKey: null`, `syncEnabled: false`, `preferenceStatus: "anonymous"`, safe defaults, and `hasPracticeMembership: false`.

Use this exact serializable shape:

```ts
type AccountShellBootstrap = {
  ownerKey: string | null
  syncEnabled: boolean
  preferenceStatus: "anonymous" | "ready" | "failed"
  appSettings: ReturnType<typeof projectAccountShellAppSettings>
  hasPracticeMembership: boolean
}
```

The existing `quickActionOnboarding` projection remains separate on `SidebarUser`; do not expose the raw onboarding object through `accountBootstrap`.

- [ ] **Step 5: Run GREEN and the navigation regression set**

Run:

```bash
node --test tests/account-shell-bootstrap.test.mjs tests/auth-session-feature-keys.test.mjs tests/navigation-model.test.mjs tests/family-friends-server-workload.test.mjs
npm run typecheck
```

Expected: all pass; the workload prints four logical ORM operations, one entitlement build, zero background-credit provisioner calls, and zero commerce snapshots for the scoped shell fake.

- [ ] **Step 6: First-principles review gate**

Reviewer must reject the task if it adds a new API route, serializes raw `appSettings`, repeats the preference/practice read, or moves entitlement computation out of the existing auth owner. Reviewer records that `components/sidebar/sidebar.tsx` remains projection/orchestration rather than a new cache owner.

- [ ] **Step 7: Commit the server owner**

```bash
git add lib/account-shell-bootstrap.js components/sidebar/sidebar.tsx tests/account-shell-bootstrap.test.mjs tests/family-friends-server-workload.test.mjs
git commit -m "perf: project one account shell bootstrap"
```

---

### Task 2: Add one account-owner-keyed client bootstrap and failure-only fallback

**Files:**
- Create: `components/providers/account-shell-bootstrap-provider.tsx`
- Create: `tests/account-shell-bootstrap-provider.test.mjs`
- Modify: `app/layout.tsx`
- Modify: `tests/dev-clock.test.mjs`

**Interfaces:**
- Produces: `AccountShellBootstrapProvider({ initialBootstrap, children })`.
- Produces: `useAccountShellBootstrap(): { ownerKey, syncEnabled, status, appSettings, retryFallback }`.
- Client `status` is exactly `"anonymous" | "ready" | "fallback-loading" | "failed"`.
- The provider makes `GET /api/account/preferences` only when the server supplied `preferenceStatus: "failed"`, and every consumer shares that one in-flight request.
- The fallback uses `fetchJsonWithTimeout(..., 10_000)` so fetch and successful JSON consumption share one deadline.
- The fallback response is immediately passed through `projectAccountShellAppSettings()`; raw JSON never enters context state.
- An owner change aborts the old request, invalidates its generation, clears old app settings, and adopts only the new server bootstrap.

- [ ] **Step 1: Write RED state-machine and component-source tests**

Create cases that exercise these exact transitions with deferred fetch promises:

```text
ready server bootstrap + two consumers -> 0 fallback requests
failed server bootstrap + two consumers -> 1 fallback request
failed fallback -> status failed, safe defaults retained
owner A request pending -> owner B initial ready -> A response ignored
anonymous transition -> old owner data absent and no fallback request
explicit retry after failure -> one new request, still shared
```

The source contract must also assert that the provider imports the pure projection and that `app/layout.tsx` keys the provider by `ownerKey ?? "anonymous"`.

- [ ] **Step 2: Run RED**

```bash
node --test tests/account-shell-bootstrap-provider.test.mjs tests/account-shell-bootstrap.test.mjs tests/dev-clock.test.mjs
```

Expected: FAIL because there is no shared client owner and root still passes independent booleans into three providers.

- [ ] **Step 3: Implement the provider as the only fallback coordinator**

The provider must keep one `AbortController`, one monotonically increasing generation, and one in-flight promise for the current owner. Its fallback effect is equivalent to:

```tsx
useEffect(() => {
  generationRef.current += 1
  fallbackControllerRef.current?.abort()
  setValue(valueFromServer(initialBootstrap))
  if (initialBootstrap.preferenceStatus !== "failed" || !initialBootstrap.ownerKey) return
  void runFallback(initialBootstrap.ownerKey, generationRef.current)
  return () => fallbackControllerRef.current?.abort()
}, [initialBootstrap.ownerKey, initialBootstrap.preferenceStatus, initialBootstrapKey])
```

`runFallback` must dedupe same-owner callers, parse only a successful response, project `body.appSettings`, compare both owner and generation before commit, and clear only its own in-flight/controller references in `finally`.

- [ ] **Step 4: Wire the provider above all shell consumers**

In `app/layout.tsx`, wrap `SettingsProvider`, `TherapistSettingsProvider`, `MusicProvider`, `SidebarProvider`, and `LayoutWrapper` with:

```tsx
<AccountShellBootstrapProvider
  key={accountBootstrap.ownerKey ?? "anonymous"}
  initialBootstrap={accountBootstrap}
>
  {/* existing providers */}
</AccountShellBootstrapProvider>
```

At this task boundary leave the old provider props present if needed for compilation; Task 3 removes them after consumers adopt the context. Do not add a second context in Settings or Music.

- [ ] **Step 5: Run GREEN and build the client boundary**

```bash
node --test tests/account-shell-bootstrap.test.mjs tests/account-shell-bootstrap-provider.test.mjs tests/dev-clock.test.mjs
npm run typecheck
npm run build
```

Expected: tests and the ordinary Production build pass. The build is compilation/RSC serialization evidence only; it is not signed-in workload proof.

- [ ] **Step 6: Review gate**

Reviewer must inspect stale-owner behavior, successful-body deadline coverage, `finally` cleanup, the absence of raw settings, and the absence of a fallback on `ready` or `anonymous`. A second GET owner is an Important finding.

- [ ] **Step 7: Commit the shared client carrier**

```bash
git add app/layout.tsx components/providers/account-shell-bootstrap-provider.tsx tests/account-shell-bootstrap-provider.test.mjs tests/dev-clock.test.mjs
git commit -m "feat: share account shell bootstrap"
```

---

### Task 3: Remove Settings and Music duplicate discovery

**Files:**
- Modify: `components/providers/settings-provider.tsx`
- Modify: `components/providers/music-provider.tsx`
- Modify: `app/layout.tsx`
- Modify: `tests/music-visualizer-provider.test.mjs`
- Modify: `tests/app-settings.test.mjs`
- Modify: `tests/dev-clock.test.mjs`
- Modify: `tests/browser/public-routes.spec.ts`

**Interfaces:**
- Settings consumes `appSettings.app` and retains its existing local-storage key and authenticated preferences `PUT`.
- Music consumes `appSettings.musicVisualizer` and retains its existing preferences `PUT`, pending-write identity, retry, and fail-closed background access behavior.
- Removes: Music `GET /api/auth/session` and its `canSyncAccountPreferencesFromSession` dependency.
- Removes: both Settings and Music initial `GET /api/account/preferences` paths.
- `retryVisualizerAccountSync()` retries an exact failed PUT first; otherwise it delegates to the shared bootstrap's `retryFallback()` only when fallback state failed.
- Owner changes abort/invalidate any in-flight Music PUT and clear the prior owner's default before adopting the next owner.

- [ ] **Step 1: Write RED network/source contracts**

Update tests to assert:

```js
assert.doesNotMatch(musicProviderSource, /\/api\/auth\/session/)
assert.equal((musicProviderSource.match(/\/api\/account\/preferences/g) ?? []).length, 1) // PUT only
assert.equal((settingsProviderSource.match(/\/api\/account\/preferences/g) ?? []).length, 1) // PUT only
assert.match(musicProviderSource, /useAccountShellBootstrap/)
assert.match(settingsProviderSource, /useAccountShellBootstrap/)
```

Add an owner-switch case to the existing real-browser Music/provider harness: owner A starts a PUT, the harness changes to owner B, owner A resolves, and owner B's default/status remains unchanged. Update `tests/browser/public-routes.spec.ts` mocks so browser routes no longer expect Music's session-then-preferences discovery sequence.

- [ ] **Step 2: Run RED**

```bash
node --test tests/account-shell-bootstrap-provider.test.mjs tests/music-visualizer-provider.test.mjs tests/app-settings.test.mjs tests/dev-clock.test.mjs
```

Expected: FAIL on the three current client GET paths and the missing owner-key reset.

- [ ] **Step 3: Convert Settings to bootstrap consumption**

Remove `syncEnabled` from `SettingsProvider`. Keep local hydration first and independent of network. When the bootstrap is `ready`, normalize and apply `appSettings.app`, set `canSync` from the current owner, and persist the same local-storage snapshot. When bootstrap is `anonymous` or `failed`, keep safe local settings and disable cloud PUT. Preserve the existing `PUT` body exactly:

```json
{ "appSettings": { "appBarPosition": "...", "sidebarPosition": "...", "sidebarTriggerPosition": "...", "ambientMotionMode": "...", "themeMode": "...", "hapticFeedbackEnabled": true } }
```

- [ ] **Step 4: Convert Music to bootstrap consumption**

In `components/providers/music-provider.tsx`:

1. remove `syncVisualizerAccountPreferences`, the session GET, the initial preferences GET, and `canSyncAccountPreferencesFromSession`;
2. read `ownerKey`, `syncEnabled`, bootstrap `status`, projected Music preferences, and `retryFallback` from the shared context;
3. on every owner-key change, increment `accountRequestIdRef`, abort the old controller, clear verification/hydration/pending/failed refs, reset the account default and signed-in status, then adopt the new projection only for `ready`;
4. retain `persistVisualizerAccountPreferences()` as the sole Music network call and preserve its exact partial `appSettings.musicVisualizer` PUT body;
5. keep successful server-sanitized PUT responses authoritative; and
6. keep local-only playback and device visualizer state usable while account sync is anonymous, loading, or failed.

This is a move-out/removal edit in the over-budget Music file. Do not add the fallback state machine there.

- [ ] **Step 5: Remove obsolete root props and run GREEN**

Remove `syncEnabled` and `accountSyncEnabled` props from `app/layout.tsx`. Run:

```bash
node --test tests/account-shell-bootstrap-provider.test.mjs tests/music-visualizer-provider.test.mjs tests/app-settings.test.mjs tests/account-preferences.test.mjs tests/account-preferences-route.test.mjs tests/dev-clock.test.mjs
npm run typecheck
npm run lint
```

Expected: all pass; source contracts find one preferences URL in each provider and no Music session URL.

- [ ] **Step 6: Browser review gate**

Run the focused public-route Music/settings cases on a freshly built Browser-QA artifact. Network assertions must distinguish GET from PUT and prove no unexpected request, not merely return mocked `200` responses:

```bash
npm run build:browser-qa
npx playwright test tests/browser/public-routes.spec.ts --project=desktop-chromium --workers=1 --grep "visualizer|account preference|anonymous account sync"
```

Reviewer must confirm local device settings remain usable, old-owner results are ignored, and write authentication remains on `/api/account/preferences`.

- [ ] **Step 7: Commit duplicate-discovery retirement**

```bash
git add app/layout.tsx components/providers/settings-provider.tsx components/providers/music-provider.tsx tests/music-visualizer-provider.test.mjs tests/app-settings.test.mjs tests/dev-clock.test.mjs tests/browser/public-routes.spec.ts
git commit -m "perf: retire duplicate shell preference reads"
```

---

### Task 4: Lazy-load therapist and calendar specialization

**Files:**
- Modify: `components/providers/therapist-settings-provider.tsx`
- Modify: `components/sidebar/sidebar-calendar-provider.tsx`
- Modify: `app/layout.tsx`
- Create: `tests/therapist-settings-provider.test.mjs`
- Modify: `tests/sidebar-calendar-context.test.mjs`
- Modify: `tests/browser/app-shell.spec.ts`

**Interfaces:**
- Therapist provider consumes the shared `ownerKey` and `syncEnabled`.
- `useTherapistSettings()` triggers `ensureCloudHydrated()` in an effect; the provider itself does not fetch merely because it mounted.
- Concurrent therapist consumers share one profile GET for the current owner.
- Local therapist defaults hydrate and remain editable without waiting for or succeeding at cloud GET.
- Calendar provider accepts `ownerKey: string | null` and `enabled: boolean`; root supplies `enabled={accountBootstrap.hasPracticeMembership}`.
- Calendar endpoint and response shape remain unchanged for practice members.

- [ ] **Step 1: Write RED lazy/dedupe/stale-owner tests**

Cover these cases in a small compiled React/browser harness:

```text
provider mount, no therapist consumer -> 0 profile GET
first therapist consumer -> 1 profile GET
two concurrent consumers -> still 1 profile GET
profile failure -> local defaults preserved and PUT disabled
owner A profile pending, owner B replaces context -> A response ignored
zero-practice owner -> 0 calendar-context GET
practice-member owner -> 1 calendar-context GET
owner change -> old calendar request aborted and empty context shown until new result
```

Update `tests/sidebar-calendar-context.test.mjs` to stop asserting route-independent loading for everyone. It should assert root practice membership is the enablement signal, while `/api/calendar/sidebar-context` keeps its current authenticated, PHI-minimized response contract.

- [ ] **Step 2: Run RED**

```bash
node --test tests/therapist-settings-provider.test.mjs tests/sidebar-calendar-context.test.mjs tests/account-shell-bootstrap.test.mjs
```

Expected: FAIL because both providers currently fetch immediately for any signed-in user and do not key requests by account owner.

- [ ] **Step 3: Make therapist cloud hydration first-consumer-only**

Keep `massage-lab-therapist-settings` local hydration at provider mount and independent of account state. Add an `ensureCloudHydrated()` callback that:

- returns immediately for anonymous/disabled sync;
- returns the same in-flight promise for concurrent current-owner calls;
- uses one abortable, bounded `GET /api/account/profile`;
- sets `canSync` only after a successful current-owner response;
- writes only the five existing allowlisted therapist fields to local storage; and
- ignores every completion whose owner generation is stale.

Have `useTherapistSettings()` call `ensureCloudHydrated()` in a React effect. Preserve the exact server-owned profile PUT path and payload.

- [ ] **Step 4: Gate calendar hydration with the existing practice projection**

Pass both `ownerKey` and `hasPracticeMembership` from the bootstrap into `SidebarCalendarProvider`. Add an `AbortController` to the endpoint GET. On owner or enablement change, abort the previous request and reset to `emptySidebarCalendarContext` before any new load. Do not change the endpoint's one-minute server cache or query projection.

- [ ] **Step 5: Run GREEN and focused browser proof**

```bash
node --test tests/therapist-settings-provider.test.mjs tests/sidebar-calendar-context.test.mjs tests/account-shell-bootstrap.test.mjs tests/account-preferences-route.test.mjs
npm run typecheck
npx playwright test tests/browser/app-shell.spec.ts --project=desktop-chromium --workers=1 --grep "bootstrap|calendar|therapist"
```

The browser fixture may use inert synthetic owner/practice props; it must not require a private database row.

- [ ] **Step 6: Review gate**

Reviewer must verify that “lazy” is consumer-driven rather than route-name guessing, local therapist defaults remain immediate/local-first, a zero-practice user cannot accidentally fetch calendar context, and practice-member navigation/badges retain their endpoint.

- [ ] **Step 7: Commit specialized lazy hydration**

```bash
git add app/layout.tsx components/providers/therapist-settings-provider.tsx components/sidebar/sidebar-calendar-provider.tsx tests/therapist-settings-provider.test.mjs tests/sidebar-calendar-context.test.mjs tests/browser/app-shell.spec.ts
git commit -m "perf: defer specialized shell hydration"
```

---

### Task 5: Remove the ordinary-shell commerce snapshot without losing commerce intent

**Files:**
- Modify: `components/backgrounds/BackgroundCommerceProvider.tsx`
- Modify: `components/backgrounds/background-carousel.tsx`
- Modify: `components/backgrounds/BackgroundCheckoutReturnStatus.tsx`
- Modify: `app/chimer/page.tsx`
- Modify: `components/account/BackgroundCommercePanel.tsx`
- Modify: `components/layout-wrapper.tsx`
- Modify: `tests/background-commerce-surfaces.test.mjs`
- Modify: `tests/background-checkout-surfaces.test.mjs`
- Modify: `tests/family-friends-server-workload.test.mjs`
- Modify: `tests/browser/background-commerce.spec.ts`

**Interfaces:**
- `BackgroundCommerceProvider` accepts `ownerKey: string | null`, not a signed-in boolean alone.
- Produces: `ensureSnapshot(): Promise<void>`; concurrent current-owner callers and a demanded-but-unhydrated focus/online retry share one GET.
- `refresh()` remains an explicit fresh read after a known mutation, focus/online event for an already-established owner, or Checkout-return poll.
- Provider mount with no pending guest cart and no actual consumer performs zero `/api/background-commerce/state` requests.
- Existing server endpoints, ownership authority, credit redemption, cart writes, Checkout, reservations, and serialized mutations remain unchanged.

- [ ] **Step 1: Write RED intent and owner-generation tests**

Add focused tests for:

```text
signed-in provider mount with empty guest cart -> 0 snapshot GET
two actual consumers calling ensureSnapshot -> 1 snapshot GET
background carousel mount -> snapshot becomes available
background Checkout return -> immediate snapshot then existing bounded polling
pending guest cart after sign-in -> merge still runs and snapshot is refreshed
open Account commerce panel cart -> snapshot loads before/while dialog opens
focus/online before any consumer demand -> 0 refreshes
focus/online after demanded first hydration fails -> 1 retry shared with concurrent ensureSnapshot
focus/online after hydration -> 1 current-owner refresh per event
owner A response after owner B transition -> ignored; A reads/mutations aborted
```

Retain all existing mutation serialization, optimistic ownership reconciliation, and checkout URL validation tests.

- [ ] **Step 2: Run RED**

```bash
node --test tests/background-commerce-surfaces.test.mjs tests/background-checkout-surfaces.test.mjs tests/family-friends-server-workload.test.mjs
```

Expected: FAIL because the provider currently calls `refresh()` unconditionally for every enabled signed-in mount.

- [ ] **Step 3: Add one intent-driven read owner**

In `BackgroundCommerceProvider`:

1. replace the mount-time `void refresh()` with an `ensureSnapshot()` single-flight;
2. preserve automatic guest-cart merge only when local storage contains pending ids;
3. register focus/online recovery only after the current owner has demanded a snapshot, hydrated, or started a commerce mutation; failed demanded hydration re-enters `ensureSnapshot()` while established owners use fresh `refresh()`;
4. make `openCart()` start `ensureSnapshot()` before opening the dialog;
5. on owner change, increment a generation, abort every read/mutation controller, reset reducer state/revision/cart-open state, then adopt the new signed-in state; and
6. keep post-mutation reads fresh and uncached.

The default ordinary shell must remain `status: "idle"` with `snapshot: null`; that is intentional and not an error state.

- [ ] **Step 4: Mark actual consumers explicitly**

- `background-carousel.tsx`: call `ensureSnapshot()` while its commerce-aware carousel is mounted.
- `app/chimer/page.tsx`: ensure ownership when Chimer/Clock needs server-proven background access; do not infer paid access from cached app settings.
- `BackgroundCheckoutReturnStatus.tsx`: ensure immediately only when `backgroundPurchase` is `success` or `cancelled`, then retain the existing bounded polling.
- `BackgroundCommercePanel.tsx`: ensure when opening the account cart, while its server-rendered order history remains separately fresh.
- The globally mounted `BackgroundCommerceCart` and `CommerceCartTrigger` must not themselves force a read. A server cart badge becomes known after a real commerce surface/intent hydrates; no cart data is deleted.

- [ ] **Step 5: Run GREEN and browser commerce regression**

```bash
node --test tests/background-commerce-client.test.mjs tests/background-commerce-surfaces.test.mjs tests/background-checkout-surfaces.test.mjs tests/family-friends-server-workload.test.mjs
npm run typecheck
npx playwright test tests/browser/background-commerce.spec.ts --project=desktop-chromium --workers=1
```

Private database cases remain skipped unless separately authorized. Public/synthetic cases must prove ordinary zero-read, actual-consumer hydration, and return recovery without a provider call.

- [ ] **Step 6: Review gate**

Reviewer must reject a change that hides a server cart permanently, weakens ownership checks, caches a user snapshot, drops return polling, or allows an old owner's mutation/read to update the new owner. Confirm the zero-snapshot claim is scoped to no intent/no pending guest cart.

- [ ] **Step 7: Commit commerce deferral**

```bash
git add components/backgrounds/BackgroundCommerceProvider.tsx components/backgrounds/background-carousel.tsx components/backgrounds/BackgroundCheckoutReturnStatus.tsx app/chimer/page.tsx components/account/BackgroundCommercePanel.tsx components/layout-wrapper.tsx tests/background-commerce-surfaces.test.mjs tests/background-checkout-surfaces.test.mjs tests/family-friends-server-workload.test.mjs tests/browser/background-commerce.spec.ts
git commit -m "perf: defer account commerce snapshots"
```

---

### Task 6: Prove and, only if needed, dedupe the RSC session snapshot

**Files:**
- Create if baseline count is greater than one: `lib/rsc-session.ts`
- Create: `tests/rsc-session.test.mjs`
- Modify if baseline count is greater than one: `components/sidebar/sidebar.tsx`
- Modify if baseline count is greater than one: the Server Component pages listed below
- Modify: `tests/browser/app-shell.spec.ts`
- Modify only for the isolated proof harness: `scripts/build-browser-qa.mjs` and `next.config.mjs`
- Create only for the isolated proof harness: `lib/rsc-session-proof.ts` and `app/dev/rsc-session-proof/page.tsx`

**Interfaces:**
- Evidence gate: the actual Next RSC request counter measures underlying `getCurrentSession()` loader entries, not source occurrences.
- If baseline is already exactly one, do not add `lib/rsc-session.ts`; commit only the counter regression and record that Auth.js/Next already dedupes the request.
- If baseline is greater than one, produce `getCurrentRscSession = cache(getCurrentSession)` in `lib/rsc-session.ts` and use it only from Server Components/root shell code.
- Route handlers, server actions, auth callbacks, and mutation endpoints continue importing `getCurrentSession` directly from `@/auth`.
- No module TTL, global session value, cross-request promise, or user-keyed session map is permitted.

- [ ] **Step 1: Add a numeric real-RSC RED proof**

Use the Browser-QA build's existing module-alias pattern to add a production-disabled proof owner. It must:

1. activate only in the isolated Browser-QA artifact;
2. count entry into the underlying session loader for one random proof header/request;
3. bound and delete the counter entry after the proof response;
4. expose no session, cookie, user id, email, token, or database value; and
5. make the normal Production build's proof route return `404`.

Add an `app-shell.spec.ts` request that sends a random nonsecret proof id, loads the proof Server Component through the real root layout, and asserts the returned count. First record the unmodified baseline count; do not label an anonymous/local proof “signed-in database evidence.”

- [ ] **Step 2: Run the baseline proof before choosing code**

```bash
npm run build:browser-qa
npx playwright test tests/browser/app-shell.spec.ts --project=desktop-chromium --workers=1 --grep "RSC session snapshot count"
```

Decision:

- baseline `1`: preserve `auth.ts` and all page imports; add a regression that remains `1` and proceed to Step 6;
- baseline greater than `1`: keep the failing expectation at `1` and proceed to Step 3;
- no trustworthy numeric result: remove/disable the proposed cache work, mark this task blocked in the evidence report, and do not claim the one-snapshot target from source inspection.

- [ ] **Step 3: Add only a request-scoped React cache wrapper when RED proved duplication**

Create `lib/rsc-session.ts`:

```ts
import { cache } from "react"
import { getCurrentSession } from "@/auth"

export const getCurrentRscSession = cache(getCurrentSession)
```

Change `components/sidebar/sidebar.tsx` and Server Component page imports from `@/auth` to `@/lib/rsc-session`. Do not change route handlers or action files.

The current Server Component page set to inspect and, when it imports `getCurrentSession`, convert is:

```text
app/page.tsx
app/account/page.tsx
app/admin/page.tsx
app/anatomy/corrections/page.tsx
app/calendar/page.tsx
app/calendar/availability/page.tsx
app/calendar/booking/page.tsx
app/calendar/new/page.tsx
app/calendar/new/appointment/page.tsx
app/calendar/new/class/page.tsx
app/calendar/new/personal/page.tsx
app/calendar/new/reminder/page.tsx
app/calendar/requests/page.tsx
app/calendar/services/page.tsx
app/calendar/services/new/page.tsx
app/calendar/services/[serviceId]/page.tsx
app/calendar/sync/page.tsx
app/education/flashcards/page.tsx
app/education/flashcards/decks/page.tsx
app/education/flashcards/decks/[slug]/page.tsx
app/legal/accept/page.tsx
app/notes/page.tsx
app/onboarding/page.tsx
app/pricing/page.tsx
app/support/page.tsx
app/tools/business-planner/income/page.tsx
app/wellness/page.tsx
```

- [ ] **Step 4: Add source boundaries for non-RSC auth authority**

`tests/rsc-session.test.mjs` must enumerate the converted page files, assert the wrapper contains React `cache`, assert it contains no TTL/timer/map/persistent cache, and assert representative route handlers/actions still import `@/auth` directly:

```text
app/api/account/preferences/route.ts
app/api/account/profile/route.ts
app/api/billing/checkout/route.ts
app/api/billing/portal/route.ts
app/api/billing/webhook/route.ts
```

- [ ] **Step 5: Re-run the actual RSC GREEN proof**

```bash
node --test tests/rsc-session.test.mjs tests/auth-session-version.test.mjs tests/auth-session-feature-keys.test.mjs
npm run build:browser-qa
npx playwright test tests/browser/app-shell.spec.ts --project=desktop-chromium --workers=1 --grep "RSC session snapshot count"
```

Expected after an evidence-required wrapper: numeric underlying loader count `1` for the actual RSC request. The deterministic signed-in workload test separately remains one auth user graph read, one temporary-grant read, and one entitlement build.

- [ ] **Step 6: Review and remove proof exposure from ordinary builds**

Reviewer must verify the counter is bounded, content-free, and unreachable in an ordinary Production build; the wrapper is RSC-only; and no cache crosses requests. If the proof harness cannot meet that standard, delete it after collecting local evidence and retain a Node regression plus the exact command/output in the report.

- [ ] **Step 7: Commit the evidence-gated result**

If no wrapper was needed:

```bash
git add tests/rsc-session.test.mjs tests/browser/app-shell.spec.ts scripts/build-browser-qa.mjs next.config.mjs lib/rsc-session-proof.ts app/dev/rsc-session-proof/page.tsx
git commit -m "test: lock one RSC auth snapshot"
```

If the wrapper was required, add the exact converted files and commit:

```bash
git commit -m "perf: dedupe RSC auth snapshots"
```

Before either commit, stage explicit files only and exclude unrelated `app/dev` or `lib` paths.

---

### Task 7: Centralize bounded public pricing reads

**Files:**
- Modify: `lib/membership-pricing.js`
- Modify: `lib/stripe-billing.js`
- Modify: `tests/membership-pricing.test.mjs`
- Modify: `tests/stripe-billing.test.mjs`

**Interfaces:**
- Produces: `createMembershipPricingCatalogLoader({ env, stripeClient, now, successTtlMs, incompleteTtlMs })` for isolated tests.
- Retains: `getMembershipPricingCatalog()` as the default shared in-process caller.
- Constants: success TTL `300_000` ms; incomplete/fallback TTL `15_000` ms; Price timeout `2_500` ms; `maxNetworkRetries: 1`.
- A complete catalog has all six configured Supporter Price ids and all six successful amount/currency/interval projections.
- A missing or failed Price remains the existing safe `Price unavailable` entry and makes the catalog incomplete.
- All concurrent cold callers share one catalog build: six logical `prices.retrieve` invocations total, not six per caller.

- [ ] **Step 1: Write RED concurrency, TTL, and request-option tests**

Extend `tests/membership-pricing.test.mjs` with an isolated loader and fake clock. Required cases:

```js
const calls = []
const loader = createMembershipPricingCatalogLoader({
  env: sixPriceEnvironment,
  now: () => now,
  stripeClient: {
    prices: {
      async retrieve(priceId, params, options) {
        calls.push({ priceId, params, options })
        return prices.get(priceId)
      },
    },
  },
})

const concurrent = await Promise.all(Array.from({ length: 20 }, () => loader.get()))
assert.equal(calls.length, 6)
assert.equal(new Set(concurrent).size, 1)
assert.equal(calls.every(({ params }) => JSON.stringify(params) === "{}"), true)
assert.equal(calls.every(({ options }) => (
  options.timeout === 2_500 && options.maxNetworkRetries === 1
)), true)

await loader.get()
assert.equal(calls.length, 6)
now += 300_000
await loader.get()
assert.equal(calls.length, 12)
```

Add an incomplete-path case: one Price fails, 20 concurrent callers still total six logical calls, a call at 14,999 ms adds zero, and a call at 15,000 ms rebuilds. Add a failed-rebuild recovery case and confirm rejected/internal provider text never enters the public catalog.

- [ ] **Step 2: Run RED**

```bash
node --test tests/membership-pricing.test.mjs tests/stripe-billing.test.mjs
```

Expected: FAIL because pricing has no shared single-flight/dynamic TTL and does not supply explicit Stripe request options.

- [ ] **Step 3: Add the read-only Stripe request-options passthrough**

Change only `retrieveStripePrice` in `lib/stripe-billing.js`:

```js
export async function retrieveStripePrice(
  priceId,
  { apiKey, stripeClient, requestOptions } = {},
) {
  if (!priceId) return null
  const stripe = stripeClient ?? getStripeClient(apiKey)
  return stripe.prices.retrieve(priceId, {}, requestOptions)
}
```

Do not change the shared Stripe client's global retry policy. Do not wrap the SDK call in a second manual retry or `Promise.race`; the supported per-request SDK options own timeout/retry.

- [ ] **Step 4: Build one dynamic-TTL catalog owner**

In `lib/membership-pricing.js`, keep the current catalog shape and `Promise.all` six-read construction. Add an isolated loader whose algorithm is:

```js
export function createMembershipPricingCatalogLoader({
  env = process.env,
  stripeClient,
  now = Date.now,
  successTtlMs = 300_000,
  incompleteTtlMs = 15_000,
} = {}) {
  let cachedValue
  let expiresAt = 0
  let inFlight = null

  return {
    async get() {
      if (cachedValue && now() < expiresAt) return cachedValue
      if (inFlight) return inFlight
      inFlight = buildMembershipPricingCatalog({ env, stripeClient })
        .then((catalog) => {
          cachedValue = catalog
          expiresAt = now() + (isCompleteCatalog(catalog) ? successTtlMs : incompleteTtlMs)
          return catalog
        })
        .finally(() => { inFlight = null })
      return inFlight
    },
    clear() {
      cachedValue = undefined
      expiresAt = 0
      inFlight = null
    },
  }
}
```

Guard stale completions if `clear()` can occur during a build by using the same generation pattern as `createAsyncTtlCache`. The default module singleton backs `getMembershipPricingCatalog()`. Test-only injected loaders do not share state with the default singleton.

Every configured Price read must call:

```js
retrieveStripePrice(option.priceId, {
  apiKey: getStripeSecretKey(env),
  stripeClient,
  requestOptions: { timeout: 2_500, maxNetworkRetries: 1 },
})
```

- [ ] **Step 5: Run GREEN and pricing regressions**

```bash
node --test tests/membership-pricing.test.mjs tests/stripe-billing.test.mjs tests/membership-pricing-cards.test.mjs tests/supporter-membership-final-review.test.mjs
npm run typecheck
```

Expected: concurrent cold `6`, warm `0`, success expiry `+6`, incomplete expiry `+6`; catalog rendering remains unchanged.

- [ ] **Step 6: Review gate**

Reviewer must inspect generation safety, exact TTL boundary behavior, complete/incomplete classification, Stripe SDK argument position, error redaction, and object mutability. Reject any cache of `supporterCheckoutOpen`, session data, membership summaries, entitlements, customer ids, subscription ids, Checkout sessions, Portal sessions, or webhook data.

- [ ] **Step 7: Commit the pricing owner**

```bash
git add lib/membership-pricing.js lib/stripe-billing.js tests/membership-pricing.test.mjs tests/stripe-billing.test.mjs
git commit -m "perf: bound public pricing catalog reads"
```

---

### Task 8: Retire Account's second pricing cache and lock payment authority

**Files:**
- Modify: `lib/account-surface-data.js`
- Modify: `tests/account-surface-data.test.mjs`
- Modify: `tests/family-friends-server-workload.test.mjs`
- Modify: `tests/membership-checkout-route.test.mjs`
- Modify: `tests/billing-portal-route.test.mjs`
- Modify: `tests/membership-webhook-route.test.mjs`

**Interfaces:**
- Account membership continues loading `getUserMembershipSummary(prisma, userId, now)` fresh per request.
- Account and `/pricing` both call the same module-level `getMembershipPricingCatalog()` owner.
- Removes: `ACCOUNT_PRICING_CATALOG_CACHE_TTL_MS` and Account's `createAsyncTtlCache` wrapper.
- Checkout validates the submitted configured Price against current server configuration and never trusts the cached display catalog.
- Portal, webhook convergence, entitlements, customers, and background commerce remain unchanged and uncached.

- [ ] **Step 1: Write RED owner-retirement and authority tests**

Change the injected-loader account test to expect its injected `getPricingCatalog` on each membership load; injection bypasses the real shared owner and proves Account no longer adds a hidden cache. Add source guards asserting:

```text
lib/account-surface-data.js contains no ACCOUNT_PRICING_CATALOG_CACHE_TTL_MS
lib/account-surface-data.js contains no pricingCatalogCache
app/pricing/page.tsx and lib/account-surface-data.js import getMembershipPricingCatalog
Checkout/Portal/webhook handlers do not import membership-pricing
membership and entitlement resolvers do not read the display catalog
```

Add a Checkout regression where a catalog object contains an old Price id but current environment configuration does not; the server rejects it before creating a Checkout session.

- [ ] **Step 2: Run RED**

```bash
node --test tests/account-surface-data.test.mjs tests/membership-checkout-route.test.mjs tests/billing-portal-route.test.mjs tests/membership-webhook-route.test.mjs tests/family-friends-server-workload.test.mjs
```

Expected: FAIL on Account's private pricing cache and the new source guards.

- [ ] **Step 3: Delete the duplicate Account cache**

Remove `createAsyncTtlCache` from the import, delete `ACCOUNT_PRICING_CATALOG_CACHE_TTL_MS`, delete `pricingCatalogCache`, and pass `getPricingCatalog` directly into `loadMembershipSurface`. Do not alter the fresh `getMembershipSummary` call or any other account-surface cache boundary.

- [ ] **Step 4: Run GREEN and billing authority regressions**

```bash
node --test tests/account-surface-data.test.mjs tests/membership-pricing.test.mjs tests/membership-pricing-cards.test.mjs tests/membership-checkout-route.test.mjs tests/billing-portal-route.test.mjs tests/membership-webhook-route.test.mjs tests/family-friends-server-workload.test.mjs
npm run typecheck
npm run lint
```

Expected: all pass; no Checkout, Portal, or webhook provider method is invoked by the catalog tests.

- [ ] **Step 5: Pause-control regression**

Run:

```bash
node --test tests/public-launch-controls.test.mjs tests/membership-pricing-cards.test.mjs tests/membership-checkout-route.test.mjs
```

Confirm a current paused value hides/rejects new Checkout while existing Portal rendering remains available. This value must be read independently of the five-minute catalog.

- [ ] **Step 6: Review gate**

Reviewer compares the Checkout, Portal, membership, entitlement, customer, and webhook files against the parent commit. Any semantic diff beyond tests/source guards is out of scope. Reviewer also confirms stale public display can fail closed at Checkout rather than select a different Price.

- [ ] **Step 7: Commit cache-owner retirement**

```bash
git add lib/account-surface-data.js tests/account-surface-data.test.mjs tests/family-friends-server-workload.test.mjs tests/membership-checkout-route.test.mjs tests/billing-portal-route.test.mjs tests/membership-webhook-route.test.mjs
git commit -m "refactor: share public pricing cache owner"
```

---

### Task 9: Capture exact workload, timing, built, and browser receipts

**Files:**
- Create: `docs/superpowers/reports/2026-08-29-bootstrap-pricing-cost-hardening.md`
- Modify only if the harness contract needs another explicit field: `scripts/family-friends-route-timings.mjs`
- Modify only with the script: `tests/family-friends-route-timings.test.mjs`
- Modify: `tests/family-friends-server-workload.test.mjs`

**Interfaces:**
- Report identifies exact commit SHA, command, exit code, and scope for every receipt.
- Timing output remains route/status/duration only; it contains no cookie, account, provider, response body, URL query, or PHI.
- Workload receipt distinguishes deterministic logical operations from real SQL/provider network work.
- Public catalog receipt distinguishes cold in-process logical SDK calls (`6`) from warm calls (`0`) and possible SDK network retry.

- [ ] **Step 1: Lock the final deterministic workload RED/GREEN receipt**

The final workload test must print and assert, not merely infer, the scoped ordinary-shell counters:

```text
auth snapshots = 1
auth user graph reads = 1
temporary grant reads = 1
entitlement builds = 1
shell preference reads = 1
practice role reads = 1
client bootstrap endpoint requests = 0
commerce snapshot loads = 0
background credit provisioner calls = 0
```

Add separate rows for:

```text
public pricing catalog concurrent cold logical Price reads = 6
public pricing catalog warm logical Price reads = 0
membership return persisted summary reads = 1; Stripe calls = 0
explicit Checkout creates = 1; ordinary render Checkout creates = 0
explicit Portal creates = 1; ordinary render Portal creates = 0
```

Do not combine the public price display reads with Checkout/Portal creation counts.

- [ ] **Step 2: Run the focused exact-head matrix**

```bash
node --test tests/account-shell-bootstrap.test.mjs tests/account-shell-bootstrap-provider.test.mjs tests/therapist-settings-provider.test.mjs tests/sidebar-calendar-context.test.mjs tests/background-commerce-surfaces.test.mjs tests/family-friends-server-workload.test.mjs tests/rsc-session.test.mjs tests/membership-pricing.test.mjs tests/account-surface-data.test.mjs tests/public-launch-controls.test.mjs tests/membership-checkout-route.test.mjs tests/billing-portal-route.test.mjs tests/membership-webhook-route.test.mjs
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
git diff --check
```

Record exact totals and exit codes. Do not replace a failing complete command with a narrower passing claim.

- [ ] **Step 3: Capture a fresh local timing receipt**

From a fresh ordinary Production build and an exact owned loopback port:

```bash
npm run build
npm run readiness:timing-receipt -- --base-url=http://127.0.0.1:3010 --samples=3
```

Record all 21 statuses, first/warm route durations, owned-process teardown result, and SHA. Compare against the earlier local receipt only as local context. State explicitly that it is anonymous, local, first-after-readiness evidence and does not prove signed-in database time, Vercel cold start, Neon transfer, or Production latency.

- [ ] **Step 4: Capture built Browser-QA network evidence**

```bash
npm run build:browser-qa
npx playwright test tests/browser/app-shell.spec.ts tests/browser/background-commerce.spec.ts tests/browser/public-routes.spec.ts --project=desktop-chromium --workers=1 --retries=0
```

Required synthetic/inert evidence:

- successful server bootstrap yields zero session/preferences/profile/calendar endpoint GETs for the scoped non-practice shell;
- server preference failure yields one shared preferences GET;
- Music never requests `/api/auth/session`;
- zero-practice suppresses calendar GET; practice member retains it;
- no commerce intent yields zero snapshot GET; actual background/return intent loads it;
- old-owner responses never commit after an owner switch; and
- the RSC numeric proof is one if Task 6 installed or retained that gate.

Do not run fingerprint-bound private cases without separate authorization. Do not send a real provider request from mocked public browser rows.

- [ ] **Step 5: Run the repository release regressions**

```bash
npm run test
npm run build
git diff --check
```

If Windows fixture line-ending failures recur, record exact totals and compare exact committed fixture hashes; do not call the suite green. Hosted Linux remains a separate gate and requires push/CI authorization.

- [ ] **Step 6: Write the evidence report without overclaiming**

The report must have four columns: `Claim`, `Evidence`, `Exact SHA`, `Limits`. It must explicitly include:

```text
Live Stripe calls: NOT RUN
Production provider readback: NOT RUN
Private database browser rows: NOT RUN unless separately authorized
Hosted Linux: NOT RUN unless separately authorized
Vercel/Neon platform cold start: NOT MEASURED
SQL query count and transfer bytes: NOT MEASURED
```

Also record the process-local nature of pricing TTLs and the maximum one SDK retry per logical Price read.

- [ ] **Step 7: Review and commit the evidence**

Reviewer checks every numeric claim against fresh output and rejects “cold,” “provider-free,” “site-wide,” “Production,” or “signed-in browser” language not directly proven.

```bash
git add docs/superpowers/reports/2026-08-29-bootstrap-pricing-cost-hardening.md tests/family-friends-server-workload.test.mjs scripts/family-friends-route-timings.mjs tests/family-friends-route-timings.test.mjs
git commit -m "test: record bootstrap and pricing workload"
```

Stage the timing script/tests only if they actually changed.

---

### Task 10: Reconcile canonical operations documentation

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`
- Modify: `docs/wiki/deployment.md`
- Modify: `docs/wiki/release-checklist.md`

**Interfaces:**
- Project state reports only exact-head completed behavior and fresh receipts.
- Project log records task commits and the owner/authority decision.
- Deployment documents process-local price-cache semantics and operating limits.
- Release checklist preserves every live/payment/provider/database authorization gate and both pause controls.

- [ ] **Step 1: Write documentation assertions before editing prose**

Extend the applicable documentation/source test, or add a narrow test in `tests/family-friends-server-workload.test.mjs`, to require these phrases/contracts:

```text
ordinary non-practice shell
four logical ORM operations
zero client bootstrap endpoints
zero ordinary commerce snapshots
public display catalog only
five-minute complete / fifteen-second incomplete process-local cache
2.5-second timeout / one SDK network retry
Checkout, Portal, entitlements, customers, and webhooks uncached
local timing first is not platform cold
live Stripe NOT RUN
```

The test must also require `MASSAGELAB_PUBLIC_REGISTRATION_PAUSED` and `MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED` to remain documented independently.

- [ ] **Step 2: Run the documentation RED**

```bash
node --test tests/family-friends-server-workload.test.mjs tests/public-launch-controls.test.mjs
```

Expected: FAIL until canonical docs reflect the new exact-head evidence.

- [ ] **Step 3: Update canonical current state and chronology**

In `docs/project-state.md`, update the current family/friends cost paragraph with exact commit hashes and only the fresh verified counts. Preserve unresolved Browser-QA, hosted Linux, database, provider, deployment, push, and merge gates.

In `docs/project-log.md`, add one dated entry describing:

- root bootstrap owner and retired client discovery;
- lazy therapist/calendar/commerce boundaries;
- evidence-gated RSC request cache decision;
- one public display pricing owner and its TTL/request bounds; and
- unchanged payment/auth/PHI authority.

- [ ] **Step 4: Update deployment and release operations**

Document in `docs/wiki/deployment.md`:

- the process-local, per-instance nature of the price cache;
- six logical read invocations on an empty complete catalog build, with up to one SDK retry each;
- five-minute complete and fifteen-second incomplete/fallback TTLs;
- failure behavior (`Price unavailable`, Checkout still server-validates); and
- no manual cache flush requirement for access/payment correctness.

Update `docs/wiki/release-checklist.md` to require the exact workload, built network proof, timing label, and pause controls. Do not convert read-only Production checks or live payment verification into completed items.

- [ ] **Step 5: Run GREEN and final documentation checks**

```bash
node --test tests/family-friends-server-workload.test.mjs tests/public-launch-controls.test.mjs
npm run typecheck
npm run lint
git diff --check
```

- [ ] **Step 6: Final review gate**

One fresh reviewer compares the implementation range against this plan and the family/friends design. A second reviewer checks code quality and evidence language. Both must explicitly confirm:

- one bootstrap owner and no duplicate GET fallback;
- owner-change cancellation and failure behavior;
- no cached user/payment authority;
- no live-provider or database action;
- pause controls preserved; and
- PHI/local-first boundaries unchanged.

- [ ] **Step 7: Commit canonical documentation**

```bash
git add docs/project-state.md docs/project-log.md docs/wiki/deployment.md docs/wiki/release-checklist.md
git commit -m "docs: record bootstrap and pricing cost bounds"
```

---

## Final Completion Gate

The implementation is complete only when all applicable task commits have independent specification and quality approval, the exact candidate SHA has fresh focused tests/typecheck/lint/build/diff evidence, and the report states every unrun external gate plainly. Completion does not authorize push, CI, merge, deployment, database access, provider settings, or a live payment.

Expected final local behavior:

```text
ordinary signed-in non-practice shell:
  auth snapshots: 1
  entitlement builds: 1
  logical ORM operations: 4
  client bootstrap endpoint GETs: 0
  commerce snapshot GETs: 0

public pricing display:
  concurrent empty in-process catalog: 6 logical Price reads total
  complete warm catalog (<5m): 0 additional reads
  incomplete warm catalog (<15s): 0 additional reads
  each logical read: 2.5s SDK timeout, maxNetworkRetries=1

authority unchanged:
  account preference/profile PUT: authenticated server route
  membership/entitlement/customer state: fresh server authority
  Checkout/Portal/webhooks: uncached explicit server paths
  registration/Checkout pauses: independent current request values
  clinical/PHI workflows: local-first
```
