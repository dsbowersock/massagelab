import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { describe, it } from "node:test"

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const actions = readFileSync(new URL("../app/calendar/actions.ts", import.meta.url), "utf8")

describe("calendar booking settings schema and route surface", () => {
  it("defines policy, capacity, waitlist, pressure, and service role storage", () => {
    assert.match(schema, /enum BookingApprovalMode/)
    assert.match(schema, /enum BookingCapacityPeriod/)
    assert.match(schema, /enum ServiceBookingRole/)
    assert.match(schema, /enum BookingWaitlistStatus/)
    assert.match(schema, /model BookingPolicy/)
    assert.match(schema, /model ProviderBookingPolicy/)
    assert.match(schema, /model ProviderBookingCapacityRule/)
    assert.match(schema, /model BookingGroup/)
    assert.match(schema, /model BookingWaitlistEntry/)
    assert.match(schema, /bookingRole\s+ServiceBookingRole/)
    assert.match(schema, /countsTowardMassageCapacity\s+Boolean/)
    assert.match(schema, /requestedPressureLevel\s+Int\?/)
    assert.match(schema, /publicLocationLabel\s+String\?/)
    assert.match(schema, /publicLatitude\s+Float\?/)
    assert.match(schema, /publicLongitude\s+Float\?/)
  })

  it("exposes booking settings, sequence request, waitlist, and conversion actions", () => {
    assert.equal(existsSync(new URL("../app/calendar/booking/page.tsx", import.meta.url)), true)
    assert.match(actions, /export async function saveBookingPolicyAction/)
    assert.match(actions, /export async function saveProviderBookingPolicyAction/)
    assert.match(actions, /export async function saveProviderCapacityRulesAction/)
    assert.match(actions, /export async function requestBookingSequenceAction/)
    assert.match(actions, /export async function joinBookingWaitlistAction/)
    assert.match(actions, /export async function convertWaitlistEntryAction/)
  })
})
