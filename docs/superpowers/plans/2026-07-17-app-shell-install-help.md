# App Shell, Install, and Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a full-width, route-aware MassageLab app bar with stable branding, focused quick actions, conditional PWA installation, public Help & FAQ, and the existing privacy-safe feedback flow.

**Architecture:** Keep the existing shell boundaries. Pure JavaScript helpers resolve quick-action, route, layout, and PWA capability state; focused React components render the shared brand, tool links, installation dialog, and provider state; the existing app bar, mobile bar, sidebar menu, public-page system, and support route consume those interfaces. No database or entitlement changes are required.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, JavaScript/JSDoc domain helpers, Tailwind CSS, Radix/shadcn UI primitives, Lucide icons, Node test runner, Playwright.

## Global Constraints

- Preserve the current full-screen dimmed quick-action overlay; do not replace it with a dropdown, popover, or compact speed dial.
- Signed-out quick actions are exactly Log In, Create Account, Quick Log, and Breathing Guide.
- Signed-in quick actions remain route-backed, role/use-case aware, customizable, unique, and limited to seven.
- Keep every global tool button's existing visual variant; only add an active-route glow and semantic current-page state.
- The drawer button remains in the outer corner nearest the configured drawer side; the MassageLab home brand is immediately medial to it.
- Collapse the wordmark to the existing logo mark before hiding any global tool action.
- Preserve configured top/bottom app-bar placement, left/right drawer placement, route-owned toolbar overflow, music-player stacking, safe areas, light/dark/system themes, and Chimer's immersive bar-hiding rules.
- Never launch the PWA installation prompt automatically.
- Show installation only for a captured native prompt or the recognized iOS/iPadOS Safari manual flow; hide it when installed or unsupported.
- Reuse `/support` for feedback and privacy-safe diagnostics; do not add another backend or accept hosted PHI.
- `/help` is public and must not claim background credits or individual purchases are live before the commerce track ships.
- Do not modify Clock/Chimer settings, Music backgrounds, carousel production behavior, premium-background commerce, or the public Roadmap in this track.
- Add focused JSDoc/comments for non-obvious capability detection, layout ordering, and fixed-bar measurements.
- Preserve unrelated working-tree changes, especially the existing `TODO.md` edit.

## File Structure

### Create

- `lib/pwa-install.js` — pure platform and install-status resolution.
- `components/providers/pwa-install-provider.tsx` — browser event lifecycle and explicit install action.
- `components/pwa/install-massagelab-dialog.tsx` — iOS/iPadOS manual installation instructions.
- `components/shell/app-bar-brand-link.tsx` — one responsive MassageLab home link for desktop and mobile bars.
- `components/shell/app-tool-link.tsx` — shared active-route semantics for Music, Clock, and linked Calendar controls.
- `app/help/page.tsx` — public starter Help & FAQ surface.
- `tests/pwa-install.test.mjs` — pure capability and provider/menu contract tests.
- `tests/browser/app-shell.spec.ts` — focused shell, quick-action, help, and install browser acceptance tests.

### Modify

- `lib/quick-actions.js` — exact anonymous action set and Quick Log anchor.
- `components/shell/quick-action-speed-dial.tsx` — Login/Create Account icon support without changing overlay presentation.
- `app/wellness/page.tsx` — stable `quick-log` fragment target.
- `tests/quick-actions.test.mjs` — anonymous and signed-in resolver expectations.
- `app/layout.tsx` — mount the PWA install provider around the application shell.
- `lib/navigation.js` — public Help & FAQ and Send Feedback account-menu routes.
- `components/sidebar/app-sidebar-client.tsx` — conditional Install plus common public account-menu actions; remove duplicated drawer branding.
- `tests/navigation-model.test.mjs` — updated account-menu and route-family contracts.
- `lib/seo.js` — public `/help` metadata and sitemap entry.
- `tests/seo.test.mjs` — Help route SEO coverage.
- `components/calendar/calendar-operator-top-bar.tsx` — fixed full-width desktop bar, medial brand, active Calendar state, and measured height.
- `components/shell/mobile-main-bar.tsx` — shared brand and active tool links with drawer-side edge grouping.
- `lib/app-shell.js` — deterministic drawer/brand/tool ordering.
- `components/providers/settings-provider.tsx` — reflect app-bar position on the document root for global shell CSS.
- `components/layout-wrapper.tsx` — render the fixed desktop app bar once and preserve stack variables.
- `app/globals.css` — full-width fixed-bar offsets, brand collapse, active glow, sidebar offsets, and music-player stacking.
- `tests/app-settings.test.mjs` — shell structure and layout-helper coverage.
- `tests/browser/public-routes.spec.ts` — update old Home-button assumptions and include `/help` in the public route matrix.
- `docs/project-state.md` — record the shipped shell/help/install behavior after validation.
- `docs/project-log.md` — append the completed Track 5 implementation and validation record.

---

### Task 1: Focus the quick-action contract

**Files:**
- Modify: `tests/quick-actions.test.mjs`
- Modify: `lib/quick-actions.js`
- Modify: `components/shell/quick-action-speed-dial.tsx`
- Modify: `app/wellness/page.tsx`

**Interfaces:**
- Consumes: existing `resolveQuickActionGroups({ signedIn, onboarding })` and `QUICK_ACTION_MAX_VISIBLE`.
- Produces: `resolveAnonymousQuickActionGroups()` returning one `quick_actions` group containing `login`, `create_account`, `wellness_quick_log`, and `start_breathing` in that order; `/wellness#quick-log` as a stable route.

- [ ] **Step 1: Replace the anonymous resolver tests with the approved exact contract**

```js
it("exposes only the approved anonymous quick actions", () => {
  const groups = resolveAnonymousQuickActionGroups()

  assert.deepEqual(groups.map((group) => group.id), ["quick_actions"])
  assert.deepEqual(groups[0].actions.map(({ id, label, href }) => ({ id, label, href })), [
    { id: "login", label: "Log In", href: "/login" },
    { id: "create_account", label: "Create Account", href: "/register" },
    { id: "wellness_quick_log", label: "Quick Log", href: "/wellness#quick-log" },
    { id: "start_breathing", label: "Breathing Guide", href: "/wellness/breathing" },
  ])
})

it("never mixes authentication actions into signed-in defaults", () => {
  const ids = resolveQuickActionKeys({
    signedIn: true,
    onboarding: { primaryRole: "therapist", useCases: ["manage_practice", "run_sessions"] },
  })

  assert.equal(ids.includes("login"), false)
  assert.equal(ids.includes("create_account"), false)
  assert.equal(ids.length <= QUICK_ACTION_MAX_VISIBLE, true)
})
```

- [ ] **Step 2: Run the focused test and confirm the old two-group model fails**

Run: `node --test tests/quick-actions.test.mjs`

Expected: FAIL because the current anonymous resolver returns `available_now` and `sign_in_to_save` groups with more than four actions.

- [ ] **Step 3: Add an anonymous-only catalog and keep signed-in resolution unchanged**

Add beside `quickActionCatalog` in `lib/quick-actions.js`:

```js
const anonymousQuickActions = Object.freeze([
  { id: "login", label: "Log In", description: "Sign in to MassageLab.", href: "/login", icon: "LogIn" },
  { id: "create_account", label: "Create Account", description: "Register a MassageLab account.", href: "/register", icon: "UserPlus" },
  { id: "wellness_quick_log", label: "Quick Log", description: "Jump to the Wellness quick log.", href: "/wellness#quick-log", icon: "HeartPulse" },
  { id: "start_breathing", label: "Breathing Guide", description: "Open the public breathing pacer.", href: "/wellness/breathing", icon: "Wind" },
])

export function resolveAnonymousQuickActionGroups() {
  return [{ id: "quick_actions", label: "Quick actions", actions: anonymousQuickActions }]
}
```

