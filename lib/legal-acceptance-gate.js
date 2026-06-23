// @ts-check

export const REGISTRATION_LEGAL_ACCEPTANCE_ROUTE = "/legal/accept"
export const DEFAULT_POST_ACCOUNT_CALLBACK = "/onboarding"

/**
 * Checks whether a callback already points at the registration legal gate.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistrationLegalAcceptancePath(value) {
  if (typeof value !== "string") {
    return false
  }

  return value === REGISTRATION_LEGAL_ACCEPTANCE_ROUTE || value.startsWith(`${REGISTRATION_LEGAL_ACCEPTANCE_ROUTE}?`)
}

/**
 * Normalizes post-acceptance destinations to app-local paths.
 *
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function safePostLegalAcceptanceCallback(value, fallback = DEFAULT_POST_ACCOUNT_CALLBACK) {
  const candidate = Array.isArray(value) ? value[0] : value

  if (typeof candidate !== "string") {
    return fallback
  }

  const path = candidate.trim()

  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.startsWith("/api/") ||
    path.startsWith(REGISTRATION_LEGAL_ACCEPTANCE_ROUTE)
  ) {
    return fallback
  }

  return path
}

/**
 * Builds the signed-in registration Terms/Privacy gate route.
 *
 * @param {unknown} callbackUrl
 * @returns {string}
 */
export function buildRegistrationLegalAcceptancePath(callbackUrl) {
  const params = new URLSearchParams({
    callbackUrl: safePostLegalAcceptanceCallback(callbackUrl),
  })

  return `${REGISTRATION_LEGAL_ACCEPTANCE_ROUTE}?${params.toString()}`
}

/**
 * Routes OAuth providers through the legal gate while preserving nested gate callbacks.
 *
 * @param {unknown} callbackUrl
 * @returns {string}
 */
export function buildRegistrationLegalProviderRedirectPath(callbackUrl) {
  if (typeof callbackUrl === "string" && isRegistrationLegalAcceptancePath(callbackUrl)) {
    return callbackUrl
  }

  return buildRegistrationLegalAcceptancePath(callbackUrl)
}
