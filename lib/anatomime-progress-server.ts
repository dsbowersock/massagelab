import type { Prisma } from "@prisma/client"
import {
  ANATOMIME_TOOL,
  anatomimeFlashcardProgressTool,
  anatomimeNameRecallPromptId,
  anatomimeProgressResult,
  getAnatomimeNameRecallPrompt,
} from "./anatomime-shared.ts"
import type { AnatomyStudyCard } from "./anatomy-study.ts"
import { nextFlashcardProgressUpdate } from "./flashcard-progress.ts"

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

function advisoryLockKey(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash | 0
}

export async function lockFlashcardLinkedProgress(tx: Prisma.TransactionClient, userId: string, tool: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${7341}, ${advisoryLockKey(`${userId}:${tool}`)})`
}

/**
 * Writes Anatomime name-recall progress through the same LearningProgress row
 * shape used by flashcards, keyed by the flashcard prompt id/tool instead of a
 * separate Anatomime-only mastery record.
 */
export async function updateAnatomimeNameRecallProgress(
  tx: Prisma.TransactionClient,
  input: {
    userId: string | null | undefined
    card: AnatomyStudyCard
    correct: boolean
    score: number
    source: "device-typed" | "device-choice"
  },
) {
  if (!input.userId) return null

  const prompt = getAnatomimeNameRecallPrompt(input.card.id)
  if (!prompt) return null

  const tool = anatomimeFlashcardProgressTool(input.card.id)
  await lockFlashcardLinkedProgress(tx, input.userId, tool)

  const existing = await tx.learningProgress.findFirst({
    where: {
      userId: input.userId,
      anatomyTermId: null,
      tool,
    },
    select: { id: true, metadata: true },
  })
  const update = nextFlashcardProgressUpdate(
    existing?.metadata,
    anatomimeProgressResult(input.card, input.correct, input.score),
  )
  const data = {
    status: update.status,
    score: update.score,
    metadata: json({
      ...update.metadata,
      promptId: anatomimeNameRecallPromptId(input.card.id),
      sourceTool: ANATOMIME_TOOL,
      source: input.source,
      cardId: input.card.id,
    }),
    lastSeenAt: new Date(),
  }

  if (existing) {
    return tx.learningProgress.update({ where: { id: existing.id }, data })
  }

  return tx.learningProgress.create({
    data: {
      userId: input.userId,
      anatomyTermId: null,
      tool,
      ...data,
    },
  })
}
