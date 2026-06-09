import { Layers3 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import {
  FLASHCARD_STATIC_CATEGORIES,
  FLASHCARD_STATIC_PROMPT_TYPE_COUNTS,
  FLASHCARD_STATIC_REGIONS,
  FLASHCARD_STATIC_SOURCES,
  FLASHCARD_STATIC_STARTER_DECKS,
} from "@/lib/flashcard-static-metadata"
import { FlashcardsClient } from "./flashcards-client"

export const dynamic = "force-dynamic"

export default async function EducationFlashcardsPage() {
  const session = await getCurrentSession()
  const isSignedIn = Boolean(session?.user?.id)

  return (
    <AppPageShell title="Flashcards" width="full" contentClassName="gap-6">
      <AppSurface
        title="Flashcards"
        description="Sourced anatomy prompts for self-study."
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        badge="Public alpha"
        headerClassName="p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        contentClassName="p-4 pt-0 sm:p-4 sm:pt-0"
      >
        <FlashcardsClient
          categories={FLASHCARD_STATIC_CATEGORIES}
          regions={FLASHCARD_STATIC_REGIONS}
          sources={FLASHCARD_STATIC_SOURCES}
          initialDecks={FLASHCARD_STATIC_STARTER_DECKS}
          initialPromptTypeCounts={FLASHCARD_STATIC_PROMPT_TYPE_COUNTS}
          isSignedIn={isSignedIn}
        />
      </AppSurface>
    </AppPageShell>
  )
}
