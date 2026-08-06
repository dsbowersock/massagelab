import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import audit from "../data/background-branding-audit.json" with { type: "json" }
import brandingCatalog from "../data/background-branding-catalog.json" with { type: "json" }
import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"
import { ACTIVE_BACKGROUND_IDS } from "../lib/background-options.js"
import { matchesBackgroundSearch } from "../lib/background-catalog.js"

const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

describe("approved background branding catalog", () => {
  it("publishes every approved name and descriptor without changing stable IDs", () => {
    const enabled = backgroundRegistry.filter(({ enabled }) => enabled)
    const auditById = new Map(audit.entries.map((entry) => [entry.id, entry]))
    const catalogById = new Map(brandingCatalog.entries.map((entry) => [entry.id, entry]))

    assert.deepEqual(enabled.map(({ id }) => id).toSorted(), [...ACTIVE_BACKGROUND_IDS].toSorted())
    assert.deepEqual([...catalogById.keys()].toSorted(), [...ACTIVE_BACKGROUND_IDS].toSorted())
    assert.equal(new Set(enabled.map(({ label }) => normalize(label))).size, enabled.length)

    for (const background of enabled) {
      const reviewed = auditById.get(background.id)
      const branding = catalogById.get(background.id)
      assert.ok(reviewed, `${background.id} audit entry`)
      assert.ok(branding, `${background.id} branding entry`)
      assert.equal(background.label, reviewed.recommendedName)
      assert.equal(background.visualDescriptor, reviewed.visualDescriptor)
      assert.deepEqual(background.legacyLabels, branding.legacyLabels)
      assert.equal(background.signatureOriginal, reviewed.signatureOriginalEligible)
    }
  })

  it("keeps legacy names searchable without making them ordinary labels", () => {
    const renamed = backgroundRegistry.find(({ id }) => id === "massage-lab-retro-grid")
    assert.ok(renamed)
    assert.equal(renamed.label, "Endless Perspective")
    assert.deepEqual(renamed.legacyLabels, ["Retro Grid"])
    assert.equal(matchesBackgroundSearch(renamed, "retro grid"), true)
    assert.equal(matchesBackgroundSearch(renamed, "perspective grid"), true)
    assert.equal(matchesBackgroundSearch(renamed, "unrelated phrase"), false)
  })

  it("reserves Massage Lab branding for an internal signature original", () => {
    const visiblyBranded = backgroundRegistry.filter(({ label }) => normalize(label).replaceAll(" ", "").includes("massagelab"))
    assert.deepEqual(visiblyBranded.map(({ id }) => id), ["massage-lab-moving-gradient"])
    assert.equal(visiblyBranded[0]?.signatureOriginal, true)
    assert.equal(visiblyBranded[0]?.sourceUrl, "internal")
  })

  it("shows literal descriptors on primary picker and ownership surfaces", async () => {
    const [card, acquisition, credit, account] = await Promise.all([
      readFile(new URL("../components/backgrounds/background-carousel-card.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/backgrounds/BackgroundAcquisitionDialog.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/backgrounds/BackgroundCreditConfirmationDialog.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/account/BackgroundCommercePanel.tsx", import.meta.url), "utf8"),
    ])
    for (const source of [card, acquisition, credit, account]) {
      assert.match(source, /visualDescriptor/)
    }
  })
})
