import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import { createStripeCustomerPortalSession } from "@/lib/stripe-billing"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

function accountRedirect(code: string) {
  return NextResponse.redirect(`${getSiteUrl()}/account?portal=${encodeURIComponent(code)}`, 303)
}

export async function POST() {
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
    const portalSession = await createStripeCustomerPortalSession({
      customerId: stripeCustomer.stripeCustomerId,
      returnUrl: `${getSiteUrl()}/account?portal=returned`,
    })

    if (!portalSession.url) {
      throw new Error("Stripe did not return a Customer Portal URL.")
    }

    return NextResponse.redirect(portalSession.url, 303)
  } catch {
    return accountRedirect("error")
  }
}
