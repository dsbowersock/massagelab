import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  StripeTestCleanupError,
  verifyStripeTestCleanup,
} from "../scripts/stripe-test-cleanup.mjs"

function stripeFixture({
  expireError,
  expireResponseStatus = "expired",
  retrievedSessionStatus = "expired",
  deleteError,
  deleteResponseDeleted = true,
  retrievedCustomerDeleted = true,
} = {}) {
  const calls = []
  return {
    calls,
    stripe: {
      checkout: {
        sessions: {
          async expire(id) {
            calls.push(["checkout.expire", id])
            if (expireError) throw expireError
            return { id, object: "checkout.session", status: expireResponseStatus }
          },
          async retrieve(id) {
            calls.push(["checkout.retrieve", id])
            return { id, object: "checkout.session", status: retrievedSessionStatus }
          },
        },
      },
      customers: {
        async del(id) {
          calls.push(["customer.delete", id])
          if (deleteError) throw deleteError
          return { id, object: "customer", deleted: deleteResponseDeleted }
        },
        async retrieve(id) {
          calls.push(["customer.retrieve", id])
          return retrievedCustomerDeleted
            ? { id, object: "customer", deleted: true }
            : { id, object: "customer", deleted: false }
        },
      },
    },
  }
}

describe("Stripe test rollout cleanup", () => {
  it("expires and re-retrieves the Session, then deletes and re-retrieves the Customer", async () => {
    const fixture = stripeFixture()
    const result = await verifyStripeTestCleanup({
      stripe: fixture.stripe,
      stripeMode: "test",
      stripeSecretKey: "sk_test_fixture",
      checkoutSessionId: "cs_test_cleanup",
      customerId: "cus_test_cleanup",
    })

    assert.deepEqual(result, {
      checkoutExpireResponseExpired: true,
      checkoutSessionRetrievedExpired: true,
      customerDeleteResponseDeleted: true,
      customerRetrievedDeleted: true,
      checkoutSessionCleanupVerified: true,
      customerCleanupVerified: true,
    })
    assert.deepEqual(fixture.calls, [
      ["checkout.expire", "cs_test_cleanup"],
      ["checkout.retrieve", "cs_test_cleanup"],
      ["customer.delete", "cus_test_cleanup"],
      ["customer.retrieve", "cus_test_cleanup"],
    ])
  })

  it("aggregates safe cleanup failures while still attempting every verification", async () => {
    const fixture = stripeFixture({
      expireError: new Error("processor detail must not escape"),
      retrievedSessionStatus: "open",
      deleteError: new Error("another processor detail must not escape"),
      retrievedCustomerDeleted: false,
    })

    await assert.rejects(
      verifyStripeTestCleanup({
        stripe: fixture.stripe,
        stripeMode: "test",
        stripeSecretKey: "sk_test_fixture",
        checkoutSessionId: "cs_test_cleanup",
        customerId: "cus_test_cleanup",
      }),
      (error) => {
        assert.equal(error instanceof StripeTestCleanupError, true)
        assert.deepEqual(error.failureCodes, [
          "checkout_expire_failed",
          "checkout_not_expired",
          "customer_delete_failed",
          "customer_not_deleted",
        ])
        assert.doesNotMatch(error.message, /processor detail/)
        assert.deepEqual(error.evidence, {
          checkoutExpireResponseExpired: false,
          checkoutSessionRetrievedExpired: false,
          customerDeleteResponseDeleted: false,
          customerRetrievedDeleted: false,
          checkoutSessionCleanupVerified: false,
          customerCleanupVerified: false,
        })
        return true
      },
    )
    assert.equal(fixture.calls.length, 4)
  })

  it("requires both mutation responses and retrieved terminal states to confirm cleanup", async () => {
    const fixture = stripeFixture({
      expireResponseStatus: "open",
      deleteResponseDeleted: false,
    })

    await assert.rejects(
      verifyStripeTestCleanup({
        stripe: fixture.stripe,
        stripeMode: "test",
        stripeSecretKey: "sk_test_fixture",
        checkoutSessionId: "cs_test_cleanup",
        customerId: "cus_test_cleanup",
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, [
          "checkout_expire_not_confirmed",
          "customer_delete_not_confirmed",
        ])
        assert.equal(error.evidence.checkoutSessionRetrievedExpired, true)
        assert.equal(error.evidence.customerRetrievedDeleted, true)
        return true
      },
    )
  })

  it("still verifies a created Customer when Session creation failed earlier", async () => {
    const fixture = stripeFixture()
    const result = await verifyStripeTestCleanup({
      stripe: fixture.stripe,
      stripeMode: "test",
      stripeSecretKey: "sk_test_fixture",
      customerId: "cus_test_cleanup",
    })

    assert.deepEqual(result, {
      checkoutExpireResponseExpired: null,
      checkoutSessionRetrievedExpired: null,
      customerDeleteResponseDeleted: true,
      customerRetrievedDeleted: true,
      checkoutSessionCleanupVerified: null,
      customerCleanupVerified: true,
    })
    assert.deepEqual(fixture.calls, [
      ["customer.delete", "cus_test_cleanup"],
      ["customer.retrieve", "cus_test_cleanup"],
    ])
  })

  it("rejects live mode, live keys, non-test Session ids, and missing object ids before API calls", async () => {
    const liveFixture = stripeFixture()
    await assert.rejects(
      verifyStripeTestCleanup({
        stripe: liveFixture.stripe,
        stripeMode: "live",
        stripeSecretKey: "sk_live_fixture",
        checkoutSessionId: "cs_live_cleanup",
        customerId: "cus_live_cleanup",
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, [
          "stripe_test_mode_required",
          "stripe_test_key_required",
          "checkout_test_id_required",
        ])
        assert.doesNotMatch(error.message, /sk_live_fixture|cs_live_cleanup|cus_live_cleanup/)
        return true
      },
    )
    assert.deepEqual(liveFixture.calls, [])

    const missingFixture = stripeFixture()
    await assert.rejects(
      verifyStripeTestCleanup({
        stripe: missingFixture.stripe,
        stripeMode: "test",
        stripeSecretKey: "sk_test_fixture",
      }),
      (error) => error.failureCodes.includes("stripe_cleanup_object_required"),
    )
    assert.deepEqual(missingFixture.calls, [])
  })
})
