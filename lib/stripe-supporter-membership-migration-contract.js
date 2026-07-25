import { SUPPORTER_MEMBERSHIP_PRICE_CONTRACT } from "./stripe-price-contract.js"

/**
 * Immutable Supporter Price targets shared by migration and catalog-parity
 * tests. This module intentionally contains no CLI startup or Stripe client
 * setup, so importing the contract cannot perform migration work.
 */
export const TARGET_PRICE_SPECS = Object.freeze(
  SUPPORTER_MEMBERSHIP_PRICE_CONTRACT.map(({
    key,
    envKey,
    unitAmount,
    interval,
  }) => Object.freeze({
    key,
    envKey,
    unitAmount,
    interval,
  })),
)
