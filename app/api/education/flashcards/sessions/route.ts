import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  normalizeFlashcardDeckConfig,
} from "@/lib/flashcard-community"
import { createFlashcardPromptDeck, createFlashcardPromptPool } from "@/lib/anatomy-study"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import {
  flashcardProgressTool,
  isFlashcardProgressMastered,
  normalizeFlashcardProgressMetadata,
} from "@/lib/flashcard-progress"
import { prisma } from "@/lib/prisma"

const emptyMediaOptions = { mediaUrlBySlug: new Map<string, string>() }
const flashcardPromptToolPrefix = flashcardProgressTool("")

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

async function boundedMediaOptions() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      loadAnatomyStudyMediaUrlOptions(),
      new Promise<typeof emptyMediaOptions>((resolve) => {
        timeoutId = setTimeout(() => resolve(emptyMediaOptions), 1500)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to save flashcard progress." }, { status: 401 })
  }

  const rawBody = await request.json().catch(() => ({}))
  const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    ? rawBody as Record<string, unknown>
    : {}
  const deckSlug = typeof body.deckSlug === "string" ? body.deckSlug : ""
  const skipMastered = body.skipMastered === true
  let deck: { id: string; config: Prisma.JsonValue; visibility: string; ownerUserId: string | null } | null = null

  if (deckSlug) {
    deck = await prisma.flashcardDeck.findUnique({
      where: { slug: deckSlug },
      select: {
        id: true,
        config: true,
        visibility: true,
        ownerUserId: true,
      },
    })
    if (!deck || (deck.visibility !== "PUBLIC" && deck.ownerUserId !== session.user.id)) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 })
    }
  }

  const config = normalizeFlashcardDeckConfig(deck?.config ?? body.config)
  const mediaOptions = await boundedMediaOptions()
  let prompts = skipMastered
    ? createFlashcardPromptPool(config, mediaOptions)
    : createFlashcardPromptDeck(config, mediaOptions)
  if (prompts.length === 0) {
    return NextResponse.json({ error: "This deck has no eligible sourced prompts." }, { status: 400 })
  }

  if (skipMastered) {
    // TODO(flashcard-scale): if prompt pools grow into 1000+ ids, replace this single IN lookup with batched pagination or an indexed progress lookup.
    const progressRows = await prisma.learningProgress.findMany({
      where: {
        userId: session.user.id,
        anatomyTermId: null,
        tool: { in: prompts.map((prompt) => flashcardProgressTool(prompt.id)) },
      },
      select: { metadata: true, tool: true },
    })
    const masteredPromptIds = new Set(progressRows
      .filter((row) => isFlashcardProgressMastered(row.metadata))
      .map((row) => {
        const metadata = normalizeFlashcardProgressMetadata(row.metadata)
        return metadata.promptId || (row.tool.startsWith(flashcardPromptToolPrefix) ? row.tool.slice(flashcardPromptToolPrefix.length) : "")
      })
      .filter(Boolean))
    const deckCount = typeof config.count === "number" ? Math.max(0, config.count) : prompts.length

    prompts = prompts
      .filter((prompt) => !masteredPromptIds.has(prompt.id))
      .slice(0, deckCount)
    if (prompts.length === 0) {
      return NextResponse.json({
        error: "All selected prompts are already mastered. Turn off skip mastered prompts to review them again.",
      }, { status: 409 })
    }
  }

  const promptIds = prompts.map((prompt) => prompt.id)

  const studySession = await prisma.flashcardStudySession.create({
    data: {
      userId: session.user.id,
      deckId: deck?.id ?? null,
      deckConfig: json(config),
      promptIds,
      status: "STARTED",
    },
  }).catch((error) => {
    console.error("Failed to create flashcard study session", error)
    return null
  })

  if (!studySession) {
    return NextResponse.json({ error: "Progress tracking could not be started." }, { status: 503 })
  }

  return NextResponse.json({
    session: {
      id: studySession.id,
      promptIds,
      prompts,
      deckId: deck?.id ?? null,
    },
  }, { status: 201 })
}
