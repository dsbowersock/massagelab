import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveOperationalRateLimitRules } from "../lib/operational-rate-limit-policy.ts"

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const EXPECTED_POLICIES = new Map([
  ["anatomime.room-create.account.15m.v1", ["ACCOUNT", 6, 15 * MINUTE]],
  ["anatomime.room-create.account.24h.v1", ["ACCOUNT", 20, 24 * HOUR]],
  ["anatomime.room-create.network.15m.v1", ["NETWORK", 15, 15 * MINUTE]],
  ["anatomime.room-create.network.24h.v1", ["NETWORK", 40, 24 * HOUR]],
  ["anatomime.room-create.network-anonymous.15m.v1", ["NETWORK", 5, 15 * MINUTE]],
  ["anatomime.room-create.network-anonymous.24h.v1", ["NETWORK", 15, 24 * HOUR]],
  ["anatomime.room-join.network.15m.v1", ["NETWORK", 30, 15 * MINUTE]],
  ["anatomime.room-join.network.24h.v1", ["NETWORK", 100, 24 * HOUR]],
  ["anatomime.room-join.network-room.10m.v1", ["RESOURCE", 20, 10 * MINUTE]],
  ["anatomime.realtime-token.network.10m.v1", ["NETWORK", 120, 10 * MINUTE]],
  ["anatomime.realtime-token.network-room.10m.v1", ["RESOURCE", 60, 10 * MINUTE]],
  ["anatomime.realtime-token.player.10m.v1", ["RESOURCE", 6, 10 * MINUTE]],
  ["anatomime.realtime-token.room.10m.v1", ["RESOURCE", 40, 10 * MINUTE]],
  ["anatomime.unjoined-lookup.network-room.10m.v1", ["RESOURCE", 60, 10 * MINUTE]],
  ["booking.availability.account-practice.5m.v1", ["RESOURCE", 40, 5 * MINUTE]],
  ["booking.availability.network-practice-anonymous.5m.v1", ["RESOURCE", 60, 5 * MINUTE]],
  ["booking.availability.network-practice-authenticated.5m.v1", ["RESOURCE", 120, 5 * MINUTE]],
  ["booking.create.owner-practice.30m.v1", ["RESOURCE", 3, 30 * MINUTE]],
  ["booking.create.owner-practice.24h.v1", ["RESOURCE", 8, 24 * HOUR]],
  ["booking.create.network-practice.30m.v1", ["RESOURCE", 12, 30 * MINUTE]],
  ["booking.create.network-practice.24h.v1", ["RESOURCE", 30, 24 * HOUR]],
  ["booking.waitlist.owner-practice.30m.v1", ["RESOURCE", 2, 30 * MINUTE]],
  ["booking.waitlist.owner-practice.24h.v1", ["RESOURCE", 4, 24 * HOUR]],
  ["booking.waitlist.network-practice.30m.v1", ["RESOURCE", 12, 30 * MINUTE]],
  ["booking.waitlist.network-practice.24h.v1", ["RESOURCE", 30, 24 * HOUR]],
  ["donation.account.15m.v1", ["ACCOUNT", 6, 15 * MINUTE]],
  ["donation.account.24h.v1", ["ACCOUNT", 20, 24 * HOUR]],
  ["donation.network-anonymous.15m.v1", ["NETWORK", 5, 15 * MINUTE]],
  ["donation.network-anonymous.24h.v1", ["NETWORK", 15, 24 * HOUR]],
  ["donation.network.15m.v1", ["NETWORK", 15, 15 * MINUTE]],
  ["donation.network.24h.v1", ["NETWORK", 40, 24 * HOUR]],
  ["donation.global.24h.v1", ["GLOBAL", 100, 24 * HOUR]],
  ["problem-report.network.10m.v1", ["NETWORK", 5, 10 * MINUTE]],
  ["problem-report.global.10m.v1", ["GLOBAL", 50, 10 * MINUTE]],
  ["problem-report.global.24h.v1", ["GLOBAL", 250, 24 * HOUR]],
  ["email.public-auth.global.24h.v1", ["GLOBAL", 70, 24 * HOUR]],
  ["email.total.global.24h.v1", ["GLOBAL", 90, 24 * HOUR]],
])

