import { expect, test, type Locator, type Page } from "@playwright/test"

import { centerCarouselItem } from "./carousel-test-helpers"

type LayerState = {
  error?: string
  status: "loading" | "playing" | "paused" | "failed"
}

type AtmoShaperBrowserDiagnostics = {
  activePlaybackKind: "station" | "atmoshaper" | null
  activeStationId: string | null
  error: string | null
  playbackState: string
  recipe: {
    id: string
    layers: Array<{
      id: string
      kind: string
      muted: boolean
      sourceId: string
      volume: number
    }>
  } | null
  runtime: {
    activeLayers: Record<string, { id: string, muted: boolean, sourceId: string, volume: number }>
    layers: Record<string, LayerState>
    status: string
  } | null
}

type MediaSessionProbe = {
  actions: Record<string, "function" | "object" | "undefined">
  metadata: {
    album?: string
    artist?: string
    artwork?: Array<{ sizes?: string, src?: string, type?: string }>
    title?: string
  } | null
  playbackState: string
}

type GeometryReceipt = {
  currentMix: DOMRectReceipt | null
  document: {
    clientHeight: number
    clientWidth: number
    scrollHeight: number
    scrollWidth: number
  }
  library: DOMRectReceipt | null
  player: DOMRectReceipt | null
  viewport: { height: number, width: number }
  workspace: DOMRectReceipt | null
}

type DOMRectReceipt = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

const viewports = [
  { width: 375, height: 667 },
  { width: 412, height: 915 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 912, height: 1368 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
] as const

/**
 * Installs a loopback-only browser-QA request before application code runs.
 * Product code owns the guarded bridge and consumes each requested failure once.
 */
async function installAtmoShaperBrowserQa(page: Page, failNextSourceIds: string[] = []) {
  await page.addInitScript((sourceIds) => {
    Reflect.set(window, "__massagelabAtmoShaperBrowserQa", {
      enabled: true,
      failNextSourceIds: [...sourceIds],
    })

    const mediaSession: {
      handlers: Record<string, (() => void) | null>
      metadata: MediaSessionProbe["metadata"]
      playbackState: string
      setActionHandler(action: string, handler: (() => void) | null): void
      setPositionState(): void
    } = {
      handlers: {},
      metadata: null,
      playbackState: "none",
      setActionHandler(action, handler) {
        this.handlers[action] = handler
      },
      setPositionState() {},
    }
    class FakeMediaMetadata {
      album?: string
      artist?: string
      artwork?: Array<{ sizes?: string, src?: string, type?: string }>
      title?: string

      constructor(init: MediaSessionProbe["metadata"]) {
        Object.assign(this, init)
      }
    }
    class FakeCarrierAudio extends EventTarget {
      loop = false
      paused = true
      preload = ""
      src = ""

      getAttribute(name: string) {
        return name === "src" && this.src ? this.src : null
      }

      removeAttribute(name: string) {
        if (name === "src") this.src = ""
      }

      async play() {
        this.paused = false
        queueMicrotask(() => this.dispatchEvent(new Event("play")))
      }

      pause() {
        if (this.paused) return
        this.paused = true
        queueMicrotask(() => this.dispatchEvent(new Event("pause")))
      }

      load() {}
    }
    const audioSession = new EventTarget() as EventTarget & { state: string, type: string }
    audioSession.state = "active"
    audioSession.type = "playback"
    Object.defineProperty(window, "Audio", { configurable: true, value: FakeCarrierAudio })
    Object.defineProperty(window, "MediaMetadata", { configurable: true, value: FakeMediaMetadata })
    Object.defineProperty(Navigator.prototype, "mediaSession", {
      configurable: true,
      get: () => mediaSession,
    })
    Object.defineProperty(Navigator.prototype, "audioSession", {
      configurable: true,
      get: () => audioSession,
    })
    Reflect.set(window, "__massagelabAtmoMediaSession", mediaSession)
  }, failNextSourceIds)
}

async function openAtmoShaper(page: Page) {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await page.getByRole("group", { name: "Station category" })
    .getByRole("button", { name: /AtmoShaper/i })
    .click()
  await expect(page.getByLabel("AtmoShaper live mixer")).toBeVisible()
}

async function addBinauralPreset(page: Page, preset: "Alpha" | "Beta" = "Alpha") {
  const tab = page.getByRole("tab", { name: "Binaural beats" })
  if (await tab.getAttribute("aria-selected") !== "true") await press(tab)
  await press(page.getByRole("button", { name: `Add ${preset} binaural preset` }))
}

async function addNoise(page: Page, color: "White" | "Pink" | "Brown") {
  const tab = page.getByRole("tab", { name: "Noise" })
  if (await tab.getAttribute("aria-selected") !== "true") await press(tab)
  await press(page.getByRole("button", { name: `Add ${color} noise` }))
}

async function readDiagnostics(page: Page) {
  return page.evaluate(() => {
    const bridge = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as {
      getDiagnostics?: () => AtmoShaperBrowserDiagnostics
    } | undefined
    if (!bridge?.getDiagnostics) throw new Error("AtmoShaper provider diagnostics bridge was not installed.")
    return bridge.getDiagnostics()
  })
}

async function readMediaSession(page: Page) {
  return page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabAtmoMediaSession") as {
      handlers: Record<string, (() => void) | null>
      metadata: MediaSessionProbe["metadata"]
      playbackState: string
    }
    return {
      actions: Object.fromEntries(
        ["play", "pause", "stop", "previoustrack", "nexttrack"]
          .map((action) => [action, typeof probe.handlers[action]]),
      ),
      metadata: probe.metadata,
      playbackState: probe.playbackState,
    } as MediaSessionProbe
  })
}

