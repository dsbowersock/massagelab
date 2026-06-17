# Wellness Patterns And Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first `/wellness` pattern-report slice that helps clients review their own self-tracking trends without diagnosis, therapist sharing, or new hosted PHI paths.

**Architecture:** Keep the first report entirely derived from the current user's already-loaded `WellnessTimelineEntry` data. Put aggregation and non-diagnostic prompt generation in a pure helper, render compact trend bars and weekly summaries in a client component, and download reports from the browser as JSON. Do not add tables, server actions, calendar payloads, analytics events, external notifications, or therapist-facing surfaces in this branch.

**Tech Stack:** Next.js App Router, React client components, existing `/wellness` timeline data, pure JavaScript helper tested with `node:test`, existing shadcn/Radix primitives, source-guard tests, and browser smoke coverage already pointed at `/wellness`.

---

## Source Context

- `docs/project-state.md` says `/wellness` is client-owned self-tracking; therapist viewing, sharing, voice, passive detection, and external reminders remain follow-up work.
- `docs/superpowers/plans/2026-06-16-public-client-wellness-tools.md` lists `codex/wellness-patterns-and-reports` after the calendar reminder companion and requires pattern review, trend charts, weekly summaries, exportable reports, non-diagnostic copy, and confidence labels.
- `components/wellness/wellness-hub-client.tsx` already owns the in-browser timeline state for signed-in persisted entries and anonymous practice entries.
- `tests/client-wellness-source-guards.test.mjs` already blocks accidental routing of wellness content into calendar, notification, Sentry, and professional-record paths.

## File Structure

- Create `lib/client-wellness-patterns.js`: pure aggregation, chart rows, report filename, and non-diagnostic prompt generation.
- Create `tests/client-wellness-patterns.test.mjs`: deterministic tests for weekly windows, category/region/context rollups, ROM movement summaries, report filenames, and confidence labels.
- Create `components/wellness/wellness-pattern-report.tsx`: report panel with summary windows, small bar charts, non-diagnostic pattern prompts, and browser JSON download.
- Modify `components/wellness/wellness-hub-client.tsx`: render `WellnessPatternReport` from the current `entries` array.
- Modify `tests/client-wellness-source-guards.test.mjs`: assert the report helper and component stay out of calendar, Sentry, delivery, therapist-id, and professional-record paths.
- Modify `docs/project-state.md`: mark pattern reports as the active branch and live wellness capability.
- Modify `docs/project-log.md`: add a chronological entry for the plan and implemented first slice.

## Privacy And Product Rules

1. Pattern copy must use words like "appears with", "often logged with", "tracking reference", and "early signal"; it must not say "caused by", "diagnosis", "normal", "abnormal", or "treatment".
2. Confidence labels must be based on entry count only: `early` for 2 supporting entries, `moderate` for 3-4, and `stronger` for 5 or more.
3. Report download must run in the browser from already-loaded entries. No server action, account preference write, calendar write, Sentry metadata, or audit log should be added.
4. Anonymous practice entries may generate an in-session report, but the UI must make it clear that the report is based on current page entries only.
5. Therapist sharing and consent workflows are not part of this branch.

## Task 1: Pattern Helper And Tests

**Files:**
- Create: `lib/client-wellness-patterns.js`
- Create: `tests/client-wellness-patterns.test.mjs`

- [x] **Step 1: Write failing helper tests.**

Add `tests/client-wellness-patterns.test.mjs` with deterministic entry fixtures:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildClientWellnessPatternReport,
  clientWellnessReportFilename,
} from "../lib/client-wellness-patterns.js"

const now = new Date("2026-06-16T16:00:00.000Z")

function entry(overrides = {}) {
  return {
    id: overrides.id ?? `entry-${Math.random()}`,
    category: overrides.category ?? "body_sensation",
    occurredAt: overrides.occurredAt ?? "2026-06-16T14:00:00.000Z",
    timezone: overrides.timezone ?? "America/New_York",
    summary: overrides.summary ?? null,
    intensity: overrides.intensity ?? 5,
    regions: overrides.regions ?? [],
    sensations: overrides.sensations ?? [],
    contexts: overrides.contexts ?? [],
    source: overrides.source ?? "quick-log",
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? "2026-06-16T14:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-16T14:00:00.000Z",
    persisted: overrides.persisted ?? true,
  }
}

