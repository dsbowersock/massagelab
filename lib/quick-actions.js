// @ts-check

export const QUICK_ACTION_MAX_VISIBLE = 7

export const quickActionCatalog = Object.freeze([
  {
    id: "start_chimer",
    label: "Start Chimer",
    description: "Open the massage session timer.",
    href: "/chimer",
    icon: "Timer",
    group: "available_now",
    roleSignals: ["therapist", "student", "client", "educator", "public_wellness"],
    useCaseSignals: ["run_sessions"],
  },
  {
    id: "start_flashcards",
    label: "Start flashcards",
    description: "Build or start a public anatomy deck.",
    href: "/education/flashcards",
    icon: "BookOpen",
    group: "available_now",
    roleSignals: ["student", "educator", "therapist", "client", "public_wellness"],
    useCaseSignals: ["learn_anatomy", "track_progress"],
  },
  {
    id: "play_anatomime",
    label: "Play Anatomime",
    description: "Open solo or shared anatomy play.",
    href: "/anatomime",
    icon: "Brain",
    group: "available_now",
    roleSignals: ["student", "educator", "therapist", "client", "public_wellness"],
    useCaseSignals: ["learn_anatomy", "teach_anatomy"],
  },
  {
    id: "wellness_quick_log",
    label: "Add wellness quick log",
    description: "Open wellness self-tracking.",
    href: "/wellness",
    icon: "HeartPulse",
    group: "available_now",
    roleSignals: ["client", "therapist", "student", "public_wellness"],
    useCaseSignals: ["book_care", "track_progress"],
  },
  {
    id: "body_sensation_check_in",
    label: "Add body-sensation check-in",
    description: "Open body-sensation tracking.",
    href: "/wellness",
    icon: "Map",
    group: "available_now",
    roleSignals: ["client", "therapist", "public_wellness"],
    useCaseSignals: ["book_care", "track_progress"],
  },
  {
    id: "start_breathing",
    label: "Start breathing guide",
    description: "Open the public breathing pacer.",
    href: "/wellness/breathing",
    icon: "Wind",
    group: "available_now",
    roleSignals: ["client", "therapist", "student", "educator", "public_wellness"],
    useCaseSignals: ["run_sessions", "book_care"],
  },
  {
    id: "start_public_music",
    label: "Start public music",
    description: "Open public music stations.",
    href: "/music",
    icon: "Radio",
    group: "available_now",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["run_sessions", "track_progress", "book_care"],
  },
  {
    id: "create_calendar_item",
    label: "Create calendar item",
    description: "Sign in to create calendar items.",
    href: "/login?callbackUrl=%2Fcalendar%2Fnew",
    signedInHref: "/calendar/new",
    icon: "CalendarDays",
    group: "sign_in_to_save",
    roleSignals: ["therapist", "client", "public_wellness"],
    useCaseSignals: ["manage_practice", "book_care"],
  },
  {
    id: "save_wellness_history",
    label: "Save wellness history",
    description: "Sign in to save wellness entries.",
    href: "/login?callbackUrl=%2Fwellness",
    signedInHref: "/wellness",
    icon: "HeartHandshake",
    group: "sign_in_to_save",
    roleSignals: ["client", "public_wellness", "therapist"],
    useCaseSignals: ["book_care", "track_progress"],
  },
  {
    id: "customize_home_shortcuts",
    label: "Customize home shortcuts",
    description: "Sign in to personalize the homepage.",
    href: "/login?callbackUrl=%2Fonboarding",
    signedInHref: "/onboarding",
    icon: "LayoutDashboard",
    group: "sign_in_to_save",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["manage_practice", "learn_anatomy", "track_progress"],
  },
  {
    id: "customize_quick_actions",
    label: "Customize quick actions",
    description: "Sign in to choose quick actions.",
    href: "/login?callbackUrl=%2Faccount%3Ftab%3Dapp-settings",
    signedInHref: "/account?tab=app-settings",
    icon: "Settings2",
    group: "sign_in_to_save",
    roleSignals: ["therapist", "student", "educator", "client", "public_wellness"],
    useCaseSignals: ["manage_practice", "learn_anatomy", "track_progress", "book_care"],
  },
])

const quickActionById = new Map(quickActionCatalog.map((action) => [action.id, action]))
const quickActionIds = new Set(quickActionCatalog.map((action) => action.id))
const anonymousGroupDefinitions = Object.freeze([
  { id: "available_now", label: "Available now" },
  { id: "sign_in_to_save", label: "Sign in to save" },
])

