import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ANATOMY_FOUNDATION_SEED } from "../lib/anatomy-foundation.js"
import {
  getMblexCoverageAudit,
  MBLEX_CONTENT_OUTLINE_SOURCE,
} from "../lib/mblex-content-outline.js"

describe("MBLEx anatomy and physiology coverage audit", () => {
  it("tracks the FSMTB MBLEx outline as an internal reference source, not reusable display copy", () => {
    const source = ANATOMY_FOUNDATION_SEED.sources.find((entry) => entry.slug === MBLEX_CONTENT_OUTLINE_SOURCE.slug)

    assert.equal(source?.usageScope, "internal_reference")
    assert.match(source?.url ?? "", /fsmtb\.org/)
    assert.match(source?.notes ?? "", /Do not reuse FSMTB outline wording/)
  })

  it("audits Anatomy & Physiology system coverage against the MBLEx outline", () => {
    const audit = getMblexCoverageAudit(ANATOMY_FOUNDATION_SEED)
    const anatomyPhysiology = audit.requirements.filter((requirement) => requirement.domainSlug === "anatomy-physiology")
    const bySlug = new Map(anatomyPhysiology.map((requirement) => [requirement.slug, requirement]))

    assert.equal(audit.domains.find((domain) => domain.slug === "anatomy-physiology")?.examWeightPercent, 11)
    assert.ok(bySlug.has("ap-system-structure-cardiovascular"))
    assert.ok(bySlug.has("ap-system-function-digestive"))
    assert.ok(bySlug.has("ap-tissue-injury-repair"))
    assert.ok(bySlug.has("ap-energetic-anatomy"))

    assert.equal(bySlug.get("ap-system-structure-musculoskeletal")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-cardiovascular")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-cardiovascular")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-digestive")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-digestive")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-endocrine")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-endocrine")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-integumentary")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-integumentary")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-lymphatic-immune")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-lymphatic-immune")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-reproduction")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-reproduction")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-sensory")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-sensory")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-respiratory")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-respiratory")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-urinary")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-urinary")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-structure-nervous")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-nervous")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-system-function-musculoskeletal")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-tissue-injury-repair")?.status, "strong_foundation")
    assert.equal(bySlug.get("ap-energetic-anatomy")?.status, "partial")
  })

  it("audits Kinesiology coverage and identifies the next data batches", () => {
    const audit = getMblexCoverageAudit(ANATOMY_FOUNDATION_SEED)
    const kinesiology = audit.requirements.filter((requirement) => requirement.domainSlug === "kinesiology")
    const bySlug = new Map(kinesiology.map((requirement) => [requirement.slug, requirement]))

    assert.equal(audit.domains.find((domain) => domain.slug === "kinesiology")?.examWeightPercent, 12)
    assert.equal(bySlug.get("kin-muscle-locations-attachments-actions")?.status, "strong_foundation")
    assert.equal(bySlug.get("kin-joint-structure-function")?.status, "strong_foundation")
    assert.equal(bySlug.get("kin-skeletal-muscle-components")?.status, "strong_foundation")
    assert.equal(bySlug.get("kin-skeletal-muscle-contractions")?.status, "strong_foundation")
    assert.equal(bySlug.get("kin-proprioceptors")?.status, "strong_foundation")
    assert.equal(bySlug.get("kin-range-of-motion-active-passive-resisted")?.status, "strong_foundation")

    assert.ok(audit.nextBatches.some((batch) => batch.slug === "physiology-concepts-core"))
    assert.ok(audit.nextBatches.some((batch) => batch.slug === "cardiorespiratory-lymphatic-systems"))
    assert.ok(audit.nextBatches.some((batch) => batch.slug === "remaining-ap-body-systems"))
  })

  it("summarizes coverage without overstating MBLEx readiness", () => {
    const audit = getMblexCoverageAudit(ANATOMY_FOUNDATION_SEED)

    assert.ok(audit.summary.strongFoundation >= 29)
    assert.ok(audit.summary.partial > 0)
    assert.equal(audit.summary.missing, 0)
    assert.ok(audit.summary.strongFoundation > audit.summary.partial)
    assert.ok(!audit.summary.missingRequirementSlugs.includes("kin-proprioceptors"))
    assert.ok(!audit.summary.missingRequirementSlugs.includes("ap-system-function-urinary"))
    assert.ok(!audit.summary.missingRequirementSlugs.includes("ap-energetic-anatomy"))
  })

  it("does not use stale partial-coverage wording for strong MBLEx foundations", () => {
    const audit = getMblexCoverageAudit(ANATOMY_FOUNDATION_SEED)
    const staleCoverageLanguage = /starter|not yet modeled|not modeled|partially represented/i

    for (const requirement of audit.requirements.filter((entry) => entry.status === "strong_foundation")) {
      assert.doesNotMatch(requirement.evidence.join(" "), staleCoverageLanguage, `${requirement.slug} has stale evidence text`)
    }
  })
})
