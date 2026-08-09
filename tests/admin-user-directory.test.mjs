import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  getAdminUserMetrics,
  listAdminUsers,
  parseUserDirectoryQuery,
} from "../lib/admin/user-directory.ts"

const directoryPageSource = await readFile(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8")

describe("admin user directory", () => {
  it("bounds query input and discards unknown filter values", () => {
    assert.deepEqual(parseUserDirectoryQuery({ q: "  Avery  ", pageSize: "500" }), {
      query: "Avery",
      pageSize: 50,
      cursor: null,
      emailVerified: null,
      role: null,
      roleStatus: null,
      subscriptionStatus: null,
      creditState: null,
      unresolvedIssue: null,
    })

    assert.deepEqual(parseUserDirectoryQuery({
      q: "x".repeat(101),
      pageSize: "0",
      cursor: Buffer.from("user_2").toString("base64url"),
      emailVerified: "verified",
      role: "ADMIN",
      roleStatus: "revoked",
      subscriptionStatus: "past_due",
      creditState: "positive",
      unresolvedIssue: "yes",
    }), {
      query: "x".repeat(100),
      pageSize: 1,
      cursor: "user_2",
      emailVerified: "verified",
      role: "ADMIN",
      roleStatus: "revoked",
      subscriptionStatus: "past_due",
      creditState: "positive",
      unresolvedIssue: "yes",
    })

    assert.deepEqual(parseUserDirectoryQuery({
      cursor: "not-base64url!",
      emailVerified: "unknown",
      role: "ROOT",
      roleStatus: "expired",
      subscriptionStatus: "made-up",
      creditState: "negative",
      unresolvedIssue: "maybe",
    }), {
      query: "",
      pageSize: 25,
      cursor: null,
      emailVerified: null,
      role: null,
      roleStatus: null,
      subscriptionStatus: null,
      creditState: null,
      unresolvedIssue: null,
    })

    assert.equal(parseUserDirectoryQuery({ role: "ANATOMY_ADMIN" }).role, null)
  })

  it("returns only the bounded account-operation projection and an opaque next cursor", async () => {
    const calls = []
    const prismaClient = {
      user: {
        findMany: async (args) => {
          calls.push(args)
          if (Object.keys(args.select).length === 1 && args.select.id) {
            return [{ id: "user_before" }]
          }
          return [
            userRow("user_1", { name: "Avery", balance: 2, subscriptionStatus: "active", unresolvedCommerce: 2, unresolvedEmail: 1 }),
            userRow("user_2", { name: "Avery Two", balance: 0, subscriptionStatus: null, unresolvedCommerce: 0, unresolvedEmail: 0 }),
          ]
        },
      },
    }

    const parsedQuery = parseUserDirectoryQuery({
      q: "avery",
      pageSize: "1",
      cursor: Buffer.from("user_0").toString("base64url"),
      emailVerified: "verified",
      role: "ADMIN",
      roleStatus: "verified",
      subscriptionStatus: "active",
      creditState: "positive",
      unresolvedIssue: "yes",
    })
    const page = await listAdminUsers({
      prismaClient,
      input: parsedQuery,
    })

    assert.deepEqual(Object.keys(page.items[0]).sort(), [
      "creditBalance", "email", "emailVerified", "id", "name",
      "roles", "subscriptionStatus", "unresolvedIssueCount",
    ].sort())
    assert.deepEqual(page.items, [{
      id: "user_1",
      name: "Avery",
      email: "avery@example.test",
      emailVerified: true,
      roles: [{ role: "ANATOMY_EDITOR", status: "VERIFIED" }, { role: "ADMIN", status: "VERIFIED" }],
      subscriptionStatus: "active",
      creditBalance: 2,
      unresolvedIssueCount: 3,
    }])
    assert.equal(page.nextCursor, Buffer.from("user_1").toString("base64url"))
    assert.equal(page.previousCursor, Buffer.from("user_before").toString("base64url"))
    assert.doesNotMatch(JSON.stringify(page), /passwordHash|encryptedSecret|verificationPayload|providerAccountId/)

    const [query, previousPageQuery] = calls
    assert.equal(query.take, 2)
    assert.deepEqual(query.cursor, { id: "user_0" })
    assert.equal(query.skip, 1)
    assert.deepEqual(query.orderBy, { id: "asc" })
    assert.deepEqual(query.where, {
      AND: [
        { OR: [
          { name: { contains: "avery", mode: "insensitive" } },
          { email: { contains: "avery", mode: "insensitive" } },
          { id: { contains: "avery", mode: "insensitive" } },
        ] },
        { emailVerified: { not: null } },
        { roles: { some: { role: "ADMIN", status: "VERIFIED" } } },
        { membershipSubscriptions: { some: { membershipLevel: "SUPPORTER", status: "active" } } },
        { backgroundCreditWallet: { is: { balance: { gt: 0 } } } },
        { OR: [
          { commerceOrders: { some: { OR: [
            { status: "REVIEW_REQUIRED" },
            { refunds: { some: { status: "PENDING" } } },
            { payments: { some: { disputes: { some: { status: "OPEN" } } } } },
          ] } } },
          { adminEmailIntents: { some: { status: { in: ["PENDING", "FAILED"] } } } },
        ] },
      ],
    })
    assert.deepEqual(Object.keys(query.select).sort(), [
      "_count", "backgroundCreditWallet", "email", "emailVerified", "id", "membershipSubscriptions", "name", "roles",
    ].sort())
    assert.deepEqual(query.select.roles.orderBy, [{ role: "asc" }, { status: "asc" }])
    assert.deepEqual(query.select.membershipSubscriptions, {
      where: { membershipLevel: "SUPPORTER" },
      select: { status: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 1,
    })
    assert.deepEqual(previousPageQuery, {
      where: {
        AND: [
          { OR: [
            { name: { contains: "avery", mode: "insensitive" } },
            { email: { contains: "avery", mode: "insensitive" } },
            { id: { contains: "avery", mode: "insensitive" } },
          ] },
          { emailVerified: { not: null } },
          { roles: { some: { role: "ADMIN", status: "VERIFIED" } } },
          { membershipSubscriptions: { some: { membershipLevel: "SUPPORTER", status: "active" } } },
          { backgroundCreditWallet: { is: { balance: { gt: 0 } } } },
          { OR: [
            { commerceOrders: { some: { OR: [
              { status: "REVIEW_REQUIRED" },
              { refunds: { some: { status: "PENDING" } } },
              { payments: { some: { disputes: { some: { status: "OPEN" } } } } },
            ] } } },
            { adminEmailIntents: { some: { status: { in: ["PENDING", "FAILED"] } } } },
          ] },
          { id: { lt: "user_0" } },
        ],
      },
      select: { id: true },
      orderBy: { id: "desc" },
      take: 1,
    })
  })

  it("keeps a previous-page navigation target when page two returns to the initial cursorless page", async () => {
    const prismaClient = {
      user: {
        findMany: async (args) => {
          if (Object.keys(args.select).length === 1 && args.select.id) {
            return [{ id: "user_1" }]
          }
          return [
            userRow("user_3", { name: "Page Three", balance: 0, subscriptionStatus: null, unresolvedCommerce: 0, unresolvedEmail: 0 }),
            userRow("user_4", { name: "Page Four", balance: 0, subscriptionStatus: null, unresolvedCommerce: 0, unresolvedEmail: 0 }),
          ]
        },
      },
    }

    const page = await listAdminUsers({
      prismaClient,
      input: { pageSize: 2, cursor: Buffer.from("user_2").toString("base64url") },
    })

    assert.deepEqual(page.items.map((user) => user.id), ["user_3", "user_4"])
    assert.equal(page.previousCursor, null)
    assert.equal(page.hasPreviousPage, true)
  })

  it("scopes displayed state to Supporter when persisted legacy membership levels are mixed", async () => {
    const persisted = [
      { id: "legacy_newer", membershipLevel: "THERAPIST", status: "past_due", updatedAt: new Date("2026-08-09T12:00:00.000Z") },
      { id: "supporter_current", membershipLevel: "SUPPORTER", status: "active", updatedAt: new Date("2026-08-08T12:00:00.000Z") },
    ]
    const prismaClient = {
      user: {
        findMany: async (args) => {
          assert.deepEqual(args.select.membershipSubscriptions.where, { membershipLevel: "SUPPORTER" })
          assert.deepEqual(args.select.membershipSubscriptions.orderBy, [{ updatedAt: "desc" }, { id: "desc" }])
          const supporterRows = persisted
            .filter((subscription) => subscription.membershipLevel === "SUPPORTER")
            .map(({ status }) => ({ status }))
          return [{ ...userRow("user_mixed", { name: "Mixed", balance: 0, subscriptionStatus: null, unresolvedCommerce: 0, unresolvedEmail: 0 }), membershipSubscriptions: supporterRows }]
        },
      },
    }

    const page = await listAdminUsers({ prismaClient, input: { pageSize: 25 } })

    assert.equal(page.items[0].subscriptionStatus, "active")
  })

  it("counts the initial account, verification, active-Supporter, and unresolved-operation metrics", async () => {
    const calls = []
    const now = new Date("2026-08-09T12:00:00.000Z")
    const prismaClient = {
      user: {
        count: async (args) => {
          calls.push(["user", args])
          return [42, 35, 7][calls.filter(([model]) => model === "user").length - 1]
        },
      },
      commerceOrder: {
        count: async (args) => {
          calls.push(["commerceOrder", args])
          return 2
        },
      },
      adminEmailIntent: {
        count: async (args) => {
          calls.push(["adminEmailIntent", args])
          return 3
        },
      },
    }

    assert.deepEqual(await getAdminUserMetrics({ prismaClient, now }), {
      totalAccounts: 42,
      verifiedAccounts: 35,
      activeSupporters: 7,
      unresolvedOperations: 5,
    })
    assert.deepEqual(calls, [
      ["user", {}],
      ["user", { where: { emailVerified: { not: null } } }],
      ["user", { where: { membershipSubscriptions: { some: {
        membershipLevel: "SUPPORTER",
        status: { in: ["active", "trialing"] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      } } } }],
      ["commerceOrder", { where: { OR: [
        { status: "REVIEW_REQUIRED" },
        { refunds: { some: { status: "PENDING" } } },
        { payments: { some: { disputes: { some: { status: "OPEN" } } } } },
      ] } }],
      ["adminEmailIntent", { where: { status: { in: ["PENDING", "FAILED"] } } }],
    ])
  })

  it("keeps long directory identity metadata inside mobile cards", () => {
    assert.match(directoryPageSource, /function AccountIdentity[\s\S]*className="min-w-0"/)
    assert.match(directoryPageSource, /\[overflow-wrap:anywhere\]/)
  })
})

/** Fixture mirrors the deliberately narrow Prisma select without carrying credentials or payment details. */
function userRow(id, { name, balance, subscriptionStatus, unresolvedCommerce, unresolvedEmail }) {
  return {
    id,
    name,
    email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
    emailVerified: new Date("2026-08-08T12:00:00.000Z"),
    roles: [
      { role: "ANATOMY_ADMIN", status: "VERIFIED" },
      { role: "ANATOMY_EDITOR", status: "VERIFIED" },
      { role: "ADMIN", status: "VERIFIED" },
    ],
    membershipSubscriptions: subscriptionStatus ? [{ status: subscriptionStatus }] : [],
    backgroundCreditWallet: { balance },
    _count: { commerceOrders: unresolvedCommerce, adminEmailIntents: unresolvedEmail },
  }
}
