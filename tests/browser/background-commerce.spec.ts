import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { centerCarouselItem } from "./carousel-test-helpers"
import { installSignedInSessionCookie } from "./signed-in-session-cookie"

const USER_ID = "background-commerce-browser-user"
const AURORA_ID = "massage-lab-aurora"
// Commerce keeps the stable ID while accessible-name assertions follow the approved branding catalog.
const AURORA_NAME = "Interstellar"
const DOTTED_GLOW_ID = "massage-lab-dotted-glow"
const DOTTED_GLOW_NAME = "Shimmer"
const RETURN_STORAGE_KEY = "massagelab-background-checkout-return-v1"

type CartItem = {
  productType: "background"
  productKey: string
  displayName: string
  unitAmount: number
  currency: "usd"
  availableForPurchase: boolean
}

type Ownership = {
  backgroundId: string
  source: "credit" | "purchase"
  status: "active" | "refund_pending" | "dispute_suspended" | "refund_revoked" | "dispute_revoked" | "retired"
  acquiredAt: string
}

type CommerceSnapshot = {
  creditBalance: number
  ownedBackgroundIds: string[]
  ownerships: Ownership[]
  cart: {
    items: CartItem[]
    reservedOrder: { orderId: string; expiresAt: string } | null
    subtotalAmount: number
    currency: "usd"
    notices: Array<{ code: string; productKey: string }>
  }
  recentOrders: Array<{ id: string; status: string; returnPath: string }>
}

const PRODUCTS: Record<string, CartItem> = {
  [AURORA_ID]: {
    productType: "background",
    productKey: AURORA_ID,
    displayName: AURORA_NAME,
    unitAmount: 100,
    currency: "usd",
    availableForPurchase: true,
  },
  [DOTTED_GLOW_ID]: {
    productType: "background",
    productKey: DOTTED_GLOW_ID,
    displayName: DOTTED_GLOW_NAME,
    unitAmount: 100,
    currency: "usd",
    availableForPurchase: true,
  },
}

function emptySnapshot(overrides: Partial<CommerceSnapshot> = {}): CommerceSnapshot {
  return {
    creditBalance: 2,
    ownedBackgroundIds: [],
    ownerships: [],
    cart: {
      items: [],
      reservedOrder: null,
      subtotalAmount: 0,
      currency: "usd",
      notices: [],
    },
    recentOrders: [],
    ...overrides,
  }
}

function recalculateCart(snapshot: CommerceSnapshot) {
  snapshot.cart.subtotalAmount = snapshot.cart.items.reduce((sum, item) => sum + item.unitAmount, 0)
}

