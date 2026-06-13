import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ANATOMIME_NAME_RECALL_PROMPT_TYPE,
  anatomimeFlashcardProgressTool,
  anatomimeNameRecallPromptId,
  buildAnatomimeMultipleChoiceOptions,
  canAwardImmediateScore,
  checkAnatomimeAnswer,
  createAnatomimeSessionDeck,
  getAnatomimeCandidateCards,
  getAnatomimeNameRecallPrompt,
  normalizeAnatomimeSessionConfig,
  selectQueuedStealGuess,
} from "../lib/anatomime-shared.js"

describe("Anatomime shared session helpers", () => {
  it("normalizes full anatomy setup options beyond legacy bones and muscles", () => {
    const config = normalizeAnatomimeSessionConfig({
      categories: ["muscle", "bone_landmark", "bad"],
      regions: ["upper-extremity", "bad-region"],
      difficulty: "hard",
      answerMode: "multiple-choice",
      termCount: 500,
      teamNames: ["Flexors", "Extensors", ""],
    })

    assert.deepEqual(config.categories, ["muscle", "bone_landmark"])
    assert.deepEqual(config.regions, ["upper-extremity"])
    assert.equal(config.difficulty, "hard")
    assert.equal(config.answerMode, "multiple-choice")
    assert.equal(config.termCount, 40)
    assert.deepEqual(config.teamNames, ["Flexors", "Extensors", "Team 3"])
  })

  it("creates deterministic decks from all sourced anatomy study categories", () => {
    const config = normalizeAnatomimeSessionConfig({
      categories: ["anatomy_structure", "anatomy_concept"],
      regions: ["thorax", "abdomen"],
      difficulty: "hard",
      termCount: 6,
      seed: "shared-test",
    })
    const firstDeck = createAnatomimeSessionDeck(config)
    const secondDeck = createAnatomimeSessionDeck(config)

    assert.equal(firstDeck.length, 6)
    assert.deepEqual(firstDeck.map((card) => card.id), secondDeck.map((card) => card.id))
    assert.ok(firstDeck.every((card) => ["anatomy_structure", "anatomy_concept"].includes(card.category)))
  })

  it("checks Anatomime guesses against the flashcard-linked name recall prompt", () => {
    const config = normalizeAnatomimeSessionConfig({
      categories: ["muscle"],
      regions: ["upper-extremity"],
      difficulty: "hard",
      termCount: 1,
      seed: "name-recall-test",
    })
    const card = getAnatomimeCandidateCards(config).find((candidate) => candidate.aliases.length > 0) ?? createAnatomimeSessionDeck(config)[0]
    const prompt = getAnatomimeNameRecallPrompt(card.id)

    assert.equal(prompt?.type, ANATOMIME_NAME_RECALL_PROMPT_TYPE)
    assert.equal(prompt?.id, anatomimeNameRecallPromptId(card.id))
    assert.equal(anatomimeFlashcardProgressTool(card.id), `flashcards:${prompt?.id}`)
    assert.equal(checkAnatomimeAnswer(card, card.name).correct, true)
    assert.equal(checkAnatomimeAnswer(card, `${card.name}x`).correct, false)
  })

  it("builds multiple-choice answers without exposing duplicate options", () => {
    const config = normalizeAnatomimeSessionConfig({
      categories: ["bone"],
      regions: ["head"],
      difficulty: "hard",
      termCount: 8,
      seed: "choice-test",
    })
    const pool = getAnatomimeCandidateCards(config)
    const card = pool[0]
    const choices = buildAnatomimeMultipleChoiceOptions(card, pool, "choice-seed")

    assert.equal(choices.length, 4)
    assert.equal(new Set(choices.map((choice) => choice.id)).size, choices.length)
    assert.ok(choices.some((choice) => choice.id === card.id))
  })

  it("applies active-team and queued-steal scoring rules", () => {
    assert.equal(canAwardImmediateScore("ACTIVE", "team-a", "team-a", true), true)
    assert.equal(canAwardImmediateScore("ACTIVE", "team-a", "team-b", true), false)
    assert.equal(canAwardImmediateScore("STEAL", "team-a", "team-b", true), true)
    assert.equal(canAwardImmediateScore("STEAL", "team-a", "team-a", true), false)
    assert.equal(canAwardImmediateScore("ACTIVE", "team-a", "team-a", false), false)

    const queued = selectQueuedStealGuess("team-a", [
      { id: "late", teamId: "team-b", correct: true, scoreAwarded: 0, submittedAt: new Date("2026-06-13T12:00:03Z") },
      { id: "active", teamId: "team-a", correct: true, scoreAwarded: 0, submittedAt: new Date("2026-06-13T12:00:01Z") },
      { id: "early", teamId: "team-b", correct: true, scoreAwarded: 0, submittedAt: new Date("2026-06-13T12:00:02Z") },
    ])

    assert.equal(queued?.id, "early")
  })
})