describe("Client wellness pattern reports", () => {
  it("builds bounded report windows and top tracking signals", () => {
    const report = buildClientWellnessPatternReport([
      entry({ id: "neck-1", regions: ["neck"], sensations: ["tight"], contexts: ["desk"], intensity: 7 }),
      entry({ id: "neck-2", regions: ["neck"], sensations: ["tight"], contexts: ["desk"], intensity: 5 }),
      entry({ id: "sleep-1", category: "sleep", contexts: ["sleep"], intensity: 3 }),
      entry({ id: "old", occurredAt: "2026-05-01T12:00:00.000Z", regions: ["hip"], contexts: ["travel"] }),
    ], now)

    assert.equal(report.entryCount, 4)
    assert.deepEqual(report.windows.map((window) => [window.id, window.entryCount]), [["7d", 3], ["30d", 3]])
    assert.deepEqual(report.topRegions[0], { label: "neck", count: 2 })
    assert.deepEqual(report.topSensations[0], { label: "tight", count: 2 })
    assert.deepEqual(report.topContexts[0], { label: "desk", count: 2 })
    assert.equal(report.averageIntensity, 5)
  })

  it("creates non-diagnostic confidence-labeled prompts from repeated signals", () => {
    const report = buildClientWellnessPatternReport([
      entry({ id: "desk-neck-1", regions: ["neck"], contexts: ["desk"], sensations: ["tight"] }),
      entry({ id: "desk-neck-2", regions: ["neck"], contexts: ["desk"], sensations: ["tight"] }),
      entry({ id: "desk-neck-3", regions: ["neck"], contexts: ["desk"], sensations: ["achy"] }),
    ], now)

    assert.equal(report.patternPrompts[0].confidence, "moderate")
    assert.match(report.patternPrompts[0].title, /Neck/i)
    assert.match(report.patternPrompts[0].detail, /desk/i)
    assert.doesNotMatch(report.patternPrompts.map((prompt) => prompt.detail).join(" "), /cause|diagnosis|normal|abnormal/i)
  })

  it("summarizes repeated ROM movement deltas as tracking references", () => {
    const report = buildClientWellnessPatternReport([
      entry({ id: "rom-1", category: "rom", metadata: { movement: "neck rotation", changeDegrees: 35 }, occurredAt: "2026-06-14T12:00:00.000Z" }),
      entry({ id: "rom-2", category: "rom", metadata: { movement: "neck rotation", changeDegrees: 42 }, occurredAt: "2026-06-16T12:00:00.000Z" }),
    ], now)

    assert.deepEqual(report.romMovements[0], {
      movement: "neck rotation",
      entryCount: 2,
      latestDegrees: 42,
      previousDegrees: 35,
      changeSincePrevious: 7,
    })
  })

  it("builds report filenames without user labels", () => {
    assert.equal(clientWellnessReportFilename(new Date("2026-06-16T12:00:00.000Z")), "massagelab-wellness-report-2026-06-16.json")
  })
})
```

Run: `node --test tests/client-wellness-patterns.test.mjs`

Expected: FAIL with module-not-found for `lib/client-wellness-patterns.js`.

- [x] **Step 2: Implement the pure helper.**

Create `lib/client-wellness-patterns.js` with these exports:

```js
// @ts-check

export const CLIENT_WELLNESS_REPORT_WINDOWS = Object.freeze([
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
])

export function buildClientWellnessPatternReport(entries, now = new Date()) {
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date()
  const normalizedEntries = normalizeEntries(entries)
  const recentEntries = normalizedEntries.filter((entry) => safeNow.getTime() - entry.occurredAt.getTime() <= 30 * 24 * 60 * 60 * 1000)
  const windows = CLIENT_WELLNESS_REPORT_WINDOWS.map((window) => {
    const cutoff = safeNow.getTime() - window.days * 24 * 60 * 60 * 1000
    const windowEntries = normalizedEntries.filter((entry) => entry.occurredAt.getTime() >= cutoff && entry.occurredAt <= safeNow)
    return {
      id: window.id,
      label: window.label,
      entryCount: windowEntries.length,
      categoryCounts: countBy(windowEntries.flatMap((entry) => [entry.category])),
    }
  })

  return {
    generatedAt: safeNow.toISOString(),
    entryCount: normalizedEntries.length,
    windows,
    categoryBreakdown: countBy(normalizedEntries.map((entry) => entry.category)),
    topRegions: countBy(recentEntries.flatMap((entry) => entry.regions)).slice(0, 5),
    topSensations: countBy(recentEntries.flatMap((entry) => entry.sensations)).slice(0, 5),
    topContexts: countBy(recentEntries.flatMap((entry) => entry.contexts)).slice(0, 5),
    averageIntensity: averageIntensity(recentEntries),
    romMovements: summarizeRomMovements(recentEntries),
    patternPrompts: buildPatternPrompts(recentEntries),
  }
}

