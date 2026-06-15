export type AnatomimeAnswerMode = "host-judged" | "typed" | "multiple-choice"
export type AnatomimeClueLevel = "easy" | "medium" | "hard" | "expert"
export type AnatomimeRoomStatus = "LOBBY" | "PLAYING" | "GAME_COMPLETE" | "REVIEW" | "ENDED" | "EXPIRED"
export type AnatomimeRoomPhase = "LOBBY" | "ACTIVE_TERM" | "TURN_REVIEW" | "GAME_COMPLETE"

export type AnatomimeTeamSummary = {
  id: string
  name: string
  sortOrder: number
  score: number
}

export type AnatomimePlayerSummary = {
  id: string
  teamId: string | null
  displayName: string
  signedIn: boolean
  isHost: boolean
  lastSeenAt: string
}

export type AnatomimePromptSummary = {
  id: string
  name?: string
  categoryLabel?: string
  regionLabels?: string[]
  bodySystemLabels?: string[]
  difficulty?: string
  definition?: string
  aliases?: string[]
  media?: Array<{ url: string; title: string }>
}

export type AnatomimeRoomSummary = {
  code: string
  status: AnatomimeRoomStatus
  phase: AnatomimeRoomPhase
  config: {
    answerMode: AnatomimeAnswerMode
    clueLevel: AnatomimeClueLevel
    roundSeconds: number
    termCount: number
    roundLimit?: number
    hardcoreMode?: boolean
  }
  phaseEndsAt: string | null
  reviewExpiresAt: string | null
  teams: AnatomimeTeamSummary[]
  players: AnatomimePlayerSummary[]
  viewer: {
    isHost: boolean
    playerId: string | null
    teamId: string | null
  }
  activeTeam: AnatomimeTeamSummary | null
  activeItem: {
    index: number
    total: number
    prompt: AnatomimePromptSummary
    choices: Array<{ id: string; label: string }>
    multipleChoiceUnlocksAt: string | null
    pendingSteal: boolean
  } | null
  turnReview: Array<{
    cardId?: string
    id?: string
    termKey?: string
    name: string
    outcome: "got" | "missed" | "stolen"
    scoredTeamId: string | null
  }>
  recap: Array<{
    teamId: string
    got: number
    missed: number
    stolen: number
  }>
  hostElection?: {
    id: string
    closesAt: string
    candidatePlayerIds: string[]
    activeVoterPlayerIds: string[]
    submittedVoterPlayerIds: string[]
  } | null
  hostCanBeChallenged?: boolean
}
