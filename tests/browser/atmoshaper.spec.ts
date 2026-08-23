import { expect, test, type Locator, type Page } from "@playwright/test"

import { centerCarouselItem } from "./carousel-test-helpers"

type LayerState = {
  error?: string
  status: "loading" | "playing" | "paused" | "failed"
}

type AtmoShaperPreviewDiagnostics = {
  error?: string
  layer: {
    id: string
    kind: string
    muted: boolean
    sourceId: string
    volume: number
  }
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
  atmoShaperPreview: AtmoShaperPreviewDiagnostics | null
  runtime: {
    activeLayers: Record<string, { id: string, muted: boolean, sourceId: string, volume: number }>
    layers: Record<string, LayerState>
    preview: AtmoShaperPreviewDiagnostics | null
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
  mutationCount: number
  playbackState: string
}

type GeometryReceipt = {
  appBar: DOMRectReceipt | null
  audioToolbarHeight: number
  drawer: DOMRectReceipt | null
  drawerMode: string | null
  document: {
    clientHeight: number
    clientWidth: number
    scrollHeight: number
    scrollWidth: number
  }
  library: DOMRectReceipt | null
  notice: DOMRectReceipt | null
  player: DOMRectReceipt | null
  portalBottomStackHeight: number
  rail: DOMRectReceipt | null
  rootFontSize: number
  safeAreaTop: number
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

type TouchActivationReceipt = {
  activatedAt: number | null
  boundaryAt: number | null
  startedAt: number | null
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
      holdNextCarrierStart: false,
    })

    const mediaSession: {
      handlers: Record<string, (() => void) | null>
      metadata: MediaSessionProbe["metadata"]
      mutationCount: number
      playbackState: string
      setActionHandler(action: string, handler: (() => void) | null): void
      setPositionState(): void
    } = {
      handlers: {},
      metadata: null,
      mutationCount: 0,
      playbackState: "none",
      setActionHandler(action, handler) {
        this.handlers[action] = handler
        this.mutationCount += 1
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

      constructor() {
        super()
        Reflect.set(window, "__massagelabAtmoCarrierAudio", this)
      }

      getAttribute(name: string) {
        return name === "src" && this.src ? this.src : null
      }

      removeAttribute(name: string) {
        if (name === "src") this.src = ""
      }

      async play() {
        const qa = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as {
          holdNextCarrierStart?: boolean
          releaseCarrierStart?: () => void
        }
        if (qa.holdNextCarrierStart) {
          qa.holdNextCarrierStart = false
          await new Promise<void>((resolve) => { qa.releaseCarrierStart = resolve })
          delete qa.releaseCarrierStart
        }
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
  await press(page.getByRole("button", { name: `Add ${preset} binaural beat` }))
}

async function addNoise(page: Page, color: "White" | "Pink" | "Brown") {
  const tab = page.getByRole("tab", { name: "Noise" })
  if (await tab.getAttribute("aria-selected") !== "true") await press(tab)
  await press(page.getByRole("button", { name: `Add ${color} noise` }))
}

async function previewNoise(page: Page, color: "White" | "Pink" | "Brown") {
  const tab = page.getByRole("tab", { name: "Noise" })
  if (await tab.getAttribute("aria-selected") !== "true") await press(tab)
  await press(page.getByRole("button", { name: `Preview ${color} noise` }))
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview?.status)
    .toBe("playing")
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

async function expectRailOrderMatchesRecipe(page: Page) {
  const recipeOrder = (await readDiagnostics(page)).recipe?.layers.map(({ id }) => id) ?? []
  await expect.poll(async () => page
    .locator(".ml-atmoshaper-current-mix-rail [data-layer-id]:visible, .ml-atmoshaper-expanded-layers [data-layer-id]:visible")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-layer-id"))))
    .toEqual(recipeOrder)
}

async function readMediaSession(page: Page) {
  return page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabAtmoMediaSession") as {
      handlers: Record<string, (() => void) | null>
      metadata: MediaSessionProbe["metadata"]
      mutationCount: number
      playbackState: string
    }
    return {
      actions: Object.fromEntries(
        ["play", "pause", "stop", "previoustrack", "nexttrack"]
          .map((action) => [action, typeof probe.handlers[action]]),
      ),
      metadata: probe.metadata,
      mutationCount: probe.mutationCount,
      playbackState: probe.playbackState,
    } as MediaSessionProbe
  })
}

async function holdNextCarrierStart(page: Page) {
  await page.evaluate(() => {
    const bridge = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as {
      holdNextCarrierStart: boolean
    }
    bridge.holdNextCarrierStart = true
  })
}

async function releaseCarrierStart(page: Page) {
  await page.evaluate(() => {
    const bridge = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as {
      releaseCarrierStart?: () => void
    }
    if (!bridge.releaseCarrierStart) throw new Error("Carrier start is not held.")
    bridge.releaseCarrierStart()
  })
}

async function readCarrier(page: Page) {
  return page.evaluate(() => {
    const carrier = Reflect.get(window, "__massagelabAtmoCarrierAudio") as {
      paused: boolean
      src: string
    }
    return { paused: carrier.paused, src: carrier.src }
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

async function setAudioSessionState(page: Page, state: "active" | "interrupted") {
  await page.evaluate((nextState) => {
    const session = Reflect.get(navigator, "audioSession") as EventTarget & { state: string }
    session.state = nextState
    session.dispatchEvent(new Event("statechange"))
  }, state)
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

async function dispatchTouch(
  locator: Locator,
  type: "touchstart" | "touchmove" | "touchend",
  input: { identifier: number, x: number, y: number },
) {
  await locator.evaluate((element, eventInput) => {
    const touch = new Touch({
      clientX: eventInput.x,
      clientY: eventInput.y,
      identifier: eventInput.identifier,
      pageX: eventInput.x + window.scrollX,
      pageY: eventInput.y + window.scrollY,
      screenX: eventInput.x,
      screenY: eventInput.y,
      target: element,
    })
    const activeTouches = eventInput.type === "touchend" ? [] : [touch]
    element.dispatchEvent(new TouchEvent(eventInput.type, {
      bubbles: true,
      cancelable: true,
      changedTouches: [touch],
      targetTouches: activeTouches,
      touches: activeTouches,
    }))
  }, { ...input, type })
}

/** Records the actual TouchSensor activation time without sleeping in Node. */
async function installTouchActivationReceipt(locator: Locator, key: string) {
  await locator.evaluate((element, receiptKey) => {
    const receipt: TouchActivationReceipt = {
      activatedAt: null,
      boundaryAt: null,
      startedAt: null,
    }
    const observer = new MutationObserver(() => {
      if (element.getAttribute("aria-pressed") === "true" && receipt.activatedAt === null) {
        receipt.activatedAt = performance.now()
      }
    })
    observer.observe(element, { attributeFilter: ["aria-pressed"], attributes: true })
    element.addEventListener("touchstart", () => {
      receipt.startedAt = performance.now()
    }, { once: true })
    Reflect.set(window, receiptKey, { observer, receipt })
  }, key)
}

/** Resolves on a measured animation-frame boundary, racing any observed activation. */
async function waitForTouchBoundary(page: Page, key: string, minimumMs: number) {
  return page.evaluate(({ minimum, receiptKey }) => new Promise<TouchActivationReceipt>((resolve) => {
    const probe = Reflect.get(window, receiptKey) as {
      receipt: TouchActivationReceipt
    }
    const sample = () => {
      if (probe.receipt.startedAt === null || performance.now() - probe.receipt.startedAt < minimum) {
        window.requestAnimationFrame(sample)
        return
      }
      probe.receipt.boundaryAt = performance.now()
      resolve({ ...probe.receipt })
    }
    window.requestAnimationFrame(sample)
  }), { minimum: minimumMs, receiptKey: key })
}

async function readTouchActivationReceipt(page: Page, key: string) {
  return page.evaluate((receiptKey) => {
    const probe = Reflect.get(window, receiptKey) as {
      observer: MutationObserver
      receipt: TouchActivationReceipt
    }
    probe.observer.disconnect()
    return { ...probe.receipt }
  }, key)
}

async function openFullMix(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  if (!await dialog.isVisible()) {
    // A zero-to-one Add schedules the approved discovery expansion on the
    // next frame. Give that transaction a chance to win before targeting the
    // same persistent rail control in its collapsed state.
    await page.evaluate(() => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    }))
    if (!await dialog.isVisible()) {
      await press(page.getByRole("button", { name: "Open Current Mix" }))
    }
  }
  await expect(dialog).toBeVisible()
  return { scope: dialog, sheetWasOpened: true }
}

async function closeFullMix(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  if (await dialog.isVisible()) {
    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)))
    })
    if (await dialog.isVisible()) {
      const close = dialog.getByRole("button", { name: "Close Current Mix" })
      await close.focus()
      await page.keyboard.press("Escape")
    }
  }
  await expect(dialog).toHaveCount(0)
  // Focus restoration runs on the following frame even though the persistent
  // rail and its controls never unmount.
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  }))
}

async function playAtmoShaper(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  if (await dialog.isVisible()) {
    await press(dialog.getByRole("button", { name: "Play AtmoShaper" }))
    return
  }
  await press(page.getByRole("button", { name: "Play AtmoShaper" }).first())
}

async function closeInterruptionNoticeIfVisible(page: Page) {
  const notice = page.getByRole("region", { name: "Interruption preference" })
  if (await notice.isVisible()) {
    await notice.getByRole("button", { name: "Close" }).click()
    await expect(notice).toHaveCount(0)
  }
}

async function settleCurrentMixDrawer(page: Page) {
  const panel = page.locator(".ml-atmoshaper-current-mix-rail")
  if (await panel.isVisible()) {
    await panel.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)))
    })
  }
}

