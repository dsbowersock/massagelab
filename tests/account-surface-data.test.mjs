import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createAccountSurfaceDataLoader,
  sessionHasActiveMembershipBenefits,
} from "../lib/account-surface-data.js"

const accountSurfaceDataSource = await readFile(
  new URL("../lib/account-surface-data.js", import.meta.url),
  "utf8",
)

function createMockPrisma(calls) {
  return {
    userProfile: {
      async findUnique() {
        calls.push("userProfile.findUnique")
        return { displayName: "Derrick", therapistName: "Derrick Bowersock" }
      },
    },
    passwordCredential: {
      async findUnique() {
        calls.push("passwordCredential.findUnique")
        return { id: "password_1" }
      },
    },
    account: {
      async findFirst() {
        calls.push("account.findFirst")
        return { id: "google_1" }
      },
    },
    credentialVerification: {
      async findMany() {
        calls.push("credentialVerification.findMany")
        return [{ id: "verification_1", status: "PENDING" }]
      },
    },
    userPreference: {
      async findUnique() {
        calls.push("userPreference.findUnique")
        return { updatedAt: new Date("2026-05-18T12:00:00.000Z") }
      },
    },
    learningProgress: {
      async count() {
        calls.push("learningProgress.count")
        return 2
      },
    },
    achievement: {
      async count() {
        calls.push("achievement.count")
        return 3
      },
    },
    noteTemplate: {
      async count() {
        calls.push("noteTemplate.count")
        return 4
      },
    },
  }
}

function createLoader(calls) {
  return createAccountSurfaceDataLoader({
    prismaClient: createMockPrisma(calls),
    async getMembershipSummary() {
      calls.push("getMembershipSummary")
      return {
        stripeCustomer: null,
        subscriptions: [],
        entitlements: { level: "FREE", paidLevel: null, features: [] },
      }
    },
    async getPricingCatalog() {
      calls.push("getPricingCatalog")
      return { plans: [], intervals: [], defaultInterval: "month" }
    },
    getClinicalSyncReadiness() {
      calls.push("getClinicalSyncReadiness")
      return { enabled: false, reason: "disabled" }
    },
    now: () => 1_000,
  })
}

const sessionUser = {
  role: "USER",
  roles: ["USER"],
  roleAssignments: [{ role: "USER", status: "VERIFIED" }],
  capabilities: {
    canUsePremiumBackgrounds: false,
    hasActiveMembershipBenefits: false,
  },
  twoFactorEnabled: false,
}

