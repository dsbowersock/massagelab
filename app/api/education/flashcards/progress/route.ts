import { NextResponse } from "next/server"
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
  FLASHCARD_MASTERY_THRESHOLD,
  roundNumberFromAchievementKey,
  normalizeFlashcardProgressMetadata,
} from "@/lib/flashcard-progress"
import { prisma } from "@/lib/prisma"

const emptyMediaOptions = { mediaUrlBySlug: new Map<string, string>() }

type FlashcardProgressResponse = {
  progress: {
    trackedPromptCount: number
    activePromptCount: number
    masteredPromptCount: number
    totalAttempts: number
    totalCorrect: number
    totalIncorrect: number
    accuracyPercent: number
    masteryThreshold: number
    completedSessionCount: number
    achievementCount: number
    bestDurationMs: number | null
    targetPromptCount: number
    roundCompletionPercent: number
    completedRoundCount: number
    currentRound: number
    canStartNextRound: boolean
  }
  recentProgress: Array<{
    promptId: string
    promptType: string
    entityType: string
    entitySlug: string
    status: string
    score: number | null
    attemptCount: number
    correctCount: number
    incorrectCount: number
    lifetimeAttemptCount: number
    lifetimeCorrectCount: number
    lifetimeIncorrectCount: number
    masteryThreshold: number
    masteryRound: number
    masteredAt: string | null
    lastSeenAt: string
  }>
  achievements: Array<{
    key: string
    earnedAt: string
  }>
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    nextPage: number | null
  }
}

type FlashcardProgressRecord = {
  status: string
  score: number | null
  lastSeenAt: Date
  metadata: ReturnType<typeof normalizeFlashcardProgressMetadata>
}

type ProgressAggregateRow = {
  trackedPromptCount: number
  masteredPromptCount: number
  totalAttempts: number
  totalCorrect: number
  totalIncorrect: number
  maxMasteryRound: number
}

type ProgressPageRow = {
  id: string
  tool: string
  status: string
  score: number | null
  metadata: unknown
  lastSeenAt: Date
}

function promptIdFromTool(tool: string) {
  const prefix = `${FLASHCARD_TOOL}:`
  return tool.startsWith(prefix) ? tool.slice(prefix.length) : ""
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  if (value === null || value.trim() === "") return fallback
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback

  return Math.max(min, Math.min(max, Math.trunc(numeric)))
}

