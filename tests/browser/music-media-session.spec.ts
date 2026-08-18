import { expect, test, type APIResponse, type Locator, type Page, type Route } from "@playwright/test"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import sharp from "sharp"
import {
  renderAtmosphereStationArtworkSvg,
  resolveAtmosphereStationArtworkInput,
} from "../../lib/atmosphere/station-artwork.ts"
import {
  getAtmosphereStationById,
  getVisibleAtmosphereStations,
} from "../../lib/atmosphere/stations.js"
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
    resumeAttempts: Array<{
      calledAt: number
      latencyMs: number | null
      sameInitiatingTurn: boolean
    }>
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
    livePositionPublished: boolean
    positionStateCalls: Array<unknown>
  }
  startup: {
    carrierCalls: Array<{
      calledAt: number
      latencyMs: number | null
      sameInitiatingTurn: boolean
    }>
    phaseReached: string[]
    playInputEvents: Array<{ observedAt: number; type: string }>
    timings: Array<Record<string, unknown> & { observedAt: number }>
  }
}

type MediaOwnershipFakeOptions = {
  actualRuntimeModulePath?: string
  holdCarrierPlay?: boolean
  holdPhase?: "module-loading" | "provider-decode"
  includeAudioSession?: boolean
  mediaSessionSupported?: boolean
  rejectCarrierPlay?: boolean
  rejectLivePositionState?: boolean
  rejectRuntimeModuleLoadOnce?: boolean
  requireAudioContextResumeInPlayTurn?: boolean
  resumeAfterInterruption?: boolean
  stopAtPhase?: "piece-activation" | "scheduling"
}

async function sha256(response: APIResponse) {
  return createHash("sha256").update(await response.body()).digest("hex")
}

async function centerCropSha256(body: Buffer) {
  const crop = await sharp(body)
    .extract({ left: 128, top: 128, width: 256, height: 256 })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return createHash("sha256").update(crop).digest("hex")
}

function pngDimensions(body: Buffer) {
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
  return {
    width: body.readUInt32BE(16),
    height: body.readUInt32BE(20),
  }
}

type BrowserPngDecodeSource = { url: string } | { bytes: number[] }

/**
 * Exercises the browser's actual image decoder instead of trusting PNG header
 * metadata. Object URLs are always revoked, including on corrupt input.
 */
async function decodePngInBrowser(page: Page, source: BrowserPngDecodeSource) {
  return page.evaluate(async (decodeSource) => {
    const blob = "url" in decodeSource
      ? await (async () => {
          const response = await fetch(decodeSource.url, { cache: "no-store" })
          if (!response.ok) throw new Error(`Artwork fetch failed with ${response.status}`)
          return response.blob()
        })()
      : new Blob([Uint8Array.from(decodeSource.bytes)], { type: "image/png" })
    const objectUrl = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        throw new Error("Browser image decoder returned an incomplete PNG")
      }
      return {
        bytes: blob.size,
        height: image.naturalHeight,
        mimeType: blob.type,
        width: image.naturalWidth,
      }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }, source)
}

async function artworkSvgHash(locator: Locator) {
  const svg = await locator.locator("svg").evaluate((element) => element.outerHTML)
  return createHash("sha256").update(svg).digest("hex")
}

async function canonicalArtworkHash(page: Page, stationId: string) {
  const input = resolveAtmosphereStationArtworkInput(getAtmosphereStationById(stationId))
  expect(input).not.toBeNull()
  const normalizedSvg = await page.evaluate((svg) => {
    const template = document.createElement("template")
    template.innerHTML = svg
    return template.content.firstElementChild?.outerHTML ?? ""
  }, renderAtmosphereStationArtworkSvg(input!))
  return createHash("sha256").update(normalizedSvg).digest("hex")
}

let actualRuntimeModulePathPromise: Promise<string> | null = null

/** Resolves the current production chunk that owns the activation-sensitive proof runtime. */
async function getActualRuntimeModulePath() {
  actualRuntimeModulePathPromise = actualRuntimeModulePathPromise ?? (async () => {
    const chunkDirectory = new URL("../../.next/static/chunks/", import.meta.url)
    const entries = await readdir(chunkDirectory, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue
      const source = await readFile(new URL(entry.name, chunkDirectory), "utf8")
      if (
        source.includes('"startToneProofDrone",0')
        && source.includes('"getToneProofDroneDiagnostics",0')
      ) {
        return `/_next/static/chunks/${entry.name}`
      }
    }
    throw new Error("Could not locate the built Tone proof runtime chunk.")
  })()
  return actualRuntimeModulePathPromise
}

/** Persists a deterministic newest-first Favorites fixture before Music hydrates. */
async function installAtmosphereFavorites(page: Page, favorites: string[]) {
  await page.addInitScript((favoriteIds) => {
    localStorage.setItem("massagelab-atmosphere-v2", JSON.stringify({
      version: 2,
      favorites: favoriteIds,
      recentStations: [],
      volume: 0.4,
      miniPlayerCollapsed: false,
      visualizer: { backgroundId: "static-gradient", showClock: false },
      migrations: { legacyMusicBackground: true },
    }))
  }, favorites)
}

