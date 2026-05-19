import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCalendarCreationPlan,
  buildCalendarNotificationIntents,
  calendarEventBlocksAvailability,
  canCreateCalendarFlow,
  hasCalendarEventConflict,
  sanitizeCalendarAuditMetadata,
} from "../lib/calendar-flows.js"

describe("Calendar creation flow policy", () => {
  it("uses conservative role permissions for each creation flow", () => {
    assert.equal(canCreateCalendarFlow({ flow: "APPOINTMENT", role: "OWNER", actorUserId: "owner", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "APPOINTMENT", role: "STAFF", actorUserId: "staff", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "APPOINTMENT", role: "THERAPIST", actorUserId: "therapist", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "APPOINTMENT", role: "THERAPIST", actorUserId: "therapist", targetUserId: "other" }), false)

    assert.equal(canCreateCalendarFlow({ flow: "CLIENT_REQUEST", role: null, actorUserId: "client", targetUserId: "therapist", isClientSelf: true }), true)
    assert.equal(canCreateCalendarFlow({ flow: "CLIENT_REQUEST", role: "STAFF", actorUserId: "staff", targetUserId: "therapist" }), false)

    assert.equal(canCreateCalendarFlow({ flow: "PERSONAL", role: "THERAPIST", actorUserId: "therapist", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "PERSONAL", role: "THERAPIST", actorUserId: "therapist", targetUserId: "other" }), false)
    assert.equal(canCreateCalendarFlow({ flow: "PERSONAL", role: "OWNER", actorUserId: "owner", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "PERSONAL", role: "STAFF", actorUserId: "staff", targetUserId: "therapist" }), false)

    assert.equal(canCreateCalendarFlow({ flow: "CLASS", role: "OWNER", actorUserId: "owner", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "CLASS", role: "STAFF", actorUserId: "staff", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "CLASS", role: "THERAPIST", actorUserId: "therapist", targetUserId: "therapist" }), false)

    assert.equal(canCreateCalendarFlow({ flow: "REMINDER", role: "OWNER", actorUserId: "owner", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "REMINDER", role: "STAFF", actorUserId: "staff", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "REMINDER", role: "THERAPIST", actorUserId: "therapist", targetUserId: "therapist" }), true)
    assert.equal(canCreateCalendarFlow({ flow: "REMINDER", role: "CLIENT", actorUserId: "client", targetUserId: "client" }), false)
  })
})

describe("Calendar event blocking behavior", () => {
  it("blocks availability only for active blocking event types", () => {
    assert.equal(calendarEventBlocksAvailability({ kind: "APPOINTMENT", status: "REQUESTED", blocksAvailability: true }), true)
    assert.equal(calendarEventBlocksAvailability({ kind: "APPOINTMENT", status: "CONFIRMED", blocksAvailability: true }), true)
    assert.equal(calendarEventBlocksAvailability({ kind: "APPOINTMENT", status: "CANCELLED", blocksAvailability: true }), false)
    assert.equal(calendarEventBlocksAvailability({ kind: "APPOINTMENT", status: "COMPLETED", blocksAvailability: true }), false)
    assert.equal(calendarEventBlocksAvailability({ kind: "CLASS", status: "CONFIRMED", blocksAvailability: true }), true)
    assert.equal(calendarEventBlocksAvailability({ kind: "PERSONAL", status: "ACTIVE", blocksAvailability: true }), true)
    assert.equal(calendarEventBlocksAvailability({ kind: "REMINDER", status: "ACTIVE", blocksAvailability: false }), false)
  })

  it("detects conflicts from the shared calendar event index", () => {
    const input = {
      startsAt: "2026-05-04T09:30:00.000Z",
      endsAt: "2026-05-04T10:30:00.000Z",
      events: [
        { kind: "REMINDER", status: "ACTIVE", startsAt: "2026-05-04T09:00:00.000Z", endsAt: "2026-05-04T11:00:00.000Z", blocksAvailability: false },
        { kind: "APPOINTMENT", status: "CANCELLED", startsAt: "2026-05-04T09:00:00.000Z", endsAt: "2026-05-04T11:00:00.000Z", blocksAvailability: true },
        { kind: "CLASS", status: "CONFIRMED", startsAt: "2026-05-04T10:00:00.000Z", endsAt: "2026-05-04T11:00:00.000Z", blocksAvailability: true },
      ],
    }

    assert.equal(hasCalendarEventConflict(input), true)
    assert.equal(hasCalendarEventConflict({
      ...input,
      startsAt: "2026-05-04T11:00:00.000Z",
      endsAt: "2026-05-04T12:00:00.000Z",
    }), false)
  })
})

