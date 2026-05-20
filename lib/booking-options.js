// @ts-check

/**
 * @param {Date | string | number} value
 */
function dateValue(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

/**
 * @param {Date} value
 * @param {string} timeZone
 */
function localDateKey(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const part = Object.fromEntries(parts.map((item) => [item.type, item.value]))
  return `${part.year}-${part.month}-${part.day}`
}

/**
 * @param {Date} value
 * @param {string} timeZone
 */
function dayLabel(value, timeZone) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(value)
}

/**
 * @param {Date} value
 * @param {string} timeZone
 */
function timeLabel(value, timeZone) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

/**
 * @param {Array<{ startsAt: Date | string | number }>} slots
 * @param {string} timeZone
 * @returns {Array<{ date: string, label: string, slots: Array<{ startsAt: string, label: string }> }>}
 */
export function groupBookingSlotsByDay(slots, timeZone = "America/New_York") {
  const days = new Map()
  const normalizedSlots = slots
    .map((slot) => dateValue(slot.startsAt))
    .filter(Boolean)
    .sort((a, b) => /** @type {Date} */ (a).getTime() - /** @type {Date} */ (b).getTime())

  for (const slot of normalizedSlots) {
    const date = /** @type {Date} */ (slot)
    const key = localDateKey(date, timeZone)
    if (!days.has(key)) {
      days.set(key, {
        date: key,
        label: dayLabel(date, timeZone),
        slots: [],
      })
    }

    days.get(key).slots.push({
      startsAt: date.toISOString(),
      label: timeLabel(date, timeZone),
    })
  }

  return [...days.values()]
}

/**
 * @param {{
 *   practiceId: string
 *   timeZone?: string
 *   services: Array<{
 *     id: string
 *     name: string
 *     description?: string | null
 *     eligibleProviderIds?: string[]
 *     variants: Array<{
 *       id: string
 *       name: string
 *       durationMinutes: number
 *       bufferAfterMinutes?: number
 *       priceCents?: number | null
 *       currency?: string | null
 *     }>
 *   }>
 *   providers: Array<{ userId: string, label: string }>
 *   slotsByVariantAndProvider: Record<string, Array<{ startsAt: Date | string | number }>>
 * }} input
 */
export function buildBookingOptionModel({
  practiceId,
  timeZone = "America/New_York",
  services,
  providers,
  slotsByVariantAndProvider,
}) {
  return {
    practiceId,
    timeZone,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description ?? null,
      variants: service.variants.map((variant) => {
        const eligibleProviders = providers.filter((provider) => (
          !service.eligibleProviderIds?.length || service.eligibleProviderIds.includes(provider.userId)
        ))

        return {
          id: variant.id,
          serviceId: service.id,
          serviceName: service.name,
          name: variant.name,
          durationMinutes: variant.durationMinutes,
          bufferAfterMinutes: variant.bufferAfterMinutes ?? 0,
          priceCents: typeof variant.priceCents === "number" && Number.isInteger(variant.priceCents) ? variant.priceCents : null,
          currency: String(variant.currency ?? "USD").toUpperCase(),
          providers: eligibleProviders.map((provider) => ({
            id: provider.userId,
            label: provider.label,
            days: groupBookingSlotsByDay(slotsByVariantAndProvider[`${variant.id}:${provider.userId}`] ?? [], timeZone)
              .map((day) => ({
                ...day,
                slots: day.slots.map((slot) => ({
                  ...slot,
                  request: {
                    practiceId,
                    therapistId: provider.userId,
                    serviceVariantId: variant.id,
                    startsAt: slot.startsAt,
                  },
                })),
              })),
          })),
        }
      }),
    })),
  }
}
