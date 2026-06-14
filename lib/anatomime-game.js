// @ts-check

/**
 * @param {string[]} names
 * @param {number} count
 */
export function normalizeTeamNames(names, count) {
  return Array.from({ length: count }, (_, index) => {
    const existing = names[index]?.trim()
    return existing || `Team ${index + 1}`
  })
}

/**
 * @param {number[]} scores
 * @param {number} teamIndex
 * @param {number} [delta]
 */
export function updateScore(scores, teamIndex, delta = 1) {
  return scores.map((score, index) => (index === teamIndex ? score + delta : score))
}

/**
 * @param {number} currentTeam
 * @param {number} teamCount
 */
export function getNextTeamIndex(currentTeam, teamCount) {
  if (teamCount <= 0) return 0
  return (currentTeam + 1) % teamCount
}

/**
 * @param {number[]} scores
 * @param {number} currentTeam
 * @param {number} termsPerTurn
 */
export function canEndGameAfterCurrentTurn(scores, currentTeam, termsPerTurn) {
  if (currentTeam >= scores.length - 1) return true

  const currentScore = scores[currentTeam] ?? 0
  const maxOtherScore = scores.reduce((max, score, index) => (
    index === currentTeam ? max : Math.max(max, score)
  ), 0)
  const remainingTeams = Math.max(0, scores.length - currentTeam - 1)

  return currentScore > maxOtherScore + termsPerTurn * remainingTeams
}

/**
 * @param {number[]} scores
 * @param {string[]} teamNames
 */
export function getWinnerNames(scores, teamNames) {
  const highScore = Math.max(...scores)
  return scores
    .map((score, index) => ({ score, name: teamNames[index] ?? `Team ${index + 1}` }))
    .filter((entry) => entry.score === highScore)
    .map((entry) => entry.name)
}

/**
 * @param {"easy" | "medium" | "hard" | "expert"} clueLevel
 */
export function getPromptVisibility(clueLevel) {
  return {
    showProgress: clueLevel !== "expert",
    showMedia: clueLevel === "easy" || clueLevel === "medium",
    showMetadata: clueLevel === "easy",
    showHint: clueLevel === "easy" || clueLevel === "hard",
    showBonus: clueLevel !== "expert",
  }
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 */
export function normalizeRoundLimit(value, fallback = 3) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(12, Math.max(1, Math.round(parsed)))
}

/**
 * @param {{
 *   currentTeam: number
 *   teamCount: number
 *   currentRound: number
 * }} options
 */
export function getNextTurnState({ currentTeam, teamCount, currentRound }) {
  const nextTeam = getNextTeamIndex(currentTeam, teamCount)
  return {
    currentTeam: nextTeam,
    currentRound: nextTeam === 0 ? currentRound + 1 : currentRound,
  }
}

/**
 * @param {{
 *   hardcoreMode: boolean
 *   currentTeam: number
 *   teamCount: number
 *   currentRound: number
 *   roundLimit: number
 * }} options
 */
export function isScheduledGameComplete({ hardcoreMode, currentTeam, teamCount, currentRound, roundLimit }) {
  if (hardcoreMode) return false
  return currentRound >= roundLimit && currentTeam >= teamCount - 1
}

/**
 * @param {{
 *   hardcoreMode: boolean
 *   currentRound: number
 *   roundLimit: number
 * }} options
 */
export function getRoundLabel({ hardcoreMode, currentRound, roundLimit }) {
  if (hardcoreMode) return "Hardcore mode"
  return `Round ${currentRound} of ${roundLimit}`
}

/**
 * Build the teach-back list for a completed turn without mutating the term
 * objects that come from the sourced anatomy adapter.
 *
 * @template {{ id: string }} T
 * @param {T[]} terms
 * @param {Record<string, "correct" | "missed" | "skipped">} [outcomes]
 * @returns {Array<{ term: T, outcome: "correct" | "missed" | "skipped" }>}
 */
export function buildTurnReview(terms, outcomes = {}) {
  return terms.map((term) => ({
    term,
    outcome: outcomes[term.id] ?? "skipped",
  }))
}

/**
 * @param {Array<{ outcome: "correct" | "missed" | "skipped" }>} review
 */
export function summarizeTurnReview(review) {
  return review.reduce((summary, entry) => {
    summary[entry.outcome] += 1
    return summary
  }, { correct: 0, missed: 0, skipped: 0 })
}

/**
 * Aggregate completed turns into a final learning recap. Items with misses or
 * skips sort first so teams can quickly see what to review after the game.
 *
 * @template {{ id: string, name?: string }} T
 * @param {Array<{ review?: Array<{ term: T, outcome: "correct" | "missed" | "skipped" }> }>} turnHistory
 * @returns {Array<{ term: T, correct: number, missed: number, skipped: number }>}
 */
export function getGameLearningRecap(turnHistory) {
  const byTerm = new Map()

  for (const turn of turnHistory) {
    for (const entry of turn.review ?? []) {
      const current = byTerm.get(entry.term.id) ?? {
        term: entry.term,
        correct: 0,
        missed: 0,
        skipped: 0,
      }

      current[entry.outcome] += 1
      byTerm.set(entry.term.id, current)
    }
  }

  return [...byTerm.values()].sort((first, second) => {
    const firstNeedsReview = first.missed + first.skipped
    const secondNeedsReview = second.missed + second.skipped

    if (secondNeedsReview !== firstNeedsReview) return secondNeedsReview - firstNeedsReview
    if (second.correct !== first.correct) return second.correct - first.correct

    return (first.term.name ?? first.term.id).localeCompare(second.term.name ?? second.term.id)
  })
}
