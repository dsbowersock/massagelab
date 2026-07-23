import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DIGITAL_PURCHASES_REFUNDS_VERSION,
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
      "digital-purchases-refunds",
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
      requiredLegalDocumentsForEvent("digital-purchase").map((document) => document.key),
      ["terms", "privacy", "digital-purchases-refunds"],
    )
    assert.deepEqual(
      requiredLegalDocumentsForEvent("professional-activation").map((document) => document.key),
      ["therapist-agreement"],
    )
  })

  it("keeps the digital-purchase policy independently versioned", () => {
    const policy = getLegalDocumentByKey("digital-purchases-refunds")

    assert.equal(DIGITAL_PURCHASES_REFUNDS_VERSION, "2026-07-digital-purchases-v2")
    assert.equal(policy.version, DIGITAL_PURCHASES_REFUNDS_VERSION)
    assert.equal(policy.route, "/legal/digital-purchases-refunds")
    assert.equal(
      legalDocumentAcceptanceId(policy),
      "digital-purchases-refunds:2026-07-digital-purchases-v2",
    )
  })

  it("states the purchaser-operated personal and practice license boundary", () => {
    const policyBody = getLegalDocumentByKey("digital-purchases-refunds")
      .sections.flatMap((section) => section.body)
      .join(" ")

    for (const expected of [
      /personal activities/,
      /own sole proprietorship or practice/,
      /Clients and staff may see/,
      /may not share account access/,
      /staff or teams to operate/,
      /redistribute, resell, or sublicense/,
      /extract or distribute its assets/,
      /package it into another product or service/,
      /unrelated third parties/,
    ]) {
      assert.match(policyBody, expected)
    }
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
