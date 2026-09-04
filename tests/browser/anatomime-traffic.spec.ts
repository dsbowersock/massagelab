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

/**
 * Installs optional stored-player state, controllable visibility, deterministic retry jitter,
 * and fake Ably signaling whose callback lifetime follows active clients and subscriptions.
 */
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
    const runtime = window as typeof window & {
      Ably?: unknown
      __anatomimeAblySignal?: (() => void) | null
    }
    type AblyCallback = () => void
    type AblyClientState = {
      channels: Map<string, Set<AblyCallback>>
      closed: boolean
    }
    const activeClients = new Set<AblyClientState>()
    const dispatchActiveCallbacks = () => {
      const callbacks: AblyCallback[] = []
      for (const client of activeClients) {
        for (const channelCallbacks of client.channels.values()) callbacks.push(...channelCallbacks)
      }
      for (const callback of callbacks) callback()
    }
    const refreshDispatcher = () => {
      runtime.__anatomimeAblySignal = [...activeClients].some((client) => (
        [...client.channels.values()].some((callbacks) => callbacks.size > 0)
      ))
        ? dispatchActiveCallbacks
        : null
    }
    runtime.__anatomimeAblySignal = null
    runtime.Ably = {
      Realtime: class {
        private readonly state: AblyClientState = { channels: new Map(), closed: false }

        constructor() {
          activeClients.add(this.state)
        }

        channels = {
          get: (channelName: string) => {
            let callbacks = this.state.channels.get(channelName)
            if (!callbacks) {
              callbacks = new Set()
              this.state.channels.set(channelName, callbacks)
            }
            return {
              subscribe: (callback: AblyCallback) => {
                if (this.state.closed) return
                callbacks.add(callback)
                refreshDispatcher()
              },
              unsubscribe: () => {
                callbacks.clear()
                refreshDispatcher()
              },
            }
          },
        }

        close() {
          if (this.state.closed) return
          this.state.closed = true
          for (const callbacks of this.state.channels.values()) callbacks.clear()
          this.state.channels.clear()
          activeClients.delete(this.state)
          refreshDispatcher()
        }
      },
    }
  }, { roomCode: ROOM_CODE, stored: storedPlayer })
}

async function triggerRealtimeSignal(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    typeof (window as typeof window & { __anatomimeAblySignal?: unknown }).__anatomimeAblySignal
  ))).toBe("function")
  await page.evaluate(() => {
    ;(window as typeof window & { __anatomimeAblySignal?: (() => void) | null }).__anatomimeAblySignal?.()
  })
}

async function installNoProviderBoundary(page: Page) {
  let providerRequests = 0
  await page.route("https://cdn.ably.com/**", async (route) => {
    providerRequests += 1
    await route.abort()
  })
  return () => providerRequests
}

const providerRequestCounters = new WeakMap<Page, () => number>()

test.beforeEach(async ({ page }) => {
  providerRequestCounters.set(page, await installNoProviderBoundary(page))
})

function providerRequests(page: Page) {
  const currentCount = providerRequestCounters.get(page)
  if (!currentCount) throw new Error("Anatomime provider boundary was not installed for this page.")
  return currentCount()
}

async function fulfillJson(route: Route, status: number, body: unknown, headers?: Record<string, string>) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
  })
}

/**
 * Freezes time after hydration. The small future buffer prevents pauseAt from
 * racing wall time; callers keep the response that creates the tested deadline
 * gated until after this resolves.
 */
async function pauseClockAtCurrentTime(page: Page) {
  const pauseTarget = await page.evaluate(() => Date.now() + 500)
  await page.clock.pauseAt(pauseTarget)
}

/** Holds a mocked response until its test has established a frozen timer origin. */
function responseGate() {
  let release = () => {}
  const wait = new Promise<void>((resolve) => { release = resolve })
  return { release, wait }
}

