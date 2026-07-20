import { expect, test, type Locator, type Page, type Response } from "@playwright/test"

const publicRoutes = [
  { path: "/", expectedText: /MassageLab/i },
  { path: "/about", expectedText: /Built from inside the massage profession/i },
  { path: "/about/derrick", expectedText: /Therapist, educator, mentor/i },
  { path: "/help", expectedText: /Help & FAQ/i },
  { path: "/notes", expectedText: /Therapist or Team\/Practice required/i },
  { path: "/notes/soap", expectedText: /Therapist membership required/i },
  { path: "/chimer", expectedText: /Chimer/i },
  { path: "/clock", expectedText: /Clock|AM|PM/i },
  { path: "/browse", expectedText: /Wellness audio stations/i },
  { path: "/wellness", expectedText: /Client-owned self-tracking/i },
  { path: "/music", expectedText: /Treatment room starters/i },
  { path: "/wellness/breathing", expectedText: /Breathing guide/i },
  { path: "/calendar", expectedText: /Calendar/i },
  { path: "/tools", expectedText: /MassageLab Tools/i },
  { path: "/tools/business-planner", expectedText: /Business Planner/i },
  { path: "/tools/business-planner/income", expectedText: /Business Income Planner/i },
  { path: "/tools/business-planner/break-even", expectedText: /Startup Costs and Break-Even/i },
  { path: "/tools/business-planner/launch-checklist", expectedText: /Practice Launch Checklist/i },
  { path: "/tools/business-planner/service-menu", expectedText: /Service Menu and Policies/i },
  { path: "/tools/business-planner/plan-outline", expectedText: /Business Plan Outline/i },
  { path: "/tools/business-planner/add-on-profit", expectedText: /Add-On Profit Calculator/i },
  { path: "/education", expectedText: /Education/i },
  { path: "/education/flashcards", expectedText: /Flashcards/i },
  { path: "/education/flashcards/decks", expectedText: /Community Decks/i },
  { path: "/education/flashcards/decks/starter-all-body-identification", expectedText: /All-body image identification/i },
  { path: "/anatomime", expectedText: /Anatomime/i },
] as const

const forbiddenAnonymousEndpoints = [
  "/api/account/preferences",
  "/api/account/profile",
] as const

function formatResponse(response: Response) {
  const url = new URL(response.url())
  return `${response.status()} ${url.pathname}`
}

function isLocalHttpUrl(urlString: string) {
  const url = new URL(urlString)
  return ["127.0.0.1", "localhost"].includes(url.hostname)
}

function capturePageHealth(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedLocalResponses: string[] = []
  const forbiddenRequests: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })

  page.on("request", (request) => {
    const url = new URL(request.url())
    if (forbiddenAnonymousEndpoints.includes(url.pathname as typeof forbiddenAnonymousEndpoints[number])) {
      forbiddenRequests.push(`${request.method()} ${url.pathname}`)
    }
  })

  page.on("response", (response) => {
    if (response.status() >= 400 && isLocalHttpUrl(response.url())) {
      failedLocalResponses.push(formatResponse(response))
    }
  })

  return {
    consoleErrors,
    failedLocalResponses,
    forbiddenRequests,
    pageErrors,
  }
}

async function setPressedButton(page: Page, name: RegExp, selected: boolean) {
  const button = page.getByRole("button", { name }).first()
  await expect(button).toBeVisible()
  const isPressed = (await button.getAttribute("aria-pressed")) === "true"
  if (isPressed !== selected) await button.click()
}

async function ensureSetupSectionOpen(page: Page, sectionName: RegExp, targetButtonName: RegExp) {
  const targetButton = page.getByRole("button", { name: targetButtonName }).first()
  if (await targetButton.isVisible().catch(() => false)) return

  const sectionButton = page.getByRole("button", { name: sectionName }).first()
  if (await sectionButton.count() > 0) {
    await expect(sectionButton).toBeVisible()
    const isExpanded = (await sectionButton.getAttribute("aria-expanded")) === "true"
    if (!isExpanded) await sectionButton.click()
  }

  await expect(targetButton).toBeVisible()
}

async function setMuscleUpperExtremityFilters(page: Page) {
  await ensureSetupSectionOpen(page, /^Category\b/i, /^Muscles\b/i)
  await setPressedButton(page, /^Muscles\b/i, true)
  for (const category of [/^Bones\b/i, /^Bone Landmarks\b/i, /^Structures\b/i, /^Concepts\b/i]) {
    await setPressedButton(page, category, false)
  }

  await ensureSetupSectionOpen(page, /^Region\b/i, /^Upper Extremity\b/i)
  await setPressedButton(page, /^Upper Extremity\b/i, true)
  for (const region of [/^Head\b/i, /^Spine\b/i, /^Thorax\b/i, /^Abdomen\b/i, /^Pelvis\b/i, /^Lower Extremity\b/i]) {
    await setPressedButton(page, region, false)
  }
}

async function waitForFilteredEligibleCount(page: Page) {
  await expect(page.getByRole("button", { name: /Start [1-9]\d*/ })).toBeEnabled({ timeout: 30_000 })
}

/**
 * Opens the bottom-bar quick-action dial and verifies it is visually anchored above the + trigger
 * with the expected blurred backdrop.
 */
async function openQuickActionsAboveTrigger(page: Page, quickCreate: Locator) {
  const triggerBox = await quickCreate.boundingBox()
  expect(triggerBox, "quick-create trigger box").not.toBeNull()

  await quickCreate.click()

  const quickActions = page.getByRole("navigation", { name: /^Quick create actions$/i })
  await expect(quickActions).toBeVisible()
  const quickActionsBox = await page.getByRole("dialog", { name: /^Quick actions$/i }).boundingBox()
  expect(quickActionsBox, "quick-action menu box").not.toBeNull()

  if (triggerBox && quickActionsBox) {
    expect(quickActionsBox.y + quickActionsBox.height).toBeLessThanOrEqual(triggerBox.y - 8)
  }

  const backdropFilter = await page.locator(".ml-quick-action-layer").evaluate((element) => {
    const styles = window.getComputedStyle(element)
    return styles.getPropertyValue("backdrop-filter") || styles.getPropertyValue("-webkit-backdrop-filter")
  })
  expect(backdropFilter).toContain("blur")

  return quickActions
}

for (const route of publicRoutes) {
  test(`anonymous public route ${route.path} renders without browser regressions`, async ({ page }) => {
    const health = capturePageHealth(page)

    await page.goto(route.path, { waitUntil: "domcontentloaded" })
    await expect(page.locator("body")).toContainText(route.expectedText)
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
    await page.waitForTimeout(250)

    expect(health.pageErrors, "uncaught page errors").toEqual([])
    expect(health.consoleErrors, "browser console errors").toEqual([])
    expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
    expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
  })
}

