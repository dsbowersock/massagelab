import { expect, test, type Page, type Request } from "@playwright/test"

const ML_BROWSER_QA_SENTINEL = "ML_BROWSER_QA_SENTINEL client shoulder pain"
const mutatingMethods = /POST|PUT|PATCH|DELETE/

const blockedClinicalUploadPaths = [
  "/api/account/preferences",
  "/api/account/profile",
  "/api/clinical/sync",
  "/api/clients/",
] as const

function requestHitsBlockedClinicalPath(request: Request) {
  const url = new URL(request.url())
  return blockedClinicalUploadPaths.some((path) => (
    path.endsWith("/") ? url.pathname.startsWith(path) : url.pathname === path
  ))
}

function requestCarriesSentinel(request: Request) {
  const rawUrl = request.url()
  const encodedSentinel = encodeURIComponent(ML_BROWSER_QA_SENTINEL)
  let decodedUrl = rawUrl

  try {
    decodedUrl = decodeURIComponent(rawUrl)
  } catch {
    decodedUrl = rawUrl
  }

  return rawUrl.includes(ML_BROWSER_QA_SENTINEL)
    || rawUrl.includes(encodedSentinel)
    || decodedUrl.includes(ML_BROWSER_QA_SENTINEL)
    || (request.postData() ?? "").includes(ML_BROWSER_QA_SENTINEL)
}

function captureClinicalNetworkLeaks(page: Page) {
  const leaks: string[] = []

  page.on("request", (request) => {
    const url = new URL(request.url())
    const method = request.method()
    const isBlockedClinicalPath = requestHitsBlockedClinicalPath(request)
    const isClinicalPayloadMutation = mutatingMethods.test(method) && requestCarriesSentinel(request)

    if (isBlockedClinicalPath || isClinicalPayloadMutation) {
      leaks.push(`${method} ${url.pathname}`)
    }
  })

  return leaks
}

async function gotoHydratedLocalPage(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
}

test("therapist note tools stay visible but locked without subscription", async ({ page }) => {
  const leaks = captureClinicalNetworkLeaks(page)

  await gotoHydratedLocalPage(page, "/notes")
  await expect(page.getByRole("link", { name: /S\.O\.A\.P\. Notes/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Intake Forms/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Client Journal/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Range of Motion/i })).toBeVisible()
  await expect(page.getByText(/Therapist or Team\/Practice required/i).first()).toBeVisible()

  for (const path of ["/notes/soap", "/notes/intake", "/notes/journal", "/notes/rom"]) {
    await gotoHydratedLocalPage(page, path)
    await expect(page.getByText(/Therapist membership required/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /Sign in/i })).toBeVisible()
  }

  const localStorageSnapshot = await page.evaluate(() => JSON.stringify(window.localStorage))
  expect(localStorageSnapshot).not.toContain(ML_BROWSER_QA_SENTINEL)

  expect(leaks, "clinical/account upload requests").toEqual([])
})