/** Makes the first matching successful response expose a JSON reader that waits for abort. */
async function installStalledActionJson(page: Page, targetPath: string) {
  await page.addInitScript((path) => {
    const runtime = window as typeof window & { __releaseStalledActionJson?: () => void }
    const nativeFetch = window.fetch.bind(window)
    let matchingCalls = 0
    let releaseCurrent: (() => void) | null = null

    runtime.__releaseStalledActionJson = () => releaseCurrent?.()
    window.fetch = async (input, init) => {
      const response = await nativeFetch(input, init)
      const inputUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
      if (new URL(inputUrl, window.location.href).pathname !== path || init?.method !== "POST") {
        return response
      }

      matchingCalls += 1
      if (matchingCalls !== 1) return response

      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        json: () => new Promise((_resolve, reject) => {
          const signal = init.signal
          let settled = false
          const finish = (reason: unknown) => {
            if (settled) return
            settled = true
            signal?.removeEventListener("abort", onAbort)
            releaseCurrent = null
            reject(reason)
          }
          const onAbort = () => finish(signal?.reason ?? new DOMException("Aborted", "AbortError"))
          releaseCurrent = () => finish(new DOMException("Released", "AbortError"))
          if (signal?.aborted) onAbort()
          else signal?.addEventListener("abort", onAbort, { once: true })
        }),
      } as Response
    }
  }, targetPath)
}

async function releaseStalledActionJson(page: Page) {
  await page.evaluate(() => {
    ;(window as typeof window & { __releaseStalledActionJson?: () => void }).__releaseStalledActionJson?.()
  }).catch(() => {})
}

test("Ably harness isolates subscriptions across client and channel lifecycles", async ({ page }) => {
  await installPlayerRuntime(page, { storedPlayer: false })
  await page.goto("data:text/html,<title>Ably harness</title>")

  const lifecycle = await page.evaluate(() => {
    type TestChannel = {
      subscribe: (callback: () => void) => void
      unsubscribe: () => void
    }
    type TestClient = {
      channels: { get: (name: string) => TestChannel }
      close: () => void
    }
    const runtime = window as typeof window & {
      Ably?: { Realtime: new () => TestClient }
      __anatomimeAblySignal?: (() => void) | null
    }
    if (!runtime.Ably) throw new Error("Ably harness is unavailable.")

    const calls: string[] = []
    const dispatch = () => {
      const start = calls.length
      runtime.__anatomimeAblySignal?.()
      return calls.slice(start)
    }
    const firstClient = new runtime.Ably.Realtime()
    const secondClient = new runtime.Ably.Realtime()
    const firstRoom = firstClient.channels.get("room")
    const firstOther = firstClient.channels.get("other")
    const secondRoom = secondClient.channels.get("room")

    firstRoom.subscribe(() => calls.push("first-room-a"))
    firstRoom.subscribe(() => calls.push("first-room-b"))
    firstOther.subscribe(() => calls.push("first-other"))
    secondRoom.subscribe(() => calls.push("second-room-a"))
    const initial = dispatch()

    firstRoom.unsubscribe()
    const afterChannelUnsubscribe = dispatch()

    firstRoom.subscribe(() => calls.push("first-room-c"))
    const afterResubscribe = dispatch()

    firstClient.close()
    const afterClientClose = dispatch()

    secondRoom.subscribe(() => calls.push("second-room-b"))
    const afterSecondSubscription = dispatch()

    return { initial, afterChannelUnsubscribe, afterResubscribe, afterClientClose, afterSecondSubscription }
  })

  expect(lifecycle).toEqual({
    initial: ["first-room-a", "first-room-b", "first-other", "second-room-a"],
    afterChannelUnsubscribe: ["first-other", "second-room-a"],
    afterResubscribe: ["first-room-c", "first-other", "second-room-a"],
    afterClientClose: ["second-room-a"],
    afterSecondSubscription: ["second-room-a", "second-room-b"],
  })
  await page.close()
})

