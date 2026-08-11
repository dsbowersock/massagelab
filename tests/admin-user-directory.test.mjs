import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import * as userDirectory from "../lib/admin/user-directory.ts"

const {
  ADMIN_TEMPORARY_ACCESS_EXPIRING_WINDOW_DAYS,
  getAdminUserMetrics,
  listAdminUsers,
  parseUserDirectoryQuery,
} = userDirectory

const directoryPageSource = await readFile(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8")
const directorySource = await readFile(new URL("../lib/admin/user-directory.ts", import.meta.url), "utf8")
const expectedGrantableFeatureKeys = [
  "premium_backgrounds",
  "therapist_documentation_tools",
  "calendar_basic_scheduling",
  "calendar_full_scheduling",
  "external_calendar_sync",
]

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
      temporaryAccess: null,
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
      temporaryAccess: "active",
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
      temporaryAccess: "active",
      unresolvedIssue: "yes",
    })

    assert.deepEqual(parseUserDirectoryQuery({
      cursor: "not-base64url!",
      emailVerified: "unknown",
      role: "ROOT",
      roleStatus: "expired",
      subscriptionStatus: "made-up",
      creditState: "negative",
      temporaryAccess: "later",
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
      temporaryAccess: null,
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
      temporaryAccess: "active",
      unresolvedIssue: "yes",
    })
    const now = new Date("2026-08-10T12:00:00.000Z")
    const page = await listAdminUsers({
      prismaClient,
      input: parsedQuery,
      now,
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
        { temporaryFeatureGrants: { some: {
          startsAt: { lte: now },
          expiresAt: { gt: now },
          revocation: null,
          featureKey: { in: expectedGrantableFeatureKeys },
        } } },
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
          { temporaryFeatureGrants: { some: {
            startsAt: { lte: now },
            expiresAt: { gt: now },
            revocation: null,
            featureKey: { in: expectedGrantableFeatureKeys },
          } } },
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

  it("counts accounts, support state, active temporary grants, and the exclusive 30-day expiry window", async () => {
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
      temporaryFeatureGrant: {
        count: async (args) => {
          calls.push(["temporaryFeatureGrant", args])
          return calls.filter(([model]) => model === "temporaryFeatureGrant").length === 1 ? 11 : 4
        },
      },
    }

    assert.equal(ADMIN_TEMPORARY_ACCESS_EXPIRING_WINDOW_DAYS, 30)
    assert.deepEqual(await getAdminUserMetrics({ prismaClient, now }), {
      totalAccounts: 42,
      verifiedAccounts: 35,
      activeSupporters: 7,
      unresolvedOperations: 5,
      activeTemporaryGrants: 11,
      expiringTemporaryGrants: 4,
    })
    const windowEnd = new Date("2026-09-08T12:00:00.000Z")
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
      ["temporaryFeatureGrant", { where: {
        startsAt: { lte: now },
        expiresAt: { gt: now },
        revocation: null,
        featureKey: { in: expectedGrantableFeatureKeys },
      } }],
      ["temporaryFeatureGrant", { where: {
        startsAt: { lte: now },
        expiresAt: { gt: now, lt: windowEnd },
        revocation: null,
        featureKey: { in: expectedGrantableFeatureKeys },
      } }],
    ])
  })

  it("parses active and none temporary-access filters with the same stable cursor predicate", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z")
    for (const temporaryAccess of ["active", "none"]) {
      const calls = []
      const prismaClient = {
        user: {
          findMany: async (args) => {
            calls.push(args)
            return []
          },
        },
      }
      const cursor = Buffer.from("user-2").toString("base64url")
      const parsed = parseUserDirectoryQuery({ temporaryAccess, cursor, pageSize: "10" })
      assert.equal(parsed.temporaryAccess, temporaryAccess)

      await listAdminUsers({ prismaClient, input: parsed, now })

      const relationFilter = temporaryAccess === "active" ? "some" : "none"
      const activePredicate = {
        startsAt: { lte: now },
        expiresAt: { gt: now },
        revocation: null,
        featureKey: { in: expectedGrantableFeatureKeys },
      }
      assert.deepEqual(calls[0].where, {
        AND: [{ temporaryFeatureGrants: { [relationFilter]: activePredicate } }],
      })
      assert.deepEqual(calls[1].where, {
        AND: [
          { temporaryFeatureGrants: { [relationFilter]: activePredicate } },
          { id: { lt: "user-2" } },
        ],
      })
    }
    assert.match(directorySource, /import \{ ADMIN_GRANTABLE_FEATURE_KEYS \} from "\.\/temporary-access-contract\.ts"/)
  })

  it("keeps long directory identity metadata inside mobile cards", () => {
    assert.match(directoryPageSource, /function AccountIdentity[\s\S]*className="min-w-0"/)
    assert.match(directoryPageSource, /\[overflow-wrap:anywhere\]/)
  })

  it("renders the temporary-access filter and grant-count metrics without calling them user counts", () => {
    assert.match(directoryPageSource, /name="temporaryAccess"/)
    assert.match(directoryPageSource, /\[\["active", "Active"\], \["none", "None"\]\]/)
    assert.match(directoryPageSource, /Active temporary grants/)
    assert.match(directoryPageSource, /Temporary grants expiring within 30 days/)
    assert.match(directoryPageSource, /query\.temporaryAccess[\s\S]*params\.set\("temporaryAccess"/)
    assert.doesNotMatch(directoryPageSource, /users with temporary access|accounts expiring/i)
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
