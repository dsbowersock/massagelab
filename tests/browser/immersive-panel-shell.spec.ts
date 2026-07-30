import { expect, test, type Page } from "@playwright/test"

const VISUAL_PANEL_OPENED_STORAGE_KEY = "massagelab.chimer.visual-panel-opened.v1"

async function waitForStageReservation(page: Page) {
  const stage = page.locator("[data-immersive-stage]")
  await expect.poll(async () => stage.evaluate((element) => {
    const styles = getComputedStyle(element)
    const top = Number.parseFloat(styles.getPropertyValue("--immersive-reserved-top")) || 0
    const bottom = Number.parseFloat(styles.getPropertyValue("--immersive-reserved-bottom")) || 0
    return top + bottom
  })).toBeGreaterThan(0)
}

async function waitForProtectedDisplayCenterToSettle(page: Page) {
  const protectedDisplay = page.locator("[data-protected-display]")
  let previousCenterY: number | null = null
  let stableSamples = 0

  // The timer fit pass follows the dock ResizeObserver and its CSS transition.
  // Wait through that handoff before looking for consecutive stable samples.
  await page.waitForTimeout(750)
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const centerY = await protectedDisplay.evaluate((display) => {
      const bounds = display.getBoundingClientRect()
      return bounds.top + (bounds.height / 2)
    })
    stableSamples = previousCenterY !== null && Math.abs(centerY - previousCenterY) <= 0.5
      ? stableSamples + 1
      : 0
    if (stableSamples >= 2) return centerY
    previousCenterY = centerY
    await page.waitForTimeout(100)
  }

  throw new Error("Protected display placement did not settle")
}

async function installVisualViewportFixture(page: Page, offsetTop = 40, heightInset = 40) {
  await page.addInitScript(({ viewportOffsetTop, viewportHeightInset }) => {
    const fakeViewport = new EventTarget()
    Object.defineProperties(fakeViewport, {
      height: { get: () => Math.max(1, window.innerHeight - viewportHeightInset) },
      offsetLeft: { get: () => 0 },
      offsetTop: { get: () => viewportOffsetTop },
      pageLeft: { get: () => window.scrollX },
      pageTop: { get: () => window.scrollY + viewportOffsetTop },
      scale: { get: () => 1 },
      width: { get: () => window.innerWidth },
    })
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: fakeViewport,
    })
  }, { viewportOffsetTop: offsetTop, viewportHeightInset: heightInset })
}

