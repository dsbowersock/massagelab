import { normalizeRoleAssignments, normalizeRoles } from "./account-permissions.js"
import { FEATURE_KEYS, hasFeature } from "./membership.js"

const allAudiences = ["anonymous", "signed-in", "student", "therapist", "practice", "client", "admin"]
const accountNavigationAudiences = ["signed-in", "student", "therapist", "practice", "client", "admin"]
const calendarOperatorRoles = ["OWNER", "THERAPIST", "STAFF"]
const calendarProviderRoles = ["OWNER", "THERAPIST"]

/**
 * @typedef {"anonymous" | "signed-in" | "student" | "therapist" | "practice" | "client" | "admin"} NavigationAudience
 * @typedef {"anonymous" | "signed-in"} NavigationAuthState
 * @typedef {"USER" | "STUDENT" | "LICENSED_THERAPIST" | "CLIENT" | "EDITOR" | "ANATOMY_ADMIN" | "ADMIN"} NavigationAccountRole
 * @typedef {"OWNER" | "THERAPIST" | "STAFF"} NavigationPracticeRole
 * @typedef {{ role: NavigationAccountRole | string, status?: string }} NavigationRoleAssignment
 * @typedef {{ practiceId?: string, role: NavigationPracticeRole | string }} NavigationPracticeRoleAssignment
 * @typedef {Record<string, boolean>} NavigationCapabilities
 * @typedef {Object} NavigationRoute
 * @property {string} id
 * @property {string} href
 * @property {string} label
 * @property {string} icon
 * @property {NavigationAudience[]} audiences
 * @property {boolean} visibleInSidebar
 * @property {string} groupId
 * @property {NavigationAuthState} [auth]
 * @property {NavigationAccountRole[]} [accountRoles]
 * @property {NavigationAccountRole[]} [hiddenForAccountRoles]
 * @property {string[]} [hiddenForAccountRolesUnlessFeature]
 * @property {NavigationPracticeRole[]} [practiceRoles]
 * @property {string[]} [featureKeys]
 * @property {keyof NavigationCapabilities} [capability]
 *
 * @typedef {Object} NavigationGroup
 * @property {string} id
 * @property {string} label
 * @property {NavigationRoute[]} routes
 *
 * @typedef {Object} NavigationContext
 * @property {NavigationAuthState} [authState]
 * @property {(NavigationAccountRole | string)[]} [accountRoles]
 * @property {NavigationRoleAssignment[]} [roleAssignments]
 * @property {string[]} [featureKeys]
 * @property {NavigationCapabilities} [capabilities]
 * @property {(NavigationPracticeRole | string | NavigationPracticeRoleAssignment)[]} [practiceRoles]
 *
 * @typedef {Object} ResolvedNavigation
 * @property {NavigationGroup[]} primaryNavigationGroups
 * @property {NavigationRoute[]} secondaryNavigationRoutes
 * @property {NavigationRoute[]} accountMenuRoutes
 * @property {NavigationRoute[]} calendarSidebarActions
 * @property {NavigationRoute[]} calendarMenuActions
 */