/** Waits until ResizeObserver-driven drawer classification agrees for consecutive frames. */
async function settleCurrentMixDrawerMode(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    let stableFrames = 0
    let previousMode: string | undefined
    const sample = () => {
      const workspace = document.querySelector<HTMLElement>(".ml-atmoshaper-workspace")
      if (!workspace) {
        window.requestAnimationFrame(sample)
        return
      }
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      const rect = workspace.getBoundingClientRect()
      const expectedMode = rect.width >= 42 * rootFontSize && rect.height >= 32 * rootFontSize
        ? "roomy"
        : "narrow"
      const mode = workspace.dataset.drawerMode
      stableFrames = mode === expectedMode && mode === previousMode ? stableFrames + 1 : 0
      previousMode = mode
      if (stableFrames >= 3) {
        resolve()
        return
      }
      window.requestAnimationFrame(sample)
    }
    sample()
  }))
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
    const rootStyles = getComputedStyle(root)
    const currentMixRail = document.querySelector<HTMLElement>(".ml-atmoshaper-current-mix-rail")
    const currentMixPanelReceipt = receipt(".ml-atmoshaper-current-mix-rail")
    const currentMixIsExpanded = currentMixRail?.dataset.expanded === "true"
    const noticeElement = document.querySelector<HTMLElement>(".ml-music-interruption-notice")
    const reservationStyles = noticeElement ? getComputedStyle(noticeElement) : rootStyles
    const cssPixels = (property: string) => Number.parseFloat(reservationStyles.getPropertyValue(property)) || 0
    return {
      appBar: receipt(".ml-mobile-main-bar")
        ?? receipt(".ml-app-topbar")
        ?? receipt("[data-sidebar='sidebar']"),
      audioToolbarHeight: cssPixels("--ml-audio-toolbar-height"),
      drawer: currentMixIsExpanded ? currentMixPanelReceipt : null,
      drawerMode: document.querySelector<HTMLElement>(".ml-atmoshaper-workspace")?.dataset.drawerMode ?? null,
      document: {
        clientHeight: root.clientHeight,
        clientWidth: root.clientWidth,
        scrollHeight: root.scrollHeight,
        scrollWidth: root.scrollWidth,
      },
      library: receipt(".ml-atmoshaper-library"),
      notice: receipt(".ml-music-interruption-notice"),
      player: receipt(".ml-music-player"),
      portalBottomStackHeight: cssPixels("--ml-portal-bottom-stack-height"),
      rail: currentMixIsExpanded ? null : currentMixPanelReceipt,
      rootFontSize: Number.parseFloat(rootStyles.fontSize),
      safeAreaTop: cssPixels("--ml-safe-top"),
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
  expect(receipt.appBar, message).not.toBeNull()
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

test("keeps preview controls on the active card without shifting the sound-group rail", async ({ page }) => {
  await page.setViewportSize({ width: 1027, height: 1027 })
  await openAtmoShaper(page)
  const tabs = page.getByRole("tablist", { name: "AtmoShaper sound groups" })
  const whiteCard = page.locator("[data-library-source='noise:white']")
  const before = await Promise.all([tabs.boundingBox(), whiteCard.boundingBox()])
  const tabStyles = await tabs.evaluate((element) => {
    const styles = getComputedStyle(element)
    return {
      background: styles.backgroundColor,
      marginBottom: Number.parseFloat(styles.marginBottom),
      marginTop: Number.parseFloat(styles.marginTop),
      paddingBottom: Number.parseFloat(styles.paddingBottom),
      paddingTop: Number.parseFloat(styles.paddingTop),
      height: element.getBoundingClientRect().height,
      overflowY: styles.overflowY,
    }
  })
  const activeTabHeight = await page.getByRole("tab", { name: "Noise" })
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(tabStyles).toMatchObject({
    background: "rgba(0, 0, 0, 0)",
    marginBottom: 0,
    marginTop: 0,
    paddingBottom: 24,
    paddingTop: 24,
    overflowY: "visible",
  })
  expect(tabStyles.height).toBeGreaterThanOrEqual(activeTabHeight + 48)

  await press(page.getByRole("button", { name: "Preview White noise" }))
  const localPreview = whiteCard.locator(".ml-atmoshaper-card-preview-controls")
  await expect(localPreview).toBeVisible()
  await expect(page.locator(".ml-atmoshaper-preview-strip")).toHaveCount(0)
  const after = await Promise.all([tabs.boundingBox(), whiteCard.boundingBox()])
  expect(after[0]!.y).toBeCloseTo(before[0]!.y, 1)
  expect(after[1]!.height).toBeCloseTo(before[1]!.height, 1)
})

test("flattens brainwave artwork behind the immediately reachable controls", async ({ page }) => {
  await page.setViewportSize({ width: 1394, height: 1027 })
  await openAtmoShaper(page)
  await press(page.getByRole("tab", { name: "Isochronic tones" }))
  const panel = page.locator(".ml-atmoshaper-brainwave-panel")
  const library = page.locator(".ml-atmoshaper-library")
  const tabsRoot = page.locator(".ml-atmoshaper-library-tabs-root")
  const libraryBackdrop = tabsRoot.locator(".ml-atmoshaper-library-brainwave-canvas")
  const tabPanel = page.getByRole("tabpanel", { name: "Isochronic tones" })
  const backdrop = panel.locator(".ml-atmoshaper-brainwave-backdrop")
  await expect(panel).toBeVisible()
  await expect(page.getByRole("group", { name: "Isochronic tones presets" })).toBeVisible()
  const visual = await Promise.all([
    panel.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      borderStyle: getComputedStyle(element).borderStyle,
    })),
    backdrop.evaluate((element) => ({
      opacity: Number.parseFloat(getComputedStyle(element).opacity),
      position: getComputedStyle(element).position,
    })),
  ])
  expect(visual[0].borderStyle).toBe("none")
  expect(visual[0].background).toBe("rgba(0, 0, 0, 0)")
  expect(visual[1].position).toBe("absolute")
  expect(visual[1].opacity).toBeLessThanOrEqual(0.3)
  const [isochronicBox, tabPanelBox] = await Promise.all([panel.boundingBox(), tabPanel.boundingBox()])
  expect(isochronicBox!.width).toBeGreaterThanOrEqual(tabPanelBox!.width * 0.95)
  const [tabsRootBox, libraryBox, libraryBackdropBox] = await Promise.all([
    tabsRoot.boundingBox(),
    library.boundingBox(),
    libraryBackdrop.boundingBox(),
  ])
  expect(libraryBackdropBox!.width / tabsRootBox!.width).toBeCloseTo(1.2, 2)
  expect(
    libraryBackdropBox!.width / libraryBox!.width,
    "the decorative wave canvas should be at least 10% wider than the clipped Sound Library surface",
  ).toBeGreaterThanOrEqual(1.1)
  expect(libraryBackdropBox!.height).toBeGreaterThan(tabsRootBox!.height)
  expect(libraryBackdropBox!.x).toBeLessThan(tabsRootBox!.x)
  expect(libraryBackdropBox!.x + libraryBackdropBox!.width)
    .toBeGreaterThan(tabsRootBox!.x + tabsRootBox!.width)
  expect(libraryBackdropBox!.x + libraryBackdropBox!.width / 2)
    .toBeCloseTo(tabsRootBox!.x + tabsRootBox!.width / 2, 1)
  await expect(library).toHaveCSS("overflow-x", "hidden")
  const backdropTreatment = await libraryBackdrop.evaluate((element) => ({
    backgroundImage: getComputedStyle(element).backgroundImage,
    maskImage: getComputedStyle(element).maskImage,
    rectCount: element.querySelectorAll("svg rect").length,
    pathCount: element.querySelectorAll("svg path").length,
  }))
  expect(backdropTreatment.backgroundImage).toContain("radial-gradient")
  expect(backdropTreatment.maskImage).toContain("radial-gradient")
  expect(backdropTreatment.rectCount).toBe(0)
  expect(backdropTreatment.pathCount).toBeGreaterThanOrEqual(2)
  await expect(panel).toHaveAttribute("data-brainwave-kind", "isochronic")
  await expect(panel.locator(".ml-atmoshaper-advanced-controls"))
    .toHaveCSS("border-top-style", "none")
  await expect(backdrop).toBeHidden()
  const isochronicPresets = panel.locator(".ml-atmoshaper-preset-buttons")
  await expect(isochronicPresets).toHaveCSS("overflow", "visible")
  expect(await isochronicPresets.evaluate((element) => ({
    paddingBlock: Number.parseFloat(getComputedStyle(element).paddingBlockStart),
    paddingInline: Number.parseFloat(getComputedStyle(element).paddingInlineStart),
  }))).toEqual({ paddingBlock: 12, paddingInline: 4 })

  await press(page.getByRole("tab", { name: "Binaural beats" }))
  const binauralPanel = page.locator(".ml-atmoshaper-brainwave-panel")
  const [binauralBox, binauralTabPanelBox] = await Promise.all([
    binauralPanel.boundingBox(),
    page.getByRole("tabpanel", { name: "Binaural beats" }).boundingBox(),
  ])
  expect(binauralBox!.width).toBeLessThan(binauralTabPanelBox!.width * 0.9)
  await expect(libraryBackdrop).toHaveCount(1)
  await expect(libraryBackdrop.locator("svg")).toHaveAttribute("data-brainwave-kind", "binaural")
  const binauralBackdrop = binauralPanel.locator(".ml-atmoshaper-brainwave-backdrop")
  await expect(binauralBackdrop).toBeHidden()
  const binauralLibraryBox = await libraryBackdrop.boundingBox()
  expect(binauralLibraryBox!.width / libraryBox!.width).toBeGreaterThanOrEqual(1.1)
  expect(binauralLibraryBox!.x).toBeLessThan(libraryBox!.x)
  expect(binauralLibraryBox!.x + binauralLibraryBox!.width)
    .toBeGreaterThan(libraryBox!.x + libraryBox!.width)
  await expect(binauralPanel.locator(".ml-atmoshaper-advanced-controls"))
    .toHaveCSS("border-top-style", "none")
  await expect(binauralPanel.locator(".ml-atmoshaper-preset-buttons")).toHaveCSS("overflow", "visible")
})

