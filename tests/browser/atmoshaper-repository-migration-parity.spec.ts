import { expect, test, type Locator, type Page } from "@playwright/test"
import { writeFile } from "node:fs/promises"
import { isBrowserQaDatabaseTargetAuthorized } from "../../scripts/assert-browser-qa-database-target.mjs"
import {
  installIdentityMethodSafetyFixture,
  removeIdentityMethodSafetyFixture,
} from "./identity-method-safety-fixture"

const enabled = process.env.ATMOSHAPER_MIGRATION_PARITY === "1"

// Public route copy belongs to public-routes.spec.ts. The more specific Clock,
// Chimer, Pricing, and Support locators come from their existing journey owners.
// Education uses its content link; the same page name also labels hidden navigation.
const publicSurfaces = [
  { name: "home", path: "/", ready: (page: Page) => page.locator('[data-testid="home-brand-wordmark"]:visible') },
  { name: "tools", path: "/tools", ready: (page: Page) => page.getByText(/MassageLab Tools/i).first() },
  { name: "education", path: "/education", ready: (page: Page) => page.getByRole("link", { name: "Open flashcards", exact: true }) },
  { name: "music", path: "/music", ready: (page: Page) => page.getByRole("heading", { name: /Treatment room starters/i }) },
  { name: "chimer", path: "/chimer", ready: (page: Page) => page.getByRole("button", { name: /^Increase minutes$/i }) },
  { name: "clock", path: "/clock", ready: (page: Page) => page.getByRole("region", { name: "Chimer clock", exact: true }) },
  { name: "wellness", path: "/wellness", ready: (page: Page) => page.getByText(/Client-owned self-tracking/i).first() },
  { name: "notes", path: "/notes", ready: (page: Page) => page.getByText(/Therapist or Team\/Practice required/i).first() },
  { name: "pricing", path: "/pricing", ready: (page: Page) => page.locator("#one-time-support:visible") },
  { name: "support", path: "/support", ready: (page: Page) => page.getByRole("button", { name: "Send Diagnostic", exact: true }) },
] as const

const clockCapture = {
  timezoneId: "UTC",
  locale: "en-US",
  ambientMotionMode: "reduced",
  backgroundId: "massage-lab-moving-gradient",
  backgroundPresentation: "static-fallback",
  installedAt: "2026-09-06T09:55:00.000Z",
  pausedAt: "2026-09-06T10:00:00.000Z",
  controlsSettleMs: 1000,
} as const

const homeCapture = {
  installedAt: "2026-09-06T09:55:00.000Z",
  pausedAt: "2026-09-06T10:00:00.000Z",
  pausedPerformanceMs: 300_000,
  frameStepMs: 16,
  frameSteps: 32,
  metalMotionState: "paused",
} as const

type HomeRootObservation = {
  mountedAt: number
  resize: Set<ResizeObserver>
  intersection: Set<IntersectionObserver>
  intersecting: boolean
}

declare global {
  interface Window {
    __migrationHomeObservation?: {
      roots: Map<Element, HomeRootObservation>
      disconnected: Set<ResizeObserver | IntersectionObserver>
    }
  }
}

type ParityActivity = {
  browserErrors: string[]
  browserMutations: string[]
  externalReads: Set<string>
  clock?: typeof clockCapture
  home?: typeof homeCapture & {
    warmRootCount: number
    retiredRootCount: number
    remountRootCount: number
    firstPaint: Awaited<ReturnType<typeof sampleHomePaint>>
    finalPaint: Awaited<ReturnType<typeof sampleHomePaint>>
  }
  fixtureProject?: string
}

const activityByPage = new WeakMap<Page, ParityActivity>()

