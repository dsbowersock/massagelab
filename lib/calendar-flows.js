// @ts-check

import { dateValue, intervalsOverlap } from "./calendar.js"

export const CALENDAR_FLOWS = /** @type {const} */ (["APPOINTMENT", "CLIENT_REQUEST", "PERSONAL", "CLASS", "REMINDER"])
export const CALENDAR_BLOCKING_STATUSES = /** @type {const} */ (["REQUESTED", "CONFIRMED", "ACTIVE"])
export const CALENDAR_TERMINAL_STATUSES = /** @type {const} */ (["CANCELLED", "COMPLETED", "NO_SHOW"])

const STAFF_ROLES = new Set(["OWNER", "STAFF"])
const PRACTICE_MANAGEMENT_ROLES = new Set(["OWNER", "STAFF"])
const OWN_SCHEDULE_ROLES = new Set(["OWNER", "THERAPIST"])
const SENSITIVE_METADATA_KEY = /(soap|note|notes|pain|transcript|diagnosis|assessment|treatment|intake|journal|client|patient|email|phone|address|birth|dob|license|credential|phi)/i

/**
 * @param {{
 *   flow: string
 *   role?: string | null
 *   actorUserId?: string | null
 *   targetUserId?: string | null
 *   isClientSelf?: boolean
 * }} input
 */
export function canCreateCalendarFlow({ flow, role = null, actorUserId = null, targetUserId = null, isClientSelf = false }) {
  if (flow === "CLIENT_REQUEST") {
    return Boolean(isClientSelf && actorUserId)
  }

  if (flow === "CLASS") {
    return PRACTICE_MANAGEMENT_ROLES.has(String(role ?? ""))
  }

  if (flow === "APPOINTMENT") {
    if (STAFF_ROLES.has(String(role ?? ""))) return true
    return role === "THERAPIST" && actorUserId != null && actorUserId === targetUserId
  }

  if (flow === "PERSONAL") {
    if (role === "OWNER") return true
    return OWN_SCHEDULE_ROLES.has(String(role ?? "")) && actorUserId != null && actorUserId === targetUserId
  }

  if (flow === "REMINDER") {
    if (PRACTICE_MANAGEMENT_ROLES.has(String(role ?? ""))) return true
    return role === "THERAPIST" && actorUserId != null && actorUserId === targetUserId
  }

  return false
}

/**
 * @param {{ kind?: string, status?: string, blocksAvailability?: boolean }} event
 */
export function calendarEventBlocksAvailability(event) {
  if (!event?.blocksAvailability) return false
  if (event.kind === "REMINDER") return false
  if (CALENDAR_TERMINAL_STATUSES.includes(/** @type {"CANCELLED" | "COMPLETED" | "NO_SHOW"} */ (event.status))) return false
  return CALENDAR_BLOCKING_STATUSES.includes(/** @type {"REQUESTED" | "CONFIRMED" | "ACTIVE"} */ (event.status ?? "ACTIVE"))
}

/**
 * @param {{
 *   startsAt: Date | string | number
 *   endsAt: Date | string | number
 *   events?: Array<{ startsAt: Date | string | number, endsAt: Date | string | number, kind?: string, status?: string, blocksAvailability?: boolean }>
 * }} input
 */
export function hasCalendarEventConflict({ startsAt, endsAt, events = [] }) {
  const start = dateValue(startsAt)
  const end = dateValue(endsAt)

  if (end <= start) {
    return true
  }

  return events.some((event) => (
    calendarEventBlocksAvailability(event) &&
    intervalsOverlap(start, end, event.startsAt, event.endsAt)
  ))
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeAuditValue(value) {
  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeAuditValue(item))
      .filter((item) => item !== undefined)

    return sanitizedItems.length > 0 ? sanitizedItems : undefined
  }

  if (!value || typeof value !== "object") {
    return value
  }

  const sanitized = Object.fromEntries(
    Object.entries(/** @type {Record<string, unknown>} */ (value))
      .filter(([key]) => !SENSITIVE_METADATA_KEY.test(key))
      .map(([key, item]) => [key, sanitizeAuditValue(item)])
      .filter(([, item]) => item !== undefined),
  )

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

