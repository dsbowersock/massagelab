import { fetchJsonWithTimeout } from "../../lib/client-fetch.ts"
import type { AnatomimeRoomSummary } from "./shared-session-types"

/** Bounds one room snapshot across both transport and successful JSON consumption. */
export const ANATOMIME_ROOM_SNAPSHOT_TIMEOUT_MS = 1_500

/** Prevents repeated manual action traffic when a nonconforming 429 omits a usable delay. */
export const ANATOMIME_ACTION_RETRY_FALLBACK_SECONDS = 10

/** Keeps rate-limit feedback accurate without presenting a frozen numeric countdown. */
export const ANATOMIME_RATE_LIMITED_POLL_STATUS =
  "Updates are paused. Automatic refresh will resume when the server allows it."

export type AnatomimeRoomCredentials = {
  playerId: string
  token: string
}

export type AnatomimeRoomFetchResult =
  | { kind: "SUCCESS"; session: AnatomimeRoomSummary }
  | { kind: "RATE_LIMITED"; retryAfterSeconds: number }
  | { kind: "ROOM_ENDED" }
  | { kind: "REJOIN_REQUIRED" }
  | { kind: "FAILED" }

export type AnatomimePollSchedule =
  | { action: "SCHEDULE"; delayMs: number; consecutiveFailures: number }
  | { action: "STOP"; reason: "ROOM_ENDED" | "REJOIN_REQUIRED" }

