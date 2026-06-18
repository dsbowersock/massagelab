import { expect, test, type Page, type Response } from "@playwright/test"

const publicRoutes = [
  { path: "/", expectedText: /MassageLab/i },
  { path: "/notes", expectedText: /Therapist or Team\/Practice required/i },
  { path: "/notes/soap", expectedText: /Therapist membership required/i },
  { path: "/chimer", expectedText: /Chimer/i },
  { path: "/browse", expectedText: /Wellness audio stations/i },
  { path: "/wellness", expectedText: /Client-owned self-tracking/i },
  { path: "/wellness/atmosphere", expectedText: /Wellness audio stations/i },
  { path: "/calendar", expectedText: /Calendar/i },
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

test("anonymous homepage presents the optional action router and available tools catalog", async ({ page }) => {
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

  await expect(page.getByRole("heading", { name: "Available tools" })).toBeVisible()
  for (const name of [
    "Chimer",
    "Atmosphere",
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
  await expect(availableTools.getByRole("link", { name: /Open Atmosphere/i })).toHaveAttribute("href", "/wellness/atmosphere")
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

test("Atmosphere proof station keeps global player state across client routes", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/wellness/atmosphere", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: /Wellness audio stations/i })).toBeVisible()
  await expect(page.getByText("Breathing guide")).toBeVisible()
  await page.getByRole("button", { name: /^Start breathing$/i }).click()
  await expect(page.getByRole("button", { name: /^Pause breathing$/i })).toBeVisible()
  await page.getByRole("button", { name: /^Reset breathing$/i }).click()
  await page.getByRole("button", { name: /^Play station$/i }).first().click()

  await expect(page.getByText("MassageLab Proof Drone").last()).toBeVisible()
  await expect(page.getByText(/Playing|Loading station/i).last()).toBeVisible()

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
  await page.getByRole("button", { name: /^Stop$/i }).last().click()
  await expect(page.getByText("MassageLab Proof Drone").last()).toHaveCount(0)

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("Atmosphere lists the Generative.fm catalog and starts a hosted-sample station", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/wellness/atmosphere", { waitUntil: "domcontentloaded" })
  await expect(page.getByText(/1 Generative\.fm station.+56 Generative\.fm stations/i)).toBeVisible()
  const observableStreamsStation = page.locator("#station-observable-streams-probe")
  await expect(observableStreamsStation.getByText("Observable Streams", { exact: true })).toBeVisible()
  await expect(observableStreamsStation.getByText("Playable")).toBeVisible()
  await expect(page.getByText("aisatsana (generative remix)").first()).toBeVisible()
  await expect(page.getByText("Zed").first()).toBeVisible()
  await expect(page.getByText("Samples pending").first()).toBeVisible()
  await expect(page.getByText("Needs hosted samples before playback: zed__pad, zed__noise.")).toBeVisible()

  await observableStreamsStation.getByRole("button", { name: /^Play station$/i }).click()
  await expect(observableStreamsStation.getByRole("button", { name: /^Restart station$/i })).toBeVisible({ timeout: 45_000 })
  await expect(observableStreamsStation.getByRole("button", { name: /^Stop$/i })).toBeVisible({ timeout: 45_000 })
  await observableStreamsStation.getByRole("button", { name: /^Stop$/i }).click()
  await expect(page.getByText(/Playing|Loading station/i)).toHaveCount(0)

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

test("register defaults new accounts toward post-account onboarding", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/register", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("button", { name: /Create account/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Back to login/i })).toHaveAttribute("href", "/login?callbackUrl=%2Fonboarding")

  expect(health.pageErrors, "uncaught page errors").toEqual([])
  expect(health.consoleErrors, "browser console errors").toEqual([])
  expect(health.failedLocalResponses, "local 4xx/5xx responses").toEqual([])
  expect(health.forbiddenRequests, "anonymous account sync requests").toEqual([])
})

test("homepage uses one logo artwork for light and dark themes", async ({ page }) => {
  const health = capturePageHealth(page)

  await page.goto("/", { waitUntil: "domcontentloaded" })

  const logo = page.getByTestId("home-brand-wordmark-image")
  await expect(logo).toHaveAttribute("src", /massagelab-home-logo-badge-padded-20260615/)
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
  await expect(page.getByRole("group", { name: /Shared game code TEST01/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /Join Shared Game/i })).toHaveAttribute("href", "/anatomime/join")
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
        error: "Shared games need database access in this Vercel environment before they can be created.",
      }),
    })
  })

  await page.goto("/anatomime", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /Choose Anatomy Terms/i }).click()
  await page.getByRole("button", { name: /Create Shared Game/i }).click()

  await expect(page.getByRole("button", { name: /Create Shared Game/i })).toBeVisible()
  await expect(page.getByText(/Shared games need database access in this Vercel environment/i)).toBeVisible()
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
  await expect(page.getByRole("group", { name: /Multiple choice answers/i })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Scapula" })).toHaveCount(0)

  currentSession = makeSession(true)
  await page.reload({ waitUntil: "domcontentloaded" })
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
