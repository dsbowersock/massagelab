import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  accountMenuRoutes,
  calendarMenuActions,
  calendarSidebarActions,
  getVisibleNavigationGroups,
  isNavigationRouteActive,
  navigationGroups,
  primaryNavigationGroups,
  resolveNavigation,
  secondaryNavigationRoutes,
} from "../lib/navigation.js"
import { FEATURE_KEYS } from "../lib/membership.js"

function primaryHrefs(navigation) {
  return navigation.primaryNavigationGroups.flatMap((group) => group.routes.map((route) => route.href))
}

function primaryGroupIds(navigation) {
  return navigation.primaryNavigationGroups.map((group) => group.id)
}

describe("Navigation IA model", () => {
  it("keeps visible alpha product routes grouped without exposing placeholders", () => {
    const groups = getVisibleNavigationGroups()

    assert.deepEqual(groups.map((group) => group.id), ["tools", "atmosphere", "documentation", "education", "games", "about"])
    assert.deepEqual(groups.flatMap((group) => group.routes.map((route) => route.href)), [
      "/chimer",
      "/tools/business-planner",
      "/tools/business-planner/income",
      "/tools/business-planner/break-even",
      "/wellness",
      "/wellness/breathing",
      "/calendar",
      "/music",
      "/clock",
      "/notes",
      "/education/flashcards",
      "/anatomime",
      "/pricing",
      "/roadmap",
      "/about",
      "/about/derrick",
    ])
  })

  it("separates primary, secondary, and account menu navigation", () => {
    assert.deepEqual(primaryNavigationGroups.map((group) => group.id), ["tools", "atmosphere", "documentation", "education", "games", "about"])
    assert.deepEqual(secondaryNavigationRoutes.map((route) => route.href), [])
    assert.deepEqual(accountMenuRoutes.map((route) => route.href), [
      "/account",
      "/account?tab=app-settings",
      "/account?tab=security",
      "/support",
      "/legal",
    ])
    assert.equal(new Set(accountMenuRoutes.map((route) => route.href)).size, accountMenuRoutes.length)
    assert.deepEqual(accountMenuRoutes.map((route) => route.label), ["Account", "Settings", "Security", "User Support", "Legal"])

    const primaryHrefs = primaryNavigationGroups.flatMap((group) => group.routes.map((route) => route.href))
    assert.equal(primaryHrefs.includes("/support"), false)
    assert.equal(primaryHrefs.includes("/roadmap"), true)
  })

  it("keeps sidebar section headings visually stronger than nested routes", () => {
    const sidebarSource = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")

    assert.match(sidebarSource, /const sidebarSectionTriggerClass = cn\([\s\S]*text-sm[\s\S]*font-semibold/)
    assert.match(sidebarSource, /const primaryChildRouteListClass = cn\([\s\S]*border-l[\s\S]*pl-2/)
    assert.match(sidebarSource, /const primaryChildRouteButtonClass = cn\([\s\S]*text-\[0\.8125rem\][\s\S]*font-normal/)
    assert.match(sidebarSource, /<SidebarRoute key=\{route.id\} nested route=\{route\}/)
  })

  it("matches the root route exactly and nested routes by path segment", () => {
    assert.equal(isNavigationRouteActive("/", "/"), true)
    assert.equal(isNavigationRouteActive("/notes/soap", "/notes"), true)
    assert.equal(isNavigationRouteActive("/account/security", "/account"), true)
    assert.equal(isNavigationRouteActive("/notes-and-more", "/notes"), false)
    assert.equal(isNavigationRouteActive("/chimer", "/"), false)
  })

  it("retains hidden home and news groups as model-only placeholders", () => {
    const modelOnlyGroupIds = navigationGroups
      .filter((group) => group.routes.length === 0 || group.routes.every((route) => route.visibleInSidebar === false))
      .map((group) => group.id)

    assert.deepEqual(modelOnlyGroupIds, ["home", "news"])
  })

  it("adds future audience metadata to every route", () => {
    const allRoutes = [
      ...navigationGroups.flatMap((group) => group.routes),
      ...secondaryNavigationRoutes,
      ...accountMenuRoutes,
      ...calendarSidebarActions,
      ...calendarMenuActions,
    ]

    assert.equal(allRoutes.every((route) => Array.isArray(route.audiences) && route.audiences.length > 0), true)
    assert.equal(allRoutes.every((route) => typeof route.icon === "string" && route.icon.length > 0), true)
    assert.equal(allRoutes.every((route) => route.groupId), true)
  })

  it("defines sidebar calendar actions without adding unsupported event-type routes", () => {
    assert.deepEqual(calendarSidebarActions.map((route) => route.href), [
      "/calendar",
      "/calendar/new",
      "/calendar/availability",
      "/calendar/services",
      "/calendar/booking",
      "/calendar/sync",
      "/calendar/requests",
    ])
    assert.deepEqual(calendarSidebarActions.map((route) => route.id), [
      "calendar-open",
      "calendar-add",
      "calendar-availability",
      "calendar-services",
      "calendar-booking",
      "calendar-sync",
      "calendar-requests",
    ])
  })

  it("defines menu actions for creating specific calendar event types", () => {
    assert.deepEqual(calendarMenuActions.map((route) => route.href), [
      "/calendar/new/appointment",
      "/calendar/new/personal",
      "/calendar/new/class",
      "/calendar/new/reminder",
      "/calendar/services",
      "/calendar/requests",
    ])
    assert.deepEqual(calendarMenuActions.map((route) => route.id), [
      "calendar-new-appointment",
      "calendar-new-personal",
      "calendar-new-class",
      "calendar-new-reminder",
      "calendar-services-menu",
      "calendar-requests-menu",
    ])
  })

  it("resolves anonymous navigation without account or calendar actions", () => {
    const navigation = resolveNavigation({ authState: "anonymous" })

    assert.deepEqual(primaryGroupIds(navigation), ["tools", "atmosphere", "documentation", "education", "games", "about"])
    assert.deepEqual(primaryHrefs(navigation), [
      "/chimer",
      "/tools/business-planner",
      "/tools/business-planner/income",
      "/tools/business-planner/break-even",
      "/wellness",
      "/wellness/breathing",
      "/calendar",
      "/music",
      "/clock",
      "/notes",
      "/education/flashcards",
      "/anatomime",
      "/pricing",
      "/roadmap",
      "/about",
      "/about/derrick",
    ])
    assert.deepEqual(navigation.accountMenuRoutes.map((route) => route.href), ["/support", "/legal"])
    assert.deepEqual(navigation.calendarSidebarActions.map((route) => route.href), [])
    assert.deepEqual(navigation.calendarMenuActions.map((route) => route.href), [])
  })

  it("keeps the wellness practice surface visible for anonymous, signed-in, and client users", () => {
    const anonymousNavigation = resolveNavigation({ authState: "anonymous" })
    const signedInNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "USER", status: "VERIFIED" }],
    })
    const clientNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "CLIENT", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.calendarBasicScheduling],
    })

    assert.equal(primaryHrefs(anonymousNavigation).includes("/wellness"), true)
    assert.equal(primaryHrefs(anonymousNavigation).includes("/music"), true)
    assert.equal(primaryHrefs(anonymousNavigation).includes("/clock"), true)
    assert.equal(primaryHrefs(anonymousNavigation).includes("/wellness/breathing"), true)
    assert.equal(primaryHrefs(signedInNavigation).includes("/wellness"), true)
    assert.equal(primaryHrefs(signedInNavigation).includes("/music"), true)
    assert.equal(primaryHrefs(signedInNavigation).includes("/clock"), true)
    assert.equal(primaryHrefs(signedInNavigation).includes("/wellness/breathing"), true)
    assert.equal(primaryHrefs(clientNavigation).includes("/wellness"), true)
    assert.equal(primaryHrefs(clientNavigation).includes("/music"), true)
    assert.equal(primaryHrefs(clientNavigation).includes("/clock"), true)
    assert.equal(primaryHrefs(clientNavigation).includes("/wellness/breathing"), true)
    assert.equal(primaryHrefs(clientNavigation).some((href) => href.startsWith("/notes/")), false)
  })

  it("resolves signed-in base users without practice-management shortcuts", () => {
    const navigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "USER", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.calendarBasicScheduling],
      practiceRoles: [],
    })

    assert.deepEqual(primaryGroupIds(navigation), ["tools", "atmosphere", "documentation", "education", "games", "about"])
    assert.deepEqual(navigation.accountMenuRoutes.map((route) => route.href), [
      "/account",
      "/account?tab=app-settings",
      "/account?tab=security",
      "/support",
      "/legal",
    ])
    assert.deepEqual(navigation.calendarSidebarActions.map((route) => route.href), ["/calendar"])
    assert.deepEqual(navigation.calendarMenuActions.map((route) => route.href), [])
  })

  it("keeps supporter and student access from unlocking therapist documentation", () => {
    const supporterNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "USER", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.calendarBasicScheduling, FEATURE_KEYS.chimerCustomColors],
    })
    const studentNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "STUDENT", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.calendarBasicScheduling],
    })

    assert.equal(primaryHrefs(supporterNavigation).includes("/notes"), true)
    assert.equal(primaryHrefs(studentNavigation).includes("/notes"), true)
    assert.equal(primaryHrefs(supporterNavigation).some((href) => href.startsWith("/notes/")), false)
    assert.equal(primaryHrefs(studentNavigation).some((href) => href.startsWith("/notes/")), false)
  })

  it("does not place therapist professional-record previews in the client sidebar", () => {
    const navigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "CLIENT", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.calendarBasicScheduling],
    })

    assert.equal(primaryHrefs(navigation).includes("/notes"), false)
    assert.equal(primaryHrefs(navigation).some((href) => href.startsWith("/notes/")), false)
  })

  it("shows documentation when the therapist documentation feature is present", () => {
    const navigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "LICENSED_THERAPIST", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.calendarBasicScheduling, FEATURE_KEYS.therapistDocumentationTools],
    })

    assert.equal(primaryHrefs(navigation).includes("/notes"), true)
  })

  it("filters practice calendar actions by practice role", () => {
    const ownerNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "LICENSED_THERAPIST", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.externalCalendarSync],
      practiceRoles: [{ practiceId: "practice-1", role: "OWNER" }],
    })
    const therapistNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "LICENSED_THERAPIST", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.externalCalendarSync],
      practiceRoles: [{ practiceId: "practice-1", role: "THERAPIST" }],
    })
    const staffNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "USER", status: "VERIFIED" }],
      practiceRoles: [{ practiceId: "practice-1", role: "STAFF" }],
    })

    assert.deepEqual(ownerNavigation.calendarSidebarActions.map((route) => route.id), [
      "calendar-open",
      "calendar-add",
      "calendar-availability",
      "calendar-services",
      "calendar-booking",
      "calendar-sync",
      "calendar-requests",
    ])
    assert.deepEqual(ownerNavigation.calendarMenuActions.map((route) => route.id), [
      "calendar-new-appointment",
      "calendar-new-personal",
      "calendar-new-class",
      "calendar-new-reminder",
      "calendar-services-menu",
      "calendar-requests-menu",
    ])
    assert.equal(therapistNavigation.calendarMenuActions.some((route) => route.id === "calendar-new-class"), false)
    assert.equal(staffNavigation.calendarSidebarActions.some((route) => route.id === "calendar-availability"), false)
    assert.equal(staffNavigation.calendarMenuActions.some((route) => route.id === "calendar-new-personal"), false)
    assert.equal(staffNavigation.calendarMenuActions.some((route) => route.id === "calendar-new-class"), true)
  })

  it("hides calendar sync unless the external sync feature is present", () => {
    const withoutSyncFeature = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "LICENSED_THERAPIST", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.calendarFullScheduling],
      practiceRoles: [{ practiceId: "practice-1", role: "THERAPIST" }],
    })
    const withSyncFeature = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "LICENSED_THERAPIST", status: "VERIFIED" }],
      featureKeys: [FEATURE_KEYS.calendarFullScheduling, FEATURE_KEYS.externalCalendarSync],
      practiceRoles: [{ practiceId: "practice-1", role: "THERAPIST" }],
    })

    assert.equal(withoutSyncFeature.calendarSidebarActions.some((route) => route.id === "calendar-sync"), false)
    assert.equal(withSyncFeature.calendarSidebarActions.some((route) => route.id === "calendar-sync"), true)
  })

  it("resolves admin navigation only for verified admin-capable roles", () => {
    const anatomyAdminNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "ANATOMY_ADMIN", status: "VERIFIED" }],
    })
    const adminNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "ADMIN", status: "VERIFIED" }],
    })
    const pendingAdminNavigation = resolveNavigation({
      authState: "signed-in",
      roleAssignments: [{ role: "ADMIN", status: "PENDING" }],
    })

    assert.equal(primaryGroupIds(anatomyAdminNavigation).includes("admin"), true)
    assert.equal(primaryHrefs(anatomyAdminNavigation).includes("/admin"), true)
    assert.equal(primaryHrefs(anatomyAdminNavigation).includes("/admin/anatomy"), true)
    assert.equal(primaryHrefs(anatomyAdminNavigation).includes("/admin/anatomy/media-review"), true)
    assert.equal(primaryGroupIds(adminNavigation).includes("admin"), true)
    assert.equal(primaryHrefs(adminNavigation).includes("/admin"), true)
    assert.equal(primaryHrefs(adminNavigation).includes("/admin/anatomy"), true)
    assert.equal(primaryHrefs(adminNavigation).includes("/admin/anatomy/media-review"), true)
    assert.equal(primaryGroupIds(pendingAdminNavigation).includes("admin"), false)
  })

  it("does not expose direct professional-record routes from sidebar navigation", () => {
    const allSidebarRoutes = [
      ...navigationGroups.flatMap((group) => group.routes),
      ...secondaryNavigationRoutes,
      ...accountMenuRoutes,
      ...calendarSidebarActions,
      ...calendarMenuActions,
    ].filter((route) => route.visibleInSidebar)

    assert.equal(allSidebarRoutes.some((route) => /^\/notes\/(soap|intake|journal|rom)/.test(route.href)), false)
  })

  it("warns about unknown practice roles without granting navigation access", () => {
    const warnings = []
    const originalWarn = console.warn
    console.warn = (...args) => warnings.push(args)
    const context = {
      authState: "signed-in",
      roleAssignments: [{ role: "USER", status: "VERIFIED" }],
      practiceRoles: [{ practiceId: "practice-1", role: "MANAGER" }],
    }

    try {
      const navigation = resolveNavigation(context)
      const repeatedNavigation = resolveNavigation(context)

      assert.deepEqual(navigation.calendarSidebarActions.map((route) => route.href), ["/calendar"])
      assert.deepEqual(repeatedNavigation.calendarSidebarActions.map((route) => route.href), ["/calendar"])
      assert.equal(warnings.length, process.env.NODE_ENV === "production" ? 0 : 2)
      if (process.env.NODE_ENV !== "production") {
        assert.equal(warnings[0][0], "Unknown practice role in navigation context")
        assert.deepEqual(warnings[0][1], { originalRole: "MANAGER", normalizedRole: "MANAGER" })
        assert.equal(warnings[1][0], "Unknown practice role in navigation context")
        assert.deepEqual(warnings[1][1], { originalRole: "MANAGER", normalizedRole: "MANAGER" })
      }
    } finally {
      console.warn = originalWarn
    }
  })
})
