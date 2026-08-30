import { expect, test, type Locator, type Page, type Route } from "@playwright/test"
import { withPlayerViewportCollisionPadding } from "../../components/ui/use-player-viewport-insets"
import { centerCarouselItem, waitForStableSlideGeometry } from "./carousel-test-helpers"

const desktopProject = "desktop-chromium"
const mobileProject = "mobile-chromium"
const FAVORITES_MIN_TO_CENTER_CARD_RATIO = 1.3
const FAVORITES_BALANCED_FILL_RATIO = 0.8

/** Detects App Router's streamed production 404 without hiding the development fixture. */
async function isDevelopmentReviewUnavailable(page: Page, responseStatus: number | undefined) {
  if (responseStatus === 404) return true

  const reviewHeading = page.getByRole("heading", { name: "Control system review", level: 1 })
  const notFoundHeading = page.getByRole("heading", {
    name: "This page could not be found.",
    exact: true,
    level: 2,
  })
  await expect(reviewHeading.or(notFoundHeading)).toBeVisible()
  return notFoundHeading.isVisible()
}

async function expectFavoritesMosaicTracksCenteredCard(mosaic: Locator, centeredCard: Locator) {
  await expect.poll(async () => {
    const mosaicBox = await mosaic.boundingBox()
    const centeredCardBox = await centeredCard.boundingBox()
    if (!mosaicBox || !centeredCardBox) return false
    if (mosaicBox.width / centeredCardBox.width >= FAVORITES_MIN_TO_CENTER_CARD_RATIO - 0.01) {
      return true
    }
    return mosaic.evaluate((element) => {
      const workspace = element.closest<HTMLElement>(".ml-atmosphere-carousel-workspace")
      const slot = workspace?.parentElement?.getBoundingClientRect()
      const center = workspace?.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )?.getBoundingClientRect()
      const mosaic = element.getBoundingClientRect()
      if (!slot || !center) return false
      const maximumFittingEdge = Math.min(slot.width * 0.8, slot.bottom - center.bottom - 8)
      return Math.abs(mosaic.width - maximumFittingEdge) <= 1
    })
  }, { message: "Favorites should prefer 1.3x or use the largest safe boundary fit" })
    .toBe(true)
}

async function expectFavoritesMosaicUsesBalancedFill(mosaic: Locator) {
  await expect.poll(async () => mosaic.evaluate((element) => {
    const mosaic = element.getBoundingClientRect()
    const workspace = element.closest<HTMLElement>(".ml-atmosphere-carousel-workspace")
    const slot = workspace?.parentElement?.getBoundingClientRect()
    const center = workspace
      ?.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
    )
      ?.getBoundingClientRect()
    if (!slot || !center) return Number.NEGATIVE_INFINITY
    const usableDimension = Math.min(slot.width, slot.bottom - center.bottom)
    return mosaic.width / usableDimension
  }), {
    message: "Favorites mosaic should use at least about 80% of the limiting portrait dimension",
  })
    .toBeGreaterThanOrEqual(FAVORITES_BALANCED_FILL_RATIO - 0.02)
}

async function gotoShell(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
}

/** Aborts a held fixture request unless the app's own cancellation already won the race. */
async function abortHeldFixtureRequest(route: Route) {
  try {
    await route.abort("aborted")
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Route is already handled!")) {
      throw error
    }
  }
}

/** Persists a deterministic newest-first Atmosphere Favorites fixture before app hydration. */
async function installAtmosphereFavorites(page: Page, favorites: string[]) {
  await page.addInitScript((favoriteIds) => {
    localStorage.setItem("massagelab-atmosphere-v2", JSON.stringify({
      version: 2,
      favorites: favoriteIds,
      recentStations: [],
      volume: 0.4,
      miniPlayerCollapsed: false,
      visualizer: { backgroundId: "static-gradient", showClock: false },
      migrations: { legacyMusicBackground: true },
    }))
  }, favorites)
}

/** Supplies deterministic browser media capabilities for interruption-preference UI tests. */
async function installInterruptionNoticeMediaFakes(page: Page, options: {
  rejectCarrierPlay?: boolean
} = {}) {
  await page.addInitScript((fakeOptions) => {
    class FakeAudio extends EventTarget {
      loop = false
      paused = true
      preload = ""
      private sourceAttribute: string | null = null

      get src() {
        return this.sourceAttribute
          ? new URL(this.sourceAttribute, window.location.href).href
          : ""
      }

      set src(value: string) {
        this.sourceAttribute = value
      }

      getAttribute(name: string) {
        return name === "src" ? this.sourceAttribute : null
      }

      removeAttribute(name: string) {
        if (name === "src") this.sourceAttribute = null
      }

      canPlayType() {
        return "probably"
      }

      play() {
        if (fakeOptions.rejectCarrierPlay) return Promise.reject(new Error("carrier unavailable"))
        this.paused = false
        queueMicrotask(() => this.dispatchEvent(new Event("play")))
        return Promise.resolve()
      }

      pause() {
        if (this.paused) return
        this.paused = true
        queueMicrotask(() => this.dispatchEvent(new Event("pause")))
      }

      load() {}
    }

    class FakeAudioSession extends EventTarget {
      state = "active"
      type = "auto"
    }

    class FakeMediaMetadata {
      constructor(init: Record<string, unknown>) {
        Object.assign(this, init)
      }
    }

    const mediaSession = {
      metadata: null as Record<string, unknown> | null,
      playbackState: "none",
      setActionHandler() {},
    }

    Object.defineProperty(window, "Audio", { configurable: true, value: FakeAudio })
    Object.defineProperty(window, "MediaMetadata", { configurable: true, value: FakeMediaMetadata })
    const audioSession = new FakeAudioSession()
    Object.defineProperty(Navigator.prototype, "mediaSession", {
      configurable: true,
      get: () => mediaSession,
    })
    Object.defineProperty(Navigator.prototype, "audioSession", {
      configurable: true,
      get: () => audioSession,
    })
    Reflect.set(window, "__interruptionNoticeAudioSession", audioSession)
  }, options)
}

async function setInterruptionNoticeAudioSession(page: Page, state: "active" | "interrupted") {
  await page.evaluate((nextState) => {
    const session = Reflect.get(window, "__interruptionNoticeAudioSession") as EventTarget & { state: string }
    session.state = nextState
    session.dispatchEvent(new Event("statechange"))
  }, state)
}

async function startInterruptionNoticeSession(page: Page) {
  await gotoShell(page, "/music")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const player = page.getByTestId("music-player-toolbar")
  await expect(player).toHaveAttribute("data-playback-state", /loading|playing/)
  return player
}

/** Starts the deterministic first-party station used by rendered player geometry contracts. */
async function startProofDrone(page: Page) {
  await gotoShell(page, "/music")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const toolbar = page.getByTestId("music-player-toolbar")
  await expect(toolbar).toHaveAttribute("data-playback-state", /loading|playing/)
  return toolbar
}

const stationReducedMotionQuery = "(prefers-reduced-motion: reduce)"
const stationFinePointerQuery = "(any-hover: hover) and (any-pointer: fine)"

/** Installs live, test-owned station capability queries without replacing orientation matching. */
async function installStationCapabilityQueries(page: Page, initial: {
  reducedMotion: boolean
  finePointer: boolean
}) {
  await page.addInitScript(({ reducedMotion, finePointer }) => {
    const nativeMatchMedia = window.matchMedia.bind(window)
    const states = new Map<string, boolean>([
      ["(prefers-reduced-motion: reduce)", reducedMotion],
      ["(any-hover: hover) and (any-pointer: fine)", finePointer],
    ])
    const lists = new Map<string, MutableMediaQueryList>()

    class MutableMediaQueryList extends EventTarget implements MediaQueryList {
      onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null

      constructor(readonly media: string, public matches: boolean) {
        super()
      }

      addListener(callback: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null) {
        if (callback) this.addEventListener("change", callback as EventListener)
      }

      removeListener(callback: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null) {
        if (callback) this.removeEventListener("change", callback as EventListener)
      }

      setMatches(matches: boolean) {
        if (this.matches === matches) return
        this.matches = matches
        const event = new Event("change") as MediaQueryListEvent
        Object.defineProperties(event, {
          matches: { value: matches },
          media: { value: this.media },
        })
        this.dispatchEvent(event)
        this.onchange?.call(this, event)
      }
    }

    window.matchMedia = (query) => {
      if (!states.has(query)) return nativeMatchMedia(query)
      let list = lists.get(query)
      if (!list) {
        list = new MutableMediaQueryList(query, states.get(query) ?? false)
        lists.set(query, list)
      }
      return list
    }
    Reflect.set(window, "__setStationCapabilityQuery", (query: string, matches: boolean) => {
      states.set(query, matches)
      lists.get(query)?.setMatches(matches)
    })
  }, initial)
}

async function setStationCapabilityQuery(page: Page, query: string, matches: boolean) {
  await page.evaluate(({ query, matches }) => {
    const setQuery = Reflect.get(window, "__setStationCapabilityQuery") as (
      nextQuery: string,
      nextMatches: boolean,
    ) => void
    setQuery(query, matches)
  }, { query, matches })
}

/** Opens the account menu across SSR hydration and transient mobile-drawer closure. */
async function openAccountMenu(page: Page) {
  const trigger = page.getByTestId("account-menu-trigger")
  const helpItem = page.getByRole("menuitem", { name: "Help & FAQ" })
  const navigation = page.getByRole("button", { name: "Open navigation" })

  if (!await trigger.isVisible().catch(() => false)) {
    await navigation.click()
  }

  await expect(trigger).toBeVisible()
  await expect.poll(async () => {
    if (await helpItem.isVisible().catch(() => false)) return true
    if (!await trigger.isVisible().catch(() => false)) {
      if (await navigation.getAttribute("aria-expanded") !== "true") await navigation.click()
      return false
    }
    if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click()
    return helpItem.isVisible().catch(() => false)
  }).toBe(true)
}

async function prepareAccountMenu(page: Page) {
  const trigger = page.getByTestId("account-menu-trigger")

  if (await trigger.count() === 0) {
    await page.getByRole("button", { name: "Open navigation" }).click()
  }

  await expect(trigger).toBeVisible()
}

/** Tracks the live provider listener so synthetic install events cannot race React effect setup. */
async function installPwaPromptListenerProbe(page: Page) {
  await page.addInitScript(() => {
    const activeListeners = new Set<EventListenerOrEventListenerObject>()
    const originalAddEventListener = window.addEventListener.bind(window)
    const originalRemoveEventListener = window.removeEventListener.bind(window)

    Object.defineProperties(window, {
      addEventListener: {
        configurable: true,
        value: ((
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          options?: boolean | AddEventListenerOptions,
        ) => {
          if (!listener) return
          originalAddEventListener(type, listener, options)
          if (type === "beforeinstallprompt") activeListeners.add(listener)
        }) as typeof window.addEventListener,
      },
      removeEventListener: {
        configurable: true,
        value: ((
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          options?: boolean | EventListenerOptions,
        ) => {
          if (!listener) return
          originalRemoveEventListener(type, listener, options)
          if (type === "beforeinstallprompt") activeListeners.delete(listener)
        }) as typeof window.removeEventListener,
      },
      __massagelabPwaInstallPromptListenerReady: {
        configurable: true,
        get: () => activeListeners.size > 0,
      },
    })
  })
}

/** Dispatches exactly once in the same browser task that proves the provider listener is active. */
async function dispatchPwaInstallPromptWhenReady(page: Page, outcome: "resolve" | "reject") {
  await expect.poll(() => page.evaluate((shouldReject) => {
    if (!Reflect.get(window, "__massagelabPwaInstallPromptListenerReady")) return false
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: "dismissed"; platform: string }>
    }
    event.prompt = async () => {
      if (shouldReject) throw new Error("prompt failed")
      document.documentElement.dataset.installPromptCalled = "true"
    }
    event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" })
    window.dispatchEvent(event)
    return true
  }, outcome === "reject")).toBe(true)
}

async function reopenAccountMenu(page: Page, projectName: string) {
  if (projectName === mobileProject) {
    await expect(page.getByTestId("account-menu-trigger")).toHaveCount(0)
  }

  await openAccountMenu(page)
}

async function expectImmersiveOffsetsCleared(page: Page, bodyClass: string) {
  const shell = page.locator(".ml-app-shell")
  await page.evaluate((className) => document.body.classList.add(className), bodyClass)

  await expect.poll(async () => shell.evaluate((element) => {
    const styles = getComputedStyle(element)
    return {
      bottomStack: styles.getPropertyValue("--ml-bottom-stack-height").trim(),
      pageBottom: styles.getPropertyValue("--ml-page-bottom-safe").trim(),
      pageTop: styles.getPropertyValue("--ml-page-top-safe").trim(),
    }
  })).toEqual({ bottomStack: "0px", pageBottom: "0px", pageTop: "0px" })

  await expect(page.locator(".ml-app-topbar")).toBeHidden()
  await expect(page.locator(".ml-mobile-main-bar")).toBeHidden()
  await page.evaluate((className) => document.body.classList.remove(className), bodyClass)
}

async function resolvedShellSpacing(page: Page) {
  return page.locator(".ml-app-shell").evaluate((shell) => {
    const measure = (variable: string) => {
      const probe = document.createElement("div")
      probe.style.cssText = `position:absolute;visibility:hidden;height:var(${variable});`
      shell.appendChild(probe)
      const value = Number.parseFloat(getComputedStyle(probe).height)
      probe.remove()
      return value
    }

    return {
      audioToolbar: measure("--ml-audio-toolbar-height"),
      bottomStack: measure("--ml-bottom-stack-height"),
      chimerBottom: measure("--chimer-bottom-control-offset"),
      chimerPanelBottom: measure("--chimer-panel-bottom-offset"),
      chimerSettingsTop: measure("--chimer-settings-panel-top-offset"),
      chimerTop: measure("--chimer-top-control-offset"),
      mainBar: measure("--ml-main-bar-height"),
      pageBottom: measure("--ml-page-bottom-safe"),
      pageEdgeGap: measure("--ml-page-edge-gap"),
      pageTop: measure("--ml-page-top-safe"),
      safeBottom: measure("--ml-safe-bottom"),
      safeTop: measure("--ml-safe-top"),
      scrollEndBuffer: measure("--ml-scroll-end-buffer"),
    }
  })
}

/** Verifies top placement reserves the safe inset before its usable control grid. */
async function expectTopSafeAreaToolbarGeometry(
  player: Locator,
  expectedHeight: number,
  expectedContentHeight: number,
  safeTop: number,
  actionNames: string[],
) {
  const geometry = await player.evaluate((toolbar, args) => {
    const surface = toolbar.querySelector<HTMLElement>(".ml-music-player-toolbar-surface")
    const layout = toolbar.querySelector<HTMLElement>(".ml-music-player-toolbar-layout")
    if (!surface || !layout) throw new Error("Music toolbar geometry owners are missing")

    const toolbarBox = toolbar.getBoundingClientRect()
    const actionTops = args.actionNames.map((name) => {
      const action = toolbar.querySelector<HTMLElement>(`[aria-label="${name}"]`)
      if (!action) throw new Error(`Music toolbar action ${name} is missing`)
      return action.getBoundingClientRect().top
    })

    return {
      actionTop: Math.min(...actionTops),
      contentTop: toolbarBox.top + args.safeTop,
      layoutClientHeight: layout.clientHeight,
      layoutScrollHeight: layout.scrollHeight,
      surfaceClientHeight: surface.clientHeight,
      surfaceScrollHeight: surface.scrollHeight,
      toolbarHeight: toolbarBox.height,
      toolbarTop: toolbarBox.top,
    }
  }, { actionNames, safeTop })

  expect(geometry.toolbarTop).toBeCloseTo(0, 0)
  expect(geometry.toolbarHeight).toBeCloseTo(expectedHeight, 0)
  expect(expectedHeight).toBeCloseTo(expectedContentHeight + safeTop, 0)
  expect(geometry.layoutClientHeight).toBeCloseTo(expectedContentHeight, 0)
  expect(geometry.actionTop).toBeGreaterThanOrEqual(geometry.contentTop - 1)
  expect(geometry.surfaceScrollHeight).toBeLessThanOrEqual(geometry.surfaceClientHeight)
  expect(geometry.layoutScrollHeight).toBeLessThanOrEqual(geometry.layoutClientHeight)
}

/** Exercises the rendered toolbar's existing top-placement CSS contract. */
async function placeRenderedToolbarAtTop(player: Locator, safeTop: number) {
  await player.evaluate((toolbar, value) => {
    toolbar.setAttribute("data-placement", "top")
    document.body.style.setProperty("--ml-safe-top", `${value}px`)
    document.body.classList.remove("ml-music-player-bottom")
    document.body.classList.add("ml-music-player-top")
  }, safeTop)
}

/** Verifies the bottom stack owns its safe inset outside the full-height toolbar. */
async function expectSafeAreaToolbarGeometry(
  player: Locator,
  expectedHeight: number,
  expectedContentHeight: number,
  expectedBottomStack: number,
  actionNames: string[],
) {
  const geometry = await player.evaluate((toolbar, args) => {
    const surface = toolbar.querySelector<HTMLElement>(".ml-music-player-toolbar-surface")
    const layout = toolbar.querySelector<HTMLElement>(".ml-music-player-toolbar-layout")
    if (!surface || !layout) throw new Error("Music toolbar geometry owners are missing")

    const toolbarBox = toolbar.getBoundingClientRect()
    const actionBottoms = args.actionNames.map((name) => {
      const action = toolbar.querySelector<HTMLElement>(`[aria-label="${name}"]`)
      if (!action) throw new Error(`Music toolbar action ${name} is missing`)
      return action.getBoundingClientRect().bottom
    })

    return {
      actionBottom: Math.max(...actionBottoms),
      contentBottom: toolbarBox.bottom,
      layoutClientHeight: layout.clientHeight,
      layoutScrollHeight: layout.scrollHeight,
      surfaceClientHeight: surface.clientHeight,
      surfaceScrollHeight: surface.scrollHeight,
      toolbarHeight: toolbarBox.height,
      viewportBottomGap: window.innerHeight - toolbarBox.bottom,
    }
  }, { actionNames, expectedBottomStack })

  expect(geometry.toolbarHeight).toBeCloseTo(expectedHeight, 0)
  expect(expectedHeight).toBeCloseTo(expectedContentHeight, 0)
  expect(geometry.layoutClientHeight).toBeCloseTo(expectedContentHeight, 0)
  expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.contentBottom + 1)
  expect(geometry.viewportBottomGap).toBeCloseTo(expectedBottomStack, 0)
  expect(geometry.surfaceScrollHeight).toBeLessThanOrEqual(geometry.surfaceClientHeight)
  expect(geometry.layoutScrollHeight).toBeLessThanOrEqual(geometry.layoutClientHeight)
}

/** Keeps the compact loading treatment semantically useful while removing duplicate copy. */
async function expectCompactLoadingIdentity(player: Locator) {
  const identity = player.getByTestId("music-player-toolbar-identity")
  const progress = identity.locator(".ml-music-player-toolbar-progress")

  await expect(identity.locator(":scope > p:visible")).toHaveCount(1)
  await expect(identity.locator(".ml-music-player-toolbar-title")).toBeVisible()
  await expect(identity.locator(".ml-music-player-toolbar-status")).toBeHidden()
  await expect(progress.locator('[aria-live="polite"]')).toBeHidden()
  await expect(progress.getByRole("progressbar", { name: "Station loading progress" })).toBeVisible()
}

/** Reads rendered player geometry without coupling assertions to implementation classes beyond the owned groups. */
async function readVinylPlayerGeometry(toolbar: Locator) {
  return toolbar.evaluate((root) => {
    const required = <T extends Element>(selector: string) => {
      const element = root.querySelector<T>(selector)
      if (!element) throw new Error(`Vinyl player geometry element is missing: ${selector}`)
      return element
    }
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect()
      return {
        bottom: bounds.bottom,
        height: bounds.height,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      }
    }
    const surface = required<HTMLElement>(".ml-music-player-toolbar-surface")
    const layout = required<HTMLElement>(".ml-music-player-toolbar-layout")
    const vinyl = required<HTMLElement>("[data-testid='station-vinyl']")
    const identity = required<HTMLElement>("[data-testid='music-player-toolbar-identity']")
    const primary = root.querySelector<HTMLElement>("[data-testid='music-player-toolbar-primary-controls']")
    const left = root.querySelector<HTMLElement>("[data-testid='music-player-toolbar-left']")
    const right = root.querySelector<HTMLElement>("[data-testid='music-player-toolbar-right']")
    const playPause = required<HTMLElement>("button[aria-label='Pause'], button[aria-label='Play']")
    const stop = required<HTMLElement>("button[aria-label='Stop'], button[aria-label='Cancel loading']")
    const minimize = root.querySelector<HTMLElement>("button[aria-label='Minimize']")
    const volume = root.querySelector<HTMLElement>("[aria-label='Atmosphere volume']")
    const layoutStyle = getComputedStyle(layout)
    const documentRoot = document.documentElement

    return {
      controls: primary ? rect(primary) : null,
      document: {
        clientHeight: documentRoot.clientHeight,
        clientWidth: documentRoot.clientWidth,
        scrollHeight: documentRoot.scrollHeight,
        scrollWidth: documentRoot.scrollWidth,
      },
      identity: rect(identity),
      layout: {
        ...rect(layout),
        clientHeight: layout.clientHeight,
        clientWidth: layout.clientWidth,
        contentLeft: layout.getBoundingClientRect().left + Number.parseFloat(layoutStyle.paddingLeft),
        contentRight: layout.getBoundingClientRect().right - Number.parseFloat(layoutStyle.paddingRight),
        paddingLeft: Number.parseFloat(layoutStyle.paddingLeft),
        paddingRight: Number.parseFloat(layoutStyle.paddingRight),
        scrollHeight: layout.scrollHeight,
        scrollWidth: layout.scrollWidth,
      },
      left: left ? rect(left) : null,
      minimize: minimize ? rect(minimize) : null,
      playPause: rect(playPause),
      right: right ? rect(right) : null,
      surface: {
        ...rect(surface),
        clientHeight: surface.clientHeight,
        clientWidth: surface.clientWidth,
        scrollHeight: surface.scrollHeight,
        scrollWidth: surface.scrollWidth,
      },
      toolbar: rect(root),
      stop: rect(stop),
      vinyl: rect(vinyl),
      volume: volume && volume.getBoundingClientRect().width > 0 ? rect(volume) : null,
    }
  })
}

/** Resolves the rail variables through rendered probes so clamp/calc values are measured, not parsed. */
async function resolvedMusicRailSpacing(page: Page) {
  return page.locator("body").evaluate((body) => {
    const measureWidth = (variable: string) => {
      const probe = document.createElement("div")
      probe.style.cssText = `position:absolute;visibility:hidden;width:var(${variable});`
      body.appendChild(probe)
      const value = probe.getBoundingClientRect().width
      probe.remove()
      return value
    }

    return {
      railWidth: measureWidth("--ml-music-player-rail-width"),
      rightSafe: measureWidth("--ml-player-right-safe"),
      safeRight: measureWidth("--ml-safe-right"),
    }
  })
}

type StableOverlayBox = { x: number, y: number, width: number, height: number }

/** Waits only for bounded UI animations; infinite playback artwork remains intentionally active. */
async function waitForFiniteOverlayAnimations(locator: Locator, label: string) {
  const result = await locator.evaluate(async (node) => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextFrame()
    const animations = node.getAnimations({ subtree: true }).filter((animation) => {
      const endTime = Number(animation.effect?.getComputedTiming().endTime)
      return Number.isFinite(endTime)
        && endTime > 0
        && (animation.pending || animation.playState === "running")
    })
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timedOut = await Promise.race([
      Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => false),
      new Promise<boolean>((resolve) => {
        timeoutId = setTimeout(() => resolve(true), 2_000)
      }),
    ])
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    await nextFrame()
    return { animationCount: animations.length, timedOut }
  })
  expect(result.timedOut, `${label} finite animations timed out`).toBe(false)
}

/** Returns boxes only after the surface and its real rail are stable across three samples. */
async function settledOverlayGeometry(
  surface: Locator,
  toolbar: Locator,
  viewport: { width: number, height: number },
  label: string,
) {
  await Promise.all([
    waitForFiniteOverlayAnimations(surface, label),
    waitForFiniteOverlayAnimations(toolbar, `${label} rail`),
  ])

  let previous: { rail: StableOverlayBox, surface: StableOverlayBox } | null = null
  let stableComparisons = 0
  const isNear = (first: StableOverlayBox, second: StableOverlayBox) => (
    Math.max(
      Math.abs(first.x - second.x),
      Math.abs(first.y - second.y),
      Math.abs(first.width - second.width),
      Math.abs(first.height - second.height),
    ) <= 0.25
  )

  await expect.poll(async () => {
    const [rail, surfaceBox] = await Promise.all([toolbar.boundingBox(), surface.boundingBox()])
    if (!rail || !surfaceBox) {
      previous = null
      stableComparisons = 0
      return false
    }
    const current = { rail, surface: surfaceBox }
    const fits = surfaceBox.width >= 8
      && surfaceBox.height >= 8
      && surfaceBox.x >= 0
      && surfaceBox.y >= 0
      && surfaceBox.x + surfaceBox.width <= rail.x + 1
      && surfaceBox.y + surfaceBox.height <= viewport.height + 1
    if (!fits) {
      previous = current
      stableComparisons = 0
      return false
    }
    stableComparisons = previous
      && isNear(previous.rail, rail)
      && isNear(previous.surface, surfaceBox)
      ? stableComparisons + 1
      : 0
    previous = current
    return stableComparisons >= 2
  }, {
    message: `${label} settled inside usable viewport`,
    intervals: [32, 32, 64, 64, 100],
  }).toBe(true)

  const [rail, surfaceBox] = await Promise.all([toolbar.boundingBox(), surface.boundingBox()])
  if (!rail || !surfaceBox) throw new Error(`${label} lost stable geometry`)
  return { rail, surface: surfaceBox }
}

/** Reads both bounded rail layers; the outer toolbar may host Task 5 overlays outside its edge. */
async function readMusicRailOverflow(toolbar: Locator) {
  return toolbar.evaluate((node) => {
    const surface = node.querySelector<HTMLElement>(".ml-music-player-toolbar-surface")
    const layout = node.querySelector<HTMLElement>(".ml-music-player-toolbar-layout")
    if (!surface || !layout) throw new Error("Rail geometry owners are missing")
    return {
      layoutClientHeight: layout.clientHeight,
      layoutClientWidth: layout.clientWidth,
      layoutScrollHeight: layout.scrollHeight,
      layoutScrollWidth: layout.scrollWidth,
      surfaceClientHeight: surface.clientHeight,
      surfaceClientWidth: surface.clientWidth,
      surfaceScrollHeight: surface.scrollHeight,
      surfaceScrollWidth: surface.scrollWidth,
      toolbarOverflowY: getComputedStyle(node).overflowY,
    }
  })
}

function expectMusicRailOverflowBounded(overflow: Awaited<ReturnType<typeof readMusicRailOverflow>>) {
  expect(overflow.surfaceScrollWidth).toBeLessThanOrEqual(overflow.surfaceClientWidth)
  expect(overflow.surfaceScrollHeight).toBeLessThanOrEqual(overflow.surfaceClientHeight)
  expect(overflow.layoutScrollWidth).toBeLessThanOrEqual(overflow.layoutClientWidth)
  expect(overflow.layoutScrollHeight).toBeLessThanOrEqual(overflow.layoutClientHeight)
  expect(overflow.toolbarOverflowY).not.toMatch(/auto|scroll/)
}

function drawerControl(cluster: Locator) {
  return cluster.locator("button").first()
}

type WideMobileShellCase = {
  appBarPosition: "top" | "bottom"
  drawerEdge: "left" | "right"
}

const MAIN_BAR_TOOL_LABELS = [
  "Open quick actions",
  "Open music",
  "Open clock",
  "Open calendar",
  "Use light theme",
] as const

/** Reads the configured edge and ordered controls from one settled shell render. */
async function expectStableMainBarControls(
  page: Page,
  expectedDrawerEdge: WideMobileShellCase["drawerEdge"],
) {
  const usesMobileBar = (page.viewportSize()?.width ?? 0) < 768
  const usesModalDrawer = (page.viewportSize()?.width ?? 0) <= 600
  const bar = usesMobileBar
    ? page.locator(".ml-mobile-main-bar")
    : page.locator(".ml-app-topbar")
  const drawerClusterSelector = usesMobileBar ? ".ml-main-bar-drawer-brand" : ".ml-app-bar-drawer-brand"
  const drawerCluster = bar.locator(drawerClusterSelector)
  const drawer = drawerControl(drawerCluster)
  const tools = bar.locator(".ml-main-bar-tools")
  const controls = tools.locator('a[aria-label], button[aria-label]')
  const quickCreate = bar.locator('button[data-quick-action-trigger="true"]')
  const expectedLabels = expectedDrawerEdge === "right"
    ? [...MAIN_BAR_TOOL_LABELS].reverse()
    : [...MAIN_BAR_TOOL_LABELS]

  await expect(bar).toBeVisible()
  await expect(drawer.locator('svg[data-icon="menu"]')).toHaveCount(1)
  await expect(drawer).toHaveAttribute("aria-label", "Open navigation")
  await expect(drawer).toHaveAttribute("aria-expanded", "false")
  await expect(drawerCluster).toHaveAttribute("data-drawer-edge", expectedDrawerEdge)
  await expect(controls).toHaveCount(expectedLabels.length)
  const settledMainBar = await bar.evaluate((element, clusterSelector) => ({
    drawerEdge: element.querySelector(clusterSelector)?.getAttribute("data-drawer-edge"),
    labels: Array.from(element.querySelectorAll<HTMLElement>(
      ".ml-main-bar-tools a[aria-label], .ml-main-bar-tools button[aria-label]",
    )).map((control) => control.getAttribute("aria-label")),
  }), drawerClusterSelector)
  expect(settledMainBar).toEqual({ drawerEdge: expectedDrawerEdge, labels: expectedLabels })

  const drawerBox = await drawer.boundingBox()
  expect(drawerBox, "drawer control box").not.toBeNull()
  expect(drawerBox?.width).toBeCloseTo(42, 0)
  expect(drawerBox?.height).toBeCloseTo(42, 0)
  expect(Math.abs((drawerBox?.width ?? 0) - (drawerBox?.height ?? 0))).toBeLessThanOrEqual(1)

  for (const [index, control] of (await controls.all()).entries()) {
    const box = await control.boundingBox()
    const expectedSize = expectedLabels[index] === "Use light theme" ? 32 : 42
    expect(box, "main-bar control box").not.toBeNull()
    expect(box?.width).toBeCloseTo(expectedSize, 0)
    expect(box?.height).toBeCloseTo(expectedSize, 0)
    expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThanOrEqual(1)
  }

  await drawer.click()
  await expect(drawer).toHaveAttribute("aria-label", "Close navigation")
  await expect(drawer).toHaveAttribute("aria-expanded", "true")
  if (usesModalDrawer) {
    await expect(page.locator('[data-sidebar="sidebar"][data-mobile="true"]')).toBeVisible()
    await expect(quickCreate).toHaveCSS("pointer-events", "none")
    await expect(drawer).toHaveCSS("pointer-events", "auto")
    const accountTrigger = page.getByTestId("account-menu-trigger")
    await expect(accountTrigger).toBeVisible()
    await accountTrigger.click({ trial: true })
  }
  await drawer.click()
  await expect(drawer).toHaveAttribute("aria-label", "Open navigation")
  await expect(drawer).toHaveAttribute("aria-expanded", "false")
  if (usesModalDrawer) {
    await expect(page.locator('[data-sidebar="sidebar"][data-mobile="true"]')).toBeHidden()
  }
  await expect(drawer).toBeFocused()
}

