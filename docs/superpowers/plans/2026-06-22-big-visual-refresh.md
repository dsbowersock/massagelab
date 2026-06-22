# Big Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement MassageLab's approved Big Visual Refresh across the responsive shell, quick-create menu, homepage discovery, account settings, and shared page coherence.

**Architecture:** Start with pure models for shell ordering and quick actions, then wire those models into reusable shell components. The homepage and account settings consume shared metadata and visual primitives so mobile, tablet, and desktop stay consistent without changing local-first PHI boundaries or feature-key entitlement behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript components, JavaScript helper modules with Node tests, Tailwind CSS, shadcn/Radix primitives, Lucide icons, Playwright browser tests.

---

## Scope Check

This spec spans several visual subsystems, but the user explicitly approved a single Big Visual Refresh. Keep the branch manageable by implementing it as the task sequence below, with each task producing testable software and a focused commit.

## File Structure

- Create `lib/app-shell.js`: pure responsive shell order and placement helpers.
- Modify `lib/app-settings.js`: default app bar placement and audio placement rules.
- Create `lib/quick-actions.js`: quick-action catalog, grouping, role defaults, and explicit preference helpers.
- Modify `lib/onboarding-preferences.js`: include role-aware quick-action defaults in onboarding payloads.
- Modify `lib/account-preferences.js`: keep quick-action preference sync non-PHI.
- Create `components/shell/mobile-main-bar.tsx`: responsive main bar and button ordering.
- Create `components/shell/quick-action-speed-dial.tsx`: Radarr-style quick-create launcher.
- Modify `components/layout-wrapper.tsx`: render the new shell controls and keep route exceptions.
- Modify `components/calendar/calendar-operator-top-bar.tsx`: adapt desktop/tablet controls to the same action model.
- Modify `components/providers/music-mini-player.tsx`: keep music bottom-based and expose stack state.
- Modify `app/globals.css`: safe-area, bottom stack, speed-dial, and rail/card shared styles.
- Modify `app/page.tsx`: convert homepage/tool discovery into rail-based hub.
- Create `components/home/home-tool-rails.tsx`: reusable homepage rails and tool tiles.
- Modify `app/account/account-settings-shell.tsx`: compact grouped mobile settings index and matching desktop rail.
- Modify `app/account/app-settings-panel.tsx`: expose layout, drawer side, theme, and quick-action customization entry points.
- Modify `lib/account-page.js`: account settings grouping labels and search metadata.
- Modify `components/account/settings-surfaces.tsx`: shared compact settings row helpers.
- Modify `tests/app-settings.test.mjs`: shell order, bottom defaults, and audio placement tests.
- Create `tests/quick-actions.test.mjs`: quick-action grouping and role defaults.
- Modify `tests/onboarding-preferences.test.mjs`: onboarding quick-action defaults and explicit choices.
- Modify `tests/account-preferences.test.mjs`: quick-action preference sync safety.
- Modify `tests/account-page-tabs.test.mjs`: account grouping/search updates.
- Modify `tests/browser/public-routes.spec.ts`: shell, speed dial, homepage rails, account settings, and music stacking browser coverage.
- Update `docs/project-state.md` and `docs/project-log.md` after implementation validation.

## Task 1: Shell Model And Defaults

**Files:**
- Create: `lib/app-shell.js`
- Modify: `lib/app-settings.js`
- Modify: `tests/app-settings.test.mjs`

- [ ] **Step 1: Write failing shell model tests**

Add these imports to `tests/app-settings.test.mjs`:

```js
import {
  mainBarItemIds,
  resolveMainBarItemOrder,
  getMusicPlayerPlacement,
} from "../lib/app-shell.js"
```

Replace the existing "places the audio player toolbar opposite the app bar" test with:

```js
  it("defaults to a bottom app bar and keeps the music player on the bottom", () => {
    assert.equal(defaultAppSettings.appBarPosition, "bottom")
    assert.equal(defaultAppSettings.sidebarPosition, "left")
    assert.equal(defaultAppSettings.sidebarTriggerPosition, "bottom")
    assert.equal(getAudioPlayerToolbarPlacement(defaultAppSettings), "bottom")
    assert.equal(getMusicPlayerPlacement(defaultAppSettings), "bottom")
    assert.equal(getMusicPlayerPlacement({ appBarPosition: "top" }), "bottom")
  })
```

Add this test after the sidebar button position tests:

```js
  it("orders the main bar so More follows the selected drawer side", () => {
    assert.deepEqual(mainBarItemIds, ["home", "music", "clock", "quick-create", "theme", "calendar", "more"])
    assert.deepEqual(resolveMainBarItemOrder({ sidebarPosition: "left" }), [
      "home",
      "music",
      "clock",
      "quick-create",
      "theme",
      "calendar",
      "more",
    ])
    assert.deepEqual(resolveMainBarItemOrder({ sidebarPosition: "right" }), [
      "more",
      "music",
      "clock",
      "quick-create",
      "theme",
      "calendar",
      "home",
    ])
  })
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/app-settings.test.mjs`

Expected: FAIL because `../lib/app-shell.js` does not exist and `defaultAppSettings.appBarPosition` is still `top`.

- [ ] **Step 3: Add the pure shell helper**

Create `lib/app-shell.js`:

```js
// @ts-check

import { normalizeAppSettings } from "./app-settings.js"

export const mainBarItemIds = Object.freeze([
  "home",
  "music",
  "clock",
  "quick-create",
  "theme",
  "calendar",
  "more",
])

const leftDrawerMainBarItemIds = mainBarItemIds
const rightDrawerMainBarItemIds = Object.freeze([
  "more",
  "music",
  "clock",
  "quick-create",
  "theme",
  "calendar",
  "home",
])

/**
 * Orders persistent shell controls so the More drawer trigger sits closest to
 * the configured drawer side while Home remains available at the opposite edge.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function resolveMainBarItemOrder(value) {
  const settings = normalizeAppSettings(value)
  return [...(settings.sidebarPosition === "right" ? rightDrawerMainBarItemIds : leftDrawerMainBarItemIds)]
}

/**
 * Music controls stay bottom-based so active playback stacks with the mobile
 * main bar instead of jumping to the opposite edge.
 *
 * @param {unknown} _value
 * @returns {"bottom"}
 */
export function getMusicPlayerPlacement(_value) {
  return "bottom"
}
```

- [ ] **Step 4: Update app settings defaults and audio placement**

In `lib/app-settings.js`, set the default app bar to bottom:

```js
export const defaultAppSettings = Object.freeze({
  appBarPosition: "bottom",
  sidebarPosition: "left",
  sidebarTriggerPosition: "bottom",
  themeMode: "dark",
})
```

Replace `getAudioPlayerToolbarPlacement` with:

```js
/**
 * The music player stays on the bottom edge. When the main app bar is also at
 * the bottom, CSS stacks the player above the bar for a YouTube Music-style
 * playback layout.
 *
 * @param {unknown} _value
 * @returns {AudioPlayerToolbarPlacement}
 */
export function getAudioPlayerToolbarPlacement(_value) {
  return "bottom"
}
```

