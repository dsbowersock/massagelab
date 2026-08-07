const LOCAL_PUBLISHED_PREVIEW_CATALOG_BASE_URL = "/chimer/background-preview-catalog"
const ASPECTS = Object.freeze(["landscape", "square", "vertical"])
const QUALITIES = Object.freeze(["low", "standard", "high"])
const CODECS = Object.freeze(["vp9", "h264"])

/** The build-time public catalog configuration consumed by carousel callers. */
export const publishedPreviewCatalogBaseUrl = resolvePublishedPreviewCatalogBaseUrl({
  configuredBaseUrl: process.env.NEXT_PUBLIC_CHIMER_PREVIEW_CATALOG_BASE_URL,
  nodeEnv: process.env.NODE_ENV,
})

/**
 * Resolves the configured catalog release only through an HTTPS custom domain.
 * Production deliberately has no local/default base, preserving the v1
 * fallback until hosted catalog verification and configuration are complete.
 */
export function resolvePublishedPreviewCatalogBaseUrl({ configuredBaseUrl, nodeEnv } = {}) {
  const normalizedConfiguredBase = normalizePublishedPreviewCatalogBaseUrl(configuredBaseUrl)
  if (normalizedConfiguredBase) {
    if (normalizedConfiguredBase === LOCAL_PUBLISHED_PREVIEW_CATALOG_BASE_URL) {
      return nodeEnv === "production" ? null : normalizedConfiguredBase
    }
    return normalizedConfiguredBase
  }
  return nodeEnv === "production" ? null : LOCAL_PUBLISHED_PREVIEW_CATALOG_BASE_URL
}

/** Save-Data and constrained connections select one lower-cost initial tier. */
export function qualityForPreviewConnection(connection) {
  if (connection?.saveData) return "low"
  if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return "low"
  if (connection?.effectiveType === "4g") return "high"
  return "standard"
}

/**
 * Chooses one codec for an exact aspect/quality target. MIME support cannot be
 * inferred from another tier because H.264 profile/level declarations vary
 * across the ladder. VP9 wins when the exact candidate is supported.
 */
export function chooseSupportedPreviewCodec({
  renditions,
  aspect,
  quality,
  canPlayType,
} = {}) {
  if (!Array.isArray(renditions)
    || !ASPECTS.includes(aspect)
    || !QUALITIES.includes(quality)
    || typeof canPlayType !== "function") return null
  const candidates = renditions.filter((rendition) =>
    rendition?.aspect === aspect && rendition?.quality === quality)
  for (const codec of CODECS) {
    const matches = candidates.filter((candidate) => candidate?.codec === codec)
    if (matches.length !== 1 || typeof matches[0].mimeType !== "string") continue
    try {
      const support = canPlayType(matches[0].mimeType)
      if (support === "probably" || support === "maybe") return codec
    } catch {
      // One malformed/throwing MIME probe must not suppress the other codec.
    }
  }
  return null
}

/** Returns the one vertical poster URL, or null when the catalog base is unavailable. */
export function getVerticalPublishedPreviewPosterUrl(entry, catalogBaseUrl) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null
  return resolvePublishedPreviewMediaUrl(entry.posters?.vertical, catalogBaseUrl)
}

/**
 * Selects exactly one aspect/quality/codec rendition. The returned value has a
 * single URL and intentionally carries no alternate aspects, tiers, or codecs.
 */
export function selectPublishedPreviewRendition({
  entry,
  aspect,
  quality,
  codec,
  catalogBaseUrl,
} = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) || entry.mediaKind !== "animated") return null
  if (!ASPECTS.includes(aspect) || !QUALITIES.includes(quality) || !CODECS.includes(codec)) return null
  if (!Array.isArray(entry.renditions)) return null

  const matches = entry.renditions.filter((rendition) =>
    rendition?.aspect === aspect
      && rendition?.quality === quality
      && rendition?.codec === codec)
  if (matches.length !== 1) return null

  const rendition = matches[0]
  const url = resolvePublishedPreviewMediaUrl(rendition.url, catalogBaseUrl)
  if (!url || typeof rendition.mimeType !== "string") return null
  return {
    aspect,
    quality,
    codec,
    url,
    mimeType: rendition.mimeType,
  }
}

/**
 * Resolves a pending tier only within the active aspect and codec. Callers can
 * apply this one result on `ended`; null means restart/fall back without ever
 * preloading a second rendition.
 */
export function resolvePendingPreviewRendition({
  entry,
  currentRendition,
  pendingQuality,
  catalogBaseUrl,
} = {}) {
  if (!currentRendition || typeof currentRendition !== "object" || Array.isArray(currentRendition)) return null
  return selectPublishedPreviewRendition({
    entry,
    aspect: currentRendition.aspect,
    quality: pendingQuality,
    codec: currentRendition.codec,
    catalogBaseUrl,
  })
}

/** @param {unknown} value */
function normalizePublishedPreviewCatalogBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null
  const trimmed = value.trim().replace(/\/+$/, "")
  if (trimmed === LOCAL_PUBLISHED_PREVIEW_CATALOG_BASE_URL) return trimmed

  let parsed
  try {
    parsed = new URL(trimmed)
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
    || hostname === "r2.dev"
    || hostname.endsWith(".r2.dev")
    || isIpHostname(hostname)) {
    return null
  }
  const pathname = parsed.pathname.replace(/\/+$/, "")
  return `${parsed.origin}${pathname}`
}

function isIpHostname(hostname) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")
}

function resolvePublishedPreviewMediaUrl(relativeUrl, catalogBaseUrl) {
  const normalizedBase = normalizePublishedPreviewCatalogBaseUrl(catalogBaseUrl)
  if (!normalizedBase || typeof relativeUrl !== "string" || !relativeUrl) return null
  if (relativeUrl.includes("\\")
    || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(relativeUrl)
    || relativeUrl.includes("?")
    || relativeUrl.includes("#")) {
    return null
  }
  const parts = relativeUrl.split("/")
  if (parts.some((part) => !part || part === "." || part === "..")) return null
  for (const part of parts) {
    let decodedPart
    try {
      decodedPart = decodeURIComponent(part)
    } catch {
      return null
    }
    if (decodedPart === "." || decodedPart === ".." || decodedPart.includes("/") || decodedPart.includes("\\")) {
      return null
    }
  }
  return `${normalizedBase}/${relativeUrl}`
}
