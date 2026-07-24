import assert from "node:assert/strict"
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
} from "../lib/membership.js"
import * as membership from "../lib/membership.js"

describe("Membership and entitlement helpers", () => {
  it("keeps free users on basic Chimer while allowing a basic calendar taste", () => {
    const entitlements = buildEntitlements({ subscriptions: [], studentAccess: null })

    assert.equal(entitlements.level, "FREE")
    assert.deepEqual(entitlements.features, [FEATURE_KEYS.calendarBasicScheduling])
    assert.equal(entitlements.hasFeature(FEATURE_KEYS.chimerCustomColors), false)
    assert.equal(entitlements.hasFeature(FEATURE_KEYS.premiumBackgrounds), false)
    assert.equal(membership.hasPremiumBackgroundAccess(entitlements.features), false)
    assert.equal(entitlements.hasFeature(FEATURE_KEYS.calendarBasicScheduling), true)
    assert.equal(entitlements.hasFeature(FEATURE_KEYS.calendarFullScheduling), false)
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
    assert.equal(active.hasFeature(FEATURE_KEYS.chimerCustomColors), true)
    assert.equal(active.hasFeature(FEATURE_KEYS.premiumBackgrounds), true)
    assert.equal(membership.hasPremiumBackgroundAccess([FEATURE_KEYS.chimerCustomColors]), false)
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
    assert.equal(pastDue.hasFeature(FEATURE_KEYS.chimerCustomColors), false)
    assert.equal(pastDue.hasFeature(FEATURE_KEYS.premiumBackgrounds), false)
    assert.equal(canceled.level, "FREE")
    assert.equal(canceled.hasFeature(FEATURE_KEYS.therapistDocumentationTools), false)
    assert.equal(canceled.hasFeature(FEATURE_KEYS.chimerCustomColors), false)
    assert.equal(isActiveSubscriptionStatus("trialing"), true)
    assert.equal(isActiveSubscriptionStatus("incomplete"), false)
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

    assert.equal(supporter.hasFeature(FEATURE_KEYS.chimerCustomColors), true)
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
      { id: "support-1", month: 100, year: 1000 },
      { id: "support-2", month: 200, year: 2000 },
      { id: "support-5", month: 500, year: 5000 },
    ])

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

  it("accepts only Supporter amount choices for public Checkout", () => {
    assert.equal(isPublicSupporterCheckoutSelection({ membershipLevel: "SUPPORTER", supporterAmountChoiceId: "support-1" }), true)
    assert.equal(isPublicSupporterCheckoutSelection({ membershipLevel: "THERAPIST", supporterAmountChoiceId: "support-1" }), false)
    assert.equal(isPublicSupporterCheckoutSelection({ membershipLevel: "PRACTICE", supporterAmountChoiceId: "support-5" }), false)
  })

  it("blocks new Checkout for every relevant or canceling persisted subscription", () => {
    assert.equal(typeof membership.hasSubscriptionBlockingNewCheckout, "function")
    assert.equal(typeof membership.resolveMembershipPricingMode, "function")

    for (const subscription of [
      { status: "active", membershipLevel: "SUPPORTER" },
      { status: "trialing", membershipLevel: "SUPPORTER" },
      { status: "past_due", membershipLevel: "SUPPORTER" },
      { status: "unpaid", membershipLevel: "SUPPORTER" },
      { status: "paused", membershipLevel: "SUPPORTER" },
      { status: "incomplete", membershipLevel: "SUPPORTER" },
      { status: "canceled", cancelAtPeriodEnd: true, membershipLevel: "SUPPORTER" },
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
        { status: "canceled", cancelAtPeriodEnd: false, membershipLevel: "SUPPORTER" },
      ]),
      false,
    )
    assert.equal(
      membership.resolveMembershipPricingMode({
        signedIn: true,
        subscriptions: [{ status: "canceled", membershipLevel: "SUPPORTER" }],
      }),
      "checkout",
    )
    assert.equal(
      membership.resolveMembershipPricingMode({ signedIn: false, subscriptions: [] }),
      "auth",
    )
  })

  it("routes historical Therapist and Practice subscribers to billing management", () => {
    assert.equal(typeof membership.resolveMembershipPricingMode, "function")

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

  it("loads pricing membership status with one lightweight subscription query", async () => {
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

    assert.deepEqual(queries, [{
      where: { userId: "user_123" },
      select: {
        status: true,
        membershipLevel: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }])
    assert.deepEqual(result, {
      subscriptions,
      activeMembershipLevel: "SUPPORTER",
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
