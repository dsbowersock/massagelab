import { expect, test, type Page, type Route } from "@playwright/test"
import { centerCarouselItem } from "./carousel-test-helpers"

type MediaProbe = {
  audio: {
    created: number
    loadCalls: number
    pauseCalls: number
    playCalls: number
    source: string
  }
  audioContext: {
    activeGeneratorSources: number
    activeSources: number
    constructorReads: number
    created: number
    generatorGeneration: number
    generatorStarts: number
    generatorTeardowns: number
    sourceGeneration: number
    sourceStarts: number
    sourceTeardowns: number
  }
  audioSession: { state: string } | null
  mediaSession: {
    handlers: Record<string, (() => void) | null>
    handlerCalls: number
    metadata: {
      album?: string
      artist?: string
      artwork?: Array<{ sizes?: string; src?: string; type?: string }>
      title?: string
    } | null
    playbackState: string
  }
}

async function installMediaOwnershipFakes(page: Page, options: {
  holdCarrierPlay?: boolean
  includeAudioSession?: boolean
  mediaSessionSupported?: boolean
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
    const audioContext = {
      activeGeneratorSources: 0,
      activeSources: 0,
      constructorReads: 0,
      created: 0,
      generatorGeneration: 0,
      generatorStarts: 0,
      generatorTeardowns: 0,
      sourceGeneration: 0,
      sourceStarts: 0,
      sourceTeardowns: 0,
    }
    let currentAudio: FakeAudio | null = null
    let releaseHeldPlay: (() => void) | null = null
    const handlers: Record<string, (() => void) | null> = {}
    const mediaSession = {
      handlers,
      handlerCalls: 0,
      metadata: null as Record<string, unknown> | null,
      playbackState: "none",
      setActionHandler(action: string, handler: (() => void) | null) {
        this.handlerCalls += 1
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
              setTimeout(() => this.dispatchEvent(new Event("play")), 0)
              resolve()
            }
          })
        }
        setTimeout(() => this.dispatchEvent(new Event("play")), 0)
        return Promise.resolve()
      }

      pause() {
        audio.pauseCalls += 1
        if (!this.paused) {
          this.paused = true
          setTimeout(() => this.dispatchEvent(new Event("pause")), 0)
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

    const audioSession = fakeOptions.includeAudioSession === false
      ? null
      : new FakeAudioSession()

    class FakeMediaMetadata {
      constructor(init: Record<string, unknown>) {
        Object.assign(this, init)
      }
    }

    // Preserve the real graph used by Tone while interposing a deterministic,
    // pre-app constructor probe. Specific interruption state comes from the
    // separately controlled Audio Session fake when that API is enabled.
    const instrumentedSources = new WeakSet<object>()
    const instrumentedContexts = new WeakSet<object>()
    const replaceMethod = (
      target: object,
      name: string,
      replacement: (...args: unknown[]) => unknown,
    ) => {
      try {
        Object.defineProperty(target, name, {
          configurable: true,
          value: replacement,
          writable: true,
        })
        return true
      } catch {
        return false
      }
    }
    const instrumentScheduledSource = <T extends object>(
      source: T,
      kind: "buffer-source" | "oscillator",
      countsAsGeneratorSource: () => boolean = () => kind === "oscillator",
    ) => {
      if (instrumentedSources.has(source)) return source
      instrumentedSources.add(source)
      let active = false
      let generatorSource = false
      let tornDown = false
      const markTornDown = () => {
        if (!active || tornDown) return
        tornDown = true
        audioContext.activeSources = Math.max(0, audioContext.activeSources - 1)
        audioContext.sourceTeardowns += 1
        if (generatorSource) {
          audioContext.activeGeneratorSources = Math.max(0, audioContext.activeGeneratorSources - 1)
          audioContext.generatorTeardowns += 1
        }
      }
      const start = Reflect.get(source, "start")
      if (typeof start === "function") {
        replaceMethod(source, "start", (...args: unknown[]) => {
          const result = Reflect.apply(start, source, args)
          if (!active) {
            active = true
            generatorSource = countsAsGeneratorSource()
            audioContext.activeSources += 1
            audioContext.sourceGeneration += 1
            audioContext.sourceStarts += 1
            if (generatorSource) {
              audioContext.activeGeneratorSources += 1
              audioContext.generatorGeneration += 1
              audioContext.generatorStarts += 1
            }
          }
          return result
        })
      }
      for (const method of ["stop", "disconnect"] as const) {
        const original = Reflect.get(source, method)
        if (typeof original !== "function") continue
        replaceMethod(source, method, (...args: unknown[]) => {
          const result = Reflect.apply(original, source, args)
          markTornDown()
          return result
        })
      }
      if (source instanceof EventTarget) {
        source.addEventListener("ended", markTornDown, { once: true })
      }
      return source
    }
    const instrumentAudioContext = <T extends object>(context: T) => {
      if (instrumentedContexts.has(context)) return context
      instrumentedContexts.add(context)
      for (const factory of ["createBufferSource", "createOscillator"] as const) {
        const original = Reflect.get(context, factory)
        if (typeof original !== "function") continue
        replaceMethod(context, factory, (...args: unknown[]) => {
          const source = Reflect.apply(original, context, args)
          return source && typeof source === "object"
            ? instrumentScheduledSource(source, factory === "createOscillator" ? "oscillator" : "buffer-source")
            : source
        })
      }
      return context
    }
    const NativeAudioContext = window.AudioContext
    if (NativeAudioContext) {
      const requiresNativeConstructorIdentity = /AppleWebKit/i.test(navigator.userAgent)
        && !/(Chrome|Chromium)/i.test(navigator.userAgent)
      if (requiresNativeConstructorIdentity) {
        // WebKit brand-checks graph objects against its exact native constructor.
        // Interpose the lookup rather than replacing that constructor identity.
        Object.defineProperty(window, "AudioContext", {
          configurable: true,
          get() {
            audioContext.constructorReads += 1
            return NativeAudioContext
          },
        })
      } else {
        function FakeAudioContext(...args: ConstructorParameters<typeof AudioContext>) {
          audioContext.created += 1
          return instrumentAudioContext(Reflect.construct(NativeAudioContext, args))
        }
        Object.setPrototypeOf(FakeAudioContext, NativeAudioContext)
        FakeAudioContext.prototype = NativeAudioContext.prototype
        Object.defineProperty(window, "AudioContext", {
          configurable: true,
          value: FakeAudioContext,
        })
      }
    } else {
      // Playwright's Windows WebKit port exposes no Web Audio globals. Supply
      // a bounded graph fake so provider lifecycle can still execute there;
      // this project is compatibility smoke, not Safari audio certification.
      class FakeAudioParam {
        defaultValue: number
        maxValue = 3.4028234663852886e38
        minValue = -3.4028234663852886e38
        value: number

        constructor(value = 0) {
          this.defaultValue = value
          this.value = value
        }

        cancelAndHoldAtTime() { return this }
        cancelScheduledValues() { return this }
        exponentialRampToValueAtTime(value: number) { this.value = value; return this }
        linearRampToValueAtTime(value: number) { this.value = value; return this }
        setTargetAtTime(value: number) { this.value = value; return this }
        setValueAtTime(value: number) { this.value = value; return this }
        setValueCurveAtTime(values: Float32Array) {
          if (values.length > 0) this.value = values[values.length - 1]
          return this
        }
      }

      class FakeAudioNode extends EventTarget {
        channelCount = 2
        channelCountMode = "max"
        channelInterpretation = "speakers"
        context: FakeAudioContext
        numberOfInputs = 1
        numberOfOutputs = 1

        constructor(context: FakeAudioContext) {
          super()
          this.context = context
        }

        connect(destination: unknown) { return destination }
        disconnect() {}
      }

      class FakeAudioBuffer {
        duration: number
        length: number
        numberOfChannels: number
        sampleRate: number
        private channels: Float32Array[]

        constructor(options: { length: number; numberOfChannels?: number; sampleRate: number }) {
          this.length = options.length
          this.numberOfChannels = options.numberOfChannels ?? 1
          this.sampleRate = options.sampleRate
          this.duration = this.length / this.sampleRate
          this.channels = Array.from(
            { length: this.numberOfChannels },
            () => new Float32Array(this.length),
          )
        }

        copyFromChannel(destination: Float32Array, channel: number, offset = 0) {
          destination.set(this.channels[channel]?.subarray(offset, offset + destination.length) ?? [])
        }
        copyToChannel(source: Float32Array, channel: number, offset = 0) {
          this.channels[channel]?.set(source, offset)
        }
        getChannelData(channel: number) { return this.channels[channel] }
      }

      let webKitTransportOscillatorStarted = false

      class FakeAudioContext extends EventTarget {
        currentTime = 0
        destination: FakeAudioNode
        listener: Record<string, FakeAudioParam>
        sampleRate = 44_100
        state = "suspended"

        constructor() {
          super()
          audioContext.created += 1
          this.destination = new FakeAudioNode(this)
          this.destination.numberOfInputs = 1
          this.destination.numberOfOutputs = 0
          this.listener = Object.fromEntries([
            "positionX", "positionY", "positionZ", "forwardX", "forwardY", "forwardZ",
            "upX", "upY", "upZ",
          ].map((name) => [name, new FakeAudioParam(name === "forwardZ" ? -1 : name === "upY" ? 1 : 0)]))
        }

        close() { this.state = "closed"; this.dispatchEvent(new Event("statechange")); return Promise.resolve() }
        createAnalyser() {
          return Object.assign(new FakeAudioNode(this), {
            fftSize: 2048,
            frequencyBinCount: 1024,
            getByteFrequencyData() {},
            getByteTimeDomainData() {},
            getFloatFrequencyData() {},
            getFloatTimeDomainData() {},
            maxDecibels: -30,
            minDecibels: -100,
            smoothingTimeConstant: 0.8,
          })
        }
        createBiquadFilter() {
          return Object.assign(new FakeAudioNode(this), {
            Q: new FakeAudioParam(1),
            detune: new FakeAudioParam(0),
            frequency: new FakeAudioParam(350),
            gain: new FakeAudioParam(0),
            getFrequencyResponse() {},
            type: "lowpass",
          })
        }
        createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
          return new FakeAudioBuffer({ length, numberOfChannels, sampleRate })
        }
        createBufferSource() {
          const node = Object.assign(new FakeAudioNode(this), {
            buffer: null,
            detune: new FakeAudioParam(0),
            loop: false,
            loopEnd: 0,
            loopStart: 0,
            onended: null as (() => void) | null,
            playbackRate: new FakeAudioParam(1),
            start() {},
            stop() { setTimeout(() => node.onended?.(), 0) },
          })
          return instrumentScheduledSource(node, "buffer-source")
        }
        createChannelMerger() { return new FakeAudioNode(this) }
        createChannelSplitter() { return new FakeAudioNode(this) }
        createConstantSource() {
          return Object.assign(new FakeAudioNode(this), {
            offset: new FakeAudioParam(1), start() {}, stop() {},
          })
        }
        createDelay() {
          return Object.assign(new FakeAudioNode(this), { delayTime: new FakeAudioParam(0) })
        }
        createDynamicsCompressor() {
          return Object.assign(new FakeAudioNode(this), {
            attack: new FakeAudioParam(0.003),
            knee: new FakeAudioParam(30),
            ratio: new FakeAudioParam(12),
            reduction: 0,
            release: new FakeAudioParam(0.25),
            threshold: new FakeAudioParam(-24),
          })
        }
        createGain() {
          return Object.assign(new FakeAudioNode(this), { gain: new FakeAudioParam(1) })
        }
        createOscillator() {
          return instrumentScheduledSource(Object.assign(new FakeAudioNode(this), {
            detune: new FakeAudioParam(0),
            frequency: new FakeAudioParam(440),
            onended: null,
            setPeriodicWave() {},
            start() {},
            stop() {},
            type: "sine",
          }), "oscillator", () => {
            // standardized-audio-context implements WebKit's transport
            // ConstantSource with the first raw oscillator. It belongs to the
            // shared Tone engine, not to the proof station's disposable graph.
            if (!webKitTransportOscillatorStarted) {
              webKitTransportOscillatorStarted = true
              return false
            }
            return true
          })
        }
        createPeriodicWave() { return {} }
        createStereoPanner() {
          return Object.assign(new FakeAudioNode(this), { pan: new FakeAudioParam(0) })
        }
        createWaveShaper() {
          return Object.assign(new FakeAudioNode(this), { curve: null, oversample: "none" })
        }
        decodeAudioData() { return Promise.resolve(new FakeAudioBuffer({ length: 1, sampleRate: this.sampleRate })) }
        resume() { this.state = "running"; this.dispatchEvent(new Event("statechange")); return Promise.resolve() }
        suspend() { this.state = "suspended"; this.dispatchEvent(new Event("statechange")); return Promise.resolve() }
      }

      Object.defineProperties(window, {
        AudioBuffer: { configurable: true, value: FakeAudioBuffer },
        AudioContext: { configurable: true, value: FakeAudioContext },
        AudioNode: { configurable: true, value: FakeAudioNode },
        AudioParam: { configurable: true, value: FakeAudioParam },
        BaseAudioContext: { configurable: true, value: FakeAudioContext },
      })
    }

    Object.defineProperty(window, "Audio", { configurable: true, value: FakeAudio })
    Object.defineProperty(window, "MediaMetadata", {
      configurable: true,
      value: fakeOptions.mediaSessionSupported === false ? undefined : FakeMediaMetadata,
    })
    Object.defineProperty(Navigator.prototype, "mediaSession", {
      configurable: true,
      get: () => fakeOptions.mediaSessionSupported === false ? undefined : mediaSession,
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
      audioContext,
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
        if (!audioSession) return
        audioSession.state = state
        if (emit) audioSession.dispatchEvent(new Event("statechange"))
      },
      emitFocusAndVisibilityRecovery() {
        window.dispatchEvent(new Event("focus"))
        document.dispatchEvent(new Event("visibilitychange"))
      },
      mediaSession,
    })
  }, options)
}