test("player polling uses credential-bound tokens with 2s visible and 15s hidden cadence", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page)
  let pollCount = 0
  let currentSession = roomSession({ status: "PLAYING", phase: "ACTIVE_TERM" })
  let tokenHeaders: Record<string, string> | null = null
  let tokenBody: string | null = "unexpected"
  let tokenCount = 0
  const firstPollResponse = responseGate()

  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    tokenCount += 1
    tokenHeaders = route.request().headers()
    tokenBody = route.request().postData()
    await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (pollCount === 1) await firstPollResponse.wait
    await fulfillJson(route, 200, { session: currentSession })
  })

  await page.goto(`/anatomime/play/${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect.poll(() => pollCount).toBe(1)
  const initialLoading = page.getByRole("status").filter({ hasText: "Loading shared game…" })
  await expect(initialLoading).toBeVisible()
  await pauseClockAtCurrentTime(page)
  expect(pollCount).toBe(1)
  firstPollResponse.release()
  await expect(page.getByText("ACTIVE_TERM", { exact: true })).toBeVisible()
  await expect(initialLoading).toHaveCount(0)
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
  await page.clock.fastForward(14_999)
  expect(pollCount).toBe(2)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(3)
  await expect(page.getByText("ACTIVE_TERM", { exact: true })).toBeVisible()

  await page.evaluate(() => {
    ;(window as typeof window & { __anatomimeHidden?: boolean }).__anatomimeHidden = false
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await page.clock.fastForward(1_999)
  expect(pollCount).toBe(3)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(4)
  expect(tokenCount).toBe(1)
  expect(providerRequests(page)).toBe(0)
})

test("team changes preserve server polling cooldowns and realtime credentials", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page)
  let pollCount = 0
  let tokenCount = 0
  let teamCount = 0
  const firstPollResponse = responseGate()
  const lobbySession = roomSession()
  const updatedSession = roomSession()
  updatedSession.viewer.teamId = "team-2"
  const updatedPlayer = updatedSession.players.find((player) => player.id === "player-1")
  if (updatedPlayer) updatedPlayer.teamId = "team-2"

  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    tokenCount += 1
    await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
  })
  await page.route((url) => url.pathname === `${ROOM_PATH}/team`, async (route) => {
    teamCount += 1
    await fulfillJson(route, 200, { session: updatedSession })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (pollCount === 1) {
      await firstPollResponse.wait
      await fulfillJson(route, 200, { session: lobbySession })
      return
    }
    if (pollCount === 2) {
      await fulfillJson(route, 429, { error: "Slow down." }, { "Retry-After": "45" })
      return
    }
    await fulfillJson(route, 200, { session: updatedSession })
  })

  await page.goto(`/anatomime/play/${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect.poll(() => pollCount).toBe(1)
  await pauseClockAtCurrentTime(page)
  firstPollResponse.release()
  await expect(page.getByText("Lobby", { exact: true })).toBeVisible()
  await expect.poll(() => tokenCount).toBe(1)

  await page.clock.fastForward(4_999)
  expect(pollCount).toBe(1)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(2)
  const rateLimitedStatus = page.getByText(
    "Updates are paused. Automatic refresh will resume when the server allows it.",
    { exact: true },
  )
  await expect(rateLimitedStatus).toBeVisible()

  await page.getByRole("button", { name: "Team 2" }).click()
  await expect.poll(() => teamCount).toBe(1)
  await expect(page.getByText("Team updated.", { exact: true })).toBeVisible()
  await expect(rateLimitedStatus).toBeVisible()
  await page.clock.fastForward(44_999)
  expect(pollCount).toBe(2)
  expect(tokenCount).toBe(1)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(3)
  expect(tokenCount).toBe(1)
  expect(providerRequests(page)).toBe(0)
})