async function installImmersiveLifecycleInstrumentation(page: Page) {
  await page.addInitScript(() => {
    const lifecycle = {
      activeListenerId: null as number | null,
      flushHeldFrame: (frameId: number) => { void frameId },
      holdNextRafForListenerId: null as number | null,
      observers: [] as Array<{ targets: string[], disconnected: boolean }>,
      rafRecords: [] as Array<{
        callbackCalls: number
        canceled: boolean
        callback: FrameRequestCallback | null
        executed: boolean
        frameId: number
        handle: number
        held: boolean
        requestedByListenerId: number | null
      }>,
      viewportListeners: [] as Array<{ type: string, active: boolean, calls: number, listenerId: number }>,
      windowListeners: [] as Array<{ type: string, active: boolean, calls: number, listenerId: number }>,
    }
    const targetWindow = window as typeof window & { __immersiveLifecycle?: typeof lifecycle }
    targetWindow.__immersiveLifecycle = lifecycle

    const NativeResizeObserver = window.ResizeObserver
    window.ResizeObserver = class InstrumentedResizeObserver implements ResizeObserver {
      private nativeObserver: ResizeObserver
      private record = { targets: [] as string[], disconnected: false }

      constructor(callback: ResizeObserverCallback) {
        lifecycle.observers.push(this.record)
        this.nativeObserver = new NativeResizeObserver((entries) => callback(entries, this))
      }

      disconnect() {
        this.record.disconnected = true
        this.nativeObserver.disconnect()
      }

      observe(target: Element, options?: ResizeObserverOptions) {
        if (target.hasAttribute("data-protected-display")) this.record.targets.push("protected")
        if (target.hasAttribute("data-immersive-dock")) this.record.targets.push("dock")
        this.nativeObserver.observe(target, options)
      }

      unobserve(target: Element) {
        this.nativeObserver.unobserve(target)
      }
    }

    const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window)
    const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window)
    let nextFrameId = 1
    let nextHeldHandle = -1
    lifecycle.flushHeldFrame = (frameId) => {
      const record = lifecycle.rafRecords.find((entry) => entry.frameId === frameId)
      if (!record || !record.held || record.canceled || record.executed || !record.callback) return
      record.callbackCalls += 1
      record.executed = true
      record.callback(performance.now())
    }
    window.requestAnimationFrame = (callback) => {
      const held = lifecycle.holdNextRafForListenerId !== null
        && lifecycle.holdNextRafForListenerId === lifecycle.activeListenerId
      if (held) lifecycle.holdNextRafForListenerId = null
      const record = {
        callbackCalls: 0,
        canceled: false,
        callback,
        executed: false,
        frameId: nextFrameId,
        handle: 0,
        held,
        requestedByListenerId: lifecycle.activeListenerId,
      }
      nextFrameId += 1
      if (held) {
        record.handle = nextHeldHandle
        nextHeldHandle -= 1
      } else {
        record.handle = originalRequestAnimationFrame((timestamp) => {
          record.callbackCalls += 1
          record.executed = true
          callback(timestamp)
        })
      }
      lifecycle.rafRecords.push(record)
      return record.handle
    }
    window.cancelAnimationFrame = (handle) => {
      const record = lifecycle.rafRecords
        .findLast((entry) => entry.handle === handle && !entry.canceled && !entry.executed)
      if (record) {
        record.canceled = true
        if (record.held) return
      }
      originalCancelAnimationFrame(handle)
    }

    const listenerIds = new WeakMap<EventListenerOrEventListenerObject, number>()
    let nextListenerId = 1
    const getListenerId = (listener: EventListenerOrEventListenerObject) => {
      const existing = listenerIds.get(listener)
      if (existing) return existing
      const listenerId = nextListenerId
      nextListenerId += 1
      listenerIds.set(listener, listenerId)
      return listenerId
    }

    const instrumentTarget = (
      target: Window | VisualViewport,
      records: Array<{ type: string, active: boolean, calls: number, listenerId: number }>,
      trackedTypes: Set<string>,
    ) => {
      const originalAdd = target.addEventListener.bind(target)
      const originalRemove = target.removeEventListener.bind(target)
      const registrations: Array<{
        capture: boolean
        listener: EventListenerOrEventListenerObject
        record: { type: string, active: boolean, calls: number, listenerId: number }
        type: string
        wrapped: EventListener
      }> = []

      target.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
        if (!listener) return
        if (!trackedTypes.has(type)) {
          originalAdd(type, listener, options)
          return
        }
        const capture = typeof options === "boolean" ? options : Boolean(options?.capture)
        const record = { type, active: true, calls: 0, listenerId: getListenerId(listener) }
        const wrapped: EventListener = (event) => {
          record.calls += 1
          const previousListenerId = lifecycle.activeListenerId
          lifecycle.activeListenerId = record.listenerId
          try {
            if (typeof listener === "function") listener.call(target, event)
            else listener.handleEvent(event)
          } finally {
            lifecycle.activeListenerId = previousListenerId
          }
        }
        records.push(record)
        registrations.push({ capture, listener, record, type, wrapped })
        originalAdd(type, wrapped, options)
      }) as typeof target.addEventListener

      target.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
        if (!listener) return
        const capture = typeof options === "boolean" ? options : Boolean(options?.capture)
        const registration = registrations.find((candidate) => (
          candidate.record.active
          && candidate.type === type
          && candidate.listener === listener
          && candidate.capture === capture
        ))
        if (registration) {
          registration.record.active = false
          originalRemove(type, registration.wrapped, options)
          return
        }
        originalRemove(type, listener, options)
      }) as typeof target.removeEventListener
    }

    instrumentTarget(window, lifecycle.windowListeners, new Set(["orientationchange", "resize"]))
    if (window.visualViewport) {
      instrumentTarget(window.visualViewport, lifecycle.viewportListeners, new Set(["resize", "scroll"]))
    }
  })
}

