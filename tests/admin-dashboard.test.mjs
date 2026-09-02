import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createCompiledModuleLoader,
  elementText,
  findElements,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"
import { dashboardSections } from "../lib/admin/dashboard-sections.ts"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const dashboardSource = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8")

describe("capability-aware Admin dashboard", () => {
  it("keeps the section policy outside the Next route module export surface", () => {
    assert.match(dashboardSource, /import \{ dashboardSections \} from "@\/lib\/admin\/dashboard-sections"/)
    assert.match(dashboardSource, /import \{ getAdminUserMetrics \} from "@\/lib\/admin\/user-directory"/)
    assert.doesNotMatch(dashboardSource, /export (?:type AdminDashboardSection|function dashboardSections)/)
    assert.match(dashboardSource, /export default async function AdminDashboardPage/)
  })

  it("maps current roles to the exact dashboard section contract", () => {
    assert.deepEqual(dashboardSections({ roles: ["ANATOMY_REVIEWER"] }), ["anatomy-review"])
    assert.deepEqual(dashboardSections({ roles: ["ANATOMY_EDITOR"] }), ["anatomy", "anatomy-review"])
    assert.deepEqual(dashboardSections({ roles: ["ADMIN"] }), ["users", "commerce", "anatomy", "anatomy-review"])
    assert.deepEqual(dashboardSections({ roles: ["USER"] }), [])
  })

  it("loads one fresh actor and fetches only reviewer-visible metrics", async () => {
    const fixture = loadDashboardModule({ roles: ["ANATOMY_REVIEWER"] })
    const tree = renderFunctionComponents(await fixture.compiledModule.default())
    const text = elementText(tree)

    assert.equal(fixture.calls.session, 1)
    assert.equal(fixture.calls.actor, 1)
    assert.deepEqual(fixture.calls.metricModels, [
      "anatomyMediaEntity:NEEDS_REVIEW",
      "anatomyMediaEntity:REJECTED",
      "anatomyMediaEntity:APPROVED",
    ])
    assert.equal(fixture.calls.commerce, 0)
    assert.equal(fixture.calls.userMetrics, 0)
    assert.match(text, /Anatomy image review/)
    assert.match(text, /Fast image review/)
    assert.doesNotMatch(text, /Full anatomy browser|User operations|Commerce \(/)
    assert.deepEqual(linkHrefs(tree), [
      "/admin/anatomy/media-review",
      "/admin/anatomy/media-review?status=needs-review",
      "/admin/anatomy/media-review?status=rejected",
      "/admin/anatomy/media-review?status=approved",
      "/admin/anatomy/media-review",
    ])
  })

  it("adds editor metrics and links without exposing user or commerce operations", async () => {
    const fixture = loadDashboardModule({ roles: ["ANATOMY_EDITOR"] })
    const tree = renderFunctionComponents(await fixture.compiledModule.default())
    const text = elementText(tree)

    assert.equal(fixture.calls.actor, 1)
    assert.deepEqual(fixture.calls.metricModels, [
      "anatomyMediaEntity:NEEDS_REVIEW",
      "anatomyMediaEntity:REJECTED",
      "anatomyMediaEntity:APPROVED",
      "anatomyMediaViewRequest:OPEN",
      "anatomyMediaAsset:OPEN_REUSE",
    ])
    assert.equal(fixture.calls.commerce, 0)
    assert.equal(fixture.calls.userMetrics, 0)
    assert.match(text, /Anatomy image review/)
    assert.match(text, /Anatomy editing/)
    assert.match(text, /Full anatomy browser/)
    assert.doesNotMatch(text, /User operations|Commerce \(/)
  })

  it("shows the full dashboard and commerce queue only to full Admin", async () => {
    const fixture = loadDashboardModule({ roles: ["ADMIN"] })
    const tree = renderFunctionComponents(await fixture.compiledModule.default())
    const text = elementText(tree)

    assert.equal(fixture.calls.actor, 1)
    assert.equal(fixture.calls.commerce, 1)
    assert.equal(fixture.calls.userMetrics, 1)
    assert.equal(fixture.calls.metricModels.length, 5)
    assert.match(text, /User operations/)
    assert.match(text, /42 total accounts/)
    assert.match(text, /35 verified accounts/)
    assert.match(text, /7 active Supporters/)
    assert.match(text, /11 unresolved operations/)
    assert.match(text, /6 unresolved billing goodwill operations/)
    assert.match(text, /11 active temporary grants/)
    assert.match(text, /4 temporary grants expiring within 30 days/)
    assert.match(text, /Search account-operation details with bounded filters/)
    assert.match(text, /Commerce \(2\)/)
    assert.match(text, /Full anatomy browser/)
    assert.ok(linkHrefs(tree).includes("/admin/commerce"))
  })

  it("keeps capability enforcement at every linked destination", async () => {
    const [reviewSource, anatomySource, commerceSource, usersSource, layoutSource] = await Promise.all([
      readFile(new URL("../app/admin/anatomy/media-review/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/anatomy/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/commerce/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    ])

    assert.match(reviewSource, /requireAnatomyReviewerUser\(\)/)
    assert.match(anatomySource, /requireAnatomyEditorUser\(\)/)
    assert.match(commerceSource, /requireCommerceAdminUser\(\)/)
    assert.match(usersSource, /await requireFullAdminUser\(\)/)
    assert.match(layoutSource, /Each destination must reload and[\s\S]*database-backed capability/)
  })
})

function loadDashboardModule(actor) {
  const calls = { actor: 0, commerce: 0, metricModels: [], session: 0, userMetrics: 0 }
  const prisma = createPrismaFixture(calls)
  const components = {
    AppPageShell: passThroughElement("main"),
    appInsetClassName: "inset",
    appSurfaceClassName: "surface",
  }
  const compiledModule = loadCompiledModule(dashboardSource, "app/admin/page.test.tsx", {
    "@/lib/rsc-session": {
      getCurrentRscSession: async () => {
        calls.session += 1
        return { user: { id: "session-user" } }
      },
    },
    "@/components/ui/app-surface": components,
    "@/components/ui/button": { Button: passThroughElement("button") },
    "@/components/ui/card": {
      Card: passThroughElement("article"),
      CardContent: passThroughElement("div"),
    },
    "@/lib/admin/access": {
      loadAdminActor: async ({ prismaClient, sessionUserId }) => {
        calls.actor += 1
        assert.equal(prismaClient, prisma)
        assert.equal(sessionUserId, "session-user")
        return { id: "session-user", accountLabel: "Operator", ...actor }
      },
    },
    "@/lib/admin/dashboard-sections": { dashboardSections },
    "@/lib/admin/user-directory": {
      getAdminUserMetrics: async ({ prismaClient }) => {
        calls.userMetrics += 1
        assert.equal(prismaClient, prisma)
        return {
          totalAccounts: 42,
          verifiedAccounts: 35,
          activeSupporters: 7,
          unresolvedOperations: 11,
          unresolvedBillingGoodwillOperations: 6,
          activeTemporaryGrants: 11,
          expiringTemporaryGrants: 4,
        }
      },
    },
    "@/lib/commerce/admin-service": {
      listCommerceAdminOperations: async ({ prismaClient }) => {
        calls.commerce += 1
        assert.equal(prismaClient, prisma)
        return [{ orderId: "one" }, { orderId: "two" }]
      },
    },
    "@/lib/prisma": { prisma },
    "next/link": passThroughElement("a"),
    "next/navigation": { redirect: (destination) => { throw new Error(`redirect:${destination}`) } },
  })

  return { calls, compiledModule }
}

function createPrismaFixture(calls) {
  const count = (model, label) => async ({ where }) => {
    calls.metricModels.push(`${model}:${where[label]}`)
    return calls.metricModels.length
  }

  return {
    anatomyMediaEntity: { count: count("anatomyMediaEntity", "reviewStatus") },
    anatomyMediaViewRequest: { count: count("anatomyMediaViewRequest", "status") },
    anatomyMediaAsset: { count: count("anatomyMediaAsset", "usageScope") },
  }
}

function linkHrefs(tree) {
  return findElements(tree, (element) => element.type === "a").map((element) => element.props.href)
}
