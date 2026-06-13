import {
  ANATOMY_FOUNDATION_SEED,
  searchAnatomyFoundation,
  validateAnatomyFoundation,
} from "./anatomy-foundation.js"
import type {
  AnatomyCitation,
  AnatomyConcept,
  AnatomyEntityTerm,
  AnatomyEntityType,
  AnatomyFoundationSeed,
  AnatomyMediaAsset,
  AnatomyMediaEntityLink,
  AnatomySourceUsageScope,
  Bone,
  BoneLandmark,
  FoundationSource,
  Muscle,
  MuscleAction,
  MuscleAttachment,
  MuscleInnervation,
  AnatomyStructure,
} from "./anatomy-foundation.ts"
import { anatomyMediaReviewKey } from "./anatomy-media-review.js"

export const ANATOMY_STUDY_CATEGORIES = [
  "bone",
  "bone_landmark",
  "muscle",
  "anatomy_structure",
  "anatomy_concept",
] as const

export const ANATOMY_STUDY_DIFFICULTIES = ["easy", "medium", "hard"] as const

export const ANATOMY_STUDY_REGION_ORDER = [
  "head",
  "upper-extremity",
  "spine",
  "thorax",
  "abdomen",
  "pelvis",
  "lower-extremity",
] as const

export const ANATOMY_STUDY_CATEGORY_LABELS = {
  bone: "Bones",
  bone_landmark: "Bone Landmarks",
  muscle: "Muscles",
  anatomy_structure: "Structures",
  anatomy_concept: "Concepts",
} as const

export const ANATOMY_STUDY_REGION_LABELS = {
  head: "Head",
  "upper-extremity": "Upper Extremity",
  spine: "Spine",
  thorax: "Thorax",
  abdomen: "Abdomen",
  pelvis: "Pelvis",
  "lower-extremity": "Lower Extremity",
} as const

export const FLASHCARD_PROMPT_TYPES = [
  "anatomime_name_recall",
  "identify_from_media",
  "name_to_summary",
  "name_to_region",
  "name_to_category",
  "muscle_origin_insertion",
  "muscle_action",
  "muscle_innervation",
] as const

export const FLASHCARD_PROMPT_TYPE_LABELS = {
  anatomime_name_recall: "Anatomime Name Recall",
  identify_from_media: "Identify From Image",
  name_to_summary: "Recall Key Facts",
  name_to_region: "Identify Body Region",
  name_to_category: "Identify Structure Type",
  muscle_origin_insertion: "Muscle Origin And Insertion",
  muscle_action: "Muscle Action",
  muscle_innervation: "Muscle Innervation",
} as const

export const FLASHCARD_ANSWER_MODES = ["typed", "review"] as const

const COMMERCIAL_SAFE_SOURCE_SCOPES = new Set<AnatomySourceUsageScope>(["open_reuse", "commercial_licensed"])
const TERMINOLOGY_ONLY_SOURCE_REFS = new Set(["fipat-ta2"])
const PUBLIC_STUDY_SOURCE_REFS_EXCLUDED = new Set([
  "massagelab-authored-energetic-anatomy",
])
const PUBLIC_FLASHCARD_IMAGE_SOURCE_REFS = new Set(["bodyparts3d"])
const REUSABLE_SUMMARY_FACT_TYPES = new Set([
  "clinical_summary",
  "display_summary",
  "education_summary",
  "public_education",
  "anatomy_landmark",
  "anatomy_mapping",
  "seed_source_reference",
])

const categoryEntityTypes = new Set<AnatomyEntityType>(ANATOMY_STUDY_CATEGORIES)

export type AnatomyStudyCategory = typeof ANATOMY_STUDY_CATEGORIES[number]
export type AnatomyStudyDifficulty = typeof ANATOMY_STUDY_DIFFICULTIES[number]
export type AnatomyStudyRegion = typeof ANATOMY_STUDY_REGION_ORDER[number]

export type AnatomyStudySource = {
  id: string
  label: string
  url?: string
  license?: string
  attribution: string
  usageScope: AnatomySourceUsageScope
}

export type AnatomyStudyCitation = {
  id: string
  sourceRef: string
  factType: string
  sourceLocator?: string
  note?: string
}

export type AnatomyStudyMedia = {
  id: string
  title: string
  mediaType: string
  role: string
  url: string
  sourceRef: string
  license: string
  attribution: string
}

export type AnatomyStudyCard = {
  id: string
  entityType: AnatomyStudyCategory
  entitySlug: string
  category: AnatomyStudyCategory
  categoryLabel: string
  name: string
  formalName?: string
  aliases: string[]
  summary: string
  regions: AnatomyStudyRegion[]
  regionLabels: string[]
  foundationRegion: string
  difficulty: AnatomyStudyDifficulty
  sourceRefs: string[]
  sources: AnatomyStudySource[]
  citations: AnatomyStudyCitation[]
  media: AnatomyStudyMedia[]
}

export type AnatomyStudyCardFilters = {
  categories?: AnatomyStudyCategory[]
  kinds?: AnatomyStudyCategory[]
  regions?: AnatomyStudyRegion[] | string[]
  difficulty?: AnatomyStudyDifficulty
}

export type AnatomyStudyDeckOptions = AnatomyStudyCardFilters & {
  count?: number
  rng?: () => number
  seed?: string
}

export type FlashcardPromptType = typeof FLASHCARD_PROMPT_TYPES[number]
export type FlashcardAnswerMode = typeof FLASHCARD_ANSWER_MODES[number]

export type FlashcardDeckConfig = AnatomyStudyCardFilters & {
  promptTypes?: FlashcardPromptType[]
  answerMode?: FlashcardAnswerMode
  count?: number
  seed?: string
  promptIds?: string[]
}

