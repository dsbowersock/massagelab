"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  clearSignatureSoundConstructionQaAudition,
  createSignatureSoundConstructionAuditionConfiguration,
  createSignatureSoundConstructionAuditionKey,
  createSignatureSoundConstructionQaStorageKey,
  recordSignatureSoundConstructionQaAudition,
  renderSignatureSoundConstructionQaJson,
  updateSignatureSoundConstructionQaDecision,
  updateSignatureSoundConstructionQaNote,
  validateSignatureSoundConstructionQa,
} from "@/lib/atmoshaper/signature-sound-construction-qa"
import {
  loadSignatureSoundConstructionQa,
  parseSignatureSoundConstructionQaJson,
  persistSignatureSoundConstructionQa,
} from "@/lib/atmoshaper/signature-sound-construction-qa-storage"
import { createSignatureSoundPreviewPlayer } from "@/lib/atmoshaper/signature-sound-preview-player"
import styles from "./construction-audition-review.module.css"
import {
  countDecisions,
  defaultBoundaries,
  defaultScopes,
  describeRequirement,
  fileName,
  isContinuous,
  restoreSelections,
  statusLabel,
  strategyLabel,
  type AuditionGroup,
  type Boundary,
  type Configuration,
  type ConstructionAudition,
  type Qa,
  type QaEntry,
  type Source,
} from "./construction-audition-review-model"

export type { ConstructionAudition } from "./construction-audition-review-model"
type PreviewStatus = {
  state: "idle" | "playing" | "error"
  groupId?: string
  relativePath?: string
  message?: string
}
const NOT_PERSISTED_WARNING = "Construction QA is not persisted. Your in-memory work is preserved; export JSON before leaving this page."