async function invokeMediaSessionAction(page: Page, action: string) {
  await page.evaluate((name) => {
    const probe = Reflect.get(window, "__massagelabAtmoMediaSession") as {
      handlers: Record<string, (() => void) | null>
    }
    probe.handlers[name]?.()
  }, action)
}

async function waitForAtmoStatus(page: Page, status: string) {
  await expect.poll(async () => (await readDiagnostics(page)).runtime?.status, { timeout: 30_000 })
    .toBe(status)
}

async function press(locator: Locator, key = "Enter") {
  await expect(locator).toBeVisible()
  await expect(locator).toBeEnabled()
  await locator.focus()
  await locator.press(key)
}

async function openFullMix(page: Page) {
  const trigger = page.getByRole("button", { name: "Open full Current Mix" })
  if (await trigger.isVisible()) {
    await press(trigger)
    const dialog = page.getByRole("dialog", { name: "Full Current Mix controls" })
    await expect(dialog).toBeVisible()
    return { scope: dialog, sheetWasOpened: true }
  }
  return {
    scope: page.getByRole("region", { name: "Current Mix", exact: true }),
    sheetWasOpened: false,
  }
}

async function closeInterruptionNoticeIfVisible(page: Page) {
  const notice = page.getByRole("region", { name: "Interruption preference" })
  if (await notice.isVisible()) await press(notice.getByRole("button", { name: "Close" }))
}

async function measureGeometry(page: Page): Promise<GeometryReceipt> {
  return page.evaluate(() => {
    const receipt = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element || getComputedStyle(element).display === "none") return null
      const rect = element.getBoundingClientRect()
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      }
    }
    const root = document.documentElement
    return {
      currentMix: receipt(".ml-atmoshaper-current-mix-desktop")
        ?? receipt(".ml-atmoshaper-mix-tray"),
      document: {
        clientHeight: root.clientHeight,
        clientWidth: root.clientWidth,
        scrollHeight: root.scrollHeight,
        scrollWidth: root.scrollWidth,
      },
      library: receipt(".ml-atmoshaper-library"),
      player: receipt(".ml-music-player"),
      viewport: { height: window.innerHeight, width: window.innerWidth },
      workspace: receipt(".ml-atmoshaper-workspace"),
    }
  })
}

function expectNoDocumentOverflow(receipt: GeometryReceipt) {
  const message = `AtmoShaper geometry: ${JSON.stringify(receipt)}`
  expect(receipt.document.scrollWidth, message).toBeLessThanOrEqual(receipt.document.clientWidth + 1)
  expect(receipt.document.scrollHeight, message).toBeLessThanOrEqual(receipt.document.clientHeight + 1)
  expect(receipt.workspace, message).not.toBeNull()
  expect(receipt.library, message).not.toBeNull()
  expect(receipt.currentMix, message).not.toBeNull()
}

