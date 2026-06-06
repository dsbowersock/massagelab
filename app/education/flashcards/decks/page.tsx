import { Layers3 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import {
  getAnatomyStudyCards,
  getAnatomyStudyCategories,
  getFlashcardPromptTypeCounts,
  getAnatomyStudyRegions,
  getAnatomyStudySources,
} from "@/lib/anatomy-study"
import { FLASHCARD_STARTER_DECKS } from "@/lib/flashcard-community"
import { FlashcardsClient } from "../flashcards-client"

export default async function FlashcardDecksPage() {
  const session = await getCurrentSession()
  const cards = getAnatomyStudyCards()
  const promptTypeCounts = getFlashcardPromptTypeCounts()
  const categories = getAnatomyStudyCategories(cards)
  const regions = getAnatomyStudyRegions(cards)
  const sources = getAnatomyStudySources(cards)
  const promptCount = promptTypeCounts.reduce((sum, promptType) => sum + promptType.promptCount, 0)

  return (
    <AppPageShell title="Community Decks" width="full" contentClassName="gap-6">
      <AppSurface
        title="Community Decks"
        description={`${promptCount} sourced prompts available for public deck templates.`}
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        badge="Public alpha"
      >
        <FlashcardsClient
          categories={categories}
          regions={regions}
          sources={sources}
          initialDecks={FLASHCARD_STARTER_DECKS}
          initialPromptTypeCounts={promptTypeCounts}
          isSignedIn={Boolean(session?.user?.id)}
        />
      </AppSurface>
    </AppPageShell>
  )
}