test("core public tool surfaces keep shell spacing and visible primary content", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ["/", "/tools", "/education", "/notes", "/music", "/wellness"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("navigation", { name: /^MassageLab main navigation$/i })).toBeVisible()
    await expect(page.locator(".ml-app-content")).toBeVisible()
    const contentBox = await page.locator(".ml-app-content").boundingBox()
    expect(contentBox?.height ?? 0).toBeGreaterThan(240)
  }

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("main bar exposes brand music clock quick create theme calendar and more controls", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem(
      "massage-lab-settings",
      JSON.stringify({
        appBarPosition: "bottom",
        sidebarPosition: "left",
        sidebarTriggerPosition: "bottom",
        themeMode: "dark",
      }),
    )
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("navigation", { name: /^MassageLab main navigation$/i })).toBeVisible()
  await expect(page.getByRole("link", { name: "MassageLab home" })).toHaveAttribute("href", "/")
  await expect(page.getByRole("link", { name: /^Open music$/i })).toHaveAttribute("href", "/music")
  await expect(page.getByRole("link", { name: /^Open clock$/i })).toHaveAttribute("href", "/clock")
  const quickCreate = page.getByRole("button", { name: /^Open quick actions$/i })
  await expect(quickCreate).toBeVisible()
  const quickCreateBox = await quickCreate.boundingBox()
  expect(quickCreateBox?.width ?? 0).toBeGreaterThanOrEqual(42)
  expect(quickCreateBox?.width ?? 0).toBeLessThanOrEqual(43)
  expect(quickCreateBox?.height ?? 0).toBeGreaterThanOrEqual(42)
  expect(quickCreateBox?.height ?? 0).toBeLessThanOrEqual(43)
  const quickCreateStyle = await quickCreate.evaluate((element) => {
    const styles = window.getComputedStyle(element)
    return {
      backgroundImage: styles.backgroundImage,
      boxShadow: styles.boxShadow,
    }
  })
  expect(quickCreateStyle.backgroundImage).toContain("gradient")
  expect(quickCreateStyle.boxShadow).not.toBe("none")
  await expect(page.getByRole("group", { name: /^Theme$/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /^Open calendar$/i })).toHaveAttribute("href", "/calendar")
  await expect(page.getByRole("button", { name: /^Open navigation$/i })).toBeVisible()

  const mainBar = page.getByRole("navigation", { name: /^MassageLab main navigation$/i })
  await expect(mainBar.locator(".ml-main-bar-drawer-brand .ml-main-bar-button")).toHaveAccessibleName("Open navigation")
  await expect(mainBar.locator(".ml-main-bar-tools").getByRole("group", { name: /^Theme$/i })).toBeVisible()

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("main bar edge control stays aligned with the compact sidebar rail", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.setViewportSize({ width: 686, height: 682 })
  await page.addInitScript(() => {
    localStorage.setItem(
      "massage-lab-settings",
      JSON.stringify({
        appBarPosition: "bottom",
        sidebarPosition: "left",
        sidebarTriggerPosition: "bottom",
        themeMode: "dark",
      }),
    )
  })
  await page.goto("/", { waitUntil: "domcontentloaded" })

  const openNavigation = page.getByRole("button", { name: /^Open navigation$/i })
  await expect(openNavigation).toBeVisible()
  const [openNavigationBox, sidebarFrameBox] = await Promise.all([
    openNavigation.boundingBox(),
    page.locator(".ml-app-sidebar-frame").boundingBox(),
  ])
  expect(openNavigationBox, "main-bar drawer control box").not.toBeNull()
  expect(sidebarFrameBox, "compact sidebar rail box").not.toBeNull()
  const drawerCenter = (openNavigationBox?.x ?? 0) + ((openNavigationBox?.width ?? 0) / 2)
  const railCenter = (sidebarFrameBox?.x ?? 0) + ((sidebarFrameBox?.width ?? 0) / 2)
  expect(Math.abs(drawerCenter - railCenter)).toBeLessThanOrEqual(1)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("top app bar quick actions open inside the viewport below the plus button", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Top app bar placement is covered by the desktop shell.")

  const health = capturePageHealth(page)

  await page.setViewportSize({ width: 1024, height: 720 })
  await page.addInitScript(() => {
    localStorage.setItem(
      "massage-lab-settings",
      JSON.stringify({
        appBarPosition: "top",
        sidebarPosition: "left",
        sidebarTriggerPosition: "top",
        themeMode: "dark",
      }),
    )
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.locator(".ml-app-shell")).toHaveAttribute("data-app-bar-position", "top")

  const quickCreate = page.getByRole("button", { name: /^Open quick actions$/i })
  await expect(quickCreate).toBeVisible()
  const triggerBox = await quickCreate.boundingBox()
  expect(triggerBox, "top-bar quick-create trigger box").not.toBeNull()

  await quickCreate.click()

  const quickActions = page.getByRole("navigation", { name: /^Quick create actions$/i })
  await expect(quickActions).toBeVisible()
  const quickActionsBox = await page.getByRole("dialog", { name: /^Quick actions$/i }).boundingBox()
  expect(quickActionsBox, "top-bar quick-action menu box").not.toBeNull()

  if (triggerBox && quickActionsBox) {
    expect(quickActionsBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height + 8)
    expect(quickActionsBox.y + quickActionsBox.height).toBeLessThanOrEqual(720)
  }

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("mobile quick-create button opens a vertical speed dial", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  const quickCreate = page.getByRole("button", { name: /^Open quick actions$/i })
  await expect(quickCreate).toBeVisible()

  const quickActions = await openQuickActionsAboveTrigger(page, quickCreate)
  await expect(quickActions.getByRole("link", { name: /^Log In$/i })).toHaveAttribute("href", "/login")
  await expect(quickActions.getByRole("link", { name: /^Create Account$/i })).toHaveAttribute("href", "/register")
  await expect(quickActions.getByRole("link", { name: /^Quick Log$/i })).toHaveAttribute("href", "/wellness#quick-log")
  await expect(quickActions.getByRole("link", { name: /^Breathing Guide$/i })).toHaveAttribute("href", "/wellness/breathing")

  const quickActionsBox = await page.getByRole("dialog", { name: /^Quick actions$/i }).boundingBox()
  expect(quickActionsBox, "quick-action menu box before outside dismissal").not.toBeNull()
  if (quickActionsBox) {
    await page.mouse.click(4, 4)
  }
  await expect(quickActions).toHaveCount(0)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("Chimer keeps the mobile main bar and opens quick actions above the plus button", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/chimer", { waitUntil: "domcontentloaded" })

  const mainBar = page.getByRole("navigation", { name: /^MassageLab main navigation$/i })
  await expect(mainBar).toBeVisible()
  await expect(page.locator(".ml-app-shell")).toHaveAttribute("data-main-bar-visible", "true")
  await expect(page.getByTestId("app-moving-background")).toHaveCount(0)

  const quickCreate = page.getByRole("button", { name: /^Open quick actions$/i })
  await expect(quickCreate).toBeVisible()
  await openQuickActionsAboveTrigger(page, quickCreate)

  await page.keyboard.press("Escape")
  await expect(mainBar).toBeVisible()

  await page.getByRole("button", { name: /^Clock Mode$/i }).click()
  await expect(page.locator("body")).toHaveClass(/chimer-running/)
  await expect(mainBar).toBeHidden()
  await page.getByRole("button", { name: /^Close clock$/i }).click()
  await expect(page.locator("body")).not.toHaveClass(/chimer-running/)
  await expect(mainBar).toBeVisible()

  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  await page.getByRole("button", { name: /^Continue$/i }).click()
  await page.getByRole("button", { name: /^Continue$/i }).click()
  await page.getByRole("button", { name: /^Continue$/i }).click()
  await page.getByRole("button", { name: /^Continue$/i }).click()
  await page.getByRole("button", { name: /^Start Chimer$/i }).click()
  await expect(page.locator("body")).toHaveClass(/chimer-running/)
  await expect(mainBar).toBeHidden()
  await page.getByRole("button", { name: /^End timer$/i }).click()
  await expect(page.locator("body")).not.toHaveClass(/chimer-running/)
  await expect(mainBar).toBeVisible()

  await page.goto("/clock", { waitUntil: "domcontentloaded" })
  await expect(page.locator("body")).toHaveClass(/chimer-running/)
  await expect(page.getByRole("navigation", { name: /^MassageLab main navigation$/i })).toHaveCount(0)
  await page.getByRole("button", { name: /^Close clock$/i }).click()
  await expect(page.locator("body")).not.toHaveClass(/chimer-running/)
  const clockSetupMainBar = page.getByRole("navigation", { name: /^MassageLab main navigation$/i })
  await expect(clockSetupMainBar).toBeVisible()
  await expect(page.locator(".ml-app-shell")).toHaveAttribute("data-main-bar-visible", "true")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("mobile primary bar keeps lighting controls available with a compact theme toggle", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.setViewportSize({ width: 319, height: 932 })
  await page.goto("/music", { waitUntil: "domcontentloaded" })

  const narrowThemePicker = page.getByRole("group", { name: /^Theme$/i })
  const narrowThemeToggle = narrowThemePicker.getByRole("button", { name: /^Use (light|dark) theme$/i })

  await expect(narrowThemePicker).toBeVisible()
  await expect(narrowThemeToggle).toBeVisible()
  await expect(narrowThemePicker.getByRole("radio")).toHaveCount(0)
  await expect(page.getByRole("link", { name: /^Open music$/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /^Open clock$/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /^Open calendar$/i })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 932 })

  const themePicker = page.getByRole("group", { name: /^Theme$/i })
  const themeToggle = themePicker.getByRole("button", { name: /^Use (light|dark) theme$/i })

  await expect(themePicker).toBeVisible()
  await expect(themeToggle).toBeVisible()
  const initialThemeLabel = await themeToggle.getAttribute("aria-label")
  expect(initialThemeLabel).toMatch(/^Use (light|dark) theme$/)
  await themeToggle.click()
  await expect(themeToggle).toHaveAttribute(
    "aria-label",
    initialThemeLabel === "Use light theme" ? "Use dark theme" : "Use light theme",
  )

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("anonymous homepage presents landing copy and tool discovery rails", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/", { waitUntil: "domcontentloaded" })

  await expect(page.getByTestId("home-brand-wordmark")).toBeVisible()
  await expect(page.getByRole("heading", { name: /MassageLab helps/i })).toBeVisible()
  await expect(page.getByTestId("home-flip-word")).toBeVisible()
  await expect(page.getByRole("link", { name: /^Create a free account$/i }).first()).toHaveAttribute("href", "/register")
  await expect(page.getByRole("link", { name: /^Explore tools$/i }).first()).toHaveAttribute("href", "#available-tools")

  await expect(page.getByRole("heading", { name: "What are you here for today?" })).toBeVisible()
  await expect(page.getByRole("link", { name: /Study anatomy/i })).toHaveAttribute("href", "/education/flashcards")
  await expect(page.getByRole("link", { name: /Teach or play/i })).toHaveAttribute("href", "/anatomime")
  await expect(page.getByRole("link", { name: /Run a session/i })).toHaveAttribute("href", "/chimer")
  await expect(page.getByRole("link", { name: /Organize a practice/i })).toHaveAttribute("href", "/register?callbackUrl=%2Fcalendar")
  await expect(page.getByRole("link", { name: /Document locally/i })).toHaveAttribute("href", "/notes")
  await expect(page.getByRole("link", { name: /Just exploring/i })).toHaveAttribute("href", "#available-tools")

  await expect(page.getByRole("region", { name: /^Practice tools$/i })).toBeVisible()
  await expect(page.getByRole("region", { name: /^Study tools$/i })).toBeVisible()
  await expect(page.getByRole("region", { name: /^Wellness tools$/i })).toBeVisible()
  await expect(page.getByRole("region", { name: /^Music and focus$/i })).toBeVisible()
  await expect(page.getByRole("region", { name: /^Business tools$/i })).toBeVisible()

  await expect(page.getByRole("heading", { name: "Available tools" })).toBeVisible()
  for (const name of [
    "Chimer",
    "Business income planner",
    "Music",
    "Education flashcards",
    "Anatomime",
    "Local-first notes",
    "Calendar and booking",
    "Account and memberships",
    "Roadmap and support",
  ]) {
    await expect(page.getByText(name).first()).toBeVisible()
  }

  const availableTools = page.locator("#available-tools")
  await expect(availableTools.getByRole("link", { name: /Open Chimer/i })).toHaveAttribute("href", "/chimer")
  await expect(availableTools.getByRole("link", { name: /Open planner/i })).toHaveAttribute("href", "/tools/business-planner/income")
  await expect(availableTools.getByRole("link", { name: /Open Music/i })).toHaveAttribute("href", "/music")
  await expect(availableTools.getByRole("link", { name: /Study flashcards/i })).toHaveAttribute("href", "/education/flashcards")
  await expect(availableTools.getByRole("link", { name: /Play Anatomime/i })).toHaveAttribute("href", "/anatomime")
  await expect(availableTools.getByRole("link", { name: /Open notes/i })).toHaveAttribute("href", "/notes")
  await expect(availableTools.getByRole("link", { name: /Open calendar/i })).toHaveAttribute("href", "/calendar")
  await expect(availableTools.getByRole("link", { name: /^Create account$/i })).toHaveAttribute("href", "/register")
  await expect(availableTools.getByRole("link", { name: /Open roadmap/i })).toHaveAttribute("href", "/roadmap")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("Roadmap presents an unordered product portfolio", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/roadmap", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { level: 1, name: "Where MassageLab is going" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Shared foundation" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Product portfolio" })).toBeVisible()

  const viewportWidth = page.viewportSize()?.width ?? 0
  const portfolioBox = await page.locator("[aria-labelledby='product-portfolio-heading']").boundingBox()
  expect((portfolioBox?.x ?? 0) + (portfolioBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 1)

  for (const name of [
    "Education & Anatomy",
    "Wellness Tools",
    "Therapist & Practice Tools",
    "Local-First Records",
    "Audio & Ambient Experiences",
  ]) {
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible()
  }

  await expect(page.getByText("Available now", { exact: true })).toHaveCount(5)
  await expect(page.getByText("Long-term direction", { exact: true })).toHaveCount(5)
  await expect(page.getByText(/not a release order/i)).toBeVisible()
  await expect(page.getByRole("link", { name: "Explore tools" }).first()).toHaveAttribute("href", "/tools")
  await expect(page.getByRole("link", { name: "View memberships" }).first()).toHaveAttribute("href", "/pricing")
  await expect(page.getByRole("link", { name: "Donate" }).first()).toHaveAttribute("href", "/pricing#donate")
  await expect(page.getByRole("heading", { name: "Recently shipped" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Current alpha focus" })).toHaveCount(0)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("Atmosphere visualizer action retains selected station across client routes", async ({ page }) => {
  const health = capturePageHealth(page)
  const origin = "/music?task8=public-route"

  await page.goto(origin, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: /Atmosphere audio stations/i, includeHidden: true })).toBeAttached()
  await expect(page.getByRole("heading", { name: /Treatment room starters/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Breathing guide" })).toHaveCount(0)
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()

  const playerToolbar = page.getByTestId("music-player-toolbar")
  await expect(playerToolbar).toBeVisible()
  await expect(playerToolbar).toHaveAttribute("data-placement", "bottom")
  const playerToolbarBox = await playerToolbar.boundingBox()
  expect(playerToolbarBox?.width ?? 0).toBeGreaterThan(320)

  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(page.getByText(/Playing|Preparing audio|Preparing station/i).last()).toBeVisible()
  await expect(page.getByRole("button", { name: /^Previous station$/i }).last()).toBeVisible()
  await expect(page.getByRole("button", { name: /^Next station$/i }).last()).toBeVisible()
  await expect(page.getByRole("button", { name: /^Background$/i }).last()).toBeVisible()
  await page.getByRole("button", { name: /^Background$/i }).last().click()
  await expect(page).toHaveURL(/\/clock\?[^#]*source=music/)
  const backgroundDialog = page.getByRole("dialog", { name: "Background" })
  await expect(backgroundDialog).toBeVisible()
  await backgroundDialog.getByRole("button", { name: "Preview Static gradient background" }).click()
  await backgroundDialog.getByRole("button", { name: "Select Static gradient background" }).click()
  await expect(backgroundDialog).toHaveCount(0)
  await page.getByRole("button", { name: /^Minimize visualizer$/i }).last().click()
  await expect(page).toHaveURL(/\/music\?task8=public-route$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/music\?task8=public-route$/)
  await expect(page.getByRole("button", { name: /^Background$/i }).last()).toBeVisible()
  const collapseButton = page.getByRole("button", { name: /^Collapse$/i }).last()
  const canCollapsePlayer = (page.viewportSize()?.width ?? 0) >= 640
  if (canCollapsePlayer) {
    await collapseButton.click()
    await expect(page.getByRole("button", { name: /^Background$/i }).last()).toBeVisible()
  } else {
    await expect(collapseButton).toHaveCount(0)
  }
  await page.getByRole("button", { name: /^Stop$/i }).last().click()
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(page.getByRole("button", { name: /^Background$/i }).last()).toBeVisible()
  if (canCollapsePlayer) {
    await page.getByRole("button", { name: /^Expand$/i }).last().click()
  }
  await expect(page.getByText("Stopped").last()).toBeVisible()
  await expect(page.getByRole("button", { name: /^Background$/i }).last()).toBeVisible()

  const flashcardsLink = page.getByRole("link", { name: /^Flashcards$/i }).first()
  if (!await flashcardsLink.isVisible().catch(() => false)) {
    const openNavigation = page.getByRole("button", { name: /Open navigation|Expand navigation/i }).first()
    if (await openNavigation.isVisible().catch(() => false)) {
      await openNavigation.click()
    }
  }

  const educationTrigger = page.getByRole("button", { name: /^Education$/i }).first()
  if (await educationTrigger.isVisible().catch(() => false)) {
    const isExpanded = (await educationTrigger.getAttribute("aria-expanded")) === "true"
    if (!isExpanded) await educationTrigger.click()
  }
  await expect(flashcardsLink).toBeVisible()
  await flashcardsLink.click()
  await expect(page).toHaveURL(/\/education\/flashcards/)
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(page.getByRole("button", { name: /^Background$/i }).last()).toBeVisible()

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("Atmosphere registers mobile media notification controls for active stations", async ({ page }) => {
  const health = capturePageHealth(page)

  // Install a deterministic Media Session shim before app code runs so this
  // test can assert notification metadata and action-handler registration.
  await page.addInitScript(() => {
    const handlers: Record<string, (() => void) | null> = {}
    const mediaSession = {
      handlers,
      metadata: null as Record<string, unknown> | null,
      playbackState: "none",
      setActionHandler(action: string, handler: (() => void) | null) {
        handlers[action] = handler
      },
    }

    class MockMediaMetadata {
      title = ""
      artist = ""
      album = ""
      artwork: Array<Record<string, string>> = []

      constructor(init: Record<string, unknown>) {
        Object.assign(this, init)
      }
    }

    // The app reads navigator.mediaSession, so the shim must live on the
    // Navigator prototype before React code initializes.
    Object.defineProperty(Navigator.prototype, "mediaSession", {
      configurable: true,
      get: () => mediaSession,
    })
    // The app constructs MediaMetadata when updating notification controls.
    Object.defineProperty(window, "MediaMetadata", {
      configurable: true,
      value: MockMediaMetadata,
    })
    // Expose shim state for page.evaluate polling assertions in this test.
    Reflect.set(window, "__massagelabMediaSession", mediaSession)
  })

  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()

  await expect
    .poll(async () => page.evaluate(() => {
      const mediaSession = Reflect.get(window, "__massagelabMediaSession") as {
        handlers: Record<string, (() => void) | null>
        metadata: { title?: string; artist?: string; album?: string; artwork?: Array<Record<string, string>> } | null
        playbackState: string
      }
      return {
        actions: Object.entries(mediaSession.handlers)
          .filter(([, handler]) => typeof handler === "function")
          .map(([action]) => action)
          .sort(),
        album: mediaSession.metadata?.album,
        artist: mediaSession.metadata?.artist,
        artworkCount: mediaSession.metadata?.artwork?.length ?? 0,
        playbackState: mediaSession.playbackState,
        title: mediaSession.metadata?.title,
      }
    }))
    .toEqual({
      actions: ["nexttrack", "pause", "play", "previoustrack", "stop"],
      album: "MassageLab Atmosphere",
      artist: "MassageLab",
      artworkCount: 2,
      playbackState: "playing",
      title: "MassageLab Proof Drone",
    })

  await page.evaluate(() => {
    const mediaSession = Reflect.get(window, "__massagelabMediaSession") as {
      handlers: Record<string, (() => void) | null>
    }
    mediaSession.handlers.pause?.()
  })
  await expect(page.getByText(/Playing|Preparing audio|Preparing station/i)).toHaveCount(0)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("immersive context changes keep only the displays owned by Chimer, Clock, and hidden Music", async ({ page }) => {
  await page.goto("/chimer", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: /^Continue$/i }).click()
  }
  await page.getByRole("button", { name: /^Start Chimer$/i }).click()

  await expect(page.getByTestId("running-timer-clock")).toBeVisible()
  await expect(page.getByTestId("running-current-time")).toBeVisible()

  await page.evaluate(() => {
    window.history.pushState({}, "", "/clock?source=music&returnTo=%2Fmusic")
  })
  await expect(page.getByLabel("Music visualizer")).toBeVisible()
  await expect(page.getByTestId("running-timer-clock")).toHaveCount(0)
  await expect(page.getByTestId("running-current-time")).toHaveCount(0)

  await page.getByRole("button", { name: "Close Background panel" }).click()
  await page.getByRole("button", { name: "Clock", exact: true }).click()
  await expect(page.getByRole("status")).toContainText(
    "Clock is hidden. The selected background continues without a time display.",
  )

  await page.evaluate(() => {
    window.history.pushState({}, "", "/clock")
  })
  await expect(page).toHaveURL(/\/clock$/)
  await expect(page.getByTestId("running-timer-clock")).toHaveCount(0)
  await expect(page.getByTestId("running-current-time")).toBeVisible()
})

test("Music visualizer waits for preference hydration before mounting its saved background", async ({ page }) => {
  let releaseSession!: () => void
  const sessionGate = new Promise<void>((resolve) => {
    releaseSession = resolve
  })

  await page.addInitScript(() => {
    localStorage.setItem("massagelab-atmosphere-v2", JSON.stringify({
      version: 2,
      favorites: ["tone-proof-drone"],
      recentStations: ["tone-proof-drone"],
      volume: 0.4,
      miniPlayerCollapsed: false,
      visualizer: {
        backgroundId: "static-gradient",
        showClock: false,
      },
      migrations: {
        legacyMusicBackground: true,
      },
    }))

    const mounts: string[] = []
    ;(window as typeof window & { __musicVisualizerBackgroundMounts?: string[] })
      .__musicVisualizerBackgroundMounts = mounts
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          const candidates = node.matches('[data-testid="chimer-premium-background"]')
            ? [node]
            : Array.from(node.querySelectorAll('[data-testid="chimer-premium-background"]'))
          for (const candidate of candidates) {
            mounts.push(candidate.getAttribute("data-background-id") ?? "missing")
          }
        }
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await page.route("**/api/auth/session", async (route) => {
    await sessionGate
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    })
  })

  await page.goto("/clock?source=music&returnTo=%2Fmusic", { waitUntil: "domcontentloaded" })
  await expect(page.getByLabel("Music visualizer")).toBeVisible()
  await expect(page.getByTestId("chimer-premium-background")).toHaveCount(0)
  expect(await page.evaluate(() => (
    (window as typeof window & { __musicVisualizerBackgroundMounts?: string[] })
      .__musicVisualizerBackgroundMounts ?? []
  ))).toEqual([])

  releaseSession()

  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    "static-gradient",
  )
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __musicVisualizerBackgroundMounts?: string[] })
      .__musicVisualizerBackgroundMounts ?? []
  ))).toEqual(["static-gradient"])
})

test("Music background selection and account default actions preserve playback and device state", async ({ page }) => {
  const preferenceWrites: Array<Record<string, unknown>> = []
  const accountVisualizer = {
    defaultBackgroundId: null,
    showClock: false,
  }

  await page.addInitScript(() => {
    localStorage.setItem("massagelab-atmosphere-v2", JSON.stringify({
      version: 2,
      favorites: ["tone-proof-drone"],
      recentStations: [],
      volume: 0.4,
      miniPlayerCollapsed: false,
      visualizer: {
        backgroundId: null,
        showClock: false,
      },
      migrations: {
        legacyMusicBackground: true,
      },
    }))
  })
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "music-qa-user", email: "music-qa@example.com" } }),
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
          appSettings: { musicVisualizer: accountVisualizer },
        }),
      })
      return
    }

    const payload = route.request().postDataJSON() as Record<string, unknown>
    preferenceWrites.push(payload)
    const appSettings = payload.appSettings as { musicVisualizer?: typeof accountVisualizer } | undefined
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: [],
        chimerSettings: payload.chimerSettings ?? {},
        appSettings: {
          musicVisualizer: appSettings?.musicVisualizer ?? accountVisualizer,
        },
      }),
    })
  })

  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const playerToolbar = page.getByTestId("music-player-toolbar")
  await expect(playerToolbar).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await page.getByRole("button", { name: /^Background$/i }).last().click()
  await expect(page).toHaveURL(/\/clock\?[^#]*source=music/)

  const deviceStateBeforeSelection = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("massagelab-atmosphere-v2") ?? "{}")
    const deviceState = { ...stored }
    delete deviceState.visualizer
    return deviceState
  })

  await page.getByRole("button", { name: "Preview Static gradient background" }).click()
  await page.getByRole("button", { name: "Select Static gradient background" }).click()
  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    "static-gradient",
  )
  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()

  await page.getByRole("button", { name: "Visual", exact: true }).click()
  await page.getByRole("button", { name: "Set as visualizer default", exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click())
  await expect.poll(() => preferenceWrites.some((payload) => {
    const appSettings = payload.appSettings as {
      musicVisualizer?: { defaultBackgroundId?: string | null }
    } | undefined
    return appSettings?.musicVisualizer?.defaultBackgroundId === "static-gradient"
  })).toBe(true)

  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(playerToolbar).toContainText(/Playing|Preparing audio|Preparing station/i)
  expect(await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("massagelab-atmosphere-v2") ?? "{}")
    const deviceState = { ...stored }
    delete deviceState.visualizer
    return deviceState
  })).toEqual(deviceStateBeforeSelection)
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem("massagelab-atmosphere-v2") ?? "{}")
      .visualizer?.backgroundId
  ))).toBe("static-gradient")
})

