import type { Prisma } from "@prisma/client"
import { generateRandomToken, hashToken } from "./auth-security.js"
import { AnatomimeSessionError, type ViewerContext } from "./anatomime-session-server.ts"
import { updateAnatomimeNameRecallProgress } from "./anatomime-progress-server.ts"
import { publishAnatomimeRealtimeEvent } from "./anatomime-realtime.ts"
import {
  anatomimeTermFromCard,
  buildAnatomimeMultipleChoiceOptions,
  checkAnatomimeAnswer,
  createAnatomimeSessionDeck,
  getAnatomimeCandidateCards,
  labelAnatomimeCategory,
  labelAnatomimeRegion,
  normalizeAnatomimeSessionConfig,
  type AnatomimeSessionConfig,
} from "./anatomime-shared.ts"
import {
  ANATOMIME_ELECTION_SECONDS,
  ANATOMIME_HOST_IDLE_SECONDS,
  ANATOMIME_REVIEW_WINDOW_MINUTES,
  ANATOMIME_ROOM_IDLE_MINUTES,
  ANATOMIME_TERM_SECONDS,
  ANATOMIME_TERMS_PER_TURN,
  anatomimeTurnReviewTermIdentity,
  buildOpaqueAnatomimeChoiceOptions,
  calculateMultipleChoiceUnlockSeconds,
  canResolveTermTimeout,
  canJoinRoom,
  choiceGuessStatus,
  createInitialTermState,
  nextRunStep,
  opaqueAnatomimeTermKey,
  resolveOpaqueAnatomimeChoiceId,
  resolveDeviceGuess,
  resolveHostJudgedCorrect,
  resolveTermTimeout,
  runInstantRunoffElection,
  shouldExposeAnatomimeChoiceOptions,
  typedGuessStatus,
  type AnatomimeAnswerKind,
  type AnatomimeTermOutcome,
  type AnatomimeTermState,
} from "./anatomime-room-rules.ts"
import type { AnatomyStudyCard } from "./anatomy-study.ts"
import { prisma } from "./prisma.ts"

export const roomInclude = {
  hostPlayer: true,
  currentRun: {
    include: {
      scores: true,
      guesses: {
        orderBy: { submittedAt: "asc" as const },
      },
    },
  },
  teams: {
    orderBy: { sortOrder: "asc" as const },
  },
  players: {
    orderBy: { createdAt: "asc" as const },
  },
  elections: {
    where: { status: "OPEN" },
    orderBy: { startedAt: "desc" as const },
    take: 1,
    include: { ballots: true },
  },
} satisfies Prisma.AnatomimeRoomInclude

export type AnatomimeRoomWithRelations = Prisma.AnatomimeRoomGetPayload<{ include: typeof roomInclude }>

type AnatomimeRunWithRelations = NonNullable<AnatomimeRoomWithRelations["currentRun"]>
type TermOutcomeRow = {
  cardId: string
  cardIndex: number
  activeTeamId: string
  outcome: Exclude<AnatomimeTermOutcome, "pending">
  scoredTeamId: string | null
  resolvedAt: string
}

function roomError(status: number, code: string, message: string) {
  return new AnatomimeSessionError(status, code, message)
}

class StaleRoomMutationError extends Error {
  constructor() {
    super("Anatomime room changed before the transition could be applied.")
    this.name = "StaleRoomMutationError"
  }
}

function isStaleRoomMutation(error: unknown) {
  return error instanceof StaleRoomMutationError
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002")
}

function staleRoomMutationRoomError() {
  return roomError(409, "stale-session", "This item is no longer accepting guesses.")
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

function objectBody(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function publicCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

async function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRandomToken(5).replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase()
    if (code.length < 6) continue

    const existing = await prisma.anatomimeRoom.findUnique({ where: { code }, select: { id: true } })
    if (!existing) return code
  }

  throw new Error("Could not generate Anatomime room code.")
}

function normalizeDisplayName(value: unknown, fallback = "Player") {
  const displayName = typeof value === "string" ? value.trim() : ""
  return displayName ? displayName.slice(0, 60) : fallback
}

