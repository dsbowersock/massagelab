import {
  ANATOMY_STUDY_CATEGORIES,
  ANATOMY_STUDY_REGION_ORDER,
  FLASHCARD_PROMPT_TYPES,
  createFlashcardPromptPool,
  getAnatomyStudyPrompts,
  type AnatomyStudyBuildOptions,
  type AnatomyStudyDifficulty,
  type FlashcardDeckConfig,
  type FlashcardPrompt,
  type FlashcardPromptType,
} from "./anatomy-study.ts"
import { FLASHCARD_TOOL } from "./flashcard-community.ts"

export const emptyFlashcardMediaOptions = { mediaUrlBySlug: new Map<string, string>() }

type FlashcardPromptCatalogSummary = {
  id: FlashcardPrompt["id"]
  type: FlashcardPrompt["type"]
  typeLabel: FlashcardPrompt["typeLabel"]
  cardId: FlashcardPrompt["cardId"]
  entityType: FlashcardPrompt["entityType"]
  entitySlug: FlashcardPrompt["entitySlug"]
  name: FlashcardPrompt["name"]
  category: FlashcardPrompt["category"]
  categoryLabel: FlashcardPrompt["categoryLabel"]
  regions: readonly FlashcardPrompt["regions"][number][]
  regionLabels: readonly string[]
  difficulty: FlashcardPrompt["difficulty"]
}

export type FlashcardPromptCatalog = {
  signature: string
  prompts: readonly FlashcardPrompt[]
  promptIds: readonly string[]
  promptById: ReadonlyMap<string, FlashcardPrompt>
  promptSummaries: readonly Readonly<FlashcardPromptCatalogSummary>[]
}

const promptCatalogCache = new Map<string, FlashcardPromptCatalog>()
const promptCatalogCacheLimit = 4
const difficultyRank: Record<AnatomyStudyDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}
const flashcardCategorySet = new Set<string>(ANATOMY_STUDY_CATEGORIES)
const flashcardPromptTypeSet = new Set<string>(FLASHCARD_PROMPT_TYPES)

export function flashcardPromptIdFromTool(tool: string) {
  const prefix = `${FLASHCARD_TOOL}:`
  return tool.startsWith(prefix) ? tool.slice(prefix.length) : ""
}