test("Breathing guide route runs separately from Music stations", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/wellness/breathing", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: /^Breathing guide$/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Music stations/i })).toHaveAttribute("href", "/music")
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  const startBreathingButton = page.getByRole("button", { name: /^Start breathing$/i })
  await expect(startBreathingButton).toBeEnabled()
  await startBreathingButton.click()
  await expect(page.getByRole("button", { name: /^Pause breathing$/i })).toBeVisible()
  await page.getByRole("button", { name: /^Reset breathing$/i }).click()
  await expect(page.getByRole("button", { name: /^Start breathing$/i })).toBeVisible()

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("Atmosphere lists the Generative.fm catalog and starts a hosted-sample station", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.addInitScript(() => {
    window.addEventListener("massagelab:atmosphere-startup-timing", (event) => {
      const existing = Reflect.get(window, "__massagelabAtmosphereTimings")
      const timings = Array.isArray(existing) ? existing : []
      Reflect.set(window, "__massagelabAtmosphereTimings", [
        ...timings,
        event instanceof CustomEvent ? event.detail : null,
      ])
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const treatmentRoomStartersRail = page.getByTestId("station-rail-treatment-room-starters")
  const treatmentRoomStartersRailControls = page.getByTestId("station-rail-controls-treatment-room-starters")
  const treatmentRoomStartersScroller = treatmentRoomStartersRail.locator('[aria-label="Treatment room starters stations"]')
  await expect(treatmentRoomStartersRail).toBeVisible()
  await expect(treatmentRoomStartersRailControls).toHaveCSS("opacity", "0")
  const supportsHoverRailControls = await page.evaluate(() => (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  ))
  if (supportsHoverRailControls) {
    await treatmentRoomStartersRail.hover()
    await expect(treatmentRoomStartersRailControls).toHaveCSS("opacity", "1")
    const treatmentRoomStartersScrollLeft = await treatmentRoomStartersScroller.evaluate((element) => element.scrollLeft)
    await treatmentRoomStartersRail.getByRole("button", { name: /^Next Treatment room starters stations$/i }).click()
    await expect
      .poll(async () => treatmentRoomStartersScroller.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(treatmentRoomStartersScrollLeft + 40)
  }
  await expect(page.getByRole("heading", { name: /Treatment room starters/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Water, nature, and field textures/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Rhythm and experimental texture/i })).toBeVisible()
  const observableStreamsStation = page.locator("#station-observable-streams-probe")
  await expect(observableStreamsStation.getByText("Observable Streams", { exact: true })).toBeVisible()
  await expect(observableStreamsStation.getByRole("img", { name: /Observable Streams station artwork/i })).toBeVisible()
  await expect(observableStreamsStation.getByText(/Piano, violin, and oboe-like tones/i)).toBeVisible()
  await expect(observableStreamsStation.getByRole("link", { name: "Alex Bainter · MIT" })).toBeVisible()
  const representativeHostedGenerativeFmStations = [
    page.locator("#station-generative-fm-420hz-gamma-waves-for-big-brain"),
    page.locator("#station-generative-fm-above-the-rain"),
    page.locator("#station-generative-fm-aisatsana"),
    page.locator("#station-generative-fm-at-sunrise"),
    page.locator("#station-generative-fm-buttafingers"),
    page.locator("#station-generative-fm-day-dream"),
    page.locator("#station-generative-fm-eno-machine"),
    page.locator("#station-generative-fm-impact"),
    page.locator("#station-generative-fm-lemniscate"),
    page.locator("#station-generative-fm-little-bells"),
    page.locator("#station-generative-fm-no-refrain"),
    page.locator("#station-generative-fm-pinwheels"),
    page.locator("#station-generative-fm-ritual"),
    page.locator("#station-generative-fm-sevenths"),
    page.locator("#station-generative-fm-splash"),
    page.locator("#station-generative-fm-transmission"),
    page.locator("#station-generative-fm-trees"),
    page.locator("#station-generative-fm-uun"),
    page.locator("#station-generative-fm-yesterday"),
    page.locator("#station-generative-fm-zed"),
  ]
  for (const station of representativeHostedGenerativeFmStations) {
    await expect(station).toBeVisible()
  }
  await expect(page.getByText("aisatsana (generative remix)").first()).toBeVisible()
  await expect(page.getByText("Zed").first()).toBeVisible()
  await expect(page.locator("#station-generative-fm-little-bells").getByText(/long quiet gaps/i)).toBeVisible()
  await expect(page.locator("#station-generative-fm-awash").getByText(/voice-like edges/i)).toBeVisible()
  await expect(page.locator("#station-generative-fm-neuroplasticity").getByText(/voice-like artifacts/i)).toBeVisible()
  await expect(page.getByText("Playable")).toHaveCount(0)
  await expect(page.getByText("Samples pending")).toHaveCount(0)
  await expect(page.getByText("This station is still being prepared for playback.")).toHaveCount(0)
  await expect(page.getByText(/hosted CC0|sample index|public-media/i)).toHaveCount(0)

  await observableStreamsStation.getByRole("button", { name: /^Play Observable Streams$/i }).click()
  await expect(observableStreamsStation.getByText(/Preparing station/i)).toBeVisible()
  await expect(observableStreamsStation.getByRole("button", { name: /^Restart Observable Streams$/i })).toBeVisible({ timeout: 45_000 })
  await expect(observableStreamsStation.getByRole("button", { name: /^Stop Observable Streams$/i })).toBeVisible({ timeout: 45_000 })
  const expectedSampleFormat = await page.evaluate(() => {
    const audio = document.createElement("audio")
    if (audio.canPlayType('audio/ogg; codecs="opus"') !== "") return "opus"
    if (audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "") return "aac"
    if (audio.canPlayType("audio/mpeg") !== "") return "mp3"
    return "wav"
  })
  await expect
    .poll(async () => page.evaluate((expectedFormat) => {
      const startupTimings = Reflect.get(window, "__massagelabAtmosphereTimings")
      return Array.isArray(startupTimings) && startupTimings.some((startupTiming: unknown) => {
        if (!startupTiming || typeof startupTiming !== "object") {
          return false
        }

        const detail = startupTiming as Record<string, unknown>
        return detail.pieceId === "observable-streams"
          && detail.stationId === "observable-streams-probe"
          && detail.sampleFormat === expectedFormat
          && typeof detail.usedPrewarm === "boolean"
          && typeof detail.usedSamplePayloadPrewarm === "boolean"
          && typeof detail.samplePayloadPrewarmCount === "number"
          && typeof detail.sampleRequestBatchCount === "number"
          && typeof detail.sampleRequestMaxBatchSize === "number"
          && typeof detail.sampleRequestUniqueUrlCount === "number"
          && typeof detail.sampleRequestUrlCount === "number"
      })
    }, expectedSampleFormat), { timeout: 45_000 })
    .toBe(true)
  await observableStreamsStation.getByRole("button", { name: /^Stop Observable Streams$/i }).click()
  await expect(page.getByText(/Playing|Preparing audio|Preparing station/i)).toHaveCount(0)

  const smokePlaybackStations = [
    page.locator("#station-generative-fm-420hz-gamma-waves-for-big-brain"),
    page.locator("#station-generative-fm-aisatsana"),
    page.locator("#station-generative-fm-at-sunrise"),
    page.locator("#station-generative-fm-day-dream"),
    page.locator("#station-generative-fm-little-bells"),
    page.locator("#station-generative-fm-no-refrain"),
  ]
  for (const station of smokePlaybackStations) {
    await station.getByRole("button", { name: /^Play\b/i }).click()
    await expect(station.getByRole("button", { name: /^Restart\b/i })).toBeVisible({ timeout: 45_000 })
    await station.getByRole("button", { name: /^Stop\b/i }).click()
    await expect(page.getByText(/Playing|Preparing audio|Preparing station/i)).toHaveCount(0)
  }

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("anonymous onboarding routes through login with an onboarding callback", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/onboarding", { waitUntil: "domcontentloaded" })

  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fonboarding/)
  await expect(page.getByRole("button", { name: /Sign in with email/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Create an account/i })).toHaveAttribute("href", "/register?callbackUrl=%2Fonboarding")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("anonymous registration legal gate routes through login before acceptance", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/legal/accept?callbackUrl=%2Fwellness", { waitUntil: "domcontentloaded" })

  await expect(page).toHaveURL(/\/login\?callbackUrl=/)
  const loginUrl = new URL(page.url())
  expect(loginUrl.searchParams.get("callbackUrl")).toBe("/legal/accept?callbackUrl=%2Fwellness")
  await expect(page.getByRole("button", { name: /Sign in with email/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Create an account/i })).toHaveAttribute(
    "href",
    "/register?callbackUrl=%2Flegal%2Faccept%3FcallbackUrl%3D%252Fwellness",
  )

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("register defaults new accounts toward post-account onboarding", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/register", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { name: /Create MassageLab account/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /Create account/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Sign in instead/i })).toHaveAttribute("href", "/login?callbackUrl=%2Fonboarding")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("homepage uses the final logo artwork for light and dark themes", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/", { waitUntil: "domcontentloaded" })

  const logo = page.getByTestId("home-brand-wordmark-image")
  await expect(logo).toHaveAttribute("src", /massagelab-wordmark-final-20260622/)
  const initialSrc = await logo.getAttribute("src")

  await page.evaluate(() => {
    document.documentElement.classList.remove("dark")
    document.documentElement.classList.add("light")
  })
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute("src", initialSrc ?? "")

  await page.evaluate(() => {
    document.documentElement.classList.remove("light")
    document.documentElement.classList.add("dark")
  })
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute("src", initialSrc ?? "")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("theme switcher uses the compact toggle below desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 757, height: 682 })
  const health = capturePageHealth(page)

  await page.goto("/", { waitUntil: "domcontentloaded" })

  const themeGroup = page.getByRole("group", { name: "Theme" })
  const themeToggle = themeGroup.getByRole("button", { name: /^Use (light|dark) theme$/i })
  await expect(themeToggle).toBeVisible()
  await expect(themeGroup.getByRole("radio")).toHaveCount(0)

  const initialThemeLabel = await themeToggle.getAttribute("aria-label")
  expect(initialThemeLabel).toMatch(/^Use (light|dark) theme$/)
  await themeToggle.click()
  await expect(themeToggle).toHaveAttribute(
    "aria-label",
    initialThemeLabel === "Use light theme" ? "Use dark theme" : "Use light theme",
  )

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("homepage flip words advance when motion is allowed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  const health = capturePageHealth(page)

  await page.goto("/", { waitUntil: "domcontentloaded" })

  const flipWord = page.getByTestId("home-flip-word")
  await expect(flipWord).toBeVisible()
  const firstWord = await flipWord.textContent()
  await expect
    .poll(async () => flipWord.textContent(), {
      message: "expected the homepage role word to advance",
      timeout: 5_000,
    })
    .not.toBe(firstWord)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("homepage audience phrases reserve stable heading layout at 704px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Homepage phrase layout is covered once in desktop Chromium.")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.setViewportSize({ width: 704, height: 597 })
  await page.goto("/", { waitUntil: "domcontentloaded" })

  const flipWord = page.getByTestId("home-flip-word")
  const heading = page.locator("h2").filter({ has: flipWord })
  const followingParagraph = heading.locator("xpath=following-sibling::p[1]")
  const metrics: Array<{ word: string; headingHeight: number; lineCount: number; paragraphY: number }> = []

  for (const word of ["therapists", "students", "educators", "clients", "curious people"]) {
    await expect(flipWord).toHaveText(word, { timeout: 3_000 })
    metrics.push(await heading.evaluate((element, currentWord) => {
      const rect = element.getBoundingClientRect()
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
      const paragraph = element.nextElementSibling
      return {
        word: currentWord,
        headingHeight: rect.height,
        lineCount: Math.round(rect.height / lineHeight),
        paragraphY: paragraph?.getBoundingClientRect().y ?? Number.NaN,
      }
    }, word))
  }

  const baseline = metrics[0]
  for (const metric of metrics) {
    expect(metric.headingHeight, `${metric.word} heading height`).toBeCloseTo(baseline.headingHeight, 0)
    expect(metric.lineCount, `${metric.word} heading lines`).toBe(baseline.lineCount)
    expect(metric.paragraphY, `${metric.word} paragraph y`).toBeCloseTo(baseline.paragraphY, 0)
  }
  await expect(followingParagraph).toBeVisible()
})

test("homepage widest audience phrase does not overflow at 390px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Narrow homepage overflow is covered in mobile Chromium.")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/", { waitUntil: "domcontentloaded" })

  const flipWord = page.getByTestId("home-flip-word")
  const heading = page.locator("h2").filter({ has: flipWord })
  await expect(heading).toBeVisible()
  await expect(flipWord).toHaveText("curious people", { timeout: 15_000 })
  expect(await heading.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("homepage flip words stay stable when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const health = capturePageHealth(page)

  await page.goto("/", { waitUntil: "domcontentloaded" })

  const flipWord = page.getByTestId("home-flip-word")
  await expect(flipWord).toBeVisible()
  const firstWord = await flipWord.textContent()
  await page.waitForTimeout(3_500)
  await expect(flipWord).toHaveText(firstWord ?? "")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("anonymous flashcards setup keeps prompt controls usable before count hydration", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/education/flashcards", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Build A Deck" })).toBeVisible()

  await page.getByRole("button", { name: "Browse Premade Decks" }).click()
  await expect(page.getByText(/1 of \d+/)).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Community Decks" })).toBeVisible()
  await page.getByRole("button", { name: "View" }).first().click()
  await expect(page.getByText(/Deck options loaded\. Adjust or start when ready\./)).toBeVisible()
  await expect(page.getByLabel("Deck Title")).not.toHaveValue("My flashcard deck")
  await expect(page.getByText(/1 of \d+/)).toHaveCount(0)

  await page.getByRole("button", { name: "Configure Custom Deck" }).click()
  await expect(page.getByText(/1 of \d+/)).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Build A Deck" })).toBeVisible()

  await setMuscleUpperExtremityFilters(page)
  await ensureSetupSectionOpen(page, /^Prompt Types\b/i, /^Recall Key Facts\b/i)
  await setPressedButton(page, /^Recall Key Facts\b/i, true)
  await setPressedButton(page, /^Identify Body Region\b/i, true)
  await setPressedButton(page, /^Identify Structure Type\b/i, true)
  await expect(page.getByText("Updating counts")).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByRole("button", { name: /^Identify From Image/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Identify Body Region/i })).toBeEnabled()
  await waitForFilteredEligibleCount(page)

  const startButton = page.getByRole("button", { name: /Start [1-9]/ })
  await expect(startButton).toBeEnabled()

  const selectedPromptButtons = page.getByRole("button", { pressed: true })
  await expect(selectedPromptButtons.first()).toBeEnabled()

  await startButton.click()
  await expect(page.getByText(/1 of \d+/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("Sourced Answer")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Check|Correct|Missed/i })).toBeVisible()

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("anatomime shared game starts from the default setup", async ({ page }) => {
  const health = capturePageHealth(page)
  let createPayload: { config?: { answerMode?: string; bodySystems?: string[]; clueLevel?: string; regions?: string[]; termCount?: number } } | null = null
  const teams = [
    { id: "team-1", name: "Team 1", sortOrder: 0, score: 0 },
    { id: "team-2", name: "Team 2", sortOrder: 1, score: 0 },
  ]
  const host = { playerId: "host-player", token: "host-token" }
  const baseSession = {
    code: "TEST01",
    status: "LOBBY",
    phase: "LOBBY",
    config: { answerMode: "host-judged", clueLevel: "easy", roundSeconds: 30, termCount: 4, roundLimit: 3, hardcoreMode: false },
    phaseEndsAt: null,
    reviewExpiresAt: null,
    teams,
    players: [{ id: host.playerId, teamId: null, displayName: "Host", signedIn: false, isHost: true, lastSeenAt: new Date().toISOString() }],
    viewer: { isHost: true, playerId: host.playerId, teamId: null },
    activeTeam: teams[0],
    activeItem: null,
    turnReview: [],
    recap: [],
  }
  const activeItem = {
    index: 0,
    total: 4,
    prompt: {
      id: "muscle-biceps-brachii",
      name: "Biceps Brachii",
      kind: "muscle",
      category: "muscle",
      categoryLabel: "Muscles",
      regions: ["upper-extremity"],
      regionLabels: ["Upper Extremity"],
      difficulty: "easy",
      aliases: ["biceps"],
      definition: "Anterior arm muscle used here as a shared-session prompt.",
      sourceRefs: ["test-source"],
    },
    choices: [],
    multipleChoiceUnlocksAt: null,
    pendingSteal: false,
  }
  let currentSession: any = baseSession

  await page.route("**/api/anatomime/sessions/TEST01/start", async (route) => {
    currentSession = {
      ...baseSession,
      status: "PLAYING",
      phase: "ACTIVE_TERM",
      phaseEndsAt: new Date(Date.now() + 30_000).toISOString(),
      activeItem,
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session: currentSession }),
    })
  })
  await page.route("**/api/anatomime/sessions/TEST01", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session: currentSession }),
    })
  })
  await page.route("**/api/anatomime/sessions", async (route) => {
    createPayload = route.request().postDataJSON()
    currentSession = baseSession
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ session: currentSession, host }),
    })
  })

  await page.goto("/anatomime", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  await page.waitForTimeout(250)
  await expect(page.getByText(/Round 1 of 3/i)).toHaveCount(0)
  await expect(page.getByRole("link", { name: /Join Shared Game/i })).toHaveAttribute("href", "/anatomime/join")
  await expect(page.getByText("Game info")).toBeVisible()
  await page.getByText("Game info").click()
  await expect(page.getByText("4 terms")).toBeVisible()
  await expect(page.getByText("30s turns")).toBeVisible()
  await page.getByRole("button", { name: /Choose Anatomy Terms/i }).click()
  await expect(page.getByRole("heading", { name: "Deck" })).toBeAttached()
  await expect(page.getByText("Anatomy filters")).toBeVisible()
  await expect(page.getByRole("group", { name: /Body systems/i })).toBeAttached()
  await expect(page.getByRole("button", { name: /^Expert$/i })).toBeAttached()
  await expect(page.getByText(/Deck size/i)).toHaveCount(0)
  await page.getByRole("button", { name: /Create Shared Game/i }).click()

  const postedCreatePayload = createPayload as { config?: { answerMode?: string; bodySystems?: string[]; clueLevel?: string; regions?: string[]; termCount?: number } } | null
  expect(postedCreatePayload?.config?.bodySystems?.length ?? 0).toBeGreaterThan(0)
  expect(postedCreatePayload?.config?.regions?.length ?? 0).toBeGreaterThan(0)
  expect(postedCreatePayload?.config?.clueLevel).toBe("easy")
  expect(postedCreatePayload?.config?.answerMode).toBe("host-judged")
  expect(postedCreatePayload?.config?.termCount).toBe(4)
  await expect(page.getByRole("group", { name: /Shared game invite for room TEST01/i })).toBeVisible()
  await expect(page.getByAltText("QR code for Anatomime room TEST01")).toBeVisible()
  await expect(page.getByRole("link", { name: /Join Shared Game/i })).toHaveAttribute("href", "/anatomime/join?code=TEST01")
  await expect(page.getByRole("button", { name: /Start Shared Game/i })).toBeVisible()

  await page.getByRole("button", { name: /Start Shared Game/i }).click()
  await expect(page.getByText("PLAYING")).toBeVisible()
  await expect(page.getByText("ACTIVE_TERM")).toBeVisible()
  await expect(page.getByRole("button", { name: /Start Shared Game/i })).toHaveCount(0)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("anatomime shared game create failures stay visible in setup", async ({ page }) => {
  await page.route("**/api/anatomime/sessions", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Shared games are not available right now. Please try again later.",
      }),
    })
  })

  await page.goto("/anatomime", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /Choose Anatomy Terms/i }).click()
  await page.getByRole("button", { name: /Create Shared Game/i }).click()

  await expect(page.getByRole("button", { name: /Create Shared Game/i })).toBeVisible()
  await expect(page.getByText(/Shared games are not available right now/i)).toBeVisible()
})

