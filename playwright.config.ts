import { defineConfig, devices } from "@playwright/test"

const defaultBrowserQaPort = 3010
const defaultBrowserQaBaseUrl = "http://127.0.0.1:3010"
const browserQaPort = Number(process.env.PLAYWRIGHT_PORT ?? defaultBrowserQaPort)
const browserQaBaseUrl = process.env.PLAYWRIGHT_BASE_URL
  ?? (browserQaPort === defaultBrowserQaPort ? defaultBrowserQaBaseUrl : `http://127.0.0.1:${browserQaPort}`)

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
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_START_COMMAND ?? `npm run start -- -p ${browserQaPort}`,
        url: browserQaBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
