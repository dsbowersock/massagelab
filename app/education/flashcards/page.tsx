import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import {
  FLASHCARD_STATIC_CATEGORIES,
  FLASHCARD_STATIC_PROMPT_TYPE_COUNTS,
  FLASHCARD_STATIC_REGIONS,
  FLASHCARD_STATIC_STARTER_DECKS,
} from "@/lib/flashcard-static-metadata"
import { FlashcardsClient } from "./flashcards-client"

export const dynamic = "force-dynamic"

export default async function EducationFlashcardsPage() {
  const session = await getCurrentSession()
  const isSignedIn = Boolean(session?.user?.id)

  return (
    <AppPageShell
      title="Flashcards"
      width="full"
      className="min-h-0 p-0 sm:p-0 lg:p-0"
      contentClassName="gap-0"
    >
      <AppSurface
        className="rounded-none"
        contentClassName="p-4 sm:p-4"
      >
        <FlashcardsClient
          categories={FLASHCARD_STATIC_CATEGORIES}
          regions={FLASHCARD_STATIC_REGIONS}
          initialDecks={FLASHCARD_STATIC_STARTER_DECKS}
          initialPromptTypeCounts={FLASHCARD_STATIC_PROMPT_TYPE_COUNTS}
          isSignedIn={isSignedIn}
        />
      </AppSurface>
    </AppPageShell>
  )
}
