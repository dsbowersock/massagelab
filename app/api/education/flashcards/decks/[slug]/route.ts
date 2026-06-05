import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  accuracyPercent,
  getFlashcardStarterDecks,
  normalizeDeckVisibility,
  normalizeFlashcardDeckConfig,
  promptCountForConfig,
} from "@/lib/flashcard-community"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import { prisma } from "@/lib/prisma"

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

function ownerName(owner: { name: string | null; profile?: { displayName: string | null } | null } | null) {
  return owner?.profile?.displayName ?? owner?.name ?? "MassageLab learner"
}

function rowSummary(deck: {
  id: string
  slug: string
  title: string
  description: string | null
  config: Prisma.JsonValue
  visibility: string
  promptCount: number
  completionCount: number
  attemptCount: number
  answeredCount: number
  correctCount: number
  updatedAt: Date
  ownerUserId: string | null
  owner: { name: string | null; profile?: { displayName: string | null } | null } | null
}, viewerUserId?: string) {
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
    ownerName: ownerName(deck.owner),
    isOwner: Boolean(viewerUserId && deck.ownerUserId === viewerUserId),
    isStarter: false,
    updatedAt: deck.updatedAt.toISOString(),
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const starter = getFlashcardStarterDecks(mediaOptions).find((deck) => deck.slug === slug)
  if (starter) return NextResponse.json({ deck: starter })

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

  if (!deck || (deck.visibility !== "PUBLIC" && deck.ownerUserId !== viewerUserId)) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 })
  }

  return NextResponse.json({ deck: rowSummary(deck, viewerUserId) })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to update saved decks." }, { status: 401 })
  }

  const { slug } = await params
  const existing = await prisma.flashcardDeck.findUnique({ where: { slug } })
  if (!existing || existing.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === "string" && body.title.trim().length > 0
    ? body.title.trim().slice(0, 96)
    : existing.title
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : existing.description
  const config = "config" in body ? normalizeFlashcardDeckConfig(body.config) : normalizeFlashcardDeckConfig(existing.config)
  const visibility = "visibility" in body ? normalizeDeckVisibility(body.visibility) : normalizeDeckVisibility(existing.visibility)
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const promptCount = promptCountForConfig(config, mediaOptions)

  if (promptCount === 0) {
    return NextResponse.json({ error: "This deck has no eligible sourced prompts." }, { status: 400 })
  }

  const deck = await prisma.flashcardDeck.update({
    where: { id: existing.id },
    data: {
      title,
      description,
      config: json(config),
      visibility,
      promptCount,
    },
    include: {
      owner: {
        select: {
          name: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  })

  return NextResponse.json({ deck: rowSummary(deck, session.user.id) })
}