export type FlashcardPromptFront = {
  mode: "text" | "media"
  title: string
  instruction: string
  media?: AnatomyStudyMedia
}

export type FlashcardAnswerField = {
  id: string
  label: string
  answer: string
  acceptedAnswers: string[]
}

export type FlashcardPrompt = {
  id: string
  type: FlashcardPromptType
  typeLabel: string
  cardId: string
  entityType: AnatomyStudyCategory
  entitySlug: string
  name: string
  aliases: string[]
  category: AnatomyStudyCategory
  categoryLabel: string
  regions: AnatomyStudyRegion[]
  regionLabels: string[]
  difficulty: AnatomyStudyDifficulty
  front: FlashcardPromptFront
  answerFields: FlashcardAnswerField[]
  answerSummary: string
  sources: AnatomyStudySource[]
  citations: AnatomyStudyCitation[]
}

export type FlashcardAnswerCheckResult = {
  correct: boolean
  score: number
  fields: Array<{
    id: string
    label: string
    expected: string
    received: string
    correct: boolean
  }>
}

export type LegacyAnatomyTermLike = {
  id: string
  name: string
  kind: string
  regions?: string[]
  difficulty?: string
  aliases?: string[]
}

export type LegacyAnatomyCoverageStatus = "sourced" | "mapped" | "excluded" | "missing"

export type LegacyAnatomyCoverageRow = {
  id: string
  name: string
  aliases: string[]
  kind: string
  regions: string[]
  difficulty?: string
  status: LegacyAnatomyCoverageStatus
  matchedCardId?: string
  matchedEntityType?: AnatomyStudyCategory
  matchedEntitySlug?: string
  matchedTerm?: string
  reason?: string
}

const LEGACY_STUDY_CARD_ID_OVERRIDES: Record<string, string> = {
  "bone-acetabulum": "bone_landmark-acetabulum",
  "bone-cranium": "bone-cranial-bones",
  "bone-cuneiforms": "anatomy_structure-cuneiform-bones",
  "bone-false-ribs": "anatomy_structure-false-ribs",
  "bone-floating-ribs": "anatomy_structure-floating-ribs",
  "bone-iliac-crest": "bone_landmark-iliac-crest",
  "bone-phalanges-foot": "bone-foot-phalanges",
  "bone-phalanges-hand": "bone-hand-phalanges",
  "bone-skull": "anatomy_structure-skull",
  "bone-spinous-process": "anatomy_structure-spinous-process",
  "bone-true-ribs": "anatomy_structure-true-ribs",
  "bone-vertebral-column": "anatomy_structure-vertebral-column",
  "muscle-auricular": "muscle-auricular-muscles",
}

type FoundationStudyEntity = Bone | BoneLandmark | Muscle | AnatomyStructure | AnatomyConcept

type BuildContext = {
  seed: AnatomyFoundationSeed
  sourceBySlug: Map<string, FoundationSource>
  safeSourceSlugs: Set<string>
  termsByEntity: Map<string, AnatomyEntityTerm[]>
  citationsByEntity: Map<string, AnatomyCitation[]>
  mediaLinksByEntity: Map<string, AnatomyMediaEntityLink[]>
  mediaBySlug: Map<string, AnatomyMediaAsset>
  mediaUrlBySlug: Map<string, string>
}

export type AnatomyStudyBuildOptions = {
  mediaUrlBySlug?: Map<string, string> | Record<string, string>
  mediaAssets?: AnatomyMediaAsset[]
  mediaEntityLinks?: AnatomyMediaEntityLink[]
}

function entityKey(entityType: AnatomyEntityType, entitySlug: string) {
  return `${entityType}:${entitySlug}`
}

function isSafeSource(source: FoundationSource | undefined) {
  return Boolean(source && COMMERCIAL_SAFE_SOURCE_SCOPES.has(source.usageScope ?? "review_only"))
}

function isPublicStudySource(source: FoundationSource | undefined) {
  return Boolean(isSafeSource(source) && source && !PUBLIC_STUDY_SOURCE_REFS_EXCLUDED.has(source.slug))
}

