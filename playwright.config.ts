import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import { resolveCiBrowserQaLaneProjects } from "./tests/browser/ci-lanes.mjs"

const defaultBrowserQaPort = 3010
const defaultBrowserQaBaseUrl = "http://localhost:3010"
const defaultBrowserQaAuthSecret = "local-browser-qa-auth-secret-not-for-production-use-only"

// Browser QA exercises signed-in shell states without requiring a developer's
// real secret. CI and explicitly configured environments keep their own value.
process.env.AUTH_SECRET ||= process.env.NEXTAUTH_SECRET || defaultBrowserQaAuthSecret
process.env.NEXTAUTH_SECRET ||= process.env.AUTH_SECRET

function parseBrowserQaPort(value: string | undefined) {
  if (!value) {
    return defaultBrowserQaPort
  }

  const parsedPort = Number(value)
  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : defaultBrowserQaPort
}

function parseBooleanEnv(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized === "1" || normalized === "true"
}

const browserQaPort = parseBrowserQaPort(process.env.PLAYWRIGHT_PORT)
const browserQaBaseUrl = process.env.PLAYWRIGHT_BASE_URL
  ?? (browserQaPort === defaultBrowserQaPort ? defaultBrowserQaBaseUrl : `http://localhost:${browserQaPort}`)
const skipWebServer = parseBooleanEnv(process.env.PLAYWRIGHT_SKIP_WEB_SERVER)
const developmentPaletteReviewSpecs = [
  "tests/browser/background-palette.spec.ts",
  "tests/browser/background-carousel-preview.spec.ts",
  "tests/browser/background-preview-pilot.spec.ts",
  "tests/browser/dna-twisted-cubes-backgrounds.spec.ts",
]
const developmentPaletteReviewIgnoreGlobs = developmentPaletteReviewSpecs
  .map((spec) => `**/${path.posix.basename(spec)}`)

/** Matches an exact normalized review-spec path or the same path with a leading directory. */
function matchesExactDevelopmentPaletteReviewSpec(normalizedArgument: string) {
  return developmentPaletteReviewSpecs.some((spec) => (
    normalizedArgument === spec || normalizedArgument.endsWith(`/${spec}`)
  ))
}

/** Matches a bare filename against basenames, or a partial path against full review-spec paths. */
function matchesDevelopmentPaletteReviewSubstring(normalizedArgument: string) {
  const argumentBasename = path.posix.basename(normalizedArgument)
  const isStandaloneFilter = normalizedArgument === argumentBasename && argumentBasename.length > 0
  const substringMatches = !isStandaloneFilter
    ? developmentPaletteReviewSpecs.filter((spec) => (
      spec.includes(normalizedArgument)
    ))
    : developmentPaletteReviewSpecs.filter((spec) => (
      path.posix.basename(spec).includes(argumentBasename)
    ))
  return substringMatches.length > 0
}

/**
 * Matches the bounded regex-like subset used by Playwright file filters without
 * compiling command-line input as a regular expression.
 */
function matchesSpecFilterPattern(argument: string, specs: readonly string[]) {
  if (argument.length === 0 || argument.length > 512) return false

  let normalizedPattern = argument
    .replaceAll(String.raw`[\\/]`, "/")
    .replaceAll(String.raw`[/\\]`, "/")
    .replaceAll(String.raw`\/`, "/")
    .replaceAll(String.raw`\\`, "/")
    .replaceAll(String.raw`\.`, ".")
    .replaceAll(String.raw`\-`, "-")
  const requiresStart = normalizedPattern.startsWith("^")
  const requiresEnd = normalizedPattern.endsWith("$")
  if (requiresStart) normalizedPattern = normalizedPattern.slice(1)
  if (requiresEnd) normalizedPattern = normalizedPattern.slice(0, -1)

  const startsWithWildcard = /^(?:\.\*|\.\+)/.test(normalizedPattern)
  const endsWithWildcard = /(?:\.\*|\.\+)$/.test(normalizedPattern)
  const fragments = normalizedPattern.split(/\.\*|\.\+/)
  if (fragments.some((fragment) => /[\[\]{}()|?*+^$]/.test(fragment))) return false

  return specs.some((spec) => {
    const candidate = path.resolve(spec).replaceAll("\\", "/")
    let searchFrom = 0
    for (const fragment of fragments) {
      if (!fragment) continue
      const fragmentIndex = candidate.indexOf(fragment, searchFrom)
      if (fragmentIndex === -1) return false
      if (requiresStart && !startsWithWildcard && searchFrom === 0 && fragmentIndex !== 0) return false
      searchFrom = fragmentIndex + fragment.length
    }
    return !requiresEnd || endsWithWildcard || searchFrom === candidate.length
  })
}

