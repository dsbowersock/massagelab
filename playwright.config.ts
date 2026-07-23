import { defineConfig, devices } from "@playwright/test"

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

export default defineConfig({
  testDir: "tests/browser",
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
        command: process.env.PLAYWRIGHT_START_COMMAND ?? `npm run start -- -p ${browserQaPort}`,
        url: browserQaBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