export function clientWellnessReportFilename(date = new Date()) {
  const stamp = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  return `massagelab-wellness-report-${stamp}.json`
}
```

The implementation must normalize unknown entry shapes, sort count rows by `count desc` then `label asc`, round average intensity to one decimal, and keep prompt text non-diagnostic.

- [x] **Step 3: Run helper tests until green.**

Run: `node --test tests/client-wellness-patterns.test.mjs`

Expected: PASS.

## Task 2: Report Panel UI

**Files:**
- Create: `components/wellness/wellness-pattern-report.tsx`
- Modify: `components/wellness/wellness-hub-client.tsx`

- [x] **Step 1: Add the report panel component.**

Create `components/wellness/wellness-pattern-report.tsx` with this public contract:

```tsx
"use client"

import { useMemo } from "react"
import { BarChart3, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  buildClientWellnessPatternReport,
  clientWellnessReportFilename,
} from "@/lib/client-wellness-patterns"
import type { WellnessTimelineEntry } from "@/components/wellness/wellness-hub-client"

export function WellnessPatternReport({
  entries,
  isSignedIn,
}: {
  entries: WellnessTimelineEntry[]
  isSignedIn: boolean
}) {
  const report = useMemo(() => buildClientWellnessPatternReport(entries), [entries])

  return (
    <section className="rounded-md border border-border/80 bg-card/95 p-4">
      {/* Render title, privacy-safe description, window counts, bars, prompts, ROM movement rows, and download button. */}
    </section>
  )
}
```

The component must render:

- Heading text: `Pattern review`
- Signed-in copy: `This report uses your saved self-tracking entries only.`
- Anonymous copy: `This report uses practice entries in this page session only.`
- Two window count badges for `Last 7 days` and `Last 30 days`
- A compact bar chart for top regions, contexts, and categories
- A `Tracking prompts` section with confidence badges
- A `ROM references` section when repeated ROM movements exist
- A browser-only JSON download button labeled `Download report`

- [x] **Step 2: Wire the panel into the wellness hub.**

In `components/wellness/wellness-hub-client.tsx`, import and render the component after `WellnessCalendarCompanion`:

```tsx
import { WellnessPatternReport } from "@/components/wellness/wellness-pattern-report"
```

```tsx
<WellnessPatternReport entries={entries} isSignedIn={isSignedIn} />
```

- [x] **Step 3: Run typecheck for the component contract.**

Run: `npm run typecheck`

Expected: PASS.

## Task 3: Source Guards And Docs

**Files:**
- Modify: `tests/client-wellness-source-guards.test.mjs`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [x] **Step 1: Extend source guards for report isolation.**

Add a source guard that reads `lib/client-wellness-patterns.js` and `components/wellness/wellness-pattern-report.tsx`, then asserts:

```js
assert.doesNotMatch(reportSources, /CalendarEvent|CalendarReminder|CalendarNotificationIntent|sendEmail|sendSms|webPush|PushSubscription/)
assert.doesNotMatch(reportSources, /practiceId|therapistId|calendarAuditLog|notificationIntent/)
assert.doesNotMatch(reportSources, /Sentry|captureException|captureMessage|analytics|trackEvent/)
assert.doesNotMatch(reportSources, /massagelab-professional-record-vault-v1|ProfessionalRecordVault|ClinicalArtifactManifest/)
assert.doesNotMatch(reportSources, /\bdiagnosis\b|\bnormal\b|\babnormal\b|\btreatment\b/i)
```

Run: `node --test tests/client-wellness-source-guards.test.mjs`

Expected: PASS.

- [x] **Step 2: Update project state.**

Update `docs/project-state.md` so the client wellness surface mentions non-diagnostic pattern review and browser report downloads, while sharing, external delivery, voice, passive detection, and therapist viewing remain follow-up work.

- [x] **Step 3: Update project log.**

Add a dated entry under `2026-06-16` linking this plan and summarizing the first pattern-report slice.

## Task 4: Validation

**Files:**
- No new files.

- [x] **Step 1: Run focused tests.**

```powershell
node --test tests/client-wellness-patterns.test.mjs
node --test tests/client-wellness.test.mjs
node --test tests/client-wellness-source-guards.test.mjs
```

Expected: PASS.

- [x] **Step 2: Run repo validation.**

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: PASS.

- [x] **Step 3: Run wellness browser coverage if the component integration changes visual layout.**

```powershell
npm run test:browser -- --grep wellness --workers=1
```

Expected: PASS.

## Acceptance Criteria

- `/wellness` shows a `Pattern review` panel for signed-in and anonymous practice users.
- The report is derived only from the entries already present in the client component.
- Top categories, regions, sensations, and contexts are summarized in compact trend rows.
- Weekly windows show counts for the last 7 and 30 days.
- Repeated ROM movement entries show latest, previous, and change-since-previous reference values.
- Pattern prompts use confidence labels and non-diagnostic language.
- Users can download a JSON report from the browser without calling a new server action.
- Source guards continue to block calendar, delivery, Sentry, professional-record, therapist-id, and diagnostic-language paths.
