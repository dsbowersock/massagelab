import { expect, test, type Locator, type Page } from "@playwright/test"

const ATMOSPHERE_STORAGE_KEY = "massagelab-atmosphere-v2"
const CHIMER_STORAGE_KEY = "massagelab-chimer-settings"
const VISUAL_PANEL_OPENED_STORAGE_KEY = "massagelab.chimer.visual-panel-opened.v1"
const PROOF_STATION_TITLE = "MassageLab Proof Drone"

type DeviceVisualizerPreferences = {
  backgroundId: string | null
  showClock: boolean
}

function storedAtmosphereState(visualizer: DeviceVisualizerPreferences) {
  return {
    version: 2,
    favorites: ["tone-proof-drone"],
    recentStations: ["tone-proof-drone"],
    volume: 0.4,
    miniPlayerCollapsed: false,
    visualizer,
    migrations: {
      legacyMusicBackground: true,
    },
  }
}

async function seedDeviceVisualizer(
  page: Page,
  visualizer: DeviceVisualizerPreferences,
) {
  await page.addInitScript(({ key, state }) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify(state))
    }
  }, {
    key: ATMOSPHERE_STORAGE_KEY,
    state: storedAtmosphereState(visualizer),
  })
}

async function installWakeLockProof(page: Page) {
  await page.addInitScript(() => {
    const requestKey = "__task8WakeLockRequests"
    const releaseKey = "__task8WakeLockReleases"
    const state = {
      requests: Number(sessionStorage.getItem(requestKey) ?? 0),
      releases: Number(sessionStorage.getItem(releaseKey) ?? 0),
    }
    Reflect.set(window, "__task8WakeLock", state)
    Object.defineProperty(Navigator.prototype, "wakeLock", {
      configurable: true,
      get: () => ({
        request: async () => {
          state.requests += 1
          sessionStorage.setItem(requestKey, String(state.requests))
          const listeners = new Map<string, EventListener>()
          return {
            released: false,
            addEventListener(type: string, listener: EventListener) {
              listeners.set(type, listener)
            },
            removeEventListener(type: string) {
              listeners.delete(type)
            },
            async release() {
              state.releases += 1
              sessionStorage.setItem(releaseKey, String(state.releases))
            },
          }
        },
      }),
    })
  })
}

async function wakeLockRequestCount(page: Page) {
  return page.evaluate(() => (
    Reflect.get(window, "__task8WakeLock") as { requests: number }
  ).requests)
}

async function startProofStation(page: Page, origin = "/music") {
  await page.goto(origin, { waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("heading", { name: /Atmosphere audio stations/i, includeHidden: true }),
  ).toBeAttached()
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const player = page.getByTestId("music-player-toolbar")
  await expect(player).toBeVisible({ timeout: 30_000 })
  await expect(player.getByText(PROOF_STATION_TITLE)).toBeVisible()
  return player
}

async function openVisualizerFromPlayer(page: Page) {
  await page.getByRole("button", { name: "Background", exact: true }).last().click()
  await expect(page).toHaveURL(/\/clock\?[^#]*source=music/)
  await expect(page.getByLabel("Music visualizer")).toBeVisible()
}

async function selectStaticGradient(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Background" })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Preview Static gradient background" }).click()
  await dialog.getByRole("button", { name: "Select Static gradient background" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    "static-gradient",
  )
}

async function selectNextAvailableBackground(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Background" })
  const next = dialog.getByRole("button", { name: "Next background" })
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const select = dialog.getByRole("button", { name: /^Select .* background$/ })
    if (await select.count() > 0 && await select.isEnabled()) {
      await select.click()
      return
    }
    await next.click()
  }
  throw new Error("No available unselected background was reachable")
}

async function openClock(page: Page) {
  await page.goto("/clock", { waitUntil: "domcontentloaded" })
  await expect(page.getByLabel("Chimer clock")).toBeVisible()
  await expect(page.locator("body")).toHaveClass(/chimer-running/)
}

async function startActiveChimer(page: Page) {
  await page.goto("/chimer", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: /^Continue$/i }).click()
  }
  await page.getByRole("button", { name: /^Start Chimer$/i }).click()
  await expect(page.getByLabel("Running Chimer timer")).toBeVisible()
}