- [ ] **Step 5: Run the focused test and verify pass**

Run: `node --test tests/app-settings.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit shell model defaults**

Run:

```bash
git add lib/app-shell.js lib/app-settings.js tests/app-settings.test.mjs
git commit -m "Add responsive shell ordering model"
```

## Task 2: Quick-Action Model And Onboarding Defaults

**Files:**
- Create: `lib/quick-actions.js`
- Create: `tests/quick-actions.test.mjs`
- Modify: `lib/onboarding-preferences.js`
- Modify: `tests/onboarding-preferences.test.mjs`
- Modify: `tests/account-preferences.test.mjs`

- [ ] **Step 1: Write failing quick-action tests**

Create `tests/quick-actions.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  QUICK_ACTION_MAX_VISIBLE,
  quickActionCatalog,
  resolveAnonymousQuickActionGroups,
  resolveExplicitQuickActionKeys,
  resolveQuickActionKeys,
} from "../lib/quick-actions.js"

describe("Quick action model", () => {
  it("exposes the approved anonymous quick-action groups without membership clutter", () => {
    const groups = resolveAnonymousQuickActionGroups()

    assert.deepEqual(groups.map((group) => group.id), ["available_now", "sign_in_to_save"])
    assert.deepEqual(groups[0].actions.map((action) => action.id), [
      "start_chimer",
      "start_flashcards",
      "play_anatomime",
      "wellness_quick_log",
      "body_sensation_check_in",
      "start_breathing",
      "start_public_music",
    ])
    assert.deepEqual(groups[1].actions.map((action) => action.id), [
      "create_calendar_item",
      "save_wellness_history",
      "customize_home_shortcuts",
      "customize_quick_actions",
    ])
    assert.equal(groups.some((group) => /membership/i.test(group.label)), false)
  })

  it("keeps every quick action route-backed and icon-backed", () => {
    assert.equal(quickActionCatalog.every((action) => action.id && action.label && action.href && action.icon), true)
  })

  it("resolves role-aware signed-in defaults from onboarding values", () => {
    assert.deepEqual(resolveQuickActionKeys({
      signedIn: true,
      onboarding: { primaryRole: "student", useCases: ["learn_anatomy", "track_progress"] },
    }).slice(0, 5), [
      "start_flashcards",
      "play_anatomime",
      "start_chimer",
      "start_public_music",
      "customize_quick_actions",
    ])

    assert.deepEqual(resolveQuickActionKeys({
      signedIn: true,
      onboarding: { primaryRole: "client", useCases: ["book_care"] },
    }).slice(0, 5), [
      "wellness_quick_log",
      "body_sensation_check_in",
      "start_public_music",
      "create_calendar_item",
      "customize_quick_actions",
    ])
  })

  it("preserves explicit quick-action picks separately from computed defaults", () => {
    const onboarding = {
      primaryRole: "therapist",
      quickActions: ["start_public_music", "start_chimer", "unknown", "start_public_music"],
    }

    assert.deepEqual(resolveExplicitQuickActionKeys(onboarding), ["start_public_music", "start_chimer"])
    assert.deepEqual(resolveQuickActionKeys({ signedIn: true, onboarding }), ["start_public_music", "start_chimer"])
  })

  it("caps the visible quick-action defaults", () => {
    assert.equal(resolveQuickActionKeys({
      signedIn: true,
      onboarding: { primaryRole: "therapist", useCases: ["manage_practice", "run_sessions"] },
    }).length <= QUICK_ACTION_MAX_VISIBLE, true)
  })
})
```

- [ ] **Step 2: Extend onboarding tests for quick actions**

In `tests/onboarding-preferences.test.mjs`, add `resolveExplicitOnboardingQuickActionKeys` and `resolveOnboardingQuickActionKeys` to the import from `../lib/onboarding-preferences.js`.

Add this test near the home shortcut tests:

```js
  it("prepopulates role-aware quick actions without treating computed defaults as explicit picks", () => {
    const therapistPayload = buildOnboardingPreference({
      primaryRole: "therapist",
      useCases: ["manage_practice", "run_sessions"],
      jurisdiction: "OH",
    })

    assert.deepEqual(therapistPayload.quickActions.slice(0, 4), [
      "create_calendar_item",
      "start_chimer",
      "start_public_music",
      "customize_quick_actions",
    ])
    assert.deepEqual(resolveExplicitOnboardingQuickActionKeys(therapistPayload), therapistPayload.quickActions)
    assert.deepEqual(resolveExplicitOnboardingQuickActionKeys({ primaryRole: "therapist" }), [])
    assert.deepEqual(resolveOnboardingQuickActionKeys({
      primaryRole: "student",
      useCases: ["learn_anatomy"],
      quickActions: [],
    }).slice(0, 3), ["start_flashcards", "play_anatomime", "start_chimer"])
  })
```

- [ ] **Step 3: Run tests and verify failure**

Run: `node --test tests/quick-actions.test.mjs tests/onboarding-preferences.test.mjs tests/account-preferences.test.mjs`

Expected: FAIL because quick-action helpers are missing.

- [ ] **Step 4: Add quick-action helper module**

Create `lib/quick-actions.js`:

```js
// @ts-check

export const QUICK_ACTION_MAX_VISIBLE = 7

