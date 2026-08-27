"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  applySignatureSoundEditConceptQaSelection,
  exportSignatureSoundEditConceptQa,
  parseSignatureSoundEditConceptQaJson,
  recordSignatureSoundEditConceptQaAudition,
  recordSignatureSoundEditConceptQaSeamCrossing,
  updateSignatureSoundEditConceptQaVariant,
  validateSignatureSoundEditConceptQa,
} from "@/lib/atmoshaper/signature-sound-edit-concept-review"

type Measurement = { durationSeconds: number; integratedLoudnessLufs: number; truePeakDbtp: number }
type EditOutput = {
  sourceId: string; variantId: string; variantLabel: string; outputIdentity: string
  reviewMode: "intro-then-cyclic-loop"
  edit: {
    firstPassStartSeconds: number; loopStartSeconds: number; loopEndSeconds: number
    cyclicCrossfadeSeconds: number; crossfadeCurve: string
  }
  inputMeasurement: Measurement; outputMeasurement: Measurement
}
export type EditManifest = {
  version: 1; batchId: string; batchDeclarationSha256: string; groupId: string
  reviewKind: "edit-audition"
  outputs: EditOutput[]
}
export type EditPlaybackConfiguration = {
  strategyId: "adaptive-whole-source-sequence"
  previewSettings: { transitionMode: "crossfade"; transitionSeconds: 2 }
  minimumSelectionsBeforeRepeat: null; constraints: []
}
type EditDecision = "undecided" | "pass" | "change" | "reject"
type EditVariantQa = {
  variantId: string; variantLabel: string; outputIdentity: string; auditionedAt: string | null
  endToStartSeamCrossings: string[]
  decision: EditDecision; note: string
}
type EditDirectSelection = {
  version: 1; reviewKind: "edit-concept-selection-qa"
  batchId: string; batchDeclarationSha256: string; manifestSha256: string; groupId: string
  selectedVariantId: string; selectedVariantLabel: string; outputIdentity: string
  decision: "pass"; note: string; reviewedAt: string
}
export type EditConceptQa = {
  version: 1; reviewKind: "edit-concept-qa"
  batchId: string; batchDeclarationSha256: string; manifestSha256: string; groupId: string
  playbackConfiguration: EditPlaybackConfiguration
  directSelection: EditDirectSelection | null
  dryAuditionedAt: string | null; updatedAt: string
  variants: Record<string, EditVariantQa>
}

