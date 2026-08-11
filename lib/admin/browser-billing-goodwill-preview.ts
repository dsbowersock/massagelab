import type { StripeGoodwillClient } from "./billing-goodwill.ts"
import { hasBrowserAdminFixtureQaAuthorization } from "./browser-qa-authorization.ts"

/**
 * Supplies read-only Stripe-shaped evidence only for deterministic disposable
 * browser identities under the explicit database QA opt-in. Mutation methods
 * throw so presentation coverage can never create a balance transaction.
 */
export function browserBillingGoodwillPreviewClient(
  targetUserId: string,
  environment: Record<string, string | undefined> = process.env,
): StripeGoodwillClient | null {
  if (!isBrowserBillingGoodwillMutationBlocked(targetUserId, environment)) return null
  const suffix = targetUserId.replace("browser-admin-target-", "")
  const customerId = `cus_browser${suffix.replaceAll("-", "")}`
  const subscriptionId = `sub_browser${suffix.replaceAll("-", "")}`
  return {
    customers: {
      retrieve: async () => ({ id: customerId, balance: 0, livemode: false }),
      createBalanceTransaction: async () => { throw new Error("Browser QA must not create Stripe balance transactions.") },
      retrieveBalanceTransaction: async () => { throw new Error("Browser QA must not retrieve mutation evidence.") },
    },
    subscriptions: { retrieve: async () => ({ id: subscriptionId, customer: customerId, status: "active", livemode: false }) },
    invoices: { createPreview: async () => ({ customer: customerId, currency: "usd", amount_due: 2000, livemode: false }) },
  } as unknown as StripeGoodwillClient
}

/** Fails closed only for an exact disposable browser-QA identity and opt-in. */
export function isBrowserBillingGoodwillMutationBlocked(
  targetUserId: string,
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.VERCEL_ENV !== "production"
    && hasBrowserAdminFixtureQaAuthorization(environment)
    && /^browser-admin-target-(?:desktop|mobile)-chromium$/.test(targetUserId)
}
