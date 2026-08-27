"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { AppSurface } from "@/components/ui/app-surface"
import {
  createSignatureSoundExactPreviewAuditionKey,
  defaultSignatureSoundPreviewSettings,
} from "@/lib/atmoshaper/signature-sound-preview"
import { createSignatureSoundPreviewPlayer } from "@/lib/atmoshaper/signature-sound-preview-player"
import {
  updateSignatureSoundConceptAssignment,
  updateSignatureSoundGroup,
} from "@/lib/atmoshaper/signature-sound-review-workspace"
import {
  ConceptIngredientReview,
  type ConceptIngredient,
} from "./concept-ingredient-review"
import {
  GroupStrategyPreview,
  type PreviewSettings,
  type PreviewStatus,
} from "./group-strategy-preview"
import { useSignatureSoundReviewWorkspace } from "./review-workspace-provider"
import styles from "./group-strategy-review.module.css"

type GroupDecision = "approve" | "change"
type Strategy = {
  id: string
  label: string
  sourceUnit: string
  timing: string
  transitions: readonly string[]
}
type Group = {
  groupId: string
  conceptKind: "moodist" | "signature-extra" | "custom"
  label: string
  category: string | null
  status: string
  strategyId: string
  previewSettings: PreviewSettings
  sourceCounts: { total: number; include: number; remove: number }
  ingredients: readonly ConceptIngredient[]
  includedSourceIds: readonly string[]
  decision?: GroupDecision
  auditionedAt?: string
  auditionKey?: string
  note: string
}

