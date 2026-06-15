export type AnatomimeRoomAnswerMode = "host-judged" | "typed" | "multiple-choice"
export type AnatomimeRoomStatus = "LOBBY" | "PLAYING" | "GAME_COMPLETE" | "REVIEW" | "ENDED" | "EXPIRED"
export type AnatomimeGameRunPhase = "LOBBY" | "ACTIVE_TERM" | "TURN_REVIEW" | "GAME_COMPLETE"
export type AnatomimeTermOutcome = "pending" | "got" | "missed" | "stolen"
export type AnatomimeAnswerKind = "typed" | "choice"
export type AnatomimeGuessFeedbackKind =
  | "incorrect"
  | "active-correct"
  | "opposing-correct-held"
  | "opposing-team-already-held"
  | "practice-correct"
  | "timeout-missed"
  | "timeout-steal-awarded"
  | "host-judged-correct"
  | "locked"

export const ANATOMIME_TERMS_PER_TURN = 4
export const ANATOMIME_TERM_SECONDS = 30
export const ANATOMIME_TYPED_GUESS_LIMIT = 5
export const ANATOMIME_CHOICE_GUESS_LIMIT = 1
export const ANATOMIME_ROOM_IDLE_MINUTES = 30
export const ANATOMIME_REVIEW_WINDOW_MINUTES = 30
export const ANATOMIME_HOST_IDLE_SECONDS = 60
export const ANATOMIME_ELECTION_SECONDS = 60

export type AnatomimeTermCredit = {
  playerId: string
  teamId: string
  userId: string | null
  submittedAt: Date
}

export type AnatomimeTermState = {
  cardId: string
  activeTeamId: string
  outcome: AnatomimeTermOutcome
  firstActiveCorrect: AnatomimeTermCredit | null
  firstOpposingCorrect: AnatomimeTermCredit | null
}

type GuessLimitStatus = {
  allowed: boolean
  remainingAfterUse: number
}

export function createInitialTermState(input: { activeTeamId: string; cardId: string }): AnatomimeTermState {
  return {
    cardId: input.cardId,
    activeTeamId: input.activeTeamId,
    outcome: "pending",
    firstActiveCorrect: null,
    firstOpposingCorrect: null,
  }
}

export function typedGuessStatus(priorTypedAttempts: number): GuessLimitStatus {
  const allowed = priorTypedAttempts < ANATOMIME_TYPED_GUESS_LIMIT
  return {
    allowed,
    remainingAfterUse: allowed ? Math.max(ANATOMIME_TYPED_GUESS_LIMIT - priorTypedAttempts - 1, 0) : 0,
  }
}

export function choiceGuessStatus(priorChoiceAttempts: number): GuessLimitStatus {
  const allowed = priorChoiceAttempts < ANATOMIME_CHOICE_GUESS_LIMIT
  return {
    allowed,
    remainingAfterUse: 0,
  }
}

export function calculateMultipleChoiceUnlockSeconds(labels: string[]): number {
  const choiceLabels = labels.slice(0, 4).map((label) => label.trim())
  const totalChoiceChars = choiceLabels.reduce((sum, label) => sum + label.length, 0)
  return Math.min(10, Math.max(5, 5 + Math.ceil(Math.max(0, totalChoiceChars - 80) / 30)))
}

export function nextRunStep(input: {
  activeCardIndex: number
  termsPerTurn: number
  teamCount: number
  activeTeamOrder: number
  roundLimit: number
  hardcoreMode: boolean
}): {
  phase: "ACTIVE_TERM" | "TURN_REVIEW" | "GAME_COMPLETE"
  activeCardIndex: number
  activeTeamOrder: number
  gameComplete: boolean
} {
  const termsPerTurn = Math.max(1, input.termsPerTurn)
  const totalScheduledTerms = Math.max(1, input.teamCount) * Math.max(1, input.roundLimit) * termsPerTurn
  const gameComplete = !input.hardcoreMode && input.activeCardIndex >= totalScheduledTerms - 1

  if (gameComplete) {
    return {
      phase: "GAME_COMPLETE",
      activeCardIndex: input.activeCardIndex,
      activeTeamOrder: input.activeTeamOrder,
      gameComplete: true,
    }
  }

  if ((input.activeCardIndex + 1) % termsPerTurn === 0) {
    return {
      phase: "TURN_REVIEW",
      activeCardIndex: input.activeCardIndex,
      activeTeamOrder: input.activeTeamOrder,
      gameComplete: false,
    }
  }

  return {
    phase: "ACTIVE_TERM",
    activeCardIndex: input.activeCardIndex + 1,
    activeTeamOrder: input.activeTeamOrder,
    gameComplete: false,
  }
}

export function resolveDeviceGuess(
  state: AnatomimeTermState,
  guess: {
    playerId: string
    teamId: string
    userId: string | null
    correct: boolean
    answerKind: AnatomimeAnswerKind
    submittedAt: Date
  },
): {
  termState: AnatomimeTermState
  feedbackKind: AnatomimeGuessFeedbackKind
  shouldAdvance: boolean
  scoreTeamId: string | null
  progressCreditPlayerId: string | null
} {
  if (!guess.correct) {
    return {
      termState: state,
      feedbackKind: "incorrect",
      shouldAdvance: false,
      scoreTeamId: null,
      progressCreditPlayerId: null,
    }
  }

  if (state.firstActiveCorrect || state.outcome !== "pending") {
    return correctForPractice(state)
  }

  const credit = {
    playerId: guess.playerId,
    teamId: guess.teamId,
    userId: guess.userId,
    submittedAt: guess.submittedAt,
  }

  if (guess.teamId === state.activeTeamId) {
    return {
      termState: {
        ...state,
        outcome: "got",
        firstActiveCorrect: credit,
      },
      feedbackKind: "active-correct",
      shouldAdvance: true,
      scoreTeamId: state.activeTeamId,
      progressCreditPlayerId: guess.playerId,
    }
  }

  if (!state.firstOpposingCorrect) {
    return {
      termState: {
        ...state,
        firstOpposingCorrect: credit,
      },
      feedbackKind: "opposing-correct-held",
      shouldAdvance: false,
      scoreTeamId: null,
      progressCreditPlayerId: guess.playerId,
    }
  }

  return {
    termState: state,
    feedbackKind:
      state.firstOpposingCorrect.teamId === guess.teamId ? "practice-correct" : "opposing-team-already-held",
    shouldAdvance: false,
    scoreTeamId: null,
    progressCreditPlayerId: null,
  }
}

