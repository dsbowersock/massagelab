import { expect, type Locator, type Page } from "@playwright/test"

export type RouteFeedbackAccessibilityObservation = {
  barAnimationName: string
  controlCentersUncovered: boolean
  controlsSeen: number
  feedbackOwnedFocus: boolean
  maximumConcurrentStatusCount: number
  maximumConcurrentProgressCount: number
  maximumHorizontalOverflow: number
  ownerPresentations: string[]
  pointerEvents: string
  progressSeen: boolean
  statusOccurrences: number
  statusTexts: string[]
}

/** Checks document geometry rather than relying on the root overflow clipping rule. */
export async function expectNoHorizontalViewportOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport)
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
}

/** Traverses the real tab order so focus-visible and keyboard activation stay observable. */
export async function focusWithKeyboard(page: Page, control: Locator) {
  await page.locator("body").evaluate((body) => {
    body.tabIndex = -1
    body.focus()
  })
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press("Tab")
    if (await control.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error("Keyboard traversal did not reach the expected interaction-feedback control.")
}

type RouteLoaderRenderedObservation = {
  canvasDisplay: string
  canvasHeight: number
  canvasWidth: number
  inViewport: boolean
  loaderHeight: number
  loaderOpacity: number
  loaderVisibility: string
  loaderWidth: number
}

type RouteProgressRenderedObservation = {
  backgroundAlpha: number
  inViewport: boolean
  opacity: number
  pointerEvents: string
  progressHeight: number
  progressWidth: number
}

/** Proves the active fixed bar is painted, in the viewport, and pointer-inert. */
export async function expectVisibleRouteProgressBar(routeProgress: Locator) {
  await expect(routeProgress).toBeVisible()
  const rendered = await routeProgress.evaluate((progress): RouteProgressRenderedObservation => {
    const bounds = progress.getBoundingClientRect()
    const style = getComputedStyle(progress)
    const colorChannels = style.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? []
    return {
      backgroundAlpha: colorChannels.length >= 4 ? (colorChannels[3] ?? 0) : 1,
      inViewport: bounds.right > 0
        && bounds.bottom > 0
        && bounds.left < window.innerWidth
        && bounds.top < window.innerHeight,
      opacity: Number.parseFloat(style.opacity),
      pointerEvents: style.pointerEvents,
      progressHeight: bounds.height,
      progressWidth: bounds.width,
    }
  })
  expect(rendered.backgroundAlpha).toBeGreaterThan(0)
  expect(rendered.inViewport).toBe(true)
  expect(rendered.opacity).toBeGreaterThan(0)
  expect(rendered.pointerEvents).toBe("none")
  expect(rendered.progressHeight).toBeGreaterThan(0)
  expect(rendered.progressWidth).toBeGreaterThan(0)
}

/**
 * Proves the actual route Loader canvas has visible geometry and a WebGL2 context,
 * leaving the caller to prove its rendered contribution with user-visible screenshots.
 */
export async function expectVisibleRouteLoaderCanvas(routeLoader: Locator) {
  await expect(routeLoader).toBeVisible()
  const rendered = await routeLoader.evaluate((loader): RouteLoaderRenderedObservation => {
    const bounds = loader.getBoundingClientRect()
    const style = getComputedStyle(loader)
    const canvas = loader.querySelector("canvas")
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("The visible route Loader did not contain its real canvas.")
    }
    if (!canvas.getContext("webgl2")) {
      throw new Error("The visible route Loader canvas did not expose WebGL2.")
    }

    return {
      canvasDisplay: getComputedStyle(canvas).display,
      canvasHeight: canvas.height,
      canvasWidth: canvas.width,
      inViewport: bounds.right > 0
        && bounds.bottom > 0
        && bounds.left < window.innerWidth
        && bounds.top < window.innerHeight,
      loaderHeight: bounds.height,
      loaderOpacity: Number.parseFloat(style.opacity),
      loaderVisibility: style.visibility,
      loaderWidth: bounds.width,
    }
  })
  expect(rendered.canvasDisplay).toBe("block")
  expect(rendered.canvasHeight).toBeGreaterThan(0)
  expect(rendered.canvasWidth).toBeGreaterThan(0)
  expect(rendered.inViewport).toBe(true)
  expect(rendered.loaderHeight).toBeGreaterThan(0)
  expect(rendered.loaderOpacity).toBeGreaterThan(0)
  expect(rendered.loaderVisibility).toBe("visible")
  expect(rendered.loaderWidth).toBeGreaterThan(0)
}

/**
 * Captures the active link/root feedback handoff so accessibility and geometry
 * remain observable without extending production timeouts.
 */
