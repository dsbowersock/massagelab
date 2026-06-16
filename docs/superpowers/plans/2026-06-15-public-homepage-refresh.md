# Public Homepage Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public homepage refresh from the approved design spec: role-spanning hero with restrained Flip Words behavior, product proof lanes, optional action router, account value section, and bottom available-tools catalog.

**Architecture:** Keep `/` as a server-rendered Next.js App Router page so session-aware CTAs stay simple and no account data is fetched on anonymous visits. Add one small client component for the animated hero word, using local CSS and `matchMedia("(prefers-reduced-motion: reduce)")` instead of adding a motion dependency. Keep homepage content data in `app/page.tsx` for this branch because the page is the only consumer.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v3 utility classes, existing `AppPageShell`/`AppSurface` primitives, lucide-react icons, Playwright browser tests.

---

## Scope

This plan implements only the public homepage branch from `docs/superpowers/specs/2026-06-15-homepage-and-onboarding-design.md`. It does not add the post-account onboarding flow, onboarding persistence, role-specific account data, or editable signed-in widgets. Those need a separate implementation plan because they touch account state, verification, and signed-in routing.

## File Structure

- Create: `components/home/flip-words.tsx`
  - Small client component with Aceternity-style `words`, `duration`, and `className` props.
  - Owns interval timing and reduced-motion behavior.
- Modify: `app/globals.css`
  - Add one `ml-flip-word-in` keyframe used by the homepage word animation.
  - Extend existing reduced-motion media query to disable the flip-word keyframe.
- Modify: `app/page.tsx`
  - Replace the current tool-grid-first homepage with the approved public page structure.
  - Keep `getCurrentSession()` and route anonymous practice organization to `/register?callbackUrl=%2Fcalendar`.
  - Keep all copy aligned with local-first PHI boundaries.
- Modify: `tests/browser/public-routes.spec.ts`
  - Add focused anonymous homepage tests for the hero, optional router, available-tools catalog, no forbidden account calls, and reduced-motion stability.
- Modify: `docs/project-log.md`
  - Add a dated implementation note after the branch lands.
- Modify: `docs/project-state.md`
  - Refresh the Website And Tool Surface bullet only if the implemented homepage materially changes the current public surface description.

## Task 1: Add Failing Browser Coverage For The Homepage Contract

**Files:**
- Modify: `tests/browser/public-routes.spec.ts`

- [ ] **Step 1: Add homepage refresh browser tests**

Append these tests after the `for (const route of publicRoutes)` route-smoke loop and before the flashcards-specific tests:

