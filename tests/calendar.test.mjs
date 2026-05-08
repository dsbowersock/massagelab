import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  appointmentIsActive,
  buildAvailabilitySlots,
  dateAtMinute,
  formatMinuteLabel,
  hasAppointmentConflict,
  intervalsOverlap,
  localDateTimeToUtc,
  parseTimeToMinute,
} from "../lib/calendar.js"

describe("Calendar scheduling helpers", () => {
  it("detects interval overlaps using exclusive end times", () => {
    assert.equal(
      intervalsOverlap("2026-05-04T09:00:00.000Z", "2026-05-04T10:00:00.000Z", "2026-05-04T09:30:00.000Z", "2026-05-04T10:30:00.000Z"),
      true,
    )
    assert.equal(
      intervalsOverlap("2026-05-04T09:00:00.000Z", "2026-05-04T10:00:00.000Z", "2026-05-04T10:00:00.000Z", "2026-05-04T11:00:00.000Z"),
      false,
    )
  })

  it("treats only requested and confirmed appointments as active conflicts", () => {
    assert.equal(appointmentIsActive("REQUESTED"), true)
    assert.equal(appointmentIsActive("CONFIRMED"), true)
    assert.equal(appointmentIsActive("CANCELLED"), false)
    assert.equal(appointmentIsActive("COMPLETED"), false)
    assert.equal(appointmentIsActive("NO_SHOW"), false)
  })

  it("blocks appointments that overlap active appointments or calendar blocks", () => {
    const startsAt = "2026-05-04T09:30:00.000Z"
    const endsAt = "2026-05-04T10:30:00.000Z"

    assert.equal(hasAppointmentConflict({
      startsAt,
      endsAt,
      blocks: [{ startsAt: "2026-05-04T10:00:00.000Z", endsAt: "2026-05-04T11:00:00.000Z" }],
      appointments: [],
    }), true)

    assert.equal(hasAppointmentConflict({
      startsAt,
      endsAt,
      blocks: [],
      appointments: [{ startsAt: "2026-05-04T09:00:00.000Z", endsAt: "2026-05-04T10:00:00.000Z", status: "CANCELLED" }],
    }), false)
  })

  it("builds available slots from working hours minus blocks and appointments", () => {
    const slots = buildAvailabilitySlots({
      date: "2026-05-04",
      serviceDurationMinutes: 60,
      stepMinutes: 30,
      rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
      blocks: [{ startsAt: "2026-05-04T10:00:00.000Z", endsAt: "2026-05-04T10:30:00.000Z" }],
      appointments: [{ startsAt: "2026-05-04T11:00:00.000Z", endsAt: "2026-05-04T12:00:00.000Z", status: "CONFIRMED" }],
    })

    assert.deepEqual(slots.map((slot) => slot.label), ["9:00 AM"])
  })

  it("parses and formats practice time inputs", () => {
    assert.equal(parseTimeToMinute("09:30"), 570)
    assert.equal(parseTimeToMinute("25:00"), null)
    assert.equal(formatMinuteLabel(13 * 60 + 15), "1:15 PM")
  })

  it("converts practice wall-clock times into UTC instants", () => {
    assert.equal(dateAtMinute("2026-05-04", 9 * 60, "America/New_York").toISOString(), "2026-05-04T13:00:00.000Z")
    assert.equal(localDateTimeToUtc("2026-05-04T09:00", "America/New_York")?.toISOString(), "2026-05-04T13:00:00.000Z")
  })
})