function expectRectsNotToOverlap(first: DOMRectReceipt, second: DOMRectReceipt, message: string) {
  const separated = first.right <= second.left + 1
    || second.right <= first.left + 1
    || first.bottom <= second.top + 1
    || second.bottom <= first.top + 1
  expect(separated, message).toBe(true)
}

async function expectHitTarget(page: Page, locator: Locator, message: string) {
  const receivesHit = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return hit === element || element.contains(hit)
  })
  expect(receivesHit, message).toBe(true)
}

test.beforeEach(async ({ page }) => {
  await installAtmoShaperBrowserQa(page)
})

test("plays one free sound with no station through the single global player", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await page.getByRole("button", { name: "Play AtmoShaper" }).first().click()

  await waitForAtmoStatus(page, "playing")
  const diagnostics = await readDiagnostics(page)
  expect(diagnostics.activePlaybackKind).toBe("atmoshaper")
  expect(diagnostics.activeStationId).toBeNull()
  expect(diagnostics.recipe?.layers.map(({ kind }) => kind)).toEqual(["noise"])
  expect(Object.keys(diagnostics.runtime?.activeLayers ?? {})).toHaveLength(1)
  const fullControls = page.getByLabel("AtmoShaper playback controls")
  const compactControls = page.getByLabel("Compact Current Mix")
  expect(await fullControls.isVisible() || await compactControls.isVisible()).toBe(true)
  await expect(page.locator(".ml-music-player")).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Favorite AtmoShaper" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Previous station" })).toHaveCount(0)
})

test("builds and plays a free multi-layer mix through one global player", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await addBinauralPreset(page)
  await page.getByRole("button", { name: "Play AtmoShaper" }).first().click()

  await waitForAtmoStatus(page, "playing")
  const diagnostics = await readDiagnostics(page)
  expect(diagnostics.recipe?.layers.map(({ kind }) => kind)).toEqual(["noise", "binaural"])
  expect(Object.keys(diagnostics.runtime?.activeLayers ?? {})).toHaveLength(2)
  await expect(page.locator(".ml-music-player")).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Favorite AtmoShaper" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Previous station" })).toHaveCount(0)
})

test("replaces ordinary playback with AtmoShaper and replaces it back with one station", async ({ page }) => {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  const playStation = page.getByRole("button", { name: "Play MassageLab Proof Drone" })
  await expect(playStation).toBeEnabled({ timeout: 30_000 })
  await playStation.click()
  await expect.poll(async () => (await readDiagnostics(page)).activePlaybackKind, { timeout: 30_000 })
    .toBe("station")
  await closeInterruptionNoticeIfVisible(page)

  await page.getByRole("group", { name: "Station category" })
    .getByRole("button", { name: /AtmoShaper/i })
    .click()
  await addNoise(page, "Pink")
  await page.getByRole("button", { name: "Play AtmoShaper" }).first().click()
  await waitForAtmoStatus(page, "playing")
  await expect(page.locator(".ml-music-player")).toHaveCount(1)

  await page.getByRole("group", { name: "Station category" })
    .getByRole("button", { name: "Treatment room starters" })
    .click()
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: "Play MassageLab Proof Drone" }).click()
  await expect.poll(async () => (await readDiagnostics(page)).activePlaybackKind, { timeout: 30_000 })
    .toBe("station")
  expect((await readDiagnostics(page)).runtime).toBeNull()
  await expect(page.locator(".ml-music-player")).toHaveCount(1)
})