async function expectDrawerAlignedWithCollapsedSidebar(page: Page) {
  const drawer = drawerControl(page.locator(".ml-app-topbar .ml-app-bar-drawer-brand"))
  const frame = page.locator(".ml-app-sidebar-frame")
  const [drawerBox, frameBox] = await Promise.all([drawer.boundingBox(), frame.boundingBox()])

  expect(drawerBox, "desktop drawer control box").not.toBeNull()
  expect(frameBox, "collapsed sidebar frame box").not.toBeNull()
  const drawerCenter = (drawerBox?.x ?? 0) + ((drawerBox?.width ?? 0) / 2)
  const frameCenter = (frameBox?.x ?? 0) + ((frameBox?.width ?? 0) / 2)
  expect(Math.abs(drawerCenter - frameCenter)).toBeLessThanOrEqual(1)
}

async function expectCanonicalSidebarSectionIcons(page: Page) {
  const sidebar = page.locator(".ml-app-sidebar-frame")
  const icons = [
    ["Atmosphere", "lucide-waves"],
    ["Documentation", "lucide-notebook-pen"],
    ["Education", "lucide-graduation-cap"],
    ["Games", "lucide-chess-knight"],
  ] as const

  for (const [label, iconClass] of icons) {
    await expect(sidebar.getByRole("button", { name: label }).locator(`svg.${iconClass}`)).toHaveCount(1)
  }
}

async function expectWideMobileSidebarBoundary(
  page: Page,
  appBarPosition: WideMobileShellCase["appBarPosition"],
) {
  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const frame = page.locator(".ml-app-sidebar-frame")

  await expect(frame).toBeVisible()
  await expect.poll(async () => {
    const barBox = await bar.boundingBox()
    const frameBox = await frame.boundingBox()
    if (!barBox || !frameBox) return Number.POSITIVE_INFINITY

    return appBarPosition === "top"
      ? Math.abs(frameBox.y - (barBox.y + barBox.height))
      : Math.abs(frameBox.y + frameBox.height - barBox.y)
  }).toBeLessThanOrEqual(1)
}

async function expectWideMobileShellGeometry(page: Page, shellCase: WideMobileShellCase) {
  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const edgeCluster = bar.locator(".ml-main-bar-drawer-brand")
  const drawer = drawerControl(edgeCluster)
  const brand = edgeCluster.getByRole("link", { name: "MassageLab home" })
  const tools = bar.locator(".ml-main-bar-tools")
  const sidebarContainer = page.locator('[data-sidebar-container="true"]')
  const backdrop = page.getByTestId("wide-mobile-sidebar-backdrop")
  const appScroll = page.locator(".ml-app-scroll")
  await expectStableMainBarControls(page, shellCase.drawerEdge)
  const [barBox, drawerBox, brandBox, toolsBox] = await Promise.all([
    bar.boundingBox(),
    drawer.boundingBox(),
    brand.boundingBox(),
    tools.boundingBox(),
  ])

  expect(barBox?.x).toBeLessThanOrEqual(1)
  expect(barBox?.width).toBeGreaterThanOrEqual(762)
  expect(barBox?.height).toBeCloseTo(52, 0)
  expect(drawerBox, "wide-mobile drawer box").not.toBeNull()
  expect(brandBox, "wide-mobile brand box").not.toBeNull()
  expect(toolsBox, "wide-mobile tools box").not.toBeNull()
  await expect(edgeCluster.locator(".ml-app-bar-brand-wordmark")).toBeVisible()
  await expect(edgeCluster.locator(".ml-app-bar-brand-mark")).toBeHidden()

  if (shellCase.drawerEdge === "left") {
    expect(drawerBox?.x ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(8)
    expect((drawerBox?.x ?? 0) + (drawerBox?.width ?? 0)).toBeLessThanOrEqual(brandBox?.x ?? 0)
    expect((toolsBox?.x ?? 0) + (toolsBox?.width ?? 0)).toBeGreaterThanOrEqual(756)
  } else {
    expect((drawerBox?.x ?? 0) + (drawerBox?.width ?? 0)).toBeGreaterThanOrEqual(756)
    expect((brandBox?.x ?? 0) + (brandBox?.width ?? 0)).toBeLessThanOrEqual(drawerBox?.x ?? 0)
    expect(toolsBox?.x ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(8)
  }

  const toolBoxes = await tools.locator(":scope > *").evaluateAll((elements) => elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({ x: rect.x, width: rect.width })))
  expect(toolBoxes).toHaveLength(5)
  for (let index = 1; index < toolBoxes.length; index += 1) {
    const gap = toolBoxes[index].x - (toolBoxes[index - 1].x + toolBoxes[index - 1].width)
    expect(gap).toBeGreaterThanOrEqual(3)
    expect(gap).toBeLessThanOrEqual(5)
  }

  await expect(sidebarContainer).toHaveAttribute("data-render-mode", "desktop")
  await expect(sidebarContainer).toHaveAttribute("data-state", "collapsed")
  await expect(drawer).toHaveAttribute("aria-expanded", "false")
  await expect(backdrop).toHaveCount(0)
  const closedContentBox = await appScroll.boundingBox()
  expect(closedContentBox, "closed wide-mobile content box").not.toBeNull()
  await expectWideMobileSidebarBoundary(page, shellCase.appBarPosition)

  await drawer.click()
  await expect(sidebarContainer).toHaveAttribute("data-state", "expanded")
  await expect(drawer).toHaveAttribute("aria-expanded", "true")
  await expect(backdrop).toBeVisible()
  await expect(backdrop).toHaveAttribute("aria-hidden", "true")
  await expect(backdrop).not.toHaveAttribute("tabindex")
  await expect(backdrop).toHaveCSS("position", "fixed")
  await expectCanonicalSidebarSectionIcons(page)
  const backdropFilter = await backdrop.evaluate((element) => {
    const styles = getComputedStyle(element)
    return styles.getPropertyValue("backdrop-filter") || styles.getPropertyValue("-webkit-backdrop-filter")
  })
  expect(backdropFilter).toContain("blur")

  const openContentBox = await appScroll.boundingBox()
  expect(openContentBox?.x).toBeCloseTo(closedContentBox?.x ?? Number.NaN, 0)
  expect(openContentBox?.width).toBeCloseTo(closedContentBox?.width ?? Number.NaN, 0)
  const overlayHitTest = await page.evaluate((drawerEdge) => {
    const backdropElement = document.querySelector('[data-testid="wide-mobile-sidebar-backdrop"]')
    const frameElement = document.querySelector(".ml-app-sidebar-frame")
    const frameRect = frameElement?.getBoundingClientRect()
    const contentX = drawerEdge === "left" ? window.innerWidth - 40 : 40
    const contentY = window.innerHeight / 2
    const frameX = frameRect ? frameRect.x + (frameRect.width / 2) : 0
    const frameY = frameRect ? frameRect.y + (frameRect.height / 2) : 0

    return {
      backdropOwnsContent: document.elementFromPoint(contentX, contentY) === backdropElement,
      frameOwnsSidebar: Boolean(document.elementFromPoint(frameX, frameY)?.closest(".ml-app-sidebar-frame")),
    }
  }, shellCase.drawerEdge)
  expect(overlayHitTest).toEqual({ backdropOwnsContent: true, frameOwnsSidebar: true })
  await expectWideMobileSidebarBoundary(page, shellCase.appBarPosition)

  await drawer.click()
  await expect(sidebarContainer).toHaveAttribute("data-state", "collapsed")
  await expect(drawer).toHaveAttribute("aria-expanded", "false")
  await expect(drawer).toBeFocused()
  await expect(backdrop).toHaveCount(0)

  await drawer.click()
  await expect(backdrop).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(sidebarContainer).toHaveAttribute("data-state", "collapsed")
  await expect(drawer).toBeFocused()
  await expect(backdrop).toHaveCount(0)

  await drawer.click()
  await expect(backdrop).toBeVisible()
  await backdrop.click()
  await expect(sidebarContainer).toHaveAttribute("data-state", "collapsed")
  await expect(backdrop).toHaveCount(0)
}

test("anonymous quick actions stay focused and preserve the full-screen overlay", async ({ page }) => {
  await gotoShell(page, "/wellness")
  const trigger = page.getByRole("button", { name: "Open quick actions" })
  await trigger.click()

  const overlay = page.locator(".ml-quick-action-layer")
  const actions = page.getByRole("navigation", { name: "Quick create actions" })
  await expect(overlay).toBeVisible()
  await expect(overlay).toHaveCSS("position", "fixed")
  const viewport = page.viewportSize()
  const overlayBox = await overlay.boundingBox()
  expect(viewport, "quick-action viewport").not.toBeNull()
  expect(overlayBox, "quick-action overlay box").not.toBeNull()
  if (viewport && overlayBox) {
    expect(overlayBox.x).toBeGreaterThanOrEqual(-1)
    expect(overlayBox.x).toBeLessThanOrEqual(1)
    expect(overlayBox.y).toBeGreaterThanOrEqual(-1)
    expect(overlayBox.y).toBeLessThanOrEqual(1)
    expect(overlayBox.width).toBeGreaterThanOrEqual(viewport.width - 1)
    expect(overlayBox.height).toBeGreaterThanOrEqual(viewport.height - 1)
  }
  await expect(actions.getByRole("link")).toHaveCount(4)
  await expect(actions.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/login")
  await expect(actions.getByRole("link", { name: "Create Account" })).toHaveAttribute("href", "/register")
  await expect(actions.getByRole("link", { name: "Quick Log" })).toHaveAttribute("href", "/wellness#quick-log")
  await expect(actions.getByRole("link", { name: "Breathing Guide" })).toHaveAttribute("href", "/wellness/breathing")

  const loginAction = actions.getByRole("link", { name: "Log In" })
  const closeAction = page.getByRole("button", { name: "Close quick actions" })
  await expect(loginAction).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(closeAction).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(loginAction).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(overlay).toBeVisible()
  await page.mouse.click((viewport?.width ?? 390) / 2, 20)
  await expect(overlay).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test("desktop bar spans the viewport and keeps the brand beside the left drawer control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Desktop app-bar geometry is covered in desktop Chromium.")
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "top", sidebarPosition: "left", sidebarTriggerPosition: "top", themeMode: "dark",
  })))
  await gotoShell(page, "/music")

  const bar = page.locator(".ml-app-topbar")
  const cluster = bar.locator(".ml-app-bar-drawer-brand")
  const barBox = await bar.boundingBox()
  const clusterBox = await cluster.boundingBox()
  const drawerBox = await drawerControl(cluster).boundingBox()
  const brandBox = await cluster.getByRole("link", { name: "MassageLab home" }).boundingBox()
  expect(barBox?.x).toBeLessThanOrEqual(1)
  expect(barBox?.width).toBeGreaterThanOrEqual(1278)
  expect(clusterBox?.x ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(17)
  expect(drawerBox?.x ?? Number.POSITIVE_INFINITY).toBeLessThan(brandBox?.x ?? 0)
  await expect(page.getByRole("link", { name: "Open music" }).first()).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("link", { name: "Open clock" }).first()).not.toHaveAttribute("aria-current", "page")
})

test("calendar content reserves the fixed bottom app bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Desktop calendar bottom clearance is covered in desktop Chromium.")
  await page.setViewportSize({ width: 1024, height: 720 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom", sidebarPosition: "left", sidebarTriggerPosition: "bottom", themeMode: "dark",
  })))
  await gotoShell(page, "/calendar")

  const bar = page.locator(".ml-app-topbar")
  const content = page.locator(".ml-app-content")
  const [barBox, paddingBottom] = await Promise.all([
    bar.boundingBox(),
    content.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom)),
  ])

  expect(barBox, "calendar app bar box").not.toBeNull()
  expect(paddingBottom).toBeGreaterThanOrEqual((barBox?.height ?? 0) - 1)
})

test("desktop tooltips open from hover and keyboard focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Desktop tooltips are covered in desktop Chromium.")
  await gotoShell(page, "/music")

  const music = page.getByRole("link", { name: "Open music" }).first()
  await music.hover()
  await expect(page.getByRole("tooltip").filter({ hasText: "Music" })).toBeVisible()

  await page.mouse.move(640, 450)
  const clock = page.getByRole("link", { name: "Open clock" }).first()
  await clock.focus()
  await expect(page.getByRole("tooltip").filter({ hasText: "Clock" })).toBeVisible()
})

test("account menu launches a captured install prompt and keeps help or feedback available", async ({ page }, testInfo) => {
  await installPwaPromptListenerProbe(page)
  await gotoShell(page, "/")
  await prepareAccountMenu(page)
  await openAccountMenu(page)
  await dispatchPwaInstallPromptWhenReady(page, "resolve")
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Send Feedback" })).toBeVisible()
  await page.getByRole("menuitem", { name: "Install MassageLab" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt-called", "true")
  await reopenAccountMenu(page, testInfo.project.name)
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
})

test("guest account menu opens local Site Settings at 704px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Guest settings navigation is covered once in desktop Chromium.")
  await page.setViewportSize({ width: 704, height: 597 })
  await gotoShell(page, "/")

  const sidebar = page.locator('[data-sidebar-container="true"]')
  await page.getByRole("button", { name: "Open navigation" }).click()
  await expect(sidebar).toHaveAttribute("data-state", "expanded")
  await openAccountMenu(page)

  const siteSettings = page.getByRole("menuitem", { name: "Site Settings" })
  await expect(siteSettings).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(siteSettings).toBeHidden()
  await expect(sidebar).toHaveAttribute("data-state", "expanded")
  await page.getByTestId("account-menu-trigger").click()
  await expect(siteSettings).toBeVisible()
  await siteSettings.click()

  await expect(page).toHaveURL(/\/account\?tab=app-settings/)
  await expect(page.getByText("Layout and sidebar", { exact: true })).toBeVisible()
  await expect(page.getByText("App bar position", { exact: true })).toBeVisible()
  await expect(page.getByText("Sidebar side", { exact: true })).toBeVisible()
  const leftSide = page.getByRole("radio", { name: /^Left/ })
  const rightSide = page.getByRole("radio", { name: /^Right/ })
  await expect(leftSide).toBeVisible()
  await expect(rightSide).toBeVisible()
  await expect(page.getByRole("radio", { name: /Upper left|Upper right|Bottom left|Bottom right/ })).toHaveCount(0)

  await rightSide.click()
  const bar = page.locator(".ml-mobile-main-bar")
  await expect(bar).toHaveAttribute("data-sidebar-position", "right")
  expect(await bar.locator(".ml-main-bar-tools").locator('a[aria-label], button[aria-label]').evaluateAll(
    (elements) => elements.map((element) => element.getAttribute("aria-label")),
  )).toEqual([...MAIN_BAR_TOOL_LABELS].reverse())

  await leftSide.click()
  await expect(bar).toHaveAttribute("data-sidebar-position", "left")
  expect(await bar.locator(".ml-main-bar-tools").locator('a[aria-label], button[aria-label]').evaluateAll(
    (elements) => elements.map((element) => element.getAttribute("aria-label")),
  )).toEqual([...MAIN_BAR_TOOL_LABELS])
})

test("account menu hides install when already installed", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = (query) => query === "(display-mode: standalone)"
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent: () => true,
        } as MediaQueryList)
      : original(query)
  })
  await gotoShell(page, "/")
  await openAccountMenu(page)
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Send Feedback" })).toBeVisible()
})

test("account menu hides install on an unsupported browser", async ({ page }) => {
  await gotoShell(page, "/")
  await openAccountMenu(page)
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Send Feedback" })).toBeVisible()
})

test("failed install prompt stays hidden after the failed attempt", async ({ page }, testInfo) => {
  await installPwaPromptListenerProbe(page)
  await gotoShell(page, "/")
  await prepareAccountMenu(page)
  await dispatchPwaInstallPromptWhenReady(page, "reject")
  await openAccountMenu(page)
  await page.getByRole("menuitem", { name: "Install MassageLab" }).click()
  await reopenAccountMenu(page, testInfo.project.name)
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
})

test("help routes installation and problem reports without claiming commerce is live", async ({ page }) => {
  await gotoShell(page, "/help")
  await expect(page.getByRole("heading", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.locator("#installing")).toBeVisible()
  await expect(page.getByText(/free background credits and individual background purchases are not available yet/i)).toBeVisible()
  await expect(page.getByRole("link", { name: "Send Feedback or Report a Problem" })).toHaveAttribute("href", "/support")
})

test("recognized iOS Safari receives manual install instructions", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperties(navigator, {
      userAgent: { value: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", configurable: true },
      platform: { value: "iPhone", configurable: true },
      maxTouchPoints: { value: 5, configurable: true },
    })
  })
  await gotoShell(page, "/")
  await openAccountMenu(page)
  await page.getByRole("menuitem", { name: "Install MassageLab" }).click()
  const instructions = page.getByRole("dialog", { name: "Install MassageLab" })
  await expect(instructions).toContainText("Add to Home Screen")
  await page.waitForTimeout(600)
  await expect(instructions).toBeVisible()
  await expect(page.getByRole("link", { name: "Read installation help" })).toHaveAttribute("href", "/help#installing")
})

test("right drawer keeps the drawer and brand ordered at the right edge", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Desktop app-bar geometry is covered in desktop Chromium.")
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom", sidebarPosition: "right", sidebarTriggerPosition: "bottom", themeMode: "dark",
  })))
  await gotoShell(page, "/")

  const bar = page.locator(".ml-app-topbar")
  const cluster = bar.locator(".ml-app-bar-drawer-brand")
  const barBox = await bar.boundingBox()
  const drawer = drawerControl(cluster)
  await expect(drawer).toBeVisible()
  const drawerBox = await drawer.boundingBox()
  const brandBox = await cluster.getByRole("link", { name: "MassageLab home" }).boundingBox()
  expect(barBox?.x).toBeLessThanOrEqual(1)
  expect(barBox?.width).toBeGreaterThanOrEqual(1278)
  expect((brandBox?.x ?? Number.POSITIVE_INFINITY)).toBeLessThan(drawerBox?.x ?? 0)
  expect((drawerBox?.x ?? 0) + (drawerBox?.width ?? 0)).toBeGreaterThan(1240)
})

for (const shellCase of [
  { appBarPosition: "bottom", drawerEdge: "left" },
  { appBarPosition: "top", drawerEdge: "right" },
] as const satisfies readonly WideMobileShellCase[]) {
  test(`764px ${shellCase.drawerEdge} drawer and ${shellCase.appBarPosition} bar keep compact tools clear of the sidebar`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== desktopProject, "Wide-mobile fixed-sidebar geometry is covered in desktop Chromium.")
    await page.setViewportSize({ width: 764, height: 597 })
    await page.addInitScript((settings) => localStorage.setItem("massage-lab-settings", JSON.stringify(settings)), {
      appBarPosition: shellCase.appBarPosition,
      sidebarPosition: shellCase.drawerEdge,
      sidebarTriggerPosition: shellCase.appBarPosition,
      themeMode: "dark",
    })
    await gotoShell(page, "/music")

    await expectWideMobileShellGeometry(page, shellCase)
  })
}

for (const boundaryCase of [
  { width: 749, appBarPosition: "bottom", drawerEdge: "left" },
  { width: 837, appBarPosition: "top", drawerEdge: "right" },
] as const) {
  test(`${boundaryCase.width}px keeps the shared main-bar controls stable across the responsive switch`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== desktopProject, "Responsive app-bar controls are covered in desktop Chromium.")
    await page.setViewportSize({ width: boundaryCase.width, height: 597 })
    await page.addInitScript((settings) => localStorage.setItem("massage-lab-settings", JSON.stringify(settings)), {
      appBarPosition: boundaryCase.appBarPosition,
      sidebarPosition: boundaryCase.drawerEdge,
      sidebarTriggerPosition: boundaryCase.appBarPosition,
      themeMode: "dark",
    })
    await gotoShell(page, "/music")

    await expectStableMainBarControls(page, boundaryCase.drawerEdge)
  })
}

for (const drawerEdge of ["left", "right"] as const) {
  test(`774px ${drawerEdge} drawer center aligns with the collapsed sidebar rail`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== desktopProject, "Desktop boundary geometry is covered in desktop Chromium.")
    await page.setViewportSize({ width: 774, height: 597 })
    await page.addInitScript((sidebarPosition) => localStorage.setItem("massage-lab-settings", JSON.stringify({
      appBarPosition: "top",
      sidebarPosition,
      sidebarTriggerPosition: "top",
      themeMode: "dark",
    })), drawerEdge)
    await gotoShell(page, "/music")

    await expectDrawerAlignedWithCollapsedSidebar(page)
    await expectStableMainBarControls(page, drawerEdge)
  })
}

test("narrow mobile keeps every tool and collapses only the wordmark", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Narrow main-bar behavior is covered in mobile Chromium.")
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")

  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const barBox = await bar.boundingBox()
  const drawer = page.locator(".ml-mobile-main-bar .ml-main-bar-drawer-brand button").first()
  expect(barBox?.height).toBeCloseTo(52, 0)
  await expectStableMainBarControls(page, "left")
  await expect(bar.locator(".ml-app-bar-brand-mark")).toBeVisible()
  await expect(bar.locator(".ml-app-bar-brand-wordmark")).toBeHidden()
  for (const name of ["Open music", "Open clock", "Open quick actions", "Open calendar"]) {
    await expect(bar.getByLabel(name)).toBeVisible()
  }
  await expect(bar.getByRole("group", { name: "Theme" })).toBeVisible()
  await expect(bar.getByRole("link", { name: "Open music" })).toHaveAttribute("aria-current", "page")
  await expect(drawer).toHaveAttribute("aria-expanded", "false")
  await drawer.click()
  await expect(drawer).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator('[data-sidebar="sidebar"][data-mobile="true"]')).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(drawer).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator('[data-sidebar="sidebar"][data-mobile="true"]')).toBeHidden()
  await expect(drawer).toBeFocused()
})