/** Installs database-free session, entitlement, and commerce routes for browser QA. */
async function installCommerceFixture({
  context,
  page,
  baseURL,
  initialSnapshot = emptySnapshot(),
  featureKeys = [],
  fulfillAfterReads,
  failRedemptionRefresh = false,
  startPreferenceAccessUnavailable = false,
  installServerSessionCookie = true,
  sessionResponseDelayMs = 0,
  preferenceResponseDelayMs = 0,
}: {
  context: BrowserContext
  page: Page
  baseURL: string
  initialSnapshot?: CommerceSnapshot
  featureKeys?: string[]
  fulfillAfterReads?: number
  failRedemptionRefresh?: boolean
  startPreferenceAccessUnavailable?: boolean
  installServerSessionCookie?: boolean
  sessionResponseDelayMs?: number
  preferenceResponseDelayMs?: number
}) {
  if (installServerSessionCookie) {
    await installSignedInSessionCookie(context, baseURL, {
      id: USER_ID,
      name: "Commerce QA",
      email: "commerce-qa@example.invalid",
    })
  }
  const snapshot = structuredClone(initialSnapshot)
  let snapshotReads = 0
  let redemptionRefreshPending = false
  let redemptionRefreshFailures = 0
  let preferenceAccessFailures = 0
  let preferenceAccessSuccesses = 0
  let sessionResponseCompletions = 0
  let preferenceRequestsBeforeSessionCompletion = 0
  let preferenceAccessUnavailable = startPreferenceAccessUnavailable
  const checkoutBodies: Array<Record<string, unknown>> = []

  // Signed-in shell links may prefetch Account routes, whose server loaders are
  // intentionally outside this database-free client-surface fixture.
  await page.route((url) => url.pathname === "/account", async (route) => {
    await route.abort()
  })
  await page.route("**/api/auth/session", async (route) => {
    if (sessionResponseDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sessionResponseDelayMs))
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: USER_ID, email: "commerce-qa@example.invalid", emailVerified: true },
      }),
    })
    sessionResponseCompletions += 1
  })
  await page.route("**/api/account/preferences", async (route) => {
    const request = route.request()
    if (request.method() === "GET") {
      if (sessionResponseCompletions === 0) {
        preferenceRequestsBeforeSessionCompletion += 1
      }
      if (preferenceResponseDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, preferenceResponseDelayMs))
      }
      if (preferenceAccessUnavailable) {
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
        preferenceAccessFailures += 1
        return
      }
    }
    const chimerSettings = request.method() === "PUT"
      ? ((await request.postDataJSON()) as { chimerSettings?: unknown }).chimerSettings ?? {}
      : {}

    // Preference writes return the submitted, server-sanitized snapshot plus
    // authoritative access. Keep this fixture production-shaped so initial
    // device seeding cannot look like a server-side reset.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessAuthoritative: true,
        features: featureKeys,
        ownedBackgroundIds: snapshot.ownedBackgroundIds,
        chimerSettings,
        appSettings: {},
      }),
    })
    if (request.method() === "GET") preferenceAccessSuccesses += 1
  })
  await page.route("**/api/calendar/sidebar-context", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        practice: null,
        therapists: [],
        canManageAvailability: false,
        pendingAppointmentRequestCount: 0,
        openWaitlistEntryCount: 0,
      }),
    })
  })
  await page.route((url) => url.pathname.startsWith("/api/background-commerce"), async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()

    if ((path === "/api/background-commerce" || path === "/api/background-commerce/state") && method === "GET") {
      snapshotReads += 1
      if (failRedemptionRefresh && redemptionRefreshPending) {
        redemptionRefreshPending = false
        redemptionRefreshFailures += 1
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
        return
      }
      if (fulfillAfterReads && snapshotReads >= fulfillAfterReads) {
        snapshot.ownedBackgroundIds = [AURORA_ID]
        snapshot.ownerships = [{
          backgroundId: AURORA_ID,
          source: "purchase",
          status: "active",
          acquiredAt: "2026-07-22T12:00:00.000Z",
        }]
        snapshot.cart.items = []
        snapshot.cart.reservedOrder = null
        snapshot.recentOrders = [{ id: "order-safe", status: "PAID", returnPath: "/clock?panel=background" }]
        recalculateCart(snapshot)
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot) })
      return
    }

    const body = request.postDataJSON() as Record<string, unknown> | null
    if (path === "/api/background-commerce/cart" && method === "POST") {
      const backgroundId = String(body?.backgroundId ?? "")
      const item = PRODUCTS[backgroundId]
      if (item && !snapshot.cart.items.some((candidate) => candidate.productKey === backgroundId)) {
        snapshot.cart.items.push(item)
        recalculateCart(snapshot)
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      return
    }
    if (path === "/api/background-commerce/cart" && method === "DELETE") {
      const backgroundId = String(body?.backgroundId ?? "")
      snapshot.cart.items = snapshot.cart.items.filter((item) => item.productKey !== backgroundId)
      recalculateCart(snapshot)
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      return
    }
    if (path === "/api/background-commerce/credits/redeem" && method === "POST") {
      const backgroundId = String(body?.backgroundId ?? "")
      snapshot.creditBalance = Math.max(0, snapshot.creditBalance - 1)
      snapshot.ownedBackgroundIds = [...new Set([...snapshot.ownedBackgroundIds, backgroundId])]
      snapshot.ownerships = snapshot.ownerships.filter((entry) => entry.backgroundId !== backgroundId)
      snapshot.ownerships.push({
        backgroundId,
        source: "credit",
        status: "active",
        acquiredAt: "2026-07-22T12:00:00.000Z",
      })
      snapshot.cart.items = snapshot.cart.items.filter((item) => item.productKey !== backgroundId)
      recalculateCart(snapshot)
      redemptionRefreshPending = true
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      return
    }
    if (path === "/api/background-commerce/checkout" && method === "POST") {
      checkoutBodies.push(body ?? {})
      await new Promise((resolve) => setTimeout(resolve, 100))
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "TAX_NOT_READY",
        }),
      })
      return
    }
    if (path === "/api/background-commerce/checkout/cancel" && method === "POST") {
      snapshot.cart.reservedOrder = null
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      return
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  })

  return {
    snapshot,
    checkoutBodies,
    getSnapshotReads: () => snapshotReads,
    getRedemptionRefreshFailures: () => redemptionRefreshFailures,
    getPreferenceAccessFailures: () => preferenceAccessFailures,
    getPreferenceAccessSuccesses: () => preferenceAccessSuccesses,
    getSessionResponseCompletions: () => sessionResponseCompletions,
    getPreferenceRequestsBeforeSessionCompletion: () => preferenceRequestsBeforeSessionCompletion,
    restorePreferenceAccess: () => { preferenceAccessUnavailable = false },
  }
}

