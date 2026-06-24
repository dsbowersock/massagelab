import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LEGAL_DOCUMENT_KEYS,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_DOCUMENTS,
  getLegalDocumentByKey,
  getLegalDocumentBySlug,
  legalDocumentAcceptanceId,
  requiredLegalDocumentsForEvent,
} from "../lib/legal-documents.js"

describe("legal document registry", () => {
  it("defines the Branch 1 legal documents with one version source", () => {
    assert.equal(LEGAL_DOCUMENT_VERSION, "2026-06-legal-v2")
    assert.deepEqual(LEGAL_DOCUMENT_KEYS, [
      "terms",
      "privacy",
      "membership-billing-refunds",
      "therapist-agreement",
      "cookies",
      "local-first-health-wellness-data",
    ])
    assert.equal(LEGAL_DOCUMENTS.length, LEGAL_DOCUMENT_KEYS.length)
  })

  it("resolves legal documents by key and slug", () => {
    const terms = getLegalDocumentByKey("terms")
    const privacy = getLegalDocumentBySlug("privacy")

    assert.equal(terms.label, "Terms of Service")
    assert.equal(terms.route, "/legal/terms")
    assert.equal(privacy.key, "privacy")
    assert.equal(privacy.version, LEGAL_DOCUMENT_VERSION)
    assert.equal(legalDocumentAcceptanceId(terms), "terms:2026-06-legal-v2")
  })

  it("maps acceptance events to the required current documents", () => {
    assert.deepEqual(
      requiredLegalDocumentsForEvent("registration").map((document) => document.key),
      ["terms", "privacy"],
    )
    assert.deepEqual(
      requiredLegalDocumentsForEvent("checkout").map((document) => document.key),
      ["membership-billing-refunds"],
    )
    assert.deepEqual(
      requiredLegalDocumentsForEvent("professional-activation").map((document) => document.key),
      ["therapist-agreement"],
    )
  })

  it("states the no-ads/data-sale posture and one-time support boundary", () => {
    const privacyBody = getLegalDocumentByKey("privacy")
      .sections.flatMap((section) => section.body)
      .join(" ")
    const billingBody = getLegalDocumentByKey("membership-billing-refunds")
      .sections.flatMap((section) => section.body)
      .join(" ")

    assert.match(privacyBody, /does not sell user data/)
    assert.match(privacyBody, /does not use advertising/)
    assert.match(billingBody, /One-time support payments do not create a membership/)
  })
})