test("tones down white noise and refines the brown texture scale", async ({ page }) => {
  await page.setViewportSize({ width: 1394, height: 1027 })
  await openAtmoShaper(page)
  const whiteArt = page.locator("[data-library-source='noise:white'] .ml-atmoshaper-noise-artwork")
  const brownArt = page.locator("[data-library-source='noise:brown'] .ml-atmoshaper-noise-artwork")
  await expect(whiteArt.locator("linearGradient stop").first()).toHaveAttribute("stop-color", "#b9bab5")
  await expect(whiteArt.locator("linearGradient stop").nth(1)).toHaveAttribute("stop-color", "#777a76")
  await expect(whiteArt.locator("linearGradient stop").last()).toHaveAttribute("stop-color", "#2f322f")
  await expect(whiteArt.locator("path")).toHaveAttribute("stroke", "#f2f1ec")
  await expect(whiteArt.locator("rect").nth(1)).toHaveAttribute("opacity", "0.92")
  await expect(brownArt.locator("feTurbulence")).toHaveAttribute("baseFrequency", "0.58")
})

test("expands the one edge rail inward without moving its control anchors", async ({ page }) => {
  await page.setViewportSize({ width: 1235, height: 1027 })
  await openAtmoShaper(page)
  await addNoise(page, "White")
  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  await expect(dialog).toBeVisible()
  await settleCurrentMixDrawer(page)
  await page.getByRole("heading", { name: "Sound Library" }).click()
  await expect(dialog).toHaveCount(0)
  await settleCurrentMixDrawer(page)
  const workspace = page.getByLabel("AtmoShaper live mixer")
  const rail = page.getByLabel("Current Mix rail")
  await expect(workspace).toHaveAttribute("data-drawer-mode", "roomy")
  const measureControls = (root: typeof rail) => root.evaluate((element) => {
    const receipt = (selector: string) => {
      const target = selector === ":scope"
        ? element
        : element.querySelector<HTMLElement>(selector)
      if (!target) return null
      const rect = target.getBoundingClientRect()
      return {
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      }
    }
    const style = getComputedStyle(element)
    return {
      mix: receipt(".ml-atmoshaper-mix-toggle"),
      transport: receipt(".ml-atmoshaper-expanded-mix-transport"),
      volume: receipt(".ml-atmoshaper-master-volume-slot"),
      layer: receipt(".ml-atmoshaper-expanded-layers .ml-atmoshaper-layer-row"),
      root: receipt(":scope"),
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
    }
  })
  const collapsed = await measureControls(rail)
  await rail.evaluate((element) => {
    Reflect.set(window, "__mlAtmoShaperPersistentPanel", element)
    Reflect.set(window, "__mlAtmoShaperPersistentControls", [
      element.querySelector("[data-atmoshaper-focus-key='mix']"),
      element.querySelector(".ml-atmoshaper-transport-button"),
      element.querySelector(".ml-atmoshaper-master-volume-slot"),
      element.querySelector(".ml-atmoshaper-layer-row"),
    ])
  })
  expect(collapsed.borderRadius).toBe("0px")
  expect(collapsed.boxShadow).toBe("none")
  expect(Math.abs(collapsed.layer!.width - collapsed.layer!.height)).toBeLessThanOrEqual(1)
  const compactVolume = rail.getByRole("button", { name: "Open whole mix volume controls" })
  await expect(compactVolume).toBeVisible()
  const compactVolumeTreatment = await compactVolume.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const slotRect = element.parentElement!.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      borderRadius: Number.parseFloat(style.borderRadius),
      borderStyles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
        .map(Number.parseFloat),
      leftInset: rect.left - slotRect.left,
      rightInset: slotRect.right - rect.right,
    }
  })
  expect(compactVolumeTreatment.borderRadius).toBeGreaterThan(0)
  expect(compactVolumeTreatment.borderStyles).toEqual(["solid", "solid", "solid", "solid"])
  expect(compactVolumeTreatment.borderWidths.every((width) => width >= 1)).toBe(true)
  expect(compactVolumeTreatment.leftInset).toBeGreaterThanOrEqual(-0.5)
  expect(compactVolumeTreatment.rightInset).toBeGreaterThanOrEqual(-0.5)

  await press(rail.getByRole("button", { name: "Open Current Mix" }))
  await expect(dialog).toBeVisible()
  await settleCurrentMixDrawer(page)
  await expect(rail).toBeVisible()
  await expect(rail).toHaveAttribute("data-expanded", "true")
  expect(await rail.evaluate((element) => (
    element === Reflect.get(window, "__mlAtmoShaperPersistentPanel")
    && [
      element.querySelector("[data-atmoshaper-focus-key='mix']"),
      element.querySelector(".ml-atmoshaper-transport-button"),
      element.querySelector(".ml-atmoshaper-master-volume-slot"),
      element.querySelector(".ml-atmoshaper-layer-row"),
    ].every((control, index) => control === Reflect.get(window, "__mlAtmoShaperPersistentControls")[index])
  ))).toBe(true)
  const expanded = await measureControls(rail)
  const expandedVolumeTreatment = await dialog.locator(".ml-atmoshaper-expanded-master-volume")
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const slotRect = element.parentElement!.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        borderRadius: Number.parseFloat(style.borderRadius),
        borderStyles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
          .map(Number.parseFloat),
        leftInset: rect.left - slotRect.left,
        rightInset: slotRect.right - rect.right,
      }
    })
  expect(expandedVolumeTreatment.borderRadius).toBeGreaterThan(0)
  expect(expandedVolumeTreatment.borderStyles).toEqual(["solid", "solid", "solid", "solid"])
  expect(expandedVolumeTreatment.borderWidths.every((width) => width >= 1)).toBe(true)
  expect(expandedVolumeTreatment.leftInset).toBeGreaterThanOrEqual(-0.5)
  expect(expandedVolumeTreatment.rightInset).toBeGreaterThanOrEqual(-0.5)
  expect(expanded.root!.right).toBeCloseTo(collapsed.root!.right, 1)
  expect(expanded.root!.top).toBeCloseTo(collapsed.root!.top, 1)
  expect(expanded.root!.bottom).toBeCloseTo(collapsed.root!.bottom, 1)
  expect(expanded.layer!.width).toBeGreaterThan(collapsed.layer!.width * 3)
  for (const control of ["mix", "transport", "volume", "layer"] as const) {
    expect(
      Math.abs(expanded[control]!.top - collapsed[control]!.top),
      `${control} control should retain its vertical anchor`,
    ).toBeLessThanOrEqual(1)
  }
  await expect(dialog.getByRole("button", { name: "Solo White noise" })).toHaveAttribute("aria-pressed", "false")
  await press(dialog.getByRole("button", { name: "Solo White noise" }))
  await expect(dialog.getByRole("button", { name: "Unsolo White noise" })).toHaveAttribute("aria-pressed", "true")

  await page.getByRole("heading", { name: "Sound Library" }).click()
  await expect(dialog).toHaveCount(0)
  const restoredRail = page.getByLabel("Current Mix rail")
  await expect(restoredRail).toBeVisible()
  await expect(restoredRail).toHaveAttribute("data-expanded", "false")
  expect(await restoredRail.evaluate((element) => (
    element === Reflect.get(window, "__mlAtmoShaperPersistentPanel")
  ))).toBe(true)
  await expect(restoredRail.getByRole("button", { name: "Unsolo White noise" }))
    .toHaveAttribute("aria-pressed", "true")
})

test("keeps the compact whole-mix volume outline closed in a short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 950, height: 500 })
  await openAtmoShaper(page)
  const rail = page.getByLabel("Current Mix rail")
  const compactVolume = rail.getByRole("button", { name: "Open whole mix volume controls" })
  await expect(compactVolume).toBeVisible()
  const treatment = await compactVolume.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const slotRect = element.parentElement!.getBoundingClientRect()
    const railRect = element.closest(".ml-atmoshaper-current-mix-rail")!.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      borderStyles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
        .map(Number.parseFloat),
      left: rect.left,
      right: rect.right,
      slotLeft: slotRect.left,
      slotRight: slotRect.right,
      railLeft: railRect.left,
      railRight: railRect.right,
    }
  })
  expect(treatment.borderStyles).toEqual(["solid", "solid", "solid", "solid"])
  expect(treatment.borderWidths.every((width) => width >= 1)).toBe(true)
  expect(treatment.left).toBeGreaterThanOrEqual(treatment.slotLeft - 0.5)
  expect(treatment.right).toBeLessThanOrEqual(treatment.slotRight + 0.5)
  expect(treatment.left).toBeGreaterThanOrEqual(treatment.railLeft - 0.5)
  expect(treatment.right).toBeLessThanOrEqual(treatment.railRight + 0.5)
})

