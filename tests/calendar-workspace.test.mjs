import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCalendarWorkspaceEvent,
  buildExternalCalendarBusyWorkspaceEvent,
  canRescheduleCalendarEvent,
  calendarEventEditable,
} from "../lib/calendar-workspace.js"

describe("operator calendar workspace helpers", () => {
  it("limits drag changes to editable scheduling events with conservative role rules", () => {
    const appointment = { id: "event_1", kind: "APPOINTMENT", status: "CONFIRMED", ownerUserId: "therapist_1", blocksAvailability: true }
    const reminder = { id: "event_2", kind: "REMINDER", status: "ACTIVE", ownerUserId: "therapist_1", blocksAvailability: false }
    const cancelled = { id: "event_3", kind: "APPOINTMENT", status: "CANCELLED", ownerUserId: "therapist_1", blocksAvailability: true }

    assert.equal(calendarEventEditable(appointment), true)
    assert.equal(calendarEventEditable(reminder), false)
    assert.equal(calendarEventEditable(cancelled), false)

    assert.equal(canRescheduleCalendarEvent({ role: "OWNER", actorUserId: "owner_1", event: appointment }), true)
    assert.equal(canRescheduleCalendarEvent({ role: "STAFF", actorUserId: "staff_1", event: appointment }), true)
    assert.equal(canRescheduleCalendarEvent({ role: "THERAPIST", actorUserId: "therapist_1", event: appointment }), true)
    assert.equal(canRescheduleCalendarEvent({ role: "THERAPIST", actorUserId: "therapist_2", event: appointment }), false)
    assert.equal(canRescheduleCalendarEvent({ role: "CLIENT", actorUserId: "client_1", event: appointment }), false)
    assert.equal(canRescheduleCalendarEvent({ role: "OWNER", actorUserId: "owner_1", event: reminder }), false)
  })

  it("maps calendar events to client workspace events with service colors and status badges", () => {
    const event = buildCalendarWorkspaceEvent({
      id: "event_1",
      kind: "APPOINTMENT",
      title: "Therapeutic massage",
      startsAt: "2026-05-18T13:00:00.000Z",
      endsAt: "2026-05-18T14:00:00.000Z",
      status: "REQUESTED",
      ownerUserId: "therapist_1",
      appointment: {
        serviceColor: "#86b817",
        serviceName: "Therapeutic massage",
        practiceClient: { displayName: "Client One" },
        therapist: { name: "Provider One" },
      },
    }, { colorMode: "service", showStatusBadges: true })

    assert.equal(event.id, "event_1")
    assert.equal(event.title, "Therapeutic massage")
    assert.equal(event.backgroundColor, "#86b817")
    assert.equal(event.extendedProps.statusBadge, "Requested")
    assert.equal(event.extendedProps.providerLabel, "Provider One")
    assert.equal(event.extendedProps.clientLabel, "Client One")
    assert.equal(event.editable, true)
    assert.equal(event.durationEditable, false)
  })

  it("maps external busy blocks to read-only generic workspace events", () => {
    const event = buildExternalCalendarBusyWorkspaceEvent({
      id: "busy_1",
      startsAt: "2026-07-01T13:00:00.000Z",
      endsAt: "2026-07-01T14:00:00.000Z",
      ownerUserId: "therapist_1",
    })

    assert.equal(event.id, "external-busy_1")
    assert.equal(event.title, "Google busy")
    assert.equal(event.editable, false)
    assert.equal(event.durationEditable, false)
    assert.equal(event.extendedProps.kind, "EXTERNAL_BUSY")
    assert.equal(event.extendedProps.clientLabel, null)
    assert.equal(event.extendedProps.providerLabel, null)
  })
})
