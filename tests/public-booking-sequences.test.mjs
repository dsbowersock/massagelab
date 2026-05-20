import assert from "node:assert/strict"
import test from "node:test"
import {
  MAX_PUBLIC_ADD_ONS,
  buildPublicBookingSequenceCacheKey,
  normalizePublicBookingSequenceDescriptor,
} from "../lib/public-booking-sequences.js"

test("normalizePublicBookingSequenceDescriptor requires pressure 1-5 and caps ordered add-ons", () => {
  assert.equal(MAX_PUBLIC_ADD_ONS, 3)

  const descriptor = normalizePublicBookingSequenceDescriptor({
    primaryServiceVariantId: "primary_60",
    addOnServiceVariantIds: ["add_1", "add_1", "add_2", "add_3", "add_4"],
    requestedPressureLevel: "5",
    preferredProviderId: " provider_1 ",
  })

  assert.deepEqual(descriptor, {
    primaryServiceVariantId: "primary_60",
    addOnServiceVariantIds: ["add_1", "add_2", "add_3"],
    requestedPressureLevel: 5,
    preferredProviderId: "provider_1",
  })

  assert.throws(() => normalizePublicBookingSequenceDescriptor({
    primaryServiceVariantId: "primary_60",
    addOnServiceVariantIds: [],
    requestedPressureLevel: "deep",
  }), /pressure preference from 1 to 5/)
})

test("buildPublicBookingSequenceCacheKey includes ordered descriptor and input signatures", () => {
  const base = {
    practiceId: "practice_1",
    primaryServiceVariantId: "primary_60",
    addOnServiceVariantIds: ["add_1", "add_2"],
    requestedPressureLevel: 3,
    preferredProviderId: "",
    policySignature: "policy-a",
    serviceSignature: "service-a",
    providerSignature: "provider-a",
  }

  assert.equal(
    buildPublicBookingSequenceCacheKey(base),
    buildPublicBookingSequenceCacheKey({ ...base }),
  )
  assert.notEqual(
    buildPublicBookingSequenceCacheKey(base),
    buildPublicBookingSequenceCacheKey({ ...base, addOnServiceVariantIds: ["add_2", "add_1"] }),
  )
  assert.notEqual(
    buildPublicBookingSequenceCacheKey(base),
    buildPublicBookingSequenceCacheKey({ ...base, providerSignature: "provider-b" }),
  )
  assert.notEqual(
    buildPublicBookingSequenceCacheKey(base),
    buildPublicBookingSequenceCacheKey({ ...base, policySignature: "policy-b" }),
  )
})
