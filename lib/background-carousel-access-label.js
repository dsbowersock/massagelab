// @ts-check

/** @type {Readonly<Record<string, string>>} */
const OWNERSHIP_STATUS_LABELS = Object.freeze({
  refund_pending: "Refund pending",
  dispute_suspended: "Dispute suspended",
  refund_revoked: "Refund revoked",
  dispute_revoked: "Dispute revoked",
  retired: "Retired",
})

/** @type {Readonly<Record<string, string>>} */
const ACCESS_STATE_LABELS = Object.freeze({
  free: "Free",
  owned: "Owned",
  "owned-credit": "Owned",
  "owned-purchase": "Owned",
  "included-subscription": "Included with membership",
  "locked-credit-available": "Locked · credit available",
  "locked-no-credit": "Locked · no credit",
  unavailable: "Unavailable",
})

/**
 * Maps the authoritative carousel commerce state to concise visible copy.
 * Inactive ownership status remains more specific than the general state.
 *
 * @param {{state: string, canSelect: boolean, ownershipStatus: string | null}} commerceState
 */
export function backgroundCarouselAccessLabel(commerceState) {
  const ownershipLabel = commerceState.ownershipStatus
    ? OWNERSHIP_STATUS_LABELS[commerceState.ownershipStatus]
    : null
  if (ownershipLabel) return ownershipLabel

  return ACCESS_STATE_LABELS[commerceState.state]
    ?? (commerceState.canSelect ? "Available" : "Locked")
}
