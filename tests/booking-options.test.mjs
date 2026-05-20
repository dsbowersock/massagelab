import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildBookingOptionModel,
  groupBookingSlotsByDay,
} from "../lib/booking-options.js"

describe("guided booking option model", () => {
  it("groups appointment slots by practice-local day while preserving request payload fields", () => {
    assert.deepEqual(groupBookingSlotsByDay([
      { startsAt: "2026-05-19T13:00:00.000Z" },
      { startsAt: "2026-05-19T15:30:00.000Z" },
      { startsAt: "2026-05-20T14:00:00.000Z" },
    ], "America/New_York").map((day) => ({
      date: day.date,
      slots: day.slots.map((slot) => slot.startsAt),
    })), [
      {
        date: "2026-05-19",
        slots: ["2026-05-19T13:00:00.000Z", "2026-05-19T15:30:00.000Z"],
      },
      {
        date: "2026-05-20",
        slots: ["2026-05-20T14:00:00.000Z"],
      },
    ])
  })

  it("builds a guided service, provider, and day model for the booking picker", () => {
    const model = buildBookingOptionModel({
      practiceId: "practice_1",
      timeZone: "America/New_York",
      services: [
        {
          id: "service_1",
          name: "Therapeutic Massage",
          description: "Focused session",
          eligibleProviderIds: ["provider_1"],
          variants: [
            {
              id: "variant_1",
              name: "60 minute",
              durationMinutes: 60,
              bufferAfterMinutes: 15,
              priceCents: 12500,
              currency: "USD",
            },
          ],
        },
      ],
      providers: [
        { userId: "provider_1", label: "Provider One" },
        { userId: "provider_2", label: "Provider Two" },
      ],
      slotsByVariantAndProvider: {
        "variant_1:provider_1": [{ startsAt: "2026-05-19T13:00:00.000Z" }],
      },
    })

    assert.equal(model.practiceId, "practice_1")
    assert.equal(model.services[0].variants[0].providers.length, 1)
    assert.deepEqual(model.services[0].variants[0].providers[0].days[0].slots[0].request, {
      practiceId: "practice_1",
      therapistId: "provider_1",
      serviceVariantId: "variant_1",
      startsAt: "2026-05-19T13:00:00.000Z",
    })
  })
})
