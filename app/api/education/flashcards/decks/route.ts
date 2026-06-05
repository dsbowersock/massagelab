import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  FLASHCARD_ACHIEVEMENTS,
  FLASHCARD_STARTER_DECKS,
  FLASHCARD_TOOL,
  accuracyPercent,
  getFlashcardStarterDecks,
  normalizeDeckVisibility,
  normalizeFlashcardDeckConfig,
  promptCountForConfig,
  slugifyFlashcardDeckTitle,
} from "@/lib/flashcard-community"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import { prisma } from "@/lib/prisma"

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

const starterDeckSlugs = new Set(FLASHCARD_STARTER_DECKS.map((deck) => deck.slug))

function displayName(owner: { name: string | null; email: string | null; profile?: { displayName: string | null } | null } | null) {
  return owner?.profile?.displayName ?? owner?.name ?? "MassageLab learner"
}

function deckSummary(deck: {
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
  owner: { name: string | null; email: string | null; profile?: { displayName: string | null } | null } | null
}, viewerUserId?: string) {
  const config = normalizeFlashcardDeckConfig(deck.config)

  return {
    id: deck.id,
    slug: deck.slug,
    title: deck.title,
    description: deck.description ?? "",
    config,
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

async function uniqueDeckSlug(title: string) {
  const base = slugifyFlashcardDeckTitle(title)
  let slug = base
  let suffix = 1

  while (starterDeckSlugs.has(slug) || await prisma.flashcardDeck.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1
    slug = `${base}-${suffix}`
  }

  return slug
}

async function awardDeckAchievements(userId: string, visibility: string) {
  await prisma.achievement.upsert({
    where: { userId_key_tool: { userId, key: FLASHCARD_ACHIEVEMENTS.firstSavedDeck, tool: FLASHCARD_TOOL } },
    create: {
      userId,
      key: FLASHCARD_ACHIEVEMENTS.firstSavedDeck,
      tool: FLASHCARD_TOOL,
      metadata: {},
    },
    update: {},
  })

  if (visibility === "PUBLIC") {
    await prisma.achievement.upsert({
      where: { userId_key_tool: { userId, key: FLASHCARD_ACHIEVEMENTS.firstPublicDeck, tool: FLASHCARD_TOOL } },
      create: {
        userId,
        key: FLASHCARD_ACHIEVEMENTS.firstPublicDeck,
        tool: FLASHCARD_TOOL,
        metadata: {},
      },
      update: {},
    })
  }
}

export async function GET() {
  const session = await getCurrentSession()
  const viewerUserId = session?.user?.id
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const starterDecks = getFlashcardStarterDecks(mediaOptions)

  try {
    const decks = await prisma.flashcardDeck.findMany({
      where: viewerUserId
        ? {
          OR: [
            { visibility: "PUBLIC" },
            { ownerUserId: viewerUserId },
          ],
        }
        : { visibility: "PUBLIC" },
      include: {
        owner: {
          select: {
            name: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        },
      },
      orderBy: [
        { completionCount: "desc" },
        { updatedAt: "desc" },
      ],
      take: 60,
    })

    return NextResponse.json({
      decks: [
        ...starterDecks,
        ...decks.map((deck) => deckSummary(deck, viewerUserId)),
      ],
      databaseReady: true,
    })
  } catch {
    return NextResponse.json({
      decks: starterDecks,
      databaseReady: false,
    })
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to save flashcard decks." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === "string" && body.title.trim().length > 0
    ? body.title.trim().slice(0, 96)
    : "Flashcard deck"
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : ""
  const config = normalizeFlashcardDeckConfig(body.config)
  const visibility = normalizeDeckVisibility(body.visibility)
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const promptCount = promptCountForConfig(config, mediaOptions)

  if (promptCount === 0) {
    return NextResponse.json({ error: "This deck has no eligible sourced prompts." }, { status: 400 })
  }

  const deck = await prisma.flashcardDeck.create({
    data: {
      slug: await uniqueDeckSlug(title),
      ownerUserId: session.user.id,
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
          email: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  })
  void awardDeckAchievements(session.user.id, visibility).catch((error) => {
    console.error("Failed to award flashcard deck achievements", error)
  })

  return NextResponse.json({ deck: deckSummary(deck, session.user.id) }, { status: 201 })
}
