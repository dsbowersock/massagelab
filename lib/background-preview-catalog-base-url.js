/**
 * Normalizes the HTTPS custom-domain base shared by catalog publication and
 * runtime delivery. Paths and explicit HTTPS ports remain valid because the
 * published release base may include either; unsafe host and URL forms fail
 * closed with null.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizePublishedPreviewCustomDomainBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null

  let parsed
  try {
    parsed = new URL(value.trim().replace(/\/+$/, ""))
  } catch {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  if (parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || parsed.hostname.endsWith(".")
    || !hostname.includes(".")
    || hostname.endsWith(".localhost")
    || hostname === "r2.dev"
    || hostname.endsWith(".r2.dev")
    || isIpHostname(hostname)) {
    return null
  }

  const pathname = parsed.pathname.replace(/\/+$/, "")
  return `${parsed.origin}${pathname}`
}

/** Rejects IPv4-like hosts after URL canonicalization and all IPv6 literals. */
function isIpHostname(hostname) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")
}
