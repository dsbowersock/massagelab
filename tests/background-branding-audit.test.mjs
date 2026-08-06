import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  findRecommendedNameCollisions,
  normalizeBrandName,
  validateAuditCoverage,
  validateAuditEntry,
} from "../scripts/background-branding/audit-model.mjs"
import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"
import { BACKGROUND_BRANDING_AUDIT_BATCHES } from "../scripts/background-branding/audit-batches.mjs"
import {
  generateAuditFiles,
  renderAuditBatch,
  renderAuditIndex,
} from "../scripts/background-branding/render-audit.mjs"

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
  it("covers all 84 enabled backgrounds exactly once in review-sized batches", () => {
    const enabled = backgroundRegistry.filter(({ enabled }) => enabled)
    assert.equal(enabled.length, 84)
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

  it("finds recommendation collisions after name normalization", () => {
    assert.deepEqual(findRecommendedNameCollisions([
      { id: "one", recommendedName: "Quiet-Current!" },
      { id: "two", recommendedName: " quiet current " },
      { id: "three", recommendedName: "Gentle Flow" },
    ]), [
      { normalized: "quiet current", ids: ["one", "two"] },
    ])
  })

  it("reports duplicate, missing, and unknown-or-disabled coverage IDs", () => {
    const backgrounds = [
      { id: "one", enabled: true },
      { id: "two", enabled: true },
      { id: "disabled", enabled: false },
    ]

    assert.deepEqual(validateAuditCoverage({
      backgrounds,
      entries: [{ id: "one" }, { id: "one" }, { id: "disabled" }, { id: "unknown" }],
      batches: [{ ids: ["two", "two", "unknown"] }],
    }), [
      "entries: duplicate ids one",
      "entries: missing ids two",
      "entries: unknown or disabled ids disabled, unknown",
      "batches: duplicate ids two",
      "batches: missing ids one",
      "batches: unknown or disabled ids unknown",
    ])
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

  it("rejects non-string textual fields and alternatives", () => {
    const background = {
      id: "one", label: "Old", provider: "MassageLab", sourceUrl: "internal", enabled: true,
    }

    for (const [field, expectedError] of [
      ["recommendedName", "one: recommendedName is required"],
      ["visualDescriptor", "one: visualDescriptor must contain 3-8 words"],
      ["rationale", "one: rationale is required"],
      ["collisionNotes", "one: collisionNotes is required"],
    ]) {
      for (const value of [123, true, ["soft flowing field"], "   "]) {
        assert.ok(
          validateAuditEntry({ id: "one", ...validAuditEntry, [field]: value }, background)
            .includes(expectedError),
          `${field} should require a nonempty string`,
        )
      }
    }

    for (const alternatives of [
      ["Quiet Current", 42],
      ["Quiet Current", true],
      ["Quiet Current", ["Gentle Current"]],
      ["Quiet Current", "   "],
    ]) {
      assert.ok(
        validateAuditEntry({ id: "one", ...validAuditEntry, alternatives }, background)
          .includes("one: two or three unique alternatives are required"),
        "each alternative should require a nonempty string",
      )
    }

    assert.ok(
      validateAuditEntry({ id: 123, ...validAuditEntry }, background).includes("one: id is required"),
      "id should require a nonempty string",
    )
  })

  it("allows the reserved Massage Laba Lamp recommendation only for its internal background", () => {
    const errors = validateAuditEntry({
      ...validAuditEntry,
      id: "massage-lab-moving-gradient",
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
      id: "another-internal-background",
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
      id: "massage-lab-moving-gradient",
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
      const errors = validateAuditEntry({
        ...validAuditEntry,
        id: "another-internal-background",
        recommendedName,
      }, {
        id: "another-internal-background",
        label: "Old",
        provider: "MassageLab",
        sourceUrl: "internal",
        enabled: true,
      })

      assert.deepEqual(errors, [`another-internal-background: ${massageLabBrandReservationError}`])
    }
  })

  it("renders every audited field for a batch entry", () => {
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

    assert.equal(markdown, [
      "# Background Branding Audit: Sample",
      "",
      "## Quiet Current",
      "- **ID:** `one`",
      "- **Current name:** Old Name",
      "- **Decision:** rename",
      "- **Alternatives:** Restful Current; Gentle Flow",
      "- **Visual descriptor:** Layered lines drifting in soft waves",
      "- **Signature original eligible:** Yes",
      "- **Rationale:** Fits the restorative voice while describing the motion.",
      "- **Collision notes:** Distinct from all current recommendations.",
      "",
    ].join("\n"))
  })

  it("renders the complete deterministic review index", () => {
    assert.equal(renderAuditIndex({
      batches: [
        { slug: "01-first", title: "First group", ids: ["one", "two"] },
        { slug: "02-second", title: "Second group", ids: ["three"] },
      ],
    }), [
      "# Background Branding Audit",
      "",
      "Generated review artifact. Recommendations are not user-facing catalog changes until approved.",
      "",
      "- [First group](batch-01-first.md) — 2 backgrounds",
      "- [Second group](batch-02-second.md) — 1 backgrounds",
      "",
    ].join("\n"))
  })

  it("aggregates root and entry errors without invoking the output writer", async () => {
    let writeCalls = 0
    const result = await generateAuditFiles({
      audit: {
        schemaVersion: "1",
        voice: ["restorative-laboratory-wellness-leaning"],
        entries: [
          null,
          { id: "one", ...validAuditEntry, recommendedName: 123, rationale: false },
          { id: "unknown", ...validAuditEntry },
        ],
      },
      backgrounds: [{ id: "one", label: "Old", sourceUrl: "internal", enabled: true }],
      batches: [{ slug: "sample", title: "Sample", ids: ["one"] }],
      writeOutputs: async () => { writeCalls += 1 },
    })

    assert.deepEqual(result.errors, [
      "audit data: schemaVersion must be 1",
      "audit data: voice must be restorative-laboratory-wellness-leaning",
      "audit data: entry 1 must be an object",
      "one: recommendedName is required",
      "one: rationale is required",
      "entries: unknown or disabled ids unknown",
    ])
    assert.equal(writeCalls, 0)
    assert.deepEqual(result.outputs, [])
  })

  it("aggregates a malformed root without invoking the output writer", async () => {
    let writeCalls = 0
    const result = await generateAuditFiles({
      audit: null,
      backgrounds: [],
      batches: [],
      writeOutputs: async () => { writeCalls += 1 },
    })

    assert.deepEqual(result.errors, [
      "audit data: root must be an object",
      "audit data: schemaVersion must be 1",
      "audit data: voice must be restorative-laboratory-wellness-leaning",
      "audit data: entries must be an array",
    ])
    assert.equal(writeCalls, 0)
    assert.deepEqual(result.outputs, [])
  })

  it("generates exactly one index and seven batch files for the valid audit", async () => {
    const audit = JSON.parse(await readFile(
      new URL("../data/background-branding-audit.json", import.meta.url),
      "utf8",
    ))
    let writtenOutputs = []
    const result = await generateAuditFiles({
      audit,
      backgrounds: backgroundRegistry.filter(({ enabled }) => enabled),
      batches: BACKGROUND_BRANDING_AUDIT_BATCHES,
      writeOutputs: async (outputs) => { writtenOutputs = outputs },
    })

    assert.deepEqual(result.errors, [])
    assert.deepEqual(writtenOutputs.map(([filename]) => filename), [
      "index.md",
      ...BACKGROUND_BRANDING_AUDIT_BATCHES.map((batch) => `batch-${batch.slug}.md`),
    ])
    assert.deepEqual(result.outputs, writtenOutputs)
  })
})
