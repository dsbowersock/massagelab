import { expect, test, type Locator, type Page } from "@playwright/test"
import { withPlayerViewportCollisionPadding } from "../../components/ui/use-player-viewport-insets"
import { centerCarouselItem } from "./carousel-test-helpers"

const desktopProject = "desktop-chromium"
const mobileProject = "mobile-chromium"

async function gotoShell(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
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

async function openAccountMenu(page: Page) {
  const trigger = page.getByTestId("account-menu-trigger")

  if (!await trigger.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Open navigation" }).click()
  }

  await expect(trigger).toBeVisible()
  await trigger.click()
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
    const playStop = required<HTMLElement>("button[aria-label='Stop'], button[aria-label='Play']")
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
      playStop: rect(playStop),
      right: right ? rect(right) : null,
      surface: {
        ...rect(surface),
        clientHeight: surface.clientHeight,
        clientWidth: surface.clientWidth,
        scrollHeight: surface.scrollHeight,
        scrollWidth: surface.scrollWidth,
      },
      toolbar: rect(root),
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

async function expectStableMainBarControls(page: Page) {
  const usesMobileBar = (page.viewportSize()?.width ?? 0) < 768
  const usesModalDrawer = (page.viewportSize()?.width ?? 0) <= 600
  const bar = usesMobileBar
    ? page.locator(".ml-mobile-main-bar")
    : page.locator(".ml-app-topbar")
  const drawerCluster = bar.locator(usesMobileBar ? ".ml-main-bar-drawer-brand" : ".ml-app-bar-drawer-brand")
  const drawer = drawerControl(drawerCluster)
  const drawerEdge = await drawerCluster.getAttribute("data-drawer-edge")
  const tools = bar.locator(".ml-main-bar-tools")
  const controls = tools.locator('a[aria-label], button[aria-label]')
  const quickCreate = bar.locator('button[data-quick-action-trigger="true"]')
  const expectedLabels = drawerEdge === "right"
    ? [...MAIN_BAR_TOOL_LABELS].reverse()
    : [...MAIN_BAR_TOOL_LABELS]

  await expect(bar).toBeVisible()
  await expect(drawer.locator('svg[data-icon="menu"]')).toHaveCount(1)
  await expect(drawer).toHaveAttribute("aria-label", "Open navigation")
  await expect(drawer).toHaveAttribute("aria-expanded", "false")
  await expect(controls).toHaveCount(expectedLabels.length)
  expect(await controls.evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label"))))
    .toEqual(expectedLabels)

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
  const [barBox, drawerBox, brandBox, toolsBox] = await Promise.all([
    bar.boundingBox(),
    drawer.boundingBox(),
    brand.boundingBox(),
    tools.boundingBox(),
  ])

  expect(barBox?.x).toBeLessThanOrEqual(1)
  expect(barBox?.width).toBeGreaterThanOrEqual(762)
  expect(barBox?.height).toBeCloseTo(52, 0)
  await expectStableMainBarControls(page)
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

    await expectStableMainBarControls(page)
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
    await expectStableMainBarControls(page)
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
  await expectStableMainBarControls(page)
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
      const rootFontSize = await page.locator("html").evaluate((root) => Number.parseFloat(getComputedStyle(root).fontSize))
      expect(rail.width, `${stateLabel} 7rem rail`).toBeCloseTo(rootFontSize * 7, 0)
      expect(vinyl.width, `${stateLabel} retained diameter`).toBeCloseTo(expectedDiameter ?? 0, 0)
      expect(vinyl.x + vinyl.width, `${stateLabel} clipped right arc`)
        .toBeGreaterThan(layer.x + layer.width)
      const visibleVinylWidth = Math.min(vinyl.x + vinyl.width, layer.x + layer.width)
        - Math.max(vinyl.x, layer.x)
      expect(visibleVinylWidth, `${stateLabel} visible left arc`).toBeCloseTo(rail.width - 7, 0)
      await expect(toolbar.getByTestId("music-player-toolbar-identity")).toBeHidden()
      expect(await actionLabels()).toEqual(["Stop", "Expand"])
    } else {
      expect(vinyl.width, `${stateLabel} expanded diameter`).toBeCloseTo(rail.width - 14, 0)
      await expect(toolbar.getByTestId("music-player-toolbar-identity")).toBeVisible()
      expect(await toolbar.getByTestId("music-player-toolbar-rail-transport")
        .locator("button[aria-label]").evaluateAll((actions) => actions.map((action) => action.getAttribute("aria-label"))))
        .toEqual(["Previous station", "Stop", "Next station"])
      expect(await toolbar.getByTestId("music-player-toolbar-rail-options")
        .locator("button[aria-label], a[aria-label]").evaluateAll((actions) => actions.map((action) => action.getAttribute("aria-label"))))
        .toEqual(["Player settings", "Favorite MassageLab Proof Drone", "Background", "Minimize"])
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
    const previous = carouselRegion.getByRole("button", { name: "Previous station" })
    const next = carouselRegion.getByRole("button", { name: "Next station" })
    const summaries = carouselRegion.locator(
      '[data-carousel-slide][data-detail-level="summary"] [data-carousel-transform="true"]',
    )
    await expect(carouselRegion.locator('[data-station-carousel-controls="true"]')).toBeAttached()
    await expect(summaries).toHaveCount(2)
    await expect.poll(async () => {
      const [previousBox, nextBox, summaryBoxes] = await Promise.all([
        previous.boundingBox(),
        next.boundingBox(),
        summaries.evaluateAll((elements) => elements.map((element) => {
          const box = element.getBoundingClientRect()
          return { y: box.y, height: box.height }
        }).sort((left, right) => left.y - right.y)),
      ])
      if (!previousBox || !nextBox || summaryBoxes.length !== 2) return Number.POSITIVE_INFINITY
      return Math.max(
        Math.abs(previousBox.y - (summaryBoxes[0].y + summaryBoxes[0].height + 16)),
        Math.abs(nextBox.y - (summaryBoxes[1].y + summaryBoxes[1].height + 16)),
      )
    }).toBeLessThanOrEqual(1)
    const [previousBox, nextBox, stageBox, summaryBoxes] = await Promise.all([
      previous.boundingBox(),
      next.boundingBox(),
      stage.boundingBox(),
      summaries.evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }).sort((left, right) => left.x - right.x)),
    ])
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
    expect(Math.abs(
      (previousBox?.y ?? 0) - (leftSummary.y + leftSummary.height + 16),
    ), `${label} previous vertical offset`).toBeLessThanOrEqual(1)
    expect(Math.abs(
      (nextBox?.y ?? 0) - (rightSummary.y + rightSummary.height + 16),
    ), `${label} next vertical offset`).toBeLessThanOrEqual(1)
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
    const [allocationBox, stageBox, centerBox, pillsBox, scrollBox, mainBarBox] = await Promise.all([
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
    ])
    expect(stageBox?.y ?? 0, `${label} stage top`).toBeCloseTo(
      (pillsBox?.y ?? 0) + (pillsBox?.height ?? 0) + pillPaintSpace.marginBottom,
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
    expect(centerBox?.height ?? 0, `${label} centered card height`).toBeCloseTo(stageBox?.height ?? 0, 0)
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
    await expect(nonShellCards).toHaveCount(3)
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
        await expect(nonShellCards).toHaveCount(3)
        await expect(carouselRegion).toHaveAttribute("data-carousel-ready", "true")
        const remountLabel = `${viewport.width}x${viewport.height} ${categoryName}`
        await assertStationControlGeometry(remountLabel)
        const remountPillPaintSpace = await assertPillHaloPaintSpace(remountLabel)
        await assertConstrainedStationStageFit(remountLabel, remountPillPaintSpace)
      }
    }

    for (let index = 0; index < 3; index += 1) {
      await expect(nonShellCards.nth(index)).toBeInViewport({ ratio: 0.15 })
      await assertContained(nonShellCards.nth(index), stage, `${viewport.width}x${viewport.height} card ${index}`)
    }

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
  await expect(categoryGroup.getByRole("button")).toHaveCount(5)
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
  ))).toEqual(["Previous station", "Stop", "Next station"])
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
    const leftCardBox = visualCardBoxes[0]
    const rightCardBox = visualCardBoxes[visualCardBoxes.length - 1]
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
  test.skip(response?.status() === 404, "The real Popover fixture is intentionally development-only.")
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

