import {
  ANATOMY_STUDY_CATEGORIES,
  ANATOMY_STUDY_CATEGORY_LABELS,
  ANATOMY_STUDY_DIFFICULTIES,
  ANATOMY_STUDY_REGION_LABELS,
  ANATOMY_STUDY_REGION_ORDER,
  checkFlashcardAnswer,
  createAnatomyStudyDeck,
  getAnatomyStudyCards,
  getAnatomyStudyCategories,
  getAnatomyStudyPrompts,
  getAnatomyStudyRegions,
  getAnatomyStudySources,
  type AnatomyStudyCard,
  type AnatomyStudyCategory,
  type AnatomyStudyDifficulty,
  type AnatomyStudyRegion,
} from "./anatomy-study.ts"
import { flashcardProgressTool, type FlashcardProgressResult } from "./flashcard-progress.ts"

export const ANATOMIME_TOOL = "anatomime"
export const ANATOMIME_NAME_RECALL_PROMPT_TYPE = "anatomime_name_recall"
export const ANATOMIME_DEFAULT_TERM_COUNT = 12
export const ANATOMIME_DEFAULT_ROUND_SECONDS = 30
export const ANATOMIME_DEFAULT_STEAL_SECONDS = 8
export const ANATOMIME_MAX_TERM_COUNT = 40
export const ANATOMIME_SESSION_TTL_HOURS = 6

export const ANATOMIME_ACHIEVEMENTS = {
  firstSharedGame: "anatomime:first-shared-game",
  firstCorrectGuess: "anatomime:first-correct-guess",
  firstSteal: "anatomime:first-steal",
  firstTeamWin: "anatomime:first-team-win",
} as const

export type AnatomimeAnswerMode = "typed" | "multiple-choice"
export type AnatomimeSessionStatus = "LOBBY" | "PLAYING" | "COMPLETED" | "EXPIRED"
export type AnatomimeSessionPhase = "LOBBY" | "ACTIVE" | "STEAL" | "REVIEW" | "COMPLETED"

export type AnatomimeSessionConfig = {
  categories: AnatomyStudyCategory[]
  regions: AnatomyStudyRegion[]
  difficulty: AnatomyStudyDifficulty
  answerMode: AnatomimeAnswerMode
  termCount: number
  roundSeconds: number
  stealSeconds: number
  seed: string
  selectedCardIds: string[]
  teamNames: string[]
}

export type AnatomimeTerm = {
  id: string
  name: string
  kind: AnatomyStudyCategory
  category: AnatomyStudyCategory
  categoryLabel: string
  regions: AnatomyStudyRegion[]
  regionLabels: string[]
  difficulty: AnatomyStudyDifficulty
  aliases: string[]
  definition?: string
  sourceRefs: string[]
}

export type AnatomimeScoringGuess = {
  id: string
  teamId: string
  correct: boolean
  scoreAwarded: number
  submittedAt: Date | string
}

const categorySet = new Set<string>(ANATOMY_STUDY_CATEGORIES)
const regionSet = new Set<string>(ANATOMY_STUDY_REGION_ORDER)
const difficultySet = new Set<string>(ANATOMY_STUDY_DIFFICULTIES)
const answerModeSet = new Set<string>(["typed", "multiple-choice"])

function recordFrom(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback

  return Math.max(min, Math.min(max, Math.trunc(numeric)))
}

function sanitizeSeed(value: unknown) {
  const seed = typeof value === "string" ? value.trim() : ""
  return seed.length > 0 ? seed.slice(0, 80) : `anatomime-${Date.now().toString(36)}`
}

function normalizeTeamName(value: unknown, index: number) {
  const name = typeof value === "string" ? value.trim() : ""
  return name || `Team ${index + 1}`
}