function seededRng(seed: string) {
  let state = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 16777619)
  }

  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleCards(cards: AnatomyStudyCard[], seed: string) {
  const rng = seededRng(seed)
  const shuffled = [...cards]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

function roomCardPool(config: AnatomimeSessionConfig) {
  const candidates = getAnatomimeCandidateCards(config)
  const byId = new Map(candidates.map((card) => [card.id, card]))
  const selectedCards = config.selectedCardIds
    .map((id) => byId.get(id))
    .filter((card): card is AnatomyStudyCard => Boolean(card))
  const selectedIds = new Set(selectedCards.map((card) => card.id))
  const fillCards = candidates.filter((card) => !selectedIds.has(card.id))

  if (selectedCards.length > 0) {
    return [
      ...shuffleCards(selectedCards, `${config.seed}:selected-room`),
      ...shuffleCards(fillCards, `${config.seed}:fill-room`),
    ]
  }

  return shuffleCards(candidates, `${config.seed}:room`)
}

function deckCardIdsForRun(config: AnatomimeSessionConfig, teamCount: number) {
  const targetTermCount = Math.max(
    ANATOMIME_TERMS_PER_TURN,
    Math.max(1, teamCount) * Math.max(1, config.roundLimit) * ANATOMIME_TERMS_PER_TURN,
  )
  const pool = roomCardPool(config)
  if (pool.length < ANATOMIME_TERMS_PER_TURN) {
    throw roomError(400, "empty-deck", "This Anatomime setup needs at least 4 matching sourced anatomy items.")
  }

  const ids: string[] = []
  for (let cycle = 0; ids.length < targetTermCount; cycle += 1) {
    const cycleCards = cycle === 0 ? pool : shuffleCards(pool, `${config.seed}:room-cycle:${cycle}`)
    ids.push(...cycleCards.map((card) => card.id))
  }

  return ids.slice(0, targetTermCount)
}

function allCardsById() {
  const allCardsConfig = normalizeAnatomimeSessionConfig({})
  return new Map(getAnatomimeCandidateCards(allCardsConfig).map((card) => [card.id, card]))
}

function cardById(cardId: string) {
  return allCardsById().get(cardId) ?? null
}

function activeRunCard(run: Pick<AnatomimeRunWithRelations, "deckCardIds" | "activeCardIndex">) {
  const cardId = run.deckCardIds[run.activeCardIndex] ?? ""
  return cardId ? cardById(cardId) : null
}

function activeRunTeam(room: Pick<AnatomimeRoomWithRelations, "teams">, run: Pick<AnatomimeRunWithRelations, "activeTeamOrder">) {
  return room.teams.find((team) => team.sortOrder === run.activeTeamOrder) ?? room.teams[0] ?? null
}

function setupConfigFromRoom(room: Pick<AnatomimeRoomWithRelations, "metadata">) {
  const metadata = objectBody(room.metadata)
  return normalizeAnatomimeSessionConfig(metadata.setup ?? room.metadata)
}

function runConfig(run: Pick<AnatomimeRunWithRelations, "config">) {
  return normalizeAnatomimeSessionConfig(run.config)
}

function runMetadata(value: unknown) {
  const record = objectBody(value)
  const termOutcomes = Array.isArray(record.termOutcomes)
    ? record.termOutcomes
      .map((row) => {
        const item = objectBody(row)
        const outcome = typeof item.outcome === "string" ? item.outcome : ""
        if (outcome !== "got" && outcome !== "missed" && outcome !== "stolen") return null

        return {
          cardId: typeof item.cardId === "string" ? item.cardId : "",
          cardIndex: Number.isFinite(Number(item.cardIndex)) ? Math.trunc(Number(item.cardIndex)) : -1,
          activeTeamId: typeof item.activeTeamId === "string" ? item.activeTeamId : "",
          outcome,
          scoredTeamId: typeof item.scoredTeamId === "string" ? item.scoredTeamId : null,
          resolvedAt: typeof item.resolvedAt === "string" ? item.resolvedAt : "",
        }
      })
      .filter((row): row is TermOutcomeRow => Boolean(row?.cardId && row.activeTeamId && row.cardIndex >= 0))
    : []

  return { ...record, termOutcomes }
}

function withTermOutcome(run: AnatomimeRunWithRelations, outcome: TermOutcomeRow) {
  const metadata = runMetadata(run.metadata)
  return {
    ...metadata,
    termOutcomes: [
      ...metadata.termOutcomes.filter((row) => row.cardIndex !== outcome.cardIndex),
      outcome,
    ].sort((first, second) => first.cardIndex - second.cardIndex),
  }
}

function playerTokenMatches(player: { guestTokenHash: string | null }, token?: string) {
  return Boolean(token && player.guestTokenHash && hashToken(token) === player.guestTokenHash)
}

function viewerPlayer(room: AnatomimeRoomWithRelations, viewer: ViewerContext = {}) {
  if (viewer.userId) {
    const playerByUser = room.players.find((player) => player.userId === viewer.userId)
    if (playerByUser) return playerByUser
  }

  if (viewer.playerId) {
    const byToken = room.players.find((player) => player.id === viewer.playerId && playerTokenMatches(player, viewer.playerToken))
    if (byToken) return byToken
  }

  return null
}

function viewerIsHost(room: AnatomimeRoomWithRelations, viewer: ViewerContext = {}) {
  const player = viewerPlayer(room, viewer)
  if (player?.id === room.hostPlayerId) return true
  if (viewer.userId && room.hostPlayer?.userId === viewer.userId) return true

  return false
}

function requireJoinedPlayer(room: AnatomimeRoomWithRelations, viewer: ViewerContext = {}) {
  const player = viewerPlayer(room, viewer)
  if (!player) throw roomError(403, "join-required", "Join this room before taking that action.")

  return player
}

function requireCurrentRun(room: AnatomimeRoomWithRelations) {
  if (!room.currentRun) throw roomError(409, "no-active-run", "This room does not have an active game run.")

  return room.currentRun
}

function requireHostElectionMutableRoom(room: AnatomimeRoomWithRelations) {
  if (room.status === "REVIEW" || room.status === "ENDED" || room.status === "EXPIRED") {
    throw roomError(409, "room-closed", "This room is no longer accepting host election changes.")
  }
}

async function requireHostRoom(code: string, viewer: ViewerContext) {
  const room = await loadAnatomimeRoom(code, viewer)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")
  if (!viewerIsHost(room, viewer)) throw roomError(403, "host-required", "Only the host can do that.")

  return room
}

async function loadRequiredPlayingRoom(code: string, viewer: ViewerContext = {}) {
  const room = await loadAnatomimeRoom(code, viewer)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")
  if (room.status !== "PLAYING") throw roomError(409, "not-playing", "This room is not currently playing.")

  return room
}

async function touchRoom(
  tx: Prisma.TransactionClient,
  roomId: string,
  data: Prisma.AnatomimeRoomUncheckedUpdateInput,
) {
  return tx.anatomimeRoom.update({
    where: { id: roomId },
    data: roomTouchData(data),
    include: roomInclude,
  })
}

function roomTouchData(data: Prisma.AnatomimeRoomUncheckedUpdateInput) {
  const nextData = { ...data }
  if (data.lastMeaningfulActivityAt && !data.expiresAt) {
    const activityAt = data.lastMeaningfulActivityAt instanceof Date ? data.lastMeaningfulActivityAt : new Date()
    nextData.expiresAt = addMinutes(activityAt, ANATOMIME_ROOM_IDLE_MINUTES)
  }

  return nextData
}

async function touchRoomIfUnchanged(
  tx: Prisma.TransactionClient,
  room: Pick<AnatomimeRoomWithRelations, "id" | "updatedAt">,
  where: Prisma.AnatomimeRoomWhereInput,
  data: Prisma.AnatomimeRoomUncheckedUpdateInput,
) {
  const updated = await tx.anatomimeRoom.updateMany({
    where: {
      ...where,
      id: room.id,
      updatedAt: room.updatedAt,
    },
    data: roomTouchData(data),
  })
  if (updated.count === 0) throw new StaleRoomMutationError()

  return reloadRoom(tx, room.id)
}

async function reloadRoom(tx: Prisma.TransactionClient, roomId: string) {
  const room = await tx.anatomimeRoom.findUnique({
    where: { id: roomId },
    include: roomInclude,
  })
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  return room
}

function expectedActiveTermRunWhere(
  room: Pick<AnatomimeRoomWithRelations, "id">,
  run: Pick<AnatomimeRunWithRelations, "id" | "activeCardIndex" | "activeTeamOrder">,
): Prisma.AnatomimeGameRunWhereInput {
  return {
    id: run.id,
    roomId: room.id,
    status: "PLAYING",
    phase: "ACTIVE_TERM",
    activeCardIndex: run.activeCardIndex,
    activeTeamOrder: run.activeTeamOrder,
  }
}

function expectedTurnReviewRunWhere(
  room: Pick<AnatomimeRoomWithRelations, "id">,
  run: Pick<AnatomimeRunWithRelations, "id" | "activeCardIndex" | "activeTeamOrder">,
): Prisma.AnatomimeGameRunWhereInput {
  return {
    id: run.id,
    roomId: room.id,
    status: "PLAYING",
    phase: "TURN_REVIEW",
    activeCardIndex: run.activeCardIndex,
    activeTeamOrder: run.activeTeamOrder,
  }
}

function assertSameActiveTermRoom(
  room: AnatomimeRoomWithRelations,
  run: AnatomimeRunWithRelations,
  expectedRun: Pick<AnatomimeRunWithRelations, "id" | "activeCardIndex" | "activeTeamOrder">,
) {
  if (
    room.status !== "PLAYING" ||
    room.currentRunId !== expectedRun.id ||
    run.id !== expectedRun.id ||
    run.status !== "PLAYING" ||
    run.phase !== "ACTIVE_TERM" ||
    run.activeCardIndex !== expectedRun.activeCardIndex ||
    run.activeTeamOrder !== expectedRun.activeTeamOrder
  ) {
    throw new StaleRoomMutationError()
  }
}

function assertSameTurnReviewRoom(
  room: AnatomimeRoomWithRelations,
  run: AnatomimeRunWithRelations,
  expectedRun: Pick<AnatomimeRunWithRelations, "id" | "activeCardIndex" | "activeTeamOrder">,
) {
  if (
    room.status !== "PLAYING" ||
    room.currentRunId !== expectedRun.id ||
    run.id !== expectedRun.id ||
    run.status !== "PLAYING" ||
    run.phase !== "TURN_REVIEW" ||
    run.activeCardIndex !== expectedRun.activeCardIndex ||
    run.activeTeamOrder !== expectedRun.activeTeamOrder
  ) {
    throw new StaleRoomMutationError()
  }
}

async function loadLockedActiveTermRoom(
  tx: Prisma.TransactionClient,
  roomId: string,
  expectedRun: Pick<AnatomimeRunWithRelations, "id" | "activeCardIndex" | "activeTeamOrder">,
) {
  let currentRoom = await reloadRoom(tx, roomId)
  let currentRun = requireCurrentRun(currentRoom)
  assertSameActiveTermRoom(currentRoom, currentRun, expectedRun)

  const locked = await tx.anatomimeGameRun.updateMany({
    where: expectedActiveTermRunWhere(currentRoom, currentRun),
    data: { updatedAt: new Date() },
  })
  if (locked.count === 0) throw new StaleRoomMutationError()

  currentRoom = await reloadRoom(tx, roomId)
  currentRun = requireCurrentRun(currentRoom)
  assertSameActiveTermRoom(currentRoom, currentRun, expectedRun)

  return { room: currentRoom, run: currentRun }
}

async function loadLockedTurnReviewRoom(
  tx: Prisma.TransactionClient,
  roomId: string,
  expectedRun: Pick<AnatomimeRunWithRelations, "id" | "activeCardIndex" | "activeTeamOrder">,
) {
  let currentRoom = await reloadRoom(tx, roomId)
  let currentRun = requireCurrentRun(currentRoom)
  assertSameTurnReviewRoom(currentRoom, currentRun, expectedRun)

  const locked = await tx.anatomimeGameRun.updateMany({
    where: expectedTurnReviewRunWhere(currentRoom, currentRun),
    data: { updatedAt: new Date() },
  })
  if (locked.count === 0) throw new StaleRoomMutationError()

  currentRoom = await reloadRoom(tx, roomId)
  currentRun = requireCurrentRun(currentRoom)
  assertSameTurnReviewRoom(currentRoom, currentRun, expectedRun)

  return { room: currentRoom, run: currentRun }
}

async function expireRoomIfIdle(room: AnatomimeRoomWithRelations) {
  const now = new Date()
  if (room.status === "EXPIRED" || room.expiresAt.getTime() > now.getTime()) return room

  return prisma.$transaction(async (tx) => {
    const expired = await tx.anatomimeRoom.updateMany({
      where: {
        id: room.id,
        status: { not: "EXPIRED" },
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    })
    if (expired.count === 0) return reloadRoom(tx, room.id)

    const currentRoom = await reloadRoom(tx, room.id)
    if (currentRoom.currentRun && currentRoom.currentRun.status === "PLAYING") {
      await tx.anatomimeGameRun.updateMany({
        where: { roomId: currentRoom.id, id: currentRoom.currentRun.id, status: "PLAYING" },
        data: {
          status: "GAME_COMPLETE",
          phase: "GAME_COMPLETE",
          termEndsAt: null,
          completedAt: now,
        },
      })
    }

    return reloadRoom(tx, currentRoom.id)
  })
}

async function markViewerSeen(room: AnatomimeRoomWithRelations, viewer: ViewerContext = {}) {
  const player = viewerPlayer(room, viewer)
  if (!player) return room

  await prisma.anatomimeRoomPlayer.update({
    where: {
      roomId_id: {
        roomId: room.id,
        id: player.id,
      },
    },
    data: { lastSeenAt: new Date() },
  })

  return await prisma.anatomimeRoom.findUnique({
    where: { id: room.id },
    include: roomInclude,
  }) ?? room
}

async function createRunScores(tx: Prisma.TransactionClient, room: AnatomimeRoomWithRelations, runId: string) {
  if (room.teams.length === 0) return

  await tx.anatomimeGameRunTeamScore.createMany({
    data: room.teams.map((team) => ({
      roomId: room.id,
      runId,
      teamId: team.id,
      score: 0,
    })),
  })
}

async function createLobbyRun(tx: Prisma.TransactionClient, room: AnatomimeRoomWithRelations, config: AnatomimeSessionConfig) {
  const run = await tx.anatomimeGameRun.create({
    data: {
      roomId: room.id,
      status: "LOBBY",
      phase: "LOBBY",
      config: json(config),
      deckCardIds: [],
      activeCardIndex: 0,
      activeTeamOrder: 0,
      termStartedAt: null,
      termEndsAt: null,
    },
  })
  await createRunScores(tx, room, run.id)

  return run
}

async function createPlayingRun(tx: Prisma.TransactionClient, room: AnatomimeRoomWithRelations, config: AnatomimeSessionConfig, startedAt: Date) {
  const deckCardIds = deckCardIdsForRun(config, room.teams.length)
  const run = await tx.anatomimeGameRun.create({
    data: {
      roomId: room.id,
      status: "PLAYING",
      phase: "ACTIVE_TERM",
      config: json(config),
      deckCardIds,
      activeCardIndex: 0,
      activeTeamOrder: 0,
      termStartedAt: startedAt,
      termEndsAt: addSeconds(startedAt, config.roundSeconds),
      startedAt,
    },
  })
  await createRunScores(tx, room, run.id)

  return run
}

async function startExistingLobbyRun(tx: Prisma.TransactionClient, room: AnatomimeRoomWithRelations, run: AnatomimeRunWithRelations, config: AnatomimeSessionConfig, startedAt: Date) {
  const deckCardIds = deckCardIdsForRun(config, room.teams.length)

  const updated = await tx.anatomimeGameRun.updateMany({
    where: {
      roomId: room.id,
      id: run.id,
      status: "LOBBY",
      phase: "LOBBY",
    },
    data: {
      status: "PLAYING",
      phase: "ACTIVE_TERM",
      config: json(config),
      deckCardIds,
      activeCardIndex: 0,
      activeTeamOrder: 0,
      termStartedAt: startedAt,
      termEndsAt: addSeconds(startedAt, config.roundSeconds),
      startedAt,
      completedAt: null,
      metadata: json({}),
    },
  })
  if (updated.count === 0) throw new StaleRoomMutationError()

  await tx.anatomimeGameRunTeamScore.deleteMany({
    where: { roomId: room.id, runId: run.id },
  })
  await createRunScores(tx, room, run.id)

  return { id: run.id }
}

async function advanceTermOrTurnReview(
  tx: Prisma.TransactionClient,
  room: AnatomimeRoomWithRelations,
  run: AnatomimeRunWithRelations,
  input: { scoreTeamId: string | null; activeOutcome: "got" | "missed" | "stolen" },
) {
  const now = new Date()
  const config = runConfig(run)
  const activeCard = activeRunCard(run)
  const activeTeam = activeRunTeam(room, run)
  if (!activeCard || !activeTeam) throw roomError(409, "no-active-item", "This game has no active anatomy item.")

  const metadata = withTermOutcome(run, {
    cardId: activeCard.id,
    cardIndex: run.activeCardIndex,
    activeTeamId: activeTeam.id,
    outcome: input.activeOutcome,
    scoredTeamId: input.scoreTeamId,
    resolvedAt: now.toISOString(),
  })
  const next = nextRunStep({
    activeCardIndex: run.activeCardIndex,
    termsPerTurn: ANATOMIME_TERMS_PER_TURN,
    teamCount: room.teams.length,
    activeTeamOrder: run.activeTeamOrder,
    roundLimit: config.roundLimit,
    hardcoreMode: config.hardcoreMode,
  })

  if (next.phase === "GAME_COMPLETE") {
    const updated = await tx.anatomimeGameRun.updateMany({
      where: expectedActiveTermRunWhere(room, run),
      data: {
        status: "GAME_COMPLETE",
        phase: "GAME_COMPLETE",
        termEndsAt: null,
        completedAt: now,
        metadata: json(metadata),
      },
    })
    if (updated.count === 0) throw new StaleRoomMutationError()
    await incrementRunScore(tx, room.id, run.id, input.scoreTeamId)
    await touchRoomIfUnchanged(tx, room, { status: "PLAYING", currentRunId: run.id }, {
      status: "GAME_COMPLETE",
      lastMeaningfulActivityAt: now,
      hostLastActivityAt: now,
    })
    return
  }

  if (next.phase === "TURN_REVIEW") {
    const updated = await tx.anatomimeGameRun.updateMany({
      where: expectedActiveTermRunWhere(room, run),
      data: {
        phase: "TURN_REVIEW",
        termEndsAt: null,
        metadata: json(metadata),
      },
    })
    if (updated.count === 0) throw new StaleRoomMutationError()
    await incrementRunScore(tx, room.id, run.id, input.scoreTeamId)
    await touchRoomIfUnchanged(tx, room, { status: "PLAYING", currentRunId: run.id }, { lastMeaningfulActivityAt: now })
    return
  }

  const updated = await tx.anatomimeGameRun.updateMany({
    where: expectedActiveTermRunWhere(room, run),
    data: {
      phase: "ACTIVE_TERM",
      activeCardIndex: next.activeCardIndex,
      activeTeamOrder: next.activeTeamOrder,
      termStartedAt: now,
      termEndsAt: addSeconds(now, config.roundSeconds),
      metadata: json(metadata),
    },
  })
  if (updated.count === 0) throw new StaleRoomMutationError()
  await incrementRunScore(tx, room.id, run.id, input.scoreTeamId)
  await touchRoomIfUnchanged(tx, room, { status: "PLAYING", currentRunId: run.id }, { lastMeaningfulActivityAt: now })
}

async function incrementRunScore(
  tx: Prisma.TransactionClient,
  roomId: string,
  runId: string,
  scoreTeamId: string | null,
) {
  if (!scoreTeamId) return

  await tx.anatomimeGameRunTeamScore.upsert({
    where: {
      runId_teamId: {
        runId,
        teamId: scoreTeamId,
      },
    },
    create: {
      roomId,
      runId,
      teamId: scoreTeamId,
      score: 1,
    },
    update: {
      score: { increment: 1 },
    },
  })
}

function countPlayerAttempts(
  guesses: AnatomimeRunWithRelations["guesses"],
  playerId: string,
  cardIndex: number,
  answerKind: AnatomimeAnswerKind,
) {
  return guesses.filter((guess) => guess.playerId === playerId && guess.cardIndex === cardIndex && guess.answerKind === answerKind).length
}

function termStateFromRunGuesses(
  guesses: AnatomimeRunWithRelations["guesses"],
  activeTeamId: string,
  cardId: string,
  cardIndex: number,
) {
  const state = createInitialTermState({ activeTeamId, cardId })

  return guesses
    .filter((guess) => guess.cardIndex === cardIndex && guess.cardId === cardId && guess.correct)
    .sort((first, second) => first.submittedAt.getTime() - second.submittedAt.getTime())
    .reduce<AnatomimeTermState>((current, guess) => {
      if (guess.teamId === activeTeamId && !current.firstActiveCorrect) {
        return {
          ...current,
          outcome: "got" as const,
          firstActiveCorrect: {
            playerId: guess.playerId ?? "",
            teamId: guess.teamId,
            userId: guess.userId,
            submittedAt: guess.submittedAt,
          },
        }
      }

      if (guess.teamId !== activeTeamId && !current.firstOpposingCorrect) {
        return {
          ...current,
          firstOpposingCorrect: {
            playerId: guess.playerId ?? "",
            teamId: guess.teamId,
            userId: guess.userId,
            submittedAt: guess.submittedAt,
          },
        }
      }

      return current
    }, state)
}

function multipleChoiceUnlocksAt(run: AnatomimeRunWithRelations, card: AnatomyStudyCard, config: AnatomimeSessionConfig) {
  if (config.answerMode !== "multiple-choice" || !run.termStartedAt) return null

  const choices = buildAnatomimeMultipleChoiceOptions(card, getAnatomimeCandidateCards(config), `${run.id}:${run.activeCardIndex}`)
  return addSeconds(run.termStartedAt, calculateMultipleChoiceUnlockSeconds(choices.map((choice) => choice.label)))
}

function roomMultipleChoiceOptions(
  run: Pick<AnatomimeRunWithRelations, "id" | "activeCardIndex">,
  card: AnatomyStudyCard,
  config: AnatomimeSessionConfig,
  candidateCards = getAnatomimeCandidateCards(config),
) {
  const choices = buildAnatomimeMultipleChoiceOptions(card, candidateCards, `${run.id}:${run.activeCardIndex}`)
  return buildOpaqueAnatomimeChoiceOptions(choices, `${run.id}:${run.activeCardIndex}`)
}

function roomTermKey(run: Pick<AnatomimeRunWithRelations, "id" | "activeCardIndex">) {
  return opaqueAnatomimeTermKey({ seed: run.id, cardIndex: run.activeCardIndex })
}

function currentTurnOutcomes(run: AnatomimeRunWithRelations) {
  const metadata = runMetadata(run.metadata)
  const turnStart = Math.floor(run.activeCardIndex / ANATOMIME_TERMS_PER_TURN) * ANATOMIME_TERMS_PER_TURN
  const turnEnd = turnStart + ANATOMIME_TERMS_PER_TURN

  return metadata.termOutcomes.filter((row) => row.cardIndex >= turnStart && row.cardIndex < turnEnd)
}

function recapRows(room: AnatomimeRoomWithRelations) {
  const run = room.currentRun
  if (!run) return []

  const metadata = runMetadata(run.metadata)
  return room.teams.map((team) => {
    const activeRows = metadata.termOutcomes.filter((row) => row.activeTeamId === team.id)
    return {
      teamId: team.id,
      got: activeRows.filter((row) => row.outcome === "got").length,
      missed: activeRows.filter((row) => row.outcome === "missed").length,
      stolen: activeRows.filter((row) => row.outcome === "stolen").length,
    }
  })
}

export async function createAnatomimeRoom(input: unknown, hostUserId?: string | null) {
  const config = normalizeAnatomimeSessionConfig(input)
  const minimumDeck = createAnatomimeSessionDeck(config)
  if (minimumDeck.length < ANATOMIME_TERMS_PER_TURN) {
    throw roomError(400, "empty-deck", "This Anatomime setup needs at least 4 matching sourced anatomy items.")
  }

  const pool = roomCardPool(config)
  const finalConfig: AnatomimeSessionConfig = {
    ...config,
    termCount: ANATOMIME_TERMS_PER_TURN,
    selectedCardIds: pool.map((card) => card.id).slice(0, 500),
    roundSeconds: ANATOMIME_TERM_SECONDS,
    stealSeconds: 0,
  }
  const code = await generateUniqueRoomCode()
  const hostToken = generateRandomToken(18)
  const now = new Date()

  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.anatomimeRoom.create({
      data: {
        code,
        status: "LOBBY",
        lastMeaningfulActivityAt: now,
        hostLastActivityAt: now,
        expiresAt: addMinutes(now, ANATOMIME_ROOM_IDLE_MINUTES),
        metadata: json({ setup: finalConfig }),
        teams: {
          create: finalConfig.teamNames.map((name, index) => ({ name, sortOrder: index })),
        },
      },
      include: roomInclude,
    })
    const host = await tx.anatomimeRoomPlayer.create({
      data: {
        roomId: created.id,
        displayName: "Host",
        userId: hostUserId ?? null,
        guestTokenHash: hashToken(hostToken),
        lastActionAt: now,
        lastSeenAt: now,
      },
    })

    return touchRoom(tx, created.id, { hostPlayerId: host.id })
  })

  await publishAnatomimeRealtimeEvent(code, "room-created", { code })
  return { room, hostToken }
}

