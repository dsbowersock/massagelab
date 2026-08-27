import {
  chooseSignatureSoundPreviewSource,
  chooseSignatureSoundPreviewSourceWithHistory,
  getSignatureSoundConstructionTransitionSeconds,
  getSignatureSoundPreviewDelayMs,
  validateSignatureSoundConstructionPlaybackPolicy,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"
import { createSignatureSoundPreviewFadeController } from "./signature-sound-preview-fade.js"

const CONTINUOUS_STRATEGIES = new Set([
  "adaptive-whole-source-sequence",
  "adaptive-one-shot-sequence",
])
const MAX_ACTIVE_VOICES = 8

/**
 * Creates the development audition adapter around the reusable scheduling
 * rules. Starting a preview always retires the previous group and stop tears
 * down every preview-owned audio element and timer.
 */
export function createSignatureSoundPreviewPlayer(dependencies = {}) {
  const createAudio = dependencies.createAudio ?? ((url) => new Audio(url))
  const random = dependencies.random ?? Math.random
  const setTimer = dependencies.setTimer ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
  const clearTimer = dependencies.clearTimer ?? ((timer) => globalThis.clearTimeout(timer))
  const onStatus = dependencies.onStatus ?? (() => {})
  const onVoiceTelemetry = dependencies.onVoiceTelemetry ?? (() => {})
  const resolveAudioUrl = dependencies.resolveAudioUrl ?? ((source) => (
    `/api/dev/atmoshaper-candidates/audio/${encodeURIComponent(source.sourceId)}`
  ))
  // Production supplies this hook for every media element so the reviewed
  // scheduler can feed an AtmoShaper-private Web Audio output. Development
  // auditions keep the historical direct-output behavior below.
  const createVoiceOutput = dependencies.createVoiceOutput ?? null
  let browserGainContext = null
  const createGainStage = dependencies.createGainStage ?? ((audio, gainDb) => {
    const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext
    if (typeof AudioContextConstructor !== "function") {
      throw new Error("This browser cannot audition positive level-matching gain")
    }
    if (!browserGainContext || browserGainContext.state === "closed") {
      browserGainContext = new AudioContextConstructor()
    }
    const sourceNode = browserGainContext.createMediaElementSource(audio)
    const gainNode = browserGainContext.createGain()
    gainNode.gain.value = 10 ** (gainDb / 20)
    sourceNode.connect(gainNode)
    gainNode.connect(browserGainContext.destination)
    return {
      resume: () => browserGainContext.resume(),
      disconnect() {
        sourceNode.disconnect()
        gainNode.disconnect()
      },
    }
  })
  let session = null
  let advanceInFlight = null
  let eventInFlight = null
  let continuousTransitionInFlight = null
  let nextVoiceId = 1
  const voices = new Set()
  const timers = new Set()
  const fadeController = createSignatureSoundPreviewFadeController({
    isActive: (activeSession) => session === activeSession,
    registerTimer,
    retireVoice(audio) { audio.pause(); completeVoice(audio) },
  })

  function registerTimer(callback, delay) {
    let handle
    handle = setTimer(() => {
      timers.delete(handle)
      callback()
    }, delay)
    timers.add(handle)
    return handle
  }

  function cancelTimer(handle) {
    if (handle === null || handle === undefined) return
    clearTimer(handle)
    timers.delete(handle)
  }

  function emitVoiceTelemetry(activeSession = session) {
    onVoiceTelemetry({
      groupId: activeSession?.groupId ?? null,
      voices: [...voices].map((audio) => ({
        voiceId: audio.previewVoiceId,
        sourceId: audio.previewSource.sourceId,
        relativePath: audio.previewSource.relativePath,
        currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        duration: Number.isFinite(audio.duration) ? audio.duration : null,
        laneId: audio.previewLaneId ?? null,
        regionStartSeconds: audio.previewRegionStartSeconds ?? null,
        regionEndSeconds: audio.previewRegionEndSeconds ?? null,
        playing: !audio.paused && !audio.ended && !audio.previewEnded,
        ended: Boolean(audio.previewEnded || audio.ended),
      })),
    })
  }

  function attachVoiceTelemetry(audio, activeSession, source, {
    laneId = null,
    regionStartSeconds = null,
    regionEndSeconds = null,
  } = {}) {
    audio.previewVoiceId = `voice-${nextVoiceId}`
    nextVoiceId += 1
    audio.previewSource = source
    audio.previewLaneId = laneId
    audio.previewRegionStartSeconds = regionStartSeconds
    audio.previewRegionEndSeconds = regionEndSeconds
    audio.previewEnded = false
    if (typeof audio.addEventListener !== "function") return
    const notify = () => {
      if (session === activeSession && voices.has(audio)) emitVoiceTelemetry(activeSession)
    }
    const eventTypes = ["loadedmetadata", "durationchange", "timeupdate", "play", "pause"]
    for (const eventType of eventTypes) audio.addEventListener(eventType, notify)
    let trimTimer = null
    const enforceSourceTrim = () => {
      if (!Number.isFinite(source.endSeconds) || audio.previewTrimEnded) return
      const target = audio.previewTargetVolume ?? 1
      const fadeInSeconds = source.fadeInSeconds ?? 0
      const fadeOutSeconds = source.fadeOutSeconds ?? 0
      const startSeconds = source.startSeconds ?? 0
      const elapsed = Math.max(0, audio.currentTime - startSeconds)
      const remaining = Math.max(0, source.endSeconds - audio.currentTime)
      const fadeIn = fadeInSeconds > 0 ? Math.min(1, elapsed / fadeInSeconds) : 1
      const fadeOut = fadeOutSeconds > 0 ? Math.min(1, remaining / fadeOutSeconds) : 1
      audio.volume = target * Math.max(0, Math.min(fadeIn, fadeOut))
      if (audio.currentTime < source.endSeconds) return
      audio.previewTrimEnded = true
      audio.pause()
      audio.onended?.()
    }
    const scheduleTrimEnvelope = () => {
      if (!Number.isFinite(source.endSeconds) || audio.previewTrimEnded) return
      const fades = [source.fadeInSeconds ?? 0, source.fadeOutSeconds ?? 0].filter((seconds) => seconds > 0)
      const delay = fades.length > 0 ? Math.min(50, Math.min(...fades) * 1000 / 12) : 50
      trimTimer = registerTimer(() => {
        trimTimer = null
        if (session !== activeSession || !voices.has(audio)) return
        enforceSourceTrim()
        scheduleTrimEnvelope()
      }, delay)
    }
    if (Number.isFinite(source.endSeconds)) {
      enforceSourceTrim()
      audio.addEventListener("timeupdate", enforceSourceTrim)
      scheduleTrimEnvelope()
    }
    audio.previewTelemetryCleanup = () => {
      for (const eventType of eventTypes) audio.removeEventListener(eventType, notify)
      if (Number.isFinite(source.endSeconds)) {
        cancelTimer(trimTimer)
        trimTimer = null
        audio.removeEventListener("timeupdate", enforceSourceTrim)
      }
    }
  }

  function retireVoice(audio, { ended = false } = {}) {
    if (!voices.has(audio)) return
    if (ended) {
      audio.previewEnded = true
      emitVoiceTelemetry()
    }
    audio.onended = null
    audio.onloadedmetadata = null
    audio.ontimeupdate = null
    audio.previewBoundaryEnvelopeCleanup?.()
    audio.previewTelemetryCleanup?.()
    audio.previewGainStage?.disconnect?.()
    voices.delete(audio)
    if (session) emitVoiceTelemetry()
  }

  function stop() {
    session = null
    advanceInFlight = null
    eventInFlight = null
    continuousTransitionInFlight = null
    for (const timer of timers) clearTimer(timer)
    timers.clear()
    fadeController.settleAll()
    for (const audio of voices) {
      audio.pause()
      retireVoice(audio)
    }
    voices.clear()
    emitVoiceTelemetry(null)
    onStatus({ state: "idle" })
  }

  async function playSource(activeSession, {
    volume = 1,
    selectionOwner = activeSession,
    sourceIds: requestedSourceIds = null,
    forcedSourceId = null,
    startTimeSeconds = null,
    laneId = null,
    regionStartSeconds = null,
    regionEndSeconds = null,
  } = {}) {
    if (session !== activeSession) return null
    const availableSourceIds = requestedSourceIds ?? activeSession.sources.map((source) => source.sourceId)
    const inactiveSourceIds = availableSourceIds.filter((sourceId) => ![...voices].some((audio) => (
      audio.previewSource.sourceId === sourceId && !audio.previewEnded && !audio.ended
    )))
    const sourceIds = inactiveSourceIds.length > 0 ? inactiveSourceIds : availableSourceIds
    const sourceId = forcedSourceId ?? selectionOwner.initialSourceId ?? (
      activeSession.constructionPolicy?.minimumSelectionsBeforeRepeat
        ? chooseSignatureSoundPreviewSourceWithHistory(
            sourceIds,
            selectionOwner.recentSourceIds,
            activeSession.constructionPolicy.minimumSelectionsBeforeRepeat,
            random,
          )
        : chooseSignatureSoundPreviewSource(sourceIds, selectionOwner.lastSourceId, random)
    )
    selectionOwner.initialSourceId = null
    const source = activeSession.sources.find((candidate) => candidate.sourceId === sourceId)
    selectionOwner.lastSourceId = sourceId
    selectionOwner.recentSourceIds.push(sourceId)
    if (selectionOwner.recentSourceIds.length > 100) selectionOwner.recentSourceIds.shift()
    const audio = createAudio(resolveAudioUrl(source))
    const gainDb = source.gainDb ?? 0
    if (!Number.isFinite(gainDb) || gainDb > 24 || gainDb < -100) {
      throw new Error("Signature sound preview source gain must be between -100 and 24 dB")
    }
    audio.previewGainStage = createVoiceOutput
      ? createVoiceOutput(audio, gainDb)
      : gainDb > 0
        ? createGainStage(audio, gainDb)
        : null
    audio.previewTargetVolume = createVoiceOutput || gainDb > 0 ? 1 : 10 ** (gainDb / 20)
    audio.volume = volume * audio.previewTargetVolume
    const effectiveStartSeconds = startTimeSeconds ?? source.startSeconds ?? null
    const effectiveRegionStartSeconds = regionStartSeconds ?? source.startSeconds ?? null
    const effectiveRegionEndSeconds = regionEndSeconds ?? source.endSeconds ?? null
    if (effectiveStartSeconds !== null) audio.currentTime = effectiveStartSeconds
    attachVoiceTelemetry(audio, activeSession, source, {
      laneId,
      regionStartSeconds: effectiveRegionStartSeconds,
      regionEndSeconds: effectiveRegionEndSeconds,
    })
    voices.add(audio)
    emitVoiceTelemetry(activeSession)
    if (voices.size > MAX_ACTIVE_VOICES) {
      const oldest = voices.values().next().value
      oldest.pause()
      retireVoice(oldest)
    }
    try {
      // Preserve the established synchronous handoff to `audio.play()` for
      // ordinary and attenuated sources. Only positive-gain sources need the
      // Web Audio context to resume before their media element starts.
      if (audio.previewGainStage) await audio.previewGainStage.resume()
      await audio.play()
    } catch (error) {
      retireVoice(audio)
      if (session === activeSession) {
        onStatus({
          state: "error",
          groupId: activeSession.groupId,
          message: error instanceof Error ? error.message : "The source could not be played.",
        })
      }
      throw error
    }
    if (session !== activeSession) {
      audio.pause()
      retireVoice(audio)
      return null
    }
    if (session === activeSession) {
      emitVoiceTelemetry(activeSession)
      onStatus({
        state: "playing",
        groupId: activeSession.groupId,
        sourceId,
        relativePath: source.relativePath,
      })
    }
    return audio
  }

  function completeVoice(audio, options) {
    if (!audio) return
    retireVoice(audio, options)
  }

  /** Selects one source for a reviewer-bounded block of consecutive complete plays. */
  function selectRepeatSourceId(activeSession) {
    const policy = activeSession.runtimePolicy
    if (policy?.kind !== "repeat-source-sequence") return null
    if (activeSession.repeatSourceId && activeSession.repeatSourcePlaysRemaining > 0) {
      activeSession.repeatSourcePlaysRemaining -= 1
      return activeSession.repeatSourceId
    }
    const sourceIds = activeSession.sources.map(({ sourceId }) => sourceId)
    const sourceId = activeSession.initialSourceId ?? chooseSignatureSoundPreviewSource(
      sourceIds,
      activeSession.repeatSourceId,
      random,
    )
    const sample = random()
    if (!Number.isFinite(sample) || sample < 0 || sample > 1) {
      throw new Error("Signature repeat-source preview random sample is invalid")
    }
    const playRange = policy.maximumConsecutivePlays - policy.minimumConsecutivePlays + 1
    const playCount = policy.minimumConsecutivePlays + Math.min(
      playRange - 1,
      Math.floor(sample * playRange),
    )
    activeSession.repeatSourceId = sourceId
    activeSession.repeatSourcePlaysRemaining = playCount - 1
    return sourceId
  }

  /** Uses a shorter musical boundary only for the exact reviewer-marked short sources. */
  function getRepeatSourceTransitionSeconds(activeSession, sourceId, fallbackSeconds) {
    const policy = activeSession.runtimePolicy
    if (policy?.kind !== "repeat-source-sequence" ||
        !Array.isArray(policy.shortSourceIds) ||
        !policy.shortSourceIds.includes(sourceId)) {
      return fallbackSeconds
    }
    return Number(policy.shortCrossfadeBeats) * 60 / Number(policy.beatsPerMinute)
  }

  async function playContinuous(activeSession, { recoverAtFullVolume = false } = {}) {
    const settings = activeSession.previewSettings
    const volume = !recoverAtFullVolume && settings.transitionMode === "crossfade" && activeSession.currentVoice ? 0 : 1
    const audio = await playSource(activeSession, {
      volume,
      forcedSourceId: selectRepeatSourceId(activeSession),
    })
    if (!audio || session !== activeSession) return
    const previous = recoverAtFullVolume ? null : activeSession.currentVoice
    const defaultTransitionSeconds = getSignatureSoundConstructionTransitionSeconds(
      activeSession.constructionPolicy ?? { transitionDurationRange: null },
      settings.transitionSeconds,
      random,
    )
    audio.transitionSeconds = getRepeatSourceTransitionSeconds(
      activeSession,
      audio.previewSource.sourceId,
      defaultTransitionSeconds,
    )
    activeSession.currentVoice = audio
    audio.onended = () => {
      completeVoice(audio, { ended: true })
      if (session !== activeSession || audio.advanced) return
      if (activeSession.currentVoice === audio) activeSession.currentVoice = null
      void playContinuous(activeSession, { recoverAtFullVolume: true }).catch(() => {})
    }
    if (previous && settings.transitionMode === "crossfade") {
      await fadeController.fadeVoices(activeSession, previous, audio,
        previous.transitionSeconds ?? settings.transitionSeconds)
    }
    if (settings.transitionMode !== "end-to-end") {
      audio.ontimeupdate = () => {
        if (audio.advanced || !Number.isFinite(audio.duration)) return
        if (audio.duration - audio.currentTime <= audio.transitionSeconds) {
          void advanceContinuous(activeSession, audio).catch(() => {})
        }
      }
    }
  }

  async function performContinuousAdvance(activeSession, outgoing) {
    if (session !== activeSession || !outgoing || outgoing.advanced) return
    if (activeSession.constructionPolicy?.preserveFullLengthOverlaps &&
        voices.size >= MAX_ACTIVE_VOICES) return
    outgoing.advanced = true
    outgoing.ontimeupdate = null
    if (activeSession.previewSettings.transitionMode === "end-to-end") {
      outgoing.pause()
      completeVoice(outgoing)
    }
    await playContinuous(activeSession)
  }

  function advanceContinuous(activeSession, outgoing = activeSession.currentVoice) {
    if (session !== activeSession) return Promise.resolve()
    if (continuousTransitionInFlight?.session === activeSession) {
      return continuousTransitionInFlight.promise
    }
    const transition = { session: activeSession, promise: Promise.resolve() }
    continuousTransitionInFlight = transition
    transition.promise = performContinuousAdvance(activeSession, outgoing).finally(() => {
      if (continuousTransitionInFlight === transition) continuousTransitionInFlight = null
    })
    return transition.promise
  }

  /** Samples an inclusive numeric policy range with the injected review RNG. */
  function sampleRange(minimum, maximum) {
    return minimum + (maximum - minimum) * random()
  }

  function chooseRegionalWindow(policy, firstWindow) {
    if (policy.kind === "fixed-region-loop") {
      return firstWindow
        ? { startSeconds: policy.firstPassStartSeconds, endSeconds: policy.loopEndSeconds }
        : { startSeconds: policy.loopStartSeconds, endSeconds: policy.loopEndSeconds }
    }
    // A regional voice must finish its entrance before its exit crossfade can
    // start. The reviewer-supplied minimum remains a lower bound; a longer
    // effective window prevents two gain controllers from fighting each other.
    const minimumLoopSeconds = Math.max(
      policy.minimumLoopSeconds,
      policy.crossfadeSeconds * 2,
    )
    const latestStart = policy.regionEndSeconds - minimumLoopSeconds
    const startSeconds = sampleRange(policy.regionStartSeconds, latestStart)
    const endSeconds = sampleRange(startSeconds + minimumLoopSeconds, policy.regionEndSeconds)
    return { startSeconds, endSeconds }
  }

  async function playRegionalWindow(activeSession, window, previous = null) {
    if (session !== activeSession) return null
    const policy = activeSession.runtimePolicy
    const sourceId = activeSession.sources[0].sourceId
    const audio = await playSource(activeSession, {
      volume: previous ? 0 : 1,
      forcedSourceId: sourceId,
      startTimeSeconds: window.startSeconds,
      regionStartSeconds: window.startSeconds,
      regionEndSeconds: window.endSeconds,
    })
    if (!audio || session !== activeSession) return null
    if (Number.isFinite(audio.duration) && window.endSeconds > audio.duration + 0.001) {
      audio.pause()
      completeVoice(audio)
      throw new Error("Signature sound regional loop exceeds the exact source duration")
    }
    activeSession.currentVoice = audio
    audio.onended = () => {
      completeVoice(audio, { ended: true })
      if (activeSession.currentVoice === audio) activeSession.currentVoice = null
      if (session === activeSession && !audio.advanced) {
        void playRegionalWindow(activeSession, chooseRegionalWindow(policy, false)).catch(() => {})
      }
    }
    audio.ontimeupdate = () => {
      if (audio.advanced || !Number.isFinite(audio.currentTime)) return
      if (audio.currentTime >= window.endSeconds - policy.crossfadeSeconds) {
        void advanceRegional(activeSession, audio).catch(() => {})
      }
    }
    if (previous) {
      await fadeController.fadeVoices(activeSession, previous, audio, policy.crossfadeSeconds)
    }
    return audio
  }

  function advanceRegional(activeSession, outgoing = activeSession.currentVoice) {
    if (session !== activeSession || !outgoing || outgoing.advanced) return Promise.resolve()
    if (activeSession.regionalTransitionInFlight) return activeSession.regionalTransitionInFlight
    outgoing.advanced = true
    outgoing.ontimeupdate = null
    const window = chooseRegionalWindow(activeSession.runtimePolicy, false)
    const pending = playRegionalWindow(activeSession, window, outgoing)
    activeSession.regionalTransitionInFlight = pending
    return pending.finally(() => {
      if (activeSession.regionalTransitionInFlight === pending) {
        activeSession.regionalTransitionInFlight = null
      }
    })
  }

  async function startRegional(activeSession) {
    const firstWindow = chooseRegionalWindow(activeSession.runtimePolicy, true)
    await playRegionalWindow(activeSession, firstWindow)
  }

  function createLane(laneId, sourceIds, scheduler) {
    return {
      laneId,
      sourceIds,
      scheduler,
      initialSourceId: null,
      lastSourceId: null,
      recentSourceIds: [],
      currentVoice: null,
      nextTimer: null,
      transitionInFlight: null,
      transitionQueued: false,
      eventInFlight: null,
    }
  }

  function scheduleLaneEvent(activeSession, lane, minimumGapSeconds, maximumGapSeconds) {
    cancelTimer(lane.nextTimer)
    const delay = sampleRange(minimumGapSeconds, maximumGapSeconds) * 1000
    lane.nextTimer = registerTimer(() => {
      lane.nextTimer = null
      void requestLaneEvent(activeSession, lane).catch(() => {})
    }, delay)
  }

  function applyBoundaryEnvelope(audio, scheduler) {
    const target = audio.previewTargetVolume ?? 1
    const elapsed = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    const remaining = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - elapsed) : Number.POSITIVE_INFINITY
    const fadeIn = scheduler.fadeInSeconds > 0 ? Math.min(1, elapsed / scheduler.fadeInSeconds) : 1
    const fadeOut = scheduler.fadeOutSeconds > 0 ? Math.min(1, remaining / scheduler.fadeOutSeconds) : 1
    audio.volume = target * Math.max(0, Math.min(fadeIn, fadeOut))
  }

  /**
   * Native `timeupdate` can be slower than a 250ms review fade. This preview-
   * owned timer keeps the audible boundary envelope near 20Hz and is retired
   * with its exact voice.
   */
  function startBoundaryEnvelope(activeSession, audio, scheduler) {
    let timer = null
    const tick = () => {
      timer = null
      if (session !== activeSession || !voices.has(audio)) return
      applyBoundaryEnvelope(audio, scheduler)
      timer = registerTimer(tick, 50)
    }
    applyBoundaryEnvelope(audio, scheduler)
    timer = registerTimer(tick, 50)
    audio.previewBoundaryEnvelopeCleanup = () => {
      cancelTimer(timer)
      timer = null
      audio.previewBoundaryEnvelopeCleanup = null
    }
  }

  async function playLaneEvent(activeSession, lane) {
    if (session !== activeSession) return
    const scheduler = lane.scheduler
    const audio = await playSource(activeSession, {
      volume: scheduler.fadeInSeconds > 0 ? 0 : 1,
      selectionOwner: lane,
      sourceIds: lane.sourceIds,
      laneId: lane.laneId,
    })
    if (!audio || session !== activeSession) return
    lane.currentVoice = audio
    if (scheduler.fadeInSeconds !== undefined) {
      startBoundaryEnvelope(activeSession, audio, scheduler)
    }
    audio.onended = () => {
      completeVoice(audio, { ended: true })
      if (lane.currentVoice === audio) lane.currentVoice = null
      if (session === activeSession && !audio.advanced) {
        scheduleLaneEvent(
          activeSession,
          lane,
          scheduler.minimumGapSeconds,
          scheduler.maximumGapSeconds,
        )
      }
    }
  }

  function requestLaneEvent(activeSession, lane) {
    if (session !== activeSession) return Promise.resolve()
    if (lane.eventInFlight) return lane.eventInFlight
    const pending = playLaneEvent(activeSession, lane)
    lane.eventInFlight = pending
    return pending.finally(() => {
      if (lane.eventInFlight === pending) lane.eventInFlight = null
    })
  }

  /**
   * A manual review advance replaces the current pause-lane event. Marking the
   * outgoing voice advanced prevents its later `ended` callback from scheduling
   * another event and preserves the lane's no-overlap contract.
   */
  async function advancePauseLane(activeSession, lane) {
    cancelTimer(lane.nextTimer)
    lane.nextTimer = null
    if (lane.currentVoice) {
      const outgoing = lane.currentVoice
      outgoing.advanced = true
      outgoing.onended = null
      outgoing.previewBoundaryEnvelopeCleanup?.()
      if (lane.scheduler.fadeOutSeconds > 0) {
        await fadeController.fadeOutVoice(activeSession, outgoing, lane.scheduler.fadeOutSeconds)
      } else {
        outgoing.pause()
        completeVoice(outgoing)
      }
      if (lane.currentVoice === outgoing) lane.currentVoice = null
    }
    if (session === activeSession) {
      scheduleLaneEvent(
        activeSession,
        lane,
        lane.scheduler.minimumGapSeconds,
        lane.scheduler.maximumGapSeconds,
      )
    }
  }

  async function playLayerVoice(activeSession, lane, previous = null) {
    if (session !== activeSession) return null
    const scheduler = lane.scheduler
    const audio = await playSource(activeSession, {
      volume: previous && scheduler.transitionMode === "crossfade" ? 0 : 1,
      selectionOwner: lane,
      sourceIds: lane.sourceIds,
      laneId: lane.laneId,
    })
    if (!audio || session !== activeSession) return null
    lane.currentVoice = audio
    audio.onended = () => {
      completeVoice(audio, { ended: true })
      if (lane.currentVoice === audio) lane.currentVoice = null
      if (session === activeSession && !audio.advanced) {
        void playLayerVoice(activeSession, lane).catch(() => {})
      }
    }
    audio.ontimeupdate = () => {
      if (audio.advanced || !Number.isFinite(audio.duration)) return
      if (audio.duration - audio.currentTime <= scheduler.transitionSeconds) {
        void advanceLayer(activeSession, lane, audio).catch(() => {})
      }
    }
    if (previous && scheduler.transitionMode === "crossfade") {
      await fadeController.fadeVoices(activeSession, previous, audio, scheduler.transitionSeconds)
    }
    return audio
  }

  function advanceLayer(activeSession, lane, outgoing = lane.currentVoice) {
    if (session !== activeSession || !outgoing || outgoing.advanced) return Promise.resolve()
    if (lane.transitionInFlight) return lane.transitionInFlight
    const voiceCap = activeSession.runtimePolicy.kind === "layered-sequence"
      ? activeSession.runtimePolicy.maximumConcurrentVoices
      : MAX_ACTIVE_VOICES
    if (voices.size >= voiceCap) {
      if (!lane.transitionQueued) {
        lane.transitionQueued = true
        outgoing.ontimeupdate = null
        outgoing.pause()
        activeSession.pendingLayerTransitions.push({ lane, outgoing })
      }
      return Promise.resolve()
    }
    outgoing.advanced = true
    outgoing.ontimeupdate = null
    const pending = playLayerVoice(activeSession, lane, outgoing)
    lane.transitionInFlight = pending
    return pending.finally(() => {
      if (lane.transitionInFlight === pending) lane.transitionInFlight = null
      if (session === activeSession) void drainLayerTransitions(activeSession).catch(() => {})
    })
  }

  /**
   * A strict layered cap reserves one audible slot for a crossfade. When two
   * lanes reach their boundary together, the later lane waits at that boundary
   * and resumes once the prior transition retires its outgoing voice.
   */
  async function drainLayerTransitions(activeSession) {
    if (session !== activeSession || activeSession.pendingLayerTransitions.length === 0) return
    const voiceCap = activeSession.runtimePolicy.kind === "layered-sequence"
      ? activeSession.runtimePolicy.maximumConcurrentVoices
      : MAX_ACTIVE_VOICES
    if (voices.size >= voiceCap) return
    const { lane, outgoing } = activeSession.pendingLayerTransitions.shift()
    lane.transitionQueued = false
    if (!voices.has(outgoing) || outgoing.advanced) {
      await drainLayerTransitions(activeSession)
      return
    }
    try {
      await outgoing.play()
    } catch {
      outgoing.advanced = true
      completeVoice(outgoing)
      if (lane.currentVoice === outgoing) lane.currentVoice = null
      await playLayerVoice(activeSession, lane)
      return
    }
    if (session === activeSession) await advanceLayer(activeSession, lane, outgoing)
  }

  async function startLayered(activeSession) {
    const policy = activeSession.runtimePolicy
    const steadyLaneCount = Math.max(1, policy.maximumConcurrentVoices - 1)
    activeSession.lanes = Array.from({ length: steadyLaneCount }, (_, index) => createLane(
      `lane-${index + 1}`,
      activeSession.sources.map(({ sourceId }) => sourceId),
      {
        transitionMode: policy.transitionMode,
        transitionSeconds: policy.transitionSeconds,
      },
    ))
    await playLayerVoice(activeSession, activeSession.lanes[0])
    for (const lane of activeSession.lanes.slice(1)) {
      const delay = sampleRange(0, policy.initialStartWindowSeconds) * 1000
      lane.nextTimer = registerTimer(() => {
        lane.nextTimer = null
        void playLayerVoice(activeSession, lane).catch(() => {})
      }, delay)
    }
  }

  async function startMultiLane(activeSession) {
    activeSession.lanes = activeSession.runtimePolicy.lanes.map((rawLane, index) => {
      const scheduler = rawLane.boundaryMode === "crossfade"
        ? { transitionMode: "crossfade", transitionSeconds: rawLane.transitionSeconds }
        : {
            minimumGapSeconds: rawLane.minimumGapSeconds,
            maximumGapSeconds: rawLane.maximumGapSeconds,
            fadeInSeconds: 0,
            fadeOutSeconds: 0,
          }
      return createLane(`lane-${index + 1}`, rawLane.sourceIds, scheduler)
    })
    await Promise.all(activeSession.lanes.map((lane, index) => (
      activeSession.runtimePolicy.lanes[index].boundaryMode === "crossfade"
        ? playLayerVoice(activeSession, lane)
        : requestLaneEvent(activeSession, lane)
    )))
  }

  function scheduleEvent(activeSession, delay) {
    cancelTimer(activeSession.nextTimer)
    activeSession.nextTimer = registerTimer(() => {
      activeSession.nextTimer = null
      void requestEvent(activeSession, {
        queueAfterInFlight: activeSession.strategyId === "walking-cadence-sequence",
      }).catch(() => {})
    }, delay)
  }

  function requestEvent(activeSession, { queueAfterInFlight = false } = {}) {
    if (session !== activeSession) return Promise.resolve()
    if (eventInFlight?.session === activeSession) {
      if (queueAfterInFlight) activeSession.eventQueuedAfterInFlight = true
      return eventInFlight.promise
    }
    const transition = { session: activeSession, promise: Promise.resolve() }
    eventInFlight = transition
    transition.promise = playEvent(activeSession).finally(() => {
      if (eventInFlight === transition) eventInFlight = null
      if (session === activeSession && activeSession.eventQueuedAfterInFlight) {
        activeSession.eventQueuedAfterInFlight = false
        void requestEvent(activeSession).catch(() => {})
      }
    })
    return transition.promise
  }

  async function playEvent(activeSession) {
    if (session !== activeSession) return
    const cadenceBoundary = activeSession.strategyId === "walking-cadence-sequence"
      ? activeSession.constructionPolicy?.cadenceBoundary
      : null
    const previous = activeSession.currentVoice
    const retiresPreviousAtCadenceBoundary = activeSession.strategyId === "walking-cadence-sequence"
      && activeSession.constructionPolicy !== null
      && !cadenceBoundary
      && !activeSession.constructionPolicy.overlapNextEvent
    const audio = await playSource(activeSession, {
      volume: cadenceBoundary?.mode === "crossfade" && previous ? 0 : 1,
    })
    if (!audio || session !== activeSession) return
    if (previous && retiresPreviousAtCadenceBoundary) {
      previous.advanced = true
      previous.pause()
      completeVoice(previous)
    }
    activeSession.currentVoice = audio
    audio.onended = () => {
      completeVoice(audio, { ended: true })
      if (activeSession.currentVoice === audio) activeSession.currentVoice = null
      if (audio.advanced) return
      if (session === activeSession && activeSession.strategyId === "spaced-event-sequence") {
        scheduleEvent(activeSession, getSignatureSoundPreviewDelayMs(
          activeSession.strategyId,
          activeSession.previewSettings,
          random,
        ))
      }
    }
    const cadenceFade = previous && cadenceBoundary?.mode === "crossfade"
      ? fadeController.fadeVoices(activeSession, previous, audio, cadenceBoundary.crossfadeSeconds)
      : Promise.resolve()
    if (activeSession.strategyId === "walking-cadence-sequence") {
      scheduleEvent(activeSession, getSignatureSoundPreviewDelayMs(
        activeSession.strategyId,
        activeSession.previewSettings,
        random,
      ))
    }
    await cadenceFade
  }

  async function start(configuration) {
    stop()
    if (!configuration || !Array.isArray(configuration.sources) || configuration.sources.length === 0) {
      throw new Error("Signature sound preview needs at least one playable source")
    }
    if (configuration.initialSourceId !== undefined
      && !configuration.sources.some(({ sourceId }) => sourceId === configuration.initialSourceId)) {
      throw new Error("Signature sound preview initial source must be an included source")
    }
    const previewSettings = validateSignatureSoundPreviewSettings(
      configuration.strategyId,
      configuration.previewSettings,
    )
    const constructionPolicy = configuration.constructionPolicy === undefined
      ? null
      : validateSignatureSoundConstructionPlaybackPolicy(
          configuration.strategyId,
          previewSettings,
          configuration.constructionPolicy,
        )
    const activeSession = {
      groupId: configuration.groupId,
      strategyId: configuration.strategyId,
      previewSettings,
      constructionPolicy,
      sources: configuration.sources.map((source) => ({ ...source })),
      initialSourceId: configuration.initialSourceId ?? null,
      lastSourceId: null,
      recentSourceIds: [],
      currentVoice: null,
      nextTimer: null,
      eventQueuedAfterInFlight: false,
      runtimePolicy: configuration.runtimePolicy ?? null,
      repeatSourceId: null,
      repeatSourcePlaysRemaining: 0,
      lanes: [],
      regionalTransitionInFlight: null,
      pendingLayerTransitions: [],
    }
    session = activeSession
    if (activeSession.runtimePolicy?.kind === "fixed-region-loop" ||
        activeSession.runtimePolicy?.kind === "random-region-loop") {
      await startRegional(activeSession)
    } else if (activeSession.runtimePolicy?.kind === "pause-separated-sequence") {
      const policy = activeSession.runtimePolicy
      const lane = createLane("lane-1", activeSession.sources.map(({ sourceId }) => sourceId), {
        minimumGapSeconds: policy.minimumGapSeconds,
        maximumGapSeconds: policy.maximumGapSeconds,
        fadeInSeconds: policy.fadeInSeconds,
        fadeOutSeconds: policy.fadeOutSeconds,
      })
      activeSession.lanes = [lane]
      await requestLaneEvent(activeSession, lane)
    } else if (activeSession.runtimePolicy?.kind === "layered-sequence") {
      await startLayered(activeSession)
    } else if (activeSession.runtimePolicy?.kind === "multi-lane-sequence") {
      await startMultiLane(activeSession)
    } else if (CONTINUOUS_STRATEGIES.has(activeSession.strategyId)) await playContinuous(activeSession)
    else await requestEvent(activeSession)
  }

  async function advanceSession(activeSession) {
    if (activeSession.runtimePolicy?.kind === "fixed-region-loop" ||
        activeSession.runtimePolicy?.kind === "random-region-loop") {
      await advanceRegional(activeSession)
      return
    }
    if (activeSession.runtimePolicy?.kind === "pause-separated-sequence") {
      const lane = activeSession.lanes[0]
      await advancePauseLane(activeSession, lane)
      return
    }
    if (activeSession.runtimePolicy?.kind === "layered-sequence") {
      await advanceLayer(activeSession, activeSession.lanes[0])
      return
    }
    if (activeSession.runtimePolicy?.kind === "multi-lane-sequence") {
      await Promise.all(activeSession.lanes.map((lane, index) => (
        activeSession.runtimePolicy.lanes[index].boundaryMode === "crossfade"
          ? advanceLayer(activeSession, lane)
          : advancePauseLane(activeSession, lane)
      )))
      return
    }
    if (CONTINUOUS_STRATEGIES.has(activeSession.strategyId)) {
      await advanceContinuous(activeSession)
      return
    }
    cancelTimer(activeSession.nextTimer)
    activeSession.nextTimer = null
    if (activeSession.strategyId === "spaced-event-sequence" && activeSession.currentVoice) {
      activeSession.currentVoice.advanced = true
      activeSession.currentVoice.pause()
      completeVoice(activeSession.currentVoice)
      activeSession.currentVoice = null
    }
    await requestEvent(activeSession)
  }

  function advance() {
    if (!session) return Promise.resolve()
    if (advanceInFlight) return advanceInFlight
    const pending = advanceSession(session)
    advanceInFlight = pending
    return pending.finally(() => {
      if (advanceInFlight === pending) advanceInFlight = null
    })
  }

  function seekVoice(voiceId, seconds) {
    if (typeof voiceId !== "string" || !Number.isFinite(seconds)) return false
    const audio = [...voices].find((candidate) => candidate.previewVoiceId === voiceId)
    if (!audio) return false
    const minimum = Number.isFinite(audio.previewRegionStartSeconds)
      ? Math.max(0, audio.previewRegionStartSeconds)
      : 0
    const maximum = Number.isFinite(audio.previewRegionEndSeconds)
      ? audio.previewRegionEndSeconds
      : Number.isFinite(audio.duration)
        ? Math.max(0, audio.duration)
        : Number.POSITIVE_INFINITY
    audio.currentTime = Math.min(maximum, Math.max(minimum, seconds))
    emitVoiceTelemetry()
    return true
  }

  return { start, stop, advance, seekVoice }
}
