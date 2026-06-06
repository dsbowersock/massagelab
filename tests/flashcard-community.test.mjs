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
    })

    assert.deepEqual(config.categories, ["muscle"])
    assert.deepEqual(config.regions, ["head"])
    assert.equal(config.difficulty, "hard")
    assert.deepEqual(config.promptTypes, ["identify_from_media"])
    assert.equal(config.answerMode, "review")
    assert.equal(config.count, 100)
    assert.equal(config.seed, "user-seed")
  })

  it("defaults saved deck visibility to public and keeps private explicit", () => {
    assert.equal(normalizeDeckVisibility(undefined), "PUBLIC")
    assert.equal(normalizeDeckVisibility("public"), "PUBLIC")
    assert.equal(normalizeDeckVisibility("PRIVATE"), "PRIVATE")
    assert.equal(normalizeDeckVisibility("anything-else"), "PUBLIC")
  })

  it("ships public starter decks that resolve to eligible sourced prompts", () => {
    assert.ok(FLASHCARD_STARTER_DECKS.length >= 3)

    for (const deck of FLASHCARD_STARTER_DECKS) {
      assert.equal(deck.visibility, "PUBLIC")
      assert.equal(deck.isStarter, true)
      assert.ok(deck.promptCount > 0)
      assert.ok(promptCountForConfig(deck.config) >= deck.promptCount)
      assert.ok(deckPromptIds(deck.config).length > 0)
    }
  })

  it("counts uploaded media prompts when building starter deck summaries", () => {
    const uploadedUrl = "https://media.massagelab.test/anatomy/bodyparts3d/anatomograms/biceps-brachii.png"
    const hydratedDecks = getFlashcardStarterDecks({
      mediaUrlBySlug: new Map([["bodyparts3d-biceps-brachii-anatomogram", uploadedUrl]]),
    })
    const staticIdentificationDeck = FLASHCARD_STARTER_DECKS.find((deck) => deck.slug === "starter-all-body-identification")
    const hydratedIdentificationDeck = hydratedDecks.find((deck) => deck.slug === "starter-all-body-identification")

    assert.ok(staticIdentificationDeck)
    assert.ok(hydratedIdentificationDeck)
    assert.ok(hydratedIdentificationDeck.promptCount > staticIdentificationDeck.promptCount)
    assert.ok(promptCountForConfig(hydratedIdentificationDeck.config, {
      mediaUrlBySlug: new Map([["bodyparts3d-biceps-brachii-anatomogram", uploadedUrl]]),
    }) >= hydratedIdentificationDeck.promptCount)
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
})