async function installMediaOwnershipFakes(page: Page, options: MediaOwnershipFakeOptions = {}) {
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
      resumeAttempts: [] as Array<{
        calledAt: number
        latencyMs: number | null
        sameInitiatingTurn: boolean
      }>,
      sourceGeneration: 0,
      sourceStarts: 0,
      sourceTeardowns: 0,
    }
    const audioElements: FakeAudio[] = []
    let releaseHeldPlay: (() => void) | null = null
    let releaseHeldPhase: (() => void) | null = null
    let initiatingPlayTurn = false
    let lastPlayIntentAt: number | null = null
    let phaseStopTriggered = false
    let providerDecodeCompleted = false
    const delayedDynamicScripts: Array<{ parent: Node; script: HTMLScriptElement }> = []
    const startup = {
      carrierCalls: [] as Array<{
        calledAt: number
        latencyMs: number | null
        sameInitiatingTurn: boolean
      }>,
      phaseReached: [] as string[],
      playInputEvents: [] as Array<{ observedAt: number; type: string }>,
      timings: [] as Array<Record<string, unknown> & { observedAt: number }>,
    }
    const handlers: Record<string, (() => void) | null> = {}
    const mediaSession = {
      handlers,
      handlerCalls: 0,
      metadata: null as Record<string, unknown> | null,
      playbackState: "none",
      livePositionPublished: false,
      positionStateCalls: [] as unknown[],
      setActionHandler(action: string, handler: (() => void) | null) {
        this.handlerCalls += 1
        handlers[action] = handler
      },
      setPositionState(state?: { duration?: number; position?: number; playbackRate?: number }) {
        this.positionStateCalls.push(state)
        this.livePositionPublished = state?.duration === Number.POSITIVE_INFINITY
          && state.position === 0
          && state.playbackRate === 1
        if (fakeOptions.rejectLivePositionState && state) {
          throw new DOMException("Position state rejected", "NotSupportedError")
        }
      },
    }
    const stopAtControlledPhase = (phase: "piece-activation" | "scheduling") => {
      if (fakeOptions.stopAtPhase !== phase || phaseStopTriggered) return
      phaseStopTriggered = true
      startup.phaseReached.push(phase)
      handlers.stop?.()
    }

    if (fakeOptions.holdPhase === "module-loading" || fakeOptions.rejectRuntimeModuleLoadOnce) {
      const nativeAppendChild = Node.prototype.appendChild
      const runtimeRejectionKey = "__massagelabBrowserQaRuntimeModuleRejected"
      let runtimeModuleLoadRejected = false
      try {
        runtimeModuleLoadRejected = sessionStorage.getItem(runtimeRejectionKey) === "true"
      } catch {
        // A storage-denied browser can still exercise the visible error state.
      }
      Node.prototype.appendChild = function <T extends Node>(child: T): T {
        const isTargetRuntimeModule = (
          child instanceof HTMLScriptElement
          && child.src.includes("/_next/static/chunks/")
          && (!fakeOptions.actualRuntimeModulePath || child.src.endsWith(fakeOptions.actualRuntimeModulePath))
        )
        if (
          isTargetRuntimeModule
          && fakeOptions.rejectRuntimeModuleLoadOnce
          && !runtimeModuleLoadRejected
        ) {
          runtimeModuleLoadRejected = true
          try {
            sessionStorage.setItem(runtimeRejectionKey, "true")
          } catch {
            // The in-memory guard still prevents a second rejection in this document.
          }
          startup.phaseReached.push("module-load-rejected")
          setTimeout(() => child.dispatchEvent(new Event("error")), 0)
          return child
        }
        if (
          fakeOptions.holdPhase === "module-loading"
          && isTargetRuntimeModule
          && !startup.phaseReached.includes("module-loading")
        ) {
          startup.phaseReached.push("module-loading")
          delayedDynamicScripts.push({ parent: this, script: child })
          return child
        }
        return Reflect.apply(nativeAppendChild, this, [child]) as T
      }
      releaseHeldPhase = () => {
        for (const { parent, script } of delayedDynamicScripts.splice(0)) {
          Reflect.apply(nativeAppendChild, parent, [script])
        }
      }
    }

    const getPlayButton = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null
      const accessibleLabel = target?.getAttribute("aria-label") ?? target?.textContent ?? ""
      return /^\s*Play(?:\s|$)/i.test(accessibleLabel) ? target : null
    }
    const markInitiatingPlayTurn = () => {
      initiatingPlayTurn = true
      lastPlayIntentAt = performance.now()
      setTimeout(() => {
        initiatingPlayTurn = false
        startup.phaseReached.push("initiating-play-task-ended")
      }, 0)
    }
    for (const eventName of ["pointerover", "pointerdown", "focusin"] as const) {
      document.addEventListener(eventName, (event) => {
        if (!getPlayButton(event)) return
        startup.playInputEvents.push({ observedAt: performance.now(), type: eventName })
      }, { capture: true })
    }
    document.addEventListener("pointerup", (event) => {
      if (!getPlayButton(event)) return
      startup.playInputEvents.push({ observedAt: performance.now(), type: "pointerup" })
      if (
        event instanceof PointerEvent
        && (event.pointerType === "touch" || event.pointerType === "pen")
        && event.isPrimary
      ) markInitiatingPlayTurn()
    }, { capture: true })
    document.addEventListener("click", (event) => {
      if (!getPlayButton(event)) return
      startup.playInputEvents.push({ observedAt: performance.now(), type: "click" })
      markInitiatingPlayTurn()
    }, { capture: true })

    const recordAudioContextResumeAttempt = () => {
      const calledAt = performance.now()
      audioContext.resumeAttempts.push({
        calledAt,
        latencyMs: lastPlayIntentAt === null ? null : calledAt - lastPlayIntentAt,
        sameInitiatingTurn: initiatingPlayTurn,
      })
    }

    class FakeAudio extends EventTarget {
      loop = false
      preload = ""
      paused = true
      private sourceAttribute: string | null = null

      constructor() {
        super()
        audio.created += 1
        audioElements.push(this)
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
        const calledAt = performance.now()
        startup.carrierCalls.push({
          calledAt,
          latencyMs: lastPlayIntentAt === null ? null : calledAt - lastPlayIntentAt,
          sameInitiatingTurn: initiatingPlayTurn,
        })
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
    const forcedSuspendedContexts = new WeakMap<object, boolean>()
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
              const startsGeneratorGeneration = audioContext.activeGeneratorSources === 0
              audioContext.activeGeneratorSources += 1
              if (startsGeneratorGeneration) audioContext.generatorGeneration += 1
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
      const resume = Reflect.get(context, "resume")
      if (typeof resume === "function") {
        replaceMethod(context, "resume", function (this: object, ...args: unknown[]) {
          recordAudioContextResumeAttempt()
          if (fakeOptions.requireAudioContextResumeInPlayTurn && !initiatingPlayTurn) {
            return Promise.reject(new DOMException("AudioContext resume lost user activation", "NotAllowedError"))
          }
          forcedSuspendedContexts.set(this, false)
          return Reflect.apply(resume, this, args)
        })
      }
      const decodeAudioData = Reflect.get(context, "decodeAudioData")
      if (typeof decodeAudioData === "function") {
        replaceMethod(context, "decodeAudioData", function (this: object, ...args: unknown[]) {
          const decoded = Reflect.apply(decodeAudioData, this, args)
          if (!decoded || typeof Reflect.get(decoded, "then") !== "function") return decoded
          return Promise.resolve(decoded).then(async (buffer) => {
            providerDecodeCompleted = true
            if (fakeOptions.holdPhase === "provider-decode" && !startup.phaseReached.includes("provider-decode")) {
              startup.phaseReached.push("provider-decode")
              await new Promise<void>((resolve) => {
                releaseHeldPhase = resolve
              })
            }
            return buffer
          })
        })
      }
      for (const factory of ["createBufferSource", "createOscillator"] as const) {
        const original = Reflect.get(context, factory)
        if (typeof original !== "function") continue
        replaceMethod(context, factory, function (this: object, ...args: unknown[]) {
          const source = Reflect.apply(original, this, args)
          return source && typeof source === "object"
            ? instrumentScheduledSource(source, factory === "createOscillator" ? "oscillator" : "buffer-source")
            : source
        })
      }
      const createGain = Reflect.get(context, "createGain")
      if (typeof createGain === "function") {
        replaceMethod(context, "createGain", function (this: object, ...args: unknown[]) {
          const node = Reflect.apply(createGain, this, args)
          if (providerDecodeCompleted) stopAtControlledPhase("piece-activation")
          return node
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
        // Instrument its prototype and interpose the lookup without replacing that identity.
        instrumentAudioContext(NativeAudioContext.prototype)
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
          const context = Reflect.construct(NativeAudioContext, args)
          if (fakeOptions.requireAudioContextResumeInPlayTurn) {
            forcedSuspendedContexts.set(context, true)
            Object.defineProperty(context, "state", {
              configurable: true,
              get: () => forcedSuspendedContexts.get(context) ? "suspended" : "running",
            })
          }
          return instrumentAudioContext(context)
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

      class FakeWaveShaperNode extends FakeAudioNode {
        private curveValue: Float32Array | null = null

        get curve() { return this.curveValue }
        set curve(value: Float32Array | null) { this.curveValue = value }
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
        private trackOnlineLifecycle: boolean

        constructor(trackOnlineLifecycle: boolean | object = true) {
          super()
          this.trackOnlineLifecycle = trackOnlineLifecycle !== false
          if (this.trackOnlineLifecycle) audioContext.created += 1
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
          return this.trackOnlineLifecycle ? instrumentScheduledSource(node, "buffer-source") : node
        }
        createChannelMerger(numberOfInputs = 6) {
          const node = new FakeAudioNode(this)
          node.numberOfInputs = numberOfInputs
          return node
        }
        createChannelSplitter(numberOfOutputs = 6) {
          const node = new FakeAudioNode(this)
          node.numberOfOutputs = numberOfOutputs
          return node
        }
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
          const node = Object.assign(new FakeAudioNode(this), {
            detune: new FakeAudioParam(0),
            frequency: new FakeAudioParam(440),
            onended: null,
            setPeriodicWave() {},
            start() {},
            stop() {},
            type: "sine",
          })
          if (!this.trackOnlineLifecycle) return node
          return instrumentScheduledSource(node, "oscillator", () => {
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
          return Object.assign(new FakeWaveShaperNode(this), { curve: null, oversample: "none" })
        }
        decodeAudioData() { return Promise.resolve(new FakeAudioBuffer({ length: 1, sampleRate: this.sampleRate })) }
        async resume() {
          recordAudioContextResumeAttempt()
          if (fakeOptions.requireAudioContextResumeInPlayTurn && !initiatingPlayTurn) {
            throw new DOMException("AudioContext resume lost user activation", "NotAllowedError")
          }
          this.state = "running"
          this.dispatchEvent(new Event("statechange"))
        }
        suspend() { this.state = "suspended"; this.dispatchEvent(new Event("statechange")); return Promise.resolve() }
      }

      class FakeOfflineAudioContext extends FakeAudioContext {
        length: number
        oncomplete: ((event: Event & { renderedBuffer: FakeAudioBuffer }) => void) | null = null
        private numberOfChannels: number

        constructor(numberOfChannels: number, length: number, sampleRate: number) {
          super(false)
          this.length = length
          this.numberOfChannels = numberOfChannels
          this.sampleRate = sampleRate
          this.destination.channelCount = numberOfChannels
        }

        startRendering() {
          const renderedBuffer = new FakeAudioBuffer({
            length: this.length,
            numberOfChannels: this.numberOfChannels,
            sampleRate: this.sampleRate,
          })
          this.currentTime = renderedBuffer.duration
          this.state = "closed"
          const event = new Event("complete") as Event & { renderedBuffer: FakeAudioBuffer }
          Object.defineProperty(event, "renderedBuffer", { value: renderedBuffer })
          this.oncomplete?.(event)
          this.dispatchEvent(new Event("statechange"))
          return Promise.resolve(renderedBuffer)
        }
      }

      Object.defineProperties(window, {
        AudioBuffer: { configurable: true, value: FakeAudioBuffer },
        AudioContext: { configurable: true, value: FakeAudioContext },
        AudioNode: { configurable: true, value: FakeAudioNode },
        AudioParam: { configurable: true, value: FakeAudioParam },
        BaseAudioContext: { configurable: true, value: FakeAudioContext },
        OfflineAudioContext: { configurable: true, value: FakeOfflineAudioContext },
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
        const currentAudio = audioElements.at(-1)
        if (!currentAudio) return
        currentAudio.paused = true
        currentAudio.dispatchEvent(new Event("pause"))
      },
      releaseHeldPlay() {
        fakeOptions.holdCarrierPlay = false
        releaseHeldPlay?.()
        releaseHeldPlay = null
      },
      releaseHeldPhase() {
        fakeOptions.holdPhase = undefined
        releaseHeldPhase?.()
        releaseHeldPhase = null
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
      startup,
    })
    window.addEventListener("massagelab:atmosphere-startup-timing", (event) => {
      startup.timings.push({
        ...(event instanceof CustomEvent && event.detail && typeof event.detail === "object"
          ? event.detail as Record<string, unknown>
          : {}),
        observedAt: performance.now(),
      })
      stopAtControlledPhase("scheduling")
    })
  }, options)
}

/** Prevents a route-controlled test from losing requests to a claimed PWA service worker. */
async function installRouteControlledServiceWorkerGuard(page: Page) {
  await page.addInitScript(() => {
    const state = { attempts: 0, forwarded: 0 }
    Reflect.set(window, "__massagelabRouteTestServiceWorker", state)
    if (!("serviceWorker" in navigator)) return

    const container = navigator.serviceWorker
    Object.defineProperty(container, "register", {
      configurable: true,
      value: () => {
        state.attempts += 1
        return Promise.reject(new DOMException(
          "Route-controlled browser QA blocks service-worker registration.",
          "NotSupportedError",
        ))
      },
    })
  })
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

/** Invokes a synchronous Media Session handler and returns its exact page-clock intent time. */
async function invokeMediaActionAt(page: Page, action: string) {
  return page.evaluate((name) => {
    const invokedAt = Date.now()
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    probe.mediaSession.handlers[name]?.()
    return invokedAt
  }, action)
}

const PAGE_CLOCK_PAUSE_LEAD_MS = 10_000

/** Pauses just ahead of the moving fake clock after immediate teardown has settled. */
async function pausePageClockAhead(page: Page) {
  const pausedAt = await page.evaluate((leadMs) => Date.now() + leadMs, PAGE_CLOCK_PAUSE_LEAD_MS)
  await page.clock.pauseAt(pausedAt)
  return pausedAt
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

async function releaseHeldStartupPhase(page: Page) {
  await page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as
      | { releaseHeldPhase?: () => void }
      | undefined
    probe?.releaseHeldPhase?.()
  }).catch(() => undefined)
}

async function waitForStartupPhase(page: Page, phase: string) {
  await expect.poll(async () => {
    const probe = await readProbe(page)
    return probe.startup.phaseReached.includes(phase)
  }, { timeout: 45_000 }).toBe(true)
}

async function openStation(page: Page, station: {
  category: string
  id: string
  title: string
}) {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  if (station.category !== "Treatment room starters") {
    await page.getByRole("group", { name: "Station category" })
      .getByRole("button", { name: station.category })
      .click()
  }
  await centerCarouselItem(page, station.id, "Next station")
  return page.getByRole("button", { name: `Play ${station.title}` })
}

async function waitForStationTiming(page: Page, stationId: string, previousCount: number) {
  await expect.poll(async () => {
    const probe = await readProbe(page)
    return probe.startup.timings.filter((timing) => timing.stationId === stationId).length
  }, { timeout: 60_000 }).toBe(previousCount + 1)
  return page.evaluate(({ expectedStationId, expectedPreviousCount }) => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    const matches = probe.startup.timings.filter((timing) => timing.stationId === expectedStationId)
    return {
      carrier: probe.startup.carrierCalls.at(-1) ?? null,
      timing: matches[expectedPreviousCount] ?? null,
    }
  }, { expectedStationId: stationId, expectedPreviousCount: previousCount })
}

async function beginPlaybackStateHistory(page: Page) {
  await page.evaluate(() => {
    const history: string[] = []
    let lastState: string | null = null
    const recordCurrentState = () => {
      const player = document.querySelector<HTMLElement>("[data-testid='music-player-toolbar']")
      const currentState = player?.dataset.playbackState ?? null
      if (currentState === null || currentState === lastState) return
      lastState = currentState
      history.push(currentState)
    }
    recordCurrentState()
    const observer = new MutationObserver(() => {
      recordCurrentState()
    })
    observer.observe(document.documentElement, {
      attributeFilter: ["data-playback-state"],
      attributes: true,
      childList: true,
      subtree: true,
    })
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

/** Activates setup-only controls without depending on animated pointer stability. */
async function activateSetupButton(button: Locator) {
  await expect(button).toBeVisible()
  await expect(button).toBeEnabled()
  await button.focus()
  await button.press("Enter")
}

async function startProofStation(page: Page) {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await activateSetupButton(page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }))
  return page.getByTestId("music-player-toolbar")
}

async function readVinylMotion(vinyl: Locator) {
  return vinyl.locator(".ml-station-vinyl-disc").evaluate((disc) => {
    const styles = getComputedStyle(disc)
    const animation = disc.getAnimations()[0]
    return {
      animationName: styles.animationName,
      animationPlayState: styles.animationPlayState,
      animationDuration: styles.animationDuration,
      animationState: animation?.playState ?? null,
      prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      transform: styles.transform,
    }
  })
}

async function expectVinylTransformFrozen(vinyl: Locator) {
  await expect.poll(() => vinyl.locator(".ml-station-vinyl-disc").evaluate((disc) => (
    disc.getAnimations()[0]?.pending ?? false
  ))).toBe(false)
  const before = (await readVinylMotion(vinyl)).transform
  await vinyl.page().waitForTimeout(250)
  expect((await readVinylMotion(vinyl)).transform).toBe(before)
}

/** Returns the first enabled station Play action already intersecting the current viewport without scrolling it. */
async function firstEnabledStationPlayInViewport(carousel: Locator) {
  const playActions = carousel.locator("[data-carousel-primary-action]:not([disabled])")
  const findVisibleIndex = () => playActions.evaluateAll((buttons) => {
    return buttons.findIndex((button) => {
      const bounds = button.getBoundingClientRect()
      return bounds.width > 0
        && bounds.height > 0
        && bounds.bottom > 0
        && bounds.right > 0
        && bounds.top < window.innerHeight
        && bounds.left < window.innerWidth
    })
  })
  await expect.poll(findVisibleIndex).toBeGreaterThanOrEqual(0)
  const visibleIndex = await findVisibleIndex()
  return playActions.nth(visibleIndex)
}

type PrimaryPointerType = "mouse" | "pen" | "touch"

/** Dispatches one trusted-shape raw pointer event without asking Playwright to synthesize a click. */
async function dispatchPrimaryPointerEvent(
  play: Locator,
  type: "pointercancel" | "pointerdown" | "pointermove" | "pointerup",
  {
    buttons = type === "pointerdown" || type === "pointermove" ? 1 : 0,
    clientX = 100,
    clientY = 100,
    isPrimary = true,
    pointerId = 41,
    pointerType = "touch",
  }: {
    buttons?: number
    clientX?: number
    clientY?: number
    isPrimary?: boolean
    pointerId?: number
    pointerType?: PrimaryPointerType
  } = {},
) {
  await play.dispatchEvent(type, {
    bubbles: true,
    button: 0,
    buttons,
    cancelable: true,
    clientX,
    clientY,
    isPrimary,
    pointerId,
    pointerType,
  })
}

async function openReadyStationPlay(page: Page) {
  await installMediaOwnershipFakes(page)
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  const play = await firstEnabledStationPlayInViewport(carousel)
  await expect(play).toBeVisible()
  await expect(play).toBeEnabled()
  await expect(play).toBeInViewport()
  return play
}

async function stationCardForPrimaryAction(page: Page, play: Locator) {
  const cardId = await play.evaluate((button) => button.closest("article")?.id)
  if (!cardId) throw new Error("Station card id is unavailable")
  return page.locator(`#${cardId}`)
}

test("Safari identity path instruments the native AudioContext source lifecycle", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Chromium supplies the native AudioContext for this branch contract.")
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  })
  const page = await context.newPage()

  try {
    await installMediaOwnershipFakes(page)
    await page.goto("data:text/html,<title>native AudioContext probe</title>")
    const probe = await page.evaluate(() => {
      const audioContext = new AudioContext()
      audioContext.createOscillator().start()
      return (Reflect.get(window, "__massagelabMediaProbe") as MediaProbe).audioContext
    })

    expect(probe.constructorReads).toBeGreaterThan(0)
    expect(probe.activeGeneratorSources).toBe(1)
  } finally {
    await context.close()
  }
})

