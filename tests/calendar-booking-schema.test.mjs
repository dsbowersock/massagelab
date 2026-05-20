import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { describe, it } from "node:test"

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const actions = readFileSync(new URL("../app/calendar/actions.ts", import.meta.url), "utf8")
const bookingPage = readFileSync(new URL("../app/book/[practiceSlug]/page.tsx", import.meta.url), "utf8")
const bookingPicker = readFileSync(new URL("../app/book/[practiceSlug]/booking-picker.tsx", import.meta.url), "utf8")
const publicBookingSequences = readFileSync(new URL("../lib/public-booking-sequences.js", import.meta.url), "utf8")

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
    assert.equal(existsSync(new URL("../app/api/book/[practiceSlug]/sequence-options/route.ts", import.meta.url)), true)
  })

  it("loads public booking sequence options lazily instead of precomputing every group", () => {
    assert.doesNotMatch(bookingPage, /buildSequentialBookingOptions/)
    assert.doesNotMatch(bookingPage, /function addOnCombinations/)
    assert.doesNotMatch(bookingPage, /sequenceGroups/)
    assert.match(bookingPicker, /\/api\/book\/\$\{model\.practiceSlug\}\/sequence-options/)
    assert.doesNotMatch(bookingPicker, /sequenceGroups/)
    assert.match(publicBookingSequences, /createAsyncKeyedTtlCache/)
    assert.match(actions, /MAX_PUBLIC_ADD_ONS/)
    assert.match(actions, /publicBookingSequenceOptions/)
  })
})
