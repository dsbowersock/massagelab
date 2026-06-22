import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildProblemReportSentryPayload,
  classifyProblemReportRoute,
  getSafeBrowserHint,
  normalizeLinkedSentryEventId,
  normalizeProblemReportPath,
} from "../lib/problem-report.js"

describe("privacy-safe problem reports", () => {
  it("strips query strings and fragments before route classification", () => {
    assert.equal(
      normalizeProblemReportPath("https://massagelab.app/notes/soap?client=Jane#pain-map"),
      "/notes/soap",
    )
    assert.deepEqual(classifyProblemReportRoute("/notes/soap?client=Jane#pain-map"), {
      area: "professional-records",
      safePath: "/notes/[local-first]",
      privacyLevel: "local-first-phi-capable",
    })
  })

  it("coarsens PHI-capable, wellness, booking, and game-code routes", () => {
    assert.deepEqual(classifyProblemReportRoute("/wellness?entry=neck-pain"), {
      area: "wellness",
      safePath: "/wellness/[self-tracking]",
      privacyLevel: "consumer-health",
    })
    assert.deepEqual(classifyProblemReportRoute("/book/dana-massage?email=person@example.com"), {
      area: "booking",
      safePath: "/book/[practice]",
      privacyLevel: "scheduling-contact",
    })
    assert.deepEqual(classifyProblemReportRoute("/anatomime/play/ABC123"), {
      area: "anatomime",
      safePath: "/anatomime/play/[code]",
      privacyLevel: "public-study",
    })
  })

  it("builds a Sentry payload from enums and ignores freeform or sensitive caller fields", () => {
    const payload = buildProblemReportSentryPayload({
      category: "page-error",
      area: "notes-professional-records",
      route: "/notes/intake?client=Jane",
      linkedEventId: "1234567890abcdef1234567890ABCDEF",
      message: "Jane Smith reported shoulder pain after a car accident.",
      email: "jane@example.com",
      clientContext: {
        displayMode: "standalone",
        online: false,
        viewportWidth: 375,
      },
      userAgent: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36",
    })
    const serialized = JSON.stringify(payload)

    assert.equal(payload.message, "MassageLab privacy-safe problem report")
    assert.equal(payload.tags["ml.report.category"], "page-error")
    assert.equal(payload.contexts.problemReport.safePath, "/notes/[local-first]")
    assert.equal(payload.contexts.problemReport.privacyLevel, "local-first-phi-capable")
    assert.equal(payload.contexts.problemReport.linkedEventId, "1234567890abcdef1234567890abcdef")
    assert.equal(payload.contexts.problemReport.browser, "chrome")
    assert.equal(payload.contexts.problemReport.network, "offline")
    assert.equal(payload.contexts.problemReport.viewport, "small")
    assert.doesNotMatch(serialized, /Jane|shoulder|accident|jane@example.com|client=Jane/i)
  })

  it("falls back to known safe values for unknown report categories and event ids", () => {
    const payload = buildProblemReportSentryPayload({
      category: "freeform problem with dana@example.com",
      route: "/support",
      linkedEventId: "not-a-sentry-event",
      clientContext: {
        displayMode: "weird",
        online: "yes",
        viewportWidth: -1,
      },
    })

    assert.equal(payload.contexts.problemReport.category, "action-failed")
    assert.equal(payload.contexts.problemReport.safePath, "/support")
    assert.equal(payload.contexts.problemReport.displayMode, "unknown")
    assert.equal(payload.contexts.problemReport.network, "unknown")
    assert.equal(payload.contexts.problemReport.viewport, "unknown")
    assert.equal("linkedEventId" in payload.contexts.problemReport, false)
  })

  it("normalizes browser hints and Sentry event ids", () => {
    assert.equal(getSafeBrowserHint("Mozilla/5.0 Edg/120.0"), "edge")
    assert.equal(getSafeBrowserHint("Mozilla/5.0 Firefox/120.0"), "firefox")
    assert.equal(normalizeLinkedSentryEventId(" ABCDEFabcdef12345678901234567890 "), "abcdefabcdef12345678901234567890")
    assert.equal(normalizeLinkedSentryEventId("abc"), undefined)
  })
})
