/**
 * @typedef {{ id: string, label: string }} ProviderPreference
 */

/**
 * @typedef {{
 *   startsAt: string
 *   endsAt?: string
 *   status?: string
 *   items?: unknown[]
 * }} SequenceOption
 */

/**
 * @param {ProviderPreference[]} providers
 */
export function providerPreferenceModel(providers) {
  const providerList = Array.isArray(providers) ? providers : []
  const namedProviders = providerList.filter((provider) => provider.id)
  const anyProvider = providerList.find((provider) => !provider.id)

  return {
    namedProviders,
    shouldShowProviderPreference: namedProviders.length > 1,
    defaultProviderId: anyProvider ? "" : (namedProviders[0]?.id ?? ""),
  }
}

/**
 * @param {string | Date} value
 * @param {string} timeZone
 */
export function practiceLocalDateKey(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const partByType = new Map(parts.map((part) => [part.type, part.value]))

  return `${partByType.get("year")}-${partByType.get("month")}-${partByType.get("day")}`
}

/**
 * @param {SequenceOption} option
 */
export function sequenceOptionKey(option) {
  return `${option.startsAt}-${(option.items ?? []).map((item) => (
    item && typeof item === "object" && "providerUserId" in item
      ? /** @type {{ providerUserId?: unknown }} */ (item).providerUserId
      : ""
  )).join("-")}`
}

/**
 * @param {SequenceOption[]} options
 * @param {string} timeZone
 */
export function groupSequenceOptionsByLocalDate(options, timeZone) {
  const groupsByDate = new Map()
  const sortedOptions = [...(Array.isArray(options) ? options : [])].sort((a, b) => (
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  ))

  for (const option of sortedOptions) {
    const dateKey = practiceLocalDateKey(option.startsAt, timeZone)
    const group = groupsByDate.get(dateKey) ?? { dateKey, date: new Date(`${dateKey}T12:00:00.000Z`), options: [] }
    group.options.push(option)
    groupsByDate.set(dateKey, group)
  }

  return [...groupsByDate.values()]
}