test("a failed first lookup keeps feedback and restores room-code escape", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page, { storedPlayer: false })
  const firstPollResponse = responseGate()
  const retryPollResponse = responseGate()
  let pollCount = 0

  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (pollCount === 1) {
      await firstPollResponse.wait
      await fulfillJson(route, 503, { error: "Temporarily unavailable." })
      return
    }
    await retryPollResponse.wait
    await fulfillJson(route, 200, { session: roomSession({ joined: false }) })
  })

  await page.goto(`/anatomime/join?code=${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect.poll(() => pollCount).toBe(1)
  const initialLoading = page.getByRole("status").filter({ hasText: "Loading shared game…" })
  await expect(initialLoading).toBeVisible()
  await pauseClockAtCurrentTime(page)
  firstPollResponse.release()

  await expect(initialLoading).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: "Connection interrupted" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Game Code" })).toBeVisible()
  await expect(page.getByLabel("Code")).toHaveValue(ROOM_CODE)
  for (const invalidCode of ["", "   ", "---"]) {
    await page.getByLabel("Code").fill(invalidCode)
    await page.getByRole("button", { name: "Find Game" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Enter a game code." })).toBeVisible()
    await expect(page.getByRole("status").filter({ hasText: "Connection interrupted" })).toBeVisible()
    expect(pollCount).toBe(1)
  }
  await page.getByLabel("Code").fill(ROOM_CODE)
  await page.getByRole("button", { name: "Find Game" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Enter a game code." })).toHaveCount(0)
  await expect(initialLoading).toBeVisible()
  await expect.poll(() => pollCount).toBe(2)
  retryPollResponse.release()
  await expect(initialLoading).toHaveCount(0)
  await expect(page.getByRole("heading", { name: `Join ${ROOM_CODE}` })).toBeVisible()
  expect(providerRequests(page)).toBe(0)
})

test("a stalled first lookup reaches visible recovery only after its deadline and backoff", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page, { storedPlayer: false })
  const firstPollResponse = responseGate()
  let pollCount = 0

  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (pollCount === 1) {
      await firstPollResponse.wait
      await route.abort("timedout").catch(() => {})
      return
    }
    await fulfillJson(route, 200, { session: roomSession({ joined: false }) })
  })

  await page.goto("/anatomime/join", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Game Code" })).toBeVisible()
  await pauseClockAtCurrentTime(page)
  await page.getByLabel("Code").fill(ROOM_CODE)
  await page.getByRole("button", { name: "Find Game" }).click()
  await expect.poll(() => pollCount).toBe(1)
  const initialLoading = page.getByRole("status").filter({ hasText: "Loading shared game…" })
  await expect(initialLoading).toBeVisible()

  await page.clock.fastForward(1_499)
  await expect(initialLoading).toBeVisible()
  expect(pollCount).toBe(1)

  await page.clock.fastForward(1)
  await expect(initialLoading).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: "Connection interrupted" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Game Code" })).toBeVisible()
  expect(pollCount).toBe(1)

  await page.clock.fastForward(2_000)
  expect(pollCount).toBe(1)
  firstPollResponse.release()
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(2)
  expect(providerRequests(page)).toBe(0)
})

test("player polling backs off through 2/4/8/16 seconds and capped terminal jitter, then resets", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page)
  let pollCount = 0
  const firstPollResponse = responseGate()
  // installPlayerRuntime pins Math.random to zero, so the 30s terminal base exercises
  // the exact 27_001ms lower edge of the bounded 27_001-30_000ms range.
  const zeroRandomFailureDelaysMs = [2_001, 4_001, 8_001, 16_001, 27_001]

  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (pollCount === 1) await firstPollResponse.wait
    if (pollCount <= 5) {
      await fulfillJson(route, 503, { error: "Temporarily unavailable." })
      return
    }
    await fulfillJson(route, 200, { session: roomSession({ status: "PLAYING", phase: "ACTIVE_TERM" }) })
  })

  await page.goto(`/anatomime/play/${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect.poll(() => pollCount).toBe(1)
  const initialLoading = page.getByRole("status").filter({ hasText: "Loading shared game…" })
  await expect(initialLoading).toBeVisible()
  await pauseClockAtCurrentTime(page)
  expect(pollCount).toBe(1)
  firstPollResponse.release()
  await expect(page.getByText(/Connection interrupted/i)).toBeVisible()
  await expect(initialLoading).toHaveCount(0)

  for (const delay of zeroRandomFailureDelaysMs) {
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
  await triggerRealtimeSignal(page)
  await expect.poll(() => pollCount).toBe(8)
  expect(providerRequests(page)).toBe(0)
})

test("player realtime wakes failed recovery but cannot bypass Retry-After", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page)
  let pollCount = 0
  const firstPollResponse = responseGate()

  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    pollCount += 1
    if (pollCount === 1) {
      await firstPollResponse.wait
      await fulfillJson(route, 503, { error: "Temporarily unavailable." })
      return
    }
    if (pollCount === 2) {
      await fulfillJson(route, 429, { error: "Slow down." }, { "Retry-After": "45" })
      return
    }
    await fulfillJson(route, 200, { session: roomSession() })
  })

  await page.goto(`/anatomime/play/${ROOM_CODE}`, { waitUntil: "domcontentloaded" })
  await expect.poll(() => pollCount).toBe(1)
  await pauseClockAtCurrentTime(page)
  expect(pollCount).toBe(1)
  firstPollResponse.release()
  await expect(page.getByText(/Connection interrupted/i)).toBeVisible()
  await triggerRealtimeSignal(page)
  await expect.poll(() => pollCount).toBe(2)
  await expect(page.getByText("Updates are paused. Automatic refresh will resume when the server allows it.", { exact: true })).toBeVisible()
  await triggerRealtimeSignal(page)
  expect(pollCount).toBe(2)
  await page.clock.fastForward(44_999)
  expect(pollCount).toBe(2)
  await page.clock.fastForward(1)
  await expect.poll(() => pollCount).toBe(3)
  expect(providerRequests(page)).toBe(0)
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
  expect(providerRequests(page)).toBe(0)
})

