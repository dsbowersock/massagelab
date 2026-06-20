"use client"

import type {
  AnatomyStudyDifficulty,
  FlashcardPrompt,
  FlashcardPromptType,
} from "@/lib/anatomy-study"
import type { NormalizedFlashcardDeckConfig } from "@/lib/flashcard-community"
import { FLASHCARD_STATIC_PROMPT_TYPES } from "@/lib/flashcard-static-metadata"

export type PromptTypeCount = {
  id: FlashcardPromptType
  label: string
  promptCount: number
}

export type PromptSummary = {
  id: string
  type: FlashcardPromptType
  typeLabel: string
  name: string
  categoryLabel: string
  regionLabels: string[]
  difficulty: AnatomyStudyDifficulty
}

export type FlashcardProgressDashboard = {
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

export type FlashcardRecentProgress = {
  promptId: string
  promptType: string
  promptTypeLabel: string
  entityType: string
  entitySlug: string
  name: string
  categoryLabel: string
  regionLabels: string[]
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
}

export type FlashcardAchievementSummary = {
  key: string
  earnedAt: string
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

export type FlashcardProgressPayload = {
  progress: FlashcardProgressDashboard
  recentProgress: FlashcardRecentProgress[]
  achievements: FlashcardAchievementSummary[]
  promptTypeProgress: FlashcardProgressBreakdownItem[]
  regionProgress: FlashcardProgressBreakdownItem[]
}

export type FlashcardSessionStartPayload = {
  id: string
  promptIds: string[]
  prompts: FlashcardPrompt[]
}

export type FlashcardPromptCatalogPayload = {
  promptTypeCounts: PromptTypeCount[]
  promptSummaries: PromptSummary[]
}

export type FlashcardProgressSessionResult =
  | { ok: true; session: FlashcardSessionStartPayload }
  | { ok: false; status: number; errorMessage: string }

export type FlashcardMasteryRoundResult =
  | { ok: true; completedRound: number; nextRound: number }
  | { ok: false; errorMessage: string }

function promptRows(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.filter((prompt): prompt is FlashcardPrompt => (
    Boolean(prompt && typeof prompt === "object" && !Array.isArray(prompt) && typeof (prompt as { id?: unknown }).id === "string")
  ))
}

export function sessionStartPayload(value: unknown): FlashcardSessionStartPayload {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const session = record.session && typeof record.session === "object" && !Array.isArray(record.session)
    ? record.session as Record<string, unknown>
    : {}
  const promptIds = Array.isArray(session.promptIds)
    ? session.promptIds.filter((promptId): promptId is string => typeof promptId === "string")
    : []

  return {
    id: typeof session.id === "string" ? session.id : "",
    promptIds,
    prompts: promptRows(session.prompts),
  }
}

export function promptDeckPayload(value: unknown) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return promptRows(record.prompts)
}

export function promptSummaryRows(value: unknown) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  if (!Array.isArray(record.promptSummaries)) return []

  return record.promptSummaries.map((item) => {
    const row = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {}

    return {
      id: text(row.id),
      type: text(row.type) as FlashcardPromptType,
      typeLabel: text(row.typeLabel),
      name: text(row.name),
      categoryLabel: text(row.categoryLabel),
      regionLabels: Array.isArray(row.regionLabels) ? row.regionLabels.map(String) : [],
      difficulty: text(row.difficulty) as AnatomyStudyDifficulty,
    }
  }).filter((prompt): prompt is PromptSummary => (
    Boolean(prompt.id && FLASHCARD_STATIC_PROMPT_TYPES.includes(prompt.type))
  ))
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

function nullableNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Converts the progress API response into the dashboard model used by the
 * flashcard client while tolerating partial or older response payloads.
 */
export function progressPayload(value: unknown): FlashcardProgressPayload | null {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const progress = record.progress && typeof record.progress === "object" && !Array.isArray(record.progress)
    ? record.progress as Record<string, unknown>
    : null

  if (!progress) return null

  const recentProgress = Array.isArray(record.recentProgress)
    ? record.recentProgress.map((item) => {
      const row = item && typeof item === "object" && !Array.isArray(item)
        ? item as Record<string, unknown>
        : {}

      return {
        promptId: text(row.promptId),
        promptType: text(row.promptType),
        promptTypeLabel: text(row.promptTypeLabel),
        entityType: text(row.entityType),
        entitySlug: text(row.entitySlug),
        name: text(row.name),
        categoryLabel: text(row.categoryLabel),
        regionLabels: Array.isArray(row.regionLabels) ? row.regionLabels.map(String).filter(Boolean) : [],
        status: text(row.status),
        score: nullableNumber(row.score),
        attemptCount: numeric(row.attemptCount),
        correctCount: numeric(row.correctCount),
        incorrectCount: numeric(row.incorrectCount),
        lifetimeAttemptCount: numeric(row.lifetimeAttemptCount, numeric(row.attemptCount)),
        lifetimeCorrectCount: numeric(row.lifetimeCorrectCount, numeric(row.correctCount)),
        lifetimeIncorrectCount: numeric(row.lifetimeIncorrectCount, numeric(row.incorrectCount)),
        masteryThreshold: numeric(row.masteryThreshold, 10),
        masteryRound: numeric(row.masteryRound, 1),
        masteredAt: text(row.masteredAt) || null,
        lastSeenAt: text(row.lastSeenAt),
      }
    }).filter((item) => item.promptId)
    : []
  const achievements = Array.isArray(record.achievements)
    ? record.achievements.map((item) => {
      const row = item && typeof item === "object" && !Array.isArray(item)
        ? item as Record<string, unknown>
        : {}

      return {
        key: text(row.key),
        earnedAt: text(row.earnedAt),
      }
    }).filter((item) => item.key)
    : []
  /**
   * Parses prompt-type or region breakdown rows from the progress API.
   */
  const breakdownRows = (value: unknown): FlashcardProgressBreakdownItem[] => (
    Array.isArray(value)
      ? value.map((item) => {
        const row = item && typeof item === "object" && !Array.isArray(item)
          ? item as Record<string, unknown>
          : {}

        return {
          key: text(row.key),
          label: text(row.label),
          totalCount: numeric(row.totalCount),
          trackedCount: numeric(row.trackedCount),
          masteredCount: numeric(row.masteredCount),
          remainingCount: numeric(row.remainingCount),
          completionPercent: numeric(row.completionPercent),
        }
      }).filter((item) => item.key && item.totalCount > 0)
      : []
  )

  return {
    progress: {
      trackedPromptCount: numeric(progress.trackedPromptCount),
      activePromptCount: numeric(progress.activePromptCount),
      masteredPromptCount: numeric(progress.masteredPromptCount),
      totalAttempts: numeric(progress.totalAttempts),
      totalCorrect: numeric(progress.totalCorrect),
      totalIncorrect: numeric(progress.totalIncorrect),
      accuracyPercent: numeric(progress.accuracyPercent),
      masteryThreshold: numeric(progress.masteryThreshold, 10),
      completedSessionCount: numeric(progress.completedSessionCount),
      achievementCount: numeric(progress.achievementCount),
      bestDurationMs: nullableNumber(progress.bestDurationMs),
      targetPromptCount: numeric(progress.targetPromptCount, numeric(progress.trackedPromptCount)),
      roundCompletionPercent: numeric(progress.roundCompletionPercent),
      completedRoundCount: numeric(progress.completedRoundCount),
      currentRound: numeric(progress.currentRound, 1),
      canStartNextRound: progress.canStartNextRound === true,
    },
    recentProgress,
    achievements,
    promptTypeProgress: breakdownRows(record.promptTypeProgress),
    regionProgress: breakdownRows(record.regionProgress),
  }
}

async function localPromptDeck(config: NormalizedFlashcardDeckConfig) {
  const { createFlashcardPromptDeck } = await import("@/lib/anatomy-study")

  return createFlashcardPromptDeck(config, { mediaUrlBySlug: new Map() })
}

async function localPromptTypeCounts(config: NormalizedFlashcardDeckConfig) {
  const { getFlashcardPromptTypeCounts } = await import("@/lib/anatomy-study")

  return getFlashcardPromptTypeCounts(config, { mediaUrlBySlug: new Map() })
}

async function localPromptSummaries(config: NormalizedFlashcardDeckConfig) {
  const { getAnatomyStudyPrompts } = await import("@/lib/anatomy-study")

  return getAnatomyStudyPrompts(config, { mediaUrlBySlug: new Map() }).map((prompt) => ({
    id: prompt.id,
    type: prompt.type,
    typeLabel: prompt.typeLabel,
    name: prompt.name,
    categoryLabel: prompt.categoryLabel,
    regionLabels: prompt.regionLabels,
    difficulty: prompt.difficulty,
  }))
}

export async function loadFlashcardProgressDashboard() {
  const response = await fetch("/api/education/flashcards/progress")
  if (!response.ok) return null

  return progressPayload(await response.json())
}

export async function loadFlashcardPromptCatalog(config: NormalizedFlashcardDeckConfig): Promise<FlashcardPromptCatalogPayload> {
  try {
    const response = await fetch("/api/education/flashcards/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, includePromptSummaries: true }),
    })
    const payload = response.ok ? await response.json() : null

    if (Array.isArray(payload?.promptTypeCounts)) {
      return {
        promptTypeCounts: payload.promptTypeCounts,
        promptSummaries: promptSummaryRows(payload),
      }
    }
  } catch {
    // Fall back to the browser-side sourced adapter below.
  }

  const [promptTypeCounts, promptSummaries] = await Promise.all([
    localPromptTypeCounts(config),
    localPromptSummaries(config),
  ])

  return { promptTypeCounts, promptSummaries }
}

