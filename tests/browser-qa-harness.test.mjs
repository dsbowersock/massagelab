import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  getPlaywrightFileFilterArguments,
  isAdminUserOperationsInvocation,
  isDevelopmentPaletteReviewInvocation,
  matchesDevelopmentPaletteReviewArgument,
  resolveDevelopmentPaletteReviewIgnoreGlobs,
} from "../playwright.config.ts"
import {
  BROWSER_QA_LANES,
  BROWSER_QA_PROJECT_NAMES,
  ORDINARY_BROWSER_QA_SPEC_FILES,
  assertBrowserQaLaneCoverage,
  resolveCiBrowserQaLaneProjects,
} from "./browser/ci-lanes.mjs"

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

function assertWorkflowStepBefore(workflow, firstStep, secondStep) {
  const firstIndex = workflow.indexOf(firstStep)
  const secondIndex = workflow.indexOf(secondStep)

  assert.notEqual(firstIndex, -1, `Expected workflow to include ${firstStep}`)
  assert.notEqual(secondIndex, -1, `Expected workflow to include ${secondStep}`)
  assert.ok(firstIndex < secondIndex, `Expected ${firstStep} before ${secondStep}`)
}

function getWorkflowJob(workflow, jobId) {
  const match = workflow.match(new RegExp(`^  ${jobId}:\\r?\\n([\\s\\S]*?)(?=^  [a-z_]+:\\r?$|$)`, "m"))

  assert.ok(match, `Expected workflow job ${jobId}`)
  return match[1]
}

test("browser QA lanes cover each ordinary project and spec exactly once", () => {
  const expectedProjects = ["desktop-chromium", "mobile-chromium"]
  const expectedSpecs = [
    "admin-user-operations.spec.ts",
    "app-shell.spec.ts",
    "background-commerce.spec.ts",
    "control-system-review.spec.ts",
    "immersive-panel-shell.spec.ts",
    "local-first.spec.ts",
    "music-visualizer.spec.ts",
    "public-routes.spec.ts",
    "pwa.spec.ts",
  ]

  assert.deepEqual(BROWSER_QA_PROJECT_NAMES, expectedProjects)
  assert.deepEqual(ORDINARY_BROWSER_QA_SPEC_FILES, expectedSpecs)
  assert.equal(Object.keys(BROWSER_QA_LANES).length, 4)

  const expectedPairs = new Set(
    expectedProjects.flatMap((projectName) => expectedSpecs.map((spec) => `${projectName}:${spec}`)),
  )
  assert.equal(expectedPairs.size, 18)

  const actualPairs = []
  for (const lane of Object.values(BROWSER_QA_LANES)) {
    assert.ok(Object.values(lane).some((specs) => specs.length > 0), "Expected every lane to be non-empty")
    for (const [projectName, specs] of Object.entries(lane)) {
      for (const spec of specs) actualPairs.push(`${projectName}:${spec}`)
    }
  }

  assert.equal(new Set(actualPairs).size, expectedPairs.size)
  assert.deepEqual(new Set(actualPairs), expectedPairs)
  assert.doesNotMatch(
    JSON.stringify(BROWSER_QA_LANES),
    /background-(?:palette|carousel-preview|preview-pilot)\.spec\.ts|dna-twisted-cubes-backgrounds\.spec\.ts/,
  )
  assert.doesNotThrow(() => assertBrowserQaLaneCoverage())
})