test("global constrained landscape rail keeps route transitions, vinyl geometry, and portrait return coherent", async ({ page }, testInfo) => {
  test.skip(
    ![mobileProject, desktopProject].includes(testInfo.project.name),
    "Constrained-landscape rail geometry is covered in Chromium.",
  )
  await installInterruptionNoticeMediaFakes(page)
  const geometryReceipt: Array<Record<string, unknown>> = []
  const measureStageReservations = () => page.locator("[data-immersive-stage]").evaluate((stage) => {
    const measureVariable = (variable: string) => {
      const probe = document.createElement("span")
      probe.style.cssText = `position:fixed;visibility:hidden;width:var(${variable});`
      stage.appendChild(probe)
      const width = probe.getBoundingClientRect().width
      probe.remove()
      return width
    }
    return {
      bottom: measureVariable("--immersive-reserved-bottom"),
      left: measureVariable("--immersive-reserved-left"),
      right: measureVariable("--immersive-reserved-right"),
      top: measureVariable("--immersive-reserved-top"),
    }
  })

  await page.setViewportSize({ width: 746, height: 284 })
  await gotoShell(page, "/music")
  await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
  await expect(page.locator("body")).not.toHaveClass(/ml-music-player-(?:active|rail|music-route)/)
  await expect.poll(async () => (await resolvedMusicRailSpacing(page)).rightSafe).toBe(0)
  await page.locator('a[aria-label="MassageLab home"]:visible').first().click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator("body")).not.toHaveClass(/ml-music-player-(?:active|rail|music-route)/)
  await expect.poll(async () => (await resolvedMusicRailSpacing(page)).rightSafe).toBe(0)
  await page.getByRole("link", { name: "Open clock" }).click()
  await expect(page).toHaveURL(/\/clock$/)
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const noPlayerClockPanel = page.locator('[data-immersive-panel="clock"]')
  await expect(noPlayerClockPanel).toHaveAttribute("data-immersive-layout", "side")
  await expect.poll(async () => (await measureStageReservations()).right).toBeGreaterThan(0)
  const noPlayerPanelReservation = await measureStageReservations()
  await page.getByRole("button", { name: "Close Clock panel", exact: true }).click()
  await expect.poll(async () => (await measureStageReservations()).right).toBe(0)
  await page.getByRole("button", { name: "Close clock", exact: true }).click()
  await expect(page.locator("body")).not.toHaveClass(/chimer-running/)

  await page.setViewportSize({ width: 390, height: 844 })
  const toolbar = await startProofDrone(page)
  await expect(toolbar).toHaveAttribute("data-playback-state", "playing", { timeout: 45_000 })
  const interruptionNotice = page.getByTestId("music-interruption-notice")
  if (await interruptionNotice.isVisible().catch(() => false)) {
    await interruptionNotice.getByRole("button", { name: "Close" }).click()
  }

  await expect(toolbar).toHaveAttribute("data-layout", "bottom")
  expect((await toolbar.boundingBox())?.width).toBe(390)
  await page.locator("body").evaluate((body) => body.style.setProperty("--ml-safe-right", "24px"))

  type RailState = {
    layer: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>
    rail: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>
    spacing: Awaited<ReturnType<typeof resolvedMusicRailSpacing>>
    vinyl: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>
  }

  const actionLabels = () => toolbar
    .locator('.ml-music-player-toolbar-layout button[aria-label], .ml-music-player-toolbar-layout a[aria-label], .ml-music-player-toolbar-layout input[aria-label]')
    .evaluateAll((actions) => actions.map((action) => action.getAttribute("aria-label")))

  const assertRailState = async (
    viewport: { width: number, height: number },
    route: string,
    collapsed: boolean,
    expectedDiameter?: number,
  ): Promise<RailState> => {
    const stateLabel = `${viewport.width}x${viewport.height} ${route} ${collapsed ? "collapsed" : "expanded"}`
    await expect(toolbar, `${stateLabel} layout`).toHaveAttribute("data-layout", "rail")
    await expect(toolbar, `${stateLabel} state`).toHaveAttribute("data-collapsed", String(collapsed))
    await expect(page.locator("body"), `${stateLabel} global marker`).toHaveClass(/ml-music-player-rail/)
    if (route === "music") {
      await expect(page.locator("body"), `${stateLabel} Music marker`).toHaveClass(/ml-music-player-music-route/)
    } else {
      await expect(page.locator("body"), `${stateLabel} Music marker`).not.toHaveClass(/ml-music-player-music-route/)
    }

    const [rail, vinyl, layer, spacing, stacking] = await Promise.all([
      toolbar.boundingBox(),
      toolbar.getByTestId("station-vinyl").boundingBox(),
      toolbar.locator(".ml-station-vinyl-layer").boundingBox(),
      resolvedMusicRailSpacing(page),
      toolbar.evaluate((root) => {
        const vinylLayer = root.querySelector<HTMLElement>(".ml-station-vinyl-layer")
        const layout = root.querySelector<HTMLElement>(".ml-music-player-toolbar-layout")
        const surface = root.querySelector<HTMLElement>(".ml-music-player-toolbar-surface")
        if (!vinylLayer || !layout || !surface) throw new Error("Rail stacking owners are missing")
        return {
          layerZ: Number(getComputedStyle(vinylLayer).zIndex),
          layoutZ: Number(getComputedStyle(layout).zIndex),
          surfaceOverflowX: getComputedStyle(surface).overflowX,
        }
      }),
    ])
    expect(rail, `${stateLabel} rail`).not.toBeNull()
    expect(vinyl, `${stateLabel} vinyl`).not.toBeNull()
    expect(layer, `${stateLabel} vinyl layer`).not.toBeNull()
    if (!rail || !vinyl || !layer) throw new Error(`${stateLabel} geometry is unavailable`)

    expect(rail.x + rail.width, `${stateLabel} right edge`).toBeCloseTo(viewport.width, 0)
    expect(rail.y, `${stateLabel} top edge`).toBeCloseTo(0, 0)
    expect(spacing.railWidth, `${stateLabel} rail variable`).toBeCloseTo(rail.width, 0)
    expect(spacing.rightSafe, `${stateLabel} right exclusion`).toBeCloseTo(
      rail.width + spacing.safeRight,
      0,
    )
    expect(vinyl.x, `${stateLabel} vinyl left`).toBeCloseTo(rail.x + 7, 0)
    expect(vinyl.y, `${stateLabel} vinyl top`).toBeCloseTo(rail.y + 7, 0)
    expect(vinyl.width, `${stateLabel} vinyl diameter`).toBeCloseTo(vinyl.height, 0)
    expect(layer.x, `${stateLabel} layer left`).toBeCloseTo(rail.x, 0)
    expect(layer.y, `${stateLabel} layer top`).toBeCloseTo(rail.y, 0)
    expect(layer.width, `${stateLabel} visible clip width`).toBeCloseTo(rail.width, 0)
    expect(layer.height, `${stateLabel} layer height`).toBeCloseTo(rail.height, 0)
    expect(stacking.layoutZ, `${stateLabel} foreground stacking`).toBeGreaterThan(stacking.layerZ)
    expect(stacking.surfaceOverflowX, `${stateLabel} clipping owner`).toBe("hidden")

    if (route.startsWith("clock")) {
      const stageGeometry = await page.getByRole("region", { name: "Chimer clock" }).evaluate((stage) => {
        const primaryDisplay = stage.querySelector<HTMLElement>('[data-immersive-primary-display="true"]')
        if (!primaryDisplay) throw new Error("Clock primary display is missing")
        const measureVariable = (variable: string) => {
          const probe = document.createElement("span")
          probe.style.cssText = `position:fixed;visibility:hidden;width:var(${variable});`
          stage.appendChild(probe)
          const width = probe.getBoundingClientRect().width
          probe.remove()
          return width
        }
        return {
          inlineReservedRight: (stage as HTMLElement).style.getPropertyValue("--immersive-reserved-right"),
          playerRightSafe: measureVariable("--ml-player-right-safe"),
          primaryRight: primaryDisplay.getBoundingClientRect().right,
          reservedRight: measureVariable("--immersive-reserved-right"),
        }
      })
      expect(
        stageGeometry.reservedRight,
        `${stateLabel} composed immersive reservation ${JSON.stringify(stageGeometry)}`,
      )
        .toBeCloseTo(spacing.rightSafe, 0)
      await expect.poll(
        () => page.locator('[data-immersive-primary-display="true"]').evaluate(
          (display) => display.getBoundingClientRect().right,
        ),
        { message: `${stateLabel} primary display clears rail` },
      ).toBeLessThanOrEqual(rail.x + 1)
      const closeClock = page.getByRole("button", { name: "Close clock", exact: true })
      const closeClockBox = await closeClock.boundingBox()
      expect(closeClockBox, `${stateLabel} fixed clock control`).not.toBeNull()
      if (!closeClockBox) throw new Error(`${stateLabel} fixed clock control geometry is unavailable`)
      expect(closeClockBox.x + closeClockBox.width, `${stateLabel} fixed clock control clears rail`)
        .toBeLessThanOrEqual(rail.x + 1)
      await closeClock.click({ trial: true })
    }

    if (collapsed) {
      const sidebarFrame = await page.locator(".ml-app-sidebar-frame").boundingBox()
      // Clock's immersive route removes the physical sidebar while retaining
      // the same icon-rail token that defines a collapsed player rail.
      const expectedCollapsedRailWidth = sidebarFrame?.width ?? await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement)
        // This route has no SidebarProvider to publish the custom property;
        // match the CSS rail fallback of 3.25rem instead.
        return 3.25 * Number.parseFloat(root.fontSize)
      })
      expect(rail.width, `${stateLabel} shared collapsed rail width`)
        .toBeCloseTo(expectedCollapsedRailWidth, 0)
      expect(vinyl.width, `${stateLabel} retained diameter`).toBeCloseTo(expectedDiameter ?? 0, 0)
      expect(vinyl.x + vinyl.width, `${stateLabel} clipped right arc`)
        .toBeGreaterThan(layer.x + layer.width)
      const visibleVinylWidth = Math.min(vinyl.x + vinyl.width, layer.x + layer.width)
        - Math.max(vinyl.x, layer.x)
      expect(visibleVinylWidth, `${stateLabel} visible left arc`).toBeCloseTo(rail.width - 7, 0)
      await expect(toolbar.getByTestId("music-player-toolbar-identity")).toBeHidden()
      expect(await actionLabels()).toEqual(["Pause", "Stop", "Expand"])
      await expect(toolbar.getByRole("button", { name: "Expand" }).locator("svg.lucide-chevron-left")).toHaveCount(1)
    } else {
      expect(vinyl.width, `${stateLabel} expanded diameter`).toBeCloseTo(rail.width - 14, 0)
      await expect(toolbar.getByTestId("music-player-toolbar-identity")).toBeVisible()
      expect(await toolbar.getByTestId("music-player-toolbar-rail-transport")
        .locator("button[aria-label]").evaluateAll((actions) => actions.map((action) => action.getAttribute("aria-label"))))
        .toEqual(["Previous station", "Pause", "Stop", "Next station"])
      expect(await toolbar.getByTestId("music-player-toolbar-rail-options")
        .locator("button[aria-label], a[aria-label]").evaluateAll((actions) => actions.map((action) => action.getAttribute("aria-label"))))
        .toEqual(["Player settings", "Favorite MassageLab Proof Drone", "Background", "Minimize"])
      await expect(toolbar.getByRole("button", { name: "Minimize" }).locator("svg.lucide-chevron-right")).toHaveCount(1)
      const vinylTreatment = await toolbar.evaluate((root) => {
        const identity = root.querySelector<HTMLElement>('[data-testid="music-player-toolbar-identity"]')
        const grooves = root.querySelector<HTMLElement>(".ml-station-vinyl-grooves")
        const glare = root.querySelector<HTMLElement>(".ml-station-vinyl-glare")
        const label = root.querySelector<HTMLElement>(".ml-station-vinyl-label")
        if (!identity || !grooves || !glare || !label) throw new Error("Vinyl treatment is incomplete")
        return {
          identityBackground: getComputedStyle(identity).backgroundImage,
          identityPlate: getComputedStyle(identity, "::before").backgroundImage,
          identityShadow: getComputedStyle(identity).textShadow,
          grooves: getComputedStyle(grooves).backgroundImage,
          glare: getComputedStyle(glare).backgroundImage,
          label: getComputedStyle(label).backgroundImage,
          labelDisc: getComputedStyle(label, "::before").backgroundColor,
        }
      })
      // The readable treatment is a feathered pseudo-element plate over the
      // vinyl; the identity itself remains transparent so it does not obscure
      // the artwork beneath it.
      expect(vinylTreatment.identityBackground).toBe("none")
      expect(vinylTreatment.identityPlate).not.toBe("none")
      expect(vinylTreatment.identityShadow).not.toBe("none")
      expect(vinylTreatment.grooves).not.toBe("none")
      expect(vinylTreatment.glare).not.toBe("none")
      expect(vinylTreatment.label).toBe("none")
      expect(vinylTreatment.labelDisc).not.toBe("rgba(0, 0, 0, 0)")
    }
    expectMusicRailOverflowBounded(await readMusicRailOverflow(toolbar))
    geometryReceipt.push({ state: collapsed ? "collapsed" : "expanded", viewport, route, rail, vinyl, layer, spacing })
    return { layer, rail, spacing, vinyl }
  }

  const nonMusicGeometry = async (viewport: { width: number, height: number }, route: string) => {
    const metrics = await page.evaluate(() => {
      const scroll = document.querySelector<HTMLElement>(".ml-app-scroll")
      const content = document.querySelector<HTMLElement>(".ml-app-content")
      if (!scroll || !content) throw new Error("Non-Music layout owners are missing")
      const scrollBox = scroll.getBoundingClientRect()
      const contentBox = content.getBoundingClientRect()
      return {
        content: { x: contentBox.x, width: contentBox.width },
        contentPaddingRight: Number.parseFloat(getComputedStyle(content).paddingRight),
        scroll: {
          clientHeight: scroll.clientHeight,
          clientWidth: scroll.clientWidth,
          overflowY: getComputedStyle(scroll).overflowY,
          scrollHeight: scroll.scrollHeight,
          x: scrollBox.x,
        },
      }
    })
    expect(metrics.content.x + metrics.content.width, `${route} ordinary content right`).toBeCloseTo(
      metrics.scroll.x + metrics.scroll.clientWidth,
      0,
    )
    expect(metrics.contentPaddingRight, `${route} Music workspace padding`).toBe(0)
    expect(metrics.content.width, `${route} unsqueezed width`).toBeGreaterThan(viewport.width - 320)
    if (route !== "clock") {
      expect(metrics.scroll.overflowY, `${route} ordinary overflow`).not.toBe("hidden")
      expect(metrics.scroll.scrollHeight, `${route} scroll range`).toBeGreaterThan(metrics.scroll.clientHeight)
    }
    return metrics
  }

  const navigateToMusic = async () => {
    const closeClock = page.getByRole("button", { name: "Close clock", exact: true })
    if (await closeClock.isVisible()) {
      const interruptionNotice = page.getByTestId("music-interruption-notice")
      if (await interruptionNotice.isVisible()) {
        await interruptionNotice.getByRole("button", { name: "Close", exact: true }).click()
        await expect(interruptionNotice).toBeHidden()
      }
      await closeClock.click()
      await expect(page.locator("body")).not.toHaveClass(/chimer-running/)
    }
    const link = page.getByRole("link", { name: "Open music", exact: true }).first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/music$/)
  }

  const navigateFrom = async (route: string) => {
    if (route === "music") {
      await page.locator('a[aria-label="MassageLab home"]:visible').first().click()
      await expect(page).toHaveURL(/\/$/)
      return
    }
    if (route === "home") {
      await page.getByRole("link", { name: "Open wellness", exact: true }).first().click()
      await expect(page).toHaveURL(/\/wellness$/)
      return
    }
    await page.getByRole("link", { name: "Open clock" }).click()
    await expect(page).toHaveURL(/\/clock$/)
  }

  const assertClockPanelClearsRail = async (
    viewport: { width: number, height: number },
    state: "collapsed" | "expanded",
    side: "right" | "left" = "right",
  ) => {
    const clockTrigger = page.getByRole("button", { name: "Clock", exact: true })
    const rail = await toolbar.boundingBox()
    if (!rail) throw new Error(`${viewport.width} ${state} rail geometry is unavailable`)
    const playerSpacing = await resolvedMusicRailSpacing(page)
    await clockTrigger.click()
    const panel = page.locator('[data-immersive-panel="clock"]')
    await expect(panel).toHaveAttribute("data-immersive-layout", "side")
    const panelGeometry = await panel.evaluate((surface) => {
      const bounds = surface.getBoundingClientRect()
      const actions = Array.from(surface.querySelectorAll<HTMLElement>(
        'button[aria-label], a[aria-label], input[aria-label], select[aria-label]',
      )).flatMap((action) => {
        const actionBounds = action.getBoundingClientRect()
        return actionBounds.width > 0 && actionBounds.height > 0
          ? [{ label: action.getAttribute("aria-label"), right: actionBounds.right }]
          : []
      })
      return { actions, right: bounds.right }
    })
    expect(panelGeometry.right, `${viewport.width} ${state} ${side} Clock panel clears rail`)
      .toBeLessThanOrEqual(rail.x + 1)
    if (side === "left") {
      const panelBox = await panel.boundingBox()
      expect(panelBox?.x, `${viewport.width} ${state} left-side Clock panel`).toBeLessThanOrEqual(13)
    }
    expect(panelGeometry.actions.length, `${viewport.width} ${state} Clock semantic actions`).toBeGreaterThan(0)
    for (const action of panelGeometry.actions) {
      expect(action.right, `${viewport.width} ${state} ${action.label} clears rail`)
        .toBeLessThanOrEqual(rail.x + 1)
    }
    if (side === "right") {
      await expect.poll(async () => (await measureStageReservations()).right)
        .toBeGreaterThan(playerSpacing.rightSafe)
    } else {
      await expect.poll(async () => (await measureStageReservations()).right)
        .toBeCloseTo(playerSpacing.rightSafe, 0)
      await expect.poll(async () => (await measureStageReservations()).left).toBeGreaterThan(0)
    }
    await page.keyboard.press("Escape")
    await expect(panel).toBeHidden()
    await expect(clockTrigger).toBeFocused()
    await expect.poll(async () => (await measureStageReservations()).right)
      .toBeCloseTo(playerSpacing.rightSafe, 0)
    geometryReceipt.push({ viewport, state, side, panelGeometry })
  }

  const viewports = [
    { width: 844, height: 390 },
    { width: 746, height: 284 },
  ] as const
  const routes = ["music", "home", "wellness", "clock"] as const

  for (const viewport of viewports) {
    await page.locator("html").evaluate((root) => { root.style.fontSize = "16px" })
    await page.setViewportSize(viewport)
    if (!/\/music$/.test(page.url())) await navigateToMusic()
    let expandedDiameter = 0

    for (let index = 0; index < routes.length; index += 1) {
      const route = routes[index]
      if (index === 0) {
        expandedDiameter = (await assertRailState(viewport, route, false)).vinyl.width
      } else {
        await assertRailState(viewport, route, true, expandedDiameter)
        if (route === "clock") await assertClockPanelClearsRail(viewport, "collapsed")
        const collapsedContent = route === "music" ? null : await nonMusicGeometry(viewport, route)
        await toolbar.getByRole("button", { name: "Expand", exact: true }).click()
        expandedDiameter = (await assertRailState(viewport, route, false)).vinyl.width
        if (route === "clock") await assertClockPanelClearsRail(viewport, "expanded")
        if (collapsedContent) {
          const expandedContent = await nonMusicGeometry(viewport, route)
          expect(expandedContent.content.width, `${viewport.width} ${route} state-independent width`)
            .toBeCloseTo(collapsedContent.content.width, 0)
        }
      }

      if (route === "wellness") {
        await page.locator(".ml-app-scroll").evaluate((element) => element.scrollTo({ top: 120 }))
        await expect.poll(() => page.locator(".ml-app-scroll").evaluate((element) => element.scrollTop))
          .toBeGreaterThan(0)
      }

      await toolbar.getByRole("button", { name: "Minimize", exact: true }).click()
      await assertRailState(viewport, route, true, expandedDiameter)
      if (index < routes.length - 1) {
        await navigateFrom(route)
      } else {
        await toolbar.getByRole("button", { name: "Expand", exact: true }).click()
        await assertRailState(viewport, route, false)
      }
    }

    geometryReceipt.push({ viewport, noPlayerPanelReservation })

    if (viewport.width === 844) {
      await page.locator("html").evaluate((root) => root.setAttribute("data-sidebar-position", "right"))
      await assertClockPanelClearsRail(viewport, "expanded", "left")
      await page.locator("html").evaluate((root) => root.setAttribute("data-sidebar-position", "left"))
    }

    if (viewport.width === 844) {
      await toolbar.getByRole("button", { name: "Stop", exact: true }).click()
      await toolbar.getByRole("button", { name: "Play", exact: true }).click()
      await expect(toolbar).toHaveAttribute("data-playback-state", "playing", { timeout: 45_000 })
      const clockNotice = page.getByTestId("music-interruption-notice")
      const noticeGeometry = await settledOverlayGeometry(clockNotice, toolbar, viewport, "clock interruption notice")
      expect(noticeGeometry.surface.x + noticeGeometry.surface.width)
        .toBeLessThanOrEqual(noticeGeometry.rail.x + 1)
      const settingsTrigger = toolbar.getByRole("button", { name: "Player settings" })
      await settingsTrigger.click()
      const settings = page.getByRole("menu")
      const settingsGeometry = await settledOverlayGeometry(settings, toolbar, viewport, "clock settings")
      expect(settingsGeometry.surface.x + settingsGeometry.surface.width)
        .toBeLessThanOrEqual(settingsGeometry.rail.x + 1)
      await page.keyboard.press("Escape")
      await expect(settingsTrigger).toBeFocused()
      geometryReceipt.push({ label: "clock interruption notice", ...noticeGeometry })
      geometryReceipt.push({ label: "clock settings", ...settingsGeometry })
    }
  }

  await page.locator("html").evaluate((root) => { root.style.fontSize = "20px" })
  const increasedTextViewport = { width: 746, height: 284 }
  const increasedExpanded = await assertRailState(increasedTextViewport, "clock-increased-text", false)
  expect(increasedExpanded.rail.width).toBeCloseTo(320, 0)
  await toolbar.getByRole("button", { name: "Minimize", exact: true }).click()
  await assertRailState(increasedTextViewport, "clock-increased-text", true, increasedExpanded.vinyl.width)
  await toolbar.getByRole("button", { name: "Expand", exact: true }).click()
  await assertRailState(increasedTextViewport, "clock-increased-text", false)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(toolbar).toHaveAttribute("data-layout", "bottom")
  await expect(page.locator("body")).not.toHaveClass(/ml-music-player-rail/)
  await expect(page.locator("body")).not.toHaveClass(/ml-music-player-music-route/)
  await expect.poll(async () => (await resolvedMusicRailSpacing(page)).rightSafe).toBe(0)
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const portraitClockPanel = page.locator('[data-immersive-panel="clock"]')
  await expect(portraitClockPanel).toHaveAttribute("data-immersive-layout", "dock")
  await expect.poll(async () => {
    const reservation = await measureStageReservations()
    return reservation.top + reservation.bottom
  }).toBeGreaterThan(0)
  expect((await measureStageReservations()).right).toBe(0)
  await page.getByRole("button", { name: "Close Clock panel", exact: true }).click()
  await expect.poll(async () => {
    const reservation = await measureStageReservations()
    return reservation.top + reservation.right + reservation.bottom + reservation.left
  }).toBe(0)
  const portraitClockGeometry = await page.getByRole("region", { name: "Chimer clock" }).evaluate((stage) => {
    const closeClock = stage.querySelector<HTMLElement>('[aria-label="Close clock"]')
    if (!closeClock) throw new Error("Portrait clock exit control is missing")
    const bounds = closeClock.getBoundingClientRect()
    return {
      reservedRight: Number.parseFloat(getComputedStyle(stage).getPropertyValue("--immersive-reserved-right")) || 0,
      right: bounds.right,
    }
  })
  expect(portraitClockGeometry.reservedRight).toBe(0)
  expect(portraitClockGeometry.right).toBeCloseTo(370, 0)
  geometryReceipt.push({
    viewport: "390x844-return",
    portraitClockGeometry,
    rail: await toolbar.boundingBox(),
    spacing: await resolvedMusicRailSpacing(page),
  })
  await testInfo.attach("task-15-global-rail-geometry.json", {
    body: JSON.stringify(geometryReceipt, null, 2),
    contentType: "application/json",
  })
})

test("full constrained landscape four-view matrix plus S24 class keeps controls 16px below and category pill glow clear", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Constrained Music geometry is covered in mobile Chromium.")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await installInterruptionNoticeMediaFakes(page)
  // Start from the known-roomy portrait baseline, then exercise the exact
  // constrained viewport matrix against the already-active player.
  await page.setViewportSize({ width: 390, height: 844 })
  const toolbar = await startProofDrone(page)
  const interruptionNotice = page.getByTestId("music-interruption-notice")
  const appScroll = page.locator(".ml-app-scroll")
  const carousel = page.getByRole("region", { name: "Atmosphere audio stations" })
  const carouselRegion = page.getByRole("region", { name: "Station carousel" })
  const stage = page.getByTestId("station-carousel-stage")
  const categoryLabel = page.getByText("Station category", { exact: true })
  const categoryGroup = page.getByRole("group", { name: "Station category" })
  const selectedHeading = page.getByRole("heading", { name: "Treatment room starters" })
  const selectedDescription = page.getByText(/Reliable first choices for a calm room/i)
  const nonShellCards = carousel.locator('[data-carousel-slide]:not([data-detail-level="shell"])')
  const center = carousel.locator('[data-carousel-slide][data-centered="true"]')
  const geometryReceipt: Array<Record<string, unknown>> = []

  const assertStationControlGeometry = async (label: string) => {
    const summaries = carouselRegion.locator(
      '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
    )
    await expect(carouselRegion.locator('[data-station-carousel-controls="true"]')).toBeAttached()
    await expect.poll(() => summaries.count()).toBeGreaterThanOrEqual(2)
    const readStationControlGeometry = () => carouselRegion.evaluate((region) => {
      const previousControl = region.querySelector<HTMLElement>('[aria-label="Previous station"]')
      const nextControl = region.querySelector<HTMLElement>('[aria-label="Next station"]')
      const stageElement = region.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')
      const centerElement = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )
      const summaryElements = [...region.querySelectorAll<HTMLElement>(
        '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
      )]
      if (!previousControl || !nextControl || !stageElement || !centerElement || summaryElements.length < 2) {
        return null
      }
      const readBox = (element: HTMLElement) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
      }
      const previousBox = readBox(previousControl)
      const nextBox = readBox(nextControl)
      const stageBox = readBox(stageElement)
      const centerBox = readBox(centerElement)
      const centerX = centerBox.x + centerBox.width / 2
      const candidates = summaryElements.map(readBox)
      const leftSummary = candidates
        .filter((box) => box.x + box.width / 2 < centerX)
        .sort((left, right) => right.x - left.x)[0]
      const rightSummary = candidates
        .filter((box) => box.x + box.width / 2 > centerX)
        .sort((left, right) => left.x - right.x)[0]
      if (!leftSummary || !rightSummary) return null
      const summaryBoxes = [leftSummary, rightSummary]
      return { previousBox, nextBox, stageBox, summaryBoxes }
    })
    const settledGeometry = {
      current: null as Awaited<ReturnType<typeof readStationControlGeometry>>,
    }
    await expect.poll(async () => {
      const geometry = await readStationControlGeometry()
      if (!geometry) return Number.POSITIVE_INFINITY
      settledGeometry.current = geometry
      const { previousBox, nextBox, stageBox, summaryBoxes } = geometry
      const visibleCenter = (box: { x: number, width: number }) => (
        Math.max(box.x, stageBox.x) + Math.min(
          box.x + box.width,
          stageBox.x + stageBox.width,
        )
      ) / 2
      const previousTargetTop = summaryBoxes[0].y + summaryBoxes[0].height + 16
      const nextTargetTop = summaryBoxes[1].y + summaryBoxes[1].height + 16
      const previousVerticalDeviation = previousTargetTop + previousBox.height <= stageBox.y + stageBox.height + 1
        ? Math.abs(previousBox.y - previousTargetTop)
        : 0
      const nextVerticalDeviation = nextTargetTop + nextBox.height <= stageBox.y + stageBox.height + 1
        ? Math.abs(nextBox.y - nextTargetTop)
        : 0
      return Math.max(
        previousVerticalDeviation,
        nextVerticalDeviation,
        Math.abs(previousBox.x + previousBox.width / 2 - visibleCenter(summaryBoxes[0])),
        Math.abs(nextBox.x + nextBox.width / 2 - visibleCenter(summaryBoxes[1])),
      )
    }, { message: `${label} station control geometry should settle on its visible wing centers` })
      .toBeLessThanOrEqual(1)
    if (!settledGeometry.current) throw new Error(`${label} station control geometry did not settle`)
    const { previousBox, nextBox, stageBox, summaryBoxes } = settledGeometry.current
    expect(previousBox, `${label} previous control box`).not.toBeNull()
    expect(nextBox, `${label} next control box`).not.toBeNull()
    expect(stageBox, `${label} stage box`).not.toBeNull()
    const leftSummary = summaryBoxes[0]
    const rightSummary = summaryBoxes[1]
    const visibleCenter = (box: { x: number, width: number }) => {
      const left = Math.max(box.x, stageBox?.x ?? box.x)
      const right = Math.min(
        box.x + box.width,
        (stageBox?.x ?? box.x) + (stageBox?.width ?? box.width),
      )
      return (left + right) / 2
    }
    const assertVerticalControlPlacement = (
      name: "previous" | "next",
      control: { y: number, height: number },
      summary: { y: number, height: number },
    ) => {
      const targetTop = summary.y + summary.height + 16
      const stageBottom = (stageBox?.y ?? 0) + (stageBox?.height ?? 0)
      if (targetTop + control.height <= stageBottom + 1) {
        expect(Math.abs(control.y - targetTop), `${label} ${name} vertical offset`).toBeLessThanOrEqual(1)
        return
      }
      // On the shortest landscape stages, keeping a 16px gap would put the
      // control below the usable viewport. Keep it visible and visibly tied
      // to its wing by overlapping only the card's lower edge instead.
      expect(control.y, `${label} ${name} compact overlay top`).toBeGreaterThanOrEqual(summary.y + summary.height - control.height - 1)
      expect(control.y + control.height, `${label} ${name} compact overlay bottom`).toBeLessThanOrEqual(stageBottom + 1)
    }
    assertVerticalControlPlacement("previous", previousBox!, leftSummary)
    assertVerticalControlPlacement("next", nextBox!, rightSummary)
    expect(Math.abs(
      ((previousBox?.x ?? 0) + (previousBox?.width ?? 0) / 2)
        - visibleCenter(leftSummary),
    ), `${label} previous center`).toBeLessThanOrEqual(1)
    expect(Math.abs(
      ((nextBox?.x ?? 0) + (nextBox?.width ?? 0) / 2)
        - visibleCenter(rightSummary),
    ), `${label} next center`).toBeLessThanOrEqual(1)
    for (const [name, box] of [["previous", previousBox], ["next", nextBox]] as const) {
      expect(box?.y ?? -1, `${label} ${name} stage top`).toBeGreaterThanOrEqual((stageBox?.y ?? 0) - 1)
      expect((box?.y ?? 0) + (box?.height ?? 0), `${label} ${name} stage bottom`).toBeLessThanOrEqual(
        (stageBox?.y ?? 0) + (stageBox?.height ?? 0) + 1,
      )
    }
    return { previousBox, nextBox, stageBox, summaryBoxes }
  }

  const assertContained = async (locator: Locator, container: Locator, label: string) => {
    const [box, containerBox] = await Promise.all([locator.boundingBox(), container.boundingBox()])
    expect(box, `${label} box`).not.toBeNull()
    expect(containerBox, `${label} container box`).not.toBeNull()
    expect((box?.y ?? -1), `${label} top`).toBeGreaterThanOrEqual((containerBox?.y ?? 0) - 1)
    expect(
      (box?.y ?? 0) + (box?.height ?? 0),
      `${label} bottom`,
    ).toBeLessThanOrEqual((containerBox?.y ?? 0) + (containerBox?.height ?? 0) + 1)
  }

  const readPillHaloGeometry = async (scrollToEnd = false) => categoryGroup.evaluate(
    (group, shouldScrollToEnd) => {
      if (shouldScrollToEnd) group.scrollLeft = group.scrollWidth
      const style = getComputedStyle(group)
      const groupBox = group.getBoundingClientRect()
      const shadowExtent = (shadow: string) => shadow
        .replace(/rgba?\([^)]*\)/g, "")
        .split(",")
        .filter((entry) => !entry.includes("inset"))
        .reduce((extent, entry) => {
          const lengths = [...entry.matchAll(/-?\d+(?:\.\d+)?px/g)]
            .map(([length]) => Number.parseFloat(length))
          const [, offsetY = 0, blur = 0, spread = 0] = lengths
          return {
            top: Math.max(extent.top, Math.max(0, blur + spread - offsetY)),
            bottom: Math.max(extent.bottom, Math.max(0, blur + spread + offsetY)),
          }
        }, { top: 0, bottom: 0 })
      const buttons = [...group.querySelectorAll("button")].map((button) => {
        const box = button.getBoundingClientRect()
        const buttonHalo = shadowExtent(getComputedStyle(button).boxShadow)
        const pseudoHalo = shadowExtent(getComputedStyle(button, "::after").boxShadow)
        const haloTop = Math.max(buttonHalo.top, pseudoHalo.top)
        const haloBottom = Math.max(buttonHalo.bottom, pseudoHalo.bottom)
        return {
          pressed: button.getAttribute("aria-pressed"),
          haloTop,
          haloBottom,
          paintedTop: box.top - haloTop,
          paintedBottom: box.bottom + haloBottom,
          buttonHeight: box.height,
        }
      })
      return {
        paddingTop: Number.parseFloat(style.paddingTop),
        paddingBottom: Number.parseFloat(style.paddingBottom),
        marginTop: Number.parseFloat(style.marginTop),
        marginBottom: Number.parseFloat(style.marginBottom),
        paintTop: groupBox.top,
        paintBottom: groupBox.bottom,
        netHeight: groupBox.height
          + Number.parseFloat(style.marginTop)
          + Number.parseFloat(style.marginBottom),
        scrollLeft: group.scrollLeft,
        scrollWidth: group.scrollWidth,
        clientWidth: group.clientWidth,
        buttons,
      }
    },
    scrollToEnd,
  )

  const assertPillHaloPaintSpace = async (label: string, scrollToEnd = false) => {
    const geometry = await readPillHaloGeometry(scrollToEnd)
    expect(geometry.buttons.some(({ pressed }) => pressed === "true"), `${label} selected pill`).toBe(true)
    expect(geometry.buttons.some(({ pressed }) => pressed === "false"), `${label} unselected pill`).toBe(true)
    for (const [index, button] of geometry.buttons.entries()) {
      expect(button.haloTop, `${label} pill ${index} top halo extent`).toBeGreaterThan(0)
      expect(button.haloBottom, `${label} pill ${index} bottom halo extent`).toBeGreaterThan(0)
      expect(button.paintedTop, `${label} pill ${index} painted top`).toBeGreaterThanOrEqual(
        geometry.paintTop - 1,
      )
      expect(button.paintedBottom, `${label} pill ${index} painted bottom`).toBeLessThanOrEqual(
        geometry.paintBottom + 1,
      )
    }
    expect(geometry.marginTop).toBeCloseTo(-geometry.paddingTop, 0)
    expect(geometry.marginBottom).toBeCloseTo(-geometry.paddingBottom, 0)
    expect(geometry.netHeight).toBeCloseTo(
      Math.max(...geometry.buttons.map(({ buttonHeight }) => buttonHeight)),
      0,
    )
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth)
    if (scrollToEnd) expect(geometry.scrollLeft).toBeGreaterThan(0)
    return geometry
  }

  const assertCenteredStationActionsContained = async (label: string) => {
    const actions = [
      ["Play/Stop", center.locator("[data-carousel-primary-action]")],
      ["Favorite", center.locator("[data-carousel-favorite-action]")],
      ["Details", center.locator("[data-carousel-station-details]")],
    ] as const
    for (const [name, action] of actions) {
      await expect(action, `${label} ${name}`).toBeVisible()
      await assertContained(action, center, `${label} ${name} in centered card`)
      await assertContained(action, stage, `${label} ${name} in stage`)
    }
  }

  const assertConstrainedStationStageFit = async (
    label: string,
    pillPaintSpace: Awaited<ReturnType<typeof readPillHaloGeometry>>,
  ) => {
    const [allocationBox, stageBox, centerBox, pillsBox, scrollBox, mainBarBox, stationGap] = await Promise.all([
      page.locator(".ml-atmosphere-station-stage-allocation").boundingBox(),
      stage.boundingBox(),
      center.boundingBox(),
      categoryGroup.boundingBox(),
      appScroll.boundingBox(),
      page.locator(".ml-mobile-main-bar, .ml-app-topbar").evaluateAll((bars) => {
        const visible = bars.find((bar) => {
          const box = bar.getBoundingClientRect()
          return box.width > 0 && box.height > 0 && getComputedStyle(bar).visibility !== "hidden"
        })
        if (!visible) return null
        const box = visible.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }),
      page.locator(".ml-atmosphere-station-carousel").evaluate((carouselElement) => (
        Number.parseFloat(getComputedStyle(carouselElement).rowGap)
      )),
    ])
    expect(stageBox?.y ?? 0, `${label} stage top`).toBeCloseTo(
      // Compact landscapes keep the approved 1.5rem pill-to-carousel breath,
      // which follows the active text size rather than a fixed pixel value.
      (pillsBox?.y ?? 0) + (pillsBox?.height ?? 0) + pillPaintSpace.marginBottom + stationGap,
      0,
    )
    const stageBottom = (stageBox?.y ?? 0) + (stageBox?.height ?? 0)
    const allocationBottom = (allocationBox?.y ?? 0) + (allocationBox?.height ?? 0)
    const scrollBottom = (scrollBox?.y ?? 0) + (scrollBox?.height ?? 0)
    const usableBottom = mainBarBox && mainBarBox.y > (scrollBox?.y ?? 0)
      ? Math.min(scrollBottom, mainBarBox.y)
      : scrollBottom
    expect(stageBottom, `${label} stage/allocation bottom`).toBeCloseTo(allocationBottom, 0)
    expect(allocationBottom, `${label} allocation/usable bottom`).toBeCloseTo(usableBottom, 0)
    expect(stageBottom, `${label} stage/usable bottom`).toBeCloseTo(usableBottom, 0)
    const expectedHeight = Math.min(224, Math.floor(stageBox?.height ?? 0))
    const expectedWidth = Math.round(expectedHeight * 192 / 224)
    expect(centerBox?.width ?? 0, `${label} centered card width`).toBeCloseTo(expectedWidth, 0)
    expect(centerBox?.height ?? 0, `${label} centered card height`).toBeCloseTo(expectedHeight, 0)
    await assertCenteredStationActionsContained(label)
  }

  const cases = [
    { width: 360, height: 670, layout: "bottom", showCategoryLabel: true, showSelection: false },
    { width: 746, height: 284, layout: "rail", showCategoryLabel: false, showSelection: false },
    { width: 390, height: 844, layout: "bottom", showCategoryLabel: true, showSelection: true },
    { width: 844, height: 390, layout: "rail", showCategoryLabel: false, showSelection: false },
    { width: 915, height: 412, layout: "rail", showCategoryLabel: false, showSelection: false },
  ] as const

  for (const viewport of cases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expect(toolbar).toHaveAttribute("data-layout", viewport.layout)
    if (await interruptionNotice.isVisible().catch(() => false)) {
      await interruptionNotice.getByRole("button", { name: "Close" }).click()
    }
    await expect(categoryGroup).toBeVisible()
    if (viewport.showCategoryLabel) {
      await expect(categoryLabel).toBeVisible()
    } else {
      await expect(categoryLabel).toBeAttached()
      expect(await categoryLabel.evaluate((label) => {
        const style = getComputedStyle(label)
        const box = label.getBoundingClientRect()
        return box.width <= 1 && box.height <= 1 && style.position === "absolute"
      })).toBe(true)
    }
    await expect(selectedHeading)[viewport.showSelection ? "toBeVisible" : "toBeHidden"]()
    await expect(selectedDescription)[viewport.showSelection ? "toBeVisible" : "toBeHidden"]()
    await expect(nonShellCards).toHaveCount(9)
    await expect(center).toHaveAttribute("data-carousel-item-id", "mlab-proof-drone")
    const boxes = await page.evaluate(() => {
      const selectors = {
        appScroll: ".ml-app-scroll",
        content: ".ml-app-content",
        workspace: '[data-atmosphere-workspace="rails"]',
        page: ".ml-atmosphere-workspace-page",
        carousel: ".ml-atmosphere-station-carousel",
        allocation: ".ml-atmosphere-station-stage-allocation",
        stage: '[data-testid="station-carousel-stage"]',
        controls: '[data-testid="station-carousel-controls"]',
        toolbar: '[data-testid="music-player-toolbar"]',
      }
      return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
        const element = document.querySelector(selector)
        const box = element?.getBoundingClientRect()
        return [key, box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null]
      }))
    })
    await expect(carouselRegion.getByRole("button", { name: "Previous station" })).toBeInViewport()
    await expect(carouselRegion.getByRole("button", { name: "Next station" })).toBeInViewport()
    const controlGeometry = await assertStationControlGeometry(`${viewport.width}x${viewport.height}`)

    const pillPaintSpace = await assertPillHaloPaintSpace(`${viewport.width}x${viewport.height}`)
    expect(pillPaintSpace.paddingTop).toBeGreaterThanOrEqual(32)
    expect(pillPaintSpace.paddingBottom).toBeGreaterThanOrEqual(32)
    geometryReceipt.push({ viewport, boxes, controlGeometry, pillPaintSpace })

    const scroll = await appScroll.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      overflowY: getComputedStyle(element).overflowY,
    }))
    expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight + 1)
    expect(scroll.scrollTop).toBe(0)
    expect(scroll.overflowY).toBe("hidden")
    await assertContained(carousel, appScroll, `${viewport.width}x${viewport.height} carousel`)

    if (viewport.width > viewport.height) {
      await assertConstrainedStationStageFit(
        `${viewport.width}x${viewport.height}`,
        pillPaintSpace,
      )
      for (const categoryName of [
        "Water, nature, and field textures",
        "Treatment room starters",
      ]) {
        const category = categoryGroup.getByRole("button", { name: categoryName })
        await category.click()
        await expect(category).toHaveAttribute("aria-pressed", "true")
        const logicalCardCount = await carouselRegion.locator(
          '[data-carousel-slide][role="group"]',
        ).count()
        await expect(nonShellCards).toHaveCount(logicalCardCount)
        await expect(carouselRegion).toHaveAttribute("data-carousel-ready", "true")
        const remountLabel = `${viewport.width}x${viewport.height} ${categoryName}`
        await assertStationControlGeometry(remountLabel)
        const remountPillPaintSpace = await assertPillHaloPaintSpace(remountLabel)
        await assertConstrainedStationStageFit(remountLabel, remountPillPaintSpace)
      }
    }

    await expect(center).toBeInViewport({ ratio: 0.9 })
    await assertContained(center, stage, `${viewport.width}x${viewport.height} centered card`)

    if (viewport.width === 746 && viewport.height === 284) {
      const centeredTitle = center.locator("[data-carousel-station-details] span").first()
      const titleBox = await centeredTitle.boundingBox()
      expect(titleBox, "746x284 centered station title box").not.toBeNull()
      expect(titleBox?.width ?? 0).toBeGreaterThan(0)
      expect(titleBox?.height ?? 0).toBeGreaterThan(0)
      await assertContained(centeredTitle, center, "746x284 centered station title")
      await assertContained(centeredTitle, stage, "746x284 centered station title within stage")
    }

    const centeredId = await center.getAttribute("data-carousel-item-id")
    await toolbar.getByRole("button", { name: "Minimize", exact: true }).click()
    await expect(toolbar).toHaveAttribute("data-collapsed", "true")
    await expect(center).toHaveAttribute("data-carousel-item-id", centeredId ?? "")
    await toolbar.getByRole("button", { name: "Expand", exact: true }).click()
    await expect(toolbar).toHaveAttribute("data-collapsed", "false")
    await expect(center).toHaveAttribute("data-carousel-item-id", centeredId ?? "")
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator("html").evaluate((root) => { root.style.fontSize = "20px" })
  await expect(categoryGroup).toBeVisible()
  await expect(categoryGroup.getByRole("button")).toHaveCount(7)
  const increasedTextPillGeometry = await assertPillHaloPaintSpace("390x844 increased text", true)
  expect(increasedTextPillGeometry.paddingTop).toBeGreaterThanOrEqual(40)
  expect(increasedTextPillGeometry.paddingBottom).toBeGreaterThanOrEqual(40)
  expect(await appScroll.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true)
  await page.locator("html").evaluate((root) => { root.style.fontSize = "16px" })

  await page.setViewportSize({ width: 746, height: 284 })
  await expect(toolbar).toHaveAttribute("data-layout", "rail")
  await page.locator("html").evaluate((root) => { root.style.fontSize = "20px" })
  const landscapeIncreasedTextPills = await assertPillHaloPaintSpace("746x284 increased text", true)
  await assertStationControlGeometry("746x284 increased text")
  await assertConstrainedStationStageFit("746x284 increased text", landscapeIncreasedTextPills)
  expect(await appScroll.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true)
  await page.locator("html").evaluate((root) => { root.style.fontSize = "16px" })
  const transport = toolbar.getByTestId("music-player-toolbar-rail-transport")
  const options = toolbar.getByTestId("music-player-toolbar-rail-options")
  expect(await transport.locator('button[aria-label]').evaluateAll((elements) => (
    elements.map((element) => element.getAttribute("aria-label"))
  ))).toEqual(["Previous station", "Pause", "Stop", "Next station"])
  const transportButtonRows = await transport.locator('button[aria-label]').evaluateAll((elements) => (
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { bottom: box.bottom, top: box.top }
    })
  ))
  expect(Math.max(...transportButtonRows.map(({ top }) => top))
    - Math.min(...transportButtonRows.map(({ top }) => top))).toBeLessThanOrEqual(1)
  expect(Math.max(...transportButtonRows.map(({ bottom }) => bottom))
    - Math.min(...transportButtonRows.map(({ bottom }) => bottom))).toBeLessThanOrEqual(1)
  expect(await options.locator('button[aria-label], a[aria-label]').evaluateAll((elements) => (
    elements.map((element) => element.getAttribute("aria-label"))
  ))).toEqual([
    "Player settings",
    "Favorite MassageLab Proof Drone",
    "Background",
    "Minimize",
  ])
  await expect(toolbar.getByRole("slider", { name: "Atmosphere volume" })).toHaveCount(0)
  const [transportBox, optionsBox] = await Promise.all([
    transport.boundingBox(),
    options.boundingBox(),
  ])
  expect(optionsBox?.y ?? 0).toBeGreaterThan((transportBox?.y ?? 0) + (transportBox?.height ?? 0) - 1)

  await expect(carouselRegion).toHaveAttribute("data-has-custom-controls", "true")
  const previous = carouselRegion.getByRole("button", { name: "Previous station" })
  const next = carouselRegion.getByRole("button", { name: "Next station" })
  const cards = nonShellCards
  await expect.poll(async () => {
    const [previousBox, nextBox, stageBox, visualCardBoxes] = await Promise.all([
      previous.boundingBox(),
      next.boundingBox(),
      stage.boundingBox(),
      cards.evaluateAll((elements) => elements
        .map((element) => {
          const box = element.getBoundingClientRect()
          return { x: box.x, width: box.width }
        })
        .sort((left, right) => left.x - right.x)),
    ])
    const stageCenter = (stageBox?.x ?? 0) + (stageBox?.width ?? 0) / 2
    const leftCardBox = visualCardBoxes
      .filter((box) => box.x + box.width / 2 < stageCenter)
      .sort((left, right) => right.x - left.x)[0]
    const rightCardBox = visualCardBoxes
      .filter((box) => box.x + box.width / 2 > stageCenter)
      .sort((left, right) => left.x - right.x)[0]
    if (!leftCardBox || !rightCardBox) return false
    const visibleCenter = (box: { x: number, width: number }) => {
      const left = Math.max(box.x, stageBox?.x ?? box.x)
      const right = Math.min(
        box.x + box.width,
        (stageBox?.x ?? box.x) + (stageBox?.width ?? box.width),
      )
      return (left + right) / 2
    }
    const previousDelta = Math.abs(
        ((previousBox?.x ?? 0) + (previousBox?.width ?? 0) / 2)
        - visibleCenter(leftCardBox),
      )
    const nextDelta = Math.abs(
        ((nextBox?.x ?? 0) + (nextBox?.width ?? 0) / 2)
        - visibleCenter(rightCardBox),
      )
    return previousDelta <= 0.5 && nextDelta <= 0.5
  }).toBe(true)
  await testInfo.attach("task-10-viewport-geometry.json", {
    body: JSON.stringify(geometryReceipt, null, 2),
    contentType: "application/json",
  })
})

