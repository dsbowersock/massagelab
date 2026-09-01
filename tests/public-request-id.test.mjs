import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

async function sourceOrEmpty(relativePath) {
  try {
    return await readFile(new URL(relativePath, import.meta.url), "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") return ""
    throw error
  }
}

const [requestIdSource, requestOwnerSource, bookingIdempotencySource] = await Promise.all([
  sourceOrEmpty("../lib/public-request-id.ts"),
  sourceOrEmpty("../lib/public-request-owner.ts"),
  sourceOrEmpty("../lib/public-booking-idempotency.ts"),
])

const requestIdModule = requestIdSource
  ? loadCompiledModule(requestIdSource, "lib/public-request-id.test.ts")
  : {}
const requestOwnerModule = requestOwnerSource
  ? loadCompiledModule(requestOwnerSource, "lib/public-request-owner.test.ts", {
      "server-only": {},
      "./public-request-id.ts": requestIdModule,
    })
  : {}
const bookingIdempotencyModule = bookingIdempotencySource
  ? loadCompiledModule(bookingIdempotencySource, "lib/public-booking-idempotency.test.ts", {
      "server-only": {},
      "./public-request-id.ts": requestIdModule,
      "./public-request-owner.ts": requestOwnerModule,
    })
  : {}

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000"
const OTHER_REQUEST_ID = "223e4567-e89b-42d3-a456-426614174000"
const BOOKING_SELECTION = Object.freeze({
  requestId: REQUEST_ID,
  primaryServiceVariantId: "variant-primary",
  addOnServiceVariantIds: ["variant-addon-b", "variant-addon-a"],
  requestedPressureLevel: 3,
  requestedStartsAt: "2026-09-02T14:00:00.000Z",
  preferredProviderId: "provider-1",
})
const WAITLIST_SELECTION = Object.freeze({
  requestId: REQUEST_ID,
  primaryServiceVariantId: "variant-primary",
  addOnServiceVariantIds: ["variant-addon-b", "variant-addon-a"],
  requestedPressureLevel: 3,
  preferredStartsAt: "2026-09-03T14:00:00.000Z",
  preferredProviderId: "provider-1",
})