/** Matches exact development-review specs plus Playwright substring and regex filters. */
export function matchesDevelopmentPaletteReviewArgument(argument: string) {
  const normalizedArgument = argument
    .replaceAll("\\", "/")
    .replace(/:\d+(?::\d+)?$/, "")
  if (matchesExactDevelopmentPaletteReviewSpec(normalizedArgument)) return true
  // Any selected review spec requires the development server, including one
  // substring or regex filter that intentionally selects both review specs.
  if (matchesDevelopmentPaletteReviewSubstring(normalizedArgument)) return true
  return matchesSpecFilterPattern(argument, developmentPaletteReviewSpecs)
}

const playwrightOptionsWithSeparateValues = new Set([
  "-c", "--config", "-g", "--grep", "-G", "--grep-invert", "-j", "--workers",
  "--reporter", "--retries", "--timeout", "--global-timeout",
  "--max-failures", "--output", "--shard", "--trace", "--repeat-each", "--tsconfig",
  "--browser", "--last-failed-file", "--test-list", "--test-list-invert",
  "--ui-host", "--ui-port", "--update-source-method",
])
const playwrightOptionsWithOptionalSeparateValues = new Set(["--only-changed"])
const playwrightOptionsWithVariadicValues = new Set(["--project"])

/** Returns only positional Playwright arguments, excluding option names and their values. */
export function getPlaywrightFileFilterArguments(argv: readonly string[]) {
  const positionalArguments: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--") {
      positionalArguments.push(...argv.slice(index + 1))
      break
    }
    if (playwrightOptionsWithSeparateValues.has(argument)) {
      index += 1
      continue
    }
    if (playwrightOptionsWithOptionalSeparateValues.has(argument)) {
      if (argv[index + 1] && !argv[index + 1].startsWith("-")) index += 1
      continue
    }
    if (playwrightOptionsWithVariadicValues.has(argument)) {
      // Playwright greedily treats following non-option operands as project names;
      // callers must use `--` before a positional file filter after `--project`.
      while (argv[index + 1] && !argv[index + 1].startsWith("-")) index += 1
      continue
    }
    if (argument.startsWith("-")) continue
    positionalArguments.push(argument)
  }
  return positionalArguments
}

const playwrightSubcommands = new Set(["test", "show-report", "codegen", "install"])
const adminUserOperationsSpec = "tests/browser/admin-user-operations.spec.ts"

/** Matches the safe Playwright file-filter subset that can select the Admin spec. */
function matchesAdminUserOperationsArgument(argument: string) {
  const normalizedArgument = argument
    .replaceAll("\\", "/")
    .replace(/:\d+(?::\d+)?$/, "")
  if (
    normalizedArgument === adminUserOperationsSpec
    || normalizedArgument.endsWith(`/${adminUserOperationsSpec}`)
  ) return true

  const argumentBasename = path.posix.basename(normalizedArgument)
  const isStandaloneFilter = normalizedArgument === argumentBasename && argumentBasename.length > 0
  const substringMatches = isStandaloneFilter
    ? path.posix.basename(adminUserOperationsSpec).includes(argumentBasename)
    : adminUserOperationsSpec.includes(normalizedArgument)
  if (substringMatches) return true

  return matchesSpecFilterPattern(argument, [adminUserOperationsSpec])
}

/** Detects review-spec filters without treating a Playwright subcommand as a file filter. */
export function isDevelopmentPaletteReviewInvocation(argv: readonly string[]) {
  return getPlaywrightFileFilterArguments(argv)
    .filter((argument, index) => index !== 0 || !playwrightSubcommands.has(argument))
    .some(matchesDevelopmentPaletteReviewArgument)
}

