import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ADMIN_USER_DETAIL_SECTIONS,
  getAdminUserDetailSection,
  parseAdminUserDetailSection,
} from "../lib/admin/user-detail.ts"

describe("admin user detail", () => {
  it("allowlists independently selectable detail sections", () => {
    assert.deepEqual(ADMIN_USER_DETAIL_SECTIONS, ["overview", "access", "billing", "security", "activity"])
    assert.equal(parseAdminUserDetailSection("access"), "access")
    assert.equal(parseAdminUserDetailSection("credentials"), "overview")
  })

  it("loads security with its summary projection and a session aggregate only", async () => {
    const calls = []
    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls),
      userId: "user-1",
      section: "security",
    })

    assert.deepEqual(calls, ["user.findUnique:security-summary", "session.count"])
    assert.deepEqual(result.target, { id: "user-1", name: "Avery", email: "avery@example.test" })
    assert.deepEqual(result.data, {
      providers: ["google"],
      passwordConfigured: true,
      twoFactorEnabled: true,
      activeSessionCount: 2,
    })
    assert.doesNotMatch(JSON.stringify(result), /sessionToken|providerAccountId|passwordHash|encryptedSecret|codeHash/)
  })

  it("loads overview without billing, authentication, or clinical relationships", async () => {
    const calls = []
    const result = await getAdminUserDetailSection({ prismaClient: detailPrisma(calls), userId: "user-1", section: "overview" })

    assert.deepEqual(calls, ["user.findUnique:overview"])
    assert.deepEqual(Object.keys(result.data).sort(), ["credentials", "emailVerified", "learning", "practices", "profile"].sort())
    assert.doesNotMatch(JSON.stringify(result), /stripeCustomerId|paymentMethod|sessionToken|providerAccountId|passwordHash|encryptedSecret|SOAP|intake|journal|ROM/i)
  })

  it("loads access with roles, feature sources, credit ledger, and ownership summaries only", async () => {
    const calls = []
    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls), userId: "user-1", section: "access", now: new Date("2026-08-09T00:00:00.000Z"),
    })

    assert.deepEqual(calls, ["user.findUnique:access"])
    assert.deepEqual(result.data.features, [
      { key: "calendar_basic_scheduling", source: "SUPPORTER", expiresAt: "2026-09-01T00:00:00.000Z" },
      { key: "premium_backgrounds", source: "SUPPORTER", expiresAt: "2026-09-01T00:00:00.000Z" },
    ])
    assert.deepEqual(result.data.wallet, { balance: 3, recentEntries: [{ type: "INITIAL_GRANT", delta: 2, balanceAfter: 2, createdAt: "2026-08-01T00:00:00.000Z" }] })
    assert.deepEqual(result.data.ownership, { total: 1, byStatus: { ACTIVE: 1 } })
    assert.doesNotMatch(JSON.stringify(result), /credentialNumber|verificationPayload|providerAccountId|paymentMethod|metadata/i)
  })

  it("loads billing local summaries without payment methods or raw processor payloads", async () => {
    const calls = []
    const result = await getAdminUserDetailSection({ prismaClient: detailPrisma(calls), userId: "user-1", section: "billing" })

    assert.deepEqual(calls, ["user.findUnique:billing"])
    assert.deepEqual(result.data.subscriptions, [{ membershipLevel: "SUPPORTER", status: "active", currentPeriodEnd: "2026-09-01T00:00:00.000Z", cancelAtPeriodEnd: false }])
    assert.deepEqual(result.data.commerce, { orderCount: 4, totalCents: 1200, byStatus: { PAID: 3, REFUNDED: 1 } })
    assert.doesNotMatch(JSON.stringify(result), /stripeCustomerId|stripeSubscriptionId|stripePaymentIntentId|paymentMethod|payload|metadata/i)
  })

  it("loads only the newest fifty safe account activities with linked outcomes and email statuses", async () => {
    const calls = []
    const result = await getAdminUserDetailSection({ prismaClient: detailPrisma(calls), userId: "user-1", section: "activity" })

    assert.deepEqual(calls, ["user.findUnique:activity"])
    assert.deepEqual(result.data.entries, [{
      title: "Access updated",
      explanation: "Your account access changed.",
      effectiveValue: "Supporter",
      occurredAt: "2026-08-08T12:00:00.000Z",
      action: { kind: "ACCESS_UPDATED", outcome: "SUCCEEDED", occurredAt: "2026-08-08T12:00:00.000Z" },
      email: { kind: "ACCOUNT_CHANGED", status: "DELIVERED", deliveredAt: "2026-08-08T12:01:00.000Z" },
    }])
    assert.doesNotMatch(JSON.stringify(result), /internalNote|beforeState|afterState|recipientEmail|message|metadata/i)
  })
})