test("anatomime player joins by code and submits typed guesses", async ({ page }) => {
  const health = capturePageHealth(page)
  await page.addInitScript(() => {
    window.Ably = {
      Realtime: class {
        channels = { get: () => ({ subscribe() {}, unsubscribe() {} }) }
        close() {}
      },
    } as any
  })

  const teams = [
    { id: "team-1", name: "Team 1", sortOrder: 0, score: 0 },
    { id: "team-2", name: "Team 2", sortOrder: 1, score: 0 },
  ]
  const activeItem = {
    index: 0,
    total: 4,
    prompt: { id: "term-key-1", categoryLabel: "Muscles", regionLabels: ["Upper Extremity"], difficulty: "easy" },
    choices: [],
    multipleChoiceUnlocksAt: null,
    pendingSteal: false,
  }
  const player = { id: "player-1", teamId: "team-1", displayName: "Avery", signedIn: false, isHost: false, lastSeenAt: new Date().toISOString() }
  let currentSession: any = {
    code: "TEST01",
    status: "LOBBY",
    phase: "LOBBY",
    config: { answerMode: "typed", clueLevel: "easy", roundSeconds: 30, termCount: 4, roundLimit: 3, hardcoreMode: false },
    phaseEndsAt: null,
    reviewExpiresAt: null,
    teams,
    players: [{ id: "host-player", teamId: null, displayName: "Host", signedIn: false, isHost: true, lastSeenAt: new Date().toISOString() }],
    viewer: { isHost: false, playerId: null, teamId: null },
    activeTeam: teams[0],
    activeItem: null,
    turnReview: [],
    recap: [],
  }
  let guessCount = 0

  await page.route("**/api/anatomime/sessions/TEST01/realtime-token", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ keyName: "test", nonce: "nonce", mac: "mac" }) })
  })
  await page.route("**/api/anatomime/sessions/TEST01/join", async (route) => {
    currentSession = {
      ...currentSession,
      status: "PLAYING",
      phase: "ACTIVE_TERM",
      phaseEndsAt: new Date(Date.now() + 30_000).toISOString(),
      players: [...currentSession.players, player],
      viewer: { isHost: false, playerId: player.id, teamId: player.teamId },
      activeItem,
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ player: { id: player.id, token: "player-token", teamId: player.teamId }, session: currentSession }),
    })
  })
  await page.route("**/api/anatomime/sessions/TEST01/guess", async (route) => {
    guessCount += 1
    if (guessCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { correct: false, scoreAwarded: 0, feedbackKind: "incorrect" }, session: currentSession }),
      })
      return
    }

    currentSession = {
      ...currentSession,
      activeItem: { ...activeItem, index: 1, prompt: { id: "term-key-2" } },
      teams: [{ ...teams[0], score: 1 }, teams[1]],
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: { correct: true, scoreAwarded: 1, feedbackKind: "active-correct" }, session: currentSession }),
    })
  })
  await page.route((url) => url.pathname === "/api/anatomime/sessions/TEST01", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession }) })
  })

  await page.goto("/anatomime/join", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  await page.waitForTimeout(250)
  await page.getByLabel("Code").fill("TEST01")
  await page.getByRole("button", { name: /Find Game/i }).click()
  await page.getByLabel("Display name").fill("Avery")
  await page.getByRole("button", { name: /Join Team/i }).click()

  await expect(page.getByText("Your team's turn")).toBeVisible()
  await expect(page.getByText("Submit a typed answer before time runs out.")).toBeVisible()
  await expect(page.getByLabel("Guess")).toBeVisible()
  await page.getByLabel("Guess").fill("wrong")
  await page.getByRole("button", { name: /Submit Guess/i }).click()
  await expect(page.getByText("Incorrect. Try another guess.").first()).toBeVisible()
  await expect(page.getByLabel("Guess")).toHaveValue("")
  await page.getByLabel("Guess").fill("scapula")
  await page.getByRole("button", { name: /Submit Guess/i }).click()
  await expect(page.getByText("Correct. Your team scored.").first()).toBeVisible()
  await expect(page.getByText("2 of 4")).toBeVisible()

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("anatomime player sees steal guidance when another team is active", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("massagelab-anatomime-player:TEST01", JSON.stringify({
      playerId: "player-2",
      playerToken: "player-token",
      teamId: "team-2",
    }))
    window.Ably = {
      Realtime: class {
        channels = { get: () => ({ subscribe() {}, unsubscribe() {} }) }
        close() {}
      },
    } as any
  })

  const teams = [
    { id: "team-1", name: "Team 1", sortOrder: 0, score: 0 },
    { id: "team-2", name: "Team 2", sortOrder: 1, score: 0 },
  ]
  const currentSession = {
    code: "TEST01",
    status: "PLAYING",
    phase: "ACTIVE_TERM",
    config: { answerMode: "typed", clueLevel: "easy", roundSeconds: 30, termCount: 4, roundLimit: 3, hardcoreMode: false },
    phaseEndsAt: new Date(Date.now() + 30_000).toISOString(),
    reviewExpiresAt: null,
    teams,
    players: [
      { id: "host-player", teamId: null, displayName: "Host", signedIn: false, isHost: true, lastSeenAt: new Date().toISOString() },
      { id: "player-2", teamId: "team-2", displayName: "Blake", signedIn: false, isHost: false, lastSeenAt: new Date().toISOString() },
    ],
    viewer: { isHost: false, playerId: "player-2", teamId: "team-2" },
    activeTeam: teams[0],
    activeItem: {
      index: 0,
      total: 4,
      prompt: { id: "term-key-1", categoryLabel: "Muscles", regionLabels: ["Upper Extremity"], difficulty: "easy" },
      choices: [],
      multipleChoiceUnlocksAt: null,
      pendingSteal: false,
    },
    turnReview: [],
    recap: [],
  }

  await page.route("**/api/anatomime/sessions/TEST01/realtime-token", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ keyName: "test", nonce: "nonce", mac: "mac" }) })
  })
  await page.route((url) => url.pathname === "/api/anatomime/sessions/TEST01", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession }) })
  })

  await page.goto("/anatomime/play/TEST01", { waitUntil: "domcontentloaded" })
  await expect(page.getByText("Team 1's turn")).toBeVisible()
  await expect(page.getByText("Steal/practice mode")).toBeVisible()
  await expect(page.getByText("Type the answer first to queue a steal if Team 1 misses.")).toBeVisible()
  await expect(page.getByLabel("Guess")).toBeVisible()
})