function seededRng(seed: string) {
  let state = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 16777619)
  }

  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], seed: string) {
  const rng = seededRng(seed)
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

export function normalizeAnatomimeSessionConfig(input: unknown): AnatomimeSessionConfig {
  const record = recordFrom(input)
  const categories = stringArray(record.categories ?? record.kinds)
    .filter((category): category is AnatomyStudyCategory => categorySet.has(category))
  const regions = stringArray(record.regions)
    .filter((region): region is AnatomyStudyRegion => regionSet.has(region))
  const difficulty = difficultySet.has(String(record.difficulty))
    ? String(record.difficulty) as AnatomyStudyDifficulty
    : "medium"
  const answerMode = answerModeSet.has(String(record.answerMode))
    ? String(record.answerMode) as AnatomimeAnswerMode
    : "typed"
  const selectedCardIds = stringArray(record.selectedCardIds ?? record.cardIds)
    .map((id) => id.trim())
    .filter(Boolean)
  const teamNames = stringArray(record.teamNames)
    .map(normalizeTeamName)
    .slice(0, 4)
  const normalizedTeamNames = teamNames.length >= 2 ? teamNames : ["Team 1", "Team 2"]

  return {
    categories: categories.length > 0 ? categories : [...ANATOMY_STUDY_CATEGORIES],
    regions: regions.length > 0 ? regions : [...ANATOMY_STUDY_REGION_ORDER],
    difficulty,
    answerMode,
    termCount: boundedInteger(record.termCount ?? record.count, ANATOMIME_DEFAULT_TERM_COUNT, 1, ANATOMIME_MAX_TERM_COUNT),
    roundSeconds: boundedInteger(record.roundSeconds, ANATOMIME_DEFAULT_ROUND_SECONDS, 10, 180),
    stealSeconds: boundedInteger(record.stealSeconds, ANATOMIME_DEFAULT_STEAL_SECONDS, 4, 30),
    seed: sanitizeSeed(record.seed),
    selectedCardIds: [...new Set(selectedCardIds)].slice(0, ANATOMIME_MAX_TERM_COUNT),
    teamNames: normalizedTeamNames,
  }
}

export function anatomimeTermFromCard(card: AnatomyStudyCard): AnatomimeTerm {
  return {
    id: card.id,
    name: card.name,
    kind: card.category,
    category: card.category,
    categoryLabel: card.categoryLabel,
    regions: card.regions,
    regionLabels: card.regionLabels,
    difficulty: card.difficulty,
    aliases: card.aliases,
    definition: card.summary,
    sourceRefs: card.sourceRefs,
  }
}

export function getAnatomimeSetupOptions() {
  const cards = getAnatomyStudyCards()

  return {
    categories: getAnatomyStudyCategories(cards),
    regions: getAnatomyStudyRegions(cards),
    sources: getAnatomyStudySources(cards),
  }
}

export function getAnatomimeCandidateCards(config: AnatomimeSessionConfig) {
  return getAnatomyStudyCards({
    categories: config.categories,
    regions: config.regions,
    difficulty: config.difficulty,
  })
}

export function createAnatomimeSessionDeck(configInput: unknown) {
  const config = normalizeAnatomimeSessionConfig(configInput)
  const candidates = getAnatomimeCandidateCards(config)

  if (config.selectedCardIds.length > 0) {
    const candidateById = new Map(candidates.map((card) => [card.id, card]))
    const selectedCards = config.selectedCardIds
      .map((id) => candidateById.get(id))
      .filter((card): card is AnatomyStudyCard => Boolean(card))
    const selectedIds = new Set(selectedCards.map((card) => card.id))
    const fillCards = createAnatomyStudyDeck({
      categories: config.categories,
      regions: config.regions,
      difficulty: config.difficulty,
      seed: `${config.seed}:fill`,
    }).filter((card) => !selectedIds.has(card.id))

    return [...selectedCards, ...fillCards].slice(0, config.termCount)
  }

  return createAnatomyStudyDeck({
    categories: config.categories,
    regions: config.regions,
    difficulty: config.difficulty,
    count: config.termCount,
    seed: config.seed,
  })
}

export function anatomimeNameRecallPromptId(cardId: string) {
  return `${ANATOMIME_NAME_RECALL_PROMPT_TYPE}:${cardId}`
}

export function anatomimeFlashcardProgressTool(cardId: string) {
  return flashcardProgressTool(anatomimeNameRecallPromptId(cardId))
}

export function getAnatomimeNameRecallPrompt(cardId: string) {
  return getAnatomyStudyPrompts({
    categories: [...ANATOMY_STUDY_CATEGORIES],
    regions: [...ANATOMY_STUDY_REGION_ORDER],
    difficulty: "hard",
    promptTypes: [ANATOMIME_NAME_RECALL_PROMPT_TYPE],
    promptIds: [anatomimeNameRecallPromptId(cardId)],
  })[0] ?? null
}

export function checkAnatomimeAnswer(card: AnatomyStudyCard, answer: string) {
  const prompt = getAnatomimeNameRecallPrompt(card.id)
  if (!prompt) return { correct: false, score: 0 }

  return checkFlashcardAnswer(prompt, answer)
}

export function anatomimeProgressResult(card: AnatomyStudyCard, correct: boolean, score: number): FlashcardProgressResult {
  return {
    promptId: anatomimeNameRecallPromptId(card.id),
    promptType: ANATOMIME_NAME_RECALL_PROMPT_TYPE,
    entityType: card.entityType,
    entitySlug: card.entitySlug,
    regions: card.regions,
    correct,
    score,
  }
}

export function buildAnatomimeMultipleChoiceOptions(card: AnatomyStudyCard, pool: AnatomyStudyCard[], seed: string, count = 4) {
  const distractors = shuffle(
    pool.filter((candidate) => candidate.id !== card.id),
    `${seed}:choices:${card.id}`,
  ).slice(0, Math.max(0, count - 1))

  return shuffle([card, ...distractors], `${seed}:choice-order:${card.id}`).map((candidate) => ({
    id: candidate.id,
    label: candidate.name,
  }))
}

export function canAwardImmediateScore(phase: AnatomimeSessionPhase, activeTeamId: string, guessTeamId: string, correct: boolean) {
  if (!correct) return false
  if (phase === "ACTIVE") return guessTeamId === activeTeamId
  if (phase === "STEAL") return guessTeamId !== activeTeamId

  return false
}

export function selectQueuedStealGuess(activeTeamId: string, guesses: AnatomimeScoringGuess[]) {
  return guesses
    .filter((guess) => guess.correct && guess.scoreAwarded === 0 && guess.teamId !== activeTeamId)
    .sort((first, second) => new Date(first.submittedAt).getTime() - new Date(second.submittedAt).getTime())[0] ?? null
}

export function nextActiveTeamOrder(currentOrder: number, teamCount: number) {
  if (teamCount <= 0) return 0
  return (currentOrder + 1) % teamCount
}

export function labelAnatomimeCategory(category: AnatomyStudyCategory) {
  return ANATOMY_STUDY_CATEGORY_LABELS[category]
}

export function labelAnatomimeRegion(region: AnatomyStudyRegion | string) {
  return ANATOMY_STUDY_REGION_LABELS[region as AnatomyStudyRegion] ?? region
}
