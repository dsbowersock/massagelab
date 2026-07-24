import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createAccountSurfaceDataLoader } from "../lib/account-surface-data.js"

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
  capabilities: { canUseChimerCustomColors: false },
  twoFactorEnabled: false,
}

describe("account surface data loader", () => {
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

  it("loads billing data only for the membership surface and reuses the short-lived cache", async () => {
    const calls = []
    const loader = createLoader(calls)

    const first = await loader.getAccountSurfaceData("membership", "user_1", sessionUser)
    const second = await loader.getAccountSurfaceData("membership", "user_1", sessionUser)

    assert.equal(first.surface, "membership")
    assert.equal(second.surface, "membership")
    assert.deepEqual(calls, ["getMembershipSummary", "getPricingCatalog"])
  })

  it("loads no database data for local-only app settings surfaces", async () => {
    const calls = []
    const loader = createLoader(calls)

    const data = await loader.getAccountSurfaceData("app-settings", "user_1", sessionUser)

    assert.equal(data.surface, "app-settings")
    assert.deepEqual(calls, [])
  })
})
