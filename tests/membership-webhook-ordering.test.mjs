import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { decideMembershipEventOrder } from "../lib/membership-webhook-ordering.ts"

describe("membership webhook ordering", () => {
  const storedEventCreatedAt = new Date("2026-08-28T12:00:00.000Z")
  const storedAuthoritativeAt = new Date("2026-08-28T12:05:00.000Z")

  for (const testCase of [
    {
      name: "recognizes the same event ID as a duplicate",
      input: { hasStoredSnapshot: true, storedEventId: "evt_same", storedEventCreatedAt, storedAuthoritativeAt: null, incomingEventId: "evt_same", incomingEventCreatedAt: new Date("2026-08-28T12:01:00.000Z") },
      expected: "duplicate",
    },
    {
      name: "applies an event when no snapshot exists",
      input: { hasStoredSnapshot: false, storedEventId: null, storedEventCreatedAt: null, storedAuthoritativeAt: null, incomingEventId: "evt_first", incomingEventCreatedAt: new Date("2026-08-28T12:00:00.000Z") },
      expected: "apply",
    },
    {
      name: "reconciles a legacy snapshot without either watermark",
      input: { hasStoredSnapshot: true, storedEventId: null, storedEventCreatedAt: null, storedAuthoritativeAt: null, incomingEventId: "evt_legacy", incomingEventCreatedAt: new Date("2026-08-28T12:00:00.000Z") },
      expected: "reconcile",
    },
    {
      name: "applies a newer event when no authoritative provider read exists",
      input: { hasStoredSnapshot: true, storedEventId: "evt_old", storedEventCreatedAt, storedAuthoritativeAt: null, incomingEventId: "evt_new", incomingEventCreatedAt: new Date("2026-08-28T12:00:01.000Z") },
      expected: "apply",
    },
    {
      name: "ignores an event older than the last provider event",
      input: { hasStoredSnapshot: true, storedEventId: "evt_new", storedEventCreatedAt, storedAuthoritativeAt: null, incomingEventId: "evt_old", incomingEventCreatedAt: new Date("2026-08-28T11:59:59.000Z") },
      expected: "ignore-stale",
    },
    {
      name: "reconciles every different event after an authoritative provider read",
      input: { hasStoredSnapshot: true, storedEventId: "evt_old", storedEventCreatedAt, storedAuthoritativeAt, incomingEventId: "evt_new", incomingEventCreatedAt: new Date("2026-08-28T12:10:00.000Z") },
      expected: "reconcile",
    },
    {
      name: "reconciles different IDs with equal provider timestamps",
      input: { hasStoredSnapshot: true, storedEventId: "evt_left", storedEventCreatedAt, storedAuthoritativeAt: null, incomingEventId: "evt_right", incomingEventCreatedAt: new Date(storedEventCreatedAt) },
      expected: "reconcile",
    },
  ]) {
    it(testCase.name, () => {
      assert.equal(decideMembershipEventOrder(testCase.input), testCase.expected)
    })
  }

  it("does not compare the local authoritative marker with Stripe's event clock", () => {
    for (const localMarker of [
      new Date("2020-01-01T00:00:00.000Z"),
      new Date("2035-01-01T00:00:00.000Z"),
    ]) {
      assert.equal(decideMembershipEventOrder({
        hasStoredSnapshot: true,
        storedEventId: "evt_stored",
        storedEventCreatedAt: null,
        storedAuthoritativeAt: localMarker,
        incomingEventId: "evt_incoming",
        incomingEventCreatedAt: new Date("2026-08-28T12:00:00.000Z"),
      }), "reconcile")
    }
  })
})
