import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FEATURE_KEYS,
} from "../lib/membership.js"
import {
  canAdministerAccounts,
  canEditAnatomyContent,
  canManageClients,
  canManageAnatomyContent,
  canReviewAnatomyContent,
  buildAccountCapabilities,
  hasRequiredRole,
  hasVerifiedRole,
  highestRole,
  normalizeRoleAssignments,
  normalizeRoles,
} from "../lib/account-permissions.js"

describe("Account permission helpers", () => {
  it("normalizes supported roles and drops unknown values", () => {
    assert.deepEqual(normalizeRoles(["user", "ADMIN", "licensed_therapist", "anatomy_admin", "owner", "admin", null]), ["USER", "ADMIN", "LICENSED_THERAPIST", "ANATOMY_EDITOR"])
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

  it("requires an explicit anatomy role or admin role for anatomy administration", () => {
    assert.equal(canManageAnatomyContent(["ANATOMY_ADMIN"]), true)
    assert.equal(canManageAnatomyContent(["ADMIN"]), true)
    assert.equal(canManageAnatomyContent(["EDITOR"]), false)
    assert.equal(canAdministerAccounts(["EDITOR"]), false)
    assert.equal(canAdministerAccounts(["ANATOMY_ADMIN"]), false)
  })

  it("splits anatomy review and editing while preserving legacy editor authority", () => {
    assert.equal(canReviewAnatomyContent(["ANATOMY_REVIEWER"]), true)
    assert.equal(canReviewAnatomyContent(["ANATOMY_EDITOR"]), true)
    assert.equal(canEditAnatomyContent(["ANATOMY_REVIEWER"]), false)
    assert.equal(canEditAnatomyContent(["ANATOMY_EDITOR"]), true)
    assert.equal(canEditAnatomyContent(["ANATOMY_ADMIN"]), true)
    assert.equal(canAdministerAccounts(["ANATOMY_EDITOR"]), false)
  })

  it("keeps regular users out of anatomy administration", () => {
    assert.equal(canManageAnatomyContent(["USER"]), false)
    assert.equal(hasRequiredRole(["USER"], "EDITOR"), false)
  })

  it("requires verified therapist status before managing clients", () => {
    assert.equal(canManageClients([{ role: "LICENSED_THERAPIST", status: "PENDING" }]), false)
    assert.equal(canManageClients([{ role: "LICENSED_THERAPIST", status: "VERIFIED" }]), true)
    assert.equal(hasVerifiedRole([{ role: "STUDENT", status: "VERIFIED" }], "STUDENT"), true)
    assert.equal(hasVerifiedRole([{ role: "ANATOMY_ADMIN", status: "VERIFIED" }], "ANATOMY_ADMIN"), true)
  })

  it("excludes pending and revoked privileged assignments from effective account state", () => {
    const pendingAdmin = [{ role: "USER", status: "VERIFIED" }, { role: "ADMIN", status: "PENDING" }]
    const revokedEditor = [{ role: "USER", status: "VERIFIED" }, { role: "ANATOMY_EDITOR", status: "REVOKED" }]

    assert.equal(highestRole(pendingAdmin), "USER")
    assert.equal(highestRole(revokedEditor), "USER")
    assert.equal(buildAccountCapabilities(pendingAdmin).canAdministerAccounts, false)
    assert.equal(buildAccountCapabilities(pendingAdmin).canManageAnatomyContent, false)
    assert.equal(buildAccountCapabilities(revokedEditor).canManageAnatomyContent, false)
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
        canUseLocalClinicalTools: false,
        canUsePremiumBackgrounds: false,
        hasActiveMembershipBenefits: false,
        hostedClinicalSyncEnabled: false,
      },
    )
  })

  it("derives active membership benefits from premium backgrounds", () => {
    const capabilities = buildAccountCapabilities(
      [{ role: "USER", status: "VERIFIED" }],
      { features: [FEATURE_KEYS.premiumBackgrounds] },
    )
    assert.equal(capabilities.hasActiveMembershipBenefits, true)
    assert.equal(Object.hasOwn(capabilities, "canUseChimerCustomColors"), false)
    assert.equal(capabilities.canUsePremiumBackgrounds, true)
    assert.equal(
      buildAccountCapabilities([{ role: "LICENSED_THERAPIST", status: "VERIFIED" }], {
        features: [FEATURE_KEYS.therapistDocumentationTools],
      }).hasActiveMembershipBenefits,
      true,
    )
  })
})
