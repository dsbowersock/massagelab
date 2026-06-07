import type { ProgressStatus } from "@prisma/client"
import type { AnatomyStudyCategory, AnatomyStudyRegion, FlashcardPromptType } from "./anatomy-study.ts"
import { FLASHCARD_TOOL } from "./flashcard-community.ts"

export const FLASHCARD_MASTERY_THRESHOLD = 10

export type FlashcardProgressMetadata = {
  promptId: string
  promptType: FlashcardPromptType | string
  entityType: AnatomyStudyCategory | string
  entitySlug: string
  regions: AnatomyStudyRegion[]
  attemptCount: number
  correctCount: number
  incorrectCount: number
  currentCorrectStreak: number
  bestCorrectStreak: number
  masteryThreshold: number
  masteredAt?: string
  lastAnsweredAt?: string
  latestScore?: number
  bestScore?: number
}

export type FlashcardProgressUpdate = {
  status: ProgressStatus
  score: number
  metadata: FlashcardProgressMetadata
}

export type FlashcardProgressResult = {
  promptId: string
  promptType: FlashcardPromptType | string
  entityType: AnatomyStudyCategory | string
  entitySlug: string
  regions: AnatomyStudyRegion[]
  correct: boolean
  score: number
}

export type FlashcardProgressSummary = {
  trackedPromptCount: number
  activePromptCount: number
  masteredPromptCount: number
  totalAttempts: number
  totalCorrect: number
  totalIncorrect: number
  accuracyPercent: number
  masteryThreshold: number
}

export function flashcardProgressTool(promptId: string) {
  return `${FLASHCARD_TOOL}:${promptId}`
}

function recordFrom(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function count(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0
}

function boundedScore(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : undefined
}

function regions(value: unknown): AnatomyStudyRegion[] {
  return Array.isArray(value)
    ? value.filter((region): region is AnatomyStudyRegion => typeof region === "string")
    : []
}

export function normalizeFlashcardProgressMetadata(value: unknown): FlashcardProgressMetadata {
  const record = recordFrom(value)
  const correctCount = count(record.correctCount)
  const attemptCount = Math.max(count(record.attemptCount), correctCount + count(record.incorrectCount))
  const incorrectCount = Math.max(count(record.incorrectCount), attemptCount - correctCount)
  const currentCorrectStreak = Math.min(count(record.currentCorrectStreak), correctCount)
  const bestCorrectStreak = Math.max(count(record.bestCorrectStreak), currentCorrectStreak)

  return {
    promptId: text(record.promptId),
    promptType: text(record.promptType),
    entityType: text(record.entityType),
    entitySlug: text(record.entitySlug),
    regions: regions(record.regions),
    attemptCount,
    correctCount,
    incorrectCount,
    currentCorrectStreak,
    bestCorrectStreak,
    masteryThreshold: count(record.masteryThreshold) || FLASHCARD_MASTERY_THRESHOLD,
    masteredAt: text(record.masteredAt) || undefined,
    lastAnsweredAt: text(record.lastAnsweredAt) || undefined,
    latestScore: boundedScore(record.latestScore),
    bestScore: boundedScore(record.bestScore),
  }
}

export function isFlashcardProgressMastered(value: unknown) {
  const metadata = normalizeFlashcardProgressMetadata(value)
  return metadata.correctCount >= metadata.masteryThreshold
}

export function nextFlashcardProgressUpdate(
  existingMetadata: unknown,
  result: FlashcardProgressResult,
  answeredAt = new Date(),
): FlashcardProgressUpdate {
  const current = normalizeFlashcardProgressMetadata(existingMetadata)
  const answeredAtIso = answeredAt.toISOString()
  const correctCount = current.correctCount + (result.correct ? 1 : 0)
  const incorrectCount = current.incorrectCount + (result.correct ? 0 : 1)
  const attemptCount = correctCount + incorrectCount
  const currentCorrectStreak = result.correct ? current.currentCorrectStreak + 1 : 0
  const bestCorrectStreak = Math.max(current.bestCorrectStreak, currentCorrectStreak)
  const masteryThreshold = current.masteryThreshold || FLASHCARD_MASTERY_THRESHOLD
  const mastered = correctCount >= masteryThreshold
  const latestScore = Math.max(0, Math.min(100, Math.round(result.score)))
  const bestScore = Math.max(current.bestScore ?? 0, latestScore)

  return {
    status: mastered ? "MASTERED" : "PRACTICING",
    score: latestScore,
    metadata: {
      promptId: result.promptId,
      promptType: result.promptType,
      entityType: result.entityType,
      entitySlug: result.entitySlug,
      regions: result.regions,
      attemptCount,
      correctCount,
      incorrectCount,
      currentCorrectStreak,
      bestCorrectStreak,
      masteryThreshold,
      masteredAt: mastered ? (current.masteredAt ?? answeredAtIso) : undefined,
      lastAnsweredAt: answeredAtIso,
      latestScore,
      bestScore,
    },
  }
}

export function summarizeFlashcardProgress(metadataRows: unknown[]): FlashcardProgressSummary {
  const rows = metadataRows.map(normalizeFlashcardProgressMetadata).filter((row) => row.promptId)
  const totalAttempts = rows.reduce((sum, row) => sum + row.attemptCount, 0)
  const totalCorrect = rows.reduce((sum, row) => sum + row.correctCount, 0)
  const totalIncorrect = rows.reduce((sum, row) => sum + row.incorrectCount, 0)
  const masteredPromptCount = rows.filter((row) => row.correctCount >= row.masteryThreshold).length

  return {
    trackedPromptCount: rows.length,
    activePromptCount: rows.length - masteredPromptCount,
    masteredPromptCount,
    totalAttempts,
    totalCorrect,
    totalIncorrect,
    accuracyPercent: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    masteryThreshold: FLASHCARD_MASTERY_THRESHOLD,
  }
}
