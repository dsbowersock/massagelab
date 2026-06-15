import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  calculateMultipleChoiceUnlockSeconds,
  canJoinRoom,
  createInitialTermState,
  nextRunStep,
  resolveDeviceGuess,
  resolveHostJudgedCorrect,
  resolveTermTimeout,
  runInstantRunoffElection,
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
      7,
    )
    assert.equal(
      calculateMultipleChoiceUnlockSeconds([
        "A very long first option label",
        "A very long second option label",
        "A very long third option label",
        "A very long fourth option label",
      ]),
      10,
    )
  })

  it("host judged correct scores active team and advances", () => {
    const state = createInitialTermState({ activeTeamId: "team-a", cardId: "scapula" })
    const result = resolveHostJudgedCorrect(state)

    assert.equal(result.scoreTeamId, "team-a")
    assert.equal(result.shouldAdvance, true)
    assert.equal(result.activeOutcome, "got")
    assert.equal(result.progressCreditPlayerId, null)
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
