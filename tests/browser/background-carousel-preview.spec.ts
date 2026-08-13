import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

type PreviewRuntimeProbe = {
  playCalls: number
  pauseCalls: number
  rejectedPlayCalls: number
}

type PreviewRuntimeProbeOptions = {
  rejectOnceForSource?: string
}

/**
 * Makes connection, playback, and visibility boundaries deterministic while
 * keeping rendition selection inside the production preview component.
 */
async function installPreviewRuntimeProbe(
  page: Page,
  options: PreviewRuntimeProbeOptions = {},
) {
  await page.addInitScript(({ rejectOnceForSource }) => {
    const probe = { playCalls: 0, pauseCalls: 0, rejectedPlayCalls: 0 }
    let rejectedMatchingPlay = false
    const connection = new EventTarget() as EventTarget & {
      effectiveType: string
      saveData: boolean
    }
    connection.effectiveType = "3g"
    connection.saveData = false

    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: connection,
    })
    Reflect.set(window, "__previewRuntimeProbe", probe)
    Reflect.set(window, "__setPreviewEffectiveType", (effectiveType: string) => {
      connection.effectiveType = effectiveType
      connection.dispatchEvent(new Event("change"))
    })
    Reflect.set(window, "__setPreviewVisibility", (visibilityState: DocumentVisibilityState) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: visibilityState,
      })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    const originalPlay = HTMLMediaElement.prototype.play
    const originalPause = HTMLMediaElement.prototype.pause
    const originalCanPlayType = HTMLMediaElement.prototype.canPlayType
    HTMLMediaElement.prototype.play = function play() {
      if (this.dataset.testid === "carousel-background-video") {
        probe.playCalls += 1
        const source = this.getAttribute("src") ?? ""
        if (rejectOnceForSource
          && source.includes(rejectOnceForSource)
          && !rejectedMatchingPlay) {
          rejectedMatchingPlay = true
          probe.rejectedPlayCalls += 1
          return Promise.reject(new DOMException("Synthetic reject-once preview failure", "NotAllowedError"))
        }
        queueMicrotask(() => {
          if (!this.isConnected || this.getAttribute("src") !== source) return
          // Source-specific markers prove that a replacement reached the
          // component's loaded/playing path rather than inheriting old events.
          this.dataset.probeLoadedDataSource = source
          this.dispatchEvent(new Event("loadeddata"))
          this.dataset.probePlayingSource = source
          this.dispatchEvent(new Event("playing"))
        })
        return Promise.resolve()
      }
      return originalPlay.call(this)
    }
    HTMLMediaElement.prototype.pause = function pause() {
      if (this.dataset.testid === "carousel-background-video") probe.pauseCalls += 1
      return originalPause.call(this)
    }
    HTMLMediaElement.prototype.canPlayType = function canPlayType(type: string) {
      if (type.includes("codecs=vp9") || type.includes("codecs=avc1")) return "probably"
      return originalCanPlayType.call(this, type)
    }
  }, options)
}

/** Opens a Clock caller with its Background panel active. */
async function openProductionBackgroundCarousel(page: Page, path = "/dev/clock?panel=background") {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" })
  expect(response?.ok()).toBe(true)
  const panel = page.getByRole("dialog", { name: "Background" })
  await expect(panel).toBeVisible()
  await expect(panel.locator("[data-background-carousel]")).toBeVisible()
  return panel
}

/**
 * Supplies the real signed-in commerce state needed for compact-action geometry
 * coverage without depending on database-backed account records.
 */
async function installRestrictedCommerceFixture(
  context: BrowserContext,
  page: Page,
  baseURL: string,
  ownershipStatus?: "refund_pending",
) {
  await installSignedInSessionCookie(context, baseURL, {
    id: "background-preview-unavailable-user",
    name: "Preview unavailable QA",
    email: "preview-unavailable@example.invalid",
  })
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "background-preview-unavailable-user",
          email: "preview-unavailable@example.invalid",
          emailVerified: true,
        },
      }),
    })
  })
  await page.route("**/api/account/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessAuthoritative: true,
        features: [],
        ownedBackgroundIds: [],
        chimerSettings: {},
        appSettings: {},
      }),
    })
  })
  await page.route("**/api/background-commerce/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        creditBalance: 0,
        ownedBackgroundIds: [],
        ownerships: ownershipStatus ? [{
          backgroundId: "massage-lab-moving-gradient",
          source: "purchase",
          status: ownershipStatus,
          acquiredAt: "2026-08-08T00:00:00.000Z",
        }] : [],
        cart: {
          items: [],
          reservedOrder: null,
          subtotalAmount: 0,
          currency: "usd",
          notices: [],
        },
        recentOrders: [],
      }),
    })
  })
}