async function readProbe(page: Page) {
  return page.evaluate(() => Reflect.get(window, "__massagelabMediaProbe") as MediaProbe)
}

function capturePageHealth(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  return { consoleErrors, pageErrors }
}

async function invokeMediaAction(page: Page, action: string) {
  await page.evaluate((name) => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    probe.mediaSession.handlers[name]?.()
  }, action)
}

async function invokeProbeAction(
  page: Page,
  action: "emitExternalPause" | "emitFocusAndVisibilityRecovery" | "releaseHeldPlay",
) {
  await page.evaluate((name) => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as Record<string, () => void>
    probe[name]()
  }, action)
}

async function releaseHeldCarrierPlay(page: Page) {
  await page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as
      | { releaseHeldPlay?: () => void }
      | undefined
    probe?.releaseHeldPlay?.()
  }).catch(() => undefined)
}

async function beginPlaybackStateHistory(page: Page) {
  await page.evaluate(() => {
    const player = document.querySelector<HTMLElement>("[data-testid='music-player-toolbar']")
    if (!player) throw new Error("Music player toolbar is unavailable")
    const history = [player.dataset.playbackState ?? ""]
    const observer = new MutationObserver(() => {
      history.push(player.dataset.playbackState ?? "")
    })
    observer.observe(player, { attributeFilter: ["data-playback-state"], attributes: true })
    Reflect.set(window, "__massagelabPlaybackStateHistory", { history, observer })
  })
}