test("keeps the expanded volume outline and layer height aligned in a short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 950, height: 500 })
  await openAtmoShaper(page)
  await addNoise(page, "White")

  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  await expect(dialog).toBeVisible()
  await settleCurrentMixDrawer(page)
  await press(dialog.getByRole("button", { name: "Close Current Mix" }))
  await expect(dialog).toHaveCount(0)
  await settleCurrentMixDrawer(page)

  const rail = page.getByLabel("Current Mix rail")
  const compactVolume = rail.getByRole("button", { name: "Open whole mix volume controls" })
  const collapsedLayer = rail.locator(".ml-atmoshaper-layer-row").filter({ hasText: "White noise" })
  const [compactVolumeTreatment, collapsedLayerBox] = await Promise.all([
    compactVolume.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderTopColor,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
      }
    }),
    collapsedLayer.boundingBox(),
  ])

  await press(rail.getByRole("button", { name: "Open Current Mix" }))
  await expect(dialog).toBeVisible()
  await settleCurrentMixDrawer(page)

  const expandedVolume = dialog.locator(".ml-atmoshaper-expanded-master-volume")
  const expandedLayer = dialog.locator(".ml-atmoshaper-layer-row").filter({ hasText: "White noise" })
  const [expandedVolumeTreatment, expandedLayerBox] = await Promise.all([
    expandedVolume.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderTopColor,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
      }
    }),
    expandedLayer.boundingBox(),
  ])

  expect(expandedVolumeTreatment).toEqual(compactVolumeTreatment)
  expect(
    Math.abs(expandedLayerBox!.height - collapsedLayerBox!.height),
    "opening the rail should not increase a standard layer row's height",
  ).toBeLessThanOrEqual(1)

  const collapseSamples = await expandedLayer.evaluate(async (layer) => {
    const rail = layer.closest<HTMLElement>(".ml-atmoshaper-current-mix-rail")!
    const closeButton = rail.querySelector<HTMLButtonElement>("[aria-label='Close Current Mix']")!
    const samples: Array<{ height: number; width: number }> = []

    return new Promise<Array<{ height: number; width: number }>>((resolve, reject) => {
      let frame = 0
      const timeout = window.setTimeout(() => {
        cancelAnimationFrame(frame)
        reject(new Error("Current Mix collapse did not finish"))
      }, 1_000)
      const capture = () => {
        const rect = layer.getBoundingClientRect()
        samples.push({ height: rect.height, width: rect.width })
        frame = requestAnimationFrame(capture)
      }
      const finish = (event: TransitionEvent) => {
        if (event.target !== rail || event.propertyName !== "width") return
        rail.removeEventListener("transitionend", finish)
        window.clearTimeout(timeout)
        cancelAnimationFrame(frame)
        const rect = layer.getBoundingClientRect()
        samples.push({ height: rect.height, width: rect.width })
        resolve(samples)
      }

      rail.addEventListener("transitionend", finish)
      frame = requestAnimationFrame(capture)
      closeButton.click()
    })
  })
  expect(Math.max(...collapseSamples.map(({ width }) => width)))
    .toBeGreaterThan(Math.min(...collapseSamples.map(({ width }) => width)) * 3)
  expect(
    Math.max(...collapseSamples.map(({ height }) => height))
      - Math.min(...collapseSamples.map(({ height }) => height)),
    "a layer should contract horizontally without ballooning vertically during collapse",
  ).toBeLessThanOrEqual(1)

  await expect(dialog).toHaveCount(0)
  const collapsedRow = rail.locator(".ml-atmoshaper-layer-row").filter({ hasText: "White noise" })
  for (const name of ["Mute White noise", "Solo White noise"]) {
    const treatment = await collapsedRow.getByRole("button", { name }).evaluate((button) => {
      const rowRect = button.closest<HTMLElement>(".ml-atmoshaper-layer-row")!.getBoundingClientRect()
      const rect = button.getBoundingClientRect()
      const style = getComputedStyle(button)
      return {
        bottomInset: rowRect.bottom - rect.bottom,
        leftInset: rect.left - rowRect.left,
        radius: Number.parseFloat(style.borderTopLeftRadius),
        rightInset: rowRect.right - rect.right,
      }
    })
    expect(treatment.radius, `${name} should have rounded corners`).toBeGreaterThanOrEqual(4)
    expect(
      Math.min(treatment.bottomInset, treatment.leftInset, treatment.rightInset),
      `${name} should sit inside the tile instead of being clipped by it`,
    ).toBeGreaterThanOrEqual(1)
  }
})

test("keeps every populated layer on one shared vertical track while the rail expands", async ({ page }) => {
  await page.setViewportSize({ width: 1394, height: 1027 })
  await openAtmoShaper(page)
  await addNoise(page, "White")

  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  await expect(dialog).toBeVisible()
  await settleCurrentMixDrawer(page)
  await press(dialog.getByRole("button", { name: "Close Current Mix" }))
  await expect(dialog).toHaveCount(0)
  await settleCurrentMixDrawer(page)
  await addNoise(page, "Pink")
  await addNoise(page, "Brown")

  const rail = page.getByLabel("Current Mix rail")
  const rows = rail.locator(".ml-atmoshaper-layer-row")
  await expect(rows).toHaveCount(3)
  const collapsedBoxes = await rows.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { height: rect.height, top: rect.top }
  }))

  await press(rail.getByRole("button", { name: "Open Current Mix" }))
  await expect(dialog).toBeVisible()
  await settleCurrentMixDrawer(page)
  const expandedBoxes = await rows.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { height: rect.height, top: rect.top }
  }))

  const collapsedOffsets = collapsedBoxes.map(({ top }) => top - collapsedBoxes[0].top)
  const expandedOffsets = expandedBoxes.map(({ top }) => top - expandedBoxes[0].top)
  for (const [index, collapsedOffset] of collapsedOffsets.entries()) {
    expect(
      Math.abs(expandedOffsets[index] - collapsedOffset),
      `layer ${index + 1} should retain its vertical track as the rail widens`,
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(expandedBoxes[index].height - collapsedBoxes[index].height),
      `layer ${index + 1} should retain its height as the rail widens`,
    ).toBeLessThanOrEqual(1)
  }
})

test("solos a collapsed-rail layer and restores the exact prior mute pattern", async ({ page }) => {
  await page.setViewportSize({ width: 1235, height: 1027 })
  await openAtmoShaper(page)
  await addNoise(page, "White")
  await page.getByRole("heading", { name: "Sound Library" }).click()
  await addNoise(page, "Pink")

  const rail = page.getByLabel("Current Mix rail")
  const white = rail.locator("[data-layer-id]").filter({ hasText: "White noise" })
  const pink = rail.locator("[data-layer-id]").filter({ hasText: "Pink noise" })
  await press(white.getByRole("button", { name: "Solo White noise" }))
  await expect(white).not.toHaveAttribute("data-layer-state", "muted")
  await expect(pink).toHaveAttribute("data-layer-state", "muted")
  await expect(white.getByRole("button", { name: "Unsolo White noise" }))
    .toHaveAttribute("aria-pressed", "true")

  await press(white.getByRole("button", { name: "Unsolo White noise" }))
  await expect(white).not.toHaveAttribute("data-layer-state", "muted")
  await expect(pink).not.toHaveAttribute("data-layer-state", "muted")
  await expect(white.getByRole("button", { name: "Solo White noise" }))
    .toHaveAttribute("aria-pressed", "false")
})

test("previews one ephemeral source, replaces it, changes volume, recovers one failure, and stops cleanly", async ({ page }) => {
  await openAtmoShaper(page)
  await previewNoise(page, "Pink")

  const pink = await readDiagnostics(page)
  expect(pink.activePlaybackKind).toBeNull()
  expect(pink.recipe?.layers).toEqual([])
  expect(pink.atmoShaperPreview).toMatchObject({
    layer: { sourceId: "noise:pink" },
    status: "playing",
  })
  expect(pink.runtime?.activeLayers).toEqual({})
  await expect(page.locator(".ml-music-player")).toHaveCount(0)
  await expect(page.locator(".ml-atmoshaper-current-mix-rail [data-layer-id]"))
    .toHaveCount(0)

  const pinkId = pink.atmoShaperPreview!.layer.id
  const volume = page.getByLabel("Preview volume for Pink noise")
  await press(volume, "ArrowLeft")
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview?.layer.volume)
    .toBeLessThan(pink.atmoShaperPreview!.layer.volume)

  await previewNoise(page, "Brown")
  const brown = await readDiagnostics(page)
  expect(brown.atmoShaperPreview?.layer.sourceId).toBe("noise:brown")
  expect(brown.atmoShaperPreview?.layer.id).not.toBe(pinkId)
  expect(brown.runtime?.preview?.layer.sourceId).toBe("noise:brown")

  await page.evaluate(() => {
    const bridge = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as { failNextSourceIds: string[] }
    bridge.failNextSourceIds.push("noise:white")
  })
  await press(page.getByRole("button", { name: "Preview White noise" }))
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview?.status)
    .toBe("failed")
  const failed = await readDiagnostics(page)
  expect(failed.atmoShaperPreview?.error).toBe("Browser QA injected failure for noise:white.")
  await expect(page.getByText("Browser QA injected failure for noise:white.", { exact: true }))
    .toBeVisible()
  await press(page.getByRole("button", { name: "Retry preview for White noise" }))
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview?.status)
    .toBe("playing")

  await press(page.getByRole("button", { name: "Stop preview for White noise" }))
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview).toBeNull()
  expect((await readDiagnostics(page)).runtime).toBeNull()
  await expect(page.getByText("Previewing", { exact: true })).toHaveCount(0)
})

test("layers preview over a committed mix and promotes the exact handle into one global player", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await playAtmoShaper(page)
  await waitForAtmoStatus(page, "playing")
  await closeFullMix(page)

  await previewNoise(page, "Brown")
  const previewing = await readDiagnostics(page)
  const previewId = previewing.atmoShaperPreview?.layer.id
  expect(previewId).toBeTruthy()
  expect(previewing.activePlaybackKind).toBe("atmoshaper")
  expect(Object.values(previewing.runtime?.activeLayers ?? {}).map(({ sourceId }) => sourceId))
    .toEqual(["noise:pink"])
  expect(previewing.runtime?.preview?.layer.id).toBe(previewId)

  await press(page.getByRole("button", { name: "Add Brown noise" }))
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview).toBeNull()
  const promoted = await readDiagnostics(page)
  const brownLayer = promoted.recipe?.layers.find(({ sourceId }) => sourceId === "noise:brown")
  expect(brownLayer?.id).toBe(previewId)
  expect(promoted.runtime?.activeLayers[previewId!]?.id).toBe(previewId)
  expect(Object.values(promoted.runtime?.activeLayers ?? {}).map(({ sourceId }) => sourceId).sort())
    .toEqual(["noise:brown", "noise:pink"])
  await expect(page.locator(".ml-music-player")).toHaveCount(1)

  await previewNoise(page, "White")
  await press(page.getByRole("button", { name: "Stop AtmoShaper" }).first())
  await expect.poll(async () => (await readDiagnostics(page)).runtime).toBeNull()
  expect((await readDiagnostics(page)).atmoShaperPreview).toBeNull()
  expect((await readDiagnostics(page)).playbackState).toBe("stopped")
})

