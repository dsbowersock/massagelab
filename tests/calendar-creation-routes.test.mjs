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
  "app/calendar/calendar-operator-shell.tsx",
  "app/calendar/new/appointment/appointment-composer.tsx",
]

function exportedActionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `${name} should be exported`)
  const next = source.indexOf("\nexport async function ", start + 1)
  return source.slice(start, next === -1 ? source.length : next)
}

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
    assert.equal(combined.includes("CalendarOperatorShell"), true)
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

  it("keeps operator calendar chrome out of the public booking page", async () => {
    const [layoutWrapper, bookingPage, toolbarContext, topBar] = await Promise.all([
      readFile("components/layout-wrapper.tsx", "utf8"),
      readFile("app/book/[practiceSlug]/page.tsx", "utf8"),
      readFile("components/calendar/calendar-operator-toolbar-context.tsx", "utf8"),
      readFile("components/calendar/calendar-operator-top-bar.tsx", "utf8"),
    ])

    assert.match(layoutWrapper, /CalendarOperatorTopBar/)
    assert.match(layoutWrapper, /CalendarOperatorToolbarProvider/)
    assert.match(layoutWrapper, /pathname\.startsWith\("\/calendar\/"\)/)
    assert.match(toolbarContext, /useCalendarOperatorToolbarControls/)
    assert.match(topBar, /useCalendarOperatorToolbarSlot/)
    assert.match(topBar, /TooltipContent/)
    assert.equal(bookingPage.includes("CalendarOperatorTopBar"), false)
    assert.equal(bookingPage.includes("CalendarOperatorShell"), false)
  })

  it("routes empty calendar clicks to the creation chooser with the selected start time", async () => {
    const [workspace, creationMenu] = await Promise.all([
      readFile("app/calendar/calendar-workspace.tsx", "utf8"),
      readFile("app/calendar/new/page.tsx", "utf8"),
    ])

    assert.match(workspace, /\/calendar\/new\?startsAt=/)
    assert.equal(workspace.includes("/calendar/new/appointment?startsAt="), false)
    assert.match(creationMenu, /searchParams\?: Promise<\{ startsAt\?: string \}>/)
    assert.match(creationMenu, /href=\{withStartsAt\(flow\.href\)\}/)
  })

  it("lets staff create a practice client while composing an appointment", async () => {
    const [appointmentPage, composer, actions] = await Promise.all([
      readFile("app/calendar/new/appointment/page.tsx", "utf8"),
      readFile("app/calendar/new/appointment/appointment-composer.tsx", "utf8"),
      readFile("app/calendar/actions.ts", "utf8"),
    ])

    assert.equal(appointmentPage.includes("clients.length === 0"), false)
    assert.match(composer, /name="newClientName"/)
    assert.match(composer, /name="newClientEmail"/)
    assert.match(composer, /value=\{NEW_CLIENT_VALUE\}/)
    assert.match(actions, /fieldString\(formData, "newClientName"\)/)
    assert.match(actions, /ensureAppointmentPracticeClient/)
  })

  it("moves calendar controls into the operator toolbar and hides team controls for solo providers", async () => {
    const workspace = await readFile("app/calendar/calendar-workspace.tsx", "utf8")

    assert.match(workspace, /useCalendarOperatorToolbarControls/)
    assert.match(workspace, /CalendarDisplaySettings/)
    assert.match(workspace, /const hasMultipleProviders = providers\.length > 1/)
    assert.match(workspace, /showProviderControls=\{hasMultipleProviders\}/)
    assert.equal(workspace.includes("<CardHeader"), false)
    assert.equal(workspace.includes("CardTitle"), false)
  })

  it("keeps the calendar workspace on a full-height parent chain", async () => {
    const [workspace, globals] = await Promise.all([
      readFile("app/calendar/calendar-workspace.tsx", "utf8"),
      readFile("app/globals.css", "utf8"),
    ])

    assert.match(workspace, /className="min-h-0 h-full/)
    assert.match(workspace, /className="ml-calendar-surface flex min-h-0 flex-1/)
    assert.match(workspace, /updateSize/)
    assert.match(globals, /\.ml-calendar-surface \.fc,/)
    assert.match(globals, /\.ml-calendar-surface \.fc-view-harness,/)
    assert.match(globals, /\.ml-calendar-surface \.fc-view-harness-active/)
  })

  it("moves calendar toolbar controls to a secondary row when the top bar is crowded", async () => {
    const topBar = await readFile("components/calendar/calendar-operator-top-bar.tsx", "utf8")

    assert.match(topBar, /ResizeObserver/)
    assert.match(topBar, /setControlsOverflowing/)
    assert.match(topBar, /ml-calendar-medial-toolbar/)
    assert.match(topBar, /primaryToolbarMeasureRef/)
    assert.match(topBar, /secondaryToolbar/)
  })

  it("warns before allowing manual appointment creation outside provider availability", async () => {
    const [composer, actions, availability] = await Promise.all([
      readFile("app/calendar/new/appointment/appointment-composer.tsx", "utf8"),
      readFile("app/calendar/actions.ts", "utf8"),
      readFile("app/calendar/actions/availability.ts", "utf8"),
    ])

    assert.match(composer, /useActionState\(createAppointmentFormAction/)
    assert.match(composer, /name="allowOutsideAvailability"/)
    assert.match(composer, /outside-availability/)
    assert.match(composer, /outsideAvailabilityReady \?/)
    assert.match(availability, /class OutsideProviderAvailabilityError/)
    assert.match(actions, /export async function createAppointmentFormAction/)
    assert.match(actions, /allowOutsideAvailability/)
  })

  it("keeps ongoing resource bookings in public booking availability checks", async () => {
    const publicBookingSequences = await readFile("lib/public-booking-sequences.js", "utf8")
    const resourceQueryStart = publicBookingSequences.indexOf("db.calendarResourceBooking.findMany")
    const resourceQueryEnd = publicBookingSequences.indexOf("select: { resourceId: true, startsAt: true, endsAt: true }")

    assert.notEqual(resourceQueryStart, -1, "Expected resource booking query start marker to exist.")
    assert.notEqual(resourceQueryEnd, -1, "Expected resource booking query select marker to exist.")

    const resourceQuery = publicBookingSequences.slice(resourceQueryStart, resourceQueryEnd)

    assert.match(resourceQuery, /endsAt:\s*\{\s*gte:\s*now\s*\}/)
    assert.doesNotMatch(resourceQuery, /startsAt:\s*\{\s*gte:\s*now\s*\}/)
    assert.match(resourceQuery, /resource:\s*\{\s*practiceId\s*\}/)
  })

  it("rechecks appointment conflicts inside the write transaction and links the canonical client", async () => {
    const [actions, availability] = await Promise.all([
      readFile("app/calendar/actions.ts", "utf8"),
      readFile("app/calendar/actions/availability.ts", "utf8"),
    ])

    assert.match(actions, /lockAppointmentSchedulingRows\(tx/)
    assert.match(actions, /assertProviderAvailability\(\{\s*db:\s*tx/)
    assert.match(actions, /assertNoCalendarEventConflict\(\{\s*db:\s*tx/)
    assert.match(actions, /assertNoResourceConflict\(\{\s*db:\s*tx/)
    assert.match(actions, /practiceClientId:\s*practiceClient\.id/)
    assert.match(availability, /SELECT[\s\S]+FOR UPDATE/)
  })

  it("locks scheduling rows inside every blocking calendar mutation transaction", async () => {
    const actions = await readFile("app/calendar/actions.ts", "utf8")
    const blockingActions = [
      {
        name: "createPersonalEventAction",
        checks: ["assertNoCalendarEventConflict"],
      },
      {
        name: "rescheduleCalendarEventAction",
        checks: ["assertProviderAvailability", "assertNoCalendarEventConflict", "assertNoResourceConflict"],
      },
      {
        name: "createClassAction",
        checks: ["assertProviderAvailability", "assertNoCalendarEventConflict", "assertNoResourceConflict"],
      },
      {
        name: "requestAppointmentAction",
        checks: ["assertProviderAvailability", "assertNoCalendarEventConflict", "assertNoResourceConflict"],
      },
      {
        name: "updateAppointmentRequestStatusAction",
        checks: ["assertNoCalendarEventConflict", "assertNoResourceConflict"],
      },
    ]

    for (const { name, checks } of blockingActions) {
      const body = exportedActionBody(actions, name)
      const transactionStart = body.indexOf("await prisma.$transaction(async (tx) => {")
      assert.notEqual(transactionStart, -1, `${name} should use a transaction`)
      const transactionBody = body.slice(transactionStart)
      const lockIndex = transactionBody.indexOf("await lockAppointmentSchedulingRows(tx")
      assert.notEqual(lockIndex, -1, `${name} should lock scheduling rows inside the transaction`)

      for (const check of checks) {
        const checkIndex = transactionBody.indexOf(`${check}({`)
        assert.notEqual(checkIndex, -1, `${name} should re-run ${check} inside the transaction`)
        assert.ok(lockIndex < checkIndex, `${name} should lock before ${check}`)
        assert.match(transactionBody.slice(checkIndex, checkIndex + 120), /db:\s*tx/, `${name} should run ${check} with tx`)
      }
    }
  })

  it("uses unique availability time input ids without changing submitted field names", async () => {
    const availabilityPage = await readFile("app/calendar/availability/page.tsx", "utf8")

    assert.match(availabilityPage, /idPrefix="weekly-rule"/)
    assert.match(availabilityPage, /idPrefix="named-schedule"/)
    assert.match(availabilityPage, /htmlFor=\{`\$\{idPrefix\}-startTime`\}/)
    assert.match(availabilityPage, /id=\{`\$\{idPrefix\}-startTime`\}\s+name="startTime"/)
    assert.match(availabilityPage, /formatPracticeDate\(override\.date,\s*membership\.practice\.timezone\)/)
    assert.equal(availabilityPage.includes("override.date.toISOString().slice(0, 10)"), false)
  })

  it("persists notice dismissal patches without spreading stale calendar preferences", async () => {
    const [notice, actions] = await Promise.all([
      readFile("app/calendar/calendar-guidance-notice.tsx", "utf8"),
      readFile("app/calendar/actions.ts", "utf8"),
    ])

    assert.match(notice, /saveCalendarPreferencesAction\(\{\s*noticeDismissals:/)
    assert.equal(notice.includes("...preferences,\n        noticeDismissals"), false)
    assert.match(actions, /mergeCalendarPreferencePatch/)
  })

  it("keeps service variants and resources documented as catalog entities, not event detail records", async () => {
    const [roadmap, flows] = await Promise.all([
      readFile("docs/roadmap.md", "utf8"),
      readFile("lib/calendar-flows.js", "utf8"),
    ])

    assert.match(roadmap, /shared `CalendarEvent` index with specialized appointment, personal block, class, and reminder records/)
    assert.match(roadmap, /service variants and resources as catalog entities/)
    assert.equal(roadmap.includes("class, reminder, service variant, and resource records"), false)
    assert.match(flows, /const PRACTICE_MANAGEMENT_ROLES = STAFF_ROLES/)
  })
})