Update the signed-in catalog entry without adding the authentication actions to `quickActionCatalog`:

```js
{
  id: "wellness_quick_log",
  label: "Quick Log",
  description: "Open wellness self-tracking.",
  href: "/wellness#quick-log",
  icon: "HeartPulse",
  group: "available_now",
  roleSignals: ["client", "therapist", "student", "public_wellness"],
  useCaseSignals: ["book_care", "track_progress"],
}
```

Delete `anonymousGroupDefinitions`; do not alter role, use-case, explicit-selection, sanitization, or seven-item logic.

- [ ] **Step 4: Add the two icon mappings and the Wellness fragment target**

In `components/shell/quick-action-speed-dial.tsx`, import and register `LogIn` and `UserPlus`:

```tsx
import { LogIn, UserPlus } from "lucide-react"

const quickActionIcons = {
  BookOpen,
  Brain,
  CalendarDays,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  LogIn,
  Map,
  Radio,
  Settings2,
  Timer,
  UserPlus,
  Wind,
} satisfies Record<string, LucideIcon>
```

In `app/wellness/page.tsx`, wrap the Wellness quick-log surface without changing its contents:

```tsx
<div id="quick-log" className="scroll-mt-24">
  <AppSurface
    title="Wellness"
    description="Client-owned self-tracking for quick check-ins, context notes, and range-of-motion measurements."
    icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
    badge={userId ? "Signed in" : "Practice mode"}
  >
    <WellnessHubClient
      isSignedIn={Boolean(userId)}
      displayName={session?.user?.name ?? session?.user?.email ?? null}
      initialEntries={entries.map(serializeWellnessEntry)}
      initialReportEntries={reportEntries.map(serializeWellnessEntry)}
      appointments={[...upcomingAppointments, ...pastAppointments].map(serializeWellnessAppointment)}
      reminderSchedules={reminderSchedulesFromPreference(preference?.settings)}
    />
  </AppSurface>
</div>
```

Preserve the full-screen presentation while making its focus behavior explicit. Add a `dialogRef`, focus the first action after opening, trap Tab/Shift+Tab among the dialog links and close button, and keep Escape focus return:

```tsx
const dialogRef = React.useRef<HTMLDivElement | null>(null)

React.useEffect(() => {
  if (!open) return undefined
  const dialog = dialogRef.current
  const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])
  focusable()[0]?.focus()

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      onOpenChange(false)
      returnFocusRef.current?.focus()
      return
    }
    if (event.key !== "Tab") return
    const items = focusable()
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  document.addEventListener("keydown", handleKeyDown)
  return () => document.removeEventListener("keydown", handleKeyDown)
}, [onOpenChange, open, returnFocusRef])
```

Make the anchored inner surface the modal dialog, keep the current group/action JSX inside `<nav aria-label="Quick create actions">`, stop inner clicks from reaching the backdrop, and keep the current Close quick actions button as the final focusable control. The resulting structure is:

```tsx
<div
  className="ml-quick-action-layer fixed inset-0 z-[10030] bg-background/35 backdrop-blur-md"
  onClick={() => {
    returnFocusRef.current?.focus()
    onOpenChange(false)
  }}
>
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-label="Quick actions"
    className="absolute flex w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col items-end gap-3 overflow-y-auto overscroll-contain"
    style={anchorStyle ?? { left: "50%", bottom: "calc(var(--ml-bottom-stack-height) + 4.75rem)" }}
    onClick={(event) => event.stopPropagation()}
  >
    <nav aria-label="Quick create actions" className="contents">
      {groups.map((group) => (
        <section key={group.id} className="flex w-full flex-col items-end gap-2">
          <p className="mr-16 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur">{group.label}</p>
          {group.actions.map((action) => {
            const Icon = quickActionIcons[action.icon as keyof typeof quickActionIcons] ?? Settings2
            return (
              <Link key={action.id} href={action.href} className="group flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpenChange(false)}>
                <span className="max-w-[14rem] rounded-full border border-border/80 bg-background/95 px-3 py-2 text-right text-sm font-medium shadow-xl backdrop-blur">{action.label}</span>
                <span className="flex size-12 items-center justify-center rounded-full border border-border/80 bg-card text-primary shadow-xl"><Icon className="size-5" aria-hidden="true" /></span>
              </Link>
            )
          })}
        </section>
      ))}
    </nav>
    <Button type="button" size="icon" variant="secondary" className="size-12 rounded-full shadow-xl" aria-label="Close quick actions" onClick={() => { onOpenChange(false); returnFocusRef.current?.focus() }}>
      <X aria-hidden="true" />
    </Button>
  </div>
</div>
```

- [ ] **Step 5: Run focused and regression tests**

Run: `node --test tests/quick-actions.test.mjs tests/account-preferences.test.mjs`

Expected: PASS; signed-in custom selections and defaults remain intact, while anonymous users receive exactly four actions.

- [ ] **Step 6: Commit the quick-action slice**

```bash
git add lib/quick-actions.js components/shell/quick-action-speed-dial.tsx app/wellness/page.tsx tests/quick-actions.test.mjs
git commit -m "feat: focus global quick actions"
```

---

### Task 2: Add deterministic PWA installation state

**Files:**
- Create: `tests/pwa-install.test.mjs`
- Create: `lib/pwa-install.js`
- Create: `components/providers/pwa-install-provider.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: browser `beforeinstallprompt`, `appinstalled`, `matchMedia("(display-mode: standalone)")`, and iOS `navigator.standalone` signals.
- Produces: `resolvePwaInstallStatus(input): "prompt" | "instructions" | "installed" | "unsupported"`, `isIosSafariNavigator(input): boolean`, and `usePwaInstall(): { status, requestInstall }` where `requestInstall()` resolves to `"accepted" | "dismissed" | "instructions" | "unavailable" | "failed"`.

- [ ] **Step 1: Write pure capability tests**

Create `tests/pwa-install.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isIosSafariNavigator, resolvePwaInstallStatus } from "../lib/pwa-install.js"

describe("PWA install capability", () => {
  it("prioritizes installed state over all install actions", () => {
    assert.equal(resolvePwaInstallStatus({ isStandalone: true, hasPrompt: true, isIosSafari: true }), "installed")
  })

  it("uses a captured native prompt before manual instructions", () => {
    assert.equal(resolvePwaInstallStatus({ hasPrompt: true, isIosSafari: true }), "prompt")
  })

  it("offers instructions only to recognized iOS Safari", () => {
    assert.equal(resolvePwaInstallStatus({ isIosSafari: true }), "instructions")
    assert.equal(resolvePwaInstallStatus({}), "unsupported")
  })

  it("recognizes iPhone Safari and touch-enabled iPad desktop UA", () => {
    assert.equal(isIosSafariNavigator({
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    }), true)
    assert.equal(isIosSafariNavigator({
      userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }), true)
    assert.equal(isIosSafariNavigator({
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    }), false)
  })
})
```

- [ ] **Step 2: Verify the helper is missing**

Run: `node --test tests/pwa-install.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/pwa-install.js`.

- [ ] **Step 3: Implement the pure resolver**

Create `lib/pwa-install.js`:

```js
// @ts-check

/** @typedef {"prompt" | "instructions" | "installed" | "unsupported"} PwaInstallStatus */

