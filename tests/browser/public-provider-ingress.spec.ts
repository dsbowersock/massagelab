import {
  expect,
  test as base,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test"

const DONATION_PATH = "/api/billing/donation"
const REPORT_PATH = "/api/support/problem-report"
const DONATION_STORAGE_KEY = "massagelab-donation-checkout-attempt-v1"

type ProviderBoundary = {
  appOrigin: string
  unexpectedExternalRequests: string[]
  unexpectedSameOriginApiRequests: string[]
  assertClean: () => void
  takeUnexpectedExternalRequests: () => string[]
  takeUnexpectedSameOriginApiRequests: () => string[]
}

type DonationCall = {
  amounts: string[]
  attemptId: string
}

const test = base.extend<{ providerBoundary: ProviderBoundary }>({
  providerBoundary: [async ({ page }, use, testInfo) => {
    const configuredBaseUrl = testInfo.project.use.baseURL
    if (typeof configuredBaseUrl !== "string") {
      throw new Error("Public ingress browser QA requires a configured string baseURL.")
    }
    const appOrigin = new URL(configuredBaseUrl).origin
    const unexpectedExternalRequests: string[] = []
    const unexpectedSameOriginApiRequests: string[] = []
    const boundary: ProviderBoundary = {
      appOrigin,
      unexpectedExternalRequests,
      unexpectedSameOriginApiRequests,
      assertClean: () => {
        expect(
          unexpectedExternalRequests,
          "public ingress browser journeys must not make off-origin HTTP(S) requests",
        ).toEqual([])
        expect(
          unexpectedSameOriginApiRequests,
          "public ingress browser journeys must not start an unexpected same-origin app API",
        ).toEqual([])
      },
      takeUnexpectedExternalRequests: () => unexpectedExternalRequests.splice(0),
      takeUnexpectedSameOriginApiRequests: () => unexpectedSameOriginApiRequests.splice(0),
    }
    await page.route((url) => isExternalHttpUrl(url, appOrigin), async (route) => {
      boundary.unexpectedExternalRequests.push(
        `${route.request().method()} ${route.request().url()}`,
      )
      await route.abort("blockedbyclient")
    })

    await use(boundary)

    boundary.assertClean()
  }, { auto: true }],
})

function isExternalHttpUrl(url: URL, appOrigin: string) {
  return ["http:", "https:"].includes(url.protocol)
    && url.origin !== appOrigin
}

function isSameOriginPath(url: URL, appOrigin: string, pathname: string) {
  return url.origin === appOrigin && url.pathname === pathname
}

/** Stops unrelated browser-side app APIs from silently escaping the acceptance boundary. */
async function installSameOriginAppBoundary(page: Page, boundary: ProviderBoundary) {
  await page.route((url) => (
    url.origin === boundary.appOrigin
    && url.pathname.startsWith("/api/")
  ), async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/auth/session") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" })
      return
    }
    boundary.unexpectedSameOriginApiRequests.push(`${route.request().method()} ${url.pathname}`)
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Browser QA intercepted unrelated app API." }),
    })
  })
}

async function waitForReactHydration(locator: Locator) {
  await expect.poll(() => locator.evaluate((element) => (
    Object.keys(element).some((key) => key.startsWith("__reactProps"))
  ))).toBe(true)
}

async function openPricing(page: Page) {
  await page.goto("/pricing", { waitUntil: "domcontentloaded" })
  const form = await settledDonationForm(page)
  await expect(form).toBeVisible()
  return form
}

/** Waits out Next's brief outgoing/incoming document overlap after a 303 navigation. */
async function settledDonationForm(page: Page) {
  const forms = page.locator(`form[action="${DONATION_PATH}"]`)
  await expect(forms).toHaveCount(1)
  const form = forms.first()
  await waitForReactHydration(form)
  return form
}

async function openSupport(page: Page) {
  await page.goto("/support", { waitUntil: "domcontentloaded" })
  const submit = page.getByRole("button", { name: "Send Diagnostic", exact: true })
  await expect(submit).toBeVisible()
  const form = page
    .getByText("No clinical details in this report", { exact: true })
    .locator("xpath=ancestor::form")
  await waitForReactHydration(form)
  return { form, submit }
}

