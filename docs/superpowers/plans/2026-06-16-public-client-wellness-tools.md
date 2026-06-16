# Public Client Wellness Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public and client-facing wellness tools that help people track ROM, sensations, feelings, context, appointments, and reminders without mixing client-owned self-tracking with therapist professional records.

**Architecture:** Build a separate client-owned wellness domain beside the existing account/contact/booking and therapist professional-record domains. Start with a public practice flow, signed-in persistence, quick logging, and ROM self-measurement using device orientation when available plus manual entry when not. Then add body sensation mapping, calendar reminders, insights, sharing/export, voice, and native/passive sensor feasibility as separate branch-sized increments. Keep therapist access disabled until a consent-based sharing bridge is explicitly reviewed and implemented.

**Tech Stack:** Next.js App Router, React client components for browser APIs, Prisma/Postgres for signed-in client-owned wellness data, existing `useDeviceMotionSensors()` for orientation-based ROM, existing calendar models for appointments/reminders where safe, shadcn/Radix UI primitives, node:test, Playwright browser coverage.

---

## Source Context

- `docs/project-state.md` and `docs/project-log.md` treat client-owned wellness data as separate from therapist professional records and future therapist sharing.
- `docs/wiki/privacy-first-data-architecture.md` already names `ClientWellnessRecord`, `SharingConsent`, and `ProfessionalRecordReference` as future zones.
- `docs/superpowers/plans/2026-06-01-role-aware-module-surfaces.md` says future client surfaces should focus on booking status, profile/contact controls, client-owned wellness records, and consent-managed sharing.
- `app/notes/rom/client-page.tsx` already has a therapist/professional-record ROM tool using `useDeviceMotionSensors()` and manual measurement entry inside the encrypted professional-record vault.
- `hooks/use-device-motion-sensors.ts` already detects secure context support, requests orientation permission, and reads `alpha`, `beta`, and `gamma`.
- `docs/wiki/calendar-creation-flows.md` and `app/calendar/actions.ts` keep calendar reminders operational and require clinical content to stay out of reminder payloads.
- MDN confirms `DeviceOrientationEvent` is secure-context only, exposes `alpha`, `beta`, and `gamma`, and may require `requestPermission()`; `Accelerometer` remains experimental/limited; Push API requires service worker subscriptions; Web Speech recognition usually sends audio to a recognition service unless on-device processing is available and explicitly requested.

## Product Position

MassageLab should feel like a practical wellness companion, not a medical monitor. The client tools should help users notice patterns in movement, comfort, feelings, sleep, work posture, activity, and appointments while avoiding diagnosis, emergency monitoring, or claims that the app is continuously watching them.

Use these labels consistently:

- Client-owned wellness data: self-tracking data created by the user for their own benefit.
- Therapist professional records: local-first SOAP, intake, journal, ROM, pain maps, treatment notes, signatures, and professional observations.
- Sharing bridge: future consent-controlled pathway from selected client wellness data to therapist review.
- Professional-record reference: future deliberate therapist action when client-shared wellness data is used in treatment planning or notes.

## Privacy And Compliance Boundary

1. Client wellness logs may be stored for signed-in users only after clear copy explains that they are self-tracking records, not diagnosis, emergency monitoring, or therapist-facing clinical records.
2. Anonymous users may open the logging and ROM measurement tools, fill them out for practice, and see in-session feedback, but they must see clear copy that nothing saves or persists unless they sign in.
3. Therapists and practices must not receive live access to client wellness records in the first client tools branch.
4. If a therapist later imports or relies on shared wellness data, that import becomes a professional-record reference and must remain local-first until the hosted PHI gate passes.
5. Raw wellness entries must not be written to account preferences, calendar payloads, Sentry metadata, audit metadata, email/SMS bodies, notification payloads, or analytics events.
6. User-created sensation/feeling terms can be saved for that user immediately, but they must not become global suggestions until reviewed.
7. Include export and deletion controls before presenting cloud wellness storage as a durable user benefit.

## UX Decision Brief