async function expectModalCoversAndBlocksGlobalControls(page: Page) {
  const modal = page.getByRole("dialog", { name: "Background" })
  const viewport = page.viewportSize()
  const box = await modal.boundingBox()
  expect(viewport).not.toBeNull()
  expect(box).not.toBeNull()
  if (!viewport || !box) return
  expect(box.x).toBeLessThanOrEqual(1)
  expect(box.y).toBeLessThanOrEqual(1)
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1)
  expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1)

  const blockedTargets = await page.evaluate(() => {
    const selectors = [
      '[data-testid="music-player-toolbar"]',
      '[aria-label="Minimize visualizer"]',
      '[aria-label="Toggle fullscreen"]',
    ]
    return selectors.map((selector) => {
      const target = document.querySelector<HTMLElement>(selector)
      if (!target) return false
      const rect = target.getBoundingClientRect()
      const x = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2))
      const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2))
      const topElement = document.elementFromPoint(x, y)
      return Boolean(topElement && !target.contains(topElement))
    })
  })
  expect(blockedTargets).toEqual([true, true, true])
}

async function expectDockAvoidsDisplay(
  page: Page,
  panelName: "Clock" | "Visual",
  useKeyboard = false,
) {
  const control = page.getByRole("button", { name: panelName, exact: true })
  if (useKeyboard) {
    await control.focus()
    await page.keyboard.press("Enter")
  } else {
    await control.click()
  }
  const dock = page.locator("[data-immersive-dock]")
  await expect(dock).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const displayBox = document.querySelector<HTMLElement>("[data-protected-display]")
      ?.getBoundingClientRect()
    const dockBox = document.querySelector<HTMLElement>("[data-immersive-dock]")
      ?.getBoundingClientRect()
    if (!displayBox || !dockBox) return null
    const viewport = window.visualViewport
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth)
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
    const viewportCenter = (viewportLeft + viewportRight) / 2
    const dockCenter = (dockBox.left + dockBox.right) / 2
    const intersects = !(
      dockBox.right <= displayBox.left
      || displayBox.right <= dockBox.left
      || dockBox.bottom <= displayBox.top
      || displayBox.bottom <= dockBox.top
    )
    return {
      intersects,
      insideLeft: dockBox.left >= viewportLeft - 1,
      insideTop: dockBox.top >= viewportTop - 1,
      insideRight: dockBox.right <= viewportRight + 1,
      insideBottom: dockBox.bottom <= viewportBottom + 1,
      centered: Math.abs(dockCenter - viewportCenter) <= 1,
      dock: {
        top: dockBox.top,
        right: dockBox.right,
        bottom: dockBox.bottom,
        left: dockBox.left,
      },
      display: {
        top: displayBox.top,
        right: displayBox.right,
        bottom: displayBox.bottom,
        left: displayBox.left,
      },
      viewport: {
        top: viewportTop,
        right: viewportRight,
        bottom: viewportBottom,
        left: viewportLeft,
      },
    }
  })).toEqual(expect.objectContaining({
    intersects: false,
    insideLeft: true,
    insideTop: true,
    insideRight: true,
    insideBottom: true,
    centered: true,
  }))
  const close = page.getByRole("button", { name: "Close " + panelName + " panel" })
  if (!useKeyboard) {
    await expectHitTestable(page, control)
    await expectHitTestable(page, close)
  }
  if (useKeyboard) {
    await close.focus()
    await page.keyboard.press("Enter")
  } else {
    await close.click()
  }
  await expect(dock).toHaveCount(0)
}

async function expectHitTestable(page: Page, locator: Locator) {
  await locator.click({ trial: true })
}

async function expectFocusInside(page: Page, panel: Locator) {
  expect(await panel.evaluate((element) => (
    Boolean(document.activeElement && element.contains(document.activeElement))
  ))).toBe(true)
}