export const quickActionCatalog = Object.freeze([
  {
    id: "start_chimer",
    label: "Start Chimer",
    description: "Open the massage session timer.",
    href: "/chimer",
    icon: "Timer",
    group: "available_now",
    roleSignals: ["therapist", "student", "client", "educator", "public_wellness"],
    useCaseSignals: ["run_sessions"],
  },
  {
    id: "start_flashcards",
    label: "Start flashcards",
    description: "Build or start a public anatomy deck.",
    href: "/education/flashcards",
    icon: "BookOpen",
    group: "available_now",
    roleSignals: ["student", "educator", "therapist", "client", "public_wellness"],
    useCaseSignals: ["learn_anatomy", "track_progress"],
  },
  {
    id: "play_anatomime",
    label: "Play Anatomime",
    description: "Open solo or shared anatomy play.",
    href: "/anatomime",
    icon: "Brain",
    group: "available_now",
    roleSignals: ["student", "educator", "therapist", "client", "public_wellness"],
    useCaseSignals: ["learn_anatomy", "teach_anatomy"],
  },
  {
    id: "wellness_quick_log",
    label: "Add wellness quick log",
    description: "Open wellness self-tracking.",
    href: "/wellness",
    icon: "HeartPulse",
    group: "available_now",
    roleSignals: ["client", "therapist", "student", "public_wellness"],
    useCaseSignals: ["book_care", "track_progress"],
  },
  {
    id: "body_sensation_check_in",
    label: "Add body-sensation check-in",
    description: "Open body-sensation tracking.",
    href: "/wellness",
    icon: "Map",
    group: "available_now",
    roleSignals: ["client", "therapist", "public_wellness"],
    useCaseSignals: ["book_care", "track_progress"],
  },
  {
    id: "start_breathing",
    label: "Start breathing guide",
    description: "Open the public breathing pacer.",
    href: "/wellness/breathing",
    icon: "Wind",
    group: "available_now",
    roleSignals: ["client", "therapist", "student", "educator", "public_wellness"],
    useCaseSignals: ["run_sessions", "book_care"],
  },
  {
    id: "start_public_music",
    label: "Start public music",
    description: "Open public music stations.",
    href: "/music",
    icon: "Radio",
    group: "available_now",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["run_sessions", "track_progress", "book_care"],
  },
  {
    id: "create_calendar_item",
    label: "Create calendar item",
    description: "Sign in to create calendar items.",
    href: "/register?callbackUrl=%2Fcalendar%2Fnew",
    signedInHref: "/calendar/new",
    icon: "CalendarDays",
    group: "sign_in_to_save",
    roleSignals: ["therapist", "client", "public_wellness"],
    useCaseSignals: ["manage_practice", "book_care"],
  },
  {
    id: "save_wellness_history",
    label: "Save wellness history",
    description: "Sign in to save wellness entries.",
    href: "/register?callbackUrl=%2Fwellness",
    signedInHref: "/wellness",
    icon: "HeartHandshake",
    group: "sign_in_to_save",
    roleSignals: ["client", "public_wellness", "therapist"],
    useCaseSignals: ["book_care", "track_progress"],
  },
  {
    id: "customize_home_shortcuts",
    label: "Customize home shortcuts",
    description: "Sign in to personalize the homepage.",
    href: "/register?callbackUrl=%2Fonboarding",
    signedInHref: "/onboarding",
    icon: "LayoutDashboard",
    group: "sign_in_to_save",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["manage_practice", "learn_anatomy", "track_progress"],
  },
  {
    id: "customize_quick_actions",
    label: "Customize quick actions",
    description: "Sign in to choose quick actions.",
    href: "/register?callbackUrl=%2Faccount%3Ftab%3Dapp-settings",
    signedInHref: "/account?tab=app-settings",
    icon: "Settings2",
    group: "sign_in_to_save",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["manage_practice", "learn_anatomy", "track_progress", "book_care"],
  },
])

const quickActionById = new Map(quickActionCatalog.map((action) => [action.id, action]))
const quickActionIds = new Set(quickActionCatalog.map((action) => action.id))
const anonymousGroupDefinitions = Object.freeze([
  { id: "available_now", label: "Available now" },
  { id: "sign_in_to_save", label: "Sign in to save" },
])

const defaultsByRole = {
  therapist: ["create_calendar_item", "start_chimer", "start_public_music", "wellness_quick_log", "start_flashcards", "play_anatomime", "customize_quick_actions"],
  student: ["start_flashcards", "play_anatomime", "start_chimer", "start_public_music", "customize_quick_actions", "customize_home_shortcuts"],
  educator: ["play_anatomime", "start_flashcards", "start_public_music", "start_chimer", "customize_quick_actions", "customize_home_shortcuts"],
  client: ["wellness_quick_log", "body_sensation_check_in", "start_public_music", "create_calendar_item", "customize_quick_actions", "start_breathing"],
  public_wellness: ["start_public_music", "wellness_quick_log", "body_sensation_check_in", "start_breathing", "start_chimer", "start_flashcards", "play_anatomime"],
}

const defaultsByUseCase = {
  learn_anatomy: ["start_flashcards", "play_anatomime"],
  teach_anatomy: ["play_anatomime", "start_flashcards"],
  run_sessions: ["start_chimer", "start_public_music", "create_calendar_item"],
  manage_practice: ["create_calendar_item", "customize_quick_actions", "customize_home_shortcuts"],
  book_care: ["wellness_quick_log", "body_sensation_check_in", "create_calendar_item"],
  track_progress: ["start_flashcards", "wellness_quick_log", "start_public_music"],
}

