import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyPrivacySafeRoute,
  normalizePrivacySafePath,
} from "../lib/privacy-route.js"

describe("privacy-safe route classification", () => {
  it("removes hosts, queries, fragments, and repeated separators", () => {
    assert.equal(
      normalizePrivacySafePath("https://massagelab.app/notes/soap?client=Jane#pain-map"),
      "/notes/soap",
    )
    assert.equal(normalizePrivacySafePath("calendar//booking?email=a@example.com"), "/calendar/booking")
  })

  it("coarsens private, code-bearing, and public tool routes", () => {
    assert.deepEqual(classifyPrivacySafeRoute("/notes/soap?client=Jane"), {
      area: "professional-records",
      safePath: "/notes/[local-first]",
      privacyLevel: "local-first-phi-capable",
    })
    assert.deepEqual(classifyPrivacySafeRoute("/anatomime/play/ABC123"), {
      area: "anatomime",
      safePath: "/anatomime/play/[code]",
      privacyLevel: "public-study",
    })
    assert.deepEqual(classifyPrivacySafeRoute("/chimer?background=dna"), {
      area: "timer",
      safePath: "/timer",
      privacyLevel: "public-tool",
    })
  })

  it("returns bounded fallbacks for malformed input", () => {
    assert.deepEqual(classifyPrivacySafeRoute(undefined), {
      area: "unknown",
      safePath: "/[unknown]",
      privacyLevel: "unknown",
    })
    assert.equal(
      classifyPrivacySafeRoute("/person@example.com/private-slug").safePath,
      "/public/[route]",
    )
  })
})