function donationButton(form: Locator, accessibleName: string) {
  return form.getByRole("button", { name: accessibleName, exact: true })
}

function donationCall(route: Route): DonationCall {
  const fields = new URLSearchParams(route.request().postData() ?? "")
  const attemptIds = fields.getAll("checkoutAttemptId")
  expect(attemptIds).toHaveLength(1)
  return {
    amounts: fields.getAll("amountCents"),
    attemptId: attemptIds[0],
  }
}

async function storedAttempt(page: Page) {
  return page.evaluate((key) => {
    const value = sessionStorage.getItem(key)
    return value ? JSON.parse(value) as { amountCents: number; attemptId: string } : null
  }, DONATION_STORAGE_KEY)
}

async function followDonationRedirect({
  page,
  calls,
  accessibleName,
  returnCode,
}: {
  page: Page
  calls: DonationCall[]
  accessibleName: string
  returnCode: string
}) {
  const form = await settledDonationForm(page)
  const before = calls.length
  const navigation = page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame())
  await donationButton(form, accessibleName).evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  await expect.poll(() => calls.length).toBe(before + 1)
  await navigation
  await expect(page).toHaveURL(new RegExp(`[?&]donation=${returnCode}(?:&|$)`))
  await settledDonationForm(page)
  return calls[before]
}

test("external targets and unexpected app APIs stay visible to the browser boundary", async ({
  page,
  providerBoundary,
}) => {
  await installSameOriginAppBoundary(page, providerBoundary)
  await page.route((url) => [DONATION_PATH, REPORT_PATH].some((pathname) => (
    isSameOriginPath(url, providerBoundary.appOrigin, pathname)
  )), async (route) => {
    await route.fulfill({
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "",
    })
  })
  const targetUrls = [
    `https://provider-boundary.invalid${DONATION_PATH}`,
    `https://provider-boundary.invalid${REPORT_PATH}`,
  ]
  const blocked = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => {
    try {
      await fetch(url, { method: "POST" })
      return false
    } catch {
      return true
    }
  })), targetUrls)

  expect(blocked).toEqual([true, true])
  expect(providerBoundary.takeUnexpectedExternalRequests().sort()).toEqual([
    `POST ${targetUrls[0]}`,
    `POST ${targetUrls[1]}`,
  ].sort())

  const maskedAppApiStatus = await page.evaluate(async (appOrigin) => {
    const response = await fetch(`${appOrigin}/api/billing/checkout`, { method: "POST" })
    return response.status
  }, providerBoundary.appOrigin)
  expect(maskedAppApiStatus).toBe(503)
  expect(() => providerBoundary.assertClean()).toThrow(/same-origin app API/i)
  expect(providerBoundary.takeUnexpectedSameOriginApiRequests()).toEqual([
    "POST /api/billing/checkout",
  ])
  providerBoundary.assertClean()
})