test("Station category overflow preserves pill glow through the viewport edge", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Horizontal category overflow is covered in desktop Chromium.")
  let sawScrollableViewport = false
  for (const viewport of [
    { width: 904, height: 663 },
    { width: 1280, height: 806 },
  ]) {
    await page.setViewportSize(viewport)
    await gotoShell(page, "/music")

    const categoryGroup = page.getByRole("group", { name: "Station category" })
    await expect(categoryGroup).toBeVisible()
    const geometry = await categoryGroup.evaluate((group) => {
      const style = getComputedStyle(group)
      const groupBox = group.getBoundingClientRect()
      const buttons = [...group.querySelectorAll<HTMLElement>("button")]
      const firstBox = buttons[0]?.getBoundingClientRect()
      group.scrollLeft = group.scrollWidth
      const lastBox = buttons.at(-1)?.getBoundingClientRect()

      return {
        firstInset: firstBox ? firstBox.left - groupBox.left : 0,
        lastInset: lastBox ? groupBox.right - lastBox.right : 0,
        maskImage: style.maskImage || style.webkitMaskImage,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingRight: Number.parseFloat(style.paddingRight),
        scrollable: group.scrollWidth > group.clientWidth,
      }
    })

    sawScrollableViewport ||= geometry.scrollable
    expect(geometry.maskImage).toBe("none")
    expect(geometry.firstInset).toBeGreaterThanOrEqual(geometry.paddingLeft - 1)
    expect(geometry.lastInset).toBeGreaterThanOrEqual(geometry.paddingRight - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(sawScrollableViewport).toBe(true)
})

test("Station pills and wing cards use the complete sidebar-safe inline workspace", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Desktop sidebar edge geometry is covered in Chromium.")

  await page.setViewportSize({ width: 705, height: 748 })
  await gotoShell(page, "/music")
  const carouselRegion = page.getByRole("region", { name: "Station carousel" })

  for (const sidebarPosition of ["left", "right"] as const) {
    await page.evaluate((position) => {
      localStorage.setItem("massage-lab-settings", JSON.stringify({
        appBarPosition: "bottom",
        sidebarPosition: position,
        sidebarTriggerPosition: "bottom",
        themeMode: "dark",
      }))
    }, sidebarPosition)
    await page.reload({ waitUntil: "domcontentloaded" })

    for (const width of [705, 680]) {
      await page.setViewportSize({ width, height: 748 })
      const categoryGroup = page.getByRole("group", { name: "Station category" })
      const stage = page.getByTestId("station-carousel-stage")
      await expect(categoryGroup).toBeVisible()
      await expect(stage).toBeVisible()
      await expect(carouselRegion).toHaveAttribute("data-carousel-ready", "true")
      await expect.poll(() => carouselRegion.evaluate((region) => {
        const stage = region.getBoundingClientRect()
        const center = region.querySelector<HTMLElement>(
          '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
        )?.getBoundingClientRect()
        return center ? Math.abs(center.left + center.width / 2 - (stage.left + stage.width / 2)) : Number.POSITIVE_INFINITY
      })).toBeLessThanOrEqual(1)

      const readGeometry = () => page.evaluate(() => {
        const usable = document.querySelector<HTMLElement>(".ml-app-scroll")?.getBoundingClientRect()
        const pills = document.querySelector<HTMLElement>(".ml-atmosphere-category-pills")?.getBoundingClientRect()
        const stage = document.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')?.getBoundingClientRect()
        const center = document.querySelector<HTMLElement>(
          '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
        )?.getBoundingClientRect()
        const summaries = [...document.querySelectorAll<HTMLElement>(
          '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
        )].map((element) => element.getBoundingClientRect())
        if (!usable || !pills || !stage || !center) throw new Error("Station edge geometry is incomplete")
        const centerX = center.left + center.width / 2
        const intersection = (box: DOMRect) => Math.max(
          0,
          Math.min(box.right, stage.right) - Math.max(box.left, stage.left),
        )
        const left = summaries
          .filter((box) => box.left + box.width / 2 < centerX)
          .sort((first, second) => second.right - first.right)
        const right = summaries
          .filter((box) => box.left + box.width / 2 > centerX)
          .sort((first, second) => first.left - second.left)
        return {
          pillsLeftDelta: Math.abs(pills.left - usable.left),
          pillsRightDelta: Math.abs(pills.right - usable.right),
          visibleLeftWingCount: left.filter((box) => intersection(box) > 1).length,
          visibleRightWingCount: right.filter((box) => intersection(box) > 1).length,
          stageLeftDelta: Math.abs(stage.left - usable.left),
          stageRightDelta: Math.abs(stage.right - usable.right),
        }
      })
      await expect.poll(async () => {
        const geometry = await readGeometry()
        return Math.min(geometry.visibleLeftWingCount, geometry.visibleRightWingCount)
      }).toBeGreaterThanOrEqual(2)
      const geometry = await readGeometry()

      expect.soft(geometry.pillsLeftDelta, `${sidebarPosition} ${width}px pill left edge`).toBeLessThanOrEqual(1)
      expect.soft(geometry.pillsRightDelta, `${sidebarPosition} ${width}px pill right edge`).toBeLessThanOrEqual(1)
      expect.soft(geometry.stageLeftDelta, `${sidebarPosition} ${width}px carousel left edge`).toBeLessThanOrEqual(1)
      expect.soft(geometry.stageRightDelta, `${sidebarPosition} ${width}px carousel right edge`).toBeLessThanOrEqual(1)
      expect.soft(geometry.visibleLeftWingCount, `${sidebarPosition} ${width}px visible left wings`).toBeGreaterThanOrEqual(2)
      expect.soft(geometry.visibleRightWingCount, `${sidebarPosition} ${width}px visible right wings`).toBeGreaterThanOrEqual(2)
    }
  }
})

test("player rail keeps overlays clear of dialog, sheet, tooltip, and interruption notice", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Compact-landscape overlay geometry is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 844, height: 390 })
  const toolbar = await startProofDrone(page)
  await expect(toolbar).toHaveAttribute("data-layout", "rail")
  const geometryReceipt: Array<Record<string, number | string>> = []

  const expectClearOfRail = async (surface: Locator, label: string) => {
    const [rail, surfaceBox] = await Promise.all([toolbar.boundingBox(), surface.boundingBox()])
    expect(rail, `${label} rail box`).not.toBeNull()
    expect(surfaceBox, `${label} surface box`).not.toBeNull()
    expect.soft(
      (surfaceBox?.x ?? Number.POSITIVE_INFINITY) + (surfaceBox?.width ?? 0),
      `${label} right edge`,
    ).toBeLessThanOrEqual((rail?.x ?? Number.NEGATIVE_INFINITY) + 1)
    geometryReceipt.push({
      label,
      railLeft: rail?.x ?? Number.NaN,
      surfaceRight: (surfaceBox?.x ?? Number.NaN) + (surfaceBox?.width ?? 0),
    })
  }

  const notice = page.getByTestId("music-interruption-notice")
  await expect(notice).toBeVisible()
  await expectClearOfRail(notice, "interruption notice")

  const settingsTrigger = toolbar.getByRole("button", { name: "Player settings" })
  await settingsTrigger.click()
  const settings = page.getByRole("menu")
  await expect(settings).toBeVisible()
  await expectClearOfRail(settings, "player settings")
  await page.keyboard.press("Escape")

  const proofDrone = page.getByRole("group", { name: /MassageLab Proof Drone/ })
  const stationDetailsTrigger = proofDrone.getByRole("button", {
    name: /Show full information for MassageLab Proof Drone/i,
  })
  await stationDetailsTrigger.focus()
  await page.keyboard.press("Enter")
  const stationDialog = page.getByRole("dialog", { name: "MassageLab Proof Drone" })
  await expect(stationDialog).toBeVisible()
  await expectClearOfRail(stationDialog, "station dialog")
  await stationDialog.getByRole("button", { name: "Close" }).click()

  const previousStation = toolbar.getByRole("button", { name: "Previous station" })
  await previousStation.hover()
  const tooltip = page.getByRole("tooltip", { name: "Previous station" })
  await expect(tooltip).toBeVisible()
  await expectClearOfRail(tooltip, "player tooltip")
  await page.mouse.move(1, 1)

  // Returning to portrait clears the rail inset and restores ordinary viewport
  // centering for the same shared Dialog component.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(toolbar).toHaveAttribute("data-layout", "bottom")
  await stationDetailsTrigger.focus()
  await page.keyboard.press("Enter")
  await expect(stationDialog).toBeVisible()
  const portraitDialog = await stationDialog.boundingBox()
  expect(portraitDialog, "portrait station dialog box").not.toBeNull()
  const portraitCenter = (portraitDialog?.x ?? 0) + (portraitDialog?.width ?? 0) / 2
  expect(portraitCenter).toBeCloseTo(195, 0)
  geometryReceipt.push({ label: "portrait station dialog", surfaceCenter: portraitCenter, viewportCenter: 195 })
  await stationDialog.getByRole("button", { name: "Close" }).click()

  // The portrait drawer is the existing right Sheet fixture. Supplying the
  // inherited exclusion directly isolates the shared Sheet contract from the
  // shell's mutually exclusive portrait-drawer/landscape-rail render modes.
  await page.evaluate(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom", sidebarPosition: "right", sidebarTriggerPosition: "bottom", themeMode: "dark",
  })))
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.locator(".ml-main-bar-drawer-brand")).toHaveAttribute("data-drawer-edge", "right")
  await page.locator("body").evaluate((body) => {
    body.style.setProperty("--ml-player-right-safe", "112px")
  })
  const openNavigation = page.getByRole("button", { name: "Open navigation" })
  await openNavigation.click()
  const rightSheet = page.locator('[data-sidebar="sidebar"][data-mobile="true"]')
  await expect(rightSheet).toBeVisible()
  await expect.poll(async () => {
    const sheetBox = await rightSheet.boundingBox()
    return (sheetBox?.x ?? Number.POSITIVE_INFINITY) + (sheetBox?.width ?? 0)
  }).toBeLessThanOrEqual(279)
  const sheetBox = await rightSheet.boundingBox()
  geometryReceipt.push({
    label: "right navigation sheet",
    surfaceRight: (sheetBox?.x ?? Number.NaN) + (sheetBox?.width ?? 0),
    usableRight: 278,
  })
  await page.keyboard.press("Escape")
  await testInfo.attach("task-5-core-geometry.json", {
    body: JSON.stringify(geometryReceipt, null, 2),
    contentType: "application/json",
  })
})

test("real music rail keeps every exposed overlay and action inside the usable viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Compact-landscape overlay geometry is covered in mobile Chromium.")
  test.setTimeout(120_000)
  await installInterruptionNoticeMediaFakes(page)
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom",
    // The production Calendar drawer opens on the right, opposite this edge.
    sidebarPosition: "left",
    sidebarTriggerPosition: "bottom",
    themeMode: "dark",
  })))

  const geometryReceipt: Array<Record<string, number | string>> = []
  type ExpectedSurfaceAction = {
    label: string
    locator: Locator
  }
  const assertSurfaceClear = async (
    surface: Locator,
    toolbar: Locator,
    viewport: { width: number, height: number },
    label: string,
    expectedActions: ExpectedSurfaceAction[],
  ) => {
    await expect(surface, `${label} visible`).toBeVisible()
    const { rail, surface: surfaceBox } = await settledOverlayGeometry(surface, toolbar, viewport, label)
    expect(surfaceBox.x, `${label} left edge`).toBeGreaterThanOrEqual(0)
    expect(surfaceBox.y, `${label} top edge`).toBeGreaterThanOrEqual(0)
    expect(
      surfaceBox.x + surfaceBox.width,
      `${label} right edge`,
    ).toBeLessThanOrEqual(rail.x + 1)
    expect(
      surfaceBox.y + surfaceBox.height,
      `${label} bottom edge`,
    ).toBeLessThanOrEqual(viewport.height + 1)

    const semanticActions = surface.locator([
      "button",
      "a[href]",
      "input:not([type='hidden'])",
      "select",
      "textarea",
      "[role='button']",
      "[role='link']",
      "[role='checkbox']",
      "[role='menuitem']",
      "[role='menuitemcheckbox']",
      "[role='menuitemradio']",
      "[role='option']",
      "[role='radio']",
      "[role='slider']",
      "[role='spinbutton']",
      "[role='switch']",
      "[role='tab']",
      "[role='textbox']",
    ].join(", "))
    await expect(semanticActions, `${label} semantic action set`).toHaveCount(expectedActions.length)

    for (const expectedAction of expectedActions) {
      const actionLabel = `${label} action ${expectedAction.label}`
      await expect(expectedAction.locator, `${actionLabel} count`).toHaveCount(1)
      await expect(expectedAction.locator, `${actionLabel} visible`).toBeVisible()
      const actionBox = await expectedAction.locator.boundingBox()
      expect(actionBox, `${actionLabel} box`).not.toBeNull()
      expect(actionBox?.width ?? 0, `${actionLabel} width`).toBeGreaterThan(0)
      expect(actionBox?.height ?? 0, `${actionLabel} height`).toBeGreaterThan(0)
      expect(actionBox?.x ?? -1, `${actionLabel} left`).toBeGreaterThanOrEqual(0)
      expect(actionBox?.y ?? -1, `${actionLabel} top`).toBeGreaterThanOrEqual(0)
      expect(
        (actionBox?.x ?? Number.POSITIVE_INFINITY) + (actionBox?.width ?? 0),
        `${actionLabel} right`,
      ).toBeLessThanOrEqual(rail.x + 1)
      expect(
        (actionBox?.y ?? Number.POSITIVE_INFINITY) + (actionBox?.height ?? 0),
        `${actionLabel} bottom`,
      ).toBeLessThanOrEqual(viewport.height + 1)
      geometryReceipt.push({
        label: actionLabel,
        viewport: `${viewport.width}x${viewport.height}`,
        railLeft: rail.x,
        surfaceLeft: actionBox?.x ?? Number.NaN,
        surfaceTop: actionBox?.y ?? Number.NaN,
        surfaceRight: (actionBox?.x ?? Number.NaN) + (actionBox?.width ?? 0),
        surfaceBottom: (actionBox?.y ?? Number.NaN) + (actionBox?.height ?? 0),
      })
    }

    geometryReceipt.push({
      label,
      viewport: `${viewport.width}x${viewport.height}`,
      railLeft: rail.x,
      surfaceLeft: surfaceBox.x,
      surfaceTop: surfaceBox.y,
      surfaceRight: surfaceBox.x + surfaceBox.width,
      surfaceBottom: surfaceBox.y + surfaceBox.height,
    })
  }

  for (const viewport of [{ width: 844, height: 390 }, { width: 746, height: 284 }]) {
    await page.setViewportSize(viewport)
    const toolbar = await startProofDrone(page)
    await expect(toolbar).toHaveAttribute("data-layout", "rail")

    for (const collapsed of [false, true]) {
      if (collapsed) {
        await toolbar.getByRole("button", { name: "Minimize", exact: true }).click()
        await expect(toolbar).toHaveAttribute("data-collapsed", "true")
      }
      const state = collapsed ? "collapsed" : "expanded"

      const interruptionNotice = page.getByTestId("music-interruption-notice")
      await assertSurfaceClear(
        interruptionNotice,
        toolbar,
        viewport,
        `${state} interruption notice`,
        [
          {
            label: "Resume automatically when the interruption ends checkbox",
            locator: interruptionNotice.getByRole("checkbox", {
              name: "Resume automatically when the interruption ends",
            }),
          },
          {
            label: "Close button",
            locator: interruptionNotice.getByRole("button", { name: "Close", exact: true }),
          },
        ],
      )

      if (!collapsed) {
        const settingsTrigger = toolbar.getByRole("button", { name: "Player settings" })
        await settingsTrigger.click()
        const settings = page.getByRole("menu")
        await assertSurfaceClear(settings, toolbar, viewport, `${state} player settings`, [
          {
            label: "Resume after interruptions menu checkbox",
            locator: settings.getByRole("menuitemcheckbox", { name: "Resume after interruptions" }),
          },
        ])
        await page.keyboard.press("Escape")
        await expect(settings).toBeHidden()
        await expect(settingsTrigger, `${state} settings focus return`).toBeFocused()
      }

      const proofDrone = page.getByRole("group", { name: /MassageLab Proof Drone/ })
      const stationDetailsTrigger = proofDrone.getByRole("button", {
        name: /Show full information for MassageLab Proof Drone/i,
      })
      await stationDetailsTrigger.focus()
      await page.keyboard.press("Enter")
      const stationDialog = page.getByRole("dialog", { name: "MassageLab Proof Drone" })
      await assertSurfaceClear(stationDialog, toolbar, viewport, `${state} station dialog`, [
        {
          label: "MassageLab source link",
          locator: stationDialog.getByRole("link", {
            name: "MassageLab · MassageLab internal proof",
            exact: true,
          }),
        },
        {
          label: "Close button",
          locator: stationDialog.getByRole("button", { name: "Close", exact: true }),
        },
      ])
      await page.keyboard.press("Escape")
      await expect(stationDialog).toBeHidden()
      await expect(stationDetailsTrigger, `${state} station dialog focus return`).toBeFocused()

      // At the desktop-toolbar breakpoint the production Calendar control is
      // the exposed right Sheet. The 746px compact-rail shell has no Sheet:
      // its navigation control toggles the persistent sidebar rail instead.
      if (viewport.width >= 768) {
        const sheetTrigger = page.getByRole("button", { name: "Open calendar" })
        await sheetTrigger.click()
        const rightSheet = page.locator('[data-ml-player-viewport-side="right"]')
        await assertSurfaceClear(rightSheet, toolbar, viewport, `${state} right Sheet`, [
          {
            label: "Sign in link",
            locator: rightSheet.getByRole("link", { name: "Sign in", exact: true }),
          },
          {
            label: "Close button",
            locator: rightSheet.getByRole("button", { name: "Close", exact: true }),
          },
        ])
        await page.keyboard.press("Escape")
        await expect(rightSheet).toBeHidden()
        await expect(sheetTrigger, `${state} right Sheet focus return`).toBeFocused()
      }

      const tooltipTrigger = collapsed
        ? toolbar.getByRole("button", { name: "Expand", exact: true })
        : toolbar.getByRole("button", { name: "Previous station" })
      await tooltipTrigger.hover()
      const tooltip = page.locator('[data-radix-popper-content-wrapper]').filter({
        hasText: collapsed ? "Expand" : "Previous station",
      })
      await assertSurfaceClear(tooltip, toolbar, viewport, `${state} player tooltip`, [])
      await page.keyboard.press("Escape")
      await expect(tooltip).toBeHidden()

      if (collapsed) {
        await toolbar.getByRole("button", { name: "Expand", exact: true }).click()
        await expect(toolbar).toHaveAttribute("data-collapsed", "false")
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  const portraitToolbar = page.getByTestId("music-player-toolbar")
  await expect(portraitToolbar).toHaveAttribute("data-layout", "bottom")
  await expect.poll(async () => (await resolvedMusicRailSpacing(page)).rightSafe).toBe(0)
  const portraitStationTrigger = page.getByRole("group", { name: /MassageLab Proof Drone/ }).getByRole("button", {
    name: /Show full information for MassageLab Proof Drone/i,
  })
  await portraitStationTrigger.focus()
  await page.keyboard.press("Enter")
  const portraitDialog = page.getByRole("dialog", { name: "MassageLab Proof Drone" })
  await expect(portraitDialog).toBeVisible()
  const portraitDialogBox = await portraitDialog.boundingBox()
  expect(portraitDialogBox, "portrait station dialog box").not.toBeNull()
  expect((portraitDialogBox?.x ?? 0) + (portraitDialogBox?.width ?? 0) / 2).toBeCloseTo(195, 0)
  expect(portraitDialogBox?.y ?? -1).toBeGreaterThanOrEqual(0)
  expect((portraitDialogBox?.y ?? 0) + (portraitDialogBox?.height ?? 0)).toBeLessThanOrEqual(845)
  await page.keyboard.press("Escape")
  await expect(portraitDialog).toBeHidden()
  await expect(portraitStationTrigger).toBeFocused()

  const homeLink = page.locator('a[aria-label="MassageLab home"]:visible').first()
  await homeLink.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(portraitToolbar).toHaveAttribute("data-layout", "bottom")
  await expect(page.locator("body")).not.toHaveClass(/ml-music-player-music-route/)
  await expect.poll(async () => (await resolvedMusicRailSpacing(page)).rightSafe).toBe(0)

  await testInfo.attach("task-11-real-rail-overlay-geometry.json", {
    body: JSON.stringify(geometryReceipt, null, 2),
    contentType: "application/json",
  })
})

test("player rail keeps overlays clear in the popover fixture", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Compact-landscape overlay geometry is covered in mobile Chromium.")
  // The development gallery is the existing real Popover fixture. Positioning
  // its trigger at the physical right edge makes the inherited exclusion
  // observable without adding test-only production components.
  await page.setViewportSize({ width: 844, height: 390 })
  const response = await page.goto("/dev/buttons", { waitUntil: "domcontentloaded" })
  test.skip(
    await isDevelopmentReviewUnavailable(page, response?.status()),
    "The real Popover fixture is intentionally development-only.",
  )
  await expect(page.getByRole("heading", { name: "Control system review" })).toBeVisible()
  await page.locator("body").evaluate((body) => {
    body.style.setProperty("--ml-player-right-safe", "320px")
  })
  await page.getByRole("tab", { name: "Navigation & surfaces" }).click()
  const popoverTrigger = page.getByRole("button", { name: "Open popover" })
  await popoverTrigger.evaluate((trigger) => {
    trigger.style.position = "fixed"
    trigger.style.right = "0"
    trigger.style.top = "96px"
    trigger.style.zIndex = "100"
  })
  await popoverTrigger.click()
  const popover = page.getByText("Shared popover surface").locator("..")
  await expect(popover).toBeVisible()
  const popoverBox = await popover.boundingBox()
  expect(popoverBox, "popover fixture box").not.toBeNull()
  expect.soft(
    (popoverBox?.x ?? Number.POSITIVE_INFINITY) + (popoverBox?.width ?? 0),
    "popover right edge",
  ).toBeLessThanOrEqual(525)
  await testInfo.attach("task-5-popover-geometry.json", {
    body: JSON.stringify({
      surfaceRight: (popoverBox?.x ?? Number.NaN) + (popoverBox?.width ?? 0),
      usableRight: 524,
    }, null, 2),
    contentType: "application/json",
  })
})

