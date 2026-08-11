import type { StripeGoodwillClient } from "./billing-goodwill.ts"
import { hasBrowserAdminFixtureQaAuthorization } from "./browser-qa-authorization.ts"
import { browserAdminFixtureProjectSlug } from "./browser-fixture-identity.ts"

/**
 * Returns a synthetic read-only Stripe client only for the exact disposable
 * target identity under the explicit non-production browser-QA database gate.
 * The target ID and environment are validated before any adapter is returned;
 * outside that gate the result is null. Every mutation or transaction-readback
 * method throws so presentation coverage cannot create or verify a real credit.
 */
export function browserBillingGoodwillPreviewClient(
  targetUserId: string,
  environment: Record<string, string | undefined> = process.env,
): StripeGoodwillClient | null {
  if (!isBrowserBillingGoodwillMutationBlocked(targetUserId, environment)) return null
  const suffix = targetUserId.replace("browser-admin-target-", "")
  const projectSlug = browserAdminFixtureProjectSlug(suffix)
  const customerId = `cus_browser${projectSlug}`
  const subscriptionId = `sub_browser${projectSlug}`
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