test("preview replaces a station and an immediately started station becomes the sole owner", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("massagelab-atmosphere-interruption-v1", JSON.stringify({
    version: 1,
    resumeAfterInterruption: true,
  })))
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: "Play MassageLab Proof Drone" }).click()
  await expect.poll(async () => (await readDiagnostics(page)).activePlaybackKind).toBe("station")

  await page.getByRole("group", { name: "Station category" })
    .getByRole("button", { name: /AtmoShaper/i }).click()
  await previewNoise(page, "Pink")
  expect((await readDiagnostics(page)).activePlaybackKind).toBeNull()

  await setAudioSessionState(page, "interrupted")
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview?.status)
    .toBe("paused")
  await setAudioSessionState(page, "active")
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview?.status)
    .toBe("playing")

  // Start the ordinary station while preview ownership is still observable;
  // the provider must replace it rather than relying on awaited route cleanup.
  expect((await readDiagnostics(page)).atmoShaperPreview?.status).toBe("playing")
  await page.getByRole("group", { name: "Station category" })
    .getByRole("button", { name: "Treatment room starters" }).click()
  await page.getByRole("button", { name: "Play MassageLab Proof Drone" }).click()
  await expect.poll(async () => (await readDiagnostics(page)).activePlaybackKind).toBe("station")
  const replaced = await readDiagnostics(page)
  expect(replaced.activeStationId).toBe("mlab-proof-drone")
  expect(replaced.atmoShaperPreview).toBeNull()
  expect(replaced.runtime).toBeNull()
  await expect(page.locator(".ml-music-player")).toHaveCount(1)
})

test("leaving AtmoShaper independently retires preview-only playback", async ({ page }) => {
  await openAtmoShaper(page)
  await previewNoise(page, "Pink")
  expect((await readDiagnostics(page)).activePlaybackKind).toBeNull()
  await page.getByRole("group", { name: "Station category" })
    .getByRole("button", { name: "Treatment room starters" }).click()
  await expect.poll(async () => (await readDiagnostics(page)).atmoShaperPreview).toBeNull()
  expect((await readDiagnostics(page)).runtime).toBeNull()
  await expect(page.locator(".ml-music-player")).toHaveCount(0)
})

for (const sidebarPosition of ["left", "right"] as const) {
  test(`expands the roomy edge rail opposite a ${sidebarPosition} sidebar without changing library width`, async ({ page }) => {
    await page.addInitScript((position) => {
      localStorage.setItem("massage-lab-settings", JSON.stringify({ sidebarPosition: position }))
    }, sidebarPosition)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openAtmoShaper(page)
    const workspace = page.getByLabel("AtmoShaper live mixer")
    const drawerSide = sidebarPosition === "left" ? "right" : "left"
    await expect(workspace).toHaveAttribute("data-current-mix-side", drawerSide)
    await expect(workspace).toHaveAttribute("data-drawer-mode", "roomy")

    const closed = await measureGeometry(page)
    const trigger = page.getByRole("button", { name: "Open Current Mix" })
    await press(trigger)
    const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
    await expect(dialog).toBeVisible()
    await settleCurrentMixDrawer(page)
    const open = await measureGeometry(page)
    const message = `${sidebarPosition} sidebar geometry: ${JSON.stringify({ closed, open })}`
    expect(open.library?.width, message).toBeCloseTo(closed.library!.width, 1)
    expect(open.drawerMode, message).toBe("roomy")
    expect(closed.rail, message).not.toBeNull()
    expect(closed.drawer, message).toBeNull()
    expect(open.rail, message).toBeNull()
    expect(open.drawer, message).not.toBeNull()
    expect(open.drawer!.top, message).toBeCloseTo(closed.rail!.top, 1)
    expect(open.drawer!.bottom, message).toBeCloseTo(closed.rail!.bottom, 1)
    if (drawerSide === "right") {
      expect(open.drawer!.right, message).toBeGreaterThan(open.workspace!.left + open.workspace!.width / 2)
      expect(open.drawer!.right, message).toBeCloseTo(closed.rail!.right, 1)
    } else {
      expect(open.drawer!.left, message).toBeLessThan(open.workspace!.left + open.workspace!.width / 2)
      expect(open.drawer!.left, message).toBeCloseTo(closed.rail!.left, 1)
    }

    const uncoveredSource = drawerSide === "right" ? "White" : "Brown"
    const uncoveredAdd = page.getByRole("button", { name: `Add ${uncoveredSource} noise` })
    await expectHitTarget(page, uncoveredAdd, message)
    await page.getByRole("heading", { name: "Sound Library" }).click()
    await expect(dialog).toHaveCount(0)
    await uncoveredAdd.click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(`${uncoveredSource} noise`, { exact: true }))
      .toBeVisible()
    await expect(page.getByLabel("Current Mix rail")).toHaveAttribute("data-expanded", "true")
    await closeFullMix(page)
    await expect(page.getByLabel("Current Mix rail")
      .getByRole("button", { name: new RegExp(`Open ${uncoveredSource} noise controls`) }))
      .toBeVisible()
  })
}

test("narrow drawer contains focus and restores the exact first-add and rail-tile openers", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await openAtmoShaper(page)
  const addPink = page.getByRole("button", { name: "Add Pink noise" })
  await press(addPink)
  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel("AtmoShaper live mixer")).toHaveAttribute("data-drawer-mode", "narrow")
  const overlay = page.locator(".ml-atmoshaper-current-mix-overlay-narrow")
  await expect(overlay).toBeVisible()
  expect(await overlay.evaluate((element) => getComputedStyle(element).pointerEvents)).not.toBe("none")

  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("Tab")
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press("Escape")
  await expect(addPink).toBeFocused()

  const tile = page.getByRole("button", { name: /Open Pink noise controls/ })
  await press(tile)
  await expect(dialog).toBeVisible()
  await expect(dialog.locator(".ml-atmoshaper-layer-row[data-active-layer='true']")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(tile).toBeFocused()
})

test("first Add discovers the drawer while later Add stays closed and the rail reflects order and mute", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  await expect(dialog).toBeVisible()
  await closeFullMix(page)

  await addNoise(page, "Brown")
  await expect(dialog).toHaveCount(0)
  const railRows = page.locator(".ml-atmoshaper-current-mix-rail [data-layer-id]")
  await expect(railRows).toHaveCount(2)
  await expect(railRows.nth(0).getByRole("button", { name: /Open Pink noise controls/ })).toBeVisible()
  await expect(railRows.nth(1).getByRole("button", { name: /Open Brown noise controls/ })).toBeVisible()
  await expectRailOrderMatchesRecipe(page)

  await press(page.getByRole("button", { name: "Mute Brown noise" }))
  await expect(railRows.nth(1)).toHaveAttribute("data-layer-state", "muted")
  await expect(page.getByRole("button", { name: "Unmute Brown noise" })).not.toHaveAttribute("aria-pressed")
  await expect(page.getByRole("button", { name: "Unmute Brown noise" })).toHaveAttribute("title", "Unmute Brown noise")

  const observedLoading = railRows.nth(0).evaluate((row) => new Promise<boolean>((resolve) => {
    const finish = (value: boolean) => {
      observer.disconnect()
      window.clearTimeout(timeout)
      resolve(value)
    }
    const observer = new MutationObserver(() => {
      if (row.getAttribute("data-layer-state") === "loading") finish(true)
    })
    const timeout = window.setTimeout(() => finish(false), 5_000)
    observer.observe(row, { attributes: true, attributeFilter: ["data-layer-state"] })
    if (row.getAttribute("data-layer-state") === "loading") finish(true)
  }))
  const [, loadingWasVisible] = await Promise.all([playAtmoShaper(page), observedLoading])
  expect(loadingWasVisible).toBe(true)
  await waitForAtmoStatus(page, "playing")
  await expect(railRows.nth(0)).toHaveAttribute("data-layer-state", "playing")
})

test("pointer and keyboard drag handles reorder only recipe organization while live ids remain stable", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
  await closeFullMix(page)
  await addNoise(page, "Brown")
  await addNoise(page, "White")
  const { scope: dialog } = await openFullMix(page)
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)))
  })

  const brownHandle = dialog.getByRole("button", { name: "Reorder Brown noise" })
  await press(brownHandle, "Space")
  await expect(brownHandle).toHaveAttribute("aria-pressed", "true")
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  }))
  await page.keyboard.press("ArrowDown")
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Brown noise is over position 3 of 3")
  await page.keyboard.press("Space")
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Dropped Brown noise at position 3 of 3")
  await expect(brownHandle).not.toHaveAttribute("aria-pressed", "true")
  await expect.poll(async () => (await readDiagnostics(page)).recipe?.layers.map(({ sourceId }) => sourceId))
    .toEqual(["noise:pink", "noise:white", "noise:brown"])
  await expectRailOrderMatchesRecipe(page)
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)))
  })

  const beforeCancel = (await readDiagnostics(page)).recipe?.layers.map(({ sourceId }) => sourceId)
  const whiteHandle = dialog.getByRole("button", { name: "Reorder White noise" })
  await press(whiteHandle, "Space")
  await expect(whiteHandle).toHaveAttribute("aria-pressed", "true")
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  }))
  await page.keyboard.press("ArrowDown")
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("White noise is over position 3 of 3")
  await page.keyboard.press("Escape")
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Cancelled sorting White noise")
  expect((await readDiagnostics(page)).recipe?.layers.map(({ sourceId }) => sourceId)).toEqual(beforeCancel)

  await playAtmoShaper(page)
  await waitForAtmoStatus(page, "playing")
  const before = await readDiagnostics(page)
  const activeIds = Object.keys(before.runtime?.activeLayers ?? {}).sort()

  await closeFullMix(page)
  const { scope: pointerDialog } = await openFullMix(page)
  await pointerDialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)))
  })
  const pointerBrownHandle = pointerDialog.getByRole("button", { name: "Reorder Brown noise" })
  const pinkHandle = pointerDialog.getByRole("button", { name: "Reorder Pink noise" })
  await pointerBrownHandle.hover()
  const from = await pointerBrownHandle.boundingBox()
  const to = await pinkHandle.boundingBox()
  expect(from).not.toBeNull()
  expect(to).not.toBeNull()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(from!.x + from!.width / 2 + 8, from!.y + from!.height / 2, { steps: 2 })
  await expect(pointerBrownHandle).toHaveAttribute("aria-pressed", "true")
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Dropped Brown noise at position 1 of 3")
  await expect.poll(async () => (await readDiagnostics(page)).recipe?.layers.map(({ sourceId }) => sourceId))
    .toEqual(["noise:brown", "noise:pink", "noise:white"])
  await expectRailOrderMatchesRecipe(page)

  await press(pointerBrownHandle, "Space")
  await expect(pointerBrownHandle).toHaveAttribute("aria-pressed", "true")
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  }))
  await page.keyboard.press("ArrowDown")
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Brown noise is over position 2 of 3")
  await page.keyboard.press("Space")
  await expect.poll(async () => (await readDiagnostics(page)).recipe?.layers.map(({ sourceId }) => sourceId))
    .toEqual(["noise:pink", "noise:brown", "noise:white"])
  await expectRailOrderMatchesRecipe(page)

  const after = await readDiagnostics(page)
  expect(after.playbackState).toBe("playing")
  expect(Object.keys(after.runtime?.activeLayers ?? {}).sort()).toEqual(activeIds)
  await expectRailOrderMatchesRecipe(page)
})

