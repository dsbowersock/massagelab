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
    const [actions, setupActions, preferenceActions, rescheduleActions] = await Promise.all([
      readFile("app/calendar/actions.ts", "utf8"),
      readFile("app/calendar/actions/setup.ts", "utf8"),
      readFile("app/calendar/actions/preferences.ts", "utf8"),
      readFile("app/calendar/actions/reschedule.ts", "utf8"),
    ])

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
    assert.match(actions, /return createAvailabilitySchedule\(formData\)/)
    assert.match(actions, /return createAvailabilityOverride\(formData\)/)
    assert.match(actions, /return createPractice\(formData\)/)
    assert.match(actions, /return createAvailabilityRule\(formData\)/)
    assert.match(setupActions, /export async function createAvailabilitySchedule\(formData: FormData\)/)
    assert.match(setupActions, /export async function createAvailabilityOverride\(formData: FormData\)/)
    assert.match(setupActions, /export async function createPractice\(formData: FormData\)/)
    assert.match(setupActions, /export async function createAvailabilityRule\(formData: FormData\)/)
    assert.match(actions, /^"use server"/)
    assert.match(preferenceActions, /import "server-only"/)
    assert.match(setupActions, /import "server-only"/)
    assert.match(rescheduleActions, /import "server-only"/)
    assert.doesNotMatch(preferenceActions, /^"use server"/)
    assert.doesNotMatch(setupActions, /^"use server"/)
    assert.doesNotMatch(rescheduleActions, /^"use server"/)
    assert.equal(actions.includes("sendMail"), false)
    assert.equal(actions.includes("sendVerificationEmail"), false)
  })

  it("keeps service catalog mutations behind stable action exports", async () => {
    const [actions, serviceActions, serviceForm] = await Promise.all([
      readFile("app/calendar/actions.ts", "utf8"),
      readFile("app/calendar/actions/services.ts", "utf8"),
      readFile("app/calendar/services/service-form.tsx", "utf8"),
    ])
    const createServiceAction = exportedActionBody(actions, "createServiceAction")
    const updateServiceAction = exportedActionBody(actions, "updateServiceAction")

    assert.match(serviceForm, /import \{ createServiceAction, updateServiceAction \} from "@\/app\/calendar\/actions"/)
    assert.match(actions, /from "\.\/actions\/services"/)
    assert.match(createServiceAction, /return createService\(formData\)/)
    assert.match(updateServiceAction, /return updateService\(formData\)/)
    assert.match(serviceActions, /export async function createService\(formData: FormData\)/)
    assert.match(serviceActions, /export async function updateService\(formData: FormData\)/)
    assert.match(serviceActions, /function parseServiceVariants\(formData: FormData\)/)
    assert.match(serviceActions, /async function ensureCalendarResources/)
    assert.match(serviceActions, /async function assertServiceCatalogLimits/)
    assert.match(serviceActions, /resultingActive: boolean/)
    assert.match(serviceActions, /id: \{ not: updatingServiceId \}/)
    assert.match(serviceActions, /assertServiceCatalogLimits\(\{ practiceId, userId, variantCount: variants\.length, resultingActive \}\)/)
    assert.match(serviceActions, /updatingServiceId: serviceId/)
    assert.match(serviceActions, /prepNotes: String\(policyFields\.prepNotes \?\? ""\) \|\| null/)
    assert.doesNotMatch(serviceActions, /if \(!serviceId \|\| !name\)/)

    const updateServiceStart = serviceActions.indexOf("export async function updateService")
    const updateServiceIdCheck = serviceActions.indexOf("if (!serviceId)", updateServiceStart)
    const updateLimitCheck = serviceActions.indexOf("await assertServiceCatalogLimits({", updateServiceStart)
    assert.ok(updateServiceIdCheck > updateServiceStart)
    assert.ok(updateLimitCheck > updateServiceIdCheck)
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
    const [appointmentPage, composer, eventActions] = await Promise.all([
      readFile("app/calendar/new/appointment/page.tsx", "utf8"),
      readFile("app/calendar/new/appointment/appointment-composer.tsx", "utf8"),
      readFile("app/calendar/actions/events.ts", "utf8"),
    ])

    assert.equal(appointmentPage.includes("clients.length === 0"), false)
    assert.match(composer, /name="newClientName"/)
    assert.match(composer, /name="newClientEmail"/)
    assert.match(composer, /value=\{NEW_CLIENT_VALUE\}/)
    assert.match(eventActions, /fieldString\(formData, "newClientName"\)/)
    assert.match(eventActions, /ensureAppointmentPracticeClient/)
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
    const [composer, actions, eventActions, availability] = await Promise.all([
      readFile("app/calendar/new/appointment/appointment-composer.tsx", "utf8"),
      readFile("app/calendar/actions.ts", "utf8"),
      readFile("app/calendar/actions/events.ts", "utf8"),
      readFile("app/calendar/actions/availability.ts", "utf8"),
    ])

    assert.match(composer, /useActionState\(createAppointmentFormAction/)
    assert.match(composer, /name="allowOutsideAvailability"/)
    assert.match(composer, /outside-availability/)
    assert.match(composer, /outsideAvailabilityReady \?/)
    assert.match(availability, /class OutsideProviderAvailabilityError/)
    assert.match(actions, /export async function createAppointmentFormAction/)
    assert.match(eventActions, /allowOutsideAvailability/)
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
    const [eventActions, availability] = await Promise.all([
      readFile("app/calendar/actions/events.ts", "utf8"),
      readFile("app/calendar/actions/availability.ts", "utf8"),
    ])

    assert.match(eventActions, /lockAppointmentSchedulingRows\(tx/)
    assert.match(eventActions, /assertProviderAvailability\(\{\s*db:\s*tx/)
    assert.match(eventActions, /assertNoCalendarEventConflict\(\{\s*db:\s*tx/)
    assert.match(eventActions, /assertNoResourceConflict\(\{\s*db:\s*tx/)
    assert.match(eventActions, /practiceClientId:\s*practiceClient\.id/)
    assert.match(availability, /SELECT[\s\S]+FOR UPDATE/)
  })

  it("converts client appointment request times with the practice timezone", async () => {
    const eventActions = await readFile("app/calendar/actions/events.ts", "utf8")
    const requestAppointment = exportedActionBody(eventActions, "requestAppointment")

    assert.match(requestAppointment, /localDateTimeToUtc\(startsAtValue,\s*practice\.timezone\)/)
    assert.doesNotMatch(requestAppointment, /localDateTime\(fieldString\(formData,\s*"startsAt"\)\)/)
  })

  it("locks scheduling rows inside every blocking calendar mutation transaction", async () => {
    const [rescheduleActions, eventActions] = await Promise.all([
      readFile("app/calendar/actions/reschedule.ts", "utf8"),
      readFile("app/calendar/actions/events.ts", "utf8"),
    ])
    const blockingActions = [
      {
        label: "createPersonalEventAction",
        name: "createPersonalEvent",
        source: eventActions,
        checks: ["assertNoCalendarEventConflict"],
      },
      {
        label: "rescheduleCalendarEventAction",
        name: "rescheduleCalendarEvent",
        source: rescheduleActions,
        checks: ["assertProviderAvailability", "assertNoCalendarEventConflict", "assertNoResourceConflict"],
      },
      {
        label: "createClassAction",
        name: "createClass",
        source: eventActions,
        checks: ["assertProviderAvailability", "assertNoCalendarEventConflict", "assertNoResourceConflict"],
      },
      {
        label: "requestAppointmentAction",
        name: "requestAppointment",
        source: eventActions,
        checks: ["assertProviderAvailability", "assertNoCalendarEventConflict", "assertNoResourceConflict"],
      },
      {
        label: "updateAppointmentRequestStatusAction",
        name: "updateAppointmentRequestStatus",
        source: eventActions,
        checks: ["assertNoCalendarEventConflict", "assertNoResourceConflict"],
      },
    ]

    for (const { label, name, source, checks } of blockingActions) {
      const body = exportedActionBody(source, name)
      const transactionStart = body.indexOf("await prisma.$transaction(async (tx) => {")
      assert.notEqual(transactionStart, -1, `${label} should use a transaction`)
      const transactionBody = body.slice(transactionStart)
      const lockIndex = transactionBody.indexOf("await lockAppointmentSchedulingRows(tx")
      assert.notEqual(lockIndex, -1, `${label} should lock scheduling rows inside the transaction`)

      for (const check of checks) {
        const checkIndex = transactionBody.indexOf(`${check}({`)
        assert.notEqual(checkIndex, -1, `${label} should re-run ${check} inside the transaction`)
        assert.ok(lockIndex < checkIndex, `${label} should lock before ${check}`)
        assert.match(transactionBody.slice(checkIndex, checkIndex + 120), /db:\s*tx/, `${label} should run ${check} with tx`)
      }
    }

    assert.match(
      await readFile("app/calendar/actions/availability.ts", "utf8"),
      /SELECT id[\s\S]+FROM "CalendarEvent"[\s\S]+ORDER BY id[\s\S]+FOR UPDATE/,
    )
  })

  it("serializes calendar preference patches before merging and upserting", async () => {
    const preferenceActions = await readFile("app/calendar/actions/preferences.ts", "utf8")
    const body = exportedActionBody(preferenceActions, "saveCalendarPreferences")

    assert.match(preferenceActions, /function lockCalendarPreferenceOwner\(tx: Prisma\.TransactionClient,\s*userId: string\)/)
    assert.match(preferenceActions, /FROM "User"[\s\S]+FOR UPDATE/)
    assert.match(body, /await prisma\.\$transaction\(async \(tx\) => \{/)

    const lockIndex = body.indexOf("await lockCalendarPreferenceOwner(tx, userId)")
    const readIndex = body.indexOf("await tx.userPreference.findUnique")
    const mergeIndex = body.indexOf("mergeCalendarPreferencePatch")
    const writeIndex = body.indexOf("return tx.userPreference.upsert")

    assert.notEqual(lockIndex, -1, "preference writes should lock the user before reading")
    assert.notEqual(readIndex, -1, "preference writes should read inside the transaction")
    assert.notEqual(mergeIndex, -1, "preference writes should merge after reading the locked row")
    assert.notEqual(writeIndex, -1, "preference writes should upsert inside the transaction")
    assert.ok(lockIndex < readIndex, "preference writes should lock before reading")
    assert.ok(readIndex < mergeIndex, "preference writes should merge the latest locked preferences")
    assert.ok(mergeIndex < writeIndex, "preference writes should write the merged patch")
  })

  it("rechecks reschedule editability against the locked current event", async () => {
    const [rescheduleActions, availabilityActions] = await Promise.all([
      readFile("app/calendar/actions/reschedule.ts", "utf8"),
      readFile("app/calendar/actions/availability.ts", "utf8"),
    ])
    const body = exportedActionBody(rescheduleActions, "rescheduleCalendarEvent")

    assert.match(rescheduleActions, /function hasStaleRescheduleSnapshot/)
    assert.match(rescheduleActions, /currentEvent\.startsAt\.getTime\(\) !== snapshot\.startsAt\.getTime\(\)/)
    assert.match(rescheduleActions, /currentEvent\.endsAt\.getTime\(\) !== snapshot\.endsAt\.getTime\(\)/)
    assert.match(rescheduleActions, /currentEvent\.status !== snapshot\.status/)
    assert.match(rescheduleActions, /currentEvent\.ownerUserId !== snapshot\.ownerUserId/)
    assert.match(rescheduleActions, /currentResourceIds !== snapshotResourceIds/)
    assert.match(availabilityActions, /eventIds = \[\]/)
    assert.match(availabilityActions, /id IN \(\$\{Prisma\.join\(uniqueEventIds\)\}\)/)
    assert.match(availabilityActions, /ORDER BY id[\s\S]+FOR UPDATE/)
    assert.match(body, /const rescheduledEvent = await prisma\.\$transaction\(async \(tx\) => \{/)

    const snapshotOwnerIndex = body.indexOf("const snapshotOwnerUserId = event.ownerUserId")
    const schedulingLockIndex = body.indexOf("await lockAppointmentSchedulingRows(tx,")
    const targetEventIdIndex = body.indexOf("eventIds: [event.id]")
    const currentReadIndex = body.indexOf("const currentEvent = await getRescheduleEvent(tx, event.id)")
    const membershipIndex = body.indexOf("const currentMembership = await tx.practiceMembership.findUnique")
    const permissionIndex = body.indexOf("canRescheduleCalendarEvent({ role: currentMembership.role")
    const staleCheckIndex = body.indexOf("hasStaleRescheduleSnapshot(currentEvent, event)")
    const updateIndex = body.indexOf("where: { id: currentEvent.id }")

    assert.notEqual(snapshotOwnerIndex, -1, "reschedule should keep the pre-transaction owner snapshot")
    assert.notEqual(schedulingLockIndex, -1, "reschedule should keep schedule-window locks")
    assert.notEqual(targetEventIdIndex, -1, "reschedule should lock the target event inside the scheduling lock phase")
    assert.notEqual(currentReadIndex, -1, "reschedule should re-read the event inside the transaction")
    assert.notEqual(membershipIndex, -1, "reschedule should re-read actor membership inside the transaction")
    assert.notEqual(permissionIndex, -1, "reschedule should re-run editability and owner checks")
    assert.notEqual(staleCheckIndex, -1, "reschedule should reject stale event snapshots")
    assert.notEqual(updateIndex, -1, "reschedule should update the locked current event")
    assert.ok(snapshotOwnerIndex < schedulingLockIndex, "reschedule should lock from the pre-transaction snapshot")
    assert.ok(schedulingLockIndex < targetEventIdIndex, "reschedule should pass the target id into the scheduling lock phase")
    assert.ok(targetEventIdIndex < currentReadIndex, "reschedule should read after locking the target row")
    assert.ok(currentReadIndex < membershipIndex, "reschedule should use the locked current event for membership checks")
    assert.ok(membershipIndex < permissionIndex, "reschedule should re-run permission after reading current membership")
    assert.ok(permissionIndex < staleCheckIndex, "reschedule should check staleness after confirming current editability")
    assert.ok(staleCheckIndex < updateIndex, "reschedule should update only after rejecting stale snapshots")
  })

  it("checks free-practice quota inside the locked creation transaction", async () => {
    const setupActions = await readFile("app/calendar/actions/setup.ts", "utf8")
    const body = exportedActionBody(setupActions, "createPractice")

    assert.match(setupActions, /function lockPracticeCreationOwner\(tx: Prisma\.TransactionClient,\s*userId: string\)/)
    assert.match(setupActions, /function lockPracticeSlugAllocation\(tx: Prisma\.TransactionClient\)/)
    assert.match(setupActions, /FROM "User"[\s\S]+FOR UPDATE/)
    assert.match(setupActions, /pg_advisory_xact_lock/)
    assert.match(body, /await prisma\.\$transaction\(async \(tx\) => \{/)

    const lockIndex = body.indexOf("await lockPracticeCreationOwner(tx, userId)")
    const slugLockIndex = body.indexOf("await lockPracticeSlugAllocation(tx)")
    const countIndex = body.indexOf("await tx.practiceMembership.count")
    const slugReadIndex = body.indexOf("await tx.practice.findUnique")
    const createIndex = body.indexOf("return tx.practice.create")

    assert.notEqual(lockIndex, -1, "practice creation should lock the owner before quota checks")
    assert.notEqual(slugLockIndex, -1, "practice creation should lock slug allocation")
    assert.notEqual(countIndex, -1, "free-practice quota should be counted inside the transaction")
    assert.notEqual(slugReadIndex, -1, "slug lookup should happen inside the slug allocation lock")
    assert.notEqual(createIndex, -1, "practice creation should happen inside the transaction")
    assert.ok(lockIndex < slugLockIndex, "practice creation should lock owner before global slug allocation")
    assert.ok(slugLockIndex < countIndex, "practice creation should hold the slug lock before quota and slug checks")
    assert.ok(countIndex < createIndex, "practice creation should create only after the quota check")
    assert.ok(slugReadIndex < createIndex, "practice creation should create only after slug lookup")
    assert.match(body, /FEATURE_KEYS\.calendarFullScheduling/)
  })

  it("uses unique availability time input ids without changing submitted field names", async () => {
    const [availabilityPage, setupActions] = await Promise.all([
      readFile("app/calendar/availability/page.tsx", "utf8"),
      readFile("app/calendar/actions/setup.ts", "utf8"),
    ])

    assert.match(availabilityPage, /idPrefix="weekly-rule"/)
    assert.match(availabilityPage, /idPrefix="named-schedule"/)
    assert.match(availabilityPage, /htmlFor=\{`\$\{idPrefix\}-startTime`\}/)
    assert.match(availabilityPage, /id=\{`\$\{idPrefix\}-startTime`\}\s+name="startTime"/)
    assert.match(availabilityPage, /formatPracticeDate\(override\.date,\s*membership\.practice\.timezone\)/)
    assert.equal(availabilityPage.includes("override.date.toISOString().slice(0, 10)"), false)
    assert.match(setupActions, /function parseDayOfWeek\(formData: FormData\)/)
    assert.doesNotMatch(setupActions, /Number\(fieldString\(formData,\s*"dayOfWeek"\)\)/)
    assert.match(setupActions, /effectiveToDate < effectiveFromDate/)
  })

  it("documents the reschedule action transaction contract", async () => {
    const rescheduleActions = await readFile("app/calendar/actions/reschedule.ts", "utf8")

    assert.match(rescheduleActions, /Reschedules an existing calendar event/)
    assert.match(rescheduleActions, /outside-availability confirmation/)
    assert.match(rescheduleActions, /conflict checks/)
    assert.match(rescheduleActions, /audit writes/)
  })

  it("persists notice dismissal patches without spreading stale calendar preferences", async () => {
    const [notice, actions, preferenceActions] = await Promise.all([
      readFile("app/calendar/calendar-guidance-notice.tsx", "utf8"),
      readFile("app/calendar/actions.ts", "utf8"),
      readFile("app/calendar/actions/preferences.ts", "utf8"),
    ])

    assert.match(notice, /saveCalendarPreferencesAction\(\{\s*noticeDismissals:/)
    assert.equal(notice.includes("...preferences,\n        noticeDismissals"), false)
    assert.match(actions, /return saveCalendarPreferences\(input\)/)
    assert.match(preferenceActions, /mergeCalendarPreferencePatch/)
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