export async function installRouteFeedbackAccessibilityObserver(page: Page) {
  await page.evaluate(() => {
    const observed: RouteFeedbackAccessibilityObservation = {
      barAnimationName: "",
      controlCentersUncovered: true,
      controlsSeen: 0,
      feedbackOwnedFocus: false,
      maximumConcurrentStatusCount: 0,
      maximumConcurrentProgressCount: 0,
      maximumHorizontalOverflow: 0,
      ownerPresentations: [],
      pointerEvents: "",
      progressSeen: false,
      statusOccurrences: 0,
      statusTexts: [],
    }
    const seenStatuses = new Set<HTMLElement>()
    const isRouteFeedbackOwner = (element: Element) => {
      if (element.closest('[data-route-progress="pending"]')) return true
      const status = element.closest<HTMLElement>('[role="status"]')
      return (status?.getAttribute("aria-label")?.trim() || status?.textContent?.trim()) === "Loading page"
    }
    const recordFeedbackFocus = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof Element && isRouteFeedbackOwner(target)) {
        observed.feedbackOwnedFocus = true
      }
    }
    document.addEventListener("focusin", recordFeedbackFocus, true)
    const recordRouteFeedback = () => {
      const progresses = [...document.querySelectorAll<HTMLElement>('[data-route-progress="pending"]')]
      const progress = progresses[0]
      const statuses = [...document.querySelectorAll<HTMLElement>('[role="status"]')]
        .filter((status) => (status.getAttribute("aria-label")?.trim() || status.textContent?.trim()) === "Loading page")
      observed.maximumConcurrentStatusCount = Math.max(observed.maximumConcurrentStatusCount, statuses.length)
      observed.maximumConcurrentProgressCount = Math.max(
        observed.maximumConcurrentProgressCount,
        progresses.length,
      )
      for (const currentProgress of progresses) {
        const owner = currentProgress.getAttribute("data-route-feedback-owner") || "unowned"
        const announcement = currentProgress.getAttribute("data-route-feedback-announcement") || "unmarked"
        const presentation = `${owner}:${announcement}`
        if (observed.ownerPresentations.at(-1) !== presentation) {
          observed.ownerPresentations.push(presentation)
        }
      }
      for (const status of statuses) {
        if (seenStatuses.has(status)) continue
        seenStatuses.add(status)
        observed.statusOccurrences += 1
        observed.statusTexts.push(status.getAttribute("aria-label")?.trim() || status.textContent?.trim() || "")
      }
      if (!progress) return

      observed.progressSeen = true
      observed.pointerEvents = getComputedStyle(progress).pointerEvents
      observed.maximumHorizontalOverflow = Math.max(
        observed.maximumHorizontalOverflow,
        document.body.scrollWidth - document.documentElement.clientWidth,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      const progressMark = progress.querySelector<HTMLElement>(':scope > [aria-hidden="true"]')
      if (progressMark) observed.barAnimationName = getComputedStyle(progressMark).animationName

      const focused = document.activeElement
      if (focused && isRouteFeedbackOwner(focused)) {
        observed.feedbackOwnedFocus = true
      }

      const controls = [
        ...document.querySelectorAll<HTMLElement>('a[aria-label="Open clock"]'),
        ...document.querySelectorAll<HTMLElement>('[data-testid="music-player-toolbar-controls"]'),
      ].filter((control) => {
        const bounds = control.getBoundingClientRect()
        return bounds.width > 0 && bounds.height > 0
      })
      observed.controlsSeen = Math.max(observed.controlsSeen, controls.length)
      for (const control of controls) {
        const bounds = control.getBoundingClientRect()
        const hit = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        )
        if (!hit || (hit !== control && !control.contains(hit))) observed.controlCentersUncovered = false
      }
    }
    const observer = new MutationObserver(recordRouteFeedback)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    const cleanup = () => {
      observer.disconnect()
      document.removeEventListener("focusin", recordFeedbackFocus, true)
      Reflect.deleteProperty(window, "__interactionFeedbackAccessibilityObserver")
      Reflect.deleteProperty(window, "__interactionFeedbackAccessibilityFocusListener")
      Reflect.deleteProperty(window, "__interactionFeedbackAccessibilityCleanup")
    }
    Reflect.set(window, "__interactionFeedbackAccessibilityObserver", observer)
    Reflect.set(window, "__interactionFeedbackAccessibilityObserved", observed)
    Reflect.set(window, "__interactionFeedbackAccessibilityFocusListener", recordFeedbackFocus)
    Reflect.set(window, "__interactionFeedbackAccessibilityCleanup", cleanup)
  })
}

/** Safely removes an installed observer/listener when an assertion aborts a journey. */
export async function discardRouteFeedbackAccessibilityObserver(page: Page) {
  await page.evaluate(() => {
    const cleanup = Reflect.get(
      window,
      "__interactionFeedbackAccessibilityCleanup",
    ) as (() => void) | undefined
    cleanup?.()
    Reflect.deleteProperty(window, "__interactionFeedbackAccessibilityObserved")
  })
}

/** Stops the observer and returns its exact transient-feedback receipt. */
export async function readRouteFeedbackAccessibilityObserver(page: Page) {
  return page.evaluate(() => {
    const observed = Reflect.get(
      window,
      "__interactionFeedbackAccessibilityObserved",
    ) as RouteFeedbackAccessibilityObservation
    const cleanup = Reflect.get(
      window,
      "__interactionFeedbackAccessibilityCleanup",
    ) as (() => void) | undefined
    cleanup?.()
    Reflect.deleteProperty(window, "__interactionFeedbackAccessibilityObserved")
    return observed
  })
}
