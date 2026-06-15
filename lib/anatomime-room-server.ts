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
  calculateMultipleChoiceUnlockSeconds,
  canJoinRoom,
  choiceGuessStatus,
  createInitialTermState,
  nextRunStep,
  resolveDeviceGuess,
  resolveHostJudgedCorrect,
  resolveTermTimeout,
  runInstantRunoffElection,
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
type AnatomimeRoomPlayer = AnatomimeRoomWithRelations["players"][number]
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
  const nextData = { ...data }
  if (data.lastMeaningfulActivityAt && !data.expiresAt) {
    const activityAt = data.lastMeaningfulActivityAt instanceof Date ? data.lastMeaningfulActivityAt : new Date()
    nextData.expiresAt = addMinutes(activityAt, ANATOMIME_ROOM_IDLE_MINUTES)
  }

  return tx.anatomimeRoom.update({
    where: { id: roomId },
    data: nextData,
    include: roomInclude,
  })
}

async function reloadRoom(tx: Prisma.TransactionClient, roomId: string) {
  const room = await tx.anatomimeRoom.findUnique({
    where: { id: roomId },
    include: roomInclude,
  })
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  return room
}

async function expireRoomIfIdle(room: AnatomimeRoomWithRelations) {
  if (room.status === "EXPIRED" || room.expiresAt.getTime() > Date.now()) return room

  return prisma.$transaction(async (tx) => {
    if (room.currentRun && room.currentRun.status === "PLAYING") {
      await tx.anatomimeGameRun.updateMany({
        where: { roomId: room.id, id: room.currentRun.id, status: "PLAYING" },
        data: {
          status: "GAME_COMPLETE",
          phase: "GAME_COMPLETE",
          termEndsAt: null,
          completedAt: new Date(),
        },
      })
    }

    return touchRoom(tx, room.id, {
      status: "EXPIRED",
      expiresAt: room.expiresAt,
    })
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

  await tx.anatomimeGameRunTeamScore.deleteMany({
    where: { roomId: room.id, runId: run.id },
  })
  await tx.anatomimeGameRun.update({
    where: {
      roomId_id: {
        roomId: room.id,
        id: run.id,
      },
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

  if (input.scoreTeamId) {
    await tx.anatomimeGameRunTeamScore.upsert({
      where: {
        runId_teamId: {
          runId: run.id,
          teamId: input.scoreTeamId,
        },
      },
      create: {
        roomId: room.id,
        runId: run.id,
        teamId: input.scoreTeamId,
        score: 1,
      },
      update: {
        score: { increment: 1 },
      },
    })
  }

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
    await tx.anatomimeGameRun.update({
      where: {
        roomId_id: {
          roomId: room.id,
          id: run.id,
        },
      },
      data: {
        status: "GAME_COMPLETE",
        phase: "GAME_COMPLETE",
        termEndsAt: null,
        completedAt: now,
        metadata: json(metadata),
      },
    })
    await touchRoom(tx, room.id, {
      status: "GAME_COMPLETE",
      lastMeaningfulActivityAt: now,
      hostLastActivityAt: now,
    })
    return
  }

  if (next.phase === "TURN_REVIEW") {
    await tx.anatomimeGameRun.update({
      where: {
        roomId_id: {
          roomId: room.id,
          id: run.id,
        },
      },
      data: {
        phase: "TURN_REVIEW",
        termEndsAt: null,
        metadata: json(metadata),
      },
    })
    await touchRoom(tx, room.id, { lastMeaningfulActivityAt: now })
    return
  }

  await tx.anatomimeGameRun.update({
    where: {
      roomId_id: {
        roomId: room.id,
        id: run.id,
      },
    },
    data: {
      phase: "ACTIVE_TERM",
      activeCardIndex: next.activeCardIndex,
      activeTeamOrder: next.activeTeamOrder,
      termStartedAt: now,
      termEndsAt: addSeconds(now, config.roundSeconds),
      metadata: json(metadata),
    },
  })
  await touchRoom(tx, room.id, { lastMeaningfulActivityAt: now })
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
  const existingSignedInPlayer = userId ? room.players.find((player) => player.userId === userId) : null
  const existingGuestPlayer = suppliedPlayerId
    ? room.players.find((player) => player.id === suppliedPlayerId && playerTokenMatches(player, suppliedToken))
    : null
  const existingPlayer = existingSignedInPlayer ?? existingGuestPlayer ?? null
  const joinStatus = canJoinRoom(
    {
      status: room.status,
      endedAt: room.endedAt,
      reviewExpiresAt: room.reviewExpiresAt,
      expiresAt: room.expiresAt,
      existingPlayerIds: room.players.map((player) => player.id),
    },
    { now: new Date(), playerId: existingPlayer?.id ?? null },
  )
  if (!joinStatus.allowed) throw roomError(409, joinStatus.reason, "This room is no longer accepting new joins.")

  const requestedTeam = room.teams.find((team) => team.id === requestedTeamId)
  const fallbackTeam = room.teams[0] ?? null
  const nextTeamId = requestedTeam?.id ?? fallbackTeam?.id ?? null
  const token = generateRandomToken(18)
  const now = new Date()

  const updatedRoom = await prisma.$transaction(async (tx) => {
    if (existingPlayer) {
      await tx.anatomimeRoomPlayer.update({
        where: {
          roomId_id: {
            roomId: room.id,
            id: existingPlayer.id,
          },
        },
        data: {
          displayName: existingPlayer.id === room.hostPlayerId ? existingPlayer.displayName : displayName,
          teamId: existingPlayer.id === room.hostPlayerId || room.status === "PLAYING" ? existingPlayer.teamId : nextTeamId,
          guestTokenHash: hashToken(token),
          lastSeenAt: now,
          lastActionAt: now,
        },
      })
    } else {
      if (!nextTeamId) throw roomError(409, "no-teams", "This room has no available teams.")

      await tx.anatomimeRoomPlayer.create({
        data: {
          roomId: room.id,
          teamId: nextTeamId,
          userId: userId ?? null,
          displayName,
          guestTokenHash: hashToken(token),
          lastSeenAt: now,
          lastActionAt: now,
        },
      })
    }

    return touchRoom(tx, room.id, { lastMeaningfulActivityAt: now })
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
    await tx.anatomimeRoomPlayer.update({
      where: {
        roomId_id: {
          roomId: room.id,
          id: player.id,
        },
      },
      data: {
        teamId: team.id,
        lastSeenAt: new Date(),
        lastActionAt: new Date(),
      },
    })

    return touchRoom(tx, room.id, { lastMeaningfulActivityAt: new Date() })
  })

  await publishAnatomimeRealtimeEvent(room.code, "team-changed", { playerId: player.id, teamId: team.id })
  return updated
}

export async function startAnatomimeGameRun(code: string, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  if (room.status !== "LOBBY" && room.status !== "GAME_COMPLETE") {
    throw roomError(409, "room-not-startable", "This room is not ready to start a game.")
  }

  const config = setupConfigFromRoom(room)
  const startedAt = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const currentLobbyRun = room.currentRun?.status === "LOBBY" ? room.currentRun : null
    const run = currentLobbyRun
      ? await startExistingLobbyRun(tx, room, currentLobbyRun, config, startedAt)
      : await createPlayingRun(tx, room, config, startedAt)

    return touchRoom(tx, room.id, {
      status: "PLAYING",
      currentRunId: run.id,
      hostLastActivityAt: startedAt,
      lastMeaningfulActivityAt: startedAt,
    })
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
  const config = runConfig(run)
  if (run.status !== "PLAYING" || run.phase !== "ACTIVE_TERM") {
    throw roomError(409, "item-not-accepting-guesses", "This item is not accepting guesses.")
  }
  if (run.termEndsAt && run.termEndsAt.getTime() < Date.now()) {
    throw roomError(409, "term-expired", "This term has expired.")
  }
  if (config.answerMode === "host-judged") {
    throw roomError(409, "device-answers-disabled", "This game is using host-judged scoring.")
  }

  const activeCard = activeRunCard(run)
  const activeTeam = activeRunTeam(room, run)
  if (!activeCard || !activeTeam) throw roomError(409, "no-active-item", "This game has no active anatomy item.")

  const body = objectBody(input)
  const answerKind: AnatomimeAnswerKind = typeof body.choiceId === "string" ? "choice" : "typed"
  if (answerKind === "choice" && config.answerMode !== "multiple-choice") {
    throw roomError(409, "choice-disabled", "This game is not using multiple-choice answers.")
  }
  if (answerKind === "choice") {
    const unlocksAt = multipleChoiceUnlocksAt(run, activeCard, config)
    if (!unlocksAt || unlocksAt.getTime() > Date.now()) {
      throw roomError(409, "choice-locked", "Multiple-choice answers are not unlocked yet.")
    }
  }

  const priorAttempts = countPlayerAttempts(run.guesses, player.id, run.activeCardIndex, answerKind)
  const attemptStatus = answerKind === "choice" ? choiceGuessStatus(priorAttempts) : typedGuessStatus(priorAttempts)
  if (!attemptStatus.allowed) {
    throw roomError(
      409,
      "guess-limit-reached",
      answerKind === "choice" ? "You already used your multiple-choice guess." : "You are out of guesses for this term.",
    )
  }

  const correct = answerKind === "choice"
    ? body.choiceId === activeCard.id
    : checkAnatomimeAnswer(activeCard, typeof body.answer === "string" ? body.answer : "").correct
  const submittedAt = new Date()
  const result = await prisma.$transaction(async (tx) => {
    const state = termStateFromRunGuesses(run.guesses, activeTeam.id, activeCard.id, run.activeCardIndex)
    const resolution = resolveDeviceGuess(state, {
      playerId: player.id,
      teamId: player.teamId ?? "",
      userId: player.userId,
      correct,
      answerKind,
      submittedAt,
    })
    const progressAwarded = Boolean(resolution.progressCreditPlayerId === player.id && player.userId)
    const guess = await tx.anatomimeGameRunGuess.create({
      data: {
        runId: run.id,
        roomId: room.id,
        teamId: player.teamId ?? "",
        playerId: player.id,
        userId: player.userId,
        cardId: activeCard.id,
        cardIndex: run.activeCardIndex,
        activeTeamId: activeTeam.id,
        answerKind,
        correct,
        scoreAwarded: resolution.scoreTeamId ? 1 : 0,
        progressAwarded,
        metadata: json({
          feedbackKind: resolution.feedbackKind,
          answerLength: answerKind === "typed" && typeof body.answer === "string" ? body.answer.trim().length : null,
          choiceId: answerKind === "choice" ? body.choiceId : null,
        }),
        submittedAt,
      },
    })

    if (progressAwarded) {
      await updateAnatomimeNameRecallProgress(tx, {
        userId: player.userId,
        card: activeCard,
        correct: true,
        score: 100,
        source: answerKind === "choice" ? "device-choice" : "device-typed",
      })
    }
    if (resolution.shouldAdvance || resolution.scoreTeamId) {
      await advanceTermOrTurnReview(tx, room, run, {
        scoreTeamId: resolution.scoreTeamId,
        activeOutcome: "got",
      })
    } else {
      await touchRoom(tx, room.id, { lastMeaningfulActivityAt: submittedAt })
    }

    return { guess, resolution, room: await reloadRoom(tx, room.id) }
  })

  await publishAnatomimeRealtimeEvent(room.code, "guess-recorded", {
    roomId: room.id,
    correct,
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

  const activeCard = activeRunCard(run)
  const activeTeam = activeRunTeam(room, run)
  if (!activeCard || !activeTeam) throw roomError(409, "no-active-item", "This game has no active anatomy item.")

  const updated = await prisma.$transaction(async (tx) => {
    const resolution = resolveHostJudgedCorrect(createInitialTermState({ activeTeamId: activeTeam.id, cardId: activeCard.id }))
    if (resolution.shouldAdvance || resolution.scoreTeamId) {
      await advanceTermOrTurnReview(tx, room, run, {
        scoreTeamId: resolution.scoreTeamId,
        activeOutcome: "got",
      })
    }

    return reloadRoom(tx, room.id)
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

  const activeCard = activeRunCard(run)
  const activeTeam = activeRunTeam(room, run)
  if (!activeCard || !activeTeam) throw roomError(409, "no-active-item", "This game has no active anatomy item.")

  const updated = await prisma.$transaction(async (tx) => {
    const state = termStateFromRunGuesses(run.guesses, activeTeam.id, activeCard.id, run.activeCardIndex)
    const resolution = resolveTermTimeout(state)
    if (resolution.shouldAdvance || resolution.scoreTeamId) {
      await advanceTermOrTurnReview(tx, room, run, {
        scoreTeamId: resolution.scoreTeamId,
        activeOutcome: resolution.scoreTeamId ? "stolen" : "missed",
      })
    }

    return reloadRoom(tx, room.id)
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

  const config = runConfig(run)
  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const nextTeamOrder = room.teams.length > 0 ? (run.activeTeamOrder + 1) % room.teams.length : 0
    const nextCardIndex = run.activeCardIndex + 1
    const deckCardIds = nextCardIndex < run.deckCardIds.length || !config.hardcoreMode
      ? run.deckCardIds
      : [...run.deckCardIds, ...deckCardIdsForRun(config, room.teams.length)]

    await tx.anatomimeGameRun.update({
      where: {
        roomId_id: {
          roomId: room.id,
          id: run.id,
        },
      },
      data: {
        phase: "ACTIVE_TERM",
        activeCardIndex: nextCardIndex,
        activeTeamOrder: nextTeamOrder,
        deckCardIds,
        termStartedAt: now,
        termEndsAt: addSeconds(now, config.roundSeconds),
      },
    })

    return touchRoom(tx, room.id, {
      status: "PLAYING",
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
    })
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
  const config = normalizeAnatomimeSessionConfig({
    ...setupConfigFromRoom(room),
    ...(objectBody(body.config).answerMode ? objectBody(body.config) : {}),
  })
  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const run = await createLobbyRun(tx, room, config)
    return touchRoom(tx, room.id, {
      status: "LOBBY",
      currentRunId: run.id,
      endedAt: null,
      reviewExpiresAt: null,
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
      metadata: json({ setup: config }),
    })
  })

  await publishAnatomimeRealtimeEvent(room.code, "next-game", { roomId: room.id })
  return updated
}

export async function endAnatomimeRoomSession(code: string, viewer: ViewerContext) {
  const room = await requireHostRoom(code, viewer)
  const now = new Date()
  const reviewExpiresAt = addMinutes(now, ANATOMIME_REVIEW_WINDOW_MINUTES)
  const updated = await prisma.$transaction(async (tx) => {
    return touchRoom(tx, room.id, {
      status: "REVIEW",
      endedAt: now,
      reviewExpiresAt,
      expiresAt: reviewExpiresAt,
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
    })
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

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    return touchRoom(tx, room.id, {
      hostPlayerId: target.id,
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
    })
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-transferred", { playerId: target.id })
  return updated
}

export async function requestAnatomimeHostElection(code: string, viewer: ViewerContext) {
  const room = await loadAnatomimeRoom(code, viewer)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  const player = requireJoinedPlayer(room, viewer)
  const hostIdle = Date.now() - room.hostLastActivityAt.getTime() >= ANATOMIME_HOST_IDLE_SECONDS * 1000
  if (!hostIdle) throw roomError(409, "host-active", "The host was active recently.")
  if (room.elections.length > 0) throw roomError(409, "election-open", "A host vote is already open.")

  const candidatePlayerIds = room.players.map((candidate) => candidate.id)
  const activeVoterPlayerIds = candidatePlayerIds
  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    await tx.anatomimeHostElection.create({
      data: {
        roomId: room.id,
        startedByPlayerId: player.id,
        candidatePlayerIds,
        activeVoterPlayerIds,
        closesAt: addSeconds(now, ANATOMIME_ELECTION_SECONDS),
      },
    })

    return touchRoom(tx, room.id, { lastMeaningfulActivityAt: now })
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-election-requested", { roomId: room.id })
  return updated
}

export async function submitAnatomimeHostElectionBallot(code: string, input: unknown, viewer: ViewerContext) {
  const room = await loadAnatomimeRoom(code, viewer)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  const player = requireJoinedPlayer(room, viewer)
  const election = room.elections[0]
  if (!election) throw roomError(404, "election-not-found", "No host vote is open.")
  if (!election.activeVoterPlayerIds.includes(player.id)) {
    throw roomError(403, "voter-not-eligible", "You cannot vote in this host election.")
  }

  const body = objectBody(input)
  const candidateIds = new Set(election.candidatePlayerIds)
  const rankedPlayerIds = Array.isArray(body.rankedPlayerIds)
    ? body.rankedPlayerIds.map(String).filter((id) => candidateIds.has(id))
    : []
  if (rankedPlayerIds.length === 0) throw roomError(400, "empty-ballot", "Choose at least one host candidate.")

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    await tx.anatomimeHostElectionBallot.upsert({
      where: {
        electionId_voterPlayerId: {
          electionId: election.id,
          voterPlayerId: player.id,
        },
      },
      create: {
        roomId: room.id,
        electionId: election.id,
        voterPlayerId: player.id,
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
          roomId: room.id,
          id: player.id,
        },
      },
      data: { lastSeenAt: now, lastActionAt: now },
    })

    return touchRoom(tx, room.id, { lastMeaningfulActivityAt: now })
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-election-ballot", { playerId: player.id })
  return updated
}

export async function resolveAnatomimeHostElection(code: string) {
  const room = await loadAnatomimeRoom(code)
  if (!room) throw roomError(404, "room-not-found", "Game not found.")

  const election = room.elections[0]
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
  const updated = await prisma.$transaction(async (tx) => {
    await tx.anatomimeHostElection.update({
      where: {
        roomId_id: {
          roomId: room.id,
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

    return touchRoom(tx, room.id, {
      hostPlayerId: winnerId,
      hostLastActivityAt: now,
      lastMeaningfulActivityAt: now,
    })
  })

  await publishAnatomimeRealtimeEvent(room.code, "host-election-resolved", { playerId: winnerId })
  return updated
}

export function summarizeAnatomimeRoom(room: AnatomimeRoomWithRelations, viewer: ViewerContext = {}) {
  const run = room.currentRun
  const config = run ? runConfig(run) : setupConfigFromRoom(room)
  const hostView = viewerIsHost(room, viewer)
  const player = viewerPlayer(room, viewer)
  const activeCard = run ? activeRunCard(run) : null
  const activeTeam = run ? activeRunTeam(room, run) : null
  const scoreByTeam = new Map((run?.scores ?? []).map((score) => [score.teamId, score.score]))
  const candidateCards = getAnatomimeCandidateCards(config)
  const choices = run && activeCard && config.answerMode === "multiple-choice"
    ? buildAnatomimeMultipleChoiceOptions(activeCard, candidateCards, `${run.id}:${run.activeCardIndex}`)
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
            id: activeCard.id,
            categoryLabel: labelAnatomimeCategory(activeCard.category),
            regionLabels: activeCard.regions.map(labelAnatomimeRegion),
            bodySystemLabels: activeCard.bodySystemLabels,
            difficulty: activeCard.difficulty,
          },
        choices,
        multipleChoiceUnlocksAt: multipleChoiceUnlocksAt(run, activeCard, config)?.toISOString() ?? null,
        pendingSteal,
      }
      : null,
    turnReview: run
      ? currentTurnOutcomes(run).map((outcome) => ({
        cardId: outcome.cardId,
        name: cardById(outcome.cardId)?.name ?? outcome.cardId,
        outcome: outcome.outcome,
        scoredTeamId: outcome.scoredTeamId,
      }))
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