test("donation keeps one attempt through bounded, unavailable, generic, and ambiguous outcomes", async ({
  page,
  providerBoundary,
}) => {
  await installSameOriginAppBoundary(page, providerBoundary)
  const outcomes = ["rate-limited", "unavailable", "checkout-error", "abort", "rate-limited"]
  const calls: DonationCall[] = []
  let releaseFirst: () => void = () => undefined
  const firstResponseGate = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  await page.route((url) => (
    isSameOriginPath(url, providerBoundary.appOrigin, DONATION_PATH)
  ), async (route) => {
    const outcome = outcomes[calls.length]
    calls.push(donationCall(route))
    if (calls.length === 1) await firstResponseGate
    if (outcome === "abort") {
      await route.abort("failed")
      return
    }
    await route.fulfill({
      status: 303,
      headers: { location: `/pricing?donation=${outcome}` },
      body: "",
    })
  })

  let form = await openPricing(page)
  const firstNavigation = page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame())
  const fiveDollar = donationButton(form, "$5 Small project support")
  const claimedState = await fiveDollar.evaluate(async (element) => {
    const button = element as HTMLButtonElement
    button.click()
    button.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const owner = button.form
    return {
      busy: owner?.getAttribute("aria-busy"),
      allSubmitsDisabled: [...(owner?.querySelectorAll<HTMLButtonElement>('button[type="submit"]') ?? [])]
        .every((submit) => submit.disabled),
      status: owner?.querySelector('[role="status"]')?.textContent,
    }
  })
  expect(claimedState).toEqual({
    busy: "true",
    allSubmitsDisabled: true,
    status: "Opening secure checkout…",
  })
  await expect.poll(() => calls.length).toBe(1)
  await expect.poll(() => calls.length).toBe(1)
  releaseFirst()
  await firstNavigation
  form = await settledDonationForm(page)
  await expect(page.getByText("One-time support checkout temporarily paused", { exact: true })).toBeVisible()

  const firstAttempt = calls[0].attemptId
  expect(firstAttempt).toMatch(/^[0-9a-f-]{36}$/)
  expect(calls[0].amounts).toEqual(["500"])
  await expect.poll(async () => (await storedAttempt(page))?.attemptId).toBe(firstAttempt)
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
  })
  const restoredState = await form.evaluate((owner) => ({
    busy: owner.getAttribute("aria-busy"),
    allSubmitsEnabled: [...owner.querySelectorAll<HTMLButtonElement>('button[type="submit"]')]
      .every((submit) => !submit.disabled),
    statusCount: owner.querySelectorAll('[role="status"]').length,
  }))
  expect(restoredState).toEqual({
    busy: "false",
    allSubmitsEnabled: true,
    statusCount: 0,
  })
  expect(calls).toHaveLength(1)
  await expect.poll(async () => (await storedAttempt(page))?.attemptId).toBe(firstAttempt)

  const transientReturns = [
    ["unavailable", "One-time support checkout temporarily unavailable"],
    ["checkout-error", "One-time support checkout unavailable"],
  ] as const
  for (const [returnCode, notice] of transientReturns) {
    const call = await followDonationRedirect({
      page,
      calls,
      accessibleName: "$5 Small project support",
      returnCode,
    })
    expect(call.attemptId).toBe(firstAttempt)
    await expect(page.getByText(notice, { exact: true })).toBeVisible()
    await expect.poll(async () => (await storedAttempt(page))?.attemptId).toBe(firstAttempt)
  }

  form = await settledDonationForm(page)
  await donationButton(form, "$5 Small project support").evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  await expect.poll(() => calls.length).toBe(4)
  await page.waitForTimeout(250)
  expect(calls).toHaveLength(4)

  await page.goto("/pricing", { waitUntil: "domcontentloaded" })
  await expect.poll(async () => (await storedAttempt(page))?.attemptId).toBe(firstAttempt)
  const recovered = await followDonationRedirect({
    page,
    calls,
    accessibleName: "$5 Small project support",
    returnCode: "rate-limited",
  })
  expect(recovered.attemptId).toBe(firstAttempt)
  await page.waitForTimeout(250)
  expect(calls).toHaveLength(5)
})

test("donation rotates on amount, conflict, success, cancel, and explicit new attempt", async ({
  page,
  providerBoundary,
}) => {
  await installSameOriginAppBoundary(page, providerBoundary)
  const outcomes = ["rate-limited", "conflict", "thanks", "cancelled", "rate-limited", "unavailable"]
  const calls: DonationCall[] = []
  await page.route((url) => (
    isSameOriginPath(url, providerBoundary.appOrigin, DONATION_PATH)
  ), async (route) => {
    const outcome = outcomes[calls.length]
    calls.push(donationCall(route))
    await route.fulfill({
      status: 303,
      headers: { location: `/pricing?donation=${outcome}` },
      body: "",
    })
  })
  await openPricing(page)

  const first = await followDonationRedirect({
    page,
    calls,
    accessibleName: "$5 Small project support",
    returnCode: "rate-limited",
  })
  const amountChanged = await followDonationRedirect({
    page,
    calls,
    accessibleName: "$15 Support a careful build session",
    returnCode: "conflict",
  })
  expect(amountChanged.attemptId).not.toBe(first.attemptId)
  await expect(page.getByText("One-time support checkout attempt changed", { exact: true })).toBeVisible()
  await expect.poll(() => storedAttempt(page)).toBe(null)

  const afterConflict = await followDonationRedirect({
    page,
    calls,
    accessibleName: "$15 Support a careful build session",
    returnCode: "thanks",
  })
  expect(afterConflict.attemptId).not.toBe(amountChanged.attemptId)
  await expect(page.getByText("One-time support checkout completed", { exact: true })).toBeVisible()
  await expect.poll(() => storedAttempt(page)).toBe(null)

  const afterSuccess = await followDonationRedirect({
    page,
    calls,
    accessibleName: "$15 Support a careful build session",
    returnCode: "cancelled",
  })
  expect(afterSuccess.attemptId).not.toBe(afterConflict.attemptId)
  await expect(page.getByText("One-time support checkout cancelled", { exact: true })).toBeVisible()
  await expect.poll(() => storedAttempt(page)).toBe(null)

  const afterCancel = await followDonationRedirect({
    page,
    calls,
    accessibleName: "$15 Support a careful build session",
    returnCode: "rate-limited",
  })
  expect(afterCancel.attemptId).not.toBe(afterSuccess.attemptId)
  await expect.poll(async () => (await storedAttempt(page))?.attemptId).toBe(afterCancel.attemptId)

  const form = await settledDonationForm(page)
  await form.getByRole("button", { name: "Start a new checkout attempt" }).click()
  await expect.poll(() => storedAttempt(page)).toBe(null)
  const explicitNew = await followDonationRedirect({
    page,
    calls,
    accessibleName: "$15 Support a careful build session",
    returnCode: "unavailable",
  })
  expect(explicitNew.attemptId).not.toBe(afterCancel.attemptId)
  expect(new Set(calls.map(({ attemptId }) => attemptId).slice(1))).toHaveProperty("size", 5)
})