/** Verifies every compact tray action stays inside its owner and has no overlapping hit area. */
async function expectCompactActionGeometry(controls: Locator) {
  const geometry = await controls.evaluate((tray) => {
    const trayBox = tray.getBoundingClientRect()
    return Array.from(tray.querySelectorAll<HTMLElement>("[data-background-tray-action]")).map((action) => {
      const box = action.getBoundingClientRect()
      return {
        action: action.getAttribute("data-background-tray-action"),
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        trayLeft: trayBox.left,
        trayRight: trayBox.right,
        trayTop: trayBox.top,
        trayBottom: trayBox.bottom,
      }
    })
  })

  expect(geometry.length).toBeGreaterThan(3)
  for (const action of geometry) {
    expect(action.left).toBeGreaterThanOrEqual(action.trayLeft)
    expect(action.right).toBeLessThanOrEqual(action.trayRight)
    expect(action.top).toBeGreaterThanOrEqual(action.trayTop)
    expect(action.bottom).toBeLessThanOrEqual(action.trayBottom)
  }
  for (let index = 0; index < geometry.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < geometry.length; compareIndex += 1) {
      const first = geometry[index]
      const second = geometry[compareIndex]
      const overlaps = first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
      expect(overlaps, `${first.action} overlaps ${second.action}`).toBe(false)
    }
  }
}

/** Centers the next real restricted option before asserting its compact action layout. */
async function centerLockedBackground(controls: Locator) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const primary = controls.locator('[data-carousel-primary-state="locked"]')
    if (await primary.count()) return primary

    const currentLabel = await controls.locator("[data-carousel-primary-action]").getAttribute("aria-label")
    await controls.getByRole("button", { name: "Next background" }).click()
    await expect.poll(
      () => controls.locator("[data-carousel-primary-action]").getAttribute("aria-label"),
    ).not.toBe(currentLabel)
  }

  throw new Error("Expected a locked Background carousel option within eight next actions.")
}

async function readPreviewRuntimeProbe(page: Page): Promise<PreviewRuntimeProbe> {
  return page.evaluate(() => {
    const probe = Reflect.get(window, "__previewRuntimeProbe") as PreviewRuntimeProbe
    return {
      playCalls: probe.playCalls,
      pauseCalls: probe.pauseCalls,
      rejectedPlayCalls: probe.rejectedPlayCalls,
    }
  })
}

