// @ts-check

export const CALENDAR_RANGE_OPTIONS = /** @type {const} */ (["day", "week", "five-day", "month"])
export const CALENDAR_PROVIDER_VIEW_MODES = /** @type {const} */ (["only-me", "combined", "split"])
export const CALENDAR_COLOR_MODES = /** @type {const} */ (["service", "status"])

/**
 * @typedef {{
 *   confirmed: boolean
 *   unconfirmed: boolean
 *   customerBefore: boolean
 *   customerAfter: boolean
 *   newClient: boolean
 * }} CalendarAppointmentAttributes
 *
 * @typedef {{
 *   defaultRange: string
 *   providerViewMode: string
 *   selectedProviderId: string | null
 *   showCancelledEvents: boolean
 *   showStatusBadges: boolean
 *   colorMode: string
 *   showStaffPhotos: boolean
 *   appointmentAttributes: CalendarAppointmentAttributes
 * }} CalendarPreferences
 */

/** @type {CalendarPreferences} */
export const DEFAULT_CALENDAR_PREFERENCES = Object.freeze({
  defaultRange: "week",
  providerViewMode: "only-me",
  selectedProviderId: null,
  showCancelledEvents: false,
  showStatusBadges: true,
  colorMode: "service",
  showStaffPhotos: false,
  appointmentAttributes: Object.freeze({
    confirmed: true,
    unconfirmed: true,
    customerBefore: false,
    customerAfter: false,
    newClient: false,
  }),
})

const ATTRIBUTE_KEYS = new Set(Object.keys(DEFAULT_CALENDAR_PREFERENCES.appointmentAttributes))

/**
 * @param {unknown} value
 * @param {readonly string[]} allowed
 * @param {string} fallback
 */
function enumValue(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback
}

/**
 * @param {unknown} value
 */
function booleanValue(value) {
  return typeof value === "boolean" ? value : undefined
}

/**
 * @param {unknown} value
 * @returns {CalendarPreferences}
 */
export function normalizeCalendarPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_CALENDAR_PREFERENCES, appointmentAttributes: { ...DEFAULT_CALENDAR_PREFERENCES.appointmentAttributes } }
  }

  const input = /** @type {Record<string, unknown>} */ (value)
  const selectedProviderId = typeof input.selectedProviderId === "string" && input.selectedProviderId.trim()
    ? input.selectedProviderId.trim()
    : null

  /** @type {CalendarAppointmentAttributes} */
  const attributes = { ...DEFAULT_CALENDAR_PREFERENCES.appointmentAttributes }
  if (input.appointmentAttributes && typeof input.appointmentAttributes === "object" && !Array.isArray(input.appointmentAttributes)) {
    for (const [key, rawValue] of Object.entries(/** @type {Record<string, unknown>} */ (input.appointmentAttributes))) {
      if (!ATTRIBUTE_KEYS.has(key)) continue
      const normalized = booleanValue(rawValue)
      if (normalized !== undefined) {
        attributes[/** @type {keyof typeof attributes} */ (key)] = normalized
      }
    }
  }

  return {
    defaultRange: enumValue(input.defaultRange, CALENDAR_RANGE_OPTIONS, DEFAULT_CALENDAR_PREFERENCES.defaultRange),
    providerViewMode: enumValue(input.providerViewMode, CALENDAR_PROVIDER_VIEW_MODES, DEFAULT_CALENDAR_PREFERENCES.providerViewMode),
    selectedProviderId,
    showCancelledEvents: booleanValue(input.showCancelledEvents) ?? DEFAULT_CALENDAR_PREFERENCES.showCancelledEvents,
    showStatusBadges: booleanValue(input.showStatusBadges) ?? DEFAULT_CALENDAR_PREFERENCES.showStatusBadges,
    colorMode: enumValue(input.colorMode, CALENDAR_COLOR_MODES, DEFAULT_CALENDAR_PREFERENCES.colorMode),
    showStaffPhotos: booleanValue(input.showStaffPhotos) ?? DEFAULT_CALENDAR_PREFERENCES.showStaffPhotos,
    appointmentAttributes: attributes,
  }
}