test("anonymous visualizer journey preserves playback, exact origin, and stopped station actions", async ({ page }) => {
  await seedDeviceVisualizer(page, { backgroundId: null, showClock: false })
  const origin = "/music?task8=exact-origin"
  const player = await startProofStation(page, origin)
  await openVisualizerFromPlayer(page)

  await expectModalCoversAndBlocksGlobalControls(page)
  await selectStaticGradient(page)
  await expect(page.getByTestId("running-current-time")).toHaveCount(0)

  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const showClock = page.getByRole("switch", { name: /^Show clock:/ })
  await expect(showClock).not.toBeChecked()
  await expect.poll(async () => {
    const [dockBox, playerBox] = await Promise.all([
      page.locator("[data-immersive-dock]").boundingBox(),
      player.boundingBox(),
    ])
    if (!dockBox || !playerBox) return false
    return dockBox.y + dockBox.height <= playerBox.y
  }).toBe(true)
  await expect.poll(() => showClock.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const dock = element.closest<HTMLElement>("[data-immersive-dock]")?.getBoundingClientRect()
    if (!dock) return null
    return {
      inside: dock.top <= rect.top && dock.bottom >= rect.bottom,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      dock: { top: dock.top, bottom: dock.bottom, left: dock.left, right: dock.right },
      pointerEvents: window.getComputedStyle(element).pointerEvents,
      rootClass: element.closest<HTMLElement>("[data-immersive-shell]")?.className ?? null,
    }
  })).toEqual(expect.objectContaining({ inside: true }))
  await expectHitTestable(page, showClock)
  await showClock.click()
  await expect(page.getByTestId("running-current-time")).toBeVisible()
  await page.getByRole("button", { name: "Close Clock panel" }).click()

  await page.getByRole("button", { name: "Minimize visualizer", exact: true }).last().click()
  await expect(page).toHaveURL(origin)
  await expect(player.getByText(PROOF_STATION_TITLE)).toBeVisible()
  await expect(player).toContainText(/Playing|Preparing audio|Preparing station/i)
  await expect(page.getByLabel("Music visualizer")).toHaveCount(0)
  await expect(page.getByTestId("chimer-premium-background")).toHaveCount(0)

  await openVisualizerFromPlayer(page)
  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    "static-gradient",
  )
  await page.getByRole("button", { name: "Minimize visualizer", exact: true }).last().click()
  await expect(page).toHaveURL(origin)

  await page.getByRole("button", { name: "Stop", exact: true }).last().click()
  await expect(player.getByText(PROOF_STATION_TITLE)).toBeVisible()
  await expect(player).toContainText("Stopped")
  await expect(page.getByRole("button", { name: "Background", exact: true }).last()).toBeVisible()

  await openVisualizerFromPlayer(page)
  await page.getByRole("button", { name: "Minimize visualizer", exact: true }).last().click()
  await page.goBack()
  await expect(page).toHaveURL(origin)
  await expect(page.getByLabel("Music visualizer")).toHaveCount(0)
})

test("Music Show clock persists across reload without changing ordinary Clock", async ({ page }) => {
  await seedDeviceVisualizer(page, { backgroundId: "static-gradient", showClock: false })
  await page.goto("/clock?source=music&returnTo=%2Fmusic", { waitUntil: "domcontentloaded" })
  await expect(page.getByLabel("Music visualizer")).toBeVisible()
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const musicShowClock = page.getByRole("switch", { name: /^Show clock:/ })
  await expect(musicShowClock).not.toBeChecked()
  await musicShowClock.click()
  await expect.poll(() => page.evaluate((key) => (
    JSON.parse(localStorage.getItem(key) ?? "{}").visualizer?.showClock
  ), ATMOSPHERE_STORAGE_KEY)).toBe(true)

  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("running-current-time")).toBeVisible()
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  await expect(page.getByRole("switch", { name: /^Show clock:/ })).toBeChecked()

  await page.goto("/clock", { waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("running-current-time")).toBeVisible()
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const ordinaryShowClock = page.getByRole("switch", { name: /^Show clock:/ })
  await expect(ordinaryShowClock).toBeChecked()
  await ordinaryShowClock.click()
  await expect(page.getByTestId("running-current-time")).toHaveCount(0)

  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("running-current-time")).toHaveCount(0)
  await page.goto("/clock?source=music&returnTo=%2Fmusic", { waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("running-current-time")).toBeVisible()
})

test("top-player state keeps the Music clock dock and its real control reachable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "single top-player state proof")
  await seedDeviceVisualizer(page, { backgroundId: "static-gradient", showClock: false })
  const player = await startProofStation(page, "/music?task8=top-player")
  await player.evaluate((element) => {
    element.setAttribute("data-placement", "top")
    document.body.classList.remove("ml-music-player-bottom")
    document.body.classList.add("ml-music-player-active", "ml-music-player-top")
  })
  await expect(player).toHaveAttribute("data-placement", "top")
  await expect(page.locator("body")).toHaveClass(/ml-music-player-top/)

  await openVisualizerFromPlayer(page)
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const showClock = page.getByRole("switch", { name: /^Show clock:/ })
  await expect.poll(async () => {
    const [dockBox, playerBox] = await Promise.all([
      page.locator("[data-immersive-dock]").boundingBox(),
      player.boundingBox(),
    ])
    return Boolean(dockBox && playerBox && playerBox.y + playerBox.height <= dockBox.y)
  }).toBe(true)
  await expectHitTestable(page, showClock)
  await showClock.click()
  await expect(page.getByTestId("running-current-time")).toBeVisible()
})