test("player rail keeps overlays clear while preserving caller collision padding", () => {
  expect(withPlayerViewportCollisionPadding(undefined, 0)).toBeUndefined()
  expect(withPlayerViewportCollisionPadding(undefined, 20)).toEqual({
    top: 8, right: 28, bottom: 8, left: 8,
  })
  expect(withPlayerViewportCollisionPadding(5, 20)).toEqual({
    top: 5, right: 25, bottom: 5, left: 5,
  })
  expect(withPlayerViewportCollisionPadding(
    { top: 1, right: 2, bottom: 3, left: 4 },
    20,
  )).toEqual({ top: 1, right: 22, bottom: 3, left: 4 })
  expect(withPlayerViewportCollisionPadding({ top: 0, bottom: 6 }, 20)).toEqual({
    top: 0, right: 20, bottom: 6,
  })
  expect(withPlayerViewportCollisionPadding(
    { top: 1, right: 2, bottom: 3, left: 4 },
    0,
  )).toEqual({ top: 1, right: 2, bottom: 3, left: 4 })
})

test("portrait station cards rebalance across expanded collapsed stopped and restarted player state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Portrait station geometry is covered in mobile Chromium.")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await installInterruptionNoticeMediaFakes(page)
  await installStationCapabilityQueries(page, { reducedMotion: false, finePointer: false })
  await installAtmosphereFavorites(page, [
    "generative-fm-trees",
    "observable-streams-probe",
    "mlab-proof-drone",
    "generative-fm-aisatsana",
  ])
  const receipt: Array<Record<string, unknown>> = []

  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 670 }]) {
    await page.setViewportSize(viewport)
    const toolbar = await startProofDrone(page)
    const carousel = page.getByRole("region", { name: "Station carousel" })
    const readCards = async (state: string) => {
      await expect(carousel.locator('[data-carousel-slide]:not([data-detail-level="shell"])')).toHaveCount(9)
      const box = await carousel.locator(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      ).evaluate((element) => {
        const rectangle = element.getBoundingClientRect()
        return { width: rectangle.width, height: rectangle.height }
      })
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
      expect(box.width / box.height).toBeCloseTo(192 / 224, 2)
      if (viewport.width === 390 && viewport.height === 844) {
        const mosaic = page.getByTestId("atmosphere-favorites-mosaic")
        await expect(mosaic).toBeVisible()
        const mosaicBox = await mosaic.boundingBox()
        expect(mosaicBox?.width).toBeCloseTo(mosaicBox?.height ?? 0, 0)
        expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
      }
      receipt.push({ viewport, state, box })
      return box
    }

    const expanded = await readCards("expanded")
    await toolbar.getByRole("button", { name: "Minimize", exact: true }).click()
    await expect(toolbar).toHaveAttribute("data-collapsed", "true")
    const collapsed = await readCards("collapsed")
    await toolbar.getByRole("button", { name: "Expand", exact: true }).click()
    await expect(toolbar).toHaveAttribute("data-collapsed", "false")
    await toolbar.getByRole("button", { name: "Stop", exact: true }).click()
    await expect(toolbar).toHaveAttribute("data-playback-state", "stopped")
    const stopped = await readCards("stopped")
    await toolbar.getByRole("button", { name: "Play", exact: true }).click()
    await expect(toolbar).toHaveAttribute("data-playback-state", /loading|playing/)
    const restarted = await readCards("restarted")
    // Collapsing the bottom player returns vertical workspace to Atmosphere,
    // so the balance-fill rule may enlarge the carousel. Playback state alone
    // does not change the expanded player's allocation.
    expect(collapsed.width).toBeGreaterThanOrEqual(expanded.width)
    expect(collapsed.height).toBeGreaterThanOrEqual(expanded.height)
    for (const box of [stopped, restarted]) {
      expect(Math.abs(box.width - expanded.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(box.height - expanded.height)).toBeLessThanOrEqual(1)
    }
    await toolbar.getByRole("button", { name: "Stop", exact: true }).click()
  }
  await testInfo.attach("task-20-portrait-card-geometry.json", {
    body: JSON.stringify(receipt, null, 2),
    contentType: "application/json",
  })
})

test("roomy portrait composes a square Favorites mosaic without changing the station carousel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Portrait Favorites geometry is covered in mobile Chromium.")
  await installAtmosphereFavorites(page, [
    "generative-fm-trees",
    "observable-streams-probe",
    "mlab-proof-drone",
    "generative-fm-aisatsana",
  ])
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel.locator(
    '[data-carousel-slide="true"][data-carousel-loop-clone="true"][aria-hidden="true"]',
  )).toHaveCount(8)
  await expect(carousel.locator(
    '[data-carousel-slide="true"][role="group"]',
  )).toHaveCount(9)
  const centered = carousel.locator('[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]')
  const favorites = page.getByRole("region", { name: "Favorites" })
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")
  await expect(favorites.getByRole("heading")).toHaveCount(0)
  await expect(mosaic.locator('[data-favorite-destination="station"]')).toHaveCount(4)
  const mosaicBox = await mosaic.boundingBox()
  expect(mosaicBox?.width).toBeCloseTo(mosaicBox?.height ?? 0, 0)
  await expectFavoritesMosaicTracksCenteredCard(mosaic, centered)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  const approvedCardBox = await centered.boundingBox()
  expect(approvedCardBox?.width ?? 0).toBeGreaterThanOrEqual(204)
  expect(approvedCardBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(218)
  expect((approvedCardBox?.width ?? 0) / (approvedCardBox?.height ?? 1)).toBeCloseTo(192 / 224, 2)

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.getByTestId("atmosphere-favorites-region")).toBeHidden()
})

test("Favorites use measured remaining space across roomy bottom-rail workspaces", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== mobileProject && testInfo.project.name !== desktopProject,
    "Favorites workspace geometry is covered in desktop and mobile Chromium.",
  )
  await installInterruptionNoticeMediaFakes(page)
  await installAtmosphereFavorites(page, [
    "generative-fm-trees",
    "observable-streams-probe",
    "mlab-proof-drone",
    "generative-fm-aisatsana",
  ])
  const roomyViewports = testInfo.project.name === mobileProject
    ? [{ width: 535, height: 980 }, { width: 770, height: 1026 }]
    : [
      { width: 1140, height: 970 },
      { width: 1460, height: 1095 },
      { width: 2048, height: 1280 },
    ]
  await page.setViewportSize(roomyViewports[0])
  const toolbar = await startProofDrone(page)
  const carousel = page.getByRole("region", { name: "Station carousel" })
  const favorites = page.getByTestId("atmosphere-favorites-region")
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")
  let previousVisibleCardCount = 0

  for (const viewport of roomyViewports) {
    await page.setViewportSize(viewport)
    await expect(toolbar).toHaveAttribute("data-layout", "bottom")
    await expect(favorites).toBeVisible()
    await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
    const readMosaicGeometry = () => mosaic.evaluate((element) => {
      const mosaic = element.getBoundingClientRect()
      const slot = element.parentElement?.parentElement?.getBoundingClientRect()
      const center = element.closest(".ml-atmosphere-carousel-workspace")
        ?.querySelector<HTMLElement>(
          '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
        )
        ?.getBoundingClientRect()
      return {
        centerGap: center ? mosaic.top - center.bottom : Number.NEGATIVE_INFINITY,
        height: mosaic.height,
        left: mosaic.left,
        slotBottomGap: slot ? slot.bottom - mosaic.bottom : Number.NEGATIVE_INFINITY,
        slotCenter: slot ? slot.left + (slot.width / 2) : 0,
        width: mosaic.width,
      }
    })
    let geometry = await readMosaicGeometry()
    await expect.poll(async () => {
      geometry = await readMosaicGeometry()
      return geometry.centerGap >= 1
        && geometry.slotBottomGap >= 1
        && geometry.centerGap + geometry.slotBottomGap >= 7
        && Math.abs(geometry.centerGap - geometry.slotBottomGap) <= 3
    }).toBe(true)
    expect(geometry.centerGap).toBeGreaterThanOrEqual(1)
    expect(geometry.slotBottomGap).toBeGreaterThanOrEqual(1)
    expect(geometry.centerGap + geometry.slotBottomGap).toBeGreaterThanOrEqual(7)
    expect(
      Math.abs(geometry.centerGap - geometry.slotBottomGap),
      JSON.stringify({ viewport, ...geometry }),
    ).toBeLessThanOrEqual(3)
    expect(geometry.width).toBeCloseTo(geometry.height, 0)
    expect(geometry.left + (geometry.width / 2)).toBeCloseTo(geometry.slotCenter, 0)
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
    await expect(favorites.getByRole("heading")).toHaveCount(0)

    // Embla applies its post-resize snap on the next frame. Assert the
    // completed geometry rather than sampling its intentional transition.
    await expect.poll(() => carousel.evaluate((region) => {
      const stage = region.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )
      if (!stage || !center) return Number.POSITIVE_INFINITY
      const stageBox = stage.getBoundingClientRect()
      const centerBox = center.getBoundingClientRect()
      return Math.abs(
        centerBox.left + (centerBox.width / 2) - (stageBox.left + (stageBox.width / 2)),
      )
    })).toBeLessThanOrEqual(1)
    await waitForStableSlideGeometry(
      carousel.locator('[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]'),
      `Roomy Station center at ${viewport.width}x${viewport.height}`,
    )

    const carouselGeometry = await carousel.evaluate((region) => {
      const stage = region.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )
      const artwork = center?.querySelector<HTMLElement>("[data-carousel-artwork]")
      const cards = [...region.querySelectorAll<HTMLElement>(
        '[data-carousel-slide]:not([data-detail-level="shell"]) [data-carousel-transform="true"]',
      )]
      const summaries = [...region.querySelectorAll<HTMLElement>(
        '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
      )]
      if (!stage || !center || !artwork) throw new Error("Roomy Station carousel geometry is incomplete")
      const stageBox = stage.getBoundingClientRect()
      const centerBox = center.getBoundingClientRect()
      const artworkBox = artwork.getBoundingClientRect()
      const visibleSummaries = summaries.filter((summary) => {
        const box = summary.getBoundingClientRect()
        const visibleWidth = Math.max(0, Math.min(box.right, stageBox.right) - Math.max(box.left, stageBox.left))
        return visibleWidth >= Math.min(48, box.width * 0.25)
      })
      const centerX = centerBox.left + centerBox.width / 2
      const nearestLeft = summaries
        .map((summary) => summary.getBoundingClientRect())
        .filter((box) => box.left + box.width / 2 < centerX)
        .sort((first, second) => second.right - first.right)[0]
      const nearestRight = summaries
        .map((summary) => summary.getBoundingClientRect())
        .filter((box) => box.left + box.width / 2 > centerX)
        .sort((first, second) => first.left - second.left)[0]
      if (!nearestLeft || !nearestRight) throw new Error("Roomy Station carousel wings are incomplete")
      return {
        artwork: { height: artworkBox.height, width: artworkBox.width },
        center: { height: centerBox.height, left: centerBox.left, width: centerBox.width },
        centerContained: centerBox.left >= stageBox.left - 1
          && centerBox.right <= stageBox.right + 1
          && centerBox.top >= stageBox.top - 1
          && centerBox.bottom <= stageBox.bottom + 1,
        centered: Math.abs(centerX - (stageBox.left + stageBox.width / 2)),
        mountedCardCount: cards.length,
        nearestWingGaps: {
          left: centerBox.left - nearestLeft.right,
          right: nearestRight.left - centerBox.right,
        },
        summaryCount: summaries.length,
        visiblyComposedCards: 1 + visibleSummaries.length,
      }
    })
    expect(carouselGeometry.mountedCardCount).toBe(9)
    expect(carouselGeometry.summaryCount).toBe(8)
    expect(carouselGeometry.center.width / carouselGeometry.center.height).toBeCloseTo(192 / 224, 2)
    expect(carouselGeometry.artwork.width / carouselGeometry.artwork.height).toBeCloseTo(1, 2)
    expect(carouselGeometry.centerContained).toBe(true)
    expect(carouselGeometry.centered).toBeLessThanOrEqual(1)
    await expectFavoritesMosaicTracksCenteredCard(
      mosaic,
      carousel.locator('[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]'),
    )
    // Portrait keeps the approved centered card plus its two adjacent wings;
    // wider desktop stages retain the established five-card composition.
    expect(carouselGeometry.visiblyComposedCards).toBeGreaterThanOrEqual(
      testInfo.project.name === mobileProject ? 3 : 5,
    )
    expect(carouselGeometry.visiblyComposedCards).toBeGreaterThanOrEqual(previousVisibleCardCount)
    previousVisibleCardCount = carouselGeometry.visiblyComposedCards
    if (testInfo.project.name === desktopProject) {
      expect(carouselGeometry.nearestWingGaps.left).toBeGreaterThanOrEqual(4)
      expect(carouselGeometry.nearestWingGaps.right).toBeGreaterThanOrEqual(4)
    } else {
      // The approved portrait stage uses controlled overlap for depth, while
      // keeping the adjacent wings visibly balanced around the center card.
      expect(Math.abs(
        carouselGeometry.nearestWingGaps.left - carouselGeometry.nearestWingGaps.right,
      )).toBeLessThanOrEqual(1)
    }
  }

  if (testInfo.project.name === mobileProject) {
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(toolbar).toHaveAttribute("data-layout", "rail")
    await expect(favorites).toBeHidden()
  }
})

test("Favorites use measured remaining space before any player rail exists", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== mobileProject && testInfo.project.name !== desktopProject,
    "Inactive Favorites workspace geometry is covered in desktop and mobile Chromium.",
  )
  await installAtmosphereFavorites(page, [
    "generative-fm-trees",
    "observable-streams-probe",
    "mlab-proof-drone",
    "generative-fm-aisatsana",
  ])
  const roomyViewports = testInfo.project.name === mobileProject
    ? [
      // Surface Duo portrait boundary reported from device emulation.
      { width: 540, height: 720 },
      { width: 535, height: 951 },
      { width: 770, height: 1026 },
    ]
    : [
      // Approximate the user's screenshot-sized window at 130% browser zoom.
      { width: 669, height: 748 },
      { width: 870, height: 972 },
      { width: 1162, height: 972 },
      // Roomy desktop boundary reported at 90% browser zoom.
      { width: 1420, height: 972 },
      { width: 1420, height: 1000 },
      { width: 1578, height: 1080 },
    ]
  await page.setViewportSize(roomyViewports[0])
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const favorites = page.getByTestId("atmosphere-favorites-region")
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")

  for (const viewport of roomyViewports) {
    await page.setViewportSize(viewport)
    await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
    const fitGeometry = await carousel.evaluate((region, balancedFillRatio) => {
      const slot = region.closest<HTMLElement>(".ml-atmosphere-carousel-slot")
      const stationSurface = region.closest<HTMLElement>(".ml-atmosphere-station-carousel")
      const workspace = region.closest<HTMLElement>(".ml-atmosphere-carousel-workspace")
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )
      if (!slot || !stationSurface || !workspace || !center) {
        throw new Error("Inactive Favorites fit geometry is incomplete")
      }
      const slotBox = slot.getBoundingClientRect()
      const centerBox = center.getBoundingClientRect()
      const centeredCardBottom = centerBox.bottom - slotBox.top
      return {
        maximumFittingEdge: Math.min(
          slotBox.width * balancedFillRatio,
          slotBox.height - centeredCardBottom - 8,
        ),
        constrainedLandscape: stationSurface.dataset.constrainedLandscape,
        fitState: workspace.dataset.favoritesFit,
      }
    }, FAVORITES_BALANCED_FILL_RATIO)
    expect(fitGeometry.constrainedLandscape, JSON.stringify(fitGeometry)).toBe("false")
    expect(fitGeometry.maximumFittingEdge, JSON.stringify(fitGeometry)).toBeGreaterThanOrEqual(192)
    expect(fitGeometry.fitState, JSON.stringify(fitGeometry)).toBe("true")
    await expect(favorites).toBeVisible()
    await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
    await expect(mosaic.locator('[data-favorite-destination="station"]')).toHaveCount(4)
    await expect.poll(() => carousel.evaluate((region) => {
      const stage = region.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )
      if (!stage || !center) return Number.POSITIVE_INFINITY
      const stageBox = stage.getBoundingClientRect()
      const centerBox = center.getBoundingClientRect()
      return Math.abs(
        centerBox.left + (centerBox.width / 2) - (stageBox.left + (stageBox.width / 2)),
      )
    })).toBeLessThanOrEqual(1)
    const readMosaicGeometry = () => mosaic.evaluate((element) => {
      const mosaic = element.getBoundingClientRect()
      const workspace = element.closest<HTMLElement>(".ml-atmosphere-carousel-workspace")
      const outerSlot = workspace?.parentElement?.getBoundingClientRect()
      const center = workspace?.querySelector<HTMLElement>(
          '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
        )
        ?.getBoundingClientRect()
      return {
        centerGap: center ? mosaic.top - center.bottom : Number.NEGATIVE_INFINITY,
        height: mosaic.height,
        left: mosaic.left,
        slotBottomGap: outerSlot ? outerSlot.bottom - mosaic.bottom : Number.NEGATIVE_INFINITY,
        slotCenter: outerSlot ? outerSlot.left + (outerSlot.width / 2) : 0,
        width: mosaic.width,
      }
    })
    await expect.poll(async () => {
      const geometry = await readMosaicGeometry()
      return Math.abs(geometry.centerGap - geometry.slotBottomGap) <= 1
    }).toBe(true)
    const geometry = await readMosaicGeometry()
    expect(geometry.centerGap).toBeGreaterThanOrEqual(4)
    expect(geometry.slotBottomGap).toBeGreaterThanOrEqual(4)
    expect(
      Math.abs(geometry.centerGap - geometry.slotBottomGap),
      JSON.stringify({ viewport, ...geometry }),
    ).toBeLessThanOrEqual(1)
    expect(geometry.width).toBeCloseTo(geometry.height, 0)
    expect(geometry.left + (geometry.width / 2)).toBeCloseTo(geometry.slotCenter, 0)
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
    const cardGeometry = await carousel.evaluate((region) => {
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )
      const artwork = center?.querySelector<HTMLElement>("[data-carousel-artwork]")
      if (!center || !artwork) throw new Error("Inactive Favorites carousel geometry is incomplete")
      const centerBox = center.getBoundingClientRect()
      const artworkBox = artwork.getBoundingClientRect()
      return {
        artwork: { height: artworkBox.height, width: artworkBox.width },
        center: { height: centerBox.height, width: centerBox.width },
      }
    })
    expect(cardGeometry.center.width / cardGeometry.center.height).toBeCloseTo(192 / 224, 2)
    expect(cardGeometry.artwork.width / cardGeometry.artwork.height).toBeCloseTo(1, 2)
    await expectFavoritesMosaicTracksCenteredCard(
      mosaic,
      carousel.locator('[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]'),
    )
  }

  if (testInfo.project.name === mobileProject) {
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
    await expect(favorites).toBeHidden()
  }
})

test("Favorites retain measured workspace authority at enlarged root text sizes", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== mobileProject && testInfo.project.name !== desktopProject,
    "Scaled inactive Favorites workspace geometry is covered in desktop and mobile Chromium.",
  )
  await installAtmosphereFavorites(page, [
    "generative-fm-trees",
    "observable-streams-probe",
    "mlab-proof-drone",
    "generative-fm-aisatsana",
  ])
  const roomyViewports = testInfo.project.name === mobileProject
    ? [{ width: 535, height: 951 }, { width: 770, height: 1026 }]
    : [{ width: 1162, height: 972 }]
  await page.setViewportSize(roomyViewports[0])
  await gotoShell(page, "/music")
  await page.evaluate(() => { document.documentElement.style.fontSize = "24px" })

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const favorites = page.getByTestId("atmosphere-favorites-region")
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")

  for (const viewport of roomyViewports) {
    await page.setViewportSize(viewport)
    await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
    const media = await page.evaluate(() => ({
      legacyViewportQueryMatches: matchMedia("(min-height: 44.01rem)").matches,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
    }))
    expect(media.rootFontSize).toBe("24px")
    // The retired viewport query would still match: media-query rem units use
    // the initial root size. The live visibility decision must instead be the
    // slot's measured geometry.
    expect(media.legacyViewportQueryMatches).toBe(true)
    await expect(favorites).toBeVisible()
    await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
    await expect(mosaic.locator('[data-favorite-destination="station"]')).toHaveCount(4)
    const geometry = await mosaic.evaluate((element) => {
      const mosaic = element.getBoundingClientRect()
      const slot = element.parentElement?.parentElement?.getBoundingClientRect()
      return {
        height: mosaic.height,
        left: mosaic.left,
        slotCenter: slot ? slot.left + (slot.width / 2) : 0,
        width: mosaic.width,
      }
    })
    expect(geometry.width).toBeCloseTo(geometry.height, 0)
    expect(geometry.left + (geometry.width / 2)).toBeCloseTo(geometry.slotCenter, 0)
    await expectFavoritesMosaicTracksCenteredCard(
      mosaic,
      carousel.locator('[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]'),
    )
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  }

  if (testInfo.project.name === mobileProject) {
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
    await expect(favorites).toBeHidden()
  }
})

test("Favorites use slot measurement below the legacy viewport-height cutoff", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== mobileProject && testInfo.project.name !== desktopProject,
    "Compact-height Favorites workspace geometry is covered in desktop and mobile Chromium.",
  )
  await installAtmosphereFavorites(page, [
    "generative-fm-trees",
    "observable-streams-probe",
    "mlab-proof-drone",
    "generative-fm-aisatsana",
  ])
  const viewport = testInfo.project.name === mobileProject
    ? { width: 770, height: 700 }
    : { width: 1162, height: 700 }
  await page.setViewportSize(viewport)
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const favorites = page.getByTestId("atmosphere-favorites-region")
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")
  await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
  expect(await page.evaluate(() => matchMedia("(min-height: 44.01rem)").matches)).toBe(false)
  await expect(favorites).toBeVisible()
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await expect(mosaic.locator('[data-favorite-destination="station"]')).toHaveCount(4)
  const readGeometry = () => mosaic.evaluate((element) => {
    const mosaic = element.getBoundingClientRect()
    const slot = element.parentElement?.parentElement?.getBoundingClientRect()
    return {
      height: mosaic.height,
      requiredHeight: 192,
      slotHeight: slot?.height ?? 0,
      width: mosaic.width,
    }
  })
  await expect.poll(async () => {
    const geometry = await readGeometry()
    return geometry.slotHeight >= geometry.requiredHeight && geometry.width > 0
  }).toBe(true)
  const geometry = await readGeometry()
  expect(geometry.slotHeight).toBeGreaterThanOrEqual(geometry.requiredHeight)
  expect(geometry.width).toBeCloseTo(geometry.height, 0)
  await expectFavoritesMosaicTracksCenteredCard(
    mosaic,
    carousel.locator('[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]'),
  )
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(favorites).toBeHidden()
})

test("Favorites empty state explains the speed dial without duplicating station actions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Portrait Favorites behavior is covered in mobile Chromium.")
  await installAtmosphereFavorites(page, [])
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")

  const favorites = page.getByRole("region", { name: "Favorites" })
  await expect(favorites.getByText("Add favorites to make your speed dial")).toBeVisible()
  await expect(favorites.getByText("Heart a station and it will appear here.")).toBeVisible()
  await expect(favorites.getByRole("button")).toHaveCount(0)
  await expect(favorites.locator('[role="img"]')).toHaveCount(0)

  const emptyTile = favorites.locator('[data-favorite-destination="empty"]')
  const centeredCard = page.locator('[data-carousel-slide][data-centered="true"] article')
  const centeredCardShadow = await centeredCard.evaluate((element) => getComputedStyle(element).boxShadow)
  expect(centeredCardShadow).not.toBe("none")
  await expect.poll(() => emptyTile.evaluate((element) => getComputedStyle(element).boxShadow))
    .toBe(centeredCardShadow)
  await expect.poll(() => favorites.getByTestId("atmosphere-favorites-mosaic")
    .evaluate((element) => getComputedStyle(element).overflow))
    .toBe("visible")

  const favorite = page.getByRole("button", { name: "Favorite MassageLab Proof Drone" })
  await favorite.click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem("massagelab-atmosphere-v2")))
    .toContain('"mlab-proof-drone"')
  await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
  await expect(favorites.locator('[data-favorite-destination="station"]')).toHaveCount(1)

  await page.evaluate(() => {
    localStorage.setItem("massagelab-atmosphere-v2", JSON.stringify({
      version: 2,
      favorites: [],
      recentStations: [],
      volume: 0.4,
      miniPlayerCollapsed: false,
      visualizer: { backgroundId: "static-gradient", showClock: false },
      migrations: { legacyMusicBackground: true },
    }))
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)

  const carouselStage = page.getByTestId("station-carousel-stage")
  const stageHandle = await carouselStage.elementHandle()
  expect(stageHandle).not.toBeNull()
  await centerCarouselItem(page, "observable-streams-probe", "Next station")
  await expect(favorites.getByText("Add favorites to make your speed dial")).toBeVisible()
  await expect.poll(() => carouselStage.evaluate((stage) => document.activeElement === stage)).toBe(true)

  await page.getByRole("button", { name: "Favorite Observable Streams" }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem("massagelab-atmosphere-v2")))
    .toContain('"observable-streams-probe"')
  expect(await stageHandle?.evaluate((stage) => stage.isConnected)).toBe(true)
  await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
})

test("Favorites and Atmoshaper bookend Station categories without duplicating the speed dial", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== mobileProject && testInfo.project.name !== desktopProject,
    "Special Station categories are covered in mobile and desktop Chromium.",
  )
  await installAtmosphereFavorites(page, [])
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")

  const categoryGroup = page.getByRole("group", { name: "Station category" })
  const categoryButtons = categoryGroup.getByRole("button")
  await expect(categoryButtons).toHaveCount(7)
  await expect(categoryButtons.first()).toHaveText("Favorites")
  await expect(categoryButtons.last()).toHaveText("Atmoshaper")

  const favoritesButton = categoryGroup.getByRole("button", { name: "Favorites", exact: true })
  await expect(favoritesButton.locator('[data-metal-icon-trace="true"]')).toHaveCount(1)
  await favoritesButton.click()
  await expect(favoritesButton).toHaveAttribute("aria-pressed", "true")
  const favoritesEmpty = page.getByTestId("atmosphere-favorites-category-empty")
  await expect(favoritesEmpty).toHaveText(
    "Heart a station and it will appear here.",
  )
  await expect.poll(() => favoritesEmpty.evaluate((empty) => {
    const state = empty.getBoundingClientRect()
    const content = empty.querySelector<HTMLElement>(".ml-atmosphere-station-special-content")
      ?.getBoundingClientRect()
    return content
      ? Math.abs(content.top + content.height / 2 - (state.top + state.height / 3))
      : Number.POSITIVE_INFINITY
  })).toBeLessThanOrEqual(1)
  await expect(page.getByTestId("atmosphere-favorites-region")).toBeHidden()

  const atmoshaperButton = categoryGroup.getByRole("button", { name: "Atmoshaper", exact: true })
  await atmoshaperButton.click()
  await expect(atmoshaperButton).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("heading", { name: "Atmoshaper", exact: true })).toBeVisible()
  await expect(page.getByText("Layer ambient sounds into your own soundscape.", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Sound Library", exact: true })).toBeVisible()
  const ambientSoundsTab = page.getByRole("tab", { name: "Ambient sounds", exact: true })
  await ambientSoundsTab.click()
  await expect(ambientSoundsTab).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("searchbox", { name: "Search ambient sounds" })).toBeVisible()
  await expect(page.getByText("51 of 51 reviewed concepts", { exact: true })).toBeVisible()
  await expect(page.getByTestId("atmosphere-favorites-region")).toBeHidden()

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.getByText("51 of 51 reviewed concepts", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth <= innerWidth,
    vertical: document.documentElement.scrollHeight <= innerHeight,
  }))).toEqual({ horizontal: true, vertical: true })

  const treatmentButton = categoryGroup.getByRole("button", { name: "Treatment room starters", exact: true })
  await treatmentButton.click()
  await expect(treatmentButton).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByTestId("station-carousel-stage")).toBeVisible()
  await expect(page.getByTestId("atmosphere-favorites-region")).toBeHidden()
})

test("Favorites category presents the saved stations as a carousel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Saved Favorites carousel behavior is covered in mobile Chromium.")
  await installAtmosphereFavorites(page, ["generative-fm-trees", "mlab-proof-drone"])
  await page.setViewportSize({ width: 430, height: 932 })
  await gotoShell(page, "/music")

  await page.getByRole("group", { name: "Station category" })
    .getByRole("button", { name: "Favorites", exact: true })
    .click()

  const stage = page.getByTestId("station-carousel-stage")
  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(stage).toBeVisible()
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  const logicalSlides = stage.locator('[data-carousel-slide][role="group"]')
  await expect(logicalSlides).toHaveCount(2)
  expect(await logicalSlides
    .evaluateAll((slides) => slides.map((slide) => slide.getAttribute("data-carousel-item-id"))))
    .toEqual(["generative-fm-trees", "mlab-proof-drone"])
  await expect(stage.locator('[data-carousel-slide][data-centered="true"]'))
    .toHaveAttribute("data-carousel-item-id", "generative-fm-trees")
  await stage.press("ArrowRight")
  await expect(stage.locator('[data-carousel-slide][data-centered="true"]'))
    .toHaveAttribute("data-carousel-item-id", "mlab-proof-drone")
  await expect(page.getByTestId("atmosphere-favorites-region")).toBeHidden()
  expect(await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth <= innerWidth,
    vertical: document.documentElement.scrollHeight <= innerHeight,
  }))).toEqual({ horizontal: true, vertical: true })
})