test("anatomime stale player pass offers rejoin recovery", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("massagelab-anatomime-player:TEST01", JSON.stringify({
      playerId: "old-player",
      playerToken: "old-token",
      teamId: "team-1",
    }))
    window.Ably = {
      Realtime: class {
        channels = { get: () => ({ subscribe() {}, unsubscribe() {} }) }
        close() {}
      },
    } as any
  })

  const teams = [
    { id: "team-1", name: "Team 1", sortOrder: 0, score: 0 },
    { id: "team-2", name: "Team 2", sortOrder: 1, score: 0 },
  ]
  const currentSession = {
    code: "TEST01",
    status: "LOBBY",
    phase: "LOBBY",
    config: { answerMode: "typed", clueLevel: "easy", roundSeconds: 30, termCount: 4, roundLimit: 3, hardcoreMode: false },
    phaseEndsAt: null,
    reviewExpiresAt: null,
    teams,
    players: [{ id: "host-player", teamId: null, displayName: "Host", signedIn: false, isHost: true, lastSeenAt: new Date().toISOString() }],
    viewer: { isHost: false, playerId: null, teamId: null },
    activeTeam: null,
    activeItem: null,
    turnReview: [],
    recap: [],
  }

  await page.route("**/api/anatomime/sessions/TEST01/realtime-token", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ keyName: "test", nonce: "nonce", mac: "mac" }) })
  })
  await page.route((url) => url.pathname === "/api/anatomime/sessions/TEST01", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession }) })
  })

  await page.goto("/anatomime/play/TEST01", { waitUntil: "domcontentloaded" })
  await expect(page.getByText("Rejoin needed on this device")).toBeVisible()
  await expect(page.getByRole("button", { name: "Clear Saved Player" })).toBeVisible()
  await page.getByRole("button", { name: "Clear Saved Player" }).click()
  await expect(page.getByText("Rejoin needed on this device")).toHaveCount(0)
  await expect(page.getByLabel("Display name")).toBeVisible()
})