test("keeps stopped edits silent and live edits preserve healthy layer ids", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await addNoise(page, "Brown")
  await page.getByRole("button", { name: "Play AtmoShaper" }).first().click()
  await waitForAtmoStatus(page, "playing")

  const initial = await readDiagnostics(page)
  const pinkId = initial.recipe?.layers.find(({ sourceId }) => sourceId === "noise:pink")?.id
  const brownId = initial.recipe?.layers.find(({ sourceId }) => sourceId === "noise:brown")?.id
  expect(pinkId).toBeTruthy()
  expect(brownId).toBeTruthy()
  const initialPinkVolume = initial.runtime?.activeLayers[pinkId!]?.volume
  expect(initialPinkVolume).toBeTruthy()

  const { scope: currentMix, sheetWasOpened } = await openFullMix(page)
  const pinkVolume = currentMix.getByLabel("Volume for Pink noise")
  await press(pinkVolume, "ArrowLeft")
  await expect.poll(async () => (await readDiagnostics(page)).runtime?.activeLayers[pinkId!]?.volume)
    .toBeLessThan(initialPinkVolume!)
  expect(Object.keys((await readDiagnostics(page)).runtime?.activeLayers ?? {})).toEqual(
    expect.arrayContaining([pinkId!, brownId!]),
  )
  await press(currentMix.getByRole("button", { name: "Mute Pink noise" }))
  await expect.poll(async () => (await readDiagnostics(page)).runtime?.activeLayers[pinkId!]?.muted)
    .toBe(true)
  expect(Object.keys((await readDiagnostics(page)).runtime?.activeLayers ?? {})).toEqual(
    expect.arrayContaining([pinkId!, brownId!]),
  )

  await press(currentMix.getByRole("button", { name: "Remove Brown noise" }))
  await expect.poll(async () => Object.keys((await readDiagnostics(page)).runtime?.activeLayers ?? {}))
    .toEqual([pinkId!])

  await press(currentMix.getByRole("button", { name: "Stop AtmoShaper" }))
  await expect.poll(async () => (await readDiagnostics(page)).playbackState).toBe("stopped")
  if (sheetWasOpened) await page.keyboard.press("Escape")
  await addNoise(page, "White")
  const stopped = await readDiagnostics(page)
  expect(stopped.playbackState).toBe("stopped")
  expect(stopped.runtime).toBeNull()
  expect(stopped.recipe?.layers.map(({ sourceId }) => sourceId)).toEqual(["noise:pink", "noise:white"])

  await page.getByRole("button", { name: "Play AtmoShaper" }).first().click()
  await waitForAtmoStatus(page, "playing")
  expect(Object.keys((await readDiagnostics(page)).runtime?.activeLayers ?? {})).toHaveLength(2)
})

test("keyboard controls isolate one failed layer and support retry, reorder, mute, and remove", async ({ page }) => {
  await page.addInitScript(() => {
    const bridge = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as { failNextSourceIds: string[] }
    bridge.failNextSourceIds.push("binaural:alpha")
  })
  await openAtmoShaper(page)
  await press(page.getByRole("button", { name: "Add Pink noise" }))
  await press(page.getByRole("button", { name: "Add Brown noise" }))
  await press(page.getByRole("tab", { name: "Binaural beats" }))
  await press(page.getByRole("button", { name: "Add Alpha binaural preset" }))
  await press(page.getByRole("button", { name: "Play AtmoShaper" }).first())

  const { scope: currentMix } = await openFullMix(page)
  await expect(currentMix.getByText("Browser QA injected failure for binaural:alpha.", { exact: true })).toBeVisible()
  await expect(currentMix.getByRole("button", { name: "Retry Alpha binaural beat" })).toBeVisible()
  await expect(currentMix.getByRole("button", { name: "Remove Alpha binaural beat" })).toBeVisible()
  const failed = await readDiagnostics(page)
  expect(failed.runtime?.layers).toMatchObject({
    [failed.recipe!.layers.find(({ sourceId }) => sourceId === "binaural:alpha")!.id]: { status: "failed" },
  })
  expect(Object.values(failed.runtime?.activeLayers ?? {}).map(({ sourceId }) => sourceId))
    .toEqual(expect.arrayContaining(["noise:pink", "noise:brown"]))

  await press(currentMix.getByRole("button", { name: "Retry Alpha binaural beat" }))
  await expect.poll(async () => {
    const next = await readDiagnostics(page)
    const alphaId = next.recipe?.layers.find(({ sourceId }) => sourceId === "binaural:alpha")?.id
    return alphaId ? next.runtime?.layers[alphaId]?.status : null
  }).toBe("playing")
  await press(currentMix.getByRole("button", { name: "Move earlier: Brown noise" }))
  await expect.poll(async () => (await readDiagnostics(page)).recipe?.layers.map(({ sourceId }) => sourceId))
    .toEqual(["noise:brown", "noise:pink", "binaural:alpha"])
  await press(currentMix.getByRole("button", { name: "Mute Pink noise" }))
  const beforeRemoval = await readDiagnostics(page)
  const pinkId = beforeRemoval.recipe?.layers.find(({ sourceId }) => sourceId === "noise:pink")?.id
  const brownId = beforeRemoval.recipe?.layers.find(({ sourceId }) => sourceId === "noise:brown")?.id
  const alphaId = beforeRemoval.recipe?.layers.find(({ sourceId }) => sourceId === "binaural:alpha")?.id
  expect(pinkId).toBeTruthy()
  expect(brownId).toBeTruthy()
  expect(alphaId).toBeTruthy()
  await expect.poll(async () => (await readDiagnostics(page)).runtime?.activeLayers[pinkId!]?.muted)
    .toBe(true)
  await press(currentMix.getByRole("button", { name: "Remove Alpha binaural beat" }))
  await expect(page.getByText("Alpha binaural beat")).toHaveCount(0)
  await expect.poll(async () => (await readDiagnostics(page)).runtime?.activeLayers[alphaId!])
    .toBeUndefined()
  expect(Object.keys((await readDiagnostics(page)).runtime?.activeLayers ?? {}).sort())
    .toEqual([brownId!, pinkId!].sort())
})

