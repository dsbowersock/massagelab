/**
 * Detects browser form payloads without consuming the request body so checkout
 * handlers can apply origin policy before parsing.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function isBrowserFormRequest(request) {
  // MIME types are case-insensitive; normalize before matching known form types.
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase()
  return contentType.includes("application/x-www-form-urlencoded")
    || contentType.includes("multipart/form-data")
}

/**
 * Rejects browser checkout requests unless Origin or Referer matches the
 * configured public origin or its explicit MassageLab apex/`www` alias.
 * Contradictory Origin, Referer, or supplied Fetch Metadata fails closed.
 * Metadata-free JSON remains available to non-browser API clients, while forms
 * without Origin or Referer require exact same-origin Fetch Metadata and an
 * allowlisted request URL origin.
 *
 * @param {Request} request
 * @param {string} expectedOrigin Canonical public site URL supplied by the caller.
 * @returns {boolean}
 */
export function isTrustedCheckoutFormOrigin(request, expectedOrigin) {
  const allowedOrigins = configuredCheckoutOrigins(expectedOrigin)
  if (allowedOrigins.size === 0) return false

  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  const fetchSite = request.headers.get("sec-fetch-site")

  // Browser Fetch Metadata must agree with any explicit origin evidence.
  if (fetchSite && fetchSite !== "same-origin") return false

  if (!origin && !referer) {
    if (fetchSite) {
      return allowedOrigins.has(requestUrlOrigin(request))
    }
    return isMetadataFreeJsonRequest(request)
  }

  /** @type {string[]} */
  const evidenceOrigins = []
  try {
    if (origin) {
      const parsedOrigin = new URL(origin)
      if (origin !== parsedOrigin.origin) return false
      evidenceOrigins.push(parsedOrigin.origin)
    }
    if (referer) evidenceOrigins.push(new URL(referer).origin)
  } catch {
    return false
  }

  if (new Set(evidenceOrigins).size !== 1) return false
  const [evidenceOrigin] = evidenceOrigins
  return allowedOrigins.has(evidenceOrigin)
}

/**
 * Allows non-browser API clients without browser origin metadata only when
 * they explicitly send the JSON media type supported by both Checkout routes.
 *
 * @param {{ headers: Headers }} request
 * @returns {boolean}
 */
function isMetadataFreeJsonRequest(request) {
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase()
  return mediaType === "application/json"
}

/**
 * Expands only MassageLab's two public host aliases from the server-configured
 * canonical URL. The request URL never contributes a new trusted host.
 *
 * @param {string} expectedOrigin
 * @returns {Set<string>}
 */
function configuredCheckoutOrigins(expectedOrigin) {
  let configuredUrl
  try {
    configuredUrl = new URL(expectedOrigin ?? "")
  } catch {
    return new Set()
  }
  if (configuredUrl.protocol !== "http:" && configuredUrl.protocol !== "https:") {
    return new Set()
  }

  const origins = new Set([configuredUrl.origin])
  const hostname = configuredUrl.hostname.toLowerCase()
  if (hostname === "massagelab.app" || hostname === "www.massagelab.app") {
    const aliasUrl = new URL(configuredUrl.origin)
    aliasUrl.hostname = hostname === "massagelab.app"
      ? "www.massagelab.app"
      : "massagelab.app"
    origins.add(aliasUrl.origin)
  }
  return origins
}

/**
 * @param {{ url?: string }} request
 * @returns {string}
 */
function requestUrlOrigin(request) {
  try {
    return new URL(request.url ?? "").origin
  } catch {
    return ""
  }
}
