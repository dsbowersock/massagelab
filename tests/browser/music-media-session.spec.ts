import { expect, test, type Page } from "@playwright/test"
import { centerCarouselItem } from "./carousel-test-helpers"

type MediaProbe = {
  audio: {
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

async function installMediaOwnershipFakes(page: Page) {
  await page.addInitScript(() => {
    const audio = {
      loadCalls: 0,
      pauseCalls: 0,
      playCalls: 0,
      source: "",
    }
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

      async play() {
        audio.playCalls += 1
        if (this.paused) {
          this.paused = false
          queueMicrotask(() => this.dispatchEvent(new Event("play")))
        }
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
    Reflect.set(window, "__massagelabMediaProbe", { audio, mediaSession })
  })
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