test("Clock, Music, and active Chimer keep wake and timer controls context-specific", async ({ page }) => {
  await installWakeLockProof(page)
  await seedDeviceVisualizer(page, { backgroundId: "static-gradient", showClock: false })

  await openClock(page)
  await expect.poll(() => wakeLockRequestCount(page)).toBeGreaterThan(0)
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const clockVisual = page.getByRole("dialog", { name: "Visual controls" })
  await expect(clockVisual.getByRole("switch", { name: /^Keep timer screen awake:/ })).toHaveCount(0)
  await expect(clockVisual.getByText("Remaining time", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Close Visual panel" }).click()

  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("heading", { name: /Atmosphere audio stations/i, includeHidden: true }),
  ).toBeAttached()
  const musicWakeBaseline = await wakeLockRequestCount(page)
  await page.goto("/clock?source=music&returnTo=%2Fmusic", { waitUntil: "domcontentloaded" })
  await expect.poll(() => wakeLockRequestCount(page)).toBeGreaterThan(musicWakeBaseline)
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const musicVisual = page.getByRole("dialog", { name: "Visual controls" })
  await expect(musicVisual.getByRole("switch", { name: /^Keep timer screen awake:/ })).toHaveCount(0)
  await page.getByRole("button", { name: "Close Visual panel" }).click()

  await startActiveChimer(page)
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const chimerVisual = page.getByRole("dialog", { name: "Visual controls" })
  await expect(chimerVisual.getByRole("switch").first()).toHaveAccessibleName(
    /^Keep timer screen awake:/,
  )
  await expect(chimerVisual.getByRole("switch", { name: /^Show clock:/ })).toHaveCount(0)
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const chimerClock = page.getByRole("dialog", { name: "Clock controls" })
  await expect(chimerClock.getByRole("switch", { name: /^Show clock:/ })).toHaveCount(0)
  await expect(chimerClock.getByText("Remaining time", { exact: true })).toBeVisible()
  await expect(chimerClock.getByLabel("Active chime interval minutes")).toBeVisible()
})

test("Clock and Visual panels honor toggle, focus, outside, portal, and no-autoclose rules", async ({ page }) => {
  await openClock(page)
  const clockControl = page.getByRole("button", { name: "Clock", exact: true })
  const visualControl = page.getByRole("button", { name: "Visual", exact: true })

  await clockControl.click()
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toBeVisible()
  await clockControl.click()
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)

  await clockControl.click()
  await visualControl.click()
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)
  await expect(page.getByRole("dialog", { name: "Visual controls" })).toBeVisible()
  await page.getByRole("button", { name: "Close Visual panel" }).click()
  await expect(visualControl).toBeFocused()

  await clockControl.click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)
  await expect(clockControl).toBeFocused()

  await clockControl.click()
  await page.locator("[data-protected-display]").click({ position: { x: 2, y: 2 } })
  await expect(page.getByRole("dialog", { name: "Clock controls" })).toHaveCount(0)

  await visualControl.click()
  const visual = page.getByRole("dialog", { name: "Visual controls" })
  await visual.getByRole("button", { name: "Primary color picker" }).click()
  const picker = page.getByRole("dialog", { name: "Primary color picker" })
  await picker.getByRole("slider", { name: "Primary color saturation and brightness" }).click({
    position: { x: 30, y: 30 },
  })
  await expect(visual).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(picker).toHaveCount(0)
  await expect(visual).toBeVisible()
  await page.waitForTimeout(6_500)
  await expect(visual).toBeVisible()
  await visualControl.click()
  await expect(visual).toHaveCount(0)
})