test("browser QA lane resolver preserves ordinary runs and returns exact lane assignments", () => {
  assert.equal(resolveCiBrowserQaLaneProjects(), null)
  assert.equal(resolveCiBrowserQaLaneProjects("   "), null)
  assert.throws(
    () => resolveCiBrowserQaLaneProjects("unknown"),
    /Unknown browser QA lane/i,
  )

  const expectedLaneProjects = {
    "1": [
      {
        name: "desktop-chromium",
        testMatch: [
          "**/local-first.spec.ts",
          "**/pwa.spec.ts",
          "**/admin-user-operations.spec.ts",
        ],
      },
      {
        name: "mobile-chromium",
        testMatch: [
          "**/public-routes.spec.ts",
          "**/admin-user-operations.spec.ts",
        ],
      },
    ],
    "2": [{
      name: "desktop-chromium",
      testMatch: [
        "**/public-routes.spec.ts",
        "**/app-shell.spec.ts",
        "**/immersive-panel-shell.spec.ts",
        "**/control-system-review.spec.ts",
      ],
    }],
    "3": [{
      name: "mobile-chromium",
      testMatch: [
        "**/background-commerce.spec.ts",
        "**/app-shell.spec.ts",
        "**/immersive-panel-shell.spec.ts",
      ],
    }],
    "4": [
      {
        name: "desktop-chromium",
        testMatch: [
          "**/background-commerce.spec.ts",
          "**/music-visualizer.spec.ts",
        ],
      },
      {
        name: "mobile-chromium",
        testMatch: [
          "**/music-visualizer.spec.ts",
          "**/control-system-review.spec.ts",
          "**/local-first.spec.ts",
          "**/pwa.spec.ts",
        ],
      },
    ],
  }

  for (const [laneId, expectedProjects] of Object.entries(expectedLaneProjects)) {
    assert.deepEqual(resolveCiBrowserQaLaneProjects(` ${laneId} `), expectedProjects)
  }
})

test("development review spec matching accepts Playwright line and column suffixes", () => {
  for (const spec of [
    "tests/browser/background-palette.spec.ts",
    "tests/browser/dna-twisted-cubes-backgrounds.spec.ts",
  ]) {
    assert.equal(matchesDevelopmentPaletteReviewArgument(spec), true)
    assert.equal(matchesDevelopmentPaletteReviewArgument(`${spec}:42`), true)
    assert.equal(matchesDevelopmentPaletteReviewArgument(`C:\\repo\\${spec.replaceAll("/", "\\")}:42:7`), true)
    assert.equal(matchesDevelopmentPaletteReviewArgument(spec.split("/").at(-1)), true)
  }
  assert.equal(matchesDevelopmentPaletteReviewArgument("dna-twisted"), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument("browser/dna-twisted"), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument("background-palette"), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument(String.raw`dna.*cubes-backgrounds\.spec\.ts`), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument(String.raw`[\\/]tests[\\/]browser[\\/]dna-twisted-cubes-backgrounds\.spec\.ts$`), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument(String.raw`^.*background-palette`), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument(String.raw`background-palette.*$`), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument("[invalid"), false)
  assert.equal(matchesDevelopmentPaletteReviewArgument("spec"), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument("tests/browser"), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument(String.raw`tests[\\/]browser[\\/]`), true)
  assert.equal(matchesDevelopmentPaletteReviewArgument(`dna${".*".repeat(300)}cubes`), false)
  assert.equal(matchesDevelopmentPaletteReviewArgument("dna-(twisted|cubes)"), false)
  assert.equal(matchesDevelopmentPaletteReviewArgument("not-a-review-spec"), false)
  assert.equal(matchesDevelopmentPaletteReviewArgument("tests/browser/public-routes.spec.ts:42"), false)
  assert.equal(matchesDevelopmentPaletteReviewArgument("prefix-tests/browser/background-palette.spec.ts"), false)
})

test("development review invocation ignores the leading Playwright subcommand", () => {
  assert.equal(isDevelopmentPaletteReviewInvocation(["test"]), false)
  assert.equal(isDevelopmentPaletteReviewInvocation(["test", "tests/browser/public-routes.spec.ts"]), false)
  assert.equal(isDevelopmentPaletteReviewInvocation(["test", "--grep", "dna-twisted"]), false)
  assert.equal(isDevelopmentPaletteReviewInvocation(["test", "--repeat-each", "background-palette"]), false)
  assert.equal(isDevelopmentPaletteReviewInvocation(["test", "dna-twisted"]), true)
})

