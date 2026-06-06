import { expect, test, type Page, type Response } from "@playwright/test"

const publicRoutes = [
  { path: "/", expectedText: /MassageLab/i },
  { path: "/notes", expectedText: /Therapist or Team\/Practice required/i },
  { path: "/notes/soap", expectedText: /Therapist membership required/i },
  { path: "/chimer", expectedText: /Chimer/i },
  { path: "/calendar", expectedText: /Calendar/i },
  { path: "/education", expectedText: /Education/i },
  { path: "/education/flashcards", expectedText: /Flashcards/i },
  { path: "/education/flashcards/decks", expectedText: /Community Decks/i },
  { path: "/education/flashcards/decks/starter-all-body-identification", expectedText: /All-body image identification/i },
  { path: "/anatomime", expectedText: /Anatomime/i },
] as const

const forbiddenAnonymousEndpoints = [
  "/api/account/preferences",
  "/api/account/profile",
] as const

function formatResponse(response: Response) {
  const url = new URL(response.url())
  return `${response.status()} ${url.pathname}`
}

function isLocalHttpUrl(urlString: string) {
  const url = new URL(urlString)
  return ["127.0.0.1", "localhost"].includes(url.hostname)
}

function capturePageHealth(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedLocalResponses: string[] = []
  const forbiddenRequests: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })

  page.on("request", (request) => {
    const url = new URL(request.url())
    if (forbiddenAnonymousEndpoints.includes(url.pathname as typeof forbiddenAnonymousEndpoints[number])) {
      forbiddenRequests.push(`${request.method()} ${url.pathname}`)
    }
  })

  page.on("response", (response) => {
    if (response.status() >= 400 && isLocalHttpUrl(response.url())) {
      failedLocalResponses.push(formatResponse(response))
    }
  })

  return {
    consoleErrors,
    failedLocalResponses,
    forbiddenRequests,
    pageErrors,
  }
}

for (const route of publicRoutes) {
  test(`anonymous public route ${route.path} renders without browser regressions`, async ({ page }) => {
    const health = capturePageHealth(page)

    await page.goto(route.path, { waitUntil: "domcontentloaded" })
    await expect(page.locator("body")).toContainText(route.expectedText)
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
    await page.waitForTimeout(250)

    expect(health.pageErrors, "uncaught page errors").toEqual([])
    expect(health.consoleErrors, "browser console errors").toEqual([])
    expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
    expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
  })
}

test("anonymous flashcards setup keeps prompt controls usable before count hydration", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/education/flashcards", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Build A Deck" })).toBeVisible()

  const startButton = page.getByRole("button", { name: /Start [1-9]/ })
  await expect(startButton).toBeEnabled()
  await expect(page.getByText(/eligible prompts/i)).not.toContainText(/^0 eligible prompts$/)

  const selectedPromptCheckboxes = page.locator('[role="checkbox"][aria-checked="true"]')
  await expect(selectedPromptCheckboxes.first()).toBeEnabled()

  await startButton.click()
  await expect(page.getByText(/1 of \d+/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("button", { name: /Check|Correct|Missed/i })).toBeVisible()

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})
