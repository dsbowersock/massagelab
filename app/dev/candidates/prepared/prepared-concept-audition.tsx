"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { createSignatureSoundPreviewPlayer } from "@/lib/atmoshaper/signature-sound-preview-player"
import { ActiveVoiceTimelines, type ActiveVoiceTelemetry } from "../processing/active-voice-timelines"
import { WholeConceptPolicySummary } from "../processing/whole-concept-policy-summary"
import type {
  PreparedConceptPlaybackEntry,
  PreparedConceptPlaybackSource,
} from "./prepared-playback-types"

type AuditionStatus = {
  state: "idle" | "loading" | "playing" | "error"
  message?: string
}

type PrebakedTimeline = {
  artifactPositionSeconds: number
  artifactDurationSeconds: number
}

type ActiveAudition = { owner: symbol; stop: () => void }

/** Owns the cross-row playback handoff without exposing mutable module state to React components. */
function createActiveAuditionCoordinator() {
  let current: ActiveAudition | null = null
  return {
    claim(audition: ActiveAudition) {
      current = audition
    },
    release(owner: symbol) {
      if (current?.owner === owner) current = null
    },
    stopCurrent() {
      const audition = current
      current = null
      audition?.stop()
    },
  }
}

const activeAuditions = createActiveAuditionCoordinator()

/**
 * Starts one exact reviewed concept on demand. The module-level handoff keeps
 * only one prepared concept audible even when the responsive page renders the
 * same control in both its table and card layouts.
 */
