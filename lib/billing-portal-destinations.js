/**
 * Stable first-party form values for selecting a Stripe Customer Portal flow.
 * UI submissions and the server-side allowlist share this contract so a label
 * or layout change cannot silently route customers to the wrong experience.
 */
export const BILLING_PORTAL_DESTINATIONS = Object.freeze({
  MANAGE: "manage",
  SUBSCRIPTION_UPDATE: "subscription-update",
})