export async function optionalFlashcardMediaOptions() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const { loadAnatomyStudyMediaUrlOptions } = await import("./anatomy-study-media.ts")

    return await Promise.race([
      loadAnatomyStudyMediaUrlOptions(),
      new Promise<typeof emptyFlashcardMediaOptions>((resolve) => {
        timeoutId = setTimeout(() => resolve(emptyFlashcardMediaOptions), 1500)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function mediaUrlEntries(mediaUrlBySlug: AnatomyStudyBuildOptions["mediaUrlBySlug"]) {
  if (!mediaUrlBySlug) return []
  const entries = mediaUrlBySlug instanceof Map ? [...mediaUrlBySlug.entries()] : Object.entries(mediaUrlBySlug)

  return entries
    .filter(([, url]) => typeof url === "string" && url.trim().length > 0)
    .map(([slug, url]) => ({ slug, url }))
    .sort((left, right) => left.slug.localeCompare(right.slug))
}

function promptCatalogSignature(options: AnatomyStudyBuildOptions = {}) {
  return JSON.stringify({
    mediaUrlBySlug: mediaUrlEntries(options.mediaUrlBySlug),
    mediaAssets: (options.mediaAssets ?? [])
      .map((asset) => ({
        slug: asset.slug,
        title: asset.title,
        mediaType: asset.mediaType,
        sourceRef: asset.sourceRef,
        remoteUrl: asset.remoteUrl ?? "",
        thumbnailUrl: asset.thumbnailUrl ?? "",
        license: asset.license,
        attribution: asset.attribution,
        usageScope: asset.usageScope,
        reviewStatus: asset.reviewStatus,
      }))
      .sort((left, right) => left.slug.localeCompare(right.slug)),
    mediaEntityLinks: (options.mediaEntityLinks ?? [])
      .map((link) => ({
        assetSlug: link.assetSlug,
        entityType: link.entityType,
        entitySlug: link.entitySlug,
        role: link.role,
        reviewStatus: link.reviewStatus ?? "",
        displayPriority: link.displayPriority,
      }))
      .sort((left, right) => (
        left.assetSlug.localeCompare(right.assetSlug)
        || left.entityType.localeCompare(right.entityType)
        || left.entitySlug.localeCompare(right.entitySlug)
        || left.role.localeCompare(right.role)
      )),
  })
}

function promptSummary(prompt: FlashcardPrompt): Readonly<FlashcardPromptCatalogSummary> {
  return Object.freeze({
    id: prompt.id,
    type: prompt.type,
    typeLabel: prompt.typeLabel,
    cardId: prompt.cardId,
    entityType: prompt.entityType,
    entitySlug: prompt.entitySlug,
    name: prompt.name,
    category: prompt.category,
    categoryLabel: prompt.categoryLabel,
    regions: Object.freeze([...prompt.regions]),
    regionLabels: Object.freeze([...prompt.regionLabels]),
    difficulty: prompt.difficulty,
  })
}

function rememberPromptCatalog(signature: string, catalog: FlashcardPromptCatalog) {
  if (!promptCatalogCache.has(signature) && promptCatalogCache.size >= promptCatalogCacheLimit) {
    const oldestKey = promptCatalogCache.keys().next().value
    if (oldestKey) promptCatalogCache.delete(oldestKey)
  }

  promptCatalogCache.set(signature, catalog)
}

/**
 * Builds the current sourced flashcard prompt universe once for each media option signature.
 *
 * The route layer receives fresh DB-backed media options on each request; this cache only reuses
 * prompt construction when those reviewed media assets, links, and public URLs are unchanged.
 */
export function currentFlashcardPromptCatalog(options: AnatomyStudyBuildOptions = emptyFlashcardMediaOptions): FlashcardPromptCatalog {
  const signature = promptCatalogSignature(options)
  const cached = promptCatalogCache.get(signature)
  if (cached) return cached

  const prompts = getAnatomyStudyPrompts({
    categories: [...ANATOMY_STUDY_CATEGORIES],
    regions: [...ANATOMY_STUDY_REGION_ORDER],
    difficulty: "hard",
    promptTypes: [...FLASHCARD_PROMPT_TYPES],
    answerMode: "typed",
  }, options)
  const catalog: FlashcardPromptCatalog = {
    signature,
    prompts: Object.freeze([...prompts]),
    promptIds: Object.freeze(prompts.map((prompt) => prompt.id)),
    promptById: new Map(prompts.map((prompt) => [prompt.id, prompt])),
    promptSummaries: Object.freeze(prompts.map(promptSummary)),
  }

  rememberPromptCatalog(signature, catalog)
  return catalog
}

function selectedCategories(config: FlashcardDeckConfig) {
  const categories = config.categories ?? config.kinds
  if (!categories) return new Set(ANATOMY_STUDY_CATEGORIES)

  return new Set(categories.filter((category) => flashcardCategorySet.has(category)))
}

function selectedRegions(config: FlashcardDeckConfig) {
  return new Set(config.regions?.map(String) ?? ANATOMY_STUDY_REGION_ORDER)
}

function selectedPromptTypes(config: FlashcardDeckConfig) {
  if (!config.promptTypes || config.promptTypes.length === 0) return new Set(FLASHCARD_PROMPT_TYPES)

  return new Set(config.promptTypes.filter((type): type is FlashcardPromptType => flashcardPromptTypeSet.has(type)))
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

function shuffledFlashcardPrompts(prompts: readonly FlashcardPrompt[], seed?: string) {
  const nextPrompts = [...prompts]
  const rng = seed ? seededRng(seed) : Math.random

  for (let index = nextPrompts.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = nextPrompts[index]
    nextPrompts[index] = nextPrompts[swapIndex]
    nextPrompts[swapIndex] = current
  }

  return nextPrompts
}

function catalogSupportsConfig(config: FlashcardDeckConfig) {
  return !config.bodySystems || config.bodySystems.length === 0
}

export function getFlashcardPromptPoolFromCatalog(config: FlashcardDeckConfig = {}, options: AnatomyStudyBuildOptions = emptyFlashcardMediaOptions) {
  if (!catalogSupportsConfig(config)) return createFlashcardPromptPool(config, options)

  const categorySet = selectedCategories(config)
  const regionSet = selectedRegions(config)
  const promptTypeSet = selectedPromptTypes(config)
  if (categorySet.size === 0 || regionSet.size === 0 || promptTypeSet.size === 0) return []

  const maxDifficulty = difficultyRank[config.difficulty ?? "hard"]
  const selectedPromptIds = config.promptIds?.length ? new Set(config.promptIds) : null
  const prompts = currentFlashcardPromptCatalog(options).prompts.filter((prompt) => (
    categorySet.has(prompt.category) &&
    prompt.regions.some((region) => regionSet.has(region)) &&
    difficultyRank[prompt.difficulty] <= maxDifficulty &&
    promptTypeSet.has(prompt.type) &&
    (!selectedPromptIds || selectedPromptIds.has(prompt.id))
  ))

  return shuffledFlashcardPrompts(prompts, config.seed)
}

export function getFlashcardPromptDeckFromCatalog(config: FlashcardDeckConfig = {}, options: AnatomyStudyBuildOptions = emptyFlashcardMediaOptions) {
  const prompts = getFlashcardPromptPoolFromCatalog(config, options)

  return typeof config.count === "number" ? prompts.slice(0, Math.max(0, config.count)) : prompts
}

export function allFlashcardPrompts(options: AnatomyStudyBuildOptions = emptyFlashcardMediaOptions) {
  return [...currentFlashcardPromptCatalog(options).prompts]
}

export function allFlashcardPromptIds(options: AnatomyStudyBuildOptions = emptyFlashcardMediaOptions) {
  return new Set(currentFlashcardPromptCatalog(options).promptIds)
}
