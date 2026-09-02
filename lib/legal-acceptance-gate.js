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
    /[\u0000-\u001F\u007F]/.test(path) ||
    /%(?![0-9a-fA-F]{2})/.test(path)
  ) {
    return fallback
  }

  try {
    const parsed = new URL(path, "https://massagelab.invalid")
    if (parsed.origin !== "https://massagelab.invalid" || !parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return fallback
    }
    const decodedSegments = parsed.pathname.split("/").map((segment) => {
      const decoded = decodeURIComponent(segment)
      // Encoded separators, delimiters, percent signs, and control characters
      // are ambiguous after another parser or proxy pass, so fail closed.
      if (/[\\/?#%\u0000-\u001F\u007F]/.test(decoded)) {
        throw new URIError("Ambiguous encoded path segment")
      }
      return decoded
    })
    const normalizedPathname = decodedSegments.join("/").toLowerCase()
    if (
      normalizedPathname === "/api"
      || normalizedPathname.startsWith("/api/")
      || normalizedPathname === "/legal"
      || normalizedPathname.startsWith("/legal/")
    ) {
      return fallback
    }
  } catch {
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
    try {
      // Never trust a prebuilt gate wholesale: rebuild it from one sanitized
      // nested destination so duplicate or unrelated parameters are discarded.
      const queryStart = callbackUrl.indexOf("?")
      const params = new URLSearchParams(queryStart >= 0 ? callbackUrl.slice(queryStart + 1) : "")
      return buildRegistrationLegalAcceptancePath(params.get("callbackUrl"))
    } catch {
      return buildRegistrationLegalAcceptancePath(DEFAULT_POST_ACCOUNT_CALLBACK)
    }
  }

  return buildRegistrationLegalAcceptancePath(callbackUrl)
}
