import { expect, test, type Locator, type Page } from "@playwright/test"
import { centerCarouselItem } from "./carousel-test-helpers"

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
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
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
  await centerCarouselItem(page, "static-gradient", "Next background")
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

async function installSignedInFreeAccount(page: Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "visualizer-free-user", email: "free@example.com" } }),
    })
  })
  await page.route("**/api/account/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ features: [], chimerSettings: {}, appSettings: {} }),
    })
  })
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
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    await control.focus()
    await expect(control).toBeFocused()
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
  if (useKeyboard) {
    await expectToolbarInsideVisualViewport(page)
  }
  const close = page.getByRole("button", { name: "Close " + panelName + " panel" })
  if (!useKeyboard) {
    await expectHitTestable(page, control)
    await expectHitTestable(page, close)
  }
  if (useKeyboard) {
    await close.focus()
    await expect(close).toBeFocused()
    await page.keyboard.press("Enter")
  } else {
    await close.click()
  }
  await expect(dock).toHaveCount(0)
}

async function expectHitTestable(page: Page, locator: Locator) {
  await locator.click({ trial: true })
}

async function expectToolbarInsideVisualViewport(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>("[aria-label='Immersive display controls']")
      ?.getBoundingClientRect()
    if (!toolbar) return null
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0
    const top = viewport?.offsetTop ?? 0
    const right = left + (viewport?.width ?? window.innerWidth)
    const bottom = top + (viewport?.height ?? window.innerHeight)
    return {
      insideLeft: toolbar.left >= left - 1,
      insideTop: toolbar.top >= top - 1,
      insideRight: toolbar.right <= right + 1,
      insideBottom: toolbar.bottom <= bottom + 1,
    }
  })).toEqual({
    insideLeft: true,
    insideTop: true,
    insideRight: true,
    insideBottom: true,
  })
}

async function expectFocusInside(page: Page, panel: Locator) {
  expect(await panel.evaluate((element) => (
    Boolean(document.activeElement && element.contains(document.activeElement))
  ))).toBe(true)
}

async function focusedRingBounds(page: Page, control: Locator) {
  await control.focus()
  await expect(control).toBeFocused()
  return control.evaluate((element) => {
    const toolbar = element.closest<HTMLElement>("[aria-label='Immersive display controls']")
    if (!toolbar) return null
    const controlBox = element.getBoundingClientRect()
    const toolbarBox = toolbar.getBoundingClientRect()
    const styles = window.getComputedStyle(element)
    const ringExtent = (Number.parseFloat(styles.outlineWidth) || 0)
      + (Number.parseFloat(styles.outlineOffset) || 0)
    return {
      control: {
        top: controlBox.top,
        right: controlBox.right,
        bottom: controlBox.bottom,
        left: controlBox.left,
      },
      toolbar: {
        top: toolbarBox.top,
        right: toolbarBox.right,
        bottom: toolbarBox.bottom,
        left: toolbarBox.left,
      },
      ringExtent,
      ringInside: controlBox.left - ringExtent >= toolbarBox.left - 0.5
        && controlBox.top - ringExtent >= toolbarBox.top - 0.5
        && controlBox.right + ringExtent <= toolbarBox.right + 0.5
        && controlBox.bottom + ringExtent <= toolbarBox.bottom + 0.5,
    }
  })
}

test("anonymous visualizer journey preserves playback, exact origin, and stopped station actions", async ({ page }) => {
  await seedDeviceVisualizer(page, { backgroundId: null, showClock: false })
  const origin = "/music?task8=exact-origin"
  const player = await startProofStation(page, origin)
  await openVisualizerFromPlayer(page)

  await expectModalCoversAndBlocksGlobalControls(page)
  await selectStaticGradient(page)
  await expect(page.getByTestId("running-current-time")).toHaveCount(0)

  const renderedBackground = page.getByTestId("chimer-premium-background")
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visualPanel = page.getByRole("dialog", { name: "Visual controls" })
  const backgroundAnimation = visualPanel.getByRole("switch", { name: /^Background animation:/ })
  await expect(backgroundAnimation).toBeChecked()
  await backgroundAnimation.click()
  await expect(backgroundAnimation).not.toBeChecked()
  await expect(renderedBackground).toHaveAttribute("data-background-motion", "paused")
  await backgroundAnimation.click()
  await expect(backgroundAnimation).toBeChecked()
  await expect(renderedBackground).toHaveAttribute("data-background-motion", "playing")
  await page.getByRole("button", { name: "Close Visual panel" }).click()

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
    const toolbar = document.querySelector<HTMLElement>("[aria-label='Immersive display controls']")
      ?.getBoundingClientRect()
    if (!dock || !toolbar) return null
    return {
      inside: dock.top <= rect.top && dock.bottom >= rect.bottom,
      clearsToolbar: dock.top >= toolbar.bottom,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      dock: { top: dock.top, bottom: dock.bottom, left: dock.left, right: dock.right },
      pointerEvents: window.getComputedStyle(element).pointerEvents,
      rootClass: element.closest<HTMLElement>("[data-immersive-shell]")?.className ?? null,
    }
  })).toEqual(expect.objectContaining({ inside: true, clearsToolbar: true }))
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
  await expect(chimerVisual.getByRole("switch", { name: /^Background animation:/ })).toBeVisible()
  await expect(chimerVisual.getByRole("switch", { name: /^Keep timer screen awake:/ })).toBeVisible()
  await expect(chimerVisual.getByRole("switch", { name: /^Show clock:/ })).toHaveCount(0)
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const chimerClock = page.getByRole("dialog", { name: "Clock controls" })
  await expect(chimerClock.getByRole("switch", { name: /^Show clock:/ })).toHaveCount(0)
  await expect(chimerClock.getByText("Remaining time", { exact: true })).toBeVisible()
  await expect(chimerClock.getByLabel("Active chime interval minutes")).toBeVisible()
})

