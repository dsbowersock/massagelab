import type { Prisma } from "@prisma/client"
import { generateRandomToken, hashToken } from "./auth-security.js"
import { prisma } from "./prisma.ts"
import {
  ANATOMIME_ACHIEVEMENTS,
  ANATOMIME_SESSION_TTL_HOURS,
  ANATOMIME_TOOL,
  anatomimeTermFromCard,
  buildAnatomimeMultipleChoiceOptions,
  canAwardImmediateScore,
  checkAnatomimeAnswer,
  createAnatomimeSessionDeck,
  getAnatomimeCandidateCards,
  getAnatomimeSetupOptions,
  labelAnatomimeCategory,
  labelAnatomimeRegion,
  nextActiveTeamOrder,
  normalizeAnatomimeSessionConfig,
  selectQueuedStealGuess,
  type AnatomimeSessionConfig,
  type AnatomimeSessionPhase,
} from "./anatomime-shared.ts"
import { updateAnatomimeNameRecallProgress } from "./anatomime-progress-server.ts"
import { publishAnatomimeRealtimeEvent } from "./anatomime-realtime.ts"

type SessionWithRelations = Prisma.AnatomimeGameSessionGetPayload<{
  include: typeof sessionInclude
}>

export type ViewerContext = {
  userId?: string | null
  playerId?: string
  playerToken?: string
}

export class AnatomimeSessionError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "AnatomimeSessionError"
    this.status = status
    this.code = code
  }
}

class StaleSessionMutationError extends Error {
  constructor() {
    super("Anatomime session changed before the transition could be applied.")
    this.name = "StaleSessionMutationError"
  }
}

function sessionError(status: number, code: string, message: string) {
  return new AnatomimeSessionError(status, code, message)
}

function isStaleSessionMutation(error: unknown) {
  return error instanceof StaleSessionMutationError
}

const sessionInclude = {
  teams: {
    orderBy: { sortOrder: "asc" as const },
  },
  players: {
    orderBy: { createdAt: "asc" as const },
  },
  guesses: {
    orderBy: { submittedAt: "asc" as const },
  },
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

function expiresAt(hours = ANATOMIME_SESSION_TTL_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

function phaseDeadline(seconds: number) {
  return new Date(Date.now() + seconds * 1000)
}

function publicCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRandomToken(5).replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase()
    if (code.length < 6) continue
    const existing = await prisma.anatomimeGameSession.findUnique({ where: { code }, select: { id: true } })
    if (!existing) return code
  }

  throw new Error("Could not generate Anatomime game code.")
}

function allCardsById() {
  const allCardsConfig = normalizeAnatomimeSessionConfig({ difficulty: "hard" })
  return new Map(getAnatomimeCandidateCards(allCardsConfig).map((card) => [card.id, card]))
}

function sessionCards(session: Pick<SessionWithRelations, "deckCardIds">) {
  const byId = allCardsById()
  return session.deckCardIds.map((id) => byId.get(id)).filter((card): card is NonNullable<ReturnType<typeof byId.get>> => Boolean(card))
}

function activeTeam(session: Pick<SessionWithRelations, "teams" | "activeTeamOrder">) {
  return session.teams.find((team) => team.sortOrder === session.activeTeamOrder) ?? session.teams[0] ?? null
}

function activeCard(session: Pick<SessionWithRelations, "deckCardIds" | "activeCardIndex">) {
  return sessionCards(session as Pick<SessionWithRelations, "deckCardIds">)[session.activeCardIndex] ?? null
}

function playerTokenMatches(player: { guestTokenHash: string | null }, token?: string) {
  return Boolean(token && player.guestTokenHash && hashToken(token) === player.guestTokenHash)
}

function viewerIsHost(session: SessionWithRelations, viewer: ViewerContext = {}) {
  if (viewer.userId && session.hostUserId === viewer.userId) return true
  return session.players.some((player) => (
    player.role === "HOST" &&
    player.id === viewer.playerId &&
    playerTokenMatches(player, viewer.playerToken)
  ))
}