/** Projects one resolved request into the ordered policy identifiers asserted by combination tests. */
function policies(request) {
  return resolveOperationalRateLimitRules(request)?.map((rule) => rule.policy) ?? []
}

/** Builds one expected rule from the closed metadata oracle and its normalized subject components. */
function expectedRule(policy, normalizedSubjectComponents) {
  const metadata = EXPECTED_POLICIES.get(policy)
  assert.ok(metadata, `missing expected metadata for ${policy}`)
  const [scope, limit, windowMs] = metadata
  return { policy, scope, limit, windowMs, normalizedSubjectComponents }
}

/** Converts table-shaped policy/component pairs into complete expected resolver output. */
function expectedRules(entries) {
  return entries.map(([policy, components]) => expectedRule(policy, components))
}

describe("operational rate-limit policy registry", () => {
  it("owns all 37 exact versioned policies, thresholds, windows, and scopes", () => {
    const requests = [
      { operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: "net", account: { kind: "ACCOUNT_ID", value: "acct" } },
      { operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: "net" },
      { operation: "ANATOMIME_ROOM_JOIN_INGRESS", networkIdentifier: "net" },
      { operation: "ANATOMIME_ROOM_JOIN", networkIdentifier: "net", roomIdentifier: "room" },
      { operation: "ANATOMIME_REALTIME_TOKEN_INGRESS", networkIdentifier: "net" },
      { operation: "ANATOMIME_REALTIME_TOKEN_START", networkIdentifier: "net", roomIdentifier: "room" },
      { operation: "ANATOMIME_REALTIME_TOKEN_ISSUE", playerId: "player", roomId: "room-id" },
      { operation: "ANATOMIME_UNJOINED_LOOKUP", networkIdentifier: "net", roomIdentifier: "room" },
      { operation: "BOOKING_AVAILABILITY", networkIdentifier: "net", practiceId: "practice", account: { kind: "ACCOUNT_ID", value: "acct" } },
      { operation: "BOOKING_AVAILABILITY", networkIdentifier: "net", practiceId: "practice" },
      { operation: "BOOKING_CREATE", networkIdentifier: "net", practiceId: "practice", owner: { kind: "GUEST_EMAIL", value: "guest@example.com" } },
      { operation: "WAITLIST_JOIN", networkIdentifier: "net", practiceId: "practice", owner: { kind: "ACCOUNT_ID", value: "acct" } },
      { operation: "DONATION_CHECKOUT", networkIdentifier: "net", account: { kind: "EMAIL", value: "member@example.com" } },
      { operation: "DONATION_CHECKOUT", networkIdentifier: "net" },
      { operation: "PROBLEM_REPORT", networkIdentifier: "net" },
      { operation: "EMAIL_PUBLIC_AUTH" },
      { operation: "EMAIL_SECURITY" },
    ]

    const rules = requests.flatMap((request) => resolveOperationalRateLimitRules(request) ?? [])
    const byPolicy = new Map(rules.map((rule) => [rule.policy, rule]))

    assert.equal(EXPECTED_POLICIES.size, 37)
    assert.deepEqual([...byPolicy.keys()].sort(), [...EXPECTED_POLICIES.keys()].sort())
    for (const [policy, [scope, limit, windowMs]] of EXPECTED_POLICIES) {
      const rule = byPolicy.get(policy)
      assert.ok(rule, `missing ${policy}`)
      assert.deepEqual([rule.scope, rule.limit, rule.windowMs], [scope, limit, windowMs])
      assert.match(rule.policy, /\.v1$/)
    }
  })

  it("returns the exact complete rules and labeled subjects for every request family", () => {
    const network = [{ label: "network", value: "household" }]
    const room = { label: "room", value: "room-code" }
    const practice = { label: "practice", value: "practice-1" }
    const deployment = [{ label: "deployment", value: "massagelab" }]
    const accountId = [{ label: "account-id", value: "member-1" }]
    const accountEmail = [{ label: "email", value: "member@example.com" }]
    const guestEmail = [{ label: "guest-email", value: "guest@example.com" }]

    const cases = [
      {
        name: "authenticated room creation",
        request: { operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: " household ", account: { kind: "ACCOUNT_ID", value: " member-1 " } },
        expected: expectedRules([
          ["anatomime.room-create.account.15m.v1", accountId],
          ["anatomime.room-create.account.24h.v1", accountId],
          ["anatomime.room-create.network.15m.v1", network],
          ["anatomime.room-create.network.24h.v1", network],
        ]),
      },
      {
        name: "anonymous room creation",
        request: { operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: "household" },
        expected: expectedRules([
          ["anatomime.room-create.network-anonymous.15m.v1", network],
          ["anatomime.room-create.network-anonymous.24h.v1", network],
          ["anatomime.room-create.network.15m.v1", network],
          ["anatomime.room-create.network.24h.v1", network],
        ]),
      },
      {
        name: "room join ingress",
        request: { operation: "ANATOMIME_ROOM_JOIN_INGRESS", networkIdentifier: "household" },
        expected: expectedRules([
          ["anatomime.room-join.network.15m.v1", network],
          ["anatomime.room-join.network.24h.v1", network],
        ]),
      },
      {
        name: "verified room join resource",
        request: { operation: "ANATOMIME_ROOM_JOIN", networkIdentifier: "household", roomIdentifier: " room-code " },
        expected: expectedRules([
          ["anatomime.room-join.network-room.10m.v1", [...network, room]],
        ]),
      },
      {
        name: "realtime token ingress",
        request: { operation: "ANATOMIME_REALTIME_TOKEN_INGRESS", networkIdentifier: "household" },
        expected: expectedRules([
          ["anatomime.realtime-token.network.10m.v1", network],
        ]),
      },
      {
        name: "realtime token start",
        request: { operation: "ANATOMIME_REALTIME_TOKEN_START", networkIdentifier: "household", roomIdentifier: "room-code" },
        expected: expectedRules([
          ["anatomime.realtime-token.network-room.10m.v1", [...network, room]],
        ]),
      },
      {
        name: "realtime token issue",
        request: { operation: "ANATOMIME_REALTIME_TOKEN_ISSUE", playerId: " player-1 ", roomId: " room-id " },
        expected: expectedRules([
          ["anatomime.realtime-token.player.10m.v1", [{ label: "player", value: "player-1" }]],
          ["anatomime.realtime-token.room.10m.v1", [{ label: "room", value: "room-id" }]],
        ]),
      },
      {
        name: "unjoined lookup",
        request: { operation: "ANATOMIME_UNJOINED_LOOKUP", networkIdentifier: "household", roomIdentifier: "room-code" },
        expected: expectedRules([
          ["anatomime.unjoined-lookup.network-room.10m.v1", [...network, room]],
        ]),
      },
      {
        name: "authenticated availability",
        request: { operation: "BOOKING_AVAILABILITY", networkIdentifier: "household", practiceId: "practice-1", account: { kind: "EMAIL", value: " Member@Example.COM " } },
        expected: expectedRules([
          ["booking.availability.account-practice.5m.v1", [...accountEmail, practice]],
          ["booking.availability.network-practice-authenticated.5m.v1", [...network, practice]],
        ]),
      },
      {
        name: "anonymous availability",
        request: { operation: "BOOKING_AVAILABILITY", networkIdentifier: "household", practiceId: "practice-1" },
        expected: expectedRules([
          ["booking.availability.network-practice-anonymous.5m.v1", [...network, practice]],
        ]),
      },
      {
        name: "account-owned booking",
        request: { operation: "BOOKING_CREATE", networkIdentifier: "household", practiceId: "practice-1", owner: { kind: "ACCOUNT_ID", value: "member-1" } },
        expected: expectedRules([
          ["booking.create.owner-practice.30m.v1", [...accountId, practice]],
          ["booking.create.owner-practice.24h.v1", [...accountId, practice]],
          ["booking.create.network-practice.30m.v1", [...network, practice]],
          ["booking.create.network-practice.24h.v1", [...network, practice]],
        ]),
      },
      {
        name: "guest-owned booking",
        request: { operation: "BOOKING_CREATE", networkIdentifier: "household", practiceId: "practice-1", owner: { kind: "GUEST_EMAIL", value: "Guest@Example.COM" } },
        expected: expectedRules([
          ["booking.create.owner-practice.30m.v1", [...guestEmail, practice]],
          ["booking.create.owner-practice.24h.v1", [...guestEmail, practice]],
          ["booking.create.network-practice.30m.v1", [...network, practice]],
          ["booking.create.network-practice.24h.v1", [...network, practice]],
        ]),
      },
      {
        name: "account-owned waitlist join",
        request: { operation: "WAITLIST_JOIN", networkIdentifier: "household", practiceId: "practice-1", owner: { kind: "ACCOUNT_ID", value: "member-1" } },
        expected: expectedRules([
          ["booking.waitlist.owner-practice.30m.v1", [...accountId, practice]],
          ["booking.waitlist.owner-practice.24h.v1", [...accountId, practice]],
          ["booking.waitlist.network-practice.30m.v1", [...network, practice]],
          ["booking.waitlist.network-practice.24h.v1", [...network, practice]],
        ]),
      },
      {
        name: "guest-owned waitlist join",
        request: { operation: "WAITLIST_JOIN", networkIdentifier: "household", practiceId: "practice-1", owner: { kind: "GUEST_EMAIL", value: "guest@example.com" } },
        expected: expectedRules([
          ["booking.waitlist.owner-practice.30m.v1", [...guestEmail, practice]],
          ["booking.waitlist.owner-practice.24h.v1", [...guestEmail, practice]],
          ["booking.waitlist.network-practice.30m.v1", [...network, practice]],
          ["booking.waitlist.network-practice.24h.v1", [...network, practice]],
        ]),
      },
      {
        name: "authenticated donation",
        request: { operation: "DONATION_CHECKOUT", networkIdentifier: "household", account: { kind: "ACCOUNT_ID", value: "member-1" } },
        expected: expectedRules([
          ["donation.account.15m.v1", accountId],
          ["donation.account.24h.v1", accountId],
          ["donation.network.15m.v1", network],
          ["donation.network.24h.v1", network],
          ["donation.global.24h.v1", deployment],
        ]),
      },
      {
        name: "anonymous donation",
        request: { operation: "DONATION_CHECKOUT", networkIdentifier: "household" },
        expected: expectedRules([
          ["donation.network-anonymous.15m.v1", network],
          ["donation.network-anonymous.24h.v1", network],
          ["donation.network.15m.v1", network],
          ["donation.network.24h.v1", network],
          ["donation.global.24h.v1", deployment],
        ]),
      },
      {
        name: "problem report",
        request: { operation: "PROBLEM_REPORT", networkIdentifier: "household" },
        expected: expectedRules([
          ["problem-report.network.10m.v1", network],
          ["problem-report.global.10m.v1", deployment],
          ["problem-report.global.24h.v1", deployment],
        ]),
      },
      {
        name: "public auth email",
        request: { operation: "EMAIL_PUBLIC_AUTH" },
        expected: expectedRules([
          ["email.public-auth.global.24h.v1", deployment],
          ["email.total.global.24h.v1", deployment],
        ]),
      },
      {
        name: "security email",
        request: { operation: "EMAIL_SECURITY" },
        expected: expectedRules([
          ["email.total.global.24h.v1", deployment],
        ]),
      },
    ]

    for (const { name, request, expected } of cases) {
      assert.deepEqual(resolveOperationalRateLimitRules(request), expected, name)
    }
  })

  it("applies the intended authenticated and anonymous combinations", () => {
    assert.deepEqual(policies({
      operation: "ANATOMIME_ROOM_CREATE",
      networkIdentifier: "household",
      account: { kind: "ACCOUNT_ID", value: "member" },
    }), [
      "anatomime.room-create.account.15m.v1",
      "anatomime.room-create.account.24h.v1",
      "anatomime.room-create.network.15m.v1",
      "anatomime.room-create.network.24h.v1",
    ])
    assert.deepEqual(policies({ operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: "household" }), [
      "anatomime.room-create.network-anonymous.15m.v1",
      "anatomime.room-create.network-anonymous.24h.v1",
      "anatomime.room-create.network.15m.v1",
      "anatomime.room-create.network.24h.v1",
    ])
    assert.deepEqual(policies({ operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: "household", account: null }), [
      "anatomime.room-create.network-anonymous.15m.v1",
      "anatomime.room-create.network-anonymous.24h.v1",
      "anatomime.room-create.network.15m.v1",
      "anatomime.room-create.network.24h.v1",
    ])
    assert.deepEqual(policies({
      operation: "BOOKING_AVAILABILITY",
      networkIdentifier: "household",
      practiceId: "practice",
      account: { kind: "EMAIL", value: "person@example.com" },
    }), [
      "booking.availability.account-practice.5m.v1",
      "booking.availability.network-practice-authenticated.5m.v1",
    ])
    assert.deepEqual(policies({ operation: "BOOKING_AVAILABILITY", networkIdentifier: "household", practiceId: "practice" }), [
      "booking.availability.network-practice-anonymous.5m.v1",
    ])
    assert.deepEqual(policies({
      operation: "BOOKING_AVAILABILITY",
      networkIdentifier: "household",
      practiceId: "practice",
      account: null,
    }), [
      "booking.availability.network-practice-anonymous.5m.v1",
    ])
    assert.deepEqual(policies({
      operation: "DONATION_CHECKOUT",
      networkIdentifier: "household",
      account: { kind: "ACCOUNT_ID", value: "member" },
    }), [
      "donation.account.15m.v1",
      "donation.account.24h.v1",
      "donation.network.15m.v1",
      "donation.network.24h.v1",
      "donation.global.24h.v1",
    ])
    assert.deepEqual(policies({ operation: "DONATION_CHECKOUT", networkIdentifier: "household" }), [
      "donation.network-anonymous.15m.v1",
      "donation.network-anonymous.24h.v1",
      "donation.network.15m.v1",
      "donation.network.24h.v1",
      "donation.global.24h.v1",
    ])
    assert.deepEqual(policies({ operation: "DONATION_CHECKOUT", networkIdentifier: "household", account: null }), [
      "donation.network-anonymous.15m.v1",
      "donation.network-anonymous.24h.v1",
      "donation.network.15m.v1",
      "donation.network.24h.v1",
      "donation.global.24h.v1",
    ])
    assert.deepEqual(policies({ operation: "EMAIL_PUBLIC_AUTH" }), [
      "email.public-auth.global.24h.v1",
      "email.total.global.24h.v1",
    ])
    assert.deepEqual(policies({ operation: "EMAIL_SECURITY" }), ["email.total.global.24h.v1"])
  })

  it("normalizes and labels subjects without accepting caller policy input", () => {
    const booking = resolveOperationalRateLimitRules({
      operation: "BOOKING_CREATE",
      networkIdentifier: "  household  ",
      practiceId: "  practice-1  ",
      owner: { kind: "GUEST_EMAIL", value: "  Guest@Example.COM  " },
      policy: "caller-controlled",
    })

    assert.deepEqual(booking?.[0].normalizedSubjectComponents, [
      { label: "guest-email", value: "guest@example.com" },
      { label: "practice", value: "practice-1" },
    ])
    assert.deepEqual(booking?.[2].normalizedSubjectComponents, [
      { label: "network", value: "household" },
      { label: "practice", value: "practice-1" },
    ])
    assert.equal(booking?.some((rule) => rule.policy === "caller-controlled"), false)
  })

  it("fails closed for unknown operations and malformed or over-bound subjects", () => {
    const tooLong = "x".repeat(257)
    const malformed = [
      null,
      {},
      { operation: "UNKNOWN", networkIdentifier: "net" },
      { operation: "ANATOMIME_ROOM_JOIN_INGRESS", networkIdentifier: "" },
      { operation: "ANATOMIME_ROOM_JOIN_INGRESS", networkIdentifier: tooLong },
      { operation: "ANATOMIME_ROOM_JOIN", networkIdentifier: "", roomIdentifier: "room" },
      { operation: "ANATOMIME_ROOM_JOIN", networkIdentifier: "net", roomIdentifier: tooLong },
      { operation: "PROBLEM_REPORT", networkIdentifier: tooLong },
      { operation: "ANATOMIME_REALTIME_TOKEN_INGRESS", networkIdentifier: "" },
      { operation: "ANATOMIME_REALTIME_TOKEN_INGRESS", networkIdentifier: tooLong },
      { operation: "ANATOMIME_REALTIME_TOKEN_START", networkIdentifier: "net", roomIdentifier: "" },
      { operation: "ANATOMIME_UNJOINED_LOOKUP", networkIdentifier: "", roomIdentifier: "room" },
      { operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: "net", account: { kind: "EMAIL", value: "not-an-email" } },
      { operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: "net", account: { kind: "ACCOUNT_ID", value: tooLong } },
      { operation: "ANATOMIME_ROOM_CREATE", networkIdentifier: "net", account: false },
      { operation: "BOOKING_AVAILABILITY", networkIdentifier: "net", practiceId: "practice", account: { kind: "EMAIL", value: tooLong } },
      { operation: "BOOKING_AVAILABILITY", networkIdentifier: "net", practiceId: "practice", account: "" },
      { operation: "BOOKING_AVAILABILITY", networkIdentifier: "net", practiceId: "" },
      { operation: "BOOKING_AVAILABILITY", networkIdentifier: "net", practiceId: tooLong },
      { operation: "BOOKING_CREATE", networkIdentifier: "net", practiceId: "practice" },
      { operation: "BOOKING_CREATE", networkIdentifier: "net", practiceId: "practice", owner: { kind: "GUEST_EMAIL", value: "" } },
      { operation: "BOOKING_CREATE", networkIdentifier: "net", practiceId: "practice", owner: { kind: "ACCOUNT_ID", value: tooLong } },
      { operation: "WAITLIST_JOIN", networkIdentifier: "net", practiceId: "practice", owner: { kind: "ACCOUNT_ID", value: "" } },
      { operation: "WAITLIST_JOIN", networkIdentifier: "net", practiceId: "practice", owner: { kind: "GUEST_EMAIL", value: tooLong } },
      { operation: "DONATION_CHECKOUT", networkIdentifier: "net", account: { kind: "ACCOUNT_ID", value: "" } },
      { operation: "DONATION_CHECKOUT", networkIdentifier: "net", account: false },
      { operation: "ANATOMIME_REALTIME_TOKEN_ISSUE", playerId: "player", roomId: " " },
      { operation: "PROBLEM_REPORT", networkIdentifier: 42 },
    ]

    for (const request of malformed) {
      assert.equal(resolveOperationalRateLimitRules(request), null, JSON.stringify(request))
    }
  })

})
