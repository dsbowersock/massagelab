import Link from "next/link"
import { join } from "node:path"

import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import moodistConcepts from "@/data/atmoshaper/moodist-concepts.json"
import batch02Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json"
import batch03Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"
import batch04Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json"
import batch05Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-05-dryer-trim-audition.json"
import manifestAnchors from "@/data/atmoshaper/signature-sound-derived-audio-manifests.json"
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
import { applyDevSignatureSoundSpeechReductionReview } from "@/lib/atmoshaper/dev-speech-reduction-review"
import { composeDevSignatureSoundReviewCatalog } from "@/lib/atmoshaper/dev-signature-review-catalog"
import { buildAtmoShaperPreparedConceptCatalog } from "@/lib/atmoshaper/signature-sound-prepared-concepts"
import { validateSignatureSoundWholeConceptReviewCatalog } from "@/lib/atmoshaper/signature-sound-whole-concept-review"
import { applySignatureSoundWholeConceptReviewAmendments } from "@/lib/atmoshaper/signature-sound-whole-concept-amendment"
import { applySignatureSoundWholeConceptReviewRevisions } from "@/lib/atmoshaper/signature-sound-whole-concept-revision"
import { loadPreparedProcessedPlaybackEntries } from "./load-processed-playback"
import { PreparedConceptAudition } from "./prepared-concept-audition"
import type { PreparedConceptPlaybackEntry } from "./prepared-playback-types"
import type { WholeConceptReviewCatalog } from "../processing/whole-concept-review"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS = {
  animals: "Animals",
  nature: "Nature",
  noise: "Noise",
  places: "Places",
  rain: "Rain",
  things: "Things",
  transport: "Transport",
  urban: "Urban",
} as const

const PROCESSED_CONCEPT_REFS = [
  { batchId: batch02Declaration.batchId, groupId: "signature-extra:air-traffic-control" },
  { batchId: batch03Declaration.batchId, groupId: batch03Declaration.groupId },
  { batchId: batch04Declaration.batchId, groupId: batch04Declaration.groupId },
  { batchId: batch05Declaration.batchId, groupId: "moodist:dryer" },
]

