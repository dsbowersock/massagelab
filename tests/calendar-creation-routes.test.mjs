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
    const [composer, actions] = await Promise.all([
      readFile("app/calendar/new/appointment/appointment-composer.tsx", "utf8"),
      readFile("app/calendar/actions.ts", "utf8"),
    ])

    assert.match(composer, /useActionState\(createAppointmentFormAction/)
    assert.match(composer, /name="allowOutsideAvailability"/)
    assert.match(composer, /outside-availability/)
    assert.match(actions, /class OutsideProviderAvailabilityError/)
    assert.match(actions, /export async function createAppointmentFormAction/)
    assert.match(actions, /allowOutsideAvailability/)
  })
})
