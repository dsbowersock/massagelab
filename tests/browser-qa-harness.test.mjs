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

const initialAtmosphereFixturePattern =
  /installAtmosphereFixtures\(\s*page,\s*allowedExternalUrls,\s*\[\],\s*initialAtmosphereSampleIndexUrls,?\s*\)/g
const musicPathGuardPattern = /if\s*\(\s*path\s*===\s*["']\/music["']\s*\)\s*\{/

/** Finds the closing brace for a known block opener without depending on source indentation. */
function findMatchingBraceIndex(source, openingBraceIndex) {
  if (source[openingBraceIndex] !== "{") return -1

  let depth = 0
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1
    if (source[index] === "}") depth -= 1
    if (depth === 0) return index
  }
  return -1
}

test("Atmosphere fixture matching survives wrapped calls and reindented nested guards", () => {
  const source = [
    "if (",
    "\tpath === '/music'",
    ") {",
    "\tif (shouldPrewarm) {",
    "\t\tinstallAtmosphereFixtures(",
    "\t\t\tpage,",
    "\t\t\tallowedExternalUrls,",
    "\t\t\t[],",
    "\t\t\tinitialAtmosphereSampleIndexUrls,",
    "\t\t)",
    "\t}",
    "}",
    "await page.goto(path)",
  ].join("\n")
  const guardMatch = musicPathGuardPattern.exec(source)
  assert.ok(guardMatch)
  const guardIndex = guardMatch.index
  const openingBraceIndex = guardIndex + guardMatch[0].lastIndexOf("{")
  const closingBraceIndex = findMatchingBraceIndex(source, openingBraceIndex)

  assert.equal((source.match(initialAtmosphereFixturePattern) ?? []).length, 1)
  assert.ok(source.search(initialAtmosphereFixturePattern) < closingBraceIndex)
  assert.ok(closingBraceIndex < source.indexOf("await page.goto(path)"))
})

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

test("Code quality provisions Chromium with Linux dependencies before Node tests", async () => {
  const workflow = await readProjectFile(".github/workflows/ci.yml")
  const codeQualityJob = getWorkflowJob(workflow, "code_quality")

  assert.match(
    codeQualityJob,
    /- name: Install Chromium for Node tests\r?\n        run: npx playwright install --with-deps chromium/,
  )
  assertWorkflowStepBefore(
    codeQualityJob,
    "npx playwright install --with-deps chromium",
    "npm run test",
  )
})

test("browser QA enables the isolated RSC session proof at build and runtime", async () => {
  const workflow = await readProjectFile(".github/workflows/ci.yml")

  for (const jobId of ["browser_build", "browser_qa"]) {
    assert.match(
      getWorkflowJob(workflow, jobId),
      /^      NEXT_PUBLIC_RSC_SESSION_PROOF: "1"\r?$/m,
      `Expected ${jobId} to enable NEXT_PUBLIC_RSC_SESSION_PROOF`,
    )
  }
})

test("mobile Background carousel fixtures include the default preview", async () => {
  const publicRoutesSpec = await readProjectFile("tests/browser/public-routes.spec.ts")
  const fixtureStart = publicRoutesSpec.indexOf(
    'test(`Background default navigation and Background drag keep',
  )
  assert.notEqual(fixtureStart, -1, "Expected to locate the mobile Background fixture start")

  const fixtureEnd = publicRoutesSpec.indexOf(
    '\ntest("Atmosphere lists the Generative.fm catalog',
    fixtureStart,
  )

  assert.notEqual(fixtureEnd, -1, "Expected to locate the mobile Background fixture end")
  assert.match(
    publicRoutesSpec.slice(fixtureStart, fixtureEnd),
    /"massage-lab-gradient-vertical"/,
  )
})

test("public media journeys fixture opportunistic atmosphere prewarms", async () => {
  const publicRoutesSpec = await readProjectFile("tests/browser/public-routes.spec.ts")
  const genericStart = publicRoutesSpec.indexOf("for (const route of publicRoutes)")
  const genericEnd = publicRoutesSpec.indexOf(
    '\ntest("core public tool surfaces',
    genericStart,
  )
  const coreToolsStart = genericEnd
  const coreToolsEnd = publicRoutesSpec.indexOf(
    '\ntest("active app-tool metal ring',
    coreToolsStart,
  )
  const activeToolRingStart = coreToolsEnd
  const activeToolRingEnd = publicRoutesSpec.indexOf(
    '\ntest("main bar exposes brand music clock quick create theme calendar and more controls',
    activeToolRingStart,
  )
  const mainBarStart = activeToolRingEnd
  const mainBarEnd = publicRoutesSpec.indexOf(
    '\ntest("main bar edge control stays aligned with the compact sidebar rail',
    mainBarStart,
  )
  const topAppBarStart = publicRoutesSpec.indexOf(
    'test("top app bar quick actions open inside the viewport below the plus button',
    mainBarEnd,
  )
  const topAppBarEnd = publicRoutesSpec.indexOf(
    '\ntest("mobile quick-create button opens a vertical speed dial',
    topAppBarStart,
  )
  const visualizerStart = publicRoutesSpec.indexOf(
    'test("Music visualizer background selection and account default actions',
  )
  const visualizerEnd = publicRoutesSpec.indexOf(
    '\ntest("Music account preference owner switch',
    visualizerStart,
  )

  for (const [boundaryName, boundary] of Object.entries({
    genericStart,
    genericEnd,
    coreToolsStart,
    coreToolsEnd,
    activeToolRingStart,
    activeToolRingEnd,
    mainBarStart,
    mainBarEnd,
    topAppBarStart,
    topAppBarEnd,
    visualizerStart,
    visualizerEnd,
  })) {
    assert.notEqual(boundary, -1, `Expected to locate ${boundaryName} in public-routes.spec.ts`)
  }
  const journeys = [
    ["generic public routes", publicRoutesSpec.slice(genericStart, genericEnd)],
    ["core public tools", publicRoutesSpec.slice(coreToolsStart, coreToolsEnd)],
    ["active tool ring", publicRoutesSpec.slice(activeToolRingStart, activeToolRingEnd)],
    ["main bar", publicRoutesSpec.slice(mainBarStart, mainBarEnd)],
    ["top app bar", publicRoutesSpec.slice(topAppBarStart, topAppBarEnd)],
    ["music visualizer", publicRoutesSpec.slice(visualizerStart, visualizerEnd)],
  ]

  for (const [journeyName, journeySource] of journeys) {
    const fixtureIndex = journeySource.search(initialAtmosphereFixturePattern)
    const firstNavigationIndex = journeySource.indexOf("await page.goto")
    assert.notEqual(fixtureIndex, -1, `${journeyName} installs the exact initial Atmosphere fixture`)
    assert.notEqual(firstNavigationIndex, -1, `${journeyName} contains a page navigation`)
    assert.ok(
      fixtureIndex < firstNavigationIndex,
      `${journeyName} installs its exact initial Atmosphere fixture before navigation`,
    )
  }

  const coreToolsSource = publicRoutesSpec.slice(coreToolsStart, coreToolsEnd)
  assert.match(coreToolsSource, /const health = await capturePageHealth\(page, new Set\(\)\)/)
  assert.equal(
    (coreToolsSource.match(initialAtmosphereFixturePattern) ?? []).length,
    1,
    "the multi-route core journey owns exactly one initial Atmosphere fixture",
  )
  const coreRouteLoop = coreToolsSource.match(/for \(const path of \[([^\]]+)]\) \{/)
  assert.ok(coreRouteLoop, "the multi-route core journey keeps an explicit route list")
  const coreRoutePaths = [...coreRouteLoop[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
  assert.equal(coreRoutePaths.at(-1), "/music", "the multi-route core journey visits Music last")
  const coreMusicGuardMatch = musicPathGuardPattern.exec(coreToolsSource)
  assert.ok(coreMusicGuardMatch, "the multi-route core journey has a Music-only fixture guard")
  const coreMusicGuardIndex = coreMusicGuardMatch.index
  const coreMusicGuardOpeningBraceIndex = coreMusicGuardIndex + coreMusicGuardMatch[0].lastIndexOf("{")
  const coreFixtureIndex = coreToolsSource.search(initialAtmosphereFixturePattern)
  const coreMusicGuardEndIndex = findMatchingBraceIndex(coreToolsSource, coreMusicGuardOpeningBraceIndex)
  assert.notEqual(coreMusicGuardEndIndex, -1, "the Music-only fixture guard has an explicit boundary")
  const coreLoopNavigationIndex = coreToolsSource.indexOf("await page.goto(path", coreMusicGuardEndIndex)
  assert.notEqual(coreLoopNavigationIndex, -1, "the Music-only fixture guard precedes the loop navigation")
  assert.ok(
    coreMusicGuardIndex < coreFixtureIndex && coreFixtureIndex < coreMusicGuardEndIndex,
    "the multi-route core journey grants the exact prewarm fixture only inside the Music guard",
  )
  assert.equal(
    coreToolsSource.slice(coreMusicGuardEndIndex + 1, coreLoopNavigationIndex).trim(),
    "",
    "the Music-only fixture guard stays immediately before the loop navigation",
  )
})

test("browser QA lanes cover each ordinary project and spec exactly once", async () => {
  const expectedProjects = ["desktop-chromium", "mobile-chromium"]
  const expectedSpecs = [
    "admin-user-operations.spec.ts",
    "app-shell.spec.ts",
    "atmoshaper.spec.ts",
    "background-commerce.spec.ts",
    "control-system-review.spec.ts",
    "identity-method-safety.spec.ts",
    "immersive-panel-shell.spec.ts",
    "interaction-feedback.spec.ts",
    "local-first.spec.ts",
    "membership-return-status.spec.ts",
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
  assert.equal(expectedSpecs.length, 14)
  assert.equal(expectedPairs.size, 28)

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
          "**/identity-method-safety.spec.ts",
          "**/membership-return-status.spec.ts",
          "**/interaction-feedback.spec.ts",
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
          "**/identity-method-safety.spec.ts",
          "**/membership-return-status.spec.ts",
          "**/interaction-feedback.spec.ts",
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

test("Playwright-owned Browser QA enables Google controls with inert spawned-server credentials only", async () => {
  const config = await readProjectFile("playwright.config.ts")

  assert.match(
    config,
    /Object\.assign\(playwrightWebServerEnvironment,[\s\S]*AUTH_GOOGLE_ID:\s*"browser-qa-inert-google-client-id\.invalid"/,
  )
  assert.match(
    config,
    /Object\.assign\(playwrightWebServerEnvironment,[\s\S]*AUTH_GOOGLE_SECRET:\s*"browser-qa-inert-google-client-secret\.invalid"/,
  )
  assert.doesNotMatch(config, /process\.env\.AUTH_GOOGLE_(?:ID|SECRET)\s*=/)
  for (const name of ["SMTP_HOST", "SMTP_FROM", "SMTP_USER", "SMTP_PASSWORD", "SMTP_PORT"]) {
    assert.match(config, new RegExp(`${name}: ""`))
  }
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
  assert.equal(packageData.scripts["test:browser:build"], "npm run build:browser-qa && npm run test:browser")

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

test("media readiness QA targets the dedicated proof runtime when mixer bundles share its exports", async () => {
  const mediaSessionSpec = await readProjectFile("tests/browser/music-media-session.spec.ts")

  assert.match(mediaSessionSpec, /source\.includes\('\"startToneProofDrone\",0'\)/)
  assert.match(mediaSessionSpec, /source\.includes\('\"getToneProofDroneDiagnostics\",0'\)/)
  assert.match(mediaSessionSpec, /!source\.includes\('\"createAtmoShaperRuntime\",0'\)/)
})

test("CI workflow parallelizes browser QA and aggregates every upstream result", async () => {
  const ciWorkflow = await readProjectFile(".github/workflows/ci.yml")

  assert.match(ciWorkflow, /^  code_quality:\r?$/m)
  assert.match(ciWorkflow, /^  browser_build:\r?$/m)
  assert.match(ciWorkflow, /^  browser_qa:\r?$/m)
  assert.match(ciWorkflow, /^  qa:\r?$/m)
  assert.match(ciWorkflow, /code_quality:\r?\n    name: Code quality[\s\S]*?timeout-minutes: 12/)
  assert.match(ciWorkflow, /browser_build:\r?\n    name: Browser build[\s\S]*?timeout-minutes: 12/)
  assert.match(ciWorkflow, /browser_qa:\r?\n    name: Browser QA \(lane \$\{\{ matrix\.lane \}\}\)[\s\S]*?needs: browser_build[\s\S]*?timeout-minutes: 20/)
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
