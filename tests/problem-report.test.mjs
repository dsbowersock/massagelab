import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sanitizeSentryEvent } from "../lib/sentry-privacy.js"
import {
  buildProblemReportSentryPayload,
  classifyProblemReportRoute,
  getSafeBrowserHint,
  normalizeLinkedSentryEventId,
  normalizeProblemReportPath,
  PROBLEM_REPORT_AREAS,
  PROBLEM_REPORT_CATEGORIES,
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

  it("survives the final Sentry sanitizer without gaining identity or behavior data", () => {
    const payload = buildProblemReportSentryPayload({
      category: "page-error",
      area: "chimer-clock",
      route: "/chimer?background=dna",
      userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
    })
    const event = sanitizeSentryEvent({
      message: payload.message,
      tags: payload.tags,
      contexts: payload.contexts,
      user: { id: "must-not-survive" },
    })

    assert.equal("user" in event, false)
    assert.equal(event.tags["ml.report.area"], "timer")
    assert.equal(event.contexts.problemReport.safePath, "/timer")
  })

  it("preserves every declared problem-report taxonomy value through final sanitization", () => {
    for (const category of PROBLEM_REPORT_CATEGORIES) {
      const payload = buildProblemReportSentryPayload({ category: category.id })
      const event = sanitizeSentryEvent({ contexts: payload.contexts })

      assert.equal(event.contexts.problemReport.category, category.id)
    }

    for (const area of PROBLEM_REPORT_AREAS) {
      const payload = buildProblemReportSentryPayload({ area: area.id })
      const event = sanitizeSentryEvent({ contexts: payload.contexts })

      assert.deepEqual(event.contexts.problemReport, payload.contexts.problemReport)
    }
  })

  it("accepts only the exact enum domain for each problem-report context key", () => {
    const allowedValues = {
      area: [
        "unknown", "home", "professional-records", "wellness", "booking", "calendar",
        "calendar-booking", "account-billing", "api", "admin-anatomy", "admin", "anatomime",
        "education", "timer", "music", "public-page",
      ],
      browser: ["edge", "firefox", "chrome-ios", "chrome", "safari", "unknown"],
      category: PROBLEM_REPORT_CATEGORIES.map(({ id }) => id),
      displayMode: ["browser", "standalone", "fullscreen", "minimal-ui", "unknown"],
      network: ["online", "offline", "unknown"],
      privacyLevel: [
        "unknown", "public", "local-first-phi-capable", "consumer-health",
        "scheduling-contact", "account-private", "server-route", "admin-private",
        "public-study", "public-tool",
      ],
      selectedArea: PROBLEM_REPORT_AREAS.map(({ id }) => id),
      viewport: ["small", "medium", "large", "unknown"],
    }

    for (const [key, values] of Object.entries(allowedValues)) {
      for (const value of values) {
        const event = sanitizeSentryEvent({ contexts: { problemReport: { [key]: value } } })
        assert.equal(event.contexts.problemReport[key], value, `${key} should retain ${value}`)
      }
    }

    const event = sanitizeSentryEvent({
      contexts: {
        problemReport: {
          area: "user_123",
          browser: "opera",
          category: "secret-category",
          displayMode: "embedded",
          network: "wifi",
          privacyLevel: "private",
          selectedArea: "client_123",
          viewport: "retina",
          safePath: "/account/user_123?email=person@example.com",
          linkedEventId: "not-a-sentry-event-id",
        },
      },
    })

    assert.equal("problemReport" in event.contexts, false)
    assert.doesNotMatch(JSON.stringify(event), /person@example\.com|user_123|client_123/i)
  })

  it("preserves every exact coarse problem-report route enum idempotently", () => {
    const safePaths = new Set([
      ...PROBLEM_REPORT_AREAS.map(({ safePath }) => safePath),
      "/", "/book/[practice]", "/calendar/[workspace]", "/account-or-auth", "/api/[route]",
      "/admin/[route]", "/anatomime/play/[code]", "/education/flashcards/decks/[slug]",
      "/public/[route]", "/about", "/about/[route]", "/breathe", "/breathe/[route]",
      "/legal", "/legal/[route]", "/pricing", "/pricing/[route]", "/roadmap",
      "/roadmap/[route]", "/support", "/support/[route]", "/tools", "/tools/[route]",
    ])

    for (const safePath of safePaths) {
      const event = sanitizeSentryEvent({ contexts: { problemReport: { safePath } } })
      assert.equal(event.contexts.problemReport.safePath, safePath)
    }
  })
})