test("anatomime multiple-choice options unlock only on player devices", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("massagelab-anatomime-player:TEST01", JSON.stringify({
      playerId: "player-1",
      playerToken: "player-token",
      teamId: "team-1",
    }))
    window.Ably = {
      Realtime: class {
        channels = { get: () => ({ subscribe() {}, unsubscribe() {} }) }
        close() {}
      },
    } as any
  })

  const teams = [
    { id: "team-1", name: "Team 1", sortOrder: 0, score: 0 },
    { id: "team-2", name: "Team 2", sortOrder: 1, score: 0 },
  ]
  const choices = [
    { id: "choice-1", label: "Scapula" },
    { id: "choice-2", label: "Clavicle" },
    { id: "choice-3", label: "Humerus" },
    { id: "choice-4", label: "Sternum" },
  ]
  const makeSession = (unlocked: boolean) => ({
    code: "TEST01",
    status: "PLAYING",
    phase: "ACTIVE_TERM",
    config: { answerMode: "multiple-choice", clueLevel: "easy", roundSeconds: 30, termCount: 4, roundLimit: 3, hardcoreMode: false },
    phaseEndsAt: new Date(Date.now() + 30_000).toISOString(),
    reviewExpiresAt: null,
    teams,
    players: [
      { id: "host-player", teamId: null, displayName: "Host", signedIn: false, isHost: true, lastSeenAt: new Date().toISOString() },
      { id: "player-1", teamId: "team-1", displayName: "Avery", signedIn: false, isHost: false, lastSeenAt: new Date().toISOString() },
    ],
    viewer: { isHost: false, playerId: "player-1", teamId: "team-1" },
    activeTeam: teams[0],
    activeItem: {
      index: 0,
      total: 4,
      prompt: { id: "term-key-1" },
      choices,
      multipleChoiceUnlocksAt: new Date(Date.now() + (unlocked ? -1000 : 20_000)).toISOString(),
      pendingSteal: false,
    },
    turnReview: [],
    recap: [],
  })
  let currentSession = makeSession(false)

  await page.route("**/api/anatomime/sessions/TEST01/realtime-token", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ keyName: "test", nonce: "nonce", mac: "mac" }) })
  })
  await page.route((url) => url.pathname === "/api/anatomime/sessions/TEST01", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: currentSession }) })
  })

  await page.goto("/anatomime/play/TEST01", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)
  await page.waitForTimeout(250)
  await expect(page.getByLabel("Guess")).toBeVisible()
  await expect(page.getByText("Type a guess now; answer choices unlock near the end.")).toBeVisible()
  await expect(page.getByRole("group", { name: /Multiple choice answers/i })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Scapula" })).toHaveCount(0)

  currentSession = makeSession(true)
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.getByText("Pick an answer choice before time runs out.")).toBeVisible()
  await expect(page.getByRole("group", { name: /Multiple choice answers/i })).toBeVisible()
  for (const choice of choices) {
    await expect(page.getByRole("button", { name: choice.label })).toBeVisible()
  }
})

