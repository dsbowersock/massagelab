import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  ADMIN_USER_DETAIL_SECTIONS,
  getAdminUserDetailSection,
  parseAdminUserDetailSection,
} from "../lib/admin/user-detail.ts"

const detailPageSource = await readFile(new URL("../app/admin/users/[userId]/page.tsx", import.meta.url), "utf8")

describe("admin user detail", () => {
  it("allowlists independently selectable detail sections", () => {
    assert.deepEqual(ADMIN_USER_DETAIL_SECTIONS, ["overview", "access", "billing", "security", "activity"])
    assert.equal(parseAdminUserDetailSection("access"), "access")
    assert.equal(parseAdminUserDetailSection("credentials"), "overview")
  })

  it("rejects boundary-fake selects that match more than one detail section", async () => {
    await assert.rejects(
      () => detailPrisma([]).user.findUnique({ select: { accounts: {}, profile: {} } }),
      /exactly one detail section discriminator/i,
    )
  })

  it("loads security with its summary projection and a session aggregate only", async () => {
    const calls = []
    const now = new Date("2026-08-09T12:00:00.000Z")
    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls, {
        sessionExpiries: [
          new Date("2026-08-09T11:59:59.999Z"),
          now,
          new Date("2026-08-09T12:00:00.001Z"),
        ],
      }),
      userId: "user-1",
      section: "security",
      now,
    })

    assert.deepEqual(calls, [
      "user.findUnique:security-summary",
      { sessionCount: { where: { userId: "user-1", expires: { gt: now } } } },
    ])
    assert.deepEqual(result.target, { id: "user-1", name: "Avery", email: "avery@example.test" })
    assert.deepEqual(result.data, {
      providers: { items: ["google"], total: null, totalState: "UNKNOWN", truncated: true },
      connections: { shown: 1, total: 30, truncated: true },
      emailVerified: true,
      passwordConfigured: true,
      twoFactorEnabled: true,
      authSessionVersion: 3,
      compatibilitySessionCount: 1,
    })
    assert.doesNotMatch(JSON.stringify(result), /sessionToken|providerAccountId|passwordHash|encryptedSecret|codeHash/)
  })

  it("loads overview without billing, authentication, or clinical relationships", async () => {
    const calls = []
    const result = await getAdminUserDetailSection({ prismaClient: detailPrisma(calls), userId: "user-1", section: "overview" })

    assert.deepEqual(calls, ["user.findUnique:overview"])
    assert.deepEqual(result.data, {
      image: "https://images.example.test/avatar.png",
      emailVerified: true,
      profile: { displayName: "Avery", therapistName: null, therapistLocation: "Ohio" },
      practices: {
        items: [{ role: "THERAPIST", practice: { id: "practice-1", name: "Massage Lab" } }],
        total: 30,
        truncated: true,
      },
      credentials: {
        items: [{
          kind: "MASSAGE_LICENSE",
          status: "VERIFIED",
          jurisdictionCode: "OH",
          credentialNumber: "OH-12345",
          issuingAuthority: "Ohio board",
          displayLabel: "Licensed therapist",
          sourceType: "PUBLIC_REGISTRY",
          checkedAt: "2026-08-02T00:00:00.000Z",
          verifiedAt: "2026-08-03T00:00:00.000Z",
          expiresAt: null,
        }],
        total: 26,
        truncated: true,
      },
      learning: { progressCount: 4, studySessionCount: 5, achievementCount: 6 },
    })
    assert.doesNotMatch(JSON.stringify(result), /stripeCustomerId|paymentMethod|sessionToken|providerAccountId|passwordHash|encryptedSecret|SOAP|intake|journal|ROM/i)
  })

  it("loads access with roles, feature sources, credit ledger, and ownership summaries only", async () => {
    const calls = []
    const now = new Date("2026-08-09T00:00:00.000Z")
    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls, { expectedEntitlementNow: now }), userId: "user-1", section: "access", now,
    })

    assert.deepEqual(calls, [
      "user.findUnique:access",
      "membershipSubscription.findMany:entitlements",
      "temporaryFeatureGrant.findMany:entitlements",
    ])
    assert.equal(result.data.emailVerified, true)
    assert.deepEqual(result.data.features, [
      { key: "calendar_basic_scheduling", source: "FREE", expiresAt: null },
      { key: "premium_backgrounds", source: "SUPPORTER", expiresAt: "2026-09-01T00:00:00.000Z" },
    ])
    assert.deepEqual(result.data.featureAccess, [
      { featureKey: "calendar_basic_scheduling", sources: [] },
      {
        featureKey: "premium_backgrounds",
        sources: [
          { source: "membership", expiresAt: "2026-09-01T00:00:00.000Z" },
          { source: "temporary", expiresAt: "2026-09-15T00:00:00.000Z" },
        ],
      },
    ])
    assert.deepEqual(result.data.temporaryGrants, {
      items: [{
        grantId: "grant-1",
        featureKey: "premium_backgrounds",
        startsAt: "2026-08-01T00:00:00.000Z",
        expiresAt: "2026-09-15T00:00:00.000Z",
      }],
      total: 1,
      truncated: false,
    })
    assert.deepEqual(result.data.roles, [
      { role: "ANATOMY_EDITOR", status: "VERIFIED", source: "manual", verifiedAt: "2026-08-02T00:00:00.000Z", expiresAt: null, revokedAt: null },
      { role: "USER", status: "VERIFIED", source: "system", verifiedAt: "2026-08-01T00:00:00.000Z", expiresAt: null, revokedAt: null },
    ])
    assert.deepEqual(result.data.capabilities, {
      canAdministerAccounts: false,
      canManageAnatomyContent: true,
      canManageClients: false,
      canRequestCredentials: true,
      canUseLocalClinicalTools: false,
      canUsePremiumBackgrounds: true,
      hasActiveMembershipBenefits: true,
      hostedClinicalSyncEnabled: false,
    })
    assert.deepEqual(result.data.subscriptions, {
      items: [{ membershipLevel: "SUPPORTER", status: "active", currentPeriodEnd: "2026-09-01T00:00:00.000Z" }],
      total: 30,
      truncated: true,
    })
    assert.deepEqual(result.data.wallet, {
      state: "AVAILABLE",
      balance: 3,
      recentEntries: {
        items: [{ type: "INITIAL_GRANT", delta: 2, balanceAfter: 2, createdAt: "2026-08-01T00:00:00.000Z" }],
        total: 12,
        truncated: true,
      },
    })
    assert.deepEqual(result.data.ownership, {
      items: [{ backgroundKey: "massage-lab-silk", source: "PURCHASE", status: "ACTIVE", acquiredAt: "2026-08-01T00:00:00.000Z", statusChangedAt: "2026-08-01T00:00:00.000Z" }],
      total: 40,
      truncated: true,
    })
    assert.doesNotMatch(JSON.stringify(result), /credentialNumber|verificationPayload|providerAccountId|paymentMethod|metadata|grantedById|internalNote|idempotencyKey/i)
  })

  it("keeps a verified target's missing wallet distinct from an existing zero balance", async () => {
    const calls = []
    const access = detailRow("access")
    access.backgroundCreditWallet = null
    const now = new Date("2026-08-09T00:00:00.000Z")
    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls, { sectionRows: { access }, expectedEntitlementNow: now }),
      userId: "user-1",
      section: "access",
      now,
    })

    assert.equal(result.data.emailVerified, true)
    assert.deepEqual(result.data.wallet, {
      state: "MISSING",
      balance: 0,
      recentEntries: { items: [], total: 0, truncated: false },
    })
  })

  it("derives access from every active subscription candidate, not the capped display slice", async () => {
    const calls = []
    const access = detailRow("access")
    access.membershipSubscriptions = Array.from({ length: 25 }, (_, index) => ({
      status: "canceled",
      membershipLevel: "SUPPORTER",
      currentPeriodEnd: new Date(`2026-08-${String(25 - index).padStart(2, "0")}T00:00:00.000Z`),
    }))
    access._count.membershipSubscriptions = 26
    const now = new Date("2026-08-09T00:00:00.000Z")
    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls, {
        sectionRows: { access },
        entitlementSubscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z") }],
        expectedEntitlementNow: now,
      }),
      userId: "user-1",
      section: "access",
      now,
    })

    assert.equal(result.data.subscriptions.items.length, 25)
    assert.equal(result.data.subscriptions.truncated, true)
    assert.deepEqual(result.data.features.find(({ key }) => key === "premium_backgrounds"), {
      key: "premium_backgrounds", source: "SUPPORTER", expiresAt: "2026-09-01T00:00:00.000Z",
    })
    assert.deepEqual(calls, [
      "user.findUnique:access",
      "membershipSubscription.findMany:entitlements",
      "temporaryFeatureGrant.findMany:entitlements",
    ])
  })

  it("uses every active temporary grant for entitlements while bounding separate Admin evidence", async () => {
    const calls = []
    const now = new Date("2026-08-09T00:00:00.000Z")
    const entitlementTemporaryGrants = Array.from({ length: 30 }, (_, index) => ({
      id: `grant-${String(index).padStart(2, "0")}`,
      featureKey: index === 29 ? "calendar_full_scheduling" : "premium_backgrounds",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date(`2026-09-${String((index % 20) + 1).padStart(2, "0")}T00:00:00.000Z`),
    }))
    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls, { entitlementTemporaryGrants, expectedEntitlementNow: now }),
      userId: "user-1",
      section: "access",
      now,
    })

    assert.equal(result.data.temporaryGrants.items.length, 25)
    assert.equal(result.data.temporaryGrants.total, 30)
    assert.equal(result.data.temporaryGrants.truncated, true)
    assert.equal(result.data.featureAccess.some(({ featureKey }) => featureKey === "calendar_full_scheduling"), true)
    assert.doesNotMatch(JSON.stringify(result.data.temporaryGrants), /grantedById|internalNote|idempotencyKey|reasonCode/i)
  })

  it("loads billing local summaries without payment methods or raw processor payloads", async () => {
    const calls = []
    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls),
      userId: "user-1",
      section: "billing",
      environment: { STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2_monthly" },
    })

    assert.deepEqual(calls, ["user.findUnique:billing"])
    assert.deepEqual(result.data.subscriptions, {
      items: [{
        membershipLevel: "SUPPORTER",
        status: "active",
        currentPeriodEnd: "2026-09-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        lastLocalSyncAt: "2026-08-08T12:00:00.000Z",
        pricing: { state: "KNOWN", amountChoiceId: "support-2", amountCents: 200, interval: "month" },
      }, {
        membershipLevel: "SUPPORTER",
        status: "canceled",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        lastLocalSyncAt: "2026-08-07T12:00:00.000Z",
        pricing: { state: "UNAVAILABLE", amountChoiceId: null, amountCents: null, interval: null },
      }],
      total: 3,
      truncated: true,
    })
    assert.deepEqual(result.data.commerce, {
      totalOrderCount: 120,
      truncated: true,
      recentOrders: [{
        status: "REVIEW_REQUIRED",
        fulfillmentStatus: "PENDING",
        currency: "usd",
        subtotalCents: 100,
        taxCents: 7,
        totalCents: 107,
        failureCode: "TAX_REVIEW",
        createdAt: "2026-08-08T10:00:00.000Z",
        detailHref: "/admin/commerce/order-1",
        reconciliationState: "REVIEW_REQUIRED",
        items: {
          items: [{ displayName: "MassageLab Silk", fulfillmentStatus: "PENDING", lineTotalCents: 107, currency: "usd" }],
          total: 2,
          truncated: true,
        },
        refunds: {
          items: [{ status: "PENDING", amountCents: 107, currency: "usd", reasonCode: "DUPLICATE", failureCode: null, processedAt: null, createdAt: "2026-08-08T11:00:00.000Z" }],
          total: 2,
          truncated: true,
        },
        disputes: {
          items: [{ status: "OPEN", amountCents: 107, currency: "usd", reasonCode: "FRAUDULENT", openedAt: "2026-08-08T11:30:00.000Z", closedAt: null }],
          shown: 1,
          total: 1,
          lowerBound: 1,
          truncated: false,
        },
      }],
    })
    assert.doesNotMatch(JSON.stringify(result), /stripeCustomerId|stripeSubscriptionId|stripePaymentIntentId|paymentMethod|payload|metadata/i)
    assert.doesNotMatch(JSON.stringify(result), /price_supporter_2_monthly|price_legacy_unknown/i)
  })

  it("reports reconciliation as unknown when clean sampled refunds or payments are truncated", async () => {
    const calls = []
    const billing = detailRow("billing")
    const baseOrder = billing.commerceOrders[0]
    const closedRefunds = Array.from({ length: 25 }, (_, index) => ({
      status: "SUCCEEDED", amountCents: 1, currency: "usd", reasonCode: null, failureCode: null,
      processedAt: new Date("2026-08-08T11:00:00.000Z"), createdAt: new Date(1_786_186_800_000 - index),
    }))
    const cleanPayments = Array.from({ length: 10 }, () => ({ disputes: [], _count: { disputes: 0 } }))
    billing.commerceOrders = [{
      ...baseOrder, id: "order-refunds-truncated", status: "COMPLETED", failureCode: null,
      refunds: closedRefunds, payments: [], _count: { items: 1, refunds: 26, payments: 0 },
    }, {
      ...baseOrder, id: "order-payments-truncated", status: "COMPLETED", failureCode: null,
      refunds: [], payments: cleanPayments, _count: { items: 1, refunds: 0, payments: 26 },
    }]
    billing._count.commerceOrders = 2

    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls, { sectionRows: { billing } }), userId: "user-1", section: "billing", environment: {},
    })

    assert.deepEqual(result.data.commerce.recentOrders.map((order) => order.reconciliationState), ["UNKNOWN", "UNKNOWN"])
    assert.deepEqual(result.data.commerce.recentOrders[1].disputes, {
      items: [], shown: 0, total: null, lowerBound: 0, truncated: true,
    })
  })

  it("keeps an exact dispute total while labeling nested dispute truncation", async () => {
    const calls = []
    const billing = detailRow("billing")
    const order = billing.commerceOrders[0]
    const sampledDisputes = Array.from({ length: 10 }, (_, index) => ({
      status: "CLOSED", amountCents: 1, currency: "usd", reasonCode: null,
      openedAt: new Date(1_786_188_600_000 - index), closedAt: new Date("2026-08-08T12:00:00.000Z"),
    }))
    const sampledPayments = [{ disputes: sampledDisputes, _count: { disputes: 26 } }]
    billing.commerceOrders = [{
      ...order, status: "COMPLETED", failureCode: null, refunds: [], payments: sampledPayments,
      _count: { items: 1, refunds: 0, payments: 1 },
    }]
    billing._count.commerceOrders = 1

    const result = await getAdminUserDetailSection({
      prismaClient: detailPrisma(calls, { sectionRows: { billing } }), userId: "user-1", section: "billing", environment: {},
    })

    assert.deepEqual(result.data.commerce.recentOrders[0].disputes, {
      items: sampledDisputes.map((dispute) => ({
        ...dispute,
        openedAt: dispute.openedAt.toISOString(),
        closedAt: dispute.closedAt.toISOString(),
      })),
      shown: 10,
      total: 26,
      lowerBound: 26,
      truncated: true,
    })
    assert.equal(result.data.commerce.recentOrders[0].reconciliationState, "UNKNOWN")
  })

  it("loads only the newest fifty safe account activities with linked outcomes and email statuses", async () => {
    const calls = []
    const result = await getAdminUserDetailSection({ prismaClient: detailPrisma(calls), userId: "user-1", section: "activity" })

    assert.deepEqual(calls, ["user.findUnique:activity"])
    assert.deepEqual(result.data.entries, [{
      id: "activity-1",
      title: "Access updated",
      explanation: "Your account access changed.",
      effectiveValue: "Supporter",
      occurredAt: "2026-08-08T12:00:00.000Z",
      action: { kind: "ACCESS_UPDATED", outcome: "SUCCEEDED", occurredAt: "2026-08-08T12:00:00.000Z" },
      email: {
        intentId: "intent-1",
        kind: "ACCOUNT_CHANGED",
        status: "DELIVERED",
        failureCode: null,
        attemptCount: 1,
        lastAttemptAt: "2026-08-08T12:01:00.000Z",
        deliveredAt: "2026-08-08T12:01:00.000Z",
      },
    }])
    assert.doesNotMatch(JSON.stringify(result), /internalNote|beforeState|afterState|recipientEmail|message|metadata/i)
  })

  it("renders the approved safe detail summaries and commerce destinations", () => {
    assert.match(detailPageSource, /Profile image/)
    assert.match(detailPageSource, /Achievement count/)
    assert.match(detailPageSource, /Effective capabilities/)
    assert.match(detailPageSource, /Recent commerce orders/)
    assert.match(detailPageSource, /Connection rows/)
    assert.match(detailPageSource, /Review order/)
  })
})