test("announces every simultaneous failure through one stable live region", async ({ page }) => {
  await page.addInitScript(() => {
    const bridge = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as { failNextSourceIds: string[] }
    bridge.failNextSourceIds.push("noise:pink", "binaural:alpha")
  })
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await addBinauralPreset(page)
  const liveRegion = page.getByRole("status")
  await expect(liveRegion).toHaveCount(1)
  await page.evaluate(() => {
    Reflect.set(window, "__massagelabAtmoLiveRegion", document.querySelector("[role='status']"))
  })
  await page.getByRole("button", { name: "Play AtmoShaper" }).first().click()

  await expect(liveRegion).toContainText("Pink noise failed")
  await expect(liveRegion).toContainText("Alpha binaural beat failed")
  expect(await page.evaluate(() => (
    Reflect.get(window, "__massagelabAtmoLiveRegion") === document.querySelector("[role='status']")
  ))).toBe(true)
  await expect(page.getByRole("region", { name: "Interruption preference" })).toHaveCount(0)
  await page.waitForTimeout(250)
  await expect(page.getByRole("region", { name: "Interruption preference" })).toHaveCount(0)
})

test("narrow Current Mix Sheet closes to its keyboard opener", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  const trigger = page.getByRole("button", { name: "Open full Current Mix" })
  await press(trigger)
  await expect(page.getByRole("dialog", { name: "Full Current Mix controls" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Full Current Mix controls" })).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test("reduced motion removes decoration while preserving usable controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 375, height: 667 })
  await openAtmoShaper(page)
  const motion = await page.locator(".ml-atmoshaper-mix-tray").evaluate((element) => {
    const styles = getComputedStyle(element)
    return { animationName: styles.animationName, transitionDuration: styles.transitionDuration }
  })
  expect(motion.animationName).toBe("none")
  expect(motion.transitionDuration).toBe("0s")
  await expect(page.getByRole("button", { name: "Open full Current Mix" })).toBeVisible()
})

