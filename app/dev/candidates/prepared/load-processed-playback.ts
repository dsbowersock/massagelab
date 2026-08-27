import batch02Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json"
import batch03Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"
import batch04Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json"
import batch05Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-05-dryer-trim-audition.json"
import batchRegistry from "@/data/atmoshaper/signature-sound-derived-audio-batch-registry.json"
import manifestAnchors from "@/data/atmoshaper/signature-sound-derived-audio-manifests.json"
import committedBatch03Selection from "@/data/atmoshaper/signature-sound-treatment-concept-qa-batch-03-sci-fi-whistles.json"
import committedBatch04Selection from "@/data/atmoshaper/signature-sound-edit-concept-qa-batch-04-boiling-water.json"
import committedBatch05Selection from "@/data/atmoshaper/signature-sound-dryer-concept-selection.json"
import constructionReview from "@/data/atmoshaper/signature-sound-construction-review.json"
import discoveryReview from "@/data/atmoshaper/signature-sound-review.json"
import { loadDevSignatureDerivedCatalogBatch } from "@/lib/atmoshaper/dev-derived-audio"
import { validateSignatureSoundDerivedAudioBatchRegistry } from "@/lib/atmoshaper/signature-sound-derived-audio-batch-registry"
import {
  validateSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedManifest,
} from "@/lib/atmoshaper/signature-sound-derived-audio"
import { validateSignatureSoundDryerConceptSelection } from "@/lib/atmoshaper/signature-sound-dryer-concept-review"
import {
  validateSignatureSoundEditAuditionBatch,
  validateSignatureSoundEditAuditionManifest,
} from "@/lib/atmoshaper/signature-sound-edit-audition"
import { validateSignatureSoundEditConceptQaSelection } from "@/lib/atmoshaper/signature-sound-edit-concept-review"
import {
  validateSignatureSoundTreatmentAuditionBatch,
  validateSignatureSoundTreatmentAuditionManifest,
} from "@/lib/atmoshaper/signature-sound-treatment-audition"
import { validateSignatureSoundTreatmentConceptQaSelection } from "@/lib/atmoshaper/signature-sound-treatment-concept-review"
import {
  validateSignatureSoundConstructionPlaybackPolicy,
  validateSignatureSoundPreviewSettings,
} from "@/lib/atmoshaper/signature-sound-preview"
import type { DerivedManifest } from "../processing/derived-audio-review"
import type { DryerManifest } from "../processing/dryer-concept-review"
import type { EditManifest, EditPlaybackConfiguration } from "../processing/edit-concept-review"
import type { TreatmentManifest } from "../processing/treatment-audition-review"
import type { PreparedConceptPlaybackEntry } from "./prepared-playback-types"

const EXTERNAL_DIRECTORY_NAMES = {
  [batch02Declaration.batchId]: "batch-02-air-traffic-control",
  [batch03Declaration.batchId]: "batch-03-sci-fi-whistles-treatment-audition-v2",
  [batch04Declaration.batchId]: "batch-04-boiling-water-edit-audition-v2",
  [batch05Declaration.batchId]: "batch-05-dryer-trim-audition",
}

const PROCESSED_CONCEPT_REFS = [
  { batchId: batch02Declaration.batchId, groupId: "signature-extra:air-traffic-control" },
  { batchId: batch03Declaration.batchId, groupId: batch03Declaration.groupId },
  { batchId: batch04Declaration.batchId, groupId: batch04Declaration.groupId },
  { batchId: batch05Declaration.batchId, groupId: "moodist:dryer" },
] as const

const PROCESSED_BATCH_IDS = new Set(PROCESSED_CONCEPT_REFS.map(({ batchId }) => batchId))

/**
 * Loads the same checksum-bound manifests and direct reviewer selections used
 * by the four active processing pages, then projects one final playable
 * concept per batch. No comparison or rejected variant can enter this list.
 */
