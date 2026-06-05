import { Layers3 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import {
  getAnatomyStudyCards,
  getAnatomyStudyCategories,
  getAnatomyStudyPrompts,
  getAnatomyStudyRegions,
  getAnatomyStudySources,
} from "@/lib/anatomy-study"
import { getFlashcardStarterDecks } from "@/lib/flashcard-community"
import { FlashcardsClient } from "../flashcards-client"

export default async function FlashcardDecksPage() {
  const session = await getCurrentSession()
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const cards = getAnatomyStudyCards({}, mediaOptions)
  const prompts = getAnatomyStudyPrompts({}, mediaOptions)
  const categories = getAnatomyStudyCategories(cards)
  const regions = getAnatomyStudyRegions(cards)
  const sources = getAnatomyStudySources(cards)
  const starterDecks = getFlashcardStarterDecks(mediaOptions)

  return (
    <AppPageShell title="Community Decks" width="full" contentClassName="gap-6">
      <AppSurface
        title="Community Decks"
        description={`${prompts.length} sourced prompts available for public deck templates.`}
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        badge="Public alpha"
      >
        <FlashcardsClient
          prompts={prompts}
          categories={categories}
          regions={regions}
          sources={sources}
          initialDecks={starterDecks}
          isSignedIn={Boolean(session?.user?.id)}
        />
      </AppSurface>
    </AppPageShell>
  )
}