async function installGuestFixture(page: Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: null, expires: null }),
    })
  })
  await page.route("**/api/account/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ features: [], chimerSettings: {}, appSettings: {} }),
    })
  })
  await page.route((url) => url.pathname.startsWith("/api/background-commerce"), async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
    throw new Error("Guest cart must not call account commerce APIs before sign-in")
  })
}

async function openClockBackground(page: Page, href = "/clock") {
  await page.goto(href, { waitUntil: "domcontentloaded" })
  const backgroundPanel = page.getByRole("dialog", { name: "Background" })
  const panelRequested = new URL(href, "http://massagelab.local").searchParams.get("panel") === "background"
  // The router opens a URL-requested panel; clicking its toggle again would
  // close or otherwise change the state the caller is trying to exercise.
  if (!panelRequested) {
    await expect(page.getByLabel("Chimer clock")).toBeVisible()
    await page.getByRole("button", { name: "Background", exact: true }).click()
  }
  await expect(backgroundPanel).toBeVisible()
}

async function centerPremium(page: Page, backgroundId: string) {
  const slide = await centerCarouselItem(page, backgroundId, "Next background")
  await expect(slide).toHaveAttribute("data-centered", "true")
  return slide
}

function accessCard(slide: Awaited<ReturnType<typeof centerPremium>>) {
  return slide
    .locator("xpath=ancestor::section[@aria-label='Background carousel']")
    .getByTestId("background-carousel-controls")
}

async function openChimerAfterPreferenceSeed(page: Page) {
  const preferenceSeed = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/account/preferences"
      && response.request().method() === "PUT"
      && response.ok())
  await page.goto("/chimer", { waitUntil: "domcontentloaded" })
  // The signed-in fixture starts with no saved Chimer preference. Let the
  // initial device seed settle before editing so the test does not race the
  // authoritative response that hydration is specifically designed to adopt.
  await preferenceSeed
}

async function startActiveChimer(page: Page) {
  await openChimerAfterPreferenceSeed(page)
  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole("button", { name: /^Continue$/i }).click()
  }
  await page.getByRole("button", { name: /^Start Chimer$/i }).click()
  await expect(page.getByLabel("Running Chimer timer")).toBeVisible()
}

