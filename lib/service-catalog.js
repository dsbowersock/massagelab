// @ts-check

import { dateValue, intervalsOverlap } from "./calendar.js"

export const FREE_CALENDAR_LIMITS = Object.freeze({
  practices: 1,
  activeServices: 3,
  activeVariantsPerService: 3,
  publicBookingDays: 7,
})

const ACTIVE_BLOCKING_STATUSES = new Set(["REQUESTED", "CONFIRMED", "ACTIVE"])
const TERMINAL_STATUSES = new Set(["CANCELLED", "COMPLETED", "NO_SHOW"])
const SENSITIVE_POLICY_KEY = /(soap|note|notes|pain|transcript|diagnosis|assessment|treatment|client|patient|email|phone|address|birth|dob|license|credential|phi)/i
const SENSITIVE_CLINICAL_TEMPLATE_KEY = /(soapNote|client|patient|email|phone|address|birth|dob|painMap|transcript|diagnosis|assessment|treatment|phi)/i

/**
 * @param {unknown} value
 */
function minuteValue(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0
}

/**
 * @param {{ durationMinutes?: number, processingMinutes?: number, bufferBeforeMinutes?: number, bufferAfterMinutes?: number }} variant
 */
export function serviceVariantBookableMinutes(variant) {
  return minuteValue(variant?.durationMinutes) +
    minuteValue(variant?.processingMinutes) +
    minuteValue(variant?.bufferBeforeMinutes) +
    minuteValue(variant?.bufferAfterMinutes)
}

/**
 * @param {{ startsAt: Date | string | number, variant: { durationMinutes?: number, processingMinutes?: number, bufferBeforeMinutes?: number, bufferAfterMinutes?: number } }} input
 */
export function calculateServiceEndTime({ startsAt, variant }) {
  const start = dateValue(startsAt)
  return new Date(start.getTime() + serviceVariantBookableMinutes(variant) * 60_000)
}

/**
 * @param {{ service: { name?: string | null, category?: string | null, color?: string | null }, variant: { name?: string | null, durationMinutes?: number, processingMinutes?: number, bufferBeforeMinutes?: number, bufferAfterMinutes?: number, priceCents?: number | null, currency?: string | null } }} input
 */
export function buildServiceSnapshot({ service, variant }) {
  return {
    serviceName: String(service?.name ?? "Service").trim() || "Service",
    serviceVariantName: String(variant?.name ?? "Default").trim() || "Default",
    serviceCategory: service?.category ?? null,
    serviceColor: service?.color ?? null,
    serviceDurationMinutes: minuteValue(variant?.durationMinutes),
    serviceProcessingMinutes: minuteValue(variant?.processingMinutes),
    serviceBufferBeforeMinutes: minuteValue(variant?.bufferBeforeMinutes),
    serviceBufferAfterMinutes: minuteValue(variant?.bufferAfterMinutes),
    servicePriceCents: Number.isInteger(variant?.priceCents) ? variant.priceCents : null,
    serviceCurrency: String(variant?.currency ?? "USD").trim().toUpperCase() || "USD",
  }
}

/**
 * @param {null | undefined | (ReturnType<typeof buildServiceSnapshot> & { serviceTypeId?: string | null, serviceVariantId?: string | null })} item
 */
function buildAppointmentPrimarySnapshot(item) {
  if (!item) {
    return {
      serviceTypeId: null,
      serviceVariantId: null,
      ...buildServiceSnapshot({ service: {}, variant: {} }),
    }
  }

  return {
    serviceTypeId: item.serviceTypeId ?? null,
    serviceVariantId: item.serviceVariantId ?? null,
    serviceName: item.serviceName,
    serviceVariantName: item.serviceVariantName,
    serviceCategory: item.serviceCategory,
    serviceColor: item.serviceColor,
    serviceDurationMinutes: item.serviceDurationMinutes,
    serviceProcessingMinutes: item.serviceProcessingMinutes,
    serviceBufferBeforeMinutes: item.serviceBufferBeforeMinutes,
    serviceBufferAfterMinutes: item.serviceBufferAfterMinutes,
    servicePriceCents: item.servicePriceCents,
    serviceCurrency: item.serviceCurrency,
  }
}