test("diagnostic Retry-After owns a countdown without automatic replay", async ({
  page,
  providerBoundary,
}) => {
  await installSameOriginAppBoundary(page, providerBoundary)
  const reportBodies: unknown[] = []
  let releaseFirst: () => void = () => undefined
  const firstResponseGate = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  await page.route((url) => (
    isSameOriginPath(url, providerBoundary.appOrigin, REPORT_PATH)
  ), async (route) => {
    reportBodies.push(route.request().postDataJSON())
    if (reportBodies.length === 1) {
      await firstResponseGate
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "3" },
        body: JSON.stringify({ error: "bounded" }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ eventId: "browser-diagnostic-event" }),
    })
  })

  const { form, submit } = await openSupport(page)
  await page.clock.install()
  const pauseTarget = await page.evaluate(() => Date.now() + 500)
  await page.clock.pauseAt(pauseTarget)
  await submit.click()
  await expect.poll(() => reportBodies.length).toBe(1)
  await expect(form).toHaveAttribute("aria-busy", "true")
  await expect(page.getByRole("button", { name: "Sending...", exact: true })).toBeDisabled()
  releaseFirst()

  await expect(page.getByText("Diagnostic reports temporarily paused", { exact: true })).toBeVisible()
  const liveStatus = form.getByRole("status")
  await expect(liveStatus).toHaveAttribute("aria-live", "polite")
  await expect(liveStatus).toHaveAttribute("aria-atomic", "true")
  const retry = page.getByRole("button", { name: "Try Diagnostic Again", exact: true })
  await expect(retry).toBeDisabled()
  await expect(page.getByText(
    "Please wait 3 seconds before trying again. This page will not resend the report automatically.",
    { exact: true },
  )).toBeVisible()

  await page.clock.fastForward(2_999)
  await expect(retry).toBeDisabled()
  await page.clock.fastForward(1)
  await expect(retry).toBeEnabled()
  await expect(page.getByText(
    "You can try again now. This page will not resend the report automatically.",
    { exact: true },
  )).toBeVisible()
  await page.clock.fastForward(30_000)
  expect(reportBodies).toHaveLength(1)

  await retry.click()
  await expect.poll(() => reportBodies.length).toBe(2)
  await expect(page.getByText("Diagnostic report sent", { exact: true })).toBeVisible()
  await expect(liveStatus).toContainText("Diagnostic report sent")
})

