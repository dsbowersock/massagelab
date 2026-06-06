import { notFound } from "next/navigation"
import { Layers3 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import {
  FLASHCARD_STARTER_DECKS,
  accuracyPercent,
  normalizeDeckVisibility,
  normalizeFlashcardDeckConfig,
} from "@/lib/flashcard-community"
import type { FlashcardDeckSummary } from "@/lib/flashcard-community"
import {
  getAnatomyStudyCards,
  getAnatomyStudyCategories,
  getFlashcardPromptTypeCounts,
  getAnatomyStudyRegions,
  getAnatomyStudySources,
} from "@/lib/anatomy-study"
import { prisma } from "@/lib/prisma"
import { FlashcardsClient } from "../../flashcards-client"

function displayName(owner: { name: string | null; profile?: { displayName: string | null } | null } | null) {
  return owner?.profile?.displayName ?? owner?.name ?? "MassageLab learner"
}

async function loadDeck(slug: string, viewerUserId?: string): Promise<FlashcardDeckSummary | null> {
  const starter = FLASHCARD_STARTER_DECKS.find((deck) => deck.slug === slug)
  if (starter) return starter

  const deck = await prisma.flashcardDeck.findUnique({
    where: { slug },
    include: {
      owner: {
        select: {
          name: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  })

  if (!deck || (deck.visibility !== "PUBLIC" && deck.ownerUserId !== viewerUserId)) return null

  return {
    id: deck.id,
    slug: deck.slug,
    title: deck.title,
    description: deck.description ?? "",
    config: normalizeFlashcardDeckConfig(deck.config),
    visibility: normalizeDeckVisibility(deck.visibility),
    promptCount: deck.promptCount,
    completionCount: deck.completionCount,
    attemptCount: deck.attemptCount,
    answeredCount: deck.answeredCount,
    correctCount: deck.correctCount,
    accuracyPercent: accuracyPercent(deck.correctCount, deck.answeredCount),
    ownerName: displayName(deck.owner),
    isOwner: Boolean(viewerUserId && deck.ownerUserId === viewerUserId),
    isStarter: false,
    updatedAt: deck.updatedAt.toISOString(),
  }
}

export default async function FlashcardDeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, session] = await Promise.all([params, getCurrentSession()])
  const deck = await loadDeck(slug, session?.user?.id)
  if (!deck) notFound()

  const cards = getAnatomyStudyCards()
  const promptTypeCounts = getFlashcardPromptTypeCounts()
  const categories = getAnatomyStudyCategories(cards)
  const regions = getAnatomyStudyRegions(cards)
  const sources = getAnatomyStudySources(cards)

  return (
    <AppPageShell title={deck.title} width="full" contentClassName="gap-6">
      <AppSurface
        title={deck.title}
        description={`${deck.promptCount} eligible prompts from ${deck.ownerName}.`}
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        badge={deck.isStarter ? "Starter" : deck.visibility}
      >
        <FlashcardsClient
          categories={categories}
          regions={regions}
          sources={sources}
          initialDecks={FLASHCARD_STARTER_DECKS}
          initialPromptTypeCounts={promptTypeCounts}
          isSignedIn={Boolean(session?.user?.id)}
          initialDeck={deck}
        />
      </AppSurface>
    </AppPageShell>
  )
}
