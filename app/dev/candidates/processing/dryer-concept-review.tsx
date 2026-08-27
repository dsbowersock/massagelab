"use client"

import { useEffect, useRef, useState } from "react"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createSignatureSoundPreviewPlayer } from "@/lib/atmoshaper/signature-sound-preview-player"

type Measurement = {
  durationSeconds: number
  integratedLoudnessLufs: number
  truePeakDbtp: number
}
type DryerOutput = {
  sourceId: string
  outputIdentity: string
  inputMeasurement: Measurement
  outputMeasurement: Measurement
}
export type DryerManifest = {
  version: 1
  batchId: "batch-05-dryer-trim-audition"
  batchDeclarationSha256: string
  groupId: "moodist:dryer"
  outputs: [DryerOutput]
}
export type DryerPlaybackConfiguration = {
  strategyId: "adaptive-whole-source-sequence"
  previewSettings: { transitionMode: "crossfade"; transitionSeconds: 3.75 }
  constructionPolicy: {
    minimumSelectionsBeforeRepeat: null
    transitionDurationRange: { minimumSeconds: 3.75; maximumSeconds: 10 }
    cadenceBoundary: null
    overlapNextEvent: false
  }
}
export type DryerConceptSelection = {
  selectedTarget: "dry" | "trimmed"
  selectedLabel: "Dry concept" | "Trimmed candidate"
  decision: "pass"
  note: string
  reviewedAt: string
}
type PreviewSource = { sourceId: string; relativePath: string; audioUrl: string }
type PreviewStatus = {
  state: "idle" | "playing" | "error"
  relativePath?: string
  message?: string
}

/** Compares the unedited and boundary-trimmed Dryer as complete dynamic concepts. */
export function DryerConceptReview({ manifest, sourcePath, conceptLabel, playbackConfiguration, selection }: {
  manifest: DryerManifest
  sourcePath: string
  conceptLabel: string
  playbackConfiguration: DryerPlaybackConfiguration
  selection: DryerConceptSelection
}) {
  const [activeTarget, setActiveTarget] = useState<"dry" | "trimmed" | null>(null)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ state: "idle" })
  const playerRef = useRef<ReturnType<typeof createSignatureSoundPreviewPlayer> | null>(null)
  const requestRef = useRef(0)
  const output = manifest.outputs[0]
  const sourceId = output.sourceId

  useEffect(() => {
    let mounted = true
    const player = createSignatureSoundPreviewPlayer({
      resolveAudioUrl(source: PreviewSource) {
        if (!source.audioUrl) throw new Error("Dryer concept source is missing its closed audio URL")
        return source.audioUrl
      },
      onStatus(status: PreviewStatus) {
        if (!mounted) return
        if (status.state !== "playing") setActiveTarget(null)
        setPreviewStatus(status)
      },
    })
    playerRef.current = player
    return () => {
      mounted = false
      playerRef.current = null
      player.stop()
    }
  }, [])

  async function startConcept(target: "dry" | "trimmed") {
    const player = playerRef.current
    if (!player) return
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    const audioUrl = target === "dry"
      ? `/api/dev/atmoshaper-candidates/audio/${sourceId}`
      : `/api/dev/atmoshaper-candidates/derived/${manifest.batchId}/${output.outputIdentity}`
    const sources: PreviewSource[] = [{
      sourceId,
      relativePath: target === "dry" ? sourcePath : "Boundary-trimmed Dryer candidate",
      audioUrl,
    }]
    try {
      await player.start({
        groupId: `${manifest.groupId}:${target}`,
        strategyId: playbackConfiguration.strategyId,
        previewSettings: playbackConfiguration.previewSettings,
        constructionPolicy: playbackConfiguration.constructionPolicy,
        sources,
      })
      if (requestRef.current === requestId) setActiveTarget(target)
    } catch {
      // The shared player reports playback failures through previewStatus.
    }
  }

  function stopConcept() {
    requestRef.current += 1
    setActiveTarget(null)
    playerRef.current?.stop()
  }

  return (
    <section className="space-y-5" aria-labelledby="dryer-complete-concept-comparison">
      <div className="space-y-2">
        <h2 id="dryer-complete-concept-comparison" className="text-2xl font-semibold">Complete concept comparison</h2>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Start with the dry concept, then compare the trimmed candidate. Both repeat as the complete Dryer concept
          with a fresh crossfade duration between 3.75 and 10 seconds at every transition.
        </p>
        <p role="status" className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
          <strong>Direct reviewer selection recorded:</strong> {selection.selectedLabel}. The other comparison remains unselected.
        </p>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          The candidate keeps 1.8–17.7 seconds of the recording and adds 0.15-second boundary fades.
          Reply in chat with what works or what should change; no page decision buttons are required.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ConceptCard
          title={`${conceptLabel} · Dry concept`}
          description="Original recording, including the dryer turning on and off."
          target="dry"
          selected={selection.selectedTarget === "dry"}
          activeTarget={activeTarget}
          previewStatus={previewStatus}
          measurement={output.inputMeasurement}
          onStart={startConcept}
          onStop={stopConcept}
          onNext={() => playerRef.current?.advance()}
        />
        <ConceptCard
          title={`${conceptLabel} · Trimmed candidate`}
          description="Start and stop artifacts removed with short boundary fades."
          target="trimmed"
          selected={selection.selectedTarget === "trimmed"}
          activeTarget={activeTarget}
          previewStatus={previewStatus}
          measurement={output.outputMeasurement}
          onStart={startConcept}
          onStop={stopConcept}
          onNext={() => playerRef.current?.advance()}
        />
      </div>
    </section>
  )
}

function ConceptCard({ title, description, target, selected, activeTarget, previewStatus, measurement, onStart, onStop, onNext }: {
  title: string
  description: string
  target: "dry" | "trimmed"
  selected: boolean
  activeTarget: "dry" | "trimmed" | null
  previewStatus: PreviewStatus
  measurement: Measurement
  onStart: (target: "dry" | "trimmed") => void
  onStop: () => void
  onNext: () => void
}) {
  const active = activeTarget === target && previewStatus.state === "playing"
  return (
    <AppSurface title={title} description={description} variant="inset">
      <div className="space-y-3">
        {selected ? <p className="text-sm font-medium text-primary">Selected from chat</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => onStart(target)} disabled={active}>Start concept</Button>
          <Button type="button" variant="outline" onClick={onStop} disabled={!active}>Stop concept</Button>
          <Button type="button" variant="outline" onClick={onNext} disabled={!active}>Next transition</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {active ? `Playing · ${previewStatus.relativePath ?? "Dryer"}` : "Ready to audition"}
        </p>
        <p className="text-xs text-muted-foreground">
          {measurement.durationSeconds.toFixed(1)}s · {measurement.integratedLoudnessLufs.toFixed(1)} LUFS · {measurement.truePeakDbtp.toFixed(1)} dBTP
        </p>
        {previewStatus.state === "error" && previewStatus.message ? (
          <p role="alert" className="text-sm text-destructive">{previewStatus.message}</p>
        ) : null}
      </div>
    </AppSurface>
  )
}
