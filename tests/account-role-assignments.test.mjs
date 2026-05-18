import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { normalizeSessionRoleAssignments } from "../lib/account-role-assignments.js"

describe("normalizeSessionRoleAssignments", () => {
  it("prefers explicit role assignments over roles and legacy role", () => {
    const roleAssignments = [{ role: "ADMIN", status: "PENDING" }]

    assert.deepEqual(
      normalizeSessionRoleAssignments({
        roleAssignments,
        roles: ["THERAPIST"],
        role: "USER",
      }),
      [{ role: "ADMIN", status: "PENDING" }],
    )
    assert.notEqual(
      normalizeSessionRoleAssignments({ roleAssignments }),
      roleAssignments,
    )
  })

  it("falls back to verified roles before the legacy role", () => {
    assert.deepEqual(
      normalizeSessionRoleAssignments({
        roles: ["THERAPIST", "STUDENT"],
        role: "USER",
      }),
      [
        { role: "THERAPIST", status: "VERIFIED" },
        { role: "STUDENT", status: "VERIFIED" },
      ],
    )
  })

  it("falls back to legacy role and then verified user", () => {
    assert.deepEqual(normalizeSessionRoleAssignments({ role: "ADMIN" }), [
      { role: "ADMIN", status: "VERIFIED" },
    ])
    assert.deepEqual(normalizeSessionRoleAssignments(undefined), [
      { role: "USER", status: "VERIFIED" },
    ])
  })
})
