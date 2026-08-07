import { expect, test, type Page } from "@playwright/test"

type PreviewRuntimeProbe = {
  playCalls: number
  pauseCalls: number
}

/**
 * Makes connection, playback, and visibility boundaries deterministic while
 * keeping rendition selection inside the production preview component.
 */
async function installPreviewRuntimeProbe(page: Page) {
  await page.addInitScript(() => {
    const probe = { playCalls: 0, pauseCalls: 0 }
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
  })
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
    return { playCalls: probe.playCalls, pauseCalls: probe.pauseCalls }
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
    media.dispatchEvent(new Event("ended", { bubbles: true }))
  })
  await expect(video).toHaveAttribute("src", boundarySource!)
  await expect(video).toHaveJSProperty("currentTime", 0)
  await expect.poll(async () => (await readPreviewRuntimeProbe(page)).playCalls)
    .toBeGreaterThan(playsBeforeRestart)

  await video.dispatchEvent("error")
  await expect(video).toHaveAttribute("data-preview-codec", "h264")
  await expect(video).toHaveAttribute("data-preview-quality", "high")
  await expect(video).toHaveAttribute("src", /\/vertical\/high\.mp4$/)

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
    const updateVisibility = Reflect.get(window, "__setPreviewVisibility")
    if (typeof updateVisibility !== "function") throw new Error("Preview visibility probe is unavailable")
    updateVisibility("visible")
  })
  await expect.poll(() => videos.count()).toBeGreaterThan(0)

  const pausesBeforeInactive = (await readPreviewRuntimeProbe(page)).pauseCalls
  await panel.getByRole("button", { name: "Close Background panel" }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId("carousel-background-video")).toHaveCount(0)
  await expect.poll(async () => (await readPreviewRuntimeProbe(page)).pauseCalls)
    .toBeGreaterThan(pausesBeforeInactive)
})

test("production carousel remains poster-only when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    localStorage.setItem("massage-lab-settings", JSON.stringify({ ambientMotionMode: "reduced" }))
  })
  const panel = await openProductionBackgroundCarousel(page)
  const videos = panel.getByTestId("carousel-background-video")

  await expect(videos).toHaveCount(0)
  await panel.getByRole("button", { name: "Play Preview" }).click()
  await expect(panel.getByRole("button", { name: "Pause Previews" })).toHaveAttribute("aria-pressed", "true")
  await expect(videos).toHaveCount(0)
  await expect(panel.getByTestId("background-preview-poster").first()).toBeVisible()
})
