# Public Roadmap Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale public Roadmap with a timeless, equally weighted five-track product portfolio that distinguishes current capabilities from long-term direction and treats privacy and compliance as shared foundations.

**Architecture:** Keep `/roadmap` as a static Next.js App Router page backed by a local typed-inferred content array and existing shared MassageLab surfaces. Verify the public copy and metadata with a focused Node source-contract test, verify rendered semantics and links with the existing Playwright public-route suite, and then mirror the completed change into the canonical project state and log.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, shared `AppPageShell`/`AppSurface`/`AppInset` and `Button` components, Lucide React, Node test runner, Playwright.

## Global Constraints

- The public Roadmap is a durable product-vision page, not a changelog, sprint board, prioritized backlog, or delivery schedule.
- Use five equally weighted tracks: Education & Anatomy, Wellness Tools, Therapist & Practice Tools, Local-First Records, and Audio & Ambient Experiences.
- Every track must contain Purpose, Available now, Long-term direction, and representative capabilities.
- Do not add dates, phases, percentages, delivery windows, priority rankings, or delivery promises.
- Treat privacy, accessibility, informed consent, user control, local-first professional records, and hosted-data readiness gates as one foundation across all tracks.
- Keep Explore tools at `/tools`, View memberships at `/pricing`, and Donate at `/pricing#donate`.
- Retain the stable `/roadmap` route and use the existing MassageLab visual system.
- Add no backend, database, entitlement, CMS, API, dependency, or account-specific state.
- Do not rewrite `docs/roadmap.md`; it remains historical source evidence rather than canonical current state.
- Leave the unrelated working-tree change in `TODO.md` untouched and unstaged.

## File Map

- Create `tests/roadmap-page.test.mjs`: focused source and SEO contract for the public Roadmap.
- Modify `app/roadmap/page.tsx`: static five-track content model and the complete public page composition.
- Modify `lib/seo.js`: timeless `/roadmap` metadata description.
- Modify `tests/browser/public-routes.spec.ts`: rendered public-route, semantics, link, and stale-copy regression coverage.
- Modify `docs/project-state.md`: current public-shell snapshot after the page ships.
- Modify `docs/project-log.md`: chronological completion entry.

---

### Task 1: Build and verify the timeless public Roadmap

**Files:**
- Create: `tests/roadmap-page.test.mjs`
- Modify: `app/roadmap/page.tsx:1-227`
- Modify: `lib/seo.js:98-102`
- Modify: `tests/browser/public-routes.spec.ts:468`

**Interfaces:**
- Consumes: `createPublicPageMetadata("/roadmap")`, `AppPageShell`, `AppSurface`, `AppInset`, `appCalloutClassName`, shared `Button`, and the existing `/tools`, `/pricing`, and `/pricing#donate` routes.
- Produces: a static `productTracks` array whose entries expose `title`, `purpose`, `availableNow`, `longTermDirection`, `capabilities`, and `icon`; an accessible `/roadmap` document with labeled `Shared foundation` and `Product portfolio` regions; and timeless Roadmap SEO metadata.

- [ ] **Step 1: Add the failing source and SEO contract test**

Create `tests/roadmap-page.test.mjs` with:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { PUBLIC_SEO_ROUTES } from "../lib/seo.js"

function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