export async function loadAnatomimeRoom(code: string, viewer: ViewerContext = {}) {
  const room = await prisma.anatomimeRoom.findUnique({
    where: { code: publicCode(code) },
    include: roomInclude,
  })
  if (!room) return null

  const currentRoom = await expireRoomIfIdle(room)
  return markViewerSeen(currentRoom, viewer)
}

export async function joinAnatomimeRoom(code: string, input: unknown, userId?: string | null) {
  const room = await loadAnatomimeRoom(code)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  const body = objectBody(input)
  const displayName = normalizeDisplayName(body.displayName)
  const requestedTeamId = typeof body.teamId === "string" ? body.teamId : ""
  const suppliedPlayerId = typeof body.playerId === "string" ? body.playerId : ""
  const suppliedToken = typeof body.playerToken === "string" ? body.playerToken : ""
  const token = generateRandomToken(18)
  const tokenHash = hashToken(token)
  const now = new Date()

  const updatedRoom = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    const existingSignedInPlayer = userId ? currentRoom.players.find((player) => player.userId === userId) : null
    const existingGuestPlayer = suppliedPlayerId
      ? currentRoom.players.find((player) => player.id === suppliedPlayerId && playerTokenMatches(player, suppliedToken))
      : null
    const existingPlayer = existingSignedInPlayer ?? existingGuestPlayer ?? null
    const joinStatus = canJoinRoom(
      {
        status: currentRoom.status,
        endedAt: currentRoom.endedAt,
        reviewExpiresAt: currentRoom.reviewExpiresAt,
        expiresAt: currentRoom.expiresAt,
        existingPlayerIds: currentRoom.players.map((player) => player.id),
      },
      { now, playerId: existingPlayer?.id ?? null },
    )
    if (!joinStatus.allowed) throw roomError(409, joinStatus.reason, "This room is no longer accepting new joins.")

    const requestedTeam = currentRoom.teams.find((team) => team.id === requestedTeamId)
    const fallbackTeam = currentRoom.teams[0] ?? null
    const nextTeamId = requestedTeam?.id ?? fallbackTeam?.id ?? null

    if (existingPlayer) {
      await tx.anatomimeRoomPlayer.update({
        where: {
          roomId_id: {
            roomId: currentRoom.id,
            id: existingPlayer.id,
          },
        },
        data: {
          displayName: existingPlayer.id === currentRoom.hostPlayerId ? existingPlayer.displayName : displayName,
          teamId: existingPlayer.id === currentRoom.hostPlayerId || currentRoom.status === "PLAYING" ? existingPlayer.teamId : nextTeamId,
          guestTokenHash: tokenHash,
          lastSeenAt: now,
          lastActionAt: now,
        },
      })
    } else {
      if (!nextTeamId) throw roomError(409, "no-teams", "This room has no available teams.")

      if (userId) {
        await tx.anatomimeRoomPlayer.upsert({
          where: {
            roomId_userId: {
              roomId: currentRoom.id,
              userId,
            },
          },
          create: {
            roomId: currentRoom.id,
            teamId: nextTeamId,
            userId,
            displayName,
            guestTokenHash: tokenHash,
            lastSeenAt: now,
            lastActionAt: now,
          },
          update: {
            guestTokenHash: tokenHash,
            lastSeenAt: now,
            lastActionAt: now,
          },
        })
      } else {
        await tx.anatomimeRoomPlayer.create({
          data: {
            roomId: currentRoom.id,
            teamId: nextTeamId,
            userId: null,
            displayName,
            guestTokenHash: tokenHash,
            lastSeenAt: now,
            lastActionAt: now,
          },
        })
      }
    }

    return touchRoom(tx, currentRoom.id, { lastMeaningfulActivityAt: now })
  })
  const player = userId
    ? updatedRoom.players.find((candidate) => candidate.userId === userId)
    : updatedRoom.players.find((candidate) => playerTokenMatches(candidate, token))
  if (!player) throw roomError(404, "player-not-found", "Player not found.")

  await publishAnatomimeRealtimeEvent(room.code, "player-joined", { playerId: player.id })
  return { room: updatedRoom, player, token }
}