test("Admin user operations QA disables stale-server reuse for unfiltered and explicit spec runs", () => {
  assert.equal(isAdminUserOperationsInvocation(["test"]), true)
  assert.equal(isAdminUserOperationsInvocation(["test", "--grep", "role change"]), true)
  assert.equal(
    isAdminUserOperationsInvocation(["test", "tests/browser/admin-user-operations.spec.ts"]),
    true,
  )
  assert.equal(isAdminUserOperationsInvocation(["test", "admin-user-operations.spec.ts:42"]), true)
  assert.equal(isAdminUserOperationsInvocation(["test", "tests/browser"]), true)
  assert.equal(isAdminUserOperationsInvocation(["test", "admin-user-operations"]), true)
  assert.equal(
    isAdminUserOperationsInvocation(["test", String.raw`tests[\\/]browser[\\/]admin-user-operations\.spec\.ts$`]),
    true,
  )
  assert.equal(isAdminUserOperationsInvocation(["test", "[invalid"]), false)
  assert.equal(
    isAdminUserOperationsInvocation(["test", "tests/browser/public-routes.spec.ts"]),
    false,
  )
})

test("Playwright file filters skip separate option values", () => {
  assert.deepEqual(
    getPlaywrightFileFilterArguments([
      "test",
      "--project", "desktop-chromium",
      "--grep", "dna-twisted",
      "tests/browser/public-routes.spec.ts",
    ]),
    ["test", "tests/browser/public-routes.spec.ts"],
  )
})

test("Playwright file filters consume the grep-invert short-option value", () => {
  assert.deepEqual(
    getPlaywrightFileFilterArguments(["test", "-G", "tests/browser/background-palette.spec.ts"]),
    ["test"],
  )
})

test("Playwright file filters consume optional refs and every variadic project name", () => {
  assert.deepEqual(
    getPlaywrightFileFilterArguments([
      "test",
      "--only-changed", "origin/main",
      "--project", "desktop-chromium", "mobile-chromium",
      "--grep", "dna-twisted",
      "tests/browser/public-routes.spec.ts",
    ]),
    ["test", "tests/browser/public-routes.spec.ts"],
  )
})

test("Playwright file filters require an option terminator after variadic projects", () => {
  assert.deepEqual(
    getPlaywrightFileFilterArguments([
      "test",
      "--project", "desktop-chromium",
      "--",
      "tests/browser/public-routes.spec.ts",
    ]),
    ["test", "tests/browser/public-routes.spec.ts"],
  )
})

test("Playwright file filters retain positional shorthand after inline options", () => {
  assert.deepEqual(
    getPlaywrightFileFilterArguments(["test", "--grep=dna-twisted", "dna-twisted"]),
    ["test", "dna-twisted"],
  )
})

test("Playwright file filters skip every supported option with a separate value", () => {
  assert.deepEqual(
    getPlaywrightFileFilterArguments([
      "test",
      "--trace", "on-first-retry",
      "--repeat-each", "dna-twisted",
      "--tsconfig", "background-palette",
      "--browser", "chromium",
      "--last-failed-file", ".last-run.json",
      "--test-list", "tests.txt",
      "--test-list-invert", "excluded-tests.txt",
      "--ui-host", "127.0.0.1",
      "--ui-port", "9323",
      "--update-source-method", "patch",
      "tests/browser/public-routes.spec.ts",
    ]),
    ["test", "tests/browser/public-routes.spec.ts"],
  )
})

test("Playwright file filters tolerate trailing options and an empty terminator", () => {
  assert.deepEqual(getPlaywrightFileFilterArguments(["test", "--grep"]), ["test"])
  assert.deepEqual(getPlaywrightFileFilterArguments(["test", "--only-changed"]), ["test"])
  assert.deepEqual(getPlaywrightFileFilterArguments(["test", "--project"]), ["test"])
  assert.deepEqual(getPlaywrightFileFilterArguments(["test", "--"]), ["test"])
})

