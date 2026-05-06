// @ts-check

/**
 * @param {unknown} value
 */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {}
}

/**
 * @param {unknown} profile
 */
export function googleProfileEmail(profile) {
  const record = asRecord(profile)
  return typeof record.email === "string" ? record.email.trim().toLowerCase() : ""
}

/**
 * @param {unknown} profile
 */
export function isVerifiedGoogleProfile(profile) {
  const record = asRecord(profile)
  return Boolean(googleProfileEmail(profile) && record.email_verified === true)
}

/**
 * @param {{
 *   provider: string,
 *   hasPasswordCredential: boolean,
 *   emailVerified: boolean,
 * }} input
 */
export function canUnlinkOAuthAccount(input) {
  return input.provider === "google" && input.hasPasswordCredential && input.emailVerified
}
