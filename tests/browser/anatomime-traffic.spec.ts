import { expect, test, type Page, type Route } from "@playwright/test"

const ROOM_CODE = "TEST01"
const ROOM_PATH = `/api/anatomime/sessions/${ROOM_CODE}`
const TOKEN_PATH = `${ROOM_PATH}/realtime-token`

const teams = [
  { id: "team-1", name: "Team 1", sortOrder: 0, score: 0 },
  { id: "team-2", name: "Team 2", sortOrder: 1, score: 0 },
]

function roomSession({
  status = "LOBBY",
  phase = "LOBBY",
  joined = true,
  host = false,
}: {
  status?: string
  phase?: string
  joined?: boolean
  host?: boolean
} = {}) {
  const viewerId = host ? "host-player" : joined ? "player-1" : null
  const viewerTeamId = host ? null : joined ? "team-1" : null
  const players = [
    {
      id: "host-player",
      teamId: null,
      displayName: "Host",
      signedIn: false,
      isHost: true,
      lastSeenAt: new Date(0).toISOString(),
    },
    ...(joined && !host
      ? [{
          id: "player-1",
          teamId: "team-1",
          displayName: "Avery",
          signedIn: false,
          isHost: false,
          lastSeenAt: new Date(0).toISOString(),
        }]
      : []),
  ]

  return {
    code: ROOM_CODE,
    status,
    phase,
    config: {
      answerMode: "typed",
      clueLevel: "easy",
      roundSeconds: 30,
      termCount: 4,
      roundLimit: 3,
      hardcoreMode: false,
    },
    phaseEndsAt: null,
    reviewExpiresAt: null,
    teams,
    players,
    viewer: { isHost: host, playerId: viewerId, teamId: viewerTeamId },
    activeTeam: teams[0],
    activeItem: null,
    turnReview: [],
    recap: [],
    hostElection: null,
    hostCanBeChallenged: false,
  }
}

async function installPlayerRuntime(page: Page, { storedPlayer = true } = {}) {
  await page.addInitScript(({ roomCode, stored }) => {
    if (stored) {
      window.localStorage.setItem(`massagelab-anatomime-player:${roomCode}`, JSON.stringify({
        playerId: "player-1",
        playerToken: "player-token",
        teamId: "team-1",
      }))
    }
    ;(window as typeof window & { __anatomimeHidden?: boolean }).__anatomimeHidden = false
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (window as typeof window & { __anatomimeHidden?: boolean }).__anatomimeHidden ? "hidden" : "visible",
    })
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => Boolean((window as typeof window & { __anatomimeHidden?: boolean }).__anatomimeHidden),
    })
    Math.random = () => 0
    ;(window as typeof window & { Ably?: unknown }).Ably = {
      Realtime: class {
        channels = { get: () => ({ subscribe() {}, unsubscribe() {} }) }
        close() {}
      },
    }
  }, { roomCode: ROOM_CODE, stored: storedPlayer })
}

async function installNoProviderBoundary(page: Page) {
  let providerRequests = 0
  await page.route("https://cdn.ably.com/**", async (route) => {
    providerRequests += 1
    await route.abort()
  })
  return () => providerRequests
}

async function fulfillJson(route: Route, status: number, body: unknown, headers?: Record<string, string>) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
  })
}