describe("public Roadmap page", () => {
  it("presents five equal product tracks with current and long-term outcomes", () => {
    const source = readProjectFile("app/roadmap/page.tsx")
    const trackTitles = [
      "Education & Anatomy",
      "Wellness Tools",
      "Therapist & Practice Tools",
      "Local-First Records",
      "Audio & Ambient Experiences",
    ]

    for (const title of trackTitles) {
      assert.equal(source.includes(title), true)
    }

    assert.equal(source.match(/availableNow:/g)?.length, 5)
    assert.equal(source.match(/longTermDirection:/g)?.length, 5)
    assert.equal(source.match(/capabilities:/g)?.length, 5)
    assert.match(source, /not a release order/i)
    assert.match(source, /Shared foundation/)
    assert.match(source, /local-first/i)
    assert.match(source, /informed consent/i)
    assert.match(source, /security, compliance, legal, and operational readiness/i)
  })

  it("keeps the approved public actions and removes tactical roadmap copy", () => {
    const source = readProjectFile("app/roadmap/page.tsx")

    assert.match(source, /href="\\/tools"/)
    assert.match(source, /href="\\/pricing"/)
    assert.match(source, /href="\\/pricing#donate"/)
    assert.doesNotMatch(source, /recentlyShipped|currentFocus|laterProductTracks|upfrontNeeds/)
    assert.doesNotMatch(source, /Current alpha direction|Recently shipped|Current alpha focus/)
    assert.doesNotMatch(source, /May 8-13, 2026/)
  })

  it("uses timeless Roadmap metadata", () => {
    const route = PUBLIC_SEO_ROUTES.find((entry) => entry.path === "/roadmap")

    assert.ok(route)
    assert.equal(
      route.description,
      "Explore MassageLab's long-term vision for anatomy education, wellness, therapist practice tools, local-first records, and ambient experiences.",
    )
    assert.doesNotMatch(route.description, /current|milestone|phase|priority|date/i)
  })
})
```

- [ ] **Step 2: Add the failing rendered-route contract**

Add this test to `tests/browser/public-routes.spec.ts` immediately before the existing Atmosphere player test:

```ts
test("Roadmap presents an unordered product portfolio", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/roadmap", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { level: 1, name: "Where MassageLab is going" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Shared foundation" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Product portfolio" })).toBeVisible()

  for (const name of [
    "Education & Anatomy",
    "Wellness Tools",
    "Therapist & Practice Tools",
    "Local-First Records",
    "Audio & Ambient Experiences",
  ]) {
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible()
  }

  await expect(page.getByText("Available now", { exact: true })).toHaveCount(5)
  await expect(page.getByText("Long-term direction", { exact: true })).toHaveCount(5)
  await expect(page.getByText(/not a release order/i)).toBeVisible()
  await expect(page.getByRole("link", { name: "Explore tools" }).first()).toHaveAttribute("href", "/tools")
  await expect(page.getByRole("link", { name: "View memberships" }).first()).toHaveAttribute("href", "/pricing")
  await expect(page.getByRole("link", { name: "Donate" }).first()).toHaveAttribute("href", "/pricing#donate")
  await expect(page.getByRole("heading", { name: "Recently shipped" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Current alpha focus" })).toHaveCount(0)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})
```

- [ ] **Step 3: Run both focused contracts and verify that the old page fails them**

Run:

```bash
node --test tests/roadmap-page.test.mjs
npm run test:browser -- tests/browser/public-routes.spec.ts -g "Roadmap presents an unordered product portfolio" --project=desktop-chromium
```

Expected: the Node test fails because the five-track fields and timeless metadata do not exist; the Playwright test fails because the old page has no `Where MassageLab is going` heading or labeled portfolio regions.

- [ ] **Step 4: Replace the Roadmap page with the approved portfolio composition**

Replace `app/roadmap/page.tsx` with:

```tsx
import Link from "next/link"
import {
  BookOpen,
  BriefcaseBusiness,
  HeartHandshake,
  HeartPulse,
  LockKeyhole,
  Music2,
  ShieldCheck,
} from "lucide-react"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/roadmap")

const foundationPrinciples = [
  {
    title: "Privacy and user control",
    description: "People should understand where their information lives and remain in control of how it is used.",
  },
  {
    title: "Accessible by design",
    description: "Learning, wellness, and practice tools should work across devices and support different ways of interacting.",
  },
  {
    title: "Consent before sharing",
    description: "Sensitive context should move between people or products only through clear, informed choices.",
  },
  {
    title: "Readiness before hosting",
    description: "Hosted sensitive-data features require security, compliance, legal, and operational readiness before launch.",
  },
] as const

const productTracks = [
  {
    title: "Education & Anatomy",
    purpose: "Help massage students and professionals build durable anatomy knowledge through active study.",
    availableNow:
      "Sourced anatomy flashcards, individual Anatomime practice, shared classroom games, and saved mastery progress.",
    longTermDirection:
      "Broader learning pathways, more reviewed anatomical media, stronger instructor tools, and carefully chosen spatial learning experiences.",
    capabilities: ["Adaptive study", "Anatomy games", "Classroom sessions"],
    icon: BookOpen,
  },
  {
    title: "Wellness Tools",
    purpose: "Give people approachable tools for relaxation, body awareness, and consistent wellness routines.",
    availableNow:
      "Chimer, Clock, guided breathing, Quick Log, body-sensation tracking, range-of-motion activities, and personal reminders.",
    longTermDirection:
      "More connected routines, clearer personal patterns, and user-controlled ways to carry useful context between wellness experiences.",
    capabilities: ["Timed sessions", "Breathing exercises", "Reflection and patterns"],
    icon: HeartPulse,
  },
  {
    title: "Therapist & Practice Tools",
    purpose: "Reduce the administrative load of running an independent massage practice or small team.",
    availableNow:
      "Practice scheduling, public booking, services and providers, calendar workflows, team roles, and business-planning tools.",
    longTermDirection:
      "A more connected workspace for practice operations, client relationships, team coordination, and sustainable business growth.",
    capabilities: ["Scheduling and booking", "Practice planning", "Team coordination"],
    icon: BriefcaseBusiness,
  },
  {
    title: "Local-First Records",
    purpose: "Help therapists manage sensitive professional records while keeping control close to the practitioner.",
    availableNow:
      "An encrypted browser vault for intake forms, SOAP notes, journals, and range-of-motion records, including local intake-to-SOAP continuity.",
    longTermDirection:
      "Stronger cross-device continuity, optional consent-based sharing, and therapist-reviewed assistance such as transcription or drafting, but only when the required safeguards are ready.",
    capabilities: ["Encrypted records", "Therapist-reviewed documentation", "User-controlled transfer"],
    icon: LockKeyhole,
  },
  {
    title: "Audio & Ambient Experiences",
    purpose: "Create calm, focused environments that can accompany sessions, study, rest, or other MassageLab tools.",
    availableNow:
      "A generative music catalog, persistent sitewide playback, clocks and timers, and customizable animated backgrounds.",
    longTermDirection:
      "More expressive ambient environments, deeper playback and visual customization, and smoother connections between audio, timing, and wellness experiences.",
    capabilities: ["Generative audio", "Ambient visuals", "Cross-tool playback"],
    icon: Music2,
  },
] as const

export default function RoadmapPage() {
  return (
    <AppPageShell width="full" contentClassName="gap-10">
      <header className="space-y-5 py-2 sm:py-4">
        <div className="max-w-4xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Product vision</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Where MassageLab is going
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            MassageLab is growing into a connected home for anatomy learning, personal wellness, therapeutic practice,
            professional records, and calm ambient experiences.
          </p>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            These tracks form an equal product portfolio. Their position on this page is not a release order, priority
            ranking, or delivery promise.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="cta">
            <Link href="/tools">Explore tools</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">View memberships</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing#donate">
              <HeartHandshake className="mr-2 h-4 w-4" aria-hidden="true" />
              Donate
            </Link>
          </Button>
        </div>
      </header>

      <section aria-labelledby="roadmap-foundation-heading">
        <AppSurface
          title={<h2 id="roadmap-foundation-heading">Shared foundation</h2>}
          description="The same responsibilities guide every part of the MassageLab portfolio."
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Sensitive professional records remain local-first. Any future hosted sensitive-data capability must earn
            its place through informed consent and the required security, compliance, legal, and operational readiness.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {foundationPrinciples.map((principle) => (
              <AppInset key={principle.title} className="h-full p-4">
                <h3 className="text-sm font-semibold text-foreground">{principle.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{principle.description}</p>
              </AppInset>
            ))}
          </div>
        </AppSurface>
      </section>

      <section aria-labelledby="product-portfolio-heading" className="space-y-4">
        <div className="max-w-3xl">
          <h2 id="product-portfolio-heading" className="text-2xl font-semibold text-foreground">
            Product portfolio
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Each track pairs value available today with a long-term direction. None is ranked above another.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {productTracks.map((track) => {
            const Icon = track.icon
            return (
              <AppSurface
                key={track.title}
                title={<h3>{track.title}</h3>}
                description={track.purpose}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                className="h-full"
                contentClassName="gap-4"
              >
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Available now</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{track.availableNow}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Long-term direction</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{track.longTermDirection}</p>
                </div>
                <ul className="mt-auto flex flex-wrap gap-2" aria-label={`${track.title} representative capabilities`}>
                  {track.capabilities.map((capability) => (
                    <li key={capability} className="rounded-md border border-border/80 bg-background/75 px-2.5 py-1 text-xs">
                      {capability}
                    </li>
                  ))}
                </ul>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="support-roadmap-heading">
        <AppSurface
          title={<h2 id="support-roadmap-heading">Support the mission</h2>}
          description="Memberships and donations help support the broader MassageLab mission. They do not determine feature order or guarantee delivery of a particular capability."
          contentClassName="gap-4"
        >
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="cta">
              <Link href="/pricing#donate">Donate</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">View memberships</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tools">Explore tools</Link>
            </Button>
          </div>
        </AppSurface>
      </section>
    </AppPageShell>
  )
}
```

- [ ] **Step 5: Update the Roadmap metadata**

In `lib/seo.js`, replace the `/roadmap` description with:

```js
  {
    path: "/roadmap",
    title: "MassageLab Roadmap",
    description: "Explore MassageLab's long-term vision for anatomy education, wellness, therapist practice tools, local-first records, and ambient experiences.",
  },
```

- [ ] **Step 6: Run the focused contracts and verify that they pass**

Run:

```bash
node --test tests/roadmap-page.test.mjs
npm run test:browser -- tests/browser/public-routes.spec.ts -g "Roadmap presents an unordered product portfolio" --project=desktop-chromium
```

Expected: all three Node subtests pass; the focused desktop Chromium test passes with no page, console, response, or forbidden-request health errors.

- [ ] **Step 7: Check the phone layout at the existing narrow viewport**

Run:

```bash
npm run test:browser -- tests/browser/public-routes.spec.ts -g "Roadmap presents an unordered product portfolio" --project=mobile-chromium
```

Add an explicit viewport assertion after locating the portfolio grid:

```ts
const viewportWidth = page.viewportSize()?.width ?? 0
const portfolioBox = await page.locator("[aria-labelledby='product-portfolio-heading']").boundingBox()
expect((portfolioBox?.x ?? 0) + (portfolioBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 1)
```

Expected: the same Roadmap contract passes at the repository's mobile Chromium viewport; the portfolio renders as a single readable column and its right edge does not exceed the viewport width.

- [ ] **Step 8: Commit the working public page and its regression coverage**

```bash
git add app/roadmap/page.tsx lib/seo.js tests/roadmap-page.test.mjs tests/browser/public-routes.spec.ts
git commit -m "feat: refresh public roadmap vision"
```

### Task 2: Record the public change and run the release gate

**Files:**
- Modify: `docs/project-state.md:29`
- Modify: `docs/project-log.md:7`

**Interfaces:**
- Consumes: the verified static `/roadmap` page and the canonical documentation rules in `AGENTS.md`.
- Produces: a current-state sentence and a dated chronological entry that future work can use without treating `docs/roadmap.md` as current truth.

- [ ] **Step 1: Update the canonical current-state snapshot**

Append this sentence to the existing `Public app shell` bullet in `docs/project-state.md`:

```markdown
The public Roadmap now presents five equally weighted product tracks with per-track available-now and long-term-direction summaries, keeps dates and delivery priority out of the public vision, and treats privacy, accessibility, consent, local-first professional records, and hosted-data readiness as shared foundations.
```

- [ ] **Step 2: Add the chronological completion entry**

Add this bullet at the top of the `## 2026-07-17` section in `docs/project-log.md`:

```markdown
- Reframed the public Roadmap as a timeless five-track product portfolio for education and anatomy, wellness, therapist and practice tools, local-first records, and audio and ambient experiences. Each track now distinguishes available capabilities from long-term direction without dates or priority order; the page retains membership and donation paths while making privacy, accessibility, informed consent, user control, and hosted-data readiness shared foundations.
```

- [ ] **Step 3: Verify the canonical documentation and unchanged historical evidence**

Run:

```bash
rg -n "public Roadmap|five-track product portfolio|shared foundations" docs/project-state.md docs/project-log.md
git diff -- docs/roadmap.md
git status --short
```

Expected: the new state and log sentences are found; `git diff -- docs/roadmap.md` prints nothing; only the planned Roadmap files plus the pre-existing unstaged `TODO.md` change appear before the documentation commit.

- [ ] **Step 4: Run the standard repository validation gate**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
git diff --check origin/main...HEAD
```

Expected: lint, TypeScript, the full Node test suite, and the production build all pass; both the working-tree and committed-range diff checks report no whitespace errors. If a command fails, fix only failures caused by this branch and rerun that command before continuing.

- [ ] **Step 5: Commit the canonical documentation**

```bash
git add docs/project-state.md docs/project-log.md
git commit -m "docs: record public roadmap refresh"
```

- [ ] **Step 6: Verify the final branch boundary**

Run:

```bash
git status --short
git log --oneline main..HEAD
```

Expected: `TODO.md` remains the only unstaged user change; the branch contains the approved design-spec commit, the Roadmap implementation commit, and the canonical documentation commit.
