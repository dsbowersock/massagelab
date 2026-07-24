import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  acceptedDocumentIdsFromInput,
  buildDigitalPurchaseConsent,
  hasAcceptedCurrentDocuments,
  legalRequestMetadata,
  missingRequiredLegalDocuments,
  recordLegalAcceptances,
} from "../lib/legal-acceptance.js"
import {
  buildRegistrationLegalAcceptancePath,
  buildRegistrationLegalProviderRedirectPath,
  isRegistrationLegalAcceptancePath,
  safePostLegalAcceptanceCallback,
} from "../lib/legal-acceptance-gate.js"
import { requiredLegalDocumentsForEvent } from "../lib/legal-documents.js"

function createMockDb(initialRows = []) {
  const rows = [...initialRows]

  return {
    rows,
    legalAcceptance: {
      findMany: async ({ where }) => rows.filter((row) => (
        row.userId === where.userId &&
        where.OR.some((candidate) => (
          row.documentKey === candidate.documentKey &&
          row.documentVersion === candidate.documentVersion
        ))
      )),
      upsert: async ({ where, create }) => {
        const key = where.userId_documentKey_documentVersion
        let row = rows.find((candidate) => (
          candidate.userId === key.userId &&
          candidate.documentKey === key.documentKey &&
          candidate.documentVersion === key.documentVersion
        ))

        if (!row) {
          row = { ...create, id: `acceptance_${rows.length + 1}` }
          rows.push(row)
        }

        return row
      },
    },
  }
}