for (const activation of ["tap", "click", "keyboard Enter", "keyboard Space"] as const) {
  test(`first station Play activation accepts one ${activation} command after carousel readiness`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "webkit-media-smoke", "Chromium owns the primary-input regression matrix.")
    test.skip(
      activation === "tap" && testInfo.project.name !== "mobile-chromium",
      "Touchscreen tap coverage runs in mobile Chromium.",
    )
    await installMediaOwnershipFakes(page)
    await page.goto("/music", { waitUntil: "domcontentloaded" })

    const carousel = page.getByRole("region", { name: "Station carousel" })
    await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
    const play = await firstEnabledStationPlayInViewport(carousel)
    const toolbar = page.getByTestId("music-player-toolbar")
    await expect(play).toBeVisible()
    await beginPlaybackStateHistory(page)

    try {
      await expect(play).toBeInViewport()
      if (activation === "tap") await play.tap()
      if (activation === "click") await play.click()
      if (activation === "keyboard Enter" || activation === "keyboard Space") {
        await play.focus()
        await page.keyboard.press(activation === "keyboard Enter" ? "Enter" : "Space")
      }
      if (activation === "tap") await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
      await expect(toolbar).toHaveAttribute("data-playback-state", /loading|playing/)
      await expect(toolbar.getByRole("button", { name: "Stop", exact: true })).toBeVisible()
      await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration)
        .toBeGreaterThan(0)
      const firstGeneratorGeneration = (await readProbe(page)).audioContext.generatorGeneration
      await page.waitForTimeout(250)
      const stabilizedProbe = await readProbe(page)
      expect(stabilizedProbe.audio.playCalls).toBe(1)
      expect(stabilizedProbe.audioContext.generatorGeneration).toBe(firstGeneratorGeneration)
    } finally {
      const history = await finishPlaybackStateHistory(page)
      expect(history).not.toContain("stopped-after-accepted-play")
    }
  })
}

for (const pointerType of ["touch", "pen"] as const) {
  test(`${pointerType} pointerup without click starts one ready station session`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
    const play = await openReadyStationPlay(page)
    const toolbar = page.getByTestId("music-player-toolbar")

    // Match the physical report: Play has been stable and enabled for five seconds.
    await page.waitForTimeout(5_000)
    await dispatchPrimaryPointerEvent(play, "pointerdown", { pointerType })
    expect((await readProbe(page)).audio.playCalls).toBe(0)
    expect((await readProbe(page)).audioContext.generatorGeneration).toBe(0)
    await expect(toolbar).toHaveCount(0)

    await dispatchPrimaryPointerEvent(play, "pointerup", { pointerType })
    await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
    await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration).toBe(1)
    await expect(toolbar).toHaveAttribute("data-playback-state", /loading|playing/)

    await page.waitForTimeout(250)
    expect((await readProbe(page)).audio.playCalls).toBe(1)
    expect((await readProbe(page)).audioContext.generatorGeneration).toBe(1)
  })
}

test("non-primary touch cannot activate the centered station Play pointer adapter", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)

  await dispatchPrimaryPointerEvent(play, "pointerdown", { isPrimary: false })
  await dispatchPrimaryPointerEvent(play, "pointerup", { isPrimary: false })
  await page.waitForTimeout(250)

  expect((await readProbe(page)).audio.playCalls).toBe(0)
  expect((await readProbe(page)).audioContext.generatorGeneration).toBe(0)
  await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
})

