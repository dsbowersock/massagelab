import { notFound } from "next/navigation"
import { Layers3 } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import {
  accuracyPercent,
  getFlashcardStarterDecks,
  normalizeDeckVisibility,
  normalizeFlashcardDeckConfig,
} from "@/lib/flashcard-community"
import type { FlashcardDeckSummary } from "@/lib/flashcard-community"
import type { AnatomyStudyBuildOptions } from "@/lib/anatomy-study"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import {
  getAnatomyStudyCards,
  getAnatomyStudyCategories,
  getAnatomyStudyPrompts,
  getAnatomyStudyRegions,
  getAnatomyStudySources,
} from "@/lib/anatomy-study"
import { prisma } from "@/lib/prisma"
import { FlashcardsClient } from "../../flashcards-client"

function displayName(owner: { name: string | null; profile?: { displayName: string | null } | null } | null) {
  return owner?.profile?.displayName ?? owner?.name ?? "MassageLab learner"
}

async function loadDeck(slug: string, mediaOptions: AnatomyStudyBuildOptions, viewerUserId?: string): Promise<FlashcardDeckSummary | null> {
  const starter = getFlashcardStarterDecks(mediaOptions).find((deck) => deck.slug === slug)
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
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const deck = await loadDeck(slug, mediaOptions, session?.user?.id)
  if (!deck) notFound()

  const cards = getAnatomyStudyCards({}, mediaOptions)
  const prompts = getAnatomyStudyPrompts({}, mediaOptions)
  const categories = getAnatomyStudyCategories(cards)
  const regions = getAnatomyStudyRegions(cards)
  const sources = getAnatomyStudySources(cards)
  const starterDecks = getFlashcardStarterDecks(mediaOptions)

  return (
    <AppPageShell title={deck.title} width="full" contentClassName="gap-6">
      <AppSurface
        title={deck.title}
        description={`${deck.promptCount} eligible prompts from ${deck.ownerName}.`}
        icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
        badge={deck.isStarter ? "Starter" : deck.visibility}
      >
        <FlashcardsClient
          prompts={prompts}
          categories={categories}
          regions={regions}
          sources={sources}
          initialDecks={starterDecks}
          isSignedIn={Boolean(session?.user?.id)}
          initialDeck={deck}
        />
      </AppSurface>
    </AppPageShell>
  )
}
