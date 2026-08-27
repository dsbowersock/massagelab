import { AppPageShell } from "@/components/ui/app-surface"
import curatedReview from "@/data/atmoshaper/signature-sound-listening-review.json"
import discoveryReview from "@/data/atmoshaper/signature-sound-review.json"
import { GroupStrategyReview } from "../group-strategy-review"
import {
  ReviewWorkspaceExportButton,
  SignatureSoundReviewWorkspaceProvider,
} from "../review-workspace-provider"

export default function ConceptReviewPage() {
  return (
    <SignatureSoundReviewWorkspaceProvider discoveryReview={discoveryReview} curatedReview={curatedReview}>
      <AppPageShell width="full" contentClassName="gap-8 pb-24">
        <header className="space-y-3">
          <p className="text-sm font-medium text-primary">Local development · concept review</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Review concept construction</h1>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            Review the exact recordings and dynamic playback behavior for each existing or future concept.
          </p>
          <ReviewWorkspaceExportButton />
        </header>
        <GroupStrategyReview />
      </AppPageShell>
    </SignatureSoundReviewWorkspaceProvider>
  )
}
