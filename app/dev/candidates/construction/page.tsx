import { AppPageShell } from "@/components/ui/app-surface"
import constructionAudition from "@/data/atmoshaper/signature-sound-construction-audition.json"
import discoveryReview from "@/data/atmoshaper/signature-sound-review.json"
import {
  ConstructionAuditionReview,
  type ConstructionAudition,
} from "./construction-audition-review"

/** Joins the owner-verified browser projection to exact source labels. */
export default function ConstructionReviewPage() {
  const audition = constructionAudition as unknown as ConstructionAudition
  const sourceById = new Map(discoveryReview.sources.map((source) => [source.sourceId, source]))
  const sources = Object.fromEntries(
    [...new Set(audition.groups.flatMap((group) => group.includedSourceIds))].map((sourceId) => {
      const source = sourceById.get(sourceId)
      if (!source) throw new Error(`Construction audition source is missing: ${sourceId}`)
      return [sourceId, { sourceId, relativePath: source.relativePath }]
    }),
  )

  return (
    <AppPageShell width="full" contentClassName="gap-8 pb-24">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Local development · construction audition</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Audition rebuilt concept behavior</h1>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Hear the implemented spacing, repeat, cadence, transition, and overlap rules. Playback judgments remain
          separate from pending trimming, level, speech, and effects work.
        </p>
      </header>
      <ConstructionAuditionReview audition={audition} sources={sources} />
    </AppPageShell>
  )
}
