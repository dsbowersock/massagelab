import Link from "next/link"
import { Layers3 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  FLASHCARD_STATIC_CATEGORIES,
  FLASHCARD_STATIC_PROMPT_TYPE_COUNTS,
  FLASHCARD_STATIC_REGIONS,
  FLASHCARD_STATIC_STARTER_DECKS,
} from "@/lib/flashcard-static-metadata"
import { createPublicPageMetadata } from "@/lib/seo"
import { FlashcardDetailsCarousel } from "./flashcard-details-carousel"
import { FlashcardsClient } from "./flashcards-client"

export const dynamic = "force-dynamic"
export const metadata = createPublicPageMetadata("/education/flashcards")

export default async function EducationFlashcardsPage() {
  const session = await getCurrentSession()
  const isSignedIn = Boolean(session?.user?.id)
  const canManageAnatomyContent = Boolean(session?.user?.capabilities?.canManageAnatomyContent)

  return (
    <AppPageShell
      title="Flashcards"
      width="full"
      className="ml-flashcards-page min-h-0 overflow-x-hidden p-0 sm:p-0 lg:p-0"
      contentClassName="gap-0"
    >
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-4 pb-3 sm:p-6 sm:pb-4 lg:p-8 lg:pb-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-sm font-medium text-primary">Public alpha study</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Massage anatomy flashcards</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Build a sourced anatomy deck, practice immediately in the browser, and save mastery progress when you are signed in.
            </p>
          </div>
          <Button asChild variant="secondary" className="w-full lg:w-auto">
            <Link href="/education/flashcards/decks">Browse starter decks</Link>
          </Button>
        </div>
      </section>

      <section id="flashcard-workbench" className="scroll-mt-20">
      <AppSurface
        className="rounded-none"
        title="Flashcards"
        description="Choose a deck setup, answer mode, and prompt mix. Anonymous decks stay temporary; signed-in users can save deck templates and progress summaries."
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        headerClassName="p-4 sm:p-4"
        contentClassName="p-4 sm:p-4"
      >
        <FlashcardsClient
          categories={FLASHCARD_STATIC_CATEGORIES}
          regions={FLASHCARD_STATIC_REGIONS}
          initialDecks={FLASHCARD_STATIC_STARTER_DECKS}
          initialPromptTypeCounts={FLASHCARD_STATIC_PROMPT_TYPE_COUNTS}
          isSignedIn={isSignedIn}
          canManageAnatomyContent={canManageAnatomyContent}
        />
      </AppSurface>
      </section>

      <FlashcardDetailsCarousel />
    </AppPageShell>
  )
}