async function openClock(page: Page) {
  await page.goto("/clock", { waitUntil: "domcontentloaded" })
  await expect(page.locator("body")).toHaveClass(/chimer-running/)
}

async function selectNextAvailableBackground(page: Page) {
  const background = page.getByRole("dialog", { name: "Background" })
  const next = background.getByRole("button", { name: "Next background" })

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const select = background.getByRole("button", { name: /^Select .* background$/ })
    if (await select.count() > 0 && await select.isEnabled()) {
      await select.click()
      return
    }
    await next.click()
  }

  throw new Error("No available unselected background was reachable from the carousel")
}

test("Clock and Visual switch one active panel and honor dismissal focus", async ({ page }) => {
  await openClock(page)
  const clockControl = page.getByRole("button", { name: "Clock", exact: true })
  const visualControl = page.getByRole("button", { name: "Visual", exact: true })

  await clockControl.click()
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toBeVisible()
  await visualControl.click()
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)
  await expect(page.getByRole("dialog", { name: "Visual controls" })).toBeVisible()

  await page.getByRole("button", { name: "Close Visual panel" }).click()
  await expect(page.getByRole("dialog", { name: "Visual controls" })).toHaveCount(0)
  await expect(visualControl).toBeFocused()

  await clockControl.click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)
  await expect(clockControl).toBeFocused()

  await clockControl.click()
  await page.locator("[data-protected-display]").click({ position: { x: 2, y: 2 } })
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)
})

test("Escape in a portaled color picker closes only the picker", async ({ page }) => {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "picker-qa-user", email: "picker-qa@example.com" } }),
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
  await openClock(page)
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const clock = page.getByRole("dialog", { name: "Clock controls" })
  const clockPickerButton = clock.getByRole("button", { name: "Clock color picker" })

  await clockPickerButton.click()
  const picker = page.getByRole("dialog", { name: "Clock color picker" })
  await expect(picker).toBeVisible()
  await picker.getByRole("slider", { name: "Clock color saturation and brightness" }).focus()
  await page.keyboard.press("Escape")

  await expect(picker).toHaveCount(0)
  await expect(clock).toBeVisible()
})

test("Background is modal, restores focus, and uses outside dismissal only when visible", async ({ page }) => {
  await openClock(page)
  const backgroundControl = page.getByRole("button", { name: "Background", exact: true })
  await backgroundControl.click()
  const background = page.getByRole("dialog", { name: "Background" })
  await expect(background).toBeVisible()

  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => {
      const panel = document.querySelector('[data-immersive-panel="background"]')
      return Boolean(panel && document.activeElement && panel.contains(document.activeElement))
    })).toBe(true)
  }

  const box = await background.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (box && viewport && (box.x > 0 || box.y > 0 || box.x + box.width < viewport.width || box.y + box.height < viewport.height)) {
    await page.mouse.click(1, 1)
    await expect(background).toHaveCount(0)
  } else {
    expect(box?.x).toBe(0)
    expect(box?.y).toBe(0)
    expect(box?.width).toBe(viewport?.width)
    expect(box?.height).toBe(viewport?.height)
    await page.keyboard.press("Escape")
    await expect(background).toHaveCount(0)
  }
  await expect(backgroundControl).toBeFocused()

  await backgroundControl.click()
  await page.getByRole("button", { name: "Close Background panel" }).press("Enter")
  await expect(background).toHaveCount(0)
  await expect(backgroundControl).toBeFocused()
})

test("an available Background selection closes immediately and gives the first Visual hint", async ({ page }) => {
  await page.addInitScript((key) => localStorage.removeItem(key), VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)

  await expect(page.getByRole("dialog", { name: "Background" })).toHaveCount(0)
  const hint = page.getByRole("status", { name: "Customize this background in Visual." })
  await expect(hint).toBeVisible()
  const visualControl = page.getByRole("button", { name: "Visual", exact: true })
  await expect(visualControl).toHaveAttribute("aria-describedby", await hint.getAttribute("id") ?? "")
  await expect(page.locator("[data-protected-display]")).toBeVisible()
})