/**
 * @param {Array<{
 *   service: { id?: string, name?: string | null, category?: string | null, color?: string | null }
 *   variant: { id?: string, serviceTypeId?: string, name?: string | null, durationMinutes?: number, processingMinutes?: number, bufferBeforeMinutes?: number, bufferAfterMinutes?: number, priceCents?: number | null, currency?: string | null }
 *   resourceIds?: string[]
 * }>} selections
 */
export function composeAppointmentServices(selections) {
  const items = selections.map((selection, index) => {
    const snapshot = buildServiceSnapshot({ service: selection.service, variant: selection.variant })
    return {
      serviceTypeId: selection.variant.serviceTypeId ?? selection.service.id ?? null,
      serviceVariantId: selection.variant.id ?? null,
      sortOrder: index,
      ...snapshot,
    }
  })
  const totalBookableMinutes = selections.reduce((sum, selection) => sum + serviceVariantBookableMinutes(selection.variant), 0)
  const prices = items
    .map((item) => item.servicePriceCents)
    .filter((value) => Number.isInteger(value))
    .map((value) => Number(value))
  const totalPriceCents = prices.length > 0 ? prices.reduce((sum, value) => sum + value, 0) : null
  const resourceIds = [...new Set(selections.flatMap((selection) => selection.resourceIds ?? []).filter(Boolean))]

  return {
    items,
    primary: buildAppointmentPrimarySnapshot(items[0]),
    totalBookableMinutes,
    totalPriceCents,
    resourceIds,
  }
}

/**
 * @param {{ event?: { status?: string | null, blocksAvailability?: boolean | null } | null } | null | undefined} booking
 */
function resourceBookingBlocksAvailability(booking) {
  const event = booking?.event
  if (event?.blocksAvailability === false) return false
  const status = String(event?.status ?? "ACTIVE")
  if (TERMINAL_STATUSES.has(status)) return false
  return ACTIVE_BLOCKING_STATUSES.has(status)
}

/**
 * @param {{ resourceIds?: string[], startsAt: Date | string | number, endsAt: Date | string | number, existingBookings?: Array<{ resourceId?: string | null, startsAt: Date | string | number, endsAt: Date | string | number, event?: { status?: string | null, blocksAvailability?: boolean | null } | null }> }} input
 */
export function hasResourceConflict({ resourceIds = [], startsAt, endsAt, existingBookings = [] }) {
  const requiredResourceIds = new Set(resourceIds.filter(Boolean))
  if (requiredResourceIds.size === 0) return false

  const start = dateValue(startsAt)
  const end = dateValue(endsAt)
  if (end <= start) return true

  return existingBookings.some((booking) => (
    requiredResourceIds.has(String(booking.resourceId ?? "")) &&
    resourceBookingBlocksAvailability(booking) &&
    intervalsOverlap(start, end, booking.startsAt, booking.endsAt)
  ))
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizePolicyValue(value) {
  if (Array.isArray(value)) {
    const items = value.map((item) => sanitizePolicyValue(item)).filter((item) => item !== undefined)
    return items.length > 0 ? items : undefined
  }

  if (!value || typeof value !== "object") {
    return value
  }

  const sanitized = Object.fromEntries(
    Object.entries(/** @type {Record<string, unknown>} */ (value))
      .filter(([key]) => !SENSITIVE_POLICY_KEY.test(key))
      .map(([key, item]) => [key, sanitizePolicyValue(item)])
      .filter(([, item]) => item !== undefined),
  )

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

/**
 * @param {Record<string, unknown>} payload
 */
export function sanitizeServicePolicyPayload(payload) {
  return /** @type {Record<string, unknown>} */ (sanitizePolicyValue(payload) ?? {})
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeClinicalTemplateValue(value) {
  if (Array.isArray(value)) {
    const items = value.map((item) => sanitizeClinicalTemplateValue(item)).filter((item) => item !== undefined)
    return items.length > 0 ? items : undefined
  }

  if (!value || typeof value !== "object") {
    return value
  }

  const sanitized = Object.fromEntries(
    Object.entries(/** @type {Record<string, unknown>} */ (value))
      .filter(([key]) => !SENSITIVE_CLINICAL_TEMPLATE_KEY.test(key))
      .map(([key, item]) => [key, sanitizeClinicalTemplateValue(item)])
      .filter(([, item]) => item !== undefined),
  )

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

/**
 * @param {Record<string, unknown>} payload
 */
export function sanitizeServiceClinicalTemplatePayload(payload) {
  return /** @type {Record<string, unknown>} */ (sanitizeClinicalTemplateValue(payload) ?? {})
}
