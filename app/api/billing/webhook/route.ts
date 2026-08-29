import { NextResponse } from "next/server"
import {
  BACKGROUND_PURCHASE_PURPOSE,
  classifyStripeCheckoutSessionPurpose,
  getStripeClient,
  getStripeWebhookSecret,
  retrieveBackgroundPurchaseCheckoutSessionForFulfillment,
  retrieveStripeSubscription,
  verifyStripeWebhookSignature,
} from "@/lib/stripe-billing"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { fulfillBackgroundPurchase } from "@/lib/commerce/fulfillment-service"
import {
  applyStripeDisputeEvent,
  applyStripeRefundEvent,
} from "@/lib/commerce/reversal-service"
import {
  MembershipWebhookRetryableError,
  processStripeMembershipEvent,
} from "@/lib/membership-webhook-service"
import { prisma } from "@/lib/prisma"
import {
  STRIPE_BACKGROUND_CHECKOUT_WEBHOOK_EVENTS,
  STRIPE_BACKGROUND_DISPUTE_WEBHOOK_EVENTS,
  STRIPE_BACKGROUND_REFUND_WEBHOOK_EVENTS,
  STRIPE_MEMBERSHIP_WEBHOOK_EVENTS,
} from "@/lib/stripe-webhook-contract"

export const runtime = "nodejs"

const BACKGROUND_CHECKOUT_EVENT_TYPES = new Set(STRIPE_BACKGROUND_CHECKOUT_WEBHOOK_EVENTS)
const REFUND_EVENT_TYPES = new Set(STRIPE_BACKGROUND_REFUND_WEBHOOK_EVENTS)
const DISPUTE_EVENT_TYPES = new Set(STRIPE_BACKGROUND_DISPUTE_WEBHOOK_EVENTS)
const MEMBERSHIP_EVENT_TYPES = new Set(STRIPE_MEMBERSHIP_WEBHOOK_EVENTS)

function processorObjectId(value: unknown) {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "id" in value) {
    return typeof value.id === "string" ? value.id : ""
  }
  return ""
}

/**
 * Delegates one signed membership event to the convergence owner and maps only
 * its safe retry signal to Stripe's retryable HTTP contract.
 */
async function processMembershipEvent(event: unknown) {
  try {
    const result = await processStripeMembershipEvent({
      prismaClient: prisma,
      event,
      retrieveSubscription: retrieveStripeSubscription,
    })
    if (result.changed) {
      clearAccountSurfaceDataCache(result.userId, "membership")
    }
    return null
  } catch (error) {
    if (error instanceof MembershipWebhookRetryableError) {
      return NextResponse.json({ received: false, retry: true }, { status: 503 })
    }
    return NextResponse.json({ received: false }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature") ?? ""
  const webhookSecret = getStripeWebhookSecret()

  if (!verifyStripeWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  const object = event?.data?.object

  if (String(event?.type ?? "").startsWith("checkout.session.")) {
    const purpose = classifyStripeCheckoutSessionPurpose(object)

    if (
      purpose === BACKGROUND_PURCHASE_PURPOSE
      && BACKGROUND_CHECKOUT_EVENT_TYPES.has(event.type)
    ) {
      // Retrieval is deliberately complete before the commerce transaction:
      // the fulfillment service performs database-only work.
      const session = await retrieveBackgroundPurchaseCheckoutSessionForFulfillment(object?.id)
      const result = await fulfillBackgroundPurchase({
        prismaClient: prisma,
        eventId: String(event.id ?? ""),
        eventType: event.type,
        eventCreatedAt: typeof event.created === "number" ? event.created : undefined,
        session,
      })
      if (result.changed) {
        clearAccountSurfaceDataCache(result.userId, "membership")
      }
    } else if (event.type === "checkout.session.completed" && purpose === "membership") {
      const response = await processMembershipEvent(event)
      if (response) return response
    }
    // Donation and unknown explicit purposes are acknowledged without
    // membership or commerce mutation, preserving the existing donation path.
  }

  if (MEMBERSHIP_EVENT_TYPES.has(event?.type)) {
    const response = await processMembershipEvent(event)
    if (response) return response
  }

  if (REFUND_EVENT_TYPES.has(event?.type)) {
    const result = await applyStripeRefundEvent({
      prismaClient: prisma,
      eventId: String(event.id ?? ""),
      eventType: event.type,
      processorCreatedAt: typeof event.created === "number" ? event.created : undefined,
      refund: object,
    })
    if (result.changed && "userId" in result && result.userId) {
      clearAccountSurfaceDataCache(result.userId, "membership")
    }
  }

  if (DISPUTE_EVENT_TYPES.has(event?.type)) {
    let paymentIntentId = processorObjectId(object?.payment_intent)
    if (!paymentIntentId) {
      const embeddedCharge = object?.charge && typeof object.charge === "object" ? object.charge : null
      const chargeId = processorObjectId(object?.charge)
      const charge = embeddedCharge ?? (chargeId ? await getStripeClient().charges.retrieve(chargeId) : null)
      paymentIntentId = processorObjectId(charge?.payment_intent)
    }

    const result = await applyStripeDisputeEvent({
      prismaClient: prisma,
      eventId: String(event.id ?? ""),
      eventType: event.type,
      processorCreatedAt: typeof event.created === "number" ? event.created : undefined,
      paymentIntentId,
      dispute: object,
    })
    if (result.changed && "userId" in result && result.userId) {
      clearAccountSurfaceDataCache(result.userId, "membership")
    }
  }

  return NextResponse.json({ received: true })
}
