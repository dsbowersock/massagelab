"use client"

import { useEffect, useMemo, useState } from "react"

import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  addSignatureSoundCustomConcept,
  updateSignatureSoundConceptAssignment,
  updateSignatureSoundRecording,
} from "@/lib/atmoshaper/signature-sound-review-workspace"
import { useSignatureSoundReviewWorkspace } from "./review-workspace-provider"
import styles from "./candidate-review.module.css"

type ReviewState = "candidate" | "excluded" | "unclassified"
type OverallDecision = "keep" | "maybe" | "reject"
type ConceptDecision = "include" | "remove"
type RecordingConcept = { groupId: string; decision: ConceptDecision; note: string }
type Recording = {
  sourceId: string
  relativePath: string
  packName: string
  byteSize: number
  extension: string
  sha256: string
  reviewState: ReviewState
  confidence: string
  reason: string
  declaredCandidateIds: readonly string[]
  overallDecision: OverallDecision | null
  overallNote: string
  concepts: readonly RecordingConcept[]
}
type Concept = {
  groupId: string
  label: string
  conceptKind: "moodist" | "signature-extra" | "custom"
  strategyId: string
}
type DiscoverySummary = {
  reviewedPackCount: number
  audioCount: number
  candidateSourceCount: number
  excludedSourceCount: number
  unclassifiedSourceCount: number
}
type CuratedSummary = {
  explicitKeepCount: number
  explicitMaybeCount: number
  explicitRejectCount: number
  contextualMaybeCount: number
  activeSourceCount: number
  activeGroupCount: number
  zeroIngredientGroupCount: number
}

const PAGE_SIZE = 20
const DECISIONS: readonly { value: OverallDecision; label: string }[] = [
  { value: "keep", label: "Keep" },
  { value: "maybe", label: "Maybe" },
  { value: "reject", label: "Reject" },
]

