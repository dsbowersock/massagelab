// @ts-check

import { dateValue, intervalsOverlap } from "./calendar.js"

const ACTIVE_BOOKING_STATUSES = new Set(["REQUESTED", "CONFIRMED", "ACTIVE"])
const VALID_APPROVAL_MODES = new Set(["MANUAL", "AUTO_CONFIRM"])
const VALID_STAFF_VISIBILITY = new Set(["PUBLIC_LABELS", "HIDE_STAFF"])
const VALID_WAITLIST_TRANSITIONS = new Set(["OPEN:BOOKED", "OPEN:CANCELLED"])

/**
 * @typedef {{
 *   sortOrder: number
 *   providerUserId: string
 *   providerLabel: string
 *   serviceVariantId: string
 *   serviceName: string
 *   serviceVariantName: string
 *   bookingRole: string
 *   startsAt: string
 *   endsAt: string
 *   requestedPressureLevel: number
 *   massageCapacityMinutes: number
 *   status?: string
 * }} SequencePlannedItem
 *
 * @typedef {{
 *   practiceId: string
 *   timeZone: string
 *   pressureLevel: number
 *   status: string
 *   startsAt: string
 *   endsAt: string
 *   totalMassageCapacityMinutes: number
 *   items: SequencePlannedItem[]
 * }} SequenceOption
 */

export const BOOKING_POLICY_DEFAULTS = Object.freeze({
  enabled: true,
  approvalMode: "MANUAL",
  minNoticeMinutes: 0,
  maxAdvanceDays: 7,
  dailyAppointmentLimit: null,
  anyProviderEnabled: true,
  teamSequencingEnabled: true,
  staffVisibility: "PUBLIC_LABELS",
  dualTimezoneDisplay: true,
  proximityNoticeEnabled: false,
  proximityRadiusMiles: 50,
})

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function integerInRange(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.trunc(number), min), max)
}

/**
 * @param {unknown} value
 */
function optionalPositiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

/**
 * @param {unknown} value
 */
function optionalText(value) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

/**
 * @param {unknown} input
 */
export function normalizeBookingPolicy(input) {
  const policy = input && typeof input === "object" ? /** @type {Record<string, unknown>} */ (input) : {}
  const approvalMode = String(policy.approvalMode ?? BOOKING_POLICY_DEFAULTS.approvalMode).toUpperCase()
  const staffVisibility = String(policy.staffVisibility ?? BOOKING_POLICY_DEFAULTS.staffVisibility).toUpperCase()

  return {
    enabled: policy.enabled !== false,
    approvalMode: VALID_APPROVAL_MODES.has(approvalMode) ? approvalMode : BOOKING_POLICY_DEFAULTS.approvalMode,
    minNoticeMinutes: integerInRange(policy.minNoticeMinutes, BOOKING_POLICY_DEFAULTS.minNoticeMinutes, 0, 365 * 24 * 60),
    maxAdvanceDays: integerInRange(policy.maxAdvanceDays, BOOKING_POLICY_DEFAULTS.maxAdvanceDays, 1, 365),
    dailyAppointmentLimit: optionalPositiveInteger(policy.dailyAppointmentLimit),
    anyProviderEnabled: policy.anyProviderEnabled !== false,
    teamSequencingEnabled: policy.teamSequencingEnabled !== false,
    staffVisibility: VALID_STAFF_VISIBILITY.has(staffVisibility) ? staffVisibility : BOOKING_POLICY_DEFAULTS.staffVisibility,
    dualTimezoneDisplay: policy.dualTimezoneDisplay !== false,
    proximityNoticeEnabled: Boolean(policy.proximityNoticeEnabled),
    proximityRadiusMiles: integerInRange(policy.proximityRadiusMiles, BOOKING_POLICY_DEFAULTS.proximityRadiusMiles, 1, 500),
  }
}

/**
 * @param {unknown} input
 * @param {{ userId?: string, label?: string }} provider
 */