test("diagnostic malformed limit, unavailable, and generic failure require manual recovery", async ({
  page,
  providerBoundary,
}) => {
  await installSameOriginAppBoundary(page, providerBoundary)
  const responses = [
    { status: 429, headers: { "Retry-After": "1.5" }, body: { error: "malformed" } },
    { status: 503, body: { error: "unavailable" } },
    { status: 500, body: { error: "failed" } },
    { status: 200, body: { eventId: "browser-recovery-event" } },
  ]
  const reportBodies: Array<Record<string, unknown>> = []
  let releaseUnmountedResponse: () => void = () => undefined
  const unmountedResponseGate = new Promise<void>((resolve) => {
    releaseUnmountedResponse = resolve
  })
  await page.route((url) => (
    isSameOriginPath(url, providerBoundary.appOrigin, REPORT_PATH)
  ), async (route) => {
    reportBodies.push(route.request().postDataJSON() as Record<string, unknown>)
    if (reportBodies.length === 1) {
      await unmountedResponseGate
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "30" },
        body: JSON.stringify({ error: "unmounted" }),
      })
      return
    }
    const response = responses[reportBodies.length - 2]
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      headers: response.headers,
      body: JSON.stringify(response.body),
    })
  })
  const firstSupport = await openSupport(page)
  await page.evaluate(() => {
    const observed = window as Window & { __diagnosticRetryTimers?: string[] }
    observed.__diagnosticRetryTimers = []
    const originalSetInterval = window.setInterval.bind(window)
    const originalSetTimeout = window.setTimeout.bind(window)
    window.setInterval = ((handler: TimerHandler, timeout?: number) => {
      if (timeout === 250) observed.__diagnosticRetryTimers?.push("interval:250")
      return originalSetInterval(handler, timeout)
    }) as typeof window.setInterval
    window.setTimeout = ((handler: TimerHandler, timeout?: number) => {
      if (timeout === 30_000) observed.__diagnosticRetryTimers?.push("timeout:30000")
      return originalSetTimeout(handler, timeout)
    }) as typeof window.setTimeout
  })
  await firstSupport.submit.click()
  await expect.poll(() => reportBodies.length).toBe(1)
  await page.locator('a[href="/roadmap"]').last().click()
  await expect(page).toHaveURL(/\/roadmap$/)
  releaseUnmountedResponse()
  await page.waitForTimeout(250)
  expect(await page.evaluate(() => (
    (window as Window & { __diagnosticRetryTimers?: string[] }).__diagnosticRetryTimers ?? []
  ))).toEqual([])
  expect(reportBodies).toHaveLength(1)

  await openSupport(page)
  await expect(page.getByText("No clinical details in this report", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open Email", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Send Diagnostic", exact: true }).click()
  await expect.poll(() => reportBodies.length).toBe(2)
  await expect(page.getByText("Diagnostic report temporarily unavailable", { exact: true })).toBeVisible()
  const liveStatus = page
    .getByText("No clinical details in this report", { exact: true })
    .locator("xpath=ancestor::form")
    .getByRole("status")
  await expect(liveStatus).toHaveAttribute("aria-live", "polite")
  await expect(liveStatus).toHaveAttribute("aria-atomic", "true")
  const retry = page.getByRole("button", { name: "Try Diagnostic Again", exact: true })
  await expect(retry).toBeEnabled()
  await page.waitForTimeout(200)
  expect(reportBodies).toHaveLength(2)

  await retry.click()
  await expect.poll(() => reportBodies.length).toBe(3)
  await expect(page.getByText("Diagnostic report temporarily unavailable", { exact: true })).toBeVisible()
  await page.waitForTimeout(200)
  expect(reportBodies).toHaveLength(3)

  await retry.click()
  await expect.poll(() => reportBodies.length).toBe(4)
  await expect(page.getByText("Diagnostic report was not sent", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Try Diagnostic Again", exact: true }).click()
  await expect.poll(() => reportBodies.length).toBe(5)
  await expect(page.getByText("Diagnostic report sent", { exact: true })).toBeVisible()
  await expect(liveStatus).toContainText("Diagnostic report sent")

  const diagnosticEmail = page.getByRole("link", { name: "Open Email", exact: true }).last()
  await expect(diagnosticEmail).toHaveAttribute("href", /browser-recovery-event/)
  for (const body of reportBodies) {
    expect(Object.keys(body).sort()).toEqual([
      "area",
      "category",
      "clientContext",
      "linkedEventId",
      "route",
    ])
    expect(JSON.stringify(body)).not.toMatch(/client name|symptom|diagnosis|treatment/i)
  }
})