/** Boundary fake mirrors each real selected relation while rejecting accidental loader calls. */
function detailPrisma(calls, {
  entitlementSubscriptions = detailRow("access").membershipSubscriptions,
  entitlementTemporaryGrants = [{
    id: "grant-1",
    featureKey: "premium_backgrounds",
    startsAt: new Date("2026-08-01T00:00:00.000Z"),
    expiresAt: new Date("2026-09-15T00:00:00.000Z"),
  }],
  expectedEntitlementNow,
  sessionExpiries = [],
  sectionRows = {},
} = {}) {
  return {
    user: {
      findUnique: async (args) => {
        const select = args.select
        const sections = [
          ["security-summary", Boolean(select.accounts)],
          ["overview", Boolean(select.profile)],
          ["access", Boolean(select.backgroundCreditWallet)],
          ["billing", Boolean(select.commerceOrders)],
          ["activity", Boolean(select.accountActivities)],
        ].filter(([, matches]) => matches)
        assert.equal(sections.length, 1, "Select must match exactly one detail section discriminator.")
        const section = sections[0][0]
        assertSafeSelect(section, select)
        calls.push(`user.findUnique:${section}`)
        return sectionRows[section] ?? detailRow(section)
      },
    },
    membershipSubscription: {
      findMany: async (args) => {
        assert.deepEqual(args.where, {
          userId: "user-1",
          status: { in: ["active", "trialing"] },
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: expectedEntitlementNow } }],
        })
        assert.deepEqual(args.select, { status: true, membershipLevel: true, currentPeriodEnd: true })
        assert.deepEqual(args.orderBy, [{ currentPeriodEnd: "desc" }, { id: "desc" }])
        assert.equal("take" in args, false)
        calls.push("membershipSubscription.findMany:entitlements")
        return entitlementSubscriptions
      },
    },
    temporaryFeatureGrant: {
      findMany: async (args) => {
        assert.deepEqual(args.where, {
          userId: "user-1",
          featureKey: { in: [
            "premium_backgrounds",
            "therapist_documentation_tools",
            "calendar_basic_scheduling",
            "calendar_full_scheduling",
            "external_calendar_sync",
          ] },
          startsAt: { lte: expectedEntitlementNow },
          expiresAt: { gt: expectedEntitlementNow },
          revocation: null,
        })
        assert.deepEqual(args.select, { id: true, featureKey: true, startsAt: true, expiresAt: true })
        assert.deepEqual(args.orderBy, [{ expiresAt: "asc" }, { id: "asc" }])
        assert.equal(args.take, 501)
        calls.push("temporaryFeatureGrant.findMany:entitlements")
        return entitlementTemporaryGrants
      },
    },
    session: { count: async (args) => {
      calls.push({ sessionCount: args })
      const boundary = args.where.expires?.gt
      return boundary
        ? sessionExpiries.filter((expires) => expires.getTime() > boundary.getTime()).length
        : sessionExpiries.length
    } },
  }
}