function numberFromDb(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
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

export async function GET(request: Request): Promise<NextResponse<FlashcardProgressResponse | { error: string }>> {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to view flashcard progress." }, { status: 401 })
  }

  const url = new URL(request.url)
  const page = boundedInteger(url.searchParams.get("page"), 1, 1, 1000)
  const pageSize = boundedInteger(url.searchParams.get("pageSize"), 8, 1, 50)
  const skip = (page - 1) * pageSize
  const flashcardToolLike = `${FLASHCARD_TOOL}:%`
  const promptIdStart = `${FLASHCARD_TOOL}:`.length + 1
  const mediaOptions = await optionalMediaOptions()
  const targetPromptCount = allPromptCount(mediaOptions)

  const [
    progressRows,
    progressAggregateRows,
    completedSessionCount,
    bestSession,
    achievementCount,
    completedRoundCount,
    achievements,
  ] = await Promise.all([
    prisma.$queryRaw<ProgressPageRow[]>`
      WITH latest_progress AS (
        SELECT DISTINCT ON (prompt_id)
          "id",
          "tool",
          "status",
          "score",
          "metadata",
          "lastSeenAt",
          prompt_id
        FROM (
          SELECT
            "id",
            "tool",
            "status",
            "score",
            "metadata",
            "lastSeenAt",
            COALESCE(NULLIF("metadata"->>'promptId', ''), substring("tool" from ${promptIdStart})) AS prompt_id
          FROM "LearningProgress"
          WHERE "userId" = ${session.user.id}
            AND "anatomyTermId" IS NULL
            AND "tool" LIKE ${flashcardToolLike}
        ) scoped_progress
        WHERE prompt_id <> ''
        ORDER BY prompt_id, "lastSeenAt" DESC, "id" DESC
      )
      SELECT
        "id",
        "tool",
        "status",
        "score",
        "metadata",
        "lastSeenAt"
      FROM latest_progress
      ORDER BY "lastSeenAt" DESC, "id" DESC
      OFFSET ${skip}
      LIMIT ${pageSize}
    `,
    prisma.$queryRaw<ProgressAggregateRow[]>`
      WITH latest_progress AS (
        SELECT DISTINCT ON (prompt_id)
          "id",
          prompt_id,
          CASE WHEN "metadata"->>'attemptCount' ~ '^[0-9]+$' THEN ("metadata"->>'attemptCount')::int ELSE 0 END AS attempt_count,
          CASE WHEN "metadata"->>'correctCount' ~ '^[0-9]+$' THEN ("metadata"->>'correctCount')::int ELSE 0 END AS correct_count,
          CASE WHEN "metadata"->>'incorrectCount' ~ '^[0-9]+$' THEN ("metadata"->>'incorrectCount')::int ELSE 0 END AS incorrect_count,
          CASE WHEN "metadata"->>'lifetimeAttemptCount' ~ '^[0-9]+$' THEN ("metadata"->>'lifetimeAttemptCount')::int ELSE CASE WHEN "metadata"->>'attemptCount' ~ '^[0-9]+$' THEN ("metadata"->>'attemptCount')::int ELSE 0 END END AS lifetime_attempt_count,
          CASE WHEN "metadata"->>'lifetimeCorrectCount' ~ '^[0-9]+$' THEN ("metadata"->>'lifetimeCorrectCount')::int ELSE CASE WHEN "metadata"->>'correctCount' ~ '^[0-9]+$' THEN ("metadata"->>'correctCount')::int ELSE 0 END END AS lifetime_correct_count,
          CASE WHEN "metadata"->>'lifetimeIncorrectCount' ~ '^[0-9]+$' THEN ("metadata"->>'lifetimeIncorrectCount')::int ELSE CASE WHEN "metadata"->>'incorrectCount' ~ '^[0-9]+$' THEN ("metadata"->>'incorrectCount')::int ELSE 0 END END AS lifetime_incorrect_count,
          CASE WHEN "metadata"->>'masteryThreshold' ~ '^[0-9]+$' THEN ("metadata"->>'masteryThreshold')::int ELSE ${FLASHCARD_MASTERY_THRESHOLD} END AS mastery_threshold,
          CASE WHEN "metadata"->>'masteryRound' ~ '^[0-9]+$' THEN ("metadata"->>'masteryRound')::int ELSE 1 END AS mastery_round
        FROM (
          SELECT
            "id",
            "metadata",
            "lastSeenAt",
            COALESCE(NULLIF("metadata"->>'promptId', ''), substring("tool" from ${promptIdStart})) AS prompt_id
          FROM "LearningProgress"
          WHERE "userId" = ${session.user.id}
            AND "anatomyTermId" IS NULL
            AND "tool" LIKE ${flashcardToolLike}
        ) scoped_progress
        WHERE prompt_id <> ''
        ORDER BY prompt_id, "lastSeenAt" DESC, "id" DESC
      )
      SELECT
        COUNT(*)::int AS "trackedPromptCount",
        COALESCE(SUM(CASE WHEN correct_count >= mastery_threshold THEN 1 ELSE 0 END), 0)::int AS "masteredPromptCount",
        COALESCE(SUM(lifetime_attempt_count), 0)::int AS "totalAttempts",
        COALESCE(SUM(lifetime_correct_count), 0)::int AS "totalCorrect",
        COALESCE(SUM(lifetime_incorrect_count), 0)::int AS "totalIncorrect",
        COALESCE(MAX(mastery_round), 1)::int AS "maxMasteryRound"
      FROM latest_progress
    `,
    prisma.flashcardStudySession.count({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
      },
    }),
    prisma.flashcardStudySession.findFirst({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
        durationMs: { not: null },
      },
      select: { durationMs: true },
      orderBy: { durationMs: "asc" },
    }),
    prisma.achievement.count({
      where: {
        userId: session.user.id,
        tool: FLASHCARD_TOOL,
      },
    }),
    prisma.achievement.count({
      where: {
        userId: session.user.id,
        tool: FLASHCARD_TOOL,
        key: { startsWith: FLASHCARD_MASTERY_ROUND_KEY_PREFIX },
      },
    }),
    prisma.achievement.findMany({
      where: {
        userId: session.user.id,
        tool: FLASHCARD_TOOL,
      },
      take: 12,
      select: {
        key: true,
        earnedAt: true,
      },
      orderBy: { earnedAt: "desc" },
    }),
  ])

  const progressByPromptId = new Map<string, FlashcardProgressRecord>()

  for (const row of progressRows) {
    const metadata = normalizeFlashcardProgressMetadata(row.metadata)
    const promptId = metadata.promptId || promptIdFromTool(row.tool)
    if (!promptId || progressByPromptId.has(promptId)) continue

    progressByPromptId.set(promptId, {
      status: row.status,
      score: row.score,
      lastSeenAt: row.lastSeenAt,
      metadata: { ...metadata, promptId },
    })
  }

  const progressRecords = [...progressByPromptId.values()]
  const progressAggregate = progressAggregateRows[0]
  const trackedPromptCount = numberFromDb(progressAggregate?.trackedPromptCount)
  const masteredPromptCount = numberFromDb(progressAggregate?.masteredPromptCount)
  const totalAttempts = numberFromDb(progressAggregate?.totalAttempts)
  const totalCorrect = numberFromDb(progressAggregate?.totalCorrect)
  const totalIncorrect = numberFromDb(progressAggregate?.totalIncorrect)
  const currentRound = Math.max(1, numberFromDb(progressAggregate?.maxMasteryRound))
  const displayedCompletedRoundCount = achievements
    .map((achievement) => roundNumberFromAchievementKey(achievement.key))
    .filter((round) => round > 0)
    .length
  const roundCompletionPercent = targetPromptCount > 0
    ? Math.min(100, Math.round((masteredPromptCount / targetPromptCount) * 100))
    : 0
  const response: FlashcardProgressResponse = {
    progress: {
      trackedPromptCount,
      activePromptCount: Math.max(0, trackedPromptCount - masteredPromptCount),
      masteredPromptCount,
      totalAttempts,
      totalCorrect,
      totalIncorrect,
      accuracyPercent: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
      masteryThreshold: FLASHCARD_MASTERY_THRESHOLD,
      completedSessionCount,
      achievementCount,
      bestDurationMs: bestSession?.durationMs ?? null,
      targetPromptCount,
      roundCompletionPercent,
      completedRoundCount: Math.max(completedRoundCount, displayedCompletedRoundCount),
      currentRound,
      canStartNextRound: targetPromptCount > 0 && masteredPromptCount >= targetPromptCount,
    },
    recentProgress: progressRecords.map((record) => ({
      promptId: record.metadata.promptId,
      promptType: record.metadata.promptType,
      entityType: record.metadata.entityType,
      entitySlug: record.metadata.entitySlug,
      status: record.status,
      score: record.score,
      attemptCount: record.metadata.attemptCount,
      correctCount: record.metadata.correctCount,
      incorrectCount: record.metadata.incorrectCount,
      lifetimeAttemptCount: record.metadata.lifetimeAttemptCount,
      lifetimeCorrectCount: record.metadata.lifetimeCorrectCount,
      lifetimeIncorrectCount: record.metadata.lifetimeIncorrectCount,
      masteryThreshold: record.metadata.masteryThreshold,
      masteryRound: record.metadata.masteryRound,
      masteredAt: record.metadata.masteredAt ?? null,
      lastSeenAt: record.lastSeenAt.toISOString(),
    })),
    achievements: achievements.map((achievement) => ({
      key: achievement.key,
      earnedAt: achievement.earnedAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      totalRows: trackedPromptCount,
      nextPage: skip + progressRows.length < trackedPromptCount ? page + 1 : null,
    },
  }

  return NextResponse.json(response)
}
