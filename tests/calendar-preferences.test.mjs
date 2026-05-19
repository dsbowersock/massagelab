import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_CALENDAR_PREFERENCES,
  normalizeCalendarPreferences,
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
      appointmentAttributes: {
        confirmed: "no",
        soapNote: true,
      },
    }), DEFAULT_CALENDAR_PREFERENCES)
  })
})