test("Clock and Visual panels honor toggle, focus, outside, portal, and no-autoclose rules", async ({ page }) => {
  await installSignedInFreeAccount(page)
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
  await expect.soft(page.getByRole("button", { name: "Close Background panel" })).toHaveClass(/ml-button-destructive/)
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab")
    await expectFocusInside(page, background)
  }
  await page.keyboard.press("Escape")
  await expect(background).toHaveCount(0)
  await expect(backgroundControl).toBeFocused()

  await backgroundControl.click()
  await page.getByRole("button", { name: "Close Background panel" }).press("Enter")
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

test("Clock and Visual docks fill the safe edge with useful first-viewport density", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "single 539x597 rendered density proof")
  await page.setViewportSize({ width: 539, height: 597 })
  await openClock(page)

  for (const panelName of ["Clock", "Visual"] as const) {
    await page.getByRole("button", { name: panelName, exact: true }).click()
    await expect.poll(() => page.evaluate(() => {
      const display = document.querySelector<HTMLElement>("[data-protected-display]")
        ?.getBoundingClientRect()
      const dockElement = document.querySelector<HTMLElement>("[data-immersive-dock]")
      const dock = dockElement?.getBoundingClientRect()
      const scrollerElement = dockElement?.querySelector<HTMLElement>(":scope > div:last-child")
      const scroller = scrollerElement?.getBoundingClientRect()
      const edge = dockElement?.dataset.immersiveDock
      if (!display || !dock || !scrollerElement || !scroller || !edge) return null

      const safeGap = edge === "bottom"
        ? dock.top - display.bottom
        : display.top - dock.bottom
      const availableHeight = edge === "bottom"
        ? dock.bottom - display.bottom - 16
        : display.top - dock.top - 16
      const visibleInteractiveCount = Array.from(scrollerElement.querySelectorAll<HTMLElement>(
        "button, input, select, [role='switch'], [role='slider']",
      )).filter((element) => {
        const box = element.getBoundingClientRect()
        return box.width > 0
          && box.height > 0
          && box.top >= scroller.top - 1
          && box.bottom <= scroller.bottom + 1
      }).length

      return {
        gapPx: Math.round(safeGap),
        dockHeightPx: Math.round(dock.height),
        availableHeightPx: Math.round(availableHeight),
        visibleInteractiveCount,
        safeGap: safeGap >= 14 && safeGap <= 18,
        fillsAvailableHeight: Math.abs(dock.height - availableHeight) <= 2,
        usefulFirstViewport: visibleInteractiveCount >= 2,
        internallyScrollable: scrollerElement.scrollHeight > scrollerElement.clientHeight,
      }
    })).toEqual({
      gapPx: expect.any(Number),
      dockHeightPx: expect.any(Number),
      availableHeightPx: expect.any(Number),
      visibleInteractiveCount: expect.any(Number),
      safeGap: true,
      fillsAvailableHeight: true,
      usefulFirstViewport: true,
      internallyScrollable: true,
    })
    await page.getByRole("button", { name: `Close ${panelName} panel` }).click()
  }
})