test("stable portrait station cards survive expanded collapsed stopped and restarted player state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Portrait station geometry is covered in mobile Chromium.")
  await installInterruptionNoticeMediaFakes(page)
  await installStationCapabilityQueries(page, { reducedMotion: false, finePointer: false })
  const receipt: Array<Record<string, unknown>> = []

  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 670 }]) {
    await page.setViewportSize(viewport)
    const toolbar = await startProofDrone(page)
    const carousel = page.getByRole("region", { name: "Station carousel" })
    const readCards = async (state: string) => {
      await expect(carousel.locator('[data-carousel-slide]:not([data-detail-level="shell"])')).toHaveCount(3)
      const boxes = await carousel.locator(
        '[data-carousel-slide]:not([data-detail-level="shell"]) [data-carousel-transform="true"]',
      ).evaluateAll((elements) => elements.map((element) => {
        const rectangle = element.getBoundingClientRect()
        return { width: rectangle.width, height: rectangle.height }
      }))
      expect(boxes).toHaveLength(3)
      const baseline = boxes[0]
      expect(baseline.width).toBeGreaterThanOrEqual(159)
      expect(baseline.width).toBeLessThanOrEqual(193)
      expect(Math.abs(baseline.height - Math.round(baseline.width * 224 / 192))).toBeLessThanOrEqual(1)
      for (const box of boxes.slice(1)) {
        expect(Math.abs(box.width - baseline.width)).toBeLessThanOrEqual(1)
        expect(Math.abs(box.height - baseline.height)).toBeLessThanOrEqual(1)
      }
      receipt.push({ viewport, state, boxes })
      return boxes
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
    for (const boxes of [collapsed, stopped, restarted]) {
      boxes.forEach((box, index) => {
        expect(Math.abs(box.width - expanded[index].width)).toBeLessThanOrEqual(1)
        expect(Math.abs(box.height - expanded[index].height)).toBeLessThanOrEqual(1)
      })
    }
    await toolbar.getByRole("button", { name: "Stop", exact: true }).click()
  }
  await testInfo.attach("task-20-portrait-card-geometry.json", {
    body: JSON.stringify(receipt, null, 2),
    contentType: "application/json",
  })
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
  await expect(summaries).toHaveCount(2)
  await expect(marker).toHaveCount(0)
  await expect(controls).toHaveCount(0)
  await expect(carousel.getByRole("button", { name: /^(Previous|Next) station$/ })).toHaveCount(0)
  const unreservedHeight = await summaries.first().evaluate((element) => element.getBoundingClientRect().height)
  await carousel.evaluate((element) => Reflect.set(window, "__task20StageIdentity", element))

  await setStationCapabilityQuery(page, stationReducedMotionQuery, true)
  await expect(marker).toHaveCount(1)
  await expect(controls).toHaveCount(1)
  await expect(carousel.getByRole("button", { name: /^(Previous|Next) station$/ })).toHaveCount(2)
  const reducedHeight = await summaries.first().evaluate((element) => element.getBoundingClientRect().height)
  expect(unreservedHeight - reducedHeight).toBeCloseTo(60, 0)
  const [summaryBoxes, controlBoxes] = await Promise.all([
    summaries.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON())),
    carousel.getByRole("button", { name: /^(Previous|Next) station$/ })
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON())),
  ])
  controlBoxes.forEach((box, index) => {
    const offset = box.y - (summaryBoxes[index].y + summaryBoxes[index].height)
    expect(offset).toBeGreaterThanOrEqual(15)
    expect(offset).toBeLessThanOrEqual(17)
  })
  await setStationCapabilityQuery(page, stationReducedMotionQuery, false)
  await expect(marker).toHaveCount(0)
  await expect(controls).toHaveCount(0)
  await expect.poll(() => summaries.first().evaluate((element) => element.getBoundingClientRect().height))
    .toBeCloseTo(unreservedHeight, 0)
  await setStationCapabilityQuery(page, stationFinePointerQuery, true)
  await expect(marker).toHaveCount(1)
  await expect(controls).toHaveCount(1)
  await expect.poll(() => summaries.first().evaluate((element) => element.getBoundingClientRect().height))
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
        this.record.targets.push(target.getAttribute("data-testid") === "station-carousel-stage"
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

    const expectedWidth = Math.max(160, Math.min(192, Math.floor(stageBox.width / 2.6)))
    const isConstrainedLandscape = stageBox.width > stageBox.height && stageBox.height <= 480
    const expectedHeight = Math.max(
      72,
      Math.min(isConstrainedLandscape ? stageBox.height : 224, Math.floor(stageBox.height)),
    )
    expect(cardBox.width).toBeCloseTo(expectedWidth, 0)
    expect(cardBox.height).toBeCloseTo(expectedHeight, 0)
    expect(cardBox.x).toBeGreaterThanOrEqual(stageBox.x - 1)
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + 1)
    expect(cardBox.y).toBeGreaterThanOrEqual(stageBox.y - 1)
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + 1)
  }

  await expect(toolbar).toHaveAttribute("data-layout", "rail")
  expect(centeredStationId).toBe("mlab-proof-drone")
  await expect(nonShellCards).toHaveCount(3)
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
  await expect(nonShellCards).toHaveCount(3)
  await expect.poll(readCenterOffset).toBeLessThanOrEqual(0.5)

  await toolbar.getByRole("button", { name: "Expand", exact: true }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "false")
  await expect.poll(async () => (await proofDrone.boundingBox())?.width).toBe(175)
  await expect(proofDrone).toHaveAttribute("data-centered", "true")
  await expect(nonShellCards).toHaveCount(3)
  await expect.poll(readCenterOffset).toBeLessThanOrEqual(0.5)

  await toolbar.getByRole("button", { name: "Minimize", exact: true }).click()
  await expect(toolbar).toHaveAttribute("data-collapsed", "true")
  await expect.poll(async () => (await proofDrone.boundingBox())?.width).toBe(192)
  await expect(proofDrone).toHaveAttribute("data-centered", "true")
  await expect(nonShellCards).toHaveCount(3)
  await expect.poll(readCenterOffset).toBeLessThanOrEqual(0.5)
  await assertResponsiveCenteredCard()
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
  expect(await page.evaluate(() => {
    const records = Reflect.get(window, "__stationCarouselObserverRecords") as Array<{
      targets: string[]
      disconnected: boolean
    }>
    return records.filter(({ targets }) => targets.includes("station-carousel-stage"))
  })).toEqual([{ targets: ["station-carousel-stage"], disconnected: false }])

  await page.getByRole("button", { name: "About", exact: true }).click()
  await page.getByRole("link", { name: "About MassageLab" }).click()
  await expect(page).toHaveURL(/\/about$/)
  expect(await page.evaluate(() => {
    const records = Reflect.get(window, "__stationCarouselObserverRecords") as Array<{
      targets: string[]
      disconnected: boolean
    }>
    return records.filter(({ targets }) => targets.includes("station-carousel-stage"))
  })).toEqual([{ targets: ["station-carousel-stage"], disconnected: true }])
})