/** Observes page errors and inventories external reads without URL queries or credentials. */
function observeUnexpectedActivity(page: Page, baseURL: string): ParityActivity {
  const localOrigin = new URL(baseURL).origin
  const activity: ParityActivity = {
    browserErrors: [],
    browserMutations: [],
    externalReads: new Set(),
  }
  page.on("console", (message) => {
    if (message.type() === "error") activity.browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => activity.browserErrors.push(error.message))
  page.context().on("request", (request) => {
    const url = new URL(request.url())
    const description = `${request.method()} ${url.origin}${url.pathname}`
    if (!["GET", "HEAD"].includes(request.method())) {
      activity.browserMutations.push(description)
    } else if (url.origin !== localOrigin) {
      activity.externalReads.add(`${description} (${request.resourceType()})`)
    }
  })
  return activity
}

/** Captures the complete rendering, including Clock glyph shadows and glow, without masks. */
async function captureSurface(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready)
  expect(
    await page.locator("html").evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    `${name} must fit the configured viewport without horizontal page overflow`,
  ).toBe(true)
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  })
}

/** Observe MetalFx's native readiness/cleanup without replacing callbacks or
 * scheduling. G proved that retiring every warm instance resets the shared
 * engine origin; a DOM count alone would not prove its effect cleanup ran.
 */
async function installHomeObservation(page: Page) {
  await page.addInitScript(() => {
    const roots = new Map<Element, HomeRootObservation>()
    const disconnected = new Set<ResizeObserver | IntersectionObserver>()
    window.__migrationHomeObservation = { roots, disconnected }
    const record = (target: Element) => {
      if (!target.matches(".ml-metal-attention-root")) return null
      let entry = roots.get(target)
      if (!entry) {
        entry = { mountedAt: performance.now(), resize: new Set(), intersection: new Set(), intersecting: false }
        roots.set(target, entry)
      }
      return entry
    }
    const NativeResizeObserver = window.ResizeObserver
    window.ResizeObserver = class extends NativeResizeObserver {
      observe(target: Element, options?: ResizeObserverOptions) {
        record(target)?.resize.add(this)
        return super.observe(target, options)
      }
      disconnect() {
        const result = super.disconnect()
        disconnected.add(this)
        return result
      }
    }
    const NativeIntersectionObserver = window.IntersectionObserver
    window.IntersectionObserver = class extends NativeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(function (this: IntersectionObserver, entries, observer) {
          Reflect.apply(callback, this, [entries, observer])
          if (observer.rootMargin === "64px 64px 64px 64px") {
            for (const entry of entries) {
              const observed = roots.get(entry.target)
              if (observed) observed.intersecting = entry.isIntersecting
            }
          }
        }, options)
      }
      observe(target: Element) {
        record(target)?.intersection.add(this)
        return super.observe(target)
      }
      disconnect() {
        const result = super.disconnect()
        disconnected.add(this)
        return result
      }
    }
  })
}

/** All warmed roots must leave the DOM AND finish both native observer cleanups. */
async function sampleHomeTeardown(page: Page) {
  return page.evaluate(() => {
    const observation = window.__migrationHomeObservation!
    const retired = [...observation.roots].filter(([root, entry]) => !root.isConnected
      && entry.resize.size > 0 && entry.intersection.size > 0
      && [...entry.resize, ...entry.intersection].every((observer) => observation.disconnected.has(observer)))
    return { observedRootCount: observation.roots.size, retiredRootCount: retired.length }
  })
}

/** Shared real Home prerequisites apply to warm-up and the measured remount. */
async function readyHomeRing(page: Page) {
  const wordmark = page.locator('[data-testid="home-brand-wordmark"]:visible')
  const hero = page.locator("section:visible").filter({ has: wordmark })
  await expect(wordmark).toHaveCount(1)
  await expect(hero).toHaveCount(1)
  await page.evaluate(() => document.fonts.ready)
  const image = hero.getByTestId("home-brand-wordmark-image")
  await expect(image).toHaveCount(1)
  expect(await image.evaluate(async (image: HTMLImageElement) => {
    await image.decode()
    return image.complete && image.naturalWidth > 0
  })).toBe(true)
  await expect(hero.getByTestId("home-flip-word")).toHaveText("therapists")
  const ring = hero.locator(".ml-metal-attention-root")
  await expect(ring).toHaveCount(1)
  await expect(ring).toHaveAttribute("data-ml-metal-motion-state", homeCapture.metalMotionState)
  await expect(ring).toHaveAttribute("data-paused", "true")
  await expect(ring).toHaveAttribute("data-theme", "dark")
  return ring
}