/** Owns one player and one fingerprinted construction-QA record for the retained review page. */
export function ConstructionAuditionReview({ audition, sources }: {
  audition: ConstructionAudition
  sources: Record<string, Source>
}) {
  const storageKey = useMemo(() => createSignatureSoundConstructionQaStorageKey(audition), [audition])
  const [qa, setQa] = useState<Qa | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ state: "idle" })
  const [boundaries, setBoundaries] = useState<Record<string, Boundary>>(() => defaultBoundaries(audition))
  const [scopes, setScopes] = useState<Record<string, "playback-only" | "complete-construction">>(() => defaultScopes(audition))
  const playerRef = useRef<ReturnType<typeof createSignatureSoundPreviewPlayer> | null>(null)
  const activeAuditionRef = useRef<{ groupId: string; auditionKey: string; configuration: Configuration } | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const previewRequestRef = useRef(0)

  useEffect(() => {
    let mounted = true
    const player = createSignatureSoundPreviewPlayer({
      onStatus(status: PreviewStatus) {
        if (status.state !== "playing") activeAuditionRef.current = null
        if (mounted) setPreviewStatus(status)
      },
    })
    playerRef.current = player
    return () => {
      mounted = false
      activeAuditionRef.current = null
      playerRef.current = null
      player.stop()
    }
  }, [])

  useEffect(() => {
    try {
      const loadedQa = loadSignatureSoundConstructionQa(
        () => localStorage,
        storageKey,
        audition,
        new Date().toISOString(),
      )
      const next = loadedQa.qa as Qa
      setQa(next)
      restoreSelections(next, setBoundaries, setScopes)
      setPersistenceWarning(loadedQa.persistenceAvailable ? null : NOT_PERSISTED_WARNING)
    } catch {
      setWarning("The saved construction QA could not be validated. It was left untouched for recovery.")
    } finally {
      setLoaded(true)
    }
  }, [audition, storageKey])

  useEffect(() => {
    if (!loaded || !qa) return
    const persisted = persistSignatureSoundConstructionQa(() => localStorage, storageKey, qa, audition)
    setPersistenceWarning(persisted ? null : NOT_PERSISTED_WARNING)
  }, [audition, loaded, qa, storageKey])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return
      try {
        const next = validateSignatureSoundConstructionQa(JSON.parse(event.newValue), audition) as Qa
        stopPreview()
        setQa(next)
        restoreSelections(next, setBoundaries, setScopes)
        setWarning(null)
      } catch {
        setWarning("Another tab wrote invalid construction QA. This tab kept its last valid state.")
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [audition, storageKey])

  function stopPreview() {
    previewRequestRef.current += 1
    activeAuditionRef.current = null
    playerRef.current?.stop()
  }

  function configurationFor(group: AuditionGroup) {
    return createSignatureSoundConstructionAuditionConfiguration(
      group,
      group.policy.boundaryModeCandidates.length > 0 ? boundaries[group.groupId] : undefined,
    ) as Configuration
  }

  function invalidateGroup(groupId: string) {
    stopPreview()
    setQa((current) => current ? clearSignatureSoundConstructionQaAudition(current, audition, {
      groupId,
      updatedAt: new Date().toISOString(),
    }) as Qa : current)
  }

  function updateBoundary(group: AuditionGroup, boundary: Boundary) {
    invalidateGroup(group.groupId)
    setBoundaries((current) => ({ ...current, [group.groupId]: boundary }))
  }

  async function startPreview(group: AuditionGroup) {
    const player = playerRef.current
    if (!player || group.status === "blocked") return
    const configuration = configurationFor(group)
    const playableSources = configuration.includedSourceIds.map((sourceId) => sources[sourceId]).filter(Boolean)
    if (playableSources.length !== configuration.includedSourceIds.length) return
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    try {
      await player.start({
        groupId: group.groupId,
        strategyId: group.strategyId,
        previewSettings: configuration.previewSettings,
        constructionPolicy: configuration.constructionPolicy,
        sources: playableSources,
      })
      if (previewRequestRef.current !== requestId) return
      activeAuditionRef.current = {
        groupId: group.groupId,
        auditionKey: createSignatureSoundConstructionAuditionKey(audition, group.groupId, configuration),
        configuration,
      }
    } catch {
      // The shared player reports visible failure; unsuccessful playback is not QA evidence.
    }
  }

  function confirmAudition(group: AuditionGroup) {
    if (previewStatus.state !== "playing" || previewStatus.groupId !== group.groupId) return
    const activeAudition = activeAuditionRef.current
    if (!activeAudition || activeAudition.groupId !== group.groupId) return
    const currentKey = createSignatureSoundConstructionAuditionKey(audition, group.groupId, configurationFor(group))
    if (activeAudition.auditionKey !== currentKey) return
    const auditionedAt = new Date().toISOString()
    setQa((current) => current ? recordSignatureSoundConstructionQaAudition(current, audition, {
      groupId: group.groupId,
      configuration: activeAudition.configuration,
      auditionedAt,
    }) as Qa : current)
  }

  function updateNote(groupId: string, note: string) {
    setQa((current) => current ? updateSignatureSoundConstructionQaNote(current, audition, {
      groupId,
      note,
      updatedAt: new Date().toISOString(),
    }) as Qa : current)
  }

  function decide(group: AuditionGroup, decision: QaEntry["decision"], heardCurrent: boolean) {
    if (!decision) return
    setQa((current) => current ? updateSignatureSoundConstructionQaDecision(current, audition, {
      groupId: group.groupId,
      decision,
      ...(heardCurrent ? { scope: scopes[group.groupId] } : {}),
      updatedAt: new Date().toISOString(),
    }) as Qa : current)
  }

  function exportQa() {
    if (!qa) return
    const json = renderSignatureSoundConstructionQaJson(qa, audition)
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `atmoshaper-signature-construction-qa-${audition.constructionReviewSha256.slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  /** Restores only exact current QA; a rejected import leaves in-memory work unchanged. */
  async function importQa(file: File | undefined) {
    if (!file) return
    try {
      const next = parseSignatureSoundConstructionQaJson(await file.text(), audition) as Qa
      stopPreview()
      setQa(next)
      restoreSelections(next, setBoundaries, setScopes)
      setWarning(null)
    } catch {
      setWarning("This construction QA file does not match the current audition. Your existing work was kept.")
    }
  }

  if (!loaded) return <p>Loading construction QA…</p>
  if (!qa) return <p role="alert">{warning ?? "Construction QA is unavailable."}</p>
  const counts = countDecisions(qa, audition)

  return (
    <div className={styles.layout}>
      {warning ? <p className={styles.warning} role="alert">{warning}</p> : null}
      {persistenceWarning ? <p className={styles.warning} role="alert">{persistenceWarning}</p> : null}
      <section className={styles.summary} aria-label="Construction QA progress">
        <Summary label="Auditions" value={audition.groups.length} />
        <Summary label="Passed" value={counts.pass} />
        <Summary label="Needs rebuild" value={counts.needsRework} />
        <Summary label="Rejected" value={counts.reject} />
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => {
            const input = event.currentTarget
            void importQa(input.files?.[0]).finally(() => { input.value = "" })
          }}
        />
        <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}>Import construction QA</Button>
        <Button type="button" variant="outline" onClick={exportQa}>Export construction QA</Button>
      </section>

      {audition.groups.map((group) => {
        const entry = qa.groups[group.groupId]
        const configuration = configurationFor(group)
        const currentKey = createSignatureSoundConstructionAuditionKey(audition, group.groupId, configuration)
        const heardCurrent = entry?.auditionKey === currentKey
        const noteBackedNegativeAllowed = Boolean(entry?.note.trim())
        const active = previewStatus.state === "playing" && previewStatus.groupId === group.groupId
        return (
          <AppSurface
            key={group.groupId}
            title={group.label}
            description={`${strategyLabel(group.strategyId)} · ${group.includedSourceIds.length} exact sources`}
            variant="inset"
          >
            <article className={styles.card}>
              <div className={styles.badges}>
                <span data-status={group.status}>{statusLabel(group.status)}</span>
                {heardCurrent ? <span data-heard="true">Current setup heard</span> : null}
              </div>
              <p className={styles.requirement}>{describeRequirement(group)}</p>

              {group.blockers.length > 0 ? (
                <div className={styles.blockers}>
                  <strong>{group.status === "blocked" ? "Cannot audition yet" : "Processing still pending"}</strong>
                  <ul>{group.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
                  {group.processingIntentIds.length > 0 ? (
                    <p>Playback can be judged now; these processing intents still need rebuilt audio and audible QA.</p>
                  ) : null}
                </div>
              ) : null}

              {group.policy.boundaryModeCandidates.length > 0 ? (
                <div className={styles.boundary}>
                  <label>
                    <span>Cadence boundary A/B</span>
                    <select
                      value={boundaries[group.groupId]?.mode ?? "crossfade"}
                      onChange={(event) => {
                        const mode = event.target.value as Boundary["mode"]
                        updateBoundary(group, { mode, crossfadeSeconds: mode === "crossfade" ? 0.12 : 0 })
                      }}
                    >
                      <option value="crossfade">Crossfade</option>
                      <option value="overlap">Overlap</option>
                    </select>
                  </label>
                  {boundaries[group.groupId]?.mode === "crossfade" ? (
                    <label>
                      <span>Crossfade seconds: {boundaries[group.groupId].crossfadeSeconds.toFixed(2)}</span>
                      <input
                        type="range"
                        min="0.01"
                        max="2"
                        step="0.01"
                        value={boundaries[group.groupId].crossfadeSeconds}
                        onChange={(event) => updateBoundary(group, {
                          mode: "crossfade",
                          crossfadeSeconds: Number(event.target.value),
                        })}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.transport}>
                <Button
                  type="button"
                  disabled={active || group.status === "blocked" || group.includedSourceIds.length === 0}
                  onClick={() => void startPreview(group)}
                >
                  Start construction preview
                </Button>
                <Button type="button" variant="outline" disabled={!active} onClick={stopPreview}>Stop preview</Button>
                <Button type="button" variant="outline" disabled={!active} onClick={() => void playerRef.current?.advance()}>
                  {isContinuous(group.strategyId) ? "Next transition" : "Next event"}
                </Button>
                <Button type="button" variant="outline" disabled={!active} onClick={() => confirmAudition(group)}>
                  Confirm current setup heard
                </Button>
              </div>
              {previewStatus.groupId === group.groupId && previewStatus.state === "playing" && previewStatus.relativePath ? (
                <p className={styles.playing}>Playing: {fileName(previewStatus.relativePath)}</p>
              ) : null}
              {previewStatus.groupId === group.groupId && previewStatus.state === "error" ? (
                <p className={styles.error} role="alert">Preview failed: {previewStatus.message}</p>
              ) : null}

              <details className={styles.sources}>
                <summary>Exact source recordings ({group.includedSourceIds.length})</summary>
                <ul>{group.includedSourceIds.map((sourceId) => (
                  <li key={sourceId}>{sources[sourceId]?.relativePath ?? sourceId}</li>
                ))}</ul>
              </details>

              {group.status !== "blocked" ? (
                <section className={styles.qa} aria-label={`Construction QA for ${group.label}`}>
                  {group.allowedQaScopes.length === 1 ? (
                    <p><strong>QA scope:</strong> Playback only. QA scope is fixed to Playback only until processed audio exists.</p>
                  ) : (
                    <label>
                      <span>QA scope</span>
                      <select
                        value={scopes[group.groupId]}
                        disabled={Boolean(entry?.decision)}
                        onChange={(event) => setScopes((current) => ({
                          ...current,
                          [group.groupId]: event.target.value as "playback-only" | "complete-construction",
                        }))}
                      >
                        {group.allowedQaScopes.map((scope) => (
                          <option key={scope} value={scope}>{scope === "playback-only" ? "Playback only" : "Complete construction"}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p><strong>Construction decision</strong></p>
                  <div className={styles.decisions} role="group" aria-label={`Decision for ${group.label}`}>
                    <DecisionButton label="Pass heard setup" value="pass" entry={entry} disabled={!heardCurrent} onClick={() => decide(group, "pass", heardCurrent)} />
                    <DecisionButton label="Needs rebuild" value="needs-rework" entry={entry} disabled={!heardCurrent && !noteBackedNegativeAllowed} onClick={() => decide(group, "needs-rework", heardCurrent)} />
                    <DecisionButton label="Reject" value="reject" entry={entry} disabled={!heardCurrent && !noteBackedNegativeAllowed} onClick={() => decide(group, "reject", heardCurrent)} />
                  </div>
                  {heardCurrent ? (
                    <small>This exact setup is confirmed. Choose one construction decision above.</small>
                  ) : (
                    <small>Pass requires a confirmed setup. Needs rebuild or Reject can be recorded from a written note without certifying this setup as heard.</small>
                  )}
                </section>
              ) : null}

              <label className={styles.note}>
                <span>Construction QA note</span>
                <textarea
                  value={entry?.note ?? ""}
                  onChange={(event) => updateNote(group.groupId, event.target.value)}
                  placeholder="Describe spacing, cadence, transition, overlap, or what still needs work…"
                />
              </label>
            </article>
          </AppSurface>
        )
      })}
    </div>
  )
}

function DecisionButton({ label, value, entry, disabled, onClick }: {
  label: string
  value: QaEntry["decision"]
  entry?: QaEntry
  disabled: boolean
  onClick: () => void
}) {
  return <Button type="button" variant="outline" aria-pressed={entry?.decision === value} disabled={disabled} onClick={onClick}>{label}</Button>
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>
}
