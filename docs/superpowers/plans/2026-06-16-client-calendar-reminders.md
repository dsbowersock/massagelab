# Client Calendar Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first client calendar companion to `/wellness` so signed-in users can see their own upcoming/past appointments and manage generic wellness reminder schedules, while anonymous visitors can try the reminder setup without persistence.

**Architecture:** Read appointment data through `PracticeClient.userId` and serialize only operational appointment details needed by the client. Store wellness reminder schedules in the existing owner-scoped `ClientWellnessPreference.settings.reminderSchedules` JSON rather than practice `CalendarReminder` rows, because the first wellness reminder schedule is client-owned consumer self-tracking and should not enter the practice calendar/audit/notification payload path. Keep reminder payloads generic: reminder kind, cadence, time, and enabled state only.

**Tech Stack:** Next.js App Router, React client components, Prisma/Postgres, `ClientWellnessPreference`, existing appointment models, node:test source guards, TypeScript, Tailwind/shadcn primitives.

---

## Files

- Create: `lib/client-wellness-reminders.js`
- Create: `components/wellness/wellness-calendar-companion.tsx`
- Modify: `app/wellness/page.tsx`
- Modify: `app/wellness/actions.ts`
- Modify: `components/wellness/wellness-hub-client.tsx`
- Modify: `tests/client-wellness.test.mjs`
- Modify: `tests/client-wellness-source-guards.test.mjs`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

## Privacy Boundary

- Appointment companion data is read-only and filtered by `practiceClient.userId === session.user.id`.
- Appointment serialization must not include appointment `notes`, practice-client email/phone/address, SOAP/intake/journal/ROM records, or therapist professional-record references.
- Wellness reminder schedules are client-owned preference data. They are not practice calendar reminders, notification intents, audit logs, or external push payloads in this branch.
- Anonymous visitors may add practice reminder schedules in memory only; signed-in users can save schedules.
- No therapist/practice visibility, sharing bridge, web push, email/SMS delivery, Sentry metadata, or professional-record vault write is added.

### Task 1: Reminder Schedule Helpers

**Files:**
- Create: `lib/client-wellness-reminders.js`
- Modify: `tests/client-wellness.test.mjs`

- [x] **Step 1: Add failing helper tests.**

Add this import:

```js
import {
  CLIENT_WELLNESS_REMINDER_KINDS,
  normalizeClientWellnessReminderSchedules,
  nextClientWellnessReminderOccurrences,
} from "../lib/client-wellness-reminders.js"
```

Add tests asserting that schedule normalization keeps only generic fields:

```js
assert.deepEqual(CLIENT_WELLNESS_REMINDER_KINDS.map((kind) => kind.id), [
  "check_in",
  "body_sensation",
  "rom",
  "feeling",
  "sleep",
  "home_care",
])

const schedules = normalizeClientWellnessReminderSchedules([
  {
    id: "custom",
    kind: "rom",
    cadence: "weekdays",
    timeOfDay: "7:05",
    weekdays: [1, 3, 3, "bad"],
    enabled: true,
    note: "drop this private note",
  },
  { kind: "diagnosis", cadence: "daily", timeOfDay: "99:99" },
])

assert.deepEqual(schedules, [{
  id: "custom",
  kind: "rom",
  cadence: "weekdays",
  timeOfDay: "07:05",
  weekdays: [1, 3],
  enabled: true,
}])
```

Add a deterministic next-occurrence test:

```js
assert.deepEqual(
  nextClientWellnessReminderOccurrences(schedules, new Date("2026-06-16T10:00:00.000Z"), 2)
    .map((item) => ({ kind: item.kind, startsAt: item.startsAt.toISOString() })),
  [
    { kind: "rom", startsAt: "2026-06-17T07:05:00.000Z" },
    { kind: "rom", startsAt: "2026-06-22T07:05:00.000Z" },
  ],
)
```

Run: `node --test tests/client-wellness.test.mjs`
Expected: FAIL because the helper does not exist yet.

- [x] **Step 2: Implement `lib/client-wellness-reminders.js`.**

Export:

```js
export const CLIENT_WELLNESS_REMINDER_KINDS = Object.freeze([
  { id: "check_in", label: "Wellness check-in" },
  { id: "body_sensation", label: "Body sensation log" },
  { id: "rom", label: "ROM measurement" },
  { id: "feeling", label: "Feeling check-in" },
  { id: "sleep", label: "Sleep note" },
  { id: "home_care", label: "Home care" },
])

export function normalizeClientWellnessReminderSchedules(input) {}
export function nextClientWellnessReminderOccurrences(schedules, now = new Date(), limit = 6) {}
```

`normalizeClientWellnessReminderSchedules()` must accept an array, keep at most 12 schedules, drop unknown kinds, normalize cadence to `daily`, `weekdays`, or `weekly`, normalize `HH:mm`, dedupe weekdays, and return only `{ id, kind, cadence, timeOfDay, weekdays, enabled }`.