test("selected Favorites remeasures as live favorites move between empty and populated", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Live Favorites transitions are covered in mobile Chromium.")
  await installAtmosphereFavorites(page, [])
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const toolbar = await startProofDrone(page)
  const notice = page.getByRole("region", { name: "Interruption preference" })
  if (await notice.isVisible()) await notice.getByRole("button", { name: "Close" }).click()

  await page.getByRole("group", { name: "Station category" })
    .getByRole("button", { name: "Favorites", exact: true })
    .click()
  const empty = page.getByTestId("atmosphere-favorites-category-empty")
  await expect(empty).toBeVisible()
  await expect(page.getByTestId("atmosphere-favorites-region")).toBeHidden()

  await toolbar.getByRole("button", { name: "Favorite MassageLab Proof Drone" }).click()
  const stage = page.getByTestId("station-carousel-stage")
  const carousel = page.getByRole("region", { name: "Station carousel" })
  const surface = page.locator(".ml-atmosphere-station-carousel")
  await expect(stage).toBeVisible()
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await expect(stage.locator('[data-carousel-slide][data-centered="true"]'))
    .toHaveAttribute("data-carousel-item-id", "mlab-proof-drone")
  const portraitStageSize = await surface.evaluate((element) => (
    element.style.getPropertyValue("--ml-atmosphere-station-stage-block-size")
  ))

  await page.setViewportSize({ width: 820, height: 1180 })
  await expect.poll(() => surface.evaluate((element) => (
    element.style.getPropertyValue("--ml-atmosphere-station-stage-block-size")
  ))).not.toBe(portraitStageSize)

  await toolbar.getByRole("button", { name: "Remove MassageLab Proof Drone from favorites" }).click()
  await expect(empty).toBeVisible()
  await expect(stage).toHaveCount(0)

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(empty).toBeVisible()
  await expect.poll(() => empty.evaluate((element) => {
    const state = element.getBoundingClientRect()
    const content = element.querySelector<HTMLElement>(".ml-atmosphere-station-special-content")
      ?.getBoundingClientRect()
    return content
      ? Math.abs(content.top + content.height / 2 - (state.top + state.height / 3))
      : Number.POSITIVE_INFINITY
  })).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth <= innerWidth,
    vertical: document.documentElement.scrollHeight <= innerHeight,
  }))).toEqual({ horizontal: true, vertical: true })

  await toolbar.getByRole("button", { name: "Favorite MassageLab Proof Drone" }).click()
  await expect(stage).toBeVisible()
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  const compactStageSize = await surface.evaluate((element) => (
    element.style.getPropertyValue("--ml-atmosphere-station-stage-block-size")
  ))
  await page.setViewportSize({ width: 820, height: 1180 })
  await expect.poll(() => surface.evaluate((element) => (
    element.style.getPropertyValue("--ml-atmosphere-station-stage-block-size")
  ))).not.toBe(compactStageSize)
  await expect(stage.locator('[data-carousel-slide][data-centered="true"]'))
    .toHaveAttribute("data-carousel-item-id", "mlab-proof-drone")
  await expect(page.getByTestId("atmosphere-favorites-region")).toBeHidden()
})

test("Favorites empty mosaic remains visible at reported device and zoom boundaries", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== mobileProject && testInfo.project.name !== desktopProject,
    "Reported empty-mosaic boundaries are covered in desktop and mobile Chromium.",
  )
  await installAtmosphereFavorites(page, [])
  const viewports = testInfo.project.name === mobileProject
    ? [{ width: 540, height: 720 }]
    : [{ width: 1420, height: 972 }, { width: 1578, height: 1080 }]
  await page.setViewportSize(viewports[0])
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const favorites = page.getByRole("region", { name: "Favorites" })
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expect(favorites.getByText("Add favorites to make your speed dial")).toBeVisible()
    await expect(favorites.getByText("Heart a station and it will appear here.")).toBeVisible()
    await expect(favorites.locator('[data-favorite-destination="empty"]')).toHaveCount(1)
    await expect(favorites.getByRole("button")).toHaveCount(0)
    await expect.poll(() => mosaic.evaluate((element) => {
      const mosaic = element.getBoundingClientRect()
      const slot = element.parentElement?.parentElement?.getBoundingClientRect()
      const center = element.closest(".ml-atmosphere-carousel-workspace")
        ?.querySelector<HTMLElement>(
          '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
        )
        ?.getBoundingClientRect()
      const centerGap = center ? mosaic.top - center.bottom : Number.NEGATIVE_INFINITY
      const bottomGap = slot ? slot.bottom - mosaic.bottom : Number.NEGATIVE_INFINITY
      return centerGap >= 3.5
        && bottomGap >= 3.5
        && Math.abs(centerGap - bottomGap) <= 3
    })).toBe(true)
    await expectFavoritesMosaicTracksCenteredCard(
      mosaic,
      carousel.locator('[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]'),
    )
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  }
})

test("Station composition uses measured room across approved phone and tablet viewports", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== mobileProject && testInfo.project.name !== desktopProject,
    "Responsive Station geometry is covered in desktop and mobile Chromium.",
  )
  const cases = testInfo.project.name === mobileProject
    ? [
        { viewport: { width: 375, height: 667 }, minCardWidth: 190, maxCardWidth: 194 },
        { viewport: { width: 384, height: 824 }, minCardWidth: 200, maxCardWidth: 218 },
        { viewport: { width: 393, height: 852 }, minCardWidth: 204, maxCardWidth: 222 },
        { viewport: { width: 412, height: 915 }, minCardWidth: 218, maxCardWidth: 230 },
        { viewport: { width: 430, height: 932 }, minCardWidth: 225, maxCardWidth: 245 },
        { viewport: { width: 540, height: 720 }, minCardWidth: 190, maxCardWidth: 205 },
      ]
    : [
        { viewport: { width: 768, height: 1024 }, minCardWidth: 255, maxCardWidth: 275 },
        { viewport: { width: 820, height: 1180 }, minCardWidth: 265, maxCardWidth: 285 },
        { viewport: { width: 900, height: 1440 }, minCardWidth: 360, maxCardWidth: 375 },
        { viewport: { width: 912, height: 1368 }, minCardWidth: 325, maxCardWidth: 340 },
        { viewport: { width: 1440, height: 2560 }, minCardWidth: 470, maxCardWidth: 481 },
      ]
  await installAtmosphereFavorites(page, [])
  await page.setViewportSize(cases[0].viewport)
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const favorites = page.getByRole("region", { name: "Favorites" })
  const centered = carousel.locator(
    '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
  )
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")

  for (const responsiveCase of cases) {
    await page.setViewportSize(responsiveCase.viewport)
    await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
    await expect(favorites).toBeVisible()
    await expect.poll(async () => (await centered.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(
      responsiveCase.minCardWidth,
    )
    await expect.poll(async () => (await centered.boundingBox())?.width ?? Number.POSITIVE_INFINITY)
      .toBeLessThanOrEqual(responsiveCase.maxCardWidth)
    const centerBox = await centered.boundingBox()
    expect(centerBox).not.toBeNull()
    await expectFavoritesMosaicTracksCenteredCard(mosaic, centered)
    if (testInfo.project.name === desktopProject) {
      await expectFavoritesMosaicUsesBalancedFill(mosaic)
    }
    expect(await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth <= innerWidth,
      vertical: document.documentElement.scrollHeight <= innerHeight,
    }))).toEqual({ horizontal: true, vertical: true })
  }
})

test("centered station description remains visible as roomy layouts rescale", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== mobileProject && testInfo.project.name !== desktopProject,
    "Centered station description geometry is covered in Chromium.",
  )
  const viewports = testInfo.project.name === mobileProject
    ? [{ width: 770, height: 700 }]
    : [
        { width: 904, height: 663 },
        { width: 1004, height: 737 },
        { width: 1130, height: 829 },
      ]
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize(viewports[0])
  await startProofDrone(page)

  const centered = page.locator('[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]')
  const description = centered.locator("[data-carousel-station-description]")
  const stationSurface = page.locator(".ml-atmosphere-station-carousel")
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expect(stationSurface).toHaveAttribute("data-constrained-landscape", "false")
    await expect(description).toBeVisible()
    await expect(description).toContainText("A soft, steady drone")
    const geometry = await Promise.all([centered.boundingBox(), description.boundingBox()])
    expect(geometry[0]).not.toBeNull()
    expect(geometry[1]).not.toBeNull()
    expect(geometry[1]!.y).toBeGreaterThanOrEqual(geometry[0]!.y)
    expect(geometry[1]!.y + geometry[1]!.height).toBeLessThanOrEqual(geometry[0]!.y + geometry[0]!.height + 1)
  }
})

test("Atmosphere workspace fluidly scales from Laptop L through 4K", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Large-screen Atmosphere geometry is covered in desktop Chromium.")
  await installAtmosphereFavorites(page, [])
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")
  const cases = [
    { viewport: { width: 1440, height: 900 }, minCardWidth: 240, maxCardWidth: 270, minControlWidth: 48, minEmptyTitleSize: 16, minLabelSize: 17 },
    { viewport: { width: 2560, height: 1440 }, minCardWidth: 440, maxCardWidth: 481, minControlWidth: 80, minEmptyTitleSize: 28, minLabelSize: 20 },
  ]

  for (const largeScreen of cases) {
    await page.setViewportSize(largeScreen.viewport)
    await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
    await expect(mosaic).toBeVisible()
    await expect.poll(() => carousel.evaluate((region) => {
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )
      return center?.getBoundingClientRect().width ?? 0
    })).toBeGreaterThanOrEqual(largeScreen.minCardWidth)
    await expect.poll(() => page.locator('[aria-label="Previous station"]').evaluate(
      (control) => control.getBoundingClientRect().width,
    )).toBeGreaterThanOrEqual(largeScreen.minControlWidth)
    await expect.poll(() => page.evaluate(() => {
      const center = document.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )?.getBoundingClientRect()
      const mosaic = document.querySelector<HTMLElement>(
        '[data-testid="atmosphere-favorites-mosaic"]',
      )?.getBoundingClientRect()
      return center && mosaic
        ? mosaic.width / center.width
        : Number.NEGATIVE_INFINITY
    })).toBeGreaterThanOrEqual(FAVORITES_MIN_TO_CENTER_CARD_RATIO - 0.01)

    const geometry = await page.evaluate(() => {
      const usable = document.querySelector<HTMLElement>(".ml-app-scroll")?.getBoundingClientRect()
      const stage = document.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')?.getBoundingClientRect()
      const center = document.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )?.getBoundingClientRect()
      const mosaic = document.querySelector<HTMLElement>(
        '[data-testid="atmosphere-favorites-mosaic"]',
      )?.getBoundingClientRect()
      const label = document.querySelector<HTMLElement>(".ml-atmosphere-category-label")
      const previousControl = document.querySelector<HTMLElement>('[aria-label="Previous station"]')
      const emptyTitle = document.querySelector<HTMLElement>(".ml-atmosphere-favorite-empty > strong")
      if (!usable || !stage || !center || !mosaic || !label || !previousControl || !emptyTitle) {
        throw new Error("Large-screen Atmosphere geometry is incomplete")
      }
      return {
        centerWidth: center.width,
        controlWidth: previousControl.getBoundingClientRect().width,
        emptyTitleFontSize: Number.parseFloat(getComputedStyle(emptyTitle).fontSize),
        labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
        mosaicRatio: mosaic.width / center.width,
        stageLeftDelta: Math.abs(stage.left - usable.left),
        stageRightDelta: Math.abs(stage.right - usable.right),
        noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
        noVerticalOverflow: document.documentElement.scrollHeight <= innerHeight,
      }
    })

    expect(geometry.centerWidth).toBeLessThanOrEqual(largeScreen.maxCardWidth)
    expect(geometry.controlWidth).toBeGreaterThanOrEqual(largeScreen.minControlWidth)
    expect(geometry.emptyTitleFontSize).toBeGreaterThanOrEqual(largeScreen.minEmptyTitleSize)
    expect(geometry.labelFontSize).toBeGreaterThanOrEqual(largeScreen.minLabelSize)
    expect(geometry.mosaicRatio).toBeGreaterThanOrEqual(FAVORITES_MIN_TO_CENTER_CARD_RATIO - 0.01)
    expect(geometry.stageLeftDelta).toBeLessThanOrEqual(1)
    expect(geometry.stageRightDelta).toBeLessThanOrEqual(1)
    expect(geometry.noHorizontalOverflow).toBe(true)
    expect(geometry.noVerticalOverflow).toBe(true)
  }
})

test("Atmosphere carousel shows equal visible station wings at each responsive size", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Station wing symmetry is covered in desktop Chromium.")
  await page.setViewportSize({ width: 540, height: 720 })
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const cases = [
    { viewport: { width: 540, height: 720 }, minimumPerSide: 2 },
    { viewport: { width: 1024, height: 768 }, minimumPerSide: 3 },
    { viewport: { width: 1440, height: 900 }, minimumPerSide: 3 },
    { viewport: { width: 2560, height: 1440 }, minimumPerSide: 4 },
  ]
  for (const responsiveCase of cases) {
    await page.setViewportSize(responsiveCase.viewport)
    await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
    await expect.poll(() => carousel.evaluate((region) => {
      const stage = region.querySelector<HTMLElement>(
        '[data-testid="station-carousel-stage"]',
      )?.getBoundingClientRect()
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"]',
      )?.getBoundingClientRect()
      if (!stage || !center) return Number.POSITIVE_INFINITY
      return Math.abs(
        (center.left + center.width / 2) - (stage.left + stage.width / 2),
      )
    })).toBeLessThanOrEqual(1)
    await page.waitForTimeout(400)

    const readVisibleWingCounts = () => carousel.evaluate((region) => {
      const stage = region.querySelector<HTMLElement>(
        '[data-testid="station-carousel-stage"]',
      )?.getBoundingClientRect()
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )?.getBoundingClientRect()
      const summaries = [...region.querySelectorAll<HTMLElement>(
        '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
      )].map((element) => element.getBoundingClientRect())
      if (!stage || !center) throw new Error("Station wing geometry is incomplete")

      const centerX = center.left + center.width / 2
      const visibleWidth = (box: DOMRect) => Math.max(
        0,
        Math.min(box.right, stage.right) - Math.max(box.left, stage.left),
      )
      const leftBoxes = summaries
        .filter((box) => box.left + box.width / 2 < centerX && visibleWidth(box) > 1)
        .sort((first, second) => first.left - second.left)
      const rightBoxes = summaries
        .filter((box) => box.left + box.width / 2 > centerX && visibleWidth(box) > 1)
        .sort((first, second) => second.right - first.right)
      return {
        left: leftBoxes.length,
        right: rightBoxes.length,
        leftOuterExposure: leftBoxes.length > 1 ? leftBoxes[1].left - leftBoxes[0].left : 0,
        rightOuterExposure: rightBoxes.length > 1 ? rightBoxes[0].right - rightBoxes[1].right : 0,
      }
    })

    await expect.poll(async () => {
      const counts = await readVisibleWingCounts()
      return Math.abs(counts.left - counts.right)
    }).toBe(0)
    await expect.poll(async () => {
      const counts = await readVisibleWingCounts()
      return Math.min(counts.left, counts.right)
    }, { message: `${responsiveCase.viewport.width}px minimum wings per side` }).toBeGreaterThanOrEqual(
      responsiveCase.minimumPerSide,
    )
    if (responsiveCase.viewport.width === 2560) {
      await expect.poll(async () => {
        const counts = await readVisibleWingCounts()
        return Math.min(counts.leftOuterExposure, counts.rightOuterExposure)
      }, { message: "4K outer wing exposure" }).toBeGreaterThanOrEqual(8)
    }
  }
})

test("Atmosphere carousel wraps across its temporary edges without exposing copies", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Station wrap behavior is covered in desktop Chromium.")
  await page.setViewportSize({ width: 1024, height: 768 })
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const centeredSlide = carousel.locator(
    '[data-carousel-slide="true"][data-centered="true"]',
  )
  await expect(centeredSlide).toHaveAttribute("data-carousel-canonical-id", "mlab-proof-drone")

  await carousel.getByRole("button", { name: "Previous station" }).click()
  await expect(centeredSlide).toHaveAttribute("data-carousel-canonical-id", "generative-fm-trees")
  await expect(centeredSlide).not.toHaveAttribute("data-carousel-loop-clone", "true")
  await expect(carousel.locator(
    '[data-carousel-slide="true"][data-centered="true"]',
  )).toHaveCount(1)

  await carousel.getByRole("button", { name: "Next station" }).click()
  await expect(centeredSlide).toHaveAttribute("data-carousel-canonical-id", "mlab-proof-drone")
  await expect(centeredSlide).not.toHaveAttribute("data-carousel-loop-clone", "true")
})

test("Favorites mosaic preserves the approved one through nine placement table", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Portrait Favorites layout is covered in mobile Chromium.")
  const favoriteIds = [
    "mlab-proof-drone",
    "generative-fm-trees",
    "observable-streams-probe",
    "generative-fm-aisatsana",
    "generative-fm-at-sunrise",
    "generative-fm-day-dream",
    "generative-fm-eno-machine",
    "generative-fm-lemniscate",
    "generative-fm-peace",
  ]
  const expectedLayouts: Record<number, Array<[number, number, number]>> = {
    1: [[1, 1, 6]],
    2: [[1, 1, 6], [2, 1, 6]],
    3: [[1, 1, 3], [1, 4, 3], [2, 1, 6]],
    4: [[1, 1, 3], [1, 4, 3], [2, 1, 3], [2, 4, 3]],
    5: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 3], [2, 4, 3]],
    6: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2]],
    7: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 6]],
    8: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 3], [3, 4, 3]],
    9: [[1, 1, 2], [1, 3, 2], [1, 5, 2], [2, 1, 2], [2, 3, 2], [2, 5, 2], [3, 1, 2], [3, 3, 2], [3, 5, 2]],
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")
  for (let count = 1; count <= favoriteIds.length; count += 1) {
    await page.evaluate((favorites) => {
      localStorage.setItem("massagelab-atmosphere-v2", JSON.stringify({
        version: 2,
        favorites,
        recentStations: [],
        volume: 0.4,
        miniPlayerCollapsed: false,
        visualizer: { backgroundId: "static-gradient", showClock: false },
        migrations: { legacyMusicBackground: true },
      }))
    }, favoriteIds.slice(0, count))
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)

    const placements = await page.getByTestId("atmosphere-favorites-mosaic")
      .locator('[data-favorite-destination="station"]')
      .evaluateAll((tiles) => tiles.map((tile) => {
        const owner = tile.parentElement
        return [
          Number(owner?.getAttribute("data-layout-row")),
          Number(owner?.getAttribute("data-layout-column")),
          Number(owner?.getAttribute("data-layout-column-span")),
        ]
      }))
    expect(placements).toEqual(expectedLayouts[count])
  }

  await gotoShell(page, "/music")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true)
  const mosaic = page.getByTestId("atmosphere-favorites-mosaic")
  await expect(mosaic.locator('[data-favorite-destination="station"]')).toHaveCount(9)
  const reducedMotionPlacements = await mosaic
    .locator('[data-favorite-destination="station"]')
    .evaluateAll((tiles) => tiles.map((tile) => {
      const owner = tile.parentElement
      return [
        Number(owner?.getAttribute("data-layout-row")),
        Number(owner?.getAttribute("data-layout-column")),
        Number(owner?.getAttribute("data-layout-column-span")),
      ]
    }))
  expect(reducedMotionPlacements).toEqual(expectedLayouts[9])
  await expect(mosaic.locator('[data-favorite-destination="station"]').first()).toHaveCSS("transition-duration", "0s")
  await expect(mosaic.locator('[data-favorite-destination="station"]').first()).toHaveCSS("animation-name", "none")
})

test("All favorites opens a complete newest-first Sheet with focus restoration", async ({ page }) => {
  const newestFirstIds = [
    "generative-fm-420hz-gamma-waves-for-big-brain",
    "generative-fm-a-viable-system",
    "generative-fm-above-the-rain",
    "generative-fm-agua-ravine",
    "generative-fm-aisatsana",
    "generative-fm-animalia-chordata",
    "generative-fm-apoapsis",
    "generative-fm-at-sunrise",
    "generative-fm-awash",
    "generative-fm-beneath-waves",
    "mlab-proof-drone",
    "retired-station-id",
  ]
  const expectedNewestFirstIds = newestFirstIds.slice(0, -1)

  await installAtmosphereFavorites(page, newestFirstIds)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")

  const favorites = page.getByRole("region", { name: "Favorites" })
  await expect(favorites.locator('[data-favorite-destination="station"]')).toHaveCount(8)
  const trigger = favorites.getByRole("button", { name: "All favorites, 11 stations" })
  await trigger.focus()
  await trigger.press("Enter")

  const sheet = page.getByRole("dialog", { name: "All favorites" })
  await expect(sheet).toBeVisible()
  const collectionStations = sheet.locator("[data-all-favorite-station]")
  await expect(collectionStations).toHaveCount(11)
  expect(await collectionStations.evaluateAll((items) => (
    items.map((item) => item.getAttribute("data-station-id"))
  ))).toEqual(expectedNewestFirstIds)

  const firstCollectionStation = collectionStations.first()
  const close = sheet.getByRole("button", { name: "Close" })
  await firstCollectionStation.focus()
  await page.keyboard.press("Shift+Tab")
  await expect(close).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(firstCollectionStation).toBeFocused()

  await page.setViewportSize({ width: 674, height: 331 })
  await page.evaluate(() => {
    document.body.classList.add("ml-music-player-active", "ml-music-player-rail")
    // This test isolates the Sheet's inherited exclusion contract. Actual rail
    // activation and responsive width are covered by the player-rail matrix.
    document.body.style.setProperty("--ml-player-right-safe", "256px")
  })
  await page.waitForTimeout(600)
  await expect(sheet).toBeVisible()
  const sheetGeometry = await sheet.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const probe = document.createElement("div")
    probe.style.cssText = "position:fixed;visibility:hidden;width:var(--ml-player-right-safe);"
    document.body.appendChild(probe)
    const playerRightSafe = probe.getBoundingClientRect().width
    probe.remove()
    return {
      bottom: box.bottom,
      left: box.left,
      playerRightSafe,
      right: box.right,
      top: box.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }
  })
  expect(sheetGeometry.playerRightSafe).toBeGreaterThan(0)
  expect(sheetGeometry.left).toBeGreaterThanOrEqual(0)
  expect(sheetGeometry.right).toBeLessThanOrEqual(sheetGeometry.viewportWidth - sheetGeometry.playerRightSafe)
  expect(sheetGeometry.top).toBeGreaterThanOrEqual(0)
  expect(sheetGeometry.bottom).toBeLessThanOrEqual(sheetGeometry.viewportHeight)
  expect(await sheet.locator(".ml-atmosphere-all-favorites-grid").evaluate((grid) => (
    getComputedStyle(grid).gridTemplateColumns.split(" ").length
  ))).toBe(2)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    document.body.classList.remove("ml-music-player-active", "ml-music-player-rail")
    document.body.style.removeProperty("--ml-player-right-safe")
  })
  await page.waitForTimeout(600)
  await page.keyboard.press("Escape")
  await expect(sheet).toBeHidden()
  await expect(trigger).toBeFocused()
})

test("compact landscape restores the approved five-card Station composition", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Compact Station composition is covered in mobile Chromium.")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await installStationCapabilityQueries(page, { reducedMotion: false, finePointer: false })
  await page.setViewportSize({ width: 824, height: 384 })
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const stationSurface = page.locator(".ml-atmosphere-station-carousel")
  const mountedCards = carousel.locator('[data-carousel-slide]:not([data-detail-level="shell"])')
  const center = carousel.locator('[data-carousel-slide][data-centered="true"]')
  const centerPresentation = center.locator('[data-carousel-transform="true"]')
  const centerArtwork = center.locator("[data-carousel-artwork]")
  const centerDescription = center.locator("[data-carousel-station-description]")
  const summaries = carousel.locator(
    '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
  )

  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await expect(stationSurface).toHaveAttribute("data-constrained-landscape", "true")
  await expect(centerDescription).toBeHidden()
  await expect(mountedCards).toHaveCount(9)
  await expect(summaries).toHaveCount(8)
  await expect.poll(() => summaries.evaluateAll((elements) => elements.some(
    (element) => getComputedStyle(element).transform !== "none"
      && getComputedStyle(element).transform !== "matrix(1, 0, 0, 1, 0, 0)",
  ))).toBe(true)
  await expect.poll(async () => {
    const [centerBox, artworkBox] = await Promise.all([
      centerPresentation.boundingBox(),
      centerArtwork.boundingBox(),
    ])
    if (!centerBox || !artworkBox) return null
    return Math.max(
      Math.abs(artworkBox.width - artworkBox.height),
      Math.abs(centerBox.width / centerBox.height - 192 / 224),
    )
  }).toBeLessThanOrEqual(0.002)

  const geometry = await carousel.evaluate((region) => {
    const stationSurface = region.closest<HTMLElement>(".ml-atmosphere-station-carousel")
    const headingElement = stationSurface?.querySelector<HTMLElement>(".ml-atmosphere-station-heading")
    const allocationElement = stationSurface?.querySelector<HTMLElement>(".ml-atmosphere-station-stage-allocation")
    const stageElement = region.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')
    const centerElement = region.querySelector<HTMLElement>(
      '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
    )
    const summaryElements = [...region.querySelectorAll<HTMLElement>(
      '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
    )]
    if (!headingElement || !allocationElement || !stageElement || !centerElement) {
      throw new Error("Station carousel geometry is incomplete")
    }
    const headingBox = headingElement.getBoundingClientRect()
    const allocationBox = allocationElement.getBoundingClientRect()
    const stageBox = stageElement.getBoundingClientRect()
    const centerBox = centerElement.getBoundingClientRect()
    const summaries = summaryElements.map((element) => {
      const box = element.getBoundingClientRect()
      return {
        intrinsicHeight: element.offsetHeight,
        intrinsicWidth: element.offsetWidth,
        width: box.width,
        height: box.height,
        visibleWidth: Math.max(0, Math.min(box.right, stageBox.right) - Math.max(box.left, stageBox.left)),
      }
    })
    return {
      compactGap: allocationBox.top - headingBox.bottom,
      center: { width: centerBox.width, height: centerBox.height },
      summaries,
      visiblyComposedCards: 1 + summaries.filter(({ visibleWidth }) => visibleWidth >= 8).length,
    }
  })
  expect(geometry.compactGap).toBeCloseTo(24, 0)
  expect(geometry.visiblyComposedCards).toBeGreaterThanOrEqual(5)
  expect(geometry.summaries.some(({ width }) => width < geometry.center.width)).toBe(true)
  expect(geometry.summaries.every(({ width }) => width <= geometry.center.width)).toBe(true)
  expect(geometry.summaries.every(({ intrinsicHeight, intrinsicWidth }) => (
    intrinsicHeight === 192 && intrinsicWidth === 192
  ))).toBe(true)
})

test("starting a constrained-landscape station preserves the approved card spacing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Constrained player-rail composition is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.setViewportSize({ width: 824, height: 384 })
  await gotoShell(page, "/music")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  const readNearCardGeometry = () => carousel.evaluate((region) => {
    const center = region.querySelector<HTMLElement>(
      '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
    )
    const summaries = [...region.querySelectorAll<HTMLElement>(
      '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
    )]
    if (!center) throw new Error("Centered Station card is missing")
    const centerBox = center.getBoundingClientRect()
    const centerX = centerBox.left + centerBox.width / 2
    const boxes = summaries.map((summary) => summary.getBoundingClientRect())
    const left = boxes.filter((box) => box.left + box.width / 2 < centerX)
      .sort((first, second) => second.right - first.right)[0]
    const right = boxes.filter((box) => box.left + box.width / 2 > centerX)
      .sort((first, second) => first.left - second.left)[0]
    if (!left || !right) throw new Error("Nearest Station previews are missing")
    return {
      width: region.getBoundingClientRect().width,
      left: centerBox.left - left.right,
      right: right.left - centerBox.right,
    }
  })

  await expect.poll(async () => {
    const gaps = await readNearCardGeometry()
    return Math.abs(gaps.left - gaps.right)
  }).toBeLessThanOrEqual(1)
  const before = await readNearCardGeometry()
  expect(before.left).toBeGreaterThanOrEqual(4)
  expect(before.right).toBeGreaterThanOrEqual(4)

  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const toolbar = page.getByTestId("music-player-toolbar")
  await expect(toolbar).toHaveAttribute("data-layout", "rail")
  await expect(page.locator("body")).toHaveClass(/ml-music-player-rail/)
  await expect.poll(async () => before.width - (await readNearCardGeometry()).width).toBeGreaterThan(50)

  let stableSamples = 0
  let previous = await readNearCardGeometry()
  let after = previous
  await expect.poll(async () => {
    after = await readNearCardGeometry()
    const unchanged = Math.max(
      Math.abs(after.width - previous.width),
      Math.abs(after.left - previous.left),
      Math.abs(after.right - previous.right),
    ) <= 0.25
    stableSamples = unchanged ? stableSamples + 1 : 0
    previous = after
    return stableSamples
  }, { intervals: [100, 100, 100, 150, 200] }).toBeGreaterThanOrEqual(2)

  expect(after.left).toBeGreaterThanOrEqual(0)
  expect(after.right).toBeGreaterThanOrEqual(0)
  expect(Math.abs(after.left - after.right)).toBeLessThanOrEqual(1)
  expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.right - before.right)).toBeLessThanOrEqual(2)
})

test("medium landscape keeps both outer Station wings visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "The annotated fine-pointer viewport is covered in desktop Chromium.")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.setViewportSize({ width: 714, height: 597 })
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await expect.poll(() => carousel.evaluate((region) => {
    const stage = region.querySelector<HTMLElement>('[data-testid="station-carousel-stage"]')
    const cards = [...region.querySelectorAll<HTMLElement>(
      '[data-carousel-slide]:not([data-detail-level="shell"]) [data-carousel-transform="true"]',
    )]
    if (!stage) return 0
    const stageBox = stage.getBoundingClientRect()
    return cards.filter((card) => {
      const box = card.getBoundingClientRect()
      const visibleWidth = Math.max(
        0,
        Math.min(box.right, stageBox.right) - Math.max(box.left, stageBox.left),
      )
      // A sliver is not a useful wing. Keep at least one quarter of each
      // outer preview visible so its art can still be recognized.
      return visibleWidth >= Math.min(48, box.width * 0.25)
    }).length
  })).toBeGreaterThanOrEqual(5)
})

test("short Station controls remain inside the usable carousel height", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Short touch viewport controls are covered in mobile Chromium.")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await installStationCapabilityQueries(page, { reducedMotion: true, finePointer: false })
  await page.setViewportSize({ width: 674, height: 331 })
  await gotoShell(page, "/music")

  const carousel = page.getByRole("region", { name: "Station carousel" })
  const controls = page.getByTestId("station-carousel-controls")
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await expect(controls).toBeVisible()
  const geometry = await carousel.evaluate((region) => {
    const root = region.getBoundingClientRect()
    const buttons = [...region.querySelectorAll<HTMLElement>(
      '[data-testid="station-carousel-controls"] button',
    )].map((button) => button.getBoundingClientRect().toJSON())
    return { root: root.toJSON(), buttons }
  })
  expect(geometry.buttons).toHaveLength(2)
  for (const button of geometry.buttons) {
    expect(button.top).toBeGreaterThanOrEqual(geometry.root.top)
    expect(button.bottom).toBeLessThanOrEqual(geometry.root.bottom)
    expect(button.bottom).toBeLessThanOrEqual(331)
  }
})