```ts
test("anonymous homepage presents the optional action router and available tools catalog", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/", { waitUntil: "domcontentloaded" })

  await expect(page.getByTestId("home-brand-wordmark")).toBeVisible()
  await expect(page.getByRole("heading", { name: /MassageLab helps/i })).toBeVisible()
  await expect(page.getByTestId("home-flip-word")).toBeVisible()
  await expect(page.getByRole("link", { name: /^Create a free account$/i }).first()).toHaveAttribute("href", "/register")
  await expect(page.getByRole("link", { name: /^Explore tools$/i }).first()).toHaveAttribute("href", "#available-tools")

  await expect(page.getByRole("heading", { name: "What are you here for today?" })).toBeVisible()
  await expect(page.getByRole("link", { name: /Study anatomy/i })).toHaveAttribute("href", "/education/flashcards")
  await expect(page.getByRole("link", { name: /Teach or play/i })).toHaveAttribute("href", "/anatomime")
  await expect(page.getByRole("link", { name: /Run a session/i })).toHaveAttribute("href", "/chimer")
  await expect(page.getByRole("link", { name: /Organize a practice/i })).toHaveAttribute("href", "/register?callbackUrl=%2Fcalendar")
  await expect(page.getByRole("link", { name: /Document locally/i })).toHaveAttribute("href", "/notes")
  await expect(page.getByRole("link", { name: /Just exploring/i })).toHaveAttribute("href", "#available-tools")

  await expect(page.getByRole("heading", { name: "Available tools" })).toBeVisible()
  for (const name of [
    "Chimer",
    "Education flashcards",
    "Anatomime",
    "Local-first notes",
    "Calendar and booking",
    "Account and memberships",
    "Roadmap and support",
  ]) {
    await expect(page.getByText(name).first()).toBeVisible()
  }

  await expect(page.getByRole("link", { name: /Open Chimer/i })).toHaveAttribute("href", "/chimer")
  await expect(page.getByRole("link", { name: /Study flashcards/i })).toHaveAttribute("href", "/education/flashcards")
  await expect(page.getByRole("link", { name: /Play Anatomime/i })).toHaveAttribute("href", "/anatomime")
  await expect(page.getByRole("link", { name: /Open notes/i })).toHaveAttribute("href", "/notes")
  await expect(page.getByRole("link", { name: /Open calendar/i }).last()).toHaveAttribute("href", "/calendar")
  await expect(page.getByRole("link", { name: /^Create account$/i })).toHaveAttribute("href", "/register")
  await expect(page.getByRole("link", { name: /Open roadmap/i })).toHaveAttribute("href", "/roadmap")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("homepage flip words stay stable when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const health = capturePageHealth(page)

  await page.goto("/", { waitUntil: "domcontentloaded" })

  const flipWord = page.getByTestId("home-flip-word")
  await expect(flipWord).toBeVisible()
  const firstWord = await flipWord.textContent()
  await page.waitForTimeout(3_500)
  await expect(flipWord).toHaveText(firstWord ?? "")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})
```

- [ ] **Step 2: Run the focused browser tests and verify they fail**

Run:

```powershell
npm run test:browser -- --grep "homepage"
```

Expected result before implementation:

```text
FAIL anonymous homepage presents the optional action router and available tools catalog
Expected role heading named /MassageLab helps/i to be visible
```

The exact Playwright line number can differ, but the failure must be caused by missing homepage refresh UI rather than a server startup failure.

## Task 2: Add The Local Flip Words Component

**Files:**
- Create: `components/home/flip-words.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Create `components/home/flip-words.tsx`**

Use this complete component:

```tsx
"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(query.matches)

    const updatePreference = () => setPrefersReducedMotion(query.matches)
    query.addEventListener("change", updatePreference)
    return () => query.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

