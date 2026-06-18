// @ts-check

export const ONBOARDING_VERSION = 1

export const HOME_TOOL_MAX_SHORTCUTS = 6

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

/**
 * @typedef {"therapist" | "student" | "educator" | "client" | "public_wellness"} OnboardingRoleId
 * @typedef {"learn_anatomy" | "teach_anatomy" | "run_sessions" | "manage_practice" | "book_care" | "track_progress"} OnboardingUseCaseId
 */

export const homeToolCatalog = Object.freeze([
  {
    key: "chimer",
    title: "Chimer",
    description: "Treatment-room timer, interval pacing, and clock mode.",
    href: "/chimer",
    action: "Open Chimer",
    icon: "Timer",
    status: "Public",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["run_sessions", "track_progress"],
  },
  {
    key: "atmosphere",
    title: "Atmosphere",
    description: "Generative wellness audio stations with a route-persistent player.",
    href: "/wellness/atmosphere",
    action: "Open Atmosphere",
    icon: "Radio",
    status: "Public audio",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["run_sessions", "track_progress", "book_care"],
  },
  {
    key: "education_flashcards",
    title: "Education flashcards",
    description: "Sourced anatomy study with public decks and signed-in progress.",
    href: "/education/flashcards",
    action: "Study flashcards",
    icon: "BookOpen",
    status: "Public + signed-in progress",
    roleSignals: ["therapist", "student", "educator", "public_wellness", "client"],
    useCaseSignals: ["learn_anatomy", "track_progress", "teach_anatomy"],
  },
  {
    key: "anatomime",
    title: "Anatomime",
    description: "Solo and shared classroom anatomy play with room codes.",
    href: "/anatomime",
    action: "Play Anatomime",
    icon: "Brain",
    status: "Public",
    roleSignals: ["therapist", "student", "educator", "public_wellness", "client"],
    useCaseSignals: ["learn_anatomy", "teach_anatomy", "run_sessions"],
  },
  {
    key: "local_notes",
    title: "Local-first notes",
    description: "Create SOAP, intake, journal, and ROM records in an encrypted browser vault.",
    href: "/notes",
    action: "Open notes",
    icon: "ClipboardList",
    status: "Membership + local-first",
    roleSignals: ["therapist", "client", "public_wellness", "student", "educator"],
    useCaseSignals: ["book_care", "run_sessions"],
  },
  {
    key: "calendar_booking",
    title: "Calendar and booking",
    description: "Scheduling, availability, booking settings, public links, waitlist, and capacity controls.",
    href: "/calendar",
    action: "Open calendar",
    icon: "CalendarDays",
    status: "Signed-in",
    roleSignals: ["therapist", "client", "public_wellness", "student", "educator"],
    useCaseSignals: ["manage_practice", "book_care"],
  },
  {
    key: "account_memberships",
    title: "Account and memberships",
    description: "Save progress, remember settings, manage profile defaults, and review paid features.",
    href: "/account",
    action: "Open account",
    icon: "UserRound",
    status: "Signed-in",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["manage_practice", "track_progress"],
  },
  {
    key: "roadmap_support",
    title: "Roadmap and support",
    description: "See what is planned, what is available, and how memberships help fund the work.",
    href: "/roadmap",
    action: "Open roadmap",
    icon: "Compass",
    status: "Public",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["learn_anatomy", "teach_anatomy", "track_progress"],
  },
])

const roleIds = new Set(onboardingRoleOptions.map((option) => option.id))
const useCaseIds = new Set(onboardingUseCaseOptions.map((option) => option.id))
const homeToolKeys = new Set(homeToolCatalog.map((tool) => tool.key))

// Ordered defaults are fallback homepage shortcuts when the user has not made
// explicit picks. Keep high-frequency session tools early for each role while
// preserving local-first and signed-in-only surfaces as contextual follow-ups.
const defaultHomeToolsByRole = {
  therapist: ["local_notes", "calendar_booking", "chimer", "atmosphere", "anatomime", "education_flashcards"],
  student: ["education_flashcards", "anatomime", "chimer", "atmosphere", "account_memberships", "calendar_booking"],
  educator: ["anatomime", "education_flashcards", "chimer", "atmosphere", "account_memberships", "calendar_booking"],
  client: ["calendar_booking", "chimer", "atmosphere", "education_flashcards", "local_notes", "account_memberships"],
  public_wellness: ["atmosphere", "chimer", "education_flashcards", "anatomime", "calendar_booking", "local_notes"],
}

