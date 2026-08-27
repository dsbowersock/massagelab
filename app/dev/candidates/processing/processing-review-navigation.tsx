export type ProcessingBatchOption = {
  batchId: string
  label: string
  kind: "processed" | "concept"
}

/** Keeps the retained processed and raw-concept batches in one compact navigation surface. */
export function ProcessingBatchSelector({ batches, selectedBatchId, baseHref = "/dev/candidates/processing?batch=" }: {
  batches: ProcessingBatchOption[]
  selectedBatchId: string | null
  baseHref?: string
}) {
  const conceptBatches = batches.filter(({ kind }) => kind === "concept")
  return (
    <nav aria-label="Processed-audio and concept review batches" className="space-y-4 rounded-xl border bg-card p-4">
      <p className="text-sm leading-6 text-muted-foreground">
        {conceptBatches.length} surviving concepts are tracked here. Revised concepts can play when the requested
        policy is truthful; processing-gated concepts remain visible with playback disabled until their treated
        audio exists, and production holds stay visible without being called production-ready.
      </p>
      <form action={baseHref.split("?")[0]} method="get" className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 space-y-1 text-sm font-medium">
          Concept review queue
          <select
            name="batch"
            defaultValue={batches.some(({ batchId }) => batchId === selectedBatchId)
              ? selectedBatchId ?? undefined
              : batches[0]?.batchId}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 font-normal"
          >
            {batches.map((batch) => (
              <option key={batch.batchId} value={batch.batchId}>{batch.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">
          Open review
        </button>
      </form>
    </nav>
  )
}

/** Describes the selected review mode without implying publication or unheard approval. */
export function ProcessingReviewHeader({ conceptLabel, wholeConcept = false }: {
  conceptLabel?: string
  wholeConcept?: boolean
}) {
  return (
    <header className="space-y-3">
      <p className="text-sm font-medium text-primary">
        Local development · {wholeConcept ? "complete concept review" : "processed artifact QA"}
      </p>
      <h1 className="text-3xl font-semibold sm:text-4xl">
        {wholeConcept
          ? `Review the complete ${conceptLabel ?? "raw"} concept`
          : `Compare source and processed ${conceptLabel ?? "derived"} audio`}
      </h1>
      <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
        {wholeConcept
          ? "These players use the exact current source pool and reviewed playback policy, including reviewer amendments shown on the concept. Processing-gated concepts remain visible without substituting unchanged raw audio. Review decisions stay in chat."
          : "These are checksum-bound lossless outputs. Exploratory variants are labeled separately from final processing. Passing here approves only the exact artifact you heard; it does not publish the sound or complete production qualification."}
      </p>
    </header>
  )
}