export async function loadTemporaryFlashcardDeck(config: NormalizedFlashcardDeckConfig) {
  try {
    const response = await fetch("/api/education/flashcards/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, includePrompts: true }),
    })

    if (!response.ok) {
      throw new Error(`Prompt API returned ${response.status}.`)
    }

    const prompts = promptDeckPayload(await response.json())
    if (prompts.length === 0) {
      throw new Error("Prompt API returned no prompts.")
    }

    return prompts
  } catch (error) {
    console.warn("Falling back to local flashcard prompt generation", error)
  }

  return localPromptDeck(config)
}

export async function startFlashcardProgressSession({
  config,
  deckSlug,
  skipMastered,
}: {
  config: NormalizedFlashcardDeckConfig
  deckSlug: string
  skipMastered: boolean
}): Promise<FlashcardProgressSessionResult> {
  const response = await fetch("/api/education/flashcards/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deckSlug ? { deckSlug, skipMastered } : { config, skipMastered }),
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errorMessage: typeof payload?.error === "string" ? payload.error : "",
    }
  }

  return {
    ok: true,
    session: sessionStartPayload(payload),
  }
}

export async function startNextFlashcardMasteryRound(): Promise<FlashcardMasteryRoundResult> {
  const response = await fetch("/api/education/flashcards/progress/round", { method: "POST" })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return {
      ok: false,
      errorMessage: typeof payload?.error === "string" ? payload.error : "Next mastery round could not be started.",
    }
  }

  return {
    ok: true,
    completedRound: numeric(payload?.round?.round),
    nextRound: numeric(payload?.round?.nextRound),
  }
}
