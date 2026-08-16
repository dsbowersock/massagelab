import { expect, test, type APIResponse, type Locator, type Page, type Route } from "@playwright/test"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { getVisibleAtmosphereStations } from "../../lib/atmosphere/stations.js"
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

let actualRuntimeModulePathPromise: Promise<string> | null = null

/** Resolves the current production chunk that owns the activation-sensitive proof runtime. */
async function getActualRuntimeModulePath() {
  actualRuntimeModulePathPromise = actualRuntimeModulePathPromise ?? (async () => {
    const chunkDirectory = new URL("../../.next/static/chunks/", import.meta.url)
    const entries = await readdir(chunkDirectory, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue
      const source = await readFile(new URL(entry.name, chunkDirectory), "utf8")
      if (source.includes("startToneProofDrone") && source.includes("getToneProofDroneDiagnostics")) {
        return `/_next/static/chunks/${entry.name}`
      }
    }
    throw new Error("Could not locate the built Tone proof runtime chunk.")
  })()
  return actualRuntimeModulePathPromise
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
    for (const eventName of ["pointerover", "pointerdown", "focusin"] as const) {
      document.addEventListener(eventName, (event) => {
        if (!getPlayButton(event)) return
        startup.playInputEvents.push({ observedAt: performance.now(), type: eventName })
      }, { capture: true })
    }
    document.addEventListener("click", (event) => {
      if (!getPlayButton(event)) return
      startup.playInputEvents.push({ observedAt: performance.now(), type: "click" })
      initiatingPlayTurn = true
      lastPlayIntentAt = performance.now()
      setTimeout(() => {
        initiatingPlayTurn = false
        startup.phaseReached.push("initiating-play-task-ended")
      }, 0)
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

async function startProofStation(page: Page) {
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("region", { name: "Atmosphere audio stations" }))
    .toHaveAttribute("data-music-storage-status", "available")
  await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await page.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
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
  // Let the compositor observe the state transition before taking the stable baseline.
  await vinyl.page().waitForTimeout(100)
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

for (const activation of ["tap", "click", "keyboard"] as const) {
  test(`first station Play activation accepts one ${activation} command after carousel readiness`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "First-action coverage runs in mobile Chromium.")
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
      if (activation === "keyboard") {
        await play.focus()
        await page.keyboard.press("Enter")
      }

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
    await notice.getByRole("button", { name: "Close" }).click()
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
        src: "/api/atmosphere/stations/mlab-proof-drone/artwork",
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

test("canonical station artwork returns stable distinct PNGs and matches the centered card metadata", async ({ page, request }) => {
  const artworkHashes = new Set<string>()
  const stations = getVisibleAtmosphereStations()

  for (const station of stations) {
    const response = await request.get(`/api/atmosphere/stations/${encodeURIComponent(station.id)}/artwork`)
    expect(response.status()).toBe(200)
    const body = Buffer.from(await response.body())
    expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
    expect(response.headers()["content-type"]).toBe("image/png")
    expect(response.headers()["cache-control"]).toContain("max-age=86400")
    artworkHashes.add(createHash("sha256").update(body).digest("hex"))
  }

  expect(artworkHashes.size).toBe(stations.length)

  for (const stationId of ["mlab-proof-drone", "generative-fm-documentary-films"]) {
    const artworkUrl = `/api/atmosphere/stations/${encodeURIComponent(stationId)}/artwork`
    const first = await request.get(artworkUrl)
    const second = await request.get(artworkUrl)
    expect(await sha256(second)).toBe(await sha256(first))
  }

  await installMediaOwnershipFakes(page)
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const centered = await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  const artworkUrl = "/api/atmosphere/stations/mlab-proof-drone/artwork"
  await expect(centered.locator("[data-carousel-artwork] img")).toHaveAttribute("src", artworkUrl)
  await centered.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  await expect.poll(async () => (await readProbe(page)).mediaSession.metadata?.artwork?.[0]?.src)
    .toBe(artworkUrl)

  const unknown = await request.get("/api/atmosphere/stations/not-a-station/artwork")
  expect(unknown.status()).toBe(404)
})

test("canonical station artwork failure keeps a labeled fallback while playback starts", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  await page.route("**/api/atmosphere/stations/mlab-proof-drone/artwork", (route) => route.abort())
  await page.goto("/music", { waitUntil: "domcontentloaded" })
  const centered = await centerCarouselItem(page, "mlab-proof-drone", "Next station")
  await expect(centered.getByRole("img", {
    name: "MassageLab Proof Drone station artwork unavailable",
  })).toBeVisible()
  await centered.getByRole("button", { name: /^Play MassageLab Proof Drone$/i }).click()
  await expect(page.getByTestId("music-player-toolbar"))
    .toHaveAttribute("data-playback-state", /loading|playing/)
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

test("vinyl player controls keep decorative artwork outside the media owner", async ({ page }) => {
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(player.getByTestId("station-vinyl")).toHaveAttribute(
    "data-artwork-src",
    /\/api\/atmosphere\/stations\/mlab-proof-drone\/artwork$/,
  )
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

  const playingBefore = await readVinylMotion(vinyl)
  expect(playingBefore.animationName).toBe("ml-station-vinyl-spin")
  expect(playingBefore.animationPlayState).toBe("running")
  expect(playingBefore.animationDuration).toBe("4s")
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
  expect((await readVinylMotion(vinyl)).animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)

  await invokeMediaAction(page, "play")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await setAudioSessionState(page, "interrupted", true)
  await expect(player).toHaveAttribute("data-playback-state", "interrupted")
  await expect(vinyl).toHaveAttribute("data-playing", "false")
  expect((await readVinylMotion(vinyl)).animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)

  await invokeMediaAction(page, "stop")
  await expect(player).toHaveAttribute("data-playback-state", "stopped")
  expect((await readVinylMotion(vinyl)).animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)
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
  await play.click()
  const matchedSampleIndexUrl = await sampleIndexRequest
  expect(matchedSampleIndexUrl).toMatch(
    /\/observable-streams-vsco-adaptation\/sample-index(?:\.[^/?]+)?\.json(?:\?.*)?$/,
  )
  const player = page.getByTestId("music-player-toolbar")
  const vinyl = player.getByTestId("station-vinyl")
  await expect(player).toHaveAttribute("data-playback-state", "loading")
  await expect(vinyl).toHaveAttribute("data-playing", "false")
  expect((await readVinylMotion(vinyl)).animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)

  releaseSampleIndex()
  await expect(player).toHaveAttribute("data-playback-state", "failed", { timeout: 30_000 })
  await expect(vinyl).toHaveAttribute("data-playing", "false")
  expect((await readVinylMotion(vinyl)).animationPlayState).toBe("paused")
  await expectVinylTransformFrozen(vinyl)
})

test("vinyl motion never animates when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await installMediaOwnershipFakes(page)
  const player = await startProofStation(page)
  const vinyl = player.getByTestId("station-vinyl")
  await expect(player).toHaveAttribute("data-playback-state", "playing", { timeout: 30_000 })
  await expect(vinyl).toHaveAttribute("data-playing", "true")
  const motion = await readVinylMotion(vinyl)
  expect(motion.animationName === "none" || motion.animationPlayState === "paused").toBe(true)
  await expectVinylTransformFrozen(vinyl)
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
