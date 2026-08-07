import { normalizePublishedPreviewCustomDomainBaseUrl } from "../../lib/background-preview-catalog-base-url.js"

/**
 * Adapts the shared fail-closed runtime contract to the uploader's actionable
 * configuration error while preserving an absent optional setting.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function normalizeCatalogPublicBaseUrl(value) {
  if (value === undefined || value === null || value === "") return undefined

  const normalized = normalizePublishedPreviewCustomDomainBaseUrl(value)
  if (!normalized) {
    throw new Error(
      "Catalog public base URL must be a valid absolute HTTPS custom-domain URL without a trailing-dot, localhost, IP, or r2.dev host, credentials, query string, or fragment.",
    )
  }
  return normalized
}
