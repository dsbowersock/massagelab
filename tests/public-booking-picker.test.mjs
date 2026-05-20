import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildSequenceWeekGrid,
  groupSequenceOptionsByLocalDate,
  providerPreferenceModel,
  publicBookingDayViewCount,
  sequenceWeekStartKey,
  visibleSequenceDays,
} from "../lib/public-booking-picker.js"

describe("public booking picker helpers", () => {
  it("hides provider preference when any-provider plus one named provider is the only meaningful choice", () => {
    const model = providerPreferenceModel([
      { id: "", label: "Any available provider" },
      { id: "provider_1", label: "Derrick Bowersock" },
    ])

    assert.equal(model.shouldShowProviderPreference, false)
    assert.equal(model.defaultProviderId, "")
    assert.deepEqual(model.namedProviders, [{ id: "provider_1", label: "Derrick Bowersock" }])
  })

  it("shows provider preference when multiple named providers are available", () => {
    const model = providerPreferenceModel([
      { id: "", label: "Any available provider" },
      { id: "provider_1", label: "Derrick Bowersock" },
      { id: "provider_2", label: "Available provider" },
    ])

    assert.equal(model.shouldShowProviderPreference, true)
    assert.equal(model.defaultProviderId, "")
  })

  it("defaults to the sole named provider when any-provider is not available", () => {
    const model = providerPreferenceModel([
      { id: "provider_1", label: "Derrick Bowersock" },
    ])

    assert.equal(model.shouldShowProviderPreference, false)
    assert.equal(model.defaultProviderId, "provider_1")
  })

  it("groups sequence options by the practice-local calendar date", () => {
    const groups = groupSequenceOptionsByLocalDate([
      { startsAt: "2026-05-26T01:30:00.000Z", endsAt: "2026-05-26T02:30:00.000Z" },
      { startsAt: "2026-05-25T14:00:00.000Z", endsAt: "2026-05-25T15:00:00.000Z" },
      { startsAt: "2026-05-26T13:00:00.000Z", endsAt: "2026-05-26T14:00:00.000Z" },
    ], "America/New_York")

    assert.deepEqual(groups.map((group) => group.dateKey), ["2026-05-25", "2026-05-26"])
    assert.deepEqual(groups.map((group) => group.options.length), [2, 1])
    assert.equal(groups[0].options[0].startsAt, "2026-05-25T14:00:00.000Z")
    assert.equal(groups[0].options[1].startsAt, "2026-05-26T01:30:00.000Z")
  })

  it("builds a weekly availability grid with direct clickable start slots", () => {
    const grid = buildSequenceWeekGrid([
      { startsAt: "2026-05-25T13:00:00.000Z", endsAt: "2026-05-25T14:00:00.000Z" },
      { startsAt: "2026-05-25T13:15:00.000Z", endsAt: "2026-05-25T14:15:00.000Z" },
      { startsAt: "2026-05-27T18:00:00.000Z", endsAt: "2026-05-27T19:00:00.000Z" },
    ], "America/New_York", "2026-05-24")
    const monday = grid.days[1]
    const wednesday = grid.days[3]

    assert.equal(sequenceWeekStartKey("2026-05-25", "America/New_York"), "2026-05-24")
    assert.equal(grid.selectedWeekStartKey, "2026-05-24")
    assert.equal(grid.weeks[0].label, "May 24-30, 2026")
    assert.equal(monday.slots.length, 2)
    assert.equal(monday.slots[0].startMinutes, 9 * 60)
    assert.equal(monday.slots[1].startMinutes, 9 * 60 + 15)
    assert.equal(wednesday.slots[0].startMinutes, 14 * 60)
    assert.ok(grid.hourTicks.includes(8 * 60))
  })

  it("switches public availability from week to three-day to single-day views as width narrows", () => {
    assert.equal(publicBookingDayViewCount(980), 7)
    assert.equal(publicBookingDayViewCount(720), 3)
    assert.equal(publicBookingDayViewCount(420), 1)
  })

  it("pages visible public availability days without overflowing the current week", () => {
    const grid = buildSequenceWeekGrid([
      { startsAt: "2026-05-25T13:00:00.000Z", endsAt: "2026-05-25T14:00:00.000Z" },
      { startsAt: "2026-05-26T13:00:00.000Z", endsAt: "2026-05-26T14:00:00.000Z" },
      { startsAt: "2026-05-29T13:00:00.000Z", endsAt: "2026-05-29T14:00:00.000Z" },
    ], "America/New_York", "2026-05-24")

    const firstPage = visibleSequenceDays(grid.days, 3, 0)
    const lastPage = visibleSequenceDays(grid.days, 3, 5)

    assert.deepEqual(firstPage.days.map((day) => day.weekdayShort), ["Sun", "Mon", "Tue"])
    assert.equal(firstPage.canPageBackward, false)
    assert.equal(firstPage.canPageForward, true)
    assert.deepEqual(lastPage.days.map((day) => day.weekdayShort), ["Thu", "Fri", "Sat"])
    assert.equal(lastPage.startIndex, 4)
    assert.equal(lastPage.canPageForward, false)
  })

  it("can display a requested week even when available slots start later", () => {
    const grid = buildSequenceWeekGrid([
      { startsAt: "2026-05-25T13:00:00.000Z", endsAt: "2026-05-25T14:00:00.000Z" },
    ], "America/New_York", "2026-05-17")

    assert.equal(grid.selectedWeekStartKey, "2026-05-17")
    assert.deepEqual(grid.weeks.map((week) => week.weekStartKey), ["2026-05-17", "2026-05-24"])
    assert.equal(grid.days[3].dateKey, "2026-05-20")
    assert.equal(grid.days.reduce((count, day) => count + day.slots.length, 0), 0)
  })
})
