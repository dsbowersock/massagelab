/**
 * Rejects form posts unless Origin or Referer matches the request URL, or Fetch
 * Metadata explicitly identifies a same-origin navigation. Metadata-free
 * clients must use the JSON API instead of bypassing the browser form guard.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function isTrustedCheckoutFormOrigin(request) {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  if (!origin && !referer) {
    return request.headers.get("sec-fetch-site") === "same-origin"
  }

  let requestOrigin
  try {
    requestOrigin = new URL(request.url).origin
  } catch {
    return false
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
