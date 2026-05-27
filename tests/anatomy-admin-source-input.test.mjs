import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseAnatomyAdminSourceInput } from "../lib/anatomy-admin-source-input.js"

function sourceForm(entries) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value)
  }

  return formData
}

describe("Anatomy admin source input", () => {
  it("normalizes full source metadata for admin persistence", () => {
    const parsed = parseAnatomyAdminSourceInput(sourceForm({
      label: "  BodyParts3D Runtime Review  ",
      slug: "",
      url: " https://dbarchive.biosciencedbc.jp/en/bodyparts3d/ ",
      license: " CC BY 4.0 ",
      license_url: " https://creativecommons.org/licenses/by/4.0/ ",
      usage_scope: "open_reuse",
      accessed_at: "2026-05-27",
      notes: "  Runtime mesh review source.  ",
      attribution: " Database Center for Life Science. ",
    }))

    assert.deepEqual(parsed, {
      slug: "bodyparts3d-runtime-review",
      label: "BodyParts3D Runtime Review",
      url: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      usageScope: "OPEN_REUSE",
      accessedAt: new Date("2026-05-27T00:00:00.000Z"),
      notes: "Runtime mesh review source.",
      attribution: "Database Center for Life Science.",
    })
  })

  it("falls back to review-only metadata and rejects missing required fields", () => {
    const parsed = parseAnatomyAdminSourceInput(sourceForm({
      label: "Wikimedia candidate",
      slug: "Wikimedia Candidate",
      usage_scope: "not-valid",
      accessed_at: "not-a-date",
      attribution: "Per-file attribution required.",
    }))

    assert.equal(parsed?.slug, "wikimedia-candidate")
    assert.equal(parsed?.usageScope, "REVIEW_ONLY")
    assert.equal(parsed?.accessedAt, null)
    assert.equal(parsed?.url, null)
    assert.equal(parsed?.license, null)
    assert.equal(parsed?.licenseUrl, null)
    assert.equal(parsed?.notes, null)

    assert.equal(parseAnatomyAdminSourceInput(sourceForm({ label: "", attribution: "x" })), null)
    assert.equal(parseAnatomyAdminSourceInput(sourceForm({ label: "No attribution" })), null)
  })
})