async function finishPlaybackStateHistory(page: Page) {
  return page.evaluate(() => {
    const record = Reflect.get(window, "__massagelabPlaybackStateHistory") as
      | { history: string[]; observer: MutationObserver }
      | undefined
    record?.observer.disconnect()
    Reflect.deleteProperty(window, "__massagelabPlaybackStateHistory")
    return record?.history ?? []
  }).catch(() => [] as string[])
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

async function closeInterruptionNotice(page: Page) {
  const notice = page.getByRole("region", { name: "Interruption preference" })
  if (await notice.isVisible()) {
    await notice.getByRole("button", { name: "Close" }).click()
  }
  await expect(notice).toHaveCount(0)
}

test("Playing publishes complete metadata and all five actions while Pause retains and Stop dismisses ownership", async ({ page }) => {
  const health = capturePageHealth(page)
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect.poll(async () => page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    return {
      actions: Object.entries(probe.mediaSession.handlers)
        .filter(([, handler]) => typeof handler === "function")
        .map(([action]) => action)
        .sort(),
      playbackState: probe.mediaSession.playbackState,
      album: probe.mediaSession.metadata?.album,
      artist: probe.mediaSession.metadata?.artist,
      artwork: probe.mediaSession.metadata?.artwork,
      title: probe.mediaSession.metadata?.title,
    }
  })).toEqual({
    actions: ["nexttrack", "pause", "play", "previoustrack", "stop"],
    album: "MassageLab Atmosphere",
    artist: "MassageLab",
    artwork: [
      { sizes: "192x192", src: "/icons/icon-192.png", type: "image/png" },
      { sizes: "512x512", src: "/icons/icon-512.png", type: "image/png" },
    ],
    playbackState: "playing",
    title: "MassageLab Proof Drone",
  })
  await expect.poll(async () => {
    const probe = await readProbe(page)
    return probe.audioContext.created + probe.audioContext.constructorReads
  }).toBeGreaterThan(0)
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources)
    .toBeGreaterThan(0)

  await invokeMediaAction(page, "pause")
  await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "paused")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources, {
    timeout: 10_000,
  }).toBe(0)
  expect((await readProbe(page)).audioContext.generatorTeardowns).toBeGreaterThan(0)
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

  await page.waitForTimeout(250)
  await expect(page.getByText("Stopped").last()).toBeVisible()
  expect(health.consoleErrors).toEqual([])
  expect(health.pageErrors).toEqual([])
})