test("production carousel stays within its request budget and changes rendition only at a loop boundary", async ({ page }) => {
  await installPreviewRuntimeProbe(page)
  const panel = await openProductionBackgroundCarousel(page)
  const videos = panel.getByTestId("carousel-background-video")
  const animatedCard = panel.locator('[data-background-id="massage-lab-moving-gradient"]')
  const previewToggle = panel.getByRole("switch", { name: /Animated previews/ })

  await expect(previewToggle).toBeChecked()
  await expect.poll(() => videos.count()).toBeGreaterThan(0)
  const playingCount = await videos.count()
  expect(playingCount).toBeLessThanOrEqual(5)

  const mountedSlides = panel.locator(
    '[data-carousel-slide][data-detail-level="full"], [data-carousel-slide][data-detail-level="summary"]',
  )
  const mountedContracts = await mountedSlides.evaluateAll((slides) => slides.map((slide) => {
    const card = slide.querySelector<HTMLElement>("[data-background-id]")
    return {
      backgroundId: card?.dataset.backgroundId ?? null,
      videoCount: card?.querySelectorAll('video[data-testid="carousel-background-video"]').length ?? 0,
    }
  }))
  expect(mountedContracts.length).toBeGreaterThan(0)
  expect(mountedContracts.length).toBeLessThanOrEqual(5)
  for (const contract of mountedContracts) {
    expect(contract.backgroundId).not.toBeNull()
    expect(contract.videoCount).toBe(
      contract.backgroundId && ["static-gradient", "solid-color"].includes(contract.backgroundId) ? 0 : 1,
    )
  }
  await expect(
    panel.locator('[data-carousel-slide][data-detail-level="shell"] video[data-testid="carousel-background-video"]'),
  ).toHaveCount(0)

  const sourceContracts = await videos.evaluateAll((players) => players.map((player) => {
    const video = player as HTMLVideoElement
    const card = video.closest("[data-background-id]")
    return {
      aspect: video.dataset.previewAspect,
      cardVideoCount: card?.querySelectorAll('video[data-testid="carousel-background-video"]').length ?? 0,
      sourceAttribute: video.getAttribute("src"),
      sourceChildCount: video.querySelectorAll("source").length,
    }
  }))
  for (const contract of sourceContracts) {
    expect(contract.aspect).toBe("vertical")
    expect(contract.cardVideoCount).toBe(1)
    expect(contract.sourceAttribute).toMatch(/\/vertical\/(?:low|standard|high)\.(?:webm|mp4)$/)
    expect(contract.sourceChildCount).toBe(0)
  }

  const video = animatedCard.getByTestId("carousel-background-video")
  await expect(video).toHaveAttribute("data-preview-quality", "standard")
  await expect(video).toHaveAttribute("data-preview-codec", "vp9")
  const initialSource = await video.getAttribute("src")
  expect(initialSource).toMatch(/\/vertical\/standard\.webm$/)

  await page.evaluate(() => {
    const updateConnection = Reflect.get(window, "__setPreviewEffectiveType")
    if (typeof updateConnection !== "function") throw new Error("Preview connection probe is unavailable")
    updateConnection("4g")
  })
  // Allow a bounded event-loop/render settling interval before proving that
  // the connection event cannot replace a source mid-loop.
  await page.waitForTimeout(100)
  await expect(video).toHaveAttribute("src", initialSource!)
  await expect(video).toHaveAttribute("data-preview-quality", "standard")

  const playsBeforeHandoff = (await readPreviewRuntimeProbe(page)).playCalls
  await video.dispatchEvent("ended")
  await expect(video).toHaveAttribute("data-preview-quality", "high")
  await expect(video).toHaveAttribute("src", /\/vertical\/high\.webm$/)
  await expect.poll(async () => (await readPreviewRuntimeProbe(page)).playCalls)
    .toBeGreaterThan(playsBeforeHandoff)

  const boundarySource = await video.getAttribute("src")
  const playsBeforeRestart = (await readPreviewRuntimeProbe(page)).playCalls
  await video.evaluate((player) => {
    const media = player as HTMLVideoElement
    media.currentTime = 1
  })
  await expect(video).toHaveJSProperty("currentTime", 1)
  await video.dispatchEvent("ended")
  await expect(video).toHaveAttribute("src", boundarySource!)
  await expect(video).toHaveJSProperty("currentTime", 0)
  await expect.poll(async () => (await readPreviewRuntimeProbe(page)).playCalls)
    .toBeGreaterThan(playsBeforeRestart)

  await video.dispatchEvent("error")
  await expect(video).toHaveAttribute("data-preview-codec", "h264")
  await expect(video).toHaveAttribute("data-preview-quality", "high")
  await expect(video).toHaveAttribute("src", /\/vertical\/high\.mp4$/)
  await expect(video).toHaveAttribute("data-probe-loaded-data-source", /\/vertical\/high\.mp4$/)
  await expect(video).toHaveAttribute("data-probe-playing-source", /\/vertical\/high\.mp4$/)
  await expect(animatedCard.getByTestId("carousel-background-video")).toHaveCount(1)

  await previewToggle.click()
  await expect(previewToggle).not.toBeChecked()
  await expect(videos).toHaveCount(0)
  await previewToggle.click()
  await expect(previewToggle).toBeChecked()
  await expect.poll(() => videos.count()).toBeGreaterThan(0)

  await page.evaluate(() => {
    const updateConnection = Reflect.get(window, "__setPreviewEffectiveType")
    if (typeof updateConnection !== "function") throw new Error("Preview connection probe is unavailable")
    updateConnection("4g")
  })
  const sourceBeforeHidden = await video.getAttribute("src")
  const qualityBeforeHidden = await video.getAttribute("data-preview-quality")
  const codecBeforeHidden = await video.getAttribute("data-preview-codec")
  const pausesBeforeHidden = (await readPreviewRuntimeProbe(page)).pauseCalls
  await page.evaluate(() => {
    const updateVisibility = Reflect.get(window, "__setPreviewVisibility")
    if (typeof updateVisibility !== "function") throw new Error("Preview visibility probe is unavailable")
    updateVisibility("hidden")
  })
  await expect.poll(async () => (await readPreviewRuntimeProbe(page)).pauseCalls)
    .toBeGreaterThan(pausesBeforeHidden)
  await expect(videos).toHaveCount(0)

  await page.evaluate(() => {
    const updateConnection = Reflect.get(window, "__setPreviewEffectiveType")
    if (typeof updateConnection !== "function") throw new Error("Preview connection probe is unavailable")
    updateConnection("2g")
  })

  await page.evaluate(() => {
    const updateVisibility = Reflect.get(window, "__setPreviewVisibility")
    if (typeof updateVisibility !== "function") throw new Error("Preview visibility probe is unavailable")
    updateVisibility("visible")
  })
  await expect.poll(() => videos.count()).toBeGreaterThan(0)
  await expect(video).toHaveAttribute("src", sourceBeforeHidden!)
  await expect(video).toHaveAttribute("data-preview-quality", qualityBeforeHidden!)
  await expect(video).toHaveAttribute("data-preview-codec", codecBeforeHidden!)

  await video.dispatchEvent("ended")
  await expect(video).toHaveAttribute("data-preview-quality", "high")
  await expect(video).toHaveAttribute("data-preview-codec", "vp9")
  await expect(video).toHaveAttribute("src", /\/vertical\/high\.webm$/)

  const pausesBeforeInactive = (await readPreviewRuntimeProbe(page)).pauseCalls
  await panel.getByRole("button", { name: "Close Background panel" }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId("carousel-background-video")).toHaveCount(0)
  await expect.poll(async () => (await readPreviewRuntimeProbe(page)).pauseCalls)
    .toBeGreaterThan(pausesBeforeInactive)
})

