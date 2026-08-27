"use client"

import { useEffect, useMemo, useState } from "react"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { validateSignatureSoundDerivedAudioQa } from "@/lib/atmoshaper/signature-sound-derived-audio-qa"
import type { ArtifactQa } from "./derived-audio-review"
import {
  TreatmentConceptReview,
  type TreatmentConceptQa,
  type TreatmentPlaybackConfiguration,
} from "./treatment-concept-review"

type Measurement = {
  durationSeconds: number
  integratedLoudnessLufs: number
  truePeakDbtp: number
}
type Effect = {
  delaysMs: number[]
  decays: number[]
  inputGain: number
  outputGain: number
  safetyAttenuationDb: number
  tailSeconds: number
}
type TreatmentOutput = {
  sourceId: string
  outputIdentity: string
  variantId: string
  variantLabel: string
  effect: Effect
  inputMeasurement: Measurement
  outputMeasurement: Measurement
}
export type TreatmentManifest = {
  version: 1
  batchId: string
  batchDeclarationSha256: string
  groupId: string
  reviewKind: "treatment-audition"
  outputs: TreatmentOutput[]
}
type Decision = "pass" | "needs-rework" | "reject"
type QaEntry = ArtifactQa["outputs"][string]

/** Presents one dry control with independently reviewable effect variants per source. */
export function TreatmentAuditionReview({ manifest, manifestSha256, initialQa, initialConceptQa, sourcePaths, conceptLabel, playbackConfiguration }: {
  manifest: TreatmentManifest
  manifestSha256: string
  initialQa: ArtifactQa
  initialConceptQa: TreatmentConceptQa
  sourcePaths: Record<string, string>
  conceptLabel: string
  playbackConfiguration: TreatmentPlaybackConfiguration
}) {
  const storageKey = `atmoshaper-signature-derived-qa-v1:${manifest.batchDeclarationSha256}:${manifestSha256}`
  const [qa, setQa] = useState(initialQa)
  const [loaded, setLoaded] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const sourceGroups = useMemo(() => {
    const groups = new Map<string, TreatmentOutput[]>()
    for (const output of manifest.outputs) groups.set(output.sourceId, [...(groups.get(output.sourceId) ?? []), output])
    return [...groups.entries()]
  }, [manifest.outputs])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const restored = validateSignatureSoundDerivedAudioQa(JSON.parse(saved), { manifest, manifestSha256 }) as ArtifactQa
        setQa((current) => Date.parse(restored.updatedAt) > Date.parse(current.updatedAt) ? restored : current)
      }
    } catch {
      setWarning("Saved treatment QA could not be restored. This page is using an exportable in-memory review.")
    } finally {
      setLoaded(true)
    }
  }, [manifest, manifestSha256, storageKey])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(qa))
    } catch {
      setWarning("Treatment QA is not persisted. Export JSON before leaving this page.")
    }
  }, [loaded, qa, storageKey])

  function update(outputIdentity: string, change: Partial<QaEntry>) {
    setQa((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      outputs: {
        ...current.outputs,
        [outputIdentity]: { ...current.outputs[outputIdentity], ...change },
      },
    }))
  }

  function markDrySourceHeard(outputs: TreatmentOutput[]) {
    const sourceHeardAt = new Date().toISOString()
    setQa((current) => ({
      ...current,
      updatedAt: sourceHeardAt,
      outputs: {
        ...current.outputs,
        ...Object.fromEntries(outputs.map((output) => [
          output.outputIdentity,
          { ...current.outputs[output.outputIdentity], sourceHeardAt },
        ])),
      },
    }))
  }

  function exportQa() {
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(qa, null, 2)}\n`], { type: "application/json" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `atmoshaper-signature-treatment-qa-${manifest.batchDeclarationSha256.slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const count = (decision: Decision) => Object.values(qa.outputs).filter((entry) => entry.decision === decision).length
  return (
    <div className="space-y-6">
      {warning ? <p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm">{warning}</p> : null}
      <TreatmentConceptReview
        manifest={manifest}
        manifestSha256={manifestSha256}
        initialQa={initialConceptQa}
        sourcePaths={sourcePaths}
        conceptLabel={conceptLabel}
        playbackConfiguration={playbackConfiguration}
      />
      <details className="rounded-xl border bg-card/40 p-4">
        <summary className="cursor-pointer text-lg font-semibold">Individual recording diagnostics (optional)</summary>
        <div className="mt-5 space-y-6">
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            Use these players only when a complete variant reveals a specific troublesome recording. Their artifact-level notes and decisions remain separate from the complete-concept QA above.
          </p>
          <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4" aria-label="Treatment QA progress">
            <span><strong>{count("pass")}</strong> passed</span>
            <span><strong>{count("needs-rework")}</strong> need rebuild</span>
            <span><strong>{count("reject")}</strong> rejected</span>
            <span className="text-sm text-muted-foreground">{manifest.outputs.length} total variants</span>
            <Button type="button" variant="outline" onClick={exportQa}>Export treatment QA</Button>
          </section>
          {sourceGroups.map(([sourceId, outputs], sourceIndex) => (
        <AppSurface
          key={sourceId}
          title={`${conceptLabel} recording ${sourceIndex + 1}`}
          description={sourcePaths[sourceId] ?? sourceId}
          variant="inset"
        >
          <AudioPanel
            label="Dry source"
            src={`/api/dev/atmoshaper-candidates/audio/${sourceId}`}
            measurement={outputs[0].inputMeasurement}
            onPlay={() => markDrySourceHeard(outputs)}
          />
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {outputs.map((output) => {
              const entry = qa.outputs[output.outputIdentity]
              const heardSource = Boolean(entry.sourceHeardAt)
              const heardDerived = Boolean(entry.derivedHeardAt)
              const negativeAllowed = Boolean(entry.note.trim()) || (heardSource && heardDerived)
              return (
                <section key={output.outputIdentity} className="space-y-4 rounded-xl border bg-background/60 p-4">
                  <AudioPanel
                    label={`Effect variant: ${output.variantLabel}`}
                    src={`/api/dev/atmoshaper-candidates/derived/${manifest.batchId}/${output.outputIdentity}`}
                    measurement={output.outputMeasurement}
                    onPlay={() => update(output.outputIdentity, { derivedHeardAt: new Date().toISOString() })}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Delays {output.effect.delaysMs.join(" / ")} ms · decay {output.effect.decays.join(" / ")} · tail {output.effect.tailSeconds.toFixed(2)}s · safety {output.effect.safetyAttenuationDb.toFixed(1)} dB
                  </p>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Variant note</span>
                    <textarea
                      className="min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
                      value={entry.note}
                      onChange={(event) => update(output.outputIdentity, { note: event.target.value })}
                      placeholder="Describe whether this effect supports the whistle…"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Treatment decision ${sourceIndex + 1} ${output.variantLabel}`}>
                    <DecisionButton label="Pass" selected={entry.decision === "pass"} disabled={!heardSource || !heardDerived} onClick={() => update(output.outputIdentity, { decision: "pass" })} />
                    <DecisionButton label="Needs rebuild" selected={entry.decision === "needs-rework"} disabled={!negativeAllowed} onClick={() => update(output.outputIdentity, { decision: "needs-rework" })} />
                    <DecisionButton label="Reject" selected={entry.decision === "reject"} disabled={!negativeAllowed} onClick={() => update(output.outputIdentity, { decision: "reject" })} />
                  </div>
                </section>
              )
            })}
          </div>
        </AppSurface>
          ))}
        </div>
      </details>
    </div>
  )
}

function AudioPanel({ label, src, measurement, onPlay }: {
  label: string
  src: string
  measurement: Measurement
  onPlay: () => void
}) {
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <strong>{label}</strong>
      <audio className="w-full" controls preload="metadata" src={src} onPlay={onPlay} />
      <p className="text-xs text-muted-foreground">
        {measurement.integratedLoudnessLufs.toFixed(1)} LUFS · peak {measurement.truePeakDbtp.toFixed(1)} dBTP · {measurement.durationSeconds.toFixed(2)}s
      </p>
    </section>
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