const FAILURE_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000] as const
const MAX_FAILURE_DELAY_MS = 30_000
/** Preserves meaningful durable-limiter backpressure without permitting an unbounded client pause. */
const MAX_SERVER_RETRY_AFTER_MS = 10 * 60_000
const FAILURE_JITTER_FRACTION = 0.1
const ROOM_STATUSES = new Set(["LOBBY", "PLAYING", "GAME_COMPLETE", "REVIEW", "ENDED", "EXPIRED"])
const ROOM_PHASES = new Set(["LOBBY", "ACTIVE_TERM", "TURN_REVIEW", "GAME_COMPLETE"])
const ANSWER_MODES = new Set(["host-judged", "typed", "multiple-choice"])
const CLUE_LEVELS = new Set(["easy", "medium", "hard", "expert"])
const TURN_OUTCOMES = new Set(["got", "missed", "stolen"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function isTeamSummary(value: unknown) {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && isFiniteNumber(value.sortOrder)
    && isFiniteNumber(value.score)
}

function isPlayerSummary(value: unknown) {
  return isRecord(value)
    && typeof value.id === "string"
    && isNullableString(value.teamId)
    && typeof value.displayName === "string"
    && typeof value.signedIn === "boolean"
    && typeof value.isHost === "boolean"
    && typeof value.lastSeenAt === "string"
}

function isRoomConfig(value: unknown) {
  return isRecord(value)
    && typeof value.answerMode === "string"
    && ANSWER_MODES.has(value.answerMode)
    && typeof value.clueLevel === "string"
    && CLUE_LEVELS.has(value.clueLevel)
    && isFiniteNumber(value.roundSeconds)
    && isFiniteNumber(value.termCount)
    && (value.roundLimit === undefined || isFiniteNumber(value.roundLimit))
    && (value.hardcoreMode === undefined || typeof value.hardcoreMode === "boolean")
}

function isPromptSummary(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string") return false
  if (![value.name, value.categoryLabel, value.difficulty, value.definition].every(isOptionalString)) return false
  if (![value.regionLabels, value.bodySystemLabels, value.aliases]
    .every((entry) => entry === undefined || isStringArray(entry))) return false
  return value.media === undefined || (Array.isArray(value.media) && value.media.every((entry) => (
    isRecord(entry) && typeof entry.url === "string" && typeof entry.title === "string"
  )))
}

function isActiveItem(value: unknown) {
  return isRecord(value)
    && isFiniteNumber(value.index)
    && isFiniteNumber(value.total)
    && isPromptSummary(value.prompt)
    && Array.isArray(value.choices)
    && value.choices.every((choice) => (
      isRecord(choice) && typeof choice.id === "string" && typeof choice.label === "string"
    ))
    && isNullableString(value.multipleChoiceUnlocksAt)
    && typeof value.pendingSteal === "boolean"
}

function isTurnReviewItem(value: unknown) {
  return isRecord(value)
    && isOptionalString(value.cardId)
    && isOptionalString(value.id)
    && isOptionalString(value.termKey)
    && typeof value.name === "string"
    && typeof value.outcome === "string"
    && TURN_OUTCOMES.has(value.outcome)
    && isNullableString(value.scoredTeamId)
}

function isRecapItem(value: unknown) {
  return isRecord(value)
    && typeof value.teamId === "string"
    && isFiniteNumber(value.got)
    && isFiniteNumber(value.missed)
    && isFiniteNumber(value.stolen)
}

function isHostElection(value: unknown) {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.closesAt === "string"
    && isStringArray(value.candidatePlayerIds)
    && isStringArray(value.activeVoterPlayerIds)
    && isStringArray(value.submittedVoterPlayerIds)
}

/** Rejects cross-room, partial, or corrupt success bodies before clients consume them. */
function isAnatomimeRoomSummary(value: unknown, expectedCode: string): value is AnatomimeRoomSummary {
  if (!isRecord(value)) return false
  return value.code === expectedCode
    && typeof value.status === "string"
    && ROOM_STATUSES.has(value.status)
    && typeof value.phase === "string"
    && ROOM_PHASES.has(value.phase)
    && isRoomConfig(value.config)
    && isNullableString(value.phaseEndsAt)
    && isNullableString(value.reviewExpiresAt)
    && Array.isArray(value.teams)
    && value.teams.every(isTeamSummary)
    && Array.isArray(value.players)
    && value.players.every(isPlayerSummary)
    && isRecord(value.viewer)
    && typeof value.viewer.isHost === "boolean"
    && isNullableString(value.viewer.playerId)
    && isNullableString(value.viewer.teamId)
    && (value.activeTeam === null || isTeamSummary(value.activeTeam))
    && (value.activeItem === null || isActiveItem(value.activeItem))
    && Array.isArray(value.turnReview)
    && value.turnReview.every(isTurnReviewItem)
    && Array.isArray(value.recap)
    && value.recap.every(isRecapItem)
    && (value.hostElection === undefined || value.hostElection === null || isHostElection(value.hostElection))
    && (value.hostCanBeChallenged === undefined || typeof value.hostCanBeChallenged === "boolean")
}

/** Parses only the integer delay-seconds form of Retry-After; HTTP-date values fall back to zero. */
export function anatomimeRetryAfterSeconds(response: Response) {
  const raw = response.headers.get("Retry-After")?.trim() ?? ""
  if (!/^\d+$/.test(raw)) return 0
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) ? parsed : 0
}

/** Preserves valid server guidance while giving every manual-action 429 a safe cooldown. */
export function anatomimeActionRetryAfterSeconds(response: Response) {
  const parsedSeconds = anatomimeRetryAfterSeconds(response)
  return parsedSeconds > 0 ? parsedSeconds : ANATOMIME_ACTION_RETRY_FALLBACK_SECONDS
}

/**
 * Fetches one room snapshot and reduces HTTP details to the states understood
 * by the polling scheduler. Player identity is carried only in proof headers.
 */
export async function fetchAnatomimeRoomSnapshot(input: {
  code: string
  credentials?: AnatomimeRoomCredentials
  fetcher?: typeof fetch
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<AnatomimeRoomFetchResult> {
  const fetcher = input.fetcher ?? fetch
  try {
    const { response, json: payload } = await fetchJsonWithTimeout<{ session?: unknown }>(
      `/api/anatomime/sessions/${encodeURIComponent(input.code)}`,
      {
        cache: "no-store",
        headers: input.credentials
          ? {
              "x-anatomime-player-id": input.credentials.playerId,
              "x-anatomime-player-token": input.credentials.token,
            }
          : undefined,
        signal: input.signal,
      },
      input.timeoutMs ?? ANATOMIME_ROOM_SNAPSHOT_TIMEOUT_MS,
      fetcher,
    )

    if (response.status === 429) {
      return { kind: "RATE_LIMITED", retryAfterSeconds: anatomimeRetryAfterSeconds(response) }
    }
    if (response.status === 404) return { kind: "ROOM_ENDED" }
    if (input.credentials && (response.status === 401 || response.status === 403)) {
      return { kind: "REJOIN_REQUIRED" }
    }
    if (!response.ok) return { kind: "FAILED" }

    return isAnatomimeRoomSummary(payload?.session, input.code)
      ? { kind: "SUCCESS", session: payload.session }
      : { kind: "FAILED" }
  } catch {
    return { kind: "FAILED" }
  }
}

/**
 * Chooses the next one-shot poll. Successful snapshots reset recovery state;
 * failures use cap-aware bounded jitter, while a bounded server Retry-After is
 * a floor.
 */
export function nextAnatomimePollSchedule(input: {
  result: AnatomimeRoomFetchResult
  roomStatus?: string
  roomPhase?: string
  documentHidden: boolean
  consecutiveFailures: number
  random?: () => number
}): AnatomimePollSchedule {
  if (input.result.kind === "ROOM_ENDED") return { action: "STOP", reason: "ROOM_ENDED" }
  if (input.result.kind === "REJOIN_REQUIRED") return { action: "STOP", reason: "REJOIN_REQUIRED" }

  if (input.result.kind === "SUCCESS") {
    const status = input.roomStatus ?? input.result.session.status
    if (status === "EXPIRED" || status === "ENDED") {
      return { action: "STOP", reason: "ROOM_ENDED" }
    }
    const phase = input.roomPhase ?? input.result.session.phase
    const delayMs = input.documentHidden
      ? 15_000
      : status === "PLAYING" && phase === "ACTIVE_TERM"
        ? 2_000
        : 5_000
    return { action: "SCHEDULE", delayMs, consecutiveFailures: 0 }
  }

  const consecutiveFailures = Math.max(0, Math.floor(input.consecutiveFailures)) + 1
  const baseDelayMs = FAILURE_DELAYS_MS[Math.min(consecutiveFailures - 1, FAILURE_DELAYS_MS.length - 1)]
  const rawRandom = (input.random ?? Math.random)()
  const boundedRandom = Math.min(1, Math.max(0, Number.isFinite(rawRandom) ? rawRandom : 0))
  const jitterRangeMs = Math.max(1, Math.floor(baseDelayMs * FAILURE_JITTER_FRACTION))
  const jitterStartMs = Math.min(baseDelayMs, MAX_FAILURE_DELAY_MS - jitterRangeMs)
  const jitterMs = Math.max(1, Math.floor(jitterRangeMs * boundedRandom))
  const boundedFailureDelayMs = Math.min(MAX_FAILURE_DELAY_MS, jitterStartMs + jitterMs)
  const retryFloorMs = input.result.kind === "RATE_LIMITED"
    ? Math.min(MAX_SERVER_RETRY_AFTER_MS, Math.max(0, input.result.retryAfterSeconds * 1_000))
    : 0

  return {
    action: "SCHEDULE",
    delayMs: Math.max(boundedFailureDelayMs, retryFloorMs),
    consecutiveFailures,
  }
}

/** Recomputes cadence on visibility changes without disturbing recovery timers. */
export function nextAnatomimeVisibilitySchedule(input: {
  result: AnatomimeRoomFetchResult | null
  documentHidden: boolean
}): AnatomimePollSchedule | null {
  if (input.result?.kind !== "SUCCESS") return null
  return nextAnatomimePollSchedule({
    result: input.result,
    roomStatus: input.result.session.status,
    roomPhase: input.result.session.phase,
    documentHidden: input.documentHidden,
    consecutiveFailures: 0,
  })
}