test("player polling uses credential-bound tokens and 2s/5s/15s successful cadence", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page)
  const providerRequests = await installNoProviderBoundary(page)
  let pollCount = 0
  let currentSession = roomSession({ status: "PLAYING", phase: "ACTIVE_TERM" })
  let tokenHeaders: Record<string, string> | null = null
  let tokenBody: string | null = "unexpected"
  let tokenCount = 0

  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    tokenCount += 1
    tokenHeaders = route.request().headers()
    tokenBody = route.request().postData()
    await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    await fulfillJson(route, 200, { session: currentSession })
  })

  await page.goto(`/anatomime/play/${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect.poll(() => pollCount).toBe(1)
  await expect(page.getByText("ACTIVE_TERM", { exact: true })).toBeVisible()
  await expect.poll(() => tokenHeaders).not.toBeNull()
  expect(tokenHeaders?.["x-anatomime-player-id"]).toBe("player-1")
  expect(tokenHeaders?.["x-anatomime-player-token"]).toBe("player-token")
  expect(tokenBody).toBeNull()
  expect(tokenCount).toBe(1)

  currentSession = roomSession({ status: "LOBBY", phase: "LOBBY" })
  await page.clock.fastForward(1_999)
  expect(pollCount).toBe(1)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(2)
  await expect(page.getByText("LOBBY", { exact: true }).first()).toBeVisible()

  currentSession = roomSession({ status: "PLAYING", phase: "ACTIVE_TERM" })
  await page.evaluate(() => {
    ;(window as typeof window & { __anatomimeHidden?: boolean }).__anatomimeHidden = true
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await page.clock.fastForward(4_999)
  expect(pollCount).toBe(2)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(3)
  await expect(page.getByText("ACTIVE_TERM", { exact: true })).toBeVisible()

  await page.clock.fastForward(14_999)
  expect(pollCount).toBe(3)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(4)
  expect(tokenCount).toBe(1)
  expect(providerRequests()).toBe(0)
})

test("player polling backs off through 2/4/8/16/30 seconds and resets after success", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page)
  const providerRequests = await installNoProviderBoundary(page)
  let pollCount = 0

  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    await fulfillJson(route, 503, { error: "Realtime unavailable." })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (pollCount <= 5) {
      await fulfillJson(route, 503, { error: "Temporarily unavailable." })
      return
    }
    await fulfillJson(route, 200, { session: roomSession({ status: "PLAYING", phase: "ACTIVE_TERM" }) })
  })

  await page.goto(`/anatomime/play/${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect.poll(() => pollCount).toBe(1)
  await expect(page.getByText(/Connection interrupted/i)).toBeVisible()

  for (const delay of [2_001, 4_001, 8_001, 16_001, 30_000]) {
    const before = pollCount
    await page.clock.fastForward(delay - 1)
    expect(pollCount).toBe(before)
    await page.clock.fastForward(1)
    await expect.poll(() => pollCount).toBe(before + 1)
  }

  await expect(page.getByText("ACTIVE_TERM", { exact: true })).toBeVisible()
  await page.clock.fastForward(1_999)
  expect(pollCount).toBe(6)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(7)
  expect(providerRequests()).toBe(0)
})

test("player polling honors Retry-After before recovery", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page)
  let pollCount = 0

  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    await fulfillJson(route, 503, { error: "Realtime unavailable." })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (pollCount === 1) {
      await fulfillJson(route, 429, { error: "Slow down." }, { "Retry-After": "7" })
      return
    }
    await fulfillJson(route, 200, { session: roomSession() })
  })

  await page.goto(`/anatomime/play/${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect.poll(() => pollCount).toBe(1)
  await expect(page.getByText(/Trying again in 7 seconds/i)).toBeVisible()
  await page.clock.fastForward(6_999)
  expect(pollCount).toBe(1)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(2)
})

test("successful ended, missing, and rejoin-required responses stop polling with deliberate recovery", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page)
  let responseKind: "expired" | "missing" | "rejoin" = "expired"
  let pollCount = 0

  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    await fulfillJson(route, 503, { error: "Realtime unavailable." })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (responseKind === "expired") {
      await fulfillJson(route, 200, { session: roomSession({ status: "EXPIRED", phase: "GAME_COMPLETE" }) })
      return
    }
    const responseStatus = responseKind === "missing" ? 404 : 403
    await fulfillJson(route, responseStatus, { error: responseStatus === 404 ? "Game not found." : "Join this room." })
  })

  await page.goto(`/anatomime/play/${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Shared game ended" })).toBeVisible()
  await page.clock.fastForward(60_000)
  expect(pollCount).toBe(1)

  responseKind = "missing"
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Shared game ended" })).toBeVisible()
  await page.clock.fastForward(60_000)
  expect(pollCount).toBe(2)

  responseKind = "rejoin"
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Rejoin required" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Clear Saved Player" })).toBeVisible()
  await page.clock.fastForward(60_000)
  expect(pollCount).toBe(3)
})

