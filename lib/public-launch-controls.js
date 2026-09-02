// @ts-check

export const REGISTRATION_PAUSED_MESSAGE =
  "New account registration is temporarily paused. Existing users can still sign in or recover an account."
export const SUPPORTER_CHECKOUT_PAUSED_MESSAGE =
  "New Supporter checkout is temporarily paused. Existing memberships and the billing portal remain available."

/**
 * Reads only explicit emergency pause flags. Missing or non-exact values keep
 * the existing public paths open, while each switch remains independent.
 * Exact parsing is deliberate: do not trim or case-normalize; non-exact values
 * fail open under the documented launch policy.
 * @param {Record<string, string | undefined>} [env]
 */
export function getPublicLaunchControls(env = process.env) {
  return {
    registrationOpen: env.MASSAGELAB_PUBLIC_REGISTRATION_PAUSED !== "true",
    supporterCheckoutOpen: env.MASSAGELAB_SUPPORTER_CHECKOUT_PAUSED !== "true",
  }
}
