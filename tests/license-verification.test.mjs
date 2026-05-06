import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  roleStatusForCredentialStatus,
  shouldUpdateCredentialRole,
} from "../lib/credential-verification-roles.js"
import {
  US_MASSAGE_JURISDICTIONS,
  findMassageJurisdiction,
  getJurisdictionVerificationPlan,
  normalizeJurisdictionCode,
} from "../lib/license-verification.js"

describe("License verification registry", () => {
  it("normalizes state codes and includes every US state plus DC", () => {
    assert.equal(normalizeJurisdictionCode(" oh "), "OH")
    assert.equal(US_MASSAGE_JURISDICTIONS.length, 51)
  })

  it("marks Ohio as adapter-backed", () => {
    const ohio = findMassageJurisdiction("oh")

    assert.equal(ohio?.jurisdictionName, "Ohio")
    assert.equal(ohio?.supportStatus, "ADAPTER_AVAILABLE")
    assert.match(ohio?.lookupUrl ?? "", /elicense\.ohio\.gov/)
  })

  it("falls back to manual review for states without adapters", () => {
    const plan = getJurisdictionVerificationPlan("CA")

    assert.equal(plan.supported, true)
    assert.equal(plan.supportStatus, "MANUAL_REVIEW_REQUIRED")
    assert.equal(plan.sourceType, "MANUAL_REVIEW")
  })
})

describe("Credential role verification behavior", () => {
  it("maps credential results to role states without granting rejected capabilities", () => {
    assert.equal(roleStatusForCredentialStatus("VERIFIED"), "VERIFIED")
    assert.equal(roleStatusForCredentialStatus("PENDING"), "PENDING")
    assert.equal(roleStatusForCredentialStatus("REJECTED"), "UNVERIFIED")
  })

  it("promotes verified credentials but does not downgrade an existing verified role on a failed retry", () => {
    assert.equal(shouldUpdateCredentialRole("PENDING", "VERIFIED"), true)
    assert.equal(shouldUpdateCredentialRole("UNVERIFIED", "PENDING"), true)
    assert.equal(shouldUpdateCredentialRole("VERIFIED", "REJECTED"), false)
  })
})