async function openMusicBackground(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("massagelab-atmosphere-v2", JSON.stringify({
      version: 2,
      favorites: ["tone-proof-drone"],
      recentStations: ["tone-proof-drone"],
      volume: 0.4,
      miniPlayerCollapsed: false,
      visualizer: { backgroundId: null, showClock: false },
      migrations: { legacyMusicBackground: true },
    }))
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("heading", { name: /Atmosphere audio stations/i, includeHidden: true }),
  ).toBeAttached()
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const playerToolbar = page.getByTestId("music-player-toolbar")
  await expect(playerToolbar).toBeVisible({ timeout: 30_000 })
  await expect(playerToolbar.getByText("MassageLab Proof Drone")).toBeVisible()
  await playerToolbar.getByRole("link", { name: /^Background$/i }).click()
  await expect(page).toHaveURL(/\/clock\?[^#]*source=music/)
  await expect(page.getByLabel("Music visualizer")).toBeVisible()
  await expect(page.getByRole("dialog", { name: "Background" })).toBeVisible()
}

test("guest cart persists locally and requires an account only at checkout", async ({ page }) => {
  await installGuestFixture(page)
  await openClockBackground(page, "/clock?source=music&returnTo=%2Fmusic&panel=background")
  const backgroundPanel = page.getByRole("dialog", { name: "Background" })
  const guestAurora = await centerPremium(page, AURORA_ID)

  const guestUnlock = backgroundPanel.getByRole("button", { name: `Unlock ${AURORA_NAME} background` })
  await expect(guestUnlock).toBeEnabled()
  await expect(guestUnlock).toHaveAttribute(
    "title",
    "Add this background now, then sign in or create an account at checkout.",
  )
  await expect(accessCard(guestAurora)).toContainText(
    "Add this background now, then sign in or create an account at checkout.",
  )
  await guestUnlock.click()
  const acquisition = page.getByRole("dialog", { name: `Unlock ${AURORA_NAME}` })
  await expect(acquisition.getByRole("button", { name: "Use free credit" })).toBeDisabled()
  await expect(acquisition).toContainText(
    "Sign in at checkout to use account credits. You can still add this background to your cart now.",
  )
  await acquisition.getByRole("button", { name: "Buy for $1" }).click()

  const compactCart = backgroundPanel.getByRole("region", { name: "MassageLab cart" })
  await expect(compactCart).toContainText(AURORA_NAME)
  await expect(compactCart.getByRole("button", { name: "Review checkout" })).toHaveCount(0)
  const signInLink = compactCart.getByRole("link", { name: "Sign in to checkout" })
  const registerLink = compactCart.getByRole("link", { name: "Create account" })
  await expect(signInLink).toHaveAttribute(
    "href",
    "/login?callbackUrl=%2Fclock%3Fsource%3Dmusic%26returnTo%3D%252Fmusic%26panel%3Dbackground",
  )
  await expect(registerLink).toHaveAttribute(
    "href",
    "/register?callbackUrl=%2Fclock%3Fsource%3Dmusic%26returnTo%3D%252Fmusic%26panel%3Dbackground",
  )

  await page.reload({ waitUntil: "domcontentloaded" })
  const trigger = page.locator("[data-commerce-cart-trigger]:visible")
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(trigger).toHaveAccessibleName("Open MassageLab cart with 1 item")
  await trigger.click()
  const cartDialog = page.getByRole("dialog", { name: "MassageLab cart" })
  await expect(cartDialog).toContainText("This cart is saved in this browser until you sign in.")
  await expect(cartDialog).toContainText(AURORA_NAME)
  await expect(cartDialog.getByRole("link", { name: "Sign in to checkout" })).toHaveAttribute(
    "href",
    "/login?callbackUrl=%2Fmusic%3FcommerceCart%3Dopen",
  )
  await page.keyboard.press("Escape")

  await page.evaluate(() => window.history.pushState({}, "", "/calendar"))
  await expect(trigger).toHaveCount(0)
})

test("signed-in cart return marker opens once and is consumed", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  await installCommerceFixture({
    context,
    page,
    baseURL,
    initialSnapshot: emptySnapshot({
      cart: {
        items: [PRODUCTS[AURORA_ID]],
        reservedOrder: null,
        subtotalAmount: 100,
        currency: "usd",
        notices: [],
      },
    }),
  })

  await page.goto("/clock?commerceCart=open", { waitUntil: "domcontentloaded" })
  const accountCart = page.getByRole("dialog", { name: "Account cart" })
  await expect(accountCart).toBeVisible()
  await expect(page).toHaveURL(/\/clock$/)
  await page.keyboard.press("Escape")
  await expect(accountCart).toHaveCount(0)

  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await page.goBack({ waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL(/\/clock$/)
  await expect(accountCart).toHaveCount(0)

  await page.goto("/calendar?commerceCart=open", { waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(accountCart).toHaveCount(0)
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(accountCart).toHaveCount(0)
})

test("Clock redeems one explicit permanent credit and keeps the nested dialog focus order", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  await installCommerceFixture({ context, page, baseURL })
  await openClockBackground(page)
  const backgroundPanel = page.getByRole("dialog", { name: "Background" })
  const aurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(aurora)).toHaveAttribute("data-background-access-state", "locked-credit-available")

  await backgroundPanel.getByRole("button", { name: `Unlock ${AURORA_NAME} background` }).click()
  const acquisition = page.getByRole("dialog", { name: `Unlock ${AURORA_NAME}` })
  await expect(acquisition.getByRole("button", { name: "Use free credit" })).toBeVisible()
  await expect(acquisition.getByRole("button", { name: "Buy for $1" })).toBeVisible()
  await expect(acquisition.getByRole("link", { name: "Unlock all" })).toBeVisible()

  await acquisition.getByRole("button", { name: "Use free credit" }).click()
  const confirmation = page.getByRole("dialog", { name: `Keep ${AURORA_NAME} permanently` })
  await expect(confirmation).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(confirmation).toHaveCount(0)
  await expect(backgroundPanel).toBeVisible()

  await expect(acquisition).toBeVisible()
  await acquisition.getByRole("button", { name: "Use free credit" }).click()
  await page.getByRole("checkbox", { name: /permanent, non-swappable/i }).check()
  await page.getByRole("button", { name: "Use credit", exact: true }).click()

  await expect(backgroundPanel).toHaveCount(0)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await expect(backgroundPanel).toBeVisible()
  await expect(backgroundPanel.getByRole("status").filter({ hasText: "1 credit" })).toBeVisible()
  const ownedAurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(ownedAurora)).toHaveAttribute("data-background-access-state", "owned-credit")
  await expect(accessCard(ownedAurora).getByText("Owned")).toBeVisible()
  await expect(accessCard(ownedAurora).getByRole("img", {
    name: `${AURORA_NAME} is permanently owned`,
  })).toBeVisible()
  await expect(accessCard(ownedAurora).getByRole("button", {
    name: `Selected ${AURORA_NAME} background`,
  })).toBeVisible()
})

test("Chimer selects a newly redeemed background before account ownership reloads", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  await installCommerceFixture({ context, page, baseURL })
  await startActiveChimer(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  const panel = page.getByRole("dialog", { name: "Background" })
  await centerPremium(page, AURORA_ID)
  await panel.getByRole("button", { name: `Unlock ${AURORA_NAME} background` }).click()
  await page.getByRole("dialog", { name: `Unlock ${AURORA_NAME}` })
    .getByRole("button", { name: "Use free credit" })
    .click()
  await page.getByRole("checkbox", { name: /permanent, non-swappable/i }).check()
  await page.getByRole("button", { name: "Use credit", exact: true }).click()

  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    AURORA_ID,
  )
  await page.getByRole("button", { name: "Background", exact: true }).click()
  const ownedAurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(ownedAurora).getByRole("button", {
    name: `Selected ${AURORA_NAME} background`,
  })).toBeVisible()
})

