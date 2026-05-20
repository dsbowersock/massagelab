// @ts-check

export const CALENDAR_RANGE_OPTIONS = /** @type {const} */ (["day", "week", "five-day", "month"])
export const CALENDAR_PROVIDER_VIEW_MODES = /** @type {const} */ (["only-me", "combined", "split"])
export const CALENDAR_COLOR_MODES = /** @type {const} */ (["service", "status"])
export const CALENDAR_SLOT_DENSITY_OPTIONS = /** @type {const} */ (["compact", "comfortable", "spacious"])
export const CALENDAR_NOTICE_AUTO_HIDE_VIEWS = 3

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
 *   calendarDayStartMinute: number | null
 *   calendarDayEndMinute: number | null
 *   calendarSlotDensity: string
 *   appointmentAttributes: CalendarAppointmentAttributes
 *   noticeDismissals: Record<string, { dismissed: boolean, views: number }>
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
  calendarDayStartMinute: null,
  calendarDayEndMinute: null,
  calendarSlotDensity: "comfortable",
  appointmentAttributes: Object.freeze({
    confirmed: true,
    unconfirmed: true,
    customerBefore: false,
    customerAfter: false,
    newClient: false,
  }),
  noticeDismissals: Object.freeze({}),
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
 */
function minuteValue(value) {
  const minute = Number(value)
  return Number.isInteger(minute) && minute >= 0 && minute <= 24 * 60 ? minute : null
}

/**
 * @param {unknown} value
 * @returns {CalendarPreferences["noticeDismissals"]}
 */
function noticeDismissals(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(/** @type {Record<string, unknown>} */ (value))
      .filter(([key]) => /^[a-z0-9_-]{1,80}$/i.test(key))
      .map(([key, raw]) => {
        const item = raw && typeof raw === "object" && !Array.isArray(raw)
          ? /** @type {Record<string, unknown>} */ (raw)
          : {}
        const views = Number(item.views)
        return [key, {
          dismissed: booleanValue(item.dismissed) ?? false,
          views: Number.isFinite(views) && views > 0 ? Math.min(Math.trunc(views), 100) : 0,
        }]
      }),
  )
}

/**
 * @param {CalendarPreferences} preferences
 * @param {string} noticeKey
 */
export function shouldShowCalendarNotice(preferences, noticeKey) {
  const state = preferences.noticeDismissals[noticeKey]
  if (!state) return true
  if (state.dismissed) return false
  return state.views < CALENDAR_NOTICE_AUTO_HIDE_VIEWS
}

/**
 * @param {unknown} value
 * @returns {CalendarPreferences}
 */
export function normalizeCalendarPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...DEFAULT_CALENDAR_PREFERENCES,
      appointmentAttributes: { ...DEFAULT_CALENDAR_PREFERENCES.appointmentAttributes },
      noticeDismissals: {},
    }
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

  const startMinute = minuteValue(input.calendarDayStartMinute)
  const endMinute = minuteValue(input.calendarDayEndMinute)
  const hasValidDayBounds = startMinute != null && endMinute != null && endMinute > startMinute

  return {
    defaultRange: enumValue(input.defaultRange, CALENDAR_RANGE_OPTIONS, DEFAULT_CALENDAR_PREFERENCES.defaultRange),
    providerViewMode: enumValue(input.providerViewMode, CALENDAR_PROVIDER_VIEW_MODES, DEFAULT_CALENDAR_PREFERENCES.providerViewMode),
    selectedProviderId,
    showCancelledEvents: booleanValue(input.showCancelledEvents) ?? DEFAULT_CALENDAR_PREFERENCES.showCancelledEvents,
    showStatusBadges: booleanValue(input.showStatusBadges) ?? DEFAULT_CALENDAR_PREFERENCES.showStatusBadges,
    colorMode: enumValue(input.colorMode, CALENDAR_COLOR_MODES, DEFAULT_CALENDAR_PREFERENCES.colorMode),
    showStaffPhotos: booleanValue(input.showStaffPhotos) ?? DEFAULT_CALENDAR_PREFERENCES.showStaffPhotos,
    calendarDayStartMinute: hasValidDayBounds ? startMinute : DEFAULT_CALENDAR_PREFERENCES.calendarDayStartMinute,
    calendarDayEndMinute: hasValidDayBounds ? endMinute : DEFAULT_CALENDAR_PREFERENCES.calendarDayEndMinute,
    calendarSlotDensity: enumValue(input.calendarSlotDensity, CALENDAR_SLOT_DENSITY_OPTIONS, DEFAULT_CALENDAR_PREFERENCES.calendarSlotDensity),
    appointmentAttributes: attributes,
    noticeDismissals: noticeDismissals(input.noticeDismissals),
  }
}

/**
 * @param {unknown} existingValue
 * @param {unknown} patchValue
 * @returns {CalendarPreferences}
 */
export function mergeCalendarPreferencePatch(existingValue, patchValue) {
  const existing = normalizeCalendarPreferences(existingValue)
  if (!patchValue || typeof patchValue !== "object" || Array.isArray(patchValue)) {
    return existing
  }

  const patch = /** @type {Record<string, unknown>} */ (patchValue)
  const merged = { ...existing }

  for (const key of [
    "defaultRange",
    "providerViewMode",
    "selectedProviderId",
    "showCancelledEvents",
    "showStatusBadges",
    "colorMode",
    "showStaffPhotos",
    "calendarDayStartMinute",
    "calendarDayEndMinute",
    "calendarSlotDensity",
  ]) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      merged[/** @type {keyof CalendarPreferences} */ (key)] = /** @type {never} */ (patch[key])
    }
  }

  if (patch.appointmentAttributes && typeof patch.appointmentAttributes === "object" && !Array.isArray(patch.appointmentAttributes)) {
    /** @type {CalendarAppointmentAttributes} */
    const nextAttributes = { ...existing.appointmentAttributes }
    for (const [key, rawValue] of Object.entries(/** @type {Record<string, unknown>} */ (patch.appointmentAttributes))) {
      if (!ATTRIBUTE_KEYS.has(key)) continue
      const normalized = booleanValue(rawValue)
      if (normalized !== undefined) {
        nextAttributes[/** @type {keyof CalendarAppointmentAttributes} */ (key)] = normalized
      }
    }
    merged.appointmentAttributes = nextAttributes
  }

  if (patch.noticeDismissals && typeof patch.noticeDismissals === "object" && !Array.isArray(patch.noticeDismissals)) {
    const normalizedPatchDismissals = normalizeCalendarPreferences({ noticeDismissals: patch.noticeDismissals }).noticeDismissals
    merged.noticeDismissals = {
      ...existing.noticeDismissals,
      ...normalizedPatchDismissals,
    }
  }

  return normalizeCalendarPreferences(merged)
}
