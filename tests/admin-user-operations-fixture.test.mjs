import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { requireBrowserAdminFixtureQaAuthorization } from "../lib/admin/browser-qa-authorization.ts"
import { createBrowserAdminFixtureIdentity } from "../lib/admin/browser-fixture-identity.ts"

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
})