function viewerPlayer(session: SessionWithRelations, viewer: ViewerContext = {}) {
  if (viewer.userId) {
    const playerByUser = session.players.find((player) => player.userId === viewer.userId && player.role === "PLAYER")
    if (playerByUser) return playerByUser
  }
  if (viewer.playerId) {
    const byToken = session.players.find((player) => player.id === viewer.playerId && playerTokenMatches(player, viewer.playerToken))
    if (byToken) return byToken
  }

  return null
}

function sessionConfig(session: Pick<SessionWithRelations, "config">) {
  return normalizeAnatomimeSessionConfig(session.config)
}

async function awardAchievement(tx: Prisma.TransactionClient, userId: string | null | undefined, key: string, metadata: Record<string, unknown>) {
  if (!userId) return

  await tx.achievement.upsert({
    where: { userId_key_tool: { userId, key, tool: ANATOMIME_TOOL } },
    create: {
      userId,
      key,
      tool: ANATOMIME_TOOL,
      metadata: json(metadata),
    },
    update: {},
  })
}

async function updateFlashcardLinkedProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  card: NonNullable<ReturnType<typeof activeCard>>,
  score: number,
  source: "device-typed" | "device-choice" = "device-typed",
) {
  await updateAnatomimeNameRecallProgress(tx, {
    userId,
    card,
    correct: true,
    score,
    source,
  })
}

async function awardWinningTeamAchievements(tx: Prisma.TransactionClient, sessionId: string) {
  const teams = await tx.anatomimeGameTeam.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, score: true },
  })
  const highScore = Math.max(...teams.map((team) => team.score))
  const winners = teams.filter((team) => team.score === highScore && highScore > 0)
  if (winners.length === 0) return

  const winnerIds = new Set(winners.map((team) => team.id))
  const players = await tx.anatomimeGamePlayer.findMany({
    where: {
      sessionId,
      teamId: { in: [...winnerIds] },
      userId: { not: null },
    },
    select: { userId: true, teamId: true },
  })

  for (const player of players) {
    await awardAchievement(tx, player.userId, ANATOMIME_ACHIEVEMENTS.firstTeamWin, {
      sessionId,
      teamId: player.teamId,
    })
  }
}

function expectedPlayingSessionWhere(session: SessionWithRelations): Prisma.AnatomimeGameSessionWhereInput {
  return {
    id: session.id,
    status: "PLAYING",
    phase: session.phase,
    activeCardIndex: session.activeCardIndex,
    activeTeamOrder: session.activeTeamOrder,
    phaseEndsAt: session.phaseEndsAt,
  }
}

async function advanceToNextCard(tx: Prisma.TransactionClient, session: SessionWithRelations, config: AnatomimeSessionConfig) {
  const nextIndex = session.activeCardIndex + 1
  const teamCount = session.teams.length

  if (nextIndex >= session.deckCardIds.length) {
    const updated = await tx.anatomimeGameSession.updateMany({
      where: expectedPlayingSessionWhere(session),
      data: {
        status: "COMPLETED",
        phase: "COMPLETED",
        completedAt: new Date(),
        phaseEndsAt: null,
      },
    })
    if (updated.count === 0) throw new StaleSessionMutationError()
    await awardWinningTeamAchievements(tx, session.id)
    return
  }

  const updated = await tx.anatomimeGameSession.updateMany({
    where: expectedPlayingSessionWhere(session),
    data: {
      phase: "ACTIVE",
      activeCardIndex: nextIndex,
      activeTeamOrder: nextActiveTeamOrder(session.activeTeamOrder, teamCount),
      phaseEndsAt: phaseDeadline(config.roundSeconds),
    },
  })
  if (updated.count === 0) throw new StaleSessionMutationError()
}