test("secondary touch does not replace the primary Play pointer intent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)

  await dispatchPrimaryPointerEvent(play, "pointerdown", { pointerId: 41 })
  await dispatchPrimaryPointerEvent(play, "pointerdown", { isPrimary: false, pointerId: 42 })
  await dispatchPrimaryPointerEvent(play, "pointerup", { isPrimary: false, pointerId: 42 })
  expect((await readProbe(page)).audio.playCalls).toBe(0)
  await dispatchPrimaryPointerEvent(play, "pointerup", { pointerId: 41 })

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration).toBe(1)
})

test("touch pointerup suppresses its correlated retargeted synthetic click", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)

  await play.evaluate((button) => {
    const pointer = (type: string, buttons: number) => new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
    })
    button.dispatchEvent(pointer("pointerdown", 1))
    button.dispatchEvent(pointer("pointerup", 0))
    const details = button.closest("article")?.querySelector<HTMLElement>("[data-carousel-station-details]")
    if (!details) throw new Error("Station details surface is unavailable")
    details.dispatchEvent(new PointerEvent("click", {
      bubbles: true,
      button: 0,
      buttons: 0,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      detail: 1,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
      view: window,
    }))
  })

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration).toBe(1)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.waitForTimeout(250)
  expect((await readProbe(page)).audio.playCalls).toBe(1)
  expect((await readProbe(page)).audioContext.generatorGeneration).toBe(1)
})

test("touch pointerup suppresses its 750ms delayed same-control compatibility click", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)
  const toolbar = page.getByTestId("music-player-toolbar")

  await play.evaluate(async (button) => {
    const pointer = (type: string, buttons: number) => new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
    })
    button.dispatchEvent(pointer("pointerdown", 1))
    button.dispatchEvent(pointer("pointerup", 0))
    await new Promise((resolve) => window.setTimeout(resolve, 750))
    button.dispatchEvent(new PointerEvent("click", {
      bubbles: true,
      button: 0,
      buttons: 0,
      cancelable: true,
      detail: 1,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
      view: window,
    }))
  })

  await expect(toolbar).toHaveAttribute("data-playback-state", /loading|playing/)
  expect((await readProbe(page)).audio.playCalls).toBe(1)
  expect((await readProbe(page)).audio.pauseCalls).toBe(0)
  expect((await readProbe(page)).audioContext.generatorGeneration).toBe(1)
})

test("a fresh same-id touch retires prior click suppression", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)

  await play.evaluate((button) => {
    const pointer = (target: Element, type: string, buttons: number) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
    }))
    pointer(button, "pointerdown", 1)
    pointer(button, "pointerup", 0)
    const details = button.closest("article")?.querySelector<HTMLElement>("[data-carousel-station-details]")
    if (!details) throw new Error("Station details surface is unavailable")
    pointer(details, "pointerdown", 1)
    pointer(details, "pointerup", 0)
    details.dispatchEvent(new PointerEvent("click", {
      bubbles: true,
      button: 0,
      buttons: 0,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      detail: 1,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
      view: window,
    }))
  })

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration).toBe(1)
  await expect(page.getByRole("dialog")).toBeVisible()
})

test("touch synthetic click after the suppression window follows its normal target", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)
  const card = await stationCardForPrimaryAction(page, play)
  const details = card.locator("[data-carousel-station-details]")

  await dispatchPrimaryPointerEvent(play, "pointerdown")
  await dispatchPrimaryPointerEvent(play, "pointerup")
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration).toBe(1)
  const clickIdentity = await details.evaluate(async (target) => {
    await new Promise((resolve) => window.setTimeout(resolve, 1_100))
    const click = new PointerEvent("click", {
      bubbles: true,
      button: 0,
      buttons: 0,
      cancelable: true,
      detail: 1,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
      view: window,
    })
    target.dispatchEvent(click)
    return {
      detail: click.detail,
      pointerId: click.pointerId,
      pointerType: click.pointerType,
    }
  })

  expect(clickIdentity).toEqual({ detail: 1, pointerId: 41, pointerType: "touch" })
  await expect(page.getByRole("dialog")).toBeVisible()
  expect((await readProbe(page)).audio.playCalls).toBe(1)
  expect((await readProbe(page)).audioContext.generatorGeneration).toBe(1)
})

for (const invalidSequence of [
  "movement over 10px",
  "mismatched pointer id",
  "pointer cancellation",
  "mouse pointerup",
] as const) {
  test(`${invalidSequence} does not activate the centered station Play pointer adapter`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
    const play = await openReadyStationPlay(page)
    const pointerType = invalidSequence === "mouse pointerup" ? "mouse" : "touch"

    await dispatchPrimaryPointerEvent(play, "pointerdown", { pointerType })
    expect((await readProbe(page)).audio.playCalls).toBe(0)
    if (invalidSequence === "movement over 10px") {
      await dispatchPrimaryPointerEvent(play, "pointermove", { clientX: 111, pointerType })
      await dispatchPrimaryPointerEvent(play, "pointerup", { clientX: 111, pointerType })
    } else if (invalidSequence === "mismatched pointer id") {
      await dispatchPrimaryPointerEvent(play, "pointerup", { pointerId: 42, pointerType })
    } else if (invalidSequence === "pointer cancellation") {
      await dispatchPrimaryPointerEvent(play, "pointercancel", { pointerType })
      await dispatchPrimaryPointerEvent(play, "pointerup", { pointerType })
    } else {
      await dispatchPrimaryPointerEvent(play, "pointerup", { pointerType })
    }

    await page.waitForTimeout(250)
    expect((await readProbe(page)).audio.playCalls).toBe(0)
    expect((await readProbe(page)).audioContext.generatorGeneration).toBe(0)
    await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
  })
}

test("touch movement exactly 10px remains eligible for one station Play", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)

  await dispatchPrimaryPointerEvent(play, "pointerdown")
  await dispatchPrimaryPointerEvent(play, "pointermove", { clientX: 106, clientY: 108 })
  expect((await readProbe(page)).audio.playCalls).toBe(0)
  await dispatchPrimaryPointerEvent(play, "pointerup", { clientX: 106, clientY: 108 })

  await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration).toBe(1)
})

for (const mismatchedType of ["mouse", "pen"] as const) {
  test(`touch pointer intent rejects and consumes a same-id ${mismatchedType} pointerup`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
    const play = await openReadyStationPlay(page)

    await dispatchPrimaryPointerEvent(play, "pointerdown", { pointerType: "touch" })
    await dispatchPrimaryPointerEvent(play, "pointerup", { pointerType: mismatchedType })
    await page.waitForTimeout(100)
    expect((await readProbe(page)).audio.playCalls).toBe(0)
    expect((await readProbe(page)).audioContext.generatorGeneration).toBe(0)

    await dispatchPrimaryPointerEvent(play, "pointerup", { pointerType: "touch" })
    await page.waitForTimeout(250)
    expect((await readProbe(page)).audio.playCalls).toBe(0)
    expect((await readProbe(page)).audioContext.generatorGeneration).toBe(0)
  })
}

test("direct far pointerup consumes touch intent before a later in-range pointerup", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)

  await dispatchPrimaryPointerEvent(play, "pointerdown")
  await dispatchPrimaryPointerEvent(play, "pointerup", { clientX: 111 })
  expect((await readProbe(page)).audio.playCalls).toBe(0)
  await dispatchPrimaryPointerEvent(play, "pointerup")
  await page.waitForTimeout(250)

  expect((await readProbe(page)).audio.playCalls).toBe(0)
  expect((await readProbe(page)).audioContext.generatorGeneration).toBe(0)
})

test("same-id pointerup retargeted outside Play consumes the touch intent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Raw physical-pointer coverage is mobile-owned.")
  const play = await openReadyStationPlay(page)
  const card = await stationCardForPrimaryAction(page, play)
  const details = card.locator("[data-carousel-station-details]")

  await dispatchPrimaryPointerEvent(play, "pointerdown")
  await dispatchPrimaryPointerEvent(details, "pointerup")
  expect((await readProbe(page)).audio.playCalls).toBe(0)
  await dispatchPrimaryPointerEvent(play, "pointerup")
  await page.waitForTimeout(250)

  expect((await readProbe(page)).audio.playCalls).toBe(0)
  expect((await readProbe(page)).audioContext.generatorGeneration).toBe(0)
})

test("one cold touch starts the generator while carrier readiness is held", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Physical-touch regression is mobile-owned.")
  await installMediaOwnershipFakes(page, {
    holdCarrierPlay: true,
    requireAudioContextResumeInPlayTurn: true,
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  const play = carousel.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })
  await play.tap()
  await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "loading")
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration).toBe(1)
  await releaseHeldCarrierPlay(page)
  await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "playing")
  expect((await readProbe(page)).audio.playCalls).toBe(1)
})

test("fresh-page cold runtime exposes only an activation-safe centered Play action", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Physical-touch regression is mobile-owned.")
  const actualRuntimeModulePath = await getActualRuntimeModulePath()
  await installMediaOwnershipFakes(page, {
    actualRuntimeModulePath,
    holdPhase: "module-loading",
    requireAudioContextResumeInPlayTurn: true,
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })

  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await waitForStartupPhase(page, "module-loading")
  const primaryAction = carousel.locator("[data-carousel-primary-action]")
  await expect(primaryAction).toBeVisible()
  await expect(primaryAction).toBeInViewport()
  expect((await readProbe(page)).startup.playInputEvents).toEqual([])
  expect(await primaryAction.evaluate((button) => document.activeElement === button)).toBe(false)

  const generationBeforeTap = (await readProbe(page)).audioContext.generatorGeneration
  const initiallyPreparing = /^Preparing\b/i.test(await primaryAction.getAttribute("aria-label") ?? "")
  let centeredPlay: Locator
  if (initiallyPreparing) {
    await expect(primaryAction).toBeDisabled()
    await releaseHeldStartupPhase(page)
    centeredPlay = carousel.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })
    await expect(centeredPlay).toBeEnabled({ timeout: 30_000 })
  } else {
    centeredPlay = carousel.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })
  }

  await centeredPlay.tap()
  await waitForStartupPhase(page, "initiating-play-task-ended")
  expect((await readProbe(page)).audio.playCalls).toBe(1)
  if (!initiallyPreparing) await releaseHeldStartupPhase(page)
  await expect.poll(async () => (await readProbe(page)).audioContext.resumeAttempts.length, {
    timeout: 30_000,
  }).toBeGreaterThan(0)

  const firstTapProbe = await readProbe(page)
  const firstTapGenerationCount = firstTapProbe.audioContext.generatorGeneration - generationBeforeTap
  if (firstTapGenerationCount === 0) {
    expect(firstTapProbe.audioContext.resumeAttempts.at(-1)?.sameInitiatingTurn).toBe(false)
    const retryPlay = page.getByTestId("music-player-toolbar")
      .getByRole("button", { name: "Play", exact: true })
    await retryPlay.tap()
    await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "playing", {
      timeout: 30_000,
    })
    await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration)
      .toBe(generationBeforeTap + 1)
  }

  expect(firstTapGenerationCount).toBe(1)
  expect(firstTapProbe.audioContext.resumeAttempts).toHaveLength(1)
  expect(firstTapProbe.audioContext.resumeAttempts[0]).toMatchObject({ sameInitiatingTurn: true })
  await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "playing")
})

