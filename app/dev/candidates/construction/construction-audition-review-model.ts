import type { Dispatch, SetStateAction } from "react"

export type Boundary = { mode: "crossfade" | "overlap"; crossfadeSeconds: number }
export type PreviewSettings = Record<string, number | string>
export type ConstructionPolicy = {
  minimumSelectionsBeforeRepeat: number | null
  transitionDurationRange: { minimumSeconds: number; maximumSeconds: number } | null
  cadenceBoundary: Boundary | null
  overlapNextEvent: boolean
}
export type Configuration = {
  includedSourceIds: string[]
  previewSettings: PreviewSettings
  constructionPolicy: ConstructionPolicy
}
export type AuditionGroup = {
  groupId: string
  label: string
  strategyId: string
  includedSourceIds: string[]
  previewSettings: PreviewSettings
  policy: {
    minimumSelectionsBeforeRepeat: number | null
    transitionDurationRange: { minimumSeconds: number; maximumSeconds: number } | null
    boundaryModeCandidates: ("crossfade" | "overlap")[]
    overlapNextEvent: boolean
  }
  processingIntentIds: string[]
  status: "ready" | "processing-pending" | "blocked"
  blockers: string[]
  allowedQaScopes: ("playback-only" | "complete-construction")[]
}
export type ConstructionAudition = {
  version: 1
  algorithmVersion: string
  constructionReviewSha256: string
  groups: AuditionGroup[]
}
export type Source = { sourceId: string; relativePath: string }
export type QaEntry = {
  note: string
  auditionedAt?: string
  auditionKey?: string
  configuration?: Configuration
  decision?: "pass" | "needs-rework" | "reject"
  scope?: "playback-only" | "complete-construction"
}
export type Qa = {
  version: 1
  constructionReviewSha256: string
  algorithmVersion: string
  updatedAt: string
  groups: Record<string, QaEntry>
}

export function defaultBoundaries(audition: ConstructionAudition) {
  return Object.fromEntries(audition.groups.filter((group) => group.policy.boundaryModeCandidates.length > 0).map((group) => [
    group.groupId,
    { mode: group.policy.boundaryModeCandidates[0], crossfadeSeconds: group.policy.boundaryModeCandidates[0] === "crossfade" ? 0.12 : 0 },
  ])) as Record<string, Boundary>
}

export function defaultScopes(audition: ConstructionAudition) {
  return Object.fromEntries(audition.groups.filter((group) => group.allowedQaScopes.length > 0).map((group) => [
    group.groupId,
    group.allowedQaScopes.at(-1),
  ])) as Record<string, "playback-only" | "complete-construction">
}

export function restoreSelections(
  qa: Qa,
  setBoundaries: Dispatch<SetStateAction<Record<string, Boundary>>>,
  setScopes: Dispatch<SetStateAction<Record<string, "playback-only" | "complete-construction">>>,
) {
  const boundaries = Object.fromEntries(Object.entries(qa.groups).flatMap(([groupId, entry]) => (
    entry.configuration?.constructionPolicy.cadenceBoundary ? [[groupId, entry.configuration.constructionPolicy.cadenceBoundary]] : []
  )))
  const scopes = Object.fromEntries(Object.entries(qa.groups).flatMap(([groupId, entry]) => entry.scope ? [[groupId, entry.scope]] : []))
  if (Object.keys(boundaries).length > 0) setBoundaries((current) => ({ ...current, ...boundaries }))
  if (Object.keys(scopes).length > 0) setScopes((current) => ({ ...current, ...scopes }))
}

export function countDecisions(qa: Qa, audition: ConstructionAudition) {
  const entries = audition.groups.map((group) => qa.groups[group.groupId])
  return {
    pass: entries.filter((entry) => entry?.decision === "pass").length,
    needsRework: entries.filter((entry) => entry?.decision === "needs-rework").length,
    reject: entries.filter((entry) => entry?.decision === "reject").length,
  }
}

export function describeRequirement(group: AuditionGroup) {
  const details = []
  if (group.policy.minimumSelectionsBeforeRepeat) details.push(`avoid repeats for ${group.policy.minimumSelectionsBeforeRepeat} selections`)
  if (group.policy.transitionDurationRange) details.push(`${group.policy.transitionDurationRange.minimumSeconds}–${group.policy.transitionDurationRange.maximumSeconds}s transitions`)
  if (group.policy.boundaryModeCandidates.length > 0) details.push("compare cadence crossfade with overlap")
  if (group.policy.overlapNextEvent) details.push("overlap the next event")
  if ("minimumGapSeconds" in group.previewSettings) details.push(`${group.previewSettings.minimumGapSeconds}–${group.previewSettings.maximumGapSeconds}s gaps`)
  if ("stepsPerMinute" in group.previewSettings) details.push(`${group.previewSettings.stepsPerMinute} steps/min with ${group.previewSettings.jitterPercent}% variation`)
  return details.join(" · ") || "Audition the exact reconciled playback setup."
}

export function statusLabel(status: AuditionGroup["status"]) {
  if (status === "processing-pending") return "Playback ready · processing pending"
  if (status === "blocked") return "Blocked"
  return "Ready for construction QA"
}

export function strategyLabel(strategyId: string) {
  return strategyId.split("-").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ")
}

export function isContinuous(strategyId: string) {
  return strategyId === "adaptive-whole-source-sequence" || strategyId === "adaptive-one-shot-sequence"
}

export function fileName(relativePath: string) {
  return relativePath.split(/[\\/]/).at(-1) ?? relativePath
}
