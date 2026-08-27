"use client"

import { useEffect, useState } from "react"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { validateSignatureSoundDerivedAudioQa } from "@/lib/atmoshaper/signature-sound-derived-audio-qa"

type Measurement = {
  durationSeconds: number
  integratedLoudnessLufs: number
  truePeakDbtp: number
  outputSha256?: string
}
type DerivedOutput = {
  sourceId: string
  sourceSha256: string
  outputIdentity: string
  outputRelativePath: string
  gainDb: number
  inputMeasurement: Measurement
  outputMeasurement: Measurement
}
export type DerivedManifest = {
  version: 1
  batchId: string
  batchDeclarationSha256: string
  groupId: string
  targetIntegratedLoudnessLufs: number
  outputs: DerivedOutput[]
}
type Decision = "pass" | "needs-rework" | "reject"
type QaEntry = { note: string; sourceHeardAt?: string; derivedHeardAt?: string; decision?: Decision }
export type ArtifactQa = {
  version: 1
  batchDeclarationSha256: string
  manifestSha256: string
  updatedAt: string
  outputs: Record<string, QaEntry>
}

export function DerivedAudioReview({ manifest, manifestSha256, initialQa, sourcePaths, conceptLabel }: {
  manifest: DerivedManifest
  manifestSha256: string
  initialQa: ArtifactQa
  sourcePaths: Record<string, string>
  conceptLabel: string
}) {
  const storageKey = `atmoshaper-signature-derived-qa-v1:${manifest.batchDeclarationSha256}:${manifestSha256}`
  const [qa, setQa] = useState<ArtifactQa>(initialQa)
  const [loaded, setLoaded] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const savedQa = validateSignatureSoundDerivedAudioQa(JSON.parse(saved), { manifest, manifestSha256 }) as ArtifactQa
        setQa((current) => Date.parse(savedQa.updatedAt) > Date.parse(current.updatedAt) ? savedQa : current)
      }
    } catch {
      setWarning("Saved artifact QA could not be restored. This page is using a fresh in-memory review.")
    } finally {
      setLoaded(true)
    }
  }, [manifest, manifestSha256, storageKey])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(qa))
    } catch {
      setWarning("Artifact QA is not persisted. Export JSON before leaving this page.")
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

  function exportQa() {
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(qa, null, 2)}\n`], { type: "application/json" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `atmoshaper-signature-derived-qa-${manifest.batchDeclarationSha256.slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const counts = (decision: Decision) => Object.values(qa.outputs).filter((entry) => entry.decision === decision).length
  return (
    <div className="space-y-6">
      {warning ? <p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm">{warning}</p> : null}
      <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4" aria-label="Artifact QA progress">
        <span><strong>{counts("pass")}</strong> passed</span>
        <span><strong>{counts("needs-rework")}</strong> need rebuild</span>
        <span><strong>{counts("reject")}</strong> rejected</span>
        <Button type="button" variant="outline" onClick={exportQa}>Export artifact QA</Button>
      </section>
      {manifest.outputs.map((output, index) => {
        const entry = qa.outputs[output.outputIdentity]
        const heardSource = Boolean(entry.sourceHeardAt)
        const heardDerived = Boolean(entry.derivedHeardAt)
        const negativeAllowed = Boolean(entry.note.trim()) || (heardSource && heardDerived)
        return (
          <AppSurface
            key={output.outputIdentity}
            title={`${conceptLabel} recording ${index + 1}`}
            description={sourcePaths[output.sourceId] ?? output.sourceId}
            variant="inset"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <AudioComparison
                label="Source recording"
                src={`/api/dev/atmoshaper-candidates/audio/${output.sourceId}`}
                measurement={output.inputMeasurement}
                heard={heardSource}
                onPlay={() => update(output.outputIdentity, { sourceHeardAt: new Date().toISOString() })}
              />
              <AudioComparison
                label="Processed recording"
                src={`/api/dev/atmoshaper-candidates/derived/${manifest.batchId}/${output.outputIdentity}`}
                measurement={output.outputMeasurement}
                heard={heardDerived}
                onPlay={() => update(output.outputIdentity, { derivedHeardAt: new Date().toISOString() })}
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Applied gain: {output.gainDb.toFixed(1)} dB · Target: {manifest.targetIntegratedLoudnessLufs.toFixed(1)} LUFS
            </p>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium">Artifact note</span>
              <textarea
                className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
                value={entry.note}
                onChange={(event) => update(output.outputIdentity, { note: event.target.value })}
                placeholder="Describe level balance, quality, or what needs rebuilding…"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Artifact decision ${index + 1}`}>
              <DecisionButton label="Pass" selected={entry.decision === "pass"} disabled={!heardSource || !heardDerived} onClick={() => update(output.outputIdentity, { decision: "pass" })} />
              <DecisionButton label="Needs rebuild" selected={entry.decision === "needs-rework"} disabled={!negativeAllowed} onClick={() => update(output.outputIdentity, { decision: "needs-rework" })} />
              <DecisionButton label="Reject" selected={entry.decision === "reject"} disabled={!negativeAllowed} onClick={() => update(output.outputIdentity, { decision: "reject" })} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Pass unlocks after both recordings start playing. Needs rebuild or Reject can also be note-backed.
            </p>
          </AppSurface>
        )
      })}
    </div>
  )
}

function AudioComparison({ label, src, measurement, heard, onPlay }: {
  label: string
  src: string
  measurement: Measurement
  heard: boolean
  onPlay: () => void
}) {
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <strong>{label}</strong>
        {heard ? <span className="text-xs text-primary">Started</span> : null}
      </div>
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