/** Shows exact reviewed handoffs and the canonical recording backlog without changing catalog state. */
export default async function PreparedConceptsPage() {
  const processedPlaybackPromise = loadPreparedProcessedPlaybackEntries()
  const baseCatalog = validateSignatureSoundWholeConceptReviewCatalog(
    wholeConceptBatches,
    { constructionReview, discoveryReview },
  )
  const revisedCatalog = applySignatureSoundWholeConceptReviewRevisions(
    baseCatalog,
    wholeConceptRevisions,
  )
  const amendedCatalog = applySignatureSoundWholeConceptReviewAmendments(
    revisedCatalog,
    wholeConceptAmendments,
  )
  const auditionableCatalog = await applyDevSignatureSoundSpeechReductionReview({
    catalog: amendedCatalog,
    rawDeclaration: speechReductionDeclaration,
    retainedRawDeclaration: retainedSpeechReductionDeclaration,
    discoveryReview,
    anchorPath: join(process.cwd(), "data/atmoshaper/signature-sound-speech-reduction-review-anchor.json"),
    trafficAnchorPath: join(process.cwd(), "data/atmoshaper/signature-sound-speech-reduction-traffic-review-anchor.json"),
    outputRoot: process.env.ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_ROOT,
    trafficOutputRoot: process.env.ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_TRAFFIC_ROOT,
    nodeEnv: process.env.NODE_ENV,
  })
  const wholeConceptCatalog = composeDevSignatureSoundReviewCatalog({
    catalog: auditionableCatalog,
    stageFinalizations: wholeConceptStageFinalizations,
    outcomes: committedWholeConceptOutcomes,
    expansionReview: catalogExpansionReview,
    discoveryReview,
  }) as unknown as WholeConceptReviewCatalog
  const constructionByGroupId = new Map(
    constructionReview.groups.map((group) => [group.groupId, group]),
  )
  const terminalManifestByBatchId = new Map(
    manifestAnchors.entries.map((entry) => [entry.batchId, entry]),
  )
  const processedEntries = PROCESSED_CONCEPT_REFS.map(({ batchId, groupId }) => {
    const group = constructionByGroupId.get(groupId)
    const manifest = terminalManifestByBatchId.get(batchId)
    if (!group || !manifest) throw new Error(`Prepared concept evidence is missing for ${batchId}`)
    return {
      batchId,
      groupId,
      label: group.label,
      sourceCount: group.includedSourceIds.length,
      reviewState: manifest.state,
      reviewFingerprint: manifest.manifestSha256,
    }
  })
  const catalog = buildAtmoShaperPreparedConceptCatalog({
    moodistConcepts,
    constructionGroups: constructionReview.groups,
    reviewEntries: wholeConceptCatalog.entries,
    processedEntries,
  })
  const processedPlaybackEntries = await processedPlaybackPromise
  const dynamicPlaybackEntries = wholeConceptCatalog.entries
    .filter((entry) => entry.chatOutcome?.decision === "pass")
    .map((entry) => ({
      batchId: entry.batchId,
      groupId: entry.groupId,
      label: entry.label,
      reviewFingerprint: entry.reviewFingerprint,
      sources: entry.sources.map((source) => ({
        ...source,
        audioUrl: source.audioUrl ?? `/api/dev/atmoshaper-candidates/audio/${encodeURIComponent(source.sourceId)}`,
      })),
      playbackConfiguration: entry.playbackConfiguration,
      runtimePolicy: entry.runtimePolicy ?? null,
      sourceSelection: entry.sourceSelection ?? null,
      playbackMode: null,
    })) as PreparedConceptPlaybackEntry[]
  const playbackByGroupId = new Map(
    [...processedPlaybackEntries, ...dynamicPlaybackEntries].map((entry) => [entry.groupId, entry]),
  )
  for (const concept of catalog.preparedConcepts) {
    if (!playbackByGroupId.has(concept.groupId)) {
      throw new Error(`Prepared concept playback is missing for ${concept.groupId}`)
    }
  }
  const recordingNeedsByCategory = Object.entries(CATEGORY_LABELS).map(([category, label]) => ({
    category,
    label,
    concepts: catalog.recordingNeeds.filter((concept) => concept.category === category),
  })).filter(({ concepts }) => concepts.length > 0)

  return (
    <AppPageShell width="full" contentClassName="gap-8 pb-24">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Local development · AtmoShaper handoff</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Prepared AtmoShaper concepts</h1>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          This page is the current handoff snapshot: exact processed concepts and fingerprint-bound dynamic setups
          that passed listening review, followed by the Moodist concepts that still need a usable recording.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Prepared concept summary">
        <SummaryTile label="Prepared concepts" value={catalog.summary.preparedCount} />
        <SummaryTile label="Processed audio" value={catalog.summary.processedAudioCount} />
        <SummaryTile label="Reviewed dynamic setups" value={catalog.summary.dynamicSetupCount} />
        <SummaryTile label="Moodist recordings needed" value={catalog.summary.recordingNeedCount} />
      </section>

      <AppSurface
        title={`Prepared concepts (${catalog.summary.preparedCount})`}
        description="These are ready for AtmoShaper implementation. A Pass applies only to the exact reviewed fingerprint linked in each row."
        variant="inset"
        contentClassName="gap-3"
      >
        <div className="space-y-3 md:hidden">
          {catalog.preparedConcepts.map((concept) => (
            <article key={concept.groupId} className="rounded-lg border bg-background/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold leading-5">{concept.label}</h2>
                <div className="flex shrink-0 items-center gap-2">
                  <PreparedConceptAudition entry={playbackByGroupId.get(concept.groupId)!} />
                  <Link
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href={concept.reviewHref}
                  >
                    Review B{concept.batchId.slice(6, 8)}
                  </Link>
                </div>
              </div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                {concept.origin === "moodist" ? "Moodist base" : "Signature addition"}
                {" · "}
                {concept.handoffKind === "processed-audio" ? "Processed audio" : "Reviewed dynamic setup"}
                {" · "}
                {concept.sourceCount} {concept.sourceCount === 1 ? "source" : "sources"}
              </p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Concept</th>
                <th className="px-4 py-3 font-medium">Origin</th>
                <th className="px-4 py-3 font-medium">Prepared handoff</th>
                <th className="px-4 py-3 text-right font-medium">Sources</th>
                <th className="px-4 py-3 font-medium">Listen / review</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {catalog.preparedConcepts.map((concept) => (
                <tr key={concept.groupId} className="bg-background/60 align-top">
                  <td className="px-4 py-3 font-medium">{concept.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {concept.origin === "moodist" ? "Moodist base" : "Signature addition"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {concept.handoffKind === "processed-audio" ? "Processed audio" : "Reviewed dynamic setup"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{concept.sourceCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PreparedConceptAudition entry={playbackByGroupId.get(concept.groupId)!} />
                      <Link className="font-medium text-primary underline-offset-4 hover:underline" href={concept.reviewHref}>
                        Review B{concept.batchId.slice(6, 8)}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppSurface>

      <AppSurface
        title={`Moodist recordings still needed (${catalog.summary.recordingNeedCount})`}
        description="These canonical Moodist concepts have no usable included recording in the current construction catalog. Concepts that already have recordings but still need rebuilding are intentionally excluded."
        variant="inset"
      >
        <div className="grid gap-x-8 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
          {recordingNeedsByCategory.map(({ category, label, concepts }) => (
            <section key={category} aria-labelledby={`recording-category-${category}`}>
              <h2 id={`recording-category-${category}`} className="border-b pb-2 text-lg font-semibold">
                {label} <span className="text-sm font-normal text-muted-foreground">({concepts.length})</span>
              </h2>
              <ul className="divide-y">
                {concepts.map((concept) => (
                  <li key={concept.id} className="py-2.5">
                    <p className="font-medium">{concept.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {concept.reason === "no-usable-recording"
                        ? "Earlier candidates exist, but no usable recording was kept."
                        : "No candidate recording is represented in the current construction catalog."}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </AppSurface>

      <AppSurface
        title="Generated noise does not need recording"
        description={`${catalog.summary.nativeGeneratedCount} Moodist noise concepts are generated by the app and are not part of the recording backlog.`}
        variant="flat"
      >
        <p className="text-sm text-muted-foreground">
          {catalog.nativeGeneratedConcepts.map(({ label }) => label).join(", ")}.
        </p>
      </AppSurface>
    </AppPageShell>
  )
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