test("opening Visual records seen and suppresses later background hints", async ({ page }) => {
  await page.addInitScript((key) => localStorage.removeItem(key), VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  const visualControl = page.getByRole("button", { name: "Visual", exact: true })
  await visualControl.click()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), VISUAL_PANEL_OPENED_STORAGE_KEY)).toBe("1")
  await page.getByRole("button", { name: "Close Visual panel" }).click()

  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toHaveCount(0)
})

test("pre-seen hydration suppresses the Visual hint", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "1"), VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toHaveCount(0)
})

test("storage denial falls back to in-memory Visual visit state", async ({ page }) => {
  await page.addInitScript((key) => {
    const originalGetItem = Storage.prototype.getItem
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.getItem = function getItem(storageKey) {
      if (storageKey === key) throw new DOMException("denied", "SecurityError")
      return originalGetItem.call(this, storageKey)
    }
    Storage.prototype.setItem = function setItem(storageKey, value) {
      if (storageKey === key) throw new DOMException("denied", "SecurityError")
      return originalSetItem.call(this, storageKey, value)
    }
  }, VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toBeVisible()

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  await page.getByRole("button", { name: "Close Visual panel" }).click()
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toHaveCount(0)
})

test("16:9-style viewports give Clock and Visual the same half-width side sheet and reserved stage", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openClock(page)

  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const clockDock = page.locator('[data-immersive-panel="clock"]')
  await expect(clockDock).toBeVisible()
  await expect(clockDock).toHaveAttribute("data-immersive-layout", "side")
  await expect.poll(async () => clockDock.locator("[data-immersive-dock-header]").evaluate((header) => {
    const close = header.querySelector('[aria-label="Close Clock panel"]')
    const color = header.querySelector('[aria-label="Clock color picker"]')
    return Boolean(
      close
      && color
      && (close.compareDocumentPosition(color) & Node.DOCUMENT_POSITION_FOLLOWING),
    )
  })).toBe(true)
  await expect.poll(async () => {
    const [displayBox, dockBox] = await Promise.all([
      page.locator("[data-protected-display]").boundingBox(),
      clockDock.boundingBox(),
    ])
    if (!displayBox || !dockBox) return false
    const intersects = !(
      dockBox.x + dockBox.width <= displayBox.x
      || displayBox.x + displayBox.width <= dockBox.x
      || dockBox.y + dockBox.height <= displayBox.y
      || displayBox.y + displayBox.height <= dockBox.y
    )
    return !intersects
      && dockBox.width <= 422
      && dockBox.x >= 844 - 422 - 13
      && dockBox.x >= 0
      && dockBox.y >= 0
      && dockBox.x + dockBox.width <= 844
      && dockBox.y + dockBox.height <= 390
  }).toBe(true)
  await page.getByRole("button", { name: "Close Clock panel" }).click()

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visualDock = page.locator('[data-immersive-panel="visual"]')
  await expect(visualDock).toHaveAttribute("data-immersive-layout", "side")
  await expect.poll(async () => {
    const [displayBox, box] = await Promise.all([
      page.locator("[data-protected-display]").boundingBox(),
      visualDock.boundingBox(),
    ])
    if (!displayBox || !box) return false
    const intersects = !(
      box.x + box.width <= displayBox.x
      || displayBox.x + displayBox.width <= box.x
      || box.y + box.height <= displayBox.y
      || displayBox.y + displayBox.height <= box.y
    )
    return Boolean(
      !intersects
      && box.width <= 422
      && box.x >= 844 - 422 - 13
      && box.x + box.width <= 844,
    )
  }).toBe(true)
  await expect.poll(async () => visualDock.evaluate((dock) => {
    const scroller = dock.querySelector<HTMLElement>("[data-immersive-dock-scroller]")
    return dock.scrollWidth <= dock.clientWidth + 1
      && Boolean(scroller && scroller.scrollWidth <= scroller.clientWidth + 1)
  })).toBe(true)
  const visualSwatches = visualDock.locator('[aria-label^="Swatch "]')
  await expect(visualSwatches).toHaveCount(7)
  await expect.poll(async () => visualSwatches.evaluateAll((swatches) => (
    swatches.every((swatch) => swatch.getBoundingClientRect().width <= 36)
  ))).toBe(true)

  await page.locator("html").evaluate((element) => {
    element.setAttribute("data-sidebar-position", "right")
  })
  await expect.poll(async () => {
    const [displayBox, box] = await Promise.all([
      page.locator("[data-protected-display]").boundingBox(),
      visualDock.boundingBox(),
    ])
    return Boolean(
      displayBox
      && box
      && box.x >= 0
      && box.x <= 13
      && box.width <= 422
      && displayBox.x >= box.x + box.width,
    )
  }).toBe(true)
})