test("Favorites direct playback keeps the provider as the single owner during loading and while active", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Touch Favorites playback is mobile-owned.")
  await installAtmosphereFavorites(page, ["observable-streams-probe", "mlab-proof-drone"])
  await installMediaOwnershipFakes(page, {
    actualRuntimeModulePath: await getActualRuntimeModulePath(),
    holdPhase: "module-loading",
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/music", { waitUntil: "domcontentloaded" })

  const favorites = page.getByRole("region", { name: "Favorites" })
  const observable = favorites.getByRole("button", { name: "Observable Streams" })
  const proofDrone = favorites.getByRole("button", { name: "MassageLab Proof Drone" })
  await expect(observable).toBeVisible()
  await observable.click()
  await waitForStartupPhase(page, "module-loading")

  await expect(favorites).toHaveAttribute("aria-busy", "true")
  await expect(favorites.getByRole("status")).toHaveText("Favorites are unavailable while audio prepares.")
  await expect(observable).toBeDisabled()
  await expect(proofDrone).toBeDisabled()
  expect((await readProbe(page)).audio.playCalls).toBe(1)

  await releaseHeldStartupPhase(page)
  const player = page.getByTestId("music-player-toolbar")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  const playingTile = favorites.getByRole("button", { name: "Observable Streams playing" })
  await expect(playingTile).toHaveAttribute("aria-current", "true")
  await expect(playingTile).toHaveAttribute("aria-disabled", "true")

  const probeBeforeRepeat = await readProbe(page)
  await playingTile.focus()
  await page.keyboard.press("Enter")
  await page.waitForTimeout(250)
  const probeAfterRepeat = await readProbe(page)
  expect(probeAfterRepeat.audio.playCalls).toBe(probeBeforeRepeat.audio.playCalls)
  expect(probeAfterRepeat.audioContext.generatorGeneration).toBe(probeBeforeRepeat.audioContext.generatorGeneration)
})

test("runtime readiness failure exposes a visible retry before Play becomes actionable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Physical-touch regression is mobile-owned.")
  const actualRuntimeModulePath = await getActualRuntimeModulePath()
  await installMediaOwnershipFakes(page, {
    actualRuntimeModulePath,
    rejectRuntimeModuleLoadOnce: true,
    requireAudioContextResumeInPlayTurn: true,
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })

  const carousel = page.getByRole("region", { name: "Station carousel" })
  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  await waitForStartupPhase(page, "module-load-rejected")
  await expect(carousel.getByText("Audio setup failed. Try again.")).toBeVisible()
  const retry = carousel.getByRole("button", { name: "Retry audio setup" })
  await expect(retry).toBeEnabled()
  await page.evaluate(() => {
    const carouselRoot = document.querySelector("[aria-label='Station carousel']")
    const labels: string[] = []
    const recordLabel = () => {
      const action = carouselRoot?.querySelector("[data-carousel-primary-action]")
      const label = action?.getAttribute("aria-label")
      if (label && labels.at(-1) !== label) labels.push(label)
    }
    recordLabel()
    const observer = new MutationObserver(recordLabel)
    if (carouselRoot) observer.observe(carouselRoot, {
      attributes: true,
      childList: true,
      subtree: true,
    })
    Reflect.set(window, "__massagelabRuntimeReadinessHistory", { labels, observer })
  })

  await retry.hover()
  await expect(retry).toBeEnabled()
  await expect(carousel.getByText("Audio setup failed. Try again.")).toBeVisible()
  await retry.focus()
  await expect(retry).toBeFocused()
  await expect(retry).toBeEnabled()
  await expect(carousel.getByText("Audio setup failed. Try again.")).toBeVisible()
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  const readinessLabels = await page.evaluate(() => {
    const history = Reflect.get(window, "__massagelabRuntimeReadinessHistory") as {
      labels: string[]
      observer: MutationObserver
    }
    history.observer.disconnect()
    return history.labels
  })
  expect(readinessLabels).toEqual(["Retry audio setup"])

  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    retry.tap(),
  ])

  const reloadedCarousel = page.getByRole("region", { name: "Station carousel" })
  await expect(reloadedCarousel).toHaveAttribute("data-carousel-ready", "true")
  const play = reloadedCarousel.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })
  await expect(play).toBeEnabled({ timeout: 30_000 })
  const generationBeforeTap = (await readProbe(page)).audioContext.generatorGeneration
  await play.tap()
  await expect(page.getByTestId("music-player-toolbar")).toHaveAttribute("data-playback-state", "playing", {
    timeout: 30_000,
  })
  await expect.poll(async () => (await readProbe(page)).audioContext.generatorGeneration)
    .toBe(generationBeforeTap + 1)
  expect((await readProbe(page)).audioContext.resumeAttempts.at(-1)).toMatchObject({ sameInitiatingTurn: true })
})

async function closeInterruptionNotice(page: Page) {
  const notice = page.getByRole("region", { name: "Interruption preference" })
  if (await notice.isVisible()) {
    await activateSetupButton(notice.getByRole("button", { name: "Close" }))
  }
  await expect(notice).toHaveCount(0)
}

