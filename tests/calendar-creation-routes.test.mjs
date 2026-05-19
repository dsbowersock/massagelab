import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const requiredCalendarRoutes = [
  "app/calendar/new/page.tsx",
  "app/calendar/new/appointment/page.tsx",
  "app/calendar/new/personal/page.tsx",
  "app/calendar/new/class/page.tsx",
  "app/calendar/new/reminder/page.tsx",
  "app/calendar/requests/page.tsx",
  "app/calendar/services/page.tsx",
  "app/calendar/services/new/page.tsx",
  "app/calendar/services/[serviceId]/page.tsx",
  "app/calendar/calendar-workspace.tsx",
  "app/calendar/new/appointment/appointment-composer.tsx",
]

describe("calendar creation route wiring", () => {
  it("ships dedicated pages for every planned calendar creation flow", async () => {
    const pages = await Promise.all(requiredCalendarRoutes.map((file) => readFile(file, "utf8")))
    const combined = pages.join("\n")

    assert.equal(combined.includes("Appointment"), true)
    assert.equal(combined.includes("Personal"), true)
    assert.equal(combined.includes("Class"), true)
    assert.equal(combined.includes("Reminder"), true)
    assert.equal(combined.includes("Requests"), true)
    assert.equal(combined.includes("Service"), true)
    assert.equal(combined.includes("FullCalendar"), true)
    assert.equal(combined.includes("AppointmentComposer"), true)
  })

  it("exposes server actions for creation, rescheduling, preferences, availability, and request review", async () => {
    const actions = await readFile("app/calendar/actions.ts", "utf8")

    assert.match(actions, /export async function createAppointmentAction/)
    assert.match(actions, /export async function createPersonalEventAction/)
    assert.match(actions, /export async function createClassAction/)
    assert.match(actions, /export async function createReminderAction/)
    assert.match(actions, /export async function createServiceAction/)
    assert.match(actions, /export async function updateServiceAction/)
    assert.match(actions, /export async function saveCalendarPreferencesAction/)
    assert.match(actions, /export async function createAvailabilityScheduleAction/)
    assert.match(actions, /export async function createAvailabilityOverrideAction/)
    assert.match(actions, /export async function rescheduleCalendarEventAction/)
    assert.match(actions, /export async function updateAppointmentRequestStatusAction/)
    assert.equal(actions.includes("sendMail"), false)
    assert.equal(actions.includes("sendVerificationEmail"), false)
  })
})