/** Boundary fake mirrors each real selected relation while rejecting accidental loader calls. */
function detailPrisma(calls) {
  return {
    user: {
      findUnique: async (args) => {
        const select = args.select
        const section = select.accounts ? "security-summary"
          : select.profile ? "overview"
            : select.backgroundCreditWallet ? "access"
              : select.membershipSubscriptions ? "billing"
                : "activity"
        assertSafeSelect(section, select)
        calls.push(`user.findUnique:${section}`)
        return detailRow(section)
      },
    },
    session: { count: async () => { calls.push("session.count"); return 2 } },
  }
}

function assertSafeSelect(section, select) {
  const serialized = JSON.stringify(select)
  if (section === "overview") {
    for (const forbiddenKey of ["membershipSubscriptions", "commerceOrders", "accounts", "sessions", "passwordCredential", "twoFactorSecret", "clinicalArtifactManifests"]) {
      assert.equal(forbiddenKey in select, false)
    }
    assert.deepEqual(Object.keys(select.credentialVerifications.select).sort(), ["displayLabel", "expiresAt", "issuingAuthority", "jurisdictionCode", "kind", "status"])
  }
  if (section === "access") {
    assert.doesNotMatch(serialized, /credentialNumber|verificationPayload|accounts|passwordCredential|twoFactorSecret|commerceOrders|metadata/i)
  }
  if (section === "billing") {
    assert.doesNotMatch(serialized, /payments|stripe|metadata|paymentMethod|accounts|passwordCredential|twoFactorSecret/i)
  }
  if (section === "security-summary") {
    assert.deepEqual(select.accounts.select, { provider: true })
    assert.deepEqual(select.passwordCredential.select, { id: true })
    assert.deepEqual(select.twoFactorSecret.select, { enabledAt: true })
  }
  if (section === "activity") {
    assert.doesNotMatch(serialized, /beforeState|afterState|internalNote|recipientEmail|message|metadata/i)
    assert.equal(select.accountActivities.take, 50)
  }
}

function detailRow(section) {
  const target = { id: "user-1", name: "Avery", email: "avery@example.test" }
  if (section === "security-summary") return { ...target, accounts: [{ provider: "google" }], passwordCredential: { id: "password-1" }, twoFactorSecret: { enabledAt: new Date("2026-08-01T00:00:00.000Z") } }
  if (section === "overview") return {
    ...target, emailVerified: new Date("2026-08-01T00:00:00.000Z"), profile: { displayName: "Avery", therapistName: null, therapistLocation: "Ohio" },
    practiceMemberships: [{ role: "THERAPIST", practice: { id: "practice-1", name: "Massage Lab" } }],
    credentialVerifications: [{ kind: "MASSAGE_LICENSE", status: "VERIFIED", jurisdictionCode: "OH", issuingAuthority: "Ohio board", displayLabel: "Licensed therapist", expiresAt: null }],
    _count: { learningProgress: 4, flashcardStudySessions: 5 },
  }
  if (section === "access") return {
    ...target,
    roles: [{ role: "ADMIN", status: "VERIFIED", source: "manual", verifiedAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: null, revokedAt: null }],
    membershipSubscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z") }],
    studentAccess: null,
    backgroundCreditWallet: { balance: 3, entries: [{ type: "INITIAL_GRANT", delta: 2, balanceAfter: 2, createdAt: new Date("2026-08-01T00:00:00.000Z") }] },
    backgroundOwnerships: [{ status: "ACTIVE" }],
  }
  if (section === "billing") return {
    ...target,
    membershipSubscriptions: [{ membershipLevel: "SUPPORTER", status: "active", currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"), cancelAtPeriodEnd: false }],
    commerceOrders: [{ status: "PAID", totalCents: 1000 }, { status: "PAID", totalCents: 100 }, { status: "PAID", totalCents: 100 }, { status: "REFUNDED", totalCents: 0 }],
  }
  return {
    ...target,
    accountActivities: [{ title: "Access updated", explanation: "Your account access changed.", effectiveValue: "Supporter", occurredAt: new Date("2026-08-08T12:00:00.000Z"), adminAction: { actionKind: "ACCESS_UPDATED", outcome: "SUCCEEDED", occurredAt: new Date("2026-08-08T12:00:00.000Z"), emailIntent: { kind: "ACCOUNT_CHANGED", status: "DELIVERED", deliveredAt: new Date("2026-08-08T12:01:00.000Z") } } }],
  }
}