test("Loading publishes active intent and an external carrier Pause cancels held startup", async ({ page }) => {
  await installMediaOwnershipFakes(page, { holdCarrierPlay: true })
  let stateHistoryStarted = false
  try {
    const player = await startProofStation(page)

    await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
    await expect(player).toHaveAttribute("data-playback-state", "loading")
    await expect.poll(async () => page.evaluate(() => {
      const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
      return {
        pauseHandler: typeof probe.mediaSession.handlers.pause,
        playbackState: probe.mediaSession.playbackState,
        title: probe.mediaSession.metadata?.title,
      }
    })).toEqual({ pauseHandler: "function", playbackState: "playing", title: "Atmosphere" })

    await invokeProbeAction(page, "emitExternalPause")
    await expect(player).toHaveAttribute("data-playback-state", "paused")
    await beginPlaybackStateHistory(page)
    stateHistoryStarted = true
    await releaseHeldCarrierPlay(page)
    await page.waitForTimeout(500)
    await expect(player).toHaveAttribute("data-playback-state", "paused")
    const playbackStates = await finishPlaybackStateHistory(page)
    stateHistoryStarted = false
    expect(playbackStates).not.toContain("playing")
  } finally {
    if (stateHistoryStarted) await finishPlaybackStateHistory(page)
    await releaseHeldCarrierPlay(page)
  }
})

