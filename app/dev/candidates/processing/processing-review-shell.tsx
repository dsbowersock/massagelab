import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import batch02Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json"
import batch03Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"
import batch04Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json"
import batch05Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-05-dryer-trim-audition.json"
import { DerivedAudioReview, type ArtifactQa, type DerivedManifest } from "./derived-audio-review"
import {
  EditConceptReview,
  type EditConceptQa,
  type EditManifest,
  type EditPlaybackConfiguration,
} from "./edit-concept-review"
import { TreatmentAuditionReview, type TreatmentManifest } from "./treatment-audition-review"
import type { TreatmentConceptQa, TreatmentPlaybackConfiguration } from "./treatment-concept-review"
import {
  DryerConceptReview,
  type DryerManifest,
  type DryerPlaybackConfiguration,
  type DryerConceptSelection,
} from "./dryer-concept-review"
import { ProcessingBatchSelector, ProcessingReviewHeader, type ProcessingBatchOption } from "./processing-review-navigation"
import { RETIRED_PROCESSED_BATCH_IDS } from "./processing-batch-retirement"
import { WholeConceptReview, type WholeConceptReviewCatalog, type WholeConceptReviewEntry } from "./whole-concept-review"
import { PreparedConceptAudition } from "../prepared/prepared-concept-audition"
import type { PreparedConceptPlaybackEntry } from "../prepared/prepared-playback-types"

const BATCH_LABELS: Record<string, string> = {
  [batch02Declaration.batchId]: "Batch 02 · Air Traffic Control levels",
  [batch03Declaration.batchId]: "Batch 03 · Sci-Fi Whistles treatments",
  [batch04Declaration.batchId]: "Batch 04 · Boiling Water trim and loop",
  [batch05Declaration.batchId]: "Batch 05 · Dryer boundary trim",
}

export type LoadedReview = ({
  kind: "derived"
  manifest: DerivedManifest
  manifestSha256: string
  initialQa: ArtifactQa
  sourcePaths: Record<string, string>
  conceptLabel: string
} | {
  kind: "treatment"
  manifest: TreatmentManifest
  manifestSha256: string
  initialQa: ArtifactQa
  initialConceptQa: TreatmentConceptQa
  sourcePaths: Record<string, string>
  conceptLabel: string
  playbackConfiguration: TreatmentPlaybackConfiguration
} | {
  kind: "edit"
  manifest: EditManifest
  manifestSha256: string
  initialQa: EditConceptQa
  sourcePath: string
  conceptLabel: string
  playbackConfiguration: EditPlaybackConfiguration
} | {
  kind: "dryer"
  manifest: DryerManifest
  sourcePath: string
  conceptLabel: string
  playbackConfiguration: DryerPlaybackConfiguration
  selection: DryerConceptSelection
} | {
  kind: "whole-concept"
  entry: WholeConceptReviewEntry
  conceptLabel: string
  conceptIndex: number
  conceptCount: number
  previousBatchId: string | null
  nextBatchId: string | null
}) & { finalConceptPlayback?: PreparedConceptPlaybackEntry }

/** Renders the common selector and the exact review client selected by the server loader. */
export function renderProcessingReview({ registry, wholeConceptCatalog, selectedBatchId, loaded }: {
  registry: { entries: Array<{ batchId: string }> }
  wholeConceptCatalog: WholeConceptReviewCatalog
  selectedBatchId: string | null
  loaded: LoadedReview | null
}) {
  const activeProcessedBatches = registry.entries.filter(
    ({ batchId }) => !RETIRED_PROCESSED_BATCH_IDS.has(batchId),
  )
  const batches: ProcessingBatchOption[] = [
    ...activeProcessedBatches.map((entry) => ({
      batchId: entry.batchId,
      label: BATCH_LABELS[entry.batchId] ?? entry.batchId,
      kind: "processed" as const,
    })),
    ...wholeConceptCatalog.entries.map((entry) => ({
      batchId: entry.batchId,
      label: `Batch ${entry.batchId.slice(6, 8)} · ${entry.label}${
        entry.chatOutcome?.decision === "pass"
          ? " — Pass"
          : entry.reviewState === "processing-required"
            ? " — processing needed"
            : entry.reviewState === "insufficient-sources"
              ? " — production hold"
              : entry.amendment
                ? " — revised"
                : entry.revision?.state === "needs-timing"
            ? " — timing needed"
            : entry.revision?.state === "ready-to-audition"
              ? " — revised"
              : ""
      }`,
      kind: "concept" as const,
    })),
  ]
  return (
    <AppPageShell width="full" contentClassName="gap-8 pb-24">
      <ProcessingReviewHeader conceptLabel={loaded?.conceptLabel} wholeConcept={loaded?.kind === "whole-concept"} />
      <ProcessingBatchSelector batches={batches} selectedBatchId={selectedBatchId} baseHref="/dev/candidates/processing?batch=" />
      {loaded?.finalConceptPlayback ? (
        <AppSurface
          title={`${loaded.finalConceptPlayback.label} · final whole-concept audition`}
          description="This is the exact prepared concept as a listener will hear it. The detailed source and comparison review remains below."
          variant="inset"
        >
          <PreparedConceptAudition entry={loaded.finalConceptPlayback} detailed />
        </AppSurface>
      ) : null}
      {loaded?.kind === "derived" ? (
        <DerivedAudioReview
          manifest={loaded.manifest}
          manifestSha256={loaded.manifestSha256}
          initialQa={loaded.initialQa}
          sourcePaths={loaded.sourcePaths}
          conceptLabel={loaded.conceptLabel}
        />
      ) : loaded?.kind === "treatment" ? (
        <TreatmentAuditionReview
          manifest={loaded.manifest}
          manifestSha256={loaded.manifestSha256}
          initialQa={loaded.initialQa}
          initialConceptQa={loaded.initialConceptQa}
          sourcePaths={loaded.sourcePaths}
          conceptLabel={loaded.conceptLabel}
          playbackConfiguration={loaded.playbackConfiguration}
        />
      ) : loaded?.kind === "edit" ? (
        <EditConceptReview
          manifest={loaded.manifest}
          manifestSha256={loaded.manifestSha256}
          initialQa={loaded.initialQa}
          sourcePath={loaded.sourcePath}
          conceptLabel={loaded.conceptLabel}
          playbackConfiguration={loaded.playbackConfiguration}
        />
      ) : loaded?.kind === "dryer" ? (
        <DryerConceptReview
          manifest={loaded.manifest}
          sourcePath={loaded.sourcePath}
          conceptLabel={loaded.conceptLabel}
          playbackConfiguration={loaded.playbackConfiguration}
          selection={loaded.selection}
        />
      ) : loaded?.kind === "whole-concept" ? (
        <WholeConceptReview
          key={loaded.entry.reviewFingerprint}
          entry={loaded.entry}
          batchPosition={activeProcessedBatches.length + loaded.conceptIndex + 1}
          batchCount={batches.length}
          conceptPosition={loaded.conceptIndex + 1}
          conceptCount={loaded.conceptCount}
          previousBatchId={loaded.previousBatchId}
          nextBatchId={loaded.nextBatchId}
        />
      ) : (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          The selected review batch is unavailable. Check the batch link and local development audio configuration,
          then try again.
        </p>
      )}
    </AppPageShell>
  )
}