- Job: Let a client quickly record what happened, how they feel, where they feel it, and what context might matter, then revisit patterns later.
- User mode: anonymous practice user, signed-in base user, or verified client; occasional-to-daily repeated use; sensitive consumer health data.
- Frequency/risk: frequent low-friction capture, medium privacy risk, high trust risk if copy suggests diagnosis or therapist monitoring.
- Pattern: wellness hub plus quick-log flow, with progressive detail for body regions, sensations, activity context, and notes.
- Primary action: Log now.
- Secondary actions: Review trends, schedule reminder, measure ROM, export data, delete data.
- Core path: `/wellness` -> Log now or Measure ROM -> choose category/movement -> capture minimum useful fields -> sign in to save or save if signed in -> see timeline/trend update.
- Recovery path: anonymous no-save prompt, unsupported sensor/manual entry, permission denied/manual entry, save failure/retry without data loss, offline/local-only message, delete/export confirmation.
- Required states: empty, loading, partial, error, permission, success, unsupported device, privacy acknowledgement, export/delete confirmation.
- Handoff constraints: keep first screens simple, keep advanced detail tucked, use feedback on every save/sensor/permission action, avoid guilt-based streaks, respect reduced motion.

## Gamification Model

The game layer should reinforce self-awareness and return visits without pressuring people to chase pain reduction or perfect streaks.

Use:

- Kind streaks with grace days and "restart without penalty" language.
- Lightweight achievements for consistency, range completion, first export, first pattern review, and trying multiple tools.
- Collection-style progress around learning your body: regions explored, contexts logged, ROM movements measured, check-in variety.
- Weekly quests such as "log one workday posture note", "measure the same motion twice", or "compare sleep and morning comfort".
- Positive feedback loops only where they support user agency: celebrate recording, reflection, and preparation for a conversation, not pain score changes.

Avoid:

- Shame copy for missed days.
- Diagnosis-like badges.
- Leaderboards for health status.
- Unlocking core privacy/export controls behind engagement.
- Excessive motion or reward animation.

## Tool Inventory

### First-class client tools

- Wellness hub: timeline, quick log, privacy controls, export/delete, entry categories.
- ROM self-measurement: phone orientation when supported, manual entry from a digital angle finder or goniometer when not.
- Body sensation tracker: selectable body regions, sensation type, intensity, duration, context, notes, user-owned custom terms.
- Feelings tracker: emotion wheel-style check-in, physical feeling check-in, intensity, context, note.
- Context tracker: sleep, sitting, work task, commute, exercise, stress, hydration, home care, screen time, travel, sudden incident.
- Calendar companion: upcoming/past appointments for clients, self-scheduled reminders for measurements/check-ins/home care, no clinical content in event payloads.
- Trend review: non-diagnostic pattern prompts such as "neck tension often appears after long desk sessions".
- Export/share preparation: client-controlled export first, consent-based therapist sharing later.

### Later integrations

- Voice quick capture: local/on-device transcription only if available; otherwise record typed notes until privacy and vendor review is complete.
- Passive activity prompts: future native/mobile app or health-platform integration, not a browser-only PWA assumption.
- Wearables and health platforms: Apple HealthKit, Google Health Connect/Fit, sleep/activity import, explicit scopes, revocation, category controls.
- 3D body map: after 2D region mapping is useful; use anatomy media/spatial work only when it adds real interaction value.

## Sensor And Device Strategy

### ROM measurement

ROM sensor work is not deferred because it is impossible in a web app. It was originally split out only to keep the first branch smaller. Because ROM is a core product bet, include a first ROM measurement workflow in the wellness foundation branch.

Use `DeviceOrientationEvent` first because it is already implemented in the repo and broadly available over secure contexts. The measurement UX should ask the user to:

1. Choose movement and side.
2. Choose or accept the suggested device axis.
3. Position the phone and capture baseline.
4. Move through the ROM and capture end.
5. Save the delta and source.
6. Repeat with the same movement later for trend comparison.

Keep copy non-diagnostic: "tracking reference", "measurement method", and "compare your own entries over time", not "normal/abnormal" or diagnosis. Also state that phone orientation is a convenience measurement, not a calibrated medical device.

Manual fallback is mandatory. If the browser is unsupported, permission is denied, the page is not secure, or the user prefers not to grant motion access, offer manual degree entry with guidance for a digital angle finder, goniometer, or therapist-provided measurement.

Do not build production ROM around `Accelerometer` yet. It is experimental/limited and belongs in a feasibility spike only.

### Notifications and reminders

Start with in-app reminders tied to the signed-in user's wellness schedule. Web Push can come later after notification permission, service worker subscription storage, CSRF handling, unsubscribe, and quiet-hours controls are planned.

Do not put raw wellness content in notification payloads. Use generic text such as "Time for your wellness check-in" and route into the app.

### Voice

