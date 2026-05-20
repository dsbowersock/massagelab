import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FREE_CALENDAR_LIMITS,
  buildServiceSnapshot,
  composeAppointmentServices,
  calculateServiceEndTime,
  hasResourceConflict,
  sanitizeServiceClinicalTemplatePayload,
  serviceVariantBookableMinutes,
  sanitizeServicePolicyPayload,
} from "../lib/service-catalog.js"

describe("service catalog scheduling helpers", () => {
  it("calculates bookable duration from service variant work, processing, and buffers", () => {
    const variant = {
      durationMinutes: 60,
      processingMinutes: 15,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 20,
    }

    assert.equal(serviceVariantBookableMinutes(variant), 105)
    assert.equal(
      calculateServiceEndTime({
        startsAt: "2026-05-18T14:00:00.000Z",
        variant,
      }).toISOString(),
      "2026-05-18T15:45:00.000Z",
    )
  })

  it("snapshots service and variant details for appointments and classes", () => {
    assert.deepEqual(buildServiceSnapshot({
      service: {
        name: "Therapeutic Massage",
        category: "Massage",
        color: "#f97316",
      },
      variant: {
        name: "90 minute",
        durationMinutes: 90,
        processingMinutes: 0,
        bufferBeforeMinutes: 5,
        bufferAfterMinutes: 15,
        priceCents: 13500,
        currency: "USD",
      },
    }), {
      serviceName: "Therapeutic Massage",
      serviceVariantName: "90 minute",
      serviceCategory: "Massage",
      serviceColor: "#f97316",
      serviceDurationMinutes: 90,
      serviceProcessingMinutes: 0,
      serviceBufferBeforeMinutes: 5,
      serviceBufferAfterMinutes: 15,
      servicePriceCents: 13500,
      serviceCurrency: "USD",
    })
  })

  it("composes multiple service variants into one scheduling-first appointment plan", () => {
    const composition = composeAppointmentServices([
      {
        service: { id: "service_1", name: "Therapeutic Massage", category: "Massage", color: "#86b817" },
        variant: {
          id: "variant_1",
          serviceTypeId: "service_1",
          name: "60 minute",
          durationMinutes: 60,
          processingMinutes: 10,
          bufferBeforeMinutes: 5,
          bufferAfterMinutes: 15,
          priceCents: 12500,
          currency: "USD",
        },
        resourceIds: ["room_1"],
      },
      {
        service: { id: "service_2", name: "Aromatherapy", category: "Add-on", color: "#d97706" },
        variant: {
          id: "variant_2",
          serviceTypeId: "service_2",
          name: "Add-on",
          durationMinutes: 15,
          processingMinutes: 0,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          priceCents: 2000,
          currency: "USD",
        },
        resourceIds: ["room_1", "warmer_1"],
      },
    ])

    assert.equal(composition.totalBookableMinutes, 105)
    assert.equal(composition.totalPriceCents, 14500)
    assert.deepEqual(composition.resourceIds, ["room_1", "warmer_1"])
    assert.equal(composition.primary.serviceName, "Therapeutic Massage")
    assert.equal(Object.hasOwn(composition.primary, "sortOrder"), false)
    assert.deepEqual(composition.items.map((item) => ({
      serviceTypeId: item.serviceTypeId,
      serviceVariantId: item.serviceVariantId,
      sortOrder: item.sortOrder,
      serviceName: item.serviceName,
    })), [
      { serviceTypeId: "service_1", serviceVariantId: "variant_1", sortOrder: 0, serviceName: "Therapeutic Massage" },
      { serviceTypeId: "service_2", serviceVariantId: "variant_2", sortOrder: 1, serviceName: "Aromatherapy" },
    ])
  })

  it("detects active resource conflicts without letting cancelled events block a room", () => {
    const existingBookings = [
      {
        resourceId: "room_1",
        startsAt: "2026-05-18T14:00:00.000Z",
        endsAt: "2026-05-18T15:00:00.000Z",
        event: { status: "CANCELLED", blocksAvailability: true },
      },
      {
        resourceId: "room_2",
        startsAt: "2026-05-18T14:00:00.000Z",
        endsAt: "2026-05-18T15:00:00.000Z",
        event: { status: "CONFIRMED", blocksAvailability: true },
      },
    ]

    assert.equal(hasResourceConflict({
      resourceIds: ["room_1"],
      startsAt: "2026-05-18T14:30:00.000Z",
      endsAt: "2026-05-18T15:30:00.000Z",
      existingBookings,
    }), false)

    assert.equal(hasResourceConflict({
      resourceIds: ["room_2"],
      startsAt: "2026-05-18T14:30:00.000Z",
      endsAt: "2026-05-18T15:30:00.000Z",
      existingBookings,
    }), true)
  })

  it("keeps operational policy payloads out of PHI-shaped fields", () => {
    assert.deepEqual(sanitizeServicePolicyPayload({
      cancellationPolicy: "24 hour notice",
      noShowPolicy: "50% charge",
      intakeRequirement: "Complete intake form",
      clientEmail: "client@example.com",
      soapNote: "Do not keep clinical content here",
      contraindicationNotice: "Ask provider before booking when unsure.",
    }), {
      cancellationPolicy: "24 hour notice",
      noShowPolicy: "50% charge",
      intakeRequirement: "Complete intake form",
      contraindicationNotice: "Ask provider before booking when unsure.",
    })
  })

  it("keeps clinical-rich service templates generic and local-first", () => {
    assert.deepEqual(sanitizeServiceClinicalTemplatePayload({
      modality: "therapeutic-massage",
      bodyRegionFocus: ["neck", "shoulder"],
      documentationTemplateRefs: [{ id: "template_1", label: "Follow-up SOAP shell" }],
      intakeTemplateRefs: [{ id: "form_1", label: "Massage intake" }],
      contraindicationPrompts: ["Ask about acute injury before booking."],
      clientEmail: "client@example.com",
      soapNote: "client-specific clinical note",
      painMap: ["left shoulder"],
      transcript: "session transcript",
    }), {
      modality: "therapeutic-massage",
      bodyRegionFocus: ["neck", "shoulder"],
      documentationTemplateRefs: [{ id: "template_1", label: "Follow-up SOAP shell" }],
      intakeTemplateRefs: [{ id: "form_1", label: "Massage intake" }],
      contraindicationPrompts: ["Ask about acute injury before booking."],
    })
  })

  it("defines conservative free calendar limits", () => {
    assert.deepEqual(FREE_CALENDAR_LIMITS, {
      practices: 1,
      activeServices: 3,
      activeVariantsPerService: 3,
      publicBookingDays: 7,
    })
  })
})