export async function loadPreparedProcessedPlaybackEntries(
  requestedBatchIds: string[] = [...PROCESSED_BATCH_IDS],
): Promise<PreparedConceptPlaybackEntry[]> {
  const unknownBatchId = requestedBatchIds.find((batchId) => !PROCESSED_BATCH_IDS.has(batchId))
  if (unknownBatchId) throw new Error(`Prepared processed playback batch is unknown: ${unknownBatchId}`)

  const registry = validateSignatureSoundDerivedAudioBatchRegistry(batchRegistry)
  const baseByBatchId = new Map(PROCESSED_CONCEPT_REFS.map((identity) => [
    identity.batchId,
    projectProcessedPlaybackOwner(identity),
  ]))
  const groupById = new Map(constructionReview.groups.map((group) => [group.groupId, group]))
  const derivedBatches = new Map([
    [batch02Declaration.batchId, validateSignatureSoundDerivedAudioBatch(
      batch02Declaration,
      { constructionReview, discoveryReview },
    )],
    [batch05Declaration.batchId, validateSignatureSoundDerivedAudioBatch(
      batch05Declaration,
      { constructionReview, discoveryReview },
    )],
  ])
  const treatmentBatch = validateSignatureSoundTreatmentAuditionBatch(
    batch03Declaration,
    { constructionReview, discoveryReview },
  )
  const editBatch = validateSignatureSoundEditAuditionBatch(
    batch04Declaration,
    { constructionReview, discoveryReview },
  )

  const entries = await Promise.all(requestedBatchIds.map(async (batchId) => {
    const base = baseByBatchId.get(batchId)
    if (!base) throw new Error(`Prepared processed playback owner is missing: ${batchId}`)
    const selected = await loadDevSignatureDerivedCatalogBatch({
      batchId,
      catalogRoot: process.env.ATMOSHAPER_SIGNATURE_DERIVED_CATALOG_ROOT,
      outputRoot: process.env.ATMOSHAPER_SIGNATURE_DERIVED_ROOT,
      batchRegistry: registry,
      manifestEntries: manifestAnchors.entries,
      externalDirectoryNames: EXTERNAL_DIRECTORY_NAMES,
      nodeEnv: process.env.NODE_ENV,
    })

    if (batchId === batch03Declaration.batchId) {
      const manifest = validateSignatureSoundTreatmentAuditionManifest(
        selected.manifest,
        treatmentBatch,
      ) as TreatmentManifest
      const playbackConfiguration = {
        strategyId: base.playbackConfiguration.strategyId,
        previewSettings: base.playbackConfiguration.previewSettings,
      }
      const selection = validateSignatureSoundTreatmentConceptQaSelection(
        committedBatch03Selection,
        { manifest, manifestSha256: selected.manifestEntry.manifestSha256, playbackConfiguration },
      ) as { outputIdentities: string[] }
      const outputByIdentity = new Map(manifest.outputs.map((output) => [output.outputIdentity, output]))
      return {
        ...base,
        reviewFingerprint: selected.manifestEntry.manifestSha256,
        sources: selection.outputIdentities.map((outputIdentity) => {
          const output = outputByIdentity.get(outputIdentity)
          if (!output) throw new Error("Prepared Sci-Fi Whistles selection output is missing")
          const source = base.sources.find(({ sourceId }) => sourceId === output.sourceId)
          if (!source) throw new Error("Prepared Sci-Fi Whistles source owner is missing")
          return {
            ...source,
            audioUrl: derivedAudioUrl(batchId, outputIdentity),
          }
        }),
        runtimePolicy: null,
        sourceSelection: null,
        playbackMode: null,
      } satisfies PreparedConceptPlaybackEntry
    }

    if (batchId === batch04Declaration.batchId) {
      const manifest = validateSignatureSoundEditAuditionManifest(selected.manifest, editBatch) as EditManifest
      const constructionGroup = groupById.get(base.groupId)
      if (!constructionGroup) throw new Error("Prepared Boiling Water construction owner is missing")
      const selection = validateSignatureSoundEditConceptQaSelection(
        committedBatch04Selection,
        {
          manifest,
          manifestSha256: selected.manifestEntry.manifestSha256,
          playbackConfiguration: constructionGroup.playback as EditPlaybackConfiguration,
        },
      ) as { outputIdentity: string }
      const output = manifest.outputs.find(({ outputIdentity }) => outputIdentity === selection.outputIdentity)
      const source = base.sources[0]
      if (!output || !source) throw new Error("Prepared Boiling Water selection output is missing")
      return {
        ...base,
        reviewFingerprint: selected.manifestEntry.manifestSha256,
        sources: [{ ...source, audioUrl: derivedAudioUrl(batchId, output.outputIdentity) }],
        runtimePolicy: null,
        sourceSelection: null,
        playbackMode: {
          kind: "prebaked-intro-loop",
          artifactLoopStartSeconds: output.edit.loopEndSeconds - output.edit.cyclicCrossfadeSeconds,
          firstPassStartSeconds: output.edit.firstPassStartSeconds,
          sourceLoopStartSeconds: output.edit.loopStartSeconds,
          sourceLoopEndSeconds: output.edit.loopEndSeconds,
          crossfadeSeconds: output.edit.cyclicCrossfadeSeconds,
          crossfadeCurve: output.edit.crossfadeCurve,
        },
      } satisfies PreparedConceptPlaybackEntry
    }

    const derivedBatch = derivedBatches.get(batchId)
    if (!derivedBatch) throw new Error(`Prepared derived-audio declaration is missing: ${batchId}`)
    const manifest = validateSignatureSoundDerivedManifest(
      selected.manifest,
      derivedBatch,
    ) as unknown as DerivedManifest

    if (batchId === batch05Declaration.batchId) {
      const selection = validateSignatureSoundDryerConceptSelection(
        committedBatch05Selection,
        {
          manifest: manifest as unknown as DryerManifest,
          manifestSha256: selected.manifestEntry.manifestSha256,
          playbackConfiguration: base.playbackConfiguration,
        },
      ) as { selectedTarget: "dry" | "trimmed"; sourceId: string }
      if (selection.selectedTarget !== "dry") {
        throw new Error("Prepared Dryer playback must preserve the reviewed Dry selection")
      }
      const source = base.sources.find(({ sourceId }) => sourceId === selection.sourceId)
      const dryOutput = manifest.outputs.find(({ sourceId }) => sourceId === selection.sourceId)
      if (!source || !dryOutput) throw new Error("Prepared Dryer source owner is missing")
      return {
        ...base,
        reviewFingerprint: selected.manifestEntry.manifestSha256,
        sources: [{
          ...source,
          audioUrl: `/api/dev/atmoshaper-candidates/audio/${encodeURIComponent(source.sourceId)}`,
          durationSeconds: dryOutput.inputMeasurement.durationSeconds,
        }],
        runtimePolicy: null,
        selectionSummary: "Original Dry source selected; the trimmed comparison is not part of this concept.",
        sourceSelection: null,
        playbackMode: null,
      } satisfies PreparedConceptPlaybackEntry
    }

    return {
      ...base,
      reviewFingerprint: selected.manifestEntry.manifestSha256,
      sources: manifest.outputs.map((output) => {
        const source = base.sources.find(({ sourceId }) => sourceId === output.sourceId)
        if (!source) throw new Error(`Prepared ${base.label} source owner is missing`)
        return {
          ...source,
          audioUrl: derivedAudioUrl(batchId, output.outputIdentity),
        }
      }),
      runtimePolicy: null,
      sourceSelection: null,
      playbackMode: null,
    } satisfies PreparedConceptPlaybackEntry
  }))

  return entries
}

