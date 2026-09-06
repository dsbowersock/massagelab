import { findDonationOption } from "@/lib/donations"
import { normalizePublicRequestId } from "@/lib/public-request-id"

export const DONATION_CHECKOUT_ATTEMPT_STORAGE_KEY = "massagelab-donation-checkout-attempt-v1"
export const DONATION_CHECKOUT_ATTEMPT_MAX_AGE_MS = ((23 * 60) + 55) * 60 * 1000

export type DonationCheckoutAttempt = {
  attemptId: string
  amountCents: number
  createdAt: number
}

type AttemptClock = { now?: number }

/**
 * Parses the first-party browser replay record without repairing caller data.
 * The 23-hour-55-minute window stays below Stripe's documented 24-hour
 * idempotency-retention floor while bounding first-party browser reuse.
 */
export function readDonationCheckoutAttempt(
  value: string | null | undefined,
  { now = Date.now() }: AttemptClock = {},
): DonationCheckoutAttempt | null {
  if (typeof value !== "string" || !Number.isInteger(now)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  return isCurrentDonationCheckoutAttempt(parsed, now) ? parsed : null
}

/**
 * Reuses only a current same-amount record. Amount changes, expiry, and an
 * explicit fresh-attempt request receive a new canonical UUIDv4.
 */
export function donationCheckoutAttemptForAmount({
  current,
  amountCents,
  createId,
  forceNew = false,
  now = Date.now(),
}: {
  current: DonationCheckoutAttempt | null
  amountCents: number
  createId: () => string
  forceNew?: boolean
  now?: number
}): DonationCheckoutAttempt {
  if (!Number.isInteger(now) || !isAllowedDonationAmount(amountCents)) {
    throw new Error("A current allowlisted donation amount is required.")
  }

  if (
    !forceNew
    && current
    && current.amountCents === amountCents
    && isCurrentDonationCheckoutAttempt(current, now)
  ) {
    return current
  }

  const attemptId = normalizePublicRequestId(createId())
  if (!attemptId) throw new Error("A canonical donation Checkout attempt ID is required.")

  return { attemptId, amountCents, createdAt: now }
}

/** Returns the non-identifying Stripe key for one canonical browser attempt. */
export function donationCheckoutIdempotencyKey(attemptId: unknown): string {
  const normalized = normalizePublicRequestId(attemptId)
  if (!normalized) throw new Error("A canonical donation Checkout attempt ID is required.")
  return `massagelab-donation-v1:${normalized}`
}

/** Terminal and conflicting return codes cannot safely retain a browser attempt. */
export function shouldClearDonationCheckoutAttempt(code: string | undefined): boolean {
  return code === "thanks"
    || code === "cancelled"
    || code === "invalid-amount"
    || code === "invalid-request"
    || code === "conflict"
}

function isCurrentDonationCheckoutAttempt(
  value: unknown,
  now: number,
): value is DonationCheckoutAttempt {
  if (!isRecord(value)) return false
  const keys = Object.keys(value).sort()
  if (keys.join(",") !== "amountCents,attemptId,createdAt") return false
  if (!normalizePublicRequestId(value.attemptId)) return false
  if (!isAllowedDonationAmount(value.amountCents)) return false
  const createdAt = value.createdAt
  if (typeof createdAt !== "number" || !Number.isInteger(createdAt)) return false
  return createdAt <= now && now - createdAt < DONATION_CHECKOUT_ATTEMPT_MAX_AGE_MS
}

function isAllowedDonationAmount(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && findDonationOption(value)?.amountCents === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
