import { NextResponse } from "next/server"
import {
  getStripeWebhookSecret,
  recordCheckoutSessionCompleted,
  upsertMembershipSubscriptionFromStripe,
  verifyStripeWebhookSignature,
} from "@/lib/stripe-billing"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature") ?? ""
  const webhookSecret = getStripeWebhookSecret()

  if (!verifyStripeWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  const object = event?.data?.object

  if (event?.type === "checkout.session.completed") {
    const result = await recordCheckoutSessionCompleted(prisma, object)
    clearAccountSurfaceDataCache(result?.customer?.userId ?? result?.subscription?.userId, "membership")
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
