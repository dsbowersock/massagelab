import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  calendarEventShouldPushToGoogle,
  outboundSyncActionForStatus,
} from "../lib/calendar-sync-service.ts"

describe("calendar outbound sync", () => {
  it("pushes provider-owned appointments, classes, and personal blocks only", () => {
    assert.equal(calendarEventShouldPushToGoogle({ kind: "APPOINTMENT", ownerUserId: "provider_1", status: "CONFIRMED" }), true)
    assert.equal(calendarEventShouldPushToGoogle({ kind: "CLASS", ownerUserId: "provider_1", status: "CONFIRMED" }), true)
    assert.equal(calendarEventShouldPushToGoogle({ kind: "PERSONAL", ownerUserId: "provider_1", status: "ACTIVE" }), true)
    assert.equal(calendarEventShouldPushToGoogle({ kind: "REMINDER", ownerUserId: "provider_1", status: "ACTIVE" }), false)
    assert.equal(calendarEventShouldPushToGoogle({ kind: "APPOINTMENT", ownerUserId: null, status: "CONFIRMED" }), false)
  })

  it("chooses delete only for cancelled outbound events", () => {
    assert.equal(outboundSyncActionForStatus("CONFIRMED"), "UPSERT")
    assert.equal(outboundSyncActionForStatus("ACTIVE"), "UPSERT")
    assert.equal(outboundSyncActionForStatus("REQUESTED"), "UPSERT")
    assert.equal(outboundSyncActionForStatus("CANCELLED"), "DELETE")
    assert.equal(outboundSyncActionForStatus("COMPLETED"), "SKIP")
    assert.equal(outboundSyncActionForStatus("NO_SHOW"), "SKIP")
  })
})
