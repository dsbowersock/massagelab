import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BOOKING_POLICY_DEFAULTS,
  bookingStatusForApprovalMode,
  buildSequentialBookingOptions,
  capacityAllowsBooking,
  hasRestGapConflict,
  normalizeBookingPolicy,
  normalizePressureLevel,
  normalizeProviderBookingPolicy,
  providerAppointmentLimitAllows,
  waitlistStatusTransitionAllowed,
} from "../lib/booking-policy.js"

describe("booking policy defaults", () => {
  it("keeps existing public booking behavior when no policy row exists", () => {
    assert.deepEqual(normalizeBookingPolicy(null), BOOKING_POLICY_DEFAULTS)
    assert.deepEqual(normalizeBookingPolicy({ maxAdvanceDays: 14, approvalMode: "AUTO_CONFIRM" }), {
      ...BOOKING_POLICY_DEFAULTS,
      maxAdvanceDays: 14,
      approvalMode: "AUTO_CONFIRM",
    })
    assert.equal(bookingStatusForApprovalMode("MANUAL"), "REQUESTED")
    assert.equal(bookingStatusForApprovalMode("AUTO_CONFIRM"), "CONFIRMED")
  })

  it("normalizes provider visibility, labels, rest gaps, and appointment limits", () => {
    assert.deepEqual(normalizeProviderBookingPolicy(null, { userId: "provider_1", label: "Default Provider" }), {
      providerUserId: "provider_1",
      publiclyBookable: true,
      displayLabel: "Default Provider",
      minRestMinutes: 0,
      dailyAppointmentLimit: null,
      weeklyAppointmentLimit: null,
    })

    assert.deepEqual(normalizeProviderBookingPolicy({
      providerUserId: "provider_1",
      publiclyBookable: false,
      displayLabel: "North room",
      minRestMinutes: 20,
      dailyAppointmentLimit: 4,
      weeklyAppointmentLimit: 16,
    }, { userId: "provider_1", label: "Default Provider" }), {
      providerUserId: "provider_1",
      publiclyBookable: false,
      displayLabel: "North room",
      minRestMinutes: 20,
      dailyAppointmentLimit: 4,
      weeklyAppointmentLimit: 16,
    })
  })
})

describe("booking pressure and capacity", () => {
  it("requires a pressure level from one to five", () => {
    assert.equal(normalizePressureLevel("1"), 1)
    assert.equal(normalizePressureLevel(5), 5)
    assert.equal(normalizePressureLevel("0"), null)
    assert.equal(normalizePressureLevel("deep"), null)
    assert.equal(normalizePressureLevel(6), null)
  })

  it("enforces daily, weekly, and pressure-specific massage-minute budgets", () => {
    const existingBookings = [
      {
        providerUserId: "provider_1",
        startsAt: "2026-05-18T13:00:00.000Z",
        endsAt: "2026-05-18T14:00:00.000Z",
        status: "CONFIRMED",
        requestedPressureLevel: 5,
        massageCapacityMinutes: 60,
      },
      {
        providerUserId: "provider_1",
        startsAt: "2026-05-19T13:00:00.000Z",
        endsAt: "2026-05-19T14:00:00.000Z",
        status: "REQUESTED",
        requestedPressureLevel: 2,
        massageCapacityMinutes: 60,
      },
      {
        providerUserId: "provider_1",
        startsAt: "2026-05-18T15:00:00.000Z",
        endsAt: "2026-05-18T16:00:00.000Z",
        status: "CANCELLED",
        requestedPressureLevel: 5,
        massageCapacityMinutes: 60,
      },
    ]
    const rules = [
      { providerUserId: "provider_1", period: "DAILY", dayOfWeek: 1, pressureLevel: 0, maxMinutes: 120, active: true },
      { providerUserId: "provider_1", period: "DAILY", dayOfWeek: 1, pressureLevel: 5, maxMinutes: 90, active: true },
      { providerUserId: "provider_1", period: "WEEKLY", pressureLevel: 0, maxMinutes: 150, active: true },
    ]

    assert.deepEqual(capacityAllowsBooking({
      providerUserId: "provider_1",
      startsAt: "2026-05-18T14:00:00.000Z",
      requestedPressureLevel: 2,
      massageCapacityMinutes: 30,
      capacityRules: rules,
      existingBookings,
      timeZone: "America/New_York",
    }), { allowed: true, reason: "" })

    assert.deepEqual(capacityAllowsBooking({
      providerUserId: "provider_1",
      startsAt: "2026-05-18T14:00:00.000Z",
      requestedPressureLevel: 5,
      massageCapacityMinutes: 60,
      capacityRules: rules,
      existingBookings,
      timeZone: "America/New_York",
    }), { allowed: false, reason: "pressure-capacity" })

    assert.deepEqual(capacityAllowsBooking({
      providerUserId: "provider_1",
      startsAt: "2026-05-20T14:00:00.000Z",
      requestedPressureLevel: 2,
      massageCapacityMinutes: 60,
      capacityRules: rules,
      existingBookings,
      timeZone: "America/New_York",
    }), { allowed: false, reason: "weekly-capacity" })
  })

  it("protects provider rest gaps around existing and planned massage sessions", () => {
    assert.equal(hasRestGapConflict({
      startsAt: "2026-05-18T15:10:00.000Z",
      endsAt: "2026-05-18T16:10:00.000Z",
      minRestMinutes: 20,
      existingBookings: [
        { startsAt: "2026-05-18T14:00:00.000Z", endsAt: "2026-05-18T15:00:00.000Z", status: "CONFIRMED" },
      ],
    }), true)

    assert.equal(hasRestGapConflict({
      startsAt: "2026-05-18T15:20:00.000Z",
      endsAt: "2026-05-18T16:20:00.000Z",
      minRestMinutes: 20,
      existingBookings: [
        { startsAt: "2026-05-18T14:00:00.000Z", endsAt: "2026-05-18T15:00:00.000Z", status: "CONFIRMED" },
      ],
    }), false)
  })

  it("enforces provider daily and weekly appointment count limits", () => {
    const existingBookings = [
      { providerUserId: "provider_1", startsAt: "2026-05-18T13:00:00.000Z", status: "REQUESTED" },
      { providerUserId: "provider_1", startsAt: "2026-05-18T15:00:00.000Z", status: "CONFIRMED" },
      { providerUserId: "provider_1", startsAt: "2026-05-19T13:00:00.000Z", status: "CANCELLED" },
      { providerUserId: "provider_1", startsAt: "2026-05-20T13:00:00.000Z", status: "CONFIRMED" },
    ]

    assert.deepEqual(providerAppointmentLimitAllows({
      providerUserId: "provider_1",
      startsAt: "2026-05-18T17:00:00.000Z",
      dailyAppointmentLimit: 2,
      weeklyAppointmentLimit: 4,
      existingBookings,
      timeZone: "America/New_York",
    }), { allowed: false, reason: "daily-appointment-limit" })

    assert.deepEqual(providerAppointmentLimitAllows({
      providerUserId: "provider_1",
      startsAt: "2026-05-21T13:00:00.000Z",
      dailyAppointmentLimit: 3,
      weeklyAppointmentLimit: 3,
      existingBookings,
      timeZone: "America/New_York",
    }), { allowed: false, reason: "weekly-appointment-limit" })
  })
})

