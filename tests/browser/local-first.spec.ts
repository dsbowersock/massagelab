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
  return request.url().includes("ML_BROWSER_QA_SENTINEL")
    || (request.postData() ?? "").includes("ML_BROWSER_QA_SENTINEL")
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

async function clickAndWaitForDownload(page: Page, name: RegExp) {
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name }).click()
  await download
}

async function gotoHydratedLocalPage(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
}

test("local-first clinical document save and export flows do not upload entered content", async ({ page }) => {
  const leaks = captureClinicalNetworkLeaks(page)

  await gotoHydratedLocalPage(page, "/notes/soap")
  await expect(page.getByText(/Local-first PHI handling/i)).toBeVisible()
  await page.getByLabel(/Client Name/i).fill(ML_BROWSER_QA_SENTINEL)
  await page.getByRole("button", { name: /Save Local Draft/i }).click()
  await expect(page.getByText(/Draft saved locally in this browser/i)).toBeVisible()

  await gotoHydratedLocalPage(page, "/notes/intake")
  await expect(page.getByText(/Client Details/i)).toBeVisible()
  await page.getByLabel(/Client Name/i).fill(ML_BROWSER_QA_SENTINEL)
  await page.getByLabel(/Current Conditions/i).fill(`${ML_BROWSER_QA_SENTINEL} with limited rotation`)
  await page.getByRole("button", { name: /Save Local Draft/i }).click()
  await expect(page.getByText(/Draft saved locally on this device/i)).toBeVisible()
  await clickAndWaitForDownload(page, /Export JSON/i)
  await expect(page.getByText(/MassageLab did not upload this form/i)).toBeVisible()

  await gotoHydratedLocalPage(page, "/notes/journal")
  await expect(page.getByText(/New Entry/i)).toBeVisible()
  await page.getByLabel(/Client name/i).fill(ML_BROWSER_QA_SENTINEL)
  await page.getByLabel(/Region/i).fill("left shoulder")
  await page.getByLabel(/Description/i).fill(`${ML_BROWSER_QA_SENTINEL} after treatment`)
  await page.getByRole("button", { name: /Add Entry/i }).click()
  await page.getByRole("button", { name: /Save Local Draft/i }).click()
  await expect(page.getByText(/Journal saved locally on this device/i)).toBeVisible()
  await clickAndWaitForDownload(page, /Export JSON/i)
  await expect(page.getByText(/MassageLab did not upload this journal/i)).toBeVisible()

  await gotoHydratedLocalPage(page, "/notes/rom")
  await expect(page.getByText(/Measurement/i).first()).toBeVisible()
  await page.getByLabel(/Client name/i).fill(ML_BROWSER_QA_SENTINEL)
  await page.getByLabel(/Movement/i).fill("cervical rotation")
  await page.getByRole("textbox", { name: /^Side$/i }).fill("left")
  await page.getByLabel(/Manual start degrees/i).fill("10")
  await page.getByLabel(/Manual end degrees/i).fill("42")
  await page.getByLabel(/Notes/i).fill(`${ML_BROWSER_QA_SENTINEL} measured locally`)
  await page.getByRole("button", { name: /Add Manual Measurement/i }).click()
  await page.getByRole("button", { name: /Save Local Draft/i }).click()
  await expect(page.getByText(/ROM session saved locally on this device/i)).toBeVisible()
  await clickAndWaitForDownload(page, /Export JSON/i)
  await expect(page.getByText(/MassageLab did not upload this ROM session/i)).toBeVisible()

  expect(leaks, "clinical/account upload requests").toEqual([])
})