export function normalizeProviderBookingPolicy(input, provider = {}) {
  const policy = input && typeof input === "object" ? /** @type {Record<string, unknown>} */ (input) : {}
  const providerUserId = String(policy.providerUserId ?? provider.userId ?? "")

  return {
    providerUserId,
    publiclyBookable: policy.publiclyBookable !== false,
    displayLabel: optionalText(policy.displayLabel) ?? optionalText(provider.label) ?? "Provider",
    minRestMinutes: integerInRange(policy.minRestMinutes, 0, 0, 24 * 60),
    dailyAppointmentLimit: optionalPositiveInteger(policy.dailyAppointmentLimit),
    weeklyAppointmentLimit: optionalPositiveInteger(policy.weeklyAppointmentLimit),
  }
}

/**
 * @param {unknown} value
 */
export function normalizePressureLevel(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null
}

/**
 * @param {unknown} approvalMode
 */
export function bookingStatusForApprovalMode(approvalMode) {
  return String(approvalMode ?? "").toUpperCase() === "AUTO_CONFIRM" ? "CONFIRMED" : "REQUESTED"
}

/**
 * @param {unknown} status
 */
function activeBooking(status) {
  return ACTIVE_BOOKING_STATUSES.has(String(status ?? "CONFIRMED").toUpperCase())
}

/**
 * @param {Date | string | number} value
 * @param {string} timeZone
 */
function localDateParts(value, timeZone = "UTC") {
  const date = dateValue(value)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const dateKey = `${map.year}-${map.month}-${map.day}`
  const dayOfWeek = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay()
  const weekStart = new Date(`${dateKey}T00:00:00.000Z`)
  weekStart.setUTCDate(weekStart.getUTCDate() - ((dayOfWeek + 6) % 7))

  return {
    dateKey,
    dayOfWeek,
    weekKey: weekStart.toISOString().slice(0, 10),
  }
}

/**
 * @param {Date | string | number} startsAt
 * @param {number} minutes
 */
function addMinutes(startsAt, minutes) {
  return new Date(dateValue(startsAt).getTime() + minutes * 60_000)
}

/**
 * @param {{
 *   startsAt: Date | string | number
 *   endsAt: Date | string | number
 *   minRestMinutes?: number | null
 *   existingBookings?: Array<{ startsAt: Date | string | number, endsAt?: Date | string | number, status?: string | null }>
 * }} input
 */
export function hasRestGapConflict({
  startsAt,
  endsAt,
  minRestMinutes = 0,
  existingBookings = [],
}) {
  const rest = integerInRange(minRestMinutes, 0, 0, 24 * 60)
  if (rest <= 0) return false

  const start = dateValue(startsAt)
  const end = dateValue(endsAt)
  return existingBookings.some((booking) => {
    if (!activeBooking(booking.status)) return false
    const bookingStart = dateValue(booking.startsAt)
    const bookingEnd = booking.endsAt ? dateValue(booking.endsAt) : bookingStart
    return intervalsOverlap(
      start,
      end,
      new Date(bookingStart.getTime() - rest * 60_000),
      new Date(bookingEnd.getTime() + rest * 60_000),
    )
  })
}

/**
 * @param {{
 *   providerUserId: string
 *   startsAt: Date | string | number
 *   dailyAppointmentLimit?: number | null
 *   weeklyAppointmentLimit?: number | null
 *   existingBookings?: Array<{ providerUserId?: string | null, startsAt: Date | string | number, status?: string | null }>
 *   timeZone?: string
 * }} input
 */
export function providerAppointmentLimitAllows({
  providerUserId,
  startsAt,
  dailyAppointmentLimit = null,
  weeklyAppointmentLimit = null,
  existingBookings = [],
  timeZone = "UTC",
}) {
  const dailyLimit = optionalPositiveInteger(dailyAppointmentLimit)
  const weeklyLimit = optionalPositiveInteger(weeklyAppointmentLimit)
  if (!dailyLimit && !weeklyLimit) return { allowed: true, reason: "" }

  const target = localDateParts(startsAt, timeZone)
  const activeProviderBookings = existingBookings.filter((booking) => (
    String(booking.providerUserId ?? providerUserId) === providerUserId &&
    activeBooking(booking.status)
  ))
  const dailyCount = activeProviderBookings.filter((booking) => localDateParts(booking.startsAt, timeZone).dateKey === target.dateKey).length
  if (dailyLimit && dailyCount + 1 > dailyLimit) {
    return { allowed: false, reason: "daily-appointment-limit" }
  }

  const weeklyCount = activeProviderBookings.filter((booking) => localDateParts(booking.startsAt, timeZone).weekKey === target.weekKey).length
  if (weeklyLimit && weeklyCount + 1 > weeklyLimit) {
    return { allowed: false, reason: "weekly-appointment-limit" }
  }

  return { allowed: true, reason: "" }
}

