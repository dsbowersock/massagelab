import {
  type BackgroundCheckoutDependencies,
  commerceErrorResponse,
  defaultBackgroundCheckoutDependencies,
} from "../route.ts"
import {
  getBackgroundPurchaseCheckoutSessionEvidence,
} from "../../../../../lib/stripe-billing.js"
import {
  COMMERCE_ERROR_CODES,
  CommerceError,
} from "../../../../../lib/commerce/errors.ts"

export const runtime = "nodejs"

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null)
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/**
 * Explicit cancellation is processor-first: an AWAITING_PAYMENT reservation is
 * never released while its Stripe Session remains open or payment is pending.
 */
export function createBackgroundCheckoutCancelPostHandler(
  overrides: Partial<BackgroundCheckoutDependencies> = {},
): (request: Request) => Promise<Response> {
  const deps = { ...defaultBackgroundCheckoutDependencies(), ...overrides }

  return async (request: Request) => {
    try {
      const body = await jsonBody(request)
      const orderId = typeof body.orderId === "string" ? body.orderId.trim() : ""
      const sessionUserId = await deps.getSessionUserId()
      if (!sessionUserId) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.AUTHENTICATION_REQUIRED })
      }
      const user = await deps.loadUser(sessionUserId)
      if (!user) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.AUTHENTICATION_REQUIRED })
      }
      if (!user.emailVerified) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED })
      }
      if (!orderId) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
      }

      const order = await deps.loadOrder(orderId)
      if (!order || order.userId !== user.id) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
      }
      if (order.status === "CANCELED" || order.status === "PAYMENT_FAILED") {
        return Response.json(
          { orderId: order.id, status: order.status },
          { headers: { "Cache-Control": "private, no-store" } },
        )
      }
      if (order.status === "REVIEW_REQUIRED") {
        return Response.json(
          { orderId: order.id, status: "REVIEW_REQUIRED" },
          { status: 202, headers: { "Cache-Control": "private, no-store" } },
        )
      }
      if (order.status !== "PREPARING" && order.status !== "AWAITING_PAYMENT") {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING })
      }

      if (!order.stripeCheckoutSessionId) {
        const cancellationNow = deps.now()
        // Do not release a potentially live processor session: explicit
        // cancellation is safe only after the same reservation-expiry boundary.
        const sessionlessIndeterminateExpired = order.status === "AWAITING_PAYMENT"
          && Boolean(order.reservationExpiresAt)
          && order.reservationExpiresAt!.getTime() <= cancellationNow.getTime()
        if (order.status === "AWAITING_PAYMENT" && !sessionlessIndeterminateExpired) {
          throw new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING })
        }
        const released = await deps.releaseUnpaidOrder({
          userId: user.id,
          orderId: order.id,
          expectedSessionId: null,
          allowedStatuses: sessionlessIndeterminateExpired ? ["AWAITING_PAYMENT"] : ["PREPARING"],
          processorStatus: sessionlessIndeterminateExpired ? "expired" : "none",
          paymentStatus: "unpaid",
          terminalStatus: "CANCELED",
          reasonCode: sessionlessIndeterminateExpired ? "SESSIONLESS_CHECKOUT_EXPIRED" : "CUSTOMER_CANCELED",
          ...(sessionlessIndeterminateExpired
            ? { reservationExpiresAtLte: cancellationNow }
            : {}),
        })
        if (!released) {
          throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
        }
        return Response.json(
          { orderId: order.id, status: "CANCELED" },
          { headers: { "Cache-Control": "private, no-store" } },
        )
      }

      let processorSession = await deps.retrieveCheckoutSession(order.stripeCheckoutSessionId)
      let evidence = getBackgroundPurchaseCheckoutSessionEvidence(processorSession)
      if (evidence.status === "open" && !evidence.paid) {
        try {
          await deps.expireCheckoutSession(order.stripeCheckoutSessionId)
        } catch {
          // A payment can complete between retrieval and expiration. Re-read
          // processor state before deciding whether any reservation can move.
        }
        processorSession = await deps.retrieveCheckoutSession(order.stripeCheckoutSessionId)
        evidence = getBackgroundPurchaseCheckoutSessionEvidence(processorSession)
      }

      if (evidence.paid) {
        if (evidence.reviewRequired) {
          await deps.markReviewRequired({
            userId: user.id,
            orderId: order.id,
            expectedSessionId: order.stripeCheckoutSessionId,
            processorSessionId: order.stripeCheckoutSessionId,
            reasonCode: "PROCESSOR_COUNTRY_REVIEW",
          })
          return Response.json(
            { orderId: order.id, status: "REVIEW_REQUIRED" },
            { status: 202, headers: { "Cache-Control": "private, no-store" } },
          )
        }
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING })
      }

      if (evidence.status !== "expired") {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING })
      }
      const released = await deps.releaseUnpaidOrder({
        userId: user.id,
        orderId: order.id,
        expectedSessionId: order.stripeCheckoutSessionId,
        allowedStatuses: ["PREPARING", "AWAITING_PAYMENT"],
        processorStatus: evidence.status,
        paymentStatus: evidence.paymentStatus,
        terminalStatus: "CANCELED",
        reasonCode: "CUSTOMER_CANCELED",
      })
      if (!released) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
      }
      return Response.json(
        { orderId: order.id, status: "CANCELED" },
        { headers: { "Cache-Control": "private, no-store" } },
      )
    } catch (error) {
      return commerceErrorResponse(error)
    }
  }
}

export const POST = createBackgroundCheckoutCancelPostHandler()
