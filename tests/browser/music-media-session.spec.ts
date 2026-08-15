import { expect, test, type Page } from "@playwright/test"
import { centerCarouselItem } from "./carousel-test-helpers"

type MediaProbe = {
  audio: {
    created: number
    loadCalls: number
    pauseCalls: number
    playCalls: number
    source: string
  }
  mediaSession: {
    handlers: Record<string, (() => void) | null>
    metadata: { title?: string } | null
    playbackState: string
  }
}

async function installMediaOwnershipFakes(page: Page, options: {
  holdCarrierPlay?: boolean
  rejectCarrierPlay?: boolean
  resumeAfterInterruption?: boolean
} = {}) {
  await page.addInitScript((fakeOptions) => {
    const audio = {
      created: 0,
      loadCalls: 0,
      pauseCalls: 0,
      playCalls: 0,
      source: "",
    }
    let currentAudio: FakeAudio | null = null
    let releaseHeldPlay: (() => void) | null = null
    const handlers: Record<string, (() => void) | null> = {}
    const mediaSession = {
      handlers,
      metadata: null as Record<string, unknown> | null,
      playbackState: "none",
      setActionHandler(action: string, handler: (() => void) | null) {
        handlers[action] = handler
      },
    }

    class FakeAudio extends EventTarget {
      loop = false
      preload = ""
      paused = true
      private sourceAttribute: string | null = null

      constructor() {
        super()
        audio.created += 1
        currentAudio = this
      }

      get src() {
        return this.sourceAttribute
          ? new URL(this.sourceAttribute, window.location.href).href
          : ""
      }

      set src(value: string) {
        this.sourceAttribute = value
        audio.source = value
      }

      getAttribute(name: string) {
        return name === "src" ? this.sourceAttribute : null
      }

      removeAttribute(name: string) {
        if (name !== "src") return
        this.sourceAttribute = null
        audio.source = ""
      }

      canPlayType() {
        return ""
      }

      play() {
        audio.playCalls += 1
        if (fakeOptions.rejectCarrierPlay) return Promise.reject(new Error("carrier rejected"))
        this.paused = false
        if (fakeOptions.holdCarrierPlay) {
          return new Promise<void>((resolve) => {
            releaseHeldPlay = () => {
              this.paused = false
              queueMicrotask(() => this.dispatchEvent(new Event("play")))
              resolve()
            }
          })
        }
        queueMicrotask(() => this.dispatchEvent(new Event("play")))
        return Promise.resolve()
      }

      pause() {
        audio.pauseCalls += 1
        if (!this.paused) {
          this.paused = true
          queueMicrotask(() => this.dispatchEvent(new Event("pause")))
        }
      }

      load() {
        audio.loadCalls += 1
      }
    }

    class FakeAudioSession extends EventTarget {
      state = "active"
      type = "auto"
    }

    const audioSession = new FakeAudioSession()

    class FakeMediaMetadata {
      constructor(init: Record<string, unknown>) {
        Object.assign(this, init)
      }
    }

    Object.defineProperty(window, "Audio", { configurable: true, value: FakeAudio })
    Object.defineProperty(window, "MediaMetadata", { configurable: true, value: FakeMediaMetadata })
    Object.defineProperty(Navigator.prototype, "mediaSession", {
      configurable: true,
      get: () => mediaSession,
    })
    Object.defineProperty(Navigator.prototype, "audioSession", {
      configurable: true,
      get: () => audioSession,
    })
    if (typeof fakeOptions.resumeAfterInterruption === "boolean") {
      localStorage.setItem("massagelab-atmosphere-interruption-v1", JSON.stringify({
        version: 1,
        resumeAfterInterruption: fakeOptions.resumeAfterInterruption,
      }))
    }
    Reflect.set(window, "__massagelabMediaProbe", {
      audio,
      audioSession,
      emitExternalPause() {
        if (!currentAudio) return
        currentAudio.paused = true
        currentAudio.dispatchEvent(new Event("pause"))
      },
      releaseHeldPlay() {
        fakeOptions.holdCarrierPlay = false
        releaseHeldPlay?.()
        releaseHeldPlay = null
      },
      setAudioSessionState(state: string, emit: boolean) {
        audioSession.state = state
        if (emit) audioSession.dispatchEvent(new Event("statechange"))
      },
      mediaSession,
    })
  }, options)
}

async function readProbe(page: Page) {
  return page.evaluate(() => Reflect.get(window, "__massagelabMediaProbe") as MediaProbe)
}

async function invokeMediaAction(page: Page, action: string) {
  await page.evaluate((name) => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    probe.mediaSession.handlers[name]?.()
  }, action)
}

async function invokeProbeAction(page: Page, action: "emitExternalPause" | "releaseHeldPlay") {
  await page.evaluate((name) => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as Record<string, () => void>
    probe[name]()
  }, action)
}

async function setAudioSessionState(page: Page, state: "active" | "interrupted", emit = true) {
  await page.evaluate(({ nextState, shouldEmit }) => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as {
      setAudioSessionState: (state: string, emit: boolean) => void
    }
    probe.setAudioSessionState(nextState, shouldEmit)
  }, { nextState: state, shouldEmit: emit })
}

async function startProofStation(page: Page) {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  return page.getByTestId("music-player-toolbar")
}

