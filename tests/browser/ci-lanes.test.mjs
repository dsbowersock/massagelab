import assert from "node:assert/strict"
import test from "node:test"

import {
  BROWSER_QA_LANES,
  BROWSER_QA_PROJECT_NAMES,
  ORDINARY_BROWSER_QA_SPEC_FILES,
  assertBrowserQaLaneCoverage,
  resolveCiBrowserQaLaneProjects,
} from "./ci-lanes.mjs"

test("AtmoShaper acceptance is discovered once per Chromium project in the music lane", () => {
  assert.equal(
    ORDINARY_BROWSER_QA_SPEC_FILES.filter((spec) => spec === "atmoshaper.spec.ts").length,
    1,
  )

  const pairs = BROWSER_QA_PROJECT_NAMES.map((project) => `${project}:atmoshaper.spec.ts`)
  const assignments = Object.values(BROWSER_QA_LANES).flatMap((lane) => (
    Object.entries(lane).flatMap(([project, specs]) => (
      specs.map((spec) => `${project}:${spec}`)
    ))
  ))
  for (const pair of pairs) {
    assert.equal(assignments.filter((assignment) => assignment === pair).length, 1, pair)
  }

  const musicLane = resolveCiBrowserQaLaneProjects("3")
  for (const project of BROWSER_QA_PROJECT_NAMES) {
    const descriptor = musicLane?.find(({ name }) => name === project)
    assert.ok(descriptor, `${project} must remain in the music lane`)
    assert.ok(descriptor.testMatch.includes("**/music-media-session.spec.ts"))
    assert.ok(descriptor.testMatch.includes("**/atmoshaper.spec.ts"))
  }
  assert.doesNotThrow(() => assertBrowserQaLaneCoverage())
})
