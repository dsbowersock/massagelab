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