test("4:3 Clock and Visual retain the shared bottom-dock behavior", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await openClock(page)

  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const clockDock = page.locator('[data-immersive-panel="clock"]')
  await expect(clockDock).toHaveAttribute("data-immersive-layout", "dock")
  await expect(clockDock).toHaveAttribute("data-immersive-dock", "bottom")
  await waitForStageReservation(page)
  const clockDisplayCenterY = await waitForProtectedDisplayCenterToSettle(page)
  await page.getByRole("button", { name: "Close Clock panel" }).click()

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visualDock = page.locator('[data-immersive-panel="visual"]')
  await expect(visualDock).toHaveAttribute("data-immersive-layout", "dock")
  await expect(visualDock).toHaveAttribute("data-immersive-dock", "bottom")
  await waitForStageReservation(page)
  await expect.poll(async () => {
    const [box, viewportHeight] = await Promise.all([
      visualDock.boundingBox(),
      page.evaluate(() => window.visualViewport?.height ?? window.innerHeight),
    ])
    return Boolean(box && box.height <= (viewportHeight / 2) + 1)
  }).toBe(true)
  const visualDisplayCenterY = await waitForProtectedDisplayCenterToSettle(page)
  expect(Math.abs(visualDisplayCenterY - clockDisplayCenterY)).toBeLessThanOrEqual(6)

  const sharedColorsIntro = visualDock.getByText("Shared Colors", { exact: true }).locator("..")
  const colorSourceControl = visualDock.getByRole("group", { name: "Color source" }).locator("..")
  await expect.poll(async () => {
    const [introBox, sourceBox] = await Promise.all([
      sharedColorsIntro.boundingBox(),
      colorSourceControl.boundingBox(),
    ])
    return Boolean(introBox && sourceBox && sourceBox.x + sourceBox.width < introBox.x)
  }).toBe(true)
})

test("portrait Visual never covers more than half the visual viewport height", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openClock(page)
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visualDock = page.locator('[data-immersive-panel="visual"]')

  await expect(visualDock).toHaveAttribute("data-immersive-layout", "dock")
  await expect.poll(async () => {
    const [box, viewportHeight] = await Promise.all([
      visualDock.boundingBox(),
      page.evaluate(() => window.visualViewport?.height ?? window.innerHeight),
    ])
    return Boolean(box && box.height <= (viewportHeight / 2) + 1)
  }).toBe(true)
})

test("measured edge insets and visual-viewport offsets preserve the protected gap", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await installVisualViewportFixture(page)
  await openClock(page)
  await page.locator("[data-immersive-shell]").evaluate((element) => {
    const shell = element as HTMLElement
    shell.style.setProperty("--immersive-dock-top-inset", "96px")
    shell.style.setProperty("--immersive-dock-bottom-inset", "36px")
  })

  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const dock = page.locator("[data-immersive-dock]")
  await expect(dock).toHaveAttribute("data-immersive-dock", "bottom")
  await expect(page.locator("[data-immersive-inset-probe]")).toBeAttached()

  await expect.poll(async () => page.evaluate(() => {
    const display = document.querySelector<HTMLElement>("[data-protected-display]")?.getBoundingClientRect()
    const panel = document.querySelector<HTMLElement>("[data-immersive-dock]")?.getBoundingClientRect()
    const viewport = window.visualViewport
    if (!display || !panel || !viewport) return false
    return panel.top - display.bottom >= 15
      && panel.bottom <= viewport.offsetTop + viewport.height
      && Math.abs(viewport.offsetTop + viewport.height - panel.bottom - 36) < 1
  })).toBe(true)
})