export async function changeAnatomimeRoomTeam(code: string, input: unknown, viewer: ViewerContext) {
  const room = await loadAnatomimeRoom(code, viewer)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")
  if (room.status !== "LOBBY" && room.status !== "GAME_COMPLETE") {
    throw roomError(409, "team-change-locked", "Teams can only be changed before a game starts.")
  }

  const player = requireJoinedPlayer(room, viewer)
  if (player.id === room.hostPlayerId) throw roomError(403, "player-required", "Only joined players can change teams.")

  const body = objectBody(input)
  const teamId = typeof body.teamId === "string" ? body.teamId : ""
  const team = room.teams.find((candidate) => candidate.id === teamId)
  if (!team) throw roomError(404, "team-not-found", "Team not found.")

  const updated = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    if (currentRoom.status !== "LOBBY" && currentRoom.status !== "GAME_COMPLETE") {
      throw new StaleRoomMutationError()
    }

    const currentPlayer = requireJoinedPlayer(currentRoom, viewer)
    if (currentPlayer.id === currentRoom.hostPlayerId) {
      throw roomError(403, "player-required", "Only joined players can change teams.")
    }

    const currentTeam = currentRoom.teams.find((candidate) => candidate.id === teamId)
    if (!currentTeam) throw roomError(404, "team-not-found", "Team not found.")

    const moved = await tx.anatomimeRoomPlayer.updateMany({
      where: {
        roomId: currentRoom.id,
        id: currentPlayer.id,
        teamId: currentPlayer.teamId,
      },
      data: {
        teamId: currentTeam.id,
        lastSeenAt: new Date(),
        lastActionAt: new Date(),
      },
    })
    if (moved.count === 0) throw new StaleRoomMutationError()

    return touchRoomIfUnchanged(tx, currentRoom, {
      status: { in: ["LOBBY", "GAME_COMPLETE"] },
    }, { lastMeaningfulActivityAt: new Date() })
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "team-changed", { playerId: player.id, teamId: team.id })
  return updated
}