/** Provides the recording-focused projection of the single shared local review workspace. */
export function CandidateReview() {
  const { baselines, loaded, projection, updateWorkspace, workspace } = useSignatureSoundReviewWorkspace()
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState<"all" | ReviewState>("candidate")
  const [decisionFilter, setDecisionFilter] = useState<"all" | "unreviewed" | OverallDecision>("all")
  const [conceptFilter, setConceptFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [existingConceptBySource, setExistingConceptBySource] = useState<Record<string, string>>({})
  const [customConceptBySource, setCustomConceptBySource] = useState<Record<string, string>>({})

  const recordings = useMemo(
    () => (projection?.recordings ?? []) as readonly Recording[],
    [projection],
  )
  const concepts = useMemo(
    () => (projection?.concepts ?? []) as readonly Concept[],
    [projection],
  )
  const discoverySummary = baselines.discoveryReview.summary as DiscoverySummary
  const curatedSummary = baselines.curatedReview.summary as CuratedSummary
  const curatedPolicy = baselines.curatedReview.policy as Record<string, string>
  const conceptById = useMemo(() => new Map(concepts.map((concept) => [concept.groupId, concept])), [concepts])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return recordings.filter((recording) => {
      if (stateFilter !== "all" && recording.reviewState !== stateFilter) return false
      if (decisionFilter === "unreviewed" && recording.overallDecision) return false
      if (decisionFilter !== "all" && decisionFilter !== "unreviewed" && recording.overallDecision !== decisionFilter) return false
      if (conceptFilter !== "all" && !recording.concepts.some(({ groupId }) => groupId === conceptFilter)) return false
      if (!query) return true
      const haystack = [
        recording.relativePath,
        recording.packName,
        recording.reason,
        recording.overallNote,
        ...recording.concepts.flatMap(({ groupId, note }) => [groupId, conceptById.get(groupId)?.label ?? "", note]),
      ].join(" ").toLowerCase()
      return haystack.includes(query)
    })
  }, [conceptById, conceptFilter, decisionFilter, recordings, search, stateFilter])

  useEffect(() => setPage(0), [conceptFilter, decisionFilter, search, stateFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const reviewedCount = recordings.filter(({ overallDecision }) => overallDecision).length

  function updateOverall(sourceId: string, update: { decision?: OverallDecision; note?: string }) {
    updateWorkspace((draft) => updateSignatureSoundRecording(draft, baselines, {
      sourceId,
      ...update,
      updatedAt: new Date().toISOString(),
    }))
  }

  function updateConcept(sourceId: string, concept: RecordingConcept, update: Partial<Pick<RecordingConcept, "decision" | "note">>) {
    updateWorkspace((draft) => updateSignatureSoundConceptAssignment(draft, baselines, {
      sourceId,
      groupId: concept.groupId,
      decision: update.decision ?? concept.decision,
      note: update.note ?? concept.note,
      updatedAt: new Date().toISOString(),
    }))
  }

  function includeExistingConcept(sourceId: string) {
    const groupId = existingConceptBySource[sourceId]
    if (!groupId) return
    updateWorkspace((draft) => updateSignatureSoundConceptAssignment(draft, baselines, {
      sourceId,
      groupId,
      decision: "include",
      note: "",
      updatedAt: new Date().toISOString(),
    }))
    setExistingConceptBySource((current) => ({ ...current, [sourceId]: "" }))
  }

  function addCustomConcept(sourceId: string) {
    const label = customConceptBySource[sourceId]?.trim()
    if (!label) return
    updateWorkspace((draft) => addSignatureSoundCustomConcept(draft, baselines, {
      sourceId,
      label,
      updatedAt: new Date().toISOString(),
    }).workspace)
    setCustomConceptBySource((current) => ({ ...current, [sourceId]: "" }))
  }

  if (!loaded || !workspace || !projection) {
    return <p className={styles.empty}>Loading the shared recording review…</p>
  }

  return (
    <div className={styles.review} data-testid="atmoshaper-candidate-review">
      <section className={styles.summary} aria-label="Recording review summary">
        <SummaryCard label="Packs reviewed" value={discoverySummary.reviewedPackCount} />
        <SummaryCard label="Audio files" value={discoverySummary.audioCount} />
        <SummaryCard label="Proposed sources" value={discoverySummary.candidateSourceCount} />
        <SummaryCard label="Excluded" value={discoverySummary.excludedSourceCount} />
        <SummaryCard label="Unclassified" value={discoverySummary.unclassifiedSourceCount} />
        <SummaryCard label="Your decisions" value={reviewedCount} />
      </section>

      <AppSurface
        title="Recording review"
        description="Your earlier decisions and notes are already here. Overall judgments describe the recording; concept choices only affect the selected concept."
        variant="inset"
      >
        <div className={styles.curationSummary}>
          <SummaryCard label="Explicit Keeps" value={curatedSummary.explicitKeepCount} />
          <SummaryCard label="Explicit Maybes" value={curatedSummary.explicitMaybeCount} />
          <SummaryCard label="Explicit Rejects" value={curatedSummary.explicitRejectCount} />
          <SummaryCard label="Contextual Maybes" value={curatedSummary.contextualMaybeCount} />
          <SummaryCard label="Usable ingredients" value={curatedSummary.activeSourceCount} />
          <SummaryCard label="Active groups" value={curatedSummary.activeGroupCount} />
        </div>
        <p className={styles.curationPolicy}>
          Playback is <strong>{curatedPolicy.playbackMode}</strong>. A recording removed from one concept remains available to every other concept.
          {curatedSummary.zeroIngredientGroupCount > 0
            ? ` ${curatedSummary.zeroIngredientGroupCount} active concepts currently need another usable recording.`
            : null}
        </p>
      </AppSurface>

      <AppSurface title="Review controls" description="Filters change the queue only; they do not change the catalog." variant="inset">
        <div className={styles.controls}>
          <label className={styles.search}>
            <span>Search path, pack, concept, or note</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="walking on stone" />
          </label>
          <label>
            <span>Discovery state</span>
            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}>
              <option value="all">All states</option>
              <option value="candidate">Proposed candidates</option>
              <option value="unclassified">Unclassified</option>
              <option value="excluded">Excluded</option>
            </select>
          </label>
          <label>
            <span>Your overall decision</span>
            <select value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value as typeof decisionFilter)}>
              <option value="all">All decisions</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="keep">Keep</option>
              <option value="maybe">Maybe</option>
              <option value="reject">Reject</option>
            </select>
          </label>
          <label>
            <span>Concept</span>
            <select value={conceptFilter} onChange={(event) => setConceptFilter(event.target.value)}>
              <option value="all">All concepts</option>
              {concepts.map((concept) => <option key={concept.groupId} value={concept.groupId}>{conceptLabel(concept)}</option>)}
            </select>
          </label>
        </div>
        <div className={styles.toolbar}>
          <p><strong>{filtered.length.toLocaleString()}</strong> matching recordings</p>
          <p>All changes save automatically to the complete local review.</p>
        </div>
      </AppSurface>

      <section className={styles.list} aria-label="Candidate recordings">
        {visible.map((recording) => {
          const assignedIds = new Set(recording.concepts.map(({ groupId }) => groupId))
          const availableConcepts = concepts.filter(({ groupId }) => !assignedIds.has(groupId))
          return (
            <article className={styles.card} key={recording.sourceId}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.badges}>
                    <span data-state={recording.reviewState}>{recording.reviewState}</span>
                    <span>{recording.confidence}</span>
                    {recording.overallDecision ? <span>overall {recording.overallDecision}</span> : null}
                    {recording.declaredCandidateIds.length > 0 ? <span>already declared</span> : null}
                  </div>
                  <h2>{recording.relativePath.split("/").at(-1)}</h2>
                  <p className={styles.path}>{recording.relativePath}</p>
                </div>
                <div className={styles.meta}>
                  <span>{formatBytes(recording.byteSize)}</span>
                  <span>{recording.extension.slice(1).toUpperCase()}</span>
                  <span title={recording.sha256}>sha {recording.sha256.slice(0, 10)}</span>
                </div>
              </div>
              <audio controls preload="none" src={`/api/dev/atmoshaper-candidates/audio/${recording.sourceId}`}>
                Your browser does not support audio playback.
              </audio>
              <p className={styles.reason}>{recording.reason}</p>

              <div className={styles.decision} role="group" aria-label={`Overall decision for ${recording.relativePath}`}>
                {DECISIONS.map(({ value, label }) => (
                  <button
                    className={recording.overallDecision === value ? styles.selectedDecision : undefined}
                    key={value}
                    type="button"
                    aria-pressed={recording.overallDecision === value}
                    onClick={() => updateOverall(recording.sourceId, { decision: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className={styles.note}>
                <span>Overall recording note</span>
                <textarea
                  value={recording.overallNote}
                  onChange={(event) => updateOverall(recording.sourceId, { note: event.target.value })}
                  placeholder="What did you hear in this recording overall?"
                />
              </label>

              <section className={styles.assignments} aria-label={`Concept assignments for ${recording.relativePath}`}>
                <div className={styles.assignmentHeading}>
                  <div>
                    <h3>Concept assignments</h3>
                    <p>These choices affect only this recording inside each concept.</p>
                  </div>
                  <span>{recording.concepts.length} assigned</span>
                </div>
                <div className={styles.assignmentList}>
                  {recording.concepts.map((assignment) => {
                    const concept = conceptById.get(assignment.groupId)
                    return (
                      <div className={styles.assignment} key={assignment.groupId}>
                        <div>
                          <strong>{concept?.label ?? assignment.groupId}</strong>
                          <small>{concept?.conceptKind ?? "concept"}</small>
                        </div>
                        <div className={styles.assignmentDecision} role="group" aria-label={`Use in ${concept?.label ?? assignment.groupId}`}>
                          <button
                            type="button"
                            aria-pressed={assignment.decision === "include"}
                            className={assignment.decision === "include" ? styles.selectedDecision : undefined}
                            onClick={() => updateConcept(recording.sourceId, assignment, { decision: "include" })}
                          >
                            Include for concept
                          </button>
                          <button
                            type="button"
                            aria-pressed={assignment.decision === "remove"}
                            className={assignment.decision === "remove" ? styles.selectedRemoval : undefined}
                            onClick={() => updateConcept(recording.sourceId, assignment, { decision: "remove" })}
                          >
                            Remove from concept
                          </button>
                        </div>
                        <label className={styles.note}>
                          <span>Note for {concept?.label ?? assignment.groupId}</span>
                          <textarea
                            value={assignment.note}
                            onChange={(event) => updateConcept(recording.sourceId, assignment, { note: event.target.value })}
                            placeholder="Why this recording works or does not work for this concept…"
                          />
                        </label>
                      </div>
                    )
                  })}
                </div>
                <div className={styles.addConcepts}>
                  <label>
                    <span>Add an existing concept</span>
                    <select
                      value={existingConceptBySource[recording.sourceId] ?? ""}
                      onChange={(event) => setExistingConceptBySource((current) => ({
                        ...current,
                        [recording.sourceId]: event.target.value,
                      }))}
                    >
                      <option value="">Choose a concept…</option>
                      {availableConcepts.map((concept) => (
                        <option key={concept.groupId} value={concept.groupId}>{conceptLabel(concept)}</option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" onClick={() => includeExistingConcept(recording.sourceId)}>
                      Include selected concept
                    </Button>
                  </label>
                  <label>
                    <span>Add concept</span>
                    <input
                      value={customConceptBySource[recording.sourceId] ?? ""}
                      onChange={(event) => setCustomConceptBySource((current) => ({
                        ...current,
                        [recording.sourceId]: event.target.value,
                      }))}
                      placeholder="New concept name"
                    />
                    <Button type="button" variant="outline" onClick={() => addCustomConcept(recording.sourceId)}>
                      Add concept
                    </Button>
                  </label>
                </div>
              </section>
            </article>
          )
        })}
        {visible.length === 0 ? <p className={styles.empty}>No recordings match these filters.</p> : null}
      </section>

      <nav className={styles.pagination} aria-label="Candidate pages">
        <Button type="button" variant="outline" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button>
        <span>Page {safePage + 1} of {pageCount}</span>
        <Button type="button" variant="outline" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</Button>
      </nav>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div><strong>{value.toLocaleString()}</strong><span>{label}</span></div>
}

function conceptLabel(concept: Concept) {
  const prefix = concept.conceptKind === "moodist" ? "Moodist" : concept.conceptKind === "custom" ? "Custom" : "Signature"
  return `${prefix} · ${concept.label}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
