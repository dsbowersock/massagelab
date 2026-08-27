"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createSignatureSoundPreviewPlayer } from "@/lib/atmoshaper/signature-sound-preview-player"
import {
  resolveSignatureSoundWholeConceptAudioUrl,
  signatureSoundConceptHasAuditionableSources,
  signatureSoundConceptRequiresSpeechReduction,
} from "@/lib/atmoshaper/signature-sound-review-audio-url"
import { ActiveVoiceTimelines, type ActiveVoiceTelemetry } from "./active-voice-timelines"
import { WholeConceptPolicySummary } from "./whole-concept-policy-summary"

type WholeConceptSource = {
  sourceId: string
  relativePath: string
  gainDb?: number
  audioUrl?: string
  sourceSetId?: string
  sourceSetLabel?: string
}
type PreviewStatus = {
  state: "idle" | "playing" | "error"
  sourceId?: string
  relativePath?: string
  message?: string
}
type ConstructionPolicy = {
  minimumSelectionsBeforeRepeat: number | null
  transitionDurationRange: { minimumSeconds: number; maximumSeconds: number } | null
  cadenceBoundary: { mode: string; crossfadeSeconds: number } | null
  overlapNextEvent: boolean
  preserveFullLengthOverlaps?: boolean
}
type PreviewSettings =
  | { transitionMode: string; transitionSeconds: number }
  | { stepsPerMinute: number; jitterPercent: number }
  | { minimumGapSeconds: number; maximumGapSeconds: number }
type WholeConceptLevelMatch = {
  method: string
  targetPolicy: string
  targetIntegratedLoudnessLufs: number
}

export type WholeConceptReviewEntry = {
  batchId: string
  groupId: string
  label: string
  reviewFingerprint: string
  sources: WholeConceptSource[]
  playbackConfiguration: {
    strategyId: string
    previewSettings: PreviewSettings
    constructionPolicy: ConstructionPolicy
  }
  runtimePolicy: Record<string, unknown> | null
  sourceSelection?: { kind: "single-source-loop" } | null
  showSourceAuditions?: boolean
  levelMatch?: WholeConceptLevelMatch | null
  reviewState: "ready-to-audition" | "processing-required" | "insufficient-sources"
  processingRequirements: Array<{ kind: string; detail: string }>
  amendment: {
    state: "ready-to-audition" | "processing-required" | "insufficient-sources"
    summary: string
  } | null
  revision: {
    kind: string
    state: "needs-timing" | "ready-to-audition"
    summary: string
    targetIntegratedLoudnessLufs?: number
  } | null
  chatOutcome?: {
    decision: "pass" | "change" | "reject"
    note: string
    reviewedAt: string
  } | null
}

export type WholeConceptReviewCatalog = {
  entries: WholeConceptReviewEntry[]
  redirects?: Array<{ batchId: string; targetBatchId: string }>
}

