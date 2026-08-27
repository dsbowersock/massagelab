export type PreparedConceptPlaybackSource = {
  sourceId: string
  relativePath: string
  audioUrl: string
  durationSeconds?: number
  gainDb?: number
  startSeconds?: number
  endSeconds?: number
  fadeInSeconds?: number
  fadeOutSeconds?: number
  sourceSetId?: string
  sourceSetLabel?: string
}

export type PreparedConceptPlaybackEntry = {
  batchId: string
  groupId: string
  label: string
  reviewFingerprint: string
  sources: PreparedConceptPlaybackSource[]
  playbackConfiguration: {
    strategyId: string
    previewSettings:
      | { transitionMode: string; transitionSeconds: number }
      | { stepsPerMinute: number; jitterPercent: number }
      | { minimumGapSeconds: number; maximumGapSeconds: number }
    constructionPolicy: {
      minimumSelectionsBeforeRepeat: number | null
      transitionDurationRange: { minimumSeconds: number; maximumSeconds: number } | null
      cadenceBoundary: { mode: string; crossfadeSeconds: number } | null
      overlapNextEvent: boolean
      preserveFullLengthOverlaps?: boolean
    }
  }
  runtimePolicy: Record<string, unknown> | null
  selectionSummary?: string | null
  sourceSelection?: { kind: "single-source-loop" } | null
  playbackMode?: {
    kind: "prebaked-intro-loop"
    /** Artifact-local point where Web Audio repeats the already-rendered seam and loop body. */
    artifactLoopStartSeconds: number
    /** Source-time recipe retained for an exact, reviewer-readable design summary. */
    firstPassStartSeconds: number
    sourceLoopStartSeconds: number
    sourceLoopEndSeconds: number
    crossfadeSeconds: number
    crossfadeCurve: string
  } | null
}
