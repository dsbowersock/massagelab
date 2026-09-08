import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import { resolveCiBrowserQaLaneProjects } from "./tests/browser/ci-lanes.mjs"
import { isBrowserQaDatabaseTargetAuthorized } from "./scripts/assert-browser-qa-database-target.mjs"
import {
  assertBrowserQaTelemetryEnvironment,
  BROWSER_QA_INERT_PROVIDER_ENVIRONMENT,
  BROWSER_QA_TELEMETRY_ENVIRONMENT,
  resolveBrowserQaDatabaseEnvironment,
} from "./scripts/browser-qa-environment.mjs"

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
const usesAuthorizedBrowserQaDatabase = isBrowserQaDatabaseTargetAuthorized(process.env)
const skipWebServer = parseBooleanEnv(process.env.PLAYWRIGHT_SKIP_WEB_SERVER)
assertBrowserQaOwnedServerRequirement(skipWebServer)
assertBrowserQaRepeatEachSupported(process.argv.slice(2))
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
const migrationParitySpec = "tests/browser/atmoshaper-repository-migration-parity.spec.ts"

/** Matches only an exact migration-spec path, including absolute paths and line selectors. */
export function isMigrationParityInvocation(argv: readonly string[]) {
  return getPlaywrightFileFilterArguments(argv)
    .filter((argument, index) => index !== 0 || !playwrightSubcommands.has(argument))
    .some((argument) => {
      const normalized = argument.replaceAll("\\", "/").replace(/:\d+(?::\d+)?$/, "")
      return normalized === migrationParitySpec || normalized.endsWith(`/${migrationParitySpec}`)
    })
}

/** Explicit empty values prevent Next dotenv fallback and Browser-QA provider traffic. */
export const browserQaTelemetryEnvironment = BROWSER_QA_TELEMETRY_ENVIRONMENT

export const migrationParityTelemetryEnvironment = browserQaTelemetryEnvironment

/** Fails without echoing values; run before the fresh build and owned-server capture. */
export function assertMigrationParityTelemetryEnvironment(environment: NodeJS.ProcessEnv) {
  assertBrowserQaTelemetryEnvironment(environment, { label: "Migration parity" })
}

/** Canonical Browser QA always requires the exact server lifecycle Playwright owns. */
export function assertBrowserQaOwnedServerRequirement(skipsOwnedServer: boolean) {
  if (skipsOwnedServer) {
    throw new Error("Browser QA requires Playwright's owned web server.")
  }
}

/** Only an exact single copy preserves deterministic fixture ownership. */
export function assertBrowserQaRepeatEachSupported(argv: readonly string[]) {
  let repeatEachIndex = -1
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--") break
    if (argument === "--repeat-each" || argument.startsWith("--repeat-each=")) {
      if (repeatEachIndex !== -1) {
        throw new Error("Browser QA supports at most one --repeat-each option with deterministic fixtures.")
      }
      repeatEachIndex = index
    }
  }
  if (repeatEachIndex === -1) return

  const argument = argv[repeatEachIndex]
  const value = argument === "--repeat-each"
    ? argv[repeatEachIndex + 1]
    : argument.slice("--repeat-each=".length)
  if (value !== "1") {
    throw new Error("Browser QA supports only the exact --repeat-each value 1 with deterministic fixtures.")
  }
}

/** Resolves the isolated environment for the server Playwright starts and stops. */
export function resolvePlaywrightWebServerEnvironment(
  environment: Record<string, string | undefined>,
  baseUrl: string,
) {
  const resolved: Record<string, string> = {}
  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined) resolved[name] = value
  }
  Object.assign(resolved, {
    AUTH_URL: baseUrl,
    NEXTAUTH_URL: baseUrl,
    ...BROWSER_QA_INERT_PROVIDER_ENVIRONMENT,
    ...browserQaTelemetryEnvironment,
    ...resolveBrowserQaDatabaseEnvironment(environment),
  })
  return resolved
}

/** Detects review-spec filters without treating a Playwright subcommand as a file filter. */
export function isDevelopmentPaletteReviewInvocation(argv: readonly string[]) {
  return getPlaywrightFileFilterArguments(argv)
    .filter((argument, index) => index !== 0 || !playwrightSubcommands.has(argument))
    .some(matchesDevelopmentPaletteReviewArgument)
}

/** Resolves development-only review exclusions from explicit Playwright arguments. */
export function resolveDevelopmentPaletteReviewIgnoreGlobs(argv: readonly string[]) {
  return isDevelopmentPaletteReviewInvocation(argv)
    ? []
    : [...developmentPaletteReviewIgnoreGlobs]
}

const runsDevelopmentPaletteReview = isDevelopmentPaletteReviewInvocation(process.argv.slice(2))
const runsMigrationParity = isMigrationParityInvocation(process.argv.slice(2))
if (runsMigrationParity && process.env.ATMOSHAPER_MIGRATION_PARITY === "1" && !process.argv.includes("--list")) {
  assertMigrationParityTelemetryEnvironment(process.env)
}
const defaultWebServerCommand = runsDevelopmentPaletteReview
  ? `npm run dev -- -p ${browserQaPort}`
  : `npm run start -- -p ${browserQaPort}`

// Playwright owns this spawned server, so it must not inherit a developer's
// live SMTP or Google OAuth credentials. Inert Google values render the public
// controls for fully intercepted QA; SMTP remains blank so account-change
// delivery fails safely and locally.
const playwrightWebServerEnvironment = resolvePlaywrightWebServerEnvironment(
  process.env,
  browserQaBaseUrl,
)
if (runsMigrationParity && process.env.ATMOSHAPER_MIGRATION_PARITY === "1") {
  Object.assign(playwrightWebServerEnvironment, migrationParityTelemetryEnvironment)
}

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
  // Serialize migration capture and fingerprint-approved fixture ownership.
  // Migration Home pins the browser clock before a cached client remount, while
  // connected fixtures deliberately use deterministic project/owner identities.
  workers: runsMigrationParity || usesAuthorizedBrowserQaDatabase || process.env.CI ? 1 : undefined,
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
  webServer: {
    command: process.env.PLAYWRIGHT_START_COMMAND ?? defaultWebServerCommand,
    url: browserQaBaseUrl,
    env: playwrightWebServerEnvironment,
    // Every Browser-QA result must come from this exact build and owned
    // environment; an occupied port is always a hard failure.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
