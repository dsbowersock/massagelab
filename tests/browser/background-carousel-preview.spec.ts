import { expect, test, type Page } from "@playwright/test"

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

/** Opens the real production Clock caller with its Background panel active. */
async function openProductionBackgroundCarousel(page: Page) {
  const response = await page.goto("/dev/clock?panel=background", { waitUntil: "domcontentloaded" })
  expect(response?.ok()).toBe(true)
  const panel = page.getByRole("dialog", { name: "Background" })
  await expect(panel).toBeVisible()
  await expect(panel.locator("[data-background-carousel]")).toBeVisible()
  return panel
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
  const posterOnlyCards = ["static-gradient", "solid-color"].map((backgroundId) => (
    panel.locator(`[data-background-id="${backgroundId}"]`)
  ))

  await expect(videos).toHaveCount(0)
  for (const card of posterOnlyCards) {
    await expect(card.getByTestId("background-preview-poster")).toBeVisible()
  }

  await panel.getByRole("button", { name: "Play Preview" }).click()
  await expect.poll(() => videos.count()).toBeGreaterThan(0)
  const playingCount = await videos.count()
  expect(playingCount).toBeLessThanOrEqual(5)
  for (const card of posterOnlyCards) {
    await expect(card.getByTestId("carousel-background-video")).toHaveCount(0)
    await expect(card.getByTestId("background-preview-poster")).toBeVisible()
  }

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

  await panel.getByRole("button", { name: "Pause Previews" }).click()
  await expect(panel.getByRole("button", { name: "Play Preview" })).toHaveAttribute("aria-pressed", "false")
  await expect(videos).toHaveCount(0)
  await panel.getByRole("button", { name: "Play Preview" }).click()
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

  await panel.getByRole("button", { name: "Play Preview" }).click()
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

  await panel.getByRole("button", { name: "Play Preview" }).click()
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
  })
  const panel = await openProductionBackgroundCarousel(page)
  const videos = panel.getByTestId("carousel-background-video")

  await expect(videos).toHaveCount(0)
  const reducedMotionStatus = panel.getByRole("button", { name: "Previews off (reduced motion)" })
  await expect(reducedMotionStatus).toBeDisabled()
  await expect(reducedMotionStatus).toHaveAttribute("aria-pressed", "false")
  await expect(videos).toHaveCount(0)
  await expect(panel.getByTestId("background-preview-poster").first()).toBeVisible()
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