export function FlipWords({
  words,
  duration = 3000,
  className,
}: {
  words: string[]
  duration?: number
  className?: string
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const safeWords = words.length > 0 ? words : [""]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion || safeWords.length <= 1) return undefined

    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeWords.length)
    }, duration)

    return () => window.clearInterval(intervalId)
  }, [duration, prefersReducedMotion, safeWords.length])

  const word = safeWords[index] ?? safeWords[0]

  return (
    <span
      key={prefersReducedMotion ? "reduced-motion" : word}
      data-testid="home-flip-word"
      className={cn(
        "inline-flex min-w-[8.5ch] justify-center text-primary motion-reduce:min-w-0",
        !prefersReducedMotion && "animate-[ml-flip-word-in_280ms_ease-out]",
        className,
      )}
    >
      {word}
    </span>
  )
}
```

- [ ] **Step 2: Add the flip-word keyframe to `app/globals.css`**

Add this keyframe near the existing homepage/global keyframes, after `@keyframes ml-route-wordmark-settle`:

```css
@keyframes ml-flip-word-in {
  from {
    opacity: 0;
    transform: translateY(0.4rem);
    filter: blur(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}
```

Then add this selector inside the existing `@media (prefers-reduced-motion: reduce)` block:

```css
  [data-testid="home-flip-word"] {
    animation: none;
  }
```

- [ ] **Step 3: Run static validation for the new component**

Run:

```powershell
npm run typecheck
```

Expected result:

```text
Exit code 0
```

If TypeScript reports that `query.addEventListener` is unavailable, replace the listener block with this compatibility code:

```tsx
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", updatePreference)
      return () => query.removeEventListener("change", updatePreference)
    }

    query.addListener(updatePreference)
    return () => query.removeListener(updatePreference)
```

Do not commit yet; the homepage tests still fail until the page consumes the component.

## Task 3: Rewrite The Public Homepage Sections

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace imports in `app/page.tsx`**

Use this import block:

```tsx
import Link from "next/link"
import Image from "next/image"
import {
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  Compass,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react"
import { getCurrentSession } from "@/auth"
import { FlipWords } from "@/components/home/flip-words"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
```

- [ ] **Step 2: Replace the current `tools` array with homepage content arrays**

Use this code above `export default async function Home()`:

```tsx
const flipWords = ["therapists", "students", "educators", "clients", "curious people"]

const proofLanes = [
  {
    title: "Learn anatomy with sourced prompts",
    description: "Build public flashcard decks from reviewed anatomy records, then save progress when you create an account.",
    href: "/education/flashcards",
    action: "Study flashcards",
    icon: BookOpen,
    badge: "Public study",
  },
  {
    title: "Teach with a room code",
    description: "Run Anatomime as a classroom game with reusable room codes, team turns, and shared review.",
    href: "/anatomime",
    action: "Open Anatomime",
    icon: Brain,
    badge: "Classroom play",
  },
  {
    title: "Keep session pacing simple",
    description: "Use Chimer for treatment-room intervals, clock mode, and practical timing without setup friction.",
    href: "/chimer",
    action: "Start Chimer",
    icon: Timer,
    badge: "Alpha ready",
  },
  {
    title: "Document under local control",
    description: "SOAP, intake, journal, and ROM tools stay local-first while hosted clinical sync remains gated.",
    href: "/notes",
    action: "Review notes",
    icon: ShieldCheck,
    badge: "Local-first",
  },
  {
    title: "Organize care workflows",
    description: "Calendar, booking, waitlist, service settings, and provider capacity tools are ready for small-practice shaping.",
    href: "/calendar",
    action: "Open calendar",
    icon: CalendarDays,
    badge: "Signed-in",
  },
  {
    title: "Support the careful roadmap",
    description: "Memberships fund education, practice workflows, security, and the compliance groundwork required before hosted clinical sync.",
    href: "/pricing",
    action: "View pricing",
    icon: HeartHandshake,
    badge: "Memberships",
  },
] as const

const availableTools = [
  {
    title: "Chimer",
    description: "Treatment-room timer, interval pacing, and clock mode.",
    href: "/chimer",
    action: "Open Chimer",
    icon: Timer,
    status: "Public",
  },
  {
    title: "Education flashcards",
    description: "Sourced anatomy study with public decks and signed-in progress.",
    href: "/education/flashcards",
    action: "Study flashcards",
    icon: BookOpen,
    status: "Public + signed-in progress",
  },
  {
    title: "Anatomime",
    description: "Solo and shared classroom anatomy play with room codes.",
    href: "/anatomime",
    action: "Play Anatomime",
    icon: Brain,
    status: "Public",
  },
  {
    title: "Local-first notes",
    description: "SOAP, intake, journal, and ROM tools with encrypted browser-vault boundaries.",
    href: "/notes",
    action: "Open notes",
    icon: ClipboardList,
    status: "Membership + local-first",
  },
  {
    title: "Calendar and booking",
    description: "Scheduling, availability, booking settings, public links, waitlist, and capacity controls.",
    href: "/calendar",
    action: "Open calendar",
    icon: CalendarDays,
    status: "Signed-in",
  },
  {
    title: "Account and memberships",
    description: "Safe preferences, profile defaults, role verification, pricing, checkout, and billing portal.",
    href: "/account",
    action: "Open account",
    icon: UserRound,
    status: "Signed-in",
  },
  {
    title: "Roadmap and support",
    description: "Public roadmap, support links, and funding context for future careful infrastructure.",
    href: "/roadmap",
    action: "Open roadmap",
    icon: Compass,
    status: "Public",
  },
] as const
```

- [ ] **Step 3: Add the session-aware router data inside `Home()`**

Inside `Home()`, immediately after `const session = await getCurrentSession()`, add:

```tsx
  const signedIn = Boolean(session?.user?.id)
  const primaryAccountHref = signedIn ? "/account" : "/register"
  const practiceHref = signedIn ? "/calendar" : "/register?callbackUrl=%2Fcalendar"
  const accountToolHref = signedIn ? "/account" : "/register"
  const membershipHref = signedIn ? "/account?tab=membership" : "/pricing"

  const actionRouter = [
    {
      title: "Study anatomy",
      description: "Build a deck, try public prompts, and save mastery once signed in.",
      href: "/education/flashcards",
      icon: GraduationCap,
    },
    {
      title: "Teach or play",
      description: "Start Anatomime for solo review or shared classroom play.",
      href: "/anatomime",
      icon: Brain,
    },
    {
      title: "Run a session",
      description: "Open a practical treatment-room timer without account setup.",
      href: "/chimer",
      icon: Timer,
    },
    {
      title: "Organize a practice",
      description: signedIn ? "Go to your calendar workspace." : "Create an account first, then continue to the calendar workspace.",
      href: practiceHref,
      icon: CalendarDays,
    },
    {
      title: "Document locally",
      description: "Review local-first notes, intake, journal, and ROM boundaries.",
      href: "/notes",
      icon: LockKeyhole,
    },
    {
      title: "Just exploring",
      description: "Jump to the catalog of what is currently available.",
      href: "#available-tools",
      icon: Route,
    },
  ] as const
```

- [ ] **Step 4: Replace the return JSX in `Home()`**

Replace everything from `return (` through the matching closing `)` with this JSX:

```tsx
  return (
    <AppPageShell width="full" contentClassName="gap-8">
      <section className="grid gap-8 py-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.55fr)] lg:items-center lg:py-8">
        <div className="min-w-0">
          <h1 className="sr-only">MassageLab</h1>
          <div aria-hidden="true" className="relative mb-5 flex w-full justify-start py-3 sm:py-4">
            <div className="absolute inset-x-0 top-1/2 h-16 -translate-y-1/2 rounded-full bg-brand-orange-glow/20 blur-3xl sm:inset-x-10" />
            <span className="ml-brand-asset-frame relative inline-flex max-w-full rounded-2xl">
              <Image
                src="/brand/massagelab-wordmark-uppercase-tight-20260522.png"
                alt=""
                width={360}
                height={108}
                className="relative h-auto w-full max-w-[28rem] object-contain"
                data-testid="home-brand-wordmark"
                style={{ viewTransitionName: "massagelab-wordmark" }}
                sizes="(max-width: 640px) 82vw, 448px"
                loading="eager"
                priority
              />
            </span>
          </div>

          <h2 className="max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
            MassageLab helps <FlipWords words={flipWords} className="align-baseline" /> make anatomy, care, and practice tools more useful.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Study anatomy, teach with games, pace treatment-room sessions, organize care, and keep professional records local-first while MassageLab grows carefully toward funded, reviewed infrastructure.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-primary hover:bg-brand-orange-glow">
              <Link href={primaryAccountHref}>{signedIn ? "Open your account" : "Create a free account"}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#available-tools">Explore tools</Link>
            </Button>
          </div>
        </div>

        <AppSurface
          title="Independence first"
          description="The public tools stay usable without a forced first-visit questionnaire. Sign in when you want saved progress, safe preferences, profile defaults, or memberships."
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        >
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-md border border-primary/30 bg-background/60 p-3">
              <p className="font-medium text-foreground">No forced public onboarding</p>
              <p className="mt-1">Visitors can inspect and use the public surfaces first.</p>
            </div>
            <div className="rounded-md border border-primary/30 bg-background/60 p-3">
              <p className="font-medium text-foreground">Account setup happens after signup</p>
              <p className="mt-1">Role questions can become useful setup instead of a gate.</p>
            </div>
          </div>
        </AppSurface>
      </section>

      <section aria-labelledby="home-proof-heading" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Useful before the pitch</p>
            <h2 id="home-proof-heading" className="text-2xl font-semibold sm:text-3xl">Concrete tools for different reasons to visit</h2>
          </div>
          <Button asChild variant="outline">
            <Link href={membershipHref}>{signedIn ? "Review membership" : "See pricing"}</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proofLanes.map((lane) => {
            const Icon = lane.icon
            return (
              <AppSurface
                key={lane.title}
                title={lane.title}
                description={lane.description}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                badge={lane.badge}
              >
                <Button asChild variant="outline" className="w-full">
                  <Link href={lane.href}>{lane.action}</Link>
                </Button>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <AppSurface
        title="What are you here for today?"
        description="Pick a path if you want a shortcut. This does not save a role or start onboarding."
        icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />}
        contentClassName="gap-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {actionRouter.map((item) => {
            const Icon = item.icon
            return (
              <Button key={item.title} asChild variant="outline" className="h-auto justify-start whitespace-normal border-border/80 bg-background/70 p-4 text-left hover:border-primary/60 hover:bg-accent">
                <Link href={item.href}>
                  <span className="flex min-w-0 items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{item.title}</span>
                      <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">{item.description}</span>
                    </span>
                  </span>
                </Link>
              </Button>
            )
          })}
        </div>
      </AppSurface>

      <AppSurface contentClassName="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-start gap-3">
          <UserRound className="mt-1 h-5 w-5 shrink-0 text-brand-orange" />
          <div>
            <h2 className="text-xl font-semibold">A free account makes the useful parts portable</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Save safe preferences, flashcard progress, deck templates, and profile defaults. Memberships help fund education features, practice workflows, security work, and the compliance groundwork required before any hosted clinical sync.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <Button asChild className="bg-primary hover:bg-brand-orange-glow">
            <Link href={primaryAccountHref}>{signedIn ? "Open account" : "Create a free account"}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={membershipHref}>{signedIn ? "View membership" : "View pricing"}</Link>
          </Button>
        </div>
      </AppSurface>

      <section id="available-tools" aria-labelledby="available-tools-heading" className="scroll-mt-20 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Available now</p>
            <h2 id="available-tools-heading" className="text-2xl font-semibold sm:text-3xl">Available tools</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            The catalog stays explicit so visitors can inspect what exists today before deciding whether to create an account.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availableTools.map((tool) => {
            const Icon = tool.icon
            const href = tool.title === "Account and memberships" ? accountToolHref : tool.href
            const action = tool.title === "Account and memberships" && !signedIn ? "Create account" : tool.action
            return (
              <AppSurface
                key={tool.title}
                title={tool.title}
                description={tool.description}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                badge={tool.status}
              >
                <Button asChild variant="outline" className="w-full">
                  <Link href={href}>{action}</Link>
                </Button>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AppSurface
          title="Local-first clinical boundary"
          description={
            <>
              MassageLab does not host notes, journals, intake forms, ROM sessions, or treatment details in this alpha. Exported files stay under user control.
            </>
          }
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        />

        <AppSurface
          title="Support compliant sync groundwork"
          description={
            <>
              Memberships and donations help fund HIPAA-capable infrastructure planning, BAAs, audit logging, security review, and future cross-device clinical sync gates.
            </>
          }
          icon={<HeartHandshake className="h-5 w-5" aria-hidden="true" />}
        >
          <Button asChild variant="outline">
            <Link href="/roadmap">Open roadmap</Link>
          </Button>
        </AppSurface>
      </section>
    </AppPageShell>
  )
```

- [ ] **Step 5: Run the focused browser tests**

Run:

```powershell
npm run test:browser -- --grep "homepage"
```

Expected result:

```text
2 passed
```

- [ ] **Step 6: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected result:

```text
Exit code 0
```

- [ ] **Step 7: Commit the passing homepage implementation**

Run:

```powershell
git add app/page.tsx app/globals.css components/home/flip-words.tsx tests/browser/public-routes.spec.ts
git commit -m "Refresh public homepage"
```

Expected result:

```text
[branch-name <sha>] Refresh public homepage
```

## Task 4: Add Completion Documentation

**Files:**
- Modify: `docs/project-log.md`
- Modify: `docs/project-state.md` only if the current Website And Tool Surface snapshot needs the homepage refresh named explicitly.

- [ ] **Step 1: Add the project-log entry**

In `docs/project-log.md`, add this bullet under the `### 2026-06-15` section. If that date section is absent in the checkout used for implementation, create it above `### 2026-06-14` or above the most recent older date section:

```md
- Refreshed the public homepage into a product-proof entry point: the hero now communicates multi-role usefulness with a restrained Flip Words-style role accent, anonymous visitors get an optional action router without saved onboarding data, account value is framed around safe preferences/progress/profile defaults, and the bottom of the page lists the available tools with current routes and availability labels.
```

- [ ] **Step 2: Update project-state only when the public surface summary is stale**

If `docs/project-state.md` still describes the homepage only as a generic public app shell, update the `Website And Tool Surface` bullet from:

```md
- Public app shell: home, support, pricing, public roadmap, about, login/register, password reset, and email verification.
```

to:

```md
- Public app shell: refreshed role-spanning home page with optional anonymous tool router and available-tools catalog, support, pricing, public roadmap, about, login/register, password reset, and email verification.
```

Do not alter current focus, database state, or unrelated priorities.

- [ ] **Step 3: Run documentation diff checks**

Run:

```powershell
git diff --check
git diff --stat
```

Expected result:

```text
git diff --check exits 0
git diff --stat shows only homepage, test, and doc files for this branch
```

- [ ] **Step 4: Commit documentation**

Run:

```powershell
git add docs/project-log.md docs/project-state.md
git commit -m "Document homepage refresh"
```

Expected result:

```text
[branch-name <sha>] Document homepage refresh
```

If `docs/project-state.md` did not need a change, omit it from the `git add` command:

```powershell
git add docs/project-log.md
git commit -m "Document homepage refresh"
```

## Task 5: Final Validation And Branch Readiness

**Files:**
- No planned file edits.

- [ ] **Step 1: Run lint**

Run:

```powershell
npm run lint
```

Expected result:

```text
Exit code 0
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected result:

```text
Exit code 0
```

- [ ] **Step 3: Run full browser route smoke coverage**

Run:

```powershell
npm run test:browser -- --grep "anonymous public route|homepage"
```

Expected result:

```text
All matching public route and homepage tests pass
```

- [ ] **Step 4: Run the production build**

Run:

```powershell
npm run build
```

Expected result:

```text
Exit code 0
```

- [ ] **Step 5: Inspect the final diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected result:

```text
git status --short shows no unstaged changes after final commits, or only intentional uncommitted branch work if the implementer is preparing a PR without committing final docs
git diff --stat is empty after committed work
```

- [ ] **Step 6: Record final evidence in the handoff**

The final handoff should list:

```md
Implemented:
- Public homepage hero with local Flip Words-style role accent.
- Optional anonymous action router.
- Account value section.
- Bottom available-tools catalog.
- Browser tests for homepage router/catalog and reduced-motion stability.
- Project docs updated.

Validation:
- npm run lint
- npm run typecheck
- npm run test:browser -- --grep "anonymous public route|homepage"
- npm run build
```

## Spec Coverage Review

- Hero with Flip Words behavior: Task 2 and Task 3.
- Reduced motion fallback: Task 1 and Task 2.
- Product proof lanes: Task 3.
- Optional action router without saved onboarding data: Task 1 and Task 3.
- Anonymous practice routing to account creation: Task 1 and Task 3.
- Account value copy without hosted clinical overpromise: Task 3.
- Bottom available-tools catalog: Task 1 and Task 3.
- PHI/local-first boundary copy: Task 3 and Task 4.
- Responsive current visual system fit: Task 3 plus browser route smoke coverage in Task 5.
