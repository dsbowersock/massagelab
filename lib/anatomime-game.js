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
 * @param {"easy" | "medium" | "hard"} difficulty
 */
export function getPromptVisibility(difficulty) {
  return {
    showProgress: difficulty !== "hard",
    showMetadata: difficulty !== "hard",
    showHint: difficulty === "easy",
    showBonus: difficulty !== "hard",
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