test("pre-timer Chimer setup selects a newly redeemed background when ownership refresh fails", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  const fixture = await installCommerceFixture({
    context,
    page,
    baseURL,
    failRedemptionRefresh: true,
  })
  await openChimerAfterPreferenceSeed(page)
  await page.getByRole("button", { name: /^Increase minutes$/i }).click()
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: /^Continue$/i }).click()
  }

  const aurora = await centerPremium(page, AURORA_ID)
  await accessCard(aurora).getByRole("button", { name: `Unlock ${AURORA_NAME} background` }).click()
  await page.getByRole("dialog", { name: `Unlock ${AURORA_NAME}` })
    .getByRole("button", { name: "Use free credit" })
    .click()
  await page.getByRole("checkbox", { name: /permanent, non-swappable/i }).check()
  await page.getByRole("button", { name: "Use credit", exact: true }).click()

  const selectedAurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(selectedAurora).getByRole("button", {
    name: `Selected ${AURORA_NAME} background`,
  })).toBeVisible()
  await page.getByRole("button", { name: /^Continue$/i }).click()
  await page.getByRole("button", { name: /^Start Chimer$/i }).click()
  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    AURORA_ID,
  )
  expect(fixture.getRedemptionRefreshFailures()).toBe(1)
})

test("Music selects a newly redeemed background before account ownership reloads", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  await installCommerceFixture({ context, page, baseURL })
  await openMusicBackground(page)
  const panel = page.getByRole("dialog", { name: "Background" })
  await centerPremium(page, AURORA_ID)
  await panel.getByRole("button", { name: `Unlock ${AURORA_NAME} background` }).click()
  await page.getByRole("dialog", { name: `Unlock ${AURORA_NAME}` })
    .getByRole("button", { name: "Use free credit" })
    .click()
  await page.getByRole("checkbox", { name: /permanent, non-swappable/i }).check()
  await page.getByRole("button", { name: "Use credit", exact: true }).click()

  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId("chimer-premium-background")).toHaveAttribute(
    "data-background-id",
    AURORA_ID,
  )
  await page.getByRole("button", { name: "Background", exact: true }).click()
  const ownedAurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(ownedAurora).getByRole("button", {
    name: `Selected ${AURORA_NAME} background`,
  })).toBeVisible()
})

