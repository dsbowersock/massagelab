import { notFound } from "next/navigation"
import { Layers3 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import type { FlashcardDeckSummary } from "@/lib/flashcard-community"
import {
  FLASHCARD_STATIC_CATEGORIES,
  FLASHCARD_STATIC_PROMPT_TYPE_COUNTS,
  FLASHCARD_STATIC_REGIONS,
  FLASHCARD_STATIC_STARTER_DECKS,
  getStaticStarterFlashcardDeck,
} from "@/lib/flashcard-static-metadata"
import { createNoindexPageMetadata, createPublicPageMetadata } from "@/lib/seo"
import { FlashcardsClient } from "../../flashcards-client"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const starterDeck = getStaticStarterFlashcardDeck(slug)

  if (!starterDeck) {
    return createNoindexPageMetadata({
      title: "Flashcard Deck | MassageLab",
      description: "MassageLab flashcard deck.",
    })
  }

  return createPublicPageMetadata(`/education/flashcards/decks/${starterDeck.slug}`, {
    title: starterDeck.title,
    description: starterDeck.description,
  })
}

function displayName(owner: { name: string | null; profile?: { displayName: string | null } | null } | null) {
  return owner?.profile?.displayName ?? owner?.name ?? "MassageLab learner"
}

async function loadPersistedDeck(slug: string, viewerUserId?: string): Promise<FlashcardDeckSummary | null> {
  const [
    { accuracyPercent, normalizeDeckVisibility, normalizeFlashcardDeckConfig },
    { prisma },
  ] = await Promise.all([
    import("@/lib/flashcard-community"),
    import("@/lib/prisma"),
  ])
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
  const viewerUserId = session?.user?.id
  const isSignedIn = Boolean(viewerUserId)
  const canManageAnatomyContent = Boolean(session?.user?.capabilities?.canManageAnatomyContent)
  const deck = getStaticStarterFlashcardDeck(slug) ?? await loadPersistedDeck(slug, viewerUserId)
  if (!deck) notFound()

  return (
    <AppPageShell title={deck.title} width="full" contentClassName="gap-6">
      <AppSurface
        title={deck.title}
        description={`${deck.promptCount} selected prompts from ${deck.ownerName}.`}
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        badge={deck.isStarter ? "Starter" : deck.visibility}
        headerClassName="p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        contentClassName="p-4 pt-0 sm:p-4 sm:pt-0"
      >
        <FlashcardsClient
          categories={FLASHCARD_STATIC_CATEGORIES}
          regions={FLASHCARD_STATIC_REGIONS}
          initialDecks={FLASHCARD_STATIC_STARTER_DECKS}
          initialPromptTypeCounts={FLASHCARD_STATIC_PROMPT_TYPE_COUNTS}
          isSignedIn={isSignedIn}
          canManageAnatomyContent={canManageAnatomyContent}
          initialDeck={deck}
        />
      </AppSurface>
    </AppPageShell>
  )
}
