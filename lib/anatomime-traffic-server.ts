import { createHmac } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { hashToken } from "./auth-security.js"
import { type ViewerContext } from "./anatomime-session-server.ts"
import {
  consumeOperationalRateLimit,
  type OperationalRateLimitRequest,
} from "./operational-rate-limit.ts"
import { prisma } from "./prisma.ts"

export type AnatomimeViewerPreflight =
  | { kind: "ROOM_NOT_FOUND" }
  | { kind: "JOINED"; roomId: string; roomIdentifier: string; playerId: string }
  | { kind: "UNJOINED"; roomId: string; roomIdentifier: string }
  | { kind: "INVALID"; roomId: string; roomIdentifier: string }

type AnatomimeViewerPreflightRoom = {
  id: string
  code: string
  players: Array<{
    id: string
    roomId: string
    userId: string | null
    guestTokenHash: string | null
  }>
}

type ResolvedAnatomimeViewerPreflight = Exclude<AnatomimeViewerPreflight, { kind: "ROOM_NOT_FOUND" }>

export type AnatomimeTrafficPrismaClient = Pick<PrismaClient, "anatomimeRoom" | "anatomimeRoomPlayer">

export type AnatomimePollShedDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

type PollBucket = { count: number; windowStartMs: number }
type PollRule = { key: string; limit: number }

const POLL_WINDOW_MS = 10_000
const NETWORK_INGRESS_LIMIT = 300
const NETWORK_ROOM_LIMIT = 150
const ROOM_LIMIT = 300
const PLAYER_LIMIT = 20
const DEFAULT_MAX_ENTRIES = 4_096
const PRESENCE_WINDOW_MS = 15_000
const POLL_HMAC_DOMAIN = "massagelab:anatomime-poll-shedder:v1"

export function normalizeAnatomimeRoomIdentifier(value: string): string {
  return typeof value === "string"
    ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
    : ""
}

/**
 * Resolves only the room owner and at most the authenticated/guest player
 * candidates. Full room relations stay outside this credential preflight.
 */
export async function preflightAnatomimeViewer(
  code: string,
  viewer: ViewerContext,
  options: { prismaClient?: AnatomimeTrafficPrismaClient } = {},
): Promise<AnatomimeViewerPreflight> {
  const prismaClient = options.prismaClient ?? prisma
  const roomIdentifier = normalizeAnatomimeRoomIdentifier(code)
  const userId = nonEmptyIdentifier(viewer?.userId)
  const playerId = nonEmptyIdentifier(viewer?.playerId)
  const candidateFilters = [
    ...(userId ? [{ userId }] : []),
    ...(playerId ? [{ id: playerId }] : []),
  ]

  const room = await prismaClient.anatomimeRoom.findUnique({
    where: { code: roomIdentifier },
    select: {
      id: true,
      code: true,
      players: {
        where: candidateFilters.length > 0 ? { OR: candidateFilters } : { id: { in: [] } },
        take: 2,
        select: { id: true, roomId: true, userId: true, guestTokenHash: true },
      },
    },
  })
  if (!room) return { kind: "ROOM_NOT_FOUND" }

  return preflightLoadedAnatomimeViewer(room, viewer)
}

/** Classifies a viewer against one already-loaded room snapshot without another database read. */
export function preflightLoadedAnatomimeViewer(
  room: AnatomimeViewerPreflightRoom,
  viewer: ViewerContext,
): ResolvedAnatomimeViewerPreflight {
  const normalizedRoomIdentifier = normalizeAnatomimeRoomIdentifier(room.code)
  const userId = nonEmptyIdentifier(viewer?.userId)
  const playerId = nonEmptyIdentifier(viewer?.playerId)
  const authenticatedPlayer = userId
    ? room.players.find((player) => player.roomId === room.id && player.userId === userId)
    : null
  if (authenticatedPlayer) {
    return {
      kind: "JOINED",
      roomId: room.id,
      roomIdentifier: normalizedRoomIdentifier,
      playerId: authenticatedPlayer.id,
    }
  }

  const playerToken = nonEmptyIdentifier(viewer?.playerToken)
  if (playerId || playerToken) {
    const guestPlayer = playerId
      ? room.players.find((player) => player.roomId === room.id && player.id === playerId)
      : null
    if (
      guestPlayer
      && guestPlayer.userId === null
      && playerToken
      && guestPlayer.guestTokenHash === hashToken(playerToken)
    ) {
      return {
        kind: "JOINED",
        roomId: room.id,
        roomIdentifier: normalizedRoomIdentifier,
        playerId: guestPlayer.id,
      }
    }
    return { kind: "INVALID", roomId: room.id, roomIdentifier: normalizedRoomIdentifier }
  }

  return { kind: "UNJOINED", roomId: room.id, roomIdentifier: normalizedRoomIdentifier }
}