test("side player rail shares sidebar width, readable vinyl treatment, and directional controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Constrained side-player styling is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 824, height: 384 })
  const toolbar = await startProofDrone(page)
  const notice = page.getByRole("region", { name: "Interruption preference" })
  if (await notice.isVisible()) await notice.getByRole("button", { name: "Close" }).click()

  await expect(toolbar).toHaveAttribute("data-layout", "rail")
  await expect(toolbar.getByRole("button", { name: "Minimize" }).locator("svg.lucide-chevron-right")).toHaveCount(1)
  const treatment = await toolbar.evaluate((root) => {
    const identity = root.querySelector<HTMLElement>('[data-testid="music-player-toolbar-identity"]')
    const disc = root.querySelector<HTMLElement>(".ml-station-vinyl-disc")
    const artwork = root.querySelector<HTMLElement>(".ml-station-vinyl-artwork")
    const grooves = root.querySelector<HTMLElement>(".ml-station-vinyl-grooves")
    const glare = root.querySelector<HTMLElement>(".ml-station-vinyl-glare")
    const label = root.querySelector<HTMLElement>(".ml-station-vinyl-label")
    const controls = root.querySelector<HTMLElement>('[data-testid="music-player-toolbar-controls"]')
    const layout = root.querySelector<HTMLElement>(".ml-music-player-toolbar-layout")
    if (!identity || !disc || !artwork || !grooves || !glare || !label || !controls || !layout) {
      throw new Error("Vinyl treatment is incomplete")
    }
    const discBox = disc.getBoundingClientRect()
    const artworkBox = artwork.getBoundingClientRect()
    const labelBefore = getComputedStyle(label, "::before")
    const identityBefore = getComputedStyle(identity, "::before")
    const sharedSurfaceBefore = getComputedStyle(layout, "::before")
    return {
      identityBackground: getComputedStyle(identity).backgroundImage,
      identityBoxShadow: getComputedStyle(identity).boxShadow,
      identityPlate: identityBefore.backgroundImage,
      identityPlateContent: identityBefore.content,
      identityShadow: getComputedStyle(identity).textShadow,
      identityZIndex: Number.parseInt(getComputedStyle(identity).zIndex, 10),
      controlsZIndex: Number.parseInt(getComputedStyle(controls).zIndex, 10),
      sharedSurfaceBackground: sharedSurfaceBefore.backgroundColor,
      sharedSurfaceContent: sharedSurfaceBefore.content,
      sharedSurfaceGridRowEnd: sharedSurfaceBefore.gridRowEnd,
      sharedSurfaceGridRowStart: sharedSurfaceBefore.gridRowStart,
      sharedSurfaceOpacity: Number.parseFloat(sharedSurfaceBefore.opacity),
      sharedSurfaceZIndex: Number.parseInt(sharedSurfaceBefore.zIndex, 10),
      artworkInset: artworkBox.left - discBox.left,
      grooves: getComputedStyle(grooves).backgroundImage,
      grooveBlendMode: getComputedStyle(grooves).mixBlendMode,
      glare: getComputedStyle(glare).backgroundImage,
      labelDiameter: Number.parseFloat(labelBefore.width),
      discDiameter: discBox.width,
    }
  })
  expect(treatment.identityBackground).toBe("none")
  expect(treatment.identityBoxShadow).toBe("none")
  expect(treatment.identityPlateContent).toBe("none")
  expect(treatment.identityShadow).not.toBe("none")
  expect(treatment.sharedSurfaceContent).not.toBe("none")
  expect(treatment.sharedSurfaceBackground).not.toBe("rgba(0, 0, 0, 0)")
  expect(treatment.sharedSurfaceGridRowStart).toBe("2")
  expect(treatment.sharedSurfaceGridRowEnd).toBe("4")
  expect(treatment.sharedSurfaceOpacity).toBeGreaterThanOrEqual(0.45)
  expect(treatment.sharedSurfaceOpacity).toBeLessThanOrEqual(0.7)
  expect(treatment.identityZIndex).toBeGreaterThan(treatment.sharedSurfaceZIndex)
  expect(treatment.controlsZIndex).toBeGreaterThan(treatment.identityZIndex)
  expect(treatment.artworkInset).toBeGreaterThan(0)
  expect(treatment.grooves).not.toBe("none")
  expect(treatment.grooveBlendMode).toBe("normal")
  expect(treatment.glare).not.toBe("none")
  expect(treatment.labelDiameter / treatment.discDiameter).toBeGreaterThanOrEqual(0.3)

  const [expandedVinyl, expandedIdentity, expandedControls, expandedRail] = await Promise.all([
    toolbar.getByTestId("station-vinyl").boundingBox(),
    toolbar.getByTestId("music-player-toolbar-identity").boundingBox(),
    toolbar.getByTestId("music-player-toolbar-controls").boundingBox(),
    toolbar.boundingBox(),
  ])
  expect(expandedVinyl, "expanded vinyl").not.toBeNull()
  expect(expandedIdentity, "expanded identity").not.toBeNull()
  expect(expandedControls, "expanded controls").not.toBeNull()
  expect(expandedRail, "expanded player rail").not.toBeNull()
  const identityCenterX = (expandedIdentity?.x ?? 0) + (expandedIdentity?.width ?? 0) / 2
  const vinylCenterX = (expandedVinyl?.x ?? 0) + (expandedVinyl?.width ?? 0) / 2
  const identityCenterY = (expandedIdentity?.y ?? 0) + (expandedIdentity?.height ?? 0) / 2
  const vinylCenterY = (expandedVinyl?.y ?? 0) + (expandedVinyl?.height ?? 0) / 2
  expect(Math.abs(identityCenterX - vinylCenterX)).toBeLessThanOrEqual(1)
  expect(identityCenterY).toBeGreaterThan(vinylCenterY + 16)
  expect((expandedControls?.y ?? 0) - (
    (expandedIdentity?.y ?? 0) + (expandedIdentity?.height ?? 0)
  )).toBeGreaterThanOrEqual(0)
  expect((expandedControls?.y ?? 0) - (
    (expandedIdentity?.y ?? 0) + (expandedIdentity?.height ?? 0)
  )).toBeLessThanOrEqual(16)
  expect(
    (expandedRail?.y ?? 0) + (expandedRail?.height ?? 0)
      - ((expandedControls?.y ?? 0) + (expandedControls?.height ?? 0)),
  ).toBeLessThanOrEqual(16)
  await toolbar.getByRole("button", { name: "Minimize" }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "true")
  await expect(toolbar.getByRole("button", { name: "Expand" }).locator("svg.lucide-chevron-left")).toHaveCount(1)
  const [collapsedRail, sidebar, collapsedVinyl] = await Promise.all([
    toolbar.boundingBox(),
    page.locator(".ml-app-sidebar-frame").boundingBox(),
    toolbar.getByTestId("station-vinyl").boundingBox(),
  ])
  expect(collapsedRail, "collapsed player rail").not.toBeNull()
  expect(sidebar, "app sidebar rail").not.toBeNull()
  expect(collapsedVinyl, "collapsed vinyl").not.toBeNull()
  expect(collapsedRail?.width).toBeCloseTo(sidebar?.width ?? 0, 0)
  expect(collapsedVinyl?.width).toBeCloseTo(expandedVinyl?.width ?? 0, 0)
})

test("station controls follow input capability live without remount", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Touch capability behavior is covered in mobile Chromium.")
  await installStationCapabilityQueries(page, { reducedMotion: false, finePointer: false })
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")
  const carousel = page.getByRole("region", { name: "Station carousel" })
  const marker = carousel.locator('[data-station-carousel-controls="true"]')
  const controls = page.getByTestId("station-carousel-controls")
  const summaries = carousel.locator(
    '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
  )
  await expect(summaries).toHaveCount(8)
  await expect(marker).toHaveCount(0)
  await expect(controls).toHaveCount(0)
  await expect(carousel.getByRole("button", { name: /^(Previous|Next) station$/ })).toHaveCount(0)
  const unreservedHeight = await summaries.first().evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).height),
  )
  await carousel.evaluate((element) => Reflect.set(window, "__task20StageIdentity", element))

  await setStationCapabilityQuery(page, stationReducedMotionQuery, true)
  await expect(marker).toHaveCount(1)
  await expect(controls).toHaveCount(1)
  await expect(carousel.getByRole("button", { name: /^(Previous|Next) station$/ })).toHaveCount(2)
  const reducedHeight = await summaries.first().evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).height),
  )
  expect(reducedHeight).toBeCloseTo(unreservedHeight, 0)
  const [summaryBoxes, controlBoxes] = await Promise.all([
    carousel.evaluate((region) => {
      const center = region.querySelector<HTMLElement>(
        '[data-carousel-slide][data-centered="true"] [data-carousel-transform="true"]',
      )
      const summaries = [...region.querySelectorAll<HTMLElement>(
        '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
      )]
      if (!center) throw new Error("Centered Station card is missing")
      const centerBox = center.getBoundingClientRect()
      const centerX = centerBox.x + centerBox.width / 2
      const boxes = summaries.map((element) => element.getBoundingClientRect().toJSON())
      const left = boxes.filter((box) => box.x + box.width / 2 < centerX)
        .sort((first, second) => second.x - first.x)[0]
      const right = boxes.filter((box) => box.x + box.width / 2 > centerX)
        .sort((first, second) => first.x - second.x)[0]
      if (!left || !right) throw new Error("Adjacent Station summaries are missing")
      return [left, right]
    }),
    carousel.getByRole("button", { name: /^(Previous|Next) station$/ })
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON())),
  ])
  controlBoxes.forEach((box, index) => {
    const offset = box.y - (summaryBoxes[index].y + summaryBoxes[index].height)
    expect(offset).toBeGreaterThanOrEqual(15)
    expect(offset).toBeLessThanOrEqual(19)
  })
  await setStationCapabilityQuery(page, stationReducedMotionQuery, false)
  await expect(marker).toHaveCount(0)
  await expect(controls).toHaveCount(0)
  await expect.poll(() => summaries.first().evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).height),
  ))
    .toBeCloseTo(unreservedHeight, 0)
  await setStationCapabilityQuery(page, stationFinePointerQuery, true)
  await expect(marker).toHaveCount(1)
  await expect(controls).toHaveCount(1)
  await expect.poll(() => summaries.first().evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).height),
  ))
    .toBeCloseTo(reducedHeight, 0)
  const preservedStageIdentity = await carousel.evaluate(
    (element) => Reflect.get(window, "__task20StageIdentity") === element,
  )
  expect(preservedStageIdentity).toBe(true)
  await setStationCapabilityQuery(page, stationFinePointerQuery, false)
  await expect(marker).toHaveCount(0)
  await testInfo.attach("task-20-capability-geometry.json", {
    body: JSON.stringify({
      queryStates: [
        { reducedMotion: false, finePointer: false, controls: 0, summaryHeight: unreservedHeight },
        { reducedMotion: true, finePointer: false, controls: 2, summaryHeight: reducedHeight },
        { reducedMotion: false, finePointer: false, controls: 0, summaryHeight: unreservedHeight },
        { reducedMotion: false, finePointer: true, controls: 2, summaryHeight: reducedHeight },
        { reducedMotion: false, finePointer: false, controls: 0, summaryHeight: unreservedHeight },
      ],
      summaryBoxes,
      controlBoxes,
      reserveDelta: unreservedHeight - reducedHeight,
      preservedStageIdentity,
    }, null, 2),
    contentType: "application/json",
  })
})

test("fine pointer station controls render and update live", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== desktopProject, "Fine-pointer behavior is covered in desktop Chromium.")
  await installStationCapabilityQueries(page, { reducedMotion: false, finePointer: true })
  await page.setViewportSize({ width: 1280, height: 800 })
  await gotoShell(page, "/music")
  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel.locator('[data-station-carousel-controls="true"]')).toHaveCount(1)
  const controls = carousel.getByRole("button", { name: /^(Previous|Next) station$/ })
  await expect(controls).toHaveCount(2)
  const controlBoxes = await controls.evaluateAll((elements) => elements.map(
    (element) => element.getBoundingClientRect().toJSON(),
  ))
  await setStationCapabilityQuery(page, stationFinePointerQuery, false)
  await expect(carousel.locator('[data-station-carousel-controls="true"]')).toHaveCount(0)
  await expect(controls).toHaveCount(0)
  await testInfo.attach("task-20-fine-pointer-controls.json", {
    body: JSON.stringify({
      shown: { reducedMotion: false, finePointer: true, controls: 2, controlBoxes },
      hidden: { reducedMotion: false, finePointer: false, controls: 0 },
    }, null, 2),
    contentType: "application/json",
  })
})

test("carousel fits compact landscape rail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Compact-landscape carousel geometry is covered in mobile Chromium.")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    const NativeResizeObserver = window.ResizeObserver
    const records: Array<{ targets: string[], disconnected: boolean }> = []
    Reflect.set(window, "__stationCarouselObserverRecords", records)
    window.ResizeObserver = class InstrumentedResizeObserver implements ResizeObserver {
      private nativeObserver: ResizeObserver
      private record = { targets: [] as string[], disconnected: false }

      constructor(callback: ResizeObserverCallback) {
        records.push(this.record)
        this.nativeObserver = new NativeResizeObserver((entries) => callback(entries, this))
      }

      disconnect() {
        this.record.disconnected = true
        this.nativeObserver.disconnect()
      }

      observe(target: Element, options?: ResizeObserverOptions) {
        this.record.targets.push(target.getAttribute("aria-label") === "Station carousel"
          ? "station-carousel-stage"
          : target.tagName.toLowerCase())
        this.nativeObserver.observe(target, options)
      }

      unobserve(target: Element) {
        this.nativeObserver.unobserve(target)
      }
    }
  })
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 844, height: 390 })
  const toolbar = await startProofDrone(page)
  const carousel = page.getByRole("region", { name: "Atmosphere audio stations" })
  const stationStage = page.getByRole("region", { name: "Station carousel" })
  const stageViewport = page.getByTestId("station-carousel-stage")
  const proofDrone = page.getByRole("group", { name: /MassageLab Proof Drone/ })
  const nonShellCards = carousel.locator('[data-carousel-slide]:not([data-detail-level="shell"])')
  const readCenterOffset = async () => {
    const [containerBox, cardBox] = await Promise.all([carousel.boundingBox(), proofDrone.boundingBox()])
    return Math.abs(
      ((cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2)
      - ((containerBox?.x ?? 0) + (containerBox?.width ?? 0) / 2),
    )
  }
  const centeredStationId = await carousel.locator('[data-centered="true"]').getAttribute("data-carousel-item-id")
  const assertResponsiveCenteredCard = async () => {
    const [stageBox, cardBox] = await Promise.all([
      stageViewport.boundingBox(),
      proofDrone.boundingBox(),
    ])
    expect(stageBox, "station stage box").not.toBeNull()
    expect(cardBox, "centered station card box").not.toBeNull()
    if (!stageBox || !cardBox) return

    const expectedHeight = Math.max(
      72,
      Math.min(224, Math.floor(stageBox.height)),
    )
    const expectedWidth = Math.round(expectedHeight * 192 / 224)
    expect(cardBox.width).toBeCloseTo(expectedWidth, 0)
    expect(cardBox.height).toBeCloseTo(expectedHeight, 0)
    expect(cardBox.x).toBeGreaterThanOrEqual(stageBox.x - 1)
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + 1)
    expect(cardBox.y).toBeGreaterThanOrEqual(stageBox.y - 1)
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + 1)
  }

  await expect(toolbar).toHaveAttribute("data-layout", "rail")
  expect(centeredStationId).toBe("mlab-proof-drone")
  await expect(nonShellCards).toHaveCount(9)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
  await expect(proofDrone).toHaveAttribute("data-centered", "true")
  await expect(proofDrone.getByRole("button", { name: /Play|Stop MassageLab Proof Drone/i })).toBeInViewport()
  await expect(stationStage.getByRole("button", { name: "Previous station" })).toBeInViewport()
  await expect(stationStage.getByRole("button", { name: "Next station" })).toBeInViewport()
  await expect.poll(readCenterOffset).toBeLessThanOrEqual(0.5)
  await assertResponsiveCenteredCard()

  await toolbar.getByRole("button", { name: "Minimize", exact: true }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "true")
  await expect.poll(async () => (await proofDrone.boundingBox())?.width).toBe(192)
  await expect(proofDrone).toHaveAttribute("data-centered", "true")
  await expect(nonShellCards).toHaveCount(9)
  await expect.poll(readCenterOffset).toBeLessThanOrEqual(0.5)

  await toolbar.getByRole("button", { name: "Expand", exact: true }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "false")
  await expect.poll(async () => (await proofDrone.boundingBox())?.width).toBe(192)
  await expect(proofDrone).toHaveAttribute("data-centered", "true")
  await expect(nonShellCards).toHaveCount(9)
  await expect.poll(readCenterOffset).toBeLessThanOrEqual(0.5)

  await toolbar.getByRole("button", { name: "Minimize", exact: true }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "true")
  await expect.poll(async () => (await proofDrone.boundingBox())?.width).toBe(192)
  await expect(proofDrone).toHaveAttribute("data-centered", "true")
  await expect(nonShellCards).toHaveCount(9)
  await expect.poll(readCenterOffset).toBeLessThanOrEqual(0.5)
  await assertResponsiveCenteredCard()
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
  const mountedObserverRecords = await page.evaluate(() => {
    const records = Reflect.get(window, "__stationCarouselObserverRecords") as Array<{
      targets: string[]
      disconnected: boolean
    }>
    return records.filter(({ targets }) => targets.includes("station-carousel-stage"))
  })
  // A delayed capability-query update may legitimately replace the observer;
  // require every superseded instance to disconnect and exactly one to remain.
  expect(mountedObserverRecords.length).toBeGreaterThanOrEqual(1)
  expect(mountedObserverRecords.filter(({ disconnected }) => !disconnected)).toHaveLength(1)
  expect(mountedObserverRecords.slice(0, -1).every(({ disconnected }) => disconnected)).toBe(true)

  await page.getByRole("button", { name: "About", exact: true }).click()
  await page.getByRole("link", { name: "About MassageLab" }).click()
  await expect(page).toHaveURL(/\/about$/)
  const unmountedObserverRecords = await page.evaluate(() => {
    const records = Reflect.get(window, "__stationCarouselObserverRecords") as Array<{
      targets: string[]
      disconnected: boolean
    }>
    return records.filter(({ targets }) => targets.includes("station-carousel-stage"))
  })
  expect(unmountedObserverRecords).toHaveLength(mountedObserverRecords.length)
  expect(unmountedObserverRecords.every(({ disconnected }) => disconnected)).toBe(true)
})

test("Atmosphere expanded player actions expose session and saved interruption preferences", async ({ page }) => {
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const player = await startInterruptionNoticeSession(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 45_000 })
  const controls = player.getByTestId("music-player-toolbar-controls")
  const notice = page.getByRole("region", { name: "Interruption preference" })

  await expect(notice).toBeVisible()
  await expect(notice).toHaveAttribute("aria-live", "polite")
  await expect(notice).toContainText("Calls and other audio may temporarily pause or mute this station.")
  const sessionPreference = notice.getByRole("checkbox", {
    name: "Resume automatically when the interruption ends",
  })
  await expect(sessionPreference).toBeChecked()
  expect(await controls.locator("[aria-label]").evaluateAll((actions) => (
    actions.map((action) => action.getAttribute("aria-label"))
  ))).toEqual([
    "Player settings",
    "Favorite MassageLab Proof Drone",
    "Previous station",
    "Pause",
    "Stop",
    "Next station",
    "Background",
    "Atmosphere volume",
    "Minimize",
  ])

  await sessionPreference.uncheck()
  await player.getByRole("button", { name: "Player settings" }).click()
  const savedPreference = page.getByRole("menuitemcheckbox", { name: "Resume after interruptions" })
  await expect(savedPreference).toBeChecked()
  await page.keyboard.press("Escape")
  await sessionPreference.check()
  await player.getByRole("button", { name: "Player settings" }).click()
  await savedPreference.click()
  await expect.poll(() => page.evaluate(() => (
    localStorage.getItem("massagelab-atmosphere-interruption-v1")
  ))).toContain('"resumeAfterInterruption":false')
  await page.keyboard.press("Escape")
  await expect(sessionPreference).not.toBeChecked()

  await setInterruptionNoticeAudioSession(page, "interrupted")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await expect(player.getByText("Paused", { exact: true })).toBeVisible()
  await setInterruptionNoticeAudioSession(page, "active")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await player.getByRole("button", { name: "Play", exact: true }).click()
  await expect(notice).toBeVisible()
  await expect(sessionPreference).not.toBeChecked()
  await sessionPreference.check()
  await setInterruptionNoticeAudioSession(page, "interrupted")
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await expect(player.getByText("Interrupted", { exact: true })).toBeVisible()
  await setInterruptionNoticeAudioSession(page, "active")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  const close = notice.getByRole("button", { name: "Close" })
  await close.focus()
  await page.keyboard.press("Enter")
  await expect(notice).toBeHidden()

  let releaseZedSampleIndex: () => void = () => undefined
  let matchedZedSampleIndexUrl: string | null = null
  const zedSampleIndexGate = new Promise<void>((resolve) => {
    releaseZedSampleIndex = resolve
  })
  const zedSampleIndexPattern = "**/atmosphere/generative-fm/zed/sample-index*.json"
  const zedSampleIndexHandler = async (route: Route) => {
    matchedZedSampleIndexUrl = route.request().url()
    await zedSampleIndexGate
    await abortHeldFixtureRequest(route)
  }
  await page.route(zedSampleIndexPattern, zedSampleIndexHandler)
  try {
    await player.getByRole("button", { name: "Previous station" }).click()
    await expect.poll(() => matchedZedSampleIndexUrl).toMatch(
      /\/atmosphere\/generative-fm\/zed\/sample-index(?:\.[^/?]+)?\.json(?:\?.*)?$/,
    )
    await expect(player.getByTestId("music-player-toolbar-identity").locator("p").first())
      .toHaveText("Zed")
    await expect(player).toHaveAttribute("data-playback-state", "loading")
    await expect(notice).toBeHidden()

    releaseZedSampleIndex()
    await expect(player).toHaveAttribute("data-playback-state", "failed")
    const nextStation = player.getByRole("button", { name: "Next station" })
    await expect(nextStation).toBeEnabled()
    await nextStation.click()
    await expect(player.getByTestId("music-player-toolbar-identity").locator("p").first())
      .toHaveText("MassageLab Proof Drone")
    await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
    await expect(notice).toBeHidden()
  } finally {
    releaseZedSampleIndex()
    await page.unroute(zedSampleIndexPattern, zedSampleIndexHandler)
  }
})

test("vinyl player controls expose grouped semantic actions and a minimal collapsed set", async ({ page }) => {
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 1024, height: 768 })
  const toolbar = await startInterruptionNoticeSession(page)
  const stationTitle = "MassageLab Proof Drone"
  const vinyl = toolbar.getByTestId("station-vinyl")
  const left = toolbar.getByTestId("music-player-toolbar-left")
  const primary = toolbar.getByTestId("music-player-toolbar-primary-controls")
  const right = toolbar.getByTestId("music-player-toolbar-right")

  await expect(vinyl).toHaveAttribute("data-artwork-station-id", "mlab-proof-drone")
  await expect(vinyl.locator("svg")).toHaveCount(1)
  await expect(vinyl).toHaveAttribute("aria-hidden", "true")
  await expect(vinyl).toHaveCSS("pointer-events", "none")
  await expect(vinyl.locator("button, a, input, select, textarea, [tabindex]")).toHaveCount(0)

  await expect(left.getByRole("button", { name: "Player settings" })).toHaveClass(/ml-button-glow/)
  await expect(right.getByRole("slider", { name: "Atmosphere volume" })).toBeVisible()
  await expect(right.getByRole("button", { name: "Minimize" })).toHaveClass(/ml-button-glow/)
  await expect(right.getByRole("button", { name: "Minimize" }).locator("svg.lucide-chevron-down")).toHaveCount(1)

  const actionLabels = await primary
    .locator('button[aria-label], a[aria-label]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")))
  expect(actionLabels).toEqual([
    `Favorite ${stationTitle}`,
    "Previous station",
    "Pause",
    "Stop",
    "Next station",
    "Background",
  ])

  const favorite = primary.getByRole("button", { name: `Favorite ${stationTitle}` })
  await expect(favorite).toHaveAttribute("aria-pressed", "false")
  await expect(favorite).toHaveClass(/\[--brand-orange:var\(--button-cta-face\)\]/)
  await expect(primary.getByRole("button", { name: "Previous station" })).toHaveClass(/ml-button-glow/)
  await expect(primary.getByRole("button", { name: "Pause", exact: true })).toHaveClass(/ml-button-glow/)
  await expect(primary.getByRole("button", { name: "Stop", exact: true })).toHaveClass(/ml-button-destructive/)
  await expect(primary.getByRole("button", { name: "Next station" })).toHaveClass(/ml-button-glow/)
  await expect(primary.getByRole("link", { name: "Background" })).toHaveClass(/ml-button-attention/)

  await favorite.click()
  const selectedFavorite = primary.getByRole("button", {
    name: `Remove ${stationTitle} from favorites`,
  })
  await expect(selectedFavorite).toHaveAttribute("aria-pressed", "true")
  await expect(selectedFavorite.locator('[data-metal-icon-trace="true"]')).toBeVisible()

  await right.getByRole("button", { name: "Minimize" }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "true")
  await expect(toolbar.getByRole("button", { name: "Expand" }).locator("svg.lucide-chevron-up")).toHaveCount(1)
  await expect(left).toHaveCount(0)
  await expect(primary).toHaveCount(0)
  await expect(right).toHaveCount(0)
  expect(await toolbar.locator('.ml-music-player-toolbar-layout button[aria-label], .ml-music-player-toolbar-layout a[aria-label], .ml-music-player-toolbar-layout input[aria-label]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label"))))
    .toEqual(["Pause", "Stop", "Expand"])

  await toolbar.getByRole("button", { name: "Stop", exact: true }).click()
  await expect(toolbar.getByRole("button", { name: "Play", exact: true })).toHaveClass(/ml-button-success/)
})

test("vinyl geometry keeps expanded desktop and phone controls bounded around a centered transport", async ({ page }, testInfo) => {
  await installInterruptionNoticeMediaFakes(page)
  const isDesktop = testInfo.project.name === desktopProject
  await page.setViewportSize(isDesktop
    ? { width: 1280, height: 900 }
    : { width: 390, height: 844 })
  const toolbar = await startInterruptionNoticeSession(page)
  const geometry = await readVinylPlayerGeometry(toolbar)
  const spacing = await resolvedShellSpacing(page)
  const toolbarCenter = geometry.toolbar.left + geometry.toolbar.width / 2
  const transportCenter = (geometry.playPause.left + geometry.stop.right) / 2

  expect(geometry.vinyl.width).toBeCloseTo(128, 0)
  expect(geometry.vinyl.height).toBeCloseTo(128, 0)
  expect(geometry.toolbar.height).toBeCloseTo(160, 0)
  expect(spacing.audioToolbar).toBeCloseTo(geometry.toolbar.height, 0)
  expect(geometry.vinyl.left).toBeCloseTo(geometry.layout.contentLeft, 0)
  expect(geometry.vinyl.top).toBeGreaterThanOrEqual(geometry.toolbar.top)
  expect(geometry.vinyl.bottom).toBeLessThanOrEqual(geometry.toolbar.bottom)
  expect(geometry.identity.left).toBeGreaterThanOrEqual(geometry.toolbar.left)
  expect(geometry.identity.right).toBeLessThanOrEqual(geometry.toolbar.right)
  expect(geometry.identity.top).toBeGreaterThanOrEqual(geometry.toolbar.top)
  expect(geometry.identity.bottom).toBeLessThanOrEqual(geometry.toolbar.bottom)
  expect(Math.abs(transportCenter - toolbarCenter)).toBeLessThanOrEqual(1)
  expect(geometry.left?.right ?? Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual((geometry.controls?.left ?? Number.NEGATIVE_INFINITY) - 1)
  expect(geometry.controls?.right ?? Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual((geometry.right?.left ?? Number.NEGATIVE_INFINITY) - 1)
  expect(geometry.minimize?.right ?? 0).toBeLessThanOrEqual(geometry.layout.right)

  if (isDesktop) {
    expect(geometry.volume).not.toBeNull()
    expect(geometry.volume?.left ?? Number.POSITIVE_INFINITY)
      .toBeGreaterThan(geometry.controls?.right ?? Number.NEGATIVE_INFINITY)
    expect(geometry.volume?.right ?? Number.POSITIVE_INFINITY)
      .toBeLessThan(geometry.minimize?.left ?? Number.NEGATIVE_INFINITY)
  } else {
    expect(geometry.volume).toBeNull()
  }

  // The feathered identity plate may paint up to two pixels into the clipped
  // surface edge at the narrow portrait width. It cannot create document or
  // control overflow, both of which remain exact assertions below.
  expect(geometry.surface.scrollWidth).toBeLessThanOrEqual(geometry.surface.clientWidth + 2)
  expect(geometry.surface.scrollHeight).toBeLessThanOrEqual(geometry.surface.clientHeight)
  expect(geometry.layout.scrollWidth).toBeLessThanOrEqual(geometry.layout.clientWidth + 2)
  expect(geometry.layout.scrollHeight).toBeLessThanOrEqual(geometry.layout.clientHeight)
  expect(geometry.document.scrollWidth).toBeLessThanOrEqual(geometry.document.clientWidth)
  expect(geometry.document.scrollHeight).toBeLessThanOrEqual(geometry.document.clientHeight)
})

test("vinyl geometry preserves the breakpoint diameter and exposes only its upper arc when minimized", async ({ page }, testInfo) => {
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize(testInfo.project.name === desktopProject
    ? { width: 1280, height: 900 }
    : { width: 390, height: 844 })
  const toolbar = await startInterruptionNoticeSession(page)
  const expanded = await readVinylPlayerGeometry(toolbar)

  await toolbar.getByRole("button", { name: "Minimize" }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "true")
  const collapsed = await readVinylPlayerGeometry(toolbar)
  const spacing = await resolvedShellSpacing(page)
  const visibleVinylHeight = collapsed.toolbar.bottom - collapsed.vinyl.top

  expect(collapsed.vinyl.width).toBeCloseTo(expanded.vinyl.width, 0)
  expect(collapsed.vinyl.top).toBeGreaterThan(expanded.vinyl.top)
  expect(collapsed.vinyl.top).toBeLessThan(collapsed.toolbar.bottom)
  expect(visibleVinylHeight).toBeGreaterThan(0)
  expect(visibleVinylHeight).toBeLessThan(collapsed.vinyl.height / 2)
  expect(collapsed.identity.width).toBeGreaterThan(0)
  expect(collapsed.vinyl.left).toBeLessThan(collapsed.identity.right)
  expect(collapsed.vinyl.top).toBeLessThan(collapsed.identity.bottom)
  expect(collapsed.identity.top).toBeGreaterThanOrEqual(collapsed.toolbar.top)
  expect(collapsed.identity.bottom).toBeLessThanOrEqual(collapsed.toolbar.bottom)
  expect(collapsed.toolbar.height).toBeCloseTo(72, 0)
  expect(spacing.audioToolbar).toBeCloseTo(collapsed.toolbar.height, 0)
  expect(await toolbar.locator('.ml-music-player-toolbar-layout button[aria-label], .ml-music-player-toolbar-layout a[aria-label], .ml-music-player-toolbar-layout input[aria-label]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label"))))
    .toEqual(["Pause", "Stop", "Expand"])
  expect(collapsed.surface.scrollWidth).toBeLessThanOrEqual(collapsed.surface.clientWidth)
  expect(collapsed.surface.scrollHeight).toBeLessThanOrEqual(collapsed.surface.clientHeight)
  expect(collapsed.layout.scrollWidth).toBeLessThanOrEqual(collapsed.layout.clientWidth)
  expect(collapsed.layout.scrollHeight).toBeLessThanOrEqual(collapsed.layout.clientHeight)
})

test("portrait player vinyl rectangles remain exact across expanded and collapsed states", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Portrait vinyl parity is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const toolbar = await startInterruptionNoticeSession(page)
  const expanded = await readVinylPlayerGeometry(toolbar)

  await toolbar.getByRole("button", { name: "Minimize" }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "true")
  const collapsed = await readVinylPlayerGeometry(toolbar)
  const receipt = {
    collapsed: collapsed.vinyl,
    expanded: expanded.vinyl,
  }
  console.log(`[task-19-portrait-receipt] ${JSON.stringify(receipt)}`)

  expect(receipt).toEqual({
    collapsed: { bottom: 888, height: 128, left: 12, right: 140, top: 760, width: 128 },
    expanded: { bottom: 776, height: 128, left: 12, right: 140, top: 648, width: 128 },
  })
})

test("collapsed portrait actions stay vertically centered in the player bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Portrait collapsed action alignment is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const toolbar = await startInterruptionNoticeSession(page)

  await toolbar.getByRole("button", { name: "Minimize" }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "true")
  const [bar, playPause, stop, expand] = await Promise.all([
    toolbar.boundingBox(),
    toolbar.getByRole("button", { name: "Pause", exact: true }).boundingBox(),
    toolbar.getByRole("button", { name: "Stop", exact: true }).boundingBox(),
    toolbar.getByRole("button", { name: "Expand" }).boundingBox(),
  ])
  if (!bar || !playPause || !stop || !expand) {
    throw new Error("Collapsed portrait player geometry is unavailable")
  }

  const barCenterY = bar.y + bar.height / 2
  const playPauseCenterY = playPause.y + playPause.height / 2
  const stopCenterY = stop.y + stop.height / 2
  const expandCenterY = expand.y + expand.height / 2
  expect(Math.abs(playPauseCenterY - barCenterY)).toBeLessThanOrEqual(1)
  expect(Math.abs(stopCenterY - barCenterY)).toBeLessThanOrEqual(1)
  expect(Math.abs(expandCenterY - barCenterY)).toBeLessThanOrEqual(1)
  expect(Math.abs(playPauseCenterY - stopCenterY)).toBeLessThanOrEqual(1)
  expect(Math.abs(stopCenterY - expandCenterY)).toBeLessThanOrEqual(1)
})

test("rail inset keeps constrained-landscape vinyl geometry seven pixels inside in both player states", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Landscape rail inset is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 844, height: 390 })
  const toolbar = await startInterruptionNoticeSession(page)
  const viewports = [
    { width: 844, height: 390 },
    { width: 746, height: 284 },
    { width: 915, height: 412 },
  ] as const
  const readRailState = async () => {
    const [rail, vinyl, layer, clipping] = await Promise.all([
      toolbar.boundingBox(),
      toolbar.getByTestId("station-vinyl").boundingBox(),
      toolbar.locator(".ml-station-vinyl-layer").boundingBox(),
      toolbar.locator(".ml-music-player-toolbar-surface").evaluate((surface) => ({
        overflowX: getComputedStyle(surface).overflowX,
        overflowY: getComputedStyle(surface).overflowY,
      })),
    ])
    if (!rail || !vinyl || !layer) throw new Error("Rail vinyl geometry is unavailable")
    return { clipping, layer, rail, vinyl }
  }
  const receipts: Array<{
    collapsed: Awaited<ReturnType<typeof readRailState>>
    expanded: Awaited<ReturnType<typeof readRailState>>
    viewport: typeof viewports[number]
  }> = []

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expect(toolbar).toHaveAttribute("data-layout", "rail")
    if (await toolbar.getAttribute("data-collapsed") === "true") {
      await toolbar.getByRole("button", { name: "Expand" }).click()
    }
    await expect(toolbar).toHaveAttribute("data-collapsed", "false")
    const expanded = await readRailState()

    await toolbar.getByRole("button", { name: "Minimize" }).click()
    await expect(toolbar).toHaveAttribute("data-collapsed", "true")
    const collapsed = await readRailState()
    receipts.push({ collapsed, expanded, viewport })
  }

  console.log(`[task-19-rail-receipt] ${JSON.stringify(receipts)}`)
  for (const { collapsed, expanded, viewport } of receipts) {
    const label = `${viewport.width}x${viewport.height}`
    for (const [state, geometry] of [["expanded", expanded], ["collapsed", collapsed]] as const) {
      expect(geometry.vinyl.x, `${label} ${state} left inset`).toBeCloseTo(geometry.rail.x + 7, 0)
      expect(geometry.vinyl.y, `${label} ${state} top inset`).toBeCloseTo(geometry.rail.y + 7, 0)
      expect(geometry.vinyl.width, `${label} ${state} diameter`).toBeCloseTo(expanded.rail.width - 14, 0)
      expect(geometry.vinyl.height, `${label} ${state} round diameter`).toBeCloseTo(geometry.vinyl.width, 0)
      expect(geometry.layer.x, `${label} ${state} clip left`).toBeCloseTo(geometry.rail.x, 0)
      expect(geometry.layer.width, `${label} ${state} clip width`).toBeCloseTo(geometry.rail.width, 0)
      expect(geometry.clipping.overflowX, `${label} ${state} horizontal clipping`).toBe("hidden")
    }
    expect(collapsed.vinyl.width, `${label} retained collapsed diameter`).toBeCloseTo(expanded.vinyl.width, 0)
    expect(collapsed.vinyl.x + collapsed.vinyl.width, `${label} collapsed vinyl extends beyond clip`)
      .toBeGreaterThan(collapsed.layer.x + collapsed.layer.width)
    expect(collapsed.vinyl.x, `${label} collapsed left arc starts inside clip`).toBeGreaterThan(collapsed.layer.x)
    expect(collapsed.vinyl.x, `${label} collapsed left arc remains visible`)
      .toBeLessThan(collapsed.layer.x + collapsed.layer.width)
  }
})

