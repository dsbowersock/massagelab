import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { PUBLIC_SEO_ROUTES } from "../lib/seo.js"

function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

describe("public Roadmap page", () => {
  it("presents five equal product tracks with current and long-term outcomes", () => {
    const source = readProjectFile("app/roadmap/page.tsx")
    const trackTitles = [
      "Education & Anatomy",
      "Wellness Tools",
      "Therapist & Practice Tools",
      "Local-First Records",
      "Audio & Ambient Experiences",
    ]

    for (const title of trackTitles) {
      assert.equal(source.includes(title), true)
    }

    assert.equal(source.match(/availableNow:/g)?.length, 5)
    assert.equal(source.match(/longTermDirection:/g)?.length, 5)
    assert.equal(source.match(/capabilities:/g)?.length, 5)
    assert.match(source, /not a release order/i)
    assert.match(source, /Shared foundation/)
    assert.match(source, /local-first/i)
    assert.match(source, /informed consent/i)
    assert.match(source, /security, compliance, legal, and operational readiness/i)
  })

  it("keeps the approved public actions and removes tactical roadmap copy", () => {
    const source = readProjectFile("app/roadmap/page.tsx")

    assert.match(source, /href="\/tools"/)
    assert.match(source, /href="\/pricing"/)
    assert.match(source, /href="\/pricing#one-time-support"/)
    assert.match(source, /One-time support/)
    assert.doesNotMatch(source, />\s*Donate\s*</)
    assert.doesNotMatch(source, /Memberships and donations/i)
    assert.doesNotMatch(source, /recentlyShipped|currentFocus|laterProductTracks|upfrontNeeds/)
    assert.doesNotMatch(source, /Current alpha direction|Recently shipped|Current alpha focus/)
    assert.doesNotMatch(source, /May 8-13, 2026/)
  })

  it("uses timeless Roadmap metadata", () => {
    const route = PUBLIC_SEO_ROUTES.find((entry) => entry.path === "/roadmap")

    assert.ok(route)
    assert.equal(
      route.description,
      "Explore MassageLab's long-term vision for anatomy education, wellness, therapist practice tools, local-first records, and ambient experiences.",
    )
    assert.doesNotMatch(route.description, /current|milestone|phase|priority|date/i)
  })
})