export class AnatomimeTrafficLimitError extends Error {
  status: 429 | 503
  retryAfterSeconds?: number

  constructor(status: 429 | 503, retryAfterSeconds?: number) {
    super(status === 429
      ? "Anatomime is busy. Please try again shortly."
      : "Anatomime is temporarily unavailable. Please try again.")
    this.name = "AnatomimeTrafficLimitError"
    this.status = status
    if (status === 429) this.retryAfterSeconds = integerRetryAfter(retryAfterSeconds)
  }
}

/** Converts PR A's closed decision union into the route-owned generic error. */
export async function requireAnatomimeOperationalAllowance(
  input: OperationalRateLimitRequest,
  consume: typeof consumeOperationalRateLimit = consumeOperationalRateLimit,
): Promise<void> {
  let decision: Awaited<ReturnType<typeof consumeOperationalRateLimit>>
  try {
    decision = await consume(input)
  } catch {
    // The shared limiter already owns bounded, fixed-label diagnostics. Do not log
    // the error or request here: identifiers could leak and hostile traffic could
    // amplify metered telemetry without adding actionable evidence.
    throw new AnatomimeTrafficLimitError(503)
  }

  if (decision.allowed) return
  if (decision.reason === "RATE_LIMITED") {
    throw new AnatomimeTrafficLimitError(429, decision.retryAfterSeconds)
  }
  throw new AnatomimeTrafficLimitError(503)
}

/**
 * Creates one bounded fixed-window shedder. Applicable rules are checked before
 * any count changes, and only HMAC-reduced tuple keys enter the retained map.
 */
export function createAnatomimePollShedder(options: {
  secret: string
  maxEntries?: number
}) {
  const secret = typeof options?.secret === "string" ? options.secret : ""
  if (!secret.trim()) throw new Error("An Anatomime poll-shedder secret is required.")
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > DEFAULT_MAX_ENTRIES) {
    throw new Error("Anatomime poll-shedder capacity must be between 1 and 4096.")
  }
  const buckets = new Map<string, PollBucket>()

  function consumeRules(rules: readonly PollRule[], nowValue?: Date): AnatomimePollShedDecision {
    const now = validDate(nowValue ?? new Date())
    if (!now) return { allowed: false, retryAfterSeconds: 10 }
    pruneExpiredBuckets(buckets, now.getTime())

    const blocked = activeBlockDecision(rules, buckets, now.getTime())
    if (blocked) return blocked

    const newEntryCount = rules.reduce((count, rule) => count + (buckets.has(rule.key) ? 0 : 1), 0)
    if (buckets.size + newEntryCount > maxEntries) {
      const requiredFree = buckets.size + newEntryCount - maxEntries
      return { allowed: false, retryAfterSeconds: capacityRetryAfter(buckets, now.getTime(), requiredFree) }
    }

    for (const rule of rules) {
      const current = buckets.get(rule.key)
      buckets.set(rule.key, current
        ? { ...current, count: current.count + 1 }
        : { count: 1, windowStartMs: now.getTime() })
    }
    return { allowed: true }
  }

  return {
    /**
     * Charges only the network ingress bucket while peeking any retained
     * tuple/room buckets, so rotating nonexistent selectors cannot allocate
     * attacker-controlled keys or evade one warm-runtime ceiling.
     */
    consumeIngress(input: { networkIdentifier: string; roomIdentifier: string; now?: Date }) {
      const networkIdentifier = localIdentifier(input?.networkIdentifier)
      const roomIdentifier = normalizeAnatomimeRoomIdentifier(input?.roomIdentifier)
      if (!networkIdentifier || !roomIdentifier) return { allowed: false as const, retryAfterSeconds: 10 }

      const now = validDate(input.now ?? new Date())
      if (!now) return { allowed: false as const, retryAfterSeconds: 10 }
      const nowMs = now.getTime()
      pruneExpiredBuckets(buckets, nowMs)
      const ingressRule = {
        key: pollBucketKey(secret, "network-ingress", [networkIdentifier]),
        limit: NETWORK_INGRESS_LIMIT,
      }
      const candidateRules = [
        ingressRule,
        { key: pollBucketKey(secret, "network-room", [networkIdentifier, roomIdentifier]), limit: NETWORK_ROOM_LIMIT },
        { key: pollBucketKey(secret, "room", [roomIdentifier]), limit: ROOM_LIMIT },
      ]
      const blocked = activeBlockDecision(candidateRules, buckets, nowMs)
      if (blocked) return blocked
      if (!buckets.has(ingressRule.key) && buckets.size >= maxEntries) {
        return { allowed: false as const, retryAfterSeconds: capacityRetryAfter(buckets, nowMs, 1) }
      }

      const current = buckets.get(ingressRule.key)
      buckets.set(ingressRule.key, current
        ? { ...current, count: current.count + 1 }
        : { count: 1, windowStartMs: nowMs })
      return { allowed: true as const }
    },
    consumeJoined(input: {
      networkIdentifier: string
      roomIdentifier: string
      playerId: string
      now?: Date
    }) {
      const networkIdentifier = localIdentifier(input?.networkIdentifier)
      const roomIdentifier = normalizeAnatomimeRoomIdentifier(input?.roomIdentifier)
      const playerId = localIdentifier(input?.playerId)
      if (!networkIdentifier || !roomIdentifier || !playerId) {
        return { allowed: false as const, retryAfterSeconds: 10 }
      }
      return consumeRules([
        { key: pollBucketKey(secret, "network-room", [networkIdentifier, roomIdentifier]), limit: NETWORK_ROOM_LIMIT },
        { key: pollBucketKey(secret, "room", [roomIdentifier]), limit: ROOM_LIMIT },
        { key: pollBucketKey(secret, "player", [playerId]), limit: PLAYER_LIMIT },
      ], input.now)
    },
    get size() {
      return buckets.size
    },
  }
}