test("539px dock headers own shared actions and compact visual color controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "single 539px rendered control-layout proof")
  await page.setViewportSize({ width: 539, height: 597 })
  await openClock(page)

  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const clockPanel = page.getByRole("dialog", { name: "Clock controls" })
  const clockHeader = clockPanel.locator(":scope > div").first()
  const clockScroller = clockPanel.locator(":scope > div").nth(1)
  const showClock = clockPanel.getByRole("switch", { name: /^Show clock:/ })
  await expect(showClock).toHaveCount(1)
  await expect.soft(showClock).toBeEnabled()
  await expect.soft(showClock).toBeChecked()
  await expect.soft(clockHeader.getByText("Show clock", { exact: true })).toHaveCount(0)
  expect.soft(await clockHeader.evaluate((header, switchElement) => header.contains(switchElement), await showClock.elementHandle())).toBe(true)
  expect.soft(await clockScroller.evaluate((scroller, switchElement) => scroller.contains(switchElement), await showClock.elementHandle())).toBe(false)
  const showSeconds = clockPanel.getByRole("switch", { name: /^Show seconds:/ })
  const headerClockColor = clockPanel.getByRole("button", { name: "Clock color picker" })
  await expect(showSeconds).toHaveCount(1)
  await expect.soft(clockHeader.getByText("Show seconds", { exact: true })).toHaveCount(1)
  expect.soft(await clockHeader.evaluate((header, control) => header.contains(control), await showSeconds.elementHandle())).toBe(true)
  expect.soft(await clockScroller.evaluate((scroller, control) => scroller.contains(control), await showSeconds.elementHandle())).toBe(false)
  await expect(headerClockColor).toHaveCount(1)
  await expect.soft(clockHeader.getByText("Color", { exact: true })).toHaveCount(1)
  expect.soft(await clockHeader.evaluate((header, control) => header.contains(control), await headerClockColor.elementHandle())).toBe(true)
  expect.soft(await clockScroller.evaluate((scroller, control) => scroller.contains(control), await headerClockColor.elementHandle())).toBe(false)
  await expect.soft(clockScroller.getByText("Show clock seconds", { exact: true })).toHaveCount(0)
  await expect.soft(clockScroller.getByText("Clock color", { exact: true })).toHaveCount(0)
  await expect.soft(clockScroller.getByText("Font size", { exact: true })).toHaveCount(0)
  const closeClock = clockPanel.getByRole("button", { name: "Close Clock panel" })
  await expect.soft(closeClock).toHaveClass(/ml-button-destructive/)
  const clockHeaderOrder = await clockHeader.evaluate((header) => {
    const title = header.querySelector("h2")?.getBoundingClientRect()
    const toggle = header.querySelector<HTMLElement>("[role='switch']")?.getBoundingClientRect()
    const seconds = header.querySelector<HTMLElement>("[aria-label^='Show seconds:']")?.getBoundingClientRect()
    const color = header.querySelector<HTMLElement>("[aria-label='Clock color picker']")?.getBoundingClientRect()
    const close = header.querySelector<HTMLElement>("[aria-label='Close Clock panel']")?.getBoundingClientRect()
    const bounds = header.getBoundingClientRect()
    const colorControl = header.querySelector<HTMLElement>("[aria-label='Clock color picker']")?.parentElement?.parentElement?.getBoundingClientRect()
    const secondsControl = header.querySelector<HTMLElement>("[aria-label^='Show seconds:']")?.parentElement?.getBoundingClientRect()
    if (!title || !toggle || !seconds || !color || !close || !colorControl || !secondsControl) return null
    return {
      orderedAfterTitle: toggle.left >= title.right
        && colorControl.left >= toggle.right
        && secondsControl.left >= colorControl.right
        && close.left >= secondsControl.right,
      toggleNearHeading: toggle.left - title.right <= 16,
      evenlyDistributed: (() => {
        const gaps = [
          colorControl.left - toggle.right,
          secondsControl.left - colorControl.right,
          close.left - secondsControl.right,
        ]
        return Math.max(...gaps) - Math.min(...gaps) <= 2
      })(),
      colorWidth: Math.round(color.width),
      colorHeight: Math.round(color.height),
      closePinnedRight: bounds.right - close.right <= 16,
    }
  })
  expect.soft(clockHeaderOrder).toEqual({
    orderedAfterTitle: true,
    toggleNearHeading: true,
    evenlyDistributed: true,
    colorWidth: 32,
    colorHeight: 32,
    closePinnedRight: true,
  })

  const [clockFontBounds, clockTextBounds, displayRotationBounds] = await Promise.all([
    clockPanel.getByLabel("Font").boundingBox(),
    clockPanel.getByText("Clock text", { exact: true }).boundingBox(),
    clockPanel.getByRole("switch", { name: /^Display rotation:/ }).boundingBox(),
  ])
  const clockBodyOrder = clockFontBounds && clockTextBounds && displayRotationBounds
    ? {
        compactRowFirst: clockFontBounds.y < clockTextBounds.y,
        textBeforeEffects: clockTextBounds.y < displayRotationBounds.y,
      }
    : null
  expect.soft(clockBodyOrder).toEqual({ compactRowFirst: true, textBeforeEffects: true })
  await expect.soft(clockScroller.getByText("Display effects", { exact: true })).toHaveCount(0)

  const compactCardsAt539 = await clockPanel.evaluate((panel) => {
    const fontControl = panel.querySelector<HTMLSelectElement>("[aria-label='Font']")
    const formatControl = panel.querySelector<HTMLElement>("[aria-label='Time format']")
    const fontField = fontControl?.closest<HTMLElement>("label")
    const formatField = formatControl?.parentElement
    const fontLabel = fontField?.querySelector<HTMLElement>("span")
    const formatLabel = formatField?.querySelector<HTMLElement>("span")
    const formatOptions = Array.from(formatControl?.querySelectorAll<HTMLElement>("button") ?? [])
    if (!fontControl || !formatControl || !fontField || !formatField || !fontLabel || !formatLabel) return null
    const font = fontControl.getBoundingClientRect()
    const format = formatControl.getBoundingClientRect()
    const fontCard = fontField.getBoundingClientRect()
    const formatCard = formatField.getBoundingClientRect()
    const fontText = fontLabel.getBoundingClientRect()
    const formatText = formatLabel.getBoundingClientRect()
    const visibleTextBounds = (element: HTMLElement) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getBoundingClientRect()
    }
    const fontVisibleText = visibleTextBounds(fontLabel)
    const formatVisibleText = visibleTextBounds(formatLabel)
    return {
      sideBySide: Math.abs(fontCard.top - formatCard.top) <= 1 && fontCard.right <= formatCard.left,
      fontInline: font.left >= fontText.right && Math.abs((font.top + font.bottom) / 2 - (fontText.top + fontText.bottom) / 2) <= 8,
      formatInline: format.left >= formatText.right && Math.abs((format.top + format.bottom) / 2 - (formatText.top + formatText.bottom) / 2) <= 8,
      controlsFill: fontCard.right - font.right >= 6 && fontCard.right - font.right <= 8
        && formatCard.right - format.right >= 6 && formatCard.right - format.right <= 8,
      fixedGaps: Math.abs(font.left - fontText.right - 16) <= 1
        && Math.abs(format.left - formatText.right - 16) <= 1,
      seventeenPixelLabelInset: fontVisibleText.left - fontCard.left >= 16
        && fontVisibleText.left - fontCard.left <= 19
        && formatVisibleText.left - formatCard.left >= 16
        && formatVisibleText.left - formatCard.left <= 19,
      compactHeights: Math.round(fontCard.height) === 59
        && Math.round(formatCard.height) === 59
        && Math.round(format.height) === 44,
      readableLabels: Number.parseFloat(getComputedStyle(fontLabel).fontSize) >= 13
        && Number.parseFloat(getComputedStyle(formatLabel).fontSize) >= 13,
      controlsInside: font.right <= fontCard.right && format.right <= formatCard.right,
      touchTargets: font.height >= 44 && formatOptions.length === 2
        && formatOptions.every((option) => option.getBoundingClientRect().height >= 44),
    }
  })
  expect.soft(compactCardsAt539).toEqual({
    sideBySide: true,
    fontInline: true,
    formatInline: true,
    controlsFill: true,
    fixedGaps: true,
    seventeenPixelLabelInset: true,
    compactHeights: true,
    readableLabels: true,
    controlsInside: true,
    touchTargets: true,
  })

  const shadowDimensions = await clockPanel.evaluate((panel) => {
    const swatch = panel.querySelector<HTMLElement>("[aria-label='Clock shadow color picker']")
    const colorRow = swatch?.parentElement?.parentElement
    const strengthLabel = Array.from(panel.querySelectorAll<HTMLElement>(".ml-range-control-label"))
      .find((element) => element.textContent?.trim() === "Shadow strength")
    const rangeShell = strengthLabel?.closest(".ml-range-control-shell")
    if (!swatch || !colorRow || !rangeShell) return null
    const swatchRect = swatch.getBoundingClientRect()
    const rowRect = colorRow.getBoundingClientRect()
    const rangeRect = rangeShell.getBoundingClientRect()
    return {
      rowHeight: Math.round(rowRect.height),
      swatchWidth: Math.round(swatchRect.width),
      swatchHeight: Math.round(swatchRect.height),
      rangeHeight: Math.round(rangeRect.height),
    }
  })
  expect.soft(shadowDimensions).toEqual({
    rowHeight: 44,
    swatchWidth: 36,
    swatchHeight: 36,
    rangeHeight: 44,
  })

  await page.setViewportSize({ width: 319, height: 823 })
  const narrowClockHeader = await clockHeader.evaluate((header) => {
    const elements = [
      header.querySelector<HTMLElement>("h2"),
      header.querySelector<HTMLElement>("[aria-label^='Show clock:']"),
      header.querySelector<HTMLElement>("[aria-label='Clock color picker']"),
      header.querySelector<HTMLElement>("[aria-label^='Show seconds:']"),
      header.querySelector<HTMLElement>("[aria-label='Close Clock panel']"),
    ].filter((element): element is HTMLElement => Boolean(element))
    const bounds = header.getBoundingClientRect()
    const rects = elements.map((element) => element.getBoundingClientRect())
    const colorControl = header.querySelector<HTMLElement>("[aria-label='Clock color picker']")?.parentElement?.parentElement?.getBoundingClientRect()
    const secondsControl = header.querySelector<HTMLElement>("[aria-label^='Show seconds:']")?.parentElement?.getBoundingClientRect()
    const overlaps = (first: DOMRect, second: DOMRect) => !(
      first.right <= second.left
      || second.right <= first.left
      || first.bottom <= second.top
      || second.bottom <= first.top
    )
    return {
      allPresent: rects.length === 5,
      allInside: rects.every((rect) => rect.left >= bounds.left && rect.right <= bounds.right
        && rect.top >= bounds.top && rect.bottom <= bounds.bottom),
      noOverlap: rects.every((rect, index) => rects.slice(index + 1).every((next) => !overlaps(rect, next))),
      closePinnedRight: bounds.right - (rects[4]?.right ?? 0) <= 16,
      closeOnTitleRow: Math.abs(
        ((rects[0]?.top ?? 0) + (rects[0]?.bottom ?? 0)) / 2
        - ((rects[4]?.top ?? 0) + (rects[4]?.bottom ?? 0)) / 2,
      ) <= 1,
      controlsOrdered: colorControl && secondsControl
        ? secondsControl.left >= colorControl.right
        : false,
    }
  })
  expect.soft(narrowClockHeader).toEqual({
    allPresent: true,
    allInside: true,
    noOverlap: true,
    closePinnedRight: true,
    closeOnTitleRow: true,
    controlsOrdered: true,
  })

  const compactCardsAt319 = await clockPanel.evaluate((panel) => {
    const fontControl = panel.querySelector<HTMLSelectElement>("[aria-label='Font']")
    const formatControl = panel.querySelector<HTMLElement>("[aria-label='Time format']")
    const fontField = fontControl?.closest<HTMLElement>("label")
    const formatField = formatControl?.parentElement
    const row = fontField?.parentElement
    const fontLabel = fontField?.querySelector<HTMLElement>("span")
    const formatLabel = formatField?.querySelector<HTMLElement>("span")
    const formatOptions = Array.from(formatControl?.querySelectorAll<HTMLElement>("button") ?? [])
    if (!fontControl || !formatControl || !fontField || !formatField || !row || !fontLabel || !formatLabel) return null
    const font = fontControl.getBoundingClientRect()
    const format = formatControl.getBoundingClientRect()
    const fontCard = fontField.getBoundingClientRect()
    const formatCard = formatField.getBoundingClientRect()
    const fontText = fontLabel.getBoundingClientRect()
    const formatText = formatLabel.getBoundingClientRect()
    return {
      singleColumn: formatCard.top >= fontCard.bottom && Math.abs(formatCard.left - fontCard.left) <= 1,
      fontInline: font.left >= fontText.right && Math.abs((font.top + font.bottom) / 2 - (fontText.top + fontText.bottom) / 2) <= 8,
      formatInline: format.left >= formatText.right && Math.abs((format.top + format.bottom) / 2 - (formatText.top + formatText.bottom) / 2) <= 8,
      fixedGaps: Math.abs(font.left - fontText.right - 16) <= 1
        && Math.abs(format.left - formatText.right - 16) <= 1,
      controlsFill: fontCard.right - font.right >= 6 && fontCard.right - font.right <= 8
        && formatCard.right - format.right >= 6 && formatCard.right - format.right <= 8,
      readableLabels: Number.parseFloat(getComputedStyle(fontLabel).fontSize) >= 13
        && Number.parseFloat(getComputedStyle(formatLabel).fontSize) >= 13,
      noOverflow: row.scrollWidth <= row.clientWidth + 1
        && font.right <= fontCard.right && format.right <= formatCard.right,
      touchTargets: font.height >= 44 && formatOptions.length === 2
        && formatOptions.every((option) => option.getBoundingClientRect().height >= 44),
    }
  })
  expect.soft(compactCardsAt319).toEqual({
    singleColumn: true,
    fontInline: true,
    formatInline: true,
    fixedGaps: true,
    controlsFill: true,
    readableLabels: true,
    noOverflow: true,
    touchTargets: true,
  })
  await expectHitTestable(page, closeClock)
  await closeClock.click()
  await page.setViewportSize({ width: 539, height: 597 })
  await page.waitForTimeout(500)

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visualPanel = page.getByRole("dialog", { name: "Visual controls" })
  const visualHeader = visualPanel.locator(":scope > div").first()
  const visualScroller = visualPanel.locator(":scope > div").nth(1)
  const visualBackground = visualPanel.getByRole("switch", { name: /^Background animation:/ })
  await expect(visualHeader.getByRole("heading", { name: "Visual background" })).toBeVisible()
  await expect(visualBackground).toHaveCount(1)
  await expect.soft(visualHeader.getByText("Visual background", { exact: true })).toHaveCount(1)
  expect.soft(await visualHeader.evaluate((header, toggle) => header.contains(toggle), await visualBackground.elementHandle())).toBe(true)
  expect.soft(await visualScroller.evaluate((scroller, toggle) => scroller.contains(toggle), await visualBackground.elementHandle())).toBe(false)
  const renderedBackground = page.getByTestId("chimer-premium-background")
  await expect(renderedBackground).toHaveCount(1)
  await visualBackground.click()
  await expect(renderedBackground).toHaveCount(1)
  await expect(renderedBackground).toHaveAttribute("data-ml-background-motion", "paused")
  await expect(visualPanel.getByText("Lamp main color", { exact: true })).toBeVisible()
  await expect(visualPanel.getByText("Lamp orb color", { exact: true })).toBeVisible()
  await visualBackground.click()
  await expect(renderedBackground).toHaveAttribute("data-ml-background-motion", "playing")
  const clockColor = visualPanel.getByRole("button", { name: "Clock color picker" })
  await expect(clockColor).toHaveCount(1)
  expect.soft(await visualHeader.evaluate((header, picker) => header.contains(picker), await clockColor.elementHandle())).toBe(true)
  expect.soft(await visualScroller.evaluate((scroller, picker) => scroller.contains(picker), await clockColor.elementHandle())).toBe(false)

  const closeVisual = visualPanel.getByRole("button", { name: "Close Visual panel" })
  await expect.soft(closeVisual).toHaveClass(/ml-button-destructive/)
  const headerGeometry = await visualHeader.evaluate((header) => {
    const title = header.querySelector("h2")?.getBoundingClientRect()
    const toggle = header.querySelector<HTMLElement>("[role='switch']")?.getBoundingClientRect()
    const swatch = header.querySelector<HTMLElement>("[aria-label='Clock color picker']")?.getBoundingClientRect()
    const colorControl = header.querySelector<HTMLElement>("[aria-label='Clock color picker']")?.parentElement?.parentElement?.getBoundingClientRect()
    const close = header.querySelector<HTMLElement>("[aria-label='Close Visual panel']")?.getBoundingClientRect()
    const bounds = header.getBoundingClientRect()
    if (!title || !toggle || !swatch || !colorControl || !close) return null
    const availableCenter = (toggle.right + close.left) / 2
    const colorCenter = (colorControl.left + colorControl.right) / 2
    return {
      titleReadable: title.width > 0 && title.height > 0,
      toggleImmediatelyAfterTitle: toggle.left >= title.right && toggle.left - title.right <= 24,
      colorBetweenClusters: colorControl.left >= toggle.right && colorControl.right <= close.left,
      colorCenteredInAvailableSpace: Math.abs(colorCenter - availableCenter) <= 2,
      swatchWidth: Math.round(swatch.width),
      swatchHeight: Math.round(swatch.height),
      closeInside: close.left >= bounds.left && close.right <= bounds.right
        && close.top >= bounds.top && close.bottom <= bounds.bottom,
    }
  })
  expect.soft(headerGeometry).toEqual({
    titleReadable: true,
    toggleImmediatelyAfterTitle: true,
    colorBetweenClusters: true,
    colorCenteredInAvailableSpace: true,
    swatchWidth: 32,
    swatchHeight: 32,
    closeInside: true,
  })
  await expectHitTestable(page, closeVisual)

  await page.setViewportSize({ width: 319, height: 823 })
  const narrowHeaderGeometry = await visualHeader.evaluate((header) => {
    const title = header.querySelector("h2")?.getBoundingClientRect()
    const toggle = header.querySelector<HTMLElement>("[role='switch']")?.getBoundingClientRect()
    const action = header.querySelector<HTMLElement>("[aria-label='Clock color picker']")?.getBoundingClientRect()
    const close = header.querySelector<HTMLElement>("[aria-label='Close Visual panel']")?.getBoundingClientRect()
    const bounds = header.getBoundingClientRect()
    if (!title || !toggle || !action || !close) return null
    const overlaps = (first: DOMRect, second: DOMRect) => !(
      first.right <= second.left
      || second.right <= first.left
      || first.bottom <= second.top
      || second.bottom <= first.top
    )
    return {
      titleReadable: title.width > 0 && title.height > 0,
      toggleInside: toggle.left >= bounds.left && toggle.right <= bounds.right,
      actionInside: action.left >= bounds.left && action.right <= bounds.right,
      closeInside: close.left >= bounds.left && close.right <= bounds.right,
      actionClearOfClose: !overlaps(action, close),
      titleClearOfToggle: !overlaps(title, toggle),
      toggleClearOfAction: !overlaps(toggle, action),
    }
  })
  expect.soft(narrowHeaderGeometry).toEqual({
    titleReadable: true,
    toggleInside: true,
    actionInside: true,
    closeInside: true,
    actionClearOfClose: true,
    titleClearOfToggle: true,
    toggleClearOfAction: true,
  })
  await expectHitTestable(page, closeVisual)

  const lampRow = visualPanel.getByText("Lamp main color", { exact: true }).locator("..").first()
  const compactRowGeometry = await lampRow.evaluate((row) => {
    const label = row.querySelector("span")?.getBoundingClientRect()
    const swatch = row.querySelector<HTMLElement>("button[aria-haspopup='dialog']")?.getBoundingClientRect()
    const bounds = row.getBoundingClientRect()
    if (!label || !swatch) return null
    return {
      rowHeight: Math.round(bounds.height * 10) / 10,
      inline: Math.abs((label.top + label.bottom) / 2 - (swatch.top + swatch.bottom) / 2) <= 1,
      swatchWidth: Math.round(swatch.width * 10) / 10,
      swatchHeight: Math.round(swatch.height * 10) / 10,
    }
  })
  expect.soft(compactRowGeometry).toEqual({
    rowHeight: 44,
    inline: true,
    swatchWidth: 44,
    swatchHeight: 44,
  })
})

