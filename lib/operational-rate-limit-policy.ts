import { normalizeEmail } from "./auth-security.js"

export type OperationalRateLimitScope = "GLOBAL" | "NETWORK" | "ACCOUNT" | "RESOURCE"

export type OperationalAccountSubject =
  | { kind: "ACCOUNT_ID"; value: string }
  | { kind: "EMAIL"; value: string }

export type OperationalBookingSubject =
  | { kind: "ACCOUNT_ID"; value: string }
  | { kind: "GUEST_EMAIL"; value: string }

export type OperationalRateLimitRequest =
  | { operation: "ANATOMIME_ROOM_CREATE"; networkIdentifier: string; account?: OperationalAccountSubject }
  | { operation: "ANATOMIME_ROOM_JOIN"; networkIdentifier: string; roomIdentifier: string }
  | { operation: "ANATOMIME_REALTIME_TOKEN_START"; networkIdentifier: string; roomIdentifier: string }
  | { operation: "ANATOMIME_REALTIME_TOKEN_ISSUE"; playerId: string; roomId: string }
  | { operation: "ANATOMIME_UNJOINED_LOOKUP"; networkIdentifier: string; roomIdentifier: string }
  | { operation: "BOOKING_AVAILABILITY"; networkIdentifier: string; practiceId: string; account?: OperationalAccountSubject }
  | { operation: "BOOKING_CREATE"; networkIdentifier: string; practiceId: string; owner: OperationalBookingSubject }
  | { operation: "WAITLIST_JOIN"; networkIdentifier: string; practiceId: string; owner: OperationalBookingSubject }
  | { operation: "DONATION_CHECKOUT"; networkIdentifier: string; account?: OperationalAccountSubject }
  | { operation: "PROBLEM_REPORT"; networkIdentifier: string }
  | { operation: "EMAIL_PUBLIC_AUTH" }
  | { operation: "EMAIL_SECURITY" }

export type OperationalRateLimitRule = {
  policy: string
  scope: OperationalRateLimitScope
  limit: number
  windowMs: number
  normalizedSubjectComponents: readonly { label: string; value: string }[]
}

type UnknownRecord = Record<string, unknown>
type SubjectComponent = { label: string; value: string }

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const MAX_IDENTIFIER_LENGTH = 256
const MAX_EMAIL_LENGTH = 254
const GLOBAL_COMPONENTS = [{ label: "deployment", value: "massagelab" }] as const

/**
 * Expands an allowlisted operation into private fixed-window rules. Runtime
 * validation is deliberately fail-closed because route input can bypass the
 * compile-time discriminated union.
 */
export function resolveOperationalRateLimitRules(
  request: OperationalRateLimitRequest,
): readonly OperationalRateLimitRule[] | null {
  if (!isRecord(request) || typeof request.operation !== "string") return null

  switch (request.operation) {
    case "ANATOMIME_ROOM_CREATE":
      return roomCreateRules(request)
    case "ANATOMIME_ROOM_JOIN":
      return roomJoinRules(request)
    case "ANATOMIME_REALTIME_TOKEN_START":
      return realtimeTokenStartRules(request)
    case "ANATOMIME_REALTIME_TOKEN_ISSUE":
      return realtimeTokenIssueRules(request)
    case "ANATOMIME_UNJOINED_LOOKUP":
      return unjoinedLookupRules(request)
    case "BOOKING_AVAILABILITY":
      return bookingAvailabilityRules(request)
    case "BOOKING_CREATE":
      return bookingMutationRules(request, "booking.create")
    case "WAITLIST_JOIN":
      return bookingMutationRules(request, "booking.waitlist")
    case "DONATION_CHECKOUT":
      return donationRules(request)
    case "PROBLEM_REPORT":
      return problemReportRules(request)
    case "EMAIL_PUBLIC_AUTH":
      return [
        rule("email.public-auth.global.24h.v1", "GLOBAL", 70, 24 * HOUR_MS, GLOBAL_COMPONENTS),
        rule("email.total.global.24h.v1", "GLOBAL", 90, 24 * HOUR_MS, GLOBAL_COMPONENTS),
      ]
    case "EMAIL_SECURITY":
      return [rule("email.total.global.24h.v1", "GLOBAL", 90, 24 * HOUR_MS, GLOBAL_COMPONENTS)]
    default:
      return null
  }
}

