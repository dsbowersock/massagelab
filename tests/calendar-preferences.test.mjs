import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_CALENDAR_PREFERENCES,
  CALENDAR_NOTICE_AUTO_HIDE_VIEWS,
  mergeCalendarPreferencePatch,
  normalizeCalendarPreferences,
  shouldShowCalendarNotice,
} from "../lib/calendar-preferences.js"

describe("calendar display preferences", () => {
  it("normalizes user calendar preferences with conservative defaults", () => {
    const preferences = normalizeCalendarPreferences({
      defaultRange: "month",
      providerViewMode: "split",
      selectedProviderId: "provider_1",
      showCancelledEvents: true,
      showStatusBadges: false,
      colorMode: "status",
      showStaffPhotos: true,
      calendarDayStartMinute: 8 * 60,
      calendarDayEndMinute: 18 * 60,
      calendarSlotDensity: "spacious",
      appointmentAttributes: {
        confirmed: false,
        unconfirmed: true,
        customerBefore: true,
        customerAfter: true,
        newClient: true,
      },
    })

    assert.deepEqual(preferences, {
      ...DEFAULT_CALENDAR_PREFERENCES,
      defaultRange: "month",
      providerViewMode: "split",
      selectedProviderId: "provider_1",
      showCancelledEvents: true,
      showStatusBadges: false,
      colorMode: "status",
      showStaffPhotos: true,
      calendarDayStartMinute: 8 * 60,
      calendarDayEndMinute: 18 * 60,
      calendarSlotDensity: "spacious",
      appointmentAttributes: {
        confirmed: false,
        unconfirmed: true,
        customerBefore: true,
        customerAfter: true,
        newClient: true,
      },
    })
  })

  it("drops unsupported preference values instead of persisting arbitrary UI state", () => {
    assert.deepEqual(normalizeCalendarPreferences({
      defaultRange: "year",
      providerViewMode: "resource",
      selectedProviderId: 42,
      showCancelledEvents: "yes",
      colorMode: "rainbow",
      calendarDayStartMinute: 20 * 60,
      calendarDayEndMinute: 8 * 60,
      calendarSlotDensity: "huge",
      appointmentAttributes: {
        confirmed: "no",
        soapNote: true,
      },
    }), DEFAULT_CALENDAR_PREFERENCES)
  })

  it("preserves safe notice dismissal state and hides notices after dismissal or enough views", () => {
    const preferences = normalizeCalendarPreferences({
      noticeDismissals: {
        "operator-privacy": { dismissed: false, views: 2 },
        "booking-privacy": { dismissed: true, views: 1 },
        "bad-notice": { dismissed: "yes", views: -10, extra: "ignored" },
      },
    })

    assert.deepEqual(preferences.noticeDismissals, {
      "operator-privacy": { dismissed: false, views: 2 },
      "booking-privacy": { dismissed: true, views: 1 },
      "bad-notice": { dismissed: false, views: 0 },
    })
    assert.equal(shouldShowCalendarNotice(preferences, "operator-privacy"), true)
    assert.equal(shouldShowCalendarNotice(preferences, "booking-privacy"), false)
    assert.equal(
      shouldShowCalendarNotice({
        ...preferences,
        noticeDismissals: { "operator-privacy": { dismissed: false, views: CALENDAR_NOTICE_AUTO_HIDE_VIEWS } },
      }, "operator-privacy"),
      false,
    )
  })

  it("merges calendar preference patches without resetting unrelated display settings", () => {
    const existing = normalizeCalendarPreferences({
      defaultRange: "month",
      providerViewMode: "combined",
      showCancelledEvents: true,
      calendarSlotDensity: "spacious",
      noticeDismissals: {
        "operator-privacy": { dismissed: false, views: 2 },
      },
    })

    assert.deepEqual(mergeCalendarPreferencePatch(existing, {
      noticeDismissals: {
        "booking-privacy": { dismissed: true, views: 1 },
      },
    }), {
      ...existing,
      noticeDismissals: {
        "operator-privacy": { dismissed: false, views: 2 },
        "booking-privacy": { dismissed: true, views: 1 },
      },
    })
  })
})
