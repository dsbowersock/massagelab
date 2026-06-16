import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  CLIENT_WELLNESS_CATEGORIES,
  calculateRomAngleDelta,
  clientWellnessExportFilename,
  normalizeClientWellnessCustomTerms,
  normalizeClientWellnessEntryInput,
  sanitizeClientWellnessLogMetadata,
} from "../lib/client-wellness.js"

describe("Client wellness helpers", () => {
  it("defines the first supported client-owned wellness categories", () => {
    assert.deepEqual(CLIENT_WELLNESS_CATEGORIES, [
      "body_sensation",
      "emotion",
      "rom",
      "sleep",
      "activity",
      "work_context",
      "home_care",
      "incident",
    ])
  })

  it("normalizes a client wellness quick-log payload", () => {
    const payload = normalizeClientWellnessEntryInput({
      category: "body_sensation",
      occurredAt: "2026-06-16T14:30:00-04:00",
      timezone: "America/New_York",
      summary: "  Neck felt tight after computer work.  ",
      intensity: "12",
      regions: ["neck", "neck", "", 42, "right shoulder"],
      sensations: ["tight", "achy"],
      contexts: ["desk", "work"],
      source: "quick-log",
      metadata: {
        draftId: "draft-1",
        rawNote: "do not preserve arbitrary note-like keys",
        rom: { movement: "neck rotation" },
      },
    }, new Date("2026-06-16T18:00:00.000Z"))

    assert.equal(payload.category, "body_sensation")
    assert.equal(payload.occurredAt.toISOString(), "2026-06-16T18:30:00.000Z")
    assert.equal(payload.timezone, "America/New_York")
    assert.equal(payload.summary, "Neck felt tight after computer work.")
    assert.equal(payload.intensity, 10)
    assert.deepEqual(payload.regions, ["neck", "right shoulder"])
    assert.deepEqual(payload.sensations, ["tight", "achy"])
    assert.deepEqual(payload.contexts, ["desk", "work"])
    assert.equal(payload.source, "quick-log")
    assert.deepEqual(payload.metadata, { draftId: "draft-1" })
  })

  it("falls back to safe defaults for invalid values", () => {
    const payload = normalizeClientWellnessEntryInput({
      category: "unsupported",
      occurredAt: "not a date",
      timezone: "",
      summary: "x".repeat(600),
      intensity: "-4",
      source: "",
    }, new Date("2026-06-16T12:00:00.000Z"))

    assert.equal(payload.category, "body_sensation")
    assert.equal(payload.occurredAt.toISOString(), "2026-06-16T12:00:00.000Z")
    assert.equal(payload.timezone, "America/New_York")
    assert.equal(payload.summary.length, 500)
    assert.equal(payload.intensity, 0)
    assert.equal(payload.source, "manual")
  })

  it("normalizes ROM metadata while dropping arbitrary sensitive values", () => {
    const payload = normalizeClientWellnessEntryInput({
      category: "rom",
      source: "device-orientation",
      metadata: {
        movement: "neck rotation",
        side: "left",
        axis: "beta",
        baselineAngle: "12.25",
        endAngle: "58.74",
        changeDegrees: "46.49",
        rawSummary: "contains the user's private narrative",
      },
    }, new Date("2026-06-16T12:00:00.000Z"))

    assert.deepEqual(payload.metadata, {
      movement: "neck rotation",
      side: "left",
      axis: "beta",
      baselineAngle: 12.3,
      endAngle: 58.7,
      changeDegrees: 46.5,
    })
  })

  it("normalizes body sensation detail metadata while dropping arbitrary sensitive values", () => {
    const payload = normalizeClientWellnessEntryInput({
      category: "body_sensation",
      metadata: {
        durationMinutes: "45",
        bodyPosition: "sitting",
        activityContext: "typing at laptop",
        movementEffect: "worse",
        privateNarrative: "do not copy this into metadata",
      },
    }, new Date("2026-06-16T12:00:00.000Z"))

    assert.deepEqual(payload.metadata, {
      durationMinutes: 45,
      bodyPosition: "sitting",
      activityContext: "typing at laptop",
      movementEffect: "worse",
    })
  })

  it("normalizes private custom sensation terms for user-owned suggestions", () => {
    assert.deepEqual(normalizeClientWellnessCustomTerms([
      "  Zingy ",
      "zingy",
      "",
      42,
      "x".repeat(120),
    ]), [
      "Zingy",
      "x".repeat(80),
    ])

    assert.deepEqual(normalizeClientWellnessCustomTerms("sharp, sharp, pins and needles"), [
      "sharp",
      "pins and needles",
    ])
  })

  it("builds stable export filenames without leaking user labels", () => {
    assert.equal(
      clientWellnessExportFilename("Jane Example", new Date("2026-06-16T12:00:00.000Z")),
      "massagelab-wellness-2026-06-16.json",
    )
  })

  it("sanitizes log metadata to counts and non-sensitive status values only", () => {
    assert.deepEqual(sanitizeClientWellnessLogMetadata({
      action: "create",
      category: "emotion",
      status: "saved",
      entryCount: 2,
      summary: "private note",
      regions: ["neck"],
    }), {
      action: "create",
      category: "emotion",
      status: "saved",
      entryCount: 2,
    })
    assert.equal(sanitizeClientWellnessLogMetadata({ action: "list", status: "error" }).action, "list")
  })

  it("calculates ROM deltas across alpha rotation wrap-around", () => {
    assert.equal(calculateRomAngleDelta("alpha", 10, 350), 20)
    assert.equal(calculateRomAngleDelta("alpha", 350, 10), -20)
    assert.equal(calculateRomAngleDelta("beta", 10, 350), -340)
    assert.equal(calculateRomAngleDelta("alpha", "not a number", 10), 0)
  })
})