/** Auditions one raw-only catalog entry through the shared construction scheduler. */
export function WholeConceptReview({
  entry,
  batchPosition,
  batchCount,
  conceptPosition,
  conceptCount,
  previousBatchId,
  nextBatchId,
}: {
  entry: WholeConceptReviewEntry
  batchPosition: number
  batchCount: number
  conceptPosition: number
  conceptCount: number
  previousBatchId: string | null
  nextBatchId: string | null
}) {
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ state: "idle" })
  const [activeVoices, setActiveVoices] = useState<ActiveVoiceTelemetry[]>([])
  const [starting, setStarting] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState(entry.sources[0]?.sourceId ?? "")
  const playerRef = useRef<ReturnType<typeof createSignatureSoundPreviewPlayer> | null>(null)
  const requestRef = useRef(0)
  const requiresSpeechReduction = signatureSoundConceptRequiresSpeechReduction(entry)
  const hasCompleteProcessedUrls = !requiresSpeechReduction || entry.sources.every(({ audioUrl }) => (
    typeof audioUrl === "string" && audioUrl.startsWith("/api/dev/atmoshaper-candidates/speech-reduction/")
  ))
  const hasAuditionableSources = signatureSoundConceptHasAuditionableSources(entry)
  const auditionKind = requiresSpeechReduction && hasCompleteProcessedUrls ? "Processed" : "Raw"

  useEffect(() => {
    let mounted = true
    const player = createSignatureSoundPreviewPlayer({
      resolveAudioUrl(source: WholeConceptSource) {
        return resolveSignatureSoundWholeConceptAudioUrl(source, { requiresSpeechReduction })
      },
      onStatus(status: PreviewStatus) {
        if (mounted) setPreviewStatus(status)
      },
      onVoiceTelemetry(snapshot: { voices: ActiveVoiceTelemetry[] }) {
        if (mounted) setActiveVoices(snapshot.voices)
      },
    })
    playerRef.current = player
    return () => {
      mounted = false
      requestRef.current += 1
      playerRef.current = null
      player.stop()
    }
  }, [requiresSpeechReduction])

  async function startConcept() {
    const player = playerRef.current
    if (!player) return
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    player.stop()
    setStarting(true)
    try {
      await player.start({
        groupId: entry.groupId,
        strategyId: entry.playbackConfiguration.strategyId,
        previewSettings: entry.playbackConfiguration.previewSettings,
        constructionPolicy: entry.playbackConfiguration.constructionPolicy,
        sources: entry.sourceSelection?.kind === "single-source-loop"
          ? entry.sources.filter(({ sourceId }) => sourceId === selectedSourceId)
          : entry.sources,
        runtimePolicy: entry.runtimePolicy,
      })
    } catch {
      // Playback failures are surfaced through the shared player's status callback.
    } finally {
      if (requestRef.current === requestId) setStarting(false)
    }
  }

  function stopConcept() {
    requestRef.current += 1
    setStarting(false)
    playerRef.current?.stop()
  }

  async function advanceConcept() {
    try {
      await playerRef.current?.advance()
    } catch {
      // Playback failures are surfaced through the shared player's status callback.
    }
  }

  function seekVoice(voiceId: string, seconds: number) {
    playerRef.current?.seekVoice(voiceId, seconds)
  }

  const playing = previewStatus.state === "playing"
  const hasActiveVoices = activeVoices.length > 0
  const waitingForNextEvent = playing
    && !hasActiveVoices
    && (entry.playbackConfiguration.strategyId === "spaced-event-sequence"
      || entry.runtimePolicy?.kind === "pause-separated-sequence")
  const processingBlocked = !hasAuditionableSources
  return (
    <section className="space-y-5" aria-labelledby="whole-concept-review-heading">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Batch {entry.batchId.slice(6, 8)} · Review {batchPosition} of {batchCount} · {auditionKind} concept {conceptPosition} of {conceptCount}
        </p>
        <h2 id="whole-concept-review-heading" className="text-2xl font-semibold">{entry.label}</h2>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          {entry.sources.length} {entry.sources.length === 1 ? "source" : "sources"} · Strategy: {entry.playbackConfiguration.strategyId}
        </p>
        {entry.chatOutcome?.decision === "pass" ? (
          <p className="w-fit rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-700 dark:text-emerald-300">
            {entry.reviewState === "processing-required" ? "Current stage passed in chat" : "Passed in chat"}
          </p>
        ) : null}
      </div>

      <WholeConceptPolicySummary
        configuration={entry.playbackConfiguration}
        runtimePolicy={entry.runtimePolicy}
        sourceSelection={entry.sourceSelection}
        levelMatch={entry.levelMatch}
      />

      {entry.sourceSelection?.kind === "single-source-loop" ? (
        <section className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-4" aria-labelledby="single-source-loop-choice">
          <h3 id="single-source-loop-choice" className="font-medium">Choose the one recording to loop</h3>
          <p className="text-sm text-muted-foreground">
            Starting the concept loops only this selection. Changing it stops the current concept first.
          </p>
          <select
            className="min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            value={selectedSourceId}
            onChange={(event) => {
              stopConcept()
              setSelectedSourceId(event.target.value)
            }}
          >
            {entry.sources.map((source) => (
              <option key={source.sourceId} value={source.sourceId}>{sourceName(source.relativePath)}</option>
            ))}
          </select>
        </section>
      ) : null}

      {entry.amendment ? (
        <div className={entry.reviewState === "processing-required"
          ? "rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm"
          : entry.reviewState === "insufficient-sources"
            ? "rounded-xl border border-muted-foreground/40 bg-muted/40 p-4 text-sm"
            : "rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm"}>
          <p className="font-medium">
            {entry.reviewState === "processing-required"
              ? "Requested audio treatment is still required"
              : entry.reviewState === "insufficient-sources"
                ? "Held outside production"
                : "Reviewer amendment is active"}
          </p>
          <p className="mt-1 text-muted-foreground">{entry.amendment.summary}</p>
          {entry.processingRequirements.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {entry.processingRequirements.map(({ kind, detail }) => (
                <li key={`${kind}:${detail}`}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : entry.revision ? (
        <div className={entry.revision.state === "needs-timing"
          ? "rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm"
          : "rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm"}>
          <p className="font-medium">
            {entry.revision.state === "needs-timing" ? "Requested policy needs timing" : "Requested revision is active"}
          </p>
          <p className="mt-1 text-muted-foreground">{entry.revision.summary}</p>
        </div>
      ) : null}

      <AppSurface
        title={`${entry.label} · Complete ${auditionKind.toLowerCase()} concept`}
        description="The exact accepted source pool and currently reviewed selection, timing, level, and transition policy, including any active reviewer revision or processed treatment."
        variant="inset"
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void startConcept()} disabled={processingBlocked || starting || playing}>Start concept</Button>
          <Button type="button" variant="outline" onClick={stopConcept} disabled={!starting && !playing && !hasActiveVoices}>Stop concept</Button>
          <Button type="button" variant="outline" onClick={() => void advanceConcept()} disabled={!playing}>Next transition / event</Button>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {starting
            ? "Starting concept…"
            : processingBlocked
              ? "This concept will reopen after its requested audio treatment has an exact auditionable result."
            : entry.reviewState === "processing-required"
              ? "Ready to audition the current processed treatment; additional processing is still required."
            : waitingForNextEvent
              ? "Waiting for the next spaced event."
            : playing
              ? "Concept is playing."
              : previewStatus.state === "error"
                ? hasActiveVoices
                  ? "A replacement failed; existing recordings may still be playing."
                  : "Playback stopped after an error."
                : "Ready to audition."}
        </p>
        {playing && hasActiveVoices ? (
          <p className="text-sm text-muted-foreground">
            Current source: {previewStatus.relativePath ?? previewStatus.sourceId ?? "selecting a source"}
          </p>
        ) : null}
        {previewStatus.state === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {previewStatus.message ?? "The selected source could not be played."}
          </p>
        ) : null}
        <ActiveVoiceTimelines
          voices={activeVoices}
          onSeek={seekVoice}
          emptyMessage={waitingForNextEvent
            ? "Waiting for the next recording in this spaced-event sequence."
            : undefined}
        />
      </AppSurface>

      {entry.showSourceAuditions ? (
        <details className="rounded-xl border bg-muted/20 p-4">
          <summary className="cursor-pointer font-medium">
            Individual source auditions ({entry.sources.length})
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            These controls play one raw recording at a time for source-level notes. They do not change the complete-concept pool.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {entry.sources.map((source) => (
              <article className="space-y-2 rounded-lg border bg-background p-3" key={source.sourceId}>
                <p className="break-words text-sm font-medium">{sourceName(source.relativePath)}</p>
                {source.sourceSetLabel ? (
                  <p className="text-xs text-muted-foreground">{source.sourceSetLabel}</p>
                ) : null}
                <audio
                  className="w-full"
                  controls
                  preload="none"
                  src={`/api/dev/atmoshaper-candidates/audio/${encodeURIComponent(source.sourceId)}`}
                >
                  Your browser does not support this audio recording.
                </audio>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {entry.chatOutcome?.decision === "pass" ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          {entry.reviewState === "processing-required"
            ? "This exact processed stage is recorded as Pass from chat. The remaining treatments listed above are still pending."
            : "This exact concept is recorded as Pass from chat. Reply with a change only if you want to reopen it."}
        </p>
      ) : entry.reviewState === "processing-required" && hasAuditionableSources ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          Reply with notes on this processed treatment. A whole-concept Pass remains pending until the remaining treatments are built.
        </p>
      ) : (
        <p className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
          Reply in chat with Pass or what should change.
        </p>
      )}
      <nav aria-label="Raw concept review sequence" className="flex flex-wrap justify-between gap-3">
        {previousBatchId ? (
          <Button asChild variant="outline">
            <Link href={`/dev/candidates/processing?batch=${encodeURIComponent(previousBatchId)}`}>Previous concept</Link>
          </Button>
        ) : <Button type="button" variant="outline" disabled>Previous concept</Button>}
        {nextBatchId ? (
          <Button asChild variant="outline">
            <Link href={`/dev/candidates/processing?batch=${encodeURIComponent(nextBatchId)}`}>Next concept</Link>
          </Button>
        ) : <Button type="button" variant="outline" disabled>Next concept</Button>}
      </nav>
    </section>
  )
}

function sourceName(relativePath: string) {
  return relativePath.split("/").at(-1) ?? relativePath
}