export function PreparedConceptAudition({
  entry,
  detailed = false,
}: {
  entry: PreparedConceptPlaybackEntry
  detailed?: boolean
}) {
  const ownerRef = useRef(Symbol(entry.groupId))
  const playerRef = useRef<ReturnType<typeof createSignatureSoundPreviewPlayer> | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const frameRef = useRef<number | null>(null)
  const requestRef = useRef(0)
  const mountedRef = useRef(true)
  const [status, setStatus] = useState<AuditionStatus>({ state: "idle" })
  const [voices, setVoices] = useState<ActiveVoiceTelemetry[]>([])
  const [prebakedTimeline, setPrebakedTimeline] = useState<PrebakedTimeline | null>(null)

  function stopAudition(updateState = true) {
    requestRef.current += 1
    playerRef.current?.stop()
    playerRef.current = null
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    try { bufferSourceRef.current?.stop() } catch { /* The source may already be stopped. */ }
    bufferSourceRef.current = null
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== "closed") void context.close()
    activeAuditions.release(ownerRef.current)
    if (updateState && mountedRef.current) {
      setVoices([])
      setPrebakedTimeline(null)
      setStatus({ state: "idle" })
    }
  }

  useEffect(() => () => {
    mountedRef.current = false
    stopAudition(false)
  }, [])

  async function startAudition() {
    activeAuditions.stopCurrent()
    stopAudition()
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    activeAuditions.claim({ owner: ownerRef.current, stop: () => stopAudition() })
    setStatus({ state: "loading" })
    try {
      if (entry.playbackMode?.kind === "prebaked-intro-loop") {
        await startPrebakedIntroLoop(entry, requestId)
        return
      }
      const player = createSignatureSoundPreviewPlayer({
        resolveAudioUrl(source: PreparedConceptPlaybackSource) {
          if (!source.audioUrl) throw new Error("Prepared concept source is missing its exact audio URL")
          return source.audioUrl
        },
        onStatus(next: { state: "idle" | "playing" | "error"; message?: string }) {
          if (!mountedRef.current || requestRef.current !== requestId) return
          setStatus(next)
        },
        onVoiceTelemetry(snapshot: { voices: ActiveVoiceTelemetry[] }) {
          if (mountedRef.current && requestRef.current === requestId) setVoices(snapshot.voices)
        },
      })
      playerRef.current = player
      await player.start({
        groupId: entry.groupId,
        strategyId: entry.playbackConfiguration.strategyId,
        previewSettings: entry.playbackConfiguration.previewSettings,
        constructionPolicy: entry.playbackConfiguration.constructionPolicy,
        sources: entry.sourceSelection?.kind === "single-source-loop"
          ? entry.sources.slice(0, 1)
          : entry.sources,
        runtimePolicy: entry.runtimePolicy,
      })
    } catch (error) {
      if (mountedRef.current && requestRef.current === requestId) {
        setStatus({
          state: "error",
          message: error instanceof Error ? error.message : "The prepared concept could not be played.",
        })
      }
    }
  }

  /** Reuses the already-rendered loop seam without repeating its one-time opening. */
  async function startPrebakedIntroLoop(
    playbackEntry: PreparedConceptPlaybackEntry,
    requestId: number,
  ) {
    const source = playbackEntry.sources[0]
    if (!source || playbackEntry.sources.length !== 1) {
      throw new Error("The prepared loop concept needs exactly one selected artifact")
    }
    const response = await fetch(source.audioUrl, { cache: "no-store" })
    if (!response.ok) throw new Error("The exact prepared loop artifact could not be loaded")
    const context = new AudioContext()
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    if (!mountedRef.current || requestRef.current !== requestId) {
      await context.close()
      return
    }
    const loopStartSeconds = playbackEntry.playbackMode?.kind === "prebaked-intro-loop"
      ? playbackEntry.playbackMode.artifactLoopStartSeconds
      : 0
    if (loopStartSeconds <= 0 || loopStartSeconds >= buffer.duration) {
      await context.close()
      throw new Error("The exact prepared loop timing does not fit its artifact")
    }
    const bufferSource = context.createBufferSource()
    bufferSource.buffer = buffer
    bufferSource.loop = true
    bufferSource.loopStart = loopStartSeconds
    bufferSource.loopEnd = buffer.duration
    bufferSource.connect(context.destination)
    bufferSource.start()
    contextRef.current = context
    bufferSourceRef.current = bufferSource
    const startedAt = context.currentTime
    const loopDurationSeconds = buffer.duration - loopStartSeconds
    const updateTimeline = () => {
      if (bufferSourceRef.current !== bufferSource) return
      const elapsed = context.currentTime - startedAt
      const artifactPositionSeconds = elapsed < loopStartSeconds
        ? elapsed
        : loopStartSeconds + ((elapsed - loopStartSeconds) % loopDurationSeconds)
      setPrebakedTimeline({ artifactPositionSeconds, artifactDurationSeconds: buffer.duration })
      frameRef.current = requestAnimationFrame(updateTimeline)
    }
    setPrebakedTimeline({ artifactPositionSeconds: 0, artifactDurationSeconds: buffer.duration })
    setStatus({ state: "playing" })
    frameRef.current = requestAnimationFrame(updateTimeline)
  }

  const playing = status.state === "playing"
  const loading = status.state === "loading"
  return (
    <div className={detailed ? "space-y-3" : "inline-flex flex-wrap items-center gap-2"}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size={detailed ? "default" : "compact"}
          variant={playing ? "outline" : "default"}
          disabled={loading}
          aria-label={`${playing ? "Stop" : "Play"} ${entry.label} concept`}
          onClick={playing ? () => stopAudition() : startAudition}
        >
          {loading ? "Loading…" : playing ? "Stop" : "Play"}
        </Button>
        {detailed && entry.playbackMode?.kind !== "prebaked-intro-loop" ? (
          <Button
            type="button"
            variant="outline"
            disabled={!playing}
            onClick={() => playerRef.current?.advance()}
          >
            Next transition
          </Button>
        ) : null}
      </div>
      {detailed ? (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {status.state === "idle"
              ? "Ready to audition the complete prepared concept."
              : status.state === "loading"
                ? "Loading the exact reviewed audio…"
                : status.state === "playing"
                  ? entry.playbackMode?.kind === "prebaked-intro-loop"
                    ? "Playing the opening once, then repeating the approved loop."
                    : "The complete reviewed concept is playing."
                  : status.message ?? "The prepared concept could not be played."}
          </p>
          {entry.playbackMode?.kind === "prebaked-intro-loop" ? (
            <PrebakedIntroLoopDetails mode={entry.playbackMode} timeline={prebakedTimeline} playing={playing} />
          ) : (
            <>
              {entry.selectionSummary ? (
                <p className="rounded-xl border bg-background/50 p-4 text-sm">
                  <strong>Selected audio:</strong> {entry.selectionSummary}
                </p>
              ) : null}
              <WholeConceptPolicySummary
                configuration={entry.playbackConfiguration}
                runtimePolicy={entry.runtimePolicy}
                sourceSelection={entry.sourceSelection}
              />
              {voices.length === 0 && entry.sources.length === 1 && entry.sources[0].durationSeconds ? (
                <PreparedSourceTimeline source={entry.sources[0]} />
              ) : (
                <ActiveVoiceTimelines
                  voices={voices}
                  onSeek={(voiceId, seconds) => playerRef.current?.seekVoice(voiceId, seconds)}
                />
              )}
            </>
          )}
        </>
      ) : status.state === "error" ? (
        <span className="text-xs text-destructive" role="alert">Could not play</span>
      ) : null}
    </div>
  )
}

