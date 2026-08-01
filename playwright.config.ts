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

/** Matches exact development-review specs and Playwright's standalone substring filters. */
export function matchesDevelopmentPaletteReviewArgument(argument: string) {
  const normalizedArgument = argument
    .replaceAll("\\", "/")
    .replace(/:\d+(?::\d+)?$/, "")
  const argumentBasename = path.posix.basename(normalizedArgument)
  const isStandaloneFilter = normalizedArgument === argumentBasename && argumentBasename.length > 0
  if (developmentPaletteReviewSpecs.some((spec) => (
    normalizedArgument === spec || normalizedArgument.endsWith(`/${spec}`)
  ))) return true
  if (!isStandaloneFilter) return false

  // Playwright accepts positional filename substrings. Only switch servers
  // when that substring identifies exactly one development-only review spec.
  return developmentPaletteReviewSpecs.filter((spec) => (
    path.posix.basename(spec).includes(argumentBasename)
  )).length === 1
}

const playwrightOptionsWithSeparateValues = new Set([
  "-c", "--config", "-g", "--grep", "--grep-invert", "-j", "--workers",
  "--project", "--reporter", "--retries", "--timeout", "--global-timeout",
  "--max-failures", "--output", "--shard", "--trace", "--repeat-each", "--tsconfig",
])

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
    if (argument.startsWith("-")) continue
    positionalArguments.push(argument)
  }
  return positionalArguments
}

const runsDevelopmentPaletteReview = getPlaywrightFileFilterArguments(process.argv.slice(2))
  .some(matchesDevelopmentPaletteReviewArgument)
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
    : ["**/background-palette.spec.ts", "**/dna-twisted-cubes-backgrounds.spec.ts"],
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