/** @type {NavigationGroup[]} */
export const navigationGroups = [
  {
    id: "home",
    label: "Home",
    routes: [
      {
        id: "home",
        href: "/",
        label: "Home",
        icon: "Home",
        audiences: allAudiences,
        visibleInSidebar: false,
        groupId: "home",
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    routes: [
      {
        id: "chimer",
        href: "/chimer",
        label: "Chimer",
        icon: "Timer",
        audiences: allAudiences,
        visibleInSidebar: true,
        groupId: "tools",
      },
      {
        id: "calendar",
        href: "/calendar",
        label: "Calendar",
        icon: "CalendarDays",
        audiences: allAudiences,
        visibleInSidebar: true,
        groupId: "tools",
      },
    ],
  },
  {
    id: "documentation",
    label: "Documentation",
    routes: [
      {
        id: "notes",
        href: "/notes",
        label: "Notes",
        icon: "FileText",
        audiences: ["anonymous", "signed-in", "student", "therapist", "practice", "admin"],
        visibleInSidebar: true,
        groupId: "documentation",
        hiddenForAccountRoles: ["CLIENT"],
        hiddenForAccountRolesUnlessFeature: [FEATURE_KEYS.therapistDocumentationTools],
      },
    ],
  },
  {
    id: "education",
    label: "Education",
    routes: [],
  },
  {
    id: "games",
    label: "Games",
    routes: [
      {
        id: "anatomime",
        href: "/anatomime",
        label: "Anatomime",
        icon: "Brain",
        audiences: allAudiences,
        visibleInSidebar: true,
        groupId: "games",
      },
    ],
  },
  {
    id: "about",
    label: "About",
    routes: [
      {
        id: "pricing",
        href: "/pricing",
        label: "Pricing",
        icon: "BadgeDollarSign",
        audiences: allAudiences,
        visibleInSidebar: true,
        groupId: "about",
      },
      {
        id: "roadmap",
        href: "/roadmap",
        label: "Roadmap",
        icon: "Map",
        audiences: allAudiences,
        visibleInSidebar: true,
        groupId: "about",
      },
      {
        id: "about-project",
        href: "/about",
        label: "About MassageLab",
        icon: "Info",
        audiences: allAudiences,
        visibleInSidebar: true,
        groupId: "about",
      },
      {
        id: "about-derrick",
        href: "/about/derrick",
        label: "About Derrick",
        icon: "UserRound",
        audiences: allAudiences,
        visibleInSidebar: true,
        groupId: "about",
      },
    ],
  },
  {
    id: "news",
    label: "News",
    routes: [],
  },
  {
    id: "admin",
    label: "Admin",
    routes: [
      {
        id: "admin-anatomy",
        href: "/admin/anatomy",
        label: "Anatomy Admin",
        icon: "Brain",
        audiences: ["admin"],
        visibleInSidebar: true,
        groupId: "admin",
        auth: "signed-in",
        accountRoles: ["ANATOMY_ADMIN", "ADMIN"],
      },
    ],
  },
]

/**
 * @param {NavigationContext} [context]
 */
export function getVisibleNavigationGroups(context = {}) {
  return navigationGroups
    .map((group) => ({
      ...group,
      routes: group.routes.filter((route) => isRouteVisible(route, context)),
    }))
    .filter((group) => group.routes.length > 0)
}

export const primaryNavigationGroups = getVisibleNavigationGroups()

/** @type {NavigationRoute[]} */
export const secondaryNavigationRoutes = []

/** @type {NavigationRoute[]} */
export const accountMenuRoutes = [
  {
    id: "account",
    href: "/account",
    label: "Account",
    icon: "UserRound",
    audiences: accountNavigationAudiences,
    visibleInSidebar: true,
    groupId: "account",
    auth: "signed-in",
  },
  {
    id: "settings",
    href: "/account?tab=app-settings",
    label: "Settings",
    icon: "Settings",
    audiences: accountNavigationAudiences,
    visibleInSidebar: true,
    groupId: "account",
    auth: "signed-in",
  },
  {
    id: "account-security",
    href: "/account?tab=security",
    label: "Security",
    icon: "ShieldCheck",
    audiences: accountNavigationAudiences,
    visibleInSidebar: true,
    groupId: "account",
    auth: "signed-in",
  },
  {
    id: "user-support",
    href: "/support",
    label: "User Support",
    icon: "LifeBuoy",
    audiences: allAudiences,
    visibleInSidebar: true,
    groupId: "account",
  },
]

/** @type {NavigationRoute[]} */
export const calendarSidebarActions = [
  {
    id: "calendar-open",
    href: "/calendar",
    label: "Open Calendar",
    icon: "CalendarDays",
    audiences: ["therapist", "practice", "client"],
    visibleInSidebar: true,
    groupId: "calendar",
    auth: "signed-in",
  },
  {
    id: "calendar-add",
    href: "/calendar/new",
    label: "Add Appointment/Event",
    icon: "Plus",
    audiences: ["therapist", "practice", "client"],
    visibleInSidebar: true,
    groupId: "calendar",
    auth: "signed-in",
    practiceRoles: calendarOperatorRoles,
  },
  {
    id: "calendar-availability",
    href: "/calendar/availability",
    label: "Set Availability",
    icon: "Clock",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar",
    auth: "signed-in",
    practiceRoles: calendarProviderRoles,
  },
  {
    id: "calendar-services",
    href: "/calendar/services",
    label: "Services",
    icon: "Settings2",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar",
    auth: "signed-in",
    practiceRoles: calendarOperatorRoles,
  },
  {
    id: "calendar-booking",
    href: "/calendar/booking",
    label: "Booking Settings",
    icon: "CalendarCog",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar",
    auth: "signed-in",
    practiceRoles: calendarOperatorRoles,
  },
  {
    id: "calendar-requests",
    href: "/calendar/requests",
    label: "Requests",
    icon: "ListChecks",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar",
    auth: "signed-in",
    practiceRoles: calendarOperatorRoles,
  },
]

/** @type {NavigationRoute[]} */
export const calendarMenuActions = [
  {
    id: "calendar-new-appointment",
    href: "/calendar/new/appointment",
    label: "Appointment",
    icon: "Plus",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar-menu",
    auth: "signed-in",
    practiceRoles: calendarOperatorRoles,
  },
  {
    id: "calendar-new-personal",
    href: "/calendar/new/personal",
    label: "Personal event",
    icon: "CalendarOff",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar-menu",
    auth: "signed-in",
    practiceRoles: calendarProviderRoles,
  },
  {
    id: "calendar-new-class",
    href: "/calendar/new/class",
    label: "Class",
    icon: "UsersRound",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar-menu",
    auth: "signed-in",
    practiceRoles: ["OWNER", "STAFF"],
  },
  {
    id: "calendar-new-reminder",
    href: "/calendar/new/reminder",
    label: "Reminder",
    icon: "ClipboardList",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar-menu",
    auth: "signed-in",
    practiceRoles: calendarOperatorRoles,
  },
  {
    id: "calendar-services-menu",
    href: "/calendar/services",
    label: "Services",
    icon: "Settings2",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar-menu",
    auth: "signed-in",
    practiceRoles: calendarOperatorRoles,
  },
  {
    id: "calendar-requests-menu",
    href: "/calendar/requests",
    label: "Requests",
    icon: "ListChecks",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar-menu",
    auth: "signed-in",
    practiceRoles: calendarOperatorRoles,
  },
]

export const footerNavigationRoutes = accountMenuRoutes

/**
 * @param {NavigationContext} [context]
 * @returns {ResolvedNavigation}
 */
export function resolveNavigation(context = {}) {
  return {
    primaryNavigationGroups: getVisibleNavigationGroups(context),
    secondaryNavigationRoutes: resolveRoutes(secondaryNavigationRoutes, context),
    accountMenuRoutes: resolveRoutes(accountMenuRoutes, context),
    calendarSidebarActions: resolveRoutes(calendarSidebarActions, context),
    calendarMenuActions: resolveRoutes(calendarMenuActions, context),
  }
}

/**
 * @param {NavigationRoute[]} routes
 * @param {NavigationContext} context
 */
function resolveRoutes(routes, context) {
  return routes.filter((route) => isRouteVisible(route, context))
}

/**
 * @param {NavigationRoute} route
 * @param {NavigationContext} context
 */
export function isRouteVisible(route, context = {}) {
  if (!route.visibleInSidebar) {
    return false
  }

  const normalizedContext = normalizeNavigationContext(context)
  const isSignedIn = normalizedContext.authState === "signed-in"

  if (route.auth === "signed-in" && !isSignedIn) {
    return false
  }

  if (route.accountRoles?.length && !route.accountRoles.some((role) => normalizedContext.verifiedAccountRoles.has(role))) {
    return false
  }

  if (route.hiddenForAccountRoles?.some((role) => normalizedContext.verifiedAccountRoles.has(role))) {
    const bypassFeatures = route.hiddenForAccountRolesUnlessFeature ?? []
    if (!bypassFeatures.some((featureKey) => hasFeature(normalizedContext.featureKeys, featureKey))) {
      return false
    }
  }

  if (route.practiceRoles?.length && !route.practiceRoles.some((role) => normalizedContext.practiceRoles.has(role))) {
    return false
  }

  if (route.featureKeys?.length && !route.featureKeys.every((featureKey) => hasFeature(normalizedContext.featureKeys, featureKey))) {
    return false
  }

  if (route.capability && !normalizedContext.capabilities[route.capability]) {
    return false
  }

  return true
}

/**
 * @param {NavigationContext} context
 */
function normalizeNavigationContext(context) {
  const explicitAuthState = context.authState === "signed-in" ? "signed-in" : "anonymous"
  const roleAssignments = normalizeRoleAssignments(context.roleAssignments)
  const fallbackRoles = normalizeRoles(context.accountRoles)
  const assignments = roleAssignments.length > 0
    ? roleAssignments
    : fallbackRoles.map((role) => ({ role, status: "VERIFIED" }))

  if (explicitAuthState === "signed-in" && assignments.length === 0) {
    assignments.push({ role: "USER", status: "VERIFIED" })
  }

  return {
    authState: explicitAuthState,
    verifiedAccountRoles: new Set(assignments
      .filter((assignment) => assignment.status === "VERIFIED")
      .map((assignment) => assignment.role)),
    featureKeys: Array.isArray(context.featureKeys) ? context.featureKeys.filter((featureKey) => typeof featureKey === "string") : [],
    capabilities: context.capabilities && typeof context.capabilities === "object" ? context.capabilities : {},
    practiceRoles: normalizePracticeRoles(context.practiceRoles),
  }
}

/**
 * @param {NavigationContext["practiceRoles"]} practiceRoles
 */
function normalizePracticeRoles(practiceRoles) {
  const roles = new Set()

  if (!Array.isArray(practiceRoles)) {
    return roles
  }

  for (const practiceRole of practiceRoles) {
    const rawRole = typeof practiceRole === "string"
      ? practiceRole
      : practiceRole && typeof practiceRole === "object" && "role" in practiceRole
        ? practiceRole.role
        : ""
    const normalizedRole = String(rawRole ?? "").toUpperCase()

    if (calendarOperatorRoles.includes(normalizedRole)) {
      roles.add(normalizedRole)
    }
  }

  return roles
}

export function isNavigationRouteActive(pathname, href) {
  const currentPathname = pathname || "/"

  if (href === "/") {
    return currentPathname === "/"
  }

  return currentPathname === href || currentPathname.startsWith(`${href}/`)
}
