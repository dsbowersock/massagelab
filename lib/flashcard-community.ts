import {
  ANATOMY_STUDY_CATEGORIES,
  ANATOMY_STUDY_DIFFICULTIES,
  ANATOMY_STUDY_REGION_ORDER,
  FLASHCARD_ANSWER_MODES,
  FLASHCARD_PROMPT_TYPES,
  createFlashcardPromptDeck,
  getAnatomyStudyPrompts,
} from "./anatomy-study.js"
import type {
  AnatomyStudyBuildOptions,
  AnatomyStudyCategory,
  AnatomyStudyDifficulty,
  AnatomyStudyRegion,
  FlashcardAnswerMode,
  FlashcardDeckConfig,
  FlashcardPromptType,
} from "./anatomy-study.ts"

export const FLASHCARD_TOOL = "flashcards"

export const FLASHCARD_ACHIEVEMENTS = {
  firstSavedDeck: "flashcards:first-saved-deck",
  firstPublicDeck: "flashcards:first-public-deck",
  firstCompletion: "flashcards:first-completion",
  perfectShortDeck: "flashcards:perfect-short-deck",
} as const

export type FlashcardDeckVisibility = "PUBLIC" | "PRIVATE"

export type FlashcardDeckSummary = {
  id: string
  slug: string
  title: string
  description: string
  config: NormalizedFlashcardDeckConfig
  visibility: FlashcardDeckVisibility
  promptCount: number
  completionCount: number
  attemptCount: number
  answeredCount: number
  correctCount: number
  accuracyPercent: number
  ownerName: string
  isOwner: boolean
  isStarter: boolean
  updatedAt?: string
}

export type FlashcardPromptResultSummary = {
  promptId: string
  promptType: FlashcardPromptType
  entityType: AnatomyStudyCategory
  entitySlug: string
  regions: AnatomyStudyRegion[]
  correct: boolean
  score: number
}

export type NormalizedFlashcardDeckConfig = {
  categories: AnatomyStudyCategory[]
  regions: AnatomyStudyRegion[]
  difficulty: AnatomyStudyDifficulty
  promptTypes: FlashcardPromptType[]
  answerMode: FlashcardAnswerMode
  count: number
  seed: string
}

const categorySet = new Set<string>(ANATOMY_STUDY_CATEGORIES)
const regionSet = new Set<string>(ANATOMY_STUDY_REGION_ORDER)
const difficultySet = new Set<string>(ANATOMY_STUDY_DIFFICULTIES)
const promptTypeSet = new Set<string>(FLASHCARD_PROMPT_TYPES)
const answerModeSet = new Set<string>(FLASHCARD_ANSWER_MODES)

const FLASHCARD_STARTER_DECK_CONFIGS = [
  {
    slug: "starter-all-body-identification",
    title: "All-body image identification",
    description: "Reviewed image prompts across the sourced anatomy library.",
    config: {
      categories: [...ANATOMY_STUDY_CATEGORIES],
      regions: [...ANATOMY_STUDY_REGION_ORDER],
      difficulty: "medium",
      promptTypes: ["identify_from_media"],
      answerMode: "typed",
      count: 20,
      seed: "starter-all-body-identification",
    },
  },
  {
    slug: "starter-muscle-attachments",
    title: "Muscle origins and insertions",
    description: "Sourced muscle attachment prompts for origin and insertion recall.",
    config: {
      categories: ["muscle"],
      regions: [...ANATOMY_STUDY_REGION_ORDER],
      difficulty: "hard",
      promptTypes: ["muscle_origin_insertion", "muscle_action", "muscle_innervation"],
      answerMode: "typed",
      count: 20,
      seed: "starter-muscle-attachments",
    },
  },
  {
    slug: "starter-regions-and-categories",
    title: "Regions and categories",
    description: "Fast recall for anatomy regions and entity categories.",
    config: {
      categories: [...ANATOMY_STUDY_CATEGORIES],
      regions: [...ANATOMY_STUDY_REGION_ORDER],
      difficulty: "easy",
      promptTypes: ["name_to_region", "name_to_category"],
      answerMode: "typed",
      count: 30,
      seed: "starter-regions-and-categories",
    },
  },
] satisfies Array<{
  slug: string
  title: string
  description: string
  config: NormalizedFlashcardDeckConfig
}>

