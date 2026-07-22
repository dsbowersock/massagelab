export class StripeTestCleanupError extends Error {
  constructor(failureCodes, evidence) {
    super(`Stripe test cleanup failed (${failureCodes.length} checks).`)
    this.name = "StripeTestCleanupError"
    this.failureCodes = failureCodes
    this.evidence = evidence
  }
}

/**
 * Removes only the Stripe test objects created by an isolated rollout and
 * verifies their terminal states. Processor errors are reduced to safe codes;
 * every independent cleanup check is attempted before a failure is raised.
 */
export async function verifyStripeTestCleanup({
  stripe,
  stripeMode,
  stripeSecretKey,
  checkoutSessionId,
  customerId,
}) {
  const preflightFailureCodes = []
  if (stripeMode !== "test") preflightFailureCodes.push("stripe_test_mode_required")
  if (!String(stripeSecretKey ?? "").startsWith("sk_test_")) {
    preflightFailureCodes.push("stripe_test_key_required")
  }
  if (checkoutSessionId && !checkoutSessionId.startsWith("cs_test_")) {
    preflightFailureCodes.push("checkout_test_id_required")
  }
  if (customerId && !customerId.startsWith("cus_")) {
    preflightFailureCodes.push("customer_id_required")
  }
  if (!checkoutSessionId && !customerId) {
    preflightFailureCodes.push("stripe_cleanup_object_required")
  }
  if (preflightFailureCodes.length > 0) {
    throw new StripeTestCleanupError(preflightFailureCodes, {
      checkoutExpireResponseExpired: null,
      checkoutSessionRetrievedExpired: null,
      customerDeleteResponseDeleted: null,
      customerRetrievedDeleted: null,
      checkoutSessionCleanupVerified: null,
      customerCleanupVerified: null,
    })
  }

  const failureCodes = []
  let checkoutExpireResponseExpired = checkoutSessionId ? false : null
  let checkoutSessionRetrievedExpired = checkoutSessionId ? false : null
  let customerDeleteResponseDeleted = customerId ? false : null
  let customerRetrievedDeleted = customerId ? false : null

  if (checkoutSessionId) {
    try {
      const expired = await stripe.checkout.sessions.expire(checkoutSessionId)
      checkoutExpireResponseExpired = expired?.status === "expired"
      if (!checkoutExpireResponseExpired) failureCodes.push("checkout_expire_not_confirmed")
    } catch {
      failureCodes.push("checkout_expire_failed")
    }

    try {
      const retrievedSession = await stripe.checkout.sessions.retrieve(checkoutSessionId)
      checkoutSessionRetrievedExpired = retrievedSession?.status === "expired"
      if (!checkoutSessionRetrievedExpired) failureCodes.push("checkout_not_expired")
    } catch {
      failureCodes.push("checkout_retrieve_failed")
    }
  }

  if (customerId) {
    try {
      const deleted = await stripe.customers.del(customerId)
      customerDeleteResponseDeleted = deleted?.deleted === true
      if (!customerDeleteResponseDeleted) failureCodes.push("customer_delete_not_confirmed")
    } catch {
      failureCodes.push("customer_delete_failed")
    }

    try {
      const retrievedCustomer = await stripe.customers.retrieve(customerId)
      customerRetrievedDeleted = retrievedCustomer?.deleted === true
      if (!customerRetrievedDeleted) failureCodes.push("customer_not_deleted")
    } catch {
      failureCodes.push("customer_retrieve_failed")
    }
  }

  const evidence = {
    checkoutExpireResponseExpired,
    checkoutSessionRetrievedExpired,
    customerDeleteResponseDeleted,
    customerRetrievedDeleted,
    checkoutSessionCleanupVerified: checkoutSessionId
      ? checkoutExpireResponseExpired && checkoutSessionRetrievedExpired
      : null,
    customerCleanupVerified: customerId
      ? customerDeleteResponseDeleted && customerRetrievedDeleted
      : null,
  }

  if (failureCodes.length > 0) {
    throw new StripeTestCleanupError(failureCodes, evidence)
  }

  return evidence
}