Voice capture is valuable, but Web Speech recognition can use server-based recognition by default. If voice is added, require an explicit local/on-device mode check and a fallback to typed notes. Do not ship cloud transcription under the current alpha posture.

### Passive detection

A browser PWA should not be treated as able to reliably detect sleep, running, falls, trauma, or background activity. Those features require a native app, explicit OS permissions, or health-platform integration. Treat them as a later research branch with strong consent and safety language.

## Branch Sequence

1. `codex/client-wellness-and-rom-foundation`
   - Add the client wellness data model, privacy copy, owner-only actions, navigation, quick log, ROM measurement, manual angle fallback, export/delete, and tests.
   - Anonymous users can try logging and ROM measurement in memory only, with sign-in prompts for persistence.
   - No body map, voice, therapist sharing, web push, or native health integration yet.

2. `codex/body-sensation-tracker`
   - Add 2D region selector, sensation taxonomy, custom user terms, intensity/duration/context fields, and timeline filters.
   - Keep global vocabulary suggestions review-gated.

3. `codex/client-calendar-reminders`
   - Add client calendar views for own upcoming/past appointments and wellness reminder schedules.
   - Keep reminder payloads generic and free of health detail.

4. `codex/wellness-patterns-and-reports`
   - Add pattern review, trend charts, weekly summaries, and exportable reports.
   - Keep insights non-diagnostic and confidence-labeled.

5. `codex/wellness-sharing-bridge-plan`
   - Design `SharingConsent`, scoped exports, revocation, audit language, and therapist review/import boundaries.
   - Do not implement live therapist dashboards until this plan is approved.

6. `codex/voice-and-passive-sensor-spikes`
   - Spike on-device speech recognition and native/health-platform sensor options.
   - Do not ship user-facing passive monitoring until consent, privacy, support, and safety constraints are solved.

## First Slice: `codex/client-wellness-and-rom-foundation`

### Files

- Create: `lib/client-wellness.js`
- Create: `app/wellness/page.tsx`
- Create: `app/wellness/actions.ts`
- Create: `components/wellness/wellness-hub-client.tsx`
- Create: `components/wellness/rom-measurement-panel.tsx`
- Create: `tests/client-wellness.test.mjs`
- Create: `tests/client-wellness-source-guards.test.mjs`
- Modify: `prisma/schema.prisma`
- Modify: `lib/navigation.js`
- Modify: `tests/navigation-model.test.mjs`
- Modify: `docs/wiki/privacy-first-data-architecture.md`
- Modify: `docs/wiki/privacy-and-phi.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

### Data Model

Add models shaped like this, with a migration name such as `20260616_client_wellness_foundation`:

```prisma
model ClientWellnessEntry {
  id          String   @id @default(cuid())
  userId      String
  category    String
  occurredAt  DateTime
  timezone    String   @default("America/New_York")
  summary     String?
  intensity   Int?
  regions     Json     @default("[]")
  sensations  Json     @default("[]")
  contexts    Json     @default("[]")
  source      String   @default("manual")
  metadata    Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, occurredAt])
  @@index([userId, category, occurredAt])
  @@index([userId, deletedAt])
}