test("zero-credit cart persists across refresh and checkout failure keeps one submission", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  const fixture = await installCommerceFixture({
    context,
    page,
    baseURL,
    initialSnapshot: emptySnapshot({ creditBalance: 0 }),
  })
  await openClockBackground(page)
  const panel = page.getByRole("dialog", { name: "Background" })
  await centerPremium(page, DOTTED_GLOW_ID)
  await panel.getByRole("button", { name: `Unlock ${DOTTED_GLOW_NAME} background` }).click()
  const acquisition = page.getByRole("dialog", { name: `Unlock ${DOTTED_GLOW_NAME}` })
  await expect(acquisition.getByRole("button", { name: "Use free credit" })).toBeDisabled()
  await expect(acquisition.getByText(/You have 0 credits\./)).toBeVisible()
  await acquisition.getByRole("button", { name: "Buy for $1" }).click()

  const cart = panel.getByRole("region", { name: "Account cart" })
  await expect(cart).toContainText("1 background")
  await expect(cart).toContainText(DOTTED_GLOW_NAME)
  await cart.getByRole("button", { name: "Review checkout" }).click()
  const review = page.getByRole("dialog", { name: "Review checkout" })
  await expect(review.getByText("Purchases are U.S. only in this release.")).toBeVisible()
  await expect(review.getByText("$1.00", { exact: true })).toHaveCount(2)
  const continueButton = review.getByRole("button", { name: "Continue to Checkout" })
  await expect(continueButton).toBeDisabled()
  await review.getByRole("checkbox", { name: /immediate digital delivery/i }).check()
  await continueButton.dblclick()
  await expect(review.getByRole("alert")).toContainText("temporarily unavailable")
  expect(fixture.checkoutBodies).toHaveLength(1)
  expect(fixture.checkoutBodies[0]).toMatchObject({
    combinedConsentAccepted: true,
    purchaseCountry: "US",
    returnPath: "/clock?panel=background",
  })

  await review.getByRole("button", { name: "Back to cart" }).click()
  await expect(cart).toContainText(DOTTED_GLOW_NAME)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Background", exact: true }).click()
  await expect(page.getByRole("region", { name: "Account cart" })).toContainText(DOTTED_GLOW_NAME)
})

test("cancel return reopens the originating Background panel with the account cart intact", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  await installCommerceFixture({
    context,
    page,
    baseURL,
    initialSnapshot: emptySnapshot({
      creditBalance: 0,
      cart: {
        items: [PRODUCTS[AURORA_ID]],
        reservedOrder: null,
        subtotalAmount: 100,
        currency: "usd",
        notices: [],
      },
    }),
  })
  await page.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, JSON.stringify(value))
  }, {
    key: RETURN_STORAGE_KEY,
    value: { returnPath: "/clock?panel=background", backgroundIds: [AURORA_ID] },
  })

  await page.goto("/clock?panel=background&backgroundPurchase=cancelled", {
    waitUntil: "domcontentloaded",
  })
  const panel = page.getByRole("dialog", { name: "Background" })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole("region", { name: "Account cart" })).toContainText(AURORA_NAME)
  await expect(page.getByRole("dialog", { name: "Returning to your cart..." })).toHaveCount(0)
})

test("subscriber and purchased ownership stay distinct in active Chimer", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  await installCommerceFixture({
    context,
    page,
    baseURL,
    featureKeys: ["premium_backgrounds"],
    initialSnapshot: emptySnapshot({
      creditBalance: 1,
      ownedBackgroundIds: [DOTTED_GLOW_ID],
      ownerships: [{
        backgroundId: DOTTED_GLOW_ID,
        source: "purchase",
        status: "active",
        acquiredAt: "2026-07-22T12:00:00.000Z",
      }],
    }),
  })
  await startActiveChimer(page)
  await page.getByRole("button", { name: "Background", exact: true }).click()
  const panel = page.getByRole("dialog", { name: "Background" })

  const aurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(aurora)).toHaveAttribute("data-background-access-state", "included-subscription")
  await expect(accessCard(aurora)).toContainText("Included with membership")
  await page.setViewportSize({ width: 360, height: 780 })
  const responsiveAurora = await centerPremium(page, AURORA_ID)
  const responsiveCard = accessCard(responsiveAurora)
  const favorite = responsiveCard.locator("[data-carousel-favorite-action]")
  const permanentPurchase = responsiveCard.getByRole("button", {
    name: `Open permanent ownership options for ${AURORA_NAME}`,
  })
  await expect(favorite).toBeVisible()
  await expect(permanentPurchase).toBeVisible()
  const [cardBox, favoriteBox, keepBox] = await Promise.all([
    responsiveCard.boundingBox(),
    favorite.boundingBox(),
    permanentPurchase.boundingBox(),
  ])
  expect(cardBox).not.toBeNull()
  expect(favoriteBox).not.toBeNull()
  expect(keepBox).not.toBeNull()
  // At 360px, the compact ownership action and favorite must not overlap.
  expect(
    keepBox!.x + keepBox!.width <= favoriteBox!.x
    || favoriteBox!.x + favoriteBox!.width <= keepBox!.x
    || keepBox!.y + keepBox!.height <= favoriteBox!.y
    || favoriteBox!.y + favoriteBox!.height <= keepBox!.y,
  ).toBe(true)
  for (const controlBox of [favoriteBox!, keepBox!]) {
    expect(controlBox.x).toBeGreaterThanOrEqual(cardBox!.x)
    expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1)
    expect(controlBox.y).toBeGreaterThanOrEqual(cardBox!.y)
    expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1)
  }
  await permanentPurchase.click()
  const keep = page.getByRole("dialog", { name: `Keep ${AURORA_NAME} permanently` })
  await expect(keep).toContainText("even if you later cancel")
  await expect(keep.getByRole("button", { name: "Buy permanently for $1" })).toBeVisible()
  await expect(keep.getByRole("link", { name: "Unlock all" })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(panel).toBeVisible()

  const purchased = await centerPremium(page, DOTTED_GLOW_ID)
  await expect(accessCard(purchased)).toHaveAttribute("data-background-access-state", "owned-purchase")
  await expect(accessCard(purchased)).toContainText("Purchased")
  await expect(accessCard(purchased).getByRole("img", {
    name: `${DOTTED_GLOW_NAME} is permanently owned`,
  })).toBeVisible()
  await expect(accessCard(purchased).getByRole("button", {
    name: `Open permanent ownership options for ${DOTTED_GLOW_NAME}`,
  })).toHaveCount(0)
  await accessCard(purchased).getByRole("button", { name: `Select ${DOTTED_GLOW_NAME} background` }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByLabel("Running Chimer timer")).toBeVisible()
})

