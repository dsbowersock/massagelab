import { AppPageShell } from "@/components/ui/app-surface"
import curatedReview from "@/data/atmoshaper/signature-sound-listening-review.json"
import discoveryReview from "@/data/atmoshaper/signature-sound-review.json"
import { CandidateReview } from "../candidate-review"
import {
  ReviewWorkspaceExportButton,
  SignatureSoundReviewWorkspaceProvider,
} from "../review-workspace-provider"

export default function RecordingReviewPage() {
  return (
    <SignatureSoundReviewWorkspaceProvider discoveryReview={discoveryReview} curatedReview={curatedReview}>
      <AppPageShell width="full" contentClassName="gap-8 pb-24">
        <header className="space-y-3">
          <p className="text-sm font-medium text-primary">Local development · recording review</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Review individual recordings</h1>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            Keep your overall observations, decide which concepts each recording serves, and add a local concept when needed.
          </p>
          <ReviewWorkspaceExportButton />
        </header>
        <CandidateReview />
      </AppPageShell>
    </SignatureSoundReviewWorkspaceProvider>
  )
}
