import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FLASHCARD_ACHIEVEMENTS,
  FLASHCARD_STARTER_DECKS,
  accuracyPercent,
  completionAchievementKeys,
  deckPromptIds,
  getFlashcardStarterDecks,
  normalizeDeckVisibility,
  normalizeFlashcardDeckConfig,
  promptCountForConfig,
  slugifyFlashcardDeckTitle,
} from "../lib/flashcard-community.js"

const bodyParts3dBicepsImageUrl = "https://media.massagelab.test/anatomy/bodyparts3d/anatomograms/biceps-brachii.png"
const bodyParts3dMediaOptions = {
  mediaUrlBySlug: new Map([["bodyparts3d-biceps-brachii-anatomogram", bodyParts3dBicepsImageUrl]]),
}

describe("Flashcard community deck policy", () => {
  it("normalizes user deck configs to sourced prompt options", () => {
    const config = normalizeFlashcardDeckConfig({
      categories: ["muscle", "unsafe"],
      regions: ["head", "nope"],
      difficulty: "hard",
      promptTypes: ["identify_from_media", "fake"],
      answerMode: "review",
      count: 500,
      seed: "user-seed",
      promptIds: ["name_to_region:muscle-biceps-brachii", "", "name_to_region:muscle-biceps-brachii"],
    })

    assert.deepEqual(config.categories, ["muscle"])
    assert.deepEqual(config.regions, ["head"])
    assert.equal(config.difficulty, "hard")
    assert.deepEqual(config.promptTypes, ["identify_from_media"])
    assert.equal(config.answerMode, "review")
    assert.equal(config.count, 500)
    assert.equal(config.seed, "user-seed")
    assert.deepEqual(config.promptIds, ["name_to_region:muscle-biceps-brachii"])
  })

  it("defaults saved deck visibility to public and keeps private explicit", () => {
    assert.equal(normalizeDeckVisibility(undefined), "PUBLIC")
    assert.equal(normalizeDeckVisibility("public"), "PUBLIC")
    assert.equal(normalizeDeckVisibility("PRIVATE"), "PRIVATE")
    assert.equal(normalizeDeckVisibility("anything-else"), "PUBLIC")
  })

  it("ships public starter decks that resolve to eligible sourced prompts", () => {
    assert.ok(FLASHCARD_STARTER_DECKS.length >= 3)

    for (const deck of getFlashcardStarterDecks(bodyParts3dMediaOptions)) {
      assert.equal(deck.visibility, "PUBLIC")
      assert.equal(deck.isStarter, true)
      assert.ok(deck.promptCount > 0)
      assert.ok(promptCountForConfig(deck.config, bodyParts3dMediaOptions) >= deck.promptCount)
      assert.ok(deckPromptIds(deck.config, bodyParts3dMediaOptions).length > 0)
    }
  })

  it("counts uploaded media prompts when building starter deck summaries", () => {
    const hydratedDecks = getFlashcardStarterDecks(bodyParts3dMediaOptions)
    const staticIdentificationDeck = FLASHCARD_STARTER_DECKS.find((deck) => deck.slug === "starter-all-body-identification")
    const hydratedIdentificationDeck = hydratedDecks.find((deck) => deck.slug === "starter-all-body-identification")

    assert.ok(staticIdentificationDeck)
    assert.ok(hydratedIdentificationDeck)
    assert.ok(hydratedIdentificationDeck.promptCount > staticIdentificationDeck.promptCount)
    assert.ok(promptCountForConfig(hydratedIdentificationDeck.config, bodyParts3dMediaOptions) >= hydratedIdentificationDeck.promptCount)
  })

  it("summarizes aggregate accuracy without exposing attempt details", () => {
    assert.equal(accuracyPercent(0, 0), 0)
    assert.equal(accuracyPercent(7, 10), 70)
    assert.equal(slugifyFlashcardDeckTitle(" Shoulder & Neck! "), "shoulder-neck")
  })

  it("awards aggregate achievement keys from completed prompt summaries", () => {
    const config = normalizeFlashcardDeckConfig({
      categories: ["muscle"],
      regions: ["upper-extremity"],
      promptTypes: ["name_to_region"],
      count: 10,
    })
    const keys = completionAchievementKeys([
      {
        promptId: "name_to_region:muscle-biceps-brachii",
        promptType: "name_to_region",
        entityType: "muscle",
        entitySlug: "biceps-brachii",
        regions: ["upper-extremity"],
        correct: true,
        score: 100,
      },
    ], config)

    assert.ok(keys.includes(FLASHCARD_ACHIEVEMENTS.firstCompletion))
    assert.ok(keys.includes(FLASHCARD_ACHIEVEMENTS.perfectShortDeck))
    assert.ok(keys.includes("flashcards:prompt-type:name_to_region"))
    assert.ok(keys.includes("flashcards:region:upper-extremity"))
    assert.ok(keys.includes("flashcards:category:muscle"))
  })

  it("allows one-card and larger-than-preset flashcard decks", () => {
    assert.equal(normalizeFlashcardDeckConfig({ count: 1 }).count, 1)
    assert.equal(normalizeFlashcardDeckConfig({ count: 1000 }).count, 1000)
    assert.equal(normalizeFlashcardDeckConfig({ count: -20 }).count, 1)
  })

  it("limits generated decks to selected prompt ids when provided", () => {
    const config = normalizeFlashcardDeckConfig({
      categories: ["muscle"],
      regions: ["upper-extremity"],
      promptTypes: ["name_to_region"],
      promptIds: ["name_to_region:muscle-biceps-brachii"],
      count: 20,
      seed: "selected-prompts",
    })

    assert.deepEqual(deckPromptIds(config), ["name_to_region:muscle-biceps-brachii"])
  })
})