function roomCreateRules(request: UnknownRecord) {
  const network = identifierComponent("network", request.networkIdentifier)
  if (!network) return null
  const networkComponents = [network]

  if (request.account !== undefined) {
    const account = accountComponents(request.account)
    if (!account) return null
    return [
      rule("anatomime.room-create.account.15m.v1", "ACCOUNT", 6, 15 * MINUTE_MS, account),
      rule("anatomime.room-create.account.24h.v1", "ACCOUNT", 20, 24 * HOUR_MS, account),
      rule("anatomime.room-create.network.15m.v1", "NETWORK", 15, 15 * MINUTE_MS, networkComponents),
      rule("anatomime.room-create.network.24h.v1", "NETWORK", 40, 24 * HOUR_MS, networkComponents),
    ]
  }

  return [
    rule("anatomime.room-create.network-anonymous.15m.v1", "NETWORK", 5, 15 * MINUTE_MS, networkComponents),
    rule("anatomime.room-create.network-anonymous.24h.v1", "NETWORK", 15, 24 * HOUR_MS, networkComponents),
    rule("anatomime.room-create.network.15m.v1", "NETWORK", 15, 15 * MINUTE_MS, networkComponents),
    rule("anatomime.room-create.network.24h.v1", "NETWORK", 40, 24 * HOUR_MS, networkComponents),
  ]
}

function roomJoinRules(request: UnknownRecord) {
  const network = identifierComponent("network", request.networkIdentifier)
  const room = identifierComponent("room", request.roomIdentifier)
  if (!network || !room) return null

  return [
    rule("anatomime.room-join.network.15m.v1", "NETWORK", 30, 15 * MINUTE_MS, [network]),
    rule("anatomime.room-join.network.24h.v1", "NETWORK", 100, 24 * HOUR_MS, [network]),
    rule("anatomime.room-join.network-room.10m.v1", "RESOURCE", 20, 10 * MINUTE_MS, [network, room]),
  ]
}

function realtimeTokenStartRules(request: UnknownRecord) {
  const network = identifierComponent("network", request.networkIdentifier)
  const room = identifierComponent("room", request.roomIdentifier)
  if (!network || !room) return null
  return [
    rule("anatomime.realtime-token.network-room.10m.v1", "RESOURCE", 60, 10 * MINUTE_MS, [network, room]),
  ]
}

function realtimeTokenIssueRules(request: UnknownRecord) {
  const player = identifierComponent("player", request.playerId)
  const room = identifierComponent("room", request.roomId)
  if (!player || !room) return null
  return [
    rule("anatomime.realtime-token.player.10m.v1", "RESOURCE", 6, 10 * MINUTE_MS, [player]),
    rule("anatomime.realtime-token.room.10m.v1", "RESOURCE", 40, 10 * MINUTE_MS, [room]),
  ]
}

function unjoinedLookupRules(request: UnknownRecord) {
  const network = identifierComponent("network", request.networkIdentifier)
  const room = identifierComponent("room", request.roomIdentifier)
  if (!network || !room) return null
  return [
    rule("anatomime.unjoined-lookup.network-room.10m.v1", "RESOURCE", 60, 10 * MINUTE_MS, [network, room]),
  ]
}

function bookingAvailabilityRules(request: UnknownRecord) {
  const network = identifierComponent("network", request.networkIdentifier)
  const practice = identifierComponent("practice", request.practiceId)
  if (!network || !practice) return null

  if (request.account !== undefined) {
    const account = accountComponents(request.account)
    if (!account) return null
    return [
      rule("booking.availability.account-practice.5m.v1", "RESOURCE", 40, 5 * MINUTE_MS, [...account, practice]),
      rule("booking.availability.network-practice-authenticated.5m.v1", "RESOURCE", 120, 5 * MINUTE_MS, [network, practice]),
    ]
  }

  return [
    rule("booking.availability.network-practice-anonymous.5m.v1", "RESOURCE", 60, 5 * MINUTE_MS, [network, practice]),
  ]
}

