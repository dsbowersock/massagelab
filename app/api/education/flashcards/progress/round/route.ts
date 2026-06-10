import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  ANATOMY_STUDY_CATEGORIES,
  ANATOMY_STUDY_REGION_ORDER,
  FLASHCARD_PROMPT_TYPES,
  getAnatomyStudyPrompts,
} from "@/lib/anatomy-study"
import { FLASHCARD_TOOL } from "@/lib/flashcard-community"
import {
  FLASHCARD_MASTERY_ROUND_KEY_PREFIX,
  flashcardMasteryRoundAchievementKey,
  normalizeFlashcardProgressMetadata,
  nextFlashcardProgressRoundMetadata,
} from "@/lib/flashcard-progress"
import { prisma } from "@/lib/prisma"

const emptyMediaOptions = { mediaUrlBySlug: new Map<string, string>() }

type ProgressRow = {
  id: string
  tool: string
  metadata: Prisma.JsonValue
  lastSeenAt: Date
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

function promptIdFromTool(tool: string) {
  const prefix = `${FLASHCARD_TOOL}:`
  return tool.startsWith(prefix) ? tool.slice(prefix.length) : ""
}

async function optionalMediaOptions() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const { loadAnatomyStudyMediaUrlOptions } = await import("@/lib/anatomy-study-media")

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

function allPromptCount(options: typeof emptyMediaOptions) {
  return getAnatomyStudyPrompts({
    categories: [...ANATOMY_STUDY_CATEGORIES],
    regions: [...ANATOMY_STUDY_REGION_ORDER],
    difficulty: "hard",
    promptTypes: [...FLASHCARD_PROMPT_TYPES],
    answerMode: "typed",
  }, options).length
}

function latestProgressByPromptId(rows: ProgressRow[]) {
  const progressByPromptId = new Map<string, ReturnType<typeof normalizeFlashcardProgressMetadata>>()

  for (const row of rows) {
    const metadata = normalizeFlashcardProgressMetadata(row.metadata)
    const promptId = metadata.promptId || promptIdFromTool(row.tool)
    if (!promptId || progressByPromptId.has(promptId)) continue

    progressByPromptId.set(promptId, { ...metadata, promptId })
  }

  return [...progressByPromptId.values()]
}

export async function POST() {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to manage flashcard mastery rounds." }, { status: 401 })
  }

  const mediaOptions = await optionalMediaOptions()
  const targetPromptCount = allPromptCount(mediaOptions)
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
  const progressRecords = latestProgressByPromptId(progressRows)
  const masteredPromptCount = progressRecords.filter((record) => record.correctCount >= record.masteryThreshold).length
  const trackedPromptCount = progressRecords.length
  const totalAttempts = progressRecords.reduce((sum, record) => sum + record.lifetimeAttemptCount, 0)
  const totalCorrect = progressRecords.reduce((sum, record) => sum + record.lifetimeCorrectCount, 0)
  const totalIncorrect = progressRecords.reduce((sum, record) => sum + record.lifetimeIncorrectCount, 0)
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

  const completedRoundCount = await prisma.achievement.count({
    where: {
      userId: session.user.id,
      tool: FLASHCARD_TOOL,
      key: { startsWith: FLASHCARD_MASTERY_ROUND_KEY_PREFIX },
    },
  })
  const completedRound = completedRoundCount + 1
  const achievementKey = flashcardMasteryRoundAchievementKey(completedRound)
  const bestSession = await prisma.flashcardStudySession.findFirst({
    where: {
      userId: session.user.id,
      status: "COMPLETED",
      durationMs: { not: null },
    },
    select: { durationMs: true },
    orderBy: { durationMs: "asc" },
  })
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

  await prisma.$transaction(async (tx) => {
    await tx.achievement.upsert({
      where: { userId_key_tool: { userId: session.user.id, key: achievementKey, tool: FLASHCARD_TOOL } },
      create: {
        userId: session.user.id,
        key: achievementKey,
        tool: FLASHCARD_TOOL,
        metadata: json(snapshot),
      },
      update: {
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
  })

  return NextResponse.json({
    round: {
      ...snapshot,
      nextRound: completedRound + 1,
    },
    achievement: {
      key: achievementKey,
      earnedAt: now.toISOString(),
    },
  })
}