/** Reviews the complete one-time opening and exact repeating loop region. */
export function EditConceptReview({
  manifest,
  manifestSha256,
  initialQa,
  sourcePath,
  conceptLabel,
  playbackConfiguration,
}: {
  manifest: EditManifest
  manifestSha256: string
  initialQa: EditConceptQa
  sourcePath: string
  conceptLabel: string
  playbackConfiguration: EditPlaybackConfiguration
}) {
  const context = useMemo(
    () => ({ manifest, manifestSha256, playbackConfiguration }),
    [manifest, manifestSha256, playbackConfiguration],
  )
  const storageKey = `atmoshaper-signature-edit-concept-qa-v1:${manifest.batchId}:${manifest.batchDeclarationSha256}:${manifestSha256}`
  const [qa, setQa] = useState(initialQa)
  const [loaded, setLoaded] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const restored = parseSignatureSoundEditConceptQaJson(saved, context) as EditConceptQa
        const anchored = initialQa.directSelection
          ? applySignatureSoundEditConceptQaSelection(
              restored,
              initialQa.directSelection,
              context,
            ) as EditConceptQa
          : restored
        setQa((current) => Date.parse(anchored.updatedAt) > Date.parse(current.updatedAt) ? anchored : current)
      }
    } catch {
      setWarning("Saved seam-review QA could not be restored. The current review can still be exported.")
    } finally {
      setLoaded(true)
    }
  }, [context, initialQa, storageKey])

  useEffect(() => {
    if (!loaded) return
    try {
      const exactQa = validateSignatureSoundEditConceptQa(qa, context)
      localStorage.setItem(storageKey, JSON.stringify(exactQa))
    } catch {
      setWarning("Seam-review QA is not persisted. Export JSON before leaving this page.")
    }
  }, [context, loaded, qa, storageKey])

  function recordAudition(targetId: "dry" | string) {
    setQa((current) => recordSignatureSoundEditConceptQaAudition(current, context, {
      targetId,
      auditionedAt: new Date().toISOString(),
    }) as EditConceptQa)
  }

  function recordCrossing(variantId: string) {
    setQa((current) => recordSignatureSoundEditConceptQaSeamCrossing(current, context, {
      variantId,
      crossedAt: new Date().toISOString(),
    }) as EditConceptQa)
  }

  function updateVariant(variantId: string, change: { decision?: EditDecision; note?: string }) {
    setQa((current) => updateSignatureSoundEditConceptQaVariant(current, context, {
      variantId,
      ...change,
      updatedAt: new Date().toISOString(),
    }) as EditConceptQa)
  }

  function exportQa() {
    const json = exportSignatureSoundEditConceptQa(qa, context)
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `atmoshaper-signature-edit-concept-qa-${manifest.batchDeclarationSha256.slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const variants = Object.values(qa.variants)
  const decidedCount = variants.filter(({ decision }) => decision !== "undecided").length
  const sourceId = manifest.outputs[0].sourceId
  return (
    <section className="space-y-5" aria-labelledby="complete-loop-comparison">
      <div className="space-y-2">
        <h2 id="complete-loop-comparison" className="text-2xl font-semibold">Complete concept loop comparison</h2>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Each candidate plays 0:00 through 1:30 once, then repeats only 0:15–1:30. The selected equal-power
          crossfade carries the end back to 0:15; the opening never repeats. Two loop transitions are required before Pass.
        </p>
      </div>
      {warning ? <p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm">{warning}</p> : null}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <span><strong>{decidedCount}</strong> of {variants.length} loop candidates decided</span>
        <Button type="button" variant="outline" onClick={exportQa}>Export edit-concept QA</Button>
      </div>
      <AppSurface title={`${conceptLabel} · Dry source`} description={sourcePath} variant="inset">
        <audio
          className="w-full"
          controls
          preload="metadata"
          src={`/api/dev/atmoshaper-candidates/audio/${sourceId}`}
          onPlay={() => recordAudition("dry")}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {qa.dryAuditionedAt ? "Dry source started" : "Dry source not yet heard"} · {formatMeasurement(manifest.outputs[0].inputMeasurement)}
        </p>
      </AppSurface>
      <div className="grid gap-4 xl:grid-cols-3">
        {variants.map((variant) => {
          const output = manifest.outputs.find((candidate) => candidate.variantId === variant.variantId)
          if (!output) return null
          const fullyHeard = Boolean(
            qa.dryAuditionedAt && variant.auditionedAt && variant.endToStartSeamCrossings.length >= 2,
          )
          const directlySelected = qa.directSelection?.selectedVariantId === variant.variantId
          const negativeAllowed = fullyHeard || Boolean(variant.note.trim())
          return (
            <AppSurface
              key={variant.variantId}
              title={`${conceptLabel} · ${variant.variantLabel}`}
              description={`First pass 0:00–1:30 · loop 0:15–1:30 · ${output.edit.cyclicCrossfadeSeconds}s ${output.edit.crossfadeCurve} crossfade`}
              variant="inset"
            >
              <CompleteConceptLoopPlayer
                src={`/api/dev/atmoshaper-candidates/derived/${manifest.batchId}/${variant.outputIdentity}`}
                firstLoopOffsetSeconds={output.edit.loopEndSeconds - output.edit.cyclicCrossfadeSeconds}
                loopRegionDurationSeconds={output.edit.loopEndSeconds - output.edit.loopStartSeconds - output.edit.cyclicCrossfadeSeconds}
                crossingCount={variant.endToStartSeamCrossings.length}
                heard={Boolean(variant.auditionedAt)}
                measurement={output.outputMeasurement}
                onAudition={() => recordAudition(variant.variantId)}
                onCrossing={() => recordCrossing(variant.variantId)}
              />
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium">Candidate note</span>
                <textarea
                  className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
                  value={variant.note}
                  onChange={(event) => {
                    const note = event.target.value
                    const clearsRequiredEvidence = !fullyHeard && !note.trim() &&
                      (variant.decision === "change" || variant.decision === "reject")
                    updateVariant(variant.variantId, {
                      note,
                      ...(clearsRequiredEvidence ? { decision: "undecided" as const } : {}),
                    })
                  }}
                  placeholder="Describe the loop transition, texture shift, crossfade, or requested change…"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Loop decision ${variant.variantLabel}`}>
                <DecisionButton label="Pass" selected={variant.decision === "pass"} disabled={directlySelected || !fullyHeard} onClick={() => updateVariant(variant.variantId, { decision: "pass" })} />
                <DecisionButton label="Change" selected={variant.decision === "change"} disabled={directlySelected || !negativeAllowed} onClick={() => updateVariant(variant.variantId, { decision: "change" })} />
                <DecisionButton label="Reject" selected={variant.decision === "reject"} disabled={directlySelected || !negativeAllowed} onClick={() => updateVariant(variant.variantId, { decision: "reject" })} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {directlySelected
                  ? "Direct reviewer selection recorded; browser playback timestamps were not fabricated."
                  : "Change and Reject may be note-backed before the full audition is complete."}
              </p>
            </AppSurface>
          )
        })}
      </div>
    </section>
  )
}