test("a rejected play retries the exact same tier with H.264 and keeps the player mounted", async ({ page }) => {
  await installPreviewRuntimeProbe(page, {
    rejectOnceForSource: "massage-lab-moving-gradient",
  })
  const panel = await openProductionBackgroundCarousel(page)
  const animatedCard = panel.locator('[data-background-id="massage-lab-moving-gradient"]')

  const video = animatedCard.getByTestId("carousel-background-video")
  await expect.poll(async () => (await readPreviewRuntimeProbe(page)).rejectedPlayCalls).toBe(1)
  await expect(video).toHaveCount(1)
  await expect(video).toHaveAttribute("data-preview-quality", "standard")
  await expect(video).toHaveAttribute("data-preview-codec", "h264")
  await expect(video).toHaveAttribute("src", /\/vertical\/standard\.mp4$/)
  await expect(video).toHaveAttribute("data-probe-loaded-data-source", /\/vertical\/standard\.mp4$/)
  await expect(video).toHaveAttribute("data-probe-playing-source", /\/vertical\/standard\.mp4$/)
})

test("hidden documents retain failed-codec history and never retry the failed source", async ({ page }) => {
  await installPreviewRuntimeProbe(page)
  const panel = await openProductionBackgroundCarousel(page)
  const animatedCard = panel.locator('[data-background-id="massage-lab-moving-gradient"]')

  const video = animatedCard.getByTestId("carousel-background-video")
  await expect(video).toHaveAttribute("data-preview-codec", "vp9")
  await video.dispatchEvent("error")
  await expect(video).toHaveAttribute("data-preview-codec", "h264")
  const fallbackSource = await video.getAttribute("src")

  await page.evaluate(() => {
    const updateVisibility = Reflect.get(window, "__setPreviewVisibility")
    if (typeof updateVisibility !== "function") throw new Error("Preview visibility probe is unavailable")
    updateVisibility("hidden")
  })
  await expect(video).toHaveCount(0)
  await page.evaluate(() => {
    const updateVisibility = Reflect.get(window, "__setPreviewVisibility")
    if (typeof updateVisibility !== "function") throw new Error("Preview visibility probe is unavailable")
    updateVisibility("visible")
  })
  await expect(video).toHaveAttribute("src", fallbackSource!)
  await expect(video).toHaveAttribute("data-preview-codec", "h264")
  await expect(video).toHaveAttribute("data-probe-playing-source", fallbackSource!)

  const playsBeforeExhaustion = (await readPreviewRuntimeProbe(page)).playCalls
  await video.dispatchEvent("error")
  await expect(video).toHaveCount(0)
  await expect(animatedCard.getByTestId("background-preview-poster")).toBeVisible()
  expect((await readPreviewRuntimeProbe(page)).playCalls).toBe(playsBeforeExhaustion)
})

test("production carousel remains poster-only when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("massage-lab-settings", JSON.stringify({ ambientMotionMode: "reduced" }))
    localStorage.setItem("massagelab-background-preview-autoplay-v1", "true")
  })
  const panel = await openProductionBackgroundCarousel(page)
  const videos = panel.getByTestId("carousel-background-video")

  await expect(videos).toHaveCount(0)
  const previewToggle = panel.getByRole("switch", { name: "Animated previews: On" })
  await expect(previewToggle).toBeEnabled()
  await expect(previewToggle).toBeChecked()
  await expect(panel.getByText("Paused by your reduced-motion setting. Your preview preference is still saved.")).toBeVisible()
  await expect(videos).toHaveCount(0)
  await expect(panel.getByTestId("background-preview-poster").first()).toBeVisible()
})

