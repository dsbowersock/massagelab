import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  normalizeFlashcardDeckConfig,
} from "@/lib/flashcard-community"
import { createFlashcardPromptDeck } from "@/lib/anatomy-study"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import { prisma } from "@/lib/prisma"

const emptyMediaOptions = { mediaUrlBySlug: new Map<string, string>() }

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

  const body = await request.json().catch(() => ({}))
  const deckSlug = typeof body.deckSlug === "string" ? body.deckSlug : ""
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
  const prompts = createFlashcardPromptDeck(config, mediaOptions)
  const promptIds = prompts.map((prompt) => prompt.id)
  if (promptIds.length === 0) {
    return NextResponse.json({ error: "This deck has no eligible sourced prompts." }, { status: 400 })
  }

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