function assertSafeSelect(section, select) {
  const serialized = JSON.stringify(select)
  if (section === "overview") {
    for (const forbiddenKey of ["membershipSubscriptions", "commerceOrders", "accounts", "sessions", "passwordCredential", "twoFactorSecret", "clinicalArtifactManifests"]) {
      assert.equal(forbiddenKey in select, false)
    }
    assert.deepEqual(select.practiceMemberships.orderBy, [{ createdAt: "desc" }, { id: "desc" }])
    assert.equal(select.practiceMemberships.take, 25)
    assert.deepEqual(select.credentialVerifications.orderBy, [{ updatedAt: "desc" }, { id: "desc" }])
    assert.equal(select.credentialVerifications.take, 25)
    assert.deepEqual(Object.keys(select.credentialVerifications.select).sort(), ["checkedAt", "credentialNumber", "displayLabel", "expiresAt", "issuingAuthority", "jurisdictionCode", "kind", "sourceType", "status", "verifiedAt"])
    assert.deepEqual(select._count.select, { learningProgress: true, flashcardStudySessions: true, achievements: true, practiceMemberships: true, credentialVerifications: true })
  }
  if (section === "access") {
    assert.doesNotMatch(serialized, /credentialNumber|verificationPayload|accounts|passwordCredential|twoFactorSecret|commerceOrders|metadata/i)
    assert.deepEqual(select.membershipSubscriptions.orderBy, [{ updatedAt: "desc" }, { id: "desc" }])
    assert.equal(select.membershipSubscriptions.take, 25)
    assert.deepEqual(select.backgroundOwnerships.orderBy, [{ acquiredAt: "desc" }, { id: "desc" }])
    assert.equal(select.backgroundOwnerships.take, 25)
    assert.deepEqual(select.backgroundCreditWallet.select.entries.orderBy, [{ createdAt: "desc" }, { id: "desc" }])
    assert.equal(select.backgroundCreditWallet.select.entries.take, 10)
    assert.deepEqual(select.backgroundCreditWallet.select._count.select, { entries: true })
    assert.deepEqual(select._count.select, { membershipSubscriptions: true, backgroundOwnerships: true })
  }
  if (section === "billing") {
    assert.doesNotMatch(serialized, /stripeCustomerId|stripeSubscriptionId|stripePaymentIntentId|paymentMethod|metadata|accounts|passwordCredential|twoFactorSecret/i)
    assert.deepEqual(select.membershipSubscriptions.where, { membershipLevel: "SUPPORTER" })
    assert.deepEqual(select.membershipSubscriptions.orderBy, [{ updatedAt: "desc" }, { id: "desc" }])
    assert.equal(select.membershipSubscriptions.take, 25)
    assert.deepEqual(select.commerceOrders.orderBy, [{ createdAt: "desc" }, { id: "desc" }])
    assert.equal(select.commerceOrders.take, 25)
    assert.deepEqual(select.commerceOrders.select.payments.orderBy, [{ createdAt: "desc" }, { id: "desc" }])
    assert.equal(select.commerceOrders.select.payments.take, 10)
    assert.deepEqual(select.commerceOrders.select.payments.select.disputes.orderBy, [{ openedAt: "desc" }, { id: "desc" }])
    assert.equal(select.commerceOrders.select.payments.select.disputes.take, 10)
    assert.deepEqual(select.commerceOrders.select._count.select, { items: true, refunds: true, payments: true })
    assert.deepEqual(select._count.select, { membershipSubscriptions: { where: { membershipLevel: "SUPPORTER" } }, commerceOrders: true })
  }
  if (section === "security-summary") {
    assert.equal(select.emailVerified, true)
    assert.equal(select.authSessionVersion, true)
    assert.deepEqual(select.accounts.select, { provider: true })
    assert.deepEqual(select.accounts.orderBy, [{ provider: "asc" }, { id: "asc" }])
    assert.equal(select.accounts.take, 25)
    assert.deepEqual(select._count.select, { accounts: true })
    assert.deepEqual(select.passwordCredential.select, { id: true })
    assert.deepEqual(select.twoFactorSecret.select, { enabledAt: true })
  }
  if (section === "activity") {
    assert.doesNotMatch(serialized, /beforeState|afterState|internalNote|recipientEmail|message|metadata/i)
    assert.deepEqual(select.accountActivities.select.adminAction.select.emailIntent.select, {
      id: true, kind: true, status: true, failureCode: true, attemptCount: true, lastAttemptAt: true, deliveredAt: true,
    })
    assert.equal(select.accountActivities.select.id, true)
    assert.deepEqual(select.accountActivities.orderBy, [{ occurredAt: "desc" }, { id: "desc" }])
    assert.equal(select.accountActivities.take, 50)
  }
}

