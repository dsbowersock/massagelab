"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { createSignatureSoundPreviewPlayer } from "@/lib/atmoshaper/signature-sound-preview-player"
import {
  buildSignatureSoundTreatmentConceptSources,
  recordSignatureSoundTreatmentConceptQaAudition,
  updateSignatureSoundTreatmentConceptQaVariant,
  validateSignatureSoundTreatmentConceptQa,
} from "@/lib/atmoshaper/signature-sound-treatment-concept-review"
import type { TreatmentManifest } from "./treatment-audition-review"

export type TreatmentPlaybackConfiguration = {
  strategyId: "spaced-event-sequence"
  previewSettings: { minimumGapSeconds: number; maximumGapSeconds: number }
}
type VariantDecision = "pass" | "needs-rework" | "reject" | null
type VariantQa = {
  variantId: string
  variantLabel: string
  outputIdentities: string[]
  auditionedAt: string | null
  decision: VariantDecision
  note: string
}
export type TreatmentConceptQa = {
  version: 1
  reviewKind: "treatment-concept-qa"
  batchId: string
  batchDeclarationSha256: string
  manifestSha256: string
  groupId: string
  playbackConfiguration: TreatmentPlaybackConfiguration
  dryAuditionedAt: string | null
  updatedAt: string
  variants: Record<string, VariantQa>
}
type PreviewSource = { sourceId: string; relativePath: string; audioUrl: string }
type PreviewStatus = {
  state: "idle" | "playing" | "error"
  groupId?: string
  relativePath?: string
  message?: string
}

