import batch01Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batches.json"
import batch02Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json"
import batch03Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"
import batch04Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json"
import batch05Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-05-dryer-trim-audition.json"
import batchRegistry from "@/data/atmoshaper/signature-sound-derived-audio-batch-registry.json"
import manifestAnchors from "@/data/atmoshaper/signature-sound-derived-audio-manifests.json"
import committedBatch01Qa from "@/data/atmoshaper/signature-sound-derived-audio-qa.json"
import committedBatch02Qa from "@/data/atmoshaper/signature-sound-derived-audio-qa-batch-02-air-traffic-control.json"
import committedBatch03ConceptQaSelection from "@/data/atmoshaper/signature-sound-treatment-concept-qa-batch-03-sci-fi-whistles.json"
import committedBatch04ConceptQaSelection from "@/data/atmoshaper/signature-sound-edit-concept-qa-batch-04-boiling-water.json"
import committedDryerConceptSelection from "@/data/atmoshaper/signature-sound-dryer-concept-selection.json"
import committedWholeConceptOutcomes from "@/data/atmoshaper/signature-sound-whole-concept-chat-outcomes.json"
import catalogExpansionReview from "@/data/atmoshaper/signature-sound-catalog-expansion-review.json"
import wholeConceptStageFinalizations from "@/data/atmoshaper/signature-sound-whole-concept-stage-finalizations.json"
import wholeConceptAmendments from "@/data/atmoshaper/signature-sound-whole-concept-review-amendments.json"
import wholeConceptBatches from "@/data/atmoshaper/signature-sound-whole-concept-review-batches.json"
import wholeConceptRevisions from "@/data/atmoshaper/signature-sound-whole-concept-review-revisions.json"
import constructionReview from "@/data/atmoshaper/signature-sound-construction-review.json"
import discoveryReview from "@/data/atmoshaper/signature-sound-review.json"
import speechReductionDeclaration from "@/data/atmoshaper/signature-sound-speech-reduction-auditions.json"
import retainedSpeechReductionDeclaration from "@/data/atmoshaper/signature-sound-speech-reduction-auditions-v1.json"
import { join } from "node:path"
import {
  loadDevSignatureDerivedCatalogBatch,
  loadDevSignatureDerivedManifestSnapshot,
} from "@/lib/atmoshaper/dev-derived-audio"
import { applyDevSignatureSoundSpeechReductionReview } from "@/lib/atmoshaper/dev-speech-reduction-review"
import { composeDevSignatureSoundReviewCatalog } from "@/lib/atmoshaper/dev-signature-review-catalog"
import {
  validateSignatureSoundDerivedAudioBatchRegistry,
  selectSignatureSoundDerivedAudioBatchEntry,
} from "@/lib/atmoshaper/signature-sound-derived-audio-batch-registry"
import {
  createSignatureSoundDerivedAudioQaDraft,
  validateSignatureSoundDerivedAudioQa,
} from "@/lib/atmoshaper/signature-sound-derived-audio-qa"
import {
  validateSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedManifest,
} from "@/lib/atmoshaper/signature-sound-derived-audio"
import {
  validateSignatureSoundEditAuditionBatch,
  validateSignatureSoundEditAuditionManifest,
} from "@/lib/atmoshaper/signature-sound-edit-audition"
import {
  applySignatureSoundEditConceptQaSelection,
  createSignatureSoundEditConceptQaDraft,
} from "@/lib/atmoshaper/signature-sound-edit-concept-review"
import {
  validateSignatureSoundTreatmentAuditionBatch,
  validateSignatureSoundTreatmentAuditionManifest,
} from "@/lib/atmoshaper/signature-sound-treatment-audition"
import {
  applySignatureSoundTreatmentConceptQaSelection,
  createSignatureSoundTreatmentConceptQaDraft,
} from "@/lib/atmoshaper/signature-sound-treatment-concept-review"
import { validateSignatureSoundDryerConceptSelection } from "@/lib/atmoshaper/signature-sound-dryer-concept-review"
import { validateSignatureSoundWholeConceptReviewCatalog } from "@/lib/atmoshaper/signature-sound-whole-concept-review"
import { applySignatureSoundWholeConceptReviewAmendments } from "@/lib/atmoshaper/signature-sound-whole-concept-amendment"
import { applySignatureSoundWholeConceptReviewRevisions } from "@/lib/atmoshaper/signature-sound-whole-concept-revision"
import type { ArtifactQa, DerivedManifest } from "./derived-audio-review"
import { type EditConceptQa, type EditManifest, type EditPlaybackConfiguration } from "./edit-concept-review"
import type { TreatmentManifest } from "./treatment-audition-review"
import type { TreatmentConceptQa, TreatmentPlaybackConfiguration } from "./treatment-concept-review"
import { type DryerManifest, type DryerPlaybackConfiguration, type DryerConceptSelection } from "./dryer-concept-review"
import { renderProcessingReview, type LoadedReview } from "./processing-review-shell"
import type { WholeConceptReviewCatalog } from "./whole-concept-review"
import { redirectRetiredProcessingBatch } from "./processing-batch-retirement"
import { loadPreparedProcessedPlaybackEntries } from "../prepared/load-processed-playback"
const EXTERNAL_DIRECTORY_NAMES = {
  [batch01Declaration.batchId]: "batch-01-campfire-boiling-water",
  [batch02Declaration.batchId]: "batch-02-air-traffic-control",
  [batch03Declaration.batchId]: "batch-03-sci-fi-whistles-treatment-audition-v2",
  [batch04Declaration.batchId]: "batch-04-boiling-water-edit-audition-v2",
  [batch05Declaration.batchId]: "batch-05-dryer-trim-audition",
}
const TERMINAL_CATALOG_REVIEW_STATES = new Set([
  "audible-qa-passed",
  "audible-qa-complete-dry-selected",
])
type ProcessingReviewPageProps = { searchParams: Promise<{ batch?: string | string[] }> }
/** Loads one selected processed or raw-concept review; audio stays behind development-only routes. */
export default async function ProcessingReviewPage({ searchParams }: ProcessingReviewPageProps) {
  const registry = validateSignatureSoundDerivedAudioBatchRegistry(batchRegistry)
  const baseWholeConceptCatalog = validateSignatureSoundWholeConceptReviewCatalog(
    wholeConceptBatches,
    { constructionReview, discoveryReview },
  )
  const revisedWholeConceptCatalog = applySignatureSoundWholeConceptReviewRevisions(
    baseWholeConceptCatalog,
    wholeConceptRevisions,
  ) as unknown as WholeConceptReviewCatalog
  const amendedWholeConceptCatalog = applySignatureSoundWholeConceptReviewAmendments(
    revisedWholeConceptCatalog,
    wholeConceptAmendments,
  ) as unknown as WholeConceptReviewCatalog
  const auditionableWholeConceptCatalog = await applyDevSignatureSoundSpeechReductionReview({
    catalog: amendedWholeConceptCatalog,
    rawDeclaration: speechReductionDeclaration,
    retainedRawDeclaration: retainedSpeechReductionDeclaration,
    discoveryReview,
    anchorPath: join(process.cwd(), "data/atmoshaper/signature-sound-speech-reduction-review-anchor.json"),
    trafficAnchorPath: join(process.cwd(), "data/atmoshaper/signature-sound-speech-reduction-traffic-review-anchor.json"),
    outputRoot: process.env.ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_ROOT,
    trafficOutputRoot: process.env.ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_TRAFFIC_ROOT,
    nodeEnv: process.env.NODE_ENV,
  }) as unknown as WholeConceptReviewCatalog
  const wholeConceptCatalog = composeDevSignatureSoundReviewCatalog({
    catalog: auditionableWholeConceptCatalog,
    stageFinalizations: wholeConceptStageFinalizations,
    outcomes: committedWholeConceptOutcomes,
    expansionReview: catalogExpansionReview,
    discoveryReview,
  }) as unknown as WholeConceptReviewCatalog
  const rawBatch = (await searchParams).batch
  redirectRetiredProcessingBatch(rawBatch)
  const catalogRoot = process.env.ATMOSHAPER_SIGNATURE_DERIVED_CATALOG_ROOT
  const outputRoot = process.env.ATMOSHAPER_SIGNATURE_DERIVED_ROOT
  const pendingCatalogEntry = manifestAnchors.entries.find((entry) => !TERMINAL_CATALOG_REVIEW_STATES.has(entry.state))
  const firstPendingWholeConcept = wholeConceptCatalog.entries.find(
    (entry) => entry.chatOutcome?.decision !== "pass",
  )
  const defaultCatalogBatchId = pendingCatalogEntry
    ? pendingCatalogEntry.batchId
    : (firstPendingWholeConcept ?? wholeConceptCatalog.entries[0]).batchId
  let selectedBatchId = typeof rawBatch === "string"
    ? rawBatch
    : rawBatch === undefined && (catalogRoot || !pendingCatalogEntry)
      ? defaultCatalogBatchId
      : null
  const redirect = wholeConceptCatalog.redirects?.find(({ batchId }) => batchId === selectedBatchId)
  if (redirect) selectedBatchId = redirect.targetBatchId
  const wholeConceptIndex = wholeConceptCatalog.entries.findIndex((entry) => entry.batchId === selectedBatchId)
  let loaded: LoadedReview | null = null
  try {
    if (wholeConceptIndex >= 0) {
      const entry = wholeConceptCatalog.entries[wholeConceptIndex]
      loaded = {
        kind: "whole-concept",
        entry,
        conceptLabel: entry.label,
        conceptIndex: wholeConceptIndex,
        conceptCount: wholeConceptCatalog.entries.length,
        previousBatchId: wholeConceptCatalog.entries[wholeConceptIndex - 1]?.batchId ?? null,
        nextBatchId: wholeConceptCatalog.entries[wholeConceptIndex + 1]?.batchId ?? null,
      }
      return renderProcessingReview({ registry, wholeConceptCatalog, selectedBatchId, loaded })
    }
    const batches = [batch01Declaration, batch02Declaration, batch05Declaration].map((declaration) => (
      validateSignatureSoundDerivedAudioBatch(declaration, { constructionReview, discoveryReview })
    ))
    const treatmentBatch = validateSignatureSoundTreatmentAuditionBatch(batch03Declaration, {
      constructionReview,
      discoveryReview,
    })
    const editBatch = validateSignatureSoundEditAuditionBatch(batch04Declaration, {
      constructionReview,
      discoveryReview,
    })

    let snapshot
    if (!catalogRoot && rawBatch === undefined) {
      // Compatibility: an existing single-batch root still self-selects by its one matching checksum anchor.
      snapshot = await loadDevSignatureDerivedManifestSnapshot({
        outputRoot,
        manifestEntries: manifestAnchors.entries,
        nodeEnv: process.env.NODE_ENV,
      })
      selectedBatchId = selectSignatureSoundDerivedAudioBatchEntry(
        registry,
        snapshot.manifestEntry.batchId,
      ).batchId
    } else {
      const selectedEntry = selectSignatureSoundDerivedAudioBatchEntry(
        registry,
        typeof rawBatch === "string"
          ? rawBatch
          : rawBatch === undefined
            ? defaultCatalogBatchId
            : "invalid-repeated-batch-query",
      )
      const selected = await loadDevSignatureDerivedCatalogBatch({
        batchId: selectedEntry.batchId,
        catalogRoot,
        outputRoot,
        batchRegistry: registry,
        manifestEntries: manifestAnchors.entries,
        externalDirectoryNames: EXTERNAL_DIRECTORY_NAMES,
        nodeEnv: process.env.NODE_ENV,
      })
      snapshot = { manifest: selected.manifest, manifestEntry: selected.manifestEntry }
      selectedBatchId = selected.batchId
    }

    if (!selectedBatchId) throw new Error("Processed playback batch selection is missing")
    const [finalConceptPlayback] = await loadPreparedProcessedPlaybackEntries([selectedBatchId])
    const sourcePaths = Object.fromEntries(discoveryReview.sources.map((source) => [source.sourceId, source.relativePath]))
    if (snapshot.manifestEntry.batchDeclarationSha256 === treatmentBatch.batchDeclarationSha256) {
      const manifest = validateSignatureSoundTreatmentAuditionManifest(snapshot.manifest, treatmentBatch) as TreatmentManifest
      const initialQa = createSignatureSoundDerivedAudioQaDraft({
        manifest,
        manifestSha256: snapshot.manifestEntry.manifestSha256,
      }) as ArtifactQa
      const constructionGroup = constructionReview.groups.find((group) => group.groupId === manifest.groupId)
      if (!constructionGroup) throw new Error("Treatment construction group is missing")
      const conceptLabel = constructionGroup.label
      const playbackConfiguration = {
        strategyId: constructionGroup.playback.strategyId,
        previewSettings: constructionGroup.playback.previewSettings,
      } as TreatmentPlaybackConfiguration
      const conceptQaDraft = createSignatureSoundTreatmentConceptQaDraft({
        manifest,
        manifestSha256: snapshot.manifestEntry.manifestSha256,
        playbackConfiguration,
        updatedAt: "1970-01-01T00:00:00.000Z",
      })
      const initialConceptQa = applySignatureSoundTreatmentConceptQaSelection(
        conceptQaDraft,
        committedBatch03ConceptQaSelection,
        { manifest, manifestSha256: snapshot.manifestEntry.manifestSha256, playbackConfiguration },
      ) as TreatmentConceptQa
      loaded = {
        kind: "treatment",
        manifest,
        manifestSha256: snapshot.manifestEntry.manifestSha256,
        initialQa,
        initialConceptQa,
        sourcePaths,
        conceptLabel,
        playbackConfiguration,
        finalConceptPlayback,
      }
    } else if (snapshot.manifestEntry.batchDeclarationSha256 === editBatch.batchDeclarationSha256) {
      const manifest = validateSignatureSoundEditAuditionManifest(snapshot.manifest, editBatch) as EditManifest
      const constructionGroup = constructionReview.groups.find((group) => group.groupId === manifest.groupId)
      if (!constructionGroup) throw new Error("Edit construction group is missing")
      const playbackConfiguration = constructionGroup.playback as EditPlaybackConfiguration
      const qaContext = { manifest, manifestSha256: snapshot.manifestEntry.manifestSha256, playbackConfiguration }
      const qaDraft = createSignatureSoundEditConceptQaDraft({
        ...qaContext,
        updatedAt: "1970-01-01T00:00:00.000Z",
      })
      const initialQa = applySignatureSoundEditConceptQaSelection(
        qaDraft,
        committedBatch04ConceptQaSelection,
        qaContext,
      ) as EditConceptQa
      const sourceId = manifest.outputs[0].sourceId
      loaded = {
        kind: "edit",
        manifest,
        manifestSha256: snapshot.manifestEntry.manifestSha256,
        initialQa,
        sourcePath: sourcePaths[sourceId] ?? sourceId,
        conceptLabel: constructionGroup.label,
        playbackConfiguration,
        finalConceptPlayback,
      }
    } else {
      const batch = batches.find((candidate) => candidate.batchDeclarationSha256 === snapshot.manifestEntry.batchDeclarationSha256)
      if (!batch) throw new Error("Derived-audio batch declaration is missing")
      const manifest = validateSignatureSoundDerivedManifest(snapshot.manifest, batch) as unknown as DerivedManifest
      const constructionGroup = constructionReview.groups.find((group) => group.groupId === manifest.groupId)
      if (!constructionGroup) throw new Error("Derived-audio construction group is missing")
      if (manifest.groupId === "moodist:dryer") {
        const transitionDurationRange = constructionGroup.playback.constraints.find(
          (constraint) => constraint.type === "transition-duration-range"
            && "minimumSeconds" in constraint
            && "maximumSeconds" in constraint,
        ) as { type: string; minimumSeconds: number; maximumSeconds: number } | undefined
        if (!transitionDurationRange) throw new Error("Dryer transition policy is missing")
        const dryerManifest = manifest as unknown as DryerManifest
        const playbackConfiguration = {
          strategyId: constructionGroup.playback.strategyId,
          previewSettings: constructionGroup.playback.previewSettings,
          constructionPolicy: {
            minimumSelectionsBeforeRepeat: constructionGroup.playback.minimumSelectionsBeforeRepeat,
            transitionDurationRange: {
              minimumSeconds: transitionDurationRange.minimumSeconds,
              maximumSeconds: transitionDurationRange.maximumSeconds,
            },
            cadenceBoundary: null,
            overlapNextEvent: false,
          },
        } as DryerPlaybackConfiguration
        const selection = validateSignatureSoundDryerConceptSelection(
          committedDryerConceptSelection,
          { manifest: dryerManifest, manifestSha256: snapshot.manifestEntry.manifestSha256, playbackConfiguration },
        ) as DryerConceptSelection
        loaded = {
          kind: "dryer",
          manifest: dryerManifest,
          sourcePath: sourcePaths[manifest.outputs[0].sourceId] ?? manifest.outputs[0].sourceId,
          conceptLabel: constructionGroup.label,
          playbackConfiguration,
          selection,
          finalConceptPlayback,
        }
        return renderProcessingReview({ registry, wholeConceptCatalog, selectedBatchId, loaded })
      }
      const committedQas = [committedBatch01Qa, committedBatch02Qa]
      const committedQa = committedQas.find((candidate) => candidate.batchDeclarationSha256 === batch.batchDeclarationSha256)
      const initialQa = (committedQa
        ? validateSignatureSoundDerivedAudioQa(committedQa, {
            manifest,
            manifestSha256: snapshot.manifestEntry.manifestSha256,
            requireComplete: true,
          })
        : createSignatureSoundDerivedAudioQaDraft({
            manifest,
            manifestSha256: snapshot.manifestEntry.manifestSha256,
          })) as ArtifactQa
      loaded = {
        kind: "derived",
        manifest,
        manifestSha256: snapshot.manifestEntry.manifestSha256,
        initialQa,
        sourcePaths,
        conceptLabel: constructionGroup.label,
        finalConceptPlayback,
      }
    }
  } catch {
    // Render the recovery state below so React errors are not mistaken for data-loading failures.
  }

  return renderProcessingReview({ registry, wholeConceptCatalog, selectedBatchId, loaded })
}