/** Shows the exact selected recording's duration before Web Audio telemetry begins. */
function PreparedSourceTimeline({ source }: { source: PreparedConceptPlaybackSource }) {
  const duration = source.durationSeconds ?? 0
  return (
    <div className="space-y-2 rounded-xl border bg-background/50 p-4">
      <h4 className="font-medium">Selected recording timeline</h4>
      <p className="break-all text-sm font-medium">{source.relativePath}</p>
      <div
        className="h-3 rounded-full bg-muted"
        role="progressbar"
        aria-label={`Selected recording timeline: ${source.relativePath}`}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={0}
        aria-valuetext={`Elapsed 0:00 of ${formatAudioTime(duration)} · ready`}
      />
      <div className="flex justify-between gap-3 text-xs tabular-nums text-muted-foreground">
        <span>0:00</span>
        <span>{formatAudioTime(duration)}</span>
      </div>
      <p className="text-xs text-muted-foreground">Start the concept to follow and seek the live recording timeline.</p>
    </div>
  )
}

/** Makes the baked artifact coordinates and the original source-time recipe equally explicit. */
function PrebakedIntroLoopDetails({ mode, timeline, playing }: {
  mode: NonNullable<PreparedConceptPlaybackEntry["playbackMode"]>
  timeline: PrebakedTimeline | null
  playing: boolean
}) {
  const expectedArtifactDuration = mode.artifactLoopStartSeconds +
    (mode.sourceLoopEndSeconds - mode.sourceLoopStartSeconds - mode.crossfadeSeconds)
  const duration = timeline?.artifactDurationSeconds ?? expectedArtifactDuration
  const position = Math.min(duration, Math.max(0, timeline?.artifactPositionSeconds ?? 0))
  const percentage = duration > 0 ? (position / duration) * 100 : 0
  const seamEnd = mode.artifactLoopStartSeconds + mode.crossfadeSeconds
  const phase = !playing
    ? "Ready"
    : position < mode.artifactLoopStartSeconds
      ? "One-time opening"
      : position < seamEnd
        ? `${formatDurationSeconds(mode.crossfadeSeconds)} return crossfade`
        : "Repeating loop body"

  return (
    <div className="space-y-4 rounded-xl border bg-background/50 p-4">
      <div>
        <h4 className="font-medium">Current concept design</h4>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Opening</dt>
            <dd className="mt-1 font-medium">
              {formatAudioTime(mode.firstPassStartSeconds)}–{formatAudioTime(mode.sourceLoopEndSeconds)} · once
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Repeating region</dt>
            <dd className="mt-1 font-medium">
              {formatAudioTime(mode.sourceLoopStartSeconds)}–{formatAudioTime(mode.sourceLoopEndSeconds)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Return transition</dt>
            <dd className="mt-1 font-medium">
              {formatDurationSeconds(mode.crossfadeSeconds)} {formatCrossfadeCurve(mode.crossfadeCurve)} crossfade
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The opening never repeats. The rendered artifact loops internally at {formatAudioTime(mode.artifactLoopStartSeconds)}{" "}
          because the approved return crossfade is already baked into the audio.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-medium">Rendered playback timeline</h4>
          <p className="text-xs text-muted-foreground">{phase}</p>
        </div>
        <div
          className="relative h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Boiling Water rendered playback timeline"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={position}
          aria-valuetext={`${formatAudioTime(position)} of ${formatAudioTime(duration)} · ${phase}`}
        >
          <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
        </div>
        <div className="flex justify-between gap-3 text-xs tabular-nums text-muted-foreground">
          <span>{formatAudioTime(position)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Return seam begins at {formatAudioTime(mode.artifactLoopStartSeconds)}; reaching the artifact end returns there.
        </p>
      </div>
    </div>
  )
}

function formatCrossfadeCurve(curve: string) {
  return curve === "qsin" ? "equal-power" : curve
}

function formatDurationSeconds(seconds: number) {
  return `${seconds}-second`
}

function formatAudioTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds - minutes * 60
  const fixed = Number.isInteger(remainder) ? String(remainder) : remainder.toFixed(1)
  return `${minutes}:${fixed.padStart(fixed.includes(".") ? 4 : 2, "0")}`
}