export function resolveAnonymousQuickActionGroups() {
  return anonymousGroupDefinitions
    .map((group) => ({
      ...group,
      actions: quickActionCatalog.filter((action) => action.group === group.id),
    }))
    .filter((group) => group.actions.length > 0)
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function sanitizeQuickActionKeys(value) {
  const source = Array.isArray(value) ? value : []
  const seen = new Set()
  const selected = []

  for (const item of source) {
    if (typeof item === "string" && quickActionIds.has(item) && !seen.has(item)) {
      seen.add(item)
      selected.push(item)
    }
  }

  return selected.slice(0, QUICK_ACTION_MAX_VISIBLE)
}

/**
 * @param {{ quickActions?: unknown }} onboarding
 * @returns {string[]}
 */
export function resolveExplicitQuickActionKeys(onboarding) {
  return sanitizeQuickActionKeys(onboarding?.quickActions)
}

/**
 * @param {{ signedIn?: boolean; onboarding?: { primaryRole?: unknown; useCases?: unknown; quickActions?: unknown } }} options
 * @returns {string[]}
 */
export function resolveQuickActionKeys(options = {}) {
  const explicit = resolveExplicitQuickActionKeys(options.onboarding)
  if (explicit.length > 0) return explicit

  const role = typeof options.onboarding?.primaryRole === "string" && defaultsByRole[options.onboarding.primaryRole]
    ? options.onboarding.primaryRole
    : "public_wellness"
  const useCases = Array.isArray(options.onboarding?.useCases)
    ? options.onboarding.useCases.filter((item) => typeof item === "string")
    : []
  const useCaseDefaults = useCases.flatMap((useCase) => defaultsByUseCase[useCase] ?? [])
  const roleDefaults = defaultsByRole[role]
  const fallbackDefaults = quickActionCatalog.map((action) => action.id)

  return sanitizeQuickActionKeys([...useCaseDefaults, ...roleDefaults, ...fallbackDefaults])
}

/**
 * @param {string} id
 */
export function getQuickAction(id) {
  return quickActionById.get(id) ?? null
}
```

- [ ] **Step 5: Wire onboarding quick-action defaults**

In `lib/onboarding-preferences.js`, import quick-action helpers:

```js
import {
  resolveExplicitQuickActionKeys,
  resolveQuickActionKeys,
  sanitizeQuickActionKeys,
} from "./quick-actions.js"
```

Add these exports near the homepage shortcut helpers:

```js
/**
 * Returns explicitly saved quick-action keys only.
 *
 * @param {{ quickActions?: unknown }} onboarding
 * @returns {string[]}
 */
export function resolveExplicitOnboardingQuickActionKeys(onboarding) {
  return resolveExplicitQuickActionKeys(onboarding)
}

/**
 * Resolves visible quick-action keys from explicit selections or onboarding
 * role/use-case defaults.
 *
 * @param {{ primaryRole?: unknown; useCases?: unknown; quickActions?: unknown }} onboarding
 * @returns {string[]}
 */
export function resolveOnboardingQuickActionKeys(onboarding) {
  return resolveQuickActionKeys({ signedIn: true, onboarding })
}
```

In `buildOnboardingPreference`, add quick actions after `homeShortcuts`:

```js
  const quickActions = resolveQuickActionKeys({
    signedIn: true,
    onboarding: {
      primaryRole: selectedRole,
      useCases,
      quickActions: sanitizeQuickActionKeys(readArrayValue(input, "quickActions")),
    },
  })
```

Return `quickActions` in the payload:

```js
    quickActions,
```

- [ ] **Step 6: Add preference sync safety coverage**

In `tests/account-preferences.test.mjs`, add:

```js
  it("keeps quick-action preferences while stripping PHI-shaped app settings", () => {
    const payload = buildUserPreferencePayload({
      appSettings: {
        onboarding: {
          primaryRole: "client",
          quickActions: ["wellness_quick_log", "start_public_music"],
          clientName: "Jane Example",
        },
      },
    })

    assert.deepEqual(payload.app_settings, {
      onboarding: {
        primaryRole: "client",
        quickActions: ["wellness_quick_log", "start_public_music"],
      },
    })
  })
```

- [ ] **Step 7: Run focused tests and verify pass**

Run: `node --test tests/quick-actions.test.mjs tests/onboarding-preferences.test.mjs tests/account-preferences.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit quick-action model**

Run:

```bash
git add lib/quick-actions.js lib/onboarding-preferences.js tests/quick-actions.test.mjs tests/onboarding-preferences.test.mjs tests/account-preferences.test.mjs
git commit -m "Add role-aware quick action model"
```

## Task 3: Responsive Main Bar And Speed Dial

**Files:**
- Create: `components/shell/mobile-main-bar.tsx`
- Create: `components/shell/quick-action-speed-dial.tsx`
- Modify: `components/layout-wrapper.tsx`
- Modify: `components/calendar/calendar-operator-top-bar.tsx`
- Modify: `app/globals.css`
- Modify: `tests/app-settings.test.mjs`
- Modify: `tests/browser/public-routes.spec.ts`

- [ ] **Step 1: Add source-level shell rendering tests**

In `tests/app-settings.test.mjs`, add:

```js
  it("renders the mobile main bar and quick-action speed dial from the layout shell", () => {
    const layoutSource = readFileSync(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8")
    const mainBarSource = readFileSync(new URL("../components/shell/mobile-main-bar.tsx", import.meta.url), "utf8")
    const speedDialSource = readFileSync(new URL("../components/shell/quick-action-speed-dial.tsx", import.meta.url), "utf8")
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(layoutSource, /<MobileMainBar\b/)
    assert.match(mainBarSource, /resolveMainBarItemOrder/)
    assert.match(mainBarSource, /aria-label="MassageLab main navigation"/)
    assert.match(mainBarSource, /QuickActionSpeedDial/)
    assert.match(speedDialSource, /aria-label="Quick create actions"/)
    assert.match(speedDialSource, /Escape/)
    assert.match(topBarSource, /QuickActionSpeedDial/)
    assert.match(topBarSource, /aria-label="Open quick actions"/)
  })
```

- [ ] **Step 2: Add browser coverage for bottom bar basics**

In `tests/browser/public-routes.spec.ts`, update the "primary bar exposes music and clock shortcuts beside calendar controls" test name to "main bar exposes home music clock quick create theme calendar and more controls".

Inside that test, assert these controls:

```ts
  await expect(page.getByRole("navigation", { name: /^MassageLab main navigation$/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /^Home$/i })).toHaveAttribute("href", "/")
  await expect(page.getByRole("link", { name: /^Open music$/i })).toHaveAttribute("href", "/music")
  await expect(page.getByRole("link", { name: /^Open clock$/i })).toHaveAttribute("href", "/clock")
  await expect(page.getByRole("button", { name: /^Open quick actions$/i })).toBeVisible()
  await expect(page.getByRole("group", { name: /^Theme$/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /^Open calendar$/i })).toHaveAttribute("href", "/calendar")
  await expect(page.getByRole("button", { name: /^Open navigation$/i })).toBeVisible()
```

Add a new speed-dial test after it:

```ts
test("mobile quick-create button opens a vertical speed dial", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /^Open quick actions$/i }).click()

  const quickActions = page.getByRole("menu", { name: /^Quick create actions$/i })
  await expect(quickActions).toBeVisible()
  await expect(quickActions.getByRole("link", { name: /^Start Chimer$/i })).toHaveAttribute("href", "/chimer")
  await expect(quickActions.getByRole("link", { name: /^Start flashcards$/i })).toHaveAttribute("href", "/education/flashcards")
  await expect(quickActions.getByRole("link", { name: /^Play Anatomime$/i })).toHaveAttribute("href", "/anatomime")
  await expect(quickActions.getByRole("link", { name: /^Customize quick actions$/i })).toHaveAttribute("href", "/register?callbackUrl=%2Faccount%3Ftab%3Dapp-settings")

  await page.keyboard.press("Escape")
  await expect(quickActions).toHaveCount(0)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})
```

- [ ] **Step 3: Run tests and verify failure**

Run: `node --test tests/app-settings.test.mjs`

Expected: FAIL because the shell components do not exist.

- [ ] **Step 4: Create quick-action speed dial component**

Create `components/shell/quick-action-speed-dial.tsx`:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import {
  BookOpen,
  Brain,
  CalendarDays,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  LucideIcon,
  Map,
  Radio,
  Settings2,
  Timer,
  Wind,
  X,
} from "lucide-react"
import { resolveAnonymousQuickActionGroups } from "@/lib/quick-actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const quickActionIcons = {
  BookOpen,
  Brain,
  CalendarDays,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  Map,
  Radio,
  Settings2,
  Timer,
  Wind,
} satisfies Record<string, LucideIcon>