export function resolveTermTimeout(state: AnatomimeTermState): {
  termState: AnatomimeTermState
  feedbackKind: AnatomimeGuessFeedbackKind
  shouldAdvance: true
  scoreTeamId: string | null
  activeOutcome: "missed"
} {
  if (state.firstOpposingCorrect) {
    return {
      termState: {
        ...state,
        outcome: "stolen",
      },
      feedbackKind: "timeout-steal-awarded",
      shouldAdvance: true,
      scoreTeamId: state.firstOpposingCorrect.teamId,
      activeOutcome: "missed",
    }
  }

  return {
    termState: {
      ...state,
      outcome: "missed",
    },
    feedbackKind: "timeout-missed",
    shouldAdvance: true,
    scoreTeamId: null,
    activeOutcome: "missed",
  }
}

export function resolveHostJudgedCorrect(state: AnatomimeTermState): {
  termState: AnatomimeTermState
  feedbackKind: "host-judged-correct"
  shouldAdvance: true
  scoreTeamId: string
  activeOutcome: "got"
  progressCreditPlayerId: null
} {
  return {
    termState: {
      ...state,
      outcome: "got",
    },
    feedbackKind: "host-judged-correct",
    shouldAdvance: true,
    scoreTeamId: state.activeTeamId,
    activeOutcome: "got",
    progressCreditPlayerId: null,
  }
}

export function canJoinRoom(
  room: {
    status: string
    endedAt: Date | null
    reviewExpiresAt: Date | null
    expiresAt: Date
    existingPlayerIds: string[]
  },
  input: { now: Date; playerId: string | null },
): { allowed: boolean; reason: "expired" | "review" | "open" } {
  if (room.expiresAt.getTime() <= input.now.getTime()) return { allowed: false, reason: "expired" }

  if (room.status === "REVIEW" || room.status === "ENDED") {
    const reviewOpen = room.reviewExpiresAt ? room.reviewExpiresAt.getTime() > input.now.getTime() : false
    const existingPlayer = Boolean(input.playerId && room.existingPlayerIds.includes(input.playerId))
    return { allowed: reviewOpen && existingPlayer, reason: "review" }
  }

  return { allowed: true, reason: "open" }
}

export function runInstantRunoffElection(input: {
  candidateIds: string[]
  ballots: string[][]
}): {
  winnerId: string | null
  rounds: Array<{ tally: Record<string, number>; eliminatedCandidateIds: string[] }>
} {
  const remaining = new Set(input.candidateIds)
  const rounds: Array<{ tally: Record<string, number>; eliminatedCandidateIds: string[] }> = []

  while (remaining.size > 0) {
    const tally = tallyInstantRunoffRound(input.ballots, remaining)
    const totalVotes = Object.values(tally).reduce((sum, count) => sum + count, 0)
    const remainingCandidates = [...remaining].sort()
    const zeroVoteCandidates = remainingCandidates.filter((candidateId) => tally[candidateId] === 0)

    if (zeroVoteCandidates.length > 0 && zeroVoteCandidates.length < remaining.size) {
      rounds.push({ tally, eliminatedCandidateIds: zeroVoteCandidates })
      for (const candidateId of zeroVoteCandidates) remaining.delete(candidateId)
      continue
    }

    const majorityWinner = remainingCandidates.find((candidateId) => tally[candidateId] > totalVotes / 2)
    if (majorityWinner) {
      rounds.push({ tally, eliminatedCandidateIds: [] })
      return { winnerId: majorityWinner, rounds }
    }

    const fewestVotes = Math.min(...remainingCandidates.map((candidateId) => tally[candidateId]))
    const eliminatedCandidateIds = remainingCandidates.filter((candidateId) => tally[candidateId] === fewestVotes)

    if (eliminatedCandidateIds.length >= remaining.size) {
      rounds.push({ tally, eliminatedCandidateIds: [] })
      return { winnerId: remainingCandidates[0] ?? null, rounds }
    }

    rounds.push({ tally, eliminatedCandidateIds })
    for (const candidateId of eliminatedCandidateIds) remaining.delete(candidateId)
  }

  return { winnerId: null, rounds }
}

function correctForPractice(state: AnatomimeTermState) {
  return {
    termState: state,
    feedbackKind: "practice-correct" as const,
    shouldAdvance: false,
    scoreTeamId: null,
    progressCreditPlayerId: null,
  }
}

function tallyInstantRunoffRound(ballots: string[][], remaining: Set<string>): Record<string, number> {
  const tally: Record<string, number> = {}
  for (const candidateId of remaining) tally[candidateId] = 0

  for (const ballot of ballots) {
    const vote = ballot.find((candidateId) => remaining.has(candidateId))
    if (vote) tally[vote] += 1
  }

  return tally
}
