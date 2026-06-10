import type { ProgressStatus } from "@prisma/client"
import type { AnatomyStudyCategory, AnatomyStudyRegion, FlashcardPromptType } from "./anatomy-study.ts"
import { FLASHCARD_TOOL } from "./flashcard-community.ts"

export const FLASHCARD_MASTERY_THRESHOLD = 10
export const FLASHCARD_MASTERY_ROUND_KEY_PREFIX = `${FLASHCARD_TOOL}:mastery-round:`

export type FlashcardProgressMetadata = {
  promptId: string
  promptType: FlashcardPromptType | string
  entityType: AnatomyStudyCategory | string
  entitySlug: string
  regions: AnatomyStudyRegion[]
  attemptCount: number
  correctCount: number
  incorrectCount: number
  lifetimeAttemptCount: number
  lifetimeCorrectCount: number
  lifetimeIncorrectCount: number
  currentCorrectStreak: number
  bestCorrectStreak: number
  masteryThreshold: number
  masteryRound: number
  roundStartedAt?: string
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

export type FlashcardProgressBreakdownPrompt = {
  id: string
  promptType: FlashcardPromptType | string
  promptTypeLabel: string
  regionLabels: string[]
}

export type FlashcardProgressBreakdownItem = {
  key: string
  label: string
  totalCount: number
  trackedCount: number
  masteredCount: number
  remainingCount: number
  completionPercent: number
}

export type FlashcardProgressBreakdowns = {
  promptTypes: FlashcardProgressBreakdownItem[]
  regions: FlashcardProgressBreakdownItem[]
}

export function flashcardProgressTool(promptId: string) {
  return `${FLASHCARD_TOOL}:${promptId}`
}

export function flashcardMasteryRoundAchievementKey(round: number) {
  return `${FLASHCARD_MASTERY_ROUND_KEY_PREFIX}${Math.max(1, Math.trunc(round))}`
}

export function roundNumberFromAchievementKey(key: string) {
  if (!key.startsWith(FLASHCARD_MASTERY_ROUND_KEY_PREFIX)) return 0
  const round = Number(key.slice(FLASHCARD_MASTERY_ROUND_KEY_PREFIX.length))

  return Number.isFinite(round) && round > 0 ? Math.trunc(round) : 0
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
  const lifetimeCorrectCount = Math.max(count(record.lifetimeCorrectCount), correctCount)
  const lifetimeIncorrectCount = Math.max(count(record.lifetimeIncorrectCount), incorrectCount)
  const lifetimeAttemptCount = Math.max(count(record.lifetimeAttemptCount), lifetimeCorrectCount + lifetimeIncorrectCount)
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
    lifetimeAttemptCount,
    lifetimeCorrectCount,
    lifetimeIncorrectCount,
    currentCorrectStreak,
    bestCorrectStreak,
    masteryThreshold: count(record.masteryThreshold) || FLASHCARD_MASTERY_THRESHOLD,
    masteryRound: count(record.masteryRound) || 1,
    roundStartedAt: text(record.roundStartedAt) || undefined,
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
  const lifetimeCorrectCount = current.lifetimeCorrectCount + (result.correct ? 1 : 0)
  const lifetimeIncorrectCount = current.lifetimeIncorrectCount + (result.correct ? 0 : 1)
  const lifetimeAttemptCount = lifetimeCorrectCount + lifetimeIncorrectCount
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
      lifetimeAttemptCount,
      lifetimeCorrectCount,
      lifetimeIncorrectCount,
      currentCorrectStreak,
      bestCorrectStreak,
      masteryThreshold,
      masteryRound: current.masteryRound,
      roundStartedAt: current.roundStartedAt,
      masteredAt: mastered ? (current.masteredAt ?? answeredAtIso) : undefined,
      lastAnsweredAt: answeredAtIso,
      latestScore,
      bestScore,
    },
  }
}

