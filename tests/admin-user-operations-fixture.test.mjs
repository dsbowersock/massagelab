import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { requireBrowserAdminFixtureQaAuthorization } from "../lib/admin/browser-qa-authorization.ts"
import { createBrowserAdminFixtureIdentity } from "../lib/admin/browser-fixture-identity.ts"
import { removeBrowserAdminFixtureRecords } from "../lib/admin/browser-fixture-cleanup.ts"
import { createBrowserAdminFixtureRecords } from "../lib/admin/browser-fixture-provisioning.ts"

describe("admin user operations browser fixture", () => {
  it("fails closed unless the dedicated QA mutation opt-in is explicitly set", () => {
    assert.throws(
      () => requireBrowserAdminFixtureQaAuthorization({ DATABASE_URL: "postgresql://example.test/not-a-real-database" }),
      /MASSAGELAB_BROWSER_QA_DATABASE=1/,
    )
  })

  it("accepts only the dedicated QA mutation opt-in", () => {
    assert.doesNotThrow(() => requireBrowserAdminFixtureQaAuthorization({
      DATABASE_URL: "postgresql://example.test/not-a-real-database",
      MASSAGELAB_BROWSER_QA_DATABASE: "1",
    }))
  })

  it("derives isolated deterministic browser-admin identities for each Playwright project", () => {
    const desktop = createBrowserAdminFixtureIdentity("desktop-chromium")
    const mobile = createBrowserAdminFixtureIdentity("mobile-chromium")

    assert.deepEqual(desktop, {
      operator: { id: "browser-admin-operator-desktop-chromium", name: "Browser Admin Operator desktop-chromium", email: "browser-admin-operator-desktop-chromium@example.test" },
      target: { id: "browser-admin-target-desktop-chromium", name: "Browser Admin Target desktop-chromium", email: "browser-admin-target-desktop-chromium@example.test" },
    })
    assert.notEqual(desktop.operator.id, mobile.operator.id)
    assert.notEqual(desktop.target.id, mobile.target.id)
    assert.throws(() => createBrowserAdminFixtureIdentity("desktop chromium"), /safe Playwright project name/)
  })

  it("removes only a project's provisioning rows in FK-safe order before its exact users", async () => {
    const calls = []
    await removeBrowserAdminFixtureRecords({
      prismaClient: cleanupPrisma(calls),
      projectName: "desktop-chromium",
      environment: { DATABASE_URL: "postgresql://example.test/not-a-real-database", MASSAGELAB_BROWSER_QA_DATABASE: "1" },
    })

    const ids = ["browser-admin-operator-desktop-chromium", "browser-admin-target-desktop-chromium"]
    assert.deepEqual(calls, [
      ["commerceEvent.deleteMany", { where: { userId: { in: ids } } }],
      ["backgroundCreditEntry.deleteMany", { where: { userId: { in: ids } } }],
      ["backgroundCreditWallet.deleteMany", { where: { userId: { in: ids } } }],
      ["user.deleteMany", { where: { id: { in: ids } } }],
    ])
  })

  it("provisions the verified operator before browser authentication can trigger concurrent refreshes", async () => {
    const calls = []
    const identity = createBrowserAdminFixtureIdentity("desktop-chromium")
    await createBrowserAdminFixtureRecords({
      prismaClient: { user: { create: async ({ data }) => { calls.push(["user.create", data.id]) } } },
      identity,
      environment: { DATABASE_URL: "postgresql://example.test/not-a-real-database", MASSAGELAB_BROWSER_QA_DATABASE: "1" },
      provisionCredits: async (_prismaClient, userId) => { calls.push(["ensureVerifiedUserBackgroundCredits", userId]) },
    })

    assert.deepEqual(calls, [
      ["user.create", identity.operator.id],
      ["user.create", identity.target.id],
      ["ensureVerifiedUserBackgroundCredits", identity.operator.id],
    ])
  })
})

function cleanupPrisma(calls) {
  return Object.fromEntries(["commerceEvent", "backgroundCreditEntry", "backgroundCreditWallet", "user"].map((model) => [model, {
    deleteMany: async (args) => { calls.push([`${model}.deleteMany`, args]); return { count: 0 } },
  }]))
}