/** Uses Web Audio's regional loop points so the one-time opening never repeats. */
function CompleteConceptLoopPlayer({
  src,
  firstLoopOffsetSeconds,
  loopRegionDurationSeconds,
  crossingCount,
  heard,
  measurement,
  onAudition,
  onCrossing,
}: {
  src: string
  firstLoopOffsetSeconds: number
  loopRegionDurationSeconds: number
  crossingCount: number
  heard: boolean
  measurement: Measurement
  onAudition: () => void
  onCrossing: () => void
}) {
  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const frameRef = useRef<number | null>(null)
  const generationRef = useRef(0)
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "error">("idle")
  const [positionSeconds, setPositionSeconds] = useState(0)

  function stopPlayback(nextStatus: "idle" | "error" = "idle") {
    generationRef.current += 1
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    try { sourceRef.current?.stop() } catch { /* The source may already be stopped. */ }
    sourceRef.current = null
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== "closed") void context.close()
    setPositionSeconds(0)
    setStatus(nextStatus)
  }

  useEffect(() => () => {
    generationRef.current += 1
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    try { sourceRef.current?.stop() } catch { /* The source may already be stopped. */ }
    if (contextRef.current?.state !== "closed") void contextRef.current?.close()
  }, [])

  async function startCompleteConcept() {
    stopPlayback()
    const generation = generationRef.current
    setStatus("loading")
    try {
      const response = await fetch(src, { cache: "no-store" })
      if (!response.ok) throw new Error("The exact loop artifact could not be loaded")
      const context = new AudioContext()
      const buffer = await context.decodeAudioData(await response.arrayBuffer())
      if (generationRef.current !== generation) {
        await context.close()
        return
      }
      if (firstLoopOffsetSeconds <= 0 || loopRegionDurationSeconds <= 0 ||
          firstLoopOffsetSeconds >= buffer.duration) {
        await context.close()
        throw new Error("The loop timing does not fit the exact artifact")
      }
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.loopStart = firstLoopOffsetSeconds
      source.loopEnd = buffer.duration
      source.connect(context.destination)
      source.start()
      contextRef.current = context
      sourceRef.current = source
      const startedAt = context.currentTime
      let nextTransitionAt = firstLoopOffsetSeconds
      const updatePosition = () => {
        if (sourceRef.current !== source) return
        const elapsed = context.currentTime - startedAt
        while (elapsed >= nextTransitionAt) {
          onCrossing()
          nextTransitionAt += loopRegionDurationSeconds
        }
        setPositionSeconds(elapsed < firstLoopOffsetSeconds
          ? elapsed
          : firstLoopOffsetSeconds + ((elapsed - firstLoopOffsetSeconds) % loopRegionDurationSeconds))
        frameRef.current = requestAnimationFrame(updatePosition)
      }
      onAudition()
      setStatus("playing")
      frameRef.current = requestAnimationFrame(updatePosition)
    } catch {
      if (generationRef.current === generation) stopPlayback("error")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={status === "loading"} onClick={() => void startCompleteConcept()}>
          {status === "loading" ? "Loading exact concept…" : "Start complete-concept audition"}
        </Button>
        <Button type="button" variant="outline" disabled={status === "idle"} onClick={() => stopPlayback()}>Stop audition</Button>
      </div>
      <p className="text-sm" aria-live="polite">
        Loop transitions heard: <strong>{crossingCount}</strong> / 2 required
      </p>
      <p className="text-xs text-muted-foreground">
        {status === "error" ? "The exact candidate could not be played. Try again." :
          status === "playing" ? `Playing at ${formatClock(positionSeconds)}` :
          heard ? "Candidate previously started" : "Candidate not yet heard"} · {formatMeasurement(measurement)}
      </p>
    </div>
  )
}

function formatClock(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds))
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`
}

function formatMeasurement(measurement: Measurement) {
  return `${measurement.integratedLoudnessLufs.toFixed(1)} LUFS · peak ${measurement.truePeakDbtp.toFixed(1)} dBTP · ${measurement.durationSeconds.toFixed(2)}s`
}

function DecisionButton({ label, selected, disabled, onClick }: {
  label: string
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  return <Button type="button" variant="outline" aria-pressed={selected} disabled={disabled} onClick={onClick}>{label}</Button>
}
