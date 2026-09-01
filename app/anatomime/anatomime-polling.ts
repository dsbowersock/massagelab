import type { AnatomimeRoomSummary } from "./shared-session-types"

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
const FAILURE_JITTER_FRACTION = 0.1
const ROOM_STATUSES = new Set(["LOBBY", "PLAYING", "GAME_COMPLETE", "REVIEW", "ENDED", "EXPIRED"])
const ROOM_PHASES = new Set(["LOBBY", "ACTIVE_TERM", "TURN_REVIEW", "GAME_COMPLETE"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Rejects partial or corrupt success bodies before client render code can consume them. */
function isAnatomimeRoomSummary(value: unknown): value is AnatomimeRoomSummary {
  if (!isRecord(value)) return false
  return typeof value.code === "string"
    && ROOM_STATUSES.has(String(value.status))
    && ROOM_PHASES.has(String(value.phase))
    && isRecord(value.config)
    && Array.isArray(value.teams)
    && Array.isArray(value.players)
    && isRecord(value.viewer)
    && Array.isArray(value.turnReview)
    && Array.isArray(value.recap)
}

export function anatomimeRetryAfterSeconds(response: Response) {
  const raw = response.headers.get("Retry-After")?.trim() ?? ""
  if (!/^\d+$/.test(raw)) return 0
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) ? parsed : 0
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
}): Promise<AnatomimeRoomFetchResult> {
  const fetcher = input.fetcher ?? fetch
  try {
    const response = await fetcher(`/api/anatomime/sessions/${encodeURIComponent(input.code)}`, {
      cache: "no-store",
      headers: input.credentials
        ? {
            "x-anatomime-player-id": input.credentials.playerId,
            "x-anatomime-player-token": input.credentials.token,
          }
        : undefined,
      signal: input.signal,
    })

    if (response.status === 429) {
      return { kind: "RATE_LIMITED", retryAfterSeconds: anatomimeRetryAfterSeconds(response) }
    }
    if (response.status === 404) return { kind: "ROOM_ENDED" }
    if (input.credentials && (response.status === 401 || response.status === 403)) {
      return { kind: "REJOIN_REQUIRED" }
    }
    if (!response.ok) return { kind: "FAILED" }

    const payload = await response.json().catch(() => null) as { session?: unknown } | null
    return isAnatomimeRoomSummary(payload?.session)
      ? { kind: "SUCCESS", session: payload.session }
      : { kind: "FAILED" }
  } catch {
    return { kind: "FAILED" }
  }
}

/**
 * Chooses the next one-shot poll. Successful snapshots reset recovery state;
 * failures use bounded positive jitter, while server Retry-After is a floor.
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
  const jitterMs = Math.max(1, Math.floor(baseDelayMs * FAILURE_JITTER_FRACTION * boundedRandom))
  const boundedFailureDelayMs = Math.min(MAX_FAILURE_DELAY_MS, baseDelayMs + jitterMs)
  const retryFloorMs = input.result.kind === "RATE_LIMITED"
    ? input.result.retryAfterSeconds * 1_000
    : 0

  return {
    action: "SCHEDULE",
    delayMs: Math.max(boundedFailureDelayMs, retryFloorMs),
    consecutiveFailures,
  }
}
