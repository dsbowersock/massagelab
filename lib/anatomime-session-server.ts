import type { Prisma } from "@prisma/client"
import { generateRandomToken, hashToken } from "./auth-security.js"
import { prisma } from "./prisma.ts"
import {
  ANATOMIME_ACHIEVEMENTS,
  ANATOMIME_SESSION_TTL_HOURS,
  ANATOMIME_TOOL,
  anatomimeFlashcardProgressTool,
  anatomimeProgressResult,
  anatomimeTermFromCard,
  buildAnatomimeMultipleChoiceOptions,
  canAwardImmediateScore,
  checkAnatomimeAnswer,
  createAnatomimeSessionDeck,
  getAnatomimeCandidateCards,
  getAnatomimeSetupOptions,
  getAnatomimeNameRecallPrompt,
  labelAnatomimeCategory,
  labelAnatomimeRegion,
  nextActiveTeamOrder,
  normalizeAnatomimeSessionConfig,
  selectQueuedStealGuess,
  type AnatomimeSessionConfig,
  type AnatomimeSessionPhase,
} from "./anatomime-shared.ts"
import { nextFlashcardProgressUpdate } from "./flashcard-progress.ts"
import { publishAnatomimeRealtimeEvent } from "./anatomime-realtime.ts"

type SessionWithRelations = Prisma.AnatomimeGameSessionGetPayload<{
  include: typeof sessionInclude
}>

type ViewerContext = {
  userId?: string | null
  playerId?: string
  playerToken?: string
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
  if (viewer.playerId) {
    const byToken = session.players.find((player) => player.id === viewer.playerId && playerTokenMatches(player, viewer.playerToken))
    if (byToken) return byToken
  }
  if (viewer.userId) return session.players.find((player) => player.userId === viewer.userId) ?? null

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
) {
  const prompt = getAnatomimeNameRecallPrompt(card.id)
  if (!prompt) return

  const result = anatomimeProgressResult(card, true, score)
  const tool = anatomimeFlashcardProgressTool(card.id)
  const existing = await tx.learningProgress.findFirst({
    where: {
      userId,
      anatomyTermId: null,
      tool,
    },
    select: { id: true, metadata: true },
  })
  const update = nextFlashcardProgressUpdate(existing?.metadata, result)
  const data = {
    status: update.status,
    score: update.score,
    metadata: json(update.metadata),
    lastSeenAt: new Date(),
  }

  if (existing) {
    await tx.learningProgress.update({ where: { id: existing.id }, data })
  } else {
    await tx.learningProgress.create({
      data: {
        userId,
        anatomyTermId: null,
        tool,
        ...data,
      },
    })
  }
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

async function advanceToNextCard(tx: Prisma.TransactionClient, session: SessionWithRelations, config: AnatomimeSessionConfig) {
  const nextIndex = session.activeCardIndex + 1
  const teamCount = session.teams.length

  if (nextIndex >= session.deckCardIds.length) {
    await tx.anatomimeGameSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        phase: "COMPLETED",
        completedAt: new Date(),
        phaseEndsAt: null,
      },
    })
    await awardWinningTeamAchievements(tx, session.id)
    return
  }

  await tx.anatomimeGameSession.update({
    where: { id: session.id },
    data: {
      phase: "ACTIVE",
      activeCardIndex: nextIndex,
      activeTeamOrder: nextActiveTeamOrder(session.activeTeamOrder, teamCount),
      phaseEndsAt: phaseDeadline(config.roundSeconds),
    },
  })
}

async function awardGuessAndAdvance(session: SessionWithRelations, guessId: string, teamId: string, options: { steal: boolean }) {
  const config = sessionConfig(session)

  await prisma.$transaction(async (tx) => {
    await tx.anatomimeGameGuess.update({
      where: { id: guessId },
      data: { scoreAwarded: 1 },
    })
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
}

export async function loadAnatomimeSession(code: string) {
  const session = await prisma.anatomimeGameSession.findUnique({
    where: { code: publicCode(code) },
    include: sessionInclude,
  })
  if (!session) return null

  if (session.status !== "COMPLETED" && session.expiresAt.getTime() < Date.now()) {
    await prisma.anatomimeGameSession.update({
      where: { id: session.id },
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
      await prisma.anatomimeGameSession.update({
        where: { id: session.id },
        data: {
          phase: "STEAL",
          phaseEndsAt: phaseDeadline(config.stealSeconds),
        },
      })
    }
  } else if (session.phase === "STEAL") {
    if (queuedSteal) {
      await awardGuessAndAdvance(session, queuedSteal.id, queuedSteal.teamId, { steal: true })
    } else {
      await prisma.$transaction(async (tx) => {
        await advanceToNextCard(tx, session, config)
      })
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
    throw new Error("This Anatomime setup has no matching sourced anatomy items.")
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
    throw new Error("Game not found.")
  }

  const record = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const displayName = typeof record.displayName === "string" && record.displayName.trim()
    ? record.displayName.trim().slice(0, 60)
    : "Player"
  const requestedTeamId = typeof record.teamId === "string" ? record.teamId : ""
  const team = session.teams.find((candidate) => candidate.id === requestedTeamId) ?? session.teams[0]
  if (!team) throw new Error("This game has no available teams.")

  const token = generateRandomToken(18)
  const player = await prisma.anatomimeGamePlayer.create({
    data: {
      sessionId: session.id,
      teamId: team.id,
      userId: userId ?? null,
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
  if (!session) throw new Error("Game not found.")
  if (!viewerIsHost(session, viewer)) throw new Error("Only the host can start this game.")
  if (session.status === "COMPLETED") throw new Error("This game is already complete.")

  const config = sessionConfig(session)
  const updated = await prisma.anatomimeGameSession.update({
    where: { id: session.id },
    data: {
      status: "PLAYING",
      phase: "ACTIVE",
      activeCardIndex: 0,
      activeTeamOrder: 0,
      startedAt: session.startedAt ?? new Date(),
      phaseEndsAt: phaseDeadline(config.roundSeconds),
    },
    include: sessionInclude,
  })

  await publishAnatomimeRealtimeEvent(session.code, "game-started", { code: session.code })

  return updated
}

export async function recordAnatomimeGuess(code: string, input: unknown, viewer: ViewerContext) {
  const session = await loadAnatomimeSession(code)
  if (!session) throw new Error("Game not found.")
  if (session.status !== "PLAYING") throw new Error("This game is not currently accepting guesses.")

  const player = viewerPlayer(session, viewer)
  if (!player || player.role !== "PLAYER" || !player.teamId) throw new Error("Join a team before guessing.")

  const phase = session.phase as AnatomimeSessionPhase
  if (phase !== "ACTIVE" && phase !== "STEAL") throw new Error("This item is not accepting guesses.")

  const config = sessionConfig(session)
  const card = activeCard(session)
  const team = activeTeam(session)
  if (!card || !team) throw new Error("This game has no active anatomy item.")

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

  const guess = await prisma.$transaction(async (tx) => {
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
      await updateFlashcardLinkedProgress(tx, player.userId, card, answerCheck.score)
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
