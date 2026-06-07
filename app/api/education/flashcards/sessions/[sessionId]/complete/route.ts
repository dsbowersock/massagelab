import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  FLASHCARD_TOOL,
  completionAchievementKeys,
  normalizeFlashcardDeckConfig,
} from "@/lib/flashcard-community"
import {
  flashcardProgressTool,
  nextFlashcardProgressUpdate,
} from "@/lib/flashcard-progress"
import { createFlashcardPromptDeck } from "@/lib/anatomy-study"
import type { AnatomyStudyRegion } from "@/lib/anatomy-study"
import { loadAnatomyStudyMediaUrlOptions } from "@/lib/anatomy-study-media"
import { prisma } from "@/lib/prisma"

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

function resultRows(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return []
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results)) return []

  return results
    .map((result) => {
      if (!result || typeof result !== "object" || Array.isArray(result)) return null
      const row = result as Record<string, unknown>
      const promptId = typeof row.promptId === "string" ? row.promptId : ""
      if (!promptId) return null

      return {
        promptId,
        correct: Boolean(row.correct),
        score: Number.isFinite(Number(row.score)) ? Math.max(0, Math.min(100, Math.round(Number(row.score)))) : 0,
      }
    })
    .filter((result): result is { promptId: string; correct: boolean; score: number } => Boolean(result))
}

function durationMs(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const numeric = Number((body as { durationMs?: unknown }).durationMs)
  if (!Number.isFinite(numeric) || numeric <= 0) return null

  return Math.min(24 * 60 * 60 * 1000, Math.trunc(numeric))
}

async function updatePromptProgress(userId: string, result: {
  promptId: string
  promptType: string
  entityType: string
  entitySlug: string
  regions: AnatomyStudyRegion[]
  correct: boolean
  score: number
}) {
  const tool = flashcardProgressTool(result.promptId)
  const existing = await prisma.learningProgress.findFirst({
    where: {
      userId,
      anatomyTermId: null,
      tool,
    },
    select: { id: true, metadata: true },
  })
  const update = nextFlashcardProgressUpdate(existing?.metadata, result)
  const data = {
    status: update.status,
    score: update.score,
    metadata: json(update.metadata),
    lastSeenAt: new Date(),
  }

  if (existing) {
    await prisma.learningProgress.update({
      where: { id: existing.id },
      data,
    })
  } else {
    await prisma.learningProgress.create({
      data: {
        userId,
        anatomyTermId: null,
        tool,
        ...data,
      },
    })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to save flashcard progress." }, { status: 401 })
  }

  const { sessionId } = await params
  const studySession = await prisma.flashcardStudySession.findUnique({
    where: { id: sessionId },
  })

  if (!studySession || studySession.userId !== session.user.id) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const submittedResults = resultRows(body)
  const submittedDurationMs = durationMs(body)
  const config = normalizeFlashcardDeckConfig(studySession.deckConfig)
  const mediaOptions = await loadAnatomyStudyMediaUrlOptions()
  const promptById = new Map(createFlashcardPromptDeck(config, mediaOptions).map((prompt) => [prompt.id, prompt]))
  const allowedPromptIds = new Set(studySession.promptIds)
  const deduplicatedSubmittedResults = new Map<string, { promptId: string; correct: boolean; score: number }>()

  for (const result of submittedResults) {
    if (allowedPromptIds.has(result.promptId)) {
      deduplicatedSubmittedResults.set(result.promptId, result)
    }
  }

  const results = [...deduplicatedSubmittedResults.values()]
    .map((result) => {
      const prompt = promptById.get(result.promptId)
      if (!prompt) return null

      return {
        promptId: result.promptId,
        promptType: prompt.type,
        entityType: prompt.entityType,
        entitySlug: prompt.entitySlug,
        regions: prompt.regions,
        correct: result.correct,
        score: result.score,
      }
    })
    .filter((result): result is NonNullable<typeof result> => Boolean(result))

  const answeredCount = results.length
  const correctCount = results.filter((result) => result.correct).length
  let didComplete = false

  await prisma.$transaction(async (tx) => {
    const currentSession = await tx.flashcardStudySession.findUnique({
      where: { id: studySession.id },
      select: { status: true },
    })

    if (!currentSession || currentSession.status !== "STARTED") return
    didComplete = true

    await tx.flashcardStudySession.update({
      where: { id: studySession.id },
      data: {
        status: "COMPLETED",
        answeredCount,
        correctCount,
        durationMs: submittedDurationMs,
        completedAt: new Date(),
      },
    })

    if (studySession.deckId) {
      await tx.flashcardDeck.update({
        where: { id: studySession.deckId },
        data: {
          completionCount: { increment: 1 },
          attemptCount: { increment: 1 },
          answeredCount: { increment: answeredCount },
          correctCount: { increment: correctCount },
        },
      })
    }
  })

  if (didComplete) {
    for (const result of results) {
      await updatePromptProgress(session.user.id, result)
    }

    for (const key of completionAchievementKeys(results, config)) {
      await prisma.achievement.upsert({
        where: { userId_key_tool: { userId: session.user.id, key, tool: FLASHCARD_TOOL } },
        create: {
          userId: session.user.id,
          key,
          tool: FLASHCARD_TOOL,
          metadata: json({ sessionId: studySession.id }),
        },
        update: {},
      })
    }
  }

  const responseAnsweredCount = didComplete ? answeredCount : studySession.answeredCount
  const responseCorrectCount = didComplete ? correctCount : studySession.correctCount

  return NextResponse.json({
    session: {
      id: studySession.id,
      status: "COMPLETED",
      answeredCount: responseAnsweredCount,
      correctCount: responseCorrectCount,
      accuracyPercent: responseAnsweredCount > 0 ? Math.round((responseCorrectCount / responseAnsweredCount) * 100) : 0,
    },
  })
}
