import { Layers3 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { getFlashcardStarterDecks } from "@/lib/flashcard-community"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import {
  getAnatomyStudyPrompts,
  getAnatomyStudyCards,
  getAnatomyStudyCategories,
  getAnatomyStudyRegions,
  getAnatomyStudySources,
} from "@/lib/anatomy-study"
import { FlashcardsClient } from "./flashcards-client"

export default async function EducationFlashcardsPage() {
  const session = await getCurrentSession()
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const cards = getAnatomyStudyCards({}, mediaOptions)
  const prompts = getAnatomyStudyPrompts({}, mediaOptions)
  const categories = getAnatomyStudyCategories(cards)
  const regions = getAnatomyStudyRegions(cards)
  const sources = getAnatomyStudySources(cards)
  const starterDecks = getFlashcardStarterDecks(mediaOptions)

  return (
    <AppPageShell title="Flashcards" width="full" contentClassName="gap-6">
      <AppSurface
        title="Flashcards"
        description={`${prompts.length} sourced anatomy prompts for self-study.`}
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