test("flashcards can start from local sourced prompts when the prompt API is unavailable", async ({ page }) => {
  let promptApiRequests = 0

  await page.route("**/api/education/flashcards/prompts", async (route) => {
    promptApiRequests += 1
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Prompt API unavailable for browser test." }),
    })
  })

  await page.goto("/education/flashcards", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Build A Deck" })).toBeVisible()

  await setMuscleUpperExtremityFilters(page)
  await page.getByLabel("Deck Size", { exact: true }).fill("10")
  await setPressedButton(page, /^Flip & Self-Grade\b/i, true)
  await ensureSetupSectionOpen(page, /^Prompt Types\b/i, /^Identify From Image\b/i)
  await setPressedButton(page, /^Identify From Image\b/i, false)
  await setPressedButton(page, /^Identify Body Region\b/i, false)
  await setPressedButton(page, /^Identify Structure Type\b/i, false)
  await setPressedButton(page, /^Muscle Action\b/i, true)

  const startButton = page.getByRole("button", { name: /Start 10/ })
  await expect(startButton).toBeEnabled()
  await startButton.click()

  await expect(page.getByText(/1 of 10/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText("Practice only").first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Reveal Answer" })).toBeVisible()
  await expect(page.getByText("Sourced Answer")).toHaveCount(0)
  await page.getByRole("button", { name: "Flip flashcard to answer" }).click()
  await expect(page.getByText("Sourced Answer")).toBeVisible()
  await page.getByRole("button", { name: "Show Prompt" }).click()
  await expect(page.getByText("Sourced Answer")).toHaveCount(0)
  await page.getByRole("button", { name: "Reveal Answer" }).click()
  await expect(page.getByText("Sourced Answer")).toBeVisible()
  await expect(page.getByRole("button", { name: /Correct/i })).toBeVisible()
  expect(promptApiRequests).toBeGreaterThan(0)
})

test("flashcards setup explains empty prompt filters before study starts", async ({ page }) => {
  let promptCatalogRequests = 0

  await page.route("**/api/education/flashcards/prompts", async (route) => {
    promptCatalogRequests += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        promptTypeCounts: [
          { id: "anatomime_name_recall", label: "Name Recall", promptCount: 0 },
          { id: "identify_from_media", label: "Identify From Image", promptCount: 0 },
          { id: "name_to_summary", label: "Recall Summary", promptCount: 0 },
          { id: "name_to_region", label: "Identify Body Region", promptCount: 0 },
          { id: "name_to_category", label: "Identify Structure Type", promptCount: 0 },
          { id: "muscle_origin_insertion", label: "Muscle Origin/Insertion", promptCount: 0 },
          { id: "muscle_action", label: "Muscle Action", promptCount: 0 },
          { id: "muscle_innervation", label: "Muscle Innervation", promptCount: 0 },
        ],
        promptSummaries: [],
      }),
    })
  })

  await page.goto("/education/flashcards", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Build A Deck" })).toBeVisible()
  await expect.poll(() => promptCatalogRequests).toBeGreaterThan(0)
  await expect(page.getByText("Updating counts")).toHaveCount(0, { timeout: 20_000 })

  const startButton = page.getByRole("button", { name: "No cards to start" })
  await expect(startButton).toBeVisible()
  await expect(startButton).toBeDisabled()
  await expect(page.getByText("No eligible cards match these filters.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Reset filters" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled()
})

test("signed-in flashcards fall back to temporary study when progress session fails", async ({ page }) => {
  let sessionStartRequests = 0

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "browser-test-user" } }),
    })
  })
  await page.route("**/api/education/flashcards/progress", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        progress: {
          trackedPromptCount: 2,
          activePromptCount: 1,
          masteredPromptCount: 1,
          totalAttempts: 12,
          totalCorrect: 10,
          totalIncorrect: 2,
          accuracyPercent: 83,
          masteryThreshold: 10,
          completedSessionCount: 1,
          achievementCount: 1,
          bestDurationMs: 45000,
          targetPromptCount: 2,
          roundCompletionPercent: 50,
          completedRoundCount: 0,
          currentRound: 1,
          canStartNextRound: false,
        },
        recentProgress: [{
          promptId: "name_to_region:muscle-biceps-brachii",
          promptType: "name_to_region",
          entityType: "muscle",
          entitySlug: "biceps-brachii",
          status: "MASTERED",
          score: 100,
          attemptCount: 10,
          correctCount: 10,
          incorrectCount: 0,
          lifetimeAttemptCount: 10,
          lifetimeCorrectCount: 10,
          lifetimeIncorrectCount: 0,
          masteryThreshold: 10,
          masteryRound: 1,
          masteredAt: "2026-06-07T00:00:00.000Z",
          lastSeenAt: "2026-06-07T00:00:00.000Z",
        }],
        achievements: [{ key: "flashcards:first-completion", earnedAt: "2026-06-07T00:00:00.000Z" }],
      }),
    })
  })
  await page.route("**/api/education/flashcards/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback()
      return
    }

    sessionStartRequests += 1
    expect(JSON.parse(route.request().postData() ?? "{}").skipMastered).toBe(true)
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Progress tracking could not be started." }),
    })
  })

  await page.goto("/education/flashcards", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Build A Deck" })).toBeVisible()
  await expect(page.getByRole("link", { name: /Sign in to save progress/i })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Your Progress" })).toBeVisible()
  await expect(page.getByText("Biceps Brachii")).toBeVisible()
  await page.getByLabel("Skip mastered prompts").click()

  const startButton = page.getByRole("button", { name: /Start [1-9]/ })
  await expect(startButton).toBeEnabled()
  await startButton.click()

  await expect(page.getByText(/1 of \d+/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Studying temporarily; progress tracking could not be started\./i)).toBeVisible()
  expect(sessionStartRequests).toBeGreaterThan(0)
})