test("Background traps focus and selection, Escape, and Close restore its control", async ({ page }) => {
  await openClock(page)
  const backgroundControl = page.getByRole("button", { name: "Background", exact: true })
  const background = page.getByRole("dialog", { name: "Background" })

  await backgroundControl.click()
  await expect(background).toBeVisible()
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab")
    await expectFocusInside(page, background)
  }
  await page.keyboard.press("Escape")
  await expect(background).toHaveCount(0)
  await expect(backgroundControl).toBeFocused()

  await backgroundControl.click()
  await page.getByRole("button", { name: "Close Background panel" }).click()
  await expect(background).toHaveCount(0)
  await expect(backgroundControl).toBeFocused()

  await backgroundControl.click()
  await selectNextAvailableBackground(page)
  await expect(background).toHaveCount(0)
  await expect(backgroundControl).toBeFocused()

  await backgroundControl.click()
  const box = await background.boundingBox()
  const viewport = page.viewportSize()
  if (
    box
    && viewport
    && (box.x > 1 || box.y > 1 || box.x + box.width < viewport.width - 1 || box.y + box.height < viewport.height - 1)
  ) {
    await page.mouse.click(1, 1)
    await expect(background).toHaveCount(0)
    await expect(backgroundControl).toBeFocused()
  } else {
    await page.keyboard.press("Escape")
  }
})

test("Visual hint is one-time, pre-seen aware, and resilient to denied storage", async ({ page }) => {
  await page.addInitScript((key) => localStorage.removeItem(key), VISUAL_PANEL_OPENED_STORAGE_KEY)
  await openClock(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByRole("status", { name: "Customize this background in Visual." })).toBeVisible()

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), VISUAL_PANEL_OPENED_STORAGE_KEY)).toBe("1")
  await page.getByRole("button", { name: "Close Visual panel" }).click()
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toHaveCount(0)

  await page.evaluate((key) => localStorage.setItem(key, "1"), VISUAL_PANEL_OPENED_STORAGE_KEY)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await selectNextAvailableBackground(page)
  await expect(page.getByText("Customize this background in Visual.")).toHaveCount(0)
})

test("Visual hint storage-denial fallback remembers the in-memory visit", async ({ page }) => {
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

test("Clock and Visual docks avoid protected digits at required viewport shapes", async ({ page }, testInfo) => {
  const viewports = testInfo.project.name === "mobile-chromium"
    ? [{ name: "mobile portrait", width: 412, height: 915 }]
    : [
      { name: "desktop", width: 1280, height: 900 },
      { name: "short landscape", width: 844, height: 390 },
    ]

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openClock(page)
    for (const panelName of ["Clock", "Visual"] as const) {
      await expectDockAvoidsDisplay(page, panelName)
    }
    if (viewport.name === "desktop") {
      await page.getByRole("button", { name: "Clock", exact: true }).click()
      await expect(page.locator("[data-immersive-dock]")).toHaveAttribute(
        "data-immersive-dock",
        "bottom",
      )
      await page.getByRole("button", { name: "Close Clock panel" }).click()
    }
  }
})

test("Clock and Visual docks remain safe at 200 percent Chromium page scale", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === "mobile-chromium"
    ? { width: 412, height: 915 }
    : { width: 1280, height: 900 })
  await openClock(page)
  const session = await page.context().newCDPSession(page)
  await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 })
  for (const panelName of ["Clock", "Visual"] as const) {
    await expectDockAvoidsDisplay(page, panelName, true)
  }
  await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 })
})