test("provider media ownership claims the carrier before preparation and separates Pause from Stop", async ({ page }) => {
  let releaseSampleIndex!: () => void
  const sampleIndexGate = new Promise<void>((resolve) => {
    releaseSampleIndex = resolve
  })
  await page.route("**/observable-streams-vsco-adaptation/sample-index.json", async (route) => {
    await sampleIndexGate
    await route.abort("aborted")
  })
  await installMediaOwnershipFakes(page)

  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "observable-streams-probe", "Next station")
  await page.getByRole("button", { name: /^Play Observable Streams$/i }).click()

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect(page.getByText("Preparing audio...").last()).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    return {
      actions: Object.entries(probe.mediaSession.handlers)
        .filter(([, handler]) => typeof handler === "function")
        .map(([action]) => action)
        .sort(),
      playbackState: probe.mediaSession.playbackState,
      title: probe.mediaSession.metadata?.title,
    }
  })).toEqual({
    actions: ["nexttrack", "pause", "play", "previoustrack", "stop"],
    playbackState: "playing",
    title: "Observable Streams",
  })

  await invokeMediaAction(page, "pause")
  await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "paused")
  await expect.poll(async () => (await readProbe(page)).audio.source).not.toBe("")
  await expect.poll(async () => (await readProbe(page)).mediaSession.playbackState).toBe("paused")

  await invokeMediaAction(page, "stop")
  await expect(page.getByText("Stopped").last()).toBeVisible()
  await expect.poll(async () => (await readProbe(page)).audio.source).toBe("")
  await expect.poll(async () => page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    return {
      activeActions: Object.values(probe.mediaSession.handlers).filter(Boolean).length,
      metadata: probe.mediaSession.metadata,
      playbackState: probe.mediaSession.playbackState,
    }
  })).toEqual({ activeActions: 0, metadata: null, playbackState: "none" })

  releaseSampleIndex()
  await page.waitForTimeout(250)
  await expect(page.getByText("Stopped").last()).toBeVisible()
})

test("provider media ownership cancels initial loading from carrier and Media Session Pause", async ({ page }) => {
  await installMediaOwnershipFakes(page, { holdCarrierPlay: true })
  const player = await startProofStation(page)

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect(player).toHaveAttribute("data-playback-state", "loading")
  await expect.poll(async () => page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    return typeof probe.mediaSession.handlers.pause
  })).toBe("function")

  await invokeProbeAction(page, "emitExternalPause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await invokeMediaAction(page, "pause")
  await invokeProbeAction(page, "releaseHeldPlay")
  await page.waitForTimeout(500)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
})

test("provider media ownership lets Media Session Pause cancel the first held Play", async ({ page }) => {
  await installMediaOwnershipFakes(page, { holdCarrierPlay: true })
  const player = await startProofStation(page)

  await expect.poll(async () => page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    return typeof probe.mediaSession.handlers.pause
  })).toBe("function")
  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await invokeProbeAction(page, "releaseHeldPlay")
  await page.waitForTimeout(500)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
})

test("provider media ownership classifies paired interruption and Pause in either event order", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  await setAudioSessionState(page, "interrupted", false)
  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await setAudioSessionState(page, "interrupted", true)
  await setAudioSessionState(page, "active", true)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  await setAudioSessionState(page, "interrupted", true)
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await setAudioSessionState(page, "active", true)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await invokeMediaAction(page, "stop")
})

test("provider media ownership applies the saved default to external Play and never recovers disabled sessions", async ({ page }) => {
  await installMediaOwnershipFakes(page, { resumeAfterInterruption: false })
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await invokeMediaAction(page, "play")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  await setAudioSessionState(page, "interrupted", true)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await setAudioSessionState(page, "active", true)
  await page.waitForTimeout(300)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await invokeMediaAction(page, "stop")
})

test("provider media ownership treats unpaired carrier Pause as ambiguous", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  await invokeProbeAction(page, "emitExternalPause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await setAudioSessionState(page, "active", true)
  await page.waitForTimeout(300)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await invokeMediaAction(page, "stop")
})

test("provider media ownership keeps one owner across routes and publishes only the current adjacent station", async ({ page }) => {
  let releaseSampleIndex!: () => void
  const sampleIndexGate = new Promise<void>((resolve) => {
    releaseSampleIndex = resolve
  })
  await page.route("**/atmosphere/generative-fm/420hz-gamma-waves-for-big-brain/sample-index.json", async (route) => {
    await sampleIndexGate
    await route.abort("aborted")
  })
  await installMediaOwnershipFakes(page, { resumeAfterInterruption: false })
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  await invokeMediaAction(page, "nexttrack")
  await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.title)
    .toBe("420hz Gamma Waves for Big Brain")
  await invokeMediaAction(page, "previoustrack")
  await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.title)
    .toBe("MassageLab Proof Drone")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  releaseSampleIndex()
  await page.waitForTimeout(300)
  await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.title)
    .toBe("MassageLab Proof Drone")

  await page.getByRole("link", { name: "MassageLab home" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await readProbe(page)).audio.created).toBe(1)
  await expect.poll(async () => page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    return Object.values(probe.mediaSession.handlers).filter(Boolean).length
  })).toBe(5)

  await setAudioSessionState(page, "interrupted", true)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await setAudioSessionState(page, "active", true)
  await page.waitForTimeout(300)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await invokeMediaAction(page, "stop")
})

test("provider media ownership keeps generator playback when carrier acquisition rejects", async ({ page }) => {
  await installMediaOwnershipFakes(page, { rejectCarrierPlay: true })
  const player = await startProofStation(page)

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await invokeMediaAction(page, "stop")
})