model ClientWellnessPreference {
  userId    String   @id
  version   Int      @default(1)
  settings  Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ClientWellnessVocabularySuggestion {
  id        String   @id @default(cuid())
  userId    String
  term      String
  category  String
  status    String   @default("PRIVATE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([category, status])
}
```

If Prisma requires relation fields on `User`, add:

```prisma
clientWellnessEntries ClientWellnessEntry[]
clientWellnessPreference ClientWellnessPreference?
clientWellnessVocabularySuggestions ClientWellnessVocabularySuggestion[]
```

### Domain Helper Contract

`lib/client-wellness.js` owns the pure validation and sanitization logic. This repo-specific `.js` choice keeps the existing `node --test` helper tests loader-free.

```ts
export const CLIENT_WELLNESS_CATEGORIES = [
  "body_sensation",
  "emotion",
  "rom",
  "sleep",
  "activity",
  "work_context",
  "home_care",
  "incident",
] as const

export function normalizeClientWellnessEntryInput(input: unknown, now = new Date()) {
  // Return a safe payload with category, occurredAt, timezone, summary,
  // intensity, regions, sensations, contexts, source, and metadata.
}

export function clientWellnessExportFilename(userLabel: string | null, date = new Date()) {
  // Return a stable filename such as massagelab-wellness-2026-06-16.json.
}

export function sanitizeClientWellnessLogMetadata(input: unknown) {
  // Return only ids, counts, category, and non-sensitive status values.
}
```

### Task 1: Domain Helpers And Tests

**Files:**
- Create: `lib/client-wellness.js`
- Create: `tests/client-wellness.test.mjs`

- [x] **Step 1: Write tests for category validation, local date handling, intensity clamping, array normalization, and export filenames.**

Run: `node --test tests/client-wellness.test.mjs`

Expected: FAIL because `lib/client-wellness.js` does not exist.

- [x] **Step 2: Implement `lib/client-wellness.js` with pure functions only.**

Keep comments focused on privacy intent: this helper normalizes client-owned self-tracking payloads and strips data that should never enter logs or analytics.

- [x] **Step 3: Run the focused tests.**

Run: `node --test tests/client-wellness.test.mjs`

Expected: PASS.

### Task 2: Prisma Models And Access Tests

**Files:**
- Modify: `prisma/schema.prisma`
- Create or modify: `tests/client-wellness.test.mjs`

- [x] **Step 1: Add model-shape tests that read `prisma/schema.prisma` and assert the three wellness models, owner indexes, soft delete field, and absence of practice/therapist foreign keys.**

Run: `node --test tests/client-wellness.test.mjs`

Expected: FAIL until schema models are added.

- [x] **Step 2: Add the Prisma models and generated migration.**

Run: `npm run prisma:validate`

Expected: PASS.

- [x] **Step 3: Generate Prisma client.**

Run: `npm run prisma:generate`

Expected: PASS.

### Task 3: Owner-Only Actions

**Files:**
- Create: `app/wellness/actions.ts`
- Modify: `tests/client-wellness.test.mjs`

- [x] **Step 1: Add focused action/source tests that assert create/list/export/delete actions require a signed-in user and filter by `userId`.**

Run: `node --test tests/client-wellness.test.mjs`

Expected: FAIL until actions exist.

- [x] **Step 2: Implement server actions.**

Actions:

- `createClientWellnessEntryAction(formData)`
- `deleteClientWellnessEntryAction(formData)`
- `exportClientWellnessEntriesAction()`
- `updateClientWellnessPreferenceAction(formData)`

Every Prisma query must include `userId: session.user.id`. Soft delete entries with `deletedAt`, and export only the current user's non-deleted entries.

- [x] **Step 3: Add privacy-safe logging discipline.**

Do not log raw summaries, regions, sensations, contexts, or metadata. If an error needs logging, log only action name, category, and count/status.

### Task 4: Wellness Hub UI

**Files:**
- Create: `app/wellness/page.tsx`
- Create: `components/wellness/wellness-hub-client.tsx`
- Create: `components/wellness/rom-measurement-panel.tsx`

- [x] **Step 1: Add the public practice and signed-in wellness route.**

Server page responsibilities:

- Allow anonymous users to open the tool and fill out practice entries without persistence.
- Require signed-in user for cloud wellness saves, export, delete, and timeline persistence.
- Load recent non-deleted entries for the current signed-in user only.
- Pass bounded data into the client component.
- Render a signed-out state with clear copy, an interactive practice form, and a sign-in/register path for saving.

- [x] **Step 2: Add the quick-log client component.**

Visible default fields:

- Category
- How strong is it? intensity 0-10
- Short note
- Context chips
- Save

Tucked fields:

- Body regions
- Sensation terms
- Exact time override
- Custom term

States:

- Empty: explain self-tracking and privacy in one short panel.
- Anonymous practice: allow form completion and ROM measurement feedback, but label it as not saved.
- Permission/privacy: require acknowledgement before first cloud save.
- Pending: disable save and show status.
- Success: add the entry to timeline and show a concise success message.
- Error: preserve form data and show retry.

- [x] **Step 3: Add first ROM measurement panel.**

Use `useDeviceMotionSensors()` for device-orientation measurement and mirror the current professional-record ROM flow at a client-owned/self-tracking level:

- movement
- side
- axis
- current angle
- captured baseline
- captured end angle
- change in degrees
- source: `device-orientation` or `manual`
- note

Anonymous users can capture and view a measurement in memory, but the save action should become a sign-in prompt. Signed-in users save ROM as a `ClientWellnessEntry` with category `rom`, source `device-orientation` or `manual`, and measurement details in `metadata`.

- [x] **Step 4: Keep the surface mobile-first.**

Use large touch targets, stable form layout, and no nested cards. Keep the primary action near the active form.

### Task 5: Navigation And Role Surfaces

**Files:**
- Modify: `lib/navigation.js`
- Modify: `tests/navigation-model.test.mjs`

- [x] **Step 1: Add tests for anonymous, signed-in base users, and clients seeing `/wellness`.**

Run: `node --test tests/navigation-model.test.mjs`

Expected: FAIL until navigation is updated.

Anonymous route visibility is intentional because `/wellness` has a useful practice surface. Persistence remains signed-in only.

- [x] **Step 2: Add a `wellness` route in the tools or client group.**

Suggested descriptor:

```js
{
  id: "wellness",
  href: "/wellness",
  label: "Wellness",
  icon: "HeartPulse",
  audiences: ["anonymous", "signed-in", "client", "student", "therapist", "practice", "admin"],
  visibleInSidebar: true,
  groupId: "tools",
}
```

- [x] **Step 3: Keep professional-record routes out of client navigation.**

The existing guard that prevents direct `/notes/soap`, `/notes/intake`, `/notes/journal`, and `/notes/rom` sidebar routes must keep passing.

### Task 6: Source Guards

**Files:**
- Create: `tests/client-wellness-source-guards.test.mjs`
- Modify: `lib/account-preferences.js` if new forbidden keys are needed.

- [x] **Step 1: Add source-guard tests that assert the wellness route/actions do not write wellness entries to account preferences, calendar reminders, Sentry metadata, notification payloads, or therapist professional-record vault storage.**

Run: `node --test tests/client-wellness-source-guards.test.mjs`

Expected: FAIL until implementation paths are safe.

- [x] **Step 2: Add forbidden sync keys for likely wellness payload names.**

Include keys such as `wellnessEntries`, `clientWellnessEntries`, `bodySensationEntries`, `emotionEntries`, `sleepEntries`, `activityEntries`, `wellnessJournal`, and `wellnessSummary`.

- [x] **Step 3: Keep the test string-based and focused.**

This follows the current local-note safety pattern and catches accidental sync/logging route additions early.

### Task 7: Docs

**Files:**
- Modify: `docs/wiki/privacy-first-data-architecture.md`
- Modify: `docs/wiki/privacy-and-phi.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [x] **Step 1: Update privacy docs.**

Record that client wellness is sensitive consumer-health self-tracking, not therapist professional-record storage, and that therapist viewing remains disabled until sharing consent is designed.

- [x] **Step 2: Update project state.**

Mention the planned client wellness foundation as a P2 visible product surface and keep hosted PHI gates unchanged.

- [x] **Step 3: Update project log.**

Add a change-history bullet linking this plan.

### Task 8: Validation

Run these commands before handoff:

```powershell
node --test tests/client-wellness.test.mjs
node --test tests/client-wellness-source-guards.test.mjs
node --test tests/navigation-model.test.mjs
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
```

If browser UI is implemented in the same branch, also run:

```powershell
npm run test:browser
```

Validation note for this branch: focused client wellness/source/navigation tests, `npm run prisma:validate`, `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` passed. The default parallel `npm run test:browser` run rendered `/wellness` successfully but later lost the Playwright web server with `ERR_CONNECTION_REFUSED` on unrelated routes; rerunning `npm run test:browser -- --workers=1` passed all 56 browser tests.

## Acceptance Criteria

- Signed-in users can open `/wellness`, read the self-tracking privacy boundary, create quick wellness and ROM entries, review their own timeline, export their entries, and soft-delete entries.
- Anonymous users can open `/wellness`, fill out logging and ROM measurement tools for practice, and clearly see that nothing saves or persists until they sign in.
- Clients do not see therapist professional-record tools in navigation.
- Therapists and practices cannot view client wellness records.
- The implementation contains no hosted professional-record storage and no therapist import path.
- Account preference sync excludes wellness entries.
- Logs, audit metadata, notification payloads, and calendar payloads do not contain raw wellness content.
- The UI has empty, anonymous practice, pending, success, error, permission/privacy, unsupported sensor, and deletion/export confirmation states.
- The first slice is useful without body maps, voice, passive detection, or sharing.

## Follow-Up Plan Requirements

Create a separate plan before implementing each of these:

- Body sensation tracker with 2D or 3D body map.
- Client calendar/reminder companion.
- Wellness pattern reports.
- Consent sharing bridge.
- Voice capture.
- Native/passive sensor integration.