async function awardGuessAndAdvance(session: SessionWithRelations, guessId: string, teamId: string, options: { steal: boolean }) {
  const config = sessionConfig(session)

  try {
    await prisma.$transaction(async (tx) => {
      const claimedGuess = await tx.anatomimeGameGuess.updateMany({
        where: { id: guessId, sessionId: session.id, scoreAwarded: 0 },
        data: { scoreAwarded: 1 },
      })
      if (claimedGuess.count === 0) throw new StaleSessionMutationError()

      await tx.anatomimeGameTeam.update({
        where: { id: teamId },
        data: { score: { increment: 1 } },
      })
      if (options.steal) {
        const guess = await tx.anatomimeGameGuess.findUnique({
          where: { id: guessId },
          select: { userId: true, sessionId: true, teamId: true },
        })
        await awardAchievement(tx, guess?.userId, ANATOMIME_ACHIEVEMENTS.firstSteal, {
          sessionId: guess?.sessionId,
          teamId: guess?.teamId,
        })
      }
      await advanceToNextCard(tx, session, config)
    })

    return true
  } catch (error) {
    if (isStaleSessionMutation(error)) return false
    throw error
  }
}

async function transitionActiveToSteal(session: SessionWithRelations, config: AnatomimeSessionConfig) {
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.anatomimeGameSession.updateMany({
        where: expectedPlayingSessionWhere(session),
        data: {
          phase: "STEAL",
          phaseEndsAt: phaseDeadline(config.stealSeconds),
        },
      })
      if (updated.count === 0) throw new StaleSessionMutationError()
    })

    return true
  } catch (error) {
    if (isStaleSessionMutation(error)) return false
    throw error
  }
}

async function advanceWithoutScore(session: SessionWithRelations, config: AnatomimeSessionConfig) {
  try {
    await prisma.$transaction(async (tx) => {
      await advanceToNextCard(tx, session, config)
    })

    return true
  } catch (error) {
    if (isStaleSessionMutation(error)) return false
    throw error
  }
}

export async function loadAnatomimeSession(code: string) {
  const session = await prisma.anatomimeGameSession.findUnique({
    where: { code: publicCode(code) },
    include: sessionInclude,
  })
  if (!session) return null

  if (session.status !== "COMPLETED" && session.status !== "EXPIRED" && session.expiresAt.getTime() < Date.now()) {
    await prisma.anatomimeGameSession.updateMany({
      where: {
        id: session.id,
        status: { notIn: ["COMPLETED", "EXPIRED"] },
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED", phase: "COMPLETED", completedAt: new Date(), phaseEndsAt: null },
    })
    return prisma.anatomimeGameSession.findUnique({
      where: { id: session.id },
      include: sessionInclude,
    })
  }

  return advanceExpiredSession(session)
}

export async function advanceExpiredSession(session: SessionWithRelations): Promise<SessionWithRelations> {
  if (session.status !== "PLAYING" || !session.phaseEndsAt || session.phaseEndsAt.getTime() > Date.now()) return session

  const config = sessionConfig(session)
  const team = activeTeam(session)
  const card = activeCard(session)
  if (!team || !card) return session

  const currentCardGuesses = session.guesses.filter((guess) => guess.cardId === card.id)
  const queuedSteal = selectQueuedStealGuess(team.id, currentCardGuesses)

  if (session.phase === "ACTIVE") {
    if (queuedSteal) {
      await awardGuessAndAdvance(session, queuedSteal.id, queuedSteal.teamId, { steal: true })
    } else {
      await transitionActiveToSteal(session, config)
    }
  } else if (session.phase === "STEAL") {
    if (queuedSteal) {
      await awardGuessAndAdvance(session, queuedSteal.id, queuedSteal.teamId, { steal: true })
    } else {
      await advanceWithoutScore(session, config)
    }
  }

  const updated = await prisma.anatomimeGameSession.findUnique({
    where: { id: session.id },
    include: sessionInclude,
  })

  return updated ?? session
}

export async function createAnatomimeGameSession(input: unknown, hostUserId?: string | null) {
  const config = normalizeAnatomimeSessionConfig(input)
  const deck = createAnatomimeSessionDeck(config)
  if (deck.length === 0) {
    throw sessionError(400, "empty-deck", "This Anatomime setup has no matching sourced anatomy items.")
  }

  const finalConfig = {
    ...config,
    termCount: deck.length,
    selectedCardIds: deck.map((card) => card.id),
  }
  const code = await generateUniqueCode()
  const hostToken = generateRandomToken(18)
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.anatomimeGameSession.create({
      data: {
        code,
        hostUserId: hostUserId ?? null,
        status: "LOBBY",
        phase: "LOBBY",
        config: json(finalConfig),
        deckCardIds: deck.map((card) => card.id),
        expiresAt: expiresAt(),
        teams: {
          create: finalConfig.teamNames.map((name, index) => ({
            name,
            sortOrder: index,
          })),
        },
        players: {
          create: {
            displayName: "Host",
            role: "HOST",
            userId: hostUserId ?? null,
            guestTokenHash: hashToken(hostToken),
          },
        },
      },
      include: sessionInclude,
    })

    await awardAchievement(tx, hostUserId, ANATOMIME_ACHIEVEMENTS.firstSharedGame, { sessionId: created.id })

    return created
  })

  await publishAnatomimeRealtimeEvent(code, "session-created", { code })

  return {
    session,
    host: {
      playerId: session.players.find((player) => player.role === "HOST")?.id ?? "",
      token: hostToken,
    },
  }
}

