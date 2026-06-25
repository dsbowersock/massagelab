import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  selectedSourceUpdates,
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
})