function detailRow(section) {
  const target = { id: "user-1", name: "Avery", email: "avery@example.test" }
  if (section === "security-summary") return { ...target, emailVerified: new Date("2026-08-01T00:00:00.000Z"), authSessionVersion: 3, accounts: [{ provider: "google" }], passwordCredential: { id: "password-1" }, twoFactorSecret: { enabledAt: new Date("2026-08-01T00:00:00.000Z") }, _count: { accounts: 30 } }
  if (section === "overview") return {
    ...target, image: "https://images.example.test/avatar.png", emailVerified: new Date("2026-08-01T00:00:00.000Z"), profile: { displayName: "Avery", therapistName: null, therapistLocation: "Ohio" },
    practiceMemberships: [{ role: "THERAPIST", practice: { id: "practice-1", name: "Massage Lab" } }],
    credentialVerifications: [{ kind: "MASSAGE_LICENSE", status: "VERIFIED", jurisdictionCode: "OH", credentialNumber: "OH-12345", issuingAuthority: "Ohio board", displayLabel: "Licensed therapist", sourceType: "PUBLIC_REGISTRY", checkedAt: new Date("2026-08-02T00:00:00.000Z"), verifiedAt: new Date("2026-08-03T00:00:00.000Z"), expiresAt: null }],
    _count: { learningProgress: 4, flashcardStudySessions: 5, achievements: 6, practiceMemberships: 30, credentialVerifications: 26 },
  }
  if (section === "access") return {
    ...target, emailVerified: new Date("2026-08-01T00:00:00.000Z"),
    roles: [
      { role: "ANATOMY_ADMIN", status: "VERIFIED", source: "legacy-migration", verifiedAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: null, revokedAt: null },
      { role: "ANATOMY_EDITOR", status: "VERIFIED", source: "manual", verifiedAt: new Date("2026-08-02T00:00:00.000Z"), expiresAt: null, revokedAt: null },
      { role: "USER", status: "VERIFIED", source: "system", verifiedAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: null, revokedAt: null },
    ],
    membershipSubscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z") }],
    studentAccess: null,
    backgroundCreditWallet: { balance: 3, entries: [{ type: "INITIAL_GRANT", delta: 2, balanceAfter: 2, createdAt: new Date("2026-08-01T00:00:00.000Z") }], _count: { entries: 12 } },
    backgroundOwnerships: [{ backgroundKey: "massage-lab-silk", source: "PURCHASE", status: "ACTIVE", acquiredAt: new Date("2026-08-01T00:00:00.000Z"), statusChangedAt: new Date("2026-08-01T00:00:00.000Z") }],
    _count: { membershipSubscriptions: 30, backgroundOwnerships: 40 },
  }
  if (section === "billing") return {
    ...target,
    membershipSubscriptions: [
      { membershipLevel: "SUPPORTER", status: "active", stripePriceId: "price_supporter_2_monthly", currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"), cancelAtPeriodEnd: false, updatedAt: new Date("2026-08-08T12:00:00.000Z") },
      { membershipLevel: "SUPPORTER", status: "canceled", stripePriceId: "price_legacy_unknown", currentPeriodEnd: null, cancelAtPeriodEnd: false, updatedAt: new Date("2026-08-07T12:00:00.000Z") },
    ],
    commerceOrders: [{
      id: "order-1", status: "REVIEW_REQUIRED", fulfillmentStatus: "PENDING", currency: "usd", subtotalCents: 100, taxCents: 7, totalCents: 107, failureCode: "TAX_REVIEW", createdAt: new Date("2026-08-08T10:00:00.000Z"),
      items: [{ displayName: "MassageLab Silk", fulfillmentStatus: "PENDING", lineTotalCents: 107, currency: "usd" }],
      refunds: [{ status: "PENDING", amountCents: 107, currency: "usd", reasonCode: "DUPLICATE", failureCode: null, processedAt: null, createdAt: new Date("2026-08-08T11:00:00.000Z") }],
      payments: [{ disputes: [{ status: "OPEN", amountCents: 107, currency: "usd", reasonCode: "FRAUDULENT", openedAt: new Date("2026-08-08T11:30:00.000Z"), closedAt: null }], _count: { disputes: 1 } }],
      _count: { items: 2, refunds: 2, payments: 1 },
    }],
    _count: { membershipSubscriptions: 3, commerceOrders: 120 },
  }
  return {
    ...target,
    accountActivities: [{ id: "activity-1", title: "Access updated", explanation: "Your account access changed.", effectiveValue: "Supporter", occurredAt: new Date("2026-08-08T12:00:00.000Z"), adminAction: { actionKind: "ACCESS_UPDATED", outcome: "SUCCEEDED", occurredAt: new Date("2026-08-08T12:00:00.000Z"), emailIntent: { id: "intent-1", kind: "ACCOUNT_CHANGED", status: "DELIVERED", failureCode: null, attemptCount: 1, lastAttemptAt: new Date("2026-08-08T12:01:00.000Z"), deliveredAt: new Date("2026-08-08T12:01:00.000Z") } } }],
  }
}