describe("legal acceptance helpers", () => {
  it("captures exact current documents for one explicit per-order digital-purchase consent", () => {
    const documents = requiredLegalDocumentsForEvent("digital-purchase")
    const acceptedDocumentIds = documents.map((document) => `${document.key}:${document.version}`)
    const now = new Date("2026-07-21T16:30:00.000Z")

    assert.deepEqual(buildDigitalPurchaseConsent({
      acceptedDocumentIds,
      combinedConsentAccepted: true,
      now,
    }), {
      documentIds: acceptedDocumentIds,
      documentVersions: Object.fromEntries(documents.map((document) => [document.key, document.version])),
      combinedConsentAccepted: true,
      acceptedAt: "2026-07-21T16:30:00.000Z",
    })
  })

  it("requires a fresh combined digital-purchase consent even when account acceptances exist", () => {
    const documents = requiredLegalDocumentsForEvent("digital-purchase")
    const acceptedDocumentIds = documents.map((document) => `${document.key}:${document.version}`)

    assert.throws(
      () => buildDigitalPurchaseConsent({ acceptedDocumentIds, combinedConsentAccepted: false }),
      /digital purchase consent/i,
    )
    assert.throws(
      () => buildDigitalPurchaseConsent({ acceptedDocumentIds: acceptedDocumentIds.slice(0, -1), combinedConsentAccepted: true }),
      /digital purchase consent/i,
    )
    assert.throws(
      () => buildDigitalPurchaseConsent({
        acceptedDocumentIds: acceptedDocumentIds.map((id) => id.replace("2026-07-digital-purchases-v2", "stale")),
        combinedConsentAccepted: true,
      }),
      /digital purchase consent/i,
    )
  })

  it("normalizes accepted document ids from arrays, sets, and records", () => {
    assert.deepEqual(
      acceptedDocumentIdsFromInput(["terms:2026-06-legal-v1", "", "privacy:2026-06-legal-v1"]),
      new Set(["terms:2026-06-legal-v1", "privacy:2026-06-legal-v1"]),
    )
    assert.deepEqual(
      acceptedDocumentIdsFromInput(new Set(["terms:2026-06-legal-v1"])),
      new Set(["terms:2026-06-legal-v1"]),
    )
    assert.deepEqual(
      acceptedDocumentIdsFromInput("terms:2026-06-legal-v1"),
      new Set(["terms:2026-06-legal-v1"]),
    )
    assert.deepEqual(
      acceptedDocumentIdsFromInput({ "terms:2026-06-legal-v1": true, "privacy:2026-06-legal-v1": false }),
      new Set(["terms:2026-06-legal-v1"]),
    )
    assert.deepEqual(
      acceptedDocumentIdsFromInput({
        "terms:2026-06-legal-v1": "on",
        "privacy:2026-06-legal-v1": "true",
        "membership-billing-refunds:2026-06-legal-v1": "false",
      }),
      new Set(["terms:2026-06-legal-v1", "privacy:2026-06-legal-v1"]),
    )
  })

  it("reports missing required documents from accepted ids", () => {
    const documents = requiredLegalDocumentsForEvent("registration")

    assert.deepEqual(
      missingRequiredLegalDocuments({
        acceptedDocumentIds: new Set(["terms:2026-06-legal-v2"]),
        documents,
      }).map((document) => document.key),
      ["privacy"],
    )
  })

  it("records acceptances idempotently with request metadata", async () => {
    const db = createMockDb()
    const documents = requiredLegalDocumentsForEvent("registration")
    const metadata = { ipAddress: "203.0.113.10", userAgent: "node-test" }

    await recordLegalAcceptances({ prismaClient: db, userId: "user_1", documents, metadata })
    await recordLegalAcceptances({ prismaClient: db, userId: "user_1", documents, metadata })

    assert.equal(db.rows.length, 2)
    assert.deepEqual(db.rows.map((row) => row.documentKey).sort(), ["privacy", "terms"])
    assert.equal(db.rows[0].ipAddress, "203.0.113.10")
    assert.equal(db.rows[0].userAgent, "node-test")
  })

  it("checks current document acceptance coverage", async () => {
    const documents = requiredLegalDocumentsForEvent("checkout")
    const db = createMockDb([
      { userId: "user_1", documentKey: "membership-billing-refunds", documentVersion: "2026-06-legal-v1" },
      { userId: "user_2", documentKey: "membership-billing-refunds", documentVersion: documents[0].version },
    ])

    assert.equal(await hasAcceptedCurrentDocuments({ prismaClient: db, userId: "user_1", documents }), false)
    assert.equal(await hasAcceptedCurrentDocuments({ prismaClient: db, userId: "user_2", documents }), true)
    assert.equal(await hasAcceptedCurrentDocuments({ prismaClient: db, userId: "user_3", documents }), false)
  })

  it("extracts request metadata without query strings or bodies", () => {
    const request = new Request("https://example.test/register", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.7",
        "user-agent": "legal-test",
      },
    })

    assert.deepEqual(legalRequestMetadata(request), {
      ipAddress: "203.0.113.10",
      userAgent: "legal-test",
    })
  })

  it("normalizes post-acceptance callback paths for the signed-in legal gate", () => {
    assert.equal(safePostLegalAcceptanceCallback("/wellness"), "/wellness")
    assert.equal(safePostLegalAcceptanceCallback("/calendar/new?startsAt=2026-06-23T10%3A00"), "/calendar/new?startsAt=2026-06-23T10%3A00")
    assert.equal(safePostLegalAcceptanceCallback("https://example.com"), "/onboarding")
    assert.equal(safePostLegalAcceptanceCallback("//example.com"), "/onboarding")
    assert.equal(safePostLegalAcceptanceCallback("/legal/accept?callbackUrl=%2Fwellness"), "/onboarding")
    assert.equal(safePostLegalAcceptanceCallback("/api/account/preferences"), "/onboarding")
  })

  it("builds the signed-in registration legal acceptance route with a safe callback", () => {
    assert.equal(buildRegistrationLegalAcceptancePath("/wellness"), "/legal/accept?callbackUrl=%2Fwellness")
    assert.equal(buildRegistrationLegalAcceptancePath("//example.com"), "/legal/accept?callbackUrl=%2Fonboarding")
  })

  it("preserves an existing legal gate callback for OAuth provider redirects", () => {
    assert.equal(isRegistrationLegalAcceptancePath("/legal/accept?callbackUrl=%2Fwellness"), true)
    assert.equal(isRegistrationLegalAcceptancePath("/legal/accept/extra"), false)
    assert.equal(
      buildRegistrationLegalProviderRedirectPath("/legal/accept?callbackUrl=%2Fwellness"),
      "/legal/accept?callbackUrl=%2Fwellness",
    )
    assert.equal(buildRegistrationLegalProviderRedirectPath("/wellness"), "/legal/accept?callbackUrl=%2Fwellness")
  })
})