describe("public request ownership", () => {
  it("accepts only canonical lowercase UUIDv4 request ids", () => {
    const { normalizePublicRequestId } = requestIdModule

    assert.equal(typeof normalizePublicRequestId, "function")
    assert.equal(normalizePublicRequestId(REQUEST_ID), REQUEST_ID)
    for (const invalid of [
      OTHER_REQUEST_ID.replace("-4", "-5"),
      REQUEST_ID.replace("-a456-", "-7456-"),
      REQUEST_ID.toUpperCase(),
      ` ${REQUEST_ID}`,
      `${REQUEST_ID} `,
      "123e4567-e89b-42d3-c456-426614174000",
      "not-a-uuid",
      null,
      undefined,
      123,
    ]) {
      assert.equal(normalizePublicRequestId(invalid), null, String(invalid))
    }
  })

  it("keeps the UUID parser browser-safe", () => {
    assert.notEqual(requestIdSource, "")
    assert.doesNotMatch(requestIdSource, /(?:from\s+|import\s*\()["'](?:node:|server-only|@prisma\/client|@\/lib\/prisma)/)
    assert.doesNotMatch(requestIdSource, /require\s*\(\s*["'](?:node:|server-only|@prisma\/client|@\/lib\/prisma)/)
    assert.match(requestOwnerSource, /import "server-only"/)
    assert.match(requestOwnerSource, /from "node:crypto"/)
    assert.match(bookingIdempotencySource, /import "server-only"/)
  })

  it("length-frames labels and values so ambiguous tuples cannot share a digest", () => {
    const { publicRequestOwner } = requestOwnerModule

    assert.equal(typeof publicRequestOwner, "function")
    const left = publicRequestOwner({
      namespace: "public-booking-v1",
      requestId: REQUEST_ID,
      selectionComponents: [{ label: "ab", value: "c" }],
    })
    const right = publicRequestOwner({
      namespace: "public-booking-v1",
      requestId: REQUEST_ID,
      selectionComponents: [{ label: "a", value: "bc" }],
    })

    assert.notEqual(left.selectionDigest, right.selectionDigest)
    assert.match(left.selectionDigest, /^[0-9a-f]{64}$/)
  })

  it("keeps random request identity out of the digest while framing its namespace", () => {
    const { publicRequestOwner } = requestOwnerModule
    const selectionComponents = [{ label: "primaryServiceVariantId", value: "variant-primary" }]
    const booking = publicRequestOwner({
      namespace: "public-booking-v1",
      requestId: REQUEST_ID,
      selectionComponents,
    })
    const otherRequest = publicRequestOwner({
      namespace: "public-booking-v1",
      requestId: OTHER_REQUEST_ID,
      selectionComponents,
    })
    const waitlist = publicRequestOwner({
      namespace: "public-waitlist-v1",
      requestId: REQUEST_ID,
      selectionComponents,
    })

    assert.equal(booking.selectionDigest, otherRequest.selectionDigest)
    assert.notEqual(booking.prefix, otherRequest.prefix)
    assert.notEqual(booking.id, otherRequest.id)
    assert.notEqual(booking.selectionDigest, waitlist.selectionDigest)
  })

  it("canonicalizes booking and waitlist add-on selection order", () => {
    const { publicBookingRequestOwner, publicWaitlistRequestOwner } = bookingIdempotencyModule

    assert.equal(typeof publicBookingRequestOwner, "function")
    assert.equal(typeof publicWaitlistRequestOwner, "function")
    assert.deepEqual(
      publicBookingRequestOwner(BOOKING_SELECTION),
      publicBookingRequestOwner({
        ...BOOKING_SELECTION,
        addOnServiceVariantIds: [...BOOKING_SELECTION.addOnServiceVariantIds].reverse(),
      }),
    )
    assert.deepEqual(
      publicWaitlistRequestOwner(WAITLIST_SELECTION),
      publicWaitlistRequestOwner({
        ...WAITLIST_SELECTION,
        addOnServiceVariantIds: [...WAITLIST_SELECTION.addOnServiceVariantIds].reverse(),
      }),
    )
  })

  it("changes the digest when any allowlisted booking selection changes", () => {
    const { publicBookingRequestOwner } = bookingIdempotencyModule
    assert.equal(typeof publicBookingRequestOwner, "function")
    const baseline = publicBookingRequestOwner(BOOKING_SELECTION)
    const changes = [
      { primaryServiceVariantId: "variant-primary-other" },
      { addOnServiceVariantIds: ["variant-addon-c"] },
      { requestedPressureLevel: 4 },
      { requestedStartsAt: "2026-09-02T14:15:00.000Z" },
      { preferredProviderId: "provider-2" },
    ]

    for (const change of changes) {
      assert.notEqual(
        publicBookingRequestOwner({ ...BOOKING_SELECTION, ...change }).selectionDigest,
        baseline.selectionDigest,
        JSON.stringify(change),
      )
    }
  })

  it("changes the digest when any allowlisted waitlist selection changes", () => {
    const { publicWaitlistRequestOwner } = bookingIdempotencyModule
    assert.equal(typeof publicWaitlistRequestOwner, "function")
    const baseline = publicWaitlistRequestOwner(WAITLIST_SELECTION)
    const changes = [
      { primaryServiceVariantId: "variant-primary-other" },
      { addOnServiceVariantIds: ["variant-addon-c"] },
      { requestedPressureLevel: 4 },
      { preferredStartsAt: "2026-09-03T14:15:00.000Z" },
      { preferredProviderId: "provider-2" },
    ]

    for (const change of changes) {
      assert.notEqual(
        publicWaitlistRequestOwner({ ...WAITLIST_SELECTION, ...change }).selectionDigest,
        baseline.selectionDigest,
        JSON.stringify(change),
      )
    }
  })

  it("rejects contact, account, and free-text fields from selection APIs", () => {
    const { publicBookingRequestOwner, publicWaitlistRequestOwner } = bookingIdempotencyModule
    const forbiddenFields = [
      ["guestEmail", "person@example.test"],
      ["guestName", "Person"],
      ["guestPhone", "555-0100"],
      ["accountId", "account-1"],
      ["userId", "user-1"],
      ["practiceClientId", "client-1"],
      ["notes", "private note"],
    ]

    for (const [field, value] of forbiddenFields) {
      assert.throws(
        () => publicBookingRequestOwner({ ...BOOKING_SELECTION, [field]: value }),
        /selection fields/i,
      )
      assert.throws(
        () => publicWaitlistRequestOwner({ ...WAITLIST_SELECTION, [field]: value }),
        /selection fields/i,
      )
    }
  })

  it("produces versioned prefixes and concrete IDs that fit existing text IDs", () => {
    const { publicBookingRequestOwner, publicWaitlistRequestOwner } = bookingIdempotencyModule
    const booking = publicBookingRequestOwner(BOOKING_SELECTION)
    const waitlist = publicWaitlistRequestOwner(WAITLIST_SELECTION)

    assert.equal(booking.prefix, `public-booking-v1:${REQUEST_ID}:`)
    assert.equal(waitlist.prefix, `public-waitlist-v1:${REQUEST_ID}:`)
    assert.equal(booking.id, `${booking.prefix}${booking.selectionDigest}`)
    assert.equal(waitlist.id, `${waitlist.prefix}${waitlist.selectionDigest}`)
    assert.equal(booking.prefix.length, 55)
    assert.equal(waitlist.prefix.length, 56)
    assert.equal(booking.id.length, 119)
    assert.equal(waitlist.id.length, 120)
    assert.ok(booking.id.length <= 191)
    assert.ok(waitlist.id.length <= 191)
  })

  it("uses bounded prefix lookups and compares the full concrete selection owner", async () => {
    const {
      findPublicBookingRequest,
      findPublicWaitlistRequest,
      hasExactPublicRequestSelection,
      publicBookingRequestOwner,
      publicWaitlistRequestOwner,
    } = bookingIdempotencyModule
    assert.equal(typeof findPublicBookingRequest, "function")
    assert.equal(typeof findPublicWaitlistRequest, "function")
    assert.equal(typeof hasExactPublicRequestSelection, "function")
    const bookingOwner = publicBookingRequestOwner(BOOKING_SELECTION)
    const waitlistOwner = publicWaitlistRequestOwner(WAITLIST_SELECTION)
    const calls = []
    const bookingRow = { id: bookingOwner.id }
    const waitlistRow = { id: waitlistOwner.id }
    const database = {
      bookingGroup: {
        async findFirst(query) {
          calls.push(["booking", query])
          return bookingRow
        },
      },
      bookingWaitlistEntry: {
        async findFirst(query) {
          calls.push(["waitlist", query])
          return waitlistRow
        },
      },
    }

    assert.equal(await findPublicBookingRequest(database, bookingOwner), bookingRow)
    assert.equal(await findPublicWaitlistRequest(database, waitlistOwner), waitlistRow)
    assert.deepEqual(calls.map(([kind, query]) => [kind, query.where]), [
      ["booking", { id: { startsWith: bookingOwner.prefix } }],
      ["waitlist", { id: { startsWith: waitlistOwner.prefix } }],
    ])
    assert.equal(hasExactPublicRequestSelection(bookingRow, bookingOwner), true)
    assert.equal(hasExactPublicRequestSelection(
      { id: `${bookingOwner.prefix}${"0".repeat(64)}` },
      bookingOwner,
    ), false)
  })

  it("locks only the versioned UUID prefix", async () => {
    const { acquirePublicRequestLock, publicBookingRequestOwner } = bookingIdempotencyModule
    assert.equal(typeof acquirePublicRequestLock, "function")
    const owner = publicBookingRequestOwner(BOOKING_SELECTION)
    const calls = []
    const transaction = {
      async $queryRaw(strings, ...values) {
        calls.push({ strings: [...strings], values })
        return []
      },
    }

    await acquirePublicRequestLock(transaction, owner)

    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].values, [owner.prefix])
    assert.match(calls[0].strings.join("?"), /pg_advisory_xact_lock\(hashtextextended\(\?, 0\)\)/)
    assert.doesNotMatch(JSON.stringify(calls), new RegExp(owner.selectionDigest))
    assert.doesNotMatch(JSON.stringify(calls), new RegExp(owner.id))
  })
})
