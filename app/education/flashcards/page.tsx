import Link from "next/link"
import { BookOpen, Brain, Layers3, ShieldCheck } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  FLASHCARD_STATIC_CATEGORIES,
  FLASHCARD_STATIC_PROMPT_TYPE_COUNTS,
  FLASHCARD_STATIC_REGIONS,
  FLASHCARD_STATIC_STARTER_DECKS,
} from "@/lib/flashcard-static-metadata"
import { createPublicPageMetadata } from "@/lib/seo"
import { FlashcardsClient } from "./flashcards-client"

export const dynamic = "force-dynamic"
export const metadata = createPublicPageMetadata("/education/flashcards")

const flashcardProofs = [
  {
    title: "Reviewed anatomy source set",
    description: "Cards are generated from the same sourced anatomy study adapter used by Anatomime.",
    icon: ShieldCheck,
  },
  {
    title: "Massage-friendly prompt modes",
    description: "Study image identification, names, regions, categories, and muscle action/attachment prompts.",
    icon: BookOpen,
  },
  {
    title: "Saved progress when signed in",
    description: "Practice anonymously, then create an account when you want mastery and deck templates to persist.",
    icon: Brain,
  },
] as const

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
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <AppSurface
          className={appCalloutClassName}
          contentClassName="gap-5"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-sm font-medium text-primary">Public alpha study</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Massage anatomy flashcards</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Build a custom deck from reviewed anatomy prompts, practice immediately in the browser, and save mastery progress when you are signed in. The flashcards are designed for massage students, educators, and practitioners who need body-region recall without a generic trivia deck.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button asChild>
                <Link href="#flashcard-workbench">Start studying</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/education/flashcards/decks">Browse starter decks</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <AppInset className="p-3">
              <p className="text-xs uppercase tracking-normal text-muted-foreground">Categories</p>
              <p className="mt-1 text-lg font-semibold">{FLASHCARD_STATIC_CATEGORIES.length}</p>
            </AppInset>
            <AppInset className="p-3">
              <p className="text-xs uppercase tracking-normal text-muted-foreground">Regions</p>
              <p className="mt-1 text-lg font-semibold">{FLASHCARD_STATIC_REGIONS.length}</p>
            </AppInset>
            <AppInset className="p-3">
              <p className="text-xs uppercase tracking-normal text-muted-foreground">Starter decks</p>
              <p className="mt-1 text-lg font-semibold">{FLASHCARD_STATIC_STARTER_DECKS.length}</p>
            </AppInset>
          </div>
        </AppSurface>

        <div className="grid gap-4 md:grid-cols-3">
          {flashcardProofs.map((proof) => {
            const Icon = proof.icon
            return (
              <AppSurface
                key={proof.title}
                title={proof.title}
                description={proof.description}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
              />
            )
          })}
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
    </AppPageShell>
  )
}