test("immediate carrier claim precedes a held sample-index response and Stop stays authoritative", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Deterministic startup timing coverage runs in desktop Chromium.")
  await installMediaOwnershipFakes(page)
  let releaseSampleIndex: () => void = () => undefined
  let sampleIndexRequested: () => void = () => undefined
  const sampleIndexRequest = new Promise<void>((resolve) => {
    sampleIndexRequested = resolve
  })
  const sampleIndexGate = new Promise<void>((resolve) => {
    releaseSampleIndex = resolve
  })
  const sampleIndexPattern = "**/observable-streams-vsco-adaptation/sample-index*.json"
  const sampleIndexHandler = async (route: Route) => {
    sampleIndexRequested()
    await sampleIndexGate
    await route.continue()
  }
  await page.route(sampleIndexPattern, sampleIndexHandler)
  let stateHistoryStarted = false
  try {
    const play = await openStation(page, {
      category: "Treatment room starters",
      id: "observable-streams-probe",
      title: "Observable Streams",
    })
    await play.click()
    await sampleIndexRequest
    const player = page.getByTestId("music-player-toolbar")
    await expect(player).toHaveAttribute("data-playback-state", "loading")
    const carrier = (await readProbe(page)).startup.carrierCalls.at(-1)
    expect(carrier).toMatchObject({ sameInitiatingTurn: true })
    expect(carrier?.latencyMs).not.toBeNull()
    expect(carrier?.latencyMs ?? -1).toBeGreaterThanOrEqual(0)

    await invokeMediaAction(page, "stop")
    await expect(player).toHaveAttribute("data-playback-state", "stopped")
    await beginPlaybackStateHistory(page)
    stateHistoryStarted = true
    releaseSampleIndex()
    await page.waitForTimeout(1_800)
    const states = await finishPlaybackStateHistory(page)
    stateHistoryStarted = false
    expect(states).not.toContain("playing")
    expect((await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  } finally {
    if (stateHistoryStarted) await finishPlaybackStateHistory(page)
    releaseSampleIndex()
    await page.unroute(sampleIndexPattern, sampleIndexHandler)
  }
})

test("runtime readiness withholds Play until module loading completes without a late start", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Deterministic startup timing coverage runs in desktop Chromium.")
  await installMediaOwnershipFakes(page, {
    holdPhase: "module-loading",
    actualRuntimeModulePath: await getActualRuntimeModulePath(),
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  let stateHistoryStarted = false
  try {
    await waitForStartupPhase(page, "module-loading")
    const preparing = page.getByRole("button", { name: /^Preparing audio for MassageLab Proof Drone$/i })
    await expect(preparing).toBeDisabled()
    expect((await readProbe(page)).audioContext.generatorGeneration).toBe(0)
    await beginPlaybackStateHistory(page)
    stateHistoryStarted = true
    await releaseHeldStartupPhase(page)
    await page.waitForTimeout(1_000)
    const states = await finishPlaybackStateHistory(page)
    stateHistoryStarted = false
    expect(states).not.toContain("playing")
    expect((await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
    const play = page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })
    await expect(play).toBeEnabled()
    await play.click()
    const player = page.getByTestId("music-player-toolbar")
    await expect(player).toHaveAttribute("data-playback-state", "playing")
    await page.getByRole("button", { name: /^Stop MassageLab Proof Drone$/i }).click()
    await expect(player).toHaveAttribute("data-playback-state", "stopped")
    await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  } finally {
    if (stateHistoryStarted) await finishPlaybackStateHistory(page)
    await releaseHeldStartupPhase(page)
  }
})

test("latest request wins when Stop occurs during provider decode", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Deterministic startup timing coverage runs in desktop Chromium.")
  await installMediaOwnershipFakes(page, { holdPhase: "provider-decode" })
  let stateHistoryStarted = false
  try {
    const play = await openStation(page, {
      category: "Treatment room starters",
      id: "observable-streams-probe",
      title: "Observable Streams",
    })
    await play.click()
    await waitForStartupPhase(page, "provider-decode")
    const player = page.getByTestId("music-player-toolbar")
    await expect(player).toHaveAttribute("data-playback-state", "loading")
    await invokeMediaAction(page, "stop")
    await expect(player).toHaveAttribute("data-playback-state", "stopped")
    await beginPlaybackStateHistory(page)
    stateHistoryStarted = true
    await releaseHeldStartupPhase(page)
    await page.waitForTimeout(1_800)
    const states = await finishPlaybackStateHistory(page)
    stateHistoryStarted = false
    expect(states).not.toContain("playing")
    expect((await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  } finally {
    if (stateHistoryStarted) await finishPlaybackStateHistory(page)
    await releaseHeldStartupPhase(page)
  }
})

for (const phase of ["piece-activation", "scheduling"] as const) {
  test(`latest request wins when Stop occurs during ${phase}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Deterministic startup timing coverage runs in desktop Chromium.")
    await installMediaOwnershipFakes(page, { stopAtPhase: phase })
    const play = await openStation(page, {
      category: "Treatment room starters",
      id: "observable-streams-probe",
      title: "Observable Streams",
    })
    await beginPlaybackStateHistory(page)
    await play.click()
    await waitForStartupPhase(page, phase)
    const player = page.getByTestId("music-player-toolbar")
    await expect(player).toHaveAttribute("data-playback-state", "stopped")
    await page.waitForTimeout(1_800)
    const states = await finishPlaybackStateHistory(page)
    expect(states).not.toContain("playing")
    const probe = await readProbe(page)
    expect(probe.audioContext.activeGeneratorSources).toBe(0)
    if (probe.audioContext.generatorStarts > 0) {
      expect(probe.audioContext.generatorTeardowns).toBeGreaterThan(0)
    }
  })
}

const startupMeasurementStations = [
  {
    category: "Treatment room starters",
    id: "observable-streams-probe",
    requestPathFragment: "/atmosphere/observable-streams-vsco-adaptation/",
    pieceId: "observable-streams",
    title: "Observable Streams",
  },
  {
    category: "Piano, bells, and mallets",
    id: "generative-fm-little-bells",
    requestPathFragment: "/atmosphere/generative-fm/little-bells/",
    pieceId: "little-bells",
    title: "Little Bells",
  },
  {
    category: "Rhythm and experimental texture",
    id: "generative-fm-moment",
    requestPathFragment: "/atmosphere/generative-fm/moment/",
    pieceId: "moment",
    title: "Moment",
  },
] as const

for (const station of startupMeasurementStations) {
  test(`startup timing records fresh-context cold and same-context warm ${station.pieceId}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Measurements are intentionally limited to desktop Chromium.")
    test.setTimeout(150_000)
    await installMediaOwnershipFakes(page)
    const audioRequests: string[] = []
    page.on("request", (request) => {
      if (/\/(?:audio\/)?atmosphere\//i.test(request.url())) audioRequests.push(request.url())
    })
    const play = await openStation(page, station)
    const player = page.getByTestId("music-player-toolbar")

    const runs: Array<Record<string, unknown>> = []
    for (const temperature of ["cold", "warm"] as const) {
      const previousTimings = (await readProbe(page)).startup.timings
        .filter((timing) => timing.stationId === station.id).length
      const requestStart = temperature === "cold" ? 0 : audioRequests.length
      const runPlay = temperature === "cold"
        ? play
        : player.getByRole("button", { name: "Play", exact: true })
      await runPlay.click()
      await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 60_000 })
      const result = await waitForStationTiming(page, station.id, previousTimings)
      expect(result.carrier).toMatchObject({ sameInitiatingTurn: true })
      expect(result.timing).toMatchObject({ pieceId: station.pieceId, stationId: station.id })
      for (const field of [
        "prepareWaitMs",
        "toneStartMs",
        "pieceActivateMs",
        "scheduleMs",
        "totalMs",
        "sampleRequestBatchCount",
        "sampleRequestCount",
        "sampleRequestMemoryHitUrlCount",
      ] as const) {
        expect(Number.isFinite(result.timing?.[field])).toBe(true)
        expect(Number(result.timing?.[field])).toBeGreaterThanOrEqual(0)
      }
      const runRequests = audioRequests.slice(requestStart)
        .filter((url) => url.includes(station.requestPathFragment))
      runs.push({
        carrierCallLatencyMs: result.carrier?.latencyMs,
        networkIndexRequestCount: runRequests.filter((url) => /sample-index[^/]*\.json/i.test(url)).length,
        networkSampleRequestCount: runRequests.filter((url) => !/sample-index[^/]*\.json/i.test(url)).length,
        temperature,
        timing: result.timing,
      })
      await player.getByRole("button", { name: "Stop", exact: true }).click()
      await expect(player).toHaveAttribute("data-playback-state", "stopped")
      await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources, {
        timeout: 10_000,
      }).toBe(0)
    }

    const warmTiming = runs[1]?.timing as Record<string, unknown> | undefined
    expect(Number(warmTiming?.sampleRequestMemoryHitUrlCount)).toBeGreaterThan(0)
    console.log(`ATMOSPHERE_STARTUP_MEASUREMENT ${JSON.stringify({ station: station.pieceId, runs })}`)
  })
}

test("Live position stays published while Playing and clears after Stop", async ({ page }) => {
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
      livePositionPublished: probe.mediaSession.livePositionPublished,
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
      {
        sizes: "512x512",
        src: "/api/atmosphere/stations/mlab-proof-drone/artwork?size=512&v=2026-08-17-1",
        type: "image/png",
      },
    ],
    livePositionPublished: true,
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
      positionStateCleared: probe.mediaSession.positionStateCalls.at(-1) === undefined,
    }
  })).toEqual({
    activeActions: 0,
    metadata: null,
    playbackState: "none",
    positionStateCleared: true,
  })

  await page.waitForTimeout(250)
  await expect(page.getByText("Stopped").last()).toBeVisible()
  expect(health.consoleErrors).toEqual([])
  expect(health.pageErrors).toEqual([])
})

test("Live position rejection preserves Playing metadata and all five handlers", async ({ page }) => {
  await installMediaOwnershipFakes(page, { rejectLivePositionState: true })
  const player = await startProofStation(page)

  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect.poll(async () => page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    return {
      actions: Object.entries(probe.mediaSession.handlers)
        .filter(([, handler]) => typeof handler === "function")
        .map(([action]) => action)
        .sort(),
      livePositionPublished: probe.mediaSession.livePositionPublished,
      playbackState: probe.mediaSession.playbackState,
      title: probe.mediaSession.metadata?.title,
    }
  })).toEqual({
    actions: ["nexttrack", "pause", "play", "previoustrack", "stop"],
    livePositionPublished: false,
    playbackState: "playing",
    title: "MassageLab Proof Drone",
  })
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources)
    .toBeGreaterThan(0)
  await invokeMediaAction(page, "stop")
})