describe("account surface data loader", () => {
  it("delegates public display pricing to the shared catalog owner without a private cache", () => {
    assert.match(
      accountSurfaceDataSource,
      /import\s*\{[^}]*\bgetMembershipPricingCatalog\b[^}]*\}\s*from\s*["']\.\/membership-pricing\.js["']/,
    )
    assert.doesNotMatch(accountSurfaceDataSource, /ACCOUNT_PRICING_CATALOG_CACHE_TTL_MS/)
    assert.doesNotMatch(accountSurfaceDataSource, /pricingCatalogCache/)
  })

  it("uses the legacy premium-background claim only when the aggregate membership claim is absent", () => {
    assert.equal(sessionHasActiveMembershipBenefits({
      capabilities: { canUsePremiumBackgrounds: true },
    }), true)
    assert.equal(sessionHasActiveMembershipBenefits({
      capabilities: {
        canUsePremiumBackgrounds: true,
        hasActiveMembershipBenefits: false,
      },
    }), false)
  })

  it("loads only lightweight counts for the overview surface", async () => {
    const calls = []
    const loader = createLoader(calls)

    const data = await loader.getAccountSurfaceData("overview", "user_1", sessionUser)

    assert.equal(data.surface, "overview")
    assert.deepEqual(data.counts, {
      progressCount: 2,
      achievementCount: 3,
      templateCount: 4,
    })
    assert.equal(data.hasActiveMembershipBenefits, false)
    assert.deepEqual(calls, [
      "learningProgress.count",
      "achievement.count",
      "noteTemplate.count",
    ])

    const activeSessionUser = {
      ...sessionUser,
      capabilities: {
        ...sessionUser.capabilities,
        hasActiveMembershipBenefits: true,
      },
    }
    const legacySessionUser = {
      ...sessionUser,
      capabilities: {
        canUsePremiumBackgrounds: true,
      },
    }
    const explicitInactiveSessionUser = {
      ...legacySessionUser,
      capabilities: {
        ...legacySessionUser.capabilities,
        hasActiveMembershipBenefits: false,
      },
    }
    const [cachedData, activeData, legacyData, explicitInactiveData] = await Promise.all([
      loader.getAccountSurfaceData("overview", "user_1", sessionUser),
      loader.getAccountSurfaceData("overview", "user_1", activeSessionUser),
      loader.getAccountSurfaceData("overview", "user_1", legacySessionUser),
      loader.getAccountSurfaceData("overview", "user_1", explicitInactiveSessionUser),
    ])
    assert.equal(cachedData.hasActiveMembershipBenefits, false)
    assert.equal(activeData.hasActiveMembershipBenefits, true)
    assert.equal(legacyData.hasActiveMembershipBenefits, true)
    assert.equal(explicitInactiveData.hasActiveMembershipBenefits, false)
    assert.deepEqual(calls, [
      "learningProgress.count",
      "achievement.count",
      "noteTemplate.count",
    ])
  })

  it("loads only profile data for the profile surface", async () => {
    const calls = []
    const loader = createLoader(calls)

    const data = await loader.getAccountSurfaceData("profile", "user_1", sessionUser)

    assert.equal(data.surface, "profile")
    assert.equal(data.profile.displayName, "Derrick")
    assert.deepEqual(calls, ["userProfile.findUnique"])
  })

  it("loads only sign-in method data for the security surface", async () => {
    const calls = []
    const loader = createLoader(calls)

    const data = await loader.getAccountSurfaceData("security", "user_1", sessionUser)

    assert.equal(data.surface, "security")
    assert.equal(data.hasPasswordCredential, true)
    assert.equal(data.googleLinked, true)
    assert.deepEqual(calls, ["passwordCredential.findUnique", "account.findFirst"])
  })

  it("projects every two-factor UI method state from booleans without exposing account rows", async () => {
    for (const [passwordCredential, googleAccount, expected] of [
      [{ id: "password-private" }, null, { hasPasswordCredential: true, googleLinked: false }],
      [{ id: "password-private" }, { id: "google-private" }, { hasPasswordCredential: true, googleLinked: true }],
      [null, { id: "google-private" }, { hasPasswordCredential: false, googleLinked: true }],
      [null, null, { hasPasswordCredential: false, googleLinked: false }],
    ]) {
      const loader = createAccountSurfaceDataLoader({
        prismaClient: {
          passwordCredential: { async findUnique() { return passwordCredential } },
          account: { async findFirst() { return googleAccount } },
        },
      })

      const data = await loader.getAccountSurfaceData("security", "user-1", sessionUser)

      assert.deepEqual(data, { surface: "security", ...expected })
      assert.doesNotMatch(JSON.stringify(data), /password-private|google-private|user-1/)
    }
  })

  it("loads only the signed-in user's newest fifty safe activity rows", async () => {
    const calls = []
    let rows = [{
      id: "activity-1",
      title: "Background credits added",
      explanation: "Support added credits to your account.",
      effectiveValue: "+5 credits",
      occurredAt: new Date("2026-08-08T12:00:00.000Z"),
      internalNote: "must not reach Account",
      actorUserId: "admin-1",
    }]
    const loader = createAccountSurfaceDataLoader({
      prismaClient: {
        userAccountActivity: {
          async findMany(args) {
            calls.push(args)
            return rows
          },
        },
      },
    })

    const data = await loader.getAccountSurfaceData("activity", "user-1", sessionUser)

    assert.equal(data.surface, "activity")
    assert.deepEqual(data.activity, [{
      id: "activity-1",
      title: "Background credits added",
      explanation: "Support added credits to your account.",
      effectiveValue: "+5 credits",
      occurredAt: "2026-08-08T12:00:00.000Z",
    }])
    assert.deepEqual(calls, [{
      where: { userId: "user-1" },
      select: { id: true, title: true, explanation: true, effectiveValue: true, occurredAt: true },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 50,
    }])
    assert.doesNotMatch(JSON.stringify(data), /internalNote|actorUserId|failureCode/)

    rows = [{
      id: "activity-2",
      title: "Email delivered",
      explanation: "A requested email was delivered.",
      effectiveValue: null,
      occurredAt: new Date("2026-08-08T12:01:00.000Z"),
    }, ...rows]
    const refreshed = await loader.getAccountSurfaceData("activity", "user-1", sessionUser)

    assert.deepEqual(refreshed.activity.map(({ id }) => id), ["activity-2", "activity-1"])
    assert.equal(calls.length, 2)
  })

  it("does not cache session-derived credential roles", async () => {
    const calls = []
    const loader = createLoader(calls)
    const adminSessionUser = {
      ...sessionUser,
      role: "ADMIN",
      roles: ["ADMIN"],
      roleAssignments: [{ role: "ADMIN", status: "VERIFIED" }],
    }

    const first = await loader.getAccountSurfaceData("credentials", "user_1", sessionUser)
    const second = await loader.getAccountSurfaceData("credentials", "user_1", adminSessionUser)

    assert.deepEqual(first.roleAssignments.map(({ role }) => role), ["USER"])
    assert.deepEqual(second.roleAssignments.map(({ role }) => role), ["ADMIN"])
    assert.deepEqual(calls, [
      "credentialVerification.findMany",
      "credentialVerification.findMany",
    ])
  })

  it("reloads request-time membership access and delegates every display read to the shared pricing owner", async () => {
    const calls = []
    const loader = createLoader(calls)

    const first = await loader.getAccountSurfaceData("membership", "user_1", sessionUser)
    const second = await loader.getAccountSurfaceData("membership", "user_1", sessionUser)

    assert.equal(first.surface, "membership")
    assert.equal(second.surface, "membership")
    assert.deepEqual(calls, [
      "getMembershipSummary",
      "getPricingCatalog",
      "getMembershipSummary",
      "getPricingCatalog",
    ])
  })

  it("passes one captured request time to the membership summary and exposes only safe feature expiration evidence", async () => {
    const calls = []
    const nowMs = Date.parse("2026-08-08T00:00:00.000Z")
    const loader = createAccountSurfaceDataLoader({
      prismaClient: {},
      async getMembershipSummary(_prismaClient, userId, now) {
        calls.push({ userId, now })
        return {
          stripeCustomer: null,
          subscriptions: [],
          entitlements: {
            level: "FREE",
            paidLevel: null,
            features: ["calendar_basic_scheduling", "premium_backgrounds"],
            featureAccess: [{
              featureKey: "premium_backgrounds",
              sources: [{ source: "temporary", expiresAt: "2026-09-01T00:00:00.000Z" }],
            }],
          },
        }
      },
      async getPricingCatalog() {
        return { plans: [], intervals: [], defaultInterval: "month" }
      },
      now: () => nowMs,
    })

    const data = await loader.getAccountSurfaceData("membership", "user-1", sessionUser)

    assert.equal(calls.length, 1)
    assert.equal(calls[0].userId, "user-1")
    assert.equal(calls[0].now.toISOString(), "2026-08-08T00:00:00.000Z")
    assert.deepEqual(data.membershipSummary.entitlements.featureAccess, [{
      featureKey: "premium_backgrounds",
      sources: [{ source: "temporary", expiresAt: "2026-09-01T00:00:00.000Z" }],
    }])
    assert.doesNotMatch(JSON.stringify(data.membershipSummary), /actorUserId|grantedById|internalNote|idempotencyKey/i)
  })

  it("loads no database data for local-only app settings surfaces", async () => {
    const calls = []
    const loader = createLoader(calls)
    const adminSessionUser = {
      ...sessionUser,
      role: "ADMIN",
      roles: ["ADMIN"],
      roleAssignments: [{ role: "ADMIN", status: "VERIFIED" }],
    }

    const data = await loader.getAccountSurfaceData("app-settings", "user_1", sessionUser)
    const refreshedData = await loader.getAccountSurfaceData("app-settings", "user_1", adminSessionUser)

    assert.equal(data.surface, "app-settings")
    assert.equal(data.canManageAnatomy, false)
    assert.equal(refreshedData.canManageAnatomy, true)
    assert.deepEqual(calls, [])
  })
})