test("rendered panel teardown cancels its exact pending frame and removes viewport listeners", async ({ page }) => {
  await installVisualViewportFixture(page)
  await installImmersiveLifecycleInstrumentation(page)
  await openClock(page)
  const baseline = await page.evaluate(() => {
    const lifecycle = (window as typeof window & { __immersiveLifecycle: {
      viewportListeners: Array<{ active: boolean }>
      windowListeners: Array<{ active: boolean }>
    } }).__immersiveLifecycle
    return {
      viewportRecords: lifecycle.viewportListeners.length,
      windowRecords: lifecycle.windowListeners.length,
    }
  })

  await page.getByRole("button", { name: "Clock", exact: true }).click()
  await expect.poll(() => page.evaluate(() => {
    const lifecycle = (window as typeof window & { __immersiveLifecycle: {
      observers: Array<{ targets: string[] }>
      viewportListeners: Array<{ active: boolean, type: string }>
      windowListeners: Array<{ active: boolean, type: string }>
    } }).__immersiveLifecycle
    const observer = lifecycle.observers.find((entry) => entry.targets.includes("protected") && entry.targets.includes("dock"))
    return Boolean(observer)
      && lifecycle.windowListeners.some((entry) => entry.active && entry.type === "resize")
      && lifecycle.windowListeners.some((entry) => entry.active && entry.type === "orientationchange")
      && lifecycle.viewportListeners.some((entry) => entry.active && entry.type === "resize")
      && lifecycle.viewportListeners.some((entry) => entry.active && entry.type === "scroll")
  })).toBe(true)

  const shellListenerId = await page.evaluate(({ viewportRecords, windowRecords }) => {
    const lifecycle = (window as typeof window & { __immersiveLifecycle: {
      viewportListeners: Array<{ listenerId: number, type: string }>
      windowListeners: Array<{ listenerId: number, type: string }>
    } }).__immersiveLifecycle
    return lifecycle.viewportListeners
      .slice(viewportRecords)
      .map((entry) => entry.listenerId)
      .find((listenerId) => {
        const viewportTypes = lifecycle.viewportListeners
          .slice(viewportRecords)
          .filter((entry) => entry.listenerId === listenerId)
          .map((entry) => entry.type)
          .sort()
        const windowTypes = lifecycle.windowListeners
          .slice(windowRecords)
          .filter((entry) => entry.listenerId === listenerId)
          .map((entry) => entry.type)
          .sort()
        return JSON.stringify(viewportTypes) === JSON.stringify(["resize", "scroll"])
          && JSON.stringify(windowTypes) === JSON.stringify(["orientationchange", "resize"])
      }) ?? null
  }, baseline)
  expect(shellListenerId).not.toBeNull()
  if (shellListenerId === null) throw new Error("Immersive shell listener was not instrumented")

  const pendingFrame = await page.getByRole("button", { name: "Close clock", exact: true }).evaluate(
    (closeButton, listenerId) => {
      const lifecycle = (window as typeof window & { __immersiveLifecycle: {
        rafRecords: Array<{
          callbackCalls: number
          canceled: boolean
          executed: boolean
          frameId: number
          held: boolean
          requestedByListenerId: number | null
        }>
        holdNextRafForListenerId: number | null
      } }).__immersiveLifecycle
      const priorFrameCount = lifecycle.rafRecords.length

      // Dispatch and unmount in one browser task so the selected frame is
      // definitely pending when React runs the shell's effect cleanup.
      lifecycle.holdNextRafForListenerId = listenerId
      window.visualViewport?.dispatchEvent(new Event("scroll"))
      const frame = lifecycle.rafRecords
        .slice(priorFrameCount)
        .find((entry) => entry.requestedByListenerId === listenerId)
      if (!(closeButton instanceof HTMLButtonElement)) {
        throw new Error("Expected the immersive panel close control to be a button.")
      }
      closeButton.click()

      return frame
        ? {
            callbackCalls: frame.callbackCalls,
            canceled: frame.canceled,
            executed: frame.executed,
            frameId: frame.frameId,
            held: frame.held,
          }
        : null
    },
    shellListenerId,
  )
  expect(pendingFrame).not.toBeNull()
  expect(pendingFrame).toMatchObject({
    callbackCalls: 0,
    executed: false,
    held: true,
  })
  if (!pendingFrame) throw new Error("Shell listener did not request an animation frame")
  await expect(page.locator("body")).not.toHaveClass(/chimer-running/)
  await page.waitForTimeout(50)

  const afterUnmount = await page.evaluate(({ frameId, viewportRecords, windowRecords }) => {
    const lifecycle = (window as typeof window & { __immersiveLifecycle: {
      flushHeldFrame: (frameId: number) => void
      observers: Array<{ disconnected: boolean, targets: string[] }>
      rafRecords: Array<{ callbackCalls: number, canceled: boolean, executed: boolean, frameId: number }>
      viewportListeners: Array<{ active: boolean, calls: number, listenerId: number, type: string }>
      windowListeners: Array<{ active: boolean, calls: number, listenerId: number, type: string }>
    } }).__immersiveLifecycle
    const ownedObserver = lifecycle.observers.find((entry) => entry.targets.includes("protected") && entry.targets.includes("dock"))
    lifecycle.flushHeldFrame(frameId)
    return {
      exactFrame: lifecycle.rafRecords.find((entry) => entry.frameId === frameId) ?? null,
      ownedObserverDisconnected: ownedObserver?.disconnected ?? false,
      viewportListeners: lifecycle.viewportListeners.slice(viewportRecords),
      windowListeners: lifecycle.windowListeners.slice(windowRecords),
    }
  }, { ...baseline, frameId: pendingFrame.frameId })

  expect(afterUnmount.ownedObserverDisconnected).toBe(true)
  expect(afterUnmount.exactFrame).toMatchObject({
    callbackCalls: 0,
    canceled: true,
    executed: false,
  })
  const shellViewportListeners = afterUnmount.viewportListeners.filter((entry) => entry.listenerId === shellListenerId)
  const shellWindowListeners = afterUnmount.windowListeners.filter((entry) => entry.listenerId === shellListenerId)
  expect(shellViewportListeners.every((entry) => !entry.active)).toBe(true)
  expect(shellWindowListeners.every((entry) => !entry.active)).toBe(true)
  const viewportCallsBeforeDispatch = shellViewportListeners.reduce((total, entry) => total + entry.calls, 0)
  const windowCallsBeforeDispatch = shellWindowListeners.reduce((total, entry) => total + entry.calls, 0)

  await page.evaluate(() => {
    window.dispatchEvent(new Event("resize"))
    window.dispatchEvent(new Event("orientationchange"))
    window.visualViewport?.dispatchEvent(new Event("resize"))
    window.visualViewport?.dispatchEvent(new Event("scroll"))
  })
  await page.waitForTimeout(50)
  await expect.poll(() => page.evaluate(({ listenerId, viewportCallsBefore, windowCallsBefore }) => {
    const lifecycle = (window as typeof window & { __immersiveLifecycle: {
      viewportListeners: Array<{ calls: number, listenerId: number }>
      windowListeners: Array<{ calls: number, listenerId: number }>
    } }).__immersiveLifecycle
    const viewportCalls = lifecycle.viewportListeners
      .filter((entry) => entry.listenerId === listenerId)
      .reduce((total, entry) => total + entry.calls, 0)
    const windowCalls = lifecycle.windowListeners
      .filter((entry) => entry.listenerId === listenerId)
      .reduce((total, entry) => total + entry.calls, 0)
    return viewportCalls === viewportCallsBefore && windowCalls === windowCallsBefore
  }, {
    listenerId: shellListenerId,
    viewportCallsBefore: viewportCallsBeforeDispatch,
    windowCallsBefore: windowCallsBeforeDispatch,
  })).toBe(true)
})
