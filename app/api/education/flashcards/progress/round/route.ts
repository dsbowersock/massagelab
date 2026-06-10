import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { FLASHCARD_TOOL } from "@/lib/flashcard-community"
import {
  allFlashcardPromptIds,
  flashcardPromptIdFromTool,
  optionalFlashcardMediaOptions,
} from "@/lib/flashcard-progress-helpers"
import {
  FLASHCARD_MASTERY_ROUND_KEY_PREFIX,
  flashcardMasteryRoundAchievementKey,
  normalizeFlashcardProgressMetadata,
  nextFlashcardProgressRoundMetadata,
} from "@/lib/flashcard-progress"
import { prisma } from "@/lib/prisma"

type ProgressRow = {
  id: string
  tool: string
  metadata: Prisma.JsonValue
  lastSeenAt: Date
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002")
}

function latestProgressByPromptId(rows: ProgressRow[]) {
  const progressByPromptId = new Map<string, ReturnType<typeof normalizeFlashcardProgressMetadata>>()

  for (const row of rows) {
    const metadata = normalizeFlashcardProgressMetadata(row.metadata)
    const promptId = metadata.promptId || flashcardPromptIdFromTool(row.tool)
    if (!promptId || progressByPromptId.has(promptId)) continue

    progressByPromptId.set(promptId, { ...metadata, promptId })
  }

  return progressByPromptId
}

export async function POST() {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to manage flashcard mastery rounds." }, { status: 401 })
  }

  const mediaOptions = await optionalFlashcardMediaOptions()
  const currentPromptIds = allFlashcardPromptIds(mediaOptions)
  const targetPromptCount = currentPromptIds.size
  const flashcardToolPrefix = `${FLASHCARD_TOOL}:`
  const now = new Date()

  const progressRows = await prisma.learningProgress.findMany({
    where: {
      userId: session.user.id,
      anatomyTermId: null,
      tool: { startsWith: flashcardToolPrefix },
    },
    select: {
      id: true,
      tool: true,
      metadata: true,
      lastSeenAt: true,
    },
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
  })
  const progressByPromptId = latestProgressByPromptId(progressRows)
  const currentProgressRecords = [...currentPromptIds]
    .map((promptId) => progressByPromptId.get(promptId))
    .filter((record): record is ReturnType<typeof normalizeFlashcardProgressMetadata> => Boolean(record))
  const masteredPromptCount = currentProgressRecords.filter((record) => record.correctCount >= record.masteryThreshold).length
  const trackedPromptCount = currentProgressRecords.length
  const totalAttempts = currentProgressRecords.reduce((sum, record) => sum + record.lifetimeAttemptCount, 0)
  const totalCorrect = currentProgressRecords.reduce((sum, record) => sum + record.lifetimeCorrectCount, 0)
  const totalIncorrect = currentProgressRecords.reduce((sum, record) => sum + record.lifetimeIncorrectCount, 0)
  const accuracyPercent = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0

  if (targetPromptCount <= 0 || masteredPromptCount < targetPromptCount) {
    return NextResponse.json({
      error: "Finish mastering the current flashcard round before starting a new one.",
      round: {
        targetPromptCount,
        trackedPromptCount,
        masteredPromptCount,
        roundCompletionPercent: targetPromptCount > 0 ? Math.round((masteredPromptCount / targetPromptCount) * 100) : 0,
      },
    }, { status: 409 })
  }

  const bestSession = await prisma.flashcardStudySession.findFirst({
    where: {
      userId: session.user.id,
      status: "COMPLETED",
      durationMs: { not: null },
    },
    select: { durationMs: true },
    orderBy: { durationMs: "asc" },
  })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const completedRoundCount = await tx.achievement.count({
        where: {
          userId: session.user.id,
          tool: FLASHCARD_TOOL,
          key: { startsWith: FLASHCARD_MASTERY_ROUND_KEY_PREFIX },
        },
      })
      const completedRound = completedRoundCount + 1
      const achievementKey = flashcardMasteryRoundAchievementKey(completedRound)
      const existingAchievement = await tx.achievement.findUnique({
        where: { userId_key_tool: { userId: session.user.id, key: achievementKey, tool: FLASHCARD_TOOL } },
      })

      if (existingAchievement) return { status: "conflict" as const }

      const snapshot = {
        round: completedRound,
        targetPromptCount,
        trackedPromptCount,
        masteredPromptCount,
        totalAttempts,
        totalCorrect,
        totalIncorrect,
        accuracyPercent,
        bestDurationMs: bestSession?.durationMs ?? null,
        completedAt: now.toISOString(),
      }
      const achievement = await tx.achievement.create({
        data: {
          userId: session.user.id,
          key: achievementKey,
          tool: FLASHCARD_TOOL,
          metadata: json(snapshot),
        },
      })

      for (const row of progressRows) {
        const nextMetadata = nextFlashcardProgressRoundMetadata(row.metadata, now)
        await tx.learningProgress.update({
          where: { id: row.id },
          data: {
            status: "STARTED",
            score: null,
            metadata: json(nextMetadata),
            lastSeenAt: now,
          },
        })
      }

      return {
        status: "created" as const,
        achievementKey,
        earnedAt: achievement.earnedAt,
        snapshot,
      }
    })

    if (result.status === "conflict") {
      return NextResponse.json({ error: "This flashcard mastery round has already been claimed." }, { status: 409 })
    }

    return NextResponse.json({
      round: {
        ...result.snapshot,
        nextRound: result.snapshot.round + 1,
      },
      achievement: {
        key: result.achievementKey,
        earnedAt: result.earnedAt.toISOString(),
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "This flashcard mastery round has already been claimed." }, { status: 409 })
    }

    throw error
  }
}
