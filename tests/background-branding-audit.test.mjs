import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findRecommendedNameCollisions,
  normalizeBrandName,
  validateAuditCoverage,
  validateAuditEntry,
} from "../scripts/background-branding/audit-model.mjs"

describe("background branding audit", () => {
  it("normalizes names for case and punctuation collision checks", () => {
    assert.equal(normalizeBrandName(" Quiet-Current! "), "quiet current")
  })

  it("requires a decision, recommendation, alternatives, descriptor, and rationale", () => {
    const errors = validateAuditEntry({ id: "one" }, {
      id: "one", label: "Old", provider: "MassageLab", sourceUrl: "internal", enabled: true,
    })
    assert.deepEqual(errors, [
      "one: decision must be keep or rename",
      "one: recommendedName is required",
      "one: two or three unique alternatives are required",
      "one: visualDescriptor must contain 3-8 words",
      "one: rationale is required",
      "one: collisionNotes is required",
      "one: signatureOriginalEligible must be boolean",
    ])
  })
})