test("touch handle sorting honors the delayed activation path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "TouchSensor acceptance is mobile Chromium owned.")
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
  await closeFullMix(page)
  await addNoise(page, "Brown")
  const { scope: dialog } = await openFullMix(page)
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)))
  })
  const brownHandle = dialog.getByRole("button", { name: "Reorder Brown noise" })
  const pinkHandle = dialog.getByRole("button", { name: "Reorder Pink noise" })
  const from = await brownHandle.boundingBox()
  const to = await pinkHandle.boundingBox()
  expect(from).not.toBeNull()
  expect(to).not.toBeNull()

  const startX = from!.x + from!.width / 2
  const startY = from!.y + from!.height / 2
  const originalOrder = (await readDiagnostics(page)).recipe?.layers.map(({ id }) => id)
  const activationDelayMs = 180

  // dnd-kit's TouchSensor must remain inactive during its 180ms delay. Moving
  // beyond the documented 8px tolerance cancels activation and preserves order.
  await installTouchActivationReceipt(brownHandle, "__atmoTouchCancellation")
  await dispatchTouch(brownHandle, "touchstart", { identifier: 70, x: startX, y: startY })
  await expect(brownHandle).not.toHaveAttribute("aria-pressed", "true")
  await dispatchTouch(brownHandle, "touchmove", { identifier: 70, x: startX + 9, y: startY })
  const cancellationReceipt = await waitForTouchBoundary(
    page,
    "__atmoTouchCancellation",
    activationDelayMs,
  )
  expect(cancellationReceipt.boundaryAt! - cancellationReceipt.startedAt!).toBeGreaterThanOrEqual(activationDelayMs)
  expect(cancellationReceipt.activatedAt).toBeNull()
  await expect(brownHandle).not.toHaveAttribute("aria-pressed", "true")
  await dispatchTouch(brownHandle, "touchend", { identifier: 70, x: startX + 9, y: startY })
  await readTouchActivationReceipt(page, "__atmoTouchCancellation")
  expect((await readDiagnostics(page)).recipe?.layers.map(({ id }) => id)).toEqual(originalOrder)
  await expectRailOrderMatchesRecipe(page)

  // A sub-tolerance move remains eligible; activation begins only after the
  // delay, after which the same handle receives the move and drop events.
  await installTouchActivationReceipt(brownHandle, "__atmoTouchActivation")
  await dispatchTouch(brownHandle, "touchstart", { identifier: 71, x: startX, y: startY })
  await expect(brownHandle).not.toHaveAttribute("aria-pressed", "true")
  await dispatchTouch(brownHandle, "touchmove", { identifier: 71, x: startX + 7, y: startY })
  await expect(brownHandle).not.toHaveAttribute("aria-pressed", "true")
  await expect(brownHandle).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 })
  const activationReceipt = await readTouchActivationReceipt(page, "__atmoTouchActivation")
  expect(activationReceipt.startedAt).not.toBeNull()
  expect(activationReceipt.activatedAt).not.toBeNull()
  expect(activationReceipt.activatedAt! - activationReceipt.startedAt!)
    .toBeGreaterThanOrEqual(activationDelayMs)

  await dispatchTouch(brownHandle, "touchmove", {
    identifier: 71,
    x: to!.x + to!.width / 2,
    y: to!.y + to!.height / 2,
  })
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Brown noise is over position 1 of 2")
  await dispatchTouch(brownHandle, "touchend", {
    identifier: 71,
    x: to!.x + to!.width / 2,
    y: to!.y + to!.height / 2,
  })
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Dropped Brown noise at position 1 of 2")

  await expect.poll(async () => (await readDiagnostics(page)).recipe?.layers.map(({ sourceId }) => sourceId))
    .toEqual(["noise:brown", "noise:pink"])
  await expectRailOrderMatchesRecipe(page)
})

test("Sound Library preserves glow semantics, meaningful art, success actions, and keyboard endpoints", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await openAtmoShaper(page)
  const tabs = page.getByRole("tablist", { name: "AtmoShaper sound groups" })
  const noiseTab = page.getByRole("tab", { name: "Noise" })
  const stationTab = page.getByRole("tab", { name: "Atmosphere stations" })
  await expect(noiseTab).toHaveAttribute("aria-selected", "true")
  const glowTokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const selected = getComputedStyle(document.querySelector<HTMLElement>("[role='tab'][aria-selected='true']")!)
    const inactive = getComputedStyle(document.querySelectorAll<HTMLElement>("[role='tab']")[1]!)
    const token = (styles: CSSStyleDeclaration, name: string) => styles.getPropertyValue(name).trim()
    return {
      cta: token(root, "--button-cta-face"),
      inactive: token(inactive, "--brand-orange"),
      selected: token(selected, "--brand-orange"),
      warm: token(root, "--brand-orange"),
    }
  })
  expect(glowTokens.selected).toBe(glowTokens.cta)
  expect(glowTokens.inactive).toBe(glowTokens.warm)
  expect(glowTokens.selected).not.toBe(glowTokens.inactive)

  const noiseExpectations = {
    white: { frequency: "0.92", seed: "17", stops: ["#b9bab5", "#777a76", "#2f322f"] },
    pink: { frequency: "0.46", seed: "29", stops: ["#f2a0b8", "#4a2730", "#1f1017"] },
    brown: { frequency: "0.58", seed: "41", stops: ["#c47c49", "#3a2318", "#150d08"] },
  } as const
  for (const [color, treatment] of Object.entries(noiseExpectations)) {
    const artwork = page.locator(`[data-noise-color='${color}']`)
    await expect(artwork).toHaveCount(1)
    await expect(artwork.locator("feTurbulence")).toHaveAttribute("baseFrequency", treatment.frequency)
    await expect(artwork.locator("feTurbulence")).toHaveAttribute("seed", treatment.seed)
    expect(await artwork.locator("linearGradient stop").evaluateAll((stops) => (
      stops.map((stop) => stop.getAttribute("stop-color"))
    ))).toEqual(treatment.stops)
  }

  const successActions = [
    page.getByRole("button", { name: "Add White noise" }),
    page.getByRole("button", { name: "Play AtmoShaper" }).first(),
  ]
  for (const action of successActions) {
    await expect(action).toHaveClass(/ml-button-success/)
    const green = await action.evaluate((element) => {
      const styles = getComputedStyle(element)
      const root = getComputedStyle(document.documentElement)
      return {
        background: styles.backgroundImage,
        leaf: styles.getPropertyValue("--button-calendar-leaf-bright").trim(),
        rootLeaf: root.getPropertyValue("--button-calendar-leaf-bright").trim(),
      }
    })
    expect(green.leaf).toBe(green.rootLeaf)
    expect(green.background).toContain("linear-gradient")
  }

  await noiseTab.focus()
  await noiseTab.press("ArrowRight")
  await expect(stationTab).toHaveAttribute("aria-selected", "true")
  const stationArtworkIds = await page.locator("[data-library-source] [data-art-kind='station']")
    .evaluateAll((artworks) => artworks.map((artwork) => ({
      artworkId: artwork.querySelector<HTMLElement>("[data-artwork-station-id]")?.dataset.artworkStationId,
      sourceId: artwork.closest<HTMLElement>("[data-library-source]")?.dataset.librarySource,
    })))
  expect(stationArtworkIds.length).toBeGreaterThan(1)
  expect(stationArtworkIds).toContainEqual({ artworkId: "mlab-proof-drone", sourceId: "mlab-proof-drone" })
  expect(stationArtworkIds.every(({ artworkId, sourceId }) => artworkId === sourceId)).toBe(true)

  await press(page.getByRole("tab", { name: "Binaural beats" }))
  const binauralArt = page.locator(
    ".ml-atmoshaper-library-brainwave-canvas [data-brainwave-kind='binaural']",
  )
  await expect(binauralArt.locator("[data-wave-channel='left']")).toHaveAttribute("stroke", "#f0a04b")
  await expect(binauralArt.locator("[data-wave-channel='right']")).toHaveAttribute("stroke", "#b998ff")
  expect(await binauralArt.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  const presetGroup = page.getByRole("group", { name: "Binaural beats presets" })
  const alpha = presetGroup.getByRole("button", { name: "Alpha" })
  const beta = presetGroup.getByRole("button", { name: "Beta" })
  await expect(alpha).toHaveAttribute("aria-pressed", "true")
  const presetTokens = await Promise.all([alpha, beta].map((button) => button.evaluate((element) => {
    const styles = getComputedStyle(element)
    return styles.getPropertyValue("--brand-orange").trim()
  })))
  expect(presetTokens[0]).toBe(glowTokens.cta)
  expect(presetTokens[1]).toBe(glowTokens.warm)
  await press(page.getByRole("tab", { name: "Isochronic tones" }))
  const isochronicArt = page.locator(
    ".ml-atmoshaper-library-brainwave-canvas [data-brainwave-kind='isochronic']",
  )
  await expect(isochronicArt.locator("[data-pulse-envelope='true']")).toHaveAttribute("stroke", "#f0a04b")
  expect(await isochronicArt.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)

  const lastTab = page.getByRole("tab", { name: "Ambient sounds" })
  const initialEndpoint = await Promise.all([tabs.boundingBox(), lastTab.boundingBox()])
  expect(initialEndpoint[1]!.x + initialEndpoint[1]!.width)
    .toBeGreaterThan(initialEndpoint[0]!.x + initialEndpoint[0]!.width + 1)
  await page.getByRole("tab", { name: "Isochronic tones" }).focus()
  await page.keyboard.press("End")
  await expect(lastTab).toHaveAttribute("aria-selected", "true")
  const endpoint = await Promise.all([tabs.boundingBox(), lastTab.boundingBox()])
  expect(endpoint[0]).not.toBeNull()
  expect(endpoint[1]).not.toBeNull()
  expect(endpoint[1]!.x + endpoint[1]!.width)
    .toBeLessThanOrEqual(endpoint[0]!.x + endpoint[0]!.width + 1)
})

