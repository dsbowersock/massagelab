// @ts-check

export const US_STATE_OPTIONS = Object.freeze([
  ["alabama", "Alabama"],
  ["alaska", "Alaska"],
  ["arizona", "Arizona"],
  ["arkansas", "Arkansas"],
  ["california", "California"],
  ["colorado", "Colorado"],
  ["connecticut", "Connecticut"],
  ["delaware", "Delaware"],
  ["district-of-columbia", "District of Columbia"],
  ["florida", "Florida"],
  ["georgia", "Georgia"],
  ["hawaii", "Hawaii"],
  ["idaho", "Idaho"],
  ["illinois", "Illinois"],
  ["indiana", "Indiana"],
  ["iowa", "Iowa"],
  ["kansas", "Kansas"],
  ["kentucky", "Kentucky"],
  ["louisiana", "Louisiana"],
  ["maine", "Maine"],
  ["maryland", "Maryland"],
  ["massachusetts", "Massachusetts"],
  ["michigan", "Michigan"],
  ["minnesota", "Minnesota"],
  ["mississippi", "Mississippi"],
  ["missouri", "Missouri"],
  ["montana", "Montana"],
  ["nebraska", "Nebraska"],
  ["nevada", "Nevada"],
  ["new-hampshire", "New Hampshire"],
  ["new-jersey", "New Jersey"],
  ["new-mexico", "New Mexico"],
  ["new-york", "New York"],
  ["north-carolina", "North Carolina"],
  ["north-dakota", "North Dakota"],
  ["ohio", "Ohio"],
  ["oklahoma", "Oklahoma"],
  ["oregon", "Oregon"],
  ["pennsylvania", "Pennsylvania"],
  ["rhode-island", "Rhode Island"],
  ["south-carolina", "South Carolina"],
  ["south-dakota", "South Dakota"],
  ["tennessee", "Tennessee"],
  ["texas", "Texas"],
  ["utah", "Utah"],
  ["vermont", "Vermont"],
  ["virginia", "Virginia"],
  ["washington", "Washington"],
  ["west-virginia", "West Virginia"],
  ["wisconsin", "Wisconsin"],
  ["wyoming", "Wyoming"],
])

export const US_STATE_SLUGS = Object.freeze(US_STATE_OPTIONS.map(([slug]) => slug))

const US_STATE_SLUG_SET = new Set(US_STATE_SLUGS)

/**
 * @param {unknown} value
 */
export function normalizePublicBookingSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
}

/**
 * @param {unknown} value
 */
export function normalizePublicBookingStateSlug(value) {
  const slug = normalizePublicBookingSlug(value)
  return US_STATE_SLUG_SET.has(slug) ? slug : ""
}

/**
 * @param {unknown} stateSlug
 * @param {unknown} bookingSlug
 */
export function brandedPublicBookingPath(stateSlug, bookingSlug) {
  const normalizedState = normalizePublicBookingStateSlug(stateSlug)
  const normalizedSlug = normalizePublicBookingSlug(bookingSlug)
  if (!normalizedState || !normalizedSlug) return ""
  return `/book/${normalizedState}/${normalizedSlug}`
}

/**
 * @param {{ slug?: string | null, publicBookingStateSlug?: string | null, publicBookingSlug?: string | null }} practice
 */
export function legalPublicBookingPath(practice) {
  const slug = normalizePublicBookingSlug(practice?.slug)
  return slug ? `/book/${slug}` : ""
}

/**
 * @param {{ slug?: string | null, publicBookingStateSlug?: string | null, publicBookingSlug?: string | null }} practice
 */
export function publicBookingPathForPractice(practice) {
  return brandedPublicBookingPath(practice?.publicBookingStateSlug, practice?.publicBookingSlug) || legalPublicBookingPath(practice)
}

/**
 * @param {string} baseUrl
 * @param {string} path
 */
export function absolutePublicBookingUrl(baseUrl, path) {
  const origin = String(baseUrl ?? "").replace(/\/+$/g, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${origin}${normalizedPath}`
}