test("rotation and forward glow follow the centered display and stop for reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "single rendered effect proof")
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      clockRotationEnabled: true,
      clockForwardGlowEnabled: true,
    }))
  }, CHIMER_STORAGE_KEY)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await startActiveChimer(page)

  const protectedDisplay = page.locator("[data-protected-display]")
  await expect(protectedDisplay.locator("[data-display-rotation-layer]")).toHaveCount(1)
  await expect(protectedDisplay.locator("[data-forward-projection]")).toHaveCount(1)
  await expect(protectedDisplay.locator("[data-forward-projection]")).toHaveAttribute(
    "aria-hidden",
    "true",
  )
  await expect.poll(() => protectedDisplay.locator("[data-forward-projection]").evaluate(
    (element) => getComputedStyle(element).pointerEvents,
  )).toBe("none")
  await expect.poll(() => page.evaluate(() => {
    const projection = document.querySelector<HTMLElement>("[data-forward-projection]")
      ?.getBoundingClientRect()
    const toolbar = document.querySelector<HTMLElement>("[aria-label='Immersive display controls']")
      ?.getBoundingClientRect()
    if (!projection || !toolbar) return false
    const toolbarControl = document.querySelector<HTMLElement>(
      "[aria-label='Immersive display controls'] [aria-label='Visual']",
    )
    if (!toolbarControl) return false
    const controlRect = toolbarControl.getBoundingClientRect()
    const hit = document.elementFromPoint(
      controlRect.left + (controlRect.width / 2),
      controlRect.top + (controlRect.height / 2),
    )
    return projection.right <= toolbar.left
      && projection.right <= window.innerWidth
      && (hit === toolbarControl || toolbarControl.contains(hit))
  })).toBe(true)
  await expect.poll(() => protectedDisplay.evaluate((element) => (
    element.closest("button")?.getAttribute("data-testid")
  ))).toBe("running-timer-clock")

  await page.getByRole("button", { name: "Show current time in center" }).click()
  await expect.poll(() => protectedDisplay.evaluate((element) => (
    element.closest("button")?.getAttribute("data-testid")
  ))).toBe("running-current-time")
  await expect(protectedDisplay.locator("[data-display-rotation-layer]")).toHaveCount(1)
  await expect(protectedDisplay.locator("[data-forward-projection]")).toHaveCount(1)

  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect.poll(() => protectedDisplay.locator("[data-display-rotation-layer]").evaluate(
    (element) => getComputedStyle(element).animationName,
  )).toBe("none")
})

test("signed-in defaults, device precedence, failed save, retry, and unrelated settings coexist", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "single account preference proof")
  const writes: Array<Record<string, unknown>> = []
  let failNextPut = true
  let serverAppSettings: Record<string, unknown> = {
    homeShortcuts: ["clock"],
    unrelatedSetting: { preserved: true },
    musicVisualizer: {
      defaultBackgroundId: "massage-lab-moving-gradient",
      showClock: false,
    },
  }

  await seedDeviceVisualizer(page, {
    backgroundId: "static-gradient",
    showClock: false,
  })
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "task8-user", email: "task8@example.com" } }),
    })
  })
  await page.route("**/api/account/preferences", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          features: [],
          chimerSettings: {},
          appSettings: serverAppSettings,
        }),
      })
      return
    }

    const payload = route.request().postDataJSON() as Record<string, unknown>
    const appSettings = payload.appSettings as Record<string, unknown> | undefined
    if (!appSettings?.musicVisualizer) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          features: [],
          chimerSettings: payload.chimerSettings ?? {},
          appSettings: serverAppSettings,
        }),
      })
      return
    }

    writes.push(payload)
    if (failNextPut) {
      failNextPut = false
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporary failure" }),
      })
      return
    }

    serverAppSettings = {
      ...serverAppSettings,
      ...appSettings,
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: [],
        chimerSettings: {},
        appSettings: serverAppSettings,
      }),
    })
  })

  await page.goto("/clock?source=music&returnTo=%2Fmusic", { waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    "static-gradient",
  )
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  await page.getByRole("button", { name: "Restore account default", exact: true }).click()
  await expect(page.getByTestId("chimer-premium-background")).toBeVisible()
  await page.getByRole("button", { name: "Close Visual panel" }).click()

  await page.getByRole("button", { name: "Background", exact: true }).click()
  await expect(
    page.getByRole("group", { name: "MassageLaba Lamp background" }),
  ).toHaveAttribute("aria-current", "true")
  await selectStaticGradient(page)
  const selectedBackgroundId = await page.getByTestId("chimer-premium-background")
    .getAttribute("data-background-id")
  expect(selectedBackgroundId).toBe("static-gradient")
  expect(writes).toHaveLength(0)

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  await page.getByRole("button", { name: "Set as visualizer default", exact: true }).click()
  await expect(page.getByText("Music visualizer preferences could not be saved. Try again.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible()
  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    selectedBackgroundId ?? "",
  )

  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  await expect(page.getByText("Music visualizer preferences could not be saved. Try again.")).toHaveCount(0)
  expect(serverAppSettings.homeShortcuts).toEqual(["clock"])
  expect(serverAppSettings.unrelatedSetting).toEqual({ preserved: true })
  expect(
    (serverAppSettings.musicVisualizer as { defaultBackgroundId?: string })
      .defaultBackgroundId,
  ).toBe(selectedBackgroundId)
})