test("plays one free sound with no station through the single global player", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await playAtmoShaper(page)

  await waitForAtmoStatus(page, "playing")
  const diagnostics = await readDiagnostics(page)
  expect(diagnostics.activePlaybackKind).toBe("atmoshaper")
  expect(diagnostics.activeStationId).toBeNull()
  expect(diagnostics.recipe?.layers.map(({ kind }) => kind)).toEqual(["noise"])
  expect(Object.keys(diagnostics.runtime?.activeLayers ?? {})).toHaveLength(1)
  const expandedControls = page.getByRole("dialog", { name: "Current Mix controls" })
  const collapsedControls = page.getByLabel("Current Mix rail")
  expect(await expandedControls.isVisible() || await collapsedControls.isVisible()).toBe(true)
  await expect(page.locator(".ml-music-player")).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Favorite AtmoShaper" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Previous station" })).toHaveCount(0)
})

test("builds and plays a free multi-layer mix through one global player", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
  await closeFullMix(page)
  await addBinauralPreset(page)
  await playAtmoShaper(page)

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
  await playAtmoShaper(page)
  await waitForAtmoStatus(page, "playing")
  await expect(page.locator(".ml-music-player")).toHaveCount(1)
  await closeFullMix(page)

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
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
  await closeFullMix(page)
  await addNoise(page, "Brown")
  await playAtmoShaper(page)
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
  if (sheetWasOpened) await closeFullMix(page)
  await addNoise(page, "White")
  const stopped = await readDiagnostics(page)
  expect(stopped.playbackState).toBe("stopped")
  expect(stopped.runtime).toBeNull()
  expect(stopped.recipe?.layers.map(({ sourceId }) => sourceId)).toEqual(["noise:pink", "noise:white"])

  await playAtmoShaper(page)
  await waitForAtmoStatus(page, "playing")
  expect(Object.keys((await readDiagnostics(page)).runtime?.activeLayers ?? {})).toHaveLength(2)
})

test("removing the last live layer leaves a new layer ready for Play rather than false Retry", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await playAtmoShaper(page)
  await waitForAtmoStatus(page, "playing")

  const { scope: currentMix, sheetWasOpened } = await openFullMix(page)
  await press(currentMix.getByRole("button", { name: "Remove Pink noise" }))
  await expect.poll(async () => (await readDiagnostics(page)).runtime?.status).toBe("stopped")
  if (sheetWasOpened) await closeFullMix(page)

  await addNoise(page, "Brown")
  const { scope: updatedMix } = await openFullMix(page)
  await expect(updatedMix.getByRole("button", { name: "Retry Brown noise" })).toHaveCount(0)
  await expect(updatedMix.getByText("ready", { exact: true })).toBeVisible()
  await closeFullMix(page)

  await playAtmoShaper(page)
  await waitForAtmoStatus(page, "playing")
  const restarted = await readDiagnostics(page)
  expect(Object.values(restarted.runtime?.activeLayers ?? {}).map(({ sourceId }) => sourceId))
    .toEqual(["noise:brown"])
})

test("removing the last layer during startup settles stopped and remains restartable", async ({ page }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await holdNextCarrierStart(page)
  await playAtmoShaper(page)
  await expect.poll(async () => (await readDiagnostics(page)).playbackState).toBe("loading")
  await waitForAtmoStatus(page, "playing")

  const { scope: currentMix, sheetWasOpened } = await openFullMix(page)
  await press(currentMix.getByRole("button", { name: "Remove Pink noise" }))
  await expect.poll(async () => (await readDiagnostics(page)).runtime?.status).toBe("stopped")
  await expect.poll(async () => (await readDiagnostics(page)).playbackState).toBe("stopped")
  const mediaMutationBeforeSettlement = (await readMediaSession(page)).mutationCount

  await releaseCarrierStart(page)
  await expect.poll(async () => (await readMediaSession(page)).mutationCount)
    .toBeGreaterThan(mediaMutationBeforeSettlement)
  expect((await readDiagnostics(page)).error).toBeNull()
  expect(await readMediaSession(page)).toMatchObject({
    metadata: null,
    playbackState: "none",
  })
  expect(await readCarrier(page)).toEqual({ paused: true, src: "" })
  if (sheetWasOpened) await closeFullMix(page)

  await addNoise(page, "Brown")
  const { scope: updatedMix } = await openFullMix(page)
  await expect(updatedMix.getByRole("button", { name: "Retry Brown noise" })).toHaveCount(0)
  await expect(updatedMix.getByText("ready", { exact: true })).toBeVisible()
  await closeFullMix(page)

  await playAtmoShaper(page)
  await waitForAtmoStatus(page, "playing")
  const restarted = await readDiagnostics(page)
  expect(Object.values(restarted.runtime?.activeLayers ?? {}).map(({ sourceId }) => sourceId))
    .toEqual(["noise:brown"])
})

test("keyboard controls isolate one failed layer and support retry, reorder, mute, and remove", async ({ page }) => {
  await page.addInitScript(() => {
    const bridge = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as { failNextSourceIds: string[] }
    bridge.failNextSourceIds.push("binaural:alpha")
  })
  await openAtmoShaper(page)
  await press(page.getByRole("button", { name: "Add Pink noise" }))
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
  await closeFullMix(page)
  await press(page.getByRole("button", { name: "Add Brown noise" }))
  await press(page.getByRole("tab", { name: "Binaural beats" }))
  await press(page.getByRole("button", { name: "Add Alpha binaural beat" }))
  await playAtmoShaper(page)

  const { scope: currentMix } = await openFullMix(page)
  await expect(currentMix.getByText("Browser QA injected failure for binaural:alpha.", { exact: true })).toBeVisible()
  await expect(currentMix.getByRole("button", { name: "Retry Alpha binaural beat" })).toBeVisible()
  await expect(currentMix.getByRole("button", { name: "Remove Alpha binaural beat" })).toBeVisible()
  const failed = await readDiagnostics(page)
  expect(failed.runtime?.layers).toMatchObject({
    [failed.recipe!.layers.find(({ sourceId }) => sourceId === "binaural:alpha")!.id]: { status: "failed" },
  })
  const failedAlphaId = failed.recipe!.layers.find(({ sourceId }) => sourceId === "binaural:alpha")!.id
  await expect(currentMix.locator(`[data-layer-id='${failedAlphaId}']`).getByText("failed", { exact: true }))
    .toBeVisible()
  expect(Object.values(failed.runtime?.activeLayers ?? {}).map(({ sourceId }) => sourceId))
    .toEqual(expect.arrayContaining(["noise:pink", "noise:brown"]))

  await press(currentMix.getByRole("button", { name: "Retry Alpha binaural beat" }))
  await expect.poll(async () => {
    const next = await readDiagnostics(page)
    const alphaId = next.recipe?.layers.find(({ sourceId }) => sourceId === "binaural:alpha")?.id
    return alphaId ? next.runtime?.layers[alphaId]?.status : null
  }).toBe("playing")
  const brownHandle = currentMix.getByRole("button", { name: "Reorder Brown noise" })
  await press(brownHandle, "Space")
  await expect(brownHandle).toHaveAttribute("aria-pressed", "true")
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  }))
  await page.keyboard.press("ArrowUp")
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Brown noise is over position 1 of 3")
  await page.keyboard.press("Space")
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Dropped Brown noise at position 1 of 3")
  await expect(brownHandle).not.toHaveAttribute("aria-pressed", "true")
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
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
  await closeFullMix(page)
  await addBinauralPreset(page)
  const liveRegion = page.locator(".ml-atmoshaper-workspace > p[role='status']")
  await expect(liveRegion).toHaveCount(1)
  const liveRegionHandle = await liveRegion.elementHandle()
  expect(liveRegionHandle).not.toBeNull()
  await page.evaluate(() => {
    const receipt = { observed: false }
    const observer = new MutationObserver(() => {
      if (document.querySelector(".ml-music-interruption-notice")) receipt.observed = true
    })
    observer.observe(document.body, { childList: true, subtree: true })
    Reflect.set(window, "__atmoTerminalNoticeReceipt", { observer, receipt })
  })
  await playAtmoShaper(page)

  await expect(liveRegion).toContainText("Pink noise failed")
  await expect(liveRegion).toContainText("Alpha binaural beat failed")
  expect(await liveRegionHandle!.evaluate((element) => element.isConnected)).toBe(true)
  await expect.poll(async () => {
    const diagnostics = await readDiagnostics(page)
    return {
      error: diagnostics.error,
      playbackState: diagnostics.playbackState,
      runtimeStatus: diagnostics.runtime?.status,
    }
  }).toEqual({
    error: "Browser QA injected failure for noise:pink.",
    playbackState: "failed",
    runtimeStatus: "failed",
  })
  await expect.poll(async () => readMediaSession(page)).toMatchObject({
    playbackState: "none",
  })
  const noticeReceipt = await page.evaluate(() => new Promise<{ observed: boolean }>((resolve) => {
    const probe = Reflect.get(window, "__atmoTerminalNoticeReceipt") as {
      observer: MutationObserver
      receipt: { observed: boolean }
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      probe.observer.disconnect()
      resolve({ ...probe.receipt })
    }))
  }))
  expect(noticeReceipt.observed).toBe(false)
  await expect(page.getByRole("region", { name: "Interruption preference" })).toHaveCount(0)
})