/** @type {Record<string, string[]>} */
const defaultsByRole = {
  therapist: ["create_calendar_item", "start_chimer", "start_public_music", "customize_quick_actions", "wellness_quick_log", "start_flashcards", "play_anatomime"],
  student: ["start_flashcards", "play_anatomime", "start_chimer", "start_public_music", "customize_quick_actions", "customize_home_shortcuts"],
  educator: ["play_anatomime", "start_flashcards", "start_public_music", "start_chimer", "customize_quick_actions", "customize_home_shortcuts"],
  client: ["wellness_quick_log", "body_sensation_check_in", "start_public_music", "create_calendar_item", "customize_quick_actions", "start_breathing"],
  public_wellness: ["start_public_music", "wellness_quick_log", "body_sensation_check_in", "start_breathing", "start_chimer", "start_flashcards", "play_anatomime"],
}

/** @type {Record<string, string[]>} */
const defaultsByUseCase = {
  learn_anatomy: ["start_flashcards", "play_anatomime"],
  teach_anatomy: ["play_anatomime", "start_flashcards"],
  run_sessions: ["start_chimer", "start_public_music", "create_calendar_item"],
  manage_practice: ["create_calendar_item", "customize_quick_actions", "customize_home_shortcuts"],
  book_care: ["wellness_quick_log", "body_sensation_check_in", "create_calendar_item"],
  track_progress: ["start_flashcards", "start_public_music", "save_wellness_history"],
}

/** Own-property guard for role/use-case maps, including prototype-collision inputs such as "__proto__". */
const hasOwn = Object.hasOwn ?? ((object, key) => Object.prototype.hasOwnProperty.call(object, key))

export function resolveAnonymousQuickActionGroups() {
  return anonymousGroupDefinitions
    .map((group) => ({
      ...group,
      actions: quickActionCatalog.filter((action) => action.group === group.id),
    }))
    .filter((group) => group.actions.length > 0)
}

/**
 * @param {{ signedIn?: boolean; onboarding?: { primaryRole?: unknown; useCases?: unknown; quickActions?: unknown } }} options
 */
export function resolveQuickActionGroups(options = {}) {
  if (!options.signedIn) {
    return resolveAnonymousQuickActionGroups()
  }

  const actions = []

  for (const id of resolveQuickActionKeys(options)) {
    const action = getQuickAction(id)

    if (!action) {
      continue
    }

    actions.push({
      ...action,
      href: action.signedInHref ?? action.href,
    })
  }

  return [{ id: "quick_actions", label: "Quick actions", actions }]
}

/**
 * Keeps user-selected quick actions route-backed, unique, and bounded for the
 * compact global speed dial.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function sanitizeQuickActionKeys(value) {
  const source = Array.isArray(value) ? value : []
  const seen = new Set()
  const selected = []

  for (const item of source) {
    if (typeof item === "string" && quickActionIds.has(item) && !seen.has(item)) {
      seen.add(item)
      selected.push(item)
    }
  }

  return selected.slice(0, QUICK_ACTION_MAX_VISIBLE)
}

/**
 * @param {{ quickActions?: unknown } | null | undefined} onboarding
 * @returns {string[]}
 */
export function resolveExplicitQuickActionKeys(onboarding) {
  return sanitizeQuickActionKeys(onboarding?.quickActions)
}

/**
 * @param {{ signedIn?: boolean; onboarding?: { primaryRole?: unknown; useCases?: unknown; quickActions?: unknown } }} options
 * @returns {string[]}
 */
export function resolveQuickActionKeys(options = {}) {
  const explicit = resolveExplicitQuickActionKeys(options.onboarding)
  if (explicit.length > 0) return explicit

  const role = typeof options.onboarding?.primaryRole === "string" && hasOwn(defaultsByRole, options.onboarding.primaryRole)
    ? options.onboarding.primaryRole
    : "public_wellness"
  const useCases = Array.isArray(options.onboarding?.useCases)
    ? options.onboarding.useCases.filter((item) => typeof item === "string")
    : []
  const roleDefaults = defaultsByRole[role]
  const useCaseDefaults = useCases.flatMap((useCase) => defaultsByUseCase[useCase] ?? [])
  const fallbackDefaults = quickActionCatalog.map((action) => action.id)

  return sanitizeQuickActionKeys([...roleDefaults, ...useCaseDefaults, ...fallbackDefaults])
}

/**
 * @param {string} id
 */
export function getQuickAction(id) {
  return quickActionById.get(id) ?? null
}