export async function joinAnatomimeGameSession(code: string, input: unknown, userId?: string | null) {
  const session = await loadAnatomimeSession(code)
  if (!session || !["LOBBY", "PLAYING"].includes(session.status)) {
    throw sessionError(404, "game-not-found", "Game not found.")
  }

  const record = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const displayName = typeof record.displayName === "string" && record.displayName.trim()
    ? record.displayName.trim().slice(0, 60)
    : "Player"
  const requestedTeamId = typeof record.teamId === "string" ? record.teamId : ""
  const team = session.teams.find((candidate) => candidate.id === requestedTeamId) ?? session.teams[0]
  if (!team) throw sessionError(409, "no-teams", "This game has no available teams.")

  const token = generateRandomToken(18)
  const player = userId
    ? await prisma.anatomimeGamePlayer.upsert({
      where: {
        sessionId_userId_role: {
          sessionId: session.id,
          userId,
          role: "PLAYER",
        },
      },
      create: {
        sessionId: session.id,
        teamId: team.id,
        userId,
        displayName,
        guestTokenHash: hashToken(token),
        role: "PLAYER",
      },
      update: {
        teamId: team.id,
        displayName,
        guestTokenHash: hashToken(token),
        lastSeenAt: new Date(),
      },
    })
    : await prisma.anatomimeGamePlayer.create({
      data: {
        sessionId: session.id,
        teamId: team.id,
        userId: null,
        displayName,
        guestTokenHash: hashToken(token),
        role: "PLAYER",
      },
    })

  await publishAnatomimeRealtimeEvent(session.code, "player-joined", { playerId: player.id })

  return { player, token }
}

