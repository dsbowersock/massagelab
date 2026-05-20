import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { normalizeCalendarPreferences } from "../lib/calendar-preferences.js"
import {
  deriveCalendarVisibleBounds,
  minuteToCalendarTime,
  minuteToTimeInput,
  scrollMinuteForCalendarBounds,
  slotHeightForDensity,
  timeInputToMinute,
} from "../lib/calendar-display.js"

describe("calendar display helpers", () => {
  it("uses explicit calendar day bounds before availability-derived bounds", () => {
    const preferences = normalizeCalendarPreferences({
      calendarDayStartMinute: 10 * 60,
      calendarDayEndMinute: 20 * 60,
    })

    assert.deepEqual(deriveCalendarVisibleBounds({
      preferences,
      providerAvailability: [
        { providerId: "provider_1", startMinute: 8 * 60, endMinute: 17 * 60 },
      ],
      providerIds: ["provider_1"],
    }), {
      source: "preference",
      startMinute: 10 * 60,
      endMinute: 20 * 60,
      slotMinTime: "10:00:00",
      slotMaxTime: "20:00:00",
    })
  })

  it("derives calendar day bounds from visible provider availability", () => {
    const preferences = normalizeCalendarPreferences({})

    assert.deepEqual(deriveCalendarVisibleBounds({
      preferences,
      providerAvailability: [
        { providerId: "provider_1", startMinute: 9 * 60, endMinute: 16 * 60 },
        { providerId: "provider_2", startMinute: 11 * 60, endMinute: 19 * 60 },
        { providerId: "provider_3", startMinute: 6 * 60, endMinute: 22 * 60 },
      ],
      providerIds: ["provider_1", "provider_2"],
    }), {
      source: "availability",
      startMinute: 9 * 60,
      endMinute: 19 * 60,
      slotMinTime: "09:00:00",
      slotMaxTime: "19:00:00",
    })
  })

  it("falls back to a full day when preferences and availability are absent", () => {
    assert.deepEqual(deriveCalendarVisibleBounds({
      preferences: normalizeCalendarPreferences({}),
      providerAvailability: [],
      providerIds: [],
    }), {
      source: "full-day",
      startMinute: 0,
      endMinute: 24 * 60,
      slotMinTime: "00:00:00",
      slotMaxTime: "24:00:00",
    })
  })

  it("formats time controls, scrolls near now, and maps slot density to stable heights", () => {
    assert.equal(timeInputToMinute("07:30"), 7 * 60 + 30)
    assert.equal(timeInputToMinute("24:00"), null)
    assert.equal(minuteToTimeInput(17 * 60 + 15), "17:15")
    assert.equal(minuteToCalendarTime(24 * 60), "24:00:00")
    assert.equal(scrollMinuteForCalendarBounds({ startMinute: 8 * 60, endMinute: 20 * 60, nowMinute: 19 * 60 + 45 }), 18 * 60 + 45)
    assert.equal(scrollMinuteForCalendarBounds({ startMinute: 8 * 60, endMinute: 20 * 60, nowMinute: 6 * 60 }), 8 * 60)
    assert.equal(slotHeightForDensity("compact"), "1.65rem")
    assert.equal(slotHeightForDensity("spacious"), "2.85rem")
    assert.equal(slotHeightForDensity("unknown"), "2.25rem")
  })
})