test("200% text keeps Sheet controls operable, unobscured, and clear of the player", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await openAtmoShaper(page)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await addNoise(page, "Pink")
  await press(page.getByRole("button", { name: "Play AtmoShaper" }).first())
  await waitForAtmoStatus(page, "playing")
  await closeInterruptionNoticeIfVisible(page)
  const trigger = page.getByRole("button", { name: "Open full Current Mix" })
  await press(trigger)
  const dialog = page.getByRole("dialog", { name: "Full Current Mix controls" })
  await expect(dialog).toBeVisible()
  await press(dialog.getByLabel("Volume for Pink noise"), "ArrowLeft")
  await press(dialog.getByRole("button", { name: "Mute Pink noise" }))
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()

  const receipt = await measureGeometry(page)
  expectNoDocumentOverflow(receipt)
  expectRectsNotToOverlap(receipt.currentMix!, receipt.player!, `200% geometry: ${JSON.stringify(receipt)}`)
  await expectHitTarget(page, trigger, `200% full-mix trigger: ${JSON.stringify(receipt)}`)
})

test("viewport matrix has no document overflow and grows usefully on large displays", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await page.getByRole("button", { name: "Play AtmoShaper" }).first().click()
  await waitForAtmoStatus(page, "playing")

  const receipts = new Map<string, GeometryReceipt>()
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expect(page.getByLabel("AtmoShaper live mixer")).toBeVisible()
    const receipt = await measureGeometry(page)
    expectNoDocumentOverflow(receipt)
    receipts.set(`${viewport.width}x${viewport.height}`, receipt)
  }
  console.log(`[task-8-atmoshaper-geometry] ${JSON.stringify(Object.fromEntries(receipts))}`)

  const laptop = receipts.get("1440x900")!
  const tv = receipts.get("2560x1440")!
  const message = `AtmoShaper large-display geometry: ${JSON.stringify({ laptop, tv })}`
  expect(tv.workspace!.width, message).toBeGreaterThan(laptop.workspace!.width + 500)
  expect(tv.workspace!.height, message).toBeGreaterThan(laptop.workspace!.height + 300)
  expect(tv.library!.width, message).toBeGreaterThan(laptop.library!.width + 250)
  expect(tv.library!.height, message).toBeGreaterThan(laptop.library!.height + 250)
  expect(tv.currentMix!.width, message).toBeGreaterThan(laptop.currentMix!.width + 400)
  expect(tv.currentMix!.height, message).toBeGreaterThan(laptop.currentMix!.height + 300)
})

test("Media Session represents the mix with artwork, Play, Pause, Stop, and no station navigation", async ({ page, request }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await page.getByRole("button", { name: "Play AtmoShaper" }).first().click()
  await waitForAtmoStatus(page, "playing")

  let media = await readMediaSession(page)
  expect(media.metadata).toMatchObject({
    album: "MassageLab Atmosphere",
    artist: "MassageLab",
    title: "AtmoShaper",
  })
  expect(media.metadata?.artwork).toEqual([{
    src: "/icons/icon-512.png",
    sizes: "512x512",
    type: "image/png",
  }])
  const artwork = await request.get(media.metadata!.artwork![0].src!)
  expect(artwork.ok()).toBe(true)
  expect(artwork.headers()["content-type"]).toContain("image/png")
  const artworkBody = await artwork.body()
  expect(artworkBody.readUInt32BE(16)).toBe(512)
  expect(artworkBody.readUInt32BE(20)).toBe(512)
  expect(media.actions.play).toBe("function")
  expect(media.actions.pause).toBe("function")
  expect(media.actions.stop).toBe("function")
  expect(media.actions.previoustrack).toBe("object")
  expect(media.actions.nexttrack).toBe("object")

  await invokeMediaSessionAction(page, "pause")
  await expect.poll(async () => (await readDiagnostics(page)).playbackState).toBe("paused")
  await invokeMediaSessionAction(page, "play")
  await expect.poll(async () => (await readDiagnostics(page)).playbackState).toBe("playing")
  await invokeMediaSessionAction(page, "stop")
  await expect.poll(async () => (await readDiagnostics(page)).playbackState).toBe("stopped")
  await page.getByTestId("music-player-toolbar").getByRole("button", { name: "Play", exact: true }).click()
  await waitForAtmoStatus(page, "playing")
  const restarted = await readDiagnostics(page)
  expect(restarted.activePlaybackKind).toBe("atmoshaper")
  expect(restarted.activeStationId).toBeNull()
  media = await readMediaSession(page)
  expect(media.actions.previoustrack).toBe("object")
  expect(media.actions.nexttrack).toBe("object")
})
