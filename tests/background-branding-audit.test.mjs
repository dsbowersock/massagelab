import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findRecommendedNameCollisions,
  normalizeBrandName,
  validateAuditCoverage,
  validateAuditEntry,
} from "../scripts/background-branding/audit-model.mjs"
import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"
import { BACKGROUND_BRANDING_AUDIT_BATCHES } from "../scripts/background-branding/audit-batches.mjs"
import { renderAuditBatch } from "../scripts/background-branding/render-audit.mjs"

const validAuditEntry = {
  decision: "rename",
  recommendedName: "Current Drift",
  alternatives: ["Quiet Current", "Gentle Current"],
  visualDescriptor: "soft flowing gradient field",
  rationale: "Keeps the visual concept distinct.",
  collisionNotes: "No known collision.",
  signatureOriginalEligible: false,
}

const massageLabBrandReservationError =
  "Massage Lab-branded recommendations are reserved for the internal massage-lab-moving-gradient background named Massage Laba Lamp"

describe("background branding audit", () => {
  it("covers all 83 enabled backgrounds exactly once in review-sized batches", () => {
    const enabled = backgroundRegistry.filter(({ enabled }) => enabled)
    assert.equal(enabled.length, 83)
    assert.deepEqual(
      validateAuditCoverage({ backgrounds: enabled, entries: enabled.map(({ id }) => ({ id })), batches: BACKGROUND_BRANDING_AUDIT_BATCHES }),
      [],
    )
    for (const batch of BACKGROUND_BRANDING_AUDIT_BATCHES) {
      assert.ok(batch.ids.length >= 10 && batch.ids.length <= 15)
    }
  })

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

  it("allows the reserved Massage Laba Lamp recommendation only for its internal background", () => {
    const errors = validateAuditEntry({
      ...validAuditEntry,
      recommendedName: "Massage Laba Lamp",
    }, {
      id: "massage-lab-moving-gradient",
      label: "Old",
      provider: "MassageLab",
      sourceUrl: "internal",
      enabled: true,
    })

    assert.deepEqual(errors, [])
  })

  it("rejects the reserved recommendation for another internal background", () => {
    const errors = validateAuditEntry({
      ...validAuditEntry,
      recommendedName: "Massage Laba Lamp",
    }, {
      id: "another-internal-background",
      label: "Old",
      provider: "MassageLab",
      sourceUrl: "internal",
      enabled: true,
    })

    assert.deepEqual(errors, [`another-internal-background: ${massageLabBrandReservationError}`])
  })

  it("rejects the reserved recommendation when its source is external", () => {
    const errors = validateAuditEntry({
      ...validAuditEntry,
      recommendedName: "Massage Laba Lamp",
    }, {
      id: "massage-lab-moving-gradient",
      label: "Old",
      provider: "MassageLab",
      sourceUrl: "https://example.com/source",
      enabled: true,
    })

    assert.deepEqual(errors, [`massage-lab-moving-gradient: ${massageLabBrandReservationError}`])
  })

  it("rejects Massage Lab spacing, punctuation, and case variants on other backgrounds", () => {
    for (const recommendedName of ["Massage Lab Tide", "MassageLab Tide", "Massage-Lab Tide"]) {
      const errors = validateAuditEntry({ ...validAuditEntry, recommendedName }, {
        id: "another-internal-background",
        label: "Old",
        provider: "MassageLab",
        sourceUrl: "internal",
        enabled: true,
      })

      assert.deepEqual(errors, [`another-internal-background: ${massageLabBrandReservationError}`])
    }
  })

  it("renders the current name, decision, recommendation, alternatives, descriptor, and rationale", () => {
    const markdown = renderAuditBatch({
      batch: { slug: "sample", title: "Sample", ids: ["one"] },
      backgroundsById: new Map([["one", { id: "one", label: "Old Name" }]]),
      entriesById: new Map([["one", {
        id: "one", decision: "rename", recommendedName: "Quiet Current",
        alternatives: ["Restful Current", "Gentle Flow"],
        visualDescriptor: "Layered lines drifting in soft waves",
        rationale: "Fits the restorative voice while describing the motion.",
        collisionNotes: "Distinct from all current recommendations.",
        signatureOriginalEligible: true,
      }]]),
    })

    assert.match(markdown, /## Quiet Current/)
    assert.match(markdown, /Current name:\*\* Old Name/)
    assert.match(markdown, /Restful Current.*Gentle Flow/s)
    assert.match(markdown, /Layered lines drifting in soft waves/)
  })
})
