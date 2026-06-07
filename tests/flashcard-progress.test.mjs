import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FLASHCARD_MASTERY_THRESHOLD,
  flashcardProgressTool,
  isFlashcardProgressMastered,
  nextFlashcardProgressUpdate,
  normalizeFlashcardProgressMetadata,
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
})