/** Auditions each treatment as the complete approved dynamic concept. */
export function TreatmentConceptReview({
  manifest,
  manifestSha256,
  initialQa,
  sourcePaths,
  conceptLabel,
  playbackConfiguration,
}: {
  manifest: TreatmentManifest
  manifestSha256: string
  initialQa: TreatmentConceptQa
  sourcePaths: Record<string, string>
  conceptLabel: string
  playbackConfiguration: TreatmentPlaybackConfiguration
}) {
  const context = useMemo(() => ({ manifest, manifestSha256, playbackConfiguration }), [manifest, manifestSha256, playbackConfiguration])
  const storageKey = `atmoshaper-signature-treatment-concept-qa-v1:${manifest.batchDeclarationSha256}:${manifestSha256}`
  const [qa, setQa] = useState(initialQa)
  const [loaded, setLoaded] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ state: "idle" })
  const [activeTarget, setActiveTarget] = useState<string | null>(null)
  const playerRef = useRef<ReturnType<typeof createSignatureSoundPreviewPlayer> | null>(null)
  const previewRequestRef = useRef(0)

  useEffect(() => {
    let mounted = true
    const player = createSignatureSoundPreviewPlayer({
      resolveAudioUrl(source: PreviewSource) {
        if (!source.audioUrl) throw new Error("Treatment concept source is missing its manifest-closed URL")
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const restored = validateSignatureSoundTreatmentConceptQa(JSON.parse(saved), context) as TreatmentConceptQa
        setQa((current) => Date.parse(restored.updatedAt) > Date.parse(current.updatedAt) ? restored : current)
      }
    } catch {
      setWarning("Saved concept QA could not be restored. The in-memory review can still be exported.")
    } finally {
      setLoaded(true)
    }
  }, [context, storageKey])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(validateSignatureSoundTreatmentConceptQa(qa, context)))
    } catch {
      setWarning("Concept QA is not persisted. Export JSON before leaving this page.")
    }
  }, [context, loaded, qa, storageKey])

  function stopConcept() {
    previewRequestRef.current += 1
    setActiveTarget(null)
    playerRef.current?.stop()
  }

  async function startConcept(targetId: string) {
    const player = playerRef.current
    if (!player) return
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    const sources = buildSignatureSoundTreatmentConceptSources(manifest, {
      variantId: targetId,
      sourcePaths,
    }) as PreviewSource[]
    try {
      await player.start({
        groupId: `${manifest.groupId}:${targetId}`,
        strategyId: playbackConfiguration.strategyId,
        previewSettings: playbackConfiguration.previewSettings,
        sources,
      })
      if (previewRequestRef.current === requestId) setActiveTarget(targetId)
    } catch {
      // The shared player exposes the playback failure through previewStatus.
    }
  }

  function confirmConcept(targetId: string) {
    if (activeTarget !== targetId || previewStatus.state !== "playing") return
    const auditionedAt = new Date().toISOString()
    setQa((current) => recordSignatureSoundTreatmentConceptQaAudition(current, context, {
      targetId,
      auditionedAt,
    }) as TreatmentConceptQa)
  }

  function updateVariant(variantId: string, change: { note?: string; decision?: Exclude<VariantDecision, null> }) {
    setQa((current) => updateSignatureSoundTreatmentConceptQaVariant(current, context, {
      variantId,
      ...change,
      updatedAt: new Date().toISOString(),
    }) as TreatmentConceptQa)
  }

  function exportQa() {
    const exactQa = validateSignatureSoundTreatmentConceptQa(qa, context)
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(exactQa, null, 2)}\n`], { type: "application/json" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `atmoshaper-signature-treatment-concept-qa-${manifest.batchDeclarationSha256.slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const variants = Object.values(qa.variants)
  const decidedCount = variants.filter(({ decision }) => decision !== null).length
  return (
    <section className="space-y-5" aria-labelledby="complete-concept-comparison">
      <div className="space-y-2">
        <h2 id="complete-concept-comparison" className="text-2xl font-semibold">Complete concept comparison</h2>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Each audition dynamically selects from all 18 recordings using the approved 0–8 second spacing.
          Start with the dry concept, then compare each complete effect. Next event skips the wait when you want a faster sample.
        </p>
      </div>
      {warning ? <p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm">{warning}</p> : null}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <span><strong>{decidedCount}</strong> of {variants.length} effect variants decided</span>
        <Button type="button" variant="outline" onClick={exportQa}>Export concept QA</Button>
      </div>
      <AppSurface
        title={`${conceptLabel} · Dry concept`}
        description="The same complete dynamic sequence without an added time effect."
        variant="inset"
      >
        <ConceptTransport
          targetId="dry"
          activeTarget={activeTarget}
          previewStatus={previewStatus}
          heard={Boolean(qa.dryAuditionedAt)}
          onStart={startConcept}
          onStop={stopConcept}
          onNext={() => playerRef.current?.advance()}
          onConfirm={confirmConcept}
        />
      </AppSurface>
      <div className="grid gap-4 xl:grid-cols-3">
        {variants.map((variant) => {
          const bothHeard = Boolean(qa.dryAuditionedAt && variant.auditionedAt)
          const negativeAllowed = bothHeard || Boolean(variant.note.trim())
          const effect = manifest.outputs.find((output) => output.variantId === variant.variantId)?.effect
          return (
            <AppSurface
              key={variant.variantId}
              title={`${conceptLabel} · ${variant.variantLabel}`}
              description={effect ? `Delay ${effect.delaysMs.join(" / ")} ms · decay ${effect.decays.join(" / ")}` : "Exact manifest-bound treatment"}
              variant="inset"
            >
              <ConceptTransport
                targetId={variant.variantId}
                activeTarget={activeTarget}
                previewStatus={previewStatus}
                heard={Boolean(variant.auditionedAt)}
                onStart={startConcept}
                onStop={stopConcept}
                onNext={() => playerRef.current?.advance()}
                onConfirm={confirmConcept}
              />
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium">Complete variant note</span>
                <textarea
                  className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
                  value={variant.note}
                  onChange={(event) => updateVariant(variant.variantId, { note: event.target.value })}
                  placeholder="Describe how this effect works across the complete concept…"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Complete treatment decision ${variant.variantLabel}`}>
                <DecisionButton label="Pass" selected={variant.decision === "pass"} disabled={!bothHeard} onClick={() => updateVariant(variant.variantId, { decision: "pass" })} />
                <DecisionButton label="Needs rebuild" selected={variant.decision === "needs-rework"} disabled={!negativeAllowed} onClick={() => updateVariant(variant.variantId, { decision: "needs-rework" })} />
                <DecisionButton label="Reject" selected={variant.decision === "reject"} disabled={!negativeAllowed} onClick={() => updateVariant(variant.variantId, { decision: "reject" })} />
              </div>
            </AppSurface>
          )
        })}
      </div>
    </section>
  )
}

function ConceptTransport({ targetId, activeTarget, previewStatus, heard, onStart, onStop, onNext, onConfirm }: {
  targetId: string
  activeTarget: string | null
  previewStatus: PreviewStatus
  heard: boolean
  onStart: (targetId: string) => void
  onStop: () => void
  onNext: () => void
  onConfirm: (targetId: string) => void
}) {
  const active = activeTarget === targetId && previewStatus.state === "playing"
  const confirmLabel = targetId === "dry" ? "Confirm dry concept heard" : "Confirm effect concept heard"
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => onStart(targetId)} disabled={active}>Start concept</Button>
        <Button type="button" variant="outline" onClick={onStop} disabled={!active}>Stop concept</Button>
        <Button type="button" variant="outline" onClick={onNext} disabled={!active}>Next event</Button>
        <Button type="button" variant="outline" onClick={() => onConfirm(targetId)} disabled={!active}>{confirmLabel}</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {active ? `Playing · ${previewStatus.relativePath ?? "selecting an event"}` : heard ? "Current complete concept confirmed heard" : "Not yet confirmed heard"}
      </p>
      {active && previewStatus.message ? <p role="alert" className="text-sm text-destructive">{previewStatus.message}</p> : null}
    </div>
  )
}

function DecisionButton({ label, selected, disabled, onClick }: {
  label: string
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  return <Button type="button" variant="outline" aria-pressed={selected} disabled={disabled} onClick={onClick}>{label}</Button>
}
