// @ts-check

const STATUS_LABELS = Object.freeze({
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
  ACTIVE: "Active",
})

const STATUS_COLORS = Object.freeze({
  REQUESTED: "#f59e0b",
  CONFIRMED: "#86b817",
  CANCELLED: "#737373",
  COMPLETED: "#2563eb",
  NO_SHOW: "#dc2626",
  ACTIVE: "#f97316",
})

const EDITABLE_KINDS = new Set(["APPOINTMENT", "PERSONAL", "CLASS"])
const TERMINAL_STATUSES = new Set(["CANCELLED", "COMPLETED", "NO_SHOW"])
const MANAGEMENT_ROLES = new Set(["OWNER", "STAFF"])

/**
 * @param {{ kind?: string | null, status?: string | null, blocksAvailability?: boolean | null }} event
 */
export function calendarEventEditable(event) {
  if (!EDITABLE_KINDS.has(String(event?.kind ?? ""))) return false
  if (TERMINAL_STATUSES.has(String(event?.status ?? ""))) return false
  return event?.blocksAvailability !== false
}

/**
 * @param {{ role?: string | null, actorUserId?: string | null, event: { kind?: string | null, ownerUserId?: string | null, status?: string | null, blocksAvailability?: boolean | null } }} input
 */
export function canRescheduleCalendarEvent({ role, actorUserId, event }) {
  if (!calendarEventEditable(event)) return false
  if (MANAGEMENT_ROLES.has(String(role ?? ""))) return true
  return role === "THERAPIST" && Boolean(actorUserId) && actorUserId === event.ownerUserId && event.kind !== "CLASS"
}

/**
 * @param {unknown} value
 */
function dateString(value) {
  return value instanceof Date ? value.toISOString() : String(value ?? "")
}

/**
 * @param {string | null | undefined} value
 */
function displayLabel(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * @param {any} event
 * @param {{ colorMode?: string, showStatusBadges?: boolean }} [preferences]
 */
export function buildCalendarWorkspaceEvent(event, preferences = {}) {
  const appointment = event.appointment ?? null
  const personalBlock = event.personalBlock ?? null
  const calendarClass = event.class ?? null
  const owner = event.owner ?? null
  const serviceColor = appointment?.serviceColor ?? calendarClass?.serviceColor ?? null
  const status = String(event.status ?? "ACTIVE")
  const backgroundColor = preferences.colorMode === "status"
    ? STATUS_COLORS[/** @type {keyof typeof STATUS_COLORS} */ (status)] ?? STATUS_COLORS.ACTIVE
    : serviceColor ?? STATUS_COLORS[/** @type {keyof typeof STATUS_COLORS} */ (status)] ?? STATUS_COLORS.ACTIVE
  const providerLabel = displayLabel(appointment?.therapist?.name ?? calendarClass?.instructor?.name ?? personalBlock?.therapist?.name ?? owner?.name)
  const clientLabel = displayLabel(appointment?.practiceClient?.displayName ?? appointment?.practiceClient?.email)

  return {
    id: event.id,
    title: String(event.title ?? appointment?.serviceName ?? calendarClass?.serviceName ?? "Calendar event"),
    start: dateString(event.startsAt),
    end: dateString(event.endsAt),
    backgroundColor,
    borderColor: backgroundColor,
    editable: calendarEventEditable(event),
    durationEditable: false,
    extendedProps: {
      kind: event.kind,
      status,
      statusBadge: preferences.showStatusBadges === false ? null : STATUS_LABELS[/** @type {keyof typeof STATUS_LABELS} */ (status)] ?? status,
      providerLabel,
      clientLabel,
      ownerUserId: event.ownerUserId ?? null,
    },
  }
}