describe("Client wellness Prisma model guardrails", () => {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")

  it("defines owner-scoped wellness storage models", () => {
    assert.match(schema, /model ClientWellnessEntry \{/)
    assert.match(schema, /model ClientWellnessPreference \{/)
    assert.match(schema, /model ClientWellnessVocabularySuggestion \{/)
    assert.match(schema, /userId\s+String/)
    assert.match(schema, /deletedAt\s+DateTime\?/)
    assert.match(schema, /@@index\(\[userId, occurredAt\]\)/)
    assert.match(schema, /@@index\(\[userId, category, occurredAt\]\)/)
    assert.match(schema, /@@index\(\[userId, deletedAt\]\)/)
  })

  it("keeps first-slice wellness records out of therapist and practice ownership", () => {
    const wellnessSchema = schema.slice(schema.indexOf("model ClientWellnessEntry"), schema.indexOf("model ClientWellnessVocabularySuggestion"))

    assert.equal(/therapistId|practiceId|TherapistClientRelationship|PracticeClient/.test(wellnessSchema), false)
  })
})

describe("Client wellness server action guardrails", () => {
  const actionsSourcePath = new URL("../app/wellness/actions.ts", import.meta.url)

  it("requires a signed-in user before wellness entry actions can persist data", () => {
    const source = readFileSync(actionsSourcePath, "utf8")

    assert.match(source, /getCurrentSession/)
    assert.match(source, /session\?\.user\?\.id/)
    assert.match(source, /sign-in-required/)
  })

  it("filters every wellness entry query by the current user id", () => {
    const source = readFileSync(actionsSourcePath, "utf8")

    assert.match(source, /createClientWellnessEntryAction/)
    assert.match(source, /listClientWellnessEntriesAction/)
    assert.match(source, /deleteClientWellnessEntryAction/)
    assert.match(source, /exportClientWellnessEntriesAction/)
    assert.match(source, /updateClientWellnessPreferenceAction/)
    assert.match(source, /normalizeClientWellnessCustomTerms/)
    assert.match(source, /customSensations/)
    assert.match(source, /clientWellnessVocabularySuggestion\.findMany/)
    assert.match(source, /clientWellnessVocabularySuggestion\.createMany/)
    assert.match(source, /clientWellnessVocabularySuggestion\.createMany\(\{[\s\S]*?status:\s*"PRIVATE"/)
    assert.doesNotMatch(source, /clientWellnessVocabularySuggestion\.(findMany|createMany)\(\{[\s\S]*?status:\s*"APPROVED"/)
    assert.match(source, /userId,\s*deletedAt:\s*null/)
    const privateSuggestionWhere = source.match(/clientWellnessVocabularySuggestion\.findMany\(\{[\s\S]*?where:\s*\{([\s\S]*?)\}\s*,\s*select:/)?.[1] ?? ""
    assert.match(privateSuggestionWhere, /\buserId\b/)
    assert.match(privateSuggestionWhere, /\bcategory\b/)
    assert.match(privateSuggestionWhere, /status:\s*"PRIVATE"/)
    assert.match(source, /where:\s*\{\s*id,\s*userId,\s*deletedAt:\s*null\s*\}/s)
    assert.doesNotMatch(source, /practiceId|therapistId/)
  })

  it("keeps server action logging sanitized", () => {
    const source = readFileSync(actionsSourcePath, "utf8")

    assert.match(source, /sanitizeClientWellnessLogMetadata/)
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*summary/)
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*regions/)
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*sensations/)
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*contexts/)
  })
})
