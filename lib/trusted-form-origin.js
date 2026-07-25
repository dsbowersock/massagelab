/**
 * Detects browser form payloads without consuming the request body so checkout
 * handlers can apply origin policy before parsing.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function isBrowserFormRequest(request) {
  const contentType = request.headers.get("content-type") ?? ""
  return contentType.includes("application/x-www-form-urlencoded")
    || contentType.includes("multipart/form-data")
}

/**
 * Rejects browser checkout requests unless Origin or Referer matches the
 * configured public origin, or Fetch Metadata explicitly identifies a
 * same-origin request.
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

  if (!origin && !referer) {
    const fetchSite = request.headers.get("sec-fetch-site")
    if (fetchSite) {
      return fetchSite === "same-origin"
    }
    return !isBrowserFormRequest(request)
  }

  if (origin) {
    try {
      return new URL(origin).origin === requestOrigin
    } catch {
      return false
    }
  }

  try {
    return new URL(referer).origin === requestOrigin
  } catch {
    return false
  }
}