/**
 * @param {{ period?: string | null, dayOfWeek?: number | null, pressureLevel?: number | null, providerUserId?: string | null, active?: boolean | null }} rule
 * @param {string} providerUserId
 * @param {{ dayOfWeek: number }} target
 * @param {number} pressureLevel
 * @param {"DAILY" | "WEEKLY"} period
 */
function capacityRuleMatches(rule, providerUserId, target, pressureLevel, period) {
  if (rule.active === false) return false
  if (String(rule.providerUserId ?? "") !== providerUserId) return false
  if (String(rule.period ?? "").toUpperCase() !== period) return false
  const rulePressure = Number(rule.pressureLevel ?? 0)
  if (rulePressure !== 0 && rulePressure !== pressureLevel) return false
  if (period === "DAILY" && rule.dayOfWeek != null && Number(rule.dayOfWeek) !== target.dayOfWeek) return false
  return true
}

/**
 * @param {{
 *   providerUserId: string
 *   startsAt: Date | string | number
 *   requestedPressureLevel: number
 *   massageCapacityMinutes?: number | null
 *   capacityRules?: Array<{ providerUserId?: string | null, period?: string | null, dayOfWeek?: number | null, pressureLevel?: number | null, maxMinutes?: number | null, active?: boolean | null }>
 *   existingBookings?: Array<{ providerUserId?: string | null, startsAt: Date | string | number, status?: string | null, requestedPressureLevel?: number | null, massageCapacityMinutes?: number | null }>
 *   timeZone?: string
 * }} input
 */
export function capacityAllowsBooking({
  providerUserId,
  startsAt,
  requestedPressureLevel,
  massageCapacityMinutes = 0,
  capacityRules = [],
  existingBookings = [],
  timeZone = "UTC",
}) {
  const pressureLevel = normalizePressureLevel(requestedPressureLevel)
  const newMinutes = integerInRange(massageCapacityMinutes, 0, 0, 24 * 60)
  if (!pressureLevel || newMinutes <= 0) return { allowed: true, reason: "" }

  const target = localDateParts(startsAt, timeZone)
  const activeProviderBookings = existingBookings.filter((booking) => (
    String(booking.providerUserId ?? providerUserId) === providerUserId &&
    activeBooking(booking.status)
  ))

  /**
   * @param {"DAILY" | "WEEKLY"} period
   * @param {boolean} pressureSpecific
   */
  const usage = (period, pressureSpecific) => activeProviderBookings
    .filter((booking) => {
      const parts = localDateParts(booking.startsAt, timeZone)
      const samePeriod = period === "DAILY" ? parts.dateKey === target.dateKey : parts.weekKey === target.weekKey
      if (!samePeriod) return false
      return !pressureSpecific || Number(booking.requestedPressureLevel) === pressureLevel
    })
    .reduce((sum, booking) => sum + integerInRange(booking.massageCapacityMinutes, 0, 0, 24 * 60), 0)

  for (const period of /** @type {const} */ (["DAILY", "WEEKLY"])) {
    const totalUsage = usage(period, false)
    const pressureUsage = usage(period, true)
    const matchingRules = capacityRules.filter((rule) => capacityRuleMatches(rule, providerUserId, target, pressureLevel, period))

    for (const rule of matchingRules.filter((item) => Number(item.pressureLevel ?? 0) !== 0)) {
      if (pressureUsage + newMinutes > integerInRange(rule.maxMinutes, 0, 0, 7 * 24 * 60)) {
        return { allowed: false, reason: "pressure-capacity" }
      }
    }

    for (const rule of matchingRules.filter((item) => Number(item.pressureLevel ?? 0) === 0)) {
      if (totalUsage + newMinutes > integerInRange(rule.maxMinutes, 0, 0, 7 * 24 * 60)) {
        return { allowed: false, reason: period === "DAILY" ? "daily-capacity" : "weekly-capacity" }
      }
    }
  }

  return { allowed: true, reason: "" }
}