- [x] **Step 3: Run focused tests.**

Run: `node --test tests/client-wellness.test.mjs`
Expected: PASS.

### Task 2: Owner-Scoped Reminder Schedule Action

**Files:**
- Modify: `app/wellness/actions.ts`
- Modify: `tests/client-wellness.test.mjs`
- Modify: `tests/client-wellness-source-guards.test.mjs`

- [x] **Step 1: Add action/source tests.**

Assert `app/wellness/actions.ts` imports `normalizeClientWellnessReminderSchedules`, exports `updateClientWellnessReminderSchedulesAction`, requires `currentUserId()`, reads a `reminderSchedules` JSON field, loads the existing `clientWellnessPreference` by `userId`, and upserts settings with merged `reminderSchedules`.

Also assert this action source does not contain `CalendarEvent`, `CalendarReminder`, `CalendarNotificationIntent`, `sendEmail`, `sendSms`, `webPush`, `practiceId`, or `therapistId`.

- [x] **Step 2: Implement a JSON-array form reader.**

Add:

```ts
function jsonArrayValue(formData: FormData, key: string) {
  const value = stringValue(formData, key)
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
```

- [x] **Step 3: Implement `updateClientWellnessReminderSchedulesAction(formData)`.**

The action must:

1. Return `sign-in-required` for anonymous requests.
2. Normalize `reminderSchedules` with `normalizeClientWellnessReminderSchedules`.
3. Read the user's current `ClientWellnessPreference`.
4. Merge `{ ...existingSettings, reminderSchedules }`.
5. Upsert only by `{ userId }`.
6. Revalidate `/wellness`.
7. Return the normalized schedules.

- [x] **Step 4: Run focused tests.**

Run:

```powershell
node --test tests/client-wellness.test.mjs
node --test tests/client-wellness-source-guards.test.mjs
```

Expected: PASS.

### Task 3: Wellness Calendar Companion UI

**Files:**
- Create: `components/wellness/wellness-calendar-companion.tsx`
- Modify: `components/wellness/wellness-hub-client.tsx`
- Modify: `app/wellness/page.tsx`

- [x] **Step 1: Serialize client appointments in `app/wellness/page.tsx`.**

For signed-in users only, query appointments with:

```ts
where: {
  practiceClient: { userId },
}
```

Include only practice name/timezone, therapist name/email, service snapshot names, status, source, and start/end times. Do not include appointment notes or practice-client contact fields.

- [x] **Step 2: Load saved reminder schedules from `ClientWellnessPreference.settings`.**

Use `normalizeClientWellnessReminderSchedules(preference?.settings?.reminderSchedules)` before passing data to the client component.

- [x] **Step 3: Create `WellnessCalendarCompanion`.**

Props:

```ts
type WellnessCalendarCompanionProps = {
  isSignedIn: boolean
  appointments: WellnessAppointmentSummary[]
  reminderSchedules: ClientWellnessReminderSchedule[]
}
```

Render:

- Upcoming appointments, past appointments, and empty states.
- Generic appointment labels and times.
- A reminder schedule form with kind, cadence, time, weekday controls, add/update/remove, and save.
- Anonymous practice mode that keeps schedules in component state and shows a sign-in prompt for persistence.

- [x] **Step 4: Wire the component into `WellnessHubClient`.**

Add props for `appointments` and `reminderSchedules`, render the companion between the privacy panel and the quick-log form, and keep the existing timeline/ROM behavior unchanged.

### Task 4: Docs And Validation

**Files:**
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [x] **Step 1: Update current state.**

Record that `/wellness` now includes a client calendar companion with own appointment summaries and owner-scoped generic wellness reminder schedules.

- [x] **Step 2: Update project log.**

Add a 2026-06-16 entry linking this plan and summarizing the branch outcome.

- [x] **Step 3: Run validation.**

Run:

```powershell
node --test tests/client-wellness.test.mjs
node --test tests/client-wellness-source-guards.test.mjs
npm run typecheck
npm run lint
npm run build
```

Expected: PASS.

## Acceptance Criteria

- Signed-in `/wellness` users can see their own upcoming and past appointments if their account is attached to `PracticeClient.userId`.
- Appointment companion data excludes appointment notes, client contact fields, clinical/professional-record data, and therapist-only management controls.
- Signed-in users can create, update, remove, and persist generic wellness reminder schedules.
- Anonymous visitors can try reminder schedule setup in memory only and see that schedules require sign-in to persist.
- Reminder schedules are stored only in `ClientWellnessPreference.settings.reminderSchedules`, not in practice `CalendarReminder`, `CalendarNotificationIntent`, audit metadata, account preferences, Sentry, email/SMS, or web push.
- Existing quick log, body sensation tracker, ROM measurement, export, delete, and timeline filters continue working.