test("vinyl geometry keeps short landscape complete with exact safe-area offsets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Short-landscape vinyl geometry is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 844, height: 390 })
  const toolbar = await startInterruptionNoticeSession(page)
  await page.getByRole("button", { name: "Open quick actions" }).click()
  await page.getByRole("link", { name: "Quick Log" }).click()
  await expect(page).toHaveURL(/\/wellness#quick-log$/)
  await expect(toolbar).toHaveAttribute("data-layout", "rail")
  await expect(page.locator("body")).toHaveClass(/ml-music-player-rail/)
  const notice = page.getByTestId("music-interruption-notice")
  await page.locator("body").evaluate((body) => {
    body.style.setProperty("--ml-safe-bottom", "24px")
    body.style.setProperty("--ml-safe-left", "24px")
    body.style.setProperty("--ml-safe-right", "32px")
  })

  const geometry = await readVinylPlayerGeometry(toolbar)
  const spacing = await resolvedShellSpacing(page)
  const railSpacing = await resolvedMusicRailSpacing(page)
  const noticeGeometry = await settledOverlayGeometry(
    notice,
    toolbar,
    { width: 844, height: 390 },
    "wellness interruption notice",
  )
  const appScrollHeight = await page.locator(".ml-app-scroll").evaluate((element) => element.clientHeight)
  expect(geometry.vinyl.width).toBeCloseTo(geometry.toolbar.width - 14, 0)
  expect(geometry.vinyl.height).toBeCloseTo(geometry.vinyl.width, 0)
  expect(geometry.toolbar.right).toBeCloseTo(844, 0)
  expect(geometry.toolbar.height).toBeCloseTo(390 - spacing.bottomStack, 0)
  expect(geometry.layout.paddingLeft).toBeCloseTo(12, 0)
  expect(geometry.layout.paddingRight).toBeCloseTo(32, 0)
  expect(geometry.layout.contentLeft).toBeCloseTo(geometry.layout.left + 12, 0)
  expect(geometry.layout.contentRight).toBeCloseTo(geometry.layout.right - 32, 0)
  expect(geometry.vinyl.left).toBeCloseTo(geometry.toolbar.left + 7, 0)
  expect(geometry.vinyl.top).toBeCloseTo(geometry.toolbar.top + 7, 0)
  expect(geometry.layout.scrollHeight).toBeLessThanOrEqual(geometry.layout.clientHeight)
  expect(geometry.layout.scrollWidth).toBeLessThanOrEqual(geometry.layout.clientWidth)
  expect(appScrollHeight).toBeGreaterThan(0)
  expect(spacing.safeBottom).toBeCloseTo(24, 0)
  expect(spacing.audioToolbar).toBe(0)
  expect(spacing.chimerBottom).toBeCloseTo(spacing.bottomStack + 12, 0)
  expect(spacing.chimerPanelBottom).toBeCloseTo(spacing.bottomStack + 12, 0)
  expect(railSpacing.railWidth).toBeCloseTo(geometry.toolbar.width, 0)
  expect(railSpacing.rightSafe).toBeCloseTo(geometry.toolbar.width + 32, 0)
  expect(noticeGeometry.surface.x + noticeGeometry.surface.width)
    .toBeLessThanOrEqual(noticeGeometry.rail.x + 1)
})

test("Atmosphere interruption notice counts only active unhovered and unfocused time", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "The notice timer contract is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.clock.install()
  await page.setViewportSize({ width: 390, height: 844 })
  const player = await startInterruptionNoticeSession(page)
  const notice = page.getByRole("region", { name: "Interruption preference" })
  await expect(notice).toBeVisible()

  await page.clock.fastForward("00:10")
  // Dispatch the boundary events directly. Pointer coordinates can be
  // recomputed while fake time advances and make a real hover leave early on
  // slower CI runners, even though the notice itself has not moved.
  await notice.dispatchEvent("mouseover")
  await page.clock.fastForward("00:40")
  await expect(notice).toBeVisible()
  await notice.dispatchEvent("mouseout")
  await page.clock.fastForward(13_500)
  await expect(notice).toBeVisible()
  await page.clock.fastForward(500)
  await expect(notice).toBeHidden()

  await player.getByRole("button", { name: "Stop", exact: true }).click()
  await player.getByRole("button", { name: "Play", exact: true }).click()
  await expect(notice).toBeVisible()
  await notice.getByRole("checkbox", {
    name: "Resume automatically when the interruption ends",
  }).focus()
  await page.clock.fastForward("01:00")
  await expect(notice).toBeVisible()
  await player.getByRole("button", { name: "Minimize", exact: true }).focus()
  await page.clock.fastForward(23_500)
  await expect(notice).toBeVisible()
  await page.clock.fastForward(500)
  await expect(notice).toBeHidden()
})

test("Atmosphere interruption notice schedules auto-dismiss after 24 unattended seconds", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "The exact notice deadline is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    Reflect.set(window, "__interruptionNoticeTimeouts", [])
    window.setTimeout = ((handler: TimerHandler, timeout = 0, ...args: unknown[]) => {
      if (timeout >= 20_000 && timeout <= 30_000) {
        const timeouts = Reflect.get(window, "__interruptionNoticeTimeouts") as number[]
        timeouts.push(timeout)
      }
      return nativeSetTimeout(handler, timeout, ...args)
    }) as typeof window.setTimeout
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await startInterruptionNoticeSession(page)
  const notice = page.getByRole("region", { name: "Interruption preference" })
  await expect(notice).toBeVisible()
  await expect.poll(() => page.evaluate(() => (
    Reflect.get(window, "__interruptionNoticeTimeouts") as number[]
  ))).toContain(24_000)
})

test("stopped retirement exclusions do not cancel or extend the route and player deadline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Stopped rail retirement is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.clock.install()
  await page.setViewportSize({ width: 844, height: 390 })
  const player = await startInterruptionNoticeSession(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  const notice = page.getByRole("region", { name: "Interruption preference" })
  if (await notice.isVisible()) {
    await notice.getByRole("button", { name: "Close" }).click()
  }
  await page.evaluate(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = ((handler: TimerHandler, timeout = 0, ...args: unknown[]) => {
      if (timeout === 60_000) {
        Reflect.set(window, "__task21StoppedDeadline", Date.now() + timeout)
      }
      return nativeSetTimeout(handler, timeout, ...args)
    }) as typeof window.setTimeout
  })

  await player.getByRole("button", { name: "Stop", exact: true }).click()
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await expect(page.locator("body")).toHaveClass(/ml-music-player-active/)
  await expect(page.locator("body")).toHaveClass(/ml-music-player-rail/)

  const pausedAt = await page.evaluate(() => Date.now() + 1_000)
  await page.clock.pauseAt(pausedAt)
  const stoppedDeadline = await page.evaluate(() => Number(Reflect.get(window, "__task21StoppedDeadline")))
  const firstActionDelayMs = stoppedDeadline - 50_000 - pausedAt
  expect(firstActionDelayMs).toBeGreaterThan(0)
  await page.clock.fastForward(firstActionDelayMs)
  await player.getByRole("button", { name: /Favorite MassageLab Proof Drone/i }).click()
  await expect(player).toHaveAttribute("data-playback-state", "stopped")

  await page.clock.fastForward(10_000)
  await player.getByRole("button", { name: "Player settings" }).click()
  await expect(page.getByRole("menuitemcheckbox", { name: "Resume after interruptions" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(player).toHaveAttribute("data-playback-state", "stopped")

  await page.clock.fastForward(10_000)
  await player.getByRole("button", { name: "Minimize", exact: true }).click()
  await expect(page.locator("body")).toHaveClass(/ml-music-player-collapsed/)
  await player.getByRole("button", { name: "Expand", exact: true }).click()
  await expect(page.locator("body")).not.toHaveClass(/ml-music-player-collapsed/)

  await page.clock.fastForward(10_000)
  await player.getByRole("link", { name: "Background" }).click()
  await expect(page).toHaveURL(/\/clock\?.*source=music/)
  await expect(player).toHaveAttribute("data-playback-state", "stopped")

  await page.clock.fastForward(19_999)
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await expect(page.locator("body")).toHaveClass(/ml-music-player-(?:active|rail)/)
  await page.clock.fastForward(1)
  await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
  await expect(page.locator("body")).not.toHaveClass(/ml-music-player-(?:active|rail|collapsed)/)
  console.log(`[task-21-exclusions] ${JSON.stringify({
    actionsAtMs: [10_000, 20_000, 30_000, 40_000],
    expiredAtMs: 60_000,
    retainedAtMs: 59_999,
  })}`)
})

test("Atmosphere interruption notice clears the toolbar in short landscape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Short-landscape geometry is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 667, height: 375 })
  const player = await startInterruptionNoticeSession(page)
  const notice = page.getByRole("region", { name: "Interruption preference" })
  const controls = player.getByTestId("music-player-toolbar-controls")

  await expect(notice).toBeVisible()
  const geometry = await page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>('[data-testid="music-player-toolbar"]')
    const noticeElement = document.querySelector<HTMLElement>('[data-testid="music-interruption-notice"]')
    const controlElement = document.querySelector<HTMLElement>('[data-testid="music-player-toolbar-controls"]')
    if (!toolbar || !noticeElement || !controlElement) throw new Error("Player geometry elements are missing")
    const toolbarBox = toolbar.getBoundingClientRect()
    const noticeBox = noticeElement.getBoundingClientRect()
    return {
      bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controlsOverflow: controlElement.scrollWidth - controlElement.clientWidth,
      noticeBottom: noticeBox.bottom,
      noticeLeft: noticeBox.left,
      noticeRight: noticeBox.right,
      noticeTop: noticeBox.top,
      toolbarLeft: toolbarBox.left,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }
  })
  expect(geometry.noticeRight).toBeLessThanOrEqual(geometry.toolbarLeft)
  expect(geometry.bodyOverflow).toBeLessThanOrEqual(0)
  expect(geometry.controlsOverflow).toBeLessThanOrEqual(0)
  expect(geometry.noticeTop).toBeGreaterThanOrEqual(0)
  expect(geometry.noticeBottom).toBeLessThanOrEqual(geometry.viewportHeight)
  expect(geometry.noticeLeft).toBeGreaterThanOrEqual(0)
  expect(geometry.noticeRight).toBeLessThanOrEqual(geometry.viewportWidth)
  await expect(controls.locator("[aria-label]")).toHaveCount(8)
})

test("Atmosphere interruption notice follows the actual rail edge with safe insets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Actual-edge landscape geometry is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 667, height: 375 })
  const player = await startInterruptionNoticeSession(page)
  await page.getByRole("link", { name: "Open clock" }).click()
  await expect(page).toHaveURL(/\/clock$/)
  await expect(player).toHaveAttribute("data-layout", "rail")
  const notice = page.getByRole("region", { name: "Interruption preference" })
  await page.addStyleTag({ content: `
    [data-testid="music-player-toolbar-identity"] > p {
      font-size: 28px !important;
      line-height: 36px !important;
    }
  ` })

  await page.locator("body").evaluate((body) => {
    body.style.setProperty("--ml-safe-bottom", "24px")
    body.style.setProperty("--ml-safe-right", "32px")
  })
  await expect(notice).toBeVisible()
  const { rail, surface } = await settledOverlayGeometry(
    notice,
    player,
    { width: 667, height: 375 },
    "clock rail interruption notice",
  )
  const controls = await player.getByTestId("music-player-toolbar-controls").boundingBox()
  const spacing = await resolvedMusicRailSpacing(page)
  expect(surface.x).toBeGreaterThanOrEqual(0)
  expect(surface.y).toBeGreaterThanOrEqual(0)
  expect(surface.x + surface.width).toBeLessThanOrEqual(rail.x + 1)
  expect(surface.y + surface.height).toBeLessThanOrEqual(375)
  expect(controls?.x ?? -1).toBeGreaterThanOrEqual(rail.x)
  expect((controls?.x ?? 0) + (controls?.width ?? 0)).toBeLessThanOrEqual(667)
  expect((controls?.y ?? 0) + (controls?.height ?? 0)).toBeLessThanOrEqual(rail.y + rail.height)
  expect(spacing.rightSafe).toBeCloseTo(rail.width + 32, 0)
})

test("Atmosphere interruption controls disclose unsupported media integration", async ({ page }) => {
  await installInterruptionNoticeMediaFakes(page, { rejectCarrierPlay: true })
  await page.setViewportSize({ width: 390, height: 844 })
  const player = await startInterruptionNoticeSession(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(page.getByRole("region", { name: "Interruption preference" })).toHaveCount(0)
  await player.getByRole("button", { name: "Player settings" }).click()
  await expect(page.getByRole("menuitemcheckbox", { name: "Resume after interruptions" }))
    .toHaveAttribute("aria-disabled", "true")
})

test("mobile top placement reserves the top edge and leaves the active music player bottom-based", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Mobile stacking is covered in mobile Chromium.")
  const safeBottom = 24
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "top", sidebarPosition: "left", sidebarTriggerPosition: "top", themeMode: "dark",
  })))
  await gotoShell(page, "/music")

  await page.locator("body").evaluate(
    (body, value) => body.style.setProperty("--ml-safe-bottom", `${value}px`),
    safeBottom,
  )
  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const barBox = await bar.boundingBox()
  expect(barBox?.y).toBeLessThanOrEqual(1)

  const idleSpacing = await resolvedShellSpacing(page)
  const idleExpected = idleSpacing.bottomStack + idleSpacing.pageEdgeGap + idleSpacing.scrollEndBuffer
  expect(idleSpacing.bottomStack).toBeCloseTo(idleSpacing.safeBottom)
  expect(idleSpacing.pageBottom).toBeCloseTo(idleExpected)
  expect(idleSpacing.pageBottom).not.toBeCloseTo(idleExpected + idleSpacing.mainBar)

  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const player = page.getByTestId("music-player-toolbar")
  await expect(player).toBeVisible()
  await expect(player).toHaveAttribute("data-placement", "bottom")
  await expect(page.locator("body")).toHaveClass(/ml-music-player-active/)
  const activeSpacing = await resolvedShellSpacing(page)
  const activeExpected = activeSpacing.bottomStack
    + activeSpacing.pageEdgeGap
    + activeSpacing.scrollEndBuffer
    + activeSpacing.audioToolbar
  expect(activeSpacing.bottomStack).toBeCloseTo(activeSpacing.safeBottom)
  expect(activeSpacing.audioToolbar).toBeCloseTo(160, 0)
  expect(activeSpacing.pageBottom).toBeCloseTo(activeExpected)
  expect(activeSpacing.pageBottom).not.toBeCloseTo(activeExpected + activeSpacing.mainBar)
  expect(activeSpacing.chimerBottom).toBeCloseTo(activeSpacing.bottomStack + 160 + 12, 0)
  expect(activeSpacing.chimerPanelBottom).toBeCloseTo(activeSpacing.bottomStack + 160 + 12, 0)
  const expandedPlayerBox = await player.boundingBox()
  expect(expandedPlayerBox?.height ?? 0).toBeCloseTo(activeSpacing.audioToolbar, 0)
  await expectSafeAreaToolbarGeometry(
    player,
    160,
    160,
    activeSpacing.bottomStack,
    ["Previous station", "Pause", "Stop", "Next station", "Background", "Player settings", "Minimize"],
  )
  expect((expandedPlayerBox?.y ?? 0) + (expandedPlayerBox?.height ?? 0)).toBeGreaterThan(700)
  expect(expandedPlayerBox?.y ?? 0).toBeGreaterThan((barBox?.y ?? 0) + (barBox?.height ?? 0))

  await player.getByRole("button", { name: "Minimize", exact: true }).click()
  await expect(page.locator("body")).toHaveClass(/ml-music-player-collapsed/)
  const collapsedSpacing = await resolvedShellSpacing(page)
  const collapsedExpected = collapsedSpacing.bottomStack
    + collapsedSpacing.pageEdgeGap
    + collapsedSpacing.scrollEndBuffer
    + 72
  expect(collapsedSpacing.audioToolbar).toBeCloseTo(72, 0)
  expect(collapsedSpacing.audioToolbar).toBeLessThan(activeSpacing.audioToolbar)
  expect(collapsedSpacing.pageBottom).toBeCloseTo(collapsedExpected)
  expect(collapsedSpacing.chimerBottom).toBeCloseTo(collapsedSpacing.bottomStack + 72 + 12, 0)
  expect(collapsedSpacing.chimerPanelBottom).toBeCloseTo(collapsedSpacing.bottomStack + 72 + 12, 0)
  const collapsedPlayerBox = await player.boundingBox()
  expect(collapsedPlayerBox?.height ?? 0).toBeCloseTo(collapsedSpacing.audioToolbar, 0)
  await expectSafeAreaToolbarGeometry(
    player,
    72,
    72,
    collapsedSpacing.bottomStack,
    ["Pause", "Stop", "Expand"],
  )
  await player.getByRole("button", { name: "Expand", exact: true }).click()
  await page.getByRole("button", { name: "Stop" }).last().click()
})

test("mobile bottom placement adds the main bar when idle and the audio toolbar only while active", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Mobile stacking is covered in mobile Chromium.")
  const safeBottom = 24
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom", sidebarPosition: "left", sidebarTriggerPosition: "bottom", themeMode: "dark",
  })))
  await gotoShell(page, "/music")
  await page.locator("body").evaluate(
    (body, value) => body.style.setProperty("--ml-safe-bottom", `${value}px`),
    safeBottom,
  )

  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const barBox = await bar.boundingBox()
  expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeGreaterThanOrEqual(843)

  const idleSpacing = await resolvedShellSpacing(page)
  const idleExpectedStack = idleSpacing.safeBottom + idleSpacing.mainBar
  const idleExpected = idleExpectedStack + idleSpacing.pageEdgeGap + idleSpacing.scrollEndBuffer
  expect(idleSpacing.bottomStack).toBeCloseTo(idleExpectedStack)
  expect(idleSpacing.pageBottom).toBeCloseTo(idleExpected)

  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const player = page.getByTestId("music-player-toolbar")
  await expect(player).toBeVisible()
  await expect(player).toHaveAttribute("data-placement", "bottom")
  await expect(page.locator("body")).toHaveClass(/ml-music-player-active/)
  const activeSpacing = await resolvedShellSpacing(page)
  const activeExpected = activeSpacing.bottomStack
    + activeSpacing.pageEdgeGap
    + activeSpacing.scrollEndBuffer
    + activeSpacing.audioToolbar
  expect(activeSpacing.bottomStack).toBeCloseTo(activeSpacing.safeBottom + activeSpacing.mainBar)
  expect(activeSpacing.audioToolbar).toBeCloseTo(160, 0)
  expect(activeSpacing.pageBottom).toBeCloseTo(activeExpected)
  expect(activeSpacing.pageBottom - idleSpacing.pageBottom).toBeCloseTo(activeSpacing.audioToolbar)
  expect(activeSpacing.chimerBottom).toBeCloseTo(activeSpacing.bottomStack + 160 + 12, 0)
  expect(activeSpacing.chimerPanelBottom).toBeCloseTo(activeSpacing.bottomStack + 160 + 12, 0)
  const expandedPlayerBox = await player.boundingBox()
  expect(expandedPlayerBox?.height ?? 0).toBeCloseTo(activeSpacing.audioToolbar, 0)
  await expectSafeAreaToolbarGeometry(
    player,
    160,
    160,
    activeSpacing.bottomStack,
    ["Previous station", "Pause", "Stop", "Next station", "Background", "Player settings", "Minimize"],
  )
  expect((expandedPlayerBox?.y ?? 0) + (expandedPlayerBox?.height ?? 0)).toBeLessThanOrEqual((barBox?.y ?? 0) + 1)

  await player.getByRole("button", { name: "Minimize", exact: true }).click()
  await expect(page.locator("body")).toHaveClass(/ml-music-player-collapsed/)
  const collapsedSpacing = await resolvedShellSpacing(page)
  const collapsedExpected = collapsedSpacing.bottomStack
    + collapsedSpacing.pageEdgeGap
    + collapsedSpacing.scrollEndBuffer
    + 72
  expect(collapsedSpacing.audioToolbar).toBeCloseTo(72, 0)
  expect(collapsedSpacing.audioToolbar).toBeLessThan(activeSpacing.audioToolbar)
  expect(collapsedSpacing.pageBottom).toBeCloseTo(collapsedExpected)
  expect(collapsedSpacing.chimerBottom).toBeCloseTo(collapsedSpacing.bottomStack + 72 + 12, 0)
  expect(collapsedSpacing.chimerPanelBottom).toBeCloseTo(collapsedSpacing.bottomStack + 72 + 12, 0)
  const collapsedPlayerBox = await player.boundingBox()
  expect(collapsedPlayerBox?.height ?? 0).toBeCloseTo(collapsedSpacing.audioToolbar, 0)
  await expectSafeAreaToolbarGeometry(
    player,
    72,
    72,
    collapsedSpacing.bottomStack,
    ["Pause", "Stop", "Expand"],
  )
  await player.getByRole("button", { name: "Expand", exact: true }).click()
  await page.getByRole("button", { name: "Stop" }).last().click()
})

test("mobile top player consumes its safe inset exactly once while expanded and collapsed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Mobile top toolbar geometry is covered in mobile Chromium.")
  const safeTop = 24
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()

  const player = page.getByTestId("music-player-toolbar")
  await expect(player).toBeVisible()
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 45_000 })
  await placeRenderedToolbarAtTop(player, safeTop)
  await expect(player).toHaveAttribute("data-placement", "top")

  let spacing = await resolvedShellSpacing(page)
  await expectTopSafeAreaToolbarGeometry(
    player,
    184,
    160,
    spacing.safeTop,
    ["Previous station", "Pause", "Stop", "Next station", "Background", "Player settings", "Minimize"],
  )
  expect(spacing.pageTop).toBeCloseTo(184, 0)
  expect(spacing.chimerTop).toBeCloseTo(184 + 12, 0)
  expect(spacing.chimerSettingsTop).toBeCloseTo(184 + 76, 0)

  await player.getByRole("button", { name: "Minimize", exact: true }).click()
  await placeRenderedToolbarAtTop(player, safeTop)
  spacing = await resolvedShellSpacing(page)
  await expectTopSafeAreaToolbarGeometry(player, 96, 72, spacing.safeTop, ["Pause", "Stop", "Expand"])
  expect(spacing.pageTop).toBeCloseTo(96, 0)
  expect(spacing.chimerTop).toBeCloseTo(96 + 12, 0)
  expect(spacing.chimerSettingsTop).toBeCloseTo(96 + 76, 0)

  await player.getByRole("button", { name: "Stop", exact: true }).click()
})

test("mobile loading toolbar fits expanded and collapsed increased-text content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Mobile loading geometry is covered in mobile Chromium.")
  const safeBottom = 24
  let releaseSampleIndex: () => void = () => undefined
  let matchedSampleIndexUrl: string | null = null
  const sampleIndexGate = new Promise<void>((resolve) => {
    releaseSampleIndex = resolve
  })
  const sampleIndexPattern = "**/observable-streams-vsco-adaptation/sample-index*.json"
  const sampleIndexHandler = async (route: Route) => {
    matchedSampleIndexUrl = route.request().url()
    await sampleIndexGate
    await abortHeldFixtureRequest(route)
  }
  await page.route(sampleIndexPattern, sampleIndexHandler)
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoShell(page, "/music")
    await page.locator("body").evaluate(
      (body, value) => body.style.setProperty("--ml-safe-bottom", `${value}px`),
      safeBottom,
    )
    await page.addStyleTag({ content: `
      [data-testid="music-player-toolbar-identity"] > p {
        font-size: 24px !important;
        line-height: 30px !important;
      }
    ` })

    await centerCarouselItem(page, "observable-streams-probe", "Next station")
    await page.getByRole("button", { name: /^Play Observable Streams$/i }).click()
    await expect.poll(() => matchedSampleIndexUrl).toMatch(
      /\/observable-streams-vsco-adaptation\/sample-index(?:\.[^/?]+)?\.json(?:\?.*)?$/,
    )
    const player = page.getByTestId("music-player-toolbar")
    await expect(player).toHaveAttribute("data-playback-state", "loading")
    await expectCompactLoadingIdentity(player)

    let spacing = await resolvedShellSpacing(page)
    expect(spacing.audioToolbar).toBeCloseTo(160, 0)
    await expectSafeAreaToolbarGeometry(
      player,
      160,
      160,
      spacing.bottomStack,
      ["Previous station", "Play", "Cancel loading", "Next station", "Background", "Player settings", "Minimize"],
    )

    await player.getByRole("button", { name: "Minimize", exact: true }).click()
    await expect(player).toHaveAttribute("data-collapsed", "true")
    await expect(player).toHaveAttribute("data-playback-state", "loading")
    await expectCompactLoadingIdentity(player)
    spacing = await resolvedShellSpacing(page)
    expect(spacing.audioToolbar).toBeCloseTo(72, 0)
    await expectSafeAreaToolbarGeometry(
      player,
      72,
      72,
      spacing.bottomStack,
      ["Play", "Cancel loading", "Expand"],
    )

    await player.getByRole("button", { name: "Cancel loading", exact: true }).click()
  } finally {
    releaseSampleIndex()
    await page.unroute(sampleIndexPattern, sampleIndexHandler)
  }
})

test("running alerting and preview capture clear computed shell offsets while bars are hidden", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom", sidebarPosition: "left", sidebarTriggerPosition: "bottom", themeMode: "dark",
  })))
  await gotoShell(page, "/wellness")
  // Opening a client-owned menu is the hydration barrier for the route cleanup
  // effect that removes stale immersive classes after navigation.
  await openAccountMenu(page)
  await expect(page.getByRole("menuitem", { name: "Help & FAQ" })).toBeVisible()
  await page.keyboard.press("Escape")

  for (const bodyClass of ["chimer-running", "chimer-alerting", "chimer-preview-capture"]) {
    await expectImmersiveOffsetsCleared(page, bodyClass)
  }
})
