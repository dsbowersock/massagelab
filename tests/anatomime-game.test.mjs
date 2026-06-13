import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildTurnReview,
  canEndGameAfterCurrentTurn,
  getGameLearningRecap,
  getNextTeamIndex,
  getPromptVisibility,
  getNextTurnState,
  getRoundLabel,
  getWinnerNames,
  isScheduledGameComplete,
  normalizeTeamNames,
  normalizeRoundLimit,
  summarizeTurnReview,
  updateScore,
} from "../lib/anatomime-game.js"

describe("Anatomime game helpers", () => {
  it("normalizes team names to the selected team count", () => {
    assert.deepEqual(normalizeTeamNames(["A", "  ", "C"], 4), ["A", "Team 2", "C", "Team 4"])
    assert.deepEqual(normalizeTeamNames(["A", "B", "C"], 2), ["A", "B"])
  })

  it("updates only the current team's score", () => {
    assert.deepEqual(updateScore([0, 1, 2], 1), [0, 2, 2])
  })

  it("wraps turn order across teams", () => {
    assert.equal(getNextTeamIndex(0, 3), 1)
    assert.equal(getNextTeamIndex(2, 3), 0)
  })

  it("allows ending after the last team or an unbeatable lead", () => {
    assert.equal(canEndGameAfterCurrentTurn([1, 0, 0], 2, 4), true)
    assert.equal(canEndGameAfterCurrentTurn([10, 0, 0], 0, 4), true)
    assert.equal(canEndGameAfterCurrentTurn([2, 0, 0], 0, 4), false)
  })

  it("returns all winners when teams tie", () => {
    assert.deepEqual(getWinnerNames([3, 2, 3], ["A", "B", "C"]), ["A", "C"])
  })

  it("adjusts prompt hints by difficulty", () => {
    assert.deepEqual(getPromptVisibility("easy"), {
      showProgress: true,
      showMetadata: true,
      showHint: true,
      showBonus: true,
    })
    assert.deepEqual(getPromptVisibility("medium"), {
      showProgress: true,
      showMetadata: true,
      showHint: false,
      showBonus: true,
    })
    assert.deepEqual(getPromptVisibility("hard"), {
      showProgress: false,
      showMetadata: false,
      showHint: false,
      showBonus: false,
    })
  })

  it("normalizes bounded round limits for setup controls", () => {
    assert.equal(normalizeRoundLimit(0), 1)
    assert.equal(normalizeRoundLimit(13), 12)
    assert.equal(normalizeRoundLimit("4"), 4)
    assert.equal(normalizeRoundLimit("bad", 5), 5)
  })

  it("advances rounds after the final team turn", () => {
    assert.deepEqual(getNextTurnState({ currentTeam: 0, teamCount: 3, currentRound: 2 }), {
      currentTeam: 1,
      currentRound: 2,
    })
    assert.deepEqual(getNextTurnState({ currentTeam: 2, teamCount: 3, currentRound: 2 }), {
      currentTeam: 0,
      currentRound: 3,
    })
  })

  it("finishes scheduled games after the selected number of full rounds", () => {
    assert.equal(isScheduledGameComplete({
      hardcoreMode: false,
      currentTeam: 1,
      teamCount: 2,
      currentRound: 3,
      roundLimit: 3,
    }), true)
    assert.equal(isScheduledGameComplete({
      hardcoreMode: false,
      currentTeam: 0,
      teamCount: 2,
      currentRound: 3,
      roundLimit: 3,
    }), false)
    assert.equal(isScheduledGameComplete({
      hardcoreMode: true,
      currentTeam: 1,
      teamCount: 2,
      currentRound: 99,
      roundLimit: 3,
    }), false)
  })

  it("labels bounded and hardcore round modes", () => {
    assert.equal(getRoundLabel({ hardcoreMode: false, currentRound: 2, roundLimit: 5 }), "Round 2 of 5")
    assert.equal(getRoundLabel({ hardcoreMode: true, currentRound: 2, roundLimit: 5 }), "Hardcore mode")
  })

  it("builds a turn review and defaults unresolved terms to skipped", () => {
    const terms = [
      { id: "scapula", name: "Scapula" },
      { id: "humerus", name: "Humerus" },
      { id: "biceps-brachii", name: "Biceps brachii" },
    ]
    const review = buildTurnReview(terms, {
      scapula: "correct",
      humerus: "missed",
    })

    assert.deepEqual(review.map((entry) => [entry.term.id, entry.outcome]), [
      ["scapula", "correct"],
      ["humerus", "missed"],
      ["biceps-brachii", "skipped"],
    ])
    assert.deepEqual(summarizeTurnReview(review), {
      correct: 1,
      missed: 1,
      skipped: 1,
    })
  })

  it("prioritizes final recap terms that need review", () => {
    const scapula = { id: "scapula", name: "Scapula" }
    const humerus = { id: "humerus", name: "Humerus" }
    const ulna = { id: "ulna", name: "Ulna" }
    const recap = getGameLearningRecap([
      {
        review: [
          { term: scapula, outcome: "correct" },
          { term: humerus, outcome: "missed" },
        ],
      },
      {
        review: [
          { term: scapula, outcome: "correct" },
          { term: ulna, outcome: "skipped" },
          { term: humerus, outcome: "correct" },
        ],
      },
    ])

    assert.deepEqual(recap.map((entry) => [entry.term.id, entry.correct, entry.missed, entry.skipped]), [
      ["humerus", 1, 1, 0],
      ["ulna", 0, 0, 1],
      ["scapula", 2, 0, 0],
    ])
  })
})