/**
 * Identifies runs that can execute Admin account mutations. An invocation with
 * no file filter includes the Admin spec, so it must receive the same isolated
 * SMTP-disabled server as an explicit selection of that spec.
 */
export function isAdminUserOperationsInvocation(argv: readonly string[]) {
  const fileFilters = getPlaywrightFileFilterArguments(argv)
    .filter((argument, index) => index !== 0 || !playwrightSubcommands.has(argument))
  if (fileFilters.length === 0) return true

  return fileFilters.some(matchesAdminUserOperationsArgument)
}

/** Resolves development-only review exclusions from explicit Playwright arguments. */
export function resolveDevelopmentPaletteReviewIgnoreGlobs(argv: readonly string[]) {
  return isDevelopmentPaletteReviewInvocation(argv)
    ? []
    : [...developmentPaletteReviewIgnoreGlobs]
}

const runsDevelopmentPaletteReview = isDevelopmentPaletteReviewInvocation(process.argv.slice(2))
const runsAdminUserOperations = isAdminUserOperationsInvocation(process.argv.slice(2))
const defaultWebServerCommand = runsDevelopmentPaletteReview
  ? `npm run dev -- -p ${browserQaPort}`
  : `npm run start -- -p ${browserQaPort}`

// Playwright owns this spawned server, so it must not inherit a developer's
// live SMTP transport. Blank values preserve production behavior while making
// automated account-change delivery fail safely and locally.
const playwrightWebServerEnvironment: Record<string, string> = {}
for (const [name, value] of Object.entries(process.env)) {
  if (value !== undefined) playwrightWebServerEnvironment[name] = value
}
Object.assign(playwrightWebServerEnvironment, {
  SMTP_HOST: "",
  SMTP_FROM: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_PORT: "",
})

const ordinaryProjects = [
  {
    name: "desktop-chromium",
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 1280, height: 900 },
    },
  },
  {
    name: "mobile-chromium",
    use: {
      ...devices["Pixel 7"],
    },
  },
  {
    // Focused compatibility smoke only; CI lanes remain Chromium-only.
    name: "webkit-media-smoke",
    testMatch: /music-media-session\.spec\.ts/,
    use: {
      ...devices["Desktop Safari"],
      viewport: { width: 1024, height: 768 },
    },
  },
]
const ciBrowserQaLaneProjects = resolveCiBrowserQaLaneProjects(process.env.PLAYWRIGHT_CI_LANE)
// PLAYWRIGHT_CI_LANE narrows CI discovery to each lane's project/spec pairs;
// spreading the ordinary project retains its established device and viewport settings.
const browserQaProjects = ciBrowserQaLaneProjects
  ? ciBrowserQaLaneProjects.map((laneProject) => {
      const ordinaryProject = ordinaryProjects.find((project) => project.name === laneProject.name)
      if (!ordinaryProject) {
        throw new Error(`Browser QA lane references an unconfigured Playwright project: ${laneProject.name}`)
      }
      return {
        ...ordinaryProject,
        testMatch: laneProject.testMatch,
      }
    })
  : ordinaryProjects

export default defineConfig({
  testDir: "tests/browser",
  // The palette gallery is development-only. Ordinary production-server QA
  // excludes it, while an exact-spec invocation flips the dev server on and
  // keeps the review matrix runnable.
  testIgnore: resolveDevelopmentPaletteReviewIgnoreGlobs(process.argv.slice(2)),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  expect: {
    timeout: 7_500,
  },
  use: {
    baseURL: browserQaBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: browserQaProjects,
  webServer: skipWebServer
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_START_COMMAND ?? defaultWebServerCommand,
        url: browserQaBaseUrl,
        env: playwrightWebServerEnvironment,
        // A stale production server would turn a development review into a
        // misleading 404. Fail on the occupied port instead of reusing it.
        reuseExistingServer: !process.env.CI && !runsDevelopmentPaletteReview && !runsAdminUserOperations,
        timeout: 120_000,
      },
})