test("host review polling continues at 5s and stops on a successful ended snapshot", async ({ page }) => {
  await page.clock.install()
  let hostPollCount = 0
  let createCount = 0
  const reviewSession = roomSession({ status: "REVIEW", phase: "GAME_COMPLETE", joined: false, host: true })
  let hostSnapshot = reviewSession
  const createResponse = responseGate()

  await page.route((url) => url.pathname === "/api/anatomime/sessions", async (route) => {
    createCount += 1
    if (createCount === 1) await createResponse.wait
    await fulfillJson(route, 201, {
      session: reviewSession,
      host: { playerId: "host-player", token: "host-token" },
    })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    hostPollCount += 1
    await fulfillJson(route, 200, { session: hostSnapshot })
  })
  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
  })

  await page.goto("/anatomime", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /Choose Anatomy Terms/i }).click()
  await page.getByRole("button", { name: /Create Shared Game/i }).click()
  await expect.poll(() => createCount).toBe(1)
  await pauseClockAtCurrentTime(page)
  expect(hostPollCount).toBe(0)
  createResponse.release()
  await expect(page.getByText("REVIEW", { exact: true }).first()).toBeVisible()
  await page.clock.fastForward(4_999)
  expect(hostPollCount).toBe(0)
  await page.clock.fastForward(1)
  await expect.poll(() => hostPollCount).toBe(1)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await page.clock.fastForward(14_999)
  expect(hostPollCount).toBe(1)
  await page.clock.fastForward(1)
  await expect.poll(() => hostPollCount).toBe(2)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  hostSnapshot = roomSession({ status: "EXPIRED", phase: "GAME_COMPLETE", joined: false, host: true })
  await page.clock.fastForward(4_999)
  expect(hostPollCount).toBe(2)
  await page.clock.fastForward(1)
  await expect.poll(() => hostPollCount).toBe(3)
  await expect(page.getByText("Shared game ended", { exact: true })).toBeVisible()
  await page.clock.fastForward(60_000)
  expect(hostPollCount).toBe(3)
  expect(providerRequests(page)).toBe(0)
})

test("host refresh wakes failed recovery but cannot bypass Retry-After", async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => { Math.random = () => 0 })
  let hostPollCount = 0
  let createCount = 0
  const lobbySession = roomSession({ joined: false, host: true })
  const createResponse = responseGate()
  const firstHostPollResponse = responseGate()

  await page.route((url) => url.pathname === "/api/anatomime/sessions", async (route) => {
    createCount += 1
    if (createCount === 1) await createResponse.wait
    await fulfillJson(route, 201, {
      session: lobbySession,
      host: { playerId: "host-player", token: "host-token" },
    })
  })
  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    hostPollCount += 1
    if (hostPollCount === 1) {
      await firstHostPollResponse.wait
      await fulfillJson(route, 429, { error: "Slow down." }, { "Retry-After": "45" })
      return
    }
    if (hostPollCount === 2) {
      await fulfillJson(route, 503, { error: "Temporarily unavailable." })
      return
    }
    await fulfillJson(route, 200, { session: lobbySession })
  })
  await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
    await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
  })

  await page.goto("/anatomime", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /Choose Anatomy Terms/i }).click()
  await page.getByRole("button", { name: /Create Shared Game/i }).click()
  await expect.poll(() => createCount).toBe(1)
  await pauseClockAtCurrentTime(page)
  expect(hostPollCount).toBe(0)
  createResponse.release()
  const refresh = page.getByRole("button", { name: "Refresh" })
  await expect(refresh).toBeVisible()

  await refresh.click()
  await expect.poll(() => hostPollCount).toBe(1)
  await refresh.click()
  await expect(page.getByRole("status").filter({ hasText: "Update already in progress." })).toBeVisible()
  expect(hostPollCount).toBe(1)
  firstHostPollResponse.release()
  const rateLimitedStatus = page.getByText(
    "Updates are paused. Automatic refresh will resume when the server allows it.",
    { exact: true },
  )
  await expect(rateLimitedStatus).toBeVisible()
  await refresh.click()
  await expect(rateLimitedStatus).toBeVisible()
  expect(hostPollCount).toBe(1)
  await page.clock.fastForward(44_999)
  expect(hostPollCount).toBe(1)
  await page.clock.fastForward(1)
  await expect.poll(() => hostPollCount).toBe(2)

  await expect(page.getByText(/Connection interrupted/i)).toBeVisible()
  await refresh.click()
  await expect.poll(() => hostPollCount).toBe(3)
  expect(providerRequests(page)).toBe(0)
})