export async function startAnatomimeGameSession(code: string, viewer: ViewerContext) {
  const session = await loadAnatomimeSession(code)
  if (!session) throw sessionError(404, "game-not-found", "Game not found.")
  if (!viewerIsHost(session, viewer)) throw sessionError(403, "host-required", "Only the host can start this game.")
  if (session.status === "COMPLETED" || session.status === "EXPIRED") {
    throw sessionError(409, "game-terminal", "This game is already complete.")
  }
  if (session.status === "PLAYING") throw sessionError(409, "game-already-started", "This game has already started.")

  const config = sessionConfig(session)
  const startedAt = session.startedAt ?? new Date()
  const started = await prisma.anatomimeGameSession.updateMany({
    where: { id: session.id, status: "LOBBY" },
    data: {
      status: "PLAYING",
      phase: "ACTIVE",
      activeCardIndex: 0,
      activeTeamOrder: 0,
      startedAt,
      phaseEndsAt: phaseDeadline(config.roundSeconds),
    },
  })
  if (started.count === 0) throw sessionError(409, "game-already-started", "This game has already started.")
  const updated = await prisma.anatomimeGameSession.findUnique({
    where: { id: session.id },
    include: sessionInclude,
  })
  if (!updated) throw sessionError(404, "game-not-found", "Game not found.")

  await publishAnatomimeRealtimeEvent(session.code, "game-started", { code: session.code })

  return updated
}

export async function recordAnatomimeGuess(code: string, input: unknown, viewer: ViewerContext) {
  const session = await loadAnatomimeSession(code)
  if (!session) throw sessionError(404, "game-not-found", "Game not found.")
  if (session.status !== "PLAYING") throw sessionError(409, "not-accepting-guesses", "This game is not currently accepting guesses.")

  const player = viewerPlayer(session, viewer)
  if (!player || player.role !== "PLAYER" || !player.teamId) throw sessionError(403, "join-required", "Join a team before guessing.")

  const phase = session.phase as AnatomimeSessionPhase
  if (phase !== "ACTIVE" && phase !== "STEAL") throw sessionError(409, "item-not-accepting-guesses", "This item is not accepting guesses.")

  const config = sessionConfig(session)
  const card = activeCard(session)
  const team = activeTeam(session)
  if (!card || !team) throw sessionError(409, "no-active-item", "This game has no active anatomy item.")

  const record = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const answer = typeof record.answer === "string" ? record.answer : ""
  const choiceId = typeof record.choiceId === "string" ? record.choiceId : ""
  const answerCheck = config.answerMode === "multiple-choice"
    ? { correct: choiceId === card.id, score: choiceId === card.id ? 100 : 0 }
    : checkAnatomimeAnswer(card, answer)
  const existingCorrect = await prisma.anatomimeGameGuess.findFirst({
    where: {
      sessionId: session.id,
      playerId: player.id,
      cardId: card.id,
      correct: true,
    },
    select: { id: true },
  })
  const shouldAwardScore = canAwardImmediateScore(phase, team.id, player.teamId, answerCheck.correct)

  let guess
  try {
    guess = await prisma.$transaction(async (tx) => {
      const created = await tx.anatomimeGameGuess.create({
        data: {
          sessionId: session.id,
          teamId: player.teamId ?? team.id,
          playerId: player.id,
          userId: player.userId,
          cardId: card.id,
          answerMode: config.answerMode,
          phase,
          correct: answerCheck.correct,
          scoreAwarded: shouldAwardScore ? 1 : 0,
          metadata: json({
            activeTeamOrder: session.activeTeamOrder,
            activeCardIndex: session.activeCardIndex,
          }),
        },
      })

      await tx.anatomimeGamePlayer.update({
        where: { id: player.id },
        data: { lastSeenAt: new Date() },
      })

      if (answerCheck.correct && player.userId && !existingCorrect) {
        await updateFlashcardLinkedProgress(
          tx,
          player.userId,
          card,
          answerCheck.score,
          config.answerMode === "multiple-choice" ? "device-choice" : "device-typed",
        )
        await awardAchievement(tx, player.userId, ANATOMIME_ACHIEVEMENTS.firstCorrectGuess, {
          sessionId: session.id,
          cardId: card.id,
        })
      }

      if (shouldAwardScore) {
        await tx.anatomimeGameTeam.update({
          where: { id: player.teamId ?? team.id },
          data: { score: { increment: 1 } },
        })
        if (phase === "STEAL") {
          await awardAchievement(tx, player.userId, ANATOMIME_ACHIEVEMENTS.firstSteal, {
            sessionId: session.id,
            teamId: player.teamId,
          })
        }
        await advanceToNextCard(tx, session, config)
      }

      return created
    })
  } catch (error) {
    if (isStaleSessionMutation(error)) {
      throw sessionError(409, "stale-session", "This item is no longer accepting guesses.")
    }
    throw error
  }

  await publishAnatomimeRealtimeEvent(session.code, "guess-recorded", {
    sessionId: session.id,
    correct: answerCheck.correct,
    scoreAwarded: guess.scoreAwarded,
  })

  return {
    guess,
    correct: answerCheck.correct,
    scoreAwarded: guess.scoreAwarded,
  }
}

