import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  buildSequenceWeekGrid,
  groupSequenceOptionsByLocalDate,
  providerPreferenceModel,
  publicBookingDayViewCount,
  sequenceWeekStartKey,
  visibleSequenceDays,
} from "../lib/public-booking-picker.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const pickerSource = await readFile(
  new URL("../app/book/[practiceSlug]/booking-picker.tsx", import.meta.url),
  "utf8",
)
const actionStateSource = await readFile(
  new URL("../app/calendar/actions/public-booking-state.ts", import.meta.url),
  "utf8",
)

function loadPickerTrafficHelpers() {
  return loadCompiledModule(
    actionStateSource,
    "booking-picker.traffic-helpers.test.ts",
  )
}

describe("public booking picker helpers", () => {
  it("debounce starts availability at 350ms and aborts a superseded in-flight request", async () => {
    const { schedulePublicAvailabilityRequest } = loadPickerTrafficHelpers()
    assert.equal(typeof schedulePublicAvailabilityRequest, "function")

    const timers = []
    const cleared = []
    const previousWindow = globalThis.window
    globalThis.window = {
      setTimeout(callback, delay) {
        timers.push({ callback, delay })
        return timers.length
      },
      clearTimeout(timerId) {
        cleared.push(timerId)
      },
    }

    try {
      const starts = []
      const cancelFirst = schedulePublicAvailabilityRequest((signal) => {
        starts.push({ at: 350, signal })
      })
      assert.equal(timers[0].delay, 350)
      assert.deepEqual(starts, [], "the request must not start at 349ms")

      timers[0].callback()
      await Promise.resolve()
      assert.equal(starts.length, 1, "the request starts at the 350ms boundary")
      assert.equal(starts[0].signal.aborted, false)

      cancelFirst()
      assert.equal(cleared.includes(1), true)
      assert.equal(starts[0].signal.aborted, true, "superseding cleanup aborts the in-flight request")

      const cancelSecond = schedulePublicAvailabilityRequest((signal) => {
        starts.push({ at: 700, signal })
      })
      assert.equal(timers[1].delay, 350)
      cancelSecond()
    } finally {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
    }
  })

  it("debounce parses only positive integer Retry-After values and exposes a bounded countdown", () => {
    const {
      publicBookingRemainingRetrySeconds,
      publicBookingRetryAfterSeconds,
    } = loadPickerTrafficHelpers()

    assert.equal(publicBookingRetryAfterSeconds("47"), 47)
    assert.equal(publicBookingRetryAfterSeconds(" 8 "), 8)
    for (const invalid of [null, "", "0", "-1", "1.5", "1e2", "not-a-number"]) {
      assert.equal(publicBookingRetryAfterSeconds(invalid), null)
    }
    assert.equal(publicBookingRemainingRetrySeconds(10_000, 7_001), 3)
    assert.equal(publicBookingRemainingRetrySeconds(10_000, 10_000), 0)
    assert.match(pickerSource, /response\.status === 429[\s\S]*headers\.get\("Retry-After"\)/)
    assert.match(pickerSource, /response\.status === 503[\s\S]*temporarily unavailable/i)
    assert.match(pickerSource, /role="status"[\s\S]*aria-live="polite"/)
  })

  it("request id state is browser-only, separate, retained for recovery, and rotated only deliberately or on success", () => {
    const { createBrowserPublicBookingRequestId } = loadPickerTrafficHelpers()
    assert.equal(typeof createBrowserPublicBookingRequestId, "function")
    const previousWindow = globalThis.window
    try {
      delete globalThis.window
      assert.equal(createBrowserPublicBookingRequestId(), "")
      let generated = 0
      globalThis.window = { crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++generated).padStart(12, "0")}` } }
      assert.notEqual(createBrowserPublicBookingRequestId(), createBrowserPublicBookingRequestId())
    } finally {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
    }

    assert.equal((pickerSource.match(/useActionState\(/g) ?? []).length, 2)
    assert.match(pickerSource, /bookingRequestId[\s\S]*waitlistRequestId/)
    assert.match(pickerSource, /bookingResultRequestId,\s*setBookingResultRequestId[\s\S]*formData\.get\("requestId"\)[\s\S]*setBookingResultRequestId\(requestId\)/)
    assert.match(pickerSource, /waitlistResultRequestId,\s*setWaitlistResultRequestId[\s\S]*formData\.get\("requestId"\)[\s\S]*setWaitlistResultRequestId\(requestId\)/)
    assert.doesNotMatch(pickerSource, /ResultRequestIdRef/)
    assert.match(pickerSource, /publicBookingActionStateForAttempt\([\s\S]*bookingRequestId/)
    assert.match(pickerSource, /publicBookingActionStateForAttempt\([\s\S]*waitlistRequestId/)
    assert.match(pickerSource, /name="requestId" value=\{bookingRequestId\}/)
    assert.match(pickerSource, /name="requestId" value=\{waitlistRequestId\}/)
    assert.match(pickerSource, /visibleBookingActionState\.status === "SUCCESS"[\s\S]*setBookingRequestId\(createBrowserPublicBookingRequestId\(\)\)[\s\S]*router\.push/)
    assert.match(pickerSource, /visibleWaitlistActionState\.status === "SUCCESS"[\s\S]*setWaitlistRequestId\(createBrowserPublicBookingRequestId\(\)\)[\s\S]*router\.push/)
    assert.match(pickerSource, /RATE_LIMITED[\s\S]*retryAfterSeconds/)
    assert.match(actionStateSource, /UNAVAILABLE[\s\S]*Try again/)
    assert.match(pickerSource, /Start a new booking request/)
    assert.match(pickerSource, /Start a new waitlist request/)
  })

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

  it("keeps requested weeks constrained to weeks with available slots", () => {
    const grid = buildSequenceWeekGrid([
      { startsAt: "2026-05-25T13:00:00.000Z", endsAt: "2026-05-25T14:00:00.000Z" },
    ], "America/New_York", "2026-05-17")

    assert.equal(grid.selectedWeekStartKey, "2026-05-24")
    assert.deepEqual(grid.weeks.map((week) => week.weekStartKey), ["2026-05-24"])
    assert.equal(grid.days[1].dateKey, "2026-05-25")
    assert.equal(grid.days.reduce((count, day) => count + day.slots.length, 0), 1)
  })
})