/** Hash actual canvas bytes for the receipt; never persist image data or alter paint. */
async function sampleHomePaint(ring: Locator) {
  return ring.evaluate(async (root: HTMLElement) => {
    const canvas = root.querySelector<HTMLCanvasElement>("canvas.metal-fx-canvas")!
    const bounds = root.getBoundingClientRect()
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data
    let nontransparentPixels = 0
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) nontransparentPixels++
    const digest = await crypto.subtle.digest("SHA-256", pixels)
    return {
      performanceMs: performance.now(), dateMs: Date.now(),
      width: canvas.width, height: canvas.height,
      expectedWidth: Math.round(Math.round(bounds.width) * devicePixelRatio),
      expectedHeight: Math.round(Math.round(bounds.height) * devicePixelRatio),
      nontransparentPixels,
      sha256: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""),
      visibility: root.style.visibility, opacity: getComputedStyle(canvas).opacity,
      paused: root.getAttribute("data-paused"),
    }
  })
}

/** Reproduce G's real warm-route/teardown/frozen-remount boundary. No clock
 * progress is allowed to release a pending remount: E proved that changes the
 * first shader phase. The 32-frame comparison retains G's measured 512ms sweep.
 */
async function prepareHomeCapture(page: Page) {
  await page.clock.install({ time: new Date(homeCapture.installedAt) })
  await installHomeObservation(page)
  const response = await page.goto("/tools", { waitUntil: "load" })
  expect(response?.ok()).toBe(true)
  // LayoutWrapper owns route content; Next's body-level title announcer does not.
  const routeContent = page.locator("main .ml-app-content")
  const toolsTitle = routeContent.getByText("MassageLab Tools", { exact: true }).filter({ visible: true })
  await expect(routeContent).toHaveCount(1)
  await expect(toolsTitle).toHaveCount(1)
  await expect(toolsTitle).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator(".ml-metal-attention-root")).toHaveCount(0)
  const originalDocument = await page.evaluateHandle(() => document)
  const homeLink = page.getByRole("link", { name: "MassageLab home", exact: true }).filter({ visible: true })
  try {
    await expect(homeLink).toHaveCount(1)
    await homeLink.click()
    await expect(page).toHaveURL(new URL("/", response!.url()).href)
    expect(await originalDocument.evaluate((before) => before === document)).toBe(true)
    const warmRing = await readyHomeRing(page)
    await expect.poll(() => warmRing.evaluate((root) => window.__migrationHomeObservation!.roots.get(root)?.intersecting)).toBe(true)
    await expect.poll(() => warmRing.evaluate((root: HTMLElement) => root.style.visibility)).toBe("visible")
    await expect(warmRing.locator("canvas.metal-fx-canvas")).toHaveCSS("opacity", "0.72")
    await expect.poll(async () => (await sampleHomePaint(warmRing)).nontransparentPixels).toBeGreaterThan(0)
    const warmPaint = await sampleHomePaint(warmRing)
    expect(warmPaint.width).toBe(warmPaint.expectedWidth)
    expect(warmPaint.height).toBe(warmPaint.expectedHeight)
    const warmRootCount = await page.locator(".ml-metal-attention-root").count()
    expect(warmRootCount).toBeGreaterThan(0)
    await page.goBack()
    await expect(page).toHaveURL(response!.url())
    expect(await originalDocument.evaluate((before) => before === document)).toBe(true)
    await expect(routeContent).toHaveCount(1)
    await expect(toolsTitle).toHaveCount(1)
    await expect(toolsTitle).toBeVisible()
    await expect(page.locator(".ml-metal-attention-root")).toHaveCount(0)
    await expect.poll(() => sampleHomeTeardown(page)).toEqual({ observedRootCount: warmRootCount, retiredRootCount: warmRootCount })

    await page.clock.pauseAt(new Date(homeCapture.pausedAt))
    expect(await page.evaluate(() => ({ performanceMs: performance.now(), dateMs: Date.now() })))
      .toEqual({ performanceMs: homeCapture.pausedPerformanceMs, dateMs: Date.parse(homeCapture.pausedAt) })
    await expect(homeLink).toHaveCount(1)
    await homeLink.click()
    await expect(page).toHaveURL(new URL("/", response!.url()).href)
    expect(await originalDocument.evaluate((before) => before === document)).toBe(true)
    const ring = await readyHomeRing(page)
    expect(await originalDocument.evaluate((before) => before === document)).toBe(true)
    const remounts = await page.evaluate(() => [...window.__migrationHomeObservation!.roots]
      .filter(([root]) => root.isConnected).map(([, entry]) => entry.mountedAt))
    expect(remounts).toHaveLength(warmRootCount)
    expect(remounts.every((mountedAt) => mountedAt === homeCapture.pausedPerformanceMs)).toBe(true)
    expect(await page.evaluate(() => performance.now())).toBe(homeCapture.pausedPerformanceMs)
    expect(await ring.evaluate((root: HTMLElement) => root.style.visibility)).toBe("hidden")
    await expect.poll(() => ring.evaluate((root) => window.__migrationHomeObservation!.roots.get(root)?.intersecting)).toBe(true)
    const beforePaint = await sampleHomePaint(ring)
    expect(beforePaint.performanceMs).toBe(homeCapture.pausedPerformanceMs)
    expect(beforePaint.dateMs).toBe(Date.parse(homeCapture.pausedAt))
    expect(beforePaint.nontransparentPixels).toBe(0)
    let firstPaint: Awaited<ReturnType<typeof sampleHomePaint>> | undefined
    let finalPaint: Awaited<ReturnType<typeof sampleHomePaint>> | undefined
    for (let step = 1; step <= homeCapture.frameSteps; step++) {
      await page.clock.runFor(homeCapture.frameStepMs)
      const paint = await sampleHomePaint(ring)
      expect(paint.performanceMs).toBe(homeCapture.pausedPerformanceMs + step * homeCapture.frameStepMs)
      expect(paint.dateMs).toBe(Date.parse(homeCapture.pausedAt) + step * homeCapture.frameStepMs)
      expect(paint.nontransparentPixels).toBeGreaterThan(0)
      expect(paint.width).toBe(paint.expectedWidth)
      expect(paint.height).toBe(paint.expectedHeight)
      expect(paint.visibility).toBe("visible")
      expect(paint.paused).toBe("true")
      expect(paint.opacity).toBe("0.72")
      firstPaint ??= paint
      expect(paint.sha256).toBe(firstPaint.sha256)
      finalPaint = paint
    }
    await expect(ring).toBeVisible()
    await expect(ring.locator("canvas.metal-fx-canvas")).toBeVisible()
    activityByPage.get(page)!.home = {
      ...homeCapture, warmRootCount, retiredRootCount: warmRootCount,
      remountRootCount: remounts.length, firstPaint: firstPaint!, finalPaint: finalPaint!,
    }
  } finally {
    await originalDocument.dispose()
  }
}

