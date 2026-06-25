import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  cancelledGoogleEventIds,
  googleCalendarSyncErrorStatus,
  selectedSourceUpdates,
  syncSourceFailurePatch,
  syncRunFailurePatch,
  syncRunSuccessPatch,
} from "../lib/calendar-sync-service.ts"

describe("calendar sync service pure helpers", () => {
  it("marks selected Google calendars without losing existing rows", () => {
    assert.deepEqual(selectedSourceUpdates({
      existingSources: [
        { providerCalendarId: "primary" },
        { providerCalendarId: "personal" },
      ],
      selectedProviderCalendarIds: ["primary"],
    }), [
      { providerCalendarId: "primary", selectedForBusySync: true },
      { providerCalendarId: "personal", selectedForBusySync: false },
    ])
  })

  it("builds sanitized sync run success and failure patches", () => {
    const finishedAt = new Date("2026-07-01T12:00:00.000Z")

    assert.deepEqual(syncRunSuccessPatch({ finishedAt, itemsSeen: 4, itemsChanged: 2 }), {
      status: "SUCCEEDED",
      finishedAt,
      itemsSeen: 4,
      itemsChanged: 2,
      errorCode: null,
      errorMessage: null,
    })
    assert.deepEqual(syncRunFailurePatch({ finishedAt, error: new Error("Authorization: Bearer token leaked") }), {
      status: "FAILED",
      finishedAt,
      errorCode: "SYNC_FAILED",
      errorMessage: "Calendar sync failed.",
    })
  })

  it("detects cancelled Google tombstones without valid times", () => {
    assert.deepEqual(cancelledGoogleEventIds([
      { id: "event_1", status: "cancelled" },
      { id: "event_2", status: "cancelled", start: { dateTime: "2026-07-01T13:00:00.000Z" } },
      { id: "event_3", status: "confirmed" },
    ]), ["event_1"])
  })

  it("clears stale sync tokens after Google 410 failures", () => {
    const error = new Error("Google Calendar request failed with status 410.")

    assert.equal(googleCalendarSyncErrorStatus(error), 410)
    assert.deepEqual(syncSourceFailurePatch(error), {
      lastErrorCode: "SYNC_FAILED",
      lastErrorMessage: "Google Calendar request failed with status 410.",
      syncToken: null,
    })
    assert.deepEqual(syncSourceFailurePatch(new Error("network token leak")), {
      lastErrorCode: "SYNC_FAILED",
      lastErrorMessage: "Calendar sync failed.",
    })
  })
})