export function nextFlashcardProgressRoundMetadata(existingMetadata: unknown, startedAt = new Date()): FlashcardProgressMetadata {
  const current = normalizeFlashcardProgressMetadata(existingMetadata)

  return {
    ...current,
    attemptCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    currentCorrectStreak: 0,
    bestCorrectStreak: 0,
    masteryRound: current.masteryRound + 1,
    roundStartedAt: startedAt.toISOString(),
    masteredAt: undefined,
    lastAnsweredAt: undefined,
    latestScore: undefined,
  }
}

export function summarizeFlashcardProgress(metadataRows: unknown[]): FlashcardProgressSummary {
  const rows = metadataRows.map(normalizeFlashcardProgressMetadata).filter((row) => row.promptId)
  const totalAttempts = rows.reduce((sum, row) => sum + row.lifetimeAttemptCount, 0)
  const totalCorrect = rows.reduce((sum, row) => sum + row.lifetimeCorrectCount, 0)
  const totalIncorrect = rows.reduce((sum, row) => sum + row.lifetimeIncorrectCount, 0)
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

/**
 * Creates a zeroed progress breakdown bucket before prompt progress is counted.
 */
function emptyBreakdownItem(key: string, label: string): FlashcardProgressBreakdownItem {
  return {
    key,
    label,
    totalCount: 0,
    trackedCount: 0,
    masteredCount: 0,
    remainingCount: 0,
    completionPercent: 0,
  }
}

/**
 * Computes derived completion fields and sorts unfinished breakdowns first.
 */
function finalizeBreakdownItems(items: Iterable<FlashcardProgressBreakdownItem>) {
  return [...items]
    .map((item) => ({
      ...item,
      remainingCount: Math.max(0, item.totalCount - item.masteredCount),
      completionPercent: item.totalCount > 0 ? Math.round((item.masteredCount / item.totalCount) * 100) : 0,
    }))
    .filter((item) => item.totalCount > 0)
    .sort((a, b) => b.remainingCount - a.remainingCount || a.label.localeCompare(b.label))
}

/**
 * Summarizes the current flashcard prompt set by prompt type and region,
 * combining latest progress metadata with all eligible sourced prompts.
 */
export function summarizeFlashcardProgressBreakdowns(
  metadataRows: unknown[],
  prompts: FlashcardProgressBreakdownPrompt[],
): FlashcardProgressBreakdowns {
  const progressByPromptId = new Map<string, FlashcardProgressMetadata>()

  for (const row of metadataRows) {
    const metadata = normalizeFlashcardProgressMetadata(row)
    if (!metadata.promptId || progressByPromptId.has(metadata.promptId)) continue

    progressByPromptId.set(metadata.promptId, metadata)
  }

  const promptTypeItems = new Map<string, FlashcardProgressBreakdownItem>()
  const regionItems = new Map<string, FlashcardProgressBreakdownItem>()

  for (const prompt of prompts) {
    if (!prompt.id) continue

    const promptTypeKey = String(prompt.promptType)
    const promptTypeLabel = prompt.promptTypeLabel || promptTypeKey
    const promptTypeItem = promptTypeItems.get(promptTypeKey) ?? emptyBreakdownItem(promptTypeKey, promptTypeLabel)
    const progress = progressByPromptId.get(prompt.id)
    const mastered = progress ? progress.correctCount >= progress.masteryThreshold : false

    promptTypeItem.totalCount += 1
    if (progress) promptTypeItem.trackedCount += 1
    if (mastered) promptTypeItem.masteredCount += 1
    promptTypeItems.set(promptTypeKey, promptTypeItem)

    const labels = prompt.regionLabels.length > 0 ? prompt.regionLabels : ["Unassigned"]
    for (const label of labels) {
      const regionKey = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unassigned"
      const regionItem = regionItems.get(regionKey) ?? emptyBreakdownItem(regionKey, label)

      regionItem.totalCount += 1
      if (progress) regionItem.trackedCount += 1
      if (mastered) regionItem.masteredCount += 1
      regionItems.set(regionKey, regionItem)
    }
  }

  return {
    promptTypes: finalizeBreakdownItems(promptTypeItems.values()),
    regions: finalizeBreakdownItems(regionItems.values()),
  }
}
