// @ts-check

/**
 * Removes caller-controlled URL details before a route is classified for
 * diagnostics. This helper returns a pathname only and never retains query or
 * fragment content.
 *
 * @param {unknown} value
 */
export function normalizePrivacySafePath(value) {
  if (typeof value !== "string" || !value.trim()) return "/[unknown]"

  const source = value.trim()
  const hashIndex = source.indexOf("#")
  const withoutFragment = hashIndex >= 0 ? source.slice(0, hashIndex) : source
  const queryIndex = withoutFragment.indexOf("?")
  const stripped = queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment

  try {
    if (/^https?:\/\//i.test(stripped)) return new URL(stripped).pathname || "/"
  } catch {
    return "/[unknown]"
  }

  const path = stripped.startsWith("/") ? stripped : `/${stripped}`
  return path.replace(/\/{2,}/g, "/") || "/"
}

/**
 * Maps concrete application routes to the minimum route family needed for
 * operational grouping. Dynamic record, practice, game, and auth details are
 * never returned.
 *
 * @param {unknown} value
 */
export function classifyPrivacySafeRoute(value) {
  const path = normalizePrivacySafePath(value)
  const publicSegments = new Set([
    "about",
    "breathe",
    "legal",
    "pricing",
    "roadmap",
    "support",
    "tools",
  ])

  if (path === "/[unknown]") return { area: "unknown", safePath: path, privacyLevel: "unknown" }
  if (path === "/") return { area: "home", safePath: "/", privacyLevel: "public" }
  if (path.startsWith("/notes")) return { area: "professional-records", safePath: "/notes/[local-first]", privacyLevel: "local-first-phi-capable" }
  if (path.startsWith("/wellness")) return { area: "wellness", safePath: "/wellness/[self-tracking]", privacyLevel: "consumer-health" }
  if (path.startsWith("/book/")) return { area: "booking", safePath: "/book/[practice]", privacyLevel: "scheduling-contact" }
  if (path.startsWith("/calendar")) return { area: "calendar", safePath: "/calendar/[workspace]", privacyLevel: "scheduling-contact" }
  if (/^\/(account|settings|login|register)(\/|$)/.test(path)) return { area: "account-billing", safePath: "/account-or-auth", privacyLevel: "account-private" }
  if (path.startsWith("/api/")) return { area: "api", safePath: "/api/[route]", privacyLevel: "server-route" }
  if (path.startsWith("/admin/anatomy")) return { area: "admin-anatomy", safePath: "/admin/anatomy/[admin]", privacyLevel: "admin-private" }
  if (path.startsWith("/admin")) return { area: "admin", safePath: "/admin/[route]", privacyLevel: "admin-private" }
  if (path.startsWith("/anatomime/play/")) return { area: "anatomime", safePath: "/anatomime/play/[code]", privacyLevel: "public-study" }
  if (path.startsWith("/anatomime")) return { area: "anatomime", safePath: "/anatomime/[game]", privacyLevel: "public-study" }
  if (path.startsWith("/education/flashcards/decks/")) return { area: "education", safePath: "/education/flashcards/decks/[slug]", privacyLevel: "public-study" }
  if (path.startsWith("/education")) return { area: "education", safePath: "/education/[study]", privacyLevel: "public-study" }
  if (path.startsWith("/chimer") || path.startsWith("/clock")) return { area: "timer", safePath: "/timer", privacyLevel: "public-tool" }
  if (path.startsWith("/music") || path.startsWith("/browse")) return { area: "music", safePath: "/music", privacyLevel: "public-tool" }

  const [segment = "unknown"] = path.split("/").filter(Boolean)
  if (!publicSegments.has(segment)) {
    return { area: "public-page", safePath: "/public/[route]", privacyLevel: "public" }
  }
  return {
    area: "public-page",
    safePath: `/${segment}${path === `/${segment}` ? "" : "/[route]"}`,
    privacyLevel: "public",
  }
}
