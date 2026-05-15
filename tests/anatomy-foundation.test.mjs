import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ANATOMY_FOUNDATION_SEED,
  findClientTermMapping,
  getAnatomyFoundationSummary,
  validateAnatomyFoundation,
} from "../lib/anatomy-foundation.js"

describe("Anatomy data foundation", () => {
  it("keeps the initial anatomy foundation internally valid", () => {
    assert.deepEqual(validateAnatomyFoundation(), [])

    const summary = getAnatomyFoundationSummary()
    assert.ok(summary.bodyRegions >= 2)
    assert.ok(summary.bodySubregions >= 4)
    assert.ok(summary.muscles >= 6)
    assert.ok(summary.bones >= 4)
    assert.ok(summary.joints >= 3)
    assert.ok(summary.ligaments >= 3)
    assert.ok(summary.nerves >= 4)
    assert.ok(summary.actions >= 6)
    assert.ok(summary.rangesOfMotion >= 4)
    assert.ok(summary.painMapRegions >= 4)
    assert.ok(summary.clientTerms >= 12)
  })

  it("uses stable slugs and models rich relationships without requiring diagnosis", () => {
    const term = findClientTermMapping("knot by shoulder blade")

    assert.equal(term?.slug, "knot-by-shoulder-blade")
    assert.equal(term?.clinicalUse, "non-diagnostic")
    assert.ok(term?.likelyRegions.includes("subregion-scapular-region"))
    assert.ok(term?.likelyStructures.includes("muscle-levator-scapulae"))
    assert.ok(term?.likelyStructures.includes("muscle-rhomboid-major"))
    assert.equal(term?.therapistPrompt, "Use as a conversation starter, then choose clinically relevant structures from assessment findings.")
  })

  it("supports muscle action roles including concentric, eccentric, reverse, and isometric actions", () => {
    const trapezius = ANATOMY_FOUNDATION_SEED.muscles.find((muscle) => muscle.slug === "trapezius")
    const roles = new Set(trapezius?.actions.map((action) => action.role))

    assert.ok(roles.has("primary"))
    assert.ok(roles.has("secondary"))
    assert.ok(roles.has("concentric"))
    assert.ok(roles.has("eccentric"))
    assert.ok(roles.has("reverse"))
    assert.ok(roles.has("isometric"))
  })

  it("connects joints to bones, ligaments, actions, and sourced range-of-motion values", () => {
    const cervicalSpine = ANATOMY_FOUNDATION_SEED.joints.find((joint) => joint.slug === "cervical-spine")
    const cervicalRom = ANATOMY_FOUNDATION_SEED.rangesOfMotion.filter((range) => range.joint === "joint-cervical-spine")

    assert.ok(cervicalSpine?.bones.includes("bone-cervical-vertebrae"))
    assert.ok(cervicalSpine?.ligaments.includes("ligament-nuchal-ligament"))
    assert.ok(cervicalSpine?.actions.includes("action-cervical-rotation"))
    assert.ok(cervicalRom.some((range) => range.action === "action-cervical-rotation" && range.typicalDegrees === 80))
    assert.ok(cervicalRom.every((range) => range.sourceRef === "future-clinical-citation-needed"))
  })
})
