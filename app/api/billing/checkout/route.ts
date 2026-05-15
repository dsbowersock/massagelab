import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import {
  getCheckoutDiscountCouponId,
  isEarlyAccessDiscountEnabled,
  isPaidMembershipLevel,
  isStudentTherapistUpgradeEligible,
  resolveStripePriceId,
} from "@/lib/membership"
import {
  createStripeCheckoutSession,
  ensureStripeCustomerForUser,
} from "@/lib/stripe-billing"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

async function checkoutRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    return {
      isForm: true,
      membershipLevel: String(formData.get("membershipLevel") ?? "").toUpperCase(),
      interval: String(formData.get("interval") ?? "month"),
    }
  }

  const body = await request.json().catch(() => ({}))
  return {
    isForm: false,
    membershipLevel: String(body.membershipLevel ?? "").toUpperCase(),
    interval: String(body.interval ?? "month"),
  }
}

function accountRedirect(code: string) {
  return NextResponse.redirect(`${getSiteUrl()}/account?billing=${encodeURIComponent(code)}`, 303)
}

export async function POST(request: Request) {
  const input = await checkoutRequest(request)
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return input.isForm
      ? NextResponse.redirect(`${getSiteUrl()}/login`, 303)
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isPaidMembershipLevel(input.membershipLevel)) {
    return input.isForm
      ? accountRedirect("unsupported-plan")
      : NextResponse.json({ error: "Unsupported membership level" }, { status: 400 })
  }

  const priceId = resolveStripePriceId({
    membershipLevel: input.membershipLevel,
    interval: input.interval,
  })

  if (!priceId) {
    return input.isForm
      ? accountRedirect("price-not-configured")
      : NextResponse.json({ error: "Stripe price is not configured" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    return input.isForm
      ? accountRedirect("account-not-found")
      : NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  try {
    const [customer, studentAccess] = await Promise.all([
      ensureStripeCustomerForUser(prisma, user),
      prisma.studentAccess.findUnique({ where: { userId: user.id } }),
    ])
    const couponId = getCheckoutDiscountCouponId({
      membershipLevel: input.membershipLevel,
      isStudentTherapistUpgrade:
        input.membershipLevel === "THERAPIST" && isStudentTherapistUpgradeEligible(studentAccess),
      earlyAccessEnabled: isEarlyAccessDiscountEnabled(),
    })
    const checkoutSession = await createStripeCheckoutSession({
      customerId: customer.stripeCustomerId,
      priceId,
      userId: user.id,
      membershipLevel: input.membershipLevel,
      successUrl: `${getSiteUrl()}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${getSiteUrl()}/account?checkout=cancelled`,
      couponId,
    })

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a Checkout URL.")
    }

    return input.isForm
      ? NextResponse.redirect(checkoutSession.url, 303)
      : NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout."
    return input.isForm
      ? accountRedirect("checkout-error")
      : NextResponse.json({ error: message }, { status: 500 })
  }
}