/**
 * Produces the public shared-session payload consumed by host and player
 * clients. Dates are ISO strings (`expiresAt` is always present; phase,
 * start, and completion dates may be null), teams/players/recentGuesses keep
 * stable object keys, and answer-bearing values from `anatomimeTermFromCard`
 * plus full deck contents are host-only except after `phase === "COMPLETED"`;
 * multiple-choice labels come from `buildAnatomimeMultipleChoiceOptions`.
 */
export function summarizeAnatomimeSession(session: SessionWithRelations, viewer: ViewerContext = {}) {
  const config = sessionConfig(session)
  const hostView = viewerIsHost(session, viewer)
  const player = viewerPlayer(session, viewer)
  const cards = sessionCards(session)
  const card = cards[session.activeCardIndex] ?? null
  const team = activeTeam(session)
  const candidateCards = getAnatomimeCandidateCards(config)
  const setupOptions = getAnatomimeSetupOptions()

  return {
    id: session.id,
    code: session.code,
    status: session.status,
    phase: session.phase,
    config,
    realtime: {
      channel: `anatomime:${session.code}`,
    },
    activeCardIndex: session.activeCardIndex,
    activeTeamOrder: session.activeTeamOrder,
    phaseEndsAt: session.phaseEndsAt?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    expiresAt: session.expiresAt.toISOString(),
    teams: session.teams.map((sessionTeam) => ({
      id: sessionTeam.id,
      name: sessionTeam.name,
      sortOrder: sessionTeam.sortOrder,
      score: sessionTeam.score,
    })),
    players: session.players.map((sessionPlayer) => ({
      id: sessionPlayer.id,
      teamId: sessionPlayer.teamId,
      displayName: sessionPlayer.displayName,
      role: sessionPlayer.role,
      signedIn: Boolean(sessionPlayer.userId),
      lastSeenAt: sessionPlayer.lastSeenAt.toISOString(),
    })),
    viewer: {
      isHost: hostView,
      playerId: player?.id ?? null,
      teamId: player?.teamId ?? null,
    },
    activeTeam: team
      ? {
        id: team.id,
        name: team.name,
        sortOrder: team.sortOrder,
      }
      : null,
    activeItem: card
      ? {
        index: session.activeCardIndex,
        total: cards.length,
        prompt: hostView || session.phase === "COMPLETED"
          ? anatomimeTermFromCard(card)
          : {
            categoryLabel: labelAnatomimeCategory(card.category),
            regionLabels: card.regions.map(labelAnatomimeRegion),
            difficulty: card.difficulty,
          },
        choices: config.answerMode === "multiple-choice"
          ? buildAnatomimeMultipleChoiceOptions(card, candidateCards, `${session.id}:${session.activeCardIndex}`)
          : [],
      }
      : null,
    recentGuesses: session.guesses.slice(-12).map((guess) => ({
      id: guess.id,
      teamId: guess.teamId,
      playerId: guess.playerId,
      cardId: guess.cardId,
      correct: guess.correct,
      scoreAwarded: guess.scoreAwarded,
      phase: guess.phase,
      submittedAt: guess.submittedAt.toISOString(),
    })),
    deck: hostView
      ? cards.map(anatomimeTermFromCard)
      : [],
    setupOptions,
  }
}