test("animated preview intent defaults on and persists on this device", async ({ page }) => {
  await installPreviewRuntimeProbe(page)
  let panel = await openProductionBackgroundCarousel(page)
  let previewSwitch = panel.getByRole("switch", { name: /Animated previews/i })

  await expect(previewSwitch).toHaveAttribute("aria-checked", "true")
  await expect.poll(() => panel.getByTestId("carousel-background-video").count()).toBeGreaterThan(0)

  await previewSwitch.click()
  await expect(previewSwitch).toHaveAttribute("aria-checked", "false")
  await expect(panel.getByTestId("carousel-background-video")).toHaveCount(0)

  await page.reload({ waitUntil: "domcontentloaded" })
  panel = page.getByRole("dialog", { name: "Background" })
  previewSwitch = panel.getByRole("switch", { name: /Animated previews/i })
  await expect(previewSwitch).toHaveAttribute("aria-checked", "false")
  await expect(panel.getByTestId("carousel-background-video")).toHaveCount(0)
})

test("production Background controls stay off-card and visible in portrait and short landscape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const panel = await openProductionBackgroundCarousel(page)
  const controls = panel.getByTestId("background-carousel-controls")
  const centeredCard = panel.locator('[data-carousel-slide][data-centered="true"] article')

  await expect(controls).toBeVisible()
  await expect(centeredCard.locator("h3, [data-carousel-primary-action], [data-carousel-favorite-action]")).toHaveCount(0)
  await expect(controls.getByRole("button", { name: "Previous background" })).toBeVisible()
  await expect(controls.getByRole("button", { name: "Next background" })).toBeVisible()
  const firstName = await controls.getByRole("heading", { level: 3 }).textContent()
  await controls.getByRole("button", { name: "Next background" }).click()
  await expect.poll(() => controls.getByRole("heading", { level: 3 }).textContent()).not.toBe(firstName)

  await page.setViewportSize({ width: 844, height: 390 })
  const root = panel.getByRole("region", { name: "Background carousel" })
  await expect(root).toHaveAttribute("data-carousel-responsive-profile", "short-landscape")
  await expect(panel.locator('[data-carousel-slide][data-detail-level="full"], [data-carousel-slide][data-detail-level="summary"]')).toHaveCount(3)

  const [stageBox, trayBox] = await Promise.all([
    panel.getByTestId("background-carousel-stage").boundingBox(),
    controls.boundingBox(),
  ])
  expect(trayBox?.x ?? 0).toBeGreaterThan((stageBox?.x ?? 0) + (stageBox?.width ?? 0) / 2)
  expect(await panel.locator("[data-background-scroller]").evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true)

  await controls.getByRole("button", { name: /More information about/i }).click()
  await expect(page.getByRole("dialog").getByRole("heading")).toBeVisible()
  await page.keyboard.press("Escape")
})

test("short-landscape Background tray keeps locked controls within the compact grid", async ({ context, page }, testInfo) => {
  await installRestrictedCommerceFixture(context, page, String(testInfo.project.use.baseURL))
  await page.setViewportSize({ width: 844, height: 390 })
  const panel = await openProductionBackgroundCarousel(page, "/clock?panel=background")
  const controls = panel.getByTestId("background-carousel-controls")
  const lockedPrimary = await centerLockedBackground(controls)

  await expect(lockedPrimary).toHaveAttribute("data-carousel-primary-state", "locked")
  await expect(lockedPrimary).toBeVisible()
  await expectCompactActionGeometry(controls)
})

test("short-landscape Background tray keeps unavailable controls within the compact grid", async ({ context, page }, testInfo) => {
  await installRestrictedCommerceFixture(context, page, String(testInfo.project.use.baseURL), "refund_pending")
  await page.setViewportSize({ width: 844, height: 390 })
  const panel = await openProductionBackgroundCarousel(page)
  const controls = panel.getByTestId("background-carousel-controls")
  const unavailablePrimary = controls.getByRole("button", { name: /^Unavailable .* background$/ })

  await expect(unavailablePrimary).toHaveAttribute("data-carousel-primary-state", "unavailable")
  await expect(unavailablePrimary).toBeDisabled()
  await expectCompactActionGeometry(controls)
})
