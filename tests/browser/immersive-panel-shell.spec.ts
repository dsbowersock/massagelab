import { expect, test, type Page } from "@playwright/test"

const VISUAL_PANEL_OPENED_STORAGE_KEY = "massagelab.chimer.visual-panel-opened.v1"

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
      observers: [] as Array<{ targets: string[], disconnected: boolean }>,
      rafCanceled: 0,
      rafRequested: 0,
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
    window.requestAnimationFrame = (callback) => {
      lifecycle.rafRequested += 1
      return originalRequestAnimationFrame(callback)
    }
    window.cancelAnimationFrame = (handle) => {
      lifecycle.rafCanceled += 1
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
          if (typeof listener === "function") listener.call(target, event)
          else listener.handleEvent(event)
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
  await openClock(page)
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visual = page.getByRole("dialog", { name: "Visual controls" })
  const primaryPickerButton = visual.getByRole("button", { name: "Primary color picker" })

  await primaryPickerButton.click()
  const picker = page.getByRole("dialog", { name: "Primary color picker" })
  await expect(picker).toBeVisible()
  await picker.getByRole("slider", { name: "Primary color saturation and brightness" }).focus()
  await page.keyboard.press("Escape")

  await expect(picker).toHaveCount(0)
  await expect(visual).toBeVisible()
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
  await page.getByRole("button", { name: "Close Background panel" }).click()
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

test("short viewport docks remain bounded and avoid the protected display", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openClock(page)

  for (const panelName of ["Clock", "Visual"] as const) {
    await page.getByRole("button", { name: panelName, exact: true }).click()
    const dock = page.locator("[data-immersive-dock]")
    await expect(dock).toBeVisible()
    await expect.poll(async () => {
      const [displayBox, dockBox] = await Promise.all([
        page.locator("[data-protected-display]").boundingBox(),
        dock.boundingBox(),
      ])
      if (!displayBox || !dockBox) return false
      const intersects = !(
        dockBox.x + dockBox.width <= displayBox.x
        || displayBox.x + displayBox.width <= dockBox.x
        || dockBox.y + dockBox.height <= displayBox.y
        || displayBox.y + displayBox.height <= dockBox.y
      )
      return !intersects
        && dockBox.x >= 0
        && dockBox.y >= 0
        && dockBox.x + dockBox.width <= 844
        && dockBox.y + dockBox.height <= 390
    }).toBe(true)
    await page.getByRole("button", { name: `Close ${panelName} panel` }).click()
  }
})

test("measured edge insets and visual-viewport offsets preserve the protected gap", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
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

test("rendered panel teardown disconnects observers and removes exact viewport listeners", async ({ page }) => {
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

  const cancelCountBeforeUnmount = await page.evaluate(() => (
    (window as typeof window & { __immersiveLifecycle: { rafCanceled: number } }).__immersiveLifecycle.rafCanceled
  ))
  await page.getByRole("button", { name: "Close clock", exact: true }).click()
  await expect(page.locator("body")).not.toHaveClass(/chimer-running/)

  const afterUnmount = await page.evaluate(({ viewportRecords, windowRecords }) => {
    const lifecycle = (window as typeof window & { __immersiveLifecycle: {
      observers: Array<{ disconnected: boolean, targets: string[] }>
      rafCanceled: number
      rafRequested: number
      viewportListeners: Array<{ active: boolean, calls: number, listenerId: number, type: string }>
      windowListeners: Array<{ active: boolean, calls: number, listenerId: number, type: string }>
    } }).__immersiveLifecycle
    const ownedObserver = lifecycle.observers.find((entry) => entry.targets.includes("protected") && entry.targets.includes("dock"))
    return {
      ownedObserverDisconnected: ownedObserver?.disconnected ?? false,
      rafCanceled: lifecycle.rafCanceled,
      rafRequested: lifecycle.rafRequested,
      viewportListeners: lifecycle.viewportListeners.slice(viewportRecords),
      windowListeners: lifecycle.windowListeners.slice(windowRecords),
    }
  }, baseline)

  expect(afterUnmount.ownedObserverDisconnected).toBe(true)
  expect(afterUnmount.rafCanceled).toBeGreaterThan(cancelCountBeforeUnmount)
  const shellListenerId = afterUnmount.viewportListeners
    .map((entry) => entry.listenerId)
    .find((listenerId) => {
      const viewportTypes = afterUnmount.viewportListeners
        .filter((entry) => entry.listenerId === listenerId)
        .map((entry) => entry.type)
        .sort()
      const windowTypes = afterUnmount.windowListeners
        .filter((entry) => entry.listenerId === listenerId)
        .map((entry) => entry.type)
        .sort()
      return JSON.stringify(viewportTypes) === JSON.stringify(["resize", "scroll"])
        && JSON.stringify(windowTypes) === JSON.stringify(["orientationchange", "resize"])
    })
  expect(shellListenerId).toBeDefined()
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
