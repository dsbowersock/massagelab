import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  anatomyTerms,
  createAnatomimeDeck,
  getAnatomyRegions,
  getAnatomySources,
  getAnatomyTerms,
  validateAnatomyContent,
} from "../lib/anatomy.js"

const difficultyRank = {
  easy: 1,
  medium: 2,
  hard: 3,
}

describe("Anatomy content helpers", () => {
  it("keeps the shipped anatomy content internally valid", () => {
    assert.deepEqual(validateAnatomyContent(), [])
    assert.ok(anatomyTerms.some((term) => term.kind === "bone"))
    assert.ok(anatomyTerms.some((term) => term.kind === "muscle"))
  })

  it("filters terms by kind, region, and term-set difficulty", () => {
    const easyHeadBones = getAnatomyTerms({
      kinds: ["bone"],
      regions: ["head"],
      difficulty: "easy",
    })
    const mediumHeadBones = getAnatomyTerms({
      kinds: ["bone"],
      regions: ["head"],
      difficulty: "medium",
    })
    const hardHeadBones = getAnatomyTerms({
      kinds: ["bone"],
      regions: ["head"],
      difficulty: "hard",
    })

    assert.ok(easyHeadBones.length >= 4)
    assert.ok(mediumHeadBones.length >= easyHeadBones.length)
    assert.ok(hardHeadBones.length >= mediumHeadBones.length)
    assert.ok(easyHeadBones.every((term) => term.kind === "bone"))
    assert.ok(easyHeadBones.every((term) => term.regions.includes("head")))
    assert.ok(easyHeadBones.every((term) => difficultyRank[term.difficulty] <= difficultyRank.easy))
  })

  it("returns no terms when required filters are explicitly empty", () => {
    assert.equal(getAnatomyTerms({ kinds: [], regions: ["head"], difficulty: "hard" }).length, 0)
    assert.equal(getAnatomyTerms({ kinds: ["muscle"], regions: [], difficulty: "hard" }).length, 0)
  })

  it("creates a unique Anatomime deck from matching terms", () => {
    const deck = createAnatomimeDeck({
      kinds: ["bone", "muscle"],
      regions: ["upper-extremity"],
      difficulty: "hard",
      count: 4,
      rng: () => 0.42,
    })

    assert.equal(deck.length, 4)
    assert.equal(new Set(deck.map((term) => term.id)).size, 4)
  })

  it("exposes regions and source attribution", () => {
    const regions = getAnatomyRegions()
    const sources = getAnatomySources()

    assert.ok(regions.some((region) => region.id === "lower-extremity"))
    assert.ok(regions.every((region) => region.termCount > 0))
    assert.ok(sources.some((source) => source.id === "openstax-ap-2e"))
  })

  it("reports duplicate ids, empty names, and invalid relationships", () => {
    const base = anatomyTerms[0]
    const related = anatomyTerms[1]
    const issues = validateAnatomyContent([
      { ...base, id: "duplicate-id" },
      { ...related, id: "duplicate-id", name: "" },
      { ...base, id: "bad-relationship", relationships: [{ type: "related", targetId: "missing-target" }] },
    ])

    assert.ok(issues.some((issue) => issue.includes("Duplicate anatomy term id")))
    assert.ok(issues.some((issue) => issue.includes("Empty anatomy term name")))
    assert.ok(issues.some((issue) => issue.includes("Invalid anatomy relationship target")))
  })
})