test("canonical station artwork and platform artwork derivative preserve honest PNG contracts", async ({ page, request }) => {
  const artworkHashes = new Set<string>()
  const platformArtworkHashes = new Set<string>()
  const stations = getVisibleAtmosphereStations()
  const directLegacy256ArtworkUrl = "/api/atmosphere/stations/mlab-proof-drone/artwork?size=256"
  const revisionedLegacy256ArtworkUrl = `${directLegacy256ArtworkUrl}&v=2026-08-17-1`
  const directLegacy512ArtworkUrl = "/api/atmosphere/stations/mlab-proof-drone/artwork?size=512"
  const priorRevision512ArtworkUrl = `${directLegacy512ArtworkUrl}&v=2026-08-16-1`
  const unknownRevision512ArtworkUrl = `${directLegacy512ArtworkUrl}&v=unknown`
  const revisionedMetadataArtworkUrl = `${directLegacy512ArtworkUrl}&v=2026-08-17-1`

  expect(directLegacy512ArtworkUrl).not.toBe(revisionedMetadataArtworkUrl)

  for (const station of stations) {
    const stationPath = `/api/atmosphere/stations/${encodeURIComponent(station.id)}/artwork`
    const response = await request.get(`${stationPath}?size=256`)
    expect(response.status()).toBe(200)
    const body = Buffer.from(await response.body())
    expect(pngDimensions(body)).toEqual({ width: 256, height: 256 })
    expect(response.headers()["content-type"]).toBe("image/png")
    expect(response.headers()["cache-control"]).toContain("max-age=86400")
    artworkHashes.add(createHash("sha256").update(body).digest("hex"))

    const artworkUrl = `${stationPath}?size=512&v=2026-08-17-1`
    const first = await request.get(artworkUrl)
    const second = await request.get(artworkUrl)
    expect(first.status()).toBe(200)
    expect(first.headers()["content-type"]).toBe("image/png")
    expect(first.headers()["cache-control"]).toContain("max-age=86400")
    const firstBody = Buffer.from(await first.body())
    expect(pngDimensions(firstBody)).toEqual({ width: 512, height: 512 })
    platformArtworkHashes.add(createHash("sha256").update(firstBody).digest("hex"))
    expect(await sha256(second)).toBe(await sha256(first))
  }

  expect(artworkHashes.size).toBe(stations.length)
  expect(platformArtworkHashes.size).toBe(stations.length)

  const directLegacy256 = await request.get(directLegacy256ArtworkUrl)
  const revisionedLegacy256 = await request.get(revisionedLegacy256ArtworkUrl)
  expect(await sha256(revisionedLegacy256)).toBe(await sha256(directLegacy256))

  const directLegacy512 = await request.get(directLegacy512ArtworkUrl)
  expect(directLegacy512.status()).toBe(200)
  expect(directLegacy512.headers()["content-type"]).toBe("image/png")
  expect(directLegacy512.headers()["cache-control"]).toContain("max-age=86400")
  const directLegacy512Body = Buffer.from(await directLegacy512.body())
  expect(pngDimensions(directLegacy512Body)).toEqual({ width: 512, height: 512 })
  const revisionedProof512 = await request.get(revisionedMetadataArtworkUrl)
  const revisionedProof512Body = Buffer.from(await revisionedProof512.body())
  expect(pngDimensions(revisionedProof512Body)).toEqual({ width: 512, height: 512 })
  expect(createHash("sha256").update(directLegacy512Body).digest("hex"))
    .not.toBe(createHash("sha256").update(revisionedProof512Body).digest("hex"))
  expect(await centerCropSha256(directLegacy512Body))
    .not.toBe(await centerCropSha256(revisionedProof512Body))

  for (const legacyUrl of [priorRevision512ArtworkUrl, unknownRevision512ArtworkUrl]) {
    const legacyResponse = await request.get(legacyUrl)
    const legacyBody = Buffer.from(await legacyResponse.body())
    expect(createHash("sha256").update(legacyBody).digest("hex"))
      .toBe(createHash("sha256").update(directLegacy512Body).digest("hex"))
    expect(await centerCropSha256(legacyBody)).toBe(await centerCropSha256(directLegacy512Body))
  }

  const decodePage = await page.context().newPage()
  try {
    await decodePage.goto("/music", { waitUntil: "domcontentloaded" })
    const decodeCandidates = [
      { size: 256, url: directLegacy256ArtworkUrl },
      { size: 256, url: revisionedLegacy256ArtworkUrl },
      { size: 512, url: directLegacy512ArtworkUrl },
      { size: 512, url: priorRevision512ArtworkUrl },
      { size: 512, url: revisionedMetadataArtworkUrl },
    ]
    expect(decodeCandidates).toHaveLength(5)
    for (const candidate of decodeCandidates) {
      await expect(decodePngInBrowser(decodePage, { url: candidate.url })).resolves.toMatchObject({
        height: candidate.size,
        mimeType: "image/png",
        width: candidate.size,
      })
    }
    const truncatedPngHeader = [
      137, 80, 78, 71, 13, 10, 26, 10,
      0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 1, 0, 0, 0, 1, 0,
    ]
    expect(pngDimensions(Buffer.from(truncatedPngHeader))).toEqual({ width: 256, height: 256 })
    await expect(decodePngInBrowser(decodePage, {
      bytes: truncatedPngHeader,
    })).rejects.toThrow()
  } finally {
    await decodePage.close()
  }

  await installMediaOwnershipFakes(page)
  let artworkApiRequests = 0
  await page.route("**/api/atmosphere/stations/**/artwork**", async (route) => {
    artworkApiRequests += 1
    await route.abort()
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const centered = await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  const mountedCardArtwork = page.locator(
    '[data-carousel-slide="true"]:not([data-detail-level="shell"]) [data-carousel-artwork]',
  )
  const mountedCardCount = await mountedCardArtwork.count()
  expect(mountedCardCount).toBeGreaterThan(0)
  await expect(mountedCardArtwork.locator("svg")).toHaveCount(mountedCardCount)
  await expect(mountedCardArtwork.locator("img")).toHaveCount(0)
  const cardArtwork = centered.locator("[data-carousel-artwork]").getByRole("img", {
    name: "MassageLab Proof Drone station artwork",
  })
  await expect(cardArtwork.locator("svg")).toBeVisible()
  await expect(centered.locator("[data-carousel-artwork] img")).toHaveCount(0)
  expect(artworkApiRequests).toBe(0)
  await activateSetupButton(centered.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }))
  const player = page.getByTestId("music-player-toolbar")
  const vinyl = player.getByTestId("station-vinyl")
  await expect(vinyl.locator("svg")).toBeVisible()
  await expect(vinyl.locator("img")).toHaveCount(0)
  await expect.poll(() => artworkSvgHash(vinyl)).toBe(await artworkSvgHash(cardArtwork))
  await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.artwork)
    .toEqual([
      {
        sizes: "512x512",
        src: "/api/atmosphere/stations/mlab-proof-drone/artwork?size=512&v=2026-08-17-1",
        type: "image/png",
      },
    ])
  expect(artworkApiRequests).toBe(0)

  const unknown = await request.get("/api/atmosphere/stations/not-a-station/artwork")
  expect(unknown.status()).toBe(404)
  const unsupportedSize = await request.get(
    "/api/atmosphere/stations/mlab-proof-drone/artwork?size=240",
  )
  expect(unsupportedSize.status()).toBe(400)
  expect(unsupportedSize.headers()["cache-control"]).toBe("no-store")
})

test("platform artwork route failure cannot break inline canonical art or playback", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  let artworkApiRequests = 0
  await page.route("**/api/atmosphere/stations/**/artwork**", async (route) => {
    artworkApiRequests += 1
    await route.abort()
  })
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const centered = await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await expect(centered.getByRole("img", {
    name: "MassageLab Proof Drone station artwork",
  }).locator("svg")).toBeVisible()
  await activateSetupButton(centered.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }))
  await expect(page.getByTestId("music-player-toolbar"))
    .toHaveAttribute("data-playback-state", /loading|playing/)
  expect(artworkApiRequests).toBe(0)
})

test("Live position publishes while Loading and an external carrier Pause cancels held startup", async ({ page }) => {
  await installMediaOwnershipFakes(page, { holdCarrierPlay: true })
  let stateHistoryStarted = false
  try {
    const player = await startProofStation(page)

    await expect.poll(async () => (await readProbe(page)).audio.playCalls).toBe(1)
    await expect(player).toHaveAttribute("data-playback-state", "loading")
    await expect.poll(async () => page.evaluate(() => {
      const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
      return {
        livePositionPublished: probe.mediaSession.livePositionPublished,
        pauseHandler: typeof probe.mediaSession.handlers.pause,
        playbackState: probe.mediaSession.playbackState,
        title: probe.mediaSession.metadata?.title,
      }
    })).toEqual({
      livePositionPublished: true,
      pauseHandler: "function",
      playbackState: "playing",
      title: "MassageLab Proof Drone",
    })

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

    const proofCardArtwork = page.locator("#station-mlab-proof-drone [data-carousel-artwork]")
    const nextArtworkHash = await canonicalArtworkHash(
      page,
      "generative-fm-420hz-gamma-waves-for-big-brain",
    )
    const proofArtworkHash = await artworkSvgHash(proofCardArtwork)

    await invokeMediaAction(page, "nexttrack")
    await expect.poll(async () => ({
      title: await player.getByTestId("music-player-toolbar-identity").locator("p").first().textContent(),
      vinylStationId: await player.getByTestId("station-vinyl").getAttribute("data-artwork-station-id"),
      metadata: (await readProbe(page)).mediaSession.metadata,
    })).toMatchObject({
      title: "420hz Gamma Waves for Big Brain",
      vinylStationId: "generative-fm-420hz-gamma-waves-for-big-brain",
      metadata: {
        title: "420hz Gamma Waves for Big Brain",
        artwork: [
          {
            sizes: "512x512",
            src: "/api/atmosphere/stations/generative-fm-420hz-gamma-waves-for-big-brain/artwork?size=512&v=2026-08-17-1",
            type: "image/png",
          },
        ],
      },
    })
    expect(await artworkSvgHash(player.getByTestId("station-vinyl"))).toBe(nextArtworkHash)
    await invokeMediaAction(page, "previoustrack")
    await expect.poll(async () => ({
      title: await player.getByTestId("music-player-toolbar-identity").locator("p").first().textContent(),
      vinylStationId: await player.getByTestId("station-vinyl").getAttribute("data-artwork-station-id"),
      metadata: (await readProbe(page)).mediaSession.metadata,
    })).toMatchObject({
      title: "MassageLab Proof Drone",
      vinylStationId: "mlab-proof-drone",
      metadata: {
        title: "MassageLab Proof Drone",
        artwork: [
          {
            sizes: "512x512",
            src: "/api/atmosphere/stations/mlab-proof-drone/artwork?size=512&v=2026-08-17-1",
            type: "image/png",
          },
        ],
      },
    })
    expect(await artworkSvgHash(player.getByTestId("station-vinyl"))).toBe(proofArtworkHash)
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

test("vinyl player controls keep decorative artwork outside the media owner", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(player.getByTestId("station-vinyl")).toHaveAttribute("data-artwork-station-id", "mlab-proof-drone")
  await expect(player.getByTestId("station-vinyl").locator("svg")).toHaveCount(1)
  await expect(player.getByTestId("station-vinyl").locator("img")).toHaveCount(0)
  await expect(player.locator("audio, iframe")).toHaveCount(0)
  await expect.poll(async () => (await readProbe(page)).audio.created).toBe(1)
  await expect.poll(async () => page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    return Object.values(probe.mediaSession.handlers).filter(Boolean).length
  })).toBe(5)

  await player.getByRole("button", { name: "Favorite MassageLab Proof Drone" }).click()
  await expect.poll(async () => (await readProbe(page)).audio.created).toBe(1)
  await invokeMediaAction(page, "stop")
})

