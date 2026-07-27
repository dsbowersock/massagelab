import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import { createStripeCustomerPortalSession } from "@/lib/stripe-billing"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

function accountRedirect(code: string) {
  return NextResponse.redirect(`${getSiteUrl()}/account?portal=${encodeURIComponent(code)}`, 303)
}

/**
 * Defaults malformed or unknown submissions to the non-destructive Portal
 * homepage. Only the exact first-party action requests Stripe's update flow.
 */
async function requestedPortalDestination(request: Request) {
  try {
    const formData = await request.formData()
    return formData.get("destination") === "subscription-update"
      ? "subscription-update"
      : "manage"
  } catch {
    return "manage"
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.redirect(`${getSiteUrl()}/login`, 303)
  }

  const stripeCustomer = await prisma.stripeCustomer.findUnique({
    where: { userId: session.user.id },
  })

  if (!stripeCustomer) {
    return accountRedirect("customer-not-found")
  }

  try {
    const destination = await requestedPortalDestination(request)
    const subscription = destination === "subscription-update"
      ? await prisma.membershipSubscription.findFirst({
          where: {
            userId: session.user.id,
            stripeCustomerId: stripeCustomer.stripeCustomerId,
            status: {
              in: ["active", "trialing"],
            },
          },
          orderBy: [
            { currentPeriodEnd: "desc" },
            { updatedAt: "desc" },
          ],
          select: {
            stripeSubscriptionId: true,
          },
        })
      : null

    if (destination === "subscription-update" && !subscription) {
      return accountRedirect("subscription-not-found")
    }

    const portalSession = await createStripeCustomerPortalSession({
      customerId: stripeCustomer.stripeCustomerId,
      returnUrl: `${getSiteUrl()}/account?portal=returned`,
      subscriptionId: subscription?.stripeSubscriptionId,
    })

    if (!portalSession.url) {
      throw new Error("Stripe did not return a Customer Portal URL.")
    }

    return NextResponse.redirect(portalSession.url, 303)
  } catch {
    return accountRedirect("error")
  }
}
