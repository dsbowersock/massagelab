// @ts-check

import {
  validateSignatureSoundConstructionReview,
} from "./signature-sound-construction-review.js"

export const SIGNATURE_CONSTRUCTION_AUDITION_ALGORITHM_VERSION = "signature-construction-audition-v1"

const PLAYBACK_RESOLUTION_TYPES = new Set([
  "audition-requirement",
  "boundary-mode-audition",
  "nonrepeat-window",
  "overlap-next-event",
  "playback-override",
  "transition-duration-range",
])

/**
 * Projects the exact groups whose reconciled construction intent requires a
 * rebuilt playback audition. This owner does not execute audio or infer a
 * missing human instruction.
 * @param {unknown} rawConstructionReview
 * @param {unknown} rawAuthority
 */
export function createSignatureSoundConstructionAudition(rawConstructionReview, rawAuthority) {
  const constructionReview = validateSignatureSoundConstructionReview(
    rawConstructionReview,
    rawAuthority,
  )
  const playbackGroupIds = new Set(
    constructionReview.resolutions
      .filter(({ type }) => PLAYBACK_RESOLUTION_TYPES.has(type))
      .map(({ groupId }) => groupId),
  )
  const groups = constructionReview.groups
    .filter((group) => playbackGroupIds.has(group.groupId) || isInstructionlessRebuild(group))
    .map(projectGroup)
    .sort((left, right) => compareText(left.groupId, right.groupId))

  return copy({
    version: 1,
    algorithmVersion: SIGNATURE_CONSTRUCTION_AUDITION_ALGORITHM_VERSION,
    constructionReviewSha256: constructionReview.fingerprints.constructionReviewSha256,
    groups,
  })
}

/** @param {Record<string, any>} group */
function projectGroup(group) {
  const processingIntentIds = collectProcessingIntentIds(group)
  const instructionless = isInstructionlessRebuild(group)
  const blockers = instructionless
    ? ["missing-construction-instruction"]
    : processingIntentIds.map((id) => `processing-intent-pending:${id}`)
  const status = instructionless
    ? "blocked"
    : processingIntentIds.length > 0
      ? "processing-pending"
      : "ready"

  return {
    groupId: group.groupId,
    label: group.label,
    strategyId: group.playback.strategyId,
    includedSourceIds: copy(group.includedSourceIds),
    previewSettings: copy(group.playback.previewSettings),
    policy: projectPolicy(group.playback),
    processingIntentIds,
    noteDispositionIds: copy(group.noteDispositionIds),
    reviewState: group.reviewState,
    status,
    blockers,
    allowedQaScopes: status === "blocked"
      ? []
      : status === "processing-pending"
        ? ["playback-only"]
        : ["playback-only", "complete-construction"],
  }
}

/** @param {Record<string, any>} playback */
function projectPolicy(playback) {
  const transitionRange = playback.constraints.find(({ type }) => type === "transition-duration-range")
  const boundaryAudition = playback.constraints.find(({ type }) => type === "boundary-mode-audition")
  return {
    minimumSelectionsBeforeRepeat: playback.minimumSelectionsBeforeRepeat,
    transitionDurationRange: transitionRange
      ? {
          minimumSeconds: transitionRange.minimumSeconds,
          maximumSeconds: transitionRange.maximumSeconds,
        }
      : null,
    boundaryModeCandidates: boundaryAudition ? copy(boundaryAudition.modes) : [],
    overlapNextEvent: playback.constraints.some(({ type }) => type === "overlap-next-event"),
  }
}

/** @param {Record<string, any>} group */
function collectProcessingIntentIds(group) {
  const ids = new Set(
    group.processingIntents
      .filter(({ type }) => type === "processing-intent")
      .map(({ id }) => id),
  )
  for (const intents of Object.values(group.sourceOverrides)) {
    for (const intent of /** @type {any[]} */ (intents)) {
      if (intent.type === "processing-intent") ids.add(intent.id)
    }
  }
  return [...ids].sort(compareText)
}

/** @param {Record<string, any>} group */
function isInstructionlessRebuild(group) {
  return group.reviewState === "needs-rebuild-audition" && group.noteDispositionIds.length === 0
}

function compareText(left, right) {
  return left.toLowerCase().localeCompare(right.toLowerCase(), "en")
    || left.localeCompare(right, "en")
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
