import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  availabilityContainsRange,
  calendarDateParts,
  resolveAvailabilityForDate,
} from "../lib/calendar-availability.js"

describe("advanced calendar availability", () => {
  it("resolves availability using blackout, one-time override, named schedule, then weekly fallback", () => {
    const weeklyRules = [
      { dayOfWeek: 1, startMinute: 9 * 60, endMinute: 17 * 60, active: true },
    ]
    const schedules = [
      {
        name: "Summer schedule",
        active: true,
        effectiveFrom: "2026-05-01",
        effectiveTo: "2026-08-31",
        intervals: [
          { dayOfWeek: 1, startMinute: 10 * 60, endMinute: 15 * 60 },
        ],
      },
    ]

    assert.deepEqual(resolveAvailabilityForDate({
      date: "2026-05-18",
      weeklyRules,
      schedules,
      overrides: [{ date: "2026-05-18", kind: "BLACKOUT", reason: "Holiday" }],
    }), { source: "blackout", intervals: [] })

    assert.deepEqual(resolveAvailabilityForDate({
      date: "2026-05-19",
      weeklyRules,
      schedules,
      overrides: [{ date: "2026-05-19", kind: "OPEN", intervals: [{ startMinute: 12 * 60, endMinute: 16 * 60 }] }],
    }), { source: "override", intervals: [{ startMinute: 12 * 60, endMinute: 16 * 60 }] })

    assert.deepEqual(resolveAvailabilityForDate({
      date: "2026-05-18",
      weeklyRules,
      schedules,
      overrides: [],
    }), { source: "schedule", intervals: [{ startMinute: 10 * 60, endMinute: 15 * 60 }] })

    assert.deepEqual(resolveAvailabilityForDate({
      date: "2026-09-07",
      weeklyRules,
      schedules,
      overrides: [],
    }), { source: "weekly", intervals: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] })
  })

  it("checks whether a local appointment range fits within resolved intervals", () => {
    const availability = { intervals: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }

    assert.equal(availabilityContainsRange({ availability, startMinute: 9 * 60, endMinute: 10 * 60 }), true)
    assert.equal(availabilityContainsRange({ availability, startMinute: 8 * 60 + 45, endMinute: 10 * 60 }), false)
    assert.equal(availabilityContainsRange({ availability, startMinute: 16 * 60 + 30, endMinute: 17 * 60 + 15 }), false)
  })

  it("extracts practice-local date, weekday, and minute parts from UTC instants", () => {
    assert.deepEqual(calendarDateParts("2026-05-18T13:30:00.000Z", "America/New_York"), {
      date: "2026-05-18",
      dayOfWeek: 1,
      minute: 9 * 60 + 30,
    })
  })
})
