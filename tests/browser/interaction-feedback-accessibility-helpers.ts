import { expect, type Locator, type Page } from "@playwright/test"

export type RouteFeedbackAccessibilityObservation = {
  barAnimationName: string
  controlCentersUncovered: boolean
  controlsSeen: number
  feedbackOwnedFocus: boolean
  loaderAnimationName: string
  maximumConcurrentStatusCount: number
  maximumHorizontalOverflow: number
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

/**
 * Captures the short-lived App Router loading boundary synchronously so the
 * test can verify accessibility and geometry without extending production timeouts.
 */
export async function installRouteFeedbackAccessibilityObserver(page: Page) {
  await page.evaluate(() => {
    const observed: RouteFeedbackAccessibilityObservation = {
      barAnimationName: "",
      controlCentersUncovered: true,
      controlsSeen: 0,
      feedbackOwnedFocus: false,
      loaderAnimationName: "",
      maximumConcurrentStatusCount: 0,
      maximumHorizontalOverflow: 0,
      pointerEvents: "",
      progressSeen: false,
      statusOccurrences: 0,
      statusTexts: [],
    }
    const seenStatuses = new Set<HTMLElement>()
    const recordRouteFeedback = () => {
      const progress = document.querySelector<HTMLElement>('[data-route-progress="pending"]')
      const statuses = [...document.querySelectorAll<HTMLElement>('[role="status"]')]
        .filter((status) => (status.getAttribute("aria-label")?.trim() || status.textContent?.trim()) === "Loading page")
      observed.maximumConcurrentStatusCount = Math.max(observed.maximumConcurrentStatusCount, statuses.length)
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
      const loader = progress.querySelector<HTMLElement>('[data-route-loader="shell-safe"]')
      if (loader) observed.loaderAnimationName = getComputedStyle(loader).animationName

      const focused = document.activeElement
      if (focused && (progress.contains(focused) || focused.getAttribute("role") === "status")) {
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
    Reflect.set(window, "__interactionFeedbackAccessibilityObserver", observer)
    Reflect.set(window, "__interactionFeedbackAccessibilityObserved", observed)
  })
}

/** Stops the observer and returns its exact transient-feedback receipt. */
export async function readRouteFeedbackAccessibilityObserver(page: Page) {
  return page.evaluate(() => {
    const observer = Reflect.get(window, "__interactionFeedbackAccessibilityObserver") as MutationObserver
    observer.disconnect()
    return Reflect.get(
      window,
      "__interactionFeedbackAccessibilityObserved",
    ) as RouteFeedbackAccessibilityObservation
  })
}
