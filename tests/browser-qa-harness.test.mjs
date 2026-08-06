import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  getPlaywrightFileFilterArguments,
  isDevelopmentPaletteReviewInvocation,
  matchesDevelopmentPaletteReviewArgument,
  resolveDevelopmentPaletteReviewIgnoreGlobs,
} from "../playwright.config.ts"

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
    "**/background-preview-pilot.spec.ts",
    "**/dna-twisted-cubes-backgrounds.spec.ts",
  ]
  assert.deepEqual(resolveDevelopmentPaletteReviewIgnoreGlobs(["test"]), reviewIgnoreGlobs)
  assert.deepEqual(
    resolveDevelopmentPaletteReviewIgnoreGlobs(["test", "tests/browser/background-palette.spec.ts"]),
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