describe("sequential public booking options", () => {
  it("builds cross-provider primary plus add-on sequences from deterministic slots", () => {
    const options = buildSequentialBookingOptions({
      practiceId: "practice_1",
      timeZone: "America/New_York",
      pressureLevel: 3,
      policy: { approvalMode: "AUTO_CONFIRM", teamSequencingEnabled: true },
      providers: [
        { userId: "provider_1", label: "Provider One", publiclyBookable: true, minRestMinutes: 0 },
        { userId: "provider_2", label: "Provider Two", publiclyBookable: true, minRestMinutes: 0 },
      ],
      selections: [
        {
          serviceVariantId: "variant_primary",
          serviceName: "Therapeutic Massage",
          serviceVariantName: "60 minute",
          bookingRole: "PRIMARY",
          bookableMinutes: 60,
          massageCapacityMinutes: 60,
          eligibleProviderIds: ["provider_1"],
        },
        {
          serviceVariantId: "variant_add_on",
          serviceName: "Stretching",
          serviceVariantName: "15 minute",
          bookingRole: "ADD_ON",
          bookableMinutes: 15,
          massageCapacityMinutes: 0,
          eligibleProviderIds: ["provider_2"],
        },
      ],
      slotsByVariantAndProvider: {
        "variant_primary:provider_1": [{ startsAt: "2026-05-18T13:00:00.000Z" }],
        "variant_add_on:provider_2": [{ startsAt: "2026-05-18T14:00:00.000Z" }],
      },
      capacityRules: [],
      existingBookings: [],
    })

    assert.equal(options.length, 1)
    assert.equal(options[0].status, "CONFIRMED")
    assert.equal(options[0].totalMassageCapacityMinutes, 60)
    assert.deepEqual(options[0].items.map((item) => ({
      providerUserId: item.providerUserId,
      serviceVariantId: item.serviceVariantId,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
    })), [
      {
        providerUserId: "provider_1",
        serviceVariantId: "variant_primary",
        startsAt: "2026-05-18T13:00:00.000Z",
        endsAt: "2026-05-18T14:00:00.000Z",
      },
      {
        providerUserId: "provider_2",
        serviceVariantId: "variant_add_on",
        startsAt: "2026-05-18T14:00:00.000Z",
        endsAt: "2026-05-18T14:15:00.000Z",
      },
    ])
  })

  it("allows waitlist entries to become booked but not to reopen booked entries", () => {
    assert.equal(waitlistStatusTransitionAllowed("OPEN", "BOOKED"), true)
    assert.equal(waitlistStatusTransitionAllowed("OPEN", "CANCELLED"), true)
    assert.equal(waitlistStatusTransitionAllowed("BOOKED", "OPEN"), false)
  })
})
