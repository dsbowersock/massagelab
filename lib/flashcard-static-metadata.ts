import type { FlashcardDeckSummary, NormalizedFlashcardDeckConfig } from "./flashcard-community.ts"
import type { FlashcardAnswerMode, FlashcardPromptType } from "./anatomy-study.ts"

export type FlashcardSetupOption = {
  id: string
  label: string
  termCount?: number
}

export type FlashcardSourceSummary = {
  id: string
  label: string
  url?: string
  license?: string
  attribution: string
}

export type FlashcardPromptTypeCount = {
  id: FlashcardPromptType
  label: string
  promptCount: number
}

export const FLASHCARD_STATIC_CATEGORY_IDS = [
  "bone",
  "bone_landmark",
  "muscle",
  "anatomy_structure",
  "anatomy_concept",
] as const

export const FLASHCARD_STATIC_REGION_IDS = [
  "head",
  "upper-extremity",
  "spine",
  "thorax",
  "abdomen",
  "pelvis",
  "lower-extremity",
] as const

export const FLASHCARD_STATIC_PROMPT_TYPES: FlashcardPromptType[] = [
  "identify_from_media",
  "name_to_summary",
  "name_to_region",
  "name_to_category",
  "muscle_origin_insertion",
  "muscle_action",
  "muscle_innervation",
]

export const FLASHCARD_STATIC_ANSWER_MODES: FlashcardAnswerMode[] = ["typed", "review"]

export const FLASHCARD_STATIC_CATEGORIES: FlashcardSetupOption[] = [
  { id: "bone", label: "Bones" },
  { id: "bone_landmark", label: "Bone Landmarks" },
  { id: "muscle", label: "Muscles" },
  { id: "anatomy_structure", label: "Structures" },
  { id: "anatomy_concept", label: "Concepts" },
]

export const FLASHCARD_STATIC_REGIONS: FlashcardSetupOption[] = [
  { id: "head", label: "Head" },
  { id: "upper-extremity", label: "Upper Extremity" },
  { id: "spine", label: "Spine" },
  { id: "thorax", label: "Thorax" },
  { id: "abdomen", label: "Abdomen" },
  { id: "pelvis", label: "Pelvis" },
  { id: "lower-extremity", label: "Lower Extremity" },
]

export const FLASHCARD_STATIC_PROMPT_TYPE_COUNTS: FlashcardPromptTypeCount[] = [
  { id: "identify_from_media", label: "Identify From Image", promptCount: 0 },
  { id: "name_to_summary", label: "Name To Summary", promptCount: 0 },
  { id: "name_to_region", label: "Name To Region", promptCount: 0 },
  { id: "name_to_category", label: "Name To Category", promptCount: 0 },
  { id: "muscle_origin_insertion", label: "Muscle Origin And Insertion", promptCount: 0 },
  { id: "muscle_action", label: "Muscle Action", promptCount: 0 },
  { id: "muscle_innervation", label: "Muscle Innervation", promptCount: 0 },
]

export const FLASHCARD_STATIC_SOURCES: FlashcardSourceSummary[] = []

const starterDeckConfigs = [
  {
    slug: "starter-all-body-identification",
    title: "All-body image identification",
    description: "Reviewed image prompts across the sourced anatomy library.",
    config: {
      categories: ["bone", "bone_landmark", "muscle", "anatomy_structure", "anatomy_concept"],
      regions: ["head", "upper-extremity", "spine", "thorax", "abdomen", "pelvis", "lower-extremity"],
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
      regions: ["head", "upper-extremity", "spine", "thorax", "abdomen", "pelvis", "lower-extremity"],
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
      categories: ["bone", "bone_landmark", "muscle", "anatomy_structure", "anatomy_concept"],
      regions: ["head", "upper-extremity", "spine", "thorax", "abdomen", "pelvis", "lower-extremity"],
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

export const FLASHCARD_STATIC_STARTER_DECKS: FlashcardDeckSummary[] = starterDeckConfigs.map((deck) => ({
  id: deck.slug,
  slug: deck.slug,
  title: deck.title,
  description: deck.description,
  config: deck.config,
  visibility: "PUBLIC",
  promptCount: deck.config.count,
  completionCount: 0,
  attemptCount: 0,
  answeredCount: 0,
  correctCount: 0,
  accuracyPercent: 0,
  ownerName: "MassageLab",
  isOwner: false,
  isStarter: true,
}))

export function getStaticStarterFlashcardDeck(slug: string) {
  return FLASHCARD_STATIC_STARTER_DECKS.find((deck) => deck.slug === slug) ?? null
}
