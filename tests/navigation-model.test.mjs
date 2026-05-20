import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  accountMenuRoutes,
  calendarSidebarActions,
  getVisibleNavigationGroups,
  isNavigationRouteActive,
  navigationGroups,
  primaryNavigationGroups,
  secondaryNavigationRoutes,
} from "../lib/navigation.js"

describe("Navigation IA model", () => {
  it("keeps visible alpha product routes grouped without exposing placeholders", () => {
    const groups = getVisibleNavigationGroups()

    assert.deepEqual(groups.map((group) => group.id), ["home", "tools", "documentation", "games", "about"])
    assert.deepEqual(groups.flatMap((group) => group.routes.map((route) => route.href)), [
      "/",
      "/chimer",
      "/calendar",
      "/notes",
      "/anatomime",
      "/pricing",
      "/about",
      "/about/derrick",
    ])
  })

  it("separates primary, secondary, and account menu navigation", () => {
    assert.deepEqual(primaryNavigationGroups.map((group) => group.id), ["home", "tools", "documentation", "games", "about"])
    assert.deepEqual(secondaryNavigationRoutes.map((route) => route.href), ["/support", "/roadmap"])
    assert.deepEqual(accountMenuRoutes.map((route) => route.href), [
      "/account",
      "/account?tab=security",
      "/account",
    ])
    assert.deepEqual(accountMenuRoutes.map((route) => route.label), ["Account", "Security", "Settings"])

    const primaryHrefs = primaryNavigationGroups.flatMap((group) => group.routes.map((route) => route.href))
    assert.equal(primaryHrefs.includes("/support"), false)
    assert.equal(primaryHrefs.includes("/roadmap"), false)
  })

  it("matches the root route exactly and nested routes by path segment", () => {
    assert.equal(isNavigationRouteActive("/", "/"), true)
    assert.equal(isNavigationRouteActive("/notes/soap", "/notes"), true)
    assert.equal(isNavigationRouteActive("/account/security", "/account"), true)
    assert.equal(isNavigationRouteActive("/notes-and-more", "/notes"), false)
    assert.equal(isNavigationRouteActive("/chimer", "/"), false)
  })

  it("retains hidden education and news groups as model-only placeholders", () => {
    const modelOnlyGroupIds = navigationGroups
      .filter((group) => group.routes.length === 0 || group.routes.every((route) => route.visibleInSidebar === false))
      .map((group) => group.id)

    assert.deepEqual(modelOnlyGroupIds, ["education", "news"])
  })

  it("adds future audience metadata to every route", () => {
    const allRoutes = [
      ...navigationGroups.flatMap((group) => group.routes),
      ...secondaryNavigationRoutes,
      ...accountMenuRoutes,
      ...calendarSidebarActions,
    ]

    assert.equal(allRoutes.every((route) => Array.isArray(route.audiences) && route.audiences.length > 0), true)
    assert.equal(allRoutes.every((route) => typeof route.icon === "string" && route.icon.length > 0), true)
    assert.equal(allRoutes.every((route) => route.groupId), true)
  })

  it("defines sidebar calendar actions without adding unsupported event-type routes", () => {
    assert.deepEqual(calendarSidebarActions.map((route) => route.href), ["/calendar", "/calendar/new", "/calendar/availability", "/calendar/services", "/calendar/booking"])
    assert.deepEqual(calendarSidebarActions.map((route) => route.id), ["calendar-open", "calendar-add", "calendar-availability", "calendar-services", "calendar-booking"])
  })
})