function sourceLabel(source: FoundationSource) {
  return source.name || source.slug
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

function regionForFoundationRegion(region: string): AnatomyStudyRegion {
  if (["head", "head-neck", "head-face-jaw", "face", "jaw", "neck", "anterior-neck", "lateral-neck", "posterior-neck", "base-of-skull"].includes(region)) {
    return "head"
  }
  if (["upper-limb", "shoulder-girdle", "glenohumeral-region", "rotator-cuff-region", "scapular-region", "upper-trapezius-area", "arm", "elbow", "forearm", "wrist", "hand"].includes(region)) {
    return "upper-extremity"
  }
  if (["trunk-spine-pelvis", "neck-shoulder-upper-back", "upper-back", "back", "lumbar-region", "thoracic-spine-region"].includes(region)) {
    return "spine"
  }
  if (region === "thorax") return "thorax"
  if (region === "abdomen") return "abdomen"
  if (region === "pelvis") return "pelvis"
  if (["lower-limb", "hip", "thigh", "knee", "leg", "ankle", "foot"].includes(region)) return "lower-extremity"

  return "spine"
}

function difficultyForEntity(entityType: AnatomyStudyCategory, entity: FoundationStudyEntity): AnatomyStudyDifficulty {
  if (entityType === "bone") return "easy"
  if (entityType === "bone_landmark") return "medium"
  if (entityType === "anatomy_concept") return "medium"
  if (entityType === "anatomy_structure") {
    const structure = entity as AnatomyStructure
    return ["bone group", "bony complex", "bony column", "rib group"].includes(structure.structureType) ? "easy" : "medium"
  }

  const muscle = entity as Muscle

  if (muscle.relativeDepth === "superficial") return "easy"
  if (muscle.relativeDepth === "intermediate" || muscle.relativeDepth === "variable") return "medium"

  return "hard"
}

function entityDisplayName(entityType: AnatomyStudyCategory, entity: FoundationStudyEntity) {
  if (entityType === "muscle") return (entity as Muscle).formalName
  if (entityType === "bone") return (entity as Bone).formalName

  return undefined
}

function entityRegion(entityType: AnatomyStudyCategory, entity: FoundationStudyEntity, context: BuildContext) {
  if (entityType === "bone_landmark") {
    const landmark = entity as BoneLandmark
    const parentBone = context.seed.bones.find((bone) => bone.slug === landmark.bone)

    return parentBone?.region ?? ("region" in entity ? entity.region : "spine")
  }

  return "region" in entity ? entity.region : "spine"
}

function seedSourceReferenceSupportsEntitySummary(citation: AnatomyCitation, entityType: AnatomyStudyCategory, entitySlug: string) {
  if (citation.factType !== "seed_source_reference") return true

  return citation.factSlug === `${entityType}:${entitySlug}`
}

function citationsForPublicSummary(
  citations: AnatomyCitation[],
  entityType: AnatomyStudyCategory,
  entitySlug: string,
  context: BuildContext,
) {
  return citations.filter((citation) => {
    if (citation.reviewStatus !== "reviewed") return false
    if (!REUSABLE_SUMMARY_FACT_TYPES.has(citation.factType)) return false
    if (TERMINOLOGY_ONLY_SOURCE_REFS.has(citation.sourceRef)) return false
    if (!seedSourceReferenceSupportsEntitySummary(citation, entityType, entitySlug)) return false

    return isPublicStudySource(context.sourceBySlug.get(citation.sourceRef))
  })
}

function aliasesForEntity(entityType: AnatomyStudyCategory, entity: FoundationStudyEntity, terms: AnatomyEntityTerm[], context: BuildContext) {
  const displayName = normalizeText(entity.name)
  const formalName = entityDisplayName(entityType, entity)
  const formalNormalized = formalName ? normalizeText(formalName) : ""
  const entityAlternateNames = "alternateNames" in entity ? entity.alternateNames : []
  const termAliases = terms
    .filter((term) => isPublicStudySource(context.sourceBySlug.get(term.sourceRef)))
    .filter((term) => !["preferred", "formal"].includes(term.termType))
    .map((term) => term.term)

  return unique([...entityAlternateNames, ...termAliases])
    .filter((alias) => {
      const normalized = normalizeText(alias)

      return normalized && normalized !== displayName && normalized !== formalNormalized
    })
    .slice(0, 10)
}

function publicMediaForEntity(entityType: AnatomyStudyCategory, entitySlug: string, context: BuildContext): AnatomyStudyMedia[] {
  const links = context.mediaLinksByEntity.get(entityKey(entityType, entitySlug)) ?? []

  return links
    .filter((link) => (link.reviewStatus ?? "approved") === "approved")
    .sort((left, right) => {
      const leftPriority = Number.isFinite(left.displayPriority) ? left.displayPriority as number : 100
      const rightPriority = Number.isFinite(right.displayPriority) ? right.displayPriority as number : 100
      if (leftPriority !== rightPriority) return leftPriority - rightPriority

      const rolePriority = (role: string) => role === "primary" ? 0 : role === "game_prompt" ? 1 : 2
      return rolePriority(left.role) - rolePriority(right.role)
    })
    .map((link): AnatomyStudyMedia | null => {
      const asset = context.mediaBySlug.get(link.assetSlug)
      if (!asset) return null
      if (asset.reviewStatus !== "reviewed") return null
      if (!COMMERCIAL_SAFE_SOURCE_SCOPES.has(asset.usageScope ?? "review_only")) return null
      if (!isPublicStudySource(context.sourceBySlug.get(asset.sourceRef))) return null
      if (!PUBLIC_FLASHCARD_IMAGE_SOURCE_REFS.has(asset.sourceRef)) return null

      const uploadedUrl = context.mediaUrlBySlug.get(asset.slug)
      const url = uploadedUrl ?? asset.remoteUrl ?? asset.thumbnailUrl
      if (!url || asset.mediaType === "model_3d") return null

      return {
        id: asset.slug,
        title: asset.title,
        mediaType: asset.mediaType,
        role: link.role,
        url,
        sourceRef: asset.sourceRef,
        license: asset.license,
        attribution: asset.attribution,
      }
    })
    .filter((asset): asset is AnatomyStudyMedia => Boolean(asset))
}

function publicSources(sourceRefs: Iterable<string>, context: BuildContext): AnatomyStudySource[] {
  return unique([...sourceRefs])
    .map((sourceRef) => context.sourceBySlug.get(sourceRef))
    .filter((source): source is FoundationSource => isPublicStudySource(source))
    .map((source) => ({
      id: source.slug,
      label: sourceLabel(source),
      url: source.url,
      license: source.license,
      attribution: source.attribution,
      usageScope: source.usageScope ?? "review_only",
    }))
}

function mediaUrlMap(mediaUrlBySlug: AnatomyStudyBuildOptions["mediaUrlBySlug"]) {
  if (!mediaUrlBySlug) return new Map<string, string>()
  if (mediaUrlBySlug instanceof Map) return mediaUrlBySlug

  return new Map(Object.entries(mediaUrlBySlug).filter(([, url]) => url.trim().length > 0))
}

function hasAnatomyStudyMediaOverrides(options: AnatomyStudyBuildOptions) {
  return Boolean(
    options.mediaUrlBySlug ||
    (options.mediaAssets && options.mediaAssets.length > 0) ||
    (options.mediaEntityLinks && options.mediaEntityLinks.length > 0),
  )
}

function mergedMediaAssets(seed: AnatomyFoundationSeed, mediaAssets: AnatomyStudyBuildOptions["mediaAssets"]) {
  const bySlug = new Map(seed.mediaAssets.map((asset) => [asset.slug, asset]))

  for (const asset of mediaAssets ?? []) {
    bySlug.set(asset.slug, asset)
  }

  return [...bySlug.values()]
}

function mediaLinkKey(link: AnatomyMediaEntityLink) {
  return anatomyMediaReviewKey({
    assetSlug: link.assetSlug,
    entityType: link.entityType,
    entitySlug: link.entitySlug,
    role: link.role,
  })
}

function mergedMediaEntityLinks(seed: AnatomyFoundationSeed, mediaEntityLinks: AnatomyStudyBuildOptions["mediaEntityLinks"]) {
  const byKey = new Map(seed.mediaEntityLinks.map((link) => [mediaLinkKey(link), link]))

  for (const link of mediaEntityLinks ?? []) {
    byKey.set(mediaLinkKey(link), link)
  }

  return [...byKey.values()]
}

function buildContext(seed: AnatomyFoundationSeed, options: AnatomyStudyBuildOptions = {}): BuildContext {
  const sourceBySlug = new Map(seed.sources.map((source) => [source.slug, source]))
  const safeSourceSlugs = new Set(seed.sources.filter(isSafeSource).map((source) => source.slug))
  const termsByEntity = new Map<string, AnatomyEntityTerm[]>()
  const citationsByEntity = new Map<string, AnatomyCitation[]>()
  const mediaLinksByEntity = new Map<string, AnatomyMediaEntityLink[]>()
  const mediaAssets = mergedMediaAssets(seed, options.mediaAssets)
  const mediaEntityLinks = mergedMediaEntityLinks(seed, options.mediaEntityLinks)

  seed.entityTerms.forEach((term) => {
    const key = entityKey(term.anatomyEntityType, term.anatomyEntitySlug)
    termsByEntity.set(key, [...(termsByEntity.get(key) ?? []), term])
  })
  seed.citations.forEach((citation) => {
    const key = entityKey(citation.entityType, citation.entitySlug)
    citationsByEntity.set(key, [...(citationsByEntity.get(key) ?? []), citation])
  })
  mediaEntityLinks.forEach((link) => {
    const key = entityKey(link.entityType, link.entitySlug)
    mediaLinksByEntity.set(key, [...(mediaLinksByEntity.get(key) ?? []), link])
  })

  return {
    seed,
    sourceBySlug,
    safeSourceSlugs,
    termsByEntity,
    citationsByEntity,
    mediaLinksByEntity,
    mediaBySlug: new Map(mediaAssets.map((asset) => [asset.slug, asset])),
    mediaUrlBySlug: mediaUrlMap(options.mediaUrlBySlug),
  }
}

function cardFromEntity(entityType: AnatomyStudyCategory, entity: FoundationStudyEntity, context: BuildContext): AnatomyStudyCard | null {
  const key = entityKey(entityType, entity.slug)
  const citations = context.citationsByEntity.get(key) ?? []
  const publicSummaryCitations = citationsForPublicSummary(citations, entityType, entity.slug, context)

  if (!entity.description || publicSummaryCitations.length === 0) return null

  const terms = context.termsByEntity.get(key) ?? []
  const media = publicMediaForEntity(entityType, entity.slug, context)
  const sourceRefs = new Set([
    ...publicSummaryCitations.map((citation) => citation.sourceRef),
    ...media.map((asset) => asset.sourceRef),
  ])
  const foundationRegion = entityRegion(entityType, entity, context)
  const studyRegion = regionForFoundationRegion(foundationRegion)

  return {
    id: `${entityType}-${entity.slug}`,
    entityType,
    entitySlug: entity.slug,
    category: entityType,
    categoryLabel: ANATOMY_STUDY_CATEGORY_LABELS[entityType],
    name: entity.name,
    formalName: entityDisplayName(entityType, entity),
    aliases: aliasesForEntity(entityType, entity, terms, context),
    summary: entity.description,
    regions: [studyRegion],
    regionLabels: [ANATOMY_STUDY_REGION_LABELS[studyRegion]],
    foundationRegion,
    difficulty: difficultyForEntity(entityType, entity),
    sourceRefs: [...sourceRefs],
    sources: publicSources(sourceRefs, context),
    citations: publicSummaryCitations.map((citation) => ({
      id: citation.slug,
      sourceRef: citation.sourceRef,
      factType: citation.factType,
      sourceLocator: citation.sourceLocator,
      note: citation.citationNote,
    })),
    media,
  }
}

function buildStudyCards(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED, options: AnatomyStudyBuildOptions = {}) {
  const context = buildContext(seed, options)
  const cards = [
    ...seed.bones.map((entity) => cardFromEntity("bone", entity, context)),
    ...seed.boneLandmarks.map((entity) => cardFromEntity("bone_landmark", entity, context)),
    ...seed.muscles.map((entity) => cardFromEntity("muscle", entity, context)),
    ...seed.structures.map((entity) => cardFromEntity("anatomy_structure", entity, context)),
    ...seed.concepts.map((entity) => cardFromEntity("anatomy_concept", entity, context)),
  ].filter((card): card is AnatomyStudyCard => Boolean(card))

  return cards.sort((a, b) => (
    ANATOMY_STUDY_REGION_ORDER.indexOf(a.regions[0]) - ANATOMY_STUDY_REGION_ORDER.indexOf(b.regions[0])
    || ANATOMY_STUDY_CATEGORIES.indexOf(a.category) - ANATOMY_STUDY_CATEGORIES.indexOf(b.category)
    || a.name.localeCompare(b.name)
  ))
}

const studyCards = buildStudyCards()

const difficultyRank: Record<AnatomyStudyDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

function normalizeCategories(filters: AnatomyStudyCardFilters) {
  const categories = filters.categories ?? filters.kinds
  if (!categories) return [...ANATOMY_STUDY_CATEGORIES]

  return categories.filter((category): category is AnatomyStudyCategory => categoryEntityTypes.has(category as AnatomyEntityType))
}

function filterStudyCards(cards: AnatomyStudyCard[], filters: AnatomyStudyCardFilters = {}) {
  const categories = normalizeCategories(filters)
  const regions = filters.regions?.map(String) ?? [...ANATOMY_STUDY_REGION_ORDER]
  const difficulty = filters.difficulty ?? "hard"

  if (categories.length === 0 || regions.length === 0) return []

  const regionSet = new Set(regions)
  const categorySet = new Set(categories)
  const maxDifficulty = difficultyRank[difficulty]

  return cards.filter((card) => (
    categorySet.has(card.category) &&
    card.regions.some((region) => regionSet.has(region)) &&
    difficultyRank[card.difficulty] <= maxDifficulty
  ))
}

export function getAnatomyStudyCards(filters: AnatomyStudyCardFilters = {}, options: AnatomyStudyBuildOptions = {}) {
  const cards = hasAnatomyStudyMediaOverrides(options) ? buildStudyCards(ANATOMY_FOUNDATION_SEED, options) : studyCards

  return filterStudyCards(cards, filters)
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

export function createAnatomyStudyDeck(options: AnatomyStudyDeckOptions = {}) {
  const cards = [...getAnatomyStudyCards(options)]
  const rng = options.rng ?? (options.seed ? seededRng(options.seed) : Math.random)

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = cards[index]
    cards[index] = cards[swapIndex]
    cards[swapIndex] = current
  }

  return typeof options.count === "number" ? cards.slice(0, Math.max(0, options.count)) : cards
}

function normalizePromptTypes(promptTypes?: readonly string[]) {
  if (!promptTypes || promptTypes.length === 0) return [...FLASHCARD_PROMPT_TYPES]
  const promptTypeSet = new Set<string>(FLASHCARD_PROMPT_TYPES)

  return unique(promptTypes.map(String)).filter((type): type is FlashcardPromptType => promptTypeSet.has(type))
}

function promptId(type: FlashcardPromptType, cardId: string, suffix?: string) {
  return suffix ? `${type}:${cardId}:${suffix}` : `${type}:${cardId}`
}

function promptSourceRefs(prompt: Pick<FlashcardPrompt, "citations" | "front">, card: AnatomyStudyCard) {
  const refs = new Set([
    ...prompt.citations.map((citation) => citation.sourceRef),
    ...(prompt.front.media ? [prompt.front.media.sourceRef] : []),
  ])

  return refs.size > 0 ? refs : new Set(card.sourceRefs)
}

function citationToStudyCitation(citation: AnatomyCitation): AnatomyStudyCitation {
  return {
    id: citation.slug,
    sourceRef: citation.sourceRef,
    factType: citation.factType,
    sourceLocator: citation.sourceLocator,
    note: citation.citationNote,
  }
}

function reviewedReusableFactCitations(
  card: AnatomyStudyCard,
  factType: string,
  factSlugs: readonly string[],
  context: BuildContext,
) {
  const factSlugSet = new Set(factSlugs)

  return (context.citationsByEntity.get(entityKey(card.entityType, card.entitySlug)) ?? [])
    .filter((citation) => citation.reviewStatus === "reviewed")
    .filter((citation) => citation.factType === factType && Boolean(citation.factSlug && factSlugSet.has(citation.factSlug)))
    .filter((citation) => isPublicStudySource(context.sourceBySlug.get(citation.sourceRef)))
    .map(citationToStudyCitation)
}

function factIsPublic(sourceRef: string, card: AnatomyStudyCard, factType: string, factSlugs: readonly string[], context: BuildContext) {
  if (!isPublicStudySource(context.sourceBySlug.get(sourceRef))) return false
  return reviewedReusableFactCitations(card, factType, factSlugs, context).some((citation) => citation.sourceRef === sourceRef)
}

function answerField(id: string, label: string, answer: string, acceptedAnswers: string[] = [answer]): FlashcardAnswerField {
  return {
    id,
    label,
    answer,
    acceptedAnswers: unique([answer, ...acceptedAnswers]).filter((value) => value.trim().length > 0),
  }
}

function basePrompt(
  card: AnatomyStudyCard,
  type: FlashcardPromptType,
  front: FlashcardPromptFront,
  answerFields: FlashcardAnswerField[],
  citations: AnatomyStudyCitation[],
  context: BuildContext,
): FlashcardPrompt {
  const sourceRefs = promptSourceRefs({ citations, front }, card)

  return {
    id: promptId(type, card.id, front.media?.id),
    type,
    typeLabel: FLASHCARD_PROMPT_TYPE_LABELS[type],
    cardId: card.id,
    entityType: card.entityType,
    entitySlug: card.entitySlug,
    name: card.name,
    aliases: card.aliases,
    category: card.category,
    categoryLabel: card.categoryLabel,
    regions: card.regions,
    regionLabels: card.regionLabels,
    difficulty: card.difficulty,
    front,
    answerFields,
    answerSummary: answerFields.map((field) => `${field.label}: ${field.answer}`).join("\n"),
    sources: publicSources(sourceRefs, context),
    citations,
  }
}

function mediaPromptsForCard(card: AnatomyStudyCard, context: BuildContext): FlashcardPrompt[] {
  return card.media
    .filter((media) => ["image", "diagram"].includes(media.mediaType))
    .map((media) => basePrompt(
      card,
      "identify_from_media",
      {
        mode: "media",
        title: "Identify this anatomy item",
        instruction: "Type the anatomical name shown by the reviewed image or diagram.",
        media,
      },
      [answerField("name", "Name", card.name, [card.formalName ?? "", ...card.aliases])],
      card.citations,
      context,
    ))
}

function summaryPromptForCard(card: AnatomyStudyCard, context: BuildContext) {
  return basePrompt(
    card,
    "name_to_summary",
    {
      mode: "text",
      title: card.name,
      instruction: "Type the sourced summary for this anatomy item, then check your spelling against the answer.",
    },
    [answerField("summary", "Summary", card.summary)],
    card.citations,
    context,
  )
}

function regionPromptForCard(card: AnatomyStudyCard, context: BuildContext) {
  return basePrompt(
    card,
    "name_to_region",
    {
      mode: "text",
      title: card.name,
      instruction: "Type the primary study region for this anatomy item.",
    },
    [answerField("region", "Region", card.regionLabels.join(", "), card.regionLabels)],
    card.citations,
    context,
  )
}

function categoryPromptForCard(card: AnatomyStudyCard, context: BuildContext) {
  return basePrompt(
    card,
    "name_to_category",
    {
      mode: "text",
      title: card.name,
      instruction: "Type the anatomy category for this item.",
    },
    [answerField("category", "Category", card.categoryLabel, [card.category, card.categoryLabel])],
    card.citations,
    context,
  )
}

function anatomimeNameRecallPromptForCard(card: AnatomyStudyCard, context: BuildContext) {
  return basePrompt(
    card,
    "anatomime_name_recall",
    {
      mode: "text",
      title: card.summary,
      instruction: "Type the anatomy item name that matches this sourced summary.",
    },
    [answerField("name", "Name", card.name, [card.formalName ?? "", ...card.aliases])],
    card.citations,
    context,
  )
}

function attachmentTarget(attachment: MuscleAttachment, context: BuildContext) {
  const landmark = attachment.landmark
    ? context.seed.boneLandmarks.find((item) => item.slug === attachment.landmark)?.name
    : ""
  const bone = context.seed.bones.find((item) => item.slug === attachment.bone)?.name ?? attachment.bone

  return landmark ? `${landmark} (${bone})` : bone
}

function combinedAnswer(values: string[]) {
  return unique(values.filter((value) => value.trim().length > 0)).join("; ")
}

function originInsertionPromptForCard(card: AnatomyStudyCard, context: BuildContext) {
  if (card.entityType !== "muscle") return null

  const attachments = context.seed.muscleAttachments.filter((attachment) => attachment.muscle === card.entitySlug)
  const origins = attachments.filter((attachment) => attachment.type === "origin")
  const insertions = attachments.filter((attachment) => attachment.type === "insertion")
  const originCitations = reviewedReusableFactCitations(card, "origin", origins.map((origin) => origin.id), context)
  const insertionCitations = reviewedReusableFactCitations(card, "insertion", insertions.map((insertion) => insertion.id), context)
  const publicOrigins = origins.filter((origin) => factIsPublic(origin.sourceRef, card, "origin", [origin.id], context))
  const publicInsertions = insertions.filter((insertion) => factIsPublic(insertion.sourceRef, card, "insertion", [insertion.id], context))

  if (publicOrigins.length === 0 || publicInsertions.length === 0) return null

  const originAnswer = combinedAnswer(publicOrigins.map((origin) => origin.description))
  const insertionAnswer = combinedAnswer(publicInsertions.map((insertion) => insertion.description))

  return basePrompt(
    card,
    "muscle_origin_insertion",
    {
      mode: "text",
      title: card.name,
      instruction: "Type the origin and insertion for this muscle.",
    },
    [
      answerField("origin", "Origin", originAnswer, [
        combinedAnswer(publicOrigins.map((origin) => attachmentTarget(origin, context))),
      ]),
      answerField("insertion", "Insertion", insertionAnswer, [
        combinedAnswer(publicInsertions.map((insertion) => attachmentTarget(insertion, context))),
      ]),
    ],
    [...originCitations, ...insertionCitations],
    context,
  )
}

function actionLabel(action: MuscleAction, context: BuildContext) {
  const movement = context.seed.jointMovements.find((item) => item.slug === action.movement)?.movementName ?? action.movement
  const joint = context.seed.joints.find((item) => item.slug === action.joint)?.name ?? action.joint

  return `${movement} at ${joint}`
}

function actionPromptForCard(card: AnatomyStudyCard, context: BuildContext) {
  if (card.entityType !== "muscle") return null

  const actions = context.seed.muscleActions.filter((action) => action.muscle === card.entitySlug)
  const publicActions = actions.filter((action) => factIsPublic(action.sourceRef, card, "action", [action.id], context))
  if (publicActions.length === 0) return null

  const citations = reviewedReusableFactCitations(card, "action", publicActions.map((action) => action.id), context)
  const answer = combinedAnswer(publicActions.map((action) => action.description))

  return basePrompt(
    card,
    "muscle_action",
    {
      mode: "text",
      title: card.name,
      instruction: "Type the primary sourced action information for this muscle.",
    },
    [answerField("action", "Action", answer, [combinedAnswer(publicActions.map((action) => actionLabel(action, context)))])],
    citations,
    context,
  )
}

function innervationLabel(innervation: MuscleInnervation, context: BuildContext) {
  const nerve = context.seed.nerves.find((item) => item.slug === innervation.nerve)
  if (!nerve) return innervation.nerve
  const roots = nerve.nerveRoots.length > 0 ? ` (${nerve.nerveRoots.join(", ")})` : ""

  return `${nerve.name}${roots}`
}

function innervationPromptForCard(card: AnatomyStudyCard, context: BuildContext) {
  if (card.entityType !== "muscle") return null

  const innervations = context.seed.muscleInnervations.filter((innervation) => innervation.muscle === card.entitySlug)
  const publicInnervations = innervations.filter((innervation) => factIsPublic(innervation.sourceRef, card, "innervation", [innervation.id], context))
  if (publicInnervations.length === 0) return null

  const citations = reviewedReusableFactCitations(card, "innervation", publicInnervations.map((innervation) => innervation.id), context)
  const answer = combinedAnswer(publicInnervations.map((innervation) => innervation.description ?? innervationLabel(innervation, context)))

  return basePrompt(
    card,
    "muscle_innervation",
    {
      mode: "text",
      title: card.name,
      instruction: "Type the sourced innervation for this muscle.",
    },
    [answerField("innervation", "Innervation", answer, [combinedAnswer(publicInnervations.map((innervation) => innervationLabel(innervation, context)))])],
    citations,
    context,
  )
}

function promptsForCard(card: AnatomyStudyCard, context: BuildContext) {
  return [
    anatomimeNameRecallPromptForCard(card, context),
    ...mediaPromptsForCard(card, context),
    summaryPromptForCard(card, context),
    regionPromptForCard(card, context),
    categoryPromptForCard(card, context),
    originInsertionPromptForCard(card, context),
    actionPromptForCard(card, context),
    innervationPromptForCard(card, context),
  ].filter((prompt): prompt is FlashcardPrompt => Boolean(prompt))
}

export function getAnatomyStudyPrompts(config: FlashcardDeckConfig = {}, options: AnatomyStudyBuildOptions = {}) {
  const promptTypes = new Set(normalizePromptTypes(config.promptTypes))
  if (promptTypes.size === 0) return []
  const selectedPromptIds = config.promptIds?.length ? new Set(config.promptIds) : null

  const context = buildContext(ANATOMY_FOUNDATION_SEED, options)

  return getAnatomyStudyCards(config, options)
    .flatMap((card) => promptsForCard(card, context))
    .filter((prompt) => promptTypes.has(prompt.type))
    .filter((prompt) => !selectedPromptIds || selectedPromptIds.has(prompt.id))
}

export function createFlashcardPromptDeck(config: FlashcardDeckConfig = {}, options: AnatomyStudyBuildOptions = {}) {
  const prompts = createFlashcardPromptPool(config, options)

  return typeof config.count === "number" ? prompts.slice(0, Math.max(0, config.count)) : prompts
}

export function createFlashcardPromptPool(config: FlashcardDeckConfig = {}, options: AnatomyStudyBuildOptions = {}) {
  const prompts = [...getAnatomyStudyPrompts(config, options)]
  const rng = config.seed ? seededRng(config.seed) : Math.random

  for (let index = prompts.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = prompts[index]
    prompts[index] = prompts[swapIndex]
    prompts[swapIndex] = current
  }

  return prompts
}

export function getFlashcardPromptTypeCounts(config: Omit<FlashcardDeckConfig, "promptTypes"> = {}, options: AnatomyStudyBuildOptions = {}) {
  const prompts = getAnatomyStudyPrompts({ ...config, promptTypes: [...FLASHCARD_PROMPT_TYPES] }, options)

  return FLASHCARD_PROMPT_TYPES.map((type) => ({
    id: type,
    label: FLASHCARD_PROMPT_TYPE_LABELS[type],
    promptCount: prompts.filter((prompt) => prompt.type === type).length,
  }))
}

function normalizeAnswerText(value: string) {
  return normalizeText(value).replace(/\s+/g, " ")
}

function answerMatches(input: string, acceptedAnswers: string[]) {
  const normalizedInput = normalizeAnswerText(input)
  if (!normalizedInput) return false

  return acceptedAnswers.some((answer) => normalizeAnswerText(answer) === normalizedInput)
}

export function checkFlashcardAnswer(prompt: FlashcardPrompt, input: string | Record<string, string>): FlashcardAnswerCheckResult {
  const fields = prompt.answerFields.map((field) => {
    const received = typeof input === "string" ? input : input[field.id] ?? ""

    return {
      id: field.id,
      label: field.label,
      expected: field.answer,
      received,
      correct: answerMatches(received, field.acceptedAnswers),
    }
  })
  const correctCount = fields.filter((field) => field.correct).length

  return {
    correct: fields.every((field) => field.correct),
    score: fields.length > 0 ? Math.round((correctCount / fields.length) * 100) : 0,
    fields,
  }
}

export function getAnatomyStudyRegions(cards: AnatomyStudyCard[] = studyCards) {
  return ANATOMY_STUDY_REGION_ORDER.map((region) => ({
    id: region,
    label: ANATOMY_STUDY_REGION_LABELS[region],
    termCount: cards.filter((card) => card.regions.includes(region)).length,
  })).filter((region) => region.termCount > 0)
}

export function getAnatomyStudyCategories(cards: AnatomyStudyCard[] = studyCards) {
  return ANATOMY_STUDY_CATEGORIES.map((category) => ({
    id: category,
    label: ANATOMY_STUDY_CATEGORY_LABELS[category],
    termCount: cards.filter((card) => card.category === category).length,
  })).filter((category) => category.termCount > 0)
}

export function getAnatomyStudySources(cards: AnatomyStudyCard[] = studyCards) {
  const sourcesById = new Map<string, AnatomyStudySource>()

  cards.forEach((card) => {
    card.sources.forEach((source) => {
      sourcesById.set(source.id, source)
    })
  })

  return [...sourcesById.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function validateAnatomyStudyContent(cards: AnatomyStudyCard[] = studyCards) {
  const issues: string[] = []
  const foundationIssues = validateAnatomyFoundation()
  if (foundationIssues.length > 0) issues.push(...foundationIssues.map((issue) => `Foundation issue: ${issue}`))

  const cardIds = new Set<string>()

  cards.forEach((card) => {
    if (cardIds.has(card.id)) issues.push(`Duplicate anatomy study card id: ${card.id}`)
    cardIds.add(card.id)
    if (!card.name.trim()) issues.push(`Empty anatomy study card name: ${card.id}`)
    if (!card.summary.trim()) issues.push(`Empty anatomy study card summary: ${card.id}`)
    if (card.sources.length === 0) issues.push(`Missing anatomy study card source: ${card.id}`)
    if (card.citations.length === 0) issues.push(`Missing anatomy study card citation: ${card.id}`)

    card.sources.forEach((source) => {
      if (!COMMERCIAL_SAFE_SOURCE_SCOPES.has(source.usageScope) || PUBLIC_STUDY_SOURCE_REFS_EXCLUDED.has(source.id)) {
        issues.push(`Unsafe anatomy study source on ${card.id}: ${source.id}`)
      }
    })
    card.media.forEach((media) => {
      if (!media.url) issues.push(`Missing anatomy study media URL on ${card.id}: ${media.id}`)
    })
  })

  return issues
}

function directLegacyIdCard(cards: AnatomyStudyCard[], term: LegacyAnatomyTermLike) {
  return cards.find((card) => card.id === term.id)
}

export function getLegacyAnatomyCoverageAudit(legacyTerms: LegacyAnatomyTermLike[], seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED): LegacyAnatomyCoverageRow[] {
  const contextCards = seed === ANATOMY_FOUNDATION_SEED ? studyCards : buildStudyCards(seed)
  const cardById = new Map(contextCards.map((card) => [card.id, card]))
  const cardsByEntity = new Map(contextCards.map((card) => [entityKey(card.entityType, card.entitySlug), card]))
  const search = seed === ANATOMY_FOUNDATION_SEED
    ? searchAnatomyFoundation
    : (query: string) => searchAnatomyFoundationForSeed(query, seed)

  return legacyTerms.map((term) => {
    const overrideCard = LEGACY_STUDY_CARD_ID_OVERRIDES[term.id]
      ? cardById.get(LEGACY_STUDY_CARD_ID_OVERRIDES[term.id])
      : undefined
    if (overrideCard) {
      return legacyCoverageRow(term, overrideCard, "mapped", "legacy-id-override")
    }

    const directCard = cardById.get(term.id) ?? directLegacyIdCard(contextCards, term)
    if (directCard) {
      return legacyCoverageRow(term, directCard, "sourced")
    }

    const searchTerms = unique([term.name, ...(term.aliases ?? [])].filter(Boolean))

    for (const searchTerm of searchTerms) {
      const result = search(searchTerm)
        .map((entry) => cardsByEntity.get(entityKey(entry.entityType as AnatomyStudyCategory, entry.slug)))
        .find((card): card is AnatomyStudyCard => Boolean(card))

      if (result) {
        return legacyCoverageRow(term, result, "mapped", searchTerm)
      }
    }

    return {
      id: term.id,
      name: term.name,
      aliases: term.aliases ?? [],
      kind: term.kind,
      regions: term.regions ?? [],
      difficulty: term.difficulty,
      status: "missing",
      reason: "No public sourced study card or mapped sourced foundation entity matched this legacy term.",
    }
  })
}

function legacyCoverageRow(
  term: LegacyAnatomyTermLike,
  card: AnatomyStudyCard,
  status: "sourced" | "mapped",
  matchedTerm?: string,
): LegacyAnatomyCoverageRow {
  return {
    id: term.id,
    name: term.name,
    aliases: term.aliases ?? [],
    kind: term.kind,
    regions: term.regions ?? [],
    difficulty: term.difficulty,
    status,
    matchedCardId: card.id,
    matchedEntityType: card.entityType,
    matchedEntitySlug: card.entitySlug,
    matchedTerm,
  }
}

function searchAnatomyFoundationForSeed(query: string, seed: AnatomyFoundationSeed) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  const results: Array<{ entityType: AnatomyStudyCategory; slug: string }> = []
  const addResult = (entityType: AnatomyStudyCategory, slug: string, text?: string) => {
    if (!text || !normalizeText(text).includes(normalizedQuery)) return
    const key = `${entityType}:${slug}`
    if (!results.some((result) => `${result.entityType}:${result.slug}` === key)) {
      results.push({ entityType, slug })
    }
  }

  seed.bones.forEach((entity) => {
    addResult("bone", entity.slug, entity.slug)
    addResult("bone", entity.slug, entity.name)
    addResult("bone", entity.slug, entity.formalName)
  })
  seed.boneLandmarks.forEach((entity) => {
    addResult("bone_landmark", entity.slug, entity.slug)
    addResult("bone_landmark", entity.slug, entity.name)
  })
  seed.muscles.forEach((entity) => {
    addResult("muscle", entity.slug, entity.slug)
    addResult("muscle", entity.slug, entity.name)
    addResult("muscle", entity.slug, entity.formalName)
    entity.alternateNames.forEach((alias) => addResult("muscle", entity.slug, alias))
  })
  seed.structures.forEach((entity) => {
    addResult("anatomy_structure", entity.slug, entity.slug)
    addResult("anatomy_structure", entity.slug, entity.name)
  })
  seed.concepts.forEach((entity) => {
    addResult("anatomy_concept", entity.slug, entity.slug)
    addResult("anatomy_concept", entity.slug, entity.name)
  })
  seed.entityTerms.forEach((term) => {
    if (!categoryEntityTypes.has(term.anatomyEntityType)) return
    addResult(term.anatomyEntityType as AnatomyStudyCategory, term.anatomyEntitySlug, term.term)
  })

  return results
}