test("signed-in flashcards can claim a mastery round and refresh progress", async ({ page }) => {
  let progressRequests = 0
  let roundStartRequests = 0
  let roundClaimed = false
  let delayedRoundRefresh = false
  let releaseProgressRefresh: (() => void) | undefined
  const progressRefreshStarted = new Promise<void>((resolve) => {
    releaseProgressRefresh = resolve
  })

  const progressPayload = () => ({
    progress: {
      trackedPromptCount: 2,
      activePromptCount: roundClaimed ? 2 : 0,
      masteredPromptCount: roundClaimed ? 0 : 2,
      totalAttempts: 20,
      totalCorrect: 20,
      totalIncorrect: 0,
      accuracyPercent: 100,
      masteryThreshold: 10,
      completedSessionCount: 4,
      achievementCount: roundClaimed ? 2 : 1,
      bestDurationMs: 45000,
      targetPromptCount: 2,
      roundCompletionPercent: roundClaimed ? 0 : 100,
      completedRoundCount: roundClaimed ? 1 : 0,
      currentRound: roundClaimed ? 2 : 1,
      canStartNextRound: !roundClaimed,
    },
    recentProgress: [],
    achievements: [{ key: "flashcards:first-completion", earnedAt: "2026-06-07T00:00:00.000Z" }],
    promptTypeProgress: [
      {
        key: "name_to_region",
        label: "Identify Body Region",
        totalCount: 2,
        trackedCount: roundClaimed ? 0 : 2,
        masteredCount: roundClaimed ? 0 : 2,
        remainingCount: roundClaimed ? 2 : 0,
        completionPercent: roundClaimed ? 0 : 100,
      },
    ],
    regionProgress: [
      {
        key: "upper-extremity",
        label: "Upper Extremity",
        totalCount: 2,
        trackedCount: roundClaimed ? 0 : 2,
        masteredCount: roundClaimed ? 0 : 2,
        remainingCount: roundClaimed ? 2 : 0,
        completionPercent: roundClaimed ? 0 : 100,
      },
    ],
  })

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "browser-test-user" } }),
    })
  })
  await page.route("**/api/education/flashcards/progress", async (route) => {
    progressRequests += 1
    if (roundClaimed && !delayedRoundRefresh) {
      delayedRoundRefresh = true
      await progressRefreshStarted
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(progressPayload()),
    })
  })
  await page.route("**/api/education/flashcards/progress/round", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback()
      return
    }

    roundStartRequests += 1
    roundClaimed = true
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        round: {
          round: 1,
          nextRound: 2,
          targetPromptCount: 2,
          masteredPromptCount: 2,
        },
      }),
    })
  })

  await page.goto("/education/flashcards", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Your Progress" })).toBeVisible()

  const claimButton = page.getByRole("button", { name: "Claim round and start next" })
  await expect(claimButton).toBeVisible()
  await expect(claimButton).toBeEnabled()
  await claimButton.click()

  const pendingClaimButton = page
    .getByRole("button", { name: "Starting..." })
    .or(page.getByRole("button", { name: "Claim round and start next" }))
    .first()
  await expect(pendingClaimButton).toBeDisabled()
  releaseProgressRefresh?.()

  await expect(page.getByText("Round 1 complete. Round 2 is ready.")).toBeVisible()
  await expect(page.getByText("2 prompts remain before your next completion badge.")).toBeVisible()
  expect(roundStartRequests).toBe(1)
  expect(progressRequests).toBeGreaterThan(1)
})
