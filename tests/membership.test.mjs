import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  COUPON_IDS,
  FEATURE_KEYS,
  STUDENT_ACCESS_MONTHS,
  buildCheckoutSessionPayload,
  buildEntitlements,
  buildStudentAccessState,
  getCheckoutDiscountCouponId,
  isActiveSubscriptionStatus,
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
    assert.equal(active.hasFeature(FEATURE_KEYS.therapistDocumentationTools), true)
    assert.equal(active.hasFeature(FEATURE_KEYS.calendarFullScheduling), true)
    assert.equal(active.hasFeature(FEATURE_KEYS.calendarTeamScheduling), false)
    assert.equal(teamPractice.hasFeature(FEATURE_KEYS.therapistDocumentationTools), true)
    assert.equal(teamPractice.hasFeature(FEATURE_KEYS.calendarFullScheduling), true)
    assert.equal(teamPractice.hasFeature(FEATURE_KEYS.calendarTeamScheduling), true)
    assert.equal(pastDue.level, "FREE")
    assert.equal(pastDue.hasFeature(FEATURE_KEYS.therapistDocumentationTools), false)
    assert.equal(pastDue.hasFeature(FEATURE_KEYS.chimerCustomColors), false)
    assert.equal(canceled.level, "FREE")
    assert.equal(canceled.hasFeature(FEATURE_KEYS.therapistDocumentationTools), false)
    assert.equal(canceled.hasFeature(FEATURE_KEYS.chimerCustomColors), false)
    assert.equal(isActiveSubscriptionStatus("trialing"), true)
    assert.equal(isActiveSubscriptionStatus("incomplete"), false)
  })

  it("does not unlock therapist documentation tools for supporter or student access", () => {
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
    assert.equal(supporter.hasFeature(FEATURE_KEYS.therapistDocumentationTools), false)
    assert.equal(student.level, "STUDENT")
    assert.equal(student.hasFeature(FEATURE_KEYS.therapistDocumentationTools), false)
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

  it("uses student upgrade discount before early access discount", () => {
    assert.equal(
      getCheckoutDiscountCouponId({ membershipLevel: "THERAPIST", isStudentTherapistUpgrade: true, earlyAccessEnabled: true }),
      COUPON_IDS.studentToTherapist,
    )
    assert.equal(
      getCheckoutDiscountCouponId({ membershipLevel: "SUPPORTER", isStudentTherapistUpgrade: false, earlyAccessEnabled: true }),
      COUPON_IDS.earlyAccess,
    )
    assert.equal(
      getCheckoutDiscountCouponId({ membershipLevel: "PRACTICE", isStudentTherapistUpgrade: false, earlyAccessEnabled: false }),
      null,
    )
  })

  it("resolves Stripe prices from explicit membership and billing interval env vars", () => {
    const env = {
      STRIPE_SUPPORTER_MONTHLY_PRICE_ID: "price_supporter_monthly",
      STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_yearly",
    }

    assert.equal(resolveStripePriceId({ membershipLevel: "SUPPORTER", interval: "month", env }), "price_supporter_monthly")
    assert.equal(resolveStripePriceId({ membershipLevel: "THERAPIST", interval: "year", env }), "price_therapist_yearly")
    assert.equal(resolveStripePriceId({ membershipLevel: "STUDENT", interval: "month", env }), null)
  })

  it("maps configured Stripe prices only to paid membership levels", () => {
    const env = {
      STRIPE_SUPPORTER_MONTHLY_PRICE_ID: "price_supporter_monthly",
      STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_yearly",
      STRIPE_PRACTICE_MONTHLY_PRICE_ID: "price_practice_monthly",
      STRIPE_STUDENT_MONTHLY_PRICE_ID: "price_student_monthly",
    }

    assert.equal(typeof membership.resolveStripePriceMembershipLevel, "function")
    assert.equal(
      membership.resolveStripePriceMembershipLevel({ priceId: "price_supporter_monthly", env }),
      "SUPPORTER",
    )
    assert.equal(
      membership.resolveStripePriceMembershipLevel({ priceId: "price_therapist_yearly", env }),
      "THERAPIST",
    )
    assert.equal(
      membership.resolveStripePriceMembershipLevel({ priceId: "price_practice_monthly", env }),
      "PRACTICE",
    )
    assert.equal(membership.resolveStripePriceMembershipLevel({ priceId: "price_student_monthly", env }), null)
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
      couponId: COUPON_IDS.earlyAccess,
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
      "discounts[0][coupon]": COUPON_IDS.earlyAccess,
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