test("host review polling continues at 5s and stops on a successful ended snapshot", async ({ page }) => {
  await page.clock.install()
  let hostPollCount = 0
  const reviewSession = roomSession({ status: "REVIEW", phase: "GAME_COMPLETE", joined: false, host: true })
  let hostSnapshot = reviewSession

  await page.route((url) => url.pathname === "/api/anatomime/sessions", async (route) => {
    await fulfillJson(route, 201, {
      session: reviewSession,
      host: { playerId: "host-player", token: "host-token" },
    })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    hostPollCount += 1
    await fulfillJson(route, 200, { session: hostSnapshot })
  })

  await page.goto("/anatomime", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /Choose Anatomy Terms/i }).click()
  await page.getByRole("button", { name: /Create Shared Game/i }).click()
  await expect(page.getByText("REVIEW", { exact: true }).first()).toBeVisible()
  await page.clock.fastForward(4_999)
  expect(hostPollCount).toBe(0)
  await page.clock.fastForward(1)
  await expect.poll(() => hostPollCount).toBe(1)
  hostSnapshot = roomSession({ status: "EXPIRED", phase: "GAME_COMPLETE", joined: false, host: true })
  await page.clock.fastForward(5_000)
  await expect.poll(() => hostPollCount).toBe(2)
  await expect(page.getByText("Shared game ended", { exact: true })).toBeVisible()
  await page.clock.fastForward(60_000)
  expect(hostPollCount).toBe(2)
})

test("create honors Retry-After lockout without replaying automatically", async ({ page }) => {
  await page.clock.install()
  let createCount = 0

  await page.route((url) => url.pathname === "/api/anatomime/sessions", async (route) => {
    createCount += 1
    if (createCount === 1) {
      await fulfillJson(route, 429, { error: "Please wait before creating another room." }, { "Retry-After": "3" })
      return
    }
    await fulfillJson(route, 201, {
      session: roomSession({ joined: false, host: true }),
      host: { playerId: "host-player", token: "host-token" },
    })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    await fulfillJson(route, 200, { session: roomSession({ joined: false, host: true }) })
  })

  await page.goto("/anatomime", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /Choose Anatomy Terms/i }).click()
  await page.getByRole("button", { name: /Create Shared Game/i }).click()
  await expect(page.getByRole("button", { name: /Try again in 3s/i })).toBeDisabled()
  expect(createCount).toBe(1)

  await page.clock.fastForward(2_999)
  expect(createCount).toBe(1)
  await page.clock.fastForward(1)
  await expect(page.getByRole("button", { name: /Create Shared Game/i })).toBeEnabled()
  expect(createCount).toBe(1)
  await page.getByRole("button", { name: /Create Shared Game/i }).click()
  await expect.poll(() => createCount).toBe(2)
})

test("join honors Retry-After lockout without replaying automatically", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page, { storedPlayer: false })
  let joinCount = 0
  const publicSession = roomSession({ joined: false })

  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    await fulfillJson(route, 200, { session: publicSession })
  })
  await page.route((url) => url.pathname === `${ROOM_PATH}/join`, async (route) => {
    joinCount += 1
    if (joinCount === 1) {
      await fulfillJson(route, 429, { error: "Please wait before joining again." }, { "Retry-After": "3" })
      return
    }
    await fulfillJson(route, 201, {
      player: { id: "player-1", token: "player-token", teamId: "team-1" },
      session: roomSession(),
    })
  })
  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
  })

  await page.goto(`/anatomime/join?code=${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await page.getByLabel("Display name").fill("Avery")
  await page.getByRole("button", { name: /Join Team/i }).click()
  await expect(page.getByRole("button", { name: /Try again in 3s/i })).toBeDisabled()
  expect(joinCount).toBe(1)

  await page.clock.fastForward(2_999)
  expect(joinCount).toBe(1)
  await page.clock.fastForward(1)
  await expect(page.getByRole("button", { name: /Join Team/i })).toBeEnabled()
  expect(joinCount).toBe(1)
  await page.getByRole("button", { name: /Join Team/i }).click()
  await expect.poll(() => joinCount).toBe(2)
})
