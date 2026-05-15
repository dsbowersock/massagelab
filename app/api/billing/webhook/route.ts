import { NextResponse } from "next/server"
import {
  getStripeWebhookSecret,
  recordCheckoutSessionCompleted,
  upsertMembershipSubscriptionFromStripe,
  verifyStripeWebhookSignature,
} from "@/lib/stripe-billing"
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
    await recordCheckoutSessionCompleted(prisma, object)
  }

  if (
    event?.type === "customer.subscription.created" ||
    event?.type === "customer.subscription.updated" ||
    event?.type === "customer.subscription.deleted"
  ) {
    await upsertMembershipSubscriptionFromStripe(prisma, object)
  }

  return NextResponse.json({ received: true })
}