export const FLASHCARD_STARTER_DECKS: FlashcardDeckSummary[] = getFlashcardStarterDecks()

function starterDeck(slug: string, title: string, description: string, config: NormalizedFlashcardDeckConfig, options: AnatomyStudyBuildOptions = {}): FlashcardDeckSummary {
  const promptCount = getAnatomyStudyPrompts(config, options).length

  return {
    id: slug,
    slug,
    title,
    description,
    config,
    visibility: "PUBLIC",
    promptCount,
    completionCount: 0,
    attemptCount: 0,
    answeredCount: 0,
    correctCount: 0,
    accuracyPercent: 0,
    ownerName: "MassageLab",
    isOwner: false,
    isStarter: true,
  }
}

export function getFlashcardStarterDecks(options: AnatomyStudyBuildOptions = {}) {
  return FLASHCARD_STARTER_DECK_CONFIGS.map((deck) => starterDeck(deck.slug, deck.title, deck.description, deck.config, options))
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function sanitizeSeed(value: unknown) {
  const seed = typeof value === "string" ? value.trim() : ""
  return seed.length > 0 ? seed.slice(0, 80) : `flashcards-${Date.now().toString(36)}`
}

function clampCount(value: unknown) {
  const count = Number(value)
  if (!Number.isFinite(count)) return 20

  return Math.min(100, Math.max(5, Math.trunc(count)))
}

export function normalizeFlashcardDeckConfig(input: unknown): NormalizedFlashcardDeckConfig {
  const record = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const categories = stringArray(record.categories ?? record.kinds)
    .filter((category): category is AnatomyStudyCategory => categorySet.has(category))
  const regions = stringArray(record.regions)
    .filter((region): region is AnatomyStudyRegion => regionSet.has(region))
  const promptTypes = stringArray(record.promptTypes)
    .filter((type): type is FlashcardPromptType => promptTypeSet.has(type))
  const difficulty = difficultySet.has(String(record.difficulty))
    ? String(record.difficulty) as AnatomyStudyDifficulty
    : "medium"
  const answerMode = answerModeSet.has(String(record.answerMode))
    ? String(record.answerMode) as FlashcardAnswerMode
    : "typed"

  return {
    categories: categories.length > 0 ? categories : [...ANATOMY_STUDY_CATEGORIES],
    regions: regions.length > 0 ? regions : [...ANATOMY_STUDY_REGION_ORDER],
    difficulty,
    promptTypes: promptTypes.length > 0 ? promptTypes : [...FLASHCARD_PROMPT_TYPES],
    answerMode,
    count: clampCount(record.count),
    seed: sanitizeSeed(record.seed),
  }
}

export function promptCountForConfig(config: FlashcardDeckConfig, options: AnatomyStudyBuildOptions = {}) {
  return getAnatomyStudyPrompts(config, options).length
}

export function deckPromptIds(config: FlashcardDeckConfig, options: AnatomyStudyBuildOptions = {}) {
  return createFlashcardPromptDeck(config, options).map((prompt) => prompt.id)
}

export function normalizeDeckVisibility(value: unknown): FlashcardDeckVisibility {
  return String(value ?? "PUBLIC").toUpperCase() === "PRIVATE" ? "PRIVATE" : "PUBLIC"
}

export function slugifyFlashcardDeckTitle(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return slug || "flashcard-deck"
}

export function accuracyPercent(correctCount: number, answeredCount: number) {
  if (answeredCount <= 0) return 0
  return Math.round((correctCount / answeredCount) * 100)
}

export function completionAchievementKeys(results: FlashcardPromptResultSummary[], config: NormalizedFlashcardDeckConfig) {
  const keys = new Set<string>([FLASHCARD_ACHIEVEMENTS.firstCompletion])
  const answeredCount = results.length
  const correctCount = results.filter((result) => result.correct).length

  if (answeredCount > 0 && answeredCount <= 20 && correctCount === answeredCount) {
    keys.add(FLASHCARD_ACHIEVEMENTS.perfectShortDeck)
  }
  for (const promptType of new Set(results.map((result) => result.promptType))) {
    keys.add(`flashcards:prompt-type:${promptType}`)
  }
  for (const region of new Set(results.flatMap((result) => result.regions))) {
    keys.add(`flashcards:region:${region}`)
  }
  for (const category of config.categories) {
    keys.add(`flashcards:category:${category}`)
  }

  return [...keys]
}
