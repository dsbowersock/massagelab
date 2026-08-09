import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { requireBrowserAdminFixtureQaAuthorization } from "../lib/admin/browser-qa-authorization.ts"

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
})
