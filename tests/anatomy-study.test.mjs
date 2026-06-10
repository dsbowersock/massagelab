import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { anatomyTerms as legacyAnatomyTerms } from "../lib/anatomy-legacy.js"
import {
  FLASHCARD_PROMPT_TYPES,
  checkFlashcardAnswer,
  createAnatomyStudyDeck,
  createFlashcardPromptDeck,
  createFlashcardPromptPool,
  getAnatomyStudyPrompts,
  getAnatomyStudyCards,
  getAnatomyStudyCategories,
  getAnatomyStudyRegions,
  getAnatomyStudySources,
  getFlashcardPromptTypeCounts,
  getLegacyAnatomyCoverageAudit,
  validateAnatomyStudyContent,
} from "../lib/anatomy-study.js"

const safeSourceIds = new Set([
  "applied-human-anatomy",
  "bodyparts3d",
  "human-bio-media",
  "openstax-human-biology",
  "servier-medical-art",
])
const bodyParts3dBicepsImageUrl = "https://media.massagelab.test/anatomy/bodyparts3d/anatomograms/biceps-brachii.png"
const bodyParts3dMediaUrlBySlug = new Map([["bodyparts3d-biceps-brachii-anatomogram", bodyParts3dBicepsImageUrl]])

describe("Sourced anatomy study adapter", () => {
  it("builds public study cards only from reviewed reusable study sources", () => {
    const cards = getAnatomyStudyCards()
    const sources = getAnatomyStudySources(cards)

    assert.deepEqual(validateAnatomyStudyContent(cards), [])
    assert.ok(cards.length > legacyAnatomyTerms.length)
    assert.ok(cards.some((card) => card.id === "muscle-trapezius"))
    assert.ok(cards.some((card) => card.id === "anatomy_structure-skull"))
    assert.equal(cards.some((card) => card.id === "anatomy_concept-energetic-anatomy"), false)
    assert.equal(sources.every((source) => safeSourceIds.has(source.id)), true)
  })

  it("filters by category, region, and public study depth", () => {
    const categories = getAnatomyStudyCategories()
    const regions = getAnatomyStudyRegions()
    const easyUpperMuscles = getAnatomyStudyCards({
      categories: ["muscle"],
      regions: ["upper-extremity"],
      difficulty: "easy",
    })
    const hardUpperMuscles = getAnatomyStudyCards({
      categories: ["muscle"],
      regions: ["upper-extremity"],
      difficulty: "hard",
    })

    assert.ok(categories.some((category) => category.id === "bone_landmark"))
    assert.ok(regions.some((region) => region.id === "thorax"))
    assert.ok(easyUpperMuscles.length > 0)
    assert.ok(hardUpperMuscles.length >= easyUpperMuscles.length)
    assert.equal(easyUpperMuscles.every((card) => card.category === "muscle"), true)
    assert.equal(easyUpperMuscles.every((card) => card.regions.includes("upper-extremity")), true)
    assert.equal(getAnatomyStudyCards({ categories: [], regions: ["head"] }).length, 0)
  })

  it("creates deterministic unique decks from sourced cards", () => {
    const firstDeck = createAnatomyStudyDeck({
      categories: ["muscle", "bone"],
      regions: ["head", "upper-extremity"],
      difficulty: "medium",
      count: 12,
      seed: "legacy-coverage",
    })
    const secondDeck = createAnatomyStudyDeck({
      categories: ["muscle", "bone"],
      regions: ["head", "upper-extremity"],
      difficulty: "medium",
      count: 12,
      seed: "legacy-coverage",
    })

    assert.equal(firstDeck.length, 12)
    assert.deepEqual(firstDeck.map((card) => card.id), secondDeck.map((card) => card.id))
    assert.equal(new Set(firstDeck.map((card) => card.id)).size, firstDeck.length)
  })

  it("selects reviewed reusable media when available", () => {
    const mediaCards = getAnatomyStudyCards({}, { mediaUrlBySlug: bodyParts3dMediaUrlBySlug }).filter((card) => card.media.length > 0)

    assert.ok(mediaCards.length > 0)
    assert.equal(mediaCards.every((card) => card.media.every((asset) => asset.url && safeSourceIds.has(asset.sourceRef))), true)
    assert.equal(mediaCards.every((card) => card.media.every((asset) => asset.sourceRef === "bodyparts3d")), true)
    assert.equal(mediaCards.every((card) => card.media.every((asset) => asset.sourceRef !== "servier-medical-art")), true)
    assert.equal(mediaCards.every((card) => card.media.every((asset) => !asset.url.includes("lifesciencedb.jp/bp3d/API"))), true)
  })

  it("promotes uploaded R2 media URLs without exposing unstable source API images", () => {
    const prompts = getAnatomyStudyPrompts({
      categories: ["muscle"],
      promptTypes: ["identify_from_media"],
      difficulty: "hard",
    }, {
      mediaUrlBySlug: bodyParts3dMediaUrlBySlug,
    })

    const uploadedPrompt = prompts.find((prompt) => prompt.front.media?.id === "bodyparts3d-biceps-brachii-anatomogram")

    assert.ok(uploadedPrompt)
    assert.equal(uploadedPrompt.front.media?.url, bodyParts3dBicepsImageUrl)
    assert.equal(uploadedPrompt.front.media?.sourceRef, "bodyparts3d")
    assert.equal(prompts.every((prompt) => prompt.front.media?.sourceRef !== "servier-medical-art"), true)
    assert.equal(prompts.every((prompt) => !prompt.front.media?.url.includes("lifesciencedb.jp/bp3d/API")), true)
  })

  it("generates sourced prompt modes with eligibility counts", () => {
    const prompts = getAnatomyStudyPrompts({ categories: ["muscle"], difficulty: "hard" })
    const allPrompts = getAnatomyStudyPrompts({}, { mediaUrlBySlug: bodyParts3dMediaUrlBySlug })
    const counts = getFlashcardPromptTypeCounts({ categories: ["muscle"], difficulty: "hard" })

    assert.equal(FLASHCARD_PROMPT_TYPES.every((type) => counts.some((count) => count.id === type)), true)
    assert.ok(allPrompts.some((prompt) => prompt.type === "identify_from_media" && prompt.front.mode === "media"))
    assert.ok(prompts.some((prompt) => prompt.type === "muscle_origin_insertion"))
    assert.ok(prompts.some((prompt) => prompt.type === "muscle_action"))
    assert.ok(prompts.some((prompt) => prompt.type === "muscle_innervation"))
    assert.equal(prompts.every((prompt) => prompt.sources.every((source) => safeSourceIds.has(source.id))), true)
    assert.equal(prompts.every((prompt) => prompt.answerFields.length > 0), true)
  })

  it("creates deterministic prompt decks from selected prompt types", () => {
    const options = {
      categories: ["muscle"],
      regions: ["upper-extremity"],
      difficulty: "medium",
      promptTypes: ["identify_from_media", "name_to_region"],
      count: 10,
      seed: "prompt-deck",
    }
    const firstDeck = createFlashcardPromptDeck(options)
    const secondDeck = createFlashcardPromptDeck(options)

    assert.equal(firstDeck.length, 10)
    assert.deepEqual(firstDeck.map((prompt) => prompt.id), secondDeck.map((prompt) => prompt.id))
    assert.equal(firstDeck.every((prompt) => options.promptTypes.includes(prompt.type)), true)
  })

  it("keeps a deterministic full prompt pool available before deck sizing", () => {
    const options = {
      categories: ["muscle"],
      regions: ["upper-extremity"],
      difficulty: "medium",
      promptTypes: ["name_to_region"],
      count: 3,
      seed: "skip-mastered",
    }
    const deck = createFlashcardPromptDeck(options)
    const pool = createFlashcardPromptPool(options)
    const masteredPromptIds = new Set(deck.map((prompt) => prompt.id))
    const replacementDeck = pool
      .filter((prompt) => !masteredPromptIds.has(prompt.id))
      .slice(0, options.count)

    assert.equal(deck.length, options.count)
    assert.ok(pool.length > deck.length)
    assert.deepEqual(deck.map((prompt) => prompt.id), pool.slice(0, options.count).map((prompt) => prompt.id))
    assert.equal(replacementDeck.length, options.count)
    assert.equal(replacementDeck.some((prompt) => masteredPromptIds.has(prompt.id)), false)
  })

  it("checks typed answers strictly while normalizing case and punctuation", () => {
    const prompt = getAnatomyStudyPrompts({ promptTypes: ["identify_from_media"] }, { mediaUrlBySlug: bodyParts3dMediaUrlBySlug })
      .find((candidate) => candidate.answerFields[0]?.acceptedAnswers.length > 1)

    assert.ok(prompt)
    const canonical = prompt.answerFields[0].answer
    const normalizedPunctuation = canonical.toUpperCase().replace(/\s+/g, "-")

    assert.equal(checkFlashcardAnswer(prompt, { name: normalizedPunctuation }).correct, true)
    assert.equal(checkFlashcardAnswer(prompt, { name: `${canonical}x` }).correct, false)
  })

  it("maps every archived Anatomime term to sourced or intentionally retyped foundation coverage", () => {
    const audit = getLegacyAnatomyCoverageAudit(legacyAnatomyTerms)
    const missing = audit.filter((row) => row.status === "missing")

    assert.equal(audit.length, 333)
    assert.deepEqual(missing, [])
    assert.equal(audit.every((row) => ["sourced", "mapped"].includes(row.status)), true)
    assert.equal(audit.find((row) => row.id === "muscle-interfoveolar")?.matchedCardId, "anatomy_structure-interfoveolar-ligament")
    assert.equal(audit.find((row) => row.id === "muscle-sphenomeniscus")?.matchedCardId, "muscle-lateral-pterygoid")
  })
})
