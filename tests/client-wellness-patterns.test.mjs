import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildClientWellnessPatternReport,
  clientWellnessReportFilename,
} from "../lib/client-wellness-patterns.js"

const now = new Date("2026-06-16T16:00:00.000Z")

function entry(overrides = {}) {
  return {
    id: overrides.id ?? "entry",
    category: overrides.category ?? "body_sensation",
    occurredAt: overrides.occurredAt ?? "2026-06-16T14:00:00.000Z",
    timezone: overrides.timezone ?? "America/New_York",
    summary: overrides.summary ?? null,
    intensity: Object.hasOwn(overrides, "intensity") ? overrides.intensity : 5,
    regions: overrides.regions ?? [],
    sensations: overrides.sensations ?? [],
    contexts: overrides.contexts ?? [],
    source: overrides.source ?? "quick-log",
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? "2026-06-16T14:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-16T14:00:00.000Z",
    persisted: overrides.persisted ?? true,
  }
}

describe("Client wellness pattern reports", () => {
  it("builds bounded report windows and top tracking signals", () => {
    const report = buildClientWellnessPatternReport([
      entry({ id: "neck-1", regions: ["neck"], sensations: ["tight"], contexts: ["desk"], intensity: 7 }),
      entry({ id: "neck-2", regions: ["neck"], sensations: ["tight"], contexts: ["desk"], intensity: 5 }),
      entry({ id: "sleep-1", category: "sleep", contexts: ["sleep"], intensity: 3 }),
      entry({ id: "old", occurredAt: "2026-05-01T12:00:00.000Z", regions: ["hip"], contexts: ["travel"] }),
    ], now)

    assert.equal(report.entryCount, 4)
    assert.deepEqual(report.windows.map((window) => [window.id, window.entryCount]), [["7d", 3], ["30d", 3]])
    assert.deepEqual(report.topRegions[0], { label: "neck", count: 2 })
    assert.deepEqual(report.topSensations[0], { label: "tight", count: 2 })
    assert.deepEqual(report.topContexts[0], { label: "desk", count: 2 })
    assert.equal(report.averageIntensity, 5)
  })

  it("excludes entries with missing intensity from the average", () => {
    const report = buildClientWellnessPatternReport([
      entry({ id: "sensation", intensity: 8 }),
      entry({ id: "rom", category: "rom", intensity: null, metadata: { movement: "neck rotation", changeDegrees: 40 } }),
      entry({ id: "empty-intensity", intensity: "" }),
    ], now)

    assert.equal(report.averageIntensity, 8)
  })

  it("creates non-diagnostic confidence-labeled prompts from repeated signals", () => {
    const report = buildClientWellnessPatternReport([
      entry({ id: "desk-neck-1", regions: ["neck"], contexts: ["desk"], sensations: ["tight"] }),
      entry({ id: "desk-neck-2", regions: ["neck"], contexts: ["desk"], sensations: ["tight"] }),
      entry({ id: "desk-neck-3", regions: ["neck"], contexts: ["desk"], sensations: ["achy"] }),
    ], now)

    assert.equal(report.patternPrompts[0].confidence, "moderate")
    assert.match(report.patternPrompts[0].title, /Neck/i)
    assert.match(report.patternPrompts[0].detail, /desk/i)
    assert.doesNotMatch(report.patternPrompts.map((prompt) => prompt.detail).join(" "), /cause|diagnosis|normal|abnormal/i)
  })

  it("summarizes repeated ROM movement deltas as tracking references", () => {
    const report = buildClientWellnessPatternReport([
      entry({ id: "rom-1", category: "rom", metadata: { movement: "neck rotation", changeDegrees: 35 }, occurredAt: "2026-06-14T12:00:00.000Z" }),
      entry({ id: "rom-2", category: "rom", metadata: { movement: "neck rotation", changeDegrees: 42 }, occurredAt: "2026-06-16T12:00:00.000Z" }),
    ], now)

    assert.deepEqual(report.romMovements[0], {
      movement: "neck rotation",
      entryCount: 2,
      latestDegrees: 42,
      previousDegrees: 35,
      changeSincePrevious: 7,
    })
  })

  it("builds report filenames without user labels", () => {
    assert.equal(clientWellnessReportFilename(new Date("2026-06-16T12:00:00.000Z")), "massagelab-wellness-report-2026-06-16.json")
  })
})