test("browser QA harness is wired for public smoke, PWA, and local-first checks", async () => {
  const [packageJson, config, publicRoutesSpec, pwaSpec, localFirstSpec, ciWorkflow] = await Promise.all([
    readProjectFile("package.json"),
    readProjectFile("playwright.config.ts"),
    readProjectFile("tests/browser/public-routes.spec.ts"),
    readProjectFile("tests/browser/pwa.spec.ts"),
    readProjectFile("tests/browser/local-first.spec.ts"),
    readProjectFile(".github/workflows/ci.yml"),
  ])

  const packageData = JSON.parse(packageJson)

  assert.match(packageData.devDependencies["@playwright/test"], /^\^\d+\.\d+\.\d+$/)
  assert.equal(packageData.scripts["test:browser"], "playwright test")
  assert.equal(packageData.scripts["test:browser:build"], "npm run build && npm run test:browser")

  assert.match(config, /webServer/)
  assert.match(config, /localhost:3010/)
  assert.match(config, /Desktop Chrome/)
  assert.match(config, /Pixel 7/)
  assert.match(config, /function parseBrowserQaPort/)
  assert.match(config, /Number\.isInteger/)
  assert.match(config, /process\.env\.PLAYWRIGHT_PORT/)
  assert.match(config, /function parseBooleanEnv/)
  assert.match(config, /const skipWebServer = parseBooleanEnv\(process\.env\.PLAYWRIGHT_SKIP_WEB_SERVER\)/)
  assert.match(config, /webServer: skipWebServer/)
  assert.match(config, /runsDevelopmentPaletteReview/)
  assert.doesNotMatch(config, /new RegExp\(argument\)/)
  assert.match(
    config,
    /developmentPaletteReviewSpecs[\s\S]*tests\/browser\/background-palette\.spec\.ts[\s\S]*tests\/browser\/dna-twisted-cubes-backgrounds\.spec\.ts/,
  )
  const reviewIgnoreGlobs = [
    "**/background-palette.spec.ts",
    "**/background-carousel-preview.spec.ts",
    "**/background-preview-pilot.spec.ts",
    "**/dna-twisted-cubes-backgrounds.spec.ts",
  ]
  assert.deepEqual(resolveDevelopmentPaletteReviewIgnoreGlobs(["test"]), reviewIgnoreGlobs)
  assert.deepEqual(
    resolveDevelopmentPaletteReviewIgnoreGlobs(["test", "tests/browser/background-palette.spec.ts"]),
    [],
  )
  assert.deepEqual(
    resolveDevelopmentPaletteReviewIgnoreGlobs(["test", "tests/browser/background-carousel-preview.spec.ts"]),
    [],
  )
  assert.deepEqual(
    resolveDevelopmentPaletteReviewIgnoreGlobs(["test", "tests/browser/background-preview-pilot.spec.ts"]),
    [],
  )

  for (const route of ["/", "/notes", "/notes/soap", "/chimer", "/calendar", "/anatomime"]) {
    assert.match(publicRoutesSpec, new RegExp(JSON.stringify(route)))
  }

  assert.match(publicRoutesSpec, /\/api\/account\/preferences/)
  assert.match(publicRoutesSpec, /\/api\/account\/profile/)
  assert.match(publicRoutesSpec, /page\.on\("console"/)
  assert.match(publicRoutesSpec, /page\.on\("pageerror"/)

  assert.match(pwaSpec, /\/manifest\.webmanifest/)
  assert.match(pwaSpec, /\/icons\/icon-192\.png/)
  assert.match(pwaSpec, /\/icons\/icon-512\.png/)
  assert.match(pwaSpec, /\/icons\/maskable-icon-192\.png/)
  assert.match(pwaSpec, /\/icons\/maskable-icon-512\.png/)

  assert.match(localFirstSpec, /ML_BROWSER_QA_SENTINEL/)
  assert.match(localFirstSpec, /decodeURIComponent\(rawUrl\)/)
  assert.match(localFirstSpec, /encodeURIComponent\(ML_BROWSER_QA_SENTINEL\)/)
  assert.match(localFirstSpec, /\/api\/clinical\/sync/)
  assert.match(localFirstSpec, /\/api\/clients\//)
  assert.match(localFirstSpec, /POST|PUT|PATCH|DELETE/)

  assert.match(ciWorkflow, /npm run test:browser/)
  assert.match(ciWorkflow, /AUTH_SECRET/)
  assert.match(ciWorkflow, /NEXTAUTH_SECRET/)
  assert.match(ciWorkflow, /npx playwright install --with-deps chromium/)
  assert.match(ciWorkflow, /^permissions:\r?\n  contents: read$/m)
  assertWorkflowStepBefore(ciWorkflow, "npm run prisma:generate", "npm run typecheck")
})

test("CI workflow parallelizes browser QA and aggregates every upstream result", async () => {
  const ciWorkflow = await readProjectFile(".github/workflows/ci.yml")

  assert.match(ciWorkflow, /^  code_quality:\r?$/m)
  assert.match(ciWorkflow, /^  browser_build:\r?$/m)
  assert.match(ciWorkflow, /^  browser_qa:\r?$/m)
  assert.match(ciWorkflow, /^  qa:\r?$/m)
  assert.match(ciWorkflow, /code_quality:\r?\n    name: Code quality[\s\S]*?timeout-minutes: 12/)
  assert.match(ciWorkflow, /browser_build:\r?\n    name: Browser build[\s\S]*?timeout-minutes: 12/)
  assert.match(ciWorkflow, /browser_qa:\r?\n    name: Browser QA \(lane \$\{\{ matrix\.lane \}\}\)[\s\S]*?needs: browser_build[\s\S]*?timeout-minutes: 15/)
  assert.match(ciWorkflow, /qa:\r?\n    name: qa[\s\S]*?if: \$\{\{ always\(\) \}\}[\s\S]*?timeout-minutes: 2/)
  assert.doesNotMatch(getWorkflowJob(ciWorkflow, "code_quality"), /^    needs:/m)
  assert.doesNotMatch(getWorkflowJob(ciWorkflow, "browser_build"), /^    needs:/m)

  assert.equal((ciWorkflow.match(/npm run build(?::next)?/g) ?? []).length, 1)
  assert.match(ciWorkflow, /strategy:\r?\n      fail-fast: false\r?\n      matrix:\r?\n        lane: \["1", "2", "3", "4"\]/)
  assert.match(ciWorkflow, /PLAYWRIGHT_CI_LANE: \$\{\{ matrix\.lane \}\}/)
  assert.match(ciWorkflow, /key: \$\{\{ runner\.os \}\}-nextjs-v2-/)

  const runtimeArtifact = "next-runtime-${{ github.sha }}-${{ github.run_attempt }}"
  assert.match(ciWorkflow, new RegExp(`name: ${runtimeArtifact.replaceAll("$", "\\$").replaceAll("{", "\\{").replaceAll("}", "\\}")}`))
  assert.match(
    ciWorkflow,
    /uses: actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a\r?\n        with:\r?\n          name: next-runtime-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}\r?\n          path: \|\r?\n            \.next\r?\n            !\.next\/cache\/\*\*\r?\n          if-no-files-found: error\r?\n          retention-days: 1\r?\n          include-hidden-files: true/,
  )
  assert.match(
    ciWorkflow,
    /uses: actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c\r?\n        with:\r?\n          name: next-runtime-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}\r?\n          path: \.next/,
  )
  assert.match(
    ciWorkflow,
    /if: \$\{\{ always\(\) \}\}\r?\n        uses: actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a\r?\n        with:\r?\n          name: browser-diagnostics-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}-lane-\$\{\{ matrix\.lane \}\}\r?\n          path: test-results\r?\n          if-no-files-found: ignore\r?\n          retention-days: 7\r?\n          include-hidden-files: true/,
  )

  assert.match(ciWorkflow, /needs:\r?\n      - code_quality\r?\n      - browser_build\r?\n      - browser_qa/)
  assert.match(ciWorkflow, /CODE_QUALITY_RESULT: \$\{\{ needs\.code_quality\.result \}\}/)
  assert.match(ciWorkflow, /BROWSER_BUILD_RESULT: \$\{\{ needs\.browser_build\.result \}\}/)
  assert.match(ciWorkflow, /BROWSER_QA_RESULT: \$\{\{ needs\.browser_qa\.result \}\}/)
  assert.match(ciWorkflow, /if \[ "\$result" != "success" \]; then/)

  assert.match(ciWorkflow, /^  pull_request:/m)
  assert.match(ciWorkflow, /^  push:\r?\n    branches:\r?\n      - main$/m)
  assert.match(ciWorkflow, /^permissions:\r?\n  contents: read$/m)
  assert.match(ciWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/)
  assertWorkflowStepBefore(ciWorkflow, "npm run prisma:generate", "npm run typecheck")
  assertWorkflowStepBefore(ciWorkflow, "npm run prisma:generate", "npm run test:browser")
})
