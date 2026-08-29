import { expect, test, type Page } from "@playwright/test"

async function centerProofDrone(page: Page) {
  const carousel = page.getByTestId("station-carousel-stage")
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const play = page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })
    if (await play.isVisible().catch(() => false)) return play
    await carousel.getByRole("button", { name: "Next station" }).click()
  }
  throw new Error("MassageLab Proof Drone did not become the active station card.")
}

async function startProofDrone(page: Page) {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await (await centerProofDrone(page)).click()
  const toolbar = page.getByTestId("music-player-toolbar")
  await expect(toolbar).toBeVisible()
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  return toolbar
}

async function delayNavigationResponse(page: Page, pathname: string) {
  await page.route(`**${pathname}*`, async (route) => {
    const request = route.request()
    const headers = request.headers()
    if (headers["next-router-prefetch"] || headers["purpose"] === "prefetch") {
      await route.abort()
      return
    }

    if (headers.rsc || request.isNavigationRequest()) {
      const response = await route.fetch()
      await new Promise((resolve) => setTimeout(resolve, 550))
      await route.fulfill({ response })
      return
    }

    await route.continue()
  })
}

async function installPremiumAccount(page: Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "interaction-feedback", email: "feedback@example.com" } }),
    })
  })
  await page.route("**/api/account/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessAuthoritative: true,
        features: ["premium_backgrounds"],
        ownedBackgroundIds: [],
        chimerSettings: {},
        appSettings: {},
      }),
    })
  })
}

async function startActiveChimer(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("massagelab-chimer-settings", JSON.stringify({ showTimerSeconds: true }))
  })
  await installPremiumAccount(page)
  await page.goto("/chimer", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: /^Continue$/i }).click()
  }
  await page.getByRole("button", { name: /^Start Chimer$/i }).click()
  await expect(page.getByTestId("running-timer-clock")).toBeVisible()
}

test("shows throttled shell feedback while an owned tool Link keeps music mounted", async ({ page }) => {
  test.setTimeout(120_000)
  await delayNavigationResponse(page, "/clock")
  const toolbar = await startProofDrone(page)
  await toolbar.evaluate((element) => {
    Reflect.set(window, "__interactionFeedbackMusicToolbar", element)
  })

  await page.getByRole("link", { name: "Open clock" }).click()
  await expect(page.getByRole("link", { name: "Open clock" })).toHaveAttribute("data-navigation-pending", "true")
  const progress = page.locator('[data-route-progress="pending"]')
  await expect(progress).toBeVisible()
  await expect(progress).toHaveCSS("pointer-events", "none")
  await page.waitForTimeout(220)
  await expect(page.getByRole("status", { name: "Loading page" })).toHaveCount(1)
  await expect(page).toHaveURL(/\/clock/)
  await expect(progress).toHaveCount(0)
  await expect(page.getByRole("status", { name: "Loading page" })).toHaveCount(0)
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing")
  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackMusicToolbar")
    === document.querySelector('[data-testid="music-player-toolbar"]')
  ))).toBe(true)
})

test("keeps the proof-drone session through the real music visualizer Link", async ({ page }) => {
  test.setTimeout(120_000)
  const toolbar = await startProofDrone(page)
  await toolbar.evaluate((element) => {
    Reflect.set(window, "__interactionFeedbackMusicToolbar", element)
  })

  await toolbar.getByRole("link", { name: "Background", exact: true }).click()
  await expect(page).toHaveURL(/\/clock\?[^#]*source=music/)
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing")
  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackMusicToolbar")
    === document.querySelector('[data-testid="music-player-toolbar"]')
  ))).toBe(true)
})

test("keeps the running Chimer timer node through a Visual draft edit", async ({ page }) => {
  test.setTimeout(120_000)
  await startActiveChimer(page)
  const timer = page.getByTestId("running-timer-clock")
  const before = (await timer.textContent())?.replace(/\s+/g, "")
  await page.evaluate(() => {
    Reflect.set(window, "__interactionFeedbackTimer", document.querySelector('[data-testid="running-timer-clock"]'))
  })

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visual = page.getByRole("dialog", { name: "Visual controls" })
  await visual.getByRole("radio", { name: "Custom", exact: true }).click()
  await visual.getByLabel(/color mapping$/).first().selectOption("6")

  expect(await page.evaluate(() => (
    Reflect.get(window, "__interactionFeedbackTimer")
    === document.querySelector('[data-testid="running-timer-clock"]')
  ))).toBe(true)
  await expect.poll(async () => (await timer.textContent())?.replace(/\s+/g, "")).not.toBe(before)
})
