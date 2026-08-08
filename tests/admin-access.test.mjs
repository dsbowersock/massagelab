import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadAdminActor,
  requireAnatomyEditorUser,
  requireAnatomyReviewerUser,
  requireFullAdminUser,
} from "../lib/admin/access.ts"
import { highestRole as highestAccountRole } from "../lib/account-permissions.js"

function createDatabase() {
  const users = new Map([
    ["reviewer", { id: "reviewer", name: "Reviewer", email: "reviewer@example.test", emailVerified: new Date(), roles: [{ role: "ANATOMY_REVIEWER", status: "VERIFIED" }] }],
    ["editor", { id: "editor", name: "Editor", email: "editor@example.test", emailVerified: new Date(), roles: [{ role: "ANATOMY_EDITOR", status: "VERIFIED" }] }],
    ["legacy", { id: "legacy", name: "Legacy", email: "legacy@example.test", emailVerified: new Date(), roles: [{ role: "ANATOMY_ADMIN", status: "VERIFIED" }] }],
    ["admin", { id: "admin", name: "Full Admin", email: "admin@example.test", emailVerified: new Date(), roles: [{ role: "ADMIN", status: "VERIFIED" }] }],
    ["ordinary", { id: "ordinary", name: "Ordinary", email: "ordinary@example.test", emailVerified: new Date(), roles: [{ role: "USER", status: "VERIFIED" }] }],
    ["pending", { id: "pending", name: "Pending", email: "pending@example.test", emailVerified: new Date(), roles: [{ role: "ADMIN", status: "PENDING" }] }],
    ["revoked", { id: "revoked", name: "Revoked", email: "revoked@example.test", emailVerified: new Date(), roles: [{ role: "ANATOMY_EDITOR", status: "REVOKED" }] }],
    ["unverified", { id: "unverified", name: "Unverified", email: "unverified@example.test", emailVerified: null, roles: [{ role: "ADMIN", status: "VERIFIED" }] }],
  ])
  return {
    user: {
      async findUnique({ where }) {
        const user = users.get(where.id)
        return user ? structuredClone(user) : null
      },
    },
  }
}

describe("fresh administrative actor access", () => {
  it("fails closed for unverified email and non-verified assignments", async () => {
    const database = createDatabase()
    assert.equal(await loadAdminActor({ prismaClient: database, sessionUserId: "unverified" }), null)
    assert.deepEqual(await loadAdminActor({ prismaClient: database, sessionUserId: "pending" }), {
      id: "pending", accountLabel: "Pending", roles: [], canReviewAnatomy: false, canEditAnatomy: false, canAdministerAccounts: false,
    })
    assert.deepEqual(await loadAdminActor({ prismaClient: database, sessionUserId: "revoked" }), {
      id: "revoked", accountLabel: "Revoked", roles: [], canReviewAnatomy: false, canEditAnatomy: false, canAdministerAccounts: false,
    })
  })

  it("normalizes legacy anatomy administration to editor capabilities", async () => {
    const actor = await loadAdminActor({ prismaClient: createDatabase(), sessionUserId: "legacy" })
    assert.deepEqual(actor, {
      id: "legacy", accountLabel: "Legacy", roles: ["ANATOMY_EDITOR"], canReviewAnatomy: true, canEditAnatomy: true, canAdministerAccounts: false,
    })
    assert.equal(highestAccountRole(["ANATOMY_ADMIN"]), "ANATOMY_EDITOR")
  })

  it("enforces the fresh reviewer, editor, and full-admin capability matrix", async () => {
    const database = createDatabase()
    const cases = [
      ["reviewer", ["ANATOMY_REVIEWER"], { review: true, edit: false, full: false }],
      ["editor", ["ANATOMY_EDITOR"], { review: true, edit: true, full: false }],
      ["legacy", ["ANATOMY_EDITOR"], { review: true, edit: true, full: false }],
      ["admin", ["ADMIN"], { review: true, edit: true, full: true }],
      ["ordinary", ["USER"], { review: false, edit: false, full: false }],
      ["pending", [], { review: false, edit: false, full: false }],
      ["revoked", [], { review: false, edit: false, full: false }],
      ["unverified", null, { review: false, edit: false, full: false }],
    ]
    const guards = [
      ["review", requireAnatomyReviewerUser],
      ["edit", requireAnatomyEditorUser],
      ["full", requireFullAdminUser],
    ]

    for (const [userId, expectedRoles, expectedAccess] of cases) {
      const actor = await loadAdminActor({ prismaClient: database, sessionUserId: userId })
      assert.deepEqual(actor?.roles ?? null, expectedRoles, `${userId} role normalization`)

      for (const [capability, guard] of guards) {
        const operation = () => guard({ prismaClient: database, sessionUserId: userId })
        if (expectedAccess[capability]) {
          const actorFromGuard = await operation()
          assert.equal(actorFromGuard.id, userId)
          assert.equal(actorFromGuard[`can${capability === "review" ? "ReviewAnatomy" : capability === "edit" ? "EditAnatomy" : "AdministerAccounts"}`], true)
        } else {
          await assert.rejects(operation)
        }
      }
    }
  })
})