test("returning signed-in Clock retries subscription access after a wake-time preference failure", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  const fixture = await installCommerceFixture({
    context,
    page,
    baseURL,
    featureKeys: ["premium_backgrounds"],
    startPreferenceAccessUnavailable: true,
  })

  await openClockBackground(page)
  const aurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(aurora)).toHaveAttribute(
    "data-background-access-state",
    "locked-credit-available",
  )

  await expect.poll(fixture.getPreferenceAccessFailures).toBeGreaterThan(0)
  const failuresBeforeFocus = fixture.getPreferenceAccessFailures()
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(fixture.getPreferenceAccessFailures).toBeGreaterThan(failuresBeforeFocus)

  const successesBeforeWake = fixture.getPreferenceAccessSuccesses()
  fixture.restorePreferenceAccess()
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))

  await expect.poll(fixture.getPreferenceAccessSuccesses).toBeGreaterThan(successesBeforeWake)
  const refreshedAurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(refreshedAurora)).toHaveAttribute(
    "data-background-access-state",
    "included-subscription",
  )
})

test("newly signed-in Clock waits for a cold subscription response without Account navigation", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  const fixture = await installCommerceFixture({
    context,
    page,
    baseURL,
    featureKeys: ["premium_backgrounds"],
    // Keep the server-rendered shell database-free while the client receives
    // the same signed-in session and authoritative access contract as Production.
    installServerSessionCookie: false,
    preferenceResponseDelayMs: 2_000,
  })

  await openClockBackground(page)
  await expect.poll(fixture.getPreferenceAccessSuccesses).toBeGreaterThan(0)

  const aurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(aurora)).toHaveAttribute(
    "data-background-access-state",
    "included-subscription",
  )
})

test("newly signed-in Clock waits for a cold session response before loading subscription access", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  const fixture = await installCommerceFixture({
    context,
    page,
    baseURL,
    featureKeys: ["premium_backgrounds"],
    installServerSessionCookie: false,
    sessionResponseDelayMs: 2_000,
  })

  await openClockBackground(page)
  await expect.poll(fixture.getPreferenceAccessSuccesses).toBeGreaterThan(0)
  expect(fixture.getSessionResponseCompletions()).toBeGreaterThan(0)
  expect(fixture.getPreferenceRequestsBeforeSessionCompletion()).toBe(0)

  const aurora = await centerPremium(page, AURORA_ID)
  await expect(accessCard(aurora)).toHaveAttribute(
    "data-background-access-state",
    "included-subscription",
  )
})

