import type { MembershipPriceValue } from "../lib/account-surface-data"

type Equal<Left, Right> = (
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false
)

type Assert<Condition extends true> = Condition

type RuntimeMembershipPriceValue = {
  membershipLevel: string
  interval: "month" | "year"
  priceId: string | null
  unitAmount: number | null
  currency: string
  displayPrice: string
  displayInterval: string
  isConfigured: boolean
  isLookupAvailable: boolean
  yearlySavings: {
    amount: number
    currency: string
    displayAmount: string
    description: string
    percent: number
  } | null
}

/**
 * Compile-only equality check that keeps the public declaration aligned with
 * the exact price objects produced by lib/membership-pricing.js.
 */
export type MembershipPriceValueMatchesRuntime = Assert<
  Equal<MembershipPriceValue, RuntimeMembershipPriceValue>
>
