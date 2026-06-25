import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  externalBusyBlockConflicts,
  externalBusyBlocksWhere,
} from "../lib/calendar-sync-conflicts.ts"

describe("external calendar busy conflicts", () => {
  it("detects active busy overlaps only", () => {
    const startsAt = new Date("2026-07-01T13:00:00.000Z")
    const endsAt = new Date("2026-07-01T14:00:00.000Z")

    assert.equal(externalBusyBlockConflicts({
      startsAt,
      endsAt,
      busyBlocks: [
        { startsAt: new Date("2026-07-01T12:00:00.000Z"), endsAt: new Date("2026-07-01T13:30:00.000Z"), status: "BUSY" },
      ],
    }), true)
    assert.equal(externalBusyBlockConflicts({
      startsAt,
      endsAt,
      busyBlocks: [
        { startsAt: new Date("2026-07-01T12:00:00.000Z"), endsAt: new Date("2026-07-01T13:30:00.000Z"), status: "FREE" },
        { startsAt: new Date("2026-07-01T13:15:00.000Z"), endsAt: new Date("2026-07-01T13:45:00.000Z"), status: "CANCELLED" },
      ],
    }), false)
  })

  it("builds the Prisma where clause for provider busy checks", () => {
    const where = externalBusyBlocksWhere({
      ownerUserId: "provider_1",
      startsAt: new Date("2026-07-01T13:00:00.000Z"),
      endsAt: new Date("2026-07-01T14:00:00.000Z"),
    })

    assert.equal(where.ownerUserId, "provider_1")
    assert.deepEqual(where.status, { in: ["BUSY"] })
    assert.deepEqual(where.startsAt, { lt: new Date("2026-07-01T14:00:00.000Z") })
    assert.deepEqual(where.endsAt, { gt: new Date("2026-07-01T13:00:00.000Z") })
    assert.deepEqual(where.connection.status, "ACTIVE")
  })
})
