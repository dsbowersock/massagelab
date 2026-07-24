export const DONATION_PURPOSE = "massagelab_project_support"

export const DONATION_OPTIONS = Object.freeze([
  Object.freeze({
    amountCents: 500,
    label: "$5",
    description: "Small project support",
  }),
  Object.freeze({
    amountCents: 1500,
    label: "$15",
    description: "Support a careful build session",
  }),
  Object.freeze({
    amountCents: 3000,
    label: "$30",
    description: "Support infrastructure costs",
  }),
  Object.freeze({
    amountCents: 7500,
    label: "$75",
    description: "Support compliance groundwork",
  }),
])

/**
 * One-time support uses fixed payment amounts so the billing
 * route never has to trust an arbitrary client-provided amount.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
export function normalizeDonationAmountCents(value) {
  const amount = Number.parseInt(String(value ?? ""), 10)
  return DONATION_OPTIONS.some((option) => option.amountCents === amount) ? amount : null
}

/**
 * @param {unknown} value
 */
export function findDonationOption(value) {
  const amountCents = normalizeDonationAmountCents(value)
  return DONATION_OPTIONS.find((option) => option.amountCents === amountCents) ?? null
}