export async function startAnatomimeGameRun(code: string, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  if (room.status !== "LOBBY" && room.status !== "GAME_COMPLETE") {
    throw roomError(409, "room-not-startable", "This room is not ready to start a game.")
  }

  const startedAt = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    if (!viewerIsHost(currentRoom, viewer)) throw new StaleRoomMutationError()
    if (currentRoom.status !== "LOBBY" && currentRoom.status !== "GAME_COMPLETE") {
      throw new StaleRoomMutationError()
    }

    const config = setupConfigFromRoom(currentRoom)
    const currentLobbyRun = currentRoom.currentRun?.status === "LOBBY" ? currentRoom.currentRun : null
    const run = currentLobbyRun
      ? await startExistingLobbyRun(tx, currentRoom, currentLobbyRun, config, startedAt)
      : await createPlayingRun(tx, currentRoom, config, startedAt)

    return touchRoomIfUnchanged(tx, currentRoom, {
      status: { in: ["LOBBY", "GAME_COMPLETE"] },
      hostPlayerId: currentRoom.hostPlayerId,
      currentRunId: currentRoom.currentRunId,
    }, {
      status: "PLAYING",
      currentRunId: run.id,
      hostLastActivityAt: startedAt,
      lastMeaningfulActivityAt: startedAt,
    })
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "game-started", { code: room.code })
  return updated
}