test("narrow Current Mix drawer closes to its keyboard opener", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
  await closeFullMix(page)
  const trigger = page.getByRole("button", { name: "Open Current Mix" })
  await press(trigger)
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test("reduced motion removes decoration while preserving usable controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 375, height: 667 })
  await openAtmoShaper(page)
  const motion = await page.locator(".ml-atmoshaper-current-mix-rail").evaluate((element) => {
    const styles = getComputedStyle(element)
    return { animationName: styles.animationName, transitionDuration: styles.transitionDuration }
  })
  expect(motion.animationName).toBe("none")
  expect(motion.transitionDuration).toBe("0s")
  await expect(page.getByRole("button", { name: /Current Mix/ })).toBeVisible()
})

test("200% text keeps expanded Mix and interruption dismissal controls reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await openAtmoShaper(page)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
    document.documentElement.style.setProperty("--ml-safe-top", "18px")
  })
  await addNoise(page, "Pink")
  await playAtmoShaper(page)
  await expect(page.locator(".ml-music-player")).toContainText("AtmoShaper", { timeout: 30_000 })
  const dialog = page.getByRole("dialog", { name: "Current Mix controls" })
  await expect(dialog).toBeVisible()
  await press(dialog.getByLabel("Volume for Pink noise"), "ArrowLeft")
  await press(dialog.getByRole("button", { name: "Mute Pink noise" }))
  const notice = page.getByRole("region", { name: "Interruption preference" })
  await expect(notice).toBeVisible()
  await settleCurrentMixDrawer(page)

  const receipt = await measureGeometry(page)
  const message = `200% safe-area geometry: ${JSON.stringify(receipt)}`
  expectNoDocumentOverflow(receipt)
  expect(receipt.drawer, message).not.toBeNull()
  expect(receipt.rail, message).toBeNull()
  expect(receipt.notice, message).not.toBeNull()
  expect(receipt.player, message).not.toBeNull()
  expect(receipt.notice!.top, message).toBeGreaterThanOrEqual(receipt.safeAreaTop + 7)
  for (const [firstName, first, secondName, second] of [
    ["drawer", receipt.drawer!, "player", receipt.player!],
    ["drawer", receipt.drawer!, "app bar", receipt.appBar!],
    ["notice", receipt.notice!, "player", receipt.player!],
    ["notice", receipt.notice!, "app bar", receipt.appBar!],
  ] as const) {
    expectRectsNotToOverlap(first, second, `${firstName}/${secondName}: ${message}`)
  }
  const maxHeightWithSafeTop = Number.parseFloat(
    await notice.evaluate((element) => getComputedStyle(element).maxHeight),
  )
  await page.evaluate(() => document.documentElement.style.setProperty("--ml-safe-top", "0px"))
  const maxHeightWithoutSafeTop = Number.parseFloat(
    await notice.evaluate((element) => getComputedStyle(element).maxHeight),
  )
  expect(maxHeightWithoutSafeTop - maxHeightWithSafeTop, message).toBeCloseTo(receipt.safeAreaTop, 1)
  await page.evaluate(() => document.documentElement.style.setProperty("--ml-safe-top", "18px"))
  // The player-owned nonmodal notice intentionally paints above the mixer.
  // Its dismissal must remain reachable first; the same persistent Mix toggle
  // must then remain reachable after that outside click collapses the panel.
  await expectHitTarget(page, notice.getByRole("button", { name: "Close" }), message)
  await closeInterruptionNoticeIfVisible(page)
  await expect(dialog).toHaveCount(0)
  const collapsedRail = page.getByLabel("Current Mix rail")
  await expect(collapsedRail).toHaveAttribute("data-expanded", "false")
  await expectHitTarget(page, collapsedRail.getByRole("button", { name: "Open Current Mix" }), message)
})

test("viewport matrix has no document overflow and grows usefully on large displays", async ({ page }) => {
  test.setTimeout(180_000)

  const receipts = new Map<string, GeometryReceipt>()
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    // Start every receipt from a fresh page. Switching repeatedly between the
    // roomy and narrow widths can otherwise let the previous rail transition
    // race the next viewport's opening transition.
    await openAtmoShaper(page)
    await addNoise(page, "Pink")
    await expect(page.getByRole("dialog", { name: "Current Mix controls" })).toBeVisible()
    await closeFullMix(page)
    await expect(page.getByLabel("Current Mix rail")).toBeVisible()
    await playAtmoShaper(page)
    await expect(page.locator(".ml-music-player")).toContainText("AtmoShaper", { timeout: 30_000 })
    await expect(page.getByLabel("Current Mix rail")).toBeVisible()
    await expect(page.getByLabel("AtmoShaper live mixer")).toBeVisible()
    await settleCurrentMixDrawerMode(page)
    const closedReceipt = await measureGeometry(page)
    expectNoDocumentOverflow(closedReceipt)
    expect(closedReceipt.rail, `AtmoShaper closed-rail receipt for ${viewport.width}x${viewport.height}`)
      .not.toBeNull()
    expect(closedReceipt.drawer, `AtmoShaper closed-rail receipt for ${viewport.width}x${viewport.height}`)
      .toBeNull()
    expectRectsNotToOverlap(
      closedReceipt.rail!,
      closedReceipt.appBar!,
      `AtmoShaper closed rail/app-bar receipt: ${JSON.stringify(closedReceipt)}`,
    )
    if (closedReceipt.player) {
      expectRectsNotToOverlap(
        closedReceipt.rail!,
        closedReceipt.player,
        `AtmoShaper closed rail/player receipt: ${JSON.stringify(closedReceipt)}`,
      )
    }
    await openFullMix(page)
    await settleCurrentMixDrawer(page)
    const openReceipt = await measureGeometry(page)
    expect(openReceipt.drawer, `AtmoShaper open-drawer receipt for ${viewport.width}x${viewport.height}`)
      .not.toBeNull()
    expect(openReceipt.rail, `AtmoShaper open-drawer receipt for ${viewport.width}x${viewport.height}`)
      .toBeNull()
    expectNoDocumentOverflow(openReceipt)
    const expectedMode = openReceipt.workspace!.width >= 42 * openReceipt.rootFontSize
      && openReceipt.workspace!.height >= 32 * openReceipt.rootFontSize
      ? "roomy"
      : "narrow"
    expect(openReceipt.drawerMode, `AtmoShaper threshold receipt: ${JSON.stringify(openReceipt)}`)
      .toBe(expectedMode)
    expectRectsNotToOverlap(
      openReceipt.drawer!,
      openReceipt.appBar!,
      `AtmoShaper drawer/app-bar receipt: ${JSON.stringify(openReceipt)}`,
    )
    if (openReceipt.player) {
      expectRectsNotToOverlap(
        openReceipt.drawer!,
        openReceipt.player,
        `AtmoShaper drawer/player receipt: ${JSON.stringify(openReceipt)}`,
      )
    }
    receipts.set(`${viewport.width}x${viewport.height}`, openReceipt)
  }
  console.log(`[task-8-atmoshaper-geometry] ${JSON.stringify(Object.fromEntries(receipts))}`)

  const laptop = receipts.get("1440x900")!
  const tv = receipts.get("2560x1440")!
  const message = `AtmoShaper large-display geometry: ${JSON.stringify({ laptop, tv })}`
  expect(tv.workspace!.width, message).toBeGreaterThan(laptop.workspace!.width + 500)
  expect(tv.workspace!.height, message).toBeGreaterThan(laptop.workspace!.height + 300)
  expect(tv.library!.width, message).toBeGreaterThan(laptop.library!.width + 250)
  expect(tv.library!.height, message).toBeGreaterThan(laptop.library!.height + 250)
  expect(tv.drawer!.height, message).toBeGreaterThan(laptop.drawer!.height + 300)
  expect(receipts.get("375x667")!.drawerMode).toBe("narrow")
  expect(receipts.get("412x915")!.drawerMode).toBe("narrow")
  expect(receipts.get("844x390")!.drawerMode).toBe("narrow")
  expect(receipts.get("768x1024")!.drawerMode).toBe("roomy")
  expect(receipts.get("912x1368")!.drawerMode).toBe("roomy")
  expect(receipts.get("1440x900")!.drawerMode).toBe("narrow")
  expect(receipts.get("2560x1440")!.drawerMode).toBe("roomy")
})

test("Media Session represents the mix with artwork, Play, Pause, Stop, and no station navigation", async ({ page, request }) => {
  await openAtmoShaper(page)
  await addNoise(page, "Pink")
  await playAtmoShaper(page)
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
  const retainedPlayer = page.locator(".ml-music-player")
  await expect(retainedPlayer).toHaveCount(1)
  await expect(retainedPlayer).toContainText("AtmoShaper")
  await closeFullMix(page)
  await press(retainedPlayer.getByRole("button", { name: "Play", exact: true }))
  await waitForAtmoStatus(page, "playing")
  const restarted = await readDiagnostics(page)
  expect(restarted.activePlaybackKind).toBe("atmoshaper")
  expect(restarted.activeStationId).toBeNull()
  media = await readMediaSession(page)
  expect(media.actions.previoustrack).toBe("object")
  expect(media.actions.nexttrack).toBe("object")
})
