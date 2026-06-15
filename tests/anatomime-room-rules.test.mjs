import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  anatomimeTurnReviewTermIdentity,
  calculateMultipleChoiceUnlockSeconds,
  buildOpaqueAnatomimeChoiceOptions,
  canResolveTermTimeout,
  canJoinRoom,
  choiceGuessStatus,
  createInitialTermState,
  nextRunStep,
  resolveOpaqueAnatomimeChoiceId,
  resolveDeviceGuess,
  resolveHostJudgedCorrect,
  resolveTermTimeout,
  runInstantRunoffElection,
  shouldExposeAnatomimeChoiceOptions,
  typedGuessStatus,
} from "../lib/anatomime-room-rules.ts"

describe("Anatomime room rules", () => {
  it("advances immediately when the active team answers correctly", () => {
    const state = createInitialTermState({ activeTeamId: "team-a", cardId: "scapula" })
    const result = resolveDeviceGuess(state, {
      playerId: "player-a",
      teamId: "team-a",
      userId: "user-a",
      correct: true,
      answerKind: "typed",
      submittedAt: new Date("2026-06-15T12:00:00.000Z"),
    })

    assert.equal(result.feedbackKind, "active-correct")
    assert.equal(result.shouldAdvance, true)
    assert.equal(result.scoreTeamId, "team-a")
    assert.equal(result.progressCreditPlayerId, "player-a")
  })

  it("holds the first opposing correct answer as a possible steal", () => {
    const state = createInitialTermState({ activeTeamId: "team-a", cardId: "scapula" })
    const result = resolveDeviceGuess(state, {
      playerId: "player-b",
      teamId: "team-b",
      userId: "user-b",
      correct: true,
      answerKind: "typed",
      submittedAt: new Date("2026-06-15T12:00:01.000Z"),
    })

    assert.equal(result.feedbackKind, "opposing-correct-held")
    assert.equal(result.shouldAdvance, false)
    assert.equal(result.scoreTeamId, null)
    assert.equal(result.progressCreditPlayerId, "player-b")
    assert.equal(result.termState.firstOpposingCorrect?.teamId, "team-b")
  })

  it("scores the held steal on timeout when the active team misses", () => {
    const state = createInitialTermState({ activeTeamId: "team-a", cardId: "scapula" })
    const held = resolveDeviceGuess(state, {
      playerId: "player-b",
      teamId: "team-b",
      userId: "user-b",
      correct: true,
      answerKind: "typed",
      submittedAt: new Date("2026-06-15T12:00:01.000Z"),
    })
    const timeout = resolveTermTimeout(held.termState)

    assert.equal(timeout.feedbackKind, "timeout-steal-awarded")
    assert.equal(timeout.scoreTeamId, "team-b")
    assert.equal(timeout.activeOutcome, "missed")
  })

  it("keeps later correct answers as practice only", () => {
    const state = createInitialTermState({ activeTeamId: "team-a", cardId: "scapula" })
    const first = resolveDeviceGuess(state, {
      playerId: "player-b",
      teamId: "team-b",
      userId: "user-b",
      correct: true,
      answerKind: "typed",
      submittedAt: new Date("2026-06-15T12:00:01.000Z"),
    })
    const second = resolveDeviceGuess(first.termState, {
      playerId: "player-c",
      teamId: "team-b",
      userId: "user-c",
      correct: true,
      answerKind: "typed",
      submittedAt: new Date("2026-06-15T12:00:02.000Z"),
    })

    assert.equal(second.feedbackKind, "practice-correct")
    assert.equal(second.progressCreditPlayerId, null)
    assert.equal(second.scoreTeamId, null)
  })

  it("enforces typed and multiple-choice attempt limits", () => {
    assert.deepEqual(typedGuessStatus(0), { allowed: true, remainingAfterUse: 4 })
    assert.deepEqual(typedGuessStatus(4), { allowed: true, remainingAfterUse: 0 })
    assert.deepEqual(typedGuessStatus(5), { allowed: false, remainingAfterUse: 0 })
    assert.deepEqual(choiceGuessStatus(0), { allowed: true, remainingAfterUse: 0 })
    assert.deepEqual(choiceGuessStatus(1), { allowed: false, remainingAfterUse: 0 })
  })

  it("calculates bounded multiple-choice unlock windows", () => {
    assert.equal(calculateMultipleChoiceUnlockSeconds(["A", "B", "C", "D"]), 5)
    assert.equal(
      calculateMultipleChoiceUnlockSeconds([
        "Sternocleidomastoid",
        "Extensor hallucis longus",
        "Flexor digitorum superficialis",
        "Levator labii superioris alaeque nasi",
      ]),
      6,
    )
    assert.equal(
      calculateMultipleChoiceUnlockSeconds([
        "12345678901234567890123456789012345",
        "12345678901234567890123456789012345",
        "12345678901234567890123456789012345",
        "12345678901234567890123456789012345",
      ]),
      7,
    )
    assert.equal(
      calculateMultipleChoiceUnlockSeconds([
        "123456789012345678901234567890123456789012345678901234567890",
        "123456789012345678901234567890123456789012345678901234567890",
        "123456789012345678901234567890123456789012345678901234567890",
        "123456789012345678901234567890123456789012345678901234567890",
      ]),
      10,
    )
  })

  it("uses opaque room choice ids that resolve only on the server", () => {
    const rawOptions = [
      { id: "scapula", label: "Scapula" },
      { id: "humerus", label: "Humerus" },
      { id: "radius", label: "Radius" },
      { id: "ulna", label: "Ulna" },
    ]
    const choices = buildOpaqueAnatomimeChoiceOptions(rawOptions, "run-1:0")
    const repeated = buildOpaqueAnatomimeChoiceOptions(rawOptions, "run-1:0")
    const scapulaChoice = choices.find((choice) => choice.cardId === "scapula")

    assert.deepEqual(choices, repeated)
    assert.equal(choices.length, rawOptions.length)
    assert.equal(new Set(choices.map((choice) => choice.id)).size, choices.length)
    assert.ok(choices.every((choice) => choice.id !== choice.cardId))
    assert.equal(resolveOpaqueAnatomimeChoiceId(choices, scapulaChoice?.id ?? ""), "scapula")
    assert.equal(resolveOpaqueAnatomimeChoiceId(choices, "scapula"), null)
  })

  it("masks turn review answer identities for non-host viewers", () => {
    const hostIdentity = anatomimeTurnReviewTermIdentity({
      seed: "run-1",
      cardIndex: 2,
      cardId: "scapula",
      name: "Scapula",
      hostView: true,
    })
    const playerIdentity = anatomimeTurnReviewTermIdentity({
      seed: "run-1",
      cardIndex: 2,
      cardId: "scapula",
      name: "Scapula",
      hostView: false,
    })
    const repeatedPlayerIdentity = anatomimeTurnReviewTermIdentity({
      seed: "run-1",
      cardIndex: 2,
      cardId: "scapula",
      name: "Scapula",
      hostView: false,
    })
    const nextPlayerIdentity = anatomimeTurnReviewTermIdentity({
      seed: "run-1",
      cardIndex: 3,
      cardId: "humerus",
      name: "Humerus",
      hostView: false,
    })

    assert.deepEqual(hostIdentity, { cardId: "scapula", name: "Scapula" })
    assert.match(playerIdentity.cardId, /^term_/)
    assert.notEqual(playerIdentity.cardId, "scapula")
    assert.equal(playerIdentity.name, "")
    assert.deepEqual(playerIdentity, repeatedPlayerIdentity)
    assert.notEqual(playerIdentity.cardId, nextPlayerIdentity.cardId)
  })

  it("hides room multiple-choice options from hosts and players before unlock", () => {
    const unlocksAt = new Date("2026-06-15T12:00:05.000Z")

    assert.equal(shouldExposeAnatomimeChoiceOptions({
      answerMode: "multiple-choice",
      hostView: true,
      unlocksAt,
      now: new Date("2026-06-15T12:00:06.000Z"),
    }), false)
    assert.equal(shouldExposeAnatomimeChoiceOptions({
      answerMode: "multiple-choice",
      hostView: false,
      unlocksAt,
      now: new Date("2026-06-15T12:00:04.999Z"),
    }), false)
    assert.equal(shouldExposeAnatomimeChoiceOptions({
      answerMode: "multiple-choice",
      hostView: false,
      unlocksAt,
      now: unlocksAt,
    }), true)
    assert.equal(shouldExposeAnatomimeChoiceOptions({
      answerMode: "typed",
      hostView: false,
      unlocksAt,
      now: new Date("2026-06-15T12:00:06.000Z"),
    }), false)
  })

  it("only allows timeout resolution once the active term has expired", () => {
    const termEndsAt = new Date("2026-06-15T12:00:30.000Z")

    assert.equal(canResolveTermTimeout({ termEndsAt, now: new Date("2026-06-15T12:00:29.999Z") }), false)
    assert.equal(canResolveTermTimeout({ termEndsAt, now: new Date("2026-06-15T12:00:30.000Z") }), true)
    assert.equal(canResolveTermTimeout({ termEndsAt: null, now: new Date("2026-06-15T12:00:31.000Z") }), false)
  })

  it("host judged correct scores active team and advances", () => {
    const state = createInitialTermState({ activeTeamId: "team-a", cardId: "scapula" })
    const result = resolveHostJudgedCorrect(state)

    assert.equal(result.scoreTeamId, "team-a")
    assert.equal(result.shouldAdvance, true)
    assert.equal(result.activeOutcome, "got")
    assert.equal(result.progressCreditPlayerId, null)
  })

  it("keeps timeout resolution locked after a terminal active-team correct", () => {
    const state = createInitialTermState({ activeTeamId: "team-a", cardId: "scapula" })
    const terminal = resolveDeviceGuess(state, {
      playerId: "player-a",
      teamId: "team-a",
      userId: "user-a",
      correct: true,
      answerKind: "typed",
      submittedAt: new Date("2026-06-15T12:00:00.000Z"),
    })
    const timeout = resolveTermTimeout(terminal.termState)

    assert.equal(timeout.feedbackKind, "locked")
    assert.equal(timeout.shouldAdvance, false)
    assert.equal(timeout.scoreTeamId, null)
    assert.equal(timeout.progressCreditPlayerId, null)
    assert.equal(timeout.termState.outcome, "got")
  })

  it("keeps host-judged resolution locked after a timeout miss", () => {
    const state = createInitialTermState({ activeTeamId: "team-a", cardId: "scapula" })
    const missed = resolveTermTimeout(state)
    const result = resolveHostJudgedCorrect(missed.termState)

    assert.equal(result.feedbackKind, "locked")
    assert.equal(result.shouldAdvance, false)
    assert.equal(result.scoreTeamId, null)
    assert.equal(result.progressCreditPlayerId, null)
    assert.equal(result.termState.outcome, "missed")
  })

  it("blocks new joins after host-ended review starts", () => {
    const room = {
      status: "REVIEW",
      endedAt: new Date("2026-06-15T12:00:00.000Z"),
      reviewExpiresAt: new Date("2026-06-15T12:30:00.000Z"),
      expiresAt: new Date("2026-06-15T12:30:00.000Z"),
      existingPlayerIds: ["player-a"],
    }

    assert.equal(
      canJoinRoom(room, { now: new Date("2026-06-15T12:05:00.000Z"), playerId: "player-a" }).allowed,
      true,
    )
    assert.equal(
      canJoinRoom(room, { now: new Date("2026-06-15T12:05:00.000Z"), playerId: null }).allowed,
      false,
    )
    assert.equal(
      canJoinRoom(room, { now: new Date("2026-06-15T12:31:00.000Z"), playerId: "player-a" }).allowed,
      false,
    )
  })

  it("resolves instant-runoff host election", () => {
    const result = runInstantRunoffElection({
      candidateIds: ["host", "alpha", "beta"],
      ballots: [
        ["alpha", "beta", "host"],
        ["beta", "alpha", "host"],
        ["beta", "alpha", "host"],
      ],
    })

    assert.equal(result.winnerId, "beta")
    assert.deepEqual(result.rounds[0].eliminatedCandidateIds, ["host"])
  })

  it("uses the alphabetically first remaining candidate when every host election candidate is tied", () => {
    const result = runInstantRunoffElection({
      candidateIds: ["charlie", "bravo", "alpha"],
      ballots: [["charlie"], ["bravo"], ["alpha"]],
    })

    assert.equal(result.winnerId, "alpha")
    assert.deepEqual(result.rounds[0].eliminatedCandidateIds, [])
  })

  it("keeps team turns to four terms before turn review", () => {
    assert.deepEqual(
      nextRunStep({
        activeCardIndex: 0,
        termsPerTurn: 4,
        teamCount: 2,
        activeTeamOrder: 0,
        roundLimit: 3,
        hardcoreMode: false,
      }),
      {
        phase: "ACTIVE_TERM",
        activeCardIndex: 1,
        activeTeamOrder: 0,
        gameComplete: false,
      },
    )
    assert.deepEqual(
      nextRunStep({
        activeCardIndex: 3,
        termsPerTurn: 4,
        teamCount: 2,
        activeTeamOrder: 0,
        roundLimit: 3,
        hardcoreMode: false,
      }),
      {
        phase: "TURN_REVIEW",
        activeCardIndex: 3,
        activeTeamOrder: 0,
        gameComplete: false,
      },
    )
    assert.deepEqual(
      nextRunStep({
        activeCardIndex: 23,
        termsPerTurn: 4,
        teamCount: 2,
        activeTeamOrder: 1,
        roundLimit: 3,
        hardcoreMode: false,
      }),
      {
        phase: "GAME_COMPLETE",
        activeCardIndex: 23,
        activeTeamOrder: 1,
        gameComplete: true,
      },
    )
  })
})