test("Media Session Pause cancels the first held Play without a late restart", async ({ page }) => {
  await installMediaOwnershipFakes(page, { holdCarrierPlay: true })
  try {
    const player = await startProofStation(page)

    await expect.poll(async () => page.evaluate(() => {
      const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
      return typeof probe.mediaSession.handlers.pause
    })).toBe("function")
    await invokeMediaAction(page, "pause")
    await expect(player).toHaveAttribute("data-playback-state", "paused")
    await releaseHeldCarrierPlay(page)
    await page.waitForTimeout(500)
    await expect(player).toHaveAttribute("data-playback-state", "paused")
  } finally {
    await releaseHeldCarrierPlay(page)
  }
})

test("notification Play starts a fresh session without reopening the in-app notice", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await closeInterruptionNotice(page)
  const initialPlayCalls = (await readProbe(page)).audio.playCalls
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources)
    .toBeGreaterThan(0)
  const initialSourceGeneration = (await readProbe(page)).audioContext.generatorGeneration

  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources, {
    timeout: 10_000,
  }).toBe(0)
  const retainedEngineSources = (await readProbe(page)).audioContext.activeSources
  await invokeMediaAction(page, "play")

  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(initialPlayCalls + 1)
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration)
    .toBeGreaterThan(initialSourceGeneration)
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources)
    .toBeGreaterThan(0)
  await expect(page.getByRole("region", { name: "Interruption preference" })).toHaveCount(0)
  await invokeMediaAction(page, "stop")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources, {
    timeout: 10_000,
  }).toBe(0)
  await expect.poll(async () => (await readProbe(page)).audioContext.activeSources, {
    timeout: 10_000,
  }).toBe(retainedEngineSources)
})

