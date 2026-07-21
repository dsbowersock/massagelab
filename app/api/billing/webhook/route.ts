import { NextResponse } from "next/server"
import {
  BACKGROUND_PURCHASE_PURPOSE,
  classifyStripeCheckoutSessionPurpose,
  getStripeWebhookSecret,
  recordCheckoutSessionCompleted,
  retrieveBackgroundPurchaseCheckoutSessionForFulfillment,
  upsertMembershipSubscriptionFromStripe,
  verifyStripeWebhookSignature,
} from "@/lib/stripe-billing"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { fulfillBackgroundPurchase } from "@/lib/commerce/fulfillment-service"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const BACKGROUND_CHECKOUT_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
])

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
      const result = await recordCheckoutSessionCompleted(prisma, object)
      clearAccountSurfaceDataCache(
        result?.customer?.userId ?? result?.subscription?.userId,
        "membership",
      )
    }
    // Donation and unknown explicit purposes are acknowledged without
    // membership or commerce mutation, preserving the existing donation path.
  }

  if (
    event?.type === "customer.subscription.created" ||
    event?.type === "customer.subscription.updated" ||
    event?.type === "customer.subscription.deleted" ||
    event?.type === "customer.subscription.paused" ||
    event?.type === "customer.subscription.resumed"
  ) {
    const subscription = await upsertMembershipSubscriptionFromStripe(prisma, object)
    clearAccountSurfaceDataCache(subscription?.userId, "membership")
  }

  return NextResponse.json({ received: true })
}
