/**
 * Rejects browser form posts that identify another origin before state can be
 * mutated. Requests without browser origin metadata remain compatible with
 * non-browser clients, while Fetch Metadata and Referer provide fallbacks.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function isTrustedCheckoutFormOrigin(request) {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  if (!origin && !referer) {
    return request.headers.get("sec-fetch-site") !== "cross-site"
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
