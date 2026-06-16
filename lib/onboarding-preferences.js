// @ts-check

export const ONBOARDING_VERSION = 1

export const onboardingRoleOptions = Object.freeze([
  {
    id: "therapist",
    label: "Therapist",
    description: "Set up practice tools, credentials, documentation defaults, and booking shortcuts.",
    recommendedPath: "/account?tab=credentials",
  },
  {
    id: "student",
    label: "Student",
    description: "Prioritize anatomy study, flashcards, and classroom-friendly learning games.",
    recommendedPath: "/education/flashcards",
  },
  {
    id: "educator",
    label: "Educator",
    description: "Keep teaching tools, public decks, and shared Anatomime sessions close at hand.",
    recommendedPath: "/anatomime",
  },
  {
    id: "client",
    label: "Client",
    description: "Focus on booking, wellness education, and account defaults without professional record tools.",
    recommendedPath: "/calendar",
  },
  {
    id: "public_wellness",
    label: "Health and wellness",
    description: "Explore anatomy, self-study, timers, and practical wellness tools at your own pace.",
    recommendedPath: "/education",
  },
])

export const onboardingUseCaseOptions = Object.freeze([
  { id: "learn_anatomy", label: "Learn anatomy" },
  { id: "teach_anatomy", label: "Teach anatomy" },
  { id: "run_sessions", label: "Run sessions" },
  { id: "manage_practice", label: "Manage a practice" },
  { id: "book_care", label: "Book or plan care" },
  { id: "track_progress", label: "Track learning progress" },
])

const roleIds = new Set(onboardingRoleOptions.map((option) => option.id))
const useCaseIds = new Set(onboardingUseCaseOptions.map((option) => option.id))

/**
 * Normalizes a value into a JSON object record.
 *
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function objectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {}
}

/**
 * Builds a safe, non-PHI onboarding payload for UserPreference.appSettings.
 * The payload describes how to arrange account/home shortcuts; it does not
 * grant verified roles, store clinical content, or replace credential review.
 *
 * @param {FormData | Record<string, unknown>} input
 */
export function buildOnboardingPreference(input) {
  const role = readSingleValue(input, "primaryRole")
  const useCases = readArrayValue(input, "useCases")
  const jurisdiction = readSingleValue(input, "jurisdiction").toUpperCase()
  const selectedRole = roleIds.has(role) ? role : "public_wellness"

  return {
    version: ONBOARDING_VERSION,
    completedAt: new Date().toISOString(),
    primaryRole: selectedRole,
    useCases: useCases.filter((value) => useCaseIds.has(value)).slice(0, 6),
    jurisdiction: selectedRole === "therapist" ? jurisdiction.slice(0, 2) : "",
    recommendedPath: getOnboardingRecommendedPath(selectedRole),
  }
}

/**
 * @param {string} roleId
 */
export function getOnboardingRecommendedPath(roleId) {
  return onboardingRoleOptions.find((option) => option.id === roleId)?.recommendedPath ?? "/account"
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 */
function readSingleValue(input, key) {
  const value = input instanceof FormData ? input.get(key) : input[key]
  return typeof value === "string" ? value.trim() : ""
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 */
function readArrayValue(input, key) {
  if (input instanceof FormData) {
    return input.getAll(key).filter((value) => typeof value === "string").map((value) => value.trim())
  }

  const value = input[key]
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").map((item) => item.trim())
  }

  return typeof value === "string" ? [value.trim()] : []
}