test("Music visualizer keeps the shared account cart through minimize and restore", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  await installCommerceFixture({
    context,
    page,
    baseURL,
    initialSnapshot: emptySnapshot({ creditBalance: 0 }),
  })
  await page.addInitScript(() => {
    localStorage.setItem("massagelab-atmosphere-v2", JSON.stringify({
      version: 2,
      favorites: ["tone-proof-drone"],
      recentStations: [],
      volume: 0.4,
      miniPlayerCollapsed: false,
      visualizer: { backgroundId: null, showClock: false },
      migrations: { legacyMusicBackground: true },
    }))
  })

  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  const playerToolbar = page.getByTestId("music-player-toolbar")
  await expect(playerToolbar).toBeVisible({ timeout: 30_000 })
  await playerToolbar.getByRole("link", { name: /^Background$/i }).click()
  await expect(page).toHaveURL(/\/clock\?[^#]*source=music/)
  await expect(page.getByLabel("Music visualizer")).toBeVisible()

  const panel = page.getByRole("dialog", { name: "Background" })
  await expect(panel).toBeVisible()
  await centerPremium(page, AURORA_ID)
  await panel.getByRole("button", { name: `Unlock ${AURORA_NAME} background` }).click()
  await page.getByRole("dialog", { name: `Unlock ${AURORA_NAME}` })
    .getByRole("button", { name: "Buy for $1" })
    .click()
  await expect(panel.getByRole("region", { name: "Account cart" })).toContainText(AURORA_NAME)

  await panel.getByRole("button", { name: "Close Background panel" }).click()
  await page.getByRole("button", { name: /^Minimize visualizer$/i }).last().click()
  await expect(page).toHaveURL(/\/music$/)
  await expect(page.locator("[data-commerce-cart-trigger]:visible"))
    .toHaveAccessibleName("Open account cart with 1 item")

  await page.getByTestId("music-player-toolbar").getByRole("link", { name: /^Background$/i }).click()
  await expect(page).toHaveURL(/\/clock\?[^#]*source=music/)
  const restoredPanel = page.getByRole("dialog", { name: "Background" })
  await expect(restoredPanel.getByRole("region", { name: "Account cart" })).toContainText(AURORA_NAME)
})

test("global account cart is discoverable off Calendar and opens the shared cart", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  await installCommerceFixture({
    context,
    page,
    baseURL,
    initialSnapshot: emptySnapshot({
      cart: {
        items: [PRODUCTS[AURORA_ID]],
        reservedOrder: null,
        subtotalAmount: 100,
        currency: "usd",
        notices: [],
      },
    }),
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const trigger = page.locator("[data-commerce-cart-trigger]:visible")
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveAccessibleName("Open account cart with 1 item")
  await trigger.click()
  const cartDialog = page.getByRole("dialog", { name: "Account cart" })
  await expect(cartDialog).toContainText(AURORA_NAME)
  await page.keyboard.press("Escape")
  await expect(cartDialog).toHaveCount(0)

  await page.evaluate(() => {
    window.history.pushState({}, "", "/calendar")
  })
  await expect(trigger).toHaveCount(0)
})

test("success return waits for a refreshed server snapshot before confirming ownership", async ({ context, page }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL)
  const fixture = await installCommerceFixture({
    context,
    page,
    baseURL,
    fulfillAfterReads: 3,
    initialSnapshot: emptySnapshot({
      creditBalance: 0,
      cart: {
        items: [PRODUCTS[AURORA_ID]],
        reservedOrder: {
          orderId: "order-safe",
          expiresAt: "2026-07-22T12:30:00.000Z",
        },
        subtotalAmount: 100,
        currency: "usd",
        notices: [],
      },
      recentOrders: [{ id: "order-safe", status: "AWAITING_PAYMENT", returnPath: "/clock?panel=background" }],
    }),
  })
  await page.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, JSON.stringify(value))
  }, {
    key: RETURN_STORAGE_KEY,
    value: { returnPath: "/clock?panel=background", backgroundIds: [AURORA_ID] },
  })
  await page.goto("/clock?backgroundPurchase=success&orderId=order-safe", {
    waitUntil: "domcontentloaded",
  })
  const returnDialog = page.getByRole("dialog")
  await expect(returnDialog.getByRole("heading", { name: "Confirming purchase..." })).toBeVisible()
  await expect(returnDialog).toContainText("Access appears only after server confirmation.")
  await expect(returnDialog.getByRole("heading", { name: "Purchase confirmed" })).toBeVisible({ timeout: 10_000 })
  expect(fixture.getSnapshotReads()).toBeGreaterThanOrEqual(3)
  await expect(returnDialog).toContainText("Server-confirmed permanent access is ready.")
  expect(page.url()).not.toMatch(/session_id|payment_intent|charge|dispute/i)
})
