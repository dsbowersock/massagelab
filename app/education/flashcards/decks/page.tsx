import { Layers3 } from "lucide-react"
import { getCurrentRscSession as getCurrentSession } from "@/lib/rsc-session"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { loadAnatomyReviewerActor } from "@/lib/admin/access"
import { prisma } from "@/lib/prisma"
import {
  FLASHCARD_STATIC_CATEGORIES,
  FLASHCARD_STATIC_PROMPT_TYPE_COUNTS,
  FLASHCARD_STATIC_REGIONS,
  FLASHCARD_STATIC_STARTER_DECKS,
} from "@/lib/flashcard-static-metadata"
import { createPublicPageMetadata } from "@/lib/seo"
import { FlashcardsClient } from "../flashcards-client"

export const dynamic = "force-dynamic"
export const metadata = createPublicPageMetadata("/education/flashcards/decks")

export default async function FlashcardDecksPage() {
  const session = await getCurrentSession()
  const isSignedIn = Boolean(session?.user?.id)
  const reviewActor = await loadAnatomyReviewerActor({
    prismaClient: prisma,
    sessionUserId: session?.user?.id ?? null,
  })

  return (
    <AppPageShell title="Community Decks" width="full" contentClassName="gap-6">
      <AppSurface
        title="Community Decks"
        description="Sourced prompts available for public deck templates."
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        badge="Public alpha"
        headerClassName="p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        contentClassName="p-4 pt-0 sm:p-4 sm:pt-0"
      >
        <FlashcardsClient
          categories={FLASHCARD_STATIC_CATEGORIES}
          regions={FLASHCARD_STATIC_REGIONS}
          initialDecks={FLASHCARD_STATIC_STARTER_DECKS}
          initialPromptTypeCounts={FLASHCARD_STATIC_PROMPT_TYPE_COUNTS}
          isSignedIn={isSignedIn}
          canManageAnatomyContent={Boolean(reviewActor)}
        />
      </AppSurface>
    </AppPageShell>
  )
}
