import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildGoogleOutboundEventPayload,
  normalizeGoogleBusyBlock,
  sanitizeCalendarSyncError,
} from "../lib/calendar-sync-normalization.ts"

describe("calendar sync normalization", () => {
  it("normalizes opaque Google events into busy blocks without personal fields", () => {
    const block = normalizeGoogleBusyBlock({
      ownerUserId: "user_1",
      connectionId: "connection_1",
      sourceId: "source_1",
      providerCalendarId: "primary",
      event: {
        id: "google_event_1",
        etag: "\"etag\"",
        status: "confirmed",
        transparency: "opaque",
        start: { dateTime: "2026-07-01T13:00:00-04:00", timeZone: "America/New_York" },
        end: { dateTime: "2026-07-01T14:00:00-04:00", timeZone: "America/New_York" },
      },
    })

    assert.equal(block.providerEventId, "google_event_1")
    assert.equal(block.ownerUserId, "user_1")
    assert.equal(block.status, "BUSY")
    assert.equal(block.allDay, false)
    assert.equal(block.startsAt.toISOString(), "2026-07-01T17:00:00.000Z")
    assert.equal(block.endsAt.toISOString(), "2026-07-01T18:00:00.000Z")
    assert.equal(Object.hasOwn(block, "summary"), false)
  })

  it("marks transparent events as free and cancelled events as cancelled", () => {
    const free = normalizeGoogleBusyBlock({
      ownerUserId: "user_1",
      connectionId: "connection_1",
      sourceId: "source_1",
      providerCalendarId: "primary",
      event: {
        id: "free_event",
        transparency: "transparent",
        start: { dateTime: "2026-07-01T13:00:00.000Z" },
        end: { dateTime: "2026-07-01T14:00:00.000Z" },
      },
    })
    const cancelled = normalizeGoogleBusyBlock({
      ownerUserId: "user_1",
      connectionId: "connection_1",
      sourceId: "source_1",
      providerCalendarId: "primary",
      event: {
        id: "cancelled_event",
        status: "cancelled",
        start: { dateTime: "2026-07-01T13:00:00.000Z" },
        end: { dateTime: "2026-07-01T14:00:00.000Z" },
      },
    })

    assert.equal(free.status, "FREE")
    assert.equal(cancelled.status, "CANCELLED")
    assert.ok(cancelled.cancelledAt instanceof Date)
  })

  it("normalizes Google all-day dates in the source calendar timezone", () => {
    const block = normalizeGoogleBusyBlock({
      ownerUserId: "user_1",
      connectionId: "connection_1",
      sourceId: "source_1",
      providerCalendarId: "primary",
      sourceTimezone: "America/New_York",
      event: {
        id: "all_day_event",
        start: { date: "2026-07-01" },
        end: { date: "2026-07-02" },
      },
    })

    assert.equal(block.allDay, true)
    assert.equal(block.timezone, "America/New_York")
    assert.equal(block.startsAt.toISOString(), "2026-07-01T04:00:00.000Z")
    assert.equal(block.endsAt.toISOString(), "2026-07-02T04:00:00.000Z")
  })

  it("builds safe outbound MassageLab payloads", () => {
    const payload = buildGoogleOutboundEventPayload({
      calendarEventId: "event_1",
      kind: "APPOINTMENT",
      startsAt: new Date("2026-07-01T13:00:00.000Z"),
      endsAt: new Date("2026-07-01T14:00:00.000Z"),
      timezone: "America/New_York",
    })

    assert.equal(payload.summary, "MassageLab appointment")
    assert.equal(payload.description, undefined)
    assert.equal(payload.location, undefined)
    assert.equal(payload.attendees, undefined)
    assert.deepEqual(payload.extendedProperties.private, { massagelabEventId: "event_1" })
  })

  it("sanitizes sync errors before persistence", () => {
    assert.equal(
      sanitizeCalendarSyncError(new Error("Authorization: Bearer abc123 failed for client@example.com")),
      "Calendar sync failed.",
    )
    assert.equal(
      sanitizeCalendarSyncError(new Error("Google Calendar request failed with status 401.")),
      "Google Calendar request failed with status 401.",
    )
  })
})