describe("Calendar audit and notification payloads", () => {
  it("removes clinical and identifying details from audit metadata", () => {
    assert.deepEqual(sanitizeCalendarAuditMetadata({
      title: "Massage Session",
      serviceTypeId: "service_1",
      soapNote: "Subjective pain details",
      painMap: ["left shoulder"],
      transcript: "session transcript",
      clientEmail: "client@example.com",
      nested: {
        reminderNote: "Do not persist this note",
        room: "Room 1",
      },
    }), {
      title: "Massage Session",
      serviceTypeId: "service_1",
      nested: {
        room: "Room 1",
      },
    })
  })

  it("builds unique internal notification intent records without external delivery", () => {
    const intents = buildCalendarNotificationIntents({
      eventId: "event_1",
      actorUserId: "owner_1",
      action: "APPOINTMENT_CONFIRMED",
      recipientUserIds: ["client_1", "client_1", "therapist_1"],
      payload: {
        title: "Massage Session",
        clientEmail: "client@example.com",
        soapNote: "Do not persist",
      },
    })

    assert.deepEqual(intents.map((intent) => intent.recipientUserId), ["client_1", "therapist_1"])
    assert.equal(intents.every((intent) => intent.channel === "INTERNAL"), true)
    assert.equal(intents.every((intent) => intent.deliveryStatus === "PENDING"), true)
    assert.deepEqual(intents[0].payload, {
      action: "APPOINTMENT_CONFIRMED",
      eventId: "event_1",
      title: "Massage Session",
    })
  })
})

describe("Calendar creation mutation plans", () => {
  it("creates a blocking staff appointment plan", () => {
    const plan = buildCalendarCreationPlan({
      flow: "APPOINTMENT",
      practiceId: "practice_1",
      actorUserId: "staff_1",
      targetUserId: "therapist_1",
      startsAt: "2026-05-04T13:00:00.000Z",
      endsAt: "2026-05-04T14:00:00.000Z",
      title: "Massage Session",
    })

    assert.equal(plan.event.kind, "APPOINTMENT")
    assert.equal(plan.event.status, "CONFIRMED")
    assert.equal(plan.event.blocksAvailability, true)
    assert.equal(plan.detailModel, "appointment")
    assert.equal(plan.auditAction, "calendar.appointment.create")
    assert.equal(plan.notificationAction, "APPOINTMENT_CREATED")
  })

  it("creates non-blocking reminder plans and requested client appointment plans", () => {
    const reminder = buildCalendarCreationPlan({
      flow: "REMINDER",
      practiceId: "practice_1",
      actorUserId: "therapist_1",
      targetUserId: "therapist_1",
      startsAt: "2026-05-04T13:00:00.000Z",
      endsAt: "2026-05-04T13:15:00.000Z",
      title: "Check room setup",
    })
    const request = buildCalendarCreationPlan({
      flow: "CLIENT_REQUEST",
      practiceId: "practice_1",
      actorUserId: "client_1",
      targetUserId: "therapist_1",
      startsAt: "2026-05-04T13:00:00.000Z",
      endsAt: "2026-05-04T14:00:00.000Z",
      title: "Massage Session",
    })

    assert.equal(reminder.event.kind, "REMINDER")
    assert.equal(reminder.event.blocksAvailability, false)
    assert.equal(reminder.detailModel, "reminder")
    assert.equal(request.event.kind, "APPOINTMENT")
    assert.equal(request.event.status, "REQUESTED")
    assert.equal(request.notificationAction, "APPOINTMENT_REQUESTED")
  })
})