test("a specific interruption recovers a session whose automatic-resume preference is enabled", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources)
    .toBeGreaterThan(0)
  const firstSourceGeneration = (await readProbe(page)).audioContext.generatorGeneration

  await setAudioSessionState(page, "interrupted", false)
  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources, {
    timeout: 10_000,
  }).toBe(0)
  await setAudioSessionState(page, "interrupted", true)
  await setAudioSessionState(page, "active", true)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration)
    .toBeGreaterThan(firstSourceGeneration)
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources)
    .toBeGreaterThan(0)
  const secondSourceGeneration = (await readProbe(page)).audioContext.generatorGeneration

  await setAudioSessionState(page, "interrupted", true)
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources, {
    timeout: 10_000,
  }).toBe(0)
  await setAudioSessionState(page, "active", true)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration)
    .toBeGreaterThan(secondSourceGeneration)
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources)
    .toBeGreaterThan(0)
  await invokeMediaAction(page, "stop")
})

test("a disabled automatic-resume preference pauses on interruption and never recovers", async ({ page }) => {
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

test("an ambiguous carrier Pause remains paused through focus and visibility recovery", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  await invokeProbeAction(page, "emitExternalPause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await setAudioSessionState(page, "active", true)
  await invokeProbeAction(page, "emitFocusAndVisibilityRecovery")
  await page.waitForTimeout(300)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await invokeMediaAction(page, "stop")
})

test("Previous and Next retain the session preference and route changes keep one carrier and handler owner", async ({ page }) => {
  let releaseSampleIndex: () => void = () => undefined
  const sampleIndexGate = new Promise<void>((resolve) => {
    releaseSampleIndex = () => resolve()
  })
  const sampleIndexPattern = "**/atmosphere/generative-fm/420hz-gamma-waves-for-big-brain/sample-index.json"
  const sampleIndexHandler = async (route: Route) => {
    await sampleIndexGate
    await route.abort("aborted")
  }
  await page.route(sampleIndexPattern, sampleIndexHandler)
  try {
    await installMediaOwnershipFakes(page, { resumeAfterInterruption: true })
    const player = await startProofStation(page)
    await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

    const notice = page.getByRole("region", { name: "Interruption preference" })
    await expect(notice).toBeVisible()
    await notice.getByRole("checkbox", {
      name: "Resume automatically when the interruption ends",
    }).uncheck()
    await notice.getByRole("button", { name: "Close" }).click()

    await invokeMediaAction(page, "nexttrack")
    await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.title)
      .toBe("420hz Gamma Waves for Big Brain")
    await invokeMediaAction(page, "previoustrack")
    await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.title)
      .toBe("MassageLab Proof Drone")
    releaseSampleIndex()
    await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
    await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.title)
      .toBe("MassageLab Proof Drone")
    await page.waitForTimeout(300)
    await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.title)
      .toBe("MassageLab Proof Drone")
    const handlerCallsBeforeRouteChange = (await readProbe(page)).mediaSession.handlerCalls

    await page.getByRole("link", { name: "MassageLab home" }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(async () => (await readProbe(page)).audio.created).toBe(1)
    await expect.poll(async () => page.evaluate(() => {
      const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
      return Object.values(probe.mediaSession.handlers).filter(Boolean).length
    })).toBe(5)
    await expect.poll(async () => (await readProbe(page)).mediaSession.handlerCalls)
      .toBe(handlerCallsBeforeRouteChange)

    await setAudioSessionState(page, "interrupted", true)
    await expect(player).toHaveAttribute("data-playback-state", "paused")
    await setAudioSessionState(page, "active", true)
    await page.waitForTimeout(300)
    await expect(player).toHaveAttribute("data-playback-state", "paused")
    await invokeMediaAction(page, "stop")
  } finally {
    releaseSampleIndex()
    await page.unroute(sampleIndexPattern, sampleIndexHandler)
  }
})

