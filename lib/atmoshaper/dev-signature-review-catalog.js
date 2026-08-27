// @ts-check

import { selectUnavailableDevSignatureSoundSpeechReductionBatches } from "./dev-speech-reduction-review.js"
import { validateSignatureSoundCatalogExpansionReview } from "./signature-sound-catalog-expansion-review.js"
import { validateSignatureSoundWholeConceptOutcomeCatalog } from "./signature-sound-whole-concept-outcome.js"
import { applySignatureSoundWholeConceptStageFinalizations } from "./signature-sound-whole-concept-stage-finalization.js"

/**
 * Composes the live development queue after external processed audio has been
 * bound: finalize exact accepted stages, attach only current Pass identities,
 * then append the separately owned folder-expansion review without collisions.
 * @param {{catalog:Record<string,any>,stageFinalizations:unknown,outcomes:unknown,expansionReview:unknown,discoveryReview:unknown}} input
 */
export function composeDevSignatureSoundReviewCatalog(input) {
  const finalized = applySignatureSoundWholeConceptStageFinalizations(
    input.catalog,
    input.stageFinalizations,
  )
  const expansion = validateSignatureSoundCatalogExpansionReview(
    input.expansionReview,
    { discoveryReview: input.discoveryReview },
  )
  const existingBatchIds = new Set(finalized.entries.map(({ batchId }) => batchId))
  const existingGroupIds = new Set(finalized.entries.map(({ groupId }) => groupId))
  for (const entry of expansion.entries) {
    if (existingBatchIds.has(entry.batchId) || existingGroupIds.has(entry.groupId)) {
      throw new Error(`Catalog expansion review collides with the established queue: ${entry.batchId}`)
    }
  }
  const entries = [...finalized.entries, ...expansion.entries]
  const outcomeCatalog = validateSignatureSoundWholeConceptOutcomeCatalog(input.outcomes, {
    reviewEntries: entries,
    inactiveReviewBatchIds: selectUnavailableDevSignatureSoundSpeechReductionBatches(finalized),
  })
  const outcomeByBatch = new Map(outcomeCatalog.entries.map((outcome) => [outcome.batchId, outcome]))
  return {
    ...finalized,
    entries: entries.map((entry) => ({
      ...entry,
      chatOutcome: outcomeByBatch.get(entry.batchId) ?? null,
    })),
  }
}