/**
 * Resolves only observable installation capability. Unknown browsers remain
 * unsupported so the UI never guesses at platform-specific instructions.
 *
 * @param {{ isStandalone?: boolean, hasPrompt?: boolean, isIosSafari?: boolean }} input
 * @returns {PwaInstallStatus}
 */
export function resolvePwaInstallStatus(input = {}) {
  if (input.isStandalone) return "installed"
  if (input.hasPrompt) return "prompt"
  if (input.isIosSafari) return "instructions"
  return "unsupported"
}

/**
 * Detects Safari on iOS/iPadOS, including iPadOS desktop-class user agents,
 * while excluding alternate iOS browser identifiers.
 *
 * @param {{ userAgent?: unknown, platform?: unknown, maxTouchPoints?: unknown }} input
 */
export function isIosSafariNavigator(input = {}) {
  const userAgent = String(input.userAgent ?? "")
  const platform = String(input.platform ?? "")
  const maxTouchPoints = Number(input.maxTouchPoints ?? 0)
  const isIosDevice = /iPad|iPhone|iPod/.test(userAgent)
    || (platform === "MacIntel" && maxTouchPoints > 1)
  const isSafari = /Safari/.test(userAgent)
    && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(userAgent)

  return isIosDevice && isSafari
}
```

- [ ] **Step 4: Implement the browser lifecycle provider**

Create `components/providers/pwa-install-provider.tsx` with this public contract and event handling:

```tsx
"use client"

import * as React from "react"
import { isIosSafariNavigator, resolvePwaInstallStatus } from "@/lib/pwa-install"

type PwaInstallStatus = "prompt" | "instructions" | "installed" | "unsupported"
type InstallRequestResult = "accepted" | "dismissed" | "instructions" | "unavailable" | "failed"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

const PwaInstallContext = React.createContext<{
  status: PwaInstallStatus
  requestInstall: () => Promise<InstallRequestResult>
} | null>(null)

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const promptRef = React.useRef<BeforeInstallPromptEvent | null>(null)
  const [hasPrompt, setHasPrompt] = React.useState(false)
  const [isStandalone, setIsStandalone] = React.useState(false)
  const [isIosSafari, setIsIosSafari] = React.useState(false)

  React.useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)")
    const readInstalledState = () => {
      setIsStandalone(displayMode.matches || Boolean((navigator as NavigatorWithStandalone).standalone))
    }
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      promptRef.current = event as BeforeInstallPromptEvent
      setHasPrompt(true)
    }
    const handleInstalled = () => {
      promptRef.current = null
      setHasPrompt(false)
      setIsStandalone(true)
    }

    setIsIosSafari(isIosSafariNavigator(navigator))
    readInstalledState()
    displayMode.addEventListener?.("change", readInstalledState)
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)

    return () => {
      displayMode.removeEventListener?.("change", readInstalledState)
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  const status = resolvePwaInstallStatus({ hasPrompt, isStandalone, isIosSafari }) as PwaInstallStatus

  const requestInstall = React.useCallback(async (): Promise<InstallRequestResult> => {
    if (status === "instructions") return "instructions"
    const event = promptRef.current
    if (status !== "prompt" || !event) return "unavailable"

    try {
      await event.prompt()
      const choice = await event.userChoice
      promptRef.current = null
      setHasPrompt(false)
      return choice.outcome
    } catch {
      promptRef.current = null
      setHasPrompt(false)
      return "failed"
    }
  }, [status])

  return <PwaInstallContext.Provider value={{ status, requestInstall }}>{children}</PwaInstallContext.Provider>
}

export function usePwaInstall() {
  const value = React.useContext(PwaInstallContext)
  if (!value) throw new Error("usePwaInstall must be used within PwaInstallProvider")
  return value
}
```

- [ ] **Step 5: Mount the provider without coupling it to service-worker registration**

In `app/layout.tsx`:

```tsx
<ServiceWorkerProvider />
<PwaInstallProvider>
  <SettingsProvider syncEnabled={canSyncAccountSettings}>
    <TherapistSettingsProvider syncEnabled={canSyncAccountSettings}>
      <MusicProvider>
        <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden bg-background">
          <SidebarCalendarProvider enabled={Boolean(user)}>
            <AppSidebarClient user={user} navigation={navigation} />
            <SidebarInset className="min-h-0 overflow-hidden bg-transparent">
              <main className="relative h-full min-w-0 overflow-hidden">
                <LayoutWrapper user={user} navigation={navigation}>{children}</LayoutWrapper>
              </main>
            </SidebarInset>
          </SidebarCalendarProvider>
        </SidebarProvider>
      </MusicProvider>
    </TherapistSettingsProvider>
  </SettingsProvider>
</PwaInstallProvider>
```

- [ ] **Step 6: Run focused tests and type checking**

Run: `node --test tests/pwa-install.test.mjs tests/pwa-service-worker.test.mjs`

Expected: PASS; service-worker caching remains unchanged.

Run: `npm run typecheck`

Expected: PASS with the non-standard prompt and iOS standalone fields contained inside the provider types.

- [ ] **Step 7: Commit the install-state foundation**

```bash
git add lib/pwa-install.js components/providers/pwa-install-provider.tsx app/layout.tsx tests/pwa-install.test.mjs
git commit -m "feat: add explicit PWA install state"
```

---

### Task 3: Integrate Install, Help, and Feedback into the account menu

**Files:**
- Modify: `tests/navigation-model.test.mjs`
- Modify: `tests/pwa-install.test.mjs`
- Modify: `lib/navigation.js`
- Create: `components/pwa/install-massagelab-dialog.tsx`
- Modify: `components/sidebar/app-sidebar-client.tsx`

**Interfaces:**
- Consumes: `usePwaInstall()` from Task 2 and resolved public `accountMenuRoutes`.
- Produces: one conditional **Install MassageLab** menu action, `/help` as **Help & FAQ**, and `/support` as **Send Feedback** for guests and signed-in users.

- [ ] **Step 1: Update navigation expectations before the model**

Change the account-menu assertions in `tests/navigation-model.test.mjs`:

```js
assert.deepEqual(accountMenuRoutes.map((route) => route.href), [
  "/account",
  "/account?tab=app-settings",
  "/account?tab=security",
  "/help",
  "/support",
  "/legal",
])
assert.deepEqual(accountMenuRoutes.map((route) => route.label), [
  "Account",
  "Settings",
  "Security",
  "Help & FAQ",
  "Send Feedback",
  "Legal",
])
```

Update anonymous and signed-in resolved-route arrays with `/help` before `/support`.

Add source-contract assertions to `tests/pwa-install.test.mjs`:

```js
import { readFileSync } from "node:fs"

it("keeps install conditional and help or feedback public", () => {
  const sidebar = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")
  assert.match(sidebar, /status === "prompt" \|\| status === "instructions"/)
  assert.match(sidebar, /Install MassageLab/)
  assert.match(sidebar, /Help & FAQ/)
  assert.match(sidebar, /Send Feedback/)
})
```

- [ ] **Step 2: Run the tests and confirm missing routes/menu behavior**

Run: `node --test tests/navigation-model.test.mjs tests/pwa-install.test.mjs`

Expected: FAIL because `/help`, the new labels, and account-menu install integration do not exist.

- [ ] **Step 3: Add the public navigation records**

In `lib/navigation.js`, replace `user-support` and insert Help:

```js
{
  id: "help-faq",
  href: "/help",
  label: "Help & FAQ",
  icon: "CircleHelp",
  audiences: allAudiences,
  visibleInSidebar: true,
  groupId: "account",
},
{
  id: "send-feedback",
  href: "/support",
  label: "Send Feedback",
  icon: "MessageSquareText",
  audiences: allAudiences,
  visibleInSidebar: true,
  groupId: "account",
},
```

- [ ] **Step 4: Create the manual-install dialog**

Create `components/pwa/install-massagelab-dialog.tsx` using the existing `Dialog` primitive:

```tsx
"use client"

