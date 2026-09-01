import "server-only"

import {
  normalizePublicBookingSequenceDescriptor,
  type PublicBookingSequenceDescriptor,
  type PublicBookingSequenceItem,
  type PublicBookingSequenceOption,
} from "./public-booking-sequences.js"

export type PublicAvailabilityCacheValue = {
  options: readonly PublicBookingSequenceOption[]
  storedAt: number
}

const FRESH_TTL_MS = 20_000
const OUTAGE_STALE_MAX_AGE_MS = 60_000
const MAX_ENTRIES = 250
const entries = new Map<string, PublicAvailabilityCacheValue>()

function cleanRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const cleaned = value.trim()
  return cleaned ? cleaned : null
}

function cloneItem(value: unknown): Readonly<PublicBookingSequenceItem> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const providerUserId = cleanRequiredString(item.providerUserId)
  const providerLabel = cleanRequiredString(item.providerLabel)
  const serviceVariantId = cleanRequiredString(item.serviceVariantId)
  const serviceName = cleanRequiredString(item.serviceName)
  const serviceVariantName = cleanRequiredString(item.serviceVariantName)
  const startsAt = cleanRequiredString(item.startsAt)
  const endsAt = cleanRequiredString(item.endsAt)
  if (
    !Number.isInteger(item.sortOrder)
    || !providerUserId
    || !providerLabel
    || !serviceVariantId
    || !serviceName
    || !serviceVariantName
    || !startsAt
    || !endsAt
    || typeof item.massageCapacityMinutes !== "number"
    || !Number.isFinite(item.massageCapacityMinutes)
    || item.massageCapacityMinutes < 0
  ) {
    return null
  }

  return Object.freeze({
    sortOrder: item.sortOrder as number,
    providerUserId,
    providerLabel,
    serviceVariantId,
    serviceName,
    serviceVariantName,
    startsAt,
    endsAt,
    massageCapacityMinutes: item.massageCapacityMinutes,
  })
}

function cloneOption(value: unknown): Readonly<PublicBookingSequenceOption> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const option = value as Record<string, unknown>
  const startsAt = cleanRequiredString(option.startsAt)
  const endsAt = cleanRequiredString(option.endsAt)
  const status = cleanRequiredString(option.status)
  if (
    !startsAt
    || !endsAt
    || !status
    || typeof option.totalMassageCapacityMinutes !== "number"
    || !Number.isFinite(option.totalMassageCapacityMinutes)
    || option.totalMassageCapacityMinutes < 0
    || !Array.isArray(option.items)
  ) {
    return null
  }

  const items = option.items.map(cloneItem)
  if (items.some((item) => item === null)) return null

  return Object.freeze({
    startsAt,
    endsAt,
    status,
    totalMassageCapacityMinutes: option.totalMassageCapacityMinutes,
    items: Object.freeze(items as Readonly<PublicBookingSequenceItem>[]),
  }) as Readonly<PublicBookingSequenceOption>
}

/**
 * Builds a privacy-reduced key for final public availability projections. The
 * account mode separates guest and signed-in behavior without retaining an
 * account, cookie, email address, or other caller identity.
 */
export function publicAvailabilityCacheKey(input: {
  practiceId: string
  accountMode: "guest" | "signed-in"
  descriptor: PublicBookingSequenceDescriptor
  maxOptions: number
}): string {
  const practiceId = cleanRequiredString(input.practiceId)
  if (!practiceId) throw new Error("A practice is required for the public availability cache.")
  if (input.accountMode !== "guest" && input.accountMode !== "signed-in") {
    throw new Error("A supported account mode is required for the public availability cache.")
  }
  if (!Number.isInteger(input.maxOptions) || input.maxOptions <= 0) {
    throw new Error("A positive integer option limit is required for the public availability cache.")
  }

  const descriptor = normalizePublicBookingSequenceDescriptor(input.descriptor)
  return JSON.stringify({
    version: 1,
    practiceId,
    accountMode: input.accountMode,
    descriptor,
    maxOptions: input.maxOptions,
  })
}

/**
 * Reads a copied, immutable final projection. Normal reads stop at 20 seconds;
 * outage fallback may opt into the same value through exactly 60 seconds.
 */
export function readPublicAvailabilityCache(
  key: string,
  input: { now?: number; allowStale?: boolean } = {},
): readonly PublicBookingSequenceOption[] | null {
  const now = input.now ?? Date.now()
  if (typeof key !== "string" || !key || !Number.isFinite(now)) return null
  const entry = entries.get(key)
  if (!entry) return null

  const age = now - entry.storedAt
  if (age < 0 || age > OUTAGE_STALE_MAX_AGE_MS) {
    entries.delete(key)
    return null
  }
  if (!input.allowStale && age >= FRESH_TTL_MS) return null
  return entry.options
}

/** Stores only a structurally complete, immutable copy of the public result. */
export function writePublicAvailabilityCache(
  key: string,
  options: readonly PublicBookingSequenceOption[],
  input: { now?: number } = {},
): void {
  const now = input.now ?? Date.now()
  if (typeof key !== "string" || !key || !Number.isFinite(now)) {
    throw new Error("A valid public availability cache key and time are required.")
  }
  if (!Array.isArray(options)) {
    throw new Error("A complete public availability projection is required.")
  }

  const clonedOptions = options.map(cloneOption)
  if (clonedOptions.some((option) => option === null)) {
    throw new Error("A complete public availability projection is required.")
  }
  const frozenOptions = Object.freeze(
    clonedOptions as Readonly<PublicBookingSequenceOption>[],
  )

  entries.delete(key)
  entries.set(key, { options: frozenOptions, storedAt: now })
  while (entries.size > MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value
    if (typeof oldestKey !== "string") break
    entries.delete(oldestKey)
  }
}