test("guest Global Colors stay visible, disabled, and use equal 44px controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "single 539px rendered guest-permission proof")
  await page.setViewportSize({ width: 539, height: 597 })
  await openClock(page)
  await page.getByRole("button", { name: "Visual", exact: true }).click()
  const visualPanel = page.getByRole("dialog", { name: "Visual controls" })
  const globalColors = visualPanel.getByText("Global Colors", { exact: true }).locator("../..")
  await expect(globalColors).toBeVisible()
  await expect.soft(visualPanel.getByText(/Sign in to customize and save Global Colors/i)).toBeVisible()

  const modeToggle = globalColors.getByRole("switch", { name: /^Choose each color:/ })
  const harmonyButtons = globalColors.getByRole("group", { name: "Color harmony options" }).getByRole("button")
  const paletteSwatches = globalColors.getByRole("button", { name: / picker$/ })
  await expect.soft(modeToggle).toBeDisabled()
  await expect.soft(harmonyButtons.first()).toBeDisabled()
  await expect.soft(paletteSwatches).toHaveCount(5)
  for (const swatch of await paletteSwatches.all()) {
    await expect.soft(swatch).toBeDisabled()
  }
  await expect.soft(globalColors.getByRole("textbox", { name: "Palette name" })).toBeDisabled()
  await expect.soft(globalColors.getByRole("button", { name: "Save palette" })).toBeDisabled()

  const sizes = await Promise.all([
    paletteSwatches.first().boundingBox(),
    harmonyButtons.first().boundingBox(),
  ])
  const [swatchBox, harmonyBox] = sizes
  expect.soft(swatchBox && harmonyBox ? {
    swatch: [Math.round(swatchBox.width * 10) / 10, Math.round(swatchBox.height * 10) / 10],
    harmony: [Math.round(harmonyBox.width * 10) / 10, Math.round(harmonyBox.height * 10) / 10],
  } : null).toEqual({ swatch: [44, 44], harmony: [44, 44] })

  for (const label of ["Primary color", "Color 2", "Color 3", "Color 4", "Color 5"]) {
    const labelElement = globalColors.getByText(label, { exact: true })
    await expect.soft(labelElement).toBeVisible()
    expect.soft(await labelElement.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  }

  const paletteRowAt539 = await paletteSwatches.evaluateAll((swatches) => {
    const fields = swatches.map((swatch) => swatch.closest("div")?.parentElement)
      .filter((field): field is HTMLElement => Boolean(field))
    const rects = fields.map((field) => field.getBoundingClientRect())
    const grid = fields[0]?.parentElement?.getBoundingClientRect()
    return {
      sameRow: rects.every((rect) => Math.abs(rect.top - rects[0].top) <= 1),
      fiveColumns: new Set(rects.map((rect) => Math.round(rect.left))).size === 5,
      inside: grid ? rects.every((rect) => rect.left >= grid.left && rect.right <= grid.right) : false,
    }
  })
  expect.soft(paletteRowAt539).toEqual({ sameRow: true, fiveColumns: true, inside: true })

  await page.setViewportSize({ width: 319, height: 823 })
  await globalColors.scrollIntoViewIfNeeded()
  const paletteRowAt319 = await paletteSwatches.evaluateAll((swatches) => {
    const fields = swatches.map((swatch) => swatch.closest("div")?.parentElement)
      .filter((field): field is HTMLElement => Boolean(field))
    const rects = fields.map((field) => field.getBoundingClientRect())
    const gridElement = fields[0]?.parentElement
    const grid = gridElement?.getBoundingClientRect()
    const labels = fields.map((field) => field.querySelector<HTMLElement>("span")).filter(Boolean) as HTMLElement[]
    return {
      sameRow: rects.every((rect) => Math.abs(rect.top - rects[0].top) <= 1),
      fiveColumns: new Set(rects.map((rect) => Math.round(rect.left))).size === 5,
      inside: grid ? rects.every((rect) => rect.left >= grid.left && rect.right <= grid.right) : false,
      noHorizontalClip: gridElement ? gridElement.scrollWidth <= gridElement.clientWidth + 1 : false,
      labelsReadable: labels.length === 5 && labels.every((label) => label.scrollWidth <= label.clientWidth + 1),
    }
  })
  expect.soft(paletteRowAt319).toEqual({
    sameRow: true,
    fiveColumns: true,
    inside: true,
    noHorizontalClip: true,
    labelsReadable: true,
  })
})

