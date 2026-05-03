import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canAdministerAccounts,
  canManageAnatomyContent,
  hasRequiredRole,
  normalizeRoles,
} from "../lib/account-permissions.js"

describe("Account permission helpers", () => {
  it("normalizes supported roles and drops unknown values", () => {
    assert.deepEqual(normalizeRoles(["user", "ADMIN", "owner", "admin", null]), ["USER", "ADMIN"])
  })

  it("treats admin as the highest role", () => {
    assert.equal(hasRequiredRole(["ADMIN"], "EDITOR"), true)
    assert.equal(hasRequiredRole(["ADMIN"], "USER"), true)
    assert.equal(canAdministerAccounts(["ADMIN"]), true)
  })

  it("lets editors manage anatomy content without account administration", () => {
    assert.equal(canManageAnatomyContent(["EDITOR"]), true)
    assert.equal(canAdministerAccounts(["EDITOR"]), false)
  })

  it("keeps regular users out of anatomy administration", () => {
    assert.equal(canManageAnatomyContent(["USER"]), false)
    assert.equal(hasRequiredRole(["USER"], "EDITOR"), false)
  })
})