/**
 * @param {unknown} current
 * @param {unknown} next
 */
export function waitlistStatusTransitionAllowed(current, next) {
  return VALID_WAITLIST_TRANSITIONS.has(`${String(current ?? "").toUpperCase()}:${String(next ?? "").toUpperCase()}`)
}

/**
 * @param {Date | string | number} value
 */
function iso(value) {
  return dateValue(value).toISOString()
}

/**
 * @param {Array<{ startsAt: Date | string | number }>} slots
 */
function slotStartSet(slots = []) {
  return new Set(slots.map((slot) => iso(slot.startsAt)))
}

/**
 * @param {{ bookableMinutes?: number | null, durationMinutes?: number | null }} selection
 */
function selectionBookableMinutes(selection) {
  return integerInRange(selection.bookableMinutes ?? selection.durationMinutes, 0, 1, 24 * 60)
}

/**
 * @param {{ massageCapacityMinutes?: number | null, durationMinutes?: number | null, countsTowardMassageCapacity?: boolean | null }} selection
 */
function selectionCapacityMinutes(selection) {
  if (selection.countsTowardMassageCapacity === false) return 0
  return integerInRange(selection.massageCapacityMinutes ?? selection.durationMinutes, 0, 0, 24 * 60)
}

/**
 * @param {{ eligibleProviderIds?: string[] }} selection
 * @param {string} providerUserId
 */
function providerEligible(selection, providerUserId) {
  return !selection.eligibleProviderIds?.length || selection.eligibleProviderIds.includes(providerUserId)
}

/**
 * @param {{
 *   practiceId: string
 *   timeZone?: string
 *   pressureLevel: number
 *   policy?: Record<string, unknown> | null
 *   providers: Array<{ userId: string, label?: string, publiclyBookable?: boolean, minRestMinutes?: number | null, dailyAppointmentLimit?: number | null, weeklyAppointmentLimit?: number | null }>
 *   selections: Array<{ serviceVariantId: string, serviceName?: string, serviceVariantName?: string, bookingRole?: string, bookableMinutes?: number, durationMinutes?: number, massageCapacityMinutes?: number, countsTowardMassageCapacity?: boolean, eligibleProviderIds?: string[] }>
 *   slotsByVariantAndProvider: Record<string, Array<{ startsAt: Date | string | number }>>
 *   capacityRules?: Array<{ providerUserId?: string | null, period?: string | null, dayOfWeek?: number | null, pressureLevel?: number | null, maxMinutes?: number | null, active?: boolean | null }>
 *   existingBookings?: Array<{ providerUserId?: string | null, startsAt: Date | string | number, endsAt?: Date | string | number, status?: string | null, requestedPressureLevel?: number | null, massageCapacityMinutes?: number | null }>
 *   preferredProviderId?: string | null
 *   maxOptions?: number
 * }} input
 */