test("narrow mobile keeps immersive controls in one circular top row", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "single narrow-mobile geometry proof")
  await page.setViewportSize({ width: 319, height: 823 })
  await openClock(page)

  const controls = [
    page.getByRole("button", { name: "Toggle fullscreen" }),
    page.getByRole("button", { name: "Clock", exact: true }),
    page.getByRole("button", { name: "Visual", exact: true }),
    page.getByRole("button", { name: "Background", exact: true }),
    page.getByRole("button", { name: "Close clock" }),
  ]
  const boxes = await Promise.all(controls.map((control) => control.boundingBox()))
  expect(boxes.every(Boolean)).toBe(true)
  if (boxes.some((box) => !box)) return

  const resolvedBoxes = boxes as NonNullable<(typeof boxes)[number]>[]
  const [fullscreenBox] = resolvedBoxes
  for (const box of resolvedBoxes) {
    expect(Math.abs(box.width - 48)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.height - 48)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.y - fullscreenBox.y)).toBeLessThanOrEqual(1)
  }
  for (let index = 1; index < resolvedBoxes.length; index += 1) {
    const previous = resolvedBoxes[index - 1]
    const current = resolvedBoxes[index]
    expect(previous.x + previous.width).toBeLessThanOrEqual(current.x)
  }
  for (const control of controls) {
    await expect.poll(() => control.evaluate((element) => {
      const styles = window.getComputedStyle(element)
      return Number.parseFloat(styles.borderRadius) >= (element.getBoundingClientRect().width / 2) - 1
    })).toBe(true)
  }

  for (const control of controls.slice(1, 4)) {
    expect.soft(await focusedRingBounds(page, control)).toEqual(expect.objectContaining({
      ringExtent: 4,
      ringInside: true,
    }))
  }
})

