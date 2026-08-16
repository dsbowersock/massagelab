import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  FEATURE_KEYS,
  SUPPORTER_AMOUNT_CHOICES,
  STUDENT_ACCESS_MONTHS,
  buildCheckoutSessionPayload,
  buildEntitlements,
  buildStudentAccessState,
  isActiveSubscriptionStatus,
  isPublicSupporterCheckoutSelection,
  resolveStripePriceId,
  sortMembershipSubscriptionsForDisplay,
  supporterPriceEnvironmentKey,
} from "../lib/membership.js"
import * as membership from "../lib/membership.js"

const membershipSource = await readFile(new URL("../lib/membership.js", import.meta.url), "utf8")
const authUsersSource = await readFile(new URL("../lib/auth-users.ts", import.meta.url), "utf8")

describe("Membership and entitlement helpers", () => {
  it("documents the complete-candidate provenance and actual entitlement precedence contract", () => {
    assert.match(membershipSource, /complete active-subscription candidate set/i)
    assert.match(membershipSource, /PRACTICE > THERAPIST > SUPPORTER/)
    assert.match(membershipSource, /FREE baseline feature always reports/i)
    assert.match(membershipSource, /inherits paid or student provenance/i)
    assert.match(membershipSource, /@returns[^]*featureDetails/)
  })

  it("keeps free users on basic Chimer while allowing a basic calendar taste", () => {
    const entitlements = buildEntitlements({ subscriptions: [], studentAccess: null })

    assert.equal(entitlements.level, "FREE")
    assert.deepEqual(entitlements.features, [FEATURE_KEYS.calendarBasicScheduling])
    assert.equal(entitlements.hasFeature(FEATURE_KEYS.premiumBackgrounds), false)
    assert.equal(membership.hasPremiumBackgroundAccess(entitlements.features), false)
    assert.equal(entitlements.hasFeature(FEATURE_KEYS.calendarBasicScheduling), true)
    assert.equal(entitlements.hasFeature(FEATURE_KEYS.calendarFullScheduling), false)
  })

  it("owns FREE baseline feature provenance without an expiry", () => {
    const entitlements = buildEntitlements({ subscriptions: [], studentAccess: null })

    assert.deepEqual(entitlements.featureDetails, [
      { key: FEATURE_KEYS.calendarBasicScheduling, source: "FREE", expiresAt: null },
    ])
  })

  it("owns Supporter-only feature provenance at the active Supporter source and expiry", () => {
    const currentPeriodEnd = new Date("2026-09-01T00:00:00.000Z")
    const entitlements = buildEntitlements({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd }],
      now: new Date("2026-08-09T00:00:00.000Z"),
    })

    assert.deepEqual(entitlements.featureDetails, [
      { key: FEATURE_KEYS.calendarBasicScheduling, source: "FREE", expiresAt: null },
      { key: FEATURE_KEYS.premiumBackgrounds, source: "SUPPORTER", expiresAt: currentPeriodEnd },
    ])
  })

  it("captures one auth-request time and resolves complete temporary candidates through the shared loader", () => {
    assert.match(authUsersSource, /buildEntitlements, loadActiveTemporaryGrants/)
    assert.match(authUsersSource, /const now = new Date\(\)/)
    assert.match(authUsersSource, /loadActiveTemporaryGrants\(prisma, userId, now\)/)
    assert.match(
      authUsersSource,
      /features:\s*buildEntitlements\(\{\s*adminAccess,\s*subscriptions:\s*user\?\.membershipSubscriptions \?\? \[\],\s*studentAccess:\s*user\?\.studentAccess \?\? null,\s*temporaryGrants,\s*now,\s*\}\)\.features/,
    )
    assert.doesNotMatch(authUsersSource, /temporaryFeatureGrant[\s\S]*take:/)
  })

  it("grants one active temporary feature and records its request-time expiration source", () => {
    const entitlements = buildEntitlements({
      subscriptions: [],
      temporaryGrants: [{
        featureKey: FEATURE_KEYS.premiumBackgrounds,
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        revocation: null,
      }],
      now: new Date("2026-08-08T00:00:00.000Z"),
    })

    assert.deepEqual(entitlements.features, [
      FEATURE_KEYS.calendarBasicScheduling,
      FEATURE_KEYS.premiumBackgrounds,
    ])
    assert.deepEqual(entitlements.featureAccess.find(({ featureKey }) => featureKey === FEATURE_KEYS.premiumBackgrounds), {
      featureKey: FEATURE_KEYS.premiumBackgrounds,
      sources: [{ source: "temporary", expiresAt: "2026-09-01T00:00:00.000Z" }],
    })
  })

  it("fails closed when an explicit entitlement evaluation boundary is not a valid Date", () => {
    const temporaryGrants = [{
      featureKey: FEATURE_KEYS.premiumBackgrounds,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      revocation: null,
    }]

    for (const now of [new Date("invalid"), "2026-08-08T00:00:00.000Z", null]) {
      assert.throws(() => buildEntitlements({ temporaryGrants, now }), /evaluation time must be a valid Date/i)
    }
  })

  it("rejects expired, future, revoked, malformed, and excluded temporary grants", () => {
    const now = new Date("2026-08-08T00:00:00.000Z")
    const entitlements = buildEntitlements({
      subscriptions: null,
      temporaryGrants: [
        { featureKey: FEATURE_KEYS.premiumBackgrounds, startsAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: now, revocation: null },
        { featureKey: FEATURE_KEYS.premiumBackgrounds, startsAt: new Date("2026-08-08T00:00:00.001Z"), expiresAt: new Date("2026-09-01T00:00:00.000Z"), revocation: null },
        { featureKey: FEATURE_KEYS.premiumBackgrounds, startsAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: new Date("2026-09-01T00:00:00.000Z"), revocation: { id: "revocation-1" } },
        { featureKey: "chimer_custom_colors", startsAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: new Date("2026-09-01T00:00:00.000Z"), revocation: null },
        { featureKey: FEATURE_KEYS.practiceManagement, startsAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: new Date("2026-09-01T00:00:00.000Z"), revocation: null },
        null,
        {},
      ],
      now,
    })

    assert.deepEqual(entitlements.features, [FEATURE_KEYS.calendarBasicScheduling])
    assert.equal(entitlements.featureAccess.some(({ sources }) => sources.length > 0), false)
    assert.deepEqual(buildEntitlements({ subscriptions: null, temporaryGrants: null }).features, [
      FEATURE_KEYS.calendarBasicScheduling,
    ])
  })

  it("uses one valid Date boundary for startsAt equality, expiresAt equality, and source precedence", () => {
    const now = new Date("2026-08-08T00:00:00.000Z")
    const membershipExpiry = new Date("2026-10-01T00:00:00.000Z")
    const entitlements = buildEntitlements({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: membershipExpiry }],
      temporaryGrants: [{
        featureKey: FEATURE_KEYS.premiumBackgrounds,
        startsAt: now,
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        revocation: null,
      }, {
        featureKey: FEATURE_KEYS.premiumBackgrounds,
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt: now,
        revocation: null,
      }],
      now,
    })

    assert.deepEqual(entitlements.featureAccess.find(({ featureKey }) => featureKey === FEATURE_KEYS.premiumBackgrounds), {
      featureKey: FEATURE_KEYS.premiumBackgrounds,
      sources: [
        { source: "membership", expiresAt: "2026-10-01T00:00:00.000Z" },
        { source: "temporary", expiresAt: "2026-09-01T00:00:00.000Z" },
      ],
    })
    assert.deepEqual(entitlements.featureDetails.find(({ key }) => key === FEATURE_KEYS.premiumBackgrounds), {
      key: FEATURE_KEYS.premiumBackgrounds,
      source: "SUPPORTER",
      expiresAt: membershipExpiry,
    })
    assert.equal(now.toISOString(), "2026-08-08T00:00:00.000Z")
  })

  it("retains two overlapping temporary sources in deterministic expiration order", () => {
    const grants = [{
      featureKey: FEATURE_KEYS.calendarFullScheduling,
      startsAt: new Date("2026-08-02T00:00:00.000Z"),
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      revocation: null,
    }, {
      featureKey: FEATURE_KEYS.calendarFullScheduling,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      revocation: null,
    }]
    const expected = {
      featureKey: FEATURE_KEYS.calendarFullScheduling,
      sources: [
        { source: "temporary", expiresAt: "2026-09-01T00:00:00.000Z" },
        { source: "temporary", expiresAt: "2026-10-01T00:00:00.000Z" },
      ],
    }

    for (const temporaryGrants of [grants, [...grants].reverse()]) {
      const entitlements = buildEntitlements({
        temporaryGrants,
        now: new Date("2026-08-08T00:00:00.000Z"),
      })
      assert.deepEqual(entitlements.featureAccess.find(({ featureKey }) => featureKey === FEATURE_KEYS.calendarFullScheduling), expected)
      assert.equal(entitlements.features.filter((featureKey) => featureKey === FEATURE_KEYS.calendarFullScheduling).length, 1)
    }

    const oneSourceEnded = buildEntitlements({
      temporaryGrants: [
        { ...grants[0], revocation: null },
        { ...grants[1], revocation: { id: "revocation-1" } },
      ],
      now: new Date("2026-08-08T00:00:00.000Z"),
    })
    assert.equal(oneSourceEnded.hasFeature(FEATURE_KEYS.calendarFullScheduling), true)
    assert.deepEqual(oneSourceEnded.featureAccess.find(({ featureKey }) => featureKey === FEATURE_KEYS.calendarFullScheduling)?.sources, [
      { source: "temporary", expiresAt: "2026-10-01T00:00:00.000Z" },
    ])
  })

  it("deduplicates exact feature sources while retaining distinct expiries and source kinds independent of input order", () => {
    const membershipExpiry = new Date("2026-10-01T00:00:00.000Z")
    const laterMembershipExpiry = new Date("2026-11-01T00:00:00.000Z")
    const temporaryExpiry = new Date("2026-10-01T00:00:00.000Z")
    const laterTemporaryExpiry = new Date("2026-12-01T00:00:00.000Z")
    const subscriptions = [
      { status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: membershipExpiry },
      { status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: membershipExpiry },
      { status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: laterMembershipExpiry },
    ]
    const temporaryGrants = [
      { featureKey: FEATURE_KEYS.premiumBackgrounds, startsAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: temporaryExpiry, revocation: null },
      { featureKey: FEATURE_KEYS.premiumBackgrounds, startsAt: new Date("2026-08-02T00:00:00.000Z"), expiresAt: temporaryExpiry, revocation: null },
      { featureKey: FEATURE_KEYS.premiumBackgrounds, startsAt: new Date("2026-08-03T00:00:00.000Z"), expiresAt: laterTemporaryExpiry, revocation: null },
    ]
    const expected = [
      { source: "membership", expiresAt: "2026-10-01T00:00:00.000Z" },
      { source: "membership", expiresAt: "2026-11-01T00:00:00.000Z" },
      { source: "temporary", expiresAt: "2026-10-01T00:00:00.000Z" },
      { source: "temporary", expiresAt: "2026-12-01T00:00:00.000Z" },
    ]

    for (const [orderedSubscriptions, orderedTemporaryGrants] of [
      [subscriptions, temporaryGrants],
      [[...subscriptions].reverse(), [...temporaryGrants].reverse()],
    ]) {
      const entitlements = buildEntitlements({
        subscriptions: orderedSubscriptions,
        temporaryGrants: orderedTemporaryGrants,
        now: new Date("2026-08-08T00:00:00.000Z"),
      })
      assert.deepEqual(
        entitlements.featureAccess.find(({ featureKey }) => featureKey === FEATURE_KEYS.premiumBackgrounds)?.sources,
        expected,
      )
    }
  })

  it("keeps baseline provenance FREE while active Student status remains separately visible", () => {
    const entitlements = buildEntitlements({
      studentAccess: {
        studentStatus: "ACTIVE",
        studentAccessExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
      },
      now: new Date("2026-08-09T00:00:00.000Z"),
    })

    assert.equal(entitlements.level, "STUDENT")
    assert.equal(entitlements.studentStatus, "ACTIVE")
    assert.deepEqual(entitlements.featureDetails, [
      { key: FEATURE_KEYS.calendarBasicScheduling, source: "FREE", expiresAt: null },
    ])
  })

  it("selects an actual feature-specific source across multiple active paid memberships", () => {
    const supporterEnd = new Date("2026-10-01T00:00:00.000Z")
    const therapistEnd = new Date("2026-09-01T00:00:00.000Z")
    const entitlements = buildEntitlements({
      subscriptions: [
        { status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: supporterEnd },
        { status: "trialing", membershipLevel: "THERAPIST", currentPeriodEnd: therapistEnd },
      ],
      now: new Date("2026-08-09T00:00:00.000Z"),
    })

    assert.equal(entitlements.paidLevel, "THERAPIST")
    assert.deepEqual(entitlements.featureDetails, [
      { key: FEATURE_KEYS.calendarBasicScheduling, source: "FREE", expiresAt: null },
      { key: FEATURE_KEYS.premiumBackgrounds, source: "SUPPORTER", expiresAt: supporterEnd },
      { key: FEATURE_KEYS.therapistDocumentationTools, source: "THERAPIST", expiresAt: therapistEnd },
      { key: FEATURE_KEYS.calendarFullScheduling, source: "THERAPIST", expiresAt: therapistEnd },
      { key: FEATURE_KEYS.externalCalendarSync, source: "THERAPIST", expiresAt: therapistEnd },
    ])
  })

  it("does not issue the retired custom-color entitlement", () => {
    const active = buildEntitlements({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER" }],
    })

    assert.deepEqual(active.features, [
      FEATURE_KEYS.calendarBasicScheduling,
      FEATURE_KEYS.premiumBackgrounds,
    ])
    assert.equal(active.features.includes("chimer_custom_colors"), false)
  })

  it("grants documentation tools and calendar scheduling depth to Therapist and Team/Practice memberships", () => {
    const active = buildEntitlements({
      subscriptions: [
        {
          status: "active",
          membershipLevel: "THERAPIST",
          currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
      now: new Date("2026-05-15T00:00:00.000Z"),
    })
    const pastDue = buildEntitlements({
      subscriptions: [{ status: "past_due", membershipLevel: "THERAPIST" }],
      now: new Date("2026-05-15T00:00:00.000Z"),
    })
    const canceled = buildEntitlements({
      subscriptions: [{ status: "canceled", membershipLevel: "SUPPORTER" }],
      now: new Date("2026-05-15T00:00:00.000Z"),
    })
    const teamPractice = buildEntitlements({
      subscriptions: [{ status: "active", membershipLevel: "PRACTICE" }],
      now: new Date("2026-05-15T00:00:00.000Z"),
    })

    assert.equal(active.level, "THERAPIST")
    assert.equal(active.hasFeature(FEATURE_KEYS.premiumBackgrounds), true)
    assert.equal(active.hasFeature(FEATURE_KEYS.therapistDocumentationTools), true)
    assert.equal(active.hasFeature(FEATURE_KEYS.calendarFullScheduling), true)
    assert.equal(active.hasFeature(FEATURE_KEYS.externalCalendarSync), true)
    assert.equal(active.hasFeature(FEATURE_KEYS.calendarTeamScheduling), false)
    assert.equal(teamPractice.hasFeature(FEATURE_KEYS.therapistDocumentationTools), true)
    assert.equal(teamPractice.hasFeature(FEATURE_KEYS.calendarFullScheduling), true)
    assert.equal(teamPractice.hasFeature(FEATURE_KEYS.externalCalendarSync), true)
    assert.equal(teamPractice.hasFeature(FEATURE_KEYS.calendarTeamScheduling), true)
    assert.equal(pastDue.level, "FREE")
    assert.equal(pastDue.hasFeature(FEATURE_KEYS.therapistDocumentationTools), false)
    assert.equal(pastDue.hasFeature(FEATURE_KEYS.premiumBackgrounds), false)
    assert.equal(canceled.level, "FREE")
    assert.equal(canceled.hasFeature(FEATURE_KEYS.therapistDocumentationTools), false)
    assert.equal(isActiveSubscriptionStatus("trialing"), true)
    assert.equal(isActiveSubscriptionStatus("incomplete"), false)
  })

  it("grants verified full admins the maximum current non-PHI features without inventing a paid membership", () => {
    const entitlements = buildEntitlements({
      adminAccess: true,
      subscriptions: [],
      studentAccess: null,
      temporaryGrants: [],
      now: new Date("2026-08-16T00:00:00.000Z"),
    })

    assert.equal(entitlements.level, "FREE")
    assert.equal(entitlements.paidLevel, null)
    assert.deepEqual(entitlements.features, [
      FEATURE_KEYS.calendarBasicScheduling,
      FEATURE_KEYS.premiumBackgrounds,
      FEATURE_KEYS.therapistDocumentationTools,
      FEATURE_KEYS.calendarFullScheduling,
      FEATURE_KEYS.externalCalendarSync,
      FEATURE_KEYS.calendarTeamScheduling,
    ])
    for (const featureKey of entitlements.features.slice(1)) {
      assert.deepEqual(entitlements.featureAccess.find((entry) => entry.featureKey === featureKey)?.sources, [
        { source: "admin", expiresAt: null },
      ])
    }
    for (const restrictedFeature of [FEATURE_KEYS.cloudStorage, FEATURE_KEYS.phiStorageTools]) {
      assert.equal(entitlements.hasFeature(restrictedFeature), false)
    }
  })

  it("keeps permanent Admin detail provenance when temporary access overlaps", () => {
    const expiresAt = new Date("2026-09-15T00:00:00.000Z")
    const entitlements = buildEntitlements({
      adminAccess: true,
      subscriptions: [],
      studentAccess: null,
      temporaryGrants: [{
        featureKey: FEATURE_KEYS.premiumBackgrounds,
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt,
        revocation: null,
      }],
      now: new Date("2026-08-16T00:00:00.000Z"),
    })

    assert.deepEqual(entitlements.featureDetails.find(({ key }) => key === FEATURE_KEYS.premiumBackgrounds), {
      key: FEATURE_KEYS.premiumBackgrounds,
      source: "ADMIN",
      expiresAt: null,
    })
    assert.deepEqual(entitlements.featureAccess.find(({ featureKey }) => featureKey === FEATURE_KEYS.premiumBackgrounds)?.sources, [
      { source: "admin", expiresAt: null },
      { source: "temporary", expiresAt: expiresAt.toISOString() },
    ])
  })

  it("loads administrative feature access only from a freshly verified full-admin database role", async () => {
    const roleQueries = []
    const state = await membership.getUserEntitlementState({
      membershipSubscription: { findMany: async () => [] },
      studentAccess: { findUnique: async () => null },
      temporaryFeatureGrant: { findMany: async () => [] },
      userRole: {
        findFirst: async (query) => {
          roleQueries.push(query)
          return { id: "admin-role-1" }
        },
      },
    }, "owner-user", new Date("2026-08-16T00:00:00.000Z"))

    assert.deepEqual(roleQueries, [{
      where: { userId: "owner-user", role: "ADMIN", status: "VERIFIED" },
      select: { id: true },
    }])
    assert.equal(state.paidLevel, null)
    assert.equal(state.hasFeature(FEATURE_KEYS.premiumBackgrounds), true)
    assert.equal(state.hasFeature(FEATURE_KEYS.calendarTeamScheduling), true)
    assert.equal(state.hasFeature(FEATURE_KEYS.phiStorageTools), false)
  })

  it("does not unlock professional features for an active supporter subscription or student access", () => {
    const supporter = buildEntitlements({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER" }],
      now: new Date("2026-05-15T00:00:00.000Z"),
    })
    const student = buildEntitlements({
      studentAccess: {
        studentStatus: "ACTIVE",
        studentAccessExpiresAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      now: new Date("2026-05-15T00:00:00.000Z"),
    })

    assert.equal(supporter.hasFeature(FEATURE_KEYS.premiumBackgrounds), true)
    for (const featureKey of [
      FEATURE_KEYS.therapistDocumentationTools,
      FEATURE_KEYS.calendarFullScheduling,
      FEATURE_KEYS.externalCalendarSync,
      FEATURE_KEYS.calendarTeamScheduling,
    ]) {
      assert.equal(supporter.hasFeature(featureKey), false)
    }
    assert.equal(student.level, "STUDENT")
    assert.equal(student.hasFeature(FEATURE_KEYS.therapistDocumentationTools), false)
    assert.equal(student.hasFeature(FEATURE_KEYS.externalCalendarSync), false)
  })

  it("models internal student access without requiring Stripe", () => {
    const state = buildStudentAccessState({
      studentStartDate: new Date("2026-01-10T00:00:00.000Z"),
      now: new Date("2027-07-09T23:59:59.000Z"),
    })
    const expired = buildStudentAccessState({
      studentStartDate: new Date("2026-01-10T00:00:00.000Z"),
      now: new Date("2027-07-11T00:00:00.000Z"),
    })

    assert.equal(STUDENT_ACCESS_MONTHS, 18)
    assert.equal(state.studentStatus, "ACTIVE")
    assert.equal(state.eligibleForTherapistDiscount, true)
    assert.equal(state.studentAccessExpiresAt.toISOString(), "2027-07-10T00:00:00.000Z")
    assert.equal(expired.studentStatus, "EXPIRED")
    assert.equal(expired.eligibleForTherapistDiscount, true)
  })

  it("resolves each public Supporter amount choice to its interval-specific Stripe Price", () => {
    const env = {
      STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1_monthly",
      STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_1_yearly",
      STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2_monthly",
      STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "price_supporter_2_yearly",
      STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "price_supporter_5_monthly",
      STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "price_supporter_5_yearly",
      STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_yearly",
      STRIPE_PRACTICE_MONTHLY_PRICE_ID: "price_practice_monthly",
    }

    assert.deepEqual(SUPPORTER_AMOUNT_CHOICES, [
      { id: "support-1", monthAmountCents: 100, yearAmountCents: 1000 },
      { id: "support-2", monthAmountCents: 200, yearAmountCents: 2000 },
      { id: "support-5", monthAmountCents: 500, yearAmountCents: 5000 },
    ])
    assert.equal(
      supporterPriceEnvironmentKey("support-2", "year"),
      "STRIPE_SUPPORTER_2_YEARLY_PRICE_ID",
    )

    for (const choice of SUPPORTER_AMOUNT_CHOICES) {
      const suffix = choice.id.replace("support-", "")
      for (const interval of ["month", "year"]) {
        const priceId = `price_supporter_${suffix}_${interval === "month" ? "monthly" : "yearly"}`
        assert.equal(resolveStripePriceId({
          membershipLevel: "SUPPORTER",
          supporterAmountChoiceId: choice.id,
          interval,
          env,
        }), priceId)
        assert.equal(membership.resolveStripePriceMembershipLevel({ priceId, env }), "SUPPORTER")
      }
    }

    assert.equal(resolveStripePriceId({ membershipLevel: "THERAPIST", interval: "year", env }), null)
    assert.equal(resolveStripePriceId({ membershipLevel: "PRACTICE", interval: "month", env }), null)
    assert.equal(resolveStripePriceId({ membershipLevel: "SUPPORTER", supporterAmountChoiceId: "support-9", interval: "month", env }), null)
  })

  it("accepts only Supporter amount choices with a supported Checkout interval", () => {
    for (const interval of ["month", "year"]) {
      assert.equal(isPublicSupporterCheckoutSelection({
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: "support-1",
        interval,
      }), true)
    }

    for (const interval of [undefined, "", "week", "monthly"]) {
      assert.equal(isPublicSupporterCheckoutSelection({
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: "support-1",
        interval,
      }), false)
    }

    assert.equal(isPublicSupporterCheckoutSelection({
      membershipLevel: "THERAPIST",
      supporterAmountChoiceId: "support-1",
      interval: "month",
    }), false)
    assert.equal(isPublicSupporterCheckoutSelection({
      membershipLevel: "PRACTICE",
      supporterAmountChoiceId: "support-5",
      interval: "year",
    }), false)
  })

  it("blocks new Checkout for every relevant or canceling persisted subscription", () => {
    assert.equal(typeof membership.hasSubscriptionBlockingNewCheckout, "function")

    for (const subscription of [
      { status: "active", membershipLevel: "SUPPORTER" },
      { status: "trialing", membershipLevel: "SUPPORTER" },
      { status: "past_due", membershipLevel: "SUPPORTER" },
      { status: "unpaid", membershipLevel: "SUPPORTER" },
      { status: "paused", membershipLevel: "SUPPORTER" },
      { status: "incomplete", membershipLevel: "SUPPORTER" },
      { status: "active", cancelAtPeriodEnd: true, membershipLevel: "SUPPORTER" },
    ]) {
      assert.equal(membership.hasSubscriptionBlockingNewCheckout([subscription]), true)
      assert.equal(
        membership.resolveMembershipPricingMode({
          signedIn: true,
          subscriptions: [subscription],
        }),
        "portal",
      )
    }

    assert.equal(
      membership.hasSubscriptionBlockingNewCheckout([
        { status: "canceled", cancelAtPeriodEnd: true, membershipLevel: "SUPPORTER" },
        // Raw Stripe snake_case is intentional: terminal status makes this
        // stale cancellation flag non-blocking without normalizing the field.
        { status: "incomplete_expired", cancel_at_period_end: true, membershipLevel: "SUPPORTER" },
      ]),
      false,
    )
    for (const status of ["canceled", "incomplete_expired"]) {
      assert.equal(
        membership.resolveMembershipPricingMode({
          signedIn: true,
          subscriptions: [{ status, membershipLevel: "SUPPORTER" }],
        }),
        "checkout",
        status,
      )
    }
    assert.equal(
      membership.resolveMembershipPricingMode({ signedIn: false, subscriptions: [] }),
      "auth",
    )
  })

  it("normalizes a null subscription collection and fails closed for unrecognized persisted states", () => {
    assert.equal(membership.hasSubscriptionBlockingNewCheckout(null), false)

    for (const subscription of [
      {},
      { status: "" },
      { status: "future_stripe_status" },
      { status: "future_stripe_status", cancelAtPeriodEnd: true },
    ]) {
      assert.equal(
        membership.hasSubscriptionBlockingNewCheckout([subscription]),
        true,
      )
    }
  })

  it("routes historical Therapist and Practice subscribers to billing management", () => {
    for (const membershipLevel of ["THERAPIST", "PRACTICE"]) {
      assert.equal(
        membership.resolveMembershipPricingMode({
          signedIn: true,
          subscriptions: [{ status: "active", membershipLevel }],
        }),
        "portal",
      )
    }
  })

  it("loads pricing membership status with narrow Customer and subscription queries", async () => {
    const queries = []
    const subscriptions = [
      {
        status: "active",
        membershipLevel: "SUPPORTER",
        currentPeriodEnd: new Date("2026-08-24T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
      },
      {
        status: "canceled",
        membershipLevel: "PRACTICE",
        currentPeriodEnd: new Date("2026-08-24T00:00:00.000Z"),
        cancelAtPeriodEnd: true,
      },
    ]
    const prismaClient = {
      stripeCustomer: {
        findUnique: async (args) => {
          queries.push(args)
          return { id: "stripe_customer_123" }
        },
      },
      membershipSubscription: {
        findMany: async (args) => {
          queries.push(args)
          return subscriptions
        },
      },
    }

    const result = await membership.getUserMembershipPricingStatus(
      prismaClient,
      "user_123",
      new Date("2026-07-24T00:00:00.000Z"),
    )

    assert.deepEqual(queries, [
      {
        where: { userId: "user_123" },
        select: { id: true },
      },
      {
        where: { userId: "user_123" },
        select: {
          status: true,
          membershipLevel: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
    ])
    assert.deepEqual(result, {
      stripeCustomer: { id: "stripe_customer_123" },
      subscriptions,
      activeMembershipLevel: "SUPPORTER",
    })
  })

  it("loads every active temporary candidate through the 500-row boundary with the exact narrow predicate", async () => {
    const calls = []
    const now = new Date("2026-08-08T00:00:00.000Z")
    const rows = membership.TEMPORARY_ACCESS_FEATURE_KEYS.flatMap((featureKey) => (
      Array.from({ length: 100 }, (_, index) => ({
        id: `${featureKey}-${String(index).padStart(3, "0")}`,
        featureKey,
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt: new Date(`2026-09-${String((index % 20) + 1).padStart(2, "0")}T00:00:00.000Z`),
      }))
    ))
    const result = await membership.loadActiveTemporaryGrants({
      temporaryFeatureGrant: {
        findMany: async (args) => {
          calls.push(args)
          return rows
        },
      },
    }, "user-1", now)

    assert.equal(result.length, 500)
    assert.deepEqual(calls, [{
      where: {
        userId: "user-1",
        featureKey: { in: [
          FEATURE_KEYS.premiumBackgrounds,
          FEATURE_KEYS.therapistDocumentationTools,
          FEATURE_KEYS.calendarBasicScheduling,
          FEATURE_KEYS.calendarFullScheduling,
          FEATURE_KEYS.externalCalendarSync,
        ] },
        startsAt: { lte: now },
        expiresAt: { gt: now },
        revocation: null,
      },
      select: { id: true, featureKey: true, startsAt: true, expiresAt: true },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: 501,
    }])
    assert.equal(result.every((grant) => grant.revocation === null), true)
    for (const featureKey of membership.TEMPORARY_ACCESS_FEATURE_KEYS) {
      assert.equal(result.filter((grant) => grant.featureKey === featureKey).length, 100)
    }
  })

  it("fails closed when one temporary feature has a 101st active grant below the total sentinel", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: `grant-${String(index).padStart(3, "0")}`,
      featureKey: FEATURE_KEYS.premiumBackgrounds,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    }))

    await assert.rejects(() => membership.loadActiveTemporaryGrants({
      temporaryFeatureGrant: {
        findMany: async () => rows,
      },
    }, "user-1", new Date("2026-08-08T00:00:00.000Z")), /more than 100 active grants for one feature/i)
  })

  it("fails closed when the active temporary-grant sentinel returns a 501st row", async () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({
      id: `grant-${String(index).padStart(3, "0")}`,
      featureKey: FEATURE_KEYS.premiumBackgrounds,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    }))

    await assert.rejects(() => membership.loadActiveTemporaryGrants({
      temporaryFeatureGrant: {
        findMany: async () => rows,
      },
    }, "user-1", new Date("2026-08-08T00:00:00.000Z")), /too many active grants/i)
  })

  it("passes the same captured now and complete temporary rows through entitlement and membership loaders", async () => {
    const now = new Date("2026-08-08T00:00:00.000Z")
    const calls = []
    const temporaryRows = [{
      id: "grant-1",
      featureKey: FEATURE_KEYS.premiumBackgrounds,
      startsAt: now,
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    }]
    const prismaClient = {
      stripeCustomer: { findUnique: async () => null },
      membershipSubscription: { findMany: async () => [] },
      studentAccess: { findUnique: async () => null },
      userRole: { findFirst: async () => null },
      temporaryFeatureGrant: {
        findMany: async (args) => {
          calls.push(args)
          return temporaryRows
        },
      },
    }

    const [state, summary] = await Promise.all([
      membership.getUserEntitlementState(prismaClient, "user-1", now),
      membership.getUserMembershipSummary(prismaClient, "user-1", now),
    ])

    assert.equal(calls.length, 2)
    assert.equal(calls.every(({ where }) => where.startsAt.lte === now && where.expiresAt.gt === now), true)
    assert.equal(calls.every((query) => query.take === 501), true)
    assert.equal(state.hasFeature(FEATURE_KEYS.premiumBackgrounds), true)
    assert.equal(summary.entitlements.hasFeature(FEATURE_KEYS.premiumBackgrounds), true)
    assert.doesNotMatch(JSON.stringify(summary.entitlements.featureAccess), /grant-1|actor|internalNote|idempotency/i)
  })

  it("does not treat an ended active subscription as the current pricing level", async () => {
    const now = new Date("2026-07-24T00:00:00.000Z")
    const subscriptions = [{
      status: "active",
      membershipLevel: "SUPPORTER",
      currentPeriodEnd: now,
      cancelAtPeriodEnd: false,
    }]
    const result = await membership.getUserMembershipPricingStatus({
      stripeCustomer: {
        findUnique: async () => ({ id: "stripe_customer_123" }),
      },
      membershipSubscription: {
        findMany: async () => subscriptions,
      },
    }, "user_123", now)

    assert.deepEqual(result, {
      stripeCustomer: { id: "stripe_customer_123" },
      subscriptions,
      activeMembershipLevel: null,
    })
  })

  it("keeps historical Therapist and Practice Price normalization readable outside the public catalog", () => {
    const env = {
      STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_yearly",
      STRIPE_PRACTICE_MONTHLY_PRICE_ID: "price_practice_monthly",
    }

    assert.equal(typeof membership.resolveStripePriceMembershipLevel, "function")
    assert.equal(
      membership.resolveStripePriceMembershipLevel({ priceId: "price_therapist_yearly", env }),
      "THERAPIST",
    )
    assert.equal(
      membership.resolveStripePriceMembershipLevel({ priceId: "price_practice_monthly", env }),
      "PRACTICE",
    )
    assert.equal(membership.resolveStripePriceMembershipLevel({ priceId: "price_unknown", env }), null)
  })

  it("builds a Checkout Session request for recurring Stripe Billing", () => {
    const payload = buildCheckoutSessionPayload({
      customerId: "cus_123",
      priceId: "price_123",
      userId: "user_123",
      membershipLevel: "THERAPIST",
      successUrl: "https://massagelab.app/account?checkout=success",
      cancelUrl: "https://massagelab.app/account?checkout=cancelled",
      couponId: "coupon_generic_test",
    })

    assert.deepEqual(payload, {
      mode: "subscription",
      customer: "cus_123",
      client_reference_id: "user_123",
      success_url: "https://massagelab.app/account?checkout=success",
      cancel_url: "https://massagelab.app/account?checkout=cancelled",
      "line_items[0][price]": "price_123",
      "line_items[0][quantity]": "1",
      "metadata[userId]": "user_123",
      "metadata[membershipLevel]": "THERAPIST",
      "subscription_data[metadata][userId]": "user_123",
      "subscription_data[metadata][membershipLevel]": "THERAPIST",
      "discounts[0][coupon]": "coupon_generic_test",
    })
  })

  it("sorts membership subscriptions with active access before recently canceled records", () => {
    const subscriptions = [
      {
        status: "canceled",
        membershipLevel: "THERAPIST",
        updatedAt: new Date("2026-05-16T16:21:04.027Z"),
        currentPeriodEnd: new Date("2027-05-16T15:52:42.000Z"),
      },
      {
        status: "active",
        membershipLevel: "THERAPIST",
        updatedAt: new Date("2026-05-16T16:15:45.913Z"),
        currentPeriodEnd: new Date("2027-05-16T15:57:45.000Z"),
      },
    ]

    const sorted = sortMembershipSubscriptionsForDisplay(subscriptions)

    assert.equal(sorted[0].status, "active")
    assert.equal(sorted[1].status, "canceled")
    assert.notEqual(sorted, subscriptions)
    assert.equal(subscriptions[0].status, "canceled")
  })
})