/** Reviews exact concept ingredients and playback strategy inside the sole shared workspace. */
export function GroupStrategyReview() {
  const { baselines, loaded, projection, updateWorkspace, workspace } = useSignatureSoundReviewWorkspace()
  const [search, setSearch] = useState("")
  const [reviewFilter, setReviewFilter] = useState<"all" | "unreviewed" | GroupDecision>("unreviewed")
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ state: "idle" })
  const playerRef = useRef<ReturnType<typeof createSignatureSoundPreviewPlayer> | null>(null)
  const previewRequestRef = useRef(0)
  const groups = useMemo(
    () => (projection?.groups ?? []) as readonly Group[],
    [projection],
  )
  const strategies = baselines.curatedReview.strategies as readonly Strategy[]
  const strategyById = useMemo(() => new Map(strategies.map((strategy) => [strategy.id, strategy])), [strategies])

  useEffect(() => {
    let mounted = true
    const player = createSignatureSoundPreviewPlayer({
      onStatus(status: PreviewStatus) {
        if (mounted) setPreviewStatus(status)
      },
    })
    playerRef.current = player
    return () => {
      mounted = false
      playerRef.current = null
      player.stop()
    }
  }, [])

  const counts = useMemo(() => {
    const approve = groups.filter(({ decision }) => decision === "approve").length
    const change = groups.filter(({ decision }) => decision === "change").length
    return { approve, change, unreviewed: groups.length - approve - change }
  }, [groups])

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase()
    return groups.filter((group) => {
      if (reviewFilter === "unreviewed" && group.decision) return false
      if (reviewFilter !== "all" && reviewFilter !== "unreviewed" && group.decision !== reviewFilter) return false
      if (!query) return true
      const selectedStrategy = strategyById.get(group.strategyId)
      return [group.groupId, group.label, group.category ?? "", group.note, selectedStrategy?.label ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [groups, reviewFilter, search, strategyById])

  function stopPreview() {
    previewRequestRef.current += 1
    playerRef.current?.stop()
  }

  function updateGroup(group: Group, update: {
    strategyId?: string
    previewSettings?: PreviewSettings
    decision?: GroupDecision
    note?: string
    auditionedAt?: string
    auditionKey?: string
  }, changesAudio = false) {
    if (changesAudio) stopPreview()
    updateWorkspace((draft) => updateSignatureSoundGroup(draft, baselines, {
      groupId: group.groupId,
      ...update,
      updatedAt: new Date().toISOString(),
    }))
  }

  function updateIngredient(group: Group, ingredient: ConceptIngredient, update: {
    decision?: ConceptIngredient["decision"]
    note?: string
  }) {
    if (update.decision && update.decision !== ingredient.decision) stopPreview()
    updateWorkspace((draft) => updateSignatureSoundConceptAssignment(draft, baselines, {
      sourceId: ingredient.sourceId,
      groupId: group.groupId,
      decision: update.decision ?? ingredient.decision,
      note: update.note ?? ingredient.note,
      updatedAt: new Date().toISOString(),
    }))
  }

  async function startPreview(group: Group, initialSourceId?: string) {
    const player = playerRef.current
    if (!player || group.includedSourceIds.length === 0) return
    const sources = group.ingredients
      .filter(({ decision }) => decision === "include")
      .map(({ sourceId, relativePath }) => ({ sourceId, relativePath }))
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    try {
      await player.start({
        groupId: group.groupId,
        strategyId: group.strategyId,
        previewSettings: group.previewSettings,
        sources,
        initialSourceId,
      })
      if (previewRequestRef.current !== requestId) return
      const auditionedAt = new Date().toISOString()
      const heardAuditionKey = exactAuditionKey(group)
      updateWorkspace((draft) => updateSignatureSoundGroup(draft, baselines, {
        groupId: group.groupId,
        auditionedAt,
        auditionKey: heardAuditionKey,
        updatedAt: auditionedAt,
      }))
    } catch {
      // The player reports a visible error; failed playback is not audition evidence.
    }
  }

  if (!loaded || !workspace || !projection) {
    return <p className={styles.empty}>Loading the shared concept review…</p>
  }

  return (
    <AppSurface
      title="Review group strategies"
      description="Choose the exact recordings, listen to the resulting dynamic setup, then approve the exact configuration you heard."
      variant="inset"
    >
      <section className={styles.summary} aria-label="Concept review progress">
        <SummaryCard label="Active concepts" value={groups.length} />
        <SummaryCard label="Approved" value={counts.approve} />
        <SummaryCard label="Needs changes" value={counts.change} />
        <SummaryCard label="Unreviewed" value={counts.unreviewed} />
      </section>

      <p className={styles.boundary}>
        This raw scheduling preview is design evidence only. It does not prove final loudness, seamless processing,
        technical quality, or production-player behavior.
      </p>

      <div className={styles.controls}>
        <label>
          <span>Search concepts or notes</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="walking, crowd, waves…" />
        </label>
        <label>
          <span>Review status</span>
          <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
            <option value="unreviewed">Unreviewed</option>
            <option value="all">All concepts</option>
            <option value="approve">Approved</option>
            <option value="change">Needs changes</option>
          </select>
        </label>
      </div>

      <div className={styles.toolbar}>
        <p><strong>{filteredGroups.length}</strong> matching concepts</p>
        <p>All ingredient, strategy, note, and approval changes save to the complete review.</p>
      </div>

      <section className={styles.groupList} aria-label="Playback strategy concepts">
        {filteredGroups.map((group) => {
          const proposedStrategyId = ((baselines.curatedReview.groups as readonly { groupId: string; strategyId: string }[])
            .find(({ groupId }) => groupId === group.groupId))?.strategyId ?? group.strategyId
          const proposed = strategyById.get(proposedStrategyId)
          const selected = strategyById.get(group.strategyId)
          const currentAuditionKey = group.includedSourceIds.length > 0 ? exactAuditionKey(group) : null
          const auditioned = currentAuditionKey !== null
            && Boolean(group.auditionedAt && group.auditionKey === currentAuditionKey)
          const status = previewStatus.groupId === group.groupId ? previewStatus : { state: "idle" } as PreviewStatus
          return (
            <article className={styles.groupCard} key={group.groupId}>
              <header className={styles.groupHeader}>
                <div>
                  <div className={styles.badges}>
                    <span>{conceptKindLabel(group.conceptKind)}</span>
                    <span>{group.status}</span>
                    {group.sourceCounts.include === 0 ? <span data-warning="true">Needs included sources</span> : null}
                    {auditioned ? <span data-auditioned="true">Current setup heard</span> : null}
                  </div>
                  <h3>{group.label}</h3>
                  <p>{group.category ? `${group.category} · ` : ""}{group.groupId}</p>
                </div>
                <dl className={styles.sourceCounts}>
                  <div><dt>Included</dt><dd>{group.sourceCounts.include}</dd></div>
                  <div><dt>Removed</dt><dd>{group.sourceCounts.remove}</dd></div>
                  <div><dt>Total</dt><dd>{group.sourceCounts.total}</dd></div>
                </dl>
              </header>

              <div className={styles.strategyComparison}>
                <div>
                  <span>Proposed strategy</span>
                  <strong>{proposed?.label ?? proposedStrategyId}</strong>
                  {proposed ? <small>{describeStrategy(proposed)}</small> : null}
                </div>
                <label>
                  <span>Your selected strategy</span>
                  <select
                    value={group.strategyId}
                    onChange={(event) => updateGroup(group, {
                      strategyId: event.target.value,
                      previewSettings: defaultSignatureSoundPreviewSettings(event.target.value) as PreviewSettings,
                    }, true)}
                  >
                    {strategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.label}</option>)}
                  </select>
                  {selected ? <small>{describeStrategy(selected)}</small> : null}
                </label>
              </div>

              <GroupStrategyPreview
                groupLabel={group.label}
                strategyId={group.strategyId}
                previewSettings={group.previewSettings}
                sources={group.ingredients.filter(({ decision }) => decision === "include")}
                isActive={previewStatus.state === "playing" && previewStatus.groupId === group.groupId}
                status={status}
                onSettingsChange={(previewSettings) => updateGroup(group, { previewSettings }, true)}
                onStart={() => void startPreview(group)}
                onStop={stopPreview}
                onAdvance={() => void playerRef.current?.advance()}
              />

              <ConceptIngredientReview
                groupLabel={group.label}
                ingredients={group.ingredients}
                playingSourceId={status.state === "playing" ? status.sourceId : undefined}
                onDecisionChange={(ingredient, decision) => updateIngredient(group, ingredient, { decision })}
                onNoteChange={(ingredient, note) => updateIngredient(group, ingredient, { note })}
                onPlayInSetup={(sourceId) => void startPreview(group, sourceId)}
              />

              <div className={styles.decision} role="group" aria-label={`Concept decision for ${group.label}`}>
                <button
                  type="button"
                  aria-pressed={group.decision === "approve"}
                  disabled={!auditioned}
                  title={auditioned ? "Approve the configuration you heard" : "Start this preview before approving"}
                  onClick={() => updateGroup(group, { decision: "approve" })}
                >
                  Approve heard setup
                </button>
                <button
                  type="button"
                  aria-pressed={group.decision === "change"}
                  onClick={() => updateGroup(group, { decision: "change" })}
                >
                  Needs changes
                </button>
                {!auditioned ? <small>Listen to the current setup before approval.</small> : null}
              </div>

              <label className={styles.note}>
                <span>Concept note</span>
                <textarea
                  value={group.note}
                  onChange={(event) => updateGroup(group, { note: event.target.value })}
                  placeholder="Describe spacing, cadence, transition, overlap, sequencing, or broader changes…"
                />
              </label>
            </article>
          )
        })}
        {filteredGroups.length === 0 ? <p className={styles.empty}>No concepts match these filters.</p> : null}
      </section>
    </AppSurface>
  )
}

function exactAuditionKey(group: Group) {
  return createSignatureSoundExactPreviewAuditionKey({
    strategyId: group.strategyId,
    previewSettings: group.previewSettings,
    includedSourceIds: group.includedSourceIds,
  })
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div><strong>{value.toLocaleString()}</strong><span>{label}</span></div>
}

function describeStrategy(strategy: Strategy) {
  return `${strategy.sourceUnit} · ${strategy.timing} · ${strategy.transitions.join(" / ")}`
}

function conceptKindLabel(kind: Group["conceptKind"]) {
  if (kind === "moodist") return "Moodist concept"
  if (kind === "custom") return "Custom concept"
  return "Signature extra"
}