test("Clock and Visual docks remain safe at 200 percent Chromium page scale", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === "mobile-chromium"
    ? { width: 412, height: 915 }
    : { width: 1280, height: 900 })
  await openClock(page)
  const session = await page.context().newCDPSession(page)
  await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 })
  // Chromium CDP page-scale emulation has unstable pointer coordinates/actionability,
  // so this zoom proof uses explicit focus + Enter while geometry proves reachability.
  for (const panelName of ["Clock", "Visual"] as const) {
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    const toolbarControl = page.getByRole("button", { name: panelName, exact: true })
    expect.soft(await focusedRingBounds(page, toolbarControl)).toEqual(expect.objectContaining({
      ringExtent: 4,
      ringInside: true,
    }))
    await expectDockAvoidsDisplay(page, panelName, true)
  }
  await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 })
})

test("forward glow remains visible above the open Clock panel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "single rendered effect proof")
  await page.setViewportSize({ width: 539, height: 597 })
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      clockForwardGlowEnabled: true,
      clockForwardGlowStrength: 0.05,
      clockForwardGlowLength: 1.95,
      clockForwardGlowBlur: 0,
    }))
  }, CHIMER_STORAGE_KEY)
  await openClock(page)

  const protectedDisplay = page.locator("[data-protected-display]")
  const projection = protectedDisplay.locator("[data-forward-projection]")
  await expect(projection).toHaveCount(1)
  const readProjectionStyle = () => projection.evaluate((element) => {
    const bloom = window.getComputedStyle(element.children[0])
    const reflection = window.getComputedStyle(element.children[1])
    return {
      bloomOpacity: Number.parseFloat(bloom.opacity),
      reflectionOpacity: Number.parseFloat(reflection.opacity),
      bloomFilter: bloom.filter,
    }
  })
  await expect.poll(async () => (await readProjectionStyle()).bloomOpacity).toBeGreaterThanOrEqual(0.12)
  await expect.poll(async () => (await readProjectionStyle()).reflectionOpacity).toBeGreaterThanOrEqual(0.08)
  await expect.poll(async () => (await readProjectionStyle()).bloomFilter).toMatch(/drop-shadow\([^)]*[1-9]/)
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const clockPanel = page.getByRole("dialog", { name: "Clock controls" })
  await expect(clockPanel).toBeVisible()
  await expect.poll(async () => {
    const projectionBounds = await projection.boundingBox()
    const panelBounds = await clockPanel.boundingBox()
    if (!projectionBounds || !panelBounds) return 0
    return Math.max(0, panelBounds.y - projectionBounds.y)
  }).toBeGreaterThanOrEqual(8)
})