/**
 * @param {Record<string, unknown>} metadata
 */
export function sanitizeCalendarAuditMetadata(metadata) {
  return /** @type {Record<string, unknown>} */ (sanitizeAuditValue(metadata) ?? {})
}

/**
 * @param {{
 *   eventId: string
 *   actorUserId?: string | null
 *   action: string
 *   recipientUserIds?: string[]
 *   payload?: Record<string, unknown>
 * }} input
 */
export function buildCalendarNotificationIntents({ eventId, actorUserId = null, action, recipientUserIds = [], payload = {} }) {
  const uniqueRecipientUserIds = [...new Set(recipientUserIds.filter(Boolean))]
  const safePayload = sanitizeCalendarAuditMetadata({
    action,
    eventId,
    ...payload,
  })

  return uniqueRecipientUserIds.map((recipientUserId) => ({
    eventId,
    actorUserId,
    recipientUserId,
    action,
    channel: "INTERNAL",
    deliveryStatus: "PENDING",
    payload: safePayload,
  }))
}

const FLOW_PLANS = {
  APPOINTMENT: {
    kind: "APPOINTMENT",
    status: "CONFIRMED",
    blocksAvailability: true,
    detailModel: "appointment",
    auditAction: "calendar.appointment.create",
    notificationAction: "APPOINTMENT_CREATED",
  },
  CLIENT_REQUEST: {
    kind: "APPOINTMENT",
    status: "REQUESTED",
    blocksAvailability: true,
    detailModel: "appointment",
    auditAction: "calendar.appointment.request",
    notificationAction: "APPOINTMENT_REQUESTED",
  },
  PERSONAL: {
    kind: "PERSONAL",
    status: "ACTIVE",
    blocksAvailability: true,
    detailModel: "personal",
    auditAction: "calendar.personal.create",
    notificationAction: "PERSONAL_EVENT_CREATED",
  },
  CLASS: {
    kind: "CLASS",
    status: "CONFIRMED",
    blocksAvailability: true,
    detailModel: "class",
    auditAction: "calendar.class.create",
    notificationAction: "CLASS_CREATED",
  },
  REMINDER: {
    kind: "REMINDER",
    status: "ACTIVE",
    blocksAvailability: false,
    detailModel: "reminder",
    auditAction: "calendar.reminder.create",
    notificationAction: "REMINDER_CREATED",
  },
}

/**
 * @param {{
 *   flow: string
 *   practiceId: string
 *   actorUserId?: string | null
 *   targetUserId?: string | null
 *   startsAt: Date | string | number
 *   endsAt: Date | string | number
 *   title: string
 *   timezone?: string
 *   visibility?: string
 * }} input
 */
export function buildCalendarCreationPlan({
  flow,
  practiceId,
  actorUserId = null,
  targetUserId = null,
  startsAt,
  endsAt,
  title,
  timezone = "America/New_York",
  visibility = "PRACTICE",
}) {
  const config = FLOW_PLANS[/** @type {keyof typeof FLOW_PLANS} */ (flow)]
  if (!config) {
    throw new Error("Unsupported calendar creation flow.")
  }

  const start = dateValue(startsAt)
  const end = dateValue(endsAt)
  if (end <= start) {
    throw new Error("Calendar event end time must be after the start time.")
  }

  return {
    event: {
      practiceId,
      ownerUserId: targetUserId,
      createdById: actorUserId,
      kind: config.kind,
      title: String(title ?? "").trim() || "Calendar event",
      startsAt: start,
      endsAt: end,
      timezone,
      visibility,
      status: config.status,
      blocksAvailability: config.blocksAvailability,
    },
    detailModel: config.detailModel,
    auditAction: config.auditAction,
    notificationAction: config.notificationAction,
  }
}