export function buildSequentialBookingOptions({
  practiceId,
  timeZone = "UTC",
  pressureLevel,
  policy: rawPolicy = null,
  providers,
  selections,
  slotsByVariantAndProvider,
  capacityRules = [],
  existingBookings = [],
  preferredProviderId = null,
  maxOptions = 12,
}) {
  const requestedPressureLevel = normalizePressureLevel(pressureLevel)
  if (!requestedPressureLevel || selections.length === 0) return []

  const policy = normalizeBookingPolicy(rawPolicy)
  if (!policy.enabled) return []

  const normalizedProviders = providers
    .map((provider) => normalizeProviderBookingPolicy(provider, { userId: provider.userId, label: provider.label }))
    .filter((provider) => provider.publiclyBookable)
  if (normalizedProviders.length === 0) return []

  const providerById = new Map(normalizedProviders.map((provider) => [provider.providerUserId, provider]))
  const firstSelection = selections[0]
  const firstProviderCandidates = normalizedProviders.filter((provider) => (
    (policy.anyProviderEnabled || Boolean(preferredProviderId)) &&
    providerEligible(firstSelection, provider.providerUserId) &&
    (!preferredProviderId || provider.providerUserId === preferredProviderId)
  ))
  const options = /** @type {SequenceOption[]} */ ([])

  for (const provider of firstProviderCandidates) {
    const firstSlots = slotsByVariantAndProvider[`${firstSelection.serviceVariantId}:${provider.providerUserId}`] ?? []
    for (const slot of firstSlots) {
      const planned = /** @type {SequencePlannedItem[]} */ ([])

      /**
       * @param {number} index
       * @param {Date | string | number} startsAt
       */
      const placeSelection = (index, startsAt) => {
        const selection = selections[index]
        const candidates = normalizedProviders.filter((candidate) => (
          providerEligible(selection, candidate.providerUserId) &&
          (policy.teamSequencingEnabled || candidate.providerUserId === provider.providerUserId)
        ))
        const startIso = iso(startsAt)

        for (const candidate of candidates) {
          const candidateSlots = slotStartSet(slotsByVariantAndProvider[`${selection.serviceVariantId}:${candidate.providerUserId}`] ?? [])
          if (!candidateSlots.has(startIso)) continue

          const duration = selectionBookableMinutes(selection)
          const endsAt = addMinutes(startsAt, duration)
          const massageCapacityMinutes = selectionCapacityMinutes(selection)
          const providerBookings = [...existingBookings, ...planned].filter((booking) => String(booking.providerUserId ?? "") === candidate.providerUserId)
          const candidatePolicy = providerById.get(candidate.providerUserId) ?? candidate

          if (hasRestGapConflict({
            startsAt,
            endsAt,
            minRestMinutes: candidatePolicy.minRestMinutes,
            existingBookings: providerBookings,
          })) {
            continue
          }

          const limitState = providerAppointmentLimitAllows({
            providerUserId: candidate.providerUserId,
            startsAt,
            dailyAppointmentLimit: candidatePolicy.dailyAppointmentLimit ?? policy.dailyAppointmentLimit,
            weeklyAppointmentLimit: candidatePolicy.weeklyAppointmentLimit,
            existingBookings: [...existingBookings, ...planned],
            timeZone,
          })
          if (!limitState.allowed) continue

          const capacityState = capacityAllowsBooking({
            providerUserId: candidate.providerUserId,
            startsAt,
            requestedPressureLevel,
            massageCapacityMinutes,
            capacityRules,
            existingBookings: [...existingBookings, ...planned],
            timeZone,
          })
          if (!capacityState.allowed) continue

          const item = {
            sortOrder: index,
            providerUserId: candidate.providerUserId,
            providerLabel: candidate.displayLabel,
            serviceVariantId: selection.serviceVariantId,
            serviceName: selection.serviceName ?? "Service",
            serviceVariantName: selection.serviceVariantName ?? "Default",
            bookingRole: String(selection.bookingRole ?? (index === 0 ? "PRIMARY" : "ADD_ON")).toUpperCase(),
            startsAt: startIso,
            endsAt: endsAt.toISOString(),
            requestedPressureLevel,
            massageCapacityMinutes,
          }
          planned.push({ ...item, status: bookingStatusForApprovalMode(policy.approvalMode) })

          if (index === selections.length - 1) {
            options.push({
              practiceId,
              timeZone,
              pressureLevel: requestedPressureLevel,
              status: bookingStatusForApprovalMode(policy.approvalMode),
              startsAt: planned[0]?.startsAt ?? item.startsAt,
              endsAt: planned[planned.length - 1]?.endsAt ?? item.endsAt,
              totalMassageCapacityMinutes: planned.reduce((sum, booking) => sum + booking.massageCapacityMinutes, 0),
              items: planned.map((booking) => ({ ...booking })),
            })
          } else {
            placeSelection(index + 1, endsAt)
          }

          planned.pop()
        }
      }

      placeSelection(0, dateValue(slot.startsAt))
    }
  }

  return options
    .sort((a, b) => dateValue(a.startsAt).getTime() - dateValue(b.startsAt).getTime())
    .slice(0, maxOptions)
}
