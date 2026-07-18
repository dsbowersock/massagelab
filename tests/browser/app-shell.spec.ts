import { expect, test, type Locator, type Page } from "@playwright/test"

const desktopProject = "desktop-chromium"
const mobileProject = "mobile-chromium"

async function gotoShell(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
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
      mainBar: measure("--ml-main-bar-height"),
      pageBottom: measure("--ml-page-bottom-safe"),
      pageEdgeGap: measure("--ml-page-edge-gap"),
      safeBottom: measure("--ml-safe-bottom"),
      scrollEndBuffer: measure("--ml-scroll-end-buffer"),
    }
  })
}

function drawerControl(cluster: Locator) {
  return cluster.locator("button").first()
}

type WideMobileShellCase = {
  appBarPosition: "top" | "bottom"
  drawerEdge: "left" | "right"
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

  const initialState = await sidebarContainer.getAttribute("data-state")
  expect(["collapsed", "expanded"]).toContain(initialState)
  await expectWideMobileSidebarBoundary(page, shellCase.appBarPosition)
  await drawer.click()
  await expect(sidebarContainer).toHaveAttribute(
    "data-state",
    initialState === "collapsed" ? "expanded" : "collapsed",
  )
  await expectWideMobileSidebarBoundary(page, shellCase.appBarPosition)
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
  await gotoShell(page, "/")
  await prepareAccountMenu(page)
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: "dismissed"; platform: string }>
    }
    event.prompt = async () => { document.documentElement.dataset.installPromptCalled = "true" }
    event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" })
    window.dispatchEvent(event)
  })
  await openAccountMenu(page)
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Help & FAQ" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Send Feedback" })).toBeVisible()
  await page.getByRole("menuitem", { name: "Install MassageLab" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt-called", "true")
  await reopenAccountMenu(page, testInfo.project.name)
  await expect(page.getByRole("menuitem", { name: "Install MassageLab" })).toHaveCount(0)
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
  await gotoShell(page, "/")
  await prepareAccountMenu(page)
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: "dismissed"; platform: string }>
    }
    event.prompt = async () => { throw new Error("prompt failed") }
    event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" })
    window.dispatchEvent(event)
  })
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
  await expect(page.getByRole("dialog", { name: "Install MassageLab" })).toContainText("Add to Home Screen")
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

test("narrow mobile keeps every tool and collapses only the wordmark", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Narrow main-bar behavior is covered in mobile Chromium.")
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoShell(page, "/music")

  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const barBox = await bar.boundingBox()
  expect(barBox?.height).toBeCloseTo(52, 0)
  await expect(bar.locator(".ml-app-bar-brand-mark")).toBeVisible()
  await expect(bar.locator(".ml-app-bar-brand-wordmark")).toBeHidden()
  for (const name of ["Open music", "Open clock", "Open quick actions", "Open calendar"]) {
    await expect(bar.getByLabel(name)).toBeVisible()
  }
  await expect(bar.getByRole("group", { name: "Theme" })).toBeVisible()
  await expect(bar.getByRole("link", { name: "Open music" })).toHaveAttribute("aria-current", "page")
})

test("mobile top placement reserves the top edge and leaves the active music player bottom-based", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Mobile stacking is covered in mobile Chromium.")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "top", sidebarPosition: "left", sidebarTriggerPosition: "top", themeMode: "dark",
  })))
  await gotoShell(page, "/music")

  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const barBox = await bar.boundingBox()
  expect(barBox?.y).toBeLessThanOrEqual(1)

  const idleSpacing = await resolvedShellSpacing(page)
  const idleExpected = idleSpacing.bottomStack + idleSpacing.pageEdgeGap + idleSpacing.scrollEndBuffer
  expect(idleSpacing.bottomStack).toBeCloseTo(idleSpacing.safeBottom)
  expect(idleSpacing.pageBottom).toBeCloseTo(idleExpected)
  expect(idleSpacing.pageBottom).not.toBeCloseTo(idleExpected + idleSpacing.mainBar)

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
  expect(activeSpacing.pageBottom).toBeCloseTo(activeExpected)
  expect(activeSpacing.pageBottom).not.toBeCloseTo(activeExpected + activeSpacing.mainBar)
  const playerBox = await player.boundingBox()
  expect((playerBox?.y ?? 0) + (playerBox?.height ?? 0)).toBeGreaterThan(700)
  expect(playerBox?.y ?? 0).toBeGreaterThan((barBox?.y ?? 0) + (barBox?.height ?? 0))
  await page.getByRole("button", { name: "Stop" }).last().click()
})

test("mobile bottom placement adds the main bar when idle and the audio toolbar only while active", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== mobileProject, "Mobile stacking is covered in mobile Chromium.")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom", sidebarPosition: "left", sidebarTriggerPosition: "bottom", themeMode: "dark",
  })))
  await gotoShell(page, "/music")

  const bar = page.getByRole("navigation", { name: "MassageLab main navigation" })
  const barBox = await bar.boundingBox()
  expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeGreaterThanOrEqual(843)

  const idleSpacing = await resolvedShellSpacing(page)
  const idleExpectedStack = idleSpacing.safeBottom + idleSpacing.mainBar
  const idleExpected = idleExpectedStack + idleSpacing.pageEdgeGap + idleSpacing.scrollEndBuffer
  expect(idleSpacing.bottomStack).toBeCloseTo(idleExpectedStack)
  expect(idleSpacing.pageBottom).toBeCloseTo(idleExpected)

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
  expect(activeSpacing.pageBottom).toBeCloseTo(activeExpected)
  expect(activeSpacing.pageBottom - idleSpacing.pageBottom).toBeCloseTo(activeSpacing.audioToolbar)
  const playerBox = await player.boundingBox()
  expect((playerBox?.y ?? 0) + (playerBox?.height ?? 0)).toBeLessThanOrEqual((barBox?.y ?? 0) + 1)
  await page.getByRole("button", { name: "Stop" }).last().click()
})

test("running alerting and preview capture clear computed shell offsets while bars are hidden", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("massage-lab-settings", JSON.stringify({
    appBarPosition: "bottom", sidebarPosition: "left", sidebarTriggerPosition: "bottom", themeMode: "dark",
  })))
  await gotoShell(page, "/wellness")

  for (const bodyClass of ["chimer-running", "chimer-alerting", "chimer-preview-capture"]) {
    await expectImmersiveOffsetsCleared(page, bodyClass)
  }
})