test("explicit Pause and Stop cannot be reversed by later focus or visibility events", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await closeInterruptionNotice(page)

  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  const pausePlayCalls = (await readProbe(page)).audio.playCalls
  await setAudioSessionState(page, "active")
  await invokeProbeAction(page, "emitFocusAndVisibilityRecovery")
  await page.waitForTimeout(300)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  expect((await readProbe(page)).audio.playCalls).toBe(pausePlayCalls)

  await invokeMediaAction(page, "play")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await invokeMediaAction(page, "stop")
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  const stopPlayCalls = (await readProbe(page)).audio.playCalls
  await setAudioSessionState(page, "active")
  await invokeProbeAction(page, "emitFocusAndVisibilityRecovery")
  await page.waitForTimeout(300)
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  expect((await readProbe(page)).audio.playCalls).toBe(stopPlayCalls)
})

test("the in-app session notice is polite, nonmodal, and keyboard dismissible", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })

  const notice = page.getByRole("region", { name: "Interruption preference" })
  await expect(notice).toBeVisible()
  await expect(notice).toHaveAttribute("aria-live", "polite")
  await expect(notice).toContainText("Calls and other audio may temporarily pause or mute this station.")
  await expect(notice.getByRole("checkbox", {
    name: "Resume automatically when the interruption ends",
  })).toBeChecked()
  const close = notice.getByRole("button", { name: "Close" })
  await close.focus()
  await page.keyboard.press("Enter")
  await expect(notice).toHaveCount(0)
  await invokeMediaAction(page, "stop")
})

test("unsupported media APIs keep ordinary in-app Play, Pause, and Stop available without a functional notice", async ({ page }) => {
  await installMediaOwnershipFakes(page, {
    includeAudioSession: false,
    mediaSessionSupported: false,
  })
  const player = await startProofStation(page)

  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(page.getByRole("region", { name: "Interruption preference" })).toHaveCount(0)
  await player.getByRole("button", { name: "Player settings" }).click()
  await expect(page.getByRole("menuitemcheckbox", { name: "Resume after interruptions" }))
    .toHaveAttribute("aria-disabled", "true")
  await page.keyboard.press("Escape")

  await player.getByRole("button", { name: "Stop", exact: true }).click()
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await player.getByRole("button", { name: "Play", exact: true }).click()
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(page.getByRole("region", { name: "Interruption preference" })).toHaveCount(0)
  await player.getByRole("button", { name: "Stop", exact: true }).click()
})

test("carrier rejection keeps generator playback without exposing interruption controls", async ({ page }) => {
  await installMediaOwnershipFakes(page, { rejectCarrierPlay: true })
  const player = await startProofStation(page)

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(page.getByRole("region", { name: "Interruption preference" })).toHaveCount(0)
  await player.getByRole("button", { name: "Player settings" }).click()
  await expect(page.getByRole("menuitemcheckbox", { name: "Resume after interruptions" }))
    .toHaveAttribute("aria-disabled", "true")
  await page.keyboard.press("Escape")
  await invokeMediaAction(page, "stop")
})