function bookingMutationRules(request: UnknownRecord, policyPrefix: "booking.create" | "booking.waitlist") {
  const network = identifierComponent("network", request.networkIdentifier)
  const practice = identifierComponent("practice", request.practiceId)
  const owner = bookingOwnerComponents(request.owner)
  if (!network || !practice || !owner) return null

  const ownerLimit = policyPrefix === "booking.create" ? 3 : 2
  const ownerDailyLimit = policyPrefix === "booking.create" ? 8 : 4
  return [
    rule(`${policyPrefix}.owner-practice.30m.v1`, "RESOURCE", ownerLimit, 30 * MINUTE_MS, [...owner, practice]),
    rule(`${policyPrefix}.owner-practice.24h.v1`, "RESOURCE", ownerDailyLimit, 24 * HOUR_MS, [...owner, practice]),
    rule(`${policyPrefix}.network-practice.30m.v1`, "RESOURCE", 12, 30 * MINUTE_MS, [network, practice]),
    rule(`${policyPrefix}.network-practice.24h.v1`, "RESOURCE", 30, 24 * HOUR_MS, [network, practice]),
  ]
}

function donationRules(request: UnknownRecord) {
  const network = identifierComponent("network", request.networkIdentifier)
  if (!network) return null
  const networkComponents = [network]

  if (request.account !== undefined) {
    const account = accountComponents(request.account)
    if (!account) return null
    return [
      rule("donation.account.15m.v1", "ACCOUNT", 6, 15 * MINUTE_MS, account),
      rule("donation.account.24h.v1", "ACCOUNT", 20, 24 * HOUR_MS, account),
      rule("donation.network.15m.v1", "NETWORK", 15, 15 * MINUTE_MS, networkComponents),
      rule("donation.network.24h.v1", "NETWORK", 40, 24 * HOUR_MS, networkComponents),
      rule("donation.global.24h.v1", "GLOBAL", 100, 24 * HOUR_MS, GLOBAL_COMPONENTS),
    ]
  }

  return [
    rule("donation.network-anonymous.15m.v1", "NETWORK", 5, 15 * MINUTE_MS, networkComponents),
    rule("donation.network-anonymous.24h.v1", "NETWORK", 15, 24 * HOUR_MS, networkComponents),
    rule("donation.network.15m.v1", "NETWORK", 15, 15 * MINUTE_MS, networkComponents),
    rule("donation.network.24h.v1", "NETWORK", 40, 24 * HOUR_MS, networkComponents),
    rule("donation.global.24h.v1", "GLOBAL", 100, 24 * HOUR_MS, GLOBAL_COMPONENTS),
  ]
}

function problemReportRules(request: UnknownRecord) {
  const network = identifierComponent("network", request.networkIdentifier)
  if (!network) return null
  return [
    rule("problem-report.network.10m.v1", "NETWORK", 5, 10 * MINUTE_MS, [network]),
    rule("problem-report.global.10m.v1", "GLOBAL", 50, 10 * MINUTE_MS, GLOBAL_COMPONENTS),
    rule("problem-report.global.24h.v1", "GLOBAL", 250, 24 * HOUR_MS, GLOBAL_COMPONENTS),
  ]
}

function rule(
  policy: string,
  scope: OperationalRateLimitScope,
  limit: number,
  windowMs: number,
  normalizedSubjectComponents: readonly SubjectComponent[],
): OperationalRateLimitRule {
  return { policy, scope, limit, windowMs, normalizedSubjectComponents }
}

function accountComponents(value: unknown): readonly SubjectComponent[] | null {
  if (!isRecord(value)) return null
  if (value.kind === "ACCOUNT_ID") {
    const component = identifierComponent("account-id", value.value)
    return component ? [component] : null
  }
  if (value.kind === "EMAIL") {
    const component = emailComponent("email", value.value)
    return component ? [component] : null
  }
  return null
}

function bookingOwnerComponents(value: unknown): readonly SubjectComponent[] | null {
  if (!isRecord(value)) return null
  if (value.kind === "ACCOUNT_ID") {
    const component = identifierComponent("account-id", value.value)
    return component ? [component] : null
  }
  if (value.kind === "GUEST_EMAIL") {
    const component = emailComponent("guest-email", value.value)
    return component ? [component] : null
  }
  return null
}

function identifierComponent(label: string, value: unknown): SubjectComponent | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) return null
  return { label, value: normalized }
}

function emailComponent(label: string, value: unknown): SubjectComponent | null {
  const normalized = normalizeEmail(value)
  if (
    !normalized
    || normalized.length > MAX_EMAIL_LENGTH
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null
  }
  return { label, value: normalized }
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