test("create honors Retry-After lockout without replaying automatically", async ({ page }) => {
  await page.clock.install()
  let createCount = 0
  const firstCreateResponse = responseGate()

  await page.route((url) => url.pathname === "/api/anatomime/sessions", async (route) => {
    createCount += 1
    if (createCount === 1) {
      await firstCreateResponse.wait
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
  await expect.poll(() => createCount).toBe(1)
  await pauseClockAtCurrentTime(page)
  expect(createCount).toBe(1)
  firstCreateResponse.release()
  await expect(page.getByRole("button", { name: "Try again in 3s" })).toBeDisabled()
  await expect(page.getByText("Please wait before creating another room.", { exact: true })).toBeVisible()
  const createCooldownStatus = page.locator(".anatomime-poll-status[role='status']")
  await expect(createCooldownStatus).toHaveText("Shared game creation is temporarily paused. You can retry when the countdown ends.")
  expect(createCount).toBe(1)

  await page.clock.runFor(1_000)
  await expect(page.getByRole("button", { name: "Try again in 2s" })).toBeDisabled()
  await expect(createCooldownStatus).toHaveText("Shared game creation is temporarily paused. You can retry when the countdown ends.")
  await page.clock.runFor(1_999)
  expect(createCount).toBe(1)
  await expect(page.getByRole("button", { name: /Try again in \d+s/i })).toBeDisabled()
  await page.clock.runFor(1)
  await expect(page.getByRole("button", { name: /Create Shared Game/i })).toBeEnabled()
  await expect(createCooldownStatus).toHaveText("")
  expect(createCount).toBe(1)
  await page.getByRole("button", { name: /Create Shared Game/i }).click()
  await expect.poll(() => createCount).toBe(2)
  expect(providerRequests(page)).toBe(0)
})

test("create applies a safe manual cooldown when a 429 omits Retry-After", async ({ page }) => {
  await page.clock.install()
  let createCount = 0
  const firstCreateResponse = responseGate()

  await page.route((url) => url.pathname === "/api/anatomime/sessions", async (route) => {
    createCount += 1
    if (createCount === 1) {
      await firstCreateResponse.wait
      await fulfillJson(route, 429, { error: "Please wait before creating another room." })
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
  await expect.poll(() => createCount).toBe(1)
  await pauseClockAtCurrentTime(page)
  firstCreateResponse.release()

  const createButton = page.getByRole("button", { name: "Try again in 10s" })
  await expect(createButton).toBeDisabled()
  await createButton.evaluate((button: HTMLButtonElement) => button.click())
  expect(createCount).toBe(1)
  await page.clock.runFor(9_999)
  expect(createCount).toBe(1)
  await expect(page.getByRole("button", { name: /Try again in \d+s/i })).toBeDisabled()
  await page.clock.runFor(1)
  await expect(page.getByRole("button", { name: /Create Shared Game/i })).toBeEnabled()
  expect(createCount).toBe(1)
  await page.getByRole("button", { name: /Create Shared Game/i }).click()
  await expect.poll(() => createCount).toBe(2)
  expect(providerRequests(page)).toBe(0)
})

test("join honors Retry-After lockout without replaying automatically", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page, { storedPlayer: false })
  let joinCount = 0
  const publicSession = roomSession({ joined: false })
  const firstJoinResponse = responseGate()

  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    await fulfillJson(route, 200, { session: publicSession })
  })
  await page.route((url) => url.pathname === `${ROOM_PATH}/join`, async (route) => {
    joinCount += 1
    if (joinCount === 1) {
      await firstJoinResponse.wait
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
  await expect.poll(() => joinCount).toBe(1)
  await pauseClockAtCurrentTime(page)
  expect(joinCount).toBe(1)
  firstJoinResponse.release()
  await expect(page.getByRole("button", { name: /Try again in \d+s/i })).toBeDisabled()
  await expect(page.getByText("Please wait before joining again.", { exact: true })).toBeVisible()
  await expect(page.getByText(/Joining is paused/i)).toBeVisible()
  expect(joinCount).toBe(1)

  await page.clock.runFor(2_999)
  expect(joinCount).toBe(1)
  await expect(page.getByRole("button", { name: /Try again in \d+s/i })).toBeDisabled()
  await page.clock.runFor(1)
  await expect(page.getByRole("button", { name: /Join Team/i })).toBeEnabled()
  expect(joinCount).toBe(1)
  await page.getByRole("button", { name: /Join Team/i }).click()
  await expect.poll(() => joinCount).toBe(2)
  expect(providerRequests(page)).toBe(0)
})

test("join applies a safe manual cooldown when a 429 has an unusable Retry-After", async ({ page }) => {
  await page.clock.install()
  await installPlayerRuntime(page, { storedPlayer: false })
  let joinCount = 0
  const publicSession = roomSession({ joined: false })
  const firstJoinResponse = responseGate()

  await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
    await fulfillJson(route, 200, { session: publicSession })
  })
  await page.route((url) => url.pathname === `${ROOM_PATH}/join`, async (route) => {
    joinCount += 1
    if (joinCount === 1) {
      await firstJoinResponse.wait
      await fulfillJson(route, 429, { error: "Please wait before joining again." }, { "Retry-After": "0" })
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
  await expect.poll(() => joinCount).toBe(1)
  await pauseClockAtCurrentTime(page)
  firstJoinResponse.release()

  const joinButton = page.getByRole("button", { name: "Try again in 10s" })
  await expect(joinButton).toBeDisabled()
  await joinButton.evaluate((button: HTMLButtonElement) => button.click())
  expect(joinCount).toBe(1)
  await page.clock.runFor(9_999)
  expect(joinCount).toBe(1)
  await expect(page.getByRole("button", { name: /Try again in \d+s/i })).toBeDisabled()
  await page.clock.runFor(1)
  await expect(page.getByRole("button", { name: /Join Team/i })).toBeEnabled()
  expect(joinCount).toBe(1)
  await page.getByRole("button", { name: /Join Team/i }).click()
  await expect.poll(() => joinCount).toBe(2)
  expect(providerRequests(page)).toBe(0)
})

for (const stalledAt of ["transport", "successful JSON"] as const) {
  test(`create bounds a stalled ${stalledAt} response before a manual retry`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.clock.install()
    let createCount = 0
    const transportGate = responseGate()
    const ambiguityMessage = "We could not confirm whether the shared game was created. Wait briefly, then retry manually; retrying may create another room."

    if (stalledAt === "successful JSON") {
      await installStalledActionJson(page, "/api/anatomime/sessions")
    }
    await page.route((url) => url.pathname === "/api/anatomime/sessions", async (route) => {
      createCount += 1
      if (createCount === 1 && stalledAt === "transport") {
        await transportGate.wait
      }
      await fulfillJson(route, 201, {
        session: roomSession({ joined: false, host: true }),
        host: { playerId: "host-player", token: "host-token" },
      }).catch(() => {})
    })
    await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
      await fulfillJson(route, 200, { session: roomSession({ joined: false, host: true }) })
    })

    try {
      await page.goto("/anatomime", { waitUntil: "networkidle" })
      const chooseTerms = page.getByRole("button", { name: /Choose Anatomy Terms/i })
      const createGame = page.getByRole("button", { name: /Create Shared Game/i })
      await chooseTerms.click()
      await expect(createGame).toBeVisible()
      await pauseClockAtCurrentTime(page)
      await page.getByRole("button", { name: /Create Shared Game/i }).click()
      await expect.poll(() => createCount).toBe(1)
      await expect(page.getByRole("button", { name: "Creating..." })).toBeDisabled()

      await page.clock.runFor(19_999)
      await expect(page.getByRole("button", { name: "Creating..." })).toBeDisabled()
      await expect(page.getByText(ambiguityMessage, { exact: true })).toHaveCount(0)
      expect(createCount).toBe(1)

      await page.clock.runFor(1)
      await expect(page.getByText(ambiguityMessage, { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Try again in 10s" })).toBeDisabled()
      expect(createCount).toBe(1)

      await page.clock.runFor(9_999)
      await expect(page.getByRole("button", { name: /Try again in \d+s/i })).toBeDisabled()
      expect(createCount).toBe(1)
      await page.clock.runFor(1)
      await expect(page.getByRole("button", { name: /Create Shared Game/i })).toBeEnabled()
      await expect(page.getByText(ambiguityMessage, { exact: true })).toBeVisible()
      expect(createCount).toBe(1)

      await page.getByRole("button", { name: /Create Shared Game/i }).click()
      await expect.poll(() => createCount).toBe(2)
      expect(providerRequests(page)).toBe(0)
    } finally {
      transportGate.release()
      await releaseStalledActionJson(page)
    }
  })

  test(`join bounds a stalled ${stalledAt} response before a manual retry`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.clock.install()
    await installPlayerRuntime(page, { storedPlayer: false })
    let joinCount = 0
    const transportGate = responseGate()
    const ambiguityMessage = "We could not confirm whether you joined the game. Wait briefly, then retry manually; retrying may add another guest."

    if (stalledAt === "successful JSON") {
      await installStalledActionJson(page, `${ROOM_PATH}/join`)
    }
    await page.route((url) => url.pathname === ROOM_PATH, async (route) => {
      await fulfillJson(route, 200, { session: roomSession({ joined: false }) })
    })
    await page.route((url) => url.pathname === `${ROOM_PATH}/join`, async (route) => {
      joinCount += 1
      if (joinCount === 1 && stalledAt === "transport") {
        await transportGate.wait
      }
      await fulfillJson(route, 201, {
        player: { id: "player-1", token: "player-token", teamId: "team-1" },
        session: roomSession(),
      }).catch(() => {})
    })
    await page.route((url) => url.pathname === TOKEN_PATH, async (route) => {
      await fulfillJson(route, 200, { keyName: "test", nonce: "nonce", mac: "mac" })
    })

    try {
      await page.goto(`/anatomime/join?code=${ROOM_CODE}`, { waitUntil: "networkidle" })
      await expect(page.getByRole("button", { name: /Join Team/i })).toBeVisible()
      await pauseClockAtCurrentTime(page)
      await page.getByLabel("Display name").fill("Avery")
      await page.getByRole("button", { name: /Join Team/i }).evaluate((button: HTMLButtonElement) => button.click())
      await expect.poll(() => joinCount).toBe(1)
      await expect(page.getByRole("button", { name: "Joining..." })).toBeDisabled()

      await page.clock.runFor(19_999)
      await expect(page.getByRole("button", { name: "Joining..." })).toBeDisabled()
      await expect(page.getByText(ambiguityMessage, { exact: true })).toHaveCount(0)
      expect(joinCount).toBe(1)

      await page.clock.runFor(1)
      await expect(page.getByText(ambiguityMessage, { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Try again in 10s" })).toBeDisabled()
      expect(joinCount).toBe(1)

      await page.clock.runFor(9_999)
      await expect(page.getByRole("button", { name: /Try again in \d+s/i })).toBeDisabled()
      expect(joinCount).toBe(1)
      await page.clock.runFor(1)
      await expect(page.getByRole("button", { name: /Join Team/i })).toBeEnabled()
      await expect(page.getByText(ambiguityMessage, { exact: true })).toBeVisible()
      expect(joinCount).toBe(1)

      await page.getByRole("button", { name: /Join Team/i }).click()
      await expect.poll(() => joinCount).toBe(2)
      expect(providerRequests(page)).toBe(0)
    } finally {
      transportGate.release()
      await releaseStalledActionJson(page)
    }
  })
}