test("Atmosphere expanded player actions expose session and saved interruption preferences", async ({ page }) => {
  await installInterruptionNoticeMediaFakes(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const player = await startInterruptionNoticeSession(page)
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
  await player.getByRole("button", { name: "Previous station" }).click()
  await expect(notice).toBeHidden()
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await player.getByRole("button", { name: "Next station" }).click()
  await expect(notice).toBeHidden()
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

  const actionLabels = await primary
    .locator('button[aria-label], a[aria-label]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")))
  expect(actionLabels).toEqual([
    `Favorite ${stationTitle}`,
    "Previous station",
    "Stop",
    "Next station",
    "Background",
  ])

  const favorite = primary.getByRole("button", { name: `Favorite ${stationTitle}` })
  await expect(favorite).toHaveAttribute("aria-pressed", "false")
  await expect(favorite).toHaveClass(/\[--brand-orange:var\(--button-cta-face\)\]/)
  await expect(primary.getByRole("button", { name: "Previous station" })).toHaveClass(/ml-button-glow/)
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
  await expect(left).toHaveCount(0)
  await expect(primary).toHaveCount(0)
  await expect(right).toHaveCount(0)
  expect(await toolbar.locator('.ml-music-player-toolbar-layout button[aria-label], .ml-music-player-toolbar-layout a[aria-label], .ml-music-player-toolbar-layout input[aria-label]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label"))))
    .toEqual(["Stop", "Expand"])

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
  const playStopCenter = geometry.playStop.left + geometry.playStop.width / 2

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
  expect(Math.abs(playStopCenter - toolbarCenter)).toBeLessThanOrEqual(1)
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

  expect(geometry.surface.scrollWidth).toBeLessThanOrEqual(geometry.surface.clientWidth)
  expect(geometry.surface.scrollHeight).toBeLessThanOrEqual(geometry.surface.clientHeight)
  expect(geometry.layout.scrollWidth).toBeLessThanOrEqual(geometry.layout.clientWidth)
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
    .toEqual(["Stop", "Expand"])
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
  await notice.hover()
  await page.clock.fastForward("00:40")
  await expect(notice).toBeVisible()
  await page.mouse.move(1, 1)
  await page.clock.fastForward(19_500)
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
  await page.clock.fastForward(29_500)
  await expect(notice).toBeVisible()
  await page.clock.fastForward(500)
  await expect(notice).toBeHidden()
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
  await expect(controls.locator("[aria-label]")).toHaveCount(7)
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
    ["Previous station", "Stop", "Next station", "Background", "Player settings", "Minimize"],
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
    ["Stop", "Expand"],
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
    ["Previous station", "Stop", "Next station", "Background", "Player settings", "Minimize"],
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
    ["Stop", "Expand"],
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
  await placeRenderedToolbarAtTop(player, safeTop)
  await expect(player).toHaveAttribute("data-placement", "top")

  let spacing = await resolvedShellSpacing(page)
  await expectTopSafeAreaToolbarGeometry(
    player,
    184,
    160,
    spacing.safeTop,
    ["Previous station", "Stop", "Next station", "Background", "Player settings", "Minimize"],
  )
  expect(spacing.pageTop).toBeCloseTo(184, 0)
  expect(spacing.chimerTop).toBeCloseTo(184 + 12, 0)
  expect(spacing.chimerSettingsTop).toBeCloseTo(184 + 76, 0)

  await player.getByRole("button", { name: "Minimize", exact: true }).click()
  await placeRenderedToolbarAtTop(player, safeTop)
  spacing = await resolvedShellSpacing(page)
  await expectTopSafeAreaToolbarGeometry(player, 96, 72, spacing.safeTop, ["Stop", "Expand"])
  expect(spacing.pageTop).toBeCloseTo(96, 0)
  expect(spacing.chimerTop).toBeCloseTo(96 + 12, 0)
  expect(spacing.chimerSettingsTop).toBeCloseTo(96 + 76, 0)

  await player.getByRole("button", { name: "Stop", exact: true }).click()
})

test("mobile loading toolbar fits expanded and collapsed increased-text content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Mobile loading geometry is covered in mobile Chromium.")
  const safeBottom = 24
  let releaseSampleIndex!: () => void
  const sampleIndexGate = new Promise<void>((resolve) => {
    releaseSampleIndex = resolve
  })
  await page.route("**/observable-streams-vsco-adaptation/sample-index.json", async (route) => {
    await sampleIndexGate
    await route.abort("aborted")
  })
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
    ["Previous station", "Stop", "Next station", "Background", "Player settings", "Minimize"],
  )

  await player.getByRole("button", { name: "Minimize", exact: true }).click()
  await expect(player).toHaveAttribute("data-collapsed", "true")
  await expect(player).toHaveAttribute("data-playback-state", "loading")
  await expectCompactLoadingIdentity(player)
  spacing = await resolvedShellSpacing(page)
  expect(spacing.audioToolbar).toBeCloseTo(72, 0)
  await expectSafeAreaToolbarGeometry(player, 72, 72, spacing.bottomStack, ["Stop", "Expand"])

  await player.getByRole("button", { name: "Stop", exact: true }).click()
  releaseSampleIndex()
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
