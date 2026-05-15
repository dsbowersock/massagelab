import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FEATURE_KEYS,
} from "../lib/membership.js"
import {
  canAdministerAccounts,
  canManageClients,
  canManageAnatomyContent,
  buildAccountCapabilities,
  hasRequiredRole,
  hasVerifiedRole,
  normalizeRoleAssignments,
  normalizeRoles,
} from "../lib/account-permissions.js"

describe("Account permission helpers", () => {
  it("normalizes supported roles and drops unknown values", () => {
    assert.deepEqual(normalizeRoles(["user", "ADMIN", "licensed_therapist", "owner", "admin", null]), ["USER", "ADMIN", "LICENSED_THERAPIST"])
  })

  it("normalizes multi-role assignments with verification status", () => {
    assert.deepEqual(
      normalizeRoleAssignments([
        "user",
        { role: "licensed_therapist", status: "pending" },
        { role: "student", status: "verified" },
        { role: "owner", status: "verified" },
      ]),
      [
        { role: "USER", status: "VERIFIED" },
        { role: "LICENSED_THERAPIST", status: "PENDING" },
        { role: "STUDENT", status: "VERIFIED" },
      ],
    )
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

  it("requires verified therapist status before managing clients", () => {
    assert.equal(canManageClients([{ role: "LICENSED_THERAPIST", status: "PENDING" }]), false)
    assert.equal(canManageClients([{ role: "LICENSED_THERAPIST", status: "VERIFIED" }]), true)
    assert.equal(hasVerifiedRole([{ role: "STUDENT", status: "VERIFIED" }], "STUDENT"), true)
  })

  it("builds conservative capabilities while hosted clinical sync is disabled", () => {
    assert.deepEqual(
      buildAccountCapabilities([{ role: "LICENSED_THERAPIST", status: "VERIFIED" }], {
        hostedClinicalSyncEnabled: false,
      }),
      {
        canAdministerAccounts: false,
        canManageAnatomyContent: false,
        canManageClients: true,
        canRequestCredentials: true,
        canUseLocalClinicalTools: true,
        canUseChimerCustomColors: false,
        hostedClinicalSyncEnabled: false,
      },
    )
  })

  it("adds feature-based capabilities without checking plan names in UI code", () => {
    assert.equal(
      buildAccountCapabilities([{ role: "USER", status: "VERIFIED" }], {
        features: [FEATURE_KEYS.chimerCustomColors],
      }).canUseChimerCustomColors,
      true,
    )
  })
})