import Link from "next/link"
import { Download, Share2, SquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function InstallMassageLabDialog({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download aria-hidden="true" />Install MassageLab</DialogTitle>
          <DialogDescription>On iPhone or iPad, Safari installs MassageLab from the Share menu.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3"><Share2 aria-hidden="true" />Open Safari's Share menu.</li>
          <li className="flex gap-3"><SquarePlus aria-hidden="true" />Choose Add to Home Screen.</li>
          <li className="flex gap-3"><Download aria-hidden="true" />Confirm Add.</li>
        </ol>
        <Button asChild variant="secondary">
          <Link href="/help#installing" onClick={() => onOpenChange(false)}>Read installation help</Link>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Refactor `AccountMenu` into auth-specific and common public groups**

In `components/sidebar/app-sidebar-client.tsx`:

```tsx
const { status, requestInstall } = usePwaInstall()
const [installInstructionsOpen, setInstallInstructionsOpen] = React.useState(false)
const installAvailable = status === "prompt" || status === "instructions"
const authRoutes = accountRoutes.filter((route) => ["account", "settings", "account-security"].includes(route.id))
const publicRoutes = accountRoutes.filter((route) => ["help-faq", "send-feedback", "legal"].includes(route.id))

async function handleInstall() {
  const result = await requestInstall()
  closeMobileSidebar()
  if (result === "instructions") setInstallInstructionsOpen(true)
}
```

Add `data-testid="account-menu-trigger"` to the avatar trigger. Render Login/Create Account for guests or `authRoutes` plus Sign out for signed-in users, then render one common group:

```tsx
<DropdownMenuGroup>
  {installAvailable ? (
    <DropdownMenuItem onSelect={() => void handleInstall()}>
      <Download className="mr-2 h-4 w-4" />Install MassageLab
    </DropdownMenuItem>
  ) : null}
  {publicRoutes.map((route) => {
    const Icon = routeIcons[route.icon] ?? CircleHelp
    return (
      <DropdownMenuItem key={route.id} asChild>
        <Link href={route.href} onClick={(event) => navigateFromSidebar(event, route.href)}>
          <Icon className="mr-2 h-4 w-4" />{route.label}
        </Link>
      </DropdownMenuItem>
    )
  })}
</DropdownMenuGroup>
<InstallMassageLabDialog open={installInstructionsOpen} onOpenChange={setInstallInstructionsOpen} />
```

Register `CircleHelp`, `Download`, and `MessageSquareText` in the sidebar icon map. Remove the old `supportRoute` special case so `/support` appears exactly once.

- [ ] **Step 6: Run focused tests and type checking**

Run: `node --test tests/navigation-model.test.mjs tests/pwa-install.test.mjs`

Expected: PASS for both anonymous and signed-in account-menu route sets.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the account-menu slice**

```bash
git add lib/navigation.js components/pwa/install-massagelab-dialog.tsx components/sidebar/app-sidebar-client.tsx tests/navigation-model.test.mjs tests/pwa-install.test.mjs
git commit -m "feat: add install help and feedback menu actions"
```

---

### Task 4: Publish the starter Help & FAQ page

**Files:**
- Modify: `tests/seo.test.mjs`
- Create: `app/help/page.tsx`
- Modify: `lib/seo.js`
- Modify: `tests/browser/public-routes.spec.ts`

**Interfaces:**
- Consumes: existing `AppPageShell`, `AppSurface`, `AppInset`, `Button`, and `createPublicPageMetadata()` patterns.
- Produces: public `/help`, `/help#installing`, and a clear `/support` handoff.

- [ ] **Step 1: Add failing SEO and route-presence assertions**

In `tests/seo.test.mjs`, add `/help` to the expected public route list and assert:

```js
const helpRoute = PUBLIC_SEO_ROUTES.find((route) => route.path === "/help")
assert.deepEqual(helpRoute, {
  path: "/help",
  title: "MassageLab Help & FAQ",
  description: "Learn how to use MassageLab accounts, installation, Clock, Chimer, Music, backgrounds, subscriptions, privacy, and support.",
})
```

In the `publicRoutes` matrix in `tests/browser/public-routes.spec.ts`, add:

```ts
{ path: "/help", expectedText: /Help & FAQ/i },
```

- [ ] **Step 2: Run SEO tests and confirm `/help` is absent**

Run: `node --test tests/seo.test.mjs`

Expected: FAIL because `/help` is not in `PUBLIC_SEO_ROUTES`.

- [ ] **Step 3: Add public SEO metadata**

Insert in `lib/seo.js`:

```js
{
  path: "/help",
  title: "MassageLab Help & FAQ",
  description: "Learn how to use MassageLab accounts, installation, Clock, Chimer, Music, backgrounds, subscriptions, privacy, and support.",
},
```

- [ ] **Step 4: Build the public Help page with honest current-state copy**

Create `app/help/page.tsx` with `metadata = createPublicPageMetadata("/help")` and these topic records:

```tsx
const helpTopics = [
  {
    id: "account-access",
    title: "Account and access",
    body: "Create an account, verify your email, and sign in to save supported preferences and account activity.",
    links: [{ href: "/register", label: "Create Account" }, { href: "/login", label: "Log In" }],
  },
  {
    id: "installing",
    title: "Installing MassageLab",
    body: "Use Install MassageLab from the avatar menu when it appears. On iPhone or iPad in Safari, use Share, Add to Home Screen, then Add.",
    links: [],
  },
  {
    id: "clock-chimer",
    title: "Clock and Chimer",
    body: "Clock provides a standalone room clock. Chimer adds configurable session timing and alerts.",
    links: [{ href: "/clock", label: "Open Clock" }, { href: "/chimer", label: "Open Chimer" }],
  },
  {
    id: "music-backgrounds",
    title: "Music and backgrounds",
    body: "Use Music for generative stations and the available visual backgrounds. Background controls vary by the active tool.",
    links: [{ href: "/music", label: "Open Music" }],
  },
  {
    id: "premium-access",
    title: "Premium backgrounds and subscriptions",
    body: "Subscriptions can unlock supported premium backgrounds. Free background credits and individual background purchases are not available yet.",
    links: [{ href: "/pricing", label: "View Pricing" }, { href: "/account?tab=membership", label: "Account and Billing" }],
  },
  {
    id: "local-first-privacy",
    title: "Local-first privacy",
    body: "Professional records remain in the encrypted browser vault unless MassageLab explicitly says otherwise. Do not send client PHI through support messages.",
    links: [{ href: "/legal", label: "Privacy and Legal" }],
  },
] as const
```

Render the page with this exact structure:

```tsx
export default function HelpPage() {
  return (
    <AppPageShell title="Help & FAQ" width="standard" contentClassName="gap-5">
      {helpTopics.map((topic) => (
        <AppSurface key={topic.id} id={topic.id} title={topic.title} description={topic.body}>
          {topic.links.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topic.links.map((link) => (
                <Button key={link.href} asChild variant="secondary">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </div>
          ) : null}
        </AppSurface>
      ))}
      <AppSurface title="Send feedback or report a problem" description="Use the existing support flow for contact and optional privacy-safe diagnostics.">
        <Button asChild><Link href="/support">Send Feedback or Report a Problem</Link></Button>
      </AppSurface>
    </AppPageShell>
  )
}
```

- [ ] **Step 5: Run SEO and public-page static checks**

Run: `node --test tests/seo.test.mjs tests/navigation-model.test.mjs`

Expected: PASS with `/help` public and present in the account menu.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the public Help slice**

```bash
git add app/help/page.tsx lib/seo.js tests/seo.test.mjs tests/browser/public-routes.spec.ts
git commit -m "feat: add public help and FAQ"
```

---

### Task 5: Add shared active-tool semantics and glow

**Files:**
- Modify: `tests/navigation-model.test.mjs`
- Modify: `tests/app-settings.test.mjs`
- Create: `components/shell/app-tool-link.tsx`
- Modify: `components/calendar/calendar-operator-top-bar.tsx`
- Modify: `components/shell/mobile-main-bar.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `isNavigationRouteActive(pathname, href)`.
- Produces: `AppToolLink({ href, label, icon, showLabel?, className? })` with `data-active` and `aria-current`; `.ml-app-tool-link[data-active="true"]` and `.ml-calendar-drawer-trigger[data-active="true"]` glow hooks.

- [ ] **Step 1: Expand route-family and component-source tests**

Add to `tests/navigation-model.test.mjs`:

```js
it("matches only the approved global tool route families", () => {
  assert.equal(isNavigationRouteActive("/music", "/music"), true)
  assert.equal(isNavigationRouteActive("/music/stations", "/music"), true)
  assert.equal(isNavigationRouteActive("/clock", "/clock"), true)
  assert.equal(isNavigationRouteActive("/clock/presentation", "/clock"), true)
  assert.equal(isNavigationRouteActive("/chimer", "/clock"), false)
  assert.equal(isNavigationRouteActive("/calendar/requests", "/calendar"), true)
})
```

Add to `tests/app-settings.test.mjs`:

```js
it("shares semantic active tool links across desktop and mobile bars", () => {
  const toolLink = readFileSync(new URL("../components/shell/app-tool-link.tsx", import.meta.url), "utf8")
  const topBar = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")
  const mobileBar = readFileSync(new URL("../components/shell/mobile-main-bar.tsx", import.meta.url), "utf8")
  assert.match(toolLink, /isNavigationRouteActive/)
  assert.match(toolLink, /aria-current=\{active \? "page" : undefined\}/)
  assert.match(topBar, /ml-calendar-drawer-trigger/)
  assert.match(mobileBar, /AppToolLink/)
})
```

- [ ] **Step 2: Run focused tests and confirm the component is missing**

Run: `node --test tests/navigation-model.test.mjs tests/app-settings.test.mjs`

Expected: FAIL because `app-tool-link.tsx` does not exist and the bars do not share active semantics.

- [ ] **Step 3: Create the shared linked-tool component**

Create `components/shell/app-tool-link.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isNavigationRouteActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

export function AppToolLink({ href, label, icon: Icon, showLabel = false, className }: {
  href: string
  label: string
  icon: LucideIcon
  showLabel?: boolean
  className?: string
}) {
  const pathname = usePathname() ?? "/"
  const active = isNavigationRouteActive(pathname, href)

  return (
    <Button asChild variant="ctaBlue" size="icon" className={cn("ml-app-tool-link", className)}>
      <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} data-active={active}>
        <Icon aria-hidden="true" />
        {showLabel ? <span>{label}</span> : null}
      </Link>
    </Button>
  )
}
```

- [ ] **Step 4: Replace duplicated Music/Clock/linked Calendar controls**

Use `AppToolLink` for Music and Clock in both bars and Calendar in `MobileMainBar`:

```tsx
<AppToolLink href="/music" label="Open music" icon={Music2} className="h-10 w-10 shrink-0" />
<AppToolLink href="/clock" label="Open clock" icon={Clock} className="h-10 w-10 shrink-0" />
<AppToolLink href="/calendar" label="Open calendar" icon={CalendarDays} showLabel className="ml-main-bar-button" />
```

In `CalendarDrawerButton`, derive `active` from its pathname and add:

```tsx
data-active={isNavigationRouteActive(pathname, "/calendar")}
className="ml-calendar-drawer-trigger relative h-10 w-10 shrink-0"
```

- [ ] **Step 5: Add an active treatment without changing variants**

In `app/globals.css`:

```css
.ml-app-tool-link[data-active="true"],
.ml-calendar-drawer-trigger[data-active="true"] {
  filter: brightness(1.08) saturate(1.08);
  box-shadow:
    0 0 0 2px hsl(var(--primary) / 0.48),
    0 0 1rem hsl(var(--primary) / 0.52),
    var(--ml-button-shadow, 0 2px 6px hsl(var(--foreground) / 0.18));
}

.ml-app-tool-link[data-active="true"]:focus-visible,
.ml-calendar-drawer-trigger[data-active="true"]:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

Do not change `variant="ctaBlue"` on Music, Clock, or Calendar.

- [ ] **Step 6: Run focused tests and type checking**

Run: `node --test tests/navigation-model.test.mjs tests/app-settings.test.mjs`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the active-tool slice**

```bash
git add components/shell/app-tool-link.tsx components/calendar/calendar-operator-top-bar.tsx components/shell/mobile-main-bar.tsx app/globals.css tests/navigation-model.test.mjs tests/app-settings.test.mjs
git commit -m "feat: highlight the active global tool"
```

---

### Task 6: Make the responsive app bar full-width with stable branding

**Files:**
- Modify: `tests/app-settings.test.mjs`
- Create: `components/shell/app-bar-brand-link.tsx`
- Modify: `lib/app-shell.js`
- Modify: `components/providers/settings-provider.tsx`
- Modify: `components/calendar/calendar-operator-top-bar.tsx`
- Modify: `components/shell/mobile-main-bar.tsx`
- Modify: `components/layout-wrapper.tsx`
- Modify: `components/sidebar/app-sidebar-client.tsx`
- Modify: `app/globals.css`
- Modify: `tests/browser/public-routes.spec.ts`

**Interfaces:**
- Consumes: normalized `sidebarPosition` and `appBarPosition` settings, existing brand assets, and Task 5's `AppToolLink`.
- Produces: `resolveMainBarLayout(settings): { drawerEdge, edgeItemIds, toolItemIds }`, `AppBarBrandLink`, document-root `data-app-bar-position`, and `--ml-desktop-app-bar-height`.

- [ ] **Step 1: Replace old Home/More ordering tests with drawer/brand/tool layout tests**

Update the `lib/app-shell.js` import in `tests/app-settings.test.mjs` so it imports `resolveMainBarLayout` and no longer imports `mainBarItemIds` or `resolveMainBarItemOrder`. Then add:

```js
assert.deepEqual(resolveMainBarLayout({ sidebarPosition: "left" }), {
  drawerEdge: "left",
  edgeItemIds: ["more", "brand"],
  toolItemIds: ["music", "clock", "quick-create", "calendar", "theme"],
})
assert.deepEqual(resolveMainBarLayout({ sidebarPosition: "right" }), {
  drawerEdge: "right",
  edgeItemIds: ["brand", "more"],
  toolItemIds: ["theme", "calendar", "quick-create", "clock", "music"],
})
```

Replace the old `SidebarLogoHomeLink` assertion with:

```js
const brand = readFileSync(new URL("../components/shell/app-bar-brand-link.tsx", import.meta.url), "utf8")
const sidebar = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")
assert.match(brand, /aria-label="MassageLab home"/)
assert.match(brand, /massagelab-wordmark-final-20260622\.png/)
assert.match(brand, /massagelab-mark-final-20260622\.png/)
assert.doesNotMatch(sidebar, /function SidebarLogoHomeLink/)
```

- [ ] **Step 2: Run the focused test and confirm the old layout contract fails**

Run: `node --test tests/app-settings.test.mjs`

Expected: FAIL because `resolveMainBarLayout` and `AppBarBrandLink` do not exist.

- [ ] **Step 3: Implement the layout resolver**

Delete `mainBarItemIds`, `leftDrawerMainBarItemIds`, `rightDrawerMainBarItemIds`, and `resolveMainBarItemOrder` from `lib/app-shell.js`, then add:

```js
export function resolveMainBarLayout(value) {
  const settings = normalizeAppSettings(value)
  return settings.sidebarPosition === "right"
    ? {
        drawerEdge: "right",
        edgeItemIds: ["brand", "more"],
        toolItemIds: ["theme", "calendar", "quick-create", "clock", "music"],
      }
    : {
        drawerEdge: "left",
        edgeItemIds: ["more", "brand"],
        toolItemIds: ["music", "clock", "quick-create", "calendar", "theme"],
      }
}
```

Keep `getMusicPlayerPlacement()` returning `"bottom"`.

- [ ] **Step 4: Create one responsive brand home link**

Create `components/shell/app-bar-brand-link.tsx`:

```tsx
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function AppBarBrandLink({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="MassageLab home" className={cn("ml-app-bar-brand", className)} data-testid="app-bar-brand">
      <Image
        src="/brand/massagelab-wordmark-final-20260622.png"
        alt=""
        width={1518}
        height={593}
        className="ml-app-bar-brand-wordmark"
        sizes="144px"
        priority
      />
      <Image
        src="/brand/massagelab-mark-final-20260622.png"
        alt=""
        width={500}
        height={500}
        className="ml-app-bar-brand-mark"
        sizes="36px"
        priority
      />
    </Link>
  )
}
```

- [ ] **Step 5: Reflect app-bar placement on the document root**

In `components/providers/settings-provider.tsx`:

```tsx
export function applyAppBarPositionAttribute(appBarPosition: AppBarPosition) {
  document.documentElement.dataset.appBarPosition = appBarPosition
}

useEffect(() => {
  applyAppBarPositionAttribute(settings.appBarPosition)
}, [settings.appBarPosition])
```

Add this assertion to the settings-provider source test in `tests/app-settings.test.mjs`:

```js
const settingsProvider = readFileSync(new URL("../components/providers/settings-provider.tsx", import.meta.url), "utf8")
assert.match(settingsProvider, /applyAppBarPositionAttribute\(settings\.appBarPosition\)/)
assert.match(settingsProvider, /document\.documentElement\.dataset\.appBarPosition = appBarPosition/)
```

- [ ] **Step 6: Put the drawer and brand together in each bar**

In `CalendarOperatorTopBar`, form one edge cluster:

```tsx
const drawerBrandCluster = (
  <div className="ml-app-bar-drawer-brand flex min-w-0 items-center gap-2">
    {sidebarIsRight ? <AppBarBrandLink /> : sidebarControl}
    {sidebarIsRight ? sidebarControl : <AppBarBrandLink />}
  </div>
)
```

Place that cluster at the drawer-side edge and keep the global actions at the opposite edge:

```tsx
const leadingControl = sidebarIsRight ? oppositeControls : drawerBrandCluster
const trailingControl = sidebarIsRight ? drawerBrandCluster : oppositeControls
```

Remove the old assumption that the sidebar itself owns the visible brand.

In `MobileMainBar`, use `resolveMainBarLayout(settings)`, add `brand` to `itemById`, render `edgeItemIds` together on `drawerEdge`, and render `toolItemIds` in their approved mirrored order:

```tsx
const layout = resolveMainBarLayout(settings)
const quickCreateControl = (
  <Button
    ref={quickCreateButtonRef}
    type="button"
    variant="default"
    size="icon"
    className={cn("ml-main-bar-plus rounded-full", quickActionsOpen && "ml-main-bar-plus-open")}
    data-quick-action-trigger="true"
    aria-label="Open quick actions"
    aria-expanded={quickActionsOpen}
    onClick={() => setQuickActionsOpen((current) => !current)}
  >
    <Plus aria-hidden="true" />
  </Button>
)
const drawerControl = (
  <Button
    type="button"
    variant={resolvedTheme === "dark" ? "glow" : "default"}
    size="icon"
    className="ml-main-bar-button rounded-full"
    aria-label="Open navigation"
    onClick={toggleSidebar}
  >
    <Menu aria-hidden="true" />
    <span>More</span>
  </Button>
)
const itemById = new Map<string, MainBarRenderItem>([
  ["brand", { id: "brand", node: <AppBarBrandLink /> }],
  ["music", { id: "music", node: <AppToolLink href="/music" label="Open music" icon={Music2} showLabel className="ml-main-bar-button" /> }],
  ["clock", { id: "clock", node: <AppToolLink href="/clock" label="Open clock" icon={Clock} showLabel className="ml-main-bar-button" /> }],
  ["quick-create", { id: "quick-create", node: quickCreateControl }],
  ["theme", { id: "theme", node: <ThemeSwitcherMultiButton /> }],
  ["calendar", { id: "calendar", node: <AppToolLink href="/calendar" label="Open calendar" icon={CalendarDays} showLabel className="ml-main-bar-button" /> }],
  ["more", { id: "more", node: drawerControl }],
])

const edgeCluster = (
  <div className="ml-main-bar-drawer-brand" data-drawer-edge={layout.drawerEdge}>
    {layout.edgeItemIds.map((id) => <React.Fragment key={id}>{itemById.get(id)?.node}</React.Fragment>)}
  </div>
)

<nav
  aria-label="MassageLab main navigation"
  data-sidebar-position={settings.sidebarPosition}
  data-app-bar-position={settings.appBarPosition}
  className={cn(
    "ml-mobile-main-bar fixed inset-x-0 z-[10025] bg-background/95 px-1.5 shadow-2xl backdrop-blur md:hidden",
    settings.appBarPosition === "top"
      ? "top-0 border-b border-border/80 pb-0 pt-[var(--ml-safe-top)]"
      : "bottom-0 border-t border-border/80 pb-[var(--ml-safe-bottom)] pt-0",
  )}
>
  <div className="ml-main-bar-layout" data-drawer-edge={layout.drawerEdge}>
    {layout.drawerEdge === "left" ? edgeCluster : null}
    <div className="ml-main-bar-tools">
      {layout.toolItemIds.map((id) => <React.Fragment key={id}>{itemById.get(id)?.node}</React.Fragment>)}
    </div>
    {layout.drawerEdge === "right" ? edgeCluster : null}
  </div>
</nav>
```

The `quickCreateControl` and `drawerControl` constants above preserve the current handlers, variants, labels, and 42px targets.

- [ ] **Step 7: Remove duplicate drawer branding**

Delete `SidebarLogoHomeLink`, both drawer-header wordmark branches, and the now-empty `SidebarHeader` from `components/sidebar/app-sidebar-client.tsx`. The app-bar brand becomes the sole global home-brand focus stop.

- [ ] **Step 8: Measure and fix the desktop bar to the viewport**

In `CalendarOperatorTopBar`, make the header fixed and position it from settings:

```tsx
className={cn(
  "ml-app-topbar fixed inset-x-0 z-[10020] hidden w-screen bg-background/95 shadow-sm backdrop-blur md:block",
  appBarIsBottom ? "bottom-0 border-t border-border/70" : "top-0 border-b border-border/70",
)}
```

Add a dedicated measurement effect:

```tsx
useEffect(() => {
  const header = headerRef.current
  if (!header) return
  const root = document.documentElement
  const publishHeight = () => root.style.setProperty("--ml-desktop-app-bar-height", `${Math.ceil(header.getBoundingClientRect().height)}px`)
  publishHeight()
  const observer = new ResizeObserver(publishHeight)
  observer.observe(header)
  return () => {
    observer.disconnect()
    root.style.removeProperty("--ml-desktop-app-bar-height")
  }
}, [])
```

In `LayoutWrapper`, render `CalendarOperatorTopBar` once rather than conditionally before or after the scroll area. Placement now comes from its fixed class and the root data attribute.

- [ ] **Step 9: Add global offsets, brand collapse, and stack CSS**

Add to `app/globals.css`:

```css
:root { --ml-desktop-app-bar-height: 3.5rem; }

.ml-app-bar-brand {
  display: inline-flex;
  min-width: 2.25rem;
  max-width: 9rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 1;
  overflow: hidden;
  border-radius: 9999px;
}
.ml-app-bar-brand-wordmark { display: block; width: min(9rem, 18vw); height: auto; object-fit: contain; }
.ml-app-bar-brand-mark { display: none; width: 2.25rem; height: 2.25rem; object-fit: contain; }

@media (max-width: 1023px) {
  .ml-app-bar-brand-wordmark { display: none; }
  .ml-app-bar-brand-mark { display: block; }
}

@media (min-width: 768px) {
  html[data-app-bar-position="top"] .ml-app-shell { --ml-page-top-safe: var(--ml-desktop-app-bar-height); }
  html[data-app-bar-position="bottom"] .ml-app-shell {
    --ml-bottom-stack-height: calc(var(--ml-safe-bottom) + var(--ml-desktop-app-bar-height));
    --ml-page-bottom-safe: calc(var(--ml-safe-bottom) + var(--ml-page-edge-gap) + var(--ml-scroll-end-buffer) + var(--ml-desktop-app-bar-height));
  }
  html[data-app-bar-position="top"] [data-sidebar-container="true"] [data-sidebar="sidebar"] {
    top: var(--ml-desktop-app-bar-height);
    height: calc(100svh - var(--ml-desktop-app-bar-height));
  }
  html[data-app-bar-position="bottom"] [data-sidebar-container="true"] [data-sidebar="sidebar"] {
    bottom: var(--ml-desktop-app-bar-height);
    height: calc(100svh - var(--ml-desktop-app-bar-height));
  }
}
```

Update the mobile layout and top/bottom safe offsets:

```css
.ml-main-bar-layout { display: flex; align-items: center; width: 100%; min-height: var(--ml-main-bar-height); }
.ml-main-bar-drawer-brand { display: flex; min-width: 0; flex: 0 1 auto; align-items: center; gap: 0.25rem; }
.ml-main-bar-tools { display: flex; min-width: 0; flex: 1 1 auto; align-items: center; justify-content: space-around; }

@media (max-width: 767px) {
  html[data-app-bar-position="top"] .ml-app-shell[data-main-bar-visible="true"] {
    --ml-page-top-safe: calc(var(--ml-safe-top) + var(--ml-main-bar-height));
    --ml-bottom-stack-height: var(--ml-safe-bottom);
  }
  html[data-app-bar-position="bottom"] .ml-app-shell[data-main-bar-visible="true"] {
    --ml-bottom-stack-height: calc(var(--ml-safe-bottom) + var(--ml-main-bar-height));
    --ml-page-bottom-safe: calc(var(--ml-safe-bottom) + var(--ml-page-edge-gap) + var(--ml-scroll-end-buffer) + var(--ml-main-bar-height));
  }
}
```

Keep the music player bottom-based: a top-position mobile bar contributes to `--ml-page-top-safe`, while a bottom-position bar contributes to `--ml-bottom-stack-height`.

Extend the immersive resets so a hidden fixed bar contributes no desktop top/bottom offset:

```css
body.chimer-running .ml-app-shell,
body.chimer-alerting .ml-app-shell,
body.chimer-preview-capture .ml-app-shell {
  --ml-page-top-safe: 0px;
  --ml-page-bottom-safe: 0px;
  --ml-bottom-stack-height: var(--ml-safe-bottom);
}
```

- [ ] **Step 10: Update the existing public-route shell assertions**

In `tests/browser/public-routes.spec.ts`, replace the old `Home` button lookup with:

```ts
await expect(page.getByRole("link", { name: "MassageLab home" })).toHaveAttribute("href", "/")
```

Keep the Music, Clock, quick-action, theme, Calendar, More, touch-target, blur, and player-stacking assertions.

- [ ] **Step 11: Run focused tests, type checking, and CSS lint**

Run: `node --test tests/app-settings.test.mjs tests/navigation-model.test.mjs`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with focused comments on fixed-bar height publication and layout ordering.

- [ ] **Step 12: Commit the full-width branded shell**

```bash
git add lib/app-shell.js components/shell/app-bar-brand-link.tsx components/providers/settings-provider.tsx components/calendar/calendar-operator-top-bar.tsx components/shell/mobile-main-bar.tsx components/layout-wrapper.tsx components/sidebar/app-sidebar-client.tsx app/globals.css tests/app-settings.test.mjs tests/browser/public-routes.spec.ts
git commit -m "feat: make the app bar full width"
```

---

### Task 7: Prove the integrated shell and record the result

**Files:**
- Create: `tests/browser/app-shell.spec.ts`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**
- Consumes: all Track 5 behavior from Tasks 1-6.
- Produces: browser-level acceptance coverage and current-state documentation.

- [ ] **Step 1: Add focused Playwright acceptance tests**

Create `tests/browser/app-shell.spec.ts` with these cases:

```ts
import { expect, test } from "@playwright/test"

test("anonymous quick actions stay focused and preserve the full-screen overlay", async ({ page }) => {
  await page.goto("/wellness")
  await page.getByRole("button", { name: "Open quick actions" }).click()
  const overlay = page.locator(".ml-quick-action-layer")
  await expect(overlay).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Quick create actions" }).getByRole("link")).toHaveCount(4)
  await expect(page.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/login")
  await expect(page.getByRole("link", { name: "Create Account" })).toHaveAttribute("href", "/register")
  await expect(page.getByRole("link", { name: "Quick Log" })).toHaveAttribute("href", "/wellness#quick-log")
  await expect(page.getByRole("link", { name: "Breathing Guide" })).toHaveAttribute("href", "/wellness/breathing")
  const loginAction = page.getByRole("link", { name: "Log In" })
  const closeAction = page.getByRole("button", { name: "Close quick actions" })
  await expect(loginAction).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(closeAction).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(loginAction).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Open quick actions" })).toBeFocused()
})

test("desktop bar spans the viewport and keeps the brand beside the left drawer control", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "top", sidebarPosition: "left", sidebarTriggerPosition: "top", themeMode: "dark",
  })))
  await page.goto("/music")
  const bar = page.locator(".ml-app-topbar")
  const box = await bar.boundingBox()
  expect(box?.x).toBeLessThanOrEqual(1)
  expect(box?.width).toBeGreaterThanOrEqual(1278)
  await expect(page.getByRole("link", { name: "Open music" }).first()).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("link", { name: "Open clock" }).first()).not.toHaveAttribute("aria-current", "page")
})

test("account menu launches a captured install prompt and keeps help or feedback available", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("account-menu-trigger").waitFor()
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: "dismissed"; platform: string }>
    }
    event.prompt = async () => { document.documentElement.dataset.installPromptCalled = "true" }
    event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" })
    window.dispatchEvent(event)
  })
  await page.getByTestId("account-menu-trigger").click()
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Send Feedback" })).toBeVisible()
  await page.getByRole("menuitem", { name: "Install MassageLab" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt-called", "true")
  await page.getByTestId("account-menu-trigger").click()
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
})

test("account menu hides install when already installed", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = (query) => query === "(display-mode: standalone)"
      ? ({ matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true } as MediaQueryList)
      : original(query)
  })
  await page.goto("/")
  await page.getByTestId("account-menu-trigger").click()
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Send Feedback" })).toBeVisible()
})

test("account menu hides install on an unsupported browser", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("account-menu-trigger").click()
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Send Feedback" })).toBeVisible()
})

test("failed install prompt stays hidden after the failed attempt", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: "dismissed"; platform: string }>
    }
    event.prompt = async () => { throw new Error("prompt failed") }
    event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" })
    window.dispatchEvent(event)
  })
  await page.getByTestId("account-menu-trigger").click()
  await page.getByRole("menuitem", { name: "Install MassageLab" }).click()
  await page.getByTestId("account-menu-trigger").click()
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
})

test("help routes installation and problem reports without claiming commerce is live", async ({ page }) => {
  await page.goto("/help")
  await expect(page.getByRole("heading", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.locator("#installing")).toBeVisible()
  await expect(page.getByText(/credits and individual purchases are not available yet/i)).toBeVisible()
  await expect(page.getByRole("link", { name: "Send Feedback or Report a Problem" })).toHaveAttribute("href", "/support")
})

test("recognized iOS Safari receives manual install instructions", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperties(navigator, {
      userAgent: { value: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", configurable: true },
      platform: { value: "iPhone", configurable: true },
      maxTouchPoints: { value: 5, configurable: true },
    })
  })
  await page.goto("/")
  await page.getByTestId("account-menu-trigger").click()
  await page.getByRole("menuitem", { name: "Install MassageLab" }).click()
  await expect(page.getByRole("dialog", { name: "Install MassageLab" })).toContainText("Add to Home Screen")
  await expect(page.getByRole("link", { name: "Read installation help" })).toHaveAttribute("href", "/help#installing")
})
```

Add these right-drawer and narrow-mobile cases:

```ts
test("right drawer keeps the drawer and brand at the right edge", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom", sidebarPosition: "right", sidebarTriggerPosition: "bottom", themeMode: "dark",
  })))
  await page.goto("/")
  const cluster = page.locator(".ml-app-topbar .ml-app-bar-drawer-brand")
  const box = await cluster.boundingBox()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThanOrEqual(1278)
})

test("narrow mobile keeps every tool and collapses only the wordmark", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/music")
  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  await expect(bar.locator(".ml-app-bar-brand-mark")).toBeVisible()
  await expect(bar.locator(".ml-app-bar-brand-wordmark")).toBeHidden()
  for (const name of ["Open music", "Open clock", "Open quick actions", "Open calendar", "Theme"]) {
    await expect(bar.getByLabel(name)).toBeVisible()
  }
  await expect(bar.getByRole("link", { name: "Open music" })).toHaveAttribute("aria-current", "page")
})

test("mobile top placement reserves the top edge and leaves music bottom-based", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "top", sidebarPosition: "left", sidebarTriggerPosition: "top", themeMode: "dark",
  })))
  await page.goto("/music")
  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const box = await bar.boundingBox()
  expect(box?.y).toBeLessThanOrEqual(1)
  const player = page.locator(".ml-music-player-toolbar")
  if (await player.isVisible()) {
    const playerBox = await player.boundingBox()
    expect((playerBox?.y ?? 0) + (playerBox?.height ?? 0)).toBeGreaterThan(700)
  }
})
```

- [ ] **Step 2: Run the focused browser tests**

Run: `npm run build`

Expected: PASS.

Run: `npm run test:browser -- tests/browser/app-shell.spec.ts --project=desktop-chromium`

Expected: PASS.

Run: `npm run test:browser -- tests/browser/app-shell.spec.ts --project=mobile-chromium`

Expected: PASS.

- [ ] **Step 3: Run the existing public shell regression selection**

Run: `npm run test:browser -- tests/browser/public-routes.spec.ts -g "public route /help|main bar|quick actions|music player"`

Expected: PASS with no uncaught page errors, console errors, local 4xx/5xx responses, or anonymous account-sync requests.

- [ ] **Step 4: Perform the manual responsive matrix**

Verify in the rendered app:

- 390px phone portrait and phone landscape.
- Tablet portrait and landscape.
- 1280px desktop with left/top, left/bottom, right/top, and right/bottom settings.
- Drawer closed, expanded, collapsed, and mobile-open states.
- Wordmark-to-mark collapse before any tool disappears.
- Music player expanded and collapsed with the bar at top and bottom.
- Light, dark, and system themes.
- Keyboard-only quick actions, account menu, install instructions, Help links, Escape, backdrop close, and focus return.
- Installed display mode hides Install; unsupported desktop without a captured prompt hides Install.

Expected: no covered controls, duplicated home-brand focus stops, stale active glow, unsafe-area overlap, or incorrect install success state.

- [ ] **Step 5: Update current-state documentation after the behavior is proven**

In `docs/project-state.md`, set `Verified: 2026-07-17` and add this sentence to the **Public app shell** bullet:

```markdown
The global app bar now spans the viewport, keeps its drawer control in the configured-side corner with the responsive MassageLab home brand immediately medial, preserves tool variants while glowing the current route, focuses anonymous quick actions on account access and Wellness, and exposes conditional PWA installation plus public Help and privacy-safe feedback from the account menu.
```

At the top of `docs/project-log.md`, append a dated entry:

```markdown
## 2026-07-17 — Full-width app shell, installation, and Help

- Extended the configured top or bottom app bar across the viewport and kept its responsive home brand beside the configured drawer edge.
- Added semantic active-route glow without changing inactive Music, Clock, or Calendar variants.
- Focused signed-out quick actions on Log In, Create Account, Quick Log, and Breathing Guide while preserving signed-in role/customization resolution.
- Added explicit PWA install prompting, iOS/iPadOS Safari instructions, installed/unsupported hiding, public `/help`, and the existing `/support` feedback handoff.
- Validation: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, focused desktop/mobile Playwright shell tests, and `git diff --check` passed.
```

- [ ] **Step 6: Run the complete validation gate**

Run: `npm run lint`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

Run: `git status --short`

Expected: only the Track 5 implementation and documentation files are modified; the user's pre-existing `TODO.md` edit remains unstaged and untouched.

- [ ] **Step 7: Commit the acceptance and documentation slice**

```bash
git add tests/browser/app-shell.spec.ts docs/project-state.md docs/project-log.md
git commit -m "test: verify app shell install and help flow"
```

- [ ] **Step 8: Review the branch as one deliverable**

Run: `git log --oneline --decorate -8`

Expected: focused commits for quick actions, install state, account menu, Help, active tool state, full-width branding, and final acceptance.

Run: `git diff main...HEAD --stat`

Expected: only Track 5 files from this plan plus its approved spec/plan documents; no premium-background, Clock/Chimer settings, carousel, commerce, or Roadmap implementation files.