test.describe("AtmoShaper repository migration parity", () => {
  test.skip(!enabled, "Run only for an explicit repository migration comparison")
  // Route interception must cover every outgoing browser request, including
  // requests that an installed service worker would otherwise handle itself.
  test.use({ serviceWorkers: "block", timezoneId: clockCapture.timezoneId, locale: clockCapture.locale })

  test.beforeEach(async ({ context, page }, testInfo) => {
    const baseURL = String(testInfo.project.use.baseURL)
    const target = new URL(baseURL)
    expect(["http:", "https:"]).toContain(target.protocol)
    expect(["localhost", "127.0.0.1", "[::1]"], "Parity requires a local test origin").toContain(target.hostname)
    activityByPage.set(page, observeUnexpectedActivity(page, baseURL))
    // Rendering needs no browser writes. Block the first hop even when local:
    // a local 307/308 could otherwise forward the original write to a provider.
    await context.route("**/*", async (route) => {
      const request = route.request()
      if (!["GET", "HEAD"].includes(request.method())) {
        await route.abort("blockedbyclient")
        return
      }
      await route.continue()
    })
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
  })

  test.afterEach(async ({ context, page }, testInfo) => {
    const activity = activityByPage.get(page)
    if (!activity) return
    try {
      // Keep request/error observers active until owned browser activity ends,
      // including navigation/keepalive work initiated during page teardown.
      await context.close()
    } finally {
      try {
        // Marked before setup so a partial install still receives exact cleanup,
        // even if context closure fails. Browser activity ends before DB removal.
        if (activity.fixtureProject) {
          await removeIdentityMethodSafetyFixture(activity.fixtureProject, "BOTH_METHODS")
        }
      } finally {
        // Persist in the owned output directory even when a console-only reporter
        // does not retain body attachments. Never include queries or credentials.
        const inventoryPath = testInfo.outputPath("migration-parity-inventory.json")
        await writeFile(inventoryPath, JSON.stringify({
          project: testInfo.project.name,
          test: testInfo.title,
          readOnlyExternalRequests: [...activity.externalReads].sort(),
          browserMutationAttempts: activity.browserMutations,
          masks: [],
          clock: activity.clock,
          home: activity.home,
        }, null, 2))
        await testInfo.attach("migration-parity-inventory", {
          contentType: "application/json",
          path: inventoryPath,
        })
        expect.soft(activity.browserErrors, "Parity must have no browser console/page errors").toEqual([])
        expect.soft(activity.browserMutations, "Render-only parity must not attempt any browser mutation").toEqual([])
      }
    }
  })

  for (const surface of publicSurfaces) {
    test(`${surface.name} source rendering`, async ({ page, isMobile }) => {
      if (surface.name === "home") {
        await prepareHomeCapture(page)
        await captureSurface(page, surface.name)
        return
      }
      if (surface.name === "clock") {
        // Clock intentionally overrides OS reduced motion. Use the existing
        // app preference so its random canvas yields to the real static view.
        await page.addInitScript((ambientMotionMode) => {
          localStorage.setItem("massage-lab-settings", JSON.stringify({ ambientMotionMode }))
        }, clockCapture.ambientMotionMode)
        // Installed official Clock API lets hydration timers run normally first.
        await page.clock.install({ time: new Date(clockCapture.installedAt) })
      }
      const response = await page.goto(surface.path, { waitUntil: "domcontentloaded" })
      expect(response?.ok()).toBe(true)
      await expect(surface.ready(page)).toBeVisible()
      if (surface.name === "pricing") {
        // The Pricing AppSurface owns one donation form. Hidden copies must not
        // participate in readiness, and multiple visible owners remain a failure.
        const support = surface.ready(page)
        await expect(support).toHaveCount(1)
        const donationForm = support.locator('form[action="/api/billing/donation"]:visible')
        await expect(donationForm).toHaveCount(1)
        await expect(donationForm).toBeVisible()
      }
      if (surface.name === "chimer") {
        const setup = page.getByRole("region", { name: "Chimer setup", exact: true })
        const guestNotice = setup.getByText(
          "Settings stay on this device. Sign in or create an account to sync Chimer settings across devices.",
          { exact: true },
        )
        // Observe resolved guest state, then wait for the owner's 7,500ms display
        // plus 420ms exit to unmount it. This is a condition wait, not DOM hiding.
        await expect(guestNotice).toBeVisible()
        await expect(guestNotice).toHaveCount(0, { timeout: 12_000 })
        const stepMarker = isMobile
          ? setup.getByText("Step 1 of 5", { exact: true })
          : setup.getByRole("button", { name: "1 Time", exact: true })
        await expect(stepMarker).toBeVisible()
        await expect(stepMarker).toBeInViewport()
        expect(await stepMarker.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
        }), "The initial Chimer step marker must be unobscured").toBe(true)
      }
      if (surface.name === "clock") {
        await page.waitForLoadState("load")
        await expect(page.locator("body")).toHaveClass(/chimer-running/)
        // RunningTimer owns these nodes inside its accessible Clock region;
        // document-wide test IDs can also match a non-active copy.
        const clock = page.getByRole("region", { name: "Chimer clock", exact: true })
        await expect(clock).toHaveCount(1)
        await expect(clock).toBeVisible()
        const background = clock.getByTestId("chimer-premium-background")
        await expect(background).toHaveCount(1)
        await expect(background).toBeVisible()
        await expect(background).toHaveAttribute("data-background-id", clockCapture.backgroundId)
        // No mounted effect AND no pending-effect fallback distinguishes the
        // app's settled reduced-motion view from its initial lazy-load state.
        await expect(background).toHaveAttribute("data-background-effect-mounted", "false")
        await expect(background).toHaveAttribute("data-background-fallback-only", "false")
        await expect(background).toHaveAttribute("data-background-underlay", "visible")
        await expect(background.locator("canvas")).toHaveCount(0)
        const staticBackground = background.locator(":scope > div")
        await expect(staticBackground).toHaveCount(1)
        await expect(staticBackground).toBeVisible()
        await expect(staticBackground).toHaveCSS("background-image", /radial-gradient/)
        await expect(staticBackground).toHaveCSS("animation-name", "none")
        await page.clock.pauseAt(new Date(clockCapture.pausedAt))
        await clock.getByRole("button", { name: "Reveal clock controls", exact: true }).click()
        // Allow the existing 900ms chrome transition to settle, then remain
        // paused before its 3s fade/6s hide timers can change the screenshot.
        await page.clock.runFor(clockCapture.controlsSettleMs)
        // ImmersivePanelShell portals outside the region; bind its visible root
        // to the unique accessible controls group instead of a global test ID.
        const controls = page.getByRole("group", { name: "Immersive display controls", exact: true })
        await expect(controls).toHaveCount(1)
        await expect(controls).toBeVisible()
        const shell = page.locator("[data-immersive-shell]:visible").filter({ has: controls })
        await expect(shell).toHaveCount(1)
        await expect(shell).toHaveCSS("opacity", "1")
        const currentTime = clock.getByTestId("running-current-time")
        await expect(currentTime).toHaveCount(1)
        await expect(currentTime).toBeVisible()
        await expect(currentTime).toContainText(/10:00\s*AM/)
        expect(await page.evaluate(() => Date.now())).toBe(Date.parse(clockCapture.pausedAt) + clockCapture.controlsSettleMs)
        activityByPage.get(page)!.clock = clockCapture
      }
      await captureSurface(page, surface.name)
    })
  }

  test("signed-in account profile and security source rendering", async ({ context, page }, testInfo) => {
    expect(
      isBrowserQaDatabaseTargetAuthorized(process.env),
      "Signed-in parity requires the exact authorized non-production Browser-QA database",
    ).toBe(true)
    const projectName = testInfo.project.name
    activityByPage.get(page)!.fixtureProject = projectName
    await installIdentityMethodSafetyFixture({
      context,
      baseURL: String(testInfo.project.use.baseURL),
      projectName,
      scenario: "BOTH_METHODS",
    })
    for (const tab of ["profile", "security"] as const) {
      const response = await page.goto(`/account?tab=${tab}`, { waitUntil: "domcontentloaded" })
      expect(response?.ok()).toBe(true)
      await expect(page).toHaveURL(new RegExp(`/account\\?tab=${tab}$`))
      // Existing owners: interaction-feedback profile and identity-method-safety security.
      const ready = tab === "profile"
        ? page.getByLabel("Display name")
        : page.getByRole("heading", { name: "Sign-in methods" })
      await expect(ready).toBeVisible()
      await captureSurface(page, `account-${tab}`)
    }
  })
})