test("rotation and forward glow follow the centered display and stop for reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "single rendered effect proof")
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      clockRotationEnabled: true,
      clockRotationRange: 14,
      clockRotationDuration: 10,
      clockForwardGlowEnabled: true,
      clockForwardGlowStrength: 0.8,
      clockForwardGlowLength: 1.25,
      clockForwardGlowBlur: 22,
    }))
  }, CHIMER_STORAGE_KEY)
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await startActiveChimer(page)

  const protectedDisplay = page.locator("[data-protected-display]")
  const rotationLayer = protectedDisplay.locator("[data-display-rotation-layer]")
  const projection = protectedDisplay.locator("[data-forward-projection]")
  await expect(rotationLayer).toHaveCount(1)
  await expect(protectedDisplay.locator("[data-display-effect-bounds]")).toHaveCSS("perspective", "720px")
  await expect(rotationLayer).toHaveCSS("animation-duration", "10s")
  await expect.poll(() => rotationLayer.evaluate((element) => ({
    min: getComputedStyle(element).getPropertyValue("--immersive-display-yaw-min").trim(),
    max: getComputedStyle(element).getPropertyValue("--immersive-display-yaw-max").trim(),
  }))).toEqual({ min: "-14deg", max: "14deg" })
  const initialRotationTransform = await rotationLayer.evaluate((element) => getComputedStyle(element).transform)
  await expect.poll(() => rotationLayer.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initialRotationTransform)
  await expect(projection).toHaveCount(1)
  await expect(projection.locator(":scope > span")).toHaveCount(2)
  await expect.poll(() => projection.evaluate((element) => ({
    bloomOpacity: Number.parseFloat(
      getComputedStyle(element).getPropertyValue("--immersive-forward-glow-bloom-opacity"),
    ),
    length: getComputedStyle(element).getPropertyValue("--immersive-forward-glow-length").trim(),
    blur: getComputedStyle(element).getPropertyValue("--immersive-forward-glow-blur").trim(),
  }))).toEqual({ bloomOpacity: 0.55 * Math.sqrt(0.8), length: "1.25", blur: "22px" })
  await expect(protectedDisplay.locator("[data-forward-projection]")).toHaveAttribute(
    "aria-hidden",
    "true",
  )
  await expect.poll(() => protectedDisplay.locator("[data-forward-projection]").evaluate(
    (element) => getComputedStyle(element).pointerEvents,
  )).toBe("none")
  const visualToolbarControl = page.getByRole("button", { name: "Visual", exact: true })
  const visualToolbarBounds = await visualToolbarControl.boundingBox()
  if (!visualToolbarBounds) throw new Error("Visual toolbar control is not measurable")
  await page.mouse.move(1, 1)
  await page.mouse.move(
    visualToolbarBounds.x + (visualToolbarBounds.width / 2),
    visualToolbarBounds.y + (visualToolbarBounds.height / 2),
  )
  await expect(page.locator("[data-immersive-shell]")).not.toHaveClass(/rootHidden/)
  await expect.poll(() => page.evaluate(() => {
    const projection = document.querySelector<HTMLElement>("[data-forward-projection]")
      ?.getBoundingClientRect()
    const toolbar = document.querySelector<HTMLElement>("[aria-label='Immersive display controls']")
      ?.getBoundingClientRect()
    const shell = document.querySelector<HTMLElement>("[data-immersive-shell]")
    const primaryClipElement = document.querySelector<HTMLElement>("[data-immersive-primary-display='true']")
    const viewportClipElement = primaryClipElement?.closest<HTMLElement>("[data-immersive-stage]")
    const primaryClip = viewportClipElement?.getBoundingClientRect()
    if (!projection || !toolbar || !primaryClip || !primaryClipElement || !viewportClipElement) {
      return { safe: false, reason: "missing geometry" }
    }
    const toolbarControl = document.querySelector<HTMLElement>(
      "[aria-label='Immersive display controls'] [aria-label='Visual']",
    )
    if (!toolbarControl) return { safe: false, reason: "missing toolbar control" }
    const controlRect = toolbarControl.getBoundingClientRect()
    const hit = document.elementFromPoint(
      controlRect.left + (controlRect.width / 2),
      controlRect.top + (controlRect.height / 2),
    )
    const overlapsToolbar = !(
      projection.right <= toolbar.left
      || toolbar.right <= projection.left
      || projection.bottom <= toolbar.top
      || toolbar.bottom <= projection.top
    )
    const safe = !overlapsToolbar
      && projection.top >= 0
      && projection.bottom <= window.innerHeight
      && primaryClip.left >= 0
      && primaryClip.right <= window.innerWidth
      && primaryClip.top >= 0
      && primaryClip.bottom <= window.innerHeight
      && getComputedStyle(viewportClipElement).overflow === "hidden"
      && (hit === toolbarControl || toolbarControl.contains(hit))
    return {
      safe,
      projection: {
        left: projection.left,
        right: projection.right,
        top: projection.top,
        bottom: projection.bottom,
      },
      toolbar: {
        left: toolbar.left,
        right: toolbar.right,
        top: toolbar.top,
        bottom: toolbar.bottom,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      primaryClip: {
        left: primaryClip.left,
        right: primaryClip.right,
        top: primaryClip.top,
        bottom: primaryClip.bottom,
        overflow: getComputedStyle(viewportClipElement).overflow,
      },
      overlapsToolbar,
      toolbarHitSafe: hit === toolbarControl || toolbarControl.contains(hit),
      hit: hit ? {
        tag: hit.tagName,
        ariaLabel: hit.getAttribute("aria-label"),
        className: hit.getAttribute("class"),
      } : null,
      projectionStyle: {
        width: getComputedStyle(document.querySelector<HTMLElement>("[data-forward-projection]")!).width,
        maxWidth: getComputedStyle(document.querySelector<HTMLElement>("[data-forward-projection]")!).maxWidth,
        transform: getComputedStyle(document.querySelector<HTMLElement>("[data-forward-projection]")!).transform,
      },
      shell: shell ? {
        className: shell.className,
        zIndex: getComputedStyle(shell).zIndex,
        pointerEvents: getComputedStyle(shell).pointerEvents,
        opacity: getComputedStyle(shell).opacity,
      } : null,
    }
  })).toEqual(expect.objectContaining({ safe: true }))
  await expect.poll(() => protectedDisplay.evaluate((element) => (
    element.closest("button")?.getAttribute("data-testid")
  ))).toBe("running-timer-clock")

  await page.getByRole("button", { name: "Show current time in center" }).click()
  await expect.poll(() => protectedDisplay.evaluate((element) => (
    element.closest("button")?.getAttribute("data-testid")
  ))).toBe("running-current-time")
  await expect(protectedDisplay.locator("[data-display-rotation-layer]")).toHaveCount(1)
  await expect(protectedDisplay.locator("[data-forward-projection]")).toHaveCount(1)

  await page.getByRole("button", { name: "Clock", exact: true }).click()
  const clockPanel = page.getByRole("dialog", { name: "Clock controls" })
  for (const label of [
    "Rotation range",
    "Rotation cycle",
    "Glow intensity",
    "Projection length",
    "Glow blur",
  ]) {
    await expect(clockPanel.getByText(label, { exact: true })).toHaveCount(1)
  }
  await expect.poll(async () => {
    const displayBounds = await protectedDisplay.locator("[data-display-content='true']").boundingBox()
    const panelBounds = await clockPanel.boundingBox()
    if (!displayBounds || !panelBounds) return 0
    const displayRight = displayBounds.x + displayBounds.width
    const displayBottom = displayBounds.y + displayBounds.height
    const panelRight = panelBounds.x + panelBounds.width
    const panelBottom = panelBounds.y + panelBounds.height
    return Math.max(
      0,
      panelBounds.x - displayRight,
      displayBounds.x - panelRight,
      panelBounds.y - displayBottom,
      displayBounds.y - panelBottom,
    )
  }).toBeGreaterThanOrEqual(32)

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
  const signedInVisual = page.getByRole("dialog", { name: "Visual controls" })
  const signedInGlobalColors = signedInVisual.getByText("Global Colors", { exact: true }).locator("../..")
  await expect(signedInVisual.getByText(/Sign in to customize and save Global Colors/i)).toHaveCount(0)
  await expect(signedInGlobalColors.getByRole("switch", { name: /^Choose each color:/ })).toBeEnabled()
  await expect(signedInGlobalColors.getByRole("button", { name: "Primary color picker" })).toBeEnabled()
  await expect(signedInGlobalColors.getByRole("textbox", { name: "Palette name" })).toBeEnabled()
  await expect(signedInGlobalColors.getByRole("button", { name: "Save palette" })).toBeEnabled()
  await page.getByRole("button", { name: "Restore account default", exact: true }).click()
  await expect(page.getByTestId("chimer-premium-background")).toBeVisible()
  await page.getByRole("button", { name: "Close Visual panel" }).click()

  await page.getByRole("button", { name: "Background", exact: true }).click()
  await expect(
    page.locator('[data-carousel-slide="true"][data-carousel-item-id="massage-lab-moving-gradient"]'),
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
