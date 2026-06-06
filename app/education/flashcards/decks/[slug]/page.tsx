import { notFound } from "next/navigation"
import { Layers3 } from "lucide-react"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import type { FlashcardDeckSummary } from "@/lib/flashcard-community"
import {
  FLASHCARD_STATIC_CATEGORIES,
  FLASHCARD_STATIC_PROMPT_TYPE_COUNTS,
  FLASHCARD_STATIC_REGIONS,
  FLASHCARD_STATIC_SOURCES,
  FLASHCARD_STATIC_STARTER_DECKS,
  getStaticStarterFlashcardDeck,
} from "@/lib/flashcard-static-metadata"
import { FlashcardsClient } from "../../flashcards-client"

function displayName(owner: { name: string | null; profile?: { displayName: string | null } | null } | null) {
  return owner?.profile?.displayName ?? owner?.name ?? "MassageLab learner"
}

async function loadPersistedDeck(slug: string): Promise<FlashcardDeckSummary | null> {
  const [
    { getCurrentSession },
    { accuracyPercent, normalizeDeckVisibility, normalizeFlashcardDeckConfig },
    { prisma },
  ] = await Promise.all([
    import("@/auth"),
    import("@/lib/flashcard-community"),
    import("@/lib/prisma"),
  ])
  const session = await getCurrentSession()
  const viewerUserId = session?.user?.id
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
  const { slug } = await params
  const deck = getStaticStarterFlashcardDeck(slug) ?? await loadPersistedDeck(slug)
  if (!deck) notFound()

  return (
    <AppPageShell title={deck.title} width="full" contentClassName="gap-6">
      <AppSurface
        title={deck.title}
        description={`${deck.promptCount} selected prompts from ${deck.ownerName}.`}
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        badge={deck.isStarter ? "Starter" : deck.visibility}
      >
        <FlashcardsClient
          categories={FLASHCARD_STATIC_CATEGORIES}
          regions={FLASHCARD_STATIC_REGIONS}
          sources={FLASHCARD_STATIC_SOURCES}
          initialDecks={FLASHCARD_STATIC_STARTER_DECKS}
          initialPromptTypeCounts={FLASHCARD_STATIC_PROMPT_TYPE_COUNTS}
          isSignedIn={false}
          initialDeck={deck}
        />
      </AppSurface>
    </AppPageShell>
  )
}
