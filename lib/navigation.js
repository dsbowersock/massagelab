const allAudiences = ["therapist", "practice", "client"]

/**
 * @typedef {"therapist" | "practice" | "client"} NavigationAudience
 * @typedef {Object} NavigationRoute
 * @property {string} id
 * @property {string} href
 * @property {string} label
 * @property {string} icon
 * @property {NavigationAudience[]} audiences
 * @property {boolean} visibleInSidebar
 * @property {string} groupId
 *
 * @typedef {Object} NavigationGroup
 * @property {string} id
 * @property {string} label
 * @property {NavigationRoute[]} routes
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
        visibleInSidebar: true,
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
        audiences: ["therapist", "client"],
        visibleInSidebar: true,
        groupId: "tools",
      },
      {
        id: "calendar",
        href: "/calendar",
        label: "Calendar",
        icon: "CalendarDays",
        audiences: ["therapist", "practice", "client"],
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
        audiences: ["therapist"],
        visibleInSidebar: true,
        groupId: "documentation",
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
        audiences: ["therapist", "practice", "client"],
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
]

export function getVisibleNavigationGroups() {
  return navigationGroups
    .map((group) => ({
      ...group,
      routes: group.routes.filter((route) => route.visibleInSidebar),
    }))
    .filter((group) => group.routes.length > 0)
}

export const primaryNavigationGroups = getVisibleNavigationGroups()

/** @type {NavigationRoute[]} */
export const secondaryNavigationRoutes = [
  {
    id: "user-support",
    href: "/support",
    label: "User Support",
    icon: "LifeBuoy",
    audiences: allAudiences,
    visibleInSidebar: true,
    groupId: "secondary",
  },
  {
    id: "roadmap",
    href: "/roadmap",
    label: "Roadmap",
    icon: "Map",
    audiences: allAudiences,
    visibleInSidebar: true,
    groupId: "secondary",
  },
]

/** @type {NavigationRoute[]} */
export const accountMenuRoutes = [
  {
    id: "account",
    href: "/account",
    label: "Account",
    icon: "UserRound",
    audiences: allAudiences,
    visibleInSidebar: true,
    groupId: "account",
  },
  {
    id: "account-security",
    href: "/account?tab=security",
    label: "Security",
    icon: "ShieldCheck",
    audiences: allAudiences,
    visibleInSidebar: true,
    groupId: "account",
  },
  {
    id: "settings",
    href: "/account",
    label: "Settings",
    icon: "Settings",
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
  },
  {
    id: "calendar-add",
    href: "/calendar/new",
    label: "Add Appointment/Event",
    icon: "Plus",
    audiences: ["therapist", "practice", "client"],
    visibleInSidebar: true,
    groupId: "calendar",
  },
  {
    id: "calendar-availability",
    href: "/calendar/availability",
    label: "Set Availability",
    icon: "Clock",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar",
  },
  {
    id: "calendar-services",
    href: "/calendar/services",
    label: "Services",
    icon: "Settings2",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar",
  },
  {
    id: "calendar-booking",
    href: "/calendar/booking",
    label: "Booking Settings",
    icon: "CalendarCog",
    audiences: ["therapist", "practice"],
    visibleInSidebar: true,
    groupId: "calendar",
  },
]

export const footerNavigationRoutes = accountMenuRoutes

export function isNavigationRouteActive(pathname, href) {
  const currentPathname = pathname || "/"

  if (href === "/") {
    return currentPathname === "/"
  }

  return currentPathname === href || currentPathname.startsWith(`${href}/`)
}