// Use-case signals are promotion rules merged before role defaults so a user's
// stated intent can lift relevant tools without granting access or changing
// the underlying feature/entitlement checks.
const roleHintSignalByUseCase = {
  learn_anatomy: ["education_flashcards", "anatomime"],
  teach_anatomy: ["anatomime", "education_flashcards"],
  run_sessions: ["chimer", "atmosphere", "anatomime"],
  manage_practice: ["calendar_booking", "account_memberships"],
  book_care: ["calendar_booking", "local_notes"],
  track_progress: ["education_flashcards", "chimer", "atmosphere"],
}

/**
 * @param {Iterable<string>} values
 * @returns {string[]}
 */
function toUniqueOrderedToolKeys(values) {
  const selected = []
  const seen = new Set()
  for (const key of values) {
    if (homeToolKeys.has(key) && !seen.has(key)) {
      seen.add(key)
      selected.push(key)
    }
  }
  return selected.slice(0, HOME_TOOL_MAX_SHORTCUTS)
}

/**
 * @param {OnboardingRoleId} roleId
 * @param {OnboardingUseCaseId[]} useCaseIdsFromInput
 * @returns {string[]}
 */
function roleAwareToolDefaults(roleId, useCaseIdsFromInput) {
  const roleDefaults = defaultHomeToolsByRole[roleId] ?? defaultHomeToolsByRole.public_wellness
  const useCaseDefaults = [...useCaseIdsFromInput].flatMap((useCaseId) => roleHintSignalByUseCase[useCaseId] ?? [])
  return toUniqueOrderedToolKeys([...useCaseDefaults, ...roleDefaults, ...homeToolCatalog.map((tool) => tool.key)])
}

/**
 * @param {{ homeShortcuts?: unknown }} input
 * @returns {string[]}
 */
function sanitizeToolKeys(input) {
  return toUniqueOrderedToolKeys(readArrayValue(input, "homeShortcuts").filter((value) => typeof value === "string"))
}

/**
 * Returns explicitly saved homepage shortcut keys only.
 *
 * @param {{ homeShortcuts?: unknown }} onboarding
 * @returns {string[]}
 */
export function resolveExplicitOnboardingHomeToolKeys(onboarding) {
  return sanitizeToolKeys(onboarding)
}

/**
 * Resolves a stable, user-editable list of home-tool keys for homepage surface
 * ordering. If no explicit shortcuts are stored, the function computes a ranked
 * default from role and use-case signals.
 *
 * @param {{ primaryRole?: unknown; useCases?: unknown; homeShortcuts?: unknown }} onboarding
 * @returns {string[]}
 */
export function resolveOnboardingHomeToolKeys(onboarding) {
  /** @type {OnboardingRoleId} */
  const role = /** @type {OnboardingRoleId} */ (
    typeof onboarding?.primaryRole === "string" && roleIds.has(onboarding.primaryRole)
      ? onboarding.primaryRole
      : "public_wellness"
  )
  /** @type {OnboardingUseCaseId[]} */
  const useCaseIdsFromInput = /** @type {OnboardingUseCaseId[]} */ (Array.isArray(onboarding?.useCases)
    ? onboarding.useCases.filter((item) => typeof item === "string" && useCaseIds.has(item))
    : [])
  const explicit = sanitizeToolKeys(onboarding)
  return explicit.length > 0 ? explicit : roleAwareToolDefaults(role, useCaseIdsFromInput)
}

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
  const homeShortcuts = resolveOnboardingHomeToolKeys({
    primaryRole: selectedRole,
    useCases,
    homeShortcuts: readArrayValue(input, "homeShortcuts"),
  })

  return {
    version: ONBOARDING_VERSION,
    completedAt: new Date().toISOString(),
    primaryRole: selectedRole,
    useCases: useCases.filter((value) => useCaseIds.has(value)).slice(0, 6),
    jurisdiction: selectedRole === "therapist" ? jurisdiction.slice(0, 2) : "",
    homeShortcuts,
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