export function QuickActionSpeedDial({
  open,
  onOpenChange,
  returnFocusRef,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef: React.RefObject<HTMLButtonElement>
}) {
  const groups = resolveAnonymousQuickActionGroups()

  React.useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onOpenChange(false)
        returnFocusRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange, open, returnFocusRef])

  if (!open) return null

  return (
    <div className="ml-quick-action-layer fixed inset-0 z-[10030]" onClick={() => onOpenChange(false)}>
      <div
        role="menu"
        aria-label="Quick create actions"
        className={cn(
          "absolute bottom-[calc(var(--ml-bottom-stack-height)+4.75rem)] left-1/2 flex w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col items-end gap-3",
          "sm:left-auto sm:right-[calc(var(--ml-page-edge-gap)+1rem)] sm:translate-x-0",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {groups.map((group) => (
          <section key={group.id} className="flex w-full flex-col items-end gap-2">
            <p className="mr-16 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur">
              {group.label}
            </p>
            {group.actions.map((action) => {
              const Icon = quickActionIcons[action.icon as keyof typeof quickActionIcons] ?? Settings2

              return (
                <Link
                  key={action.id}
                  role="menuitem"
                  href={action.href}
                  className="group flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => onOpenChange(false)}
                >
                  <span className="max-w-[14rem] rounded-full border border-border/80 bg-background/95 px-3 py-2 text-right text-sm font-medium shadow-xl backdrop-blur transition group-hover:border-primary/60 group-hover:bg-accent">
                    {action.label}
                  </span>
                  <span className="flex size-12 items-center justify-center rounded-full border border-border/80 bg-card text-primary shadow-xl shadow-black/30 transition group-hover:border-primary/70 group-hover:bg-primary/15">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                </Link>
              )
            })}
          </section>
        ))}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-12 rounded-full shadow-xl"
          aria-label="Close quick actions"
          onClick={() => {
            onOpenChange(false)
            returnFocusRef.current?.focus()
          }}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create mobile main bar component**

Create `components/shell/mobile-main-bar.tsx`:

```tsx
"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, Clock, Home, Menu, Music2, Plus } from "lucide-react"
import { ThemeSwitcherMultiButton } from "@/components/theme-switcher-multi-button"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSidebar } from "@/components/ui/sidebar"
import { useSettings } from "@/components/providers/settings-provider"
import { resolveMainBarItemOrder } from "@/lib/app-shell"
import { cn } from "@/lib/utils"
import { QuickActionSpeedDial } from "./quick-action-speed-dial"

type MainBarRenderItem = {
  id: string
  node: React.ReactNode
}

export function MobileMainBar() {
  const { settings } = useSettings()
  const { toggleSidebar } = useSidebar()
  const [quickActionsOpen, setQuickActionsOpen] = React.useState(false)
  const quickCreateButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const order = resolveMainBarItemOrder(settings)
  const itemById = new Map<string, MainBarRenderItem>([
    ["home", {
      id: "home",
      node: (
        <Button asChild variant="ghost" className="ml-main-bar-button" aria-label="Home">
          <Link href="/">
            <Home aria-hidden="true" />
            <span>Home</span>
          </Link>
        </Button>
      ),
    }],
    ["music", {
      id: "music",
      node: (
        <Button asChild variant="ghost" className="ml-main-bar-button">
          <Link href="/music" aria-label="Open music">
            <Music2 aria-hidden="true" />
            <span>Music</span>
          </Link>
        </Button>
      ),
    }],
    ["clock", {
      id: "clock",
      node: (
        <Button asChild variant="ghost" className="ml-main-bar-button">
          <Link href="/clock" aria-label="Open clock">
            <Clock aria-hidden="true" />
            <span>Clock</span>
          </Link>
        </Button>
      ),
    }],
    ["quick-create", {
      id: "quick-create",
      node: (
        <Button
          ref={quickCreateButtonRef}
          type="button"
          variant="secondary"
          className={cn("ml-main-bar-plus size-12 rounded-full shadow-lg", quickActionsOpen && "bg-primary text-primary-foreground")}
          aria-label="Open quick actions"
          aria-expanded={quickActionsOpen}
          onClick={() => setQuickActionsOpen((current) => !current)}
        >
          <Plus aria-hidden="true" />
        </Button>
      ),
    }],
    ["theme", {
      id: "theme",
      node: <ThemeSwitcherMultiButton />,
    }],
    ["calendar", {
      id: "calendar",
      node: (
        <Button asChild variant="ghost" className="ml-main-bar-button">
          <Link href="/calendar" aria-label="Open calendar">
            <CalendarDays aria-hidden="true" />
            <span>Calendar</span>
          </Link>
        </Button>
      ),
    }],
    ["more", {
      id: "more",
      node: (
        <Button type="button" variant="ghost" className="ml-main-bar-button" aria-label="Open navigation" onClick={toggleSidebar}>
          <Menu aria-hidden="true" />
          <span>More</span>
        </Button>
      ),
    }],
  ])

  return (
    <TooltipProvider delayDuration={150}>
      <QuickActionSpeedDial open={quickActionsOpen} onOpenChange={setQuickActionsOpen} returnFocusRef={quickCreateButtonRef} />
      <nav
        aria-label="MassageLab main navigation"
        className="ml-mobile-main-bar fixed inset-x-0 bottom-0 z-[10025] border-t border-border/80 bg-background/95 px-2 pb-[max(var(--ml-safe-bottom),0.35rem)] pt-1.5 shadow-2xl shadow-black/35 backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-7 items-center gap-1">
          {order.map((itemId) => {
            const item = itemById.get(itemId)
            return item ? <div key={item.id} className="flex justify-center">{item.node}</div> : null
          })}
        </div>
      </nav>
    </TooltipProvider>
  )
}
```

- [ ] **Step 6: Wire the main bar into the layout**

In `components/layout-wrapper.tsx`, import `MobileMainBar` and `getMusicPlayerPlacement`:

```tsx
import { MobileMainBar } from "@/components/shell/mobile-main-bar"
import { getMusicPlayerPlacement } from "@/lib/app-shell"
```

Replace `const musicPlayerPlacement = getAudioPlayerToolbarPlacement(settings)` with:

```tsx
  const musicPlayerPlacement = getMusicPlayerPlacement(settings)
```

Render the main bar before `MusicMiniPlayer`:

```tsx
      {!routeOwnsBackground && <MobileMainBar />}
      <MusicMiniPlayer placement={musicPlayerPlacement} />
```

In `components/calendar/calendar-operator-top-bar.tsx`, keep the desktop/tablet bar out of the phone layout so it does not duplicate the bottom main bar. Add `hidden md:block` to the header class:

```tsx
          "ml-app-topbar relative z-30 hidden bg-background/95 shadow-sm backdrop-blur md:block",
```

Also add a desktop/tablet `+` quick-action control to the topbar. Import `Plus` and `QuickActionSpeedDial`:

```tsx
import {
  CalendarCog,
  CalendarDays,
  Clock,
  ListChecks,
  Music2,
  PanelLeft,
  PanelRight,
  Plus,
  Settings2,
} from "lucide-react"
import { QuickActionSpeedDial } from "@/components/shell/quick-action-speed-dial"
```

Inside `CalendarOperatorTopBar`, add state and a return-focus ref near the existing refs:

```tsx
  const quickActionButtonRef = useRef<HTMLButtonElement | null>(null)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
```

Create the control before `oppositeControls`:

```tsx
  const quickActionControl = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={quickActionButtonRef}
          type="button"
          variant="secondary"
          size="icon"
          className="h-10 w-10 shrink-0"
          aria-label="Open quick actions"
          aria-expanded={quickActionsOpen}
          onClick={() => setQuickActionsOpen((current) => !current)}
        >
          <Plus data-icon="inline-start" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Quick actions</TooltipContent>
    </Tooltip>
  )
```

Include `quickActionControl` in `oppositeControls` between Theme and Music:

```tsx
      <ThemeSwitcherMultiButton />
      {quickActionControl}
      {musicControl}
```

Render the speed dial just inside the returned `TooltipProvider`:

```tsx
      <QuickActionSpeedDial
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        returnFocusRef={quickActionButtonRef}
      />
```

- [ ] **Step 7: Add CSS stack variables**

In `app/globals.css`, add these variables under `--ml-audio-toolbar-height`:

```css
    --ml-main-bar-height: 4.75rem;
    --ml-bottom-stack-height: calc(var(--ml-safe-bottom) + var(--ml-main-bar-height));
```

In `.ml-app-shell`, set the bottom safe area to include the mobile bar:

```css
    --ml-page-bottom-safe: calc(var(--ml-safe-bottom) + var(--ml-page-edge-gap) + var(--ml-scroll-end-buffer) + var(--ml-main-bar-height));
```

Update the music-player bottom active rule:

```css
  body.ml-music-player-active.ml-music-player-bottom .ml-app-shell {
    --ml-page-bottom-safe: calc(var(--ml-safe-bottom) + var(--ml-page-edge-gap) + var(--ml-scroll-end-buffer) + var(--ml-main-bar-height) + var(--ml-audio-toolbar-height));
  }
```

Update the bottom toolbar rule:

```css
  .ml-music-player-toolbar[data-placement="bottom"] {
    bottom: var(--ml-bottom-stack-height);
  }
```

Add compact main-bar styles:

```css
  .ml-main-bar-button {
    height: 3.75rem;
    width: 100%;
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.25rem 0.15rem;
    font-size: 0.68rem;
    line-height: 1;
  }

  .ml-main-bar-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .ml-main-bar-plus svg {
    width: 1.45rem;
    height: 1.45rem;
  }
```

- [ ] **Step 8: Run focused model tests**

Run: `node --test tests/app-settings.test.mjs tests/quick-actions.test.mjs`

Expected: PASS.

- [ ] **Step 9: Run browser shell tests**

Run: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "main bar|quick-create|lighting controls|global player state" --project=desktop-chromium`

Expected: PASS. If the dev server port is occupied, set `PLAYWRIGHT_PORT=3011` and rerun the same command.

- [ ] **Step 10: Commit shell UI**

Run:

```bash
git add components/shell/mobile-main-bar.tsx components/shell/quick-action-speed-dial.tsx components/layout-wrapper.tsx components/calendar/calendar-operator-top-bar.tsx app/globals.css tests/app-settings.test.mjs tests/browser/public-routes.spec.ts
git commit -m "Add responsive main bar and quick actions"
```

## Task 4: Homepage Tool Discovery Rails

**Files:**
- Create: `components/home/home-tool-rails.tsx`
- Modify: `app/page.tsx`
- Modify: `tests/browser/public-routes.spec.ts`

- [ ] **Step 1: Update homepage browser expectations**

In `tests/browser/public-routes.spec.ts`, rename "anonymous homepage presents the optional action router and available tools catalog" to "anonymous homepage presents landing copy and tool discovery rails".

Add these assertions after the action router checks:

```ts
  await expect(page.getByRole("region", { name: /^Practice tools$/i })).toBeVisible()
  await expect(page.getByRole("region", { name: /^Study tools$/i })).toBeVisible()
  await expect(page.getByRole("region", { name: /^Wellness tools$/i })).toBeVisible()
  await expect(page.getByRole("region", { name: /^Music and focus$/i })).toBeVisible()
  await expect(page.getByRole("region", { name: /^Business tools$/i })).toBeVisible()
```

- [ ] **Step 2: Run homepage browser test and verify failure**

Run: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "homepage" --project=desktop-chromium`

Expected: FAIL because the rail regions do not exist.

- [ ] **Step 3: Create rail component**

Create `components/home/home-tool-rails.tsx`:

```tsx
import Link from "next/link"
import {
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  LucideIcon,
  Radio,
  Timer,
  Wind,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const railIcons = {
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  Radio,
  Timer,
  Wind,
} satisfies Record<string, LucideIcon>

export type HomeRailItem = {
  title: string
  description: string
  href: string
  action: string
  badge: string
  icon: keyof typeof railIcons
}

export type HomeToolRail = {
  id: string
  title: string
  description: string
  items: HomeRailItem[]
}

export const publicHomeToolRails: HomeToolRail[] = [
  {
    id: "practice",
    title: "Practice tools",
    description: "Session timing, scheduling, and local-first work surfaces.",
    items: [
      { title: "Chimer", description: "Treatment-room intervals and clock mode.", href: "/chimer", action: "Start timer", badge: "Public", icon: "Timer" },
      { title: "Calendar", description: "Scheduling entry point and booking workspace.", href: "/calendar", action: "Open calendar", badge: "Signed-in saves", icon: "CalendarDays" },
      { title: "Local-first notes", description: "SOAP, intake, journal, and ROM vault preview.", href: "/notes", action: "Review notes", badge: "Local-first", icon: "ClipboardList" },
    ],
  },
  {
    id: "study",
    title: "Study tools",
    description: "Anatomy study and classroom-friendly games.",
    items: [
      { title: "Flashcards", description: "Sourced anatomy decks and typed review.", href: "/education/flashcards", action: "Study", badge: "Public study", icon: "BookOpen" },
      { title: "Anatomime", description: "Solo or shared anatomy clue play.", href: "/anatomime", action: "Play", badge: "Classroom", icon: "Brain" },
    ],
  },
  {
    id: "wellness",
    title: "Wellness tools",
    description: "Public practice tracking and client-owned self-reporting.",
    items: [
      { title: "Wellness hub", description: "Quick logs, body sensations, ROM, and reflection.", href: "/wellness", action: "Open wellness", badge: "Practice mode", icon: "HeartPulse" },
      { title: "Breathing guide", description: "A simple breathing pacer for settling.", href: "/wellness/breathing", action: "Start breathing", badge: "Public", icon: "Wind" },
    ],
  },
  {
    id: "music",
    title: "Music and focus",
    description: "Generative stations for massage-room pacing, studying, or focus.",
    items: [
      { title: "Music", description: "Swipeable station rails with a persistent player.", href: "/music", action: "Open music", badge: "Public audio", icon: "Radio" },
    ],
  },
  {
    id: "business",
    title: "Business tools",
    description: "Planning worksheets for students and independent therapists.",
    items: [
      { title: "Business planner", description: "Income, startup costs, service menus, and launch tasks.", href: "/tools/business-planner", action: "Open planner", badge: "Browser-local", icon: "BriefcaseBusiness" },
    ],
  },
]

export function HomeToolRails({ rails = publicHomeToolRails }: { rails?: HomeToolRail[] }) {
  return (
    <div className="space-y-8">
      {rails.map((rail) => (
        <section key={rail.id} aria-label={rail.title} className="space-y-3">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-normal">{rail.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{rail.description}</p>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
            {rail.items.map((item) => {
              const Icon = railIcons[item.icon]

              return (
                <article
                  key={item.title}
                  className={cn(
                    "flex min-w-[min(76vw,17rem)] snap-start flex-col rounded-md border border-border/80 bg-card/95 p-4 shadow-xl shadow-black/20 ring-1 ring-white/[0.03]",
                    "sm:min-w-[18rem] lg:min-w-[19rem]",
                  )}
                >
                  <div className="mb-4 flex aspect-[4/3] items-center justify-center rounded-md border border-border/70 bg-background/75">
                    <Icon className="size-12 text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex min-h-40 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <Badge variant="outline" className="shrink-0 border-primary/50 text-primary">{item.badge}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    <Button asChild variant="outline" className="mt-auto">
                      <Link href={item.href}>{item.action}</Link>
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Insert rails into homepage**

In `app/page.tsx`, import `HomeToolRails`:

```tsx
import { HomeToolRails } from "@/components/home/home-tool-rails"
```

Insert after the "What are you here for today?" `AppSurface`:

```tsx
      <section aria-labelledby="tool-discovery-heading" className="space-y-4">
        <div>
          <p className="text-sm font-medium text-primary">Tool discovery</p>
          <h2 id="tool-discovery-heading" className="text-2xl font-semibold sm:text-3xl">Pick up where MassageLab can help</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Browse practice, study, wellness, music, and business tools in a swipeable hub. Sign in when you want MassageLab to remember your shortcuts and progress.
          </p>
        </div>
        <HomeToolRails />
      </section>
```

- [ ] **Step 5: Run homepage browser test**

Run: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "homepage" --project=desktop-chromium`

Expected: PASS.

- [ ] **Step 6: Commit homepage rails**

Run:

```bash
git add app/page.tsx components/home/home-tool-rails.tsx tests/browser/public-routes.spec.ts
git commit -m "Add homepage tool discovery rails"
```

## Task 5: Account Settings Grouped Mobile Index

**Files:**
- Modify: `lib/account-page.js`
- Modify: `app/account/account-settings-shell.tsx`
- Modify: `app/account/app-settings-panel.tsx`
- Modify: `components/account/settings-surfaces.tsx`
- Modify: `tests/account-page-tabs.test.mjs`
- Modify: `tests/browser/public-routes.spec.ts`

- [ ] **Step 1: Update account model tests**

In `tests/account-page-tabs.test.mjs`, update the expected group ids:

```js
    assert.deepEqual(accountPageGroups.map((group) => group.id), [
      "general",
      "account",
      "preferences",
      "practice",
      "support",
      "legal",
    ])
```

Update expected group labels:

```js
    assert.deepEqual(accountPageGroups.map((group) => group.label), [
      "General",
      "Account",
      "Preferences",
      "Practice",
      "Support",
      "Legal",
    ])
```

Add search expectations:

```js
    assert.deepEqual(
      filterAccountPageGroups("quick actions").flatMap((group) => group.items.map((item) => item.id)),
      ["app-settings"],
    )
    assert.deepEqual(
      filterAccountPageGroups("drawer side").flatMap((group) => group.items.map((item) => item.id)),
      ["app-settings"],
    )
```

- [ ] **Step 2: Run account model test and verify failure**

Run: `node --test tests/account-page-tabs.test.mjs`

Expected: FAIL because current group ids are still `personal`, `payments`, and `practice`.

- [ ] **Step 3: Regroup account sections**

Replace `accountPageGroups` in `lib/account-page.js` with groups that preserve existing item ids:

```js
export const accountPageGroups = [
  {
    id: "general",
    label: "General",
    description: "Overview, app layout, and high-priority account shortcuts.",
    items: [
      {
        id: "overview",
        label: "Overview",
        description: "Account health, role summary, and high-priority actions.",
        icon: "UserRound",
        status: "current",
        statusLabel: "Summary",
        sections: ["account-summary", "quick-actions"],
      },
      {
        id: "app-settings",
        label: "App layout",
        description: "Theme, app bar position, drawer side, home shortcuts, quick actions, and account-level app preferences.",
        icon: "Settings2",
        status: "current",
        statusLabel: "Theme, drawer, and quick actions",
        sections: ["app-layout-settings", "app-theme-settings"],
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    description: "Profile, access, security, and role verification.",
    items: [
      {
        id: "profile",
        label: "Profile",
        description: "Personal and professional defaults used by account-backed workflows.",
        icon: "UserRound",
        status: "current",
        statusLabel: "Defaults",
        sections: ["profile-defaults"],
      },
      {
        id: "security",
        label: "Security",
        description: "Sign-in methods, password access, authenticator 2FA, and backup codes.",
        icon: "KeyRound",
        status: "current",
        statusLabel: "Priority",
        sections: ["security-settings"],
      },
      {
        id: "credentials",
        label: "Credentials",
        description: "Roles, licenses, student verification, and review history.",
        icon: "BadgeCheck",
        status: "current",
        statusLabel: "Verification",
        sections: ["role-verification"],
      },
    ],
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Local defaults, data boundaries, and planned preference areas.",
    items: [
      {
        id: "therapist-defaults",
        label: "Therapist defaults",
        description: "Local therapist defaults used to pre-fill documentation on this device.",
        icon: "UserRound",
        status: "current",
        statusLabel: "Local defaults",
        sections: ["local-therapist-defaults"],
      },
      {
        id: "sync",
        label: "Data & sync",
        description: "Preference sync controls and the clinical sync boundary.",
        icon: "FileCheck2",
        status: "current",
        statusLabel: "Local-first",
        sections: ["preference-sync", "clinical-sync"],
      },
      {
        id: "accessibility",
        label: "Accessibility",
        description: "Future account-level display, motion, and accessibility preferences.",
        icon: "Accessibility",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Future reminders, email preferences, and notification controls.",
        icon: "Bell",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
    ],
  },
  {
    id: "practice",
    label: "Practice",
    description: "Practice identity, people, calendar, and content tools.",
    items: [
      {
        id: "calendar-availability",
        label: "Calendar availability",
        description: "Manage availability on the calendar when practice scheduling is enabled.",
        icon: "CalendarDays",
        status: "link",
        statusLabel: "Open page",
        href: "/calendar/availability",
        sections: [],
      },
      {
        id: "practice-profile",
        label: "Practice profile",
        description: "Future practice identity, contact details, and public booking context.",
        icon: "Building2",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
      {
        id: "people",
        label: "People",
        description: "Future team, practitioner, and invitation management.",
        icon: "UsersRound",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    description: "Support, utilities, and account session actions.",
    items: [
      {
        id: "tools",
        label: "Tools",
        description: "Feedback, sign out, and the role-gated anatomy browser.",
        icon: "Settings2",
        status: "current",
        statusLabel: "Utilities",
        sections: ["anatomy-feedback", "anatomy-browser-access", "account-session"],
      },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    description: "Membership, billing, receipts, and legal acceptance records.",
    items: [
      {
        id: "membership",
        label: "Membership & billing",
        description: "Pricing cards, subscription status, billing portal access, and paid feature eligibility.",
        icon: "CreditCard",
        status: "current",
        statusLabel: "Billing",
        sections: ["membership", "membership-pricing", "subscription-status", "billing-portal"],
      },
      {
        id: "orders-invoices",
        label: "Orders & invoices",
        description: "Future Stripe invoices, receipts, and purchase history.",
        icon: "ReceiptText",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
    ],
  },
]
```

- [ ] **Step 4: Add compact settings row helper**

In `components/account/settings-surfaces.tsx`, add:

```tsx
export function SettingsCompactRow({
  icon,
  title,
  description,
  trailing,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon ? <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 text-primary">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {description ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span> : null}
      </span>
      {trailing}
    </div>
  )
}
```

- [ ] **Step 5: Update settings shell layout**

In `app/account/account-settings-shell.tsx`, keep existing components but update mobile index section headings to use the new labels and ensure row descriptions are visible on mobile:

```tsx
            {variant === "mobile" ? <p className="text-xs leading-5 text-muted-foreground">{group.description}</p> : null}
```

Update `AccountNavItem` mobile class to create nzb360-style rows:

```tsx
    variant === "mobile" && "rounded-none border-transparent px-4 py-4 shadow-none",
```

Update active icon styling to stay compact:

```tsx
        active && "border-primary/50 bg-primary/15 text-primary shadow-sm shadow-primary/10",
```

- [ ] **Step 6: Add app settings quick-action entry text**

In `app/account/app-settings-panel.tsx`, update the layout surface description:

```tsx
        description="Choose the main bar edge, drawer side, theme behavior, and quick-action defaults."
```

Add this informational block after the sidebar button position group:

```tsx
        <div className="rounded-md border border-border/80 bg-background/80 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Quick actions</p>
          <p className="mt-1">
            The global plus button starts with role-aware defaults from onboarding. Full drag-and-drop customization can build on the saved quick-action keys in app preferences.
          </p>
        </div>
```

- [ ] **Step 7: Run account tests**

Run: `node --test tests/account-page-tabs.test.mjs`

Expected: PASS.

- [ ] **Step 8: Run account browser smoke**

Run: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "account|settings|main bar" --project=desktop-chromium`

Expected: PASS.

- [ ] **Step 9: Commit account settings refresh**

Run:

```bash
git add lib/account-page.js app/account/account-settings-shell.tsx app/account/app-settings-panel.tsx components/account/settings-surfaces.tsx tests/account-page-tabs.test.mjs tests/browser/public-routes.spec.ts
git commit -m "Refresh account settings navigation"
```

## Task 6: Shared Visual Coherence Pass

**Files:**
- Modify: `components/ui/app-surface.tsx`
- Modify: `components/sidebar/app-sidebar-client.tsx`
- Modify: `app/browse/workspace.tsx`
- Modify: `app/tools/page.tsx`
- Modify: `app/tools/business-planner/page.tsx`
- Modify: `app/education/page.tsx`
- Modify: `app/notes/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/browser/public-routes.spec.ts`

- [ ] **Step 1: Add browser assertions for coherent public surfaces**

In `tests/browser/public-routes.spec.ts`, add:

```ts
test("core public tool surfaces keep shell spacing and visible primary content", async ({ page }) => {
  const health = capturePageHealth(page)

  for (const path of ["/", "/tools", "/education", "/notes", "/music", "/wellness"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("navigation", { name: /^MassageLab main navigation$/i })).toBeVisible()
    await expect(page.locator(".ml-app-content")).toBeVisible()
    const contentBox = await page.locator(".ml-app-content").boundingBox()
    expect(contentBox?.height ?? 0).toBeGreaterThan(240)
  }

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})
```

- [ ] **Step 2: Run browser assertion and verify failure if spacing is not wired**

Run: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "core public tool surfaces" --project=desktop-chromium`

Expected: PASS after Task 3 if shell spacing is already correct; otherwise FAIL with a visible layout or selector issue.

- [ ] **Step 3: Add reusable media tile classes**

In `components/ui/app-surface.tsx`, add:

```tsx
export const appMediaTileClassName =
  "rounded-md border border-border/80 bg-card/95 shadow-xl shadow-black/20 ring-1 ring-white/[0.03] backdrop-blur"

export const appRailScrollerClassName =
  "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
```

- [ ] **Step 4: Apply shared classes to rail-heavy surfaces**

In `app/browse/workspace.tsx`, import `appMediaTileClassName` and `appRailScrollerClassName`.

Replace the station rail scroller class with `cn(appRailScrollerClassName)`.

Replace station card outer classes with:

```tsx
      className={cn(
        appMediaTileClassName,
        "flex min-w-[min(58vw,10.75rem)] snap-start flex-col overflow-hidden transition-colors sm:min-w-[10.875rem] lg:min-w-[11.25rem] xl:min-w-[11.625rem]",
        isActive && "border-primary/80 shadow-lg shadow-primary/15",
      )}
```

- [ ] **Step 5: Normalize page shell content gaps**

For `app/tools/page.tsx`, `app/tools/business-planner/page.tsx`, `app/education/page.tsx`, and `app/notes/page.tsx`, ensure the top-level `AppPageShell` uses `contentClassName="gap-6"` or tighter route-owned spacing. Do not redesign forms or workflow-specific content in this task.

- [ ] **Step 6: Run public route smoke**

Run: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "anonymous public route|core public tool surfaces" --project=desktop-chromium`

Expected: PASS.

- [ ] **Step 7: Commit shared coherence pass**

Run:

```bash
git add components/ui/app-surface.tsx components/sidebar/app-sidebar-client.tsx app/browse/workspace.tsx app/tools/page.tsx app/tools/business-planner/page.tsx app/education/page.tsx app/notes/page.tsx app/globals.css tests/browser/public-routes.spec.ts
git commit -m "Align shared visual surfaces"
```

## Task 7: Final Validation And Documentation

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Run full local validation**

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:browser -- tests/browser/public-routes.spec.ts --project=desktop-chromium
git diff --check
```

Expected: all commands PASS. If the Windows sandbox fails before a command starts with `CreateProcessAsUserW failed: 1312`, rerun the same command through the approved outside-sandbox path and do not treat that as an app failure.

- [ ] **Step 2: Update project state**

In `docs/project-state.md`, update the "Website And Tool Surface" public app shell bullet so it includes this sentence:

```md
The responsive shell now defaults to a bottom-first main bar on phones, keeps the music player bottom-stacked above that bar, exposes Home/Music/Clock/quick-create/theme/Calendar/More controls, and uses role-aware quick actions plus rail-based homepage discovery while preserving the configurable drawer side and existing theme modes.
```

- [ ] **Step 3: Update project log**

In `docs/project-log.md`, add a dated entry under the latest `### 2026-06-22` section, or create that section above `### 2026-06-21` if it is not present:

```md
- Implemented the Big Visual Refresh: added a bottom-first responsive shell, bottom-stacked music player behavior, Radarr-style quick actions, rail-based homepage/tool discovery, compact grouped account settings, and shared visual-surface alignment across representative public routes while preserving local-first PHI boundaries, feature-key checks, drawer-side choice, and theme modes.
```

- [ ] **Step 4: Run documentation diff check**

Run: `git diff --check`

Expected: PASS.

- [ ] **Step 5: Commit docs and final validation record**

Run:

```bash
git add docs/project-state.md docs/project-log.md
git commit -m "Document big visual refresh"
```

- [ ] **Step 6: Summarize implementation**

Prepare a final summary containing:

- Shell changes.
- Quick-action changes.
- Homepage/tool discovery changes.
- Account settings changes.
- Coherence pass.
- Validation commands and results.
- Any skipped validation with the reason.