test("vinyl motion advances only while the station is Playing and freezes inactive states", async ({ page }, testInfo) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  const vinyl = player.getByTestId("station-vinyl")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(vinyl).toHaveAttribute("data-playing", "true")
  await expect.poll(() => vinyl.locator(".ml-station-vinyl-disc").evaluate((disc) => (
    disc.getAnimations()[0]?.pending ?? false
  ))).toBe(false)

  const playingBefore = await readVinylMotion(vinyl)
  expect(playingBefore.animationName).toBe("ml-station-vinyl-spin")
  expect(playingBefore.animationPlayState).toBe("running")
  expect(playingBefore.animationDuration).toBe("52s")
  expect(playingBefore.prefersReducedMotion).toBe(false)
  await page.waitForTimeout(250)
  const playingAfter = await readVinylMotion(vinyl)
  if (testInfo.project.name === "webkit-media-smoke") {
    // Playwright WebKit exposes the active animation but does not advance its compositor time in this smoke harness.
    expect(playingAfter.animationState).toBe("running")
  } else {
    expect(playingAfter.transform).not.toBe(playingBefore.transform)
  }

  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await expect(vinyl).toHaveAttribute("data-playing", "false")
  const paused = await readVinylMotion(vinyl)
  expect(paused.animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)

  await invokeMediaAction(page, "play")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await setAudioSessionState(page, "interrupted", true)
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await expect(vinyl).toHaveAttribute("data-playing", "false")
  const interrupted = await readVinylMotion(vinyl)
  expect(interrupted.animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)

  await invokeMediaAction(page, "stop")
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  const stopped = await readVinylMotion(vinyl)
  expect(stopped.animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)
  console.log(`[task-19-motion-receipt] ${JSON.stringify({
    interrupted,
    paused,
    playing: playingBefore,
    stopped,
  })}`)
})

test("vinyl motion stays frozen while station startup is Loading and after failure", async ({ page }) => {
  await installRouteControlledServiceWorkerGuard(page)
  await installMediaOwnershipFakes(page)
  let releaseSampleIndex!: () => void
  let recordSampleIndexRequest!: (url: string) => void
  const sampleIndexGate = new Promise<void>((resolve) => {
    releaseSampleIndex = resolve
  })
  const sampleIndexRequest = new Promise<string>((resolve) => {
    recordSampleIndexRequest = resolve
  })
  await page.route("**/observable-streams-vsco-adaptation/sample-index*.json", async (route) => {
    recordSampleIndexRequest(route.request().url())
    await sampleIndexGate
    await route.fulfill({ status: 503, body: "unavailable" })
  })
  const play = await openStation(page, {
    category: "Treatment room starters",
    id: "observable-streams-probe",
    title: "Observable Streams",
  })
  await expect.poll(() => page.evaluate(() => {
    const state = Reflect.get(window, "__massagelabRouteTestServiceWorker") as { attempts: number }
    return state?.attempts ?? 0
  })).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => {
    const state = Reflect.get(window, "__massagelabRouteTestServiceWorker") as { forwarded: number }
    return state?.forwarded ?? 0
  })).toBe(0)
  await activateSetupButton(play)
  const matchedSampleIndexUrl = await sampleIndexRequest
  expect(matchedSampleIndexUrl).toMatch(
    /\/observable-streams-vsco-adaptation\/sample-index(?:\.[^/?]+)?\.json(?:\?.*)?$/,
  )
  const player = page.getByTestId("music-player-toolbar")
  const vinyl = player.getByTestId("station-vinyl")
  await expect(player).toHaveAttribute("data-playback-state", "loading")
  await expect(vinyl).toHaveAttribute("data-playing", "false")
  const loading = await readVinylMotion(vinyl)
  expect(loading.animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)

  releaseSampleIndex()
  await expect(player).toHaveAttribute("data-playback-state", "failed", { timeout: 30_000 })
  await expect(vinyl).toHaveAttribute("data-playing", "false")
  const failed = await readVinylMotion(vinyl)
  expect(failed.animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)
  console.log(`[task-19-inactive-motion-receipt] ${JSON.stringify({ failed, loading })}`)
})

test("vinyl motion never animates when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  const vinyl = player.getByTestId("station-vinyl")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(vinyl).toHaveAttribute("data-playing", "true")
  const motion = await readVinylMotion(vinyl)
  expect(motion.animationName).toBe("none")
  await expectVinylTransformFrozen(vinyl)
  console.log(`[task-19-reduced-motion-receipt] ${JSON.stringify(motion)}`)
  await invokeMediaAction(page, "stop")
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

test("the station card returns to Play immediately after its explicit Stop", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await closeInterruptionNotice(page)

  await page.getByRole("button", { name: /^Stop MassageLab Proof Drone$/i }).click()
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await expect(page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })).toBeVisible()
  await expect(player).toBeVisible()

  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  await expect(player).toHaveAttribute("data-playback-state", /loading|playing/)
})

test("stopped player retires after 60 seconds", async ({ page }) => {
  await page.clock.install()
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await closeInterruptionNotice(page)

  const title = await player.getByTestId("music-player-toolbar-identity").locator("p").first().textContent()
  const stoppedAt = await invokeMediaActionAt(page, "stop")
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  const immediate = await readProbe(page)
  expect(immediate.audio.source).toBe("")
  expect(immediate.mediaSession.metadata).toBeNull()
  expect(immediate.mediaSession.playbackState).toBe("none")
  await expect(page.locator("body")).toHaveClass(/ml-music-player-active/)

  const pausedAt = await pausePageClockAhead(page)
  const remainingRetentionMs = 60_000 - (pausedAt - stoppedAt)
  expect(remainingRetentionMs).toBeGreaterThan(1)
  await page.clock.fastForward(remainingRetentionMs - 1)
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await expect(player.getByTestId("music-player-toolbar-identity").locator("p").first()).toHaveText(title ?? "")
  await expect(page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })).toBeVisible()

  await page.clock.fastForward(1)
  await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
  await expect(page.locator("body")).not.toHaveClass(/ml-music-player-(?:active|rail)/)
  await expect(page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i })).toBeVisible()
  console.log(`[task-21-stop-boundary] ${JSON.stringify({
    expiredAtMs: 60_000,
    immediateCarrierSource: immediate.audio.source,
    immediateGeneratorSources: immediate.audioContext.activeGeneratorSources,
    immediateMediaMetadata: immediate.mediaSession.metadata,
    retainedAtMs: 59_999,
    title,
  })}`)
})

test("stopped retirement exclusions leave paused and interrupted identity intact", async ({ page }) => {
  await page.clock.install()
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await closeInterruptionNotice(page)

  await invokeMediaAction(page, "pause")
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  await pausePageClockAhead(page)
  await page.clock.fastForward(60_000)
  await expect(player).toHaveAttribute("data-playback-state", "paused")
  await expect(player.getByTestId("music-player-toolbar-identity")).toContainText("MassageLab Proof Drone")

  await page.clock.resume()
  await invokeMediaAction(page, "play")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await setAudioSessionState(page, "interrupted", true)
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  await pausePageClockAhead(page)
  await page.clock.fastForward(60_000)
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await expect(player.getByTestId("music-player-toolbar-identity")).toContainText("MassageLab Proof Drone")
  console.log(`[task-21-state-exclusions] ${JSON.stringify({
    interruptedRetainedAtMs: 60_000,
    pausedRetainedAtMs: 60_000,
  })}`)
})

test("restart cancels stopped retirement without stale identity or media teardown", async ({ page }) => {
  await page.clock.install()
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await closeInterruptionNotice(page)

  const generationBeforeStop = (await readProbe(page)).audioContext.generatorGeneration
  const firstStoppedAt = await invokeMediaActionAt(page, "stop")
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  const firstPausedAt = await pausePageClockAhead(page)
  await page.clock.fastForward(60_000 - (firstPausedAt - firstStoppedAt) - 1)
  await activateSetupButton(player.getByRole("button", { name: "Play", exact: true }))
  await page.clock.fastForward(1)
  await page.clock.resume()
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  const restarted = await readProbe(page)
  expect(restarted.audioContext.generatorGeneration).toBeGreaterThan(generationBeforeStop)
  expect(restarted.audioContext.activeGeneratorSources).toBeGreaterThan(0)
  expect(restarted.audio.source).not.toBe("")
  expect(restarted.mediaSession.metadata?.title).toBe("MassageLab Proof Drone")
  expect(restarted.mediaSession.metadata?.artwork).toHaveLength(1)
  const restartedArtwork = restarted.mediaSession.metadata?.artwork?.[0]?.src
  expect(restartedArtwork).toBeTruthy()
  await expect(player).toHaveAttribute("data-playback-state", "playing")

  const adjacentStoppedAt = await invokeMediaActionAt(page, "stop")
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  const adjacentPausedAt = await pausePageClockAhead(page)
  await page.clock.fastForward(60_000 - (adjacentPausedAt - adjacentStoppedAt) - 1)
  await activateSetupButton(player.getByRole("button", { name: "Next station" }))
  await page.clock.fastForward(1)
  await page.clock.resume()
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  const adjacentTitle = await player.getByTestId("music-player-toolbar-identity").locator("p").first().textContent()
  expect(adjacentTitle).not.toBe("MassageLab Proof Drone")
  const adjacent = await readProbe(page)
  expect(adjacent.mediaSession.metadata?.title).toBe(adjacentTitle)
  expect(adjacent.mediaSession.metadata?.artwork).toHaveLength(1)
  expect(adjacent.mediaSession.metadata?.artwork?.[0]?.src).not.toBe(restartedArtwork)
  expect(adjacent.audioContext.activeGeneratorSources).toBeGreaterThan(0)
  await expect(player).toHaveAttribute("data-playback-state", "playing")
  await page.evaluate(() => {
    const probe = Reflect.get(window, "__massagelabMediaProbe") as MediaProbe
    Reflect.set(window, "__task21CapturedStop", probe.mediaSession.handlers.stop)
  })

  await invokeMediaAction(page, "stop")
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await expect.poll(async () => (await readProbe(page)).audioContext.activeGeneratorSources).toBe(0)
  await pausePageClockAhead(page)
  await page.clock.fastForward(30_000)
  await page.evaluate(() => {
    const capturedStop = Reflect.get(window, "__task21CapturedStop") as (() => void) | undefined
    capturedStop?.()
  })
  await page.clock.fastForward(29_999)
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await page.clock.fastForward(1)
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await page.clock.fastForward(29_999)
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  await page.clock.fastForward(1)
  await expect(page.getByTestId("music-player-toolbar")).toHaveCount(0)
  console.log(`[task-21-restart-races] ${JSON.stringify({
    adjacentTitle,
    firstRestartGeneration: restarted.audioContext.generatorGeneration,
    replacementRetentionMs: 60_000,
  })}`)
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