/** Writes presence only when both the snapshot and database row are stale. */
export async function coalesceAnatomimePlayerPresence(input: {
  prismaClient?: Pick<PrismaClient, "anatomimeRoomPlayer">
  roomId: string
  playerId: string
  lastSeenAt: Date
  now?: Date
}): Promise<Date | null> {
  const roomId = nonEmptyIdentifier(input.roomId)
  const playerId = nonEmptyIdentifier(input.playerId)
  const lastSeenAt = validDate(input.lastSeenAt)
  const now = validDate(input.now ?? new Date())
  if (!roomId || !playerId || !lastSeenAt || !now) {
    throw new Error("Valid Anatomime presence identifiers and timestamps are required.")
  }
  if (now.getTime() - lastSeenAt.getTime() < PRESENCE_WINDOW_MS) return null

  const cutoff = new Date(now.getTime() - PRESENCE_WINDOW_MS)
  const result = await (input.prismaClient ?? prisma).anatomimeRoomPlayer.updateMany({
    where: { id: playerId, roomId, lastSeenAt: { lte: cutoff } },
    data: { lastSeenAt: now },
  })
  return result.count === 1 ? now : null
}

function pollBucketKey(secret: string, rule: string, components: readonly string[]): string {
  const hmac = createHmac("sha256", secret)
  appendLengthPrefixed(hmac, POLL_HMAC_DOMAIN)
  appendLengthPrefixed(hmac, rule)
  for (const component of components) appendLengthPrefixed(hmac, component)
  return hmac.digest("hex")
}

function appendLengthPrefixed(hmac: ReturnType<typeof createHmac>, value: string) {
  const bytes = Buffer.from(value, "utf8")
  const length = Buffer.allocUnsafe(4)
  length.writeUInt32BE(bytes.length)
  hmac.update(length).update(bytes)
}

function pruneExpiredBuckets(buckets: Map<string, PollBucket>, nowMs: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.windowStartMs + POLL_WINDOW_MS <= nowMs) buckets.delete(key)
  }
}

/** Returns the longest active-rule delay without changing any bucket count. */
function activeBlockDecision(
  rules: readonly PollRule[],
  buckets: ReadonlyMap<string, PollBucket>,
  nowMs: number,
): AnatomimePollShedDecision | null {
  const activeBlocks = rules
    .map((rule) => ({ rule, bucket: buckets.get(rule.key) }))
    .filter((entry): entry is { rule: PollRule; bucket: PollBucket } => (
      entry.bucket !== undefined && entry.bucket.count >= entry.rule.limit
    ))
  return activeBlocks.length > 0
    ? {
        allowed: false,
        retryAfterSeconds: Math.max(...activeBlocks.map(({ bucket }) => (
          retryAfterWindow(bucket.windowStartMs, nowMs)
        ))),
      }
    : null
}

function retryAfterWindow(windowStartMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((windowStartMs + POLL_WINDOW_MS - nowMs) / 1_000))
}

/** Returns the delay until enough active buckets expire for the rejected request. */
function capacityRetryAfter(buckets: Map<string, PollBucket>, nowMs: number, requiredFree: number): number {
  const expiries = [...buckets.values()]
    .map((bucket) => bucket.windowStartMs + POLL_WINDOW_MS)
    .sort((left, right) => left - right)
  const usableExpiry = expiries[requiredFree - 1]
  return Number.isFinite(usableExpiry)
    ? Math.max(1, Math.ceil((usableExpiry - nowMs) / 1_000))
    : 10
}

function integerRetryAfter(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.ceil(value))
    : 1
}

function validDate(value: unknown): Date | null {
  return value instanceof Date && Number.isFinite(value.getTime())
    ? new Date(value.getTime())
    : null
}

function nonEmptyIdentifier(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function localIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized && normalized.length <= 256 ? normalized : null
}
