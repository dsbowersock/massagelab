import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { FLASHCARD_TOOL } from "@/lib/flashcard-community"
import {
  normalizeFlashcardProgressMetadata,
  summarizeFlashcardProgress,
} from "@/lib/flashcard-progress"
import { prisma } from "@/lib/prisma"

function promptIdFromTool(tool: string) {
  const prefix = `${FLASHCARD_TOOL}:`
  return tool.startsWith(prefix) ? tool.slice(prefix.length) : ""
}

export async function GET() {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to view flashcard progress." }, { status: 401 })
  }

  const [progressRows, completedSessionCount, bestSession, achievements] = await Promise.all([
    prisma.learningProgress.findMany({
      where: {
        userId: session.user.id,
        anatomyTermId: null,
        tool: { startsWith: `${FLASHCARD_TOOL}:` },
      },
      select: {
        tool: true,
        status: true,
        score: true,
        metadata: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
    }),
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
    prisma.achievement.findMany({
      where: {
        userId: session.user.id,
        tool: FLASHCARD_TOOL,
      },
      select: {
        key: true,
        earnedAt: true,
      },
      orderBy: { earnedAt: "desc" },
    }),
  ])

  const progressByPromptId = new Map<string, {
    status: string
    score: number | null
    lastSeenAt: Date
    metadata: ReturnType<typeof normalizeFlashcardProgressMetadata>
  }>()

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
  const summary = summarizeFlashcardProgress(progressRecords.map((record) => record.metadata))

  return NextResponse.json({
    progress: {
      ...summary,
      completedSessionCount,
      achievementCount: achievements.length,
      bestDurationMs: bestSession?.durationMs ?? null,
    },
    recentProgress: progressRecords.slice(0, 8).map((record) => ({
      promptId: record.metadata.promptId,
      promptType: record.metadata.promptType,
      entityType: record.metadata.entityType,
      entitySlug: record.metadata.entitySlug,
      status: record.status,
      score: record.score,
      attemptCount: record.metadata.attemptCount,
      correctCount: record.metadata.correctCount,
      incorrectCount: record.metadata.incorrectCount,
      masteryThreshold: record.metadata.masteryThreshold,
      masteredAt: record.metadata.masteredAt ?? null,
      lastSeenAt: record.lastSeenAt.toISOString(),
    })),
    achievements: achievements.slice(0, 12).map((achievement) => ({
      key: achievement.key,
      earnedAt: achievement.earnedAt.toISOString(),
    })),
  })
}