export async function submitAnatomimeRoomGuess(code: string, input: unknown, viewer: ViewerContext) {
  const room = await loadRequiredPlayingRoom(code, viewer)
  const player = requireJoinedPlayer(room, viewer)
  if (!player.teamId) throw roomError(403, "team-required", "Join a team before guessing.")
  if (player.id === room.hostPlayerId) throw roomError(403, "player-required", "Only team players can guess.")

  const run = requireCurrentRun(room)
  if (run.status !== "PLAYING" || run.phase !== "ACTIVE_TERM") {
    throw roomError(409, "item-not-accepting-guesses", "This item is not accepting guesses.")
  }

  const body = objectBody(input)
  const answerKind: AnatomimeAnswerKind = typeof body.choiceId === "string" ? "choice" : "typed"
  const result = await prisma.$transaction(async (tx) => {
    const { room: lockedRoom, run: lockedRun } = await loadLockedActiveTermRoom(tx, room.id, run)
    const lockedPlayer = requireJoinedPlayer(lockedRoom, viewer)
    if (!lockedPlayer.teamId) throw roomError(403, "team-required", "Join a team before guessing.")
    if (lockedPlayer.id === lockedRoom.hostPlayerId) {
      throw roomError(403, "player-required", "Only team players can guess.")
    }

    const config = runConfig(lockedRun)
    if (canResolveTermTimeout({ termEndsAt: lockedRun.termEndsAt, now: new Date() })) {
      throw roomError(409, "term-expired", "This term has expired.")
    }
    if (config.answerMode === "host-judged") {
      throw roomError(409, "device-answers-disabled", "This game is using host-judged scoring.")
    }

    const activeCard = activeRunCard(lockedRun)
    const activeTeam = activeRunTeam(lockedRoom, lockedRun)
    if (!activeCard || !activeTeam) throw roomError(409, "no-active-item", "This game has no active anatomy item.")

    if (answerKind === "choice" && config.answerMode !== "multiple-choice") {
      throw roomError(409, "choice-disabled", "This game is not using multiple-choice answers.")
    }
    if (answerKind === "choice") {
      const unlocksAt = multipleChoiceUnlocksAt(lockedRun, activeCard, config)
      if (!unlocksAt || unlocksAt.getTime() > Date.now()) {
        throw roomError(409, "choice-locked", "Multiple-choice answers are not unlocked yet.")
      }
    }

    const priorAttempts = countPlayerAttempts(lockedRun.guesses, lockedPlayer.id, lockedRun.activeCardIndex, answerKind)
    const attemptStatus = answerKind === "choice" ? choiceGuessStatus(priorAttempts) : typedGuessStatus(priorAttempts)
    if (!attemptStatus.allowed) {
      throw roomError(
        409,
        "guess-limit-reached",
        answerKind === "choice" ? "You already used your multiple-choice guess." : "You are out of guesses for this term.",
      )
    }

    const submittedChoiceId = typeof body.choiceId === "string" ? body.choiceId : ""
    const submittedChoiceCardId = answerKind === "choice"
      ? resolveOpaqueAnatomimeChoiceId(
        roomMultipleChoiceOptions(lockedRun, activeCard, config),
        submittedChoiceId,
      )
      : null
    const correct = answerKind === "choice"
      ? submittedChoiceCardId === activeCard.id
      : checkAnatomimeAnswer(activeCard, typeof body.answer === "string" ? body.answer : "").correct
    const submittedAt = new Date()
    const state = termStateFromRunGuesses(
      lockedRun.guesses,
      activeTeam.id,
      activeCard.id,
      lockedRun.activeCardIndex,
    )
    const resolution = resolveDeviceGuess(state, {
      playerId: lockedPlayer.id,
      teamId: lockedPlayer.teamId ?? "",
      userId: lockedPlayer.userId,
      correct,
      answerKind,
      submittedAt,
    })
    const progressAwarded = Boolean(resolution.progressCreditPlayerId === lockedPlayer.id && lockedPlayer.userId)
    const guess = await tx.anatomimeGameRunGuess.create({
      data: {
        runId: lockedRun.id,
        roomId: lockedRoom.id,
        teamId: lockedPlayer.teamId ?? "",
        playerId: lockedPlayer.id,
        userId: lockedPlayer.userId,
        cardId: activeCard.id,
        cardIndex: lockedRun.activeCardIndex,
        activeTeamId: activeTeam.id,
        answerKind,
        correct,
        scoreAwarded: resolution.scoreTeamId ? 1 : 0,
        progressAwarded,
        metadata: json({
          feedbackKind: resolution.feedbackKind,
          answerLength: answerKind === "typed" && typeof body.answer === "string" ? body.answer.trim().length : null,
          choiceId: answerKind === "choice" ? submittedChoiceId : null,
        }),
        submittedAt,
      },
    })

    if (progressAwarded) {
      await updateAnatomimeNameRecallProgress(tx, {
        userId: lockedPlayer.userId,
        card: activeCard,
        correct: true,
        score: 100,
        source: answerKind === "choice" ? "device-choice" : "device-typed",
      })
    }
    if (resolution.shouldAdvance || resolution.scoreTeamId) {
      await advanceTermOrTurnReview(tx, lockedRoom, lockedRun, {
        scoreTeamId: resolution.scoreTeamId,
        activeOutcome: "got",
      })
    } else {
      await touchRoomIfUnchanged(
        tx,
        lockedRoom,
        { status: "PLAYING", currentRunId: lockedRun.id },
        { lastMeaningfulActivityAt: submittedAt },
      )
    }

    return { guess, resolution, room: await reloadRoom(tx, lockedRoom.id), correct }
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "guess-recorded", {
    roomId: room.id,
    correct: result.correct,
    scoreAwarded: result.guess.scoreAwarded,
    feedbackKind: result.resolution.feedbackKind,
  })

  return result
}

export async function markHostJudgedCorrect(code: string, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  const run = requireCurrentRun(room)
  const config = runConfig(run)
  if (room.status !== "PLAYING" || run.status !== "PLAYING" || run.phase !== "ACTIVE_TERM") {
    throw roomError(409, "item-not-accepting-guesses", "This item is not accepting guesses.")
  }
  if (config.answerMode !== "host-judged") {
    throw roomError(409, "host-judged-disabled", "This game is using device answers.")
  }

  const updated = await prisma.$transaction(async (tx) => {
    const { room: lockedRoom, run: lockedRun } = await loadLockedActiveTermRoom(tx, room.id, run)
    const lockedConfig = runConfig(lockedRun)
    if (lockedConfig.answerMode !== "host-judged") {
      throw roomError(409, "host-judged-disabled", "This game is using device answers.")
    }

    const activeCard = activeRunCard(lockedRun)
    const activeTeam = activeRunTeam(lockedRoom, lockedRun)
    if (!activeCard || !activeTeam) throw roomError(409, "no-active-item", "This game has no active anatomy item.")

    const state = termStateFromRunGuesses(
      lockedRun.guesses,
      activeTeam.id,
      activeCard.id,
      lockedRun.activeCardIndex,
    )
    const resolution = resolveHostJudgedCorrect(state)
    if (resolution.shouldAdvance || resolution.scoreTeamId) {
      await advanceTermOrTurnReview(tx, lockedRoom, lockedRun, {
        scoreTeamId: resolution.scoreTeamId,
        activeOutcome: "got",
      })
    }

    return reloadRoom(tx, lockedRoom.id)
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-judged-correct", { roomId: room.id })
  return updated
}

export async function resolveAnatomimeRoomTermTimeout(code: string, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  const run = requireCurrentRun(room)
  if (room.status !== "PLAYING" || run.status !== "PLAYING" || run.phase !== "ACTIVE_TERM") {
    throw roomError(409, "item-not-accepting-guesses", "This item is not accepting guesses.")
  }

  const updated = await prisma.$transaction(async (tx) => {
    const { room: lockedRoom, run: lockedRun } = await loadLockedActiveTermRoom(tx, room.id, run)
    const now = new Date()
    if (!canResolveTermTimeout({ termEndsAt: lockedRun.termEndsAt, now })) {
      throw roomError(409, "term-still-active", "This term is still active.")
    }

    const activeCard = activeRunCard(lockedRun)
    const activeTeam = activeRunTeam(lockedRoom, lockedRun)
    if (!activeCard || !activeTeam) throw roomError(409, "no-active-item", "This game has no active anatomy item.")

    const state = termStateFromRunGuesses(
      lockedRun.guesses,
      activeTeam.id,
      activeCard.id,
      lockedRun.activeCardIndex,
    )
    const resolution = resolveTermTimeout(state)
    if (resolution.shouldAdvance || resolution.scoreTeamId) {
      if (resolution.scoreTeamId && state.firstOpposingCorrect) {
        const scoredGuess = await tx.anatomimeGameRunGuess.updateMany({
          where: {
            roomId: lockedRoom.id,
            runId: lockedRun.id,
            cardId: activeCard.id,
            cardIndex: lockedRun.activeCardIndex,
            activeTeamId: activeTeam.id,
            teamId: state.firstOpposingCorrect.teamId,
            playerId: state.firstOpposingCorrect.playerId,
            correct: true,
            scoreAwarded: 0,
            submittedAt: state.firstOpposingCorrect.submittedAt,
          },
          data: { scoreAwarded: 1 },
        })
        if (scoredGuess.count === 0) throw new StaleRoomMutationError()
      }

      await advanceTermOrTurnReview(tx, lockedRoom, lockedRun, {
        scoreTeamId: resolution.scoreTeamId,
        activeOutcome: resolution.scoreTeamId ? "stolen" : "missed",
      })
    }

    return reloadRoom(tx, lockedRoom.id)
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "term-timeout", { roomId: room.id })
  return updated
}

export async function startNextAnatomimeTeamTurn(code: string, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  const run = requireCurrentRun(room)
  if (room.status !== "PLAYING" || run.status !== "PLAYING" || run.phase !== "TURN_REVIEW") {
    throw roomError(409, "turn-review-required", "The current turn is not ready for the next team.")
  }

  const updated = await prisma.$transaction(async (tx) => {
    const { room: lockedRoom, run: lockedRun } = await loadLockedTurnReviewRoom(tx, room.id, run)
    const config = runConfig(lockedRun)
    const now = new Date()
    const nextTeamOrder = lockedRoom.teams.length > 0 ? (lockedRun.activeTeamOrder + 1) % lockedRoom.teams.length : 0
    const nextCardIndex = lockedRun.activeCardIndex + 1
    const deckCardIds = nextCardIndex < lockedRun.deckCardIds.length || !config.hardcoreMode
      ? lockedRun.deckCardIds
      : [...lockedRun.deckCardIds, ...deckCardIdsForRun(config, lockedRoom.teams.length)]

    const updatedRun = await tx.anatomimeGameRun.updateMany({
      where: expectedTurnReviewRunWhere(lockedRoom, lockedRun),
      data: {
        phase: "ACTIVE_TERM",
        activeCardIndex: nextCardIndex,
        activeTeamOrder: nextTeamOrder,
        deckCardIds,
        termStartedAt: now,
        termEndsAt: addSeconds(now, config.roundSeconds),
      },
    })
    if (updatedRun.count === 0) throw new StaleRoomMutationError()

    return touchRoomIfUnchanged(tx, lockedRoom, { status: "PLAYING", currentRunId: lockedRun.id }, {
      status: "PLAYING",
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
    })
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "next-team-turn", { roomId: room.id })
  return updated
}

export async function startNextAnatomimeGame(code: string, input: unknown, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  if (room.status !== "GAME_COMPLETE") {
    throw roomError(409, "game-complete-required", "Finish the current game before starting a new one.")
  }

  const body = objectBody(input)
  const configOverride = objectBody(body.config)
  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    if (!viewerIsHost(currentRoom, viewer)) throw new StaleRoomMutationError()
    if (currentRoom.status !== "GAME_COMPLETE") throw new StaleRoomMutationError()

    const config = normalizeAnatomimeSessionConfig({
      ...setupConfigFromRoom(currentRoom),
      ...(configOverride.answerMode ? configOverride : {}),
    })
    const run = await createLobbyRun(tx, currentRoom, config)
    return touchRoomIfUnchanged(tx, currentRoom, {
      status: "GAME_COMPLETE",
      hostPlayerId: currentRoom.hostPlayerId,
      currentRunId: currentRoom.currentRunId,
    }, {
      status: "LOBBY",
      currentRunId: run.id,
      endedAt: null,
      reviewExpiresAt: null,
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
      metadata: json({ setup: config }),
    })
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "next-game", { roomId: room.id })
  return updated
}

export async function endAnatomimeRoomSession(code: string, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  if (room.status === "REVIEW" || room.status === "EXPIRED") {
    throw roomError(409, "room-not-active", "This room has already ended.")
  }

  const now = new Date()
  const reviewExpiresAt = addMinutes(now, ANATOMIME_REVIEW_WINDOW_MINUTES)
  const updated = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    if (!viewerIsHost(currentRoom, viewer)) throw new StaleRoomMutationError()
    if (currentRoom.status === "REVIEW" || currentRoom.status === "EXPIRED") {
      throw new StaleRoomMutationError()
    }

    return touchRoomIfUnchanged(tx, currentRoom, {
      status: { in: ["LOBBY", "PLAYING", "GAME_COMPLETE"] },
      hostPlayerId: currentRoom.hostPlayerId,
    }, {
      status: "REVIEW",
      endedAt: now,
      reviewExpiresAt,
      expiresAt: reviewExpiresAt,
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
    })
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "room-ended", { roomId: room.id })
  return updated
}

export async function transferAnatomimeRoomHost(code: string, input: unknown, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  const body = objectBody(input)
  const targetPlayerId = typeof body.playerId === "string" ? body.playerId : ""
  const target = room.players.find((player) => player.id === targetPlayerId)
  if (!target) throw roomError(404, "player-not-found", "Player not found.")
  if (room.status === "REVIEW" || room.status === "EXPIRED") {
    throw roomError(409, "room-not-active", "This room has already ended.")
  }

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    if (!viewerIsHost(currentRoom, viewer)) throw new StaleRoomMutationError()
    if (currentRoom.status === "REVIEW" || currentRoom.status === "EXPIRED") {
      throw new StaleRoomMutationError()
    }

    const currentTarget = currentRoom.players.find((player) => player.id === targetPlayerId)
    if (!currentTarget) throw roomError(404, "player-not-found", "Player not found.")

    return touchRoomIfUnchanged(tx, currentRoom, {
      status: { in: ["LOBBY", "PLAYING", "GAME_COMPLETE"] },
      hostPlayerId: currentRoom.hostPlayerId,
    }, {
      hostPlayerId: currentTarget.id,
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
    })
  }).catch((error) => {
    if (isStaleRoomMutation(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-transferred", { playerId: target.id })
  return updated
}

export async function requestAnatomimeHostElection(code: string, viewer: ViewerContext) {
  const room = await loadAnatomimeRoom(code, viewer)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  requireHostElectionMutableRoom(room)
  const updated = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    requireHostElectionMutableRoom(currentRoom)

    const currentPlayer = requireJoinedPlayer(currentRoom, viewer)
    const hostIdle = Date.now() - currentRoom.hostLastActivityAt.getTime() >= ANATOMIME_HOST_IDLE_SECONDS * 1000
    if (!hostIdle) throw roomError(409, "host-active", "The host was active recently.")
    if (currentRoom.elections.length > 0) throw roomError(409, "election-open", "A host vote is already open.")

    const candidatePlayerIds = currentRoom.players.map((candidate) => candidate.id)
    const activeVoterPlayerIds = candidatePlayerIds
    const now = new Date()
    await tx.anatomimeHostElection.create({
      data: {
        roomId: currentRoom.id,
        startedByPlayerId: currentPlayer.id,
        candidatePlayerIds,
        activeVoterPlayerIds,
        closesAt: addSeconds(now, ANATOMIME_ELECTION_SECONDS),
      },
    })

    return touchRoom(tx, currentRoom.id, { lastMeaningfulActivityAt: now })
  }).catch((error) => {
    if (isStaleRoomMutation(error) || isUniqueConstraintError(error)) throw staleRoomMutationRoomError()
    throw error
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-election-requested", { roomId: room.id })
  return updated
}

export async function submitAnatomimeHostElectionBallot(code: string, input: unknown, viewer: ViewerContext) {
  const room = await loadAnatomimeRoom(code, viewer)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  requireHostElectionMutableRoom(room)
  const player = requireJoinedPlayer(room, viewer)
  const election = room.elections[0]
  if (!election) throw roomError(404, "election-not-found", "No host vote is open.")
  if (!election.activeVoterPlayerIds.includes(player.id)) {
    throw roomError(403, "voter-not-eligible", "You cannot vote in this host election.")
  }

  const body = objectBody(input)
  const submittedRankedPlayerIds = Array.isArray(body.rankedPlayerIds)
    ? body.rankedPlayerIds.map(String)
    : []
  if (submittedRankedPlayerIds.length === 0) throw roomError(400, "empty-ballot", "Choose at least one host candidate.")

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    requireHostElectionMutableRoom(currentRoom)

    const currentPlayer = requireJoinedPlayer(currentRoom, viewer)
    const currentElection = currentRoom.elections[0]
    if (!currentElection) throw roomError(404, "election-not-found", "No host vote is open.")
    if (!currentElection.activeVoterPlayerIds.includes(currentPlayer.id)) {
      throw roomError(403, "voter-not-eligible", "You cannot vote in this host election.")
    }
    if (currentElection.closesAt.getTime() <= now.getTime()) {
      throw roomError(409, "election-closed", "This host vote is already closed.")
    }

    const candidateIds = new Set(currentElection.candidatePlayerIds)
    const rankedPlayerIds = submittedRankedPlayerIds.filter((id) => candidateIds.has(id))
    if (rankedPlayerIds.length === 0) throw roomError(400, "empty-ballot", "Choose at least one host candidate.")

    await tx.anatomimeHostElectionBallot.upsert({
      where: {
        electionId_voterPlayerId: {
          electionId: currentElection.id,
          voterPlayerId: currentPlayer.id,
        },
      },
      create: {
        roomId: currentRoom.id,
        electionId: currentElection.id,
        voterPlayerId: currentPlayer.id,
        rankedPlayerIds,
        submittedAt: now,
      },
      update: {
        rankedPlayerIds,
        submittedAt: now,
      },
    })
    await tx.anatomimeRoomPlayer.update({
      where: {
        roomId_id: {
          roomId: currentRoom.id,
          id: currentPlayer.id,
        },
      },
      data: { lastSeenAt: now, lastActionAt: now },
    })

    return touchRoom(tx, currentRoom.id, { lastMeaningfulActivityAt: now })
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-election-ballot", { playerId: player.id })
  return updated
}

export async function resolveAnatomimeHostElection(code: string, viewer: ViewerContext) {
  const room = await loadAnatomimeRoom(code, viewer)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  requireHostElectionMutableRoom(room)
  requireJoinedPlayer(room, viewer)
  const resolved = await prisma.$transaction(async (tx) => {
    const currentRoom = await reloadRoom(tx, room.id)
    requireHostElectionMutableRoom(currentRoom)
    requireJoinedPlayer(currentRoom, viewer)

    const election = currentRoom.elections[0]
    if (!election) throw roomError(404, "election-not-found", "No host vote is open.")

    const ballotVoterIds = new Set(election.ballots.map((ballot) => ballot.voterPlayerId))
    const allVotersSubmitted = election.activeVoterPlayerIds.every((playerId) => ballotVoterIds.has(playerId))
    if (!allVotersSubmitted && election.closesAt.getTime() > Date.now()) {
      throw roomError(409, "election-open", "This host vote is still open.")
    }

    const result = runInstantRunoffElection({
      candidateIds: election.candidatePlayerIds,
      ballots: election.ballots.map((ballot) => ballot.rankedPlayerIds),
    })
    const winnerId = result.winnerId ?? election.candidatePlayerIds.slice().sort()[0] ?? null
    if (!winnerId) throw roomError(409, "election-empty", "This host vote has no candidates.")

    const now = new Date()
    await tx.anatomimeHostElection.update({
      where: {
        roomId_id: {
          roomId: currentRoom.id,
          id: election.id,
        },
      },
      data: {
        status: "RESOLVED",
        winnerPlayerId: winnerId,
        roundHistory: json(result.rounds),
        resolvedAt: now,
      },
    })

    return {
      room: await touchRoom(tx, currentRoom.id, {
        hostPlayerId: winnerId,
        hostLastActivityAt: now,
        lastMeaningfulActivityAt: now,
      }),
      winnerId,
    }
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-election-resolved", { playerId: resolved.winnerId })
  return resolved.room
}

/**
 * Builds the stable shared-room payload consumed by host and player clients.
 * Host viewers receive answer-bearing prompts; players receive opaque term
 * keys until the game is complete. Date fields are serialized as ISO strings
 * or null, and host-election fields expose only public ballot state.
 */
export function summarizeAnatomimeRoom(room: AnatomimeRoomWithRelations, viewer: ViewerContext = {}) {
  const run = room.currentRun
  const config = run ? runConfig(run) : setupConfigFromRoom(room)
  const hostView = viewerIsHost(room, viewer)
  const player = viewerPlayer(room, viewer)
  const activeCard = run ? activeRunCard(run) : null
  const activeTeam = run ? activeRunTeam(room, run) : null
  const scoreByTeam = new Map((run?.scores ?? []).map((score) => [score.teamId, score.score]))
  const candidateCards = getAnatomimeCandidateCards(config)
  const now = new Date()
  const choiceUnlocksAt = run && activeCard ? multipleChoiceUnlocksAt(run, activeCard, config) : null
  const choices = run && activeCard && shouldExposeAnatomimeChoiceOptions({
    answerMode: config.answerMode,
    hostView,
    unlocksAt: choiceUnlocksAt,
    now,
  })
    ? roomMultipleChoiceOptions(run, activeCard, config, candidateCards).map((choice) => ({
      id: choice.id,
      label: choice.label,
    }))
    : []
  const pendingSteal = Boolean(run && activeCard && activeTeam && run.guesses.some((guess) => (
    guess.cardIndex === run.activeCardIndex &&
    guess.cardId === activeCard.id &&
    guess.correct &&
    guess.teamId !== activeTeam.id &&
    guess.scoreAwarded === 0
  )))
  const openElection = room.elections[0] ?? null

  return {
    code: room.code,
    status: room.status,
    phase: run?.phase ?? "LOBBY",
    config: {
      answerMode: config.answerMode,
      clueLevel: config.clueLevel,
      roundSeconds: config.roundSeconds,
      termCount: ANATOMIME_TERMS_PER_TURN,
      roundLimit: config.roundLimit,
      hardcoreMode: config.hardcoreMode,
    },
    phaseEndsAt: run?.termEndsAt?.toISOString() ?? null,
    reviewExpiresAt: room.reviewExpiresAt?.toISOString() ?? null,
    teams: room.teams.map((team) => ({
      id: team.id,
      name: team.name,
      sortOrder: team.sortOrder,
      score: scoreByTeam.get(team.id) ?? 0,
    })),
    players: room.players.map((roomPlayer) => ({
      id: roomPlayer.id,
      teamId: roomPlayer.teamId,
      displayName: roomPlayer.displayName,
      signedIn: Boolean(roomPlayer.userId),
      isHost: roomPlayer.id === room.hostPlayerId,
      lastSeenAt: roomPlayer.lastSeenAt.toISOString(),
    })),
    viewer: {
      isHost: hostView,
      playerId: player?.id ?? null,
      teamId: player?.teamId ?? null,
    },
    activeTeam: activeTeam
      ? {
        id: activeTeam.id,
        name: activeTeam.name,
        sortOrder: activeTeam.sortOrder,
        score: scoreByTeam.get(activeTeam.id) ?? 0,
      }
      : null,
    activeItem: run && activeCard
      ? {
        index: run.activeCardIndex,
        total: run.deckCardIds.length,
        prompt: hostView || run.phase === "GAME_COMPLETE"
          ? anatomimeTermFromCard(activeCard)
          : {
            id: roomTermKey(run),
            termKey: roomTermKey(run),
            categoryLabel: labelAnatomimeCategory(activeCard.category),
            regionLabels: activeCard.regions.map(labelAnatomimeRegion),
            bodySystemLabels: activeCard.bodySystemLabels,
            difficulty: activeCard.difficulty,
          },
        choices,
        multipleChoiceUnlocksAt: choiceUnlocksAt?.toISOString() ?? null,
        pendingSteal,
      }
      : null,
    turnReview: run
      ? currentTurnOutcomes(run).map((outcome) => {
        const card = cardById(outcome.cardId)

        return {
          ...anatomimeTurnReviewTermIdentity({
            seed: run.id,
            cardIndex: outcome.cardIndex,
            cardId: outcome.cardId,
            name: card?.name ?? outcome.cardId,
            hostView,
          }),
          outcome: outcome.outcome,
          scoredTeamId: outcome.scoredTeamId,
        }
      })
      : [],
    recap: recapRows(room),
    hostElection: openElection
      ? {
        id: openElection.id,
        closesAt: openElection.closesAt.toISOString(),
        candidatePlayerIds: openElection.candidatePlayerIds,
        activeVoterPlayerIds: openElection.activeVoterPlayerIds,
        submittedVoterPlayerIds: openElection.ballots.map((ballot) => ballot.voterPlayerId),
      }
      : null,
    hostCanBeChallenged: Date.now() - room.hostLastActivityAt.getTime() >= ANATOMIME_HOST_IDLE_SECONDS * 1000,
  }
}
