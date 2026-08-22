import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"

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

test("install-prompt QA dispatches only while the provider listener is proven active", async () => {
  const appShellSpec = await readProjectFile("tests/browser/app-shell.spec.ts")

  assert.equal((appShellSpec.match(/await installPwaPromptListenerProbe\(page\)/g) ?? []).length, 2)
  assert.equal((appShellSpec.match(/await dispatchPwaInstallPromptWhenReady\(page,/g) ?? []).length, 2)
  const dispatchStart = appShellSpec.indexOf("async function dispatchPwaInstallPromptWhenReady")
  const dispatchEnd = appShellSpec.indexOf("\nasync function ", dispatchStart + 1)
  const dispatchSource = appShellSpec.slice(dispatchStart, dispatchEnd === -1 ? undefined : dispatchEnd)
  assert.notEqual(dispatchStart, -1)
  assert.match(
    dispatchSource,
    /if \(!Reflect\.get\(window, "__massagelabPwaInstallPromptListenerReady"\)\) return false[\s\S]*window\.dispatchEvent\(event\)/,
  )
})

/**
 * Extracts one job from this repository's CI workflow source. The matcher
 * intentionally follows its two-space job indentation and lowercase-letter or
 * underscore job IDs so the next top-level job or absolute end of the source
 * forms an unambiguous boundary.
 */
function getWorkflowJob(workflow, jobId) {
  const match = workflow.match(
    new RegExp(`^  ${jobId}:\\r?\\n([\\s\\S]*?)(?=^  [a-z_]+:\\r?$|(?![\\s\\S]))`, "m"),
  )

  assert.ok(match, `Expected workflow job ${jobId}`)
  return match[1]
}

test("workflow job extraction includes the complete body and stops at the next job", () => {
  const workflow = [
    "jobs:",
    "  first_job:",
    "    name: First job",
    "    needs: unexpected_dependency",
    "    steps:",
    "      - run: npm test",
    "  second_job:",
    "    name: Second job",
  ].join("\n")

  const firstJob = getWorkflowJob(workflow, "first_job")
  assert.match(firstJob, /^    needs: unexpected_dependency$/m)
  assert.doesNotMatch(firstJob, /Second job/)
})

test("browser QA lanes cover each ordinary project and spec exactly once", async () => {
  const expectedProjects = ["desktop-chromium", "mobile-chromium"]
  const expectedSpecs = [
    "admin-user-operations.spec.ts",
    "app-shell.spec.ts",
    "atmoshaper.spec.ts",
    "background-commerce.spec.ts",
    "control-system-review.spec.ts",
    "immersive-panel-shell.spec.ts",
    "local-first.spec.ts",
    "music-media-session.spec.ts",
    "music-visualizer.spec.ts",
    "public-routes.spec.ts",
    "pwa.spec.ts",
  ]

  const developmentOnlySpecs = new Set(
    resolveDevelopmentPaletteReviewIgnoreGlobs([]).map((glob) => glob.split("/").at(-1)),
  )
  const discoveredOrdinarySpecs = (await readdir(new URL("./browser/", import.meta.url)))
    .filter((filename) => filename.endsWith(".spec.ts") && !developmentOnlySpecs.has(filename))
    .sort()

  assert.deepEqual(BROWSER_QA_PROJECT_NAMES, expectedProjects)
  assert.deepEqual(ORDINARY_BROWSER_QA_SPEC_FILES, discoveredOrdinarySpecs)
  assert.deepEqual(ORDINARY_BROWSER_QA_SPEC_FILES, expectedSpecs)
  assert.equal(Object.keys(BROWSER_QA_LANES).length, 4)

  const expectedPairs = new Set(
    expectedProjects.flatMap((projectName) => expectedSpecs.map((spec) => `${projectName}:${spec}`)),
  )
  assert.equal(expectedPairs.size, 22)

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

  const lanesWithWrongFourthId = Object.fromEntries(
    Object.entries(BROWSER_QA_LANES).map(([laneId, lane]) => [laneId === "4" ? "5" : laneId, lane]),
  )
  assert.throws(
    () => assertBrowserQaLaneCoverage(lanesWithWrongFourthId),
    /exact lane IDs 1, 2, 3, and 4; found 1, 2, 3, 5/i,
  )
})

test("browser QA lane resolver preserves ordinary runs and returns exact lane assignments", () => {
  assert.equal(resolveCiBrowserQaLaneProjects(), null)
  assert.equal(resolveCiBrowserQaLaneProjects("   "), null)
  assert.throws(
    () => resolveCiBrowserQaLaneProjects("unknown"),
    /Unknown browser QA lane/i,
  )
  for (const inheritedKey of ["constructor", "toString"]) {
    assert.throws(
      () => resolveCiBrowserQaLaneProjects(inheritedKey),
      new RegExp(`Unknown browser QA lane: ${inheritedKey}`, "i"),
    )
  }

  const expectedLaneProjects = {
    "1": [
      {
        name: "desktop-chromium",
        testMatch: [
          "**/public-routes.spec.ts",
          "**/local-first.spec.ts",
        ],
      },
      {
        name: "mobile-chromium",
        testMatch: [
          "**/app-shell.spec.ts",
          "**/pwa.spec.ts",
        ],
      },
    ],
    "2": [
      {
        name: "desktop-chromium",
        testMatch: [
          "**/app-shell.spec.ts",
          "**/pwa.spec.ts",
        ],
      },
      {
        name: "mobile-chromium",
        testMatch: [
          "**/public-routes.spec.ts",
          "**/local-first.spec.ts",
        ],
      },
    ],
    "3": [
      {
        name: "desktop-chromium",
        testMatch: [
          "**/atmoshaper.spec.ts",
          "**/music-media-session.spec.ts",
          "**/admin-user-operations.spec.ts",
        ],
      },
      {
        name: "mobile-chromium",
        testMatch: [
          "**/atmoshaper.spec.ts",
          "**/music-media-session.spec.ts",
        ],
      },
    ],
    "4": [
      {
        name: "desktop-chromium",
        testMatch: [
          "**/background-commerce.spec.ts",
          "**/control-system-review.spec.ts",
          "**/immersive-panel-shell.spec.ts",
          "**/music-visualizer.spec.ts",
        ],
      },
      {
        name: "mobile-chromium",
        testMatch: [
          "**/admin-user-operations.spec.ts",
          "**/background-commerce.spec.ts",
          "**/control-system-review.spec.ts",
          "**/immersive-panel-shell.spec.ts",
          "**/music-visualizer.spec.ts",
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
  for (const jobId of ["browser_build", "browser_qa"]) {
    assert.match(
      getWorkflowJob(ciWorkflow, jobId),
      /- name: Check out repository\r?\n        # Pinned from actions\/checkout@v6 on 2026-06-10\.\r?\n        uses: actions\/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10\r?\n        with:\r?\n          persist-credentials: false/,
    )
  }

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
  assert.match(ciWorkflow, /"code_quality=\$CODE_QUALITY_RESULT"/)
  assert.match(ciWorkflow, /"browser_build=\$BROWSER_BUILD_RESULT"/)
  assert.match(ciWorkflow, /"browser_qa=\$BROWSER_QA_RESULT"/)
  assert.match(ciWorkflow, /echo "::error::\$dependency returned \$result"/)
  assert.match(ciWorkflow, /if \[ "\$result" != "success" \]; then/)
  assert.match(ciWorkflow, /exit "\$failed"/)

  assert.match(ciWorkflow, /^  pull_request:/m)
  assert.match(ciWorkflow, /^  push:\r?\n    branches:\r?\n      - main$/m)
  assert.match(ciWorkflow, /^permissions:\r?\n  contents: read$/m)
  assert.match(ciWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/)
  assertWorkflowStepBefore(ciWorkflow, "npm run prisma:generate", "npm run typecheck")
  assertWorkflowStepBefore(ciWorkflow, "npm run prisma:generate", "npm run test:browser")
})
