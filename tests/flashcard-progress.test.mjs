import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FLASHCARD_MASTERY_THRESHOLD,
  flashcardMasteryRoundAchievementKey,
  flashcardProgressTool,
  isFlashcardProgressMastered,
  nextFlashcardProgressUpdate,
  nextFlashcardProgressRoundMetadata,
  normalizeFlashcardProgressMetadata,
  roundNumberFromAchievementKey,
  summarizeFlashcardProgressBreakdowns,
  summarizeFlashcardProgress,
} from "../lib/flashcard-progress.js"

function result(overrides = {}) {
  return {
    promptId: "name_to_region:muscle-biceps-brachii",
    promptType: "name_to_region",
    entityType: "muscle",
    entitySlug: "biceps-brachii",
    regions: ["upper-extremity"],
    correct: true,
    score: 100,
    ...overrides,
  }
}

describe("Flashcard progress mastery metadata", () => {
  it("uses a stable per-prompt learning progress tool key", () => {
    assert.equal(flashcardProgressTool("prompt-1"), "flashcards:prompt-1")
  })

  it("accumulates attempts and marks mastery after ten correct answers", () => {
    let metadata = {}

    for (let index = 0; index < FLASHCARD_MASTERY_THRESHOLD - 1; index += 1) {
      const update = nextFlashcardProgressUpdate(metadata, result(), new Date(`2026-06-07T00:00:0${index % 10}.000Z`))
      metadata = update.metadata
      assert.equal(update.status, "PRACTICING")
    }

    assert.equal(normalizeFlashcardProgressMetadata(metadata).correctCount, 9)
    assert.equal(isFlashcardProgressMastered(metadata), false)

    const mastered = nextFlashcardProgressUpdate(metadata, result(), new Date("2026-06-07T00:00:10.000Z"))
    assert.equal(mastered.status, "MASTERED")
    assert.equal(mastered.metadata.correctCount, 10)
    assert.equal(mastered.metadata.attemptCount, 10)
    assert.equal(mastered.metadata.masteredAt, "2026-06-07T00:00:10.000Z")
    assert.equal(isFlashcardProgressMastered(mastered.metadata), true)
  })

  it("keeps incorrect attempts without resetting historic correct totals", () => {
    const first = nextFlashcardProgressUpdate({}, result(), new Date("2026-06-07T00:00:00.000Z"))
    const missed = nextFlashcardProgressUpdate(first.metadata, result({ correct: false, score: 0 }), new Date("2026-06-07T00:00:01.000Z"))

    assert.equal(missed.status, "PRACTICING")
    assert.equal(missed.metadata.correctCount, 1)
    assert.equal(missed.metadata.incorrectCount, 1)
    assert.equal(missed.metadata.attemptCount, 2)
    assert.equal(missed.metadata.currentCorrectStreak, 0)
    assert.equal(missed.metadata.bestCorrectStreak, 1)
    assert.equal(missed.metadata.lifetimeCorrectCount, 1)
    assert.equal(missed.metadata.lifetimeIncorrectCount, 1)
    assert.equal(missed.metadata.lifetimeAttemptCount, 2)
  })

  it("resets current round progress while preserving lifetime totals", () => {
    const first = nextFlashcardProgressUpdate({}, result(), new Date("2026-06-07T00:00:00.000Z"))
    const second = nextFlashcardProgressUpdate(first.metadata, result({ correct: false, score: 0 }), new Date("2026-06-07T00:00:01.000Z"))
    const nextRound = nextFlashcardProgressRoundMetadata(second.metadata, new Date("2026-06-08T00:00:00.000Z"))

    assert.equal(nextRound.attemptCount, 0)
    assert.equal(nextRound.correctCount, 0)
    assert.equal(nextRound.incorrectCount, 0)
    assert.equal(nextRound.lifetimeAttemptCount, 2)
    assert.equal(nextRound.lifetimeCorrectCount, 1)
    assert.equal(nextRound.lifetimeIncorrectCount, 1)
    assert.equal(nextRound.masteryRound, 2)
    assert.equal(nextRound.roundStartedAt, "2026-06-08T00:00:00.000Z")
    assert.equal(nextRound.masteredAt, undefined)
    assert.equal(isFlashcardProgressMastered(nextRound), false)
  })

  it("uses repeatable mastery round achievement keys", () => {
    const key = flashcardMasteryRoundAchievementKey(3)

    assert.equal(key, "flashcards:mastery-round:3")
    assert.equal(roundNumberFromAchievementKey(key), 3)
    assert.equal(roundNumberFromAchievementKey("flashcards:first-completion"), 0)
  })

  it("summarizes tracked and mastered prompt progress", () => {
    const mastered = normalizeFlashcardProgressMetadata({
      promptId: "prompt-mastered",
      correctCount: 10,
      incorrectCount: 2,
      attemptCount: 12,
      masteryThreshold: 10,
    })
    const active = normalizeFlashcardProgressMetadata({
      promptId: "prompt-active",
      correctCount: 3,
      incorrectCount: 1,
      attemptCount: 4,
      masteryThreshold: 10,
    })

    assert.deepEqual(summarizeFlashcardProgress([mastered, active]), {
      trackedPromptCount: 2,
      activePromptCount: 1,
      masteredPromptCount: 1,
      totalAttempts: 16,
      totalCorrect: 13,
      totalIncorrect: 3,
      accuracyPercent: 81,
      masteryThreshold: 10,
    })
  })

  it("summarizes current-round coverage by prompt type and region", () => {
    const prompts = [
      { id: "prompt-region-head", promptType: "name_to_region", promptTypeLabel: "Identify Body Region", regionLabels: ["Head"] },
      { id: "prompt-region-spine", promptType: "name_to_region", promptTypeLabel: "Identify Body Region", regionLabels: ["Spine"] },
      { id: "prompt-category-head", promptType: "name_to_category", promptTypeLabel: "Identify Structure Type", regionLabels: ["Head"] },
    ]
    const metadata = [
      { promptId: "prompt-region-head", correctCount: 10, attemptCount: 10, masteryThreshold: 10 },
      { promptId: "prompt-category-head", correctCount: 3, attemptCount: 4, masteryThreshold: 10 },
      { promptId: "retired-prompt", correctCount: 10, attemptCount: 10, masteryThreshold: 10 },
    ]

    const breakdowns = summarizeFlashcardProgressBreakdowns(metadata, prompts)

    assert.deepEqual(breakdowns.promptTypes, [
      {
        key: "name_to_region",
        label: "Identify Body Region",
        totalCount: 2,
        trackedCount: 1,
        masteredCount: 1,
        remainingCount: 1,
        completionPercent: 50,
      },
      {
        key: "name_to_category",
        label: "Identify Structure Type",
        totalCount: 1,
        trackedCount: 1,
        masteredCount: 0,
        remainingCount: 1,
        completionPercent: 0,
      },
    ])
    assert.deepEqual(breakdowns.regions, [
      {
        key: "head",
        label: "Head",
        totalCount: 2,
        trackedCount: 2,
        masteredCount: 1,
        remainingCount: 1,
        completionPercent: 50,
      },
      {
        key: "spine",
        label: "Spine",
        totalCount: 1,
        trackedCount: 0,
        masteredCount: 0,
        remainingCount: 1,
        completionPercent: 0,
      },
    ])
  })
})
