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
 * configured public origin. A browser-reported same-origin request may also
 * use the origin of the actual request URL, which keeps canonical aliases such
 * as the apex and `www` hosts usable without trusting cross-site submissions.
 * Metadata-free JSON remains available to non-browser API clients, while forms
 * without Origin or Referer require exact same-origin Fetch Metadata.
 *
 * @param {Request} request
 * @param {string} expectedOrigin Canonical public site URL supplied by the caller.
 * @returns {boolean}
 */
export function isTrustedCheckoutFormOrigin(request, expectedOrigin) {
  let requestOrigin
  try {
    requestOrigin = new URL(expectedOrigin ?? "").origin
  } catch {
    return false
  }

  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  const fetchSite = request.headers.get("sec-fetch-site")

  if (!origin && !referer) {
    if (fetchSite) {
      return fetchSite === "same-origin"
    }
    return !isBrowserFormRequest(request)
  }

  let evidenceOrigin
  try {
    evidenceOrigin = new URL(origin || referer).origin
  } catch {
    return false
  }

  if (evidenceOrigin === requestOrigin) return true
  if (fetchSite !== "same-origin") return false

  try {
    return evidenceOrigin === new URL(request.url).origin
  } catch {
    return false
  }
}
