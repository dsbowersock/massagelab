import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

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
  "tests/browser/dna-twisted-cubes-backgrounds.spec.ts",
]
const developmentPaletteReviewIgnoreGlobs = developmentPaletteReviewSpecs
  .map((spec) => `**/${path.posix.basename(spec)}`)

/** Matches exact development-review specs plus Playwright substring and regex filters. */
export function matchesDevelopmentPaletteReviewArgument(argument: string) {
  const normalizedArgument = argument
    .replaceAll("\\", "/")
    .replace(/:\d+(?::\d+)?$/, "")
  const argumentBasename = path.posix.basename(normalizedArgument)
  const isStandaloneFilter = normalizedArgument === argumentBasename && argumentBasename.length > 0
  if (developmentPaletteReviewSpecs.some((spec) => (
    normalizedArgument === spec || normalizedArgument.endsWith(`/${spec}`)
  ))) return true
  const substringMatches = !isStandaloneFilter
    ? developmentPaletteReviewSpecs.filter((spec) => (
      spec.includes(normalizedArgument)
    ))
    : developmentPaletteReviewSpecs.filter((spec) => (
      path.posix.basename(spec).includes(argumentBasename)
    ))
  // Only unique substrings select the development server. Ambiguous or absent
  // substring matches fall through to Playwright's absolute-path regex model.
  if (substringMatches.length === 1) return true

  try {
    const filter = new RegExp(argument)
    const regexMatches = developmentPaletteReviewSpecs.filter((spec) => {
      const absoluteSpec = path.resolve(spec)
      const absoluteFormats = new Set([
        absoluteSpec,
        absoluteSpec.replaceAll("\\", "/"),
        absoluteSpec.replaceAll("/", "\\"),
      ])
      return [...absoluteFormats].some((candidate) => {
        filter.lastIndex = 0
        return filter.test(candidate)
      })
    })
    return regexMatches.length === 1
  } catch {
    return false
  }
}

const playwrightOptionsWithSeparateValues = new Set([
  "-c", "--config", "-g", "--grep", "--grep-invert", "-j", "--workers",
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

/** Detects review-spec filters without treating a Playwright subcommand as a file filter. */
export function isDevelopmentPaletteReviewInvocation(argv: readonly string[]) {
  return getPlaywrightFileFilterArguments(argv)
    .filter((argument, index) => index !== 0 || !playwrightSubcommands.has(argument))
    .some(matchesDevelopmentPaletteReviewArgument)
}

const runsDevelopmentPaletteReview = isDevelopmentPaletteReviewInvocation(process.argv.slice(2))
const defaultWebServerCommand = runsDevelopmentPaletteReview
  ? `npm run dev -- -p ${browserQaPort}`
  : `npm run start -- -p ${browserQaPort}`

export default defineConfig({
  testDir: "tests/browser",
  // The palette gallery is development-only. Ordinary production-server QA
  // excludes it, while an exact-spec invocation flips the dev server on and
  // keeps the review matrix runnable.
  testIgnore: runsDevelopmentPaletteReview
    ? []
    : developmentPaletteReviewIgnoreGlobs,
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
  projects: [
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
  ],
  webServer: skipWebServer
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_START_COMMAND ?? defaultWebServerCommand,
        url: browserQaBaseUrl,
        // A stale production server would turn a development review into a
        // misleading 404. Fail on the occupied port instead of reusing it.
        reuseExistingServer: !process.env.CI && !runsDevelopmentPaletteReview,
        timeout: 120_000,
      },
})