function derivedAudioUrl(batchId: string, outputIdentity: string) {
  return `/api/dev/atmoshaper-candidates/derived/${encodeURIComponent(batchId)}/${encodeURIComponent(outputIdentity)}`
}

/** Projects only raw owner identity and scheduling; terminal manifests replace every audio binding later. */
function projectProcessedPlaybackOwner(identity: { batchId: string; groupId: string }) {
  const group = constructionReview.groups.find(({ groupId }) => groupId === identity.groupId)
  if (!group || group.status !== "active" || group.reviewState !== "needs-rebuild-audition") {
    throw new Error(`Prepared processed playback construction owner is invalid: ${identity.groupId}`)
  }
  const sourceById = new Map(discoveryReview.sources.map((source) => [source.sourceId, source]))
  const sources = group.includedSourceIds.map((sourceId) => {
    const source = sourceById.get(sourceId)
    if (!source) throw new Error(`Prepared processed playback source is unknown: ${sourceId}`)
    return { sourceId, relativePath: source.relativePath }
  })
  const previewSettings = validateSignatureSoundPreviewSettings(
    group.playback.strategyId,
    group.playback.previewSettings,
  )
  const transitionRange = group.playback.constraints.find(
    (constraint) => constraint.type === "transition-duration-range",
  ) as { minimumSeconds: number; maximumSeconds: number } | undefined
  const overlapNextEvent = group.playback.constraints.some(
    (constraint) => constraint.type === "overlap-next-event",
  )
  const constructionPolicy = validateSignatureSoundConstructionPlaybackPolicy(
    group.playback.strategyId,
    previewSettings,
    {
      minimumSelectionsBeforeRepeat: group.playback.minimumSelectionsBeforeRepeat,
      transitionDurationRange: transitionRange
        ? {
            minimumSeconds: transitionRange.minimumSeconds,
            maximumSeconds: transitionRange.maximumSeconds,
          }
        : null,
      cadenceBoundary: null,
      overlapNextEvent,
    },
  )
  return {
    batchId: identity.batchId,
    groupId: identity.groupId,
    label: group.label,
    reviewFingerprint: constructionReview.fingerprints.constructionReviewSha256,
    sources,
    playbackConfiguration: {
      strategyId: group.playback.strategyId,
      previewSettings,
      constructionPolicy,
    },
  }
}
